-- =====================================================================
-- 0009 · CRM no formato do Zenith + pasta do cliente
--   • etapa "Em fechamento" entre negociação e fechado
--   • número sequencial do negócio (como no Zenith: "104 - Eduardo…")
--   • pasta do negócio: documentos ligados ao negócio (orçamentos, contrato…)
--   • condições de pagamento combinadas, guardadas no cartão
--   • data de nascimento do cliente (sai no contrato)
-- Pode ser executada mais de uma vez.
-- =====================================================================

alter type etapa_oport add value if not exists 'fechamento' before 'ganho';

-- número do negócio
alter table oportunidades add column if not exists numero integer;
do $$ begin
  if exists (select 1 from oportunidades where numero is null) then
    with o as (select id, row_number() over (order by created_at, id) + coalesce((select max(numero) from oportunidades), 0) as n
               from oportunidades where numero is null)
    update oportunidades set numero = o.n from o where oportunidades.id = o.id;
  end if;
end $$;
create sequence if not exists oportunidades_numero_seq owned by oportunidades.numero;
select setval('oportunidades_numero_seq', greatest(coalesce((select max(numero) from oportunidades), 0), 1),
              (select max(numero) from oportunidades) is not null);
alter table oportunidades alter column numero set default nextval('oportunidades_numero_seq');
create unique index if not exists oportunidades_numero on oportunidades (numero);

-- pagamento combinado e tags no cartão
alter table oportunidades
  add column if not exists pagamento jsonb not null default '{}'::jsonb,
  add column if not exists tags text[] not null default '{}';

-- pasta do negócio
alter table documentos add column if not exists oportunidade_id uuid references oportunidades(id) on delete set null;
create index if not exists documentos_oportunidade on documentos (oportunidade_id);

-- cliente
alter table clientes add column if not exists data_nascimento date;
