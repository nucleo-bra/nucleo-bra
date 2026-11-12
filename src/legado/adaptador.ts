/* Adaptador do Financeiro v38 para o banco do Núcleo.
 *
 * O v38 roda sem nenhuma alteração na interface: ele pede `claude.use('db')`
 * e recebe aqui um banco com a mesma API (collection/doc/set/delete/onSnapshot),
 * só que gravando na tabela fin_docs do Supabase, com o login do Núcleo.
 * Tempo real: canal do Supabase + recarga ao voltar para a aba.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { configurarSincronizacao, ehErroDeRede, fetchRapido, gravarLocal, gravarOuEnfileirar, guardarPerfil, lerLocal, listarFila, marcarConexao, ouvirEstado, perfilGuardado } from "@/lib/offline";

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

type Doc = Record<string, unknown>;
type Snap = { docs: { id: string; data: () => Doc }[]; exists: boolean; data: () => Doc | undefined };
type Ouvinte = { colecao: string; id?: string; ordem?: [string, "asc" | "desc"]; limite?: number; cb: (s: Snap) => void; erro?: (e: unknown) => void };

const COLECOES = new Set(["it", "nf", "cl", "log", "meta"]);
const embutido = (() => { try { return typeof window !== "undefined" && window.self !== window.top; } catch { return true; } })();

// Tema: dentro do Núcleo o Financeiro segue a aparência escolhida lá (Claro/Escuro/Automático)
function temaNucleo() {
  let t: string | null = null;
  try { t = localStorage.getItem("nucleo-tema"); } catch { /* sem armazenamento */ }
  const escuro = t === "escuro" || (t !== "claro" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", escuro ? "dark" : "light");
}
function seguirTema() {
  let proprio: string | null = null;
  try { proprio = localStorage.getItem("finauto_th"); } catch { /* */ }
  if (!embutido && proprio) return; // app avulso com tema escolhido no próprio botão
  temaNucleo();
  addEventListener("storage", (e) => { if (e.key === "nucleo-tema") temaNucleo(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", temaNucleo);
  if (embutido) { const st = document.createElement("style"); st.textContent = ".th{display:none!important}"; document.head.appendChild(st); }
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", seguirTema); else seguirTema();
}
const urlLogin = "/login/?app=financeiro";

export function criar(db: SupabaseClient, uid: string) {
  const cache = new Map<string, Map<string, Doc>>();
  const ouvintes = new Set<Ouvinte>();
  let carregado = false;
  const col = (c: string) => { let m = cache.get(c); if (!m) cache.set(c, (m = new Map())); return m; };
  const copia = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

  function snapshot(o: Ouvinte): Snap {
    if (o.id !== undefined) {
      const d = col(o.colecao).get(o.id);
      return { docs: [], exists: d !== undefined, data: () => (d ? copia(d) : undefined) };
    }
    let lista = [...col(o.colecao).entries()];
    if (o.ordem) {
      const [campo, dir] = o.ordem;
      lista.sort((a, b) => String(a[1][campo] ?? "").localeCompare(String(b[1][campo] ?? "")) * (dir === "desc" ? -1 : 1));
    }
    if (o.limite) lista = lista.slice(0, o.limite);
    return { docs: lista.map(([id, d]) => ({ id, data: () => copia(d) })), exists: true, data: () => undefined };
  }
  const pendentes = new Set<string>();
  let agendado = false;
  function avisar(c: string) {
    pendentes.add(c);
    if (agendado) return;
    agendado = true;
    queueMicrotask(() => {
      agendado = false;
      const cs = new Set(pendentes); pendentes.clear();
      for (const o of ouvintes) if (cs.has(o.colecao)) { try { o.cb(snapshot(o)); } catch (e) { console.error(e); } }
    });
  }

  async function lerServidor() {
    const linhas: [string, string, Doc][] = [];
    for (let de = 0; ; de += 1000) {
      const { data, error } = await db.from("fin_docs").select("colecao, id, dados").order("colecao").order("id").range(de, de + 999);
      if (error) throw error;
      for (const r of data ?? []) linhas.push([r.colecao, r.id, r.dados]);
      if (!data || data.length < 1000) break;
    }
    return linhas;
  }
  // sem internet: abre com a cópia guardada no aparelho + o que está na fila
  async function carregarTudo() {
    let linhas: [string, string, Doc][];
    try {
      linhas = await lerServidor();
      gravarLocal("fin:copia", { linhas, em: new Date().toISOString() });
      marcarConexao(true);
    } catch (e) {
      if (!ehErroDeRede(e)) throw e;
      marcarConexao(false);
      const c = await lerLocal<{ linhas: [string, string, Doc][] }>("fin:copia");
      if (!c) throw new Error("Sem internet, e o Financeiro ainda não foi aberto neste aparelho. Abra uma vez com internet para ele ficar disponível offline.");
      linhas = c.linhas;
    }
    const novo = new Map<string, Map<string, Doc>>();
    const pega = (c: string) => { let m = novo.get(c); if (!m) novo.set(c, (m = new Map())); return m; };
    for (const [c, id, d] of linhas) pega(c).set(id, d);
    for (const op of await listarFila()) if (op.tipo === "fin") { if (op.acao === "del") pega(op.colecao).delete(op.id); else pega(op.colecao).set(op.id, op.dados as Doc); }
    for (const c of COLECOES) { cache.set(c, novo.get(c) ?? new Map()); avisar(c); }
    carregado = true;
  }

  function aplicarRemoto(p: { eventType: string; new?: { colecao?: string; id?: string; dados?: Doc }; old?: { colecao?: string; id?: string } }) {
    if (p.eventType === "DELETE") {
      if (p.old?.colecao && p.old.id) { col(p.old.colecao).delete(p.old.id); avisar(p.old.colecao); }
    } else if (p.new?.colecao && p.new.id && p.new.dados) {
      col(p.new.colecao).set(p.new.id, p.new.dados); avisar(p.new.colecao);
    }
  }

  db.channel("fin_docs").on("postgres_changes", { event: "*", schema: "public", table: "fin_docs" }, aplicarRemoto).subscribe();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && carregado) carregarTudo().catch(console.error); });
    setInterval(() => { if (document.visibilityState === "visible") carregarTudo().catch(console.error); }, 90_000);
  }
  const inicio = carregarTudo();

  async function gravar(c: string, id: string, dados: Doc) {
    if (!COLECOES.has(c)) throw new Error("Coleção desconhecida: " + c);
    const d = copia(dados);
    col(c).set(id, d); avisar(c);
    try {
      await gravarOuEnfileirar({ tipo: "fin", acao: "set", colecao: c, id, dados: d, rotulo: rotuloFin(c, d) },
        () => db.from("fin_docs").upsert({ colecao: c, id, dados: d, atualizado_por: uid }), () => undefined);
    } catch (e) { await carregarTudo().catch(() => {}); throw new Error(traduzir(String((e as { message?: string })?.message ?? e))); }
  }
  async function apagar(c: string, id: string) {
    const antes = col(c).get(id);
    col(c).delete(id); avisar(c);
    try {
      await gravarOuEnfileirar({ tipo: "fin", acao: "del", colecao: c, id, rotulo: "Excluir " + rotuloFin(c, antes ?? {}) },
        () => db.from("fin_docs").delete().eq("colecao", c).eq("id", id), () => undefined);
    } catch (e) { await carregarTudo().catch(() => {}); throw new Error(traduzir(String((e as { message?: string })?.message ?? e))); }
  }
  // fila enviada (aqui ou no Núcleo): recarrega do banco
  if (typeof addEventListener === "function") addEventListener("nucleo:sincronizado", () => { carregarTudo().catch(console.error); });
  function ouvir(o: Ouvinte) {
    ouvintes.add(o);
    inicio.then(() => o.cb(snapshot(o)), (e) => (o.erro ? o.erro(e) : console.error(e)));
    return () => ouvintes.delete(o);
  }

  const refDoc = (c: string, id: string) => ({
    set: (d: Doc) => gravar(c, id, d),
    delete: () => apagar(c, id),
    onSnapshot: (cb: Ouvinte["cb"], erro?: Ouvinte["erro"]) => ouvir({ colecao: c, id, cb, erro }),
  });
  const consulta = (c: string, ordem?: Ouvinte["ordem"], limite?: number) => ({
    doc: (id: string) => refDoc(c, id),
    orderBy: (campo: string, dir: "asc" | "desc" = "asc") => consulta(c, [campo, dir], limite),
    limit: (n: number) => consulta(c, ordem, n),
    onSnapshot: (cb: Ouvinte["cb"], erro?: Ouvinte["erro"]) => ouvir({ colecao: c, ordem, limite, cb, erro }),
  });
  return {
    collection: (c: string) => consulta(c),
    doc: (caminho: string) => { const [c, id] = caminho.split("/"); return refDoc(c, id); },
  };
}

