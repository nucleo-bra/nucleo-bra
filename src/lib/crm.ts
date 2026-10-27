"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco chegam sem tipo; convertidas campo a campo */
// CRM: parceiros, negócios (oportunidades) e agenda (atividades, follow-ups, tarefas).
// Sem Supabase configurado, tudo roda em memória (modo demonstração).
import { modoDemo, supabase } from "./supabase";

export type EtapaParceiro = "prospeccao" | "contato" | "reuniao" | "ativo" | "inativo";
export type EtapaNegocio = "lead" | "proposta" | "negociacao" | "ganho" | "perdido";
export type TipoAtividade = "reuniao" | "visita" | "ligacao" | "apresentacao" | "orcamento" | "contrato" | "obra" | "outro" | "followup" | "tarefa" | "whatsapp" | "email" | "nota";

export type Parceiro = {
  id: string; nome: string; tipo: string; escritorio: string; telefone: string; email: string; instagram: string;
  cidade: string; comissao_padrao: number; observacoes: string; etapa: EtapaParceiro; ativo: boolean;
};
export type Negocio = {
  id: string; titulo: string; cliente_nome: string; cliente_id: string | null; parceiro_id: string | null; etapa: EtapaNegocio;
  valor_estimado: number; data_ref: string; pct_parceiro: number; pct_vendedor: number; comissao_parceiro_paga: boolean;
  observacoes: string; proxima_acao: string; motivo_perda: string; financeiro_lancado_em: string | null;
};
export type Atividade = {
  id: string; tipo: TipoAtividade; titulo: string; notas: string; data: string; hora: string; dia_todo: boolean;
  concluida: boolean; parceiro_id: string | null; oportunidade_id: string | null; contato: string;
};
export type Crm = { parceiros: Parceiro[]; negocios: Negocio[]; atividades: Atividade[] };

export const ETAPAS_PARCEIRO: [EtapaParceiro, string][] = [
  ["prospeccao", "Prospecção"], ["contato", "Contato feito"], ["reuniao", "Reunião agendada"], ["ativo", "Parceiro ativo"], ["inativo", "Inativo"],
];
export const ETAPAS_NEGOCIO: [EtapaNegocio, string][] = [
  ["lead", "Em aberto"], ["proposta", "Proposta enviada"], ["negociacao", "Em negociação"], ["ganho", "Fechado"], ["perdido", "Perdido"],
];
export const TIPOS_PARCEIRO: [string, string][] = [
  ["arquiteto", "Arquiteto"], ["designer", "Designer"], ["construtor", "Construtor"], ["construtora", "Construtora"],
  ["incorporadora", "Incorporadora"], ["engenheiro", "Engenheiro"], ["outro", "Outro"],
];
export const TIPOS_AGENDA: [TipoAtividade, string][] = [
  ["reuniao", "Reunião"], ["visita", "Visita"], ["ligacao", "Ligação"], ["apresentacao", "Apresentação"],
  ["orcamento", "Orçamento"], ["contrato", "Contrato"], ["obra", "Obra"], ["outro", "Outro"],
];
export const rotulo = (lista: [string, string][], v: string) => lista.find(([k]) => k === v)?.[1] ?? v;

// ---------------------------------------------------------------- datas (horário de Brasília)
const pad = (n: number) => String(n).padStart(2, "0");
export const isoDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoje = () => isoDia(new Date());
export const somaDias = (s: string, n: number) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return isoDia(d); };
const paraQuando = (data: string, hora: string, diaTodo: boolean) => `${data}T${diaTodo || !hora ? "12:00" : hora}:00-03:00`;
function deQuando(q: string) {
  // converte para o relógio de Brasília (UTC-3, sem horário de verão)
  const d = new Date(new Date(q).getTime() - 3 * 3600_000);
  return { data: d.toISOString().slice(0, 10), hora: d.toISOString().slice(11, 16) };
}

