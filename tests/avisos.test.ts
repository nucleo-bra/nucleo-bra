import { describe, expect, it } from "vitest";
import { montarAlertas, tempoAtras } from "../src/lib/avisos";

const agora = new Date("2026-10-28T10:00:00");
describe("alertas", () => {
  it("parcelas: atraso agrupado, hoje, amanhã e até 3 dias; nada além disso", () => {
    const A = montarAlertas({
      parcelas: [
        { id: "a", tipo: "r", descricao: "x", cliente: "Antonio", valor: 100, vencimento: "2026-10-20", parcela: "6/6" },
        { id: "b", tipo: "r", descricao: "x", cliente: "Bia", valor: 50, vencimento: "2026-10-27", parcela: null },
        { id: "c", tipo: "r", descricao: "x", cliente: "Caio", valor: 10, vencimento: "2026-10-28", parcela: "1/2" },
        { id: "d", tipo: "r", descricao: "x", cliente: "Dani", valor: 10, vencimento: "2026-10-29", parcela: null },
        { id: "e", tipo: "r", descricao: "x", cliente: "Edu", valor: 10, vencimento: "2026-10-31", parcela: null },
        { id: "f", tipo: "r", descricao: "x", cliente: "Fê", valor: 10, vencimento: "2026-11-01", parcela: null },
        { id: "g", tipo: "p", descricao: "Aluguel", cliente: "", valor: 900, vencimento: "2026-10-28", parcela: null },
      ], cartoes: [], atividades: [],
    }, agora);
    expect(A.map((a) => a.titulo)).toEqual([
      "2 parcelas em atraso", "Parcela vence hoje", "Conta a pagar vence hoje", "Parcela vence amanhã", "Parcela vence 31/10",
    ]);
    expect(A[0].corpo).toContain("mais antiga 20/10");
    expect(A[0].nivel).toBe("erro");
  });
  it("cartões: visita hoje, prazo vencido e link do módulo", () => {
    const A = montarAlertas({
      parcelas: [], atividades: [],
      cartoes: [
        { id: "v", titulo: "Instalação", numero: 3, cliente_nome: "Rafael", prazo: null, agenda_inicio: "2026-10-28T14:30:00", modulo: "agendamentos", quadro_id: "q" },
        { id: "p", titulo: "Rack", numero: 1, cliente_nome: null, prazo: "2026-10-26T18:00:00", agenda_inicio: null, modulo: "projetos", quadro_id: "q1" },
      ],
    }, agora);
    expect(A[0]).toMatchObject({ titulo: "Prazo vencido em 26/10", corpo: "Rack", link: "/tecnico/projetos/?q=q1&c=p" });
    expect(A[1]).toMatchObject({ titulo: "Visita hoje às 14:30", corpo: "#3 Instalação · Rafael", link: "/tecnico/agendamentos/?c=v" });
  });
  it("tempo relativo", () => {
    const t = agora.getTime();
    expect(tempoAtras(new Date(t - 5 * 60000).toISOString(), t)).toBe("há 5 min");
    expect(tempoAtras(new Date(t - 26 * 3600000).toISOString(), t)).toBe("ontem");
  });
});
