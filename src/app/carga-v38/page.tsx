"use client";
// Página temporária: carrega os dados exportados do Financeiro v38 (arquivo
// criptografado) na tabela fin_docs, com o login da diretoria. Removida após o uso.
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { mensagemErro, supabase } from "@/lib/supabase";
import { formatarReais } from "@/lib/dados";

const ARQUIVO = "/carga-cfaa2004eea32938.bin";
type Linha = { colecao: string; id: string; dados: Record<string, unknown> };

async function abrir(chaveHex: string): Promise<Linha[]> {
  const bin = new Uint8Array(await (await fetch(ARQUIVO, { cache: "no-store" })).arrayBuffer());
  const chave = await crypto.subtle.importKey("raw", new Uint8Array(chaveHex.match(/../g)!.map((h) => parseInt(h, 16))), "AES-GCM", false, ["decrypt"]);
  const gz = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bin.slice(0, 12) }, chave, bin.slice(12));
  const texto = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(texto);
}

export default function Carga() {
  const [msg, setMsg] = useState<string[]>([]);
  const [rodando, setRodando] = useState(false);
  const log = (m: string) => setMsg((a) => [...a, m]);

  async function carregar() {
    setRodando(true); setMsg([]);
    try {
      const linhas = await abrir(location.hash.slice(1));
      log(`Arquivo aberto: ${linhas.length} documentos.`);
      const db = supabase();
      const { data: u } = await db.auth.getUser();
      for (let i = 0; i < linhas.length; i += 200) {
        const lote = linhas.slice(i, i + 200).map((l) => ({ ...l, atualizado_por: u.user?.id }));
        const { error } = await db.from("fin_docs").upsert(lote, { onConflict: "colecao,id" });
        if (error) throw error;
        log(`Gravados ${Math.min(i + 200, linhas.length)} de ${linhas.length}`);
      }
      const { data, error } = await db.from("fin_lancamentos").select("valor, valor_recebido");
      if (error) throw error;
      const tot = data!.reduce((s, r) => s + Number(r.valor), 0), rec = data!.reduce((s, r) => s + Number(r.valor_recebido ?? 0), 0);
      log(`Conferência no banco: ${data!.length} lançamentos · total ${formatarReais(tot)} · recebido ${formatarReais(rec)}`);
    } catch (e) { log("Erro: " + mensagemErro(e)); }
    setRodando(false);
  }

  return (
    <Shell titulo="Carga do Financeiro v38">
      <button onClick={carregar} disabled={rodando} className="rounded-xl bg-azul px-4 py-2 font-semibold text-white disabled:opacity-50">
        {rodando ? "Carregando…" : "Carregar dados do v38"}
      </button>
      <ul className="mt-5 space-y-1 text-[14px]" id="resultado">{msg.map((m, i) => <li key={i}>{m}</li>)}</ul>
    </Shell>
  );
}
