"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- conteúdo dos cartões é JSON livre por modelo */
// Editores dos cartões da documentação (um por modelo).
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Camera, ClipboardPaste, Eye, EyeOff, FileUp, Loader2, PackageSearch, Plus, Trash2, X } from "lucide-react";
import { fotoProduto } from "@/lib/orcamentos";
import {
  Bloco, Coluna, COLUNAS, conteudoInicial, Doc, enviarArquivoObra, gravarSenha, linhasVazias, ObraCompleta, paginasPdf, reduzirImagem, removerArquivo, salvarDoc,
  STATUS_DOC, StatusDoc, uid, urlArquivo,
} from "@/lib/obras";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";

const inp = "w-full rounded-lg border border-linha bg-white px-2.5 py-1.5 text-[13.5px] outline-none focus:border-azul";
const cel = "w-full min-w-0 bg-transparent px-1.5 py-1 text-[12.5px] outline-none focus:bg-[#eef5ff]";
const AJUDA: Record<string, string> = {
  capa: "Gerada sozinha no modelo novo da BRA: capa “Documentação técnica” com o nome do cliente, a apresentação “Sobre a BR Ambientes Inteligentes” e as marcas representadas.",
  objetivo: "Texto de abertura da documentação. Já vem com o texto padrão; ajuste se precisar.",
  plantas: "Suba as plantas do projeto executivo (PDF, imagem ou DWG). Cada página de PDF vira uma figura no caderno; DWG fica guardado e é citado no PDF.",
  equipamentos: "Lista com foto de cada equipamento instalado. Use “Puxar do orçamento” e ajuste quantidades e nomes.",
  circuitos: "Número do circuito e ambiente, por pavimento. Os circuitos aparecem como sugestão na tabela de pulsadores e no mapa de cenas.",
  pulsadores: "Uma linha por caixa/pulsador. Para cada tecla: cabo, cor e circuito. Dá para colar do Excel.",
  cenas: "Cada caixa com suas teclas e o que cada clique faz (1 clique, 3 cliques, segurar…).",
  redes: "Portas dos switches e do roteador, e a tabela de IR/RF. Use “Bloco” para incluir outro switch.",
  galeria: "Prints e fotos de configuração (NVR, gravação, câmeras), com legenda.",
  cameras: "Uma imagem por câmera, com o nome (ex.: Câmera 01 – Frente).",
  fotos: "Fotos das instalações: quadros, rack, pontos e acabamento.",
  senhas: "Contas e senhas do cliente. As senhas ficam protegidas: só técnico e diretoria veem, e cada visualização fica no Histórico.",
  relacao: "IP, MAC, serial e login de cada equipamento. Use “Puxar equipamentos” e a faixa de IP para preencher mais rápido.",
  encerramento: "Mensagem final e o link da pasta de arquivos (vira QR code na última página).",
};

