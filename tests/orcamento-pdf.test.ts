import { describe, expect, it } from "vitest";
import { definicaoOrcamento } from "../src/lib/orcamento-pdf";
import { orcamentoVazio, Item } from "../src/lib/orcamentos";

const it2 = (tipo: Item["tipo"], q: number, v: number, detalhe = ""): Item => ({ chave: String(Math.random()), tipo, produto_id: null, servico_id: null, descricao: "Item " + v, detalhe, sku: "", marca: "", unidade: "Un", quantidade: q, valor_unitario: v, valor_tabela: v, ambiente: "Automação" });

describe("PDF do orçamento", () => {
  it("embute o markup no preço do item, usa o nome do cliente e não escreve 'Sem descrição'", () => {
    const o = { ...orcamentoVazio({ id: "n", titulo: "Casa | Automação", cliente_id: null, cliente_nome: "Eduardo Attie", numero: 1 }), numero: "40", ambientes: ["Automação"],
      itens: [it2("produto", 2, 100), it2("servico", 1, 50, "Programação")], markup_produto_pct: 10, editado_em: "2026-11-06T12:00:00Z" };
    const d = definicaoOrcamento(o, {}, { fotos: {} });
    const txt = JSON.stringify(d.content);
    expect(txt).toContain("Eduardo Attie");
    expect(txt).toContain("Unit. R$ 110,00");
    expect(txt).toContain("Total R$ 220,00");
    expect(txt).not.toContain("Sem descrição");
    expect(txt).not.toContain("Acréscimos");
    expect(txt).toContain("06/11/2026");
    expect(txt).toContain("BRA Ambientes Inteligentes");
  });
});

describe("aceite da proposta", () => {
  it("mostra o nome do cliente mesmo sem cadastro vinculado (usa o título)", () => {
    const o = { ...orcamentoVazio({ id: "n", titulo: "Casa", cliente_id: null, cliente_nome: "", numero: 1 }), numero: "41", titulo: "Marina Castro | Casa Alphaville - V2", itens: [] };
    const aceite = JSON.stringify(definicaoOrcamento(o, {}, { fotos: {} }).content.find((x: { columns?: unknown }) => x.columns));
    expect(aceite).toContain("Marina Castro");
    expect(aceite).toContain("CONTRATANTE");
  });
});
