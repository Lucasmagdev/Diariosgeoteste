-- =====================================================================
-- CHECKLISTS DO PORTAL (responsabilidades / pre-obra)
-- Admin monta templates reutilizaveis, aplica numa obra, cliente marca
-- os itens (obrigatorios bloqueiam conclusao), anexa foto quando exigido
-- e assina no final. Segue o padrao de create_client_portal.sql e
-- create_super_admin_confidential.sql (RLS + RPC security definer).
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TEMPLATES (modelos reutilizaveis, ex: "Responsabilidades Padrao")
-- ---------------------------------------------------------------------
create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  position integer not null default 0,
  text text not null,
  required boolean not null default false,
  requires_photo boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_checklist_template_items_template_id on public.checklist_template_items(template_id);

-- ---------------------------------------------------------------------
-- 2. CHECKLIST APLICADO NUMA OBRA (copia dos itens do template)
-- ---------------------------------------------------------------------
create table if not exists public.obra_checklists (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  template_id uuid references public.checklist_templates(id) on delete set null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','completed')),
  signature_url text,
  signed_at timestamp with time zone,
  signed_by text,
  signed_cpf text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_obra_checklists_obra_id on public.obra_checklists(obra_id);

create table if not exists public.obra_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.obra_checklists(id) on delete cascade,
  position integer not null default 0,
  text text not null,
  required boolean not null default false,
  requires_photo boolean not null default false,
  checked boolean not null default false,
  photo_data text,
  note text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_obra_checklist_items_checklist_id on public.obra_checklist_items(checklist_id);

-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
alter table public.checklist_templates enable row level security;
alter table public.checklist_template_items enable row level security;
alter table public.obra_checklists enable row level security;
alter table public.obra_checklist_items enable row level security;

-- templates: leitura para qualquer autenticado, escrita admin
drop policy if exists "checklist_templates_select" on public.checklist_templates;
create policy "checklist_templates_select" on public.checklist_templates
  for select to authenticated using (true);

drop policy if exists "checklist_templates_write" on public.checklist_templates;
create policy "checklist_templates_write" on public.checklist_templates
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "checklist_template_items_select" on public.checklist_template_items;
create policy "checklist_template_items_select" on public.checklist_template_items
  for select to authenticated using (true);

drop policy if exists "checklist_template_items_write" on public.checklist_template_items;
create policy "checklist_template_items_write" on public.checklist_template_items
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- obra_checklists: herda visibilidade/confidencialidade da obra (mesmo padrao de obra_documents)
drop policy if exists "obra_checklists_select_visible" on public.obra_checklists;
create policy "obra_checklists_select_visible" on public.obra_checklists
  for select to authenticated
  using (
    exists (
      select 1 from public.obras o
      where o.id = obra_checklists.obra_id
        and (coalesce(o.confidential, false) = false or public.is_super_admin(auth.uid()))
    )
  );

drop policy if exists "obra_checklists_write" on public.obra_checklists;
create policy "obra_checklists_write" on public.obra_checklists
  for all to authenticated
  using (
    public.is_admin(auth.uid())
    and exists (
      select 1 from public.obras o
      where o.id = obra_checklists.obra_id
        and (coalesce(o.confidential, false) = false or public.is_super_admin(auth.uid()))
    )
  )
  with check (
    public.is_admin(auth.uid())
    and exists (
      select 1 from public.obras o
      where o.id = obra_checklists.obra_id
        and (coalesce(o.confidential, false) = false or public.is_super_admin(auth.uid()))
    )
  );

-- obra_checklist_items: herda via obra_checklists
drop policy if exists "obra_checklist_items_select_visible" on public.obra_checklist_items;
create policy "obra_checklist_items_select_visible" on public.obra_checklist_items
  for select to authenticated
  using (
    exists (
      select 1 from public.obra_checklists c
      join public.obras o on o.id = c.obra_id
      where c.id = obra_checklist_items.checklist_id
        and (coalesce(o.confidential, false) = false or public.is_super_admin(auth.uid()))
    )
  );

drop policy if exists "obra_checklist_items_write" on public.obra_checklist_items;
create policy "obra_checklist_items_write" on public.obra_checklist_items
  for all to authenticated
  using (
    public.is_admin(auth.uid())
    and exists (
      select 1 from public.obra_checklists c
      join public.obras o on o.id = c.obra_id
      where c.id = obra_checklist_items.checklist_id
        and (coalesce(o.confidential, false) = false or public.is_super_admin(auth.uid()))
    )
  )
  with check (
    public.is_admin(auth.uid())
    and exists (
      select 1 from public.obra_checklists c
      join public.obras o on o.id = c.obra_id
      where c.id = obra_checklist_items.checklist_id
        and (coalesce(o.confidential, false) = false or public.is_super_admin(auth.uid()))
    )
  );

-- ---------------------------------------------------------------------
-- 4. RPC: cliente envia checklist preenchido (itens + assinatura), atomico
--    Bloqueio duro: nao completa se faltar item obrigatorio ou foto exigida.
-- ---------------------------------------------------------------------
create or replace function public.portal_submit_checklist(
  p_token text,
  p_checklist_id uuid,
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
  v_client uuid;
  v_name text := nullif(trim(coalesce(p_signer_name, '')), '');
  v_cpf text := nullif(trim(coalesce(p_signer_cpf, '')), '');
  v_signature text := trim(coalesce(p_signature_data, ''));
  v_owner uuid;
  v_status text;
  v_item jsonb;
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
  if length(coalesce(p_items::text, '')) > 30000000 then
    return jsonb_build_object('ok', false, 'reason', 'payload_too_large');
  end if;

  select o.client_id, c.status into v_owner, v_status
  from public.obra_checklists c
  join public.obras o on o.id = c.obra_id
  where c.id = p_checklist_id;

  if v_owner is null or v_owner <> v_client then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;
  if v_status = 'completed' then
    return jsonb_build_object('ok', false, 'reason', 'already_completed');
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    update public.obra_checklist_items
    set checked = coalesce((v_item->>'checked')::boolean, false),
        photo_data = nullif(trim(coalesce(v_item->>'photo_data', '')), ''),
        note = nullif(trim(coalesce(v_item->>'note', '')), '')
    where id = (v_item->>'id')::uuid
      and checklist_id = p_checklist_id;
  end loop;

  if exists (
    select 1 from public.obra_checklist_items
    where checklist_id = p_checklist_id and required and not checked
  ) then
    return jsonb_build_object('ok', false, 'reason', 'missing_required');
  end if;

  if exists (
    select 1 from public.obra_checklist_items
    where checklist_id = p_checklist_id and requires_photo and coalesce(photo_data, '') = ''
  ) then
    return jsonb_build_object('ok', false, 'reason', 'missing_photo');
  end if;

  update public.obra_checklists
  set status = 'completed',
      signature_url = v_signature,
      signed_at = now(),
      signed_by = v_name,
      signed_cpf = v_cpf,
      updated_at = now()
  where id = p_checklist_id;

  return jsonb_build_object('ok', true, 'checklist_id', p_checklist_id);
end;
$$;

revoke all on function public.portal_submit_checklist(text, uuid, jsonb, text, text, text) from public;
grant execute on function public.portal_submit_checklist(text, uuid, jsonb, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. portal_get_data: adiciona "checklists" em cada obra
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
      ), '[]'::jsonb),
      'checklists', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'status', c.status,
          'signature_url', c.signature_url,
          'signed_at', c.signed_at,
          'signed_by', c.signed_by,
          'created_at', c.created_at,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', i.id,
              'position', i.position,
              'text', i.text,
              'required', i.required,
              'requires_photo', i.requires_photo,
              'checked', i.checked,
              'photo_data', i.photo_data,
              'note', i.note
            ) order by i.position)
            from public.obra_checklist_items i
            where i.checklist_id = c.id
          ), '[]'::jsonb)
        ) order by c.created_at desc)
        from public.obra_checklists c
        where c.obra_id = o.id
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

grant execute on function public.portal_get_data(text) to anon, authenticated;
