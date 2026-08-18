-- =====================================================================
-- CATALOGO DE EQUIPAMENTOS (substitui a aba de rastreamento por GPS)
-- Um equipamento e uma unidade fisica unica ("PIT 3", "Martelo 02"),
-- nao um lote/estoque. Nome nao pode repetir dentro do mesmo tipo.
-- Admin cadastra pelo painel; qualquer usuario autenticado pode listar
-- pra escolher no formulario de diario.
-- =====================================================================

create table if not exists public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('PCE', 'PIT', 'PDA', 'HAMMER')),
  nome text not null,
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

-- nome unico dentro do mesmo tipo, sem diferenciar maiusc/minusc
create unique index if not exists idx_equipamentos_tipo_nome
  on public.equipamentos (tipo, lower(nome));

alter table public.equipamentos enable row level security;

drop policy if exists "equipamentos_select_auth" on public.equipamentos;
create policy "equipamentos_select_auth"
  on public.equipamentos for select to authenticated
  using (true);

drop policy if exists "equipamentos_insert_admin" on public.equipamentos;
create policy "equipamentos_insert_admin"
  on public.equipamentos for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "equipamentos_update_admin" on public.equipamentos;
create policy "equipamentos_update_admin"
  on public.equipamentos for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "equipamentos_delete_admin" on public.equipamentos;
create policy "equipamentos_delete_admin"
  on public.equipamentos for delete to authenticated
  using (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- PIT passa a referenciar o catalogo (id), mantendo o texto do nome
-- pra registros antigos que nao tinham catalogo nenhum. A lista fixa
-- 'PIT 1'..'PIT 5' vira dado editavel, entao a checagem antiga fica
-- solta — sem isso, cadastrar "PIT 6" no catalogo quebraria o insert.
-- ---------------------------------------------------------------------
alter table public.work_diaries_pit add column if not exists equipamento_id uuid references public.equipamentos(id);

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.work_diaries_pit'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%equipamento%';
  if v_conname is not null then
    execute format('alter table public.work_diaries_pit drop constraint %I', v_conname);
  end if;
end $$;

-- Semeia os 5 equipamentos que ja existiam como lista fixa, pra nao
-- perder o que ja era usado. Nao faz nada se algum ja existir (nome
-- repetido no mesmo tipo e barrado pelo indice unico acima).
insert into public.equipamentos (tipo, nome)
select 'PIT', nome from (values ('PIT 1'), ('PIT 2'), ('PIT 3'), ('PIT 4'), ('PIT 5')) as t(nome)
on conflict do nothing;
