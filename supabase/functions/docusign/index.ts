// Gerado por scripts/gerar-funcao-docusign.mjs — não editar à mão.
// Núcleo do DocuSign — TypeScript puro (sem dependências), roda igual no
// navegador, no Node (testes) e no Deno (Edge Function "docusign").
// O script scripts/gerar-funcao-docusign.mjs junta este arquivo com o
// manipulador HTTP em supabase/functions/docusign/index.ts.

type ConfigDocusign = {
  chaveIntegracao: string;   // Integration Key (client_id) do app no DocuSign
  usuarioId: string;         // User ID (GUID) de quem envia — você
  chavePrivada: string;      // RSA private key do app (PEM)
  servidorAuth: string;      // account-d.docusign.com (teste) | account.docusign.com (produção)
  contaId?: string;          // API Account ID (opcional: usa a conta padrão)
};
type SignatarioDocusign = { papel: "cliente" | "bra" | "representante"; nome: string; email: string; ordem: number };
type StatusContrato = "rascunho" | "enviado" | "assinado" | "recusado" | "cancelado" | "encerrado";

const ANCORAS: Record<SignatarioDocusign["papel"], string> = {
  cliente: "/ass_cliente/",
  bra: "/ass_bra/",
  representante: "/ass_rep/",
};

// ------------------------------------------------------------------ base64
function paraBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function deBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
const b64url = (b: Uint8Array) => paraBase64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const texto = (s: string) => new TextEncoder().encode(s);

// ------------------------------------------------------------------ chave PEM
function derTamanho(n: number): number[] {
  if (n < 0x80) return [n];
  const b: number[] = [];
  while (n > 0) { b.unshift(n & 0xff); n >>= 8; }
  return [0x80 | b.length, ...b];
}
function der(tag: number, conteudo: Uint8Array): Uint8Array {
  const t = derTamanho(conteudo.length);
  const out = new Uint8Array(1 + t.length + conteudo.length);
  out[0] = tag; out.set(t, 1); out.set(conteudo, 1 + t.length);
  return out;
}
const junta = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };

