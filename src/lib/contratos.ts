"use client";
// Contratos: dados, geração do Word a partir do modelo, controle manual da
// assinatura (enviado pelo DocuSign fora do Núcleo, PDF assinado anexado aqui)
// e lançamento das parcelas no Financeiro.
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { modoDemo, supabase } from "./supabase";

export type StatusContrato = "rascunho" | "enviado" | "assinado" | "recusado" | "cancelado" | "encerrado";
export type Contrato = {
  id: string; numero: string; titulo: string; unidade: string; status: StatusContrato;
  cliente_id: string | null; cliente_nome: string; cliente_documento: string; cliente_email: string; cliente_telefone: string; cliente_endereco: string;
  oportunidade_id: string | null; proposta_id: string | null;
  valor: number; entrada: number; entrada_vencimento: string | null; parcelas: number; primeiro_vencimento: string | null;
  forma_pagamento: string; data_contrato: string; observacoes: string; dados: Record<string, unknown>;
  arquivo_path: string | null; arquivo_nome: string | null; assinado_path: string | null;
  docusign_envelope_id: string | null; docusign_status: string | null; docusign_atualizado: string | null; recusa_motivo: string | null;
  enviado_em: string | null; assinado_em: string | null; financeiro_lancado_em: string | null; created_at: string; updated_at: string;
};
export type EventoContrato = { id: number; tipo: string; descricao: string; created_at: string; usuario_id: string | null };
export type ConfigContratos = {
  cidade: string; forma_recebimento: string; representante_assina: boolean;
  representante: { nome: string; cpf: string; rg: string; endereco: string; email?: string };
  assinante_bra: { nome: string; email: string; cpf: string };
};
export type Modelo = { id: string; nome: string; arquivo_path: string; padrao: boolean; created_at: string };

export const STATUS: Record<StatusContrato, { rot: string; cor: string }> = {
  rascunho: { rot: "Rascunho", cor: "bg-fundo text-suave" },
  enviado: { rot: "Aguardando assinatura", cor: "bg-[#eef3fb] text-azul" },
  assinado: { rot: "Assinado", cor: "bg-ok-claro text-ok" },
  recusado: { rot: "Recusado", cor: "bg-erro-claro text-erro" },
  cancelado: { rot: "Cancelado", cor: "bg-fundo text-suave line-through" },
  encerrado: { rot: "Encerrado", cor: "bg-fundo text-suave" },
};
export const MODELO_PADRAO = "/modelos/contrato-bra.docx";
export const CONFIG_VAZIA: ConfigContratos = {
  cidade: "Paulínia", forma_recebimento: "", representante_assina: false,
  representante: { nome: "", cpf: "", rg: "", endereco: "", email: "" }, assinante_bra: { nome: "", email: "", cpf: "" },
};

