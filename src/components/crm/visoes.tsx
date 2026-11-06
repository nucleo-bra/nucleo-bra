"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowLeft, Building2, CalendarPlus, Check, ChevronLeft, ChevronRight, CircleDot, ClipboardList,
  BarChart3, Clock, Mail, MapPin, Smartphone, MessageCircle, Pencil, Phone, Plus, Printer, RefreshCcw, Search,
} from "lucide-react";
import {
  Atividade, comissoesNoFinanceiro, Crm, ETAPAS_NEGOCIO, ETAPAS_PARCEIRO, EtapaNegocio, EtapaParceiro, hoje, isoDia, Negocio,
  Parceiro, rotulo, somaDias, TIPOS_AGENDA, TIPOS_PARCEIRO,
} from "@/lib/crm";
import { AgendaIphone } from "./agenda-iphone";
import { AZUL, Botao, Cartao, Chip, CIANO, curto, dataBr, DSEM, Kpi, LARANJA, MARINHO, MESES, reais, ROXO, Titulo, VERDE } from "./ui";
import { pl, plp } from "@/lib/texto";

export type Acoes = {
  parceiro: (p?: Partial<Parceiro>) => void;
  negocio: (n?: Partial<Negocio>) => void;
  atividade: (a?: Partial<Atividade>) => void;
  alternar: (a: Atividade) => void;
  moverNegocio: (id: string, etapa: EtapaNegocio) => void;
  moverParceiro: (id: string, etapa: EtapaParceiro) => void;
  verParceiro: (id: string | null) => void;
  aba: (a: string) => void;
  lancar: (n: Negocio) => void;
  ficha: (id: string) => void;
  usuario: string;
};

const COR_TIPO: Record<string, string> = { followup: AZUL, tarefa: VERDE, visita: ROXO };
const corAtv = (a: Atividade) => COR_TIPO[a.tipo] ?? LARANJA;
const nomeParceiro = (c: Crm, id: string | null) => c.parceiros.find((p) => p.id === id)?.nome ?? "";
const valorCom = (n: Negocio, k: "pct_vendedor" | "pct_parceiro") => (n.valor_estimado * n[k]) / 100;
export const COR_ETAPA: Record<EtapaNegocio, string> = { lead: "#e2625b", proposta: "#f0a845", negociacao: "#f1d84f", fechamento: "#d3dc4c", ganho: "#5cbd6e", perdido: "#9aa5bd" };
export const corEtapaChip: Record<EtapaNegocio, string> = {
  lead: "bg-erro-claro text-erro", proposta: "bg-atencao-claro text-atencao", negociacao: "bg-[#fbf5d6] text-[#8a7414]", fechamento: "bg-[#f3f6d4] text-[#6d7414]",
  ganho: "bg-ok-claro text-ok", perdido: "bg-fundo text-suave",
};
const whatsapp = (tel: string) => { const d = tel.replace(/\D/g, ""); return d ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : ""; };

