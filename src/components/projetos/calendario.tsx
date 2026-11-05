"use client";
// Calendário no estilo do app Calendário da Apple: Mês, Semana e Dia.
// Visitas e atendimentos com horário entram na grade de horas; prazos de
// chamados e projetos aparecem como "dia inteiro".
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, Plus, User } from "lucide-react";
import { Cartao, CORES, Etiqueta, listaFinal, Membro, Modulo, QuadroCompleto } from "@/lib/projetos";
import { Avatar } from "./pecas";

type Visao = "dia" | "semana" | "mes";
type Evento = { c: Cartao; ini: Date; fim: Date; diaInteiro: boolean; cor: string; feito: boolean };

const SEM = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const HORA_PX = 52, H_INI = 6, H_FIM = 23;
const VERMELHO = "#e5483d";
const dia0 = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const somaDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const inicioSemana = (d: Date) => somaDias(dia0(d), -((d.getDay() + 6) % 7));
const mesmo = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function eventos(d: QuadroCompleto, cartoes: Cartao[]): Evento[] {
  const fim = listaFinal(d.listas);
  const cor = (c: Cartao) => { const e = c.etiquetas.map((id) => d.etiquetas.find((x) => x.id === id)).find(Boolean) as Etiqueta | undefined; return e ? CORES[e.cor] ?? e.cor : c.prioridade === "urgente" ? "#d63a2f" : "#2f6fb5"; };
  const out: Evento[] = [];
  for (const c of cartoes) {
    const feito = c.lista_id === fim;
    if (c.agenda_inicio) {
      const ini = new Date(c.agenda_inicio), f = c.agenda_fim ? new Date(c.agenda_fim) : new Date(ini.getTime() + 3600_000);
      out.push({ c, ini, fim: f > ini ? f : new Date(ini.getTime() + 3600_000), diaInteiro: false, cor: cor(c), feito });
    } else if (c.prazo) {
      const p = new Date(c.prazo);
      out.push({ c, ini: dia0(p), fim: dia0(p), diaInteiro: true, cor: cor(c), feito });
    }
  }
  return out.sort((a, b) => a.ini.getTime() - b.ini.getTime());
}

/** distribui eventos que se sobrepõem em colunas lado a lado (como o Calendário) */
function colunas(L: Evento[]) {
  const pos = new Map<Evento, { col: number; de: number }>();
  let grupo: Evento[] = [], fimGrupo = 0;
  const fechar = () => { const n = Math.max(1, ...grupo.map((e) => pos.get(e)!.col + 1)); grupo.forEach((e) => (pos.get(e)!.de = n)); grupo = []; };
  for (const e of L) {
    if (grupo.length && e.ini.getTime() >= fimGrupo) fechar();
    const ocupadas = new Set(grupo.filter((g) => g.fim > e.ini).map((g) => pos.get(g)!.col));
    let col = 0; while (ocupadas.has(col)) col++;
    pos.set(e, { col, de: 1 }); grupo.push(e); fimGrupo = Math.max(fimGrupo, e.fim.getTime());
  }
  if (grupo.length) fechar();
  return pos;
}

