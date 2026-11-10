// Regra da comissão do vendedor (a mesma do Financeiro v38): a base é o valor
// bruto menos a comissão de parceiros/arquitetos do mesmo lançamento.
// Ex.: R$ 50.000 com 10% do arquiteto → vendedor comissiona sobre R$ 45.000.
// A equipe interna (engenheiro, projetista) não entra no desconto.
export type Com = { n: string; r?: string; p: number };

export const ehVendedor = (c: Com) => !c.r || c.r === "Vendedor";
export const ehParceiroExterno = (c: Com) => c.r === "Parceiro" || c.r === "Arquiteto" || c.r === "Designer";

export function baseDoVendedor(valor: number, coms: Com[]) {
  const p = coms.filter((c) => ehParceiroExterno(c)).reduce((s, c) => s + (Number(c.p) || 0), 0);
  return (Number(valor) || 0) * (1 - p / 100);
}
/** R$ da comissão de `c` num lançamento de `valor` com as comissões `coms`. */
export function valorDaComissao(c: Com, valor: number, coms: Com[]) {
  return ((ehVendedor(c) ? baseDoVendedor(valor, coms) : Number(valor) || 0) * (Number(c.p) || 0)) / 100;
}
