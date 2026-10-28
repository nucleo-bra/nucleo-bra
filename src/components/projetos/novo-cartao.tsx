"use client";
// Janela de criação rápida: novo chamado, nova visita ou novo cartão — de qualquer visão (Painel, Quadro, Agenda, Lista).
import { useState } from "react";
import { CalendarClock, Headset, ShieldCheck, SquareKanban, X } from "lucide-react";
import { Cartao, CORES, Lista, listaFinal, Membro, Modulo, posEntre, PRIORIDADES, Prioridade, QuadroCompleto } from "@/lib/projetos";
import { Avatar } from "./pecas";

const NOMES: Record<Modulo, { titulo: string; acao: string; ph: string; icone: typeof Headset }> = {
  chamados: { titulo: "Novo chamado", acao: "Abrir chamado", ph: "Ex.: Cena de cinema não liga o projetor", icone: Headset },
  agendamentos: { titulo: "Nova visita", acao: "Agendar visita", ph: "Ex.: Instalação Control4 — sala e cinema", icone: CalendarClock },
  projetos: { titulo: "Novo cartão", acao: "Criar cartão", ph: "Ex.: Passagem de cabos do cinema", icone: SquareKanban },
};
const campo = "w-full rounded-xl border border-linha bg-white px-3 py-2 text-[14px] outline-none focus:border-azul focus:ring-2 focus:ring-azul/15";
const Rotulo = ({ children }: { children: React.ReactNode }) => <span className="mb-1 block text-[12px] font-semibold text-suave">{children}</span>;
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hojeISO = () => isoLocal(new Date());

