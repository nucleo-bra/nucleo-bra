"use client";
// Lista de obras: cada contrato assinado vira uma obra (cartão por cliente).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarCheck2, FileCheck2, FileSignature, HardHat, PackageMinus, Plus, Search } from "lucide-react";
import { Kpi } from "@/components/projetos/painel-quadro";
import { contratosSemObra, ContratoSemObra, criarObra, dataBr, hojeIso, listarObras, ResumoObra, STATUS_OBRA, StatusObra } from "@/lib/obras";
import { mensagemErro } from "@/lib/supabase";
import { usePapel } from "@/lib/usar-papel";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function ListaObras() {
  const router = useRouter();
  const papel = usePapel();
  const [L, setL] = useState<ResumoObra[] | null>(null);
  const [semObra, setSemObra] = useState<ContratoSemObra[]>([]);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusObra | "todas">("andamento");
  const [criando, setCriando] = useState<string | null>(null);
  useEffect(() => {
    listarObras().then(setL).catch((e) => setErro(mensagemErro(e)));
    contratosSemObra().then(setSemObra);
  }, []);
  const hoje = hojeIso();
  const visiveis = useMemo(() => (L ?? []).filter((o) => (filtro === "todas" || o.status === filtro)
    && (!busca.trim() || `${o.numero} ${o.titulo} ${o.cliente_nome ?? ""} ${o.endereco ?? ""}`.toLowerCase().includes(busca.trim().toLowerCase()))), [L, filtro, busca]);
  const and = (L ?? []).filter((o) => o.status === "andamento");
  const atrasadas = and.filter((o) => o.atrasadas || (o.previsao_entrega && o.previsao_entrega < hoje)).length;
  const docsPend = and.reduce((a, o) => a + o.docs - o.docsOk, 0), saidas = (L ?? []).reduce((a, o) => a + o.pendentesSaida, 0);

  async function criar(c: ContratoSemObra) {
    setCriando(c.id); setErro("");
    try { const id = await criarObra(c.id); router.push(`/tecnico/obras/?id=${id}`); } catch (e) { setErro(mensagemErro(e)); setCriando(null); }
  }

  return (
    <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-7">
      <div className="mb-5">
        <div className="text-[12.5px] font-semibold tracking-wide text-suave uppercase">Técnico · Obras</div>
        <h1 className="font-display text-[24px] font-extrabold tracking-tight lg:text-[28px]">Obras em andamento</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-suave">Cada contrato assinado vira uma obra com cronograma, materiais, tarefas e a documentação de entrega do cliente.</p>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi destaque icone={HardHat} rotulo="Obras em andamento" valor={String(and.length)} detalhe={`${(L ?? []).length} no total`} cor="" />
        <Kpi icone={AlertTriangle} rotulo="Com atraso" valor={String(atrasadas)} cor="#ff3b30" tom={atrasadas ? "text-erro" : ""} detalhe="etapa ou entrega vencida" />
        <Kpi icone={FileCheck2} rotulo="Documentos pendentes" valor={String(docsPend)} cor="#ff9500" detalhe="nas obras em andamento" />
        <Kpi icone={PackageMinus} rotulo="Saídas para revisar" valor={String(saidas)} cor="#af52de" detalhe="fora do orçamento / excedentes" />
        <Kpi icone={CalendarCheck2} rotulo="Entregues" valor={String((L ?? []).filter((o) => o.status === "entregue").length)} cor="#34c759" detalhe="com termo de entrega" />
      </div>

      {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}

      {semObra.length > 0 && (
        <section className="mb-5 rounded-[18px] border border-[#ffd8a8] bg-atencao-claro px-5 py-4">
          <h2 className="mb-2 flex items-center gap-2 text-[14px] font-bold text-atencao"><FileSignature className="size-4" />Contratos assinados sem obra</h2>
          <p className="mb-3 text-[12.5px] text-suave">Contratos assinados antes desta função, ou sem PDF anexado. Crie a obra com um clique.</p>
          <div className="grid gap-2 md:grid-cols-2">
            {semObra.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
                <div className="min-w-0 flex-1"><b className="block truncate text-[13.5px]">{c.cliente}</b><span className="block truncate text-[12px] text-suave">Contrato {c.numero} · {c.titulo} · {dataBr(c.assinado_em)}</span></div>
                <button onClick={() => criar(c)} disabled={!!criando} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-azul px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-azul-escuro disabled:opacity-50"><Plus className="size-3.5" />{criando === c.id ? "Criando…" : "Criar obra"}</button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-linha bg-white px-3 py-2 md:max-w-sm">
          <Search className="size-4 text-suave" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar obra, cliente ou endereço" aria-label="Buscar obra" className="w-full bg-transparent text-[14px] outline-none" />
        </label>
        {(["andamento", "pausada", "entregue", "cancelada", "todas"] as const).map((s) => (
          <button key={s} onClick={() => setFiltro(s)} className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${filtro === s ? "bg-tinta text-white" : "bg-white text-suave hover:text-tinta"}`}>
            {s === "todas" ? "Todas" : STATUS_OBRA[s].rot} <span className="opacity-60">{s === "todas" ? (L ?? []).length : (L ?? []).filter((o) => o.status === s).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visiveis.map((o) => {
          const pct = o.etapas ? Math.round((o.etapasFeitas / o.etapas) * 100) : 0;
          const pctDoc = o.docs ? Math.round((o.docsOk / o.docs) * 100) : 0;
          const atrasada = o.status === "andamento" && (o.atrasadas > 0 || (!!o.previsao_entrega && o.previsao_entrega < hoje));
          return (
            <Link key={o.id} href={`/tecnico/obras/?id=${o.id}`} className="sombra-bra group flex flex-col gap-3 rounded-[18px] border border-linha bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl heroi font-display text-[14px] font-bold text-white">#{o.numero}</span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{o.cliente_nome ?? o.titulo}</b>
                  <span className="block truncate text-[12.5px] text-suave">{o.titulo !== o.cliente_nome ? o.titulo : o.endereco ?? ""}</span>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold" style={{ color: STATUS_OBRA[o.status].cor, background: STATUS_OBRA[o.status].cor + "1a" }}>{STATUS_OBRA[o.status].rot}</span>
              </div>
              <div className="space-y-2 text-[12.5px]">
                <Barra rot="Cronograma" pct={pct} txt={`${o.etapasFeitas}/${o.etapas} etapas`} cor="from-ciano to-azul" />
                <Barra rot="Documentação" pct={pctDoc} txt={`${o.docsOk}/${o.docs} aprovados`} cor="from-[#ffb340] to-[#ff9500]" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="text-suave">Entrega: <b className={atrasada ? "text-erro" : "text-tinta"}>{dataBr(o.entregue_em ?? o.previsao_entrega)}</b></span>
                {atrasada && <span className="inline-flex items-center gap-1 rounded-full bg-erro-claro px-2 py-0.5 font-bold text-erro"><AlertTriangle className="size-3" />Atraso</span>}
                {o.pendentesSaida > 0 && papel === "diretoria" && <span className="rounded-full bg-[#f4ecfa] px-2 py-0.5 font-bold text-[#8944ab]">{o.pendentesSaida} saída(s) p/ revisar</span>}
                {o.valor_contrato != null && papel !== "tecnico" && <span className="ml-auto font-semibold text-suave">{reais(o.valor_contrato)}</span>}
              </div>
            </Link>
          );
        })}
      </div>
      {L && !visiveis.length && <p className="mt-6 rounded-2xl border border-dashed border-linha bg-white/60 px-4 py-10 text-center text-suave">{L.length ? "Nenhuma obra neste filtro." : "Ainda não há obras. Ao anexar o PDF do contrato assinado, a obra é criada sozinha."}</p>}
      {!L && !erro && <p className="mt-4 text-suave">Carregando…</p>}
    </div>
  );
}

function Barra({ rot, pct, txt, cor }: { rot: string; pct: number; txt: string; cor: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-suave"><span>{rot}</span><span><b className="text-tinta">{pct}%</b> · {txt}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fundo"><div className={`h-full rounded-full bg-gradient-to-r ${cor}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
