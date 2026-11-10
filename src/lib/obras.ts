"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco chegam sem tipo; convertidas campo a campo */
// Obras do Técnico: cada contrato assinado vira uma obra com cronograma,
// documentação de entrega (cartões com modelos), materiais e tarefas.
import { modoDemo, supabase, lerTudo } from "./supabase";

export type StatusObra = "andamento" | "pausada" | "entregue" | "cancelada";
export const STATUS_OBRA: Record<StatusObra, { rot: string; cor: string }> = {
  andamento: { rot: "Em andamento", cor: "#0071e3" }, pausada: { rot: "Pausada", cor: "#ff9f0a" },
  entregue: { rot: "Entregue", cor: "#34c759" }, cancelada: { rot: "Cancelada", cor: "#8e8e93" },
};
export type Obra = {
  id: string; numero: number; titulo: string; cliente_id: string | null; cliente_nome: string | null; endereco: string | null; telefone: string | null;
  contrato_id: string | null; oportunidade_id: string | null; proposta_id: string | null; quadro_id: string | null;
  status: StatusObra; inicio: string | null; previsao_entrega: string | null; entregue_em: string | null; garantia_meses: number;
  responsaveis: string[]; valor_contrato: number | null; observacoes: string | null; link_arquivos: string | null; termo_path: string | null;
  created_at: string; updated_at: string;
};
export type Etapa = {
  id: string; obra_id: string; nome: string; posicao: number; inicio_prev: string | null; fim_prev: string | null;
  inicio_real: string | null; fim_real: string | null; responsavel: string | null; observacao: string | null;
};
export type StatusDoc = "pendente" | "preenchendo" | "revisao" | "aprovado";
export const STATUS_DOC: Record<StatusDoc, { rot: string; cor: string; fundo: string }> = {
  pendente: { rot: "Pendente", cor: "#8e8e93", fundo: "#f2f2f7" }, preenchendo: { rot: "Em preenchimento", cor: "#0071e3", fundo: "#e8f1fd" },
  revisao: { rot: "Em revisão", cor: "#c25e00", fundo: "#fff2e6" }, aprovado: { rot: "Aprovado", cor: "#1f8a3b", fundo: "#e8f7ec" },
};
export type Doc = {
  id: string; obra_id: string; modelo: ModeloDoc; grupo: string; titulo: string; posicao: number; status: StatusDoc;
  incluir: boolean; conteudo: any; updated_at: string; atualizado_por: string | null;
};
export type ItemObra = {
  id: string; obra_id: string; proposta_item_id: string | null; produto_id: string | null; ordem: number; sistema: string;
  descricao: string; sku: string | null; marca: string | null; unidade: string; quantidade: number; custo_unit: number | null;
};
export type Classificacao = "vendido" | "excedente" | "nao_vendido" | "substituto" | "devolucao";
export const CLASSIFICACAO: Record<Classificacao, { rot: string; cor: string; fundo: string }> = {
  vendido: { rot: "Vendido", cor: "#1f8a3b", fundo: "#e8f7ec" }, excedente: { rot: "Excedente", cor: "#c25e00", fundo: "#fff2e6" },
  nao_vendido: { rot: "Fora do orçamento", cor: "#d70015", fundo: "#ffe9ea" }, substituto: { rot: "Substituto", cor: "#8944ab", fundo: "#f4ecfa" },
  devolucao: { rot: "Devolução", cor: "#0071e3", fundo: "#e8f1fd" },
};
export type Saida = {
  id: string; obra_id: string; produto_id: string; tipo: "saida" | "devolucao"; quantidade: number; classificacao: Classificacao;
  substitui_item: string | null; justificativa: string | null; custo_unit: number | null; revisado_em: string | null; created_by: string | null; created_at: string;
  produto?: { nome: string; marca: string | null; modelo: string | null; imagem_path: string | null; categoria: string | null; unidade: string } | null;
  autor?: { nome: string } | null;
};
export type ResumoObra = Obra & { etapas: number; etapasFeitas: number; atrasadas: number; docs: number; docsOk: number; pendentesSaida: number };