function rotuloFin(c: string, d: Doc) {
  const nome = String(d.desc ?? d.who ?? d.cli ?? d.num ?? "").slice(0, 60);
  return ({ it: "Lançamento", nf: "NF", cl: "Cliente", log: "Registro", meta: "Configuração" } as Record<string, string>)[c] + (nome ? ` · ${nome}` : "");
}
function traduzir(m: string) {
  if (/row-level security|permission/i.test(m)) return "seu usuário não tem permissão para isso. Peça liberação à diretoria.";
  if (/JWT|token/i.test(m)) return "sua sessão expirou. Entre novamente.";
  return m;
}

function botoesTopo(db: SupabaseClient) {
  if (embutido) return;
  const h = document.querySelector("header");
  if (!h) return setTimeout(() => botoesTopo(db), 300);
  const caixa = document.createElement("div");
  caixa.style.cssText = "display:flex;gap:6px;align-items:center;margin-left:8px";
  const estilo = "background:color-mix(in srgb,var(--tx) 6%,transparent);color:var(--tx);border:0;border-radius:99px;padding:6px 12px;font:600 12px -apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;text-decoration:none;cursor:pointer;min-height:auto";
  caixa.innerHTML = `<a href="/" style="${estilo}" title="Abrir o Núcleo BRA">Núcleo</a><button type="button" style="${estilo}" title="Sair">Sair</button>`;
  caixa.querySelector("button")!.addEventListener("click", async () => { await db.auth.signOut(); location.replace(urlLogin); });
  const tema = h.querySelector(".th");
  if (tema?.parentElement) tema.parentElement.insertBefore(caixa, tema.nextSibling); else h.appendChild(caixa);
}

