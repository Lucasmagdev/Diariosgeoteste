const JSON_HEADERS = { 'Content-Type': 'application/json' };
const DEFAULT_PIT_URL = 'https://mphomlxniavqmvxhacii.supabase.co';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: JSON_HEADERS,
});

const env = (name) => Netlify.env.get(name)?.trim();

const nextDate = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + 86_400_000).toISOString().slice(0, 10);
};

const storageObjectPath = (path) => path.split('/').map(encodeURIComponent).join('/');

const absoluteSignedUrl = (pitUrl, signedUrl) => {
  if (/^https?:\/\//i.test(signedUrl)) return signedUrl;
  if (signedUrl.startsWith('/storage/v1/')) return `${pitUrl}${signedUrl}`;
  if (signedUrl.startsWith('/object/')) return `${pitUrl}/storage/v1${signedUrl}`;
  return `${pitUrl}/storage/v1/${signedUrl.replace(/^\//, '')}`;
};

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

  const date = typeof body?.date === 'string' ? body.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    return json({ error: 'Informe uma data válida no diário antes de sincronizar.' }, 400);
  }

  const params = new URLSearchParams({
    select: 'id,nome_original,pasta_origem,criado_no_equipamento,storage_path',
    criado_no_equipamento: `gte.${date}T00:00:00-03:00`,
    order: 'criado_no_equipamento.asc',
  });
  params.append('criado_no_equipamento', `lt.${nextDate(date)}T00:00:00-03:00`);

  try {
    const listResponse = await fetch(`${pitUrl}/rest/v1/ensaios?${params}`, {
      headers: { apikey: pitServiceKey, Authorization: `Bearer ${pitServiceKey}` },
    });
    if (!listResponse.ok) throw new Error(`Consulta dos ensaios retornou ${listResponse.status}.`);
    const rows = await listResponse.json();

    const ensaios = await Promise.all(rows.map(async (row) => {
      const signResponse = await fetch(
        `${pitUrl}/storage/v1/object/sign/ensaios/${storageObjectPath(row.storage_path)}`,
        {
          method: 'POST',
          headers: {
            apikey: pitServiceKey,
            Authorization: `Bearer ${pitServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expiresIn: 300 }),
        },
      );
      if (!signResponse.ok) throw new Error(`Não foi possível autorizar o download de ${row.nome_original}.`);
      const signed = await signResponse.json();
      const signedUrl = signed.signedURL || signed.signedUrl;
      if (!signedUrl) throw new Error(`URL de download ausente para ${row.nome_original}.`);

      return {
        id: row.id,
        nomeOriginal: row.nome_original,
        pastaOrigem: row.pasta_origem,
        criadoNoEquipamento: row.criado_no_equipamento,
        downloadUrl: absoluteSignedUrl(pitUrl, signedUrl),
      };
    }));

    return json({ ensaios });
  } catch (error) {
    console.error('Falha na sincronização dos ensaios PIT:', error);
    return json({ error: 'Não foi possível buscar os ensaios enviados pelo PIT.' }, 502);
  }
};
