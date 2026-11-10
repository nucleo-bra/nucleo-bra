"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { ListaObras } from "@/components/obras/lista";
import { DetalheObra } from "@/components/obras/detalhe";

function Conteudo() {
  const p = useSearchParams(), id = p.get("id");
  return <Shell titulo="Obras" cheio>{id ? <DetalheObra key={id} id={id} abaInicial={p.get("aba")} docInicial={p.get("doc")} /> : <ListaObras />}</Shell>;
}
export default function ObrasPagina() { return <Suspense><Conteudo /></Suspense>; }
