"use client";
// Vendas: tudo o que foi fechado, por mês, trimestre, semestre e ano —
// comparativos, funil, previsão, parceiros, clientes e comissões.
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Handshake, Target, TrendingUp, Trophy, Users, Wallet } from "lucide-react";
import type { Crm, EtapaNegocio } from "@/lib/crm";
import { ETAPAS_NEGOCIO } from "@/lib/crm";
import { acumuladoAno, dataFechamento, Grao, indiceDe, indiceHoje, limites, previsao, QTD_SERIE, resumir, rotuloPeriodo, serie } from "@/lib/vendas";
import { AZUL, Cartao, CIANO, curto, dataBr, LARANJA, reais, Titulo } from "./ui";
import type { Acoes } from "./visoes";
import { COR_ETAPA } from "./visoes";

const GRAOS: [Grao, string, string][] = [["m", "Mensal", "mês"], ["t", "Trimestral", "trimestre"], ["s", "Semestral", "semestre"], ["a", "Anual", "ano"]];
const eixo = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mi` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`);

function Variacao({ v, rot }: { v: number | null; rot: string }) {
  if (v == null) return <span className="text-white/55">sem base {rot}</span>;
  const sobe = v >= 0;
  return <span className={`inline-flex items-center gap-0.5 font-semibold ${sobe ? "text-[#7ef0b0]" : "text-[#ff9c94]"}`}>{sobe ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{pct(v)} {rot}</span>;
}

function Seletor({ g, setG, i, setI }: { g: Grao; setG: (g: Grao) => void; i: number; setI: (i: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl bg-white/10 p-1 ring-1 ring-white/15">
        {GRAOS.map(([k, l]) => <button key={k} onClick={() => setG(k)} className={`rounded-lg px-3 py-1 text-[12.5px] font-semibold ${g === k ? "bg-white text-marinho-900" : "text-white/75 hover:text-white"}`}>{l}</button>)}
      </div>
      <div className="inline-flex items-center rounded-xl bg-white/10 ring-1 ring-white/15">
        <button className="p-1.5 text-white/80 hover:text-white" onClick={() => setI(i - 1)} aria-label="Período anterior"><ChevronLeft className="size-4" /></button>
        <span className="min-w-[100px] text-center text-[13px] font-bold">{rotuloPeriodo(i, g)}</span>
        <button className="p-1.5 text-white/80 hover:text-white" onClick={() => setI(i + 1)} aria-label="Próximo período"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}

function DicaValor({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-linha bg-white px-3 py-2 text-[12.5px] shadow-xl">
      <div className="mb-1 font-bold">{label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: p.color }} /><span className="text-suave">{p.name}</span><b className="num ml-auto pl-3">{p.dataKey === "qtd" ? p.value : reais(p.value)}</b></div>
      ))}
    </div>
  );
}

/** Gráfico de fechamentos com Mensal/Trimestral/Semestral/Anual (usado em Clientes / negócios). */
export function GraficoFechamentos({ crm, onAbrir, altura = 260 }: { crm: Crm; onAbrir?: () => void; altura?: number }) {
  const [g, setG] = useState<Grao>("m");
  const fim = indiceHoje(g);
  const dados = useMemo(() => serie(crm.negocios, g, fim), [crm, g, fim]);
  const total = dados.reduce((s, p) => s + p.valor, 0), qtd = dados.reduce((s, p) => s + p.qtd, 0);
  return (
    <Cartao>
      <Titulo extra={
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-fundo p-1">
            {GRAOS.map(([k, l]) => <button key={k} onClick={() => setG(k)} className={`rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${g === k ? "bg-marinho-900 text-white" : "text-suave"}`}>{l}</button>)}
          </div>
          {onAbrir && <button onClick={onAbrir} className="inline-flex items-center gap-1 rounded-xl border border-azul px-3 py-1.5 text-[12.5px] font-semibold text-azul hover:bg-[#eef3fb]"><BarChart3 className="size-3.5" />Painel de vendas</button>}
        </div>
      }>Fechamentos</Titulo>
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 pb-1 text-[13px] text-suave">
        <span>Últimos {QTD_SERIE[g]} {GRAOS.find(([k]) => k === g)![2].replace(/^m[eê]s$/, "meses").replace(/^trimestre$/, "trimestres").replace(/^semestre$/, "semestres").replace(/^ano$/, "anos")}: <b className="num text-tinta">{reais(total)}</b></span>
        <span><b className="num text-tinta">{qtd}</b> negócio(s) fechado(s)</span>
      </div>
      <div className="px-2 pb-3" style={{ height: altura }}>
        <ResponsiveContainer>
          <ComposedChart data={dados} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs><linearGradient id="gFech" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CIANO} /><stop offset="100%" stopColor={AZUL} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#e2e8f3" />
            <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" />
            <YAxis yAxisId="v" tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" width={48} tickFormatter={eixo} />
            <YAxis yAxisId="q" orientation="right" hide />
            <Tooltip content={<DicaValor />} cursor={{ fill: "rgba(47,111,181,.06)" }} />
            {g !== "a" && <Bar yAxisId="v" dataKey="anoAnterior" name="Ano anterior" fill="#d9e1ee" radius={[4, 4, 0, 0]} isAnimationActive={false} />}
            <Bar yAxisId="v" dataKey="valor" name="Fechado" fill="url(#gFech)" radius={[5, 5, 0, 0]} isAnimationActive={false} />
            <Line yAxisId="q" dataKey="qtd" name="Negócios" stroke={LARANJA} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Cartao>
  );
}

