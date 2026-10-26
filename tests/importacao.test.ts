// Testes dos leitores com os arquivos reais enviados pela BRA (out/2026)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { lerNotaFiscalXml } from "@/lib/importacao/nota-fiscal";
import { lerBoleto, validarLinhaDigitavel, fatorParaData } from "@/lib/importacao/boleto";
import { lerPropostaZenith } from "@/lib/importacao/proposta-zenith";
import { extrairLinhasPdf } from "@/lib/importacao/pdf-texto";
import { documentoValido, moedaParaCentavos } from "@/lib/importacao/util";

const f = (n: string) => readFileSync(`tests/fixtures/${n}`);
const ref = new Date("2026-10-26T12:00:00Z");

describe("utilidades", () => {
  it("converte moeda sem erro de centavos", () => {
    expect(moedaParaCentavos("R$ 101.728,72")).toBe(10172872);
    expect(moedaParaCentavos("4409.20")).toBe(440920);
    expect(moedaParaCentavos("0,07")).toBe(7);
  });
  it("valida CNPJ", () => {
    expect(documentoValido("07.787.973/0001-61")).toBe(true);
    expect(documentoValido("78.638.061/0089-08")).toBe(true);
    expect(documentoValido("78.638.061/0089-09")).toBe(false);
  });
});

describe("NFS-e 1832 (Omie / Paulínia)", () => {
  const nf = lerNotaFiscalXml(f("nfse-1832.xml").toString("utf8"));
  it("lê os dados fiscais", () => {
    expect(nf.tipo).toBe("nfse");
    expect(nf.numero).toBe("1832");
    expect(nf.rps_numero).toBe("464");
    expect(nf.codigo_verificacao).toBe("6SWTL7CEP");
    expect(nf.prestador.cnpj).toBe("07787973000161");
    expect(nf.valor_servicos).toBe(440920);
    expect(nf.valor_iss).toBe(22046);
    expect(nf.valor_liquido).toBe(440920);
    expect(nf.iss_retido).toBe(false);
  });
  it("identifica o tomador (filial Plaenge)", () => {
    expect(nf.tomador.nome).toBe("PLAENGE EMPREENDIMENTOS LTDA");
    expect(nf.tomador.documento).toBe("78638061008908");
    expect(nf.tomador.cidade).toBe("Campinas");
  });
  it("extrai vencimento e ordem de compra do texto", () => {
    expect(nf.parcelas).toEqual([{ vencimento: "2026-12-10", valor: 440920 }]);
    expect(nf.ordem_compra).toBe("2288860");
    expect(nf.alertas.filter((a) => a.nivel === "erro")).toEqual([]);
  });
});

describe("Boleto Itaú da NF 1832", async () => {
  const b = lerBoleto((await extrairLinhasPdf(f("boleto-1832.pdf"))).map((l) => l.texto), ref);
  it("valida a linha digitável", () => {
    expect(validarLinhaDigitavel(b.linha_digitavel).valida).toBe(true);
    expect(validarLinhaDigitavel(b.linha_digitavel.replace("93668", "93669")).valida).toBe(false);
  });
  it("decodifica banco, vencimento e valor do código", () => {
    expect(b.banco_codigo).toBe("341");
    expect(b.banco_nome).toBe("Itaú");
    expect(b.vencimento).toBe("2026-12-10");
    expect(b.valor).toBe(440920);
  });
  it("encontra vínculos com NF e proposta", () => {
    expect(b.numero_documento).toBe("1832");
    expect(b.nosso_numero).toBe("109/00000318-6");
    expect(b.codigo_comercial).toBe("BRT 202600521");
    expect(b.pagador?.documento).toBe("78638061008908");
    expect(b.alertas).toEqual([]);
  });
  it("fator de vencimento respeita o novo ciclo FEBRABAN", () => {
    expect(fatorParaData(1000, ref)).toBe("2025-02-22");
    expect(fatorParaData(1656, ref)).toBe("2026-12-10");
  });
});

describe("Proposta Zenith nº 39 V5 — Eduardo Attie", async () => {
  const p = lerPropostaZenith(await extrairLinhasPdf(f("proposta-39-v5.pdf")));
  it("lê a capa", () => {
    expect(p.numero).toBe("39");
    expect(p.versao).toBe("V5");
    expect(p.cliente_nome).toBe("Eduardo Attie");
    expect(p.projeto_nome).toBe("Quinta da Baronesa");
    expect(p.data_emissao).toBe("2026-10-21");
  });
  it("lê os 37 itens e todos os sistemas", () => {
    expect(p.itens).toHaveLength(37);
    expect(p.sistemas.map((s) => s.nome)).toEqual(["Automação", "Rede Estruturada", "Segurança", "Sonorização", "Home Theater", "Mão de Obra"]);
    expect(p.itens.filter((i) => i.sku).map((i) => i.sku)).toEqual(["C4-21309", "C4-T4IW10-BL"]);
    expect(p.itens[0]).toMatchObject({ sku: "C4-21309", descricao: "Control4 Controladora Core 1", quantidade: 1, valor_total: 1989000 });
    expect(p.itens.find((i) => i.descricao.includes("ES-CORE-16-IC") && i.sistema === "Sonorização")).toMatchObject({ quantidade: 7, unidade: "par" });
    expect(p.itens.at(-1)).toMatchObject({ sistema: "Mão de Obra", tipo: "servico", valor_total: 3712413 });
  });
  it("todas as contas fecham", () => {
    expect(p.total_itens).toBe(26500000);
    expect(p.total_final).toBe(26500000);
    expect(p.total_servicos).toBe(3712413);
    expect(p.total_produtos).toBe(26500000 - 3712413);
    expect(p.condicoes_pagamento).toBe("A combinar");
    expect(p.alertas.filter((a) => a.nivel === "erro")).toEqual([]);
  });
});
