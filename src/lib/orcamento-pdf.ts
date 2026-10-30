"use client";
// PDF do orçamento no mesmo modelo do Zenith (capa, apresentação, marcas,
// investimento por ambiente, resumo, aceite e contracapa), gerado no navegador.
import { calcularTotais, condicoes, fotoProduto, Orcamento, plUnidade, totaisPorAmbiente } from "./orcamentos";

/* eslint-disable @typescript-eslint/no-explicit-any -- definição livre do pdfmake */
const A4 = { w: 595.28, h: 841.89 };
const MARINHO = "#1e2b4d", LARANJA = "#e35d25", CINZA = "#6b7280";
const FONTES = ["Poppins-Regular", "Poppins-Bold", "Poppins-Medium", "Poppins-Light"];
const IMAGENS = ["capa", "apresentacao", "marcas", "contracapa", "rodape", "logo-a"];

let motor: Promise<{ pdfMake: any; imgs: Record<string, string> }> | null = null;
const paraDataUrl = (b: Blob) => new Promise<string>((ok, erro) => { const fr = new FileReader(); fr.onload = () => ok(fr.result as string); fr.onerror = erro; fr.readAsDataURL(b); });

async function carregar() {
  motor ??= (async () => {
    const mod: any = await import("pdfmake/build/pdfmake");
    const pdfMake = mod.default ?? mod;
    const vfs: Record<string, string> = {};
    await Promise.all(FONTES.map(async (f) => {
      const b = new Uint8Array(await (await fetch(`/fontes/${f}.ttf`)).arrayBuffer());
      let s = "";
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      vfs[`${f}.ttf`] = btoa(s);
    }));
    pdfMake.vfs = vfs;
    pdfMake.fonts = { Poppins: { normal: "Poppins-Regular.ttf", bold: "Poppins-Bold.ttf", italics: "Poppins-Light.ttf", bolditalics: "Poppins-Medium.ttf" } };
    const imgs: Record<string, string> = {};
    await Promise.all(IMAGENS.map(async (n) => { imgs[n] = await paraDataUrl(await (await fetch(`/orcamento/${n}.${n === "logo-a" ? "png" : "jpg"}`)).blob()); }));
    return { pdfMake, imgs };
  })();
  motor.catch(() => { motor = null; });
  return motor;
}

/** Foto do produto já reduzida (o PDF fica leve) — JPG com fundo branco. */
async function fotoParaPdf(url: string): Promise<string | null> {
  try {
    const b = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(b);
    const s = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(bmp.width * s)); cv.height = Math.max(1, Math.round(bmp.height * s));
    const x = cv.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", 0.85);
  } catch { return null; }
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
const dataBr = (s: string) => s.slice(0, 10).split("-").reverse().join("/");

export type OpcoesPdf = { fotos: Record<string, string | null>; responsavel?: { nome: string; cargo: string } };

