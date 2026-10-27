// Monta supabase/functions/docusign/index.ts (arquivo único, para colar no
// editor de Edge Functions do Supabase) a partir de src/lib/docusign.ts.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const nucleo = readFileSync("src/lib/docusign.ts", "utf8");
const handler = String.raw`
// ------------------------------------------------------------------ função
// Publicar com "Verify JWT" DESLIGADO: o webhook do DocuSign não tem login.
// As chamadas do Núcleo são conferidas aqui (usuário logado e ativo);
// o webhook é conferido pelo token secreto na URL (?t=).
//
// Segredos (Edge Functions › Secrets):
//   DOCUSIGN_INTEGRATION_KEY  DOCUSIGN_USER_ID  DOCUSIGN_PRIVATE_KEY
//   DOCUSIGN_AUTH_SERVER (account-d.docusign.com = teste | account.docusign.com = produção)
//   DOCUSIGN_ACCOUNT_ID (opcional)  DOCUSIGN_WEBHOOK_TOKEN (texto aleatório longo)
import { createClient } from "jsr:@supabase/supabase-js@2";

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const resposta = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...CORS, "content-type": "application/json; charset=utf-8" } });
const RETORNO = (env("NUCLEO_URL") || "https://nucleo-bra.vercel.app") + "/contratos/";
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

function configuracao(): ConfigDocusign | null {
  const c = {
    chaveIntegracao: env("DOCUSIGN_INTEGRATION_KEY"), usuarioId: env("DOCUSIGN_USER_ID"),
    chavePrivada: env("DOCUSIGN_PRIVATE_KEY"), servidorAuth: env("DOCUSIGN_AUTH_SERVER") || "account-d.docusign.com",
    contaId: env("DOCUSIGN_ACCOUNT_ID") || undefined,
  };
  return c.chaveIntegracao && c.usuarioId && c.chavePrivada ? c : null;
}
let sessaoAtual: Sessao | null = null;
async function sessao(c: ConfigDocusign) {
  if (!sessaoAtual || sessaoAtual.expira < Date.now()) sessaoAtual = await abrirSessao(c);
  return sessaoAtual;
}

type Contrato = Record<string, any>;
async function evento(contrato_id: string, tipo: string, descricao: string, usuario_id: string | null, dados?: unknown) {
  await admin.from("contrato_eventos").insert({ contrato_id, tipo, descricao, usuario_id, dados: dados ?? null });
}

/** Busca o envelope no DocuSign e atualiza o contrato (e guarda o PDF assinado). */
async function sincronizar(c: ConfigDocusign, k: Contrato, usuario: string | null, origem: string) {
  const s = await sessao(c);
  const env_ = await consultarEnvelope(s, k.docusign_envelope_id);
  const novo = statusDoEnvelope(env_.status);
  const mud: Contrato = { docusign_status: env_.status, docusign_atualizado: new Date().toISOString() };
  if (novo && novo !== k.status && !(k.status === "encerrado")) mud.status = novo;
  if (env_.status === "declined") {
    const r = await consultarSignatarios(s, k.docusign_envelope_id).catch(() => null);
    const q = r?.signers.find((x) => x.status === "declined");
    mud.recusa_motivo = q ? q.name + ": " + (q.declinedReason ?? "sem motivo") : "Recusado";
  }
  if (env_.status === "completed") {
    mud.assinado_em = env_.completedDateTime ?? new Date().toISOString();
    if (!k.assinado_path) {
      const pdf = await baixarAssinado(s, k.docusign_envelope_id);
      const caminho = "contratos/" + k.id + "/assinado-" + (k.numero ?? k.id) + ".pdf";
      const up = await admin.storage.from("documentos").upload(caminho, pdf, { contentType: "application/pdf", upsert: true });
      if (up.error) throw up.error;
      mud.assinado_path = caminho;
    }
  }
  const { data, error } = await admin.from("contratos").update(mud).eq("id", k.id).select().single();
  if (error) throw error;
  if (mud.status && mud.status !== k.status) {
    const rot: Record<string, string> = { assinado: "Contrato assinado por todos — PDF assinado salvo", recusado: "Assinatura recusada · " + (mud.recusa_motivo ?? ""), cancelado: "Envelope cancelado no DocuSign", enviado: "Enviado para assinatura" };
    await evento(k.id, mud.status, rot[mud.status] ?? mud.status, usuario, { origem, docusign: env_.status });
  }
  return data;
}

async function webhook(req: Request, url: URL) {
  const esperado = env("DOCUSIGN_WEBHOOK_TOKEN");
  if (!esperado || url.searchParams.get("t") !== esperado) return new Response("não autorizado", { status: 401 });
  const c = configuracao();
  const w = lerWebhook(await req.json().catch(() => null));
  if (!c || !w) return new Response("ok");
  const { data: k } = await admin.from("contratos").select("*").eq("docusign_envelope_id", w.envelopeId).maybeSingle();
  if (!k) return new Response("ok");
  if (w.evento === "recipient-completed" && w.quem) await evento(k.id, "assinou", w.quem + " assinou", null, w);
  if (w.evento === "envelope-delivered") await evento(k.id, "entregue", "Envelope aberto pelo signatário", null, w);
  await sincronizar(c, k, null, "webhook");
  return new Response("ok");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  try {
    if (url.searchParams.has("t")) return await webhook(req, url);

    // ---- chamadas do Núcleo: precisa estar logado e ativo
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = await admin.auth.getUser(jwt);
    if (!u?.user) return resposta({ erro: "Faça login novamente." }, 401);
    const { data: perfil } = await admin.from("perfis").select("nome, ativo").eq("id", u.user.id).maybeSingle();
    if (!perfil?.ativo) return resposta({ erro: "Usuário sem acesso ao Núcleo." }, 403);
    const usuario = u.user.id;

    const corpo = await req.json().catch(() => ({}));
    const c = configuracao();
    if (corpo.acao === "config") {
      return resposta({
        configurado: !!c, ambiente: (c?.servidorAuth ?? env("DOCUSIGN_AUTH_SERVER") ?? "").includes("-d.") ? "teste" : "produção",
        consentimento: c ? urlConsentimento(c, RETORNO) : null, webhook: !!env("DOCUSIGN_WEBHOOK_TOKEN"),
      });
    }
    if (!c) return resposta({ erro: "O DocuSign ainda não foi configurado no Núcleo (faltam as chaves)." }, 400);
    if (corpo.acao === "testar") {
      const s = await sessao(c);
      return resposta({ ok: true, conta: s.contaId });
    }

    const { data: k } = await admin.from("contratos").select("*").eq("id", corpo.contrato_id ?? "").maybeSingle();
    if (!k) return resposta({ erro: "Contrato não encontrado." }, 404);

    if (corpo.acao === "enviar") {
      if (!k.arquivo_path) return resposta({ erro: "Gere ou anexe o arquivo do contrato antes de enviar." }, 400);
      if (k.status === "enviado" && k.docusign_envelope_id) return resposta({ erro: "Este contrato já está aguardando assinatura." }, 400);
      if (k.status === "assinado") return resposta({ erro: "Este contrato já foi assinado." }, 400);
      const { data: cfgRow } = await admin.from("config_empresa").select("valor").eq("chave", "contratos").maybeSingle();
      const cfgE = (cfgRow?.valor ?? {}) as Record<string, any>;
      const sig: SignatarioDocusign[] = [{ papel: "cliente", nome: k.cliente_nome ?? "", email: k.cliente_email ?? "", ordem: 1 }];
      const bra = cfgE.assinante_bra ?? {};
      sig.push({ papel: "bra", nome: bra.nome ?? "", email: bra.email ?? "", ordem: 2 });
      if (cfgE.representante_assina) sig.push({ papel: "representante", nome: cfgE.representante?.nome ?? "", email: cfgE.representante?.email ?? "", ordem: 2 });
      const inval = validarSignatarios(sig);
      if (inval) return resposta({ erro: inval }, 400);

      const arq = await admin.storage.from("documentos").download(k.arquivo_path);
      if (arq.error) throw arq.error;
      const bytes = new Uint8Array(await arq.data.arrayBuffer());
      const extensao = (k.arquivo_path.split(".").pop() ?? "docx").toLowerCase();
      const webhookUrl = env("DOCUSIGN_WEBHOOK_TOKEN") ? env("SUPABASE_URL") + "/functions/v1/docusign?t=" + env("DOCUSIGN_WEBHOOK_TOKEN") : undefined;
      const envelope = montarEnvelope({
        assunto: "Contrato " + (k.numero ?? "") + " · BRA Ambientes — assinatura",
        mensagem: corpo.mensagem || "Olá! Segue o contrato da BRA Ambientes para sua assinatura eletrônica. Qualquer dúvida, estamos à disposição.",
        documentoBase64: paraBase64(bytes), nomeArquivo: "Contrato " + (k.numero ?? "") + " - " + (k.cliente_nome ?? ""),
        extensao, signatarios: sig, webhookUrl, contratoId: k.id,
      });
      const s = await sessao(c);
      const r = await enviarEnvelope(s, envelope);
      const { data, error } = await admin.from("contratos").update({
        status: "enviado", enviado_em: new Date().toISOString(), docusign_envelope_id: r.envelopeId, docusign_status: r.status,
        docusign_atualizado: new Date().toISOString(), recusa_motivo: null, assinado_path: null,
      }).eq("id", k.id).select().single();
      if (error) throw error;
      await evento(k.id, "enviado", "Enviado ao DocuSign para " + sig.map((x) => x.nome + " <" + x.email + ">").join(", "), usuario, { envelope: r.envelopeId });
      return resposta({ contrato: data });
    }

    if (!k.docusign_envelope_id) return resposta({ erro: "Este contrato ainda não foi enviado ao DocuSign." }, 400);
    if (corpo.acao === "atualizar") return resposta({ contrato: await sincronizar(c, k, usuario, "manual") });
    if (corpo.acao === "reenviar") {
      await reenviarAvisos(await sessao(c), k.docusign_envelope_id);
      await evento(k.id, "lembrete", "Aviso de assinatura reenviado aos signatários", usuario);
      return resposta({ ok: true });
    }
    if (corpo.acao === "cancelar") {
      await cancelarEnvelope(await sessao(c), k.docusign_envelope_id, corpo.motivo ?? "");
      const { data } = await admin.from("contratos").update({ status: "cancelado", docusign_status: "voided", docusign_atualizado: new Date().toISOString() }).eq("id", k.id).select().single();
      await evento(k.id, "cancelado", "Envelope cancelado" + (corpo.motivo ? ": " + corpo.motivo : ""), usuario);
      return resposta({ contrato: data });
    }
    return resposta({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    const err = e as ErroDocusign;
    return resposta({ erro: err.message ?? String(e), consentimento: err.consentimento ? (configuracao() ? urlConsentimento(configuracao()!, RETORNO) : null) : undefined }, 500);
  }
});
`;
mkdirSync("supabase/functions/docusign", { recursive: true });
writeFileSync("supabase/functions/docusign/index.ts",
  "// Gerado por scripts/gerar-funcao-docusign.mjs — não editar à mão.\n" + nucleo.replace(/^export /gm, "") + handler);
console.log("supabase/functions/docusign/index.ts gerado");