// ---------------------------------------------------------------- conversões
const n = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const parceiroDe = (r: any): Parceiro => ({
  id: r.id, nome: r.nome, tipo: r.tipo, escritorio: r.escritorio ?? "", telefone: r.telefone ?? "", email: r.email ?? "",
  instagram: r.instagram ?? "", cidade: r.cidade ?? "", comissao_padrao: n(r.comissao_padrao), observacoes: r.observacoes ?? "",
  etapa: r.etapa ?? "ativo", ativo: r.ativo ?? true,
});
const negocioDe = (r: any): Negocio => ({
  id: r.id, titulo: r.titulo, cliente_nome: r.cliente_nome ?? r.clientes?.nome ?? "", cliente_id: r.cliente_id, parceiro_id: r.parceiro_id,
  etapa: r.etapa, valor_estimado: n(r.valor_estimado), data_ref: r.data_ref, pct_parceiro: n(r.pct_parceiro), pct_vendedor: n(r.pct_vendedor),
  comissao_parceiro_paga: !!r.comissao_parceiro_paga, observacoes: r.observacoes ?? "", proxima_acao: r.proxima_acao ?? "",
  motivo_perda: r.motivo_perda ?? "", financeiro_lancado_em: r.financeiro_lancado_em,
});
const atividadeDe = (r: any): Atividade => {
  const { data, hora } = deQuando(r.quando);
  return {
    id: r.id, tipo: r.tipo, titulo: r.titulo, notas: r.notas ?? "", data, hora: r.dia_todo ? "" : hora, dia_todo: !!r.dia_todo,
    concluida: !!r.concluida, parceiro_id: r.parceiro_id, oportunidade_id: r.oportunidade_id, contato: r.contato ?? "",
  };
};

// ---------------------------------------------------------------- demonstração (em memória)
const uid = () => Math.random().toString(36).slice(2, 10);
const h = hoje();
const DEMO: Crm = {
  parceiros: [
    { id: "p1", nome: "Adriano Mendonça", tipo: "arquiteto", escritorio: "Mendonça Arquitetura", telefone: "(19) 99999-0001", email: "", instagram: "", cidade: "Campinas", comissao_padrao: 10, observacoes: "Parceiro forte em alto padrão.", etapa: "ativo", ativo: true },
    { id: "p2", nome: "Heder | Jennifer", tipo: "designer", escritorio: "Studio HJ", telefone: "", email: "", instagram: "", cidade: "Paulínia", comissao_padrao: 5, observacoes: "", etapa: "ativo", ativo: true },
    { id: "p3", nome: "Camila Rocha", tipo: "arquiteto", escritorio: "CR Interiores", telefone: "", email: "", instagram: "@crinteriores", cidade: "Valinhos", comissao_padrao: 8, observacoes: "", etapa: "prospeccao", ativo: true },
    { id: "p4", nome: "Construtora Alfa", tipo: "construtora", escritorio: "", telefone: "", email: "", instagram: "", cidade: "Campinas", comissao_padrao: 0, observacoes: "", etapa: "contato", ativo: true },
  ],
  negocios: [
    { id: "n1", titulo: "Quinta da Baronesa — automação completa", cliente_nome: "Eduardo Attie", cliente_id: null, parceiro_id: "p1", etapa: "negociacao", valor_estimado: 265000, data_ref: h, pct_parceiro: 10, pct_vendedor: 2.28, comissao_parceiro_paga: false, observacoes: "Aguardando revisão V5.", proxima_acao: "", motivo_perda: "", financeiro_lancado_em: null },
    { id: "n2", titulo: "Home theater sala íntima", cliente_nome: "Rafael Mota", cliente_id: null, parceiro_id: "p2", etapa: "ganho", valor_estimado: 84000, data_ref: h, pct_parceiro: 5, pct_vendedor: 2.28, comissao_parceiro_paga: false, observacoes: "", proxima_acao: "", motivo_perda: "", financeiro_lancado_em: null },
    { id: "n3", titulo: "Rede e Wi-Fi corporativo", cliente_nome: "Gerson Aha", cliente_id: null, parceiro_id: null, etapa: "proposta", valor_estimado: 38000, data_ref: h, pct_parceiro: 0, pct_vendedor: 2.28, comissao_parceiro_paga: false, observacoes: "", proxima_acao: "", motivo_perda: "", financeiro_lancado_em: null },
    { id: "n4", titulo: "Persianas motorizadas", cliente_nome: "Daniel Ortolan", cliente_id: null, parceiro_id: "p1", etapa: "lead", valor_estimado: 22000, data_ref: h, pct_parceiro: 10, pct_vendedor: 2.28, comissao_parceiro_paga: false, observacoes: "", proxima_acao: "", motivo_perda: "", financeiro_lancado_em: null },
  ],
  atividades: [
    { id: "a1", tipo: "reuniao", titulo: "Apresentação showroom kaza+", notas: "", data: h, hora: "10:00", dia_todo: false, concluida: false, parceiro_id: "p1", oportunidade_id: "n1", contato: "" },
    { id: "a2", tipo: "visita", titulo: "Visita escritório CR Interiores", notas: "Gostou do portfólio de cinema.", data: somaDias(h, -2), hora: "15:00", dia_todo: false, concluida: true, parceiro_id: "p3", oportunidade_id: null, contato: "" },
    { id: "a3", tipo: "followup", titulo: "Retornar sobre a V5", notas: "Confirmar escopo do cinema", data: somaDias(h, 1), hora: "", dia_todo: true, concluida: false, parceiro_id: null, oportunidade_id: "n1", contato: "Eduardo Attie" },
    { id: "a4", tipo: "tarefa", titulo: "Enviar portfólio para Construtora Alfa", notas: "", data: h, hora: "", dia_todo: true, concluida: false, parceiro_id: "p4", oportunidade_id: null, contato: "" },
    { id: "a5", tipo: "obra", titulo: "Vistoria The Mark", notas: "", data: somaDias(h, 2), hora: "14:00", dia_todo: false, concluida: false, parceiro_id: null, oportunidade_id: null, contato: "" },
  ],
};

