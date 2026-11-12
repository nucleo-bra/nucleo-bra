// Núcleo sem internet.
//
// • Leitura: cada consulta importante guarda uma cópia no aparelho (IndexedDB).
//   Sem conexão, a tela abre com a última cópia.
// • Gravação: sem conexão, a alteração entra numa fila no aparelho e a tela já
//   mostra o resultado. Quando a internet volta, a fila é enviada na ordem.
// • Conflito: vale a última gravação. Se alguém alterou o mesmo registro online
//   DEPOIS da alteração feita offline, a do servidor fica e o aviso aparece em
//   "Sincronização" (o histórico do banco guarda as duas versões).
//
// Este arquivo não importa o cliente do Supabase: recebe o banco como parâmetro,
// para servir tanto ao Núcleo quanto ao Financeiro (bundle separado).
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco e JSON guardado */

type Banco = { from: (t: string) => any; rpc: (n: string, a: any) => any };

export type OpTabela = { tipo: "tabela"; acao: "insert" | "update" | "delete"; tabela: string; id: string; dados?: Record<string, unknown>; colunaData?: string; rotulo: string };
export type OpRpc = { tipo: "rpc"; nome: string; args: Record<string, unknown>; tabela: string; id: string; colunaData?: string; rotulo: string; espelho?: unknown };
export type OpFin = { tipo: "fin"; acao: "set" | "del"; colecao: string; id: string; dados?: Record<string, unknown>; rotulo: string };
export type Op = (OpTabela | OpRpc | OpFin) & { seq?: number; quando: string; usuario?: string };
export type Conflito = { rotulo: string; quando: string; servidorEm: string; motivo: "mais-recente" | "erro"; detalhe?: string; visto?: boolean };

// ------------------------------------------------------------------ IndexedDB
const NOME = "nucleo-offline";
let dbp: Promise<IDBDatabase> | null = null;
function abrir(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("sem IndexedDB"));
  dbp ??= new Promise((ok, erro) => {
    const r = indexedDB.open(NOME, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      if (!d.objectStoreNames.contains("fila")) d.createObjectStore("fila", { keyPath: "seq", autoIncrement: true });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { dbp = null; erro(r.error); };
  });
  return dbp;
}
function pedido<T>(loja: string, modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return abrir().then((d) => new Promise<T>((ok, erro) => {
    const t = d.transaction(loja, modo), r = f(t.objectStore(loja));
    r.onsuccess = () => ok(r.result as T);
    r.onerror = () => erro(r.error);
  }));
}
export const lerLocal = <T = unknown>(k: string) => pedido<T | undefined>("kv", "readonly", (s) => s.get(k)).catch(() => undefined);
export const gravarLocal = (k: string, v: unknown) => pedido("kv", "readwrite", (s) => s.put(v, k)).catch(() => undefined);
export const listarFila = () => pedido<Op[]>("fila", "readonly", (s) => s.getAll()).catch(() => [] as Op[]);
const tirarDaFila = (seq: number) => pedido("fila", "readwrite", (s) => s.delete(seq));
async function porNaFila(op: Op) {
  await pedido("fila", "readwrite", (s) => s.add(op));
  await avisarEstado();
}

// ------------------------------------------------------------------ estado (para o selo na tela)
export type Estado = { online: boolean; pendentes: number; sincronizando: boolean; conflitos: Conflito[]; ultima?: string };
let estado: Estado = { online: typeof navigator === "undefined" || navigator.onLine !== false, pendentes: 0, sincronizando: false, conflitos: [] };
const ouvintes = new Set<(e: Estado) => void>();
export function ouvirEstado(f: (e: Estado) => void) { ouvintes.add(f); f(estado); avisarEstado(); return () => { ouvintes.delete(f); }; }
async function avisarEstado(parcial: Partial<Estado> = {}) {
  const [fila, conflitos] = await Promise.all([listarFila(), lerLocal<Conflito[]>("conflitos")]);
  estado = { ...estado, ...parcial, pendentes: fila.length, conflitos: (conflitos ?? []).filter((c) => !c.visto) };
  for (const f of ouvintes) try { f(estado); } catch { /* */ }
  try { localStorage.setItem("nucleo-fila", String(fila.length)); } catch { /* */ }
}
export function marcarConexao(online: boolean) { if (estado.online !== online) avisarEstado({ online }); }
export async function conflitosVistos() {
  const L = (await lerLocal<Conflito[]>("conflitos")) ?? [];
  await gravarLocal("conflitos", L.map((c) => ({ ...c, visto: true })).slice(-50));
  await avisarEstado();
}
async function registrarConflito(c: Conflito) {
  const L = (await lerLocal<Conflito[]>("conflitos")) ?? [];
  await gravarLocal("conflitos", [...L, c].slice(-50));
}

