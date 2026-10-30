-- =====================================================================
-- 0014 · Orçamentos dentro do Núcleo (no formato do Zenith)
--   • cadastro de produtos completo (o mesmo do Zenith: fabricante, modelo,
--     categoria, descrição comercial, custo, multiplicador, foto, estoque)
--   • cadastro de serviços
--   • orçamento com ambientes, produtos, serviços, produtos do cliente,
--     markup adicional, desconto e condições de pagamento
--   • numeração própria dos orçamentos feitos no Núcleo (continua a do Zenith)
--   • fotos dos produtos num bucket público ("produtos")
-- Pode ser executada mais de uma vez.
-- =====================================================================

-- ------------------------------------------------------------- produtos
alter table produtos
  add column if not exists zenith_id      integer unique,
  add column if not exists modelo         text,              -- nome interno
  add column if not exists categoria      text,              -- Rede, Automação, Áudio/Vídeo…
  add column if not exists fornecedor     text,
  add column if not exists cor            text,
  add column if not exists descricao      text,              -- descrição comercial (sai no orçamento)
  add column if not exists medidas        text,
  add column if not exists medidas_nicho  text,
  add column if not exists peso           text,
  add column if not exists voltagem       text,
  add column if not exists garantia_dias  integer,
  add column if not exists ncm            text,
  add column if not exists codigo_barras  text,
  add column if not exists referencia     text,              -- nome referência / código do fabricante
  add column if not exists valor_compra   numeric(14,2) check (valor_compra >= 0),   -- preço pago ao fornecedor
  add column if not exists impostos_pct   numeric(6,2) not null default 0,           -- % somado à compra = custo
  add column if not exists fator_venda    numeric(8,4),                              -- multiplicador sobre o custo
  add column if not exists imagem_path    text,                                      -- bucket "produtos"
  add column if not exists local_estoque  text,
  add column if not exists estoque_recomendado numeric(12,3),
  add column if not exists obs_projeto    text,
  add column if not exists obs_compra     text,
  add column if not exists venda_sem_proposta boolean not null default true;

create index if not exists produtos_busca on produtos using gin (to_tsvector('simple', coalesce(nome,'') || ' ' || coalesce(modelo,'') || ' ' || coalesce(marca,'')));

-- ------------------------------------------------------------- serviços
create table if not exists servicos (
  id          uuid primary key default gen_random_uuid(),
  zenith_id   integer unique,
  nome        text not null,
  categoria   text,
  descricao   text,
  unidade     text not null default 'Un',
  valor       numeric(14,2) not null default 0 check (valor >= 0),
  custo       numeric(14,2) not null default 0 check (custo >= 0),
  tempo_min   integer,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'servicos' and policyname = 'servicos_ler') then
    alter table servicos enable row level security;
    create policy servicos_ler on servicos for select to authenticated using (usuario_ativo());
    create policy servicos_inserir on servicos for insert to authenticated with check (usuario_ativo());
    create policy servicos_alterar on servicos for update to authenticated using (usuario_ativo()) with check (usuario_ativo());
    create policy servicos_excluir on servicos for delete to authenticated using (usuario_diretoria());
    create trigger servicos_auditoria after insert or update or delete on servicos for each row execute function registrar_auditoria();
    create trigger servicos_updated before update on servicos for each row execute function set_updated_at();
  end if;
end $$;

-- ------------------------------------------------------------- orçamento
alter table propostas
  add column if not exists ambientes          text[] not null default '{}',  -- na ordem em que aparecem
  add column if not exists markup_produto_pct numeric(8,4) not null default 0,
  add column if not exists markup_servico_pct numeric(8,4) not null default 0,
  add column if not exists desconto_pct       numeric(8,4) not null default 0,
  add column if not exists formas_pagamento   text[] not null default '{}',  -- "A vista", "10x", "A combinar"…
  add column if not exists validade_dias      integer not null default 15,
  add column if not exists resumo_entrega     text,
  add column if not exists observacoes        text,
  add column if not exists comodato_prazo     integer,
  add column if not exists comodato_taxa      numeric(14,2),
  add column if not exists zenith_negocio     integer,
  add column if not exists editado_em         timestamptz not null default now();

alter table proposta_itens
  add column if not exists servico_id  uuid references servicos(id) on delete set null,
  add column if not exists valor_tabela numeric(14,2);   -- preço de tabela quando o item entrou

-- "cliente" = produto que o cliente fornece (entra no projeto, sem valor)
alter table proposta_itens drop constraint if exists proposta_itens_tipo_check;
alter table proposta_itens add constraint proposta_itens_tipo_check check (tipo in ('produto','servico','cliente'));
alter table proposta_itens drop constraint if exists proposta_itens_quantidade_check;
alter table proposta_itens add constraint proposta_itens_quantidade_check check (quantidade > 0);
create index if not exists proposta_itens_proposta on proposta_itens (proposta_id, ordem);

-- numeração dos orçamentos do Núcleo: continua depois do maior número do Zenith
create sequence if not exists propostas_numero_nucleo;
select setval('propostas_numero_nucleo',
  greatest(coalesce((select max(numero::int) from propostas where numero ~ '^\d+$'), 0), 51), true);

-- Salva o orçamento inteiro (cabeçalho + itens) de uma vez, tudo ou nada.
-- p_dados: { id?, oportunidade_id, cliente_id, projeto_id, titulo, versao, ambientes[], markup_produto_pct,
--            markup_servico_pct, desconto_pct, total_final?, formas_pagamento[], validade_dias, resumo_entrega,
--            observacoes, comodato_prazo, comodato_taxa, status, itens: [{tipo, sistema, produto_id, servico_id,
--            descricao, detalhe, sku, marca, quantidade, unidade, valor_unitario, valor_tabela}] }
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

  if v_id is null then
    insert into propostas (origem, numero, versao, cliente_id, projeto_id, oportunidade_id, titulo, data_emissao,
                           total_produtos, total_servicos, total_itens, total_final, status)
    values ('nucleo', nextval('propostas_numero_nucleo')::text, coalesce(nullif(p_dados->>'versao',''),'V1'),
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

-- ------------------------------------------------------------- fotos dos produtos
insert into storage.buckets (id, name, public, file_size_limit)
values ('produtos', 'produtos', true, 5242880)
on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'produtos_enviar') then
    create policy produtos_enviar on storage.objects for insert to authenticated
      with check (bucket_id = 'produtos' and public.usuario_ativo());
    create policy produtos_trocar on storage.objects for update to authenticated
      using (bucket_id = 'produtos' and public.usuario_ativo());
    create policy produtos_ler on storage.objects for select to authenticated
      using (bucket_id = 'produtos');
  end if;
end $$;
