"use client";
// Endereço antigo: Projetos agora fica dentro de Técnico.
import { useEffect } from "react";
export default function Redireciona() {
  useEffect(() => { location.replace("/tecnico/projetos/" + location.search); }, []);
  return null;
}