// ------------------------------------------------------------------ rede
export function ehErroDeRede(e: unknown): boolean {
  if (redeCaida()) return true;
  const m = String((e as { message?: string })?.message ?? e ?? "");
  return e instanceof TypeError || /Failed to fetch|NetworkError|Load failed|fetch failed|network|ERR_INTERNET|ERR_NAME|timed? ?out|AbortError/i.test(m);
}
export const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)));

/** Lê do banco e guarda a cópia; sem internet, devolve a última cópia guardada. */
export async function comCache<T>(chave: string, ler: () => Promise<T>): Promise<T> {
  try {
    const v = await ler();
    gravarLocal("c:" + chave, { v, em: new Date().toISOString() });
    marcarConexao(true);
    return v;
  } catch (e) {
    if (!ehErroDeRede(e)) throw e;
    marcarConexao(false);
    const c = await lerLocal<{ v: T; em: string }>("c:" + chave);
    if (c) return c.v;
    throw new Error("Sem internet, e esta tela ainda não foi aberta neste aparelho. Abra uma vez com internet para ela ficar disponível offline.");
  }
}

/** Grava agora; sem internet (ou com fila pendente, para manter a ordem) entra na fila. */
export async function gravarOuEnfileirar<T>(op: OpTabela | OpRpc | OpFin, executar: () => PromiseLike<{ data?: any; error?: any }>, otimista: () => T, depois?: (data: any) => T): Promise<T> {
  const online = () => !redeCaida();
  const comFila = (await listarFila()).length > 0;
  let falha: unknown = null;
  if (!comFila && online()) {
    let r: { data?: any; error?: any };
    try { r = await executar(); } catch (e) { r = { error: e }; }
    if (!r.error) { marcarConexao(true); return depois ? depois(r.data) : otimista(); }
    if (!ehErroDeRede(r.error)) throw r.error;
    falha = r.error;
  }
  try { await porNaFila({ ...op, quando: new Date().toISOString(), usuario: usuarioLocal() } as Op); }
  catch { throw falha ?? new Error("Sem internet e sem espaço no aparelho para guardar a alteração."); }
  marcarConexao(online() && !falha);
  agendar();
  return otimista();
}

// ------------------------------------------------------------------ envio da fila
let banco: Banco | null = null;
export function configurarSincronizacao(db: Banco) {
  if (banco) return;
  banco = db;
  if (typeof window === "undefined") return;
  addEventListener("online", () => { marcarConexao(true); sincronizar(); });
  addEventListener("offline", () => marcarConexao(false));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sincronizar(); });
  setInterval(() => { if (estado.pendentes || !estado.online) sincronizar(); }, 20_000);
  sincronizar();
}
let timer: ReturnType<typeof setTimeout> | null = null;
function agendar() { if (timer) clearTimeout(timer); timer = setTimeout(() => sincronizar(), 1500); }

let rodando: Promise<number> | null = null;
/** Envia a fila. Devolve quantas operações foram enviadas. */
export function sincronizar(): Promise<number> {
  if (!banco) return Promise.resolve(0);
  rodando ??= (async () => {
    const locks = typeof navigator !== "undefined" ? (navigator as any).locks : null;
    const corpo = () => enviarFila(banco!);
    try { return locks?.request ? await locks.request("nucleo-sincronizar", corpo) : await corpo(); }
    finally { rodando = null; }
  })();
  return rodando;
}

