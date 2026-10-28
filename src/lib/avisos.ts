/* Avisos do Núcleo: o sininho e o popup ao entrar.
 *  • Notificações — gravadas pelo banco quando alguém atribui um cartão,
 *    comenta ou passa uma atividade para você (tabela notificacoes).
 *  • Alertas — calculados na hora a partir dos dados: parcelas vencendo ou
 *    em atraso, prazos de cartões, visitas do dia e atividades do CRM.
 *    Somem sozinhos quando o assunto é resolvido.
 */
import { modoDemo, supabase } from "./supabase";

export type Notificacao = {
  id: string; tipo: string; titulo: string; corpo: string | null; link: string | null;
  lida_em: string | null; created_at: string;
};
export type Nivel = "erro" | "atencao" | "info";
export type Alerta = {
  chave: string; nivel: Nivel; grupo: "financeiro" | "tecnico" | "crm";
  titulo: string; corpo: string; link: string;
};

export const DIAS_AVISO_VENCIMENTO = 3;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDias = (s: string, n: number) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const hora = (s: string) => new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type Parcela = { id: string; tipo: string; descricao: string; cliente: string; valor: number; vencimento: string; parcela: string | null };
export type CartaoAviso = { id: string; titulo: string; numero: number | null; cliente_nome: string | null; prazo: string | null; agenda_inicio: string | null; modulo: string; quadro_id: string };
export type AtividadeAviso = { id: string; titulo: string; quando: string; oportunidade_id: string | null };

const linkCartao = (c: CartaoAviso) =>
  c.modulo === "chamados" ? `/tecnico/chamados/?c=${c.id}` : c.modulo === "agendamentos" ? `/tecnico/agendamentos/?c=${c.id}` : `/tecnico/projetos/?q=${c.quadro_id}&c=${c.id}`;

