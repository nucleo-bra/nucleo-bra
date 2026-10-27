"use client";
import { Shell } from "@/components/Shell";

// O Financeiro é o próprio v38 (mesma tela, mesmas abas), servido em /fin/
// e gravando no banco do Núcleo. Aqui ele aparece dentro do menu do Núcleo.
export default function Financeiro() {
  return (
    <Shell titulo="Financeiro" cheio>
      <iframe src="/fin/" title="Financeiro BRA"
        className="block h-[calc(100dvh-59px)] w-full border-0 lg:h-dvh" />
    </Shell>
  );
}
