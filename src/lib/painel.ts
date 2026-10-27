/* Indicadores da home do Núcleo.
 * Lê os mesmos documentos do Financeiro v38 (fin_docs) e aplica exatamente
 * as regras dele: valor recebido = vp quando informado, situação por data,
 * comissão sobre cada parcela recebida no mês do recebimento.
 */
import { modoDemo, supabase } from "./supabase";

export type Item = {
  id: string; t: "r" | "p"; desc: string; who: string; forma: string; valor: number; venc: string;
  pago: string | null; vp?: number | string | null; par?: string; nfr?: string; conta?: string;
  coms?: { n: string; r?: string; p: number }[]; com?: string; pct?: number;
};
export type NotaFin = { id: string; num: string; data: string; valor: number; tipo: string; cli?: string };
export type CliMeta = Record<string, { n?: string; c?: string; u?: string; la?: number; lo?: number; tel?: string }>;
export type Dados = { it: Item[]; nf: NotaFin[]; fech: Record<string, string>; cli: CliMeta };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ym = (s: string) => s.slice(0, 7);
const addDias = (s: string, n: number) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const addMeses = (m: string, n: number) => { const d = new Date(m + "-01T12:00:00"); d.setMonth(d.getMonth() + n); return iso(d).slice(0, 7); };
export const vr = (i: Item) => (i.pago && i.vp != null && i.vp !== "" ? Number(i.vp) : Number(i.valor));
export const situacao = (i: Item, hoje: string) => (i.pago ? "pago" : i.venc < hoje ? "atrasado" : "aberto");
const soma = (a: Item[]) => a.reduce((s, i) => s + vr(i), 0);
const nm = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();
const chave = (s: string) => nm(s).toLowerCase();
const comissoes = (i: Item) => (i.coms ?? (i.com ? [{ n: i.com, r: "", p: Number(i.pct) }] : [])).filter((c) => c.n && c.p);
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const rotuloMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

export type Resumo = ReturnType<typeof resumir>;

