// Word (.docx) → definição do pdfmake, para baixar o contrato em PDF direto
// do navegador, sem Word. Cobre o que os modelos de contrato usam: parágrafos
// (alinhamento, recuos, espaçamentos, bordas, listas), textos (negrito, itálico,
// cor, tamanho, fonte), tabelas (larguras, sombreamento, cabeçalho repetido),
// imagens (em linha e flutuantes), quebras de página, seções com cabeçalho e
// rodapé próprios e os campos PÁGINA / NÚMERO DE PÁGINAS.
// Fontes: Calibri → Carlito e Cambria → Caladea (mesmas medidas, licença livre).
import PizZip from "pizzip";
import { DOMParser } from "@xmldom/xmldom";

/* eslint-disable @typescript-eslint/no-explicit-any -- a definição do pdfmake é um objeto livre */
type No = any;
type El = Element;
export type Imagem = { dados: Uint8Array; ext: string };
export type Conversao = {
  conteudo: No[];
  secoes: { id: string; cabecalho: No[] | null; rodape: No[] | null; primeiraDiferente: boolean; cabecalho1: No[] | null; rodape1: No[] | null }[];
  pagina: { largura: number; altura: number; margens: [number, number, number, number]; cabecalhoDist: number; rodapeDist: number };
  imagens: Record<string, string>;
  fonte: string;
  tamanho: number;
};

const tw = (v: string | null | undefined) => (v ? Number(v) / 20 : 0);      // twips → pt
const emu = (v: string | null | undefined) => (v ? Number(v) / 12700 : 0);  // EMU → pt
const filhos = (e: El | null | undefined, nome?: string): El[] => {
  if (!e) return [];
  const out: El[] = [];
  for (let n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (!nome || (n as El).nodeName === nome)) out.push(n as El);
  return out;
};
const filho = (e: El | null | undefined, nome: string) => filhos(e, nome)[0] ?? null;
const at = (e: El | null | undefined, nome: string) => (e ? e.getAttribute(nome) : null);
const ligado = (e: El | null) => !!e && !["0", "false", "off"].includes(at(e, "w:val") ?? "");
const desc = (e: El, nome: string): El[] => Array.from(e.getElementsByTagName(nome)) as unknown as El[];

type PProps = {
  jc?: string; antes?: number; depois?: number; linha?: number; regra?: string; esq?: number; dir?: number; primeira?: number; pendente?: number;
  bordaSup?: { cor: string; esp: number; larg: number }; bordaInf?: { cor: string; esp: number; larg: number };
  num?: { id: string; nivel: number }; tabsDireita?: boolean; quebraAntes?: boolean; estilo?: string; manter?: boolean;
};
type RProps = { b?: boolean; i?: boolean; u?: boolean; cor?: string; sz?: number; fonte?: string; caps?: boolean; oculto?: boolean };

