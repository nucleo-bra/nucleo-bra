"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageCircle, Plus, Search, Undo2, CheckCircle2, Copy, Check, Receipt, Percent, LayoutDashboard } from "lucide-react";
import { App, Bloco, Selo, Shell, Vazio } from "@/components/Shell";
import { Campo, Modal, botaoPrimario, botaoSecundario, estiloInput } from "@/components/Modal";
import {
  Comissionado, ComissaoLinha, Granularidade, Nota, Titulo, baixarTitulo, buscarClientes, criarLancamento, estornarBaixa,
  fecharComissao, hojeIso, listarComissionados, listarComissoes, listarNotas, listarTitulos, periodo, registrarCobranca,
  reabrirComissao, situacao,
} from "@/lib/financeiro";
import { formatarData, formatarReais } from "@/lib/dados";
import { mensagemErro } from "@/lib/supabase";

const ABAS = [["recebimentos", "Recebimentos"], ["faturamento", "Faturamento"], ["comissoes", "Comissões"]] as const;
type Aba = (typeof ABAS)[number][0];

function Navegador({ g, setG, desloc, setDesloc, rotulo, opcoes = ["mes", "tri", "sem", "ano"] }: {
  g: Granularidade; setG: (g: Granularidade) => void; desloc: number; setDesloc: (n: number) => void; rotulo: string; opcoes?: Granularidade[];
}) {
  const nomes: Record<Granularidade, string> = { mes: "Mês", tri: "Trimestre", sem: "Semestre", ano: "Ano" };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {opcoes.length > 1 && (
        <div className="inline-flex rounded-lg border border-linha bg-white p-0.5">
          {opcoes.map((o) => (
            <button key={o} onClick={() => { setG(o); setDesloc(0); }}
              className={`rounded-md px-3 py-1.5 text-[13px] ${g === o ? "bg-marinho-900 text-white" : "text-suave hover:text-tinta"}`}>{nomes[o]}</button>
          ))}
        </div>
      )}
      <div className="inline-flex items-center rounded-lg border border-linha bg-white">
        <button onClick={() => setDesloc(desloc - 1)} className="p-2 text-suave hover:text-tinta" aria-label="Período anterior"><ChevronLeft className="size-4" /></button>
        <span className="min-w-28 text-center text-[14px] font-medium capitalize">{rotulo}</span>
        <button onClick={() => setDesloc(desloc + 1)} className="p-2 text-suave hover:text-tinta" aria-label="Próximo período"><ChevronRight className="size-4" /></button>
      </div>
      {desloc !== 0 && <button onClick={() => setDesloc(0)} className="text-[13px] text-suave underline">Hoje</button>}
    </div>
  );
}

function Cartao({ rotulo, valor, tom = "tinta", detalhe }: { rotulo: string; valor: number; tom?: "tinta" | "ok" | "erro" | "atencao" | "ciano"; detalhe?: string }) {
  const cor = { tinta: "text-tinta", ok: "text-ok", erro: "text-erro", atencao: "text-atencao", ciano: "text-[#14708c]" }[tom];
  return (
    <div className="rounded-xl border border-linha bg-white px-5 py-4">
      <div className="text-[12px] text-suave">{rotulo}</div>
      <div className={`num mt-1 font-display text-[22px] font-semibold ${cor}`}>{formatarReais(valor)}</div>
      {detalhe && <div className="mt-0.5 text-[12px] text-suave">{detalhe}</div>}
    </div>
  );
}

