"use client";
// Lista de propostas (como a do Zenith, embaixo do orçamento) e a lista geral.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, FileDown, FilePlus2, GitBranch, Loader2, MoreHorizontal, Pencil, Search, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { campo, Janela, reais } from "@/components/crm/ui";
import { mensagemErro, supabase } from "@/lib/supabase";
import { abrirOrcamento, carregarCatalogo, duplicarOrcamento, excluirOrcamento, listarOrcamentos, mudarStatus, ResumoOrc, STATUS_ORC, StatusOrc } from "@/lib/orcamentos";
import { linkDocumento } from "@/lib/pasta";

const dataHora = (s: string) => { const d = new Date(s.length === 10 ? s + "T12:00:00" : s); return `${d.toLocaleDateString("pt-BR")}${s.length > 10 ? " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}`; };

export function Status({ s }: { s: StatusOrc }) {
  const x = STATUS_ORC[s] ?? STATUS_ORC.enviada;
  return <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"><span className="size-2 rounded-full" style={{ background: x.cor }} />{x.rot}</span>;
}

/** Abre o PDF: o que foi gerado aqui ou o arquivo original que veio do Zenith. */
export async function abrirPdf(r: Pick<ResumoOrc, "id" | "documento_id" | "itens">) {
  const janela = window.open("", "_blank");
  try {
    let url: string | null = null;
    if (r.itens > 0) {
      const [{ gerarPdfOrcamento }, o, cat] = await Promise.all([import("@/lib/orcamento-pdf"), abrirOrcamento(r.id), carregarCatalogo()]);
      url = URL.createObjectURL(await gerarPdfOrcamento(o, Object.fromEntries(cat.produtos.map((p) => [p.id, p.imagem_path]))));
    } else if (r.documento_id) {
      const { data } = await supabase().from("documentos").select("storage_path, nome").eq("id", r.documento_id).single();
      if (data?.storage_path) url = await linkDocumento(data.storage_path);
    }
    if (!url) throw new Error("Este orçamento não tem itens nem PDF guardado.");
    if (janela) janela.location.href = url; else window.open(url, "_blank");
  } catch (e) { janela?.close(); throw e; }
}

