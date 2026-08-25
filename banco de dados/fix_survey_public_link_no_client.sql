-- =====================================================================
-- FIX: link publico de pesquisa dava "Link invalido" quando a obra nao
-- tinha cliente vinculado (caso do novo "Link rapido" em Pesquisas, que
-- cria a obra so com o nome da empresa, sem client_id). A funcao usava
-- inner join com clients — sem cliente, o join nao acha linha nenhuma e
-- a funcao retorna null, que o front trata como link invalido.
-- Troca pra left join: client_name fica null quando nao tem cliente, e
-- o link funciona normalmente.
-- =====================================================================

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
    left join public.clients cl on cl.id = o.client_id
    where o.id = v_link.obra_id
  );
end;
$$;
