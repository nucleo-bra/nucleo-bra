-- =====================================================================
-- NÚCLEO BRA — CRM (parceiros, prospecção, negócios, agenda, follow-up, to-do)
-- Reaproveita as tabelas parceiros, oportunidades e atividades da fundação.
-- =====================================================================

-- tipos de atividade do CRM (agenda, follow-up e to-do usam a mesma tabela)
alter type tipo_atividade add value if not exists 'followup';
alter type tipo_atividade add value if not exists 'apresentacao';
alter type tipo_atividade add value if not exists 'orcamento';
alter type tipo_atividade add value if not exists 'contrato';
alter type tipo_atividade add value if not exists 'obra';
alter type tipo_atividade add value if not exists 'outro';
alter type tipo_parceiro add value if not exists 'construtor';

-- parceiros: etapa da prospecção
alter table parceiros add column if not exists etapa text not null default 'ativo'
  check (etapa in ('prospeccao','contato','reuniao','ativo','inativo'));

-- negócios: cliente livre, comissões, previsão e anotações
alter table oportunidades add column if not exists cliente_nome text;
alter table oportunidades add column if not exists data_ref date not null default current_date;   -- previsão ou fechamento
alter table oportunidades add column if not exists pct_parceiro numeric(6,3) not null default 0 check (pct_parceiro between 0 and 100);
alter table oportunidades add column if not exists pct_vendedor numeric(6,3) not null default 0 check (pct_vendedor between 0 and 100);
alter table oportunidades add column if not exists comissao_parceiro_paga boolean not null default false;
alter table oportunidades add column if not exists observacoes text;
alter table oportunidades add column if not exists proposta_id uuid references propostas(id) on delete set null;
alter table oportunidades add column if not exists financeiro_lancado_em timestamptz;   -- parcelas geradas no Financeiro
create index if not exists oportunidades_data_ref on oportunidades (data_ref);

-- atividades: dia inteiro, contato livre (follow-up) e quem concluiu
alter table atividades add column if not exists dia_todo boolean not null default false;
alter table atividades add column if not exists contato text;
alter table atividades add column if not exists concluida_em timestamptz;
create index if not exists atividades_quando on atividades (quando);

-- tarefas e follow-ups podem ser apagados por qualquer usuário ativo (o resto continua só diretoria)
drop policy if exists atividades_excluir on atividades;
create policy atividades_excluir on atividades for delete to authenticated using (usuario_ativo());

-- funil por etapa (para a home)
create or replace view funil_comercial with (security_invoker = true) as
select etapa, count(*) as quantidade, coalesce(sum(valor_estimado),0) as valor
from oportunidades group by etapa;
