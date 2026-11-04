"use client";
// Fornecedores (cadastro vindo do Zenith; CNPJ não se repete).
import { modoDemo, supabase } from "./supabase";

export type Fornecedor = {
  id: string; nome_fantasia: string; razao_social: string | null; cnpj: string | null;
  vendedor: string | null; telefone: string | null; whatsapp: string | null; email: string | null;
  cep: string | null; logradouro: string | null; numero: string | null; bairro: string | null; cidade: string | null; uf: string | null;
};

/** Lista os fornecedores ativos. Se a tabela ainda não existir, devolve lista vazia. */
export async function listarFornecedores(): Promise<Fornecedor[]> {
  if (modoDemo) return [];
  const { data, error } = await supabase().from("fornecedores").select("*").eq("ativo", true).order("nome_fantasia");
  if (error) return [];
  return (data ?? []) as Fornecedor[];
}
