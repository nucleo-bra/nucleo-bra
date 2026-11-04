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

// ---------------------------------------------------------------- técnicos sem login
// Só o nome para alocar em visitas, chamados e projetos (aparecem junto da equipe).
export type TecnicoNome = { id: string; nome: string; telefone: string | null; ativo: boolean; created_at: string };
let DEMO_TEC: TecnicoNome[] = [];

export async function listarTecnicos(): Promise<TecnicoNome[]> {
  if (modoDemo) return DEMO_TEC.map((t) => ({ ...t }));
  const { data, error } = await supabase().from("tecnicos").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as TecnicoNome[];
}

export async function salvarTecnico(t: Partial<TecnicoNome> & { nome?: string }) {
  const linha = { ...(t.nome !== undefined ? { nome: t.nome.trim() } : {}), ...(t.telefone !== undefined ? { telefone: t.telefone?.trim() || null } : {}), ...(t.ativo !== undefined ? { ativo: t.ativo } : {}) };
  if (linha.nome !== undefined && !linha.nome) throw new Error("Informe o nome do técnico.");
  if (modoDemo) {
    if (t.id) DEMO_TEC = DEMO_TEC.map((x) => (x.id === t.id ? { ...x, ...linha } : x));
    else DEMO_TEC.push({ id: crypto.randomUUID(), nome: linha.nome!, telefone: linha.telefone ?? null, ativo: true, created_at: new Date().toISOString() });
    return;
  }
  const db = supabase();
  const { error } = t.id ? await db.from("tecnicos").update(linha).eq("id", t.id) : await db.from("tecnicos").insert(linha);
  if (error) throw error.code === "23505" ? new Error("Já existe um técnico com esse nome.") : error;
}

// ---------------------------------------------------------------- papel de quem está usando
let papelCache: Promise<Papel | null> | null = null;
/** Perfil do usuário logado (diretoria, financeiro, comercial ou técnico). */
export function meuPapel(): Promise<Papel | null> {
  if (modoDemo) return Promise.resolve("diretoria");
  papelCache ??= (async () => {
    const db = supabase();
    const { data: s } = await db.auth.getUser();
    if (!s.user) return null;
    const { data } = await db.from("perfis").select("papel").eq("id", s.user.id).single();
    return (data?.papel as Papel) ?? null;
  })();
  return papelCache;
}

