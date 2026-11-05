// Formação de preço do produto: tudo o que entra na compra (custo real) e tudo
// o que sai do preço de venda (impostos, comissões, taxas, despesas e lucro).
//
// Compra  → custo de aquisição = preço do fornecedor − desconto + impostos na
//           compra (IPI, ICMS-ST, DIFAL…) + frete/seguro/outros − créditos.
// Venda   → preço = custo ÷ (1 − (encargos sobre a venda % + margem %)).
//           Cada encargo é um % do PREÇO DE VENDA (é assim que imposto e
//           comissão incidem), por isso o cálculo é por divisor e não por
//           multiplicador sobre o custo.
// Campos não preenchidos no produto usam o padrão da empresa.

export type CampoCompra =
  | "desconto_pct" | "ipi_pct" | "st_pct" | "difal_pct" | "outros_impostos_compra_pct"
  | "frete_compra_pct" | "seguro_pct" | "frete_compra_rs" | "outros_compra_rs"
  | "credito_icms_pct" | "credito_pis_cofins_pct";
export type CampoVenda =
  | "simples_pct" | "icms_venda_pct" | "pis_pct" | "cofins_pct" | "irpj_csll_pct" | "iss_pct" | "difal_venda_pct"
  | "comissao_vendedor_pct" | "comissao_parceiro_pct" | "taxa_cartao_pct" | "frete_venda_pct" | "instalacao_pct"
  | "garantia_pct" | "despesas_fixas_pct" | "outros_venda_pct";
export type CampoFormacao = CampoCompra | CampoVenda | "margem_pct";

/** O que fica guardado no produto (vazio = usa o padrão da empresa). */
export type Formacao = Partial<Record<CampoFormacao, number>> & {
  preco_fornecedor?: number;
  /** "margem": o preço sai da margem desejada; "manual": o preço é digitado e a margem é o resultado */
  modo?: "margem" | "manual";
  preco_manual?: number;
  obs?: string;
  atualizado_em?: string;
};
export type Padroes = Partial<Record<CampoFormacao, number>>;

type Def = { k: CampoFormacao; rot: string; ajuda: string; rs?: boolean };
export const CAMPOS_COMPRA: { grupo: string; campos: Def[] }[] = [
  { grupo: "Negociação", campos: [
    { k: "desconto_pct", rot: "Desconto do fornecedor", ajuda: "Desconto sobre a tabela do fornecedor (volume, pagamento à vista…)" },
  ] },
  { grupo: "Impostos na compra", campos: [
    { k: "ipi_pct", rot: "IPI", ajuda: "IPI destacado na nota de compra (vira custo para quem revende sem crédito)" },
    { k: "st_pct", rot: "ICMS-ST / antecipação", ajuda: "Substituição tributária ou antecipação do ICMS paga na entrada (as tabelas costumam dizer “ST não inclusa”)" },
    { k: "difal_pct", rot: "DIFAL na entrada", ajuda: "Diferencial de alíquota de compras de outros estados (ex.: faturado do ES com ICMS 4%)" },
    { k: "outros_impostos_compra_pct", rot: "Outros impostos na compra", ajuda: "Qualquer outro imposto que entra no custo (importação, FCP…). Produtos do Zenith trazem aqui o % de impostos de lá." },
  ] },
  { grupo: "Frete e despesas da compra", campos: [
    { k: "frete_compra_pct", rot: "Frete de compra (%)", ajuda: "Frete FOB/despacho como % do valor comprado" },
    { k: "frete_compra_rs", rot: "Frete de compra por unidade", ajuda: "Frete fixo por unidade, em R$", rs: true },
    { k: "seguro_pct", rot: "Seguro / embalagem (%)", ajuda: "Seguro de transporte, embalagem, despachante" },
    { k: "outros_compra_rs", rot: "Outros custos por unidade", ajuda: "Acessórios, cabos, suportes ou qualquer custo fixo que acompanha o item, em R$", rs: true },
  ] },
  { grupo: "Créditos (só para quem recupera)", campos: [
    { k: "credito_icms_pct", rot: "Crédito de ICMS", ajuda: "Só para Lucro Presumido/Real que aproveita o crédito. No Simples Nacional deixe zero." },
    { k: "credito_pis_cofins_pct", rot: "Crédito de PIS/COFINS", ajuda: "Só no Lucro Real (não cumulativo). Senão, zero." },
  ] },
];
export const CAMPOS_VENDA: { grupo: string; campos: Def[] }[] = [
  { grupo: "Impostos sobre a venda", campos: [
    { k: "simples_pct", rot: "Simples Nacional (alíquota efetiva)", ajuda: "DAS sobre o faturamento. Se usar Simples, os campos de ICMS/PIS/COFINS/IRPJ ficam em zero." },
    { k: "icms_venda_pct", rot: "ICMS na venda", ajuda: "Lucro Presumido/Real: ICMS próprio da saída (descontado o que já foi pago por ST)" },
    { k: "difal_venda_pct", rot: "DIFAL na venda", ajuda: "Venda para consumidor final de outro estado" },
    { k: "pis_pct", rot: "PIS", ajuda: "0,65% no presumido (cumulativo) ou 1,65% no real" },
    { k: "cofins_pct", rot: "COFINS", ajuda: "3% no presumido ou 7,6% no real" },
    { k: "irpj_csll_pct", rot: "IRPJ + CSLL", ajuda: "No presumido de comércio, cerca de 2,28% sobre a receita" },
    { k: "iss_pct", rot: "ISS", ajuda: "Só se o item for faturado como serviço (instalação/programação embutida)" },
  ] },
  { grupo: "Comissões", campos: [
    { k: "comissao_vendedor_pct", rot: "Comissão do vendedor", ajuda: "% sobre a venda" },
    { k: "comissao_parceiro_pct", rot: "Comissão do arquiteto / parceiro", ajuda: "RT / indicação sobre a venda" },
  ] },
  { grupo: "Custos da venda", campos: [
    { k: "taxa_cartao_pct", rot: "Taxa de cartão / financeira", ajuda: "Maquininha, parcelamento, antecipação, boleto" },
    { k: "frete_venda_pct", rot: "Frete de entrega", ajuda: "Entrega até a obra" },
    { k: "instalacao_pct", rot: "Instalação embutida", ajuda: "Se o preço do produto já cobre a mão de obra de instalar" },
    { k: "garantia_pct", rot: "Reserva de garantia / assistência", ajuda: "Trocas, visitas de garantia e assistência" },
  ] },
  { grupo: "Estrutura", campos: [
    { k: "despesas_fixas_pct", rot: "Despesas fixas (rateio)", ajuda: "Aluguel, showroom, equipe, sistemas… como % do faturamento" },
    { k: "outros_venda_pct", rot: "Outros sobre a venda", ajuda: "Inadimplência, marketing, qualquer outro %" },
  ] },
];
export const TODOS_CAMPOS: Def[] = [...CAMPOS_COMPRA, ...CAMPOS_VENDA].flatMap((g) => g.campos)
  .concat([{ k: "margem_pct", rot: "Margem de lucro desejada", ajuda: "Lucro líquido que sobra depois de todos os custos, % do preço de venda" }]);
