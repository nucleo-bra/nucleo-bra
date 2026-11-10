"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- definição livre do pdfmake */
// Documentação técnica de entrega (caderno final) e termo de entrega, no
// mesmo modelo premium do orçamento: capa, apresentação e marcas da BRA,
// capítulos por sistema e contracapa.
import { carregar, fotoParaPdf } from "./orcamento-pdf";
import { fotoProduto } from "./orcamentos";
import { Bloco, conteudoInicial, dataBr, Doc, GRUPOS, Obra, urlArquivo } from "./obras";

const A4 = { w: 595.28, h: 841.89 };
const MARINHO = "#1e2b4d", LARANJA = "#e35d25", CINZA = "#6b7280", LINHA = "#d9dde6";

export type Imagens = Record<string, string | null>;   // caminho → dataURL
export type OpcoesDoc = { comSenhas: boolean; senhas: Record<string, string>; imagens: Imagens; capa: string; responsavel?: string };

const vazio = (v: any) => !String(v ?? "").trim();
const linhaUtil = (l: Record<string, string>, ignorar: string[] = []) => Object.entries(l).some(([k, v]) => k !== "id" && !ignorar.includes(k) && !vazio(v));
const mascara = "••••••";

/** Tabela no estilo BRA: cabeçalho marinho, linhas zebradas, letra pequena. */
function tabela(b: Bloco, o: OpcoesDoc, docId: string, largura: number, manterSemDados: string[] = []): any {
  const cols = b.colunas;
  // switch/roteador: mostra todas as portas (livres também), desde que alguma esteja em uso
  const linhas = manterSemDados.length ? (b.linhas.some((l) => manterSemDados.some((k) => !vazio(l[k]))) ? b.linhas : []) : b.linhas.filter((l) => linhaUtil(l, ["porta", "item"]));
  if (!linhas.length) return null;
  const temGrupo = cols.some((c) => c.grupo);
  const cab1: any[] = [], cab2: any[] = [];
  if (temGrupo) {
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (!c.grupo) { cab1.push({ text: c.rot, rowSpan: 2, style: "th" }); cab2.push({}); continue; }
      const span = cols.slice(i).findIndex((x) => x.grupo !== c.grupo);
      const n = span < 0 ? cols.length - i : span;
      if (i === 0 || cols[i - 1].grupo !== c.grupo) { cab1.push({ text: c.grupo, colSpan: n, style: "th" }); for (let k = 1; k < n; k++) cab1.push({}); }
      cab2.push({ text: c.rot, style: "th2" });
    }
  } else cols.forEach((c) => cab1.push({ text: c.rot, style: "th" }));
  const corpo = linhas.map((l, li) => cols.map((c) => {
    let v = l[c.k] ?? "";
    if (c.secreto) { const s = o.senhas[`tab:${docId}:${l.id}:${c.k}`] ?? ""; v = s ? (o.comSenhas ? s : mascara) : ""; }
    return { text: vazio(v) ? "-" : String(v), fillColor: li % 2 ? "#f5f6f9" : null, alignment: c.larg && c.larg < 45 ? "center" : "left" };
  }));
  const somaFixas = cols.reduce((a, c) => a + (c.larg ?? 0), 0), livres = cols.filter((c) => !c.larg).length;
  const fator = Math.min(1, (largura - cols.length * 9) / Math.max(1, somaFixas + livres * 60));
  const widths = cols.map((c) => (c.larg ? c.larg * fator : "*"));
  return {
    margin: [0, 0, 0, 16], stack: [
      b.titulo ? { text: b.titulo.toUpperCase(), bold: true, color: MARINHO, fontSize: 8.4, characterSpacing: 1, margin: [0, 0, 0, 6] } : { text: "" },
      { table: { headerRows: temGrupo ? 2 : 1, widths, body: temGrupo ? [cab1, cab2, ...corpo] : [cab1, ...corpo] },
        fontSize: cols.length > 10 ? 6 : 7.4,
        layout: { hLineWidth: () => 0.4, vLineWidth: () => 0.4, hLineColor: () => LINHA, vLineColor: () => LINHA, paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 4, paddingRight: () => 4 } },
    ],
  };
}

function titulo(texto: string): any { return { text: texto, bold: true, fontSize: 11.5, color: MARINHO, margin: [0, 4, 0, 10] }; }
function imagemOuAviso(o: OpcoesDoc, caminho: string | undefined, fit: [number, number]): any {
  const d = caminho ? o.imagens[caminho] : null;
  return d ? { image: d, fit, alignment: "center" } : { text: "(imagem não carregada)", color: CINZA, fontSize: 7, alignment: "center", margin: [0, 20, 0, 20] };
}

