-- =====================================================================
-- 0011 · Avisos dentro do Núcleo (sininho + popup ao entrar)
--   • notificacoes: um aviso por pessoa (só ela lê, marca como lido, apaga)
--   • gerados pelo próprio banco quando alguém:
--       – coloca outra pessoa num cartão (projeto, chamado, visita)
--       – comenta num cartão em que a pessoa está
--       – cria/passa uma atividade do CRM para outra pessoa
--   • vencimentos (parcelas, prazos, visitas do dia) são calculados na hora,
--     direto dos dados — não precisam ser gravados aqui.
-- Pode ser executada mais de uma vez.
-- =====================================================================

create table if not exists notificacoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references perfis(id) on delete cascade,
  tipo        text not null default 'aviso',
  titulo      text not null,
  corpo       text,
  link        text,
  autor_id    uuid references perfis(id) on delete set null,
  lida_em     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notificacoes_usuario on notificacoes (usuario_id, created_at desc);
create index if not exists notificacoes_nao_lidas on notificacoes (usuario_id) where lida_em is null;

alter table notificacoes enable row level security;
drop policy if exists notificacoes_ler on notificacoes;
drop policy if exists notificacoes_alterar on notificacoes;
drop policy if exists notificacoes_excluir on notificacoes;
create policy notificacoes_ler on notificacoes for select to authenticated using (usuario_id = auth.uid());
create policy notificacoes_alterar on notificacoes for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy notificacoes_excluir on notificacoes for delete to authenticated using (usuario_id = auth.uid());
-- (sem política de inserção: só os gatilhos abaixo criam avisos)

alter table notificacoes replica identity full;
do $$ begin
  alter publication supabase_realtime add table notificacoes;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ---------------------------------------------------------------- auxiliares
create or replace function notificar(p_usuario uuid, p_tipo text, p_titulo text, p_corpo text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_usuario is null or p_usuario = auth.uid() then return; end if;   -- não avisa a própria pessoa
  if not exists (select 1 from perfis where id = p_usuario and ativo) then return; end if;
  insert into notificacoes (usuario_id, tipo, titulo, corpo, link, autor_id)
  values (p_usuario, p_tipo, p_titulo, p_corpo, p_link, auth.uid());
end $$;
revoke all on function notificar(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function nome_usuario(p uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select split_part(nome, ' ', 1) from perfis where id = p), 'Alguém')
$$;

create or replace function link_cartao(c cartoes) returns text
language sql stable security definer set search_path = public as $$
  select case q.modulo
    when 'chamados'     then '/tecnico/chamados/?c=' || c.id
    when 'agendamentos' then '/tecnico/agendamentos/?c=' || c.id
    else '/tecnico/projetos/?q=' || c.quadro_id || '&c=' || c.id end
  from quadros q where q.id = c.quadro_id
$$;

-- ---------------------------------------------------------------- cartões: atribuição
create or replace function avisar_cartao_membros() returns trigger
language plpgsql security definer set search_path = public as $$
declare m uuid; v_mod text; v_oque text; v_quando text := '';
begin
  if new.arquivado then return new; end if;
  select modulo into v_mod from quadros where id = new.quadro_id;
  v_oque := case v_mod when 'chamados' then 'o chamado' when 'agendamentos' then 'a visita' else 'o cartão' end;
  if new.agenda_inicio is not null then
    v_quando := ' · ' || to_char(new.agenda_inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
  elsif new.prazo is not null then
    v_quando := ' · prazo ' || to_char(new.prazo at time zone 'America/Sao_Paulo', 'DD/MM');
  end if;
  foreach m in array coalesce(new.membros, '{}') loop
    if tg_op = 'INSERT' or not (m = any(coalesce(old.membros, '{}'))) then
      perform notificar(m, 'atribuicao',
        nome_usuario(auth.uid()) || ' colocou você n' || substr(v_oque, 1, 1) || ' ' || substr(v_oque, 3)
          || case when new.numero is not null and v_mod in ('chamados','agendamentos') then ' #' || new.numero else '' end,
        new.titulo || coalesce(' · ' || new.cliente_nome, '') || v_quando,
        link_cartao(new));
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists cartoes_avisar_membros on cartoes;
create trigger cartoes_avisar_membros after insert or update of membros on cartoes
  for each row execute function avisar_cartao_membros();

-- ---------------------------------------------------------------- cartões: comentários
create or replace function avisar_cartao_comentario() returns trigger
language plpgsql security definer set search_path = public as $$
declare c cartoes; m uuid; alvo uuid[];
begin
  select * into c from cartoes where id = new.cartao_id;
  if not found then return new; end if;
  alvo := coalesce(c.membros, '{}');
  if c.criado_por is not null and not (c.criado_por = any(alvo)) then alvo := alvo || c.criado_por; end if;
  foreach m in array alvo loop
    perform notificar(m, 'comentario', nome_usuario(new.autor) || ' comentou em “' || c.titulo || '”',
      left(new.texto, 160), link_cartao(c));
  end loop;
  return new;
end $$;
drop trigger if exists cartao_comentarios_avisar on cartao_comentarios;
create trigger cartao_comentarios_avisar after insert on cartao_comentarios
  for each row execute function avisar_cartao_comentario();

-- ---------------------------------------------------------------- CRM: atividade para outra pessoa
create or replace function avisar_atividade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.concluida or new.responsavel_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then return new; end if;
  perform notificar(new.responsavel_id, 'atividade',
    nome_usuario(auth.uid()) || ' passou uma atividade para você',
    new.titulo || ' · ' || to_char(new.quando at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
    case when new.oportunidade_id is not null then '/crm/?aba=negocios&n=' || new.oportunidade_id else '/crm/?aba=agenda' end);
  return new;
end $$;
drop trigger if exists atividades_avisar on atividades;
create trigger atividades_avisar after insert or update of responsavel_id on atividades
  for each row execute function avisar_atividade();
