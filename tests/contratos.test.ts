import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import PizZip from "pizzip";
import { valorExtenso, camposDoModelo, condicoesPagamento, Contrato, CONFIG_VAZIA, cronograma, dadosDoModelo, formatarDocumento, parcelasFinanceiro, preencherDocx } from "@/lib/contratos";

const base = { valor: 48000, entrada: 4000, entrada_vencimento: "2026-11-01", parcelas: 11, primeiro_vencimento: "2026-12-01", data_contrato: "2026-10-19" };
const contrato = {
  ...base, id: "c1", numero: "20261025", titulo: "", unidade: "Jangadinha Campinas", status: "rascunho",
  cliente_nome: "Arena Esporte x Jangadinha", cliente_documento: "49590944000155", cliente_email: "a@b.com", cliente_telefone: "",
  cliente_endereco: "Avenida José Paulino, 4193", forma_pagamento: "Banco Santander – Fulano", observacoes: "", dados: { cliente_nascimento: "1990-03-05", escopo: "Automação de 12 circuitos" },
} as unknown as Contrato;

describe("Contratos", () => {
  it("monta o cronograma igual ao contrato Jangadinha", () => {
    const cr = cronograma(base);
    expect(cr).toHaveLength(12);
    expect(cr[0]).toEqual({ rotulo: "Entrada", valor: 4000, venc: "2026-11-01" });
    expect(cr[11]).toEqual({ rotulo: "11/11", valor: 4000, venc: "2027-10-01" });
    expect(condicoesPagamento(base)).toEqual([
      { condicao: "Entrada (ato)", valor: "R$ 4.000,00", vencimento: "01/11/2026" },
      { condicao: "Parcelas restantes", valor: "11x de R$ 4.000,00", vencimento: "Dia 01 dos meses subsequentes" },
    ]);
  });

  it("ajusta centavos na última parcela e trata à vista", () => {
    const cr = cronograma({ ...base, valor: 1000, entrada: 0, parcelas: 3 });
    expect(cr.map((x) => x.valor)).toEqual([333.33, 333.33, 333.34]);
    expect(cr.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(1000, 2);
    expect(condicoesPagamento({ ...base, entrada: 0, parcelas: 0 })).toEqual([{ condicao: "À vista", valor: "R$ 48.000,00", vencimento: "01/11/2026" }]);
  });

  it("escreve valores por extenso", () => {
    expect(valorExtenso(48000)).toBe("quarenta e oito mil reais");
    expect(valorExtenso(1234.56)).toBe("mil duzentos e trinta e quatro reais e cinquenta e seis centavos");
    expect(valorExtenso(1_500_000)).toBe("um milhão e quinhentos mil reais");
    expect(valorExtenso(2_000_000)).toBe("dois milhões de reais");
    expect(valorExtenso(1)).toBe("um real");
  });

  it("formata CPF/CNPJ", () => {
    expect(formatarDocumento("49590944000155")).toBe("49.590.944/0001-55");
    expect(formatarDocumento("12345678909")).toBe("123.456.789-09");
  });

  it("preenche o modelo Word padrão sem deixar campos vazios", async () => {
    const modelo = readFileSync("public/modelos/contrato-bra.docx");
    const ab = modelo.buffer.slice(modelo.byteOffset, modelo.byteOffset + modelo.byteLength);
    const campos = await camposDoModelo(ab);
    expect(campos).toEqual(expect.arrayContaining(["numero", "cliente_nome", "valor_total", "valor_extenso", "condicoes", "rep_cpf", "bra_nome", "cliente_nascimento", "escopo", "garantia_meses"]));
    const cfg = { ...CONFIG_VAZIA, representante: { nome: "Rep Legal", cpf: "000", rg: "111", endereco: "Rua A" }, assinante_bra: { nome: "Matheus Esturrari", email: "m@x.com", cpf: "222" } };
    const dados = dadosDoModelo(contrato, cfg);
    for (const k of campos) expect(dados).toHaveProperty(k);
    return (await preencherDocx(ab, dados)).arrayBuffer().then((buf) => {
      const xml = new PizZip(buf).file("word/document.xml")!.asText().replace(/<[^>]+>/g, "");
      expect(xml).toContain("Arena Esporte x Jangadinha");
      expect(xml).toContain("49.590.944/0001-55");
      expect(xml).toContain("11x de R$ 4.000,00");
      expect(xml).toContain("R$ 48.000,00 (quarenta e oito mil reais)");
      expect(xml).toContain("Contrato referente a unidade Jangadinha Campinas");
      expect(xml).toContain("Data de nascimento: 05/03/1990");
      expect(xml).not.toMatch(/\[[A-ZÀ-Ú0-9º\/ ]+\]/);
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
