"use client";
import { useEffect, useState } from "react";
import { meuPapel, Papel } from "./equipe";

/** Papel do usuário logado; null enquanto carrega. */
export function usePapel(): Papel | null {
  const [p, setP] = useState<Papel | null>(null);
  useEffect(() => { meuPapel().then(setP).catch(() => setP(null)); }, []);
  return p;
}
