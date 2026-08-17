-- =====================================================================
-- RODAR TUDO DE UMA VEZ: cola esse arquivo inteiro no SQL Editor do
-- Supabase e da Run uma unica vez. Junta os 4 arquivos pendentes, na
-- ordem certa. Todos usam "create or replace" / "if not exists", entao
-- rodar de novo no futuro nao quebra nada.
--
-- 1) add_common_user_can_add_users.sql  — fecha escalada de privilegio
-- 2) add_relatorio_pin.sql              — PIN nos relatorios do portal
-- 3) add_checklist_link_stable_token.sql — link do checklist para de trocar sozinho
-- 4) create_satisfaction_survey.sql      — pesquisa de satisfacao
-- 5) rename_pit_profundidade_para_metros.sql — profundidade do PIT de cm pra m
-- =====================================================================


-- =====================================================================
-- 1) add_common_user_can_add_users.sql
-- Permite usuario comum (nao-admin) cadastrar novos usuarios (role 'user').
-- Fecha de vez a escalada de privilegio: sem isso, profiles_self_update
-- deixava qualquer usuario autenticado trocar o proprio role para 'admin'
-- via update direto na tabela.
-- =====================================================================

create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role and not public.is_admin(auth.uid()) then
    new.role := old.role;
  end if;
  if tg_op = 'INSERT' and new.role = 'admin' and not public.is_admin(auth.uid()) then
    new.role := 'user';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_role_guard on public.profiles;
create trigger trg_enforce_profile_role_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_role_guard();


-- =====================================================================
-- 2) add_relatorio_pin.sql
-- CADEADO NA CATEGORIA "RELATORIO" DO PORTAL DO CLIENTE
-- Admin define um PIN por obra (opcional). Se definido, documentos da
-- categoria 'relatorio' exigem o PIN no portal do cliente antes de abrir.
-- =====================================================================

alter table public.obras add column if not exists relatorio_pin text;

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
        select jsonb_agg(jsonb_build_object(
          'id', d.id,
          'category', d.category,
          'custom_label', d.custom_label,
          'title', d.title,
          'file_url', case
            when d.category = 'relatorio' and coalesce(o.relatorio_pin, '') <> '' then null
            else d.file_url
          end,
          'file_type', d.file_type,
          'requires_signature', d.requires_signature,
          'signature_url', d.signature_url,
          'signed_at', d.signed_at,
          'signed_by', d.signed_by,
          'signed_cpf', d.signed_cpf,
          'signature_status', d.signature_status,
          'created_at', d.created_at,
          'locked', (d.category = 'relatorio' and coalesce(o.relatorio_pin, '') <> '')
        ) order by d.created_at desc)
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

create or replace function public.portal_open_document(
  p_token text,
  p_doc_id uuid,
  p_pin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_doc record;
begin
  select client_id into v_client from public.portal_resolve_session(p_token);
  if v_client is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;

  select d.id, d.category, d.file_url, o.client_id as owner_client_id, o.relatorio_pin
  into v_doc
  from public.obra_documents d
  join public.obras o on o.id = d.obra_id
  where d.id = p_doc_id;

  if v_doc.id is null or v_doc.owner_client_id <> v_client then
    return jsonb_build_object('ok', false, 'reason', 'not_allowed');
  end if;

  if v_doc.category = 'relatorio' and coalesce(v_doc.relatorio_pin, '') <> '' then
    if coalesce(trim(p_pin), '') <> v_doc.relatorio_pin then
      return jsonb_build_object('ok', false, 'reason', 'invalid_pin');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'file_url', v_doc.file_url);
end;
$$;

revoke all on function public.portal_open_document(text, uuid, text) from public;
grant execute on function public.portal_open_document(text, uuid, text) to anon, authenticated;


-- =====================================================================
-- 3) add_checklist_link_stable_token.sql
-- LINK PUBLICO DE CHECKLIST PARA DE TROCAR A CADA "Copiar link".
-- =====================================================================

alter table public.checklist_signature_links add column if not exists token text;

create unique index if not exists idx_checklist_signature_links_token
  on public.checklist_signature_links(token)
  where token is not null;

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
  v_existing record;
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

  v_expires_at := now() + make_interval(hours => greatest(coalesce(p_expires_hours, 720), 1));

  select id, token into v_existing
  from public.checklist_signature_links
  where checklist_id = p_checklist_id
    and used_at is null
    and revoked_at is null
    and expires_at > now()
    and token is not null
  order by created_at desc
  limit 1;

  if found then
    update public.checklist_signature_links set expires_at = v_expires_at where id = v_existing.id;
    return jsonb_build_object('token', v_existing.token, 'expires_at', v_expires_at, 'checklist_id', p_checklist_id);
  end if;

  update public.checklist_signature_links
  set revoked_at = now()
  where checklist_id = p_checklist_id
    and used_at is null
    and revoked_at is null;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := public.hash_diary_signature_token(v_token);

  insert into public.checklist_signature_links (checklist_id, token, token_hash, created_by, expires_at)
  values (p_checklist_id, v_token, v_token_hash, v_uid, v_expires_at);

  return jsonb_build_object('token', v_token, 'expires_at', v_expires_at, 'checklist_id', p_checklist_id);
