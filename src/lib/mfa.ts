"use client";
// Verificação em duas etapas (código de 6 dígitos de um app autenticador:
// Google Authenticator, Microsoft Authenticator, 1Password…).
import { modoDemo, supabase } from "./supabase";

// A verificação em duas etapas foi desligada (04/11/2026). Fica só o passo do
// código no login, caso algum usuário ainda tenha um app cadastrado.

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

/** Grava a entrada no histórico (falha em silêncio: nunca impede o login). */
export function registrarAcesso(acao: "LOGIN" | "LOGOUT", detalhe?: string) {
  if (modoDemo) return Promise.resolve();
  return Promise.resolve(supabase().rpc("registrar_acesso", { p_acao: acao, p_detalhe: detalhe ?? null })).then(() => undefined, () => undefined);
}