// ---------------------------------------------------------------- leitura
export async function carregarCrm(): Promise<Crm> {
  if (modoDemo) return JSON.parse(JSON.stringify(DEMO));
  const db = supabase();
  const [p, o, a] = await Promise.all([
    db.from("parceiros").select("*").order("nome"),
    db.from("oportunidades").select("*, clientes(nome)").order("data_ref", { ascending: false }).limit(2000),
    db.from("atividades").select("*").gte("quando", new Date(Date.now() - 400 * 86_400_000).toISOString()).order("quando").limit(5000),
  ]);
  for (const r of [p, o, a]) if (r.error) throw r.error;
  return { parceiros: (p.data ?? []).map(parceiroDe), negocios: (o.data ?? []).map(negocioDe), atividades: (a.data ?? []).map(atividadeDe) };
}

// ---------------------------------------------------------------- gravação
export async function salvarParceiro(c: Crm, x: Partial<Parceiro> & { id?: string }): Promise<Parceiro> {
  const linha = {
    nome: x.nome?.trim(), tipo: x.tipo, escritorio: x.escritorio || null, telefone: x.telefone || null, email: x.email || null,
    instagram: x.instagram || null, cidade: x.cidade || null, comissao_padrao: n(x.comissao_padrao), observacoes: x.observacoes || null, etapa: x.etapa,
  };
  if (!linha.nome) throw new Error("Informe o nome do parceiro.");
  if (modoDemo) {
    const novo = { ...(c.parceiros.find((p) => p.id === x.id) ?? {}), ...x, id: x.id ?? uid() } as Parceiro;
    c.parceiros = [...c.parceiros.filter((p) => p.id !== novo.id), novo].sort((a, b) => a.nome.localeCompare(b.nome));
    return novo;
  }
  const db = supabase();
  const r = x.id ? await db.from("parceiros").update(linha).eq("id", x.id).select().single() : await db.from("parceiros").insert(linha).select().single();
  if (r.error) throw r.error;
  return parceiroDe(r.data);
}

