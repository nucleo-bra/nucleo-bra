"use client";
// Produtos e estoque: cadastro (o mesmo do Zenith), saldo, valor parado, movimentações.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, ArrowDownLeft, BadgeDollarSign, BookOpen, ArrowUpRight, Box, Check, FileText, LayoutGrid, List, Loader2, MapPin, Package, PackageCheck, PackageX, Plus, Search,
  Pencil, SlidersHorizontal, Trash2, Truck, Upload, Wrench, X,
} from "lucide-react";
import { listarFornecedores, type Fornecedor } from "@/lib/fornecedores";
import { AbaPrecos } from "@/components/estoque/precos";
import { ImportarCatalogo } from "@/components/estoque/importar-catalogo";
import { calcular, formacaoInicial } from "@/lib/precos";
import { Shell } from "@/components/Shell";
import { campo, Janela, reais, Rotulo } from "@/components/crm/ui";
import { mensagemErro } from "@/lib/supabase";
import {
  ajustarEstoque, buscarNoCatalogo, carregarCatalogo, carregarMovimentos, enviarFotoProduto, excluirProduto, excluirServico, salvarServico, fotoProduto, Movimento, movimentarEstoque, Produto, removerFotoProduto, salvarProduto, Servico,
} from "@/lib/orcamentos";
import { usePapel } from "@/lib/usar-papel";

