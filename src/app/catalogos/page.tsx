"use client";
// Catálogos dos fornecedores: PDFs guardados no Núcleo e links dos sites, por fornecedor.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hojeLocal } from "@/lib/texto";
import { BellRing, BookOpen, Check, CheckCircle2, ExternalLink, FileText, Link2, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { AtualizarPrecosCatalogo, type CatalogoPreco } from "@/components/catalogos/atualizar-precos";
import { catalogosPendentes, inicioDoMes, MESES_NOME } from "@/lib/catalogo-lembrete";
import { Shell } from "@/components/Shell";
import { Botao, campo, Janela, Rotulo } from "@/components/crm/ui";
import { lerTudo, mensagemErro, modoDemo, supabase } from "@/lib/supabase";
import { linkDocumento } from "@/lib/pasta";
import { usePapel } from "@/lib/usar-papel";
import { BuscaItensCatalogos } from "@/components/catalogos/busca-itens";

type Catalogo = { id: string; fornecedor: string; titulo: string; categoria: string | null; url: string | null; storage_path: string | null; arquivo_nome: string | null; tamanho_bytes: number | null; observacoes: string | null; created_at: string; moeda: string | null; conferido_em: string | null; precos_lidos_em: string | null };
const CATEGORIAS = ["Automação", "Áudio/Vídeo", "Rede", "CFTV", "Controle de acesso", "Iluminação", "Climatização", "Infraestrutura", "Geral"];
const tam = (b: number | null) => (!b ? "" : b > 1_048_576 ? `${(b / 1_048_576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.round(b / 1024)} KB`);

export default function Catalogos() {
  const [lista, setLista] = useState<Catalogo[] | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [q, setQ] = useState(""), [cat, setCat] = useState("");
  const [novo, setNovo] = useState<Partial<Catalogo> & { arquivo?: File | null } | null>(null);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const arq = useRef<HTMLInputElement>(null);
  const podeEditar = usePapel() !== "tecnico";   // técnico só consulta
  const [precos, setPrecos] = useState<CatalogoPreco | null>(null), [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    if (modoDemo) { setLista([]); return; }
    const db = supabase();
    const [c, p] = await Promise.all([db.from("catalogos").select("*").order("fornecedor").order("titulo"), lerTudo<{ marca: string | null; fornecedor: string | null }>(() => db.from("produtos").select("marca, fornecedor").order("id")).then((data) => ({ data }), () => ({ data: [] }))]);
    if (c.error) { setErro(mensagemErro(c.error)); setLista([]); return; }
    setLista(c.data as Catalogo[]);
    setSugestoes([...new Set((p.data ?? []).flatMap((x) => [x.marca, x.fornecedor]).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const grupos = useMemo(() => {
    const t = q.trim().toLowerCase();
    const L = (lista ?? []).filter((c) => (!cat || c.categoria === cat) && (!t || `${c.fornecedor} ${c.titulo} ${c.observacoes ?? ""}`.toLowerCase().includes(t)));
    const m = new Map<string, Catalogo[]>();
    for (const c of L) { const k = c.fornecedor.trim(); m.set(k, [...(m.get(k) ?? []), c]); }
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [lista, q, cat]);

  async function salvar() {
    if (!novo) return;
    setErro(""); setOcupado(true);
    try {
      if (!novo.fornecedor?.trim()) throw new Error("Informe o fornecedor.");
      if (!novo.arquivo && !novo.url?.trim() && !novo.storage_path) throw new Error("Envie o arquivo ou informe o link do catálogo.");
      const db = supabase();
      let storage_path: string | null = novo.storage_path ?? null;
      if (novo.arquivo) {
        storage_path = `catalogos/${novo.fornecedor.trim().replace(/[^\w]+/g, "_").toLowerCase()}/${Date.now().toString(36)}-${novo.arquivo.name.replace(/[^\w.\-]+/g, "_")}`;
        const up = await db.storage.from("documentos").upload(storage_path, novo.arquivo, { contentType: novo.arquivo.type || "application/octet-stream" });
        if (up.error) throw up.error;
      }
      const url = novo.url?.trim() ? (/^https?:\/\//i.test(novo.url.trim()) ? novo.url.trim() : `https://${novo.url.trim()}`) : null;
      const linha = {
        fornecedor: novo.fornecedor.trim(), titulo: novo.titulo?.trim() || novo.arquivo?.name.replace(/\.[a-z0-9]+$/i, "") || novo.arquivo_nome || "Site do fornecedor",
        categoria: novo.categoria || null, url, storage_path,
        arquivo_nome: novo.arquivo?.name ?? novo.arquivo_nome ?? null, tamanho_bytes: novo.arquivo?.size ?? novo.tamanho_bytes ?? null, observacoes: novo.observacoes?.trim() || null,
        moeda: novo.moeda === "USD" ? "USD" : "BRL",
        // tabela nova = conferida com o fornecedor neste mês
        ...(novo.arquivo ? { conferido_em: hojeLocal() } : {}),
      };
      const gravar = (l: Record<string, unknown>) => (novo.id ? db.from("catalogos").update(l).eq("id", novo.id!).select("id").single() : db.from("catalogos").insert(l).select("id").single());
      let { data: gravado, error } = await gravar(linha);
      // banco ainda sem a migração 0023: grava sem moeda/conferido
      if (error && /moeda|conferido_em|column/i.test(error.message)) {
        const { moeda: _m, conferido_em: _c, ...resto } = linha as Record<string, unknown>; void _m; void _c;
        ({ data: gravado, error } = await gravar(resto));
      }
      if (error) { if (novo.arquivo && storage_path) await db.storage.from("documentos").remove([storage_path]); throw error; }
      // trocou o arquivo: apaga a versão antiga
      if (novo.id && novo.arquivo) { const antigo = lista?.find((c) => c.id === novo.id)?.storage_path; if (antigo && antigo !== storage_path) await db.storage.from("documentos").remove([antigo]); }
      setNovo(null); carregar();
      // PDF novo: já lê os preços e mostra o que muda no estoque
      if (novo.arquivo && storage_path && /\.pdf$/i.test(storage_path) && gravado?.id) setPrecos({ id: gravado.id, fornecedor: linha.fornecedor, titulo: linha.titulo, storage_path, moeda: linha.moeda });
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  async function conferir(ids: string[]) {
    const { error } = await supabase().from("catalogos").update({ conferido_em: hojeLocal() }).in("id", ids);
    if (error) setErro(mensagemErro(error)); else carregar();
  }
  const pendentes = useMemo(() => ((lista ?? []).some((c) => "conferido_em" in c) ? catalogosPendentes(lista ?? []) : []), [lista]);
  const mes = MESES_NOME[new Date().getMonth()];
  const abrir = (c: Catalogo) => (c.storage_path ? linkDocumento(c.storage_path).then((u) => window.open(u, "_blank")) : Promise.resolve(window.open(c.url!, "_blank", "noopener"))).catch((e) => setErro(mensagemErro(e)));
  const excluir = async (c: Catalogo) => {
    if (!confirm(`Excluir “${c.titulo}” de ${c.fornecedor}? O arquivo guardado também é apagado.`)) return;
    const { error } = await supabase().from("catalogos").delete().eq("id", c.id);
    if (error) { setErro(mensagemErro(error)); return; }
    if (c.storage_path) await supabase().storage.from("documentos").remove([c.storage_path]);
    carregar();
  };

  return (
    <Shell titulo="Catálogos de fornecedores" acoes={podeEditar && <button onClick={() => setNovo({})} className="inline-flex items-center gap-1.5 rounded-xl bg-azul hover:bg-azul-escuro px-3.5 py-2 text-[13.5px] font-semibold text-white hover:shadow-lg"><Plus className="size-4" />Adicionar catálogo</button>}>
      {erro && !novo && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}</p>}
      {aviso && <p className="mb-4 flex items-center gap-2 rounded-xl bg-ok-claro px-4 py-3 text-[14px] text-ok"><CheckCircle2 className="size-4" />{aviso}</p>}
      {lista && pendentes.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[18px] border border-atencao/40 bg-atencao-claro px-4 py-3">
          <BellRing className="size-5 shrink-0 text-atencao" />
          <div className="min-w-0 flex-1 text-[13.5px]">
            <b className="text-tinta">Atualização mensal dos catálogos · {mes}</b>
            <span className="block text-suave">Confira as tabelas com os fornecedores e suba a versão nova. Faltam {pendentes.length} de {(lista ?? []).length}: {[...new Set(pendentes.map((c) => c.fornecedor))].slice(0, 6).join(", ")}{new Set(pendentes.map((c) => c.fornecedor)).size > 6 ? "…" : ""}.
              Ao subir um PDF novo, o Núcleo já atualiza compra e venda dos produtos.</span>
          </div>
          {podeEditar && <button onClick={() => { if (confirm(`Marcar os ${pendentes.length} catálogos como conferidos em ${mes}, sem trocar os arquivos?`)) conferir(pendentes.map((c) => c.id)); }} className="rounded-xl border border-linha bg-white px-3 py-1.5 text-[13px] font-semibold hover:border-azul">Marcar todos como conferidos</button>}
        </div>
      )}
      <BuscaItensCatalogos />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" /><input className={`${campo} pl-9`} placeholder="Filtrar fornecedor ou catálogo" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={`${campo} w-auto`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria"><option value="">Todas as categorias</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {!lista ? <div className="flex items-center gap-2 py-12 text-suave"><Loader2 className="size-5 animate-spin" />Carregando…</div>
        : !grupos.length ? (
          <div className="sombra-bra rounded-[18px] border border-linha bg-white px-6 py-12 text-center">
            <BookOpen className="mx-auto mb-3 size-8 text-marinho-500" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold">{lista.length ? "Nada encontrado." : "Nenhum catálogo ainda."}</p>
            <p className="mt-1 text-[13.5px] text-suave">Guarde aqui os PDFs e os links dos catálogos de Control4, Episode, Ubiquiti, Intelbras…</p>
            {!lista.length && podeEditar && <button onClick={() => setNovo({})} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-marinho-900 px-4 py-2 text-[14px] font-semibold text-white"><Plus className="size-4" />Adicionar o primeiro</button>}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {grupos.map(([forn, itens]) => (
              <section key={forn} className="sombra-bra rounded-[18px] border border-linha bg-white">
                <header className="flex items-center gap-2.5 border-b border-linha px-4 py-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-marinho-900 font-display text-[14px] font-extrabold text-white">{forn.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><h2 className="truncate text-[15px] font-bold">{forn}</h2><p className="text-[12px] text-suave">{itens.length} item(ns)</p></div>
                  {podeEditar && <button onClick={() => setNovo({ fornecedor: forn })} className="rounded-lg p-1.5 text-azul hover:bg-fundo" aria-label={`Adicionar catálogo de ${forn}`}><Plus className="size-4" /></button>}
                </header>
                <ul className="divide-y divide-linha">
                  {itens.map((c) => (
                    <li key={c.id} className="group flex items-center gap-3 px-4 py-2.5">
                      {c.storage_path ? <FileText className="size-4 shrink-0 text-erro" /> : <Link2 className="size-4 shrink-0 text-azul" />}
                      <button onClick={() => abrir(c)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[13.5px] font-semibold hover:text-azul">{c.titulo}</span>
                        <span className="block truncate text-[12px] text-suave">{[c.categoria, c.storage_path ? `${(c.arquivo_nome?.split(".").pop() ?? "pdf").toUpperCase()} ${tam(c.tamanho_bytes)}` : c.url?.replace(/^https?:\/\//, ""), c.observacoes].filter(Boolean).join(" · ")}</span>
                      </button>
                      {c.conferido_em && c.conferido_em >= inicioDoMes() ? <span title={`Conferido em ${c.conferido_em.split("-").reverse().join("/")}`} className="shrink-0 rounded-full bg-ok-claro px-2 py-0.5 text-[11px] font-bold text-ok">conferido</span>
                        : podeEditar ? <button onClick={() => conferir([c.id])} title="Já conferi com o fornecedor neste mês (sem mudança na tabela)" className="shrink-0 rounded-full bg-atencao-claro px-2 py-0.5 text-[11px] font-bold text-atencao hover:brightness-95">conferir</button> : null}
                      {c.moeda === "USD" && <span className="shrink-0 rounded bg-[#e9f7ee] px-1.5 text-[11px] font-bold text-ok">US$</span>}
                      {podeEditar && c.storage_path && /\.pdf$/i.test(c.storage_path) && <button onClick={() => setPrecos({ id: c.id, fornecedor: c.fornecedor, titulo: c.titulo, storage_path: c.storage_path, moeda: c.moeda })} className="rounded p-1 text-suave hover:text-azul" aria-label={`Atualizar preços do estoque com ${c.titulo}`} title="Atualizar compra e venda do estoque com esta tabela"><RefreshCw className="size-3.5" /></button>}
                      <ExternalLink className="size-3.5 shrink-0 text-suave" />
                      {podeEditar && <button onClick={() => setNovo({ ...c })} className="rounded p-1 text-suave hover:text-azul [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" aria-label={`Editar ${c.titulo}`}><Pencil className="size-3.5" /></button>}
                      {podeEditar && <button onClick={() => excluir(c)} className="rounded p-1 text-suave hover:text-erro [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" aria-label={`Excluir ${c.titulo}`}><Trash2 className="size-3.5" /></button>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

      <Janela titulo={novo?.id ? "Editar catálogo" : "Adicionar catálogo"} aberto={!!novo} onFechar={() => { setNovo(null); setErro(""); }}
        rodape={<><Botao tipo="pri" disabled={ocupado} onClick={salvar}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Salvar</Botao>{erro && <span className="text-[13px] text-erro">{erro}</span>}</>}>
        {novo && (
          <div className="grid grid-cols-2 gap-3">
            <Rotulo rotulo="Fornecedor / marca" className="col-span-2"><input className={campo} list="fornecedores" value={novo.fornecedor ?? ""} onChange={(e) => setNovo({ ...novo, fornecedor: e.target.value })} placeholder="Ex.: Control4" />
              <datalist id="fornecedores">{sugestoes.map((s) => <option key={s} value={s} />)}</datalist></Rotulo>
            <Rotulo rotulo="Título" className="col-span-2"><input className={campo} value={novo.titulo ?? ""} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} placeholder="Ex.: Catálogo 2026, Tabela de preços…" /></Rotulo>
            <Rotulo rotulo="Categoria"><select className={campo} value={novo.categoria ?? ""} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })}><option value="">—</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Rotulo>
            <Rotulo rotulo="Moeda dos preços"><select className={campo} value={novo.moeda === "USD" ? "USD" : "BRL"} onChange={(e) => setNovo({ ...novo, moeda: e.target.value })}><option value="BRL">Real (R$)</option><option value="USD">Dólar (US$) · converte pela cotação do dia</option></select></Rotulo>
            <Rotulo rotulo="Link (site ou catálogo online)"><input className={campo} value={novo.url ?? ""} onChange={(e) => setNovo({ ...novo, url: e.target.value })} placeholder="control4.com/…" /></Rotulo>
            <div className="col-span-2">
              <input ref={arq} type="file" accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*" hidden onChange={(e) => setNovo({ ...novo, arquivo: e.target.files?.[0] ?? null })} />
              <button type="button" onClick={() => arq.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-linha px-3 py-4 text-[13.5px] font-semibold hover:border-azul">
                <Upload className="size-4 text-azul" />{novo.arquivo ? `${novo.arquivo.name} · ${tam(novo.arquivo.size)}` : novo.arquivo_nome ? `${novo.arquivo_nome} · clique para trocar` : "Enviar o catálogo em PDF, Word ou Excel (opcional)"}
              </button>
            </div>
            <Rotulo rotulo="Observações" className="col-span-2"><input className={campo} value={novo.observacoes ?? ""} onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })} placeholder="Representante, condições, validade…" /></Rotulo>
          </div>
        )}
      </Janela>
      <AtualizarPrecosCatalogo catalogo={precos} onFechar={() => setPrecos(null)} onAtualizado={(n) => { setAviso(`${n} produto(s) com compra e venda atualizadas pelo catálogo.`); carregar(); setTimeout(() => setAviso(""), 6000); }} />
    </Shell>
  );
}