export async function salvarNegocio(c: Crm, x: Partial<Negocio> & { id?: string }): Promise<Negocio> {
  const titulo = (x.titulo || x.cliente_nome || "").trim();
  if (!titulo) throw new Error("Informe o cliente ou o título do negócio.");
  const linha = {
    titulo, cliente_nome: x.cliente_nome?.trim() || null, parceiro_id: x.parceiro_id || null, etapa: x.etapa,
    valor_estimado: n(x.valor_estimado), data_ref: x.data_ref || hoje(), pct_parceiro: n(x.pct_parceiro), pct_vendedor: n(x.pct_vendedor),
    comissao_parceiro_paga: !!x.comissao_parceiro_paga, observacoes: x.observacoes || null, proxima_acao: x.proxima_acao || null,
    motivo_perda: x.etapa === "perdido" ? x.motivo_perda || null : null,
    fechada_em: x.etapa === "ganho" ? new Date().toISOString() : null,
  };
  if (modoDemo) {
    const novo = { ...(c.negocios.find((p) => p.id === x.id) ?? {}), ...x, titulo, id: x.id ?? uid() } as Negocio;
    c.negocios = [novo, ...c.negocios.filter((p) => p.id !== novo.id)];
    return novo;
  }
  const db = supabase();
  const r = x.id ? await db.from("oportunidades").update(linha).eq("id", x.id).select("*, clientes(nome)").single()
    : await db.from("oportunidades").insert(linha).select("*, clientes(nome)").single();
  if (r.error) throw r.error;
  return negocioDe(r.data);
}

export async function salvarAtividade(c: Crm, x: Partial<Atividade> & { id?: string }): Promise<Atividade> {
  const titulo = (x.titulo || x.contato || "").trim();
  if (!titulo) throw new Error(x.tipo === "followup" ? "Informe o contato ou o motivo." : "Informe o título.");
  const diaTodo = x.dia_todo || !x.hora;
  const linha = {
    tipo: x.tipo, titulo, notas: x.notas || null, quando: paraQuando(x.data || hoje(), x.hora || "", diaTodo), dia_todo: diaTodo,
    concluida: !!x.concluida, concluida_em: x.concluida ? new Date().toISOString() : null,
    parceiro_id: x.parceiro_id || null, oportunidade_id: x.oportunidade_id || null, contato: x.contato || null,
  };
  if (modoDemo) {
    const novo = { ...(c.atividades.find((p) => p.id === x.id) ?? {}), ...x, titulo, dia_todo: diaTodo, hora: diaTodo ? "" : x.hora!, id: x.id ?? uid() } as Atividade;
    c.atividades = [...c.atividades.filter((p) => p.id !== novo.id), novo];
    return novo;
  }
  const db = supabase();
  const r = x.id ? await db.from("atividades").update(linha).eq("id", x.id).select().single() : await db.from("atividades").insert(linha).select().single();
  if (r.error) throw r.error;
  return atividadeDe(r.data);
}

export async function excluir(c: Crm, tabela: "parceiros" | "oportunidades" | "atividades", id: string) {
  if (!modoDemo) {
    const { error } = await supabase().from(tabela).delete().eq("id", id);
    if (error) throw error;
  }
  if (tabela === "parceiros") c.parceiros = c.parceiros.filter((x) => x.id !== id);
  if (tabela === "oportunidades") c.negocios = c.negocios.filter((x) => x.id !== id);
  if (tabela === "atividades") c.atividades = c.atividades.filter((x) => x.id !== id);
}

