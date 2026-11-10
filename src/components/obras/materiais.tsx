"use client";
// Materiais da obra: saída/devolução com baixa no estoque e conferência com o que foi vendido.
import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CheckCheck, ClipboardCheck, History, PackageMinus, Search } from "lucide-react";
import { Caixa } from "@/components/projetos/painel-quadro";
import { fotoProduto } from "@/lib/orcamentos";
import { buscarProdutos, CLASSIFICACAO, conferencia, ObraCompleta, preverClassificacao, ProdutoBusca, registrarSaida, revisarSaida } from "@/lib/obras";
import { mensagemErro } from "@/lib/supabase";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const SIT = {
  ok: { rot: "Completo", cor: "#1f8a3b", fundo: "#e8f7ec" }, falta: { rot: "Falta sair", cor: "#0071e3", fundo: "#e8f1fd" },
  excedente: { rot: "Excedente", cor: "#c25e00", fundo: "#fff2e6" }, fora: { rot: "Fora do orçamento", cor: "#d70015", fundo: "#ffe9ea" },
  substituto: { rot: "Substituto", cor: "#8944ab", fundo: "#f4ecfa" },
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Materiais({ d, papel, onMudou }: { d: ObraCompleta; papel: string | null; onMudou: () => void }) {
  const [prods, setProds] = useState<ProdutoBusca[]>([]);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<ProdutoBusca | null>(null);
  const [q, setQ] = useState("1");
  const [tipo, setTipo] = useState<"saida" | "devolucao">("saida");
  const [subst, setSubst] = useState("");
  const [just, setJust] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [enviando, setEnviando] = useState(false);
  const diretoria = papel === "diretoria", valores = papel === "diretoria" || papel === "financeiro";
  useEffect(() => { buscarProdutos().then(setProds).catch((e) => setErro(mensagemErro(e))); }, []);
  useEffect(() => { if (!ok) return; const t = setTimeout(() => setOk(""), 3500); return () => clearTimeout(t); }, [ok]);

  const conf = useMemo(() => conferencia(d.itens, d.saidas), [d.itens, d.saidas]);
  const sistemas = [...new Set(conf.map((l) => l.sistema))];
  const vendidos = useMemo(() => new Set(d.itens.map((i) => i.produto_id).filter(Boolean)), [d.itens]);
  const achados = useMemo(() => {
    const t = norm(busca.trim()); if (!t) return [];
    return prods.filter((p) => norm(`${p.nome} ${p.marca ?? ""} ${p.modelo ?? ""} ${p.zenith_id ?? ""}`).includes(t))
      .sort((a, b) => Number(vendidos.has(b.id)) - Number(vendidos.has(a.id))).slice(0, 12);
  }, [busca, prods, vendidos]);
  const n = Number(q.replace(",", ".")) || 0;
  const prev = sel && n > 0 ? (tipo === "devolucao" ? "devolucao" : preverClassificacao(d.itens, d.saidas, sel.id, n, subst || null)) : null;
  const precisaJust = prev === "excedente" || prev === "nao_vendido";
  // itens da proposta que podem ser substituídos (mesma categoria/marca primeiro)
  const candidatos = useMemo(() => {
    if (!sel) return [];
    return [...d.itens].sort((a, b) => {
      const pa = prods.find((p) => p.id === a.produto_id), pb = prods.find((p) => p.id === b.produto_id);
      const s = (p?: ProdutoBusca) => (p?.categoria && p.categoria === sel.categoria ? 2 : 0) + (p?.marca && p.marca === sel.marca ? 1 : 0);
      return s(pb) - s(pa);
    });
  }, [sel, d.itens, prods]);

  function escolher(p: ProdutoBusca, quant?: number) { setSel(p); setBusca(""); setSubst(""); setJust(""); if (quant) setQ(String(quant)); }
  async function registrar() {
    if (!sel || !(n > 0)) return;
    if (precisaJust && !just.trim()) { setErro("Explique o motivo — este item vai para a revisão da diretoria."); return; }
    setEnviando(true); setErro("");
    try {
      const cl = await registrarSaida({ obra_id: d.obra.id, produto_id: sel.id, quantidade: n, tipo, substitui_item: subst || null, justificativa: just });
      setOk(`${tipo === "devolucao" ? "Devolução" : "Saída"} registrada · ${CLASSIFICACAO[cl].rot}. Estoque atualizado e diretoria avisada.`);
      setSel(null); setQ("1"); setSubst(""); setJust(""); setTipo("saida"); onMudou();
      buscarProdutos().then(setProds).catch(() => {});
    } catch (e) { setErro(mensagemErro(e)); } finally { setEnviando(false); }
  }
  const pendentes = d.saidas.filter((s) => !s.revisado_em);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 xl:grid-cols-3">
      <div className="space-y-4 lg:space-y-5 xl:col-span-2">
        <Caixa titulo="Conferência: vendido × saído" icone={ClipboardCheck}>
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead><tr className="border-y border-linha bg-[#f7f9fc] text-[12px] text-suave">
                <th className="py-2 pl-5">Item</th><th className="w-20 text-right">Vendido</th><th className="w-20 text-right">Saiu</th><th className="w-20 text-right">Saldo</th><th className="w-36 pl-4">Situação</th>{valores && <th className="w-28 pr-5 text-right">Custo saído</th>}<th className="w-24 pr-5" />
              </tr></thead>
              {sistemas.map((s) => (
                <tbody key={s} className="divide-y divide-linha">
                  <tr><td colSpan={7} className="bg-white pt-3 pb-1 pl-5 text-[11.5px] font-bold tracking-[.1em] text-suave uppercase">{s}</td></tr>
                  {conf.filter((l) => l.sistema === s).map((l) => { const st = SIT[l.situacao]; const p = prods.find((x) => x.id === l.produto_id); return (
                    <tr key={l.chave}>
                      <td className="py-2 pl-5"><b className="block max-w-[340px] truncate">{l.descricao}</b><span className="text-[12px] text-suave">{l.marca ?? ""}{p ? ` · estoque: ${qtd(p.saldo)}` : ""}</span></td>
                      <td className="num text-right">{qtd(l.vendido)}</td><td className="num text-right">{qtd(l.saiu)}</td>
                      <td className={`num text-right font-semibold ${l.saldo < 0 ? "text-atencao" : ""}`}>{qtd(l.saldo)}</td>
                      <td className="pl-4"><span className="rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ color: st.cor, background: st.fundo }}>{st.rot}</span></td>
                      {valores && <td className="num pr-5 text-right text-[12.5px]">{reais(l.custoSaiu)}</td>}
                      <td className="pr-5 text-right">{l.saldo > 0 && p && <button onClick={() => { escolher(p, l.saldo); setTipo("saida"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-[12.5px] font-semibold text-azul">Dar saída</button>}</td>
                    </tr>); })}
                </tbody>
              ))}
              {!conf.length && <tbody><tr><td colSpan={7} className="py-8 text-center text-suave">Sem itens do orçamento nem saídas ainda.</td></tr></tbody>}
            </table>
          </div>
        </Caixa>

        <Caixa titulo="Histórico de saídas e devoluções" icone={History}>
          <ul className="divide-y divide-linha text-[13px]">
            {d.saidas.map((s) => { const c = CLASSIFICACAO[s.classificacao]; const sub = s.substitui_item ? d.itens.find((i) => i.id === s.substitui_item) : null; return (
              <li key={s.id} className="flex items-start gap-3 py-2.5">
                {s.produto?.imagem_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoProduto(s.produto.imagem_path) ?? ""} alt="" className="size-10 shrink-0 rounded-lg bg-fundo object-contain" />) : <span className="size-10 shrink-0 rounded-lg bg-fundo" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><b>{s.tipo === "devolucao" ? "↩ " : ""}{qtd(s.quantidade)}× {s.produto?.nome ?? "Produto"}</b>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: c.cor, background: c.fundo }}>{c.rot}</span></div>
                  <div className="text-[12px] text-suave">{s.autor?.nome ?? "—"} · {new Date(s.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{valores && s.custo_unit ? ` · ${reais(s.custo_unit * s.quantidade)}` : ""}</div>
                  {sub && <div className="text-[12.5px]">Substitui: <b>{sub.descricao}</b></div>}
                  {s.justificativa && <div className="text-[12.5px] text-[#374151]">“{s.justificativa}”</div>}
                </div>
                {!s.revisado_em && (diretoria
                  ? <button onClick={async () => { try { await revisarSaida(s.id); onMudou(); } catch (e) { setErro(mensagemErro(e)); } }} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-linha px-2 py-1 text-[12px] font-semibold hover:border-azul"><CheckCheck className="size-3.5" />Revisado</button>
                  : <span className="shrink-0 rounded-full bg-atencao-claro px-2 py-0.5 text-[11px] font-bold text-atencao">Aguardando diretoria</span>)}
              </li>); })}
            {!d.saidas.length && <li className="py-6 text-center text-suave">Nenhuma movimentação ainda.</li>}
          </ul>
        </Caixa>
      </div>

      <div className="space-y-4 lg:space-y-5">
        <Caixa titulo="Registrar movimentação" icone={PackageMinus}>
          <div className="space-y-3 text-[13.5px]">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-fundo p-1">
              {([["saida", "Saída para a obra", ArrowUpFromLine], ["devolucao", "Devolução", ArrowDownToLine]] as const).map(([k, rot, I]) => (
                <button key={k} onClick={() => setTipo(k)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold ${tipo === k ? "bg-white shadow-sm" : "text-suave"}`}><I className="size-4" />{rot}</button>))}
            </div>
            {sel ? (
              <div className="flex items-center gap-3 rounded-xl border border-azul bg-[#f4f8ff] p-2.5">
                {sel.imagem_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoProduto(sel.imagem_path) ?? ""} alt="" className="size-11 rounded-lg bg-white object-contain" />) : <span className="size-11 rounded-lg bg-white" />}
                <div className="min-w-0 flex-1"><b className="block truncate">{sel.nome}</b><span className="text-[12px] text-suave">{sel.marca} · estoque {qtd(sel.saldo)} {sel.unidade}</span></div>
                <button onClick={() => setSel(null)} className="text-[12.5px] font-semibold text-azul">Trocar</button>
              </div>
            ) : (
              <div className="relative">
                <label className="flex items-center gap-2 rounded-xl border border-linha bg-white px-3 py-2"><Search className="size-4 text-suave" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Produto: nome, marca, modelo ou código" aria-label="Buscar produto" className="w-full bg-transparent outline-none" /></label>
                {achados.length > 0 && <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-80 overflow-y-auto rounded-xl border border-linha bg-white shadow-xl">
                  {achados.map((p) => <li key={p.id}><button onClick={() => escolher(p)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f4f8ff]">
                    <span className="min-w-0 flex-1"><b className="block truncate text-[13px]">{p.nome}</b><span className="text-[11.5px] text-suave">{p.marca} · est. {qtd(p.saldo)}</span></span>
                    {vendidos.has(p.id) ? <span className="rounded-full bg-ok-claro px-1.5 py-0.5 text-[10.5px] font-bold text-ok">No orçamento</span> : <span className="rounded-full bg-fundo px-1.5 py-0.5 text-[10.5px] font-bold text-suave">Fora</span>}
                  </button></li>)}
                </ul>}
              </div>
            )}
            <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Quantidade</span>
              <input inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} className="w-full rounded-xl border border-linha bg-white px-3 py-2 outline-none focus:border-azul" /></label>
            {tipo === "saida" && sel && !vendidos.has(sel.id) && (
              <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Está substituindo um item da proposta?</span>
                <select value={subst} onChange={(e) => setSubst(e.target.value)} className="w-full rounded-xl border border-linha bg-white px-3 py-2">
                  <option value="">Não, é um item a mais</option>
                  {candidatos.map((i) => <option key={i.id} value={i.id}>{i.descricao} ({qtd(i.quantidade)} {i.unidade})</option>)}
                </select></label>
            )}
            {prev && <p className="flex items-center gap-2 text-[12.5px]">Vai entrar como <span className="rounded-full px-2 py-0.5 font-bold" style={{ color: CLASSIFICACAO[prev].cor, background: CLASSIFICACAO[prev].fundo }}>{CLASSIFICACAO[prev].rot}</span></p>}
            {(precisaJust || prev === "substituto") && <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Motivo {precisaJust ? "(obrigatório)" : ""}</span>
              <textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} placeholder={prev === "excedente" ? "Ex.: cliente pediu mais um ponto na varanda" : prev === "substituto" ? "Ex.: modelo anterior fora de linha" : "Ex.: item não previsto, necessário para…"} className="w-full rounded-xl border border-linha bg-white px-3 py-2 outline-none focus:border-azul" /></label>}
            <button onClick={registrar} disabled={!sel || !(n > 0) || enviando} className="w-full rounded-xl bg-azul py-2.5 font-semibold text-white hover:bg-azul-escuro disabled:opacity-40">{enviando ? "Registrando…" : tipo === "saida" ? "Dar saída e baixar do estoque" : "Devolver ao estoque"}</button>
            {sel && tipo === "saida" && n > sel.saldo && <p className="text-[12px] text-atencao">Atenção: o estoque mostra {qtd(sel.saldo)} {sel.unidade}. A saída fica registrada e o saldo fica negativo até a entrada ser lançada.</p>}
            {ok && <p className="rounded-xl bg-ok-claro px-3 py-2 text-[12.5px] font-semibold text-ok">{ok}</p>}
            {erro && <p role="alert" className="rounded-xl bg-erro-claro px-3 py-2 text-[12.5px] text-erro">{erro}</p>}
            <p className="text-[12px] text-suave">Toda movimentação avisa os diretores. Itens fora do orçamento, excedentes e substitutos ficam destacados para revisão.</p>
          </div>
        </Caixa>
        {diretoria && pendentes.length > 0 && <p className="rounded-2xl bg-atencao-claro px-4 py-3 text-[13px] text-atencao"><b>{pendentes.length}</b> saída(s) aguardando sua revisão no histórico.</p>}
      </div>
    </div>
  );
}
