"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco chegam sem tipo; convertidas campo a campo */
// Orçamentos no formato do Zenith: ambientes, produtos, serviços e produtos do
// cliente, markup adicional, desconto e condições de pagamento.
import { modoDemo, supabase } from "./supabase";

export type Produto = {
  id: string; codigo: number | null; nome: string; modelo: string; marca: string; categoria: string; unidade: string;
  descricao: string; preco_venda: number; custo: number; valor_compra: number; impostos_pct: number; fator_venda: number;
  imagem_path: string | null; fornecedor: string; ncm: string; garantia_dias: number | null; estoque_minimo: number;
  local_estoque: string; medidas: string; peso: string; voltagem: string; cor: string; referencia: string; codigo_barras: string;
  ativo: boolean; saldo: number;
};
export type Servico = { id: string; codigo: number | null; nome: string; categoria: string; descricao: string; unidade: string; valor: number; custo: number; ativo: boolean };

export type TipoItem = "produto" | "servico" | "cliente";
export type Item = {
  chave: string; tipo: TipoItem; produto_id: string | null; servico_id: string | null;
  descricao: string; detalhe: string; sku: string; marca: string; unidade: string;
  quantidade: number; valor_unitario: number; valor_tabela: number | null; ambiente: string;
};
export type StatusOrc = "rascunho" | "enviada" | "aprovada" | "recusada" | "substituida";
export type Orcamento = {
  id: string | null; origem: "zenith" | "nucleo"; numero: string; versao: string; titulo: string;
  oportunidade_id: string | null; cliente_id: string | null; projeto_id: string | null;
  cliente_nome: string; negocio_titulo: string; negocio_numero: number | null;
  data_emissao: string; editado_em: string; status: StatusOrc;
  ambientes: string[]; itens: Item[];
  markup_produto_pct: number; markup_servico_pct: number; desconto_pct: number; desconto_valor: number | null;
  formas_pagamento: string[]; validade_dias: number; resumo_entrega: string; observacoes: string;
  comodato_prazo: number | null; comodato_taxa: number | null;
  total_final: number;
};
export type ResumoOrc = { id: string; origem: string; numero: string; versao: string; titulo: string; status: StatusOrc; total_final: number; data_emissao: string; editado_em: string; oportunidade_id: string | null; cliente: string; negocio: string; negocio_numero: number | null; documento_id: string | null; itens: number };

export const FORMAS_PAGAMENTO = ["A vista", ...Array.from({ length: 24 }, (_, i) => `${i + 1}x`), "A combinar"];
export const STATUS_ORC: Record<StatusOrc, { rot: string; cor: string }> = {
  rascunho: { rot: "Rascunho", cor: "#a3adc2" }, enviada: { rot: "Elaborada", cor: "#2f6fb5" }, aprovada: { rot: "Ganha", cor: "#12a150" },
  recusada: { rot: "Perdida", cor: "#d64545" }, substituida: { rot: "Substituída", cor: "#7c5cd6" },
};
export const AMBIENTES_SUGERIDOS = ["Automação", "Rede Estruturada", "Segurança", "Sonorização", "Home Theater", "Painel de Led", "Controle de acesso", "Climatização", "Mão de obra"];

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export const totalItem = (i: Pick<Item, "tipo" | "quantidade" | "valor_unitario">) => (i.tipo === "cliente" ? 0 : r2((Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0)));

