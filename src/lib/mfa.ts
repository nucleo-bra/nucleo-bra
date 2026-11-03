"use client";
// Verificação em duas etapas (código de 6 dígitos de um app autenticador:
// Google Authenticator, Microsoft Authenticator, 1Password…).
import { modoDemo, supabase } from "./supabase";

/** Papéis que precisam ter a verificação ativada para usar o Núcleo. */
export const MFA_OBRIGATORIO = ["diretoria", "financeiro"];

export type EstadoMfa = { ativado: boolean; falta_codigo: boolean; fator_id: string | null };

/** Situação da sessão atual: se o usuário tem a verificação e se já digitou o código. */
export async function estadoMfa(): Promise<EstadoMfa> {
  if (modoDemo) return { ativado: false, falta_codigo: false, fator_id: null };
  const db = supabase();
  const [{ data: nivel }, { data: fatores }] = await Promise.all([db.auth.mfa.getAuthenticatorAssuranceLevel(), db.auth.mfa.listFactors()]);
  const totp = fatores?.totp?.find((f) => f.status === "verified") ?? null;
  return { ativado: !!totp, falta_codigo: nivel?.nextLevel === "aal2" && nivel?.currentLevel !== "aal2", fator_id: totp?.id ?? null };
}

/** Confere o código de 6 dígitos no login. */
export async function confirmarCodigo(codigo: string) {
  const db = supabase();
  const { data: fatores } = await db.auth.mfa.listFactors();
  const f = fatores?.totp?.find((x) => x.status === "verified");
  if (!f) throw new Error("Verificação em duas etapas não encontrada.");
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId: f.id, code: codigo.replace(/\D/g, "") });
  if (error) throw new Error(/invalid|expired/i.test(error.message) ? "Código inválido ou vencido. Confira o app e digite o código atual." : error.message);
}

/** Começa a ativação: devolve o QR code para ler no app e a chave para digitar à mão. */
export async function iniciarAtivacao(): Promise<{ id: string; qr: string; segredo: string }> {
  const db = supabase();
  // pedidos de ativação que ficaram pela metade atrapalham o novo
  const { data: fatores } = await db.auth.mfa.listFactors();
  for (const f of fatores?.all ?? []) if (f.status !== "verified") await db.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: `Núcleo BRA ${new Date().toLocaleDateString("pt-BR")}`, issuer: "Núcleo BRA" });
  if (error) throw error;
  return { id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
}

/** Termina a ativação com o primeiro código gerado pelo app. */
export async function concluirAtivacao(fatorId: string, codigo: string) {
  const db = supabase();
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo.replace(/\D/g, "") });
  if (error) throw new Error(/invalid|expired/i.test(error.message) ? "Código inválido. Confira se o horário do celular está certo e tente o código atual." : error.message);
  await db.rpc("registrar_acesso", { p_acao: "MFA_ATIVADO" });
}

/** Desliga a verificação (exige a sessão com código). */
export async function desativar(fatorId: string) {
  const db = supabase();
  const { error } = await db.auth.mfa.unenroll({ factorId: fatorId });
  if (error) throw error;
  await db.rpc("registrar_acesso", { p_acao: "MFA_REMOVIDO" });
}

/** Grava a entrada no histórico (falha em silêncio: nunca impede o login). */
export function registrarAcesso(acao: "LOGIN" | "LOGOUT", detalhe?: string) {
  if (modoDemo) return Promise.resolve();
  return Promise.resolve(supabase().rpc("registrar_acesso", { p_acao: acao, p_detalhe: detalhe ?? null })).then(() => undefined, () => undefined);
}
