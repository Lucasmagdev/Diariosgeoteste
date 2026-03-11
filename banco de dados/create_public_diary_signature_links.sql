-- Link publico de assinatura de diario (sem login)
-- Execute no SQL Editor do Supabase

create extension if not exists pgcrypto;

-- Campos de status/assinatura do cliente no diario principal
alter table public.work_diaries
  add column if not exists responsible_signature_url text,
  add column if not exists responsible_signed_at timestamp with time zone,
  add column if not exists responsible_signed_by text,
  add column if not exists responsible_signed_cpf text,
  add column if not exists signature_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_diaries_signature_status_check'
  ) then
    alter table public.work_diaries
      add constraint work_diaries_signature_status_check
      check (signature_status in ('pending', 'signed'));
  end if;
end $$;

-- Tabela de links unicos de assinatura
create table if not exists public.diary_signature_links (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.work_diaries(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  signer_name text,
  signer_cpf text,
  last_accessed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_diary_signature_links_diary_id on public.diary_signature_links(diary_id);
create index if not exists idx_diary_signature_links_expires_at on public.diary_signature_links(expires_at);

alter table public.diary_signature_links enable row level security;

drop policy if exists "diary_signature_links_select_owner_admin" on public.diary_signature_links;
create policy "diary_signature_links_select_owner_admin"
  on public.diary_signature_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.work_diaries wd
      where wd.id = diary_signature_links.diary_id
        and (wd.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "diary_signature_links_insert_owner_admin" on public.diary_signature_links;
create policy "diary_signature_links_insert_owner_admin"
  on public.diary_signature_links
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.work_diaries wd
      where wd.id = diary_signature_links.diary_id
        and (wd.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "diary_signature_links_update_owner_admin" on public.diary_signature_links;
create policy "diary_signature_links_update_owner_admin"
  on public.diary_signature_links
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.work_diaries wd
      where wd.id = diary_signature_links.diary_id
        and (wd.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from public.work_diaries wd
      where wd.id = diary_signature_links.diary_id
        and (wd.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "diary_signature_links_delete_owner_admin" on public.diary_signature_links;
create policy "diary_signature_links_delete_owner_admin"
  on public.diary_signature_links
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.work_diaries wd
      where wd.id = diary_signature_links.diary_id
        and (wd.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

create or replace function public.hash_diary_signature_token(p_token text)
returns text
language sql
immutable
as $$
  -- Usa md5 nativo do Postgres para evitar dependência de digest/pgcrypto
  select md5(coalesce(trim(p_token), ''));
$$;

create or replace function public.create_diary_signature_link(
  p_diary_id uuid,
  p_expires_hours integer default 168
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
  v_token text;
  v_token_hash text;
  v_expires_at timestamp with time zone;
begin
  if v_uid is null then
    raise exception 'Usuario nao autenticado';
  end if;

  select exists (
    select 1
    from public.work_diaries wd
    where wd.id = p_diary_id
      and (wd.user_id = v_uid or public.is_admin(v_uid))
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Sem permissao para gerar link deste diario';
  end if;

  update public.diary_signature_links
  set revoked_at = now()
  where diary_id = p_diary_id
    and used_at is null
    and revoked_at is null;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := public.hash_diary_signature_token(v_token);
  v_expires_at := now() + make_interval(hours => greatest(coalesce(p_expires_hours, 168), 1));

  insert into public.diary_signature_links (
    diary_id,
    token_hash,
    created_by,
    expires_at
  )
  values (
    p_diary_id,
    v_token_hash,
    v_uid,
    v_expires_at
  );

  return jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires_at,
    'diary_id', p_diary_id
  );
end;
$$;

create or replace function public.get_diary_for_public_signature(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public.hash_diary_signature_token(p_token);
  v_link record;
  v_payload jsonb;
begin
  select
    l.id,
    l.diary_id,
    l.expires_at,
    l.used_at,
    l.revoked_at,
    to_jsonb(wd) as diary_json
  into v_link
  from public.diary_signature_links l
  join public.work_diaries wd on wd.id = l.diary_id
  where l.token_hash = v_hash
  order by l.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'invalid_token');
  end if;

  if v_link.revoked_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'revoked');
  end if;

  if v_link.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  update public.diary_signature_links
  set last_accessed_at = now()
  where id = v_link.id;

  v_payload := jsonb_build_object(
    'valid', true,
    'can_sign', v_link.used_at is null,
    'already_signed', v_link.used_at is not null,
    'expires_at', v_link.expires_at,
    'diary', v_link.diary_json,
    'pceDetail', (select to_jsonb(p) from public.work_diaries_pce p where p.diary_id = v_link.diary_id limit 1),
    'pitDetail', (select to_jsonb(p) from public.work_diaries_pit p where p.diary_id = v_link.diary_id limit 1),
    'placaDetail', (select to_jsonb(p) from public.work_diaries_placa p where p.diary_id = v_link.diary_id limit 1),
    'fichapdaDetail', (select to_jsonb(f) from public.fichapda f where f.diary_id = v_link.diary_id limit 1),
    'pdaDiarioDetail', (select to_jsonb(p) from public.work_diaries_pda_diario p where p.diary_id = v_link.diary_id limit 1),
    'pcePiles', coalesce((
      select jsonb_agg(to_jsonb(pp) order by pp.ordem)
      from public.work_diaries_pce p
      join public.work_diaries_pce_piles pp on pp.pce_id = p.id
      where p.diary_id = v_link.diary_id
    ), '[]'::jsonb),
    'pitPiles', coalesce((
      select jsonb_agg(to_jsonb(pp) order by pp.ordem)
      from public.work_diaries_pit p
      join public.work_diaries_pit_piles pp on pp.pit_id = p.id
      where p.diary_id = v_link.diary_id
    ), '[]'::jsonb),
    'placaPiles', coalesce((
      select jsonb_agg(to_jsonb(pp) order by pp.ordem)
      from public.work_diaries_placa p
      join public.work_diaries_placa_piles pp on pp.placa_id = p.id
      where p.diary_id = v_link.diary_id
    ), '[]'::jsonb),
    'pdaDiarioPiles', coalesce((
      select jsonb_agg(to_jsonb(pp) order by pp.ordem)
      from public.work_diaries_pda_diario p
      join public.work_diaries_pda_diario_piles pp on pp.pda_diario_id = p.id
      where p.diary_id = v_link.diary_id
    ), '[]'::jsonb)
  );

  return v_payload;
end;
$$;

create or replace function public.submit_public_diary_signature(
  p_token text,
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
  v_hash text := public.hash_diary_signature_token(p_token);
  v_link record;
  v_name text := nullif(trim(coalesce(p_signer_name, '')), '');
  v_cpf text := nullif(trim(coalesce(p_signer_cpf, '')), '');
  v_signature text := trim(coalesce(p_signature_data, ''));
begin
  if v_signature = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_signature');
  end if;

  if length(v_signature) > 4000000 then
    return jsonb_build_object('ok', false, 'reason', 'signature_too_large');
  end if;

  select
    l.id,
    l.diary_id,
    l.expires_at,
    l.used_at,
    l.revoked_at
  into v_link
  from public.diary_signature_links l
  where l.token_hash = v_hash
  order by l.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_token');
  end if;

  if v_link.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;

  if v_link.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_link.used_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_signed');
  end if;

  update public.work_diaries
  set
    responsible_signature = coalesce(v_name, 'Assinado via link publico'),
    responsible_signature_url = v_signature,
    responsible_signed_at = now(),
    responsible_signed_by = v_name,
    responsible_signed_cpf = v_cpf,
    signature_status = 'signed'
  where id = v_link.diary_id;

  update public.diary_signature_links
  set
    used_at = now(),
    signer_name = v_name,
    signer_cpf = v_cpf
  where id = v_link.id;

  return jsonb_build_object(
    'ok', true,
    'diary_id', v_link.diary_id
  );
end;
$$;

revoke all on function public.create_diary_signature_link(uuid, integer) from public;
revoke all on function public.get_diary_for_public_signature(text) from public;
revoke all on function public.submit_public_diary_signature(text, text, text, text) from public;

grant execute on function public.create_diary_signature_link(uuid, integer) to authenticated;
grant execute on function public.get_diary_for_public_signature(text) to anon, authenticated;
grant execute on function public.submit_public_diary_signature(text, text, text, text) to anon, authenticated;
