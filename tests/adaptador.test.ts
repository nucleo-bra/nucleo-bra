import { describe, expect, it } from "vitest";
import { criar } from "@/legado/adaptador";

// Banco falso com a mesma forma das chamadas do supabase-js usadas pelo adaptador
function falso(linhas: { colecao: string; id: string; dados: Record<string, unknown> }[]) {
  const tab = new Map(linhas.map((l) => [l.colecao + "/" + l.id, l]));
  let canal: ((p: unknown) => void) | null = null;
  const db = {
    from: () => ({
      select: () => {
        const q = { order: () => q, range: async (de: number, ate: number) => ({ data: [...tab.values()].slice(de, ate + 1), error: null }) };
        return q;
      },
      upsert: async (r: { colecao: string; id: string; dados: Record<string, unknown> }) => {
        if (r.colecao === "log" && tab.has("log/" + r.id)) return { error: { message: "row-level security" } };
        tab.set(r.colecao + "/" + r.id, r); return { error: null };
      },
      delete: () => ({ eq: (_a: string, c: string) => ({ eq: async (_b: string, id: string) => { tab.delete(c + "/" + id); return { error: null }; } }) }),
    }),
    channel: () => ({ on: (_e: string, _f: unknown, cb: (p: unknown) => void) => { canal = cb; return { subscribe: () => {} }; } }),
  };
  return { db, tab, remoto: (p: unknown) => canal!(p) };
}
const espera = () => new Promise((r) => setTimeout(r, 0));

describe("adaptador do Financeiro v38", () => {
  it("entrega coleções, documentos meta e escuta com ordem/limite", async () => {
    const f = falso([
      { colecao: "it", id: "a", dados: { id: "a", valor: 10 } },
      { colecao: "meta", id: "fech", dados: { j: "{}" } },
      { colecao: "log", id: "l1", dados: { ts: "2026-01-01" } },
      { colecao: "log", id: "l2", dados: { ts: "2026-02-01" } },
    ]);
    const b = criar(f.db as never, "u");
    const its: unknown[][] = []; let fech: unknown; let cli: boolean | undefined; const logs: string[][] = [];
    b.collection("it").onSnapshot((s) => its.push(s.docs.map((d) => d.data())));
    b.doc("meta/fech").onSnapshot((s) => (fech = s.exists && s.data()));
    b.doc("meta/cli").onSnapshot((s) => (cli = s.exists));
    b.collection("log").orderBy("ts", "desc").limit(1).onSnapshot((s) => logs.push(s.docs.map((d) => d.id)));
    await espera(); await espera();
    expect(its.at(-1)).toEqual([{ id: "a", valor: 10 }]);
    expect(fech).toEqual({ j: "{}" });
    expect(cli).toBe(false);
    expect(logs.at(-1)).toEqual(["l2"]);
  });

  it("grava, apaga e recebe mudanças de outro aparelho", async () => {
    const f = falso([]);
    const b = criar(f.db as never, "u");
    let ult: unknown[] = [];
    b.collection("it").onSnapshot((s) => (ult = s.docs.map((d) => d.data())));
    await espera();
    await b.collection("it").doc("x").set({ id: "x", valor: 5 });
    await espera();
    expect(ult).toEqual([{ id: "x", valor: 5 }]);
    expect(f.tab.get("it/x")?.dados).toEqual({ id: "x", valor: 5 });
    f.remoto({ eventType: "INSERT", new: { colecao: "it", id: "y", dados: { id: "y" } } });
    await espera();
    expect(ult).toHaveLength(2);
    await b.collection("it").doc("x").delete();
    await espera();
    expect(ult).toEqual([{ id: "y" }]);
    expect(f.tab.has("it/x")).toBe(false);
  });

  it("erro de permissão vira mensagem clara e o cache volta ao banco", async () => {
    const f = falso([{ colecao: "log", id: "l", dados: { a: 1 } }]);
    const b = criar(f.db as never, "u");
    await espera();
    await expect(b.collection("log").doc("l").set({ a: 2 })).rejects.toThrow(/permissão/);
  });
});