// ------------------------------------------------------------------ modelos de documento
export type ModeloDoc = "capa" | "objetivo" | "plantas" | "equipamentos" | "circuitos" | "pulsadores" | "cenas" | "redes" | "galeria" | "cameras" | "senhas" | "fotos" | "relacao" | "encerramento";
export type Coluna = { k: string; rot: string; grupo?: string; secreto?: boolean; larg?: number };
export type Bloco = { id: string; titulo: string; colunas: Coluna[]; linhas: Record<string, string>[] };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const teclas = (n: number): Coluna[] => Array.from({ length: n }, (_, i) => [
  { k: `t${i + 1}_cabo`, rot: "Cabo", grupo: `Tecla ${i + 1}`, larg: 34 }, { k: `t${i + 1}_cor`, rot: "Cor", grupo: `Tecla ${i + 1}`, larg: 28 },
  { k: `t${i + 1}_circ`, rot: "Circuito", grupo: `Tecla ${i + 1}`, larg: 40 },
]).flat();
export const COLUNAS = {
  circuitos: [{ k: "circuito", rot: "Circuito", larg: 60 }, { k: "ambiente", rot: "Ambiente" }],
  pulsadores: [{ k: "caixa", rot: "Caixa / pulsador", larg: 64 }, ...teclas(6)],
  switch: [{ k: "porta", rot: "Porta", larg: 40 }, { k: "dispositivo", rot: "Dispositivo / destino" }, { k: "vlan", rot: "VLAN", larg: 50 }, { k: "obs", rot: "Obs." }],
  irrf: [{ k: "porta", rot: "Porta", larg: 40 }, { k: "equipamento", rot: "Equipamento" }, { k: "destino", rot: "Controlado por" }],
  relacao: [
    { k: "item", rot: "Item", larg: 26 }, { k: "equipamento", rot: "Equipamento" }, { k: "marca", rot: "Marca" }, { k: "modelo", rot: "Modelo" },
    { k: "serial", rot: "Serial" }, { k: "mac", rot: "MAC address" }, { k: "ip", rot: "IP" }, { k: "mascara", rot: "Máscara" }, { k: "gateway", rot: "Gateway" },
    { k: "status", rot: "Status", larg: 44 }, { k: "login", rot: "Login" }, { k: "senha", rot: "Senha", secreto: true }, { k: "nome", rot: "Nome / local" },
    { k: "canal", rot: "Canal NVR / Wi-Fi" }, { k: "obs", rot: "Obs." },
  ],
} satisfies Record<string, Coluna[]>;

