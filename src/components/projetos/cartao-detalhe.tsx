"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarPlus, ExternalLink, MapPin, MessageCircle, Phone, ShieldCheck, User } from "lucide-react";
import {
  AlignLeft, Archive, ArrowRightLeft, CheckSquare, Clock, CreditCard, Link2, MessageSquare, Paperclip, Pencil, Plus, Tag, Trash2, Upload, Users, X,
} from "lucide-react";
import {
  abrirAnexo, anexarArquivo, anexarLink, Anexo, Cartao, comentar, Comentario, CORES, criarEtiqueta, criarItem, Etiqueta, excluirAnexo,
  excluirCartao, excluirComentario, excluirEtiqueta, excluirItem, listarAnexos, listarComentarios, Membro, posEntre, QuadroCompleto,
  salvarCartao, salvarEtiqueta, salvarItem, Modulo, PRIORIDADES, criarCartao, quadroDoModulo, carregarQuadro,
} from "@/lib/projetos";
import { mensagemErro } from "@/lib/supabase";
import { Avatar, situacaoPrazo } from "./pecas";

const pad = (n: number) => String(n).padStart(2, "0");
const paraInput = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const tempo = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const tamanho = (b: number | null) => (b == null ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function CartaoDetalhe({ c, d, equipe, onFechar, onMudou, onSumiu, onEtiquetas, modulo = "projetos" }: {
  c: Cartao; d: QuadroCompleto; equipe: Membro[]; onFechar: () => void; modulo?: Modulo;
  onMudou: (campos: Partial<Cartao>) => void; onSumiu: () => void; onEtiquetas: (e: Etiqueta[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [erro, setErro] = useState("");
  const [painel, setPainel] = useState<"" | "membros" | "etiquetas" | "prazo" | "mover" | "capa" | "anexo">("");
  const [desc, setDesc] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(c.titulo);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [novoItem, setNovoItem] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [eu, setEu] = useState<string | null>(null);

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    listarComentarios(c.id).then(setComentarios).catch(() => {});
    listarAnexos(c.id).then(setAnexos).catch(() => {});
    import("@/lib/supabase").then(({ modoDemo, supabase }) => { if (modoDemo) setEu("m1"); else supabase().auth.getUser().then(({ data }) => setEu(data.user?.id ?? null)); });
  }, [c.id]);

  const rodar = async (f: () => Promise<unknown>) => { setErro(""); try { await f(); } catch (e) { setErro(mensagemErro(e)); } };
  const salvar = (campos: Partial<Cartao>) => rodar(async () => { onMudou(campos); await salvarCartao(c.id, campos as never); });
  const lista = d.listas.find((l) => l.id === c.lista_id);
  const E = c.etiquetas.map((id) => d.etiquetas.find((e) => e.id === id)).filter(Boolean) as Etiqueta[];
  const M = c.membros.map((id) => equipe.find((m) => m.id === id)).filter(Boolean) as Membro[];
  const feitos = c.checklist.filter((k) => k.feito).length, total = c.checklist.length;
  const sp = situacaoPrazo(c);
  const nomeDe = (id: string | null) => equipe.find((m) => m.id === id)?.nome ?? "Alguém";

  const Botao = ({ icone: I, rot, k }: { icone: typeof Tag; rot: string; k: typeof painel }) => (
    <button onClick={() => setPainel(painel === k ? "" : k)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13.5px] font-semibold ${painel === k ? "bg-marinho-900 text-white" : "bg-[#e9ecf1] text-tinta hover:bg-[#dfe3ea]"}`}>
      <I className="size-4" />{rot}
    </button>
  );

  return (
    <dialog ref={ref} onClose={onFechar} onClick={(e) => e.target === ref.current && onFechar()}
      className="m-auto mt-[4dvh] w-[calc(100%-16px)] max-w-[768px] overflow-hidden rounded-[18px] bg-[#f6f7f9] p-0 text-tinta shadow-2xl backdrop:bg-black/55">
      <div className="max-h-[92dvh] overflow-y-auto">
        {c.capa && <div className="h-24" style={{ background: CORES[c.capa] ?? c.capa }} />}
        <div className="flex items-start gap-3 px-5 pt-4">
          <CreditCard className="mt-1.5 size-5 shrink-0 text-suave" />
          <div className="min-w-0 flex-1">
            <textarea value={titulo} rows={1} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo.trim() && titulo !== c.titulo && salvar({ titulo: titulo.trim() })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
              className="w-full resize-none rounded-lg border-0 bg-transparent px-1 py-0.5 font-display text-[20px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-azul" />
            <p className="px-1 text-[13px] text-suave">{c.numero != null && modulo !== "projetos" ? <b className="text-tinta">{modulo === "chamados" ? "Chamado" : "Agendamento"} #{c.numero} · </b> : null}na lista <b className="text-tinta underline decoration-dotted">{lista?.nome}</b></p>
          </div>
          <button onClick={onFechar} className="rounded-full p-1.5 hover:bg-black/10" aria-label="Fechar"><X className="size-5" /></button>
        </div>

        <div className="grid gap-5 px-5 pt-4 pb-6 md:grid-cols-[1fr_180px]">
          <div className="min-w-0 space-y-6">
            {/* membros, etiquetas, prazo */}
            {(M.length > 0 || E.length > 0 || c.prazo) && (
              <div className="flex flex-wrap gap-x-6 gap-y-3 pl-8">
                {M.length > 0 && <div><div className="mb-1 text-[12px] font-semibold text-suave">Membros</div><div className="flex gap-1">{M.map((m) => <Avatar key={m.id} m={m} tam={32} />)}<button onClick={() => setPainel("membros")} className="grid size-8 place-items-center rounded-full bg-[#e9ecf1] hover:bg-[#dfe3ea]" aria-label="Adicionar membro"><Plus className="size-4" /></button></div></div>}
                {E.length > 0 && <div><div className="mb-1 text-[12px] font-semibold text-suave">Etiquetas</div><div className="flex flex-wrap gap-1">{E.map((e) => <button key={e.id} onClick={() => setPainel("etiquetas")} className="h-8 min-w-12 rounded-[4px] px-3 text-[13px] font-bold text-white" style={{ background: CORES[e.cor] ?? e.cor }}>{e.nome}</button>)}<button onClick={() => setPainel("etiquetas")} className="grid size-8 place-items-center rounded-[4px] bg-[#e9ecf1] hover:bg-[#dfe3ea]" aria-label="Etiquetas"><Plus className="size-4" /></button></div></div>}
                {c.prazo && <div><div className="mb-1 text-[12px] font-semibold text-suave">Data de entrega</div>
                  <label className="inline-flex h-8 items-center gap-2 rounded-[4px] bg-[#e9ecf1] px-2 text-[13.5px]">
                    <input type="checkbox" checked={c.prazo_concluido} onChange={(e) => salvar({ prazo_concluido: e.target.checked })} className="size-4" />
                    {tempo(c.prazo)}{sp?.rot && <span className={`rounded px-1.5 py-0.5 text-[11.5px] font-bold ${sp.cls}`}>{sp.rot}</span>}
                  </label></div>}
              </div>
            )}

            {modulo !== "projetos" && <Atendimento c={c} modulo={modulo} salvar={salvar} rodar={rodar} />}

            {/* descrição */}
            <section>
              <h3 className="mb-2 flex items-center gap-3 text-[15px] font-bold"><AlignLeft className="size-5 text-suave" />Descrição
                {c.descricao && desc === null && <button onClick={() => setDesc(c.descricao)} className="ml-auto rounded-lg bg-[#e9ecf1] px-3 py-1 text-[13px] font-semibold hover:bg-[#dfe3ea]">Editar</button>}</h3>
              <div className="pl-8">
                {desc !== null ? (
                  <>
                    <textarea autoFocus rows={6} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Detalhes do serviço, endereço, contato no local, materiais…"
                      className="w-full rounded-xl border border-linha bg-white px-3 py-2 text-[14px] outline-none focus:border-azul" />
                    <div className="mt-1.5 flex gap-2">
                      <button onClick={() => { const v = desc; setDesc(null); salvar({ descricao: v }); }} className="rounded-lg bg-azul px-3 py-1.5 text-[13.5px] font-semibold text-white">Salvar</button>
                      <button onClick={() => setDesc(null)} className="rounded-lg px-3 py-1.5 text-[13.5px] font-semibold hover:bg-black/5">Cancelar</button>
                    </div>
                  </>
                ) : c.descricao ? (
                  <p onClick={() => setDesc(c.descricao)} className="cursor-text text-[14px] whitespace-pre-wrap">{c.descricao}</p>
                ) : (
                  <button onClick={() => setDesc("")} className="h-14 w-full rounded-xl bg-[#e9ecf1] px-3 text-left text-[14px] text-suave hover:bg-[#dfe3ea]">Adicione uma descrição mais detalhada…</button>
                )}
              </div>
            </section>

            {/* anexos */}
            {anexos.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-3 text-[15px] font-bold"><Paperclip className="size-5 text-suave" />Anexos</h3>
                <ul className="space-y-2 pl-8">
                  {anexos.map((a) => (
                    <li key={a.id} className="flex items-center gap-3">
                      <span className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-[#e9ecf1] text-[11px] font-bold text-suave uppercase">{a.url ? "link" : (a.nome.split(".").pop() ?? "").slice(0, 4)}</span>
                      <div className="min-w-0 flex-1">
                        <button onClick={() => rodar(async () => window.open(await abrirAnexo(a), "_blank", "noopener"))} className="block max-w-full truncate text-left text-[14px] font-semibold hover:underline">{a.nome}</button>
                        <div className="text-[12px] text-suave">{tempo(a.created_at)}{a.tamanho ? ` · ${tamanho(a.tamanho)}` : ""}</div>
                      </div>
                      <button onClick={() => rodar(async () => { await excluirAnexo(a); setAnexos(anexos.filter((x) => x.id !== a.id)); onMudou({ anexos: c.anexos - 1 }); })} className="rounded-lg p-1.5 text-suave hover:bg-erro-claro hover:text-erro" aria-label="Excluir anexo"><Trash2 className="size-4" /></button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* checklist */}
            {(total > 0 || novoItem !== null) && (
              <section>
                <h3 className="mb-2 flex items-center gap-3 text-[15px] font-bold"><CheckSquare className="size-5 text-suave" />Checklist</h3>
                <div className="pl-8">
                  <div className="mb-2 flex items-center gap-2 text-[12px] text-suave">
                    <span className="w-8">{total ? Math.round((feitos / total) * 100) : 0}%</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e2e5ea]"><div className={`h-full rounded-full transition-all ${feitos === total && total ? "bg-ok" : "bg-azul"}`} style={{ width: `${total ? (feitos / total) * 100 : 0}%` }} /></div>
                  </div>
                  <ul className="space-y-0.5">
                    {[...c.checklist].sort((a, b) => a.posicao - b.posicao).map((k) => (
                      <li key={k.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[#e9ecf1]">
                        <input type="checkbox" checked={k.feito} className="size-4" onChange={(e) => rodar(async () => { k.feito = e.target.checked; onMudou({ checklist: [...c.checklist] }); await salvarItem(k.id, { feito: k.feito }); })} />
                        <span className={`flex-1 text-[14px] ${k.feito ? "text-suave line-through" : ""}`}>{k.texto}</span>
                        <button onClick={() => rodar(async () => { onMudou({ checklist: c.checklist.filter((x) => x.id !== k.id) }); await excluirItem(k.id); })} className="rounded p-1 text-suave opacity-0 group-hover:opacity-100 hover:text-erro" aria-label="Excluir item"><X className="size-4" /></button>
                      </li>
                    ))}
                  </ul>
                  {novoItem !== null ? (
                    <form className="mt-1.5" onSubmit={(e) => { e.preventDefault(); const t = novoItem.trim(); if (!t) return; setNovoItem(""); rodar(async () => {
                      const ult = c.checklist.length ? Math.max(...c.checklist.map((k) => k.posicao)) : undefined;
                      const it = await criarItem(c.id, t, posEntre(ult, undefined)); onMudou({ checklist: [...c.checklist, { ...it, posicao: Number(it.posicao) }] }); }); }}>
                      <input autoFocus value={novoItem} onChange={(e) => setNovoItem(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setNovoItem(null)} placeholder="Adicionar um item"
                        className="w-full rounded-lg border-2 border-azul bg-white px-2.5 py-1.5 text-[14px] outline-none" />
                      <div className="mt-1.5 flex gap-2"><button type="submit" className="rounded-lg bg-azul px-3 py-1.5 text-[13.5px] font-semibold text-white">Adicionar</button>
                        <button type="button" onClick={() => setNovoItem(null)} className="rounded-lg px-3 py-1.5 text-[13.5px] font-semibold hover:bg-black/5">Fechar</button></div>
                    </form>
                  ) : <button onClick={() => setNovoItem("")} className="mt-1.5 rounded-lg bg-[#e9ecf1] px-3 py-1.5 text-[13.5px] font-semibold hover:bg-[#dfe3ea]">Adicionar um item</button>}
                </div>
              </section>
            )}

            {/* comentários */}
            <section>
              <h3 className="mb-2 flex items-center gap-3 text-[15px] font-bold"><MessageSquare className="size-5 text-suave" />Comentários e atividade</h3>
              <div className="pl-8">
                <form onSubmit={(e) => { e.preventDefault(); const t = texto.trim(); if (!t) return; setTexto(""); rodar(async () => { const x = await comentar(c.id, t); setComentarios([x, ...comentarios]); onMudou({ comentarios: c.comentarios + 1 }); }); }}>
                  <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva um comentário…"
                    className="w-full rounded-xl border border-linha bg-white px-3 py-2 text-[14px] outline-none focus:border-azul" />
                  {texto.trim() && <button type="submit" className="mt-1.5 rounded-lg bg-azul px-3 py-1.5 text-[13.5px] font-semibold text-white">Salvar</button>}
                </form>
                <ul className="mt-3 space-y-3">
                  {comentarios.map((x) => {
                    const m = equipe.find((p) => p.id === x.autor);
                    return (
                      <li key={x.id} className="flex gap-2.5">
                        {m ? <Avatar m={m} tam={30} /> : <span className="size-[30px] rounded-full bg-[#e2e5ea]" />}
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px]"><b>{nomeDe(x.autor)}</b> <span className="text-suave">{tempo(x.created_at)}</span></div>
                          <div className="mt-0.5 rounded-xl bg-white px-3 py-2 text-[14px] whitespace-pre-wrap shadow-[0_1px_1px_rgba(9,30,66,.15)]">{x.texto}</div>
                          {x.autor === eu && <button onClick={() => rodar(async () => { await excluirComentario(x.id); setComentarios(comentarios.filter((y) => y.id !== x.id)); onMudou({ comentarios: c.comentarios - 1 }); })} className="mt-0.5 text-[12px] text-suave underline">Excluir</button>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
            {erro && <p role="alert" className="rounded-lg bg-erro-claro px-3 py-2 text-[13px] text-erro">{erro}</p>}
          </div>

          {/* ações */}
          <aside className="space-y-1.5">
            <div className="text-[12px] font-semibold text-suave">Adicionar ao cartão</div>
            <Botao icone={Users} rot="Membros" k="membros" />
            {painel === "membros" && (
              <div className="rounded-xl border border-linha bg-white p-2">
                {equipe.map((m) => {
                  const tem = c.membros.includes(m.id);
                  return <button key={m.id} onClick={() => salvar({ membros: tem ? c.membros.filter((x) => x !== m.id) : [...c.membros, m.id] })}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13.5px] hover:bg-fundo"><Avatar m={m} tam={24} /><span className="flex-1 truncate">{m.nome}</span>{tem && <CheckSquare className="size-4 text-azul" />}</button>;
                })}
                {equipe.length <= 1 && <p className="px-2 py-1 text-[12px] text-suave">Cadastre o login dos técnicos para atribuir cartões a eles.</p>}
              </div>
            )}
            <Botao icone={Tag} rot="Etiquetas" k="etiquetas" />
            {painel === "etiquetas" && <EditorEtiquetas d={d} c={c} onEtiquetas={onEtiquetas} salvar={salvar} rodar={rodar} />}
            <button onClick={() => { setPainel(""); setNovoItem(""); }} className="flex w-full items-center gap-2 rounded-lg bg-[#e9ecf1] px-3 py-1.5 text-left text-[13.5px] font-semibold text-tinta hover:bg-[#dfe3ea]"><CheckSquare className="size-4" />Checklist</button>
            <Botao icone={Clock} rot="Datas" k="prazo" />
            {painel === "prazo" && (
              <div className="space-y-2 rounded-xl border border-linha bg-white p-2.5 text-[13px]">
                <label className="block"><span className="text-suave">Entrega</span>
                  <input type="datetime-local" defaultValue={paraInput(c.prazo)} onChange={(e) => e.target.value && salvar({ prazo: new Date(e.target.value).toISOString() })}
                    className="mt-0.5 w-full rounded-lg border border-linha px-2 py-1.5" /></label>
                {c.prazo && <button onClick={() => salvar({ prazo: null, prazo_concluido: false })} className="w-full rounded-lg bg-[#e9ecf1] px-2 py-1.5 font-semibold">Remover data</button>}
              </div>
            )}
            <Botao icone={Paperclip} rot="Anexo" k="anexo" />
            {painel === "anexo" && <EditorAnexo c={c} rodar={rodar} aoAnexar={(a) => { setAnexos([a, ...anexos]); onMudou({ anexos: c.anexos + 1 }); setPainel(""); }} />}
            <Botao icone={CreditCard} rot="Capa" k="capa" />
            {painel === "capa" && (
              <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-linha bg-white p-2.5">
                {Object.entries(CORES).map(([k, v]) => <button key={k} onClick={() => salvar({ capa: k })} className={`h-8 rounded-md ${c.capa === k ? "ring-2 ring-azul ring-offset-1" : ""}`} style={{ background: v }} aria-label={k} />)}
                {c.capa && <button onClick={() => salvar({ capa: null })} className="col-span-5 rounded-lg bg-[#e9ecf1] py-1.5 text-[12.5px] font-semibold">Remover capa</button>}
              </div>
            )}
            <div className="pt-3 text-[12px] font-semibold text-suave">Ações</div>
            <Botao icone={ArrowRightLeft} rot="Mover" k="mover" />
            {painel === "mover" && (
              <div className="rounded-xl border border-linha bg-white p-1.5">
                {[...d.listas].sort((a, b) => a.posicao - b.posicao).map((l) => (
                  <button key={l.id} disabled={l.id === c.lista_id} onClick={() => { const ult = Math.max(0, ...d.cartoes.filter((x) => x.lista_id === l.id).map((x) => x.posicao)); salvar({ lista_id: l.id, posicao: ult + 1000 }); setPainel(""); }}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-[13.5px] hover:bg-fundo disabled:font-bold disabled:text-azul">{l.nome}</button>
                ))}
              </div>
            )}
            <button onClick={() => rodar(async () => { await salvarCartao(c.id, { arquivado: true }); onSumiu(); })} className="flex w-full items-center gap-2 rounded-lg bg-[#e9ecf1] px-3 py-1.5 text-left text-[13.5px] font-semibold hover:bg-[#dfe3ea]"><Archive className="size-4" />Arquivar</button>
            <button onClick={() => { if (confirm("Excluir este cartão de vez? Não dá para desfazer.")) rodar(async () => { await excluirCartao(c.id); onSumiu(); }); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13.5px] font-semibold text-erro hover:bg-erro-claro"><Trash2 className="size-4" />Excluir</button>
          </aside>
        </div>
      </div>
    </dialog>
  );
}

function EditorEtiquetas({ d, c, onEtiquetas, salvar, rodar }: {
  d: QuadroCompleto; c: Cartao; onEtiquetas: (e: Etiqueta[]) => void; salvar: (x: Partial<Cartao>) => Promise<void>; rodar: (f: () => Promise<unknown>) => Promise<void>;
}) {
  const [ed, setEd] = useState<Etiqueta | { id: ""; nome: string; cor: string } | null>(null);
  if (ed) return (
    <div className="space-y-2 rounded-xl border border-linha bg-white p-2.5">
      <input autoFocus value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} placeholder="Nome da etiqueta" className="w-full rounded-lg border border-linha px-2 py-1.5 text-[13.5px]" />
      <div className="grid grid-cols-5 gap-1.5">{Object.entries(CORES).map(([k, v]) => <button key={k} onClick={() => setEd({ ...ed, cor: k })} className={`h-7 rounded ${ed.cor === k ? "ring-2 ring-azul ring-offset-1" : ""}`} style={{ background: v }} aria-label={k} />)}</div>
      <div className="flex gap-1.5">
        <button onClick={() => rodar(async () => {
          if (ed.id) { await salvarEtiqueta(ed.id, { nome: ed.nome, cor: ed.cor }); onEtiquetas(d.etiquetas.map((x) => (x.id === ed.id ? { ...x, nome: ed.nome, cor: ed.cor } : x))); }
          else { const n = await criarEtiqueta(d.quadro.id, ed.nome, ed.cor, d.etiquetas.length); onEtiquetas([...d.etiquetas, n]); }
          setEd(null);
        })} className="flex-1 rounded-lg bg-azul py-1.5 text-[13px] font-semibold text-white">Salvar</button>
        {ed.id && <button onClick={() => rodar(async () => { if (!confirm("Excluir esta etiqueta de todos os cartões?")) return; await excluirEtiqueta(ed.id); onEtiquetas(d.etiquetas.filter((x) => x.id !== ed.id)); setEd(null); })} className="rounded-lg px-2 py-1.5 text-[13px] font-semibold text-erro hover:bg-erro-claro">Excluir</button>}
        <button onClick={() => setEd(null)} className="rounded-lg px-2 py-1.5 text-[13px] hover:bg-fundo">Voltar</button>
      </div>
    </div>
  );
  return (
    <div className="space-y-1 rounded-xl border border-linha bg-white p-2">
      {d.etiquetas.map((e) => {
        const tem = c.etiquetas.includes(e.id);
        return (
          <div key={e.id} className="flex items-center gap-1.5">
            <input type="checkbox" checked={tem} className="size-4" onChange={() => salvar({ etiquetas: tem ? c.etiquetas.filter((x) => x !== e.id) : [...c.etiquetas, e.id] })} />
            <button onClick={() => salvar({ etiquetas: tem ? c.etiquetas.filter((x) => x !== e.id) : [...c.etiquetas, e.id] })} className="h-8 flex-1 truncate rounded-[4px] px-2 text-left text-[13px] font-bold text-white" style={{ background: CORES[e.cor] ?? e.cor }}>{e.nome}</button>
            <button onClick={() => setEd(e)} className="rounded p-1.5 text-suave hover:bg-fundo" aria-label="Editar etiqueta"><Pencil className="size-3.5" /></button>
          </div>
        );
      })}
      <button onClick={() => setEd({ id: "", nome: "", cor: "azul" })} className="mt-1 w-full rounded-lg bg-[#e9ecf1] py-1.5 text-[13px] font-semibold hover:bg-[#dfe3ea]">Criar nova etiqueta</button>
    </div>
  );
}

function EditorAnexo({ c, rodar, aoAnexar }: { c: Cartao; rodar: (f: () => Promise<unknown>) => Promise<void>; aoAnexar: (a: Anexo) => void }) {
  const [link, setLink] = useState({ nome: "", url: "" });
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="space-y-2 rounded-xl border border-linha bg-white p-2.5 text-[13px]">
      <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-azul py-2 font-semibold text-white ${enviando ? "opacity-60" : ""}`}>
        <Upload className="size-4" />{enviando ? "Enviando…" : "Foto ou arquivo"}
        <input type="file" className="hidden" disabled={enviando} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.zip" onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
          setEnviando(true); rodar(async () => aoAnexar(await anexarArquivo(c, f))).finally(() => setEnviando(false));
        }} />
      </label>
      <div className="text-suave">ou cole um link (OneDrive, Drive…)</div>
      <input value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder="https://" className="w-full rounded-lg border border-linha px-2 py-1.5" />
      <input value={link.nome} onChange={(e) => setLink({ ...link, nome: e.target.value })} placeholder="Nome (opcional)" className="w-full rounded-lg border border-linha px-2 py-1.5" />
      <button disabled={!link.url} onClick={() => rodar(async () => { aoAnexar(await anexarLink(c.id, link.nome, link.url)); setLink({ nome: "", url: "" }); })}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#e9ecf1] py-1.5 font-semibold disabled:opacity-40"><Link2 className="size-4" />Anexar link</button>
    </div>
  );
}

