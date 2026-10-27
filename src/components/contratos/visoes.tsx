"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BellRing, Check, CircleDollarSign, Clock, Download, FilePen, FileSignature, FileText, FileUp, Mail, Plus, RefreshCw,
  Search, Send, Settings2, ShieldCheck, Undo2, Wallet, XCircle,
} from "lucide-react";
import { Botao, Cartao, Chip, curto, Janela, Kpi, reais, Titulo, VERDE, AZUL, LARANJA, MARINHO, campo, Rotulo } from "@/components/crm/ui";
import { nomeUsuario } from "@/lib/crm";
import {
  abrirContrato, anexarArquivo, baixarBlob, condicoesPagamento, ConfigContratos, Contrato, dataTxt, docusign, EventoContrato, excluirContrato,
  formatarDocumento, gerarArquivo, lancarContratoNoFinanceiro, lerConfig, linkArquivo, listarContratos, listarModelos, nomeArquivo,
  ouvirContrato, salvarContrato, STATUS, StatusContrato,
} from "@/lib/contratos";
import { mensagemErro } from "@/lib/supabase";
import { FormContrato, FormLancarContrato } from "./formularios";
import { ConfigContratosJanela, StatusDocusign } from "./config";

const Status = ({ s }: { s: StatusContrato }) => <Chip cor={STATUS[s]?.cor}>{STATUS[s]?.rot ?? s}</Chip>;
const FILTROS: [string, string][] = [["todos", "Todos"], ["rascunho", "Rascunhos"], ["enviado", "Aguardando assinatura"], ["assinado", "Assinados"], ["outros", "Recusados / cancelados"]];