function BlocoEvento({ e, pos, abrir }: { e: Evento; pos: { col: number; de: number }; abrir: (id: string) => void }) {
  const ini = Math.max(H_INI * 60, e.ini.getHours() * 60 + e.ini.getMinutes());
  const fim = Math.min(H_FIM * 60, Math.max(ini + 25, mesmo(e.ini, e.fim) ? e.fim.getHours() * 60 + e.fim.getMinutes() : H_FIM * 60));
  const top = ((ini - H_INI * 60) / 60) * HORA_PX, alt = Math.max(22, ((fim - ini) / 60) * HORA_PX - 2);
  const larg = 100 / pos.de;
  return (
    <button type="button" onClick={() => abrir(e.c.id)} title={e.c.titulo}
      className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[11.5px] leading-tight transition hover:z-10 hover:shadow-lg ${e.feito ? "opacity-55" : ""}`}
      style={{ top, height: alt, left: `calc(${pos.col * larg}% + 2px)`, width: `calc(${larg}% - 4px)`, background: `${e.cor}1f`, borderLeft: `3px solid ${e.cor}`, color: "#1b2540" }}>
      <div className="truncate font-bold" style={{ color: e.cor }}>{hm(e.ini)}</div>
      <div className={`font-semibold ${alt > 40 ? "line-clamp-2" : "truncate"} ${e.feito ? "line-through" : ""}`}>{e.c.titulo}</div>
      {alt > 60 && e.c.cliente_nome && <div className="truncate text-[11px] text-suave">{e.c.cliente_nome}</div>}
    </button>
  );
}

function GradeHoras({ dias, evs, abrir, onNovo, hoje }: { dias: Date[]; evs: Evento[]; abrir: (id: string) => void; onNovo?: (d: Date) => void; hoje: Date }) {
  const ref = useRef<HTMLDivElement>(null);
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (ref.current) ref.current.scrollTop = Math.max(0, (Math.min(agora.getHours(), 17) - H_INI - 1) * HORA_PX); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const horas = Array.from({ length: H_FIM - H_INI }, (_, i) => H_INI + i);
  const diaInteiro = dias.map((d) => evs.filter((e) => e.diaInteiro && mesmo(e.ini, d)));
  const temDiaInteiro = diaInteiro.some((l) => l.length);
  const grid = { gridTemplateColumns: `52px repeat(${dias.length}, minmax(0, 1fr))` };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {dias.length > 1 && (
        <div className="grid border-b border-linha" style={grid}>
          <div />
          {dias.map((d) => {
            const h = mesmo(d, hoje);
            return (
              <div key={+d} className="flex items-baseline justify-center gap-1.5 py-2 text-[12.5px]">
                <span className={`font-semibold uppercase ${h ? "text-[#e5483d]" : "text-suave"}`}>{SEM[(d.getDay() + 6) % 7]}</span>
                <span className={`grid size-7 place-items-center rounded-full text-[15px] font-bold ${h ? "bg-[#e5483d] text-white" : "text-tinta"}`}>{d.getDate()}</span>
              </div>
            );
          })}
        </div>
      )}
      {temDiaInteiro && (
        <div className="grid border-b border-linha bg-[#fafbfd]" style={grid}>
          <div className="px-1.5 py-1.5 text-right text-[10.5px] leading-tight text-suave">dia inteiro</div>
          {diaInteiro.map((L, i) => (
            <div key={i} className="space-y-0.5 border-l border-linha px-0.5 py-1">
              {L.map((e) => <button key={e.c.id} type="button" onClick={() => abrir(e.c.id)} className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11.5px] font-semibold text-white ${e.feito ? "opacity-50 line-through" : ""}`} style={{ background: e.cor }}>Prazo · {e.c.titulo}</button>)}
            </div>
          ))}
        </div>
      )}
      <div ref={ref} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="grid" style={{ ...grid, height: (H_FIM - H_INI) * HORA_PX }}>
          <div className="relative">
            {horas.map((h) => <div key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] text-suave" style={{ top: (h - H_INI) * HORA_PX }}>{h === H_INI ? "" : `${String(h).padStart(2, "0")}:00`}</div>)}
          </div>
          {dias.map((d) => {
            const L = evs.filter((e) => !e.diaInteiro && mesmo(e.ini, d)), pos = colunas(L), h = mesmo(d, hoje);
            const minAgora = (agora.getHours() - H_INI) * 60 + agora.getMinutes();
            return (
              <div key={+d} className={`relative border-l border-linha ${h ? "bg-[#fff8f7]" : ""}`}
                onDoubleClick={(ev) => { if (!onNovo) return; const r = (ev.currentTarget as HTMLDivElement).getBoundingClientRect(); const min = Math.floor(((ev.clientY - r.top) / HORA_PX) * 2) * 30 + H_INI * 60; const x = new Date(d); x.setHours(Math.floor(min / 60), min % 60, 0, 0); onNovo(x); }}>
                {horas.map((hh) => <div key={hh} className="absolute inset-x-0 border-t border-linha/70" style={{ top: (hh - H_INI) * HORA_PX }} />)}
                {horas.map((hh) => <div key={`m${hh}`} className="absolute inset-x-0 border-t border-dashed border-linha/40" style={{ top: (hh - H_INI) * HORA_PX + HORA_PX / 2 }} />)}
                {L.map((e) => <BlocoEvento key={e.c.id} e={e} pos={pos.get(e)!} abrir={abrir} />)}
                {h && minAgora >= 0 && minAgora <= (H_FIM - H_INI) * 60 && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (minAgora / 60) * HORA_PX }}>
                    <div className="relative h-0.5" style={{ background: VERMELHO }}><span className="absolute -top-[4px] -left-1 size-2.5 rounded-full" style={{ background: VERMELHO }} /></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Calendario({ d, cartoes, equipe, modulo, abrir, onNovo }: {
  d: QuadroCompleto; cartoes: Cartao[]; equipe: Membro[]; modulo: Modulo; abrir: (id: string) => void; onNovo?: (inicio: Date) => void;
}) {
  const [visao, setVisaoBruta] = useState<Visao>(() => { try { return (localStorage.getItem("nucleo-cal-visao") as Visao) || "mes"; } catch { return "mes"; } });
  const setVisao = (v: Visao) => { setVisaoBruta(v); try { localStorage.setItem("nucleo-cal-visao", v); } catch { /* sem armazenamento */ } };
  const [ref, setRef] = useState(() => dia0(new Date()));
  const [ocultarFeitos, setOcultarFeitos] = useState(false);
  const hoje = dia0(new Date());
  const todos = useMemo(() => eventos(d, cartoes), [d, cartoes]);
  const evs = ocultarFeitos ? todos.filter((e) => !e.feito) : todos;
  const semData = cartoes.filter((c) => !c.agenda_inicio && !c.prazo && c.lista_id !== listaFinal(d.listas));

  const mover = (k: number) => setRef((r) => visao === "dia" ? somaDias(r, k) : visao === "semana" ? somaDias(r, 7 * k) : new Date(r.getFullYear(), r.getMonth() + k, 1));
  const semana = Array.from({ length: 7 }, (_, i) => somaDias(inicioSemana(ref), i));
  const titulo = visao === "mes" ? cap(ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))
    : visao === "semana" ? `${semana[0].getDate()}${semana[0].getMonth() !== semana[6].getMonth() ? " " + semana[0].toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") : ""} – ${semana[6].getDate()} ${semana[6].toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "")}`
    : cap(ref.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));

  // mês: 6 semanas a partir da segunda antes do dia 1
  const ini = inicioSemana(new Date(ref.getFullYear(), ref.getMonth(), 1));
  const celulas = Array.from({ length: 42 }, (_, i) => somaDias(ini, i));
  const doDia = (x: Date) => evs.filter((e) => mesmo(e.ini, x));
  const noPeriodo = visao === "mes" ? evs.filter((e) => e.ini.getMonth() === ref.getMonth() && e.ini.getFullYear() === ref.getFullYear()).length
    : visao === "semana" ? evs.filter((e) => e.ini >= semana[0] && e.ini < somaDias(semana[6], 1)).length : doDia(ref).length;
  const nome = modulo === "agendamentos" ? ["visita", "visitas"] : modulo === "chamados" ? ["chamado", "chamados"] : ["item", "itens"];

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 pt-3 pb-6 lg:flex-row lg:px-5">
      <div className="flex min-h-[70vh] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* barra no estilo Calendário */}
        <div className="flex flex-wrap items-center gap-2 border-b border-linha px-4 py-3">
          <h3 className="mr-auto font-display text-[20px] font-extrabold tracking-tight">{titulo}</h3>
          <span className="text-[12.5px] text-suave">{noPeriodo} {noPeriodo === 1 ? nome[0] : nome[1]}</span>
          <label className="flex items-center gap-1.5 text-[12.5px] text-suave"><input type="checkbox" checked={ocultarFeitos} onChange={(e) => setOcultarFeitos(e.target.checked)} className="size-3.5 accent-[#2f6fb5]" />Ocultar concluídos</label>
          <div className="inline-flex rounded-lg bg-fundo p-0.5 text-[13px] font-semibold" role="group" aria-label="Visualização do calendário">
            {([["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]] as const).map(([k, r]) => (
              <button key={k} type="button" onClick={() => setVisao(k)} className={`rounded-md px-3.5 py-1 ${visao === k ? "bg-white text-tinta shadow-sm" : "text-suave hover:text-tinta"}`}>{r}</button>
            ))}
          </div>
          <div className="inline-flex items-center">
            <button type="button" onClick={() => mover(-1)} className="rounded-lg p-1.5 hover:bg-fundo" aria-label="Anterior"><ChevronLeft className="size-5" /></button>
            <button type="button" onClick={() => setRef(dia0(new Date()))} className="rounded-lg border border-linha px-3 py-1 text-[13px] font-semibold hover:bg-fundo">Hoje</button>
            <button type="button" onClick={() => mover(1)} className="rounded-lg p-1.5 hover:bg-fundo" aria-label="Próximo"><ChevronRight className="size-5" /></button>
          </div>
        </div>

        {visao === "mes" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid grid-cols-7 border-b border-linha">
              {SEM.map((s) => <div key={s} className="py-1.5 text-right pr-2.5 text-[11.5px] font-semibold text-suave uppercase">{s}</div>)}
            </div>
            <div className="grid flex-1 grid-cols-7 grid-rows-6">
              {celulas.map((x) => {
                const L = doDia(x), fora = x.getMonth() !== ref.getMonth(), h = mesmo(x, hoje);
                return (
                  <div key={+x} onDoubleClick={() => { if (onNovo) { const n = new Date(x); n.setHours(9, 0, 0, 0); onNovo(n); } }}
                    className={`group relative min-h-[96px] border-r border-b border-linha p-1 [&:nth-child(7n)]:border-r-0 ${fora ? "bg-[#fafbfd]" : ""}`}>
                    <button type="button" onClick={() => { setRef(x); setVisao("dia"); }} className="mb-0.5 flex w-full justify-end">
                      <span className={`grid size-6 place-items-center rounded-full text-[12.5px] font-semibold ${h ? "bg-[#e5483d] text-white" : fora ? "text-[#b6bdcc]" : "text-tinta"}`}>{x.getDate()}</span>
                    </button>
                    <div className="space-y-0.5">
                      {L.slice(0, 3).map((e) => (
                        <button key={e.c.id} type="button" onClick={() => abrir(e.c.id)} title={e.c.titulo}
                          className={`flex w-full items-center gap-1 truncate rounded px-1 py-px text-left text-[11.5px] hover:bg-fundo ${e.feito ? "text-suave line-through" : "text-tinta"}`}
                          style={e.diaInteiro ? { background: `${e.cor}22` } : undefined}>
                          {!e.diaInteiro && <span className="size-1.5 shrink-0 rounded-full" style={{ background: e.cor }} />}
                          <span className="truncate">{!e.diaInteiro && <b className="font-semibold">{hm(e.ini)} </b>}{e.c.titulo}</span>
                        </button>
                      ))}
                      {L.length > 3 && <button type="button" onClick={() => { setRef(x); setVisao("dia"); }} className="px-1 text-[11px] font-semibold text-suave hover:text-azul">+ {L.length - 3} mais</button>}
                    </div>
                    {onNovo && <button type="button" onClick={() => { const n = new Date(x); n.setHours(9, 0, 0, 0); onNovo(n); }} aria-label="Agendar neste dia"
                      className="absolute bottom-1 left-1 hidden rounded p-0.5 text-suave hover:bg-fundo hover:text-azul group-hover:block"><Plus className="size-3.5" /></button>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : visao === "semana" ? (
          <GradeHoras dias={semana} evs={evs} abrir={abrir} onNovo={onNovo} hoje={hoje} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <GradeHoras dias={[ref]} evs={evs} abrir={abrir} onNovo={onNovo} hoje={hoje} />
            <aside className="w-full shrink-0 border-t border-linha p-3 lg:w-[300px] lg:border-t-0 lg:border-l">
              <h4 className="mb-2 text-[13.5px] font-bold">{doDia(ref).length ? `${doDia(ref).length} ${doDia(ref).length === 1 ? nome[0] : nome[1]} no dia` : "Nada neste dia"}</h4>
              <ul className="space-y-2">
                {doDia(ref).map((e) => {
                  const M = e.c.membros.map((id) => equipe.find((m) => m.id === id)).filter(Boolean) as Membro[];
                  return (
                    <li key={e.c.id}><button type="button" onClick={() => abrir(e.c.id)} className="w-full rounded-xl border border-linha p-2.5 text-left text-[12.5px] hover:border-azul" style={{ borderLeft: `4px solid ${e.cor}` }}>
                      <div className="flex items-center gap-1 font-bold" style={{ color: e.cor }}><Clock className="size-3" />{e.diaInteiro ? "Prazo do dia" : `${hm(e.ini)} – ${hm(e.fim)}`}</div>
                      <div className={`mt-0.5 text-[13.5px] font-semibold text-tinta ${e.feito ? "line-through" : ""}`}>{e.c.numero != null ? `#${e.c.numero} ` : ""}{e.c.titulo}</div>
                      {e.c.cliente_nome && <div className="mt-0.5 flex items-center gap-1 text-suave"><User className="size-3" />{e.c.cliente_nome}</div>}
                      {e.c.endereco && <div className="flex items-center gap-1 text-suave"><MapPin className="size-3 shrink-0" /><span className="truncate">{e.c.endereco}</span></div>}
                      {M.length > 0 && <div className="mt-1.5 flex -space-x-1.5">{M.slice(0, 4).map((m) => <Avatar key={m.id} m={m} tam={20} />)}</div>}
                    </button></li>
                  );
                })}
              </ul>
              {onNovo && <button type="button" onClick={() => { const n = new Date(ref); n.setHours(9, 0, 0, 0); onNovo(n); }} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-linha py-2 text-[13px] font-semibold text-suave hover:border-azul hover:text-azul"><Plus className="size-4" />{modulo === "agendamentos" ? "Agendar neste dia" : "Novo com prazo neste dia"}</button>}
            </aside>
          </div>
        )}
        <p className="border-t border-linha px-4 py-2 text-[11.5px] text-suave">Clique no número do dia para abrir o dia · {onNovo ? "duplo clique num horário para criar · " : ""}{modulo === "agendamentos" ? "visitas pelo horário agendado" : "itens com horário na grade e prazos em “dia inteiro”"}</p>
      </div>
      {semData.length > 0 && (
        <aside className="w-full shrink-0 rounded-2xl bg-white/95 p-3 shadow-xl lg:w-[250px]">
          <h4 className="mb-2 text-[13.5px] font-bold">{modulo === "agendamentos" ? "A agendar" : "Sem data"} <span className="font-normal text-suave">({semData.length})</span></h4>
          <ul className="max-h-[70vh] space-y-1.5 overflow-y-auto">
            {semData.map((c) => (
              <li key={c.id}><button type="button" onClick={() => abrir(c.id)} className="w-full rounded-lg border border-linha bg-white p-2 text-left text-[12.5px] hover:border-azul">
                <div className="font-semibold">{c.numero != null ? `#${c.numero} ` : ""}{c.titulo}</div>
                {c.cliente_nome && <div className="text-suave">{c.cliente_nome}</div>}
              </button></li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
