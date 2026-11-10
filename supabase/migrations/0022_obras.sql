-- =====================================================================
-- 0022 · Obras: cada contrato assinado vira uma obra no Técnico
--   • obras: cliente, contrato, orçamento ganho, quadro de tarefas, prazos, garantia
--   • obra_etapas: cronograma editável por obra
--   • obra_docs: cartões da documentação de entrega (conteúdo em JSON)
--   • obra_segredos: senhas da documentação (acesso só técnico/diretoria, leitura registrada)
--   • obra_itens: o que foi vendido (cópia do orçamento ganho no momento da criação)
--   • obra_saidas: saída/devolução de material → baixa no estoque, conferência
--     vendido / excedente / não vendido / substituto e aviso aos diretores
--   • a obra nasce sozinha quando o PDF do contrato assinado é anexado
-- Pode ser executada mais de uma vez.
-- =====================================================================

create table if not exists obras (
  id               uuid primary key default gen_random_uuid(),
  numero           integer,
  titulo           text not null check (length(trim(titulo)) > 0),
  cliente_id       uuid references clientes(id) on delete set null,
  cliente_nome     text,
  endereco         text,
  telefone         text,
  contrato_id      uuid unique references contratos(id) on delete set null,
  oportunidade_id  uuid references oportunidades(id) on delete set null,
  proposta_id      uuid references propostas(id) on delete set null,
  quadro_id        uuid references quadros(id) on delete set null,
  status           text not null default 'andamento' check (status in ('andamento','pausada','entregue','cancelada')),
  inicio           date,
  previsao_entrega date,
  entregue_em      date,
  garantia_meses   integer not null default 12 check (garantia_meses between 0 and 120),
  responsaveis     uuid[] not null default '{}',
  valor_contrato   numeric(14,2),
  observacoes      text,
  link_arquivos    text,          -- pasta com os arquivos do cliente (vira o QR code da documentação)
  termo_path       text,          -- termo de entrega assinado (PDF)
  created_by       uuid references perfis(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists obras_cliente on obras (cliente_id);
create index if not exists obras_status on obras (status);

create table if not exists obra_etapas (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references obras(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  posicao     double precision not null default 0,
  inicio_prev date,
  fim_prev    date,
  inicio_real date,
  fim_real    date,
  responsavel text,
  observacao  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists obra_etapas_obra on obra_etapas (obra_id, posicao);

create table if not exists obra_docs (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references obras(id) on delete cascade,
  modelo      text not null,                 -- chave do modelo (circuitos, pulsadores, cenas…)
  grupo       text not null,                 -- capítulo do PDF (Sistema de Automação…)
  titulo      text not null,
  posicao     double precision not null default 0,
  status      text not null default 'pendente' check (status in ('pendente','preenchendo','revisao','aprovado')),
  incluir     boolean not null default true, -- sai no PDF final
  conteudo    jsonb not null default '{}'::jsonb,
  atualizado_por uuid references perfis(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists obra_docs_obra on obra_docs (obra_id, posicao);

create table if not exists obra_segredos (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references obras(id) on delete cascade,
  chave      text not null,
  valor      text not null default '',
  updated_at timestamptz not null default now(),
  constraint obra_segredo_unico unique (obra_id, chave)
);

create table if not exists obra_itens (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid not null references obras(id) on delete cascade,
  proposta_item_id uuid references proposta_itens(id) on delete set null,
  produto_id       uuid references produtos(id) on delete set null,
  ordem            integer not null default 0,
  sistema          text not null default '',
  descricao        text not null,
  sku              text,
  marca            text,
  unidade          text not null default 'un',
  quantidade       numeric(12,3) not null check (quantidade >= 0),
  custo_unit       numeric(14,2)
);
create index if not exists obra_itens_obra on obra_itens (obra_id);

alter table estoque_movimentos add column if not exists obra_id uuid references obras(id) on delete set null;

create table if not exists obra_saidas (
  id              uuid primary key default gen_random_uuid(),
  obra_id         uuid not null references obras(id) on delete cascade,
  produto_id      uuid not null references produtos(id) on delete restrict,
  tipo            text not null default 'saida' check (tipo in ('saida','devolucao')),
  quantidade      numeric(12,3) not null check (quantidade > 0),
  classificacao   text not null check (classificacao in ('vendido','excedente','nao_vendido','substituto','devolucao')),
  substitui_item  uuid references obra_itens(id) on delete set null,
  justificativa   text,
  custo_unit      numeric(14,2),
  movimento_id    uuid references estoque_movimentos(id) on delete set null,
  revisado_em     timestamptz,
  revisado_por    uuid references perfis(id),
  created_by      uuid references perfis(id) default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists obra_saidas_obra on obra_saidas (obra_id, created_at);
create index if not exists obra_saidas_pendentes on obra_saidas (created_at) where revisado_em is null and classificacao in ('excedente','nao_vendido','substituto');

-- ---------------------------------------------------------------- acesso, auditoria, tempo real
do $$
declare t text;
begin
  foreach t in array array['obras','obra_etapas','obra_docs','obra_itens','obra_saidas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_ler', t);
    execute format('drop policy if exists %I on %I', t || '_inserir', t);
    execute format('drop policy if exists %I on %I', t || '_alterar', t);
    execute format('drop policy if exists %I on %I', t || '_excluir', t);
    execute format('create policy %I on %I for select to authenticated using (usuario_ativo())', t || '_ler', t);
    execute format('create policy %I on %I for insert to authenticated with check (usuario_ativo())', t || '_inserir', t);
    execute format('create policy %I on %I for update to authenticated using (usuario_ativo()) with check (usuario_ativo())', t || '_alterar', t);
    execute format('create policy %I on %I for delete to authenticated using (usuario_diretoria())', t || '_excluir', t);
    execute format('drop trigger if exists %I on %I', t || '_auditoria', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function registrar_auditoria()', t || '_auditoria', t);
    execute format('alter table %I replica identity full', t);
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; when undefined_object then null; end;
  end loop;
  foreach t in array array['obras','obra_etapas','obra_docs'] loop
    execute format('drop trigger if exists %I on %I', t || '_updated', t);
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t || '_updated', t);
  end loop;
end $$;
-- etapas e documentos: quem preenche também pode remover (são da obra, não do financeiro)
drop policy if exists obra_etapas_excluir on obra_etapas;
create policy obra_etapas_excluir on obra_etapas for delete to authenticated using (usuario_ativo());
drop policy if exists obra_docs_excluir on obra_docs;
create policy obra_docs_excluir on obra_docs for delete to authenticated using (usuario_ativo());
-- saídas só pelo registrar_saida_obra (mantém o estoque e a conferência certos)
drop policy if exists obra_saidas_inserir on obra_saidas;
create policy obra_saidas_inserir on obra_saidas for insert to authenticated with check (false);
drop policy if exists obra_saidas_alterar on obra_saidas;
create policy obra_saidas_alterar on obra_saidas for update to authenticated using (usuario_diretoria()) with check (usuario_diretoria());

-- senhas: só técnico e diretoria; a auditoria guarda que mudou, mas não o valor
create or replace function usuario_ve_senhas() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo and papel in ('diretoria','tecnico'))
$$;
alter table obra_segredos enable row level security;
drop policy if exists obra_segredos_tudo on obra_segredos;
create policy obra_segredos_tudo on obra_segredos for all to authenticated using (usuario_ve_senhas()) with check (usuario_ve_senhas());
create or replace function obra_segredos_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabela, registro_id, acao, antes, depois)
  values ('obra_segredos', coalesce(new.obra_id, old.obra_id)::text, tg_op,
          case when tg_op <> 'INSERT' then jsonb_build_object('chave', old.chave, 'valor', '••••') end,
          case when tg_op <> 'DELETE' then jsonb_build_object('chave', new.chave, 'valor', '••••') end);
  return coalesce(new, old);
end $$;
drop trigger if exists obra_segredos_auditoria on obra_segredos;
create trigger obra_segredos_auditoria after insert or update or delete on obra_segredos for each row execute function obra_segredos_auditoria();

-- leitura das senhas registrada no Histórico
create or replace function ler_senhas_obra(p_obra uuid)
returns table (chave text, valor text)
language plpgsql security definer set search_path = public as $$
begin
  if not usuario_ve_senhas() then raise exception 'Só técnico e diretoria veem as senhas da obra.'; end if;
  insert into auditoria (tabela, registro_id, acao, depois)
  values ('obra_segredos', p_obra::text, 'VIU', jsonb_build_object('obra', (select titulo from obras where id = p_obra)));
  return query select s.chave, s.valor from obra_segredos s where s.obra_id = p_obra;
end $$;
revoke all on function ler_senhas_obra(uuid) from public, anon;
grant execute on function ler_senhas_obra(uuid) to authenticated;

-- número da obra
create or replace function numerar_obra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero is null then
    perform pg_advisory_xact_lock(hashtext('obra_numero'));
    select coalesce(max(numero), 0) + 1 into new.numero from obras;
  end if;
  return new;
end $$;
drop trigger if exists obras_numero on obras;
create trigger obras_numero before insert on obras for each row execute function numerar_obra();

-- ---------------------------------------------------------------- modelos padrão
-- documentação no padrão BRA (capítulos na ordem do PDF)
create or replace function obra_modelos_docs()
returns table (modelo text, grupo text, titulo text)
language sql immutable as $$
  values
    ('capa',        'Apresentação',                 'Capa e apresentação BRA'),
    ('objetivo',    'Apresentação',                 'Objetivo do documento'),
    ('plantas',     'Sistema de Automação',         'Projeto executivo · Automação'),
    ('equipamentos','Sistema de Automação',         'Equipamentos instalados · Automação'),
    ('circuitos',   'Sistema de Automação',         'Mapeamento de circuitos'),
    ('pulsadores',  'Sistema de Automação',         'Tabela de pulsadores'),
    ('cenas',       'Sistema de Automação',         'Mapa de cenas'),
    ('plantas',     'Sistema de Rede Estruturada',  'Projeto executivo · Rede e CFTV'),
    ('equipamentos','Sistema de Rede Estruturada',  'Equipamentos instalados · Rede'),
    ('redes',       'Sistema de Rede Estruturada',  'Mapeamento de rede (switches e IR/RF)'),
    ('equipamentos','Sistema de Monitoramento',     'Equipamentos instalados · CFTV'),
    ('galeria',     'Sistema de Monitoramento',     'Configurações do NVR'),
    ('cameras',     'Sistema de Monitoramento',     'Imagens das câmeras'),
    ('plantas',     'Sistema de Áudio e Vídeo',     'Projeto executivo · Áudio e vídeo'),
    ('equipamentos','Sistema de Áudio e Vídeo',     'Equipamentos instalados · Áudio e vídeo'),
    ('senhas',      'Usuários e senhas',            'Usuários e senhas'),
    ('fotos',       'Fotos das instalações',        'Fotos das instalações'),
    ('relacao',     'Relação dos equipamentos',     'Relação dos equipamentos (IP, MAC, serial)'),
    ('encerramento','Encerramento',                 'Agradecimento e QR code dos arquivos')
$$;

create or replace function obra_modelos_etapas()
returns table (nome text)
language sql immutable as $$
  values ('Infraestrutura e tubulação'), ('Passagem de cabos'), ('Montagem de quadros e rack'), ('Instalação de equipamentos'),
         ('Programação e configuração'), ('Testes e ajustes'), ('Treinamento do cliente'), ('Documentação e entrega')
$$;

-- ---------------------------------------------------------------- criar a obra
-- Cria a obra de um contrato (com quadro de tarefas, cronograma, documentação
-- e itens vendidos). Se a obra já existe, devolve a existente.
create or replace function criar_obra(p_contrato uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c contratos%rowtype; o uuid; q uuid; prop uuid; cli record; v_nome text; i int; l text;
  et text[][] := array[array['Automação','azul'], array['Áudio e vídeo','roxo'], array['Rede / Wi-Fi','ciano'], array['Segurança / CFTV','laranja'], array['Elétrica','amarelo'], array['Urgente','vermelho']];
begin
  if not usuario_ativo() and auth.uid() is not null then raise exception 'Sem permissão.'; end if;
  select ob.id into o from obras ob where ob.contrato_id = p_contrato;
  if o is not null then return o; end if;
  select * into c from contratos where id = p_contrato;
  if not found then raise exception 'Contrato não encontrado.'; end if;
  select k.id, k.nome, k.telefone,
         nullif(concat_ws(', ', nullif(k.logradouro,''), nullif(k.numero,''), nullif(k.bairro,''), nullif(k.cidade,'') || coalesce(' - ' || nullif(k.uf,''), '')), '') as endereco
    into cli from clientes k where k.id = c.cliente_id;
  v_nome := coalesce(nullif(trim(c.titulo), ''), coalesce(cli.nome, c.cliente_nome, 'Cliente'));
  -- orçamento ganho: o do contrato; senão o aprovado mais recente do negócio
  prop := c.proposta_id;
  if prop is null and c.oportunidade_id is not null then
    select pp.id into prop from propostas pp where pp.oportunidade_id = c.oportunidade_id
      order by (pp.status = 'aprovada') desc, coalesce(pp.editado_em, pp.updated_at) desc limit 1;
  end if;
  -- quadro de tarefas da obra (mesmo modelo "Obra / instalação")
  insert into quadros (nome, fundo, posicao, modulo, criado_por)
    values ('Obra · ' || coalesce(cli.nome, c.cliente_nome, v_nome), 'marinho', extract(epoch from now()), 'projetos', coalesce(auth.uid(), c.created_by))
    returning id into q;
  i := 0;
  foreach l in array array['A fazer','Em andamento','Aguardando material','Revisão / testes','Concluído'] loop
    i := i + 1; insert into quadro_listas (quadro_id, nome, posicao) values (q, l, i * 1000);
  end loop;
  for i in 1 .. array_length(et, 1) loop
    insert into quadro_etiquetas (quadro_id, nome, cor, posicao) values (q, et[i][1], et[i][2], i);
  end loop;
  insert into obras (titulo, cliente_id, cliente_nome, endereco, telefone, contrato_id, oportunidade_id, proposta_id, quadro_id, inicio, valor_contrato, created_by)
    values (v_nome, c.cliente_id, coalesce(cli.nome, c.cliente_nome), coalesce(cli.endereco, c.cliente_endereco), coalesce(cli.telefone, c.cliente_telefone),
            c.id, c.oportunidade_id, prop, q, coalesce(c.assinado_em::date, current_date), c.valor, coalesce(auth.uid(), c.created_by))
    returning id into o;
  insert into obra_etapas (obra_id, nome, posicao) select o, e.nome, row_number() over () * 1000 from obra_modelos_etapas() e;
  insert into obra_docs (obra_id, modelo, grupo, titulo, posicao, status)
    select o, d.modelo, d.grupo, d.titulo, row_number() over () * 1000, case when d.modelo = 'capa' then 'aprovado' else 'pendente' end from obra_modelos_docs() d;
  if prop is not null then
    insert into obra_itens (obra_id, proposta_item_id, produto_id, ordem, sistema, descricao, sku, marca, unidade, quantidade, custo_unit)
      select o, pi.id, pi.produto_id, pi.ordem, pi.sistema, pi.descricao, pi.sku, pi.marca, pi.unidade, pi.quantidade, p.custo
        from proposta_itens pi left join produtos p on p.id = pi.produto_id
       where pi.proposta_id = prop and pi.tipo = 'produto';
  end if;
  -- avisa a diretoria
  perform notificar(d.id, 'obra', 'Nova obra: ' || v_nome, 'Criada a partir do contrato ' || coalesce(c.numero, ''), '/tecnico/obras/?id=' || o)
    from perfis d where d.papel = 'diretoria' and d.ativo;
  return o;
end $$;
revoke all on function criar_obra(uuid) from public, anon;
grant execute on function criar_obra(uuid) to authenticated;

-- a obra nasce quando o contrato assinado é anexado
create or replace function contrato_assinado_cria_obra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'assinado' and new.assinado_path is not null
     and (tg_op = 'INSERT' or old.assinado_path is distinct from new.assinado_path or old.status is distinct from new.status)
     and not exists (select 1 from obras where contrato_id = new.id) then
    perform criar_obra(new.id);
  end if;
  return new;
end $$;
drop trigger if exists contratos_cria_obra on contratos;
create trigger contratos_cria_obra after insert or update of status, assinado_path on contratos
  for each row execute function contrato_assinado_cria_obra();

-- contratos assinados que ainda não têm obra (para criar com um clique)
create or replace function contratos_sem_obra()
returns table (id uuid, numero text, cliente text, titulo text, assinado_em timestamptz, valor numeric)
language sql stable security definer set search_path = public as $$
  select c.id, c.numero, coalesce(cl.nome, c.cliente_nome), c.titulo, c.assinado_em, c.valor
    from contratos c left join clientes cl on cl.id = c.cliente_id
   where c.status = 'assinado' and usuario_ativo() and not exists (select 1 from obras o where o.contrato_id = c.id)
   order by c.assinado_em desc nulls last
$$;
grant execute on function contratos_sem_obra() to authenticated;

-- ---------------------------------------------------------------- saída de material
-- p: { obra_id, produto_id, quantidade, tipo: 'saida'|'devolucao', substitui_item?, justificativa? }
create or replace function registrar_saida_obra(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ob obras%rowtype; pr produtos%rowtype; q numeric := (p->>'quantidade')::numeric; tp text := coalesce(p->>'tipo', 'saida');
  vendido numeric; saiu numeric; sub uuid := nullif(p->>'substitui_item','')::uuid; cl text; mov uuid; sid uuid; quem text; txt text;
begin
  if not usuario_ativo() then raise exception 'Sem permissão.'; end if;
  if q is null or q <= 0 then raise exception 'Informe a quantidade.'; end if;
  select * into ob from obras where id = (p->>'obra_id')::uuid;
  if not found then raise exception 'Obra não encontrada.'; end if;
  select * into pr from produtos where id = (p->>'produto_id')::uuid;
  if not found then raise exception 'Produto não encontrado.'; end if;
  select coalesce(sum(quantidade), 0) into vendido from obra_itens where obra_id = ob.id and produto_id = pr.id;
  select coalesce(sum(case when tipo = 'saida' then quantidade else -quantidade end), 0) into saiu
    from obra_saidas where obra_id = ob.id and produto_id = pr.id;
  if tp = 'devolucao' then
    if q > saiu then raise exception 'Só saíram % unidade(s) deste item para a obra.', saiu; end if;
    cl := 'devolucao';
  elsif sub is not null then
    if not exists (select 1 from obra_itens where id = sub and obra_id = ob.id) then raise exception 'Item substituído não pertence a esta obra.'; end if;
    cl := 'substituto';
  elsif vendido > 0 and saiu + q <= vendido then cl := 'vendido';
  elsif vendido > 0 then cl := 'excedente';
  else cl := 'nao_vendido';
  end if;
  if cl in ('nao_vendido','excedente') and coalesce(trim(p->>'justificativa'), '') = '' then
    raise exception 'Este item % — explique o motivo (vai para a diretoria).', case cl when 'excedente' then 'passa da quantidade vendida' else 'não está no orçamento' end;
  end if;
  insert into estoque_movimentos (produto_id, tipo, quantidade, custo_unit, obra_id, referencia, observacao)
    values (pr.id, case when tp = 'devolucao' then 'entrada' else 'saida' end::tipo_mov_estoque, q, pr.custo, ob.id,
            case when tp = 'devolucao' then 'Devolução da obra ' else 'Saída para obra ' end || '#' || ob.numero || ' · ' || coalesce(ob.cliente_nome, ob.titulo),
            nullif(trim(p->>'justificativa'), ''))
    returning id into mov;
  insert into obra_saidas (obra_id, produto_id, tipo, quantidade, classificacao, substitui_item, justificativa, custo_unit, movimento_id,
                           revisado_em)
    values (ob.id, pr.id, tp, q, cl, sub, nullif(trim(p->>'justificativa'), ''), pr.custo, mov,
            case when cl in ('vendido','devolucao') then now() end)
    returning id into sid;
  -- aviso para os diretores a cada saída
  quem := nome_usuario(auth.uid());
  txt := rtrim(to_char(q, 'FM999999990.###'), '.') || '× ' || pr.nome;
  perform notificar(d.id, case when cl in ('vendido','devolucao') then 'estoque' else 'estoque_atencao' end,
                    case cl when 'vendido' then quem || ' deu saída de material'
                            when 'devolucao' then quem || ' devolveu material ao estoque'
                            when 'excedente' then '⚠ Saída acima do vendido'
                            when 'substituto' then '⚠ Item substituto na obra'
                            else '⚠ Saída de item fora do orçamento' end,
                    txt || ' · Obra #' || ob.numero || ' ' || coalesce(ob.cliente_nome, ob.titulo) || coalesce(' — ' || nullif(trim(p->>'justificativa'), ''), ''),
                    '/tecnico/obras/?id=' || ob.id || '&aba=materiais')
    from perfis d where d.papel = 'diretoria' and d.ativo;
  return jsonb_build_object('id', sid, 'classificacao', cl);
end $$;
revoke all on function registrar_saida_obra(jsonb) from public, anon;
grant execute on function registrar_saida_obra(jsonb) to authenticated;

-- ---------------------------------------------------------------- garantia nos chamados
-- chamado novo de cliente com obra entregue dentro da garantia já nasce "Em garantia"
-- (pelo cadastro do cliente ou pelo nome digitado no chamado)
create or replace function chamado_garantia_auto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.garantia, false) = false
     and (new.cliente_id is not null or coalesce(trim(new.cliente_nome), '') <> '')
     and exists (select 1 from quadros q where q.id = new.quadro_id and q.modulo = 'chamados')
     and exists (select 1 from obras o
                  where (o.cliente_id = new.cliente_id or lower(trim(o.cliente_nome)) = lower(trim(new.cliente_nome)))
                    and o.entregue_em is not null
                    and o.entregue_em + make_interval(months => o.garantia_meses) >= current_date) then
    new.garantia := true;
  end if;
  return new;
end $$;
drop trigger if exists cartoes_garantia_auto on cartoes;
create trigger cartoes_garantia_auto before insert on cartoes for each row execute function chamado_garantia_auto();
