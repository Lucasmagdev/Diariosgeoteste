-- =====================================================================
-- PESQUISA DE SATISFACAO - link publico sem login (mesmo padrao do
-- checklist: admin gera o link pelo Portal, cliente abre e responde
-- direto, sem precisar logar). Execute no SQL Editor do Supabase.
-- Reaproveita public.hash_diary_signature_token e public.is_admin,
-- ja criados por create_public_diary_signature_links.sql.
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

create index if not exists idx_satisfaction_survey_links_obra_id on public.satisfaction_survey_links(obra_id);
create index if not exists idx_satisfaction_survey_links_expires_at on public.satisfaction_survey_links(expires_at);

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

-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Admin gera o link da pesquisa para uma obra
-- ---------------------------------------------------------------------
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

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := public.hash_diary_signature_token(v_token);
  v_expires_at := now() + make_interval(hours => greatest(coalesce(p_expires_hours, 720), 1));

  insert into public.satisfaction_survey_links (obra_id, token_hash, created_by, expires_at)
  values (p_obra_id, v_token_hash, v_uid, v_expires_at);

  return jsonb_build_object('token', v_token, 'expires_at', v_expires_at, 'obra_id', p_obra_id);
end;
$$;

-- ---------------------------------------------------------------------
-- Cliente abre o link (sem login): retorna nome da obra/cliente p/ header
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Cliente envia a resposta (sem login), token e a autenticacao.
-- Link nao expira apos uso: varias pessoas da mesma empresa podem
-- responder pelo mesmo link ate ele expirar ou ser revogado.
-- ---------------------------------------------------------------------
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
    'operacional_prazos', 'operacional_organizacao_campo', 'operacional_qualidade_execucao', 'operacional_organizacao_operacao',
    'documentacao_prazo_entrega', 'documentacao_clareza_relatorios', 'documentacao_atendimento'
  ];
  v_key text;
  v_val integer;
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
    ratings, avaliacao_geral, nps,
    comentario_agradou, comentario_melhorar, comentario_observacao
  ) values (
    v_link.id, v_link.obra_id,
    nullif(trim(coalesce(p_payload->>'empresa', '')), ''),
    nullif(trim(coalesce(p_payload->>'obra_nome', '')), ''),
    nullif(p_payload->>'data_referencia', '')::date,
    v_ratings, v_avaliacao_geral, v_nps,
    nullif(trim(coalesce(p_payload->>'comentario_agradou', '')), ''),
    nullif(trim(coalesce(p_payload->>'comentario_melhorar', '')), ''),
    nullif(trim(coalesce(p_payload->>'comentario_observacao', '')), '')
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.create_satisfaction_survey_link(uuid, integer) from public;
revoke all on function public.get_satisfaction_survey_for_public_link(text) from public;
revoke all on function public.submit_satisfaction_survey(text, jsonb) from public;

grant execute on function public.create_satisfaction_survey_link(uuid, integer) to authenticated;
grant execute on function public.get_satisfaction_survey_for_public_link(text) to anon, authenticated;
grant execute on function public.submit_satisfaction_survey(text, jsonb) to anon, authenticated;
