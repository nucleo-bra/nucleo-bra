/** "1 parcela" / "3 parcelas" — sem os "(s)" pelo sistema. */
export const pl = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
/** só a palavra, para quando o número vem destacado à parte */
export const plp = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
/** (19) 99999-9999 / (19) 3333-4444 / 0800 — devolve como veio se não reconhecer */
export function telefone(t: string | null | undefined) {
  const d = String(t ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t ?? "";
}
/** link de WhatsApp a partir do telefone (assume Brasil) */
export const whatsapp = (t: string | null | undefined) => {
  const d = String(t ?? "").replace(/\D/g, "");
  return d.length >= 10 ? `https://wa.me/${d.length <= 11 ? "55" + d : d}` : "";
};
