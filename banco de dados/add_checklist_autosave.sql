-- =====================================================================
-- AUTOSAVE DE PROGRESSO DO CHECKLIST (portal com login)
-- Cliente marca item -> salva na hora. Se sair e voltar, continua de
-- onde parou. Nao mexe em status/assinatura, so nos itens.
-- Execute no SQL Editor do Supabase apos create_checklists.sql.
-- =====================================================================

create or replace function public.portal_save_checklist_progress(
  p_token text,
  p_checklist_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_owner uuid;
  v_status text;
  v_item jsonb;
begin
  select client_id into v_client from public.portal_resolve_session(p_token);
  if v_client is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
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
    set checked = coalesce((v_item->>'checked')::boolean, checked),
        photo_data = coalesce(v_item->>'photo_data', photo_data),
        note = coalesce(v_item->>'note', note)
    where id = (v_item->>'id')::uuid and checklist_id = p_checklist_id;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.portal_save_checklist_progress(text, uuid, jsonb) from public;
grant execute on function public.portal_save_checklist_progress(text, uuid, jsonb) to anon, authenticated;
