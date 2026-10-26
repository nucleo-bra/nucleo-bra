// Leitor de propostas comerciais geradas pelo Zenith Gestor 360 (PDF).
// Recebe as linhas de texto já extraídas (com a posição vertical) e
// reconstrói sistemas, itens e totais — e confere todas as contas.
import { Alerta, Centavos, dataBrParaIso, moedaParaCentavos } from "./util";
import type { LinhaPdf } from "./pdf-texto";

export type ItemProposta = {
  sistema: string;
  tipo: "produto" | "servico";
  descricao: string;
  detalhe?: string;
  sku?: string;
  quantidade: number;
  unidade: string;
  valor_unitario: Centavos;
  valor_total: Centavos;
  pagina: number;
};

export type PropostaLida = {
  numero: string;
  versao?: string;
  titulo: string;
  cliente_nome: string;
  projeto_nome?: string;
  data_emissao: string;
  itens: ItemProposta[];
  sistemas: { nome: string; produtos: Centavos; servicos: Centavos; total: Centavos }[];
  total_produtos: Centavos;
  total_servicos: Centavos;
  total_itens: Centavos;
  total_final: Centavos;
  condicoes_pagamento?: string;
  alertas: Alerta[];
};

const RE_QTD = /^(\d+(?:[.,]\d+)?)\s+(Unidade|Par|Metro|Kit|Rolo|Pe[çc]a|Caixa|Conjunto|Hora)\(?\w*\)?\s+Unit\.\s*R\$\s*([\d.,]+)\s+Total\s+R\$\s*([\d.,]+)/i;
const UNIDADES: Record<string, string> = { unidade: "un", par: "par", metro: "m", kit: "kit", rolo: "rolo", peça: "pç", peca: "pç", caixa: "cx", conjunto: "cj", hora: "h" };

