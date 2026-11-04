"use client";
// Uma linha de arquivo com as ações de sempre: abrir, editar (nome, tipo ou
// trocar por nova versão — ex.: o Word editado) e excluir.
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Download, FileText, Loader2, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { DocEditavel, editarDocumento, excluirDocumento, substituirDocumento, TIPOS_ARQUIVO_CLIENTE } from "@/lib/pasta";
import { mensagemErro } from "@/lib/supabase";

export const ACEITA_ARQUIVOS = "image/*,application/pdf,.pdf,.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.dwg,.dxf,.skp,.xml,.zip";

const ICONE_COR = (nome: string) =>
  /\.docx?$|\.odt$|\.rtf$/i.test(nome) ? "text-[#2b579a]" : /\.xlsx?$|\.csv$/i.test(nome) ? "text-[#217346]" : /\.pdf$/i.test(nome) ? "text-erro" : "text-azul";

export function LinhaArquivo({ doc, detalhe, abrir, podeExcluir, tipos = TIPOS_ARQUIVO_CLIENTE, onMudou, compacto = false }: {
  doc: DocEditavel; detalhe?: ReactNode; abrir: (path: string, nome: string) => void; podeExcluir: boolean;
  tipos?: readonly (readonly [string, string])[]; onMudou: () => void; compacto?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(doc.nome), [tipo, setTipo] = useState(doc.tipo);
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  const arq = useRef<HTMLInputElement>(null);
  const rodar = async (f: () => Promise<void>) => { setOcupado(true); setErro(""); try { await f(); setEditando(false); onMudou(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); } };
  const px = compacto ? "px-3 py-2" : "px-5 py-3";

  return (
    <li className={`${px}`}>
      <div className="flex items-center gap-3">
        <FileText className={`size-4 shrink-0 ${ICONE_COR(doc.nome)}`} />
        <div className="min-w-0 flex-1"><div className={`truncate ${compacto ? "text-[13px]" : "text-[14px]"} font-medium`}>{doc.nome}</div>{detalhe && <div className="truncate text-[12px] text-suave">{detalhe}</div>}</div>
        {doc.storage_path && <button title="Abrir / baixar" aria-label={`Abrir ${doc.nome}`} onClick={() => abrir(doc.storage_path!, doc.nome)} className="rounded-lg p-1.5 text-azul hover:bg-fundo"><Download className="size-4" /></button>}
        <button title="Editar" aria-label={`Editar ${doc.nome}`} onClick={() => { setEditando(!editando); setNome(doc.nome); setTipo(doc.tipo); setErro(""); }} className={`rounded-lg p-1.5 hover:bg-fundo ${editando ? "text-azul" : "text-suave hover:text-tinta"}`}><Pencil className="size-4" /></button>
        {podeExcluir && <button title="Excluir" aria-label={`Excluir ${doc.nome}`} disabled={ocupado}
          onClick={() => { if (confirm(`Excluir "${doc.nome}" de vez? Não dá para desfazer.`)) rodar(() => excluirDocumento(doc)); }}
          className="rounded-lg p-1.5 text-suave hover:bg-erro-claro hover:text-erro"><Trash2 className="size-4" /></button>}
      </div>
      {editando && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-fundo/70 p-2.5">
          <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do arquivo" className="min-w-[180px] flex-1 rounded-lg border border-linha bg-white px-2.5 py-1.5 text-[13px]" />
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo" className="rounded-lg border border-linha bg-white px-2 py-1.5 text-[13px]">
            {!tipos.some(([k]) => k === tipo) && <option value={tipo}>{tipo}</option>}
            {tipos.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
          <button disabled={ocupado} onClick={() => rodar(() => editarDocumento(doc.id, { nome, tipo }))} className="inline-flex items-center gap-1 rounded-lg bg-azul px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
            {ocupado ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Salvar</button>
          <input ref={arq} type="file" hidden accept={ACEITA_ARQUIVOS} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) rodar(() => substituirDocumento(doc, f)); }} />
          <button disabled={ocupado} onClick={() => arq.current?.click()} title="Depois de editar no Word/Excel, suba a nova versão aqui" className="inline-flex items-center gap-1 rounded-lg border border-azul px-3 py-1.5 text-[12.5px] font-semibold text-azul hover:bg-white disabled:opacity-50"><RefreshCw className="size-3.5" />Trocar por nova versão</button>
          <button onClick={() => setEditando(false)} aria-label="Fechar edição" className="ml-auto rounded-lg p-1 text-suave hover:text-tinta"><X className="size-4" /></button>
          <p className="w-full text-[11.5px] text-suave">Para mudar o conteúdo: baixe, edite no Word/Excel e use “Trocar por nova versão”. O arquivo continua ligado ao mesmo cliente e negócio.</p>
        </div>
      )}
      {erro && <p role="alert" className="mt-1.5 rounded-lg bg-erro-claro px-3 py-1.5 text-[12.5px] text-erro">{erro}</p>}
    </li>
  );
}