const VENDA: CampoVenda[] = CAMPOS_VENDA.flatMap((g) => g.campos.map((c) => c.k as CampoVenda));

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const v = (f: Formacao, p: Padroes, k: CampoFormacao) => { const x = f[k] ?? p[k]; return Number.isFinite(x) ? Number(x) : 0; };

export type Calculo = {
  base: number;            // preço do fornecedor com desconto
  impostosCompra: number;  // R$
  despesasCompra: number;  // R$
  creditos: number;        // R$
  custo: number;           // custo de aquisição por unidade
  encargosPct: number;     // soma dos % sobre a venda (sem margem)
  preco: number;           // preço de venda
  encargos: number;        // R$ dos encargos sobre o preço
  lucro: number;           // R$ por unidade
  margemPct: number;       // lucro ÷ preço
  markup: number;          // preço ÷ custo (o "multiplicador" do Zenith)
  /** quanto cada encargo de venda leva, para o detalhamento */
  partes: { k: CampoFormacao; rot: string; valor: number }[];
  erro: string | null;
};

export function calcular(f: Formacao, p: Padroes = {}): Calculo {
  const forn = Math.max(0, Number(f.preco_fornecedor) || 0);
  const base = forn * (1 - v(f, p, "desconto_pct") / 100);
  const impostosCompra = base * (v(f, p, "ipi_pct") + v(f, p, "st_pct") + v(f, p, "difal_pct") + v(f, p, "outros_impostos_compra_pct")) / 100;
  const despesasCompra = base * (v(f, p, "frete_compra_pct") + v(f, p, "seguro_pct")) / 100 + v(f, p, "frete_compra_rs") + v(f, p, "outros_compra_rs");
  const creditos = base * (v(f, p, "credito_icms_pct") + v(f, p, "credito_pis_cofins_pct")) / 100;
  const custo = r2(Math.max(0, base + impostosCompra + despesasCompra - creditos));
  const encargosPct = VENDA.reduce((s, k) => s + v(f, p, k), 0);
  let preco: number, erro: string | null = null;
  if (f.modo === "manual") preco = r2(Math.max(0, Number(f.preco_manual) || 0));
  else {
    const div = 1 - (encargosPct + v(f, p, "margem_pct")) / 100;
    if (div <= 0.01) { erro = "Encargos + margem passam de 99% do preço: reduza algum percentual."; preco = 0; }
    else preco = r2(custo / div);
  }
  const encargos = r2(preco * encargosPct / 100);
  const lucro = r2(preco - encargos - custo);
  const partes = TODOS_CAMPOS.filter((c) => VENDA.includes(c.k as CampoVenda) && v(f, p, c.k)).map((c) => ({ k: c.k, rot: c.rot, valor: r2(preco * v(f, p, c.k) / 100) }));
  return {
    base: r2(base), impostosCompra: r2(impostosCompra), despesasCompra: r2(despesasCompra), creditos: r2(creditos), custo, encargosPct: r2(encargosPct * 100) / 100,
    preco, encargos, lucro, margemPct: preco ? r2((lucro / preco) * 100) : 0, markup: custo ? Math.round((preco / custo) * 10000) / 10000 : 0, partes, erro,
  };
}

/** Formação inicial de um produto que ainda não tem (veio do Zenith): mantém o preço atual. */
export function formacaoInicial(p: { valor_compra: number; impostos_pct: number; preco_venda: number; formacao?: Formacao | null }): Formacao {
  if (p.formacao && Object.keys(p.formacao).length) return p.formacao;
  return { preco_fornecedor: p.valor_compra || 0, outros_impostos_compra_pct: p.impostos_pct || 0, modo: "manual", preco_manual: p.preco_venda || 0 };
}

/** Colunas do produto que acompanham a formação (o orçamento usa custo e preco_venda). */
export function colunasDoCalculo(f: Formacao, c: Calculo) {
  const forn = Number(f.preco_fornecedor) || 0;
  return {
    formacao: { ...f, atualizado_em: new Date().toISOString() },
    valor_compra: r2(forn), custo: c.custo, preco_venda: c.preco,
    impostos_pct: forn ? Math.round(((c.custo / forn) - 1) * 10000) / 100 : 0,
    fator_venda: c.markup || null,
  };
}
