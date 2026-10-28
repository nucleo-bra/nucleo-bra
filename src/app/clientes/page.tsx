"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText, Handshake, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Search, Trophy, Wallet } from "lucide-react";
import { Shell } from "@/components/Shell";
import { FormCliente } from "@/components/clientes/form-cliente";
import { campo, reais } from "@/components/crm/ui";
import { corEtapaChip } from "@/components/crm/visoes";
import { ClienteCartao, enderecoLinha, listarCartoes } from "@/lib/clientes";
import { ETAPAS_NEGOCIO, EtapaNegocio, rotulo } from "@/lib/crm";
import { formatarDocumento } from "@/lib/contratos";
import { mensagemErro } from "@/lib/supabase";
import { pl, telefone } from "@/lib/texto";

const iniciais = (nome: string) => nome.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]/.test(p)).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const whatsapp = (tel: string) => { const d = tel.replace(/\D/g, ""); return d ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : ""; };
const faltaParaContrato = (c: ClienteCartao) => [!c.documento && "CPF/CNPJ", !c.email && "e-mail", !c.logradouro && "endereço"].filter(Boolean) as string[];
const TONS = ["#2f6fb5", "#12a150", "#f5821f", "#7c5cd6", "#0e8f9c", "#d6489b", "#19295a"];
const tom = (id: string) => TONS[[...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % TONS.length];

function CartaoCliente({ c, onEditar, onAbrir }: { c: ClienteCartao; onEditar: () => void; onAbrir: () => void }) {
  const falta = faltaParaContrato(c);
  const etapa = c.negocio_aberto?.etapa === "qualificacao" ? "lead" : (c.negocio_aberto?.etapa as EtapaNegocio | undefined);
  return (
    <div className="group relative flex overflow-hidden rounded-xl border border-linha bg-white shadow-[0_1px_2px_rgba(9,30,66,.08)] transition hover:shadow-[0_6px_18px_-6px_rgba(9,30,66,.3)]">
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 bg-fundo/80 py-2.5 text-suave">
        <button onClick={onEditar} title="Editar dados" className="rounded-md p-1 hover:bg-white hover:text-azul"><Pencil className="size-3.5" /></button>
        <button onClick={onAbrir} title="Abrir ficha" className="rounded-md p-1 hover:bg-white hover:text-azul"><FileText className="size-3.5" /></button>
      </div>
      <button onClick={onAbrir} className="min-w-0 flex-1 px-3 py-2.5 text-left">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: tom(c.id) }}>{iniciais(c.nome_fantasia || c.nome) || "?"}</span>
          <span className="min-w-0">
            <span className="block truncate text-[14.5px] leading-snug font-semibold text-tinta">{c.nome_fantasia || c.nome}</span>
            <span className="block truncate text-[12px] text-suave">{c.documento ? formatarDocumento(c.documento) : c.tipo === "PJ" ? "CNPJ não informado" : "CPF não informado"}{c.cidade ? ` · ${c.cidade}${c.uf ? "/" + c.uf : ""}` : ""}</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span title={`${pl(c.negocios, "negócio", "negócios")} no CRM`} className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-bold ${c.negocios ? "bg-[#5b9bd5] text-white" : "bg-fundo text-suave"}`}><Handshake className="size-3" />{c.negocios}</span>
          <span title={falta.length ? `Falta para o contrato: ${falta.join(", ")}` : "Dados completos para contrato"} className={`grid size-6 place-items-center rounded-full ${falta.length ? "bg-atencao text-white" : "bg-ok-claro text-ok"}`}><AlertCircle className="size-3.5" /></span>
          <span title={c.contratos ? pl(c.contratos, "contrato", "contratos") : "Sem contrato"} className={c.contratos ? "text-ok" : "text-[#cfd5e1]"}><Trophy className="size-[18px]" /></span>
          {etapa && <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${corEtapaChip[etapa] ?? "bg-fundo text-suave"}`}>{rotulo(ETAPAS_NEGOCIO, etapa)}</span>}
        </div>
        <div className="hidden space-y-0.5 pt-2 text-[12px] leading-5 text-suave group-hover:block [@media(hover:none)]:block">
          {c.email && <div className="flex items-center gap-1.5 truncate"><Mail className="size-3 shrink-0" />{c.email}</div>}
          {c.telefone && <div className="flex items-center gap-1.5"><Phone className="size-3" />{telefone(c.telefone)}</div>}
          {enderecoLinha(c) && <div className="flex items-start gap-1.5"><MapPin className="mt-1 size-3 shrink-0" /><span className="line-clamp-2">{enderecoLinha(c)}</span></div>}
          {c.negocio_aberto && <div className="flex items-center gap-1.5 truncate"><Handshake className="size-3 shrink-0" />{c.negocio_aberto.numero ? `${c.negocio_aberto.numero} - ` : ""}{c.negocio_aberto.titulo} · <b className="num text-tinta">{reais(c.negocio_aberto.valor)}</b></div>}
          {c.a_receber > 0 && <div className="flex items-center gap-1.5"><Wallet className="size-3" />A receber <b className="num text-tinta">{reais(c.a_receber)}</b></div>}
          {falta.length > 0 && <div className="text-atencao">Falta para contrato: {falta.join(", ")}</div>}
        </div>
      </button>
      {c.telefone && (
        <a href={whatsapp(c.telefone)} target="_blank" rel="noreferrer" title="WhatsApp" className="absolute right-2 bottom-2 hidden rounded-md bg-white p-1 text-ok shadow group-hover:block hover:bg-ok-claro [@media(hover:none)]:block"><MessageCircle className="size-4" /></a>
      )}
    </div>
  );
}

