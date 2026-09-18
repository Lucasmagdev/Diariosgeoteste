alter table public.propostas
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;
