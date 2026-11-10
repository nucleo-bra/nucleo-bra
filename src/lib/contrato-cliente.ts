"use client";
// Lê o contrato enviado (PDF ou Word) e atualiza o cadastro do cliente com os
// dados da qualificação: nome, CPF/CNPJ, nascimento, endereço, e-mail e telefone.
import type { Cliente } from "./clientes";

export type DadosContrato = Partial<Pick<Cliente, "nome" | "documento" | "data_nascimento" | "email" | "telefone" | "cep" | "logradouro" | "numero" | "complemento" | "bairro" | "cidade" | "uf">>;
export const ROTULOS: Record<keyof DadosContrato, string> = {
  nome: "Nome", documento: "CPF / CNPJ", data_nascimento: "Data de nascimento", email: "E-mail", telefone: "Telefone",
  cep: "CEP", logradouro: "Endereço", numero: "Número", complemento: "Complemento", bairro: "Bairro", cidade: "Cidade", uf: "UF",
};

const limpa = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s:–—-]+|[\s.;,–—-]+$/g, "").trim();
const UFS = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";

/** Quebra "Avenida José Paulino, 4193 – Bairro Santa Terezinha, Paulínia – SP CEP 13.140-818". */
export function lerEndereco(txt: string): DadosContrato {
  let s = " " + txt.replace(/\s+/g, " ").trim() + " ";
  const r: DadosContrato = {};
  const cep = s.match(/(?:CEP[:\s]*)?(\d{2}\.?\d{3}-?\d{3})/i);
  if (cep) { const d = cep[1].replace(/\D/g, ""); r.cep = `${d.slice(0, 5)}-${d.slice(5)}`; s = s.replace(cep[0], " "); }
  const uf = s.match(new RegExp(`[\\s,/–—-]+(${UFS})(?=[\\s,.;–—-]*$|[\\s,.;–—-]+(?:CEP|Brasil))`, "i"));
  let cidade = "";
  if (uf) {
    r.uf = uf[1].toUpperCase();
    const antes = s.slice(0, uf.index!);
    const m = antes.match(/[,–—-]\s*([^,–—-]+?)\s*$/);
    if (m) { cidade = limpa(m[1]); s = antes.slice(0, m.index!) + " "; } else s = antes;
  }
  if (cidade) r.cidade = cidade.replace(/^(cidade de|município de)\s+/i, "");
  const bairro = s.match(/(?:Bairro|B\.)\s*:?\s*([^,–—]+)/i);
  if (bairro) { r.bairro = limpa(bairro[1]); s = s.replace(bairro[0], " "); }
  const partes = s.split(/\s*[,–—]\s*/).map(limpa).filter(Boolean);
  if (partes.length) {
    // "Rua X, 123" ou "Rua X nº 123"
    let rua = partes.shift()!;
    const num = rua.match(/\s+(?:n[ºo°.]?\s*)?(\d+[A-Za-z]?|s\/n)$/i);
    if (num) { r.numero = num[1]; rua = rua.slice(0, num.index); }
    else if (partes[0] && /^(?:n[ºo°.]?\s*)?(\d+[A-Za-z]?|s\/n)$/i.test(partes[0])) r.numero = partes.shift()!.replace(/^n[ºo°.]?\s*/i, "");
    r.logradouro = limpa(rua);
    const resto = partes.filter((p) => !/^(Brasil)$/i.test(p));
    if (!r.bairro && resto.length > 1) r.bairro = resto.pop();
    if (resto.length) r.complemento = resto.join(", ");
  }
  return Object.fromEntries(Object.entries(r).filter(([, v]) => v)) as DadosContrato;
}

