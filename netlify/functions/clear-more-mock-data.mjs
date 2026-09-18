// Ferramenta TEMPORARIA — limpa o resto dos dados mock: campos de
// acompanhamento (prazo/valor) que eu preenchi em 4 obras REAIS (volta
// pra null, nao apaga a obra), pausas de obra (só existiam por causa do
// mock) e todas as visitas comerciais (mock puro). Roda uma vez,
// deletada em seguida.
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const env = (name) => Netlify.env.get(name)?.trim();

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (body.confirm !== 'clear-more-mock-data') return json({ error: 'Confirmação ausente.' }, 400);

  const supabaseUrl = env('VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Sem credenciais no servidor.' }, 503);

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  try {
    const obraCodes = ['G26088', 'G26064', 'G26094', 'G26081'];
    const resetResults = [];
    for (const code of obraCodes) {
      const res = await fetch(`${supabaseUrl}/rest/v1/obras?obra_code=eq.${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          data_inicio: null,
          data_previsao_fim: null,
          data_fim_real: null,
          valor_inicial: null,
          valor_final: null,
          motivo_encerramento: null,
        }),
      });
      const data = await res.json().catch(() => null);
      resetResults.push({ obra_code: code, ok: res.ok, rows: Array.isArray(data) ? data.length : 0 });
    }

    const pausasRes = await fetch(`${supabaseUrl}/rest/v1/obra_pausas?id=not.is.null`, { method: 'DELETE', headers });
    const pausasData = await pausasRes.json().catch(() => null);
    const pausasDeleted = Array.isArray(pausasData) ? pausasData.length : 0;

    const visitasRes = await fetch(`${supabaseUrl}/rest/v1/visitas_tecnicas?id=not.is.null`, { method: 'DELETE', headers });
    const visitasData = await visitasRes.json().catch(() => null);
    const visitasDeleted = Array.isArray(visitasData) ? visitasData.length : 0;

    return json({ ok: true, obras_resetadas: resetResults, pausas_deletadas: pausasDeleted, visitas_deletadas: visitasDeleted });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
};
