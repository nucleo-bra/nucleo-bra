// Regra das comissões (a mesma do Financeiro v38): vendedores e equipe interna
// (engenheiro, projetista) comissionam sobre o valor bruto menos a comissão de
// parceiros/arquitetos do mesmo lançamento; parceiros e arquitetos, sobre o bruto.
// Ex.: R$ 50.000 com 10% do arquiteto → vendedor, Caio e Raquel sobre R$ 45.000.
export type Com = { n: string; r?: string; p: number };

export const ehVendedor = (c: Com) => !c.r || c.r === "Vendedor";
export const ehParceiroExterno = (c: Com) => c.r === "Parceiro" || c.r === "Arquiteto" || c.r === "Designer";

export function baseDoVendedor(valor: number, coms: Com[]) {
  const p = coms.filter((c) => ehParceiroExterno(c)).reduce((s, c) => s + (Number(c.p) || 0), 0);
  return (Number(valor) || 0) * (1 - p / 100);
}
/** R$ da comissão de `c` num lançamento de `valor` com as comissões `coms`. */
export function valorDaComissao(c: Com, valor: number, coms: Com[]) {
  return ((ehParceiroExterno(c) ? Number(valor) || 0 : baseDoVendedor(valor, coms)) * (Number(c.p) || 0)) / 100;
}