// ---------------------------------------------------------------- integração com o Financeiro (v38)
const addMeses = (s: string, k: number) => {
  const d = new Date(s + "T12:00:00"), dd = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + k);
  d.setDate(Math.min(dd, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return isoDia(d);
};
/** Gera as parcelas a receber no Financeiro, no mesmo formato do v38 (com comissionados). */
export function montarParcelas(p: {
  descricao: string; cliente: string; forma: string; total: number; parcelas: number; primeiro: string;
  comissoes: { n: string; r: string; p: number }[]; nf?: string; conta?: string;
}) {
  const ids: Record<string, unknown>[] = [];
  let resto = Math.round(p.total * 100);
  const base = Math.round((p.total * 100) / p.parcelas);
  for (let i = 0; i < p.parcelas; i++) {
    const v = i === p.parcelas - 1 ? resto : base;
    resto -= v;
    ids.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i, t: "r", desc: p.descricao, who: p.cliente.trim().replace(/\s+/g, " "),
      forma: p.forma, valor: v / 100, venc: addMeses(p.primeiro, i), pago: null, par: p.parcelas > 1 ? `${i + 1}/${p.parcelas}` : "",
      com: "", pct: 0, coms: p.comissoes.filter((c) => c.n && c.p), nfr: p.nf ?? "", ...(p.conta ? { conta: p.conta } : {}),
    });
  }
  return ids;
}

export async function lancarNoFinanceiro(negocio: Negocio, parcelas: Record<string, unknown>[], usuario: string) {
  if (modoDemo) { negocio.financeiro_lancado_em = new Date().toISOString(); return; }
  const db = supabase();
  const tot = parcelas.reduce((s, x) => s + Number(x.valor), 0);
  const { error } = await db.from("fin_docs").insert([
    ...parcelas.map((x) => ({ colecao: "it", id: String(x.id), dados: x })),
    { colecao: "log", id: "crm" + Date.now().toString(36), dados: { ts: new Date().toISOString(), u: usuario, a: `Lançou recebível pelo CRM: ${negocio.titulo} · ${tot.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${parcelas.length > 1 ? " em " + parcelas.length + "x" : ""}` } },
  ]);
  if (error) throw error;
  const r = await db.from("oportunidades").update({ financeiro_lancado_em: new Date().toISOString() }).eq("id", negocio.id);
  if (r.error) throw r.error;
  negocio.financeiro_lancado_em = new Date().toISOString();
}

/** Comissões do parceiro registradas no Financeiro (parcelas com ele como comissionado). */
export async function comissoesNoFinanceiro(nome: string) {
  const alvo = nome.trim().toLowerCase();
  if (modoDemo || !alvo) return { recebida: 0, prevista: 0, parcelas: 0, ultimas: [] as { desc: string; who: string; venc: string; pago: string | null; valor: number }[] };
  const { data, error } = await supabase().from("fin_docs").select("dados").eq("colecao", "it").filter("dados->coms", "cs", JSON.stringify([{ n: nome.trim() }]));
  if (error) throw error;
  let recebida = 0, prevista = 0;
  const ultimas: { desc: string; who: string; venc: string; pago: string | null; valor: number }[] = [];
  for (const { dados: i } of (data ?? []) as { dados: any }[]) {
    const c = (i.coms ?? []).find((x: any) => String(x.n).trim().toLowerCase() === alvo);
    if (!c) continue;
    const base = i.pago && i.vp != null && i.vp !== "" ? Number(i.vp) : Number(i.valor);
    const v = (base * Number(c.p)) / 100;
    if (i.pago) recebida += v; else prevista += v;
    ultimas.push({ desc: i.desc, who: i.who, venc: i.venc, pago: i.pago, valor: v });
  }
  ultimas.sort((a, b) => (b.pago ?? b.venc).localeCompare(a.pago ?? a.venc));
  return { recebida, prevista, parcelas: ultimas.length, ultimas: ultimas.slice(0, 8) };
}

export async function nomeUsuario(): Promise<string> {
  if (modoDemo) return "Matheus Esturrari";
  const db = supabase();
  const { data } = await db.auth.getUser();
  if (!data.user) return "Usuário";
  const { data: p } = await db.from("perfis").select("nome").eq("id", data.user.id).single();
  return p?.nome ?? "Usuário";
}
