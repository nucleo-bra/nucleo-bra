"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, ExternalLink, FileUp, PlugZap, Star, XCircle } from "lucide-react";
import { Botao, campo, Chip, Janela, Rotulo } from "@/components/crm/ui";
import {
  baixarBlob, camposDoModelo, ConfigContratos, definirPadrao, docusign, enviarModelo, gravarConfig, linkArquivo, listarModelos, Modelo,
  MODELO_PADRAO, RespostaDocusign,
} from "@/lib/contratos";
import { mensagemErro } from "@/lib/supabase";

const OBRIGATORIOS = ["numero", "cliente_nome"];

export function StatusDocusign({ compacto = false }: { compacto?: boolean }) {
  const [r, setR] = useState<RespostaDocusign | null>(null);
  const [erro, setErro] = useState("");
  const [teste, setTeste] = useState("");
  useEffect(() => { docusign("config").then(setR).catch((e) => setErro(mensagemErro(e))); }, []);
  async function testar() {
    setTeste("Testando…");
    try { const t = await docusign("testar"); setTeste(`Conectado à conta ${t.conta}.`); }
    catch (e) {
      const c = (e as { consentimento?: string }).consentimento;
      setTeste(mensagemErro(e) + (c ? " Clique em “Autorizar no DocuSign”." : ""));
      if (c) setR((v) => (v ? { ...v, consentimento: c } : v));
    }
  }
  if (erro) return <p className="rounded-xl bg-atencao-claro px-3 py-2 text-[13px] text-atencao"><b>DocuSign ainda não ligado:</b> {erro}</p>;
  if (!r) return <p className="text-[13px] text-suave">Verificando o DocuSign…</p>;
  if (!r.configurado) return <p className="rounded-xl bg-atencao-claro px-3 py-2 text-[13px] text-atencao"><b>DocuSign ainda não ligado:</b> faltam as chaves do app no Supabase.</p>;
  return (
    <div className={`rounded-xl border border-linha p-3 text-[13px] ${compacto ? "" : "bg-fundo"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-4 text-ok" /><b>DocuSign configurado</b>
        <Chip cor={r.ambiente === "teste" ? "bg-atencao-claro text-atencao" : "bg-ok-claro text-ok"}>{r.ambiente === "teste" ? "ambiente de teste" : "produção"}</Chip>
        {!r.webhook && <Chip cor="bg-atencao-claro text-atencao">sem aviso automático</Chip>}
      </div>
      {!compacto && <div className="mt-2 flex flex-wrap gap-2">
        <Botao onClick={testar}><PlugZap className="size-4" />Testar conexão</Botao>
        {r.consentimento && <a href={r.consentimento} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3.5 py-2 text-[13.5px] font-semibold hover:shadow-md"><ExternalLink className="size-4" />Autorizar no DocuSign</a>}
      </div>}
      {teste && <p className="mt-2 text-[12.5px] text-suave">{teste}</p>}
    </div>
  );
}

export function ConfigContratosJanela({ inicial, onFechar, onSalvo }: { inicial: ConfigContratos; onFechar: () => void; onSalvo: (c: ConfigContratos) => void }) {
  const [c, setC] = useState<ConfigContratos>(inicial);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false), [aviso, setAviso] = useState("");
  const arq = useRef<HTMLInputElement>(null);
  const recarregar = () => listarModelos().then(setModelos).catch((e) => setErro(mensagemErro(e)));
  useEffect(() => { recarregar(); }, []);

  const rep = (k: keyof ConfigContratos["representante"]) => (ev: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, representante: { ...c.representante, [k]: ev.target.value } });
  const bra = (k: keyof ConfigContratos["assinante_bra"]) => (ev: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, assinante_bra: { ...c.assinante_bra, [k]: ev.target.value } });

  async function salvar() {
    setErro(""); setOcupado(true);
    try { await gravarConfig(c); onSalvo(c); onFechar(); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(false); }
  }
  async function subirModelo(f: File) {
    setErro(""); setAviso("");
    try {
      if (!f.name.toLowerCase().endsWith(".docx")) throw new Error("O modelo precisa ser um arquivo Word (.docx).");
      const campos = camposDoModelo(await f.arrayBuffer());
      const faltam = OBRIGATORIOS.filter((k) => !campos.includes(k));
      await enviarModelo(f, f.name.replace(/\.docx$/i, ""), modelos.length === 0);
      setAviso(`Modelo enviado. Campos encontrados: ${campos.length ? campos.map((k) => "{" + k + "}").join(" ") : "nenhum"}.` + (faltam.length ? ` Atenção: não achei ${faltam.map((k) => "{" + k + "}").join(", ")}.` : ""));
      recarregar();
    } catch (e) { setErro(mensagemErro(e)); }
  }
  const padrao = modelos.find((m) => m.padrao);

  return (
    <Janela titulo="Configurações de contratos" aberto onFechar={onFechar} largura="max-w-3xl"
      rodape={<>
        <Botao tipo="pri" disabled={ocupado} onClick={salvar}>{ocupado ? "Salvando…" : "Salvar"}</Botao>
        <Botao onClick={onFechar}>Cancelar</Botao>
        {erro && <p role="alert" className="w-full rounded-lg bg-erro-claro px-3 py-2 text-[13px] text-erro">{erro}</p>}
      </>}>
      <h3 className="mb-2 text-[12px] font-bold tracking-wide text-suave uppercase">Assinatura eletrônica</h3>
      <StatusDocusign />

      <h3 className="mt-5 mb-2 text-[12px] font-bold tracking-wide text-suave uppercase">Quem assina pela BRA (recebe o DocuSign)</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Rotulo rotulo="Nome"><input className={campo} value={c.assinante_bra.nome} onChange={bra("nome")} /></Rotulo>
        <Rotulo rotulo="E-mail"><input className={campo} type="email" value={c.assinante_bra.email} onChange={bra("email")} /></Rotulo>
        <Rotulo rotulo="CPF (sai no contrato)"><input className={campo} value={c.assinante_bra.cpf} onChange={bra("cpf")} /></Rotulo>
      </div>

      <h3 className="mt-5 mb-2 text-[12px] font-bold tracking-wide text-suave uppercase">Representante legal da Fornecedora</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Rotulo rotulo="Nome" className="col-span-2"><input className={campo} value={c.representante.nome} onChange={rep("nome")} /></Rotulo>
        <Rotulo rotulo="CPF"><input className={campo} value={c.representante.cpf} onChange={rep("cpf")} /></Rotulo>
        <Rotulo rotulo="RG"><input className={campo} value={c.representante.rg} onChange={rep("rg")} /></Rotulo>
        <Rotulo rotulo="Endereço residencial" className="col-span-2 sm:col-span-4"><input className={campo} value={c.representante.endereco} onChange={rep("endereco")} placeholder="Rua, nº, complemento, bairro, cidade - UF, CEP" /></Rotulo>
        <label className="col-span-2 flex items-center gap-2 text-[13.5px] sm:col-span-2">
          <input type="checkbox" checked={c.representante_assina} onChange={(ev) => setC({ ...c, representante_assina: ev.target.checked })} className="size-4 accent-azul" />
          O representante também assina pelo DocuSign
        </label>
        {c.representante_assina && <Rotulo rotulo="E-mail do representante" className="col-span-2"><input className={campo} type="email" value={c.representante.email ?? ""} onChange={rep("email")} /></Rotulo>}
      </div>

      <h3 className="mt-5 mb-2 text-[12px] font-bold tracking-wide text-suave uppercase">Padrões do contrato</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Rotulo rotulo="Cidade (local e data)"><input className={campo} value={c.cidade} onChange={(ev) => setC({ ...c, cidade: ev.target.value })} /></Rotulo>
        <Rotulo rotulo="Forma de recebimento padrão" className="col-span-1 sm:col-span-3"><input className={campo} value={c.forma_recebimento} onChange={(ev) => setC({ ...c, forma_recebimento: ev.target.value })} placeholder="Banco – titular · chave pix" /></Rotulo>
      </div>

      <h3 className="mt-5 mb-2 text-[12px] font-bold tracking-wide text-suave uppercase">Modelo Word</h3>
      <div className="space-y-2 text-[13.5px]">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-linha px-3 py-2">
          <span className="flex-1"><b>Modelo padrão BRA</b> <span className="text-suave">(recriado do contrato Jangadinha)</span></span>
          {!padrao && <Chip cor="bg-ok-claro text-ok">em uso</Chip>}
          <a href={MODELO_PADRAO} download="Modelo_Contrato_BRA.docx" className="inline-flex items-center gap-1 font-semibold text-azul hover:underline"><Download className="size-4" />Baixar</a>
          {padrao && <Botao tipo="leve" onClick={() => definirPadrao(null).then(recarregar)}>Usar este</Botao>}
        </div>
        {modelos.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-linha px-3 py-2">
            <span className="flex-1"><b>{m.nome}</b> <span className="text-suave">· enviado em {new Date(m.created_at).toLocaleDateString("pt-BR")}</span></span>
            {m.padrao ? <Chip cor="bg-ok-claro text-ok"><Star className="size-3" />em uso</Chip> : <Botao tipo="leve" onClick={() => definirPadrao(m.id).then(recarregar).catch((e) => setErro(mensagemErro(e)))}>Usar este</Botao>}
            <button className="inline-flex items-center gap-1 font-semibold text-azul hover:underline" onClick={async () => {
              const u = await linkArquivo(m.arquivo_path); const r = await fetch(u); baixarBlob(await r.blob(), m.nome + ".docx");
            }}><Download className="size-4" />Baixar</button>
          </div>
        ))}
        <input ref={arq} type="file" accept=".docx" hidden onChange={(ev) => { const f = ev.target.files?.[0]; if (f) subirModelo(f); ev.target.value = ""; }} />
        <Botao onClick={() => arq.current?.click()}><FileUp className="size-4" />Enviar meu modelo (.docx)</Botao>
        {aviso && <p className="rounded-lg bg-ok-claro px-3 py-2 text-[12.5px] text-ok">{aviso}</p>}
        <details className="rounded-xl bg-fundo px-3 py-2 text-[12.5px] text-suave">
          <summary className="cursor-pointer font-semibold text-tinta">Como montar o seu modelo no Word</summary>
          <p className="mt-2">Baixe o modelo padrão, ajuste o texto à vontade e mantenha os campos entre chaves — o Núcleo troca pelos dados do contrato:</p>
          <p className="mt-1 font-mono text-[11.5px] leading-5">{"{numero} {unidade} {cliente_nome} {cliente_documento} {cliente_endereco} {cliente_email} {valor_total} {forma_recebimento} {cidade} {data} {rep_nome} {rep_cpf} {rep_rg} {rep_endereco} {bra_nome} {bra_cpf}"}</p>
          <p className="mt-1">Tabela de pagamento: uma linha com <span className="font-mono">{"{#condicoes}{condicao}"}</span> | <span className="font-mono">{"{valor}"}</span> | <span className="font-mono">{"{vencimento}{/condicoes}"}</span>.</p>
          <p className="mt-1">Onde cada um assina, deixe o texto <span className="font-mono">/ass_cliente/</span>, <span className="font-mono">/ass_bra/</span> e (opcional) <span className="font-mono">/ass_rep/</span> em fonte branca — é ali que o DocuSign coloca o campo de assinatura.</p>
        </details>
      </div>
      {!c.assinante_bra.email && <p className="mt-4 flex items-center gap-2 rounded-lg bg-atencao-claro px-3 py-2 text-[12.5px] text-atencao"><XCircle className="size-4" />Preencha o e-mail de quem assina pela BRA para poder enviar contratos.</p>}
    </Janela>
  );
}