export default function Clientes() {
  const router = useRouter();
  const [lista, setLista] = useState<ClienteCartao[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<"" | "PF" | "PJ">("");
  const [filtro, setFiltro] = useState<"todos" | "aberto" | "incompleto">("todos");
  const [ordem, setOrdem] = useState<"nome" | "recentes" | "receber">("nome");
  const [editar, setEditar] = useState<Partial<ClienteCartao> | null>(null);
  const carregar = () => listarCartoes().then(setLista).catch((e) => setErro(mensagemErro(e)));
  useEffect(() => { carregar(); }, []);

  const q = busca.trim().toLowerCase(), qd = busca.replace(/\D/g, "");
  const L = useMemo(() => (lista ?? []).filter((c) =>
    (!q || `${c.nome} ${c.nome_fantasia} ${c.email} ${c.cidade}`.toLowerCase().includes(q) || (qd.length >= 3 && (c.documento.includes(qd) || c.telefone.replace(/\D/g, "").includes(qd)))) &&
    (!tipo || c.tipo === tipo) &&
    (filtro === "todos" || (filtro === "aberto" ? !!c.negocio_aberto && !["ganho", "perdido"].includes(c.negocio_aberto.etapa) : faltaParaContrato(c).length > 0)),
  ).sort((a, b) => ordem === "recentes" ? String(b.atualizado).localeCompare(String(a.atualizado)) : ordem === "receber" ? b.a_receber - a.a_receber : (a.nome_fantasia || a.nome).localeCompare(b.nome_fantasia || b.nome)), [lista, q, qd, tipo, filtro, ordem]);
  const btn = (ativo: boolean) => `rounded-lg border px-3 py-2 text-[13.5px] font-semibold transition ${ativo ? "border-[#5ab6c2] bg-[#5ab6c2] text-white" : "border-[#5ab6c2] bg-white text-[#3a9aa6] hover:bg-[#eaf6f7]"}`;

  return (
    <Shell titulo="Clientes">
      {lista && lista.length > 0 && (() => {
        const ativos = lista.filter((c) => c.negocio_aberto && !["ganho", "perdido"].includes(c.negocio_aberto.etapa)).length;
        const incompletos = lista.filter((c) => faltaParaContrato(c).length > 0).length;
        const receber = lista.reduce((t, c) => t + (c.a_receber || 0), 0);
        const comContrato = lista.filter((c) => c.contratos > 0).length;
        const itens: [string, string, string, string, () => void][] = [
          ["Clientes", String(lista.length), `${lista.filter((c) => c.tipo === "PF").length} PF · ${lista.filter((c) => c.tipo === "PJ").length} PJ`, "#2f6fb5", () => { setFiltro("todos"); setTipo(""); }],
          ["Negócio em andamento", String(ativos), "no CRM agora", "#f5821f", () => setFiltro("aberto")],
          ["Com contrato", String(comContrato), pl(comContrato, "cliente fechado", "clientes fechados"), "#12a150", () => setFiltro("todos")],
          ["Faltam dados", String(incompletos), "CPF/CNPJ, e-mail ou endereço", "#e8890c", () => setFiltro("incompleto")],
          ["A receber", reais(receber), "parcelas em aberto", "#22c7d6", () => setOrdem("receber")],
        ];
        return (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {itens.map(([r, v, d, cor, f], i) => (
              <button key={r} onClick={f} className={`sombra-bra relative overflow-hidden rounded-[16px] border border-linha bg-white px-4 py-3 pl-5 text-left transition hover:-translate-y-0.5 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
                <span className="absolute top-3 bottom-3 left-0 w-[4px] rounded-r-md" style={{ background: cor }} />
                <span className="block text-[12px] font-semibold text-suave">{r}</span>
                <span className="num block font-display text-[21px] font-extrabold tracking-tight">{v}</span>
                <span className="block truncate text-[11.5px] text-suave">{d}</span>
              </button>
            ))}
          </div>
        );
      })()}
      <div className="rounded-[18px] border border-linha bg-white/80 p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setEditar({})} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-azul to-marinho-900 px-3.5 py-2 text-[13.5px] font-semibold text-white shadow-md hover:shadow-lg"><Plus className="size-4" />Novo cliente</button>
          <label className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="absolute top-2.5 left-3 size-4 text-suave" />
            <input className={campo + " pl-9"} placeholder="Buscar nome, CPF/CNPJ, telefone, cidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className="rounded-lg border border-linha bg-white px-3 py-2 text-[13.5px]" aria-label="Tipo">
            <option value="">PF e PJ</option><option value="PF">Pessoa física</option><option value="PJ">Empresa</option>
          </select>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className="rounded-lg border border-linha bg-white px-3 py-2 text-[13.5px]" aria-label="Ordenar">
            <option value="nome">Nome</option><option value="recentes">Atualizados</option><option value="receber">A receber</option>
          </select>
          <button className={btn(filtro === "aberto")} onClick={() => setFiltro(filtro === "aberto" ? "todos" : "aberto")}>Negócio em andamento</button>
          <button className={btn(filtro === "incompleto")} onClick={() => setFiltro(filtro === "incompleto" ? "todos" : "incompleto")}>Faltam dados</button>
          <span className="ml-auto text-[12.5px] text-suave">{lista ? `${L.length} de ${lista.length}` : ""}</span>
        </div>
        {erro && <p role="alert" className="mb-4 rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
        {!lista && !erro && <p className="py-6 text-center text-suave">Carregando…</p>}
        {lista && !L.length && <p className="py-10 text-center text-suave">{lista.length ? "Nenhum cliente neste filtro." : "Nenhum cliente ainda. Eles também são criados pelos cartões do CRM e pelas importações."}</p>}
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          {L.map((c) => <CartaoCliente key={c.id} c={c} onEditar={() => setEditar(c)} onAbrir={() => router.push(`/clientes/ficha/?id=${c.id}`)} />)}
        </div>
      </div>
      {editar && <FormCliente inicial={editar} onFechar={() => setEditar(null)}
        onSalvo={() => { setEditar(null); carregar(); }} onArquivado={() => { setEditar(null); carregar(); }} />}
    </Shell>
  );
}
