// Núcleo do DocuSign — TypeScript puro (sem dependências), roda igual no
// navegador, no Node (testes) e no Deno (Edge Function "docusign").
// O script scripts/gerar-funcao-docusign.mjs junta este arquivo com o
// manipulador HTTP em supabase/functions/docusign/index.ts.

export type ConfigDocusign = {
  chaveIntegracao: string;   // Integration Key (client_id) do app no DocuSign
  usuarioId: string;         // User ID (GUID) de quem envia — você
  chavePrivada: string;      // RSA private key do app (PEM)
  servidorAuth: string;      // account-d.docusign.com (teste) | account.docusign.com (produção)
  contaId?: string;          // API Account ID (opcional: usa a conta padrão)
};
export type SignatarioDocusign = { papel: "cliente" | "bra" | "representante"; nome: string; email: string; ordem: number };
export type StatusContrato = "rascunho" | "enviado" | "assinado" | "recusado" | "cancelado" | "encerrado";

export const ANCORAS: Record<SignatarioDocusign["papel"], string> = {
  cliente: "/ass_cliente/",
  bra: "/ass_bra/",
  representante: "/ass_rep/",
};

// ------------------------------------------------------------------ base64
export function paraBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function deBase64(b64: string): Uint8Array {
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
export function pemParaPkcs8(pem: string): Uint8Array {
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
export async function criarJwt(cfg: ConfigDocusign, agora = Math.floor(Date.now() / 1000)): Promise<string> {
  const cab = b64url(texto(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const corpo = b64url(texto(JSON.stringify({
    iss: cfg.chaveIntegracao, sub: cfg.usuarioId, aud: cfg.servidorAuth, iat: agora, exp: agora + 3600, scope: "signature impersonation",
  })));
  const chave = await crypto.subtle.importKey("pkcs8", pemParaPkcs8(cfg.chavePrivada) as BufferSource,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const ass = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, texto(`${cab}.${corpo}`) as BufferSource));
  return `${cab}.${corpo}.${b64url(ass)}`;
}

export const urlConsentimento = (cfg: Pick<ConfigDocusign, "chaveIntegracao" | "servidorAuth">, retorno: string) =>
  `https://${cfg.servidorAuth}/oauth/auth?response_type=code&scope=${encodeURIComponent("signature impersonation")}` +
  `&client_id=${encodeURIComponent(cfg.chaveIntegracao)}&redirect_uri=${encodeURIComponent(retorno)}`;

export class ErroDocusign extends Error {
  constructor(msg: string, public codigo = "", public consentimento = false) { super(msg); }
}

type Fetch = typeof fetch;
export type Sessao = { token: string; base: string; contaId: string; expira: number };

/** Obtém o token (JWT Grant) e descobre a URL base da conta. */
export async function abrirSessao(cfg: ConfigDocusign, f: Fetch = fetch): Promise<Sessao> {
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
export function montarEnvelope(p: {
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

export function validarSignatarios(s: SignatarioDocusign[]): string | null {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const x of s) {
    if (!x.nome.trim()) return `Falta o nome de quem assina (${x.papel}).`;
    if (!re.test(x.email.trim())) return `E-mail inválido para ${x.nome || x.papel}.`;
  }
  if (!s.some((x) => x.papel === "cliente")) return "O cliente precisa estar entre os signatários.";
  return null;
}

export const enviarEnvelope = (s: Sessao, envelope: unknown, f: Fetch = fetch) =>
  api<{ envelopeId: string; status: string; statusDateTime: string }>(s, "/envelopes", { method: "POST", body: JSON.stringify(envelope) }, f);
export const consultarEnvelope = (s: Sessao, id: string, f: Fetch = fetch) =>
  api<{ envelopeId: string; status: string; declinedDateTime?: string; completedDateTime?: string; voidedReason?: string }>(s, `/envelopes/${id}`, {}, f);
export const consultarSignatarios = (s: Sessao, id: string, f: Fetch = fetch) =>
  api<{ signers: { name: string; email: string; status: string; roleName?: string; signedDateTime?: string; declinedReason?: string; deliveredDateTime?: string }[] }>(s, `/envelopes/${id}/recipients`, {}, f);
export const baixarAssinado = (s: Sessao, id: string, f: Fetch = fetch) =>
  api<Uint8Array>(s, `/envelopes/${id}/documents/combined`, { headers: { accept: "application/pdf" } }, f);
export const cancelarEnvelope = (s: Sessao, id: string, motivo: string, f: Fetch = fetch) =>
  api<unknown>(s, `/envelopes/${id}`, { method: "PUT", body: JSON.stringify({ status: "voided", voidedReason: motivo.slice(0, 200) || "Cancelado pela BRA" }) }, f);
export const reenviarAvisos = (s: Sessao, id: string, f: Fetch = fetch) =>
  api<unknown>(s, `/envelopes/${id}?resend_envelope=true`, { method: "PUT", body: "{}" }, f);

// ------------------------------------------------------------------ status
export function statusDoEnvelope(st: string): StatusContrato | null {
  switch ((st || "").toLowerCase()) {
    case "sent": case "delivered": case "signed": return "enviado";
    case "completed": return "assinado";
    case "declined": return "recusado";
    case "voided": return "cancelado";
    default: return null;
  }
}

export const ROTULO_EVENTO: Record<string, string> = {
  "envelope-sent": "Enviado para assinatura",
  "envelope-delivered": "Aberto pelos signatários",
  "envelope-completed": "Assinado por todos",
  "envelope-declined": "Assinatura recusada",
  "envelope-voided": "Envelope cancelado",
  "recipient-completed": "Assinou",
  "recipient-declined": "Recusou",
};

/** Lê o aviso (Connect / eventNotification JSON) que o DocuSign manda para o webhook. */
export function lerWebhook(corpo: unknown): { evento: string; envelopeId: string; status: string; quem?: string; motivo?: string } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as { event?: string; data?: { envelopeId?: string; recipientId?: string; envelopeSummary?: { status?: string; recipients?: { signers?: { recipientId: string; name: string; declinedReason?: string }[] } } } };
  const envelopeId = c.data?.envelopeId;
  if (!c.event || !envelopeId) return null;
  const resumo = c.data?.envelopeSummary;
  const sig = resumo?.recipients?.signers?.find((x) => x.recipientId === c.data?.recipientId);
  return { evento: c.event, envelopeId, status: resumo?.status ?? "", quem: sig?.name, motivo: sig?.declinedReason };
}
