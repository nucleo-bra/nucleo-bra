"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Bloco, Shell } from "@/components/Shell";

const MODULOS: Record<string, { titulo: string; fase: string; itens: string[] }> = {
  financeiro: {
    titulo: "Financeiro", fase: "Fase 2 — migração do sistema financeiro atual",
    itens: ["Contas a receber e a pagar com baixa de pagamento", "Faturamento por mês, trimestre, semestre e ano",
      "Comissões de vendedores e parceiros com fechamento", "Botão Cobrar pelo WhatsApp", "Importação dos dados do sistema financeiro atual (v38)"],
  },
  crm: {
    titulo: "CRM", fase: "Fase 2 — migração do sistema comercial atual",
    itens: ["Funil: lead, qualificação, proposta, negociação, ganho", "Parceiros (arquitetos, construtoras) com clientes vinculados e comissões",
      "Agenda semanal, follow-ups e anotações de reunião", "Origem de cada lead para medir o marketing"],
  },
  contratos: {
    titulo: "Contratos", fase: "Fase 4",
    itens: ["Contrato gerado a partir da proposta aprovada", "Status: enviado, assinado, encerrado", "Pasta digital do cliente no OneDrive"],
  },
  estoque: {
    titulo: "Estoque", fase: "Fase 3",
    itens: ["Catálogo de produtos e marcas", "Entradas, saídas e reservas por obra", "Alerta de estoque mínimo", "Importação da planilha do Zenith"],
  },
  marketing: {
    titulo: "Marketing", fase: "Fase 5",
    itens: ["Acervo de vídeos, fotos e renders com busca por sistema, marca e obra", "Modo apresentação para o showroom",
      "Campanhas: investimento × leads × vendas fechadas", "Métricas do Instagram e Meta Ads"],
  },
};

function Conteudo() {
  const m = MODULOS[useSearchParams().get("m") ?? ""] ?? MODULOS.financeiro;
  return (
    <Shell titulo={m.titulo}>
      <Bloco titulo={m.fase} className="max-w-2xl">
        <ul className="space-y-2.5 px-5 py-5 text-[14px]">
          {m.itens.map((i) => <li key={i} className="flex gap-3"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-ciano" />{i}</li>)}
        </ul>
        <p className="border-t border-linha px-5 py-3.5 text-[13px] text-suave">O banco de dados deste módulo já está pronto; as telas entram nesta fase.</p>
      </Bloco>
    </Shell>
  );
}

export default function Modulo() {
  return <Suspense><Conteudo /></Suspense>;
}
