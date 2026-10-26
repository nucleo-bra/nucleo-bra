"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Bloco, Shell, Vazio } from "@/components/Shell";
import { ClienteResumo, formatarReais, listarClientes } from "@/lib/dados";
import { formatarDocumento } from "@/lib/importacao/util";
import { mensagemErro } from "@/lib/supabase";

export default function Clientes() {
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<ClienteResumo[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const t = setTimeout(() => listarClientes(busca).then(setLista).catch((e) => setErro(mensagemErro(e))), 250);
    return () => clearTimeout(t);
  }, [busca]);

  return (
    <Shell titulo="Clientes">
      <label className="mb-5 flex max-w-md items-center gap-2 rounded-lg border border-linha bg-white px-3.5 py-2.5 focus-within:border-ciano">
        <Search className="size-4 text-suave" />
        <span className="sr-only">Buscar cliente</span>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou CPF/CNPJ"
          className="w-full bg-transparent text-[14px] outline-none" />
      </label>
      {erro && <p role="alert" className="mb-4 rounded-lg bg-erro-claro px-4 py-3 text-erro">{erro}</p>}
      <Bloco>
        {lista && !lista.length ? (
          <Vazio>{busca ? "Nenhum cliente encontrado." : "Os clientes aparecem aqui ao importar notas e propostas."}</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="border-b border-linha text-left text-[12px] text-suave">
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">CPF/CNPJ</th>
                  <th className="px-5 py-3 font-medium">Cidade</th>
                  <th className="px-5 py-3 text-right font-medium">Projetos</th>
                  <th className="px-5 py-3 text-right font-medium">A receber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {(lista ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-fundo/60">
                    <td className="px-5 py-3.5">
                      <Link href={`/clientes/ficha/?id=${c.id}`} className="font-medium hover:text-br">{c.nome}</Link>
                    </td>
                    <td className="num px-5 py-3.5 text-suave">{c.documento ? formatarDocumento(c.documento) : "—"}</td>
                    <td className="px-5 py-3.5 text-suave">{c.cidade ? `${c.cidade}/${c.uf}` : "—"}</td>
                    <td className="num px-5 py-3.5 text-right">{c.projetos}</td>
                    <td className={`num px-5 py-3.5 text-right ${c.a_receber ? "font-semibold" : "text-suave"}`}>{c.a_receber ? formatarReais(c.a_receber) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>
    </Shell>
  );
}
