"use client";
// Endereço antigo da busca: agora a busca de itens fica na própria página Catálogos.
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { BuscaItensCatalogos } from "@/components/catalogos/busca-itens";

function Busca() { return <BuscaItensCatalogos inicial={useSearchParams().get("q") ?? ""} autoFoco />; }
export default function TextoCatalogos() {
  return <Shell titulo="Busca nos catálogos"><Suspense><Busca /></Suspense></Shell>;
}
