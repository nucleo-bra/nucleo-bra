"use client";
// Histórico: quem mudou o quê e quando, a partir da tabela "auditoria".
import { modoDemo, supabase } from "./supabase";

export type Registro = { id: number; tabela: string; registro_id: string | null; acao: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null; usuario_id: string | null; ocorrido_em: string };

export const AREAS: [string, string, string[]][] = [
  ["clientes", "Clientes", ["clientes", "contatos", "documentos"]],
  ["crm", "CRM", ["oportunidades", "atividades", "parceiros", "comissionados"]],
  ["orcamentos", "Orçamentos", ["propostas", "proposta_itens"]],
  ["contratos", "Contratos", ["contratos", "contrato_modelos"]],
  ["financeiro", "Financeiro", ["fin_docs", "titulos", "notas_fiscais", "comissoes", "titulo_comissoes", "comissao_fechamentos", "categorias_financeiras", "importacoes"]],
  ["tecnico", "Técnico", ["cartoes", "cartao_checklist", "cartao_comentarios", "cartao_anexos", "quadros", "quadro_listas", "quadro_etiquetas", "projetos", "tecnicos", "obras", "obra_etapas", "obra_docs", "obra_itens", "obra_saidas", "obra_segredos"]],
  ["produtos", "Produtos e estoque", ["produtos", "servicos", "estoque_movimentos", "catalogos", "base_conhecimento"]],
  ["acessos", "Acessos e equipe", ["acessos", "perfis", "config_empresa"]],
];
const NOME_TABELA: Record<string, string> = {
  clientes: "Cliente", contatos: "Contato", documentos: "Arquivo", oportunidades: "Negócio", atividades: "Atividade", parceiros: "Parceiro", comissionados: "Comissionado",
  propostas: "Orçamento", proposta_itens: "Item de orçamento", contratos: "Contrato", contrato_modelos: "Modelo de contrato", fin_docs: "Lançamento", titulos: "Boleto / título",
  notas_fiscais: "Nota fiscal", comissoes: "Comissão", titulo_comissoes: "Comissão do título", comissao_fechamentos: "Fechamento de comissão", categorias_financeiras: "Categoria financeira",
  importacoes: "Importação", cartoes: "Cartão", cartao_checklist: "Checklist", cartao_comentarios: "Comentário", cartao_anexos: "Anexo", quadros: "Quadro", quadro_listas: "Lista do quadro",
  quadro_etiquetas: "Etiqueta", projetos: "Projeto", tecnicos: "Técnico", produtos: "Produto", servicos: "Serviço", estoque_movimentos: "Movimento de estoque", catalogos: "Catálogo",
  obras: "Obra", obra_etapas: "Etapa da obra", obra_docs: "Documento da obra", obra_itens: "Item vendido da obra", obra_saidas: "Saída de material", obra_segredos: "Senha da obra",
  base_conhecimento: "Base de conhecimento", acessos: "Acesso", perfis: "Usuário", config_empresa: "Dados da empresa", midias: "Mídia", campanhas: "Campanha", campanha_metricas: "Métrica",
};
export const nomeTabela = (t: string) => NOME_TABELA[t] ?? t;

export function verbo(r: Registro) {
  switch (r.acao) {
    case "INSERT": return "criou"; case "UPDATE": return "alterou"; case "DELETE": return "excluiu";
    case "VIU": return "viu as senhas"; case "LOGIN": return "entrou no sistema"; case "LOGOUT": return "saiu do sistema";
    case "MFA_ATIVADO": return "ativou a verificação em duas etapas"; case "MFA_REMOVIDO": return "desativou a verificação em duas etapas";
    case "MFA_ZERADO": return "zerou a verificação em duas etapas de"; default: return r.acao.toLowerCase();
  }
}

/** Nome legível do registro (cliente, negócio, lançamento…). */
export function rotuloRegistro(r: Registro): string {
  const o = (r.depois ?? r.antes ?? {}) as Record<string, unknown>;
  const d = (o.dados ?? {}) as Record<string, unknown>;
  const v = (k: unknown) => (typeof k === "string" || typeof k === "number" ? String(k) : "");
  const num = v(o.numero);
  const base = v(o.nome_fantasia) || v(o.nome) || v(o.titulo) || v(o.descricao) || v(d.desc) || v(o.texto)?.slice(0, 60) || v(o.arquivo_nome) || v(o.fornecedor) || v(o.cliente_nome);
  const extra = r.tabela === "fin_docs" ? [v(d.who), d.valor != null ? `R$ ${Number(d.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""].filter(Boolean).join(" · ") : "";
  return [num && !base.includes(num) ? `nº ${num}` : "", base, extra].filter(Boolean).join(" · ") || (r.registro_id ? `#${r.registro_id.slice(0, 8)}` : "");
}

const IGNORAR = new Set(["updated_at", "editado_em", "created_at", "posicao", "atualizado_em", "busca", "sha256", "id"]);
const fmt = (x: unknown): string => {
  if (x === null || x === undefined || x === "") return "vazio";
  if (typeof x === "boolean") return x ? "sim" : "não";
  if (typeof x === "object") { const s = JSON.stringify(x); return s.length > 80 ? s.slice(0, 77) + "…" : s; }
  const s = String(x);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return s.length > 80 ? s.slice(0, 77) + "…" : s;
};
export const rotuloCampo = (k: string) => k.replace(/^dados\./, "").replace(/_id$/, "").replace(/_/g, " ");

/** Campos que mudaram numa alteração (inclusive dentro de "dados" do Financeiro). */
export function mudancas(r: Registro): { campo: string; de: string; para: string }[] {
  if (r.acao !== "UPDATE" || !r.antes || !r.depois) return [];
  const out: { campo: string; de: string; para: string }[] = [];
  const comparar = (a: Record<string, unknown>, b: Record<string, unknown>, pre = "") => {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (IGNORAR.has(k)) continue;
      if (k === "dados" && a[k] && b[k] && typeof a[k] === "object" && typeof b[k] === "object") { comparar(a[k] as Record<string, unknown>, b[k] as Record<string, unknown>, "dados."); continue; }
      if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) out.push({ campo: pre + k, de: fmt(a[k]), para: fmt(b[k]) });
    }
  };
  comparar(r.antes, r.depois);
  return out;
}

export async function carregarHistorico(f: { desde: string; usuario?: string; tabelas?: string[]; acao?: string; registro?: string }, de = 0, ate = 199): Promise<Registro[]> {
  if (modoDemo) return [];
  let q = supabase().from("auditoria").select("*").gte("ocorrido_em", f.desde).order("ocorrido_em", { ascending: false }).range(de, ate);
  if (f.usuario) q = q.eq("usuario_id", f.usuario);
  if (f.tabelas?.length) q = q.in("tabela", f.tabelas);
  if (f.acao === "LOGIN") q = q.in("acao", ["LOGIN", "LOGOUT"]);
  else if (f.acao) q = q.eq("acao", f.acao);
  if (f.registro) q = q.eq("registro_id", f.registro);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Registro[];
}
