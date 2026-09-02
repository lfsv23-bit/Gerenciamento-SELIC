-- Schema inicial para migrar o sistema Processos Licitatorios 3.0 para Supabase.
-- Execute este arquivo no SQL Editor do Supabase.
-- As policies abaixo exigem Supabase Auth.
-- A role anon nao recebe permissao de leitura ou escrita nas tabelas do sistema.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  valor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.secretarias (
  id uuid primary key default gen_random_uuid(),
  sigla text not null unique,
  nome text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tipos_protocolo (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  padrao boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assuntos_protocolo (
  id uuid primary key default gen_random_uuid(),
  tipo_protocolo_id uuid references public.tipos_protocolo(id) on delete set null,
  tipo_nome text not null,
  nome text not null,
  ativo boolean not null default true,
  padrao boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tipo_nome, nome)
);

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  local_id text unique,
  cnpj text unique,
  razao_social text,
  nome_fantasia text,
  origem text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fornecedor_pessoas (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id uuid references public.fornecedores(id) on delete cascade,
  local_id text,
  nome text not null,
  cpf text,
  tipo text,
  situacao text,
  observacao text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processos (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  numero text not null unique,
  data_criacao date,
  objeto text,
  descricao_completa text,
  secretaria text,
  interessado_original text,
  tipo_protocolo text,
  natureza_processo text,
  assunto_protocolo text,
  registro_precos text,
  tipo_registro_preco text,
  tipo_adesao_registro text,
  processo_gerador_local_id text,
  ata_registro_preco_local_id text,
  modalidade_licitacao text,
  tipo_licitacao text,
  situacao text,
  fase text,
  volumes text,
  observacao text,
  valor_estimado numeric(14,2),
  valor_homologado numeric(14,2),
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processo_blocos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  bloco text not null,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (processo_id, bloco)
);

create table if not exists public.processo_itens (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  local_id text,
  origem text not null default 'processo',
  ordem integer,
  codigo text,
  descricao text,
  unidade text,
  quantidade numeric(14,4),
  valor_unitario numeric(14,4),
  valor_total numeric(14,2),
  situacao text,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.processo_publicacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  local_id text,
  bloco text,
  tipo text,
  titulo text,
  data_publicacao date,
  link text,
  anexo_id uuid,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.irps_registro_preco (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  numero text,
  ano text,
  objeto text,
  secretaria text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.irp_itens (
  id uuid primary key default gen_random_uuid(),
  irp_id uuid not null references public.irps_registro_preco(id) on delete cascade,
  ordem integer,
  codigo text,
  descricao text,
  unidade text,
  quantidade numeric(14,4),
  valor_unitario numeric(14,4),
  valor_total numeric(14,2),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.atas_registro_preco (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  local_id text not null unique,
  numero text not null,
  ano text not null,
  unidade_orcamentaria text,
  objeto text,
  objeto_resumido text,
  modalidade text,
  data_assinatura date,
  data_extrato date,
  vigencia_inicio date,
  vigencia_fim date,
  vigencia_atual text,
  link_pncp text,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  nome_pdf_ata text,
  nome_pdf_extrato text,
  pdf_ata_anexo_id uuid,
  pdf_extrato_anexo_id uuid,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (processo_id, numero, ano)
);

create table if not exists public.ata_itens (
  id uuid primary key default gen_random_uuid(),
  ata_id uuid not null references public.atas_registro_preco(id) on delete cascade,
  ordem integer,
  codigo text,
  descricao text,
  unidade text,
  quantidade numeric(14,4),
  valor_unitario numeric(14,4),
  valor_total numeric(14,2),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ata_publicacoes (
  id uuid primary key default gen_random_uuid(),
  ata_id uuid not null references public.atas_registro_preco(id) on delete cascade,
  local_id text,
  tipo text,
  titulo text,
  data_publicacao date,
  link text,
  anexo_id uuid,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ata_aditivos (
  id uuid primary key default gen_random_uuid(),
  ata_id uuid not null references public.atas_registro_preco(id) on delete cascade,
  local_id text,
  numero text,
  objeto_aditivado text,
  altera_vigencia boolean not null default false,
  vigencia text,
  data_assinatura date,
  data_publicacao date,
  anexo_id uuid,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ata_aditivo_publicacoes (
  id uuid primary key default gen_random_uuid(),
  aditivo_id uuid not null references public.ata_aditivos(id) on delete cascade,
  local_id text,
  tipo text,
  titulo text,
  data_publicacao date,
  link text,
  anexo_id uuid,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tramites_internos (
  id uuid primary key default gen_random_uuid(),
  local_id text unique,
  processo_id uuid references public.processos(id) on delete cascade,
  numero_processo text,
  entrada text,
  data_entrada date,
  motivo text,
  secretaria text,
  objeto text,
  responsavel text,
  tipo text,
  status text,
  destino text,
  historico jsonb not null default '[]'::jsonb,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tramites_gerais (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references public.processos(id) on delete cascade,
  numero_processo text not null,
  item text not null,
  data_tramite date,
  hora_tramite time,
  recebido text,
  origem text,
  setor_atual text,
  relator text,
  parecer text,
  descricao_parecer text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (numero_processo, item)
);

create table if not exists public.anexos (
  id uuid primary key default gen_random_uuid(),
  local_id text unique,
  nome text,
  tipo text,
  tamanho bigint,
  storage_bucket text,
  storage_path text,
  origem text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_processos_numero on public.processos(numero);
create index if not exists idx_processos_secretaria on public.processos(secretaria);
create index if not exists idx_processos_natureza on public.processos(natureza_processo);
create index if not exists idx_fornecedores_cnpj on public.fornecedores(cnpj);
create index if not exists idx_atas_processo on public.atas_registro_preco(processo_id);
create index if not exists idx_atas_ano on public.atas_registro_preco(ano);
create index if not exists idx_atas_vigencia_fim on public.atas_registro_preco(vigencia_fim);
create index if not exists idx_tramites_gerais_numero on public.tramites_gerais(numero_processo);

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
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', tabela, tabela);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', tabela, tabela);
    execute format('alter table public.%I enable row level security', tabela);
    execute format('drop policy if exists "anon_select_%I" on public.%I', tabela, tabela);
    execute format('drop policy if exists "anon_insert_%I" on public.%I', tabela, tabela);
    execute format('drop policy if exists "anon_update_%I" on public.%I', tabela, tabela);
    execute format('drop policy if exists "anon_delete_%I" on public.%I', tabela, tabela);
    execute format('drop policy if exists "authenticated_select_%I" on public.%I', tabela, tabela);
    execute format('drop policy if exists "authenticated_insert_%I" on public.%I', tabela, tabela);
    execute format('drop policy if exists "authenticated_update_%I" on public.%I', tabela, tabela);
    execute format('drop policy if exists "authenticated_delete_%I" on public.%I', tabela, tabela);
    execute format('create policy "authenticated_select_%I" on public.%I for select to authenticated using (true)', tabela, tabela);
    execute format('create policy "authenticated_insert_%I" on public.%I for insert to authenticated with check (true)', tabela, tabela);
    execute format('create policy "authenticated_update_%I" on public.%I for update to authenticated using (true) with check (true)', tabela, tabela);
    execute format('create policy "authenticated_delete_%I" on public.%I for delete to authenticated using (true)', tabela, tabela);
  end loop;
end $$;

insert into public.secretarias (sigla) values
  ('AMHARC'), ('AGETRAT'), ('FUPHAN'), ('FMAP'), ('FUNPREV'), ('SISP'), ('SEMED'), ('SEPRAD'),
  ('SMSPDS'), ('PROCON'), ('FCC'), ('FUNEC'), ('FUNDTUR'), ('SMASC'), ('SMDES'), ('SEGES'),
  ('SMS'), ('SELIC')
on conflict (sigla) do nothing;

-- Auditoria: esta consulta deve retornar zero linhas para confirmar que nao
-- sobrou policy aberta para anon nas tabelas do sistema.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and roles::text ilike '%anon%'
  and tablename = any(array[
    'app_settings','secretarias','tipos_protocolo','assuntos_protocolo','fornecedores',
    'fornecedor_pessoas','processos','processo_blocos','processo_itens','processo_publicacoes',
    'irps_registro_preco','irp_itens','atas_registro_preco','ata_itens','ata_publicacoes',
    'ata_aditivos','ata_aditivo_publicacoes','tramites_internos','tramites_gerais','anexos'
  ]);
