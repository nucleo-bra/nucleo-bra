import { describe, expect, it } from "vitest";
import type { Negocio } from "../src/lib/crm";
import { acumuladoAno, indiceDe, limites, previsao, resumir, rotuloPeriodo, serie } from "../src/lib/vendas";

const n = (etapa: string, valor: number, data: string, fechada?: string, x: Partial<Negocio> = {}) =>
  ({ id: Math.random().toString(36), titulo: "", cliente_nome: "", cliente_id: null, parceiro_id: null, etapa, valor_estimado: valor, data_ref: data, pct_parceiro: 0, pct_vendedor: 0,
    comissao_parceiro_paga: false, observacoes: "", proxima_acao: "", motivo_perda: "", financeiro_lancado_em: null, numero: null, pagamento: {}, tags: [], created_at: data, fechada_em: fechada ?? null, ...x }) as Negocio;

describe("vendas por período", () => {
  const L = [n("ganho", 100, "2026-10-30", "2026-10-06"), n("ganho", 50, "2026-10-01"), n("ganho", 30, "2025-10-10"), n("perdido", 20, "2026-10-15"), n("ganho", 10, "2026-07-02"), n("proposta", 999, "2026-12-01")];
  it("rótulos e limites", () => {
    expect(rotuloPeriodo(indiceDe("2026-11-05", "t"), "t")).toBe("4º tri 2026");
    expect(limites(indiceDe("2026-02-10", "m"), "m")).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
    expect(limites(indiceDe("2026-08-10", "s"), "s")).toEqual({ de: "2026-07-01", ate: "2026-12-31" });
  });
  it("resumo do mês com comparativos", () => {
    const r = resumir(L, "m", indiceDe("2026-10-01", "m"));
    expect(r.vendido).toBe(150); expect(r.qtd).toBe(2); expect(r.ticket).toBe(75);
    expect(r.anoAnterior).toBe(30); expect(r.varAno).toBe(400); expect(r.conversao).toBeCloseTo(66.67, 1);
  });
  it("série trimestral e acumulado", () => {
    const s = serie(L, "t", indiceDe("2026-10-01", "t"), 2);
    expect(s.map((p) => p.valor)).toEqual([10, 150]); expect(s[1].anoAnterior).toBe(30);
    expect(acumuladoAno(L, 2026)[9].atual).toBe(160);
  });
  it("previsão junta o que está atrasado no primeiro período", () => {
    const p = previsao([n("lead", 5, "2026-01-01"), n("proposta", 7, "2026-12-01")], "m", indiceDe("2026-11-05", "m"), 2);
    expect(p[0].lead).toBe(5); expect(p[1].proposta).toBe(7);
  });
});
