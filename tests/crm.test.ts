import { describe, expect, it } from "vitest";
import { montarParcelas } from "@/lib/crm";

describe("CRM → Financeiro", () => {
  it("parcelas somam o total exato, diferença de centavos na última, formato do v38", () => {
    const P = montarParcelas({ descricao: "Cliente - Projeto", cliente: " Cliente  X ", forma: "Boleto", total: 1000, parcelas: 3, primeiro: "2026-01-31",
      comissoes: [{ n: "Matheus Esturrari", r: "Vendedor", p: 2.28 }, { n: "", r: "Arquiteto", p: 10 }] });
    expect(P.map((p) => p.valor)).toEqual([333.33, 333.33, 333.34]);
    expect(P.map((p) => p.venc)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(P.map((p) => p.par)).toEqual(["1/3", "2/3", "3/3"]);
    expect(P[0]).toMatchObject({ t: "r", who: "Cliente X", forma: "Boleto", pago: null, com: "", pct: 0, nfr: "" });
    expect(P[0].coms).toEqual([{ n: "Matheus Esturrari", r: "Vendedor", p: 2.28 }]);
    expect(new Set(P.map((p) => p.id)).size).toBe(3);
  });
  it("parcela única fica sem número", () => {
    expect(montarParcelas({ descricao: "x", cliente: "y", forma: "Pix", total: 84000, parcelas: 1, primeiro: "2026-10-27", comissoes: [] })[0]).toMatchObject({ par: "", valor: 84000 });
  });
});
