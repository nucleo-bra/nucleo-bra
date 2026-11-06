"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FileDown, Wallet, Handshake, FileSignature, Package, Clapperboard, LogOut, Menu, X, SquareKanban, Map as MapIcon,
  Wrench, Headset, CalendarClock, UserCog, BookOpen, Lightbulb, History,
} from "lucide-react";
import { modoDemo, supabase } from "@/lib/supabase";
import { AvisoInstantaneo, PainelAvisos, PopupEntrada, Sininho, useAvisos } from "./avisos";
import { ASSISTENTE_ATIVO, BotaoClaude } from "./assistente";
import { registrarAcesso } from "@/lib/mfa";
import { useAtualizacao } from "@/lib/atualizar";

type ItemNav = { href: string; rotulo: string; icone: typeof Wallet; fase?: boolean; sub?: boolean } | { grupo: string };



/** Área técnica: o que o time técnico enxerga. */
export const NAV_TECNICO: readonly ItemNav[] = [
  { href: "/tecnico/", rotulo: "Técnico", icone: Wrench },
  { href: "/tecnico/projetos/", rotulo: "Projetos", icone: SquareKanban, sub: true },
  { href: "/tecnico/chamados/", rotulo: "Chamados", icone: Headset, sub: true },
  { href: "/tecnico/agendamentos/", rotulo: "Agendamentos", icone: CalendarClock, sub: true },
];
/** Telas liberadas para o perfil técnico (além da área técnica). */
const ROTAS_TECNICO = ["/tecnico", "/clientes", "/produtos", "/catalogos"];