/** Regras dos alertas (puras, testáveis). */
export function montarAlertas({ parcelas, cartoes, atividades }: { parcelas: Parcela[]; cartoes: CartaoAviso[]; atividades: AtividadeAviso[] }, agora = new Date()): Alerta[] {
  const hoje = iso(agora), amanha = addDias(hoje, 1), limite = addDias(hoje, DIAS_AVISO_VENCIMENTO);
  const A: Alerta[] = [];

  // ---- financeiro
  const receber = parcelas.filter((p) => p.tipo !== "p"), pagar = parcelas.filter((p) => p.tipo === "p");
  const bloco = (lista: Parcela[], rotulo: "receber" | "pagar") => {
    const atras = lista.filter((p) => p.vencimento < hoje);
    if (atras.length) A.push({
      chave: `fin-${rotulo}-atraso`, nivel: "erro", grupo: "financeiro",
      titulo: rotulo === "receber" ? `${plural(atras.length, "parcela em atraso", "parcelas em atraso")}` : `${plural(atras.length, "conta a pagar em atraso", "contas a pagar em atraso")}`,
      corpo: `${reais(atras.reduce((s, p) => s + p.valor, 0))} · mais antiga ${dm(atras.reduce((m, p) => (p.vencimento < m ? p.vencimento : m), hoje))}${atras.length <= 3 ? " · " + atras.map((p) => p.cliente || p.descricao).join(", ") : ""}`,
      link: "/financeiro/",
    });
    for (const p of lista.filter((x) => x.vencimento >= hoje && x.vencimento <= limite).sort((a, b) => a.vencimento.localeCompare(b.vencimento))) {
      const quando = p.vencimento === hoje ? "vence hoje" : p.vencimento === amanha ? "vence amanhã" : `vence ${dm(p.vencimento)}`;
      A.push({
        chave: `fin-${p.id}`, nivel: p.vencimento === hoje ? "atencao" : "info", grupo: "financeiro",
        titulo: `${rotulo === "receber" ? "Parcela" : "Conta a pagar"} ${quando}`,
        corpo: `${p.cliente || p.descricao}${p.parcela ? ` · ${p.parcela}` : ""} · ${reais(p.valor)}`,
        link: "/financeiro/",
      });
    }
  };
  bloco(receber, "receber"); bloco(pagar, "pagar");

  // ---- técnico (cartões em que a pessoa está)
  for (const c of cartoes) {
    const nome = `${c.numero != null && c.modulo !== "projetos" ? `#${c.numero} ` : ""}${c.titulo}${c.cliente_nome ? ` · ${c.cliente_nome}` : ""}`;
    if (c.agenda_inicio && iso(new Date(c.agenda_inicio)) === hoje) {
      A.push({ chave: `vis-${c.id}`, nivel: "atencao", grupo: "tecnico", titulo: `Visita hoje às ${hora(c.agenda_inicio)}`, corpo: nome, link: linkCartao(c) });
    } else if (c.agenda_inicio && iso(new Date(c.agenda_inicio)) === amanha) {
      A.push({ chave: `vis-${c.id}`, nivel: "info", grupo: "tecnico", titulo: `Visita amanhã às ${hora(c.agenda_inicio)}`, corpo: nome, link: linkCartao(c) });
    }
    if (c.prazo) {
      const p = iso(new Date(c.prazo));
      if (p < hoje) A.push({ chave: `prz-${c.id}`, nivel: "erro", grupo: "tecnico", titulo: `Prazo vencido em ${dm(p)}`, corpo: nome, link: linkCartao(c) });
      else if (p === hoje) A.push({ chave: `prz-${c.id}`, nivel: "atencao", grupo: "tecnico", titulo: "Prazo vence hoje", corpo: nome, link: linkCartao(c) });
      else if (p === amanha) A.push({ chave: `prz-${c.id}`, nivel: "info", grupo: "tecnico", titulo: "Prazo vence amanhã", corpo: nome, link: linkCartao(c) });
    }
  }

  // ---- CRM (atividades da pessoa)
  const atrasadas = atividades.filter((a) => iso(new Date(a.quando)) < hoje);
  const deHoje = atividades.filter((a) => iso(new Date(a.quando)) === hoje);
  if (atrasadas.length) A.push({
    chave: "crm-atraso", nivel: "erro", grupo: "crm", titulo: plural(atrasadas.length, "atividade atrasada no CRM", "atividades atrasadas no CRM"),
    corpo: atrasadas.slice(0, 3).map((a) => a.titulo).join(" · "), link: "/crm/?aba=agenda",
  });
  for (const a of deHoje.sort((x, y) => x.quando.localeCompare(y.quando))) A.push({
    chave: `crm-${a.id}`, nivel: "atencao", grupo: "crm", titulo: `Hoje às ${hora(a.quando)}`, corpo: a.titulo,
    link: a.oportunidade_id ? `/crm/?aba=negocios&n=${a.oportunidade_id}` : "/crm/?aba=agenda",
  });

  const peso: Record<Nivel, number> = { erro: 0, atencao: 1, info: 2 };
  return A.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

// ---------------------------------------------------------------- banco
export async function carregarAvisos(uid: string, papel?: string): Promise<{ notificacoes: Notificacao[]; alertas: Alerta[] }> {
  if (modoDemo) return demo();
  const db = supabase();
  const hoje = iso(new Date()), limite = addDias(hoje, DIAS_AVISO_VENCIMENTO), amanhaFim = addDias(hoje, 2);
  const tecnico = papel === "tecnico";
  const verFinanceiro = papel === "diretoria" || papel === "financeiro";
  const [not, fin, car, atv] = await Promise.all([
    db.from("notificacoes").select("id, tipo, titulo, corpo, link, lida_em, created_at").order("created_at", { ascending: false }).limit(40),
    !verFinanceiro ? Promise.resolve({ data: [] as never[] })
      : db.from("fin_lancamentos").select("id, tipo, descricao, cliente, valor, vencimento, parcela").is("pago_em", null).lte("vencimento", limite).limit(300),
    db.from("cartoes").select("id, titulo, numero, cliente_nome, prazo, prazo_concluido, agenda_inicio, quadro_id, quadros(modulo, arquivado)")
      .contains("membros", [uid]).eq("arquivado", false).is("concluido_em", null)
      .or(`prazo.lt.${amanhaFim},agenda_inicio.lt.${amanhaFim}`).limit(200),
    tecnico ? Promise.resolve({ data: [] as never[] })
      : db.from("atividades").select("id, titulo, quando, oportunidade_id").eq("responsavel_id", uid).eq("concluida", false).lt("quando", addDias(hoje, 1) + "T00:00:00-03:00").limit(100),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cartoes: CartaoAviso[] = ((car.data ?? []) as any[])
    .filter((c) => !c.quadros?.arquivado)
    .map((c) => ({
      id: c.id, titulo: c.titulo, numero: c.numero, cliente_nome: c.cliente_nome, quadro_id: c.quadro_id, modulo: c.quadros?.modulo ?? "projetos",
      prazo: c.prazo_concluido ? null : c.prazo,
      agenda_inicio: c.agenda_inicio && c.agenda_inicio >= hoje ? c.agenda_inicio : null,
    }));
  return {
    notificacoes: (not.data ?? []) as Notificacao[],
    alertas: montarAlertas({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parcelas: ((fin.data ?? []) as any[]).filter((p) => p.vencimento).map((p) => ({ ...p, valor: Number(p.valor) || 0 })),
      cartoes, atividades: (atv.data ?? []) as AtividadeAviso[],
    }),
  };
}

export async function marcarLida(id: string) {
  if (modoDemo) return;
  await supabase().from("notificacoes").update({ lida_em: new Date().toISOString() }).eq("id", id).is("lida_em", null);
}
export async function marcarTodasLidas() {
  if (modoDemo) return;
  await supabase().from("notificacoes").update({ lida_em: new Date().toISOString() }).is("lida_em", null);
}
export async function limparLidas() {
  if (modoDemo) return;
  await supabase().from("notificacoes").delete().not("lida_em", "is", null);
}

/** Avisa na hora quando chega notificação nova. Devolve a função para parar. */
export function ouvirNotificacoes(uid: string, aoChegar: (n: Notificacao) => void): () => void {
  if (modoDemo) return () => {};
  const db = supabase();
  const canal = db.channel(`avisos-${uid}-${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes", filter: `usuario_id=eq.${uid}` },
      (p) => aoChegar(p.new as Notificacao))
    .subscribe();
  return () => { db.removeChannel(canal); };
}

export function tempoAtras(s: string, agora = Date.now()) {
  const m = Math.round((agora - new Date(s).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : d < 7 ? `há ${d} dias` : new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

// ---------------------------------------------------------------- demonstração
function demo() {
  const h = new Date(), hoje = iso(h);
  const em = (min: number) => new Date(Date.now() - min * 60000).toISOString();
  const as = (dias: number, hh: number, mm = 0) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(hh, mm, 0, 0); return d.toISOString(); };
  return {
    notificacoes: [
      { id: "n1", tipo: "atribuicao", titulo: "Carlos colocou você no chamado #14", corpo: "Wi-Fi caindo na suíte · Eduardo Attie · amanhã às 14:00", link: "/tecnico/chamados/", lida_em: null, created_at: em(12) },
      { id: "n2", tipo: "comentario", titulo: "Rafael comentou em “Instalação Control4 – The Mark”", corpo: "Rack chegou, falta só o switch PoE.", link: "/tecnico/agendamentos/", lida_em: null, created_at: em(95) },
      { id: "n3", tipo: "atividade", titulo: "Fernando passou uma atividade para você", corpo: "Retornar proposta Plaenge PP010 · hoje às 16:00", link: "/crm/?aba=agenda", lida_em: em(30), created_at: em(60 * 26) },
    ] as Notificacao[],
    alertas: montarAlertas({
      parcelas: [
        { id: "d1", tipo: "r", descricao: "Contrato", cliente: "Antonio Carlos", valor: 19333.33, vencimento: addDias(hoje, -4), parcela: "6/6" },
        { id: "d2", tipo: "r", descricao: "Contrato", cliente: "Sidnei Gonçalves", valor: 11688.63, vencimento: hoje, parcela: "9/12" },
        { id: "d3", tipo: "r", descricao: "Contrato", cliente: "H2 Incorporadora", valor: 23358.12, vencimento: addDias(hoje, 2), parcela: "7/10" },
      ],
      cartoes: [
        { id: "c1", titulo: "Instalação Control4", numero: 30, cliente_nome: "Rafael e Nayellem", prazo: null, agenda_inicio: as(0, 14, 30), modulo: "agendamentos", quadro_id: "q" },
        { id: "c2", titulo: "Ajuste de cenas na sala", numero: 12, cliente_nome: "Eduardo Attie", prazo: as(-1, 18), agenda_inicio: null, modulo: "chamados", quadro_id: "q" },
      ],
      atividades: [{ id: "a1", titulo: "Ligar para Plaenge", quando: as(0, 16), oportunidade_id: null }],
    }, h),
  };
}
