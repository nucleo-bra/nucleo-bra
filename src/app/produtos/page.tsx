"use client";
// Cadastro de produtos e serviços (o mesmo do Zenith) e o estoque de cada item.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Box, Check, FileText, Loader2, Package, Plus, Search, Upload, Wrench } from "lucide-react";
import { Shell } from "@/components/Shell";
import { campo, Janela, Kpi, reais, Rotulo } from "@/components/crm/ui";
import { mensagemErro } from "@/lib/supabase";
import { ajustarEstoque, buscarNoCatalogo, carregarCatalogo, enviarFotoProduto, fotoProduto, Produto, salvarProduto, Servico } from "@/lib/orcamentos";

const CATEGORIAS = ["Automação", "Rede", "Áudio/Vídeo", "CFTV", "Controle de acesso", "Infraestrutura", "Geral"];
const UNIDADES = ["Unidade", "Par", "Rolo", "Metro"];
const r2 = (v: number) => Math.round(v * 100) / 100;

function Foto({ p, className = "size-11" }: { p: Pick<Produto, "imagem_path">; className?: string }) {
  const u = fotoProduto(p.imagem_path);
  // eslint-disable-next-line @next/next/no-img-element
  return u ? <img src={u} alt="" loading="lazy" className={`${className} shrink-0 rounded-lg border border-linha bg-white object-contain`} /> : <span className={`${className} grid shrink-0 place-items-center rounded-lg border border-linha bg-fundo text-suave`}><Box className="size-4" /></span>;
}