export function resumir(d: Dados, hoje = iso(new Date())) {
  const R = d.it.filter((i) => i.t === "r");
  const mes = ym(hoje), ano = hoje.slice(0, 4), mesAnt = addMeses(mes, -1);

  const recebidoMes = soma(R.filter((i) => i.pago && ym(i.pago) === mes));
  const recebidoMesAnt = soma(R.filter((i) => i.pago && ym(i.pago) === mesAnt));
  const previstoMes = soma(R.filter((i) => ym(i.venc) === mes));
  const abertoMes = soma(R.filter((i) => ym(i.venc) === mes && situacao(i, hoje) === "aberto"));
  const atrasadoMes = soma(R.filter((i) => ym(i.venc) === mes && situacao(i, hoje) === "atrasado"));
  const aberto = soma(R.filter((i) => situacao(i, hoje) === "aberto"));
  const atrasadoL = R.filter((i) => situacao(i, hoje) === "atrasado");
  const atrasado = soma(atrasadoL);
  const prox7 = R.filter((i) => !i.pago && i.venc >= hoje && i.venc <= addDias(hoje, 7));
  const prox30 = R.filter((i) => !i.pago && i.venc >= hoje && i.venc <= addDias(hoje, 30));
  const recebidoAno = soma(R.filter((i) => i.pago && i.pago.slice(0, 4) === ano));
  const pagos12 = R.filter((i) => i.pago && i.pago >= addDias(hoje, -365));
  const pontualidade = pagos12.length ? (pagos12.filter((i) => i.pago! <= i.venc).length / pagos12.length) * 100 : null;

  // fluxo: 8 meses para trás, mês atual e 4 à frente
  const fluxo = Array.from({ length: 13 }, (_, k) => {
    const m = addMeses(mes, k - 8);
    return {
      mes: m, rotulo: rotuloMes(m), atual: m === mes,
      recebido: soma(R.filter((i) => i.pago && ym(i.pago) === m)),
      previsto: soma(R.filter((i) => ym(i.venc) === m)),
      aberto: soma(R.filter((i) => !i.pago && ym(i.venc) === m)),
    };
  });

  // faturamento NF (12 meses), material x serviço
  const faturamento = Array.from({ length: 12 }, (_, k) => {
    const m = addMeses(mes, k - 11);
    const L = d.nf.filter((n) => ym(n.data) === m);
    const serv = L.filter((n) => /serv/i.test(n.tipo)).reduce((s, n) => s + Number(n.valor), 0);
    const mat = L.filter((n) => !/serv/i.test(n.tipo)).reduce((s, n) => s + Number(n.valor), 0);
    return { mes: m, rotulo: rotuloMes(m), material: mat, servico: serv, total: mat + serv, notas: L.length };
  });
  const nfAno = d.nf.filter((n) => n.data.slice(0, 4) === ano);
  const faturadoAno = nfAno.reduce((s, n) => s + Number(n.valor), 0);
  const faturadoMes = faturamento.at(-1)!.total;
  const ultimasNotas = [...d.nf].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 5);

  // comissões (mesma regra do v38)
  const pessoas = new Map<string, { nome: string; papel: string; mes: number; aFechar: number; previsto: number; fechado: boolean }>();
  for (const i of R) for (const c of comissoes(i)) {
    const papel = c.r || "Vendedor";
    const k = papel === "Vendedor" ? `${c.n} · Vendedor` : `${c.n} · ${papel}`;
    const m = i.pago ? ym(i.pago) : ym(i.venc);
    if (m !== mes) continue;
    const a = (vr(i) * c.p) / 100;
    const p = pessoas.get(k) ?? { nome: c.n, papel, mes: 0, aFechar: 0, previsto: 0, fechado: !!d.fech[`${k}|${mes}`] };
    if (i.pago) { p.mes += a; if (!p.fechado) p.aFechar += a; } else p.previsto += a;
    pessoas.set(k, p);
  }
  const comissoesMes = [...pessoas.values()].sort((a, b) => b.mes + b.previsto - (a.mes + a.previsto));

  // carteira: clientes por valor em aberto e por total contratado
  const porCliente = new Map<string, { nome: string; total: number; aberto: number; atrasado: number; parcelas: number }>();
  for (const i of R) {
    const w = nm(i.who) || "(sem cliente)";
    const c = porCliente.get(w) ?? { nome: w, total: 0, aberto: 0, atrasado: 0, parcelas: 0 };
    c.total += vr(i); c.parcelas++;
    const s = situacao(i, hoje);
    if (s === "aberto") c.aberto += vr(i); else if (s === "atrasado") c.atrasado += vr(i);
    porCliente.set(w, c);
  }
  const clientes = [...porCliente.values()];
  const topAberto = clientes.filter((c) => c.aberto + c.atrasado > 0).sort((a, b) => b.aberto + b.atrasado - (a.aberto + a.atrasado)).slice(0, 6);
  const clientesAtivos = clientes.filter((c) => c.aberto + c.atrasado > 0).length;

  // regiões atendidas (cadastro de cidade/UF do v38)
  const regioes = new Map<string, { cidade: string; uf: string; clientes: number; total: number }>();
  for (const c of clientes) {
    const m = d.cli[chave(c.nome)];
    if (!m?.c) continue;
    const k = `${m.c}/${m.u ?? ""}`;
    const r = regioes.get(k) ?? { cidade: m.c, uf: m.u ?? "", clientes: 0, total: 0 };
    r.clientes++; r.total += c.total;
    regioes.set(k, r);
  }
  const topRegioes = [...regioes.values()].sort((a, b) => b.total - a.total).slice(0, 6);

  // idade da inadimplência
  const dias = (i: Item) => Math.round((new Date(hoje + "T12:00:00").getTime() - new Date(i.venc + "T12:00:00").getTime()) / 86_400_000);
  const aging = [
    { rotulo: "1–15 dias", valor: soma(atrasadoL.filter((i) => dias(i) <= 15)) },
    { rotulo: "16–30 dias", valor: soma(atrasadoL.filter((i) => dias(i) > 15 && dias(i) <= 30)) },
    { rotulo: "31–60 dias", valor: soma(atrasadoL.filter((i) => dias(i) > 30 && dias(i) <= 60)) },
    { rotulo: "+60 dias", valor: soma(atrasadoL.filter((i) => dias(i) > 60)) },
  ];

  const formas = ["Pix", "Boleto", "Cartão", "Transferência"].map((f) => ({ forma: f, valor: soma(R.filter((i) => i.forma === f && !i.pago)) })).filter((f) => f.valor > 0);

  const proximos = R.filter((i) => !i.pago).sort((a, b) => a.venc.localeCompare(b.venc)).slice(0, 7)
    .map((i) => ({ id: i.id, desc: i.desc, who: i.who, par: i.par ?? "", forma: i.forma, valor: vr(i), venc: i.venc, atrasado: i.venc < hoje }));

  return {
    hoje, mes, recebidoMes, recebidoMesAnt, previstoMes, abertoMes, atrasadoMes, aberto, atrasado,
    atrasadoQtd: atrasadoL.length, prox7: { qtd: prox7.length, valor: soma(prox7) }, prox30: soma(prox30),
    recebidoAno, pontualidade, fluxo, faturamento, faturadoAno, faturadoMes, notasAno: nfAno.length, ultimasNotas,
    comissoesMes, topAberto, clientesAtivos, clientesTotal: clientes.length, topRegioes,
    cidadesAtendidas: regioes.size, aging, formas, proximos, lancamentos: R.length,
  };
}