/** Aceita a chave como o DocuSign entrega (PKCS#1 "BEGIN RSA PRIVATE KEY") ou PKCS#8; devolve PKCS#8 (DER). */
function pemParaPkcs8(pem: string): Uint8Array {
  const limpo = pem.replace(/\\n/g, "\n").trim();
  const pkcs1 = /BEGIN RSA PRIVATE KEY/.test(limpo);
  const corpo = limpo.replace(/-----(BEGIN|END)[^-]+-----/g, "").replace(/\s+/g, "");
  if (!corpo) throw new Error("Chave privada do DocuSign vazia ou inválida.");
  const bytes = deBase64(corpo);
  if (!pkcs1) return bytes;
  const versao = new Uint8Array([0x02, 0x01, 0x00]);
  const algoritmo = new Uint8Array([0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
  return der(0x30, junta(versao, algoritmo, der(0x04, bytes)));
}

// ------------------------------------------------------------------ JWT Grant
async function criarJwt(cfg: ConfigDocusign, agora = Math.floor(Date.now() / 1000)): Promise<string> {
  const cab = b64url(texto(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const corpo = b64url(texto(JSON.stringify({
    iss: cfg.chaveIntegracao, sub: cfg.usuarioId, aud: cfg.servidorAuth, iat: agora, exp: agora + 3600, scope: "signature impersonation",
  })));
  const chave = await crypto.subtle.importKey("pkcs8", pemParaPkcs8(cfg.chavePrivada) as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const ass = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, texto(`${cab}.${corpo}`) as BufferSource));
  return `${cab}.${corpo}.${b64url(ass)}`;
}

const urlConsentimento = (cfg: Pick<ConfigDocusign, "chaveIntegracao" | "servidorAuth">, retorno: string) =>
  `https://${cfg.servidorAuth}/oauth/auth?response_type=code&scope=${encodeURIComponent("signature impersonation")}` +
  `&client_id=${encodeURIComponent(cfg.chaveIntegracao)}&redirect_uri=${encodeURIComponent(retorno)}`;

class ErroDocusign extends Error {
  constructor(msg: string, public codigo = "", public consentimento = false) { super(msg); }
}

type Fetch = typeof fetch;
type Sessao = { token: string; base: string; contaId: string; expira: number };

/** Obtém o token (JWT Grant) e descobre a URL base da conta. */
async function abrirSessao(cfg: ConfigDocusign, f: Fetch = fetch): Promise<Sessao> {
  const r = await f(`https://${cfg.servidorAuth}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${await criarJwt(cfg)}`,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const codigo = String(j.error ?? r.status);
    if (codigo === "consent_required") throw new ErroDocusign("Falta autorizar o Núcleo no DocuSign (consentimento).", codigo, true);
    throw new ErroDocusign(`DocuSign recusou o login (${codigo}${j.error_description ? ": " + j.error_description : ""}).`, codigo);
  }
  const u = await f(`https://${cfg.servidorAuth}/oauth/userinfo`, { headers: { authorization: `Bearer ${j.access_token}` } });
  const info = await u.json();
  const contas: { account_id: string; is_default: boolean; base_uri: string }[] = info.accounts ?? [];
  const conta = contas.find((c) => c.account_id === cfg.contaId) ?? contas.find((c) => c.is_default) ?? contas[0];
  if (!conta) throw new ErroDocusign("Nenhuma conta DocuSign encontrada para este usuário.");
  return { token: j.access_token, base: `${conta.base_uri}/restapi/v2.1/accounts/${conta.account_id}`, contaId: conta.account_id, expira: Date.now() + (Number(j.expires_in ?? 3600) - 120) * 1000 };
}

async function api<T>(s: Sessao, caminho: string, init: RequestInit = {}, f: Fetch = fetch): Promise<T> {
  const r = await f(s.base + caminho, { ...init, headers: { authorization: `Bearer ${s.token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new ErroDocusign(`DocuSign: ${j.message ?? r.statusText} (${j.errorCode ?? r.status})`, j.errorCode ?? String(r.status));
  }
  return (r.headers.get("content-type") ?? "").includes("json") ? r.json() : (new Uint8Array(await r.arrayBuffer()) as unknown as T);
}

// ------------------------------------------------------------------ envelope
function montarEnvelope(p: {
  assunto: string; mensagem: string; documentoBase64: string; nomeArquivo: string; extensao: string;
  signatarios: SignatarioDocusign[]; webhookUrl?: string; contratoId: string;
}) {
  const signers = p.signatarios.map((s, i) => ({
    email: s.email.trim(), name: s.nome.trim(), recipientId: String(i + 1), routingOrder: String(s.ordem),
    roleName: s.papel,
    emailNotification: { supportedLanguage: "pt_BR" },
    tabs: {
      signHereTabs: [{
        anchorString: ANCORAS[s.papel], anchorUnits: "pixels", anchorXOffset: "-30", anchorYOffset: "-6",
        anchorIgnoreIfNotPresent: s.papel === "cliente" ? "false" : "true", anchorCaseSensitive: "false",
      }],
    },
  }));
  return {
    emailSubject: p.assunto.slice(0, 100),
    emailBlurb: p.mensagem,
    status: "sent",
    customFields: { textCustomFields: [{ name: "nucleo_contrato", value: p.contratoId, show: "false" }] },
    documents: [{ documentBase64: p.documentoBase64, name: p.nomeArquivo, fileExtension: p.extensao, documentId: "1" }],
    recipients: { signers },
    ...(p.webhookUrl ? {
      eventNotification: {
        url: p.webhookUrl, loggingEnabled: "true", requireAcknowledgment: "true", deliveryMode: "SIM",
        events: ["envelope-sent", "envelope-delivered", "envelope-completed", "envelope-declined", "envelope-voided", "recipient-completed", "recipient-declined"],
        eventData: { version: "restv2.1", format: "json", includeData: ["recipients"] },
      },
    } : {}),
  };
}

function validarSignatarios(s: SignatarioDocusign[]): string | null {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const x of s) {
    if (!x.nome.trim()) return `Falta o nome de quem assina (${x.papel}).`;
    if (!re.test(x.email.trim())) return `E-mail inválido para ${x.nome || x.papel}.`;
  }
  if (!s.some((x) => x.papel === "cliente")) return "O cliente precisa estar entre os signatários.";
  return null;
}

const enviarEnvelope = (s: Sessao, envelope: unknown, f: Fetch = fetch) =>
  api<{ envelopeId: string; status: string; statusDateTime: string }>(s, "/envelopes", { method: "POST", body: JSON.stringify(envelope) }, f);
const consultarEnvelope = (s: Sessao, id: string, f: Fetch = fetch) =>
  api<{ envelopeId: string; status: string; declinedDateTime?: string; completedDateTime?: string; voidedReason?: string }>(s, `/envelopes/${id}`, {}, f);
const consultarSignatarios = (s: Sessao, id: string, f: Fetch = fetch) =>
  api<{ signers: { name: string; email: string; status: string; roleName?: string; signedDateTime?: string; declinedReason?: string; deliveredDateTime?: string }[] }>(s, `/envelopes/${id}/recipients`, {}, f);
const baixarAssinado = (s: Sessao, id: string, f: Fetch = fetch) =>
  api<Uint8Array>(s, `/envelopes/${id}/documents/combined`, { headers: { accept: "application/pdf" } }, f);
const cancelarEnvelope = (s: Sessao, id: string, motivo: string, f: Fetch = fetch) =>
  api<unknown>(s, `/envelopes/${id}`, { method: "PUT", body: JSON.stringify({ status: "voided", voidedReason: motivo.slice(0, 200) || "Cancelado pela BRA" }) }, f);
const reenviarAvisos = (s: Sessao, id: string, f: Fetch = fetch) =>
  api<unknown>(s, `/envelopes/${id}?resend_envelope=true`, { method: "PUT", body: "{}" }, f);

// ------------------------------------------------------------------ status
function statusDoEnvelope(st: string): StatusContrato | null {
  switch ((st || "").toLowerCase()) {
    case "sent": case "delivered": case "signed": return "enviado";
    case "completed": return "assinado";
    case "declined": return "recusado";
    case "voided": return "cancelado";
    default: return null;
  }
}

const ROTULO_EVENTO: Record<string, string> = {
  "envelope-sent": "Enviado para assinatura",
  "envelope-delivered": "Aberto pelos signatários",
  "envelope-completed": "Assinado por todos",
  "envelope-declined": "Assinatura recusada",
  "envelope-voided": "Envelope cancelado",
  "recipient-completed": "Assinou",
  "recipient-declined": "Recusou",
};

/** Lê o aviso (Connect / eventNotification JSON) que o DocuSign manda para o webhook. */
function lerWebhook(corpo: unknown): { evento: string; envelopeId: string; status: string; quem?: string; motivo?: string } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as { event?: string; data?: { envelopeId?: string; recipientId?: string; envelopeSummary?: { status?: string; recipients?: { signers?: { recipientId: string; name: string; declinedReason?: string }[] } } } };
  const envelopeId = c.data?.envelopeId;
  if (!c.event || !envelopeId) return null;
  const resumo = c.data?.envelopeSummary;
  const sig = resumo?.recipients?.signers?.find((x) => x.recipientId === c.data?.recipientId);
  return { evento: c.event, envelopeId, status: resumo?.status ?? "", quem: sig?.name, motivo: sig?.declinedReason };
}

// ------------------------------------------------------------------ função
// Publicar com "Verify JWT" DESLIGADO: o webhook do DocuSign não tem login.
// As chamadas do Núcleo são conferidas aqui (usuário logado e ativo);
// o webhook é conferido pelo token secreto na URL (?t=).
//
// Segredos (Edge Functions › Secrets):
//   DOCUSIGN_INTEGRATION_KEY  DOCUSIGN_USER_ID  DOCUSIGN_PRIVATE_KEY
//   DOCUSIGN_AUTH_SERVER (account-d.docusign.com = teste | account.docusign.com = produção)
//   DOCUSIGN_ACCOUNT_ID (opcional)  DOCUSIGN_WEBHOOK_TOKEN (opcional: sem ele, o token do
//   webhook é derivado da chave de serviço do Supabase, que só esta função conhece)
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
/** Token secreto da URL do webhook. */
async function tokenWebhook(): Promise<string> {
  const fixo = env("DOCUSIGN_WEBHOOK_TOKEN");
  if (fixo) return fixo;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("nucleo-docusign-webhook:" + env("SUPABASE_SERVICE_ROLE_KEY")));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
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
  const esperado = await tokenWebhook();
  if (url.searchParams.get("t") !== esperado) return new Response("não autorizado", { status: 401 });
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
        consentimento: c ? urlConsentimento(c, RETORNO) : null, webhook: true,
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
      const webhookUrl = env("SUPABASE_URL") + "/functions/v1/docusign?t=" + (await tokenWebhook());
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