/** Monta a definição do pdfmake (separada para poder testar sem navegador). */
export function definicaoOrcamento(o: Orcamento, imgs: Record<string, string>, op: OpcoesPdf): any {
  const t = calcularTotais(o);
  const ambientes = totaisPorAmbiente(o);
  const conteudo: any[] = [];
  const pagina = (img: string, extra: any[] = [], quebra = true) => {
    conteudo.push({ image: imgs[img], width: A4.w, height: A4.h, absolutePosition: { x: 0, y: 0 } }, ...extra);
    if (quebra) conteudo.push({ text: "", pageBreak: "after" });
  };
  const rot = (texto: string, x: number, y: number, alinhar: "left" | "right" = "left") =>
    ({ text: texto, absolutePosition: { x: alinhar === "left" ? x : 0, y }, width: alinhar === "left" ? undefined : x, alignment: alinhar, color: "#aeb8d0", fontSize: 7.2, characterSpacing: 1.6 });
  const valor = (texto: string, x: number, y: number, alinhar: "left" | "right" = "left", tam = 9.5, bold = true) =>
    alinhar === "left" ? { text: texto, absolutePosition: { x, y }, color: "#fff", fontSize: tam, bold }
      : { columns: [{ text: texto, alignment: "right", color: "#fff", fontSize: tam, bold, width: x }], absolutePosition: { x: 0, y } };

  // 1 · capa
  pagina("capa", [
    rot("PREPARADO PARA", 54, 652), valor(o.titulo || o.cliente_nome, 66, 666, "left", 10.5),
    { columns: [{ text: "PROJETO", alignment: "right", color: "#aeb8d0", fontSize: 7.2, characterSpacing: 1.6, width: 541 }], absolutePosition: { x: 0, y: 652 } },
    o.negocio_titulo ? valor(o.negocio_titulo.split(" | ").slice(-1)[0], 541, 666, "right", 9, false) : { text: "" },
    rot("PROPOSTA Nº", 54, 706), valor(o.numero || "—", 54, 719, "left", 11),
    { columns: [{ text: "DATA DE EMISSÃO", alignment: "right", color: "#aeb8d0", fontSize: 7.2, characterSpacing: 1.6, width: 541 }], absolutePosition: { x: 0, y: 706 } },
    valor(dataBr(o.data_emissao), 541, 718, "right", 10, false),
  ]);
  // 2 e 3 · apresentação e marcas (fixas)
  pagina("apresentacao");
  pagina("marcas");

  // 4 · investimento por ambiente
  const item = (i: Orcamento["itens"][number]) => {
    const foto = i.produto_id ? op.fotos[i.produto_id] : null;
    const texto = [
      { text: i.descricao, bold: true, fontSize: 9.6, margin: [0, 0, 0, 6] },
      { text: i.detalhe?.replace(/\s*\n+\s*/g, " ").trim() || "Sem descrição", fontSize: 7.6, alignment: "justify", lineHeight: 1.3, margin: [0, 0, 0, 6] },
      i.tipo === "cliente"
        ? { text: [{ text: plUnidade(i.unidade, i.quantidade), bold: true }, { text: "  Fornecido pelo cliente", color: CINZA }], fontSize: 9.2 }
        : { text: [{ text: plUnidade(i.unidade, i.quantidade) + " ", bold: true }, "Unit. " + reais(i.valor_unitario) + " ", { text: "Total " + reais(i.quantidade * i.valor_unitario), bold: true }], fontSize: 9.2 },
    ];
    return { unbreakable: true, margin: [0, 0, 0, 22], columns: [{ width: "*", stack: texto }, { width: 30, text: "" }, foto ? { width: 82, image: foto, fit: [82, 82] } : { width: 82, text: "" }] };
  };
  const totalBloco = (titulo: string, linhas: [string, number][]) => ({
    unbreakable: true, margin: [0, 6, 0, 20], stack: [
      { text: titulo, bold: true, fontSize: 8.6, margin: [0, 0, 0, 8] },
      ...linhas.map(([r, v]) => ({ margin: [0, 0, 0, 7], stack: [
        { columns: [{ text: r, bold: true, fontSize: 8.4 }, { text: reais(v), bold: true, fontSize: 8.4, alignment: "right" }] },
        { canvas: [{ type: "line", x1: 0, y1: 3, x2: 515, y2: 3, lineWidth: 0.5, lineColor: "#c9ced8" }] },
      ] })),
    ],
  });
  ambientes.forEach((a, k) => {
    const prods = a.itens.filter((i) => i.tipo !== "servico"), servs = a.itens.filter((i) => i.tipo === "servico");
    conteudo.push({ text: a.ambiente.toUpperCase(), bold: true, fontSize: 13, margin: [0, 0, 0, 22], ...(k ? { pageBreak: "before" } : {}) });
    if (prods.length) conteudo.push({ text: "Produtos:", bold: true, fontSize: 9.6, margin: [0, 0, 0, 18] }, ...prods.map(item));
    if (servs.length) conteudo.push({ text: "Serviços:", bold: true, fontSize: 9.6, margin: [0, 0, 0, 18] }, ...servs.map(item));
    conteudo.push(totalBloco(`Total ${a.ambiente}:`, [["Produtos:", a.produtos], ["Serviços:", a.servicos], ["Total:", a.total]]));
  });
  if (!ambientes.length) conteudo.push({ text: "Sem itens.", color: CINZA });

  // resumo
  const conds = condicoes(o.formas_pagamento.length ? o.formas_pagamento : ["A combinar"], t.final);
  conteudo.push({ pageBreak: "before", ...totalBloco("Total por ambiente/sistema:", ambientes.map((a) => [a.ambiente, a.total])) });
  const venda: [string, number][] = [];
  if (t.markupProduto || t.markupServico) venda.push(["Subtotal:", t.semMarkup], ["Acréscimos:", t.markupProduto + t.markupServico]);
  if (t.desconto > 0) venda.push(["Total sem desconto:", t.semDesconto], [`Desconto (${t.descontoPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%):`, -t.desconto]);
  venda.push(["Total final:", t.final]);
  conteudo.push(totalBloco("Total venda:", venda));
  conteudo.push({ unbreakable: true, stack: [
    { text: "Condições de pagamento:", bold: true, fontSize: 8.6, margin: [0, 0, 0, 8] },
    ...conds.map((c) => ({ margin: [0, 0, 0, 7], stack: [
      { columns: [{ text: c.forma, bold: true, fontSize: 8.4 }, { text: c.texto === c.forma ? reais(c.valor) : c.texto, bold: true, fontSize: 8.4, alignment: "right" }] },
      { canvas: [{ type: "line", x1: 0, y1: 3, x2: 515, y2: 3, lineWidth: 0.5, lineColor: "#c9ced8" }] },
    ] })),
  ] });
  if (o.validade_dias) conteudo.push({ text: `Proposta válida por ${o.validade_dias} dias a partir de ${dataBr(o.data_emissao)}.`, fontSize: 7.6, color: CINZA, margin: [0, 14, 0, 0] });
  if (o.resumo_entrega?.trim()) conteudo.push({ text: [{ text: "Prazo de entrega: ", bold: true }, o.resumo_entrega], fontSize: 8, margin: [0, 8, 0, 0] });
  if (o.observacoes?.trim()) conteudo.push({ text: o.observacoes, fontSize: 7.8, color: "#374151", lineHeight: 1.3, margin: [0, 8, 0, 0] });

  // aceite
  const resp = op.responsavel ?? { nome: "Matheus Esturrari", cargo: "Diretor" };
  conteudo.push({ pageBreak: "before", text: "Ao assinar este documento, o(a) cliente declara ter lido e concordado com o escopo do projeto, valores de investimento e condições comerciais descritas nesta proposta, autorizando a ", fontSize: 8.2, color: "#374151", lineHeight: 1.45 });
  conteudo[conteudo.length - 1].text = [conteudo[conteudo.length - 1].text, { text: "BR Ambientes Inteligentes", bold: true, color: MARINHO }, " a dar início ao planejamento e execução dos serviços conforme cronograma acordado entre as partes."];
  conteudo.push({ margin: [0, 34, 0, 0], columns: [
    { width: 160, stack: [{ text: "CONTRATANTE", fontSize: 6.6, color: CINZA, characterSpacing: 1.2 }, { text: " ", margin: [0, 44, 0, 0] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.6, lineColor: "#9ca3af" }] }, { text: o.cliente_nome || "", fontSize: 8.4, bold: true, color: MARINHO, margin: [0, 6, 0, 0] }] },
    { width: 20, text: "" },
    { width: 160, stack: [{ text: "BR AMBIENTES INTELIGENTES", fontSize: 6.6, color: CINZA, characterSpacing: 1.2 }, { text: " ", margin: [0, 44, 0, 0] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 150, y2: 0, lineWidth: 0.6, lineColor: "#9ca3af" }] }, { text: resp.nome, fontSize: 8.4, bold: true, color: MARINHO, margin: [0, 6, 0, 0] },
      { text: `Cargo: ${resp.cargo}`, fontSize: 6.8, color: CINZA }, { text: `Data: ${dataBr(new Date().toISOString())}`, fontSize: 6.8, color: CINZA }] },
  ] });
  conteudo.push({ text: "", pageBreak: "after" });
  // contracapa
  pagina("contracapa", [], false);

  return {
    pageSize: "A4", pageMargins: [40, 100, 40, 100],
    info: { title: `Orçamento ${o.numero} | ${o.titulo}`, author: "BRA Ambientes Inteligentes", creator: "Núcleo BRA" },
    defaultStyle: { font: "Poppins", fontSize: 8, color: "#111827" },
    header: (pg: number, total: number) => {
      if (pg <= 3 || pg === total) return null;
      const formal = pg === total - 1;
      return { margin: [40, 28, 40, 0], columns: [
        { stack: [{ text: formal ? "04 — FORMALIZAÇÃO" : "03 — ORÇAMENTO", color: LARANJA, bold: true, fontSize: 7.2, characterSpacing: 2.2 }, { text: formal ? "Aceite da Proposta" : "Investimento", color: MARINHO, bold: true, fontSize: 16, margin: [0, 3, 0, 0] }] },
        { image: imgs["logo-a"], width: 50, alignment: "right" },
      ] };
    },
    // rodapé com as marcas parceiras (a contracapa cobre a última página por inteiro)
    background: (pg: number) => (pg <= 3 ? null : { stack: [
      { image: imgs.rodape, width: A4.w, absolutePosition: { x: 0, y: A4.h - 83.6 } },
      { text: String(pg), fontSize: 7, color: "#6b6b6b", absolutePosition: { x: A4.w - 26, y: A4.h - 21 } },
    ] }),
    content: conteudo,
  };
}

export async function gerarPdfOrcamento(o: Orcamento, fotos: Record<string, string | null | undefined>, responsavel?: { nome: string; cargo: string }): Promise<Blob> {
  const { pdfMake, imgs } = await carregar();
  const ids = [...new Set(o.itens.map((i) => i.produto_id).filter(Boolean))] as string[];
  const prontas: Record<string, string | null> = {};
  await Promise.all(ids.map(async (id) => { const u = fotos[id] ? fotoProduto(fotos[id]) : null; prontas[id] = u ? await fotoParaPdf(u) : null; }));
  const def = definicaoOrcamento(o, imgs, { fotos: prontas, responsavel });
  return new Promise((ok) => pdfMake.createPdf(def).getBlob((b: Blob) => ok(b)));
}
