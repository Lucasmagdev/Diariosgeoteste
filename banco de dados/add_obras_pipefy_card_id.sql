-- =====================================================================
-- Guarda o id do card do Pipefy (pipe "02-Gestao de Obras - Geoteste")
-- que originou a obra, pra nao duplicar se o Pipefy reenviar o mesmo
-- webhook (acontece: retry de rede, reprocessamento manual etc).
-- =====================================================================

alter table public.obras add column if not exists pipefy_card_id text;

create unique index if not exists idx_obras_pipefy_card_id
  on public.obras (pipefy_card_id)
  where pipefy_card_id is not null;
