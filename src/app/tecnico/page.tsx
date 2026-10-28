"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarClock, CalendarPlus, CheckCircle2, ChevronRight, Clock, Headset, MapPin, MessageSquare,
  Navigation, Plus, ShieldCheck, SquareKanban, Timer, User, Wrench,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { Avatar, horarioAgenda, situacaoPrazo } from "@/components/projetos/pecas";
import { carregarPainelTecnico, FUNDOS, Membro, PainelTecnico, PRIORIDADES } from "@/lib/projetos";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";
import { pl } from "@/lib/texto";

type C = PainelTecnico["cartoes"][number];
const PESO: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
const mapa = (e: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e)}`;
const rota = (e: string) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e)}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const linkDe = (c: C) => c.modulo === "projetos" ? `/tecnico/projetos/?q=${c.quadro_id}&c=${c.id}` : `/tecnico/${c.modulo}/?c=${c.id}`;

function Cartao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`sombra-bra rounded-[18px] border border-linha bg-white ${className}`}>{children}</section>;
}
function Titulo({ children, href, extra }: { children: React.ReactNode; href?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="flex items-center gap-2.5 text-[15px] font-bold"><span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" aria-hidden />{children}</h2>
      {extra}
      {href && <Link href={href} className="flex items-center text-[12.5px] font-semibold text-azul hover:underline">Abrir <ChevronRight className="size-3.5" /></Link>}
    </div>
  );
}
function Kpi({ rotulo, valor, detalhe, cor, tom = "", href }: { rotulo: string; valor: string; detalhe?: React.ReactNode; cor: string; tom?: string; href?: string }) {
  const corpo = (
    <>
      <span className="absolute top-3.5 bottom-3.5 left-0 w-[5px] rounded-r-md" style={{ background: cor }} aria-hidden />
      <div className="text-[12.5px] font-semibold text-suave">{rotulo}</div>
      <div className={`num mt-0.5 font-display text-[22px] font-extrabold tracking-tight lg:text-[25px] ${tom}`}>{valor}</div>
      {detalhe && <div className="mt-0.5 text-[12px] text-suave">{detalhe}</div>}
    </>
  );
  const cls = "sombra-bra relative block overflow-hidden rounded-[18px] border border-linha bg-white px-5 py-4 pl-6 transition hover:-translate-y-0.5";
  return href ? <Link href={href} className={cls}>{corpo}</Link> : <div className={cls}>{corpo}</div>;
}

export default function PainelTecnicoPagina() {
  const [p, setP] = useState<PainelTecnico | null>(null);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  useEffect(() => {
    carregarPainelTecnico().then(setP).catch((e) => setErro(mensagemErro(e)));
    if (!modoDemo) supabase().auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: x } = await supabase().from("perfis").select("nome").eq("id", data.user.id).single();
      if (x?.nome) setNome(x.nome.split(" ")[0]);
    });
  }, []);

  const agora = new Date();
  const saudacao = agora.getHours() < 12 ? "Bom dia" : agora.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const dia0 = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const k = useMemo(() => {
    if (!p) return null;
    const ab = (m: string) => p.cartoes.filter((c) => c.modulo === m && !c.final);
    const chamados = ab("chamados");
    const visitas = p.cartoes.filter((c) => c.modulo === "agendamentos" && c.agenda_inicio && !c.final).sort((a, b) => a.agenda_inicio!.localeCompare(b.agenda_inicio!));
    const hojeV = visitas.filter((c) => mesmoDia(new Date(c.agenda_inicio!), agora));
    const amanha = new Date(agora); amanha.setDate(amanha.getDate() + 1);
    const amanhaV = visitas.filter((c) => mesmoDia(new Date(c.agenda_inicio!), amanha));
    const fimSemana = new Date(agora); fimSemana.setDate(fimSemana.getDate() + 7);
    const semana = visitas.filter((c) => new Date(c.agenda_inicio!) >= new Date(agora.toDateString()) && new Date(c.agenda_inicio!) < fimSemana);
    const proxima = visitas.find((c) => new Date(c.agenda_fim ?? c.agenda_inicio!) >= agora && mesmoDia(new Date(c.agenda_inicio!), agora)) ?? visitas.find((c) => new Date(c.agenda_inicio!) >= agora);
    const projetos = ab("projetos");
    const atrasados = p.cartoes.filter((c) => !c.final && c.prazo && !c.prazo_concluido && new Date(c.prazo) < agora);
    const mes = agora.toISOString().slice(0, 7);
    const resolvidos = p.cartoes.filter((c) => c.modulo === "chamados" && c.final && (c.concluido_em ?? "").startsWith(mes));
    const tempos = p.cartoes.filter((c) => c.modulo === "chamados" && c.final && c.concluido_em).map((c) => (new Date(c.concluido_em!).getTime() - new Date(c.created_at).getTime()) / 86_400_000);
    const prioritarios = [...chamados].sort((a, b) => (PESO[a.prioridade ?? "baixa"] ?? 4) - (PESO[b.prioridade ?? "baixa"] ?? 4) || a.created_at.localeCompare(b.created_at));
    const meus = p.eu ? p.cartoes.filter((c) => !c.final && c.membros.includes(p.eu!)).sort((a, b) => (a.agenda_inicio ?? a.prazo ?? "9").localeCompare(b.agenda_inicio ?? b.prazo ?? "9")) : [];
    const dias7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(agora); d.setDate(d.getDate() + i); return { d, n: visitas.filter((c) => mesmoDia(new Date(c.agenda_inicio!), d)).length }; });
    return {
      chamados, urgentes: chamados.filter((c) => c.prioridade === "urgente").length, emAtendimento: chamados.filter((c) => /atendimento/i.test(c.lista)).length,
      hojeV, amanhaV, semana, proxima, projetos, atrasados, resolvidos, tempoMedio: tempos.length ? tempos.reduce((s, x) => s + x, 0) / tempos.length : null,
      prioritarios, meus, dias7, aAgendar: p.cartoes.filter((c) => c.modulo === "agendamentos" && !c.agenda_inicio && !c.final).length,
    };
  }, [p]); // eslint-disable-line react-hooks/exhaustive-deps

  const quadrosProj = (p?.quadros ?? []).filter((q) => q.modulo === "projetos").map((q) => {
    const L = p!.cartoes.filter((c) => c.quadro_id === q.id);
    const feitos = L.filter((c) => c.final).length;
    const prox = L.filter((c) => !c.final && c.prazo && !c.prazo_concluido).sort((a, b) => a.prazo!.localeCompare(b.prazo!))[0];
    return { q, total: L.length, feitos, atrasados: L.filter((c) => !c.final && c.prazo && !c.prazo_concluido && new Date(c.prazo) < agora).length, prox };
  });
  const carga = (p?.equipe ?? []).map((m: Membro) => {
    const L = p!.cartoes.filter((c) => !c.final && c.membros.includes(m.id));
    return { m, chamados: L.filter((c) => c.modulo === "chamados").length, visitas: L.filter((c) => c.modulo === "agendamentos" && c.agenda_inicio && k?.semana.includes(c)).length, projetos: L.filter((c) => c.modulo === "projetos").length, total: L.length };
  }).filter((x) => x.total > 0 || x.m.papel === "tecnico").sort((a, b) => b.total - a.total);
  const maxCarga = Math.max(1, ...carga.map((x) => x.total));

  const LinhaVisita = ({ c }: { c: C }) => {
    const M = c.membros.map((id) => p!.equipe.find((m) => m.id === id)).filter(Boolean) as Membro[];
    return (
      <li className="flex items-start gap-3 py-2.5">
        <div className="w-[62px] shrink-0 text-center"><div className="num font-display text-[16px] font-extrabold">{hora(c.agenda_inicio!)}</div>{c.agenda_fim && <div className="text-[11px] text-suave">até {hora(c.agenda_fim)}</div>}</div>
        <span className="mt-1 h-10 w-[3px] shrink-0 rounded-full bg-gradient-to-b from-ciano to-azul" />
        <div className="min-w-0 flex-1">
          <Link href={linkDe(c)} className="block truncate text-[14px] font-semibold hover:text-azul">{c.titulo}</Link>
          <div className="flex flex-wrap items-center gap-x-3 text-[12px] text-suave">
            {c.cliente_nome && <span className="inline-flex items-center gap-1"><User className="size-3" />{c.cliente_nome}</span>}
            {c.endereco && <a href={mapa(c.endereco)} target="_blank" rel="noreferrer" className="inline-flex max-w-full min-w-0 items-center gap-1 truncate hover:text-azul"><MapPin className="size-3 shrink-0" />{c.endereco}</a>}
          </div>
        </div>
        {M.length > 0 && <span className="flex shrink-0 -space-x-1.5 pr-0.5">{M.slice(0, 3).map((m) => <Avatar key={m.id} m={m} tam={26} />)}</span>}
      </li>
    );
  };

  return (
    <Shell titulo="Técnico" cheio>
      <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-8">
        {erro && <p role="alert" className="mb-5 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[12.5px] font-semibold tracking-wide text-suave uppercase"><Wrench className="size-4" />Área técnica</div>
            <h1 className="font-display text-[24px] font-extrabold tracking-tight lg:text-[28px]">{saudacao}{nome ? `, ${nome}` : ""}</h1>
            <p className="text-[14px] font-medium text-suave first-letter:uppercase">{dia0}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/tecnico/chamados/" className="inline-flex items-center gap-2 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13.5px] font-semibold hover:shadow-md"><Plus className="size-4" />Novo chamado</Link>
            <Link href="/tecnico/agendamentos/" className="inline-flex items-center gap-2 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13.5px] font-semibold hover:shadow-md"><CalendarPlus className="size-4" />Agendar visita</Link>
            <Link href="/tecnico/projetos/" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[13.5px] font-semibold text-white hover:shadow-lg"><SquareKanban className="size-4" />Projetos</Link>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 xl:grid-cols-3">
          {/* herói: o dia do time */}
          <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul p-6 text-white shadow-[0_24px_50px_-24px_rgba(14,26,61,.8)] xl:col-span-2 lg:p-7">
            <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.3),transparent_70%)]" aria-hidden />
            <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white/70">Visitas hoje</div>
                <div className="num font-display text-[44px] leading-none font-extrabold tracking-tight">{k ? k.hojeV.length : "—"}</div>
                <div className="mt-2 text-[13px] text-white/75">{k ? `${k.amanhaV.length} amanhã · ${k.semana.length} nos próximos 7 dias` : ""}</div>
              </div>
              <div className="grid grid-cols-3 gap-x-8 gap-y-3 text-[13px]">
                <div><div className="text-white/65">Chamados abertos</div><div className="num font-display text-[20px] font-bold">{k?.chamados.length ?? "—"}</div></div>
                <div><div className="text-white/65">Urgentes</div><div className={`num font-display text-[20px] font-bold ${k?.urgentes ? "text-[#ff9b91]" : ""}`}>{k?.urgentes ?? "—"}</div></div>
                <div><div className="text-white/65">Atrasados</div><div className={`num font-display text-[20px] font-bold ${k?.atrasados.length ? "text-[#ffc46b]" : ""}`}>{k?.atrasados.length ?? "—"}</div></div>
              </div>
            </div>
            {/* próxima visita */}
            <div className="relative mt-6 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              {k?.proxima ? (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-br to-erro"><Navigation className="size-6" /></div>
                  <div className="min-w-[180px] flex-1">
                    <div className="text-[12px] font-semibold tracking-wide text-white/65 uppercase">Próxima visita · {horarioAgenda(k.proxima)?.texto}</div>
                    <div className="truncate font-display text-[18px] font-bold">{k.proxima.titulo}</div>
                    <div className="truncate text-[13px] text-white/75">{[k.proxima.cliente_nome, k.proxima.endereco].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex w-full gap-2 sm:w-auto">
                    {k.proxima.endereco && <a href={rota(k.proxima.endereco)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[13px] font-bold text-marinho-900"><Navigation className="size-4" />Rota</a>}
                    <Link href={linkDe(k.proxima)} className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-[13px] font-semibold hover:bg-white/25">Detalhes<ArrowRight className="size-4" /></Link>
                  </div>
                </div>
              ) : <div className="flex items-center gap-3 text-[14px] text-white/80"><CheckCircle2 className="size-5 text-[#5be39b]" />Nenhuma visita pela frente. Agende em Agendamentos.</div>}
            </div>
            {/* 7 dias */}
            <div className="relative mt-4 grid grid-cols-7 gap-1.5">
              {(k?.dias7 ?? []).map(({ d, n }, i) => (
                <div key={i} className={`rounded-xl px-1 py-2 text-center ${i === 0 ? "bg-white text-marinho-900" : "bg-white/10"}`}>
                  <div className={`text-[11px] font-semibold uppercase ${i === 0 ? "text-azul" : "text-white/60"}`}>{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</div>
                  <div className="num font-display text-[16px] font-extrabold">{d.getDate()}</div>
                  <div className={`mx-auto mt-1 flex h-1.5 w-8 gap-[2px] overflow-hidden rounded-full ${i === 0 ? "bg-fundo" : "bg-white/15"}`}>{Array.from({ length: Math.min(n, 6) }).map((_, j) => <i key={j} className="block h-full flex-1 bg-ciano" />)}</div>
                  <div className={`mt-1 text-[10.5px] ${i === 0 ? "text-suave" : "text-white/60"}`}>{n ? <><span className="sm:hidden">{n}</span><span className="hidden sm:inline">{n} visita{n > 1 ? "s" : ""}</span></> : "livre"}</div>
                </div>
              ))}
            </div>
          </section>

          {/* chamados prioritários */}
          <Cartao>
            <Titulo href="/tecnico/chamados/">Chamados prioritários</Titulo>
            <ul className="divide-y divide-linha px-5 pb-3">
              {(k?.prioritarios ?? []).slice(0, 7).map((c) => {
                const pr = PRIORIDADES.find(([x]) => x === c.prioridade);
                return (
                  <li key={c.id}><Link href={linkDe(c)} className="flex items-start gap-3 py-2.5 hover:text-azul">
                    <Headset className="mt-0.5 size-4 shrink-0 text-suave" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">#{c.numero} {c.titulo}</span>
                      <span className="block truncate text-[12px] text-suave">{c.cliente_nome || "sem cliente"} · {c.lista}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      {pr && <span className={`rounded-full px-2 py-px text-[11px] font-bold ${pr[2]}`}>{pr[1]}</span>}
                      {c.garantia && <ShieldCheck className="size-3.5 text-ok" />}
                    </span>
                  </Link></li>
                );
              })}
              {k && !k.prioritarios.length && <li className="py-4 text-[13px] text-suave">Nenhum chamado aberto. 🎉</li>}
              {!p && !erro && <li className="py-4 text-[13px] text-suave">Carregando…</li>}
            </ul>
          </Cartao>

          {/* indicadores */}
          <div className="grid grid-cols-2 gap-3 lg:gap-5 xl:col-span-3 xl:grid-cols-4">
            <Kpi rotulo="Chamados em atendimento" valor={k ? String(k.emAtendimento) : "—"} detalhe={k ? `${k.chamados.length} abertos no total` : ""} cor="linear-gradient(#f5821f,#d63a2f)" href="/tecnico/chamados/" />
            <Kpi rotulo="Resolvidos no mês" valor={k ? String(k.resolvidos.length) : "—"} tom="text-ok" detalhe={k?.tempoMedio != null ? `tempo médio ${k.tempoMedio < 1 ? "menos de 1 dia" : k.tempoMedio.toFixed(1).replace(".", ",") + " dias"}` : "tempo médio —"} cor="linear-gradient(#5be39b,#12a150)" href="/tecnico/chamados/" />
            <Kpi rotulo="Visitas na semana" valor={k ? String(k.semana.length) : "—"} detalhe={k ? `${k.aAgendar} aguardando data` : ""} cor="linear-gradient(#22c7d6,#2f6fb5)" href="/tecnico/agendamentos/" />
            <Kpi rotulo="Tarefas de projetos" valor={k ? String(k.projetos.length) : "—"} tom={k?.atrasados.length ? "" : ""} detalhe={k ? `${pl(quadrosProj.length, "obra", "obras")} · ${pl(k.atrasados.filter((c) => c.modulo === "projetos").length, "atrasada", "atrasadas")}` : ""} cor="linear-gradient(#7c5cd6,#19295a)" href="/tecnico/projetos/" />
          </div>

          {/* agenda */}
          <Cartao className="xl:col-span-2">
            <Titulo href="/tecnico/agendamentos/" extra={<span className="ml-auto mr-3 text-[12.5px] text-suave">Hoje e amanhã</span>}>Agenda do time</Titulo>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 px-5 pb-4 md:grid-cols-2">
              {[["Hoje", k?.hojeV ?? []], ["Amanhã", k?.amanhaV ?? []]].map(([r, L]) => (
                <div key={r as string}>
                  <div className="mb-1 text-[12px] font-bold tracking-wide text-suave uppercase">{r as string}</div>
                  <ul className="divide-y divide-linha">
                    {(L as C[]).map((c) => <LinhaVisita key={c.id} c={c} />)}
                    {!(L as C[]).length && <li className="py-3 text-[13px] text-suave">Sem visitas.</li>}
                  </ul>
                </div>
              ))}
            </div>
          </Cartao>

          {/* carga do time */}
          <Cartao>
            <Titulo>Carga do time</Titulo>
            <ul className="space-y-3 px-5 pb-5">
              {carga.map(({ m, chamados, visitas, projetos, total }) => (
                <li key={m.id}>
                  <div className="mb-1 flex items-center gap-2.5 text-[13px]"><Avatar m={m} tam={28} /><span className="min-w-0 flex-1 truncate font-semibold">{m.nome}</span><span className="num font-bold">{total}</span></div>
                  <div className="ml-[38px] flex h-2 overflow-hidden rounded-full bg-linha">
                    <i className="block h-full bg-br" style={{ width: `${(chamados / maxCarga) * 100}%` }} />
                    <i className="block h-full bg-ciano" style={{ width: `${(visitas / maxCarga) * 100}%` }} />
                    <i className="block h-full bg-[#7c5cd6]" style={{ width: `${(projetos / maxCarga) * 100}%` }} />
                  </div>
                  <div className="mt-0.5 ml-[38px] text-[11.5px] text-suave">{pl(chamados, "chamado", "chamados")} · {pl(visitas, "visita", "visitas")} na semana · {pl(projetos, "tarefa", "tarefas")}</div>
                </li>
              ))}
              {p && !carga.length && <li className="text-[13px] text-suave">Atribua técnicos aos cartões para ver a carga de cada um.</li>}
            </ul>
          </Cartao>

          {/* projetos */}
          <Cartao className="xl:col-span-2">
            <Titulo href="/tecnico/projetos/">Projetos e obras</Titulo>
            <ul className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
              {quadrosProj.map(({ q, total, feitos, atrasados, prox }) => (
                <li key={q.id}>
                  <Link href={`/tecnico/projetos/?q=${q.id}`} className="block overflow-hidden rounded-2xl border border-linha transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex h-14 items-end px-3 pb-2 font-display text-[15px] font-bold text-white" style={{ background: FUNDOS[q.fundo] ?? FUNDOS.marinho }}>{q.nome}</div>
                    <div className="space-y-1.5 px-3 py-2.5 text-[12.5px]">
                      <div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-linha"><div className="h-full rounded-full bg-gradient-to-r from-ciano to-ok" style={{ width: `${total ? (feitos / total) * 100 : 0}%` }} /></div><span className="num font-bold">{total ? Math.round((feitos / total) * 100) : 0}%</span></div>
                      <div className="flex flex-wrap gap-x-3 text-suave"><span>{feitos}/{total} concluídos</span>{atrasados > 0 && <span className="font-semibold text-erro">{pl(atrasados, "atrasado", "atrasados")}</span>}</div>
                      {prox && <div className="flex items-center gap-1 truncate text-suave"><Clock className="size-3 shrink-0" />{prox.titulo} · {new Date(prox.prazo!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</div>}
                    </div>
                  </Link>
                </li>
              ))}
              {p && !quadrosProj.length && <li className="text-[13px] text-suave">Nenhum quadro de projeto ainda.</li>}
            </ul>
          </Cartao>

          {/* atividade */}
          <Cartao>
            <Titulo>Atividade recente</Titulo>
            <ul className="space-y-3 px-5 pb-5">
              {(p?.comentarios ?? []).slice(0, 7).map((x) => {
                const m = p!.equipe.find((e) => e.id === x.autor);
                return (
                  <li key={x.id} className="flex gap-2.5">
                    {m ? <Avatar m={m} tam={28} /> : <MessageSquare className="size-7 text-suave" />}
                    <div className="min-w-0 text-[13px]">
                      <div><b>{m?.nome.split(" ")[0] ?? "Alguém"}</b> <span className="text-suave">em {x.cartao}</span></div>
                      <div className="line-clamp-2 text-suave">{x.texto}</div>
                    </div>
                  </li>
                );
              })}
              {p && !p.comentarios.length && <li className="text-[13px] text-suave">Os comentários do time aparecem aqui.</li>}
            </ul>
          </Cartao>

          {/* minhas tarefas */}
          <Cartao className="xl:col-span-3">
            <Titulo extra={<span className="ml-auto text-[12.5px] text-suave">{k?.meus.length ?? 0} em aberto</span>}>Minhas tarefas</Titulo>
            <ul className="grid gap-2 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
              {(k?.meus ?? []).slice(0, 12).map((c) => {
                const sp = situacaoPrazo(c), ag = horarioAgenda(c);
                const I = c.modulo === "chamados" ? Headset : c.modulo === "agendamentos" ? CalendarClock : SquareKanban;
                return (
                  <li key={c.id}><Link href={linkDe(c)} className="flex items-start gap-3 rounded-xl border border-linha px-3 py-2.5 hover:border-azul">
                    <I className="mt-0.5 size-4 shrink-0 text-azul" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold">{c.numero != null && c.modulo !== "projetos" ? `#${c.numero} ` : ""}{c.titulo}</span>
                      <span className="block truncate text-[12px] text-suave">{c.lista}{c.cliente_nome ? ` · ${c.cliente_nome}` : ""}</span></span>
                    {ag ? <span className="shrink-0 rounded-full bg-[#e6eefa] px-2 py-0.5 text-[11px] font-bold text-azul">{ag.texto}</span>
                      : sp?.rot ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${sp.cls}`}>{sp.rot}</span>
                      : c.prazo ? <span className="shrink-0 text-[11.5px] text-suave"><Timer className="mr-0.5 inline size-3" />{new Date(c.prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span> : null}
                  </Link></li>
                );
              })}
              {k && !k.meus.length && <li className="text-[13px] text-suave">Nada atribuído a você agora.</li>}
            </ul>
          </Cartao>
        </div>
      </div>
    </Shell>
  );
}
