-- =====================================================================
-- 0023 · Catálogos atualizados todo mês e produtos comprados em dólar
--   • catalogos.conferido_em: último dia em que a tabela foi conferida
--     com o fornecedor (o lembrete do início do mês some quando todos
--     estão conferidos no mês). Subir arquivo novo também marca.
--   • catalogos.moeda: moeda dos preços da tabela (BRL ou USD)
--   • cotacoes: cotação do dólar de cada dia, usada para atualizar o
--     custo e o preço de venda dos produtos comprados em dólar.
-- Pode ser executada mais de uma vez.
-- =====================================================================
alter table catalogos add column if not exists conferido_em date;
alter table catalogos add column if not exists moeda text not null default 'BRL';
alter table catalogos add column if not exists precos_lidos_em timestamptz;
do $$ begin
  alter table catalogos add constraint catalogos_moeda check (moeda in ('BRL','USD'));
exception when duplicate_object then null; end $$;

create table if not exists cotacoes (
  moeda       text not null default 'USD' check (moeda in ('USD')),
  data        date not null,
  valor       numeric(12,4) not null check (valor > 0),
  fonte       text,
  criado_por  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (moeda, data)
);
alter table cotacoes enable row level security;
drop policy if exists cotacoes_ler on cotacoes;
drop policy if exists cotacoes_gravar on cotacoes;
drop policy if exists cotacoes_alterar on cotacoes;
create policy cotacoes_ler     on cotacoes for select to authenticated using (usuario_ativo());
create policy cotacoes_gravar  on cotacoes for insert to authenticated with check (usuario_ativo());
create policy cotacoes_alterar on cotacoes for update to authenticated using (usuario_ativo()) with check (usuario_ativo());

-- produtos comprados em dólar (para a atualização diária achar rápido)
create index if not exists produtos_em_dolar on produtos ((formacao->>'moeda')) where formacao->>'moeda' = 'USD';
