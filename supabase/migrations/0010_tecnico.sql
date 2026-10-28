-- =====================================================================
-- 0010 · Técnico: Projetos, Chamados e Agendamentos (mesmos quadros)
--   • quadros ganham "modulo" (projetos | chamados | agendamentos)
--   • cartões ganham campos de atendimento (nº, cliente, contato, endereço,
--     prioridade, garantia, horário agendado, vínculo chamado ↔ visita)
--   • quadros padrão de Chamados e Agendamentos
--   • time técnico (papel "tecnico") só enxerga a área técnica
-- Pode ser executada mais de uma vez.
-- =====================================================================

alter table quadros add column if not exists modulo text not null default 'projetos';
do $$ begin
  alter table quadros add constraint quadros_modulo check (modulo in ('projetos','chamados','agendamentos'));
exception when duplicate_object then null; end $$;
create index if not exists quadros_modulo on quadros (modulo, posicao);

alter table cartoes
  add column if not exists numero        integer,
  add column if not exists cliente_id    uuid references clientes(id) on delete set null,
  add column if not exists cliente_nome  text,
  add column if not exists telefone      text,
  add column if not exists endereco      text,
  add column if not exists prioridade    text,
  add column if not exists garantia      boolean,
  add column if not exists agenda_inicio timestamptz,
  add column if not exists agenda_fim    timestamptz,
  add column if not exists origem_id     uuid references cartoes(id) on delete set null,
  add column if not exists concluido_em  timestamptz;
do $$ begin
  alter table cartoes add constraint cartoes_prioridade check (prioridade is null or prioridade in ('baixa','media','alta','urgente'));
exception when duplicate_object then null; end $$;
create index if not exists cartoes_agenda on cartoes (agenda_inicio) where not arquivado;
create index if not exists cartoes_cliente on cartoes (cliente_id);

-- número sequencial por módulo (chamado nº 12, visita nº 30…)
create or replace function numerar_cartao() returns trigger
language plpgsql security definer set search_path = public as $$
declare m text;
begin
  if new.numero is null then
    select modulo into m from quadros where id = new.quadro_id;
    perform pg_advisory_xact_lock(hashtext('cartao_numero_' || coalesce(m, 'projetos')));
    select coalesce(max(c.numero), 0) + 1 into new.numero
      from cartoes c join quadros q on q.id = c.quadro_id where q.modulo = coalesce(m, 'projetos');
  end if;
  return new;
end $$;
drop trigger if exists cartoes_numero on cartoes;
create trigger cartoes_numero before insert on cartoes for each row execute function numerar_cartao();
-- numera os cartões que já existem
with n as (
  select c.id, row_number() over (partition by q.modulo order by c.created_at, c.id) as k
  from cartoes c join quadros q on q.id = c.quadro_id where c.numero is null
)
update cartoes set numero = n.k from n where cartoes.id = n.id;

-- quadros padrão
do $$
declare q uuid; i int; l text; e text[];
begin
  if not exists (select 1 from quadros where modulo = 'chamados') then
    insert into quadros (nome, descricao, fundo, posicao, modulo) values ('Chamados', 'Assistência técnica e suporte aos clientes', 'por_do_sol', 0, 'chamados') returning id into q;
    i := 0; foreach l in array array['Novos','Em atendimento','Aguardando cliente / peça','Resolvidos'] loop
      i := i + 1; insert into quadro_listas (quadro_id, nome, posicao) values (q, l, i * 1000);
    end loop;
    i := 0; foreach e slice 1 in array array[['Falha / defeito','vermelho'],['Ajuste de programação','azul'],['Visita técnica','verde'],['Garantia','laranja'],['Rede / Wi-Fi','ciano'],['Áudio e vídeo','roxo'],['Dúvida / treinamento','amarelo']] loop
      insert into quadro_etiquetas (quadro_id, nome, cor, posicao) values (q, e[1], e[2], i); i := i + 1;
    end loop;
  end if;
  if not exists (select 1 from quadros where modulo = 'agendamentos') then
    insert into quadros (nome, descricao, fundo, posicao, modulo) values ('Agendamentos', 'Visitas, instalações e manutenções agendadas', 'oceano', 0, 'agendamentos') returning id into q;
    i := 0; foreach l in array array['A agendar','Agendados','Em execução','Concluídos'] loop
      i := i + 1; insert into quadro_listas (quadro_id, nome, posicao) values (q, l, i * 1000);
    end loop;
    i := 0; foreach e slice 1 in array array[['Instalação','azul'],['Visita técnica','verde'],['Manutenção','laranja'],['Vistoria de obra','amarelo'],['Entrega / treinamento','roxo'],['Retorno de chamado','vermelho']] loop
      insert into quadro_etiquetas (quadro_id, nome, cor, posicao) values (q, e[1], e[2], i); i := i + 1;
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------- acesso do time técnico
create or replace function usuario_tecnico() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'tecnico')
$$;

-- regra restritiva: soma-se às permissões existentes; técnico fica sem acesso
do $$
declare t text;
begin
  foreach t in array array['fin_docs','titulos','notas_fiscais','comissoes','categorias_financeiras','contratos','contrato_eventos',
    'contrato_modelos','config_empresa','oportunidades','atividades','parceiros','propostas','proposta_itens','importacoes',
    'campanhas','campanha_metricas','auditoria','calendario_tokens']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on %I', t || '_sem_tecnico', t);
      execute format('create policy %I on %I as restrictive for all to authenticated using (not usuario_tecnico()) with check (not usuario_tecnico())', t || '_sem_tecnico', t);
    end if;
  end loop;
end $$;

-- arquivos: técnico só os anexos dos cartões técnicos
drop policy if exists arquivos_tecnico on storage.objects;
create policy arquivos_tecnico on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'documentos' or not public.usuario_tecnico() or split_part(name, '/', 1) = 'projetos')
  with check (bucket_id <> 'documentos' or not public.usuario_tecnico() or split_part(name, '/', 1) = 'projetos');
