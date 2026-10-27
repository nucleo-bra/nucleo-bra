"use client";
// Negócios no formato do Zenith Gestor 360: quadro por etapa, cartões numerados
// e a ficha do negócio com dados do cliente, pagamento combinado e a pasta.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, Check, CheckCircle2, ClipboardList, Download, FileSignature, FileText, FolderOpen, List, MessageCircle,
  Pencil, Plus, Search, Trophy, Upload, Wallet, LayoutGrid, Clock, DollarSign, Files, ExternalLink,
} from "lucide-react";
import {
  Atividade, ClienteCrm, Crm, enderecoCompleto, ETAPAS_NEGOCIO, EtapaNegocio, hoje, Negocio, Pagamento, rotulo, salvarCliente, salvarNegocio,
} from "@/lib/crm";
import { abrirPasta, linkDocumento, Pasta, subirNaPasta } from "@/lib/pasta";
import { mensagemErro } from "@/lib/supabase";
import { condicoesPagamento, formatarDocumento, STATUS, StatusContrato } from "@/lib/contratos";
import type { Acoes } from "./visoes";
import { COR_ETAPA, corEtapaChip } from "./visoes";
import { Botao, Cartao, Chip, campo, curto, dataBr, reais, Rotulo, Titulo } from "./ui";

const iniciais = (nome: string) => nome.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "ME";
const etapaDe = (e: string): EtapaNegocio => (e === "qualificacao" ? "lead" : (e as EtapaNegocio));
export const tituloNegocio = (n: Negocio) => {
  const proj = n.titulo && n.titulo !== n.cliente_nome ? n.titulo : "";
  return [n.cliente_nome || n.titulo, proj].filter(Boolean).join(" | ");
};
const whatsapp = (tel: string) => { const d = (tel || "").replace(/\D/g, ""); return d ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : ""; };

function ultimoAtendimento(crm: Crm, id: string): Atividade | null {
  const agora = hoje();
  return crm.atividades.filter((a) => a.oportunidade_id === id && (a.concluida || a.data <= agora))
    .sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora))[0] ?? null;
}
function pendente(crm: Crm, n: Negocio) {
  if (["ganho", "perdido"].includes(n.etapa)) return null;
  const atrasada = crm.atividades.find((a) => a.oportunidade_id === n.id && !a.concluida && a.data < hoje());
  if (atrasada) return `Atrasado: ${atrasada.titulo}`;
  const u = ultimoAtendimento(crm, n.id);
  const dias = u ? (Date.now() - new Date(u.data + "T12:00:00").getTime()) / 86_400_000 : Infinity;
  if (dias > 15) return u ? `Sem atendimento há ${Math.floor(dias)} dias` : "Sem atendimento";
  return null;
}

