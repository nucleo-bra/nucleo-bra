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

import { lerNumeroBr, pendencias, rentabilidade } from "../src/lib/orcamentos";
describe("revisão do orçamento", () => {
  it("lê números como o brasileiro digita", () => {
    expect(lerNumeroBr("1.500")).toBe(1500);
    expect(lerNumeroBr("1.234,56")).toBe(1234.56);
    expect(lerNumeroBr("2,5")).toBe(2.5);
    expect(lerNumeroBr("1.5")).toBe(1.5);
    expect(lerNumeroBr("R$ 12.000.000")).toBe(12000000);
    expect(lerNumeroBr("")).toBe(0);
  });
  it("calcula custo, lucro e margem sobre o total final", () => {
    const itens = [item("produto", "A", 2, 180), item("servico", "B", 1, 100), item("cliente", "A", 1, 0)];
    itens[0].produto_id = "p1"; itens[1].servico_id = "s1";
    const r = rentabilidade({ itens, markup_produto_pct: 0, markup_servico_pct: 0, desconto_pct: 10, desconto_valor: null }, (i) => (i.produto_id ? 100 : i.servico_id ? 40 : null));
    expect(r.custo).toBe(240);
    expect(r.lucro).toBe(174); // 460 − 10% = 414; 414 − 240
    expect(r.margemPct).toBeCloseTo(42.03, 1);
  });
  it("aponta pendências", () => {
    const itens = [item("produto", "", 1, 0), { ...item("produto", "A", 0, 10) }, { ...item("produto", "A", 1, 10), descricao: "" }];
    const p = pendencias({ itens, ambientes: ["A"], titulo: "" }).map((x) => x.texto).join(" | ");
    expect(p).toMatch(/sem nome/); expect(p).toMatch(/quantidade zero/); expect(p).toMatch(/sem ambiente/); expect(p).toMatch(/valor zero/); expect(p).toMatch(/sem produto escolhido/);
  });
});
import { tituloInicial } from "../src/lib/orcamentos";
describe("nome inicial do orçamento", () => {
  it("não repete a versão nem o cliente", () => {
    expect(tituloInicial({ titulo: "Roberta e Richardson | BRA Ambientes - V1", cliente_nome: "Roberta e Richardson" })).toBe("Roberta e Richardson | BRA Ambientes - V1");
    expect(tituloInicial({ titulo: "Eduardo Attie", cliente_nome: "Eduardo Attie" })).toBe("Eduardo Attie - V1");
    expect(tituloInicial({ titulo: "Casa nova", cliente_nome: "" })).toBe("Casa nova - V1");
  });
});
import { ordenarAmbientes } from "../src/lib/orcamentos";
describe("ordem dos ambientes", () => {
  it("mão de obra e serviços sempre no fim", () => {
    const itens = [item("produto", "Automação", 1, 1), item("servico", "Mão de obra", 1, 1), item("produto", "Rede Estruturada", 1, 1), item("servico", "Programação", 1, 1)];
    expect(ordenarAmbientes(["Automação", "Mão de obra", "Sonorização", "Rede Estruturada", "Programação"], itens))
      .toEqual(["Automação", "Sonorização", "Rede Estruturada", "Mão de obra", "Programação"]);
    const o = { ambientes: ["Mão de obra", "Automação"], markup_produto_pct: 0, markup_servico_pct: 0, itens };
    expect(totaisPorAmbiente(o).map((a) => a.ambiente).slice(-2)).toEqual(["Mão de obra", "Programação"]);
  });
});
