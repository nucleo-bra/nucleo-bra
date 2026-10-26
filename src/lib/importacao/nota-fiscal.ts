/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco e nós de XML chegam sem tipo; validamos campo a campo */
// Leitor de notas fiscais em XML (Omie).
// Suporta NFS-e padrão ABRASF (CompNfse — ex.: Paulínia/GISS) e NF-e de produto (nfeProc).
import { XMLParser } from "fast-xml-parser";
import { Alerta, Centavos, dataBrParaIso, documentoValido, moedaParaCentavos, soDigitos } from "./util";

export type ParcelaNota = { vencimento: string; valor: Centavos };

export type NotaFiscalLida = {
  tipo: "nfse" | "nfe";
  numero: string;
  serie?: string;
  codigo_verificacao?: string;
  chave_acesso?: string;
  rps_numero?: string;
  emitida_em: string; // ISO com fuso
  competencia?: string;
  prestador: { cnpj: string; nome: string };
  tomador: {
    nome: string; documento: string; inscricao_municipal?: string; email?: string; telefone?: string;
    logradouro?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string; codigo_ibge?: string;
  };
  valor_servicos: Centavos;
  valor_deducoes: Centavos;
  base_calculo?: Centavos;
  aliquota_iss?: number;
  valor_iss?: Centavos;
  iss_retido: boolean;
  valor_liquido: Centavos;
  codigo_servico?: string;
  descricao_servico?: string;
  discriminacao?: string;
  ordem_compra?: string;
  parcelas: ParcelaNota[];
  alertas: Alerta[];
};

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: true });

// Busca recursiva do primeiro nó com o nome indicado (os layouts de prefeitura variam muito)
function achar(obj: unknown, nome: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  if (nome in o) return o[nome];
  for (const v of Object.values(o)) {
    const r = achar(v, nome);
    if (r !== undefined) return r;
  }
  return undefined;
}
const txt = (v: unknown) => (v === undefined || v === null ? undefined : typeof v === "object" ? (v as any)["#text"] : String(v));

// Municípios mais comuns da carteira (IBGE). Os demais ficam só com o código.
const MUNICIPIOS: Record<string, string> = {
  "3509502": "Campinas", "3536505": "Paulínia", "3556206": "Valinhos", "3524709": "Jaguariúna",
  "3519071": "Hortolândia", "3552403": "Sumaré", "3533403": "Nova Odessa", "3501608": "Americana",
  "3550308": "São Paulo", "3525904": "Jundiaí", "3556701": "Vinhedo", "3528403": "Louveira",
  "3548708": "Santo Antônio de Posse", "3545803": "Santa Bárbara d'Oeste", "3520509": "Indaiatuba",
};

export function lerNotaFiscalXml(xml: string): NotaFiscalLida {
  const doc = parser.parse(xml);
  if (achar(doc, "infNFe")) return lerNfe(doc);
  if (achar(doc, "InfNfse") || achar(doc, "CompNfse")) return lerNfse(doc);
  throw new Error("Este XML não parece ser uma NFS-e nem uma NF-e.");
}

