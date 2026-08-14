-- =====================================================================
-- PIT: "Profundidade" passa de centimetro para metro (PCE e PDA ja
-- guardavam em metro; so o PIT ficou em cm). Renomeia a coluna e
-- converte os valores existentes dividindo por 100, uma unica vez.
--
-- Guardado num DO block que confere se a coluna profundidade_cm ainda
-- existe: se ja rodou antes (coluna ja virou profundidade_m), pula tudo
-- — sem isso, rodar de novo dividiria os valores por 100 outra vez.
-- Execute no SQL Editor do Supabase apos create_work_diaries_pit.sql.
-- =====================================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_diaries_pit_piles'
      and column_name = 'profundidade_cm'
  ) then
    alter table public.work_diaries_pit_piles rename column profundidade_cm to profundidade_m;
    update public.work_diaries_pit_piles
    set profundidade_m = round(profundidade_m / 100.0, 2)
    where profundidade_m is not null;
  end if;
end $$;
