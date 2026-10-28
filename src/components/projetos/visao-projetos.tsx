"use client";
// Visão geral de todos os quadros de Projetos: indicadores, fluxo semanal, carga e tabela.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Clock, FolderKanban, LayoutGrid, ListChecks, TrendingUp, Users } from "lucide-react";
import { carregarPainelTecnico, FUNDOS, Membro, PainelTecnico } from "@/lib/projetos";
import { Avatar, dataCurta, situacaoPrazo } from "./pecas";
import { Barras, CAT, Caixa, Dica, Kpi, Legenda } from "./painel-quadro";

const DIA = 86_400_000;
const inicioSemana = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

export function VisaoProjetos() {
  const router = useRouter();
  const [p, setP] = useState<PainelTecnico | null>(null);
  useEffect(() => { carregarPainelTecnico().then(setP).catch(() => {}); }, []);

  const k = useMemo(() => {
    if (!p) return null;
    const agora = new Date(), mes = agora.toISOString().slice(0, 7);
    const C = p.cartoes.filter((c) => c.modulo === "projetos");
    const abertos = C.filter((c) => !c.final), feitos = C.filter((c) => c.final);
    const atrasado = (c: (typeof C)[number]) => !c.final && c.prazo && !c.prazo_concluido && new Date(c.prazo) < agora;
    const em7 = new Date(agora.getTime() + 7 * DIA);
    const s0 = inicioSemana(agora);
    const semanas = Array.from({ length: 8 }, (_, i) => {
      const ini = new Date(s0.getTime() - (7 - i) * 7 * DIA), f = new Date(ini.getTime() + 7 * DIA);
      const dentro = (s: string | null) => !!s && new Date(s) >= ini && new Date(s) < f;
      return { semana: i === 7 ? "Esta" : ini.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), Entradas: C.filter((c) => dentro(c.created_at)).length, Concluídos: feitos.filter((c) => dentro(c.concluido_em)).length };
    });
    const quadros = p.quadros.filter((q) => q.modulo === "projetos").map((q) => {
      const L = C.filter((c) => c.quadro_id === q.id), ab = L.filter((c) => !c.final);
      const prox = ab.filter((c) => c.prazo && !c.prazo_concluido).sort((a, b) => a.prazo!.localeCompare(b.prazo!))[0];
      const pessoas = [...new Set(L.flatMap((c) => c.membros))].map((id) => p.equipe.find((m) => m.id === id)).filter(Boolean) as Membro[];
      return { q, total: L.length, abertos: ab.length, feitos: L.length - ab.length, atrasados: L.filter(atrasado).length, prox, pessoas, pct: L.length ? ((L.length - ab.length) / L.length) * 100 : 0 };
    }).sort((a, b) => b.atrasados - a.atrasados || b.abertos - a.abertos);
    const carga = p.equipe.map((m) => ({ m, n: abertos.filter((c) => c.membros.includes(m.id)).length, at: abertos.filter((c) => c.membros.includes(m.id) && atrasado(c)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    return {
      C, abertos, feitos, quadros, semanas, carga,
      atrasados: C.filter(atrasado).length,
      vencem7: abertos.filter((c) => c.prazo && !c.prazo_concluido && new Date(c.prazo) >= agora && new Date(c.prazo) < em7).length,
      feitosMes: feitos.filter((c) => (c.concluido_em ?? "").startsWith(mes)).length,
      pct: C.length ? (feitos.length / C.length) * 100 : 0,
    };
  }, [p]);

  if (!k) return <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[92px] animate-pulse rounded-[18px] bg-white/70" />)}</div>;

  return (
    <div className="mb-7 space-y-4 lg:space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi destaque icone={FolderKanban} rotulo="Quadros ativos" valor={String(k.quadros.length)} detalhe={`${k.C.length} cartões no total`} cor="" />
        <Kpi icone={ListChecks} rotulo="Em aberto" valor={String(k.abertos.length)} cor="#2f6fb5" detalhe="em todos os quadros" />
        <Kpi icone={AlertTriangle} rotulo="Atrasados" valor={String(k.atrasados)} cor="#d63a2f" tom={k.atrasados ? "text-erro" : ""} detalhe="prazo já passou" />
        <Kpi icone={Clock} rotulo="Vencem em 7 dias" valor={String(k.vencem7)} cor="#e8890c" detalhe="atenção à semana" />
        <Kpi icone={CheckCircle2} rotulo="Concluídos no mês" valor={String(k.feitosMes)} cor="#12a150" detalhe="cartões finalizados" />
        <Kpi icone={TrendingUp} rotulo="Andamento geral" valor={`${Math.round(k.pct)}%`} cor="#22c7d6" detalhe={`${k.feitos.length} de ${k.C.length} concluídos`} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 xl:grid-cols-3">
        <Caixa titulo="Entradas x concluídos por semana" icone={TrendingUp} className="xl:col-span-2" extra={<Legenda itens={[["Entradas", CAT[0]], ["Concluídos", CAT[1]]]} />}>
          <div className="h-[230px]">
            <ResponsiveContainer>
              <BarChart data={k.semanas} barGap={2} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f3" />
                <XAxis dataKey="semana" tick={{ fill: "#66738f", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#66738f", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Dica />} cursor={{ fill: "rgba(47,111,181,.06)" }} />
                <Bar dataKey="Entradas" fill={CAT[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Concluídos" fill={CAT[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Caixa>
        <Caixa titulo="Carga por pessoa" icone={Users}>
          <Barras vazio="Ninguém atribuído ainda." itens={k.carga.map((x) => ({
            rotulo: <span className="inline-flex items-center gap-2"><Avatar m={x.m} tam={22} />{x.m.nome.split(" ").slice(0, 2).join(" ")}{x.at ? <span className="rounded-full bg-erro-claro px-1.5 text-[11px] font-bold text-erro">{x.at} atras.</span> : null}</span>,
            valor: x.n, sufixo: " aberto(s)",
          }))} />
        </Caixa>
      </div>
      <Caixa titulo="Quadros" icone={LayoutGrid}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13.5px]">
            <thead><tr className="border-y border-linha bg-[#f7f9fc] text-[12px] text-suave">
              {["Quadro", "Andamento", "Em aberto", "Atrasados", "Próximo prazo", "Equipe"].map((h, i) => <th key={h} className={`py-2.5 pr-4 font-semibold whitespace-nowrap ${i === 0 ? "pl-5" : ""}`}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-linha">
              {k.quadros.map((x) => (
                <tr key={x.q.id} tabIndex={0} onClick={() => router.push(`/tecnico/projetos/?q=${x.q.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/tecnico/projetos/?q=${x.q.id}`)}
                  className="cursor-pointer transition hover:bg-[#f4f8ff] focus:bg-[#f4f8ff] focus:outline-none">
                  <td className="py-2.5 pr-4 pl-5"><span className="flex items-center gap-2.5"><span className="size-7 shrink-0 rounded-lg" style={{ background: FUNDOS[x.q.fundo] ?? FUNDOS.marinho }} /><b className="max-w-[260px] truncate">{x.q.nome}</b></span></td>
                  <td className="py-2.5 pr-4"><span className="flex items-center gap-2"><span className="h-2 w-28 overflow-hidden rounded-full bg-fundo"><span className="block h-full rounded-full bg-gradient-to-r from-ciano to-azul" style={{ width: `${x.pct}%` }} /></span><span className="num text-[12.5px] font-semibold">{Math.round(x.pct)}%</span><span className="text-[12px] text-suave">{x.feitos}/{x.total}</span></span></td>
                  <td className="num py-2.5 pr-4 font-semibold">{x.abertos}</td>
                  <td className="py-2.5 pr-4">{x.atrasados ? <span className="inline-flex items-center gap-1 rounded-full bg-erro-claro px-2 py-0.5 text-[12px] font-bold text-erro"><AlertTriangle className="size-3" />{x.atrasados}</span> : <span className="text-suave">—</span>}</td>
                  <td className="py-2.5 pr-4">{x.prox ? <span className="flex items-center gap-2"><span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${situacaoPrazo(x.prox)?.cls ?? ""}`}>{dataCurta(x.prox.prazo!)}</span><span className="max-w-[180px] truncate text-[12.5px] text-suave">{x.prox.titulo}</span></span> : <span className="text-suave">—</span>}</td>
                  <td className="py-2.5 pr-4">{x.pessoas.length ? <span className="flex -space-x-1.5">{x.pessoas.slice(0, 5).map((m) => <Avatar key={m.id} m={m} tam={24} />)}</span> : <span className="text-suave">—</span>}</td>
                </tr>
              ))}
              {!k.quadros.length && <tr><td colSpan={6} className="py-10 text-center text-suave">Crie o primeiro quadro abaixo.</td></tr>}
            </tbody>
          </table>
        </div>
      </Caixa>
    </div>
  );
}
