"use client";
// Mantém o Núcleo sempre na versão e com os dados mais novos, principalmente no
// celular (app salvo na tela inicial fica aberto em segundo plano por dias).
import { useEffect, useState } from "react";

const ATUAL = process.env.NEXT_PUBLIC_VERSAO ?? "";
const RECARREGAR_APOS_MS = 10 * 60 * 1000;   // voltou ao app depois de 10 min: busca tudo de novo
let pendentes = 0;

/** Telas com alterações não salvas avisam aqui para não serem recarregadas no meio. */
export function marcarPendente(sim: boolean) { pendentes = Math.max(0, pendentes + (sim ? 1 : -1)); }

async function versaoPublicada(): Promise<string | null> {
  try {
    const r = await fetch(`/versao.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    return ((await r.json()) as { versao?: string }).versao ?? null;
  } catch { return null; }
}

/** true quando há versão nova e a tela tem alterações não salvas (mostra o aviso em vez de recarregar). */
export function useAtualizacao(): { nova: boolean; atualizar: () => void } {
  const [nova, setNova] = useState(false);
  useEffect(() => {
    if (!ATUAL) return;
    let escondidoEm = 0, vivo = true;
    const conferir = async (voltando: boolean) => {
      const v = await versaoPublicada();
      if (!vivo) return;
      const mudou = !!v && v !== ATUAL;
      const parado = voltando && escondidoEm && Date.now() - escondidoEm > RECARREGAR_APOS_MS;
      if (!mudou && !parado) return;
      if (pendentes > 0) { if (mudou) setNova(true); return; }
      location.reload();
    };
    const vis = () => { if (document.visibilityState === "hidden") escondidoEm = Date.now(); else { conferir(true); escondidoEm = 0; } };
    const t = setInterval(() => { if (document.visibilityState === "visible") conferir(false); }, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", vis);
    const volta = (e: PageTransitionEvent) => { if (e.persisted) location.reload(); };   // Safari devolveu a página do cache
    window.addEventListener("pageshow", volta);
    conferir(false);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); window.removeEventListener("pageshow", volta); };
  }, []);
  return { nova, atualizar: () => location.reload() };
}
