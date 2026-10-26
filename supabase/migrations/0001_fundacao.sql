-- =====================================================================
-- NÚCLEO BRA — Fundação do banco de dados
-- BRA Ambientes Inteligentes / Grupo BRTelecom
-- Todas as tabelas: RLS ligado, auditoria automática, valores em numeric
-- (nunca float, para não haver erro de centavos).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type papel_usuario   as enum ('diretoria','financeiro','comercial','tecnico');
create type tipo_pessoa     as enum ('PF','PJ');
create type tipo_parceiro   as enum ('arquiteto','designer','construtora','incorporadora','engenheiro','outro');
create type etapa_oport     as enum ('lead','qualificacao','proposta','negociacao','ganho','perdido');
create type tipo_atividade  as enum ('reuniao','visita','ligacao','whatsapp','email','tarefa','nota');
create type status_proposta as enum ('rascunho','enviada','aprovada','recusada','substituida');
create type status_contrato as enum ('rascunho','enviado','assinado','cancelado','encerrado');
create type tipo_nota       as enum ('nfse','nfe');
create type status_nota     as enum ('emitida','cancelada');
create type natureza_titulo as enum ('receber','pagar');
create type status_titulo   as enum ('aberto','pago','cancelado');
create type tipo_mov_estoque as enum ('entrada','saida','reserva','liberacao','ajuste');
create type tipo_documento  as enum ('proposta','contrato','nota_fiscal','boleto','projeto','foto','comprovante','outro');
create type tipo_midia      as enum ('video','foto','apresentacao','depoimento','render','outro');
create type status_importacao as enum ('conferencia','confirmada','descartada');

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function so_digitos(t text) returns text
language sql immutable as $$ select regexp_replace(coalesce(t,''), '\D', '', 'g') $$;

create or replace function set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------------
-- Usuários (espelha auth.users do Supabase)
-- ---------------------------------------------------------------------
create table perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text not null unique,
  papel       papel_usuario not null default 'comercial',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create or replace function usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo)
$$;

create or replace function usuario_diretoria() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'diretoria')
$$;

