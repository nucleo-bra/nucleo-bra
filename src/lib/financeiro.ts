"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco chegam sem tipo; convertidas campo a campo */
import { modoDemo, supabase } from "./supabase";

export type Titulo = {
  id: string; descricao: string; cliente_id: string | null; cliente: string; telefone: string | null;
  valor: number; valor_pago: number | null; vencimento: string; pago_em: string | null;
  status: "aberto" | "pago" | "cancelado"; forma: string | null; conta: string | null; parcela: string | null;
  nota: string | null; cobrancas: number; cobrado_em: string | null; linha_digitavel: string | null;
  comissoes: { nome: string; papel: string; percentual: number }[];
};
export type Nota = { id: string; numero: string; emitida_em: string; valor: number; categoria: string | null; cliente: string; origem: string };
export type ComissaoLinha = {
  titulo_id: string; comissionado_id: string; comissionado: string; papel: string; mes: string; pago_em: string;
  descricao: string; cliente: string | null; base: number; percentual: number; valor: number; fechado_em: string | null;
};
export type Comissionado = { id: string; nome: string; papel: string };

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const situacao = (t: Pick<Titulo, "status" | "vencimento">) =>
  t.status === "pago" ? "pago" : t.status === "cancelado" ? "cancelado" : t.vencimento < hojeIso() ? "vencido" : "aberto";

// ---------------------------------------------------------------- demonstração
const DEMO_TIT: Titulo[] = [
  { id: "d1", descricao: "NF 1832 — OC 2288860", cliente_id: "demo-plaenge", cliente: "PLAENGE EMPREENDIMENTOS LTDA", telefone: null, valor: 4409.2, valor_pago: null,
    vencimento: "2026-12-10", pago_em: null, status: "aberto", forma: "boleto", conta: null, parcela: null, nota: "1832", cobrancas: 0, cobrado_em: null,
    linha_digitavel: "34191.09008 00031.861610 93668.650000 8 16560000440920", comissoes: [] },
  { id: "d2", descricao: "Antonio Carlos - 202605003", cliente_id: null, cliente: "Antonio Carlos", telefone: null, valor: 19333.33, valor_pago: null,
    vencimento: "2026-10-28", pago_em: null, status: "aberto", forma: "boleto", conta: "Boleto", parcela: "6/6", nota: null, cobrancas: 1, cobrado_em: "2026-10-26",
    linha_digitavel: null, comissoes: [{ nome: "Adriano Mendonça", papel: "Arquiteto", percentual: 10 }, { nome: "Matheus Esturrari", papel: "Vendedor", percentual: 2.28 }] },
  { id: "d3", descricao: "Mauricio Mendes - Contrato", cliente_id: null, cliente: "Mauricio Mendes", telefone: null, valor: 2000, valor_pago: 2000,
    vencimento: "2026-10-10", pago_em: "2026-10-12", status: "pago", forma: "pix", conta: "Pix Fernando", parcela: "Contrato", nota: null, cobrancas: 0, cobrado_em: null,
    linha_digitavel: null, comissoes: [{ nome: "Matheus Esturrari", papel: "Vendedor", percentual: 2.28 }] },
];

