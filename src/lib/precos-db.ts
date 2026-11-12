"use client";
// Gravação da formação de preço e dos padrões da empresa.
import { modoDemo, supabase } from "./supabase";
import { calcular, colunasDoCalculo, Formacao, Padroes } from "./precos";
import { invalidarCatalogo } from "./orcamentos";
import { comCache, gravarOuEnfileirar, precisaDeInternet } from "./offline";

const CHAVE = "formacao_preco";

export async function carregarPadroes(): Promise<Padroes> {
  if (modoDemo) return { simples_pct: 10, margem_pct: 30 };
  return comCache("padroes-preco", async () => {
    const { data, error } = await supabase().from("config_empresa").select("valor").eq("chave", CHAVE).maybeSingle();
    if (error) throw error;
    return (data?.valor as Padroes) ?? {};
  }).catch(() => ({}));
}

export async function salvarPadroes(p: Padroes) {
  precisaDeInternet("alterar os padrões da empresa");
  const limpo = Object.fromEntries(Object.entries(p).filter(([, v]) => Number.isFinite(v)));
  const { error } = await supabase().from("config_empresa").upsert({ chave: CHAVE, valor: limpo });
  if (error) throw new Error(/row-level|permission/i.test(error.message) ? "Só a diretoria altera os padrões da empresa." : error.message);
}

/** Grava a formação de vários produtos de uma vez (custo e preço de venda acompanham). */
export async function salvarFormacoes(itens: { id: string; formacao: Formacao }[], padroes: Padroes) {
  if (modoDemo) return;
  const db = supabase();
  for (const { formacao } of itens) { const c = calcular(formacao, padroes); if (c.erro) throw new Error(c.erro); }
  // em série: sem internet cada produto entra na fila, em ordem
  for (let i = 0; i < itens.length; i += 10) {
    await Promise.all(itens.slice(i, i + 10).map(({ id, formacao }) => {
      const cols = colunasDoCalculo(formacao, calcular(formacao, padroes));
      return gravarOuEnfileirar({ tipo: "tabela", acao: "update", tabela: "produtos", id, dados: cols, colunaData: "updated_at", rotulo: "Preço do produto" },
        () => db.from("produtos").update(cols).eq("id", id), () => null);
    }));
  }
  invalidarCatalogo();
}
