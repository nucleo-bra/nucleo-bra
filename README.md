# Núcleo BRA

Sistema de gestão da BRA Ambientes Inteligentes (Grupo BRTelecom): clientes, propostas, notas fiscais,
recebimentos e, nas próximas fases, financeiro completo, CRM, contratos, estoque e marketing.

## O que já funciona (Fase 1 — Fundação)

- **Login** com perfis (diretoria, financeiro, comercial, técnico). O primeiro usuário vira diretoria;
  os demais entram bloqueados até a diretoria liberar.
- **Painel**: a cadeia do dinheiro (em proposta → faturado → a receber → recebido), próximos
  recebimentos, vendas por sistema, faturamento mensal e propostas recentes.
- **Clientes**: busca por nome ou CPF/CNPJ e ficha com títulos, notas, propostas e obras.
  Filiais do mesmo CNPJ (ex.: Plaenge) aparecem ligadas.
- **Central de importação**, com conferência antes de gravar:
  - XML de **NFS-e** (Omie / prefeitura de Paulínia) e **NF-e** de produto → cliente, nota e título a receber;
  - PDF de **proposta do Zenith** → cliente, obra, proposta e itens por sistema;
  - PDF de **boleto** → linha digitável validada pelos dígitos verificadores e vinculada ao título da NF.

## Proteções contra erro

| Situação | O que acontece |
|---|---|
| Mesma NF importada duas vezes | Bloqueado |
| Mesmo arquivo enviado de novo | Bloqueado |
| Item com quantidade × unitário diferente do total | Bloqueado no leitor e no banco |
| Soma dos itens diferente do total da proposta | Bloqueado |
| Boleto com valor ou vencimento diferente da NF | Bloqueado |
| Linha digitável com dígito errado | Bloqueado |
| CPF/CNPJ inválido | Bloqueado |
| Qualquer alteração em qualquer tabela | Registrada na auditoria (antes/depois, quem, quando) |
| Exclusão de registros | Só a diretoria |

Valores são guardados como `numeric` no banco e tratados em centavos no código: não existe erro de arredondamento.

## Implantação (uma vez)

### 1. Supabase (banco, login e arquivos)
1. Crie o projeto em supabase.com, região **South America (São Paulo)**.
2. Em **SQL Editor**, rode em ordem o conteúdo de:
   - `supabase/migrations/0001_fundacao.sql`
   - `supabase/migrations/0002_usuarios_storage.sql`
3. Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**
   (só a diretoria cria usuários).
4. Em **Authentication → Users → Add user**, crie primeiro o usuário do Matheus (vira diretoria),
   depois o do Fernando.
5. Em **Project Settings → API**, copie a *Project URL* e a chave *anon public*.

### 2. Vercel (o site)
1. Importe o repositório `nucleo-bra` do GitHub.
2. Em **Environment Variables**, cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Publique. A cada atualização no GitHub o site se atualiza sozinho.

### 3. Domínio
Na Vercel, adicione `nucleo.braambientes.com.br` e crie no DNS o registro CNAME que ela indicar.

### 4. Liberar o Fernando
Depois que ele entrar a primeira vez, a diretoria ativa o perfil dele (tabela `perfis`, campo `ativo`).
A tela de usuários entra na Fase 2.

## Desenvolvimento

```bash
npm install
npm run dev        # sem .env.local abre em modo demonstração
npm test           # leitores testados com os documentos reais (NF 1832, boleto, proposta 39)
npm run build      # gera o site estático em out/
```

Teste do banco (PostgreSQL local): `supabase/tests/stub_supabase.sql` simula o ambiente do Supabase e
`supabase/tests/teste_fluxo.sql` executa o fluxo completo NF → boleto → proposta, incluindo os bloqueios.

## Próximas fases

2. Migração do Financeiro (v38) e do CRM atuais para dentro do Núcleo
3. Orçamentos e estoque
4. Contratos e pasta digital do cliente (OneDrive)
5. Marketing: acervo de vídeos, modo apresentação do showroom e avaliação de campanhas
6. Integração direta com Zenith e Omie (quando o Núcleo estiver completo)
