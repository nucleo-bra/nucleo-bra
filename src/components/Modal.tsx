"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ titulo, aberto, onFechar, children, largura = "max-w-lg" }: {
  titulo: string; aberto: boolean; onFechar: () => void; children: React.ReactNode; largura?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog ref={ref} onClose={onFechar} onClick={(e) => e.target === ref.current && onFechar()}
      className={`m-auto w-[calc(100%-32px)] ${largura} rounded-xl border border-linha bg-white p-0 text-tinta backdrop:bg-marinho-950/50`}>
      {aberto && (
        <div>
          <div className="flex items-center justify-between border-b border-linha px-5 py-3.5">
            <h2 className="text-[16px] font-semibold">{titulo}</h2>
            <button onClick={onFechar} className="rounded p-1 text-suave hover:bg-fundo" aria-label="Fechar"><X className="size-4" /></button>
          </div>
          <div className="px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-suave">{rotulo}</span>
      {children}
    </label>
  );
}

export const estiloInput = "w-full rounded-lg border border-linha bg-white px-3 py-2 text-[14px] outline-none focus:border-ciano";
export const botaoPrimario = "inline-flex items-center justify-center gap-2 rounded-lg bg-br px-4 py-2 text-[14px] font-medium text-white hover:bg-br-escuro disabled:opacity-40";
export const botaoSecundario = "inline-flex items-center justify-center gap-2 rounded-lg border border-linha bg-white px-3.5 py-2 text-[14px] hover:bg-fundo disabled:opacity-40";
