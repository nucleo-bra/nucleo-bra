// Gera calendários .ics (RFC 5545) com a agenda do CRM.
// Usado pela função agenda-ics (assinatura no iPhone) e pelo botão
// "Adicionar ao Calendário" de cada compromisso. Sem dependências.

export type EventoIcs = {
  id: string; tipo: string; titulo: string; notas?: string | null; quando: string; dia_todo: boolean;
  duracao_min?: number | null; concluida: boolean; contato?: string | null; parceiro?: string | null; negocio?: string | null;
  atualizado?: string | null;
};

const TIPOS: Record<string, string> = {
  reuniao: "Reunião", visita: "Visita", ligacao: "Ligação", apresentacao: "Apresentação", orcamento: "Orçamento",
  contrato: "Contrato", obra: "Obra", outro: "Compromisso", followup: "Follow-up", tarefa: "Tarefa", whatsapp: "WhatsApp", email: "E-mail", nota: "Nota",
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const diaSP = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
const diaSeguinte = (yyyymmdd: string) => {
  const d = new Date(Date.UTC(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};

/** Dobra linhas em 75 octetos (UTF-8), como pede a RFC 5545. */
function dobrar(linha: string) {
  const enc = new TextEncoder();
  if (enc.encode(linha).length <= 75) return linha;
  const partes: string[] = [];
  let atual = "", tam = 0, limite = 75;
  for (const ch of linha) {
    const n = enc.encode(ch).length;
    if (tam + n > limite) { partes.push(atual); atual = ""; tam = 0; limite = 74; }
    atual += ch; tam += n;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

export function gerarIcs(eventos: EventoIcs[], opcoes: { nome?: string; url?: string; agora?: Date } = {}) {
  const agora = opcoes.agora ?? new Date();
  const L: string[] = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BRA Ambientes//Nucleo CRM//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opcoes.nome ?? "BRA CRM")}`, "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M",
  ];
  for (const e of eventos) {
    const ini = new Date(e.quando);
    if (isNaN(ini.getTime())) continue;
    const tipo = TIPOS[e.tipo] ?? "Compromisso";
    const prefixo = e.concluida ? "✓ " : e.tipo === "followup" ? "↻ " : e.tipo === "tarefa" ? "☐ " : "";
    const titulo = prefixo + (e.tipo === "followup" && e.contato ? `${e.contato} · ${e.titulo}` : e.titulo);
    const desc = [
      `${tipo}${e.concluida ? " (concluído)" : ""}`,
      e.parceiro ? `Parceiro: ${e.parceiro}` : "", e.negocio ? `Negócio: ${e.negocio}` : "",
      e.notas ? `\n${e.notas}` : "", opcoes.url ? `\nAbrir no Núcleo: ${opcoes.url}` : "",
    ].filter(Boolean).join("\n");
    L.push("BEGIN:VEVENT", `UID:${e.id}@nucleo-bra`, `DTSTAMP:${utc(agora)}`);
    if (e.atualizado) L.push(`LAST-MODIFIED:${utc(new Date(e.atualizado))}`);
    if (e.dia_todo) {
      const d = diaSP(ini);
      L.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${diaSeguinte(d)}`, "TRANSP:TRANSPARENT");
    } else {
      const fim = new Date(ini.getTime() + (e.duracao_min && e.duracao_min > 0 ? e.duracao_min : 60) * 60_000);
      L.push(`DTSTART:${utc(ini)}`, `DTEND:${utc(fim)}`, "TRANSP:OPAQUE");
    }
    L.push(`SUMMARY:${esc(titulo)}`, `DESCRIPTION:${esc(desc)}`, `CATEGORIES:${esc(tipo)}`, "STATUS:CONFIRMED");
    if (opcoes.url) L.push(`URL:${opcoes.url}`);
    if (!e.dia_todo && !e.concluida && ini.getTime() > agora.getTime()) {
      L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(titulo)}`, "TRIGGER:-PT30M", "END:VALARM");
    }
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(dobrar).join("\r\n") + "\r\n";
}
