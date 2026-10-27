// Gera o app BRA Financeiro (/fin/) a partir do HTML original do v38.
// A interface não é alterada: só entram o adaptador do banco (antes do
// script do v38) e as tags de instalação no iPhone.
// Roda antes do build (npm run build → prebuild).
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

// .env.local no desenvolvimento; na Vercel as variáveis já vêm do ambiente
if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

mkdirSync("public/fin", { recursive: true });
await build({
  entryPoints: ["src/legado/adaptador.ts"],
  bundle: true, minify: true, format: "iife", target: "es2020",
  outfile: "public/fin/adaptador.js",
  define: { __SUPABASE_URL__: JSON.stringify(url), __SUPABASE_KEY__: JSON.stringify(chave) },
  logLevel: "warning",
});

const original = readFileSync("legado/financeiro-v38.html", "utf8");
const cabeca = [
  '<link rel="manifest" href="/fin/manifest.webmanifest">',
  '<link rel="icon" href="/icone-financeiro.png">',
  '<link rel="apple-touch-icon" href="/icone-financeiro-180.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="BRA Financeiro">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
].join("");
const partes = original.split("<script>");
if (partes.length !== 2) throw new Error("O HTML do v38 deveria ter exatamente um <script>.");
let html = partes[0] + '<script src="/fin/adaptador.js"></script><script>' + partes[1];
html = html.replace("</title>", "</title>" + cabeca);
writeFileSync("public/fin/index.html", html);
console.log(`Financeiro v38 gerado em public/fin/ (${url ? "conectado ao Supabase" : "modo local, sem Supabase"})`);