function lerP(p: El | null): PProps {
  if (!p) return {};
  const o: PProps = {};
  const jc = filho(p, "w:jc"); if (jc) o.jc = at(jc, "w:val") ?? undefined;
  const sp = filho(p, "w:spacing");
  if (sp) {
    if (at(sp, "w:before") !== null) o.antes = tw(at(sp, "w:before"));
    if (at(sp, "w:after") !== null) o.depois = tw(at(sp, "w:after"));
    if (at(sp, "w:line") !== null) { o.linha = Number(at(sp, "w:line")); o.regra = at(sp, "w:lineRule") ?? "auto"; }
  }
  const ind = filho(p, "w:ind");
  if (ind) {
    const e = at(ind, "w:left") ?? at(ind, "w:start"); if (e !== null) o.esq = tw(e);
    const d = at(ind, "w:right") ?? at(ind, "w:end"); if (d !== null) o.dir = tw(d);
    if (at(ind, "w:firstLine") !== null) o.primeira = tw(at(ind, "w:firstLine"));
    if (at(ind, "w:hanging") !== null) o.pendente = tw(at(ind, "w:hanging"));
  }
  const bd = filho(p, "w:pBdr");
  if (bd) for (const [lado, k] of [["w:top", "bordaSup"], ["w:bottom", "bordaInf"]] as const) {
    const b = filho(bd, lado);
    if (b && at(b, "w:val") !== "nil" && at(b, "w:val") !== "none")
      o[k] = { cor: "#" + ((at(b, "w:color") ?? "000000").replace("auto", "000000")), esp: Number(at(b, "w:space") ?? 1), larg: Number(at(b, "w:sz") ?? 4) / 8 };
  }
  const np = filho(p, "w:numPr");
  if (np) { const id = at(filho(np, "w:numId"), "w:val"); if (id && id !== "0") o.num = { id, nivel: Number(at(filho(np, "w:ilvl"), "w:val") ?? 0) }; }
  const tabs = filho(p, "w:tabs");
  if (tabs && filhos(tabs, "w:tab").some((t) => ["right", "end"].includes(at(t, "w:val") ?? ""))) o.tabsDireita = true;
  if (ligado(filho(p, "w:pageBreakBefore"))) o.quebraAntes = true;
  if (ligado(filho(p, "w:keepNext"))) o.manter = true;
  const ps = filho(p, "w:pStyle"); if (ps) o.estilo = at(ps, "w:val") ?? undefined;
  return o;
}
function lerR(r: El | null, tema: { menor: string; maior: string }): RProps {
  if (!r) return {};
  const o: RProps = {};
  const b = filho(r, "w:b"); if (b) o.b = ligado(b);
  const i = filho(r, "w:i"); if (i) o.i = ligado(i);
  const u = filho(r, "w:u"); if (u) o.u = (at(u, "w:val") ?? "single") !== "none";
  const c = filho(r, "w:color"); if (c && at(c, "w:val") !== "auto") o.cor = "#" + at(c, "w:val");
  const sz = filho(r, "w:sz"); if (sz) o.sz = Number(at(sz, "w:val")) / 2;
  const f = filho(r, "w:rFonts");
  if (f) {
    const nome = at(f, "w:ascii") ?? at(f, "w:hAnsi");
    const t = at(f, "w:asciiTheme") ?? at(f, "w:hAnsiTheme");
    o.fonte = nome ?? (t ? (t.startsWith("major") ? tema.maior : tema.menor) : undefined);
  }
  if (filho(r, "w:caps")) o.caps = ligado(filho(r, "w:caps"));
  if (filho(r, "w:vanish")) o.oculto = ligado(filho(r, "w:vanish"));
  return o;
}
const fontePdf = (nome?: string) => (/cambria|georgia|times|garamond|serif/i.test(nome ?? "") ? "Caladea" : "Carlito");