// ---------------------------------------------------------------- leitura
export async function carregarDadosFinanceiro(): Promise<Dados> {
  if (modoDemo) return DEMO;
  const db = supabase();
  const linhas: { colecao: string; id: string; dados: unknown }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("fin_docs").select("colecao, id, dados").in("colecao", ["it", "nf", "meta"]).order("colecao").order("id").range(de, de + 999);
    if (error) throw error;
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const meta = (id: string) => { const l = linhas.find((x) => x.colecao === "meta" && x.id === id); try { return l ? JSON.parse((l.dados as { j: string }).j) : {}; } catch { return {}; } };
  return {
    it: linhas.filter((l) => l.colecao === "it").map((l) => l.dados as Item),
    nf: linhas.filter((l) => l.colecao === "nf").map((l) => l.dados as NotaFin),
    fech: meta("fech"), cli: meta("cli"),
  };
}

export type Comercial = {
  propostas: { qtd: number; valor: number; recentes: { id: string; numero: string; titulo: string; total: number; data: string; status: string }[] };
  clientes: number; documentos: number;
  crm: { pipeline: number; negociacao: number; negocios: number; hoje: number; followups: number };
};
export async function carregarComercial(): Promise<Comercial> {
  if (modoDemo) return { propostas: { qtd: 1, valor: 265000, recentes: [{ id: "p39", numero: "39", titulo: "Eduardo Attie | Quinta da Baronesa - V5", total: 265000, data: "2026-10-21", status: "enviada" }] }, clientes: 2, documentos: 3, crm: { pipeline: 325000, negociacao: 265000, negocios: 3, hoje: 1, followups: 0 } };
  const db = supabase();
  const agora = new Date(), dia = iso(agora);
  const [prop, cli, doc, opo, atv] = await Promise.all([
    db.from("propostas").select("id, numero, versao, titulo, total_final, data_emissao, status").neq("status", "substituida").order("data_emissao", { ascending: false }).limit(50),
    db.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true),
    db.from("documentos").select("id", { count: "exact", head: true }),
    db.from("oportunidades").select("etapa, valor_estimado").in("etapa", ["lead", "qualificacao", "proposta", "negociacao"]),
    db.from("atividades").select("tipo, quando, concluida").eq("concluida", false).lte("quando", dia + "T23:59:59-03:00"),
  ]);
  const O = opo.data ?? [], A = (atv.data ?? []).map((a) => ({ ...a, dia: iso(new Date(new Date(a.quando).getTime() - 3 * 3600_000 + new Date().getTimezoneOffset() * 60_000)) }));
  const P = prop.data ?? [];
  const abertas = P.filter((p) => ["rascunho", "enviada"].includes(p.status));
  return {
    propostas: {
      qtd: abertas.length, valor: abertas.reduce((s, p) => s + Number(p.total_final), 0),
      recentes: P.slice(0, 4).map((p) => ({ id: p.id, numero: p.numero + (p.versao ? ` ${p.versao}` : ""), titulo: p.titulo, total: Number(p.total_final), data: p.data_emissao, status: p.status })),
    },
    clientes: cli.count ?? 0, documentos: doc.count ?? 0,
    crm: {
      pipeline: O.reduce((t, o) => t + Number(o.valor_estimado), 0), negociacao: O.filter((o) => o.etapa === "negociacao").reduce((t, o) => t + Number(o.valor_estimado), 0),
      negocios: O.length, hoje: A.filter((a) => a.dia === dia && !["tarefa", "followup"].includes(a.tipo)).length, followups: A.filter((a) => a.tipo === "followup").length,
    },
  };
}

