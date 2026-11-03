"use client";
// Depois de importar o XML da nota ou o boleto: abre o lançamento no Financeiro
// para definir os comissionados (vendedor, parceiro e equipe) das parcelas —
// ou criar as parcelas, quando a nota não trouxe duplicatas.
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Botao, campo, Janela, reais, Rotulo } from "@/components/crm/ui";
import { CamposEquipe, Comissao, useEquipeComissao } from "@/components/comissoes-equipe";
import { hoje, montarParcelas, nomeUsuario } from "@/lib/crm";
import { mensagemErro, supabase } from "@/lib/supabase";

type Parcela = { id: string; dados: Record<string, unknown> };
export type AlvoLancamento = { tipo: "nota" | "boleto"; registroId: string };

export function LancamentoImportado({ alvo, onFechar }: { alvo: AlvoLancamento | null; onFechar: () => void }) {
  const [parcelas, setParcelas] = useState<Parcela[] | null>(null);
  const [nota, setNota] = useState<{ numero: string; valor: number; cliente: string } | null>(null);
  const [parceiros, setParceiros] = useState<{ id: string; nome: string; tipo: string; comissao_padrao: number }[]>([]);
  const [f, setF] = useState({ vendedor: "", pctVend: 2.28, parceiro: "", pctParc: 0, forma: "Boleto", parcelas: 1, primeiro: hoje() });
  const [equipe, setEquipe] = useEquipeComissao();
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false), [feito, setFeito] = useState("");

  useEffect(() => {
    if (!alvo) return;
    setParcelas(null); setErro(""); setFeito("");
    (async () => {
      try {
        const db = supabase();
        const [u, pc] = await Promise.all([nomeUsuario(), db.from("parceiros").select("id, nome, tipo, comissao_padrao").eq("ativo", true).order("nome")]);
        setF((x) => ({ ...x, vendedor: u }));
        setParceiros((pc.data ?? []).map((p) => ({ ...p, comissao_padrao: Number(p.comissao_padrao) || 0 })));
        const tit = alvo.tipo === "nota"
          ? await db.from("titulos").select("id, nota_fiscal_id").eq("nota_fiscal_id", alvo.registroId)
          : await db.from("titulos").select("id, nota_fiscal_id").eq("id", alvo.registroId);
        const nfId = alvo.tipo === "nota" ? alvo.registroId : tit.data?.[0]?.nota_fiscal_id;
        let numero = "";
        if (nfId) {
          const { data: nf } = await db.from("notas_fiscais").select("numero, valor_servicos, valor_liquido, cliente_texto, clientes(nome, nome_fantasia)").eq("id", nfId).single();
          if (nf) {
            numero = nf.numero;
            const cli = nf.clientes as unknown as { nome: string; nome_fantasia: string | null } | null;
            setNota({ numero: nf.numero, valor: Number(nf.valor_liquido ?? nf.valor_servicos) || 0, cliente: cli?.nome_fantasia || cli?.nome || nf.cliente_texto || "" });
          }
        }
        const ids = (tit.data ?? []).map((t) => `tx-${t.id}`);
        const filtros = [ids.length ? `id.in.(${ids.join(",")})` : "", numero ? `dados->>nfr.eq.NF ${numero}` : ""].filter(Boolean).join(",");
        const { data } = filtros ? await db.from("fin_docs").select("id, dados").eq("colecao", "it").or(filtros) : { data: [] };
        const lista = (data ?? []) as Parcela[];
        setParcelas(lista);
        const atual = (lista[0]?.dados.coms ?? []) as Comissao[];
        if (atual.length) {
          const v = atual.find((c) => c.r === "Vendedor"); if (v) setF((x) => ({ ...x, vendedor: v.n, pctVend: v.p }));
        }
      } catch (e) { setErro(mensagemErro(e)); setParcelas([]); }
    })();
  }, [alvo]);

  const parc = parceiros.find((p) => p.id === f.parceiro);
  const coms = useMemo<Comissao[]>(() => [
    { n: f.vendedor, r: "Vendedor", p: Number(f.pctVend) || 0 },
    ...(parc ? [{ n: parc.nome, r: parc.tipo === "arquiteto" ? "Arquiteto" : parc.tipo === "engenheiro" ? "Engenheiro" : parc.tipo === "designer" ? "Designer" : "Parceiro", p: Number(f.pctParc) || 0 }] : []),
    ...equipe,
  ].filter((c) => c.n && c.p > 0), [f, parc, equipe]);
  const novas = useMemo(() => (!parcelas?.length && nota ? montarParcelas({ descricao: `NF ${nota.numero}${nota.cliente ? " - " + nota.cliente : ""}`, cliente: nota.cliente, forma: f.forma, total: nota.valor,
    parcelas: Math.max(1, Math.min(60, Number(f.parcelas) || 1)), primeiro: f.primeiro, comissoes: coms, nf: `NF ${nota.numero}` }) : []), [parcelas, nota, f, coms]);

  async function salvar() {
    setErro(""); setOcupado(true);
    try {
      const db = supabase();
      if (parcelas?.length) {
        for (const p of parcelas) {
          const { error } = await db.from("fin_docs").update({ dados: { ...p.dados, coms } }).eq("colecao", "it").eq("id", p.id);
          if (error) throw error;
        }
        setFeito(`Comissões gravadas em ${parcelas.length} parcela(s) no Financeiro.`);
      } else if (novas.length) {
        const { error } = await db.from("fin_docs").insert(novas.map((x) => ({ colecao: "it", id: String(x.id), dados: x })));
        if (error) throw error;
        setFeito(`${novas.length} parcela(s) lançada(s) no Financeiro com as comissões.`);
      }
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  const s = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });
  const mostrar = parcelas?.length ? parcelas.map((p) => p.dados) : novas;

  return (
    <Janela titulo={`Lançamento no Financeiro${nota ? ` · NF ${nota.numero}` : ""}`} aberto={!!alvo} onFechar={onFechar} largura="max-w-2xl"
      rodape={feito ? <><p className="flex-1 text-[13.5px] font-semibold text-ok"><Check className="mr-1 inline size-4" />{feito}</p><Botao onClick={onFechar}>Fechar</Botao></>
        : <><Botao tipo="pri" disabled={ocupado || !parcelas || (!parcelas.length && !novas.length)} onClick={salvar}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{parcelas?.length ? "Gravar comissões" : "Lançar parcelas"}</Botao>
          <Botao onClick={onFechar}>Agora não</Botao>{erro && <p role="alert" className="w-full text-[13px] text-erro">{erro}</p>}</>}>
      {!parcelas ? <div className="flex items-center gap-2 py-6 text-suave"><Loader2 className="size-4 animate-spin" />Buscando as parcelas…</div> : (
        <div className="space-y-4">
          <p className="text-[13px] text-suave">{parcelas.length ? `A importação gerou ${parcelas.length} parcela(s) a receber. Defina quem recebe comissão sobre ela(s).` : "A nota não trouxe parcelas. Defina como o cliente vai pagar e os comissionados."}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Rotulo rotulo="Vendedor" className="col-span-2"><input className={campo} value={f.vendedor} onChange={s("vendedor")} /></Rotulo>
            <Rotulo rotulo="% vendedor"><input className={campo} type="number" step="any" value={f.pctVend} onChange={s("pctVend")} /></Rotulo>
            <div />
            <Rotulo rotulo="Parceiro (arquiteto, engenheiro, designer)" className="col-span-2">
              <select className={campo} value={f.parceiro} onChange={(e) => { const p = parceiros.find((x) => x.id === e.target.value); setF({ ...f, parceiro: e.target.value, pctParc: p?.comissao_padrao ?? 0 }); }}>
                <option value="">— sem parceiro —</option>{parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Rotulo>
            {parc ? <Rotulo rotulo={`% ${parc.nome.split(" ")[0]}`}><input className={campo} type="number" step="any" value={f.pctParc} onChange={s("pctParc")} /></Rotulo> : <div />}
            <div />
            <CamposEquipe equipe={equipe} onChange={setEquipe} />
            {!parcelas.length && nota && <>
              <Rotulo rotulo="Forma"><select className={campo} value={f.forma} onChange={s("forma")}>{["Boleto", "Pix", "Cartão", "Transferência"].map((x) => <option key={x}>{x}</option>)}</select></Rotulo>
              <Rotulo rotulo="Parcelas"><input className={campo} type="number" min={1} max={60} value={f.parcelas} onChange={s("parcelas")} /></Rotulo>
              <Rotulo rotulo="1º vencimento"><input className={campo} type="date" value={f.primeiro} onChange={s("primeiro")} /></Rotulo>
            </>}
          </div>
          {mostrar.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-linha">
              <table className="w-full text-[13px]">
                <thead className="bg-fundo text-left text-[12px] text-suave"><tr><th className="px-3 py-2">Parcela</th><th className="px-3 py-2">Vencimento</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Comissões</th></tr></thead>
                <tbody>{mostrar.map((p, i) => (
                  <tr key={i} className="border-t border-linha">
                    <td className="px-3 py-1.5">{String(p.par || "") || "Única"}</td><td className="num px-3 py-1.5">{String(p.venc ?? "").split("-").reverse().join("/")}</td>
                    <td className="num px-3 py-1.5 text-right font-semibold">{reais(Number(p.valor))}</td>
                    <td className="px-3 py-1.5 text-suave">{coms.map((c) => `${c.n.split(" ")[0]} ${reais((Number(p.valor) * c.p) / 100)}`).join(" · ") || "—"}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Janela>
  );
}
