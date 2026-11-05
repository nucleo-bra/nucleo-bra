// Lê os produtos de um catálogo/tabela em PDF (o formato das tabelas dos
// distribuidores: bloco com "Código", código do item, NCM, preços e descrição).
// O preço do catálogo NÃO é usado: o produto entra sem valor, para ser
// precificado na aba Preços.

export type ItemPdf = { x: number; y: number; s: string; t: number };
export type ProdutoCatalogo = {
  chave: string; codigo: string; ncm: string; nome: string; modelo: string; descricao: string; pagina: number;
};

/** Texto do PDF com posição (x, y, tamanho da letra), página por página. */
export async function extrairItensPdf(dados: ArrayBuffer): Promise<ItemPdf[][]> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(dados.slice(0)), useSystemFonts: true });
  const doc = await tarefa.promise;
  const paginas: ItemPdf[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    paginas.push(c.items.flatMap((it) => ("str" in it && it.str.trim() ? [{ x: it.transform[4], y: it.transform[5], s: it.str.trim(), t: Math.abs(it.transform[0]) || Math.abs(it.transform[3]) }] : [])));
  }
  await tarefa.destroy();
  return paginas;
}

const limpar = (s: string) => s.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
const maiusculas = (s: string) => { const l = s.replace(/[^A-Za-zÀ-ÿ]/g, ""); return l.length >= 2 && l.replace(/[^A-ZÀ-Þ]/g, "").length / l.length >= 0.7; };
/** junta itens na mesma linha (mesmo y ± 2,5) e devolve as linhas de cima para baixo */
function linhas(itens: ItemPdf[]) {
  const L: { y: number; partes: ItemPdf[] }[] = [];
  for (const it of [...itens].sort((a, b) => b.y - a.y)) {
    const l = L.find((x) => Math.abs(x.y - it.y) <= 2.5);
    if (l) l.partes.push(it); else L.push({ y: it.y, partes: [it] });
  }
  return L.map((l) => ({ y: l.y, texto: limpar(l.partes.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ")) }));
}
const MODELO = /\b([A-Z]{1,6}[A-Z0-9]*-[A-Z0-9][A-Z0-9.\-/]{1,}|[A-Z]{2,}\d{2,}[A-Z0-9\-]*)\b/;
const RUIDO = /^(revenda|consumidor|ncm|código|codigo|descrição|descricao|tabela de preços|r\$\s?[\d.,]+|\d{8,9}|sob encomenda|últimas unidades)$/i;

export function lerProdutosCatalogo(paginas: ItemPdf[][]): ProdutoCatalogo[] {
  const out: ProdutoCatalogo[] = [];
  paginas.forEach((itens, ip) => {
    const ancoras = itens.filter((i) => /^c[óo]digo$/i.test(i.s)).sort((a, b) => b.y - a.y);
    ancoras.forEach((a, k) => {
      const prox = ancoras.slice(k + 1).find((b) => Math.abs(b.x - a.x) < 40);
      const limite = prox ? prox.y : -Infinity;
      const col = itens.filter((i) => Math.abs(i.x - a.x) < 14 && i.y < a.y && i.y > a.y - 70);
      const codigo = col.filter((i) => /^\d{4,6}$/.test(i.s)).sort((x, y) => y.y - x.y)[0];
      if (!codigo) return;
      const ncm = col.find((i) => /^\d{8,9}$/.test(i.s.replace(/\D/g, "")) && i.y < codigo.y);
      // título: à esquerda da coluna do código, perto da âncora (pode começar um pouco acima)
      const esq = itens.filter((i) => i.x < a.x - 4 && i.y <= a.y + 28 && i.y >= Math.max(codigo.y - 22, limite + 30) && !RUIDO.test(i.s) && !/faturados a partir/i.test(i.s));
      // títulos de seção (letra maior) ficam de fora
      const menor = Math.min(...esq.map((i) => i.t || 99));
      const esqTitulo = esq.filter((i) => !i.t || i.t <= menor + 1);
      let titulo = linhas(esqTitulo).filter((l) => maiusculas(l.texto)).map((l) => l.texto).join(" ");
      // layout com título acima da âncora em toda a largura
      if (!titulo) titulo = linhas(itens.filter((i) => i.y > a.y + 2 && i.y <= a.y + 30 && !/tabela de pre|outubro|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|novembro|dezembro/i.test(i.s)))
        .filter((l) => maiusculas(l.texto)).map((l) => l.texto).join(" ");
      // descrição: à direita da coluna do código, da âncora até o próximo bloco
      const dir = itens.filter((i) => i.x > a.x + 18 && i.y < a.y + 3 && i.y > limite + 3 && i.y > 40 && !/^descri[çc][ãa]o:?$/i.test(i.s) && !/faturados a partir/i.test(i.s));
      const desc = linhas(dir).map((l) => l.texto).filter((t) => !RUIDO.test(t));
      const nome = limpar(titulo.replace(/\s*-\s*$/, "")) || desc[0] || `Item ${codigo.s}`;
      const modelo = (nome.match(MODELO)?.[1] ?? desc.slice(0, 2).join(" ").match(MODELO)?.[1] ?? "").replace(/[.\-]$/, "");
      out.push({
        chave: `${ip + 1}-${codigo.s}`, codigo: codigo.s, ncm: (ncm?.s.replace(/\D/g, "") ?? "").slice(0, 8), nome: nome.slice(0, 160), modelo,
        descricao: limpar(desc.join("\n").replace(/\n(?=[a-zà-ÿ(])/g, " ")).slice(0, 1800), pagina: ip + 1,
      });
    });
  });
  out.push(...lerTabelasSku(paginas));
  // o mesmo código pode aparecer em mais de uma página (índice + detalhe): fica o mais completo
  const porCodigo = new Map<string, ProdutoCatalogo>();
  for (const p of out) { const x = porCodigo.get(p.codigo); if (!x || p.descricao.length > x.descricao.length) porCodigo.set(p.codigo, p); }
  return [...porCodigo.values()];
}

/**
 * Layout de tabela (ex.: AAT): blocos com um título à esquerda e uma tabela
 * "SKU | Descrição | Unidade | NCM | Preço". Cada linha da tabela é um produto;
 * o texto do bloco vira a descrição.
 */
function lerTabelasSku(paginas: ItemPdf[][]): ProdutoCatalogo[] {
  const out: ProdutoCatalogo[] = [];
  paginas.forEach((itens, ip) => {
    const cabecalhos = itens.filter((i) => /^sku$/i.test(i.s)).filter((h) => itens.some((j) => Math.abs(j.y - h.y) <= 2.5 && /^descri[çc][ãa]o$/i.test(j.s)));
    if (!cabecalhos.length) return;
    const colunas = (h: ItemPdf) => itens.filter((j) => Math.abs(j.y - h.y) <= 2.5).sort((a, b) => a.x - b.x).map((j) => ({ x: j.x, nome: norm(j.s) }));
    // títulos dos blocos: textos em maiúsculas na margem esquerda com letra maior que a das especificações
    const tSpec = Math.min(...itens.filter((i) => i.x < 120).map((i) => i.t || 99));
    const titulos = itens.filter((i) => i.x < 60 && maiusculas(i.s) && i.s.length > 4 && (i.t || 0) > tSpec + 1).sort((a, b) => b.y - a.y);
    for (const h of cabecalhos) {
      const cols = colunas(h);
      const colDe = (x: number) => { let c = cols[0]; for (const k of cols) if (k.x <= x + 12) c = k; return c.nome; };
      const tit = titulos.filter((t) => t.y > h.y).sort((a, b) => a.y - b.y)[0];
      const topo = tit ? tit.y + 3 : Infinity;
      const proxTit = titulos.filter((t) => t.y < h.y).sort((a, b) => b.y - a.y)[0];
      const proxCab = cabecalhos.filter((c) => c.y < h.y).sort((a, b) => b.y - a.y)[0];
      const fundo = Math.max(proxTit ? proxTit.y : -Infinity, proxCab ? proxCab.y + 1 : -Infinity, 40);
      const abaixo = linhasItens(itens.filter((i) => i.y < h.y - 2 && i.y > fundo && i.x >= h.x - 15));
      const linhasTabela = abaixo.filter((l) => l.partes.some((p) => /^\d{3}[.\d]{3,}$/.test(p.s) && Math.abs(p.x - h.x) < 20));
      const usados = new Set(linhasTabela.flatMap((l) => l.partes));
      const bloco = itens.filter((i) => i.y < topo && i.y > fundo && !usados.has(i) && i !== tit && Math.abs(i.y - h.y) > 2.5 && !/^ir para o site$/i.test(i.s));
      const direita = linhas(bloco.filter((i) => i.x >= h.x - 15)).map((l) => l.texto);
      const esquerda = linhas(bloco.filter((i) => i.x < h.x - 15)).map((l) => l.texto);
      const descricao = limpar([...direita, ...esquerda].join("\n").replace(/\n(?=[a-zà-ÿ(])/g, " ")).slice(0, 1800);
      for (const l of linhasTabela) {
        const cel: Record<string, string> = {};
        for (const p of l.partes.sort((a, b) => a.x - b.x)) { const c = colDe(p.x); cel[c] = cel[c] ? `${cel[c]} ${p.s}` : p.s; }
        const codigo = (cel["sku"] ?? "").trim(), nome = limpar(cel["descricao"] ?? "");
        if (!codigo || !nome) continue;
        const sub = direita.find((t) => norm(t) !== norm(nome) && t.length <= 70 && /[a-zà-ÿ]/.test(t))?.replace(/\.$/, "");
        out.push({ chave: `${ip + 1}-${codigo}`, codigo, ncm: (cel["ncm"] ?? "").replace(/\D/g, "").slice(0, 8), nome: (sub ? `${nome} – ${sub}` : nome).slice(0, 160),
          modelo: nome.replace(/^[A-Z]{2,5}\s+(?=\S*\d)/, "").slice(0, 60), descricao, pagina: ip + 1 });
      }
    }
  });
  return out;
}
function linhasItens(itens: ItemPdf[]) {
  const L: { y: number; partes: ItemPdf[] }[] = [];
  for (const it of [...itens].sort((a, b) => b.y - a.y)) { const l = L.find((x) => Math.abs(x.y - it.y) <= 2.5); if (l) l.partes.push(it); else L.push({ y: it.y, partes: [it] }); }
  return L;
}

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const so = (s: string) => norm(s).replace(/\s/g, "");

const acessorio = (s: string) => /\b(tela|grade|grille|suporte|bracket|kit|adaptador|espelho|moldura|caixa de embutir|cabo)\b/.test(norm(s));
const VAZIAS = new Set(["de", "da", "do", "para", "com", "e", "em", "par", "unidade", "un", "caixa", "cx", "acustica", "acusticas", "caixas"]);
const CORES = new Set(["preto", "preta", "branco", "branca", "black", "white", "madeira", "walnut", "oak", "bronze", "prata", "cinza", "grafite", "inox"]);
const palavras = (s: string, marca: string) => { const m = new Set(norm(marca).split(" ")); return norm(s).split(" ").filter((w) => w.length > 1 && !VAZIAS.has(w) && !m.has(w)); };

export type Existente<T> = { produto: T; certeza: "igual" | "parecido" };

/**
 * Procura o produto do catálogo no cadastro. "igual": mesmo código do
 * fornecedor, mesmo modelo ou mesmo nome. "parecido": nome quase igual (mesmos
 * números e mesma cor) — fica para conferir antes de subir.
 */
export function acharExistente<T extends { id: string; nome: string; modelo: string; referencia: string; marca: string }>(
  p: ProdutoCatalogo, existentes: T[], marca: string,
): Existente<T> | null {
  const m = so(marca), cod = p.codigo.replace(/\s/g, ""), mod = so(p.modelo), nome = norm(p.nome);
  const daMarca = existentes.filter((e) => { const em = so(e.marca); return !m || !em || em.includes(m) || m.includes(em); });
  for (const e of existentes) {
    if (mod.length >= 4 && /\d/.test(mod) && /[a-z]/.test(mod) && (so(e.modelo) === mod || so(e.referencia) === mod || (so(e.nome).includes(mod) && acessorio(p.nome) === acessorio(e.nome)))) return { produto: e, certeza: "igual" };
  }
  for (const e of daMarca) {
    if (cod && so(e.referencia) === so(cod)) return { produto: e, certeza: "igual" };
    if (nome && norm(e.nome) === nome) return { produto: e, certeza: "igual" };
  }
  // nome parecido: as palavras do menor estão quase todas no maior, com os mesmos números e a mesma cor
  const A = palavras(`${p.nome} ${p.modelo}`, marca);
  let melhor: T | null = null, nota = 0;
  for (const e of daMarca) {
    const B = palavras(`${e.nome} ${e.modelo}`, marca);
    if (!A.length || !B.length) continue;
    const num = (L: string[]) => L.filter((w) => /\d/.test(w)).sort().join(" ");
    const cor = (L: string[]) => L.filter((w) => CORES.has(w)).sort().join(" ");
    if (num(A) !== num(B)) continue;
    if (cor(A) && cor(B) && cor(A) !== cor(B)) continue;
    if (acessorio(p.nome) !== acessorio(e.nome)) continue;
    const SA = new Set(A.filter((w) => !CORES.has(w))), SB = new Set(B.filter((w) => !CORES.has(w)));
    let comum = 0; for (const w of SA) if (SB.has(w)) comum++;
    const n = comum / Math.max(1, Math.min(SA.size, SB.size));
    if (n > nota) { nota = n; melhor = e; }
  }
  return melhor && nota >= 0.8 ? { produto: melhor, certeza: "parecido" } : null;
}
