-- Crie a tabela de perfis vinculada ao auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'user', -- 'admin' | 'user'
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

-- Políticas básicas (CREATE POLICY não suporta IF NOT EXISTS)
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
  on public.profiles
  for select
  using ( auth.uid() = id );

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert"
  on public.profiles
  for insert
  with check ( auth.uid() = id );

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles
  for update
  using ( auth.uid() = id );

-- Política para admins gerenciarem todos os perfis
drop policy if exists "profiles_admin_full" on public.profiles;
create policy "profiles_admin_full"
  on public.profiles for all
  using ( public.is_admin(auth.uid()) );

-- Trigger para criar perfil automaticamente quando usuário se registra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Usuário'),
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'role',''), 'user')
  )
  on conflict (id) do update
    set role = coalesce(nullif(excluded.role,''), public.profiles.role),
        name = excluded.name,
        email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger que executa após inserção em auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================
-- Diários de Obra
-- ============================

create table if not exists public.work_diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  address text not null,
  team text not null,
  diary_type text check (diary_type in ('PCE','PLACA','PIT','PDA','PDA_DIARIO')),
  date date not null,
  start_time text not null,
  end_time text not null,
  services_executed text not null,
  geotest_signature text not null,
  responsible_signature text not null,
  observations text,
  endereco_detalhado jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.work_diaries enable row level security;

-- Índices úteis
create index if not exists idx_work_diaries_user_id on public.work_diaries(user_id);
create index if not exists idx_work_diaries_date on public.work_diaries(date);
create index if not exists idx_work_diaries_client_name on public.work_diaries using gin (to_tsvector('portuguese', client_name));

-- Função helper: verifica se o usuário é admin com base no profile
create or replace function public.is_admin(u uuid)
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = u and p.role = 'admin'
  );
$$;

-- Políticas: dono pode tudo no próprio registro; admin pode tudo
drop policy if exists "work_diaries_select_owner_admin" on public.work_diaries;
create policy "work_diaries_select_owner_admin"
  on public.work_diaries
  for select
  using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

drop policy if exists "work_diaries_insert_owner" on public.work_diaries;
create policy "work_diaries_insert_owner"
  on public.work_diaries
  for insert
  with check ( auth.uid() = user_id );

drop policy if exists "work_diaries_update_owner_admin" on public.work_diaries;
create policy "work_diaries_update_owner_admin"
  on public.work_diaries
  for update
  using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

drop policy if exists "work_diaries_delete_owner_admin" on public.work_diaries;
create policy "work_diaries_delete_owner_admin"
  on public.work_diaries
  for delete
  using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_work_diaries_updated on public.work_diaries;
create trigger trg_work_diaries_updated
before update on public.work_diaries
for each row execute procedure public.set_updated_at();


