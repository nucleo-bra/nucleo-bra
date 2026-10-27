import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { converterDocx, definicaoPdf } from "@/lib/docx-pdf";

const require = createRequire(import.meta.url);
const PdfPrinter = require("pdfmake");
const F = (n: string) => join(process.cwd(), "public/fontes", n + ".ttf");
const fontes = {
  Carlito: { normal: F("Carlito-Regular"), bold: F("Carlito-Bold"), italics: F("Carlito-Italic"), bolditalics: F("Carlito-BoldItalic") },
  Caladea: { normal: F("Caladea-Regular"), bold: F("Caladea-Bold"), italics: F("Caladea-Italic"), bolditalics: F("Caladea-BoldItalic") },
};
function gerar(def: unknown): Promise<Buffer> {
  const doc = new PdfPrinter(fontes).createPdfKitDocument(def);
  const partes: Buffer[] = [];
  return new Promise((ok) => { doc.on("data", (d: Buffer) => partes.push(d)); doc.on("end", () => ok(Buffer.concat(partes))); doc.end(); });
}
const gifParaPng = async ({ dados }: { dados: Uint8Array }) => {
  const dir = mkdtempSync(join(tmpdir(), "img-"));
  writeFileSync(join(dir, "a.gif"), dados);
  execFileSync("python3", ["-I", "-c", "import sys;from PIL import Image;Image.open(sys.argv[1]).convert('RGBA').save(sys.argv[2])", join(dir, "a.gif"), join(dir, "a.png")]);
  return { dados: new Uint8Array(readFileSync(join(dir, "a.png"))), ext: "png" };
};

describe("Word → PDF", () => {
  it("converte o contrato preenchido em PDF com capa, cabeçalho e rodapé", async () => {
    const m = readFileSync("public/modelos/contrato-bra.docx");
    const d = new Docxtemplater(new PizZip(m), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
    d.render({ numero: "20261025", unidade: "Jangadinha Campinas", cliente_nome: "Arena Esporte x Jangadinha", cliente_documento: "49.590.944/0001-55",
      cliente_nascimento: "", cliente_endereco: "Av. José Paulino, 4193", valor_total: "R$ 48.000,00", valor_extenso: "quarenta e oito mil reais",
      condicoes: [{ condicao: "Entrada (ato)", valor: "R$ 4.000,00", vencimento: "01/11/2026" }, { condicao: "Parcelas restantes", valor: "11x de R$ 4.000,00", vencimento: "Dia 01 dos meses subsequentes" }],
      forma_recebimento: "Banco Santander – Fulano\nchave pix", garantia_meses: "12", escopo: "AUTOMAÇÃO\n• 1x Control4 Core 1\n• 5x Módulo R-12", condicoes_especificas: "Não há.",
      cidade: "Paulínia", data: "19/10/2026", rep_nome: "Fernando Bonolo Reis", rep_cpf: "000", rep_rg: "111", rep_endereco: "Rua A", bra_nome: "Matheus Esturrari", bra_cpf: "222" });
    const docx = d.getZip().generate({ type: "uint8array" });
    const conv = await converterDocx(docx, { imagem: gifParaPng });
    expect(conv.secoes.length).toBe(2);
    expect(conv.secoes[1].rodape).not.toBeNull();
    expect(Object.keys(conv.imagens).length).toBe(2);
    const inicios: Record<string, number> = {};
    await gerar(definicaoPdf(conv, undefined, (id, p) => { inicios[id] = p; }));
    const pdf = await gerar(definicaoPdf(conv, inicios));
    const saida = process.env.SAIDA_PDF ?? join(tmpdir(), "contrato-teste.pdf");
    writeFileSync(saida, pdf);
    expect(inicios).toEqual({ __secao_0: 1, __secao_1: 2 });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30000);
});
