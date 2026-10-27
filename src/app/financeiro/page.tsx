"use client";
import { Suspense } from "react";
import { ConteudoFinanceiro } from "@/components/ModuloFinanceiro";

export default function Financeiro() {
  return <Suspense><ConteudoFinanceiro /></Suspense>;
}
