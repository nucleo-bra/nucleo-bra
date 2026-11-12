"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ehErroDeRede, fetchRapido } from "./offline";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Sem as variáveis de ambiente o Núcleo roda em modo demonstração. */
export const modoDemo = !url || !chave;

let cliente: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (modoDemo) throw new Error("Supabase não configurado (modo demonstração).");
  cliente ??= createClient(url!, chave!, { auth: { persistSession: true, autoRefreshToken: true }, global: { fetch: fetchRapido } });
  return cliente;
}

/** Traduz erros técnicos do banco para mensagens claras */
export function mensagemErro(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  if (m.includes("item_confere")) return "Um item tem quantidade × unitário diferente do total da linha.";
  if (m.includes("documento_unico")) return "Já existe um cliente com este CPF/CNPJ.";
  if (m.includes("documentos_sha256_key")) return "Este arquivo já foi enviado ao Núcleo.";
  if (m.includes("proposta_unica")) return "Esta versão do orçamento já foi enviada ao Núcleo.";
  if (m.includes("titulos_linha_digitavel_key")) return "Este boleto já está vinculado a outro título.";
  if (m.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("row-level security")) return "Seu usuário não tem permissão para isso. Peça liberação à diretoria.";
  if (m.startsWith("Sem internet,")) return m;
  if (ehErroDeRede(e)) return "Sem internet: esta parte precisa de conexão. O restante continua funcionando, e o que você alterar é enviado quando a internet voltar.";
  return m;
}

/**
 * Lê todas as linhas de uma consulta, de 1000 em 1000. O Supabase devolve no
 * máximo 1000 linhas por pedido, mesmo com limit maior: sem isto, listas
 * grandes (produtos, clientes, saldos) ficariam cortadas sem aviso.
 * `monta` precisa criar a consulta do zero a cada página (com order estável).
 */
export async function lerTudo<T = Record<string, unknown>>(
  monta: () => { range: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: unknown }> },
  max = 20000,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < max; de += 1000) {
    const { data, error } = await monta().range(de, de + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}
