-- =====================================================================
-- 0021 · Formação de preço dos produtos e produtos vindos dos catálogos
--   • formacao: tudo o que entra no custo e no preço do produto (compra,
--     impostos, frete, créditos, impostos da venda, comissões, taxas,
--     despesas e margem). custo e preco_venda continuam sendo o resultado,
--     que é o que o orçamento usa.
--   • catalogo_id: de qual catálogo o produto foi puxado
--   • padrões da empresa ficam em config_empresa (chave 'formacao_preco')
-- Pode ser executada mais de uma vez.
-- =====================================================================
alter table produtos add column if not exists formacao jsonb not null default '{}'::jsonb;
alter table produtos add column if not exists catalogo_id uuid references catalogos(id) on delete set null;
create index if not exists produtos_catalogo on produtos (catalogo_id) where catalogo_id is not null;

insert into config_empresa (chave, valor) values ('formacao_preco', '{}'::jsonb)
on conflict (chave) do nothing;
