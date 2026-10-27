"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, ChevronRight, Clapperboard, FileDown, FileSignature,
  Handshake, MapPin, SquareKanban, Package, Percent, Receipt, Users, Wallet,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { formatarData, formatarReais } from "@/lib/dados";
import { carregarComercial, carregarDadosFinanceiro, Comercial, resumir, Resumo, resumoContratos } from "@/lib/painel";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";
import { resumoProjetos } from "@/lib/projetos";

const AZUL = "#2f6fb5", LARANJA = "#f5821f", MARINHO = "#19295a";
const curto = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`
  : v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : formatarReais(v);
const eixo = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

function Cartao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`sombra-bra rounded-[18px] border border-linha bg-white ${className}`}>{children}</section>;
}
function Titulo({ children, extra, href }: { children: React.ReactNode; extra?: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="flex items-center gap-2.5 text-[15px] font-bold">
        <span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" aria-hidden />{children}
      </h2>
      {extra}
      {href && <Link href={href} className="flex items-center text-[12.5px] font-semibold text-azul hover:underline">Abrir <ChevronRight className="size-3.5" /></Link>}
    </div>
  );
}
function Kpi({ rotulo, valor, detalhe, cor, tom = "" }: { rotulo: string; valor: string; detalhe?: React.ReactNode; cor: string; tom?: string }) {
  return (
    <Cartao className="relative overflow-hidden px-5 py-4 pl-6">
      <span className="absolute top-3.5 bottom-3.5 left-0 w-[5px] rounded-r-md" style={{ background: cor }} aria-hidden />
      <div className="text-[12.5px] font-semibold text-suave">{rotulo}</div>
      <div className={`num mt-0.5 font-display text-[19px] font-extrabold tracking-tight sm:text-[23px] lg:text-[25px] ${tom}`}>{valor}</div>
      {detalhe && <div className="mt-1 text-[12px] text-suave">{detalhe}</div>}
    </Cartao>
  );
}
function Barra({ valor, max, cor = `linear-gradient(90deg, ${LARANJA}, #d63a2f)` }: { valor: number; max: number; cor?: string }) {
  return <div className="h-2.5 overflow-hidden rounded-full bg-linha"><div className="h-full rounded-full" style={{ width: `${max ? Math.max(2, (valor / max) * 100) : 0}%`, background: cor }} /></div>;
}
function Dica({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + Number(p.value), 0);
  return (
    <div className="rounded-xl border border-white/15 bg-marinho-950/95 px-3 py-2 text-[12px] leading-relaxed text-white shadow-xl">
      <div className="mb-0.5 font-semibold capitalize">{label}</div>
      {payload.map((p) => <div key={p.name} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}: <b className="num">{formatarReais(Number(p.value))}</b></div>)}
      {payload.length > 1 && <div className="mt-0.5 border-t border-white/15 pt-0.5">Total: <b className="num">{formatarReais(total)}</b></div>}
    </div>
  );
}
function Legenda({ itens }: { itens: [string, string][] }) {
  return <div className="flex flex-wrap gap-4 px-5 text-[12px] text-suave">{itens.map(([n, c]) => <span key={n} className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: c }} />{n}</span>)}</div>;
}

