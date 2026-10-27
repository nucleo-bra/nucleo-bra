"""Converte a exportação do Financeiro v38 (artifact) em SQL para o Núcleo.

Uso: python3 scripts/migrar_v38.py <pasta_exportada> > migracao.sql
A pasta deve conter it/*.json, nf/*.json, meta/cli.json e meta/fech.json.
O SQL gerado é idempotente (usa legado_id) e termina conferindo os totais:
se qualquer soma divergir do v38, a transação inteira é desfeita.
"""
import json, glob, sys, os, re
from decimal import Decimal

BRT_CNPJ = '07787973000161'
base = sys.argv[1]
ld = lambda p: json.load(open(os.path.join(base, p)))
it = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(base, 'it/*.json')))]
nf = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(base, 'nf/*.json')))]
cli = json.loads(ld('meta/cli.json')['j'])
fech = json.loads(ld('meta/fech.json')['j'])

def q(v):
    if v is None or v == '': return 'null'
    return "'" + str(v).replace("'", "''") + "'"
def num(v): return format(Decimal(str(v)).quantize(Decimal('0.01')), 'f')
chave = lambda s: (s or '').strip().lower()
FORMA = {'Pix': 'pix', 'Boleto': 'boleto', 'Cartão': 'cartao'}

out = ['begin;', "set local search_path = public;"]

# --- comissionados
coms = sorted({(c['n'].strip(), (c.get('r') or 'Vendedor').strip()) for d in it for c in d['coms'] if c.get('n') and c.get('p')})
for k in fech:
    pessoa = k.rsplit('|', 1)[0]
    n, _, r = pessoa.partition(' · ')
    coms.append((n.strip(), (r or 'Vendedor').strip()))
coms = sorted(set(coms))
for n, r in coms:
    out.append(f"insert into comissionados (nome, papel) values ({q(n)}, {q(r)}) on conflict (nome, papel) do nothing;")
out.append("update comissionados set perfil_id = (select id from perfis where papel = 'diretoria' order by created_at limit 1) where nome = 'Matheus Esturrari' and perfil_id is null;")

# --- clientes
nomes = {chave(d['who']): d['who'].strip() for d in it if d['who'].strip()}
for k, v in cli.items():
    nomes.setdefault(k, v['n'])
for k, nome in sorted(nomes.items()):
    m = cli.get(k, {})
    nome = m.get('n') or nome
    out.append(
        "insert into clientes (tipo, nome, cidade, uf, latitude, longitude, telefone, legado_chave) values "
        f"('PF', {q(nome)}, {q(m.get('c'))}, {q(m.get('u'))}, {q(m.get('la'))}, {q(m.get('lo'))}, {q(re.sub(r'[^0-9+]', '', m.get('tel') or '') or None)}, {q(k)}) "
        "on conflict (legado_chave) do nothing;")

# --- notas (faturamento lançado à mão)
nf_num = {}
for n in nf:
    numero = re.sub(r'^NF\s*', '', n['num'].strip()) or n['num'].strip()
    nf_num[n['num'].strip()] = n['id']
    cat = 'servico' if n['tipo'].lower().startswith('serv') else 'material'
    out.append(
        "insert into notas_fiscais (tipo, numero, prestador_cnpj, emitida_em, cliente_texto, categoria, origem, "
        "valor_servicos, valor_liquido, legado_id) values "
        f"({q('nfse' if cat == 'servico' else 'nfe')}, {q(numero)}, '{BRT_CNPJ}', {q(n['data'] + 'T12:00:00-03:00')}, "
        f"{q(n.get('cli'))}, '{cat}', 'legado', {num(n['valor'])}, {num(n['valor'])}, {q(n['id'])}) on conflict (legado_id) do nothing;")