/** Conteúdo de um cartão da documentação. `largura` = área útil da página. */
function renderDoc(d: Doc, o: OpcoesDoc, ob: Obra, largura: number): any[] {
  const c = d.conteudo ?? {};
  const out: any[] = [];
  switch (d.modelo) {
    case "objetivo":
      out.push(...String(c.texto ?? "").split(/\n{2,}/).map((p: string) => ({ text: p.trim(), fontSize: 9, lineHeight: 1.45, alignment: "justify", margin: [0, 0, 0, 8] })));
      if (ob.endereco || ob.cliente_nome) out.push({ text: [{ text: "Cliente: ", bold: true }, ob.cliente_nome ?? "", ob.endereco ? { text: "   ·   Endereço: ", bold: true } : "", ob.endereco ?? ""], fontSize: 8.4, color: "#374151", margin: [0, 6, 0, 0] });
      break;
    case "plantas": {
      if (!(c.itens ?? []).length) break;
      out.push(titulo(d.titulo));
      for (const it of c.itens ?? []) {
        const pgs: string[] = it.paginas?.length ? it.paginas : it.imagem ? [it.imagem] : [];
        if (it.legenda) out.push({ text: "•  " + it.legenda, bold: true, fontSize: 9, margin: [0, 2, 0, 6] });
        if (!pgs.length) out.push({ text: `Arquivo anexo: ${it.nome} (disponível no link de arquivos)`, fontSize: 8, color: CINZA, margin: [0, 0, 0, 10] });
        pgs.forEach((p) => out.push({ ...imagemOuAviso(o, p, [largura, 300]), margin: [0, 0, 0, 12] }));
      }
      if (c.obs) out.push({ text: c.obs, color: "#d70015", fontSize: 8, alignment: "center", margin: [0, 4, 0, 0] });
      break;
    }
    case "equipamentos": {
      out.push(titulo("Lista de equipamentos instalados"));
      const itens = (c.itens ?? []).filter((x: any) => !vazio(x.nome));
      const card = (x: any) => ({ unbreakable: true, margin: [0, 0, 0, 12], stack: [
        { text: [{ text: "✓  ", color: "#1f8a3b", bold: true }, { text: `${String(x.qtd ?? 1).padStart(2, "0")} ${x.nome}`, bold: true }, x.modelo ? { text: ` – ${x.modelo}`, color: "#374151" } : ""], fontSize: 8.6, margin: [0, 0, 0, 5] },
        { columns: [{ width: 120, ...(x.foto && o.imagens["p:" + x.foto] ? { image: o.imagens["p:" + x.foto], fit: [110, 72] } : { text: "" }) }, { width: "*", text: x.foto ? "* Imagem ilustrativa." : "", fontSize: 6.4, color: CINZA, margin: [0, 60, 0, 0] }] },
      ] });
      for (let i = 0; i < itens.length; i += 2) out.push({ columns: [{ width: "*", ...card(itens[i]) }, { width: 20, text: "" }, itens[i + 1] ? { width: "*", ...card(itens[i + 1]) } : { width: "*", text: "" }] });
      break;
    }
    case "circuitos": case "pulsadores": case "redes": case "relacao": {
      out.push(titulo(d.titulo));
      for (const b of (c.blocos ?? []) as Bloco[]) {
        const t = tabela(b, o, d.id, largura, d.modelo === "redes" && b.colunas.some((x) => x.k === "dispositivo") ? ["dispositivo", "vlan", "obs"] : []);
        if (t) out.push(t);
      }
      break;
    }
    case "cenas": {
      out.push(titulo("Mapa de cenas"));
      let pav = "";
      for (const cx of c.caixas ?? []) {
        if (cx.pavimento && cx.pavimento !== pav) { pav = cx.pavimento; out.push({ text: "Pulsadores · " + pav, bold: true, fontSize: 9, color: MARINHO, margin: [0, 4, 0, 8] }); }
        const ts: any[] = cx.teclas ?? [];
        const teclado = { width: 66, table: { widths: [54], body: (ts.length ? ts : [{}]).map((_: any, i: number) => [{ text: ts.length ? `Tecla ${i + 1}` : "—", fontSize: 6.4, color: CINZA, alignment: "center", margin: [0, 4, 0, 4], fillColor: "#fbfbfd" }]) },
          layout: { hLineWidth: () => 0.8, vLineWidth: () => 0.8, hLineColor: () => "#c7ccd6", vLineColor: () => "#c7ccd6" } };
        const texto = { width: "*", table: { widths: ["*"], body: [[{ stack: [
          { text: `${cx.nome || "Caixa"}${cx.local ? " – " + cx.local : ""}`, bold: true, fontSize: 8.6, margin: [0, 0, 0, 4] },
          ...ts.flatMap((t: any, i: number) => [
            { text: `Tecla ${i + 1} – ${t.rotulo || "-"}`, fontSize: 7.8, margin: [0, 2, 0, 1] },
            ...(t.acoes ?? []).filter((a: any) => !vazio(a.acao)).map((a: any) => ({ text: `${a.cliques || "1 click"} – ${a.acao}`, fontSize: 7.2, color: "#374151", margin: [14, 0, 0, 1] })),
          ]),
        ], margin: [4, 4, 4, 4] }]] }, layout: { hLineWidth: () => 0.8, vLineWidth: () => 0.8, hLineColor: () => "#1f2937", vLineColor: () => "#1f2937" } };
        out.push({ unbreakable: true, margin: [0, 0, 0, 12], columns: [teclado, { width: 14, text: "" }, texto] });
      }
      break;
    }
    case "galeria": case "cameras": case "fotos": {
      out.push(titulo(d.titulo));
      const its = (c.itens ?? []).filter((x: any) => x.imagem);
      const larg = (largura - 16) / 2;
      const cel = (x: any) => ({ unbreakable: true, stack: [x.legenda ? { text: x.legenda, fontSize: 8, bold: d.modelo === "cameras", decoration: d.modelo === "cameras" ? "underline" : undefined, margin: [0, 0, 0, 4] } : { text: "" }, imagemOuAviso(o, x.imagem, [larg, 170])], margin: [0, 0, 0, 14] });
      if (d.modelo === "galeria") its.forEach((x: any) => out.push({ ...cel(x), stack: [cel(x).stack[0], imagemOuAviso(o, x.imagem, [largura, 300])] }));
      else for (let i = 0; i < its.length; i += 2) out.push({ columns: [{ width: larg, ...cel(its[i]) }, { width: 16, text: "" }, its[i + 1] ? { width: larg, ...cel(its[i + 1]) } : { width: larg, text: "" }] });
      if (c.obs) out.push({ text: c.obs, fontSize: 8, color: "#374151" });
      break;
    }
    case "senhas": {
      if (!(c.contas ?? []).some((x: any) => !vazio(x.servico))) break;
      out.push(titulo("Usuários e senhas"));
      if (!o.comSenhas) out.push({ text: "Versão sem senhas: as senhas são entregues apenas na via do cliente.", fontSize: 7.6, color: CINZA, margin: [0, 0, 0, 10] });
      for (const x of c.contas ?? []) {
        if (vazio(x.servico)) continue;
        const s = o.senhas[`senha:${x.id}`] ?? "";
        out.push({ unbreakable: true, margin: [0, 0, 0, 12], stack: [
          { text: x.servico, bold: true, fontSize: 9, decoration: "underline", margin: [0, 0, 0, 3] },
          ...(x.site ? [{ text: [{ text: "Site: ", bold: true }, { text: x.site, color: "#0a6cf5" }], fontSize: 8.2 }] : []),
          ...(x.usuario ? [{ text: [{ text: "Usuário / rede: ", bold: true }, x.usuario], fontSize: 8.2 }] : []),
          ...(s ? [{ text: [{ text: "Senha: ", bold: true }, o.comSenhas ? s : mascara], fontSize: 8.2 }] : []),
        ] });
      }
      break;
    }
  }
  return out;
}

