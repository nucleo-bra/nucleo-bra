-- =====================================================================
-- 0017 · Perfil técnico: além da área técnica, acessa clientes, produtos
--        em estoque e catálogos de fornecedores.
--   • arquivos: técnico abre/envia anexos técnicos, arquivos de clientes e
--     catálogos (orçamentos e arquivos do CRM continuam fora)
--   • documentos do cliente: técnico só vê projeto, foto e outros
--     (contrato, NF, boleto, comprovante e orçamento ficam fora)
-- Negócios, orçamentos, contratos e financeiro continuam bloqueados (0010).
-- Pode ser executada mais de uma vez.
-- =====================================================================

drop policy if exists arquivos_tecnico on storage.objects;
create policy arquivos_tecnico on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'documentos' or not public.usuario_tecnico() or split_part(name, '/', 1) in ('projetos', 'clientes', 'catalogos'))
  with check (bucket_id <> 'documentos' or not public.usuario_tecnico() or split_part(name, '/', 1) in ('projetos', 'clientes'));

drop policy if exists documentos_tecnico on documentos;
create policy documentos_tecnico on documentos as restrictive for all to authenticated
  using (not usuario_tecnico() or tipo in ('projeto', 'foto', 'outro'))
  with check (not usuario_tecnico() or tipo in ('projeto', 'foto', 'outro'));

-- catálogos: técnico consulta, mas não altera
drop policy if exists catalogos_tecnico on catalogos;
drop policy if exists catalogos_tecnico_inserir on catalogos;
drop policy if exists catalogos_tecnico_alterar on catalogos;
drop policy if exists catalogos_tecnico_excluir on catalogos;
create policy catalogos_tecnico_inserir on catalogos as restrictive for insert to authenticated with check (not usuario_tecnico());
create policy catalogos_tecnico_alterar on catalogos as restrictive for update to authenticated using (not usuario_tecnico()) with check (not usuario_tecnico());
create policy catalogos_tecnico_excluir on catalogos as restrictive for delete to authenticated using (not usuario_tecnico());