export const linhasVazias = (n: number) => Array.from({ length: n }, () => ({ id: uid() }));
/** Conteúdo inicial de cada modelo (o que aparece ao abrir o cartão pela primeira vez). */
export function conteudoInicial(modelo: ModeloDoc, grupo: string): any {
  switch (modelo) {
    case "objetivo": return { texto: TEXTO_OBJETIVO };
    case "plantas": return { itens: [], obs: "Obs.: os projetos em escala aumentada estão disponíveis em link para acesso." };
    case "equipamentos": return { sistemas: SISTEMAS_DO_GRUPO[grupo] ?? [], itens: [] };
    case "circuitos": return { blocos: [{ id: uid(), titulo: "Pavimento inferior", colunas: COLUNAS.circuitos, linhas: linhasVazias(10) }, { id: uid(), titulo: "Pavimento superior", colunas: COLUNAS.circuitos, linhas: linhasVazias(10) }] };
    case "pulsadores": return { blocos: [{ id: uid(), titulo: "Térreo", colunas: COLUNAS.pulsadores, linhas: linhasVazias(8) }, { id: uid(), titulo: "Superior", colunas: COLUNAS.pulsadores, linhas: linhasVazias(8) }] };
    case "cenas": return { caixas: [] };
    case "redes": return { blocos: [
      { id: uid(), titulo: "Switch 01 · 24 portas", colunas: COLUNAS.switch, linhas: Array.from({ length: 24 }, (_, i) => ({ id: uid(), porta: String(i + 1) })) },
      { id: uid(), titulo: "Switch 02 · 8 portas PoE", colunas: COLUNAS.switch, linhas: Array.from({ length: 8 }, (_, i) => ({ id: uid(), porta: String(i + 1) })) },
      { id: uid(), titulo: "Roteador", colunas: COLUNAS.switch, linhas: Array.from({ length: 5 }, (_, i) => ({ id: uid(), porta: String(i + 1) })) },
      { id: uid(), titulo: "Tabela de IR / RF", colunas: COLUNAS.irrf, linhas: linhasVazias(6) },
    ] };
    case "galeria": return { itens: [], obs: "" };
    case "cameras": return { itens: [] };
    case "fotos": return { itens: [] };
    case "senhas": return { contas: [
      { id: uid(), servico: "Conta Customer Control4", site: "https://customer.control4.com/", usuario: "" },
      { id: uid(), servico: "Conta App Control4", site: "", usuario: "" },
      { id: uid(), servico: "Rede Wi-Fi 2.4G e 5G", site: "", usuario: "" },
      { id: uid(), servico: "Usuário NVR / câmeras", site: "", usuario: "" },
    ] };
    case "relacao": return { faixa: "", blocos: [{ id: uid(), titulo: "Relação de equipamentos", colunas: COLUNAS.relacao, linhas: [] }] };
    case "encerramento": return { texto: "Agradecemos a oportunidade!\nDesejamos lindos momentos neste novo lar!", link: "" };
    default: return {};
  }
}
export const SISTEMAS_DO_GRUPO: Record<string, string[]> = {
  "Sistema de Automação": ["Automação"], "Sistema de Rede Estruturada": ["Rede Estruturada", "Rede"],
  "Sistema de Monitoramento": ["Segurança", "CFTV", "Monitoramento"], "Sistema de Áudio e Vídeo": ["Sonorização", "Home Theater", "Áudio e Vídeo", "Painel de Led"],
};
export const TEXTO_OBJETIVO = "O objetivo principal é criar um histórico completo e estruturado do projeto, facilitando a compreensão e a referência futura. Ele contém informações detalhadas sobre os sistemas de Automação, Rede Estruturada, Sistema de Monitoramento e Áudio e Vídeo instalados, servindo de guia para manutenções preventivas e corretivas, ampliações e para o uso no dia a dia.";
export const MODELOS_DOC: { modelo: ModeloDoc; rot: string; desc: string }[] = [
  { modelo: "objetivo", rot: "Texto", desc: "Parágrafos livres" },
  { modelo: "plantas", rot: "Projeto executivo", desc: "Plantas em PDF ou imagem" },
  { modelo: "equipamentos", rot: "Equipamentos instalados", desc: "Lista com foto, puxada do orçamento" },
  { modelo: "circuitos", rot: "Mapeamento de circuitos", desc: "Circuito × ambiente" },
  { modelo: "pulsadores", rot: "Tabela de pulsadores", desc: "Caixa, tecla, cabo, cor e circuito" },
  { modelo: "cenas", rot: "Mapa de cenas", desc: "Teclas e ações por clique" },
  { modelo: "redes", rot: "Mapeamento de rede", desc: "Switches, roteador, IR/RF" },
  { modelo: "galeria", rot: "Galeria de imagens", desc: "Prints de configuração" },
  { modelo: "cameras", rot: "Imagens das câmeras", desc: "Uma foto por câmera" },
  { modelo: "senhas", rot: "Usuários e senhas", desc: "Contas e senhas protegidas" },
  { modelo: "fotos", rot: "Fotos", desc: "Fotos das instalações" },
  { modelo: "relacao", rot: "Relação de equipamentos", desc: "IP, MAC, serial, login" },
];
export const GRUPOS = ["Apresentação", "Sistema de Automação", "Sistema de Rede Estruturada", "Sistema de Monitoramento", "Sistema de Áudio e Vídeo", "Usuários e senhas", "Fotos das instalações", "Relação dos equipamentos", "Encerramento"];

