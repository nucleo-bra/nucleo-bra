"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { Bloco, Selo, Shell, Vazio } from "@/components/Shell";
import { carregarCliente, ClienteFicha, formatarData, formatarReais } from "@/lib/dados";
import { formatarDocumento } from "@/lib/importacao/util";
import { mensagemErro } from "@/lib/supabase";

function CopiarLinha({ linha }: { linha: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(linha.replace(/\D/g, "")); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="inline-flex items-center gap-1 text-[12px] text-suave hover:text-tinta">
      {ok ? <><Check className="size-3.5 text-ok" /> Copiada</> : <><Copy className="size-3.5" /> Copiar linha digitável</>}
    </button>
  );
}

function Ficha() {
  const id = useSearchParams().get("id") ?? "";
  const [c, setC] = useState<ClienteFicha | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  useEffect(() => { carregarCliente(id).then(setC).catch((e) => setErro(mensagemErro(e))); }, [id]);

  if (erro) return <Shell titulo="Cliente"><p role="alert" className="rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p></Shell>;
  if (c === undefined) return <Shell titulo="Cliente"><div className="h-40" /></Shell>;
  if (c === null) return <Shell titulo="Cliente"><Vazio>Cliente não encontrado.</Vazio></Shell>;

  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <Shell titulo={c.nome}>
      <Link href="/clientes/" className="-mt-2 mb-5 inline-flex items-center gap-1.5 text-[13px] text-suave hover:text-tinta">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-4 rounded-xl border border-linha bg-white p-5 text-[14px] md:grid-cols-4">
        <div><dt className="text-[12px] text-suave">{c.tipo === "PJ" ? "CNPJ" : "CPF"}</dt><dd className="num mt-0.5">{c.documento ? formatarDocumento(c.documento) : "Não informado"}</dd></div>
        <div><dt className="text-[12px] text-suave">Cidade</dt><dd className="mt-0.5">{c.cidade ? `${c.cidade}/${c.uf}` : "—"}</dd></div>
        <div><dt className="text-[12px] text-suave">Contato</dt><dd className="mt-0.5 truncate">{c.email ?? c.telefone ?? "—"}</dd></div>
        <div><dt className="text-[12px] text-suave">A receber</dt><dd className="num mt-0.5 font-display text-[18px] font-semibold">{formatarReais(c.a_receber)}</dd></div>
      </dl>

      {c.filiais.length > 0 && (
        <p className="mb-6 rounded-lg bg-ciano-claro px-4 py-3 text-[13px] text-[#14708c]">
          Mesmo grupo (raiz do CNPJ {c.documento_raiz}):{" "}
          {c.filiais.map((f, i) => (
            <span key={f.id}>{i > 0 && ", "}<Link className="underline" href={`/clientes/ficha/?id=${f.id}`}>{f.documento ? formatarDocumento(f.documento) : f.nome}</Link></span>
          ))}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <Bloco titulo="Títulos a receber">
          {!c.titulos.length ? <Vazio>Nenhum título.</Vazio> : (
            <ul className="divide-y divide-linha">
              {c.titulos.map((t) => (
                <li key={t.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">{t.descricao}</div>
                      <div className="text-[13px] text-suave">Vence {formatarData(t.vencimento)}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-[14px] font-semibold">{formatarReais(t.valor)}</div>
                      <Selo status={t.status === "aberto" && t.vencimento < hoje ? "vencido" : t.status} />
                    </div>
                  </div>
                  {t.linha_digitavel && <div className="mt-1.5"><CopiarLinha linha={t.linha_digitavel} /></div>}
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Notas fiscais">
          {!c.notas.length ? <Vazio>Nenhuma nota.</Vazio> : (
            <ul className="divide-y divide-linha">
              {c.notas.map((nf) => (
                <li key={nf.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <div className="text-[14px] font-medium">{nf.tipo === "nfse" ? "NFS-e" : "NF-e"} {nf.numero}</div>
                    <div className="text-[13px] text-suave">{formatarData(nf.emitida_em)}{nf.ordem_compra ? ` · OC ${nf.ordem_compra}` : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[14px] font-semibold">{formatarReais(nf.valor_servicos)}</div>
                    <Selo status={nf.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Propostas">
          {!c.propostas.length ? <Vazio>Nenhuma proposta.</Vazio> : (
            <ul className="divide-y divide-linha">
              {c.propostas.map((pr) => (
                <li key={pr.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">Nº {pr.numero}{pr.versao ? ` ${pr.versao}` : ""}</div>
                    <div className="truncate text-[13px] text-suave">{pr.titulo} · {formatarData(pr.data_emissao)}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-[14px] font-semibold">{formatarReais(pr.total_final)}</div>
                    <Selo status={pr.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Projetos e obras">
          {!c.projetos_lista.length ? <Vazio>Nenhum projeto.</Vazio> : (
            <ul className="divide-y divide-linha">
              {c.projetos_lista.map((pj) => (
                <li key={pj.id} className="flex items-center justify-between px-5 py-3.5 text-[14px]">
                  <span className="font-medium">{pj.nome}</span><Selo status={pj.status} />
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>
    </Shell>
  );
}

export default function Pagina() {
  return <Suspense><Ficha /></Suspense>;
}
