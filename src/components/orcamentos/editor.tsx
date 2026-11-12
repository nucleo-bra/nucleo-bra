"use client";
// Editor de orçamento no mesmo formato do Zenith: nome + ambientes, abas
// Produtos / Serviços / Cliente com linhas (produto, quantidade, ambiente,
// unitário, total), Totais com markup e desconto, condições de pagamento,
// Salvar e Exportar (PDF) — e, embaixo, as propostas do negócio.
import { marcarPendente } from "@/lib/atualizar";
import { ehErroDeRede } from "@/lib/offline";
import { CampoCliente } from "@/components/clientes/campo-cliente";
import { acharPorNome, carregarClientesFicha } from "@/lib/cliente-busca";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle, ArrowLeft, Box, Calculator, Check, ChevronDown, Copy, FileDown, GripVertical, Image as ImageIcon, Loader2, Pencil, Plus, RefreshCw, Save,
  Search, TextCursorInput, Trash2, TrendingUp, Users, Wrench, X,
} from "lucide-react";
import { campo, Janela, reais } from "@/components/crm/ui";
import { mensagemErro, supabase } from "@/lib/supabase";
import {
  abrirOrcamento, fichaDe, nomeDoCliente, AMBIENTES_SUGERIDOS, buscarNoCatalogo, calcularTotais, carregarCatalogo, condicoes, FORMAS_PAGAMENTO, fotoProduto, Item,
  ehAmbienteDeServico, itemAvulso, itemDeProduto, ordenarAmbientes, itemDeServico, lerNumeroBr, novaChave, Orcamento, orcamentoVazio, pendencias, Produto, rentabilidade, salvarOrcamento, Servico, TipoItem, totalItem,
} from "@/lib/orcamentos";
import { PropostasDoNegocio } from "./lista";

const num = (v: number, casas = 2) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const lerNum = lerNumeroBr;

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