/** Quanto do cartão já foi preenchido (0–1) — para a barra de progresso. */
export function preenchimento(d: Pick<Doc, "modelo" | "conteudo">, segredos: Record<string, string> = {}): number {
  const c = d.conteudo ?? {};
  const linhasCheias = (b: Bloco[] = []) => {
    const ls = b.flatMap((x) => x.linhas ?? []);
    if (!ls.length) return 0;
    return ls.filter((l) => Object.entries(l).some(([k, v]) => k !== "id" && k !== "porta" && k !== "item" && String(v ?? "").trim())).length / ls.length;
  };
  switch (d.modelo) {
    case "capa": return 1;
    case "objetivo": case "encerramento": return String(c.texto ?? "").trim() ? 1 : 0;
    case "plantas": case "galeria": case "cameras": case "fotos": case "equipamentos": return (c.itens?.length ?? 0) > 0 ? 1 : 0;
    case "circuitos": case "pulsadores": case "redes": case "relacao": return Math.min(1, linhasCheias(c.blocos) * 1.25);
    case "cenas": return (c.caixas?.length ?? 0) > 0 ? 1 : 0;
    case "senhas": { const n = c.contas?.length ?? 0; return n ? (c.contas as any[]).filter((x) => x.usuario || segredos[`senha:${x.id}`]).length / n : 0; }
    default: return 0;
  }
}

