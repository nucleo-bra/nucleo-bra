"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clapperboard, Package, Sparkles } from "lucide-react";
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
  const chave = useSearchParams().get("m") ?? "";
  const m = MODULOS[chave] ?? MODULOS.financeiro;
  const Icone = chave === "marketing" ? Clapperboard : Package;
  return (
    <Shell titulo={m.titulo} cheio>
      <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-8">
        <section className="relative mb-5 max-w-3xl overflow-hidden rounded-[20px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul p-6 text-white shadow-[0_24px_50px_-24px_rgba(14,26,61,.8)] lg:p-8">
          <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.3),transparent_70%)]" aria-hidden />
          <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
          <div className="relative flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20"><Icone className="size-7 text-ciano" /></span>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-br/90 px-2.5 py-0.5 text-[11.5px] font-bold tracking-wide uppercase"><Sparkles className="size-3.5" />Em breve · {m.fase}</div>
              <h1 className="mt-2 font-display text-[26px] font-extrabold lg:text-[30px]">{m.titulo}</h1>
              <p className="mt-1 max-w-lg text-[14px] text-white/75">O banco de dados deste módulo já está pronto. As telas entram nesta fase, no mesmo padrão do restante do Núcleo.</p>
            </div>
          </div>
        </section>
        <Bloco titulo="O que vem neste módulo" className="max-w-3xl">
          <ul className="grid gap-2 px-5 py-5 text-[14px] sm:grid-cols-2">
            {m.itens.map((i) => <li key={i} className="flex gap-3 rounded-xl bg-fundo px-3.5 py-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ciano" />{i}</li>)}
          </ul>
        </Bloco>
      </div>
    </Shell>
  );
}

export default function Modulo() {
  return <Suspense><Conteudo /></Suspense>;
}