/** PF/PJ de cada cliente do cadastro do Núcleo, pelo nome que o Financeiro usa (filtro do A receber). */
export function mapaTipos(L: { nome?: string | null; nome_fantasia?: string | null; legado_chave?: string | null; tipo?: string | null; documento?: string | null }[]) {
  const m: Record<string, "PF" | "PJ"> = {};
  const chave = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  for (const c of L) {
    const dig = (c.documento ?? "").replace(/\D/g, "");
    const tipo = dig.length === 14 ? "PJ" : dig.length === 11 ? "PF" : c.tipo === "PJ" ? "PJ" : "PF";
    for (const n of [c.nome, c.nome_fantasia, c.legado_chave]) if (n && n.trim()) m[chave(n)] = tipo;
  }
  return m;
}
async function lerClientes(db: SupabaseClient) {
  const out: { nome?: string | null; nome_fantasia?: string | null; legado_chave?: string | null; tipo?: string | null; documento?: string | null }[] = [];
  for (let de = 0; de < 20000; de += 1000) {
    const { data, error } = await db.from("clientes").select("nome, nome_fantasia, legado_chave, tipo, documento").order("id").range(de, de + 999);
    if (error) return null;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
async function carregarTipos(db: SupabaseClient) {
  const data = await lerClientes(db);
  if (!data) return;
  (window as unknown as { __tpCli: unknown }).__tpCli = mapaTipos(data ?? []);
  (window as unknown as { __nomesCli: unknown }).__nomesCli = [...new Set((data ?? []).map((c) => String(c.nome ?? "").trim()).filter(Boolean))];
  // equipe interna (engenheiro, projetista…): não desconta da base do vendedor como um parceiro externo
  const eq = await db.from("comissionados").select("nome").eq("automatico", true);
  (window as unknown as { __equipeInt: unknown }).__equipeInt = Object.fromEntries((eq.data ?? []).map((x) => [String(x.nome).replace(/\s+/g, " ").trim().toLowerCase(), true]));
  const r = (window as unknown as { render?: () => void }).render;
  if (typeof r === "function") try { r(); } catch { /* ainda carregando */ }
}

function seloOffline() {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:99999;padding:7px 14px;border-radius:99px;font:600 12.5px -apple-system,BlinkMacSystemFont,Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.18);display:none";
  document.body.appendChild(el);
  ouvirEstado((e) => {
    const alt = (n: number) => (n > 1 ? `${n} alterações` : "1 alteração");
    const txt = !e.online ? `Sem internet${e.pendentes ? ` · ${alt(e.pendentes)} aguardando` : " · alterações ficam guardadas"}` : e.sincronizando ? "Sincronizando…" : e.pendentes ? `${alt(e.pendentes)} aguardando envio` : e.conflitos.length ? `${alt(e.conflitos.length)} substituída${e.conflitos.length > 1 ? "s" : ""} por outra mais recente` : "";
    el.textContent = txt;
    el.style.display = txt ? "block" : "none";
    el.style.background = !e.online ? "#1d1d1f" : e.conflitos.length && !e.pendentes ? "#ff9500" : "#0071e3";
    el.style.color = "#fff";
  });
}

// ------------------------------------------------------------------ início
const url = typeof __SUPABASE_URL__ === "string" ? __SUPABASE_URL__ : "";
const chave = typeof __SUPABASE_KEY__ === "string" ? __SUPABASE_KEY__ : "";

if (url && chave) {
  const db = createClient(url, chave, { auth: { persistSession: true, autoRefreshToken: true }, global: { fetch: fetchRapido } });
  const pronto = (async () => {
    const { data } = await db.auth.getSession();
    if (!data.session) { (embutido ? window.top! : window).location.replace(urlLogin); throw new Error("sem sessão"); }
    const { data: nivel } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel?.nextLevel === "aal2" && nivel.currentLevel !== "aal2") { (embutido ? window.top! : window).location.replace(urlLogin + "&mfa=1"); throw new Error("falta o código"); }
    const r = await db.from("perfis").select("nome, email, ativo, papel").eq("id", data.session.user.id).single();
    const semRede = !!r.error && ehErroDeRede(r.error);
    const perfil = semRede ? perfilGuardado(data.session.user.id) : r.data;
    if (perfil && !r.error) guardarPerfil(data.session.user.id, perfil);
    configurarSincronizacao(db);
    if (!embutido) seloOffline();
    if (semRede && !perfil) { (embutido ? window.top! : window).location.replace(urlLogin); throw new Error("sem perfil guardado"); }
    if (!perfil?.ativo) { await db.auth.signOut(); location.replace(urlLogin + "&aguardando=1"); throw new Error("inativo"); }
    botoesTopo(db);
    carregarTipos(db).catch(console.error);
    return { banco: criar(db, data.session.user.id), nome: perfil.nome as string };
  })();
  (window as unknown as { claude: unknown }).claude = {
    use: async (cap: string) => {
      const p = await pronto;
      if (cap === "db") return p.banco;
      if (cap === "user") return { name: async () => p.nome };
      return null; // downloads: o v38 usa o download do navegador
    },
  };
}

