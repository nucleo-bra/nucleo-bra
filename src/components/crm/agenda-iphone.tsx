"use client";
import { useEffect, useState } from "react";
import { CalendarCheck2, Check, Copy, RefreshCcw, Smartphone, Unplug } from "lucide-react";
import { gerarLinkAgenda, linkAgendaAtual, revogarLinkAgenda, urlAgenda } from "@/lib/crm";
import { mensagemErro } from "@/lib/supabase";
import { Botao, Cartao, dataBr, Titulo } from "./ui";

// Liga a agenda do CRM ao Calendário do iPhone / Mac / iCloud por assinatura
export function AgendaIphone() {
  const [link, setLink] = useState<{ token: string; ultimo_uso: string | null } | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { linkAgendaAtual().then(setLink).catch((e) => { setErro(mensagemErro(e)); setLink(null); }); }, []);
  const rodar = async (f: () => Promise<void>) => { setErro(""); setOcupado(true); try { await f(); } catch (e) { setErro(mensagemErro(e)); } setOcupado(false); };
  const url = link ? urlAgenda(link.token) : "";
  return (
    <Cartao>
      <Titulo extra={link ? <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-claro px-2.5 py-0.5 text-[12px] font-bold text-ok"><CalendarCheck2 className="size-3.5" />Conectado</span> : null}>Agenda no iPhone</Titulo>
      <div className="px-5 pb-5 text-[13.5px]">
        {link === undefined ? <p className="text-suave">Carregando…</p> : !link ? (
          <>
            <p className="mb-3 text-suave">Mostre os compromissos, follow-ups e tarefas do CRM no app Calendário do iPhone, do Mac e do iCloud, num calendário separado chamado <b className="text-tinta">BRA CRM</b>. Atualiza sozinho.</p>
            <Botao tipo="pri" disabled={ocupado} onClick={() => rodar(async () => setLink({ token: await gerarLinkAgenda(), ultimo_uso: null }))}><Smartphone className="size-4" />Conectar ao iPhone</Botao>
          </>
        ) : (
          <>
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-tinta/90">
              <li><b>No iPhone ou no Mac:</b> toque em <b>Abrir no Calendário</b> abaixo e confirme <b>Assinar</b>.</li>
              <li>Escolha a conta <b>iCloud</b> para ele aparecer em todos os aparelhos.</li>
              <li>Em <b>Atualização automática</b>, escolha <b>A cada 15 minutos</b>.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <a href={url} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-azul to-marinho-900 px-3.5 py-2 text-[13.5px] font-semibold text-white"><CalendarCheck2 className="size-4" />Abrir no Calendário</a>
              <Botao onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); }).catch(() => setErro("Não consegui copiar. Toque e segure o link abaixo.")); }}>{copiado ? <Check className="size-4" /> : <Copy className="size-4" />}{copiado ? "Copiado" : "Copiar link"}</Botao>
            </div>
            <p className="mt-3 text-[12px] break-all text-suave select-all">{url}</p>
            <p className="mt-2 text-[12px] text-suave">Sem o app? Ajustes › Calendário › Contas › Adicionar Conta › Outra › Adicionar Calendário Assinado, e cole o link. {link.ultimo_uso ? `Última atualização pelo calendário: ${dataBr(link.ultimo_uso)}.` : "Ainda não foi lido por nenhum calendário."}</p>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-linha pt-3">
              <Botao disabled={ocupado} onClick={() => rodar(async () => setLink({ token: await gerarLinkAgenda(), ultimo_uso: null }))}><RefreshCcw className="size-4" />Trocar link</Botao>
              <Botao tipo="perigo" disabled={ocupado} onClick={() => rodar(async () => { await revogarLinkAgenda(); setLink(null); })}><Unplug className="size-4" />Desconectar</Botao>
            </div>
            <p className="mt-2 text-[12px] text-suave">O link é pessoal: quem tiver ele vê a agenda. Se vazar, use <b>Trocar link</b>; o antigo para de funcionar na hora.</p>
          </>
        )}
        {erro && <p role="alert" className="mt-3 rounded-lg bg-erro-claro px-3 py-2 text-erro">{erro}</p>}
      </div>
    </Cartao>
  );
}
