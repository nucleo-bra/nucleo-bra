import { describe, expect, it } from "vitest";
import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { criarJwt, lerWebhook, montarEnvelope, pemParaPkcs8, statusDoEnvelope, urlConsentimento, validarSignatarios } from "@/lib/docusign";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pkcs1 = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });
const cfg = { chaveIntegracao: "ik-123", usuarioId: "user-guid", chavePrivada: pkcs1, servidorAuth: "account-d.docusign.com" };

describe("DocuSign", () => {
  it("converte a chave PKCS#1 do DocuSign para PKCS#8", () => {
    expect(Buffer.from(pemParaPkcs8(pkcs1)).equals(pkcs8)).toBe(true);
    // também aceita a chave colada com \n literais
    expect(Buffer.from(pemParaPkcs8(pkcs1.replace(/\n/g, "\\n"))).equals(pkcs8)).toBe(true);
  });

  it("assina o JWT (RS256) com as declarações exigidas", async () => {
    const jwt = await criarJwt(cfg, 1_800_000_000);
    const [h, c, a] = jwt.split(".");
    const v = createVerify("RSA-SHA256"); v.update(`${h}.${c}`);
    expect(v.verify(createPublicKey(publicKey.export({ type: "spki", format: "pem" })), Buffer.from(a, "base64url"))).toBe(true);
    const corpo = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(corpo).toMatchObject({ iss: "ik-123", sub: "user-guid", aud: "account-d.docusign.com", iat: 1_800_000_000, exp: 1_800_003_600, scope: "signature impersonation" });
  });

  it("monta o envelope com âncoras e webhook", () => {
    const e = montarEnvelope({
      assunto: "Contrato 20261025", mensagem: "Olá", documentoBase64: "QUJD", nomeArquivo: "Contrato.docx", extensao: "docx", contratoId: "c1",
      signatarios: [{ papel: "cliente", nome: "Cliente X", email: "c@x.com", ordem: 1 }, { papel: "bra", nome: "Matheus", email: "m@bra.com", ordem: 2 }],
      webhookUrl: "https://h/functions/v1/docusign?t=abc",
    });
    expect(e.recipients.signers[0].tabs.signHereTabs[0].anchorString).toBe("/ass_cliente/");
    expect(e.recipients.signers[1]).toMatchObject({ routingOrder: "2", name: "Matheus" });
    expect(e.eventNotification?.url).toContain("t=abc");
    expect(e.documents[0]).toMatchObject({ fileExtension: "docx", documentId: "1" });
  });

  it("valida signatários e traduz status", () => {
    expect(validarSignatarios([{ papel: "cliente", nome: "A", email: "sem-arroba", ordem: 1 }])).toMatch(/E-mail inválido/);
    expect(validarSignatarios([{ papel: "bra", nome: "A", email: "a@b.com", ordem: 1 }])).toMatch(/cliente/);
    expect(statusDoEnvelope("completed")).toBe("assinado");
    expect(statusDoEnvelope("declined")).toBe("recusado");
    expect(statusDoEnvelope("delivered")).toBe("enviado");
    expect(urlConsentimento(cfg, "https://nucleo-bra.vercel.app/contratos/")).toContain("client_id=ik-123");
  });

  it("lê o aviso do webhook", () => {
    const w = lerWebhook({ event: "recipient-declined", data: { envelopeId: "env1", recipientId: "1", envelopeSummary: { status: "declined", recipients: { signers: [{ recipientId: "1", name: "Cliente X", declinedReason: "valor" }] } } } });
    expect(w).toEqual({ evento: "recipient-declined", envelopeId: "env1", status: "declined", quem: "Cliente X", motivo: "valor" });
    expect(lerWebhook({ foo: 1 })).toBeNull();
  });
});
