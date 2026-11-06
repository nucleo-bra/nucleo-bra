"use client";
// Cartão do cliente: tudo o que acontece com ele no sistema, sincronizado das
// outras áreas (CRM, orçamentos, contratos, Financeiro, chamados, visitas,
// projetos, documentos). Aqui só se edita o cadastro e se guardam arquivos do cliente.
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft, Building2, CalendarClock, Check, Copy, Download, FileSignature, FileText, Handshake, Headset, Layers, Mail, MapPin, MessageCircle,
  Pencil, Phone, SquareKanban, Unlink, Users, Wallet,
} from "lucide-react";
import { telefone, whatsapp } from "@/lib/texto";
import { FormCliente } from "@/components/clientes/form-cliente";
import { Cliente, desvincularAditivo, enderecoLinha, lerCliente } from "@/lib/clientes";
import { ETAPAS_NEGOCIO, rotulo } from "@/lib/crm";
import { Bloco, Selo, Shell, Vazio } from "@/components/Shell";
import { formatarData, formatarReais } from "@/lib/dados";
import { formatarDocumento } from "@/lib/importacao/util";
import { mensagemErro } from "@/lib/supabase";
import { linkDocumento, TIPOS_ARQUIVO_CLIENTE } from "@/lib/pasta";
import { EnviarArquivos } from "@/components/clientes/enviar-arquivos";
import { LinhaArquivo } from "@/components/arquivo-linha";
import { abrirPdf } from "@/components/orcamentos/lista";
import { carregarFicha360, Ficha360 } from "@/lib/cliente360";
import { STATUS_ORC } from "@/lib/orcamentos";
import { usePapel } from "@/lib/usar-papel";

function CopiarLinha({ linha }: { linha: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(linha.replace(/\D/g, "")); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="inline-flex items-center gap-1 text-[12px] text-suave hover:text-tinta">
      {ok ? <><Check className="size-3.5 text-ok" /> Copiada</> : <><Copy className="size-3.5" /> Copiar linha digitável</>}
    </button>
  );
}

const ABAS = [["resumo", "Resumo", Layers], ["financeiro", "Financeiro", Wallet], ["tecnico", "Projetos e técnico", SquareKanban], ["comercial", "Negócios e orçamentos", Handshake], ["documentos", "Documentos", FileText]] as const;
type Aba = (typeof ABAS)[number][0];
const dataHora = (s: string | null) => (s ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("pt-BR") : "—");
const STATUS_PROJ: Record<string, string> = { em_negociacao: "Em negociação", em_execucao: "Em execução", entregue: "Entregue", pos_venda: "Pós-venda", cancelado: "Cancelado" };
const STATUS_CTR: Record<string, string> = { rascunho: "Rascunho", enviado: "Enviado para assinatura", assinado: "Assinado", cancelado: "Cancelado", encerrado: "Encerrado", recusado: "Recusado" };

