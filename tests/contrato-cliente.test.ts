import { describe, expect, it } from "vitest";
import { lerDadosContrato, lerEndereco, mudancas } from "../src/lib/contrato-cliente";

const TEXTO = `I. DAS PARTES
FORNECEDORA: Brtelecom Comércio e Serviços Integrados LTDA, inscrita sob o CNPJ 07.787.973/0001-61, com sede na Rua Nossa Senhora de Fátima, 166.
Representante legal: Fulano, inscrito no CPF sob o nº 111.111.111-11
CLIENTE:
Nome completo: Marina Castro Albuquerque
CPF/CNPJ: 123.456.789-09
Data de nascimento: 05/03/1990
Endereço: Avenida das Palmeiras, 4193 – Bairro Santa Terezinha, Paulínia – SP CEP 13.140-818

Doravante denominada, simplesmente, CLIENTE`;

describe("dados do cliente no contrato", () => {
  it("lê a qualificação do modelo BRA (e não a da fornecedora)", () => {
    const d = lerDadosContrato(TEXTO);
    expect(d).toMatchObject({ nome: "Marina Castro Albuquerque", documento: "12345678909", data_nascimento: "1990-03-05",
      logradouro: "Avenida das Palmeiras", numero: "4193", bairro: "Santa Terezinha", cidade: "Paulínia", uf: "SP", cep: "13140-818" });
  });
  it("endereço em outros formatos", () => {
    expect(lerEndereco("Rua Joaquim Egídio nº 30, apto 12, Cambuí, Campinas/SP, CEP 13025-000")).toMatchObject({ logradouro: "Rua Joaquim Egídio", numero: "30", complemento: "apto 12", bairro: "Cambuí", cidade: "Campinas", uf: "SP", cep: "13025-000" });
  });
  it("ignora campos do modelo não preenchidos e lista só o que muda", () => {
    expect(lerDadosContrato("CLIENTE:\nNome completo: {cliente_nome}\nCPF/CNPJ: \n").nome).toBeUndefined();
    const m = mudancas({ nome: "Marina Castro", documento: "12345678909", cidade: "" }, { nome: "Marina Castro Albuquerque", documento: "123.456.789-09", cidade: "Paulínia" });
    expect(m.map((x) => x.campo)).toEqual(["nome", "cidade"]);
  });
});
