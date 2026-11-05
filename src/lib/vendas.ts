// Números de vendas do CRM por período: fechamentos, comparativos, funil,
// previsão e rankings. Data do fechamento = fechada_em (ou a previsão, data_ref).
import type { Negocio } from "./crm";

export type Grao = "m" | "t" | "s" | "a";
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const TAM: Record<Grao, number> = { m: 1, t: 3, s: 6, a: 12 };
/** quantos períodos aparecem no gráfico */
export const QTD_SERIE: Record<Grao, number> = { m: 12, t: 8, s: 6, a: 5 };

export const dataFechamento = (n: Pick<Negocio, "fechada_em" | "data_ref">) => (n.fechada_em ? n.fechada_em.slice(0, 10) : n.data_ref.slice(0, 10));

/** índice do período (meses desde o ano 0 ÷ tamanho) */
export const indiceDe = (iso: string, g: Grao) => { const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1; return Math.floor((y * 12 + m) / TAM[g]); };
export const indiceHoje = (g: Grao, hoje = new Date()) => Math.floor((hoje.getFullYear() * 12 + hoje.getMonth()) / TAM[g]);

export function rotuloPeriodo(i: number, g: Grao, curto = false) {
  const ini = i * TAM[g], y = Math.floor(ini / 12), m = ini % 12;
  const yy = curto ? String(y).slice(2) : String(y);
  return g === "m" ? `${MES[m]}${curto ? "/" : "/"}${yy}` : g === "t" ? `${m / 3 + 1}º tri${curto ? " " : " "}${yy}` : g === "s" ? `${m / 6 + 1}º sem ${yy}` : String(y);
}
/** primeiro e último dia (AAAA-MM-DD) do período */
export function limites(i: number, g: Grao) {
  const ini = i * TAM[g], fim = ini + TAM[g] - 1;
  const d = (k: number) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
  const ultimo = new Date(Math.floor(fim / 12), (fim % 12) + 1, 0).getDate();
  return { de: `${d(ini)}-01`, ate: `${d(fim)}-${String(ultimo).padStart(2, "0")}` };
}
/** o mesmo período um ano antes */
export const anoAntes = (i: number, g: Grao) => i - 12 / TAM[g];

export type Ponto = { i: number; rot: string; valor: number; qtd: number; anoAnterior: number; ticket: number };

export function serie(negocios: Negocio[], g: Grao, fim: number, n = QTD_SERIE[g]): Ponto[] {
  const ganhos = negocios.filter((x) => x.etapa === "ganho");
  const soma = new Map<number, { v: number; q: number }>();
  for (const x of ganhos) { const k = indiceDe(dataFechamento(x), g); const s = soma.get(k) ?? { v: 0, q: 0 }; s.v += x.valor_estimado; s.q++; soma.set(k, s); }
  return Array.from({ length: n }, (_, j) => {
    const i = fim - (n - 1) + j, s = soma.get(i) ?? { v: 0, q: 0 };
    return { i, rot: rotuloPeriodo(i, g, true), valor: s.v, qtd: s.q, anoAnterior: g === "a" ? 0 : soma.get(anoAntes(i, g))?.v ?? 0, ticket: s.q ? s.v / s.q : 0 };
  });
}

export type Resumo = {
  vendido: number; qtd: number; ticket: number; anterior: number; varAnterior: number | null; anoAnterior: number; varAno: number | null;
  perdidos: number; valorPerdido: number; conversao: number | null; comissaoMinha: number; comissaoParceiros: number; aPagarParceiros: number;
};
export function resumir(negocios: Negocio[], g: Grao, i: number): Resumo {
  const no = (k: number, etapa: string) => negocios.filter((x) => x.etapa === etapa && indiceDe(dataFechamento(x), g) === k);
  const G = no(i, "ganho"), P = no(i, "perdido");
  const soma = (L: Negocio[]) => L.reduce((s, x) => s + x.valor_estimado, 0);
  const vendido = soma(G), anterior = soma(no(i - 1, "ganho")), ano = g === "a" ? anterior : soma(no(anoAntes(i, g), "ganho"));
  const vari = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);
  return {
    vendido, qtd: G.length, ticket: G.length ? vendido / G.length : 0, anterior, varAnterior: vari(vendido, anterior), anoAnterior: ano, varAno: vari(vendido, ano),
    perdidos: P.length, valorPerdido: soma(P), conversao: G.length + P.length ? (G.length / (G.length + P.length)) * 100 : null,
    comissaoMinha: G.reduce((s, x) => s + (x.valor_estimado * x.pct_vendedor) / 100, 0),
    comissaoParceiros: G.reduce((s, x) => s + (x.valor_estimado * x.pct_parceiro) / 100, 0),
    aPagarParceiros: G.filter((x) => x.pct_parceiro && !x.comissao_parceiro_paga).reduce((s, x) => s + (x.valor_estimado * x.pct_parceiro) / 100, 0),
  };
}

/** acumulado do ano mês a mês, ano atual × anterior */
export function acumuladoAno(negocios: Negocio[], ano: number) {
  const porMes = (a: number) => { const m = Array(12).fill(0); for (const x of negocios) if (x.etapa === "ganho") { const d = dataFechamento(x); if (Number(d.slice(0, 4)) === a) m[Number(d.slice(5, 7)) - 1] += x.valor_estimado; } return m; };
  const A = porMes(ano), B = porMes(ano - 1), hoje = new Date();
  let sa = 0, sb = 0;
  return MES.map((rot, k) => { sa += A[k]; sb += B[k]; return { rot, atual: ano < hoje.getFullYear() || k <= hoje.getMonth() ? sa : null, anterior: sb }; });
}

/** negócios abertos pela previsão de fechamento, nos próximos períodos */
export function previsao(negocios: Negocio[], g: Grao, desde: number, n = 6) {
  const abertos = negocios.filter((x) => !["ganho", "perdido"].includes(x.etapa));
  return Array.from({ length: n }, (_, j) => {
    const i = desde + j, L = abertos.filter((x) => (j === 0 ? indiceDe(x.data_ref, g) <= i : indiceDe(x.data_ref, g) === i));
    const por = (e: string) => L.filter((x) => x.etapa === e).reduce((s, x) => s + x.valor_estimado, 0);
    return { i, rot: rotuloPeriodo(i, g, true), lead: por("lead") + por("qualificacao"), proposta: por("proposta"), negociacao: por("negociacao"), fechamento: por("fechamento"), qtd: L.length };
  });
}
