"use client";
// Os orçamentos vivem no cartão do negócio, no CRM. Esta rota só redireciona
// links antigos (/orcamentos/?id=… e ?novo=…) para lá.
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { EditorOrcamento } from "@/components/orcamentos/editor";
import { ListaOrcamentos } from "@/components/orcamentos/lista";
import { supabase } from "@/lib/supabase";

function Conteudo() {
  const p = useSearchParams(), router = useRouter();
  const id = p.get("id"), novo = p.get("novo");
  useEffect(() => {
    if (novo) { router.replace(`/crm/?aba=negocios&n=${novo}&orc=novo`); return; }
    if (!id) return;
    supabase().from("propostas").select("oportunidade_id").eq("id", id).single().then(({ data }) => {
      if (data?.oportunidade_id) router.replace(`/crm/?aba=negocios&n=${data.oportunidade_id}&orc=${id}`);
    });
  }, [id, novo, router]);
  return (
    <Shell titulo="Orçamentos">
      {id ? <EditorOrcamento key={id} id={id} onTrocar={(x) => router.replace(`/orcamentos/?id=${x}`)} /> : novo ? null : <ListaOrcamentos onAbrir={(x) => router.push(`/orcamentos/?id=${x}`)} />}
    </Shell>
  );
}
export default function OrcamentosPagina() { return <Suspense><Conteudo /></Suspense>; }
