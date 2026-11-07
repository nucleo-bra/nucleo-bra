"use client";
// Busca um item (código, modelo, nome) dentro de TODOS os catálogos em PDF.
// O texto de cada PDF é lido uma vez e guardado no navegador (IndexedDB),
// então as próximas buscas são instantâneas.
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileSearch, Loader2, Search, X } from "lucide-react";
import { extrairItensPdf } from "@/lib/catalogo-produtos";
import { linkDocumento } from "@/lib/pasta";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";

type Linha = { pagina: number; texto: string };
type Catalogo = { id: string; fornecedor: string; titulo: string; storage_path: string };
type Texto = { cat: Catalogo; linhas: Linha[] };
type Achado = { cat: Catalogo; pagina: number; linha: number; trecho: string[]; revenda: string | null; consumidor: string | null };

// ---------------------------------------------------------------- cache local (IndexedDB)
const BANCO = "nucleo-catalogos", LOJA = "texto";
function abrirBanco(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const r = indexedDB.open(BANCO, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(null);
    } catch { ok(null); }
  });
}
async function lerCache(chave: string): Promise<Linha[] | null> {
  const db = await abrirBanco(); if (!db) return null;
  return new Promise((ok) => { try { const r = db.transaction(LOJA).objectStore(LOJA).get(chave); r.onsuccess = () => ok((r.result as Linha[]) ?? null); r.onerror = () => ok(null); } catch { ok(null); } });
}
async function gravarCache(chave: string, v: Linha[]) {
  const db = await abrirBanco(); if (!db) return;
  try { db.transaction(LOJA, "readwrite").objectStore(LOJA).put(v, chave); } catch { /* sem espaço: segue sem cache */ }
}