async function dataNoServidor(db: Banco, op: Op): Promise<string | null> {
  if (op.tipo === "fin") {
    const { data, error } = await db.from("fin_docs").select("atualizado_em").eq("colecao", op.colecao).eq("id", op.id).maybeSingle();
    if (error) { if (ehErroDeRede(error)) throw error; return null; }
    return data?.atualizado_em ?? null;
  }
  if (!op.colunaData) return null;
  const { data, error } = await db.from(op.tabela).select(op.colunaData).eq("id", op.id).maybeSingle();
  if (error) { if (ehErroDeRede(error)) throw error; return null; }   // tabela sem a coluna de data: grava sem conferir
  return (data as any)?.[op.colunaData] ?? null;
}

async function executarOp(db: Banco, op: Op): Promise<{ error?: any }> {
  if (op.tipo === "fin") {
    return op.acao === "del" ? db.from("fin_docs").delete().eq("colecao", op.colecao).eq("id", op.id)
      : db.from("fin_docs").upsert({ colecao: op.colecao, id: op.id, dados: op.dados });
  }
  if (op.tipo === "rpc") return db.rpc(op.nome, op.args);
  if (op.acao === "delete") return db.from(op.tabela).delete().eq("id", op.id);
  if (op.acao === "insert") return db.from(op.tabela).upsert({ ...op.dados, id: op.id });
  return db.from(op.tabela).update(op.dados).eq("id", op.id);
}

