-- =====================================================================
-- Guarda o id do ensaio de origem (projeto PIT, tabela ensaios) em cada
-- estaca importada por sincronizacao. Sem isso o app esquece qual
-- arquivo .PTE bruto gerou aquela estaca assim que a edicao fecha —
-- o id so vivia em memoria do formulario (pitSync.ts), nunca era salvo.
-- Necessario pro botao "Baixar sinal" (grafico/PTE bruto) funcionar
-- depois que o diario ja foi salvo.
-- =====================================================================

alter table public.work_diaries_pit_piles add column if not exists ensaio_origem_id text;
