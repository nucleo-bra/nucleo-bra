import { describe, expect, it } from "vitest";
import { conferencia, conteudoInicial, distribuirDatas, Doc, Etapa, etapaAtrasada, fimGarantia, ItemObra, Obra, preverClassificacao, preenchimento, Saida } from "../src/lib/obras";
import { definicaoDocumentacao, definicaoTermo } from "../src/lib/obra-pdf";
import { lerColagem } from "../src/components/obras/editores";
import { COLUNAS } from "../src/lib/obras";

const item = (produto_id: string, q: number, custo = 10, sistema = "Automação"): ItemObra => ({ id: "i" + produto_id + q, obra_id: "o", proposta_item_id: null, produto_id, ordem: 0, sistema, descricao: "Prod " + produto_id, sku: null, marca: "C4", unidade: "un", quantidade: q, custo_unit: custo });
const saida = (produto_id: string, q: number, cl: Saida["classificacao"] = "vendido", tipo: Saida["tipo"] = "saida"): Saida => ({ id: Math.random().toString(), obra_id: "o", produto_id, tipo, quantidade: q, classificacao: cl, substitui_item: null, justificativa: null, custo_unit: 10, revisado_em: null, created_by: null, created_at: "2026-11-10T10:00:00Z" });

describe("materiais da obra", () => {
  it("classifica a saída: vendido, excedente, fora do orçamento e substituto", () => {
    const itens = [item("a", 3)];
    expect(preverClassificacao(itens, [], "a", 2)).toBe("vendido");
    expect(preverClassificacao(itens, [saida("a", 2)], "a", 1)).toBe("vendido");
    expect(preverClassificacao(itens, [saida("a", 2)], "a", 2)).toBe("excedente");
    expect(preverClassificacao(itens, [], "b", 1)).toBe("nao_vendido");
    expect(preverClassificacao(itens, [], "b", 1, "ia3")).toBe("substituto");
    // devolução abate do que saiu
    expect(preverClassificacao(itens, [saida("a", 3), saida("a", 1, "devolucao", "devolucao")], "a", 1)).toBe("vendido");
  });
  it("monta a conferência vendido × saído", () => {
    const c = conferencia([item("a", 3), item("b", 1)], [saida("a", 3), saida("b", 2, "excedente"), saida("x", 1, "nao_vendido")]);
    const por = Object.fromEntries(c.map((l) => [l.chave, l]));
    expect(por.a.situacao).toBe("ok");
    expect(por.b.situacao).toBe("excedente");
    expect(por.b.saldo).toBe(-1);
    expect(por.x.situacao).toBe("fora");
    expect(por.a.custoVendido).toBe(30);
  });
});

describe("cronograma", () => {
  const et = (id: string): Etapa => ({ id, obra_id: "o", nome: id, posicao: 0, inicio_prev: null, fim_prev: null, inicio_real: null, fim_real: null, responsavel: null, observacao: null });
  it("distribui as datas sem sobrepor e termina na entrega", () => {
    const L = distribuirDatas([et("a"), et("b"), et("c"), et("d")], "2026-11-02", "2026-11-29");
    expect(L[0].inicio_prev).toBe("2026-11-02");
    expect(L[3].fim_prev).toBe("2026-11-29");
    for (let i = 1; i < L.length; i++) expect(L[i].inicio_prev! > L[i - 1].fim_prev!).toBe(true);
  });
  it("etapa atrasada e garantia", () => {
    expect(etapaAtrasada({ fim_prev: "2026-11-01", fim_real: null }, "2026-11-10")).toBe(true);
    expect(etapaAtrasada({ fim_prev: "2026-11-01", fim_real: "2026-11-02" }, "2026-11-10")).toBe(false);
    expect(fimGarantia({ entregue_em: "2026-11-10", garantia_meses: 12 })).toBe("2027-11-10");
  });
});

