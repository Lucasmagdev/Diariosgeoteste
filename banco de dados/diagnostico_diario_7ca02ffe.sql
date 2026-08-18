-- Diagnostico: so pelo prefixo do id, sem os outros filtros, pra ver
-- o que realmente esta gravado (client_name exato, date exata).
select id, client_name, date, start_time, end_time,
       responsible_signed_by, responsible_signed_cpf, responsible_signed_at, signature_status
from public.work_diaries
where id::text ilike '7ca02ffe%';
