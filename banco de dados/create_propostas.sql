-- =====================================================================
-- PROPOSTAS COMERCIAIS
-- Historico de propostas enviadas (PIT/PDA/PCE/PLACA/HAMMER), autopreenchidas
-- a partir do PDF padrao da proposta ou cadastradas manualmente.
-- Alimenta o dashboard de valores por modalidade/periodo/localidade e a
-- taxa de conversao (aceita vs enviada) por modalidade.
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  numero text,                          -- ex: "16012026N0034" (numero do PDF)
  revisao text,                         -- ex: "Rev01"
  modalidade text not null check (modalidade in ('PIT','PDA','PCE','PLACA','HAMMER')),
  cliente_nome text not null,
  cliente_cnpj text,
  obra_id uuid references public.obras(id) on delete set null,
  obra_nome text,
  endereco_obra text,
  cidade text,
  uf text,
  contato_nome text,
  contato_telefone text,
  responsavel_comercial text,
  contato_comercial text,
  sondagem text,
  projeto_fundacoes text,
  validade_dias integer,
  valor_total numeric(14,2),
  valor_entrada numeric(14,2),
  periodicidade_medicao text,
  prazo_pagamento_dias integer,
  data_proposta date,
  status text not null default 'enviada' check (status in ('enviada','aceita','recusada')),
  motivo_recusa text,
  itens jsonb,                          -- snapshot das linhas do orcamento extraidas do PDF
  arquivo_nome text,                    -- nome original do PDF anexado
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_propostas_modalidade on public.propostas(modalidade);
create index if not exists idx_propostas_status on public.propostas(status);
create index if not exists idx_propostas_data on public.propostas(data_proposta);
create index if not exists idx_propostas_cidade on public.propostas(cidade);
create index if not exists idx_propostas_obra_id on public.propostas(obra_id);

alter table public.propostas enable row level security;

drop policy if exists "propostas_select" on public.propostas;
create policy "propostas_select" on public.propostas
  for select to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "propostas_insert" on public.propostas;
create policy "propostas_insert" on public.propostas
  for insert to authenticated
  with check (public.is_admin(auth.uid()));

drop policy if exists "propostas_update" on public.propostas;
create policy "propostas_update" on public.propostas
  for update to authenticated
  using (public.is_admin(auth.uid()));

drop policy if exists "propostas_delete" on public.propostas;
create policy "propostas_delete" on public.propostas
  for delete to authenticated
  using (public.is_admin(auth.uid()));

drop trigger if exists set_propostas_updated_at on public.propostas;
create trigger set_propostas_updated_at
  before update on public.propostas
  for each row
  execute function public.set_updated_at();
