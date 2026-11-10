// Lembrete mensal dos catálogos: no começo de cada mês, conferir as tabelas
// com os fornecedores. Um catálogo está em dia quando foi conferido (ou teve o
// arquivo trocado) a partir do dia 1º do mês atual.
export const MESES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const inicioDoMes = (agora = new Date()) => iso(new Date(agora.getFullYear(), agora.getMonth(), 1));

export function catalogosPendentes<T extends { conferido_em: string | null }>(L: T[], agora = new Date()): T[] {
  const ini = inicioDoMes(agora);
  return L.filter((c) => !c.conferido_em || c.conferido_em < ini);
}