function Menu({ r, onAcao }: { r: ResumoOrc; onAcao: (a: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora); return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const op: [string, string, typeof Pencil, string?][] = [
    ["editar", "Editar", Pencil], ["pdf", "Exportar PDF", FileDown], ["versao", "Nova versão", GitBranch], ["copia", "Clonar", Copy],
    ["ganhar", "Marcar como ganha", ThumbsUp, "text-ok"], ["perder", "Marcar como perdida", ThumbsDown, "text-erro"], ["excluir", "Excluir", Trash2, "text-erro"],
  ];
  return (
    <div ref={caixa} className="relative">
      <button type="button" onClick={() => setAberto(!aberto)} className="rounded-lg border border-linha p-1.5 text-suave hover:bg-fundo" aria-label={`Ações da proposta ${r.numero}`}><MoreHorizontal className="size-4" /></button>
      {aberto && (
        <ul className="absolute top-full left-0 z-30 mt-1 w-52 overflow-hidden rounded-xl border border-linha bg-white py-1 shadow-[0_20px_50px_-12px_rgba(14,26,61,.35)]">
          {op.map(([k, rot, I, cor]) => <li key={k}><button type="button" onClick={() => { setAberto(false); onAcao(k); }} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-fundo ${cor ?? ""}`}><I className="size-4" />{rot}</button></li>)}
        </ul>
      )}
    </div>
  );
}

function useAcoes(recarregar: () => void, onAbrir: (id: string) => void) {
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState<string | null>(null);
  const acao = async (r: ResumoOrc, a: string) => {
    setErro(""); setOcupado(r.id);
    try {
      if (a === "editar") return onAbrir(r.id);
      if (a === "pdf") await abrirPdf(r);
      if (a === "versao" || a === "copia") { const id = await duplicarOrcamento(r.id, a); onAbrir(id); }
      if (a === "ganhar") await mudarStatus([r.id], "aprovada");
      if (a === "perder") await mudarStatus([r.id], "recusada");
      if (a === "excluir") { if (!confirm(`Excluir a proposta ${r.numero} (${r.titulo})? Não dá para desfazer.`)) return; await excluirOrcamento(r.id); }
      recarregar();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(null); }
  };
  return { erro, setErro, ocupado, acao };
}

/** As propostas do negócio, embaixo do editor (igual ao Zenith). */
export function PropostasDoNegocio({ negocioId, atual, onAbrir, recarga = 0 }: { negocioId: string; atual: string | null; onAbrir: (id: string) => void; recarga?: number }) {
  const [lista, setLista] = useState<ResumoOrc[] | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [copiar, setCopiar] = useState(false);
  const { erro, setErro, ocupado, acao } = useAcoes(() => carregar(), onAbrir);
  const carregar = useCallback(() => listarOrcamentos({ negocio: negocioId }).then(setLista).catch((e) => { setLista([]); setErro(mensagemErro(e)); }), [negocioId, setErro]);
  useEffect(() => { carregar(); }, [carregar, recarga]);
  const emLote = async (s: StatusOrc) => { try { await mudarStatus(marcadas, s); setMarcadas([]); carregar(); } catch (e) { setErro(mensagemErro(e)); } };
  return (
    <section className="sombra-bra rounded-[18px] border border-linha bg-white">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
        <Link href={`/orcamentos/?novo=${negocioId}`} className="inline-flex items-center gap-1.5 rounded-xl border border-azul px-3 py-1.5 text-[13px] font-semibold text-azul hover:bg-[#eef3fb]"><FilePlus2 className="size-4" />Nova proposta</Link>
        <button type="button" onClick={() => setCopiar(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-linha px-3 py-1.5 text-[13px] font-semibold hover:shadow-md"><Copy className="size-4" />Copiar proposta de outro negócio</button>
        <button type="button" disabled={!marcadas.length} onClick={() => emLote("recusada")} className="inline-flex items-center gap-1.5 rounded-xl bg-[#d64545] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40"><ThumbsDown className="size-4" />Perder propostas</button>
        <button type="button" disabled={!marcadas.length} onClick={() => emLote("aprovada")} className="inline-flex items-center gap-1.5 rounded-xl bg-ok px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40"><ThumbsUp className="size-4" />Ganhar propostas</button>
      </div>
      {erro && <p role="alert" className="mx-4 mb-3 rounded-xl bg-erro-claro px-4 py-2 text-[13px] text-erro">{erro}</p>}
      <TabelaPropostas lista={lista} marcadas={marcadas} setMarcadas={setMarcadas} atual={atual} ocupado={ocupado} onAcao={acao} />
      <CopiarDeOutro aberto={copiar} onFechar={() => setCopiar(false)} destino={negocioId} onCopiado={(id) => { setCopiar(false); onAbrir(id); }} />
    </section>
  );
}

function TabelaPropostas({ lista, marcadas, setMarcadas, atual, ocupado, onAcao, comNegocio = false }: {
  lista: ResumoOrc[] | null; marcadas?: string[]; setMarcadas?: (x: string[]) => void; atual?: string | null; ocupado: string | null;
  onAcao: (r: ResumoOrc, a: string) => void; comNegocio?: boolean;
}) {
  if (!lista) return <div className="flex items-center gap-2 px-5 py-8 text-suave"><Loader2 className="size-4 animate-spin" />Carregando…</div>;
  if (!lista.length) return <p className="px-5 pb-6 text-[13.5px] text-suave">Nenhuma proposta ainda.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13.5px]">
        <thead><tr className="border-y border-linha bg-fundo text-left text-[12px] font-semibold text-suave">
          <th className="w-10 px-3 py-2" />{setMarcadas && <th className="w-8 px-1 py-2"><input type="checkbox" aria-label="Marcar todas" checked={!!marcadas?.length && marcadas.length === lista.length} onChange={(e) => setMarcadas(e.target.checked ? lista.map((r) => r.id) : [])} /></th>}
          <th className="px-2 py-2">Código</th><th className="px-2 py-2">Data edição</th><th className="px-2 py-2">Nome</th>{comNegocio && <th className="px-2 py-2">Negócio</th>}
          <th className="px-2 py-2">Versão</th><th className="px-2 py-2">Status</th><th className="px-3 py-2 text-right">Valor</th>
        </tr></thead>
        <tbody>
          {lista.map((r) => (
            <tr key={r.id} className={`border-b border-linha last:border-0 ${r.id === atual ? "bg-[#eef3fb]" : "hover:bg-fundo/60"}`}>
              <td className="px-3 py-2">{ocupado === r.id ? <Loader2 className="size-4 animate-spin text-azul" /> : <Menu r={r} onAcao={(a) => onAcao(r, a)} />}</td>
              {setMarcadas && <td className="px-1 py-2"><input type="checkbox" aria-label={`Marcar ${r.numero}`} checked={marcadas?.includes(r.id)} onChange={(e) => setMarcadas(e.target.checked ? [...(marcadas ?? []), r.id] : (marcadas ?? []).filter((x) => x !== r.id))} /></td>}
              <td className="num px-2 py-2 font-semibold">{r.numero}{r.origem === "zenith" && <span className="ml-1.5 rounded bg-fundo px-1 text-[10.5px] font-bold text-suave" title="Veio do Zenith">Z</span>}</td>
              <td className="num px-2 py-2 whitespace-nowrap text-suave">{dataHora(r.editado_em || r.data_emissao)}</td>
              <td className="px-2 py-2"><button type="button" onClick={() => onAcao(r, "editar")} className="text-left font-medium hover:text-azul hover:underline">{r.titulo || "(sem nome)"}</button>{!r.itens && <span className="ml-1.5 text-[11.5px] text-suave">só PDF</span>}</td>
              {comNegocio && <td className="px-2 py-2 text-suave">{r.negocio_numero ? `${r.negocio_numero} - ` : ""}{r.negocio || r.cliente || "—"}</td>}
              <td className="px-2 py-2">{r.versao || "V1"}</td>
              <td className="px-2 py-2"><Status s={r.status} /></td>
              <td className="num px-3 py-2 text-right font-semibold">{reais(r.total_final)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopiarDeOutro({ aberto, onFechar, destino, onCopiado }: { aberto: boolean; onFechar: () => void; destino: string; onCopiado: (id: string) => void }) {
  const [lista, setLista] = useState<ResumoOrc[] | null>(null), [q, setQ] = useState(""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState("");
  useEffect(() => { if (aberto && !lista) listarOrcamentos().then(setLista).catch((e) => setErro(mensagemErro(e))); }, [aberto, lista]);
  const filtrada = useMemo(() => (lista ?? []).filter((r) => r.oportunidade_id !== destino && `${r.numero} ${r.titulo} ${r.negocio} ${r.cliente}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60), [lista, q, destino]);
  const copiar = async (r: ResumoOrc) => {
    setOcupado(r.id); setErro("");
    try {
      const { data } = await supabase().from("oportunidades").select("cliente_id").eq("id", destino).single();
      onCopiado(await duplicarOrcamento(r.id, "copia", { oportunidade_id: destino, cliente_id: data?.cliente_id ?? null }));
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(""); }
  };
  return (
    <Janela titulo="Copiar proposta de outro negócio" aberto={aberto} onFechar={onFechar} largura="max-w-2xl">
      <div className="space-y-3">
        <div className="relative"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" /><input autoFocus className={`${campo} pl-9`} placeholder="Número, nome ou cliente" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {erro && <p className="text-[13px] text-erro">{erro}</p>}
        <ul className="max-h-[50dvh] divide-y divide-linha overflow-y-auto rounded-xl border border-linha">
          {filtrada.map((r) => (
            <li key={r.id}><button type="button" disabled={!!ocupado || !r.itens} onClick={() => copiar(r)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-fundo disabled:opacity-50">
              <span className="num w-10 font-semibold">{r.numero}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.titulo}</span><span className="block truncate text-[12px] text-suave">{r.negocio || r.cliente}{!r.itens ? " · sem itens" : ""}</span></span>
              <span className="num text-[13px] font-semibold">{ocupado === r.id ? <Loader2 className="size-4 animate-spin" /> : reais(r.total_final)}</span>
            </button></li>
          ))}
          {lista && !filtrada.length && <li className="px-3 py-4 text-center text-[13px] text-suave">Nada encontrado.</li>}
          {!lista && <li className="px-3 py-4 text-center text-[13px] text-suave">Carregando…</li>}
        </ul>
      </div>
    </Janela>
  );
}

/** Todos os orçamentos, com busca e filtro de status. */
export function ListaOrcamentos({ onAbrir }: { onAbrir: (id: string) => void }) {
  const [lista, setLista] = useState<ResumoOrc[] | null>(null), [q, setQ] = useState(""), [st, setSt] = useState<"" | StatusOrc>("");
  const [falha, setFalha] = useState("");
  const carregar = useCallback(() => listarOrcamentos().then(setLista).catch((e) => { setLista([]); setFalha(mensagemErro(e)); }), []);
  useEffect(() => { carregar(); }, [carregar]);
  const { erro: erroAcao, ocupado, acao } = useAcoes(carregar, onAbrir);
  const erro = erroAcao || falha;
  const filtrada = useMemo(() => (lista ?? []).filter((r) => (!st || r.status === st) && `${r.numero} ${r.titulo} ${r.negocio} ${r.cliente}`.toLowerCase().includes(q.toLowerCase())), [lista, q, st]);
  const soma = filtrada.reduce((s, r) => s + r.total_final, 0);
  return (
    <section className="sombra-bra rounded-[18px] border border-linha bg-white">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4 pb-3">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-suave" /><input className={`${campo} pl-9`} placeholder="Buscar por número, nome, negócio ou cliente" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={`${campo} w-auto`} value={st} onChange={(e) => setSt(e.target.value as StatusOrc | "")} aria-label="Status">
          <option value="">Todos os status</option>{(Object.keys(STATUS_ORC) as StatusOrc[]).map((k) => <option key={k} value={k}>{STATUS_ORC[k].rot}</option>)}
        </select>
        <span className="text-[13px] text-suave">{filtrada.length} · <b className="num text-tinta">{reais(soma)}</b></span>
      </div>
      {erro && <p role="alert" className="mx-4 mb-3 rounded-xl bg-erro-claro px-4 py-2 text-[13px] text-erro">{erro}</p>}
      <TabelaPropostas lista={lista ? filtrada : null} ocupado={ocupado} onAcao={acao} comNegocio />
      <p className="px-5 py-3 text-[12px] text-suave">Para criar um orçamento, abra o negócio no CRM e use <b>Novo orçamento</b> na pasta do cliente.</p>
    </section>
  );
}