// ------------------------------------------------------------------ lista
export function ListaContratos({ novoDoNegocio }: { novoDoNegocio?: string | null }) {
  const router = useRouter();
  const [L, setL] = useState<Contrato[] | null>(null);
  const [cfg, setCfg] = useState<ConfigContratos | null>(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("todos"), [busca, setBusca] = useState("");
  const [novo, setNovo] = useState<Partial<Contrato> & { negocio_id?: string } | null>(null);
  const [config, setConfig] = useState(false);

  useEffect(() => {
    listarContratos().then(setL).catch((e) => setErro(mensagemErro(e)));
    lerConfig().then(setCfg).catch(() => {});
  }, []);
  useEffect(() => { if (novoDoNegocio) setNovo({ negocio_id: novoDoNegocio }); }, [novoDoNegocio]);

  const mes = new Date().toISOString().slice(0, 7);
  const k = useMemo(() => {
    const l = L ?? [];
    const soma = (f: (c: Contrato) => boolean) => l.filter(f).reduce((s, c) => s + c.valor, 0);
    return {
      rasc: l.filter((c) => c.status === "rascunho").length,
      env: l.filter((c) => c.status === "enviado"), envV: soma((c) => c.status === "enviado"),
      assMes: l.filter((c) => c.status === "assinado" && (c.assinado_em ?? "").startsWith(mes)), assMesV: soma((c) => c.status === "assinado" && (c.assinado_em ?? "").startsWith(mes)),
      assV: soma((c) => c.status === "assinado"), semFin: l.filter((c) => c.status === "assinado" && !c.financeiro_lancado_em).length,
      rec: l.filter((c) => c.status === "recusado").length,
    };
  }, [L, mes]);
  const lista = (L ?? []).filter((c) =>
    (filtro === "todos" || (filtro === "outros" ? ["recusado", "cancelado", "encerrado"].includes(c.status) : c.status === filtro)) &&
    (!busca || `${c.numero} ${c.cliente_nome} ${c.unidade} ${c.cliente_documento}`.toLowerCase().includes(busca.toLowerCase())));

  return (
    <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[12.5px] font-semibold tracking-wide text-suave uppercase">Contratos · assinatura eletrônica</div>
          <h1 className="font-display text-[24px] font-extrabold tracking-tight lg:text-[28px]">Contratos</h1>
        </div>
        <div className="flex gap-2">
          <Botao onClick={() => setConfig(true)}><Settings2 className="size-4" />Configurações</Botao>
          <Botao tipo="pri" onClick={() => setNovo({})}><Plus className="size-4" />Novo contrato</Botao>
        </div>
      </div>
      {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi rotulo="Aguardando assinatura" valor={String(k.env.length)} detalhe={curto(k.envV) + " em contratos"} cor={AZUL} onClick={() => setFiltro("enviado")} />
        <Kpi rotulo="Assinados no mês" valor={String(k.assMes.length)} detalhe={curto(k.assMesV)} cor={VERDE} tom="text-ok" onClick={() => setFiltro("assinado")} />
        <Kpi rotulo="Rascunhos" valor={String(k.rasc)} detalhe="ainda não enviados" cor={MARINHO} onClick={() => setFiltro("rascunho")} />
        <Kpi rotulo="Assinados sem Financeiro" valor={String(k.semFin)} detalhe={k.rec ? `${k.rec} recusado(s)` : "parcelas a lançar"} cor={LARANJA} tom={k.semFin ? "text-br" : ""} onClick={() => setFiltro("assinado")} />
      </div>

      <Cartao>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
          {FILTROS.map(([v, r]) => (
            <button key={v} onClick={() => setFiltro(v)} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${filtro === v ? "bg-marinho-900 text-white" : "bg-fundo text-suave hover:text-tinta"}`}>{r}</button>
          ))}
          <label className="relative ml-auto w-full sm:w-64">
            <Search className="absolute top-2.5 left-3 size-4 text-suave" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nº, cliente, obra…" className={campo + " pl-9"} />
          </label>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="text-left text-[12px] text-suave"><tr className="border-b border-linha">
              <th className="px-4 py-2">Nº</th><th className="px-4 py-2">Cliente / obra</th><th className="px-4 py-2">Situação</th>
              <th className="px-4 py-2 text-right">Valor</th><th className="hidden px-4 py-2 md:table-cell">Data</th><th className="hidden px-4 py-2 lg:table-cell">Financeiro</th>
            </tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} onClick={() => router.push(`/contratos/?c=${c.id}`)} className="cursor-pointer border-b border-linha last:border-0 hover:bg-fundo/60">
                  <td className="num px-4 py-3 font-semibold">{c.numero}</td>
                  <td className="px-4 py-3"><div className="font-semibold">{c.cliente_nome}</div><div className="text-[12px] text-suave">{c.unidade || "—"}</div></td>
                  <td className="px-4 py-3"><Status s={c.status} /></td>
                  <td className="num px-4 py-3 text-right font-semibold">{reais(c.valor)}</td>
                  <td className="num hidden px-4 py-3 text-suave md:table-cell">{dataTxt(c.data_contrato)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">{c.financeiro_lancado_em ? <Chip cor="bg-ok-claro text-ok"><Check className="size-3" />lançado</Chip> : <span className="text-suave">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {L && !lista.length && (
            <div className="px-4 py-12 text-center text-suave">
              <FileSignature className="mx-auto mb-2 size-8 text-linha" />
              {L.length ? "Nenhum contrato neste filtro." : "Nenhum contrato ainda. Crie o primeiro a partir de um negócio do CRM."}
            </div>
          )}
          {!L && !erro && <p className="px-4 py-6 text-suave">Carregando…</p>}
        </div>
      </Cartao>

      {novo && cfg && <FormContrato inicial={novo} cfg={cfg} onFechar={() => { setNovo(null); if (novoDoNegocio) router.replace("/contratos/"); }}
        onSalvar={async (x) => { const c = await salvarContrato({ ...x, forma_pagamento: x.forma_pagamento || cfg.forma_recebimento }); router.push(`/contratos/?c=${c.id}`); }} />}
      {config && cfg && <ConfigContratosJanela inicial={cfg} onFechar={() => setConfig(false)} onSalvo={setCfg} />}
    </div>
  );
}

// ------------------------------------------------------------------ detalhe
const ROT_EVENTO: Record<string, [string, React.ElementType]> = {
  criado: ["text-suave", Plus], gerado: ["text-azul", FileText], arquivo: ["text-azul", FileUp], enviado: ["text-azul", Send],
  entregue: ["text-ciano", Mail], assinou: ["text-ok", FilePen], assinado: ["text-ok", ShieldCheck], recusado: ["text-erro", XCircle],
  cancelado: ["text-suave", XCircle], lembrete: ["text-br", BellRing], financeiro: ["text-ok", Wallet], editado: ["text-suave", FilePen],
};

function Passo({ n, rot, feito, atual }: { n: number; rot: string; feito: boolean; atual: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold ${feito ? "bg-ok text-white" : atual ? "bg-azul text-white ring-4 ring-azul/20" : "bg-fundo text-suave"}`}>{feito ? <Check className="size-4" /> : n}</span>
      <span className={`truncate text-[13px] font-semibold ${feito || atual ? "text-tinta" : "text-suave"}`}>{rot}</span>
      {n < 4 && <span className={`hidden h-0.5 flex-1 rounded sm:block ${feito ? "bg-ok" : "bg-linha"}`} />}
    </div>
  );
}

export function DetalheContrato({ id }: { id: string }) {
  const router = useRouter();
  const [c, setC] = useState<Contrato | null>(null);
  const [ev, setEv] = useState<EventoContrato[]>([]);
  const [cfg, setCfg] = useState<ConfigContratos | null>(null);
  const [usuario, setUsuario] = useState("");
  const [erro, setErro] = useState(""), [aviso, setAviso] = useState(""), [ocupado, setOcupado] = useState("");
  const [modal, setModal] = useState<"editar" | "lancar" | "enviar" | "cancelar" | "config" | null>(null);
  const [motivo, setMotivo] = useState(""), [mensagem, setMensagem] = useState("");
  const [consent, setConsent] = useState<string | null>(null);
  const arq = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => abrirContrato(id).then((r) => { setC(r.contrato); setEv(r.eventos); }).catch((e) => setErro(mensagemErro(e))), [id]);
  useEffect(() => {
    carregar(); lerConfig().then(setCfg).catch(() => {}); nomeUsuario().then(setUsuario).catch(() => {});
    return ouvirContrato(id, () => carregar());
  }, [id, carregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 4000); return () => clearTimeout(t); }, [aviso]);

  async function agir(rot: string, f: () => Promise<void>) {
    setErro(""); setConsent(null); setOcupado(rot);
    try { await f(); } catch (e) { setErro(mensagemErro(e)); setConsent((e as { consentimento?: string }).consentimento ?? null); } finally { setOcupado(""); }
  }
  if (!c) return <div className="px-4 pt-6 lg:px-9">{erro ? <p className="rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p> : <p className="text-suave">Carregando…</p>}</div>;

  const editavel = ["rascunho", "recusado", "cancelado"].includes(c.status);
  const ext = (c.arquivo_nome ?? c.arquivo_path ?? "").split(".").pop()?.toLowerCase();
  const passos = { dados: true, doc: !!c.arquivo_path, ass: c.status === "assinado" || c.status === "encerrado", fin: !!c.financeiro_lancado_em };
  const atual = !passos.doc ? 2 : !passos.ass ? 3 : !passos.fin ? 4 : 5;
  const signatarios = [
    { papel: "Cliente", nome: c.cliente_nome, email: c.cliente_email },
    { papel: "BRA Ambientes", nome: cfg?.assinante_bra.nome ?? "", email: cfg?.assinante_bra.email ?? "" },
    ...(cfg?.representante_assina ? [{ papel: "Representante legal", nome: cfg.representante.nome, email: cfg.representante.email ?? "" }] : []),
  ];
  const faltaEmail = signatarios.find((s) => !s.email);

  const gerar = () => agir("gerar", async () => {
    const modelos = await listarModelos().catch(() => []);
    const { blob, contrato } = await gerarArquivo(c, cfg!, modelos.find((m) => m.padrao) ?? null);
    setC(contrato); baixarBlob(blob, nomeArquivo(c)); setAviso("Contrato gerado e salvo. Confira no Word antes de enviar."); carregar();
  });
  const baixar = (caminho: string, nome: string) => agir("baixar", async () => { window.open(await linkArquivo(caminho, nome), "_blank"); });

  return (
    <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-7">
      <Link href="/contratos/" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-suave hover:text-azul"><ArrowLeft className="size-4" />Contratos</Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-[22px] font-extrabold tracking-tight lg:text-[26px]">Contrato {c.numero}</h1>
            <Status s={c.status} />
          </div>
          <p className="mt-0.5 text-[14px] text-suave"><b className="text-tinta">{c.cliente_nome}</b>{c.unidade ? ` · ${c.unidade}` : ""} · <span className="num font-semibold text-tinta">{reais(c.valor)}</span></p>
        </div>
        {editavel && <Botao onClick={() => setModal("editar")}><FilePen className="size-4" />Editar dados</Botao>}
      </div>

      <Cartao className="mb-4 flex flex-wrap gap-3 px-4 py-3">
        <Passo n={1} rot="Dados" feito={passos.dados} atual={false} />
        <Passo n={2} rot="Documento" feito={passos.doc} atual={atual === 2} />
        <Passo n={3} rot="Assinatura" feito={passos.ass} atual={atual === 3} />
        <Passo n={4} rot="Financeiro" feito={passos.fin} atual={atual === 4} />
      </Cartao>

      {erro && <div role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}
        {consent && <a href={consent} target="_blank" rel="noreferrer" className="ml-2 font-bold underline">Autorizar o Núcleo no DocuSign</a>}</div>}
      {aviso && <div className="mb-4 rounded-xl bg-ok-claro px-4 py-3 text-[14px] text-ok">{aviso}</div>}
      {c.status === "recusado" && c.recusa_motivo && <div className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro"><b>Recusado</b> — {c.recusa_motivo}. Ajuste e envie de novo.</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Cartao>
            <Titulo>Partes e dados</Titulo>
            <dl className="grid gap-x-6 gap-y-3 px-5 pb-5 text-[13.5px] sm:grid-cols-2">
              {[
                ["Cliente", c.cliente_nome], ["CPF / CNPJ", formatarDocumento(c.cliente_documento) || "—"],
                ["E-mail", c.cliente_email || "—"], ["Telefone", c.cliente_telefone || "—"],
                ["Endereço", c.cliente_endereco || "—"], ["Unidade / obra", c.unidade || "—"],
                ["Data do contrato", dataTxt(c.data_contrato)], ["Forma de recebimento", c.forma_pagamento || cfg?.forma_recebimento || "—"],
              ].map(([k, v]) => <div key={k}><dt className="text-[12px] font-semibold text-suave">{k}</dt><dd className="break-words">{v}</dd></div>)}
              {c.observacoes && <div className="sm:col-span-2"><dt className="text-[12px] font-semibold text-suave">Observações internas</dt><dd className="whitespace-pre-wrap">{c.observacoes}</dd></div>}
            </dl>
          </Cartao>
          <Cartao>
            <Titulo>Forma de pagamento</Titulo>
            <div className="px-5 pb-5">
              <p className="mb-2 text-[13.5px]">Total de <b className="num">{reais(c.valor)}</b></p>
              <div className="overflow-hidden rounded-xl border border-linha text-[13px]">
                <table className="w-full">
                  <thead className="bg-marinho-900 text-left text-[12px] text-white"><tr><th className="px-3 py-1.5">Condição</th><th className="px-3 py-1.5">Valor</th><th className="px-3 py-1.5">Vencimento</th></tr></thead>
                  <tbody>{condicoesPagamento(c).map((l, i) => <tr key={i} className="border-t border-linha"><td className="px-3 py-1.5">{l.condicao}</td><td className="num px-3 py-1.5 font-semibold">{l.valor}</td><td className="px-3 py-1.5">{l.vencimento}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </Cartao>
          <Cartao>
            <Titulo>Linha do tempo</Titulo>
            <ol className="px-5 pb-5">
              {ev.map((e) => {
                const [cor, I] = ROT_EVENTO[e.tipo] ?? ["text-suave", Clock];
                return (
                  <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
                    <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-fundo ${cor}`}><I className="size-3.5" /></span>
                    <div className="min-w-0 text-[13.5px]"><div>{e.descricao}</div><div className="text-[12px] text-suave">{new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</div></div>
                  </li>
                );
              })}
              {!ev.length && <li className="text-[13px] text-suave">Sem eventos.</li>}
            </ol>
          </Cartao>
        </div>

        <div className="space-y-4">
          <Cartao>
            <Titulo>Documento</Titulo>
            <div className="space-y-2.5 px-5 pb-5 text-[13.5px]">
              {c.arquivo_path ? (
                <div className="flex items-center gap-3 rounded-xl border border-linha p-3">
                  <span className={`grid size-10 place-items-center rounded-lg text-[11px] font-extrabold text-white ${ext === "pdf" ? "bg-erro" : "bg-azul"}`}>{(ext ?? "doc").toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold">{c.arquivo_nome}</div><div className="text-[12px] text-suave">arquivo que vai para assinatura</div></div>
                  <button aria-label="Baixar" onClick={() => baixar(c.arquivo_path!, c.arquivo_nome ?? nomeArquivo(c))} className="rounded-lg p-2 text-azul hover:bg-fundo"><Download className="size-4" /></button>
                </div>
              ) : <p className="text-suave">Gere o contrato a partir do modelo Word. Ele baixa para você conferir.</p>}
              {editavel && <>
                <Botao tipo={c.arquivo_path ? "sec" : "pri"} className="w-full" disabled={!!ocupado || !cfg} onClick={gerar}><FileText className="size-4" />{ocupado === "gerar" ? "Gerando…" : c.arquivo_path ? "Gerar de novo pelo modelo" : "Gerar contrato (Word)"}</Botao>
                <input ref={arq} type="file" accept=".docx,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) agir("anexar", async () => { setC(await anexarArquivo(c, f)); setAviso("Arquivo substituído."); carregar(); }); }} />
                <Botao className="w-full" disabled={!!ocupado} onClick={() => arq.current?.click()}><FileUp className="size-4" />{ocupado === "anexar" ? "Enviando…" : "Enviar versão ajustada (Word ou PDF)"}</Botao>
              </>}
              {c.assinado_path && (
                <div className="flex items-center gap-3 rounded-xl border border-ok/30 bg-ok-claro p-3">
                  <ShieldCheck className="size-6 text-ok" />
                  <div className="min-w-0 flex-1"><div className="font-semibold text-ok">PDF assinado</div><div className="text-[12px] text-suave">com certificado do DocuSign · {dataTxt(c.assinado_em)}</div></div>
                  <button aria-label="Baixar assinado" onClick={() => baixar(c.assinado_path!, nomeArquivo(c, "pdf").replace("Contrato_", "Contrato_assinado_"))} className="rounded-lg p-2 text-ok hover:bg-white"><Download className="size-4" /></button>
                </div>
              )}
            </div>
          </Cartao>

          <Cartao>
            <Titulo>Assinatura · DocuSign</Titulo>
            <div className="space-y-3 px-5 pb-5 text-[13.5px]">
              <ul className="space-y-1.5">
                {signatarios.map((s, i) => (
                  <li key={i} className="flex items-center gap-2.5 rounded-xl bg-fundo px-3 py-2">
                    <span className="grid size-6 place-items-center rounded-full bg-white text-[11px] font-bold text-suave">{i === 0 ? 1 : 2}</span>
                    <div className="min-w-0 flex-1"><div className="truncate font-semibold">{s.nome || "—"} <span className="font-normal text-suave">· {s.papel}</span></div>
                      <div className={`truncate text-[12px] ${s.email ? "text-suave" : "text-erro"}`}>{s.email || "sem e-mail"}</div></div>
                  </li>
                ))}
              </ul>
              <p className="text-[12px] text-suave">O cliente assina primeiro; depois a BRA. Cada um recebe o e-mail do DocuSign.</p>
              {c.docusign_status && <p className="text-[12.5px] text-suave">Situação no DocuSign: <b className="text-tinta">{c.docusign_status}</b>{c.docusign_atualizado ? ` · ${new Date(c.docusign_atualizado).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}</p>}
              {editavel && (
                <Botao tipo="pri" className="w-full" disabled={!!ocupado || !c.arquivo_path || !!faltaEmail} onClick={() => { setMensagem(""); setModal("enviar"); }}>
                  <Send className="size-4" />{c.status === "rascunho" ? "Enviar para assinatura" : "Enviar novamente"}
                </Botao>
              )}
              {editavel && !c.arquivo_path && <p className="text-[12px] text-suave">Gere ou anexe o arquivo primeiro.</p>}
              {editavel && faltaEmail && <p className="text-[12px] text-erro">Falta o e-mail de {faltaEmail.papel}. {faltaEmail.papel === "Cliente" ? "Edite os dados do contrato." : <button className="underline" onClick={() => setModal("config")}>Abrir configurações</button>}</p>}
              {c.status === "enviado" && (
                <div className="grid gap-2">
                  <Botao disabled={!!ocupado} onClick={() => agir("atualizar", async () => { const r = await docusign("atualizar", { contrato_id: c.id }); if (r.contrato) setC(r.contrato); carregar(); setAviso("Situação atualizada."); })}>
                    <RefreshCw className={`size-4 ${ocupado === "atualizar" ? "animate-spin" : ""}`} />Atualizar situação</Botao>
                  <Botao disabled={!!ocupado} onClick={() => agir("reenviar", async () => { await docusign("reenviar", { contrato_id: c.id }); carregar(); setAviso("Lembrete reenviado."); })}><BellRing className="size-4" />Reenviar lembrete</Botao>
                  <Botao tipo="perigo" disabled={!!ocupado} onClick={() => { setMotivo(""); setModal("cancelar"); }}><Undo2 className="size-4" />Cancelar envelope</Botao>
                </div>
              )}
              <StatusDocusign compacto />
            </div>
          </Cartao>

          <Cartao>
            <Titulo>Financeiro</Titulo>
            <div className="space-y-2 px-5 pb-5 text-[13.5px]">
              {c.financeiro_lancado_em
                ? <p className="flex items-center gap-2 text-ok"><Check className="size-4" />Parcelas lançadas em {dataTxt(c.financeiro_lancado_em)}. <Link href="/financeiro/" className="font-semibold text-azul hover:underline">Abrir</Link></p>
                : <p className="text-suave">{c.status === "assinado" ? "Contrato assinado: lance a entrada e as parcelas em A receber." : "Depois de assinado, lance as parcelas no Financeiro com um clique."}</p>}
              <Botao tipo={c.status === "assinado" && !c.financeiro_lancado_em ? "pri" : "sec"} className="w-full" disabled={!!ocupado} onClick={() => setModal("lancar")}>
                <CircleDollarSign className="size-4" />Lançar no Financeiro</Botao>
            </div>
          </Cartao>
        </div>
      </div>

      {modal === "editar" && cfg && (
        <FormContrato inicial={c} cfg={cfg} onFechar={() => setModal(null)}
          onSalvar={async (x) => { const n = await salvarContrato({ ...x, id: c.id }); setC(n); setModal(null); setAviso(c.arquivo_path ? "Dados salvos. Gere o documento de novo para levar as mudanças ao contrato." : "Dados salvos."); }}
          onExcluir={async () => { await excluirContrato(c.id); router.push("/contratos/"); }} />
      )}
      {modal === "lancar" && (
        <FormLancarContrato contrato={c} usuario={usuario} onFechar={() => setModal(null)}
          onConfirmar={async (itens) => { await lancarContratoNoFinanceiro(c, itens, usuario); setModal(null); setAviso("Parcelas lançadas no Financeiro."); carregar(); }} />
      )}
      {modal === "config" && cfg && <ConfigContratosJanela inicial={cfg} onFechar={() => setModal(null)} onSalvo={setCfg} />}
      <Janela titulo="Enviar para assinatura" aberto={modal === "enviar"} onFechar={() => setModal(null)}
        rodape={<>
          <Botao tipo="pri" disabled={!!ocupado} onClick={() => agir("enviar", async () => { const r = await docusign("enviar", { contrato_id: c.id, mensagem: mensagem.trim() || undefined }); if (r.contrato) setC(r.contrato); setModal(null); carregar(); setAviso("Enviado! O cliente vai receber o e-mail do DocuSign."); })}>
            <Send className="size-4" />{ocupado === "enviar" ? "Enviando…" : "Enviar pelo DocuSign"}</Botao>
          <Botao onClick={() => setModal(null)}>Cancelar</Botao>
        </>}>
        <p className="mb-3 text-[13.5px]">O arquivo <b>{c.arquivo_nome}</b> vai para:</p>
        <ul className="mb-3 space-y-1 text-[13.5px]">{signatarios.map((s, i) => <li key={i}>• <b>{s.nome}</b> ({s.papel}) — {s.email}</li>)}</ul>
        <Rotulo rotulo="Mensagem no e-mail (opcional)"><textarea className={campo} rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Olá! Segue o contrato da BRA Ambientes para sua assinatura eletrônica…" /></Rotulo>
      </Janela>
      <Janela titulo="Cancelar envelope" aberto={modal === "cancelar"} onFechar={() => setModal(null)}
        rodape={<>
          <Botao tipo="perigo" disabled={!!ocupado} onClick={() => agir("cancelar", async () => { const r = await docusign("cancelar", { contrato_id: c.id, motivo }); if (r.contrato) setC(r.contrato); setModal(null); carregar(); })}>{ocupado === "cancelar" ? "Cancelando…" : "Cancelar envelope"}</Botao>
          <Botao onClick={() => setModal(null)}>Voltar</Botao>
        </>}>
        <p className="mb-3 text-[13.5px]">O link de assinatura deixa de valer para todos. Depois você pode ajustar e enviar de novo.</p>
        <Rotulo rotulo="Motivo (aparece para os signatários)"><input className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Rotulo>
      </Janela>
    </div>
  );
}
