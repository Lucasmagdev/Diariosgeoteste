// Ferramenta TEMPORARIA — limpa os dados mock de Propostas/Concorrência/
// Licitações (mesma tabela propostas) e Consultas WhatsApp, pra começar
// a usar dado real. Roda uma vez, deletada logo em seguida.
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const env = (name) => Netlify.env.get(name)?.trim();

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (body.confirm !== 'clear-commercial-data') return json({ error: 'Confirmação ausente.' }, 400);

  const supabaseUrl = env('VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Sem credenciais no servidor.' }, 503);

  const del = async (table) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?id=not.is.null`, {
      method: 'DELETE',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=representation',
      },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${table}: ${res.status} ${JSON.stringify(data)}`);
    return Array.isArray(data) ? data.length : 0;
  };

  try {
    const propostas = await del('propostas');
    const consultas = await del('consultas_whatsapp');
    return json({ ok: true, deleted: { propostas, consultas_whatsapp: consultas } });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
};
