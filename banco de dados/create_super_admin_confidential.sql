-- =====================================================================
-- ADM GLOBAL (super admin) + OBRAS CONFIDENCIAIS
-- Obras confidenciais so aparecem para super admins no painel; o cliente
-- ve normalmente pelo portal (portal_get_data e security definer).
-- Execute no SQL Editor do Supabase.
-- =====================================================================

-- 1. Flags
alter table public.profiles add column if not exists is_super_admin boolean not null default false;
alter table public.obras add column if not exists confidential boolean not null default false;

-- 2. Helper
create or replace function public.is_super_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_super_admin from public.profiles where id = uid), false);
$$;

-- 3. RLS de obras: confidencial so para super admin
drop policy if exists "obras_select_auth" on public.obras;
drop policy if exists "obras_select_visible" on public.obras;
create policy "obras_select_visible" on public.obras
  for select to authenticated
  using (coalesce(confidential, false) = false or public.is_super_admin(auth.uid()));

drop policy if exists "obras_write_admin" on public.obras;
drop policy if exists "obras_insert" on public.obras;
create policy "obras_insert" on public.obras
  for insert to authenticated
  with check (
    public.is_admin(auth.uid())
    and (coalesce(confidential, false) = false or public.is_super_admin(auth.uid()))
  );

drop policy if exists "obras_update" on public.obras;
create policy "obras_update" on public.obras
  for update to authenticated
  using (
    public.is_admin(auth.uid())
    and (coalesce(confidential, false) = false or public.is_super_admin(auth.uid()))
  )
  with check (
    public.is_admin(auth.uid())
    and (coalesce(confidential, false) = false or public.is_super_admin(auth.uid()))
  );

drop policy if exists "obras_delete" on public.obras;
create policy "obras_delete" on public.obras
  for delete to authenticated
  using (
    public.is_admin(auth.uid())
    and (coalesce(confidential, false) = false or public.is_super_admin(auth.uid()))
  );

-- 4. RLS de obra_documents: herda a visibilidade da obra
drop policy if exists "obra_documents_select_auth" on public.obra_documents;
drop policy if exists "obra_documents_select_visible" on public.obra_documents;
create policy "obra_documents_select_visible" on public.obra_documents
  for select to authenticated
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_documents.obra_id
        and (coalesce(o.confidential, false) = false or public.is_super_admin(auth.uid()))
    )
  );

drop policy if exists "obra_documents_write_admin" on public.obra_documents;
drop policy if exists "obra_documents_write" on public.obra_documents;
create policy "obra_documents_write" on public.obra_documents
  for all to authenticated
  using (
    public.is_admin(auth.uid())
    and exists (
      select 1 from public.obras o
      where o.id = obra_documents.obra_id
        and (coalesce(o.confidential, false) = false or public.is_super_admin(auth.uid()))
    )
  )
  with check (
    public.is_admin(auth.uid())
    and exists (
      select 1 from public.obras o
      where o.id = obra_documents.obra_id
        and (coalesce(o.confidential, false) = false or public.is_super_admin(auth.uid()))
    )
  );

-- 5. Definir os ADM globais (Lucas e Tatiana)
update public.profiles set is_super_admin = true
where id in (
  'a6bd1ebd-e5d8-4f70-87a7-96e8c9f7b204', -- Lucas (Lucasemb999@gmail.com)
  '947d4ec8-f664-4f68-81bd-d89d5599da2a'  -- Tatiana (tatiana@geoteste.com)
);