const NAV: readonly ItemNav[] = [
  { href: "/", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/financeiro/", rotulo: "Financeiro", icone: Wallet },
  { href: "/clientes/", rotulo: "Clientes", icone: Users },
  { href: "/crm/", rotulo: "CRM", icone: Handshake },
  { href: "/produtos/", rotulo: "Produtos e estoque", icone: Package },
  { href: "/catalogos/", rotulo: "Catálogos", icone: BookOpen },
  ...(ASSISTENTE_ATIVO ? [{ href: "/recomendacao/", rotulo: "Recomendação de projeto", icone: Lightbulb }] : []),
  { href: "/mapa/", rotulo: "Mapa", icone: MapIcon },
  { href: "/contratos/", rotulo: "Contratos", icone: FileSignature },
  ...NAV_TECNICO,
  { href: "/importar/", rotulo: "Importar", icone: FileDown },
  { href: "/equipe/", rotulo: "Equipe", icone: UserCog },
  { href: "/historico/", rotulo: "Histórico", icone: History },
  { grupo: "Próximas fases" },
  { href: "/modulo/?m=marketing", rotulo: "Marketing", icone: Clapperboard, fase: true },
];

export type App = "nucleo" | "financeiro";

export function Marca({ compacta = false, app = "nucleo", escura = false }: { compacta?: boolean; app?: App; escura?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* logo oficial: versão clara (fundo transparente) ou a original sobre fundo escuro */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={escura ? "/logo-bra.webp" : "/logo-bra-claro.webp"} alt="BRA Ambientes Inteligentes — Empresa Grupo brtelecom" className={compacta ? "h-8 w-auto" : "h-10 w-auto"} />
      {!compacta && (
        <div className={`border-l pl-3 leading-tight ${escura ? "border-white/25" : "border-black/10"}`}>
          <div className={`font-display text-[15px] font-semibold tracking-tight ${escura ? "text-white" : "text-tinta"}`}>{app === "financeiro" ? "Financeiro" : "Núcleo"}</div>
          <div className={`text-[11px] font-medium ${escura ? "text-white/60" : "text-suave"}`}>{app === "financeiro" ? "Gestão financeira" : "Gestão da empresa"}</div>
        </div>
      )}
    </div>
  );
}

export function Shell({ titulo, acoes, children, app = "nucleo", itens, ativoHref, cheio = false }: {
  titulo: string; acoes?: React.ReactNode; children: React.ReactNode;
  /** conteúdo ocupa toda a área, sem título nem margens (ex.: Financeiro v38) */
  cheio?: boolean;
  /** "financeiro" = app independente BRA Financeiro (mesmo banco, menu próprio) */
  app?: App; itens?: readonly ItemNav[]; ativoHref?: string;
}) {
  const login = app === "financeiro" ? "/login/?app=financeiro" : "/login/";
  const caminho = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ id: string; nome: string; email: string; papel?: string } | null>(modoDemo ? { id: "demo", nome: "Modo demonstração", email: "", papel: "diretoria" } : null);
  const [avisosAbertos, setAvisosAbertos] = useState(false);
  const av = useAvisos(usuario);
  const [menuAberto, setMenuAberto] = useState(false);
  const versao = useAtualizacao();

  useEffect(() => {
    if (modoDemo) return;
    const db = supabase();
    db.auth.getSession().then(async ({ data }) => {
      if (!data.session) return router.replace(login);
      const { data: perfil } = await db.from("perfis").select("nome, email, ativo, papel").eq("id", data.session.user.id).single();
      if (!perfil?.ativo) { await db.auth.signOut(); return router.replace(login + (login.includes("?") ? "&" : "?") + "aguardando=1"); }
      // time técnico: área técnica, clientes, produtos e catálogos
      if (perfil.papel === "tecnico" && !ROTAS_TECNICO.some((r) => location.pathname.startsWith(r))) { router.replace("/tecnico/"); return; }
      setUsuario({ id: data.session.user.id, nome: perfil.nome, email: perfil.email, papel: perfil.papel });
    });
  }, [router, login]);

  async function sair() {
    if (!modoDemo) { await registrarAcesso("LOGOUT"); await supabase().auth.signOut(); }
    router.replace(login);
  }

  if (!usuario) return <div className="grid min-h-dvh place-items-center bg-fundo"><div className="animate-pulse"><Marca app={app} /></div></div>;

  const ativo = (href: string) => ativoHref ? href === ativoHref
    : href === "/" ? caminho === "/" : href === "/tecnico/" ? caminho.replace(/\/$/, "") === "/tecnico"
    : href.includes("?") ? caminho.startsWith(href.split("?")[0]) && typeof location !== "undefined" && location.search.includes(href.split("?")[1])
    : caminho.startsWith(href.split("?")[0]);
  const soDiretoria = ["/equipe/", "/historico/"];
  const lista = (usuario.papel === "tecnico" ? [...NAV_TECNICO, ...NAV.filter((i) => "href" in i && !i.fase && !i.href.startsWith("/tecnico") && ROTAS_TECNICO.some((r) => i.href.startsWith(r)))] : (itens ?? NAV)).filter((i) => !("href" in i) || !soDiretoria.includes(i.href) || usuario.papel === "diretoria");

  const nav = (
    <nav className="flex flex-1 flex-col gap-px px-3" aria-label="Principal">
      {lista.map((item, i) =>
        "grupo" in item ? (
          <div key={i} className="mt-5 mb-1 px-3 text-[11px] font-semibold text-suave/80">{item.grupo}</div>
        ) : (
          <Link key={item.href} href={item.href} onClick={() => setMenuAberto(false)}
            className={`group flex items-center gap-2.5 rounded-[9px] px-2.5 py-[7px] text-[13.5px] transition-colors ${item.sub ? "ml-6 py-[5px] text-[13px]" : ""} ${
              ativo(item.href) ? "bg-black/[.07] font-semibold text-tinta" : "text-tinta/80 hover:bg-black/[.04] hover:text-tinta"
            } ${item.fase ? "opacity-60" : ""}`}>
            <item.icone className={`size-[17px] shrink-0 ${ativo(item.href) ? "text-azul" : "text-azul/80"}`} strokeWidth={1.8} />
            {item.rotulo}
          </Link>
        ),
      )}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* barra lateral (desktop) */}
      <div className="relative hidden border-r border-black/[.07] bg-[#ececef]/80 lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col overflow-y-auto py-5">
        <div className="mb-5 px-5"><Marca app={app} /></div>
        <Sininho av={av} onAbrir={() => setAvisosAbertos(true)} />
        <BotaoClaude />
        {nav}
        <div className="mx-3 mt-4 flex items-center gap-2.5 rounded-xl bg-white/70 p-2.5 ring-1 ring-black/[.05]">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#a1a1a6] to-[#7c7c80] text-[12px] font-semibold text-white">{usuario.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
          <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-tinta">{usuario.nome}</div>
          {usuario.email && <div className="truncate text-[11.5px] text-suave">{usuario.email}</div>}
          </div>
          <button onClick={sair} title="Sair" aria-label="Sair" className="rounded-lg p-1.5 text-suave hover:bg-black/5 hover:text-tinta">
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
      </div>

      {/* topo (celular) */}
      <header className="vidro sticky top-0 z-30 flex items-center justify-between border-b border-black/[.07] px-4 py-2 lg:hidden">
        <Marca app={app} compacta />
        <div className="flex items-center">
        <BotaoClaude variante="icone" />
        <Sininho av={av} variante="icone" onAbrir={() => { setMenuAberto(false); setAvisosAbertos(true); }} />
        <button onClick={() => setMenuAberto(!menuAberto)} className="p-2 text-tinta" aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}>
          {menuAberto ? <X /> : <Menu />}
        </button>
        </div>
      </header>
      {menuAberto && (
        <div className="vidro fixed inset-0 top-[53px] z-20 flex flex-col overflow-y-auto pb-6 pt-2 lg:hidden">
          {nav}
          <button onClick={sair} className="mx-6 mt-4 flex items-center gap-2 text-sm text-suave"><LogOut className="size-4" /> Sair</button>
        </div>
      )}

      {versao.nova && (
        <div role="status" className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-marinho-900/95 px-4 py-3 text-[14px] text-white shadow-2xl backdrop-blur lg:right-4 lg:left-auto">
          <span className="flex-1">Há uma versão nova do Núcleo. Salve o que está editando e atualize.</span>
          <button onClick={versao.atualizar} className="rounded-full bg-azul px-3.5 py-1.5 text-[13px] font-semibold">Atualizar</button>
        </div>
      )}
      <PainelAvisos av={av} aberto={avisosAbertos} onFechar={() => setAvisosAbertos(false)} />
      <PopupEntrada av={av} usuario={usuario} onVerTudo={() => setAvisosAbertos(true)} />
      <AvisoInstantaneo av={av} />

      <main className="min-w-0">
        {modoDemo && (
          <div className="bg-atencao-claro px-6 py-2 text-[13px] text-atencao lg:px-10">
            <span className="sm:hidden">Modo demonstração · nada é gravado.</span>
            <span className="hidden sm:inline">Modo demonstração: os dados são dos seus documentos de exemplo e nada é gravado. Conecte o Supabase para usar de verdade.</span>
          </div>
        )}
        {cheio ? children : (<>
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-7 pb-5 lg:px-10 lg:pt-10">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight lg:text-[34px]">{titulo}</h1>
            {acoes}
          </div>
          <div className="px-5 pb-16 lg:px-10">{children}</div>
        </>)}
      </main>
    </div>
  );
}

