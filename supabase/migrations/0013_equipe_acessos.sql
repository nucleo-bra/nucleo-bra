-- =====================================================================
-- 0013 · Pedidos de acesso e equipe
--   • quem pede acesso na tela de login escolhe a área (técnico, comercial
--     ou financeiro); o perfil nasce INATIVO, como sempre
--   • a diretoria recebe um aviso no sininho e libera na tela Equipe
-- Pode ser executada mais de uma vez.
-- =====================================================================

create or replace function novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare primeiro boolean; v_papel text := new.raw_user_meta_data->>'papel_pedido';
begin
  select not exists (select 1 from perfis) into primeiro;
  insert into perfis (id, nome, email, papel, ativo)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email,'@',1)),
          new.email,
          case when primeiro then 'diretoria'::papel_usuario
               when v_papel in ('tecnico','comercial','financeiro') then v_papel::papel_usuario
               else 'financeiro'::papel_usuario end,
          primeiro);
  return new;
end $$;

-- aviso para a diretoria quando chega um pedido
create or replace function avisar_pedido_acesso() returns trigger
language plpgsql security definer set search_path = public as $$
declare d uuid;
begin
  if new.ativo then return new; end if;
  for d in select id from perfis where ativo and papel = 'diretoria' and id <> new.id loop
    insert into notificacoes (usuario_id, tipo, titulo, corpo, link)
    values (d, 'acesso', 'Pedido de acesso: ' || new.nome,
            new.email || ' · área ' || case new.papel when 'tecnico' then 'técnica' when 'comercial' then 'comercial' else 'financeira' end,
            '/equipe/');
  end loop;
  return new;
end $$;
drop trigger if exists perfis_avisar_pedido on perfis;
create trigger perfis_avisar_pedido after insert on perfis for each row execute function avisar_pedido_acesso();

-- a diretoria não pode se desativar nem tirar o próprio papel por engano
create or replace function proteger_proprio_perfil() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.id = auth.uid() and (not new.ativo or new.papel <> 'diretoria') and old.papel = 'diretoria' then
    raise exception 'Você não pode remover o seu próprio acesso de diretoria.';
  end if;
  return new;
end $$;
drop trigger if exists perfis_proteger on perfis;
create trigger perfis_proteger before update on perfis for each row execute function proteger_proprio_perfil();
