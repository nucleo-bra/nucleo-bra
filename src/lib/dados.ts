/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco e nós de XML chegam sem tipo; validamos campo a campo */
"use client";
// Camada de dados: lê do Supabase ou, sem configuração, de um conjunto de
// demonstração montado a partir dos documentos reais (NF 1832, proposta 39).
import { modoDemo, supabase } from "./supabase";

export type Painel = {
  cadeia: { propostas_abertas: number; notas_emitidas_mes: number; a_receber: number; recebido_mes: number };
  financeiro: { a_receber: number; vencido: number; receber_30d: number; a_pagar: number; recebido_mes: number };
  faturamento: { mes: string; faturado: number }[];
  sistemas: { sistema: string; valor: number; propostas: number }[];
  vencimentos: { id: string; descricao: string; cliente: string; valor: number; vencimento: string }[];
  propostas: { id: string; numero: string; versao: string | null; titulo: string; total_final: number; data_emissao: string; status: string }[];
};

export type ClienteResumo = {
  id: string; nome: string; tipo: "PF" | "PJ"; documento: string | null; documento_raiz: string | null;
  cidade: string | null; uf: string | null; projetos: number; a_receber: number; ultima_movimentacao: string | null;
};

export type ClienteFicha = ClienteResumo & {
  email: string | null; telefone: string | null; inscricao_municipal: string | null;
  projetos_lista: { id: string; nome: string; status: string }[];
  propostas: Painel["propostas"];
  notas: { id: string; numero: string; tipo: string; emitida_em: string; valor_servicos: number; status: string; ordem_compra: string | null }[];
  titulos: { id: string; descricao: string; valor: number; vencimento: string; status: string; linha_digitavel: string | null }[];
  filiais: { id: string; nome: string; documento: string | null }[];
  negocios?: { id: string; numero: number | null; titulo: string; etapa: string; valor_estimado: number }[];
};

const n = (v: unknown) => Number(v ?? 0);

// ---------------------------------------------------------------- demonstração
const DEMO_CLIENTES: ClienteFicha[] = [
  {
    id: "demo-plaenge", nome: "PLAENGE EMPREENDIMENTOS LTDA", tipo: "PJ", documento: "78638061008908", documento_raiz: "78638061",
    cidade: "Campinas", uf: "SP", projetos: 1, a_receber: 4409.2, ultima_movimentacao: "2026-10-26",
    email: "f.tavares@plaenge.com.br", telefone: "4332941000", inscricao_municipal: "00484010-0",
    projetos_lista: [{ id: "p1", nome: "The Mark", status: "pos_venda" }],
    propostas: [],
    notas: [{ id: "nf1832", numero: "1832", tipo: "nfse", emitida_em: "2026-10-26T16:18:31-03:00", valor_servicos: 4409.2, status: "emitida", ordem_compra: "2288860" }],
    titulos: [{ id: "t1832", descricao: "NF 1832 — OC 2288860", valor: 4409.2, vencimento: "2026-12-10", status: "aberto", linha_digitavel: "34191.09008 00031.861610 93668.650000 8 16560000440920" }],
    filiais: [],
  },
  {
    id: "demo-attie", nome: "Eduardo Attie", tipo: "PF", documento: null, documento_raiz: null,
    cidade: "Campinas", uf: "SP", projetos: 1, a_receber: 0, ultima_movimentacao: "2026-10-21",
    email: null, telefone: null, inscricao_municipal: null,
    projetos_lista: [{ id: "p2", nome: "Quinta da Baronesa", status: "em_negociacao" }],
    propostas: [{ id: "prop39", numero: "39", versao: "V5", titulo: "Eduardo Attie | Quinta da Baronesa - V5", total_final: 265000, data_emissao: "2026-10-21", status: "enviada" }],
    notas: [], titulos: [], filiais: [],
  },
];

const DEMO_PAINEL: Painel = {
  cadeia: { propostas_abertas: 265000, notas_emitidas_mes: 4409.2, a_receber: 4409.2, recebido_mes: 0 },
  financeiro: { a_receber: 4409.2, vencido: 0, receber_30d: 0, a_pagar: 0, recebido_mes: 0 },
  faturamento: [{ mes: "2026-10-01", faturado: 4409.2 }],
  sistemas: [
    { sistema: "Automação", valor: 101728.72, propostas: 1 },
    { sistema: "Home Theater", valor: 61111.12, propostas: 1 },
    { sistema: "Sonorização", valor: 39570.05, propostas: 1 },
    { sistema: "Mão de Obra", valor: 37124.13, propostas: 1 },
    { sistema: "Rede Estruturada", valor: 18975.18, propostas: 1 },
    { sistema: "Segurança", valor: 6490.8, propostas: 1 },
  ],
  vencimentos: [{ id: "t1832", descricao: "NF 1832 — OC 2288860", cliente: "Plaenge Empreendimentos", valor: 4409.2, vencimento: "2026-12-10" }],
  propostas: DEMO_CLIENTES[1].propostas,
};

