"use client";
// Puxa os produtos dos catálogos (PDF) cadastrados, sem duplicar o que já
// existe no estoque. Quando a tabela traz o preço de revenda, o produto já
// entra com a compra e a venda calculada pela margem padrão da empresa.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Check, CheckCircle2, Copy, Loader2, Search } from "lucide-react";
import { Janela } from "@/components/crm/ui";
import { acharExistente, extrairItensPdf, lerProdutosCatalogo, ProdutoCatalogo } from "@/lib/catalogo-produtos";
import type { Produto } from "@/lib/orcamentos";
import { invalidarCatalogo } from "@/lib/orcamentos";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";
import { aplicarCotacao, calcular, colunasDoCalculo, type Formacao } from "@/lib/precos";
import { carregarPadroes } from "@/lib/precos-db";
import { cotacaoDoDia } from "@/lib/cotacao";

type Catalogo = { id: string; fornecedor: string; titulo: string; categoria: string | null; storage_path: string | null; arquivo_nome: string | null; moeda?: string | null };
type Linha = ProdutoCatalogo & { existe: { id: string; nome: string; certeza: "igual" | "parecido" } | null; marcar: boolean };

const CATEGORIA: Record<string, string> = { "Áudio/Vídeo": "Áudio/Vídeo", "Automação": "Automação", "Rede": "Rede", "CFTV": "CFTV", "Controle de acesso": "Controle de acesso", "Infraestrutura": "Infraestrutura" };

