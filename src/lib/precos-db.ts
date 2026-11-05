"use client";
// Gravação da formação de preço e dos padrões da empresa.
import { modoDemo, supabase } from "./supabase";
import { calcular, colunasDoCalculo, Formacao, Padroes } from "./precos";
import { invalidarCatalogo } from "./orcamentos";

const CHAVE = "formacao_preco";

export async function carregarPadroes(): Promise<Padroes> {
  if (modoDemo) return { simples_pct: 10, margem_pct: 30 };
  const { data } = await supabase().from("config_empresa").select("valor").eq("chave", CHAVE).maybeSingle();
  return (data?.valor as Padroes) ?? {};
}

export async function salvarPadroes(p: Padroes) {
  const limpo = Object.fromEntries(Object.entries(p).filter(([, v]) => Number.isFinite(v)));
  const { error } = await supabase().from("config_empresa").upsert({ chave: CHAVE, valor: limpo });
  if (error) throw new Error(/row-level|permission/i.test(error.message) ? "Só a diretoria altera os padrões da empresa." : error.message);
}

/** Grava a formação de vários produtos de uma vez (custo e preço de venda acompanham). */
export async function salvarFormacoes(itens: { id: string; formacao: Formacao }[], padroes: Padroes) {
  if (modoDemo) return;
  const db = supabase();
  for (let i = 0; i < itens.length; i += 25) {
    const lote = itens.slice(i, i + 25);
    const r = await Promise.all(lote.map(({ id, formacao }) => {
      const c = calcular(formacao, padroes);
      if (c.erro) throw new Error(c.erro);
      return db.from("produtos").update(colunasDoCalculo(formacao, c)).eq("id", id);
    }));
    const e = r.find((x) => x.error)?.error;
    if (e) throw e;
  }
  invalidarCatalogo();
}
