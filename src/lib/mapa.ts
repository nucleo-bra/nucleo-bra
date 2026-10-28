"use client";
// Mapa de atendimento: junta clientes do Núcleo, valores do Financeiro (v38),
// negócios do CRM e obras, e localiza cada cliente pela cidade.
import { carregarDadosFinanceiro, Item, situacao, vr } from "./painel";
import { modoDemo, supabase } from "./supabase";

export type Base = { nome: string; la: number; lo: number; tipo: "sede" | "showroom" };
export const BASES: Base[] = [
  { nome: "Sede · Paulínia", la: -22.7611, lo: -47.1544, tipo: "sede" },
  { nome: "Showroom kaza+ · Campinas", la: -22.8889, lo: -47.0445, tipo: "showroom" },
];

export type ClienteMapa = {
  chave: string; id: string | null; nome: string; cidade: string; uf: string; la: number | null; lo: number | null;
  total: number; recebido: number; aberto: number; atrasado: number; parcelas: { venc: string; pago: string | null; valor: number }[];
  pipeline: number; negocios: number; obras: number; ultimo: string | null;
};
export type CidadeMapa = {
  chave: string; cidade: string; uf: string; la: number; lo: number; distancia: number;
  clientes: ClienteMapa[]; total: number; recebido: number; aberto: number; atrasado: number; pipeline: number; negocios: number; obras: number;
};

