"use client";
// Peças visuais do CRM (mesma linguagem da home e do Financeiro v38)
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChevronRight, X } from "lucide-react";

export const AZUL = "#2f6fb5", LARANJA = "#f5821f", MARINHO = "#19295a", CIANO = "#22c7d6", VERDE = "#12a150", ROXO = "#7c5cd6";

export function Cartao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`sombra-bra rounded-[18px] border border-linha bg-white ${className}`}>{children}</section>;
}
export function Titulo({ children, extra, href }: { children: React.ReactNode; extra?: React.ReactNode; href?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="flex items-center gap-2.5 text-[15px] font-bold">
        <span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" aria-hidden />{children}
      </h2>
      {extra}
      {href && <Link href={href} className="flex items-center text-[12.5px] font-semibold text-azul hover:underline">Abrir <ChevronRight className="size-3.5" /></Link>}
    </div>
  );
}
export function Kpi({ rotulo, valor, detalhe, cor, tom = "", onClick }: { rotulo: string; valor: string; detalhe?: React.ReactNode; cor: string; tom?: string; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={`sombra-bra relative block w-full overflow-hidden rounded-[18px] border border-linha bg-white px-5 py-4 pl-6 text-left ${onClick ? "transition hover:-translate-y-0.5" : ""}`}>
      <span className="absolute top-3.5 bottom-3.5 left-0 w-[5px] rounded-r-md" style={{ background: cor }} aria-hidden />
      <div className="text-[12.5px] font-semibold text-suave">{rotulo}</div>
      <div className={`num mt-0.5 font-display text-[19px] font-extrabold tracking-tight sm:text-[22px] ${tom}`}>{valor}</div>
      {detalhe && <div className="mt-0.5 text-[12px] text-suave">{detalhe}</div>}
    </C>
  );
}
export function Botao({ children, onClick, tipo = "sec", className = "", disabled, type = "button" }: {
  children: React.ReactNode; onClick?: () => void; tipo?: "pri" | "sec" | "perigo" | "leve"; className?: string; disabled?: boolean; type?: "button" | "submit";
}) {
  const t = {
    pri: "bg-gradient-to-br from-azul to-marinho-900 text-white border-transparent hover:shadow-lg",
    sec: "bg-white border-linha hover:shadow-md",
    perigo: "bg-white border-erro/40 text-erro hover:bg-erro-claro",
    leve: "bg-transparent border-transparent text-azul hover:bg-fundo",
  }[tipo];
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-[13.5px] font-semibold transition disabled:opacity-40 ${t} ${className}`}>{children}</button>;
}
export function Chip({ children, cor = "bg-fundo text-suave" }: { children: React.ReactNode; cor?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${cor}`}>{children}</span>;
}
export const campo = "w-full rounded-xl border border-linha bg-white px-3 py-2 text-[14px] outline-none focus:border-azul focus:shadow-[0_0_0_3px_rgba(47,111,181,.2)]";
export function Rotulo({ rotulo, children, className = "" }: { rotulo: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-[12px] font-semibold text-suave">{rotulo}</span>{children}</label>;
}

export function Janela({ titulo, aberto, onFechar, children, rodape, largura = "max-w-lg" }: {
  titulo: string; aberto: boolean; onFechar: () => void; children: React.ReactNode; rodape?: React.ReactNode; largura?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog ref={ref} onClose={onFechar} onClick={(e) => e.target === ref.current && onFechar()}
      className={`m-auto w-[calc(100%-24px)] ${largura} rounded-[20px] border border-linha bg-white p-0 text-tinta shadow-[0_30px_80px_-20px_rgba(0,0,0,.55)] backdrop:bg-marinho-950/55 backdrop:backdrop-blur-[4px]`}>
      {aberto && (
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between border-b border-linha px-5 py-3.5">
            <h2 className="font-display text-[17px] font-bold">{titulo}</h2>
            <button onClick={onFechar} className="rounded-lg p-1.5 text-suave hover:bg-fundo" aria-label="Fechar"><X className="size-4" /></button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {rodape && <div className="flex flex-wrap items-center gap-2 border-t border-linha px-5 py-3">{rodape}</div>}
        </div>
      )}
    </dialog>
  );
}

export const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const curto = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`
  : v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : reais(v);
export const dataBr = (s: string) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "—");
export const DSEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
