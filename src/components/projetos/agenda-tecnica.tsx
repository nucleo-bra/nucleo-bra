"use client";
// Agenda técnica (escala do dia): os profissionais em colunas e as visitas /
// obras do dia distribuídas entre eles. Arraste a visita para o técnico (ou use
// o botão) e veja os equipamentos que cada um precisa levar.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, Package, Plus, User, UserPlus, X } from "lucide-react";
import { Cartao, Equipamento, Membro } from "@/lib/projetos";
import { Avatar } from "./pecas";

const mesmoDia = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function somar(lista: Equipamento[][]) {
  const m = new Map<string, Equipamento>();
  for (const l of lista) for (const e of l) {
    const k = e.produto_id ?? e.nome;
    const x = m.get(k); if (x) x.qtd += e.qtd; else m.set(k, { ...e });
  }
  return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

export function AgendaTecnica({ cartoes, equipe, abrir, onAlterar, onNovo }: {
  cartoes: Cartao[]; equipe: Membro[]; abrir: (id: string) => void;
  onAlterar: (c: Cartao, campos: Partial<Cartao>) => void; onNovo: (inicio: Date) => void;
}) {
  const [dia, setDia] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [sobre, setSobre] = useState<string | null>(null);
  const [escolher, setEscolher] = useState<string | null>(null);
  const tecnicos = useMemo(() => {
    const t = equipe.filter((m) => m.papel === "tecnico");
    const extras = equipe.filter((m) => m.papel !== "tecnico" && cartoes.some((c) => c.membros.includes(m.id)));
    return [...t, ...extras];
  }, [equipe, cartoes]);
  const doDia = useMemo(() => cartoes.filter((c) => c.agenda_inicio && mesmoDia(new Date(c.agenda_inicio), dia)).sort((a, b) => a.agenda_inicio!.localeCompare(b.agenda_inicio!)), [cartoes, dia]);
  const semTecnico = doDia.filter((c) => !c.membros.some((m) => tecnicos.some((t) => t.id === m)));
  const mudarDia = (k: number) => { const d = new Date(dia); d.setDate(d.getDate() + k); setDia(d); };
  const titulo = dia.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const alocar = (c: Cartao, membro: string) => { if (!c.membros.includes(membro)) onAlterar(c, { membros: [...c.membros, membro] }); };
  const tirar = (c: Cartao, membro: string) => onAlterar(c, { membros: c.membros.filter((x) => x !== membro) });

  const Visita = ({ c, de }: { c: Cartao; de?: string }) => (
    <div draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); }}
      className="group relative rounded-xl border border-linha bg-white p-2.5 text-[12.5px] shadow-sm transition hover:shadow-md">
      <button onClick={() => abrir(c.id)} className="block w-full text-left">
        <div className="flex items-center gap-1.5 font-bold text-tinta"><Clock className="size-3.5 text-azul" />{hora(c.agenda_inicio!)}{c.agenda_fim ? `–${hora(c.agenda_fim)}` : ""}{c.numero != null && <span className="ml-auto text-[11px] font-semibold text-suave">#{c.numero}</span>}</div>
        <div className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-semibold text-tinta">{c.titulo}</div>
        {c.cliente_nome && <div className="mt-0.5 flex items-center gap-1 truncate text-suave"><User className="size-3 shrink-0" />{c.cliente_nome}</div>}
        {c.endereco && <div className="flex items-center gap-1 truncate text-suave"><MapPin className="size-3 shrink-0" />{c.endereco}</div>}
        {c.equipamentos.length > 0 && <div className="mt-1 flex items-center gap-1 text-azul"><Package className="size-3 shrink-0" />{c.equipamentos.reduce((s, e) => s + e.qtd, 0)} equipamento(s)</div>}
      </button>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {c.membros.map((id) => equipe.find((m) => m.id === id)).filter(Boolean).map((m) => (
          <span key={m!.id} className="inline-flex items-center gap-1 rounded-full bg-fundo py-0.5 pr-1 pl-0.5 text-[11px] font-semibold">
            <Avatar m={m!} tam={18} />{m!.nome.split(" ")[0]}
            {(!de || de === m!.id) && <button onClick={() => tirar(c, m!.id)} className="rounded-full p-0.5 text-suave hover:text-erro" aria-label={`Tirar ${m!.nome}`}><X className="size-3" /></button>}
          </span>
        ))}
        <button onClick={() => setEscolher(escolher === c.id ? null : c.id)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-azul px-1.5 py-0.5 text-[11px] font-semibold text-azul"><UserPlus className="size-3" />técnico</button>
      </div>
      {escolher === c.id && (
        <div className="absolute top-full left-0 z-20 mt-1 w-56 rounded-xl border border-linha bg-white p-1 shadow-xl">
          {tecnicos.length ? tecnicos.map((m) => (
            <button key={m.id} onClick={() => { alocar(c, m.id); setEscolher(null); }} disabled={c.membros.includes(m.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-fundo disabled:opacity-40"><Avatar m={m} tam={22} />{m.nome}</button>
          )) : <p className="px-2 py-2 text-[12px] text-suave">Nenhum técnico ativo. Libere os acessos em Equipe.</p>}
        </div>
      )}
    </div>
  );

  const Coluna = ({ id, titulo, sub, lista, m }: { id: string; titulo: string; sub: string; lista: Cartao[]; m?: Membro }) => {
    const equip = somar(lista.map((c) => c.equipamentos));
    return (
      <section onDragOver={(e) => { if (!m) return; e.preventDefault(); setSobre(id); }} onDragLeave={() => setSobre((v) => (v === id ? null : v))}
        onDrop={(e) => { e.preventDefault(); setSobre(null); const cid = e.dataTransfer.getData("text/plain"); const c = cartoes.find((k) => k.id === cid); if (c && m) alocar(c, m.id); }}
        className={`flex w-[270px] shrink-0 flex-col rounded-2xl border bg-white/95 shadow-lg ${sobre === id ? "border-azul ring-2 ring-azul/25" : "border-transparent"}`}>
        <header className="flex items-center gap-2 border-b border-linha px-3 py-2.5">
          {m ? <Avatar m={m} tam={30} /> : <span className="grid size-[30px] place-items-center rounded-full bg-atencao-claro text-atencao"><User className="size-4" /></span>}
          <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-bold">{titulo}</div><div className="text-[11.5px] text-suave">{sub}</div></div>
        </header>
        <div className="flex min-h-[140px] flex-1 flex-col gap-2 p-2">
          {lista.map((c) => <Visita key={c.id} c={c} de={m?.id} />)}
          {!lista.length && <p className="rounded-lg border border-dashed border-linha px-2 py-6 text-center text-[12px] text-suave">{m ? "Livre. Arraste uma visita para cá." : "Tudo alocado."}</p>}
        </div>
        {equip.length > 0 && (
          <div className="border-t border-linha px-3 py-2">
            <div className="mb-1 flex items-center gap-1 text-[11.5px] font-bold text-suave uppercase"><Package className="size-3.5" />Levar</div>
            <ul className="space-y-0.5 text-[12px]">{equip.map((e) => <li key={e.produto_id ?? e.nome} className="flex gap-2"><span className="num w-6 shrink-0 text-right font-bold">{e.qtd}</span><span className="min-w-0 truncate">{e.nome}</span></li>)}</ul>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-3 pt-3 pb-6 lg:px-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-xl">
        <button onClick={() => mudarDia(-1)} className="rounded-lg p-1.5 hover:bg-fundo" aria-label="Dia anterior"><ChevronLeft className="size-5" /></button>
        <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDia(d); }} className="rounded-lg border border-linha px-3 py-1 text-[13px] font-semibold hover:bg-fundo">Hoje</button>
        <button onClick={() => mudarDia(1)} className="rounded-lg p-1.5 hover:bg-fundo" aria-label="Próximo dia"><ChevronRight className="size-5" /></button>
        <input type="date" className="rounded-lg border border-linha px-2 py-1 text-[13px]" value={`${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`}
          onChange={(e) => { if (!e.target.value) return; const [a, m, d] = e.target.value.split("-").map(Number); setDia(new Date(a, m - 1, d)); }} aria-label="Escolher dia" />
        <h3 className="font-display text-[16px] font-bold capitalize">{titulo}</h3>
        <span className="text-[12.5px] text-suave">{doDia.length} visita(s) · {semTecnico.length} sem técnico</span>
        <button onClick={() => { const x = new Date(dia); x.setHours(9, 0, 0, 0); onNovo(x); }} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-azul to-marinho-900 px-3 py-1.5 text-[13px] font-semibold text-white"><Plus className="size-4" />Agendar neste dia</button>
      </div>
      <div className="flex flex-1 items-start gap-3 overflow-x-auto pb-2">
        <Coluna id="sem" titulo="Sem técnico" sub={`${semTecnico.length} a alocar`} lista={semTecnico} />
        {tecnicos.map((m) => {
          const L = doDia.filter((c) => c.membros.includes(m.id));
          return <Coluna key={m.id} id={m.id} titulo={m.nome} sub={L.length ? `${L.length} visita(s)` : "livre"} lista={L} m={m} />;
        })}
      </div>
    </div>
  );
}
