"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- linhas do banco chegam sem tipo; convertidas campo a campo */
// Projetos / time técnico: quadros no estilo Trello.
// Sem Supabase configurado, tudo roda em memória (modo demonstração).
import { modoDemo, supabase } from "./supabase";

export type Membro = { id: string; nome: string; email: string; papel: string };
export type Quadro = { id: string; nome: string; descricao: string; fundo: string; posicao: number; arquivado: boolean; favorito: boolean };
export type Etiqueta = { id: string; quadro_id: string; nome: string; cor: string; posicao: number };
export type Lista = { id: string; quadro_id: string; nome: string; posicao: number; arquivada: boolean };
export type ItemCheck = { id: string; cartao_id: string; texto: string; feito: boolean; posicao: number };
export type Cartao = {
  id: string; quadro_id: string; lista_id: string; titulo: string; descricao: string; posicao: number; capa: string | null;
  etiquetas: string[]; membros: string[]; inicio: string | null; prazo: string | null; prazo_concluido: boolean; arquivado: boolean;
  oportunidade_id: string | null; created_at: string;
  checklist: ItemCheck[]; comentarios: number; anexos: number;
};
export type Comentario = { id: string; cartao_id: string; autor: string | null; texto: string; created_at: string };
export type Anexo = { id: string; cartao_id: string; nome: string; mime: string | null; tamanho: number | null; storage_path: string | null; url: string | null; created_at: string };
export type QuadroCompleto = { quadro: Quadro; etiquetas: Etiqueta[]; listas: Lista[]; cartoes: Cartao[] };

// paleta (nome → cor) usada em etiquetas, capas e fundos
export const CORES: Record<string, string> = {
  verde: "#12a150", amarelo: "#e8b10c", laranja: "#f5821f", vermelho: "#d63a2f", roxo: "#7c5cd6",
  azul: "#2f6fb5", ciano: "#22c7d6", rosa: "#d6489b", marinho: "#19295a", cinza: "#66738f",
};
export const FUNDOS: Record<string, string> = {
  marinho: "linear-gradient(135deg,#0e1a3d,#19295a 55%,#2f6fb5)",
  oceano: "linear-gradient(135deg,#0b3a5b,#2f6fb5 60%,#22c7d6)",
  por_do_sol: "linear-gradient(135deg,#7a2a1c,#d63a2f 45%,#f5821f)",
  floresta: "linear-gradient(135deg,#0d3b2a,#12704a 60%,#2fbf71)",
  uva: "linear-gradient(135deg,#2b1a4f,#5b3fc4 60%,#9b7cf0)",
  grafite: "linear-gradient(135deg,#1c2230,#3a4256 60%,#66738f)",
};

// ---------------------------------------------------------------- posição (inserir entre vizinhos)
export const posEntre = (antes?: number, depois?: number) =>
  antes === undefined && depois === undefined ? 1000 : antes === undefined ? depois! - 1000 : depois === undefined ? antes + 1000 : (antes + depois) / 2;

// ---------------------------------------------------------------- modelos
export const MODELOS: Record<string, { nome: string; listas: string[]; etiquetas: [string, string][] }> = {
  obra: {
    nome: "Obra / instalação",
    listas: ["A fazer", "Em andamento", "Aguardando material", "Revisão / testes", "Concluído"],
    etiquetas: [["Automação", "azul"], ["Áudio e vídeo", "roxo"], ["Rede / Wi-Fi", "ciano"], ["Segurança / CFTV", "laranja"], ["Elétrica", "amarelo"], ["Urgente", "vermelho"]],
  },
  time: {
    nome: "Time técnico (geral)",
    listas: ["Entrada", "Esta semana", "Em execução", "Pendente cliente", "Feito"],
    etiquetas: [["Visita técnica", "verde"], ["Assistência", "laranja"], ["Projeto", "azul"], ["Orçamento", "amarelo"], ["Urgente", "vermelho"]],
  },
  vazio: { nome: "Quadro em branco", listas: ["A fazer", "Fazendo", "Feito"], etiquetas: [["", "verde"], ["", "amarelo"], ["", "laranja"], ["", "vermelho"], ["", "roxo"], ["", "azul"]] },
};

