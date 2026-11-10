"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco chegam sem tipo; convertidas campo a campo */
// Cartão do cliente: junta, só para leitura, tudo que acontece com ele no
// sistema — CRM, orçamentos, contratos, Financeiro (v38), chamados, visitas,
// projetos, documentos e os aditivos (cadastros ligados a ele). Nada é criado
// aqui: o que muda nas outras áreas aparece aqui sozinho.
import { modoDemo, supabase } from "./supabase";
import { hojeLocal } from "./texto";

export type Parcela360 = { id: string; descricao: string; valor: number; vencimento: string | null; pago_em: string | null; recebido: number; situacao: string; parcela: string; nf: string | null; cliente: string; comissoes: { n: string; r: string; p: number }[] };
export type Cartao360 = { id: string; numero: number | null; titulo: string; modulo: "projetos" | "chamados" | "agendamentos"; quadro: string; lista: string; prazo: string | null; agenda_inicio: string | null; concluido_em: string | null; created_at: string; equipe: string[]; endereco: string | null };
export type Profissional = { nome: string; papel: string; origem: "parceiro" | "equipe" | "tecnico"; detalhe: string; parceiro_id?: string };
export type Evento = { data: string; tipo: string; titulo: string; detalhe?: string; link?: string; cor: string };
export type Ficha360 = {
  cliente: any; principal: { id: string; nome: string } | null; aditivos: { id: string; nome: string; cidade: string | null }[];
  negocios: any[]; orcamentos: any[]; contratos: any[]; documentos: any[]; notas: any[]; titulos: any[]; projetos: any[];
  parcelas: Parcela360[]; cartoes: Cartao360[]; atividades: any[]; profissionais: Profissional[]; eventos: Evento[];
  resumo: { fechado: number; pago: number; aberto: number; vencido: number; visitasFeitas: number; visitasAgendadas: number; chamadosAbertos: number; chamados: number; negociosAbertos: number };
};

const n = (v: unknown) => Number(v ?? 0) || 0;
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const PAPEL_PARCEIRO: Record<string, string> = { arquiteto: "Arquiteto(a)", designer: "Designer", engenheiro: "Engenheiro(a)", construtora: "Construtora", incorporadora: "Incorporadora", outro: "Parceiro" };