// ------------------------------------------------------------------ formatação (puro)
const pad = (n: number) => String(n).padStart(2, "0");
export const reaisTxt = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
export const dataTxt = (s: string | null | undefined) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");
export function formatarDocumento(d: string): string {
  const n = (d || "").replace(/\D/g, "");
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d || "";
}
export function addMeses(s: string, k: number) {
  const d = new Date(s + "T12:00:00"), dd = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + k);
  d.setDate(Math.min(dd, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Cronograma financeiro do contrato: entrada + parcelas iguais (centavos ajustados na última). */
export function cronograma(c: Pick<Contrato, "valor" | "entrada" | "entrada_vencimento" | "parcelas" | "primeiro_vencimento" | "data_contrato">) {
  const total = Math.round((Number(c.valor) || 0) * 100);
  const entrada = Math.min(total, Math.round((Number(c.entrada) || 0) * 100));
  const n = Math.max(0, Math.floor(Number(c.parcelas) || 0));
  const out: { rotulo: string; valor: number; venc: string }[] = [];
  const venc0 = c.entrada_vencimento || c.data_contrato;
  if (entrada > 0 || n === 0) out.push({ rotulo: n === 0 ? "À vista" : "Entrada", valor: (n === 0 ? total : entrada) / 100, venc: venc0 });
  if (n > 0) {
    const resto = total - entrada, base = Math.floor(resto / n);
    const primeiro = c.primeiro_vencimento || addMeses(venc0, 1);
    for (let i = 0; i < n; i++) out.push({ rotulo: `${i + 1}/${n}`, valor: (i === n - 1 ? resto - base * (n - 1) : base) / 100, venc: addMeses(primeiro, i) });
  }
  return out;
}

/** Linhas da tabela "Forma de pagamento" do contrato (mesmo texto do modelo Jangadinha). */
export function condicoesPagamento(c: Parameters<typeof cronograma>[0]) {
  const cr = cronograma(c);
  const n = Math.max(0, Math.floor(Number(c.parcelas) || 0));
  const linhas: { condicao: string; valor: string; vencimento: string }[] = [];
  const ent = cr.find((x) => x.rotulo === "Entrada" || x.rotulo === "À vista");
  if (ent) linhas.push({ condicao: n === 0 ? "À vista" : "Entrada (ato)", valor: reaisTxt(ent.valor), vencimento: dataTxt(ent.venc) });
  const ps = cr.filter((x) => x.rotulo.includes("/"));
  if (ps.length === 1) linhas.push({ condicao: ent ? "Saldo" : "Parcela única", valor: reaisTxt(ps[0].valor), vencimento: dataTxt(ps[0].venc) });
  else if (ps.length > 1) {
    const iguais = ps.every((p) => p.valor === ps[0].valor);
    const dia = ps[0].venc.slice(8, 10);
    linhas.push({
      condicao: ent ? "Parcelas restantes" : "Parcelas",
      valor: iguais ? `${ps.length}x de ${reaisTxt(ps[0].valor)}` : `${ps.length - 1}x de ${reaisTxt(ps[0].valor)} + 1x de ${reaisTxt(ps[ps.length - 1].valor)}`,
      vencimento: ent && addMeses(ent.venc, 1) === ps[0].venc ? `Dia ${dia} dos meses subsequentes` : `Dia ${dia} de cada mês, a partir de ${dataTxt(ps[0].venc)}`,
    });
  }
  return linhas;
}

// ------------------------------------------------------------------ valor por extenso
const UNI = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CEM = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100, d = Math.floor(r / 10), u = r % 10;
  const partes = [CEM[c], r < 20 ? UNI[r] : [DEZ[d], UNI[u]].filter(Boolean).join(" e ")].filter(Boolean);
  return partes.join(" e ");
}
function inteiroExtenso(n: number): string {
  if (n === 0) return "zero";
  const grupos: number[] = [];
  for (let x = n; x > 0; x = Math.floor(x / 1000)) grupos.push(x % 1000);
  const nomes = [["", ""], ["mil", "mil"], ["milhão", "milhões"], ["bilhão", "bilhões"]];
  const partes: { txt: string; v: number }[] = [];
  grupos.forEach((g, i) => {
    if (!g) return;
    const txt = i === 1 && g === 1 ? "mil" : [ate999(g), i ? nomes[i][g === 1 ? 0 : 1] : ""].filter(Boolean).join(" ");
    partes.unshift({ txt, v: g });
  });
  return partes.map((p, i) => {
    if (i === 0) return p.txt;
    const ultimo = i === partes.length - 1;
    return (ultimo && (p.v < 100 || p.v % 100 === 0) ? " e " : i === partes.length - 1 ? " " : ", ") + p.txt;
  }).join("").replace(/, /g, " ");
}
/** 48000 → "quarenta e oito mil reais"; 1234,56 → "mil duzentos e trinta e quatro reais e cinquenta e seis centavos". */
export function valorExtenso(v: number): string {
  const cent = Math.round((Number(v) || 0) * 100), r = Math.floor(cent / 100), c = cent % 100;
  const reais = r === 0 ? "" : `${inteiroExtenso(r)}${r % 1_000_000 === 0 ? " de" : ""} ${r === 1 ? "real" : "reais"}`;
  const cents = c === 0 ? "" : `${inteiroExtenso(c)} ${c === 1 ? "centavo" : "centavos"}`;
  return [reais, cents].filter(Boolean).join(" e ") || "zero reais";
}

/** Campos que preenchem o modelo Word. */
export function dadosDoModelo(c: Contrato, cfg: ConfigContratos) {
  return {
    numero: c.numero, unidade: c.unidade || c.titulo || "", titulo: c.titulo || "",
    cliente_nome: c.cliente_nome, cliente_documento: formatarDocumento(c.cliente_documento), cliente_endereco: c.cliente_endereco,
    cliente_email: c.cliente_email, cliente_telefone: c.cliente_telefone,
    valor_total: reaisTxt(c.valor), valor_extenso: valorExtenso(c.valor), condicoes: condicoesPagamento(c),
    cliente_nascimento: dataTxt(String(c.dados?.cliente_nascimento ?? "")),
    garantia_meses: String(c.dados?.garantia_meses ?? "12"),
    escopo: String(c.dados?.escopo ?? ""), condicoes_especificas: String(c.dados?.condicoes_especificas ?? "") || "Não há.",
    forma_recebimento: c.forma_pagamento || cfg.forma_recebimento,
    cidade: cfg.cidade || "Paulínia", data: dataTxt(c.data_contrato),
    rep_nome: cfg.representante.nome, rep_cpf: cfg.representante.cpf, rep_rg: cfg.representante.rg, rep_endereco: cfg.representante.endereco,
    bra_nome: cfg.assinante_bra.nome, bra_cpf: cfg.assinante_bra.cpf,
    ...Object.fromEntries(Object.entries(c.dados ?? {}).filter(([k, v]) => typeof v === "string" && !["cliente_nascimento", "garantia_meses", "escopo", "condicoes_especificas"].includes(k))),
  };
}

/** Preenche um .docx (modelo com {campos}) e devolve o arquivo pronto. */
export function preencherDocx(modelo: ArrayBuffer, dados: Record<string, unknown>): Blob {
  const doc = new Docxtemplater(new PizZip(modelo), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
  doc.render(dados);
  return doc.getZip().generate({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) as Blob;
}

/** Campos {x} que um modelo usa (para conferir modelos enviados). */
export function camposDoModelo(modelo: ArrayBuffer): string[] {
  const zip = new PizZip(modelo);
  const xml = Object.keys(zip.files).filter((f) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(f)).map((f) => zip.file(f)!.asText()).join("");
  const txt = xml.replace(/<[^>]+>/g, "");
  const fora: string[] = [];
  let nivel = 0;
  for (const m of txt.matchAll(/\{([#/^]?)([a-z_0-9]+)\}/gi)) {
    if (m[1] === "/") { nivel = Math.max(0, nivel - 1); continue; }
    if (nivel === 0) fora.push(m[2]);
    if (m[1]) nivel++;
  }
  return [...new Set(fora)];
}

// ------------------------------------------------------------------ banco
const COLS = "*";
const norm = (r: Record<string, unknown>): Contrato => ({
  ...(r as Contrato),
  valor: Number(r.valor) || 0, entrada: Number(r.entrada) || 0, parcelas: Number(r.parcelas) || 0,
  titulo: (r.titulo as string) ?? "", unidade: (r.unidade as string) ?? "", cliente_nome: (r.cliente_nome as string) ?? "",
  cliente_documento: (r.cliente_documento as string) ?? "", cliente_email: (r.cliente_email as string) ?? "", cliente_telefone: (r.cliente_telefone as string) ?? "",
  cliente_endereco: (r.cliente_endereco as string) ?? "", forma_pagamento: (r.forma_pagamento as string) ?? "", observacoes: (r.observacoes as string) ?? "",
  numero: (r.numero as string) ?? "", dados: (r.dados as Record<string, unknown>) ?? {},
});

export async function listarContratos(): Promise<Contrato[]> {
  if (modoDemo) return [];
  const { data, error } = await supabase().from("contratos").select(COLS).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(norm);
}
export async function abrirContrato(id: string): Promise<{ contrato: Contrato; eventos: EventoContrato[] }> {
  const db = supabase();
  const [c, e] = await Promise.all([
    db.from("contratos").select(COLS).eq("id", id).single(),
    db.from("contrato_eventos").select("id, tipo, descricao, created_at, usuario_id").eq("contrato_id", id).order("created_at", { ascending: false }),
  ]);
  if (c.error) throw c.error;
  return { contrato: norm(c.data), eventos: (e.data ?? []) as EventoContrato[] };
}
export async function sugerirNumero(): Promise<string> {
  const { data, error } = await supabase().rpc("sugerir_numero_contrato");
  if (error) throw error;
  return data as string;
}
const CAMPOS_GRAVAVEIS = [
  "numero", "titulo", "unidade", "cliente_id", "cliente_nome", "cliente_documento", "cliente_email", "cliente_telefone", "cliente_endereco",
  "oportunidade_id", "proposta_id", "valor", "entrada", "entrada_vencimento", "parcelas", "primeiro_vencimento", "forma_pagamento",
  "data_contrato", "observacoes", "dados",
] as const;
export async function salvarContrato(x: Partial<Contrato>): Promise<Contrato> {
  const db = supabase();
  const reg: Record<string, unknown> = {};
  for (const k of CAMPOS_GRAVAVEIS) if (k in x) reg[k] = (x as Record<string, unknown>)[k] === "" && /(_id|vencimento)$/.test(k) ? null : (x as Record<string, unknown>)[k];
  if (typeof reg.cliente_documento === "string") reg.cliente_documento = reg.cliente_documento.replace(/\D/g, "");
  const q = x.id ? db.from("contratos").update(reg).eq("id", x.id) : db.from("contratos").insert(reg);
  const { data, error } = await q.select(COLS).single();
  if (error) throw error;
  if (!x.id) await registrar(data.id, "criado", "Contrato criado");
  return norm(data);
}
export async function excluirContrato(id: string) {
  const { error } = await supabase().from("contratos").delete().eq("id", id);
  if (error) throw error;
}
export async function registrar(contrato_id: string, tipo: string, descricao: string) {
  await supabase().from("contrato_eventos").insert({ contrato_id, tipo, descricao });
}
export function ouvirContrato(id: string, aoMudar: () => void) {
  const db = supabase();
  const ch = db.channel("contrato-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "contratos", filter: `id=eq.${id}` }, aoMudar)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "contrato_eventos", filter: `contrato_id=eq.${id}` }, aoMudar)
    .subscribe();
  return () => { db.removeChannel(ch); };
}

// ------------------------------------------------------------------ configuração e modelos
export async function lerConfig(): Promise<ConfigContratos> {
  const { data } = await supabase().from("config_empresa").select("valor").eq("chave", "contratos").maybeSingle();
  const v = (data?.valor ?? {}) as Partial<ConfigContratos>;
  return { ...CONFIG_VAZIA, ...v, representante: { ...CONFIG_VAZIA.representante, ...v.representante }, assinante_bra: { ...CONFIG_VAZIA.assinante_bra, ...v.assinante_bra } };
}
export async function gravarConfig(c: ConfigContratos) {
  const { error } = await supabase().from("config_empresa").upsert({ chave: "contratos", valor: c, updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function listarModelos(): Promise<Modelo[]> {
  const { data, error } = await supabase().from("contrato_modelos").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Modelo[];
}
export async function enviarModelo(arquivo: File, nome: string, padrao: boolean) {
  const db = supabase();
  const caminho = `contratos/modelos/${Date.now().toString(36)}-${arquivo.name.replace(/[^\w.-]+/g, "_")}`;
  const up = await db.storage.from("documentos").upload(caminho, arquivo, { contentType: arquivo.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  if (up.error) throw up.error;
  if (padrao) await db.from("contrato_modelos").update({ padrao: false }).eq("padrao", true);
  const { error } = await db.from("contrato_modelos").insert({ nome, arquivo_path: caminho, padrao });
  if (error) throw error;
}
export async function definirPadrao(id: string | null) {
  const db = supabase();
  await db.from("contrato_modelos").update({ padrao: false }).eq("padrao", true);
  if (id) { const { error } = await db.from("contrato_modelos").update({ padrao: true }).eq("id", id); if (error) throw error; }
}
export async function baixarModelo(m: Modelo | null): Promise<ArrayBuffer> {
  if (!m) { const r = await fetch(MODELO_PADRAO); if (!r.ok) throw new Error("Modelo padrão não encontrado."); return r.arrayBuffer(); }
  const { data, error } = await supabase().storage.from("documentos").download(m.arquivo_path);
  if (error) throw error;
  return data.arrayBuffer();
}

// ------------------------------------------------------------------ arquivos
const nomeSeguro = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(0, 60);
export function nomeArquivo(c: Contrato, ext = "docx") { return `Contrato_${nomeSeguro(c.numero || "sem_numero")}_${nomeSeguro(c.cliente_nome || "cliente")}.${ext}`; }

/** Gera o Word a partir do modelo, guarda no Núcleo e devolve o arquivo. */
export async function gerarArquivo(c: Contrato, cfg: ConfigContratos, modelo: Modelo | null): Promise<{ blob: Blob; contrato: Contrato }> {
  const blob = preencherDocx(await baixarModelo(modelo), dadosDoModelo(c, cfg));
  return { blob, contrato: await guardarArquivo(c, blob, nomeArquivo(c), "gerado", `Contrato gerado no Word (${modelo ? "modelo " + modelo.nome : "modelo padrão BRA"})`) };
}
/** Substitui o arquivo do contrato (ex.: versão ajustada no Word, ou PDF). */
export async function anexarArquivo(c: Contrato, arquivo: File): Promise<Contrato> {
  const ext = (arquivo.name.split(".").pop() ?? "").toLowerCase();
  if (!["docx", "pdf", "doc"].includes(ext)) throw new Error("Envie o contrato em Word (.docx) ou PDF.");
  return guardarArquivo(c, arquivo, arquivo.name, "arquivo", `Arquivo substituído por "${arquivo.name}"`);
}
async function guardarArquivo(c: Contrato, blob: Blob, nome: string, tipo: string, descricao: string): Promise<Contrato> {
  const db = supabase();
  const ext = (nome.split(".").pop() ?? "docx").toLowerCase();
  const caminho = `contratos/${c.id}/${Date.now().toString(36)}-${nomeSeguro(nome.replace(/\.[^.]+$/, ""))}.${ext}`;
  const up = await db.storage.from("documentos").upload(caminho, blob, { contentType: blob.type || undefined });
  if (up.error) throw up.error;
  const { data, error } = await db.from("contratos").update({ arquivo_path: caminho, arquivo_nome: nome }).eq("id", c.id).select(COLS).single();
  if (error) throw error;
  await registrar(c.id, tipo, descricao);
  return norm(data);
}
export async function linkArquivo(caminho: string, baixarComo?: string) {
  const { data, error } = await supabase().storage.from("documentos").createSignedUrl(caminho, 600, baixarComo ? { download: baixarComo } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
export function baixarBlob(blob: Blob, nome: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ------------------------------------------------------------------ assinatura (manual)
async function mudar(c: Contrato, campos: Record<string, unknown>, tipo: string, descricao: string): Promise<Contrato> {
  const { data, error } = await supabase().from("contratos").update(campos).eq("id", c.id).select(COLS).single();
  if (error) throw error;
  await registrar(c.id, tipo, descricao);
  return norm(data);
}
/** Marca que o contrato foi enviado para assinatura (pelo DocuSign, por fora). */
export const marcarEnviado = (c: Contrato, quando: string) =>
  mudar(c, { status: "enviado", enviado_em: new Date(quando + "T12:00:00").toISOString(), recusa_motivo: null }, "enviado", `Enviado para assinatura no DocuSign em ${dataTxt(quando)}`);
export const marcarRecusado = (c: Contrato, motivo: string) =>
  mudar(c, { status: "recusado", recusa_motivo: motivo || "Recusado" }, "recusado", "Assinatura recusada" + (motivo ? `: ${motivo}` : ""));
export const voltarRascunho = (c: Contrato) => mudar(c, { status: "rascunho" }, "editado", "Voltou para rascunho");
export const cancelarContrato = (c: Contrato, motivo: string) =>
  mudar(c, { status: "cancelado" }, "cancelado", "Contrato cancelado" + (motivo ? `: ${motivo}` : ""));
/** Anexa o PDF assinado (baixado do DocuSign) e marca o contrato como assinado. */
export async function anexarAssinado(c: Contrato, arquivo: File, quando: string): Promise<Contrato> {
  if (!/\.pdf$/i.test(arquivo.name)) throw new Error("Envie o contrato assinado em PDF (como o DocuSign entrega).");
  const db = supabase();
  const caminho = `contratos/${c.id}/assinado-${Date.now().toString(36)}-${nomeSeguro(c.numero || "contrato")}.pdf`;
  const up = await db.storage.from("documentos").upload(caminho, arquivo, { contentType: "application/pdf" });
  if (up.error) throw up.error;
  return mudar(c, { status: "assinado", assinado_path: caminho, assinado_em: new Date(quando + "T12:00:00").toISOString(), recusa_motivo: null },
    "assinado", `Contrato assinado em ${dataTxt(quando)} — PDF "${arquivo.name}" anexado`);
}

// ------------------------------------------------------------------ Financeiro (v38)
export function parcelasFinanceiro(c: Contrato, p: { forma: string; conta: string; comissoes: { n: string; r: string; p: number }[] }) {
  const cr = cronograma(c);
  const who = c.cliente_nome.trim().replace(/\s+/g, " ");
  const desc = `${c.cliente_nome}${c.unidade ? " - " + c.unidade : ""} · Contrato ${c.numero}`;
  return cr.map((x, i) => ({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i, t: "r", desc, who,
    forma: p.forma, valor: x.valor, venc: x.venc, pago: null,
    par: cr.length > 1 ? (x.rotulo === "Entrada" ? "Entrada" : x.rotulo) : "",
    com: "", pct: 0, coms: p.comissoes.filter((k) => k.n && k.p), nfr: "", ...(p.conta ? { conta: p.conta } : {}),
  }));
}
export async function lancarContratoNoFinanceiro(c: Contrato, itens: Record<string, unknown>[], usuario: string) {
  const db = supabase();
  const tot = itens.reduce((s, x) => s + Number(x.valor), 0);
  const { error } = await db.from("fin_docs").insert([
    ...itens.map((x) => ({ colecao: "it", id: String(x.id), dados: x })),
    { colecao: "log", id: "ct" + Date.now().toString(36), dados: { ts: new Date().toISOString(), u: usuario, a: `Lançou recebível pelo Contrato ${c.numero}: ${c.cliente_nome} · ${reaisTxt(tot)}${itens.length > 1 ? " em " + itens.length + " parcelas" : ""}` } },
  ]);
  if (error) throw error;
  const agora = new Date().toISOString();
  const r = await db.from("contratos").update({ financeiro_lancado_em: agora }).eq("id", c.id);
  if (r.error) throw r.error;
  if (c.oportunidade_id) await db.from("oportunidades").update({ financeiro_lancado_em: agora }).eq("id", c.oportunidade_id);
  await registrar(c.id, "financeiro", `${itens.length} parcela(s) lançadas no Financeiro (${reaisTxt(tot)})`);
}

