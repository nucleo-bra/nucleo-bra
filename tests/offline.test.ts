import { describe, expect, it } from "vitest";
import { aplicarFila, ehErroDeRede, type Op } from "@/lib/offline";

describe("uso sem internet", () => {
  it("reconhece falta de conexão e não confunde com erro do banco", () => {
    expect(ehErroDeRede(new TypeError("Failed to fetch"))).toBe(true);
    expect(ehErroDeRede({ message: "TypeError: Load failed" })).toBe(true);
    expect(ehErroDeRede({ message: "AbortError: Sem internet (Failed to fetch)" })).toBe(true);
    expect(ehErroDeRede({ message: "new row violates row-level security policy" })).toBe(false);
    expect(ehErroDeRede({ message: "duplicate key value violates unique constraint" })).toBe(false);
  });
  it("a tela offline mostra o que está na fila por cima da cópia guardada", () => {
    const linhas = [{ id: "a", titulo: "A", etapa: "lead" }, { id: "b", titulo: "B", etapa: "lead" }];
    const q = (o: Partial<Op>) => ({ quando: "2026-11-11T10:00:00Z", rotulo: "", ...o }) as Op;
    const fila: Op[] = [
      q({ tipo: "tabela", acao: "update", tabela: "oportunidades", id: "a", dados: { etapa: "proposta" } }),
      q({ tipo: "tabela", acao: "delete", tabela: "oportunidades", id: "b" }),
      q({ tipo: "tabela", acao: "insert", tabela: "oportunidades", id: "c", dados: { titulo: "Novo offline", etapa: "lead" } }),
      q({ tipo: "tabela", acao: "update", tabela: "atividades", id: "a", dados: { etapa: "x" } }),
    ];
    const r = aplicarFila(linhas, fila, "oportunidades");
    expect(r.map((x) => x.id).sort()).toEqual(["a", "c"]);
    expect(r.find((x) => x.id === "a")!.etapa).toBe("proposta");
    expect(r.find((x) => x.id === "a")!.titulo).toBe("A");
    expect(r.find((x) => x.id === "c")!.titulo).toBe("Novo offline");
  });
});
