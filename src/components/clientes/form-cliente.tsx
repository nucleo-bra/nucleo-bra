"use client";
import { useState } from "react";
import { Botao, campo, Janela, Rotulo } from "@/components/crm/ui";
import { arquivarCliente, buscarCep, Cliente, enderecoLinha, gravarCliente } from "@/lib/clientes";
import { formatarDocumento } from "@/lib/contratos";
import { mensagemErro } from "@/lib/supabase";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

/** Campos do cliente (usados na janela de edição). */
export function CamposCliente({ c, setC }: { c: Partial<Cliente>; setC: (c: Partial<Cliente>) => void }) {
  const s = (k: keyof Cliente) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setC({ ...c, [k]: ev.target.value });
  const pj = (c.documento ?? "").replace(/\D/g, "").length === 14 || c.tipo === "PJ";
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Rotulo rotulo={pj ? "Razão social" : "Nome completo"} className="col-span-2"><input autoFocus className={campo} value={c.nome ?? ""} onChange={s("nome")} /></Rotulo>
      <Rotulo rotulo="CPF / CNPJ"><input className={campo} inputMode="numeric" value={formatarDocumento(c.documento ?? "")} onChange={(e) => setC({ ...c, documento: e.target.value.replace(/\D/g, "").slice(0, 14) })} /></Rotulo>
      {pj
        ? <Rotulo rotulo="Nome fantasia"><input className={campo} value={c.nome_fantasia ?? ""} onChange={s("nome_fantasia")} /></Rotulo>
        : <Rotulo rotulo="Data de nascimento"><input className={campo} type="date" value={c.data_nascimento ?? ""} onChange={s("data_nascimento")} /></Rotulo>}
      <Rotulo rotulo="E-mail" className="col-span-2"><input className={campo} type="email" value={c.email ?? ""} onChange={s("email")} /></Rotulo>
      <Rotulo rotulo="Telefone / WhatsApp"><input className={campo} value={c.telefone ?? ""} onChange={s("telefone")} placeholder="(19) 99999-9999" /></Rotulo>
      {pj ? <Rotulo rotulo="Inscrição municipal"><input className={campo} value={c.inscricao_municipal ?? ""} onChange={s("inscricao_municipal")} /></Rotulo> : <div />}
      <Rotulo rotulo="CEP"><input className={campo} inputMode="numeric" value={c.cep ?? ""} onChange={s("cep")}
        onBlur={async () => { const e = await buscarCep(c.cep ?? ""); if (e) setC({ ...c, ...Object.fromEntries(Object.entries(e).filter(([, v]) => v)) }); }} placeholder="13140-000" /></Rotulo>
      <Rotulo rotulo="Rua / avenida" className="col-span-1 sm:col-span-2"><input className={campo} value={c.logradouro ?? ""} onChange={s("logradouro")} /></Rotulo>
      <Rotulo rotulo="Número"><input className={campo} value={c.numero ?? ""} onChange={s("numero")} /></Rotulo>
      <Rotulo rotulo="Complemento"><input className={campo} value={c.complemento ?? ""} onChange={s("complemento")} /></Rotulo>
      <Rotulo rotulo="Bairro"><input className={campo} value={c.bairro ?? ""} onChange={s("bairro")} /></Rotulo>
      <Rotulo rotulo="Cidade"><input className={campo} value={c.cidade ?? ""} onChange={s("cidade")} /></Rotulo>
      <Rotulo rotulo="UF"><select className={campo} value={c.uf ?? ""} onChange={s("uf")}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Rotulo>
      {enderecoLinha(c) && <p className="col-span-2 text-[12px] text-suave sm:col-span-4">No contrato: <b className="text-tinta">{enderecoLinha(c)}</b></p>}
      <Rotulo rotulo="Observações" className="col-span-2 sm:col-span-4"><textarea className={campo} rows={2} value={c.observacoes ?? ""} onChange={s("observacoes")} /></Rotulo>
    </div>
  );
}

export function FormCliente({ inicial, onFechar, onSalvo, onArquivado }: {
  inicial: Partial<Cliente>; onFechar: () => void; onSalvo: (c: Cliente) => void; onArquivado?: () => void;
}) {
  const [c, setC] = useState<Partial<Cliente>>(inicial);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false), [confirmar, setConfirmar] = useState(false);
  async function rodar(f: () => Promise<void>) {
    setErro(""); setOcupado(true);
    try { await f(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  return (
    <Janela titulo={inicial.id ? "Editar cliente" : "Novo cliente"} aberto onFechar={onFechar} largura="max-w-3xl"
      rodape={<>
        <Botao tipo="pri" disabled={ocupado || !c.nome?.trim()} onClick={() => rodar(async () => onSalvo(await gravarCliente(c)))}>{ocupado ? "Salvando…" : "Salvar"}</Botao>
        <Botao onClick={onFechar}>Cancelar</Botao>
        {inicial.id && onArquivado && (confirmar
          ? <Botao tipo="perigo" className="ml-auto" onClick={() => rodar(async () => { await arquivarCliente(inicial.id!); onArquivado(); })}>Confirmar: arquivar</Botao>
          : <Botao tipo="leve" className="ml-auto text-suave" onClick={() => setConfirmar(true)}>Arquivar cliente</Botao>)}
        {erro && <p role="alert" className="w-full rounded-lg bg-erro-claro px-3 py-2 text-[13px] text-erro">{erro}</p>}
      </>}>
      <CamposCliente c={c} setC={setC} />
    </Janela>
  );
}
