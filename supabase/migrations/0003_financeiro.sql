-- =====================================================================
-- NÚCLEO BRA — Fase 2: Financeiro
-- Comissionados, regras de comissão por título, fechamentos mensais e
-- campos para receber o histórico do sistema financeiro anterior (v38).
-- Regra herdada do v38: a comissão é calculada sobre cada parcela
-- efetivamente recebida, no mês do recebimento.
-- =====================================================================

-- Clientes: localização para o mapa de regiões atendidas
alter table clientes add column if not exists latitude  numeric(9,6);
alter table clientes add column if not exists longitude numeric(9,6);
alter table clientes add column if not exists legado_chave text unique;  -- nome normalizado no v38

-- Títulos: campos do v38
alter table titulos add column if not exists conta      text;            -- conta/canal de recebimento
alter table titulos add column if not exists parcela    text;            -- "4/10", "Contrato"...
alter table titulos add column if not exists nota_ref   text;            -- referência livre de NF do v38
alter table titulos add column if not exists cobrancas  integer not null default 0;
alter table titulos add column if not exists legado_id  text unique;     -- id do lançamento no v38
alter table titulos drop constraint if exists titulos_forma_check;
alter table titulos add constraint titulos_forma_check
  check (forma is null or forma in ('boleto','pix','transferencia','cartao','dinheiro','outro'));

-- Notas: faturamento lançado à mão no v38 (sem XML)
alter table notas_fiscais alter column cliente_id drop not null;
alter table notas_fiscais add column if not exists categoria text check (categoria in ('material','servico'));
alter table notas_fiscais add column if not exists origem text not null default 'xml' check (origem in ('xml','manual','legado'));
alter table notas_fiscais add column if not exists cliente_texto text;    -- cliente informado à mão
alter table notas_fiscais add column if not exists legado_id text unique;
update notas_fiscais set categoria = case when tipo = 'nfse' then 'servico' else 'material' end where categoria is null;

-- A tabela genérica de comissões dá lugar ao modelo abaixo
drop table if exists comissoes cascade;

create table comissionados (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  papel       text not null default 'Vendedor',   -- Vendedor, Arquiteto, Parceiro...
  parceiro_id uuid references parceiros(id) on delete set null,
  perfil_id   uuid references perfis(id) on delete set null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (nome, papel)
);

-- Quem ganha quanto sobre cada título (percentual sobre o valor recebido)
create table titulo_comissoes (
  titulo_id       uuid not null references titulos(id) on delete cascade,
  comissionado_id uuid not null references comissionados(id) on delete restrict,
  percentual      numeric(7,4) not null check (percentual > 0 and percentual <= 100),
  primary key (titulo_id, comissionado_id)
);

-- Fechamento mensal por comissionado (pago em)
create table comissao_fechamentos (
  comissionado_id uuid not null references comissionados(id) on delete restrict,
  mes             date not null check (mes = date_trunc('month', mes)::date),
  fechado_em      date not null default current_date,
  valor           numeric(14,2),                  -- valor no momento do fechamento
  fechado_por     uuid references perfis(id) default auth.uid(),
  primary key (comissionado_id, mes)
);

do $$
declare t text;
begin
  foreach t in array array['comissionados','titulo_comissoes','comissao_fechamentos'] loop
    execute format('create trigger %I_auditoria after insert or update or delete on %I
                    for each row execute function registrar_auditoria()', t, t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I_ler on %I for select to authenticated using (usuario_ativo())', t, t);
    execute format('create policy %I_inserir on %I for insert to authenticated with check (usuario_ativo())', t, t);
    execute format('create policy %I_alterar on %I for update to authenticated using (usuario_ativo()) with check (usuario_ativo())', t, t);
    execute format('create policy %I_excluir on %I for delete to authenticated using (usuario_ativo())', t, t);
  end loop;
end $$;

-- auditoria de linhas sem coluna "id": a trigger genérica grava registro_id vazio (ok)

-- Comissões apuradas: uma linha por parcela recebida × comissionado
create or replace view comissoes_apuradas with (security_invoker = true) as
select
  t.id                       as titulo_id,
  c.id                       as comissionado_id,
  c.nome                     as comissionado,
  c.papel,
  date_trunc('month', t.pago_em)::date as mes,
  t.pago_em,
  t.descricao,
  coalesce(cl.nome_fantasia, cl.nome) as cliente,
  coalesce(t.valor_pago, t.valor)     as base,
  tc.percentual,
  round(coalesce(t.valor_pago, t.valor) * tc.percentual / 100, 2) as valor,
  f.fechado_em
from titulos t
join titulo_comissoes tc on tc.titulo_id = t.id
join comissionados c on c.id = tc.comissionado_id
left join clientes cl on cl.id = t.cliente_id
left join comissao_fechamentos f on f.comissionado_id = c.id and f.mes = date_trunc('month', t.pago_em)::date
where t.status = 'pago' and t.natureza = 'receber';

-- Comissões previstas (parcelas ainda em aberto)
create or replace view comissoes_previstas with (security_invoker = true) as
select c.nome as comissionado, c.papel, date_trunc('month', t.vencimento)::date as mes,
       round(sum(t.valor * tc.percentual / 100), 2) as valor, count(*) as parcelas
