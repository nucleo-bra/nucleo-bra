"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown } from "lucide-react";
import { Bloco, Selo, Shell, Vazio } from "@/components/Shell";
import { carregarPainel, formatarData, formatarReais, formatarReaisCurto, Painel } from "@/lib/dados";
import { mensagemErro } from "@/lib/supabase";

const ETAPAS = [
  { chave: "propostas_abertas", rotulo: "Em proposta", dica: "Propostas enviadas aguardando o cliente" },
  { chave: "notas_emitidas_mes", rotulo: "Faturado no mês", dica: "Notas fiscais emitidas neste mês" },
  { chave: "a_receber", rotulo: "A receber", dica: "Títulos em aberto" },
  { chave: "recebido_mes", rotulo: "Recebido no mês", dica: "Pagamentos confirmados neste mês" },
] as const;

function diasAte(iso: string) {
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  return Math.round((new Date(iso + "T12:00:00").getTime() - hoje.getTime()) / 86_400_000);
}

export default function PainelPagina() {
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => { carregarPainel().then(setP).catch((e) => setErro(mensagemErro(e))); }, []);

  const dia = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const hoje = dia.charAt(0).toUpperCase() + dia.slice(1);

  return (
    <Shell titulo="Painel" acoes={
      <Link href="/importar/" className="inline-flex items-center gap-2 rounded-lg bg-br px-4 py-2 text-[14px] font-medium text-white hover:bg-br-escuro">
        <FileDown className="size-4" /> Importar documento
      </Link>
    }>
      <p className="-mt-3 mb-6 text-[14px] text-suave">{hoje}</p>
      {erro && <p role="alert" className="mb-6 rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p>}

      {/* A cadeia do dinheiro: de proposta a recebido */}
      <section aria-label="Cadeia do dinheiro" className="mb-6 overflow-hidden rounded-xl bg-marinho-900 text-white">
        <ol className="grid grid-cols-2 lg:grid-cols-4">
          {ETAPAS.map((e, i) => {
            const valor = p?.cadeia[e.chave] ?? 0;
            return (
              <li key={e.chave} className="relative border-marinho-800 px-5 py-6 lg:px-7 lg:py-8 [&:not(:last-child)]:lg:border-r [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0 [&:nth-child(odd)]:border-r">
                <div className="mb-3 flex items-center gap-2 text-[13px] text-[#a9b4cc]">
                  <span className={`size-2 rounded-full ${i === 3 ? "bg-ok" : i === 0 ? "bg-br" : "bg-ciano"}`} />
                  {e.rotulo}
                </div>
                <div className="num font-display text-[26px] font-semibold tracking-tight lg:text-[32px]">
                  {p ? formatarReaisCurto(valor) : "—"}
                </div>
                <div className="mt-1 text-[12px] text-marinho-500">{e.dica}</div>
                {i < 3 && (
                  <svg className="absolute top-1/2 -right-[9px] z-10 hidden size-[18px] -translate-y-1/2 lg:block" viewBox="0 0 18 18" aria-hidden>
                    <circle cx="9" cy="9" r="8.5" fill="#0f1a33" stroke="#22355f" />
                    <path d="M7 5.5 L10.5 9 L7 12.5" fill="none" stroke="#2bb3d9" strokeWidth="1.5" />
                  </svg>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Bloco titulo="Próximos recebimentos" extra={
          p && p.financeiro.vencido > 0 ? <span className="text-[13px] font-medium text-erro">{formatarReais(p.financeiro.vencido)} vencido</span> : null
        }>
          {!p?.vencimentos.length ? <Vazio>Nenhum título em aberto. Importe o XML de uma NF para começar.</Vazio> : (
            <ul className="divide-y divide-linha">
              {p.vencimentos.map((t) => {
                const d = diasAte(t.vencimento);
                return (
                  <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className={`w-14 shrink-0 text-center ${d < 0 ? "text-erro" : d <= 7 ? "text-atencao" : "text-suave"}`}>
                      <div className="num font-display text-[20px] font-semibold leading-none">{Math.abs(d)}</div>
                      <div className="text-[11px]">{d < 0 ? "dias atraso" : d === 0 ? "hoje" : "dias"}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium">{t.cliente}</div>
                      <div className="truncate text-[13px] text-suave">{t.descricao} · vence {formatarData(t.vencimento)}</div>
                    </div>
                    <div className="num text-right text-[15px] font-semibold">{formatarReais(t.valor)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Vendas por sistema" extra={<span className="text-[12px] text-suave">propostas ativas</span>}>
          {!p?.sistemas.length ? <Vazio>Importe uma proposta do Zenith para ver o mix de vendas.</Vazio> : (
            <ul className="space-y-3 px-5 py-4">
              {p.sistemas.map((s) => {
                const max = p.sistemas[0].valor;
                return (
                  <li key={s.sistema}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span>{s.sistema}</span><span className="num text-suave">{formatarReais(s.valor)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-fundo">
                      <div className="h-2 rounded-full bg-ciano" style={{ width: `${(s.valor / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Faturamento mensal">
          {!p?.faturamento.length ? <Vazio>Sem notas emitidas ainda.</Vazio> : (
            <div className="h-60 px-2 py-4">
              <ResponsiveContainer>
                <BarChart data={p.faturamento.map((f) => ({ ...f, rotulo: new Date(f.mes + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" }) }))}>
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={12} stroke="#5b6680" />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#5b6680" width={70}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR")} mil` : String(v))} />
                  <Tooltip cursor={{ fill: "#f2f4f8" }} formatter={(v) => [formatarReais(Number(v ?? 0)), "Faturado"]} />
                  <Bar dataKey="faturado" fill="#16264a" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Bloco>

        <Bloco titulo="Propostas recentes">
          {!p?.propostas.length ? <Vazio>Nenhuma proposta importada.</Vazio> : (
            <ul className="divide-y divide-linha">
              {p.propostas.map((pr) => (
                <li key={pr.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{pr.titulo}</div>
                    <div className="text-[13px] text-suave">Nº {pr.numero}{pr.versao ? ` ${pr.versao}` : ""} · {formatarData(pr.data_emissao)}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[14px] font-semibold">{formatarReais(pr.total_final)}</div>
                    <Selo status={pr.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>
    </Shell>
  );
}
