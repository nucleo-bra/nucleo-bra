"use client";
// Chamados em cartões, no mesmo estilo do quadro de negócios do CRM:
// uma coluna por etapa, cartões que se arrastam, prioridade em destaque.
import { useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Clock, MapPin, MessageCircle, Phone, Plus, RotateCcw, Search, ShieldCheck, SquarePen, User } from "lucide-react";
import { Cartao, CORES, Etiqueta, listaFinal, Membro, PRIORIDADES, QuadroCompleto } from "@/lib/projetos";
import { Avatar } from "./pecas";

const PESO: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
const DIA = 86_400_000;
const zap = (t: string) => { const d = t.replace(/\D/g, ""); return d ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : ""; };
/** cor do topo de cada coluna: entrada vermelha, atendimento azul, aguardando laranja, resolvido verde */
const corEtapa = (nome: string, final: boolean) => final ? "#34c759" : /novo|entrada|abert/i.test(nome) ? "#e2625b" : /aguard|pend/i.test(nome) ? "#f0a845" : /atend|andamento|execu/i.test(nome) ? "#0071e3" : "#af52de";

function CartaoChamado({ c, d, equipe, fim, inicio, abrir, onMover, onArrastar }: {
  c: Cartao; d: QuadroCompleto; equipe: Membro[]; fim: string | null; inicio: string | null; abrir: (id: string) => void;
  onMover?: (c: Cartao, lista: string) => void; onArrastar: (id: string | null) => void;
}) {
  const p = PRIORIDADES.find(([x]) => x === c.prioridade);
  const pessoas = c.membros.map((id) => equipe.find((m) => m.id === id)).filter(Boolean) as Membro[];
  const etq = c.etiquetas.map((id) => d.etiquetas.find((e) => e.id === id)).filter(Boolean) as Etiqueta[];
  const dias = Math.max(0, Math.floor((Date.now() - new Date(c.created_at).getTime()) / DIA));
  const resolvido = c.lista_id === fim;
  const atrasado = !resolvido && c.prazo && !c.prazo_concluido && new Date(c.prazo) < new Date();
  return (
    <div draggable={!!onMover} onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); onArrastar(c.id); }} onDragEnd={() => onArrastar(null)}
      className={`group relative shrink-0 overflow-hidden rounded-xl border border-linha bg-white shadow-[0_1px_2px_rgba(0,0,0,.05)] transition hover:shadow-[0_8px_24px_-10px_rgba(0,0,0,.18)] ${resolvido ? "opacity-80" : ""}`}>
      
      <button type="button" onClick={() => abrir(c.id)} className="block w-full px-3.5 pt-3 pb-2.5 pl-4 text-left">
        <div className="flex items-start gap-2">
          {c.numero != null && <span className="num mt-0.5 shrink-0 rounded-md bg-fundo px-1.5 text-[11.5px] font-bold text-suave">#{c.numero}</span>}
          <span className="line-clamp-2 min-w-0 flex-1 text-[14.5px] leading-snug font-semibold text-tinta">{c.titulo}</span>
          {p && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${p[2]}`}>{p[1]}</span>}
        </div>
        {c.cliente_nome && <div className="mt-1 flex items-center gap-1.5 truncate text-[13px] font-medium text-tinta/80"><User className="size-3.5 shrink-0 text-suave" /><span className="truncate">{c.cliente_nome}</span></div>}
        {c.descricao && <p className="mt-1 line-clamp-2 text-[12.5px] text-suave">{c.descricao}</p>}
        <div className="mt-2 space-y-0.5 text-[12px] text-suave">
          {c.endereco && <div className="flex items-center gap-1.5 truncate"><MapPin className="size-3 shrink-0" /><span className="truncate">{c.endereco}</span></div>}
          <div className={`flex items-center gap-1.5 ${dias > 7 && !resolvido ? "font-semibold text-erro" : ""}`}><Clock className="size-3 shrink-0" />{resolvido ? "Resolvido" : `Aberto ${dias === 0 ? "hoje" : `há ${dias} dia${dias > 1 ? "s" : ""}`}`}</div>
        </div>
        {(c.garantia || atrasado || etq.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {c.garantia && <span className="inline-flex items-center gap-0.5 rounded bg-ok-claro px-1.5 text-[11px] font-bold text-ok"><ShieldCheck className="size-3" />Garantia</span>}
            {atrasado && <span className="inline-flex items-center gap-0.5 rounded bg-erro-claro px-1.5 text-[11px] font-bold text-erro"><AlertCircle className="size-3" />Prazo vencido</span>}
            {etq.slice(0, 3).map((e) => <span key={e.id} className="rounded px-1.5 text-[11px] font-bold text-white" style={{ background: CORES[e.cor] ?? e.cor }}>{e.nome || " "}</span>)}
          </div>
        )}
      </button>
      <div className="flex items-center gap-1 border-t border-linha bg-fundo/50 px-2 py-1">
        {pessoas.length ? <span className="flex -space-x-1.5 pl-1">{pessoas.slice(0, 3).map((m) => <Avatar key={m.id} m={m} tam={22} />)}</span>
          : <span className="pl-1 text-[11.5px] font-semibold text-atencao">Sem responsável</span>}
        <span className="ml-auto flex items-center gap-0.5">
          {c.telefone && <a href={zap(c.telefone)} target="_blank" rel="noreferrer" title="WhatsApp do cliente" className="rounded-md p-1.5 text-ok hover:bg-white"><MessageCircle className="size-3.5" /></a>}
          {c.telefone && <a href={`tel:${c.telefone.replace(/\D/g, "")}`} title="Ligar" className="rounded-md p-1.5 text-suave hover:bg-white hover:text-azul"><Phone className="size-3.5" /></a>}
          <button type="button" onClick={() => abrir(c.id)} title="Abrir e editar" className="rounded-md p-1.5 text-suave hover:bg-white hover:text-azul"><SquarePen className="size-3.5" /></button>
          {onMover && (resolvido
            ? inicio && <button type="button" onClick={() => onMover(c, inicio)} title="Reabrir" className="rounded-md p-1.5 text-suave hover:bg-white hover:text-azul"><RotateCcw className="size-3.5" /></button>
            : fim && <button type="button" onClick={() => onMover(c, fim)} title="Marcar como resolvido" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-bold text-ok hover:bg-white"><Check className="size-3.5" />Resolver</button>)}
        </span>
      </div>
    </div>
  );
}

export function QuadroChamados({ d, cartoes, equipe, abrir, onMover, onNovo }: {
  d: QuadroCompleto; cartoes: Cartao[]; equipe: Membro[]; abrir: (id: string) => void; onMover?: (c: Cartao, lista: string) => void; onNovo?: () => void;
}) {
  const [busca, setBusca] = useState(""), [resp, setResp] = useState(""), [prio, setPrio] = useState("");
  const [verResolvidos, setVerResolvidos] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null), [sobre, setSobre] = useState<string | null>(null);
  const fim = listaFinal(d.listas) ?? null;
  const listas = [...d.listas].sort((a, b) => a.posicao - b.posicao);
  const inicio = listas[0]?.id ?? null;
  const q = busca.trim().toLowerCase();
  const L = useMemo(() => cartoes.filter((c) =>
    (!q || `${c.numero ?? ""} ${c.titulo} ${c.cliente_nome ?? ""} ${c.descricao ?? ""} ${c.endereco ?? ""}`.toLowerCase().includes(q)) &&
    (!resp || (resp === "~" ? !c.membros.length : c.membros.includes(resp))) && (!prio || (c.prioridade ?? "~") === prio),
  ).sort((a, b) => (PESO[a.prioridade ?? ""] ?? 4) - (PESO[b.prioridade ?? ""] ?? 4) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [cartoes, q, resp, prio]);
  const colunas = listas.filter((l) => verResolvidos || l.id !== fim);
  const filtrando = !!(q || resp || prio);

  return (
    <section className="sombra-bra min-w-0 rounded-[18px] border border-linha bg-white/80 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {onNovo && <button type="button" onClick={onNovo} className="inline-flex items-center gap-1.5 rounded-lg bg-azul hover:bg-azul-escuro px-3.5 py-2 text-[13.5px] font-semibold text-white shadow-md hover:shadow-lg"><Plus className="size-4" />Novo chamado</button>}
        <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute top-2.5 left-3 size-4 text-suave" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar chamado (nº, cliente, problema, endereço)"
            className="w-full rounded-lg border border-linha bg-white py-2 pr-3 pl-9 text-[13.5px] outline-none focus:border-azul" />
        </label>
        <select value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Prioridade" className="rounded-lg border border-linha bg-white px-3 py-2 text-[13.5px]">
          <option value="">Todas as prioridades</option>{PRIORIDADES.map(([k, r]) => <option key={k} value={k}>{r}</option>)}<option value="~">Sem prioridade</option>
        </select>
        <select value={resp} onChange={(e) => setResp(e.target.value)} aria-label="Responsável" className="rounded-lg border border-linha bg-white px-3 py-2 text-[13.5px]">
          <option value="">Todos os responsáveis</option><option value="~">Sem responsável</option>{equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <button type="button" onClick={() => setVerResolvidos(!verResolvidos)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13.5px] font-semibold transition ${verResolvidos ? "border-[#5ab6c2] bg-[#5ab6c2] text-white" : "border-[#5ab6c2] bg-white text-[#3a9aa6] hover:bg-[#eaf6f7]"}`}><CheckCircle2 className="size-4" />Resolvidos</button>
        {filtrando && <button type="button" onClick={() => { setBusca(""); setResp(""); setPrio(""); }} className="text-[13px] font-semibold text-azul hover:underline">Limpar filtros</button>}
        {onMover && <span className="ml-auto hidden text-[12px] text-suave lg:block">Arraste o cartão para mudar a etapa</span>}
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {colunas.map((l) => {
          const C = L.filter((c) => c.lista_id === l.id), final = l.id === fim, cor = corEtapa(l.nome, final);
          const urg = C.filter((c) => c.prioridade === "urgente").length;
          return (
            <section key={l.id}
              onDragOver={(e) => { if (!onMover) return; e.preventDefault(); setSobre(l.id); }} onDragLeave={() => setSobre((v) => (v === l.id ? null : v))}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || arrastando; const c = cartoes.find((x) => x.id === id); if (c && onMover && c.lista_id !== l.id) onMover(c, l.id); setArrastando(null); setSobre(null); }}
              className={`flex w-[300px] shrink-0 flex-col overflow-hidden rounded-xl border bg-[#f6f7fa] transition xl:w-auto xl:min-w-[280px] xl:flex-1 ${sobre === l.id ? "border-azul ring-2 ring-azul/20" : "border-linha"}`}>
              <div className="h-2" style={{ background: cor }} />
              <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                <h3 className="text-[16px] font-bold text-tinta">{l.nome}</h3>
                <span className="num rounded-md bg-fundo px-2 py-0.5 text-[12.5px] font-bold text-tinta ring-1 ring-linha">{C.length}</span>
                {urg > 0 && <span className="rounded-full bg-erro px-2 py-0.5 text-[11px] font-bold text-white">{urg} urgente{urg > 1 ? "s" : ""}</span>}
              </header>
              <div className="flex max-h-[70vh] min-h-[120px] flex-col gap-3 overflow-y-auto px-2.5 pb-3">
                {(final ? C.slice(0, 15) : C).map((c) => <CartaoChamado key={c.id} c={c} d={d} equipe={equipe} fim={fim} inicio={inicio} abrir={abrir} onMover={onMover} onArrastar={setArrastando} />)}
                {final && C.length > 15 && <p className="text-center text-[12px] text-suave">+ {C.length - 15} resolvidos (veja em Lista)</p>}
                {!C.length && <p className="rounded-lg border border-dashed border-linha px-2 py-6 text-center text-[12.5px] text-suave">{filtrando ? "Nada com esse filtro" : onMover ? "Arraste um chamado para cá" : "Nenhum chamado"}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