/** Totais na mesma ordem da aba "Totais" do Zenith. */
export function calcularTotais(o: Pick<Orcamento, "itens" | "markup_produto_pct" | "markup_servico_pct" | "desconto_pct" | "desconto_valor">) {
  const produtos = r2(o.itens.filter((i) => i.tipo === "produto").reduce((s, i) => s + totalItem(i), 0));
  const servicos = r2(o.itens.filter((i) => i.tipo === "servico").reduce((s, i) => s + totalItem(i), 0));
  const semMarkup = r2(produtos + servicos);
  const markupProduto = r2(produtos * (Number(o.markup_produto_pct) || 0) / 100);
  const markupServico = r2(servicos * (Number(o.markup_servico_pct) || 0) / 100);
  const semDesconto = r2(semMarkup + markupProduto + markupServico);
  const desconto = o.desconto_valor != null && o.desconto_valor > 0 ? Math.min(r2(o.desconto_valor), semDesconto) : r2(semDesconto * (Number(o.desconto_pct) || 0) / 100);
  const final = r2(semDesconto - desconto);
  return { produtos, servicos, semMarkup, markupProduto, markupServico, semDesconto, desconto, descontoPct: semDesconto ? (desconto / semDesconto) * 100 : 0, final };
}

/** Totais por ambiente (produtos + serviços), com o markup do orçamento aplicado. */
export function totaisPorAmbiente(o: Pick<Orcamento, "itens" | "ambientes" | "markup_produto_pct" | "markup_servico_pct">) {
  const ordem = [...o.ambientes, ...o.itens.map((i) => i.ambiente || "Geral")].filter((a, k, arr) => arr.indexOf(a) === k);
  const mp = 1 + (Number(o.markup_produto_pct) || 0) / 100, ms = 1 + (Number(o.markup_servico_pct) || 0) / 100;
  return ordem.map((amb) => {
    const its = o.itens.filter((i) => (i.ambiente || "Geral") === amb);
    const produtos = r2(its.filter((i) => i.tipo === "produto").reduce((s, i) => s + totalItem(i), 0) * mp);
    const servicos = r2(its.filter((i) => i.tipo === "servico").reduce((s, i) => s + totalItem(i), 0) * ms);
    return { ambiente: amb, itens: its, produtos, servicos, total: r2(produtos + servicos) };
  }).filter((a) => a.itens.length > 0);
}

