-- =====================================================================
-- NÚCLEO BRA — Agenda do CRM no Calendário do iPhone (assinatura .ics)
-- Cada usuário gera um link secreto; a função agenda-ics entrega os
-- compromissos nesse formato. Revogar o link corta o acesso na hora.
-- =====================================================================

create table if not exists calendario_tokens (
  perfil_id   uuid primary key references perfis(id) on delete cascade,
  token       text not null unique,
  criado_em   timestamptz not null default now(),
  ultimo_uso  timestamptz
);
alter table calendario_tokens enable row level security;
drop policy if exists calendario_tokens_proprio on calendario_tokens;
create policy calendario_tokens_proprio on calendario_tokens for select to authenticated using (perfil_id = auth.uid());

-- gera (ou troca) o link do usuário logado
create or replace function gerar_link_agenda() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not usuario_ativo() then raise exception 'Usuário sem permissão'; end if;
  insert into calendario_tokens (perfil_id, token) values (auth.uid(), t)
  on conflict (perfil_id) do update set token = excluded.token, criado_em = now(), ultimo_uso = null;
  return t;
end $$;

create or replace function revogar_link_agenda() returns void
language sql security definer set search_path = public as $$
  delete from calendario_tokens where perfil_id = auth.uid();
$$;

-- usada só pela função agenda-ics (service role): valida o link e devolve a agenda
create or replace function agenda_por_token(p_token text)
returns table (id uuid, tipo text, titulo text, notas text, quando timestamptz, dia_todo boolean, duracao_min integer,
               concluida boolean, contato text, parceiro text, negocio text, atualizado timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_perfil uuid;
begin
  select c.perfil_id into v_perfil from calendario_tokens c join perfis p on p.id = c.perfil_id
   where c.token = p_token and p.ativo;
  if v_perfil is null then return; end if;
  update calendario_tokens set ultimo_uso = now() where perfil_id = v_perfil;
  return query
    select a.id, a.tipo::text, a.titulo, a.notas, a.quando, a.dia_todo, a.duracao_min, a.concluida, a.contato,
           pa.nome, coalesce(o.cliente_nome, o.titulo), coalesce(a.concluida_em, a.created_at)
      from atividades a
      left join parceiros pa on pa.id = a.parceiro_id
      left join oportunidades o on o.id = a.oportunidade_id
     where a.quando >= now() - interval '90 days' and a.quando <= now() + interval '400 days'
     order by a.quando;
end $$;
revoke all on function agenda_por_token(text) from public, anon, authenticated;