/** Caminhos de imagem usados (para baixar antes de montar o PDF). */
export function imagensDosDocs(docs: Doc[]): { arquivos: string[]; produtos: string[] } {
  const arq = new Set<string>(), prod = new Set<string>();
  for (const d of docs) {
    const c = d.conteudo ?? {};
    for (const it of c.itens ?? []) {
      if (it.imagem) arq.add(it.imagem);
      for (const p of it.paginas ?? []) arq.add(p);
      if (d.modelo === "equipamentos" && it.foto) prod.add(it.foto);
    }
  }
  return { arquivos: [...arq], produtos: [...prod] };
}

/** Monta o caderno (separado para testar sem navegador). */
export function definicaoDocumentacao(ob: Obra, docs0: Doc[], imgs: Record<string, string>, op: OpcoesDoc): any {
  // cartão nunca aberto: vale o conteúdo padrão do modelo (ex.: texto do objetivo)
  const docs = docs0.map((d) => (d.conteudo && Object.keys(d.conteudo).length ? d : { ...d, conteudo: conteudoInicial(d.modelo, d.grupo) }));
  const usados = docs.filter((d) => d.incluir && d.modelo !== "capa" && d.modelo !== "encerramento").sort((a, b) => GRUPOS.indexOf(a.grupo) - GRUPOS.indexOf(b.grupo) || a.posicao - b.posicao);
  const conteudo: any[] = [];
  const cheia = (img: string, extra: any[] = [], quebra = true) => {
    conteudo.push({ image: img, width: A4.w, height: A4.h, absolutePosition: { x: 0, y: 0 } }, ...extra);
    if (quebra) conteudo.push({ text: "", pageBreak: "after" });
  };
  const rot = (t: string, x: number, y: number, dir = false) => dir
    ? { columns: [{ text: t, alignment: "right", color: "#aeb8d0", fontSize: 7.2, characterSpacing: 1.6, width: x }], absolutePosition: { x: 0, y } }
    : { text: t, absolutePosition: { x, y }, color: "#aeb8d0", fontSize: 7.2, characterSpacing: 1.6 };
  const val = (t: string, x: number, y: number, dir = false, tam = 10, bold = true) => dir
    ? { columns: [{ text: t, alignment: "right", color: "#fff", fontSize: tam, bold, width: x }], absolutePosition: { x: 0, y } }
    : { text: t, absolutePosition: { x, y }, color: "#fff", fontSize: tam, bold };
  // capa (modelo novo), apresentação e marcas
  cheia(op.capa, [
    rot("PREPARADO PARA", 54, 652), val(ob.cliente_nome || ob.titulo, 66, 666, false, 10.5),
    rot("PROJETO", 541, 652, true), val(ob.titulo !== ob.cliente_nome ? ob.titulo : "Documentação de entrega", 541, 666, true, 9, false),
    rot("OBRA Nº", 54, 706), val(String(ob.numero).padStart(3, "0"), 54, 719, false, 11),
    rot("DATA DE EMISSÃO", 541, 706, true), val(dataBr(new Date().toISOString()), 541, 718, true, 10, false),
  ]);
  cheia(imgs.apresentacao);
  cheia(imgs.marcas);
  // sumário
  conteudo.push({ toc: { title: { text: "Sumário", bold: true, fontSize: 16, color: MARINHO, margin: [0, 0, 0, 16] }, numberStyle: { color: CINZA }, textStyle: { fontSize: 9.5 } } }, { text: "", pageBreak: "after" });

  const grupos = [...new Set(usados.map((d) => d.grupo))];
  grupos.forEach((g, gi) => {
    const ds = usados.filter((d) => d.grupo === g);
    const n = String(gi + 3).padStart(2, "0");
    const nomeCap = g === "Apresentação" ? "Objetivo do documento" : g;
    const blocos: any[] = [];
    let primeiro = true;
    for (const d of ds) {
      const largo = d.modelo === "pulsadores" || d.modelo === "relacao";
      const largura = largo ? A4.h - 80 : A4.w - 80;
      const r = renderDoc(d, op, ob, largura);
      if (d.modelo === "objetivo" ? !r.length : r.length <= 1) continue;   // só o título: cartão vazio não entra
      const abre = primeiro ? [{ text: `${n} — ${nomeCap.toUpperCase()}`, color: LARANJA, bold: true, fontSize: 7.4, characterSpacing: 2.2, tocItem: false }, { text: nomeCap, bold: true, fontSize: 18, color: MARINHO, margin: [0, 2, 0, 16], tocItem: true, tocNumberStyle: { color: CINZA } }] : [];
      blocos.push({ stack: [...abre, ...r], pageBreak: "before", pageOrientation: largo ? "landscape" : "portrait" });
      primeiro = false;
    }
    conteudo.push(...blocos);
  });
  // encerramento com QR code
  const enc = docs.find((d) => d.modelo === "encerramento" && d.incluir);
  const link = enc?.conteudo?.link || ob.link_arquivos || "";
  conteudo.push({ pageBreak: "before", pageOrientation: "portrait", stack: [
    { text: " ", margin: [0, 150, 0, 0] },
    ...String(enc?.conteudo?.texto ?? "Agradecemos a oportunidade!").split("\n").map((t: string, i: number) => ({ text: t, alignment: "center", fontSize: i ? 14 : 18, bold: !i, color: i ? "#4b5563" : MARINHO, margin: [0, 0, 0, 6] })),
    ...(link ? [{ qr: link, fit: 120, alignment: "center", foreground: MARINHO, margin: [0, 60, 0, 8] }, { text: "QR code para acesso aos arquivos", alignment: "center", fontSize: 8, color: CINZA }] : []),
  ] });
  conteudo.push({ text: "", pageBreak: "after" });
  cheia(imgs.contracapa, [], false);

  const especiais = new Set([1, 2, 3]);
  return {
    pageSize: "A4", pageMargins: [40, 96, 40, 96],
    info: { title: `Documentação técnica · ${ob.cliente_nome ?? ob.titulo}`, author: "BRA Ambientes Inteligentes", creator: "Núcleo BRA" },
    defaultStyle: { font: "Poppins", fontSize: 8, color: "#111827" },
    styles: { th: { bold: true, color: "#fff", fillColor: MARINHO, alignment: "center", fontSize: 7 }, th2: { bold: true, color: MARINHO, fillColor: "#e6e9f1", alignment: "center", fontSize: 6.4 } },
    header: (pg: number, total: number, ps: any) => {
      if (especiais.has(pg) || pg === total) return null;
      return { margin: [40, 28, 40, 0], columns: [
        { stack: [{ text: "DOCUMENTAÇÃO TÉCNICA", color: LARANJA, bold: true, fontSize: 7.2, characterSpacing: 2.2 }, { text: ob.cliente_nome ?? ob.titulo, color: MARINHO, bold: true, fontSize: 13, margin: [0, 3, 0, 0] }] },
        { image: imgs["logo-a"], width: 46, alignment: "right" },
      ], width: ps?.width };
    },
    background: (pg: number, ps: any) => {
      if (especiais.has(pg)) return null;
      const w = ps?.width ?? A4.w, h = ps?.height ?? A4.h;
      if (w > h) return { stack: [   // página deitada: rodapé discreto
        { canvas: [{ type: "line", x1: 40, y1: h - 40, x2: w - 40, y2: h - 40, lineWidth: 0.5, lineColor: LINHA }], absolutePosition: { x: 0, y: 0 } },
        { text: "BRA Ambientes Inteligentes · Documentação técnica", fontSize: 7, color: CINZA, absolutePosition: { x: 40, y: h - 32 } },
        { text: String(pg), fontSize: 7, color: CINZA, absolutePosition: { x: w - 52, y: h - 32 } },
      ] };
      return { stack: [
        { image: imgs.rodape, width: w, absolutePosition: { x: 0, y: h - (83.6 * w) / A4.w } },
        { text: String(pg), fontSize: 7, color: "#6b6b6b", absolutePosition: { x: w - 26, y: h - 21 } },
      ] };
    },
    content: conteudo,
  };
}