export default function Home() {
  const [r, setR] = useState<Resumo | null>(null);
  const [com, setCom] = useState<Comercial | null>(null);
  const [proj, setProj] = useState<Awaited<ReturnType<typeof resumoProjetos>> | null>(null);
  const [ctr, setCtr] = useState<Awaited<ReturnType<typeof resumoContratos>> | null>(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    carregarDadosFinanceiro().then((d) => setR(resumir(d))).catch((e) => setErro(mensagemErro(e)));
    carregarComercial().then(setCom).catch(() => {});
    resumoProjetos().then(setProj).catch(() => {});
    resumoContratos().then(setCtr).catch(() => {});
    if (!modoDemo) supabase().auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase().from("perfis").select("nome").eq("id", data.user.id).single();
      if (p?.nome) setNome(p.nome.split(" ")[0]);
    });
  }, []);

  const agora = new Date();
  const saudacao = agora.getHours() < 12 ? "Bom dia" : agora.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const dia0 = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dia = dia0.charAt(0).toUpperCase() + dia0.slice(1);
  const mesNome = agora.toLocaleDateString("pt-BR", { month: "long" });

  const alertas = useMemo(() => {
    if (!r) return [];
    const a: { icone: typeof Wallet; texto: React.ReactNode; tom: string }[] = [];
    if (r.atrasado) a.push({ icone: AlertTriangle, tom: "text-erro", texto: <><b>{r.atrasadoQtd} parcela(s) em atraso</b> somando {formatarReais(r.atrasado)}</> });
    if (r.prox7.qtd) a.push({ icone: CalendarClock, tom: "text-atencao", texto: <><b>{r.prox7.qtd} vencimento(s)</b> nos próximos 7 dias: {formatarReais(r.prox7.valor)}</> });
    const aFechar = r.comissoesMes.reduce((s, c) => s + c.aFechar, 0);
    if (aFechar) a.push({ icone: Percent, tom: "text-azul", texto: <><b>{formatarReais(aFechar)}</b> de comissões de {mesNome} a fechar</> });
    if (com?.crm.hoje) a.push({ icone: CalendarClock, tom: "text-br", texto: <><b>{com.crm.hoje} compromisso(s)</b> hoje no CRM</> });
    if (com?.crm.followups) a.push({ icone: Handshake, tom: "text-azul", texto: <><b>{com.crm.followups} follow-up(s)</b> para retornar</> });
    if (proj?.atrasados) a.push({ icone: AlertTriangle, tom: "text-erro", texto: <><b>{proj.atrasados} cartão(ões) atrasado(s)</b> nos Projetos</> });
    if (proj?.meus) a.push({ icone: SquareKanban, tom: "text-azul", texto: <><b>{proj.meus} cartão(ões) seu(s)</b> para hoje nos Projetos</> });
    if (com?.propostas.qtd) a.push({ icone: Handshake, tom: "text-ciano", texto: <><b>{com.propostas.qtd} proposta(s)</b> aguardando o cliente: {curto(com.propostas.valor)}</> });
    if (!a.length) a.push({ icone: Wallet, tom: "text-ok", texto: <>Tudo em dia. Nenhuma pendência para hoje.</> });
    return a;
  }, [r, com, proj, mesNome]);

  const m = r;
  const pctRec = m && m.previstoMes ? (m.recebidoMes / m.previstoMes) * 100 : 0;
  const delta = m && m.recebidoMesAnt ? ((m.recebidoMes - m.recebidoMesAnt) / m.recebidoMesAnt) * 100 : null;

  return (
    <Shell titulo="Painel" cheio>
      <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-8">
        {erro && <p role="alert" className="mb-5 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}

        {/* topo */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[24px] font-extrabold tracking-tight lg:text-[28px]">{saudacao}{nome ? `, ${nome}` : ""}</h1>
            <p className="text-[14px] font-medium text-suave">{dia}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/importar/" className="inline-flex items-center gap-2 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13.5px] font-semibold hover:shadow-md"><FileDown className="size-4" /> Importar</Link>
            <Link href="/financeiro/" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[13.5px] font-semibold text-white hover:shadow-lg"><Wallet className="size-4" /> Financeiro</Link>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 xl:grid-cols-3">
          {/* herói do mês */}
          <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul p-6 text-white shadow-[0_24px_50px_-24px_rgba(14,26,61,.8)] xl:col-span-2 lg:p-7">
            <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.3),transparent_70%)]" aria-hidden />
            <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white/70">Recebido em {mesNome}</div>
                <div className="num font-display text-[34px] font-extrabold tracking-tight lg:text-[42px]">{m ? formatarReais(m.recebidoMes) : "—"}</div>
                {delta !== null && (
                  <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${delta >= 0 ? "bg-ok/25 text-[#7df0ad]" : "bg-erro/25 text-[#ffb2aa]"}`}>
                    {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                    {Math.abs(delta).toFixed(0)}% vs mês anterior
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px] sm:grid-cols-3">
                <div><div className="text-white/65">Previsto no mês</div><div className="num font-display text-[18px] font-bold">{m ? curto(m.previstoMes) : "—"}</div></div>
                <div><div className="text-white/65">A receber (total)</div><div className="num font-display text-[18px] font-bold">{m ? curto(m.aberto + m.atrasado) : "—"}</div></div>
                <div><div className="text-white/65">Recebido no ano</div><div className="num font-display text-[18px] font-bold">{m ? curto(m.recebidoAno) : "—"}</div></div>
              </div>
            </div>
            <div className="relative mt-6">
              <div className="mb-2 flex justify-between text-[12.5px] text-white/75">
                <span>Mês: {pctRec.toFixed(0)}% do previsto recebido</span><span className="num">{m ? `${m.lancamentos} lançamentos` : ""}</span>
              </div>
              <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-white/15">
                {m && m.previstoMes > 0 && <>
                  <i className="block h-full bg-[#5be39b]" style={{ width: `${(m.recebidoMes / Math.max(m.previstoMes, m.recebidoMes + m.abertoMes + m.atrasadoMes)) * 100}%` }} />
                  <i className="block h-full bg-ciano" style={{ width: `${(m.abertoMes / Math.max(m.previstoMes, m.recebidoMes + m.abertoMes + m.atrasadoMes)) * 100}%` }} />
                  <i className="block h-full bg-[#ff6b5e]" style={{ width: `${(m.atrasadoMes / Math.max(m.previstoMes, m.recebidoMes + m.abertoMes + m.atrasadoMes)) * 100}%` }} />
                </>}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#5be39b]" />Recebido <b className="num">{m ? formatarReais(m.recebidoMes) : ""}</b></span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ciano" />Em aberto <b className="num">{m ? formatarReais(m.abertoMes) : ""}</b></span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#ff6b5e]" />Em atraso <b className="num">{m ? formatarReais(m.atrasadoMes) : ""}</b></span>
              </div>
            </div>
          </section>

          {/* atenção */}
          <Cartao>
            <Titulo>Atenção hoje</Titulo>
            <ul className="space-y-1 px-3 pb-4">
              {(m ? alertas : []).map((a, i) => (
                <li key={i} className="flex gap-3 rounded-xl px-2 py-2.5 text-[13.5px] hover:bg-fundo">
                  <a.icone className={`mt-0.5 size-[18px] shrink-0 ${a.tom}`} strokeWidth={2} />
                  <span>{a.texto}</span>
                </li>
              ))}
              {!m && !erro && <li className="px-2 py-3 text-[13px] text-suave">Carregando…</li>}
            </ul>
          </Cartao>

          {/* indicadores */}
          <div className="grid grid-cols-2 gap-3 lg:gap-5 xl:col-span-3 xl:grid-cols-4">
            <Kpi rotulo="A receber (em aberto)" valor={m ? curto(m.aberto) : "—"} cor={`linear-gradient(${"#22c7d6"}, ${AZUL})`} detalhe={m ? `${m.clientesAtivos} clientes com parcelas` : ""} />
            <Kpi rotulo="Em atraso" valor={m ? curto(m.atrasado) : "—"} tom={m?.atrasado ? "text-erro" : ""} cor={`linear-gradient(${LARANJA}, #d63a2f)`} detalhe={m ? (m.atrasadoQtd ? `${m.atrasadoQtd} parcela(s)` : "Nenhuma parcela atrasada") : ""} />
            <Kpi rotulo="Faturado no ano (NF)" valor={m ? curto(m.faturadoAno) : "—"} cor={`linear-gradient(#5be39b, #12a150)`} detalhe={m ? `${m.notasAno} notas emitidas` : ""} />
            <Kpi rotulo="Pontualidade (12 meses)" valor={m?.pontualidade != null ? `${m.pontualidade.toFixed(0)}%` : "—"} cor={`linear-gradient(#22c7d6, ${AZUL})`} detalhe="parcelas pagas até o vencimento" />
          </div>

          {/* fluxo */}
          <Cartao className="xl:col-span-2">
            <Titulo href="/financeiro/">Fluxo de recebimentos</Titulo>
            <Legenda itens={[["Recebido", AZUL], ["A receber", LARANJA]]} />
            <div className="h-[260px] px-1 pt-2 pb-3">
              {m && (
                <ResponsiveContainer>
                  <BarChart data={m.fluxo} barCategoryGap="22%">
                    <CartesianGrid vertical={false} stroke="#e2e8f3" />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" interval="preserveStartEnd" minTickGap={6} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" width={44} tickFormatter={eixo} />
                    <Tooltip content={<Dica />} cursor={{ fill: "rgba(47,111,181,.07)" }} />
                    <Bar dataKey="recebido" name="Recebido" stackId="a" fill={AZUL} stroke="#fff" strokeWidth={2} isAnimationActive={false} />
                    <Bar dataKey="aberto" name="A receber" stackId="a" fill={LARANJA} stroke="#fff" strokeWidth={2} isAnimationActive={false} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Cartao>

          {/* comissões */}
          <Cartao>
            <Titulo href="/financeiro/">Comissões de {mesNome}</Titulo>
            {!m ? null : !m.comissoesMes.length ? <p className="px-5 pb-5 text-[13px] text-suave">Nenhuma comissão neste mês.</p> : (
              <ul className="divide-y divide-linha px-5 pb-3">
                {m.comissoesMes.slice(0, 6).map((c) => (
                  <li key={c.nome + c.papel} className="flex items-center gap-3 py-2.5">
                    <div className="grid size-9 shrink-0 place-items-center rounded-full bg-fundo font-display text-[13px] font-bold text-marinho-900">{c.nome.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold">{c.nome}</div>
                      <div className="text-[12px] text-suave">{c.papel}{c.previsto ? ` · previsto ${formatarReais(c.previsto)}` : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-[14px] font-bold">{formatarReais(c.mes)}</div>
                      <span className={`inline-flex rounded-full px-2 py-px text-[11px] font-bold ${c.fechado ? "bg-ok-claro text-ok" : c.mes ? "bg-atencao-claro text-atencao" : "bg-fundo text-suave"}`}>{c.fechado ? "Fechado" : c.mes ? "A fechar" : "Previsto"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          {/* faturamento */}
          <Cartao className="xl:col-span-2">
            <Titulo href="/financeiro/" extra={m ? <span className="num ml-auto mr-3 text-[12.5px] text-suave">Ano: <b className="text-tinta">{formatarReais(m.faturadoAno)}</b></span> : null}>Faturamento NF</Titulo>
            <Legenda itens={[["Material", MARINHO], ["Serviço", LARANJA]]} />
            <div className="h-[230px] px-1 pt-2 pb-3">
              {m && (
                <ResponsiveContainer>
                  <BarChart data={m.faturamento} barCategoryGap="24%">
                    <CartesianGrid vertical={false} stroke="#e2e8f3" />
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" interval="preserveStartEnd" minTickGap={6} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" width={44} tickFormatter={eixo} />
                    <Tooltip content={<Dica />} cursor={{ fill: "rgba(47,111,181,.07)" }} />
                    <Bar dataKey="material" name="Material" stackId="f" fill={MARINHO} stroke="#fff" strokeWidth={2} isAnimationActive={false} />
                    <Bar dataKey="servico" name="Serviço" stackId="f" fill={LARANJA} stroke="#fff" strokeWidth={2} isAnimationActive={false} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Cartao>

          {/* comercial */}
          <Cartao>
            <Titulo href="/crm/">Comercial</Titulo>
            <div className="grid grid-cols-3 gap-2 px-5 pb-3 text-center">
              {[["Pipeline CRM", com ? curto(com.crm.pipeline) : "—"], ["Em negociação", com ? curto(com.crm.negociacao) : "—"], ["Propostas", com ? String(com.propostas.qtd) : "—"]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-fundo px-2 py-2.5"><div className="num font-display text-[17px] font-extrabold">{v}</div><div className="text-[11px] font-semibold text-suave">{k}</div></div>
              ))}
            </div>
            <ul className="divide-y divide-linha px-5 pb-3">
              {(com?.propostas.recentes ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <Receipt className="size-4 shrink-0 text-azul" />
                  <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold">{p.titulo}</div><div className="text-[12px] text-suave">Nº {p.numero} · {formatarData(p.data)}</div></div>
                  <div className="num text-[13.5px] font-bold">{curto(p.total)}</div>
                </li>
              ))}
              {com && !com.propostas.recentes.length && <li className="py-3 text-[13px] text-suave">Importe uma proposta do Zenith para acompanhar aqui.</li>}
            </ul>
          </Cartao>

          {/* próximos vencimentos */}
          <Cartao className="xl:col-span-2">
            <Titulo href="/financeiro/" extra={m ? <span className="ml-auto mr-3 text-[12.5px] text-suave">30 dias: <b className="num text-tinta">{formatarReais(m.prox30)}</b></span> : null}>Próximos vencimentos</Titulo>
            <div className="overflow-x-auto px-3 pb-3">
              <table className="w-full text-[13.5px]">
                <tbody>
                  {(m?.proximos ?? []).map((i) => (
                    <tr key={i.id} className="border-t border-linha first:border-0">
                      <td className="num px-2 py-2.5 whitespace-nowrap font-semibold">{formatarData(i.venc)}</td>
                      <td className="px-2 py-2.5"><div className="font-semibold">{i.who || i.desc}</div><div className="text-[12px] text-suave">{i.desc} {i.par}</div></td>
                      <td className="hidden px-2 py-2.5 text-suave sm:table-cell">{i.forma}</td>
                      <td className="num px-2 py-2.5 text-right font-bold whitespace-nowrap">{formatarReais(i.valor)}</td>
                      <td className="px-2 py-2.5 text-right"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${i.atrasado ? "bg-erro-claro text-erro" : "bg-atencao-claro text-atencao"}`}><span className="size-1.5 rounded-full bg-current" />{i.atrasado ? "Atrasado" : "Em aberto"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>

          {/* carteira */}
          <Cartao>
            <Titulo>Maiores saldos a receber</Titulo>
            <ul className="space-y-3 px-5 pb-5">
              {(m?.topAberto ?? []).map((c) => (
                <li key={c.nome}>
                  <div className="mb-1 flex justify-between gap-3 text-[13px]"><span className="truncate font-semibold">{c.nome}</span><span className="num shrink-0 font-bold">{formatarReais(c.aberto + c.atrasado)}</span></div>
                  <Barra valor={c.aberto + c.atrasado} max={(m?.topAberto[0].aberto ?? 0) + (m?.topAberto[0].atrasado ?? 0)} />
                </li>
              ))}
            </ul>
          </Cartao>

          {/* regiões */}
          <Cartao>
            <Titulo extra={m ? <span className="ml-auto text-[12.5px] text-suave">{m.cidadesAtendidas} cidades</span> : null}>Regiões atendidas</Titulo>
            <ul className="space-y-3 px-5 pb-5">
              {(m?.topRegioes ?? []).map((g) => (
                <li key={g.cidade + g.uf}>
                  <div className="mb-1 flex justify-between gap-3 text-[13px]"><span className="flex items-center gap-1.5 font-semibold"><MapPin className="size-3.5 text-br" />{g.cidade}/{g.uf} <span className="font-normal text-suave">· {g.clientes} cliente(s)</span></span><span className="num font-bold">{curto(g.total)}</span></div>
                  <Barra valor={g.total} max={m?.topRegioes[0].total ?? 0} cor={`linear-gradient(90deg, #22c7d6, ${AZUL})`} />
                </li>
              ))}
            </ul>
          </Cartao>

          {/* inadimplência e formas */}
          <Cartao>
            <Titulo>Saúde da carteira</Titulo>
            <div className="px-5 pb-5">
              <div className="mb-2 text-[12px] font-semibold text-suave">Atrasos por idade</div>
              <ul className="mb-4 space-y-2">
                {(m?.aging ?? []).map((a) => (
                  <li key={a.rotulo} className="grid grid-cols-[86px_1fr_auto] items-center gap-3 text-[13px]">
                    <span className="text-suave">{a.rotulo}</span><Barra valor={a.valor} max={Math.max(...(m?.aging ?? []).map((x) => x.valor), 1)} /><span className="num w-24 text-right font-semibold">{formatarReais(a.valor)}</span>
                  </li>
                ))}
              </ul>
              <div className="mb-2 text-[12px] font-semibold text-suave">A receber por forma</div>
              <div className="flex flex-wrap gap-2">
                {(m?.formas ?? []).map((f) => <span key={f.forma} className="rounded-full bg-fundo px-3 py-1 text-[12.5px]"><b>{f.forma}</b> <span className="num">{curto(f.valor)}</span></span>)}
              </div>
            </div>
          </Cartao>

          {/* módulos */}
          <Cartao>
            <Titulo>Módulos</Titulo>
            <ul className="grid grid-cols-2 gap-2 px-5 pb-5">
              {([
                ["/financeiro/", "Financeiro", Wallet, "Ativo", true],
                ["/clientes/", "Clientes", Users, com ? `${com.clientes} cadastrados` : "Ativo", true],
                ["/importar/", "Documentos", FileDown, com ? `${com.documentos} arquivos` : "Ativo", true],
                ["/crm/", "CRM", Handshake, "Ativo", true],
                ["/projetos/", "Projetos", SquareKanban, proj ? `${proj.atrasados} atrasado(s)` : "Ativo", true],
                ["/contratos/", "Contratos", FileSignature, ctr ? `${ctr.aguardando} aguardando assinatura` : "Ativo", true],
                ["/modulo/?m=estoque", "Estoque", Package, "Em construção", false],
                ["/modulo/?m=marketing", "Marketing", Clapperboard, "Em construção", false],
              ] as const).map(([href, nome, Icone, info, ativo]) => (
                <li key={href}>
                  <Link href={href} className={`flex items-center gap-2.5 rounded-xl border border-linha px-3 py-2.5 transition hover:-translate-y-px hover:shadow-md ${ativo ? "" : "opacity-70"}`}>
                    <Icone className={`size-[18px] ${ativo ? "text-azul" : "text-suave"}`} strokeWidth={1.8} />
                    <span className="min-w-0"><span className="block text-[13px] font-semibold">{nome}</span><span className="block truncate text-[11px] text-suave">{info}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>
      </div>
    </Shell>
  );
}
