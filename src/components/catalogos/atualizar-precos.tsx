"use client";
// Catálogo novo → atualiza compra e venda dos produtos que já existem no estoque.
// Lê os preços de revenda do PDF, acha cada produto no cadastro e mostra o antes
// e o depois. Nada é gravado sem o clique em "Atualizar". A venda respeita a
// margem do cadastro de cada produto (pela margem recalcula; preço fixo mantém
// o mesmo multiplicador sobre o custo).
import { useEffect, useMemo, useState } from "react";
import { hojeLocal } from "@/lib/texto";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Copy, Loader2, Search } from "lucide-react";
import { Janela, reais } from "@/components/crm/ui";
import { acharExistente, extrairItensPdf, lerProdutosCatalogo, ProdutoCatalogo } from "@/lib/catalogo-produtos";
import { carregarCatalogo, type Produto } from "@/lib/orcamentos";
import { aplicarCotacao, calcular, Formacao, formacaoInicial, Padroes, reprecificar } from "@/lib/precos";
import { carregarPadroes, salvarFormacoes } from "@/lib/precos-db";
import { cotacaoDoDia, type Cotacao } from "@/lib/cotacao";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";

export type CatalogoPreco = { id: string; fornecedor: string; titulo: string; storage_path: string | null; moeda?: string | null };
type Linha = {
  item: ProdutoCatalogo; produto: Produto; certeza: "igual" | "parecido"; novo: Formacao;
  antes: { compra: number; venda: number; margem: number }; depois: { compra: number; venda: number; margem: number }; marcar: boolean;
};

/** Monta a nova formação do produto com o preço lido do catálogo. */
export function formacaoComCatalogo(p: Pick<Produto, "valor_compra" | "impostos_pct" | "preco_venda" | "formacao">, preco: number, moeda: "BRL" | "USD", padroes: Padroes, cot: Cotacao | null): Formacao {
  return reprecificar(formacaoInicial(p), padroes, (g) =>
    moeda === "USD" ? (cot ? aplicarCotacao({ ...g, moeda: "USD", preco_moeda: preco }, cot.valor, cot.data) : { ...g, moeda: "USD", preco_moeda: preco })
      : { ...g, moeda: "BRL", preco_fornecedor: preco });
}

