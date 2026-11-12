-- =====================================================================
-- 0024 · Núcleo sem internet
--   • atividades ganham updated_at (para a sincronização saber quem
--     gravou por último)
--   • salvar_orcamento aceita o id gerado no aparelho: orçamento novo
--     criado offline entra com esse id quando a internet volta
-- Pode ser executada mais de uma vez.
-- =====================================================================
alter table atividades add column if not exists updated_at timestamptz not null default now();
drop trigger if exists atividades_updated on atividades;
create trigger atividades_updated before update on atividades for each row execute function set_updated_at();

create or replace function salvar_orcamento(p_dados jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p_dados->>'id','')::uuid;
  i jsonb; n int := 0;
  v_prod numeric := 0; v_serv numeric := 0; v_mp numeric; v_ms numeric; v_sem_desc numeric; v_final numeric;
begin
  if not usuario_ativo() then raise exception 'Usuário sem permissão'; end if;
  v_mp := coalesce((p_dados->>'markup_produto_pct')::numeric, 0);
  v_ms := coalesce((p_dados->>'markup_servico_pct')::numeric, 0);

  for i in select * from jsonb_array_elements(coalesce(p_dados->'itens','[]'::jsonb)) loop
    if i->>'tipo' = 'produto' then v_prod := v_prod + round((i->>'quantidade')::numeric * (i->>'valor_unitario')::numeric, 2);
    elsif i->>'tipo' = 'servico' then v_serv := v_serv + round((i->>'quantidade')::numeric * (i->>'valor_unitario')::numeric, 2);
    end if;
  end loop;
  v_sem_desc := round(v_prod * (1 + v_mp/100) + v_serv * (1 + v_ms/100), 2);
  v_final := coalesce(nullif(p_dados->>'total_final','')::numeric,
                      round(v_sem_desc * (1 - coalesce((p_dados->>'desconto_pct')::numeric,0)/100), 2));
  if v_final > v_sem_desc then v_final := v_sem_desc; end if;

  -- novo (sem id) ou criado offline (id do aparelho que ainda não existe no banco)
  if v_id is null or not exists (select 1 from propostas where id = v_id) then
    insert into propostas (id, origem, numero, versao, cliente_id, projeto_id, oportunidade_id, titulo, data_emissao,
                           total_produtos, total_servicos, total_itens, total_final, status)
    values (coalesce(v_id, gen_random_uuid()), 'nucleo', nextval('propostas_numero_nucleo')::text, coalesce(nullif(p_dados->>'versao',''),'V1'),
            nullif(p_dados->>'cliente_id','')::uuid, nullif(p_dados->>'projeto_id','')::uuid,
            nullif(p_dados->>'oportunidade_id','')::uuid, p_dados->>'titulo', current_date, 0, 0, 0, 0, 'rascunho')
    returning id into v_id;
  end if;

  update propostas set
    titulo = p_dados->>'titulo',
    versao = coalesce(nullif(p_dados->>'versao',''), versao),
    cliente_id = coalesce(nullif(p_dados->>'cliente_id','')::uuid, cliente_id),
    projeto_id = nullif(p_dados->>'projeto_id','')::uuid,
    oportunidade_id = coalesce(nullif(p_dados->>'oportunidade_id','')::uuid, oportunidade_id),
    ambientes = coalesce((select array_agg(x) from jsonb_array_elements_text(p_dados->'ambientes') x), '{}'),
    markup_produto_pct = v_mp, markup_servico_pct = v_ms,
    desconto_pct = coalesce((p_dados->>'desconto_pct')::numeric, 0),
    formas_pagamento = coalesce((select array_agg(x) from jsonb_array_elements_text(p_dados->'formas_pagamento') x), '{}'),
    condicoes_pagamento = (select string_agg(x, ', ') from jsonb_array_elements_text(p_dados->'formas_pagamento') x),
    validade_dias = coalesce((p_dados->>'validade_dias')::int, validade_dias),
    validade = data_emissao + coalesce((p_dados->>'validade_dias')::int, validade_dias),
    resumo_entrega = p_dados->>'resumo_entrega',
    observacoes = p_dados->>'observacoes',
    comodato_prazo = nullif(p_dados->>'comodato_prazo','')::int,
    comodato_taxa = nullif(p_dados->>'comodato_taxa','')::numeric,
    status = coalesce(nullif(p_dados->>'status','')::status_proposta, case when status = 'rascunho' then 'enviada'::status_proposta else status end),
    total_produtos = round(v_prod * (1 + v_mp/100), 2),
    total_servicos = round(v_serv * (1 + v_ms/100), 2),
    total_itens = v_sem_desc, total_final = v_final, editado_em = now()
  where id = v_id;

  delete from proposta_itens where proposta_id = v_id;
  for i in select * from jsonb_array_elements(coalesce(p_dados->'itens','[]'::jsonb)) loop
    n := n + 1;
    insert into proposta_itens (proposta_id, ordem, sistema, tipo, descricao, detalhe, sku, marca, produto_id, servico_id,
                                quantidade, unidade, valor_unitario, valor_total, valor_tabela)
    values (v_id, n, coalesce(nullif(i->>'sistema',''),'Geral'), i->>'tipo', i->>'descricao', i->>'detalhe', i->>'sku', i->>'marca',
            nullif(i->>'produto_id','')::uuid, nullif(i->>'servico_id','')::uuid,
            (i->>'quantidade')::numeric, coalesce(nullif(i->>'unidade',''),'Un'),
            case when i->>'tipo' = 'cliente' then 0 else (i->>'valor_unitario')::numeric end,
            case when i->>'tipo' = 'cliente' then 0 else round((i->>'quantidade')::numeric * (i->>'valor_unitario')::numeric, 2) end,
            nullif(i->>'valor_tabela','')::numeric);
  end loop;

  -- o negócio passa a valer o orçamento mais recente
  update oportunidades set valor_estimado = v_final, proposta_id = v_id
   where id = (select oportunidade_id from propostas where id = v_id) and etapa not in ('ganho','perdido');
  return v_id;
end $$;
