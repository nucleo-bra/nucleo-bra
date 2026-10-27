// Monta supabase/functions/agenda-ics/index.ts (arquivo único, para colar no
// editor de Edge Functions do Supabase) a partir de src/lib/ics.ts.
import { readFileSync, writeFileSync } from "node:fs";
const ics = readFileSync("src/lib/ics.ts", "utf8");
const handler = `
// ------------------------------------------------------------------ função
// GET /functions/v1/agenda-ics?t=<link secreto>  →  text/calendar
// Publicar com "Verify JWT" desligado: o iPhone não envia login; quem protege é o link.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get("t") ?? "").replace(/\\.ics$/, "");
  if (!/^[a-f0-9]{48}$/.test(token)) return new Response("Link inválido", { status: 404 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("agenda_por_token", { p_token: token });
  if (error) return new Response("Erro ao gerar a agenda", { status: 500 });
  if (!data) return new Response("Link inválido", { status: 404 });
  const corpo = gerarIcs(data as EventoIcs[], { nome: "BRA CRM", url: "https://nucleo-bra.vercel.app/crm/" });
  return new Response(corpo, {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store", "content-disposition": 'inline; filename="bra-crm.ics"' },
  });
});
`;
writeFileSync("supabase/functions/agenda-ics/index.ts",
  "// Gerado por scripts/gerar-funcao-agenda.mjs — não editar à mão.\n" + ics.replace(/^export /gm, "") + handler);
console.log("supabase/functions/agenda-ics/index.ts gerado");