// =====================================================================
function Recebimentos() {
  const [g, setG] = useState<Granularidade>("mes");
  const [desloc, setDesloc] = useState(0);
  const [filtro, setFiltro] = useState<"todos" | "aberto" | "vencido" | "pago">("todos");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Titulo[] | null>(null);
  const [erro, setErro] = useState("");
  const [baixa, setBaixa] = useState<Titulo | null>(null);
  const [cobrar, setCobrar] = useState<Titulo | null>(null);
  const [novo, setNovo] = useState(false);
  const p = periodo(g, desloc);
  const todosVencidos = filtro === "vencido";

  const carregar = useCallback(() => {
    setLista(null);
    listarTitulos({ de: todosVencidos ? undefined : p.de, ate: todosVencidos ? undefined : p.ate, status: filtro === "todos" ? undefined : filtro, busca })
      .then(setLista).catch((e) => setErro(mensagemErro(e)));
  }, [p.de, p.ate, filtro, busca, todosVencidos]);
  useEffect(() => { const t = setTimeout(carregar, 200); return () => clearTimeout(t); }, [carregar]);

  const tot = useMemo(() => {
    const l = lista ?? [];
    const s = (f: (t: Titulo) => boolean, v: (t: Titulo) => number = (t) => t.valor) => l.filter(f).reduce((a, t) => a + v(t), 0);
    return {
      previsto: s(() => true), recebido: s((t) => t.status === "pago", (t) => t.valor_pago ?? t.valor),
      aberto: s((t) => situacao(t) === "aberto"), vencido: s((t) => situacao(t) === "vencido"),
    };
  }, [lista]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {todosVencidos ? <span className="text-[14px] text-suave">Todos os títulos vencidos, de qualquer período</span>
          : <Navegador g={g} setG={setG} desloc={desloc} setDesloc={setDesloc} rotulo={p.rotulo} />}
        <button onClick={() => setNovo(true)} className={botaoPrimario}><Plus className="size-4" /> Novo lançamento</button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao rotulo={filtro === "pago" ? "Recebido no período" : "Previsto no período"} valor={tot.previsto} />
        <Cartao rotulo="Recebido" valor={tot.recebido} tom="ok" />
        <Cartao rotulo="Em aberto" valor={tot.aberto} tom="ciano" />
        <Cartao rotulo="Vencido" valor={tot.vencido} tom={tot.vencido ? "erro" : "tinta"} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-linha bg-white p-0.5">
          {([["todos", "Todos"], ["aberto", "Em aberto"], ["vencido", "Vencidos"], ["pago", "Recebidos"]] as const).map(([k, r]) => (
            <button key={k} onClick={() => setFiltro(k)}
              className={`rounded-md px-3 py-1.5 text-[13px] ${filtro === k ? "bg-marinho-900 text-white" : "text-suave hover:text-tinta"}`}>{r}</button>
          ))}
        </div>
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-linha bg-white px-3 py-2 focus-within:border-ciano sm:max-w-xs">
          <Search className="size-4 text-suave" /><span className="sr-only">Buscar</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou descrição" className="w-full bg-transparent text-[14px] outline-none" />
        </label>
      </div>

      {erro && <p role="alert" className="mb-4 rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p>}

      <Bloco>
        {lista === null ? <Vazio>Carregando…</Vazio> : !lista.length ? <Vazio>Nenhum título neste filtro.</Vazio> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[14px]">
              <thead>
                <tr className="border-b border-linha text-left text-[12px] text-suave">
                  <th className="px-5 py-3 font-medium">{filtro === "pago" ? "Recebido em" : "Vencimento"}</th>
                  <th className="px-3 py-3 font-medium">Cliente / descrição</th>
                  <th className="px-3 py-3 font-medium">Parcela</th>
                  <th className="px-3 py-3 font-medium">Forma</th>
                  <th className="px-3 py-3 text-right font-medium">Valor</th>
                  <th className="px-3 py-3 font-medium">Situação</th>
                  <th className="px-5 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {lista.map((t) => {
                  const s = situacao(t);
                  return (
                    <tr key={t.id} className="align-top hover:bg-fundo/50">
                      <td className="num px-5 py-3 whitespace-nowrap">{formatarData(filtro === "pago" && t.pago_em ? t.pago_em : t.vencimento)}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{t.cliente !== "—" ? t.cliente : t.descricao}</div>
                        <div className="text-[12px] text-suave">
                          {t.cliente !== "—" && t.descricao !== t.cliente ? t.descricao : ""}
                          {t.nota && !t.descricao.includes(t.nota) ? ` · NF ${t.nota}` : ""}
                          {t.comissoes.length ? ` · comissão: ${t.comissoes.map((c) => `${c.nome.split(" ")[0]} ${c.percentual}%`).join(", ")}` : ""}
                        </div>
                        {t.cobrancas > 0 && <div className="text-[12px] text-atencao">Cobrado {t.cobrancas}× · último em {formatarData(t.cobrado_em!.slice(0, 10))}</div>}
                      </td>
                      <td className="px-3 py-3 text-suave">{t.parcela ?? "—"}</td>
                      <td className="px-3 py-3 capitalize text-suave">{t.forma ?? "—"}</td>
                      <td className="num px-3 py-3 text-right font-semibold whitespace-nowrap">
                        {formatarReais(t.valor_pago ?? t.valor)}
                        {t.valor_pago !== null && t.valor_pago !== t.valor && <div className="text-[11px] font-normal text-suave">previsto {formatarReais(t.valor)}</div>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Selo status={s} />
                        {t.pago_em && filtro !== "pago" && <div className="mt-0.5 text-[11px] text-suave">em {formatarData(t.pago_em)}</div>}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {t.status === "aberto" ? (
                            <>
                              <button onClick={() => setCobrar(t)} className={botaoSecundario + " px-2.5 py-1.5 text-[13px]"} title="Cobrar pelo WhatsApp"><MessageCircle className="size-3.5" /> Cobrar</button>
                              <button onClick={() => setBaixa(t)} className={botaoPrimario + " px-2.5 py-1.5 text-[13px]"}><CheckCircle2 className="size-3.5" /> Receber</button>
                            </>
                          ) : (
                            <button onClick={async () => {
                              if (!confirm(`Estornar o recebimento de ${formatarReais(t.valor_pago ?? t.valor)}? O título volta para "em aberto".`)) return;
                              try { await estornarBaixa(t.id); carregar(); } catch (e) { alert(mensagemErro(e)); }
                            }} className={botaoSecundario + " px-2.5 py-1.5 text-[13px]"}><Undo2 className="size-3.5" /> Estornar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-linha bg-fundo/60 text-[13px]">
                  <td className="px-5 py-3 text-suave" colSpan={4}>{lista.length} títulos</td>
                  <td className="num px-3 py-3 text-right font-semibold">{formatarReais(lista.reduce((a, t) => a + (t.valor_pago ?? t.valor), 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Bloco>

      <ModalBaixa titulo={baixa} onFechar={() => setBaixa(null)} onFeito={() => { setBaixa(null); carregar(); }} />
      <ModalCobrar titulo={cobrar} onFechar={() => setCobrar(null)} onFeito={() => { setCobrar(null); carregar(); }} />
      <ModalNovo aberto={novo} onFechar={() => setNovo(false)} onFeito={() => { setNovo(false); carregar(); }} />
    </>
  );
}

function ModalBaixa({ titulo, onFechar, onFeito }: { titulo: Titulo | null; onFechar: () => void; onFeito: () => void }) {
  const [data, setData] = useState(hojeIso());
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (titulo) { setData(hojeIso()); setValor(titulo.valor.toFixed(2)); setErro(""); } }, [titulo]);
  const v = Number(valor.replace(",", "."));
  return (
    <Modal titulo="Registrar recebimento" aberto={!!titulo} onFechar={onFechar}>
      {titulo && (
        <form onSubmit={async (e) => {
          e.preventDefault(); setSalvando(true); setErro("");
          try { await baixarTitulo(titulo.id, data, v); onFeito(); } catch (er) { setErro(mensagemErro(er)); } finally { setSalvando(false); }
        }} className="space-y-4">
          <div className="rounded-lg bg-fundo px-4 py-3 text-[14px]">
            <div className="font-medium">{titulo.cliente !== "—" ? titulo.cliente : titulo.descricao}</div>
            <div className="text-suave">{titulo.descricao} · vence {formatarData(titulo.vencimento)} · {formatarReais(titulo.valor)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Recebido em"><input type="date" required max={hojeIso()} value={data} onChange={(e) => setData(e.target.value)} className={estiloInput} /></Campo>
            <Campo rotulo="Valor recebido (R$)"><input inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} className={estiloInput + " num"} /></Campo>
          </div>
          {v > 0 && Math.abs(v - titulo.valor) > 0.005 && (
            <p className="rounded-lg bg-atencao-claro px-3 py-2 text-[13px] text-atencao">
              Valor diferente do previsto ({v > titulo.valor ? "+" : ""}{formatarReais(v - titulo.valor)}). Juros, desconto ou pagamento parcial? Confira antes de salvar.
            </p>
          )}
          {titulo.comissoes.length > 0 && v > 0 && (
            <p className="text-[13px] text-suave">Comissões geradas: {titulo.comissoes.map((c) => `${c.nome} ${formatarReais(Math.round(v * c.percentual) / 100)}`).join(" · ")}</p>
          )}
          {erro && <p role="alert" className="rounded-lg bg-erro-claro px-3 py-2 text-[13px] text-erro">{erro}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onFechar} className={botaoSecundario}>Cancelar</button>
            <button disabled={salvando || !(v > 0)} className={botaoPrimario}>{salvando ? "Salvando…" : "Confirmar recebimento"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ModalCobrar({ titulo, onFechar, onFeito }: { titulo: Titulo | null; onFechar: () => void; onFeito: () => void }) {
  const [tel, setTel] = useState("");
  const [msg, setMsg] = useState("");
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!titulo) return;
    setTel(titulo.telefone ?? "");
    const vencido = titulo.vencimento < hojeIso();
    const nome = titulo.cliente !== "—" ? titulo.cliente.split(" ")[0] : "";
    const qual = titulo.parcela && /\d+\/\d+/.test(titulo.parcela) ? `a parcela ${titulo.parcela}` : "o pagamento";
    setMsg(
      `Olá${nome ? ` ${nome.charAt(0) + nome.slice(1).toLowerCase()}` : ""}, tudo bem? Aqui é da BRA Ambientes Inteligentes.\n\n` +
      (vencido
        ? `Identificamos em aberto ${qual} de ${formatarReais(titulo.valor)}, com vencimento em ${formatarData(titulo.vencimento)} (${titulo.descricao}). Poderia nos confirmar a previsão de pagamento?`
        : `Passando para lembrar ${qual === "o pagamento" ? "do pagamento" : "da parcela " + titulo.parcela} de ${formatarReais(titulo.valor)}, com vencimento em ${formatarData(titulo.vencimento)} (${titulo.descricao}).`) +
      (titulo.linha_digitavel ? `\n\nLinha digitável do boleto:\n${titulo.linha_digitavel}` : "") +
      `\n\nQualquer dúvida, estamos à disposição. Obrigado!`,
    );
  }, [titulo]);
  const digitos = tel.replace(/\D/g, "");
  const numero = digitos.length >= 10 && !digitos.startsWith("55") ? "55" + digitos : digitos;
  return (
    <Modal titulo="Cobrar pelo WhatsApp" aberto={!!titulo} onFechar={onFechar} largura="max-w-xl">
      {titulo && (
        <div className="space-y-4">
          <Campo rotulo="WhatsApp do cliente (com DDD)">
            <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(19) 99999-9999" className={estiloInput + " num"} />
          </Campo>
          {!titulo.telefone && <p className="-mt-2 text-[12px] text-suave">O número fica salvo no cadastro do cliente para as próximas cobranças.</p>}
          <Campo rotulo="Mensagem (pode editar)"><textarea rows={9} value={msg} onChange={(e) => setMsg(e.target.value)} className={estiloInput} /></Campo>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { navigator.clipboard.writeText(msg); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }} className={botaoSecundario}>
              {copiado ? <><Check className="size-4 text-ok" /> Copiada</> : <><Copy className="size-4" /> Copiar mensagem</>}
            </button>
            <button disabled={numero.length < 12} onClick={async () => {
              window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
              try { await registrarCobranca(titulo.id, titulo.cliente_id, titulo.telefone ? null : tel); } catch { /* a cobrança já foi aberta */ }
              onFeito();
            }} className={botaoPrimario}><MessageCircle className="size-4" /> Abrir no WhatsApp</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ModalNovo({ aberto, onFechar, onFeito }: { aberto: boolean; onFechar: () => void; onFeito: () => void }) {
  const vazio = { cliente_id: "", cliente_nome: "", descricao: "", valor_total: "", parcelas: "1", primeiro_vencimento: hojeIso(), forma: "pix", conta: "" };
  const [f, setF] = useState(vazio);
  const [coms, setComs] = useState<{ comissionado_id: string; percentual: string }[]>([]);
  const [lista, setLista] = useState<Comissionado[]>([]);
  const [sugestoes, setSugestoes] = useState<{ id: string; nome: string }[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (aberto) { setF(vazio); setComs([]); setErro(""); listarComissionados().then(setLista).catch(() => {}); } }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => !f.cliente_id && buscarClientes(f.cliente_nome).then(setSugestoes), 250); return () => clearTimeout(t); }, [f.cliente_nome, f.cliente_id]);
  const total = Number(f.valor_total.replace(/\./g, "").replace(",", "."));
  const n = Math.max(1, Number(f.parcelas) || 1);
  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Modal titulo="Novo lançamento a receber" aberto={aberto} onFechar={onFechar} largura="max-w-2xl">
      <form onSubmit={async (e) => {
        e.preventDefault(); setSalvando(true); setErro("");
        try {
          await criarLancamento({ ...f, valor_total: total.toFixed(2), parcelas: n,
            comissoes: coms.filter((c) => c.comissionado_id && Number(c.percentual) > 0).map((c) => ({ comissionado_id: c.comissionado_id, percentual: Number(c.percentual.replace(",", ".")) })) });
          onFeito();
        } catch (er) { setErro(mensagemErro(er)); } finally { setSalvando(false); }
      }} className="space-y-4">
        <div className="relative">
          <Campo rotulo="Cliente">
            <input required value={f.cliente_nome} onChange={(e) => setF({ ...f, cliente_nome: e.target.value, cliente_id: "" })} placeholder="Digite para buscar ou cadastrar" className={estiloInput} />
          </Campo>
          {f.cliente_id && <span className="absolute top-8 right-3 text-[12px] text-ok">cliente existente</span>}
          {sugestoes.length > 0 && !f.cliente_id && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-linha bg-white shadow-lg">
              {sugestoes.map((s) => (
                <li key={s.id}><button type="button" onClick={() => { setF({ ...f, cliente_id: s.id, cliente_nome: s.nome }); setSugestoes([]); }}
                  className="w-full px-3 py-2 text-left text-[14px] hover:bg-fundo">{s.nome}</button></li>
              ))}
            </ul>
          )}
        </div>
        <Campo rotulo="Descrição"><input required value={f.descricao} onChange={set("descricao")} placeholder="Ex.: Quinta da Baronesa — automação" className={estiloInput} /></Campo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo rotulo="Valor total (R$)"><input required inputMode="decimal" value={f.valor_total} onChange={set("valor_total")} className={estiloInput + " num"} /></Campo>
          <Campo rotulo="Parcelas"><input type="number" min={1} max={120} value={f.parcelas} onChange={set("parcelas")} className={estiloInput + " num"} /></Campo>
          <Campo rotulo="1º vencimento"><input type="date" required value={f.primeiro_vencimento} onChange={set("primeiro_vencimento")} className={estiloInput} /></Campo>
          <Campo rotulo="Forma">
            <select value={f.forma} onChange={set("forma")} className={estiloInput}>
              <option value="pix">Pix</option><option value="boleto">Boleto</option><option value="transferencia">Transferência</option><option value="cartao">Cartão</option>
            </select>
          </Campo>
        </div>
        <Campo rotulo="Conta de recebimento (opcional)"><input value={f.conta} onChange={set("conta")} placeholder="Ex.: Pix Fernando, Sicoob" className={estiloInput} /></Campo>
        {total > 0 && <p className="num text-[13px] text-suave">{n}× de {formatarReais(Math.round((total / n) * 100) / 100)}{n > 1 ? `, mensais a partir de ${formatarData(f.primeiro_vencimento)}` : ""}</p>}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] text-suave">Comissões sobre cada parcela recebida</span>
            <button type="button" onClick={() => setComs([...coms, { comissionado_id: "", percentual: "" }])} className="text-[13px] text-[#14708c] hover:underline">+ Adicionar</button>
          </div>
          {coms.map((c, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <select value={c.comissionado_id} onChange={(e) => setComs(coms.map((x, j) => (j === i ? { ...x, comissionado_id: e.target.value } : x)))} className={estiloInput}>
                <option value="">Escolha…</option>
                {lista.map((p) => <option key={p.id} value={p.id}>{p.nome} · {p.papel}</option>)}
              </select>
              <input placeholder="%" inputMode="decimal" value={c.percentual} onChange={(e) => setComs(coms.map((x, j) => (j === i ? { ...x, percentual: e.target.value } : x)))} className={estiloInput + " num w-24"} />
              <button type="button" onClick={() => setComs(coms.filter((_, j) => j !== i))} className="px-2 text-suave hover:text-erro" aria-label="Remover">✕</button>
            </div>
          ))}
        </div>
        {erro && <p role="alert" className="rounded-lg bg-erro-claro px-3 py-2 text-[13px] text-erro">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className={botaoSecundario}>Cancelar</button>
          <button disabled={salvando || !(total > 0)} className={botaoPrimario}>{salvando ? "Salvando…" : `Criar ${n > 1 ? n + " parcelas" : "lançamento"}`}</button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================================
function Faturamento() {
  const [g, setG] = useState<Granularidade>("mes");
  const [desloc, setDesloc] = useState(0);
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [ano, setAno] = useState<Nota[]>([]);
  const [erro, setErro] = useState("");
  const p = periodo(g, desloc);
  const pa = periodo("ano", 0, new Date(Number(p.de.slice(0, 4)), 5, 1));
  useEffect(() => { setNotas(null); listarNotas(p.de, p.ate).then(setNotas).catch((e) => setErro(mensagemErro(e))); }, [p.de, p.ate]);
  useEffect(() => { listarNotas(pa.de, pa.ate).then(setAno).catch(() => {}); }, [pa.de, pa.ate]);
  const soma = (l: Nota[], c?: string) => l.filter((x) => !c || x.categoria === c).reduce((a, x) => a + x.valor, 0);
  const meses = Array.from({ length: 12 }, (_, i) => {
    const m = `${pa.de.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`;
    const l = ano.filter((x) => x.emitida_em.slice(0, 7) === m);
    return { m, material: soma(l, "material"), servico: soma(l, "servico") };
  });
  const max = Math.max(1, ...meses.map((m) => m.material + m.servico));
  const nomes = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  return (
    <>
      <div className="mb-5"><Navegador g={g} setG={setG} desloc={desloc} setDesloc={setDesloc} rotulo={p.rotulo} /></div>
      {erro && <p role="alert" className="mb-4 rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao rotulo="Faturado" valor={soma(notas ?? [])} detalhe={`${notas?.length ?? 0} notas`} />
        <Cartao rotulo="Material" valor={soma(notas ?? [], "material")} tom="ciano" />
        <Cartao rotulo="Serviço" valor={soma(notas ?? [], "servico")} tom="atencao" />
        <Cartao rotulo={`Acumulado ${pa.rotulo}`} valor={soma(ano)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Bloco titulo={`Faturamento mês a mês · ${pa.rotulo}`} extra={<span className="flex gap-3 text-[12px] text-suave"><span><i className="mr-1 inline-block size-2 rounded-full bg-marinho-800" />Material</span><span><i className="mr-1 inline-block size-2 rounded-full bg-ciano" />Serviço</span></span>}>
          <div className="flex h-56 items-end gap-1.5 px-5 pt-6 pb-3">
            {meses.map((m, i) => (
              <div key={m.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${m.m}: ${formatarReais(m.material + m.servico)}`}>
                <div className="flex w-full max-w-9 flex-col justify-end" style={{ height: `${((m.material + m.servico) / max) * 100}%` }}>
                  <div className="rounded-t bg-ciano" style={{ height: `${(m.servico / Math.max(1, m.material + m.servico)) * 100}%` }} />
                  <div className={`bg-marinho-800 ${m.servico ? "" : "rounded-t"}`} style={{ height: `${(m.material / Math.max(1, m.material + m.servico)) * 100}%` }} />
                </div>
                <span className="text-[11px] text-suave">{nomes[i]}</span>
              </div>
            ))}
          </div>
        </Bloco>
        <Bloco titulo="Notas do período">
          {notas === null ? <Vazio>Carregando…</Vazio> : !notas.length ? <Vazio>Nenhuma nota neste período.</Vazio> : (
            <ul className="max-h-80 divide-y divide-linha overflow-y-auto">
              {notas.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">NF {x.numero} · <span className="font-normal text-suave">{x.cliente}</span></div>
                    <div className="text-[12px] text-suave">{formatarData(x.emitida_em)} · {x.categoria === "servico" ? "Serviço" : "Material"}{x.origem === "legado" ? " · lançada no sistema anterior" : ""}</div>
                  </div>
                  <span className="num text-[14px] font-semibold">{formatarReais(x.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>
    </>
  );
}

// =====================================================================
function Comissoes() {
  const [g, setG] = useState<Granularidade>("mes");
  const [desloc, setDesloc] = useState(0);
  const [linhas, setLinhas] = useState<ComissaoLinha[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const p = periodo(g, desloc);
  const carregar = useCallback(() => { setLinhas(null); listarComissoes(p.de, p.ate).then(setLinhas).catch((e) => setErro(mensagemErro(e))); }, [p.de, p.ate]);
  useEffect(carregar, [carregar]);

  const grupos = useMemo(() => {
    const m = new Map<string, { chave: string; id: string; nome: string; papel: string; mes: string; base: number; valor: number; fechado: string | null; itens: ComissaoLinha[] }>();
    for (const l of linhas ?? []) {
      const k = `${l.comissionado_id}|${l.mes}`;
      const gr = m.get(k) ?? { chave: k, id: l.comissionado_id, nome: l.comissionado, papel: l.papel, mes: l.mes, base: 0, valor: 0, fechado: l.fechado_em, itens: [] };
      gr.base += l.base; gr.valor += l.valor; gr.itens.push(l);
      m.set(k, gr);
    }
    return [...m.values()].sort((a, b) => b.mes.localeCompare(a.mes) || b.valor - a.valor);
  }, [linhas]);
  const aFechar = grupos.filter((x) => !x.fechado).reduce((a, x) => a + x.valor, 0);
  const fechado = grupos.filter((x) => x.fechado).reduce((a, x) => a + x.valor, 0);
  const mesNome = (iso: string) => { const t = new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };

  return (
    <>
      <div className="mb-5"><Navegador g={g} setG={setG} desloc={desloc} setDesloc={setDesloc} rotulo={p.rotulo} /></div>
      <p className="-mt-2 mb-5 max-w-2xl text-[13px] text-suave">A comissão é calculada sobre cada parcela efetivamente recebida, no mês do recebimento. Depois de fechado, o mês fica travado: recebimentos e estornos naquele mês exigem reabrir o fechamento.</p>
      {erro && <p role="alert" className="mb-4 rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Cartao rotulo="Comissões do período" valor={aFechar + fechado} />
        <Cartao rotulo="A fechar" valor={aFechar} tom={aFechar ? "atencao" : "tinta"} />
        <Cartao rotulo="Fechadas / pagas" valor={fechado} tom="ok" />
      </div>
      <Bloco>
        {linhas === null ? <Vazio>Carregando…</Vazio> : !grupos.length ? <Vazio>Nenhuma comissão gerada neste período.</Vazio> : (
          <ul className="divide-y divide-linha">
            {grupos.map((gr) => (
              <li key={gr.chave}>
                <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <button onClick={() => setAberto(aberto === gr.chave ? null : gr.chave)} className="min-w-0 basis-full text-left sm:basis-0 sm:flex-1">
                    <div className="text-[14px] font-medium">{gr.nome} <span className="font-normal text-suave">· {gr.papel}</span></div>
                    <div className="text-[12px] text-suave">{mesNome(gr.mes)} · {gr.itens.length} {gr.itens.length === 1 ? "parcela" : "parcelas"} · base {formatarReais(gr.base)}</div>
                  </button>
                  <span className="num mr-auto font-display text-[17px] font-semibold sm:mr-0">{formatarReais(gr.valor)}</span>
                  {gr.fechado ? (
                    <span className="flex items-center gap-2">
                      <span className="rounded-full bg-ok-claro px-2.5 py-0.5 text-[12px] font-medium text-ok">Fechada em {formatarData(gr.fechado)}</span>
                      <button onClick={async () => {
                        if (!confirm(`Reabrir a comissão de ${gr.nome} em ${mesNome(gr.mes)}?`)) return;
                        try { await reabrirComissao(gr.id, gr.mes); carregar(); } catch (e) { alert(mensagemErro(e)); }
                      }} className="text-[12px] text-suave underline">Reabrir</button>
                    </span>
                  ) : (
                    <button onClick={async () => {
                      if (!confirm(`Fechar ${formatarReais(gr.valor)} de comissão de ${gr.nome} (${mesNome(gr.mes)}) como pago hoje?`)) return;
                      try { await fecharComissao(gr.id, gr.mes, Math.round(gr.valor * 100) / 100); carregar(); } catch (e) { alert(mensagemErro(e)); }
                    }} className={botaoPrimario + " px-3 py-1.5 text-[13px]"}>Fechar e marcar pago</button>
                  )}
                </div>
                {aberto === gr.chave && (
                  <div className="overflow-x-auto border-t border-linha bg-fundo/50 px-5 py-2">
                    <table className="w-full min-w-[560px] text-[13px]">
                      <tbody>
                        {gr.itens.map((l) => (
                          <tr key={l.titulo_id} className="border-b border-linha last:border-0">
                            <td className="num py-2 pr-3 text-suave">{formatarData(l.pago_em)}</td>
                            <td className="py-2 pr-3">{l.cliente ?? l.descricao}<div className="text-[12px] text-suave">{l.descricao}</div></td>
                            <td className="num py-2 pr-3 text-right text-suave">{formatarReais(l.base)} × {l.percentual}%</td>
                            <td className="num py-2 text-right font-medium">{formatarReais(l.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Bloco>
    </>
  );
}

// =====================================================================
export function ConteudoFinanceiro({ app = "nucleo" }: { app?: App }) {
  const params = useSearchParams();
  const router = useRouter();
  const aba = (params.get("aba") as Aba) || "recebimentos";
  const base = app === "financeiro" ? "/fin/" : "/financeiro/";
  const itensFin = [
    ...ABAS.map(([k, r]) => ({ href: `/fin/?aba=${k}`, rotulo: r, icone: { recebimentos: CheckCircle2, faturamento: Receipt, comissoes: Percent }[k] })),
    { grupo: "BRA Ambientes" },
    { href: "/", rotulo: "Abrir o Núcleo", icone: LayoutDashboard },
  ];
  const nomes = Object.fromEntries(ABAS) as Record<Aba, string>;
  return (
    <Shell titulo={app === "financeiro" ? nomes[aba] : "Financeiro"} app={app}
      itens={app === "financeiro" ? itensFin : undefined} ativoHref={app === "financeiro" ? `/fin/?aba=${aba}` : undefined}>
      {app === "nucleo" && (
        <div className="-mt-2 mb-6 flex gap-1 border-b border-linha" role="tablist">
          {ABAS.map(([k, r]) => (
            <button key={k} role="tab" aria-selected={aba === k} onClick={() => router.replace(`${base}?aba=${k}`)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] ${aba === k ? "border-br font-medium text-tinta" : "border-transparent text-suave hover:text-tinta"}`}>{r}</button>
          ))}
        </div>
      )}
      {aba === "recebimentos" && <Recebimentos />}
      {aba === "faturamento" && <Faturamento />}
      {aba === "comissoes" && <Comissoes />}
    </Shell>
  );
}
