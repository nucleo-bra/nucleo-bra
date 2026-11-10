-- =====================================================================
-- Organização dos dados · 10/11/2026 (roda uma vez; pode repetir sem efeito)
--   1. Pix antigos do A receber: cliente com NF → "Pix PJ"; demais → "Pix CPF"
--   2. Negócios sem cliente ligado → cliente do cadastro com o mesmo nome
--   3. Orçamentos sem cliente → cliente do negócio (ou nome antes de " | ")
-- Antes de mudar, guarda cópia em tabelas bkp_20261110_* (para desfazer).
-- No fim mostra quantos registros mudaram.
-- =====================================================================
create or replace function pg_temp.nrm(t text) returns text language sql immutable as
$$ select lower(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g')) $$;

-- cópias de segurança
create table if not exists bkp_20261110_fin_pix as
  select colecao, id, dados from fin_docs where colecao = 'it' and dados->>'t' = 'r' and dados->>'forma' = 'Pix';
create table if not exists bkp_20261110_oportunidades as
  select id, cliente_id from oportunidades where cliente_id is null;
create table if not exists bkp_20261110_propostas as
  select id, cliente_id from propostas where cliente_id is null;
alter table bkp_20261110_fin_pix enable row level security;
alter table bkp_20261110_oportunidades enable row level security;
alter table bkp_20261110_propostas enable row level security;

-- 1. Pix PJ / Pix CPF
with com_nf as (
  select pg_temp.nrm(dados->>'cli') as k from fin_docs where colecao = 'nf' and coalesce(dados->>'cli', '') <> ''
  union
  select pg_temp.nrm(dados->>'who') from fin_docs where colecao = 'it' and dados->>'t' = 'r' and coalesce(dados->>'nfr', '') <> ''
)
update fin_docs f
   set dados = jsonb_set(f.dados, '{forma}', to_jsonb(case when pg_temp.nrm(f.dados->>'who') in (select k from com_nf) then 'Pix PJ' else 'Pix CPF' end))
 where f.colecao = 'it' and f.dados->>'t' = 'r' and f.dados->>'forma' = 'Pix';

-- 2. Negócios → cliente com o mesmo nome (só quando há exatamente um)
with alvo as (
  select o.id, (array_agg(c.id))[1] as cliente_id, count(distinct c.id) as n
    from oportunidades o
    join clientes c on c.ativo and (pg_temp.nrm(c.nome) = pg_temp.nrm(o.cliente_nome) or (c.nome_fantasia is not null and pg_temp.nrm(c.nome_fantasia) = pg_temp.nrm(o.cliente_nome)))
   where o.cliente_id is null and coalesce(trim(o.cliente_nome), '') <> ''
   group by o.id
)
update oportunidades o set cliente_id = a.cliente_id from alvo a where o.id = a.id and a.n = 1;

-- 3. Orçamentos → cliente do negócio; senão, pelo nome antes de " | " no título
update propostas p set cliente_id = o.cliente_id
  from oportunidades o
 where p.cliente_id is null and p.oportunidade_id = o.id and o.cliente_id is not null;
with alvo as (
  select p.id, (array_agg(c.id))[1] as cliente_id, count(distinct c.id) as n
    from propostas p
    join clientes c on c.ativo and pg_temp.nrm(c.nome) = pg_temp.nrm(split_part(p.titulo, ' | ', 1))
   where p.cliente_id is null and position(' | ' in coalesce(p.titulo, '')) > 0
   group by p.id
)
update propostas p set cliente_id = a.cliente_id from alvo a where p.id = a.id and a.n = 1;

select 'pix_pj' as o_que, (select count(*) from bkp_20261110_fin_pix b join fin_docs f using (colecao, id) where f.dados->>'forma' = 'Pix PJ') as qtd
union all select 'pix_cpf', (select count(*) from bkp_20261110_fin_pix b join fin_docs f using (colecao, id) where f.dados->>'forma' = 'Pix CPF')
union all select 'negocios_ligados', (select count(*) from bkp_20261110_oportunidades b join oportunidades o on o.id = b.id where o.cliente_id is not null)
union all select 'orcamentos_ligados', (select count(*) from bkp_20261110_propostas b join propostas p on p.id = b.id where p.cliente_id is not null)
union all select 'negocios_ainda_sem_cliente', (select count(*) from oportunidades where cliente_id is null)
union all select 'orcamentos_ainda_sem_cliente', (select count(*) from propostas where cliente_id is null);

-- Para desfazer (se precisar):
--   update fin_docs f set dados = b.dados from bkp_20261110_fin_pix b where f.colecao = b.colecao and f.id = b.id;
--   update oportunidades o set cliente_id = null from bkp_20261110_oportunidades b where o.id = b.id;
--   update propostas p set cliente_id = null from bkp_20261110_propostas b where p.id = b.id;
