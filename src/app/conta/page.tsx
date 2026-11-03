"use client";
// Minha conta: ativar ou desativar a verificação em duas etapas.
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { Shell } from "@/components/Shell";
import { concluirAtivacao, desativar, estadoMfa, EstadoMfa, iniciarAtivacao, MFA_OBRIGATORIO } from "@/lib/mfa";
import { meuPapel } from "@/lib/equipe";
import { mensagemErro } from "@/lib/supabase";

function Conta() {
  const router = useRouter();
  const obrigatorio = useSearchParams().get("obrigatorio") === "1";
  const [mfa, setMfa] = useState<EstadoMfa | null>(null);
  const [papel, setPapel] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ id: string; qr: string; segredo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState(""), [ok, setOk] = useState(""), [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(() => { estadoMfa().then(setMfa).catch((e) => setErro(mensagemErro(e))); meuPapel().then(setPapel).catch(() => {}); }, []);
  useEffect(carregar, [carregar]);
  const exigido = !!papel && MFA_OBRIGATORIO.includes(papel);

  async function comecar() {
    setErro(""); setOcupado(true);
    try { setNovo(await iniciarAtivacao()); setCodigo(""); }
    catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  async function concluir(e: React.FormEvent) {
    e.preventDefault(); if (!novo) return;
    setErro(""); setOcupado(true);
    try {
      await concluirAtivacao(novo.id, codigo);
      setNovo(null); setOk("Verificação em duas etapas ativada. A partir de agora o Núcleo pede o código do app a cada login.");
      carregar();
      if (obrigatorio) setTimeout(() => router.replace("/"), 1800);
    } catch (x) { setErro(mensagemErro(x)); } finally { setOcupado(false); }
  }
  async function desligar() {
    if (!mfa?.fator_id) return;
    if (!confirm("Desativar a verificação em duas etapas? O login volta a pedir só a senha.")) return;
    setErro(""); setOcupado(true);
    try { await desativar(mfa.fator_id); setOk("Verificação desativada."); carregar(); }
    catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }

  return (
    <Shell titulo="Minha conta">
      <div className="max-w-2xl space-y-5">
        {obrigatorio && !mfa?.ativado && (
          <p className="flex items-start gap-2 rounded-xl bg-atencao-claro px-4 py-3 text-[14px] text-atencao"><ShieldAlert className="mt-0.5 size-5 shrink-0" />
            Para proteger o financeiro e os dados dos clientes, o seu perfil precisa ativar a verificação em duas etapas antes de continuar. Leva 1 minuto.</p>
        )}
        <section className="sombra-bra rounded-[18px] border border-linha bg-white">
          <header className="flex items-center gap-3 border-b border-linha px-5 py-4">
            <span className={`grid size-10 place-items-center rounded-xl ${mfa?.ativado ? "bg-ok-claro text-ok" : "bg-fundo text-suave"}`}>{mfa?.ativado ? <ShieldCheck className="size-5" /> : <KeyRound className="size-5" />}</span>
            <div className="flex-1">
              <h2 className="text-[16px] font-bold">Verificação em duas etapas</h2>
              <p className="text-[13px] text-suave">Além da senha, o login pede um código de 6 dígitos que muda a cada 30 segundos no seu celular.</p>
            </div>
            {mfa && <span className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${mfa.ativado ? "bg-ok-claro text-ok" : "bg-fundo text-suave"}`}>{mfa.ativado ? "Ativada" : "Desativada"}</span>}
          </header>
          <div className="px-5 py-4">
            {!mfa ? <p className="flex items-center gap-2 text-suave"><Loader2 className="size-4 animate-spin" />Carregando…</p>
              : mfa.ativado ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-[14px]"><CheckCircle2 className="size-4 text-ok" />Ativada. Guarde bem o celular com o app; se perder, peça à diretoria para zerar a verificação em Equipe.</p>
                  {exigido ? <p className="text-[12.5px] text-suave">Obrigatória para o perfil {papel === "diretoria" ? "Diretoria" : "Financeiro"}: não pode ser desativada.</p>
                    : <button onClick={desligar} disabled={ocupado} className="rounded-xl border border-linha px-3.5 py-2 text-[13.5px] font-semibold text-suave hover:border-erro hover:text-erro">Desativar</button>}
                </div>
              ) : !novo ? (
                <div className="space-y-3 text-[14px]">
                  <ol className="list-decimal space-y-1 pl-5 text-suave">
                    <li>Instale no celular um app autenticador: <b className="text-tinta">Google Authenticator</b>, <b className="text-tinta">Microsoft Authenticator</b> ou <b className="text-tinta">1Password</b>.</li>
                    <li>Clique em <b className="text-tinta">Ativar</b> e leia o QR code com o app.</li>
                    <li>Digite o código de 6 dígitos que aparecer no app.</li>
                  </ol>
                  <button onClick={comecar} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 font-semibold text-white shadow-md disabled:opacity-50">
                    {ocupado ? <Loader2 className="size-4 animate-spin" /> : <Smartphone className="size-4" />}Ativar
                  </button>
                </div>
              ) : (
                <form onSubmit={concluir} className="grid gap-5 sm:grid-cols-[200px_1fr]">
                  {/* QR code em SVG gerado pelo Supabase */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={novo.qr} alt="QR code para o app autenticador" className="size-[200px] rounded-xl border border-linha bg-white p-2" />
                  <div className="space-y-3 text-[14px]">
                    <p>Leia o QR code com o app autenticador. Se preferir digitar, use a chave:</p>
                    <code className="block rounded-lg bg-fundo px-3 py-2 font-mono text-[13px] break-all select-all">{novo.segredo}</code>
                    <label className="block text-[13px] font-semibold text-suave" htmlFor="cod">Código de 6 dígitos que aparece no app</label>
                    <input id="cod" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={7} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/[^\d ]/g, ""))}
                      placeholder="000000" className="w-44 rounded-xl border border-linha px-3 py-2 text-center font-mono text-[20px] tracking-[.3em] outline-none focus:border-azul" />
                    <div className="flex gap-2">
                      <button disabled={ocupado || codigo.replace(/\D/g, "").length !== 6} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-4 py-2 font-semibold text-white shadow-md disabled:opacity-50">
                        {ocupado ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Confirmar e ativar
                      </button>
                      <button type="button" onClick={() => setNovo(null)} className="rounded-xl border border-linha px-3.5 py-2 font-semibold text-suave">Cancelar</button>
                    </div>
                  </div>
                </form>
              )}
            {ok && <p role="status" className="mt-3 rounded-xl bg-ok-claro px-4 py-3 text-[13.5px] text-ok">{ok}</p>}
            {erro && <p role="alert" className="mt-3 rounded-xl bg-erro-claro px-4 py-3 text-[13.5px] text-erro">{erro}</p>}
          </div>
        </section>
      </div>
    </Shell>
  );
}

export default function Pagina() { return <Suspense><Conta /></Suspense>; }
