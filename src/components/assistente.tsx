"use client";
// Conversa com o Claude dentro do Núcleo (botão flutuante e painel de recomendação).
// A pergunta vai para a função "assistente" do Supabase, que consulta o cadastro de
// produtos e a base de conhecimento com o login de quem pergunta.
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageSquareText, Send, Sparkles, Trash2, X } from "lucide-react";
import { modoDemo, supabase } from "@/lib/supabase";

/** Liga o assistente no sistema. Fica desligado até a chave ANTHROPIC_API_KEY ser cadastrada no Supabase. */
export const ASSISTENTE_ATIVO = false;

export type Msg = { role: "user" | "assistant"; content: string };
export type Modo = "geral" | "projeto" | "comparar";

export async function perguntar(mensagens: Msg[], modo: Modo = "geral"): Promise<string> {
  if (modoDemo) return "Modo demonstração: conecte o Núcleo ao Supabase para usar o assistente.";
  const { data, error } = await supabase().functions.invoke("assistente", { body: { mensagens, modo } });
  if (error) {
    let msg = error.message;
    try { const c = await (error as { context?: Response }).context?.json(); if (c?.erro) msg = c.erro; } catch { /* corpo sem JSON */ }
    if (/not found|404/i.test(msg)) msg = "O assistente ainda não foi publicado no Supabase (função “assistente”).";
    throw new Error(msg);
  }
  if (data?.erro) throw new Error(data.erro);
  return data?.resposta ?? "";
}

/** Markdown simples (títulos, negrito, listas, tabelas) sem biblioteca. */
function Texto({ t }: { t: string }) {
  const linhas = t.split("\n");
  const out: React.ReactNode[] = [];
  const inline = (s: string, k: string) => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith("**") ? <b key={k + i}>{p.slice(2, -2)}</b> : p.startsWith("`") ? <code key={k + i} className="rounded bg-fundo px-1 text-[12.5px]">{p.slice(1, -1)}</code> : p);
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (/^\s*\|/.test(l) && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1] ?? "")) {
      const cab = l.split("|").map((x) => x.trim()).filter(Boolean); const corpo: string[][] = [];
      i += 2; while (i < linhas.length && /^\s*\|/.test(linhas[i])) { corpo.push(linhas[i].split("|").map((x) => x.trim()).filter((_, k, a) => k > 0 && k < a.length - 1 || a.length === 1)); i++; } i--;
      out.push(<div key={i} className="my-2 overflow-x-auto"><table className="w-full text-[12.5px]"><thead><tr>{cab.map((c, k) => <th key={k} className="border-b border-linha bg-fundo px-2 py-1 text-left">{inline(c, "h" + k)}</th>)}</tr></thead>
        <tbody>{corpo.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j} className="border-b border-linha px-2 py-1 align-top">{inline(c, `${k}-${j}`)}</td>)}</tr>)}</tbody></table></div>);
    } else if (/^#{1,4}\s/.test(l)) out.push(<p key={i} className="mt-2 font-bold">{inline(l.replace(/^#+\s/, ""), "t" + i)}</p>);
    else if (/^\s*([-*•]|\d+[.)])\s/.test(l)) out.push(<p key={i} className="flex gap-1.5 pl-1"><span className="text-suave">{/^\s*\d/.test(l) ? l.trim().split(/\s/)[0] : "•"}</span><span>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s/, ""), "l" + i)}</span></p>);
    else if (!l.trim()) out.push(<div key={i} className="h-2" />);
    else out.push(<p key={i}>{inline(l, "p" + i)}</p>);
  }
  return <div className="space-y-0.5 text-[13.5px] leading-relaxed">{out}</div>;
}