export function AtualizarPrecosCatalogo({ catalogo, onFechar, onAtualizado }: { catalogo: CatalogoPreco | null; onFechar: () => void; onAtualizado?: (n: number) => void }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [lidos, setLidos] = useState(0), [semPreco, setSemPreco] = useState(0), [novos, setNovos] = useState(0);
  const [padroes, setPadroes] = useState<Padroes>({});
  const [erro, setErro] = useState(""), [lendo, setLendo] = useState(false), [gravando, setGravando] = useState(false);
  const [filtro, setFiltro] = useState<"muda" | "todos">("muda"), [q, setQ] = useState("");
  const moeda = catalogo?.moeda === "USD" ? "USD" : "BRL";
  const fmt = (v: number) => (moeda === "USD" ? `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : reais(v));

  useEffect(() => {
    if (!catalogo?.storage_path || modoDemo) return;
    let vivo = true;
    setLinhas(null); setErro(""); setLendo(true); setFiltro("muda"); setQ("");
    (async () => {
      const db = supabase();
      const [arq, cat, P, cot] = await Promise.all([
        db.storage.from("documentos").download(catalogo.storage_path!), carregarCatalogo(true), carregarPadroes(), moeda === "USD" ? cotacaoDoDia() : Promise.resolve(null),
      ]);
      if (arq.error || !arq.data) throw arq.error ?? new Error("Não foi possível abrir o PDF.");
      if (moeda === "USD" && !cot) throw new Error("Sem a cotação do dólar agora. Tente de novo em instantes.");
      const itens = lerProdutosCatalogo(await extrairItensPdf(await arq.data.arrayBuffer()));
      const base = cat.produtos.map((p) => ({ ...p, referencia: p.referencia }));
      const L: Linha[] = [];
      let sp = 0, nv = 0;
      const usados = new Set<string>();
      for (const it of itens) {
        const e = acharExistente(it, base, catalogo.fornecedor);
        if (!e) { nv++; continue; }
        if (!(it.preco && it.preco > 0)) { sp++; continue; }
        if (usados.has(e.produto.id)) continue;
        usados.add(e.produto.id);
        const p = e.produto, f0 = formacaoInicial(p), c0 = calcular(f0, P);
        const novo = formacaoComCatalogo(p, it.preco, moeda, P, cot), c1 = calcular(novo, P);
        const muda = Math.abs(c1.base - c0.base) > 0.005 || Math.abs(c1.preco - c0.preco) > 0.005;
        L.push({ item: it, produto: p, certeza: e.certeza, novo, antes: { compra: c0.base, venda: c0.preco, margem: c0.margemPct }, depois: { compra: c1.base, venda: c1.preco, margem: c1.margemPct }, marcar: muda && e.certeza === "igual" && !c1.erro });
      }
      if (!vivo) return;
      setPadroes(P); setLidos(itens.length); setSemPreco(sp); setNovos(nv);
      setLinhas(L.sort((a, b) => Number(b.marcar) - Number(a.marcar) || a.produto.nome.localeCompare(b.produto.nome)));
    })().catch((e) => vivo && setErro(mensagemErro(e))).finally(() => vivo && setLendo(false));
    return () => { vivo = false; };
  }, [catalogo, moeda]);

  const mudam = (l: Linha) => Math.abs(l.depois.compra - l.antes.compra) > 0.005 || Math.abs(l.depois.venda - l.antes.venda) > 0.005;
  const visiveis = useMemo(() => (linhas ?? []).filter((l) => (filtro === "todos" || mudam(l)) && (!q || `${l.produto.nome} ${l.item.codigo} ${l.item.nome}`.toLowerCase().includes(q.toLowerCase()))), [linhas, filtro, q]);
  const marcados = (linhas ?? []).filter((l) => l.marcar);

  async function atualizar() {
    if (!catalogo || !marcados.length) return;
    setGravando(true); setErro("");
    try {
      await salvarFormacoes(marcados.map((l) => ({ id: l.produto.id, formacao: l.novo })), padroes);
      await supabase().from("catalogos").update({ precos_lidos_em: new Date().toISOString(), conferido_em: hojeLocal() }).eq("id", catalogo.id);
      onAtualizado?.(marcados.length);
      onFechar();
    } catch (e) { setErro(mensagemErro(e)); } finally { setGravando(false); }
  }

  const seta = (a: number, b: number, f = fmt) => (
    <span className="num inline-flex items-center gap-1 whitespace-nowrap">{f(a)}{Math.abs(a - b) > 0.005 && <><ArrowRight className="size-3 text-suave" /><b className={b > a ? "text-erro" : "text-ok"}>{f(b)}</b></>}</span>
  );

  return (
    <Janela titulo={catalogo ? `Atualizar preços · ${catalogo.fornecedor}` : "Atualizar preços"} aberto={!!catalogo} onFechar={onFechar} largura="max-w-5xl"
      rodape={linhas ? <>
        <button type="button" disabled={gravando || !marcados.length} onClick={atualizar} className="inline-flex items-center gap-1.5 rounded-xl bg-azul px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-azul-escuro disabled:opacity-50">
          {gravando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Atualizar {marcados.length} produto(s)</button>
        <button type="button" onClick={onFechar} className="rounded-xl px-3 py-2 text-[13px] font-semibold text-suave hover:text-tinta">Agora não</button>
        {erro && <span className="text-[13px] text-erro">{erro}</span>}
      </> : erro ? <span className="text-[13px] text-erro">{erro}</span> : undefined}>
      {lendo || (!linhas && !erro) ? (
        <div className="flex items-center gap-2 py-12 text-suave"><Loader2 className="size-5 animate-spin" />Lendo os preços de {catalogo?.titulo}…</div>
      ) : erro && !linhas ? (
        <p className="flex gap-2 rounded-xl bg-erro-claro px-4 py-3 text-[13.5px] text-erro"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{erro}</p>
      ) : linhas && (
        <>
          <p className="mb-3 text-[13.5px] text-suave">
            Li <b className="text-tinta">{lidos}</b> item(ns) na tabela{moeda === "USD" ? " (preços em dólar, convertidos pela cotação de hoje)" : ""}. <b className="text-tinta">{linhas.length}</b> já estão no estoque
            {semPreco ? <> · {semPreco} sem preço no PDF</> : null}{novos ? <> · {novos} novo(s), que você puxa pelo botão “Puxar dos catálogos” em Produtos</> : null}.
            O preço lido é o de <b className="text-tinta">revenda</b> (a compra da BRA); a venda é recalculada mantendo a margem de cada produto.
          </p>
          {!linhas.length ? (
            <p className="flex gap-2 rounded-xl bg-atencao-claro px-4 py-3 text-[13.5px] text-atencao"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Nenhum produto deste catálogo com preço foi encontrado no estoque. Se o PDF for escaneado (imagem), os preços precisam ser lançados na aba Preços.</p>
          ) : <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {([["muda", "Com preço novo", linhas.filter(mudam).length], ["todos", "Todos encontrados", linhas.length]] as const).map(([k, r, n]) => (
                <button key={k} type="button" onClick={() => setFiltro(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${filtro === k ? "border-marinho-900 bg-marinho-900 text-white" : "border-linha text-suave"}`}>{r} <span className="num opacity-70">{n}</span></button>
              ))}
              <button type="button" onClick={() => setLinhas((L) => L && L.map((l) => (visiveis.includes(l) ? { ...l, marcar: true } : l)))} className="text-[12.5px] font-semibold text-azul hover:underline">Marcar todos da lista</button>
              <button type="button" onClick={() => setLinhas((L) => L && L.map((l) => (visiveis.includes(l) ? { ...l, marcar: false } : l)))} className="text-[12.5px] font-semibold text-suave hover:underline">Desmarcar</button>
              <label className="relative ml-auto min-w-[180px] flex-1 sm:max-w-xs"><Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-suave" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="w-full rounded-lg border border-linha py-1.5 pr-2 pl-8 text-[13px]" /></label>
            </div>
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-linha">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead className="sticky top-0 bg-[#f7f9fc]"><tr className="text-left text-[11px] font-bold tracking-wide text-suave uppercase">
                  <th className="w-9 px-3 py-2" /><th className="px-2 py-2">Produto</th><th className="px-2 py-2 text-right">Tabela</th><th className="px-2 py-2 text-right">Compra (R$)</th><th className="px-2 py-2 text-right">Venda</th><th className="px-3 py-2 text-right">Margem</th>
                </tr></thead>
                <tbody className="divide-y divide-linha">
                  {visiveis.map((l) => (
                    <tr key={l.produto.id} className={l.marcar ? "" : "bg-fundo/40"}>
                      <td className="px-3 py-2"><input type="checkbox" checked={l.marcar} onChange={() => setLinhas((L) => L && L.map((x) => (x === l ? { ...x, marcar: !x.marcar } : x)))} aria-label={`Atualizar ${l.produto.nome}`} className="size-4 accent-[#0071e3]" /></td>
                      <td className="px-2 py-2">
                        <div className="font-semibold">{l.produto.nome}</div>
                        <div className="text-[11.5px] text-suave"><span className="num">cód. {l.item.codigo}</span> · pág. {l.item.pagina}
                          {l.certeza === "parecido" && <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-atencao-claro px-1.5 font-semibold text-atencao"><Copy className="size-3" />parecido com “{l.item.nome}”: confira</span>}
                          {l.certeza === "igual" && <CheckCircle2 className="ml-1 inline size-3.5 text-ok" />}
                          {l.produto.formacao?.modo === "manual" || !l.produto.formacao ? <span className="ml-1.5">· preço fixo (mantém o multiplicador)</span> : <span className="ml-1.5">· pela margem</span>}</div>
                      </td>
                      <td className="num px-2 py-2 text-right font-semibold">{fmt(l.item.preco!)}{l.item.preco_consumidor ? <span className="block text-[11px] font-normal text-suave">consumidor {fmt(l.item.preco_consumidor)}</span> : null}</td>
                      <td className="px-2 py-2 text-right">{seta(l.antes.compra, l.depois.compra, reais)}</td>
                      <td className="px-2 py-2 text-right">{seta(l.antes.venda, l.depois.venda, reais)}</td>
                      <td className="num px-3 py-2 text-right">{l.depois.margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
                    </tr>
                  ))}
                  {!visiveis.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-suave">{filtro === "muda" ? "Os preços deste catálogo já estão iguais aos do estoque." : "Nada aqui."}</td></tr>}
                </tbody>
              </table>
            </div>
          </>}
        </>
      )}
    </Janela>
  );
}
