"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Marca } from "@/components/Shell";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";

function Formulario() {
  const router = useRouter();
  const params = useSearchParams();
  const aguardando = params.get("aguardando");
  const fin = params.get("app") === "financeiro";
  const destino = fin ? "/fin/" : "/";
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(aguardando ? "Seu acesso ainda não foi liberado. Peça à diretoria para ativar seu usuário." : "");
  const [enviando, setEnviando] = useState(false);
  const [modo, setModo] = useState<"entrar" | "pedir">("entrar");
  const [nome, setNome] = useState("");
  const [area, setArea] = useState<"tecnico" | "comercial" | "financeiro">("tecnico");
  const [pedido, setPedido] = useState("");

  async function pedirAcesso(e: React.FormEvent) {
    e.preventDefault();
    if (modoDemo) { setPedido("No modo demonstração nada é gravado."); return; }
    if (senha.length < 8) { setErro("A senha precisa ter pelo menos 8 caracteres."); return; }
    setEnviando(true); setErro("");
    const db = supabase();
    const { data, error } = await db.auth.signUp({
      email: email.trim(), password: senha,
      options: { data: { nome: nome.trim(), papel_pedido: area }, emailRedirectTo: `${location.origin}/login/` },
    });
    setEnviando(false);
    if (error) return setErro(/already registered|already been registered/i.test(error.message) ? "Este e-mail já tem cadastro. Use Entrar ou peça para a diretoria liberar." : mensagemErro(error));
    if (data.session) await db.auth.signOut();
    setSenha("");
    setPedido(data.session
      ? "Pedido enviado. A diretoria foi avisada e libera o seu acesso no Núcleo. Depois é só entrar com este e-mail e senha."
      : "Pedido enviado. Confirme o seu e-mail pelo link que chegou na caixa de entrada; a diretoria foi avisada e libera o acesso em seguida.");
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (modoDemo) return router.replace(destino);
    setEnviando(true); setErro("");
    const { error } = await supabase().auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) return setErro(mensagemErro(error));
    router.replace(destino);
  }

  const campo = "w-full rounded-lg border border-marinho-700 bg-marinho-800 px-3.5 py-2.5 text-white outline-none focus:border-ciano";
  if (modo === "pedir") return (
    <form onSubmit={pedirAcesso} className="w-full max-w-sm">
      <h1 className="mb-1 text-[26px] font-semibold text-white">Solicitar acesso</h1>
      <p className="mb-6 text-[14px] text-[#a9b4cc]">Crie o seu login. A diretoria recebe o pedido e libera o acesso.</p>
      {pedido ? (
        <div role="status" className="rounded-xl bg-ok/15 px-4 py-3 text-[14px] text-[#9ff0c3]">{pedido}</div>
      ) : (<>
        <label className="mb-1.5 block text-[13px] text-[#a9b4cc]" htmlFor="nome">Nome completo</label>
        <input id="nome" required autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} className={`mb-4 ${campo}`} />
        <label className="mb-1.5 block text-[13px] text-[#a9b4cc]" htmlFor="email2">E-mail</label>
        <input id="email2" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mb-4 ${campo}`} />
        <span className="mb-1.5 block text-[13px] text-[#a9b4cc]">Área</span>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {([["tecnico", "Técnica"], ["comercial", "Comercial"], ["financeiro", "Financeira"]] as const).map(([k, r]) => (
            <button key={k} type="button" onClick={() => setArea(k)} aria-pressed={area === k}
              className={`rounded-lg border px-2 py-2 text-[13.5px] font-semibold transition ${area === k ? "border-ciano bg-ciano/15 text-white" : "border-marinho-700 text-[#a9b4cc] hover:border-marinho-500"}`}>{r}</button>
          ))}
        </div>
        <label className="mb-1.5 block text-[13px] text-[#a9b4cc]" htmlFor="senha2">Crie uma senha (mínimo 8 caracteres)</label>
        <input id="senha2" type="password" required minLength={8} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={`mb-6 ${campo}`} />
        {erro && <p role="alert" className="mb-4 rounded-lg bg-erro/15 px-3 py-2 text-[13px] text-[#ffb4b4]">{erro}</p>}
        <button disabled={enviando} className="w-full rounded-lg bg-br py-2.5 font-medium text-white transition-colors hover:bg-br-escuro disabled:opacity-60">{enviando ? "Enviando…" : "Enviar pedido"}</button>
      </>)}
      <button type="button" onClick={() => { setModo("entrar"); setErro(""); setPedido(""); }} className="mt-5 text-[13.5px] font-semibold text-ciano hover:underline">← Voltar para Entrar</button>
    </form>
  );

  return (
    <form onSubmit={entrar} className="w-full max-w-sm">
      <h1 className="mb-1 text-[26px] font-semibold text-white">{fin ? "Entrar no Financeiro" : "Entrar no Núcleo"}</h1>
      <p className="mb-8 text-[14px] text-[#a9b4cc]">{fin ? "Mesmo login do Núcleo. Acesso restrito à equipe BRA Ambientes." : "Acesso restrito à equipe BRA Ambientes."}</p>
      <label className="mb-1.5 block text-[13px] text-[#a9b4cc]" htmlFor="email">E-mail</label>
      <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        className="mb-4 w-full rounded-lg border border-marinho-700 bg-marinho-800 px-3.5 py-2.5 text-white outline-none focus:border-ciano" />
      <label className="mb-1.5 block text-[13px] text-[#a9b4cc]" htmlFor="senha">Senha</label>
      <input id="senha" type="password" autoComplete="current-password" required={!modoDemo} value={senha} onChange={(e) => setSenha(e.target.value)}
        className="mb-6 w-full rounded-lg border border-marinho-700 bg-marinho-800 px-3.5 py-2.5 text-white outline-none focus:border-ciano" />
      {erro && <p role="alert" className="mb-4 rounded-lg bg-erro/15 px-3 py-2 text-[13px] text-[#ffb4b4]">{erro}</p>}
      <button disabled={enviando} className="w-full rounded-lg bg-br py-2.5 font-medium text-white transition-colors hover:bg-br-escuro disabled:opacity-60">
        {enviando ? "Entrando…" : modoDemo ? "Abrir demonstração" : "Entrar"}
      </button>
      {!fin && <p className="mt-5 text-[13.5px] text-[#a9b4cc]">Primeiro acesso? <button type="button" onClick={() => { setModo("pedir"); setErro(""); }} className="font-semibold text-ciano hover:underline">Solicitar acesso</button></p>}
    </form>
  );
}

function MarcaLogin() {
  return <Marca app={useSearchParams().get("app") === "financeiro" ? "financeiro" : "nucleo"} />;
}

export default function Login() {
  return (
    <div className="grid min-h-dvh bg-marinho-900 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-between p-8 lg:p-14">
        <Suspense fallback={<Marca />}><MarcaLogin /></Suspense>
        <div className="flex flex-1 items-center py-12"><Suspense><Formulario /></Suspense></div>
        <p className="text-[12px] text-marinho-500">Grupo BRTelecom</p>
      </div>
      <div className="relative hidden overflow-hidden bg-marinho-950 lg:block">
        {/* o "A" da marca, grande, como janela de luz */}
        <svg viewBox="0 0 600 800" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <defs>
            <linearGradient id="la" x1="0" y1="1" x2="0.6" y2="0">
              <stop offset="0" stopColor="#163a73" /><stop offset="0.6" stopColor="#2b8fc4" /><stop offset="1" stopColor="#7ee0f2" />
            </linearGradient>
            <linearGradient id="lb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e04e2b" stopOpacity="0" /><stop offset="1" stopColor="#e04e2b" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <path d="M120 820 L300 120 Q330 40 360 120 L560 820 L440 820 L330 400 L240 820 Z" fill="url(#la)" opacity="0.9" />
          <path d="M330 400 L440 820 L560 820 Z" fill="url(#lb)" />
        </svg>
        <div className="absolute bottom-14 left-14 max-w-sm rounded-2xl bg-marinho-950/70 p-5 text-[#c7d0e2] ring-1 ring-white/10 backdrop-blur">
          <div className="font-display text-[19px] font-bold text-white">A BRA inteira num só lugar</div>
          <p className="mt-1 text-[14px] leading-relaxed">Financeiro, CRM, contratos, clientes e o time técnico — conectados, no computador e no celular.</p>
        </div>
      </div>
    </div>
  );
}
