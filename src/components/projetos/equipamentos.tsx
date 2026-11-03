"use client";
// Equipamentos necessários para a visita (sai na agenda técnica, somado por técnico).
import { useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus, Search, X } from "lucide-react";
import { Cartao, Equipamento } from "@/lib/projetos";
import { buscarNoCatalogo, carregarCatalogo, Produto } from "@/lib/orcamentos";

export function EquipamentosVisita({ c, salvar }: { c: Cartao; salvar: (x: Partial<Cartao>) => Promise<void> }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [termo, setTermo] = useState(""), [aberto, setAberto] = useState(false);
  useEffect(() => { carregarCatalogo().then((x) => setProdutos(x.produtos)).catch(() => {}); }, []);
  const achados = useMemo(() => (aberto ? buscarNoCatalogo(produtos, termo, (p) => `${p.modelo} ${p.marca}`, 12) : []), [aberto, produtos, termo]);
  const lista = c.equipamentos ?? [];
  const gravar = (l: Equipamento[]) => salvar({ equipamentos: l });
  const adicionar = (e: Equipamento) => {
    const k = lista.findIndex((x) => (x.produto_id && x.produto_id === e.produto_id) || (!x.produto_id && x.nome.toLowerCase() === e.nome.toLowerCase()));
    gravar(k >= 0 ? lista.map((x, i) => (i === k ? { ...x, qtd: x.qtd + 1 } : x)) : [...lista, e]);
    setTermo(""); setAberto(false);
  };
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-3 text-[15px] font-bold"><Package className="size-5 text-suave" />Equipamentos para a visita</h3>
      <div className="space-y-2 pl-8">
        {lista.length > 0 && (
          <ul className="divide-y divide-linha rounded-xl border border-linha bg-white">
            {lista.map((e, i) => (
              <li key={(e.produto_id ?? e.nome) + i} className="flex items-center gap-2 px-3 py-1.5 text-[13.5px]">
                <span className="min-w-0 flex-1 truncate">{e.nome}</span>
                <button onClick={() => gravar(e.qtd > 1 ? lista.map((x, k) => (k === i ? { ...x, qtd: x.qtd - 1 } : x)) : lista.filter((_, k) => k !== i))} className="rounded p-1 text-suave hover:bg-fundo" aria-label="Menos"><Minus className="size-3.5" /></button>
                <span className="num w-6 text-center font-bold">{e.qtd}</span>
                <button onClick={() => gravar(lista.map((x, k) => (k === i ? { ...x, qtd: x.qtd + 1 } : x)))} className="rounded p-1 text-suave hover:bg-fundo" aria-label="Mais"><Plus className="size-3.5" /></button>
                <button onClick={() => gravar(lista.filter((_, k) => k !== i))} className="rounded p-1 text-suave hover:text-erro" aria-label="Remover"><X className="size-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-suave" />
          <input className="w-full rounded-lg border border-linha bg-white py-1.5 pr-2.5 pl-8 text-[14px] outline-none focus:border-azul" placeholder="Buscar no cadastro de produtos ou digitar (ferramenta, escada…)"
            value={termo} onFocus={() => setAberto(true)} onChange={(e) => { setTermo(e.target.value); setAberto(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" && termo.trim()) { e.preventDefault(); const p = achados[0]; adicionar(p ? { produto_id: p.id, nome: p.nome, qtd: 1 } : { produto_id: null, nome: termo.trim(), qtd: 1 }); } if (e.key === "Escape") setAberto(false); }}
            onBlur={() => setTimeout(() => setAberto(false), 150)} />
          {aberto && (termo || achados.length > 0) && (
            <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-linha bg-white py-1 shadow-xl">
              {achados.map((p) => (
                <li key={p.id}><button onMouseDown={(e) => e.preventDefault()} onClick={() => adicionar({ produto_id: p.id, nome: p.nome, qtd: 1 })} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-fundo">
                  <span className="min-w-0 flex-1 truncate">{p.codigo != null ? `${p.codigo} - ` : ""}{p.nome}</span><span className="text-[11.5px] text-suave">est. {p.saldo.toLocaleString("pt-BR")}</span></button></li>
              ))}
              {termo.trim() && <li><button onMouseDown={(e) => e.preventDefault()} onClick={() => adicionar({ produto_id: null, nome: termo.trim(), qtd: 1 })} className="w-full px-3 py-1.5 text-left text-[13px] font-semibold text-azul hover:bg-fundo">+ Adicionar “{termo.trim()}”</button></li>}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
