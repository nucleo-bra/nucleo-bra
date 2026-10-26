\set ON_ERROR_STOP on
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- usuários: Matheus (1º = diretoria ativa) e Fernando (entra inativo)
insert into auth.users (id,email,raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','matheus@braambientes.com.br','{"nome":"Matheus Esturrari"}'),
 ('22222222-2222-2222-2222-222222222222','fernando@grupobrtelecom.com.br','{"nome":"Fernando"}');
select nome, papel, ativo from perfis order by created_at, nome;

-- Fernando inativo não enxerga nada
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'fernando inativo vê clientes:' as t, count(*) from clientes;
reset role;

-- Matheus libera o Fernando
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
update perfis set ativo = true where email like 'fernando%';
reset role; select nome, papel, ativo from perfis order by nome;

-- Fernando importa a NF 1832 (dados como o leitor extrai)
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into importacoes (id,tipo,arquivo_nome,arquivo_sha256,dados) values
 ('aaaaaaaa-0000-0000-0000-000000000001','nfse_xml','1832.xml','abc','{}');
select confirmar_nota('aaaaaaaa-0000-0000-0000-000000000001', '{
 "numero":"1832","serie":"NFSE","codigo_verificacao":"6SWTL7CEP","rps_numero":"464",
 "prestador_cnpj":"07787973000161","emitida_em":"2026-10-26T16:18:31-03:00","competencia":"2026-10-26",
 "valor_servicos":"4409.20","base_calculo":"4409.20","aliquota_iss":"5.00","valor_iss":"220.46",
 "iss_retido":false,"valor_liquido":"4409.20","codigo_servico":"14.01","ordem_compra":"2288860",
 "parcelas":[{"vencimento":"2026-12-10","valor":"4409.20"}],
 "tomador":{"nome":"PLAENGE EMPREENDIMENTOS LTDA","documento":"78638061008908","cidade":"Campinas","uf":"SP"}}') is not null as nf_ok;
select nome, tipo, documento, documento_raiz from clientes;
select descricao, valor, vencimento, status from titulos;

-- reimportar a mesma NF deve ser bloqueado
insert into importacoes (id,tipo,arquivo_nome,arquivo_sha256,dados) values
 ('aaaaaaaa-0000-0000-0000-000000000002','nfse_xml','1832.xml','abc','{}');
do $$ begin
  perform confirmar_nota('aaaaaaaa-0000-0000-0000-000000000002','{"numero":"1832","prestador_cnpj":"07787973000161"}');
  raise exception 'FALHA: duplicidade não foi bloqueada';
exception when others then raise notice 'OK duplicidade bloqueada: %', sqlerrm; end $$;

-- boleto com valor errado é recusado; com valor certo, vincula
insert into importacoes (id,tipo,arquivo_nome,arquivo_sha256,dados) values
 ('aaaaaaaa-0000-0000-0000-000000000003','boleto_pdf','boleto.pdf','def','{}');
do $$ begin
  perform confirmar_boleto('aaaaaaaa-0000-0000-0000-000000000003','{"numero_documento":"1832","valor":"4409.00","vencimento":"2026-12-10"}');
  raise exception 'FALHA: valor divergente aceito';
exception when others then raise notice 'OK divergência barrada: %', sqlerrm; end $$;
select confirmar_boleto('aaaaaaaa-0000-0000-0000-000000000003','{"numero_documento":"1832","valor":"4409.20","vencimento":"2026-12-10",
 "linha_digitavel":"34191.09008 00031.861610 93668.650000 8 16560000440920","nosso_numero":"109/00000318-6","banco_codigo":"341"}') is not null as boleto_ok;

-- proposta: total que não bate com os itens é recusado
insert into importacoes (id,tipo,arquivo_nome,arquivo_sha256,dados) values
 ('aaaaaaaa-0000-0000-0000-000000000004','proposta_zenith','p.pdf','ghi','{}');
do $$ begin
  perform confirmar_proposta('aaaaaaaa-0000-0000-0000-000000000004','{"numero":"39","versao":"V4","cliente_nome":"Eduardo Attie",
   "data_emissao":"2026-10-21","total_itens":"99.00","total_final":"99.00","itens":[
   {"sistema":"Automação","descricao":"Core 1","quantidade":1,"valor_unitario":"19890.00","valor_total":"19890.00"}]}');
  raise exception 'FALHA: soma divergente aceita';
exception when others then raise notice 'OK soma divergente barrada: %', sqlerrm; end $$;
-- item com qtd × unitário errado é recusado
do $$ begin
  perform confirmar_proposta('aaaaaaaa-0000-0000-0000-000000000004','{"numero":"39","versao":"V4","cliente_nome":"Eduardo Attie",
   "data_emissao":"2026-10-21","total_itens":"13000.00","total_final":"13000.00","itens":[
   {"sistema":"Automação","descricao":"R-12","quantidade":5,"valor_unitario":"2705.04","valor_total":"13000.00"}]}');
  raise exception 'FALHA: item incoerente aceito';
exception when others then raise notice 'OK item incoerente barrado: %', sqlerrm; end $$;
-- proposta correta (com desconto) é gravada
select confirmar_proposta('aaaaaaaa-0000-0000-0000-000000000004','{"numero":"39","versao":"V5","cliente_nome":"Eduardo Attie",
 "projeto_nome":"Quinta da Baronesa","titulo":"Eduardo Attie | Quinta da Baronesa - V5","data_emissao":"2026-10-21",
 "total_itens":"33415.20","total_final":"32000.00","itens":[
 {"sistema":"Automação","descricao":"Control4 Controladora Core 1","sku":"C4-21309","quantidade":1,"valor_unitario":"19890.00","valor_total":"19890.00"},
 {"sistema":"Automação","descricao":"Home Manager Módulo R-12","quantidade":5,"valor_unitario":"2705.04","valor_total":"13525.20"}]}') is not null as proposta_ok;
select numero, versao, total_itens, total_final, desconto, status from propostas;
select * from vendas_por_sistema;
select * from painel_financeiro;
reset role;
select tabela, acao, count(*) from auditoria group by 1,2 order by 1,2;
-- Fernando não pode apagar (só diretoria)
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
delete from clientes; select 'clientes após delete do Fernando:' t, count(*) from clientes;
