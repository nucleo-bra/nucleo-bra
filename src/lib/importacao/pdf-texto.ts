// Extrai o texto de um PDF agrupado em linhas (funciona no navegador e no Node).
export type LinhaPdf = { pagina: number; y: number; texto: string };

export async function extrairLinhasPdf(dados: ArrayBuffer | Uint8Array): Promise<LinhaPdf[]> {
  const pdfjs = typeof window === "undefined"
    ? await import("pdfjs-dist/legacy/build/pdf.mjs")
    : await import("pdfjs-dist");
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(dados.slice(0)), useSystemFonts: true });
  const doc = await tarefa.promise;
  const linhas: LinhaPdf[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const conteudo = await (await doc.getPage(p)).getTextContent();
    const porY = new Map<number, { x: number; s: string }[]>();
    for (const it of conteudo.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      // tolera 2 pontos de diferença na mesma linha
      const chave = [...porY.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      (porY.get(chave) ?? porY.set(chave, []).get(chave)!).push({ x: it.transform[4], s: it.str });
    }
    [...porY.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([y, partes]) =>
        linhas.push({
          pagina: p, y,
          texto: partes.sort((a, b) => a.x - b.x).map((x) => x.s.trim()).join(" ").replace(/\s+/g, " ").trim(),
        }),
      );
  }
  await tarefa.destroy();
  return linhas;
}