function lerNfse(doc: unknown): NotaFiscalLida {
  const inf = achar(doc, "InfNfse");
  const decl = achar(inf, "InfDeclaracaoPrestacaoServico") ?? inf;
  const serv = achar(decl, "Servico");
  const valoresServ = achar(serv, "Valores") ?? {};
  const valoresNota = achar(inf, "ValoresNfse") ?? {};
  const tom = achar(decl, "TomadorServico") ?? achar(decl, "Tomador") ?? {};
  const prest = achar(inf, "PrestadorServico") ?? {};
  const alertas: Alerta[] = [];

  const m = (v: unknown) => (txt(v) ? moedaParaCentavos(txt(v)!) : 0);
  const discr = (txt(achar(serv, "Discriminacao")) ?? "").replace(/\\n|\|/g, " ");

  // A Omie grava vencimento e ordem de compra soltos no texto da discriminação
  const venc = discr.match(/VENCIMENTO:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const oc = discr.match(/ORDEM\s+DE\s+COMPRA:?\s*(\d+)/i);

  const valorServicos = m(achar(valoresServ, "ValorServicos") ?? achar(valoresNota, "BaseCalculo"));
  const valorLiquido = m(achar(valoresNota, "ValorLiquidoNfse")) || valorServicos;
  const issRetido = txt(achar(serv, "IssRetido")) === "1";

  const endTom = achar(tom, "Endereco") ?? {};
  const codMun = txt(achar(endTom, "CodigoMunicipio"));
  const tomadorDoc = soDigitos(txt(achar(achar(tom, "CpfCnpj"), "Cnpj")) ?? txt(achar(achar(tom, "CpfCnpj"), "Cpf")));

  const parcelas: ParcelaNota[] = venc ? [{ vencimento: dataBrParaIso(venc[1]), valor: valorLiquido }] : [];
  if (!venc) alertas.push({ nivel: "atencao", mensagem: "Vencimento não encontrado na descrição da nota — informe na conferência." });
  if (tomadorDoc && !documentoValido(tomadorDoc)) alertas.push({ nivel: "erro", mensagem: `CPF/CNPJ do tomador inválido: ${tomadorDoc}` });
  if (!tomadorDoc) alertas.push({ nivel: "atencao", mensagem: "Nota sem CPF/CNPJ do tomador." });
  if (issRetido) alertas.push({ nivel: "info", mensagem: "ISS retido pelo tomador — o valor a receber considera a retenção." });
  if (txt(achar(inf, "NfseSubstituida"))) alertas.push({ nivel: "atencao", mensagem: "Esta NFS-e substitui outra nota." });

  const competencia = txt(achar(decl, "Competencia"));
  return {
    tipo: "nfse",
    numero: txt(achar(inf, "Numero"))!,
    serie: txt(achar(achar(decl, "IdentificacaoRps"), "Serie")),
    codigo_verificacao: txt(achar(inf, "CodigoVerificacao")),
    rps_numero: txt(achar(achar(decl, "IdentificacaoRps"), "Numero")),
    emitida_em: txt(achar(inf, "DataEmissao"))!,
    competencia: competencia?.slice(0, 10),
    prestador: {
      cnpj: soDigitos(txt(achar(achar(achar(decl, "Prestador"), "CpfCnpj"), "Cnpj"))),
      nome: txt(achar(prest, "RazaoSocial")) ?? "",
    },
    tomador: {
      nome: txt(achar(tom, "RazaoSocial")) ?? "",
      documento: tomadorDoc,
      inscricao_municipal: txt(achar(tom, "InscricaoMunicipal")),
      email: txt(achar(achar(tom, "Contato"), "Email")),
      telefone: txt(achar(achar(tom, "Contato"), "Telefone")),
      logradouro: txt(achar(endTom, "Endereco")),
      numero: txt(achar(endTom, "Numero")),
      bairro: txt(achar(endTom, "Bairro")),
      cidade: codMun ? MUNICIPIOS[codMun] : undefined,
      uf: txt(achar(endTom, "Uf")),
      cep: txt(achar(endTom, "Cep")),
      codigo_ibge: codMun,
    },
    valor_servicos: valorServicos,
    valor_deducoes: m(achar(valoresServ, "ValorDeducoes")),
    base_calculo: m(achar(valoresNota, "BaseCalculo")),
    aliquota_iss: Number(txt(achar(valoresNota, "Aliquota")) ?? txt(achar(valoresServ, "Aliquota")) ?? 0),
    valor_iss: m(achar(valoresNota, "ValorIss") ?? achar(valoresServ, "ValorIss")),
    iss_retido: issRetido,
    valor_liquido: valorLiquido,
    codigo_servico: txt(achar(serv, "ItemListaServico")),
    descricao_servico: txt(achar(inf, "DescricaoCodigoTributacaoMunicipio")),
    discriminacao: discr,
    ordem_compra: oc?.[1],
    parcelas,
    alertas,
  };
}

function lerNfe(doc: unknown): NotaFiscalLida {
  const inf = achar(doc, "infNFe");
  const ide = achar(inf, "ide");
  const emit = achar(inf, "emit");
  const dest = achar(inf, "dest") ?? {};
  const end = achar(dest, "enderDest") ?? {};
  const tot = achar(achar(inf, "total"), "ICMSTot");
  const alertas: Alerta[] = [];
  const valor = moedaParaCentavos(txt(achar(tot, "vNF"))!);

  let dups = achar(achar(inf, "cobr"), "dup");
  dups = dups ? (Array.isArray(dups) ? dups : [dups]) : [];
  const parcelas: ParcelaNota[] = dups.map((d: any) => ({ vencimento: txt(d.dVenc)!, valor: moedaParaCentavos(txt(d.vDup)!) }));
  const somaParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
  if (!parcelas.length) alertas.push({ nivel: "atencao", mensagem: "NF-e sem duplicatas — informe o(s) vencimento(s) na conferência." });
  else if (somaParcelas !== valor) alertas.push({ nivel: "atencao", mensagem: "Soma das parcelas diferente do valor total da nota." });

  const destDoc = soDigitos(txt(dest.CNPJ) ?? txt(dest.CPF));
  if (destDoc && !documentoValido(destDoc)) alertas.push({ nivel: "erro", mensagem: `CPF/CNPJ do destinatário inválido: ${destDoc}` });
  const prot = achar(doc, "infProt");

  return {
    tipo: "nfe",
    numero: txt(ide.nNF)!,
    serie: txt(ide.serie),
    chave_acesso: txt(achar(prot, "chNFe")) ?? String(inf["@_Id"] ?? "").replace(/^NFe/, ""),
    emitida_em: txt(ide.dhEmi)!,
    prestador: { cnpj: soDigitos(txt(emit.CNPJ)), nome: txt(emit.xNome) ?? "" },
    tomador: {
      nome: txt(dest.xNome) ?? "", documento: destDoc, email: txt(dest.email),
      logradouro: txt(end.xLgr), numero: txt(end.nro), bairro: txt(end.xBairro),
      cidade: txt(end.xMun), uf: txt(end.UF), cep: txt(end.CEP), codigo_ibge: txt(end.cMun),
      telefone: txt(end.fone),
    },
    valor_servicos: valor,
    valor_deducoes: moedaParaCentavos(txt(achar(tot, "vDesc")) ?? "0"),
    iss_retido: false,
    valor_liquido: valor,
    discriminacao: txt(achar(achar(inf, "infAdic"), "infCpl")),
    parcelas,
    alertas,
  };
}
