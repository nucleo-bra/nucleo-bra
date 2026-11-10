"use client";
// Cadastro de clientes para os campos "Cliente" de todas as abas: ao digitar
// o nome, aparecem os clientes cadastrados e, ao escolher, o formulário recebe
// nome completo, CPF/CNPJ, e-mail, telefone, endereço e nascimento.
import { modoDemo, supabase, lerTudo } from "./supabase";
import { clienteDe, enderecoLinha, type Cliente } from "./clientes";

export type ClienteFicha = Cliente & { endereco: string };

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

let cache: Promise<ClienteFicha[]> | null = null;
export function carregarClientesFicha(forcar = false): Promise<ClienteFicha[]> {
  if (forcar) cache = null;
  cache ??= (async () => {
    if (modoDemo) return [
      { ...clienteDe({ id: "d1", nome: "Eduardo Attie", tipo: "PF", documento: "12345678909", email: "eduardo@email.com", telefone: "19999990000", logradouro: "Rua das Palmeiras", numero: "120", bairro: "Cambuí", cidade: "Campinas", uf: "SP", cep: "13025000" }), endereco: "" },
    ].map((c) => ({ ...c, endereco: enderecoLinha(c) }));
    const data = await lerTudo<Record<string, unknown>>(() => supabase().from("clientes").select("*").eq("ativo", true).order("nome").order("id"));
    return data.map((r) => { const c = clienteDe(r); return { ...c, endereco: enderecoLinha(c) }; });
  })();
  cache.catch(() => { cache = null; });
  return cache;
}
export const esquecerClientesFicha = () => { cache = null; };

/** Cliente com esse nome exato (nome, nome fantasia; sem acento e maiúsculas). */
export function acharPorNome(L: ClienteFicha[], nome: string): ClienteFicha | null {
  const k = norm(nome);
  if (!k) return null;
  return L.find((c) => norm(c.nome) === k) ?? L.find((c) => c.nome_fantasia && norm(c.nome_fantasia) === k) ?? null;
}

/** Sugestões para o que foi digitado: nome, fantasia, CPF/CNPJ, cidade ou e-mail. */
export function sugerirClientes(L: ClienteFicha[], termo: string, max = 8): ClienteFicha[] {
  const partes = norm(termo).split(" ").filter(Boolean);
  if (!partes.length) return [];
  const dig = termo.replace(/\D/g, "");
  return L.filter((c) => {
    const alvo = norm(`${c.nome} ${c.nome_fantasia} ${c.cidade} ${c.email}`);
    return partes.every((p) => alvo.includes(p)) || (dig.length >= 4 && c.documento.includes(dig));
  }).sort((a, b) => Number(norm(b.nome).startsWith(partes[0])) - Number(norm(a.nome).startsWith(partes[0])) || a.nome.localeCompare(b.nome)).slice(0, max);
}

export const telefoneCurto = (t: string) => {
  const d = (t || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t;
};

/** Campos do cadastro no formato usado pelo CRM. */
export const fichaParaCrm = (k: ClienteFicha) => ({
  id: k.id, nome: k.nome, tipo: k.tipo, documento: k.documento, email: k.email, telefone: k.telefone, data_nascimento: k.data_nascimento,
  cep: k.cep, logradouro: k.logradouro, numero: k.numero, complemento: k.complemento, bairro: k.bairro, cidade: k.cidade, uf: k.uf,
});
