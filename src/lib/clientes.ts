"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco chegam sem tipo */
// Cadastro de clientes: lista em cartões, edição e criação.
import { modoDemo, supabase } from "./supabase";

export type Cliente = {
  id: string; nome: string; nome_fantasia: string; tipo: "PF" | "PJ"; documento: string; email: string; telefone: string;
  data_nascimento: string; inscricao_municipal: string; cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cidade: string; uf: string; observacoes: string; parceiro_origem_id: string | null; ativo: boolean;
};
export type ClienteCartao = Cliente & {
  negocios: number; negocio_aberto: { id: string; numero: number | null; titulo: string; etapa: string; valor: number } | null;
  a_receber: number; contratos: number; atualizado: string;
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
export const clienteDe = (r: any): Cliente => ({
  id: r.id, nome: r.nome ?? "", nome_fantasia: s(r.nome_fantasia), tipo: r.tipo ?? "PF", documento: s(r.documento), email: s(r.email),
  telefone: s(r.telefone), data_nascimento: s(r.data_nascimento), inscricao_municipal: s(r.inscricao_municipal), cep: s(r.cep),
  logradouro: s(r.logradouro), numero: s(r.numero), complemento: s(r.complemento), bairro: s(r.bairro), cidade: s(r.cidade),
  uf: s(r.uf), observacoes: s(r.observacoes), parceiro_origem_id: r.parceiro_origem_id ?? null, ativo: r.ativo ?? true,
});

export const enderecoLinha = (c: Partial<Cliente>) =>
  [[c.logradouro, c.numero].filter(Boolean).join(", "), c.complemento, c.bairro && "Bairro " + c.bairro,
   [c.cidade, c.uf].filter(Boolean).join(" – "), c.cep && "CEP " + c.cep].filter(Boolean).join(" – ");

const DEMO: ClienteCartao[] = [
  { ...clienteDe({ id: "d1", nome: "Eduardo Attie", tipo: "PF", documento: "12345678909", email: "eduardo@email.com", telefone: "19999990000", cidade: "Campinas", uf: "SP" }),
    negocios: 1, negocio_aberto: { id: "n1", numero: 1, titulo: "Quinta da Baronesa", etapa: "negociacao", valor: 265000 }, a_receber: 0, contratos: 0, atualizado: "2026-10-26" },
  { ...clienteDe({ id: "d2", nome: "PLAENGE EMPREENDIMENTOS LTDA", nome_fantasia: "Plaenge", tipo: "PJ", documento: "78638061008908", email: "f.tavares@plaenge.com.br", cidade: "Campinas", uf: "SP" }),
    negocios: 0, negocio_aberto: null, a_receber: 4409.2, contratos: 1, atualizado: "2026-10-20" },
];

export async function listarCartoes(): Promise<ClienteCartao[]> {
  if (modoDemo) return JSON.parse(JSON.stringify(DEMO));
  const { data, error } = await supabase().from("clientes")
    .select("*, oportunidades(id, numero, titulo, etapa, valor_estimado, updated_at), titulos(valor, status, natureza), contratos(id)")
    .eq("ativo", true).order("nome").limit(2000);
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const ops = (r.oportunidades ?? []) as any[];
    const aberto = ops.filter((o) => !["ganho", "perdido"].includes(o.etapa)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0]
      ?? ops.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
    return {
      ...clienteDe(r), negocios: ops.length, contratos: (r.contratos ?? []).length, atualizado: r.updated_at,
      negocio_aberto: aberto ? { id: aberto.id, numero: aberto.numero, titulo: aberto.titulo, etapa: aberto.etapa, valor: Number(aberto.valor_estimado) } : null,
      a_receber: (r.titulos ?? []).filter((t: any) => t.natureza === "receber" && t.status === "aberto").reduce((x: number, t: any) => x + Number(t.valor), 0),
    };
  });
}

export async function lerCliente(id: string): Promise<Cliente | null> {
  if (modoDemo) return DEMO.find((c) => c.id === id) ?? null;
  const { data, error } = await supabase().from("clientes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? clienteDe(data) : null;
}

/** Cria ou atualiza. Sem id, reaproveita quem já tem o mesmo CPF/CNPJ. */
export async function gravarCliente(x: Partial<Cliente>): Promise<Cliente> {
  const doc = (x.documento ?? "").replace(/\D/g, "");
  if (doc && doc.length !== 11 && doc.length !== 14) throw new Error("CPF deve ter 11 dígitos e CNPJ 14.");
  const linha = {
    nome: (x.nome ?? "").trim(), nome_fantasia: x.nome_fantasia?.trim() || null, tipo: doc.length === 14 ? "PJ" : doc.length === 11 ? "PF" : (x.tipo ?? "PF"),
    documento: doc || null, email: x.email?.trim() || null, telefone: x.telefone?.trim() || null, data_nascimento: x.data_nascimento || null,
    inscricao_municipal: x.inscricao_municipal?.trim() || null, cep: x.cep?.trim() || null, logradouro: x.logradouro?.trim() || null,
    numero: x.numero?.trim() || null, complemento: x.complemento?.trim() || null, bairro: x.bairro?.trim() || null,
    cidade: x.cidade?.trim() || null, uf: x.uf ? x.uf.toUpperCase().slice(0, 2) : null, observacoes: x.observacoes?.trim() || null,
  };
  if (!linha.nome) throw new Error("Informe o nome do cliente.");
  if (modoDemo) return { ...(x as Cliente), ...clienteDe({ ...linha, id: x.id ?? Math.random().toString(36).slice(2) }) };
  const db = supabase();
  let id = x.id;
  if (!id && doc) { const { data } = await db.from("clientes").select("id").eq("documento", doc).maybeSingle(); id = data?.id; }
  const r = id ? await db.from("clientes").update(linha).eq("id", id).select().single() : await db.from("clientes").insert(linha).select().single();
  if (r.error) throw r.error;
  return clienteDe(r.data);
}

export async function arquivarCliente(id: string) {
  if (modoDemo) return;
  const { error } = await supabase().from("clientes").update({ ativo: false }).eq("id", id);
  if (error) throw error;
}

/** Endereço pelo CEP (ViaCEP). */
export async function buscarCep(cep: string): Promise<Partial<Cliente> | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`).then((x) => x.json());
    return r.erro ? null : { logradouro: r.logradouro, bairro: r.bairro, cidade: r.localidade, uf: r.uf };
  } catch { return null; }
}
