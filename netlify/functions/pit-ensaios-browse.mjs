// Lista os ensaios enviados pelo SincroPIT, sem filtro de data obrigatorio
// e sem assinar download de cada linha (isso so acontece na hora que o
// usuario clica em baixar — ver pit-ensaio-signal.mjs). Serve a aba
// "Ensaios PIT", que e so pra navegar/conferir o que foi enviado.
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const DEFAULT_PIT_URL = 'https://mphomlxniavqmvxhacii.supabase.co';
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: JSON_HEADERS,
});

const env = (name) => Netlify.env.get(name)?.trim();

const nextDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + 86_400_000).toISOString().slice(0, 10);
};

const isValidDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`));

// Escapa caracteres que quebrariam o padrao PostgREST ilike/or (vírgula e
// parênteses tem significado especial dentro de `or=(...)`).
const escapeIlike = (value) => value.replace(/[,()]/g, ' ').trim();

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const diarioUrl = env('VITE_SUPABASE_URL');
  const diarioAnonKey = env('VITE_SUPABASE_ANON_KEY');
  const pitUrl = env('PIT_SUPABASE_URL') || DEFAULT_PIT_URL;
  const pitServiceKey = env('PIT_SUPABASE_SERVICE_ROLE_KEY');
  if (!diarioUrl || !diarioAnonKey || !pitServiceKey) {
    return json({ error: 'A sincronização do PIT ainda não foi configurada no servidor.' }, 503);
  }

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão não informada.' }, 401);

  const authResponse = await fetch(`${diarioUrl}/auth/v1/user`, {
    headers: { apikey: diarioAnonKey, Authorization: authorization },
  });
  if (!authResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Solicitação inválida.' }, 400);
  }

  const search = typeof body?.search === 'string' ? escapeIlike(body.search) : '';
  const dateFrom = typeof body?.dateFrom === 'string' ? body.dateFrom : '';
  const dateTo = typeof body?.dateTo === 'string' ? body.dateTo : '';
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isFinite(body?.limit) ? Number(body.limit) : DEFAULT_LIMIT));
  const offset = Math.max(0, Number.isFinite(body?.offset) ? Number(body.offset) : 0);

  if (dateFrom && !isValidDate(dateFrom)) return json({ error: 'Data inicial inválida.' }, 400);
  if (dateTo && !isValidDate(dateTo)) return json({ error: 'Data final inválida.' }, 400);

  const params = new URLSearchParams({
    select: 'id,nome_original,pasta_origem,criado_no_equipamento',
    order: 'criado_no_equipamento.desc',
    limit: String(limit),
    offset: String(offset),
  });
  if (dateFrom) params.append('criado_no_equipamento', `gte.${dateFrom}T00:00:00-03:00`);
  if (dateTo) params.append('criado_no_equipamento', `lt.${nextDate(dateTo)}T00:00:00-03:00`);
  if (search) params.set('or', `(nome_original.ilike.*${search}*,pasta_origem.ilike.*${search}*)`);

  try {
    const listResponse = await fetch(`${pitUrl}/rest/v1/ensaios?${params}`, {
      headers: {
        apikey: pitServiceKey,
        Authorization: `Bearer ${pitServiceKey}`,
        Prefer: 'count=exact',
      },
    });
    if (!listResponse.ok) throw new Error(`Consulta dos ensaios retornou ${listResponse.status}.`);
    const rows = await listResponse.json();

    const contentRange = listResponse.headers.get('content-range') || '';
    const total = Number(contentRange.split('/')[1]) || rows.length;

    const ensaios = rows.map((row) => ({
      id: row.id,
      nomeOriginal: row.nome_original,
      pastaOrigem: row.pasta_origem,
      criadoNoEquipamento: row.criado_no_equipamento,
    }));

    return json({ ensaios, total, limit, offset });
  } catch (error) {
    console.error('Falha ao listar ensaios PIT:', error);
    return json({ error: 'Não foi possível listar os ensaios enviados pelo PIT.' }, 502);
  }
};