function Seletor<T extends { id: string; codigo: number | null; nome: string }>({ valor, lista, campos, linha, placeholder, onEscolher, abrirJa = false, onAvulso, jaUsado }: {
  valor: React.ReactNode | null; lista: T[]; campos: (x: T) => string; linha: (x: T) => React.ReactNode; placeholder: string; onEscolher: (x: T) => void;
  /** abre a busca assim que a linha nasce (botão "Adicionar") */
  abrirJa?: boolean;
  /** usar o texto digitado como item fora do cadastro */
  onAvulso?: (texto: string) => void;
  /** quantas unidades deste item já estão no orçamento */
  jaUsado?: (x: T) => number;
}) {
  const [aberto, setAberto] = useState(abrirJa), [termo, setTermo] = useState(""), [ativo, setAtivo] = useState(0);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null), painel = useRef<HTMLDivElement>(null);
  const achados = useMemo(() => (aberto ? buscarNoCatalogo(lista, termo, campos, 80) : []), [aberto, lista, termo, campos]);
  // a lista abre por cima de tudo (fora das abas), para baixo ou para cima conforme o espaço, e rola por dentro
  const posicionar = useCallback(() => {
    const r = caixa.current?.getBoundingClientRect(); if (!r) return;
    const largura = Math.min(660, window.innerWidth - 24), left = Math.max(12, Math.min(r.left, window.innerWidth - largura - 12));
    const abaixo = window.innerHeight - r.bottom - 12, acima = r.top - 12;
    setPos(abaixo >= 320 || abaixo >= acima ? { left, top: r.bottom + 4, width: largura, maxH: Math.max(200, abaixo) } : { left, bottom: window.innerHeight - r.top + 4, width: largura, maxH: Math.max(200, acima) });
  }, []);
  useEffect(() => {
    if (!aberto) return;
    posicionar();
    const fora = (e: MouseEvent) => { const t = e.target as Node; if (!caixa.current?.contains(t) && !painel.current?.contains(t)) setAberto(false); };
    const rolou = (e: Event) => { if (painel.current?.contains(e.target as Node)) return; posicionar(); };
    document.addEventListener("mousedown", fora); window.addEventListener("scroll", rolou, true); window.addEventListener("resize", posicionar);
    return () => { document.removeEventListener("mousedown", fora); window.removeEventListener("scroll", rolou, true); window.removeEventListener("resize", posicionar); };
  }, [aberto, posicionar]);
  const escolher = (x: T) => { onEscolher(x); setAberto(false); setTermo(""); };
  const avulso = () => { if (onAvulso && termo.trim()) { onAvulso(termo.trim()); setAberto(false); setTermo(""); } };
  return (
    <div ref={caixa} className="relative min-w-0">
      <button type="button" onClick={() => { setAberto(!aberto); setAtivo(0); }} className="flex min-h-[58px] w-full items-center gap-2 rounded-xl border border-linha bg-white px-2.5 py-1.5 text-left hover:border-azul">
        <span className="min-w-0 flex-1">{valor ?? <span className="text-[13.5px] text-suave">{placeholder}</span>}</span>
        <ChevronDown className="size-4 shrink-0 text-suave" />
      </button>
      {aberto && pos && createPortal(
        <div ref={painel} style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH }}
          className="z-[70] flex flex-col overflow-hidden rounded-xl border border-linha bg-white text-tinta ">
          <div className="flex shrink-0 items-center gap-2 border-b border-linha px-3 py-2">
            <Search className="size-4 text-suave" />
            <input autoFocus className="w-full bg-transparent text-[14px] outline-none" placeholder="Código, nome, modelo ou fabricante" value={termo}
              onChange={(e) => { setTermo(e.target.value); setAtivo(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, achados.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
                else if (e.key === "Enter" && achados[ativo]) { e.preventDefault(); escolher(achados[ativo]); }
                else if (e.key === "Enter" && !achados.length) { e.preventDefault(); avulso(); }
                else if (e.key === "Escape") setAberto(false);
              }} />
            <span className="shrink-0 text-[11.5px] text-suave">{achados.length}{achados.length === 80 ? "+" : ""}</span>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
            {achados.map((x, k) => (
              <li key={x.id}><button type="button" onMouseEnter={() => setAtivo(k)} onClick={() => escolher(x)} className={`relative w-full px-3 py-1.5 text-left ${k === ativo ? "bg-[#eef3fb]" : ""}`}>
                {linha(x)}
                {jaUsado && jaUsado(x) > 0 && <span className="absolute top-1 right-3 rounded-full bg-azul/10 px-1.5 text-[10.5px] font-semibold text-azul">já no orçamento · {jaUsado(x).toLocaleString("pt-BR")}</span>}
              </button></li>
            ))}
            {!achados.length && <li className="px-3 py-4 text-center text-[13px] text-suave">Nada encontrado no cadastro.</li>}
          </ul>
          {onAvulso && termo.trim().length >= 2 && (
            <button type="button" onClick={avulso} className="flex shrink-0 items-center gap-2 border-t border-linha px-3 py-2.5 text-left text-[13px] font-semibold text-azul hover:bg-fundo">
              <TextCursorInput className="size-4" />Lançar “{termo.trim()}” como item avulso (fora do cadastro)
            </button>
          )}
        </div>, document.body)}
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
        {p.preco_venda > 0 ? <span className="num block text-[12.5px] font-bold text-tinta">{reais(p.preco_venda)}</span> : <span className="block text-[11.5px] font-semibold text-erro">sem preço</span>}
        <span className="block text-[11px] text-suave">{({ Unidade: "Un", Par: "Pr", Rolo: "Rl", Metro: "m" } as Record<string, string>)[p.unidade] ?? p.unidade}{p.saldo != null ? ` · est. ${p.saldo.toLocaleString("pt-BR")}` : ""}</span>
      </span>
    </span>
  );
}