export async function converterDocx(dados: ArrayBuffer | Uint8Array, opcoes: { imagem?: (img: Imagem) => Promise<Imagem | null> } = {}): Promise<Conversao> {
  const zip = new PizZip(dados);
  const ler = (f: string) => zip.file(f)?.asText() ?? null;
  const xml = (f: string) => { const t = ler(f); return t ? (new DOMParser().parseFromString(t, "text/xml").documentElement as unknown as El) : null; };
  const doc = xml("word/document.xml");
  if (!doc) throw new Error("Arquivo Word inválido.");

  // ---------------------------------------------------------- tema e estilos
  const temaXml = ler("word/theme/theme1.xml") ?? "";
  const tema = {
    menor: temaXml.match(/<a:minorFont>\s*<a:latin typeface="([^"]+)"/)?.[1] ?? "Calibri",
    maior: temaXml.match(/<a:majorFont>\s*<a:latin typeface="([^"]+)"/)?.[1] ?? "Cambria",
  };
  const estilos = xml("word/styles.xml");
  const defP = lerP(filho(filho(filho(estilos, "w:docDefaults"), "w:pPrDefault"), "w:pPr"));
  const defR = lerR(filho(filho(filho(estilos, "w:docDefaults"), "w:rPrDefault"), "w:rPr"), tema);
  const mapa = new Map<string, { base?: string; p: PProps; r: RProps; tipo: string; padrao: boolean }>();
  for (const s of filhos(estilos, "w:style")) {
    mapa.set(at(s, "w:styleId") ?? "", {
      base: at(filho(s, "w:basedOn"), "w:val") ?? undefined, p: lerP(filho(s, "w:pPr")), r: lerR(filho(s, "w:rPr"), tema),
      tipo: at(s, "w:type") ?? "", padrao: at(s, "w:default") === "1",
    });
  }
  const padraoP = [...mapa].find(([, v]) => v.tipo === "paragraph" && v.padrao)?.[0];
  const cadeia = (id?: string): { p: PProps; r: RProps } => {
    const s = id ? mapa.get(id) : undefined;
    if (!s) return { p: {}, r: {} };
    const b = s.base && s.base !== id ? cadeia(s.base) : { p: {}, r: {} };
    return { p: { ...b.p, ...s.p }, r: { ...b.r, ...s.r } };
  };

  // ---------------------------------------------------------- numeração (listas)
  const numeracao = xml("word/numbering.xml");
  const abstratos = new Map<string, El>();
  for (const a of filhos(numeracao, "w:abstractNum")) abstratos.set(at(a, "w:abstractNumId") ?? "", a);
  const numParaAbs = new Map<string, string>();
  for (const n of filhos(numeracao, "w:num")) numParaAbs.set(at(n, "w:numId") ?? "", at(filho(n, "w:abstractNumId"), "w:val") ?? "");
  const nivelLista = (id: string, nivel: number) => {
    const a = abstratos.get(numParaAbs.get(id) ?? "");
    const lvl = filhos(a, "w:lvl").find((l) => Number(at(l, "w:ilvl")) === nivel);
    return { fmt: at(filho(lvl, "w:numFmt"), "w:val") ?? "bullet", texto: at(filho(lvl, "w:lvlText"), "w:val") ?? "•", p: lerP(filho(lvl, "w:pPr")) };
  };
  const contadores = new Map<string, number>();

  // ---------------------------------------------------------- imagens
  const imagens: Record<string, string> = {};
  let nImg = 0;
  async function imagemDe(rid: string, rels: Map<string, string>) {
    const alvo = rels.get(rid);
    if (!alvo) return null;
    const caminho = "word/" + alvo.replace(/^\.\//, "").replace(/^\/word\//, "");
    const f = zip.file(caminho);
    if (!f) return null;
    let img: Imagem | null = { dados: f.asUint8Array(), ext: (caminho.split(".").pop() ?? "png").toLowerCase() };
    if (!["png", "jpg", "jpeg"].includes(img.ext)) img = opcoes.imagem ? await opcoes.imagem(img) : null;
    if (!img) return null;
    const nome = `img${++nImg}`;
    let s = "";
    for (let i = 0; i < img.dados.length; i += 0x8000) s += String.fromCharCode(...img.dados.subarray(i, i + 0x8000));
    imagens[nome] = `data:image/${img.ext === "jpg" ? "jpeg" : img.ext};base64,${btoa(s)}`;
    return nome;
  }
  const lerRels = (f: string) => {
    const m = new Map<string, string>();
    for (const r of filhos(xml(f), "Relationship")) m.set(at(r, "Id") ?? "", at(r, "Target") ?? "");
    return m;
  };

  // ---------------------------------------------------------- parágrafo
  async function paragrafo(p: El, rels: Map<string, string>, ..._r: unknown[]): Promise<No[]> { void _r;
    const direto = lerP(filho(p, "w:pPr"));
    const est = cadeia(direto.estilo ?? padraoP);
    const pp: PProps = { ...defP, ...est.p, ...direto };
    const rBase: RProps = { ...defR, ...est.r, ...lerR(filho(filho(p, "w:pPr"), "w:rPr"), tema) };
    delete rBase.oculto;
    const runs: No[] = [];
    const flutuantes: No[] = [];
    let quebraDepois = false;
    let campo: { instr: string; fase: "instr" | "res" } | null = null;

    const addTexto = (t: string, r: RProps) => {
      if (!t || r.oculto) return;
      runs.push({
        text: r.caps ? t.toUpperCase() : t, bold: !!r.b, italics: !!r.i, color: r.cor ?? "#000000", fontSize: r.sz ?? 11,
        font: fontePdf(r.fonte), ...(r.u ? { decoration: "underline" } : {}),
      });
    };
    const processarRun = async (r: El, rp: RProps) => {
      for (const c of filhos(r)) {
        const nome = c.nodeName;
        if (nome === "w:fldChar") {
          const t = at(c, "w:fldCharType");
          if (t === "begin") campo = { instr: "", fase: "instr" };
          else if (t === "separate" && campo) campo.fase = "res";
          else if (t === "end" && campo) {
            const ins = campo.instr.trim().split(/\s+/)[0]?.toUpperCase();
            campo = null;
            if (ins === "PAGE") addTexto("\u0001PAGINA\u0001", rp);
            else if (ins === "NUMPAGES" || ins === "SECTIONPAGES") addTexto("\u0001TOTAL\u0001", rp);
          }
          continue;
        }
        if (nome === "w:instrText") { if (campo) campo.instr += c.textContent ?? ""; continue; }
        if (campo) continue; // texto do resultado do campo (desatualizado): ignorado
        if (nome === "w:t") addTexto(c.textContent ?? "", rp);
        else if (nome === "w:tab") addTexto("\t", rp);
        else if (nome === "w:br" || nome === "w:cr") { if (at(c, "w:type") === "page") quebraDepois = true; else addTexto("\n", rp); }
        else if (nome === "w:noBreakHyphen") addTexto("-", rp);
        else if (nome === "w:sym") addTexto(String.fromCharCode(parseInt(at(c, "w:char") ?? "2022", 16) & 0xffff), rp);
        else if (nome === "w:drawing") {
          const cont = filho(c, "wp:inline") ?? filho(c, "wp:anchor");
          const blip = cont ? desc(cont, "a:blip")[0] : null;
          const ext = cont ? filho(cont, "wp:extent") : null;
          const nomeImg = blip ? await imagemDe(at(blip, "r:embed") ?? "", rels) : null;
          if (!nomeImg || !ext) continue;
          const img: No = { image: nomeImg, width: emu(at(ext, "cx")), height: emu(at(ext, "cy")) };
          if (cont!.nodeName === "wp:anchor") {
            const ph = filho(cont, "wp:positionH"), pv = filho(cont, "wp:positionV");
            img.relativePosition = { x: emu(filho(ph, "wp:posOffset")?.textContent), y: emu(filho(pv, "wp:posOffset")?.textContent) };
            flutuantes.push(img);
          } else runs.push({ __img: img });
        }
      }
    };
    for (const c of filhos(p)) {
      if (c.nodeName === "w:r") {
        const rpEl = filho(c, "w:rPr");
        const rs = at(filho(rpEl, "w:rStyle"), "w:val") ?? undefined;
        await processarRun(c, { ...rBase, ...cadeia(rs).r, ...lerR(rpEl, tema) });
      } else if (c.nodeName === "w:hyperlink" || c.nodeName === "w:smartTag" || c.nodeName === "w:ins") {
        for (const r of filhos(c, "w:r")) await processarRun(r, { ...rBase, ...lerR(filho(r, "w:rPr"), tema) });
      } else if (c.nodeName === "w:fldSimple") {
        const ins = (at(c, "w:instr") ?? "").trim().split(/\s+/)[0]?.toUpperCase();
        const rp = { ...rBase, ...lerR(filho(filho(c, "w:r"), "w:rPr"), tema) };
        if (ins === "PAGE") addTexto("\u0001PAGINA\u0001", rp); else if (ins === "NUMPAGES") addTexto("\u0001TOTAL\u0001", rp);
      }
    }

    // ---- montagem
    const tam = runs.find((r) => r.fontSize)?.fontSize ?? rBase.sz ?? 11;
    const lineHeight = pp.regra === "auto" || !pp.regra ? (pp.linha ?? 240) / 240 : undefined;
    const alinhamento = ({ both: "justify", distribute: "justify", center: "center", right: "right", end: "right" } as Record<string, string>)[pp.jc ?? ""] ?? "left";
    let esq = pp.esq ?? 0;
    let marcador: string | null = null;
    if (pp.num) {
      const lv = nivelLista(pp.num.id, pp.num.nivel);
      esq = direto.esq ?? lv.p.esq ?? esq;
      const recuo = direto.pendente ?? lv.p.pendente ?? 18;
      const chave = pp.num.id + ":" + pp.num.nivel;
      const n = (contadores.get(chave) ?? 0) + 1; contadores.set(chave, n);
      marcador = lv.fmt === "bullet" ? "•" : lv.texto.replace(/%\d/, lv.fmt === "lowerLetter" ? String.fromCharCode(96 + n) : lv.fmt === "upperLetter" ? String.fromCharCode(64 + n) : lv.fmt === "lowerRoman" ? ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"][n - 1] ?? String(n) : String(n));
      esq = Math.max(0, esq - recuo);
      pp.pendente = recuo;
    }
    const imgsEmLinha = runs.filter((r) => r.__img).map((r) => r.__img);
    const textos = runs.filter((r) => !r.__img);
    const vazio = !textos.some((r) => r.text.trim());
    const base: No = {
      alignment: alinhamento, ...(lineHeight ? { lineHeight } : {}), fontSize: tam,
      ...(pp.primeira ? { leadingIndent: pp.primeira } : {}),
    };
    let corpo: No;
    if (!vazio && textos.some((r) => r.text.includes("\t")) && (pp.tabsDireita || alinhamento === "left")) {
      // texto à esquerda + texto alinhado à direita (ex.: cabeçalho "BRA AMBIENTES ⇥ Contrato 123")
      const partes: No[][] = [[]];
      for (const r of textos) {
        const pedacos = r.text.split("\t");
        pedacos.forEach((t: string, i: number) => { if (i > 0) partes.push([]); if (t) partes[partes.length - 1].push({ ...r, text: t }); });
      }
      corpo = { columns: [{ ...base, text: partes[0], width: "*" }, { ...base, text: partes.slice(1).flat(), width: "auto", alignment: "right" }] };
    } else if (imgsEmLinha.length && vazio) {
      corpo = { stack: imgsEmLinha.map((i: No) => ({ ...i, alignment: alinhamento })) };
    } else {
      corpo = { ...base, text: vazio ? [{ text: " ", fontSize: tam, font: fontePdf(rBase.fonte) }] : textos };
      if (imgsEmLinha.length) corpo = { stack: [corpo, ...imgsEmLinha.map((i: No) => ({ ...i, alignment: alinhamento }))] };
    }
    if (marcador) {
      corpo = { columns: [{ text: marcador, width: pp.pendente, fontSize: tam, font: "Carlito", color: textos[0]?.color ?? "#000000", ...(lineHeight ? { lineHeight } : {}) }, { ...corpo, width: "*" }], columnGap: 0 };
    }
    let no: No = { ...corpo, margin: [esq, pp.antes ?? 0, pp.dir ?? 0, pp.depois ?? 0] };
    if (pp.bordaSup || pp.bordaInf) {
      const s = pp.bordaSup, i = pp.bordaInf;
      no = {
        table: { widths: ["*"], body: [[{ ...corpo, margin: [0, 0, 0, 0] }]] },
        layout: {
          hLineWidth: (k: number) => (k === 0 ? (s ? Math.max(0.5, s.larg) : 0) : i ? Math.max(0.5, i.larg) : 0),
          hLineColor: (k: number) => (k === 0 ? s?.cor : i?.cor) ?? "#000000", vLineWidth: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => (s ? s.esp + 1 : 0), paddingBottom: () => (i ? i.esp + 1 : 0),
        },
        margin: [esq, pp.antes ?? 0, pp.dir ?? 0, pp.depois ?? 0],
      };
    }
    if (pp.quebraAntes) no.pageBreak = "before";
    // títulos (com borda inferior ou "manter com o próximo") não ficam sozinhos no fim da página
    if ((pp.manter || (pp.bordaInf && !vazio)) && !quebraDepois) no.__manter = true;
    if (vazio && !imgsEmLinha.length && !flutuantes.length) no.__vazio = true;
    const out: No[] = [...flutuantes, no];
    if (quebraDepois) out.push({ text: "", pageBreak: "after" });
    return out;
  }

  // ---------------------------------------------------------- tabela
  async function tabela(t: El, rels: Map<string, string>, larguraUtil: number): Promise<No> {
    const grid = filhos(filho(t, "w:tblGrid"), "w:gridCol").map((g) => tw(at(g, "w:w")));
    const soma = grid.reduce((a, b) => a + b, 0) || 1;
    const larguras = grid.map((g) => (soma > larguraUtil ? (g * larguraUtil) / soma : g));
    const tblPr = filho(t, "w:tblPr");
    const bordas = filho(tblPr, "w:tblBorders");
    const corBorda = (lado: string) => { const b = filho(bordas, lado); return b && at(b, "w:val") !== "nil" && at(b, "w:val") !== "none" ? "#" + (at(b, "w:color") ?? "auto").replace("auto", "000000") : null; };
    const temBordas = !!bordas && ["w:top", "w:insideH", "w:insideV", "w:left"].some((l) => corBorda(l));
    const linhas = filhos(t, "w:tr");
    const body: No[][] = [];
    let cab = 0;
    for (const [ri, tr] of linhas.entries()) {
      if (ri === cab && filho(filho(tr, "w:trPr"), "w:tblHeader")) cab++;
      const linha: No[] = [];
      for (const tc of filhos(tr, "w:tc")) {
        const tcPr = filho(tc, "w:tcPr");
        const span = Number(at(filho(tcPr, "w:gridSpan"), "w:val") ?? 1);
        const shd = at(filho(tcPr, "w:shd"), "w:fill");
        const pilha: No[] = [];
        for (const c of filhos(tc)) {
          if (c.nodeName === "w:p") pilha.push(...(await paragrafo(c, rels, larguraUtil)));
          else if (c.nodeName === "w:tbl") pilha.push(await tabela(c, rels, larguraUtil));
        }
        const cel: No = { stack: pilha, ...(shd && shd !== "auto" ? { fillColor: "#" + shd } : {}), ...(span > 1 ? { colSpan: span } : {}) };
        linha.push(cel);
        for (let k = 1; k < span; k++) linha.push({});
      }
      while (linha.length < larguras.length) linha.push({});
      body.push(linha.slice(0, larguras.length));
    }
    const cor = corBorda("w:insideH") ?? corBorda("w:top") ?? "#bfbfbf";
    return {
      table: { widths: larguras, body, headerRows: cab, dontBreakRows: true },
      layout: temBordas || !bordas
        ? { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => cor, vLineColor: () => corBorda("w:insideV") ?? cor, paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 1, paddingBottom: () => 1 }
        : "noBorders",
      margin: [0, 0, 0, 6],
    };
  }

  async function bloco(raiz: El, rels: Map<string, string>, larguraUtil: number) {
    const out: No[] = [];
    for (const c of filhos(raiz)) {
      if (c.nodeName === "w:p") out.push(...(await paragrafo(c, rels, larguraUtil)));
      else if (c.nodeName === "w:tbl") out.push(await tabela(c, rels, larguraUtil));
      else if (c.nodeName === "w:sdt") out.push(...(await bloco(filho(c, "w:sdtContent")!, rels, larguraUtil)));
    }
    return out;
  }

  // ---------------------------------------------------------- seções
  const corpo = filho(doc, "w:body")!;
  const relsDoc = lerRels("word/_rels/document.xml.rels");
  const sectFinal = filho(corpo, "w:sectPr");
  const pg = filho(sectFinal, "w:pgSz"), mg = filho(sectFinal, "w:pgMar");
  const pagina: Conversao["pagina"] = {
    largura: tw(at(pg, "w:w")) || 595.3, altura: tw(at(pg, "w:h")) || 841.9,
    margens: [tw(at(mg, "w:left")) || 72, tw(at(mg, "w:top")) || 72, tw(at(mg, "w:right")) || 72, tw(at(mg, "w:bottom")) || 72],
    cabecalhoDist: tw(at(mg, "w:header")) || 36, rodapeDist: tw(at(mg, "w:footer")) || 36,
  };
  const larguraUtil = pagina.largura - pagina.margens[0] - pagina.margens[2];

  async function parteDe(sect: El | null, tipo: "w:headerReference" | "w:footerReference", qual: "default" | "first") {
    const ref = filhos(sect, tipo).find((r) => (at(r, "w:type") ?? "default") === qual);
    if (!ref) return undefined;
    const alvo = relsDoc.get(at(ref, "r:id") ?? "");
    if (!alvo) return undefined;
    const raiz = xml("word/" + alvo);
    if (!raiz) return undefined;
    return bloco(raiz, lerRels("word/_rels/" + alvo + ".rels"), larguraUtil);
  }

  // divide o corpo em seções (o sectPr dentro de um parágrafo fecha a seção)
  const grupos: { elementos: El[]; sect: El | null }[] = [{ elementos: [], sect: null }];
  for (const c of filhos(corpo)) {
    if (c.nodeName === "w:sectPr") { grupos[grupos.length - 1].sect = c; continue; }
    grupos[grupos.length - 1].elementos.push(c);
    const s = c.nodeName === "w:p" ? filho(filho(c, "w:pPr"), "w:sectPr") : null;
    if (s) { grupos[grupos.length - 1].sect = s; grupos.push({ elementos: [], sect: null }); }
  }
  if (!grupos[grupos.length - 1].elementos.length && grupos.length > 1) grupos.pop();

  const conteudo: No[] = [];
  const secoes: Conversao["secoes"] = [];
  let cabAnterior: No[] | null = null, rodAnterior: No[] | null = null;
  for (const [i, g] of grupos.entries()) {
    const id = `__secao_${i}`;
    const cab: No[] | null = (await parteDe(g.sect, "w:headerReference", "default")) ?? (i === 0 ? null : cabAnterior);
    const rod: No[] | null = (await parteDe(g.sect, "w:footerReference", "default")) ?? (i === 0 ? null : rodAnterior);
    const primeira = !!filho(g.sect, "w:titlePg");
    secoes.push({
      id, cabecalho: cab, rodape: rod, primeiraDiferente: primeira,
      cabecalho1: primeira ? (await parteDe(g.sect, "w:headerReference", "first")) ?? null : null,
      rodape1: primeira ? (await parteDe(g.sect, "w:footerReference", "first")) ?? null : null,
    });
    cabAnterior = cab; rodAnterior = rod;
    const fim = { quebra: i > 0 };
    if (fim.quebra && conteudo[conteudo.length - 1]?.pageBreak !== "after") conteudo.push({ text: "", pageBreak: "after" });
    conteudo.push({ text: "\u00a0", fontSize: 1, lineHeight: 0.1, id });
    const tipo = at(filho(g.sect, "w:type"), "w:val");
    void tipo;
    const daSecao: No[] = [];
    for (const e of g.elementos) {
      if (e.nodeName === "w:p") daSecao.push(...(await paragrafo(e, relsDoc, larguraUtil)));
      else if (e.nodeName === "w:tbl") daSecao.push(await tabela(e, relsDoc, larguraUtil));
      else if (e.nodeName === "w:sdt") daSecao.push(...(await bloco(filho(e, "w:sdtContent")!, relsDoc, larguraUtil)));
    }
    // linhas vazias no fim de uma seção que termina em quebra não geram página em branco
    if (i < grupos.length - 1) {
      const quebra = daSecao[daSecao.length - 1]?.pageBreak === "after" ? daSecao.pop() : null;
      while (daSecao.length && daSecao[daSecao.length - 1].__vazio) daSecao.pop();
      if (quebra) daSecao.push(quebra);
    }
    conteudo.push(...daSecao);
  }
  return { conteudo: agrupar(conteudo), secoes, pagina, imagens, fonte: fontePdf(defR.fonte ?? tema.menor), tamanho: defR.sz ?? 11 };
}

/** Junta título + bloco seguinte para não separar entre páginas. */
function agrupar(nos: No[]): No[] {
  const out: No[] = [];
  for (let i = 0; i < nos.length; i++) {
    const a = nos[i];
    if (a.__manter && i + 1 < nos.length && !nos[i + 1].pageBreak && !(nos[i + 1].table && nos[i + 1].table.body.length > 6 && !nos[i + 1].__manter)) {
      const grupo = [a];
      while (nos[i + 1] && grupo[grupo.length - 1].__manter && !(nos[i + 1].table?.body.length > 6)) grupo.push(nos[++i]);
      if (grupo.length === 1) { out.push(a); continue; }
      out.push({ stack: grupo, unbreakable: true });
    } else out.push(a);
  }
  return out;
}

/** Troca os marcadores de página nos nós do cabeçalho/rodapé. */
function comPaginas(nos: No[], atual: number, total: number): No[] {
  const troca = (v: unknown): unknown => {
    if (typeof v === "string") return v.replace(/\u0001PAGINA\u0001/g, String(atual)).replace(/\u0001TOTAL\u0001/g, String(total));
    if (Array.isArray(v)) return v.map(troca);
    if (v && typeof v === "object" && !(v instanceof Function)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "function" ? x : troca(x)]));
    return v;
  };
  return troca(nos) as No[];
}