function FichaProduto({ produto, onFechar, onSalvo }: { produto: Partial<Produto> | null; onFechar: () => void; onSalvo: () => void }) {
  const [p, setP] = useState<Partial<Produto>>({});
  const [saldo, setSaldo] = useState(0), [obs, setObs] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const arq = useRef<HTMLInputElement>(null);
  useEffect(() => { setP(produto ?? {}); setSaldo(produto?.saldo ?? 0); setObs(""); setFoto(null); setErro(""); }, [produto]);
  if (!produto) return null;
  const s = (k: keyof Produto, numero = false) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setP((x) => ({ ...x, [k]: numero ? Number(e.target.value.replace(",", ".")) || 0 : e.target.value }));
  // Mesmo cálculo do Zenith: compra + impostos = custo; custo × multiplicador = venda
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
  const previa = foto ? URL.createObjectURL(foto) : fotoProduto(p.imagem_path);
  return (
    <Janela titulo={produto.id ? `${produto.codigo ?? ""} ${produto.codigo != null ? "- " : ""}${produto.nome}` : "Novo produto"} aberto onFechar={onFechar} largura="max-w-3xl"
      rodape={<><button type="button" onClick={salvar} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-50">{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Salvar produto</button>{erro && <span className="text-[13px] text-erro">{erro}</span>}</>}>
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previa ? <img src={previa} alt="" className="size-40 rounded-xl border border-linha bg-white object-contain" /> : <span className="grid size-40 place-items-center rounded-xl border border-dashed border-linha text-suave"><Box className="size-8" /></span>}
          <input ref={arq} type="file" accept="image/*" hidden onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => arq.current?.click()} className="inline-flex w-40 items-center justify-center gap-1.5 rounded-xl border border-linha px-3 py-1.5 text-[13px] font-semibold hover:shadow-md"><Upload className="size-4" />Trocar foto</button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Rotulo rotulo="* Nome comercial (sai no orçamento)" className="col-span-2 sm:col-span-4"><input className={campo} value={p.nome ?? ""} onChange={s("nome")} /></Rotulo>
          <Rotulo rotulo="Fabricante"><input className={campo} value={p.marca ?? ""} onChange={s("marca")} /></Rotulo>
          <Rotulo rotulo="Nome interno / modelo" className="sm:col-span-2"><input className={campo} value={p.modelo ?? ""} onChange={s("modelo")} /></Rotulo>
          <Rotulo rotulo="Categoria"><select className={campo} value={p.categoria ?? ""} onChange={s("categoria")}><option value="">—</option>{[...new Set([...CATEGORIAS, p.categoria].filter(Boolean))].map((c) => <option key={c}>{c}</option>)}</select></Rotulo>
          <Rotulo rotulo="Unidade"><select className={campo} value={p.unidade ?? "Unidade"} onChange={s("unidade")}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select></Rotulo>
          <Rotulo rotulo="Fornecedor"><input className={campo} value={p.fornecedor ?? ""} onChange={s("fornecedor")} /></Rotulo>
          <Rotulo rotulo="Referência"><input className={campo} value={p.referencia ?? ""} onChange={s("referencia")} /></Rotulo>
          <Rotulo rotulo="NCM"><input className={campo} value={p.ncm ?? ""} onChange={s("ncm")} /></Rotulo>
          <Rotulo rotulo="Descrição comercial (sai no orçamento)" className="col-span-2 sm:col-span-4"><textarea className={campo} rows={4} value={p.descricao ?? ""} onChange={s("descricao")} /></Rotulo>
        </div>
      </div>
      <h3 className="mt-5 mb-2 text-[13px] font-bold">Preço</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Rotulo rotulo="Valor compra (R$)"><input className={campo} inputMode="decimal" value={p.valor_compra ?? 0} onChange={(e) => setP((x) => recalcular({ ...x, valor_compra: Number(e.target.value.replace(",", ".")) || 0 }))} /></Rotulo>
        <Rotulo rotulo="% impostos"><input className={campo} inputMode="decimal" value={p.impostos_pct ?? 0} onChange={(e) => setP((x) => recalcular({ ...x, impostos_pct: Number(e.target.value.replace(",", ".")) || 0 }))} /></Rotulo>
        <Rotulo rotulo="Custo (R$)"><input className={`${campo} bg-fundo`} readOnly value={reais(p.custo ?? 0)} /></Rotulo>
        <Rotulo rotulo="Multiplicador"><input className={campo} inputMode="decimal" value={p.fator_venda ?? 2} onChange={(e) => setP((x) => recalcular({ ...x, fator_venda: Number(e.target.value.replace(",", ".")) || 0 }))} /></Rotulo>
        <Rotulo rotulo="Valor venda (R$)"><input className={`${campo} font-semibold`} inputMode="decimal" value={p.preco_venda ?? 0} onChange={s("preco_venda", true)} /></Rotulo>
      </div>
      <h3 className="mt-5 mb-2 text-[13px] font-bold">Estoque</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Rotulo rotulo="Saldo em estoque"><input className={campo} type="number" step="any" value={saldo} onChange={(e) => setSaldo(Number(e.target.value) || 0)} /></Rotulo>
        <Rotulo rotulo="Mínimo"><input className={campo} type="number" step="any" value={p.estoque_minimo ?? 0} onChange={s("estoque_minimo", true)} /></Rotulo>
        <Rotulo rotulo="Localização"><input className={campo} value={p.local_estoque ?? ""} onChange={s("local_estoque")} placeholder="Ex.: D2" /></Rotulo>
        {saldo !== (produto.saldo ?? 0) && <Rotulo rotulo="Motivo do ajuste"><input className={campo} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Inventário, compra…" /></Rotulo>}
      </div>
    </Janela>
  );
}

