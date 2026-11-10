import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { baseDoVendedor, valorDaComissao } from "@/lib/comissao";
import { baseVendedor, comissaoVendedor } from "@/lib/crm";
import { aplicarCotacao, calcular, novoPrecoFornecedor, reprecificar } from "@/lib/precos";
import { produtosParaCotacao } from "@/lib/cotacao";
import { escolherPrecos, lerProdutosCatalogo, lerValor, type ItemPdf } from "@/lib/catalogo-produtos";
import { mapaTipos } from "@/legado/adaptador";
import { catalogosPendentes } from "@/lib/catalogo-lembrete";
import { alertaCatalogos } from "@/lib/avisos";
import { acharPorNome, sugerirClientes, type ClienteFicha } from "@/lib/cliente-busca";
import { formacaoComCatalogo } from "@/components/catalogos/atualizar-precos";

describe("comissão do vendedor sem a parte do arquiteto", () => {
  const coms = [{ n: "Matheus", r: "Vendedor", p: 2 }, { n: "Ana Arq.", r: "Arquiteto", p: 10 }, { n: "Caio Lisboa", r: "Engenheiro", p: 1.48 }];
  it("R$ 50.000 com 10% do arquiteto: vendedor sobre R$ 45.000", () => {
    expect(baseDoVendedor(50000, coms)).toBe(45000);
    expect(valorDaComissao(coms[0], 50000, coms)).toBe(900);
    // arquiteto sobre o bruto; equipe interna (Caio) também sem a parte do arquiteto
    expect(valorDaComissao(coms[1], 50000, coms)).toBe(5000);
    expect(valorDaComissao(coms[2], 50000, coms)).toBeCloseTo(666);
  });
  it("CRM usa a mesma regra", () => {
    expect(baseVendedor(50000, 10)).toBe(45000);
    expect(comissaoVendedor({ valor_estimado: 50000, pct_parceiro: 10, pct_vendedor: 2 })).toBe(900);
    expect(comissaoVendedor({ valor_estimado: 50000, pct_parceiro: 0, pct_vendedor: 2 })).toBe(1000);
  });
  it("Financeiro v38: base do vendedor desconta parceiro/arquiteto; PJ = cliente com NF", () => {
    const html = readFileSync("legado/financeiro-v38.html", "utf8");
    const ini = html.indexOf("const isV="), fim = html.indexOf("const tpOk=");
    const trecho = html.slice(ini, html.indexOf("\n", fim));
    const cm = (i: { coms: unknown[] }) => i.coms;
    const nm = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();
    const window = { __equipeInt: { "caio lisboa": true } as Record<string, boolean>, __tpCli: { "plaenge empreendimentos ltda": "PJ" } as Record<string, string> };
    const ui = { forma: "pix*", tp: "" };
    const S = { nf: [{ cli: "Plaenge Empreendimentos LTDA" }], it: [{ t: "r", who: "Construtora Alfa", nfr: "1832" }, { t: "r", who: "Eduardo Attie", nfr: "" }] };
    const f = new Function("cm", "nm", "window", "ui", "S", trecho + "\nreturn { cmVal, cmBase, fmOk, tpCli };");
    const { cmVal, cmBase, fmOk, tpCli } = f(cm, nm, window, ui, S);
    const i = { coms: [{ n: "Matheus", r: "Vendedor", p: 2 }, { n: "Ana", r: "Arquiteto", p: 10 }, { n: "Caio Lisboa", r: "Engenheiro", p: 1.48 }] };
    expect(cmBase(i, 50000)).toBe(45000);
    expect(cmVal(i, i.coms[0], 50000)).toBe(900);
    expect(cmVal(i, i.coms[1], 50000)).toBe(5000);
    expect(cmVal(i, i.coms[2], 50000)).toBeCloseTo(666);   // Caio: 1,48% de 45.000
    // engenheiro externo (fora da equipe interna) conta como parceiro
    expect(cmBase({ coms: [{ n: "Eng. Externo", r: "Engenheiro", p: 5 }] }, 1000)).toBe(950);
    expect(fmOk({ forma: "Pix PJ" })).toBe(true);
    expect(fmOk({ forma: "Boleto" })).toBe(false);
    expect(tpCli("Plaenge Empreendimentos LTDA")).toBe("PJ");
    expect(tpCli("Construtora Alfa")).toBe("PJ");     // tem parcela com NF vinculada
    expect(tpCli("Construtora Beta Ltda")).toBe("PF"); // sem NF no Financeiro
    expect(tpCli("Eduardo Attie")).toBe("PF");
  });
});

describe("A receber: PF/PJ pelo cadastro", () => {
  it("documento decide; nome e nome fantasia apontam para o mesmo tipo", () => {
    const m = mapaTipos([
      { nome: "Eduardo  Attie", tipo: "PF", documento: "123.456.789-09" },
      { nome: "PLAENGE EMPREENDIMENTOS LTDA", nome_fantasia: "Plaenge", tipo: "PF", documento: "78.638.061/0089-08" },
    ]);
    expect(m["eduardo attie"]).toBe("PF");
    expect(m["plaenge"]).toBe("PJ");
    expect(m["plaenge empreendimentos ltda"]).toBe("PJ");
  });
});

