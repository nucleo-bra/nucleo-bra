"use client";
// Histórico de alterações: quem criou, alterou ou excluiu o quê, e quando. Só a diretoria vê.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, History, Loader2, LogIn, Search, ShieldCheck } from "lucide-react";
import { Shell } from "@/components/Shell";
import { AREAS, carregarHistorico, mudancas, nomeTabela, Registro, rotuloCampo, rotuloRegistro, verbo } from "@/lib/historico";
import { mensagemErro, supabase } from "@/lib/supabase";

const PERIODOS: [string, string, number][] = [["hoje", "Hoje", 0], ["7", "7 dias", 7], ["30", "30 dias", 30], ["90", "90 dias", 90], ["365", "12 meses", 365]];
const COR: Record<string, string> = { INSERT: "bg-ok-claro text-ok", UPDATE: "bg-[#e8f0fa] text-azul", DELETE: "bg-erro-claro text-erro" };
const desde = (dias: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - dias); return d.toISOString(); };
const dia = (s: string) => new Date(s).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const hora = (s: string) => new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function Historico() {
  const registro = useSearchParams().get("registro") ?? "";
  const [periodo, setPeriodo] = useState(registro ? "365" : "7");
  const [usuario, setUsuario] = useState(""), [area, setArea] = useState(""), [acao, setAcao] = useState(""), [q, setQ] = useState("");
  const [lista, setLista] = useState<Registro[] | null>(null), [mais, setMais] = useState(false);
  const [pessoas, setPessoas] = useState<Map<string, string>>(new Map());
  const [aberto, setAberto] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);

  const filtros = useMemo(() => ({
    desde: desde(PERIODOS.find((p) => p[0] === periodo)![2]), usuario: usuario || undefined,
    tabelas: area ? AREAS.find((a) => a[0] === area)![2] : undefined, acao: acao || undefined, registro: registro || undefined,
  }), [periodo, usuario, area, acao, registro]);

  const carregar = useCallback(async (anexar = false) => {
    setErro(""); setOcupado(true);
    try {
      const de = anexar ? (lista?.length ?? 0) : 0;
      const L = await carregarHistorico(filtros, de, de + 199);
      setLista(anexar ? [...(lista ?? []), ...L] : L); setMais(L.length === 200);
    } catch (e) { setErro(mensagemErro(e)); setLista([]); } finally { setOcupado(false); }
  }, [filtros, lista]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(false); }, [filtros]);
  useEffect(() => {
    supabase().from("perfis").select("id, nome").then(({ data }) => setPessoas(new Map(((data ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]))));
  }, []);

  const filtrada = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (lista ?? []).filter((r) => !t || `${rotuloRegistro(r)} ${nomeTabela(r.tabela)} ${pessoas.get(r.usuario_id ?? "") ?? ""} ${mudancas(r).map((m) => `${m.campo} ${m.de} ${m.para}`).join(" ")}`.toLowerCase().includes(t));
  }, [lista, q, pessoas]);
  const porDia = useMemo(() => {
    const m = new Map<string, Registro[]>();
    for (const r of filtrada) { const k = r.ocorrido_em.slice(0, 10); m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m];
  }, [filtrada]);
  const alternar = (id: number) => setAberto((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sel = "rounded-xl border border-linha bg-white px-3 py-2 text-[13.5px]";

  return (
    <Shell titulo="Histórico">
      <p className="-mt-3 mb-4 max-w-3xl text-[14px] text-suave">Tudo o que foi criado, alterado ou excluído no Núcleo, com quem fez e quando, além das entradas no sistema. O histórico não pode ser editado nem apagado.</p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm">
          {PERIODOS.map(([k, r]) => <button key={k} onClick={() => setPeriodo(k)} className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${periodo === k ? "bg-marinho-900 text-white" : "text-suave"}`}>{r}</button>)}
        </div>
        <select className={sel} value={usuario} onChange={(e) => setUsuario(e.target.value)} aria-label="Pessoa"><option value="">Todas as pessoas</option>{[...pessoas].sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select className={sel} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Área"><option value="">Todas as áreas</option>{AREAS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select>
        <select className={sel} value={acao} onChange={(e) => setAcao(e.target.value)} aria-label="Ação">
          <option value="">Todas as ações</option><option value="INSERT">Criou</option><option value="UPDATE">Alterou</option><option value="DELETE">Excluiu</option><option value="LOGIN">Entradas e saídas</option>
        </select>
        <div className="relative min-w-[200px] flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" /><input className={`${sel} w-full pl-9`} placeholder="Buscar cliente, campo, valor…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {registro && <p className="mb-3 rounded-xl bg-ciano-claro px-4 py-2 text-[13px] text-[#14708c]">Mostrando só o histórico de um registro.</p>}
      {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}

      {!lista ? <p className="flex items-center gap-2 py-10 text-suave"><Loader2 className="size-5 animate-spin" />Carregando…</p>
        : !filtrada.length ? <div className="sombra-bra rounded-[18px] border border-linha bg-white px-6 py-12 text-center text-suave"><History className="mx-auto mb-2 size-7" />Nada no período.</div>
        : (
          <div className="space-y-4">
            {porDia.map(([d, L]) => (
              <section key={d} className="sombra-bra overflow-hidden rounded-[18px] border border-linha bg-white">
                <h2 className="border-b border-linha bg-fundo/60 px-5 py-2 text-[12.5px] font-bold text-suave capitalize">{dia(L[0].ocorrido_em)} · {L.length}</h2>
                <ul className="divide-y divide-linha">
                  {L.map((r) => {
                    const m = mudancas(r), acesso = r.tabela === "acessos" || r.acao.startsWith("MFA"), quem = pessoas.get(r.usuario_id ?? "") ?? (r.usuario_id ? "Usuário removido" : "Sistema");
                    const abre = m.length > 0 || r.acao === "INSERT" || r.acao === "DELETE";
                    return (
                      <li key={r.id} className="px-5 py-2.5">
                        <button onClick={() => abre && alternar(r.id)} className="flex w-full items-start gap-3 text-left">
                          <span className="num w-11 shrink-0 pt-0.5 text-[12.5px] text-suave">{hora(r.ocorrido_em)}</span>
                          {acesso ? <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-fundo text-suave">{r.acao.startsWith("MFA") ? <ShieldCheck className="size-3" /> : <LogIn className="size-3" />}</span>
                            : <span className={`mt-0.5 shrink-0 rounded px-1.5 py-px text-[10.5px] font-bold uppercase ${COR[r.acao] ?? "bg-fundo text-suave"}`}>{verbo(r)}</span>}
                          <span className="min-w-0 flex-1 text-[13.5px]">
                            <b>{quem}</b> {acesso ? verbo(r) : <>{verbo(r)} {nomeTabela(r.tabela).toLowerCase()}</>}{" "}
                            {!acesso || r.acao === "MFA_ZERADO" ? <span className="font-semibold text-marinho-900">{r.acao === "MFA_ZERADO" ? String((r.depois as { nome?: string })?.nome ?? "") : rotuloRegistro(r)}</span> : r.depois && (r.depois as { detalhe?: string }).detalhe ? <span className="text-suave">· {(r.depois as { detalhe?: string }).detalhe}</span> : null}
                            {m.length > 0 && !aberto.has(r.id) && <span className="block truncate text-[12.5px] text-suave">{m.slice(0, 4).map((x) => rotuloCampo(x.campo)).join(", ")}{m.length > 4 ? ` e mais ${m.length - 4}` : ""}</span>}
                          </span>
                          {abre && (aberto.has(r.id) ? <ChevronDown className="size-4 shrink-0 text-suave" /> : <ChevronRight className="size-4 shrink-0 text-suave" />)}
                        </button>
                        {aberto.has(r.id) && (
                          <div className="mt-2 ml-14 overflow-x-auto rounded-xl bg-fundo/70 px-3 py-2 text-[12.5px]">
                            {m.length ? (
                              <table className="w-full"><tbody>{m.map((x) => (
                                <tr key={x.campo} className="align-top"><td className="py-0.5 pr-3 font-semibold whitespace-nowrap text-suave">{rotuloCampo(x.campo)}</td><td className="py-0.5 pr-2 text-erro line-through decoration-erro/40">{x.de}</td><td className="py-0.5 pr-2 text-suave">→</td><td className="py-0.5 font-medium text-ok">{x.para}</td></tr>
                              ))}</tbody></table>
                            ) : (
                              <dl className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[160px_1fr]">
                                {Object.entries((r.depois ?? r.antes ?? {}) as Record<string, unknown>).filter(([k, v]) => v !== null && v !== "" && !["id", "created_at", "updated_at", "sha256", "busca"].includes(k)).slice(0, 24).map(([k, v]) => (
                                  <div key={k} className="contents"><dt className="font-semibold text-suave">{rotuloCampo(k)}</dt><dd className="break-words">{typeof v === "object" ? JSON.stringify(v).slice(0, 200) : String(v).slice(0, 200)}</dd></div>
                                ))}
                              </dl>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {mais && <button onClick={() => carregar(true)} disabled={ocupado} className="mx-auto flex items-center gap-2 rounded-xl border border-linha bg-white px-4 py-2 text-[13.5px] font-semibold hover:border-azul">{ocupado && <Loader2 className="size-4 animate-spin" />}Carregar mais</button>}
          </div>
        )}
    </Shell>
  );
}

export default function Pagina() { return <Suspense><Historico /></Suspense>; }