// ================================================================== cartão
function CartaoNegocio({ crm, ac, n, onArrastar }: { crm: Crm; ac: Acoes; n: Negocio; onArrastar: (id: string | null) => void }) {
  const parceiro = crm.parceiros.find((p) => p.id === n.parceiro_id);
  const cliente = crm.clientes.find((c) => c.id === n.cliente_id);
  const ult = ultimoAtendimento(crm, n.id);
  const alerta = pendente(crm, n);
  const ganho = n.etapa === "ganho";
  return (
    <div draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", n.id); onArrastar(n.id); }} onDragEnd={() => onArrastar(null)}
      className="group relative flex overflow-hidden rounded-xl border border-linha bg-white shadow-[0_1px_2px_rgba(9,30,66,.08)] transition hover:shadow-[0_6px_18px_-6px_rgba(9,30,66,.3)]">
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 bg-fundo/80 py-2.5 text-suave">
        <button onClick={() => ac.negocio(n)} title="Editar rápido" className="rounded-md p-1 hover:bg-white hover:text-azul"><Pencil className="size-3.5" /></button>
        <button onClick={() => ac.ficha(n.id)} title="Abrir pasta do cliente" className="rounded-md p-1 hover:bg-white hover:text-azul"><FileText className="size-3.5" /></button>
      </div>
      <button onClick={() => ac.ficha(n.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
        <div className="truncate text-[14.5px] leading-snug text-tinta">{n.numero ? `${n.numero} - ` : ""}{tituloNegocio(n)}</div>
        {parceiro && <div className="truncate text-[11.5px] text-suave">{parceiro.nome}</div>}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span title={ac.usuario || "Responsável"} className="grid size-6 place-items-center rounded-full bg-[#5b9bd5] text-[10px] font-bold text-white">{iniciais(ac.usuario)}</span>
          <span title={parceiro ? `Parceiro: ${parceiro.nome}` : "Sem parceiro"} className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${parceiro ? "bg-[#5b9bd5] text-white" : "bg-fundo text-suave"}`}>{parceiro ? "+1" : "0"}</span>
          <span title={alerta ?? "Em dia"} className={`grid size-6 place-items-center rounded-full ${alerta ? "bg-atencao text-white" : "bg-fundo text-[#c3cad8]"}`}><AlertCircle className="size-3.5" /></span>
          <span title={ganho ? "Fechado" : "Ainda não fechado"} className={ganho ? "text-ok" : "text-[#cfd5e1]"}><Trophy className="size-[18px]" /></span>
        </div>
        <div className="hidden pt-2 text-[12px] leading-5 text-suave group-hover:block">
          <div className="flex items-center gap-1.5"><Clock className="size-3" />{dataBr(n.data_ref)}{n.etapa === "ganho" ? " · fechado" : " · previsão"}</div>
          <div className="flex items-center gap-1.5"><MessageCircle className="size-3" />{ult ? `Último atendimento ${dataBr(ult.data)}` : "Sem atendimento"}</div>
          <div className="flex items-center gap-1.5"><DollarSign className="size-3" /><b className="num text-tinta">{reais(n.valor_estimado)}</b></div>
          {n.proxima_acao && <div className="truncate">→ {n.proxima_acao}</div>}
          {n.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{n.tags.map((t) => <span key={t} className="rounded bg-[#e3eefa] px-1.5 text-[11px] font-semibold text-azul">{t}</span>)}</div>}
        </div>
      </button>
      <div className="absolute right-2 bottom-2 hidden gap-1 group-hover:flex">
        {cliente?.telefone && <a href={whatsapp(cliente.telefone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="WhatsApp" className="rounded-md bg-white p-1 text-ok shadow hover:bg-ok-claro"><MessageCircle className="size-4" /></a>}
        {!ganho && n.etapa !== "perdido" && <button onClick={(e) => { e.stopPropagation(); ac.moverNegocio(n.id, "ganho"); }} title="Marcar como cliente fechado" className="rounded-md bg-white p-1 text-ok shadow hover:bg-ok-claro"><CheckCircle2 className="size-4" /></button>}
      </div>
    </div>
  );
}

// ================================================================== quadro
export function QuadroNegocios({ crm, ac }: { crm: Crm; ac: Acoes }) {
  const [busca, setBusca] = useState("");
  const [parceiro, setParceiro] = useState("");
  const [ordem, setOrdem] = useState<"recentes" | "valor" | "numero" | "nome">("recentes");
  const [lista, setLista] = useState(false);
  const [concluidos, setConcluidos] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const q = busca.trim().toLowerCase();
  const L = useMemo(() => crm.negocios.filter((n) =>
    (!q || `${n.numero ?? ""} ${n.cliente_nome} ${n.titulo} ${crm.parceiros.find((p) => p.id === n.parceiro_id)?.nome ?? ""}`.toLowerCase().includes(q)) &&
    (!parceiro || n.parceiro_id === parceiro),
  ).sort((a, b) => ordem === "valor" ? b.valor_estimado - a.valor_estimado : ordem === "numero" ? (b.numero ?? 0) - (a.numero ?? 0)
    : ordem === "nome" ? tituloNegocio(a).localeCompare(tituloNegocio(b)) : (b.created_at || b.data_ref).localeCompare(a.created_at || a.data_ref)), [crm, q, parceiro, ordem]);
  const colunas = ETAPAS_NEGOCIO.filter(([k]) => concluidos || k !== "perdido");
  const btn = (ativo: boolean) => `inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13.5px] font-semibold transition ${ativo ? "border-[#5ab6c2] bg-[#5ab6c2] text-white" : "border-[#5ab6c2] bg-white text-[#3a9aa6] hover:bg-[#eaf6f7]"}`;

  return (
    <div className="rounded-[18px] border border-linha bg-white/80 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => ac.negocio()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#5ab6c2] px-3.5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#4aa5b1]"><Plus className="size-4" />Novo negócio</button>
        <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute top-2.5 left-3 size-4 text-suave" />
          <input className={campo + " pl-9"} placeholder="Buscar negócio (nº, cliente, projeto, parceiro)" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <select value={parceiro} onChange={(e) => setParceiro(e.target.value)} className="rounded-lg border border-linha bg-white px-3 py-2 text-[13.5px]" aria-label="Filtrar por parceiro">
          <option value="">Todos os parceiros</option>
          {crm.parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className="rounded-lg border border-linha bg-white px-3 py-2 text-[13.5px]" aria-label="Ordenar">
          <option value="recentes">Mais recentes</option><option value="numero">Nº do negócio</option><option value="valor">Maior valor</option><option value="nome">Nome</option>
        </select>
        <button className={btn(lista)} onClick={() => setLista(!lista)}>{lista ? <LayoutGrid className="size-4" /> : <List className="size-4" />}{lista ? "Modo quadro" : "Modo lista"}</button>
        <button className={btn(concluidos)} onClick={() => setConcluidos(!concluidos)}><CheckCircle2 className="size-4" />Concluídos</button>
      </div>

      {lista ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="text-left text-[12px] text-suave"><tr className="border-b border-linha">{["Nº", "Negócio", "Parceiro", "Etapa", "Previsão", "Último atendimento", "Valor"].map((x) => <th key={x} className="px-2 py-2 font-semibold whitespace-nowrap">{x}</th>)}</tr></thead>
            <tbody>
              {L.filter((n) => concluidos || n.etapa !== "perdido").map((n) => {
                const u = ultimoAtendimento(crm, n.id);
                return (
                  <tr key={n.id} onClick={() => ac.ficha(n.id)} className="cursor-pointer border-b border-linha last:border-0 hover:bg-fundo/60">
                    <td className="num px-2 py-2 font-semibold">{n.numero ?? "—"}</td>
                    <td className="px-2 py-2 font-semibold">{tituloNegocio(n)}</td>
                    <td className="px-2 py-2 text-suave">{crm.parceiros.find((p) => p.id === n.parceiro_id)?.nome ?? "—"}</td>
                    <td className="px-2 py-2"><Chip cor={corEtapaChip[etapaDe(n.etapa)]}>{rotulo(ETAPAS_NEGOCIO, etapaDe(n.etapa))}</Chip></td>
                    <td className="num px-2 py-2">{dataBr(n.data_ref)}</td>
                    <td className="num px-2 py-2 text-suave">{u ? dataBr(u.data) : "Sem atendimento"}</td>
                    <td className="num px-2 py-2 text-right font-bold">{reais(n.valor_estimado)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {colunas.map(([k, rot]) => {
            const C = L.filter((n) => etapaDe(n.etapa) === k);
            const tot = C.reduce((s, n) => s + n.valor_estimado, 0);
            return (
              <section key={k}
                onDragOver={(e) => { e.preventDefault(); setSobre(k); }} onDragLeave={() => setSobre((v) => (v === k ? null : v))}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || arrastando; if (id) ac.moverNegocio(id, k); setArrastando(null); setSobre(null); }}
                className={`flex min-w-[250px] flex-1 flex-col overflow-hidden rounded-xl border bg-[#f6f7fa] transition ${sobre === k ? "border-azul ring-2 ring-azul/20" : "border-linha"}`}>
                <div className="h-2" style={{ background: COR_ETAPA[k] }} />
                <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <h3 className="text-[16px] font-bold text-tinta">{rot}</h3>
                  <span className="num rounded-md bg-[#d8dde6] px-2 py-0.5 text-[12.5px] font-bold text-white">{curto(tot).replace(" mil", " mil")}</span>
                  <span className="ml-auto text-[12px] text-suave">{C.length}</span>
                </header>
                <div className="flex max-h-[68vh] min-h-[120px] flex-col gap-2.5 overflow-y-auto px-2.5 pb-3">
                  {C.map((n) => <CartaoNegocio key={n.id} crm={crm} ac={ac} n={n} onArrastar={setArrastando} />)}
                  {!C.length && <p className="rounded-lg border border-dashed border-linha px-2 py-6 text-center text-[12.5px] text-suave">Arraste um negócio para cá</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================== ficha do negócio
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

export function FichaNegocio({ crm, ac, id, onSalvo }: { crm: Crm; ac: Acoes; id: string; onSalvo: () => void }) {
  const original = crm.negocios.find((n) => n.id === id);
  const [n, setN] = useState<Negocio | null>(original ?? null);
  const [c, setC] = useState<Partial<ClienteCrm>>(() => crm.clientes.find((k) => k.id === original?.cliente_id) ?? { nome: original?.cliente_nome ?? "" });
  const [pasta, setPasta] = useState<Pasta | null>(null);
  const [erro, setErro] = useState(""), [aviso, setAviso] = useState(""), [ocupado, setOcupado] = useState("");
  const [arrastandoArq, setArrastandoArq] = useState(false);
  const arq = useRef<HTMLInputElement>(null);

  const recarregarPasta = useCallback(() => abrirPasta(id).then(setPasta).catch((e) => setErro(mensagemErro(e))), [id]);
  useEffect(() => { recarregarPasta(); }, [recarregarPasta]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 4500); return () => clearTimeout(t); }, [aviso]);

  if (!n) return <p className="text-suave">Negócio não encontrado. <button className="font-semibold text-azul" onClick={() => ac.aba("negocios")}>Voltar</button></p>;
  const pg: Pagamento = n.pagamento ?? {};
  const setPg = (k: keyof Pagamento, v: string | number) => setN({ ...n, pagamento: { ...pg, [k]: v } });
  const sN = (k: keyof Negocio) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setN({ ...n, [k]: ev.target.type === "number" ? Number(ev.target.value) : ev.target.value });
  const sC = (k: keyof ClienteCrm) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setC({ ...c, [k]: ev.target.value });
  const parceiro = crm.parceiros.find((p) => p.id === n.parceiro_id);
  const atividades = crm.atividades.filter((a) => a.oportunidade_id === id).sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora));
  const orc = pasta?.orcamentos.find((o) => o.status !== "substituida") ?? pasta?.orcamentos[0];
  const contrato = pasta?.contratos[0];
  const prevPg = Number(n.valor_estimado) > 0 && (Number(pg.entrada) > 0 || Number(pg.parcelas) > 0)
    ? condicoesPagamento({ valor: n.valor_estimado, entrada: Number(pg.entrada) || 0, entrada_vencimento: pg.entrada_vencimento || hoje(), parcelas: Number(pg.parcelas) || 0, primeiro_vencimento: pg.primeiro_vencimento || null, data_contrato: hoje() })
    : [];

  async function agir(rot: string, f: () => Promise<void>) {
    setErro(""); setOcupado(rot);
    try { await f(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(""); }
  }
  const salvar = () => agir("salvar", async () => {
    let clienteId = n.cliente_id;
    const temDados = c.documento || c.email || c.telefone || c.logradouro || c.data_nascimento || c.cep;
    if (c.nome?.trim() && (clienteId || temDados)) {
      const cli = await salvarCliente(crm, { ...c, id: clienteId ?? c.id });
      clienteId = cli.id; setC(cli);
    }
    const novo = await salvarNegocio(crm, { ...n, cliente_id: clienteId, cliente_nome: n.cliente_nome || c.nome || "" });
    crm.negocios = crm.negocios.map((x) => (x.id === novo.id ? novo : x));
    setN(novo); onSalvo(); setAviso("Cartão salvo.");
  });
  async function buscarCep() {
    const cep = (c.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((x) => x.json());
      if (!r.erro) setC((v) => ({ ...v, logradouro: r.logradouro || v.logradouro, bairro: r.bairro || v.bairro, cidade: r.localidade || v.cidade, uf: r.uf || v.uf }));
    } catch { /* sem internet para o CEP: preenche à mão */ }
  }
  const subir = (fs: FileList | File[]) => agir("subir", async () => {
    for (const f of Array.from(fs)) {
      const r = await subirNaPasta({ id: n.id, cliente_id: n.cliente_id }, f);
      if (r.tipo === "orcamento") {
        const novo = { ...n, valor_estimado: r.total, cliente_id: n.cliente_id ?? r.cliente_id };
        setN(novo); crm.negocios = crm.negocios.map((x) => (x.id === novo.id ? novo : x)); onSalvo();
        setAviso(`Orçamento nº ${r.numero}${r.versao ? " " + r.versao : ""} lido: ${reais(r.total)}. Valor do negócio atualizado.`);
      } else setAviso(`"${f.name}" salvo na pasta.`);
    }
    await recarregarPasta();
  });
  const abrirArquivo = (caminho: string, nome?: string) => agir("abrir", async () => { window.open(await linkDocumento(caminho, nome), "_blank"); });

  return (
    <div>
      <button onClick={() => ac.aba("negocios")} className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-suave hover:text-azul"><ArrowLeft className="size-4" />Negócios</button>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[22px] font-extrabold tracking-tight lg:text-[26px]">{n.numero ? `${n.numero} - ` : ""}{tituloNegocio(n)}</h2>
          <p className="text-[14px] text-suave"><span className="num font-bold text-tinta">{reais(n.valor_estimado)}</span>{parceiro ? ` · parceiro ${parceiro.nome}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.telefone && <a href={whatsapp(c.telefone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13.5px] font-semibold text-ok hover:shadow-md"><MessageCircle className="size-4" />WhatsApp</a>}
          <Botao onClick={() => ac.atividade({ oportunidade_id: n.id, tipo: "reuniao", titulo: tituloNegocio(n) })}><ClipboardList className="size-4" />Registrar atendimento</Botao>
          <Link href={`/contratos/?novo=${n.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-3.5 py-2 text-[13.5px] font-semibold text-white hover:shadow-lg"><FileSignature className="size-4" />Seguir com contrato</Link>
        </div>
      </div>

      {/* etapas */}
      <div className="mb-4 flex overflow-x-auto rounded-xl border border-linha bg-white">
        {ETAPAS_NEGOCIO.map(([k, rot]) => {
          const at = etapaDe(n.etapa) === k;
          return (
            <button key={k} onClick={() => { setN({ ...n, etapa: k }); ac.moverNegocio(n.id, k); }}
              className={`relative min-w-[120px] flex-1 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition ${at ? "text-tinta" : "text-suave hover:bg-fundo"}`}>
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: at ? COR_ETAPA[k] : "transparent" }} />{rot}
            </button>
          );
        })}
      </div>

      {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-[14px] text-erro">{erro}</p>}
      {aviso && <p className="mb-4 rounded-xl bg-ok-claro px-4 py-3 text-[14px] text-ok">{aviso}</p>}

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <Cartao>
            <Titulo extra={<Botao tipo="pri" disabled={!!ocupado} onClick={salvar}><Check className="size-4" />{ocupado === "salvar" ? "Salvando…" : "Salvar cartão"}</Botao>}>Negócio</Titulo>
            <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
              <Rotulo rotulo="Cliente" className="col-span-2"><input className={campo} value={n.cliente_nome} onChange={(e) => { setN({ ...n, cliente_nome: e.target.value }); if (!n.cliente_id) setC({ ...c, nome: e.target.value }); }} /></Rotulo>
              <Rotulo rotulo="Projeto / unidade" className="col-span-2"><input className={campo} value={n.titulo} onChange={sN("titulo")} placeholder="Ex.: Quinta da Baronesa" /></Rotulo>
              <Rotulo rotulo="Parceiro" className="col-span-2">
                <select className={campo} value={n.parceiro_id ?? ""} onChange={(e) => { const p = crm.parceiros.find((k) => k.id === e.target.value); setN({ ...n, parceiro_id: e.target.value || null, pct_parceiro: p && !n.pct_parceiro ? p.comissao_padrao : n.pct_parceiro }); }}>
                  <option value="">— sem parceiro —</option>{crm.parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </Rotulo>
              <Rotulo rotulo="Valor (R$)"><input className={campo} type="number" step="any" min={0} value={n.valor_estimado} onChange={sN("valor_estimado")} /></Rotulo>
              <Rotulo rotulo={n.etapa === "ganho" ? "Data do fechamento" : "Previsão de fechamento"}><input className={campo} type="date" value={n.data_ref} onChange={sN("data_ref")} /></Rotulo>
              <Rotulo rotulo={`% parceiro · ${reais((n.valor_estimado * (n.pct_parceiro || 0)) / 100)}`}><input className={campo} type="number" step="any" value={n.pct_parceiro} onChange={sN("pct_parceiro")} /></Rotulo>
              <Rotulo rotulo={`% vendedor · ${reais((n.valor_estimado * (n.pct_vendedor || 0)) / 100)}`}><input className={campo} type="number" step="any" value={n.pct_vendedor} onChange={sN("pct_vendedor")} /></Rotulo>
              <Rotulo rotulo="Tags (separe por vírgula)" className="col-span-2"><input className={campo} value={n.tags.join(", ")} onChange={(e) => setN({ ...n, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="alto padrão, Plaenge…" /></Rotulo>
              <Rotulo rotulo="Próximo passo" className="col-span-2 sm:col-span-4"><input className={campo} value={n.proxima_acao} onChange={sN("proxima_acao")} /></Rotulo>
              <Rotulo rotulo="Observações" className="col-span-2 sm:col-span-4"><textarea className={campo} rows={2} value={n.observacoes} onChange={sN("observacoes")} /></Rotulo>
              {n.etapa === "perdido" && <Rotulo rotulo="Motivo da perda" className="col-span-2 sm:col-span-4"><input className={campo} value={n.motivo_perda} onChange={sN("motivo_perda")} /></Rotulo>}
            </div>
          </Cartao>

          <Cartao>
            <Titulo>Dados do cliente (vão para o contrato)</Titulo>
            <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
              <Rotulo rotulo="Nome completo / razão social" className="col-span-2"><input className={campo} value={c.nome ?? ""} onChange={sC("nome")} /></Rotulo>
              <Rotulo rotulo="CPF / CNPJ"><input className={campo} inputMode="numeric" value={formatarDocumento(c.documento ?? "")} onChange={(e) => setC({ ...c, documento: e.target.value.replace(/\D/g, "").slice(0, 14) })} /></Rotulo>
              <Rotulo rotulo="Data de nascimento"><input className={campo} type="date" value={c.data_nascimento ?? ""} onChange={sC("data_nascimento")} /></Rotulo>
              <Rotulo rotulo="E-mail" className="col-span-2"><input className={campo} type="email" value={c.email ?? ""} onChange={sC("email")} /></Rotulo>
              <Rotulo rotulo="Telefone / WhatsApp" className="col-span-2"><input className={campo} value={c.telefone ?? ""} onChange={sC("telefone")} placeholder="(19) 99999-9999" /></Rotulo>
              <Rotulo rotulo="CEP"><input className={campo} inputMode="numeric" value={c.cep ?? ""} onChange={sC("cep")} onBlur={buscarCep} placeholder="13140-000" /></Rotulo>
              <Rotulo rotulo="Rua / avenida" className="col-span-1 sm:col-span-2"><input className={campo} value={c.logradouro ?? ""} onChange={sC("logradouro")} /></Rotulo>
              <Rotulo rotulo="Número"><input className={campo} value={c.numero ?? ""} onChange={sC("numero")} /></Rotulo>
              <Rotulo rotulo="Complemento"><input className={campo} value={c.complemento ?? ""} onChange={sC("complemento")} /></Rotulo>
              <Rotulo rotulo="Bairro"><input className={campo} value={c.bairro ?? ""} onChange={sC("bairro")} /></Rotulo>
              <Rotulo rotulo="Cidade"><input className={campo} value={c.cidade ?? ""} onChange={sC("cidade")} /></Rotulo>
              <Rotulo rotulo="UF"><select className={campo} value={c.uf ?? ""} onChange={sC("uf")}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Rotulo>
              {enderecoCompleto(c) && <p className="col-span-2 text-[12px] text-suave sm:col-span-4">No contrato: <b className="text-tinta">{enderecoCompleto(c)}</b></p>}
            </div>
          </Cartao>

          <Cartao>
            <Titulo>Pagamento combinado</Titulo>
            <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-4">
              <Rotulo rotulo="Entrada (R$)"><input className={campo} type="number" step="any" min={0} value={pg.entrada ?? 0} onChange={(e) => setPg("entrada", Number(e.target.value))} /></Rotulo>
              <Rotulo rotulo="Vencimento da entrada"><input className={campo} type="date" value={pg.entrada_vencimento ?? ""} onChange={(e) => setPg("entrada_vencimento", e.target.value)} /></Rotulo>
              <Rotulo rotulo="Nº de parcelas"><input className={campo} type="number" min={0} max={120} value={pg.parcelas ?? 0} onChange={(e) => setPg("parcelas", Number(e.target.value))} /></Rotulo>
              <Rotulo rotulo="1ª parcela em"><input className={campo} type="date" value={pg.primeiro_vencimento ?? ""} onChange={(e) => setPg("primeiro_vencimento", e.target.value)} /></Rotulo>
              <Rotulo rotulo="Forma de recebimento (vazio = padrão das Configurações)" className="col-span-2 sm:col-span-4"><input className={campo} value={pg.forma_recebimento ?? ""} onChange={(e) => setPg("forma_recebimento", e.target.value)} /></Rotulo>
              {prevPg.length > 0 && (
                <div className="col-span-2 overflow-hidden rounded-xl border border-linha text-[13px] sm:col-span-4">
                  <table className="w-full"><tbody>{prevPg.map((l, i) => <tr key={i} className="border-t border-linha first:border-0"><td className="px-3 py-1.5">{l.condicao}</td><td className="num px-3 py-1.5 font-semibold">{l.valor}</td><td className="px-3 py-1.5 text-suave">{l.vencimento}</td></tr>)}</tbody></table>
                </div>
              )}
            </div>
          </Cartao>
        </div>

        <div className="space-y-4">
          <Cartao>
            <Titulo>Pasta do cliente</Titulo>
            <div className="space-y-3 px-5 pb-5 text-[13.5px]">
              <input ref={arq} type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) subir(e.target.files); e.target.value = ""; }} />
              <button onClick={() => arq.current?.click()} disabled={!!ocupado}
                onDragOver={(e) => { e.preventDefault(); setArrastandoArq(true); }} onDragLeave={() => setArrastandoArq(false)}
                onDrop={(e) => { e.preventDefault(); setArrastandoArq(false); if (e.dataTransfer.files.length) subir(e.dataTransfer.files); }}
                className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-3 py-5 text-center transition ${arrastandoArq ? "border-azul bg-[#eef3fb]" : "border-linha hover:border-azul"}`}>
                <Upload className="size-5 text-azul" />
                <span className="font-semibold">{ocupado === "subir" ? "Lendo e salvando…" : "Subir orçamento ou arquivos"}</span>
                <span className="text-[12px] text-suave">O PDF do orçamento do Zenith é lido sozinho (itens, sistemas e total)</span>
              </button>

              {orc && (
                <div className="rounded-xl border border-linha p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-azul" />
                    <b>Orçamento nº {orc.numero}{orc.versao ? ` · ${orc.versao}` : ""}</b>
                    <span className="ml-auto num font-bold">{reais(orc.total_final)}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-suave">{orc.projeto ?? orc.titulo} · emitido em {dataBr(orc.data_emissao)}{orc.condicoes_pagamento ? ` · pagamento: ${orc.condicoes_pagamento}` : ""}</div>
                  <ul className="mt-2 space-y-0.5 text-[12.5px]">
                    {orc.sistemas.map((s) => <li key={s.nome} className="flex justify-between"><span>{s.nome}</span><span className="num">{reais(s.total)}</span></li>)}
                  </ul>
                  {orc.total_itens > orc.total_final && <p className="mt-1 text-[12px] text-ok">Desconto de {reais(orc.total_itens - orc.total_final)}</p>}
                  {(pasta?.orcamentos.length ?? 0) > 1 && <p className="mt-1 text-[12px] text-suave">{pasta!.orcamentos.length - 1} versão(ões) anterior(es) guardada(s)</p>}
                </div>
              )}

              {pasta?.contratos.map((k) => (
                <div key={k.id} className="rounded-xl border border-linha p-3">
                  <div className="flex items-center gap-2"><FileSignature className="size-4 text-azul" /><b>Contrato {k.numero}</b>
                    <Chip cor={STATUS[k.status as StatusContrato]?.cor}>{STATUS[k.status as StatusContrato]?.rot ?? k.status}</Chip>
                    <Link href={`/contratos/?c=${k.id}`} className="ml-auto text-azul" title="Abrir contrato"><ExternalLink className="size-4" /></Link></div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[12.5px]">
                    {k.arquivo_path && <button className="inline-flex items-center gap-1 font-semibold text-azul hover:underline" onClick={() => abrirArquivo(k.arquivo_path!, k.arquivo_nome ?? undefined)}><Download className="size-3.5" />Contrato</button>}
                    {k.assinado_path && <button className="inline-flex items-center gap-1 font-semibold text-ok hover:underline" onClick={() => abrirArquivo(k.assinado_path!)}><Download className="size-3.5" />PDF assinado</button>}
                  </div>
                </div>
              ))}

              {(pasta?.arquivos.length ?? 0) > 0 && (
                <ul className="divide-y divide-linha rounded-xl border border-linha">
                  {pasta!.arquivos.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-2">
                      <Files className="size-4 shrink-0 text-suave" />
                      <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                      <span className="text-[11.5px] text-suave">{dataBr(a.created_at)}</span>
                      {a.storage_path && <button aria-label="Baixar" onClick={() => abrirArquivo(a.storage_path!, a.nome)} className="rounded p-1 text-azul hover:bg-fundo"><Download className="size-4" /></button>}
                    </li>
                  ))}
                </ul>
              )}
              {pasta && !pasta.arquivos.length && !pasta.orcamentos.length && !pasta.contratos.length && <p className="flex items-center gap-2 text-[12.5px] text-suave"><FolderOpen className="size-4" />Pasta vazia.</p>}
            </div>
          </Cartao>

          <Cartao>
            <Titulo>Próximo passo</Titulo>
            <div className="space-y-2 px-5 pb-5 text-[13.5px]">
              {!contrato ? (<>
                <p className="text-suave">{orc ? "Orçamento na pasta. Confira os dados do cliente e o pagamento combinado e siga com o contrato." : "Quando o cliente fechar, suba o orçamento na pasta e siga com o contrato."}</p>
                <Link href={`/contratos/?novo=${n.id}`} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-3.5 py-2 text-[13.5px] font-semibold text-white"><FileSignature className="size-4" />Seguir com contrato</Link>
              </>) : (
                <p>Contrato <b>{contrato.numero}</b>: {STATUS[contrato.status as StatusContrato]?.rot ?? contrato.status}. <Link href={`/contratos/?c=${contrato.id}`} className="font-semibold text-azul hover:underline">Abrir</Link></p>
              )}
              {n.etapa === "ganho" && !n.financeiro_lancado_em && !contrato && <Botao className="w-full" onClick={() => ac.lancar(n)}><Wallet className="size-4" />Lançar no Financeiro sem contrato</Botao>}
            </div>
          </Cartao>

          <Cartao>
            <Titulo extra={<Botao tipo="leve" onClick={() => ac.atividade({ oportunidade_id: n.id, tipo: "reuniao", titulo: tituloNegocio(n) })}><Plus className="size-4" />Novo</Botao>}>Atendimentos</Titulo>
            <ul className="space-y-2 px-5 pb-5 text-[13.5px]">
              {atividades.map((a) => (
                <li key={a.id}>
                  <button onClick={() => ac.atividade(a)} className="flex w-full items-start gap-2 text-left">
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${a.concluida ? "bg-ok" : a.data < hoje() ? "bg-erro" : "bg-azul"}`} />
                    <span className="min-w-0"><span className="block truncate font-semibold">{a.titulo}</span>
                      <span className="block text-[12px] text-suave">{dataBr(a.data)}{a.hora ? " · " + a.hora : ""}{a.notas ? " · " + a.notas : ""}</span></span>
                  </button>
                </li>
              ))}
              {!atividades.length && <li className="text-[12.5px] text-suave">Nenhum atendimento registrado.</li>}
            </ul>
          </Cartao>
        </div>
      </div>
    </div>
  );
}
