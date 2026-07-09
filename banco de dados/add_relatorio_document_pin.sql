-- =====================================================================
-- PIN POR ARQUIVO DE RELATORIO NO PORTAL DO CLIENTE
-- Cada documento da categoria 'relatorio' pode ter seu proprio PIN.
-- Se o PIN estiver preenchido, o portal oculta file_url ate o cliente
-- informar o PIN correto para aquele documento especifico.
-- =====================================================================

alter table public.obra_documents add column if not exists relatorio_pin text;
alter table public.obras add column if not exists relatorio_pin text;

-- Compatibilidade: se o PIN antigo foi configurado na obra, aplica aos
-- relatorios existentes que ainda nao tem PIN proprio.
update public.obra_documents d
set relatorio_pin = o.relatorio_pin
from public.obras o
where d.obra_id = o.id
  and d.category = 'relatorio'
  and coalesce(d.relatorio_pin, '') = ''
  and coalesce(o.relatorio_pin, '') <> '';

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
            when d.category = 'relatorio' and coalesce(d.relatorio_pin, '') <> '' then null
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
          'locked', (d.category = 'relatorio' and coalesce(d.relatorio_pin, '') <> '')
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

  select d.id, d.category, d.file_url, d.relatorio_pin, o.client_id as owner_client_id
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
