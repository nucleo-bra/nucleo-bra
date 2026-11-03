"use client";
// Recomendação de projeto: o Claude monta soluções por ambiente, compara itens e
// tira dúvidas usando o cadastro de produtos e a base de conhecimento da BRA.
import { useCallback, useEffect, useState } from "react";
import { BookMarked, Check, GitCompare, HelpCircle, Lightbulb, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Botao, campo, Janela, Rotulo } from "@/components/crm/ui";
import { ASSISTENTE_ATIVO, Conversa, Modo } from "@/components/assistente";
import { mensagemErro, modoDemo, supabase } from "@/lib/supabase";

type Nota = { id: string; titulo: string; conteudo: string; tags: string[]; updated_at: string };
const MODOS: [Modo, string, typeof Lightbulb, string[]][] = [
  ["projeto", "Recomendar projeto", Lightbulb, [
    "Casa térrea de 300 m², 4 suítes, sala de cinema e área gourmet: monte a solução de automação, rede e som por ambiente",
    "Apartamento de 180 m² com Control4: o que vai em cada ambiente e quantos access points?",
    "Escritório com 20 estações: rede, Wi-Fi e CFTV com itens do cadastro",
  ]],
  ["comparar", "Comparar itens", GitCompare, [
    "Compare os access points Ubiquiti do cadastro (cobertura, uso indicado e preço)",
    "Episode CORE-16-IC x caixas AAT de embutir: qual indicar para teto de gesso?",
    "Switches PoE Hikvision x Ubiquiti do cadastro",
  ]],
  ["geral", "Dúvidas e especificações", HelpCircle, [
    "Qual a diferença entre Core 1 e Core 3 da Control4?",
    "Que cabeamento preciso prever para um painel de LED de 3x1,5 m?",
    "Quanto de distância máxima entre switch e access point em cabo Cat6?",
  ]],
];