// ------------------------------------------------------------------ datas
export const hojeIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const dataBr = (s: string | null | undefined) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
export function addDiasIso(s: string, n: number) { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
export function addMesesIso(s: string, n: number) { const d = new Date(s + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); }
export const etapaFeita = (e: Pick<Etapa, "fim_real">) => !!e.fim_real;
export const etapaAtrasada = (e: Pick<Etapa, "fim_real" | "fim_prev">, hoje = hojeIso()) => !e.fim_real && !!e.fim_prev && e.fim_prev < hoje;
export function situacaoEtapa(e: Etapa, hoje = hojeIso()): { rot: string; cor: string } {
  if (e.fim_real) return { rot: "Concluída", cor: "#34c759" };
  if (etapaAtrasada(e, hoje)) return { rot: "Atrasada", cor: "#ff3b30" };
  if (e.inicio_real) return { rot: "Em andamento", cor: "#0071e3" };
  return { rot: "A iniciar", cor: "#8e8e93" };
}
/** Distribui as etapas sem data entre o início e a previsão de entrega (dias iguais). */
export function distribuirDatas(etapas: Etapa[], inicio: string, fim: string): Etapa[] {
  const total = Math.max(etapas.length, Math.round((new Date(fim + "T12:00:00").getTime() - new Date(inicio + "T12:00:00").getTime()) / 864e5) + 1);
  const passo = total / Math.max(1, etapas.length);
  return etapas.map((e, i) => ({ ...e, inicio_prev: addDiasIso(inicio, Math.round(i * passo)), fim_prev: addDiasIso(inicio, Math.max(Math.round(i * passo), Math.round((i + 1) * passo) - 1)) }));
}
export function fimGarantia(o: Pick<Obra, "entregue_em" | "garantia_meses">) { return o.entregue_em ? addMesesIso(o.entregue_em, o.garantia_meses) : null; }

// ------------------------------------------------------------------ conferência de materiais
export type LinhaConferencia = {
  chave: string; produto_id: string | null; descricao: string; marca: string | null; sistema: string; unidade: string;
  vendido: number; saiu: number; saldo: number; custoVendido: number; custoSaiu: number; itemIds: string[];
  situacao: "ok" | "falta" | "excedente" | "fora" | "substituto";
};
/** Vendido × saído por produto (números puros, testáveis). */
export function conferencia(itens: ItemObra[], saidas: Saida[]): LinhaConferencia[] {
  const m = new Map<string, LinhaConferencia>();
  for (const i of itens) {
    const k = i.produto_id ?? "i:" + i.id;
    const l = m.get(k) ?? { chave: k, produto_id: i.produto_id, descricao: i.descricao, marca: i.marca, sistema: i.sistema, unidade: i.unidade, vendido: 0, saiu: 0, saldo: 0, custoVendido: 0, custoSaiu: 0, itemIds: [], situacao: "ok" as const };
    l.vendido += i.quantidade; l.custoVendido += i.quantidade * (i.custo_unit ?? 0); l.itemIds.push(i.id); m.set(k, l);
  }
  for (const s of saidas) {
    const k = s.produto_id;
    const l = m.get(k) ?? { chave: k, produto_id: k, descricao: s.produto?.nome ?? "Produto", marca: s.produto?.marca ?? null, sistema: "Fora do orçamento", unidade: s.produto?.unidade ?? "un", vendido: 0, saiu: 0, saldo: 0, custoVendido: 0, custoSaiu: 0, itemIds: [], situacao: "fora" as const };
    const q = s.tipo === "devolucao" ? -s.quantidade : s.quantidade;
    l.saiu += q; l.custoSaiu += q * (s.custo_unit ?? 0);
    if (s.classificacao === "substituto" && !l.vendido) l.sistema = "Substitutos";
    m.set(k, l);
  }
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return [...m.values()].map((l) => {
    const saldo = r3(l.vendido - l.saiu);
    const substituto = !l.vendido && l.sistema === "Substitutos";
    return { ...l, vendido: r3(l.vendido), saiu: r3(l.saiu), saldo, situacao: substituto ? "substituto" : !l.vendido ? "fora" : saldo < 0 ? "excedente" : saldo > 0 ? "falta" : "ok" };
  });
}
/** Prévia da classificação antes de registrar (o banco faz a conta final). */
export function preverClassificacao(itens: ItemObra[], saidas: Saida[], produtoId: string, qtd: number, substitui?: string | null): Classificacao {
  if (substitui) return "substituto";
  const vend = itens.filter((i) => i.produto_id === produtoId).reduce((a, i) => a + i.quantidade, 0);
  const saiu = saidas.filter((s) => s.produto_id === produtoId).reduce((a, s) => a + (s.tipo === "devolucao" ? -s.quantidade : s.quantidade), 0);
  if (!vend) return "nao_vendido";
  return saiu + qtd <= vend + 1e-9 ? "vendido" : "excedente";
}

// ------------------------------------------------------------------ banco
const n = (v: any) => (v == null ? 0 : Number(v));
const obraDe = (o: any): Obra => ({ ...o, valor_contrato: o.valor_contrato == null ? null : n(o.valor_contrato), responsaveis: o.responsaveis ?? [] });

export async function listarObras(): Promise<ResumoObra[]> {
  if (modoDemo) return [];
  const db = supabase();
  const [o, e, d, s] = await Promise.all([
    db.from("obras").select("*").order("numero", { ascending: false }),
    db.from("obra_etapas").select("obra_id, fim_prev, fim_real"),
    db.from("obra_docs").select("obra_id, status, incluir"),
    db.from("obra_saidas").select("obra_id").is("revisado_em", null),
  ]);
  if (o.error) throw o.error;
  const hoje = hojeIso();
  return (o.data ?? []).map((x: any) => {
    const et = (e.data ?? []).filter((y: any) => y.obra_id === x.id), dc = (d.data ?? []).filter((y: any) => y.obra_id === x.id && y.incluir);
    return { ...obraDe(x), etapas: et.length, etapasFeitas: et.filter((y: any) => y.fim_real).length, atrasadas: et.filter((y: any) => etapaAtrasada(y, hoje)).length,
      docs: dc.length, docsOk: dc.filter((y: any) => y.status === "aprovado").length, pendentesSaida: (s.data ?? []).filter((y: any) => y.obra_id === x.id).length };
  });
}
export type ContratoSemObra = { id: string; numero: string | null; cliente: string | null; titulo: string | null; assinado_em: string | null; valor: number };
export async function contratosSemObra(): Promise<ContratoSemObra[]> {
  if (modoDemo) return [];
  const { data, error } = await supabase().rpc("contratos_sem_obra");
  if (error) return [];  // técnico não vê contratos
  return (data ?? []).map((c: any) => ({ ...c, valor: n(c.valor) }));
}
export async function criarObra(contratoId: string): Promise<string> {
  const { data, error } = await supabase().rpc("criar_obra", { p_contrato: contratoId });
  if (error) throw error;
  return data as string;
}
export type ObraCompleta = { obra: Obra; etapas: Etapa[]; docs: Doc[]; itens: ItemObra[]; saidas: Saida[] };
export async function abrirObra(id: string): Promise<ObraCompleta> {
  const db = supabase();
  const [o, e, d, i, s] = await Promise.all([
    db.from("obras").select("*").eq("id", id).single(),
    db.from("obra_etapas").select("*").eq("obra_id", id).order("posicao"),
    db.from("obra_docs").select("*").eq("obra_id", id).order("posicao"),
    db.from("obra_itens").select("*").eq("obra_id", id).order("ordem"),
    db.from("obra_saidas").select("*, produto:produtos(nome, marca, modelo, imagem_path, categoria, unidade), autor:perfis!obra_saidas_created_by_fkey(nome)").eq("obra_id", id).order("created_at", { ascending: false }),
  ]);
  if (o.error) throw o.error;
  return {
    obra: obraDe(o.data), etapas: (e.data ?? []) as Etapa[], docs: (d.data ?? []) as Doc[],
    itens: (i.data ?? []).map((x: any) => ({ ...x, quantidade: n(x.quantidade), custo_unit: x.custo_unit == null ? null : n(x.custo_unit) })),
    saidas: (s.data ?? []).map((x: any) => ({ ...x, quantidade: n(x.quantidade), custo_unit: x.custo_unit == null ? null : n(x.custo_unit) })),
  };
}
export function ouvirObra(id: string, aoMudar: () => void): () => void {
  if (modoDemo) return () => {};
  const db = supabase();
  let t: ReturnType<typeof setTimeout> | null = null;
  const avisar = () => { if (t) clearTimeout(t); t = setTimeout(aoMudar, 400); };
  const canal = db.channel("obra-" + id);
  canal.on("postgres_changes", { event: "*", schema: "public", table: "obras", filter: `id=eq.${id}` }, avisar);
  for (const tb of ["obra_etapas", "obra_docs", "obra_itens", "obra_saidas"]) canal.on("postgres_changes", { event: "*", schema: "public", table: tb, filter: `obra_id=eq.${id}` }, avisar);
  canal.subscribe();
  return () => { if (t) clearTimeout(t); db.removeChannel(canal); };
}
export async function salvarObra(id: string, campos: Partial<Obra>) {
  const { error } = await supabase().from("obras").update(campos).eq("id", id);
  if (error) throw error;
}
export async function salvarEtapa(e: Partial<Etapa> & { obra_id: string }): Promise<Etapa> {
  const db = supabase();
  const { id, ...resto } = e;
  const r = id ? await db.from("obra_etapas").update(resto).eq("id", id).select().single() : await db.from("obra_etapas").insert(resto).select().single();
  if (r.error) throw r.error;
  return r.data as Etapa;
}
export async function salvarEtapas(lista: Etapa[]) {
  const db = supabase();
  for (const e of lista) {
    const { id, ...resto } = e;
    const r = await db.from("obra_etapas").update(resto).eq("id", id);
    if (r.error) throw r.error;
  }
}
export async function excluirEtapa(id: string) { const { error } = await supabase().from("obra_etapas").delete().eq("id", id); if (error) throw error; }

export async function salvarDoc(id: string, campos: Partial<Doc>) {
  const { error } = await supabase().from("obra_docs").update(campos).eq("id", id);
  if (error) throw error;
}
export async function novoDoc(obra_id: string, modelo: ModeloDoc, grupo: string, titulo: string, posicao: number): Promise<Doc> {
  const { data, error } = await supabase().from("obra_docs").insert({ obra_id, modelo, grupo, titulo, posicao, conteudo: conteudoInicial(modelo, grupo) }).select().single();
  if (error) throw error;
  return data as Doc;
}
export async function excluirDoc(id: string) { const { error } = await supabase().from("obra_docs").delete().eq("id", id); if (error) throw error; }

// senhas (só técnico/diretoria; cada leitura fica no Histórico)
export async function lerSenhas(obraId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase().rpc("ler_senhas_obra", { p_obra: obraId });
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((x: any) => [x.chave, x.valor]));
}
export async function gravarSenha(obraId: string, chave: string, valor: string) {
  const db = supabase();
  const r = valor ? await db.from("obra_segredos").upsert({ obra_id: obraId, chave, valor, updated_at: new Date().toISOString() }, { onConflict: "obra_id,chave" })
    : await db.from("obra_segredos").delete().eq("obra_id", obraId).eq("chave", chave);
  if (r.error) throw r.error;
}

