"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco chegam sem tipo */
// Cadastro de clientes: lista em cartões, edição e criação.
import { lerTudo, modoDemo, supabase } from "./supabase";
import { aplicarFila, comCache, gravarOuEnfileirar, lerLocal, listarFila, novoId, precisaDeInternet } from "./offline";

export type Cliente = {
  id: string; nome: string; nome_fantasia: string; tipo: "PF" | "PJ"; documento: string; email: string; telefone: string;
  data_nascimento: string; inscricao_municipal: string; cep: string; logradouro: string; numero: string; complemento: string;
  bairro: string; cidade: string; uf: string; observacoes: string; parceiro_origem_id: string | null; ativo: boolean;
};
export type ClienteCartao = Cliente & {
  negocios: number; negocio_aberto: { id: string; numero: number | null; titulo: string; etapa: string; valor: number } | null;
  a_receber: number; contratos: number; atualizado: string;
  /** cadastro principal, quando este é um aditivo (contrato novo do mesmo cliente) */
  principal_id: string | null;
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
    principal_id: null, negocios: 1, negocio_aberto: { id: "n1", numero: 1, titulo: "Quinta da Baronesa", etapa: "negociacao", valor: 265000 }, a_receber: 0, contratos: 0, atualizado: "2026-10-26" },
  { ...clienteDe({ id: "d2", nome: "PLAENGE EMPREENDIMENTOS LTDA", nome_fantasia: "Plaenge", tipo: "PJ", documento: "78638061008908", email: "f.tavares@plaenge.com.br", cidade: "Campinas", uf: "SP" }),
    principal_id: null, negocios: 0, negocio_aberto: null, a_receber: 4409.2, contratos: 1, atualizado: "2026-10-20" },
];

export async function listarCartoes(): Promise<ClienteCartao[]> {
  if (modoDemo) return JSON.parse(JSON.stringify(DEMO));
  const bruto = await comCache("clientes-cartoes", () => lerTudo<any>(() => supabase().from("clientes")
    .select("*, oportunidades(id, numero, titulo, etapa, valor_estimado, updated_at), titulos(valor, status, natureza), contratos(id)")
    .eq("ativo", true).order("nome").order("id")));
  // alterações feitas sem internet (fila) por cima da cópia guardada
  const data = aplicarFila(bruto, await listarFila(), "clientes").filter((r: any) => r.ativo !== false)
    .sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome)));
  return data.map((r: any) => {
    const ops = (r.oportunidades ?? []) as any[];
    const aberto = ops.filter((o) => !["ganho", "perdido"].includes(o.etapa)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0]
      ?? ops.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
    return {
      ...clienteDe(r), negocios: ops.length, contratos: (r.contratos ?? []).length, atualizado: r.updated_at, principal_id: r.principal_id ?? null,
      negocio_aberto: aberto ? { id: aberto.id, numero: aberto.numero, titulo: aberto.titulo, etapa: aberto.etapa, valor: Number(aberto.valor_estimado) } : null,
      a_receber: (r.titulos ?? []).filter((t: any) => t.natureza === "receber" && t.status === "aberto").reduce((x: number, t: any) => x + Number(t.valor), 0),
    };
  });
}

export async function lerCliente(id: string): Promise<Cliente | null> {
  if (modoDemo) return DEMO.find((c) => c.id === id) ?? null;
  const data = await comCache(`cliente:${id}`, async () => {
    const { data, error } = await supabase().from("clientes").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }).catch(async (e) => {
    // nunca aberto neste aparelho: procura na lista de clientes guardada
    const l = await lerLocal<{ v: any[] }>("c:clientes-cartoes");
    const r = l?.v.find((x) => x.id === id);
    if (r) return r;
    throw e;
  });
  const [r] = aplicarFila(data ? [data] : [], await listarFila(), "clientes").filter((x: any) => x.id === id);
  return r ? clienteDe(r) : null;
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
  if (!id && doc) { const { data } = await db.from("clientes").select("id").eq("documento", doc).maybeSingle().then((r: any) => r, () => ({ data: null })); id = data?.id; }
  const existe = !!id, cid = id ?? novoId();
  return gravarOuEnfileirar({ tipo: "tabela", acao: existe ? "update" : "insert", tabela: "clientes", id: cid, dados: linha, colunaData: "updated_at", rotulo: `Cliente ${linha.nome}` },
    () => (existe ? db.from("clientes").update(linha).eq("id", cid).select().single() : db.from("clientes").insert({ ...linha, id: cid }).select().single()),
    () => clienteDe({ ...(x as object), ...linha, id: cid, ativo: true }), (d) => clienteDe(d));
}

export async function arquivarCliente(id: string) {
  if (modoDemo) return;
  await gravarOuEnfileirar({ tipo: "tabela", acao: "update", tabela: "clientes", id, dados: { ativo: false }, colunaData: "updated_at", rotulo: "Arquivar cliente" },
    () => supabase().from("clientes").update({ ativo: false }).eq("id", id), () => null);
}

/**
 * Junta dois cartões: "origem" vira aditivo de "destino" (o cliente principal).
 * Negócios, contratos, financeiro e documentos da origem passam a aparecer no
 * cartão principal. Nada é apagado — dá para desvincular depois na ficha.
 */
export async function juntarClientes(origemId: string, destinoId: string): Promise<string> {
  if (origemId === destinoId) throw new Error("Escolha dois clientes diferentes.");
  if (modoDemo) return destinoId;
  precisaDeInternet("juntar clientes");
  const db = supabase();
  const { data: dst, error: e1 } = await db.from("clientes").select("id, principal_id").eq("id", destinoId).single();
  if (e1) throw e1;
  const principal = (dst.principal_id as string | null) ?? destinoId;       // soltou sobre um aditivo: vai para o principal dele
  if (principal === origemId) throw new Error("Esse cliente já é o principal do outro.");
  // os aditivos da origem passam para o novo principal
  const a = await db.from("clientes").update({ principal_id: principal }).eq("principal_id", origemId);
  if (a.error) throw a.error;
  const b = await db.from("clientes").update({ principal_id: principal }).eq("id", origemId);
  if (b.error) throw b.error;
  return principal;
}

/** Desfaz a junção: o aditivo volta a ser um cliente separado. */
export async function desvincularAditivo(id: string) {
  if (modoDemo) return;
  precisaDeInternet("desvincular o aditivo");
  const { error } = await supabase().from("clientes").update({ principal_id: null }).eq("id", id);
  if (error) throw error;
}

/** Exclui o cadastro de vez (só sem negócios, contratos, projetos ou financeiro ligados). */
export async function excluirCliente(id: string) {
  if (modoDemo) return;
  precisaDeInternet("excluir o cliente");
  const db = supabase();
  const { error, count } = await db.from("clientes").delete({ count: "exact" }).eq("id", id);
  if (error) {
    if (/foreign key|violates|restrict/i.test(error.message)) throw new Error("Este cliente tem projetos, orçamentos, contratos ou financeiro ligados. Junte-o ao cliente principal (arraste o cartão) ou arquive.");
    throw error;
  }
  if (!count) throw new Error("Sem permissão para excluir (só a diretoria exclui).");
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
