// Depois do build: lista os arquivos do site para o service worker guardar no
// aparelho (out/precache.json) e carimba a versão no out/sw.js.
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ = "out";
if (!existsSync(RAIZ)) process.exit(0);
const fora = [/\.map$/, /^\/sw\.js$/, /^\/precache\.json$/, /^\/versao\.json$/, /^\/dados\//, /\.(mp4|mov|zip)$/i];
const lista = [];
(function andar(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n), s = statSync(p);
    if (s.isDirectory()) andar(p);
    else {
      const url = "/" + p.slice(RAIZ.length + 1).split("\\").join("/");
      if (fora.some((r) => r.test(url)) || s.size > 3 * 1024 * 1024) continue;
      lista.push(url.endsWith("/index.html") ? url : url);
    }
  }
})(RAIZ);
let versao = "dev";
try { versao = JSON.parse(readFileSync(join(RAIZ, "versao.json"), "utf8")).versao || versao; } catch { /* */ }
writeFileSync(join(RAIZ, "precache.json"), JSON.stringify(lista));
const sw = join(RAIZ, "sw.js");
if (existsSync(sw)) writeFileSync(sw, readFileSync(sw, "utf8").replace("__VERSAO__", versao + "-" + lista.length));
console.log(`offline: ${lista.length} arquivos para guardar no aparelho (versão ${versao})`);
