"use client";
// Visão "Painel" e "Lista" dos quadros técnicos (Projetos, Chamados, Agendamentos):
// indicadores, gráficos e tabela ordenável — o quadro continua a um clique.
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, ArrowDown, ArrowUp, CalendarClock, Check, CheckCircle2, ChevronRight, Clock, Columns3, Hourglass, Inbox, ListChecks, MapPin,
  Plus, RotateCcw, ShieldCheck, SquarePen, Timer, TrendingUp, User, Users, Wrench,
} from "lucide-react";
import { Cartao, CORES, Etiqueta, Lista, listaFinal, Membro, Modulo, PRIORIDADES, QuadroCompleto } from "@/lib/projetos";
import { Avatar, horarioAgenda, situacaoPrazo, dataCurta } from "./pecas";

// paleta categórica validada (azul, laranja, roxo, magenta) + "outros"
export const CAT = ["#2f6fb5", "#f5821f", "#7c5cd6", "#c43d8c"], OUTROS = "#a3adc2";
const TINTA = "#0e1a3d", SUAVE = "#66738f", LINHA = "#e2e8f3";
const DIA = 86_400_000;
const inicioDia = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const inicioSemana = (d: Date) => { const x = inicioDia(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const dm = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const fmt1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const horas = (c: Cartao) => (c.agenda_inicio && c.agenda_fim ? Math.max(0, (new Date(c.agenda_fim).getTime() - new Date(c.agenda_inicio).getTime()) / 3_600_000) : 0);
const PESO: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

export type Visao = "painel" | "quadro" | "agenda" | "lista";

// ---------------------------------------------------------------- peças
export function Caixa({ titulo, icone: I, extra, children, className = "" }: { titulo: string; icone?: typeof Clock; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`sombra-bra min-w-0 rounded-[18px] border border-linha bg-white ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <h3 className="flex items-center gap-2.5 text-[15px] font-bold"><span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" aria-hidden />{I && <I className="size-4 text-suave" />}{titulo}</h3>
        {extra}
      </div>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

export function Kpi({ rotulo, valor, detalhe, cor, icone: I, destaque, tom = "" }: { rotulo: string; valor: string; detalhe?: React.ReactNode; cor: string; icone: typeof Clock; destaque?: boolean; tom?: string }) {
  if (destaque) return (
    <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul px-5 py-4 text-white shadow-[0_20px_40px_-22px_rgba(14,26,61,.9)]">
      <div className="pointer-events-none absolute -top-14 -right-10 size-40 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.35),transparent_70%)]" aria-hidden />
      <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
      <div className="relative flex min-h-[34px] items-start gap-2 text-[12.5px] leading-tight font-semibold text-[#b9c6ee]"><I className="mt-px size-4 shrink-0 text-ciano" />{rotulo}</div>
      <div className="num relative mt-0.5 font-display text-[30px] font-extrabold leading-tight tracking-tight">{valor}</div>
      {detalhe && <div className="relative text-[12px] text-white/70">{detalhe}</div>}
    </div>
  );
  return (
    <div className="sombra-bra relative overflow-hidden rounded-[18px] border border-linha bg-white px-5 py-4 pl-6">
      <span className="absolute top-3.5 bottom-3.5 left-0 w-[5px] rounded-r-md" style={{ background: cor }} aria-hidden />
      <div className="flex min-h-[34px] items-start gap-1.5 text-[12.5px] leading-tight font-semibold text-suave"><I className="mt-px size-3.5 shrink-0" />{rotulo}</div>
      <div className={`num mt-0.5 font-display text-[24px] font-extrabold tracking-tight ${tom}`}>{valor}</div>
      {detalhe && <div className="text-[12px] text-suave">{detalhe}</div>}
    </div>
  );
}

/** Barras horizontais em HTML: rótulo, valor e barra fina (identidade nunca só pela cor). */
export function Barras({ itens, vazio = "Nada por aqui ainda.", total }: { itens: { rotulo: React.ReactNode; valor: number; cor?: string; sufixo?: string; onClick?: () => void }[]; vazio?: string; total?: number }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (!itens.length || itens.every((i) => !i.valor)) return <p className="py-6 text-center text-[13px] text-suave">{vazio}</p>;
  return (
    <ul className="space-y-2.5">
      {itens.map((i, k) => (
        <li key={k} title={`${typeof i.rotulo === "string" ? i.rotulo : ""} ${i.valor}${i.sufixo ?? ""}`}>
          <button onClick={i.onClick} disabled={!i.onClick} className="block w-full text-left disabled:cursor-default">
            <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate font-semibold text-tinta">{i.rotulo}</span>
              <span className="num shrink-0 text-suave"><b className="text-tinta">{fmt1(i.valor)}</b>{i.sufixo ?? ""}{total ? ` · ${Math.round((i.valor / total) * 100)}%` : ""}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-fundo">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(i.valor / max) * 100}%`, background: i.cor ?? CAT[0] }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Anel({ pct, rotulo }: { pct: number; rotulo: string }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-[132px] shrink-0 place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke={LINHA} strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="url(#gAnel)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
        <defs><linearGradient id="gAnel" x1="0" x2="1"><stop offset="0" stopColor="#22c7d6" /><stop offset="1" stopColor="#2f6fb5" /></linearGradient></defs>
      </svg>
      <div className="text-center"><div className="num font-display text-[28px] font-extrabold leading-none">{Math.round(pct)}%</div><div className="mt-1 text-[11.5px] text-suave">{rotulo}</div></div>
    </div>
  );
}

export function Dica({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-linha bg-white px-3 py-2 text-[12.5px] shadow-lg">
      <div className="mb-1 font-bold text-tinta">{label}</div>
      {payload.map((p) => <div key={p.name} className="flex items-center gap-2 text-suave"><span className="size-2.5 rounded-sm" style={{ background: p.color }} />{p.name}: <b className="num text-tinta">{p.value}</b></div>)}
    </div>
  );
}
export function Legenda({ itens }: { itens: [string, string][] }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-suave">{itens.map(([n, c]) => <span key={n} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: c }} />{n}</span>)}</div>;
}

// ---------------------------------------------------------------- estatísticas
function calcular(d: QuadroCompleto, cartoes: Cartao[], equipe: Membro[], modulo: Modulo) {
  const agora = new Date(), hoje = inicioDia(agora);
  const listas = [...d.listas].sort((a, b) => a.posicao - b.posicao);
  const fim = listaFinal(d.listas);
  const feitos = cartoes.filter((c) => c.lista_id === fim), abertos = cartoes.filter((c) => c.lista_id !== fim);
  const lista = (c: Cartao) => listas.find((l) => l.id === c.lista_id)?.nome ?? "";
  const mes = agora.toISOString().slice(0, 7);
  const mesAnt = new Date(agora.getFullYear(), agora.getMonth() - 1, 15).toISOString().slice(0, 7);
  const concl = (c: Cartao) => c.concluido_em ?? null;
  const feitosMes = feitos.filter((c) => (concl(c) ?? "").startsWith(mes)).length;
  const feitosMesAnt = feitos.filter((c) => (concl(c) ?? "").startsWith(mesAnt)).length;
  const tempos = feitos.filter((c) => concl(c) && new Date(concl(c)!).getTime() > agora.getTime() - 90 * DIA)
    .map((c) => (new Date(concl(c)!).getTime() - new Date(c.created_at).getTime()) / DIA);
  const tempoMedio = tempos.length ? tempos.reduce((s, x) => s + x, 0) / tempos.length : null;
  const atrasados = abertos.filter((c) => c.prazo && !c.prazo_concluido && new Date(c.prazo) < agora);
  const em7 = new Date(hoje.getTime() + 8 * DIA);
  const vencem7 = abertos.filter((c) => c.prazo && !c.prazo_concluido && new Date(c.prazo) >= agora && new Date(c.prazo) < em7);

  // fluxo semanal (8 semanas): entradas x concluídos
  const s0 = inicioSemana(agora);
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const ini = new Date(s0.getTime() - (7 - i) * 7 * DIA), f = new Date(ini.getTime() + 7 * DIA);
    const dentro = (s: string | null) => !!s && new Date(s) >= ini && new Date(s) < f;
    return { semana: i === 7 ? "Esta" : dm(ini), Entradas: cartoes.filter((c) => dentro(c.created_at)).length, Concluídos: feitos.filter((c) => dentro(concl(c))).length };
  });

  // etapas (listas) e etiquetas
  const etapas = listas.map((l) => ({ l, n: cartoes.filter((c) => c.lista_id === l.id).length, final: l.id === fim }));
  const etiquetas = d.etiquetas.map((e: Etiqueta) => ({ e, n: abertos.filter((c) => c.etiquetas.includes(e.id)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const semEtiqueta = abertos.filter((c) => !c.etiquetas.length).length;

  // pessoas
  const semana = { ini: inicioSemana(agora), fim: new Date(inicioSemana(agora).getTime() + 7 * DIA) };
  const carga = equipe.map((m) => {
    const L = abertos.filter((c) => c.membros.includes(m.id));
    const visitasSemana = cartoes.filter((c) => c.membros.includes(m.id) && c.agenda_inicio && new Date(c.agenda_inicio) >= semana.ini && new Date(c.agenda_inicio) < semana.fim);
    return { m, abertos: L.length, atrasados: L.filter((c) => atrasados.includes(c)).length, horas: visitasSemana.reduce((s, c) => s + horas(c), 0), visitas: visitasSemana.length };
  }).filter((x) => x.abertos || x.horas).sort((a, b) => (modulo === "agendamentos" ? b.horas - a.horas : b.abertos - a.abertos));
  const semDono = abertos.filter((c) => !c.membros.length).length;

  // clientes (chamados)
  const porCliente = new Map<string, number>();
  for (const c of cartoes) if (c.cliente_nome) porCliente.set(c.cliente_nome, (porCliente.get(c.cliente_nome) ?? 0) + 1);
  const clientes = [...porCliente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // agenda: próximos 14 dias
  const dias14 = Array.from({ length: 14 }, (_, i) => {
    const dd = new Date(hoje.getTime() + i * DIA), f = new Date(dd.getTime() + DIA);
    const L = cartoes.filter((c) => c.agenda_inicio && new Date(c.agenda_inicio) >= dd && new Date(c.agenda_inicio) < f);
    return { dia: i === 0 ? "Hoje" : dd.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "") + " " + dd.getDate(), Visitas: L.length, hoje: i === 0, fds: dd.getDay() === 0 || dd.getDay() === 6 };
  });
  const daSemana = cartoes.filter((c) => c.agenda_inicio && new Date(c.agenda_inicio) >= semana.ini && new Date(c.agenda_inicio) < semana.fim);
  const deHoje = cartoes.filter((c) => c.agenda_inicio && inicioDia(new Date(c.agenda_inicio)).getTime() === hoje.getTime());

  const checkTotal = abertos.reduce((s, c) => s + c.checklist.length, 0), checkFeito = abertos.reduce((s, c) => s + c.checklist.filter((k) => k.feito).length, 0);
  return {
    agora, listas, fim, lista, abertos, feitos, feitosMes, feitosMesAnt, tempoMedio, atrasados, vencem7, semanas, etapas, etiquetas, semEtiqueta,
    carga, semDono, clientes, dias14, daSemana, deHoje, checkTotal, checkFeito,
    pct: cartoes.length ? (feitos.length / cartoes.length) * 100 : 0,
  };
}

// ---------------------------------------------------------------- painel
type Acoes = { onMover?: (c: Cartao, lista: string) => void; onAlterar?: (c: Cartao, campos: Partial<Cartao>) => void; onNovo?: () => void };

export function PainelQuadro({ d, cartoes, equipe, modulo, abrir, verLista, verQuadro, onNovo, onMover, onAlterar }: {
  d: QuadroCompleto; cartoes: Cartao[]; equipe: Membro[]; modulo: Modulo; abrir: (id: string) => void; verLista: () => void; verQuadro?: () => void;
} & Acoes) {
  const k = useMemo(() => calcular(d, cartoes, equipe, modulo), [d, cartoes, equipe, modulo]);
  const comp = k.feitosMesAnt ? Math.round(((k.feitosMes - k.feitosMesAnt) / k.feitosMesAnt) * 100) : null;
  const variacao = comp == null ? "" : comp >= 0 ? ` · ▲ ${comp}% vs mês anterior` : ` · ▼ ${Math.abs(comp)}% vs mês anterior`;
  const corEt = (e: Etiqueta) => CORES[e.cor] ?? e.cor;

  const kpis = modulo === "chamados" ? (() => {
    const urg = k.abertos.filter((c) => c.prioridade === "urgente").length;
    return [
      <Kpi key="a" destaque icone={Inbox} rotulo="Chamados abertos" valor={String(k.abertos.length)} detalhe={urg ? `${urg} urgente(s) · ${k.semDono} sem responsável` : `${k.semDono} sem responsável`} cor="" />,
      <Kpi key="b" icone={Wrench} rotulo="Em atendimento" valor={String(k.abertos.filter((c) => /atendimento/i.test(k.lista(c))).length)} cor="#2f6fb5" detalhe="sendo resolvidos agora" />,
      <Kpi key="c" icone={Hourglass} rotulo="Aguardando cliente / peça" valor={String(k.abertos.filter((c) => /aguard/i.test(k.lista(c))).length)} cor="#e8890c" detalhe="dependem de terceiros" />,
      <Kpi key="d" icone={CheckCircle2} rotulo="Resolvidos no mês" valor={String(k.feitosMes)} cor="#12a150" detalhe={`${k.feitosMesAnt} no mês anterior${variacao ? "" : ""}`} />,
      <Kpi key="e" icone={Timer} rotulo="Tempo médio de solução" valor={k.tempoMedio == null ? "—" : `${fmt1(k.tempoMedio)} d`} cor="#22c7d6" detalhe="últimos 90 dias" />,
      <Kpi key="f" icone={ShieldCheck} rotulo="Em garantia" valor={String(k.abertos.filter((c) => c.garantia).length)} cor="#7c5cd6" detalhe="abertos cobertos" />,
    ];
  })() : modulo === "agendamentos" ? [
    <Kpi key="a" destaque icone={CalendarClock} rotulo="Visitas hoje" valor={String(k.deHoje.length)} detalhe={`${k.daSemana.length} na semana · ${fmt1(k.daSemana.reduce((s, c) => s + horas(c), 0))} h agendadas`} cor="" />,
    <Kpi key="b" icone={Inbox} rotulo="A agendar" valor={String(k.abertos.filter((c) => !c.agenda_inicio).length)} cor="#e8890c" detalhe="sem data definida" tom={k.abertos.some((c) => !c.agenda_inicio) ? "text-atencao" : ""} />,
    <Kpi key="c" icone={Wrench} rotulo="Em execução" valor={String(k.abertos.filter((c) => /execu/i.test(k.lista(c))).length)} cor="#2f6fb5" detalhe="em campo agora" />,
    <Kpi key="d" icone={CheckCircle2} rotulo="Concluídas no mês" valor={String(k.feitosMes)} cor="#12a150" detalhe={`${k.feitosMesAnt} no mês anterior`} />,
    <Kpi key="e" icone={Users} rotulo="Técnicos na semana" valor={String(new Set(k.daSemana.flatMap((c) => c.membros)).size)} cor="#22c7d6" detalhe="com visitas marcadas" />,
    <Kpi key="f" icone={AlertTriangle} rotulo="Sem técnico" valor={String(k.abertos.filter((c) => c.agenda_inicio && !c.membros.length).length)} cor="#d63a2f" detalhe="agendadas sem responsável" tom={k.abertos.some((c) => c.agenda_inicio && !c.membros.length) ? "text-erro" : ""} />,
  ] : [
    <Kpi key="a" destaque icone={TrendingUp} rotulo="Andamento do quadro" valor={`${Math.round(k.pct)}%`} detalhe={`${k.feitos.length} de ${cartoes.length} cartões concluídos`} cor="" />,
    <Kpi key="b" icone={ListChecks} rotulo="Em aberto" valor={String(k.abertos.length)} cor="#2f6fb5" detalhe={`${k.semDono} sem responsável`} />,
    <Kpi key="c" icone={AlertTriangle} rotulo="Atrasados" valor={String(k.atrasados.length)} cor="#d63a2f" tom={k.atrasados.length ? "text-erro" : ""} detalhe="prazo já passou" />,
    <Kpi key="d" icone={Clock} rotulo="Vencem em 7 dias" valor={String(k.vencem7.length)} cor="#e8890c" detalhe="atenção à semana" />,
    <Kpi key="e" icone={CheckCircle2} rotulo="Concluídos no mês" valor={String(k.feitosMes)} cor="#12a150" detalhe={`${k.feitosMesAnt} no mês anterior`} />,
    <Kpi key="f" icone={ListChecks} rotulo="Checklists" valor={k.checkTotal ? `${Math.round((k.checkFeito / k.checkTotal) * 100)}%` : "—"} cor="#22c7d6" detalhe={k.checkTotal ? `${k.checkFeito} de ${k.checkTotal} itens feitos` : "nenhum item ainda"} />,
  ];

  const graficoFluxo = (
    <Caixa titulo={modulo === "chamados" ? "Abertos x resolvidos por semana" : "Entradas x concluídos por semana"} icone={TrendingUp} className="xl:col-span-2"
      extra={<Legenda itens={[[modulo === "chamados" ? "Abertos" : "Entradas", CAT[0]], [modulo === "chamados" ? "Resolvidos" : "Concluídos", CAT[1]]]} />}>
      <div className="h-[240px]">
        <ResponsiveContainer>
          <BarChart data={k.semanas.map((s) => ({ semana: s.semana, [modulo === "chamados" ? "Abertos" : "Entradas"]: s.Entradas, [modulo === "chamados" ? "Resolvidos" : "Concluídos"]: s.Concluídos }))} barGap={2} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={LINHA} />
            <XAxis dataKey="semana" tick={{ fill: SUAVE, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: SUAVE, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<Dica />} cursor={{ fill: "rgba(47,111,181,.06)" }} />
            <Bar dataKey={modulo === "chamados" ? "Abertos" : "Entradas"} fill={CAT[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey={modulo === "chamados" ? "Resolvidos" : "Concluídos"} fill={CAT[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Caixa>
  );

  const graficoDias = (
    <Caixa titulo="Visitas nos próximos 14 dias" icone={CalendarClock} className="xl:col-span-2" extra={<span className="text-[12px] text-suave">{k.dias14.reduce((s, x) => s + x.Visitas, 0)} visitas</span>}>
      <div className="h-[240px]">
        <ResponsiveContainer>
          <BarChart data={k.dias14} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={LINHA} />
            <XAxis dataKey="dia" tick={{ fill: SUAVE, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={6} />
            <YAxis allowDecimals={false} tick={{ fill: SUAVE, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<Dica />} cursor={{ fill: "rgba(47,111,181,.06)" }} />
            <Bar dataKey="Visitas" radius={[4, 4, 0, 0]} maxBarSize={26}>
              {k.dias14.map((x, i) => <Cell key={i} fill={x.hoje ? "#19295a" : x.fds ? "#9db8dc" : CAT[0]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legenda itens={[["Hoje", "#19295a"], ["Dias úteis", CAT[0]], ["Fim de semana", "#9db8dc"]]} />
    </Caixa>
  );

  const etapasCaixa = (
    <Caixa titulo="Por etapa" icone={ListChecks}>
      {modulo === "projetos" && <div className="mb-4 flex items-center gap-4"><Anel pct={k.pct} rotulo="concluído" />
        <p className="text-[13px] text-suave"><b className="text-tinta">{k.feitos.length}</b> concluídos, <b className="text-tinta">{k.abertos.length}</b> em aberto{k.atrasados.length ? <>, <b className="text-erro">{k.atrasados.length} atrasados</b></> : ""}.</p></div>}
      <Barras total={cartoes.length} itens={k.etapas.map((e) => ({ rotulo: e.l.nome, valor: e.n, cor: e.final ? "#12a150" : CAT[0] }))} />
    </Caixa>
  );

  const tiposCaixa = (
    <Caixa titulo={modulo === "chamados" ? "Abertos por tipo" : modulo === "agendamentos" ? "Por tipo de visita" : "Por etiqueta"} icone={Inbox}>
      <Barras total={k.abertos.length} vazio="Nenhum cartão aberto com etiqueta."
        itens={[...k.etiquetas.map((x) => ({ rotulo: <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: corEt(x.e) }} />{x.e.nome || "Sem nome"}</span>, valor: x.n, cor: corEt(x.e) })),
          ...(k.semEtiqueta ? [{ rotulo: "Sem etiqueta", valor: k.semEtiqueta, cor: OUTROS }] : [])]} />
    </Caixa>
  );

  const prioridadeCaixa = (
    <Caixa titulo="Abertos por prioridade" icone={AlertTriangle}>
      <Barras total={k.abertos.length} vazio="Nenhum chamado aberto."
        itens={[...PRIORIDADES.map(([p, r]) => ({ rotulo: r, valor: k.abertos.filter((c) => c.prioridade === p).length, cor: { urgente: "#d63a2f", alta: "#f5821f", media: "#e8b10c", baixa: "#a3adc2" }[p] })),
          { rotulo: "Sem prioridade", valor: k.abertos.filter((c) => !c.prioridade).length, cor: "#d5dbe6" }].filter((x) => x.valor)} />
    </Caixa>
  );

  const cargaCaixa = (
    <Caixa titulo={modulo === "agendamentos" ? "Ocupação do time na semana" : "Carga por pessoa"} icone={Users}
      extra={k.semDono ? <span className="rounded-full bg-atencao-claro px-2 py-0.5 text-[11.5px] font-bold text-atencao">{k.semDono} sem responsável</span> : undefined}>
      <Barras vazio="Ninguém atribuído ainda." itens={k.carga.map((x) => ({
        rotulo: <span className="inline-flex items-center gap-2"><Avatar m={x.m} tam={22} />{x.m.nome.split(" ").slice(0, 2).join(" ")}{x.atrasados ? <span className="rounded-full bg-erro-claro px-1.5 text-[11px] font-bold text-erro">{x.atrasados} atras.</span> : null}</span>,
        valor: modulo === "agendamentos" ? x.horas : x.abertos, sufixo: modulo === "agendamentos" ? ` h · ${x.visitas} visita(s)` : " aberto(s)", cor: CAT[0],
      }))} />
    </Caixa>
  );

  const clientesCaixa = (
    <Caixa titulo="Clientes com mais chamados" icone={User}>
      {k.clientes.length ? (
        <ul className="divide-y divide-linha">{k.clientes.map(([n, q], i) => (
          <li key={n} className="flex items-center gap-3 py-2 text-[13.5px]">
            <span className="grid size-6 place-items-center rounded-full bg-fundo text-[11.5px] font-bold text-suave">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{n}</span>
            <span className="num font-bold">{q}</span><span className="text-[12px] text-suave">chamado(s)</span>
          </li>))}</ul>
      ) : <p className="py-6 text-center text-[13px] text-suave">Os clientes aparecem aqui quando os chamados tiverem cliente.</p>}
    </Caixa>
  );

  const aAgendar = k.abertos.filter((c) => !c.agenda_inicio);
  const aAgendarCaixa = (
    <Caixa titulo="A agendar" icone={Inbox} extra={<span className="text-[12px] text-suave">{aAgendar.length}</span>}>
      {aAgendar.length ? <ul className="space-y-1.5">{aAgendar.slice(0, 6).map((c) => (
        <li key={c.id}><button onClick={() => abrir(c.id)} className="flex w-full items-center gap-2 rounded-xl border border-linha px-3 py-2 text-left text-[13px] hover:border-azul">
          <span className="min-w-0 flex-1"><b className="block truncate">{c.numero != null ? `#${c.numero} ` : ""}{c.titulo}</b>{c.cliente_nome && <span className="block truncate text-[12px] text-suave">{c.cliente_nome}</span>}</span>
          <span className="text-[12px] text-suave">há {Math.max(0, Math.round((k.agora.getTime() - new Date(c.created_at).getTime()) / DIA))} d</span><ChevronRight className="size-4 text-suave" />
        </button></li>))}</ul> : <p className="py-6 text-center text-[13px] text-suave">Tudo com data marcada.</p>}
    </Caixa>
  );

  const prazos = [...k.abertos].filter((c) => c.prazo && !c.prazo_concluido).sort((a, b) => a.prazo!.localeCompare(b.prazo!)).slice(0, 6);
  const prazosCaixa = (
    <Caixa titulo="Próximos prazos" icone={Clock}>
      {prazos.length ? <ul className="divide-y divide-linha">{prazos.map((c) => {
        const sp = situacaoPrazo(c);
        return (
          <li key={c.id}><button onClick={() => abrir(c.id)} className="flex w-full items-center gap-3 py-2 text-left text-[13.5px] hover:text-azul">
            <span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${sp?.cls ?? "bg-fundo text-suave"}`}>{dataCurta(c.prazo!)}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{c.titulo}</span><span className="text-[12px] text-suave">{k.lista(c)}</span>
          </button></li>);
      })}</ul> : <p className="py-6 text-center text-[13px] text-suave">Nenhum prazo em aberto.</p>}
    </Caixa>
  );

  const nomeNovo = modulo === "chamados" ? "Novo chamado" : modulo === "agendamentos" ? "Nova visita" : "Novo cartão";
  return (
    <div className="space-y-4 lg:space-y-5">
      {/* atalhos de ação */}
      <div className="flex flex-wrap items-center gap-2">
        {onNovo && <button onClick={onNovo} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md transition hover:-translate-y-px hover:shadow-lg"><Plus className="size-4" />{nomeNovo}</button>}
        {verQuadro && <button onClick={verQuadro} className="inline-flex items-center gap-2 rounded-xl border border-linha bg-white px-4 py-2.5 text-[14px] font-semibold transition hover:-translate-y-px hover:shadow-md"><Columns3 className="size-4" />Abrir quadro (arrastar cartões)</button>}
        <button onClick={verLista} className="inline-flex items-center gap-2 rounded-xl border border-linha bg-white px-4 py-2.5 text-[14px] font-semibold transition hover:-translate-y-px hover:shadow-md"><ListChecks className="size-4" />Lista para editar</button>
        <span className="ml-auto hidden text-[12.5px] text-suave md:block">Clique em qualquer linha para abrir e editar · mude a etapa direto na tabela</span>
      </div>
      {!cartoes.length && onNovo && (
        <div className="sombra-bra relative overflow-hidden rounded-[18px] border border-dashed border-azul/40 bg-white px-6 py-8 text-center">
          <div className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-[#e8f0fa] text-azul"><Plus className="size-6" /></div>
          <h3 className="font-display text-[18px] font-extrabold">{modulo === "chamados" ? "Nenhum chamado ainda" : modulo === "agendamentos" ? "Nenhuma visita agendada" : "Este quadro está vazio"}</h3>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] text-suave">{modulo === "chamados" ? "Abra o primeiro chamado com cliente, prioridade e responsável. Ele aparece aqui, no quadro e no painel do Técnico." : modulo === "agendamentos" ? "Agende a primeira visita com data, horário, endereço e técnicos." : "Crie o primeiro cartão com prazo, etiquetas e responsáveis."}</p>
          <button onClick={onNovo} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-br px-5 py-2.5 text-[14px] font-bold text-white shadow-md hover:bg-br-escuro"><Plus className="size-4" />{nomeNovo}</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{kpis}</div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 xl:grid-cols-3">
        {modulo === "agendamentos" ? graficoDias : graficoFluxo}
        {modulo === "chamados" ? prioridadeCaixa : modulo === "agendamentos" ? tiposCaixa : etapasCaixa}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 md:grid-cols-2 xl:grid-cols-3">
        {modulo === "projetos" ? tiposCaixa : etapasCaixa}
        {cargaCaixa}
        {modulo === "chamados" ? clientesCaixa : modulo === "agendamentos" ? aAgendarCaixa : prazosCaixa}
      </div>
      <Caixa titulo={modulo === "chamados" ? "Chamados em aberto" : modulo === "agendamentos" ? "Próximas visitas" : "Cartões em aberto"} icone={ListChecks}
        extra={<button onClick={verLista} className="flex items-center text-[12.5px] font-semibold text-azul hover:underline">Ver lista completa <ChevronRight className="size-3.5" /></button>}>
        <TabelaCartoes d={d} cartoes={cartoes} equipe={equipe} modulo={modulo} abrir={abrir} limite={8} compacta onMover={onMover} onAlterar={onAlterar} onNovo={onNovo} />
      </Caixa>
    </div>
  );
}

// ---------------------------------------------------------------- tabela
type Col = { k: string; r: string; cls?: string; v: (c: Cartao) => string | number; cel: (c: Cartao) => React.ReactNode };

export function TabelaCartoes({ d, cartoes, equipe, modulo, abrir, limite, compacta, onMover, onAlterar, onNovo }: {
  d: QuadroCompleto; cartoes: Cartao[]; equipe: Membro[]; modulo: Modulo; abrir: (id: string) => void; limite?: number; compacta?: boolean;
} & Acoes) {
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();
  const listasOrd = [...d.listas].sort((a, b) => a.posicao - b.posicao);
  const fim = listaFinal(d.listas);
  const [aba, setAba] = useState<"abertos" | "concluidos" | "todos">("abertos");
  const padrao = modulo === "chamados" ? "prioridade" : modulo === "agendamentos" ? "quando" : "prazo";
  const [ord, setOrd] = useState<{ k: string; asc: boolean }>({ k: padrao, asc: true });
  const listaDe = (c: Cartao) => d.listas.find((l: Lista) => l.id === c.lista_id);
  const pessoas = (c: Cartao) => c.membros.map((id) => equipe.find((m) => m.id === id)).filter(Boolean) as Membro[];
  const etq = (c: Cartao) => c.etiquetas.map((id) => d.etiquetas.find((e) => e.id === id)).filter(Boolean) as Etiqueta[];
  const agora = Date.now();
  const idade = (c: Cartao) => Math.max(0, Math.floor((agora - new Date(c.created_at).getTime()) / DIA));

  const etapa: Col = { k: "etapa", r: "Etapa", v: (c) => listaDe(c)?.posicao ?? 0, cel: (c) => onMover ? (
    <select value={c.lista_id} onClick={parar} onKeyDown={parar} onChange={(e) => onMover(c, e.target.value)} aria-label="Mudar etapa"
      className={`max-w-[190px] cursor-pointer rounded-full border-0 py-1 pr-7 pl-2.5 text-[12px] font-semibold outline-none ring-1 ring-transparent hover:ring-azul focus:ring-azul ${c.lista_id === fim ? "bg-ok-claro text-ok" : "bg-fundo text-tinta"}`}>
      {listasOrd.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
    </select>
  ) : <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap ${c.lista_id === fim ? "bg-ok-claro text-ok" : "bg-fundo text-tinta"}`}>{listaDe(c)?.nome}</span> };
  const resp: Col = { k: "resp", r: modulo === "agendamentos" ? "Técnicos" : "Responsáveis", v: (c) => pessoas(c)[0]?.nome ?? "~", cel: (c) => {
    const P = pessoas(c);
    return P.length ? <span className="flex items-center gap-2"><span className="flex -space-x-1.5">{P.slice(0, 3).map((m) => <Avatar key={m.id} m={m} tam={24} />)}</span>{P.length === 1 && <span className="truncate text-[12.5px]">{P[0].nome.split(" ")[0]}</span>}</span>
      : <span className="text-[12px] font-semibold text-atencao">Sem responsável</span>;
  } };
  const prazo: Col = { k: "prazo", r: "Prazo", v: (c) => (c.prazo && !c.prazo_concluido ? c.prazo : "9999"), cel: (c) => {
    if (!c.prazo) return <span className="text-suave">—</span>;
    const sp = situacaoPrazo(c);
    return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ${sp?.cls ?? ""}`}><Clock className="size-3" />{dataCurta(c.prazo)}{sp?.rot && !["Concluído"].includes(sp.rot) ? ` · ${sp.rot}` : ""}</span>;
  } };
  const tipos: Col = { k: "tipo", r: modulo === "projetos" ? "Etiquetas" : "Tipo", v: (c) => etq(c)[0]?.nome ?? "~", cel: (c) => (
    <span className="flex flex-wrap gap-1">{etq(c).slice(0, 2).map((e) => <span key={e.id} className="rounded-[4px] px-1.5 py-px text-[11px] font-bold whitespace-nowrap text-white" style={{ background: CORES[e.cor] ?? e.cor }}>{e.nome || " "}</span>)}{!etq(c).length && <span className="text-suave">—</span>}</span>
  ) };
  const cliente: Col = { k: "cliente", r: "Cliente", v: (c) => c.cliente_nome || "~", cel: (c) => c.cliente_nome ? <span className="block max-w-[200px] truncate">{c.cliente_nome}</span> : <span className="text-suave">—</span> };
  const titulo = (r: string): Col => ({ k: "titulo", r, v: (c) => c.titulo.toLowerCase(), cel: (c) => (
    <span className="block max-w-[320px]">
      <span className="block truncate font-semibold text-tinta">{c.titulo}</span>
      {modulo === "chamados" && c.garantia && <span className="inline-flex items-center gap-0.5 text-[11.5px] font-bold text-ok"><ShieldCheck className="size-3" />Garantia</span>}
    </span>
  ) });

  const cols: Col[] = modulo === "chamados" ? [
    { k: "numero", r: "Nº", v: (c) => c.numero ?? 0, cel: (c) => <span className="num font-bold text-suave">#{c.numero}</span> },
    titulo("Chamado"), cliente,
    { k: "prioridade", r: "Prioridade", v: (c) => PESO[c.prioridade ?? ""] ?? 4, cel: (c) => { const p = PRIORIDADES.find(([x]) => x === c.prioridade);
      return onAlterar ? (
        <select value={c.prioridade ?? ""} onClick={parar} onKeyDown={parar} onChange={(e) => onAlterar(c, { prioridade: (e.target.value || null) as Cartao["prioridade"] })} aria-label="Mudar prioridade"
          className={`cursor-pointer rounded-full border-0 py-1 pr-7 pl-2.5 text-[11.5px] font-bold outline-none ring-1 ring-transparent hover:ring-azul focus:ring-azul ${p ? p[2] : "bg-fundo text-suave"}`}>
          <option value="">—</option>{PRIORIDADES.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      ) : p ? <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap ${p[2]}`}>{p[1]}</span> : <span className="text-suave">—</span>; } },
    etapa, resp,
    { k: "idade", r: "Aberto há", v: (c) => -new Date(c.created_at).getTime(), cel: (c) => { const n = idade(c); return <span className={`num whitespace-nowrap ${n > 7 && c.lista_id !== fim ? "font-bold text-erro" : "text-suave"}`}>{n === 0 ? "hoje" : `${n} d`}</span>; } },
  ] : modulo === "agendamentos" ? [
    { k: "quando", r: "Quando", v: (c) => c.agenda_inicio ?? "9999", cel: (c) => { const h = horarioAgenda(c); return h ? <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-bold whitespace-nowrap ${h.dif === 0 ? "bg-azul text-white" : h.passado ? "bg-fundo text-suave" : "bg-[#e6eefa] text-azul"}`}><CalendarClock className="size-3" />{h.texto}</span> : <span className="rounded-md bg-atencao-claro px-2 py-0.5 text-[12px] font-bold text-atencao">Sem data</span>; } },
    titulo("Visita"), cliente,
    { k: "endereco", r: "Endereço", v: (c) => c.endereco || "~", cel: (c) => c.endereco ? <a onClick={(e) => e.stopPropagation()} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.endereco)}`} target="_blank" rel="noreferrer" className="inline-flex max-w-[220px] items-center gap-1 truncate text-azul hover:underline"><MapPin className="size-3 shrink-0" />{c.endereco}</a> : <span className="text-suave">—</span> },
    resp, tipos, etapa,
  ] : [titulo("Cartão"), etapa, tipos, resp, prazo,
    { k: "check", r: "Checklist", v: (c) => (c.checklist.length ? c.checklist.filter((x) => x.feito).length / c.checklist.length : -1), cel: (c) => {
      const t = c.checklist.length, f = c.checklist.filter((x) => x.feito).length;
      return t ? <span className="flex items-center gap-2"><span className="h-1.5 w-16 overflow-hidden rounded-full bg-fundo"><span className="block h-full rounded-full bg-ok" style={{ width: `${(f / t) * 100}%` }} /></span><span className="num text-[12px] text-suave">{f}/{t}</span></span> : <span className="text-suave">—</span>;
    } }];

  const inicio = listasOrd[0]?.id;
  if (onMover) cols.push({ k: "acoes", r: "Ações", v: () => 0, cel: (c) => (
    <span className="flex items-center gap-1" onClick={parar}>
      {c.lista_id !== fim
        ? <button onClick={() => fim && onMover(c, fim)} title={modulo === "chamados" ? "Marcar como resolvido" : "Concluir"} className="inline-flex items-center gap-1 rounded-lg border border-linha px-2 py-1 text-[12px] font-semibold whitespace-nowrap text-ok hover:border-ok hover:bg-ok-claro"><Check className="size-3.5" />{modulo === "chamados" ? "Resolver" : "Concluir"}</button>
        : <button onClick={() => inicio && onMover(c, inicio)} title="Reabrir" className="inline-flex items-center gap-1 rounded-lg border border-linha px-2 py-1 text-[12px] font-semibold whitespace-nowrap text-suave hover:border-azul hover:text-azul"><RotateCcw className="size-3.5" />Reabrir</button>}
      <button onClick={() => abrir(c.id)} title="Abrir e editar" aria-label="Abrir e editar" className="rounded-lg border border-linha p-1.5 text-suave hover:border-azul hover:text-azul"><SquarePen className="size-3.5" /></button>
    </span>
  ) });

  const base = cartoes.filter((c) => (aba === "todos" ? true : aba === "concluidos" ? c.lista_id === fim : c.lista_id !== fim));
  const col = cols.find((c) => c.k === ord.k) ?? cols[0];
  const linhas = [...base].sort((a, b) => {
    const x = col.v(a), y = col.v(b);
    const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
    return (ord.asc ? r : -r) || (a.numero ?? 0) - (b.numero ?? 0);
  });
  const mostradas = limite ? linhas.slice(0, limite) : linhas;
  const contagem = { abertos: cartoes.filter((c) => c.lista_id !== fim).length, concluidos: cartoes.filter((c) => c.lista_id === fim).length, todos: cartoes.length };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {onNovo && !compacta && <button onClick={onNovo} className="mr-2 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-3.5 py-1.5 text-[13px] font-semibold text-white shadow-sm"><Plus className="size-4" />{modulo === "chamados" ? "Novo chamado" : modulo === "agendamentos" ? "Nova visita" : "Novo cartão"}</button>}
        {([["abertos", "Em aberto"], ["concluidos", modulo === "chamados" ? "Resolvidos" : "Concluídos"], ["todos", "Todos"]] as const).map(([k2, r]) => (
          <button key={k2} onClick={() => setAba(k2)} className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition ${aba === k2 ? "bg-marinho-900 text-white" : "bg-fundo text-suave hover:text-tinta"}`}>{r} · {contagem[k2]}</button>
        ))}
      </div>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-[13.5px]">
          <thead>
            <tr className="border-y border-linha bg-[#f7f9fc] text-[12px] font-semibold text-suave">
              {cols.map((c, i) => (
                <th key={c.k} className={`py-2.5 font-semibold whitespace-nowrap ${i === 0 ? "pl-5" : ""} pr-4`} aria-sort={ord.k === c.k ? (ord.asc ? "ascending" : "descending") : "none"}>
                  <button disabled={c.k === "acoes"} onClick={() => setOrd({ k: c.k, asc: ord.k === c.k ? !ord.asc : true })} className="inline-flex items-center gap-1 hover:text-tinta disabled:cursor-default">
                    {c.r}{ord.k === c.k && (ord.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-linha">
            {mostradas.map((c) => (
              <tr key={c.id} onClick={() => abrir(c.id)} onKeyDown={(e) => e.key === "Enter" && abrir(c.id)} tabIndex={0}
                className="cursor-pointer transition hover:bg-[#f4f8ff] focus:bg-[#f4f8ff] focus:outline-none">
                {cols.map((k2, i) => <td key={k2.k} className={`${compacta ? "py-2" : "py-2.5"} ${i === 0 ? "pl-5" : ""} pr-4 align-middle`}>{k2.cel(c)}</td>)}
              </tr>
            ))}
            {!mostradas.length && <tr><td colSpan={cols.length} className="py-10 text-center text-suave">Nenhum cartão {aba === "abertos" ? "em aberto" : aba === "concluidos" ? "concluído" : ""} por aqui.
              {onNovo && <button onClick={onNovo} className="ml-2 inline-flex items-center gap-1 font-semibold text-azul hover:underline"><Plus className="size-3.5" />Criar agora</button>}</td></tr>}
          </tbody>
        </table>
      </div>
      {limite && linhas.length > limite && <p className="pt-3 text-center text-[12.5px] text-suave">Mostrando {limite} de {linhas.length}</p>}
    </div>
  );
}