/**
 * Monta a definição final. `inicios` = página onde começa cada seção
 * (vem de uma primeira passada; sem ela, supõe 1 página por seção, menos a última).
 */
export function definicaoPdf(c: Conversao, inicios?: Record<string, number>, registrar?: (id: string, pagina: number) => void): No {
  const secaoDaPagina = (p: number) => {
    let idx = 0;
    c.secoes.forEach((s, i) => { const ini = inicios?.[s.id] ?? i + 1; if (p >= ini) idx = i; });
    return { s: c.secoes[idx], ini: inicios?.[c.secoes[idx].id] ?? idx + 1 };
  };
  const [ml, mt0, mr, mb0] = c.pagina.margens;
  const temCab = c.secoes.some((s) => s.cabecalho), temRod = c.secoes.some((s) => s.rodape);
  const mt = temCab ? Math.max(mt0, c.pagina.cabecalhoDist + 26) : mt0;
  const mb = temRod ? Math.max(mb0, c.pagina.rodapeDist + 26) : mb0;
  return {
    pageSize: { width: c.pagina.largura, height: c.pagina.altura },
    pageMargins: [ml, mt, mr, mb],
    defaultStyle: { font: c.fonte, fontSize: c.tamanho },
    images: c.imagens,
    content: c.conteudo,
    header: (atual: number, total: number) => {
      const { s, ini } = secaoDaPagina(atual);
      const nos = s.primeiraDiferente && atual === ini ? s.cabecalho1 : s.cabecalho;
      return nos ? { stack: comPaginas(nos, atual, total), margin: [ml, c.pagina.cabecalhoDist, mr, 0] } : null;
    },
    footer: (atual: number, total: number) => {
      const { s, ini } = secaoDaPagina(atual);
      const nos = s.primeiraDiferente && atual === ini ? s.rodape1 : s.rodape;
      return nos ? { stack: comPaginas(nos, atual, total), margin: [ml, Math.max(4, mb - c.pagina.rodapeDist - 22), mr, 0] } : null;
    },
    pageBreakBefore: registrar ? (no: { id?: string; startPosition?: { pageNumber: number } }) => {
      if (no.id?.startsWith("__secao_") && no.startPosition) registrar(no.id, no.startPosition.pageNumber);
      return false;
    } : undefined,
    info: { title: "Contrato", creator: "Núcleo BRA" },
  };
}