// ---------------------------------------------------------------- consultas
export async function listarTitulos(f: { de?: string; ate?: string; status?: string; busca?: string }): Promise<Titulo[]> {
  if (modoDemo) return DEMO_TIT;
  let q = supabase().from("titulos")
    .select("id, descricao, cliente_id, valor, valor_pago, vencimento, pago_em, status, forma, conta, parcela, nota_ref, cobrancas, cobrado_em, linha_digitavel, clientes(nome, nome_fantasia, telefone), notas_fiscais(numero), titulo_comissoes(percentual, comissionados(nome, papel))")
    .eq("natureza", "receber").neq("status", "cancelado").order("vencimento").limit(2000);
  if (f.status === "pago") {
    q = q.eq("status", "pago");
    if (f.de) q = q.gte("pago_em", f.de);
    if (f.ate) q = q.lte("pago_em", f.ate);
  } else {
    if (f.status === "aberto" || f.status === "vencido") q = q.eq("status", "aberto");
    if (f.status === "vencido") q = q.lt("vencimento", hojeIso());
    if (f.de) q = q.gte("vencimento", f.de);
    if (f.ate) q = q.lte("vencimento", f.ate);
  }
  if (f.busca?.trim()) q = q.ilike("descricao", `%${f.busca.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    id: t.id, descricao: t.descricao, cliente_id: t.cliente_id,
    cliente: t.clientes?.nome_fantasia ?? t.clientes?.nome ?? "—", telefone: t.clientes?.telefone ?? null,
    valor: n(t.valor), valor_pago: t.valor_pago === null ? null : n(t.valor_pago), vencimento: t.vencimento, pago_em: t.pago_em,
    status: t.status, forma: t.forma, conta: t.conta, parcela: t.parcela, nota: t.notas_fiscais?.numero ?? (t.nota_ref || null),
    cobrancas: t.cobrancas, cobrado_em: t.cobrado_em, linha_digitavel: t.linha_digitavel,
    comissoes: (t.titulo_comissoes ?? []).map((c: any) => ({ nome: c.comissionados?.nome, papel: c.comissionados?.papel, percentual: n(c.percentual) })),
  }));
}

export async function baixarTitulo(id: string, pagoEm: string, valor: number) {
  if (modoDemo) return;
  const { error } = await supabase().rpc("baixar_titulo", { p_titulo: id, p_pago_em: pagoEm, p_valor: valor });
  if (error) throw error;
}
export async function estornarBaixa(id: string) {
  if (modoDemo) return;
  const { error } = await supabase().rpc("estornar_baixa", { p_titulo: id });
  if (error) throw error;
}
export async function registrarCobranca(id: string, clienteId: string | null, telefone: string | null) {
  if (modoDemo) return;
  const db = supabase();
  if (clienteId && telefone) await db.from("clientes").update({ telefone }).eq("id", clienteId);
  const { error } = await db.rpc("registrar_cobranca", { p_titulo: id });
  if (error) throw error;
}
export async function criarLancamento(p: Record<string, unknown>) {
  if (modoDemo) return 0;
  const { data, error } = await supabase().rpc("criar_lancamento", { p });
  if (error) throw error;
  return data as number;
}

export async function listarNotas(de: string, ate: string): Promise<Nota[]> {
  if (modoDemo) return [{ id: "n1", numero: "1832", emitida_em: "2026-10-26T16:18:31-03:00", valor: 4409.2, categoria: "servico", cliente: "Plaenge", origem: "xml" }];
  const { data, error } = await supabase().from("notas_fiscais")
    .select("id, numero, emitida_em, valor_servicos, categoria, cliente_texto, origem, clientes(nome, nome_fantasia)")
    .eq("status", "emitida").gte("emitida_em", de).lte("emitida_em", ate + "T23:59:59").order("emitida_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((x: any) => ({
    id: x.id, numero: x.numero, emitida_em: x.emitida_em, valor: n(x.valor_servicos), categoria: x.categoria, origem: x.origem,
    cliente: x.clientes?.nome_fantasia ?? x.clientes?.nome ?? x.cliente_texto ?? "—",
  }));
}

export async function listarComissoes(de: string, ate: string): Promise<ComissaoLinha[]> {
  if (modoDemo) return [
    { titulo_id: "d3", comissionado_id: "c1", comissionado: "Matheus Esturrari", papel: "Vendedor", mes: "2026-10-01", pago_em: "2026-10-12",
      descricao: "Mauricio Mendes - Contrato", cliente: "Mauricio Mendes", base: 2000, percentual: 2.28, valor: 45.6, fechado_em: null },
  ];
  const { data, error } = await supabase().from("comissoes_apuradas").select("*").gte("mes", de).lte("mes", ate).order("pago_em", { ascending: false }).limit(5000);
  if (error) throw error;
  return (data ?? []).map((x: any) => ({ ...x, base: n(x.base), percentual: n(x.percentual), valor: n(x.valor) }));
}
export async function fecharComissao(comissionadoId: string, mes: string, valor: number) {
  if (modoDemo) return;
  const { error } = await supabase().from("comissao_fechamentos").insert({ comissionado_id: comissionadoId, mes, valor, fechado_em: hojeIso() });
  if (error) throw error;
}
export async function reabrirComissao(comissionadoId: string, mes: string) {
  if (modoDemo) return;
  const { error } = await supabase().from("comissao_fechamentos").delete().eq("comissionado_id", comissionadoId).eq("mes", mes);
  if (error) throw error;
}
export async function listarComissionados(): Promise<Comissionado[]> {
  if (modoDemo) return [{ id: "c1", nome: "Matheus Esturrari", papel: "Vendedor" }, { id: "c2", nome: "Adriano Mendonça", papel: "Arquiteto" }];
  const { data, error } = await supabase().from("comissionados").select("id, nome, papel").eq("ativo", true).order("nome");
  if (error) throw error;
  return data ?? [];
}
export async function buscarClientes(termo: string): Promise<{ id: string; nome: string }[]> {
  if (modoDemo || termo.trim().length < 2) return [];
  const { data } = await supabase().from("clientes").select("id, nome").ilike("nome", `%${termo.trim()}%`).order("nome").limit(8);
  return data ?? [];
}

// ---------------------------------------------------------------- períodos
export type Granularidade = "mes" | "tri" | "sem" | "ano";
export function periodo(g: Granularidade, desloc: number, ref = new Date()) {
  const tam = { mes: 1, tri: 3, sem: 6, ano: 12 }[g];
  const atual = ref.getFullYear() * 12 + ref.getMonth();
  const ini = Math.floor(atual / tam) * tam + desloc * tam;
  const y = Math.floor(ini / 12), m = ini % 12;
  const fimIdx = ini + tam - 1, fy = Math.floor(fimIdx / 12), fm = fimIdx % 12;
  const ultimo = new Date(fy, fm + 1, 0).getDate();
  const pad = (x: number) => String(x).padStart(2, "0");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const rotulo = g === "mes" ? `${meses[m]} ${y}` : g === "tri" ? `${m / 3 + 1}º tri ${y}` : g === "sem" ? `${m / 6 + 1}º sem ${y}` : `${y}`;
  return { de: `${y}-${pad(m + 1)}-01`, ate: `${fy}-${pad(fm + 1)}-${pad(ultimo)}`, rotulo };
}
