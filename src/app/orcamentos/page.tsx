"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package } from "lucide-react";
import { Shell } from "@/components/Shell";
import { EditorOrcamento } from "@/components/orcamentos/editor";
import { ListaOrcamentos } from "@/components/orcamentos/lista";

function Conteudo() {
  const p = useSearchParams(), router = useRouter();
  const id = p.get("id"), novo = p.get("novo");
  const abrir = (x: string) => router.push(`/orcamentos/?id=${x}`);
  return (
    <Shell titulo="Orçamentos" acoes={<Link href="/produtos/" className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13.5px] font-semibold hover:shadow-md"><Package className="size-4" />Produtos e estoque</Link>}>
      {id || novo ? <EditorOrcamento key={id ?? novo} id={id} negocioId={novo} onTrocar={(x) => router.replace(`/orcamentos/?id=${x}`)} /> : <ListaOrcamentos onAbrir={abrir} />}
    </Shell>
  );
}
export default function OrcamentosPagina() { return <Suspense><Conteudo /></Suspense>; }
