"use client";
import { useEffect, useMemo, useState } from "react";
import { Botao, campo, Janela, reais, Rotulo } from "@/components/crm/ui";
import { carregarCrm, Negocio, Parceiro } from "@/lib/crm";
import {
  condicoesPagamento, ConfigContratos, Contrato, cronograma, dataTxt, formatarDocumento, parcelasFinanceiro, sugerirNumero,
} from "@/lib/contratos";
import { mensagemErro, supabase } from "@/lib/supabase";

type Cliente = { id: string; nome: string; documento: string | null; email: string | null; telefone: string | null; endereco: string };

function useEnvio() {
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  async function rodar(f: () => Promise<void>) {
    setErro(""); setOcupado(true);
    try { await f(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  return { erro, ocupado, rodar };
}
const Erro = ({ m }: { m: string }) => m ? <p role="alert" className="w-full rounded-lg bg-erro-claro px-3 py-2 text-[13px] text-erro">{m}</p> : null;

async function carregarClientes(): Promise<Cliente[]> {
  const { data } = await supabase().from("clientes").select("id, nome, documento, email, telefone, logradouro, numero, complemento, bairro, cidade, uf, cep").eq("ativo", true).order("nome");
  return (data ?? []).map((c) => ({
    id: c.id, nome: c.nome, documento: c.documento, email: c.email, telefone: c.telefone,
    endereco: [[c.logradouro, c.numero].filter(Boolean).join(", "), c.complemento, c.bairro && "Bairro " + c.bairro, [c.cidade, c.uf].filter(Boolean).join(" – "), c.cep && "CEP " + c.cep].filter(Boolean).join(" – "),
  }));
}

// ------------------------------------------------------------------ contrato (novo / editar)
export function FormContrato({ inicial, cfg, onFechar, onSalvar, onExcluir }: {
  inicial: Partial<Contrato> & { negocio_id?: string }; cfg: ConfigContratos;
  onFechar: () => void; onSalvar: (x: Partial<Contrato>) => Promise<void>; onExcluir?: () => Promise<void>;
}) {
  const novo = !inicial.id;
  const hoje = new Date().toISOString().slice(0, 10);
  const [x, setX] = useState<Partial<Contrato>>({
    data_contrato: hoje, entrada: 0, parcelas: 0, valor: 0, entrada_vencimento: hoje, ...inicial,
  });
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const e = useEnvio();

  useEffect(() => {
    carregarCrm().then((c) => {
      setNegocios(c.negocios.filter((n) => n.etapa !== "perdido")); setParceiros(c.parceiros);
      if (inicial.negocio_id) { const n = c.negocios.find((k) => k.id === inicial.negocio_id); if (n) aplicarNegocio(n); }
    }).catch(() => {});
    carregarClientes().then(setClientes).catch(() => {});
    if (novo && !inicial.numero) sugerirNumero().then((numero) => setX((v) => ({ ...v, numero: v.numero || numero }))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicarNegocio(n: Negocio) {
    setX((v) => ({ ...v, oportunidade_id: n.id, cliente_id: n.cliente_id ?? v.cliente_id ?? null, cliente_nome: n.cliente_nome || v.cliente_nome, unidade: v.unidade || n.titulo, valor: n.valor_estimado || v.valor }));
  }
  function aplicarCliente(c: Cliente) {
    setX((v) => ({ ...v, cliente_id: c.id, cliente_nome: c.nome, cliente_documento: c.documento ?? "", cliente_email: c.email ?? v.cliente_email ?? "", cliente_telefone: c.telefone ?? "", cliente_endereco: c.endereco || v.cliente_endereco }));
  }
  const s = (k: keyof Contrato) => (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setX({ ...x, [k]: ev.target.type === "number" ? (ev.target.value === "" ? 0 : Number(ev.target.value)) : ev.target.value });
  const prev = useMemo(() => (x.valor ? condicoesPagamento(x as Contrato) : []), [x]);
  const restante = Math.max(0, (Number(x.valor) || 0) - (Number(x.entrada) || 0));
  const negocio = negocios.find((n) => n.id === x.oportunidade_id);
  void parceiros;

  return (
    <Janela titulo={novo ? "Novo contrato" : `Editar contrato ${x.numero ?? ""}`} aberto onFechar={onFechar} largura="max-w-3xl"
      rodape={<>
        <Botao tipo="pri" disabled={e.ocupado || !x.cliente_nome?.trim() || !(Number(x.valor) > 0) || !x.numero?.trim()} onClick={() => e.rodar(() => onSalvar(x))}>{e.ocupado ? "Salvando…" : novo ? "Criar contrato" : "Salvar"}</Botao>
        <Botao onClick={onFechar}>Cancelar</Botao>
        {onExcluir && (confirmar
          ? <Botao tipo="perigo" className="ml-auto" onClick={() => e.rodar(onExcluir)}>Confirmar exclusão</Botao>
          : <Botao tipo="leve" className="ml-auto text-erro" onClick={() => setConfirmar(true)}>Excluir</Botao>)}
        <Erro m={e.erro} />
      </>}>
      {novo && (
        <div className="mb-4 grid gap-3 rounded-2xl bg-fundo p-3 sm:grid-cols-2">
          <Rotulo rotulo="Puxar de um negócio do CRM">
            <select className={campo} value={x.oportunidade_id ?? ""} onChange={(ev) => { const n = negocios.find((k) => k.id === ev.target.value); if (n) aplicarNegocio(n); else setX({ ...x, oportunidade_id: null }); }}>
              <option value="">— nenhum —</option>
              {negocios.map((n) => <option key={n.id} value={n.id}>{n.cliente_nome ? n.cliente_nome + " · " : ""}{n.titulo} ({reais(n.valor_estimado)})</option>)}
            </select>
          </Rotulo>
          <Rotulo rotulo="Puxar dados de um cliente cadastrado">
            <select className={campo} value={x.cliente_id ?? ""} onChange={(ev) => { const c = clientes.find((k) => k.id === ev.target.value); if (c) aplicarCliente(c); else setX({ ...x, cliente_id: null }); }}>
              <option value="">— nenhum —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.documento ? " · " + formatarDocumento(c.documento) : ""}</option>)}
            </select>
          </Rotulo>
        </div>
      )}
      {!novo && negocio && <p className="mb-3 text-[13px] text-suave">Vinculado ao negócio <b>{negocio.titulo}</b> do CRM.</p>}

      <h3 className="mb-2 text-[12px] font-bold tracking-wide text-suave uppercase">Contrato</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Rotulo rotulo="Nº do contrato"><input className={campo} value={x.numero ?? ""} onChange={s("numero")} /></Rotulo>
        <Rotulo rotulo="Data do contrato"><input className={campo} type="date" value={x.data_contrato ?? ""} onChange={s("data_contrato")} /></Rotulo>
        <Rotulo rotulo="Unidade / obra" className="col-span-2"><input className={campo} value={x.unidade ?? ""} onChange={s("unidade")} placeholder="Ex.: Jangadinha Campinas" /></Rotulo>
      </div>

      <h3 className="mt-5 mb-2 text-[12px] font-bold tracking-wide text-suave uppercase">Cliente</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Rotulo rotulo="Nome completo / razão social" className="col-span-2"><input className={campo} value={x.cliente_nome ?? ""} onChange={s("cliente_nome")} /></Rotulo>
        <Rotulo rotulo="CPF / CNPJ"><input className={campo} value={formatarDocumento(x.cliente_documento ?? "")} onChange={(ev) => setX({ ...x, cliente_documento: ev.target.value.replace(/[^\d]/g, "").slice(0, 14) })} inputMode="numeric" /></Rotulo>
        <Rotulo rotulo="Telefone"><input className={campo} value={x.cliente_telefone ?? ""} onChange={s("cliente_telefone")} /></Rotulo>
        <Rotulo rotulo="E-mail" className="col-span-2"><input className={campo} type="email" value={x.cliente_email ?? ""} onChange={s("cliente_email")} placeholder="cliente@email.com" /></Rotulo>
        <Rotulo rotulo="Endereço completo" className="col-span-2"><input className={campo} value={x.cliente_endereco ?? ""} onChange={s("cliente_endereco")} placeholder="Rua, nº – Bairro, Cidade – UF CEP" /></Rotulo>
      </div>

      <h3 className="mt-5 mb-2 text-[12px] font-bold tracking-wide text-suave uppercase">Pagamento</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Rotulo rotulo="Valor total (R$)"><input className={campo} type="number" step="any" min={0} value={x.valor ?? 0} onChange={s("valor")} /></Rotulo>
        <Rotulo rotulo="Entrada (R$)"><input className={campo} type="number" step="any" min={0} value={x.entrada ?? 0} onChange={s("entrada")} /></Rotulo>
        <Rotulo rotulo="Venc. entrada"><input className={campo} type="date" value={x.entrada_vencimento ?? ""} onChange={s("entrada_vencimento")} /></Rotulo>
        <Rotulo rotulo="Nº de parcelas"><input className={campo} type="number" min={0} max={120} value={x.parcelas ?? 0} onChange={s("parcelas")} /></Rotulo>
        <Rotulo rotulo="1ª parcela em"><input className={campo} type="date" value={x.primeiro_vencimento ?? ""} onChange={s("primeiro_vencimento")} disabled={!Number(x.parcelas)} /></Rotulo>
        <Rotulo rotulo="Forma de recebimento (sai no contrato)" className="col-span-2 sm:col-span-5">
          <textarea className={campo} rows={2} value={x.forma_pagamento ?? ""} onChange={s("forma_pagamento")} placeholder={cfg.forma_recebimento || "Banco – titular / chave pix"} />
        </Rotulo>
      </div>
      {prev.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-linha text-[13px]">
          <table className="w-full">
            <thead className="bg-marinho-900 text-left text-[12px] text-white"><tr><th className="px-3 py-1.5">Condição</th><th className="px-3 py-1.5">Valor</th><th className="px-3 py-1.5">Vencimento</th></tr></thead>
            <tbody>{prev.map((l, i) => <tr key={i} className="border-t border-linha"><td className="px-3 py-1.5">{l.condicao}</td><td className="num px-3 py-1.5 font-semibold">{l.valor}</td><td className="px-3 py-1.5">{l.vencimento}</td></tr>)}</tbody>
          </table>
          {Number(x.parcelas) > 0 && <p className="border-t border-linha bg-fundo px-3 py-1.5 text-[12px] text-suave">Saldo de {reais(restante)} em {x.parcelas}x. Sem data da 1ª parcela, ela vence 1 mês após a entrada.</p>}
        </div>
      )}
      <Rotulo rotulo="Observações internas (não saem no contrato)" className="mt-4"><textarea className={campo} rows={2} value={x.observacoes ?? ""} onChange={s("observacoes")} /></Rotulo>
    </Janela>
  );
}

// ------------------------------------------------------------------ lançar no Financeiro
export function FormLancarContrato({ contrato, usuario, onFechar, onConfirmar }: {
  contrato: Contrato; usuario: string; onFechar: () => void; onConfirmar: (itens: Record<string, unknown>[]) => Promise<void>;
}) {
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [parceiro, setParceiro] = useState<Parceiro | null>(null);
  const [f, setF] = useState({ forma: "Pix", conta: "", meu: usuario, pctMeu: 0, pctParc: 0 });
  const e = useEnvio();
  useEffect(() => {
    if (!contrato.oportunidade_id) return;
    carregarCrm().then((c) => {
      const n = c.negocios.find((k) => k.id === contrato.oportunidade_id) ?? null;
      setNegocio(n);
      const p = n ? c.parceiros.find((k) => k.id === n.parceiro_id) ?? null : null;
      setParceiro(p);
      if (n) setF((v) => ({ ...v, pctMeu: n.pct_vendedor, pctParc: n.pct_parceiro }));
    }).catch(() => {});
  }, [contrato.oportunidade_id]);
  const coms = useMemo(() => [
    { n: f.meu, r: "Vendedor", p: Number(f.pctMeu) || 0 },
    ...(parceiro ? [{ n: parceiro.nome, r: parceiro.tipo === "arquiteto" ? "Arquiteto" : "Parceiro", p: Number(f.pctParc) || 0 }] : []),
  ], [f, parceiro]);
  const itens = useMemo(() => parcelasFinanceiro(contrato, { forma: f.forma, conta: f.conta, comissoes: coms }), [contrato, f, coms]);
  const s = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: ev.target.value });
  const jaLancado = contrato.financeiro_lancado_em || negocio?.financeiro_lancado_em;
  return (
    <Janela titulo="Lançar no Financeiro" aberto onFechar={onFechar} largura="max-w-2xl"
      rodape={<>
        <Botao tipo="pri" disabled={e.ocupado || !itens.length} onClick={() => e.rodar(() => onConfirmar(itens))}>{e.ocupado ? "Lançando…" : `Lançar ${itens.length} parcela(s)`}</Botao>
        <Botao onClick={onFechar}>Cancelar</Botao>
        <Erro m={e.erro} />
      </>}>
      <p className="mb-3 text-[13px] text-suave">A entrada e as parcelas do contrato entram em <b>A receber</b> no Financeiro, com os comissionados — igual a um lançamento feito lá.</p>
      {jaLancado && <p className="mb-3 rounded-lg bg-atencao-claro px-3 py-2 text-[13px] text-atencao">Atenção: {contrato.financeiro_lancado_em ? "este contrato" : "o negócio do CRM ligado a ele"} já foi lançado em {dataTxt(String(jaLancado))}. Lançar de novo duplica as parcelas.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Rotulo rotulo="Forma"><select className={campo} value={f.forma} onChange={s("forma")}>{["Pix", "Boleto", "Cartão", "Transferência"].map((k) => <option key={k}>{k}</option>)}</select></Rotulo>
        <Rotulo rotulo="Conta (opcional)"><input className={campo} value={f.conta} onChange={s("conta")} /></Rotulo>
        <Rotulo rotulo="Vendedor"><input className={campo} value={f.meu} onChange={s("meu")} /></Rotulo>
        <Rotulo rotulo="% vendedor"><input className={campo} type="number" step="any" value={f.pctMeu} onChange={s("pctMeu")} /></Rotulo>
        {parceiro && <Rotulo rotulo={`% ${parceiro.nome}`}><input className={campo} type="number" step="any" value={f.pctParc} onChange={s("pctParc")} /></Rotulo>}
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-linha">
        <table className="w-full text-[13px]">
          <thead className="bg-fundo text-left text-[12px] text-suave"><tr><th className="px-3 py-2">Parcela</th><th className="px-3 py-2">Vencimento</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Comissões</th></tr></thead>
          <tbody>{cronograma(contrato).map((p, i) => (
            <tr key={i} className="border-t border-linha">
              <td className="px-3 py-1.5">{p.rotulo}</td><td className="num px-3 py-1.5">{dataTxt(p.venc)}</td>
              <td className="num px-3 py-1.5 text-right font-semibold">{reais(p.valor)}</td>
              <td className="px-3 py-1.5 text-suave">{coms.filter((c) => c.n && c.p).map((c) => `${c.n.split(" ")[0]} ${reais((p.valor * c.p) / 100)}`).join(" · ") || "—"}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </Janela>
  );
}