/** "10x de R$ 1.234,56" a partir do total final. */
export function condicoes(formas: string[], total: number) {
  return formas.map((f) => {
    const n = /^(\d+)x$/.exec(f)?.[1];
    return { forma: f, texto: n ? `${n}x de ${(total / Number(n)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : f, valor: total };
  });
}

export function proximaVersao(titulo: string, versao: string) {
  const m = /\bV(\d+)\s*$/i.exec(titulo);
  const n = m ? Number(m[1]) + 1 : (Number(/\d+/.exec(versao || "")?.[0]) || 1) + 1;
  return { titulo: m ? titulo.replace(/\bV\d+\s*$/i, `V${n}`) : `${titulo} - V${n}`, versao: `V${n}` };
}

let seq = 0;
export const novaChave = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;
export function itemDeProduto(p: Produto, ambiente: string): Item {
  return { chave: novaChave(), tipo: "produto", produto_id: p.id, servico_id: null, descricao: p.nome, detalhe: p.descricao, sku: p.referencia, marca: p.marca,
    unidade: abrevUnidade(p.unidade), quantidade: 1, valor_unitario: p.preco_venda, valor_tabela: p.preco_venda, ambiente };
}
export function itemDeServico(s: Servico, ambiente: string): Item {
  return { chave: novaChave(), tipo: "servico", produto_id: null, servico_id: s.id, descricao: s.nome, detalhe: s.descricao, sku: "", marca: "",
    unidade: s.unidade || "Un", quantidade: 1, valor_unitario: s.valor, valor_tabela: s.valor, ambiente };
}
export const abrevUnidade = (u: string) => ({ Unidade: "Un", Par: "Pr", Rolo: "Rl", Metro: "m" } as Record<string, string>)[u] ?? (u || "Un");
export const plUnidade = (u: string, q: number) => {
  const nome = ({ Un: "Unidade", Pr: "Par", Rl: "Rolo", m: "Metro", un: "Unidade" } as Record<string, string>)[u] ?? u;
  return `${q.toLocaleString("pt-BR")} ${nome}${q === 1 ? "" : nome === "Par" ? "(es)" : "(s)"}`;
};

// ------------------------------------------------------------------ fotos
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const fotoProduto = (path: string | null | undefined) => (path ? `${URL_BASE}/storage/v1/object/public/produtos/${path}` : null);

// ------------------------------------------------------------------ catálogo
let catalogo: Promise<{ produtos: Produto[]; servicos: Servico[] }> | null = null;
export function carregarCatalogo(forcar = false) {
  if (forcar) catalogo = null;
  catalogo ??= (async () => {
    if (modoDemo) return { produtos: DEMO_PRODUTOS, servicos: DEMO_SERVICOS };
    const db = supabase();
    const todos: any[] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await db.from("produtos").select("*").order("nome").range(de, de + 999);
      if (error) throw error;
      todos.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
    const [s, sal] = await Promise.all([db.from("servicos").select("*").order("nome"), db.from("estoque_saldos").select("produto_id, saldo_fisico, reservado")]);
    if (s.error) throw s.error;
    const saldo = new Map((sal.data ?? []).map((x: any) => [x.produto_id, Number(x.saldo_fisico) - Number(x.reservado)]));
    return { produtos: todos.map((p) => paraProduto(p, saldo.get(p.id) ?? 0)), servicos: (s.data ?? []).map(paraServico) };
  })();
  catalogo.catch(() => { catalogo = null; });
  return catalogo;
}
const n = (v: any) => (v == null || v === "" ? 0 : Number(v));
function paraProduto(p: any, saldo: number): Produto {
  return {
    id: p.id, codigo: p.zenith_id ?? null, nome: p.nome, modelo: p.modelo ?? "", marca: p.marca ?? "", categoria: p.categoria ?? p.sistema ?? "", unidade: p.unidade ?? "Unidade",
    descricao: p.descricao ?? "", preco_venda: n(p.preco_venda), custo: n(p.custo), valor_compra: n(p.valor_compra), impostos_pct: n(p.impostos_pct), fator_venda: n(p.fator_venda) || 2,
    imagem_path: p.imagem_path ?? null, fornecedor: p.fornecedor ?? "", ncm: p.ncm ?? "", garantia_dias: p.garantia_dias ?? null, estoque_minimo: n(p.estoque_minimo),
    local_estoque: p.local_estoque ?? "", medidas: p.medidas ?? "", peso: p.peso ?? "", voltagem: p.voltagem ?? "", cor: p.cor ?? "", referencia: p.referencia ?? p.sku ?? "",
    codigo_barras: p.codigo_barras ?? "", ativo: p.ativo !== false, saldo,
  };
}
const paraServico = (s: any): Servico => ({ id: s.id, codigo: s.zenith_id ?? null, nome: s.nome, categoria: s.categoria ?? "", descricao: s.descricao ?? "", unidade: s.unidade ?? "Un", valor: n(s.valor), custo: n(s.custo), ativo: s.ativo !== false });

/** Busca do jeito do Zenith: código, nome comercial, modelo ou fabricante. */
export function buscarNoCatalogo<T extends { codigo: number | null; nome: string }>(lista: T[], termo: string, campos: (x: T) => string, max = 40): T[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const t = norm(termo.trim());
  if (!t) return lista.slice(0, max);
  const partes = t.split(/\s+/);
  return lista.filter((x) => { const alvo = norm(`${x.codigo ?? ""} ${x.nome} ${campos(x)}`); return partes.every((p) => alvo.includes(p)); })
    .sort((a, b) => (String(a.codigo) === t ? -1 : String(b.codigo) === t ? 1 : 0)).slice(0, max);
}

export async function salvarProduto(p: Partial<Produto> & { nome: string }): Promise<string> {
  const linha = {
    nome: p.nome, modelo: p.modelo || null, marca: p.marca || null, categoria: p.categoria || null, sistema: p.categoria || null, unidade: p.unidade || "Unidade",
    descricao: p.descricao || null, preco_venda: p.preco_venda ?? 0, custo: p.custo ?? 0, valor_compra: p.valor_compra ?? 0, impostos_pct: p.impostos_pct ?? 0, fator_venda: p.fator_venda ?? 2,
    fornecedor: p.fornecedor || null, ncm: p.ncm || null, garantia_dias: p.garantia_dias ?? null, estoque_minimo: p.estoque_minimo ?? 0, local_estoque: p.local_estoque || null,
    medidas: p.medidas || null, peso: p.peso || null, voltagem: p.voltagem || null, cor: p.cor || null, referencia: p.referencia || null, codigo_barras: p.codigo_barras || null, ativo: p.ativo !== false,
  };
  const db = supabase();
  const r = p.id ? await db.from("produtos").update(linha).eq("id", p.id).select("id").single() : await db.from("produtos").insert(linha).select("id").single();
  if (r.error) throw r.error;
  catalogo = null;
  return r.data.id;
}
export async function enviarFotoProduto(produtoId: string, arquivo: Blob): Promise<string> {
  const caminho = `nucleo/${produtoId}-${Date.now().toString(36)}.jpg`;
  const db = supabase();
  const up = await db.storage.from("produtos").upload(caminho, arquivo, { contentType: arquivo.type || "image/jpeg", upsert: true });
  if (up.error) throw up.error;
  const r = await db.from("produtos").update({ imagem_path: caminho }).eq("id", produtoId);
  if (r.error) throw r.error;
  catalogo = null;
  return caminho;
}
export async function ajustarEstoque(produtoId: string, novoSaldo: number, saldoAtual: number, obs: string) {
  const dif = Math.round((novoSaldo - saldoAtual) * 1000) / 1000;
  if (!dif) return;
  const { error } = await supabase().from("estoque_movimentos").insert({
    produto_id: produtoId, tipo: dif > 0 ? "entrada" : "saida", quantidade: Math.abs(dif), referencia: "Ajuste de inventário", observacao: obs || null,
  });
  if (error) throw error;
  catalogo = null;
}

// ------------------------------------------------------------------ orçamentos
const SEL = "id, origem, numero, versao, titulo, status, total_final, data_emissao, editado_em, oportunidade_id, documento_id, clientes(nome), oportunidades(titulo, numero), proposta_itens(count)";
const paraResumo = (p: any): ResumoOrc => ({
  id: p.id, origem: p.origem, numero: p.numero, versao: p.versao ?? "", titulo: p.titulo ?? "", status: p.status, total_final: n(p.total_final),
  data_emissao: p.data_emissao, editado_em: p.editado_em ?? p.data_emissao, oportunidade_id: p.oportunidade_id, cliente: p.clientes?.nome ?? "",
  negocio: p.oportunidades?.titulo ?? "", negocio_numero: p.oportunidades?.numero ?? null, documento_id: p.documento_id, itens: p.proposta_itens?.[0]?.count ?? 0,
});
export async function listarOrcamentos(filtro: { negocio?: string; cliente?: string } = {}): Promise<ResumoOrc[]> {
  if (modoDemo) return [];
  let q = supabase().from("propostas").select(SEL).order("editado_em", { ascending: false });
  if (filtro.negocio) q = q.eq("oportunidade_id", filtro.negocio);
  if (filtro.cliente) q = q.eq("cliente_id", filtro.cliente);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(paraResumo);
}

export async function abrirOrcamento(id: string): Promise<Orcamento> {
  const db = supabase();
  const { data: p, error } = await db.from("propostas")
    .select("*, clientes(nome), oportunidades(titulo, numero), proposta_itens(*)").eq("id", id).single();
  if (error) throw error;
  const itens = ((p.proposta_itens ?? []) as any[]).sort((a, b) => a.ordem - b.ordem).map((i): Item => ({
    chave: i.id, tipo: i.tipo, produto_id: i.produto_id, servico_id: i.servico_id, descricao: i.descricao, detalhe: i.detalhe ?? "", sku: i.sku ?? "", marca: i.marca ?? "",
    unidade: i.unidade ?? "Un", quantidade: n(i.quantidade), valor_unitario: n(i.valor_unitario), valor_tabela: i.valor_tabela == null ? null : n(i.valor_tabela), ambiente: i.sistema ?? "Geral",
  }));
  const ambientes = [...(p.ambientes ?? []), ...itens.map((i) => i.ambiente)].filter((a, k, arr) => a && arr.indexOf(a) === k);
  const semDesc = n(p.total_itens) || itens.reduce((s, i) => s + totalItem(i), 0);
  const descontoValor = semDesc > n(p.total_final) && !n(p.desconto_pct) ? r2(semDesc - n(p.total_final)) : null;
  return {
    id: p.id, origem: p.origem, numero: p.numero, versao: p.versao ?? "V1", titulo: p.titulo ?? "", oportunidade_id: p.oportunidade_id, cliente_id: p.cliente_id, projeto_id: p.projeto_id,
    cliente_nome: p.clientes?.nome ?? "", negocio_titulo: p.oportunidades?.titulo ?? "", negocio_numero: p.oportunidades?.numero ?? null,
    data_emissao: p.data_emissao, editado_em: p.editado_em ?? p.updated_at, status: p.status, ambientes, itens,
    markup_produto_pct: n(p.markup_produto_pct), markup_servico_pct: n(p.markup_servico_pct), desconto_pct: n(p.desconto_pct), desconto_valor: descontoValor,
    formas_pagamento: p.formas_pagamento?.length ? p.formas_pagamento : p.condicoes_pagamento ? String(p.condicoes_pagamento).split(/,\s*/) : [],
    validade_dias: p.validade_dias ?? 15, resumo_entrega: p.resumo_entrega ?? "", observacoes: p.observacoes ?? "",
    comodato_prazo: p.comodato_prazo ?? null, comodato_taxa: p.comodato_taxa == null ? null : n(p.comodato_taxa), total_final: n(p.total_final),
  };
}

export function orcamentoVazio(negocio: { id: string; titulo: string; cliente_id: string | null; cliente_nome: string; numero: number | null; projeto_id?: string | null }): Orcamento {
  return {
    id: null, origem: "nucleo", numero: "", versao: "V1", titulo: `${negocio.cliente_nome || negocio.titulo}${negocio.titulo && negocio.titulo !== negocio.cliente_nome ? " | " + negocio.titulo.split(" | ").slice(-1)[0] : ""} - V1`,
    oportunidade_id: negocio.id, cliente_id: negocio.cliente_id, projeto_id: negocio.projeto_id ?? null, cliente_nome: negocio.cliente_nome, negocio_titulo: negocio.titulo, negocio_numero: negocio.numero,
    data_emissao: new Date().toISOString().slice(0, 10), editado_em: new Date().toISOString(), status: "rascunho", ambientes: [], itens: [],
    markup_produto_pct: 0, markup_servico_pct: 0, desconto_pct: 0, desconto_valor: null, formas_pagamento: ["A combinar"], validade_dias: 15,
    resumo_entrega: "", observacoes: "", comodato_prazo: null, comodato_taxa: null, total_final: 0,
  };
}

/** Salva tudo de uma vez (cabeçalho e itens) — orçamento do Zenith editado aqui continua com o mesmo número. */
export async function salvarOrcamento(o: Orcamento, extra: { status?: StatusOrc } = {}): Promise<string> {
  const t = calcularTotais(o);
  const usados = o.ambientes.filter((a) => a.trim());
  const { data, error } = await supabase().rpc("salvar_orcamento", {
    p_dados: {
      id: o.id, oportunidade_id: o.oportunidade_id, cliente_id: o.cliente_id, projeto_id: o.projeto_id, titulo: o.titulo.trim(), versao: o.versao,
      ambientes: usados, markup_produto_pct: o.markup_produto_pct || 0, markup_servico_pct: o.markup_servico_pct || 0,
      desconto_pct: o.desconto_valor ? 0 : o.desconto_pct || 0, total_final: t.final, formas_pagamento: o.formas_pagamento, validade_dias: o.validade_dias,
      resumo_entrega: o.resumo_entrega || null, observacoes: o.observacoes || null, comodato_prazo: o.comodato_prazo, comodato_taxa: o.comodato_taxa,
      status: extra.status ?? null,
      itens: o.itens.filter((i) => i.descricao.trim() && i.quantidade > 0).map((i) => ({
        tipo: i.tipo, sistema: i.ambiente || "Geral", produto_id: i.produto_id, servico_id: i.servico_id, descricao: i.descricao, detalhe: i.detalhe || null,
        sku: i.sku || null, marca: i.marca || null, quantidade: i.quantidade, unidade: i.unidade, valor_unitario: i.tipo === "cliente" ? 0 : i.valor_unitario, valor_tabela: i.valor_tabela,
      })),
    },
  });
  if (error) throw error;
  return data as string;
}

/** Nova versão (V2, V3…) ou cópia: novo número, mesmo conteúdo. */
export async function duplicarOrcamento(id: string, modo: "versao" | "copia", destino?: { oportunidade_id: string; cliente_id: string | null }): Promise<string> {
  const o = await abrirOrcamento(id);
  const v = modo === "versao" ? proximaVersao(o.titulo, o.versao) : { titulo: `${o.titulo} (cópia)`, versao: o.versao };
  const novo: Orcamento = { ...o, id: null, origem: "nucleo", titulo: v.titulo, versao: v.versao, status: "rascunho", itens: o.itens.map((i) => ({ ...i, chave: novaChave() })),
    ...(destino ? { oportunidade_id: destino.oportunidade_id, cliente_id: destino.cliente_id ?? o.cliente_id } : {}) };
  const nid = await salvarOrcamento(novo);
  if (modo === "versao" && o.status === "enviada") await supabase().from("propostas").update({ status: "substituida" }).eq("id", id);
  return nid;
}

export async function mudarStatus(ids: string[], status: StatusOrc) {
  const { error } = await supabase().from("propostas").update({ status }).in("id", ids);
  if (error) throw error;
}
export async function excluirOrcamento(id: string) {
  const { error } = await supabase().from("propostas").delete().eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------------ demonstração
const DEMO_PRODUTOS: Produto[] = [
  ["C4- 21309 - Control4 Controladora Core 1", "Controladora Core 1", "Control4", "Automação", 18240, 4],
  ["Home Manager Módulo R-12", "Módulo R-12", "Home Manager", "Automação", 2705.04, 30],
  ["Access Point Ubiquiti Unifi U7-Lite Dual-Band Wi-Fi 7", "U7-Lite", "Ubiquiti", "Rede", 1017.6, 564],
  ["Episode Caixa de Embutir Teto ES-CORE-16-IC", "ES-CORE-16-IC", "Episode", "Áudio/Vídeo", 1553.6, 66],
].map(([nome, modelo, marca, categoria, preco, codigo]) => ({
  id: `p${codigo}`, codigo: codigo as number, nome: nome as string, modelo: modelo as string, marca: marca as string, categoria: categoria as string, unidade: "Unidade",
  descricao: "", preco_venda: preco as number, custo: (preco as number) / 2, valor_compra: (preco as number) / 2.28, impostos_pct: 14, fator_venda: 2, imagem_path: null,
  fornecedor: "", ncm: "", garantia_dias: 365, estoque_minimo: 0, local_estoque: "", medidas: "", peso: "", voltagem: "", cor: "", referencia: "", codigo_barras: "", ativo: true, saldo: 3,
}));
const DEMO_SERVICOS: Servico[] = [{ id: "s4", codigo: 4, nome: "Mão de obra especializada - BRA Ambientes Inteligentes", categoria: "Automação", descricao: "Serviços técnicos especializados.", unidade: "Un", valor: 0, custo: 0, ativo: true }];