async function paraData(url: string, max: number): Promise<string | null> { return fotoParaPdf(url, max); }

/** Baixa as imagens, monta e gera o PDF do caderno de entrega. */
export async function gerarDocumentacao(ob: Obra, docs: Doc[], comSenhas: boolean, senhas: Record<string, string>, progresso?: (t: string) => void): Promise<Blob> {
  const { pdfMake, imgs } = await carregar();
  progresso?.("Preparando a capa…");
  const capa = await paraData("/documentacao/capa.jpg", 2400) ?? imgs.capa;
  const { arquivos, produtos } = imagensDosDocs(docs.filter((d) => d.incluir));
  const imagens: Imagens = {};
  let k = 0;
  await Promise.all(arquivos.map(async (c) => {
    try { imagens[c] = await paraData(await urlArquivo(c), 1800); } catch { imagens[c] = null; }
    progresso?.(`Carregando imagens ${++k}/${arquivos.length}…`);
  }));
  await Promise.all(produtos.map(async (p) => { const u = fotoProduto(p); imagens["p:" + p] = u ? await paraData(u, 360) : null; }));
  progresso?.("Montando o PDF…");
  const def = definicaoDocumentacao(ob, docs, imgs, { comSenhas, senhas, imagens, capa });
  return new Promise((ok) => pdfMake.createPdf(def).getBlob((b: Blob) => ok(b)));
}