export function EditorDoc({ doc, obra, senhas, podeSenha, onSenhas, onSalvo, onFechar }: {
  doc: Doc; obra: ObraCompleta; senhas: Record<string, string> | null; podeSenha: boolean;
  onSenhas: (s: Record<string, string>) => void; onSalvo: (c: Partial<Doc>) => void; onFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [c, setC] = useState<any>(() => (doc.conteudo && Object.keys(doc.conteudo).length ? doc.conteudo : conteudoInicial(doc.modelo, doc.grupo)));
  const [titulo, setTitulo] = useState(doc.titulo);
  const [status, setStatus] = useState<StatusDoc>(doc.status);
  const [estado, setEstado] = useState<"" | "salvando" | "salvo" | "erro">("");
  const [erro, setErro] = useState("");
  const pronto = useRef(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  // salva sozinho (0,8 s depois da última mudança)
  useEffect(() => {
    if (!pronto.current) { pronto.current = true; return; }
    setEstado("salvando");
    const t = setTimeout(async () => {
      const st: StatusDoc = status === "pendente" ? "preenchendo" : status;
      try { await salvarDoc(doc.id, { conteudo: c, titulo: titulo.trim() || doc.titulo, status: st }); if (st !== status) setStatus(st); onSalvo({ conteudo: c, titulo, status: st }); setEstado("salvo"); }
      catch (e) { setErro(mensagemErro(e)); setEstado("erro"); }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, titulo]);
  async function mudarStatus(s: StatusDoc) {
    setStatus(s);
    try { await salvarDoc(doc.id, { status: s }); onSalvo({ status: s }); } catch (e) { setErro(mensagemErro(e)); }
  }
  async function segredo(chave: string, valor: string) {
    const novo = { ...(senhas ?? {}), [chave]: valor }; if (!valor) delete novo[chave];
    onSenhas(novo);
    try { await gravarSenha(obra.obra.id, chave, valor); } catch (e) { setErro(mensagemErro(e)); }
  }
  const props = { c, setC, doc, obra, senhas: senhas ?? {}, podeSenha, segredo, setErro };

  return (
    <dialog ref={ref} onClose={onFechar} className="m-auto h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-6xl rounded-[22px] border border-linha bg-fundo p-0 text-tinta shadow-2xl backdrop:bg-black/35 backdrop:backdrop-blur-[6px]">
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-linha bg-white px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold tracking-[.12em] text-suave uppercase">{doc.grupo}</div>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={doc.modelo === "capa"} aria-label="Título do cartão" className="w-full bg-transparent font-display text-[19px] font-bold outline-none" />
          </div>
          <span className="text-[12px] text-suave">{estado === "salvando" ? "Salvando…" : estado === "salvo" ? "Salvo" : estado === "erro" ? <span className="text-erro">Erro ao salvar</span> : ""}</span>
          <select value={status} onChange={(e) => mudarStatus(e.target.value as StatusDoc)} aria-label="Situação" className="rounded-full border px-3 py-1.5 text-[13px] font-semibold" style={{ color: STATUS_DOC[status].cor, background: STATUS_DOC[status].fundo, borderColor: "transparent" }}>
            {(Object.keys(STATUS_DOC) as StatusDoc[]).map((s) => <option key={s} value={s}>{STATUS_DOC[s].rot}</option>)}
          </select>
          <button onClick={() => ref.current?.close()} className="rounded-full p-2 text-suave hover:bg-fundo" aria-label="Fechar"><X className="size-5" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p className="mb-4 rounded-xl bg-white px-4 py-3 text-[13px] text-suave">{AJUDA[doc.modelo]}</p>
          {erro && <p role="alert" className="mb-4 rounded-xl bg-erro-claro px-4 py-2.5 text-[13px] text-erro">{erro} <button onClick={() => setErro("")} className="ml-2 underline">ok</button></p>}
          {doc.modelo === "capa" && <Capa />}
          {(doc.modelo === "objetivo" || doc.modelo === "encerramento") && <Texto {...props} />}
          {["plantas", "galeria", "cameras", "fotos"].includes(doc.modelo) && <Arquivos {...props} />}
          {doc.modelo === "equipamentos" && <Equipamentos {...props} />}
          {["circuitos", "pulsadores", "redes", "relacao"].includes(doc.modelo) && <Tabelas {...props} />}
          {doc.modelo === "cenas" && <Cenas {...props} />}
          {doc.modelo === "senhas" && <Senhas {...props} />}
        </div>
      </div>
    </dialog>
  );
}
type P = { c: any; setC: (f: any) => void; doc: Doc; obra: ObraCompleta; senhas: Record<string, string>; podeSenha: boolean; segredo: (k: string, v: string) => void; setErro: (s: string) => void };

function Capa() {
  return <div className="grid gap-4 sm:grid-cols-3">{[["/documentacao/capa.jpg", "Capa"], ["/orcamento/apresentacao.jpg", "01 · Apresentação"], ["/orcamento/marcas.jpg", "02 · Marcas"]].map(([s, t]) => (
    // eslint-disable-next-line @next/next/no-img-element
    <figure key={s} className="overflow-hidden rounded-xl border border-linha bg-white"><img src={s} alt={t} className="w-full" /><figcaption className="px-3 py-2 text-[12.5px] font-semibold">{t}</figcaption></figure>))}</div>;
}

function Texto({ c, setC, doc, obra }: P) {
  return (
    <div className="space-y-3 rounded-2xl bg-white p-4">
      <textarea rows={doc.modelo === "objetivo" ? 10 : 5} value={c.texto ?? ""} onChange={(e) => setC({ ...c, texto: e.target.value })} className={`${inp} text-[14px] leading-relaxed`} aria-label="Texto" />
      {doc.modelo === "encerramento" && <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Link da pasta de arquivos (QR code)</span>
        <input value={c.link ?? ""} onChange={(e) => setC({ ...c, link: e.target.value })} placeholder={obra.obra.link_arquivos ?? "https://…"} className={inp} />
        <span className="mt-1 block text-[12px] text-suave">Vazio = usa o link da Visão geral{obra.obra.link_arquivos ? "" : " (ainda não preenchido)"}.</span></label>}
    </div>
  );
}

function Miniatura({ caminho, alt }: { caminho?: string; alt: string }) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => { if (caminho && !modoDemo) urlArquivo(caminho).then(setU).catch(() => setU(null)); }, [caminho]);
  // eslint-disable-next-line @next/next/no-img-element
  return u ? <img src={u} alt={alt} className="h-full w-full object-contain" /> : <span className="grid h-full w-full place-items-center text-[11px] text-suave">{caminho ? "…" : "sem imagem"}</span>;
}

function Arquivos({ c, setC, doc, obra, setErro }: P) {
  const [enviando, setEnviando] = useState("");
  const itens: any[] = c.itens ?? [];
  const set = (L: any[]) => setC({ ...c, itens: L });
  async function subir(arqs: FileList | null) {
    if (!arqs?.length) return;
    const novos: any[] = [];
    try {
      let k = 0;
      for (const a of Array.from(arqs)) {
        setEnviando(`Enviando ${++k}/${arqs.length}…`);
        if (/\.pdf$/i.test(a.name)) {
          const original = await enviarArquivoObra(obra.obra.id, a, a.name);
          const pgs = await paginasPdf(a);
          const paginas: string[] = [];
          for (const [i, b] of pgs.entries()) paginas.push(await enviarArquivoObra(obra.obra.id, b, `${a.name.replace(/\.pdf$/i, "")}-p${i + 1}.jpg`));
          novos.push({ id: uid(), nome: a.name, arquivo: original, paginas, legenda: a.name.replace(/\.pdf$/i, "") });
        } else if (a.type.startsWith("image/")) {
          const img = await enviarArquivoObra(obra.obra.id, await reduzirImagem(a), a.name.replace(/\.\w+$/, "") + ".jpg");
          const n = itens.length + novos.length + 1;
          novos.push({ id: uid(), nome: a.name, imagem: img, legenda: doc.modelo === "cameras" ? `Câmera ${String(n).padStart(2, "0")} – ` : "" });
        } else {
          novos.push({ id: uid(), nome: a.name, arquivo: await enviarArquivoObra(obra.obra.id, a, a.name), legenda: a.name });
        }
      }
    } catch (e) { setErro(mensagemErro(e)); }
    set([...itens, ...novos]); setEnviando("");
  }
  function mover(i: number, d: -1 | 1) { const j = i + d; if (j < 0 || j >= itens.length) return; const L = [...itens]; [L[i], L[j]] = [L[j], L[i]]; set(L); }
  async function tirar(x: any) {
    set(itens.filter((y) => y.id !== x.id));
    for (const p of [x.imagem, x.arquivo, ...(x.paginas ?? [])].filter(Boolean)) removerArquivo(p).catch(() => {});
  }
  const aceita = doc.modelo === "plantas" ? "application/pdf,image/*,.dwg,.dxf" : "image/*";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl bg-azul px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-azul-escuro ${enviando ? "pointer-events-none opacity-60" : ""}`}>
          {enviando ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}{enviando || (doc.modelo === "plantas" ? "Enviar plantas" : "Enviar imagens")}
          <input type="file" multiple accept={aceita} className="hidden" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} />
        </label>
        {doc.modelo !== "plantas" && <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-linha bg-white px-4 py-2.5 text-[13.5px] font-semibold hover:border-azul md:hidden">
          <Camera className="size-4" />Tirar foto<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { subir(e.target.files); e.target.value = ""; }} /></label>}
      </div>
      <div className={`grid gap-3 ${doc.modelo === "plantas" || doc.modelo === "galeria" ? "md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {itens.map((x, i) => (
          <div key={x.id} className="overflow-hidden rounded-2xl border border-linha bg-white">
            <div className="h-44 bg-[#f7f8fa] p-2"><Miniatura caminho={x.imagem ?? x.paginas?.[0]} alt={x.legenda || x.nome} /></div>
            <div className="space-y-2 p-3">
              <input value={x.legenda ?? ""} onChange={(e) => set(itens.map((y) => (y.id === x.id ? { ...y, legenda: e.target.value } : y)))} placeholder="Legenda" className={inp} aria-label="Legenda" />
              <div className="flex items-center gap-1 text-[12px] text-suave">
                <span className="flex-1 truncate">{x.paginas?.length ? `${x.paginas.length} página(s) · ` : ""}{x.nome}</span>
                <button onClick={() => mover(i, -1)} className="rounded p-1 hover:bg-fundo" aria-label="Subir"><ArrowUp className="size-3.5" /></button>
                <button onClick={() => mover(i, 1)} className="rounded p-1 hover:bg-fundo" aria-label="Descer"><ArrowDown className="size-3.5" /></button>
                {x.arquivo && <button onClick={async () => window.open(await urlArquivo(x.arquivo), "_blank")} className="rounded px-1.5 py-1 font-semibold text-azul hover:bg-fundo">Abrir</button>}
                <button onClick={() => tirar(x)} className="rounded p-1 hover:bg-erro-claro hover:text-erro" aria-label="Remover"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!itens.length && !enviando && <p className="rounded-2xl border border-dashed border-linha bg-white/60 py-10 text-center text-[13px] text-suave">Nada enviado ainda.</p>}
      {(doc.modelo === "plantas" || doc.modelo === "galeria") && <label className="block"><span className="mb-1 block text-[12px] font-semibold text-suave">Observação (sai embaixo, no PDF)</span>
        <input value={c.obs ?? ""} onChange={(e) => setC({ ...c, obs: e.target.value })} className={inp} /></label>}
    </div>
  );
}

function Equipamentos({ c, setC, obra }: P) {
  const itens: any[] = c.itens ?? [];
  const sistemas: string[] = c.sistemas ?? [];
  const todos = [...new Set(obra.itens.map((i) => i.sistema).filter(Boolean))];
  const set = (L: any[]) => setC({ ...c, itens: L });
  const [fotos, setFotos] = useState<Record<string, { imagem_path: string | null; modelo: string | null }>>({});
  useEffect(() => {
    const ids = [...new Set(obra.itens.map((i) => i.produto_id).filter(Boolean))] as string[];
    if (!ids.length || modoDemo) return;
    supabase().from("produtos").select("id, imagem_path, modelo").in("id", ids).then(({ data }) => setFotos(Object.fromEntries((data ?? []).map((p: any) => [p.id, p]))));
  }, [obra.itens]);
  function puxar() {
    const sel = obra.itens.filter((i) => !sistemas.length || sistemas.some((s) => i.sistema.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(i.sistema.toLowerCase())));
    const ja = new Set(itens.map((x) => x.produto_id).filter(Boolean));
    const novos = sel.filter((i) => !i.produto_id || !ja.has(i.produto_id)).map((i) => ({
      id: uid(), produto_id: i.produto_id, qtd: i.quantidade, nome: i.descricao, modelo: fotos[i.produto_id ?? ""]?.modelo || i.sku || "", foto: fotos[i.produto_id ?? ""]?.imagem_path ?? null,
    }));
    set([...itens, ...novos]);
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4">
        <span className="mb-2 block text-[12px] font-semibold text-suave">Ambientes do orçamento que entram neste cartão</span>
        <div className="flex flex-wrap gap-1.5">
          {todos.map((s) => { const on = sistemas.includes(s); return <button key={s} onClick={() => setC({ ...c, sistemas: on ? sistemas.filter((x) => x !== s) : [...sistemas, s] })} className={`rounded-full border px-3 py-1 text-[13px] ${on ? "border-azul bg-[#eef5ff] font-semibold" : "border-linha text-suave"}`}>{s}</button>; })}
          {!todos.length && <span className="text-[13px] text-suave">A obra não tem itens do orçamento (adicione manualmente).</span>}
        </div>
        <button onClick={puxar} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-azul px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-azul-escuro"><PackageSearch className="size-4" />Puxar do orçamento</button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-linha bg-white">
        <table className="w-full text-[13px]">
          <thead><tr className="bg-[#f7f9fc] text-left text-[12px] text-suave"><th className="w-14 py-2 pl-3">Foto</th><th className="w-20">Qtd.</th><th>Equipamento</th><th className="w-48">Modelo</th><th className="w-10" /></tr></thead>
          <tbody className="divide-y divide-linha">
            {itens.map((x) => (
              <tr key={x.id}>
                <td className="py-1.5 pl-3">{x.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoProduto(x.foto) ?? ""} alt="" className="size-10 rounded-md object-contain" />) : <span className="block size-10 rounded-md bg-fundo" />}</td>
                <td><input value={x.qtd ?? ""} onChange={(e) => set(itens.map((y) => (y.id === x.id ? { ...y, qtd: e.target.value } : y)))} className={cel} aria-label="Quantidade" /></td>
                <td><input value={x.nome ?? ""} onChange={(e) => set(itens.map((y) => (y.id === x.id ? { ...y, nome: e.target.value } : y)))} className={cel} aria-label="Equipamento" /></td>
                <td><input value={x.modelo ?? ""} onChange={(e) => set(itens.map((y) => (y.id === x.id ? { ...y, modelo: e.target.value } : y)))} className={cel} aria-label="Modelo" /></td>
                <td><button onClick={() => set(itens.filter((y) => y.id !== x.id))} className="rounded p-1 text-suave hover:text-erro" aria-label="Remover"><Trash2 className="size-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => set([...itens, { id: uid(), qtd: 1, nome: "", modelo: "" }])} className="flex w-full items-center gap-1.5 border-t border-linha px-3 py-2 text-[13px] font-semibold text-azul hover:bg-fundo"><Plus className="size-4" />Equipamento</button>
      </div>
    </div>
  );
}

function Secreto({ valor, onSalvar, pode }: { valor: string; onSalvar: (v: string) => void; pode: boolean }) {
  const [ver, setVer] = useState(false);
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  if (!pode) return <span className="px-1.5 text-[12.5px] text-suave">{valor ? "••••••" : "—"}</span>;
  return (
    <span className="flex items-center">
      <input type={ver ? "text" : "password"} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== valor && onSalvar(v)} autoComplete="new-password" className={cel} aria-label="Senha" />
      <button type="button" onClick={() => setVer(!ver)} className="p-1 text-suave" aria-label={ver ? "Esconder" : "Mostrar"}>{ver ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</button>
    </span>
  );
}

/** Lê uma colagem do Excel (colunas separadas por tabulação). */
export function lerColagem(texto: string, colunas: Coluna[]): Record<string, string>[] {
  return texto.replace(/\r/g, "").split("\n").filter((l) => l.trim()).map((l) => {
    const v = l.split("\t");
    return Object.fromEntries([["id", uid()], ...colunas.filter((c) => !c.secreto).map((c, i) => [c.k, (v[i] ?? "").trim()])]);
  });
}

function Tabelas({ c, setC, doc, obra, senhas, podeSenha, segredo }: P) {
  const blocos: Bloco[] = c.blocos ?? [];
  const set = (L: Bloco[], extra: any = {}) => setC({ ...c, ...extra, blocos: L });
  const upd = (b: Bloco, campos: Partial<Bloco>) => set(blocos.map((x) => (x.id === b.id ? { ...x, ...campos } : x)));
  const [colar, setColar] = useState<string | null>(null);
  const [textoColar, setTextoColar] = useState("");
  // sugestões de circuito (do cartão de circuitos desta obra)
  const circuitos = useMemo(() => obra.docs.filter((d) => d.modelo === "circuitos").flatMap((d) => (d.conteudo?.blocos ?? []).flatMap((b: Bloco) => b.linhas))
    .filter((l: any) => l.circuito).map((l: any) => ({ v: l.circuito, rot: l.ambiente })), [obra.docs]);
  function novoBloco(tipo?: keyof typeof COLUNAS) {
    const colunas = tipo ? COLUNAS[tipo] : blocos[0]?.colunas ?? COLUNAS.circuitos;
    set([...blocos, { id: uid(), titulo: tipo === "irrf" ? "Tabela de IR / RF" : doc.modelo === "redes" ? `Switch ${String(blocos.length + 1).padStart(2, "0")}` : "Novo bloco", colunas, linhas: linhasVazias(doc.modelo === "redes" ? 8 : 6).map((l, i) => (doc.modelo === "redes" && tipo !== "irrf" ? { ...l, porta: String(i + 1) } : l)) }]);
  }
  function puxarRelacao(b: Bloco) {
    const base = (c.faixa ?? "").trim().replace(/\.$/, "");
    let ip = 1;
    const usados = new Set(b.linhas.map((l) => l.ip).filter(Boolean));
    const prox = () => { if (!base) return ""; while (usados.has(`${base}.${ip}`)) ip++; const r = `${base}.${ip}`; usados.add(r); ip++; return r; };
    const novos: Record<string, string>[] = [];
    for (const i of obra.itens) {
      if (/^m$|metro|rolo|cx|caixa/i.test(i.unidade) || /cabo|conector|tubo|caixa|parafuso|fita|eletroduto/i.test(i.descricao)) continue;
      for (let k = 0; k < Math.min(i.quantidade, 30); k++) novos.push({ id: uid(), equipamento: i.descricao, marca: i.marca ?? "", modelo: i.sku ?? "", ip: prox(), mascara: base ? "255.255.255.0" : "", gateway: base ? `${base}.1` : "", status: "ONLINE" });
    }
    const todas = [...b.linhas.filter((l) => Object.entries(l).some(([k, v]) => k !== "id" && String(v).trim())), ...novos].map((l, i) => ({ ...l, item: String(i + 1) }));
    upd(b, { linhas: todas });
  }
  return (
    <div className="space-y-5">
      {doc.modelo === "relacao" && <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4">
        <label className="w-56"><span className="mb-1 block text-[12px] font-semibold text-suave">Faixa de IP da rede</span><input value={c.faixa ?? ""} onChange={(e) => setC({ ...c, faixa: e.target.value })} placeholder="10.72.10" className={inp} /></label>
        <button onClick={() => blocos[0] && puxarRelacao(blocos[0])} className="inline-flex items-center gap-2 rounded-xl bg-azul px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-azul-escuro"><PackageSearch className="size-4" />Puxar equipamentos da obra</button>
        <span className="text-[12px] text-suave">Cria uma linha por unidade (sem cabos e acessórios), com IP sequencial.</span>
      </div>}
      {circuitos.length > 0 && <datalist id={`circ-${doc.id}`}>{circuitos.map((x: any) => <option key={x.v + x.rot} value={x.v}>{x.rot}</option>)}</datalist>}
      {blocos.map((b) => {
        const grupos = b.colunas.some((x) => x.grupo);
        return (
          <section key={b.id} className="overflow-hidden rounded-2xl border border-linha bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-linha px-3 py-2">
              <input value={b.titulo} onChange={(e) => upd(b, { titulo: e.target.value })} className="min-w-0 flex-1 bg-transparent text-[14px] font-bold outline-none" aria-label="Título do bloco" />
              <button onClick={() => { setColar(b.id); setTextoColar(""); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-suave hover:bg-fundo"><ClipboardPaste className="size-3.5" />Colar do Excel</button>
              <button onClick={() => blocos.length > 1 && confirm("Remover este bloco?") && set(blocos.filter((x) => x.id !== b.id))} disabled={blocos.length < 2} className="rounded-lg p-1 text-suave hover:text-erro disabled:opacity-30" aria-label="Remover bloco"><Trash2 className="size-4" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left" style={{ minWidth: b.colunas.length * (doc.modelo === "relacao" ? 112 : 78) }}>
                <thead className="bg-[#f7f9fc] text-[11.5px] text-suave">
                  {grupos && <tr>{b.colunas.map((col, i) => (!col.grupo ? <th key={col.k} rowSpan={2} className="border border-linha px-1.5 py-1">{col.rot}</th>
                    : i === 0 || b.colunas[i - 1].grupo !== col.grupo ? <th key={col.k} colSpan={b.colunas.filter((x) => x.grupo === col.grupo).length} className="border border-linha px-1.5 py-1 text-center">{col.grupo}</th> : null))}<th rowSpan={2} className="w-8 border border-linha" /></tr>}
                  <tr>{b.colunas.filter((x) => !grupos || x.grupo).map((col) => <th key={col.k} className="border border-linha px-1.5 py-1 font-semibold">{col.rot}</th>)}{!grupos && <th className="w-8 border border-linha" />}</tr>
                </thead>
                <tbody>
                  {b.linhas.map((l) => (
                    <tr key={l.id} className="group">
                      {b.colunas.map((col) => <td key={col.k} className="border border-linha p-0" style={col.larg ? { width: col.larg * 1.6 } : undefined}>
                        {col.secreto ? <Secreto valor={senhas[`tab:${doc.id}:${l.id}:${col.k}`] ?? ""} pode={podeSenha} onSalvar={(v) => segredo(`tab:${doc.id}:${l.id}:${col.k}`, v)} />
                          : <input value={l[col.k] ?? ""} list={/circ/.test(col.k) && circuitos.length ? `circ-${doc.id}` : undefined}
                            onChange={(e) => upd(b, { linhas: b.linhas.map((y) => (y.id === l.id ? { ...y, [col.k]: e.target.value } : y)) })} className={cel} aria-label={col.rot} />}
                      </td>)}
                      <td className="border border-linha p-0 text-center"><button onClick={() => upd(b, { linhas: b.linhas.filter((y) => y.id !== l.id) })} className="p-1 text-suave opacity-0 hover:text-erro group-hover:opacity-100" aria-label="Remover linha"><X className="size-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-1 border-t border-linha px-2 py-1.5">
              <button onClick={() => upd(b, { linhas: [...b.linhas, ...linhasVazias(1).map((x) => (b.colunas[0]?.k === "porta" ? { ...x, porta: String(b.linhas.length + 1) } : b.colunas[0]?.k === "item" ? { ...x, item: String(b.linhas.length + 1) } : x))] })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-azul hover:bg-fundo"><Plus className="size-3.5" />Linha</button>
              <button onClick={() => upd(b, { linhas: [...b.linhas, ...linhasVazias(10)] })} className="rounded-lg px-2 py-1 text-[12.5px] font-semibold text-suave hover:bg-fundo">+10 linhas</button>
            </div>
            {colar === b.id && <div className="space-y-2 border-t border-linha bg-[#fbfcfe] p-3">
              <p className="text-[12.5px] text-suave">Copie as células no Excel (na ordem: {b.colunas.filter((x) => !x.secreto).map((x) => (x.grupo ? `${x.grupo} ${x.rot}` : x.rot)).join(", ")}) e cole aqui.</p>
              <textarea autoFocus rows={5} value={textoColar} onChange={(e) => setTextoColar(e.target.value)} className={`${inp} font-mono text-[12px]`} aria-label="Colar do Excel" />
              <div className="flex gap-2">
                <button onClick={() => { const novas = lerColagem(textoColar, b.colunas); upd(b, { linhas: [...b.linhas.filter((l) => Object.entries(l).some(([k, v]) => k !== "id" && k !== "porta" && String(v).trim())), ...novas] }); setColar(null); }}
                  className="rounded-lg bg-azul px-3 py-1.5 text-[13px] font-semibold text-white">Incluir {lerColagem(textoColar, b.colunas).length} linha(s)</button>
                <button onClick={() => setColar(null)} className="rounded-lg px-3 py-1.5 text-[13px] font-semibold text-suave">Cancelar</button>
              </div>
            </div>}
          </section>
        );
      })}
      <div className="flex gap-2">
        <button onClick={() => novoBloco(doc.modelo === "redes" ? "switch" : undefined)} className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13px] font-semibold hover:border-azul"><Plus className="size-4" />{doc.modelo === "redes" ? "Switch / roteador" : "Bloco (pavimento)"}</button>
        {doc.modelo === "redes" && <button onClick={() => novoBloco("irrf")} className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13px] font-semibold hover:border-azul"><Plus className="size-4" />Tabela IR / RF</button>}
      </div>
    </div>
  );
}

const CLIQUES = ["1 click", "2 clicks", "3 clicks", "Segurar", "Soltar"];
function Cenas({ c, setC, obra, doc }: P) {
  const caixas: any[] = c.caixas ?? [];
  const set = (L: any[]) => setC({ ...c, caixas: L });
  const upd = (cx: any, campos: any) => set(caixas.map((x) => (x.id === cx.id ? { ...x, ...campos } : x)));
  const updT = (cx: any, t: any, campos: any) => upd(cx, { teclas: cx.teclas.map((y: any) => (y.id === t.id ? { ...y, ...campos } : y)) });
  const sugestoes = useMemo(() => obra.docs.filter((d) => d.modelo === "circuitos").flatMap((d) => (d.conteudo?.blocos ?? []).flatMap((b: Bloco) => b.linhas))
    .filter((l: any) => l.circuito && l.ambiente).map((l: any) => `${l.ambiente} (${l.circuito})`), [obra.docs]);
  // caixas da tabela de pulsadores (para começar rápido)
  const daTabela = useMemo(() => obra.docs.filter((d) => d.modelo === "pulsadores").flatMap((d) => (d.conteudo?.blocos ?? []).flatMap((b: Bloco) => b.linhas.filter((l) => l.caixa).map((l) => ({ caixa: l.caixa, pav: b.titulo, n: [1, 2, 3, 4, 5, 6].filter((k) => l[`t${k}_circ`] || l[`t${k}_cabo`]).length || 2 })))), [obra.docs]);
  const nova = (base?: { caixa: string; pav: string; n: number }) => ({ id: uid(), nome: base?.caixa ?? `CAIXA ${String(caixas.length + 1).padStart(2, "0")}`, local: "", pavimento: base?.pav ?? caixas[caixas.length - 1]?.pavimento ?? "", teclas: Array.from({ length: base?.n ?? 2 }, () => ({ id: uid(), rotulo: "", acoes: [{ id: uid(), cliques: "1 click", acao: "" }] })) });
  return (
    <div className="space-y-4">
      <datalist id={`cena-${doc.id}`}>{sugestoes.map((s) => <option key={s} value={s} />)}</datalist>
      {daTabela.length > 0 && !caixas.length && <button onClick={() => set(daTabela.map(nova))} className="inline-flex items-center gap-2 rounded-xl bg-azul px-4 py-2 text-[13.5px] font-semibold text-white"><PackageSearch className="size-4" />Criar {daTabela.length} caixas a partir da tabela de pulsadores</button>}
      <div className="grid gap-4 lg:grid-cols-2">
        {caixas.map((cx) => (
          <div key={cx.id} className="rounded-2xl border border-linha bg-white p-4">
            <div className="mb-3 grid grid-cols-[1fr_1.4fr_1fr_auto] gap-2">
              <input value={cx.nome} onChange={(e) => upd(cx, { nome: e.target.value })} placeholder="CAIXA 02" className={`${inp} font-bold`} aria-label="Caixa" />
              <input value={cx.local} onChange={(e) => upd(cx, { local: e.target.value })} placeholder="Hall Suíte Murilo" className={inp} aria-label="Local" />
              <input value={cx.pavimento} onChange={(e) => upd(cx, { pavimento: e.target.value })} placeholder="Superior" className={inp} aria-label="Pavimento" />
              <button onClick={() => confirm("Remover esta caixa?") && set(caixas.filter((x) => x.id !== cx.id))} className="rounded-lg p-1.5 text-suave hover:text-erro" aria-label="Remover caixa"><Trash2 className="size-4" /></button>
            </div>
            <ol className="space-y-2">
              {cx.teclas.map((t: any, i: number) => (
                <li key={t.id} className="rounded-xl bg-[#f7f9fc] p-2">
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[12px] font-bold text-suave">Tecla {i + 1}</span>
                    <input value={t.rotulo} list={`cena-${doc.id}`} onChange={(e) => updT(cx, t, { rotulo: e.target.value })} placeholder="Spots Hall Suíte Murilo (306) ou Cena 307" className={inp} aria-label="Função da tecla" />
                    <button onClick={() => upd(cx, { teclas: cx.teclas.filter((y: any) => y.id !== t.id) })} className="p-1 text-suave hover:text-erro" aria-label="Remover tecla"><X className="size-3.5" /></button>
                  </div>
                  <ul className="mt-1.5 space-y-1 pl-16">
                    {t.acoes.map((a: any) => (
                      <li key={a.id} className="flex items-center gap-1.5">
                        <select value={a.cliques} onChange={(e) => updT(cx, t, { acoes: t.acoes.map((y: any) => (y.id === a.id ? { ...y, cliques: e.target.value } : y)) })} className="rounded-lg border border-linha bg-white px-1.5 py-1 text-[12.5px]" aria-label="Cliques">{CLIQUES.map((k) => <option key={k}>{k}</option>)}</select>
                        <input value={a.acao} onChange={(e) => updT(cx, t, { acoes: t.acoes.map((y: any) => (y.id === a.id ? { ...y, acao: e.target.value } : y)) })} placeholder="ON/OFF Led Suíte Murilo" className={inp} aria-label="Ação" />
                        <button onClick={() => updT(cx, t, { acoes: t.acoes.filter((y: any) => y.id !== a.id) })} className="p-1 text-suave hover:text-erro" aria-label="Remover ação"><X className="size-3" /></button>
                      </li>
                    ))}
                    <li><button onClick={() => updT(cx, t, { acoes: [...t.acoes, { id: uid(), cliques: CLIQUES[Math.min(t.acoes.length * 2, 2)], acao: "" }] })} className="text-[12px] font-semibold text-azul">+ ação</button></li>
                  </ul>
                </li>
              ))}
            </ol>
            <button onClick={() => upd(cx, { teclas: [...cx.teclas, { id: uid(), rotulo: "", acoes: [{ id: uid(), cliques: "1 click", acao: "" }] }] })} className="mt-2 text-[12.5px] font-semibold text-azul">+ Tecla</button>
          </div>
        ))}
      </div>
      <button onClick={() => set([...caixas, nova()])} className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13px] font-semibold hover:border-azul"><Plus className="size-4" />Caixa</button>
    </div>
  );
}

function Senhas({ c, setC, senhas, podeSenha, segredo }: P) {
  const contas: any[] = c.contas ?? [];
  const set = (L: any[]) => setC({ ...c, contas: L });
  return (
    <div className="space-y-3">
      {!podeSenha && <p className="rounded-xl bg-atencao-claro px-4 py-2.5 text-[13px] text-atencao">As senhas são visíveis só para técnico e diretoria.</p>}
      <div className="overflow-hidden rounded-2xl border border-linha bg-white">
        <table className="w-full text-[13px]">
          <thead><tr className="bg-[#f7f9fc] text-left text-[12px] text-suave"><th className="py-2 pl-3">Conta / serviço</th><th>Site</th><th>Usuário / rede</th><th className="w-52">Senha</th><th className="w-10" /></tr></thead>
          <tbody className="divide-y divide-linha">
            {contas.map((x) => (
              <tr key={x.id}>
                <td className="pl-2"><input value={x.servico} onChange={(e) => set(contas.map((y) => (y.id === x.id ? { ...y, servico: e.target.value } : y)))} className={`${cel} font-semibold`} aria-label="Conta" /></td>
                <td><input value={x.site} onChange={(e) => set(contas.map((y) => (y.id === x.id ? { ...y, site: e.target.value } : y)))} className={cel} aria-label="Site" /></td>
                <td><input value={x.usuario} onChange={(e) => set(contas.map((y) => (y.id === x.id ? { ...y, usuario: e.target.value } : y)))} className={cel} aria-label="Usuário" autoComplete="off" /></td>
                <td><Secreto valor={senhas[`senha:${x.id}`] ?? ""} pode={podeSenha} onSalvar={(v) => segredo(`senha:${x.id}`, v)} /></td>
                <td><button onClick={() => { set(contas.filter((y) => y.id !== x.id)); if (senhas[`senha:${x.id}`]) segredo(`senha:${x.id}`, ""); }} className="rounded p-1 text-suave hover:text-erro" aria-label="Remover"><Trash2 className="size-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={() => set([...contas, { id: uid(), servico: "", site: "", usuario: "" }])} className="flex w-full items-center gap-1.5 border-t border-linha px-3 py-2 text-[13px] font-semibold text-azul hover:bg-fundo"><Plus className="size-4" />Conta</button>
      </div>
    </div>
  );
}
