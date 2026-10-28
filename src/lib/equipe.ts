"use client";
// Equipe: quem acessa o Núcleo, com qual perfil. Só a diretoria altera.
import { modoDemo, supabase } from "./supabase";

export type Papel = "diretoria" | "financeiro" | "comercial" | "tecnico";
export type Pessoa = { id: string; nome: string; email: string; papel: Papel; ativo: boolean; created_at: string; ultimo_acesso?: string | null };
export const PAPEIS: [Papel, string, string][] = [
  ["diretoria", "Diretoria", "Tudo, inclusive liberar acessos"],
  ["financeiro", "Financeiro", "Financeiro, clientes, contratos e CRM"],
  ["comercial", "Comercial", "CRM, clientes, contratos e financeiro"],
  ["tecnico", "Técnico", "Só a área técnica (projetos, chamados, agendamentos)"],
];

let DEMO: Pessoa[] = [
  { id: "m1", nome: "Matheus Esturrari", email: "matheus@braambientes.com.br", papel: "diretoria", ativo: true, created_at: "2026-10-10T12:00:00Z" },
  { id: "m4", nome: "Fernando Reis", email: "fernando.reis@grupobrtelecom.com.br", papel: "financeiro", ativo: true, created_at: "2026-10-12T12:00:00Z" },
  { id: "m9", nome: "Lucas Técnico", email: "lucas@grupobrtelecom.com.br", papel: "tecnico", ativo: false, created_at: new Date().toISOString() },
];

export async function listarEquipe(): Promise<{ pessoas: Pessoa[]; eu: string | null; diretoria: boolean }> {
  if (modoDemo) return { pessoas: DEMO.map((p) => ({ ...p })), eu: "m1", diretoria: true };
  const db = supabase();
  const { data: s } = await db.auth.getUser();
  const eu = s.user?.id ?? null;
  const { data, error } = await db.from("perfis").select("id, nome, email, papel, ativo, created_at").order("created_at");
  if (error) throw error;
  const pessoas = (data ?? []) as Pessoa[];
  return { pessoas, eu, diretoria: pessoas.some((p) => p.id === eu && p.papel === "diretoria" && p.ativo) };
}

export async function salvarPessoa(id: string, campos: Partial<Pick<Pessoa, "papel" | "ativo" | "nome">>) {
  if (modoDemo) { DEMO = DEMO.map((p) => (p.id === id ? { ...p, ...campos } : p)); return; }
  const { error } = await supabase().from("perfis").update(campos).eq("id", id);
  if (error) throw error;
}