// demonstração (sem Supabase configurado)
const hojeD = new Date();
const mD = (k: number, dia: number) => iso(new Date(hojeD.getFullYear(), hojeD.getMonth() + k, dia));
const DEMO: Dados = {
  it: [
    ...Array.from({ length: 12 }, (_, k): Item => ({ id: "a" + k, t: "r", desc: "Sidnei Gonçalves · Contrato", who: "Sidnei Gonçalves", forma: "Pix", valor: 11688.63, venc: mD(k - 7, 7), pago: k <= 7 ? mD(k - 7, 9) : null, par: `${k + 1}/12`, coms: [{ n: "Matheus Esturrari", r: "Vendedor", p: 2.28 }] })),
    ...Array.from({ length: 10 }, (_, k): Item => ({ id: "b" + k, t: "r", desc: "H2 Incorporadora · Contrato", who: "H2 Incorporadora", forma: "Boleto", valor: 23358.12, venc: mD(k - 6, 5), pago: k < 6 ? mD(k - 6, 5) : null, par: `${k + 1}/10`, coms: [{ n: "Matheus Esturrari", r: "Vendedor", p: 2.28 }, { n: "Adriano Mendonça", r: "Arquiteto", p: 10 }] })),
    { id: "c1", t: "r", desc: "Antonio Carlos - 202605003", who: "Antonio Carlos", forma: "Boleto", valor: 19333.33, venc: mD(0, 2), pago: null, par: "6/6", coms: [] },
    { id: "c2", t: "r", desc: "Daniel Dias · Contrato", who: "Daniel Dias", forma: "Pix", valor: 4919.36, venc: mD(0, 28), pago: null, par: "7/9", coms: [] },
  ],
  nf: Array.from({ length: 9 }, (_, k) => ({ id: "n" + k, num: "NF " + (1820 + k), data: mD(k - 8, 12), valor: 18000 + k * 3500, tipo: k % 3 ? "Material" : "Serviço" })),
  fech: {},
  cli: { "sidnei gonçalves": { c: "Campinas", u: "SP" }, "h2 incorporadora": { c: "Paulínia", u: "SP" }, "antonio carlos": { c: "Valinhos", u: "SP" }, "daniel dias": { c: "Campinas", u: "SP" } },
};

/** Resumo para a home. */
export async function resumoContratos() {
  if (modoDemo) return { aguardando: 0, semFinanceiro: 0 };
  const { data, error } = await supabase().from("contratos").select("status, financeiro_lancado_em");
  if (error) throw error;
  const l = data ?? [];
  return { aguardando: l.filter((c) => c.status === "enviado").length, semFinanceiro: l.filter((c) => c.status === "assinado" && !c.financeiro_lancado_em).length };
}