export function NovoCartao({ d, equipe, modulo, inicial, onFechar, onCriar }: {
  d: QuadroCompleto; equipe: Membro[]; modulo: Modulo; inicial?: { lista?: string; inicio?: Date };
  onFechar: () => void;
  onCriar: (lista: string, titulo: string, extra: Partial<Cartao>, abrir: boolean) => Promise<void>;
}) {
  const listas = [...d.listas].sort((a, b) => a.posicao - b.posicao);
  const fim = listaFinal(d.listas);
  const agendados = listas.find((l) => /agendad/i.test(l.nome));
  const [titulo, setTitulo] = useState("");
  const [lista, setLista] = useState(inicial?.lista ?? (modulo === "agendamentos" && inicial?.inicio && agendados ? agendados.id : listas[0]?.id ?? ""));
  const [listaMexida, setListaMexida] = useState(!!inicial?.lista);
  const [membros, setMembros] = useState<string[]>([]);
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [cliente, setCliente] = useState(""), [telefone, setTelefone] = useState(""), [endereco, setEndereco] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [garantia, setGarantia] = useState(false);
  const ini = inicial?.inicio;
  const [data, setData] = useState(ini ? isoLocal(ini) : "");
  const [hora, setHora] = useState(ini ? ini.toTimeString().slice(0, 5) : "09:00");
  const [horaFim, setHoraFim] = useState(ini ? new Date(ini.getTime() + 2 * 3600_000).toTimeString().slice(0, 5) : "11:00");
  const [prazo, setPrazo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const N = NOMES[modulo];
  const tecnicos = [...equipe].sort((a, b) => Number(b.papel === "tecnico") - Number(a.papel === "tecnico") || a.nome.localeCompare(b.nome));

  async function criar(abrir: boolean) {
    if (!titulo.trim() || !lista) return;
    setSalvando(true); setErro("");
    const extra: Partial<Cartao> = { membros, etiquetas };
    if (descricao.trim()) extra.descricao = descricao.trim();
    if (modulo !== "projetos") Object.assign(extra, { cliente_nome: cliente.trim(), telefone: telefone.trim(), endereco: endereco.trim() });
    if (modulo === "chamados") Object.assign(extra, { prioridade, garantia });
    if (modulo === "agendamentos" && data) {
      extra.agenda_inicio = new Date(`${data}T${hora || "09:00"}:00`).toISOString();
      if (horaFim) extra.agenda_fim = new Date(`${data}T${horaFim}:00`).toISOString();
    }
    if (prazo) extra.prazo = new Date(`${prazo}T18:00:00`).toISOString();
    if (lista === fim) extra.concluido_em = new Date().toISOString();
    try { await onCriar(lista, titulo, extra, abrir); } catch (e) { setErro(e instanceof Error ? e.message : String(e)); setSalvando(false); }
  }

  const Chip = ({ ativo, onClick, children, cor }: { ativo: boolean; onClick: () => void; children: React.ReactNode; cor?: string }) => (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition ${ativo ? "border-transparent text-white shadow-sm" : "border-linha bg-white text-tinta hover:border-azul"}`}
      style={ativo ? { background: cor ?? "#19295a" } : undefined}>{children}</button>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-marinho-950/55 p-3 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <form onSubmit={(e) => { e.preventDefault(); criar(false); }} className="flex max-h-[92dvh] w-full max-w-[580px] flex-col overflow-hidden rounded-[22px] bg-fundo shadow-2xl">
        <div className="relative overflow-hidden bg-marinho-900 bg-[radial-gradient(380px_180px_at_100%_0,rgba(34,199,214,.28),transparent_70%),radial-gradient(300px_160px_at_0_100%,rgba(245,130,31,.2),transparent_70%)] px-5 pt-4 pb-4 text-white">
          <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" />
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-[19px] font-extrabold"><N.icone className="size-5 text-ciano" />{N.titulo}</h2>
            <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X className="size-5" /></button>
          </div>
          <input autoFocus required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={N.ph}
            className="mt-3 w-full rounded-xl border-0 bg-white/95 px-3.5 py-2.5 text-[15px] font-semibold text-tinta outline-none placeholder:font-normal placeholder:text-suave focus:ring-2 focus:ring-ciano" />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><Rotulo>Etapa</Rotulo>
              <select value={lista} onChange={(e) => { setLista(e.target.value); setListaMexida(true); }} className={campo}>
                {listas.map((l: Lista) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select></label>
            {modulo === "projetos" && <label className="block"><Rotulo>Prazo</Rotulo><input type="date" value={prazo} min={hojeISO()} onChange={(e) => setPrazo(e.target.value)} className={campo} /></label>}
            {modulo === "chamados" && <label className="block"><Rotulo>Prazo para resolver</Rotulo><input type="date" value={prazo} min={hojeISO()} onChange={(e) => setPrazo(e.target.value)} className={campo} /></label>}
            {modulo === "agendamentos" && <label className="block"><Rotulo>Data da visita</Rotulo>
              <input type="date" value={data} onChange={(e) => { setData(e.target.value); if (!listaMexida && e.target.value && agendados) setLista(agendados.id); }} className={campo} /></label>}
          </div>

          {modulo === "agendamentos" && data && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><Rotulo>Início</Rotulo><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} /></label>
              <label className="block"><Rotulo>Término</Rotulo><input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} className={campo} /></label>
            </div>
          )}

          {modulo === "chamados" && (
            <div><Rotulo>Prioridade</Rotulo>
              <div className="flex flex-wrap gap-1.5">
                {PRIORIDADES.map(([k, r]) => <Chip key={k} ativo={prioridade === k} onClick={() => setPrioridade(k)} cor={{ urgente: "#d63a2f", alta: "#f5821f", media: "#c98a06", baixa: "#66738f" }[k]}>{r}</Chip>)}
                <span className="mx-1 w-px bg-linha" />
                <Chip ativo={garantia} onClick={() => setGarantia(!garantia)} cor="#12a150"><ShieldCheck className="size-3.5" />Em garantia</Chip>
              </div>
            </div>
          )}

          {modulo !== "projetos" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><Rotulo>Cliente</Rotulo><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente ou obra" className={campo} /></label>
              <label className="block"><Rotulo>Telefone / WhatsApp</Rotulo><input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(19) 9…" className={campo} /></label>
              <label className="block sm:col-span-2"><Rotulo>Endereço</Rotulo><input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" className={campo} /></label>
            </div>
          )}

          {d.etiquetas.length > 0 && (
            <div><Rotulo>{modulo === "chamados" ? "Tipo de chamado" : modulo === "agendamentos" ? "Tipo de visita" : "Etiquetas"}</Rotulo>
              <div className="flex flex-wrap gap-1.5">{d.etiquetas.map((e) => (
                <Chip key={e.id} ativo={etiquetas.includes(e.id)} cor={CORES[e.cor] ?? e.cor} onClick={() => setEtiquetas((x) => (x.includes(e.id) ? x.filter((y) => y !== e.id) : [...x, e.id]))}>
                  {!etiquetas.includes(e.id) && <span className="size-2.5 rounded-sm" style={{ background: CORES[e.cor] ?? e.cor }} />}{e.nome || "Sem nome"}
                </Chip>))}</div>
            </div>
          )}

          {tecnicos.length > 0 && (
            <div><Rotulo>{modulo === "agendamentos" ? "Técnicos" : "Responsáveis"} <span className="font-normal">— recebem um aviso no Núcleo</span></Rotulo>
              <div className="flex flex-wrap gap-1.5">{tecnicos.map((m) => (
                <Chip key={m.id} ativo={membros.includes(m.id)} onClick={() => setMembros((x) => (x.includes(m.id) ? x.filter((y) => y !== m.id) : [...x, m.id]))}>
                  <Avatar m={m} tam={18} />{m.nome.split(" ").slice(0, 2).join(" ")}
                </Chip>))}</div>
            </div>
          )}

          <label className="block"><Rotulo>Descrição</Rotulo>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder={modulo === "chamados" ? "O que o cliente relatou, desde quando, o que já foi testado…" : "Detalhes, materiais, observações…"} className={`${campo} resize-y`} /></label>
          {erro && <p role="alert" className="rounded-xl bg-erro-claro px-3 py-2 text-[13px] text-erro">{erro}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-linha bg-white px-5 py-3">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2 text-[14px] font-semibold text-suave hover:bg-fundo">Cancelar</button>
          <button type="button" disabled={!titulo.trim() || salvando} onClick={() => criar(true)} className="rounded-xl border border-linha bg-white px-4 py-2 text-[14px] font-semibold hover:border-azul disabled:opacity-40">Criar e abrir</button>
          <button type="submit" disabled={!titulo.trim() || salvando} className="rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-5 py-2 text-[14px] font-semibold text-white shadow-md hover:shadow-lg disabled:opacity-40">{salvando ? "Salvando…" : N.acao}</button>
        </div>
      </form>
    </div>
  );
}

/** posição no fim de uma lista */
export const posicaoFinal = (d: QuadroCompleto, lista: string) => {
  const ps = d.cartoes.filter((c) => c.lista_id === lista).map((c) => c.posicao);
  return posEntre(ps.length ? Math.max(...ps) : undefined, undefined);
};
