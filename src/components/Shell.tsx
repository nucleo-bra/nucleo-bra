"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FileDown, Wallet, Handshake, FileSignature, Package, Clapperboard, LogOut, Menu, X, SquareKanban, Map as MapIcon,
  Wrench, Headset, CalendarClock,
} from "lucide-react";
import { modoDemo, supabase } from "@/lib/supabase";
import { AvisoInstantaneo, PainelAvisos, PopupEntrada, Sininho, useAvisos } from "./avisos";

type ItemNav = { href: string; rotulo: string; icone: typeof Wallet; fase?: boolean; sub?: boolean } | { grupo: string };



/** Área técnica: o que o time técnico enxerga. */
export const NAV_TECNICO: readonly ItemNav[] = [
  { href: "/tecnico/", rotulo: "Técnico", icone: Wrench },
  { href: "/tecnico/projetos/", rotulo: "Projetos", icone: SquareKanban, sub: true },
  { href: "/tecnico/chamados/", rotulo: "Chamados", icone: Headset, sub: true },
  { href: "/tecnico/agendamentos/", rotulo: "Agendamentos", icone: CalendarClock, sub: true },
];

const NAV: readonly ItemNav[] = [
  { href: "/", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/financeiro/", rotulo: "Financeiro", icone: Wallet },
  { href: "/clientes/", rotulo: "Clientes", icone: Users },
  { href: "/crm/", rotulo: "CRM", icone: Handshake },
  { href: "/mapa/", rotulo: "Mapa", icone: MapIcon },
  { href: "/contratos/", rotulo: "Contratos", icone: FileSignature },
  ...NAV_TECNICO,
  { href: "/importar/", rotulo: "Importar", icone: FileDown },
  { grupo: "Próximas fases" },
  { href: "/modulo/?m=estoque", rotulo: "Estoque", icone: Package, fase: true },
  { href: "/modulo/?m=marketing", rotulo: "Marketing", icone: Clapperboard, fase: true },
];

export type App = "nucleo" | "financeiro";

export function Marca({ compacta = false, app = "nucleo" }: { compacta?: boolean; app?: App }) {
  return (
    <div className="flex items-center gap-3">
      {/* logo oficial (mesmo do Financeiro v38), fundo idêntico ao da barra */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-bra.webp" alt="BRA Ambientes Inteligentes — Empresa Grupo brtelecom" className={compacta ? "h-8 w-auto" : "h-11 w-auto"} />
      {!compacta && (
        <div className="border-l border-white/25 pl-3 leading-tight">
          <div className="font-display text-[15px] font-bold text-white">{app === "financeiro" ? "Financeiro" : "Núcleo"}</div>
          <div className="text-[11px] font-medium text-[#b9c6ee]">{app === "financeiro" ? "Gestão financeira" : "Gestão da empresa"}</div>
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

  useEffect(() => {
    if (modoDemo) return;
    const db = supabase();
    db.auth.getSession().then(async ({ data }) => {
      if (!data.session) return router.replace(login);
      const { data: perfil } = await db.from("perfis").select("nome, email, ativo, papel").eq("id", data.session.user.id).single();
      if (!perfil?.ativo) { await db.auth.signOut(); return router.replace(login + (login.includes("?") ? "&" : "?") + "aguardando=1"); }
      // time técnico: acesso só à área técnica
      if (perfil.papel === "tecnico" && !location.pathname.startsWith("/tecnico")) { router.replace("/tecnico/"); return; }
      setUsuario({ id: data.session.user.id, nome: perfil.nome, email: perfil.email, papel: perfil.papel });
    });
  }, [router, login]);

  async function sair() {
    if (!modoDemo) await supabase().auth.signOut();
    router.replace(login);
  }

  if (!usuario) return <div className="grid min-h-dvh place-items-center bg-marinho-900"><Marca app={app} /></div>;

  const ativo = (href: string) => ativoHref ? href === ativoHref
    : href === "/" ? caminho === "/" : href === "/tecnico/" ? caminho.replace(/\/$/, "") === "/tecnico" : caminho.startsWith(href.split("?")[0]);
  const lista = usuario.papel === "tecnico" ? NAV_TECNICO : (itens ?? NAV);

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Principal">
      {lista.map((item, i) =>
        "grupo" in item ? (
          <div key={i} className="mt-6 mb-1.5 px-3 text-[11px] font-medium text-marinho-500">{item.grupo}</div>
        ) : (
          <Link key={item.href} href={item.href} onClick={() => setMenuAberto(false)}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${item.sub ? "ml-5 py-1.5 text-[13.5px]" : ""} ${
              ativo(item.href) ? "bg-white/12 text-white shadow-[inset_3px_0_0_#22c7d6]" : "text-[#b9c6ee] hover:bg-white/8 hover:text-white"
            } ${item.fase ? "opacity-70" : ""}`}>
            <item.icone className={`size-[18px] ${ativo(item.href) ? "text-ciano" : ""}`} strokeWidth={1.75} />
            {item.rotulo}
          </Link>
        ),
      )}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* barra lateral (desktop) */}
      <div className="relative hidden bg-marinho-900 bg-[radial-gradient(420px_220px_at_100%_0,rgba(34,199,214,.18),transparent_70%),radial-gradient(360px_200px_at_0_100%,rgba(245,130,31,.12),transparent_70%)] lg:block">
      <div className="faixa-bra absolute inset-y-0 right-0 w-[3px]" aria-hidden />
      <aside className="sticky top-0 flex h-dvh flex-col py-6">
        <div className="mb-6 px-6"><Marca app={app} /></div>
        <Sininho av={av} onAbrir={() => setAvisosAbertos(true)} />
        {nav}
        <div className="mx-3 mt-4 rounded-lg border border-marinho-800 p-3">
          <div className="truncate text-[13px] text-white">{usuario.nome}</div>
          {usuario.email && <div className="truncate text-[12px] text-marinho-500">{usuario.email}</div>}
          <button onClick={sair} className="mt-2 flex items-center gap-1.5 text-[12px] text-[#a9b4cc] hover:text-white">
            <LogOut className="size-3.5" /> Sair
          </button>
        </div>
      </aside>
      </div>

      {/* topo (celular) */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-marinho-900 px-4 py-2.5 lg:hidden">
        <div className="faixa-bra absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
        <Marca app={app} compacta />
        <div className="flex items-center">
        <Sininho av={av} variante="icone" onAbrir={() => { setMenuAberto(false); setAvisosAbertos(true); }} />
        <button onClick={() => setMenuAberto(!menuAberto)} className="p-2 text-white" aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}>
          {menuAberto ? <X /> : <Menu />}
        </button>
        </div>
      </header>
      {menuAberto && (
        <div className="fixed inset-0 top-[60px] z-20 flex flex-col bg-marinho-900 pb-6 pt-2 lg:hidden">
          {nav}
          <button onClick={sair} className="mx-6 mt-4 flex items-center gap-2 text-sm text-[#a9b4cc]"><LogOut className="size-4" /> Sair</button>
        </div>
      )}

      <PainelAvisos av={av} aberto={avisosAbertos} onFechar={() => setAvisosAbertos(false)} />
      <PopupEntrada av={av} usuario={usuario} onVerTudo={() => setAvisosAbertos(true)} />
      <AvisoInstantaneo av={av} />

      <main className="min-w-0">
        {modoDemo && (
          <div className="bg-atencao-claro px-6 py-2 text-[13px] text-atencao lg:px-10">
            Modo demonstração: os dados são dos seus documentos de exemplo e nada é gravado. Conecte o Supabase para usar de verdade.
          </div>
        )}
        {cheio ? children : (<>
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-7 pb-5 lg:px-10 lg:pt-10">
            <h1 className="text-[26px] font-extrabold leading-tight lg:text-[30px]">{titulo}</h1>
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
    aberto: ["Em aberto", "bg-ciano-claro text-[#14708c]"],
    pago: ["Pago", "bg-ok-claro text-ok"],
    vencido: ["Vencido", "bg-erro-claro text-erro"],
    cancelado: ["Cancelado", "bg-fundo text-suave"],
    enviada: ["Enviada", "bg-ciano-claro text-[#14708c]"],
    aprovada: ["Aprovada", "bg-ok-claro text-ok"],
    recusada: ["Recusada", "bg-erro-claro text-erro"],
    substituida: ["Substituída", "bg-fundo text-suave"],
    rascunho: ["Rascunho", "bg-fundo text-suave"],
    emitida: ["Emitida", "bg-ok-claro text-ok"],
    cancelada: ["Cancelada", "bg-erro-claro text-erro"],
    em_negociacao: ["Em negociação", "bg-ciano-claro text-[#14708c]"],
    em_execucao: ["Em execução", "bg-atencao-claro text-atencao"],
    entregue: ["Entregue", "bg-ok-claro text-ok"],
    pos_venda: ["Pós-venda", "bg-fundo text-suave"],
  };
  const [rotulo, cls] = mapa[status] ?? [status, "bg-fundo text-suave"];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${cls}`}>{rotulo}</span>;
}

export function Bloco({ titulo, extra, children, className = "" }: { titulo?: string; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-linha bg-white ${className}`}>
      {titulo && (
        <div className="flex items-center justify-between gap-3 border-b border-linha px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{titulo}</h2>
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
