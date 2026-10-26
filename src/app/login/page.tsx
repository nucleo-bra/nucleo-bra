"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Marca } from "@/components/Shell";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";

function Formulario() {
  const router = useRouter();
  const aguardando = useSearchParams().get("aguardando");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(aguardando ? "Seu acesso ainda não foi liberado. Peça à diretoria para ativar seu usuário." : "");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (modoDemo) return router.replace("/");
    setEnviando(true); setErro("");
    const { error } = await supabase().auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) return setErro(mensagemErro(error));
    router.replace("/");
  }

  return (
    <form onSubmit={entrar} className="w-full max-w-sm">
      <h1 className="mb-1 text-[26px] font-semibold text-white">Entrar no Núcleo</h1>
      <p className="mb-8 text-[14px] text-[#a9b4cc]">Acesso restrito à equipe BRA Ambientes.</p>
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
    </form>
  );
}

export default function Login() {
  return (
    <div className="grid min-h-dvh bg-marinho-900 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-between p-8 lg:p-14">
        <Marca />
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
        <div className="absolute bottom-14 left-14 right-14 text-[15px] leading-relaxed text-[#c7d0e2]">
          Propostas, notas, recebimentos e clientes num só lugar.
        </div>
      </div>
    </div>
  );
}
