"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeftRight, Combine, FileText, Handshake, Layers, Loader2, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Search, Trophy, Wallet } from "lucide-react";
import { Shell } from "@/components/Shell";
import { FormCliente } from "@/components/clientes/form-cliente";
import { Botao, campo, Janela, reais } from "@/components/crm/ui";
import { corEtapaChip } from "@/components/crm/visoes";
import { ClienteCartao, enderecoLinha, juntarClientes, listarCartoes } from "@/lib/clientes";
import { ETAPAS_NEGOCIO, EtapaNegocio, rotulo } from "@/lib/crm";
import { formatarDocumento } from "@/lib/contratos";
import { mensagemErro } from "@/lib/supabase";
import { pl, telefone } from "@/lib/texto";
import { usePapel } from "@/lib/usar-papel";

const iniciais = (nome: string) => nome.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]/.test(p)).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
const whatsapp = (tel: string) => { const d = tel.replace(/\D/g, ""); return d ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : ""; };
const faltaParaContrato = (c: ClienteCartao) => [!c.documento && "CPF/CNPJ", !c.email && "e-mail", !c.logradouro && "endereço"].filter(Boolean) as string[];
const TONS = ["#2f6fb5", "#12a150", "#f5821f", "#7c5cd6", "#0e8f9c", "#d6489b", "#19295a"];
const tom = (id: string) => TONS[[...id].reduce((s, ch) => s + ch.charCodeAt(0), 0) % TONS.length];

type Arraste = { arrastando: string | null; setArrastando: (id: string | null) => void; onSoltar: (origem: string, destino: string) => void; ativo: boolean };

