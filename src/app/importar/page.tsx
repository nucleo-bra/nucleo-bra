"use client";
import { useCallback, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Info, Loader2, Upload, XCircle } from "lucide-react";
import { Bloco, Shell } from "@/components/Shell";
import { ArquivoLido, confirmarImportacao, jaImportado, lerArquivo } from "@/lib/importacao/servico";
import { Alerta, formatarDocumento, formatarMoeda } from "@/lib/importacao/util";
import { mensagemErro, modoDemo } from "@/lib/supabase";
import { formatarData } from "@/lib/dados";

type Item = {
  id: string;
  nome: string;
  estado: "lendo" | "conferencia" | "gravando" | "gravado" | "erro" | "descartado";
  lido?: ArquivoLido;
  erro?: string;
  duplicado?: boolean;
};

const ORDEM = { nota: 0, proposta: 1, boleto: 2 } as const;

export default function Importar() {
  const [itens, setItens] = useState<Item[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  const atualizar = (id: string, mudanca: Partial<Item>) => setItens((l) => l.map((i) => (i.id === id ? { ...i, ...mudanca } : i)));

  const receber = useCallback(async (arquivos: FileList | File[]) => {
    const novos = Array.from(arquivos).map((a) => ({ id: crypto.randomUUID(), nome: a.name, estado: "lendo" as const, arquivo: a }));
    setItens((l) => [...novos.map((n) => ({ id: n.id, nome: n.nome, estado: n.estado })), ...l]);
    await Promise.all(novos.map(async (n) => {
      try {
        const lido = await lerArquivo(n.arquivo);
        const duplicado = await jaImportado(lido.hash);
        atualizar(n.id, { estado: "conferencia", lido, duplicado });
      } catch (e) {
        atualizar(n.id, { estado: "erro", erro: mensagemErro(e) });
      }
    }));
    // a nota precisa entrar antes do boleto dela
    setItens((l) => [...l].sort((a, b) => (a.lido && b.lido ? ORDEM[a.lido.leitura.tipo] - ORDEM[b.lido.leitura.tipo] : 0)));
  }, []);

  async function confirmar(item: Item) {
    if (!item.lido) return;
    atualizar(item.id, { estado: "gravando", erro: undefined });
    try {
      await confirmarImportacao(item.lido);
      atualizar(item.id, { estado: "gravado" });
    } catch (e) {
      atualizar(item.id, { estado: "conferencia", erro: mensagemErro(e) });
    }
  }

  const pendentes = itens.filter((i) => i.estado === "conferencia");

  return (
    <Shell titulo="Importar documentos">
      <p className="-mt-3 mb-6 max-w-2xl text-[14px] text-suave">
        Envie o XML da nota (Omie), o PDF da proposta (Zenith) ou o PDF do boleto. O Núcleo lê, confere as contas e mostra tudo
        antes de gravar. Nada entra sem a sua confirmação.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); receber(e.dataTransfer.files); }}
        className={`mb-8 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          arrastando ? "border-ciano bg-ciano-claro" : "border-linha bg-white"}`}>
        <Upload className="mb-3 size-7 text-marinho-500" strokeWidth={1.5} />
        <p className="mb-1 text-[15px] font-medium">Arraste os arquivos aqui</p>
        <p className="mb-4 text-[13px] text-suave">XML de NF-e/NFS-e · PDF de proposta do Zenith · PDF de boleto</p>
        <button onClick={() => entrada.current?.click()} className="rounded-lg bg-marinho-900 px-4 py-2 text-[14px] font-medium text-white hover:bg-marinho-800">
          Escolher arquivos
        </button>
        <input ref={entrada} type="file" multiple accept=".xml,.pdf,application/pdf,text/xml" className="hidden"
          onChange={(e) => { if (e.target.files) receber(e.target.files); e.target.value = ""; }} />
      </div>

      {pendentes.length > 1 && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-marinho-900 px-5 py-3 text-white">
          <span className="text-[14px]">{pendentes.length} documentos aguardando conferência</span>
          <button onClick={async () => { for (const i of pendentes) await confirmar(i); }}
            className="rounded-lg bg-br px-4 py-1.5 text-[13px] font-medium hover:bg-br-escuro">Confirmar todos</button>
        </div>
      )}

      <div className="space-y-5">
        {itens.filter((i) => i.estado !== "descartado").map((item) => (
          <Cartao key={item.id} item={item} onConfirmar={() => confirmar(item)} onDescartar={() => atualizar(item.id, { estado: "descartado" })} />
        ))}
      </div>
    </Shell>
  );
}

