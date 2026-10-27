/* Adaptador do Financeiro v38 para o banco do Núcleo.
 *
 * O v38 roda sem nenhuma alteração na interface: ele pede `claude.use('db')`
 * e recebe aqui um banco com a mesma API (collection/doc/set/delete/onSnapshot),
 * só que gravando na tabela fin_docs do Supabase, com o login do Núcleo.
 * Tempo real: canal do Supabase + recarga ao voltar para a aba.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

type Doc = Record<string, unknown>;
type Snap = { docs: { id: string; data: () => Doc }[]; exists: boolean; data: () => Doc | undefined };
type Ouvinte = { colecao: string; id?: string; ordem?: [string, "asc" | "desc"]; limite?: number; cb: (s: Snap) => void; erro?: (e: unknown) => void };

const COLECOES = new Set(["it", "nf", "cl", "log", "meta"]);
const embutido = (() => { try { return typeof window !== "undefined" && window.self !== window.top; } catch { return true; } })();
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

  async function carregarTudo() {
    const novo = new Map<string, Map<string, Doc>>();
    for (let de = 0; ; de += 1000) {
      const { data, error } = await db.from("fin_docs").select("colecao, id, dados").order("colecao").order("id").range(de, de + 999);
      if (error) throw error;
      for (const r of data ?? []) {
        let m = novo.get(r.colecao); if (!m) novo.set(r.colecao, (m = new Map()));
        m.set(r.id, r.dados);
      }
      if (!data || data.length < 1000) break;
    }
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
    const { error } = await db.from("fin_docs").upsert({ colecao: c, id, dados: d, atualizado_por: uid });
    if (error) { await carregarTudo().catch(() => {}); throw new Error(traduzir(error.message)); }
  }
  async function apagar(c: string, id: string) {
    col(c).delete(id); avisar(c);
    const { error } = await db.from("fin_docs").delete().eq("colecao", c).eq("id", id);
    if (error) { await carregarTudo().catch(() => {}); throw new Error(traduzir(error.message)); }
  }
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
  const estilo = "background:#ffffff14;color:#fff;border:1px solid #ffffff30;border-radius:99px;padding:6px 12px;font:600 12px Manrope,system-ui,sans-serif;text-decoration:none;cursor:pointer;min-height:auto";
  caixa.innerHTML = `<a href="/" style="${estilo}" title="Abrir o Núcleo BRA">Núcleo</a><button type="button" style="${estilo}" title="Sair">Sair</button>`;
  caixa.querySelector("button")!.addEventListener("click", async () => { await db.auth.signOut(); location.replace(urlLogin); });
  const tema = h.querySelector(".th");
  if (tema?.parentElement) tema.parentElement.insertBefore(caixa, tema.nextSibling); else h.appendChild(caixa);
}

// ------------------------------------------------------------------ início
const url = typeof __SUPABASE_URL__ === "string" ? __SUPABASE_URL__ : "";
const chave = typeof __SUPABASE_KEY__ === "string" ? __SUPABASE_KEY__ : "";

if (url && chave) {
  const db = createClient(url, chave, { auth: { persistSession: true, autoRefreshToken: true } });
  const pronto = (async () => {
    const { data } = await db.auth.getSession();
    if (!data.session) { (embutido ? window.top! : window).location.replace(urlLogin); throw new Error("sem sessão"); }
    const { data: perfil } = await db.from("perfis").select("nome, ativo").eq("id", data.session.user.id).single();
    if (!perfil?.ativo) { await db.auth.signOut(); location.replace(urlLogin + "&aguardando=1"); throw new Error("inativo"); }
    botoesTopo(db);
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