const CATEGORIAS = ["Automação", "Rede", "Áudio/Vídeo", "CFTV", "Controle de acesso", "Infraestrutura", "Geral"];
const UNIDADES = ["Unidade", "Par", "Rolo", "Metro"];
const COR_CAT: Record<string, string> = {
  "Automação": "#2f6fb5", "Rede": "#22c7d6", "Áudio/Vídeo": "#7c5cd6", "CFTV": "#d63a2f", "Controle de acesso": "#f5821f", "Infraestrutura": "#12a150", "Geral": "#66738f",
};
const corCat = (c: string) => COR_CAT[c] ?? "#8a94ab";
const r2 = (v: number) => Math.round(v * 100) / 100;
const qtd = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const curto = (v: number) => v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi` : v >= 1e4 ? `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : reais(v);
const quando = (s: string) => { const d = new Date(s), h = new Date(); const dias = Math.floor((h.getTime() - d.getTime()) / 864e5); return dias < 1 ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : dias < 7 ? `há ${dias} d` : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", ""); };
type Situacao = "ok" | "baixo" | "zero";
// abaixo do mínimo vale também para quem zerou (tem mínimo e precisa repor)
const situacao = (p: Produto): Situacao => p.estoque_minimo > 0 && p.saldo < p.estoque_minimo ? "baixo" : p.saldo <= 0 ? "zero" : "ok";
const SIT: Record<Situacao, { rot: string; cls: string }> = {
  ok: { rot: "em estoque", cls: "bg-ok-claro text-ok" }, baixo: { rot: "abaixo do mínimo", cls: "bg-atencao-claro text-atencao" }, zero: { rot: "sem saldo", cls: "bg-fundo text-suave" },
};
const MOV: Record<Movimento["tipo"], { rot: string; sinal: 1 | -1 | 0; cor: string }> = {
  entrada: { rot: "Entrada", sinal: 1, cor: "text-ok" }, saida: { rot: "Saída", sinal: -1, cor: "text-erro" }, ajuste: { rot: "Saldo", sinal: 1, cor: "text-azul" },
  reserva: { rot: "Reserva", sinal: 0, cor: "text-atencao" }, liberacao: { rot: "Liberação", sinal: 0, cor: "text-suave" },
};

function Foto({ p, className = "size-11" }: { p: Pick<Produto, "imagem_path">; className?: string }) {
  const u = fotoProduto(p.imagem_path);
  // eslint-disable-next-line @next/next/no-img-element
  return u ? <img src={u} alt="" loading="lazy" className={`${className} shrink-0 rounded-lg bg-white object-contain`} /> : <span className={`${className} grid shrink-0 place-items-center rounded-lg bg-fundo text-[#b3bccd]`}><Box className="size-1/3" strokeWidth={1.5} /></span>;
}

// ================================================================== ficha do produto
function FichaProduto({ produto, onFechar, onSalvo, podeEditar }: { produto: Partial<Produto> | null; onFechar: () => void; onSalvo: () => void; podeEditar: boolean }) {
  const [p, setP] = useState<Partial<Produto>>({});
  const [saldo, setSaldo] = useState(0), [obs, setObs] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const diretoria = usePapel() === "diretoria";
  const [hist, setHist] = useState<Movimento[] | null>(null);
  const [mov, setMov] = useState<{ tipo: "entrada" | "saida"; q: string; ref: string; obs: string } | null>(null);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const arq = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setP(produto ?? {}); setSaldo(produto?.saldo ?? 0); setObs(""); setFoto(null); setErro(""); setMov(null); setHist(null);
    if (produto?.id) carregarMovimentos(produto.id, 30).then(setHist).catch(() => setHist([]));
  }, [produto]);
  if (!produto) return null;
  const s = (k: keyof Produto, numero = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setP((x) => ({ ...x, [k]: numero ? Number(e.target.value.replace(",", ".")) || 0 : e.target.value }));
  // mesmo cálculo do Zenith: compra + impostos = custo; custo × multiplicador = venda
  const recalcular = (x: Partial<Produto>) => { const custo = r2((x.valor_compra ?? 0) * (1 + (x.impostos_pct ?? 0) / 100)); return { ...x, custo, preco_venda: r2(custo * (x.fator_venda || 2)) }; };
  const salvar = async () => {
    setErro(""); setOcupado(true);
    try {
      if (!p.nome?.trim()) throw new Error("Informe o nome comercial.");
      const id = await salvarProduto({ ...p, nome: p.nome.trim() });
      if (foto) await enviarFotoProduto(id, foto);
      if (saldo !== (produto.saldo ?? 0)) await ajustarEstoque(id, saldo, produto.saldo ?? 0, obs);
      onSalvo();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  };
  const excluir = async () => {
    if (!produto.id || !confirm(`Excluir "${produto.nome}" de vez, com o histórico de entradas e saídas? Os orçamentos antigos continuam com o nome e o preço do item. Não dá para desfazer.`)) return;
    setErro(""); setOcupado(true);
    try { await excluirProduto(produto.id, produto.imagem_path ?? null); onSalvo(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  };
  const tirarFoto = async () => {
    if (foto) { setFoto(null); return; }
    if (!produto.id || !p.imagem_path || !confirm("Tirar a foto deste produto?")) return;
    setErro(""); setOcupado(true);
    try { await removerFotoProduto(produto.id, p.imagem_path); setP((x) => ({ ...x, imagem_path: null })); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  };
  const lancar = async () => {
    if (!mov || !produto.id) return;
    setErro(""); setOcupado(true);
    try {
      const q = Number(mov.q.replace(",", "."));
      if (mov.tipo === "saida" && q > (produto.saldo ?? 0)) throw new Error(`Saldo atual é ${qtd(produto.saldo ?? 0)}: não dá para tirar ${qtd(q)}.`);
      await movimentarEstoque(produto.id, mov.tipo, q, mov.ref.trim(), mov.obs.trim(), mov.tipo === "entrada" ? (produto.custo ?? null) : null);
      onSalvo();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  };
  const previa = foto ? URL.createObjectURL(foto) : fotoProduto(p.imagem_path);
  const margem = p.custo ? ((p.preco_venda ?? 0) / p.custo - 1) * 100 : null;
  const sit = produto.id ? situacao(produto as Produto) : null;
  return (
    <Janela titulo={produto.id ? `${produto.codigo != null ? `${produto.codigo} · ` : ""}${produto.nome}` : "Novo produto"} aberto onFechar={onFechar} largura="max-w-4xl"
      rodape={podeEditar ? <><button type="button" onClick={salvar} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50">{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Salvar produto</button>{erro && <span className="text-[13px] text-erro">{erro}</span>}
        {produto.id && diretoria && <button type="button" disabled={ocupado} onClick={excluir} className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-erro hover:bg-erro-claro"><Trash2 className="size-4" />Excluir produto</button>}</> : undefined}>
      {produto.id && (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["Saldo", `${qtd(produto.saldo ?? 0)} ${(produto.unidade ?? "un").toLowerCase().slice(0, 3)}.`, sit ? SIT[sit].rot : ""],
            ["Valor parado", reais(Math.max(0, produto.saldo ?? 0) * (produto.custo ?? 0)), "saldo × custo"],
            ["Venda", reais(produto.preco_venda ?? 0), margem != null ? `margem ${margem.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "sem custo"],
            ["Local", produto.local_estoque || "—", produto.estoque_minimo ? `mínimo ${qtd(produto.estoque_minimo)}` : "sem mínimo"],
          ] as const).map(([t, v, d]) => (
            <div key={t} className="rounded-xl bg-fundo/70 px-3.5 py-2.5"><div className="text-[11.5px] font-semibold text-suave">{t}</div><div className="num font-display text-[17px] font-extrabold">{v}</div><div className="truncate text-[11.5px] text-suave">{d}</div></div>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-[170px_1fr]">
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previa ? <img src={previa} alt="" className="aspect-square w-full rounded-xl border border-linha bg-white object-contain p-2" /> : <span className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-linha text-suave"><Box className="size-8" /></span>}
          {podeEditar && <><input ref={arq} type="file" accept="image/*" hidden onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => arq.current?.click()} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-linha px-3 py-1.5 text-[13px] font-semibold hover:shadow-md"><Upload className="size-4" />Trocar foto</button>
            {(foto || p.imagem_path) && <button type="button" onClick={tirarFoto} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold text-suave hover:bg-erro-claro hover:text-erro"><Trash2 className="size-3.5" />Tirar foto</button>}</>}
        </div>
        <fieldset disabled={!podeEditar} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Rotulo rotulo="* Nome comercial (sai no orçamento)" className="col-span-2 sm:col-span-4"><input className={campo} value={p.nome ?? ""} onChange={s("nome")} /></Rotulo>
          <Rotulo rotulo="Fabricante"><input className={campo} value={p.marca ?? ""} onChange={s("marca")} /></Rotulo>
          <Rotulo rotulo="Nome interno / modelo" className="sm:col-span-2"><input className={campo} value={p.modelo ?? ""} onChange={s("modelo")} /></Rotulo>
          <Rotulo rotulo="Categoria"><select className={campo} value={p.categoria ?? ""} onChange={s("categoria")}><option value="">—</option>{[...new Set([...CATEGORIAS, p.categoria].filter(Boolean))].map((c) => <option key={c}>{c}</option>)}</select></Rotulo>
          <Rotulo rotulo="Unidade"><select className={campo} value={p.unidade ?? "Unidade"} onChange={s("unidade")}>{[...new Set([...UNIDADES, p.unidade].filter(Boolean))].map((u) => <option key={u}>{u}</option>)}</select></Rotulo>
          <Rotulo rotulo="Fornecedor"><input className={campo} value={p.fornecedor ?? ""} onChange={s("fornecedor")} /></Rotulo>
          <Rotulo rotulo="Referência"><input className={campo} value={p.referencia ?? ""} onChange={s("referencia")} /></Rotulo>
          <Rotulo rotulo="NCM"><input className={campo} value={p.ncm ?? ""} onChange={s("ncm")} /></Rotulo>
          <Rotulo rotulo="Descrição comercial (sai no orçamento)" className="col-span-2 sm:col-span-4"><textarea className={campo} rows={4} value={p.descricao ?? ""} onChange={s("descricao")} /></Rotulo>
        </fieldset>
      </div>
      <fieldset disabled={!podeEditar}>
        <h3 className="mt-5 mb-2 flex flex-wrap items-baseline gap-2 text-[13px] font-bold">Preço
          {produto.formacao && <span className="text-[12px] font-normal text-suave">definido em detalhe na aba <b className="text-azul">Preços</b> (compra, impostos e margem) — altere por lá</span>}</h3>
        <fieldset disabled={!!produto.formacao} className="contents">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Rotulo rotulo="Valor compra (R$)"><input className={campo} inputMode="decimal" value={p.valor_compra ?? 0} onChange={(e) => setP((x) => recalcular({ ...x, valor_compra: Number(e.target.value.replace(",", ".")) || 0 }))} /></Rotulo>
          <Rotulo rotulo="% impostos"><input className={campo} inputMode="decimal" value={p.impostos_pct ?? 0} onChange={(e) => setP((x) => recalcular({ ...x, impostos_pct: Number(e.target.value.replace(",", ".")) || 0 }))} /></Rotulo>
          <Rotulo rotulo="Custo (R$)"><input className={`${campo} bg-fundo`} readOnly value={reais(p.custo ?? 0)} /></Rotulo>
          <Rotulo rotulo="Multiplicador"><input className={campo} inputMode="decimal" value={p.fator_venda ?? 2} onChange={(e) => setP((x) => recalcular({ ...x, fator_venda: Number(e.target.value.replace(",", ".")) || 0 }))} /></Rotulo>
          <Rotulo rotulo="Valor venda (R$)"><input className={`${campo} font-semibold`} inputMode="decimal" value={p.preco_venda ?? 0} onChange={s("preco_venda", true)} /></Rotulo>
        </div>
        </fieldset>
        <h3 className="mt-5 mb-2 text-[13px] font-bold">Estoque</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Rotulo rotulo="Saldo (inventário)"><input className={campo} type="number" step="any" value={saldo} onChange={(e) => setSaldo(Number(e.target.value) || 0)} /></Rotulo>
          <Rotulo rotulo="Mínimo"><input className={campo} type="number" step="any" value={p.estoque_minimo ?? 0} onChange={s("estoque_minimo", true)} /></Rotulo>
          <Rotulo rotulo="Localização"><input className={campo} value={p.local_estoque ?? ""} onChange={s("local_estoque")} placeholder="Ex.: D2" /></Rotulo>
          {saldo !== (produto.saldo ?? 0) && <Rotulo rotulo="Motivo do ajuste"><input className={campo} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Inventário, conferência…" /></Rotulo>}
        </div>
      </fieldset>

      {produto.id && (
        <section className="mt-6 rounded-2xl border border-linha">
          <header className="flex flex-wrap items-center gap-2 border-b border-linha px-4 py-3">
            <h3 className="flex-1 text-[14px] font-bold">Movimentações do item</h3>
            {podeEditar && <>
              <button type="button" onClick={() => setMov({ tipo: "entrada", q: "", ref: "", obs: "" })} className="inline-flex items-center gap-1 rounded-lg bg-ok-claro px-3 py-1.5 text-[12.5px] font-bold text-ok"><ArrowDownLeft className="size-3.5" />Entrada</button>
              <button type="button" onClick={() => setMov({ tipo: "saida", q: "", ref: "", obs: "" })} className="inline-flex items-center gap-1 rounded-lg bg-erro-claro px-3 py-1.5 text-[12.5px] font-bold text-erro"><ArrowUpRight className="size-3.5" />Saída</button>
            </>}
          </header>
          {mov && (
            <div className="grid gap-2 border-b border-linha bg-fundo/50 px-4 py-3 sm:grid-cols-[110px_1fr_1fr_auto]">
              <input className={campo} inputMode="decimal" autoFocus placeholder="Qtd." value={mov.q} onChange={(e) => setMov({ ...mov, q: e.target.value })} aria-label="Quantidade" />
              <input className={campo} placeholder={mov.tipo === "entrada" ? "NF de compra, fornecedor…" : "Obra / cliente, chamado…"} value={mov.ref} onChange={(e) => setMov({ ...mov, ref: e.target.value })} aria-label="Referência" />
              <input className={campo} placeholder="Observação" value={mov.obs} onChange={(e) => setMov({ ...mov, obs: e.target.value })} aria-label="Observação" />
              <div className="flex gap-1.5">
                <button type="button" onClick={lancar} disabled={ocupado} className={`inline-flex items-center gap-1 rounded-xl px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-50 ${mov.tipo === "entrada" ? "bg-ok" : "bg-erro"}`}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Lançar {mov.tipo === "entrada" ? "entrada" : "saída"}</button>
                <button type="button" onClick={() => setMov(null)} className="rounded-xl p-2 text-suave hover:bg-white" aria-label="Cancelar"><X className="size-4" /></button>
              </div>
            </div>
          )}
          <ul className="max-h-60 divide-y divide-linha overflow-y-auto">
            {!hist ? <li className="px-4 py-4 text-[13px] text-suave">Carregando…</li> : !hist.length ? <li className="px-4 py-4 text-[13px] text-suave">Nenhuma movimentação.</li>
              : hist.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                  <span className={`w-16 shrink-0 text-[12px] font-bold ${MOV[m.tipo].cor}`}>{MOV[m.tipo].rot}</span>
                  <span className={`num w-16 shrink-0 text-right font-bold ${MOV[m.tipo].cor}`}>{MOV[m.tipo].sinal < 0 ? "−" : MOV[m.tipo].sinal > 0 && m.tipo !== "ajuste" ? "+" : ""}{qtd(m.quantidade)}</span>
                  <span className="min-w-0 flex-1 truncate text-suave">{[m.referencia, m.observacao].filter(Boolean).join(" · ") || "—"}</span>
                  <span className="shrink-0 text-[12px] text-suave">{new Date(m.ocorrido_em).toLocaleDateString("pt-BR")}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
      {!podeEditar && erro && <p className="mt-3 text-[13px] text-erro">{erro}</p>}
    </Janela>
  );
}

// ================================================================== tela
type Ordem = "nome" | "codigo" | "saldo" | "valor" | "venda";
type Visao = "grade" | "lista";

function CartaoProduto({ p, abrir }: { p: Produto; abrir: () => void }) {
  const sit = situacao(p), valor = Math.max(0, p.saldo) * p.custo;
  return (
    <button type="button" onClick={abrir} className="group flex flex-col overflow-hidden rounded-[18px] border border-linha bg-white text-left shadow-[0_1px_2px_rgba(16,24,40,.04)] transition hover:-translate-y-0.5 hover:border-[#c9d6ea] hover:shadow-[0_18px_40px_-20px_rgba(14,26,61,.35)]">
      <div className="relative aspect-[4/3] bg-gradient-to-b from-white to-[#f3f6fb] p-4">
        <Foto p={p} className="size-full !bg-transparent" />
        <span className="absolute top-2.5 left-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-bold shadow-sm ring-1 ring-black/5" style={{ color: corCat(p.categoria) }}>{p.categoria || "Sem categoria"}</span>
        <span className={`num absolute top-2.5 right-2.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${SIT[sit].cls}`}>{sit === "baixo" && <AlertTriangle className="mr-0.5 inline size-3" />}{qtd(p.saldo)}</span>
        {!p.descricao && <span title="Sem descrição comercial" className="absolute bottom-2.5 left-2.5 rounded-full bg-atencao-claro p-1 text-atencao"><FileText className="size-3" /></span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3.5 pt-2.5 pb-3">
        <div className="truncate text-[11.5px] font-semibold text-suave">{p.codigo != null ? <span className="num">#{p.codigo}</span> : null}{p.codigo != null && p.marca ? " · " : ""}{p.marca}</div>
        <div className="line-clamp-2 min-h-[2.5em] text-[13.5px] leading-tight font-bold text-tinta group-hover:text-azul">{p.nome}</div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div><div className="num font-display text-[16px] font-extrabold">{reais(p.preco_venda)}</div><div className="num text-[11.5px] text-suave">custo {reais(p.custo)}</div></div>
          {valor > 0 && <div className="text-right"><div className="text-[10.5px] font-semibold text-suave uppercase">parado</div><div className="num text-[12.5px] font-bold text-marinho-900">{curto(valor)}</div></div>}
        </div>
        {p.local_estoque && <div className="flex items-center gap-1 text-[11.5px] text-suave"><MapPin className="size-3" />{p.local_estoque}</div>}
      </div>
    </button>
  );
}

function FichaServico({ servico, podeEditar, onFechar, onSalvo }: { servico: Partial<Servico>; podeEditar: boolean; onFechar: () => void; onSalvo: () => void }) {
  const [x, setX] = useState<Partial<Servico>>(servico);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const diretoria = usePapel() === "diretoria";
  const txt = (v?: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [valorTxt, setValorTxt] = useState(txt(servico.valor)), [custoTxt, setCustoTxt] = useState(txt(servico.custo));
  const num = (t: string) => Number(t.replace(/\s|R\$/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")) || 0;
  const s = (k: keyof Servico) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setX({ ...x, [k]: e.target.value });
  const rodar = async (f: () => Promise<void>) => { setErro(""); setOcupado(true); try { await f(); onSalvo(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); } };
  const margem = x.custo ? ((x.valor ?? 0) / x.custo - 1) * 100 : null;
  return (
    <Janela titulo={servico.id ? `${servico.codigo != null ? `#${servico.codigo} · ` : ""}${servico.nome}` : "Novo serviço"} aberto onFechar={onFechar} largura="max-w-2xl"
      rodape={podeEditar ? <>
        <button type="button" disabled={ocupado} onClick={() => rodar(async () => { if (!x.nome?.trim()) throw new Error("Informe o nome do serviço."); await salvarServico({ ...x, nome: x.nome }); })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50">{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Salvar serviço</button>
        {erro && <span className="text-[13px] text-erro">{erro}</span>}
        {servico.id && diretoria && <button type="button" disabled={ocupado} onClick={() => { if (confirm(`Excluir o serviço "${servico.nome}" de vez? Os orçamentos antigos continuam com o nome e o valor do item.`)) rodar(() => excluirServico(servico.id!)); }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-erro hover:bg-erro-claro"><Trash2 className="size-4" />Excluir serviço</button>}
      </> : undefined}>
      <fieldset disabled={!podeEditar} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Rotulo rotulo="* Nome (sai no orçamento)" className="col-span-2 sm:col-span-4"><input autoFocus className={campo} value={x.nome ?? ""} onChange={s("nome")} /></Rotulo>
        <Rotulo rotulo="Categoria" className="col-span-2"><input className={campo} list="cats-servico" value={x.categoria ?? ""} onChange={s("categoria")} />
          <datalist id="cats-servico">{CATEGORIAS.map((c) => <option key={c} value={c} />)}</datalist></Rotulo>
        <Rotulo rotulo="Cobrança por"><input className={campo} value={x.unidade ?? "Un"} onChange={s("unidade")} placeholder="Un, hora, ponto…" /></Rotulo>
        <Rotulo rotulo="Ativo"><select className={campo} value={x.ativo === false ? "n" : "s"} onChange={(e) => setX({ ...x, ativo: e.target.value === "s" })}><option value="s">Sim, aparece nos orçamentos</option><option value="n">Não</option></select></Rotulo>
        <Rotulo rotulo="Valor (R$)"><input className={`${campo} font-semibold`} inputMode="decimal" value={valorTxt} onChange={(e) => { setValorTxt(e.target.value); setX((v) => ({ ...v, valor: num(e.target.value) })); }} onBlur={() => setValorTxt(txt(num(valorTxt)))} /></Rotulo>
        <Rotulo rotulo="Custo (R$)"><input className={campo} inputMode="decimal" value={custoTxt} onChange={(e) => { setCustoTxt(e.target.value); setX((v) => ({ ...v, custo: num(e.target.value) })); }} onBlur={() => setCustoTxt(txt(num(custoTxt)))} /></Rotulo>
        <div className="col-span-2 flex items-end pb-2 text-[12.5px] text-suave">{margem != null ? <>Margem de <b className="mx-1 text-tinta">{margem.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%</b> sobre o custo</> : "Sem custo informado"}</div>
        <Rotulo rotulo="Descrição comercial (sai no orçamento)" className="col-span-2 sm:col-span-4"><textarea className={campo} rows={6} value={x.descricao ?? ""} onChange={s("descricao")} /></Rotulo>
      </fieldset>
    </Janela>
  );
}

function Conteudo() {
  const params = useSearchParams(), router = useRouter();
  const papelPag = usePapel(), podeEditar = papelPag !== "tecnico", diretoriaPag = papelPag === "diretoria";
  const [cat, setCat] = useState<{ produtos: Produto[]; servicos: Servico[] } | null>(null);
  const [movs, setMovs] = useState<Movimento[] | null>(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<"produtos" | "servicos" | "fornecedores" | "precos">(() => (params.get("aba") === "precos" ? "precos" : "produtos"));
  const [importar, setImportar] = useState(false), [avisoImp, setAvisoImp] = useState("");
  const [forn, setForn] = useState<Fornecedor[] | null>(null);
  const [q, setQ] = useState(""), [categoria, setCategoria] = useState(""), [so, setSo] = useState<"" | Situacao>("");
  const [ordem, setOrdem] = useState<Ordem>("nome");
  const [marca, setMarca] = useState(""), [fornecedor, setFornecedor] = useState(""), [local, setLocal] = useState(""), [foto, setFoto] = useState<"" | "com" | "sem">("");
  const [visao, setVisao] = useState<Visao>(() => { try { return (localStorage.getItem("nucleo-estoque-visao") as Visao) || "grade"; } catch { return "grade"; } });
  const [editar, setEditar] = useState<Partial<Produto> | null>(null);
  const [editarServ, setEditarServ] = useState<Partial<Servico> | null>(null);
  const [pagina, setPagina] = useState(1);
  const recarregar = useCallback((forcar = false) => {
    carregarCatalogo(forcar).then(setCat).catch((e) => setErro(mensagemErro(e)));
    carregarMovimentos(undefined, 12).then(setMovs).catch(() => setMovs([]));
  }, []);
  useEffect(() => { recarregar(); listarFornecedores().then(setForn); }, [recarregar]);
  useEffect(() => { try { localStorage.setItem("nucleo-estoque-visao", visao); } catch { /* sem armazenamento */ } }, [visao]);
  useEffect(() => { const id = params.get("id"); if (id && cat) setEditar(cat.produtos.find((p) => p.id === id) ?? null); }, [params, cat]);
  const campos = useMemo(() => (p: Produto) => `${p.modelo} ${p.marca} ${p.referencia} ${p.fornecedor} ${p.local_estoque}`, []);

  const resumo = useMemo(() => {
    if (!cat) return null;
    const P = cat.produtos, com = P.filter((p) => p.saldo > 0);
    const custo = com.reduce((s, p) => s + p.saldo * p.custo, 0), venda = com.reduce((s, p) => s + p.saldo * p.preco_venda, 0);
    const porCat = new Map<string, { n: number; valor: number; itens: number }>();
    for (const p of P) { const k = p.categoria || "Sem categoria"; const x = porCat.get(k) ?? { n: 0, valor: 0, itens: 0 }; x.n++; if (p.saldo > 0) { x.itens++; x.valor += p.saldo * p.custo; } porCat.set(k, x); }
    return {
      total: P.length, comSaldo: com.length, unidades: com.reduce((s, p) => s + p.saldo, 0), custo, venda,
      baixo: P.filter((p) => situacao(p) === "baixo").length, zero: P.filter((p) => p.saldo <= 0).length,
      semPreco: P.filter((p) => !(calcular(formacaoInicial(p)).preco > 0)).length,
      semFoto: P.filter((p) => !p.imagem_path).length, semDescricao: P.filter((p) => !p.descricao).length,
      porCat: [...porCat].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.valor - a.valor || b.n - a.n),
      top: [...com].sort((a, b) => b.saldo * b.custo - a.saldo * a.custo).slice(0, 5),
    };
  }, [cat]);

  const filtrados = useMemo(() => {
    if (!cat) return [];
    let l = q ? buscarNoCatalogo(cat.produtos, q, campos, 10000) : [...cat.produtos];
    if (categoria) l = l.filter((p) => (p.categoria || "Sem categoria") === categoria);
    if (marca) l = l.filter((p) => (p.marca || "Sem marca") === marca);
    if (fornecedor) l = l.filter((p) => (p.fornecedor || "Sem fornecedor") === fornecedor);
    if (local) l = l.filter((p) => (p.local_estoque || "Sem local") === local);
    if (foto) l = l.filter((p) => (foto === "com") === !!p.imagem_path);
    if (so) l = l.filter((p) => so === "ok" ? p.saldo > 0 : so === "zero" ? p.saldo <= 0 : situacao(p) === so);
    if (!q || ordem !== "nome") {
      const f: Record<Ordem, (a: Produto, b: Produto) => number> = {
        nome: (a, b) => a.nome.localeCompare(b.nome), codigo: (a, b) => (a.codigo ?? 1e9) - (b.codigo ?? 1e9), saldo: (a, b) => b.saldo - a.saldo,
        valor: (a, b) => Math.max(0, b.saldo) * b.custo - Math.max(0, a.saldo) * a.custo, venda: (a, b) => b.preco_venda - a.preco_venda,
      };
      l.sort(f[ordem]);
    }
    return l;
  }, [cat, q, categoria, so, ordem, campos, marca, fornecedor, local, foto]);
  useEffect(() => setPagina(1), [q, categoria, so, ordem, marca, fornecedor, local, foto]);
  // opções dos filtros, com quantos itens cada uma tem
  const opcoes = useMemo(() => {
    const conta = (f: (p: Produto) => string) => { const m = new Map<string, number>(); for (const p of cat?.produtos ?? []) { const k = f(p); m.set(k, (m.get(k) ?? 0) + 1); } return [...m].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")); };
    return { marcas: conta((p) => p.marca?.trim() || "Sem marca"), fornecedores: conta((p) => p.fornecedor?.trim() || "Sem fornecedor"), locais: conta((p) => p.local_estoque?.trim() || "Sem local") };
  }, [cat]);
  const POR = visao === "grade" ? 40 : 60;
  const filtroAtivo = !!(q || categoria || so || marca || fornecedor || local || foto);
  const limparFiltros = () => { setQ(""); setCategoria(""); setSo(""); setMarca(""); setFornecedor(""); setLocal(""); setFoto(""); };

  return (
    <Shell titulo="Produtos e estoque" cheio>
      <div className="min-w-0 px-4 pt-5 pb-16 lg:px-9 lg:pt-7">
        {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}</p>}
        {!cat || !resumo ? <div className="flex items-center gap-2 py-16 text-suave"><Loader2 className="size-5 animate-spin" />Carregando estoque…</div> : (<>
          {/* cabeçalho */}
          <section className="relative mb-5 overflow-hidden rounded-[22px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul p-5 text-white shadow-[0_24px_50px_-24px_rgba(14,26,61,.8)] lg:p-7">
            <div className="pointer-events-none absolute -top-28 -right-24 size-96 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.28),transparent_70%)]" aria-hidden />
            <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
            <div className="relative flex flex-wrap items-end justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 text-[11.5px] font-semibold tracking-[.16em] text-ciano uppercase"><Package className="size-4" />Estoque BRA</div>
                <div className="mt-1 text-[13px] text-white/70">Valor em estoque (a custo)</div>
                <div className="num font-display text-[34px] leading-none font-extrabold tracking-tight lg:text-[44px]">{reais(resumo.custo)}</div>
                <div className="mt-1.5 text-[13.5px] text-white/75">vale <b className="text-white">{reais(resumo.venda)}</b> a preço de venda · <b className="text-white">{qtd(resumo.unidades)}</b> unidades em <b className="text-white">{resumo.comSaldo}</b> itens</div>
              </div>
              {podeEditar && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditar({ unidade: "Unidade", fator_venda: 2, impostos_pct: 0, ativo: true, saldo: 0 })} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13.5px] font-semibold text-marinho-900 hover:shadow-lg"><Plus className="size-4" />Novo produto</button>
                </div>
              )}
            </div>
            <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ["Itens cadastrados", resumo.total.toLocaleString("pt-BR"), `${cat.servicos.length} serviços`, () => { setSo(""); setCategoria(""); }],
                ["Com saldo", resumo.comSaldo.toLocaleString("pt-BR"), `${Math.round((resumo.comSaldo / Math.max(1, resumo.total)) * 100)}% do cadastro`, () => setSo(so === "ok" ? "" : "ok")],
                ["Abaixo do mínimo", resumo.baixo.toLocaleString("pt-BR"), resumo.baixo ? "repor" : "tudo certo", () => setSo(so === "baixo" ? "" : "baixo")],
                ["Sem saldo", resumo.zero.toLocaleString("pt-BR"), "itens zerados", () => setSo(so === "zero" ? "" : "zero")],
              ] as const).map(([t, v, d, f]) => (
                <button key={t} type="button" onClick={f} className="rounded-2xl bg-white/[.08] px-4 py-3 text-left ring-1 ring-white/10 transition hover:bg-white/[.14]">
                  <div className="text-[11.5px] font-semibold text-white/65">{t}</div>
                  <div className="num font-display text-[22px] font-extrabold">{v}</div>
                  <div className="truncate text-[11.5px] text-white/55">{d}</div>
                </button>
              ))}
            </div>
          </section>

          {/* composição + movimentações */}
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <section className="sombra-bra min-w-0 rounded-[18px] border border-linha bg-white p-5">
              <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-bold">Onde está o dinheiro</h2><span className="text-[12px] text-suave">valor a custo por categoria</span></div>
              <ul className="space-y-2.5">
                {resumo.porCat.map((c) => {
                  const pct = resumo.custo ? (c.valor / resumo.custo) * 100 : 0, ativo = categoria === c.k;
                  return (
                    <li key={c.k}>
                      <button type="button" onClick={() => setCategoria(ativo ? "" : c.k)} className={`w-full rounded-xl px-2 py-1.5 text-left transition ${ativo ? "bg-fundo ring-1 ring-linha" : "hover:bg-fundo/60"}`}>
                        <div className="mb-1 flex items-baseline gap-2 text-[13px]">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: corCat(c.k) }} />
                          <span className="flex-1 truncate font-semibold">{c.k}</span>
                          <span className="text-[12px] text-suave">{c.itens}/{c.n} itens</span>
                          <span className="num w-24 text-right font-bold">{curto(c.valor)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-fundo"><div className="h-full rounded-full" style={{ width: `${Math.max(pct, c.valor ? 1.5 : 0)}%`, background: corCat(c.k) }} /></div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {resumo.top.length > 0 && (
                <div className="mt-5 border-t border-linha pt-4">
                  <div className="mb-2 text-[12px] font-bold tracking-wide text-suave uppercase">Maior valor parado</div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {resumo.top.map((p) => (
                      <button key={p.id} type="button" onClick={() => setEditar(p)} className="flex w-56 shrink-0 items-center gap-2.5 rounded-xl border border-linha p-2 text-left hover:border-azul">
                        <Foto p={p} className="size-11" />
                        <div className="min-w-0"><div className="truncate text-[12.5px] font-semibold">{p.nome}</div><div className="num text-[12px] text-suave">{qtd(p.saldo)} × {reais(p.custo)}</div><div className="num text-[12.5px] font-bold">{reais(p.saldo * p.custo)}</div></div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
            <section className="sombra-bra flex min-w-0 flex-col rounded-[18px] border border-linha bg-white">
              <div className="flex items-center justify-between border-b border-linha px-5 py-3.5"><h2 className="text-[15px] font-bold">Últimas movimentações</h2><span className="text-[12px] text-suave">entradas, saídas e saldos</span></div>
              <ul className="min-h-0 flex-1 divide-y divide-linha overflow-y-auto xl:max-h-[360px]">
                {!movs ? <li className="px-5 py-4 text-[13px] text-suave">Carregando…</li> : !movs.length ? <li className="px-5 py-6 text-[13px] text-suave">Nenhuma movimentação ainda.</li>
                  : movs.map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => { const p = cat.produtos.find((x) => x.id === m.produto_id); if (p) setEditar(p); }} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-fundo/50">
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${m.tipo === "entrada" ? "bg-ok-claro text-ok" : m.tipo === "saida" ? "bg-erro-claro text-erro" : "bg-[#e8f0fa] text-azul"}`}>
                          {m.tipo === "entrada" ? <ArrowDownLeft className="size-4" /> : m.tipo === "saida" ? <ArrowUpRight className="size-4" /> : <PackageCheck className="size-4" />}
                        </span>
                        <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold">{m.produto?.nome ?? "Produto"}</div><div className="truncate text-[12px] text-suave">{MOV[m.tipo].rot}{m.referencia ? ` · ${m.referencia}` : ""}</div></div>
                        <div className="text-right"><div className={`num text-[13px] font-bold ${MOV[m.tipo].cor}`}>{m.tipo === "saida" ? "−" : m.tipo === "entrada" ? "+" : ""}{qtd(m.quantidade)}</div><div className="text-[11px] text-suave">{quando(m.ocorrido_em)}</div></div>
                      </button>
                    </li>
                  ))}
              </ul>
              {(resumo.semFoto > 0 || resumo.semDescricao > 0) && (
                <div className="border-t border-linha px-5 py-3 text-[12.5px] text-suave">
                  Cadastro: <b className="text-tinta">{resumo.semFoto}</b> sem foto · <b className="text-tinta">{resumo.semDescricao}</b> sem descrição comercial
                </div>
              )}
            </section>
          </div>

          {/* catálogo */}
          <section className="sombra-bra min-w-0 rounded-[18px] border border-linha bg-white">
            <div className="sticky top-[60px] z-10 space-y-3 rounded-t-[18px] border-b border-linha bg-white/95 px-4 pt-3 pb-3 backdrop-blur lg:top-0">
              <div className="flex flex-wrap items-center gap-2">
                {([["produtos", "Produtos", Package, cat.produtos.length], ["servicos", "Serviços", Wrench, cat.servicos.length], ["fornecedores", "Fornecedores", Truck, forn?.length ?? 0], ["precos", "Preços", BadgeDollarSign, cat.produtos.length]] as const).map(([k, rot, I, n]) => (
                  <button key={k} type="button" onClick={() => setAba(k)} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold ${aba === k ? "bg-marinho-900 text-white" : "bg-fundo text-suave hover:text-tinta"}`}><I className="size-4" />{rot}<span className={`num rounded-md px-1.5 text-[11.5px] ${aba === k ? "bg-white/15" : "bg-white"}`}>{n}</span></button>
                ))}
                {(aba === "produtos" || aba === "precos") && <>
                  <div className="relative min-w-[200px] flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" /><input className={`${campo} pl-9`} placeholder="Código, nome, modelo, fabricante, local…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                  <label className="relative inline-flex items-center"><SlidersHorizontal className="pointer-events-none absolute left-3 size-4 text-suave" />
                    <select className={`${campo} w-auto pl-9`} value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar">
                      <option value="nome">Nome</option><option value="codigo">Código</option><option value="saldo">Maior saldo</option><option value="valor">Maior valor parado</option><option value="venda">Maior preço</option>
                    </select></label>
                  {aba === "produtos" && <div className="inline-flex rounded-xl bg-fundo p-1" role="group" aria-label="Visualização">
                    <button type="button" onClick={() => setVisao("grade")} className={`rounded-lg p-1.5 ${visao === "grade" ? "bg-white text-azul shadow-sm" : "text-suave"}`} aria-label="Grade"><LayoutGrid className="size-4" /></button>
                    <button type="button" onClick={() => setVisao("lista")} className={`rounded-lg p-1.5 ${visao === "lista" ? "bg-white text-azul shadow-sm" : "text-suave"}`} aria-label="Lista"><List className="size-4" /></button>
                  </div>}
                </>}
              </div>
              {(aba === "produtos" || aba === "precos") && (
                <div className="flex flex-wrap items-center gap-2">
                  {([["Marca", marca, setMarca, opcoes.marcas], ["Fornecedor", fornecedor, setFornecedor, opcoes.fornecedores], ["Local no estoque", local, setLocal, opcoes.locais]] as const).map(([rot, v, set, ops]) => (
                    <select key={rot} value={v} onChange={(e) => set(e.target.value)} aria-label={rot}
                      className={`max-w-[200px] min-w-0 flex-1 rounded-xl border px-3 py-1.5 text-[13px] font-semibold sm:flex-none ${v ? "border-azul bg-[#eef3fb] text-azul" : "border-linha bg-white text-suave"}`}>
                      <option value="">{rot}: todos</option>
                      {ops.map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}
                    </select>
                  ))}
                  <select value={foto} onChange={(e) => setFoto(e.target.value as typeof foto)} aria-label="Foto"
                    className={`rounded-xl border px-3 py-1.5 text-[13px] font-semibold ${foto ? "border-azul bg-[#eef3fb] text-azul" : "border-linha bg-white text-suave"}`}>
                    <option value="">Foto: todos</option><option value="com">Com foto</option><option value="sem">Sem foto</option>
                  </select>
                  {filtroAtivo && <button type="button" onClick={limparFiltros} className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[13px] font-semibold text-azul hover:bg-fundo"><X className="size-3.5" />Limpar filtros</button>}
                  <span className="ml-auto text-[12.5px] text-suave"><b className="num text-tinta">{filtrados.length.toLocaleString("pt-BR")}</b> de {cat.produtos.length.toLocaleString("pt-BR")} itens</span>
                </div>
              )}
              {(aba === "produtos" || aba === "precos") && (
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                  {([["", "Todos", resumo.total], ["ok", "Com saldo", resumo.comSaldo], ["baixo", "Abaixo do mínimo", resumo.baixo], ["zero", "Sem saldo", resumo.zero]] as const).map(([k, r, n]) => (
                    <button key={r} type="button" onClick={() => setSo(k)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold ${so === k ? "border-marinho-900 bg-marinho-900 text-white" : "border-linha text-suave hover:text-tinta"}`}>
                      {k === "baixo" ? <AlertTriangle className="size-3.5" /> : k === "zero" ? <PackageX className="size-3.5" /> : k === "ok" ? <PackageCheck className="size-3.5" /> : null}{r}<span className="num opacity-70">{n}</span>
                    </button>
                  ))}
                  <span className="mx-1 w-px shrink-0 bg-linha" />
                  {resumo.porCat.map((c) => (
                    <button key={c.k} type="button" onClick={() => setCategoria(categoria === c.k ? "" : c.k)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold ${categoria === c.k ? "border-transparent text-white" : "border-linha text-suave hover:text-tinta"}`} style={categoria === c.k ? { background: corCat(c.k) } : undefined}>
                      <span className="size-2 rounded-full" style={{ background: categoria === c.k ? "#fff" : corCat(c.k) }} />{c.k}<span className="num opacity-70">{c.n}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {aba === "precos" ? (
              <AbaPrecos produtos={filtrados} total={cat.produtos.length} podeEditar={podeEditar} diretoria={diretoriaPag} onSalvo={() => recarregar(true)}
                acoesExtra={<>
                  {avisoImp && <span className="inline-flex items-center rounded-xl bg-ok-claro px-3 py-1.5 text-[13px] font-semibold text-ok">✓ {avisoImp}</span>}
                  {podeEditar && <button type="button" onClick={() => setImportar(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-marinho-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:shadow-md"><BookOpen className="size-4" />Puxar dos catálogos</button>}
                </>} />
            ) : aba === "produtos" ? (<>
              {!filtrados.length ? (
                <div className="px-6 py-14 text-center text-suave"><Package className="mx-auto mb-2 size-7" strokeWidth={1.5} />Nenhum produto com esse filtro.{filtroAtivo && <button type="button" onClick={limparFiltros} className="ml-1 font-semibold text-azul hover:underline">Limpar filtros</button>}</div>
              ) : visao === "grade" ? (
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {filtrados.slice(0, pagina * POR).map((p) => <CartaoProduto key={p.id} p={p} abrir={() => setEditar(p)} />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] text-[13.5px]">
                    <thead><tr className="border-b border-linha text-left text-[11.5px] font-bold tracking-wide text-suave uppercase">
                      <th className="px-4 py-2.5">Produto</th><th className="px-2 py-2.5">Categoria</th><th className="px-2 py-2.5">Saldo</th>
                      <th className="px-2 py-2.5 text-right">Custo</th><th className="px-2 py-2.5 text-right">Venda</th><th className="px-2 py-2.5 text-right">Margem</th><th className="px-4 py-2.5 text-right">Parado</th>
                    </tr></thead>
                    <tbody>
                      {filtrados.slice(0, pagina * POR).map((p) => {
                        const sit = situacao(p), ref = Math.max(p.estoque_minimo * 2, p.saldo, 1), margem = p.custo ? (p.preco_venda / p.custo - 1) * 100 : null;
                        return (
                          <tr key={p.id} onClick={() => setEditar(p)} className="cursor-pointer border-b border-linha last:border-0 hover:bg-fundo/50">
                            <td className="px-4 py-2"><div className="flex items-center gap-3"><Foto p={p} className="size-11 border border-linha" /><div className="min-w-0"><div className="truncate font-semibold">{p.nome}</div><div className="truncate text-[12px] text-suave">{p.codigo != null && <span className="num">#{p.codigo} · </span>}{[p.marca, p.modelo !== p.nome ? p.modelo : ""].filter(Boolean).join(" · ")}</div></div></div></td>
                            <td className="px-2 py-2"><span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: corCat(p.categoria) }}><span className="size-2 rounded-full" style={{ background: corCat(p.categoria) }} />{p.categoria || "—"}</span></td>
                            <td className="w-40 px-2 py-2">
                              <div className="flex items-center gap-2"><span className={`num w-10 text-right font-bold ${sit === "baixo" ? "text-atencao" : sit === "zero" ? "text-suave" : ""}`}>{qtd(p.saldo)}</span>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fundo"><div className={`h-full rounded-full ${sit === "baixo" ? "bg-atencao" : "bg-ok"}`} style={{ width: `${Math.min(100, (Math.max(0, p.saldo) / ref) * 100)}%` }} /></div></div>
                              {p.local_estoque && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-suave"><MapPin className="size-3" />{p.local_estoque}</div>}
                            </td>
                            <td className="num px-2 py-2 text-right text-suave">{reais(p.custo)}</td>
                            <td className="num px-2 py-2 text-right font-bold">{reais(p.preco_venda)}</td>
                            <td className="num px-2 py-2 text-right text-suave">{margem != null ? `${margem.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%` : "—"}</td>
                            <td className="num px-4 py-2 text-right font-semibold">{p.saldo > 0 ? reais(p.saldo * p.custo) : <span className="text-suave">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-linha px-4 py-3 text-[13px] text-suave">
                <span>{Math.min(filtrados.length, pagina * POR).toLocaleString("pt-BR")} de {filtrados.length.toLocaleString("pt-BR")} produto(s)</span>
                {filtrados.length > pagina * POR && <button type="button" onClick={() => setPagina(pagina + 1)} className="rounded-xl border border-linha px-4 py-1.5 font-semibold text-azul hover:border-azul">Mostrar mais</button>}
              </div>
            </>) : aba === "fornecedores" ? (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {(forn ?? []).map((f) => {
                  const n = cat.produtos.filter((p) => p.fornecedor && p.fornecedor.toLowerCase().includes(f.nome_fantasia.toLowerCase())).length;
                  const local = [f.cidade, f.uf].filter(Boolean).join(" / ");
                  return (
                    <div key={f.id} className="flex flex-col rounded-[18px] border border-linha p-4">
                      <div className="mb-2 flex items-center gap-2.5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f0fa] font-display text-[15px] font-extrabold text-azul">{f.nome_fantasia.slice(0, 1).toUpperCase()}</span>
                        <div className="min-w-0"><div className="truncate text-[14px] font-bold">{f.nome_fantasia}</div>{f.razao_social && f.razao_social !== f.nome_fantasia && <div className="truncate text-[12px] text-suave">{f.razao_social}</div>}</div></div>
                      <dl className="space-y-0.5 text-[12.5px] text-suave">
                        {f.cnpj && <div className="num">CNPJ {f.cnpj}</div>}
                        {local && <div className="flex items-center gap-1"><MapPin className="size-3" />{local}</div>}
                        {(f.telefone || f.whatsapp || f.email) && <div className="truncate">{[f.vendedor, f.telefone || f.whatsapp, f.email].filter(Boolean).join(" · ")}</div>}
                      </dl>
                      {n > 0 && <button type="button" onClick={() => { const nm = f.nome_fantasia.toLowerCase(); const op = opcoes.fornecedores.find(([k]) => k.toLowerCase().includes(nm)); limparFiltros(); if (op) setFornecedor(op[0]); else setQ(f.nome_fantasia); setAba("produtos"); }} className="mt-auto self-start pt-3 text-[12px] font-semibold text-azul hover:underline">Ver {n} produto(s) →</button>}
                    </div>
                  );
                })}
                {!forn?.length && <p className="px-4 py-6 text-center text-suave sm:col-span-2 xl:col-span-3">Nenhum fornecedor cadastrado.</p>}
              </div>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {podeEditar && (
                  <button type="button" onClick={() => setEditarServ({ unidade: "Un", valor: 0, custo: 0, ativo: true })} className="flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-[18px] border-2 border-dashed border-linha p-4 text-[14px] font-semibold text-azul hover:border-azul hover:bg-[#eef3fb]"><Plus className="size-5" />Novo serviço</button>
                )}
                {cat.servicos.map((s) => (
                  <button type="button" key={s.id} onClick={() => setEditarServ(s)} className={`group flex flex-col rounded-[18px] border border-linha p-4 text-left transition hover:-translate-y-0.5 hover:border-azul hover:shadow-[0_12px_28px_-14px_rgba(14,26,61,.45)] ${s.ativo ? "" : "opacity-60"}`}>
                    <div className="mb-1 flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#e8f0fa] text-azul"><Wrench className="size-4" /></span><span className="num text-[12px] font-semibold text-suave">#{s.codigo ?? "—"}</span><span className="ml-auto text-[12px] font-semibold text-suave">{s.categoria}</span></div>
                    <div className="text-[14px] font-bold">{s.nome}</div>
                    {s.descricao && <p className="mt-1 line-clamp-4 text-[12.5px] whitespace-pre-line text-suave">{s.descricao}</p>}
                    <div className="mt-auto flex items-end justify-between pt-3"><span className="text-[12px] text-suave">por {s.unidade}{!s.ativo && " · inativo"}</span>
                      <span className="flex items-center gap-2">{podeEditar && <Pencil className="size-3.5 text-suave opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100" />}<span className="num font-display text-[17px] font-extrabold">{reais(s.valor)}</span></span></div>
                  </button>
                ))}
                {!cat.servicos.length && <p className="px-4 py-6 text-center text-suave">Nenhum serviço cadastrado.</p>}
              </div>
            )}
          </section>
        </>)}
      </div>
      <ImportarCatalogo aberto={importar} produtos={cat?.produtos ?? []} onFechar={() => setImportar(false)}
        onImportado={(n) => { setImportar(false); setAvisoImp(`${n} produto(s) puxados do catálogo, sem preço`); setSo(""); recarregar(true); }} />
      {editarServ && <FichaServico key={editarServ.id ?? "novo"} servico={editarServ} podeEditar={podeEditar} onFechar={() => setEditarServ(null)} onSalvo={() => { setEditarServ(null); recarregar(true); }} />}
      <FichaProduto produto={editar} podeEditar={podeEditar} onFechar={() => { setEditar(null); if (params.get("id")) router.replace("/produtos/"); }} onSalvo={() => { setEditar(null); recarregar(true); }} />
    </Shell>
  );
}
export default function ProdutosPagina() { return <Suspense><Conteudo /></Suspense>; }