export function Conversa({ modo = "geral", sugestoes = [], chave = "nucleo-claude", altura = "h-[60dvh]" }: { modo?: Modo; sugestoes?: string[]; chave?: string; altura?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>(() => { try { return JSON.parse(sessionStorage.getItem(chave) ?? "[]"); } catch { return []; } });
  const [texto, setTexto] = useState(""), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { try { sessionStorage.setItem(chave, JSON.stringify(msgs.slice(-30))); } catch { /* sem armazenamento */ } fim.current?.scrollIntoView({ block: "end" }); }, [msgs, chave]);
  async function enviar(t = texto) {
    const p = t.trim(); if (!p || ocupado) return;
    const nova = [...msgs, { role: "user" as const, content: p }];
    setMsgs(nova); setTexto(""); setErro(""); setOcupado(true);
    try { const r = await perguntar(nova, modo); setMsgs([...nova, { role: "assistant", content: r }]); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  }
  return (
    <div className={`flex ${altura} flex-col`}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {!msgs.length && (
          <div className="space-y-2 py-2">
            <p className="text-[13px] text-suave">Pergunte sobre produtos, especificações, comparativos ou peça uma recomendação de projeto. O assistente consulta o cadastro de produtos e a base de conhecimento da BRA.</p>
            {sugestoes.map((s) => <button key={s} onClick={() => enviar(s)} className="block w-full rounded-xl border border-linha bg-white px-3 py-2 text-left text-[13px] hover:border-azul">{s}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${m.role === "user" ? "bg-marinho-900 text-white" : "border border-linha bg-white text-tinta"}`}>
              {m.role === "user" ? <p className="text-[13.5px] whitespace-pre-wrap">{m.content}</p> : <Texto t={m.content} />}
            </div>
          </div>
        ))}
        {ocupado && <div className="flex items-center gap-2 text-[13px] text-suave"><Loader2 className="size-4 animate-spin" />Pensando…</div>}
        {erro && <p role="alert" className="rounded-xl bg-erro-claro px-3 py-2 text-[13px] text-erro">{erro}</p>}
        <div ref={fim} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-end gap-2 border-t border-linha p-3">
        {msgs.length > 0 && <button type="button" onClick={() => { setMsgs([]); setErro(""); }} className="rounded-lg p-2 text-suave hover:bg-fundo" title="Nova conversa"><Trash2 className="size-4" /></button>}
        <textarea rows={1} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Escreva sua pergunta…" className="max-h-32 min-h-[40px] flex-1 resize-y rounded-xl border border-linha bg-white px-3 py-2 text-[14px] outline-none focus:border-azul" />
        <button type="submit" disabled={ocupado || !texto.trim()} className="grid size-10 place-items-center rounded-xl bg-azul hover:bg-azul-escuro text-white disabled:opacity-40" aria-label="Enviar"><Send className="size-4" /></button>
      </form>
    </div>
  );
}

/** Botão do Claude em todas as telas. */
export function BotaoClaude({ variante = "lateral" }: { variante?: "lateral" | "icone" }) {
  const [aberto, setAberto] = useState(false);
  if (!ASSISTENTE_ATIVO) return null;
  return (
    <>
      {variante === "icone"
        ? <button onClick={() => setAberto(true)} className="p-2 text-[#f0a080]" aria-label="Abrir assistente Claude"><Sparkles className="size-5" /></button>
        : <button onClick={() => setAberto(true)} className="mx-3 mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium text-[#f3c1ad] transition hover:bg-white/8 hover:text-white" aria-label="Abrir assistente Claude">
            <Sparkles className="size-[18px]" strokeWidth={1.75} />Assistente Claude
          </button>}
      {aberto && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/25 backdrop-blur-[3px]" onClick={() => setAberto(false)}>
          <aside onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[460px] flex-col bg-[#f6f7fa] shadow-2xl">
            <header className="flex items-center gap-2.5 border-b border-linha bg-white px-4 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#d97757] to-[#b85c3e] text-white"><Bot className="size-5" /></span>
              <div className="min-w-0 flex-1"><div className="font-display text-[15px] font-bold">Assistente Claude</div><div className="text-[11.5px] text-suave">Dúvidas, especificações e projetos</div></div>
              <a href="/recomendacao/" className="rounded-lg p-2 text-azul hover:bg-fundo" title="Abrir painel de recomendação"><MessageSquareText className="size-4" /></a>
              <button onClick={() => setAberto(false)} className="rounded-lg p-2 text-suave hover:bg-fundo" aria-label="Fechar"><X className="size-5" /></button>
            </header>
            <Conversa altura="h-full min-h-0 flex-1" sugestoes={["Qual access point indicar para uma casa de 400 m² com área externa?", "Compare as caixas de embutir Episode do cadastro", "Quais itens vão numa sala de cinema com projetor e 5.1?"]} />
          </aside>
        </div>
      )}
    </>
  );
}
