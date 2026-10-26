"use client";
// Orquestra a importação: identifica o arquivo, lê, e — após a conferência —
// grava tudo de uma vez (arquivo no Storage + registro + vínculos).
import { modoDemo, supabase } from "../supabase";
import { lerNotaFiscalXml, NotaFiscalLida } from "./nota-fiscal";
import { BoletoLido, lerBoleto } from "./boleto";
import { lerPropostaZenith, PropostaLida } from "./proposta-zenith";
import { extrairLinhasPdf } from "./pdf-texto";
import { centavosParaDecimal as dec, sha256 } from "./util";

export type Leitura =
  | { tipo: "nota"; dados: NotaFiscalLida }
  | { tipo: "boleto"; dados: BoletoLido }
  | { tipo: "proposta"; dados: PropostaLida };

export type ArquivoLido = { arquivo: File; hash: string; leitura: Leitura };

export async function lerArquivo(arquivo: File): Promise<ArquivoLido> {
  const buffer = await arquivo.arrayBuffer();
  const hash = await sha256(buffer);
  const nome = arquivo.name.toLowerCase();

  if (nome.endsWith(".xml") || arquivo.type.includes("xml")) {
    return { arquivo, hash, leitura: { tipo: "nota", dados: lerNotaFiscalXml(new TextDecoder("utf-8").decode(buffer)) } };
  }
  if (nome.endsWith(".pdf") || arquivo.type === "application/pdf") {
    const linhas = await extrairLinhasPdf(buffer);
    const texto = linhas.map((l) => l.texto).join("\n");
    if (/\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14}/.test(texto))
      return { arquivo, hash, leitura: { tipo: "boleto", dados: lerBoleto(linhas.map((l) => l.texto)) } };
    if (/Unit\.\s*R\$/.test(texto) && /Total final/i.test(texto))
      return { arquivo, hash, leitura: { tipo: "proposta", dados: lerPropostaZenith(linhas) } };
    if (/NFS-e|Nota Fiscal de Servi/i.test(texto))
      throw new Error("Este é o PDF da nota. Envie o XML da NF (baixado na Omie) — ele tem os dados oficiais. O PDF pode ir junto, como anexo.");
    throw new Error("Não reconheci este PDF. Hoje o Núcleo lê propostas do Zenith e boletos bancários.");
  }
  throw new Error("Formato não suportado. Envie XML de nota fiscal ou PDF de proposta/boleto.");
}

const TIPO_IMPORTACAO = { nota: "nfse_xml", boleto: "boleto_pdf", proposta: "proposta_zenith" } as const;
const TIPO_DOCUMENTO = { nota: "nota_fiscal", boleto: "boleto", proposta: "proposta" } as const;

/** Converte a leitura (em centavos) para o formato que o banco espera */
function paraBanco(l: Leitura, extras: Record<string, unknown>) {
  if (l.tipo === "nota") {
    const d = l.dados;
    return {
      tipo: d.tipo, numero: d.numero, serie: d.serie, codigo_verificacao: d.codigo_verificacao, chave_acesso: d.chave_acesso,
      rps_numero: d.rps_numero, prestador_cnpj: d.prestador.cnpj, emitida_em: d.emitida_em, competencia: d.competencia,
      valor_servicos: dec(d.valor_servicos), valor_deducoes: dec(d.valor_deducoes),
      base_calculo: d.base_calculo !== undefined ? dec(d.base_calculo) : null, aliquota_iss: d.aliquota_iss ?? null,
      valor_iss: d.valor_iss !== undefined ? dec(d.valor_iss) : null, iss_retido: d.iss_retido, valor_liquido: dec(d.valor_liquido),
      codigo_servico: d.codigo_servico, descricao_servico: d.descricao_servico, discriminacao: d.discriminacao, ordem_compra: d.ordem_compra,
      parcelas: d.parcelas.map((p) => ({ vencimento: p.vencimento, valor: dec(p.valor) })),
      tomador: d.tomador, ...extras,
    };
  }
  if (l.tipo === "boleto") {
    const d = l.dados;
    return { ...d, valor: dec(d.valor), alertas: undefined, ...extras };
  }
  const d = l.dados;
  return {
    numero: d.numero, versao: d.versao, titulo: d.titulo, cliente_nome: d.cliente_nome, projeto_nome: d.projeto_nome,
    data_emissao: d.data_emissao, total_produtos: dec(d.total_produtos), total_servicos: dec(d.total_servicos),
    total_itens: dec(d.total_itens), total_final: dec(d.total_final), condicoes_pagamento: d.condicoes_pagamento,
    itens: d.itens.map((i) => ({ ...i, valor_unitario: dec(i.valor_unitario), valor_total: dec(i.valor_total) })),
    ...extras,
  };
}

export async function confirmarImportacao(lido: ArquivoLido, extras: Record<string, unknown> = {}): Promise<string> {
  if (modoDemo) {
    await new Promise((r) => setTimeout(r, 600));
    return "demo";
  }
  const db = supabase();
  const { leitura, arquivo, hash } = lido;
  const dados = paraBanco(leitura, extras);

  // 1. arquivo original no Storage (pasta por tipo e mês)
  const mes = new Date().toISOString().slice(0, 7);
  const caminho = `${TIPO_DOCUMENTO[leitura.tipo]}/${mes}/${hash.slice(0, 12)}-${arquivo.name.replace(/[^\w.\-]+/g, "_")}`;
  const up = await db.storage.from("documentos").upload(caminho, arquivo, { upsert: false, contentType: arquivo.type || undefined });
  if (up.error && !/exists/i.test(up.error.message)) throw up.error;

  // 2. registro da importação (fica no histórico mesmo se a confirmação falhar)
  const imp = await db.from("importacoes")
    .insert({ tipo: TIPO_IMPORTACAO[leitura.tipo], arquivo_nome: arquivo.name, arquivo_sha256: hash, dados, alertas: leitura.dados.alertas })
    .select("id").single();
  if (imp.error) throw imp.error;

  // 3. confirmação atômica no banco (tudo ou nada)
  const fn = { nota: "confirmar_nota", boleto: "confirmar_boleto", proposta: "confirmar_proposta" }[leitura.tipo];
  const rpc = await db.rpc(fn, { p_importacao: imp.data.id, p_dados: dados });
  if (rpc.error) throw rpc.error;

  // 4. arquivo vinculado ao registro criado
  const doc = await db.from("documentos").insert({
    tipo: TIPO_DOCUMENTO[leitura.tipo], nome: arquivo.name, mime: arquivo.type, tamanho_bytes: arquivo.size,
    sha256: hash, storage_path: caminho,
  }).select("id").single();
  if (!doc.error) {
    const campo = { nota: ["notas_fiscais", "xml_documento_id"], boleto: ["titulos", "boleto_documento_id"], proposta: ["propostas", "documento_id"] }[leitura.tipo];
    await db.from(campo[0]).update({ [campo[1]]: doc.data.id }).eq("id", rpc.data);
  }
  return rpc.data as string;
}

/** Verifica antes da conferência se o arquivo já foi importado */
export async function jaImportado(hash: string): Promise<boolean> {
  if (modoDemo) return false;
  const { count } = await supabase().from("importacoes").select("id", { count: "exact", head: true })
    .eq("arquivo_sha256", hash).eq("status", "confirmada");
  return (count ?? 0) > 0;
}
