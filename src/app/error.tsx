"use client";
// Se uma tela quebrar, mostra uma mensagem clara em vez da página em branco.
// Versão nova publicada enquanto a tela estava aberta: recarrega sozinho.
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const versaoNova = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|importing a module script failed/i.test(`${error?.name} ${error?.message}`);
  useEffect(() => {
    console.error(error);
    if (!versaoNova) return;
    try {
      if (sessionStorage.getItem("nucleo-recarregou") === location.pathname) return;
      sessionStorage.setItem("nucleo-recarregou", location.pathname);
    } catch { /* sem armazenamento */ }
    location.reload();
  }, [error, versaoNova]);
  return (
    <div className="grid min-h-dvh place-items-center bg-fundo px-4">
      <div className="w-full max-w-md rounded-[20px] border border-linha bg-white p-6 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,.25)]">
        <AlertTriangle className="mx-auto mb-3 size-8 text-atencao" />
        <h1 className="font-display text-[19px] font-bold">{versaoNova ? "Atualizando o Núcleo…" : "Algo deu errado nesta tela"}</h1>
        <p className="mt-1.5 text-[14px] text-suave">{versaoNova ? "Saiu uma versão nova. A página vai recarregar." : "Seus dados estão salvos. Tente de novo; se continuar, avise com o horário e a tela em que aconteceu."}</p>
        {!versaoNova && <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-xl bg-azul px-4 py-2 text-[14px] font-semibold text-white hover:bg-azul-escuro"><RotateCcw className="size-4" />Tentar de novo</button>
          <Link href="/" className="rounded-xl border border-linha px-4 py-2 text-[14px] font-semibold hover:border-azul">Ir para o Painel</Link>
        </div>}
        {error?.digest && <p className="mt-4 text-[11px] text-suave">código {error.digest}</p>}
      </div>
    </div>
  );
}
