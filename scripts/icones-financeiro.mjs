// Ícones de traço (lucide) para o Financeiro v38: troca os emojis dos botões
// por <i class="ic ic-nome"> desenhados via máscara CSS (herdam a cor do texto).
import { readFileSync } from "node:fs";
const MAPA = {
  "✏️": "pencil", "🗑": "trash", "💬": "message-circle", "🔍": "search", "👥": "users", "🧾": "receipt",
  "✅": "circle-check", "📊": "chart-column", "📍": "map-pin", "☑": "square-check", "📥": "inbox", "💰": "banknote",
  "🏠": "house", "⬆️": "arrow-up-right", "💼": "briefcase", "☰": "menu", "🔤": "type", "♊": "copy", "📱": "smartphone",
  "🗺️": "map", "💾": "save", "🗓️": "calendar-days", "💡": "lightbulb", "⚙": "sliders-horizontal", "🔒": "lock",
  "🖨": "printer", "📅": "calendar", "⚠️": "triangle-alert", "⚠": "triangle-alert", "☁️": "cloud", "⬆": "arrow-up-right", "⬇": "download", "ℹ️": "info", "◀": "chevron-left", "▶": "chevron-right",
};
const ESPECIAIS = [["⬆ Receber", "↑", "arrow-up-right", " Receber"], ["⬇ Pagar", "↓", "arrow-down-left", " Pagar"]];
function svg(nome) {
  const src = readFileSync(`node_modules/lucide-react/dist/esm/icons/${nome}.mjs`, "utf8");
  const i = src.indexOf("const __iconData = ") + 19;
  const { node } = Function("return " + src.slice(i, src.indexOf("\n};", i) + 3))();
  const corpo = node.map(([tag, at]) => `<${tag} ${Object.entries(at).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>`;
}
const CORES = { "#f5821f": "#ff9500", "#22c7d6": "#32ade6", "#2f6fb5": "#0071e3", "#12a150": "#34c759", "#d63a2f": "#ff3b30", "#6b5bd6": "#af52de", "#5b8def": "#0a84ff" };
export function aplicarIcones(script) {
  for (const [a, b] of Object.entries(CORES)) script = script.split(a).join(b);
  const usados = new Set();
  for (const [txt, , nome, resto] of ESPECIAIS) { script = script.split(txt).join(`<i class="ic ic-${nome}"></i>${resto}`); usados.add(nome); }
  // mais longos primeiro (variações com U+FE0F)
  for (const [e, nome] of Object.entries(MAPA).sort((a, b) => b[0].length - a[0].length)) {
    if (!script.includes(e)) continue;
    script = script.split(e).join(`<i class="ic ic-${nome}"></i>`); usados.add(nome);
  }
  const css = [...usados].map((n) => `.ic-${n}{--m:url("data:image/svg+xml,${encodeURIComponent(svg(n))}")}`).join("");
  return { script, css: `.ic{display:inline-block;width:1.08em;height:1.08em;vertical-align:-.17em;background:currentColor;-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat;flex-shrink:0}` + css };
}
