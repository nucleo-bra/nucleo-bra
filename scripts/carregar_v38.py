"""Carrega a exportação do Financeiro v38 (artifact) na tabela fin_docs do Núcleo.

Uso: python3 scripts/carregar_v38.py <pasta_exportada> > carga.sql
A pasta deve conter it/, nf/, meta/ e (opcional) cl/ e log/ com um JSON por documento.

O SQL gerado:
  1. grava cada documento exatamente como está no v38 (idempotente);
  2. converte para o mesmo formato o que entrou no Núcleo por importação (NF XML, boleto);
  3. remove a cópia normalizada da migração anterior (titulos/notas com legado_id),
     que deixa de ser usada — só depois de conferir que nada se perdeu;
  4. confere quantidades e somas: se algo divergir do v38, a transação inteira é desfeita.
"""
import json, glob, sys, os
from decimal import Decimal

base = sys.argv[1]
def docs(col):
    return [json.load(open(f)) for f in sorted(glob.glob(os.path.join(base, col, '*.json')))]
def q(s): return "'" + s.replace("'", "''") + "'"

out = ['begin;', 'set local search_path = public;']
cont = {}
for col in ('it', 'nf', 'cl'):
    L = docs(col)
    cont[col] = L
    for d in L:
        out.append(f"insert into fin_docs (colecao, id, dados) values ('{col}', {q(str(d['id']))}, {q(json.dumps(d, ensure_ascii=False))}::jsonb) on conflict (colecao, id) do update set dados = excluded.dados;")
cont['log'] = docs('log')
# log: o id vem do nome do arquivo
for f in sorted(glob.glob(os.path.join(base, 'log', '*.json'))):
    i = os.path.basename(f)[:-5]
    out.append(f"insert into fin_docs (colecao, id, dados) values ('log', {q(i)}, {q(json.dumps(json.load(open(f)), ensure_ascii=False))}::jsonb) on conflict (colecao, id) do nothing;")
for f in sorted(glob.glob(os.path.join(base, 'meta', '*.json'))):
    i = os.path.basename(f)[:-5]
    out.append(f"insert into fin_docs (colecao, id, dados) values ('meta', {q(i)}, {q(json.dumps(json.load(open(f)), ensure_ascii=False))}::jsonb) on conflict (colecao, id) do update set dados = excluded.dados;")

# 2. o que entrou pelo Núcleo (importação) passa a aparecer no Financeiro
out.append("""
insert into fin_docs (colecao, id, dados)
select 'nf', 'nx-' || n.id, jsonb_build_object('id', 'nx-' || n.id, 'num', 'NF ' || n.numero,
  'data', (n.emitida_em at time zone 'America/Sao_Paulo')::date, 'valor', n.valor_servicos,
  'tipo', case when coalesce(n.categoria, case when n.tipo = 'nfse' then 'servico' end) = 'servico' then 'Serviço' else 'Material' end,
  'cli', coalesce(c.nome_fantasia, c.nome, n.cliente_texto, ''), 'coms', '[]'::jsonb)
from notas_fiscais n left join clientes c on c.id = n.cliente_id
where n.legado_id is null and n.status = 'emitida'
on conflict (colecao, id) do nothing;

insert into fin_docs (colecao, id, dados)
select 'it', 'tx-' || t.id, jsonb_build_object('id', 'tx-' || t.id, 't', 'r', 'desc', t.descricao,
  'who', coalesce(c.nome_fantasia, c.nome, ''),
  'forma', case t.forma when 'boleto' then 'Boleto' when 'cartao' then 'Cartão' when 'transferencia' then 'Transferência' else 'Pix' end,
  'valor', t.valor, 'venc', t.vencimento, 'pago', t.pago_em, 'par', coalesce(t.parcela, ''),
  'nfr', coalesce('NF ' || n.numero, ''), 'com', '', 'pct', 0, 'coms', '[]'::jsonb)
from titulos t left join clientes c on c.id = t.cliente_id left join notas_fiscais n on n.id = t.nota_fiscal_id
where t.legado_id is null and t.natureza = 'receber' and t.status <> 'cancelado'
on conflict (colecao, id) do nothing;""")

# 4. conferência contra o v38
it = cont['it']
tot = sum(Decimal(str(d['valor'])) for d in it)
pago = sum(Decimal(str(d['valor'])) for d in it if d.get('pago'))
tnf = sum(Decimal(str(d['valor'])) for d in cont['nf'])
fmt = lambda v: format(v.quantize(Decimal('0.01')), 'f')
out.append(f"""do $$
declare a numeric; b numeric; c int; e numeric; f int; g int;
begin
  select count(*), coalesce(sum((dados->>'valor')::numeric),0) into c, a from fin_docs where colecao = 'it' and id not like 'tx-%';
  select coalesce(sum((dados->>'valor')::numeric),0) into b from fin_docs where colecao = 'it' and id not like 'tx-%' and nullif(dados->>'pago','') is not null;
  select count(*), coalesce(sum((dados->>'valor')::numeric),0) into f, e from fin_docs where colecao = 'nf' and id not like 'nx-%';
  select count(*) into g from fin_docs where colecao = 'meta' and id in ('fech','cli');
  if c <> {len(it)} then raise exception 'Lançamentos: %, esperado {len(it)}', c; end if;
  if round(a,2) <> {fmt(tot)} then raise exception 'Total: %, esperado {fmt(tot)}', a; end if;
  if round(b,2) <> {fmt(pago)} then raise exception 'Recebido: %, esperado {fmt(pago)}', b; end if;
  if f <> {len(cont['nf'])} or round(e,2) <> {fmt(tnf)} then raise exception 'NFs: % / %, esperado {len(cont['nf'])} / {fmt(tnf)}', f, e; end if;
  if g <> 2 then raise exception 'Faltam fechamentos ou cadastro de clientes'; end if;
  raise notice 'Conferência OK: % lançamentos, total %, recebido %, % NFs', c, a, b, f;
end $$;""")

# 3. remove a cópia normalizada antiga (já conferida acima)
out.append("""
delete from titulo_comissoes where titulo_id in (select id from titulos where legado_id is not null);
delete from titulos where legado_id is not null;
delete from notas_fiscais where legado_id is not null;
delete from comissao_fechamentos;""")
out.append('commit;')
out.append(f"-- esperado: {len(it)} lançamentos | total {fmt(tot)} | recebido {fmt(pago)} | {len(cont['nf'])} NFs ({fmt(tnf)}) | {len(cont['log'])} registros de histórico")
print('\n'.join(out))