end;
$$;

revoke all on function public.create_checklist_signature_link(uuid, integer) from public;
grant execute on function public.create_checklist_signature_link(uuid, integer) to authenticated;


-- =====================================================================
-- 4) create_satisfaction_survey.sql
-- PESQUISA DE SATISFACAO - link publico sem login
-- =====================================================================

create table if not exists public.satisfaction_survey_links (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamp with time zone not null,
  revoked_at timestamp with time zone,
  last_accessed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

-- "create table if not exists" nao adiciona coluna em tabela que ja existe
-- (ex: de uma tentativa anterior) — por isso o token entra via alter table,
-- nao dentro do create table.
alter table public.satisfaction_survey_links add column if not exists token text;

create index if not exists idx_satisfaction_survey_links_obra_id on public.satisfaction_survey_links(obra_id);
create index if not exists idx_satisfaction_survey_links_expires_at on public.satisfaction_survey_links(expires_at);
create unique index if not exists idx_satisfaction_survey_links_token
  on public.satisfaction_survey_links(token)
  where token is not null;

alter table public.satisfaction_survey_links enable row level security;

drop policy if exists "satisfaction_survey_links_select_admin" on public.satisfaction_survey_links;
create policy "satisfaction_survey_links_select_admin"
  on public.satisfaction_survey_links
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "satisfaction_survey_links_insert_admin" on public.satisfaction_survey_links;
create policy "satisfaction_survey_links_insert_admin"
  on public.satisfaction_survey_links
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "satisfaction_survey_links_update_admin" on public.satisfaction_survey_links;
create policy "satisfaction_survey_links_update_admin"
  on public.satisfaction_survey_links
  for update to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "satisfaction_survey_links_delete_admin" on public.satisfaction_survey_links;
create policy "satisfaction_survey_links_delete_admin"
  on public.satisfaction_survey_links
  for delete to authenticated
  using (public.is_admin(auth.uid()));

create table if not exists public.satisfaction_survey_responses (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.satisfaction_survey_links(id) on delete set null,
  obra_id uuid not null references public.obras(id) on delete cascade,
  empresa text,
  obra_nome text,
  data_referencia date,
  ratings jsonb not null default '{}'::jsonb,
  avaliacao_geral integer,
  nps integer,
  comentario_agradou text,
  comentario_melhorar text,
  comentario_observacao text,
  created_at timestamp with time zone not null default now()
);

alter table public.satisfaction_survey_responses add column if not exists indicacao_empresas text;

create index if not exists idx_satisfaction_survey_responses_obra_id on public.satisfaction_survey_responses(obra_id);

alter table public.satisfaction_survey_responses enable row level security;

drop policy if exists "satisfaction_survey_responses_select_admin" on public.satisfaction_survey_responses;
create policy "satisfaction_survey_responses_select_admin"
  on public.satisfaction_survey_responses
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "satisfaction_survey_responses_delete_admin" on public.satisfaction_survey_responses;
create policy "satisfaction_survey_responses_delete_admin"
  on public.satisfaction_survey_responses
  for delete to authenticated
  using (public.is_admin(auth.uid()));

create or replace function public.create_satisfaction_survey_link(
  p_obra_id uuid,
  p_expires_hours integer default 720
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existing record;
  v_token text;
  v_token_hash text;
  v_expires_at timestamp with time zone;
begin
  if v_uid is null or not public.is_admin(v_uid) then
    raise exception 'Sem permissao para gerar link de pesquisa';
  end if;

  if not exists (select 1 from public.obras where id = p_obra_id) then
    raise exception 'Obra nao encontrada';
  end if;

  v_expires_at := now() + make_interval(hours => greatest(coalesce(p_expires_hours, 720), 1));

  select id, token into v_existing
  from public.satisfaction_survey_links
  where obra_id = p_obra_id
    and revoked_at is null
    and expires_at > now()
    and token is not null
  order by created_at desc
  limit 1;

  if found then
    update public.satisfaction_survey_links set expires_at = v_expires_at where id = v_existing.id;
    return jsonb_build_object('token', v_existing.token, 'expires_at', v_expires_at, 'obra_id', p_obra_id);
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := public.hash_diary_signature_token(v_token);

  insert into public.satisfaction_survey_links (obra_id, token, token_hash, created_by, expires_at)
  values (p_obra_id, v_token, v_token_hash, v_uid, v_expires_at);

  return jsonb_build_object('token', v_token, 'expires_at', v_expires_at, 'obra_id', p_obra_id);
end;
$$;

create or replace function public.get_satisfaction_survey_for_public_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public.hash_diary_signature_token(p_token);
  v_link record;
begin
  select l.id, l.obra_id, l.expires_at, l.revoked_at
  into v_link
  from public.satisfaction_survey_links l
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

  update public.satisfaction_survey_links set last_accessed_at = now() where id = v_link.id;

  return (
    select jsonb_build_object(
      'valid', true,
      'obra_id', o.id,
      'obra_name', o.name,
      'client_name', cl.name
    )
    from public.obras o
    join public.clients cl on cl.id = o.client_id
    where o.id = v_link.obra_id
  );
end;
$$;

create or replace function public.submit_satisfaction_survey(
  p_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text := public.hash_diary_signature_token(p_token);
  v_link record;
  v_ratings jsonb := coalesce(p_payload->'ratings', '{}'::jsonb);
  v_avaliacao_geral integer := nullif(p_payload->>'avaliacao_geral', '')::integer;
  v_nps integer := nullif(p_payload->>'nps', '')::integer;
  v_required_keys text[] := array[
    'comercial_atendimento', 'comercial_agilidade', 'comercial_clareza',
    'operacional_organizacao_campo', 'operacional_qualidade_execucao', 'operacional_prazos_operacao', 'operacional_atendimento_medicao',
    'documentacao_prazo_entrega', 'documentacao_clareza_relatorios', 'documentacao_atendimento'
  ];
  v_key text;
  v_val integer;
  v_recent integer;
  v_total integer;
begin
  select l.id, l.obra_id, l.expires_at, l.revoked_at
  into v_link
  from public.satisfaction_survey_links l
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

  select count(*) filter (where created_at > now() - interval '20 seconds'),
         count(*)
  into v_recent, v_total
  from public.satisfaction_survey_responses
  where link_id = v_link.id;

  if coalesce(v_recent, 0) > 0 then
    return jsonb_build_object('ok', false, 'reason', 'too_fast');
  end if;
  if coalesce(v_total, 0) >= 200 then
    return jsonb_build_object('ok', false, 'reason', 'link_full');
  end if;

  foreach v_key in array v_required_keys loop
    v_val := nullif(v_ratings->>v_key, '')::integer;
    if v_val is null or v_val < 1 or v_val > 5 then
      return jsonb_build_object('ok', false, 'reason', 'missing_ratings');
    end if;
  end loop;

  if v_avaliacao_geral is null or v_avaliacao_geral < 1 or v_avaliacao_geral > 5 then
    return jsonb_build_object('ok', false, 'reason', 'missing_avaliacao_geral');
  end if;
  if v_nps is null or v_nps < 0 or v_nps > 10 then
    return jsonb_build_object('ok', false, 'reason', 'missing_nps');
  end if;

  insert into public.satisfaction_survey_responses (
    link_id, obra_id, empresa, obra_nome, data_referencia,
    ratings, avaliacao_geral, nps, indicacao_empresas,
    comentario_agradou, comentario_melhorar, comentario_observacao
  ) values (
    v_link.id, v_link.obra_id,
    nullif(trim(coalesce(p_payload->>'empresa', '')), ''),
    nullif(trim(coalesce(p_payload->>'obra_nome', '')), ''),
    nullif(p_payload->>'data_referencia', '')::date,
    v_ratings, v_avaliacao_geral, v_nps,
    nullif(trim(coalesce(p_payload->>'indicacao_empresas', '')), ''),
    nullif(trim(coalesce(p_payload->>'comentario_agradou', '')), ''),
    nullif(trim(coalesce(p_payload->>'comentario_melhorar', '')), ''),
    nullif(trim(coalesce(p_payload->>'comentario_observacao', '')), '')
  );

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.revoke_satisfaction_survey_links(p_obra_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null or not public.is_admin(v_uid) then
    raise exception 'Sem permissao para revogar links desta obra';
  end if;

  update public.satisfaction_survey_links
  set revoked_at = now()
  where obra_id = p_obra_id
    and revoked_at is null;

  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'revoked', v_count);
end;
$$;

revoke all on function public.create_satisfaction_survey_link(uuid, integer) from public;
revoke all on function public.get_satisfaction_survey_for_public_link(text) from public;
revoke all on function public.submit_satisfaction_survey(text, jsonb) from public;
revoke all on function public.revoke_satisfaction_survey_links(uuid) from public;

grant execute on function public.create_satisfaction_survey_link(uuid, integer) to authenticated;
grant execute on function public.get_satisfaction_survey_for_public_link(text) to anon, authenticated;
grant execute on function public.submit_satisfaction_survey(text, jsonb) to anon, authenticated;
grant execute on function public.revoke_satisfaction_survey_links(uuid) to authenticated;

-- =====================================================================
-- 5) rename_pit_profundidade_para_metros.sql
-- PIT: "Profundidade" passa de centimetro para metro. Guardado num DO
-- block que confere se a coluna profundidade_cm ainda existe: se ja
-- rodou antes, pula tudo — sem isso, rodar de novo dividiria os valores
-- por 100 outra vez.
-- =====================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_diaries_pit_piles'
      and column_name = 'profundidade_cm'
  ) then
    alter table public.work_diaries_pit_piles rename column profundidade_cm to profundidade_m;
    update public.work_diaries_pit_piles
    set profundidade_m = round(profundidade_m / 100.0, 2)
    where profundidade_m is not null;
  end if;
end $$;

-- =====================================================================
-- FIM. Se rodou sem erro, pode conferir: gera um link de pesquisa numa
-- obra pelo Portal do Cliente e testa.
-- =====================================================================
