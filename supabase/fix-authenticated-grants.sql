-- Correcao de permissoes para uso com Supabase Auth.
-- Rode este arquivo no SQL Editor do Supabase se aparecer:
-- "permission denied for table processos".

do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'app_settings','secretarias','tipos_protocolo','assuntos_protocolo','fornecedores',
    'fornecedor_pessoas','processos','processo_blocos','processo_itens','processo_publicacoes',
    'irps_registro_preco','irp_itens','atas_registro_preco','ata_itens','ata_publicacoes',
    'ata_aditivos','ata_aditivo_publicacoes','tramites_internos','tramites_gerais','anexos'
  ]
  loop
    execute format('revoke all on table public.%I from anon', tabela);
    execute format('revoke all on table public.%I from authenticated', tabela);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', tabela);
  end loop;
end $$;

grant usage on schema public to authenticated;

