"use client";
// Técnicos sem login: só o nome (e telefone) para alocar nas visitas da agenda técnica.
import { useEffect, useState } from "react";
import { Check, HardHat, Pencil, Plus, RotateCcw, UserMinus, X } from "lucide-react";
import { listarTecnicos, salvarTecnico, TecnicoNome } from "@/lib/equipe";
import { mensagemErro } from "@/lib/supabase";

const iniciais = (n: string) => n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const campo = "rounded-xl border border-linha bg-white px-3 py-2 text-[13.5px] outline-none focus:border-azul";

export function TecnicosNomes({ diretoria, onAviso }: { diretoria: boolean; onAviso: (m: string) => void }) {
  const [lista, setLista] = useState<TecnicoNome[] | null>(null);
  const [nome, setNome] = useState(""), [tel, setTel] = useState("");
  const [editar, setEditar] = useState<TecnicoNome | null>(null);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const carregar = () => listarTecnicos().then(setLista).catch((e) => { setErro(mensagemErro(e)); setLista([]); });
  useEffect(() => { carregar(); }, []);

  async function salvar(t: Partial<TecnicoNome>, msg: string) {
    setErro(""); setOcupado(true);
    try { await salvarTecnico(t); onAviso(msg); await carregar(); return true; }
    catch (e) { setErro(mensagemErro(e)); return false; } finally { setOcupado(false); }
  }
  const ativos = (lista ?? []).filter((t) => t.ativo), inativos = (lista ?? []).filter((t) => !t.ativo);

  return (
    <section className="sombra-bra mb-5 rounded-[18px] border border-linha bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-linha px-5 py-3.5">
        <h2 className="flex items-center gap-2.5 text-[15px] font-bold"><span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" /><HardHat className="size-4 text-suave" />Técnicos (sem acesso ao sistema)</h2>
        <span className="text-[12.5px] text-suave">Aparecem na agenda técnica, nos chamados e nos projetos para alocar.</span>
      </div>
      {diretoria && (
        <form onSubmit={async (e) => { e.preventDefault(); if (await salvar({ nome, telefone: tel }, `${nome.trim().split(" ")[0]} cadastrado(a)`)) { setNome(""); setTel(""); } }}
          className="flex flex-wrap items-center gap-2 border-b border-linha px-5 py-3">
          <input className={`${campo} min-w-[200px] flex-1`} placeholder="Nome do técnico" value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do técnico" />
          <input className={`${campo} w-44`} placeholder="Celular (opcional)" value={tel} onChange={(e) => setTel(e.target.value)} aria-label="Celular" />
          <button disabled={ocupado || !nome.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[13.5px] font-semibold text-white shadow-md disabled:opacity-40"><Plus className="size-4" />Adicionar</button>
        </form>
      )}
      {erro && <p role="alert" className="mx-5 mt-3 rounded-xl bg-erro-claro px-3 py-2 text-[13px] text-erro">{erro}</p>}
      {!lista ? <p className="px-5 py-6 text-suave">Carregando…</p> : !ativos.length ? (
        <p className="px-5 py-6 text-[13.5px] text-suave">Nenhum técnico cadastrado. Adicione os nomes acima para alocar nas visitas.</p>
      ) : (
        <ul className="divide-y divide-linha">
          {ativos.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-atencao font-bold text-white">{iniciais(t.nome)}</span>
              {editar?.id === t.id ? (
                <>
                  <input className={`${campo} min-w-[180px] flex-1`} value={editar.nome} onChange={(e) => setEditar({ ...editar, nome: e.target.value })} aria-label="Nome" />
                  <input className={`${campo} w-44`} value={editar.telefone ?? ""} onChange={(e) => setEditar({ ...editar, telefone: e.target.value })} placeholder="Celular" aria-label="Celular" />
                  <button onClick={async () => { if (await salvar({ id: t.id, nome: editar.nome, telefone: editar.telefone }, "Técnico atualizado")) setEditar(null); }} className="rounded-lg p-2 text-ok hover:bg-fundo" aria-label="Salvar"><Check className="size-4" /></button>
                  <button onClick={() => setEditar(null)} className="rounded-lg p-2 text-suave hover:bg-fundo" aria-label="Cancelar"><X className="size-4" /></button>
                </>
              ) : (
                <>
                  <div className="min-w-[200px] flex-1"><div className="font-semibold">{t.nome}</div><div className="text-[12.5px] text-suave">{t.telefone || "sem celular"} · sem login</div></div>
                  <span className="rounded-full bg-atencao-claro px-3 py-1.5 text-[12.5px] font-bold text-atencao">Técnico</span>
                  {diretoria && <>
                    <button onClick={() => setEditar(t)} className="rounded-lg p-2 text-suave hover:bg-fundo hover:text-azul" aria-label={`Editar ${t.nome}`}><Pencil className="size-4" /></button>
                    <button onClick={() => { if (confirm(`Tirar ${t.nome} da lista de técnicos? As visitas antigas continuam registradas.`)) salvar({ id: t.id, ativo: false }, `${t.nome.split(" ")[0]} saiu da lista`); }}
                      className="inline-flex items-center gap-1 rounded-xl border border-linha px-3 py-1.5 text-[12.5px] font-semibold text-suave hover:border-erro hover:text-erro"><UserMinus className="size-3.5" />Tirar da lista</button>
                  </>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {diretoria && inativos.length > 0 && (
        <div className="border-t border-linha px-5 py-3 text-[12.5px] text-suave">
          Fora da lista: {inativos.map((t, i) => <span key={t.id}>{i > 0 && ", "}{t.nome} <button onClick={() => salvar({ id: t.id, ativo: true }, `${t.nome.split(" ")[0]} voltou para a lista`)} className="inline-flex items-center gap-0.5 font-semibold text-azul hover:underline"><RotateCcw className="size-3" />voltar</button></span>)}
        </div>
      )}
    </section>
  );
}
