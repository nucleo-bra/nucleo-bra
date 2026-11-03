-- =====================================================================
-- 0016 · Técnicos sem acesso ao Núcleo
-- Só o nome (e telefone) para alocar em visitas, chamados e projetos.
-- Quando o técnico ganhar login, basta desativar o nome aqui.
-- Pode ser executada mais de uma vez.
-- =====================================================================
create table if not exists tecnicos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  telefone   text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists tecnicos_nome on tecnicos (lower(nome));

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'tecnicos' and policyname = 'tecnicos_ler') then
    alter table tecnicos enable row level security;
    create policy tecnicos_ler on tecnicos for select to authenticated using (usuario_ativo());
    create policy tecnicos_inserir on tecnicos for insert to authenticated with check (usuario_diretoria());
    create policy tecnicos_alterar on tecnicos for update to authenticated using (usuario_diretoria()) with check (usuario_diretoria());
  end if;
end $$;

-- a equipe que aparece para alocar cartões passa a incluir os técnicos sem login
create or replace view equipe with (security_invoker = true) as
select id, nome, email, papel from perfis where ativo
union all
select id, nome, coalesce(telefone, '') as email, 'tecnico'::papel_usuario as papel from tecnicos where ativo
order by nome;
