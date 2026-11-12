"use client";
// Selo de conexão: sem internet, sincronizando, alterações aguardando envio e
// alterações substituídas por outra mais recente (última gravação vale).
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RefreshCw, X } from "lucide-react";
import { conflitosVistos, ouvirEstado, sincronizar, type Estado } from "@/lib/offline";

const alt = (n: number) => (n > 1 ? `${n} alterações` : "1 alteração");
const hora = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function IndicadorOffline() {
  const [e, setE] = useState<Estado | null>(null);
  const [aberto, setAberto] = useState(false);
  const [okAgora, setOkAgora] = useState(false);
  useEffect(() => ouvirEstado(setE), []);
  useEffect(() => {
    const f = (ev: Event) => { if ((ev as CustomEvent).detail) { setOkAgora(true); setTimeout(() => setOkAgora(false), 4000); } };
    addEventListener("nucleo:sincronizado", f);
    return () => removeEventListener("nucleo:sincronizado", f);
  }, []);
  if (!e) return null;
  const conflitos = e.conflitos.length;
  if (e.online && !e.pendentes && !e.sincronizando && !conflitos && !okAgora) return null;

  const [cor, icone, txt] = !e.online
    ? ["bg-[#1d1d1f]", <CloudOff key="i" className="size-4" />, e.pendentes ? `Sem internet · ${alt(e.pendentes)} guardada${e.pendentes > 1 ? "s" : ""} no aparelho` : "Sem internet · pode continuar usando"]
    : e.sincronizando ? ["bg-azul", <Loader2 key="i" className="size-4 animate-spin" />, `Sincronizando ${e.pendentes || ""}…`]
    : e.pendentes ? ["bg-azul", <RefreshCw key="i" className="size-4" />, `${alt(e.pendentes)} aguardando envio`]
    : conflitos ? ["bg-atencao", <AlertTriangle key="i" className="size-4" />, `${alt(conflitos)} não ${conflitos > 1 ? "entraram" : "entrou"} · ver`]
    : ["bg-ok", <CheckCircle2 key="i" className="size-4" />, "Tudo sincronizado"];

  return (
    <>
      <button type="button" onClick={() => (conflitos ? setAberto(true) : e.online && e.pendentes ? sincronizar() : undefined)}
        className={`fixed bottom-4 left-1/2 z-[75] flex -translate-x-1/2 items-center gap-2 rounded-full ${cor} px-4 py-2 text-[13px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,.35)] lg:left-auto lg:right-5 lg:translate-x-0`}
        role="status" aria-live="polite">
        {icone}{txt}
      </button>
      {aberto && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/30 px-4" onClick={() => setAberto(false)}>
          <div className="w-full max-w-lg rounded-[20px] bg-white p-5 shadow-2xl" onClick={(x) => x.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2"><AlertTriangle className="size-5 text-atencao" /><h2 className="flex-1 font-display text-[17px] font-bold">Alterações que não entraram</h2>
              <button onClick={() => setAberto(false)} className="rounded-lg p-1 text-suave hover:bg-fundo" aria-label="Fechar"><X className="size-5" /></button></div>
            <p className="mb-3 text-[13px] text-suave">Vale a última gravação: estas alterações foram feitas sem internet, mas outra pessoa alterou o mesmo registro depois. A versão mais recente ficou e as duas estão no Histórico.</p>
            <ul className="max-h-[50vh] divide-y divide-linha overflow-y-auto rounded-xl border border-linha">
              {e.conflitos.map((c, i) => (
                <li key={i} className="px-3 py-2.5 text-[13px]">
                  <b className="block">{c.rotulo || "Alteração"}</b>
                  <span className="text-suave">{c.motivo === "erro" ? `não foi aceita: ${c.detalhe}` : `feita em ${hora(c.quando)} · substituída pela de ${hora(c.servidorEm)}`}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => { conflitosVistos(); setAberto(false); }} className="mt-4 w-full rounded-xl bg-azul py-2.5 text-[14px] font-semibold text-white">Entendi</button>
          </div>
        </div>
      )}
    </>
  );
}
