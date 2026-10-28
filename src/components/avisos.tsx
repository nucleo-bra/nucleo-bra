"use client";
// Sininho, painel de avisos, popup ao entrar e aviso instantâneo (toast).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell, X, AlertTriangle, Clock, Wallet, Wrench, Handshake, MessageSquare, UserPlus, CalendarClock, CheckCheck, ChevronRight, Sparkles,
} from "lucide-react";
import {
  Alerta, carregarAvisos, limparLidas, marcarLida, marcarTodasLidas, Notificacao, ouvirNotificacoes, tempoAtras,
} from "@/lib/avisos";

type Usuario = { id: string; nome: string; papel?: string };

const COR_NIVEL = {
  erro: { faixa: "bg-erro", fundo: "bg-erro-claro", texto: "text-erro" },
  atencao: { faixa: "bg-atencao", fundo: "bg-atencao-claro", texto: "text-atencao" },
  info: { faixa: "bg-azul", fundo: "bg-[#e8f0fa]", texto: "text-azul" },
} as const;
const ICONE_GRUPO = { financeiro: Wallet, tecnico: Wrench, crm: Handshake };
const ICONE_TIPO: Record<string, typeof Bell> = { atribuicao: UserPlus, comentario: MessageSquare, atividade: CalendarClock, acesso: UserPlus };

const lerSessao = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const gravarSessao = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

/** Estado dos avisos de um usuário (carrega, ouve em tempo real, marca como lido). */
export function useAvisos(usuario: Usuario | null) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [novidade, setNovidade] = useState<Notificacao | null>(null);
  const uid = usuario?.id, papel = usuario?.papel;

  const recarregar = useCallback(async () => {
    if (!uid) return;
    try {
      const r = await carregarAvisos(uid, papel);
      setNotificacoes(r.notificacoes); setAlertas(r.alertas);
    } catch { /* avisos nunca travam a tela */ }
    setCarregado(true);
  }, [uid, papel]);

  useEffect(() => { recarregar(); }, [recarregar]);
  useEffect(() => {
    if (!uid) return;
    const parar = ouvirNotificacoes(uid, (n) => { setNotificacoes((l) => [n, ...l.filter((x) => x.id !== n.id)]); setNovidade(n); });
    // ao voltar para a aba, atualiza (vencimentos mudam com o dia)
    const foco = () => { if (document.visibilityState === "visible") recarregar(); };
    document.addEventListener("visibilitychange", foco);
    return () => { parar(); document.removeEventListener("visibilitychange", foco); };
  }, [uid, recarregar]);

  const naoLidas = notificacoes.filter((n) => !n.lida_em);
  const urgentes = alertas.filter((a) => a.nivel !== "info");
  return {
    notificacoes, alertas, carregado, novidade, limparNovidade: () => setNovidade(null),
    naoLidas, contador: naoLidas.length + urgentes.length,
    async ler(id: string) {
      setNotificacoes((l) => l.map((n) => (n.id === id && !n.lida_em ? { ...n, lida_em: new Date().toISOString() } : n)));
      await marcarLida(id);
    },
    async lerTodas() {
      const agora = new Date().toISOString();
      setNotificacoes((l) => l.map((n) => (n.lida_em ? n : { ...n, lida_em: agora })));
      await marcarTodasLidas();
    },
    async limpar() { setNotificacoes((l) => l.filter((n) => !n.lida_em)); await limparLidas(); },
  };
}
export type EstadoAvisos = ReturnType<typeof useAvisos>;