// ------------------------------------------------------------------ termo de entrega
export function definicaoTermo(ob: Obra, imgs: Record<string, string>, sistemas: string[], responsavel: string): any {
  const garantia = ob.garantia_meses;
  const corpo = (t: any) => ({ text: t, fontSize: 9, lineHeight: 1.5, alignment: "justify", margin: [0, 0, 0, 10] });
  const linhaAssin = (rotulo: string, nome: string) => ({ width: "*", stack: [
    { text: rotulo, fontSize: 6.6, color: CINZA, characterSpacing: 1.2 }, { text: " ", margin: [0, 40, 0, 0] },
    { canvas: [{ type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.6, lineColor: "#9ca3af" }] },
    { text: nome, fontSize: 8.6, bold: true, color: MARINHO, margin: [0, 6, 0, 0] },
  ] });
  return {
    pageSize: "A4", pageMargins: [50, 100, 50, 100],
    info: { title: `Termo de entrega · ${ob.cliente_nome ?? ob.titulo}`, author: "BRA Ambientes Inteligentes", creator: "Núcleo BRA" },
    defaultStyle: { font: "Poppins", fontSize: 9, color: "#111827" },
    header: () => ({ margin: [50, 30, 50, 0], columns: [
      { stack: [{ text: "FORMALIZAÇÃO", color: LARANJA, bold: true, fontSize: 7.2, characterSpacing: 2.2 }, { text: "Termo de Entrega e Aceite", color: MARINHO, bold: true, fontSize: 16, margin: [0, 3, 0, 0] }] },
      { image: imgs["logo-a"], width: 50, alignment: "right" },
    ] }),
    background: () => ({ image: imgs.rodape, width: A4.w, absolutePosition: { x: 0, y: A4.h - 83.6 } }),
    content: [
      { table: { widths: [110, "*"], body: [
        ["Cliente", { text: ob.cliente_nome ?? "", bold: true }], ["Projeto", ob.titulo], ["Endereço", ob.endereco ?? "—"], ["Obra nº", String(ob.numero).padStart(3, "0")],
      ] }, layout: "lightHorizontalLines", fontSize: 8.6, margin: [0, 0, 0, 18] },
      corpo(["Pelo presente termo, o(a) cliente acima declara ter recebido da ", { text: "BRA Ambientes Inteligentes", bold: true, color: MARINHO }, " os sistemas instalados e configurados conforme o escopo contratado, em perfeito funcionamento, tendo acompanhado os testes e recebido as orientações de uso."]),
      ...(sistemas.length ? [{ text: "Sistemas entregues:", bold: true, fontSize: 9, margin: [0, 4, 0, 6] }, { ul: sistemas, fontSize: 9, margin: [0, 0, 0, 12] }] : []),
      corpo("Declara também ter recebido a documentação técnica do projeto (plantas, mapeamentos, relação de equipamentos e acessos) e o treinamento de uso dos sistemas."),
      corpo(`A garantia dos serviços de instalação e programação é de ${garantia} ${garantia === 1 ? "mês" : "meses"} a partir da data de assinatura deste termo. A garantia dos equipamentos segue as condições de cada fabricante. Não estão cobertos danos causados por mau uso, descargas elétricas, intervenções de terceiros ou alterações na infraestrutura.`),
      corpo("Ajustes de cenas, inclusões de equipamentos e mudanças de layout solicitados após a entrega serão tratados como novos atendimentos."),
      { text: "Pendências / observações:", bold: true, fontSize: 9, margin: [0, 8, 0, 6] },
      { canvas: [0, 1, 2].map((i) => ({ type: "line", x1: 0, y1: 14 + i * 18, x2: 495, y2: 14 + i * 18, lineWidth: 0.5, lineColor: "#c9ced8" })), margin: [0, 0, 0, 24] },
      { text: `Local e data: ____________________, ____/____/________`, fontSize: 9, margin: [0, 0, 0, 30] },
      { columns: [linhaAssin("CLIENTE", ob.cliente_nome ?? ""), { width: 40, text: "" }, linhaAssin("BRA AMBIENTES INTELIGENTES", responsavel)] },
    ],
  };
}
export async function gerarTermo(ob: Obra, sistemas: string[], responsavel: string): Promise<Blob> {
  const { pdfMake, imgs } = await carregar();
  const def = definicaoTermo(ob, imgs, sistemas, responsavel);
  return new Promise((ok) => pdfMake.createPdf(def).getBlob((b: Blob) => ok(b)));
}
