"use client";
// Agenda semanal dos agendamentos (visitas, instalações, manutenções).
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Plus, User } from "lucide-react";
import { Cartao, CORES, Etiqueta, Membro } from "@/lib/projetos";
import { Avatar } from "./pecas";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const inicioSemana = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function AgendaSemana({ cartoes, etiquetas, equipe, abrir, onNovo }: {
  cartoes: Cartao[]; etiquetas: Etiqueta[]; equipe: Membro[]; abrir: (id: string) => void; onNovo: (inicio: Date) => Promise<void>;
}) {
  const [base, setBase] = useState(() => inicioSemana(new Date()));
  const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return d; });
  const hoje = new Date();
  const semData = cartoes.filter((c) => !c.agenda_inicio);
  const porDia = useMemo(() => dias.map((d) => cartoes.filter((c) => c.agenda_inicio && mesmoDia(new Date(c.agenda_inicio), d))
    .sort((a, b) => a.agenda_inicio!.localeCompare(b.agenda_inicio!))), [cartoes, base]); // eslint-disable-line react-hooks/exhaustive-deps
  const fimSemana = dias[6];
  const titulo = `${dias[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${fimSemana.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`.replace(/\./g, "");
  const mover = (k: number) => { const d = new Date(base); d.setDate(d.getDate() + 7 * k); setBase(d); };
  const total = porDia.reduce((s, l) => s + l.length, 0);

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 pt-3 pb-6 lg:flex-row lg:px-5">
      <div className="min-w-0 flex-1 rounded-2xl bg-white/95 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-linha px-4 py-3">
          <button onClick={() => mover(-1)} className="rounded-lg p-1.5 hover:bg-fundo" aria-label="Semana anterior"><ChevronLeft className="size-5" /></button>
          <button onClick={() => setBase(inicioSemana(new Date()))} className="rounded-lg border border-linha px-3 py-1 text-[13px] font-semibold hover:bg-fundo">Hoje</button>
          <button onClick={() => mover(1)} className="rounded-lg p-1.5 hover:bg-fundo" aria-label="Próxima semana"><ChevronRight className="size-5" /></button>
          <h3 className="font-display text-[16px] font-bold">{titulo}</h3>
          <span className="ml-auto text-[12.5px] text-suave">{total} agendamento(s) na semana</span>
        </div>
        <div className="grid grid-cols-1 divide-y divide-linha sm:grid-cols-7 sm:divide-x sm:divide-y-0">
          {dias.map((d, i) => {
            const eHoje = mesmoDia(d, hoje);
            return (
              <div key={i} className={`flex min-h-[120px] flex-col sm:min-h-[62vh] ${eHoje ? "bg-[#f3f8ff]" : ""}`}>
                <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1.5">
                  <span className={`text-[12px] font-bold uppercase ${eHoje ? "text-azul" : "text-suave"}`}>{DIAS[i]}</span>
                  <span className={`grid size-7 place-items-center rounded-full text-[13.5px] font-bold ${eHoje ? "bg-azul text-white" : ""}`}>{d.getDate()}</span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 px-1.5 pb-2">
                  {porDia[i].map((c) => {
                    const E = c.etiquetas.map((id) => etiquetas.find((e) => e.id === id)).filter(Boolean) as Etiqueta[];
                    const cor = E[0] ? CORES[E[0].cor] ?? E[0].cor : "#2f6fb5";
                    const M = c.membros.map((id) => equipe.find((m) => m.id === id)).filter(Boolean) as Membro[];
                    return (
                      <button key={c.id} onClick={() => abrir(c.id)} className="rounded-lg border border-linha bg-white p-2 text-left text-[12px] shadow-sm transition hover:-translate-y-px hover:shadow-md" style={{ borderLeft: `4px solid ${cor}` }}>
                        <div className="font-bold text-tinta">{hora(c.agenda_inicio!)}{c.agenda_fim ? `–${hora(c.agenda_fim)}` : ""}</div>
                        <div className="line-clamp-2 text-[12.5px] leading-snug text-tinta">{c.titulo}</div>
                        {c.cliente_nome && <div className="mt-0.5 flex items-center gap-1 truncate text-suave"><User className="size-3 shrink-0" />{c.cliente_nome}</div>}
                        {c.endereco && <div className="flex items-center gap-1 truncate text-suave"><MapPin className="size-3 shrink-0" />{c.endereco}</div>}
                        {M.length > 0 && <div className="mt-1 flex -space-x-1.5">{M.slice(0, 3).map((m) => <Avatar key={m.id} m={m} tam={20} />)}</div>}
                      </button>
                    );
                  })}
                  <button onClick={() => { const x = new Date(d); x.setHours(9, 0, 0, 0); onNovo(x); }}
                    className="mt-auto flex items-center justify-center gap-1 rounded-lg py-1.5 text-[12px] font-semibold text-suave opacity-60 hover:bg-fundo hover:text-azul hover:opacity-100">
                    <Plus className="size-3.5" />Agendar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <aside className="w-full shrink-0 rounded-2xl bg-white/95 p-3 shadow-xl lg:w-[260px]">
        <h4 className="mb-2 text-[13.5px] font-bold">A agendar <span className="font-normal text-suave">({semData.length})</span></h4>
        <ul className="space-y-1.5">
          {semData.map((c) => (
            <li key={c.id}><button onClick={() => abrir(c.id)} className="w-full rounded-lg border border-linha bg-white p-2 text-left text-[12.5px] hover:border-azul">
              <div className="font-semibold">{c.numero != null ? `#${c.numero} ` : ""}{c.titulo}</div>
              {c.cliente_nome && <div className="text-suave">{c.cliente_nome}</div>}
            </button></li>
          ))}
          {!semData.length && <li className="text-[12.5px] text-suave">Nada pendente de data.</li>}
        </ul>
      </aside>
    </div>
  );
}
