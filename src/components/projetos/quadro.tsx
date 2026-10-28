"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  closestCorners, DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor,
  pointerWithin, rectIntersection, TouchSensor, useSensor, useSensors, CollisionDetection,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, CalendarDays, Columns3, Filter, MoreHorizontal, Plus, Search, Star, Tag, X } from "lucide-react";
import {
  carregarEquipe, carregarQuadro, Cartao, criarCartao, criarLista, FUNDOS, Lista, Membro, ouvirQuadro, posEntre, QuadroCompleto,
  salvarCartao, salvarLista, salvarQuadro, CORES, listaFinal, Modulo, PRIORIDADES,
} from "@/lib/projetos";
import { AgendaSemana } from "./agenda";
import { mensagemErro } from "@/lib/supabase";
import { Avatar, FaceCartao, situacaoPrazo } from "./pecas";
import { CartaoDetalhe } from "./cartao-detalhe";

const L = (id: string) => "lista:" + id;
const ehLista = (id: string | number) => String(id).startsWith("lista:");

type Filtros = { busca: string; membro: string; etiqueta: string; prazo: "" | "atrasado" | "hoje" | "semana" | "sem"; prioridade: string };

export function QuadroView({ id, voltar, abrirInicial }: { id: string; voltar?: string; abrirInicial?: string | null }) {
  const [d, setD] = useState<QuadroCompleto | null>(null);
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [aberto, setAberto] = useState<string | null>(abrirInicial ?? null);
  const [etqAbertas, setEtqAbertas] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({ busca: "", membro: "", etiqueta: "", prazo: "", prioridade: "" });
  const [visao, setVisao] = useState<"quadro" | "agenda">("quadro");
  const [verFiltros, setVerFiltros] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunas, setColunas] = useState<Record<string, string[]>>({});
  const [ordemListas, setOrdemListas] = useState<string[]>([]);
  const ocupado = useRef(false);

  const recarregar = useCallback(async () => {
    if (ocupado.current) return;
    try {
      const x = await carregarQuadro(id);
      setD(x);
    } catch (e) { setErro(mensagemErro(e)); }
  }, [id]);
  useEffect(() => { recarregar(); carregarEquipe().then(setEquipe).catch(() => {}); }, [recarregar]);
  useEffect(() => ouvirQuadro(id, recarregar), [id, recarregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 3500); return () => clearTimeout(t); }, [aviso]);

  // estado local de ordem (para arrastar sem esperar o banco)
  useEffect(() => {
    if (!d) return;
    const listas = [...d.listas].sort((a, b) => a.posicao - b.posicao);
    setOrdemListas(listas.map((l) => l.id));
    const c: Record<string, string[]> = {};
    for (const l of listas) c[l.id] = d.cartoes.filter((k) => k.lista_id === l.id).sort((a, b) => a.posicao - b.posicao).map((k) => k.id);
    setColunas(c);
  }, [d]);

  const porId = useMemo(() => new Map((d?.cartoes ?? []).map((c) => [c.id, c])), [d]);
  const passa = useCallback((c: Cartao) => {
    const f = filtros, q = f.busca.trim().toLowerCase();
    if (q && !`${c.numero ?? ""} #${c.numero ?? ""} ${c.titulo} ${c.descricao} ${c.cliente_nome} ${c.endereco}`.toLowerCase().includes(q)) return false;
    if (f.prioridade && c.prioridade !== f.prioridade) return false;
    if (f.membro && !c.membros.includes(f.membro)) return false;
    if (f.etiqueta && !c.etiquetas.includes(f.etiqueta)) return false;
    if (f.prazo) {
      const sp = situacaoPrazo(c);
      if (f.prazo === "sem") return !c.prazo;
      if (!c.prazo || c.prazo_concluido) return false;
      const p = new Date(c.prazo), fim = new Date(); fim.setHours(23, 59, 59, 999);
      if (f.prazo === "atrasado") return sp?.rot === "Atrasado";
      if (f.prazo === "hoje") return p <= fim;
      if (f.prazo === "semana") { const s = new Date(fim); s.setDate(s.getDate() + 7); return p <= s; }
    }
    return true;
  }, [filtros]);
  const filtrando = !!(filtros.busca || filtros.membro || filtros.etiqueta || filtros.prazo || filtros.prioridade);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const colisao: CollisionDetection = useCallback((args) => {
    if (ehLista(args.active.id)) return closestCorners({ ...args, droppableContainers: args.droppableContainers.filter((c) => ehLista(c.id)) });
    const p = pointerWithin(args);
    return p.length ? p : rectIntersection(args);
  }, []);
  const listaDoCartao = (cid: string) => Object.keys(colunas).find((l) => colunas[l].includes(cid));

  function aoIniciar(e: DragStartEvent) { setArrastando(String(e.active.id)); ocupado.current = true; }
  function aoPassar(e: DragOverEvent) {
    const a = String(e.active.id), o = e.over ? String(e.over.id) : null;
    if (!o || ehLista(a)) return;
    const de = listaDoCartao(a), para = ehLista(o) ? o.slice(6) : listaDoCartao(o);
    if (!de || !para || de === para) return;
    setColunas((c) => {
      const origem = c[de].filter((x) => x !== a), destino = [...c[para]];
      const i = ehLista(o) ? destino.length : Math.max(0, destino.indexOf(o));
      destino.splice(i, 0, a);
      return { ...c, [de]: origem, [para]: destino };
    });
  }
  async function aoSoltar(e: DragEndEvent) {
    const a = String(e.active.id), o = e.over ? String(e.over.id) : null;
    setArrastando(null);
    try {
      if (!d || !o) return;
      if (ehLista(a)) {
        const de = ordemListas.indexOf(a.slice(6)), para = ordemListas.indexOf(ehLista(o) ? o.slice(6) : listaDoCartao(o) ?? "");
        if (de < 0 || para < 0 || de === para) return;
        const nova = arrayMove(ordemListas, de, para);
        setOrdemListas(nova);
        const pos = (lid: string) => d.listas.find((l) => l.id === lid)!.posicao;
        const i = nova.indexOf(a.slice(6));
        const p = posEntre(i > 0 ? pos(nova[i - 1]) : undefined, i < nova.length - 1 ? pos(nova[i + 1]) : undefined);
        d.listas.find((l) => l.id === a.slice(6))!.posicao = p;
        await salvarLista(a.slice(6), { posicao: p });
        return;
      }
      const lista = listaDoCartao(a);
      if (!lista) return;
      let ids = colunas[lista];
      if (!ehLista(o) && ids.includes(o) && o !== a) {
        ids = arrayMove(ids, ids.indexOf(a), ids.indexOf(o));
        setColunas((c) => ({ ...c, [lista]: ids }));
      }
      const i = ids.indexOf(a);
      const vizinho = (k: number) => porId.get(ids[k])?.posicao;
      const p = posEntre(i > 0 ? vizinho(i - 1) : undefined, i < ids.length - 1 ? vizinho(i + 1) : undefined);
      const c = porId.get(a)!;
      if (c.lista_id === lista && c.posicao === p) return;
      const mudouLista = c.lista_id !== lista;
      c.lista_id = lista; c.posicao = p;
      const fim = listaFinal(d.listas);
      const extra = mudouLista && d.quadro.modulo !== "projetos" ? { concluido_em: lista === fim ? new Date().toISOString() : null } : {};
      Object.assign(c, extra);
      await salvarCartao(a, { lista_id: lista, posicao: p, ...extra });
    } catch (err) { setAviso("Não foi possível mover: " + mensagemErro(err)); } finally { ocupado.current = false; recarregar(); }
  }

  if (erro) return <p role="alert" className="m-6 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>;
  if (!d) return <p className="p-6 text-suave">Carregando quadro…</p>;
  const listas = ordemListas.map((lid) => d.listas.find((l) => l.id === lid)).filter(Boolean) as Lista[];
  const cartaoAberto = aberto ? porId.get(aberto) : null;
  const doQuadro = equipe.filter((m) => d.cartoes.some((c) => c.membros.includes(m.id)));
  const modulo: Modulo = d.quadro.modulo ?? "projetos";

  return (
    <div className="flex min-h-[calc(100dvh-59px)] flex-col lg:min-h-dvh" style={{ background: FUNDOS[d.quadro.fundo] ?? FUNDOS.marinho }}>
      {/* barra do quadro */}
      <div className="flex flex-wrap items-center gap-2 bg-black/20 px-3 py-2.5 text-white backdrop-blur-sm lg:px-5">
        {voltar && <Link href={voltar} className="rounded-lg p-1.5 hover:bg-white/15" aria-label="Voltar"><ArrowLeft className="size-5" /></Link>}
        <NomeEditavel valor={d.quadro.nome} onSalvar={async (v) => { d.quadro.nome = v; setD({ ...d }); await salvarQuadro(d.quadro.id, { nome: v }); }}
          className="font-display text-[18px] font-bold" />
        <button onClick={async () => { d.quadro.favorito = !d.quadro.favorito; setD({ ...d }); await salvarQuadro(d.quadro.id, { favorito: d.quadro.favorito }); }}
          className="rounded-lg p-1.5 hover:bg-white/15" aria-label="Favoritar"><Star className={`size-4 ${d.quadro.favorito ? "fill-[#ffd25e] text-[#ffd25e]" : ""}`} /></button>
        <span className="flex-1" />
        {doQuadro.length > 0 && <span className="hidden -space-x-1.5 sm:flex">{doQuadro.slice(0, 6).map((m) => <Avatar key={m.id} m={m} tam={28} />)}</span>}
        {modulo === "agendamentos" && (
          <div className="flex rounded-lg bg-white/15 p-0.5">
            {([["quadro", "Quadro", Columns3], ["agenda", "Agenda", CalendarDays]] as const).map(([k, r, I]) => (
              <button key={k} onClick={() => setVisao(k)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-semibold ${visao === k ? "bg-white text-marinho-900" : "hover:bg-white/15"}`}><I className="size-4" />{r}</button>
            ))}
          </div>
        )}
        <button onClick={() => setVerFiltros(!verFiltros)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold ${filtrando ? "bg-white text-marinho-900" : "bg-white/15 hover:bg-white/25"}`}>
          <Filter className="size-4" />Filtros{filtrando ? " ativos" : ""}
        </button>
        <MenuQuadro d={d} onMudar={(fundo) => { d.quadro.fundo = fundo; setD({ ...d }); salvarQuadro(d.quadro.id, { fundo }); }}
          onArquivar={modulo === "projetos" ? async () => { await salvarQuadro(d.quadro.id, { arquivado: true }); location.href = voltar ?? "/tecnico/projetos/"; } : undefined} />
      </div>
      {verFiltros && (
        <div className="flex flex-wrap items-center gap-2 bg-black/25 px-3 py-2 text-[13px] lg:px-5">
          <label className="relative"><Search className="absolute top-2 left-2.5 size-4 text-suave" />
            <input autoFocus value={filtros.busca} onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })} placeholder={modulo === "projetos" ? "Buscar cartões" : "Buscar nº, cliente, endereço…"}
              className="w-56 rounded-lg bg-white py-1.5 pr-2 pl-8 text-tinta outline-none" /></label>
          <select value={filtros.membro} onChange={(e) => setFiltros({ ...filtros, membro: e.target.value })} className="rounded-lg bg-white px-2 py-1.5 text-tinta">
            <option value="">Todos os membros</option>{equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <select value={filtros.etiqueta} onChange={(e) => setFiltros({ ...filtros, etiqueta: e.target.value })} className="rounded-lg bg-white px-2 py-1.5 text-tinta">
            <option value="">Todas as etiquetas</option>{d.etiquetas.map((e) => <option key={e.id} value={e.id}>{e.nome || e.cor}</option>)}
          </select>
          <select value={filtros.prazo} onChange={(e) => setFiltros({ ...filtros, prazo: e.target.value as Filtros["prazo"] })} className="rounded-lg bg-white px-2 py-1.5 text-tinta">
            <option value="">Qualquer prazo</option><option value="atrasado">Atrasados</option><option value="hoje">Vencem até hoje</option>
            <option value="semana">Próximos 7 dias</option><option value="sem">Sem prazo</option>
          </select>
          {modulo === "chamados" && (
            <select value={filtros.prioridade} onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })} className="rounded-lg bg-white px-2 py-1.5 text-tinta">
              <option value="">Toda prioridade</option>{PRIORIDADES.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </select>
          )}
          {filtrando && <button onClick={() => setFiltros({ busca: "", membro: "", etiqueta: "", prazo: "", prioridade: "" })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold text-white hover:bg-white/15"><X className="size-4" />Limpar</button>}
        </div>
      )}

      {visao === "agenda" && modulo === "agendamentos" ? (
        <AgendaSemana cartoes={d.cartoes.filter(passa)} etiquetas={d.etiquetas} equipe={equipe} abrir={setAberto}
          onNovo={async (inicio) => {
            const ag = d.listas.find((l) => /agendad/i.test(l.nome)) ?? listas[0];
            const fimH = new Date(inicio); fimH.setHours(fimH.getHours() + 2);
            const c = await criarCartao(d.quadro.id, ag.id, "Nova visita", posEntre(undefined, undefined) + Date.now() / 1e6, { agenda_inicio: inicio.toISOString(), agenda_fim: fimH.toISOString() });
            setD({ ...d, cartoes: [...d.cartoes, c] }); setAberto(c.id);
          }} />
      ) : (
      <DndContext sensors={sensores} collisionDetection={colisao} onDragStart={aoIniciar} onDragOver={aoPassar} onDragEnd={aoSoltar}
        onDragCancel={() => { setArrastando(null); ocupado.current = false; recarregar(); }}>
        <div className="flex flex-1 items-start gap-3 overflow-x-auto px-3 pt-3 pb-6 lg:px-5">
          <SortableContext items={listas.map((l) => L(l.id))} strategy={horizontalListSortingStrategy}>
            {listas.map((l) => (
              <ColunaLista key={l.id} lista={l} ids={(colunas[l.id] ?? []).filter((cid) => { const c = porId.get(cid); return c && passa(c); })}
                porId={porId} d={d} equipe={equipe} etqAbertas={etqAbertas} setEtqAbertas={setEtqAbertas} abrir={setAberto}
                onNovo={async (titulo) => {
                  const ids = colunas[l.id] ?? [], ult = ids.length ? porId.get(ids[ids.length - 1])?.posicao : undefined;
                  const c = await criarCartao(d.quadro.id, l.id, titulo, posEntre(ult, undefined));
                  setD({ ...d, cartoes: [...d.cartoes, c] });
                  if (modulo !== "projetos") setAberto(c.id);
                }}
                onRenomear={async (nome) => { l.nome = nome; setD({ ...d }); await salvarLista(l.id, { nome }); }}
                onArquivar={async () => { await salvarLista(l.id, { arquivada: true }); setD({ ...d, listas: d.listas.filter((x) => x.id !== l.id) }); }}
                onArquivarCartoes={async () => {
                  const ids = colunas[l.id] ?? [];
                  await Promise.all(ids.map((cid) => salvarCartao(cid, { arquivado: true })));
                  setD({ ...d, cartoes: d.cartoes.filter((c) => !ids.includes(c.id)) });
                }} />
            ))}
          </SortableContext>
          <NovaLista onCriar={async (nome) => {
            const ult = listas.length ? listas[listas.length - 1].posicao : undefined;
            const l = await criarLista(d.quadro.id, nome, posEntre(ult, undefined));
            setD({ ...d, listas: [...d.listas, l] });
          }} />
        </div>
        <DragOverlay>
          {arrastando && !ehLista(arrastando) && porId.get(arrastando) ? (
            <div className="w-[272px] rotate-[3deg] cursor-grabbing"><FaceCartao c={porId.get(arrastando)!} etiquetas={d.etiquetas} equipe={equipe} etiquetasAbertas={etqAbertas} onEtiquetas={() => {}} modulo={modulo} /></div>
          ) : arrastando && ehLista(arrastando) ? (
            <div className="w-[272px] rotate-[2deg] rounded-2xl bg-[#f1f2f4] p-3 font-bold opacity-90 shadow-2xl">{d.listas.find((l) => L(l.id) === arrastando)?.nome}</div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {cartaoAberto && (
        <CartaoDetalhe c={cartaoAberto} d={d} equipe={equipe} modulo={modulo} onFechar={() => setAberto(null)}
          onMudou={(campos) => { Object.assign(cartaoAberto, campos); setD({ ...d, cartoes: [...d.cartoes] }); }}
          onSumiu={() => { setD({ ...d, cartoes: d.cartoes.filter((c) => c.id !== cartaoAberto.id) }); setAberto(null); }}
          onEtiquetas={(etiquetas) => setD({ ...d, etiquetas })} />
      )}
      {aviso && <div role="status" className="fixed right-4 bottom-4 z-50 rounded-xl border-l-4 border-erro bg-marinho-950 px-4 py-3 text-[14px] font-semibold text-white shadow-2xl">{aviso}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ lista (coluna)
function ColunaLista({ lista, ids, porId, d, equipe, etqAbertas, setEtqAbertas, abrir, onNovo, onRenomear, onArquivar, onArquivarCartoes }: {
  lista: Lista; ids: string[]; porId: Map<string, Cartao>; d: QuadroCompleto; equipe: Membro[]; etqAbertas: boolean; setEtqAbertas: (v: boolean) => void;
  abrir: (id: string) => void; onNovo: (t: string) => Promise<void>; onRenomear: (n: string) => Promise<void>; onArquivar: () => Promise<void>; onArquivarCartoes: () => Promise<void>;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: L(lista.id) });
  const [novo, setNovo] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  return (
    <section ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex max-h-[calc(100dvh-150px)] w-[272px] shrink-0 flex-col rounded-2xl bg-[#f1f2f4] shadow-[0_1px_1px_rgba(9,30,66,.25)] ${isDragging ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-1 px-2 pt-2 pb-1" {...attributes} {...listeners}>
        <NomeEditavel valor={lista.nome} onSalvar={onRenomear} className="flex-1 px-1.5 text-[14px] font-bold text-tinta" />
        <span className="px-1 text-[12px] font-semibold text-suave">{ids.length}</span>
        <div className="relative">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setMenu(!menu)} className="rounded-lg p-1.5 text-suave hover:bg-black/5" aria-label="Ações da lista"><MoreHorizontal className="size-4" /></button>
          {menu && (
            <div onPointerDown={(e) => e.stopPropagation()} className="absolute top-8 right-0 z-30 w-56 rounded-xl border border-linha bg-white p-1.5 text-[13.5px] shadow-xl">
              <button onClick={() => { setMenu(false); setNovo(""); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-fundo">Adicionar cartão</button>
              <button onClick={async () => { setMenu(false); if (confirm(`Arquivar todos os cartões de "${lista.nome}"?`)) await onArquivarCartoes(); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-fundo">Arquivar todos os cartões</button>
              <button onClick={async () => { setMenu(false); if (confirm(`Arquivar a lista "${lista.nome}"?`)) await onArquivar(); }} className="block w-full rounded-lg px-3 py-2 text-left text-erro hover:bg-erro-claro">Arquivar esta lista</button>
            </div>
          )}
        </div>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[8px] flex-col gap-2 overflow-y-auto px-2 pb-1">
          {ids.map((cid) => <CartaoArrastavel key={cid} c={porId.get(cid)!} d={d} equipe={equipe} etqAbertas={etqAbertas} setEtqAbertas={setEtqAbertas} abrir={abrir} />)}
        </div>
      </SortableContext>
      {novo !== null ? (
        <form className="px-2 pt-1 pb-2" onSubmit={async (e) => { e.preventDefault(); if (novo.trim()) { const t = novo; setNovo(""); await onNovo(t); } }}>
          <textarea autoFocus rows={2} value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Insira um título para este cartão…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } if (e.key === "Escape") setNovo(null); }}
            className="w-full resize-none rounded-xl border-0 bg-white px-3 py-2 text-[14px] shadow-[0_1px_0_rgba(9,30,66,.18)] outline-none focus:ring-2 focus:ring-azul" />
          <div className="mt-1.5 flex items-center gap-1.5">
            <button type="submit" className="rounded-lg bg-azul px-3 py-1.5 text-[13.5px] font-semibold text-white">Adicionar cartão</button>
            <button type="button" onClick={() => setNovo(null)} className="rounded-lg p-1.5 text-suave hover:bg-black/5" aria-label="Cancelar"><X className="size-5" /></button>
          </div>
        </form>
      ) : (
        <button onClick={() => setNovo("")} className="m-2 mt-1 flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-[13.5px] font-semibold text-suave hover:bg-black/5 hover:text-tinta">
          <Plus className="size-4" />Adicionar um cartão
        </button>
      )}
    </section>
  );
}

function CartaoArrastavel({ c, d, equipe, etqAbertas, setEtqAbertas, abrir }: {
  c: Cartao; d: QuadroCompleto; equipe: Membro[]; etqAbertas: boolean; setEtqAbertas: (v: boolean) => void; abrir: (id: string) => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: c.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners}
      onClick={() => abrir(c.id)} className={`group cursor-pointer touch-manipulation ${isDragging ? "opacity-30" : ""}`}>
      <FaceCartao c={c} etiquetas={d.etiquetas} equipe={equipe} etiquetasAbertas={etqAbertas} onEtiquetas={() => setEtqAbertas(!etqAbertas)} modulo={d.quadro.modulo ?? "projetos"} />
    </div>
  );
}

function NovaLista({ onCriar }: { onCriar: (nome: string) => Promise<void> }) {
  const [nome, setNome] = useState<string | null>(null);
  if (nome === null) return (
    <button onClick={() => setNome("")} className="flex w-[272px] shrink-0 items-center gap-2 rounded-2xl bg-white/20 px-4 py-3 text-left text-[14px] font-semibold text-white backdrop-blur-sm hover:bg-white/30">
      <Plus className="size-4" />Adicionar outra lista
    </button>
  );
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (nome.trim()) { const n = nome; setNome(""); await onCriar(n); } }} className="w-[272px] shrink-0 rounded-2xl bg-[#f1f2f4] p-2">
      <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setNome(null)} placeholder="Nome da lista…"
        className="w-full rounded-lg border-2 border-azul bg-white px-2.5 py-1.5 text-[14px] outline-none" />
      <div className="mt-1.5 flex items-center gap-1.5">
        <button type="submit" className="rounded-lg bg-azul px-3 py-1.5 text-[13.5px] font-semibold text-white">Adicionar lista</button>
        <button type="button" onClick={() => setNome(null)} className="rounded-lg p-1.5 text-suave hover:bg-black/5" aria-label="Cancelar"><X className="size-5" /></button>
      </div>
    </form>
  );
}

export function NomeEditavel({ valor, onSalvar, className = "" }: { valor: string; onSalvar: (v: string) => Promise<void> | void; className?: string }) {
  const [ed, setEd] = useState<string | null>(null);
  if (ed === null) return <h2 onClick={() => setEd(valor)} className={`cursor-text truncate rounded-md py-1 ${className}`} title="Clique para renomear">{valor}</h2>;
  const fim = () => { const v = ed.trim(); setEd(null); if (v && v !== valor) onSalvar(v); };
  return (
    <input autoFocus value={ed} onChange={(e) => setEd(e.target.value)} onBlur={fim} onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Enter") fim(); if (e.key === "Escape") setEd(null); }}
      className={`min-w-0 rounded-md border-2 border-azul bg-white px-1.5 py-0.5 text-tinta outline-none ${className}`} />
  );
}

function MenuQuadro({ d, onMudar, onArquivar }: { d: QuadroCompleto; onMudar: (f: string) => void; onArquivar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setAberto(!aberto)} className="rounded-lg bg-white/15 p-1.5 hover:bg-white/25" aria-label="Menu do quadro"><MoreHorizontal className="size-5" /></button>
      {aberto && (
        <div className="absolute top-10 right-0 z-40 w-72 rounded-xl border border-linha bg-white p-3 text-tinta shadow-2xl">
          <div className="mb-2 text-[12px] font-semibold text-suave">Fundo do quadro</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(FUNDOS).map(([k, v]) => (
              <button key={k} onClick={() => onMudar(k)} className={`h-12 rounded-lg ${d.quadro.fundo === k ? "ring-2 ring-azul ring-offset-2" : ""}`} style={{ background: v }} aria-label={k} />
            ))}
          </div>
          <div className="mt-3 mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-suave"><Tag className="size-3.5" />Etiquetas deste quadro</div>
          <div className="flex flex-wrap gap-1">{d.etiquetas.map((e) => <span key={e.id} className="rounded px-2 py-0.5 text-[11.5px] font-bold text-white" style={{ background: CORES[e.cor] ?? e.cor }}>{e.nome || " "}</span>)}</div>
          <p className="mt-1 text-[11.5px] text-suave">Edite as etiquetas abrindo qualquer cartão.</p>
          {onArquivar && <button onClick={() => { if (confirm("Arquivar este quadro? Ele some da lista, mas os dados ficam guardados.")) onArquivar(); }}
            className="mt-3 w-full rounded-lg px-3 py-2 text-left text-[13.5px] font-semibold text-erro hover:bg-erro-claro">Arquivar quadro</button>}
        </div>
      )}
    </div>
  );
}