// ---------------------------------------------------------------- sininho
export function Sininho({ av, onAbrir, variante = "barra" }: { av: EstadoAvisos; onAbrir: () => void; variante?: "barra" | "icone" }) {
  const n = av.contador;
  const selo = n > 0 && (
    <span className="grid min-w-[20px] place-items-center rounded-full bg-br px-1.5 text-[11px] font-bold leading-5 text-white shadow-[0_0_0_2px_#19295a]">{n > 99 ? "99+" : n}</span>
  );
  if (variante === "icone") return (
    <button onClick={onAbrir} className="relative p-2 text-white" aria-label={`Avisos${n ? ` (${n})` : ""}`}>
      <Bell className={`size-[22px] ${n ? "animate-[balanco_2.4s_ease-in-out_infinite]" : ""}`} strokeWidth={1.75} />
      {n > 0 && <span className="absolute -top-0.5 -right-0.5">{selo}</span>}
    </button>
  );
  return (
    <button onClick={onAbrir} className="mx-3 mb-3 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.06] px-3 py-2 text-[14px] text-[#d5ddf3] transition hover:bg-white/10 hover:text-white">
      <Bell className={`size-[18px] ${n ? "text-br animate-[balanco_2.4s_ease-in-out_infinite]" : ""}`} strokeWidth={1.75} />
      <span className="flex-1 text-left">Avisos</span>
      {selo}
    </button>
  );
}

// ---------------------------------------------------------------- itens
function ItemAlerta({ a, onIr }: { a: Alerta; onIr: () => void }) {
  const c = COR_NIVEL[a.nivel], I = ICONE_GRUPO[a.grupo];
  return (
    <Link href={a.link} onClick={onIr} className="group relative flex gap-3 overflow-hidden rounded-xl border border-linha bg-white py-2.5 pr-3 pl-4 transition hover:-translate-y-px hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 w-1 ${c.faixa}`} />
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${c.fundo} ${c.texto}`}><I className="size-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13.5px] font-bold ${a.nivel === "info" ? "text-tinta" : c.texto}`}>{a.titulo}</span>
        <span className="block truncate text-[12.5px] text-suave">{a.corpo}</span>
      </span>
      <ChevronRight className="size-4 self-center text-suave opacity-0 transition group-hover:opacity-100" />
    </Link>
  );
}

function ItemNotificacao({ n, onIr }: { n: Notificacao; onIr: () => void }) {
  const I = ICONE_TIPO[n.tipo] ?? Bell;
  const corpo = (
    <>
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${n.lida_em ? "bg-fundo text-suave" : "bg-marinho-900 text-ciano"}`}><I className="size-[17px]" /></span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13.5px] leading-snug ${n.lida_em ? "text-suave" : "font-semibold text-tinta"}`}>{n.titulo}</span>
        {n.corpo && <span className="line-clamp-2 block text-[12.5px] text-suave">{n.corpo}</span>}
        <span className="mt-0.5 block text-[11.5px] text-suave/80">{tempoAtras(n.created_at)}</span>
      </span>
      {!n.lida_em && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-br" aria-label="Não lida" />}
    </>
  );
  const cls = `flex gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-fundo ${n.lida_em ? "" : "bg-[#f4f8ff]"}`;
  return n.link ? <Link href={n.link} onClick={onIr} className={cls}>{corpo}</Link> : <button onClick={onIr} className={`${cls} w-full`}>{corpo}</button>;
}

