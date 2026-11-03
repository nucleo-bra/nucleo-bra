"use client";
// Equipe interna que recebe comissão em todo negócio fechado (ex.: Caio Lisboa —
// engenheiro 1,48% · Raquel Monção — projetista 0,24%). Entra sozinha em todo
// lançamento no Financeiro (CRM, contrato, XML/boleto) e pode ser ajustada ali.
import { useEffect, useState } from "react";
import { modoDemo, supabase } from "@/lib/supabase";
import { campo, Rotulo } from "@/components/crm/ui";

export type Comissao = { n: string; r: string; p: number };
const DEMO: Comissao[] = [{ n: "Caio Lisboa", r: "Engenheiro", p: 1.48 }, { n: "Raquel Monção", r: "Projetista", p: 0.24 }];

let cache: Promise<Comissao[]> | null = null;
export function carregarEquipeComissao(): Promise<Comissao[]> {
  if (modoDemo) return Promise.resolve(DEMO);
  cache ??= (async () => {
    const { data, error } = await supabase().from("comissionados").select("nome, papel, percentual_padrao").eq("automatico", true).eq("ativo", true).order("nome");
    if (error) return [];
    return (data ?? []).map((x) => ({ n: x.nome as string, r: x.papel as string, p: Number(x.percentual_padrao) || 0 }));
  })();
  return cache;
}

/** Lista editável da equipe para somar às comissões do lançamento. */
export function useEquipeComissao() {
  const [equipe, setEquipe] = useState<Comissao[]>([]);
  useEffect(() => { carregarEquipeComissao().then(setEquipe).catch(() => setEquipe([])); }, []);
  return [equipe, setEquipe] as const;
}

export function CamposEquipe({ equipe, onChange }: { equipe: Comissao[]; onChange: (x: Comissao[]) => void }) {
  if (!equipe.length) return null;
  return (
    <>
      {equipe.map((c, i) => (
        <Rotulo key={c.n} rotulo={`% ${c.n.split(" ")[0]} (${c.r.toLowerCase()})`}>
          <input className={campo} type="number" step="any" min={0} value={c.p}
            onChange={(e) => onChange(equipe.map((x, k) => (k === i ? { ...x, p: Number(e.target.value) || 0 } : x)))} />
        </Rotulo>
      ))}
    </>
  );
}
