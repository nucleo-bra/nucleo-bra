-- =====================================================================
-- 0015 · Cartão do cliente completo, aditivos, equipe com comissão,
--        agenda técnica, catálogos e avisos que somem ao concluir
-- Pode ser executada mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------- avisos de atividade
alter table notificacoes add column if not exists ref_id uuid;
create index if not exists notificacoes_ref on notificacoes (ref_id) where ref_id is not null;

create or replace function avisar_atividade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.concluida or new.responsavel_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then return new; end if;
  if new.responsavel_id = auth.uid() then return new; end if;
  insert into notificacoes (usuario_id, tipo, titulo, corpo, link, autor_id, ref_id)
  select new.responsavel_id, 'atividade', nome_usuario(auth.uid()) || ' passou uma atividade para você',
         new.titulo || ' · ' || to_char(new.quando at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
         case when new.oportunidade_id is not null then '/crm/?aba=negocios&n=' || new.oportunidade_id else '/crm/?aba=agenda' end,
         auth.uid(), new.id
  where exists (select 1 from perfis where id = new.responsavel_id and ativo);
  return new;
end $$;

-- atividade concluída ou excluída: o aviso dela sai do sininho
create or replace function limpar_aviso_atividade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update notificacoes set lida_em = now() where ref_id = old.id and lida_em is null;
    return old;
  end if;
  if new.concluida and not coalesce(old.concluida, false) then
    update notificacoes set lida_em = now() where ref_id = new.id and lida_em is null;
  end if;
  return new;
end $$;
drop trigger if exists atividades_limpar_aviso on atividades;
create trigger atividades_limpar_aviso after update of concluida or delete on atividades
  for each row execute function limpar_aviso_atividade();

-- avisos antigos (sem ref_id) de atividades já concluídas ou apagadas
update notificacoes n set lida_em = now()
 where n.tipo = 'atividade' and n.lida_em is null and n.ref_id is null
   and not exists (select 1 from atividades a where not a.concluida and n.corpo like a.titulo || ' · %');

-- ---------------------------------------------------------------- equipe com comissão em todo negócio fechado
alter table comissionados
  add column if not exists percentual_padrao numeric(7,4),
  add column if not exists automatico boolean not null default false;   -- entra sozinho em todo lançamento
insert into comissionados (nome, papel, percentual_padrao, automatico)
values ('Caio Lisboa', 'Engenheiro', 1.48, true), ('Raquel Monção', 'Projetista', 0.24, true)
on conflict (nome, papel) do update set percentual_padrao = excluded.percentual_padrao, automatico = true, ativo = true;

-- ---------------------------------------------------------------- aditivos: cadastro ligado ao cliente principal
alter table clientes add column if not exists principal_id uuid references clientes(id) on delete set null;
create index if not exists clientes_principal on clientes (principal_id) where principal_id is not null;
do $$ begin
  alter table clientes add constraint clientes_principal_outro check (principal_id is null or principal_id <> id);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- agenda técnica: equipamentos da visita
alter table cartoes add column if not exists equipamentos jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------- catálogos de fornecedores (PDF ou link)
create table if not exists catalogos (
  id            uuid primary key default gen_random_uuid(),
  fornecedor    text not null,
  titulo        text not null,
  categoria     text,
  url           text,                 -- site / catálogo online
  storage_path  text,                 -- PDF no bucket "documentos" (pasta catalogos/)
  arquivo_nome  text,
  tamanho_bytes bigint,
  observacoes   text,
  created_by    uuid references perfis(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  constraint catalogo_tem_origem check (url is not null or storage_path is not null)
);
create index if not exists catalogos_fornecedor on catalogos (lower(fornecedor));
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'catalogos' and policyname = 'catalogos_ler') then
    alter table catalogos enable row level security;
    create policy catalogos_ler on catalogos for select to authenticated using (usuario_ativo());
    create policy catalogos_inserir on catalogos for insert to authenticated with check (usuario_ativo());
    create policy catalogos_alterar on catalogos for update to authenticated using (usuario_ativo()) with check (usuario_ativo());
    create policy catalogos_excluir on catalogos for delete to authenticated using (usuario_ativo());
  end if;
end $$;

-- ---------------------------------------------------------------- base de conhecimento (o assistente consulta)
create table if not exists base_conhecimento (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  conteudo    text not null,
  tags        text[] not null default '{}',
  created_by  uuid references perfis(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'base_conhecimento' and policyname = 'base_ler') then
    alter table base_conhecimento enable row level security;
    create policy base_ler on base_conhecimento for select to authenticated using (usuario_ativo());
    create policy base_inserir on base_conhecimento for insert to authenticated with check (usuario_ativo());
    create policy base_alterar on base_conhecimento for update to authenticated using (usuario_ativo()) with check (usuario_ativo());
    create policy base_excluir on base_conhecimento for delete to authenticated using (usuario_ativo());
    create trigger base_conhecimento_updated before update on base_conhecimento for each row execute function set_updated_at();
  end if;
end $$;
