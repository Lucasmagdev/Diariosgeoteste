-- =====================================================================
-- Permite usuario comum (nao-admin) cadastrar novos usuarios (role 'user').
-- Fecha de vez a escalada de privilegio: sem isso, profiles_self_update
-- deixava qualquer usuario autenticado trocar o proprio role para 'admin'
-- via update direto na tabela.
-- Execute no SQL Editor do Supabase.
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
