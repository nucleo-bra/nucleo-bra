-- =====================================================================
-- 0008 · Contratos com assinatura eletrônica (DocuSign)
--   • contratos: dados do cliente "congelados" no contrato, condições de
--     pagamento, arquivo gerado (.docx), PDF assinado e rastreio do envelope
--   • contrato_modelos: modelos Word (.docx) com {campos}
--   • contrato_eventos: linha do tempo (gerado, enviado, visto, assinado…)
--   • config_empresa: dados do representante legal e de quem assina pela BRA
--     (ficam no banco, protegidos por login — nunca no código público)
-- Pode ser executada mais de uma vez.
-- =====================================================================

alter type status_contrato add value if not exists 'recusado';

-- ---------------------------------------------------------------- modelos
create table if not exists contrato_modelos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  arquivo_path text not null,            -- bucket "documentos", pasta contratos/modelos/
  padrao       boolean not null default false,
  created_by   uuid references perfis(id) default auth.uid(),
  created_at   timestamptz not null default now()
);
create unique index if not exists contrato_modelos_um_padrao on contrato_modelos (padrao) where padrao;

-- ---------------------------------------------------------------- contratos
alter table contratos alter column cliente_id drop not null;
alter table contratos
  add column if not exists titulo               text,
  add column if not exists unidade              text,
  add column if not exists cliente_nome         text,
  add column if not exists cliente_documento    text,
  add column if not exists cliente_email        text,
  add column if not exists cliente_telefone     text,
  add column if not exists cliente_endereco     text,
  add column if not exists oportunidade_id      uuid references oportunidades(id) on delete set null,
  add column if not exists entrada              numeric(14,2) not null default 0,
  add column if not exists entrada_vencimento   date,
  add column if not exists parcelas             smallint not null default 0,
  add column if not exists primeiro_vencimento  date,
  add column if not exists forma_pagamento      text,
  add column if not exists data_contrato        date not null default current_date,
  add column if not exists dados                jsonb not null default '{}'::jsonb,
  add column if not exists modelo_id            uuid references contrato_modelos(id) on delete set null,
  add column if not exists arquivo_path         text,
  add column if not exists arquivo_nome         text,
  add column if not exists assinado_path        text,
  add column if not exists docusign_envelope_id text,
  add column if not exists docusign_status      text,
  add column if not exists docusign_atualizado  timestamptz,
  add column if not exists recusa_motivo        text,
  add column if not exists financeiro_lancado_em timestamptz,
  add column if not exists created_by           uuid references perfis(id) default auth.uid();

do $$ begin
  alter table contratos add constraint contratos_cliente_informado check (cliente_id is not null or coalesce(cliente_nome, '') <> '');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table contratos add constraint contratos_parcelas_validas check (parcelas between 0 and 120 and entrada >= 0);
exception when duplicate_object then null; end $$;
create unique index if not exists contratos_envelope on contratos (docusign_envelope_id) where docusign_envelope_id is not null;
create index if not exists contratos_status on contratos (status, created_at desc);

-- ---------------------------------------------------------------- linha do tempo
create table if not exists contrato_eventos (
  id          bigint generated always as identity primary key,
  contrato_id uuid not null references contratos(id) on delete cascade,
  tipo        text not null,      -- criado, gerado, arquivo, enviado, entregue, assinado_cliente, concluido, recusado, cancelado, financeiro…
  descricao   text not null,
  dados       jsonb,
  usuario_id  uuid references perfis(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists contrato_eventos_contrato on contrato_eventos (contrato_id, created_at);

-- ---------------------------------------------------------------- configuração
create table if not exists config_empresa (
  chave      text primary key,
  valor      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references perfis(id) default auth.uid()
);

-- Número sugerido: AAAAMMDD do dia (como 20261025); se já existir, acrescenta -2, -3…
create or replace function sugerir_numero_contrato() returns text
language plpgsql stable security invoker set search_path = public as $$
declare base text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD'); n int := 1; r text;
begin
  r := base;
  while exists (select 1 from contratos where numero = r) loop
    n := n + 1; r := base || '-' || n;
  end loop;
  return r;
end $$;

-- ---------------------------------------------------------------- RLS
alter table contrato_modelos enable row level security;
alter table contrato_eventos enable row level security;
alter table config_empresa  enable row level security;

drop policy if exists contrato_modelos_ler on contrato_modelos;
drop policy if exists contrato_modelos_gravar on contrato_modelos;
drop policy if exists contrato_modelos_alterar on contrato_modelos;
drop policy if exists contrato_modelos_excluir on contrato_modelos;
create policy contrato_modelos_ler     on contrato_modelos for select to authenticated using (usuario_ativo());
create policy contrato_modelos_gravar  on contrato_modelos for insert to authenticated with check (usuario_ativo());
create policy contrato_modelos_alterar on contrato_modelos for update to authenticated using (usuario_ativo()) with check (usuario_ativo());
create policy contrato_modelos_excluir on contrato_modelos for delete to authenticated using (usuario_diretoria());

drop policy if exists contrato_eventos_ler on contrato_eventos;
drop policy if exists contrato_eventos_gravar on contrato_eventos;
create policy contrato_eventos_ler    on contrato_eventos for select to authenticated using (usuario_ativo());
create policy contrato_eventos_gravar on contrato_eventos for insert to authenticated with check (usuario_ativo());

drop policy if exists config_empresa_ler on config_empresa;
drop policy if exists config_empresa_gravar on config_empresa;
create policy config_empresa_ler    on config_empresa for select to authenticated using (usuario_ativo());
create policy config_empresa_gravar on config_empresa for all to authenticated using (usuario_diretoria()) with check (usuario_diretoria());

-- auditoria nas novas tabelas
drop trigger if exists contrato_modelos_auditoria on contrato_modelos;
create trigger contrato_modelos_auditoria after insert or update or delete on contrato_modelos for each row execute function registrar_auditoria();
drop trigger if exists config_empresa_auditoria on config_empresa;
create trigger config_empresa_auditoria after insert or update or delete on config_empresa for each row execute function registrar_auditoria();

-- tela atualiza sozinha quando o DocuSign avisa que assinaram
do $$ begin
  alter publication supabase_realtime add table contratos;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table contrato_eventos;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- valores iniciais (editáveis em Contratos › Configurações)
insert into config_empresa (chave, valor) values ('contratos', jsonb_build_object(
  'cidade', 'Paulínia',
  'representante', jsonb_build_object('nome', 'Fernando Bonolo Reis', 'cpf', '', 'rg', '', 'endereco', ''),
  'assinante_bra', jsonb_build_object('nome', 'Matheus Esturrari', 'email', '', 'cpf', ''),
  'representante_assina', false,
  'forma_recebimento', ''
)) on conflict (chave) do nothing;
