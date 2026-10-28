"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft, Building2, ChevronRight, Compass, Crosshair, Eye, EyeOff, Handshake, Layers, Map as MapIcon, MapPin, Maximize2, Minimize2,
  Radar, Route, Search, Trophy, Users, Wallet,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import type { Estilo } from "@/components/mapa/mapa-leaflet";
import { agruparCidades, BASES, CidadeMapa, carregarMapa, ClienteMapa, distanciaKm, METRICAS, Metrica, valorMetrica } from "@/lib/mapa";
import { mensagemErro } from "@/lib/supabase";
import { pl } from "@/lib/texto";

const MapaLeaflet = dynamic(() => import("@/components/mapa/mapa-leaflet").then((m) => m.MapaLeaflet), {
  ssr: false, loading: () => <div className="grid h-full place-items-center text-suave">Carregando mapa…</div>,
});

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const curto = (v: number) => v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`
  : v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : reais(v);
const FAIXAS: [number, number, string][] = [[0, 25, "até 25 km"], [25, 50, "25–50 km"], [50, 100, "50–100 km"], [100, 200, "100–200 km"], [200, 1e9, "+200 km"]];

function Pilula({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${ativo ? "bg-white text-marinho-900 shadow" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>{children}</button>;
}

export default function MapaPagina() {
  const [dados, setDados] = useState<ClienteMapa[] | null>(null);
  const [erro, setErro] = useState("");
  const [metrica, setMetrica] = useState<Metrica>("total");
  const [periodo, setPeriodo] = useState<"tudo" | "12m" | "ano">("tudo");
  const [estilo, setEstilo] = useState<Estilo>("claro");
  const [aneis, setAneis] = useState(true);
  const [rotulos, setRotulos] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [cheia, setCheia] = useState(false);
  const [reaj, setReaj] = useState(0);
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState("");

  useEffect(() => { carregarMapa().then((d) => setDados(d.clientes)).catch((e) => setErro(mensagemErro(e))); }, []);
  useEffect(() => { const t = setTimeout(() => setReaj((n) => n + 1), 60); return () => clearTimeout(t); }, [cheia]);

  const todas = useMemo(() => agruparCidades(dados ?? [], periodo), [dados, periodo]);
  const cidades = useMemo(() => todas.filter((c) => !uf || c.uf === uf), [todas, uf]);
  const ordem = useMemo(() => [...cidades].sort((a, b) => valorMetrica(b, metrica) - valorMetrica(a, metrica)), [cidades, metrica]);
  const fmt = (v: number) => (metrica === "clientes" ? `${v} cliente${v === 1 ? "" : "s"}` : metrica === "obras" ? `${v} obra${v === 1 ? "" : "s"}` : curto(v));
  const semLocal = (dados ?? []).filter((c) => c.la == null && (c.total || c.negocios || c.id));
  const cidade = cidades.find((c) => c.chave === sel) ?? null;
  const ufs = [...new Set(todas.map((c) => c.uf).filter(Boolean))].sort();

  const k = useMemo(() => {
    const cl = cidades.reduce((s, c) => s + c.clientes.length, 0);
    const tot = cidades.reduce((s, c) => s + c.total, 0);
    const ate50 = cidades.filter((c) => c.distancia <= 50).reduce((s, c) => s + c.total, 0);
    const pesoD = cidades.reduce((s, c) => s + c.distancia * c.clientes.length, 0);
    const maisLonge = [...cidades].sort((a, b) => b.distancia - a.distancia)[0];
    return {
      cidades: cidades.length, estados: new Set(cidades.map((c) => c.uf)).size, clientes: cl, total: tot,
      pct50: tot ? (ate50 / tot) * 100 : 0, raio: cl ? pesoD / cl : 0, lider: ordem[0], maisLonge,
      pipeline: cidades.reduce((s, c) => s + c.pipeline, 0), obras: cidades.reduce((s, c) => s + c.obras, 0),
    };
  }, [cidades, ordem]);
  const faixas = FAIXAS.map(([a, b, r]) => {
    const L = cidades.filter((c) => c.distancia >= a && c.distancia < b);
    return { rotulo: r, cidades: L.length, clientes: L.reduce((s, c) => s + c.clientes.length, 0), valor: L.reduce((s, c) => s + valorMetrica(c, metrica), 0) };
  });
  const maxFaixa = Math.max(...faixas.map((f) => f.valor), 1);
  const maxRank = Math.max(...ordem.map((c) => valorMetrica(c, metrica)), 1);
  const encontrados = busca.trim().length >= 2
    ? (dados ?? []).filter((c) => `${c.nome} ${c.cidade}`.toLowerCase().includes(busca.trim().toLowerCase())).slice(0, 8) : [];

  const painelCidade = (c: CidadeMapa) => {
    const lista = [...c.clientes].sort((a, b) => b.total + b.pipeline - (a.total + a.pipeline));
    const maisPerto = BASES.map((b) => ({ b, d: distanciaKm(b, c) })).sort((x, y) => x.d - y.d)[0];
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-linha p-4">
          <button onClick={() => setSel(null)} className="mb-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-suave hover:text-azul"><ArrowLeft className="size-3.5" />Ranking</button>
          <h3 className="flex items-center gap-2 font-display text-[19px] font-extrabold"><MapPin className="size-5 text-br" />{c.cidade}<span className="text-suave">/{c.uf}</span></h3>
          <p className="text-[12.5px] text-suave">{Math.round(c.distancia)} km da sede · mais perto de {maisPerto.b.nome} ({Math.round(maisPerto.d)} km)</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            {([["Contratado", curto(c.total)], ["Recebido", curto(c.recebido)], ["A receber", curto(c.aberto + c.atrasado)], ["Pipeline CRM", curto(c.pipeline)]] as const).map(([r, v]) => (
              <div key={r} className="rounded-xl bg-fundo px-3 py-2"><div className="text-suave">{r}</div><div className="num font-display text-[15px] font-extrabold">{v}</div></div>
            ))}
          </div>
          {c.atrasado > 0 && <p className="mt-2 text-[12px] font-semibold text-erro">{reais(c.atrasado)} em atraso nesta cidade</p>}
        </div>
        <ul className="flex-1 divide-y divide-linha overflow-y-auto">
          {lista.map((x) => (
            <li key={x.chave} className="px-4 py-2.5 text-[13px]">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  {x.id ? <Link href={`/clientes/ficha/?id=${x.id}`} className="block truncate font-semibold hover:text-azul">{x.nome}</Link> : <span className="block truncate font-semibold">{x.nome}</span>}
                  <span className="block text-[11.5px] text-suave">
                    {x.negocios ? pl(x.negocios, "negócio", "negócios") : "sem negócio no CRM"}{x.obras ? ` · ${pl(x.obras, "obra", "obras")}` : ""}{x.ultimo ? ` · último ${x.ultimo.split("-").reverse().join("/")}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className="num block font-bold">{curto(x.total)}</span>
                  {x.pipeline > 0 && <span className="num block text-[11.5px] text-azul">+{curto(x.pipeline)} pipeline</span>}
                  {x.atrasado > 0 && <span className="num block text-[11.5px] text-erro">{curto(x.atrasado)} atraso</span>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Shell titulo="Mapa de atendimento" cheio>
      <div className={cheia ? "fixed inset-0 z-50 flex flex-col bg-marinho-950" : "px-4 pt-5 pb-16 lg:px-9 lg:pt-7"}>
        {/* cabeçalho premium */}
        {!cheia && (
          <section className="relative mb-4 overflow-hidden rounded-[22px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul p-5 text-white shadow-[0_24px_50px_-24px_rgba(14,26,61,.8)] lg:p-6">
            <div className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full bg-[radial-gradient(circle,rgba(245,130,31,.28),transparent_70%)]" aria-hidden />
            <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[12.5px] font-semibold tracking-wide text-white/70 uppercase"><Radar className="size-4" />Inteligência territorial</div>
                <h1 className="font-display text-[26px] font-extrabold tracking-tight lg:text-[30px]">Mapa de atendimento</h1>
                <p className="text-[13.5px] text-white/70">Onde a BRA está, quanto cada região vale e para onde crescer.</p>
              </div>
              <div className="grid grid-cols-2 gap-x-7 gap-y-3 text-[12.5px] sm:grid-cols-3 xl:grid-cols-6">
                {[
                  ["Cidades atendidas", String(k.cidades), pl(k.estados, "estado", "estados")],
                  ["Clientes no mapa", String(k.clientes), semLocal.length ? `${semLocal.length} sem cidade` : "todos localizados"],
                  ["Valor contratado", curto(k.total), periodo === "tudo" ? "histórico" : periodo === "ano" ? "neste ano" : "12 meses"],
                  ["Até 50 km da sede", `${k.pct50.toFixed(0)}%`, "do valor contratado"],
                  ["Raio médio", `${Math.round(k.raio)} km`, k.maisLonge ? `mais longe: ${k.maisLonge.cidade}` : ""],
                  ["Pipeline no mapa", curto(k.pipeline), pl(k.obras, "obra ativa", "obras ativas")],
                ].map(([r, v, d]) => (
                  <div key={r}><div className="text-white/60">{r}</div><div className="num font-display text-[19px] font-extrabold">{v}</div><div className="text-[11.5px] text-white/55">{d}</div></div>
                ))}
              </div>
            </div>
          </section>
        )}
        {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}

        {/* controles */}
        <div className={`flex flex-wrap items-center gap-2 rounded-2xl bg-marinho-900 p-2 text-white ${cheia ? "m-3 mb-0" : "mb-3"}`}>
          <div className="flex max-w-full min-w-0 items-center gap-1 overflow-x-auto"><Layers className="ml-1 size-4 text-white/60" />{METRICAS.map(([m, r]) => <Pilula key={m} ativo={metrica === m} onClick={() => setMetrica(m)}>{r}</Pilula>)}</div>
          <span className="mx-1 hidden h-5 w-px bg-white/20 sm:block" />
          <div className="flex items-center gap-1">{([["tudo", "Tudo"], ["12m", "12 meses"], ["ano", "Este ano"]] as const).map(([p, r]) => <Pilula key={p} ativo={periodo === p} onClick={() => setPeriodo(p)}>{r}</Pilula>)}</div>
          <span className="mx-1 hidden h-5 w-px bg-white/20 sm:block" />
          <div className="flex items-center gap-1">{([["claro", "Mapa"], ["ruas", "Ruas"], ["escuro", "Noturno"], ["satelite", "Satélite"]] as const).map(([e, r]) => <Pilula key={e} ativo={estilo === e} onClick={() => setEstilo(e)}>{r}</Pilula>)}</div>
          <div className="flex max-w-full flex-wrap items-center gap-1 sm:ml-auto">
            {ufs.length > 1 && <select value={uf} onChange={(e) => { setUf(e.target.value); setReaj((n) => n + 1); }} className="rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold outline-none"><option value="" className="text-tinta">Todos os estados</option>{ufs.map((u) => <option key={u} className="text-tinta">{u}</option>)}</select>}
            <Pilula ativo={aneis} onClick={() => setAneis(!aneis)}><Route className="size-3.5" />Raios</Pilula>
            <Pilula ativo={rotulos} onClick={() => setRotulos(!rotulos)}>{rotulos ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}Nomes</Pilula>
            <Pilula ativo={false} onClick={() => { setSel(null); setReaj((n) => n + 1); }}><Crosshair className="size-3.5" />Ver tudo</Pilula>
            <Pilula ativo={false} onClick={() => setCheia(!cheia)}>{cheia ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}{cheia ? "Sair" : "Tela cheia"}</Pilula>
          </div>
        </div>

        {/* mapa + painel */}
        <div className={`grid gap-3 ${cheia ? "min-h-0 flex-1 p-3 lg:grid-cols-[1fr_380px]" : "lg:grid-cols-[1fr_380px]"}`}>
          <div className={`relative overflow-hidden rounded-[20px] border border-linha bg-[#dfe6ef] shadow-[0_14px_40px_-20px_rgba(14,26,61,.45)] ${cheia ? "h-full min-h-[50vh]" : "h-[62vh] min-h-[420px]"}`}>
            {dados && <MapaLeaflet cidades={cidades} metrica={metrica} estilo={estilo} aneis={aneis} rotulos={rotulos} selecionada={sel} onSelecionar={setSel} formatar={fmt} reajustar={reaj} />}
            {!dados && !erro && <div className="grid h-full place-items-center text-suave">Montando o mapa…</div>}
            {dados && metrica !== "clientes" && !cidades.some((c) => valorMetrica(c, metrica) > 0) && (
              <div className="pointer-events-none absolute inset-x-0 top-16 z-[500] mx-auto w-fit max-w-[90%] rounded-xl bg-marinho-950/90 px-4 py-2.5 text-center text-[13px] text-white shadow-xl">
                {metrica === "pipeline" ? "Nenhum negócio em andamento com valor no CRM ainda. Os valores aparecem aqui quando os cartões tiverem valor ou orçamento." : metrica === "obras" ? "Nenhuma obra em execução cadastrada." : "Sem valores nesta métrica no período escolhido."}
              </div>
            )}
            {/* busca sobre o mapa */}
            <div className="absolute top-3 left-3 z-[500] w-[min(320px,calc(100%-24px))]">
              <label className="relative block">
                <Search className="absolute top-2.5 left-3 z-10 size-4 text-suave" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou cidade…"
                  className="w-full rounded-xl border border-white/60 bg-white/95 py-2 pr-3 pl-9 text-[13.5px] shadow-lg outline-none backdrop-blur focus:border-azul" />
              </label>
              {encontrados.length > 0 && (
                <ul className="mt-1 overflow-hidden rounded-xl bg-white text-[13px] shadow-xl">
                  {encontrados.map((c) => (
                    <li key={c.chave}>
                      <button disabled={c.la == null} onClick={() => { const g = todas.find((x) => x.clientes.some((y) => y.chave === c.chave)); if (g) { setUf(""); setSel(g.chave); } setBusca(""); }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-fundo disabled:opacity-50">
                        <span className="min-w-0 truncate"><b>{c.nome}</b> <span className="text-suave">{c.cidade ? `· ${c.cidade}/${c.uf}` : "· sem cidade"}</span></span>
                        <ChevronRight className="size-4 shrink-0 text-suave" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* legenda */}
            <div className="absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-[11.5px] shadow-lg backdrop-blur">
              <div className="mb-1 font-bold">{METRICAS.find(([m]) => m === metrica)?.[1]}</div>
              <div className="flex items-center gap-2"><span className="h-2 w-24 rounded-full bg-gradient-to-r from-ciano via-azul to-br" /><span className="text-suave">menor → maior</span></div>
              <div className="mt-1 flex items-center gap-3 text-suave">
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-gradient-to-br from-br to-erro" />Sede</span>
                <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-gradient-to-br from-azul to-marinho-900" />Showroom</span>
                {aneis && <span className="flex items-center gap-1"><span className="h-0 w-4 border-t-2 border-dashed border-br" />25/50/100 km</span>}
              </div>
            </div>
          </div>

          <aside className={`overflow-hidden rounded-[20px] border border-linha bg-white shadow-[0_14px_40px_-24px_rgba(14,26,61,.4)] ${cheia ? "h-full" : "h-[62vh] min-h-[420px]"}`}>
            {cidade ? painelCidade(cidade) : (
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-linha px-4 py-3">
                  <h3 className="flex items-center gap-2 text-[15px] font-bold"><Trophy className="size-4 text-br" />Ranking de cidades</h3>
                  <span className="text-[12px] text-suave">{METRICAS.find(([m]) => m === metrica)?.[1]}</span>
                </div>
                <ol className="flex-1 overflow-y-auto px-2 py-2">
                  {ordem.map((c, i) => (
                    <li key={c.chave}>
                      <button onClick={() => setSel(c.chave)} className="w-full rounded-xl px-2.5 py-2 text-left hover:bg-fundo">
                        <div className="flex items-center gap-2 text-[13px]">
                          <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${i < 3 ? "bg-gradient-to-br from-br to-erro text-white" : "bg-fundo text-suave"}`}>{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate font-semibold">{c.cidade}<span className="font-normal text-suave">/{c.uf}</span></span>
                          <span className="num font-bold">{fmt(valorMetrica(c, metrica))}</span>
                        </div>
                        <div className="mt-1 ml-8 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-linha"><div className="h-full rounded-full bg-gradient-to-r from-ciano via-azul to-br" style={{ width: `${Math.max(3, (valorMetrica(c, metrica) / maxRank) * 100)}%` }} /></div>
                          <span className="w-28 text-right text-[11px] text-suave">{c.clientes.length} cli. · {Math.round(c.distancia)} km</span>
                        </div>
                      </button>
                    </li>
                  ))}
                  {dados && !ordem.length && <li className="px-3 py-8 text-center text-[13px] text-suave">Nenhuma cidade com dados neste período.</li>}
                </ol>
              </div>
            )}
          </aside>
        </div>

        {/* análises */}
        {!cheia && (
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <section className="sombra-bra rounded-[18px] border border-linha bg-white p-5 xl:col-span-2">
              <h3 className="mb-1 flex items-center gap-2 text-[15px] font-bold"><Compass className="size-4 text-azul" />Distância da sede (Paulínia)</h3>
              <p className="mb-4 text-[12.5px] text-suave">Quanto do resultado vem de cada faixa de distância — ajuda a planejar deslocamento de equipe e expansão.</p>
              <ul className="space-y-3">
                {faixas.map((f) => (
                  <li key={f.rotulo} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 text-[13px]">
                    <span className="font-semibold">{f.rotulo}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-linha"><div className="h-full rounded-full bg-gradient-to-r from-ciano via-azul to-br" style={{ width: `${f.valor ? Math.max(3, (f.valor / maxFaixa) * 100) : 0}%` }} /></div>
                    <span className="w-44 text-right"><b className="num">{fmt(f.valor)}</b> <span className="text-[11.5px] text-suave">· {f.cidades} cid. · {f.clientes} cli.</span></span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="sombra-bra rounded-[18px] border border-linha bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold"><Building2 className="size-4 text-azul" />Destaques</h3>
              <ul className="space-y-3 text-[13px]">
                {k.lider && <li className="flex gap-2.5"><Trophy className="mt-0.5 size-4 shrink-0 text-br" /><span><b>{k.lider.cidade}</b> lidera em {METRICAS.find(([m]) => m === metrica)?.[1].toLowerCase()}: {fmt(valorMetrica(k.lider, metrica))}.</span></li>}
                {(() => { const p = [...cidades].sort((a, b) => b.pipeline - a.pipeline)[0]; return p?.pipeline ? <li className="flex gap-2.5"><Handshake className="mt-0.5 size-4 shrink-0 text-azul" /><span>Maior pipeline no CRM: <b>{p.cidade}</b> com {curto(p.pipeline)} em negociação.</span></li> : null; })()}
                {(() => { const a = [...cidades].sort((x, y) => y.atrasado - x.atrasado)[0]; return a?.atrasado ? <li className="flex gap-2.5"><Wallet className="mt-0.5 size-4 shrink-0 text-erro" /><span>Atenção à cobrança em <b>{a.cidade}</b>: {curto(a.atrasado)} em atraso.</span></li> : null; })()}
                {(() => { const n = cidades.filter((c) => c.pipeline > 0 && c.total === 0); return n.length ? <li className="flex gap-2.5"><MapIcon className="mt-0.5 size-4 shrink-0 text-ok" /><span>Cidades novas em negociação: <b>{n.slice(0, 4).map((c) => c.cidade).join(", ")}</b>{n.length > 4 ? ` e mais ${n.length - 4}` : ""}.</span></li> : null; })()}
                {k.maisLonge && <li className="flex gap-2.5"><Route className="mt-0.5 size-4 shrink-0 text-suave" /><span>Atendimento mais distante: <b>{k.maisLonge.cidade}/{k.maisLonge.uf}</b>, a {Math.round(k.maisLonge.distancia)} km.</span></li>}
              </ul>
            </section>

            {semLocal.length > 0 && (
              <section className="sombra-bra rounded-[18px] border border-linha bg-white p-5 xl:col-span-3">
                <h3 className="mb-1 flex items-center gap-2 text-[15px] font-bold"><Users className="size-4 text-atencao" />Clientes fora do mapa ({semLocal.length})</h3>
                <p className="mb-3 text-[12.5px] text-suave">Sem cidade no cadastro. Complete em Clientes para que entrem no mapa.</p>
                <div className="flex flex-wrap gap-2">
                  {semLocal.sort((a, b) => b.total - a.total).slice(0, 40).map((c) => c.id
                    ? <Link key={c.chave} href={`/clientes/ficha/?id=${c.id}`} className="rounded-full border border-linha px-3 py-1 text-[12.5px] hover:border-azul hover:text-azul">{c.nome}{c.total ? ` · ${curto(c.total)}` : ""}</Link>
                    : <span key={c.chave} className="rounded-full bg-fundo px-3 py-1 text-[12.5px] text-suave">{c.nome}{c.total ? ` · ${curto(c.total)}` : ""}</span>)}
                  {semLocal.length > 40 && <Link href="/clientes/" className="rounded-full px-3 py-1 text-[12.5px] font-semibold text-azul">ver todos em Clientes</Link>}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}
