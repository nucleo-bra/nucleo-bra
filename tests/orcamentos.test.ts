import { describe, expect, it } from "vitest";
import { calcularTotais, condicoes, Item, proximaVersao, totaisPorAmbiente, buscarNoCatalogo, plUnidade } from "../src/lib/orcamentos";

const item = (tipo: Item["tipo"], ambiente: string, quantidade: number, valor_unitario: number): Item => ({
  chave: Math.random().toString(36), tipo, produto_id: null, servico_id: null, descricao: "x", detalhe: "", sku: "", marca: "", unidade: "Un",
  quantidade, valor_unitario, valor_tabela: null, ambiente,
});

describe("orçamento no formato do Zenith", () => {
  it("bate com o orçamento 39 V5 (sem markup e sem desconto)", () => {
    const itens = [item("produto", "Automação", 1, 19890), item("produto", "Automação", 5, 2705.04), item("servico", "Mão de obra", 1, 37124.13), item("cliente", "Automação", 2, 999)];
    const t = calcularTotais({ itens, markup_produto_pct: 0, markup_servico_pct: 0, desconto_pct: 0, desconto_valor: null });
    expect(t.produtos).toBe(33415.2);
    expect(t.servicos).toBe(37124.13);
    expect(t.final).toBe(70539.33);
  });
  it("aplica markup adicional e desconto em % ou em R$", () => {
    const itens = [item("produto", "A", 2, 19890), item("servico", "B", 1, 5000)];
    const pct = calcularTotais({ itens, markup_produto_pct: 10, markup_servico_pct: 0, desconto_pct: 5, desconto_valor: null });
    expect(pct.semDesconto).toBe(48758);
    expect(pct.desconto).toBe(2437.9);
    expect(pct.final).toBe(46320.1);
    const rs = calcularTotais({ itens, markup_produto_pct: 0, markup_servico_pct: 0, desconto_pct: 0, desconto_valor: 780 });
    expect(rs.final).toBe(44000);
    expect(rs.descontoPct).toBeCloseTo(1.742, 2);
  });
  it("agrupa por ambiente na ordem cadastrada e ignora o produto do cliente no valor", () => {
    const o = { ambientes: ["Rede", "Automação"], markup_produto_pct: 0, markup_servico_pct: 0,
      itens: [item("produto", "Automação", 1, 100), item("cliente", "Automação", 1, 0), item("produto", "Rede", 3, 10), item("servico", "Mão de obra", 1, 50)] };
    const a = totaisPorAmbiente(o);
    expect(a.map((x) => x.ambiente)).toEqual(["Rede", "Automação", "Mão de obra"]);
    expect(a[1].total).toBe(100);
    expect(a[1].itens).toHaveLength(2);
  });
  it("monta condições de pagamento e próxima versão", () => {
    expect(condicoes(["A vista", "10x"], 1000)[1].texto).toBe("10x de R$ 100,00");
    expect(proximaVersao("Eduardo Attie | Quinta da Baronesa - V5", "V1")).toEqual({ titulo: "Eduardo Attie | Quinta da Baronesa - V6", versao: "V6" });
    expect(proximaVersao("Casa nova", "V1").versao).toBe("V2");
    expect(plUnidade("Pr", 7)).toBe("7 Par(es)");
    expect(plUnidade("Un", 1)).toBe("1 Unidade");
  });
  it("busca por código, nome ou fabricante sem acento", () => {
    const lista = [{ codigo: 4, nome: "C4- 21309 - Control4 Controladora Core 1", marca: "Control4" }, { codigo: 66, nome: "Episode Caixa de Embutir Teto", marca: "Episode" }];
    expect(buscarNoCatalogo(lista, "4", (x) => x.marca)[0].codigo).toBe(4);
    expect(buscarNoCatalogo(lista, "embutir episode", (x) => x.marca)).toHaveLength(1);
    expect(buscarNoCatalogo(lista, "controladora", (x) => x.marca)[0].codigo).toBe(4);
  });
});