// ------------------------------------------------------------------ sem internet (app avulso do Financeiro)
if (!embutido && typeof navigator !== "undefined" && "serviceWorker" in navigator && location.hostname !== "localhost") {
  setTimeout(() => navigator.serviceWorker.register("/sw.js").catch(() => {}), 2500);
}

// ------------------------------------------------------------------ sempre atualizado (app do celular)
// Guarda a versão publicada ao abrir; ao voltar para o app, recarrega se houver
// versão nova ou se ficou mais de 10 minutos em segundo plano.
if (!embutido && typeof document !== "undefined" && typeof fetch === "function") {
  const lerVersao = () => fetch(`/versao.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => (j?.versao as string) ?? null).catch(() => null);
  let base: string | null = null, escondidoEm = 0;
  lerVersao().then((v) => { base = v; });
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "hidden") { escondidoEm = Date.now(); return; }
    const v = await lerVersao();
    if ((base && v && v !== base) || (escondidoEm && Date.now() - escondidoEm > 10 * 60 * 1000)) location.reload();
    escondidoEm = 0;
  });
}

// ------------------------------------------------------------------ virada do dia
// O v38 calcula "hoje" ao abrir. Aberto de um dia para o outro, recarrega quando
// a data muda (ao voltar para a tela, ou parado sem ninguém digitando), para os
// atrasos e vencimentos usarem o dia certo.
if (typeof document !== "undefined") {
  const dia = () => new Date().toDateString();
  const aberto = dia();
  const conferir = (forcar: boolean) => {
    if (dia() === aberto || document.visibilityState !== "visible") return;
    const digitando = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (forcar || !digitando) location.reload();
  };
  document.addEventListener("visibilitychange", () => conferir(false));
  setInterval(() => conferir(false), 5 * 60 * 1000);
}