// ---------------------------------------------------------------- conversões
const cartaoDe = (r: any): Cartao => ({
  id: r.id, quadro_id: r.quadro_id, lista_id: r.lista_id, titulo: r.titulo, descricao: r.descricao ?? "", posicao: Number(r.posicao),
  capa: r.capa, etiquetas: r.etiquetas ?? [], membros: r.membros ?? [], inicio: r.inicio, prazo: r.prazo, prazo_concluido: !!r.prazo_concluido,
  arquivado: !!r.arquivado, oportunidade_id: r.oportunidade_id, created_at: r.created_at, checklist: [], comentarios: 0, anexos: 0,
});

// ---------------------------------------------------------------- demonstração
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;
const DEMO = (() => {
  const q: Quadro = { id: "q1", nome: "Obra · Quinta da Baronesa", descricao: "Automação completa, cinema e rede.", fundo: "marinho", posicao: 1000, arquivado: false, favorito: true };
  const q2: Quadro = { id: "q2", nome: "Time técnico", descricao: "", fundo: "oceano", posicao: 2000, arquivado: false, favorito: false };
  const et: Etiqueta[] = MODELOS.obra.etiquetas.map(([nome, cor], i) => ({ id: "e" + i, quadro_id: "q1", nome, cor, posicao: i }));
  const ls: Lista[] = MODELOS.obra.listas.map((nome, i) => ({ id: "l" + i, quadro_id: "q1", nome, posicao: (i + 1) * 1000, arquivada: false }));
  const hoje = new Date();
  const dia = (k: number) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + k, 18).toISOString();
  const c = (id: string, l: number, titulo: string, extra: Partial<Cartao> = {}): Cartao => ({
    id, quadro_id: "q1", lista_id: "l" + l, titulo, descricao: "", posicao: Number(id.slice(1)) * 1000, capa: null, etiquetas: [], membros: [],
    inicio: null, prazo: null, prazo_concluido: false, arquivado: false, oportunidade_id: null, created_at: hoje.toISOString(), checklist: [], comentarios: 0, anexos: 0, ...extra,
  });
  const cartoes: Cartao[] = [
    c("c1", 0, "Passagem de cabos sala de cinema", { etiquetas: ["e1", "e4"], membros: ["m2"], prazo: dia(3) }),
    c("c2", 0, "Instalar rack e nobreak", { etiquetas: ["e0"], membros: ["m3"] }),
    c("c3", 1, "Configurar Control4 — iluminação térreo", { etiquetas: ["e0"], membros: ["m2", "m3"], prazo: dia(0), capa: "azul",
      checklist: [{ id: "k1", cartao_id: "c3", texto: "Dimmers sala", feito: true, posicao: 1 }, { id: "k2", cartao_id: "c3", texto: "Cenas", feito: false, posicao: 2 }, { id: "k3", cartao_id: "c3", texto: "Teclados", feito: false, posicao: 3 }], comentarios: 2 }),
    c("c4", 2, "Projetor Epson + tela 120\"", { etiquetas: ["e1", "e5"], prazo: dia(-2), anexos: 1 }),
    c("c5", 3, "Testes de cobertura Wi-Fi", { etiquetas: ["e2"], membros: ["m2"] }),
    c("c6", 4, "Câmeras perímetro", { etiquetas: ["e3"], prazo: dia(-6), prazo_concluido: true }),
  ];
  return {
    quadros: [q, q2], etiquetas: et, listas: ls, cartoes,
    equipe: [{ id: "m1", nome: "Matheus Esturrari", email: "", papel: "diretoria" }, { id: "m2", nome: "Lucas Técnico", email: "", papel: "tecnico" }, { id: "m3", nome: "Rafael Instalador", email: "", papel: "tecnico" }] as Membro[],
    comentarios: [{ id: "x1", cartao_id: "c3", autor: "m2", texto: "Dimmers da sala finalizados.", created_at: hoje.toISOString() }] as Comentario[],
    anexos: [] as Anexo[],
  };
})();

// ---------------------------------------------------------------- leitura
export async function listarQuadros(): Promise<(Quadro & { cartoes: number; atrasados: number })[]> {
  if (modoDemo) return DEMO.quadros.map((q) => ({ ...q, cartoes: DEMO.cartoes.filter((c) => c.quadro_id === q.id).length, atrasados: 1 }));
  const db = supabase();
  const [q, c] = await Promise.all([
    db.from("quadros").select("*").eq("arquivado", false).order("posicao"),
    db.from("cartoes").select("quadro_id, prazo, prazo_concluido").eq("arquivado", false),
  ]);
  if (q.error) throw q.error;
  const agora = new Date().toISOString();
  return (q.data ?? []).map((x: any) => ({
    ...x, descricao: x.descricao ?? "", posicao: Number(x.posicao),
    cartoes: (c.data ?? []).filter((k: any) => k.quadro_id === x.id).length,
    atrasados: (c.data ?? []).filter((k: any) => k.quadro_id === x.id && k.prazo && !k.prazo_concluido && k.prazo < agora).length,
  }));
}