function Cartao({ item, onConfirmar, onDescartar }: { item: Item; onConfirmar: () => void; onDescartar: () => void }) {
  const tipo = item.lido?.leitura.tipo;
  const titulo = tipo === "nota" ? "Nota fiscal" : tipo === "boleto" ? "Boleto" : tipo === "proposta" ? "Proposta Zenith" : "Documento";
  return (
    <Bloco titulo={`${titulo}`} extra={<span className="flex items-center gap-1.5 truncate text-[12px] text-suave"><FileText className="size-3.5" />{item.nome}</span>}>
      {item.estado === "lendo" && <div className="flex items-center gap-2 px-5 py-6 text-[14px] text-suave"><Loader2 className="size-4 animate-spin" /> Lendo o arquivo…</div>}
      {item.estado === "erro" && <div className="flex items-start gap-2 px-5 py-5 text-[14px] text-erro"><XCircle className="mt-0.5 size-4 shrink-0" />{item.erro}</div>}
      {item.lido && item.estado !== "erro" && (
        <>
          <div className="px-5 py-5">
            {item.lido.leitura.tipo === "nota" && <ConfNota d={item.lido.leitura.dados} />}
            {item.lido.leitura.tipo === "boleto" && <ConfBoleto d={item.lido.leitura.dados} />}
            {item.lido.leitura.tipo === "proposta" && <ConfProposta d={item.lido.leitura.dados} />}
          </div>
          <Alertas lista={[
            ...(item.duplicado ? [{ nivel: "erro", mensagem: "Este arquivo já foi importado antes." } as Alerta] : []),
            ...item.lido.leitura.dados.alertas,
          ]} />
          {item.erro && <p role="alert" className="mx-5 mb-4 rounded-lg bg-erro-claro px-4 py-2.5 text-[13px] text-erro">{item.erro}</p>}
          <div className="flex items-center justify-end gap-3 border-t border-linha px-5 py-3.5">
            {item.estado === "gravado" ? (
              <span className="flex items-center gap-1.5 text-[14px] font-medium text-ok">
                <CheckCircle2 className="size-4" /> {modoDemo ? "Conferido (demonstração — não gravado)" : "Gravado no Núcleo"}
              </span>
            ) : (
              <>
                <button onClick={onDescartar} disabled={item.estado === "gravando"} className="rounded-lg px-4 py-2 text-[14px] text-suave hover:bg-fundo">Descartar</button>
                <button onClick={onConfirmar} disabled={item.estado === "gravando" || item.duplicado || item.lido.leitura.dados.alertas.some((a) => a.nivel === "erro")}
                  className="inline-flex items-center gap-2 rounded-lg bg-br px-4 py-2 text-[14px] font-medium text-white hover:bg-br-escuro disabled:cursor-not-allowed disabled:opacity-40">
                  {item.estado === "gravando" && <Loader2 className="size-4 animate-spin" />} Confirmar e gravar
                </button>
              </>
            )}
          </div>
        </>
      )}
    </Bloco>
  );
}

function Campo({ rotulo, valor, destaque }: { rotulo: string; valor?: React.ReactNode; destaque?: boolean }) {
  return (
    <div>
      <dt className="text-[12px] text-suave">{rotulo}</dt>
      <dd className={`num mt-0.5 ${destaque ? "font-display text-[20px] font-semibold" : "text-[14px]"}`}>{valor || "—"}</dd>
    </div>
  );
}

function ConfNota({ d }: { d: import("@/lib/importacao/nota-fiscal").NotaFiscalLida }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
      <Campo rotulo={d.tipo === "nfse" ? "NFS-e" : "NF-e"} valor={`Nº ${d.numero}${d.rps_numero ? ` · RPS ${d.rps_numero}` : ""}`} />
      <Campo rotulo="Emissão" valor={formatarData(d.emitida_em)} />
      <Campo rotulo="Cliente" valor={d.tomador.nome} />
      <Campo rotulo="CPF/CNPJ" valor={d.tomador.documento ? formatarDocumento(d.tomador.documento) : undefined} />
      <Campo rotulo="Valor da nota" valor={formatarMoeda(d.valor_servicos)} destaque />
      <Campo rotulo="Valor líquido" valor={formatarMoeda(d.valor_liquido)} />
      <Campo rotulo={d.iss_retido ? "ISS (retido)" : "ISS"} valor={d.valor_iss !== undefined ? `${formatarMoeda(d.valor_iss)} (${d.aliquota_iss}%)` : undefined} />
      <Campo rotulo="Ordem de compra" valor={d.ordem_compra} />
      <div className="col-span-2 md:col-span-4">
        <dt className="text-[12px] text-suave">Vai gerar a receber</dt>
        <dd className="mt-1 flex flex-wrap gap-2">
          {d.parcelas.length ? d.parcelas.map((p, i) => (
            <span key={i} className="num rounded-lg bg-ciano-claro px-3 py-1.5 text-[13px] text-[#14708c]">
              {formatarMoeda(p.valor)} em {formatarData(p.vencimento)}
            </span>
          )) : <span className="text-[13px] text-atencao">Sem vencimento — nenhum título será criado.</span>}
        </dd>
      </div>
    </dl>
  );
}

