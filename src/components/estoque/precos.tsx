"use client";
// Aba Preços do estoque: formação de preço detalhada de cada produto (compra,
// impostos, frete, créditos, impostos da venda, comissões, taxas, despesas e
// margem), edição rápida em tabela e ações em lote sobre o que está filtrado.
import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, Check, ChevronDown, ChevronRight, Download, Info, Loader2, Percent, RotateCcw, Save, Settings2, Sparkles, X } from "lucide-react";
import { Janela, reais } from "@/components/crm/ui";
import type { Produto } from "@/lib/orcamentos";
import { fotoProduto } from "@/lib/orcamentos";
import { calcular, CAMPOS_COMPRA, CAMPOS_VENDA, CampoFormacao, Formacao, formacaoInicial, Padroes, TODOS_CAMPOS } from "@/lib/precos";
import { carregarPadroes, salvarFormacoes, salvarPadroes } from "@/lib/precos-db";
import { mensagemErro } from "@/lib/supabase";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const txt = (v: number | undefined, casas = 2) => (v == null || !Number.isFinite(v) ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas }));
const lerNum = (t: string): number | undefined => {
  const s = t.replace(/\s|R\$|%/g, "");
  if (!s) return undefined;
  const n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
};

/** Campo numérico no formato brasileiro; vazio = usa o padrão (mostrado em cinza). */
function Num({ valor, padrao, onChange, rs = false, className = "", forte = false, aria }: {
  valor: number | undefined; padrao?: number; onChange: (v: number | undefined) => void; rs?: boolean; className?: string; forte?: boolean; aria: string;
}) {
  const [t, setT] = useState(txt(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setT(txt(valor)); }, [valor, foco]);
  return (
    <div className={`relative ${className}`}>
      {rs && <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[11.5px] text-suave">R$</span>}
      <input value={t} inputMode="decimal" aria-label={aria}
        placeholder={padrao != null && Number.isFinite(padrao) ? txt(padrao) : "0"}
        onFocus={() => setFoco(true)} onBlur={() => { setFoco(false); setT(txt(lerNum(t))); }}
        onChange={(e) => { setT(e.target.value); onChange(lerNum(e.target.value)); }}
        className={`num w-full rounded-lg border bg-white py-1.5 text-right text-[13px] outline-none focus:border-azul focus:shadow-[0_0_0_3px_rgba(47,111,181,.18)] ${rs ? "pl-7 pr-2" : "pl-2 pr-6"} ${valor != null ? "border-linha text-tinta" : "border-dashed border-linha text-suave"} ${forte ? "font-bold" : ""}`} />
      {!rs && <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11.5px] text-suave">%</span>}
    </div>
  );
}

function Foto({ p }: { p: Produto }) {
  const u = fotoProduto(p.imagem_path);
  // eslint-disable-next-line @next/next/no-img-element
  return u ? <img src={u} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg border border-linha bg-white object-contain" /> : <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-fundo text-[11px] font-bold text-suave">{(p.marca || p.nome).slice(0, 2).toUpperCase()}</span>;
}

const ROT = Object.fromEntries(TODOS_CAMPOS.map((c) => [c.k, c.rot])) as Record<CampoFormacao, string>;

// ------------------------------------------------------------------ detalhe de um produto
function Detalhe({ f, padroes, podeEditar, mudar }: { f: Formacao; padroes: Padroes; podeEditar: boolean; mudar: (f: Formacao) => void }) {
  const c = calcular(f, padroes);
  const campo = (k: CampoFormacao, rs = false) => (
    <Num aria={ROT[k]} valor={f[k]} padrao={padroes[k]} rs={rs} onChange={(v) => mudar({ ...f, [k]: v })} className="w-28 shrink-0" />
  );
  const linha = (rot: string, v: number, sinal: "+" | "−" | "=" = "+", forte = false) => (
    <div className={`flex items-baseline justify-between gap-3 py-1 text-[13px] ${forte ? "border-t border-linha pt-2 font-bold" : ""}`}>
      <span className={forte ? "" : "text-suave"}>{sinal !== "=" && <span className="mr-1 inline-block w-3 text-center">{sinal}</span>}{rot}</span>
      <span className="num">{reais(v)}</span>
    </div>
  );
  const grupo = (g: { grupo: string; campos: { k: CampoFormacao; rot: string; ajuda: string; rs?: boolean }[] }) => (
    <div key={g.grupo} className="mb-3">
      <div className="mb-1.5 text-[11.5px] font-bold tracking-wide text-suave uppercase">{g.grupo}</div>
      <div className="space-y-1.5">
        {g.campos.map((x) => (
          <label key={x.k} className="flex items-center gap-2" title={x.ajuda}>
            <span className="min-w-0 flex-1 text-[13px]">{x.rot}<span className="ml-1 hidden text-[11.5px] text-suave xl:inline">· {x.ajuda.split(" (")[0].slice(0, 60)}</span></span>
            {campo(x.k, x.rs)}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <fieldset disabled={!podeEditar} className="grid gap-5 border-t border-linha bg-[#f7f9fc] px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
      {/* compra */}
      <div className="min-w-0">
        <h4 className="mb-2 flex items-center gap-1.5 text-[13.5px] font-bold"><Download className="size-4 text-azul" />Compra — o que o item custa para a BRA</h4>
        <label className="mb-3 flex items-center gap-2">
          <span className="flex-1 text-[13px] font-semibold">Preço do fornecedor (tabela)</span>
          <Num aria="Preço do fornecedor" valor={f.preco_fornecedor} rs forte onChange={(v) => mudar({ ...f, preco_fornecedor: v })} className="w-36" />
        </label>
        {CAMPOS_COMPRA.map(grupo)}
      </div>
      {/* venda */}
      <div className="min-w-0">
        <h4 className="mb-2 flex items-center gap-1.5 text-[13.5px] font-bold"><Percent className="size-4 text-azul" />Venda — o que sai do preço (% do preço de venda)</h4>
        {CAMPOS_VENDA.map(grupo)}
        <div className="rounded-xl border border-linha bg-white p-3">
          <div className="mb-2 inline-flex rounded-lg bg-fundo p-1 text-[12.5px] font-semibold">
            <button type="button" onClick={() => mudar({ ...f, modo: "margem" })} className={`rounded-md px-2.5 py-1 ${f.modo !== "manual" ? "bg-marinho-900 text-white" : "text-suave"}`}>Calcular pela margem</button>
            <button type="button" onClick={() => mudar({ ...f, modo: "manual", preco_manual: f.preco_manual ?? c.preco })} className={`rounded-md px-2.5 py-1 ${f.modo === "manual" ? "bg-marinho-900 text-white" : "text-suave"}`}>Preço fixo</button>
          </div>
          {f.modo === "manual" ? (
            <label className="flex items-center gap-2"><span className="flex-1 text-[13px] font-semibold">Preço de venda</span>
              <Num aria="Preço de venda" valor={f.preco_manual} rs forte onChange={(v) => mudar({ ...f, preco_manual: v })} className="w-36" /></label>
          ) : (
            <label className="flex items-center gap-2" title="Lucro líquido que sobra depois de todos os custos, como % do preço de venda">
              <span className="flex-1 text-[13px] font-semibold">Margem de lucro desejada</span>{campo("margem_pct")}</label>
          )}
        </div>
      </div>
      {/* resumo */}
      <aside className="rounded-2xl border border-linha bg-white p-4 shadow-[0_8px_24px_-16px_rgba(14,26,61,.4)]">
        <div className="mb-1 text-[11.5px] font-bold tracking-wide text-suave uppercase">Custo por unidade</div>
        {linha("Preço do fornecedor", Number(f.preco_fornecedor) || 0, "+")}
        {c.base !== (Number(f.preco_fornecedor) || 0) && linha("Desconto", (Number(f.preco_fornecedor) || 0) - c.base, "−")}
        {c.impostosCompra > 0 && linha("Impostos na compra", c.impostosCompra)}
        {c.despesasCompra > 0 && linha("Frete e despesas", c.despesasCompra)}
        {c.creditos > 0 && linha("Créditos de imposto", c.creditos, "−")}
        {linha("Custo real", c.custo, "=", true)}
        <div className="mt-4 mb-1 text-[11.5px] font-bold tracking-wide text-suave uppercase">Preço de venda</div>
        <div className="num font-display text-[26px] leading-none font-extrabold">{reais(c.preco)}</div>
        <div className="mt-1 text-[12px] text-suave">multiplicador {c.markup ? `${c.markup.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}×` : "—"} sobre o custo</div>
        <div className="mt-3">
          {c.partes.map((x) => linha(ROT[x.k], x.valor, "−"))}
          {linha("Custo real", c.custo, "−")}
          <div className={`flex items-baseline justify-between gap-3 border-t border-linha pt-2 text-[14px] font-extrabold ${c.lucro < 0 ? "text-erro" : "text-ok"}`}>
            <span>Lucro líquido</span><span className="num">{reais(c.lucro)} · {pct(c.margemPct)}</span>
          </div>
        </div>
        {c.erro && <p className="mt-3 flex gap-1.5 rounded-lg bg-erro-claro px-3 py-2 text-[12.5px] text-erro"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{c.erro}</p>}
        {c.lucro < 0 && !c.erro && <p className="mt-3 flex gap-1.5 rounded-lg bg-erro-claro px-3 py-2 text-[12.5px] text-erro"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Prejuízo: o preço não cobre custo + encargos.</p>}
        <p className="mt-3 flex gap-1.5 text-[11.5px] text-suave"><Info className="mt-0.5 size-3.5 shrink-0" />Campos em cinza usam o padrão da empresa. Digite um valor para usar outro só neste produto.</p>
      </aside>
    </fieldset>
  );
}

// ------------------------------------------------------------------ padrões da empresa
function JanelaPadroes({ inicial, aberto, onFechar, onSalvo, podeSalvar }: { inicial: Padroes; aberto: boolean; onFechar: () => void; onSalvo: (p: Padroes) => void; podeSalvar: boolean }) {
  const [p, setP] = useState<Padroes>(inicial);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (aberto) setP(inicial); }, [aberto, inicial]);
  const grupo = (g: { grupo: string; campos: { k: CampoFormacao; rot: string; ajuda: string; rs?: boolean }[] }) => (
    <div key={g.grupo} className="mb-3">
      <div className="mb-1.5 text-[11.5px] font-bold tracking-wide text-suave uppercase">{g.grupo}</div>
      {g.campos.map((x) => (
        <label key={x.k} className="mb-1.5 flex items-center gap-2" title={x.ajuda}>
          <span className="min-w-0 flex-1"><span className="block text-[13px]">{x.rot}</span><span className="block truncate text-[11.5px] text-suave">{x.ajuda}</span></span>
          <Num aria={x.rot} valor={p[x.k]} rs={x.rs} onChange={(v) => setP({ ...p, [x.k]: v })} className="w-28 shrink-0" />
        </label>
      ))}
    </div>
  );
  return (
    <Janela titulo="Padrões de preço da empresa" aberto={aberto} onFechar={onFechar} largura="max-w-4xl"
      rodape={<>
        {podeSalvar && <button type="button" disabled={ocupado} onClick={async () => { setErro(""); setOcupado(true); try { await salvarPadroes(p); onSalvo(p); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); } }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50">{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Salvar padrões</button>}
        {!podeSalvar && <span className="text-[13px] text-suave">Só a diretoria altera os padrões.</span>}
        {erro && <span className="text-[13px] text-erro">{erro}</span>}
      </>}>
      <p className="mb-4 rounded-xl bg-[#eef3fb] px-4 py-3 text-[13px] text-marinho-900">
        Valem para todos os produtos que não tiverem um valor próprio. Ao mudar aqui, os preços calculados pela margem mudam juntos
        quando você salvar cada produto. Confira com a contabilidade o regime (Simples, Presumido ou Real) e as alíquotas.
      </p>
      <fieldset disabled={!podeSalvar} className="grid gap-6 md:grid-cols-2">
        <div><h4 className="mb-2 text-[13.5px] font-bold">Compra</h4>{CAMPOS_COMPRA.map(grupo)}</div>
        <div><h4 className="mb-2 text-[13.5px] font-bold">Venda</h4>{CAMPOS_VENDA.map(grupo)}
          {grupo({ grupo: "Lucro", campos: [{ k: "margem_pct", rot: "Margem de lucro desejada", ajuda: "Lucro líquido, % do preço de venda" }] })}</div>
      </fieldset>
    </Janela>
  );
}

// ------------------------------------------------------------------ aba
type Lote = { campo: CampoFormacao | "preco_fornecedor" | "reajuste" | "modo_margem" | "limpar"; valor?: number; limparCampo?: CampoFormacao };

export function AbaPrecos({ produtos, total, podeEditar, diretoria, onSalvo, acoesExtra }: {
  produtos: Produto[]; total: number; podeEditar: boolean; diretoria: boolean; onSalvo: () => void; acoesExtra?: React.ReactNode;
}) {
  const [padroes, setPadroes] = useState<Padroes | null>(null);
  const [rascunho, setRascunho] = useState<Map<string, Formacao>>(new Map());
  const [aberto, setAberto] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [verPadroes, setVerPadroes] = useState(false);
  const [lote, setLote] = useState<Lote>({ campo: "margem_pct" });
  const [pagina, setPagina] = useState(1);
  const [vista, setVista] = useState<"todos" | "sem" | "prejuizo" | "baixa" | "detalhados" | "zenith">("todos");
  const [ordem, setOrdem] = useState<"nome" | "margem" | "preco" | "lucro">("nome");
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState(""), [ok, setOk] = useState("");
  useEffect(() => { carregarPadroes().then(setPadroes).catch(() => setPadroes({})); }, []);
  useEffect(() => setPagina(1), [produtos, vista, ordem]);
  useEffect(() => { if (!ok) return; const t = setTimeout(() => setOk(""), 4000); return () => clearTimeout(t); }, [ok]);

  const P = useMemo<Padroes>(() => padroes ?? {}, [padroes]);
  const fDe = (p: Produto) => rascunho.get(p.id) ?? formacaoInicial(p);
  const mudar = (id: string, f: Formacao) => setRascunho((m) => new Map(m).set(id, f));
  const resumo = useMemo(() => {
    let semPreco = 0, prejuizo = 0, detalhados = 0, somaMargem = 0, nMargem = 0;
    for (const p of produtos) {
      const f = rascunho.get(p.id) ?? formacaoInicial(p), c = calcular(f, P);
      if (!(Number(f.preco_fornecedor) > 0) || !c.preco) semPreco++;
      if (c.preco && c.lucro < 0) prejuizo++;
      if (p.formacao || rascunho.has(p.id)) detalhados++;
      if (c.preco) { somaMargem += c.margemPct; nMargem++; }
    }
    return { semPreco, prejuizo, detalhados, margem: nMargem ? somaMargem / nMargem : 0 };
  }, [produtos, rascunho, P]);

  async function salvar() {
    if (!padroes) return;
    setErro(""); setOcupado(true);
    try {
      const itens = [...rascunho].map(([id, formacao]) => ({ id, formacao }));
      const ruim = itens.find((x) => calcular(x.formacao, P).erro);
      if (ruim) throw new Error(`${produtos.find((p) => p.id === ruim.id)?.nome ?? "Um produto"}: ${calcular(ruim.formacao, P).erro}`);
      await salvarFormacoes(itens, P);
      setOk(`${itens.length} produto(s) com preço atualizado.`); setRascunho(new Map()); onSalvo();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  function aplicarLote() {
    const alvo = produtos.filter((p) => sel.has(p.id));
    setRascunho((m) => {
      const n = new Map(m);
      for (const p of alvo) {
        const f = { ...(n.get(p.id) ?? formacaoInicial(p)) };
        if (lote.campo === "reajuste") f.preco_fornecedor = Math.round((Number(f.preco_fornecedor) || 0) * (1 + (lote.valor ?? 0) / 100) * 100) / 100;
        else if (lote.campo === "modo_margem") { f.modo = "margem"; if (lote.valor != null) f.margem_pct = lote.valor; }
        else if (lote.campo === "limpar") { if (lote.limparCampo) delete f[lote.limparCampo]; }
        else if (lote.campo === "preco_fornecedor") f.preco_fornecedor = lote.valor;
        else { f[lote.campo] = lote.valor; if (lote.campo === "margem_pct") f.modo = "margem"; }
        n.set(p.id, f);
      }
      return n;
    });
    setOk(`Aplicado em ${alvo.length} produto(s). Confira e clique em Salvar.`);
  }

  // recorte desta aba (por cima dos filtros do estoque) e ordem
  const linhas = useMemo(() => {
    const L = produtos.map((p) => { const f = rascunho.get(p.id) ?? formacaoInicial(p); return { p, f, c: calcular(f, P) }; });
    const R = L.filter(({ p, f, c }) => vista === "todos" ? true
      : vista === "sem" ? !(Number(f.preco_fornecedor) > 0) || !c.preco
      : vista === "prejuizo" ? c.preco > 0 && c.lucro < 0
      : vista === "baixa" ? c.preco > 0 && c.margemPct < 15
      : vista === "detalhados" ? !!p.formacao || rascunho.has(p.id)
      : !p.formacao && !rascunho.has(p.id));
    if (ordem !== "nome") R.sort((a, b) => ordem === "margem" ? a.c.margemPct - b.c.margemPct : ordem === "preco" ? b.c.preco - a.c.preco : b.c.lucro - a.c.lucro);
    return R;
  }, [produtos, rascunho, P, vista, ordem]);
  const POR = 100;
  const lista = linhas.slice(0, pagina * POR).map((x) => x.p);
  const todosSel = linhas.length > 0 && linhas.every(({ p }) => sel.has(p.id));

  return (
    <div className="min-w-0">
      {/* resumo + ações */}
      <div className="flex flex-wrap items-center gap-2 border-b border-linha px-4 py-3">
        {([
          ["todos", "Todos os produtos", produtos.length, "text-tinta"], ["sem", "Sem preço", resumo.semPreco, "text-atencao"], ["prejuizo", "Com prejuízo", resumo.prejuizo, "text-erro"],
          ["baixa", "Margem abaixo de 15%", null, "text-atencao"], ["detalhados", "Precificados em detalhe", resumo.detalhados, "text-azul"], ["zenith", "Ainda com preço do Zenith", produtos.length - resumo.detalhados, "text-suave"],
        ] as const).map(([k, r, v, cor]) => (
          <button key={k} type="button" onClick={() => setVista(k)} className={`inline-flex items-baseline gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] transition ${vista === k ? "bg-marinho-900 text-white" : "bg-fundo text-suave hover:text-tinta"}`}>
            {v != null && <b className={`num text-[14px] ${vista === k ? "text-white" : cor}`}>{v.toLocaleString("pt-BR")}</b>}{r}
          </button>
        ))}
        <span className="inline-flex items-baseline gap-1.5 px-1 text-[12.5px] text-suave">margem média <b className="num text-[14px] text-ok">{pct(Math.round(resumo.margem * 10) / 10)}</b></span>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} aria-label="Ordenar preços" className="rounded-xl border border-linha bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-suave">
          <option value="nome">Ordem: nome</option><option value="margem">Menor margem primeiro</option><option value="preco">Maior preço</option><option value="lucro">Maior lucro</option>
        </select>
        <span className="ml-auto flex flex-wrap gap-2">
          {acoesExtra}
          <button type="button" onClick={() => setVerPadroes(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-linha px-3 py-1.5 text-[13px] font-semibold hover:border-azul hover:text-azul"><Settings2 className="size-4" />Padrões da empresa</button>
        </span>
      </div>

      {/* lote */}
      {podeEditar && sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-linha bg-[#eef3fb] px-4 py-2.5 text-[13px]">
          <b className="text-marinho-900">{sel.size} selecionado(s):</b>
          <select value={lote.campo} onChange={(e) => setLote({ campo: e.target.value as Lote["campo"] })} aria-label="O que aplicar"
            className="rounded-lg border border-linha bg-white px-2 py-1.5 text-[13px]">
            <option value="reajuste">Reajustar preço do fornecedor em %</option>
            <option value="preco_fornecedor">Preço do fornecedor (R$)</option>
            <option value="modo_margem">Calcular pela margem (%)</option>
            <optgroup label="Definir um percentual">{TODOS_CAMPOS.filter((c) => !c.rs).map((c) => <option key={c.k} value={c.k}>{c.rot}</option>)}</optgroup>
            <optgroup label="Valores em R$">{TODOS_CAMPOS.filter((c) => c.rs).map((c) => <option key={c.k} value={c.k}>{c.rot}</option>)}</optgroup>
            <option value="limpar">Voltar um campo para o padrão…</option>
          </select>
          {lote.campo === "limpar" ? (
            <select value={lote.limparCampo ?? ""} onChange={(e) => setLote({ ...lote, limparCampo: e.target.value as CampoFormacao })} aria-label="Campo" className="rounded-lg border border-linha bg-white px-2 py-1.5 text-[13px]">
              <option value="">Escolha o campo</option>{TODOS_CAMPOS.map((c) => <option key={c.k} value={c.k}>{c.rot}</option>)}
            </select>
          ) : (
            <Num aria="Valor" valor={lote.valor} rs={lote.campo === "preco_fornecedor" || !!TODOS_CAMPOS.find((c) => c.k === lote.campo)?.rs} onChange={(v) => setLote({ ...lote, valor: v })} className="w-28" />
          )}
          <button type="button" onClick={aplicarLote} disabled={lote.campo === "limpar" ? !lote.limparCampo : lote.valor == null && lote.campo !== "modo_margem"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-marinho-900 px-3 py-1.5 font-semibold text-white disabled:opacity-40"><Sparkles className="size-3.5" />Aplicar</button>
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold text-suave hover:text-tinta"><X className="size-3.5" />Limpar seleção</button>
        </div>
      )}

      {/* tabela */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-[13px]">
          <thead><tr className="border-b border-linha text-left text-[11px] font-bold tracking-wide text-suave uppercase">
            <th className="w-9 px-3 py-2.5">{podeEditar && <input type="checkbox" aria-label="Selecionar todos os filtrados" checked={todosSel} onChange={() => setSel(todosSel ? new Set() : new Set(linhas.map(({ p }) => p.id)))} className="size-4 accent-[#2f6fb5]" />}</th>
            <th className="px-2 py-2.5">Produto</th>
            <th className="w-36 px-2 py-2.5 text-right">Preço fornecedor</th>
            <th className="w-28 px-2 py-2.5 text-right">Custo real</th>
            <th className="w-24 px-2 py-2.5 text-right">Encargos venda</th>
            <th className="w-28 px-2 py-2.5 text-right">Margem</th>
            <th className="w-36 px-2 py-2.5 text-right">Preço de venda</th>
            <th className="w-28 px-3 py-2.5 text-right">Lucro / un.</th>
          </tr></thead>
          <tbody>
            {lista.map((p) => {
              const f = fDe(p), c = calcular(f, P), sujo = rascunho.has(p.id), ab = aberto === p.id;
              const semPreco = !(Number(f.preco_fornecedor) > 0);
              return (
                <Fragment key={p.id}>
                  <tr className={`border-b border-linha ${ab ? "bg-[#f7f9fc]" : "hover:bg-fundo/40"} ${sujo ? "shadow-[inset_3px_0_0_#f5821f]" : ""}`}>
                    <td className="px-3 py-2">{podeEditar && <input type="checkbox" aria-label={`Selecionar ${p.nome}`} checked={sel.has(p.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} className="size-4 accent-[#2f6fb5]" />}</td>
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => setAberto(ab ? null : p.id)} className="flex w-full min-w-0 items-center gap-2.5 text-left">
                        {ab ? <ChevronDown className="size-4 shrink-0 text-azul" /> : <ChevronRight className="size-4 shrink-0 text-suave" />}
                        <Foto p={p} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{p.nome}</span>
                          <span className="flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-suave">
                            {p.codigo != null && <span className="num">#{p.codigo}</span>}{p.marca && <span>{p.marca}</span>}{p.fornecedor && <span>· {p.fornecedor}</span>}
                            {semPreco ? <span className="rounded bg-atencao-claro px-1.5 font-bold text-atencao">sem preço</span>
                              : sujo ? <span className="rounded bg-[#fff1e5] px-1.5 font-bold text-[#c2620c]">não salvo</span>
                              : p.formacao ? <span className="rounded bg-[#eef3fb] px-1.5 font-bold text-azul">{f.modo === "manual" ? "preço fixo" : "pela margem"}</span>
                              : <span className="rounded bg-fundo px-1.5 font-bold">do Zenith</span>}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-2"><Num aria={`Preço do fornecedor de ${p.nome}`} valor={f.preco_fornecedor} rs onChange={(v) => mudar(p.id, { ...f, preco_fornecedor: v })} /></td>
                    <td className="num px-2 py-2 text-right">{reais(c.custo)}{c.base > 0 && c.custo !== c.base && <span className="block text-[11px] text-suave">{c.custo > c.base ? "+" : ""}{pct(Math.round(((c.custo / c.base) - 1) * 1000) / 10)}</span>}</td>
                    <td className="num px-2 py-2 text-right text-suave">{pct(c.encargosPct)}</td>
                    <td className="px-2 py-2">
                      {f.modo === "manual"
                        ? <span className={`num block text-right font-semibold ${c.margemPct < 0 ? "text-erro" : ""}`} title="Preço fixo: a margem é o resultado">{pct(c.margemPct)}</span>
                        : <Num aria={`Margem de ${p.nome}`} valor={f.margem_pct} padrao={P.margem_pct} onChange={(v) => mudar(p.id, { ...f, margem_pct: v })} />}
                    </td>
                    <td className="px-2 py-2"><Num aria={`Preço de venda de ${p.nome}`} valor={c.preco || undefined} rs forte onChange={(v) => mudar(p.id, { ...f, modo: "manual", preco_manual: v })} /></td>
                    <td className={`num px-3 py-2 text-right font-semibold ${c.lucro < 0 ? "text-erro" : "text-ok"}`}>{c.preco ? reais(c.lucro) : "—"}</td>
                  </tr>
                  {ab && <tr><td colSpan={8} className="p-0"><Detalhe f={f} padroes={P} podeEditar={podeEditar} mudar={(x) => mudar(p.id, x)} /></td></tr>}
                </Fragment>
              );
            })}
            {!linhas.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-suave">Nenhum produto com esse filtro.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-linha px-4 py-3 text-[13px] text-suave">
        <span>Mostrando {Math.min(linhas.length, pagina * POR).toLocaleString("pt-BR")} de {linhas.length.toLocaleString("pt-BR")} produto(s){linhas.length !== total ? ` · ${total.toLocaleString("pt-BR")} no cadastro` : ""}</span>
        {linhas.length > pagina * POR && <span className="flex gap-2">
          <button type="button" onClick={() => setPagina(pagina + 1)} className="rounded-xl border border-linha px-4 py-1.5 font-semibold text-azul hover:border-azul">Mostrar mais 100</button>
          <button type="button" onClick={() => setPagina(Math.ceil(linhas.length / POR))} className="rounded-xl border border-linha px-4 py-1.5 font-semibold text-azul hover:border-azul">Mostrar todos</button>
        </span>}
      </div>

      {/* barra de salvar */}
      {(rascunho.size > 0 || erro || ok) && (
        <div className="sticky bottom-3 z-20 mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-marinho-950 px-4 py-3 text-white shadow-2xl">
          <Calculator className="size-4 text-ciano" />
          {rascunho.size > 0 ? <span className="text-[13.5px]"><b>{rascunho.size}</b> produto(s) com alteração não salva</span> : ok ? <span className="text-[13.5px] font-semibold">✓ {ok}</span> : null}
          {erro && <span className="w-full rounded-lg bg-erro px-3 py-1.5 text-[12.5px] sm:order-last">{erro}</span>}
          {rascunho.size > 0 && <span className="ml-auto flex gap-2">
            <button type="button" onClick={() => { setRascunho(new Map()); setErro(""); }} className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-[13px] font-semibold text-white/80 hover:bg-white/10"><RotateCcw className="size-3.5" />Descartar</button>
            <button type="button" onClick={salvar} disabled={ocupado || !padroes} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-1.5 text-[13px] font-bold text-marinho-900 disabled:opacity-50">{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Salvar preços</button>
          </span>}
        </div>
      )}

      <JanelaPadroes inicial={P} aberto={verPadroes} podeSalvar={diretoria} onFechar={() => setVerPadroes(false)} onSalvo={(p) => { setPadroes(p); setVerPadroes(false); setOk("Padrões da empresa salvos."); }} />
    </div>
  );
}