describe("compra em dólar e reajuste respeitando a margem", () => {
  const P = { margem_pct: 30, simples_pct: 10 };
  it("aplica a cotação no preço do fornecedor", () => {
    const f = aplicarCotacao({ moeda: "USD", preco_moeda: 100, modo: "margem" }, 5.4321, "2026-11-10");
    expect(f.preco_fornecedor).toBe(543.21);
    expect(f.cotacao_data).toBe("2026-11-10");
    expect(aplicarCotacao({ moeda: "BRL", preco_fornecedor: 10 }, 5, "x").preco_fornecedor).toBe(10);
  });
  it("pela margem: a margem continua a mesma com o custo novo", () => {
    const f0 = { preco_fornecedor: 1000, modo: "margem" as const };
    const f1 = novoPrecoFornecedor(f0, P, 1200);
    expect(calcular(f1, P).margemPct).toBeCloseTo(calcular(f0, P).margemPct, 1);
    expect(calcular(f1, P).preco).toBeGreaterThan(calcular(f0, P).preco);
  });
  it("preço fixo: mantém o multiplicador sobre o custo", () => {
    const f0 = { preco_fornecedor: 1000, modo: "manual" as const, preco_manual: 2500 };
    const f1 = reprecificar(f0, P, (g) => ({ ...g, preco_fornecedor: 1100 }));
    expect(f1.preco_manual).toBe(2750);
    expect(calcular(f1, P).markup).toBeCloseTo(calcular(f0, P).markup, 3);
  });
  it("produto do Zenith (sem formação) também mantém a margem", () => {
    const f = formacaoComCatalogo({ valor_compra: 100, impostos_pct: 10, preco_venda: 220, formacao: null }, 120, "BRL", P, null);
    const c = calcular(f, P);
    expect(c.custo).toBe(132);
    expect(c.preco).toBe(264);
  });
  it("atualização diária pega só os produtos em dólar que não estão com a cotação do dia", () => {
    const c = { valor: 5, data: "2026-11-10", fonte: "t" };
    const L = produtosParaCotacao([
      { id: "a", formacao: { moeda: "USD", preco_moeda: 10, modo: "manual", preco_fornecedor: 48, preco_manual: 96, cotacao_data: "2026-11-09" } },
      { id: "b", formacao: { moeda: "USD", preco_moeda: 10, cotacao_data: "2026-11-10" } },
      { id: "c", formacao: { moeda: "BRL", preco_fornecedor: 10 } },
      { id: "d", formacao: null },
    ], c, {});
    expect(L.map((x) => x.id)).toEqual(["a"]);
    expect(L[0].formacao.preco_fornecedor).toBe(50);
    expect(L[0].formacao.preco_manual).toBe(100);
  });
});

describe("preços lidos do catálogo", () => {
  it("lê valores em real e em dólar", () => {
    expect(lerValor("R$ 1.234,56")).toBe(1234.56);
    expect(lerValor("1.234,56")).toBe(1234.56);
    expect(lerValor("US$ 1,234.50")).toBe(1234.5);
    expect(lerValor("$99.90")).toBe(99.9);
    expect(lerValor("2,4 GHz")).toBeNull();
    expect(lerValor("12345678")).toBeNull();
  });
  it("revenda e consumidor: rótulos mandam, sem rótulo o menor é revenda", () => {
    expect(escolherPrecos([{ x: 0, y: 0, v: 900, tipo: "consumidor" }, { x: 0, y: 0, v: 500, tipo: "revenda" }])).toEqual({ preco: 500, preco_consumidor: 900 });
    expect(escolherPrecos([{ x: 0, y: 0, v: 900, tipo: "neutro" }, { x: 0, y: 0, v: 500, tipo: "neutro" }])).toEqual({ preco: 500, preco_consumidor: 900 });
    expect(escolherPrecos([{ x: 0, y: 0, v: 700, tipo: "neutro" }])).toEqual({ preco: 700 });
  });
  it("bloco com Código, NCM, Revenda e Consumidor", () => {
    const i = (x: number, y: number, s: string, t = 9): ItemPdf => ({ x, y, s, t });
    const pagina = [
      i(40, 700, "CAIXA ACÚSTICA EP-AW8"), i(220, 700, "Código"), i(220, 688, "40123"), i(220, 676, "85182200"),
      i(220, 660, "Revenda"), i(270, 660, "R$"), i(285, 660, "1.234,56"), i(220, 648, "Consumidor"), i(270, 648, "R$ 2.100,00"),
      i(320, 700, "Caixa de embutir 8 polegadas"),
      i(40, 560, "SUBWOOFER EP-SUB10"), i(220, 560, "Código"), i(220, 548, "40124"), i(220, 536, "85182900"),
      i(220, 520, "Revenda"), i(270, 520, "R$ 3.000,00"), i(220, 508, "Consumidor"), i(270, 508, "R$ 4.500,00"),
    ];
    const L = lerProdutosCatalogo([pagina]);
    const a = L.find((p) => p.codigo === "40123")!, b = L.find((p) => p.codigo === "40124")!;
    expect(a.preco).toBe(1234.56); expect(a.preco_consumidor).toBe(2100);
    expect(b.preco).toBe(3000); expect(b.preco_consumidor).toBe(4500);
  });
});

