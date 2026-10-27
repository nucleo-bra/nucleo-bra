"use client";
// Gera o PDF do contrato no navegador, a partir do Word (.docx) do contrato.
import { converterDocx, definicaoPdf, Imagem } from "./docx-pdf";

const FONTES = ["Carlito-Regular", "Carlito-Bold", "Carlito-Italic", "Carlito-BoldItalic", "Caladea-Regular", "Caladea-Bold", "Caladea-Italic", "Caladea-BoldItalic"];
/* eslint-disable @typescript-eslint/no-explicit-any -- API do pdfmake no navegador */
let motor: Promise<any> | null = null;

async function carregarMotor() {
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
    pdfMake.fonts = {
      Carlito: { normal: "Carlito-Regular.ttf", bold: "Carlito-Bold.ttf", italics: "Carlito-Italic.ttf", bolditalics: "Carlito-BoldItalic.ttf" },
      Caladea: { normal: "Caladea-Regular.ttf", bold: "Caladea-Bold.ttf", italics: "Caladea-Italic.ttf", bolditalics: "Caladea-BoldItalic.ttf" },
    };
    return pdfMake;
  })();
  return motor;
}

/** GIF/BMP/etc. → PNG pelo canvas do navegador (o PDF só aceita PNG e JPG). */
async function paraPng(img: Imagem): Promise<Imagem | null> {
  try {
    const bmp = await createImageBitmap(new Blob([img.dados as BlobPart]));
    const cv = document.createElement("canvas");
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext("2d")!.drawImage(bmp, 0, 0);
    const b = await new Promise<Blob | null>((ok) => cv.toBlob(ok, "image/png"));
    return b ? { dados: new Uint8Array(await b.arrayBuffer()), ext: "png" } : null;
  } catch { return null; }
}

export async function docxParaPdf(docx: ArrayBuffer | Blob): Promise<Blob> {
  const dados = docx instanceof Blob ? await docx.arrayBuffer() : docx;
  const [pdfMake, conv] = await Promise.all([carregarMotor(), converterDocx(dados, { imagem: paraPng })]);
  // 1ª passada: descobre em que página começa cada seção (cabeçalho/rodapé próprios)
  const inicios: Record<string, number> = {};
  await new Promise<void>((ok) => pdfMake.createPdf(definicaoPdf(conv, undefined, (id, p) => { inicios[id] = p; })).getBuffer(() => ok()));
  return new Promise<Blob>((ok) => pdfMake.createPdf(definicaoPdf(conv, inicios)).getBlob((b: Blob) => ok(b)));
}