export default function Recomendacao() {
  const [modo, setModo] = useState<Modo>("projeto");
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [q, setQ] = useState("");
  const [editar, setEditar] = useState<Partial<Nota> | null>(null);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(async () => {
    if (modoDemo) { setNotas([]); return; }
    const { data, error } = await supabase().from("base_conhecimento").select("*").order("updated_at", { ascending: false });
    if (error) { setErro(mensagemErro(error)); setNotas([]); } else setNotas(data as Nota[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  const filtradas = (notas ?? []).filter((n) => !q.trim() || `${n.titulo} ${n.conteudo} ${n.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase()));

  async function salvar() {
    if (!editar) return;
    setErro(""); setOcupado(true);
    try {
      if (!editar.titulo?.trim() || !editar.conteudo?.trim()) throw new Error("Preencha o título e o conteúdo.");
      const linha = { titulo: editar.titulo.trim(), conteudo: editar.conteudo.trim(), tags: (editar.tags ?? []).filter(Boolean) };
      const db = supabase();
      const r = editar.id ? await db.from("base_conhecimento").update(linha).eq("id", editar.id) : await db.from("base_conhecimento").insert(linha);
      if (r.error) throw r.error;
      setEditar(null); carregar();
    } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  async function excluir(n: Nota) {
    if (!confirm(`Excluir “${n.titulo}” da base de conhecimento?`)) return;
    const { error } = await supabase().from("base_conhecimento").delete().eq("id", n.id);
    if (error) setErro(mensagemErro(error)); else carregar();
  }
  const atual = MODOS.find((m) => m[0] === modo)!;

  return (
    <Shell titulo={ASSISTENTE_ATIVO ? "Recomendação de projeto" : "Recomendação de projeto · base de conhecimento"}>
      <p className="-mt-3 mb-5 max-w-3xl text-[14px] text-suave">{ASSISTENTE_ATIVO
        ? "O assistente Claude usa os 500 produtos do cadastro (preço, descrição, fabricante) e as anotações da base de conhecimento abaixo. Tudo o que você registrar na base passa a ser usado nas respostas."
        : "Registre aqui os padrões técnicos e comerciais da BRA: kits por ambiente, regras de quantidade, especificações e comparativos de itens. Quando o assistente Claude for ativado, ele passa a usar esta base nas respostas."}</p>
      <div className={ASSISTENTE_ATIVO ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]" : ""}>
        {ASSISTENTE_ATIVO && <section className="sombra-bra overflow-hidden rounded-[18px] border border-linha bg-[#f6f7fa]">
          <div className="flex gap-1 overflow-x-auto border-b border-linha bg-white px-3 pt-3">
            {MODOS.map(([k, rot, I]) => (
              <button key={k} onClick={() => setModo(k)} className={`-mb-px inline-flex shrink-0 items-center gap-1.5 rounded-t-xl border px-3.5 py-2 text-[13.5px] font-semibold ${modo === k ? "border-linha border-b-[#f6f7fa] bg-[#f6f7fa] text-azul" : "border-transparent text-suave hover:text-tinta"}`}><I className="size-4" />{rot}</button>
            ))}
          </div>
          <Conversa key={modo} modo={modo} chave={`nucleo-claude-${modo}`} sugestoes={atual[3]} altura="h-[68dvh]" />
        </section>}

        <section className={`sombra-bra flex flex-col ${ASSISTENTE_ATIVO ? "max-h-[80dvh]" : "min-h-[60dvh]"} rounded-[18px] border border-linha bg-white`}>
          <header className="flex items-center gap-2 border-b border-linha px-4 py-3">
            <BookMarked className="size-5 text-azul" />
            <h2 className="flex-1 text-[15px] font-bold">Base de conhecimento</h2>
            <button onClick={() => setEditar({ tags: [] })} className="inline-flex items-center gap-1 rounded-lg border border-azul px-2.5 py-1 text-[12.5px] font-semibold text-azul hover:bg-[#eef3fb]"><Plus className="size-3.5" />Nova</button>
          </header>
          <div className="border-b border-linha px-4 py-2"><div className="relative"><Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-suave" /><input className={`${campo} py-1.5 pl-8`} placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
          {erro && !editar && <p className="mx-4 mt-2 rounded-lg bg-erro-claro px-3 py-2 text-[12.5px] text-erro">{erro}</p>}
          <ul className="min-h-0 flex-1 divide-y divide-linha overflow-y-auto">
            {!notas && <li className="flex items-center gap-2 px-4 py-6 text-suave"><Loader2 className="size-4 animate-spin" />Carregando…</li>}
            {notas && !filtradas.length && <li className="px-4 py-6 text-[13px] text-suave">Registre padrões da BRA: kits por ambiente, regras de quantidade (ex.: 1 access point a cada 80 m²), fornecedores preferidos, observações técnicas.</li>}
            {filtradas.map((n) => (
              <li key={n.id} className="group px-4 py-3">
                <div className="flex items-start gap-2">
                  <button onClick={() => setEditar(n)} className="min-w-0 flex-1 text-left">
                    <span className="block text-[13.5px] font-semibold hover:text-azul">{n.titulo}</span>
                    <span className="line-clamp-2 block text-[12.5px] text-suave">{n.conteudo}</span>
                    {n.tags.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{n.tags.map((t) => <span key={t} className="rounded bg-[#e3eefa] px-1.5 text-[11px] font-semibold text-azul">{t}</span>)}</span>}
                  </button>
                  <button onClick={() => setEditar(n)} className="rounded p-1 text-suave hover:text-azul" aria-label="Editar"><Pencil className="size-3.5" /></button>
                  <button onClick={() => excluir(n)} className="rounded p-1 text-suave opacity-0 group-hover:opacity-100 hover:text-erro" aria-label="Excluir"><Trash2 className="size-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Janela titulo={editar?.id ? "Editar anotação" : "Nova anotação"} aberto={!!editar} onFechar={() => { setEditar(null); setErro(""); }} largura="max-w-2xl"
        rodape={<><Botao tipo="pri" disabled={ocupado} onClick={salvar}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Salvar</Botao>{erro && <span className="text-[13px] text-erro">{erro}</span>}</>}>
        {editar && (
          <div className="space-y-3">
            <Rotulo rotulo="Título"><input className={campo} value={editar.titulo ?? ""} onChange={(e) => setEditar({ ...editar, titulo: e.target.value })} placeholder="Ex.: Padrão de Wi-Fi para casas acima de 300 m²" /></Rotulo>
            <Rotulo rotulo="Conteúdo"><textarea className={campo} rows={10} value={editar.conteudo ?? ""} onChange={(e) => setEditar({ ...editar, conteudo: e.target.value })} placeholder="Regras, especificações, itens indicados, observações…" /></Rotulo>
            <Rotulo rotulo="Tags (separe por vírgula)"><input className={campo} value={(editar.tags ?? []).join(", ")} onChange={(e) => setEditar({ ...editar, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="rede, wi-fi, ubiquiti" /></Rotulo>
          </div>
        )}
      </Janela>
    </Shell>
  );
}