function Ficha() {
  const id = useSearchParams().get("id") ?? "";
  const [f, setF] = useState<Ficha360 | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  const [cad, setCad] = useState<Cliente | null>(null);
  const [editar, setEditar] = useState(false);
  const [aba, setAba] = useState<Aba>("resumo");
  const papel = usePapel(), tecnico = papel === "tecnico", diretoria = papel === "diretoria";   // técnico não vê valores, negócios nem financeiro
  const carregar = useCallback(() => { carregarFicha360(id).then(setF).catch((e) => setErro(mensagemErro(e))); lerCliente(id).then(setCad).catch(() => {}); }, [id]);
  useEffect(carregar, [carregar]);

  if (erro) return <Shell titulo="Cliente"><p role="alert" className="rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p></Shell>;
  if (f === undefined) return <Shell titulo="Cliente"><div className="h-40" /></Shell>;
  if (f === null) return <Shell titulo="Cliente"><Vazio>Cliente não encontrado.</Vazio></Shell>;
  const c = f.cliente, r = f.resumo;
  const abrir = (path: string) => linkDocumento(path).then((u) => window.open(u, "_blank")).catch((e) => setErro(mensagemErro(e)));
  const fechadoOrc = f.orcamentos.find((p) => p.status === "aprovada");

  return (
    <Shell titulo={c.nome} cheio>
      <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-7">
        <Link href="/clientes/" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-suave hover:text-tinta"><ArrowLeft className="size-4" /> Clientes</Link>

        {f.principal && (
          <p className="mb-4 rounded-xl bg-ciano-claro px-4 py-3 text-[13.5px] text-[#0a6a96]">
            Este cadastro é um <b>aditivo</b> de <Link href={`/clientes/ficha/?id=${f.principal.id}`} className="font-bold underline">{f.principal.nome}</Link>. O histórico completo fica no cartão principal.
          </p>
        )}

        {/* cabeçalho */}
        <section className="relative mb-5 overflow-hidden rounded-[20px] heroi p-5 text-white  lg:p-7">
          <div className="pointer-events-none absolute -top-24 -right-20 size-80 rounded-full bg-[radial-gradient(circle,rgba(34,199,214,.3),transparent_70%)]" aria-hidden />
          <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
          <div className="relative flex flex-wrap items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/12 font-display text-[20px] font-extrabold ring-1 ring-white/20">
              {(c.nome_fantasia || c.nome).trim().split(/\s+/).filter((p: string) => p.length > 2).map((p: string) => p[0]).slice(0, 2).join("").toUpperCase() || "?"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-semibold tracking-[.14em] text-ciano uppercase">{c.tipo === "PJ" ? "Empresa" : "Pessoa física"}{f.aditivos.length ? ` · ${f.aditivos.length} aditivo(s)` : ""}</div>
              <h1 className="font-display text-[22px] leading-tight font-extrabold break-words lg:text-[28px]">{c.nome_fantasia || c.nome}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-white/75">
                {c.documento && <span className="num whitespace-nowrap">{c.tipo === "PJ" ? "CNPJ" : "CPF"} {formatarDocumento(c.documento)}</span>}
                {c.cidade && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{c.cidade}{c.uf ? `/${c.uf}` : ""}</span>}
                {c.telefone && <span className="num">{telefone(c.telefone)}</span>}
                {c.email && <span className="truncate">{c.email}</span>}
              </div>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {c.telefone && whatsapp(c.telefone) && <a href={whatsapp(c.telefone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#25d366] px-3.5 py-2 text-[13.5px] font-semibold text-white hover:brightness-110"><MessageCircle className="size-4" />WhatsApp</a>}
              {c.telefone && <a href={`tel:${c.telefone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-3.5 py-2 text-[13.5px] font-semibold ring-1 ring-white/20 hover:bg-white/20"><Phone className="size-4" />Ligar</a>}
              {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-3.5 py-2 text-[13.5px] font-semibold ring-1 ring-white/20 hover:bg-white/20"><Mail className="size-4" />E-mail</a>}
              <button onClick={() => setEditar(true)} disabled={!cad} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[13.5px] font-semibold text-marinho-900 hover:shadow-lg disabled:opacity-50"><Pencil className="size-4" />Editar cadastro</button>
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {([
              ...(tecnico ? [] : [["Valor fechado", formatarReais(r.fechado), f.negocios.filter((x) => x.etapa === "ganho").length ? `${f.negocios.filter((x) => x.etapa === "ganho").length} negócio(s) fechado(s)` : "nenhum fechado"],
              ["Já pago", formatarReais(r.pago), `${f.parcelas.filter((p) => p.pago_em).length} parcela(s)`],
              ["Em aberto", formatarReais(r.aberto + r.vencido), r.vencido ? `${formatarReais(r.vencido)} vencido` : "nada vencido"]] as const),
              ["Visitas", String(r.visitasFeitas), r.visitasAgendadas ? `${r.visitasAgendadas} agendada(s)` : "nenhuma agendada"],
              ["Chamados", String(r.chamados), r.chamadosAbertos ? `${r.chamadosAbertos} em aberto` : "nenhum aberto"],
              ...(tecnico ? [] : [["Negócios", String(f.negocios.length), r.negociosAbertos ? `${r.negociosAbertos} em andamento` : "nenhum em andamento"]] as const),
            ] as const).map(([t, v, d]) => (
              <div key={t} className="rounded-xl bg-white/[.08] px-3.5 py-2.5 ring-1 ring-white/10">
                <div className="text-[11.5px] font-semibold text-white/65">{t}</div>
                <div className="num font-display text-[18px] font-extrabold">{v}</div>
                <div className="truncate text-[11.5px] text-white/55">{d}</div>
              </div>
            ))}
          </div>
        </section>

        <p className="mb-4 text-[12.5px] text-suave">Tudo neste cartão vem das outras áreas do Núcleo e se atualiza sozinho. Aqui você edita o cadastro e guarda arquivos do cliente.{diretoria && <> · <Link href={`/historico/?registro=${c.id}`} className="font-semibold text-azul hover:underline">Ver histórico de alterações do cadastro</Link></>}</p>

        <nav className="mb-5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Seções do cliente">
          {ABAS.filter(([k]) => !tecnico || !["financeiro", "comercial"].includes(k)).map(([k, rot, I]) => (
            <button key={k} onClick={() => setAba(k)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold whitespace-nowrap ${aba === k ? "bg-marinho-900 text-white shadow-md" : "bg-white text-suave hover:text-tinta"}`}><I className="size-4" />{rot}</button>
          ))}
        </nav>

        {aba === "resumo" && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Bloco titulo="O que está acontecendo">
              {!f.eventos.length ? <Vazio>Nada registrado ainda.</Vazio> : (
                <ol className="relative px-5 py-4">
                  <span className="absolute top-4 bottom-4 left-[27px] w-px bg-linha" aria-hidden />
                  {f.eventos.slice(0, 40).map((e, i) => {
                    const corpo = (
                      <span className="flex min-w-0 items-start gap-3">
                        <span className="relative z-[1] mt-1 size-3 shrink-0 rounded-full ring-4 ring-white" style={{ background: e.cor }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11.5px] font-semibold text-suave uppercase">{e.tipo} · {dataHora(e.data)}</span>
                          <span className="block truncate text-[14px] font-medium">{e.titulo}</span>
                          {e.detalhe && <span className="block truncate text-[12.5px] text-suave">{e.detalhe}</span>}
                        </span>
                      </span>
                    );
                    return <li key={i} className="py-1.5">{e.link ? <Link href={e.link} className="block rounded-lg hover:bg-fundo/60">{corpo}</Link> : corpo}</li>;
                  })}
                </ol>
              )}
            </Bloco>
            <div className="space-y-6">
              <Bloco titulo="Profissionais do projeto">
                {!f.profissionais.length ? <Vazio>Nenhum arquiteto, engenheiro, designer ou técnico ligado ainda.</Vazio> : (
                  <ul className="divide-y divide-linha">
                    {f.profissionais.map((p) => (
                      <li key={p.origem + p.nome} className="flex items-center gap-3 px-5 py-3">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${p.origem === "parceiro" ? "bg-[#fff1e5] text-br" : p.origem === "equipe" ? "bg-[#eef3fb] text-azul" : "bg-ciano-claro text-[#0a6a96]"}`}>
                          {p.origem === "tecnico" ? <Headset className="size-4" /> : <Users className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          {p.parceiro_id ? <Link href={`/crm/?aba=parceiros&parceiro=${p.parceiro_id}`} className="block truncate text-[14px] font-semibold hover:text-azul">{p.nome}</Link> : <span className="block truncate text-[14px] font-semibold">{p.nome}</span>}
                          <span className="block truncate text-[12.5px] text-suave">{p.papel} · {p.detalhe}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloco>
              <Bloco titulo="Aditivos">
                {!f.aditivos.length ? <Vazio>Sem aditivos. Para juntar um cadastro duplicado ou um aditivo, arraste o cartão dele sobre este na lista de clientes.</Vazio> : (
                  <ul className="divide-y divide-linha">
                    {f.aditivos.map((a) => (
                      <li key={a.id} className="flex items-center hover:bg-fundo/60"><Link href={`/clientes/ficha/?id=${a.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-5 py-3"><Building2 className="size-4 text-azul" /><span className="flex-1 truncate text-[14px] font-medium">{a.nome}</span><span className="text-[12px] text-suave">{a.cidade}</span></Link>
                        {!tecnico && <button title="Desvincular: volta a ser um cliente separado" onClick={() => { if (confirm(`Separar "${a.nome}" deste cliente?`)) desvincularAditivo(a.id).then(carregar).catch((e) => setErro(mensagemErro(e))); }} className="mr-3 rounded-lg p-1.5 text-suave hover:bg-white hover:text-erro"><Unlink className="size-4" /></button>}</li>
                    ))}
                  </ul>
                )}
              </Bloco>
              <Bloco titulo="Cadastro">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 text-[13.5px] sm:grid-cols-2">
                  <div><dt className="text-[12px] text-suave">{c.tipo === "PJ" ? "CNPJ" : "CPF"}</dt><dd className="num">{c.documento ? formatarDocumento(c.documento) : "Não informado"}</dd></div>
                  <div><dt className="text-[12px] text-suave">{c.tipo === "PJ" ? "Nome fantasia" : "Nascimento"}</dt><dd>{c.tipo === "PJ" ? c.nome_fantasia || "—" : c.data_nascimento ? formatarData(c.data_nascimento) : "—"}</dd></div>
                  <div className="min-w-0"><dt className="text-[12px] text-suave">E-mail</dt><dd className="truncate">{c.email || "—"}</dd></div>
                  <div><dt className="text-[12px] text-suave">Telefone</dt><dd className="num">{c.telefone ? telefone(c.telefone) : "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-[12px] text-suave">Endereço</dt><dd>{cad && enderecoLinha(cad) ? enderecoLinha(cad) : "—"}</dd></div>
                  {c.observacoes && <div className="sm:col-span-2"><dt className="text-[12px] text-suave">Observações</dt><dd className="whitespace-pre-wrap">{c.observacoes}</dd></div>}
                </dl>
              </Bloco>
            </div>
          </div>
        )}

        {aba === "financeiro" && (
          <div className="space-y-6">
            <Bloco titulo="Parcelas no Financeiro" extra={<Link href="/financeiro/" className="text-[12.5px] font-semibold text-azul hover:underline">Abrir Financeiro</Link>}>
              {!f.parcelas.length ? <Vazio>Nenhuma parcela lançada para este cliente.</Vazio> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[13.5px]">
                    <thead><tr className="border-b border-linha bg-fundo text-left text-[12px] font-semibold text-suave"><th className="px-5 py-2">Vencimento</th><th className="px-2 py-2">Descrição</th><th className="px-2 py-2">Parcela</th><th className="px-2 py-2">Situação</th><th className="px-5 py-2 text-right">Valor</th></tr></thead>
                    <tbody>{f.parcelas.map((p) => (
                      <tr key={p.id} className="border-b border-linha last:border-0">
                        <td className="num px-5 py-2.5">{dataHora(p.vencimento)}</td>
                        <td className="px-2 py-2.5"><div className="font-medium">{p.descricao}</div>{p.nf && <div className="text-[12px] text-suave">{p.nf}{p.cliente !== (c.nome_fantasia || c.nome) ? ` · ${p.cliente}` : ""}</div>}</td>
                        <td className="px-2 py-2.5 text-suave">{p.parcela || "Única"}</td>
                        <td className="px-2 py-2.5"><Selo status={p.pago_em ? "pago" : p.situacao === "atrasado" ? "vencido" : "aberto"} />{p.pago_em && <div className="text-[11.5px] text-suave">pago {dataHora(p.pago_em)}</div>}</td>
                        <td className="num px-5 py-2.5 text-right font-semibold">{formatarReais(p.pago_em ? p.recebido || p.valor : p.valor)}</td>
                      </tr>))}</tbody>
                    <tfoot><tr className="border-t border-linha bg-fundo/60 text-[13px]"><td colSpan={4} className="px-5 py-2 font-semibold">Pago {formatarReais(r.pago)} · em aberto {formatarReais(r.aberto)} · vencido {formatarReais(r.vencido)}</td><td className="num px-5 py-2 text-right font-bold">{formatarReais(f.parcelas.reduce((s, p) => s + p.valor, 0))}</td></tr></tfoot>
                  </table>
                </div>
              )}
            </Bloco>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
              <Bloco titulo="Notas fiscais">
                {!f.notas.length ? <Vazio>Nenhuma nota.</Vazio> : (
                  <ul className="divide-y divide-linha">{f.notas.map((nf) => (
                    <li key={nf.id} className="flex items-center justify-between gap-3 px-5 py-3"><div><div className="text-[14px] font-medium">{nf.tipo === "nfse" ? "NFS-e" : "NF-e"} {nf.numero}</div><div className="text-[13px] text-suave">{formatarData(nf.emitida_em)}{nf.ordem_compra ? ` · OC ${nf.ordem_compra}` : ""}</div></div>
                      <div className="text-right"><div className="num text-[14px] font-semibold">{formatarReais(nf.valor_servicos)}</div><Selo status={nf.status} /></div></li>))}</ul>
                )}
              </Bloco>
              <Bloco titulo="Boletos e títulos">
                {!f.titulos.length ? <Vazio>Nenhum boleto.</Vazio> : (
                  <ul className="divide-y divide-linha">{f.titulos.map((t) => (
                    <li key={t.id} className="px-5 py-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-[14px] font-medium">{t.descricao}</div><div className="text-[13px] text-suave">Vence {formatarData(t.vencimento)}</div></div>
                      <div className="text-right"><div className="num text-[14px] font-semibold">{formatarReais(t.valor)}</div><Selo status={t.status === "aberto" && t.vencimento < new Date().toISOString().slice(0, 10) ? "vencido" : t.status} /></div></div>
                      {t.linha_digitavel && <div className="mt-1.5"><CopiarLinha linha={t.linha_digitavel} /></div>}</li>))}</ul>
                )}
              </Bloco>
            </div>
          </div>
        )}

        {aba === "tecnico" && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
            <Bloco titulo="Projetos e obras">
              {!f.projetos.length && !f.cartoes.some((k) => k.modulo === "projetos") ? <Vazio>Nenhum projeto.</Vazio> : (
                <ul className="divide-y divide-linha">
                  {f.projetos.map((p: { id: string; nome: string; status: string; endereco: string | null }) => <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[14px]"><span className="min-w-0"><span className="block truncate font-medium">{p.nome}</span>{p.endereco && <span className="block truncate text-[12.5px] text-suave">{p.endereco}</span>}</span><span className="shrink-0 rounded-full bg-fundo px-2.5 py-0.5 text-[11.5px] font-bold text-suave">{STATUS_PROJ[p.status] ?? p.status}</span></li>)}
                  {f.cartoes.filter((k) => k.modulo === "projetos").map((k) => <ItemCartao key={k.id} k={k} />)}
                </ul>
              )}
            </Bloco>
            <Bloco titulo={`Chamados (${f.cartoes.filter((k) => k.modulo === "chamados").length})`}>
              {!f.cartoes.some((k) => k.modulo === "chamados") ? <Vazio>Nenhum chamado.</Vazio> : <ul className="divide-y divide-linha">{f.cartoes.filter((k) => k.modulo === "chamados").map((k) => <ItemCartao key={k.id} k={k} />)}</ul>}
            </Bloco>
            <Bloco titulo={`Visitas e agendamentos (${r.visitasFeitas} feitas · ${r.visitasAgendadas} agendadas)`} className="xl:col-span-2">
              {!f.cartoes.some((k) => k.modulo === "agendamentos") && !f.atividades.some((a) => a.tipo === "visita") ? <Vazio>Nenhuma visita.</Vazio> : (
                <ul className="divide-y divide-linha">
                  {f.cartoes.filter((k) => k.modulo === "agendamentos").map((k) => <ItemCartao key={k.id} k={k} />)}
                  {f.atividades.filter((a) => a.tipo === "visita").map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3"><CalendarClock className="size-4 shrink-0 text-azul" /><span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{a.titulo}</span><span className="block text-[12.5px] text-suave">Visita comercial · {dataHora(a.quando)}{a.endereco ? ` · ${a.endereco}` : ""}</span></span>{a.concluida && <span className="rounded-full bg-ok-claro px-2.5 py-0.5 text-[11.5px] font-bold text-ok">Concluída</span>}</li>
                  ))}
                </ul>
              )}
            </Bloco>
          </div>
        )}

        {aba === "comercial" && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
            <Bloco titulo="Negócios no CRM">
              {!f.negocios.length ? <Vazio>Nenhum negócio.</Vazio> : (
                <ul className="divide-y divide-linha">{f.negocios.map((ng) => (
                  <li key={ng.id}><Link href={`/crm/?aba=negocios&n=${ng.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-fundo/60">
                    <Handshake className="size-4 shrink-0 text-azul" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{ng.numero ? `${ng.numero} - ` : ""}{ng.titulo}</span><span className="block text-[12.5px] text-suave">{rotulo(ETAPAS_NEGOCIO, ng.etapa === "qualificacao" ? "lead" : ng.etapa)}{ng.parceiros?.nome ? ` · ${ng.parceiros.nome}` : ""}</span></span>
                    <span className="num text-[14px] font-semibold">{formatarReais(Number(ng.valor_estimado) || 0)}</span></Link></li>))}</ul>
              )}
            </Bloco>
            <Bloco titulo="Orçamentos" extra={fechadoOrc && <span className="rounded-full bg-ok-claro px-2.5 py-0.5 text-[11.5px] font-bold text-ok">Fechado: nº {fechadoOrc.numero}</span>}>
              {!f.orcamentos.length ? <Vazio>Nenhum orçamento.</Vazio> : (
                <ul className="divide-y divide-linha">{f.orcamentos.map((pr) => (
                  <li key={pr.id} className={`flex items-center justify-between gap-3 px-5 py-3 ${pr.status === "aprovada" ? "bg-ok-claro/40" : ""}`}>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium">Nº {pr.numero} · {pr.titulo}</div>
                      <div className="text-[12.5px] text-suave">{dataHora(pr.editado_em ?? pr.data_emissao)} · {STATUS_ORC[pr.status as keyof typeof STATUS_ORC]?.rot ?? pr.status}</div>
                      <div className="mt-1 flex gap-3 text-[12.5px]">
                        {!!pr.itens && pr.oportunidade_id && <Link href={`/crm/?aba=negocios&n=${pr.oportunidade_id}&orc=${pr.id}`} className="inline-flex items-center gap-1 font-semibold text-azul hover:underline"><Pencil className="size-3.5" />Abrir</Link>}
                        {(pr.itens || pr.documento_id) && <button onClick={() => abrirPdf({ id: pr.id, itens: pr.itens, documento_id: pr.documento_id }).catch((e) => setErro(mensagemErro(e)))} className="inline-flex items-center gap-1 font-semibold text-azul hover:underline"><Download className="size-3.5" />PDF</button>}
                      </div>
                    </div>
                    <div className="num text-[14px] font-semibold">{formatarReais(pr.total_final)}</div>
                  </li>))}</ul>
              )}
            </Bloco>
            <Bloco titulo="Contratos" className="xl:col-span-2">
              {!f.contratos.length ? <Vazio>Nenhum contrato.</Vazio> : (
                <ul className="divide-y divide-linha">{f.contratos.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <FileSignature className="size-4 shrink-0 text-azul" />
                    <Link href={`/contratos/?c=${k.id}`} className="min-w-0 flex-1 hover:text-azul"><span className="block truncate text-[14px] font-medium">Contrato {k.numero}</span><span className="block text-[12.5px] text-suave">{STATUS_CTR[k.status] ?? k.status}{k.assinado_em ? ` em ${dataHora(k.assinado_em)}` : ""}</span></Link>
                    {k.assinado_path && <button onClick={() => abrir(k.assinado_path)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ok hover:underline"><Download className="size-3.5" />Assinado</button>}
                    {k.arquivo_path && <button onClick={() => abrir(k.arquivo_path)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-azul hover:underline"><Download className="size-3.5" />Contrato</button>}
                    <span className="num text-[14px] font-semibold">{formatarReais(k.valor)}</span>
                  </li>))}</ul>
              )}
            </Bloco>
          </div>
        )}

        {aba === "documentos" && (
          <Bloco titulo={`Documentos (${f.documentos.length})`}>
            <EnviarArquivos tecnico={tecnico} clienteId={c.id} negocios={f.negocios.map((n) => ({ id: n.id, nome: `${n.numero ? n.numero + " · " : ""}${n.titulo ?? "Negócio"}` }))} onEnviado={carregar} />
            {!f.documentos.length ? <Vazio>Nenhum arquivo ainda. Os orçamentos e contratos da pasta do negócio também aparecem aqui.</Vazio> : (
              <ul className="divide-y divide-linha">{f.documentos.map((d) => (
                <LinhaArquivo key={d.id} doc={d} abrir={(p) => abrir(p)} podeExcluir={diretoria} onMudou={carregar}
                  tipos={tecnico ? TIPOS_ARQUIVO_CLIENTE.filter(([k]) => ["projeto", "foto", "outro"].includes(k)) : TIPOS_ARQUIVO_CLIENTE}
                  detalhe={<>{(Object.fromEntries(TIPOS_ARQUIVO_CLIENTE) as Record<string, string>)[d.tipo]?.replace(" (PDF / DWG)", "") ?? "Arquivo"} · {formatarData(d.created_at)}{d.negocio ? ` · ${d.negocio}` : ""}</>} />
              ))}</ul>
            )}
          </Bloco>
        )}

        {editar && cad && <FormCliente inicial={cad} onFechar={() => setEditar(false)} onSalvo={() => { setEditar(false); carregar(); }} />}
      </div>
    </Shell>
  );
}

function ItemCartao({ k }: { k: Ficha360["cartoes"][number] }) {
  const I = k.modulo === "chamados" ? Headset : k.modulo === "agendamentos" ? CalendarClock : SquareKanban;
  return (
    <li><Link href={`/tecnico/${k.modulo}/`} className="flex items-center gap-3 px-5 py-3 hover:bg-fundo/60">
      <I className="size-4 shrink-0 text-azul" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{k.numero ? `${k.numero} · ` : ""}{k.titulo}</span>
        <span className="block truncate text-[12.5px] text-suave">{[k.lista, k.agenda_inicio ? dataHora(k.agenda_inicio) : k.prazo ? `prazo ${dataHora(k.prazo)}` : "", k.equipe.join(", ")].filter(Boolean).join(" · ")}</span>
      </span>
      {k.concluido_em ? <span className="rounded-full bg-ok-claro px-2.5 py-0.5 text-[11.5px] font-bold text-ok">Concluído</span> : null}
    </Link></li>
  );
}

export default function Pagina() {
  return <Suspense><Ficha /></Suspense>;
}