/** Procura a qualificação do cliente no texto do contrato (modelo BRA e variações). */
export function lerDadosContrato(texto: string): DadosContrato {
  const t = texto.replace(/\r/g, "").replace(/[ \t ]+/g, " ");
  // trecho do cliente: de "CLIENTE:"/"CONTRATANTE:" até "Doravante"
  // (maiúsculas: o cabeçalho "Cliente: Fulano" não conta; a fornecedora vem antes)
  let ini = t.search(/\n\s*(CLIENTE|CONTRATANTE)\s*:\s*\n/);
  if (ini < 0) ini = t.search(/\n\s*(CLIENTE|CONTRATANTE)\s*:/);
  if (ini < 0) { const k = t.search(/Nome completo\s*:/i); ini = k >= 0 ? k - 1 : -1; }
  const bloco = ini >= 0 ? t.slice(ini, ini + 1600).split(/Doravante|II\.\s*DO OBJETO/i)[0] : t;
  const campo = (re: RegExp) => { const m = bloco.match(re); return m ? limpa(m[1]) : ""; };
  const r: DadosContrato = {};
  const nome = campo(/(?:Nome completo|Nome|Razão social)\s*:\s*([^\n]+)/i);
  if (nome && !/\{|\}/.test(nome)) r.nome = nome;
  const doc = (campo(/(?:CPF\s*\/\s*CNPJ|CNPJ\s*\/\s*CPF|CPF|CNPJ)\s*(?:n[ºo°]?|sob o n[ºo°])?\s*:?\s*([\d./-]{11,20})/i) || "").replace(/\D/g, "");
  if (doc.length === 11 || doc.length === 14) r.documento = doc;
  const nasc = campo(/(?:Data de nascimento|Nascimento|Nascido\(a\) em)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (nasc) { const [d, m, a] = nasc.split("/"); if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) r.data_nascimento = `${a}-${m}-${d}`; }
  const email = bloco.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) r.email = email[0].toLowerCase();
  const tel = campo(/(?:Telefone|Celular|WhatsApp|Tel\.?)\s*:?\s*(\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4})/i);
  if (tel) r.telefone = tel;
  // endereço pode quebrar em mais de uma linha
  const end = bloco.match(/(?:Endereço|Residente e domiciliad[oa] (?:na|no|à|em)|com sede (?:na|no|à|em))\s*:?\s*([\s\S]+?)(?:\n\s*\n|\n\s*(?:E-?mail|Telefone|Celular|Doravante|Nome|CPF)|$)/i);
  if (end) { const e = limpa(end[1].replace(/\n/g, " ")); if (e && !/\{|\}/.test(e)) Object.assign(r, lerEndereco(e)); }
  return r;
}

/** Texto de um contrato em PDF ou Word. */
export async function textoDoArquivo(arquivo: Blob, nome: string): Promise<string> {
  if (/\.pdf$/i.test(nome) || arquivo.type === "application/pdf") {
    const { extrairLinhasPdf } = await import("./importacao/pdf-texto");
    const linhas = await extrairLinhasPdf(await arquivo.arrayBuffer());
    return linhas.map((l) => l.texto).join("\n");
  }
  if (/\.docx$/i.test(nome)) {
    const { default: PizZip } = await import("pizzip");
    const xml = new PizZip(await arquivo.arrayBuffer()).file("word/document.xml")?.asText() ?? "";
    return xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, " ").replace(/<w:br\/>/g, "\n").replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }
  return "";
}

export type Mudanca = { campo: keyof DadosContrato; rotulo: string; antes: string; depois: string };
const norm = (k: keyof DadosContrato, v: string) => {
  const s = String(v ?? "").trim();
  if (k === "documento" || k === "cep" || k === "telefone") return s.replace(/\D/g, "");
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
};
/** O que muda no cadastro (só campos lidos do contrato e diferentes do atual). */
export function mudancas(atual: Partial<Cliente>, lido: DadosContrato): Mudanca[] {
  return (Object.keys(ROTULOS) as (keyof DadosContrato)[])
    .filter((k) => lido[k] && norm(k, lido[k]!) !== norm(k, String(atual[k] ?? "")))
    .map((k) => ({ campo: k, rotulo: ROTULOS[k], antes: String(atual[k] ?? ""), depois: lido[k]! }));
}

