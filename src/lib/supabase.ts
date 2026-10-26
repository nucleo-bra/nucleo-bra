"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Sem as variáveis de ambiente o Núcleo roda em modo demonstração. */
export const modoDemo = !url || !chave;

let cliente: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (modoDemo) throw new Error("Supabase não configurado (modo demonstração).");
  cliente ??= createClient(url!, chave!, { auth: { persistSession: true, autoRefreshToken: true } });
  return cliente;
}

/** Traduz erros técnicos do banco para mensagens claras */
export function mensagemErro(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  if (m.includes("item_confere")) return "Um item tem quantidade × unitário diferente do total da linha.";
  if (m.includes("documento_unico")) return "Já existe um cliente com este CPF/CNPJ.";
  if (m.includes("documentos_sha256_key")) return "Este arquivo já foi enviado ao Núcleo.";
  if (m.includes("titulos_linha_digitavel_key")) return "Este boleto já está vinculado a outro título.";
  if (m.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("row-level security")) return "Seu usuário não tem permissão para isso. Peça liberação à diretoria.";
  return m;
}
