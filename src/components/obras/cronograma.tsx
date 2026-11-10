"use client";
// Cronograma editável da obra: etapas com datas previstas e realizadas e linha do tempo.
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarRange, Check, Play, Plus, Trash2, Wand2 } from "lucide-react";
import { Caixa } from "@/components/projetos/painel-quadro";
import { dataBr, distribuirDatas, Etapa, excluirEtapa, hojeIso, ObraCompleta, salvarEtapa, salvarEtapas, situacaoEtapa } from "@/lib/obras";
import { Membro } from "@/lib/projetos";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";

const inp = "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13.5px] outline-none hover:border-linha focus:border-azul focus:bg-white";
const DIA = 864e5;
const t = (s: string) => new Date(s + "T12:00:00").getTime();

export function Cronograma({ d, equipe, onMudou }: { d: ObraCompleta; equipe: Membro[]; onMudou: () => void }) {
  const [E, setE] = useState<Etapa[]>(d.etapas);
  const [erro, setErro] = useState("");
  const [tecnicos, setTecnicos] = useState<string[]>([]);
  useEffect(() => setE(d.etapas), [d.etapas]);
  useEffect(() => { if (!modoDemo) supabase().from("tecnicos").select("nome").then(({ data }) => setTecnicos((data ?? []).map((x) => x.nome))); }, []);
  const nomes = [...new Set([...equipe.filter((m) => m.papel === "tecnico" || m.papel === "diretoria").map((m) => m.nome), ...tecnicos])];
  const hoje = hojeIso();

  async function campo(e: Etapa, campos: Partial<Etapa>) {
    setE((L) => L.map((x) => (x.id === e.id ? { ...x, ...campos } : x)));
    try { await salvarEtapa({ id: e.id, obra_id: e.obra_id, ...campos }); } catch (x) { setErro(mensagemErro(x)); onMudou(); }
  }
  async function nova() {
    try { const n = await salvarEtapa({ obra_id: d.obra.id, nome: "Nova etapa", posicao: (E[E.length - 1]?.posicao ?? 0) + 1000 }); setE((L) => [...L, n]); } catch (x) { setErro(mensagemErro(x)); }
  }
  async function mover(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= E.length) return;
    const L = [...E]; const a = L[i].posicao; L[i] = { ...L[i], posicao: L[j].posicao }; L[j] = { ...L[j], posicao: a };
    [L[i], L[j]] = [L[j], L[i]]; setE(L);
    try { await salvarEtapas([L[i], L[j]]); } catch (x) { setErro(mensagemErro(x)); onMudou(); }
  }
  async function remover(e: Etapa) {
    if (!confirm(`Remover a etapa “${e.nome}”?`)) return;
    setE((L) => L.filter((x) => x.id !== e.id));
    try { await excluirEtapa(e.id); } catch (x) { setErro(mensagemErro(x)); onMudou(); }
  }
  async function distribuir() {
    const ini = d.obra.inicio, fim = d.obra.previsao_entrega;
    if (!ini || !fim) { setErro("Preencha o início e a previsão de entrega na Visão geral para distribuir as datas."); return; }
    if (E.some((e) => e.inicio_prev || e.fim_prev) && !confirm("Substituir as datas previstas de todas as etapas?")) return;
    const L = distribuirDatas(E, ini, fim); setE(L);
    try { await salvarEtapas(L); } catch (x) { setErro(mensagemErro(x)); }
  }

  // linha do tempo
  const g = useMemo(() => {
    const datas = E.flatMap((e) => [e.inicio_prev, e.fim_prev, e.inicio_real, e.fim_real]).filter(Boolean) as string[];
    if (d.obra.previsao_entrega) datas.push(d.obra.previsao_entrega);
    if (!datas.length) return null;
    const ini = Math.min(...datas.map(t), t(hoje)) - DIA, fim = Math.max(...datas.map(t), t(hoje)) + 2 * DIA;
    const pos = (s: string) => ((t(s) - ini) / (fim - ini)) * 100;
    const meses: { rot: string; x: number }[] = [];
    const m = new Date(ini); m.setDate(1); m.setMonth(m.getMonth() + 1);
    while (m.getTime() < fim) { meses.push({ rot: m.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), x: ((m.getTime() - ini) / (fim - ini)) * 100 }); m.setMonth(m.getMonth() + 1); }
    return { pos, meses, hoje: pos(hoje), entrega: d.obra.previsao_entrega ? pos(d.obra.previsao_entrega) : null };
  }, [E, d.obra.previsao_entrega, hoje]);

  return (
    <div className="space-y-4 lg:space-y-5">
      {erro && <p role="alert" className="rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
      <Caixa titulo="Etapas da obra" icone={CalendarRange} extra={
        <div className="flex gap-2">
          <button onClick={distribuir} className="inline-flex items-center gap-1.5 rounded-full border border-linha bg-white px-3 py-1.5 text-[12.5px] font-semibold hover:border-azul"><Wand2 className="size-3.5" />Distribuir datas</button>
          <button onClick={nova} className="inline-flex items-center gap-1.5 rounded-full bg-azul px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-azul-escuro"><Plus className="size-3.5" />Etapa</button>
        </div>}>
        <datalist id="resp-obra">{nomes.map((n) => <option key={n} value={n} />)}</datalist>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-[13px]">
            <thead><tr className="border-y border-linha bg-[#f7f9fc] text-[12px] text-suave">
              <th className="w-16 py-2 pl-5" /><th className="min-w-[220px] py-2">Etapa</th><th className="w-44">Responsável</th>
              <th className="w-32">Início previsto</th><th className="w-32">Fim previsto</th><th className="w-32">Início real</th><th className="w-32">Fim real</th><th className="w-28">Situação</th><th className="w-28 pr-5" />
            </tr></thead>
            <tbody className="divide-y divide-linha">
              {E.map((e, i) => { const s = situacaoEtapa(e, hoje); return (
                <tr key={e.id} className="group">
                  <td className="pl-5"><span className="flex flex-col opacity-40 group-hover:opacity-100">
                    <button onClick={() => mover(i, -1)} aria-label="Subir" className="rounded p-0.5 hover:bg-fundo"><ArrowUp className="size-3.5" /></button>
                    <button onClick={() => mover(i, 1)} aria-label="Descer" className="rounded p-0.5 hover:bg-fundo"><ArrowDown className="size-3.5" /></button></span></td>
                  <td><input defaultValue={e.nome} onBlur={(x) => x.target.value.trim() && x.target.value !== e.nome && campo(e, { nome: x.target.value.trim() })} className={`${inp} font-semibold`} aria-label="Nome da etapa" /></td>
                  <td><input list="resp-obra" defaultValue={e.responsavel ?? ""} onBlur={(x) => x.target.value !== (e.responsavel ?? "") && campo(e, { responsavel: x.target.value || null })} className={inp} placeholder="—" aria-label="Responsável" /></td>
                  {(["inicio_prev", "fim_prev", "inicio_real", "fim_real"] as const).map((k) => (
                    <td key={k}><input type="date" value={e[k] ?? ""} onChange={(x) => campo(e, { [k]: x.target.value || null })} className={inp} aria-label={k} /></td>
                  ))}
                  <td><span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: s.cor }}><span className="size-2 rounded-full" style={{ background: s.cor }} />{s.rot}</span></td>
                  <td className="pr-5"><span className="flex justify-end gap-1">
                    {!e.inicio_real && <button onClick={() => campo(e, { inicio_real: hoje })} title="Iniciar hoje" className="rounded-lg p-1.5 text-azul hover:bg-[#eef5ff]"><Play className="size-4" /></button>}
                    {!e.fim_real && <button onClick={() => campo(e, { fim_real: hoje, inicio_real: e.inicio_real ?? hoje })} title="Concluir hoje" className="rounded-lg p-1.5 text-ok hover:bg-ok-claro"><Check className="size-4" /></button>}
                    <button onClick={() => remover(e)} title="Remover etapa" className="rounded-lg p-1.5 text-suave hover:bg-erro-claro hover:text-erro"><Trash2 className="size-4" /></button>
                  </span></td>
                </tr>); })}
              {!E.length && <tr><td colSpan={9} className="py-8 text-center text-suave">Sem etapas. Clique em “Etapa” para começar.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-suave">Cada fechamento pode ter etapas próprias: renomeie, inclua, remova e reordene. “Distribuir datas” divide o prazo entre o início e a previsão de entrega.</p>
      </Caixa>

      <Caixa titulo="Linha do tempo" icone={CalendarRange} extra={<span className="flex gap-3 text-[12px] text-suave"><Leg c="#c9dcf7" t="Previsto" /><Leg c="#0071e3" t="Realizado" /><Leg c="#ff3b30" t="Hoje" linha /></span>}>
        {!g ? <p className="py-6 text-center text-[13px] text-suave">Preencha as datas das etapas para ver a linha do tempo.</p> : (
          <div className="relative pt-6">
            <div className="absolute top-0 right-0 left-[180px] h-full">
              {g.meses.map((m) => <span key={m.x} className="absolute top-0 h-full border-l border-dashed border-linha pl-1 text-[11px] text-suave" style={{ left: `${m.x}%` }}>{m.rot}</span>)}
              <span className="absolute top-0 h-full border-l-2 border-erro" style={{ left: `${g.hoje}%` }} />
              {g.entrega != null && <span className="absolute top-0 h-full border-l-2 border-dashed border-ok" style={{ left: `${g.entrega}%` }} title="Entrega prevista" />}
            </div>
            <ul className="relative space-y-2">
              {E.map((e) => {
                const ip = e.inicio_prev ?? e.fim_prev, fp = e.fim_prev ?? e.inicio_prev, ir = e.inicio_real, fr = e.fim_real ?? (e.inicio_real ? hoje : null);
                return (
                  <li key={e.id} className="flex items-center">
                    <span className="w-[180px] shrink-0 truncate pr-3 text-[12.5px] font-semibold" title={e.nome}>{e.nome}</span>
                    <span className="relative h-6 flex-1 rounded-md bg-fundo/60">
                      {ip && fp && <span className="absolute top-0.5 h-2.5 rounded bg-[#c9dcf7]" style={{ left: `${g.pos(ip)}%`, width: `max(6px, ${g.pos(fp) - g.pos(ip) + 100 / 60}%)` }} title={`Previsto: ${dataBr(ip)} a ${dataBr(fp)}`} />}
                      {ir && fr && <span className="absolute bottom-0.5 h-2.5 rounded" style={{ left: `${g.pos(ir)}%`, width: `max(6px, ${g.pos(fr) - g.pos(ir) + 100 / 60}%)`, background: e.fim_prev && (e.fim_real ?? hoje) > e.fim_prev ? "#ff9500" : "#0071e3" }} title={`Realizado: ${dataBr(ir)} a ${dataBr(e.fim_real)}`} />}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Caixa>
    </div>
  );
}
function Leg({ c, t, linha }: { c: string; t: string; linha?: boolean }) {
  return <span className="inline-flex items-center gap-1.5"><span className={linha ? "h-3 w-0.5" : "h-2 w-4 rounded"} style={{ background: c }} />{t}</span>;
}
