// Leitor de boletos bancários em PDF (texto já extraído).
// Valida a linha digitável pelos dígitos verificadores (módulo 10 e 11)
// e decodifica banco, vencimento e valor diretamente do código.
import { Alerta, Centavos, dataBrParaIso, moedaParaCentavos, soDigitos } from "./util";

export type BoletoLido = {
  linha_digitavel: string;
  banco_codigo: string;
  banco_nome?: string;
  vencimento: string;           // decodificado do código de barras
  valor: Centavos;              // decodificado do código de barras
  numero_documento?: string;    // normalmente o nº da NF
  nosso_numero?: string;
  codigo_comercial?: string;    // "BRT 202600521"
  pagador?: { nome: string; documento: string };
  alertas: Alerta[];
};

const BANCOS: Record<string, string> = {
  "001": "Banco do Brasil", "033": "Santander", "104": "Caixa", "237": "Bradesco", "341": "Itaú",
  "748": "Sicredi", "756": "Sicoob", "077": "Inter", "260": "Nubank", "336": "C6", "422": "Safra",
};

function modulo10(num: string) {
  let soma = 0, peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    let p = Number(num[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  const r = soma % 10;
  return r === 0 ? 0 : 10 - r;
}

function modulo11Barras(num: string) {
  let soma = 0, peso = 2;
  for (let i = num.length - 1; i >= 0; i--) {
    soma += Number(num[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = 11 - (soma % 11);
  return r === 0 || r === 10 || r === 11 ? 1 : r;
}

/** Fator de vencimento FEBRABAN — reiniciou em 1000 no dia 22/02/2025 */
export function fatorParaData(fator: number, referencia = new Date()): string | undefined {
  if (fator === 0) return undefined;
  const dia = 86_400_000;
  const antigo = Date.UTC(1997, 9, 7) + fator * dia;
  const novo = Date.UTC(2025, 1, 22) + (fator - 1000) * dia;
  // escolhe o ciclo mais próximo da data de referência
  const escolhido = Math.abs(novo - referencia.getTime()) < Math.abs(antigo - referencia.getTime()) ? novo : antigo;
  return new Date(escolhido).toISOString().slice(0, 10);
}

export function validarLinhaDigitavel(linha: string): { valida: boolean; barras: string; motivo?: string } {
  const d = soDigitos(linha);
  if (d.length !== 47) return { valida: false, barras: "", motivo: "A linha digitável deve ter 47 dígitos." };
  const campos = [d.slice(0, 9), d.slice(10, 20), d.slice(21, 31)];
  const dvs = [d[9], d[20], d[31]].map(Number);
  for (let i = 0; i < 3; i++)
    if (modulo10(campos[i]) !== dvs[i]) return { valida: false, barras: "", motivo: `Dígito do campo ${i + 1} não confere.` };
  const barras = d.slice(0, 4) + d[32] + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
  if (modulo11Barras(barras.slice(0, 4) + barras.slice(5)) !== Number(barras[4]))
    return { valida: false, barras, motivo: "Dígito geral do código de barras não confere." };
  return { valida: true, barras };
}

export function lerBoleto(linhas: string[], referencia = new Date()): BoletoLido {
  const texto = linhas.join("\n");
  const alertas: Alerta[] = [];
  const ld = texto.match(/\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14}/);
  if (!ld) throw new Error("Não encontrei a linha digitável neste PDF. Ele é um boleto bancário?");
  const linha = ld[0].replace(/\s+/g, " ");
  const v = validarLinhaDigitavel(linha);
  if (!v.valida) alertas.push({ nivel: "erro", mensagem: `Linha digitável inválida: ${v.motivo}` });

  const d = soDigitos(linha);
  const banco = d.slice(0, 3);
  const vencimento = fatorParaData(Number(d.slice(33, 37)), referencia);
  const valor = Number(d.slice(37, 47));

  // confere o que está impresso com o que está no código
  const impresso = texto.match(/Vencimento[^\n]*\n[^\n]*?(\d{2}\/\d{2}\/\d{4})/);
  if (impresso && vencimento && dataBrParaIso(impresso[1]) !== vencimento)
    alertas.push({ nivel: "erro", mensagem: `Vencimento impresso (${impresso[1]}) diferente do código de barras.` });
  const valorImpresso = texto.match(/Valor documento[^\n]*\n(?:[^\n]*\|)?[^\n]*?([\d.]+,\d{2})\s*$/m);
  if (valorImpresso && moedaParaCentavos(valorImpresso[1]) !== valor)
    alertas.push({ nivel: "erro", mensagem: "Valor impresso diferente do código de barras." });
  if (!vencimento) alertas.push({ nivel: "atencao", mensagem: "Boleto sem vencimento no código (contra-apresentação)." });

  const numDoc =
    texto.match(/N[úu]mero do documento[^\n]*\n\s*(\d+)(?![\d/])/i)?.[1] ??
    texto.match(/Nota Fiscal\s+(\d+)/i)?.[1] ??
    texto.match(/N[oº°]\.?\s*documento[^\n]*\n\s*\d{2}\/\d{2}\/\d{4}\s+(\d+)/i)?.[1];
  const nosso = texto.match(/(\d{3}\/\d{6,}-\d)/)?.[1];
  const comercial = texto.match(/Proposta Comercial\s+([A-Z]{2,5}\s*\d{6,})/i)?.[1];
  const pag = texto.match(/Pagador\s*\n\s*(.+?)\s+-\s+([\d./-]{14,18})/);

  return {
    linha_digitavel: linha,
    banco_codigo: banco,
    banco_nome: BANCOS[banco],
    vencimento: vencimento ?? "",
    valor,
    numero_documento: numDoc,
    nosso_numero: nosso,
    codigo_comercial: comercial,
    pagador: pag ? { nome: pag[1].trim(), documento: soDigitos(pag[2]) } : undefined,
    alertas,
  };
}
