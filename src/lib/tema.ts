// Tema do Núcleo: claro, escuro ou automático (segue o sistema, como a Apple).
// A escolha fica no navegador e vale também para o Financeiro (mesma origem).
export type Tema = "auto" | "claro" | "escuro";
export const CHAVE_TEMA = "nucleo-tema";

export function lerTema(): Tema {
  try { const t = localStorage.getItem(CHAVE_TEMA); return t === "claro" || t === "escuro" ? t : "auto"; } catch { return "auto"; }
}
export const escuroAgora = (t: Tema) => t === "escuro" || (t === "auto" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);

export function aplicarTema(t: Tema) {
  const e = escuroAgora(t);
  document.documentElement.dataset.tema = e ? "escuro" : "claro";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", e ? "#000000" : "#f5f5f7");
  // o Financeiro (iframe) acompanha
  document.querySelectorAll("iframe").forEach((f) => { try { f.contentDocument?.documentElement.setAttribute("data-theme", e ? "dark" : "light"); } catch { /* outra origem */ } });
}
export function gravarTema(t: Tema) {
  try { if (t === "auto") localStorage.removeItem(CHAVE_TEMA); else localStorage.setItem(CHAVE_TEMA, t); } catch { /* sem armazenamento */ }
  aplicarTema(t);
}
/** script curto para o <head>: aplica o tema antes de pintar (sem piscar branco) */
export const SCRIPT_TEMA = `try{var t=localStorage.getItem("${CHAVE_TEMA}");var e=t==="escuro"||(t!=="claro"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.tema=e?"escuro":"claro"}catch(_){}`;
