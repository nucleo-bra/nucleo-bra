"use client";
// Peças visuais compartilhadas do módulo Projetos
import { AlignLeft, CalendarClock, CheckSquare, Clock, MapPin, MessageSquare, Paperclip, ShieldCheck, User } from "lucide-react";
import { Cartao, CORES, Etiqueta, Membro, Modulo, PRIORIDADES } from "@/lib/projetos";

const TONS = ["#2f6fb5", "#12a150", "#f5821f", "#7c5cd6", "#d63a2f", "#0e8f9c", "#d6489b", "#19295a"];
export const iniciais = (nome: string) => nome.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
export const corPessoa = (id: string) => TONS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % TONS.length];

export function Avatar({ m, tam = 26 }: { m: Membro; tam?: number }) {
  return (
    <span title={m.nome} className="inline-grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-white"
      style={{ width: tam, height: tam, fontSize: tam * 0.4, background: corPessoa(m.id) }}>{iniciais(m.nome)}</span>
  );
}

export function situacaoPrazo(c: Pick<Cartao, "prazo" | "prazo_concluido">) {
  if (!c.prazo) return null;
  const p = new Date(c.prazo), agora = new Date();
  const fimHoje = new Date(agora); fimHoje.setHours(23, 59, 59, 999);
  const amanha = new Date(fimHoje); amanha.setDate(amanha.getDate() + 1);
  if (c.prazo_concluido) return { cls: "bg-ok text-white", rot: "Concluído" };
  if (p < agora) return { cls: "bg-erro text-white", rot: "Atrasado" };
  if (p <= fimHoje) return { cls: "bg-atencao text-white", rot: "Vence hoje" };
  if (p <= amanha) return { cls: "bg-atencao-claro text-atencao", rot: "Vence amanhã" };
  return { cls: "bg-fundo text-suave", rot: "" };
}
export function horarioAgenda(c: Pick<Cartao, "agenda_inicio" | "agenda_fim">) {
  if (!c.agenda_inicio) return null;
  const i = new Date(c.agenda_inicio), f = c.agenda_fim ? new Date(c.agenda_fim) : null;
  const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = i.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(/\./g, "");
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d0 = new Date(i); d0.setHours(0, 0, 0, 0);
  const dif = Math.round((d0.getTime() - hoje.getTime()) / 86_400_000);
  const quando = dif === 0 ? "Hoje" : dif === 1 ? "Amanhã" : dia.charAt(0).toUpperCase() + dia.slice(1);
  return { texto: `${quando} · ${hora(i)}${f ? "–" + hora(f) : ""}`, dif, passado: (f ?? i) < new Date() };
}
export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");

/** Face do cartão na lista (igual ao Trello: capa, etiquetas, título, selos e membros). */
export function FaceCartao({ c, etiquetas, equipe, etiquetasAbertas, onEtiquetas, modulo = "projetos" }: {
  c: Cartao; etiquetas: Etiqueta[]; equipe: Membro[]; etiquetasAbertas: boolean; onEtiquetas: () => void; modulo?: Modulo;
}) {
  const pr = PRIORIDADES.find(([k]) => k === c.prioridade);
  const ag = modulo === "agendamentos" ? horarioAgenda(c) : null;
  const E = c.etiquetas.map((id) => etiquetas.find((e) => e.id === id)).filter(Boolean) as Etiqueta[];
  const M = c.membros.map((id) => equipe.find((m) => m.id === id)).filter(Boolean) as Membro[];
  const feitos = c.checklist.filter((k) => k.feito).length, total = c.checklist.length;
  const sp = situacaoPrazo(c);
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-[0_1px_0_rgba(9,30,66,.18),0_1px_2px_rgba(9,30,66,.12)] transition group-hover:shadow-[0_4px_14px_-4px_rgba(9,30,66,.35)]">
      {c.capa && <div className="h-8" style={{ background: CORES[c.capa] ?? c.capa }} />}
      <div className="px-3 pt-2 pb-2">
        {E.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {E.map((e) => (
              <button key={e.id} onClick={(ev) => { ev.stopPropagation(); onEtiquetas(); }} title={e.nome}
                className={`rounded-[4px] text-[11px] leading-4 font-bold text-white transition-all ${etiquetasAbertas ? "min-w-10 px-2 py-0.5" : "h-2 w-10"}`}
                style={{ background: CORES[e.cor] ?? e.cor }}>{etiquetasAbertas ? e.nome || " " : ""}</button>
            ))}
          </div>
        )}
        {modulo !== "projetos" && (
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            {c.numero != null && <span className="font-bold text-suave">#{c.numero}</span>}
            {modulo === "chamados" && pr && <span className={`rounded-full px-2 py-px font-bold ${pr[2]}`}>{pr[1]}</span>}
            {modulo === "chamados" && c.garantia && <span className="inline-flex items-center gap-0.5 rounded-full bg-ok-claro px-2 py-px font-bold text-ok"><ShieldCheck className="size-3" />Garantia</span>}
            {ag && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-px font-bold ${ag.dif === 0 ? "bg-azul text-white" : ag.passado ? "bg-fundo text-suave" : "bg-[#e6eefa] text-azul"}`}><CalendarClock className="size-3" />{ag.texto}</span>}
            {modulo === "agendamentos" && !ag && <span className="rounded-full bg-atencao-claro px-2 py-px font-bold text-atencao">Sem data</span>}
          </div>
        )}
        <div className="text-[14px] leading-snug break-words text-tinta">{c.titulo}</div>
        {modulo !== "projetos" && c.cliente_nome && <div className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-suave"><User className="size-3 shrink-0" />{c.cliente_nome}</div>}
        {modulo === "agendamentos" && c.endereco && <div className="flex items-center gap-1 truncate text-[12px] text-suave"><MapPin className="size-3 shrink-0" />{c.endereco}</div>}
        {(sp || c.descricao || total > 0 || c.comentarios > 0 || c.anexos > 0 || M.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-suave">
            {sp && c.prazo && <span className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 font-semibold ${sp.cls}`}><Clock className="size-3" />{dataCurta(c.prazo)}</span>}
            {c.descricao && <AlignLeft className="size-3.5" aria-label="Tem descrição" />}
            {c.comentarios > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="size-3.5" />{c.comentarios}</span>}
            {c.anexos > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5" />{c.anexos}</span>}
            {total > 0 && <span className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 ${feitos === total ? "bg-ok font-semibold text-white" : ""}`}><CheckSquare className="size-3.5" />{feitos}/{total}</span>}
            {M.length > 0 && <span className="ml-auto flex -space-x-1.5">{M.slice(0, 4).map((m) => <Avatar key={m.id} m={m} tam={24} />)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
