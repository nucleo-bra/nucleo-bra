-- =====================================================================
-- 0018 · Verificação em duas etapas e histórico completo
--   • quem ativou a verificação em duas etapas só lê/grava dados depois de
--     digitar o código (sessão "aal2"); vale para todas as tabelas, porque
--     as regras usam usuario_ativo() / usuario_diretoria()
--   • diretoria vê quem já ativou e pode zerar a verificação de alguém que
--     perdeu o celular
--   • histórico: passa a registrar acessos (perfis), técnicos, catálogos,
--     base de conhecimento, logins e saídas; só a diretoria consulta
-- Pode ser executada mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------- duas etapas
create or replace function mfa_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;

create or replace function usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo) and mfa_ok()
$$;

create or replace function usuario_diretoria() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'diretoria') and mfa_ok()
$$;

-- quem da equipe já ativou (só diretoria consulta)
create or replace function equipe_mfa() returns table (usuario_id uuid, ativado_em timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select f.user_id, min(f.created_at) from auth.mfa_factors f
   where f.status = 'verified' and usuario_diretoria()
   group by f.user_id
$$;
revoke all on function equipe_mfa() from public, anon;
grant execute on function equipe_mfa() to authenticated;

-- diretoria zera a verificação de quem perdeu o celular (a pessoa ativa de novo no próximo login)
create or replace function zerar_mfa(p_usuario uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not usuario_diretoria() then raise exception 'Só a diretoria pode zerar a verificação em duas etapas.'; end if;
  if p_usuario = auth.uid() then raise exception 'Para trocar a sua própria verificação use Minha conta.'; end if;
  delete from auth.mfa_factors where user_id = p_usuario;
  insert into auditoria (tabela, registro_id, acao, depois)
  values ('perfis', p_usuario::text, 'MFA_ZERADO', jsonb_build_object('nome', (select nome from perfis where id = p_usuario)));
end $$;
revoke all on function zerar_mfa(uuid) from public, anon;
grant execute on function zerar_mfa(uuid) to authenticated;

-- ---------------------------------------------------------------- histórico
-- tabelas que ainda não registravam alterações
do $$
declare t text;
begin
  foreach t in array array['perfis','tecnicos','catalogos','base_conhecimento','comissionados','contrato_modelos','config_empresa']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I_auditoria on %I', t, t);
      execute format('create trigger %I_auditoria after insert or update or delete on %I for each row execute function registrar_auditoria()', t, t);
    end if;
  end loop;
end $$;

create index if not exists auditoria_quando on auditoria (ocorrido_em desc);
create index if not exists auditoria_usuario on auditoria (usuario_id, ocorrido_em desc);
create index if not exists auditoria_registro on auditoria (tabela, registro_id);

-- entrada e saída do sistema (gravadas pelo próprio Núcleo)
create or replace function registrar_acesso(p_acao text, p_detalhe text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_acao not in ('LOGIN', 'LOGOUT', 'MFA_ATIVADO', 'MFA_REMOVIDO') then return; end if;
  insert into auditoria (tabela, registro_id, acao, depois)
  values ('acessos', auth.uid()::text, p_acao, jsonb_build_object('detalhe', left(coalesce(p_detalhe, ''), 200)));
end $$;
revoke all on function registrar_acesso(text, text) from public, anon;
grant execute on function registrar_acesso(text, text) to authenticated;

-- histórico: só a diretoria consulta; ninguém altera nem apaga
drop policy if exists auditoria_ler on auditoria;
create policy auditoria_ler on auditoria for select to authenticated using (usuario_diretoria());