async function enviarFila(db: Banco): Promise<number> {
  const fila = (await listarFila()).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
  if (!fila.length) {
    // nada a enviar: só confere se a internet voltou (para o selo sair sozinho)
    if (!estado.online && typeof location !== "undefined") {
      const ok = await fetchRapido("/versao.json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.ok, () => false);
      await avisarEstado({ sincronizando: false, online: ok });
    } else await avisarEstado({ sincronizando: false });
    return 0;
  }
  await avisarEstado({ sincronizando: true });
  const mexidos = new Set<string>();     // registros que esta própria fila já gravou
  let enviados = 0;
  try {
    for (const op of fila) {
      const chave = `${op.tipo === "fin" ? "fin:" + op.colecao : op.tabela}:${op.id}`;
      const criado = op.tipo === "tabela" && op.acao === "insert";
      if (!criado && !mexidos.has(chave)) {
        const noServidor = await dataNoServidor(db, op);
        if (noServidor && new Date(noServidor).getTime() > new Date(op.quando).getTime()) {
          await registrarConflito({ rotulo: op.rotulo, quando: op.quando, servidorEm: noServidor, motivo: "mais-recente" });
          await tirarDaFila(op.seq!);
          continue;
        }
      }
      const r = await executarOp(db, op);
      if (r.error) {
        if (ehErroDeRede(r.error)) throw r.error;
        await registrarConflito({ rotulo: op.rotulo, quando: op.quando, servidorEm: new Date().toISOString(), motivo: "erro", detalhe: String(r.error.message ?? r.error) });
      }
      mexidos.add(chave);
      await tirarDaFila(op.seq!);
      enviados++;
    }
    await avisarEstado({ sincronizando: false, online: true, ultima: new Date().toISOString() });
    if (enviados && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("nucleo:sincronizado", { detail: enviados }));
  } catch (e) {
    await avisarEstado({ sincronizando: false, online: !ehErroDeRede(e) });
  }
  return enviados;
}

// ------------------------------------------------------------------ usuário guardado (entrar sem internet)
export function guardarPerfil(id: string, perfil: Record<string, unknown>) {
  try { localStorage.setItem("nucleo-perfil", JSON.stringify({ id, ...perfil })); } catch { /* */ }
}
export function perfilGuardado(id: string): Record<string, any> | null {
  try { const p = JSON.parse(localStorage.getItem("nucleo-perfil") ?? "null"); return p?.id === id ? p : null; } catch { return null; }
}
function usuarioLocal() { try { return JSON.parse(localStorage.getItem("nucleo-perfil") ?? "null")?.nome ?? ""; } catch { return ""; } }

/** Aplica as operações da fila de uma tabela sobre linhas guardadas (para a tela offline mostrar o que já foi feito). */
export function aplicarFila<T extends { id: string }>(linhas: T[], fila: Op[], tabela: string): T[] {
  const m = new Map(linhas.map((l) => [l.id, l]));
  for (const op of fila) {
    if (op.tipo !== "tabela" || op.tabela !== tabela) continue;
    if (op.acao === "delete") m.delete(op.id);
    else m.set(op.id, { ...(m.get(op.id) ?? {}), ...(op.dados as object), id: op.id } as T);
  }
  return [...m.values()];
}

/** fetch para o Supabase: sem internet falha na hora (sem as 3 novas tentativas, que travavam a tela por vários segundos). */
// Quando a rede cai sem o aparelho perceber (Wi-Fi conectado sem internet, 4G
// fraco), cada pedido ficava esperando minutos e a tela travava. Agora cada
// pedido tem tempo máximo e, depois de uma falha, os próximos 20 s já vão
// direto para o modo sem internet; depois disso o sistema testa de novo.
let semRedeAte = 0;
export const redeCaida = () => (typeof navigator !== "undefined" && navigator.onLine === false) || Date.now() < semRedeAte;
if (typeof window !== "undefined") addEventListener("online", () => { semRedeAte = 0; });
export const fetchRapido: typeof fetch = async (input, init) => {
  const semRede = () => new DOMException("Sem internet (Failed to fetch)", "AbortError");
  if (redeCaida()) throw semRede();
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const metodo = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
  const limite = /\/storage\/v1\/object/.test(url) && metodo !== "GET" ? 180_000 : /\/storage\/v1\//.test(url) ? 60_000 : 12_000;
  const ctrl = new AbortController();
  const externo = init?.signal;
  if (externo) { if (externo.aborted) ctrl.abort(externo.reason); else externo.addEventListener("abort", () => ctrl.abort(externo.reason), { once: true }); }
  let esgotou = false;
  const t = setTimeout(() => { esgotou = true; ctrl.abort(); }, limite);
  try {
    const r = await fetch(input, { ...init, signal: ctrl.signal });
    if (semRedeAte) semRedeAte = 0;
    return r;
  } catch (e) {
    if (externo?.aborted && !esgotou) throw e;        // cancelado pela própria tela
    semRedeAte = Date.now() + 20_000;
    marcarConexao(false);
    throw semRede();
  } finally { clearTimeout(t); }
};

/**
 * Sessão guardada pelo Supabase no aparelho. Sem internet, o token de acesso
 * vence em 1 hora e não dá para renovar; o Supabase então devolve "sem sessão"
 * (o que antes mandava para o login, que também não funciona offline). Com a
 * sessão guardada o Núcleo continua aberto e renova o token quando a rede volta.
 */
export function sessaoGuardada(): { id: string; email: string } | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (!/^sb-.+-auth-token$/.test(k)) continue;
      const s = JSON.parse(localStorage.getItem(k) ?? "null");
      const u = s?.user ?? s?.currentSession?.user;
      if (u?.id && s?.refresh_token !== undefined) return { id: u.id, email: u.email ?? "" };
      if (u?.id) return { id: u.id, email: u.email ?? "" };
    }
  } catch { /* */ }
  return null;
}
/** Usuário da sessão; sem internet (token vencido sem poder renovar), o guardado no aparelho. */
export async function usuarioDaSessao(db: { auth: { getSession: () => Promise<{ data: { session: { user: { id: string; email?: string } } | null }; error: unknown }> } }) {
  const { data, error } = await db.auth.getSession();
  if (data.session) return { id: data.session.user.id, email: data.session.user.email ?? "", offline: false };
  const semRede = (typeof navigator !== "undefined" && navigator.onLine === false) || (!!error && (ehErroDeRede(error) || /Retryable/i.test(String((error as { name?: string })?.name))));
  const g = semRede ? sessaoGuardada() : null;
  return g && perfilGuardado(g.id) ? { ...g, offline: true } : null;
}

/** Para o que só funciona com conexão (subir arquivo, excluir de vez): avisa em vez de travar. */
export function precisaDeInternet(o_que = "Isto") {
  if (redeCaida()) throw new Error(`Sem internet: ${o_que === "Isto" ? "esta ação" : o_que} precisa de conexão. O restante continua funcionando offline.`);
}
