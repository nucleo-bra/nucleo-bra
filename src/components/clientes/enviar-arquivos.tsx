"use client";
// Enviar arquivos para o cliente: contrato, NF, DWG, PDF de projeto, fotos…
import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { subirNoCliente, TIPOS_ARQUIVO_CLIENTE, TipoArquivoCliente, tipoPeloNome } from "@/lib/pasta";
import { mensagemErro } from "@/lib/supabase";

type Fila = { arquivo: File; tipo: TipoArquivoCliente };
const tam = (b: number) => (b > 1_048_576 ? `${(b / 1_048_576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const TIPOS_TECNICO = ["projeto", "foto", "outro"];

export function EnviarArquivos({ clienteId, negocios, onEnviado, tecnico = false }: { clienteId: string; negocios: { id: string; nome: string }[]; onEnviado: () => void; tecnico?: boolean }) {
  const tipos = TIPOS_ARQUIVO_CLIENTE.filter(([k]) => !tecnico || TIPOS_TECNICO.includes(k));
  const tipoInicial = (nome: string): TipoArquivoCliente => { const t = tipoPeloNome(nome); return !tecnico || TIPOS_TECNICO.includes(t) ? t : "outro"; };
  const [fila, setFila] = useState<Fila[]>([]);
  const [negocio, setNegocio] = useState("");
  const [sobre, setSobre] = useState(false), [ocupado, setOcupado] = useState(false);
  const [erros, setErros] = useState<string[]>([]), [ok, setOk] = useState("");
  const inp = useRef<HTMLInputElement>(null);
  const somar = (fs: FileList | null) => { if (fs?.length) { setFila((x) => [...x, ...[...fs].map((arquivo) => ({ arquivo, tipo: tipoInicial(arquivo.name) }))]); setOk(""); setErros([]); } };

  async function enviar() {
    setOcupado(true); setErros([]); setOk("");
    const falhas: string[] = []; const sobra: Fila[] = []; let n = 0;
    for (const f of fila) {
      try { await subirNoCliente(clienteId, f.arquivo, f.tipo, negocio || null); n++; }
      catch (e) { falhas.push(mensagemErro(e)); sobra.push(f); }
    }
    setFila(sobra); setErros(falhas); setOcupado(false);
    if (n) { setOk(`${n} arquivo(s) guardado(s).`); onEnviado(); }
  }

  return (
    <div className="border-b border-linha px-5 py-4">
      <input ref={inp} type="file" multiple hidden onChange={(e) => { somar(e.target.files); e.target.value = ""; }} />
      <button type="button" onClick={() => inp.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={(e) => { e.preventDefault(); setSobre(false); somar(e.dataTransfer.files); }}
        className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${sobre ? "border-azul bg-[#eef3fb]" : "border-linha hover:border-azul"}`}>
        <Upload className="size-5 text-azul" />
        <span className="text-[14px] font-semibold">Subir arquivos do cliente</span>
        <span className="text-[12.5px] text-suave">Contrato, nota fiscal (PDF/XML), Word, Excel, projeto em PDF ou DWG, fotos… Arraste aqui ou clique. Até 50 MB cada.</span>
      </button>

      {fila.length > 0 && (
        <div className="mt-3 space-y-2">
          {fila.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-linha bg-fundo/60 px-3 py-2">
              <div className="min-w-[180px] flex-1"><div className="truncate text-[13.5px] font-medium">{f.arquivo.name}</div><div className="text-[12px] text-suave">{tam(f.arquivo.size)}</div></div>
              <select value={f.tipo} onChange={(e) => setFila(fila.map((x, k) => (k === i ? { ...x, tipo: e.target.value as TipoArquivoCliente } : x)))}
                className="rounded-lg border border-linha bg-white px-2 py-1.5 text-[13px]" aria-label="Tipo do arquivo">
                {tipos.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </select>
              <button onClick={() => setFila(fila.filter((_, k) => k !== i))} className="rounded-lg p-1.5 text-suave hover:text-erro" aria-label={`Tirar ${f.arquivo.name}`}><X className="size-4" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!tecnico && negocios.length > 0 && (
              <select value={negocio} onChange={(e) => setNegocio(e.target.value)} className="rounded-lg border border-linha bg-white px-2 py-2 text-[13px]" aria-label="Negócio">
                <option value="">Sem negócio específico</option>{negocios.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}
              </select>
            )}
            <button onClick={enviar} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 text-[13.5px] font-semibold text-white shadow-md disabled:opacity-50">
              {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}Guardar {fila.length} arquivo(s)
            </button>
          </div>
        </div>
      )}
      {ok && <p className="mt-2 text-[13px] font-semibold text-ok">✓ {ok}</p>}
      {erros.map((e, i) => <p key={i} role="alert" className="mt-2 rounded-lg bg-erro-claro px-3 py-2 text-[12.5px] text-erro">{e}</p>)}
    </div>
  );
}