// arquivos da obra (no bucket de documentos, pasta que o técnico acessa)
export const pastaObra = (obraId: string) => `projetos/obras/${obraId}`;
export async function enviarArquivoObra(obraId: string, arquivo: Blob, nome: string): Promise<string> {
  const limpo = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
  const caminho = `${pastaObra(obraId)}/${Date.now().toString(36)}-${limpo}`;
  const { error } = await supabase().storage.from("documentos").upload(caminho, arquivo, { contentType: (arquivo as File).type || undefined });
  if (error) throw error;
  return caminho;
}
const cacheUrl = new Map<string, { url: string; ate: number }>();
export async function urlArquivo(caminho: string): Promise<string> {
  const c = cacheUrl.get(caminho);
  if (c && c.ate > Date.now()) return c.url;
  const { data, error } = await supabase().storage.from("documentos").createSignedUrl(caminho, 3600);
  if (error) throw error;
  cacheUrl.set(caminho, { url: data.signedUrl, ate: Date.now() + 3000e3 });
  return data.signedUrl;
}
export async function removerArquivo(caminho: string) { await supabase().storage.from("documentos").remove([caminho]); }

/** Foto reduzida em JPEG (para subir leve e embutir no PDF). */
export async function reduzirImagem(fonte: Blob, max = 1800, qualidade = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(fonte);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(bmp.width * s)); cv.height = Math.max(1, Math.round(bmp.height * s));
  const x = cv.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise((ok, erro) => cv.toBlob((b) => (b ? ok(b) : erro(new Error("Não deu para ler a imagem."))), "image/jpeg", qualidade));
}
/** Páginas de um PDF viram imagens (o PDF final embute as plantas como figura). */
export async function paginasPdf(arquivo: Blob, maxPaginas = 8, largura = 2000): Promise<Blob[]> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const saida: Blob[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPaginas); p++) {
    const pg = await doc.getPage(p);
    const v0 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: Math.min(4, largura / Math.max(v0.width, v0.height)) });
    const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp, canvas: cv } as any).promise;
    saida.push(await new Promise<Blob>((ok, erro) => cv.toBlob((b) => (b ? ok(b) : erro(new Error("Falha ao converter a página."))), "image/jpeg", 0.88)));
  }
  return saida;
}

