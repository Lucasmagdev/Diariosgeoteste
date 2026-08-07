-- =====================================================================
-- LINK PUBLICO DE CHECKLIST PARA DE TROCAR A CADA "Copiar link".
-- Ate aqui, create_checklist_signature_link gerava um token novo e
-- revogava o anterior a cada clique — se o admin clicasse 2x (ou
-- reenviasse), o link ja mandado pro cliente morria sem aviso.
-- Agora: se ja existe um link ativo (nao revogado, nao expirado, nao
-- usado) pro checklist, ele e devolvido de novo — mesmo token, so com
-- a validade renovada. Um link novo so nasce quando o anterior foi
-- revogado, expirou, ou o checklist ja foi assinado.
-- Execute no SQL Editor do Supabase apos add_checklist_public_link.sql.
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

  -- ja existe link ativo com token conhecido? renova a validade e devolve o mesmo.
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
