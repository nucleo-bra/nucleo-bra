-- =====================================================================
-- 0012 · Compromissos do CRM com endereço e término
--   • atividades.endereco: vai como "Local" no Calendário do iPhone/Mac
--     (toque abre o Mapas)
--   • atividades.termino: data e hora de término (antes era sempre 1 h)
-- Pode ser executada mais de uma vez.
-- =====================================================================

alter table atividades add column if not exists endereco text;
alter table atividades add column if not exists termino  timestamptz;
do $$ begin
  alter table atividades add constraint atividades_termino_depois check (termino is null or termino >= quando);
exception when duplicate_object then null; end $$;

-- a agenda do iPhone passa a receber endereço e término
drop function if exists agenda_por_token(text);
create function agenda_por_token(p_token text)
returns table (id uuid, tipo text, titulo text, notas text, quando timestamptz, dia_todo boolean, duracao_min integer,
               concluida boolean, contato text, parceiro text, negocio text, atualizado timestamptz,
               endereco text, fim timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_perfil uuid;
begin
  select c.perfil_id into v_perfil from calendario_tokens c join perfis p on p.id = c.perfil_id
   where c.token = p_token and p.ativo;
  if v_perfil is null then return; end if;
  update calendario_tokens set ultimo_uso = now() where perfil_id = v_perfil;
  return query
    select a.id, a.tipo::text, a.titulo, a.notas, a.quando, a.dia_todo, a.duracao_min, a.concluida, a.contato,
           pa.nome, coalesce(o.cliente_nome, o.titulo), coalesce(a.concluida_em, a.created_at),
           a.endereco, a.termino
      from atividades a
      left join parceiros pa on pa.id = a.parceiro_id
      left join oportunidades o on o.id = a.oportunidade_id
     where a.quando >= now() - interval '90 days' and a.quando <= now() + interval '400 days'
     order by a.quando;
end $$;
revoke all on function agenda_por_token(text) from public, anon, authenticated;