function CartaoCliente({ c, aditivos, onEditar, onAbrir, onJuntar, dnd }: { c: ClienteCartao; aditivos: ClienteCartao[]; onEditar: () => void; onAbrir: () => void; onJuntar: () => void; dnd: Arraste }) {
  const falta = faltaParaContrato(c);
  const [alvo, setAlvo] = useState(false);
  const podeSoltar = dnd.ativo && !!dnd.arrastando && dnd.arrastando !== c.id;
  const etapa = c.negocio_aberto?.etapa === "qualificacao" ? "lead" : (c.negocio_aberto?.etapa as EtapaNegocio | undefined);
  return (
    <div draggable={dnd.ativo}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); dnd.setArrastando(c.id); }}
      onDragEnd={() => { dnd.setArrastando(null); setAlvo(false); }}
      onDragOver={(e) => { if (podeSoltar) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!alvo) setAlvo(true); } }}
      onDragLeave={() => setAlvo(false)}
      onDrop={(e) => { e.preventDefault(); setAlvo(false); const o = e.dataTransfer.getData("text/plain") || dnd.arrastando; dnd.setArrastando(null); if (o && o !== c.id) dnd.onSoltar(o, c.id); }}
      className={`group relative flex overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(9,30,66,.08)] transition hover:shadow-[0_6px_18px_-6px_rgba(9,30,66,.3)] ${alvo ? "scale-[1.02] border-azul ring-4 ring-azul/25" : "border-linha"} ${dnd.arrastando === c.id ? "opacity-40" : ""} ${dnd.ativo ? "cursor-grab active:cursor-grabbing" : ""}`}>
      {alvo && <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-azul/10"><span className="inline-flex items-center gap-1.5 rounded-full bg-azul px-3 py-1 text-[12.5px] font-bold text-white shadow-lg"><Combine className="size-3.5" />Soltar para juntar aqui</span></div>}
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 bg-fundo/80 py-2.5 text-suave">
        <button onClick={onEditar} title="Editar dados" className="rounded-md p-1 hover:bg-white hover:text-azul"><Pencil className="size-3.5" /></button>
        <button onClick={onAbrir} title="Abrir ficha" className="rounded-md p-1 hover:bg-white hover:text-azul"><FileText className="size-3.5" /></button>
        {dnd.ativo && <button onClick={onJuntar} title="Juntar com outro cliente (aditivo)" className="rounded-md p-1 hover:bg-white hover:text-azul"><Combine className="size-3.5" /></button>}
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
          {aditivos.length > 0 && <span title={`Aditivos: ${aditivos.map((a) => a.nome_fantasia || a.nome).join(", ")}`} className="inline-flex h-6 items-center gap-1 rounded-full bg-ciano-claro px-2 text-[11px] font-bold text-[#14708c]"><Layers className="size-3" />+{aditivos.length}</span>}
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
  const tecnico = usePapel() === "tecnico";   // técnico não vê negócios nem valores
  const [editar, setEditar] = useState<Partial<ClienteCartao> | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [juntar, setJuntar] = useState<{ origem: string; destino: string | null } | null>(null);
  const [buscaJuntar, setBuscaJuntar] = useState(""), [juntando, setJuntando] = useState(false), [erroJuntar, setErroJuntar] = useState(""), [aviso, setAviso] = useState("");
  const carregar = () => listarCartoes().then(setLista).catch((e) => setErro(mensagemErro(e)));
  useEffect(() => { carregar(); }, []);

  const q = busca.trim().toLowerCase(), qd = busca.replace(/\D/g, "");
  // aditivos ficam dentro do cartão principal
  const porId = useMemo(() => new Map((lista ?? []).map((c) => [c.id, c])), [lista]);
  const aditivosDe = useMemo(() => { const m = new Map<string, ClienteCartao[]>(); for (const c of lista ?? []) if (c.principal_id && porId.has(c.principal_id)) m.set(c.principal_id, [...(m.get(c.principal_id) ?? []), c]); return m; }, [lista, porId]);
  const principais = useMemo(() => (lista ?? []).filter((c) => !c.principal_id || !porId.has(c.principal_id)), [lista, porId]);
  const L = useMemo(() => principais.filter((c) =>
    (!q || `${c.nome} ${c.nome_fantasia} ${c.email} ${c.cidade} ${(aditivosDe.get(c.id) ?? []).map((a) => `${a.nome} ${a.nome_fantasia}`).join(" ")}`.toLowerCase().includes(q) || (qd.length >= 3 && (c.documento.includes(qd) || c.telefone.replace(/\D/g, "").includes(qd)))) &&
    (!tipo || c.tipo === tipo) &&
    (filtro === "todos" || (filtro === "aberto" ? !!c.negocio_aberto && !["ganho", "perdido"].includes(c.negocio_aberto.etapa) : faltaParaContrato(c).length > 0)),
  ).sort((a, b) => ordem === "recentes" ? String(b.atualizado).localeCompare(String(a.atualizado)) : ordem === "receber" ? b.a_receber - a.a_receber : (a.nome_fantasia || a.nome).localeCompare(b.nome_fantasia || b.nome)), [principais, aditivosDe, q, qd, tipo, filtro, ordem]);
  const nomeDe = (id: string | null) => { const c = id ? porId.get(id) : null; return c ? c.nome_fantasia || c.nome : ""; };
  async function confirmarJuntar() {
    if (!juntar?.destino) return;
    setJuntando(true); setErroJuntar("");
    try { const p = await juntarClientes(juntar.origem, juntar.destino); setAviso(`${nomeDe(juntar.origem)} agora é aditivo de ${nomeDe(p)}.`); setJuntar(null); setBuscaJuntar(""); await carregar(); }
    catch (e) { setErroJuntar(mensagemErro(e)); } finally { setJuntando(false); }
  }
  const candidatos = useMemo(() => { const t = buscaJuntar.trim().toLowerCase(); return principais.filter((c) => c.id !== juntar?.origem && (!t || `${c.nome} ${c.nome_fantasia} ${c.documento}`.toLowerCase().includes(t))).slice(0, 30); }, [principais, buscaJuntar, juntar]);
  const dnd: Arraste = { arrastando, setArrastando, ativo: !tecnico, onSoltar: (origem, destino) => { setErroJuntar(""); setJuntar({ origem, destino }); } };
  const btn = (ativo: boolean) => `rounded-lg border px-3 py-2 text-[13.5px] font-semibold transition ${ativo ? "border-[#5ab6c2] bg-[#5ab6c2] text-white" : "border-[#5ab6c2] bg-white text-[#3a9aa6] hover:bg-[#eaf6f7]"}`;

  return (
    <Shell titulo="Clientes">
      {lista && lista.length > 0 && (() => {
        const base = principais;
        const ativos = base.filter((c) => c.negocio_aberto && !["ganho", "perdido"].includes(c.negocio_aberto.etapa)).length;
        const incompletos = base.filter((c) => faltaParaContrato(c).length > 0).length;
        const receber = lista.reduce((t, c) => t + (c.a_receber || 0), 0);
        const comContrato = base.filter((c) => c.contratos > 0).length;
        const todos: [string, string, string, string, () => void][] = [
          ["Clientes", String(base.length), `${base.filter((c) => c.tipo === "PF").length} PF · ${base.filter((c) => c.tipo === "PJ").length} PJ${lista.length > base.length ? ` · ${lista.length - base.length} aditivos` : ""}`, "#2f6fb5", () => { setFiltro("todos"); setTipo(""); }],
          ["Negócio em andamento", String(ativos), "no CRM agora", "#f5821f", () => setFiltro("aberto")],
          ["Com contrato", String(comContrato), pl(comContrato, "cliente fechado", "clientes fechados"), "#12a150", () => setFiltro("todos")],
          ["Faltam dados", String(incompletos), "CPF/CNPJ, e-mail ou endereço", "#e8890c", () => setFiltro("incompleto")],
          ["A receber", reais(receber), "parcelas em aberto", "#22c7d6", () => setOrdem("receber")],
        ];
        const itens = tecnico ? todos.filter(([r]) => r === "Clientes" || r === "Faltam dados") : todos;
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
            <option value="nome">Nome</option><option value="recentes">Atualizados</option>{!tecnico && <option value="receber">A receber</option>}
          </select>
          {!tecnico && <button className={btn(filtro === "aberto")} onClick={() => setFiltro(filtro === "aberto" ? "todos" : "aberto")}>Negócio em andamento</button>}
          <button className={btn(filtro === "incompleto")} onClick={() => setFiltro(filtro === "incompleto" ? "todos" : "incompleto")}>Faltam dados</button>
          <span className="ml-auto text-[12.5px] text-suave">{lista ? `${L.length} de ${principais.length}` : ""}</span>
        </div>
        {!tecnico && lista && lista.length > 1 && <p className="mb-3 hidden items-center gap-1.5 text-[12.5px] text-suave md:flex"><Combine className="size-3.5 text-azul" />Dica: arraste um cartão para cima de outro para juntar o aditivo ao cliente principal.</p>}
        {aviso && <p className="mb-3 rounded-lg bg-ok-claro px-4 py-2.5 text-[13.5px] font-semibold text-ok">✓ {aviso}</p>}
        {erro && <p role="alert" className="mb-4 rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
        {!lista && !erro && <p className="py-6 text-center text-suave">Carregando…</p>}
        {lista && !L.length && <p className="py-10 text-center text-suave">{lista.length ? "Nenhum cliente neste filtro." : "Nenhum cliente ainda. Eles também são criados pelos cartões do CRM e pelas importações."}</p>}
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          {L.map((c) => <CartaoCliente key={c.id} c={c} aditivos={aditivosDe.get(c.id) ?? []} dnd={dnd} onEditar={() => setEditar(c)} onAbrir={() => router.push(`/clientes/ficha/?id=${c.id}`)}
            onJuntar={() => { setErroJuntar(""); setBuscaJuntar(""); setJuntar({ origem: c.id, destino: null }); }} />)}
        </div>
      </div>
      <Janela titulo="Juntar clientes" aberto={!!juntar} onFechar={() => setJuntar(null)} largura="max-w-md"
        rodape={<>
          <Botao tipo="pri" disabled={juntando || !juntar?.destino} onClick={confirmarJuntar}>{juntando ? <Loader2 className="size-4 animate-spin" /> : <Combine className="size-4" />}Juntar</Botao>
          <Botao tipo="leve" onClick={() => setJuntar(null)}>Cancelar</Botao>
        </>}>
        {juntar && (
          <div className="space-y-3 text-[13.5px]">
            {juntar.destino ? (<>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 rounded-xl border border-linha bg-fundo/60 px-3 py-2"><div className="text-[11px] font-bold tracking-wide text-suave uppercase">Aditivo</div><div className="truncate font-semibold">{nomeDe(juntar.origem)}</div></div>
                <button type="button" title="Inverter (o outro vira o principal)" onClick={() => setJuntar({ origem: juntar.destino!, destino: juntar.origem })} className="rounded-full border border-linha p-2 text-azul hover:bg-fundo"><ArrowLeftRight className="size-4" /></button>
                <div className="min-w-0 flex-1 rounded-xl border-2 border-azul bg-[#eef3fb] px-3 py-2"><div className="text-[11px] font-bold tracking-wide text-azul uppercase">Cliente principal</div><div className="truncate font-semibold">{nomeDe(juntar.destino)}</div></div>
              </div>
              <p className="text-suave">Os negócios, orçamentos, contratos, financeiro, chamados e documentos de <b className="text-tinta">{nomeDe(juntar.origem)}</b> passam a aparecer no cartão de <b className="text-tinta">{nomeDe(juntar.destino)}</b>. Nada é apagado — se precisar, desvincule depois na ficha do cliente.</p>
              {!!aditivosDe.get(juntar.origem)?.length && <p className="text-suave">Os {aditivosDe.get(juntar.origem)!.length} aditivo(s) de {nomeDe(juntar.origem)} também vão para o principal.</p>}
              <button type="button" onClick={() => setJuntar({ ...juntar, destino: null })} className="text-[12.5px] font-semibold text-azul hover:underline">Escolher outro cliente principal</button>
            </>) : (<>
              <p className="text-suave">Escolha o <b className="text-tinta">cliente principal</b> para onde <b className="text-tinta">{nomeDe(juntar.origem)}</b> vai como aditivo:</p>
              <label className="relative block"><Search className="absolute top-2.5 left-3 size-4 text-suave" /><input autoFocus className={campo + " pl-9"} placeholder="Buscar cliente" value={buscaJuntar} onChange={(e) => setBuscaJuntar(e.target.value)} /></label>
              <ul className="max-h-72 divide-y divide-linha overflow-y-auto rounded-xl border border-linha">
                {candidatos.map((c) => (
                  <li key={c.id}><button type="button" onClick={() => setJuntar({ ...juntar, destino: c.id })} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-fundo">
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.nome_fantasia || c.nome}</span><span className="block truncate text-[12px] text-suave">{[c.documento ? formatarDocumento(c.documento) : "", c.cidade].filter(Boolean).join(" · ")}</span></span>
                  </button></li>
                ))}
                {!candidatos.length && <li className="px-3 py-4 text-center text-suave">Nenhum cliente encontrado.</li>}
              </ul>
            </>)}
            {erroJuntar && <p role="alert" className="rounded-lg bg-erro-claro px-3 py-2 text-erro">{erroJuntar}</p>}
          </div>
        )}
      </Janela>
      {editar && <FormCliente inicial={editar} onFechar={() => setEditar(null)}
        onSalvo={() => { setEditar(null); carregar(); }} onArquivado={() => { setEditar(null); carregar(); }} />}
    </Shell>
  );
}
