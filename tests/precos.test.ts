import { describe, expect, it } from "vitest";
import { calcular, colunasDoCalculo, formacaoInicial } from "../src/lib/precos";

describe("formação de preço", () => {
  it("monta o custo com desconto, impostos, frete e créditos", () => {
    const c = calcular({ preco_fornecedor: 1000, desconto_pct: 10, ipi_pct: 5, st_pct: 10, frete_compra_pct: 2, frete_compra_rs: 15, credito_icms_pct: 4 });
    // base 900; impostos 135; frete 18 + 15; crédito 36
    expect(c.base).toBe(900);
    expect(c.custo).toBe(1032);
  });
  it("preço por divisor: encargos e margem são % do preço de venda", () => {
    const c = calcular({ preco_fornecedor: 1000, simples_pct: 10, comissao_vendedor_pct: 5, margem_pct: 25 });
    expect(c.preco).toBe(1666.67);            // 1000 / (1 - 0,40)
    expect(c.lucro).toBeCloseTo(416.67, 2);
    expect(c.margemPct).toBe(25);
    expect(c.partes.map((p) => p.valor)).toEqual([166.67, 83.33]);
  });
  it("usa os padrões da empresa quando o produto não define", () => {
    const c = calcular({ preco_fornecedor: 100, margem_pct: 20 }, { simples_pct: 10, margem_pct: 50 });
    expect(c.preco).toBe(142.86);            // 100 / (1 - 0,30): a margem do produto vence o padrão
  });
  it("preço manual mostra a margem que sobra", () => {
    const c = calcular({ preco_fornecedor: 100, modo: "manual", preco_manual: 200, simples_pct: 10 });
    expect(c.preco).toBe(200); expect(c.lucro).toBe(80); expect(c.margemPct).toBe(40); expect(c.markup).toBe(2);
  });
  it("avisa quando encargos + margem passam do preço", () => {
    expect(calcular({ preco_fornecedor: 100, simples_pct: 60, margem_pct: 45 }).erro).toBeTruthy();
  });
  it("produto do Zenith mantém o preço atual na primeira abertura", () => {
    const f = formacaoInicial({ valor_compra: 100, impostos_pct: 14, preco_venda: 228 });
    const c = calcular(f);
    expect(c.custo).toBe(114); expect(c.preco).toBe(228);
    const col = colunasDoCalculo(f, c);
    expect(col).toMatchObject({ valor_compra: 100, custo: 114, preco_venda: 228, impostos_pct: 14, fator_venda: 2 });
  });
});