// ---------------------------------------------------------------- painel lateral
export function PainelAvisos({ av, aberto, onFechar }: { av: EstadoAvisos; aberto: boolean; onFechar: () => void }) {
  const [aba, setAba] = useState<"tudo" | "atencao" | "notificacoes">("tudo");
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto, onFechar]);
  const lidas = av.notificacoes.some((n) => n.lida_em);
  const verAlertas = aba !== "notificacoes", verNotif = aba !== "atencao";

  return (
    <div className={`fixed inset-0 z-50 ${aberto ? "" : "pointer-events-none"}`} aria-hidden={!aberto}>
      <div onClick={onFechar} className={`absolute inset-0 bg-marinho-950/40 backdrop-blur-[2px] transition-opacity ${aberto ? "opacity-100" : "opacity-0"}`} />
      <aside role="dialog" aria-label="Avisos"
        className={`absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-fundo shadow-2xl transition-transform duration-300 ${aberto ? "translate-x-0" : "translate-x-full"}`}>
        <div className="relative overflow-hidden bg-marinho-900 bg-[radial-gradient(380px_180px_at_100%_0,rgba(34,199,214,.25),transparent_70%),radial-gradient(300px_160px_at_0_100%,rgba(245,130,31,.18),transparent_70%)] px-5 pt-5 pb-4 text-white">
          <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" />
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold tracking-[.14em] text-ciano uppercase">Central de avisos</div>
              <h2 className="font-display text-[22px] font-extrabold">
                {av.contador ? `${av.contador} ${av.contador === 1 ? "pendência" : "pendências"}` : "Tudo em dia"}
              </h2>
            </div>
            <button onClick={onFechar} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X className="size-5" /></button>
          </div>
          <div className="mt-3 flex gap-1.5">
            {([["tudo", "Tudo"], ["atencao", `Atenção · ${av.alertas.length}`], ["notificacoes", `Notificações · ${av.naoLidas.length}`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setAba(k)}
                className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition ${aba === k ? "bg-white text-marinho-900" : "bg-white/10 text-white/80 hover:bg-white/15"}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {verAlertas && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 px-1 text-[12px] font-bold tracking-wide text-suave uppercase"><AlertTriangle className="size-3.5" />Precisa de atenção</h3>
              <div className="space-y-2">
                {av.alertas.map((a) => <ItemAlerta key={a.chave} a={a} onIr={onFechar} />)}
                {!av.alertas.length && <p className="rounded-xl border border-dashed border-linha bg-white px-4 py-5 text-center text-[13px] text-suave">Nenhum vencimento ou prazo próximo.</p>}
              </div>
            </section>
          )}
          {verNotif && (
            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-suave uppercase"><Clock className="size-3.5" />Notificações</h3>
                <div className="flex gap-3 text-[12px] font-semibold">
                  {av.naoLidas.length > 0 && <button onClick={av.lerTodas} className="flex items-center gap-1 text-azul hover:underline"><CheckCheck className="size-3.5" />Marcar todas como lidas</button>}
                  {lidas && <button onClick={av.limpar} className="text-suave hover:text-erro">Limpar lidas</button>}
                </div>
              </div>
              <div className="space-y-0.5 rounded-2xl bg-white p-1.5 shadow-sm">
                {av.notificacoes.map((n) => <ItemNotificacao key={n.id} n={n} onIr={() => { av.ler(n.id); onFechar(); }} />)}
                {!av.notificacoes.length && <p className="px-4 py-6 text-center text-[13px] text-suave">Quando alguém te colocar num cartão, comentar ou passar uma atividade, aparece aqui.</p>}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- popup ao entrar
export function PopupEntrada({ av, usuario, onVerTudo }: { av: EstadoAvisos; usuario: Usuario; onVerTudo: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const chave = `nucleo-popup-${usuario.id}`;
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!av.carregado || lerSessao(chave)) return;
    gravarSessao(chave, "1");
    if (av.naoLidas.length || av.alertas.some((a) => a.nivel !== "info")) setAberto(true);
  }, [av.carregado]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  const h = new Date().getHours();
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const alertas = av.alertas.slice(0, 5), notif = av.naoLidas.slice(0, 4);
  const erros = av.alertas.filter((a) => a.nivel === "erro").length, hoje = av.alertas.filter((a) => a.nivel === "atencao").length;
  const ir = (link: string) => { setAberto(false); router.push(link); };

  return (
    <dialog ref={ref} onClose={() => setAberto(false)} onClick={(e) => e.target === ref.current && setAberto(false)}
      className="m-auto w-[calc(100%-32px)] max-w-[520px] overflow-hidden rounded-3xl border-0 bg-fundo p-0 text-tinta shadow-2xl backdrop:bg-marinho-950/55 backdrop:backdrop-blur-sm">
      {aberto && (<>
        <div className="relative overflow-hidden bg-marinho-900 bg-[radial-gradient(420px_220px_at_100%_0,rgba(34,199,214,.3),transparent_70%),radial-gradient(360px_200px_at_0_100%,rgba(245,130,31,.22),transparent_70%)] px-6 pt-6 pb-5 text-white">
          <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" />
          <button onClick={() => setAberto(false)} className="absolute top-4 right-4 rounded-lg p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ciano text-white/70 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X className="size-5" /></button>
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[.14em] text-ciano uppercase"><Sparkles className="size-3.5" />Seu resumo de hoje</div>
          <h2 className="mt-1 font-display text-[24px] font-extrabold leading-tight">{saudacao}, {usuario.nome.split(" ")[0]}</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[[erros, "atrasados", "text-[#ff9b92]"], [hoje, "para hoje", "text-[#ffc46b]"], [av.naoLidas.length, "novidades", "text-ciano"]].map(([v, l, c]) => (
              <div key={l as string} className="rounded-xl bg-white/[.08] px-3 py-2.5 ring-1 ring-white/10">
                <div className={`font-display text-[24px] font-extrabold leading-none ${c}`}>{v as number}</div>
                <div className="mt-1 text-[11.5px] text-white/70">{l as string}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="max-h-[52vh] space-y-4 overflow-y-auto px-5 py-4">
          {alertas.length > 0 && <div className="space-y-2">{alertas.map((a) => (
            <button key={a.chave} onClick={() => ir(a.link)} className="block w-full text-left"><ItemAlertaEstatico a={a} /></button>
          ))}</div>}
          {notif.length > 0 && (
            <div>
              <h3 className="mb-1.5 px-1 text-[12px] font-bold tracking-wide text-suave uppercase">Novidades para você</h3>
              <div className="space-y-0.5 rounded-2xl bg-white p-1.5 shadow-sm">
                {notif.map((n) => <ItemNotificacao key={n.id} n={n} onIr={() => { av.ler(n.id); setAberto(false); }} />)}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-linha bg-white px-5 py-3.5">
          <button onClick={() => { setAberto(false); onVerTudo(); }} className="text-[13.5px] font-semibold text-azul hover:underline">
            Ver todos os avisos{av.alertas.length + av.naoLidas.length > alertas.length + notif.length ? ` (${av.alertas.length + av.naoLidas.length})` : ""}
          </button>
          <button onClick={() => setAberto(false)} className="rounded-xl bg-marinho-900 px-5 py-2 text-[14px] font-semibold text-white hover:bg-marinho-800">Entendi</button>
        </div>
      </>)}
    </dialog>
  );
}

function ItemAlertaEstatico({ a }: { a: Alerta }) {
  const c = COR_NIVEL[a.nivel], I = ICONE_GRUPO[a.grupo];
  return (
    <span className="group relative flex gap-3 overflow-hidden rounded-xl border border-linha bg-white py-2.5 pr-3 pl-4 transition hover:-translate-y-px hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 w-1 ${c.faixa}`} />
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${c.fundo} ${c.texto}`}><I className="size-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13.5px] font-bold ${a.nivel === "info" ? "text-tinta" : c.texto}`}>{a.titulo}</span>
        <span className="block truncate text-[12.5px] text-suave">{a.corpo}</span>
      </span>
      <ChevronRight className="size-4 self-center text-suave" />
    </span>
  );
}

// ---------------------------------------------------------------- aviso instantâneo
export function AvisoInstantaneo({ av }: { av: EstadoAvisos }) {
  const n = av.novidade;
  const router = useRouter();
  useEffect(() => {
    if (!n) return;
    const t = setTimeout(av.limparNovidade, 8000);
    return () => clearTimeout(t);
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!n) return null;
  const I = ICONE_TIPO[n.tipo] ?? Bell;
  return (
    <div className="fixed right-4 bottom-4 z-[60] w-[calc(100%-32px)] max-w-[380px] animate-[entrar_.35s_ease-out]">
      <div className="flex gap-3 overflow-hidden rounded-2xl bg-marinho-900 p-3.5 text-white shadow-2xl ring-1 ring-white/10">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-br/90"><I className="size-5" /></span>
        <button className="min-w-0 flex-1 text-left" onClick={() => { av.ler(n.id); av.limparNovidade(); if (n.link) router.push(n.link); }}>
          <span className="block text-[11px] font-semibold tracking-[.12em] text-ciano uppercase">Novo aviso</span>
          <span className="block text-[14px] font-semibold leading-snug">{n.titulo}</span>
          {n.corpo && <span className="line-clamp-2 block text-[12.5px] text-white/70">{n.corpo}</span>}
        </button>
        <button onClick={av.limparNovidade} className="self-start rounded p-1 text-white/60 hover:text-white" aria-label="Fechar"><X className="size-4" /></button>
      </div>
    </div>
  );
}