from titulos t
join titulo_comissoes tc on tc.titulo_id = t.id
join comissionados c on c.id = tc.comissionado_id
where t.status = 'aberto' and t.natureza = 'receber'
group by 1,2,3;

-- Baixa de pagamento com trava de coerência
create or replace function baixar_titulo(p_titulo uuid, p_pago_em date, p_valor numeric) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if not usuario_ativo() then raise exception 'Usuário sem permissão'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor recebido'; end if;
  if p_pago_em > current_date then raise exception 'A data de recebimento não pode ser futura'; end if;
  if exists (select 1 from comissao_fechamentos f join titulo_comissoes tc on tc.comissionado_id = f.comissionado_id
             where tc.titulo_id = p_titulo and f.mes = date_trunc('month', p_pago_em)::date) then
    raise exception 'As comissões de % já foram fechadas. Reabra o fechamento antes de lançar recebimentos nesse mês.', to_char(p_pago_em, 'MM/YYYY');
  end if;
  update titulos set status = 'pago', pago_em = p_pago_em, valor_pago = p_valor where id = p_titulo and status = 'aberto';
  if not found then raise exception 'Título não está em aberto'; end if;
end $$;

create or replace function estornar_baixa(p_titulo uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare v_pago date;
begin
  if not usuario_ativo() then raise exception 'Usuário sem permissão'; end if;
  select pago_em into v_pago from titulos where id = p_titulo and status = 'pago';
  if v_pago is null then raise exception 'Título não está pago'; end if;
  if exists (select 1 from comissao_fechamentos f join titulo_comissoes tc on tc.comissionado_id = f.comissionado_id
             where tc.titulo_id = p_titulo and f.mes = date_trunc('month', v_pago)::date) then
    raise exception 'As comissões de % já foram fechadas. Reabra o fechamento antes de estornar.', to_char(v_pago, 'MM/YYYY');
  end if;
  update titulos set status = 'aberto', pago_em = null, valor_pago = null where id = p_titulo;
end $$;

-- Painel: "recebido no mês" passa a considerar o valor efetivamente recebido
create or replace view faturamento_mensal with (security_invoker = true) as
select date_trunc('month', emitida_em)::date as mes, count(*) as notas, sum(valor_servicos) as faturado,
       sum(valor_servicos) filter (where categoria = 'material') as material,
       sum(valor_servicos) filter (where categoria = 'servico')  as servico
from notas_fiscais where status = 'emitida'
group by 1 order by 1;

-- Novo lançamento parcelado com comissões (tudo ou nada)
-- p = {cliente_id?, cliente_nome?, descricao, valor_total, parcelas, primeiro_vencimento,
--      intervalo_dias?, forma, conta?, comissoes:[{comissionado_id, percentual}]}
create or replace function criar_lancamento(p jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_cliente uuid; n int := (p->>'parcelas')::int; total numeric := (p->>'valor_total')::numeric;
  parcela numeric; resto numeric; i int; v_tit uuid; c jsonb; venc date;
begin
  if not usuario_ativo() then raise exception 'Usuário sem permissão'; end if;
  if n is null or n < 1 or n > 120 then raise exception 'Número de parcelas inválido'; end if;
  if total is null or total <= 0 then raise exception 'Informe o valor total'; end if;
  v_cliente := nullif(p->>'cliente_id','')::uuid;
  if v_cliente is null and nullif(trim(p->>'cliente_nome'),'') is not null then
    v_cliente := upsert_cliente(jsonb_build_object('nome', trim(p->>'cliente_nome')));
  end if;
  parcela := round(total / n, 2);
  resto := total - parcela * n;                   -- diferença de centavos vai na última parcela
  for i in 1..n loop
    venc := case when coalesce((p->>'intervalo_dias')::int, 0) > 0
                 then (p->>'primeiro_vencimento')::date + (i - 1) * (p->>'intervalo_dias')::int
                 else ((p->>'primeiro_vencimento')::date + make_interval(months => i - 1))::date end;
    insert into titulos (natureza, descricao, cliente_id, valor, emissao, vencimento, forma, conta, parcela)
    values ('receber', p->>'descricao', v_cliente, parcela + case when i = n then resto else 0 end,
            current_date, venc, nullif(p->>'forma',''), nullif(p->>'conta',''), case when n > 1 then i || '/' || n else null end)
    returning id into v_tit;
    for c in select * from jsonb_array_elements(coalesce(p->'comissoes','[]')) loop
      insert into titulo_comissoes (titulo_id, comissionado_id, percentual)
      values (v_tit, (c->>'comissionado_id')::uuid, (c->>'percentual')::numeric);
    end loop;
  end loop;
  return n;
end $$;

-- Registro de cobrança enviada (WhatsApp)
create or replace function registrar_cobranca(p_titulo uuid) returns void
language sql security invoker set search_path = public as $$
  update titulos set cobrancas = cobrancas + 1, cobrado_em = now() where id = p_titulo;
$$;
