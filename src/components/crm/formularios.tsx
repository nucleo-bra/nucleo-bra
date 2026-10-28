"use client";
import { useMemo, useState } from "react";
import { CalendarPlus, FileSignature, MapPin, Navigation, Trash2, Wallet } from "lucide-react";
import { gerarIcs } from "@/lib/ics";
import {
  Atividade, Crm, ETAPAS_NEGOCIO, ETAPAS_PARCEIRO, montarParcelas, Negocio, Parceiro, TIPOS_AGENDA, TIPOS_PARCEIRO, hoje, enderecoCompleto,
} from "@/lib/crm";
import { mensagemErro } from "@/lib/supabase";
import { Botao, campo, dataBr, Janela, reais, Rotulo } from "./ui";

type Base<T> = { crm: Crm; inicial: Partial<T>; onFechar: () => void; onSalvar: (x: Partial<T>) => Promise<void>; onExcluir?: () => Promise<void> };

function useEnvio() {
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  async function rodar(f: () => Promise<void>) {
    setErro(""); setOcupado(true);
    try { await f(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  return { erro, ocupado, rodar, confirmar, setConfirmar, falhar: setErro };
}
function Rodape({ e, onFechar, onSalvar, onExcluir, extra }: { e: ReturnType<typeof useEnvio>; onFechar: () => void; onSalvar: () => void; onExcluir?: () => Promise<void>; extra?: React.ReactNode }) {
  return (
    <>
      <Botao tipo="pri" onClick={onSalvar} disabled={e.ocupado}>{e.ocupado ? "Salvando…" : "Salvar"}</Botao>
      <Botao onClick={onFechar}>Cancelar</Botao>
      {extra}
      <span className="flex-1" />
      {onExcluir && (
        <Botao tipo="perigo" disabled={e.ocupado} onClick={() => (e.confirmar ? e.rodar(onExcluir) : e.setConfirmar(true))}>
          <Trash2 className="size-4" />{e.confirmar ? "Confirmar exclusão" : "Excluir"}
        </Botao>
      )}
      {e.erro && <p role="alert" className="w-full rounded-lg bg-erro-claro px-3 py-2 text-[13px] text-erro">{e.erro}</p>}
    </>
  );
}
const SelParceiro = ({ crm, valor, onChange }: { crm: Crm; valor: string | null | undefined; onChange: (v: string | null) => void }) => (
  <select className={campo} value={valor ?? ""} onChange={(e) => onChange(e.target.value || null)}>
    <option value="">— nenhum —</option>
    {crm.parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.escritorio ? ` · ${p.escritorio}` : ""}</option>)}
  </select>
);

// ------------------------------------------------------------------ parceiro
export function FormParceiro({ inicial, onFechar, onSalvar, onExcluir }: Base<Parceiro>) {
  const [x, setX] = useState<Partial<Parceiro>>({ tipo: "arquiteto", etapa: "ativo", comissao_padrao: 0, ...inicial });
  const e = useEnvio();
  const s = (k: keyof Parceiro) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setX({ ...x, [k]: ev.target.value });
  return (
    <Janela titulo={inicial.id ? "Editar parceiro" : "Novo parceiro"} aberto onFechar={onFechar}
      rodape={<Rodape e={e} onFechar={onFechar} onSalvar={() => e.rodar(() => onSalvar(x))} onExcluir={onExcluir} />}>
      <div className="grid grid-cols-2 gap-3">
        <Rotulo rotulo="Nome" className="col-span-2"><input className={campo} value={x.nome ?? ""} onChange={s("nome")} autoFocus /></Rotulo>
        <Rotulo rotulo="Tipo"><select className={campo} value={x.tipo} onChange={s("tipo")}>{TIPOS_PARCEIRO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Rotulo>
        <Rotulo rotulo="Etapa"><select className={campo} value={x.etapa} onChange={s("etapa")}>{ETAPAS_PARCEIRO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Rotulo>
        <Rotulo rotulo="Empresa / escritório" className="col-span-2"><input className={campo} value={x.escritorio ?? ""} onChange={s("escritorio")} /></Rotulo>
        <Rotulo rotulo="Telefone / WhatsApp"><input className={campo} inputMode="tel" value={x.telefone ?? ""} onChange={s("telefone")} /></Rotulo>
        <Rotulo rotulo="E-mail"><input className={campo} type="email" value={x.email ?? ""} onChange={s("email")} /></Rotulo>
        <Rotulo rotulo="Instagram"><input className={campo} value={x.instagram ?? ""} onChange={s("instagram")} /></Rotulo>
        <Rotulo rotulo="Cidade"><input className={campo} value={x.cidade ?? ""} onChange={s("cidade")} /></Rotulo>
        <Rotulo rotulo="Comissão padrão do parceiro (%)"><input className={campo} type="number" step="any" min={0} value={x.comissao_padrao ?? 0} onChange={(ev) => setX({ ...x, comissao_padrao: Number(ev.target.value) })} /></Rotulo>
        <Rotulo rotulo="Observações" className="col-span-2"><textarea className={campo} rows={3} value={x.observacoes ?? ""} onChange={s("observacoes")} /></Rotulo>
      </div>
    </Janela>
  );
}

// ------------------------------------------------------------------ negócio
export function FormNegocio({ crm, inicial, onFechar, onSalvar, onExcluir, onLancar }: Base<Negocio> & { onLancar?: () => void }) {
  const [x, setX] = useState<Partial<Negocio>>({ etapa: "lead", data_ref: hoje(), pct_vendedor: 2.28, pct_parceiro: 0, valor_estimado: 0, ...inicial });
  const e = useEnvio();
  const s = (k: keyof Negocio) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setX({ ...x, [k]: ev.target.value });
  const num = (k: keyof Negocio) => (ev: React.ChangeEvent<HTMLInputElement>) => setX({ ...x, [k]: Number(ev.target.value) });
  const v = Number(x.valor_estimado) || 0;
  return (
    <Janela titulo={inicial.id ? "Editar negócio" : "Novo cliente / negócio"} aberto onFechar={onFechar}
      rodape={<Rodape e={e} onFechar={onFechar} onSalvar={() => e.rodar(() => onSalvar(x))} onExcluir={onExcluir}
        extra={<>
          {x.id && <a href={`/contratos/?novo=${x.id}`} className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13.5px] font-semibold text-azul hover:bg-fundo"><FileSignature className="size-4" />Gerar contrato</a>}
          {onLancar && x.etapa === "ganho" ? <Botao tipo="leve" onClick={onLancar}><Wallet className="size-4" />Lançar no Financeiro</Botao> : null}
        </>} />}>
      <div className="grid grid-cols-2 gap-3">
        <Rotulo rotulo="Cliente" className="col-span-2"><input className={campo} value={x.cliente_nome ?? ""} onChange={s("cliente_nome")} autoFocus /></Rotulo>
        <Rotulo rotulo="Projeto / descrição" className="col-span-2"><input className={campo} placeholder="Ex.: automação completa, home theater…" value={x.titulo ?? ""} onChange={s("titulo")} /></Rotulo>
        <Rotulo rotulo="Parceiro vinculado" className="col-span-2">
          <SelParceiro crm={crm} valor={x.parceiro_id} onChange={(pid) => {
            const p = crm.parceiros.find((q) => q.id === pid);
            setX({ ...x, parceiro_id: pid, pct_parceiro: !x.id && p ? p.comissao_padrao : x.pct_parceiro });
          }} />
        </Rotulo>
        <Rotulo rotulo="Valor (R$)"><input className={campo} type="number" step="any" min={0} value={x.valor_estimado ?? 0} onChange={num("valor_estimado")} /></Rotulo>
        <Rotulo rotulo="Status"><select className={campo} value={x.etapa} onChange={s("etapa")}>{ETAPAS_NEGOCIO.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Rotulo>
        <Rotulo rotulo={x.etapa === "ganho" ? "Data do fechamento" : "Previsão de fechamento"}><input className={campo} type="date" value={x.data_ref ?? ""} onChange={s("data_ref")} /></Rotulo>
        <Rotulo rotulo="Comissão do parceiro paga?"><select className={campo} value={x.comissao_parceiro_paga ? "1" : "0"} onChange={(ev) => setX({ ...x, comissao_parceiro_paga: ev.target.value === "1" })}><option value="0">Não</option><option value="1">Sim</option></select></Rotulo>
        <Rotulo rotulo={`Comissão do parceiro (%) · ${reais((v * (Number(x.pct_parceiro) || 0)) / 100)}`}><input className={campo} type="number" step="any" min={0} value={x.pct_parceiro ?? 0} onChange={num("pct_parceiro")} /></Rotulo>
        <Rotulo rotulo={`Minha comissão (%) · ${reais((v * (Number(x.pct_vendedor) || 0)) / 100)}`}><input className={campo} type="number" step="any" min={0} value={x.pct_vendedor ?? 0} onChange={num("pct_vendedor")} /></Rotulo>
        {x.etapa === "perdido" && <Rotulo rotulo="Motivo da perda" className="col-span-2"><input className={campo} value={x.motivo_perda ?? ""} onChange={s("motivo_perda")} /></Rotulo>}
        <Rotulo rotulo="Próximo passo" className="col-span-2"><input className={campo} value={x.proxima_acao ?? ""} onChange={s("proxima_acao")} /></Rotulo>
        <Rotulo rotulo="Observações" className="col-span-2"><textarea className={campo} rows={3} value={x.observacoes ?? ""} onChange={s("observacoes")} /></Rotulo>
        {x.financeiro_lancado_em && <p className="col-span-2 rounded-lg bg-ok-claro px-3 py-2 text-[13px] text-ok">Parcelas já lançadas no Financeiro em {dataBr(x.financeiro_lancado_em)}.</p>}
      </div>
    </Janela>
  );
}

// ------------------------------------------------------------------ atividade / follow-up / tarefa
export function FormAtividade({ crm, inicial, onFechar, onSalvar, onExcluir }: Base<Atividade>) {
  const [x, setX] = useState<Partial<Atividade>>(() => {
    const base: Partial<Atividade> = { tipo: "reuniao", data: hoje(), hora: "", endereco: "", data_fim: "", hora_fim: "", ...inicial };
    // compromisso antigo sem término: sugere 1 h depois
    if (base.hora && !base.hora_fim && base.tipo !== "followup" && base.tipo !== "tarefa") { base.hora_fim = maisUmaHora(base.hora); base.data_fim = base.data_fim || base.data; }
    if (!base.data_fim) base.data_fim = base.data;
    return base;
  });
  const e = useEnvio();
  const s = (k: keyof Atividade) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setX({ ...x, [k]: ev.target.value });
  const fu = x.tipo === "followup", td = x.tipo === "tarefa", compromisso = !fu && !td;
  const diaTodo = !x.hora;
  const titulo = (inicial.id ? "Editar " : "Novo ") + (fu ? "follow-up" : td ? "tarefa" : "compromisso");

  // início muda → término acompanha (mantém a duração; padrão 1 h)
  function mudarInicio(campoIni: "data" | "hora", v: string) {
    const n = { ...x, [campoIni]: v };
    if (campoIni === "data") {
      const dur = x.data && x.data_fim ? diasEntre(x.data, x.data_fim) : 0;
      n.data_fim = v ? somaDiasIso(v, Math.max(0, dur)) : "";
    } else if (v) {
      const durMin = x.hora && x.hora_fim && x.data === x.data_fim ? minutos(x.hora_fim) - minutos(x.hora) : 60;
      n.hora_fim = deMinutos(minutos(v) + (durMin > 0 ? durMin : 60));
      if (minutos(v) + (durMin > 0 ? durMin : 60) >= 24 * 60) { n.hora_fim = "23:59"; }
    } else n.hora_fim = "";
    setX(n);
  }
  const fimAntes = !!(x.data && x.data_fim && (x.data_fim < x.data || (x.data_fim === x.data && x.hora && x.hora_fim && x.hora_fim <= x.hora)));

  // sugestões de endereço: cliente do negócio + clientes cadastrados
  const negocio = crm.negocios.find((n) => n.id === x.oportunidade_id);
  const clienteNeg = negocio?.cliente_id ? crm.clientes.find((c) => c.id === negocio.cliente_id) : crm.clientes.find((c) => c.nome === negocio?.cliente_nome);
  const endCliente = clienteNeg ? enderecoCompleto(clienteNeg) : "";
  const sugestoes = useMemo(() => [...new Set(crm.clientes.map((c) => enderecoCompleto(c)).filter((v) => v.length > 8))].slice(0, 300), [crm.clientes]);
  const mapa = x.endereco?.trim() ? `https://maps.apple.com/?q=${encodeURIComponent(x.endereco.trim())}` : "";

  return (
    <Janela titulo={titulo} aberto onFechar={onFechar}
      rodape={<Rodape e={e} onFechar={onFechar} onSalvar={() => { if (fimAntes) { e.falhar("O término precisa ser depois do início."); return; } e.rodar(() => onSalvar(x)); }} onExcluir={onExcluir}
        extra={x.data ? <Botao tipo="leve" onClick={() => baixarIcs(x, crm)}><CalendarPlus className="size-4" />Adicionar ao Calendário</Botao> : null} />}>
      <div className="grid grid-cols-2 gap-3">
        {fu && <Rotulo rotulo="Contato / quem retornar" className="col-span-2"><input className={campo} value={x.contato ?? ""} onChange={s("contato")} autoFocus /></Rotulo>}
        <Rotulo rotulo={fu ? "Motivo / próximo passo" : td ? "Tarefa" : "Título"} className="col-span-2"><input className={campo} value={x.titulo ?? ""} onChange={s("titulo")} autoFocus={!fu} /></Rotulo>
        {compromisso && <Rotulo rotulo="Tipo" className="col-span-2 sm:col-span-1"><select className={campo} value={x.tipo} onChange={s("tipo")}>{TIPOS_AGENDA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Rotulo>}
        {compromisso && (
          <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-[13.5px] sm:col-span-1">
            <input type="checkbox" className="size-4" checked={diaTodo} onChange={(ev) => ev.target.checked ? setX({ ...x, hora: "", hora_fim: "" }) : setX({ ...x, hora: "09:00", hora_fim: "10:00" })} />Dia todo
          </label>
        )}

        {compromisso ? (
          <div className="col-span-2 grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2 rounded-xl border border-linha bg-fundo/60 p-3">
            <span className="text-[12.5px] font-semibold text-suave">Início</span>
            <input className={campo} type="date" value={x.data ?? ""} onChange={(ev) => mudarInicio("data", ev.target.value)} aria-label="Data de início" />
            <input className={campo} type="time" value={x.hora ?? ""} disabled={diaTodo} onChange={(ev) => mudarInicio("hora", ev.target.value)} aria-label="Hora de início" />
            <span className="text-[12.5px] font-semibold text-suave">Término</span>
            <input className={campo} type="date" value={x.data_fim ?? ""} min={x.data} onChange={s("data_fim")} aria-label="Data de término" />
            <input className={campo} type="time" value={x.hora_fim ?? ""} disabled={diaTodo} onChange={s("hora_fim")} aria-label="Hora de término" />
            {fimAntes && <p className="col-span-3 text-[12.5px] font-semibold text-erro">O término precisa ser depois do início.</p>}
            {!fimAntes && x.data && <p className="col-span-3 text-[12px] text-suave">{duracaoTexto(x)}</p>}
          </div>
        ) : (
          <Rotulo rotulo={fu ? "Retornar em" : "Dia"}><input className={campo} type="date" value={x.data ?? ""} onChange={s("data")} /></Rotulo>
        )}

        {compromisso && (
          <div className="col-span-2">
            <Rotulo rotulo="Endereço (aparece como Local no Calendário do iPhone)">
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-2.5 left-3 size-4 text-suave" />
                <input className={`${campo} pl-9`} list="enderecos-crm" value={x.endereco ?? ""} onChange={s("endereco")} placeholder="Rua, número, bairro, cidade — ou o nome do local" />
                <datalist id="enderecos-crm">{sugestoes.map((v) => <option key={v} value={v} />)}</datalist>
              </div>
            </Rotulo>
            <div className="mt-1.5 flex flex-wrap gap-2 text-[12.5px]">
              {endCliente && endCliente !== x.endereco && (
                <button type="button" onClick={() => setX({ ...x, endereco: endCliente })} className="inline-flex items-center gap-1 rounded-full bg-[#e8f0fa] px-2.5 py-1 font-semibold text-azul hover:bg-[#dbe7f7]">
                  <MapPin className="size-3" />Usar endereço de {clienteNeg!.nome.split(" ")[0]}
                </button>)}
              {mapa && <a href={mapa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-linha px-2.5 py-1 font-semibold text-suave hover:text-azul"><Navigation className="size-3" />Ver no mapa</a>}
            </div>
          </div>
        )}

        <Rotulo rotulo="Parceiro" className={fu || td ? "" : "col-span-2"}><SelParceiro crm={crm} valor={x.parceiro_id} onChange={(v) => setX({ ...x, parceiro_id: v })} /></Rotulo>
        <Rotulo rotulo="Negócio" className="col-span-2">
          <select className={campo} value={x.oportunidade_id ?? ""} onChange={(ev) => setX({ ...x, oportunidade_id: ev.target.value || null })}>
            <option value="">— nenhum —</option>
            {crm.negocios.filter((n) => n.etapa !== "perdido").map((n) => <option key={n.id} value={n.id}>{n.cliente_nome || n.titulo} · {n.titulo}</option>)}
          </select>
        </Rotulo>
        <Rotulo rotulo={fu || td ? "Observações" : "Anotações da reunião"} className="col-span-2"><textarea className={campo} rows={4} value={x.notas ?? ""} onChange={s("notas")} /></Rotulo>
        <label className="col-span-2 flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="size-4" checked={!!x.concluida} onChange={(ev) => setX({ ...x, concluida: ev.target.checked })} />Concluído</label>
      </div>
    </Janela>
  );
}

const minutos = (h: string) => { const [a, b] = h.split(":").map(Number); return (a || 0) * 60 + (b || 0); };
const deMinutos = (m: number) => `${String(Math.floor(Math.min(m, 1439) / 60)).padStart(2, "0")}:${String(Math.min(m, 1439) % 60).padStart(2, "0")}`;
const maisUmaHora = (h: string) => deMinutos(minutos(h) + 60);
const diasEntre = (a: string, b: string) => Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86_400_000);
const somaDiasIso = (d: string, n: number) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
function duracaoTexto(x: Partial<Atividade>) {
  const dias = x.data && x.data_fim ? diasEntre(x.data, x.data_fim) : 0;
  if (!x.hora) return dias > 0 ? `Dia todo · ${dias + 1} dias` : "Dia todo";
  if (!x.hora_fim) return "Duração padrão de 1 hora";
  const m = dias * 1440 + minutos(x.hora_fim) - minutos(x.hora);
  const h = Math.floor(m / 60), r = m % 60;
  return `Duração: ${h ? `${h} h` : ""}${h && r ? " " : ""}${r ? `${r} min` : ""}${dias > 0 ? ` · termina em ${dataBr(x.data_fim!)}` : ""}`;
}

// um compromisso avulso para o Calendário do iPhone/Mac (abre a tela "Adicionar")
function baixarIcs(x: Partial<Atividade>, crm: Crm) {
  const diaTodo = !x.hora;
  const ics = gerarIcs([{
    id: x.id ?? `novo-${Date.now()}`, tipo: x.tipo ?? "reuniao", titulo: x.titulo || x.contato || "Compromisso", notas: x.notas,
    quando: `${x.data}T${diaTodo ? "12:00" : x.hora}:00-03:00`, dia_todo: diaTodo, concluida: !!x.concluida, contato: x.contato,
    parceiro: crm.parceiros.find((p) => p.id === x.parceiro_id)?.nome ?? null,
    negocio: crm.negocios.find((n) => n.id === x.oportunidade_id)?.cliente_nome ?? null,
    endereco: x.endereco || null,
    fim: x.data_fim || x.hora_fim ? `${x.data_fim || x.data}T${diaTodo ? "12:00" : x.hora_fim || x.hora}:00-03:00` : null,
  }], { url: "https://nucleo-bra.vercel.app/crm/" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = "compromisso-bra.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ------------------------------------------------------------------ lançar no Financeiro
export function FormLancar({ crm, negocio, usuario, onFechar, onConfirmar }: {
  crm: Crm; negocio: Negocio; usuario: string; onFechar: () => void; onConfirmar: (parcelas: Record<string, unknown>[]) => Promise<void>;
}) {
  const parceiro = crm.parceiros.find((p) => p.id === negocio.parceiro_id);
  const [f, setF] = useState({
    descricao: `${negocio.cliente_nome || negocio.titulo}${negocio.titulo && negocio.cliente_nome ? " - " + negocio.titulo : ""}`,
    cliente: negocio.cliente_nome || negocio.titulo, forma: "Pix", total: negocio.valor_estimado, parcelas: 1,
    primeiro: hoje(), conta: "", nf: "",
    meu: usuario, pctMeu: negocio.pct_vendedor, pctParc: negocio.pct_parceiro,
  });
  const e = useEnvio();
  const coms = useMemo(() => [
    { n: f.meu, r: "Vendedor", p: Number(f.pctMeu) || 0 },
    ...(parceiro ? [{ n: parceiro.nome, r: parceiro.tipo === "arquiteto" ? "Arquiteto" : "Parceiro", p: Number(f.pctParc) || 0 }] : []),
  ], [f.meu, f.pctMeu, f.pctParc, parceiro]);
  const previa = useMemo(() => montarParcelas({ ...f, total: Number(f.total) || 0, parcelas: Math.max(1, Math.min(120, Number(f.parcelas) || 1)), comissoes: coms }), [f, coms]);
  const s = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: ev.target.type === "number" ? Number(ev.target.value) : ev.target.value });
  return (
    <Janela titulo="Lançar no Financeiro" aberto onFechar={onFechar} largura="max-w-2xl"
      rodape={<>
        <Botao tipo="pri" disabled={e.ocupado || !(Number(f.total) > 0)} onClick={() => e.rodar(() => onConfirmar(previa))}>{e.ocupado ? "Lançando…" : `Lançar ${previa.length} parcela(s)`}</Botao>
        <Botao onClick={onFechar}>Cancelar</Botao>
        {e.erro && <p role="alert" className="w-full rounded-lg bg-erro-claro px-3 py-2 text-[13px] text-erro">{e.erro}</p>}
      </>}>
      <p className="mb-3 text-[13px] text-suave">As parcelas entram em <b>A receber</b> no Financeiro, com os comissionados já definidos — como um lançamento feito lá.</p>
      {negocio.financeiro_lancado_em && <p className="mb-3 rounded-lg bg-atencao-claro px-3 py-2 text-[13px] text-atencao">Atenção: este negócio já foi lançado em {dataBr(negocio.financeiro_lancado_em)}. Lançar de novo duplica as parcelas.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Rotulo rotulo="Descrição" className="col-span-2 sm:col-span-4"><input className={campo} value={f.descricao} onChange={s("descricao")} /></Rotulo>
        <Rotulo rotulo="Cliente" className="col-span-2"><input className={campo} value={f.cliente} onChange={s("cliente")} /></Rotulo>
        <Rotulo rotulo="Forma"><select className={campo} value={f.forma} onChange={s("forma")}>{["Pix", "Boleto", "Cartão", "Transferência"].map((x) => <option key={x}>{x}</option>)}</select></Rotulo>
        <Rotulo rotulo="Conta (opcional)"><input className={campo} value={f.conta} onChange={s("conta")} /></Rotulo>
        <Rotulo rotulo="Valor total (R$)"><input className={campo} type="number" step="any" min={0} value={f.total} onChange={s("total")} /></Rotulo>
        <Rotulo rotulo="Parcelas"><input className={campo} type="number" min={1} max={120} value={f.parcelas} onChange={s("parcelas")} /></Rotulo>
        <Rotulo rotulo="1º vencimento"><input className={campo} type="date" value={f.primeiro} onChange={s("primeiro")} /></Rotulo>
        <Rotulo rotulo="NF (opcional)"><input className={campo} value={f.nf} onChange={s("nf")} placeholder="NF 1840" /></Rotulo>
        <Rotulo rotulo="Vendedor" className="col-span-2"><input className={campo} value={f.meu} onChange={s("meu")} /></Rotulo>
        <Rotulo rotulo="% vendedor"><input className={campo} type="number" step="any" value={f.pctMeu} onChange={s("pctMeu")} /></Rotulo>
        {parceiro ? <Rotulo rotulo={`% ${parceiro.nome}`}><input className={campo} type="number" step="any" value={f.pctParc} onChange={s("pctParc")} /></Rotulo> : <div />}
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-linha">
        <table className="w-full text-[13px]">
          <thead className="bg-fundo text-left text-[12px] text-suave"><tr><th className="px-3 py-2">Parcela</th><th className="px-3 py-2">Vencimento</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Comissões</th></tr></thead>
          <tbody>
            {previa.slice(0, 12).map((p) => (
              <tr key={String(p.id)} className="border-t border-linha">
                <td className="px-3 py-1.5">{String(p.par) || "Única"}</td><td className="num px-3 py-1.5">{dataBr(String(p.venc))}</td>
                <td className="num px-3 py-1.5 text-right font-semibold">{reais(Number(p.valor))}</td>
                <td className="px-3 py-1.5 text-suave">{(p.coms as { n: string; p: number }[]).map((c) => `${c.n.split(" ")[0]} ${reais((Number(p.valor) * c.p) / 100)}`).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {previa.length > 12 && <p className="px-3 py-2 text-[12px] text-suave">…e mais {previa.length - 12} parcelas.</p>}
      </div>
    </Janela>
  );
}
