-- =====================================================================
-- 0020 · Fornecedores (vindos do Zenith) e numeração dos orçamentos
--   • cadastro de fornecedores: CNPJ não se repete
--   • todos da equipe consultam; técnico só consulta
--   • orçamentos novos do Núcleo continuam depois do maior número já usado
--     (o Zenith chegou ao 66)
-- Pode ser executada mais de uma vez.
-- =====================================================================
create table if not exists fornecedores (
  id             uuid primary key default gen_random_uuid(),
  nome_fantasia  text not null,
  razao_social   text,
  cnpj           text,
  vendedor       text,
  telefone       text,
  whatsapp       text,
  email          text,
  pedido_minimo  numeric(14,2),
  cep            text,
  logradouro     text,
  numero         text,
  complemento    text,
  bairro         text,
  cidade         text,
  uf             text,
  observacoes    text,
  zenith_id      text,
  ativo          boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists fornecedores_cnpj on fornecedores (regexp_replace(cnpj, '\D', '', 'g')) where cnpj is not null and cnpj <> '';
create unique index if not exists fornecedores_zenith on fornecedores (zenith_id) where zenith_id is not null;
create index if not exists fornecedores_nome on fornecedores (lower(nome_fantasia));

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'fornecedores' and policyname = 'fornecedores_ler') then
    alter table fornecedores enable row level security;
    create policy fornecedores_ler on fornecedores for select to authenticated using (usuario_ativo());
    create policy fornecedores_inserir on fornecedores for insert to authenticated
      with check (exists (select 1 from perfis where id = auth.uid() and ativo and papel <> 'tecnico'));
    create policy fornecedores_alterar on fornecedores for update to authenticated
      using (exists (select 1 from perfis where id = auth.uid() and ativo and papel <> 'tecnico'))
      with check (exists (select 1 from perfis where id = auth.uid() and ativo and papel <> 'tecnico'));
  end if;
end $$;

drop trigger if exists fornecedores_auditoria on fornecedores;
create trigger fornecedores_auditoria after insert or update or delete on fornecedores
  for each row execute function registrar_auditoria();

-- numeração: próximo orçamento do Núcleo vem depois do maior número existente
select setval('propostas_numero_nucleo',
  greatest(coalesce((select max(numero::int) from propostas where numero ~ '^\d+$'), 0),
           (select last_value from propostas_numero_nucleo)), true);