// materiais
export async function registrarSaida(p: { obra_id: string; produto_id: string; quantidade: number; tipo: "saida" | "devolucao"; substitui_item?: string | null; justificativa?: string }): Promise<Classificacao> {
  const { data, error } = await supabase().rpc("registrar_saida_obra", { p });
  if (error) throw error;
  return (data as any).classificacao;
}
export async function revisarSaida(id: string) {
  const { data: u } = await supabase().auth.getUser();
  const { error } = await supabase().from("obra_saidas").update({ revisado_em: new Date().toISOString(), revisado_por: u.user?.id }).eq("id", id);
  if (error) throw error;
}
export type ProdutoBusca = { id: string; nome: string; marca: string | null; modelo: string | null; categoria: string | null; unidade: string; imagem_path: string | null; saldo: number; custo: number | null; zenith_id: number | null };
export async function buscarProdutos(): Promise<ProdutoBusca[]> {
  const db = supabase();
  const [p, s] = await Promise.all([
    lerTudo<any>(() => db.from("produtos").select("id, nome, marca, modelo, categoria, unidade, imagem_path, custo, zenith_id, sku").eq("ativo", true).order("nome").order("id")),
    lerTudo<any>(() => db.from("estoque_saldos").select("produto_id, saldo_fisico").order("produto_id")),
  ]);
  const sal = new Map(s.map((x: any) => [x.produto_id, n(x.saldo_fisico)]));
  return p.map((x: any) => ({ ...x, custo: x.custo == null ? null : n(x.custo), saldo: sal.get(x.id) ?? 0 }));
}

