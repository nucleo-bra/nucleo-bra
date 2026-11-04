-- =====================================================================
-- 0019 · Desliga a verificação em duas etapas (pedido da diretoria, 04/11/2026)
--   • as regras voltam a exigir só login ativo (sem o código do app)
--   • remove os apps autenticadores já cadastrados, para o login não pedir código
--   • o histórico (0018) continua igual
-- Pode ser executada mais de uma vez.
-- =====================================================================
create or replace function usuario_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo)
$$;

create or replace function usuario_diretoria() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo and papel = 'diretoria')
$$;

delete from auth.mfa_factors;

drop function if exists equipe_mfa();
drop function if exists zerar_mfa(uuid);
drop function if exists mfa_ok();