# --- títulos a receber
for d in it:
    status = 'pago' if d['pago'] else 'aberto'
    cob = d.get('cob') or {}
    nref = (d.get('nfr') or '').strip()
    nf_sql = f"(select id from notas_fiscais where legado_id = {q(nf_num[nref])})" if nref in nf_num else 'null'
    out.append(
        "insert into titulos (natureza, descricao, cliente_id, nota_fiscal_id, valor, emissao, vencimento, forma, conta, parcela, "
        "nota_ref, status, pago_em, valor_pago, cobrancas, cobrado_em, legado_id) values "
        f"('receber', {q(d['desc'] or d['who'] or 'Lançamento')}, (select id from clientes where legado_chave = {q(chave(d['who']))}), {nf_sql}, "
        f"{num(d['valor'])}, {q(d['venc'])}, {q(d['venc'])}, {q(FORMA.get(d['forma'], 'outro'))}, {q(d.get('conta'))}, {q(d.get('par'))}, "
        f"{q(nref)}, '{status}', {q(d['pago'] or None)}, {num(d['valor']) if d['pago'] else 'null'}, {int(cob.get('n') or 0)}, {q(cob.get('u'))}, {q(d['id'])}) "
        "on conflict (legado_id) do nothing;")
    for c in d['coms']:
        if not (c.get('n') and c.get('p')): continue
        out.append(
            "insert into titulo_comissoes (titulo_id, comissionado_id, percentual) values "
            f"((select id from titulos where legado_id = {q(d['id'])}), "
            f"(select id from comissionados where nome = {q(c['n'].strip())} and papel = {q((c.get('r') or 'Vendedor').strip())}), {c['p']}) "
            "on conflict do nothing;")

# --- fechamentos de comissão
for k, data in fech.items():
    pessoa, mes = k.rsplit('|', 1)
    n, _, r = pessoa.partition(' · ')
    out.append(
        "insert into comissao_fechamentos (comissionado_id, mes, fechado_em) values "
        f"((select id from comissionados where nome = {q(n.strip())} and papel = {q((r or 'Vendedor').strip())}), {q(mes + '-01')}, {q(data)}) "
        "on conflict do nothing;")

# --- conferência: totais têm de bater exatamente com o v38
tot = sum(Decimal(str(d['valor'])) for d in it)
pago = sum(Decimal(str(d['valor'])) for d in it if d['pago'])
ncom = sum(1 for d in it for c in d['coms'] if c.get('n') and c.get('p'))
tnf = sum(Decimal(str(n['valor'])) for n in nf)
out.append(f"""do $$
declare a numeric; b numeric; c int; d int; e numeric; f int;
begin
  select coalesce(sum(valor),0), count(*) into a, c from titulos where legado_id is not null;
  select coalesce(sum(valor),0) into b from titulos where legado_id is not null and status = 'pago';
  select count(*) into d from titulo_comissoes tc join titulos t on t.id = tc.titulo_id where t.legado_id is not null;
  select coalesce(sum(valor_servicos),0), count(*) into e, f from notas_fiscais where legado_id is not null;
  if c <> {len(it)} then raise exception 'Lançamentos: % migrados, esperado {len(it)}', c; end if;
  if a <> {num(tot)} then raise exception 'Total: %, esperado {num(tot)}', a; end if;
  if b <> {num(pago)} then raise exception 'Recebido: %, esperado {num(pago)}', b; end if;
  if d <> {ncom} then raise exception 'Regras de comissão: %, esperado {ncom}', d; end if;
  if f <> {len(nf)} or e <> {num(tnf)} then raise exception 'NFs: % / %, esperado {len(nf)} / {num(tnf)}', f, e; end if;
  if exists (select 1 from titulos where legado_id is not null and cliente_id is null and descricao <> '') and
     (select count(*) from titulos where legado_id is not null and cliente_id is null) > {sum(1 for d in it if not d['who'].strip())} then
    raise exception 'Há lançamentos sem cliente vinculado';
  end if;
  raise notice 'Conferência OK: % lançamentos, total %, recebido %, % regras de comissão, % NFs', c, a, b, d, f;
end $$;""")
out.append('commit;')
out.append(f"-- esperado: {len(it)} lançamentos | total {num(tot)} | recebido {num(pago)} | aberto {num(tot - pago)} | {ncom} regras | {len(nf)} NFs ({num(tnf)}) | {len(fech)} fechamentos")
print('\n'.join(out))
