"use client";
// Documentação de entrega: um cartão por documento, agrupados por capítulo do PDF final.
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Eye, EyeOff, FileDown, FileText, Lock, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Doc, excluirDoc, GRUPOS, lerSenhas, MODELOS_DOC, ModeloDoc, novoDoc, ObraCompleta, preenchimento, salvarDoc, STATUS_DOC } from "@/lib/obras";
import { gerarDocumentacao } from "@/lib/obra-pdf";
import { mensagemErro } from "@/lib/supabase";
import { EditorDoc } from "./editores";

const ROT_MODELO: Record<string, string> = Object.fromEntries([["capa", "Modelo BRA"], ["encerramento", "Encerramento"], ...MODELOS_DOC.map((m) => [m.modelo, m.rot])]);

export function Documentacao({ d, papel, docInicial, onMudou }: { d: ObraCompleta; papel: string | null; docInicial?: string | null; onMudou: () => void }) {
  const [docs, setDocs] = useState<Doc[]>(d.docs);
  const [aberto, setAberto] = useState<string | null>(docInicial ?? null);
  const [erro, setErro] = useState("");
  const [senhas, setSenhas] = useState<Record<string, string> | null>(null);
  const [novo, setNovo] = useState<{ modelo: ModeloDoc; grupo: string; titulo: string } | null>(null);
  const [gerar, setGerar] = useState(false);
  const [progresso, setProgresso] = useState("");
  const podeSenha = papel === "diretoria" || papel === "tecnico";
  useEffect(() => setDocs(d.docs), [d.docs]);
  useEffect(() => { if (podeSenha) lerSenhas(d.obra.id).then(setSenhas).catch(() => setSenhas({})); }, [podeSenha, d.obra.id]);

  const grupos = useMemo(() => {
    const gs = [...new Set([...GRUPOS, ...docs.map((x) => x.grupo)])];
    return gs.map((g) => ({ g, ds: docs.filter((x) => x.grupo === g).sort((a, b) => a.posicao - b.posicao) })).filter((x) => x.ds.length);
  }, [docs]);
  const incl = docs.filter((x) => x.incluir), ok = incl.filter((x) => x.status === "aprovado").length;
  const doc = docs.find((x) => x.id === aberto) ?? null;

  function abrir(id: string | null) {
    setAberto(id);
    const u = new URL(location.href); if (id) u.searchParams.set("doc", id); else u.searchParams.delete("doc"); history.replaceState(null, "", u.toString());
  }
  async function alternar(x: Doc) {
    setDocs((L) => L.map((y) => (y.id === x.id ? { ...y, incluir: !y.incluir } : y)));
    try { await salvarDoc(x.id, { incluir: !x.incluir }); } catch (e) { setErro(mensagemErro(e)); onMudou(); }
  }
  async function criar() {
    if (!novo?.titulo.trim()) return;
    try {
      const pos = Math.max(0, ...docs.filter((x) => x.grupo === novo.grupo).map((x) => x.posicao)) + 10;
      const n = await novoDoc(d.obra.id, novo.modelo, novo.grupo, novo.titulo.trim(), pos);
      setDocs((L) => [...L, n]); setNovo(null); abrir(n.id);
    } catch (e) { setErro(mensagemErro(e)); }
  }
  async function remover(x: Doc) {
    if (!confirm(`Excluir o cartão “${x.titulo}” e o que foi preenchido nele?`)) return;
    setDocs((L) => L.filter((y) => y.id !== x.id));
    try { await excluirDoc(x.id); } catch (e) { setErro(mensagemErro(e)); onMudou(); }
  }
  async function baixar(comSenhas: boolean) {
    setErro(""); setProgresso("Preparando…");
    try {
      const s = podeSenha ? (senhas ?? await lerSenhas(d.obra.id)) : {};
      const b = await gerarDocumentacao(d.obra, docs, comSenhas && podeSenha, s, setProgresso);
      const a = document.createElement("a"); a.href = URL.createObjectURL(b);
      a.download = `Documentacao_${(d.obra.cliente_nome ?? "obra").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\W+/g, "_")}${comSenhas ? "" : "_sem_senhas"}.pdf`; a.click();
      setGerar(false);
    } catch (e) { setErro(mensagemErro(e)); } finally { setProgresso(""); }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[19px] font-bold">Documentação de entrega</h2>
          <p className="text-[13px] text-suave">Preencha cada cartão. Os aprovados entram no caderno final, com capa e apresentação no modelo BRA.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-suave"><b className="text-tinta">{ok}</b>/{incl.length} aprovados</span>
          <button onClick={() => setNovo({ modelo: "galeria", grupo: GRUPOS[1], titulo: "" })} className="inline-flex items-center gap-1.5 rounded-full border border-linha bg-white px-3.5 py-2 text-[13px] font-semibold hover:border-azul"><Plus className="size-4" />Cartão</button>
          <button onClick={() => setGerar(true)} className="inline-flex items-center gap-1.5 rounded-full bg-azul px-4 py-2 text-[13px] font-semibold text-white hover:bg-azul-escuro"><FileDown className="size-4" />Gerar documentação final</button>
        </div>
      </div>
      {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}

      <div className="space-y-6">
        {grupos.map(({ g, ds }) => (
          <section key={g}>
            <h3 className="mb-2 text-[12.5px] font-bold tracking-[.12em] text-suave uppercase">{g}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {ds.map((x) => {
                const pct = Math.round(preenchimento(x, senhas ?? {}) * 100), st = STATUS_DOC[x.status];
                return (
                  <div key={x.id} className={`sombra-bra group relative flex flex-col rounded-[16px] border bg-white transition hover:-translate-y-0.5 hover:shadow-lg ${x.incluir ? "border-linha" : "border-dashed border-linha opacity-60"}`}>
                    <button onClick={() => abrir(x.id)} className="flex flex-1 flex-col gap-2 p-4 text-left">
                      <span className="flex items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-lg bg-fundo text-suave">{x.modelo === "senhas" ? <Lock className="size-4" /> : <FileText className="size-4" />}</span>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: st.cor, background: st.fundo }}>{st.rot}</span>
                      </span>
                      <b className="text-[14px] leading-snug">{x.titulo}</b>
                      <span className="text-[12px] text-suave">{ROT_MODELO[x.modelo] ?? x.modelo}</span>
                      {x.modelo !== "capa" && <span className="mt-auto flex items-center gap-2 pt-1">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fundo"><span className="block h-full rounded-full bg-gradient-to-r from-ciano to-azul" style={{ width: `${pct}%` }} /></span>
                        <span className="num text-[11.5px] font-semibold text-suave">{pct}%</span>
                      </span>}
                    </button>
                    <div className="flex items-center gap-1 border-t border-linha px-2 py-1.5">
                      <button onClick={() => alternar(x)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-suave hover:bg-fundo" title={x.incluir ? "Sai no PDF final" : "Não sai no PDF final"}>
                        {x.incluir ? <CheckCircle2 className="size-3.5 text-ok" /> : <Circle className="size-3.5" />}{x.incluir ? "No PDF" : "Fora do PDF"}
                      </button>
                      {x.modelo !== "capa" && <button onClick={() => remover(x)} className="ml-auto rounded-md p-1 text-suave opacity-0 hover:bg-erro-claro hover:text-erro group-hover:opacity-100" aria-label="Excluir cartão"><Trash2 className="size-3.5" /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {doc && <EditorDoc key={doc.id} doc={doc} obra={d} senhas={senhas} podeSenha={podeSenha} onSenhas={setSenhas}
        onSalvo={(c) => setDocs((L) => L.map((y) => (y.id === doc.id ? { ...y, ...c } : y)))} onFechar={() => abrir(null)} />}

      <Modal titulo="Novo cartão de documentação" aberto={!!novo} onFechar={() => setNovo(null)} largura="max-w-xl">
        {novo && <div className="space-y-3">
          <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Título</span>
            <input autoFocus value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} placeholder="Ex.: Configuração do Wi-Fi" className="w-full rounded-xl border border-linha px-3 py-2 text-[14px] outline-none focus:border-azul" /></label>
          <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Capítulo no PDF</span>
            <select value={novo.grupo} onChange={(e) => setNovo({ ...novo, grupo: e.target.value })} className="w-full rounded-xl border border-linha px-3 py-2 text-[14px]">{GRUPOS.filter((g) => g !== "Encerramento").map((g) => <option key={g}>{g}</option>)}</select></label>
          <div><span className="mb-1 block text-[12px] font-semibold text-suave">Modelo</span>
            <div className="grid grid-cols-2 gap-1.5">{MODELOS_DOC.map((m) => (
              <button key={m.modelo} onClick={() => setNovo({ ...novo, modelo: m.modelo, titulo: novo.titulo || m.rot })} className={`rounded-xl border px-3 py-2 text-left text-[13px] ${novo.modelo === m.modelo ? "border-azul bg-[#eef5ff]" : "border-linha"}`}>
                <b className="block">{m.rot}</b><span className="text-[11.5px] text-suave">{m.desc}</span></button>))}</div></div>
          <button onClick={criar} disabled={!novo.titulo.trim()} className="w-full rounded-xl bg-azul py-2.5 text-[14px] font-semibold text-white disabled:opacity-40">Criar cartão</button>
        </div>}
      </Modal>

      <Modal titulo="Gerar documentação final" aberto={gerar} onFechar={() => !progresso && setGerar(false)}>
        <div className="space-y-3 text-[14px]">
          <p className="text-suave">O PDF junta a capa e a apresentação BRA, o sumário e todos os cartões marcados “No PDF”, na ordem dos capítulos.</p>
          {incl.length - ok > 0 && <p className="rounded-xl bg-atencao-claro px-3 py-2 text-[13px] text-atencao">{incl.length - ok} cartão(ões) ainda não aprovados. Eles saem do jeito que estão; cartões vazios não aparecem.</p>}
          <button onClick={() => baixar(true)} disabled={!!progresso || !podeSenha} className="flex w-full items-center gap-3 rounded-xl border border-linha px-4 py-3 text-left hover:border-azul disabled:opacity-40">
            <Eye className="size-5 text-azul" /><span><b className="block">Com senhas · via do cliente</b><span className="text-[12.5px] text-suave">Usuários e senhas aparecem no PDF. {podeSenha ? "" : "Só técnico e diretoria."}</span></span></button>
          <button onClick={() => baixar(false)} disabled={!!progresso} className="flex w-full items-center gap-3 rounded-xl border border-linha px-4 py-3 text-left hover:border-azul disabled:opacity-40">
            <EyeOff className="size-5 text-suave" /><span><b className="block">Sem senhas · cópia interna ou parceiros</b><span className="text-[12.5px] text-suave">As senhas saem como ••••••.</span></span></button>
          {progresso && <p className="text-center text-[13px] font-semibold text-azul">{progresso}</p>}
        </div>
      </Modal>
    </div>
  );
}
