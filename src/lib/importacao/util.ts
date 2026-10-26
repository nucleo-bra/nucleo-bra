// Utilidades de importação. Todo valor monetário é tratado em CENTAVOS
// (inteiros) para não existir erro de arredondamento de ponto flutuante.

export type Centavos = number;

/** "R$ 101.728,72" | "101.728,72" | "4409.20" → 10172872 */
export function moedaParaCentavos(texto: string): Centavos {
  const t = texto.replace(/R\$\s*/g, "").trim();
  if (!/\d/.test(t)) throw new Error(`Valor inválido: "${texto}"`);
  // formato brasileiro (vírgula decimal) ou formato XML (ponto decimal)
  const normal = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  const [int, dec = ""] = normal.split(".");
  return Number(int) * 100 + Number((dec + "00").slice(0, 2));
}

export const centavosParaDecimal = (c: Centavos) => (c / 100).toFixed(2);

export const formatarMoeda = (c: Centavos) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "10/12/2026" → "2026-12-10" */
export function dataBrParaIso(texto: string): string {
  const m = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) throw new Error(`Data inválida: "${texto}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export const soDigitos = (t: string | undefined | null) => (t ?? "").replace(/\D/g, "");

export function formatarDocumento(doc: string) {
  const d = soDigitos(doc);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return doc;
}

/** Valida CPF/CNPJ pelos dígitos verificadores */
export function documentoValido(doc: string): boolean {
  const d = soDigitos(doc);
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    const dv = (n: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const dv = (n: number) => {
      const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
  }
  return false;
}

export async function sha256(buffer: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Alerta = { nivel: "erro" | "atencao" | "info"; mensagem: string };