describe("lembrete mensal dos catálogos", () => {
  const agora = new Date(2026, 10, 3, 9);
  it("pendente quem não foi conferido neste mês", () => {
    const L = [{ fornecedor: "Episode", conferido_em: "2026-10-28" }, { fornecedor: "Control4", conferido_em: "2026-11-02" }, { fornecedor: "Ubiquiti", conferido_em: null }];
    expect(catalogosPendentes(L, agora).map((c) => c.fornecedor)).toEqual(["Episode", "Ubiquiti"]);
    const a = alertaCatalogos(L, agora)!;
    expect(a.titulo).toBe("Atualizar catálogos de novembro");
    expect(a.link).toBe("/catalogos/");
    expect(alertaCatalogos([{ fornecedor: "X", conferido_em: "2026-11-01" }], agora)).toBeNull();
  });
});

describe("cliente do cadastro em todas as abas", () => {
  const base = { tipo: "PF" as const, telefone: "", data_nascimento: "", inscricao_municipal: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", uf: "SP", observacoes: "", parceiro_origem_id: null, ativo: true, endereco: "" };
  const L: ClienteFicha[] = [
    { ...base, id: "1", nome: "Eduardo Attie", nome_fantasia: "", documento: "12345678909", email: "eduardo@email.com", cidade: "Campinas" },
    { ...base, id: "2", nome: "PLAENGE EMPREENDIMENTOS LTDA", nome_fantasia: "Plaenge", tipo: "PJ", documento: "78638061008908", email: "f@plaenge.com.br", cidade: "Campinas" },
  ];
  it("acha pelo nome sem acento/maiúsculas e pelo nome fantasia", () => {
    expect(acharPorNome(L, "eduardo  ATTIE")?.id).toBe("1");
    expect(acharPorNome(L, "plaenge")?.id).toBe("2");
    expect(acharPorNome(L, "Eduardo")).toBeNull();
  });
  it("sugere por parte do nome, cidade ou documento", () => {
    expect(sugerirClientes(L, "edu").map((c) => c.id)).toEqual(["1"]);
    expect(sugerirClientes(L, "7863").map((c) => c.id)).toEqual(["2"]);
    expect(sugerirClientes(L, "campinas").length).toBe(2);
  });
});

import { montarPendencias } from "@/lib/pendencias";
describe("pendências de cadastro", () => {
  it("separa cada tipo de pendência com o link para resolver", () => {
    const G = montarPendencias({
      clientes: [
        { id: "a", nome: "Sem Nada", documento: "", email: "", cidade: "" },
        { id: "b", nome: "Completo", documento: "123.456.789-09", email: "x@y.com", cidade: "Campinas" },
        { id: "c", nome: "Aditivo", documento: "", email: "", cidade: "", principal_id: "b" },
      ],
      produtos: [{ id: "p1", nome: "Sem preço", preco_venda: 0, custo: 10 }, { id: "p2", nome: "Prejuízo", preco_venda: 50, custo: 80 }, { id: "p3", nome: "Ok", preco_venda: 100, custo: 50 }],
      negocios: [{ id: "n1", titulo: "X", etapa: "ganho", financeiro_lancado_em: null, cliente_id: "b" }, { id: "n2", titulo: "Y", etapa: "lead", cliente_id: null }],
      propostas: [{ id: "o1", numero: "10", cliente_id: null, status: "enviada" }, { id: "o2", numero: "11", cliente_id: null, status: "substituida" }],
      cartoes: [{ id: "k1", titulo: "Atrasado", prazo: "2026-11-01T18:00:00Z", quadro_id: "q", quadros: { modulo: "chamados" } }, { id: "k2", titulo: "Futuro", prazo: "2026-12-01T18:00:00Z", quadro_id: "q" }],
      pix: 3,
    }, "2026-11-10");
    const por = Object.fromEntries(G.map((g) => [g.chave, g]));
    expect(por["cli-doc"].itens.map((i) => i.id)).toEqual(["a"]);
    expect(por["cli-email"].total).toBe(1);
    expect(por["prod-preco"].itens[0].link).toBe("/produtos/?id=p1");
    expect(por["prod-prej"].itens[0].id).toBe("p2");
    expect(por["neg-fin"].itens[0].link).toBe("/crm/?aba=negocios&n=n1");
    expect(por["neg-cli"].itens[0].id).toBe("n2");
    expect(por["orc-cli"].total).toBe(1);
    expect(por["cart-prazo"].itens[0].link).toBe("/tecnico/chamados/?c=k1");
    expect(por["pix"].total).toBe(3);
  });
});
