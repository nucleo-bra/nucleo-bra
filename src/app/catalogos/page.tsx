"use client";
// Catálogos dos fornecedores: PDFs guardados no Núcleo e links dos sites, por fornecedor.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ExternalLink, FileText, Link2, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Botao, campo, Janela, Rotulo } from "@/components/crm/ui";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";
import { linkDocumento } from "@/lib/pasta";

type Catalogo = { id: string; fornecedor: string; titulo: string; categoria: string | null; url: string | null; storage_path: string | null; arquivo_nome: string | null; tamanho_bytes: number | null; observacoes: string | null; created_at: string };
const CATEGORIAS = ["Automação", "Áudio/Vídeo", "Rede", "CFTV", "Controle de acesso", "Iluminação", "Climatização", "Infraestrutura", "Geral"];
const tam = (b: number | null) => (!b ? "" : b > 1_048_576 ? `${(b / 1_048_576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.round(b / 1024)} KB`);

export default function Catalogos() {
  const [lista, setLista] = useState<Catalogo[] | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [q, setQ] = useState(""), [cat, setCat] = useState("");
  const [novo, setNovo] = useState<Partial<Catalogo> & { arquivo?: File | null } | null>(null);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const arq = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    if (modoDemo) { setLista([]); return; }
    const db = supabase();
    const [c, p] = await Promise.all([db.from("catalogos").select("*").order("fornecedor").order("titulo"), db.from("produtos").select("marca, fornecedor").limit(2000)]);
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
      if (!novo.arquivo && !novo.url?.trim()) throw new Error("Envie o PDF ou informe o link do catálogo.");
      const db = supabase();
      let storage_path: string | null = null;
      if (novo.arquivo) {
        storage_path = `catalogos/${novo.fornecedor.trim().replace(/[^\w]+/g, "_").toLowerCase()}/${Date.now().toString(36)}-${novo.arquivo.name.replace(/[^\w.\-]+/g, "_")}`;
        const up = await db.storage.from("documentos").upload(storage_path, novo.arquivo, { contentType: novo.arquivo.type || "application/pdf" });
        if (up.error) throw up.error;
      }
      const url = novo.url?.trim() ? (/^https?:\/\//i.test(novo.url.trim()) ? novo.url.trim() : `https://${novo.url.trim()}`) : null;
      const { error } = await db.from("catalogos").insert({
        fornecedor: novo.fornecedor.trim(), titulo: novo.titulo?.trim() || novo.arquivo?.name.replace(/\.pdf$/i, "") || "Site do fornecedor",
        categoria: novo.categoria || null, url, storage_path, arquivo_nome: novo.arquivo?.name ?? null, tamanho_bytes: novo.arquivo?.size ?? null, observacoes: novo.observacoes?.trim() || null,
      });
      if (error) throw error;
      setNovo(null); carregar();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  const abrir = (c: Catalogo) => (c.storage_path ? linkDocumento(c.storage_path).then((u) => window.open(u, "_blank")) : Promise.resolve(window.open(c.url!, "_blank", "noopener"))).catch((e) => setErro(mensagemErro(e)));
  const excluir = async (c: Catalogo) => {
    if (!confirm(`Tirar “${c.titulo}” de ${c.fornecedor} dos catálogos?`)) return;
    const { error } = await supabase().from("catalogos").delete().eq("id", c.id);
    if (error) setErro(mensagemErro(error)); else carregar();
  };

  return (
    <Shell titulo="Catálogos de fornecedores" acoes={<button onClick={() => setNovo({})} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-br to-br-escuro px-3.5 py-2 text-[13.5px] font-semibold text-white hover:shadow-lg"><Plus className="size-4" />Adicionar catálogo</button>}>
      {erro && !novo && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}</p>}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" /><input className={`${campo} pl-9`} placeholder="Buscar fornecedor ou catálogo" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={`${campo} w-auto`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria"><option value="">Todas as categorias</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
      </div>
      {!lista ? <div className="flex items-center gap-2 py-12 text-suave"><Loader2 className="size-5 animate-spin" />Carregando…</div>
        : !grupos.length ? (
          <div className="sombra-bra rounded-[18px] border border-linha bg-white px-6 py-12 text-center">
            <BookOpen className="mx-auto mb-3 size-8 text-marinho-500" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold">{lista.length ? "Nada encontrado." : "Nenhum catálogo ainda."}</p>
            <p className="mt-1 text-[13.5px] text-suave">Guarde aqui os PDFs e os links dos catálogos de Control4, Episode, Ubiquiti, Intelbras…</p>
            {!lista.length && <button onClick={() => setNovo({})} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-marinho-900 px-4 py-2 text-[14px] font-semibold text-white"><Plus className="size-4" />Adicionar o primeiro</button>}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {grupos.map(([forn, itens]) => (
              <section key={forn} className="sombra-bra rounded-[18px] border border-linha bg-white">
                <header className="flex items-center gap-2.5 border-b border-linha px-4 py-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-marinho-900 font-display text-[14px] font-extrabold text-white">{forn.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><h2 className="truncate text-[15px] font-bold">{forn}</h2><p className="text-[12px] text-suave">{itens.length} item(ns)</p></div>
                  <button onClick={() => setNovo({ fornecedor: forn })} className="rounded-lg p-1.5 text-azul hover:bg-fundo" aria-label={`Adicionar catálogo de ${forn}`}><Plus className="size-4" /></button>
                </header>
                <ul className="divide-y divide-linha">
                  {itens.map((c) => (
                    <li key={c.id} className="group flex items-center gap-3 px-4 py-2.5">
                      {c.storage_path ? <FileText className="size-4 shrink-0 text-erro" /> : <Link2 className="size-4 shrink-0 text-azul" />}
                      <button onClick={() => abrir(c)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[13.5px] font-semibold hover:text-azul">{c.titulo}</span>
                        <span className="block truncate text-[12px] text-suave">{[c.categoria, c.storage_path ? `PDF ${tam(c.tamanho_bytes)}` : c.url?.replace(/^https?:\/\//, ""), c.observacoes].filter(Boolean).join(" · ")}</span>
                      </button>
                      <ExternalLink className="size-3.5 shrink-0 text-suave" />
                      <button onClick={() => excluir(c)} className="rounded p-1 text-suave opacity-0 group-hover:opacity-100 hover:text-erro" aria-label="Remover"><Trash2 className="size-3.5" /></button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

      <Janela titulo="Adicionar catálogo" aberto={!!novo} onFechar={() => { setNovo(null); setErro(""); }}
        rodape={<><Botao tipo="pri" disabled={ocupado} onClick={salvar}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Salvar</Botao>{erro && <span className="text-[13px] text-erro">{erro}</span>}</>}>
        {novo && (
          <div className="grid grid-cols-2 gap-3">
            <Rotulo rotulo="Fornecedor / marca" className="col-span-2"><input className={campo} list="fornecedores" value={novo.fornecedor ?? ""} onChange={(e) => setNovo({ ...novo, fornecedor: e.target.value })} placeholder="Ex.: Control4" />
              <datalist id="fornecedores">{sugestoes.map((s) => <option key={s} value={s} />)}</datalist></Rotulo>
            <Rotulo rotulo="Título" className="col-span-2"><input className={campo} value={novo.titulo ?? ""} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} placeholder="Ex.: Catálogo 2026, Tabela de preços…" /></Rotulo>
            <Rotulo rotulo="Categoria"><select className={campo} value={novo.categoria ?? ""} onChange={(e) => setNovo({ ...novo, categoria: e.target.value })}><option value="">—</option>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Rotulo>
            <Rotulo rotulo="Link (site ou catálogo online)"><input className={campo} value={novo.url ?? ""} onChange={(e) => setNovo({ ...novo, url: e.target.value })} placeholder="control4.com/…" /></Rotulo>
            <div className="col-span-2">
              <input ref={arq} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => setNovo({ ...novo, arquivo: e.target.files?.[0] ?? null })} />
              <button type="button" onClick={() => arq.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-linha px-3 py-4 text-[13.5px] font-semibold hover:border-azul">
                <Upload className="size-4 text-azul" />{novo.arquivo ? `${novo.arquivo.name} · ${tam(novo.arquivo.size)}` : "Enviar o PDF do catálogo (opcional)"}
              </button>
            </div>
            <Rotulo rotulo="Observações" className="col-span-2"><input className={campo} value={novo.observacoes ?? ""} onChange={(e) => setNovo({ ...novo, observacoes: e.target.value })} placeholder="Representante, condições, validade…" /></Rotulo>
          </div>
        )}
      </Janela>
    </Shell>
  );
}
