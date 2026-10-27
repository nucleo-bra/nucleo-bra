"use client";
import { Suspense } from "react";
import { ConteudoFinanceiro } from "@/components/ModuloFinanceiro";

// BRA Financeiro: app independente, mesmo banco do Núcleo
export default function BraFinanceiro() {
  return <Suspense><ConteudoFinanceiro app="financeiro" /></Suspense>;
}