// ---------------------------------------------------------------- consultas
export async function carregarPainel(): Promise<Painel> {
  if (modoDemo) return DEMO_PAINEL;
  const db = supabase();
  const inicioMes = new Date(); inicioMes.setDate(1);
  const [fin, fat, sis, venc, prop, nfMes] = await Promise.all([
    db.from("painel_financeiro").select("*").single(),
    db.from("faturamento_mensal").select("*").order("mes", { ascending: false }).limit(12),
    db.from("vendas_por_sistema").select("*").order("valor", { ascending: false }),
    db.from("titulos").select("id, descricao, valor, vencimento, clientes(nome, nome_fantasia)")
      .eq("natureza", "receber").eq("status", "aberto").order("vencimento").limit(8),
    db.from("propostas").select("id, numero, versao, titulo, total_final, data_emissao, status")
      .neq("status", "substituida").order("data_emissao", { ascending: false }).limit(8),
    db.from("notas_fiscais").select("valor_servicos").eq("status", "emitida").gte("emitida_em", inicioMes.toISOString().slice(0, 10)),
  ]);
  for (const r of [fin, fat, sis, venc, prop, nfMes]) if (r.error) throw r.error;
  const f = fin.data!;
  const abertas = (prop.data ?? []).filter((p) => ["rascunho", "enviada"].includes(p.status));
  return {
    cadeia: {
      propostas_abertas: abertas.reduce((s, p) => s + n(p.total_final), 0),
      notas_emitidas_mes: (nfMes.data ?? []).reduce((s, x) => s + n(x.valor_servicos), 0),
      a_receber: n(f.a_receber),
      recebido_mes: n(f.recebido_mes),
    },
    financeiro: { a_receber: n(f.a_receber), vencido: n(f.vencido), receber_30d: n(f.receber_30d), a_pagar: n(f.a_pagar), recebido_mes: n(f.recebido_mes) },
    faturamento: (fat.data ?? []).reverse().map((x) => ({ mes: x.mes, faturado: n(x.faturado) })),
    sistemas: (sis.data ?? []).map((x) => ({ sistema: x.sistema, valor: n(x.valor), propostas: n(x.propostas) })),
    vencimentos: (venc.data ?? []).map((t: any) => ({
      id: t.id, descricao: t.descricao, valor: n(t.valor), vencimento: t.vencimento,
      cliente: t.clientes?.nome_fantasia ?? t.clientes?.nome ?? "—",
    })),
    propostas: (prop.data ?? []).map((p) => ({ ...p, total_final: n(p.total_final) })),
  };
}

export async function listarClientes(busca = ""): Promise<ClienteResumo[]> {
  const termo = busca.trim().toLowerCase();
  if (modoDemo) return DEMO_CLIENTES.filter((c) => !termo || c.nome.toLowerCase().includes(termo) || (c.documento ?? "").includes(termo));
  let q = supabase().from("clientes")
    .select("id, nome, tipo, documento, documento_raiz, cidade, uf, updated_at, projetos(count), titulos(valor, status, natureza)")
    .eq("ativo", true).order("nome").limit(200);
  if (termo) q = /^\d+$/.test(termo) ? q.like("documento", `${termo}%`) : q.ilike("nome", `%${termo}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id, nome: c.nome, tipo: c.tipo, documento: c.documento, documento_raiz: c.documento_raiz,
    cidade: c.cidade, uf: c.uf, ultima_movimentacao: c.updated_at,
    projetos: c.projetos?.[0]?.count ?? 0,
    a_receber: (c.titulos ?? []).filter((t: any) => t.natureza === "receber" && t.status === "aberto").reduce((s: number, t: any) => s + n(t.valor), 0),
  }));
}

export async function carregarCliente(id: string): Promise<ClienteFicha | null> {
  if (modoDemo) return DEMO_CLIENTES.find((c) => c.id === id) ?? null;
  const db = supabase();
  const { data: c, error } = await db.from("clientes").select("*").eq("id", id).single();
  if (error) throw error;
  const [proj, prop, nf, tit, fil, neg] = await Promise.all([
    db.from("projetos").select("id, nome, status").eq("cliente_id", id).order("created_at"),
    db.from("propostas").select("id, numero, versao, titulo, total_final, data_emissao, status").eq("cliente_id", id).order("data_emissao", { ascending: false }),
    db.from("notas_fiscais").select("id, numero, tipo, emitida_em, valor_servicos, status, ordem_compra").eq("cliente_id", id).order("emitida_em", { ascending: false }),
    db.from("titulos").select("id, descricao, valor, vencimento, status, linha_digitavel").eq("cliente_id", id).order("vencimento", { ascending: false }),
    c.documento_raiz && c.tipo === "PJ"
      ? db.from("clientes").select("id, nome, documento").eq("documento_raiz", c.documento_raiz).neq("id", id)
      : Promise.resolve({ data: [], error: null }),
    db.from("oportunidades").select("id, numero, titulo, etapa, valor_estimado").eq("cliente_id", id).order("created_at", { ascending: false }),
  ]);
  const titulos = (tit.data ?? []).map((t) => ({ ...t, valor: n(t.valor) }));
  return {
    ...c, projetos: proj.data?.length ?? 0, ultima_movimentacao: c.updated_at,
    a_receber: titulos.filter((t) => t.status === "aberto").reduce((s, t) => s + t.valor, 0),
    projetos_lista: proj.data ?? [],
    propostas: (prop.data ?? []).map((p) => ({ ...p, total_final: n(p.total_final) })),
    notas: (nf.data ?? []).map((x) => ({ ...x, valor_servicos: n(x.valor_servicos) })),
    titulos, filiais: (fil.data as any[]) ?? [],
    negocios: (neg.data ?? []).map((x) => ({ ...x, valor_estimado: n(x.valor_estimado) })),
  };
}

export const formatarReais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const formatarReaisCurto = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
  : v >= 10_000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
  : formatarReais(v);
export const formatarData = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("pt-BR");