const norm = (s: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const nm = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();

export function distanciaKm(a: { la: number; lo: number }, b: { la: number; lo: number }) {
  const R = 6371, r = (x: number) => (x * Math.PI) / 180;
  const dLa = r(b.la - a.la), dLo = r(b.lo - a.lo);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.la)) * Math.cos(r(b.la)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

let municipios: Promise<Map<string, [number, number]>> | null = null;
export function carregarMunicipios() {
  municipios ??= fetch("/dados/municipios.json").then((r) => r.json()).then((L: [string, string, number, number, number][]) => {
    const m = new Map<string, [number, number]>();
    for (const [n, uf, la, lo] of L) { m.set(`${norm(n)}/${uf.toLowerCase()}`, [la, lo]); if (!m.has(norm(n))) m.set(norm(n), [la, lo]); }
    return m;
  });
  return municipios;
}

export type DadosMapa = { clientes: ClienteMapa[]; itens: Item[] };

export async function carregarMapa(): Promise<DadosMapa> {
  const [fin, mun] = await Promise.all([carregarDadosFinanceiro(), carregarMunicipios()]);
  const local = (cidade?: string, uf?: string): [number, number] | null => {
    if (!cidade) return null;
    return mun.get(`${norm(cidade)}/${(uf ?? "").toLowerCase()}`) ?? mun.get(norm(cidade)) ?? null;
  };
  type Cli = { id: string; nome: string; nome_fantasia: string | null; cidade: string | null; uf: string | null };
  let clientes: Cli[] = [], ops: { cliente_id: string | null; cliente_nome: string | null; titulo: string; etapa: string; valor_estimado: number }[] = [];
  let obras: { cliente_id: string | null; status: string }[] = [];
  if (!modoDemo) {
    const db = supabase();
    const [c, o, p] = await Promise.all([
      db.from("clientes").select("id, nome, nome_fantasia, cidade, uf").eq("ativo", true).limit(5000),
      db.from("oportunidades").select("cliente_id, cliente_nome, titulo, etapa, valor_estimado").limit(5000),
      db.from("projetos").select("cliente_id, status").limit(5000),
    ]);
    clientes = (c.data ?? []) as Cli[];
    ops = (o.data ?? []) as typeof ops;
    obras = (p.data ?? []) as typeof obras;
  }

  const mapa = new Map<string, ClienteMapa>();
  const novo = (chave: string, nome: string): ClienteMapa => ({
    chave, id: null, nome, cidade: "", uf: "", la: null, lo: null, total: 0, recebido: 0, aberto: 0, atrasado: 0, parcelas: [],
    pipeline: 0, negocios: 0, obras: 0, ultimo: null,
  });
  const porNome = new Map<string, string>();
  for (const c of clientes) {
    const k = "c:" + c.id;
    const x = novo(k, nm(c.nome_fantasia || c.nome));
    x.id = c.id;
    if (c.cidade) { x.cidade = c.cidade; x.uf = c.uf ?? ""; const p = local(c.cidade, c.uf ?? ""); if (p) [x.la, x.lo] = p; }
    mapa.set(k, x);
    porNome.set(norm(c.nome), k); if (c.nome_fantasia) porNome.set(norm(c.nome_fantasia), k);
  }
  // financeiro (nomes do v38) → cliente do Núcleo de mesmo nome, ou cadastro próprio do v38
  const hoje = new Date().toISOString().slice(0, 10);
  for (const i of fin.it.filter((i) => i.t === "r")) {
    const w = nm(i.who); if (!w) continue;
    let k = porNome.get(norm(w));
    if (!k) { k = "f:" + norm(w); if (!mapa.has(k)) mapa.set(k, novo(k, w)); }
    const x = mapa.get(k)!;
    const v = vr(i), s = situacao(i, hoje);
    x.total += v; if (s === "pago") x.recebido += v; else if (s === "aberto") x.aberto += v; else x.atrasado += v;
    x.parcelas.push({ venc: i.venc, pago: i.pago, valor: v });
    const d = i.pago ?? i.venc; if (!x.ultimo || d > x.ultimo) x.ultimo = d;
  }
  // localização cadastrada no Financeiro v38 para quem ainda não tem cidade
  for (const x of mapa.values()) {
    if (x.la != null) continue;
    const m = fin.cli[norm(x.nome)] ?? fin.cli[x.nome.toLowerCase()];
    if (m?.c) {
      x.cidade ||= m.c; x.uf ||= m.u ?? "";
      if (m.la != null && m.lo != null) { x.la = m.la; x.lo = m.lo; } else { const p = local(m.c, m.u); if (p) [x.la, x.lo] = p; }
    }
  }
  // CRM e obras
  for (const o of ops) {
    const k = o.cliente_id ? "c:" + o.cliente_id : porNome.get(norm(o.cliente_nome ?? ""));
    const x = k ? mapa.get(k) : undefined; if (!x) continue;
    x.negocios++;
    if (!["ganho", "perdido"].includes(o.etapa)) x.pipeline += Number(o.valor_estimado) || 0;
  }
  for (const p of obras) {
    const x = p.cliente_id ? mapa.get("c:" + p.cliente_id) : undefined;
    if (x && p.status === "em_execucao") x.obras++;
  }
  return { clientes: [...mapa.values()].filter((x) => x.total || x.negocios || x.id), itens: fin.it };
}

export type Metrica = "clientes" | "total" | "recebido" | "aberto" | "pipeline" | "obras";
export const METRICAS: [Metrica, string][] = [
  ["clientes", "Clientes"], ["total", "Valor contratado"], ["recebido", "Recebido"], ["aberto", "A receber"], ["pipeline", "Pipeline CRM"], ["obras", "Obras ativas"],
];
export const valorMetrica = (c: CidadeMapa, m: Metrica) =>
  m === "clientes" ? c.clientes.length : m === "aberto" ? c.aberto + c.atrasado : c[m];

/** Agrupa por cidade aplicando o período (para valores do Financeiro). */
export function agruparCidades(L: ClienteMapa[], periodo: "tudo" | "12m" | "ano", base = BASES[0]): CidadeMapa[] {
  const hoje = new Date(), ano = String(hoje.getFullYear());
  const desde = new Date(hoje.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const dentro = (d: string) => periodo === "tudo" || (periodo === "ano" ? d.startsWith(ano) : d >= desde);
  const m = new Map<string, CidadeMapa>();
  for (const c of L) {
    if (c.la == null || c.lo == null) continue;
    const parc = c.parcelas.filter((p) => dentro(p.venc) || (p.pago && dentro(p.pago)));
    const total = periodo === "tudo" ? c.total : parc.reduce((s, p) => s + p.valor, 0);
    const recebido = periodo === "tudo" ? c.recebido : parc.filter((p) => p.pago && dentro(p.pago)).reduce((s, p) => s + p.valor, 0);
    if (periodo !== "tudo" && !total && !c.pipeline && !c.obras) continue;
    const k = `${norm(c.cidade)}/${c.uf.toLowerCase()}`;
    const g = m.get(k) ?? { chave: k, cidade: c.cidade, uf: c.uf, la: c.la, lo: c.lo, distancia: distanciaKm(base, { la: c.la, lo: c.lo }),
      clientes: [], total: 0, recebido: 0, aberto: 0, atrasado: 0, pipeline: 0, negocios: 0, obras: 0 };
    g.clientes.push({ ...c, total, recebido });
    g.total += total; g.recebido += recebido; g.aberto += c.aberto; g.atrasado += c.atrasado;
    g.pipeline += c.pipeline; g.negocios += c.negocios; g.obras += c.obras;
    m.set(k, g);
  }
  return [...m.values()];
}