export function lerPropostaZenith(linhas: LinhaPdf[]): PropostaLida {
  const alertas: Alerta[] = [];
  // remove rodapé com nº de página
  const L = linhas.filter((l) => !(l.y < 30 && /^\d+(\s+\d+)?$/.test(l.texto)));

  // ---------- capa ----------
  const capa = L.filter((l) => l.pagina === 1);
  const dataCapa = capa.find((l) => /^\d{2}\/\d{2}\/\d{4}$/.test(l.texto));
  const numeroCapa = capa.find((l) => /^\d{1,6}$/.test(l.texto));
  const tituloCapa = capa.find((l) => l !== dataCapa && l !== numeroCapa && l.texto.length > 3);
  if (!dataCapa || !numeroCapa || !tituloCapa) throw new Error("Capa da proposta não reconhecida — este PDF foi gerado pelo Zenith?");

  const titulo = tituloCapa.texto;
  const versao = titulo.match(/\bV(\d+)\s*$/i)?.[0].toUpperCase().trim();
  const semVersao = titulo.replace(/\s*-\s*V\d+\s*$/i, "");
  const [cliente_nome, projeto_nome] = semVersao.split("|").map((s) => s.trim());

  // ---------- corpo ----------
  const itens: ItemProposta[] = [];
  const sistemas: PropostaLida["sistemas"] = [];
  let sistema = "";
  let tipo: "produto" | "servico" = "produto";
  let bloco: LinhaPdf[] = [];
  let totalSistema: { nome: string; valores: Record<string, Centavos> } | null = null;
  let total_final: Centavos | null = null;
  let condicoes: string | undefined;
  let modoResumo = false;

  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    if (l.pagina === 1) continue;
    const t = l.texto;

    if (/^Total por ambiente\/sistema:?$/i.test(t)) { modoResumo = true; continue; }
    const tf = t.match(/^Total final:\s*R\$\s*([\d.,]+)/i);
    if (tf) { total_final = moedaParaCentavos(tf[1]); continue; }
    if (/^Condi[çc][õo]es de pagamento:?$/i.test(t)) {
      condicoes = L[i + 1]?.texto.replace(/\s*R\$\s*[\d.,]+$/, "").trim();
      i++; continue;
    }
    if (modoResumo) continue;

    // cabeçalho de totais do sistema
    const ts = t.match(/^Total\s+(.+?):$/i);
    if (ts) { totalSistema = { nome: ts[1], valores: {} }; bloco = []; continue; }
    if (totalSistema) {
      const v = t.match(/^(Produtos|Servi[çc]os|Total):\s*R\$\s*([\d.,]+)/i);
      if (v) {
        const k = v[1].toLowerCase().startsWith("p") ? "produtos" : v[1].toLowerCase().startsWith("s") ? "servicos" : "total";
        totalSistema.valores[k] = moedaParaCentavos(v[2]);
        if (k === "total") {
          sistemas.push({ nome: sistema, produtos: totalSistema.valores.produtos ?? 0, servicos: totalSistema.valores.servicos ?? 0, total: totalSistema.valores.total });
          totalSistema = null;
        }
        continue;
      }
    }

    // "Produtos:" / "Serviços:" (sozinhos) definem o tipo; a linha anterior é o sistema
    if (/^Produtos:$/i.test(t) || /^Servi[çc]os:$/i.test(t)) {
      tipo = /^Produtos/i.test(t) ? "produto" : "servico";
      const anterior = bloco.at(-1);
      if (anterior && anterior.texto === anterior.texto.toUpperCase()) {
        sistema = titulizar(anterior.texto);
      }
      bloco = [];
      continue;
    }

    const q = t.match(RE_QTD);
    if (q) {
      if (!bloco.length) { alertas.push({ nivel: "erro", mensagem: `Item sem nome na página ${l.pagina}.` }); continue; }
      // título = linhas até o primeiro espaço vertical maior (o título fica separado da descrição)
      let corte = 1;
      while (corte < bloco.length && Math.abs(bloco[corte - 1].y - bloco[corte].y) < 20 && bloco[corte].pagina === bloco[corte - 1].pagina) corte++;
      const nome = bloco.slice(0, corte).map((b) => b.texto).join(" ").trim();
      const detalhe = bloco.slice(corte).map((b) => b.texto).join(" ").trim();
      const qtd = Number(q[1].replace(",", "."));
      const unit = moedaParaCentavos(q[3]);
      const tot = moedaParaCentavos(q[4]);
      if (Math.abs(Math.round(qtd * unit) - tot) > 1)
        alertas.push({ nivel: "erro", mensagem: `"${nome}": ${qtd} × unitário não bate com o total da linha.` });
      const sku = extrairSku(nome);
      itens.push({
        sistema: sistema || "Geral", tipo, descricao: sku ? nome.replace(/^.+?\s+-\s+/, "") : nome,
        detalhe: /^Sem descri/i.test(detalhe) ? undefined : detalhe || undefined, sku,
        quantidade: qtd, unidade: UNIDADES[q[2].toLowerCase()] ?? "un",
        valor_unitario: unit, valor_total: tot, pagina: l.pagina,
      });
      bloco = [];
      continue;
    }
    bloco.push(l);
  }

  // ---------- conferência ----------
  const soma = (f: (i: ItemProposta) => boolean) => itens.filter(f).reduce((s, i) => s + i.valor_total, 0);
  const total_itens = soma(() => true);
  for (const s of sistemas) {
    const calc = soma((i) => i.sistema === s.nome);
    if (calc !== s.total) alertas.push({ nivel: "erro", mensagem: `Sistema ${s.nome}: itens somam ${(calc / 100).toFixed(2)}, o PDF diz ${(s.total / 100).toFixed(2)}.` });
  }
  if (total_final === null) {
    alertas.push({ nivel: "atencao", mensagem: "Total final não encontrado — usando a soma dos itens." });
    total_final = total_itens;
  } else if (total_final < total_itens) {
    const desc = total_itens - total_final;
    alertas.push({ nivel: "info", mensagem: `Desconto de ${(desc / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${((desc / total_itens) * 100).toFixed(2)}%) sobre a soma dos itens.` });
  } else if (total_final > total_itens) {
    alertas.push({ nivel: "atencao", mensagem: "Total final MAIOR que a soma dos itens — confira." });
  }
  const semDescricao = itens.filter((i) => !i.detalhe).map((i) => i.descricao);
  if (semDescricao.length)
    alertas.push({ nivel: "info", mensagem: `${semDescricao.length} ${semDescricao.length > 1 ? "itens estão" : "item está"} sem descrição no Zenith: ${semDescricao.join("; ")}.` });
  if (!itens.length) alertas.push({ nivel: "erro", mensagem: "Nenhum item encontrado." });

  return {
    numero: numeroCapa.texto, versao, titulo, cliente_nome, projeto_nome,
    data_emissao: dataBrParaIso(dataCapa.texto),
    itens, sistemas,
    total_produtos: soma((i) => i.tipo === "produto"),
    total_servicos: soma((i) => i.tipo === "servico"),
    total_itens, total_final, condicoes_pagamento: condicoes, alertas,
  };
}

function titulizar(s: string) {
  const menores = new Set(["de", "da", "do", "e"]);
  return s.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && menores.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}

/** "C4- 21309 - Control4 Controladora Core 1" → "C4-21309" */
function extrairSku(nome: string): string | undefined {
  const m = nome.match(/^(.{3,24}?)\s+-\s+/);
  if (!m) return undefined;
  const cand = m[1].replace(/-\s+/g, "-");
  // código de fabricante: sem espaços internos, com letra e número (C4-21309, C4-T4IW10-BL)
  return /^[A-Z0-9][A-Z0-9\-./]+$/.test(cand) && /\d/.test(cand) && /[A-Z]/.test(cand) ? cand : undefined;
}
