"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { DetalheContrato, ListaContratos } from "@/components/contratos/visoes";

function Conteudo() {
  const p = useSearchParams();
  const id = p.get("c");
  return <Shell titulo="Contratos" cheio>{id ? <DetalheContrato key={id} id={id} /> : <ListaContratos novoDoNegocio={p.get("novo")} />}</Shell>;
}
export default function ContratosPagina() { return <Suspense><Conteudo /></Suspense>; }
