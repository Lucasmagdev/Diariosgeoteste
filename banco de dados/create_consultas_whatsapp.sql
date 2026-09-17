-- =====================================================================
-- MODULO COMERCIAL 6: Consultas recebidas via WhatsApp (Evolution API)
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

create table if not exists public.consultas_whatsapp (
  id uuid primary key default gen_random_uuid(),
  numero_contato text not null,
  nome_contato text,
  primeira_mensagem text,
  data_recebimento timestamp with time zone not null default now(),
  origem text,                    -- preenchido manual por enquanto; cruza com o tracking de head depois
  qualificada boolean,            -- null = ainda nao avaliada
  motivo_desqualificacao text,
  obra_id uuid references public.obras(id) on delete set null,
  proposta_id uuid references public.propostas(id) on delete set null,
  evolution_instance text,
  evolution_message_id text,      -- dedupe contra retry/reentrega do webhook
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists idx_consultas_whatsapp_message_id
  on public.consultas_whatsapp (evolution_message_id)
  where evolution_message_id is not null;

create index if not exists idx_consultas_whatsapp_numero on public.consultas_whatsapp(numero_contato);
create index if not exists idx_consultas_whatsapp_data on public.consultas_whatsapp(data_recebimento);
create index if not exists idx_consultas_whatsapp_qualificada on public.consultas_whatsapp(qualificada);

alter table public.consultas_whatsapp enable row level security;

drop policy if exists "consultas_whatsapp_select" on public.consultas_whatsapp;
create policy "consultas_whatsapp_select" on public.consultas_whatsapp
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "consultas_whatsapp_insert" on public.consultas_whatsapp;
create policy "consultas_whatsapp_insert" on public.consultas_whatsapp
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "consultas_whatsapp_update" on public.consultas_whatsapp;
create policy "consultas_whatsapp_update" on public.consultas_whatsapp
  for update to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "consultas_whatsapp_delete" on public.consultas_whatsapp;
create policy "consultas_whatsapp_delete" on public.consultas_whatsapp
  for delete to authenticated
  using (public.is_admin(auth.uid()));

drop trigger if exists set_consultas_whatsapp_updated_at on public.consultas_whatsapp;
create trigger set_consultas_whatsapp_updated_at
  before update on public.consultas_whatsapp
  for each row
  execute function public.set_updated_at();
