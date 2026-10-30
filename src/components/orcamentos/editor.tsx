"use client";
// Editor de orçamento no mesmo formato do Zenith: nome + ambientes, abas
// Produtos / Serviços / Cliente com linhas (produto, quantidade, ambiente,
// unitário, total), Totais com markup e desconto, condições de pagamento,
// Salvar e Exportar (PDF) — e, embaixo, as propostas do negócio.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft, Box, Calculator, Check, ChevronDown, Copy, FileDown, GripVertical, Image as ImageIcon, Loader2, Pencil, Plus, Save,
  Search, Trash2, Users, Wrench, X,
} from "lucide-react";
import { campo, Janela, reais } from "@/components/crm/ui";
import { mensagemErro, supabase } from "@/lib/supabase";
import {
  abrirOrcamento, AMBIENTES_SUGERIDOS, buscarNoCatalogo, calcularTotais, carregarCatalogo, condicoes, FORMAS_PAGAMENTO, fotoProduto, Item,
  itemDeProduto, itemDeServico, novaChave, Orcamento, orcamentoVazio, Produto, salvarOrcamento, Servico, TipoItem, totalItem,
} from "@/lib/orcamentos";
import { PropostasDoNegocio } from "./lista";

const num = (v: number, casas = 2) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const lerNum = (s: string) => { const t = s.replace(/[^\d,.-]/g, ""); const v = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t); return Number.isFinite(v) ? v : 0; };