export function ImportarCatalogo({ aberto, onFechar, produtos, onImportado }: { aberto: boolean; onFechar: () => void; produtos: Produto[]; onImportado: (n: number) => void }) {
  const [catalogos, setCatalogos] = useState<Catalogo[] | null>(null);
  const [escolhido, setEscolhido] = useState<Catalogo | null>(null);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [lendo, setLendo] = useState(false), [gravando, setGravando] = useState(false), [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<"novos" | "todos" | "existentes">("novos"), [q, setQ] = useState("");

  useEffect(() => {
    if (!aberto || catalogos || modoDemo) return;
    supabase().from("catalogos").select("*").not("storage_path", "is", null).order("fornecedor")
      .then(({ data, error }) => { if (error) setErro(mensagemErro(error)); setCatalogos((data ?? []).filter((c) => /\.pdf$/i.test(c.storage_path ?? "")) as Catalogo[]); });
  }, [aberto, catalogos]);

  const jaDoCatalogo = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of produtos) if (p.catalogo_id) m.set(p.catalogo_id, (m.get(p.catalogo_id) ?? 0) + 1);
    return m;
  }, [produtos]);

  async function ler(c: Catalogo) {
    setEscolhido(c); setLinhas(null); setErro(""); setLendo(true); setFiltro("novos"); setQ("");
    try {
      const { data, error } = await supabase().storage.from("documentos").download(c.storage_path!);
      if (error || !data) throw error ?? new Error("Não foi possível abrir o PDF.");
      const lidos = lerProdutosCatalogo(await extrairItensPdf(await data.arrayBuffer()));
      const base = produtos.map((p) => ({ id: p.id, nome: p.nome, modelo: p.modelo, referencia: p.referencia, marca: p.marca }));
      setLinhas(lidos.map((p) => {
        const e = acharExistente(p, base, c.fornecedor);
        return { ...p, existe: e ? { id: e.produto.id, nome: e.produto.nome, certeza: e.certeza } : null, marcar: !e };
      }));
    } catch (e) { setErro(mensagemErro(e)); } finally { setLendo(false); }
  }

  async function importar() {
    if (!linhas || !escolhido) return;
    const alvo = linhas.filter((l) => l.marcar);
    if (!alvo.length) return;
    setGravando(true); setErro("");
    try {
      // nome + marca não pode repetir: se repetir, acrescenta o código do fornecedor
      const usd = escolhido.moeda === "USD";
      const [P, cot] = await Promise.all([carregarPadroes(), usd ? cotacaoDoDia() : Promise.resolve(null)]);
      const preco = (v?: number) => {
        if (!v || !(v > 0) || (usd && !cot)) return { preco_venda: 0, custo: 0, valor_compra: 0, impostos_pct: 0, fator_venda: null, formacao: {} };
        const f0: Formacao = usd ? { modo: "margem", moeda: "USD", preco_moeda: v } : { modo: "margem", moeda: "BRL", preco_fornecedor: v };
        const f = usd ? aplicarCotacao(f0, cot!.valor, cot!.data) : f0, c = calcular(f, P);
        return c.erro ? { preco_venda: 0, custo: 0, valor_compra: 0, impostos_pct: 0, fator_venda: null, formacao: {} } : colunasDoCalculo(f, c);
      };
      const usados = new Set(produtos.filter((p) => (p.marca || "").toLowerCase() === escolhido.fornecedor.toLowerCase()).map((p) => p.nome.toLowerCase()));
      const rows = alvo.map((l) => {
        let nome = l.nome.trim();
        if (usados.has(nome.toLowerCase())) nome = `${nome} (${l.codigo})`;
        usados.add(nome.toLowerCase());
        return {
          nome, marca: escolhido.fornecedor, modelo: l.modelo || null, referencia: l.codigo, ncm: l.ncm || null, descricao: l.descricao || null,
          categoria: CATEGORIA[escolhido.categoria ?? ""] ?? null, sistema: CATEGORIA[escolhido.categoria ?? ""] ?? null, unidade: /\bpar\b/i.test(l.nome) ? "Par" : "Unidade",
          ativo: true, catalogo_id: escolhido.id, ...preco(l.preco),
        };
      });
      const db = supabase();
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await db.from("produtos").insert(rows.slice(i, i + 100));
        if (error) throw error;
      }
      invalidarCatalogo();
      onImportado(rows.length);
      setLinhas(null); setEscolhido(null);
    } catch (e) { setErro(mensagemErro(e)); } finally { setGravando(false); }
  }

  const visiveis = (linhas ?? []).filter((l) => (filtro === "todos" || (filtro === "novos" ? !l.existe : !!l.existe)) && (!q || `${l.nome} ${l.codigo} ${l.modelo}`.toLowerCase().includes(q.toLowerCase())));
  const marcados = (linhas ?? []).filter((l) => l.marcar).length;
  const marcarTodos = (v: boolean) => setLinhas((L) => L && L.map((l) => (visiveis.includes(l) ? { ...l, marcar: v } : l)));

  return (
    <Janela titulo={escolhido ? `Produtos do catálogo ${escolhido.fornecedor}` : "Puxar produtos dos catálogos"} aberto={aberto} onFechar={onFechar} largura="max-w-4xl"
      rodape={escolhido && linhas ? <>
        <button type="button" disabled={gravando || !marcados} onClick={importar} className="inline-flex items-center gap-1.5 rounded-xl bg-azul hover:bg-azul-escuro px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50">
          {gravando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Subir {marcados} produto(s)</button>
        <button type="button" onClick={() => { setEscolhido(null); setLinhas(null); }} className="rounded-xl px-3 py-2 text-[13px] font-semibold text-suave hover:text-tinta">Outro catálogo</button>
        {erro && <span className="text-[13px] text-erro">{erro}</span>}
      </> : erro ? <span className="text-[13px] text-erro">{erro}</span> : undefined}>
      {!escolhido ? (
        <>
          <p className="mb-3 text-[13.5px] text-suave">Escolha um catálogo em PDF. O Núcleo lê os produtos (nome, código do fornecedor, NCM e descrição), compara com o que já existe no estoque e mostra só o que falta. Quando a tabela traz o preço de revenda, o produto entra com a compra e a venda pela margem padrão da empresa; sem preço no PDF, entra sem valor para precificar na aba Preços. Para atualizar os preços do que já está no estoque, use <b className="text-tinta">Atualizar preços</b> no catálogo.</p>
          {!catalogos ? <div className="flex items-center gap-2 py-8 text-suave"><Loader2 className="size-5 animate-spin" />Carregando catálogos…</div> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {catalogos.map((c) => (
                <button key={c.id} type="button" onClick={() => ler(c)} className="flex items-center gap-3 rounded-xl border border-linha p-3 text-left hover:border-azul hover:bg-[#f5f8fd]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marinho-900 font-display text-[13px] font-extrabold text-white">{c.fornecedor.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{c.fornecedor}</span><span className="block truncate text-[12px] text-suave">{c.titulo}{c.categoria ? ` · ${c.categoria}` : ""}</span></span>
                  {jaDoCatalogo.get(c.id) ? <span className="rounded-full bg-ok-claro px-2 py-0.5 text-[11.5px] font-bold text-ok">{jaDoCatalogo.get(c.id)} já puxados</span> : <BookOpen className="size-4 text-suave" />}
                </button>
              ))}
              {!catalogos.length && <p className="text-suave">Nenhum catálogo em PDF cadastrado.</p>}
            </div>
          )}
        </>
      ) : lendo ? (
        <div className="flex items-center gap-2 py-12 text-suave"><Loader2 className="size-5 animate-spin" />Lendo o PDF de {escolhido.fornecedor}…</div>
      ) : linhas && !linhas.length ? (
        <p className="flex gap-2 rounded-xl bg-atencao-claro px-4 py-3 text-[13.5px] text-atencao"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Não encontrei produtos neste PDF. Ele pode ser uma imagem (escaneado) ou ter um formato diferente das tabelas de preço. Esses produtos precisam ser cadastrados à mão.</p>
      ) : linhas && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {([["novos", "Novos", linhas.filter((l) => !l.existe).length], ["existentes", "Já no estoque", linhas.filter((l) => l.existe).length], ["todos", "Todos", linhas.length]] as const).map(([k, r, n]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)} className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${filtro === k ? "border-marinho-900 bg-marinho-900 text-white" : "border-linha text-suave"}`}>{r} <span className="num opacity-70">{n}</span></button>
            ))}
            <label className="relative ml-auto min-w-[180px] flex-1 sm:max-w-xs"><Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-suave" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="w-full rounded-lg border border-linha py-1.5 pr-2 pl-8 text-[13px]" /></label>
          </div>
          <div className="mb-2 flex items-center gap-3 text-[12.5px]">
            <button type="button" onClick={() => marcarTodos(true)} className="font-semibold text-azul hover:underline">Marcar todos da lista</button>
            <button type="button" onClick={() => marcarTodos(false)} className="font-semibold text-suave hover:underline">Desmarcar</button>
            <span className="ml-auto text-suave">{marcados} marcado(s) para subir</span>
          </div>
          <ul className="max-h-[52vh] divide-y divide-linha overflow-y-auto rounded-xl border border-linha">
            {visiveis.map((l) => (
              <li key={l.chave} className={`flex gap-3 px-3 py-2.5 ${l.marcar ? "bg-white" : "bg-fundo/40"}`}>
                <input type="checkbox" checked={l.marcar} onChange={() => setLinhas((L) => L && L.map((x) => (x.chave === l.chave ? { ...x, marcar: !x.marcar } : x)))} aria-label={`Subir ${l.nome}`} className="mt-1 size-4 shrink-0 accent-[#0071e3]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold">{l.nome}</div>
                  <div className="text-[11.5px] text-suave"><span className="num">cód. {l.codigo}</span>{l.preco ? <b className="num text-tinta"> · {escolhido.moeda === "USD" ? "US$ " + l.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : l.preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</b> : " · sem preço"}{l.modelo && ` · ${l.modelo}`}{l.ncm && <span className="num"> · NCM {l.ncm}</span>} · pág. {l.pagina}</div>
                  {l.descricao && <p className="mt-0.5 line-clamp-2 text-[12px] text-suave">{l.descricao}</p>}
                  {l.existe && (
                    <p className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${l.existe.certeza === "igual" ? "bg-ok-claro text-ok" : "bg-atencao-claro text-atencao"}`}>
                      {l.existe.certeza === "igual" ? <CheckCircle2 className="size-3.5" /> : <Copy className="size-3.5" />}{l.existe.certeza === "igual" ? "Já existe:" : "Parecido com:"} {l.existe.nome}
                    </p>
                  )}
                </div>
              </li>
            ))}
            {!visiveis.length && <li className="px-3 py-6 text-center text-[13px] text-suave">{filtro === "novos" ? "Todos os produtos deste catálogo já estão no estoque." : "Nada aqui."}</li>}
          </ul>
        </>
      )}
    </Janela>
  );
}
