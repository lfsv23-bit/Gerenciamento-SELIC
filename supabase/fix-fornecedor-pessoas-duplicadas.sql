-- Corrige duplicacoes em public.fornecedor_pessoas e impede novas repeticoes.
-- Execute no SQL Editor do Supabase depois de conferir um backup.

begin;

-- 1) Pessoas com CPF: mantem a primeira por fornecedor + CPF.
with duplicadas as (
  select
    id,
    row_number() over (
      partition by fornecedor_id, regexp_replace(coalesce(cpf, ''), '\D', '', 'g')
      order by created_at asc, id asc
    ) as rn
  from public.fornecedor_pessoas
  where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') <> ''
)
delete from public.fornecedor_pessoas p
using duplicadas d
where p.id = d.id
  and d.rn > 1;

-- 2) Pessoas sem CPF: mantem a primeira por fornecedor + nome + tipo + observacao.
with duplicadas as (
  select
    id,
    row_number() over (
      partition by
        fornecedor_id,
        lower(btrim(nome)),
        lower(btrim(coalesce(tipo, ''))),
        lower(btrim(coalesce(observacao, '')))
      order by created_at asc, id asc
    ) as rn
  from public.fornecedor_pessoas
  where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = ''
)
delete from public.fornecedor_pessoas p
using duplicadas d
where p.id = d.id
  and d.rn > 1;

-- 3) Travas para evitar que o problema volte.
create unique index if not exists fornecedor_pessoas_fornecedor_cpf_uidx
on public.fornecedor_pessoas (
  fornecedor_id,
  regexp_replace(coalesce(cpf, ''), '\D', '', 'g')
)
where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') <> '';

create unique index if not exists fornecedor_pessoas_fornecedor_nome_tipo_obs_uidx
on public.fornecedor_pessoas (
  fornecedor_id,
  lower(btrim(nome)),
  lower(btrim(coalesce(tipo, ''))),
  lower(btrim(coalesce(observacao, '')))
)
where regexp_replace(coalesce(cpf, ''), '\D', '', 'g') = '';

commit;