// ------------------------------------------------------------------ aplicar no cadastro
export type ResultadoCadastro = { clienteId: string; nome: string; mudancas: Mudanca[]; antes: Partial<Cliente> | null; criado: boolean };

/**
 * Lê o contrato enviado e atualiza o cadastro do cliente (cria se ainda não existir),
 * o próprio contrato e a obra. Devolve o que mudou (para mostrar e poder desfazer).
 */
export async function atualizarCadastroPeloContrato(
  c: { id: string; cliente_id: string | null; cliente_nome: string; cliente_documento: string; cliente_email: string; cliente_telefone: string; cliente_endereco: string; dados?: Record<string, unknown> },
  arquivo: Blob, nome: string,
): Promise<ResultadoCadastro | null> {
  const { modoDemo, supabase } = await import("./supabase");
  if (modoDemo) return null;
  const { gravarCliente, lerCliente, enderecoLinha } = await import("./clientes");
  let lido: DadosContrato = {};
  try { lido = lerDadosContrato(await textoDoArquivo(arquivo, nome)); } catch { /* PDF só com imagem: usa os dados do contrato */ }
  // o que o documento não trouxe, vem dos dados do próprio contrato
  const doContrato: DadosContrato = {
    nome: c.cliente_nome || undefined, documento: (c.cliente_documento || "").replace(/\D/g, "") || undefined,
    email: c.cliente_email || undefined, telefone: c.cliente_telefone || undefined,
    data_nascimento: String(c.dados?.cliente_nascimento ?? "") || undefined,
    ...(c.cliente_endereco && !lido.logradouro ? lerEndereco(c.cliente_endereco) : {}),
  };
  const novo: DadosContrato = { ...Object.fromEntries(Object.entries(doContrato).filter(([, v]) => v)), ...lido };
  if (!novo.nome && !novo.documento) return null;
  const db = supabase();
  let atual: Partial<Cliente> | null = c.cliente_id ? await lerCliente(c.cliente_id) : null;
  if (!atual && novo.documento) { const { data } = await db.from("clientes").select("id").eq("documento", novo.documento).maybeSingle(); if (data) atual = await lerCliente(data.id); }
  const mud = mudancas(atual ?? {}, novo);
  let cliente = atual as Cliente | null;
  if (mud.length || !atual) {
    const campos = Object.fromEntries(mud.map((m) => [m.campo, m.depois]));
    cliente = await gravarCliente({ ...(atual ?? {}), ...(atual ? {} : novo), ...campos, nome: (campos.nome as string) ?? atual?.nome ?? novo.nome ?? "Cliente" });
  }
  if (!cliente) return null;
  // contrato e obra passam a apontar para o cadastro, com os dados do documento
  const endereco = enderecoLinha(cliente);
  await db.from("contratos").update({
    cliente_id: cliente.id, cliente_nome: cliente.nome, cliente_documento: cliente.documento || c.cliente_documento || null,
    cliente_endereco: endereco || c.cliente_endereco || null,
    dados: { ...(c.dados ?? {}), ...(cliente.data_nascimento ? { cliente_nascimento: cliente.data_nascimento } : {}) },
  }).eq("id", c.id);
  await db.from("obras").update({ cliente_id: cliente.id, cliente_nome: cliente.nome, ...(endereco ? { endereco } : {}), ...(cliente.telefone ? { telefone: cliente.telefone } : {}) }).eq("contrato_id", c.id);
  if (!mud.length && atual) return null;
  return { clienteId: cliente.id, nome: cliente.nome, mudancas: atual ? mud : mudancas({}, novo), antes: atual, criado: !atual };
}

/** Volta o cadastro como estava antes da leitura do contrato. */
export async function desfazerCadastro(r: ResultadoCadastro) {
  if (!r.antes) return;
  const { gravarCliente } = await import("./clientes");
  await gravarCliente(r.antes);
}