export async function carregarQuadro(id: string): Promise<QuadroCompleto> {
  if (modoDemo) {
    const q = DEMO.quadros.find((x) => x.id === id) ?? DEMO.quadros[0];
    return { quadro: q, etiquetas: DEMO.etiquetas.filter((e) => e.quadro_id === q.id), listas: DEMO.listas.filter((l) => l.quadro_id === q.id), cartoes: DEMO.cartoes.filter((c) => c.quadro_id === q.id && !c.arquivado) };
  }
  const db = supabase();
  const [q, e, l, c] = await Promise.all([
    db.from("quadros").select("*").eq("id", id).single(),
    db.from("quadro_etiquetas").select("*").eq("quadro_id", id).order("posicao"),
    db.from("quadro_listas").select("*").eq("quadro_id", id).eq("arquivada", false).order("posicao"),
    db.from("cartoes").select("*").eq("quadro_id", id).eq("arquivado", false).order("posicao"),
  ]);
  for (const r of [q, e, l, c]) if (r.error) throw r.error;
  const cartoes = (c.data ?? []).map(cartaoDe);
  const ids = cartoes.map((x) => x.id);
  if (ids.length) {
    const [k, m, a] = await Promise.all([
      db.from("cartao_checklist").select("*").in("cartao_id", ids).order("posicao"),
      db.from("cartao_comentarios").select("cartao_id").in("cartao_id", ids),
      db.from("cartao_anexos").select("cartao_id").in("cartao_id", ids),
    ]);
    const porId = new Map(cartoes.map((x) => [x.id, x]));
    for (const it of (k.data ?? []) as any[]) porId.get(it.cartao_id)?.checklist.push({ ...it, posicao: Number(it.posicao) });
    for (const it of (m.data ?? []) as any[]) { const x = porId.get(it.cartao_id); if (x) x.comentarios++; }
    for (const it of (a.data ?? []) as any[]) { const x = porId.get(it.cartao_id); if (x) x.anexos++; }
  }
  const qd = q.data as any;
  return {
    quadro: { ...qd, descricao: qd.descricao ?? "", posicao: Number(qd.posicao) },
    etiquetas: (e.data ?? []).map((x: any) => ({ ...x, posicao: Number(x.posicao) })),
    listas: (l.data ?? []).map((x: any) => ({ ...x, posicao: Number(x.posicao) })),
    cartoes,
  };
}