// ================================================================== Painel
type Periodo = "m" | "t" | "s" | "a";
function periodo(g: Periodo, desloc: number) {
  const tam = { m: 1, t: 3, s: 6, a: 12 }[g], d = new Date(), atual = d.getFullYear() * 12 + d.getMonth();
  const ini = Math.floor(atual / tam) * tam + desloc * tam, y = Math.floor(ini / 12), m = ini % 12, fim = ini + tam - 1;
  const ym = (k: number) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}`;
  const rot = g === "m" ? `${MESES[m]}/${y}` : g === "t" ? `${m / 3 + 1}º tri ${y}` : g === "s" ? `${m / 6 + 1}º sem ${y}` : `${y}`;
  return { de: ym(ini), ate: ym(fim), rot, ano: y };
}

/** A agenda/calendário do CRM fica arquivada até o sistema ir para o servidor definitivo. */
export const AGENDA_ATIVA = false;

/**
 * Clientes / negócios: resumo comercial (o antigo Painel) em cima, o quadro de
 * negócios no meio e os alertas e anotações embaixo — tudo numa tela só.
 */
export function PainelNegocios({ crm, ac, children, rodape }: { crm: Crm; ac: Acoes; children: React.ReactNode; rodape?: React.ReactNode }) {
  const [g, setG] = useState<Periodo>("m");
  const [off, setOff] = useState(0);
  const [graficos, setGraficosBruto] = useState(() => { try { return localStorage.getItem("nucleo-crm-graficos") === "1"; } catch { return false; } });
  const setGraficos = (v: boolean) => { setGraficosBruto(v); try { localStorage.setItem("nucleo-crm-graficos", v ? "1" : "0"); } catch { /* sem armazenamento */ } };
  const h = hoje(), hora = new Date().getHours();
  const abertos = crm.negocios.filter((n) => !["ganho", "perdido"].includes(n.etapa));

  const p = periodo(g, off);
  const noPer = crm.negocios.filter((n) => n.data_ref.slice(0, 7) >= p.de && n.data_ref.slice(0, 7) <= p.ate);
  const tot = (e: EtapaNegocio) => noPer.filter((n) => n.etapa === e).reduce((s, n) => s + n.valor_estimado, 0);
  const qtd = (e: EtapaNegocio) => noPer.filter((n) => n.etapa === e).length;
  const fechados = noPer.filter((n) => n.etapa === "ganho");
  const minha = fechados.reduce((s, n) => s + valorCom(n, "pct_vendedor"), 0), parc = fechados.reduce((s, n) => s + valorCom(n, "pct_parceiro"), 0);
  const decididos = noPer.filter((n) => ["ganho", "perdido"].includes(n.etapa)).length;
  const conv = decididos ? (fechados.length / decididos) * 100 : null;
  const meses = Array.from({ length: 12 }, (_, i) => {
    const m = `${p.ano}-${String(i + 1).padStart(2, "0")}`, f = crm.negocios.filter((n) => n.etapa === "ganho" && n.data_ref.slice(0, 7) === m);
    return { rot: MESES[i], minha: f.reduce((s, n) => s + valorCom(n, "pct_vendedor"), 0), parceiros: f.reduce((s, n) => s + valorCom(n, "pct_parceiro"), 0) };
  });
  const porEtapa = ETAPAS_NEGOCIO.filter(([k]) => k !== "perdido").map(([k, l]) => ({ rot: l, valor: tot(k), cor: COR_ETAPA[k] }));
  const kpis: [string, string, string, string][] = [
    ["Em aberto", curto(tot("lead") + tot("proposta")), `${qtd("lead") + qtd("proposta")} negócio(s)`, `linear-gradient(${CIANO}, ${AZUL})`],
    ["Em negociação", curto(tot("negociacao") + tot("fechamento")), `${qtd("negociacao") + qtd("fechamento")} negócio(s)`, `linear-gradient(${LARANJA}, #ff3b30)`],
    ["Fechado", curto(tot("ganho")), conv !== null ? `${conv.toFixed(0)}% de conversão` : `${fechados.length} negócio(s)`, `linear-gradient(#5be39b, ${VERDE})`],
    ["Minha comissão", reais(minha), "sobre negócios fechados", `linear-gradient(${CIANO}, ${AZUL})`],
    ["Comissão parceiros", reais(parc), `${fechados.filter((n) => n.pct_parceiro && !n.comissao_parceiro_paga).length} a pagar`, `linear-gradient(${LARANJA}, #ff3b30)`],
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5">
      {/* resumo comercial */}
      <section className="relative overflow-hidden rounded-[20px] heroi p-5 text-white  lg:p-6">
        <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.3),transparent_70%)]" aria-hidden />
        <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] text-white/70">{DSEM[new Date().getDay()]}, {dataBr(h)}</div>
            <div className="font-display text-[24px] font-extrabold tracking-tight lg:text-[28px]">{hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"}{ac.usuario ? `, ${ac.usuario.split(" ")[0]}` : ""}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-white/85">
              <span><b className="text-white">{abertos.length}</b> {plp(abertos.length, "negócio aberto", "negócios abertos")} · <b className="text-white">{curto(abertos.reduce((s, n) => s + n.valor_estimado, 0))}</b></span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([["Negócio", () => ac.negocio()], ["Parceiro", () => ac.parceiro({ etapa: "prospeccao" })]] as const).map(([l, f], i) => (
              <button key={l} onClick={f} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold ${i === 0 ? "bg-white text-marinho-900" : "border border-white/25 bg-white/10 text-white hover:bg-white/20"}`}><Plus className="size-3.5" />{l}</button>
            ))}
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11.5px] font-semibold tracking-[.16em] text-ciano uppercase">Pipeline comercial · {p.rot}</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-white/10 p-1 ring-1 ring-white/15">
              {([["m", "Mês"], ["t", "Tri"], ["s", "Sem"], ["a", "Ano"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setG(k); setOff(0); }} className={`rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${g === k ? "bg-white text-marinho-900" : "text-white/75 hover:text-white"}`}>{l}</button>
              ))}
            </div>
            <div className="inline-flex items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <button className="p-1.5 text-white/80 hover:text-white" onClick={() => setOff(off - 1)} aria-label="Período anterior"><ChevronLeft className="size-4" /></button>
              <span className="min-w-[86px] text-center text-[12.5px] font-bold">{p.rot}</span>
              <button className="p-1.5 text-white/80 hover:text-white" onClick={() => setOff(off + 1)} aria-label="Próximo período"><ChevronRight className="size-4" /></button>
            </div>
            <button onClick={() => setGraficos(!graficos)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-white/15 ${graficos ? "bg-white text-marinho-900" : "bg-white/10 text-white hover:bg-white/20"}`}><BarChart3 className="size-3.5" />Gráficos</button>
          </div>
        </div>
        <div className="relative mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
          {kpis.map(([t, v, d, cor], i) => (
            <div key={t} className={`relative overflow-hidden rounded-2xl bg-white/[.08] px-4 py-3 ring-1 ring-white/10 ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`}>
              <span className="absolute top-3 right-3 size-2 rounded-full" style={{ background: cor }} />
              <div className="text-[11.5px] font-semibold text-white/65">{t}</div>
              <div className="num truncate font-display text-[21px] font-extrabold">{v}</div>
              <div className="truncate text-[11.5px] text-white/55">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {graficos && (
        <Cartao>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 px-3 py-4 lg:grid-cols-2">
            <div>
              <div className="px-2 text-[12.5px] font-semibold text-suave">Valores por etapa · {p.rot}</div>
              <div className="h-[210px]">
                <ResponsiveContainer>
                  <BarChart data={porEtapa} barCategoryGap="30%">
                    <CartesianGrid vertical={false} stroke="#e6e6eb" />
                    <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={11.5} stroke="#8e8e93" />
                    <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="#8e8e93" width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip formatter={(v) => [reais(Number(v ?? 0)), "Valor"]} cursor={{ fill: "rgba(47,111,181,.07)" }} />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false} shape={(props: unknown) => {
                      const q = props as { x: number; y: number; width: number; height: number; payload: { cor: string } };
                      return <rect x={q.x} y={q.y} width={q.width} height={Math.max(0, q.height)} rx={4} fill={q.payload.cor} />;
                    }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-4 px-2 text-[12.5px] font-semibold text-suave">
                Comissões em {p.ano}
                <span className="flex items-center gap-1.5 font-normal"><span className="size-2.5 rounded-[3px]" style={{ background: AZUL }} />Minha</span>
                <span className="flex items-center gap-1.5 font-normal"><span className="size-2.5 rounded-[3px]" style={{ background: LARANJA }} />Parceiros</span>
              </div>
              <div className="h-[210px]">
                <ResponsiveContainer>
                  <BarChart data={meses} barCategoryGap="22%">
                    <CartesianGrid vertical={false} stroke="#e6e6eb" />
                    <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={11.5} stroke="#8e8e93" interval="preserveStartEnd" minTickGap={4} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="#8e8e93" width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                    <Tooltip formatter={(v, nome) => [reais(Number(v ?? 0)), nome === "minha" ? "Minha" : "Parceiros"]} cursor={{ fill: "rgba(47,111,181,.07)" }} />
                    <Bar dataKey="minha" fill={AZUL} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="parceiros" fill={LARANJA} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Cartao>
      )}

      {/* quadro de negócios */}
      {children}

      {rodape}
    </div>
  );
}

// ------------------------------------------------------------------ semana com horários
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- agenda arquivada (AGENDA_ATIVA)
function Semana({ crm, ac, sel, setSel }: { crm: Crm; ac: Acoes; sel: string; setSel: (d: string) => void }) {
  const base = new Date(sel + "T12:00:00"), w = base.getDay();
  base.setDate(base.getDate() + (w === 0 ? -6 : 1 - w));
  const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(d.getDate() + i); return isoDia(d); });
  const h = hoje(), agoraH = new Date().getHours();
  const horas = Array.from({ length: 15 }, (_, i) => i + 7);
  const doDia = (d: string) => crm.atividades.filter((a) => a.data === d);
  const evento = (a: Atividade) => (
    <button key={a.id} onClick={(e) => { e.stopPropagation(); ac.atividade(a); }}
      className={`mb-1 block w-full truncate rounded-md border-l-[3px] bg-fundo px-1.5 py-1 text-left text-[11.5px] leading-tight hover:bg-[#e6eefa] ${a.concluida ? "line-through opacity-50" : ""}`} style={{ borderColor: corAtv(a) }}>
      {a.hora && <b className="mr-1">{a.hora}</b>}{a.tipo === "followup" ? "↻ " : a.tipo === "tarefa" ? "☐ " : ""}{a.titulo}
      {a.parceiro_id && <span className="block truncate text-[10.5px] text-suave">{nomeParceiro(crm, a.parceiro_id)}</span>}
      {a.endereco && <span className="block truncate text-[10.5px] text-suave">{a.endereco}</span>}
    </button>
  );
  return (
    <Cartao>
      <Titulo extra={
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-xl border border-linha">
            <button className="p-1.5" onClick={() => setSel(somaDias(sel, -7))} aria-label="Semana anterior"><ChevronLeft className="size-4" /></button>
            <span className="num min-w-[118px] text-center text-[13px] font-bold">{dataBr(dias[0]).slice(0, 5)} – {dataBr(dias[6])}</span>
            <button className="p-1.5" onClick={() => setSel(somaDias(sel, 7))} aria-label="Próxima semana"><ChevronRight className="size-4" /></button>
          </div>
          <Botao onClick={() => setSel(hoje())} className="py-1.5">Hoje</Botao>
          <Botao onClick={() => ac.aba("agenda")} className="py-1.5" tipo="leve"><Smartphone className="size-4" />iPhone</Botao>
        </div>
      }>Semana</Titulo>
      <div className="overflow-x-auto px-3 pb-3">
        <div className="grid min-w-[860px] grid-cols-[52px_repeat(7,minmax(108px,1fr))] overflow-hidden rounded-xl border border-linha text-[12px]">
          <div className="bg-fundo" />
          {dias.map((d) => {
            const dt = new Date(d + "T12:00:00");
            return (
              <button key={d} onClick={() => setSel(d)} className={`border-l border-linha bg-fundo px-1 py-2 text-center ${d === sel ? "shadow-[inset_0_-3px_0_#0071e3]" : ""}`}>
                <span className="block text-[11px] font-semibold text-suave">{DSEM[dt.getDay()]}</span>
                <b className={`num font-display text-[17px] ${d === h ? "text-br" : ""}`}>{dt.getDate()}</b>
              </button>
            );
          })}
          <div className="border-t border-linha px-1 py-1.5 text-right text-[10.5px] text-suave">dia todo</div>
          {dias.map((d) => (
            <div key={d} onClick={() => ac.atividade({ tipo: "tarefa", data: d })} className="min-h-[38px] cursor-pointer border-t border-l border-linha bg-[#f7f9fc] p-1 hover:bg-[#eef3fb]">
              {doDia(d).filter((a) => !a.hora).map(evento)}
            </div>
          ))}
          {horas.map((hr) => (
            <div key={hr} className="contents">
              <div className="border-t border-linha px-1 py-1 text-right text-[10.5px] text-suave">{String(hr).padStart(2, "0")}:00</div>
              {dias.map((d) => (
                <div key={d} onClick={() => ac.atividade({ tipo: "reuniao", data: d, hora: `${String(hr).padStart(2, "0")}:00` })}
                  className={`min-h-[40px] cursor-pointer border-t border-l border-linha p-1 hover:bg-[#eef3fb] ${d === h && hr === agoraH ? "bg-[#eaf6fb]" : ""}`}>
                  {doDia(d).filter((a) => a.hora && Math.min(21, Math.max(7, Number(a.hora.slice(0, 2)))) === hr).sort((x, y) => x.hora.localeCompare(y.hora)).map(evento)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12px] text-suave">
          {([["Compromissos", LARANJA], ["Follow-up", AZUL], ["Tarefas", VERDE], ["Visitas", ROXO]] as const).map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="size-2.5 rounded-[3px]" style={{ background: c }} />{l}</span>)}
          <span>· clique em um horário vazio para agendar</span>
        </div>
      </div>
    </Cartao>
  );
}

// ------------------------------------------------------------------ lista de um dia
function LinhaAtividade({ crm, ac, a, mostrarData = false }: { crm: Crm; ac: Acoes; a: Atividade; mostrarData?: boolean }) {
  const atrasado = !a.concluida && a.data < hoje();
  return (
    <li className={`flex items-start gap-3 px-5 py-3 ${a.concluida ? "opacity-55" : ""}`}>
      <button onClick={() => ac.alternar(a)} aria-label={a.concluida ? "Reabrir" : "Concluir"}
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 ${a.concluida ? "border-ok bg-ok text-white" : "border-linha hover:border-azul"}`}>
        {a.concluida && <Check className="size-3.5" strokeWidth={3} />}
      </button>
      <button onClick={() => ac.atividade(a)} className="min-w-0 flex-1 text-left">
        <div className={`text-[14px] font-semibold ${a.concluida ? "line-through" : ""}`}>
          {a.tipo === "followup" && a.contato ? `${a.contato} · ` : ""}{a.titulo}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-suave">
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: corAtv(a) }}><CircleDot className="size-3" />{a.tipo === "followup" ? "Follow-up" : a.tipo === "tarefa" ? "Tarefa" : rotulo(TIPOS_AGENDA, a.tipo)}</span>
          {(mostrarData || atrasado) && <span className={atrasado ? "font-semibold text-erro" : ""}>{dataBr(a.data)}{atrasado ? " · atrasado" : ""}</span>}
          {a.hora && <span className="inline-flex items-center gap-1"><Clock className="size-3" />{a.hora}{a.hora_fim ? `–${a.hora_fim}` : ""}{a.data_fim && a.data_fim !== a.data ? ` (até ${dataBr(a.data_fim).slice(0, 5)})` : ""}</span>}
          {a.parceiro_id && <span>{nomeParceiro(crm, a.parceiro_id)}</span>}
          {a.endereco && <span role="link" tabIndex={0} title="Abrir no mapa"
            onClick={(e) => { e.stopPropagation(); window.open(`https://maps.apple.com/?q=${encodeURIComponent(a.endereco)}`, "_blank", "noopener"); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); window.open(`https://maps.apple.com/?q=${encodeURIComponent(a.endereco)}`, "_blank", "noopener"); } }}
            className="inline-flex max-w-[320px] cursor-pointer items-center gap-1 truncate hover:text-azul"><MapPin className="size-3 shrink-0" />{a.endereco}</span>}
        </div>
        {a.notas ? <p className="mt-1 line-clamp-2 text-[13px] text-tinta/80">{a.notas}</p>
          : !["tarefa", "followup"].includes(a.tipo) && a.data <= hoje() ? <p className="mt-1 text-[12.5px] text-atencao">sem anotação ainda</p> : null}
      </button>
    </li>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- agenda arquivada (AGENDA_ATIVA)
function DiaAgenda({ crm, ac, dia }: { crm: Crm; ac: Acoes; dia: string }) {
  const L = crm.atividades.filter((a) => a.data === dia).sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99"));
  const dt = new Date(dia + "T12:00:00");
  return (
    <>
      <Titulo extra={<div className="flex flex-wrap gap-1.5">
        <Botao className="py-1.5" onClick={() => ac.atividade({ tipo: "reuniao", data: dia })}><CalendarPlus className="size-4" />Compromisso</Botao>
        <Botao className="py-1.5" onClick={() => ac.atividade({ tipo: "followup", data: dia })}><RefreshCcw className="size-4" />Follow-up</Botao>
        <Botao className="py-1.5" onClick={() => ac.atividade({ tipo: "tarefa", data: dia })}><ClipboardList className="size-4" />Tarefa</Botao>
      </div>}>Agenda · {DSEM[dt.getDay()]}, {dataBr(dia)}{dia === hoje() ? " · hoje" : ""}</Titulo>
      {L.length ? <ul className="divide-y divide-linha pb-2">{L.map((a) => <LinhaAtividade key={a.id} crm={crm} ac={ac} a={a} />)}</ul>
        : <p className="px-5 pb-5 text-[13.5px] text-suave">Dia livre. Que tal agendar uma visita a um parceiro?</p>}
    </>
  );
}

// ================================================================== Negócios (kanban)
export function Negocios({ crm, ac }: { crm: Crm; ac: Acoes }) {
  const [busca, setBusca] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [verPerdidos, setVerPerdidos] = useState(false);
  const q = busca.trim().toLowerCase();
  const L = crm.negocios.filter((n) => !q || `${n.cliente_nome} ${n.titulo} ${nomeParceiro(crm, n.parceiro_id)}`.toLowerCase().includes(q));
  const colunas = ETAPAS_NEGOCIO.filter(([k]) => verPerdidos || k !== "perdido");
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Botao tipo="pri" onClick={() => ac.negocio()}><Plus className="size-4" />Novo cliente / negócio</Botao>
        <label className="relative"><Search className="absolute top-2.5 left-3 size-4 text-suave" />
          <input className="w-64 rounded-xl border border-linha bg-white py-2 pr-3 pl-9 text-[14px] outline-none focus:border-azul" placeholder="Buscar cliente, projeto, parceiro" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
        <label className="ml-1 flex items-center gap-2 text-[13px] text-suave"><input type="checkbox" checked={verPerdidos} onChange={(e) => setVerPerdidos(e.target.checked)} />Mostrar perdidos</label>
        <span className="ml-auto text-[12.5px] text-suave">Arraste os cartões entre as colunas para mudar o status</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {colunas.map(([k, l]) => {
          const C = L.filter((n) => n.etapa === k), tot = C.reduce((s, n) => s + n.valor_estimado, 0);
          return (
            <div key={k} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (arrastando) ac.moverNegocio(arrastando, k); setArrastando(null); }}
              className={`flex w-[270px] shrink-0 flex-col rounded-[18px] border border-linha bg-white/70 p-2.5 ${arrastando ? "outline-2 outline-dashed outline-azul/30" : ""}`}>
              <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
                <span className="flex items-center gap-2 text-[13.5px] font-bold"><span className="size-2.5 rounded-full" style={{ background: COR_ETAPA[k] }} />{l} <span className="font-normal text-suave">{C.length}</span></span>
                <span className="num text-[12.5px] font-bold">{curto(tot)}</span>
              </div>
              <div className="flex min-h-[80px] flex-col gap-2">
                {C.map((n) => (
                  <div key={n.id} draggable onDragStart={() => setArrastando(n.id)} onDragEnd={() => setArrastando(null)} onClick={() => ac.negocio(n)}
                    className="sombra-bra cursor-pointer rounded-xl border border-linha bg-white p-3 transition ">
                    <div className="text-[14px] font-bold leading-snug">{n.cliente_nome || n.titulo}</div>
                    {n.cliente_nome && n.titulo !== n.cliente_nome && <div className="text-[12.5px] text-suave">{n.titulo}</div>}
                    <div className="num mt-1.5 font-display text-[16px] font-extrabold">{reais(n.valor_estimado)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-suave">
                      <span>{dataBr(n.data_ref)}</span>
                      {n.parceiro_id && <Chip cor="bg-[#efeafc] text-[#5b3fc4]">{nomeParceiro(crm, n.parceiro_id)}</Chip>}
                      {n.etapa === "ganho" && (n.financeiro_lancado_em ? <Chip cor="bg-ok-claro text-ok"><Check className="size-3" />no Financeiro</Chip>
                        : <button onClick={(e) => { e.stopPropagation(); ac.lancar(n); }} className="rounded-full bg-azul px-2 py-0.5 font-bold text-white">Lançar no Financeiro</button>)}
                    </div>
                  </div>
                ))}
                {!C.length && <p className="px-1.5 py-4 text-center text-[12.5px] text-suave">Arraste um negócio para cá</p>}
              </div>
            </div>
          );
        })}
      </div>
      <Cartao className="mt-2">
        <Titulo>Todos os negócios</Titulo>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full text-[13.5px]">
            <thead className="text-left text-[12px] text-suave"><tr>{["Cliente", "Projeto", "Parceiro", "Data", "Status", "Valor", "Minha com.", "Parceiro"].map((x) => <th key={x} className="px-2 py-2 font-semibold whitespace-nowrap">{x}</th>)}</tr></thead>
            <tbody>
              {[...L].sort((a, b) => b.data_ref.localeCompare(a.data_ref)).map((n) => (
                <tr key={n.id} onClick={() => ac.negocio(n)} className="cursor-pointer border-t border-linha hover:bg-fundo/60">
                  <td className="px-2 py-2 font-semibold">{n.cliente_nome || "—"}</td><td className="px-2 py-2">{n.titulo}</td>
                  <td className="px-2 py-2 text-suave">{nomeParceiro(crm, n.parceiro_id) || "—"}</td><td className="num px-2 py-2">{dataBr(n.data_ref)}</td>
                  <td className="px-2 py-2"><Chip cor={corEtapaChip[n.etapa]}>{rotulo(ETAPAS_NEGOCIO, n.etapa)}</Chip></td>
                  <td className="num px-2 py-2 text-right font-bold">{reais(n.valor_estimado)}</td>
                  <td className="num px-2 py-2 text-right">{reais(valorCom(n, "pct_vendedor"))}</td>
                  <td className="num px-2 py-2 text-right">{reais(valorCom(n, "pct_parceiro"))}{n.comissao_parceiro_paga && <Check className="ml-1 inline size-3.5 text-ok" />}</td>
                </tr>
              ))}
              {!L.length && <tr><td colSpan={8} className="px-2 py-6 text-center text-suave">Nenhum negócio ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  );
}

// ================================================================== Parceiros
export function Parceiros({ crm, ac }: { crm: Crm; ac: Acoes }) {
  const [busca, setBusca] = useState("");
  const q = busca.trim().toLowerCase();
  const L = crm.parceiros.filter((p) => !q || `${p.nome} ${p.escritorio} ${p.cidade} ${p.tipo}`.toLowerCase().includes(q));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Botao tipo="pri" onClick={() => ac.parceiro({ etapa: "ativo" })}><Plus className="size-4" />Novo parceiro</Botao>
        <label className="relative"><Search className="absolute top-2.5 left-3 size-4 text-suave" />
          <input className="w-64 rounded-xl border border-linha bg-white py-2 pr-3 pl-9 text-[14px] outline-none focus:border-azul" placeholder="Buscar parceiro" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {L.map((p) => {
          const ds = crm.negocios.filter((n) => n.parceiro_id === p.id), fech = ds.filter((n) => n.etapa === "ganho");
          const ult = crm.atividades.filter((a) => a.parceiro_id === p.id && a.tipo === "visita").sort((a, b) => b.data.localeCompare(a.data))[0];
          return (
            <button key={p.id} onClick={() => ac.verParceiro(p.id)} className="sombra-bra rounded-[18px] border border-linha bg-white p-4 text-left transition hover:shadow-md">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-azul hover:bg-azul-escuro font-display text-[14px] font-bold text-white">{p.nome.split(/\s+/).map((x) => x[0]).slice(0, 2).join("")}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{p.nome}</div>
                  <div className="truncate text-[12.5px] text-suave">{rotulo(TIPOS_PARCEIRO, p.tipo)}{p.escritorio ? ` · ${p.escritorio}` : ""}{p.cidade ? ` · ${p.cidade}` : ""}</div>
                </div>
                <Chip cor={p.etapa === "ativo" ? "bg-ok-claro text-ok" : p.etapa === "inativo" ? "bg-fundo text-suave" : "bg-ciano-claro text-[#0e7f8a]"}>{rotulo(ETAPAS_PARCEIRO, p.etapa)}</Chip>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[["Clientes", String(ds.length)], ["Fechado", curto(fech.reduce((s, n) => s + n.valor_estimado, 0))], ["Última visita", ult ? dataBr(ult.data).slice(0, 5) : "—"]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-fundo px-1 py-2"><div className="num text-[14px] font-extrabold">{v}</div><div className="text-[11px] font-semibold text-suave">{k}</div></div>
                ))}
              </div>
            </button>
          );
        })}
        {!L.length && <Cartao className="p-6 text-center text-suave sm:col-span-2 xl:col-span-3">Cadastre seu primeiro parceiro (arquitetos, designers, construtoras…).</Cartao>}
      </div>
    </div>
  );
}

export function FichaParceiro({ crm, ac, id }: { crm: Crm; ac: Acoes; id: string }) {
  const p = crm.parceiros.find((x) => x.id === id);
  const [visita, setVisita] = useState({ data: hoje(), texto: "" });
  const [fin, setFin] = useState<Awaited<ReturnType<typeof comissoesNoFinanceiro>> | null>(null);
  useEffect(() => { if (p) comissoesNoFinanceiro(p.nome).then(setFin).catch(() => setFin(null)); }, [p]);
  const ds = useMemo(() => crm.negocios.filter((n) => n.parceiro_id === id), [crm, id]);
  if (!p) return <p className="text-suave">Parceiro não encontrado.</p>;
  const fech = ds.filter((n) => n.etapa === "ganho"), and = ds.filter((n) => !["ganho", "perdido"].includes(n.etapa));
  const com = fech.reduce((s, n) => s + valorCom(n, "pct_parceiro"), 0), pago = fech.filter((n) => n.comissao_parceiro_paga).reduce((s, n) => s + valorCom(n, "pct_parceiro"), 0);
  const visitas = crm.atividades.filter((a) => a.parceiro_id === id && a.tipo === "visita").sort((a, b) => b.data.localeCompare(a.data));
  const outras = crm.atividades.filter((a) => a.parceiro_id === id && a.tipo !== "visita").sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8);
  const wa = whatsapp(p.telefone);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Botao onClick={() => ac.verParceiro(null)}><ArrowLeft className="size-4" />Parceiros</Botao>
        <Botao onClick={() => ac.parceiro(p)}><Pencil className="size-4" />Editar cadastro</Botao>
        <Botao onClick={() => window.print()}><Printer className="size-4" />Imprimir relatório</Botao>
      </div>
      <section className="relative overflow-hidden rounded-[18px] heroi p-5 text-white lg:p-6">
        <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid size-14 place-items-center rounded-full bg-white/15 font-display text-[20px] font-bold">{p.nome.split(/\s+/).map((x) => x[0]).slice(0, 2).join("")}</div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[24px] font-extrabold tracking-tight">{p.nome}</div>
            <div className="text-[13.5px] text-white/80">{rotulo(TIPOS_PARCEIRO, p.tipo)}{p.escritorio ? ` · ${p.escritorio}` : ""}{p.cidade ? ` · ${p.cidade}` : ""} · {rotulo(ETAPAS_PARCEIRO, p.etapa)} · comissão padrão {p.comissao_padrao}%</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[13px] print:hidden">
              {p.telefone && <a href={`tel:${p.telefone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 hover:bg-white/20"><Phone className="size-3.5" />{p.telefone}</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25d366] px-3 py-1 font-semibold text-white"><MessageCircle className="size-3.5" />WhatsApp</a>}
              {p.email && <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 hover:bg-white/20"><Mail className="size-3.5" />{p.email}</a>}
              {p.instagram && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1">{p.instagram}</span>}
            </div>
          </div>
        </div>
        {p.observacoes && <p className="mt-3 text-[13.5px] text-white/85">{p.observacoes}</p>}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi rotulo="Clientes vinculados" valor={String(ds.length)} cor={`linear-gradient(${CIANO}, ${AZUL})`} />
        <Kpi rotulo="Valor fechado" valor={curto(fech.reduce((s, n) => s + n.valor_estimado, 0))} tom="text-ok" cor={`linear-gradient(#5be39b, ${VERDE})`} />
        <Kpi rotulo="Em andamento" valor={curto(and.reduce((s, n) => s + n.valor_estimado, 0))} tom="text-atencao" cor={`linear-gradient(${LARANJA}, #ff3b30)`} />
        <Kpi rotulo="Comissão (CRM)" valor={reais(com)} cor={`linear-gradient(${CIANO}, ${AZUL})`} detalhe={`a pagar ${reais(com - pago)}`} />
        <Kpi rotulo="Comissão no Financeiro" valor={fin ? reais(fin.recebida) : "—"} cor={`linear-gradient(${MARINHO}, ${AZUL})`} detalhe={fin ? `sobre recebidos · prevista ${reais(fin.prevista)}` : "carregando…"} />
      </div>

      <Cartao>
        <Titulo extra={<Botao className="print:hidden" onClick={() => ac.negocio({ parceiro_id: p.id, pct_parceiro: p.comissao_padrao })}><Plus className="size-4" />Cliente vinculado</Botao>}>Clientes e comissionamento</Titulo>
        <div className="overflow-x-auto px-3 pb-3">
          <table className="w-full text-[13.5px]">
            <thead className="text-left text-[12px] text-suave"><tr>{["Cliente", "Projeto", "Status", "Data", "Valor", "%", "Comissão", "Paga"].map((x) => <th key={x} className="px-2 py-2 font-semibold">{x}</th>)}</tr></thead>
            <tbody>
              {ds.map((n) => (
                <tr key={n.id} onClick={() => ac.negocio(n)} className="cursor-pointer border-t border-linha hover:bg-fundo/60">
                  <td className="px-2 py-2 font-semibold">{n.cliente_nome || "—"}</td><td className="px-2 py-2">{n.titulo}</td>
                  <td className="px-2 py-2"><Chip cor={corEtapaChip[n.etapa]}>{rotulo(ETAPAS_NEGOCIO, n.etapa)}</Chip></td>
                  <td className="num px-2 py-2">{dataBr(n.data_ref)}</td><td className="num px-2 py-2 text-right font-bold">{reais(n.valor_estimado)}</td>
                  <td className="num px-2 py-2 text-right">{n.pct_parceiro}%</td><td className="num px-2 py-2 text-right">{reais(valorCom(n, "pct_parceiro"))}</td>
                  <td className="px-2 py-2">{n.etapa === "ganho" ? (n.comissao_parceiro_paga ? <Chip cor="bg-ok-claro text-ok">Paga</Chip> : <Chip cor="bg-atencao-claro text-atencao">A pagar</Chip>) : "—"}</td>
                </tr>
              ))}
              {!ds.length && <tr><td colSpan={8} className="px-2 py-5 text-center text-suave">Nenhum cliente vinculado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
        {fin && fin.ultimas.length > 0 && (
          <div className="border-t border-linha px-5 py-3">
            <div className="mb-1.5 text-[12.5px] font-semibold text-suave">Últimas parcelas com comissão no Financeiro ({fin.parcelas})</div>
            <ul className="space-y-1 text-[13px]">
              {fin.ultimas.map((u, i) => <li key={i} className="flex justify-between gap-3"><span className="truncate">{u.who} · {u.desc}</span><span className="num shrink-0">{u.pago ? `recebida ${dataBr(u.pago)}` : `vence ${dataBr(u.venc)}`} · <b>{reais(u.valor)}</b></span></li>)}
            </ul>
          </div>
        )}
      </Cartao>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:gap-5">
        <Cartao>
          <Titulo>Anotações de visitas</Titulo>
          <div className="flex flex-wrap gap-2 px-5 pb-3 print:hidden">
            <input type="date" className="rounded-xl border border-linha px-3 py-2 text-[14px]" value={visita.data} onChange={(e) => setVisita({ ...visita, data: e.target.value })} />
            <input className="min-w-0 flex-1 rounded-xl border border-linha px-3 py-2 text-[14px]" placeholder="Anotação da visita…" value={visita.texto} onChange={(e) => setVisita({ ...visita, texto: e.target.value })} />
            <Botao tipo="pri" disabled={!visita.texto.trim()} onClick={() => { ac.atividade({ tipo: "visita", titulo: `Visita · ${p.nome}`, data: visita.data, notas: visita.texto, parceiro_id: p.id, concluida: true, salvarDireto: true } as Partial<Atividade>); setVisita({ data: hoje(), texto: "" }); }}>Adicionar</Botao>
          </div>
          <ul className="divide-y divide-linha pb-2">
            {visitas.map((v) => (
              <li key={v.id}><button onClick={() => ac.atividade(v)} className="block w-full px-5 py-2.5 text-left hover:bg-fundo/60">
                <b className="num text-[13.5px]">{dataBr(v.data)}</b><p className="text-[13px] text-tinta/80">{v.notas || v.titulo}</p>
              </button></li>
            ))}
            {!visitas.length && <li className="px-5 pb-4 text-[13.5px] text-suave">Sem visitas registradas.</li>}
          </ul>
        </Cartao>
        <Cartao>
          <Titulo extra={<Botao className="print:hidden" onClick={() => ac.atividade({ tipo: "reuniao", parceiro_id: p.id, data: hoje() })}><CalendarPlus className="size-4" />Agendar</Botao>}>Agenda com o parceiro</Titulo>
          <ul className="divide-y divide-linha pb-2">{outras.map((a) => <LinhaAtividade key={a.id} crm={crm} ac={ac} a={a} mostrarData />)}</ul>
          {!outras.length && <p className="px-5 pb-4 text-[13.5px] text-suave">Nada agendado.</p>}
        </Cartao>
      </div>
    </div>
  );
}

// ================================================================== Prospecção
export function Prospeccao({ crm, ac }: { crm: Crm; ac: Acoes }) {
  const [arr, setArr] = useState<string | null>(null);
  const col = ETAPAS_PARCEIRO.slice(0, 4);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Botao tipo="pri" onClick={() => ac.parceiro({ etapa: "prospeccao", tipo: "arquiteto" })}><Plus className="size-4" />Novo alvo</Botao>
        <span className="ml-auto self-center text-[12.5px] text-suave">Arraste para avançar de etapa</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {col.map(([k, l], i) => {
          const C = crm.parceiros.filter((p) => p.etapa === k);
          return (
            <div key={k} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (arr) ac.moverParceiro(arr, k); setArr(null); }}
              className="flex w-[270px] shrink-0 flex-col rounded-[18px] border border-linha bg-white/70 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1.5 pt-1 text-[13.5px] font-bold"><span>{l}</span><span className="font-normal text-suave">{C.length}</span></div>
              <div className="flex min-h-[80px] flex-col gap-2">
                {C.map((p) => (
                  <div key={p.id} draggable onDragStart={() => setArr(p.id)} onDragEnd={() => setArr(null)} className="sombra-bra rounded-xl border border-linha bg-white p-3">
                    <button onClick={() => ac.verParceiro(p.id)} className="block w-full text-left">
                      <div className="text-[14px] font-bold">{p.nome}</div>
                      <div className="text-[12.5px] text-suave">{rotulo(TIPOS_PARCEIRO, p.tipo)}{p.escritorio ? ` · ${p.escritorio}` : ""}</div>
                    </button>
                    <div className="mt-2 flex gap-1.5">
                      {i < 3 && <button onClick={() => ac.moverParceiro(p.id, col[i + 1][0])} className="rounded-lg bg-fundo px-2 py-1 text-[12px] font-semibold text-azul hover:bg-[#e6eefa]">Avançar →</button>}
                      <button onClick={() => ac.atividade({ tipo: "reuniao", titulo: `Reunião · ${p.nome}`, parceiro_id: p.id, data: hoje() })} className="rounded-lg bg-fundo px-2 py-1 text-[12px] font-semibold text-suave hover:bg-[#e6eefa]">Agendar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ================================================================== Agenda, follow-up e to-do
/** Agrupa por dia: Atrasados, Hoje, Amanhã, "Qui, 30/10"… (sem grupos quando é só um dia) */
function gruposPorDia(L: Atividade[], h: string, agrupar: boolean): [string, Atividade[], string][] {
  if (!L.length) return [];
  if (!agrupar) return [["", L, ""]];
  const amanha = somaDias(h, 1);
  const mapa = new Map<string, Atividade[]>();
  for (const a of L) {
    const k = a.data < h && !a.concluida ? "atrasado" : a.data;
    mapa.set(k, [...(mapa.get(k) ?? []), a]);
  }
  return [...mapa.entries()].sort(([a], [b]) => (a === "atrasado" ? -1 : b === "atrasado" ? 1 : a.localeCompare(b))).map(([k, itens]) => {
    if (k === "atrasado") return ["Atrasados", itens, "text-erro"];
    if (k === h) return ["Hoje", itens, "text-azul"];
    if (k === amanha) return ["Amanhã", itens, "text-tinta"];
    const d = new Date(k + "T12:00:00");
    const sem = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    return [`${sem.charAt(0).toUpperCase() + sem.slice(1)}, ${dataBr(k).slice(0, 5)}`, itens, "text-tinta"];
  });
}

export function ListaAtividades({ crm, ac, modo }: { crm: Crm; ac: Acoes; modo: "agenda" | "followup" | "tarefa" }) {
  const [dia, setDia] = useState(hoje());
  const [rapida, setRapida] = useState("");
  const h = hoje();
  let L: Atividade[];
  if (modo === "agenda") L = crm.atividades.filter((a) => !["followup", "tarefa"].includes(a.tipo)).sort((a, b) => Number(a.concluida) - Number(b.concluida) || (a.data + a.hora).localeCompare(b.data + b.hora));
  else if (modo === "followup") L = crm.atividades.filter((a) => a.tipo === "followup").sort((a, b) => Number(a.concluida) - Number(b.concluida) || a.data.localeCompare(b.data));
  else L = crm.atividades.filter((a) => a.tipo === "tarefa" && (a.data === dia || (a.data < dia && !a.concluida))).sort((a, b) => Number(a.concluida) - Number(b.concluida) || a.data.localeCompare(b.data));
  const proximas = modo === "agenda" ? L.filter((a) => a.data >= h || !a.concluida) : L;
  const passadas = modo === "agenda" ? L.filter((a) => a.data < h && a.concluida).reverse().slice(0, 30) : [];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {modo === "agenda" && <Botao tipo="pri" onClick={() => ac.atividade({ tipo: "reuniao", data: h })}><Plus className="size-4" />Novo compromisso</Botao>}
        {modo === "followup" && <Botao tipo="pri" onClick={() => ac.atividade({ tipo: "followup", data: h })}><Plus className="size-4" />Novo follow-up</Botao>}
        {modo === "tarefa" && <>
          <input type="date" className="rounded-xl border border-linha bg-white px-3 py-2 text-[14px]" value={dia} onChange={(e) => setDia(e.target.value)} />
          <form className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto" onSubmit={(e) => { e.preventDefault(); if (rapida.trim()) { ac.atividade({ tipo: "tarefa", titulo: rapida.trim(), data: dia, salvarDireto: true } as Partial<Atividade>); setRapida(""); } }}>
            <input className="min-w-0 flex-1 rounded-xl border border-linha bg-white px-3 py-2 text-[14px] outline-none focus:border-azul" placeholder="Nova tarefa e Enter" value={rapida} onChange={(e) => setRapida(e.target.value)} />
            <Botao tipo="pri" type="submit">Adicionar</Botao>
          </form>
        </>}
      </div>
      {modo === "agenda" && AGENDA_ATIVA && <AgendaIphone />}
      <Cartao>
        <Titulo extra={proximas.length ? <span className="text-[12.5px] text-suave">{pl(proximas.filter((a) => !a.concluida).length, "pendente", "pendentes")}{proximas.some((a) => a.concluida) ? ` · ${pl(proximas.filter((a) => a.concluida).length, "feita", "feitas")}` : ""}</span> : undefined}>
          {modo === "agenda" ? "Próximos compromissos" : modo === "followup" ? "Follow-ups" : `Tarefas de ${dataBr(dia)}`}
        </Titulo>
        {gruposPorDia(proximas, h, modo !== "tarefa").map(([rotuloDia, itens, tomDia]) => (
          <div key={rotuloDia}>
            {rotuloDia && <div className={`flex items-center gap-2 border-y border-linha bg-[#f7f9fc] px-5 py-1.5 text-[11.5px] font-bold tracking-wide uppercase ${tomDia}`}>{rotuloDia}<span className="font-semibold text-suave normal-case">· {itens.length}</span></div>}
            <ul className="divide-y divide-linha">{itens.map((a) => <LinhaAtividade key={a.id} crm={crm} ac={ac} a={a} mostrarData={rotuloDia === "Atrasados"} />)}</ul>
          </div>
        ))}
        <div className="pb-2" />
        {!proximas.length && <p className="flex items-center gap-2 px-5 pb-5 text-[13.5px] text-suave"><Building2 className="size-4" />{modo === "tarefa" ? "Dia livre." : "Nada pendente."}</p>}
      </Cartao>
      {passadas.length > 0 && (
        <Cartao><Titulo>Realizados</Titulo><ul className="divide-y divide-linha pb-2">{passadas.map((a) => <LinhaAtividade key={a.id} crm={crm} ac={ac} a={a} mostrarData />)}</ul></Cartao>
      )}
    </div>
  );
}
