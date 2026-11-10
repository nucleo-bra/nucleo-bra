"use client";
// Página da obra: visão geral, cronograma, documentação, materiais e tarefas.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange, ClipboardList, FileText, LayoutDashboard, MapPin, MessageCircle, Package, SquareKanban } from "lucide-react";
import { QuadroView } from "@/components/projetos/quadro";
import { abrirObra, ObraCompleta, ouvirObra, salvarObra, STATUS_OBRA, StatusObra } from "@/lib/obras";
import { carregarEquipe, Membro } from "@/lib/projetos";
import { mensagemErro } from "@/lib/supabase";
import { usePapel } from "@/lib/usar-papel";
import { VisaoGeral } from "./visao";
import { Cronograma } from "./cronograma";
import { Documentacao } from "./documentacao";
import { Materiais } from "./materiais";

type Aba = "geral" | "cronograma" | "documentacao" | "materiais" | "tarefas";
const ABAS: [Aba, string, typeof FileText][] = [
  ["geral", "Visão geral", LayoutDashboard], ["cronograma", "Cronograma", CalendarRange], ["documentacao", "Documentação", FileText],
  ["materiais", "Materiais", Package], ["tarefas", "Tarefas", SquareKanban],
];

export function DetalheObra({ id, abaInicial, docInicial }: { id: string; abaInicial?: string | null; docInicial?: string | null }) {
  const [d, setD] = useState<ObraCompleta | null>(null);
  const [erro, setErro] = useState("");
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [aba, setAbaBruta] = useState<Aba>(() => (ABAS.some((a) => a[0] === abaInicial) ? abaInicial as Aba : docInicial ? "documentacao" : "geral"));
  const papel = usePapel();
  const setAba = (a: Aba) => {
    setAbaBruta(a);
    const u = new URL(location.href); u.searchParams.set("aba", a); u.searchParams.delete("doc"); history.replaceState(null, "", u.toString());
  };
  const recarregar = useCallback(async () => { try { setD(await abrirObra(id)); } catch (e) { setErro(mensagemErro(e)); } }, [id]);
  useEffect(() => { recarregar(); carregarEquipe().then(setEquipe).catch(() => {}); }, [recarregar]);
  useEffect(() => ouvirObra(id, recarregar), [id, recarregar]);

  if (erro && !d) return <div className="p-8"><p role="alert" className="rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p></div>;
  if (!d) return <div className="p-8 text-suave">Carregando obra…</div>;
  const o = d.obra;
  const fone = (o.telefone ?? "").replace(/\D/g, "");
  async function mudarStatus(s: StatusObra) {
    setD((x) => (x ? { ...x, obra: { ...x.obra, status: s } } : x));
    try { await salvarObra(id, { status: s }); } catch (e) { setErro(mensagemErro(e)); recarregar(); }
  }

  return (
    <div className="pb-16">
      <div className="heroi relative overflow-hidden px-4 pt-5 pb-0 text-white lg:px-9 lg:pt-6">
        <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.28),transparent_70%)]" aria-hidden />
        <Link href="/tecnico/obras/" className="relative mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 hover:text-white"><ArrowLeft className="size-4" />Obras</Link>
        <div className="relative flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold tracking-[.14em] text-[#8ecbff] uppercase">Obra #{o.numero}</div>
            <h1 className="truncate font-display text-[24px] font-extrabold tracking-tight lg:text-[30px]">{o.cliente_nome ?? o.titulo}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-white/75">
              {o.titulo !== o.cliente_nome && <span>{o.titulo}</span>}
              {o.endereco && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.endereco)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white"><MapPin className="size-3.5" />{o.endereco}</a>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {fone && <a href={`https://wa.me/55${fone}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25d366] px-3.5 py-2 text-[13px] font-semibold text-white"><MessageCircle className="size-4" />WhatsApp</a>}
            <select value={o.status} onChange={(e) => mudarStatus(e.target.value as StatusObra)} aria-label="Situação da obra"
              className="rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[13px] font-semibold text-white outline-none [&>option]:text-tinta">
              {(Object.keys(STATUS_OBRA) as StatusObra[]).map((s) => <option key={s} value={s}>{STATUS_OBRA[s].rot}</option>)}
            </select>
          </div>
        </div>
        <nav className="relative -mx-4 mt-5 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="tablist">
          {ABAS.map(([k, rot, I]) => (
            <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-[13.5px] font-semibold transition ${aba === k ? "bg-fundo text-tinta" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
              <I className="size-4" />{rot}
              {k === "documentacao" && <span className="ml-0.5 rounded-full bg-black/10 px-1.5 text-[11px]">{d.docs.filter((x) => x.incluir && x.status === "aprovado").length}/{d.docs.filter((x) => x.incluir).length}</span>}
              {k === "materiais" && d.saidas.some((s) => !s.revisado_em) && papel === "diretoria" && <span className="size-2 rounded-full bg-[#ff9500]" />}
            </button>
          ))}
        </nav>
      </div>
      {erro && <p role="alert" className="mx-4 mt-4 rounded-xl bg-erro-claro px-4 py-3 text-erro lg:mx-9">{erro}</p>}
      <div className={aba === "tarefas" ? "" : "px-4 pt-5 lg:px-9"}>
        {aba === "geral" && <VisaoGeral d={d} equipe={equipe} papel={papel} onMudou={recarregar} irPara={(a) => setAba(a as Aba)} />}
        {aba === "cronograma" && <Cronograma d={d} equipe={equipe} onMudou={recarregar} />}
        {aba === "documentacao" && <Documentacao d={d} papel={papel} docInicial={docInicial} onMudou={recarregar} />}
        {aba === "materiais" && <Materiais d={d} papel={papel} onMudou={recarregar} />}
        {aba === "tarefas" && (o.quadro_id ? <QuadroView id={o.quadro_id} /> : <p className="px-9 pt-6 text-suave"><ClipboardList className="mr-1 inline size-4" />Esta obra não tem quadro de tarefas.</p>)}
      </div>
    </div>
  );
}
