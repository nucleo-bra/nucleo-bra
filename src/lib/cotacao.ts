"use client";
// Cotação do dólar e atualização diária dos produtos comprados em dólar.
// A cotação do dia fica na tabela cotacoes (uma por dia). O primeiro acesso do
// dia busca a cotação, grava e recalcula custo e preço de venda de todos os
// produtos em dólar, respeitando a margem de cada um (ver reprecificar).
import { modoDemo, supabase } from "./supabase";
import { aplicarCotacao, calcular, colunasDoCalculo, Formacao, Padroes, reprecificar } from "./precos";
import { carregarPadroes } from "./precos-db";
import { invalidarCatalogo } from "./orcamentos";

export type Cotacao = { valor: number; data: string; fonte: string };

const hojeSp = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Dólar comercial (venda). AwesomeAPI e, se falhar, open.er-api.com. */
export async function buscarCotacaoUsd(): Promise<Cotacao> {
  const tentativas: [string, (j: unknown) => number][] = [
    ["https://economia.awesomeapi.com.br/json/last/USD-BRL", (j) => Number((j as { USDBRL?: { ask?: string } }).USDBRL?.ask)],
    ["https://open.er-api.com/v6/latest/USD", (j) => Number((j as { rates?: { BRL?: number } }).rates?.BRL)],
  ];
  for (const [url, ler] of tentativas) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const v = ler(await r.json());
      if (v > 1 && v < 50) return { valor: Math.round(v * 10000) / 10000, data: hojeSp(), fonte: new URL(url).hostname };
    } catch { /* tenta a próxima */ }
  }
  throw new Error("Não foi possível buscar a cotação do dólar agora.");
}

let doDia: Promise<Cotacao | null> | null = null;
/** Cotação de hoje (grava no banco na primeira vez do dia). Sem internet, a última gravada. */
export function cotacaoDoDia(): Promise<Cotacao | null> {
  if (modoDemo) return Promise.resolve({ valor: 5.4, data: hojeSp(), fonte: "demonstração" });
  doDia ??= (async () => {
    const db = supabase(), hoje = hojeSp();
    const { data } = await db.from("cotacoes").select("valor, data, fonte").eq("moeda", "USD").order("data", { ascending: false }).limit(1).maybeSingle();
    if (data && data.data === hoje) return { valor: Number(data.valor), data: data.data, fonte: data.fonte ?? "" };
    try {
      const c = await buscarCotacaoUsd();
      await db.from("cotacoes").upsert({ moeda: "USD", data: c.data, valor: c.valor, fonte: c.fonte });
      return c;
    } catch {
      return data ? { valor: Number(data.valor), data: data.data, fonte: data.fonte ?? "" } : null;
    }
  })();
  doDia.catch(() => { doDia = null; });
  return doDia;
}

/** Recalcula os produtos em dólar com a cotação (os que ainda não estão com a do dia). */
export function produtosParaCotacao(L: { id: string; formacao: Formacao | null }[], c: Cotacao, p: Padroes) {
  return L.filter((x) => x.formacao?.moeda === "USD" && Number(x.formacao.preco_moeda) > 0 && x.formacao.cotacao_data !== c.data)
    .map((x) => ({ id: x.id, formacao: reprecificar(x.formacao!, p, (g) => aplicarCotacao(g, c.valor, c.data)) }));
}

/** Roda uma vez por dia por navegador; seguro rodar em paralelo (mesmo resultado). */
export async function atualizarProdutosEmDolar(): Promise<number> {
  if (modoDemo) return 0;
  const c = await cotacaoDoDia();
  if (!c) return 0;
  const marca = `nucleo-dolar-${c.data}`;
  try { if (localStorage.getItem(marca)) return 0; } catch { /* sem armazenamento */ }
  const db = supabase();
  const { data, error } = await db.from("produtos").select("id, formacao").eq("formacao->>moeda", "USD").limit(5000);
  if (error) return 0;
  const padroes = await carregarPadroes();
  const itens = produtosParaCotacao((data ?? []) as { id: string; formacao: Formacao }[], c, padroes);
  for (let i = 0; i < itens.length; i += 25) {
    const r = await Promise.all(itens.slice(i, i + 25).map(({ id, formacao }) => {
      const k = calcular(formacao, padroes);
      return k.erro ? Promise.resolve({ error: null }) : db.from("produtos").update(colunasDoCalculo(formacao, k)).eq("id", id);
    }));
    if (r.some((x) => x.error)) return 0;   // sem permissão: outro usuário atualiza
  }
  if (itens.length) invalidarCatalogo();
  try { localStorage.setItem(marca, "1"); } catch { /* */ }
  return itens.length;
}