export async function carregarEquipe(): Promise<Membro[]> {
  if (modoDemo) return DEMO.equipe;
  const { data, error } = await supabase().from("equipe").select("*");
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------- quadros
export async function criarQuadro(nome: string, modelo: keyof typeof MODELOS, fundo: string, posicao: number): Promise<string> {
  const m = MODELOS[modelo];
  if (modoDemo) {
    const id = uid();
    DEMO.quadros.push({ id, nome, descricao: "", fundo, posicao, arquivado: false, favorito: false });
    m.listas.forEach((n, i) => DEMO.listas.push({ id: uid(), quadro_id: id, nome: n, posicao: (i + 1) * 1000, arquivada: false }));
    m.etiquetas.forEach(([n, cor], i) => DEMO.etiquetas.push({ id: uid(), quadro_id: id, nome: n, cor, posicao: i }));
    return id;
  }
  const db = supabase();
  const q = await db.from("quadros").insert({ nome: nome.trim(), fundo, posicao }).select("id").single();
  if (q.error) throw q.error;
  const id = q.data.id as string;
  const [l, e] = await Promise.all([
    db.from("quadro_listas").insert(m.listas.map((n, i) => ({ quadro_id: id, nome: n, posicao: (i + 1) * 1000 }))),
    db.from("quadro_etiquetas").insert(m.etiquetas.map(([n, cor], i) => ({ quadro_id: id, nome: n, cor, posicao: i }))),
  ]);
  if (l.error) throw l.error;
  if (e.error) throw e.error;
  return id;
}

async function atualizar(tabela: string, id: string, campos: Record<string, unknown>) {
  if (modoDemo) {
    const fonte: Record<string, { id: string }[]> = { quadros: DEMO.quadros, quadro_listas: DEMO.listas, cartoes: DEMO.cartoes, quadro_etiquetas: DEMO.etiquetas };
    const x = fonte[tabela]?.find((y) => y.id === id); if (x) Object.assign(x, campos);
    return;
  }
  const { error } = await supabase().from(tabela).update(campos).eq("id", id);
  if (error) throw error;
}
async function inserir<T>(tabela: string, linha: Record<string, unknown>, demo: (id: string) => T): Promise<T> {
  if (modoDemo) return demo(uid());
  const { data, error } = await supabase().from(tabela).insert(linha).select().single();
  if (error) throw error;
  return data as T;
}
async function apagar(tabela: string, id: string) {
  if (modoDemo) return;
  const { error } = await supabase().from(tabela).delete().eq("id", id);
  if (error) throw error;
}

export const salvarQuadro = (id: string, campos: Partial<Quadro>) => atualizar("quadros", id, campos);

// ---------------------------------------------------------------- listas
export const criarLista = (quadro_id: string, nome: string, posicao: number) =>
  inserir<Lista>("quadro_listas", { quadro_id, nome: nome.trim(), posicao }, (id) => { const l = { id, quadro_id, nome, posicao, arquivada: false }; DEMO.listas.push(l); return l; })
    .then((l: any) => ({ ...l, posicao: Number(l.posicao) }) as Lista);
export const salvarLista = (id: string, campos: Partial<Lista>) => atualizar("quadro_listas", id, campos);

// ---------------------------------------------------------------- etiquetas
export const criarEtiqueta = (quadro_id: string, nome: string, cor: string, posicao: number) =>
  inserir<Etiqueta>("quadro_etiquetas", { quadro_id, nome, cor, posicao }, (id) => { const e = { id, quadro_id, nome, cor, posicao }; DEMO.etiquetas.push(e); return e; });
export const salvarEtiqueta = (id: string, campos: Partial<Etiqueta>) => atualizar("quadro_etiquetas", id, campos);
export const excluirEtiqueta = (id: string) => apagar("quadro_etiquetas", id);

// ---------------------------------------------------------------- cartões
export async function criarCartao(quadro_id: string, lista_id: string, titulo: string, posicao: number): Promise<Cartao> {
  const r = await inserir<any>("cartoes", { quadro_id, lista_id, titulo: titulo.trim(), posicao }, (id) => {
    const c = cartaoDe({ id, quadro_id, lista_id, titulo, posicao, created_at: new Date().toISOString() }); DEMO.cartoes.push(c); return c;
  });
  return { ...cartaoDe(r), checklist: [], comentarios: 0, anexos: 0 };
}
export const salvarCartao = (id: string, campos: Partial<Omit<Cartao, "checklist" | "comentarios" | "anexos">>) => atualizar("cartoes", id, campos);
export const excluirCartao = (id: string) => apagar("cartoes", id);

// checklist
export const criarItem = (cartao_id: string, texto: string, posicao: number) =>
  inserir<ItemCheck>("cartao_checklist", { cartao_id, texto: texto.trim(), posicao }, (id) => ({ id, cartao_id, texto, feito: false, posicao }));
export async function salvarItem(id: string, campos: Partial<ItemCheck>) {
  if (modoDemo) return;
  const extra = campos.feito === undefined ? {} : campos.feito ? { feito_em: new Date().toISOString(), feito_por: (await supabase().auth.getUser()).data.user?.id } : { feito_em: null, feito_por: null };
  const { error } = await supabase().from("cartao_checklist").update({ ...campos, ...extra }).eq("id", id);
  if (error) throw error;
}
export const excluirItem = (id: string) => apagar("cartao_checklist", id);

// comentários
export async function listarComentarios(cartao_id: string): Promise<Comentario[]> {
  if (modoDemo) return DEMO.comentarios.filter((c) => c.cartao_id === cartao_id);
  const { data, error } = await supabase().from("cartao_comentarios").select("*").eq("cartao_id", cartao_id).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function comentar(cartao_id: string, texto: string): Promise<Comentario> {
  if (modoDemo) { const c = { id: uid(), cartao_id, autor: "m1", texto, created_at: new Date().toISOString() }; DEMO.comentarios.push(c); return c; }
  const db = supabase();
  const autor = (await db.auth.getUser()).data.user?.id;
  const { data, error } = await db.from("cartao_comentarios").insert({ cartao_id, texto: texto.trim(), autor }).select().single();
  if (error) throw error;
  return data;
}
export const excluirComentario = (id: string) => apagar("cartao_comentarios", id);

// anexos
export async function listarAnexos(cartao_id: string): Promise<Anexo[]> {
  if (modoDemo) return DEMO.anexos.filter((a) => a.cartao_id === cartao_id);
  const { data, error } = await supabase().from("cartao_anexos").select("*").eq("cartao_id", cartao_id).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function anexarArquivo(cartao: Cartao, arquivo: File): Promise<Anexo> {
  if (arquivo.size > 50 * 1024 * 1024) throw new Error("Arquivo acima de 50 MB. Envie um link do OneDrive no lugar.");
  if (modoDemo) { const a = { id: uid(), cartao_id: cartao.id, nome: arquivo.name, mime: arquivo.type, tamanho: arquivo.size, storage_path: null, url: "#", created_at: new Date().toISOString() }; DEMO.anexos.push(a); return a; }
  const db = supabase();
  const caminho = `projetos/${cartao.quadro_id}/${cartao.id}/${Date.now()}-${arquivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_")}`;
  const up = await db.storage.from("documentos").upload(caminho, arquivo, { contentType: arquivo.type || undefined });
  if (up.error) throw up.error;
  const { data, error } = await db.from("cartao_anexos").insert({ cartao_id: cartao.id, nome: arquivo.name, mime: arquivo.type, tamanho: arquivo.size, storage_path: caminho }).select().single();
  if (error) { await db.storage.from("documentos").remove([caminho]); throw error; }
  return data;
}
export async function anexarLink(cartao_id: string, nome: string, url: string): Promise<Anexo> {
  if (!/^https?:\/\//i.test(url.trim())) throw new Error("Informe um link começando com https://");
  return inserir<Anexo>("cartao_anexos", { cartao_id, nome: nome.trim() || url.trim(), url: url.trim() },
    (id) => ({ id, cartao_id, nome: nome || url, mime: null, tamanho: null, storage_path: null, url, created_at: new Date().toISOString() }));
}
export async function abrirAnexo(a: Anexo): Promise<string> {
  if (a.url) return a.url;
  const { data, error } = await supabase().storage.from("documentos").createSignedUrl(a.storage_path!, 600);
  if (error) throw error;
  return data.signedUrl;
}
export async function excluirAnexo(a: Anexo) {
  if (modoDemo) return;
  const db = supabase();
  if (a.storage_path) await db.storage.from("documentos").remove([a.storage_path]);
  const { error } = await db.from("cartao_anexos").delete().eq("id", a.id);
  if (error) throw error;
}

// ---------------------------------------------------------------- tempo real
/** Avisa quando qualquer coisa do quadro muda em outro aparelho. */
export function ouvirQuadro(quadroId: string, aoMudar: () => void): () => void {
  if (modoDemo) return () => {};
  const db = supabase();
  let t: ReturnType<typeof setTimeout> | null = null;
  const avisar = () => { if (t) clearTimeout(t); t = setTimeout(aoMudar, 350); };
  const canal = db.channel("quadro-" + quadroId);
  for (const tabela of ["cartoes", "quadro_listas", "quadro_etiquetas"]) canal.on("postgres_changes", { event: "*", schema: "public", table: tabela, filter: `quadro_id=eq.${quadroId}` }, avisar);
  for (const tabela of ["cartao_checklist", "cartao_comentarios", "cartao_anexos"]) canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, avisar);
  canal.on("postgres_changes", { event: "UPDATE", schema: "public", table: "quadros", filter: `id=eq.${quadroId}` }, avisar);
  canal.subscribe();
  return () => { if (t) clearTimeout(t); db.removeChannel(canal); };
}

// ---------------------------------------------------------------- resumo para a home
export async function resumoProjetos(): Promise<{ atrasados: number; hoje: number; meus: number }> {
  if (modoDemo) return { atrasados: 1, hoje: 1, meus: 2 };
  const db = supabase();
  const uid = (await db.auth.getUser()).data.user?.id;
  const { data } = await db.from("cartoes").select("prazo, membros").eq("arquivado", false).eq("prazo_concluido", false).not("prazo", "is", null);
  const agora = new Date(), fimHoje = new Date(agora); fimHoje.setHours(23, 59, 59, 999);
  const L = (data ?? []) as { prazo: string; membros: string[] }[];
  return {
    atrasados: L.filter((c) => new Date(c.prazo) < agora).length,
    hoje: L.filter((c) => new Date(c.prazo) >= agora && new Date(c.prazo) <= fimHoje).length,
    meus: L.filter((c) => uid && c.membros?.includes(uid) && new Date(c.prazo) <= fimHoje).length,
  };
}
