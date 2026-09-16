-- =====================================================================
-- MODULOS COMERCIAIS 4/5/7/8: Concorrencia, Licitacoes, Visitas Tecnicas
-- e Acompanhamento de Obra.
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 4) e 5) CONCORRENCIA e LICITACOES — campos extras em cima de propostas.
-- "Concorrencia" e so um filtro/visao de propostas com concorrentes
-- lancados; "Licitacoes" e um filtro/visao de propostas com
-- eh_licitacao = true, com os campos proprios de processo licitatorio.
-- ---------------------------------------------------------------------
alter table public.propostas add column if not exists eh_licitacao boolean not null default false;
alter table public.propostas add column if not exists concorrentes text;
alter table public.propostas add column if not exists orgao_licitante text;
alter table public.propostas add column if not exists numero_processo text;
alter table public.propostas add column if not exists data_abertura date;

create index if not exists idx_propostas_eh_licitacao on public.propostas(eh_licitacao);

-- ---------------------------------------------------------------------
-- 7) VISITAS TECNICAS
-- ---------------------------------------------------------------------
create table if not exists public.visitas_tecnicas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references public.obras(id) on delete set null,
  obra_nome text,
  numero text,
  engenheiro_responsavel text not null,
  data_visita date not null,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_visitas_tecnicas_obra_id on public.visitas_tecnicas(obra_id);
create index if not exists idx_visitas_tecnicas_data on public.visitas_tecnicas(data_visita);

alter table public.visitas_tecnicas enable row level security;

drop policy if exists "visitas_tecnicas_select" on public.visitas_tecnicas;
create policy "visitas_tecnicas_select" on public.visitas_tecnicas
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "visitas_tecnicas_insert" on public.visitas_tecnicas;
create policy "visitas_tecnicas_insert" on public.visitas_tecnicas
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "visitas_tecnicas_update" on public.visitas_tecnicas;
create policy "visitas_tecnicas_update" on public.visitas_tecnicas
  for update to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "visitas_tecnicas_delete" on public.visitas_tecnicas;
create policy "visitas_tecnicas_delete" on public.visitas_tecnicas
  for delete to authenticated
  using (public.is_admin(auth.uid()));

drop trigger if exists set_visitas_tecnicas_updated_at on public.visitas_tecnicas;
create trigger set_visitas_tecnicas_updated_at
  before update on public.visitas_tecnicas
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 8) ACOMPANHAMENTO DE OBRA — prazo, pausas e fechamento financeiro.
-- ---------------------------------------------------------------------
alter table public.obras add column if not exists data_inicio date;
alter table public.obras add column if not exists data_previsao_fim date;
alter table public.obras add column if not exists data_fim_real date;
alter table public.obras add column if not exists valor_inicial numeric(14,2);
alter table public.obras add column if not exists valor_final numeric(14,2);
alter table public.obras add column if not exists motivo_encerramento text;

create table if not exists public.obra_pausas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  data_inicio date not null,
  data_fim date,
  motivo text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_obra_pausas_obra_id on public.obra_pausas(obra_id);

alter table public.obra_pausas enable row level security;

drop policy if exists "obra_pausas_select" on public.obra_pausas;
create policy "obra_pausas_select" on public.obra_pausas
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "obra_pausas_insert" on public.obra_pausas;
create policy "obra_pausas_insert" on public.obra_pausas
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "obra_pausas_update" on public.obra_pausas;
create policy "obra_pausas_update" on public.obra_pausas
  for update to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "obra_pausas_delete" on public.obra_pausas;
create policy "obra_pausas_delete" on public.obra_pausas
  for delete to authenticated
  using (public.is_admin(auth.uid()));
