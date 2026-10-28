"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Lock, ShieldCheck, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { Shell } from "@/components/Shell";
import { listarEquipe, PAPEIS, Papel, Pessoa, salvarPessoa } from "@/lib/equipe";
import { mensagemErro } from "@/lib/supabase";
import { pl } from "@/lib/texto";

const TONS = ["#2f6fb5", "#12a150", "#f5821f", "#7c5cd6", "#0e8f9c", "#d6489b", "#19295a"];
const tom = (id: string) => TONS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % TONS.length];
const iniciais = (n: string) => n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const COR_PAPEL: Record<Papel, string> = { diretoria: "bg-marinho-900 text-white", financeiro: "bg-ok-claro text-ok", comercial: "bg-[#e8f0fa] text-azul", tecnico: "bg-atencao-claro text-atencao" };
const quando = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");

export default function Equipe() {
  const [d, setD] = useState<Awaited<ReturnType<typeof listarEquipe>> | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [escolha, setEscolha] = useState<Record<string, Papel>>({});
  const carregar = () => listarEquipe().then(setD).catch((e) => setErro(mensagemErro(e)));
  useEffect(() => { carregar(); }, []);
  useEffect(() => { if (!ok) return; const t = setTimeout(() => setOk(""), 3500); return () => clearTimeout(t); }, [ok]);

  async function salvar(p: Pessoa, campos: Partial<Pessoa>, msg: string) {
    setErro("");
    try { await salvarPessoa(p.id, campos); setOk(msg); await carregar(); } catch (e) { setErro(mensagemErro(e)); }
  }

  const ativos = (d?.pessoas ?? []).filter((p) => p.ativo);
  const inativos = (d?.pessoas ?? []).filter((p) => !p.ativo).sort((a, b) => b.created_at.localeCompare(a.created_at)); // pedido novo ou acesso retirado

  return (
    <Shell titulo="Equipe" cheio>
      <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-8">
        <div className="mb-5">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold tracking-wide text-suave uppercase"><Users className="size-4" />Acessos ao Núcleo</div>
          <h1 className="font-display text-[24px] font-extrabold tracking-tight lg:text-[28px]">Equipe</h1>
          <p className="max-w-2xl text-[14px] text-suave">Cada pessoa cria o próprio login em <b>Solicitar acesso</b>, na tela de entrada. O pedido chega aqui e no sininho; você escolhe o perfil e libera.</p>
        </div>
        {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
        {d && !d.diretoria && <p className="mb-4 flex items-center gap-2 rounded-xl bg-atencao-claro px-4 py-3 text-atencao"><Lock className="size-4" />Só a diretoria altera acessos. Você pode ver a equipe.</p>}

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {([
            ["Com acesso", ativos.length, "#12a150"], ["Aguardando liberação", inativos.length, "#e8890c"],
            ["Time técnico", ativos.filter((p) => p.papel === "tecnico").length, "#f5821f"], ["Diretoria", ativos.filter((p) => p.papel === "diretoria").length, "#19295a"],
          ] as const).map(([r, v, cor]) => (
            <div key={r} className="sombra-bra relative overflow-hidden rounded-[16px] border border-linha bg-white px-4 py-3 pl-5">
              <span className="absolute top-3 bottom-3 left-0 w-[4px] rounded-r-md" style={{ background: cor }} />
              <div className="text-[12px] font-semibold text-suave">{r}</div>
              <div className="num font-display text-[22px] font-extrabold">{v}</div>
            </div>
          ))}
        </div>

        {/* pedidos */}
        <section className="sombra-bra mb-5 rounded-[18px] border border-linha bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-linha px-5 py-3.5">
            <h2 className="flex items-center gap-2.5 text-[15px] font-bold"><span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" /><UserPlus className="size-4 text-suave" />Aguardando liberação</h2>
            <span className="text-[12.5px] text-suave">{pl(inativos.length, "pessoa", "pessoas")}</span>
          </div>
          {!d ? <p className="px-5 py-6 text-suave">Carregando…</p> : !inativos.length ? (
            <p className="flex items-center gap-2 px-5 py-6 text-[13.5px] text-suave"><CheckCircle2 className="size-4 text-ok" />Nenhum pedido pendente.</p>
          ) : (
            <ul className="divide-y divide-linha">
              {inativos.map((p) => {
                const papel = escolha[p.id] ?? p.papel;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full font-bold text-white" style={{ background: tom(p.id) }}>{iniciais(p.nome)}</span>
                    <div className="min-w-[200px] flex-1">
                      <div className="font-semibold">{p.nome}</div>
                      <div className="text-[12.5px] text-suave">{p.email} · <Clock className="inline size-3" /> pediu em {quando(p.created_at)}</div>
                    </div>
                    <select disabled={!d.diretoria} value={papel} onChange={(e) => setEscolha({ ...escolha, [p.id]: e.target.value as Papel })}
                      className="rounded-xl border border-linha bg-white px-3 py-2 text-[13.5px]" aria-label="Perfil">
                      {PAPEIS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                    </select>
                    <button disabled={!d.diretoria} onClick={() => salvar(p, { ativo: true, papel }, `${p.nome.split(" ")[0]} liberado(a) como ${PAPEIS.find(([k]) => k === papel)![1]}`)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[13.5px] font-semibold text-white shadow-md disabled:opacity-40"><UserCheck className="size-4" />Liberar acesso</button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* com acesso */}
        <section className="sombra-bra mb-5 rounded-[18px] border border-linha bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-linha px-5 py-3.5">
            <h2 className="flex items-center gap-2.5 text-[15px] font-bold"><span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" /><ShieldCheck className="size-4 text-suave" />Com acesso</h2>
          </div>
          <ul className="divide-y divide-linha">
            {ativos.map((p) => {
              const eu = p.id === d?.eu;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full font-bold text-white" style={{ background: tom(p.id) }}>{iniciais(p.nome)}</span>
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2 font-semibold">{p.nome}{eu && <span className="rounded-full bg-fundo px-2 py-px text-[11px] font-bold text-suave">você</span>}</div>
                    <div className="text-[12.5px] text-suave">{p.email}</div>
                  </div>
                  {d?.diretoria && !eu ? (
                    <select value={p.papel} onChange={(e) => salvar(p, { papel: e.target.value as Papel }, `Perfil de ${p.nome.split(" ")[0]} alterado`)}
                      className={`rounded-full border-0 py-1.5 pr-8 pl-3 text-[12.5px] font-bold ${COR_PAPEL[p.papel]}`} aria-label="Perfil">
                      {PAPEIS.map(([k, r]) => <option key={k} value={k} className="bg-white text-tinta">{r}</option>)}
                    </select>
                  ) : <span className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${COR_PAPEL[p.papel]}`}>{PAPEIS.find(([k]) => k === p.papel)?.[1]}</span>}
                  {d?.diretoria && !eu && (
                    <button onClick={() => { if (confirm(`Tirar o acesso de ${p.nome}? A pessoa não consegue mais entrar até você liberar de novo.`)) salvar(p, { ativo: false }, `Acesso de ${p.nome.split(" ")[0]} retirado`); }}
                      className="inline-flex items-center gap-1 rounded-xl border border-linha px-3 py-1.5 text-[12.5px] font-semibold text-suave hover:border-erro hover:text-erro"><UserX className="size-3.5" />Tirar acesso</button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-[18px] border border-linha bg-white/70 p-5">
          <h3 className="mb-2 text-[14px] font-bold">O que cada perfil enxerga</h3>
          <ul className="grid gap-2 text-[13px] sm:grid-cols-2">
            {PAPEIS.map(([k, r, desc]) => <li key={k} className="flex items-start gap-2"><span className={`mt-px rounded-full px-2 py-px text-[11.5px] font-bold ${COR_PAPEL[k]}`}>{r}</span><span className="text-suave">{desc}</span></li>)}
          </ul>
        </section>
      </div>
      {ok && <div role="status" className="fixed right-4 bottom-4 z-50 rounded-xl border-l-4 border-ok bg-marinho-950 px-4 py-3 text-[14px] font-semibold text-white shadow-2xl">✓ {ok}</div>}
    </Shell>
  );
}
