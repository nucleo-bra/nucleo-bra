-- =====================================================================
-- NÚCLEO BRA — Financeiro idêntico ao v38
-- O módulo financeiro passa a rodar a própria interface do v38, com os
-- mesmos documentos (it, nf, cl, log, meta). Aqui eles ficam guardados no
-- banco do Núcleo, com RLS, auditoria e tempo real.
--   it   = lançamentos (parcelas a receber)
--   nf   = notas de faturamento
--   cl   = linhas de comissão de parceiros
--   log  = histórico de ações
--   meta = fech (fechamentos de comissão) e cli (cidade/UF/WhatsApp por cliente)
-- =====================================================================

create table if not exists fin_docs (
  colecao        text not null check (colecao in ('it','nf','cl','log','meta')),
  id             text not null check (length(id) between 1 and 200),
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (colecao, id)
);
create index if not exists fin_docs_atualizacao on fin_docs (colecao, atualizado_em desc);

create or replace function fin_docs_carimbo() returns trigger
language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  return new;
end $$;
drop trigger if exists fin_docs_carimbo on fin_docs;
create trigger fin_docs_carimbo before insert or update on fin_docs for each row execute function fin_docs_carimbo();

-- toda alteração e exclusão fica guardada (dá para recuperar qualquer lançamento)
drop trigger if exists fin_docs_auditoria on fin_docs;
create trigger fin_docs_auditoria after insert or update or delete on fin_docs
  for each row execute function registrar_auditoria();

alter table fin_docs enable row level security;
drop policy if exists fin_docs_ler on fin_docs;
drop policy if exists fin_docs_inserir on fin_docs;
drop policy if exists fin_docs_alterar on fin_docs;
drop policy if exists fin_docs_excluir on fin_docs;
create policy fin_docs_ler on fin_docs for select to authenticated using (usuario_ativo());
create policy fin_docs_inserir on fin_docs for insert to authenticated with check (usuario_ativo());
create policy fin_docs_alterar on fin_docs for update to authenticated
  using (usuario_ativo() and colecao <> 'log') with check (usuario_ativo());
create policy fin_docs_excluir on fin_docs for delete to authenticated
  using (usuario_ativo() and colecao <> 'log');

-- tempo real (web e celular sincronizados, como no v38)
alter table fin_docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table fin_docs;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Leitura analítica para a home do Núcleo (mesmas regras do v38)
-- ---------------------------------------------------------------------
create or replace view fin_lancamentos with (security_invoker = true) as
select
  d.id,
  d.dados->>'t'                              as tipo,
  d.dados->>'desc'                           as descricao,
  d.dados->>'who'                            as cliente,
  d.dados->>'forma'                          as forma,
  d.dados->>'par'                            as parcela,
  nullif(d.dados->>'nfr','')                 as nf,
  (d.dados->>'valor')::numeric               as valor,
  (d.dados->>'venc')::date                   as vencimento,
  nullif(d.dados->>'pago','')::date          as pago_em,
  case when nullif(d.dados->>'pago','') is not null
       then coalesce(nullif(d.dados->>'vp','')::numeric, (d.dados->>'valor')::numeric) end as valor_recebido,
  case when nullif(d.dados->>'pago','') is not null then 'pago'
       when (d.dados->>'venc')::date < current_date then 'atrasado' else 'aberto' end as situacao,
  coalesce(d.dados->'coms', '[]'::jsonb)     as comissoes
from fin_docs d
where d.colecao = 'it';

create or replace view fin_notas with (security_invoker = true) as
select d.id, d.dados->>'num' as numero, (d.dados->>'data')::date as emitida_em,
       (d.dados->>'valor')::numeric as valor, d.dados->>'tipo' as tipo, nullif(d.dados->>'cli','') as cliente
from fin_docs d where d.colecao = 'nf';

-- ---------------------------------------------------------------------
-- Importações (XML da Omie, boleto) entram no Financeiro automaticamente
-- ---------------------------------------------------------------------
create or replace function fin_nota_importada() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cli text;
begin
  if new.origem <> 'xml' or new.status <> 'emitida' then return new; end if;
  select coalesce(nome_fantasia, nome) into v_cli from clientes where id = new.cliente_id;
  insert into fin_docs (colecao, id, dados) values ('nf', 'nx-' || new.id, jsonb_build_object(
    'id', 'nx-' || new.id, 'num', 'NF ' || new.numero, 'data', (new.emitida_em at time zone 'America/Sao_Paulo')::date,
    'valor', new.valor_servicos, 'tipo', case when coalesce(new.categoria, case when new.tipo = 'nfse' then 'servico' end) = 'servico' then 'Serviço' else 'Material' end,
    'cli', coalesce(v_cli, new.cliente_texto, ''), 'coms', '[]'::jsonb))
  on conflict (colecao, id) do nothing;
  return new;
end $$;
drop trigger if exists fin_nota_importada on notas_fiscais;
create trigger fin_nota_importada after insert on notas_fiscais for each row execute function fin_nota_importada();

create or replace function fin_titulo_importado() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cli text; v_nf text; v_id text := 'tx-' || new.id; v_forma text;
begin
  if new.legado_id is not null or new.natureza <> 'receber' then return new; end if;
  select coalesce(nome_fantasia, nome) into v_cli from clientes where id = new.cliente_id;
  select 'NF ' || numero into v_nf from notas_fiscais where id = new.nota_fiscal_id;
  v_forma := case new.forma when 'boleto' then 'Boleto' when 'cartao' then 'Cartão' when 'transferencia' then 'Transferência' else 'Pix' end;
  if tg_op = 'INSERT' then
    -- se a parcela dessa NF já foi lançada à mão no Financeiro, não duplica
    if v_nf is not null and exists (select 1 from fin_docs where colecao = 'it' and dados->>'nfr' = v_nf) then return new; end if;
    insert into fin_docs (colecao, id, dados) values ('it', v_id, jsonb_build_object(
      'id', v_id, 't', 'r', 'desc', new.descricao, 'who', coalesce(v_cli, ''), 'forma', v_forma,
      'valor', new.valor, 'venc', new.vencimento, 'pago', new.pago_em, 'par', coalesce(new.parcela, ''),
      'nfr', coalesce(v_nf, ''), 'com', '', 'pct', 0, 'coms', '[]'::jsonb))
    on conflict (colecao, id) do nothing;
  else
    -- boleto importado depois: atualiza só vencimento, valor e forma (baixa continua no Financeiro)
    update fin_docs set dados = dados || jsonb_build_object('venc', new.vencimento, 'valor', new.valor, 'forma', v_forma)
     where colecao = 'it' and id = v_id and nullif(dados->>'pago','') is null;
  end if;
  return new;
end $$;
drop trigger if exists fin_titulo_importado on titulos;
create trigger fin_titulo_importado after insert or update of vencimento, valor, forma on titulos
  for each row execute function fin_titulo_importado();
