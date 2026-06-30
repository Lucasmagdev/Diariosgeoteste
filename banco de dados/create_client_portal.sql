-- =====================================================================
-- PORTAL DO CLIENTE
-- Login proprio do cliente (usuario+senha criados pelo admin), obras,
-- documentos por categoria e assinatura de diarios/documentos.
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- Segue o padrao de create_public_diary_signature_links.sql
-- (security definer, search_path=public, hash md5, grant to anon).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. OBRAS (entidade que agrupa diarios e documentos)
-- ---------------------------------------------------------------------
create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  obra_code text,                       -- ex: G26003
  name text not null,                   -- ex: CONSTRUTORA APIA - MARIANA
  client_id uuid references public.clients(id) on delete set null,
  address text,
  status text not null default 'ativa' check (status in ('ativa','concluida','inativa')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_obras_client_id on public.obras(client_id);

-- Vincular diario a uma obra (nullable; nao quebra diarios existentes)
alter table public.work_diaries
  add column if not exists obra_id uuid references public.obras(id) on delete set null;

create index if not exists idx_work_diaries_obra_id on public.work_diaries(obra_id);

-- ---------------------------------------------------------------------
-- 2. DOCUMENTOS DA OBRA (uploads: contrato, sondagem, projetos, etc.)
-- ---------------------------------------------------------------------
create table if not exists public.obra_documents (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  category text not null check (category in
    ('contrato','dados_cliente','sondagem','projetos','diarios','medicoes','relatorio','art','outro')),
  custom_label text,                    -- usado quando category = 'outro'
  title text not null,
  file_url text not null,
  file_type text,                       -- mime ou extensao
  uploaded_by uuid references auth.users(id) on delete set null,
  requires_signature boolean not null default false,
  signature_url text,
  signed_at timestamp with time zone,
  signed_by text,
  signed_cpf text,
  signature_status text not null default 'na' check (signature_status in ('na','pending','signed')),
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_obra_documents_obra_id on public.obra_documents(obra_id);

-- ---------------------------------------------------------------------
-- 3. CREDENCIAIS DO PORTAL (login do cliente)
-- ---------------------------------------------------------------------
create table if not exists public.portal_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  email text not null unique,           -- usuario de acesso (ex: lucasmagdev)
  password_hash text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  last_login_at timestamp with time zone
);

create index if not exists idx_portal_credentials_client_id on public.portal_credentials(client_id);

-- ---------------------------------------------------------------------
-- 4. SESSOES DO PORTAL (token apos login)
-- ---------------------------------------------------------------------
create table if not exists public.portal_sessions (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.portal_credentials(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamp with time zone not null,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_portal_sessions_credential_id on public.portal_sessions(credential_id);

-- ---------------------------------------------------------------------
-- 5. RLS: acesso direto somente admin. Cliente acessa via RPC.
-- ---------------------------------------------------------------------
alter table public.obras enable row level security;
alter table public.obra_documents enable row level security;
alter table public.portal_credentials enable row level security;
alter table public.portal_sessions enable row level security;

-- obras: leitura para qualquer autenticado, escrita admin
drop policy if exists "obras_select_auth" on public.obras;
create policy "obras_select_auth" on public.obras
  for select to authenticated using (true);

drop policy if exists "obras_write_admin" on public.obras;
create policy "obras_write_admin" on public.obras
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- obra_documents: leitura autenticado, escrita admin
drop policy if exists "obra_documents_select_auth" on public.obra_documents;
create policy "obra_documents_select_auth" on public.obra_documents
  for select to authenticated using (true);

drop policy if exists "obra_documents_write_admin" on public.obra_documents;
create policy "obra_documents_write_admin" on public.obra_documents
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- portal_credentials: somente admin (leitura e escrita)
drop policy if exists "portal_credentials_admin" on public.portal_credentials;
create policy "portal_credentials_admin" on public.portal_credentials
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- portal_sessions: somente admin acesso direto (RPCs usam security definer)
drop policy if exists "portal_sessions_admin" on public.portal_sessions;
create policy "portal_sessions_admin" on public.portal_sessions
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- 6. HASH helper (reaproveita padrao md5 do projeto)
-- ---------------------------------------------------------------------
create or replace function public.hash_portal_token(p_token text)
returns text
language sql
immutable
as $$
  select md5(coalesce(trim(p_token), ''));
$$;

-- ---------------------------------------------------------------------
-- 7. RPC: admin cria/atualiza credencial (usuario + senha)
-- ---------------------------------------------------------------------
create or replace function public.portal_create_credential(
  p_client_id uuid,
  p_email text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_id uuid;
begin
  if v_uid is null or not public.is_admin(v_uid) then
    raise exception 'Sem permissao';
  end if;
  if v_email is null then
    raise exception 'Usuario obrigatorio';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Senha deve ter ao menos 6 caracteres';
  end if;

  insert into public.portal_credentials (client_id, email, password_hash, created_by)
  values (p_client_id, v_email, crypt(p_password, gen_salt('bf')), v_uid)
  on conflict (email) do update
    set client_id = excluded.client_id,
        password_hash = excluded.password_hash,
        active = true
  returning id into v_id;

  update public.portal_credentials
  set active = false
  where client_id = p_client_id
    and id <> v_id;

  update public.portal_sessions s
  set revoked_at = now()
  from public.portal_credentials c
  where s.credential_id = c.id
    and c.client_id = p_client_id
    and c.id <> v_id
    and s.revoked_at is null;

  return jsonb_build_object('ok', true, 'id', v_id, 'email', v_email);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. RPC: admin ativa/inativa credencial (revoga sessoes ao inativar)
-- ---------------------------------------------------------------------
create or replace function public.portal_set_active(
  p_credential_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_admin(v_uid) then
    raise exception 'Sem permissao';
  end if;

  update public.portal_credentials
  set active = coalesce(p_active, false)
  where id = p_credential_id;

  if not coalesce(p_active, false) then
    update public.portal_sessions
    set revoked_at = now()
    where credential_id = p_credential_id and revoked_at is null;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 9. RPC: login do cliente -> retorna token de sessao
-- ---------------------------------------------------------------------
create or replace function public.portal_login(
  p_email text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(nullif(trim(coalesce(p_email, '')), ''));
  v_cred record;
  v_token text;
  v_expires timestamp with time zone;
begin
  if v_email is null or coalesce(p_password, '') = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_credentials');
  end if;

  select c.*, cl.name as client_name
  into v_cred
  from public.portal_credentials c
  join public.clients cl on cl.id = c.client_id
  where c.email = v_email
  limit 1;

  if not found or not v_cred.active then
    return jsonb_build_object('ok', false, 'reason', 'invalid_or_inactive');
  end if;

  if v_cred.password_hash <> crypt(p_password, v_cred.password_hash) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_credentials');
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '30 days';

  insert into public.portal_sessions (credential_id, token_hash, expires_at)
  values (v_cred.id, public.hash_portal_token(v_token), v_expires);

  update public.portal_credentials set last_login_at = now() where id = v_cred.id;

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'expires_at', v_expires,
    'client_id', v_cred.client_id,
    'client_name', v_cred.client_name
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 9b. RPC: admin gera link direto do portal (sem email/senha para o cliente)
-- ---------------------------------------------------------------------
create or replace function public.portal_create_access_link(
  p_client_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_cred_id uuid;
  v_token text;
  v_expires timestamp with time zone;
begin
  if v_uid is null or not public.is_admin(v_uid) then
    raise exception 'Sem permissao';
  end if;

  if p_client_id is null or not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'Cliente invalido';
  end if;

  select id
  into v_cred_id
  from public.portal_credentials
  where client_id = p_client_id
  order by created_at desc
  limit 1;

  if v_cred_id is null then
    insert into public.portal_credentials (client_id, email, password_hash, created_by)
    values (
      p_client_id,
      'portal-' || replace(p_client_id::text, '-', '') || '@link.local',
      crypt(replace(gen_random_uuid()::text, '-', ''), gen_salt('bf')),
      v_uid
    )
    returning id into v_cred_id;
  else
    update public.portal_credentials
    set active = true
    where id = v_cred_id;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '30 days';

  insert into public.portal_sessions (credential_id, token_hash, expires_at)
  values (v_cred_id, public.hash_portal_token(v_token), v_expires);

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'expires_at', v_expires,
    'credential_id', v_cred_id
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Helper interno: valida token -> retorna credencial (ou null)
-- ---------------------------------------------------------------------
create or replace function public.portal_resolve_session(p_token text)
returns table (credential_id uuid, client_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public.hash_portal_token(p_token);
begin
  return query
  select c.id, c.client_id
  from public.portal_sessions s
  join public.portal_credentials c on c.id = s.credential_id
  where s.token_hash = v_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and c.active = true
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. RPC: cliente busca seus dados (obras + diarios + documentos)
-- ---------------------------------------------------------------------
create or replace function public.portal_get_data(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_client_name text;
  v_obras jsonb;
begin
  select client_id into v_client from public.portal_resolve_session(p_token);
  if v_client is null then
    return jsonb_build_object('valid', false, 'reason', 'invalid_session');
  end if;

  select name into v_client_name from public.clients where id = v_client;

  select coalesce(jsonb_agg(obra_json order by obra_json->>'name'), '[]'::jsonb)
  into v_obras
  from (
    select jsonb_build_object(
      'id', o.id,
      'obra_code', o.obra_code,
      'name', o.name,
      'address', o.address,
      'status', o.status,
      'diaries', coalesce((
        select jsonb_agg(to_jsonb(wd) order by wd.date desc)
        from public.work_diaries wd
        where wd.obra_id = o.id
           or (wd.obra_id is null and wd.client_name = v_client_name)
      ), '[]'::jsonb),
      'documents', coalesce((
        select jsonb_agg(to_jsonb(d) order by d.created_at desc)
        from public.obra_documents d
        where d.obra_id = o.id
      ), '[]'::jsonb)
    ) as obra_json
    from public.obras o
    where o.client_id = v_client
  ) sub;

  return jsonb_build_object(
    'valid', true,
    'client_id', v_client,
    'client_name', v_client_name,
    'obras', v_obras
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 12. RPC: cliente assina um documento da obra
-- ---------------------------------------------------------------------
create or replace function public.portal_sign_document(
  p_token text,
  p_doc_id uuid,
  p_signer_name text,
  p_signer_cpf text,
  p_signature_data text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_name text := nullif(trim(coalesce(p_signer_name, '')), '');
  v_cpf text := nullif(trim(coalesce(p_signer_cpf, '')), '');
  v_signature text := trim(coalesce(p_signature_data, ''));
  v_owner uuid;
begin
  select client_id into v_client from public.portal_resolve_session(p_token);
  if v_client is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;
  if v_signature = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_signature');
  end if;
  if length(v_signature) > 4000000 then
    return jsonb_build_object('ok', false, 'reason', 'signature_too_large');
  end if;

  -- documento precisa pertencer a uma obra do cliente da sessao
  select o.client_id into v_owner
  from public.obra_documents d
  join public.obras o on o.id = d.obra_id
  where d.id = p_doc_id;

  if v_owner is null or v_owner <> v_client then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  update public.obra_documents
  set signature_url = v_signature,
      signed_at = now(),
      signed_by = v_name,
      signed_cpf = v_cpf,
      signature_status = 'signed'
  where id = p_doc_id;

  return jsonb_build_object('ok', true, 'doc_id', p_doc_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 13. RPC: cliente assina um diario (valida a sessao do portal)
-- ---------------------------------------------------------------------
create or replace function public.portal_sign_diary(
  p_token text,
  p_diary_id uuid,
  p_signer_name text,
  p_signer_cpf text,
  p_signature_data text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_client_name text;
  v_name text := nullif(trim(coalesce(p_signer_name, '')), '');
  v_cpf text := nullif(trim(coalesce(p_signer_cpf, '')), '');
  v_signature text := trim(coalesce(p_signature_data, ''));
  v_allowed boolean;
begin
  select client_id into v_client from public.portal_resolve_session(p_token);
  if v_client is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;
  if v_signature = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_signature');
  end if;
  if length(v_signature) > 4000000 then
    return jsonb_build_object('ok', false, 'reason', 'signature_too_large');
  end if;

  select name into v_client_name from public.clients where id = v_client;

  -- diario precisa pertencer a uma obra do cliente OU casar por client_name
  select exists (
    select 1 from public.work_diaries wd
    left join public.obras o on o.id = wd.obra_id
    where wd.id = p_diary_id
      and (o.client_id = v_client or wd.client_name = v_client_name)
  ) into v_allowed;

  if not v_allowed then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  update public.work_diaries
  set responsible_signature = coalesce(v_name, 'Assinado via portal'),
      responsible_signature_url = v_signature,
      responsible_signed_at = now(),
      responsible_signed_by = v_name,
      responsible_signed_cpf = v_cpf,
      signature_status = 'signed'
  where id = p_diary_id;

  return jsonb_build_object('ok', true, 'diary_id', p_diary_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 14. GRANTS (RPCs anon para o portal sem login interno)
-- ---------------------------------------------------------------------
revoke all on function public.portal_create_credential(uuid, text, text) from public;
revoke all on function public.portal_create_access_link(uuid) from public;
revoke all on function public.portal_set_active(uuid, boolean) from public;
revoke all on function public.portal_login(text, text) from public;
revoke all on function public.portal_get_data(text) from public;
revoke all on function public.portal_sign_document(text, uuid, text, text, text) from public;
revoke all on function public.portal_sign_diary(text, uuid, text, text, text) from public;

grant execute on function public.portal_create_credential(uuid, text, text) to authenticated;
grant execute on function public.portal_create_access_link(uuid) to authenticated;
grant execute on function public.portal_set_active(uuid, boolean) to authenticated;
grant execute on function public.portal_login(text, text) to anon, authenticated;
grant execute on function public.portal_get_data(text) to anon, authenticated;
grant execute on function public.portal_sign_document(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.portal_sign_diary(text, uuid, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 15. STORAGE: bucket para documentos do portal
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portal-docs',
  'portal-docs',
  true,
  20971520, -- 20MB
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

-- Upload/gestao por admin autenticado; leitura publica (bucket public).
drop policy if exists "portal_docs_admin_write" on storage.objects;
create policy "portal_docs_admin_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portal-docs');

drop policy if exists "portal_docs_admin_update" on storage.objects;
create policy "portal_docs_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'portal-docs')
  with check (bucket_id = 'portal-docs');

drop policy if exists "portal_docs_admin_delete" on storage.objects;
create policy "portal_docs_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portal-docs');

drop policy if exists "portal_docs_public_read" on storage.objects;
create policy "portal_docs_public_read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'portal-docs');