-- ---------------------------------------------------------------------
-- Clientes, contatos, projetos (obras), parceiros
-- ---------------------------------------------------------------------
create table clientes (
  id            uuid primary key default gen_random_uuid(),
  tipo          tipo_pessoa not null default 'PF',
  nome          text not null,                 -- razão social ou nome completo
  nome_fantasia text,
  documento     text,                          -- só dígitos (CPF/CNPJ)
  -- Raiz do CNPJ (8 primeiros dígitos): agrupa matriz e filiais (ex.: Plaenge)
  documento_raiz text generated always as (
    case when length(documento) = 14 then left(documento, 8) else documento end
  ) stored,
  inscricao_municipal text,
  email         text,
  telefone      text,
  cep text, logradouro text, numero text, complemento text, bairro text,
  cidade text, uf char(2), codigo_ibge text,
  parceiro_origem_id uuid,                     -- arquiteto/parceiro que indicou
  observacoes   text,
  ativo         boolean not null default true,
  created_by    uuid references perfis(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint documento_valido check (documento is null or length(documento) in (11,14)),
  constraint documento_unico unique (documento)
);
create index on clientes (documento_raiz);
create index on clientes using gin (to_tsvector('portuguese', nome || ' ' || coalesce(nome_fantasia,'')));

create table contatos (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nome       text not null,
  cargo      text,
  email      text,
  telefone   text,
  principal  boolean not null default false,
  created_at timestamptz not null default now()
);

create table parceiros (
  id          uuid primary key default gen_random_uuid(),
  tipo        tipo_parceiro not null default 'arquiteto',
  nome        text not null,
  escritorio  text,
  documento   text unique,
  email       text,
  telefone    text,
  instagram   text,
  cidade      text,
  comissao_padrao numeric(5,2) not null default 0 check (comissao_padrao between 0 and 100),
  observacoes text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table clientes add constraint clientes_parceiro_fk
  foreign key (parceiro_origem_id) references parceiros(id) on delete set null;

create table projetos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references clientes(id) on delete restrict,
  parceiro_id uuid references parceiros(id) on delete set null,
  nome        text not null,                   -- ex.: "Quinta da Baronesa", "The Mark"
  endereco    text,
  cidade      text,
  uf          char(2),
  status      text not null default 'em_negociacao'
              check (status in ('em_negociacao','em_execucao','entregue','pos_venda','cancelado')),
  onedrive_pasta_id text,                      -- pasta do cliente no OneDrive (fase OneDrive)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on projetos (cliente_id);

-- ---------------------------------------------------------------------
-- CRM: oportunidades e atividades
-- ---------------------------------------------------------------------
create table campanhas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  canal        text not null,                  -- instagram, meta_ads, evento, brinde, indicacao...
  objetivo     text,
  inicio       date,
  fim          date,
  investimento numeric(14,2) not null default 0 check (investimento >= 0),
  observacoes  text,
  created_at   timestamptz not null default now()
);

create table oportunidades (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  cliente_id     uuid references clientes(id) on delete set null,
  projeto_id     uuid references projetos(id) on delete set null,
  parceiro_id    uuid references parceiros(id) on delete set null,
  campanha_id    uuid references campanhas(id) on delete set null,  -- de onde veio o lead
  etapa          etapa_oport not null default 'lead',
  valor_estimado numeric(14,2) not null default 0 check (valor_estimado >= 0),
  probabilidade  smallint check (probabilidade between 0 and 100),
  responsavel_id uuid references perfis(id) default auth.uid(),
  proxima_acao   text,
  proxima_acao_em timestamptz,
  motivo_perda   text,
  fechada_em     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on oportunidades (etapa);

create table atividades (
  id              uuid primary key default gen_random_uuid(),
  tipo            tipo_atividade not null,
  titulo          text not null,
  notas           text,
  quando          timestamptz not null default now(),
  duracao_min     integer check (duracao_min > 0),
  concluida       boolean not null default false,
  cliente_id      uuid references clientes(id) on delete cascade,
  parceiro_id     uuid references parceiros(id) on delete cascade,
  oportunidade_id uuid references oportunidades(id) on delete cascade,
  responsavel_id  uuid references perfis(id) default auth.uid(),
  created_at      timestamptz not null default now()
);
create index on atividades (quando);

-- ---------------------------------------------------------------------
-- Catálogo e estoque
-- ---------------------------------------------------------------------
create table produtos (
  id             uuid primary key default gen_random_uuid(),
  sku            text unique,                  -- código do fabricante (ex.: C4-21309)
  nome           text not null,
  marca          text,
  sistema        text,                         -- Automação, Rede, Segurança, Sonorização...
  unidade        text not null default 'un',
  custo          numeric(14,2) check (custo >= 0),
  preco_venda    numeric(14,2) check (preco_venda >= 0),
  estoque_minimo numeric(12,3) not null default 0,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index produtos_nome_marca on produtos (lower(nome), coalesce(lower(marca),''));

create table estoque_movimentos (
  id          uuid primary key default gen_random_uuid(),
  produto_id  uuid not null references produtos(id) on delete restrict,
  tipo        tipo_mov_estoque not null,
  quantidade  numeric(12,3) not null check (quantidade > 0),
  custo_unit  numeric(14,2),
  projeto_id  uuid references projetos(id) on delete set null,
  referencia  text,                            -- NF de compra, pedido, proposta...
  observacao  text,
  ocorrido_em timestamptz not null default now(),
  created_by  uuid references perfis(id) default auth.uid()
);
create index on estoque_movimentos (produto_id);

-- Saldo físico e saldo disponível (físico − reservado)
create view estoque_saldos with (security_invoker = true) as
select p.id as produto_id, p.sku, p.nome, p.marca, p.sistema, p.estoque_minimo,
  coalesce(sum(case m.tipo when 'entrada' then m.quantidade when 'saida' then -m.quantidade
                           when 'ajuste' then m.quantidade else 0 end),0) as saldo_fisico,
  coalesce(sum(case m.tipo when 'reserva' then m.quantidade when 'liberacao' then -m.quantidade
                           when 'saida' then 0 else 0 end),0) as reservado
from produtos p left join estoque_movimentos m on m.produto_id = p.id
group by p.id;

-- ---------------------------------------------------------------------
-- Documentos (arquivos no Storage ou no OneDrive)
-- ---------------------------------------------------------------------
create table documentos (
  id               uuid primary key default gen_random_uuid(),
  tipo             tipo_documento not null default 'outro',
  nome             text not null,
  mime             text,
  tamanho_bytes    bigint,
  sha256           text unique,                -- impede o mesmo arquivo duas vezes
  storage_path     text,                       -- bucket "documentos"
  onedrive_item_id text,
  cliente_id       uuid references clientes(id) on delete set null,
  projeto_id       uuid references projetos(id) on delete set null,
  created_by       uuid references perfis(id) default auth.uid(),
  created_at       timestamptz not null default now(),
  constraint documento_tem_origem check (storage_path is not null or onedrive_item_id is not null)
);
create index on documentos (cliente_id);

-- ---------------------------------------------------------------------
-- Propostas / orçamentos (importados do Zenith ou criados aqui)
-- ---------------------------------------------------------------------
create table propostas (
  id              uuid primary key default gen_random_uuid(),
  origem          text not null default 'zenith' check (origem in ('zenith','nucleo')),
  numero          text not null,               -- nº da proposta no Zenith (ex.: 39)
  versao          text,                        -- ex.: V5
  codigo_comercial text,                       -- ex.: BRT 202600521 (aparece no boleto)
  cliente_id      uuid references clientes(id) on delete restrict,
  projeto_id      uuid references projetos(id) on delete set null,
  oportunidade_id uuid references oportunidades(id) on delete set null,
  parceiro_id     uuid references parceiros(id) on delete set null,
  titulo          text,                        -- "Eduardo Attie | Quinta da Baronesa - V5"
  data_emissao    date not null,
  validade        date,
  total_produtos  numeric(14,2) not null default 0,
  total_servicos  numeric(14,2) not null default 0,
  total_itens     numeric(14,2) not null default 0, -- soma das linhas
  total_final     numeric(14,2) not null,          -- valor fechado (pode ter desconto)
  desconto        numeric(14,2) generated always as (total_itens - total_final) stored,
  condicoes_pagamento text,
  status          status_proposta not null default 'enviada',
  documento_id    uuid references documentos(id) on delete set null,
  created_by      uuid references perfis(id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint proposta_unica unique (origem, numero, versao)
);

create table proposta_itens (
  id             uuid primary key default gen_random_uuid(),
  proposta_id    uuid not null references propostas(id) on delete cascade,
  ordem          integer not null,
  sistema        text not null,                -- Automação, Rede Estruturada...
  tipo           text not null default 'produto' check (tipo in ('produto','servico')),
  descricao      text not null,
  detalhe        text,
  sku            text,
  marca          text,
  produto_id     uuid references produtos(id) on delete set null,
  quantidade     numeric(12,3) not null check (quantidade > 0),
  unidade        text not null default 'un',
  valor_unitario numeric(14,2) not null check (valor_unitario >= 0),
  valor_total    numeric(14,2) not null check (valor_total >= 0),
  -- trava de integridade: quantidade × unitário tem de bater com o total (tolerância de 1 centavo)
  constraint item_confere check (abs(round(quantidade * valor_unitario, 2) - valor_total) <= 0.01)
);
create index on proposta_itens (proposta_id);

-- ---------------------------------------------------------------------
-- Contratos
-- ---------------------------------------------------------------------
create table contratos (
  id           uuid primary key default gen_random_uuid(),
  numero       text unique,
  cliente_id   uuid not null references clientes(id) on delete restrict,
  projeto_id   uuid references projetos(id) on delete set null,
  proposta_id  uuid references propostas(id) on delete set null,
  valor        numeric(14,2) not null check (valor >= 0),
  status       status_contrato not null default 'rascunho',
  enviado_em   timestamptz,
  assinado_em  timestamptz,
  inicio       date,
  fim          date,
  documento_id uuid references documentos(id) on delete set null,
  observacoes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Notas fiscais (XML da Omie) e títulos (contas a receber / pagar)
-- ---------------------------------------------------------------------
create table notas_fiscais (
  id                 uuid primary key default gen_random_uuid(),
  tipo               tipo_nota not null,
  numero             text not null,
  serie              text,
  codigo_verificacao text,
  chave_acesso       text unique,              -- NF-e (44 dígitos)
  rps_numero         text,
  prestador_cnpj     text not null,
  emitida_em         timestamptz not null,
  competencia        date,
  cliente_id         uuid not null references clientes(id) on delete restrict,
  projeto_id         uuid references projetos(id) on delete set null,
  proposta_id        uuid references propostas(id) on delete set null,
  valor_servicos     numeric(14,2) not null,
  valor_deducoes     numeric(14,2) not null default 0,
  base_calculo       numeric(14,2),
  aliquota_iss       numeric(5,2),
  valor_iss          numeric(14,2),
  iss_retido         boolean not null default false,
  valor_liquido      numeric(14,2) not null,
  codigo_servico     text,
  descricao_servico  text,
  discriminacao      text,
  ordem_compra       text,
  vencimento_informado date,
  status             status_nota not null default 'emitida',
  xml_documento_id   uuid references documentos(id) on delete set null,
  pdf_documento_id   uuid references documentos(id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint nota_unica unique (prestador_cnpj, tipo, numero)
);
create index on notas_fiscais (cliente_id);
create index on notas_fiscais (emitida_em);

create table categorias_financeiras (
  id       uuid primary key default gen_random_uuid(),
  nome     text not null unique,
  natureza natureza_titulo not null
);

create table titulos (
  id              uuid primary key default gen_random_uuid(),
  natureza        natureza_titulo not null,
  descricao       text not null,
  cliente_id      uuid references clientes(id) on delete restrict,
  fornecedor      text,
  nota_fiscal_id  uuid references notas_fiscais(id) on delete set null,
  proposta_id     uuid references propostas(id) on delete set null,
  projeto_id      uuid references projetos(id) on delete set null,
  categoria_id    uuid references categorias_financeiras(id) on delete set null,
  valor           numeric(14,2) not null check (valor > 0),
  emissao         date not null default current_date,
  vencimento      date not null,
  forma           text check (forma in ('boleto','pix','transferencia','cartao','dinheiro','outro')),
  -- dados do boleto
  banco_codigo    text,
  linha_digitavel text unique,
  nosso_numero    text,
  boleto_documento_id uuid references documentos(id) on delete set null,
  -- liquidação
  status          status_titulo not null default 'aberto',
  pago_em         date,
  valor_pago      numeric(14,2),
  cobrado_em      timestamptz,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint pagamento_coerente check (
    (status = 'pago' and pago_em is not null and valor_pago is not null)
    or (status <> 'pago'))
);
create index on titulos (vencimento) where status = 'aberto';

create table comissoes (
  id           uuid primary key default gen_random_uuid(),
  titulo_id    uuid references titulos(id) on delete cascade,
  proposta_id  uuid references propostas(id) on delete set null,
  parceiro_id  uuid references parceiros(id) on delete restrict,
  vendedor_id  uuid references perfis(id) on delete restrict,
  base         numeric(14,2) not null check (base >= 0),
  percentual   numeric(5,2) not null check (percentual between 0 and 100),
  valor        numeric(14,2) generated always as (round(base * percentual / 100, 2)) stored,
  status       text not null default 'prevista' check (status in ('prevista','liberada','paga','cancelada')),
  pago_em      date,
  created_at   timestamptz not null default now(),
  constraint beneficiario check ((parceiro_id is null) <> (vendedor_id is null))
);

-- ---------------------------------------------------------------------
-- Marketing: acervo de mídias e métricas de campanhas
-- ---------------------------------------------------------------------
create table midias (
  id            uuid primary key default gen_random_uuid(),
  tipo          tipo_midia not null,
  titulo        text not null,
  descricao     text,
  storage_path  text,
  url_externa   text,                          -- Instagram, YouTube, OneDrive
  thumbnail_path text,
  duracao_seg   integer,
  tags          text[] not null default '{}',
  sistemas      text[] not null default '{}',  -- Automação, Home Theater...
  marcas        text[] not null default '{}',  -- Control4, DALI, Episode...
  projeto_id    uuid references projetos(id) on delete set null,
  campanha_id   uuid references campanhas(id) on delete set null,
  destaque_showroom boolean not null default false,  -- entra no modo apresentação
  created_at    timestamptz not null default now(),
  constraint midia_tem_origem check (storage_path is not null or url_externa is not null)
);
create index on midias using gin (tags);

create table campanha_metricas (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references campanhas(id) on delete cascade,
  data        date not null,
  alcance     integer, impressoes integer, cliques integer,
  leads       integer, gasto numeric(14,2),
  unique (campanha_id, data)
);

-- ---------------------------------------------------------------------
-- Central de importação: tudo passa por conferência antes de gravar
-- ---------------------------------------------------------------------
create table importacoes (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('nfse_xml','boleto_pdf','proposta_zenith','planilha_estoque')),
  arquivo_nome   text not null,
  arquivo_sha256 text not null,
  dados          jsonb not null,               -- o que o leitor extraiu
  alertas        jsonb not null default '[]',  -- divergências encontradas
  status         status_importacao not null default 'conferencia',
  registro_id    uuid,                         -- registro criado ao confirmar
  created_by     uuid references perfis(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  confirmada_em  timestamptz
);

-- ---------------------------------------------------------------------
-- Auditoria: quem mudou o quê, quando (antes/depois)
-- ---------------------------------------------------------------------
create table auditoria (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id text,
  acao        text not null,
  antes       jsonb,
  depois      jsonb,
  usuario_id  uuid default auth.uid(),
  ocorrido_em timestamptz not null default now()
);

create or replace function registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria (tabela, registro_id, acao, antes, depois)
  values (tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',''),
          tg_op,
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- Triggers, RLS e políticas em todas as tabelas de negócio
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clientes','contatos','parceiros','projetos','campanhas','oportunidades',
    'atividades','produtos','estoque_movimentos','documentos','propostas','proposta_itens','contratos',
    'notas_fiscais','categorias_financeiras','titulos','comissoes','midias','campanha_metricas','importacoes']
  loop
    execute format('create trigger %I_auditoria after insert or update or delete on %I
                    for each row execute function registrar_auditoria()', t, t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_ler on %I for select to authenticated using (usuario_ativo())', t, t);
    execute format('create policy %I_inserir on %I for insert to authenticated with check (usuario_ativo())', t, t);
    execute format('create policy %I_alterar on %I for update to authenticated using (usuario_ativo()) with check (usuario_ativo())', t, t);
    -- excluir: só diretoria
    execute format('create policy %I_excluir on %I for delete to authenticated using (usuario_diretoria())', t, t);
  end loop;
  foreach t in array array['clientes','parceiros','projetos','oportunidades','produtos','propostas','contratos','titulos']
  loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

alter table perfis enable row level security;
create policy perfis_ler on perfis for select to authenticated using (usuario_ativo());
create policy perfis_admin on perfis for all to authenticated using (usuario_diretoria()) with check (usuario_diretoria());

alter table auditoria enable row level security;
create policy auditoria_ler on auditoria for select to authenticated using (usuario_ativo());
-- ninguém altera ou apaga a auditoria (sem políticas de update/delete)

-- ---------------------------------------------------------------------
-- Confirmação atômica de importações (tudo ou nada)
-- ---------------------------------------------------------------------

-- Encontra ou cria o cliente pelo CPF/CNPJ
create or replace function upsert_cliente(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_doc text := nullif(so_digitos(p->>'documento'),'');
begin
  if v_doc is not null then
    select id into v_id from clientes where documento = v_doc;
  end if;
  if v_id is null and v_doc is null then
    select id into v_id from clientes where lower(unaccent(nome)) = lower(unaccent(p->>'nome')) limit 1;
  end if;
  if v_id is null then
    insert into clientes (tipo, nome, documento, inscricao_municipal, email, telefone,
                          cep, logradouro, numero, bairro, cidade, uf, codigo_ibge)
    values (case when length(v_doc) = 14 then 'PJ'::tipo_pessoa else 'PF'::tipo_pessoa end,
            p->>'nome', v_doc, p->>'inscricao_municipal', p->>'email', p->>'telefone',
            p->>'cep', p->>'logradouro', p->>'numero', p->>'bairro', p->>'cidade', p->>'uf', p->>'codigo_ibge')
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- Confirma uma nota (NFS-e ou NF-e) conferida: cliente, nota e título(s) a receber
create or replace function confirmar_nota(p_importacao uuid, p_dados jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_cliente uuid; v_nf uuid; v_tipo tipo_nota := coalesce(p_dados->>'tipo','nfse')::tipo_nota;
        parc jsonb; n int := 0; total_parc int; v_soma numeric := 0;
begin
  if not usuario_ativo() then raise exception 'Usuário sem permissão'; end if;
  if exists (select 1 from importacoes where id = p_importacao and status <> 'conferencia') then
    raise exception 'Esta importação já foi processada';
  end if;
  if exists (select 1 from notas_fiscais where prestador_cnpj = so_digitos(p_dados->>'prestador_cnpj')
             and tipo = v_tipo and numero = p_dados->>'numero') then
    raise exception 'A NF % já está cadastrada no Núcleo', p_dados->>'numero';
  end if;

  v_cliente := coalesce(nullif(p_dados->>'cliente_id','')::uuid, upsert_cliente(p_dados->'tomador'));

  insert into notas_fiscais (tipo, numero, serie, codigo_verificacao, chave_acesso, rps_numero, prestador_cnpj,
    emitida_em, competencia, cliente_id, projeto_id, proposta_id, valor_servicos, valor_deducoes, base_calculo,
    aliquota_iss, valor_iss, iss_retido, valor_liquido, codigo_servico, descricao_servico,
    discriminacao, ordem_compra, vencimento_informado)
  values (v_tipo, p_dados->>'numero', p_dados->>'serie', p_dados->>'codigo_verificacao',
    nullif(p_dados->>'chave_acesso',''), p_dados->>'rps_numero', so_digitos(p_dados->>'prestador_cnpj'),
    (p_dados->>'emitida_em')::timestamptz, nullif(p_dados->>'competencia','')::date, v_cliente,
    nullif(p_dados->>'projeto_id','')::uuid, nullif(p_dados->>'proposta_id','')::uuid,
    (p_dados->>'valor_servicos')::numeric, coalesce((p_dados->>'valor_deducoes')::numeric,0),
    (p_dados->>'base_calculo')::numeric, (p_dados->>'aliquota_iss')::numeric,
    (p_dados->>'valor_iss')::numeric, coalesce((p_dados->>'iss_retido')::boolean,false),
    (p_dados->>'valor_liquido')::numeric, p_dados->>'codigo_servico', p_dados->>'descricao_servico',
    p_dados->>'discriminacao', p_dados->>'ordem_compra',
    (p_dados->'parcelas'->0->>'vencimento')::date)
  returning id into v_nf;

  -- um título a receber por parcela; a soma tem de fechar com o valor líquido
  total_parc := coalesce(jsonb_array_length(p_dados->'parcelas'), 0);
  for parc in select * from jsonb_array_elements(coalesce(p_dados->'parcelas','[]')) loop
    n := n + 1;
    v_soma := v_soma + (parc->>'valor')::numeric;
    insert into titulos (natureza, descricao, cliente_id, nota_fiscal_id, projeto_id, proposta_id, valor, emissao, vencimento, forma)
    values ('receber',
            'NF ' || (p_dados->>'numero') || case when total_parc > 1 then ' — parcela ' || n || '/' || total_parc else '' end
                  || coalesce(' — OC ' || (p_dados->>'ordem_compra'), ''),
            v_cliente, v_nf, nullif(p_dados->>'projeto_id','')::uuid, nullif(p_dados->>'proposta_id','')::uuid,
            (parc->>'valor')::numeric, (p_dados->>'emitida_em')::date, (parc->>'vencimento')::date, 'boleto');
  end loop;
  if total_parc > 0 and v_soma <> (p_dados->>'valor_liquido')::numeric then
    raise exception 'As parcelas somam % mas o valor líquido da nota é %', v_soma, p_dados->>'valor_liquido';
  end if;

  update importacoes set status = 'confirmada', confirmada_em = now(), registro_id = v_nf, dados = p_dados
   where id = p_importacao;
  return v_nf;
end $$;

-- Vincula um boleto conferido ao título da NF correspondente
create or replace function confirmar_boleto(p_importacao uuid, p_dados jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_titulo uuid; v_valor numeric; v_venc date;
begin
  if not usuario_ativo() then raise exception 'Usuário sem permissão'; end if;
  select t.id, t.valor, t.vencimento into v_titulo, v_valor, v_venc
    from titulos t join notas_fiscais n on n.id = t.nota_fiscal_id
   where n.numero = p_dados->>'numero_documento' and t.natureza = 'receber' and t.status = 'aberto'
   limit 1;
  if v_titulo is null then
    raise exception 'Importe primeiro o XML da NF % — o boleto precisa de uma nota para se vincular', p_dados->>'numero_documento';
  end if;
  if v_valor <> (p_dados->>'valor')::numeric then
    raise exception 'Valor do boleto (%) diferente do título da NF (%)', p_dados->>'valor', v_valor;
  end if;
  if v_venc <> (p_dados->>'vencimento')::date then
    raise exception 'Vencimento do boleto (%) diferente do da NF (%)', p_dados->>'vencimento', v_venc;
  end if;
  update titulos set linha_digitavel = p_dados->>'linha_digitavel', nosso_numero = p_dados->>'nosso_numero',
         banco_codigo = p_dados->>'banco_codigo', forma = 'boleto'
   where id = v_titulo;
  update importacoes set status = 'confirmada', confirmada_em = now(), registro_id = v_titulo, dados = p_dados
   where id = p_importacao;
  return v_titulo;
end $$;

-- Confirma uma proposta do Zenith conferida: cliente, projeto, proposta e itens
create or replace function confirmar_proposta(p_importacao uuid, p_dados jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_cliente uuid; v_projeto uuid; v_prop uuid; v_soma numeric; i jsonb; n int := 0;
begin
  if not usuario_ativo() then raise exception 'Usuário sem permissão'; end if;
  if exists (select 1 from importacoes where id = p_importacao and status <> 'conferencia') then
    raise exception 'Esta importação já foi processada';
  end if;

  v_cliente := coalesce(nullif(p_dados->>'cliente_id','')::uuid,
                        upsert_cliente(jsonb_build_object('nome', p_dados->>'cliente_nome')));
  if nullif(p_dados->>'projeto_nome','') is not null then
    select id into v_projeto from projetos where cliente_id = v_cliente
       and lower(unaccent(nome)) = lower(unaccent(p_dados->>'projeto_nome'));
    if v_projeto is null then
      insert into projetos (cliente_id, nome) values (v_cliente, p_dados->>'projeto_nome') returning id into v_projeto;
    end if;
  end if;

  -- versão anterior da mesma proposta passa a "substituída"
  update propostas set status = 'substituida'
   where origem = 'zenith' and numero = p_dados->>'numero' and status in ('rascunho','enviada');

  insert into propostas (origem, numero, versao, codigo_comercial, cliente_id, projeto_id, titulo,
    data_emissao, total_produtos, total_servicos, total_itens, total_final, condicoes_pagamento)
  values ('zenith', p_dados->>'numero', p_dados->>'versao', p_dados->>'codigo_comercial', v_cliente, v_projeto,
    p_dados->>'titulo', (p_dados->>'data_emissao')::date,
    coalesce((p_dados->>'total_produtos')::numeric,0), coalesce((p_dados->>'total_servicos')::numeric,0),
    (p_dados->>'total_itens')::numeric, (p_dados->>'total_final')::numeric, p_dados->>'condicoes_pagamento')
  returning id into v_prop;

  for i in select * from jsonb_array_elements(p_dados->'itens') loop
    n := n + 1;
    insert into proposta_itens (proposta_id, ordem, sistema, tipo, descricao, detalhe, sku, quantidade,
                                unidade, valor_unitario, valor_total)
    values (v_prop, n, i->>'sistema', coalesce(i->>'tipo','produto'), i->>'descricao', i->>'detalhe',
            i->>'sku', (i->>'quantidade')::numeric, coalesce(i->>'unidade','un'),
            (i->>'valor_unitario')::numeric, (i->>'valor_total')::numeric);
  end loop;

  select coalesce(sum(valor_total),0) into v_soma from proposta_itens where proposta_id = v_prop;
  if v_soma <> (p_dados->>'total_itens')::numeric then
    raise exception 'Soma dos itens (%) não confere com o total da proposta (%)', v_soma, p_dados->>'total_itens';
  end if;

  update importacoes set status = 'confirmada', confirmada_em = now(), registro_id = v_prop, dados = p_dados
   where id = p_importacao;
  return v_prop;
end $$;

-- ---------------------------------------------------------------------
-- Visões do painel
-- ---------------------------------------------------------------------
create view painel_financeiro with (security_invoker = true) as
select
  coalesce(sum(valor) filter (where natureza='receber' and status='aberto'),0)                                 as a_receber,
  coalesce(sum(valor) filter (where natureza='receber' and status='aberto' and vencimento < current_date),0)   as vencido,
  coalesce(sum(valor) filter (where natureza='receber' and status='aberto' and vencimento between current_date and current_date + 30),0) as receber_30d,
  coalesce(sum(valor) filter (where natureza='pagar'   and status='aberto'),0)                                 as a_pagar,
  coalesce(sum(valor_pago) filter (where natureza='receber' and status='pago' and date_trunc('month',pago_em)=date_trunc('month',current_date)),0) as recebido_mes
from titulos;

create view faturamento_mensal with (security_invoker = true) as
select date_trunc('month', emitida_em)::date as mes, count(*) as notas, sum(valor_servicos) as faturado
from notas_fiscais where status = 'emitida'
group by 1 order by 1;

create view funil_comercial with (security_invoker = true) as
select etapa, count(*) as quantidade, coalesce(sum(valor_estimado),0) as valor
from oportunidades group by etapa;

create view vendas_por_sistema with (security_invoker = true) as
select i.sistema, count(distinct p.id) as propostas, sum(i.valor_total) as valor
from proposta_itens i join propostas p on p.id = i.proposta_id
where p.status <> 'substituida'
group by i.sistema;

-- ---------------------------------------------------------------------
-- Dados iniciais
-- ---------------------------------------------------------------------
insert into categorias_financeiras (nome, natureza) values
  ('Venda de equipamentos','receber'), ('Serviços de instalação','receber'),
  ('Manutenção / suporte','receber'), ('Fornecedores','pagar'), ('Folha e encargos','pagar'),
  ('Impostos','pagar'), ('Marketing','pagar'), ('Estrutura / showroom','pagar'),
  ('Comissões','pagar');
