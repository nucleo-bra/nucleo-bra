"use client";
// Pasta do negócio (cartão do CRM): orçamentos do Zenith lidos automaticamente,
// contratos e qualquer outro arquivo do cliente.
import { sha256 } from "./importacao/util";
import { modoDemo, supabase } from "./supabase";

export type Arquivo = { id: string; tipo: string; nome: string; tamanho_bytes: number | null; storage_path: string | null; created_at: string };
export type Orcamento = {
  id: string; numero: string; versao: string | null; titulo: string | null; data_emissao: string; total_final: number;
  total_itens: number; condicoes_pagamento: string | null; status: string; documento_id: string | null; projeto: string | null;
  sistemas: { nome: string; total: number }[];
  /** quantos itens tem (0 = só o PDF que veio do Zenith) e o arquivo original */
  itens: number; arquivo_path: string | null; arquivo_nome: string | null; origem: string; editado_em: string | null;
};
export type ContratoPasta = { id: string; numero: string; status: string; valor: number; arquivo_path: string | null; arquivo_nome: string | null; assinado_path: string | null; assinado_em: string | null };
export type Pasta = { arquivos: Arquivo[]; orcamentos: Orcamento[]; contratos: ContratoPasta[]; doCliente: (Arquivo & { negocio: string | null })[] };

export async function abrirPasta(negocioId: string, clienteId?: string | null): Promise<Pasta> {
  if (modoDemo) return { arquivos: [], orcamentos: [], contratos: [], doCliente: [] };
  const db = supabase();
  const [d, p, c, dc] = await Promise.all([
    db.from("documentos").select("id, tipo, nome, tamanho_bytes, storage_path, created_at").eq("oportunidade_id", negocioId).order("created_at", { ascending: false }),
    db.from("propostas").select("id, numero, versao, titulo, origem, editado_em, data_emissao, total_final, total_itens, condicoes_pagamento, status, documento_id, projetos(nome), documentos(nome, storage_path), proposta_itens(sistema, valor_total)")
      .eq("oportunidade_id", negocioId).order("editado_em", { ascending: false }),
    db.from("contratos").select("id, numero, status, valor, arquivo_path, arquivo_nome, assinado_path, assinado_em").eq("oportunidade_id", negocioId).order("created_at", { ascending: false }),
    clienteId
      ? db.from("documentos").select("id, tipo, nome, tamanho_bytes, storage_path, created_at, oportunidade_id, oportunidades(titulo, numero)").eq("cliente_id", clienteId).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [d, p, c, dc]) if (r.error) throw r.error;
  const orcamentos = (p.data ?? []).map((o) => {
    const mapa = new Map<string, number>();
    for (const i of (o.proposta_itens ?? []) as { sistema: string; valor_total: number }[]) mapa.set(i.sistema, (mapa.get(i.sistema) ?? 0) + Number(i.valor_total));
    return {
      id: o.id, numero: o.numero, versao: o.versao, titulo: o.titulo, data_emissao: o.data_emissao, total_final: Number(o.total_final),
      total_itens: Number(o.total_itens), condicoes_pagamento: o.condicoes_pagamento, status: o.status, documento_id: o.documento_id,
      projeto: (o.projetos as unknown as { nome: string } | null)?.nome ?? null,
      sistemas: [...mapa].map(([nome, total]) => ({ nome, total })),
      itens: (o.proposta_itens ?? []).length, origem: o.origem, editado_em: o.editado_em,
      arquivo_path: (o.documentos as unknown as { storage_path: string | null } | null)?.storage_path ?? null,
      arquivo_nome: (o.documentos as unknown as { nome: string } | null)?.nome ?? null,
    };
  });
  const daqui = new Set((d.data ?? []).map((x) => x.id));
  const doCliente = ((dc.data ?? []) as Record<string, unknown>[]).filter((x) => !daqui.has(x.id as string) && x.oportunidade_id !== negocioId).map((x) => {
    const op = x.oportunidades as { titulo: string; numero: number | null } | null;
    return { ...(x as unknown as Arquivo), negocio: op ? `${op.numero ? op.numero + " - " : ""}${op.titulo}` : null };
  });
  return { arquivos: (d.data ?? []) as Arquivo[], orcamentos, contratos: (c.data ?? []).map((x) => ({ ...x, valor: Number(x.valor) })) as ContratoPasta[], doCliente };
}

/**
 * Sobe um arquivo para a pasta do negócio. Orçamento do Zenith (PDF) é lido e
 * vira proposta ligada ao negócio; o valor do negócio passa a ser o total do orçamento.
 */
export async function subirNaPasta(negocio: { id: string; cliente_id: string | null }, arquivo: File):
  Promise<{ tipo: "orcamento"; numero: string; versao?: string; total: number; cliente_id: string | null } | { tipo: "arquivo" }> {
  const db = supabase();
  if (/\.pdf$/i.test(arquivo.name)) {
    const { lerArquivo, confirmarImportacao } = await import("./importacao/servico");
    let lido: Awaited<ReturnType<typeof lerArquivo>> | null = null;
    try { lido = await lerArquivo(arquivo); } catch { lido = null; }
    if (lido?.leitura.tipo === "proposta") {
      const extras = negocio.cliente_id ? { cliente_id: negocio.cliente_id } : {};
      const propostaId = await confirmarImportacao(lido, extras);
      await db.from("propostas").update({ oportunidade_id: negocio.id }).eq("id", propostaId);
      const { data: pr } = await db.from("propostas").select("cliente_id, total_final").eq("id", propostaId).single();
      await db.from("documentos").update({ oportunidade_id: negocio.id, cliente_id: negocio.cliente_id ?? pr?.cliente_id ?? null }).eq("sha256", lido.hash);
      const total = Number(pr?.total_final ?? lido.leitura.dados.total_final / 100);
      await db.from("oportunidades").update({ valor_estimado: total, ...(negocio.cliente_id ? {} : { cliente_id: pr?.cliente_id }) }).eq("id", negocio.id);
      return { tipo: "orcamento", numero: lido.leitura.dados.numero, versao: lido.leitura.dados.versao, total, cliente_id: pr?.cliente_id ?? negocio.cliente_id };
    }
  }
  const hash = await sha256(await arquivo.arrayBuffer());
  const caminho = `crm/${negocio.id}/${Date.now().toString(36)}-${arquivo.name.replace(/[^\w.\-]+/g, "_")}`;
  const up = await db.storage.from("documentos").upload(caminho, arquivo, { contentType: arquivo.type || undefined });
  if (up.error) throw up.error;
  const tipo = /contrato/i.test(arquivo.name) ? "contrato" : /\.(jpe?g|png|heic|webp)$/i.test(arquivo.name) ? "foto" : /proposta|or[çc]amento/i.test(arquivo.name) ? "proposta" : "outro";
  const { error } = await db.from("documentos").insert({
    tipo, nome: arquivo.name, mime: arquivo.type || null, tamanho_bytes: arquivo.size, sha256: hash, storage_path: caminho,
    oportunidade_id: negocio.id, cliente_id: negocio.cliente_id,
  });
  if (error) throw error;
  return { tipo: "arquivo" };
}

export async function linkDocumento(caminho: string, baixarComo?: string) {
  const { data, error } = await supabase().storage.from("documentos").createSignedUrl(caminho, 600, baixarComo ? { download: baixarComo } : undefined);
  if (error) throw error;
  return data.signedUrl;
}
