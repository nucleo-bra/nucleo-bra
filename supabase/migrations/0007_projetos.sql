-- =====================================================================
-- NÚCLEO BRA — Projetos / time técnico (quadros no estilo Trello)
-- Quadros → listas → cartões, com etiquetas, responsáveis, prazo,
-- checklist, comentários e anexos. Tudo em tempo real para o time.
-- =====================================================================

create table if not exists quadros (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(trim(nome)) > 0),
  descricao   text,
  fundo       text not null default 'marinho',
  posicao     double precision not null default 0,
  arquivado   boolean not null default false,
  favorito    boolean not null default false,
  criado_por  uuid references perfis(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists quadro_etiquetas (
  id        uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references quadros(id) on delete cascade,
  nome      text not null default '',
  cor       text not null default 'azul',
  posicao   double precision not null default 0
);

create table if not exists quadro_listas (
  id        uuid primary key default gen_random_uuid(),
  quadro_id uuid not null references quadros(id) on delete cascade,
  nome      text not null check (length(trim(nome)) > 0),
  posicao   double precision not null default 0,
  arquivada boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists quadro_listas_quadro on quadro_listas (quadro_id, posicao);

create table if not exists cartoes (
  id             uuid primary key default gen_random_uuid(),
  quadro_id      uuid not null references quadros(id) on delete cascade,
  lista_id       uuid not null references quadro_listas(id) on delete cascade,
  titulo         text not null check (length(trim(titulo)) > 0),
  descricao      text,
  posicao        double precision not null default 0,
  capa           text,
  etiquetas      uuid[] not null default '{}',
  membros        uuid[] not null default '{}',
  inicio         date,
  prazo          timestamptz,
  prazo_concluido boolean not null default false,
  arquivado      boolean not null default false,
  oportunidade_id uuid references oportunidades(id) on delete set null,
  criado_por     uuid references perfis(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cartoes_lista on cartoes (lista_id, posicao);
create index if not exists cartoes_quadro on cartoes (quadro_id);
create index if not exists cartoes_prazo on cartoes (prazo) where not arquivado and not prazo_concluido;

create table if not exists cartao_checklist (
  id        uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references cartoes(id) on delete cascade,
  texto     text not null,
  feito     boolean not null default false,
  posicao   double precision not null default 0,
  feito_por uuid references perfis(id),
  feito_em  timestamptz
);
create index if not exists cartao_checklist_cartao on cartao_checklist (cartao_id, posicao);

create table if not exists cartao_comentarios (
  id         uuid primary key default gen_random_uuid(),
  cartao_id  uuid not null references cartoes(id) on delete cascade,
  autor      uuid references perfis(id) default auth.uid(),
  texto      text not null check (length(trim(texto)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists cartao_comentarios_cartao on cartao_comentarios (cartao_id, created_at);

create table if not exists cartao_anexos (
  id           uuid primary key default gen_random_uuid(),
  cartao_id    uuid not null references cartoes(id) on delete cascade,
  nome         text not null,
  mime         text,
  tamanho      bigint,
  storage_path text,          -- arquivo no bucket "documentos"
  url          text,          -- ou um link externo (OneDrive, Drive…)
  enviado_por  uuid references perfis(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  check (storage_path is not null or url is not null)
);
create index if not exists cartao_anexos_cartao on cartao_anexos (cartao_id);

-- carimbo de atualização
create or replace function projetos_atualizado() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists quadros_atualizado on quadros;
create trigger quadros_atualizado before update on quadros for each row execute function projetos_atualizado();
drop trigger if exists cartoes_atualizado on cartoes;
create trigger cartoes_atualizado before update on cartoes for each row execute function projetos_atualizado();

-- RLS, auditoria e tempo real: o time inteiro (usuários ativos) trabalha nos quadros
do $$
declare t text;
begin
  foreach t in array array['quadros','quadro_etiquetas','quadro_listas','cartoes','cartao_checklist','cartao_comentarios','cartao_anexos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_ler on %I', t, t);
    execute format('drop policy if exists %I_gravar on %I', t, t);
    execute format('create policy %I_ler on %I for select to authenticated using (usuario_ativo())', t, t);
    execute format('create policy %I_gravar on %I for all to authenticated using (usuario_ativo()) with check (usuario_ativo())', t, t);
    execute format('drop trigger if exists %I_auditoria on %I', t, t);
    execute format('create trigger %I_auditoria after insert or update or delete on %I for each row execute function registrar_auditoria()', t, t);
    execute format('alter table %I replica identity full', t);
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end $$;

-- comentário só pode ser apagado/editado por quem escreveu (ou diretoria)
drop policy if exists cartao_comentarios_gravar on cartao_comentarios;
drop policy if exists cartao_comentarios_inserir on cartao_comentarios;
drop policy if exists cartao_comentarios_alterar on cartao_comentarios;
drop policy if exists cartao_comentarios_excluir on cartao_comentarios;
create policy cartao_comentarios_inserir on cartao_comentarios for insert to authenticated with check (usuario_ativo() and autor = auth.uid());
create policy cartao_comentarios_alterar on cartao_comentarios for update to authenticated using (autor = auth.uid() or usuario_diretoria());
create policy cartao_comentarios_excluir on cartao_comentarios for delete to authenticated using (autor = auth.uid() or usuario_diretoria());

-- anexos enviados pelo time também podem ser apagados por quem enviou
drop policy if exists arquivos_excluir_projetos on storage.objects;
create policy arquivos_excluir_projetos on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and split_part(name, '/', 1) = 'projetos' and public.usuario_ativo());

-- membros do time visíveis para atribuir cartões
create or replace view equipe with (security_invoker = true) as
select id, nome, email, papel from perfis where ativo order by nome;