// visitas e chamados do cliente (para a visão geral)
export async function atendimentosDoCliente(clienteId: string) {
  const { data } = await supabase().from("cartoes").select("id, titulo, numero, agenda_inicio, concluido_em, prazo, garantia, quadro_id, quadros(modulo)")
    .eq("cliente_id", clienteId).eq("arquivado", false).order("created_at", { ascending: false }).limit(40);
  return (data ?? []).map((c: any) => ({ ...c, modulo: c.quadros?.modulo ?? "projetos" })).filter((c: any) => c.modulo !== "projetos") as
    { id: string; titulo: string; numero: number | null; agenda_inicio: string | null; concluido_em: string | null; prazo: string | null; garantia: boolean | null; modulo: string }[];
}
/** Cliente com obra entregue e ainda na garantia (o chamado já nasce "Em garantia"). */
export async function clienteEmGarantia(clienteId: string): Promise<boolean> {
  if (modoDemo || !clienteId) return false;
  const { data } = await supabase().from("obras").select("entregue_em, garantia_meses").eq("cliente_id", clienteId).not("entregue_em", "is", null);
  const hoje = hojeIso();
  return (data ?? []).some((o: any) => (fimGarantia(o) ?? "") >= hoje);
}

// resumo para o painel técnico e avisos
export async function resumoObras(): Promise<{ andamento: number; atrasadas: number; docsPendentes: number; saidasRevisar: number; entregaSemana: number }> {
  if (modoDemo) return { andamento: 0, atrasadas: 0, docsPendentes: 0, saidasRevisar: 0, entregaSemana: 0 };
  const L = await listarObras();
  const at = L.filter((o) => o.status === "andamento"), lim = addDiasIso(hojeIso(), 7);
  return {
    andamento: at.length, atrasadas: at.filter((o) => o.atrasadas > 0 || (o.previsao_entrega && o.previsao_entrega < hojeIso())).length,
    docsPendentes: at.reduce((a, o) => a + (o.docs - o.docsOk), 0), saidasRevisar: L.reduce((a, o) => a + o.pendentesSaida, 0),
    entregaSemana: at.filter((o) => o.previsao_entrega && o.previsao_entrega >= hojeIso() && o.previsao_entrega <= lim).length,
  };
}