export async function carregarFicha360(id: string): Promise<Ficha360 | null> {
  if (modoDemo) return null;
  const db = supabase();
  const { data: c, error } = await db.from("clientes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!c) return null;
  const [adt, pri] = await Promise.all([
    db.from("clientes").select("id, nome, nome_fantasia, cidade").eq("principal_id", id).order("nome"),
    c.principal_id ? db.from("clientes").select("id, nome").eq("id", c.principal_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const aditivos = (adt.data ?? []) as { id: string; nome: string; nome_fantasia: string | null; cidade: string | null }[];
  const ids = [id, ...aditivos.map((a) => a.id)];
  const nomes = [...new Set([c.nome, c.nome_fantasia, ...aditivos.flatMap((a) => [a.nome, a.nome_fantasia])].filter(Boolean) as string[])];
  const emIds = `(${ids.join(",")})`;

  const neg = await db.from("oportunidades").select("id, numero, titulo, cliente_nome, etapa, valor_estimado, data_ref, fechada_em, created_at, parceiro_id, proposta_id, parceiros(nome, tipo)")
    .in("cliente_id", ids).order("created_at", { ascending: false });
  const negocios = (neg.data ?? []) as any[];
  const negIds = negocios.map((x) => x.id);
  const ouNeg = (campo: string) => [`${campo}.in.${emIds}`, ...(negIds.length ? [`oportunidade_id.in.(${negIds.join(",")})`] : [])].join(",");

  const [prop, ctr, docs, nf, tit, proj, car, atv, fin, per, tec] = await Promise.all([
    db.from("propostas").select("id, numero, versao, titulo, status, total_final, data_emissao, editado_em, oportunidade_id, documento_id, origem, proposta_itens(count)").or(ouNeg("cliente_id")).order("editado_em", { ascending: false }),
    db.from("contratos").select("id, numero, status, valor, assinado_em, enviado_em, created_at, oportunidade_id, proposta_id, arquivo_path, arquivo_nome, assinado_path").or(ouNeg("cliente_id")).order("created_at", { ascending: false }),
    db.from("documentos").select("id, tipo, nome, storage_path, created_at, oportunidade_id").or(ouNeg("cliente_id")).order("created_at", { ascending: false }),
    db.from("notas_fiscais").select("id, numero, tipo, emitida_em, valor_servicos, status, ordem_compra").in("cliente_id", ids).order("emitida_em", { ascending: false }),
    db.from("titulos").select("id, descricao, valor, vencimento, status, linha_digitavel").in("cliente_id", ids).order("vencimento", { ascending: false }),
    db.from("projetos").select("id, nome, status, endereco, cidade, created_at").in("cliente_id", ids).order("created_at"),
    db.from("cartoes").select("id, numero, titulo, prazo, agenda_inicio, concluido_em, created_at, membros, endereco, arquivado, quadros(nome, modulo), quadro_listas(nome)")
      .or([`cliente_id.in.${emIds}`, ...nomes.map((x) => `cliente_nome.eq."${x.replace(/"/g, "")}"`)].join(",")).eq("arquivado", false).order("created_at", { ascending: false }).limit(300),
    negIds.length ? db.from("atividades").select("id, tipo, titulo, quando, concluida, oportunidade_id, endereco").in("oportunidade_id", negIds).order("quando", { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    nomes.length ? db.from("fin_lancamentos").select("id, tipo, descricao, cliente, parcela, nf, valor, vencimento, pago_em, valor_recebido, situacao, comissoes").eq("tipo", "r").in("cliente", nomes).limit(1000) : Promise.resolve({ data: [] }),
    db.from("perfis").select("id, nome, papel"),
    db.from("tecnicos").select("id, nome").then((r) => (r.error ? { data: [] } : r)),
  ]);
  const perfis = new Map([...((per.data ?? []) as any[]), ...((tec.data ?? []) as any[]).map((t) => ({ ...t, papel: "tecnico" }))].map((p) => [p.id, p]));

  const parcelas: Parcela360[] = ((fin.data ?? []) as any[]).map((p) => ({
    id: p.id, descricao: p.descricao ?? "", valor: n(p.valor), vencimento: p.vencimento, pago_em: p.pago_em, recebido: n(p.valor_recebido),
    situacao: p.situacao, parcela: p.parcela ?? "", nf: p.nf, cliente: p.cliente, comissoes: Array.isArray(p.comissoes) ? p.comissoes : [],
  })).sort((a, b) => (b.vencimento ?? "").localeCompare(a.vencimento ?? ""));

  const cartoes: Cartao360[] = ((car.data ?? []) as any[]).map((k) => ({
    id: k.id, numero: k.numero, titulo: k.titulo, modulo: (k.quadros?.modulo ?? "projetos"), quadro: k.quadros?.nome ?? "", lista: k.quadro_listas?.nome ?? "",
    prazo: k.prazo, agenda_inicio: k.agenda_inicio, concluido_em: k.concluido_em, created_at: k.created_at, endereco: k.endereco,
    equipe: ((k.membros ?? []) as string[]).map((m) => perfis.get(m)?.nome).filter(Boolean) as string[],
  }));
  const atividades = (atv.data ?? []) as any[];

  // profissionais: parceiros dos negócios, equipe comissionada no Financeiro e técnicos que atenderam
  const prof = new Map<string, Profissional>();
  for (const x of negocios) if (x.parceiros?.nome) {
    const k = "p:" + norm(x.parceiros.nome);
    if (!prof.has(k)) prof.set(k, { nome: x.parceiros.nome, papel: PAPEL_PARCEIRO[x.parceiros.tipo] ?? "Parceiro", origem: "parceiro", detalhe: `Negócio ${x.numero ?? ""} ${x.titulo}`.trim(), parceiro_id: x.parceiro_id });
  }
  for (const p of parcelas) for (const cm of p.comissoes) {
    if (!cm?.n || cm.r === "Vendedor") continue;
    const k = (/arquitet|designer|parceiro/i.test(cm.r) ? "p:" : "e:") + norm(cm.n);
    if (!prof.has(k) && !prof.has("p:" + norm(cm.n))) prof.set(k, { nome: cm.n, papel: cm.r, origem: /arquitet|designer|parceiro/i.test(cm.r) ? "parceiro" : "equipe", detalhe: `Comissão de ${String(cm.p).replace(".", ",")}%` });
  }
  const atendeu = new Map<string, number>();
  for (const k of cartoes) for (const m of k.equipe) atendeu.set(m, (atendeu.get(m) ?? 0) + 1);
  for (const [nome, qtd] of atendeu) prof.set("t:" + norm(nome), { nome, papel: "Equipe técnica", origem: "tecnico", detalhe: `${qtd} atendimento(s)` });

  const hoje = hojeLocal();
  const visitasCartao = cartoes.filter((k) => k.modulo === "agendamentos");
  const visitasCrm = atividades.filter((a) => a.tipo === "visita");
  const feitas = visitasCartao.filter((k) => k.concluido_em || (k.agenda_inicio && k.agenda_inicio.slice(0, 10) < hoje)).length + visitasCrm.filter((a) => a.concluida || a.quando.slice(0, 10) < hoje).length;
  const agendadas = visitasCartao.filter((k) => !k.concluido_em && k.agenda_inicio && k.agenda_inicio.slice(0, 10) >= hoje).length + visitasCrm.filter((a) => !a.concluida && a.quando.slice(0, 10) >= hoje).length;
  const chamados = cartoes.filter((k) => k.modulo === "chamados");

  const contratos = (ctr.data ?? []).map((x: any) => ({ ...x, valor: n(x.valor) }));
  const ganhos = negocios.filter((x) => x.etapa === "ganho");
  const assinados = contratos.filter((x: any) => x.status === "assinado" || x.status === "encerrado");
  const fechadoParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
  const fechado = Math.max(fechadoParcelas, assinados.reduce((s: number, x: any) => s + x.valor, 0), ganhos.reduce((s, x) => s + n(x.valor_estimado), 0));

  const orcamentos = ((prop.data ?? []) as any[]).map((p) => ({ ...p, total_final: n(p.total_final), itens: p.proposta_itens?.[0]?.count ?? 0 }));
  const documentos = (docs.data ?? []) as any[];
  const negNome = new Map(negocios.map((x) => [x.id, `${x.numero ? x.numero + " - " : ""}${x.titulo}`]));

  // linha do tempo
  const ev: Evento[] = [];
  for (const x of negocios) ev.push({ data: x.created_at, tipo: "Negócio", titulo: `${x.numero ? x.numero + " - " : ""}${x.titulo}`, detalhe: x.etapa === "ganho" ? "fechado" : x.etapa, link: `/crm/?aba=negocios&n=${x.id}`, cor: "#0071e3" });
  for (const x of ganhos) if (x.fechada_em) ev.push({ data: x.fechada_em, tipo: "Fechamento", titulo: `${x.titulo}`, detalhe: `R$ ${n(x.valor_estimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, link: `/crm/?aba=negocios&n=${x.id}`, cor: "#34c759" });
  for (const p of orcamentos) ev.push({ data: p.editado_em ?? p.data_emissao, tipo: "Orçamento", titulo: `Nº ${p.numero} · ${p.titulo ?? ""}`, detalhe: p.status === "aprovada" ? "ganho" : undefined, link: p.oportunidade_id ? `/crm/?aba=negocios&n=${p.oportunidade_id}&orc=${p.id}` : undefined, cor: "#ff9500" });
  for (const x of contratos) ev.push({ data: x.assinado_em ?? x.created_at, tipo: "Contrato", titulo: `Contrato ${x.numero}`, detalhe: x.status, link: `/contratos/?c=${x.id}`, cor: "#af52de" });
  for (const p of parcelas) if (p.pago_em) ev.push({ data: p.pago_em, tipo: "Pagamento", titulo: p.descricao || "Parcela recebida", detalhe: `R$ ${(p.recebido || p.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, cor: "#34c759" });
  for (const k of cartoes) ev.push({ data: k.agenda_inicio ?? k.created_at, tipo: k.modulo === "chamados" ? "Chamado" : k.modulo === "agendamentos" ? "Visita" : "Projeto", titulo: `${k.numero ? k.numero + " · " : ""}${k.titulo}`, detalhe: [k.lista, k.equipe.join(", ")].filter(Boolean).join(" · "), link: `/tecnico/${k.modulo}/`, cor: k.modulo === "chamados" ? "#ff3b30" : "#32ade6" });
  for (const a of atividades) ev.push({ data: a.quando, tipo: "Atendimento", titulo: a.titulo, detalhe: `${negNome.get(a.oportunidade_id) ?? ""}${a.concluida ? " · concluído" : ""}`, link: `/crm/?aba=negocios&n=${a.oportunidade_id}`, cor: "#8e8e93" });
  for (const d of documentos) ev.push({ data: d.created_at, tipo: "Documento", titulo: d.nome, cor: "#c7c7cc" });
  ev.sort((a, b) => b.data.localeCompare(a.data));

  return {
    cliente: c, principal: (pri.data as any) ?? null, aditivos: aditivos.map((a) => ({ id: a.id, nome: a.nome_fantasia || a.nome, cidade: a.cidade })),
    negocios, orcamentos, contratos, documentos: documentos.map((d) => ({ ...d, negocio: d.oportunidade_id ? negNome.get(d.oportunidade_id) ?? null : null })),
    notas: (nf.data ?? []).map((x: any) => ({ ...x, valor_servicos: n(x.valor_servicos) })), titulos: (tit.data ?? []).map((x: any) => ({ ...x, valor: n(x.valor) })),
    projetos: proj.data ?? [], parcelas, cartoes, atividades, profissionais: [...prof.values()], eventos: ev.slice(0, 120),
    resumo: {
      fechado, pago: parcelas.filter((p) => p.pago_em).reduce((s, p) => s + (p.recebido || p.valor), 0),
      aberto: parcelas.filter((p) => !p.pago_em && p.situacao !== "atrasado").reduce((s, p) => s + p.valor, 0),
      vencido: parcelas.filter((p) => !p.pago_em && p.situacao === "atrasado").reduce((s, p) => s + p.valor, 0),
      visitasFeitas: feitas, visitasAgendadas: agendadas, chamados: chamados.length, chamadosAbertos: chamados.filter((k) => !k.concluido_em).length,
      negociosAbertos: negocios.filter((x) => !["ganho", "perdido"].includes(x.etapa)).length,
    },
  };
}
