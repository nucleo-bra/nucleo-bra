"use client";
// Campo "Cliente" que procura no cadastro. Ao escolher um cliente (na lista
// ou digitando o nome exato), chama onEscolher com a ficha completa para o
// formulário preencher e-mail, telefone, endereço, CPF/CNPJ etc.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { UserCheck } from "lucide-react";
import { acharPorNome, carregarClientesFicha, sugerirClientes, type ClienteFicha } from "@/lib/cliente-busca";

const doc = (d: string) => { const x = d.replace(/\D/g, ""); return x.length === 11 ? `${x.slice(0, 3)}.${x.slice(3, 6)}.${x.slice(6, 9)}-${x.slice(9)}` : x.length === 14 ? `${x.slice(0, 2)}.${x.slice(2, 5)}.${x.slice(5, 8)}/${x.slice(8, 12)}-${x.slice(12)}` : d; };

export function CampoCliente({ valor, onChange, onEscolher, className = "", placeholder = "Nome do cliente", autoFocus, vinculado, aria = "Cliente" }: {
  valor: string; onChange: (nome: string) => void; onEscolher: (c: ClienteFicha) => void;
  className?: string; placeholder?: string; autoFocus?: boolean; aria?: string;
  /** mostra o selo "do cadastro" quando o registro já está ligado a um cliente */
  vinculado?: boolean;
}) {
  const [L, setL] = useState<ClienteFicha[]>([]);
  const [aberto, setAberto] = useState(false), [ativo, setAtivo] = useState(0);
  const escolhido = useRef<string>(""), digitou = useRef(false);
  const id = useId();
  useEffect(() => { carregarClientesFicha().then(setL).catch(() => setL([])); }, []);
  const sug = useMemo(() => (aberto ? sugerirClientes(L, valor) : []), [L, valor, aberto]);
  const exato = useMemo(() => acharPorNome(L, valor), [L, valor]);

  const escolher = (c: ClienteFicha) => { escolhido.current = c.id; onChange(c.nome); onEscolher(c); setAberto(false); };
  return (
    <div className="relative">
      <input value={valor} autoFocus={autoFocus} aria-label={aria} placeholder={placeholder} autoComplete="off"
        role="combobox" aria-expanded={aberto && sug.length > 0} aria-controls={id}
        onChange={(e) => { onChange(e.target.value); setAberto(true); setAtivo(0); escolhido.current = ""; digitou.current = true; }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => {
          setAberto(false);
          // digitou o nome exato de um cliente cadastrado: puxa a ficha também
          if (digitou.current && exato && escolhido.current !== exato.id) escolher(exato);
          digitou.current = false;
        }, 150)}
        onKeyDown={(e) => {
          if (!sug.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(a + 1, sug.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && aberto) { e.preventDefault(); escolher(sug[ativo]); }
          else if (e.key === "Escape") setAberto(false);
        }}
        className={`${className} ${vinculado || exato ? "pr-8" : ""}`} />
      {(vinculado || exato) && <UserCheck className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ok" aria-label="Cliente do cadastro" />}
      {aberto && sug.length > 0 && !(sug.length === 1 && exato?.id === sug[0].id && escolhido.current === exato.id) && (
        <ul id={id} role="listbox" className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-linha bg-white py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,.25)]">
          {sug.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === ativo}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); escolher(c); }} onMouseEnter={() => setAtivo(i)}
                className={`block w-full px-3 py-2 text-left ${i === ativo ? "bg-[#eef5ff]" : ""}`}>
                <span className="block text-[13.5px] font-semibold text-tinta">{c.nome}{c.nome_fantasia && c.nome_fantasia !== c.nome ? <span className="font-normal text-suave"> · {c.nome_fantasia}</span> : null}</span>
                <span className="block truncate text-[11.5px] text-suave">{[c.documento && doc(c.documento), c.email, [c.cidade, c.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "sem dados no cadastro"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
