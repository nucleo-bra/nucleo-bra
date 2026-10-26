"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import {
  LayoutDashboard, Users, FileDown, Wallet, Handshake, FileSignature, Package, Clapperboard, LogOut, Menu, X,
} from "lucide-react";
import { modoDemo, supabase } from "@/lib/supabase";

const NAV = [
  { href: "/", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/clientes/", rotulo: "Clientes", icone: Users },
  { href: "/importar/", rotulo: "Importar", icone: FileDown },
  { grupo: "Próximas fases" },
  { href: "/modulo/?m=financeiro", rotulo: "Financeiro", icone: Wallet, fase: true },
  { href: "/modulo/?m=crm", rotulo: "CRM", icone: Handshake, fase: true },
  { href: "/modulo/?m=contratos", rotulo: "Contratos", icone: FileSignature, fase: true },
  { href: "/modulo/?m=estoque", rotulo: "Estoque", icone: Package, fase: true },
  { href: "/modulo/?m=marketing", rotulo: "Marketing", icone: Clapperboard, fase: true },
] as const;

export function Marca({ compacta = false }: { compacta?: boolean }) {
  const gid = useId();
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className="size-9 shrink-0" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#1f5fa8" /><stop offset="1" stopColor="#5fd3ec" />
          </linearGradient>
        </defs>
        <path d="M14 36 L24 6 Q26 2 28 6 L38 36 L31 36 L26 19 L21 36 Z" fill={`url(#${gid})`} />
        <text x="1" y="33" fontFamily="Poppins, sans-serif" fontWeight="700" fontSize="19" fill="#e04e2b">br</text>
      </svg>
      {!compacta && (
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold text-white">Núcleo</div>
          <div className="text-[11px] text-marinho-500">BRA Ambientes</div>
        </div>
      )}
    </div>
  );
}

export function Shell({ titulo, acoes, children }: { titulo: string; acoes?: React.ReactNode; children: React.ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const [usuario, setUsuario] = useState<{ nome: string; email: string } | null>(modoDemo ? { nome: "Modo demonstração", email: "" } : null);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (modoDemo) return;
    const db = supabase();
    db.auth.getSession().then(async ({ data }) => {
      if (!data.session) return router.replace("/login/");
      const { data: perfil } = await db.from("perfis").select("nome, email, ativo").eq("id", data.session.user.id).single();
      if (!perfil?.ativo) { await db.auth.signOut(); return router.replace("/login/?aguardando=1"); }
      setUsuario({ nome: perfil.nome, email: perfil.email });
    });
  }, [router]);

  async function sair() {
    if (!modoDemo) await supabase().auth.signOut();
    router.replace("/login/");
  }

  if (!usuario) return <div className="grid min-h-dvh place-items-center bg-marinho-900"><Marca /></div>;

  const ativo = (href: string) => (href === "/" ? caminho === "/" : caminho.startsWith(href.split("?")[0]));

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Principal">
      {NAV.map((item, i) =>
        "grupo" in item ? (
          <div key={i} className="mt-6 mb-1.5 px-3 text-[11px] font-medium text-marinho-500">{item.grupo}</div>
        ) : (
          <Link key={item.href} href={item.href} onClick={() => setMenuAberto(false)}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${
              ativo(item.href) ? "bg-marinho-800 text-white" : "text-[#a9b4cc] hover:bg-marinho-800/60 hover:text-white"
            } ${"fase" in item ? "opacity-70" : ""}`}>
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
      <div className="hidden bg-marinho-900 lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col py-6">
        <div className="mb-8 px-6"><Marca /></div>
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
      <header className="sticky top-0 z-30 flex items-center justify-between bg-marinho-900 px-4 py-3 lg:hidden">
        <Marca />
        <button onClick={() => setMenuAberto(!menuAberto)} className="p-2 text-white" aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}>
          {menuAberto ? <X /> : <Menu />}
        </button>
      </header>
      {menuAberto && (
        <div className="fixed inset-0 top-[60px] z-20 flex flex-col bg-marinho-900 pb-6 pt-2 lg:hidden">
          {nav}
          <button onClick={sair} className="mx-6 mt-4 flex items-center gap-2 text-sm text-[#a9b4cc]"><LogOut className="size-4" /> Sair</button>
        </div>
      )}

      <main className="min-w-0">
        {modoDemo && (
          <div className="bg-atencao-claro px-6 py-2 text-[13px] text-atencao lg:px-10">
            Modo demonstração: os dados são dos seus documentos de exemplo e nada é gravado. Conecte o Supabase para usar de verdade.
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-7 pb-5 lg:px-10 lg:pt-10">
          <h1 className="text-[26px] font-semibold leading-tight lg:text-[30px]">{titulo}</h1>
          {acoes}
        </div>
        <div className="px-5 pb-16 lg:px-10">{children}</div>
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