// ================================================================== página
export function PainelVendas({ crm, ac }: { crm: Crm; ac: Acoes }) {
  const [g, setGBruto] = useState<Grao>("m");
  const [i, setI] = useState(indiceHoje("m"));
  const setG = (x: Grao) => { setGBruto(x); setI(indiceHoje(x)); };
  const N = crm.negocios;
  const r = useMemo(() => resumir(N, g, i), [N, g, i]);
  const dados = useMemo(() => serie(N, g, i), [N, g, i]);
  const { de, ate } = limites(i, g);
  const ano = Number(de.slice(0, 4));
  const acum = useMemo(() => acumuladoAno(N, ano), [N, ano]);
  const prev = useMemo(() => previsao(N, g, Math.max(i, indiceHoje(g)), 6), [N, g, i]);
  const fechados = useMemo(() => N.filter((x) => x.etapa === "ganho" && indiceDe(dataFechamento(x), g) === i).sort((a, b) => dataFechamento(b).localeCompare(dataFechamento(a))), [N, g, i]);
  const perdidos = useMemo(() => N.filter((x) => x.etapa === "perdido" && indiceDe(dataFechamento(x), g) === i), [N, g, i]);
  const abertos = N.filter((x) => !["ganho", "perdido"].includes(x.etapa));
  const nomeParc = (id: string | null) => crm.parceiros.find((p) => p.id === id)?.nome ?? "";

  // no ano do período: rankings
  const doAno = N.filter((x) => x.etapa === "ganho" && dataFechamento(x).startsWith(String(ano)));
  const ranking = (chave: (x: (typeof N)[number]) => string) => {
    const m = new Map<string, { v: number; q: number }>();
    for (const x of doAno) { const k = chave(x); if (!k) continue; const s = m.get(k) ?? { v: 0, q: 0 }; s.v += x.valor_estimado; s.q++; m.set(k, s); }
    return [...m].map(([k, s]) => ({ k, ...s })).sort((a, b) => b.v - a.v).slice(0, 6);
  };
  const topParceiros = ranking((x) => nomeParc(x.parceiro_id) || "Sem parceiro");
  const topClientes = ranking((x) => x.cliente_nome || x.titulo);
  const totalAno = doAno.reduce((s, x) => s + x.valor_estimado, 0);
  const funil = ETAPAS_NEGOCIO.filter(([k]) => k !== "perdido").map(([k, rot]) => {
    const L = N.filter((x) => (k === "lead" ? ["lead", "qualificacao"].includes(x.etapa) : x.etapa === k));
    return { k: k as EtapaNegocio, rot, qtd: L.length, valor: L.reduce((s, x) => s + x.valor_estimado, 0) };
  });
  const maxFunil = Math.max(1, ...funil.map((f) => f.valor));
  const melhor = dados.reduce((m, p) => (p.valor > m.valor ? p : m), dados[0]);
  const media = dados.length ? dados.reduce((s, p) => s + p.valor, 0) / dados.length : 0;
  const nomeGrao = GRAOS.find(([k]) => k === g)![2];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5">
      {/* herói */}
      <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul p-5 text-white shadow-[0_24px_50px_-24px_rgba(14,26,61,.8)] lg:p-7">
        <div className="pointer-events-none absolute -top-28 -right-24 size-96 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.3),transparent_70%)]" aria-hidden />
        <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11.5px] font-semibold tracking-[.16em] text-ciano uppercase"><TrendingUp className="size-4" />Vendas · {rotuloPeriodo(i, g)}</div>
            <div className="mt-1 text-[13px] text-white/70">Vendido no {nomeGrao} ({dataBr(de)} a {dataBr(ate)})</div>
            <div className="num font-display text-[34px] leading-none font-extrabold tracking-tight lg:text-[46px]">{reais(r.vendido)}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <Variacao v={r.varAnterior} rot={`vs ${nomeGrao} anterior`} />
              {g !== "a" && <Variacao v={r.varAno} rot="vs ano anterior" />}
            </div>
          </div>
          <Seletor g={g} setG={setG} i={i} setI={setI} />
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-2 lg:grid-cols-6">
          {([
            ["Fechamentos", String(r.qtd), `${r.perdidos} perdido(s)`],
            ["Ticket médio", curto(r.ticket), "por negócio fechado"],
            ["Conversão", r.conversao == null ? "—" : `${Math.round(r.conversao)}%`, "ganhos ÷ (ganhos + perdidos)"],
            ["Pipeline aberto", curto(abertos.reduce((s, x) => s + x.valor_estimado, 0)), `${abertos.length} negócio(s)`],
            ["Minha comissão", curto(r.comissaoMinha), "sobre o fechado"],
            ["Parceiros", curto(r.comissaoParceiros), `${curto(r.aPagarParceiros)} a pagar`],
          ] as const).map(([t, v, d]) => (
            <div key={t} className="rounded-2xl bg-white/[.08] px-4 py-3 ring-1 ring-white/10">
              <div className="text-[11.5px] font-semibold text-white/65">{t}</div>
              <div className="num truncate font-display text-[21px] font-extrabold">{v}</div>
              <div className="truncate text-[11.5px] text-white/55">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* gráfico principal */}
      <Cartao>
        <Titulo extra={<span className="text-[12.5px] text-suave">melhor {nomeGrao}: <b className="text-tinta">{melhor?.rot} · {curto(melhor?.valor ?? 0)}</b> · média {curto(media)}</span>}>
          Fechamento {GRAOS.find(([k]) => k === g)![1].toLowerCase()} · últimos {QTD_SERIE[g]}
        </Titulo>
        <div className="h-[320px] px-2 pb-3">
          <ResponsiveContainer>
            <ComposedChart data={dados} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs><linearGradient id="gVend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CIANO} /><stop offset="100%" stopColor={AZUL} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#e2e8f3" />
              <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={12} stroke="#66738f" />
              <YAxis yAxisId="v" tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" width={50} tickFormatter={eixo} />
              <YAxis yAxisId="q" orientation="right" tickLine={false} axisLine={false} fontSize={11.5} stroke={LARANJA} width={28} allowDecimals={false} />
              <Tooltip content={<DicaValor />} cursor={{ fill: "rgba(47,111,181,.06)" }} />
              {g !== "a" && <Bar yAxisId="v" dataKey="anoAnterior" name="Mesmo período do ano anterior" fill="#d9e1ee" radius={[4, 4, 0, 0]} isAnimationActive={false} />}
              <Bar yAxisId="v" dataKey="valor" name="Fechado" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {dados.map((p) => <Cell key={p.i} fill={p.i === i ? "url(#gVend)" : "#7fa6d8"} />)}
              </Bar>
              <Line yAxisId="q" dataKey="qtd" name="Negócios" stroke={LARANJA} strokeWidth={2.5} dot={{ r: 3.5 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-4 px-5 pb-4 text-[12px] text-suave">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: AZUL }} />Fechado (o período escolhido em destaque)</span>
          {g !== "a" && <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[#d9e1ee]" />Mesmo período do ano anterior</span>}
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded" style={{ background: LARANJA }} />Quantidade de negócios</span>
        </div>
      </Cartao>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 xl:grid-cols-2">
        {/* acumulado */}
        <Cartao>
          <Titulo extra={<span className="text-[12.5px] text-suave">{ano}: <b className="num text-tinta">{reais(totalAno)}</b></span>}>Acumulado do ano × {ano - 1}</Titulo>
          <div className="h-[240px] px-2 pb-3">
            <ResponsiveContainer>
              <AreaChart data={acum} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs><linearGradient id="gAcum" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={AZUL} stopOpacity={0.35} /><stop offset="100%" stopColor={AZUL} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#e2e8f3" />
                <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" />
                <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" width={50} tickFormatter={eixo} />
                <Tooltip content={<DicaValor />} />
                <Area dataKey="anterior" name={String(ano - 1)} stroke="#a3adc2" strokeDasharray="5 4" fill="transparent" strokeWidth={2} isAnimationActive={false} />
                <Area dataKey="atual" name={String(ano)} stroke={AZUL} fill="url(#gAcum)" strokeWidth={2.5} isAnimationActive={false} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
        {/* funil */}
        <Cartao>
          <Titulo extra={<button onClick={() => ac.aba("negocios")} className="text-[12.5px] font-semibold text-azul hover:underline">Abrir quadro</button>}>Funil atual</Titulo>
          <ul className="space-y-2.5 px-5 pb-5">
            {funil.map((f) => (
              <li key={f.k}>
                <div className="mb-1 flex items-baseline gap-2 text-[13px]"><span className="size-2.5 rounded-full" style={{ background: COR_ETAPA[f.k] }} /><span className="flex-1 font-semibold">{f.rot}</span><span className="text-[12px] text-suave">{f.qtd} negócio(s)</span><span className="num w-24 text-right font-bold">{curto(f.valor)}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-fundo"><div className="h-full rounded-full" style={{ width: `${Math.max(f.valor ? 2 : 0, (f.valor / maxFunil) * 100)}%`, background: COR_ETAPA[f.k] }} /></div>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>

      {/* previsão */}
      <Cartao>
        <Titulo extra={<span className="text-[12.5px] text-suave">pela data prevista de cada negócio aberto · o primeiro inclui os atrasados</span>}>Previsão de fechamento · próximos 6 {nomeGrao === "mês" ? "meses" : nomeGrao === "ano" ? "anos" : nomeGrao + "s"}</Titulo>
        <div className="h-[240px] px-2 pb-3">
          <ResponsiveContainer>
            <BarChart data={prev} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f3" />
              <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" />
              <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" width={50} tickFormatter={eixo} />
              <Tooltip content={<DicaValor />} cursor={{ fill: "rgba(47,111,181,.06)" }} />
              {(["lead", "proposta", "negociacao", "fechamento"] as const).map((k, j, A) => (
                <Bar key={k} dataKey={k} stackId="p" name={ETAPAS_NEGOCIO.find(([e]) => e === k)?.[1] ?? k} fill={COR_ETAPA[k]} radius={j === A.length - 1 ? [5, 5, 0, 0] : 0} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Cartao>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 xl:grid-cols-3">
        {([[topParceiros, "Parceiros que mais trouxeram", Handshake], [topClientes, "Maiores clientes", Users]] as const).map(([L, t, I]) => (
          <Cartao key={t}>
            <Titulo extra={<span className="text-[12px] text-suave">em {ano}</span>}>{t}</Titulo>
            <ol className="space-y-2 px-5 pb-5">
              {L.map((x, j) => (
                <li key={x.k} className="flex items-center gap-3">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-[12px] font-extrabold ${j === 0 ? "bg-gradient-to-br from-[#f7c948] to-[#e8890c] text-white" : "bg-fundo text-suave"}`}>{j === 0 ? <Trophy className="size-3.5" /> : j + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-semibold">{x.k}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-fundo"><span className="block h-full rounded-full" style={{ width: `${(x.v / Math.max(1, L[0].v)) * 100}%`, background: `linear-gradient(90deg, ${CIANO}, ${AZUL})` }} /></span></span>
                  <span className="text-right"><span className="num block text-[13px] font-bold">{curto(x.v)}</span><span className="block text-[11px] text-suave">{x.q} negócio(s)</span></span>
                </li>
              ))}
              {!L.length && <li className="flex items-center gap-2 text-[13px] text-suave"><I className="size-4" />Nenhum fechamento em {ano}.</li>}
            </ol>
          </Cartao>
        ))}
        <Cartao>
          <Titulo>Comissões · {rotuloPeriodo(i, g)}</Titulo>
          <div className="space-y-3 px-5 pb-5">
            {([["Minha comissão", r.comissaoMinha, AZUL, Wallet], ["Parceiros (total)", r.comissaoParceiros, LARANJA, Handshake], ["Parceiros a pagar", r.aPagarParceiros, "#d63a2f", Target], ["Perdido no período", r.valorPerdido, "#9aa5bd", ArrowDownRight]] as const).map(([t, v, cor, I]) => (
              <div key={t} className="flex items-center gap-3 rounded-xl bg-fundo/70 px-3 py-2.5">
                <span className="grid size-8 place-items-center rounded-lg text-white" style={{ background: cor }}><I className="size-4" /></span>
                <span className="flex-1 text-[13px] font-semibold">{t}</span><span className="num text-[14px] font-extrabold">{reais(v)}</span>
              </div>
            ))}
          </div>
        </Cartao>
      </div>

      {/* lista do período */}
      <Cartao>
        <Titulo extra={<span className="text-[12.5px] text-suave">{fechados.length} fechado(s) · {perdidos.length} perdido(s)</span>}>Negócios fechados · {rotuloPeriodo(i, g)}</Titulo>
        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead><tr className="border-b border-linha text-left text-[11.5px] font-bold tracking-wide text-suave uppercase">
              <th className="px-5 py-2">Data</th><th className="px-2 py-2">Nº</th><th className="px-2 py-2">Cliente / projeto</th><th className="px-2 py-2">Parceiro</th><th className="px-2 py-2 text-right">Comissões</th><th className="px-5 py-2 text-right">Valor</th>
            </tr></thead>
            <tbody>
              {fechados.map((x) => (
                <tr key={x.id} onClick={() => ac.ficha(x.id)} className="cursor-pointer border-b border-linha last:border-0 hover:bg-fundo/60">
                  <td className="num px-5 py-2.5">{dataBr(dataFechamento(x))}</td>
                  <td className="num px-2 py-2.5 font-semibold">{x.numero ?? "—"}</td>
                  <td className="px-2 py-2.5 font-semibold">{x.cliente_nome || x.titulo}{x.cliente_nome && x.titulo && x.titulo !== x.cliente_nome && <span className="block text-[12px] font-normal text-suave">{x.titulo}</span>}</td>
                  <td className="px-2 py-2.5 text-suave">{nomeParc(x.parceiro_id) || "—"}</td>
                  <td className="num px-2 py-2.5 text-right text-suave">{reais((x.valor_estimado * (x.pct_vendedor + x.pct_parceiro)) / 100)}</td>
                  <td className="num px-5 py-2.5 text-right font-bold">{reais(x.valor_estimado)}</td>
                </tr>
              ))}
              {!fechados.length && <tr><td colSpan={6} className="px-5 py-8 text-center text-suave">Nenhum negócio fechado neste {nomeGrao}.</td></tr>}
            </tbody>
            {fechados.length > 0 && <tfoot><tr className="border-t-2 border-linha font-extrabold"><td className="px-5 py-2.5" colSpan={5}>Total</td><td className="num px-5 py-2.5 text-right">{reais(r.vendido)}</td></tr></tfoot>}
          </table>
        </div>
        {perdidos.length > 0 && (
          <div className="border-t border-linha px-5 py-3">
            <div className="mb-1.5 text-[12px] font-bold tracking-wide text-suave uppercase">Perdidos no período</div>
            <ul className="flex flex-wrap gap-2">
              {perdidos.map((x) => <li key={x.id}><button onClick={() => ac.ficha(x.id)} className="rounded-lg bg-fundo px-2.5 py-1 text-[12.5px] hover:text-azul"><b>{x.cliente_nome || x.titulo}</b> · {curto(x.valor_estimado)}{x.motivo_perda ? ` · ${x.motivo_perda}` : ""}</button></li>)}
            </ul>
          </div>
        )}
      </Cartao>
      <p className="px-1 text-[12px] text-suave">Fechado = negócios na etapa “Fechado” do CRM, pela data em que foram fechados. Valores pelo valor do negócio.</p>
    </div>
  );
}