function linhasDaPagina(itens: { x: number; y: number; s: string }[]) {
  const L: { y: number; p: { x: number; s: string }[] }[] = [];
  for (const it of [...itens].sort((a, b) => b.y - a.y)) {
    const l = L.find((x) => Math.abs(x.y - it.y) <= 2.5);
    if (l) l.p.push(it); else L.push({ y: it.y, p: [it] });
  }
  return L.map((l) => l.p.sort((a, b) => a.x - b.x).map((x) => x.s).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean);
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const RS = /R\$\s*[\d.]+(?:,\d{2})?/g;

/** procura "Revenda"/"Consumidor"/"Sugerido" e o valor em R$ logo depois, no bloco do item */
function precos(bloco: string[]) {
  let revenda: string | null = null, consumidor: string | null = null;
  bloco.forEach((t, i) => {
    const aqui = t.match(RS) ?? [], depois = (bloco[i + 1] ?? "").match(RS) ?? [], prim = (x?: string) => x ?? null;
    if (!revenda && /revenda/i.test(t)) revenda = prim(t.split(/revenda/i)[1]?.match(RS)?.[0] ?? depois[0]);
    if (!consumidor && /consumidor|sugerido/i.test(t)) consumidor = prim(t.split(/consumidor|sugerido/i)[1]?.match(RS)?.[0] ?? depois[0]);
    // tabelas em uma linha só: "… R$ 705,00 R$ 1.220,00" (revenda, sugerido)
    if (!revenda && !consumidor && aqui.length >= 2 && i === 0) { revenda = prim(aqui[0]); consumidor = prim(aqui[1]); }
  });
  return { revenda, consumidor };
}

export function BuscaItensCatalogos({ inicial = "", autoFoco = false }: { inicial?: string; autoFoco?: boolean }) {
  const [q, setQ] = useState(inicial);
  const [textos, setTextos] = useState<Texto[]>([]);
  const [estado, setEstado] = useState<"parado" | "lendo" | "pronto">("parado");
  const [progresso, setProgresso] = useState(""), [erro, setErro] = useState("");
  const iniciou = useRef(false);

  async function carregar() {
    if (iniciou.current || modoDemo) return;
    iniciou.current = true; setEstado("lendo");
    try {
      const db = supabase();
      const { data, error } = await db.from("catalogos").select("id, fornecedor, titulo, storage_path").not("storage_path", "is", null).order("fornecedor");
      if (error) throw error;
      const cats = (data ?? []).filter((c) => /\.pdf$/i.test(c.storage_path ?? "")) as Catalogo[];
      const lidos: Texto[] = [];
      for (const [i, c] of cats.entries()) {
        let linhas = await lerCache(c.storage_path);
        if (!linhas) {
          setProgresso(`Lendo ${c.fornecedor} (${i + 1}/${cats.length})…`);
          const { data: arq, error: e2 } = await db.storage.from("documentos").download(c.storage_path);
          if (e2 || !arq) continue;
          const paginas = await extrairItensPdf(await arq.arrayBuffer());
          linhas = paginas.flatMap((itens, p) => linhasDaPagina(itens).map((texto) => ({ pagina: p + 1, texto })));
          gravarCache(c.storage_path, linhas);
        }
        lidos.push({ cat: c, linhas });
        setTextos([...lidos]);
      }
      setEstado("pronto"); setProgresso("");
    } catch (e) { setErro(mensagemErro(e)); setEstado("pronto"); }
  }
  useEffect(() => { if (inicial) carregar(); }, [inicial]);

  const achados = useMemo(() => {
    const t = norm(q);
    if (t.length < 3) return [] as Achado[];
    const out: Achado[] = [];
    for (const { cat, linhas } of textos) {
      let ultimo = -99;
      linhas.forEach((l, i) => {
        if (!norm(l.texto).includes(t)) return;
        if (i - ultimo < 6 && linhas[ultimo]?.pagina === l.pagina) return; // mesmo bloco
        ultimo = i;
        const mesma = (k: number) => linhas[k] && linhas[k].pagina === l.pagina;
        const ini = Math.max(0, i - 3), trecho: string[] = [];
        for (let k = ini; k <= i + 9; k++) if (mesma(k)) trecho.push(linhas[k].texto);
        const desde = trecho.findIndex((x) => x === l.texto);
        out.push({ cat, pagina: l.pagina, linha: desde, trecho, ...precos(trecho.slice(Math.max(0, desde - 1))) });
      });
    }
    return out.slice(0, 120);
  }, [textos, q]);

  const abrirPdf = (a: Achado) => linkDocumento(a.cat.storage_path).then((u) => window.open(`${u}#page=${a.pagina}`, "_blank")).catch((e) => setErro(mensagemErro(e)));
  const marcar = (txt: string) => {
    const t = q.trim(); if (t.length < 3) return txt;
    const i = txt.toLowerCase().indexOf(t.toLowerCase());
    return i < 0 ? txt : <>{txt.slice(0, i)}<mark className="rounded bg-azul/15 px-0.5 text-tinta">{txt.slice(i, i + t.length)}</mark>{txt.slice(i + t.length)}</>;
  };

  return (
    <section className="sombra-bra mb-5 rounded-[18px] border border-linha bg-white">
      <div className="px-5 pt-4 pb-3">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold tracking-[.08em] text-azul uppercase"><FileSearch className="size-4" />Buscar item em todos os catálogos</div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-suave" />
          <input autoFocus={autoFoco} value={q} onFocus={carregar} onChange={(e) => { setQ(e.target.value); carregar(); }}
            placeholder="Código, modelo ou nome — ex.: C4-HALO, SS-AC-EX60, keypad, 2x200W"
            className="w-full rounded-xl border border-linha bg-fundo/60 py-3 pr-10 pl-11 text-[15px] outline-none" aria-label="Buscar item nos catálogos" />
          {q && <button type="button" onClick={() => setQ("")} className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-suave hover:text-tinta" aria-label="Limpar"><X className="size-4" /></button>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[12px] text-suave">
          {estado === "lendo" && <span className="flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" />{progresso || "Preparando…"} A primeira leitura demora; depois fica instantâneo.</span>}
          {estado === "pronto" && <span>{textos.length} catálogo(s) pesquisáveis</span>}
          {q.trim().length >= 3 && <span>· {achados.length ? `${achados.length} resultado(s)` : estado === "lendo" ? "procurando…" : "nada encontrado"}</span>}
        </div>
        {erro && <p className="mt-2 text-[13px] text-erro">{erro}</p>}
      </div>
      {achados.length > 0 && (
        <ul className="grid gap-3 border-t border-linha p-4 md:grid-cols-2">
          {achados.map((a, i) => (
            <li key={i} className="rounded-[14px] border border-linha bg-fundo/50 p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-azul/10 px-2.5 py-0.5 text-[12px] font-semibold text-azul">{a.cat.fornecedor}</span>
                <span className="text-[12px] text-suave">{a.cat.titulo} · pág. {a.pagina}</span>
                <button type="button" onClick={() => abrirPdf(a)} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-azul hover:underline">Abrir no PDF <ExternalLink className="size-3" /></button>
              </div>
              {(a.revenda || a.consumidor) && (
                <div className="mb-2 flex gap-2">
                  {a.revenda && <span className="rounded-lg bg-white px-2.5 py-1 text-[12px] ring-1 ring-linha"><span className="text-suave">Revenda </span><b className="num">{a.revenda}</b></span>}
                  {a.consumidor && <span className="rounded-lg bg-white px-2.5 py-1 text-[12px] ring-1 ring-linha"><span className="text-suave">Consumidor </span><b className="num">{a.consumidor}</b></span>}
                </div>
              )}
              <div className="space-y-0.5 text-[12.5px] leading-snug">
                {a.trecho.map((t, k) => <p key={k} className={k === a.linha ? "font-semibold text-tinta" : "text-suave"}>{k === a.linha ? marcar(t) : t}</p>)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
