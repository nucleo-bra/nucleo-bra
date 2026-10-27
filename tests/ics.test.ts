import { describe, expect, it } from "vitest";
import { gerarIcs } from "@/lib/ics";

const agora = new Date("2026-10-27T15:00:00Z");
describe("agenda .ics", () => {
  const ics = gerarIcs([
    { id: "a1", tipo: "reuniao", titulo: "Reunião, showroom; kaza+", notas: "Levar portfólio\nCinema", quando: "2026-10-28T13:00:00Z", dia_todo: false, concluida: false, parceiro: "Adriano Mendonça", negocio: "Eduardo Attie" },
    { id: "a2", tipo: "followup", titulo: "Retornar V5", quando: "2026-10-31T15:00:00Z", dia_todo: true, concluida: false, contato: "Eduardo" },
    { id: "a3", tipo: "tarefa", titulo: "Enviar proposta", quando: "2026-10-26T15:00:00Z", dia_todo: true, concluida: true },
  ], { agora, url: "https://nucleo-bra.vercel.app/crm/" });
  it("estrutura e linhas CRLF dobradas em 75 octetos", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    for (const l of ics.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
  it("horário em UTC, dia inteiro em data de Brasília, escapes e alarme", () => {
    const d = ics.replace(/\r\n /g, "");
    expect(d).toContain("DTSTART:20261028T130000Z");
    expect(d).toContain("DTEND:20261028T140000Z");
    expect(d).toContain(String.raw`SUMMARY:Reunião\, showroom\; kaza+`);
    expect(d).toContain(String.raw`Levar portfólio\nCinema`);
    expect(d).toContain("DTSTART;VALUE=DATE:20261031");
    expect(d).toContain("DTEND;VALUE=DATE:20261101");
    expect(d).toContain("SUMMARY:↻ Eduardo · Retornar V5");
    expect(d).toContain("SUMMARY:✓ Enviar proposta");
    expect(d.match(/BEGIN:VALARM/g)).toHaveLength(1);
  });
});
