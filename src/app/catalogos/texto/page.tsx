"use client";
// Texto dos catálogos (PDF) linha a linha, para conferir códigos e preços
// (revenda × consumidor) e buscar um item em todos os catálogos de uma vez.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Shell, Bloco } from "@/components/Shell";
import { extrairItensPdf } from "@/lib/catalogo-produtos";
import { mensagemErro, supabase } from "@/lib/supabase";

type Linha = { fornecedor: string; pagina: number; texto: string };

function linhasDaPagina(itens: { x: number; y: number; s: string }[]) {
  const L: { y: number; p: { x: number; s: string }[] }[] = [];
  for (const it of [...itens].sort((a, b) => b.y - a.y)) {
    const l = L.find((x) => Math.abs(x.y - it.y) <= 2.5);
    if (l) l.p.push(it); else L.push({ y: it.y, p: [it] });
  }
  return L.map((l) => l.p.sort((a, b) => a.x - b.x).map((x) => x.s).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean);
}

export default function TextoCatalogos() {
  const [linhas, setLinhas] = useState<Linha[]>([]), [status, setStatus] = useState("Carregando catálogos…"), [q, setQ] = useState(""), [erro, setErro] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const db = supabase();
        const { data, error } = await db.from("catalogos").select("fornecedor, storage_path").not("storage_path", "is", null).order("fornecedor");
        if (error) throw error;
        const todas: Linha[] = [];
        for (const c of data ?? []) {
          if (!/\.pdf$/i.test(c.storage_path ?? "")) continue;
          setStatus(`Lendo ${c.fornecedor}…`);
          const { data: arq, error: e2 } = await db.storage.from("documentos").download(c.storage_path!);
          if (e2 || !arq) continue;
          const paginas = await extrairItensPdf(await arq.arrayBuffer());
          paginas.forEach((itens, i) => linhasDaPagina(itens).forEach((texto) => todas.push({ fornecedor: c.fornecedor, pagina: i + 1, texto })));
          setLinhas([...todas]);
        }
        (window as unknown as { __catTexto: Linha[] }).__catTexto = todas;
        setStatus(`${todas.length} linhas de ${(data ?? []).length} catálogos`);
      } catch (e) { setErro(mensagemErro(e)); }
    })();
  }, []);
  const achados = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (t.length < 3) return [];
    return linhas.filter((l) => l.texto.toLowerCase().replace(/[^a-z0-9]/g, "").includes(t)).slice(0, 200);
  }, [linhas, q]);
  return (
    <Shell titulo="Busca nos catálogos">
      <Bloco>
        <div className="flex items-center gap-3 border-b border-linha px-5 py-3">
          <Search className="size-4 text-suave" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, modelo ou nome do item…" className="flex-1 bg-transparent text-[15px] outline-none" />
          <span className="flex items-center gap-1.5 text-[12.5px] text-suave">{!status.includes("linhas") && <Loader2 className="size-3.5 animate-spin" />}{status}</span>
        </div>
        {erro && <p className="px-5 py-3 text-erro">{erro}</p>}
        <ul className="divide-y divide-linha">
          {achados.map((l, i) => <li key={i} className="px-5 py-2 text-[13.5px]"><span className="mr-2 text-[12px] font-semibold text-azul">{l.fornecedor} · p.{l.pagina}</span>{l.texto}</li>)}
        </ul>
      </Bloco>
    </Shell>
  );
}
