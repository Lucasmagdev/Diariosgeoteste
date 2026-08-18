-- =====================================================================
-- ACAO PONTUAL, NAO E MIGRATION: reabre pra assinatura o diario PIT de
-- ALVES RIBEIRO / 12/08/2026 (ID 7CA02FFE no rodape do PDF), assinado
-- por Vivian Damasceno. Motivo: cliente pediu pra revisar antes de
-- valer como assinado.
--
-- Nao roda dentro de rodar-tudo-pendente.sql de proposito — isso aqui
-- mexe num registro real e especifico, nao e algo pra rodar de novo.
--
-- PASSO 1 — rode isso sozinho primeiro e confira se é exatamente
-- o diario certo antes de continuar:
-- =====================================================================
select id, client_name, date, start_time, end_time,
       responsible_signed_by, responsible_signed_cpf, responsible_signed_at, signature_status
from public.work_diaries
where id = '7ca02ffe-77f0-43b8-a050-a40975899b8c';

-- =====================================================================
-- PASSO 2 — id completo confirmado via diagnostico
-- (banco de dados/diagnostico_diario_7ca02ffe.sql): client_name
-- "ALVES RIBEIRO", date real 2026-08-13 (o PDF mostra 12/08 por causa
-- do mesmo bug de fuso ja corrigido em outro lugar do app), assinado
-- por Vivian Damasceno. Usa o id completo agora, entao a trava de
-- seguranca abaixo e so redundancia — mas fica.
-- =====================================================================
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.work_diaries
  where id = '7ca02ffe-77f0-43b8-a050-a40975899b8c';

  if v_count <> 1 then
    raise exception 'Esperava achar exatamente 1 diario, achou %. Nada foi alterado.', v_count;
  end if;

  update public.work_diaries
  set responsible_signature = 'Assinatura externa (GOV.BR)',
      responsible_signature_url = null,
      responsible_signed_at = null,
      responsible_signed_by = null,
      responsible_signed_cpf = null,
      signature_status = 'pending'
  where id = '7ca02ffe-77f0-43b8-a050-a40975899b8c';

  raise notice 'Diario reaberto para assinatura.';
end $$;