function Conteudo() {
  const params = useSearchParams(), router = useRouter();
  const [cat, setCat] = useState<{ produtos: Produto[]; servicos: Servico[] } | null>(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<"produtos" | "servicos">("produtos");
  const [q, setQ] = useState(""), [categoria, setCategoria] = useState(""), [so, setSo] = useState<"" | "estoque" | "baixo">("");
  const [editar, setEditar] = useState<Partial<Produto> | null>(null);
  const [pagina, setPagina] = useState(1);
  const recarregar = (forcar = false) => carregarCatalogo(forcar).then(setCat).catch((e) => setErro(mensagemErro(e)));
  useEffect(() => { recarregar(); }, []);
  useEffect(() => { const id = params.get("id"); if (id && cat) setEditar(cat.produtos.find((p) => p.id === id) ?? null); }, [params, cat]);
  const campos = useMemo(() => (p: Produto) => `${p.modelo} ${p.marca} ${p.referencia} ${p.fornecedor}`, []);
  const filtrados = useMemo(() => {
    if (!cat) return [];
    let l = q ? buscarNoCatalogo(cat.produtos, q, campos, 10000) : cat.produtos;
    if (categoria) l = l.filter((p) => p.categoria === categoria);
    if (so === "estoque") l = l.filter((p) => p.saldo > 0);
    if (so === "baixo") l = l.filter((p) => p.estoque_minimo > 0 && p.saldo < p.estoque_minimo);
    return l;
  }, [cat, q, categoria, so, campos]);
  useEffect(() => setPagina(1), [q, categoria, so]);
  const POR = 60;

  const kpis = cat && {
    itens: cat.produtos.length,
    emEstoque: cat.produtos.filter((p) => p.saldo > 0).length,
    valorCusto: cat.produtos.reduce((s, p) => s + Math.max(0, p.saldo) * p.custo, 0),
    baixo: cat.produtos.filter((p) => p.estoque_minimo > 0 && p.saldo < p.estoque_minimo).length,
  };
  return (
    <Shell titulo="Produtos e estoque" acoes={<button type="button" onClick={() => setEditar({ unidade: "Unidade", fator_venda: 2, impostos_pct: 0, ativo: true, saldo: 0 })} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-br to-br-escuro px-3.5 py-2 text-[13.5px] font-semibold text-white hover:shadow-lg"><Plus className="size-4" />Novo produto</button>}>
      {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}</p>}
      {!cat ? <div className="flex items-center gap-2 py-16 text-suave"><Loader2 className="size-5 animate-spin" />Carregando cadastro…</div> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi rotulo="Produtos cadastrados" valor={kpis!.itens.toLocaleString("pt-BR")} cor="#2f6fb5" detalhe={`${cat.servicos.length} serviços`} />
            <Kpi rotulo="Com saldo em estoque" valor={kpis!.emEstoque.toLocaleString("pt-BR")} cor="#22c7d6" onClick={() => setSo(so === "estoque" ? "" : "estoque")} />
            <Kpi rotulo="Estoque a custo" valor={reais(kpis!.valorCusto)} cor="#7c5cd6" />
            <Kpi rotulo="Abaixo do mínimo" valor={kpis!.baixo.toLocaleString("pt-BR")} cor="#f5821f" tom={kpis!.baixo ? "text-atencao" : ""} onClick={() => setSo(so === "baixo" ? "" : "baixo")} />
          </div>
          <section className="sombra-bra rounded-[18px] border border-linha bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-linha px-4 pt-3 pb-3">
              {([["produtos", "Produtos", Package], ["servicos", "Serviços", Wrench]] as const).map(([k, rot, I]) => (
                <button key={k} type="button" onClick={() => setAba(k)} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold ${aba === k ? "bg-marinho-900 text-white" : "bg-fundo text-suave"}`}><I className="size-4" />{rot}</button>
              ))}
              {aba === "produtos" && <>
                <div className="relative min-w-[220px] flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" /><input className={`${campo} pl-9`} placeholder="Código, nome, modelo, fabricante…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <select className={`${campo} w-auto`} value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria"><option value="">Todas as categorias</option>{[...new Set(cat.produtos.map((p) => p.categoria).filter(Boolean))].sort().map((c) => <option key={c}>{c}</option>)}</select>
                <select className={`${campo} w-auto`} value={so} onChange={(e) => setSo(e.target.value as typeof so)} aria-label="Estoque"><option value="">Todo o estoque</option><option value="estoque">Com saldo</option><option value="baixo">Abaixo do mínimo</option></select>
              </>}
            </div>
            {aba === "produtos" ? (<>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-[13.5px]">
                  <thead><tr className="border-b border-linha bg-fundo text-left text-[12px] font-semibold text-suave">
                    <th className="px-3 py-2">Código</th><th className="px-2 py-2">Produto</th><th className="px-2 py-2">Categoria</th><th className="px-2 py-2 text-right">Estoque</th>
                    <th className="px-2 py-2 text-right">Custo</th><th className="px-2 py-2 text-right">Venda</th><th className="px-3 py-2 text-right">Mult.</th>
                  </tr></thead>
                  <tbody>
                    {filtrados.slice(0, pagina * POR).map((p) => (
                      <tr key={p.id} onClick={() => setEditar(p)} className="cursor-pointer border-b border-linha last:border-0 hover:bg-fundo/60">
                        <td className="num px-3 py-2 text-suave">{p.codigo ?? "—"}</td>
                        <td className="px-2 py-2"><div className="flex items-center gap-2.5"><Foto p={p} className="size-10" /><div className="min-w-0"><div className="truncate font-medium">{p.nome}</div><div className="truncate text-[12px] text-suave">{[p.marca, p.modelo].filter(Boolean).join(" • ")}</div></div>{!p.descricao && <span title="Sem descrição comercial"><FileText className="size-3.5 shrink-0 text-atencao" /></span>}</div></td>
                        <td className="px-2 py-2 text-suave">{p.categoria}</td>
                        <td className={`num px-2 py-2 text-right font-semibold ${p.estoque_minimo > 0 && p.saldo < p.estoque_minimo ? "text-atencao" : p.saldo > 0 ? "" : "text-suave"}`}>{p.estoque_minimo > 0 && p.saldo < p.estoque_minimo && <AlertTriangle className="mr-1 inline size-3.5" />}{p.saldo.toLocaleString("pt-BR")}{p.local_estoque ? <span className="ml-1 text-[11px] font-normal text-suave">{p.local_estoque}</span> : null}</td>
                        <td className="num px-2 py-2 text-right text-suave">{reais(p.custo)}</td>
                        <td className="num px-2 py-2 text-right font-semibold">{reais(p.preco_venda)}</td>
                        <td className="num px-3 py-2 text-right text-suave">{p.custo ? (p.preco_venda / p.custo).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-[13px] text-suave">
                <span>{filtrados.length.toLocaleString("pt-BR")} produto(s)</span>
                {filtrados.length > pagina * POR && <button type="button" onClick={() => setPagina(pagina + 1)} className="font-semibold text-azul hover:underline">Mostrar mais</button>}
              </div>
            </>) : (
              <ul className="divide-y divide-linha">
                {cat.servicos.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-4 py-3 text-[13.5px]">
                    <span className="num w-8 text-suave">{s.codigo}</span>
                    <div className="min-w-0 flex-1"><div className="font-medium">{s.nome}</div><div className="text-[12.5px] whitespace-pre-line text-suave">{s.categoria}{s.descricao ? ` · ${s.descricao}` : ""}</div></div>
                    <span className="num font-semibold">{reais(s.valor)}</span>
                  </li>
                ))}
                {!cat.servicos.length && <li className="px-4 py-6 text-center text-suave">Nenhum serviço cadastrado.</li>}
              </ul>
            )}
          </section>
        </div>
      )}
      <FichaProduto produto={editar} onFechar={() => { setEditar(null); if (params.get("id")) router.replace("/produtos/"); }} onSalvo={() => { setEditar(null); recarregar(true); }} />
    </Shell>
  );
}
export default function ProdutosPagina() { return <Suspense><Conteudo /></Suspense>; }

