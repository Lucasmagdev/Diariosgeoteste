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
where id::text ilike '7ca02ffe%'
  and client_name = 'ALVES RIBEIRO'
  and date = '2026-08-12';

-- =====================================================================
-- PASSO 2 — se a linha acima for exatamente essa (Vivian Damasceno,
-- 12/08/2026), rode o bloco abaixo. Ele so mexe se achar UMA linha so;
-- se achar 0 ou mais de 1, cancela sozinho sem tocar em nada.
-- =====================================================================
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.work_diaries
  where id::text ilike '7ca02ffe%'
    and client_name = 'ALVES RIBEIRO'
    and date = '2026-08-12';

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
  where id::text ilike '7ca02ffe%'
    and client_name = 'ALVES RIBEIRO'
    and date = '2026-08-12';

  raise notice 'Diario reaberto para assinatura.';
end $$;
