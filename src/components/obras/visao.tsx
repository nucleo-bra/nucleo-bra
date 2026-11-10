"use client";
// Visão geral da obra: dados, andamento, atendimentos do cliente e entrega (termo + garantia).
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, FileDown, FileSignature, Headset, Link2, ShieldCheck, Upload, Users } from "lucide-react";
import { Caixa } from "@/components/projetos/painel-quadro";
import { Avatar } from "@/components/projetos/pecas";
import { atendimentosDoCliente, conferencia, dataBr, enviarArquivoObra, etapaAtrasada, fimGarantia, hojeIso, ObraCompleta, salvarObra, situacaoEtapa, urlArquivo } from "@/lib/obras";
import { gerarTermo } from "@/lib/obra-pdf";
import { Membro } from "@/lib/projetos";
import { mensagemErro } from "@/lib/supabase";

const inp = "w-full rounded-[10px] border border-linha bg-white px-3 py-2 text-[14px] outline-none focus:border-azul";
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function VisaoGeral({ d, equipe, papel, onMudou, irPara }: { d: ObraCompleta; equipe: Membro[]; papel: string | null; onMudou: () => void; irPara: (aba: string) => void }) {
  const o = d.obra;
  const [f, setF] = useState(o);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [atend, setAtend] = useState<Awaited<ReturnType<typeof atendimentosDoCliente>>>([]);
  const [ocupado, setOcupado] = useState("");
  useEffect(() => setF(o), [o]);
  useEffect(() => { if (o.cliente_id) atendimentosDoCliente(o.cliente_id).then(setAtend).catch(() => {}); }, [o.cliente_id]);
  useEffect(() => { if (!ok) return; const t = setTimeout(() => setOk(""), 2500); return () => clearTimeout(t); }, [ok]);

  const mudou = (["titulo", "endereco", "telefone", "inicio", "previsao_entrega", "garantia_meses", "link_arquivos", "observacoes"] as const).some((k) => (f[k] ?? "") !== (o[k] ?? ""))
    || f.responsaveis.join() !== o.responsaveis.join();
  async function salvar() {
    setErro("");
    try {
      await salvarObra(o.id, { titulo: f.titulo, endereco: f.endereco || null, telefone: f.telefone || null, inicio: f.inicio || null, previsao_entrega: f.previsao_entrega || null,
        garantia_meses: Number(f.garantia_meses) || 0, link_arquivos: f.link_arquivos || null, observacoes: f.observacoes || null, responsaveis: f.responsaveis });
      setOk("Dados salvos"); onMudou();
    } catch (e) { setErro(mensagemErro(e)); }
  }
  const hoje = hojeIso();
  const feitas = d.etapas.filter((e) => e.fim_real).length, atrasadas = d.etapas.filter((e) => etapaAtrasada(e, hoje));
  const atual = d.etapas.find((e) => !e.fim_real);
  const docs = d.docs.filter((x) => x.incluir), docsOk = docs.filter((x) => x.status === "aprovado").length;
  const conf = conferencia(d.itens, d.saidas);
  const custoPrev = conf.reduce((a, l) => a + l.custoVendido, 0), custoReal = conf.reduce((a, l) => a + l.custoSaiu, 0);
  const faltam = conf.filter((l) => l.situacao === "falta").length;
  const verValores = papel === "diretoria" || papel === "financeiro";
  const garantiaAte = fimGarantia(o);
  const sistemas = [...new Set(d.itens.map((i) => i.sistema).filter(Boolean))];

  async function baixarTermo() {
    setOcupado("termo"); setErro("");
    try {
      const b = await gerarTermo(o, sistemas, equipe.find((m) => m.papel === "diretoria")?.nome ?? "BRA Ambientes Inteligentes");
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `Termo_de_entrega_${(o.cliente_nome ?? "obra").replace(/\W+/g, "_")}.pdf`; a.click();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(""); }
  }
  async function anexarTermo(arq: File | undefined, quando: string) {
    if (!arq) return;
    if (!/\.pdf$/i.test(arq.name)) { setErro("Envie o termo assinado em PDF."); return; }
    setOcupado("anexo"); setErro("");
    try {
      const caminho = await enviarArquivoObra(o.id, arq, "termo-entrega-assinado.pdf");
      await salvarObra(o.id, { termo_path: caminho, entregue_em: quando, status: "entregue" });
      setOk("Obra entregue · garantia iniciada"); onMudou();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(""); }
  }
  const [dataEntrega, setDataEntrega] = useState(hoje);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 xl:grid-cols-3">
      <div className="space-y-4 lg:space-y-5 xl:col-span-2">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Indicador rot="Cronograma" valor={`${d.etapas.length ? Math.round((feitas / d.etapas.length) * 100) : 0}%`} det={`${feitas}/${d.etapas.length} etapas`} alerta={atrasadas.length ? `${atrasadas.length} atrasada(s)` : ""} onClick={() => irPara("cronograma")} />
          <Indicador rot="Documentação" valor={`${docsOk}/${docs.length}`} det="cartões aprovados" onClick={() => irPara("documentacao")} />
          <Indicador rot="Materiais" valor={String(faltam)} det="itens ainda a sair" alerta={d.saidas.some((s) => !s.revisado_em) ? "saídas para revisar" : ""} onClick={() => irPara("materiais")} />
          <Indicador rot="Entrega prevista" valor={dataBr(o.entregue_em ?? o.previsao_entrega)} det={o.entregue_em ? "entregue" : atual ? `agora: ${atual.nome}` : ""} alerta={!o.entregue_em && o.previsao_entrega && o.previsao_entrega < hoje ? "prazo vencido" : ""} />
        </div>

        <Caixa titulo="Dados da obra" icone={Users} extra={mudou && <button onClick={salvar} className="rounded-full bg-azul px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-azul-escuro">Salvar</button>}>
          <div className="grid gap-3 md:grid-cols-2">
            <Rot t="Nome do projeto"><input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} className={inp} /></Rot>
            <Rot t="Telefone / WhatsApp do cliente"><input value={f.telefone ?? ""} onChange={(e) => setF({ ...f, telefone: e.target.value })} className={inp} /></Rot>
            <Rot t="Endereço da obra" span><input value={f.endereco ?? ""} onChange={(e) => setF({ ...f, endereco: e.target.value })} className={inp} /></Rot>
            <Rot t="Início"><input type="date" value={f.inicio ?? ""} onChange={(e) => setF({ ...f, inicio: e.target.value })} className={inp} /></Rot>
            <Rot t="Previsão de entrega"><input type="date" value={f.previsao_entrega ?? ""} onChange={(e) => setF({ ...f, previsao_entrega: e.target.value })} className={inp} /></Rot>
            <Rot t="Garantia da instalação (meses)"><input type="number" min={0} max={120} value={f.garantia_meses} onChange={(e) => setF({ ...f, garantia_meses: Number(e.target.value) })} className={inp} /></Rot>
            <Rot t="Link da pasta de arquivos (vira o QR code da documentação)"><input value={f.link_arquivos ?? ""} onChange={(e) => setF({ ...f, link_arquivos: e.target.value })} placeholder="https://…" className={inp} /></Rot>
            <div className="md:col-span-2">
              <span className="mb-1 block text-[12px] font-semibold text-suave">Responsáveis</span>
              <div className="flex flex-wrap gap-1.5">
                {equipe.filter((m) => m.papel === "tecnico" || m.papel === "diretoria" || f.responsaveis.includes(m.id)).map((m) => {
                  const on = f.responsaveis.includes(m.id);
                  return <button key={m.id} onClick={() => setF({ ...f, responsaveis: on ? f.responsaveis.filter((x) => x !== m.id) : [...f.responsaveis, m.id] })}
                    className={`inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 text-[13px] ${on ? "border-azul bg-[#eef5ff] font-semibold" : "border-linha bg-white text-suave"}`}><Avatar m={m} tam={22} />{m.nome.split(" ")[0]}</button>;
                })}
              </div>
            </div>
            <Rot t="Observações" span><textarea rows={3} value={f.observacoes ?? ""} onChange={(e) => setF({ ...f, observacoes: e.target.value })} className={inp} /></Rot>
          </div>
          {ok && <p className="mt-3 text-[13px] font-semibold text-ok">{ok}</p>}
          {erro && <p role="alert" className="mt-3 rounded-xl bg-erro-claro px-3 py-2 text-[13px] text-erro">{erro}</p>}
        </Caixa>

        <Caixa titulo="Cronograma" icone={CalendarClock} extra={<button onClick={() => irPara("cronograma")} className="text-[13px] font-semibold text-azul">Editar</button>}>
          <ol className="space-y-1.5">
            {d.etapas.map((e) => { const s = situacaoEtapa(e, hoje); return (
              <li key={e.id} className="flex items-center gap-3 text-[13.5px]">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.cor }} />
                <span className={`flex-1 truncate ${e.fim_real ? "text-suave line-through" : ""}`}>{e.nome}</span>
                <span className="text-[12px] text-suave">{e.fim_prev ? `até ${dataBr(e.fim_prev)}` : "sem data"}</span>
                <span className="w-24 text-right text-[12px] font-semibold" style={{ color: s.cor }}>{s.rot}</span>
              </li>); })}
          </ol>
        </Caixa>
      </div>

      <div className="space-y-4 lg:space-y-5">
        <Caixa titulo="Entrega e garantia" icone={ShieldCheck}>
          {o.entregue_em ? (
            <div className="space-y-2 text-[13.5px]">
              <p className="flex items-center gap-2 font-semibold text-ok"><CheckCircle2 className="size-4" />Entregue em {dataBr(o.entregue_em)}</p>
              <p>Garantia da instalação até <b>{dataBr(garantiaAte)}</b>{garantiaAte && garantiaAte < hoje ? <span className="ml-1 text-erro">(vencida)</span> : ""}.</p>
              <p className="text-[12.5px] text-suave">Chamados novos deste cliente já nascem marcados “Em garantia” até essa data.</p>
              {o.termo_path && <button onClick={async () => window.open(await urlArquivo(o.termo_path!), "_blank")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-azul"><FileSignature className="size-4" />Ver termo assinado</button>}
            </div>
          ) : (
            <div className="space-y-3 text-[13.5px]">
              <p className="text-suave">Na entrega: gere o termo, colha a assinatura do cliente e anexe o PDF. A obra passa para <b>Entregue</b> e a garantia começa a contar.</p>
              <button onClick={baixarTermo} disabled={!!ocupado} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-linha bg-white py-2.5 font-semibold hover:border-azul disabled:opacity-50"><FileDown className="size-4" />{ocupado === "termo" ? "Gerando…" : "Gerar termo de entrega (PDF)"}</button>
              <div className="flex items-end gap-2">
                <label className="flex-1"><span className="mb-1 block text-[12px] font-semibold text-suave">Data da entrega</span><input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} className={inp} /></label>
                <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-azul px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-azul-escuro ${ocupado ? "pointer-events-none opacity-50" : ""}`}>
                  <Upload className="size-4" />{ocupado === "anexo" ? "Enviando…" : "Anexar termo assinado"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => anexarTermo(e.target.files?.[0], dataEntrega)} />
                </label>
              </div>
              {docsOk < docs.length && <p className="flex items-start gap-1.5 rounded-xl bg-atencao-claro px-3 py-2 text-[12.5px] text-atencao"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Ainda há {docs.length - docsOk} cartão(ões) da documentação sem aprovação.</p>}
            </div>
          )}
        </Caixa>

        {verValores && (
          <Caixa titulo="Custo de material" icone={Link2}>
            <dl className="space-y-1.5 text-[13.5px]">
              <div className="flex justify-between"><dt className="text-suave">Previsto (orçamento)</dt><dd className="num font-semibold">{reais(custoPrev)}</dd></div>
              <div className="flex justify-between"><dt className="text-suave">Já saiu para a obra</dt><dd className="num font-semibold">{reais(custoReal)}</dd></div>
              {o.valor_contrato != null && <div className="flex justify-between border-t border-linha pt-1.5"><dt className="text-suave">Valor do contrato</dt><dd className="num font-semibold">{reais(o.valor_contrato)}</dd></div>}
            </dl>
            <div className="mt-3 flex flex-wrap gap-3 text-[13px] font-semibold">
              {o.oportunidade_id && <Link href={`/crm/?aba=negocios&n=${o.oportunidade_id}`} className="inline-flex items-center gap-1 text-azul"><ExternalLink className="size-3.5" />Negócio no CRM</Link>}
              {o.contrato_id && <Link href={`/contratos/?c=${o.contrato_id}`} className="inline-flex items-center gap-1 text-azul"><ExternalLink className="size-3.5" />Contrato</Link>}
              {o.cliente_id && <Link href={`/clientes/ficha/?id=${o.cliente_id}`} className="inline-flex items-center gap-1 text-azul"><ExternalLink className="size-3.5" />Ficha do cliente</Link>}
            </div>
          </Caixa>
        )}

        <Caixa titulo="Visitas e chamados do cliente" icone={Headset}>
          <ul className="divide-y divide-linha text-[13px]">
            {atend.slice(0, 8).map((c) => (
              <li key={c.id}><Link href={c.modulo === "chamados" ? `/tecnico/chamados/?c=${c.id}` : `/tecnico/agendamentos/?c=${c.id}`} className="flex items-center gap-2 py-2 hover:text-azul">
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${c.modulo === "chamados" ? "bg-[#fff2e6] text-atencao" : "bg-[#e8f1fd] text-azul"}`}>{c.modulo === "chamados" ? "Chamado" : "Visita"}</span>
                <span className="flex-1 truncate">{c.titulo}</span>
                <span className="text-[12px] text-suave">{c.concluido_em ? "concluído" : c.agenda_inicio ? dataBr(c.agenda_inicio) : ""}</span>
              </Link></li>
            ))}
            {!atend.length && <li className="py-3 text-suave">Nenhuma visita ou chamado ainda.</li>}
          </ul>
          {o.cliente_id && <div className="mt-2 flex gap-3 text-[13px] font-semibold"><Link href="/tecnico/agendamentos/" className="text-azul">Agendar visita</Link><Link href="/tecnico/chamados/" className="text-azul">Abrir chamado</Link></div>}
        </Caixa>
      </div>
    </div>
  );
}

function Rot({ t, span, children }: { t: string; span?: boolean; children: React.ReactNode }) {
  return <label className={`block ${span ? "md:col-span-2" : ""}`}><span className="mb-1 block text-[12px] font-semibold text-suave">{t}</span>{children}</label>;
}
function Indicador({ rot, valor, det, alerta, onClick }: { rot: string; valor: string; det: string; alerta?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="sombra-bra rounded-[18px] border border-linha bg-white px-4 py-3 text-left transition hover:border-azul">
      <div className="text-[12px] font-semibold text-suave">{rot}</div>
      <div className="num font-display text-[24px] font-extrabold leading-tight">{valor}</div>
      <div className="truncate text-[12px] text-suave">{det}</div>
      {alerta && <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-erro-claro px-2 py-0.5 text-[11.5px] font-bold text-erro"><AlertTriangle className="size-3" />{alerta}</div>}
    </button>
  );
}