/** Campo numérico no formato brasileiro (1.234,56) que só reformata ao sair. */
function CampoValor({ valor, onChange, casas = 2, className = "", prefixo, sufixo, disabled, ariaLabel }: {
  valor: number | null; onChange: (v: number) => void; casas?: number; className?: string; prefixo?: string; sufixo?: string; disabled?: boolean; ariaLabel?: string;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <div className={`relative ${className}`}>
      {prefixo && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[12px] text-suave">{prefixo}</span>}
      <input aria-label={ariaLabel} disabled={disabled} inputMode="decimal" className={`${campo} num text-right ${prefixo ? "pl-8" : ""} ${sufixo ? "pr-7" : ""} disabled:bg-fundo disabled:text-suave`}
        value={texto ?? (valor == null ? "" : num(valor, casas))} onFocus={(e) => { setTexto(valor ? num(valor, casas) : ""); e.target.select(); }}
        onChange={(e) => { setTexto(e.target.value); onChange(lerNum(e.target.value)); }} onBlur={() => setTexto(null)} />
      {sufixo && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[12px] text-suave">{sufixo}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ busca de produto / serviço
function Miniatura({ path, className = "size-10" }: { path: string | null | undefined; className?: string }) {
  const u = fotoProduto(path);
  // eslint-disable-next-line @next/next/no-img-element
  return u ? <img src={u} alt="" loading="lazy" className={`${className} shrink-0 rounded-md border border-linha bg-white object-contain`} />
    : <span className={`${className} grid shrink-0 place-items-center rounded-md border border-linha bg-fundo text-suave`}><Box className="size-4" /></span>;
}

function Seletor<T extends { id: string; codigo: number | null; nome: string }>({ valor, lista, campos, linha, placeholder, onEscolher }: {
  valor: React.ReactNode | null; lista: T[]; campos: (x: T) => string; linha: (x: T) => React.ReactNode; placeholder: string; onEscolher: (x: T) => void;
}) {
  const [aberto, setAberto] = useState(false), [termo, setTermo] = useState(""), [ativo, setAtivo] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const achados = useMemo(() => (aberto ? buscarNoCatalogo(lista, termo, campos, 60) : []), [aberto, lista, termo, campos]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora); return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const escolher = (x: T) => { onEscolher(x); setAberto(false); setTermo(""); };
  return (
    <div ref={caixa} className="relative min-w-0">
      <button type="button" onClick={() => { setAberto(!aberto); setAtivo(0); }} className="flex min-h-[58px] w-full items-center gap-2 rounded-xl border border-linha bg-white px-2.5 py-1.5 text-left hover:border-azul">
        <span className="min-w-0 flex-1">{valor ?? <span className="text-[13.5px] text-suave">{placeholder}</span>}</span>
        <ChevronDown className="size-4 shrink-0 text-suave" />
      </button>
      {aberto && (
        <div className="absolute top-full left-0 z-30 mt-1 w-[min(640px,calc(100vw-40px))] overflow-hidden rounded-xl border border-linha bg-white shadow-[0_20px_50px_-12px_rgba(14,26,61,.35)]">
          <div className="flex items-center gap-2 border-b border-linha px-3 py-2">
            <Search className="size-4 text-suave" />
            <input autoFocus className="w-full bg-transparent text-[14px] outline-none" placeholder="Código, nome, modelo ou fabricante" value={termo}
              onChange={(e) => { setTermo(e.target.value); setAtivo(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, achados.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
                else if (e.key === "Enter" && achados[ativo]) { e.preventDefault(); escolher(achados[ativo]); }
                else if (e.key === "Escape") setAberto(false);
              }} />
          </div>
          <ul className="max-h-[360px] overflow-y-auto py-1">
            {achados.map((x, k) => (
              <li key={x.id}><button type="button" onMouseEnter={() => setAtivo(k)} onClick={() => escolher(x)} className={`w-full px-3 py-1.5 text-left ${k === ativo ? "bg-[#eef3fb]" : ""}`}>{linha(x)}</button></li>
            ))}
            {!achados.length && <li className="px-3 py-4 text-center text-[13px] text-suave">Nada encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function CartaoProduto({ p, compacto = false }: { p: Pick<Produto, "codigo" | "nome" | "marca" | "modelo" | "preco_venda" | "unidade" | "imagem_path"> & { saldo?: number }; compacto?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Miniatura path={p.imagem_path} className={compacto ? "size-9" : "size-11"} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-tinta">{p.codigo != null ? `${p.codigo} - ` : ""}{p.nome}</span>
        <span className="block truncate text-[11.5px] text-suave">{[p.marca, p.modelo].filter(Boolean).join(" • ")}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="num block text-[12.5px] font-bold text-tinta">{reais(p.preco_venda)}</span>
        <span className="block text-[11px] text-suave">{({ Unidade: "Un", Par: "Pr", Rolo: "Rl", Metro: "m" } as Record<string, string>)[p.unidade] ?? p.unidade}{p.saldo != null ? ` · est. ${p.saldo.toLocaleString("pt-BR")}` : ""}</span>
      </span>
    </span>
  );
}

// ------------------------------------------------------------------ linha da tabela
function Linha({ item, catalogo, ambientes, onMudar, onClonar, onRemover, onVer }: {
  item: Item; catalogo: { produtos: Produto[]; servicos: Servico[] }; ambientes: string[];
  onMudar: (i: Item) => void; onClonar: () => void; onRemover: () => void; onVer: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.chave });
  const prod = item.produto_id ? catalogo.produtos.find((p) => p.id === item.produto_id) : null;
  const serv = item.servico_id ? catalogo.servicos.find((s) => s.id === item.servico_id) : null;
  const camposP = useCallback((p: Produto) => `${p.modelo} ${p.marca} ${p.referencia} ${p.categoria}`, []);
  const camposS = useCallback((s: Servico) => `${s.categoria} ${s.descricao}`, []);
  const valorAtual = item.tipo === "servico"
    ? (serv || item.descricao ? <span className="block truncate text-[13px] font-semibold">{serv?.codigo != null ? `${serv.codigo} - ` : ""}{serv?.nome ?? item.descricao}<span className="block truncate text-[11.5px] font-normal text-suave">{(serv?.descricao ?? item.detalhe).slice(0, 90)}</span></span> : null)
    : prod ? <CartaoProduto p={prod} compacto />
      : item.descricao ? <span className="block truncate text-[13px] font-semibold">{item.descricao}<span className="block text-[11.5px] font-normal text-suave">fora do cadastro{item.marca ? ` · ${item.marca}` : ""}</span></span> : null;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`grid grid-cols-[22px_minmax(0,1fr)] items-center gap-x-2 gap-y-2 border-b border-linha py-2.5 last:border-0 lg:grid-cols-[22px_minmax(0,1fr)_78px_170px_120px_120px_auto] ${isDragging ? "relative z-10 bg-white shadow-lg" : ""}`}>
      <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none text-suave hover:text-azul" aria-label="Arrastar para reordenar"><GripVertical className="size-4" /></button>
      {item.tipo === "servico"
        ? <Seletor lista={catalogo.servicos} campos={camposS} valor={valorAtual} placeholder="Buscar serviço"
            linha={(s) => <span className="block"><span className="block truncate text-[13px] font-semibold">{s.codigo} - {s.nome}</span><span className="block truncate text-[11.5px] text-suave">{s.categoria} · {reais(s.valor)}</span></span>}
            onEscolher={(s) => onMudar({ ...itemDeServico(s, item.ambiente), chave: item.chave, quantidade: item.quantidade || 1, valor_unitario: s.valor || item.valor_unitario })} />
        : <Seletor lista={catalogo.produtos} campos={camposP} valor={valorAtual} placeholder="Buscar produto"
            linha={(p) => <CartaoProduto p={p} />}
            onEscolher={(p) => onMudar({ ...itemDeProduto(p, item.ambiente), tipo: item.tipo, chave: item.chave, quantidade: item.quantidade || 1 })} />}
      <div className="col-span-2 grid grid-cols-[72px_minmax(0,1fr)] gap-2 sm:grid-cols-[72px_minmax(0,170px)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:col-span-5 lg:grid-cols-subgrid">
        <CampoValor ariaLabel="Quantidade" valor={item.quantidade} casas={item.quantidade % 1 ? 2 : 0} onChange={(v) => onMudar({ ...item, quantidade: v })} />
        <select aria-label="Ambiente" className={campo} value={item.ambiente} onChange={(e) => onMudar({ ...item, ambiente: e.target.value })}>
          <option value="">Selecionar</option>{ambientes.map((a) => <option key={a}>{a}</option>)}
        </select>
        {item.tipo === "cliente"
          ? <span className="col-span-2 self-center text-[12px] text-suave sm:col-span-2">Fornecido pelo cliente</span>
          : <>
              <CampoValor ariaLabel="Valor unitário" prefixo="R$" valor={item.valor_unitario} onChange={(v) => onMudar({ ...item, valor_unitario: v })} />
              <div className="num flex items-center justify-end rounded-xl bg-fundo px-3 py-2 text-[14px] font-semibold" aria-label="Total da linha">{reais(totalItem(item))}</div>
            </>}
        <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
          {item.tipo !== "servico" && <button type="button" onClick={onVer} title="Ver produto" className="rounded-lg border border-linha p-2 text-azul hover:bg-fundo"><ImageIcon className="size-4" /></button>}
          <button type="button" onClick={onClonar} title="Clonar linha" className="rounded-lg border border-linha p-2 text-azul hover:bg-fundo"><Copy className="size-4" /></button>
          <button type="button" onClick={onRemover} title="Remover linha" className="rounded-lg border border-linha p-2 text-erro hover:bg-erro-claro"><X className="size-4" /></button>
        </div>
      </div>
      {item.valor_tabela != null && item.tipo !== "cliente" && Math.abs(item.valor_tabela - item.valor_unitario) > 0.005 && (
        <p className="col-span-2 -mt-1 text-right text-[11.5px] text-suave lg:col-span-7">
          Tabela {reais(item.valor_tabela)} · {item.valor_unitario > item.valor_tabela ? "+" : ""}{num(((item.valor_unitario - item.valor_tabela) / (item.valor_tabela || 1)) * 100, 1)}%
          <button type="button" className="ml-2 font-semibold text-azul hover:underline" onClick={() => onMudar({ ...item, valor_unitario: item.valor_tabela! })}>usar tabela</button>
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ editor
type Negocio = { id: string; titulo: string; numero: number | null; cliente_id: string | null; cliente_nome: string; projeto_id: string | null };

export function EditorOrcamento({ id, negocioId, onTrocar }: { id?: string | null; negocioId?: string | null; onTrocar: (id: string) => void }) {
  const [o, setO] = useState<Orcamento | null>(null);
  const [cat, setCat] = useState<{ produtos: Produto[]; servicos: Servico[] } | null>(null);
  const [aba, setAba] = useState<TipoItem>("produto");
  const [abaTot, setAbaTot] = useState<"totais" | "pagamento" | "comodato">("totais");
  const [erro, setErro] = useState(""), [aviso, setAviso] = useState(""), [ocupado, setOcupado] = useState("");
  const [sujo, setSujo] = useState(false);
  const [janelaAmb, setJanelaAmb] = useState<null | { modo: "novo" | "editar"; nome: string; original?: string }>(null);
  const [ver, setVer] = useState<Produto | null>(null);
  const [recarga, setRecarga] = useState(0);
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { carregarCatalogo().then(setCat).catch((e) => setErro(mensagemErro(e))); }, []);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        setErro("");
        if (id) { const x = await abrirOrcamento(id); if (vivo) { setO(x); setSujo(false); } return; }
        if (negocioId) {
          const { data, error } = await supabase().from("oportunidades").select("id, titulo, numero, cliente_id, cliente_nome, projeto_id, clientes(nome)").eq("id", negocioId).single();
          if (error) throw error;
          const n: Negocio = { id: data.id, titulo: data.titulo, numero: data.numero, cliente_id: data.cliente_id, projeto_id: data.projeto_id,
            cliente_nome: (data.clientes as unknown as { nome: string } | null)?.nome ?? data.cliente_nome ?? "" };
          if (vivo) { setO(orcamentoVazio(n)); setSujo(false); }
        }
      } catch (e) { if (vivo) setErro(mensagemErro(e)); }
    })();
    return () => { vivo = false; };
  }, [id, negocioId]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 4500); return () => clearTimeout(t); }, [aviso]);
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", f); return () => window.removeEventListener("beforeunload", f);
  }, [sujo]);

  const mudar = (p: Partial<Orcamento>) => { setO((x) => (x ? { ...x, ...p } : x)); setSujo(true); };
  const t = useMemo(() => (o ? calcularTotais(o) : null), [o]);
  if (erro && !o) return <p role="alert" className="rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}</p>;
  if (!o || !cat || !t) return <div className="flex items-center gap-2 py-16 text-suave"><Loader2 className="size-5 animate-spin" />Carregando orçamento e cadastro de produtos…</div>;

  const linhas = o.itens.filter((i) => i.tipo === aba);
  const ambientes = o.ambientes;
  const ambPadrao = ambientes[ambientes.length - 1] ?? "";
  const setItens = (itens: Item[]) => mudar({ itens });
  const trocar = (chave: string, novo: Item) => setItens(o.itens.map((i) => (i.chave === chave ? novo : i)));
  const adicionar = () => setItens([...o.itens, { chave: novaChave(), tipo: aba, produto_id: null, servico_id: null, descricao: "", detalhe: "", sku: "", marca: "", unidade: "Un",
    quantidade: 1, valor_unitario: 0, valor_tabela: null, ambiente: aba === "servico" ? (ambientes.find((a) => /m[ãa]o de obra/i.test(a)) ?? ambPadrao) : ambPadrao }]);
  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const de = o.itens.findIndex((i) => i.chave === e.active.id), para = o.itens.findIndex((i) => i.chave === e.over!.id);
    setItens(arrayMove(o.itens, de, para));
  };
  const somaAba = linhas.reduce((s, i) => s + totalItem(i), 0);

  async function agir(rot: string, f: () => Promise<void>) {
    setErro(""); setOcupado(rot);
    try { await f(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(""); }
  }
  const salvar = () => agir("salvar", async () => {
    if (!o.titulo.trim()) throw new Error("Dê um nome ao orçamento.");
    const vazias = o.itens.filter((i) => !i.descricao.trim());
    const nid = await salvarOrcamento(o);
    setSujo(false);
    setAviso(`Orçamento salvo${vazias.length ? ` (${vazias.length} linha(s) vazia(s) ignorada(s))` : ""}.`);
    if (nid !== o.id) onTrocar(nid); else { setO(await abrirOrcamento(nid)); setRecarga((r) => r + 1); }
  });
  const exportar = () => agir("pdf", async () => {
    const janela = window.open("", "_blank");
    const { gerarPdfOrcamento } = await import("@/lib/orcamento-pdf");
    const fotos = Object.fromEntries(cat.produtos.map((p) => [p.id, p.imagem_path]));
    const pdf = await gerarPdfOrcamento(o, fotos);
    const url = URL.createObjectURL(pdf);
    const nome = `Orçamento ${o.numero || "novo"} | ${o.titulo}.pdf`.replace(/[\\/:*?"<>]+/g, "-");
    if (janela) janela.location.href = url;
    else { const a = document.createElement("a"); a.href = url; a.download = nome; a.click(); }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  });

  const salvarAmbiente = () => {
    if (!janelaAmb) return;
    const nome = janelaAmb.nome.trim();
    if (!nome) return;
    if (janelaAmb.modo === "novo") { if (!ambientes.includes(nome)) mudar({ ambientes: [...ambientes, nome] }); }
    else if (janelaAmb.original) {
      mudar({ ambientes: ambientes.map((a) => (a === janelaAmb.original ? nome : a)).filter((a, k, arr) => arr.indexOf(a) === k),
        itens: o.itens.map((i) => (i.ambiente === janelaAmb.original ? { ...i, ambiente: nome } : i)) });
    }
    setJanelaAmb(null);
  };
  const excluirAmbiente = (nome: string) => {
    const usados = o.itens.filter((i) => i.ambiente === nome).length;
    if (usados && !confirm(`"${nome}" tem ${usados} item(ns). Os itens ficam sem ambiente. Continuar?`)) return;
    mudar({ ambientes: ambientes.filter((a) => a !== nome), itens: o.itens.map((i) => (i.ambiente === nome ? { ...i, ambiente: "" } : i)) });
  };

  const ABAS: [TipoItem, string, typeof Box][] = [["produto", "Produtos", Box], ["servico", "Serviços", Wrench], ["cliente", "Cliente", Users]];
  const contagem = (k: TipoItem) => o.itens.filter((i) => i.tipo === k).length;
  const totalAmb = (a: string) => o.itens.filter((i) => i.ambiente === a).reduce((s, i) => s + totalItem(i), 0);

  return (
    <div className="space-y-4">
      {/* cabeçalho */}
      <section className="sombra-bra overflow-hidden rounded-[18px] border border-linha bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha bg-[#f4f6fb] px-5 py-3.5">
          <h1 className="flex min-w-0 items-center gap-2 font-display text-[17px] font-bold">
            <span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" aria-hidden />
            <span className="truncate">{o.id ? `Edição proposta #${o.numero}` : "Nova proposta"}{o.negocio_titulo ? ` - ${o.negocio_titulo}` : ""}</span>
            {sujo && <span className="shrink-0 rounded-full bg-atencao-claro px-2 py-0.5 text-[11px] font-bold text-atencao">não salvo</span>}
          </h1>
          <div className="flex gap-2">
            {o.oportunidade_id && <Link href={`/crm/?aba=negocios&n=${o.oportunidade_id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3 py-1.5 text-[13px] font-semibold hover:shadow-md"><ArrowLeft className="size-4" />Voltar ao negócio</Link>}
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[260px] flex-1">
              <span className="mb-1 block text-[12px] font-semibold text-suave">* Nome</span>
              <input className={campo} value={o.titulo} onChange={(e) => mudar({ titulo: e.target.value })} placeholder="Ex.: Solução completa - V1" />
            </label>
            <button type="button" onClick={() => setJanelaAmb({ modo: "novo", nome: "" })} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-ciano to-azul px-3.5 py-2 text-[13.5px] font-semibold text-white hover:shadow-lg"><Plus className="size-4" />Novo ambiente</button>
          </div>
          {ambientes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ambientes.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full border border-linha bg-fundo py-0.5 pr-1 pl-3 text-[12.5px] font-semibold">
                  {a}<span className="num ml-1 text-[11.5px] font-normal text-suave">{reais(totalAmb(a))}</span>
                  <button type="button" onClick={() => setJanelaAmb({ modo: "editar", nome: a, original: a })} className="rounded-full p-1 text-azul hover:bg-white" title={`Renomear ${a}`}><Pencil className="size-3" /></button>
                  <button type="button" onClick={() => excluirAmbiente(a)} className="rounded-full p-1 text-erro hover:bg-white" title={`Excluir ${a}`}><Trash2 className="size-3" /></button>
                </span>
              ))}
            </div>
          )}

          {/* abas de itens */}
          <div>
            <div className="flex gap-1 border-b border-linha">
              {ABAS.map(([k, rot, I]) => (
                <button key={k} type="button" onClick={() => setAba(k)} className={`-mb-px flex items-center gap-1.5 rounded-t-xl border px-4 py-2 text-[13.5px] font-semibold ${aba === k ? "border-linha border-b-white bg-white text-azul" : "border-transparent text-suave hover:text-tinta"}`}>
                  <I className="size-4" />{rot}{contagem(k) > 0 && <span className="rounded-full bg-fundo px-1.5 text-[11px] text-suave">{contagem(k)}</span>}
                </button>
              ))}
            </div>
            <div className="rounded-b-xl border border-t-0 border-linha px-3 pb-3 sm:px-4">
              <div className="hidden grid-cols-[22px_minmax(0,1fr)_78px_170px_120px_120px_auto] gap-2 pt-3 pb-1 text-[12px] font-semibold text-suave lg:grid">
                <span /><span>{aba === "servico" ? "Serviço" : "Produto"}</span><span>Quantidade</span><span>Ambiente</span><span>{aba === "cliente" ? "" : "Unitário"}</span><span className="text-right">{aba === "cliente" ? "" : "Total"}</span><span className="w-[124px]" />
              </div>
              <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
                <SortableContext items={linhas.map((i) => i.chave)} strategy={verticalListSortingStrategy}>
                  {linhas.map((i) => (
                    <Linha key={i.chave} item={i} catalogo={cat} ambientes={ambientes}
                      onMudar={(novo) => trocar(i.chave, novo)}
                      onClonar={() => { const k = o.itens.findIndex((x) => x.chave === i.chave); const c = [...o.itens]; c.splice(k + 1, 0, { ...i, chave: novaChave() }); setItens(c); }}
                      onRemover={() => setItens(o.itens.filter((x) => x.chave !== i.chave))}
                      onVer={() => setVer(cat.produtos.find((p) => p.id === i.produto_id) ?? null)} />
                  ))}
                </SortableContext>
              </DndContext>
              {!linhas.length && <p className="py-6 text-center text-[13px] text-suave">{aba === "cliente" ? "Produtos que o cliente fornece (TV, equipamentos já comprados) entram no projeto sem valor." : "Nenhum item ainda."} {!ambientes.length && aba !== "cliente" && "Comece criando os ambientes (Automação, Rede Estruturada…)."}</p>}
              <div className="flex items-center justify-between gap-3 pt-3">
                <button type="button" onClick={adicionar} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-azul px-3.5 py-2 text-[13.5px] font-semibold text-azul hover:bg-[#eef3fb]"><Plus className="size-4" />Adicionar {aba === "servico" ? "serviço" : "produto"}</button>
                {aba !== "cliente" && <span className="num rounded-xl bg-fundo px-3 py-2 text-[14px] font-bold">{reais(somaAba)}</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {erro && <p role="alert" className="rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}</p>}
      {aviso && <p className="rounded-xl bg-ok-claro px-4 py-3 text-[14px] text-ok">{aviso}</p>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        {/* totais */}
        <section className="sombra-bra rounded-[18px] border border-linha bg-white">
          <div className="flex gap-1 border-b border-linha px-3 pt-3">
            {([["totais", "$ Totais"], ["pagamento", "Opções de pagamento"], ["comodato", "Simulação comodato"]] as const).map(([k, rot]) => (
              <button key={k} type="button" onClick={() => setAbaTot(k)} className={`-mb-px rounded-t-xl border px-3.5 py-2 text-[13px] font-semibold ${abaTot === k ? "border-linha border-b-white bg-white text-azul" : "border-transparent text-suave hover:text-tinta"}`}>{rot}</button>
            ))}
          </div>
          {abaTot === "totais" && (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              <Leitura rotulo="Produtos" valor={t.produtos} />
              <Leitura rotulo="Serviços" valor={t.servicos} />
              <Leitura rotulo="Total sem markup" valor={t.semMarkup} />
              <Dupla rotulo="Markup adic. produto">
                <CampoValor ariaLabel="Markup produto (%)" sufixo="%" valor={o.markup_produto_pct || null} onChange={(v) => mudar({ markup_produto_pct: v })} />
                <div className="num rounded-xl bg-fundo px-2.5 py-2 text-right text-[13px] text-suave">{num(t.markupProduto)}</div>
              </Dupla>
              <Dupla rotulo="Markup adic. serviço">
                <CampoValor ariaLabel="Markup serviço (%)" sufixo="%" valor={o.markup_servico_pct || null} onChange={(v) => mudar({ markup_servico_pct: v })} />
                <div className="num rounded-xl bg-fundo px-2.5 py-2 text-right text-[13px] text-suave">{num(t.markupServico)}</div>
              </Dupla>
              <Leitura rotulo="Total sem desconto" valor={t.semDesconto} />
              <Dupla rotulo="Desconto" className="col-span-2">
                <CampoValor ariaLabel="Desconto (%)" sufixo="%" valor={o.desconto_valor ? t.descontoPct : o.desconto_pct} onChange={(v) => mudar({ desconto_pct: v, desconto_valor: null })} />
                <CampoValor ariaLabel="Desconto (R$)" prefixo="R$" valor={t.desconto || null} onChange={(v) => mudar({ desconto_valor: v, desconto_pct: 0 })} />
              </Dupla>
              <div>
                <span className="mb-1 block text-[12px] font-bold text-tinta">$ Total final</span>
                <div className="num rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-3 py-2 text-right text-[15px] font-extrabold text-white">{reais(t.final)}</div>
              </div>
            </div>
          )}
          {abaTot === "pagamento" && (
            <div className="space-y-3 p-4">
              <p className="text-[12.5px] text-suave">Condições de pagamento da venda (saem no PDF com o valor de cada parcela).</p>
              <div className="flex flex-wrap gap-1.5">
                {FORMAS_PAGAMENTO.map((f) => {
                  const on = o.formas_pagamento.includes(f);
                  return <button key={f} type="button" onClick={() => mudar({ formas_pagamento: on ? o.formas_pagamento.filter((x) => x !== f) : FORMAS_PAGAMENTO.filter((x) => x === f || o.formas_pagamento.includes(x)) })}
                    className={`rounded-full border px-2.5 py-1 text-[12.5px] font-semibold ${on ? "border-azul bg-azul text-white" : "border-linha bg-white hover:border-azul"}`}>{f}</button>;
                })}
              </div>
              {o.formas_pagamento.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-linha text-[13px]">
                  <div className="flex items-center gap-1.5 border-b border-linha bg-fundo px-3 py-1.5 text-[12px] font-semibold text-suave"><Calculator className="size-3.5" />Condições calculadas</div>
                  {condicoes(o.formas_pagamento, t.final).map((c) => <div key={c.forma} className="flex justify-between border-t border-linha px-3 py-1.5 first:border-0"><span className="font-semibold">{c.forma}</span><span className="num">{c.texto === c.forma ? reais(c.valor) : c.texto}</span></div>)}
                </div>
              )}
            </div>
          )}
          {abaTot === "comodato" && (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Prazo (meses)</span>
                <select className={campo} value={o.comodato_prazo ?? ""} onChange={(e) => mudar({ comodato_prazo: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Selecionar</option>{[12, 24, 36].map((m) => <option key={m} value={m}>{m}</option>)}
                </select></label>
              <Dupla rotulo="Taxa de instalação"><CampoValor prefixo="R$" valor={o.comodato_taxa} onChange={(v) => mudar({ comodato_taxa: v })} /></Dupla>
              <div><span className="mb-1 block text-[12px] font-semibold text-suave">Mensal</span>
                <div className="num rounded-xl bg-fundo px-3 py-2 text-right text-[14px] font-semibold">{o.comodato_prazo ? reais(Math.max(0, t.final - (o.comodato_taxa ?? 0)) / o.comodato_prazo) : "—"}</div></div>
              <p className="col-span-2 text-[12px] text-suave sm:col-span-3">Simulação simples: (total final − taxa de instalação) ÷ prazo. Não sai no PDF.</p>
            </div>
          )}
        </section>

        {/* condições gerais */}
        <section className="sombra-bra rounded-[18px] border border-linha bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2.5 text-[15px] font-bold"><span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" aria-hidden />Condições da proposta</h2>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Validade (dias)</span>
              <input className={campo} type="number" min={1} value={o.validade_dias} onChange={(e) => mudar({ validade_dias: Number(e.target.value) || 15 })} /></label>
            <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Prazo de entrega</span>
              <input className={campo} value={o.resumo_entrega} onChange={(e) => mudar({ resumo_entrega: e.target.value })} placeholder="Ex.: 45 dias após a aprovação" /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-[12px] font-semibold text-suave">Observações (saem no PDF)</span>
              <textarea className={campo} rows={3} value={o.observacoes} onChange={(e) => mudar({ observacoes: e.target.value })} /></label>
          </div>
        </section>
      </div>

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-linha bg-white/95 px-4 py-3 shadow-[0_12px_30px_-12px_rgba(14,26,61,.35)] backdrop-blur">
        <button type="button" onClick={salvar} disabled={!!ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[14px] font-semibold text-white hover:shadow-lg disabled:opacity-50">
          {ocupado === "salvar" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Salvar</button>
        <button type="button" onClick={exportar} disabled={!!ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-[#d64545] px-4 py-2 text-[14px] font-semibold text-white hover:shadow-lg disabled:opacity-50">
          {ocupado === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}Exportar PDF</button>
        <span className="ml-auto text-[13px] text-suave">{o.itens.length} itens · <b className="num text-tinta">{reais(t.final)}</b></span>
      </div>

      {o.oportunidade_id && <PropostasDoNegocio negocioId={o.oportunidade_id} atual={o.id} onAbrir={onTrocar} recarga={recarga} />}

      <Janela titulo={janelaAmb?.modo === "editar" ? "Renomear ambiente" : "Novo ambiente"} aberto={!!janelaAmb} onFechar={() => setJanelaAmb(null)}
        rodape={<><button type="button" onClick={salvarAmbiente} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-3.5 py-2 text-[13.5px] font-semibold text-white"><Check className="size-4" />Salvar</button></>}>
        {janelaAmb && (
          <div className="space-y-3">
            <input autoFocus className={campo} value={janelaAmb.nome} onChange={(e) => setJanelaAmb({ ...janelaAmb, nome: e.target.value })} onKeyDown={(e) => e.key === "Enter" && salvarAmbiente()} placeholder="Ex.: Home Theater" />
            {janelaAmb.modo === "novo" && (
              <div className="flex flex-wrap gap-1.5">
                {AMBIENTES_SUGERIDOS.filter((a) => !ambientes.includes(a)).map((a) => <button key={a} type="button" onClick={() => setJanelaAmb({ ...janelaAmb, nome: a })} className="rounded-full border border-linha px-2.5 py-1 text-[12.5px] hover:border-azul">{a}</button>)}
              </div>
            )}
          </div>
        )}
      </Janela>

      <Janela titulo={ver ? `${ver.codigo ?? ""} - ${ver.nome}` : ""} aberto={!!ver} onFechar={() => setVer(null)} largura="max-w-2xl">
        {ver && (
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <Miniatura path={ver.imagem_path} className="size-[220px]" />
            <div className="space-y-2 text-[13.5px]">
              <p className="text-suave">{[ver.marca, ver.modelo, ver.categoria].filter(Boolean).join(" • ")}</p>
              <p className="whitespace-pre-line">{ver.descricao || "Sem descrição."}</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-fundo p-3 text-[12.5px]">
                <dt className="text-suave">Venda</dt><dd className="num font-semibold">{reais(ver.preco_venda)}</dd>
                <dt className="text-suave">Custo</dt><dd className="num">{reais(ver.custo)}</dd>
                <dt className="text-suave">Estoque</dt><dd className="num">{ver.saldo.toLocaleString("pt-BR")} {ver.local_estoque && `· ${ver.local_estoque}`}</dd>
                {ver.medidas && <><dt className="text-suave">Medidas</dt><dd>{ver.medidas}</dd></>}
                {ver.fornecedor && <><dt className="text-suave">Fornecedor</dt><dd>{ver.fornecedor}</dd></>}
              </dl>
              <Link href={`/produtos/?id=${ver.id}`} className="inline-block text-[13px] font-semibold text-azul hover:underline">Abrir no cadastro de produtos</Link>
            </div>
          </div>
        )}
      </Janela>
    </div>
  );
}

function Leitura({ rotulo, valor }: { rotulo: string; valor: number }) {
  return <div><span className="mb-1 block text-[12px] font-semibold text-suave">{rotulo}</span><div className="num rounded-xl bg-fundo px-3 py-2 text-right text-[14px] font-semibold">{num(valor)}</div></div>;
}
function Dupla({ rotulo, children, className = "" }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><span className="mb-1 block text-[12px] font-semibold text-suave">{rotulo}</span><div className="grid grid-cols-2 gap-1.5">{children}</div></div>;
}
