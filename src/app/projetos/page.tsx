"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, LayoutGrid, Plus, Star, X } from "lucide-react";
import { Shell } from "@/components/Shell";
import { QuadroView } from "@/components/projetos/quadro";
import { criarQuadro, FUNDOS, listarQuadros, MODELOS, posEntre, Quadro } from "@/lib/projetos";
import { mensagemErro } from "@/lib/supabase";

type Linha = Quadro & { cartoes: number; atrasados: number };

function Quadros() {
  const router = useRouter();
  const [L, setL] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState<{ nome: string; modelo: keyof typeof MODELOS; fundo: string } | null>(null);
  const [criando, setCriando] = useState(false);
  useEffect(() => { listarQuadros().then(setL).catch((e) => setErro(mensagemErro(e))); }, []);

  async function criar() {
    if (!novo?.nome.trim()) return;
    setCriando(true); setErro("");
    try {
      const id = await criarQuadro(novo.nome, novo.modelo, novo.fundo, posEntre(L?.length ? L[L.length - 1].posicao : undefined, undefined));
      router.push(`/projetos/?q=${id}`);
    } catch (e) { setErro(mensagemErro(e)); setCriando(false); }
  }
  const fav = (L ?? []).filter((q) => q.favorito), resto = L ?? [];
  const Tile = ({ q }: { q: Linha }) => (
    <Link href={`/projetos/?q=${q.id}`} className="group relative flex h-28 flex-col justify-between overflow-hidden rounded-2xl p-3.5 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-xl" style={{ background: FUNDOS[q.fundo] ?? FUNDOS.marinho }}>
      <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
      <span className="relative font-display text-[16px] leading-tight font-bold">{q.nome}</span>
      <span className="relative flex items-center gap-3 text-[12.5px] text-white/85">
        <span>{q.cartoes} cartão(ões)</span>
        {q.atrasados > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-erro px-2 py-0.5 font-bold text-white"><AlertTriangle className="size-3" />{q.atrasados} atrasado(s)</span>}
        {q.favorito && <Star className="ml-auto size-4 fill-[#ffd25e] text-[#ffd25e]" />}
      </span>
    </Link>
  );
  return (
    <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-7">
      <div className="mb-5">
        <div className="text-[12.5px] font-semibold tracking-wide text-suave uppercase">Projetos · Time técnico</div>
        <h1 className="font-display text-[24px] font-extrabold tracking-tight lg:text-[28px]">Seus quadros</h1>
      </div>
      {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
      {fav.length > 0 && (<>
        <h2 className="mb-2 flex items-center gap-2 text-[14px] font-bold"><Star className="size-4 text-suave" />Favoritos</h2>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{fav.map((q) => <Tile key={q.id} q={q} />)}</div>
      </>)}
      <h2 className="mb-2 flex items-center gap-2 text-[14px] font-bold"><LayoutGrid className="size-4 text-suave" />Todos os quadros</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {resto.map((q) => <Tile key={q.id} q={q} />)}
        <button onClick={() => setNovo({ nome: "", modelo: "obra", fundo: "marinho" })} className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-linha bg-white/60 text-[14px] font-semibold text-suave hover:border-azul hover:text-azul">
          <Plus className="size-5" />Criar novo quadro
        </button>
      </div>
      {!L && !erro && <p className="mt-4 text-suave">Carregando…</p>}

      {novo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setNovo(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-[20px] bg-white shadow-2xl">
            <div className="flex h-28 items-end p-4 font-display text-[18px] font-bold text-white" style={{ background: FUNDOS[novo.fundo] }}>{novo.nome || "Novo quadro"}</div>
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between"><h2 className="font-display text-[17px] font-bold">Criar quadro</h2><button onClick={() => setNovo(null)} className="rounded-lg p-1 hover:bg-fundo" aria-label="Fechar"><X className="size-5" /></button></div>
              <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Título do quadro</span>
                <input autoFocus value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} onKeyDown={(e) => e.key === "Enter" && criar()} placeholder="Ex.: Obra · Quinta da Baronesa"
                  className="w-full rounded-xl border border-linha px-3 py-2 text-[14px] outline-none focus:border-azul" /></label>
              <div><span className="mb-1 block text-[12px] font-semibold text-suave">Modelo</span>
                <div className="grid gap-1.5">{Object.entries(MODELOS).map(([k, m]) => (
                  <button key={k} onClick={() => setNovo({ ...novo, modelo: k as keyof typeof MODELOS })} className={`rounded-xl border px-3 py-2 text-left text-[13.5px] ${novo.modelo === k ? "border-azul bg-[#eef3fb]" : "border-linha"}`}>
                    <b>{m.nome}</b><span className="block text-[12px] text-suave">{m.listas.join(" · ")}</span>
                  </button>))}</div></div>
              <div><span className="mb-1 block text-[12px] font-semibold text-suave">Fundo</span>
                <div className="grid grid-cols-6 gap-1.5">{Object.entries(FUNDOS).map(([k, v]) => <button key={k} onClick={() => setNovo({ ...novo, fundo: k })} className={`h-9 rounded-lg ${novo.fundo === k ? "ring-2 ring-azul ring-offset-2" : ""}`} style={{ background: v }} aria-label={k} />)}</div></div>
              <button onClick={criar} disabled={!novo.nome.trim() || criando} className="w-full rounded-xl bg-gradient-to-br from-azul to-marinho-900 py-2.5 text-[14px] font-semibold text-white disabled:opacity-40">{criando ? "Criando…" : "Criar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Conteudo() {
  const q = useSearchParams().get("q");
  return <Shell titulo="Projetos" cheio>{q ? <QuadroView key={q} id={q} /> : <Quadros />}</Shell>;
}
export default function ProjetosPagina() { return <Suspense><Conteudo /></Suspense>; }
