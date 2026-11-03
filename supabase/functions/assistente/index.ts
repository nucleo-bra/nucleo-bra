// Assistente Claude do Núcleo BRA
// POST /functions/v1/assistente  { mensagens: [{ role: "user"|"assistant", content: string }], modo?: "geral"|"projeto"|"comparar" }
// Publicar com "Verify JWT" LIGADO: só quem está logado no Núcleo usa.
// Secret necessário (Edge Functions → Secrets): ANTHROPIC_API_KEY. Opcional: ANTHROPIC_MODEL.
// As consultas ao banco rodam com o login de quem pergunta (RLS), nunca com a chave de serviço.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "content-type": "application/json" } });

const PARADAS = new Set("a o os as de da do das dos e em um uma para por com sem que qual quais como mais menos no na nos nas ao aos se ser é eu me meu minha voce você isso esse essa este esta preciso quero tem ter ou entre sobre".split(" "));
const termos = (t: string) => [...new Set(t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().match(/[a-z0-9][a-z0-9\-\.]{1,}/g) ?? [])].filter((x) => !PARADAS.has(x)).slice(0, 12);

const SISTEMA = `Você é o assistente técnico-comercial da BRA Ambientes Inteligentes (Grupo BRTelecom), integradora de automação residencial e corporativa de alto padrão em Paulínia e Campinas/SP (revenda oficial Control4; parceiros como Episode, Sonos, Marantz, Klipsch, DALI, Ubiquiti, Intelbras, Hikvision, Epson).
Ajude a equipe a: recomendar soluções por ambiente (automação, rede/Wi-Fi, CFTV, sonorização, home theater, painel de LED, controle de acesso), comparar equipamentos, tirar dúvidas de especificação e montar escopos de orçamento.
Regras:
- Responda em português do Brasil, direto e organizado (listas curtas, tabelas em Markdown quando comparar).
- Use primeiro os PRODUTOS DO CADASTRO e a BASE DE CONHECIMENTO enviados abaixo; cite o código do produto (ex.: "cód. 564") e o preço de venda quando recomendar.
- Quando faltar informação no cadastro, diga que é conhecimento geral e que vale confirmar no catálogo do fabricante. Nunca invente preço, estoque ou especificação de um produto do cadastro.
- Para recomendações de projeto, pergunte o que for essencial (metragem, número de ambientes, cabeamento existente, orçamento) se não estiver claro, e sugira uma lista por ambiente com quantidades.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST" }, 405);
  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) return json({ erro: "O assistente ainda não foi configurado: falta o secret ANTHROPIC_API_KEY nas Edge Functions do Supabase." }, 503);

  const auth = req.headers.get("Authorization") ?? "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await db.auth.getUser();
  if (!u?.user) return json({ erro: "Faça login no Núcleo." }, 401);
  const { data: perfil } = await db.from("perfis").select("nome, ativo, papel").eq("id", u.user.id).single();
  if (!perfil?.ativo) return json({ erro: "Acesso não liberado." }, 403);

  let corpo: { mensagens?: { role: string; content: string }[]; modo?: string };
  try { corpo = await req.json(); } catch { return json({ erro: "Pedido inválido" }, 400); }
  const mensagens = (corpo.mensagens ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-16).map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 12000) }));
  if (!mensagens.length || mensagens[mensagens.length - 1].role !== "user") return json({ erro: "Envie uma pergunta." }, 400);

  // contexto: produtos do cadastro e notas da base de conhecimento ligados às últimas perguntas
  const texto = mensagens.filter((m) => m.role === "user").slice(-3).map((m) => m.content).join(" ");
  const t = termos(texto);
  let produtos: Record<string, unknown>[] = [], notas: Record<string, unknown>[] = [];
  if (t.length) {
    const ou = t.flatMap((x) => [`nome.ilike.%${x}%`, `modelo.ilike.%${x}%`, `marca.ilike.%${x}%`, `categoria.ilike.%${x}%`]).join(",");
    const [p, b] = await Promise.all([
      db.from("produtos").select("zenith_id, nome, marca, modelo, categoria, unidade, preco_venda, descricao, medidas").eq("ativo", true).or(ou).limit(60),
      db.from("base_conhecimento").select("titulo, conteudo, tags").or(t.flatMap((x) => [`titulo.ilike.%${x}%`, `conteudo.ilike.%${x}%`]).join(",")).limit(8),
    ]);
    const pontua = (r: Record<string, unknown>) => t.reduce((s, x) => s + (`${r.nome} ${r.modelo} ${r.marca} ${r.categoria}`.toLowerCase().includes(x) ? 1 : 0), 0);
    produtos = (p.data ?? []).sort((a, b) => pontua(b) - pontua(a)).slice(0, 30);
    notas = b.data ?? [];
  }
  const ctx = [
    produtos.length ? `PRODUTOS DO CADASTRO (preço de venda atual):\n${produtos.map((p) => `- cód. ${p.zenith_id ?? "—"} | ${p.nome} | ${p.marca ?? ""} | ${p.categoria ?? ""} | R$ ${Number(p.preco_venda ?? 0).toFixed(2)} / ${p.unidade}${p.medidas ? ` | ${p.medidas}` : ""}${p.descricao ? `\n  ${String(p.descricao).replace(/\s+/g, " ").slice(0, 400)}` : ""}`).join("\n")}` : "PRODUTOS DO CADASTRO: nenhum produto do cadastro bate com a pergunta.",
    notas.length ? `BASE DE CONHECIMENTO DA BRA:\n${notas.map((n) => `## ${n.titulo}\n${String(n.conteudo).slice(0, 3000)}`).join("\n\n")}` : "",
    corpo.modo === "projeto" ? "MODO: recomendação de projeto — monte a solução por ambiente com quantidades." : corpo.modo === "comparar" ? "MODO: comparativo — compare em tabela e termine com uma recomendação." : "",
    `Quem pergunta: ${perfil.nome} (${perfil.papel}).`,
  ].filter(Boolean).join("\n\n");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5", max_tokens: 2500, system: `${SISTEMA}\n\n${ctx}`, messages: mensagens }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ erro: `Claude respondeu com erro (${r.status}): ${d?.error?.message ?? "tente de novo"}` }, 502);
  const resposta = (d.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n").trim();
  return json({ resposta, produtos: produtos.map((p) => p.zenith_id).filter(Boolean) });
});
