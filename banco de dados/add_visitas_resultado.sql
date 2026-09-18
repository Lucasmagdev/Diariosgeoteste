-- =====================================================================
-- Visitas Comerciais: resultado da visita (pendente/fechado/perdido),
-- pra medir taxa de fechamento. Execute no SQL Editor do Supabase.
-- =====================================================================

alter table public.visitas_tecnicas
  add column if not exists resultado text not null default 'pendente'
  check (resultado in ('pendente', 'fechado', 'perdido'));

create index if not exists idx_visitas_tecnicas_resultado on public.visitas_tecnicas(resultado);
