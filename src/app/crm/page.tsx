"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { FormAtividade, FormLancar, FormNegocio, FormParceiro } from "@/components/crm/formularios";
import { Acoes, FichaParceiro, ListaAtividades, Painel, Parceiros, Prospeccao } from "@/components/crm/visoes";
import { FichaNegocio, QuadroNegocios } from "@/components/crm/negocios";
import {
  Atividade, carregarCrm, Crm, excluir, lancarNoFinanceiro, Negocio, nomeUsuario, Parceiro, salvarAtividade, salvarNegocio, salvarParceiro,
} from "@/lib/crm";
import { mensagemErro } from "@/lib/supabase";

const ABAS = [
  ["painel", "Painel"], ["negocios", "Clientes / negócios"], ["parceiros", "Parceiros"], ["prospeccao", "Prospecção"],
  ["agenda", "Agenda e reuniões"], ["followup", "Follow-up"], ["todo", "To-do diário"],
] as const;

type Modal =
  | { k: "parceiro"; x: Partial<Parceiro> }
  | { k: "negocio"; x: Partial<Negocio> }
  | { k: "atividade"; x: Partial<Atividade> }
  | { k: "lancar"; x: Negocio }
  | null;

function Conteudo() {
  const params = useSearchParams(), router = useRouter();
  const aba = params.get("aba") ?? "painel", pid = params.get("parceiro"), nid = params.get("n");
  const [crm, setCrm] = useState<Crm | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [usuario, setUsuario] = useState("");

  const recarregar = useCallback(() => carregarCrm().then(setCrm).catch((e) => setErro(mensagemErro(e))), []);
  useEffect(() => { recarregar(); nomeUsuario().then(setUsuario).catch(() => {}); }, [recarregar]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(""), 3500); return () => clearTimeout(t); }, [aviso]);

  const ir = (a: string, parceiro?: string | null, negocio?: string | null) => {
    const q = new URLSearchParams(); q.set("aba", a); if (parceiro) q.set("parceiro", parceiro); if (negocio) q.set("n", negocio);
    router.push(`/crm/?${q.toString()}`, { scroll: true });
  };
  const atualizar = () => setCrm((c) => (c ? { ...c } : c));
  const falhar = (e: unknown) => setAviso("Não foi possível salvar: " + mensagemErro(e));

  async function gravarAtividade(x: Partial<Atividade>) {
    const nova = await salvarAtividade(crm!, x);
    crm!.atividades = [...crm!.atividades.filter((a) => a.id !== nova.id), nova];
    atualizar();
  }

  const ac: Acoes = {
    usuario,
    parceiro: (x = {}) => setModal({ k: "parceiro", x }),
    negocio: (x = {}) => setModal({ k: "negocio", x }),
    atividade: (x = {}) => {
      if ((x as { salvarDireto?: boolean }).salvarDireto) {
        const { salvarDireto: _, ...resto } = x as Partial<Atividade> & { salvarDireto?: boolean };
        void _; gravarAtividade(resto).then(() => setAviso("Salvo.")).catch(falhar);
      } else setModal({ k: "atividade", x });
    },
    alternar: (a) => { gravarAtividade({ ...a, concluida: !a.concluida }).catch(falhar); },
    moverNegocio: (id, etapa) => {
      const n = crm!.negocios.find((x) => x.id === id); if (!n || n.etapa === etapa) return;
      const antesEtapa = n.etapa;
      salvarNegocio(crm!, { ...n, etapa }).then((novo) => {
        crm!.negocios = crm!.negocios.map((x) => (x.id === id ? novo : x)); atualizar();
        if (etapa === "ganho" && antesEtapa !== "ganho") { setAviso("Cliente fechado! Suba o orçamento na pasta e siga com o contrato."); if (!nid) ir("negocios", null, id); }
      }).catch(falhar);
    },
    moverParceiro: (id, etapa) => {
      const p = crm!.parceiros.find((x) => x.id === id); if (!p || p.etapa === etapa) return;
      salvarParceiro(crm!, { ...p, etapa }).then((novo) => { crm!.parceiros = crm!.parceiros.map((x) => (x.id === id ? novo : x)); atualizar(); }).catch(falhar);
    },
    verParceiro: (id) => ir("parceiros", id),
    aba: (a) => ir(a),
    lancar: (n) => setModal({ k: "lancar", x: n }),
    ficha: (id) => ir("negocios", null, id),
  };

  const titulo = pid ? "Parceiro" : nid ? "Negócio" : ABAS.find(([k]) => k === aba)?.[1] ?? "CRM";
  return (
    <Shell titulo="CRM" cheio>
      <div className="px-4 pt-5 pb-16 lg:px-9 lg:pt-7">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12.5px] font-semibold tracking-wide text-suave uppercase">CRM · BRA Comercial</div>
            <h1 className="font-display text-[24px] font-extrabold tracking-tight lg:text-[28px]">{titulo}</h1>
          </div>
        </div>
        <nav className="mb-5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 print:hidden" aria-label="Seções do CRM">
          {ABAS.map(([k, l]) => (
            <button key={k} onClick={() => ir(k)}
              className={`shrink-0 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold whitespace-nowrap transition ${aba === k && !(pid && k !== "parceiros") ? "bg-marinho-900 text-white shadow-md" : "bg-white text-suave hover:text-tinta"}`}>{l}</button>
          ))}
        </nav>
        {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
        {!crm ? (!erro && <p className="text-suave">Carregando…</p>) : pid ? <FichaParceiro crm={crm} ac={ac} id={pid} /> : (
          aba === "negocios" ? (nid ? <FichaNegocio key={nid} crm={crm} ac={ac} id={nid} onSalvo={atualizar} /> : <QuadroNegocios crm={crm} ac={ac} />)
          : aba === "parceiros" ? <Parceiros crm={crm} ac={ac} />
          : aba === "prospeccao" ? <Prospeccao crm={crm} ac={ac} />
          : aba === "agenda" ? <ListaAtividades crm={crm} ac={ac} modo="agenda" />
          : aba === "followup" ? <ListaAtividades crm={crm} ac={ac} modo="followup" />
          : aba === "todo" ? <ListaAtividades crm={crm} ac={ac} modo="tarefa" />
          : <Painel crm={crm} ac={ac} />
        )}
      </div>

      {crm && modal?.k === "parceiro" && (
        <FormParceiro crm={crm} inicial={modal.x} onFechar={() => setModal(null)}
          onSalvar={async (x) => { const novo = await salvarParceiro(crm, x); crm.parceiros = [...crm.parceiros.filter((p) => p.id !== novo.id), novo].sort((a, b) => a.nome.localeCompare(b.nome)); atualizar(); setModal(null); }}
          onExcluir={modal.x.id ? async () => { await excluir(crm, "parceiros", modal.x.id!); atualizar(); setModal(null); if (pid) ir("parceiros"); } : undefined} />
      )}
      {crm && modal?.k === "negocio" && (
        <FormNegocio crm={crm} inicial={modal.x} onFechar={() => setModal(null)}
          onSalvar={async (x) => {
            const novo = await salvarNegocio(crm, x);
            crm.negocios = [novo, ...crm.negocios.filter((n) => n.id !== novo.id)]; atualizar();
            setModal(null);
            if (!x.id) ir("negocios", null, novo.id);
          }}
          onLancar={modal.x.id ? () => setModal({ k: "lancar", x: crm.negocios.find((n) => n.id === modal.x.id)! }) : undefined}
          onExcluir={modal.x.id ? async () => { await excluir(crm, "oportunidades", modal.x.id!); atualizar(); setModal(null); } : undefined} />
      )}
      {crm && modal?.k === "atividade" && (
        <FormAtividade crm={crm} inicial={modal.x} onFechar={() => setModal(null)}
          onSalvar={async (x) => { await gravarAtividade(x); setModal(null); }}
          onExcluir={modal.x.id ? async () => { await excluir(crm, "atividades", modal.x.id!); atualizar(); setModal(null); } : undefined} />
      )}
      {crm && modal?.k === "lancar" && (
        <FormLancar crm={crm} negocio={modal.x} usuario={usuario || "Matheus Esturrari"} onFechar={() => setModal(null)}
          onConfirmar={async (parcelas) => { await lancarNoFinanceiro(modal.x, parcelas, usuario); atualizar(); setModal(null); setAviso(`${parcelas.length} parcela(s) lançada(s) no Financeiro.`); }} />
      )}

      {aviso && <div role="status" className="fixed right-4 bottom-4 z-50 max-w-[92vw] rounded-xl border-l-4 border-ok bg-marinho-950 px-4 py-3 text-[14px] font-semibold text-white shadow-2xl">{aviso}</div>}
    </Shell>
  );
}

export default function CrmPagina() {
  return <Suspense><Conteudo /></Suspense>;
}
