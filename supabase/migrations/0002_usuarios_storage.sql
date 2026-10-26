-- =====================================================================
-- NÚCLEO BRA — Usuários e armazenamento de arquivos
-- =====================================================================

-- Todo usuário novo ganha um perfil. O PRIMEIRO usuário vira diretoria
-- ativa (Matheus). Os demais entram INATIVOS até a diretoria liberar.
create or replace function novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare primeiro boolean;
begin
  select not exists (select 1 from perfis) into primeiro;
  insert into perfis (id, nome, email, papel, ativo)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
          new.email,
          case when primeiro then 'diretoria'::papel_usuario else 'financeiro'::papel_usuario end,
          primeiro);
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function novo_usuario();

-- Buckets privados: documentos de clientes e acervo de marketing
-- (50 MB por arquivo no plano gratuito; aumentar ao migrar para o Pro)
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 52428800),
       ('midias',     'midias',     false, 52428800)
on conflict (id) do nothing;

create policy arquivos_ler on storage.objects for select to authenticated
  using (bucket_id in ('documentos','midias') and public.usuario_ativo());
create policy arquivos_enviar on storage.objects for insert to authenticated
  with check (bucket_id in ('documentos','midias') and public.usuario_ativo());
create policy arquivos_excluir on storage.objects for delete to authenticated
  using (bucket_id in ('documentos','midias') and public.usuario_diretoria());
