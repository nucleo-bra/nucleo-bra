"use client";
// Pendências de cadastro: tudo que falta preencher, com link direto para resolver.
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Loader2, RefreshCw } from "lucide-react";
import { Shell } from "@/components/Shell";
import { carregarPendencias, type GrupoPend } from "@/lib/pendencias";
import { mensagemErro } from "@/lib/supabase";
import { pl } from "@/lib/texto";

export default function Pendencias() {
  const [G, setG] = useState<GrupoPend[] | null>(null);
  const [erro, setErro] = useState(""), [aberto, setAberto] = useState<string | null>(null);
  const carregar = () => { setG(null); setErro(""); carregarPendencias().then(setG).catch((e) => { setErro(mensagemErro(e)); setG([]); }); };
  useEffect(carregar, []);
  const total = (G ?? []).reduce((s, g) => s + g.total, 0);

  return (
    <Shell titulo="Pendências" acoes={<button onClick={carregar} className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3 py-2 text-[13px] font-semibold hover:border-azul"><RefreshCw className="size-4" />Atualizar</button>}>
      {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}</p>}
      <section className="sombra-bra mb-4 flex items-center gap-4 rounded-[18px] border border-linha bg-white px-5 py-4">
        <ClipboardCheck className="size-8 shrink-0 text-azul" strokeWidth={1.6} />
        <div>
          <h1 className="font-display text-[19px] font-bold">{!G ? "Conferindo o cadastro…" : total ? `${pl(total, "pendência", "pendências")} para completar` : "Cadastro completo"}</h1>
          <p className="text-[13.5px] text-suave">Quanto mais completo o cadastro, mais o Núcleo preenche sozinho: aceite do orçamento, contrato, comissões, mapa e avisos.</p>
        </div>
      </section>
      {!G ? <div className="flex items-center gap-2 py-12 text-suave"><Loader2 className="size-5 animate-spin" />Carregando…</div>
        : !G.length && !erro ? (
          <div className="sombra-bra rounded-[18px] border border-linha bg-white px-6 py-12 text-center"><CheckCircle2 className="mx-auto mb-2 size-8 text-ok" /><p className="font-semibold">Nada pendente.</p></div>
        ) : (
          <div className="space-y-3">
            {G.map((g) => {
              const ab = aberto === g.chave;
              return (
                <section key={g.chave} className="sombra-bra overflow-hidden rounded-[18px] border border-linha bg-white">
                  <button type="button" onClick={() => setAberto(ab ? null : g.chave)} disabled={!g.itens.length} className="flex w-full items-center gap-3 px-5 py-3.5 text-left">
                    {g.itens.length ? (ab ? <ChevronDown className="size-4 text-azul" /> : <ChevronRight className="size-4 text-suave" />) : <span className="size-4" />}
                    <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-bold">{g.titulo}</span><span className="block text-[12.5px] text-suave">{g.porque}</span></span>
                    <span className="num rounded-full bg-atencao-claro px-2.5 py-0.5 text-[13px] font-bold text-atencao">{g.total}</span>
                    {g.chave === "pix" && <Link href="/financeiro/" onClick={(e) => e.stopPropagation()} className="text-[12.5px] font-semibold text-azul hover:underline">Abrir Financeiro</Link>}
                  </button>
                  {ab && (
                    <ul className="max-h-[420px] divide-y divide-linha overflow-y-auto border-t border-linha">
                      {g.itens.map((i) => (
                        <li key={i.id}><Link href={i.link} className="flex items-center gap-3 px-5 py-2.5 hover:bg-fundo/60">
                          <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold">{i.titulo}</span><span className="block truncate text-[12px] text-suave">{i.detalhe}</span></span>
                          <span className="text-[12.5px] font-semibold text-azul">Resolver</span><ChevronRight className="size-4 text-suave" />
                        </Link></li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
    </Shell>
  );
}