// ------------------------------------------------------------------ atendimento (chamados e agendamentos)
type ClienteBusca = { id: string; nome: string; telefone: string | null; endereco: string };
let clientesCache: Promise<ClienteBusca[]> | null = null;
function buscarClientes(): Promise<ClienteBusca[]> {
  clientesCache ??= import("@/lib/supabase").then(async ({ modoDemo, supabase }) => {
    if (modoDemo) return [{ id: "d1", nome: "Eduardo Attie", telefone: "19999990000", endereco: "Quinta da Baronesa, Bragança Paulista – SP" }];
    const { data } = await supabase().from("clientes").select("id, nome, nome_fantasia, telefone, logradouro, numero, complemento, bairro, cidade, uf").eq("ativo", true).order("nome").limit(3000);
    return (data ?? []).map((r) => ({
      id: r.id, nome: r.nome_fantasia || r.nome, telefone: r.telefone,
      endereco: [[r.logradouro, r.numero].filter(Boolean).join(", "), r.complemento, r.bairro, [r.cidade, r.uf].filter(Boolean).join(" – ")].filter(Boolean).join(" – "),
    }));
  });
  return clientesCache;
}
const paraLocal = (iso: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const whats = (t: string) => { const n = t.replace(/\D/g, ""); return n ? `https://wa.me/${n.length <= 11 ? "55" + n : n}` : ""; };

function Atendimento({ c, modulo, salvar, rodar }: { c: Cartao; modulo: Modulo; salvar: (x: Partial<Cartao>) => Promise<void>; rodar: (f: () => Promise<unknown>) => Promise<void> }) {
  const [clientes, setClientes] = useState<ClienteBusca[]>([]);
  const [f, setF] = useState({ cliente: c.cliente_nome, telefone: c.telefone, endereco: c.endereco });
  const [visita, setVisita] = useState<string | null>(null);
  useEffect(() => { buscarClientes().then(setClientes).catch(() => {}); }, []);
  const campo = "w-full rounded-lg border border-linha bg-white px-2.5 py-1.5 text-[14px] outline-none focus:border-azul";
  const escolher = (nome: string) => {
    const k = clientes.find((x) => x.nome.toLowerCase() === nome.trim().toLowerCase());
    if (k) {
      const novo = { cliente: k.nome, telefone: f.telefone || k.telefone || "", endereco: f.endereco || k.endereco };
      setF(novo); salvar({ cliente_id: k.id, cliente_nome: k.nome, telefone: novo.telefone, endereco: novo.endereco });
    } else if (nome.trim() !== c.cliente_nome) salvar({ cliente_nome: nome.trim(), cliente_id: null });
  };
  const agendar = () => rodar(async () => {
    const qid = await quadroDoModulo("agendamentos");
    const q = await carregarQuadro(qid);
    const lista = [...q.listas].sort((a, b) => a.posicao - b.posicao)[0];
    const et = q.etiquetas.find((e) => /retorno|visita/i.test(e.nome));
    const novo = await criarCartao(qid, lista.id, `Visita · ${c.titulo}`, Date.now() / 1000, {
      cliente_id: c.cliente_id, cliente_nome: c.cliente_nome, telefone: c.telefone, endereco: c.endereco, origem_id: c.id,
      membros: c.membros, etiquetas: et ? [et.id] : [], descricao: `Chamado #${c.numero ?? ""}: ${c.titulo}${c.descricao ? "\n\n" + c.descricao : ""}`,
    });
    setVisita(novo.id);
  });
  return (
    <section className="rounded-2xl border border-linha bg-white p-3.5">
      <h3 className="mb-2.5 flex items-center gap-2 text-[14px] font-bold"><User className="size-4 text-suave" />{modulo === "chamados" ? "Chamado" : "Atendimento"}</h3>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="mb-0.5 block text-[12px] font-semibold text-suave">Cliente</span>
          <input list="clientes-tecnico" className={campo} value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} onBlur={(e) => escolher(e.target.value)} placeholder="Nome do cliente" />
          <datalist id="clientes-tecnico">{clientes.map((k) => <option key={k.id} value={k.nome} />)}</datalist>
        </label>
        <label><span className="mb-0.5 flex items-center justify-between text-[12px] font-semibold text-suave">Telefone {f.telefone && <a href={whats(f.telefone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ok"><MessageCircle className="size-3.5" />WhatsApp</a>}</span>
          <div className="relative"><Phone className="absolute top-2.5 left-2.5 size-3.5 text-suave" />
            <input className={campo + " pl-8"} value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} onBlur={() => f.telefone !== c.telefone && salvar({ telefone: f.telefone })} placeholder="(19) 99999-9999" /></div>
        </label>
        <label><span className="mb-0.5 flex items-center justify-between text-[12px] font-semibold text-suave">Endereço {f.endereco && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.endereco)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-azul"><MapPin className="size-3.5" />Abrir no mapa</a>}</span>
          <input className={campo} value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} onBlur={() => f.endereco !== c.endereco && salvar({ endereco: f.endereco })} placeholder="Rua, nº, bairro, cidade" />
        </label>
        {modulo === "chamados" && (<>
          <div><span className="mb-0.5 block text-[12px] font-semibold text-suave">Prioridade</span>
            <div className="flex flex-wrap gap-1">{PRIORIDADES.map(([k, r, cls]) => (
              <button key={k} onClick={() => salvar({ prioridade: c.prioridade === k ? null : k })} className={`rounded-full px-2.5 py-1 text-[12.5px] font-bold ${c.prioridade === k ? cls : "bg-[#e9ecf1] text-suave hover:bg-[#dfe3ea]"}`}>{r}</button>
            ))}</div></div>
          <label className="flex items-center gap-2 self-end pb-1.5 text-[13.5px]"><input type="checkbox" className="size-4" checked={!!c.garantia} onChange={(e) => salvar({ garantia: e.target.checked })} />
            <ShieldCheck className="size-4 text-ok" />Atendimento em garantia (sem custo)</label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button onClick={agendar} className="inline-flex items-center gap-1.5 rounded-lg bg-azul px-3 py-1.5 text-[13.5px] font-semibold text-white"><CalendarPlus className="size-4" />Agendar visita</button>
            {visita && <Link href={`/tecnico/agendamentos/?c=${visita}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-azul hover:underline">Visita criada em Agendamentos <ExternalLink className="size-3.5" /></Link>}
          </div>
        </>)}
        {modulo === "agendamentos" && (<>
          <label><span className="mb-0.5 block text-[12px] font-semibold text-suave">Início</span>
            <input type="datetime-local" className={campo} defaultValue={paraLocal(c.agenda_inicio)} onChange={(e) => {
              if (!e.target.value) return salvar({ agenda_inicio: null });
              const ini = new Date(e.target.value);
              const dur = c.agenda_inicio && c.agenda_fim ? new Date(c.agenda_fim).getTime() - new Date(c.agenda_inicio).getTime() : 2 * 3600_000;
              salvar({ agenda_inicio: ini.toISOString(), agenda_fim: new Date(ini.getTime() + dur).toISOString() });
            }} /></label>
          <label><span className="mb-0.5 block text-[12px] font-semibold text-suave">Término</span>
            <input type="datetime-local" key={c.agenda_fim ?? ""} className={campo} defaultValue={paraLocal(c.agenda_fim)} onChange={(e) => salvar({ agenda_fim: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
          {c.origem_id && <Link href={`/tecnico/chamados/?c=${c.origem_id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-azul hover:underline sm:col-span-2">Abrir o chamado de origem <ExternalLink className="size-3.5" /></Link>}
        </>)}
      </div>
    </section>
  );
}