function ConfBoleto({ d }: { d: import("@/lib/importacao/boleto").BoletoLido }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
      <Campo rotulo="Banco" valor={`${d.banco_codigo}${d.banco_nome ? ` · ${d.banco_nome}` : ""}`} />
      <Campo rotulo="Documento (NF)" valor={d.numero_documento} />
      <Campo rotulo="Vencimento" valor={d.vencimento ? formatarData(d.vencimento) : undefined} />
      <Campo rotulo="Valor" valor={formatarMoeda(d.valor)} destaque />
      <Campo rotulo="Pagador" valor={d.pagador?.nome} />
      <Campo rotulo="Nosso número" valor={d.nosso_numero} />
      <Campo rotulo="Proposta comercial" valor={d.codigo_comercial} />
      <div className="col-span-2 md:col-span-4">
        <dt className="text-[12px] text-suave">Linha digitável</dt>
        <dd className="num mt-0.5 break-all text-[14px]">{d.linha_digitavel}</dd>
      </div>
    </dl>
  );
}

function ConfProposta({ d }: { d: import("@/lib/importacao/proposta-zenith").PropostaLida }) {
  const grupos = d.sistemas.length ? d.sistemas.map((s) => s.nome) : [...new Set(d.itens.map((i) => i.sistema))];
  return (
    <>
      <dl className="mb-5 grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-4">
        <Campo rotulo="Proposta" valor={`Nº ${d.numero}${d.versao ? ` ${d.versao}` : ""}`} />
        <Campo rotulo="Cliente" valor={d.cliente_nome} />
        <Campo rotulo="Projeto" valor={d.projeto_nome} />
        <Campo rotulo="Emissão" valor={formatarData(d.data_emissao)} />
        <Campo rotulo="Total final" valor={formatarMoeda(d.total_final)} destaque />
        <Campo rotulo="Soma dos itens" valor={formatarMoeda(d.total_itens)} />
        <Campo rotulo="Itens" valor={`${d.itens.length} em ${grupos.length} sistemas`} />
        <Campo rotulo="Pagamento" valor={d.condicoes_pagamento} />
      </dl>
      <details className="rounded-lg border border-linha">
        <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium">Ver itens por sistema</summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <tbody>
              {grupos.map((g) => {
                const lista = d.itens.filter((i) => i.sistema === g);
                const total = lista.reduce((s, i) => s + i.valor_total, 0);
                return (
                  <FragmentoGrupo key={g} nome={g} total={total} itens={lista} />
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function FragmentoGrupo({ nome, total, itens }: { nome: string; total: number; itens: import("@/lib/importacao/proposta-zenith").ItemProposta[] }) {
  return (
    <>
      <tr className="bg-fundo">
        <td className="px-4 py-2 font-semibold" colSpan={3}>{nome}</td>
        <td className="num px-4 py-2 text-right font-semibold">{formatarMoeda(total)}</td>
      </tr>
      {itens.map((i, k) => (
        <tr key={k} className="border-t border-linha">
          <td className="px-4 py-2">{i.descricao}{i.sku && <span className="ml-2 text-suave">{i.sku}</span>}</td>
          <td className="num px-4 py-2 text-right text-suave">{i.quantidade} {i.unidade}</td>
          <td className="num px-4 py-2 text-right text-suave">{formatarMoeda(i.valor_unitario)}</td>
          <td className="num px-4 py-2 text-right">{formatarMoeda(i.valor_total)}</td>
        </tr>
      ))}
    </>
  );
}

function Alertas({ lista }: { lista: Alerta[] }) {
  if (!lista.length)
    return <p className="mx-5 mb-4 flex items-center gap-2 rounded-lg bg-ok-claro px-4 py-2.5 text-[13px] text-ok"><CheckCircle2 className="size-4" /> Todas as conferências passaram.</p>;
  const estilo = { erro: ["bg-erro-claro text-erro", XCircle], atencao: ["bg-atencao-claro text-atencao", AlertTriangle], info: ["bg-fundo text-suave", Info] } as const;
  return (
    <ul className="mx-5 mb-4 space-y-1.5">
      {lista.map((a, i) => {
        const [cls, Icone] = estilo[a.nivel];
        return <li key={i} className={`flex items-start gap-2 rounded-lg px-4 py-2 text-[13px] ${cls}`}><Icone className="mt-0.5 size-4 shrink-0" />{a.mensagem}</li>;
      })}
    </ul>
  );
}
