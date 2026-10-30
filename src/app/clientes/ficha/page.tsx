"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Copy, Check, Pencil, Handshake, Mail, MapPin, MessageCircle, Phone, Plus, Headset, FileSignature, Download, FileText } from "lucide-react";
import { linkDocumento } from "@/lib/pasta";
import { abrirPdf } from "@/components/orcamentos/lista";
import { pl, telefone, whatsapp } from "@/lib/texto";
import { FormCliente } from "@/components/clientes/form-cliente";
import { Cliente, enderecoLinha, lerCliente } from "@/lib/clientes";
import { ETAPAS_NEGOCIO, rotulo } from "@/lib/crm";
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
  const [cad, setCad] = useState<Cliente | null>(null);
  const [editar, setEditar] = useState(false);
  const carregar = () => { carregarCliente(id).then(setC).catch((e) => setErro(mensagemErro(e))); lerCliente(id).then(setCad).catch(() => {}); };
  useEffect(carregar, [id]);

  if (erro) return <Shell titulo="Cliente"><p role="alert" className="rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p></Shell>;
  if (c === undefined) return <Shell titulo="Cliente"><div className="h-40" /></Shell>;
  if (c === null) return <Shell titulo="Cliente"><Vazio>Cliente não encontrado.</Vazio></Shell>;

  const hoje = new Date().toISOString().slice(0, 10);
  return (
    <Shell titulo={c.nome} cheio>
      <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-7">
      <Link href="/clientes/" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-suave hover:text-tinta">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      {/* cabeçalho do cliente */}
      <section className="relative mb-5 overflow-hidden rounded-[20px] bg-gradient-to-br from-marinho-950 via-marinho-900 to-azul p-5 text-white shadow-[0_24px_50px_-24px_rgba(14,26,61,.8)] lg:p-7">
        <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.3),transparent_70%)]" aria-hidden />
        <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
        <div className="relative flex flex-wrap items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/12 font-display text-[20px] font-extrabold ring-1 ring-white/20">
            {(cad?.nome_fantasia || c.nome).trim().split(/\s+/).filter((p) => p.length > 2).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-semibold tracking-[.14em] text-ciano uppercase">{c.tipo === "PJ" ? "Empresa" : "Pessoa física"}</div>
            <h1 className="font-display text-[22px] leading-tight font-extrabold break-words lg:text-[28px]">{cad?.nome_fantasia || c.nome}</h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/75">
              {c.documento && <span className="num whitespace-nowrap">{c.tipo === "PJ" ? "CNPJ" : "CPF"} {formatarDocumento(c.documento)}</span>}
              {cad?.cidade && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{cad.cidade}{cad.uf ? `/${cad.uf}` : ""}</span>}
              {cad?.nome_fantasia && cad.nome_fantasia !== c.nome && <span className="truncate">{c.nome}</span>}
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {c.telefone && whatsapp(c.telefone) && <a href={whatsapp(c.telefone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#25d366] px-3.5 py-2 text-[13.5px] font-semibold text-white hover:brightness-110"><MessageCircle className="size-4" />WhatsApp</a>}
            {c.telefone && <a href={`tel:${c.telefone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-3.5 py-2 text-[13.5px] font-semibold ring-1 ring-white/20 hover:bg-white/20"><Phone className="size-4" />Ligar</a>}
            {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-3.5 py-2 text-[13.5px] font-semibold ring-1 ring-white/20 hover:bg-white/20"><Mail className="size-4" />E-mail</a>}
            <button onClick={() => setEditar(true)} disabled={!cad} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[13.5px] font-semibold text-marinho-900 hover:shadow-lg disabled:opacity-50"><Pencil className="size-4" />Editar dados</button>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            ["A receber", formatarReais(c.a_receber), c.titulos.filter((t) => t.status === "aberto").length ? pl(c.titulos.filter((t) => t.status === "aberto").length, "título em aberto", "títulos em aberto") : "nada em aberto"],
            ["Negócios no CRM", String(c.negocios?.length ?? 0), c.negocios?.length ? formatarReais(c.negocios.reduce((t, n) => t + Number(n.valor_estimado || 0), 0)) : "nenhum ainda"],
            ["Propostas", String(c.propostas.length), c.propostas[0] ? `última ${formatarData(c.propostas[0].data_emissao)}` : "nenhuma ainda"],
            ["Notas fiscais", String(c.notas.length), c.notas.length ? formatarReais(c.notas.reduce((t, n) => t + Number(n.valor_servicos || 0), 0)) : "nenhuma ainda"],
          ] as const).map(([r, v, d]) => (
            <div key={r} className="rounded-xl bg-white/[.08] px-3.5 py-2.5 ring-1 ring-white/10">
              <div className="text-[11.5px] font-semibold text-white/65">{r}</div>
              <div className="num font-display text-[18px] font-extrabold">{v}</div>
              <div className="truncate text-[11.5px] text-white/55">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/crm/?aba=negocios" className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13px] font-semibold hover:border-azul hover:text-azul"><Plus className="size-4" />Novo negócio</Link>
        <Link href="/tecnico/chamados/" className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13px] font-semibold hover:border-azul hover:text-azul"><Headset className="size-4" />Abrir chamado</Link>
        <Link href="/contratos/" className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13px] font-semibold hover:border-azul hover:text-azul"><FileSignature className="size-4" />Contratos</Link>
      </div>

      <section className="sombra-bra mb-6 rounded-[18px] border border-linha bg-white p-5 text-[14px]">
        <h2 className="mb-3 flex items-center gap-2.5 text-[15px] font-bold"><span className="h-[17px] w-1 rounded bg-gradient-to-b from-ciano to-br" aria-hidden />Dados cadastrais</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 md:grid-cols-4">
          <div><dt className="text-[12px] text-suave">{c.tipo === "PJ" ? "CNPJ" : "CPF"}</dt><dd className="num mt-0.5 whitespace-nowrap">{c.documento ? formatarDocumento(c.documento) : "Não informado"}</dd></div>
          <div><dt className="text-[12px] text-suave">{c.tipo === "PJ" ? "Nome fantasia" : "Nascimento"}</dt><dd className="mt-0.5">{c.tipo === "PJ" ? cad?.nome_fantasia || "—" : cad?.data_nascimento ? formatarData(cad.data_nascimento) : "—"}</dd></div>
          <div className="min-w-0"><dt className="text-[12px] text-suave">E-mail</dt><dd className="mt-0.5 truncate">{c.email || "—"}</dd></div>
          <div><dt className="text-[12px] text-suave">Telefone</dt><dd className="num mt-0.5">{c.telefone ? telefone(c.telefone) : "—"}</dd></div>
          <div className="sm:col-span-2 md:col-span-4"><dt className="text-[12px] text-suave">Endereço</dt><dd className="mt-0.5">{cad && enderecoLinha(cad) ? enderecoLinha(cad) : "—"}</dd></div>
          {cad?.observacoes && <div className="sm:col-span-2 md:col-span-4"><dt className="text-[12px] text-suave">Observações</dt><dd className="mt-0.5 whitespace-pre-wrap">{cad.observacoes}</dd></div>}
        </dl>
      </section>

      {(c.negocios?.length ?? 0) > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {c.negocios!.map((ng) => (
            <Link key={ng.id} href={`/crm/?aba=negocios&n=${ng.id}`} className="inline-flex items-center gap-2 rounded-xl border border-linha bg-white px-3 py-2 text-[13px] hover:border-azul">
              <Handshake className="size-4 text-azul" /><b>{ng.numero ? `${ng.numero} - ` : ""}{ng.titulo}</b>
              <span className="text-suave">{rotulo(ETAPAS_NEGOCIO, ng.etapa === "qualificacao" ? "lead" : ng.etapa)} · {formatarReais(ng.valor_estimado)}</span>
            </Link>
          ))}
        </div>
      )}
      {editar && cad && <FormCliente inicial={cad} onFechar={() => setEditar(false)} onSalvo={() => { setEditar(false); carregar(); }} />}

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

        <Bloco titulo="Orçamentos">
          {!c.propostas.length ? <Vazio>Nenhum orçamento.</Vazio> : (
            <ul className="divide-y divide-linha">
              {c.propostas.map((pr) => {
                const ex = c.propostas_extra?.[pr.id];
                return (
                  <li key={pr.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">Nº {pr.numero}{pr.versao ? ` ${pr.versao}` : ""}</div>
                      <div className="truncate text-[13px] text-suave">{pr.titulo} · {formatarData(pr.data_emissao)}</div>
                      <div className="mt-1 flex gap-3 text-[12.5px]">
                        {!!ex?.itens && <Link href={`/orcamentos/?id=${pr.id}`} className="inline-flex items-center gap-1 font-semibold text-azul hover:underline"><Pencil className="size-3.5" />Editar</Link>}
                        {(ex?.itens || ex?.documento_id) && <button onClick={() => abrirPdf({ id: pr.id, itens: ex?.itens ?? 0, documento_id: ex?.documento_id ?? null }).catch((e) => setErro(mensagemErro(e)))} className="inline-flex items-center gap-1 font-semibold text-azul hover:underline"><Download className="size-3.5" />PDF</button>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num text-[14px] font-semibold">{formatarReais(pr.total_final)}</div>
                      <Selo status={pr.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Documentos enviados">
          {!c.documentos?.length ? <Vazio>Nenhum arquivo enviado ainda. Suba orçamentos e contratos pela pasta do negócio no CRM.</Vazio> : (
            <ul className="divide-y divide-linha">
              {c.documentos.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText className="size-4 shrink-0 text-azul" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{d.nome}</div>
                    <div className="truncate text-[12.5px] text-suave">{({ proposta: "Orçamento", contrato: "Contrato", boleto: "Boleto", nota_fiscal: "Nota fiscal", foto: "Foto" } as Record<string, string>)[d.tipo] ?? "Arquivo"} · {formatarData(d.created_at)}{d.negocio ? ` · ${d.negocio}` : ""}</div>
                  </div>
                  {d.storage_path && <button aria-label={`Abrir ${d.nome}`} onClick={() => linkDocumento(d.storage_path!).then((u) => window.open(u, "_blank")).catch((e) => setErro(mensagemErro(e)))} className="rounded-lg p-1.5 text-azul hover:bg-fundo"><Download className="size-4" /></button>}
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
      </div>
    </Shell>
  );
}

export default function Pagina() {
  return <Suspense><Ficha /></Suspense>;
}
