"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { QuadroView } from "@/components/projetos/quadro";
import { quadroDoModulo } from "@/lib/projetos";
import { mensagemErro } from "@/lib/supabase";

function Conteudo() {
  const c = useSearchParams().get("c");
  const [id, setId] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => { quadroDoModulo("agendamentos").then(setId).catch((e) => setErro(mensagemErro(e))); }, []);
  return (
    <Shell titulo="Agendamentos" cheio>
      {erro ? <p role="alert" className="m-6 rounded-xl bg-erro-claro px-4 py-3 text-erro">{erro}</p>
        : id ? <QuadroView key={id + (c ?? "")} id={id} abrirInicial={c} /> : <p className="p-6 text-suave">Carregando…</p>}
    </Shell>
  );
}
export default function Pagina() { return <Suspense><Conteudo /></Suspense>; }
