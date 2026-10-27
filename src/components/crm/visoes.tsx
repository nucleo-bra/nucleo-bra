"use client";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, ArrowLeft, Building2, CalendarClock, CalendarPlus, Check, ChevronLeft, ChevronRight, CircleDot, ClipboardList,
  Clock, Mail, MapPin, MessageCircle, NotebookPen, Pencil, Phone, Plus, Printer, RefreshCcw, Search, Wallet,
} from "lucide-react";
import {
  Atividade, comissoesNoFinanceiro, Crm, ETAPAS_NEGOCIO, ETAPAS_PARCEIRO, EtapaNegocio, EtapaParceiro, hoje, isoDia, Negocio,
  Parceiro, rotulo, somaDias, TIPOS_AGENDA, TIPOS_PARCEIRO,
} from "@/lib/crm";
import { AZUL, Botao, Cartao, Chip, CIANO, curto, dataBr, DSEM, Kpi, LARANJA, MARINHO, MESES, reais, ROXO, Titulo, VERDE } from "./ui";

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
  usuario: string;
};

const COR_TIPO: Record<string, string> = { followup: AZUL, tarefa: VERDE, visita: ROXO };
const corAtv = (a: Atividade) => COR_TIPO[a.tipo] ?? LARANJA;
const nomeParceiro = (c: Crm, id: string | null) => c.parceiros.find((p) => p.id === id)?.nome ?? "";
const valorCom = (n: Negocio, k: "pct_vendedor" | "pct_parceiro") => (n.valor_estimado * n[k]) / 100;
const COR_ETAPA: Record<EtapaNegocio, string> = { lead: CIANO, proposta: AZUL, negociacao: LARANJA, ganho: VERDE, perdido: "#9aa5bd" };
const corEtapaChip: Record<EtapaNegocio, string> = {
  lead: "bg-ciano-claro text-[#0e7f8a]", proposta: "bg-[#e6eefa] text-azul", negociacao: "bg-atencao-claro text-atencao",
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

export function Painel({ crm, ac }: { crm: Crm; ac: Acoes }) {
  const [sel, setSel] = useState(hoje());
  const [g, setG] = useState<Periodo>("m");
  const [off, setOff] = useState(0);
  const h = hoje(), hora = new Date().getHours();
  const doDia = (d: string) => crm.atividades.filter((a) => a.data === d);
  const hojeL = doDia(h);
  const reunioes = hojeL.filter((a) => !["followup", "tarefa"].includes(a.tipo) && !a.concluida).length;
  const fups = crm.atividades.filter((a) => a.tipo === "followup" && !a.concluida && a.data <= h).length;
  const tarefas = crm.atividades.filter((a) => a.tipo === "tarefa" && !a.concluida && a.data <= h).length;

  const p = periodo(g, off);
  const noPer = crm.negocios.filter((n) => n.data_ref.slice(0, 7) >= p.de && n.data_ref.slice(0, 7) <= p.ate);
  const tot = (e: EtapaNegocio) => noPer.filter((n) => n.etapa === e).reduce((s, n) => s + n.valor_estimado, 0);
  const fechados = noPer.filter((n) => n.etapa === "ganho");
  const minha = fechados.reduce((s, n) => s + valorCom(n, "pct_vendedor"), 0), parc = fechados.reduce((s, n) => s + valorCom(n, "pct_parceiro"), 0);
  const conv = noPer.filter((n) => ["ganho", "perdido"].includes(n.etapa)).length ? (fechados.length / noPer.filter((n) => ["ganho", "perdido"].includes(n.etapa)).length) * 100 : null;
  const meses = Array.from({ length: 12 }, (_, i) => {
    const m = `${p.ano}-${String(i + 1).padStart(2, "0")}`, f = crm.negocios.filter((n) => n.etapa === "ganho" && n.data_ref.slice(0, 7) === m);
    return { rot: MESES[i], minha: f.reduce((s, n) => s + valorCom(n, "pct_vendedor"), 0), parceiros: f.reduce((s, n) => s + valorCom(n, "pct_parceiro"), 0) };
  });
  const porEtapa = ETAPAS_NEGOCIO.filter(([k]) => k !== "perdido").map(([k, l]) => ({ rot: l, valor: tot(k), cor: COR_ETAPA[k] }));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5">
      {/* herói */}
      <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul p-5 text-white shadow-[0_24px_50px_-24px_rgba(14,26,61,.8)] lg:p-6">
        <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.3),transparent_70%)]" aria-hidden />
        <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[13px] text-white/70">{DSEM[new Date().getDay()]}, {dataBr(h)}</div>
            <div className="font-display text-[24px] font-extrabold tracking-tight lg:text-[28px]">{hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite"}{ac.usuario ? `, ${ac.usuario.split(" ")[0]}` : ""}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-white/85">
              <span><b className="text-white">{reunioes}</b> compromisso(s) hoje</span>
              <span><b className="text-white">{fups}</b> follow-up(s)</span>
              <span><b className="text-white">{tarefas}</b> tarefa(s)</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {([["Compromisso", () => ac.atividade({ tipo: "reuniao", data: h })], ["Follow-up", () => ac.atividade({ tipo: "followup", data: h })],
              ["Tarefa", () => ac.atividade({ tipo: "tarefa", data: h })], ["Negócio", () => ac.negocio()], ["Parceiro", () => ac.parceiro({ etapa: "prospeccao" })]] as const).map(([l, f], i) => (
              <button key={l} onClick={f} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold ${i === 0 ? "bg-white text-marinho-900" : "border border-white/25 bg-white/10 text-white hover:bg-white/20"}`}><Plus className="size-3.5" />{l}</button>
            ))}
          </div>
        </div>
      </section>

      {/* semana */}
      <Semana crm={crm} ac={ac} sel={sel} setSel={setSel} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 xl:grid-cols-3">
        <Cartao className="xl:col-span-2"><DiaAgenda crm={crm} ac={ac} dia={sel} /></Cartao>
        <Cartao><Atencao crm={crm} ac={ac} /></Cartao>
      </div>

      {/* pipeline */}
      <Cartao>
        <Titulo extra={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-fundo p-1">
              {([["m", "Mês"], ["t", "Trimestre"], ["s", "Semestre"], ["a", "Ano"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => { setG(k); setOff(0); }} className={`rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${g === k ? "bg-marinho-900 text-white" : "text-suave"}`}>{l}</button>
              ))}
            </div>
            <div className="inline-flex items-center rounded-xl border border-linha">
              <button className="p-1.5" onClick={() => setOff(off - 1)} aria-label="Anterior"><ChevronLeft className="size-4" /></button>
              <span className="min-w-[92px] text-center text-[13px] font-bold">{p.rot}</span>
              <button className="p-1.5" onClick={() => setOff(off + 1)} aria-label="Próximo"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        }>Pipeline comercial</Titulo>
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 lg:grid-cols-5">
          <Kpi rotulo="Em aberto" valor={curto(tot("lead") + tot("proposta"))} cor={`linear-gradient(${CIANO}, ${AZUL})`} onClick={() => ac.aba("negocios")} />
          <Kpi rotulo="Em negociação" valor={curto(tot("negociacao"))} tom="text-atencao" cor={`linear-gradient(${LARANJA}, #d63a2f)`} onClick={() => ac.aba("negocios")} />
          <Kpi rotulo="Fechado" valor={curto(tot("ganho"))} tom="text-ok" cor={`linear-gradient(#5be39b, ${VERDE})`} detalhe={conv !== null ? `${conv.toFixed(0)}% de conversão` : undefined} onClick={() => ac.aba("negocios")} />
          <Kpi rotulo="Minha comissão" valor={reais(minha)} cor={`linear-gradient(${CIANO}, ${AZUL})`} detalhe="sobre negócios fechados" />
          <Kpi rotulo="Comissão parceiros" valor={reais(parc)} cor={`linear-gradient(${LARANJA}, #d63a2f)`} detalhe={`${fechados.filter((n) => n.pct_parceiro && !n.comissao_parceiro_paga).length} a pagar`} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 px-3 pb-4 lg:grid-cols-2">
          <div>
            <div className="px-2 text-[12.5px] font-semibold text-suave">Valores por status · {p.rot}</div>
            <div className="h-[210px]">
              <ResponsiveContainer>
                <BarChart data={porEtapa} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke="#e2e8f3" />
                  <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" />
                  <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
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
              Comissões em {p.ano} (negócios fechados)
              <span className="flex items-center gap-1.5 font-normal"><span className="size-2.5 rounded-[3px]" style={{ background: AZUL }} />Minha</span>
              <span className="flex items-center gap-1.5 font-normal"><span className="size-2.5 rounded-[3px]" style={{ background: LARANJA }} />Parceiros</span>
            </div>
            <div className="h-[210px]">
              <ResponsiveContainer>
                <BarChart data={meses} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="#e2e8f3" />
                  <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" interval="preserveStartEnd" minTickGap={4} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11.5} stroke="#66738f" width={44} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <Tooltip formatter={(v, nome) => [reais(Number(v ?? 0)), nome === "minha" ? "Minha" : "Parceiros"]} cursor={{ fill: "rgba(47,111,181,.07)" }} />
                  <Bar dataKey="minha" fill={AZUL} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="parceiros" fill={LARANJA} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Cartao>

      <Cartao><Anotacoes crm={crm} ac={ac} /></Cartao>
    </div>
  );
}

// ------------------------------------------------------------------ semana com horários
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
        </div>
      }>Semana</Titulo>
      <div className="overflow-x-auto px-3 pb-3">
        <div className="grid min-w-[860px] grid-cols-[52px_repeat(7,minmax(108px,1fr))] overflow-hidden rounded-xl border border-linha text-[12px]">
          <div className="bg-fundo" />
          {dias.map((d) => {
            const dt = new Date(d + "T12:00:00");
            return (
              <button key={d} onClick={() => setSel(d)} className={`border-l border-linha bg-fundo px-1 py-2 text-center ${d === sel ? "shadow-[inset_0_-3px_0_#2f6fb5]" : ""}`}>
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
          {a.hora && <span className="inline-flex items-center gap-1"><Clock className="size-3" />{a.hora}</span>}
          {a.parceiro_id && <span>{nomeParceiro(crm, a.parceiro_id)}</span>}
        </div>
        {a.notas ? <p className="mt-1 line-clamp-2 text-[13px] text-tinta/80">📝 {a.notas}</p>
          : !["tarefa", "followup"].includes(a.tipo) && a.data <= hoje() ? <p className="mt-1 text-[12.5px] text-atencao">sem anotação ainda</p> : null}
      </button>
    </li>
  );
}

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

function Atencao({ crm, ac }: { crm: Crm; ac: Acoes }) {
  const h = hoje(), lim = somaDias(h, -30);
  const itens: { icone: typeof AlertTriangle; tom: string; texto: string; sub: string; f: () => void }[] = [];
  crm.atividades.filter((a) => a.tipo === "followup" && !a.concluida && a.data < h).forEach((a) => itens.push({ icone: RefreshCcw, tom: "text-erro", texto: `Follow-up atrasado: ${a.contato || a.titulo}`, sub: dataBr(a.data), f: () => ac.atividade(a) }));
  crm.atividades.filter((a) => a.tipo === "tarefa" && !a.concluida && a.data < h).forEach((a) => itens.push({ icone: ClipboardList, tom: "text-erro", texto: `Tarefa atrasada: ${a.titulo}`, sub: dataBr(a.data), f: () => ac.atividade(a) }));
  crm.atividades.filter((a) => !["tarefa", "followup"].includes(a.tipo) && a.data <= h && !a.notas).forEach((a) => itens.push({ icone: NotebookPen, tom: "text-atencao", texto: `Sem anotação: ${a.titulo}`, sub: dataBr(a.data), f: () => ac.atividade(a) }));
  crm.parceiros.filter((p) => p.etapa === "ativo" && !crm.atividades.some((a) => a.parceiro_id === p.id && a.tipo === "visita" && a.data >= lim))
    .forEach((p) => itens.push({ icone: MapPin, tom: "text-atencao", texto: `Sem visita há 30+ dias: ${p.nome}`, sub: p.escritorio, f: () => ac.verParceiro(p.id) }));
  crm.negocios.filter((n) => ["lead", "proposta", "negociacao"].includes(n.etapa) && n.data_ref < h)
    .forEach((n) => itens.push({ icone: CalendarClock, tom: "text-azul", texto: `Previsão vencida: ${n.cliente_nome || n.titulo}`, sub: `${rotulo(ETAPAS_NEGOCIO, n.etapa)} · ${curto(n.valor_estimado)}`, f: () => ac.negocio(n) }));
  crm.negocios.filter((n) => n.etapa === "ganho" && !n.financeiro_lancado_em)
    .forEach((n) => itens.push({ icone: Wallet, tom: "text-ok", texto: `Fechado sem lançar no Financeiro: ${n.cliente_nome || n.titulo}`, sub: curto(n.valor_estimado), f: () => ac.lancar(n) }));
  return (
    <>
      <Titulo extra={itens.length ? <Chip cor="bg-erro-claro text-erro">{itens.length}</Chip> : null}>Atenção</Titulo>
      <ul className="space-y-0.5 px-3 pb-4">
        {itens.slice(0, 9).map((x, i) => (
          <li key={i}><button onClick={x.f} className="flex w-full gap-3 rounded-xl px-2 py-2 text-left hover:bg-fundo">
            <x.icone className={`mt-0.5 size-[17px] shrink-0 ${x.tom}`} />
            <span className="min-w-0"><span className="block text-[13.5px] font-semibold">{x.texto}</span>{x.sub && <span className="block text-[12px] text-suave">{x.sub}</span>}</span>
          </button></li>
        ))}
        {!itens.length && <li className="flex items-center gap-2 px-2 py-2 text-[13.5px] font-semibold text-ok"><Check className="size-4" />Tudo em dia.</li>}
      </ul>
    </>
  );
}

function Anotacoes({ crm, ac }: { crm: Crm; ac: Acoes }) {
  const [f, setF] = useState<"todas" | "reuniao" | "visita" | "negocio">("todas");
  type N = { d: string; t: string; x: string; s: string; k: string; go: () => void };
  let L: N[] = [
    ...crm.atividades.filter((a) => a.notas && !["tarefa", "followup"].includes(a.tipo)).map((a) => ({ d: a.data, t: a.titulo, x: a.notas, s: rotulo(TIPOS_AGENDA, a.tipo) + (a.parceiro_id ? ` · ${nomeParceiro(crm, a.parceiro_id)}` : ""), k: a.tipo === "visita" ? "visita" : "reuniao", go: () => ac.atividade(a) })),
    ...crm.negocios.filter((n) => n.observacoes).map((n) => ({ d: n.data_ref, t: n.cliente_nome || n.titulo, x: n.observacoes, s: `${rotulo(ETAPAS_NEGOCIO, n.etapa)} · ${curto(n.valor_estimado)}`, k: "negocio", go: () => ac.negocio(n) })),
  ];
  L = L.filter((x) => f === "todas" || x.k === f).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 10);
  return (
    <>
      <Titulo extra={<div className="inline-flex rounded-xl bg-fundo p-1">{([["todas", "Todas"], ["reuniao", "Reuniões"], ["visita", "Visitas"], ["negocio", "Negócios"]] as const).map(([k, l]) => (
        <button key={k} onClick={() => setF(k)} className={`rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${f === k ? "bg-marinho-900 text-white" : "text-suave"}`}>{l}</button>
      ))}</div>}>Anotações recentes</Titulo>
      <ul className="divide-y divide-linha pb-2">
        {L.map((x, i) => (
          <li key={i}><button onClick={x.go} className="block w-full px-5 py-3 text-left hover:bg-fundo/60">
            <div className="text-[14px] font-semibold">{x.t} <span className="text-[12px] font-normal text-suave">· {dataBr(x.d)} · {x.s}</span></div>
            <p className="mt-0.5 line-clamp-2 text-[13px] text-tinta/80">{x.x}</p>
          </button></li>
        ))}
        {!L.length && <li className="px-5 pb-4 text-[13.5px] text-suave">Nenhuma anotação ainda. Registre nas reuniões, visitas e negócios.</li>}
      </ul>
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
                    className="sombra-bra cursor-pointer rounded-xl border border-linha bg-white p-3 transition hover:-translate-y-px">
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
            <button key={p.id} onClick={() => ac.verParceiro(p.id)} className="sombra-bra rounded-[18px] border border-linha bg-white p-4 text-left transition hover:-translate-y-0.5">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-azul to-marinho-900 font-display text-[14px] font-bold text-white">{p.nome.split(/\s+/).map((x) => x[0]).slice(0, 2).join("")}</div>
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
      <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul p-5 text-white lg:p-6">
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
        <Kpi rotulo="Em andamento" valor={curto(and.reduce((s, n) => s + n.valor_estimado, 0))} tom="text-atencao" cor={`linear-gradient(${LARANJA}, #d63a2f)`} />
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
          <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); if (rapida.trim()) { ac.atividade({ tipo: "tarefa", titulo: rapida.trim(), data: dia, salvarDireto: true } as Partial<Atividade>); setRapida(""); } }}>
            <input className="min-w-0 flex-1 rounded-xl border border-linha bg-white px-3 py-2 text-[14px] outline-none focus:border-azul" placeholder="Nova tarefa e Enter" value={rapida} onChange={(e) => setRapida(e.target.value)} />
            <Botao tipo="pri" type="submit">Adicionar</Botao>
          </form>
        </>}
      </div>
      <Cartao>
        <Titulo>{modo === "agenda" ? "Próximos compromissos" : modo === "followup" ? "Follow-ups" : `Tarefas de ${dataBr(dia)}`}</Titulo>
        <ul className="divide-y divide-linha pb-2">{proximas.map((a) => <LinhaAtividade key={a.id} crm={crm} ac={ac} a={a} mostrarData />)}</ul>
        {!proximas.length && <p className="flex items-center gap-2 px-5 pb-5 text-[13.5px] text-suave"><Building2 className="size-4" />{modo === "tarefa" ? "Dia livre." : "Nada pendente."}</p>}
      </Cartao>
      {passadas.length > 0 && (
        <Cartao><Titulo>Realizados</Titulo><ul className="divide-y divide-linha pb-2">{passadas.map((a) => <LinhaAtividade key={a.id} crm={crm} ac={ac} a={a} mostrarData />)}</ul></Cartao>
      )}
    </div>
  );
}
