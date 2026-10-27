import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import PizZip from "pizzip";
import { camposDoModelo, condicoesPagamento, Contrato, CONFIG_VAZIA, cronograma, dadosDoModelo, formatarDocumento, parcelasFinanceiro, preencherDocx } from "@/lib/contratos";

const base = { valor: 48000, entrada: 4000, entrada_vencimento: "2026-11-01", parcelas: 11, primeiro_vencimento: "2026-12-01", data_contrato: "2026-10-19" };
const contrato = {
  ...base, id: "c1", numero: "20261025", titulo: "", unidade: "Jangadinha Campinas", status: "rascunho",
  cliente_nome: "Arena Esporte x Jangadinha", cliente_documento: "49590944000155", cliente_email: "a@b.com", cliente_telefone: "",
  cliente_endereco: "Avenida José Paulino, 4193", forma_pagamento: "Banco Santander – Fulano", observacoes: "", dados: {},
} as unknown as Contrato;

describe("Contratos", () => {
  it("monta o cronograma igual ao contrato Jangadinha", () => {
    const cr = cronograma(base);
    expect(cr).toHaveLength(12);
    expect(cr[0]).toEqual({ rotulo: "Entrada", valor: 4000, venc: "2026-11-01" });
    expect(cr[11]).toEqual({ rotulo: "11/11", valor: 4000, venc: "2027-10-01" });
    expect(condicoesPagamento(base)).toEqual([
      { condicao: "Entrada (ato)", valor: "R$ 4.000,00", vencimento: "01/11/2026" },
      { condicao: "Parcelas restantes", valor: "11x R$ 4.000,00", vencimento: "Dia 01 dos meses subsequentes (1ª em 01/12/2026)" },
    ]);
  });

  it("ajusta centavos na última parcela e trata à vista", () => {
    const cr = cronograma({ ...base, valor: 1000, entrada: 0, parcelas: 3 });
    expect(cr.map((x) => x.valor)).toEqual([333.33, 333.33, 333.34]);
    expect(cr.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(1000, 2);
    expect(condicoesPagamento({ ...base, entrada: 0, parcelas: 0 })).toEqual([{ condicao: "À vista", valor: "R$ 48.000,00", vencimento: "01/11/2026" }]);
  });

  it("formata CPF/CNPJ", () => {
    expect(formatarDocumento("49590944000155")).toBe("49.590.944/0001-55");
    expect(formatarDocumento("12345678909")).toBe("123.456.789-09");
  });

  it("preenche o modelo Word padrão sem deixar campos vazios", () => {
    const modelo = readFileSync("public/modelos/contrato-bra.docx");
    const ab = modelo.buffer.slice(modelo.byteOffset, modelo.byteOffset + modelo.byteLength);
    const campos = camposDoModelo(ab);
    expect(campos).toEqual(expect.arrayContaining(["numero", "cliente_nome", "valor_total", "condicoes", "rep_cpf", "bra_nome"]));
    const cfg = { ...CONFIG_VAZIA, representante: { nome: "Rep Legal", cpf: "000", rg: "111", endereco: "Rua A" }, assinante_bra: { nome: "Matheus Esturrari", email: "m@x.com", cpf: "222" } };
    const dados = dadosDoModelo(contrato, cfg);
    for (const k of campos) expect(dados).toHaveProperty(k);
    return preencherDocx(ab, dados).arrayBuffer().then((buf) => {
      const xml = new PizZip(buf).file("word/document.xml")!.asText().replace(/<[^>]+>/g, "");
      expect(xml).toContain("Arena Esporte x Jangadinha");
      expect(xml).toContain("49.590.944/0001-55");
      expect(xml).toContain("11x R$ 4.000,00");
      expect(xml).toContain("/ass_cliente/");
      expect(xml).not.toMatch(/\{[a-z_#/]+\}/);
    });
  });

  it("gera parcelas no formato do Financeiro v38", () => {
    const it_ = parcelasFinanceiro(contrato, { forma: "Pix", conta: "", comissoes: [{ n: "Matheus", r: "Vendedor", p: 5 }, { n: "", r: "Parceiro", p: 0 }] });
    expect(it_).toHaveLength(12);
    expect(it_[0]).toMatchObject({ t: "r", who: "Arena Esporte x Jangadinha", valor: 4000, venc: "2026-11-01", par: "Entrada", pago: null });
    expect(it_[1].par).toBe("1/11");
    expect(it_[0].coms).toEqual([{ n: "Matheus", r: "Vendedor", p: 5 }]);
  });
});
