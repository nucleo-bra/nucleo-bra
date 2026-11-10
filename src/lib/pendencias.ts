"use client";
// Pendências de cadastro: o que falta preencher para o sistema funcionar
// completo (preenchimento automático, aceite do orçamento, comissões, avisos).
import { lerTudo, modoDemo, supabase } from "./supabase";
import { hojeLocal } from "./texto";

export type ItemPend = { id: string; titulo: string; detalhe: string; link: string };
export type GrupoPend = { chave: string; titulo: string; porque: string; itens: ItemPend[]; total: number };

const doc = (d: string) => (d || "").replace(/\D/g, "");
const linkCartao = (id: string, modulo: string, quadro: string) =>
  modulo === "chamados" ? `/tecnico/chamados/?c=${id}` : modulo === "agendamentos" ? `/tecnico/agendamentos/?c=${id}` : `/tecnico/projetos/?q=${quadro}&c=${id}`;

/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco chegam sem tipo */
export function montarPendencias(d: {
  clientes: any[]; produtos: any[]; negocios: any[]; propostas: any[]; cartoes: any[]; pix: number;
}, hoje = hojeLocal()): GrupoPend[] {
  const G: GrupoPend[] = [];
  const add = (chave: string, titulo: string, porque: string, itens: ItemPend[]) => { if (itens.length) G.push({ chave, titulo, porque, itens, total: itens.length }); };
  const cli = d.clientes.filter((c) => c.ativo !== false && !c.principal_id);
  add("cli-doc", "Clientes sem CPF/CNPJ", "Sem o documento, o aceite do orçamento e o contrato saem incompletos.",
    cli.filter((c) => ![11, 14].includes(doc(c.documento).length)).map((c) => ({ id: c.id, titulo: c.nome, detalhe: [c.cidade, c.telefone].filter(Boolean).join(" · ") || "sem dados", link: `/clientes/ficha/?id=${c.id}` })));
  add("cli-email", "Clientes sem e-mail", "O e-mail sai no aceite do orçamento e no contrato, e é por onde o cliente recebe os documentos.",
    cli.filter((c) => !String(c.email ?? "").includes("@")).map((c) => ({ id: c.id, titulo: c.nome, detalhe: [c.cidade, c.telefone].filter(Boolean).join(" · ") || "sem dados", link: `/clientes/ficha/?id=${c.id}` })));
  add("cli-end", "Clientes sem cidade", "Sem cidade o cliente não aparece no Mapa e o endereço da visita fica em branco.",
    cli.filter((c) => !String(c.cidade ?? "").trim()).map((c) => ({ id: c.id, titulo: c.nome, detalhe: c.documento ? "tem documento" : "sem documento", link: `/clientes/ficha/?id=${c.id}` })));
  const prod = d.produtos.filter((p) => p.ativo !== false);
  add("prod-preco", "Produtos sem preço de venda", "Entram no orçamento com valor zero.",
    prod.filter((p) => !(Number(p.preco_venda) > 0)).map((p) => ({ id: p.id, titulo: p.nome, detalhe: [p.marca, p.modelo].filter(Boolean).join(" · "), link: `/produtos/?id=${p.id}` })));
  add("prod-prej", "Produtos vendidos abaixo do custo", "Cada venda desse item dá prejuízo.",
    prod.filter((p) => Number(p.preco_venda) > 0 && Number(p.custo) > Number(p.preco_venda)).map((p) => ({ id: p.id, titulo: p.nome, detalhe: `custo ${Number(p.custo).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · venda ${Number(p.preco_venda).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`, link: `/produtos/?id=${p.id}` })));
  add("neg-fin", "Negócios ganhos sem lançamento no Financeiro", "Recebimento e comissão desses fechamentos não estão no Financeiro.",
    d.negocios.filter((n) => n.etapa === "ganho" && !n.financeiro_lancado_em).map((n) => ({ id: n.id, titulo: n.cliente_nome || n.titulo, detalhe: `${n.titulo}${n.valor_estimado ? " · " + Number(n.valor_estimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : ""}`, link: `/crm/?aba=negocios&n=${n.id}` })));
  add("neg-cli", "Negócios sem cliente do cadastro", "Sem o vínculo, o CRM e o orçamento não puxam os dados do cliente.",
    d.negocios.filter((n) => !n.cliente_id && !["perdido"].includes(n.etapa)).map((n) => ({ id: n.id, titulo: n.cliente_nome || n.titulo, detalhe: n.titulo, link: `/crm/?aba=negocios&n=${n.id}` })));
  add("orc-cli", "Orçamentos sem cliente", "O aceite sai só com o nome, sem CPF/CNPJ, e-mail e endereço.",
    d.propostas.filter((p) => !p.cliente_id && p.status !== "substituida").map((p) => ({ id: p.id, titulo: p.titulo || `Proposta ${p.numero}`, detalhe: `nº ${p.numero}${p.versao ? " " + p.versao : ""}`, link: `/orcamentos/?id=${p.id}` })));
  add("cart-prazo", "Cartões técnicos com prazo vencido", "Atraso real ou cartão que ficou aberto sem necessidade.",
    d.cartoes.filter((c) => c.prazo && !c.prazo_concluido && String(c.prazo).slice(0, 10) < hoje).map((c) => ({ id: c.id, titulo: c.titulo, detalhe: `${c.cliente_nome ? c.cliente_nome + " · " : ""}prazo ${String(c.prazo).slice(8, 10)}/${String(c.prazo).slice(5, 7)}`, link: linkCartao(c.id, c.quadros?.modulo ?? "projetos", c.quadro_id) })));
  if (d.pix > 0) G.push({ chave: "pix", titulo: "Parcelas com “Pix” sem PJ/CPF", porque: "Não entram nos filtros Pix PJ e Pix CPF do A receber. Edite a forma no Financeiro.", itens: [], total: d.pix });
  return G;
}

export async function carregarPendencias(): Promise<GrupoPend[]> {
  if (modoDemo) return montarPendencias({ clientes: [{ id: "d1", nome: "Eduardo Attie", documento: "", email: "", cidade: "Campinas" }], produtos: [{ id: "p1", nome: "Central Control4 EA-1", preco_venda: 0, custo: 900 }], negocios: [], propostas: [], cartoes: [], pix: 12 });
  const db = supabase();
  const [clientes, produtos, negocios, propostas, cartoes, pix] = await Promise.all([
    lerTudo<any>(() => db.from("clientes").select("id, nome, documento, email, cidade, telefone, ativo, principal_id").eq("ativo", true).order("nome").order("id")),
    lerTudo<any>(() => db.from("produtos").select("id, nome, marca, modelo, preco_venda, custo, ativo").eq("ativo", true).order("nome").order("id")),
    lerTudo<any>(() => db.from("oportunidades").select("id, titulo, cliente_nome, cliente_id, etapa, valor_estimado, financeiro_lancado_em").order("id")),
    lerTudo<any>(() => db.from("propostas").select("id, numero, versao, titulo, cliente_id, status").order("id")),
    lerTudo<any>(() => db.from("cartoes").select("id, titulo, cliente_nome, prazo, prazo_concluido, quadro_id, quadros(modulo, arquivado)").eq("arquivado", false).is("concluido_em", null).not("prazo", "is", null).order("id")),
    db.from("fin_docs").select("id", { count: "exact", head: true }).eq("colecao", "it").eq("dados->>t", "r").eq("dados->>forma", "Pix").then((r) => r.count ?? 0),
  ]);
  return montarPendencias({ clientes, produtos, negocios, propostas, cartoes: cartoes.filter((c) => !c.quadros?.arquivado), pix });
}