export function Selo({ status }: { status: string }) {
  const mapa: Record<string, [string, string]> = {
    aberto: ["Em aberto", "bg-ciano-claro text-[#0a6a96]"],
    pago: ["Pago", "bg-ok-claro text-ok"],
    vencido: ["Vencido", "bg-erro-claro text-erro"],
    cancelado: ["Cancelado", "bg-fundo text-suave"],
    enviada: ["Enviada", "bg-ciano-claro text-[#0a6a96]"],
    aprovada: ["Aprovada", "bg-ok-claro text-ok"],
    recusada: ["Recusada", "bg-erro-claro text-erro"],
    substituida: ["Substituída", "bg-fundo text-suave"],
    rascunho: ["Rascunho", "bg-fundo text-suave"],
    emitida: ["Emitida", "bg-ok-claro text-ok"],
    cancelada: ["Cancelada", "bg-erro-claro text-erro"],
    em_negociacao: ["Em negociação", "bg-ciano-claro text-[#0a6a96]"],
    em_execucao: ["Em execução", "bg-atencao-claro text-atencao"],
    entregue: ["Entregue", "bg-ok-claro text-ok"],
    pos_venda: ["Pós-venda", "bg-fundo text-suave"],
  };
  const [rotulo, cls] = mapa[status] ?? [status, "bg-fundo text-suave"];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${cls}`}>{rotulo}</span>;
}

export function Bloco({ titulo, extra, children, className = "" }: { titulo?: string; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`sombra-bra rounded-[18px] border border-linha bg-white ${className}`}>
      {titulo && (
        <div className="flex items-center justify-between gap-3 border-b border-linha px-5 py-3.5">
          <h2 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">{titulo}</h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-10 text-center text-[14px] text-suave">{children}</div>;
}
