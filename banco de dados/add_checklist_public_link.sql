-- =====================================================================
-- LINK PUBLICO DE CHECKLIST (sem login no portal)
-- Mesmo padrao de create_public_diary_signature_links.sql: token unico,
-- expira, admin gera pela tela interna, cliente abre e preenche direto.
-- Execute no SQL Editor do Supabase apos create_checklists.sql.
-- =====================================================================

create table if not exists public.checklist_signature_links (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.obra_checklists(id) on delete cascade,
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

create index if not exists idx_checklist_signature_links_checklist_id on public.checklist_signature_links(checklist_id);
create index if not exists idx_checklist_signature_links_expires_at on public.checklist_signature_links(expires_at);

alter table public.checklist_signature_links enable row level security;

drop policy if exists "checklist_signature_links_select_admin" on public.checklist_signature_links;
create policy "checklist_signature_links_select_admin"
  on public.checklist_signature_links
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "checklist_signature_links_insert_admin" on public.checklist_signature_links;
create policy "checklist_signature_links_insert_admin"
  on public.checklist_signature_links
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "checklist_signature_links_update_admin" on public.checklist_signature_links;
create policy "checklist_signature_links_update_admin"
  on public.checklist_signature_links
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "checklist_signature_links_delete_admin" on public.checklist_signature_links;
create policy "checklist_signature_links_delete_admin"
  on public.checklist_signature_links
  for delete to authenticated
  using (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- Admin gera o link (revoga links antigos nao usados do mesmo checklist)
-- ---------------------------------------------------------------------
create or replace function public.create_checklist_signature_link(
  p_checklist_id uuid,
  p_expires_hours integer default 720
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_token_hash text;
  v_expires_at timestamp with time zone;
begin
  if v_uid is null or not public.is_admin(v_uid) then
    raise exception 'Sem permissao para gerar link deste checklist';
  end if;

  if not exists (select 1 from public.obra_checklists where id = p_checklist_id) then
    raise exception 'Checklist nao encontrado';
  end if;

  update public.checklist_signature_links
  set revoked_at = now()
  where checklist_id = p_checklist_id
    and used_at is null
    and revoked_at is null;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := public.hash_diary_signature_token(v_token);
  v_expires_at := now() + make_interval(hours => greatest(coalesce(p_expires_hours, 720), 1));

  insert into public.checklist_signature_links (checklist_id, token_hash, created_by, expires_at)
  values (p_checklist_id, v_token_hash, v_uid, v_expires_at);

  return jsonb_build_object('token', v_token, 'expires_at', v_expires_at, 'checklist_id', p_checklist_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Cliente abre o link (sem login): retorna checklist + itens + obra/cliente
-- ---------------------------------------------------------------------
create or replace function public.get_checklist_for_public_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public.hash_diary_signature_token(p_token);
  v_link record;
begin
  select l.id, l.checklist_id, l.expires_at, l.used_at, l.revoked_at
  into v_link
  from public.checklist_signature_links l
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

  update public.checklist_signature_links set last_accessed_at = now() where id = v_link.id;

  return jsonb_build_object(
    'valid', true,
    'checklist', (
      select jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'status', c.status,
        'signature_url', c.signature_url,
        'signed_at', c.signed_at,
        'signed_by', c.signed_by,
        'obra_name', o.name,
        'client_name', cl.name,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id, 'position', i.position, 'text', i.text,
            'required', i.required, 'requires_photo', i.requires_photo,
            'checked', i.checked, 'photo_data', i.photo_data, 'note', i.note
          ) order by i.position)
          from public.obra_checklist_items i
          where i.checklist_id = c.id
        ), '[]'::jsonb)
      )
      from public.obra_checklists c
      join public.obras o on o.id = c.obra_id
      join public.clients cl on cl.id = o.client_id
      where c.id = v_link.checklist_id
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Cliente salva progresso parcial (sem login), token e a autenticacao
-- ---------------------------------------------------------------------
create or replace function public.save_public_checklist_progress(
  p_token text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public.hash_diary_signature_token(p_token);
  v_link record;
  v_status text;
  v_item jsonb;
begin
  select l.id, l.checklist_id, l.expires_at, l.used_at, l.revoked_at
  into v_link
  from public.checklist_signature_links l
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
    return jsonb_build_object('ok', false, 'reason', 'already_completed');
  end if;

  select status into v_status from public.obra_checklists where id = v_link.checklist_id;
  if v_status = 'completed' then
    return jsonb_build_object('ok', false, 'reason', 'already_completed');
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    update public.obra_checklist_items
    set checked = coalesce((v_item->>'checked')::boolean, checked),
        photo_data = coalesce(v_item->>'photo_data', photo_data),
        note = coalesce(v_item->>'note', note)
    where id = (v_item->>'id')::uuid and checklist_id = v_link.checklist_id;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Cliente conclui e assina (sem login), token e a autenticacao
-- ---------------------------------------------------------------------
create or replace function public.submit_public_checklist(
  p_token text,
  p_items jsonb,
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
  v_status text;
  v_item jsonb;
  v_missing_required integer;
  v_missing_photo integer;
begin
  if v_signature = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_signature');
  end if;
  if length(v_signature) > 4000000 then
    return jsonb_build_object('ok', false, 'reason', 'signature_too_large');
  end if;

  select l.id, l.checklist_id, l.expires_at, l.used_at, l.revoked_at
  into v_link
  from public.checklist_signature_links l
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
    return jsonb_build_object('ok', false, 'reason', 'already_completed');
  end if;

  select status into v_status from public.obra_checklists where id = v_link.checklist_id;
  if v_status = 'completed' then
    return jsonb_build_object('ok', false, 'reason', 'already_completed');
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    update public.obra_checklist_items
    set checked = coalesce((v_item->>'checked')::boolean, checked),
        photo_data = coalesce(v_item->>'photo_data', photo_data),
        note = coalesce(v_item->>'note', note)
    where id = (v_item->>'id')::uuid and checklist_id = v_link.checklist_id;
  end loop;

  select count(*) filter (where required and not checked),
         count(*) filter (where requires_photo and coalesce(photo_data, '') = '')
  into v_missing_required, v_missing_photo
  from public.obra_checklist_items
  where checklist_id = v_link.checklist_id;

  if coalesce(v_missing_required, 0) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing_required');
  end if;
  if coalesce(v_missing_photo, 0) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing_photo');
  end if;

  update public.obra_checklists
  set status = 'completed',
      signature_url = v_signature,
      signed_at = now(),
      signed_by = v_name,
      signed_cpf = v_cpf,
      updated_at = now()
  where id = v_link.checklist_id;

  update public.checklist_signature_links
  set used_at = now(), signer_name = v_name, signer_cpf = v_cpf
  where id = v_link.id;

  return jsonb_build_object('ok', true, 'checklist_id', v_link.checklist_id);
end;
$$;

revoke all on function public.create_checklist_signature_link(uuid, integer) from public;
revoke all on function public.get_checklist_for_public_link(text) from public;
revoke all on function public.save_public_checklist_progress(text, jsonb) from public;
revoke all on function public.submit_public_checklist(text, jsonb, text, text, text) from public;

grant execute on function public.create_checklist_signature_link(uuid, integer) to authenticated;
grant execute on function public.get_checklist_for_public_link(text) to anon, authenticated;
grant execute on function public.save_public_checklist_progress(text, jsonb) to anon, authenticated;
grant execute on function public.submit_public_checklist(text, jsonb, text, text, text) to anon, authenticated;