describe("documentação", () => {
  it("lê colagem do Excel", () => {
    const L = lerColagem("101\tPlafom Lavanderia\n102\tLustre Sala\n", COLUNAS.circuitos);
    expect(L).toHaveLength(2);
    expect(L[1]).toMatchObject({ circuito: "102", ambiente: "Lustre Sala" });
  });
  const obra: Obra = { id: "o", numero: 7, titulo: "Casa Alphaville", cliente_id: null, cliente_nome: "Fernando Floriano", endereco: "Rua A, 30", telefone: null, contrato_id: null, oportunidade_id: null, proposta_id: null, quadro_id: null,
    status: "andamento", inicio: null, previsao_entrega: null, entregue_em: null, garantia_meses: 12, responsaveis: [], valor_contrato: null, observacoes: null, link_arquivos: "https://exemplo.com/pasta", termo_path: null, created_at: "", updated_at: "" };
  const doc = (modelo: Doc["modelo"], grupo: string, conteudo: unknown, incluir = true): Doc => ({ id: modelo + grupo, obra_id: "o", modelo, grupo, titulo: modelo, posicao: 1, status: "aprovado", incluir, conteudo, updated_at: "", atualizado_por: null });
  it("gera o caderno: capa nova, capítulos por sistema, senhas mascaradas e QR", () => {
    const circ = conteudoInicial("circuitos", "Sistema de Automação");
    circ.blocos[0].linhas[0] = { id: "l1", circuito: "306", ambiente: "Spots Hall Suíte" };
    const rel = conteudoInicial("relacao", "Relação dos equipamentos");
    rel.blocos[0].linhas = [{ id: "r1", equipamento: "Router", ip: "10.72.10.1" }];
    const docs = [
      doc("capa", "Apresentação", {}), doc("objetivo", "Apresentação", conteudoInicial("objetivo", "Apresentação")),
      doc("circuitos", "Sistema de Automação", circ), doc("pulsadores", "Sistema de Automação", conteudoInicial("pulsadores", "Sistema de Automação")),
      doc("senhas", "Usuários e senhas", { contas: [{ id: "s1", servico: "Conta Control4", site: "", usuario: "cliente@x.com" }] }),
      doc("relacao", "Relação dos equipamentos", rel), doc("encerramento", "Encerramento", conteudoInicial("encerramento", "Encerramento")),
    ];
    const d = definicaoDocumentacao(obra, docs, {}, { comSenhas: false, senhas: { "senha:s1": "Segredo123", "tab:relacaoRelação dos equipamentos:r1:senha": "x" }, imagens: {}, capa: "capa" });
    const t = JSON.stringify(d.content);
    expect(t).toContain("Fernando Floriano");
    expect(t).toContain("03 — OBJETIVO DO DOCUMENTO");
    expect(t).toContain("SISTEMA DE AUTOMAÇÃO");
    expect(t).toContain("Spots Hall Suíte");
    expect(t).not.toContain("Segredo123");
    expect(t).toContain("••••••");
    expect(t).toContain("https://exemplo.com/pasta");
    expect(t).not.toContain("Tabela de pulsadores");   // vazio não entra
    const c = JSON.stringify(definicaoDocumentacao(obra, docs, {}, { comSenhas: true, senhas: { "senha:s1": "Segredo123" }, imagens: {}, capa: "capa" }).content);
    expect(c).toContain("Segredo123");
  });
  it("termo de entrega com garantia", () => {
    const t = JSON.stringify(definicaoTermo(obra, {}, ["Automação", "Rede"], "Matheus Esturrari").content);
    expect(t).toContain("12 meses");
    expect(t).toContain("Matheus Esturrari");
    expect(t).toContain("Automação");
  });
  it("progresso do cartão", () => {
    expect(preenchimento({ modelo: "objetivo", conteudo: { texto: "x" } })).toBe(1);
    expect(preenchimento({ modelo: "cenas", conteudo: { caixas: [] } })).toBe(0);
  });
});