// ------------------------------------------------------------------ linha da tabela
function Linha({ item, catalogo, ambientes, onMudar, onClonar, onRemover, onVer, onTexto, abrirJa, jaUsado }: {
  item: Item; catalogo: { produtos: Produto[]; servicos: Servico[] }; ambientes: string[];
  onMudar: (i: Item) => void; onClonar: () => void; onRemover: () => void; onVer: () => void; onTexto: () => void; abrirJa: boolean;
  jaUsado: (tipo: "p" | "s", id: string) => number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.chave });
  const prod = item.produto_id ? catalogo.produtos.find((p) => p.id === item.produto_id) : null;
  const serv = item.servico_id ? catalogo.servicos.find((s) => s.id === item.servico_id) : null;
  const camposP = useCallback((p: Produto) => `${p.modelo} ${p.marca} ${p.referencia} ${p.categoria}`, []);
  const camposS = useCallback((s: Servico) => `${s.categoria} ${s.descricao}`, []);
  const ativosP = useMemo(() => catalogo.produtos.filter((p) => p.ativo), [catalogo.produtos]);
  const ativosS = useMemo(() => catalogo.servicos.filter((x) => x.ativo), [catalogo.servicos]);
  const custo = item.tipo === "servico" ? serv?.custo ?? null : prod?.custo ?? null;
  const abaixoCusto = item.tipo !== "cliente" && custo != null && custo > 0 && item.valor_unitario > 0 && item.valor_unitario < custo;
  const semPreco = item.tipo !== "cliente" && !!item.descricao && !(item.valor_unitario > 0);
  const avulsoDe = (texto: string) => onMudar({ ...itemAvulso(item.tipo, texto, item.ambiente), chave: item.chave, quantidade: item.quantidade || 1 });
  const valorAtual = item.tipo === "servico"
    ? (serv || item.descricao ? <span className="block truncate text-[13px] font-semibold">{serv?.codigo != null ? `${serv.codigo} - ` : ""}{serv?.nome ?? item.descricao}<span className="block truncate text-[11.5px] font-normal text-suave">{(serv?.descricao ?? item.detalhe).slice(0, 90)}</span></span> : null)
    : prod ? <CartaoProduto p={prod} compacto />
      : item.descricao ? <span className="block truncate text-[13px] font-semibold">{item.descricao}<span className="block text-[11.5px] font-normal text-suave">item avulso (fora do cadastro){item.marca ? ` · ${item.marca}` : ""}</span></span> : null;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`grid grid-cols-[22px_minmax(0,1fr)] items-center gap-x-2 gap-y-2 border-b border-linha py-2.5 last:border-0 lg:grid-cols-[22px_minmax(0,1fr)_78px_170px_120px_120px_auto] ${isDragging ? "relative z-10 bg-white shadow-lg" : ""}`}>
      <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none text-suave hover:text-azul" aria-label="Arrastar para reordenar"><GripVertical className="size-4" /></button>
      {item.tipo === "servico"
        ? <Seletor lista={ativosS} campos={camposS} valor={valorAtual} placeholder="Buscar serviço" abrirJa={abrirJa} onAvulso={avulsoDe} jaUsado={(s) => jaUsado("s", s.id)}
            linha={(s) => <span className="block"><span className="block truncate text-[13px] font-semibold">{s.codigo} - {s.nome}</span><span className="block truncate text-[11.5px] text-suave">{s.categoria} · {reais(s.valor)}</span></span>}
            onEscolher={(s) => onMudar({ ...itemDeServico(s, item.ambiente), chave: item.chave, quantidade: item.quantidade || 1, valor_unitario: s.valor || item.valor_unitario })} />
        : <Seletor lista={ativosP} campos={camposP} valor={valorAtual} placeholder="Buscar produto" abrirJa={abrirJa} onAvulso={avulsoDe} jaUsado={(p) => jaUsado("p", p.id)}
            linha={(p) => <CartaoProduto p={p} />}
            onEscolher={(p) => onMudar({ ...itemDeProduto(p, item.ambiente), tipo: item.tipo, chave: item.chave, quantidade: item.quantidade || 1 })} />}
      <div className="col-span-2 grid grid-cols-2 gap-2 sm:grid-cols-[72px_minmax(0,170px)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:col-span-5 lg:grid-cols-subgrid">
        <CampoValor ariaLabel="Quantidade" valor={item.quantidade} casas={item.quantidade % 1 ? 2 : 0} onChange={(v) => onMudar({ ...item, quantidade: v })} />
        <select aria-label="Ambiente" className={`${campo} ${!item.ambiente && item.descricao ? "!border-atencao" : ""}`} value={item.ambiente} onChange={(e) => onMudar({ ...item, ambiente: e.target.value })}>
          <option value="">Selecionar</option>{ambientes.map((a) => <option key={a}>{a}</option>)}
        </select>
        {item.tipo === "cliente"
          ? <span className="col-span-2 self-center text-[12px] text-suave sm:col-span-2">Fornecido pelo cliente</span>
          : <>
              <CampoValor ariaLabel="Valor unitário" prefixo="R$" valor={item.valor_unitario} onChange={(v) => onMudar({ ...item, valor_unitario: Math.max(0, v) })} className={semPreco || abaixoCusto ? "[&_input]:!border-erro" : ""} />
              <div className="num flex items-center justify-end rounded-xl bg-fundo px-3 py-2 text-[14px] font-semibold" aria-label="Total da linha">{reais(totalItem(item))}</div>
            </>}
        <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
          {item.descricao && <button type="button" onClick={onTexto} title="Editar o texto que sai no PDF" className="rounded-lg border border-linha p-2 text-azul hover:bg-fundo"><Pencil className="size-4" /></button>}
          {item.tipo !== "servico" && prod && <button type="button" onClick={onVer} title="Ver produto" className="rounded-lg border border-linha p-2 text-azul hover:bg-fundo"><ImageIcon className="size-4" /></button>}
          <button type="button" onClick={onClonar} title="Clonar linha" className="rounded-lg border border-linha p-2 text-azul hover:bg-fundo"><Copy className="size-4" /></button>
          <button type="button" onClick={onRemover} title="Remover linha" className="rounded-lg border border-linha p-2 text-erro hover:bg-erro-claro"><X className="size-4" /></button>
        </div>
      </div>
      {(semPreco || abaixoCusto) && (
        <p className="col-span-2 -mt-1 flex items-center justify-end gap-1 text-[11.5px] font-semibold text-erro lg:col-span-7">
          <AlertTriangle className="size-3.5" />{semPreco ? "Sem valor: informe o preço de venda." : `Abaixo do custo (${reais(custo!)}).`}
        </p>
      )}
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
  const [filtroAmb, setFiltroAmb] = useState("");
  const [abrirChave, setAbrirChave] = useState<string | null>(null);
  const [texto, setTexto] = useState<null | { chave: string; descricao: string; detalhe: string }>(null);
  const salvarRef = useRef<() => void>(() => {});
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => { carregarCatalogo().then(setCat).catch((e) => setErro(mensagemErro(e))); }, []);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        setErro("");
        if (id) { const x = await abrirOrcamento(id); if (vivo) { setO(x); setSujo(false); } return; }
        if (negocioId) {
          let { data, error } = await supabase().from("oportunidades").select("id, titulo, numero, cliente_id, cliente_nome, projeto_id, clientes(*)").eq("id", negocioId).single();
          if (error && ehErroDeRede(error)) {
            // sem internet: o negócio vem da cópia do CRM guardada no aparelho
            const { carregarCrm } = await import("@/lib/crm");
            const k = (await carregarCrm()).negocios.find((x) => x.id === negocioId);
            if (!k) throw error;
            data = { id: k.id, titulo: k.titulo, numero: k.numero, cliente_id: k.cliente_id, cliente_nome: k.cliente_nome, projeto_id: null, clientes: null } as unknown as typeof data;
            error = null;
          }
          if (error || !data) throw error;
          const n: Negocio = { id: data.id, titulo: data.titulo, numero: data.numero, cliente_id: data.cliente_id, projeto_id: data.projeto_id,
            cliente_nome: (data.clientes as unknown as { nome: string } | null)?.nome ?? data.cliente_nome ?? "" };
          if (vivo) { setO({ ...orcamentoVazio(n), cliente_ficha: fichaDe(data.clientes) }); setSujo(false); }
        }
      } catch (e) { if (vivo) setErro(mensagemErro(e)); }
    })();
    return () => { vivo = false; };
  }, [id, negocioId]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 4500); return () => clearTimeout(t); }, [aviso]);
  // sem cliente ligado: procura no cadastro pelo nome (para o aceite sair com CPF/CNPJ, e-mail e endereço)
  const semFicha = !!o && !o.cliente_ficha && !!nomeDoCliente(o);
  useEffect(() => {
    if (!semFicha) return;
    carregarClientesFicha().then((L) => setO((x) => {
      const k = x ? acharPorNome(L, nomeDoCliente(x)) : null;
      return x && k ? { ...x, cliente_id: x.cliente_id ?? k.id, cliente_ficha: { nome: k.nome, documento: k.documento, email: k.email, telefone: k.telefone, endereco: k.endereco } } : x;
    })).catch(() => {});
  }, [semFicha]);
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", f); marcarPendente(true);
    return () => { window.removeEventListener("beforeunload", f); marcarPendente(false); };
  }, [sujo]);

  // Ctrl+S / ⌘S salva
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); salvarRef.current(); } };
    window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f);
  }, []);

  const mudar = (p: Partial<Orcamento>) => { setO((x) => (x ? { ...x, ...p } : x)); setSujo(true); };
  const t = useMemo(() => (o ? calcularTotais(o) : null), [o]);
  const custoDe = useCallback((i: Item) => {
    if (!cat) return null;
    if (i.tipo === "servico") return i.servico_id ? cat.servicos.find((x) => x.id === i.servico_id)?.custo ?? null : null;
    return i.produto_id ? cat.produtos.find((x) => x.id === i.produto_id)?.custo ?? null : null;
  }, [cat]);
  const rent = useMemo(() => (o && cat ? rentabilidade(o, custoDe) : null), [o, cat, custoDe]);
  const pend = useMemo(() => (o && cat ? pendencias(o, custoDe) : []), [o, cat, custoDe]);
  if (erro && !o) return <p role="alert" className="rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}</p>;
  if (!o || !cat || !t || !rent) return <div className="flex items-center gap-2 py-16 text-suave"><Loader2 className="size-5 animate-spin" />Carregando orçamento e cadastro de produtos…</div>;

  // mão de obra / serviços ficam sempre por último
  const ambientes = ordenarAmbientes(o.ambientes, o.itens.filter((i) => i.descricao.trim())).filter((a) => o.ambientes.includes(a));
  const filtro = filtroAmb && ambientes.includes(filtroAmb) ? filtroAmb : "";
  const linhas = o.itens.filter((i) => i.tipo === aba && (!filtro || i.ambiente === filtro));
  const ambPadrao = filtro || ([...ambientes].reverse().find((a) => !ehAmbienteDeServico(a, o.itens)) ?? ambientes[ambientes.length - 1] ?? "");
  const jaUsado = (tipo: "p" | "s", id: string) => o.itens.filter((i) => (tipo === "p" ? i.produto_id === id : i.servico_id === id)).reduce((s, i) => s + (i.quantidade || 0), 0);
  // preços que mudaram no cadastro depois que o item entrou no orçamento
  const desatualizados = o.itens.filter((i) => {
    if (i.tipo === "cliente" || i.valor_tabela == null) return false;
    const atual = i.tipo === "servico" ? cat.servicos.find((x) => x.id === i.servico_id)?.valor : cat.produtos.find((x) => x.id === i.produto_id)?.preco_venda;
    return atual != null && atual > 0 && Math.abs(atual - i.valor_tabela) > 0.005;
  });
  const atualizarPrecos = () => setItens(o.itens.map((i) => {
    if (!desatualizados.includes(i)) return i;
    const atual = (i.tipo === "servico" ? cat.servicos.find((x) => x.id === i.servico_id)?.valor : cat.produtos.find((x) => x.id === i.produto_id)?.preco_venda) ?? i.valor_unitario;
    // se o item estava no preço de tabela, acompanha; se foi negociado, mantém o valor e só atualiza a referência
    return { ...i, valor_unitario: Math.abs(i.valor_unitario - (i.valor_tabela ?? 0)) < 0.005 ? atual : i.valor_unitario, valor_tabela: atual };
  }));
  const setItens = (itens: Item[]) => mudar({ itens });
  const trocar = (chave: string, novo: Item) => setItens(o.itens.map((i) => (i.chave === chave ? novo : i)));
  const adicionar = () => {
    const chave = novaChave();
    setAbrirChave(chave);
    setItens([...o.itens, { chave, tipo: aba, produto_id: null, servico_id: null, descricao: "", detalhe: "", sku: "", marca: "", unidade: "Un",
      quantidade: 1, valor_unitario: 0, valor_tabela: null, ambiente: aba === "servico" && !filtro ? (ambientes.find((a) => ehAmbienteDeServico(a, o.itens)) ?? ambPadrao) : ambPadrao }]);
  };
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
  /** grava e devolve o orçamento como ficou no banco (número, data e totais oficiais) */
  async function gravar(): Promise<Orcamento> {
    if (!o) throw new Error("Nada para salvar.");
    if (!o.titulo.trim()) throw new Error("Dê um nome ao orçamento.");
    const ignoradas = o.itens.filter((i) => !i.descricao.trim() || !(i.quantidade > 0)).length;
    const nid = await salvarOrcamento(o);
    setSujo(false);
    setAviso(`Orçamento salvo${ignoradas ? ` (${ignoradas} linha(s) vazia(s) ou sem quantidade ignorada(s))` : ""}.`);
    const salvo = await abrirOrcamento(nid);
    if (nid !== o.id) onTrocar(nid); else { setO(salvo); setRecarga((r) => r + 1); }
    return salvo;
  }
  const salvar = () => agir("salvar", async () => { await gravar(); });
  salvarRef.current = () => { if (!ocupado) salvar(); };
  // o PDF sai sempre do orçamento salvo (com número e totais oficiais)
  const exportar = () => agir("pdf", async () => {
    const janela = window.open("", "_blank");
    try {
      const final = sujo || !o.id ? await gravar() : o;
      const { gerarPdfOrcamento } = await import("@/lib/orcamento-pdf");
      const fotos = Object.fromEntries(cat.produtos.map((p) => [p.id, p.imagem_path]));
      const pdf = await gerarPdfOrcamento(final, fotos);
      const url = URL.createObjectURL(pdf);
      const nome = `Orçamento ${final.numero || "novo"} | ${final.titulo}.pdf`.replace(/[\\/:*?"<>]+/g, "-");
      if (janela) janela.location.href = url;
      else { const a = document.createElement("a"); a.href = url; a.download = nome; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (e) { janela?.close(); throw e; }
  });
  const salvarTexto = () => {
    if (!texto) return;
    setItens(o.itens.map((i) => (i.chave === texto.chave ? { ...i, descricao: texto.descricao.trim() || i.descricao, detalhe: texto.detalhe } : i)));
    setTexto(null);
  };

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
            
            <span className="truncate">{o.id ? `Edição proposta #${o.numero}` : "Nova proposta"}{o.negocio_titulo ? ` - ${o.negocio_titulo}` : ""}</span>
            {sujo && <span className="shrink-0 rounded-full bg-atencao-claro px-2 py-0.5 text-[11px] font-bold text-atencao">não salvo</span>}
          </h1>
          <div className="flex gap-2">
            {o.oportunidade_id && <Link href={`/crm/?aba=negocios&n=${o.oportunidade_id}`} scroll onClick={(e) => { if (sujo && !confirm("Há alterações não salvas neste orçamento. Sair mesmo assim?")) e.preventDefault(); }} className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3 py-1.5 text-[13px] font-semibold hover:shadow-md"><ArrowLeft className="size-4" />Voltar ao negócio</Link>}
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[260px] flex-1">
              <span className="mb-1 block text-[12px] font-semibold text-suave">* Nome</span>
              <input className={campo} value={o.titulo} onChange={(e) => mudar({ titulo: e.target.value })} placeholder="Ex.: Solução completa - V1" />
            </label>
            <label className="block min-w-[240px] flex-1">
              <span className="mb-1 block text-[12px] font-semibold text-suave">Cliente</span>
              <CampoCliente className={campo} valor={o.cliente_nome} vinculado={!!o.cliente_ficha} onChange={(v) => mudar({ cliente_nome: v, cliente_ficha: null })}
                onEscolher={(k) => mudar({ cliente_id: k.id, cliente_nome: k.nome, cliente_ficha: { nome: k.nome, documento: k.documento, email: k.email, telefone: k.telefone, endereco: k.endereco } })} />
            </label>
            <button type="button" onClick={() => setJanelaAmb({ modo: "novo", nome: "" })} className="inline-flex items-center gap-1.5 rounded-xl bg-azul hover:bg-azul-escuro px-3.5 py-2 text-[13.5px] font-semibold text-white hover:shadow-lg"><Plus className="size-4" />Novo ambiente</button>
          </div>
          {o.cliente_ficha && (o.cliente_ficha.documento || o.cliente_ficha.email || o.cliente_ficha.endereco) && (
            <p className="-mt-2 text-[12px] text-suave">Do cadastro (sai no aceite): {[o.cliente_ficha.documento && `CPF/CNPJ ${o.cliente_ficha.documento}`, o.cliente_ficha.email, o.cliente_ficha.telefone, o.cliente_ficha.endereco].filter(Boolean).join(" · ")}</p>
          )}
          {!ambientes.length && (
            <div className="rounded-xl border border-dashed border-azul/40 bg-azul/5 px-3.5 py-3">
              <p className="mb-2 text-[13px] font-semibold">Comece pelos ambientes / sistemas do projeto:</p>
              <div className="flex flex-wrap gap-1.5">
                {AMBIENTES_SUGERIDOS.map((a) => <button key={a} type="button" onClick={() => mudar({ ambientes: [...o.ambientes, a] })} className="inline-flex items-center gap-1 rounded-full border border-linha bg-white px-2.5 py-1 text-[12.5px] font-semibold hover:border-azul"><Plus className="size-3" />{a}</button>)}
              </div>
            </div>
          )}
          {ambientes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setFiltroAmb("")} className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${!filtro ? "border-azul bg-azul text-white" : "border-linha bg-white hover:border-azul"}`}>Todos</button>
              {ambientes.map((a) => (
                <span key={a} className={`inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-[12.5px] font-semibold ${filtro === a ? "border-azul bg-azul/10" : "border-linha bg-fundo"}`}>
                  <button type="button" onClick={() => setFiltroAmb(filtro === a ? "" : a)} title={`Ver só ${a}`} className="inline-flex items-center">{a}<span className="num ml-1.5 text-[11.5px] font-normal text-suave">{reais(totalAmb(a))}</span></button>
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
                    <Linha key={i.chave} item={i} catalogo={cat} ambientes={ambientes} abrirJa={abrirChave === i.chave} jaUsado={jaUsado}
                      onTexto={() => setTexto({ chave: i.chave, descricao: i.descricao, detalhe: i.detalhe })}
                      onMudar={(novo) => { if (abrirChave === i.chave) setAbrirChave(null); trocar(i.chave, novo); }}
                      onClonar={() => { const k = o.itens.findIndex((x) => x.chave === i.chave); const c = [...o.itens]; c.splice(k + 1, 0, { ...i, chave: novaChave() }); setItens(c); }}
                      onRemover={() => setItens(o.itens.filter((x) => x.chave !== i.chave))}
                      onVer={() => setVer(cat.produtos.find((p) => p.id === i.produto_id) ?? null)} />
                  ))}
                </SortableContext>
              </DndContext>
              {!linhas.length && <p className="py-6 text-center text-[13px] text-suave">{filtro ? `Nada em ${filtro} nesta aba. ` : ""}{aba === "cliente" ? "Produtos que o cliente fornece (TV, equipamentos já comprados) entram no projeto sem valor." : "Nenhum item ainda."} {!ambientes.length && aba !== "cliente" && "Comece criando os ambientes (Automação, Rede Estruturada…)."}</p>}
              <div className="flex items-center justify-between gap-3 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={adicionar} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-azul px-3.5 py-2 text-[13.5px] font-semibold text-azul hover:bg-[#eef3fb]"><Plus className="size-4" />Adicionar {aba === "servico" ? "serviço" : "produto"}{filtro ? ` em ${filtro}` : ""}</button>
                  {desatualizados.length > 0 && <button type="button" onClick={atualizarPrecos} title="Preços do cadastro mudaram desde que os itens entraram no orçamento" className="inline-flex items-center gap-1.5 rounded-xl border border-atencao/40 bg-atencao-claro px-3 py-2 text-[12.5px] font-semibold text-atencao"><RefreshCw className="size-3.5" />Atualizar {desatualizados.length} preço(s) do cadastro</button>}
                </div>
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
                <div className="num rounded-xl bg-azul px-3 py-2 text-right text-[15px] font-extrabold text-white">{reais(t.final)}</div>
              </div>
              <div className="col-span-2 rounded-xl border border-linha bg-fundo/60 p-3 sm:col-span-3">
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-suave"><TrendingUp className="size-3.5" />Rentabilidade · só você vê, não sai no PDF</div>
                <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
                  <div><span className="block text-[11.5px] text-suave">Custo</span><b className="num">{reais(rent.custo)}</b></div>
                  <div><span className="block text-[11.5px] text-suave">Lucro bruto</span><b className={`num ${rent.lucro < 0 ? "text-erro" : "text-ok"}`}>{reais(rent.lucro)}</b></div>
                  <div><span className="block text-[11.5px] text-suave">Margem</span><b className={`num ${rent.margemPct < 0 ? "text-erro" : ""}`}>{num(rent.margemPct, 1)}%</b></div>
                  <div><span className="block text-[11.5px] text-suave">Multiplicador</span><b className="num">{rent.markup ? `${num(rent.markup, 2)}×` : "—"}</b></div>
                </div>
                {rent.semCusto > 0 && <p className="mt-2 text-[11.5px] text-atencao">{rent.semCusto} item(ns) sem custo cadastrado ficaram fora da conta.</p>}
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
          <h2 className="mb-3 flex items-center gap-2.5 text-[15px] font-bold">Condições da proposta</h2>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Validade (dias)</span>
              <input className={campo} type="number" min={1} value={o.validade_dias || ""} onChange={(e) => mudar({ validade_dias: Math.max(0, Math.round(Number(e.target.value) || 0)) })} onBlur={() => { if (!o.validade_dias) mudar({ validade_dias: 15 }); }} /></label>
            <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Prazo de entrega</span>
              <input className={campo} value={o.resumo_entrega} onChange={(e) => mudar({ resumo_entrega: e.target.value })} placeholder="Ex.: 45 dias após a aprovação" /></label>
            <label className="block sm:col-span-2"><span className="mb-1 block text-[12px] font-semibold text-suave">Observações (saem no PDF)</span>
              <textarea className={campo} rows={3} value={o.observacoes} onChange={(e) => mudar({ observacoes: e.target.value })} /></label>
          </div>
        </section>
      </div>

      {pend.length > 0 && (
        <div className="rounded-[18px] border border-atencao/30 bg-atencao-claro/60 px-4 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-atencao"><AlertTriangle className="size-4" />Confira antes de enviar ao cliente</p>
          <ul className="space-y-0.5 text-[13px]">{pend.map((p, k) => <li key={k} className={p.tipo === "erro" ? "text-erro" : "text-tinta/80"}>• {p.texto}</li>)}</ul>
        </div>
      )}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-linha bg-white/95 px-4 py-3  backdrop-blur">
        <button type="button" onClick={salvar} disabled={!!ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-azul hover:bg-azul-escuro px-4 py-2 text-[14px] font-semibold text-white hover:shadow-lg disabled:opacity-50">
          {ocupado === "salvar" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Salvar<span className="hidden text-[11px] font-normal opacity-70 sm:inline">⌘S</span></button>
        <button type="button" onClick={exportar} disabled={!!ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff3b30] px-4 py-2 text-[14px] font-semibold text-white hover:shadow-lg disabled:opacity-50">
          {ocupado === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}Exportar PDF</button>
        <span className="ml-auto text-[13px] text-suave">{o.itens.filter((i) => i.descricao.trim()).length} itens · <b className="num text-tinta">{reais(t.final)}</b></span>
      </div>

      {o.oportunidade_id && <PropostasDoNegocio negocioId={o.oportunidade_id} atual={o.id} onAbrir={onTrocar} recarga={recarga} />}

      <Janela titulo={janelaAmb?.modo === "editar" ? "Renomear ambiente" : "Novo ambiente"} aberto={!!janelaAmb} onFechar={() => setJanelaAmb(null)}
        rodape={<><button type="button" onClick={salvarAmbiente} className="inline-flex items-center gap-1.5 rounded-xl bg-azul hover:bg-azul-escuro px-3.5 py-2 text-[13.5px] font-semibold text-white"><Check className="size-4" />Salvar</button></>}>
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

      <Janela titulo="Texto do item no PDF" aberto={!!texto} onFechar={() => setTexto(null)} largura="max-w-xl"
        rodape={<button type="button" onClick={salvarTexto} className="inline-flex items-center gap-1.5 rounded-xl bg-azul px-3.5 py-2 text-[13.5px] font-semibold text-white hover:bg-azul-escuro"><Check className="size-4" />Aplicar</button>}>
        {texto && (
          <div className="space-y-3">
            <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Nome do item</span>
              <input autoFocus className={campo} value={texto.descricao} onChange={(e) => setTexto({ ...texto, descricao: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Descrição (aparece abaixo do nome no PDF)</span>
              <textarea className={campo} rows={6} value={texto.detalhe} onChange={(e) => setTexto({ ...texto, detalhe: e.target.value })} placeholder="Especificação, funções, garantia…" /></label>
            <p className="text-[12px] text-suave">Muda só neste orçamento. O cadastro do produto continua igual.</p>
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
