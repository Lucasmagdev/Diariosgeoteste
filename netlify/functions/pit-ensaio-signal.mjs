// Reassina o download de UM ensaio ja importado, pelo id salvo na estaca.
// O link assinado que a sincronizacao devolve (pit-ensaios.mjs) expira em
// 5 minutos — inutil pra baixar o sinal dias depois, com o diario ja
// salvo. Esta funcao busca o storage_path pelo id e assina um link novo,
// na hora.
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const DEFAULT_PIT_URL = 'https://mphomlxniavqmvxhacii.supabase.co';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: JSON_HEADERS,
});

const env = (name) => Netlify.env.get(name)?.trim();

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

  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!id) return json({ error: 'Informe o id do ensaio.' }, 400);

  try {
    const params = new URLSearchParams({ select: 'id,nome_original,storage_path', id: `eq.${id}` });
    const rowResponse = await fetch(`${pitUrl}/rest/v1/ensaios?${params}`, {
      headers: { apikey: pitServiceKey, Authorization: `Bearer ${pitServiceKey}` },
    });
    if (!rowResponse.ok) throw new Error(`Consulta do ensaio retornou ${rowResponse.status}.`);
    const rows = await rowResponse.json();
    const row = rows[0];
    if (!row) return json({ error: 'Ensaio não encontrado (pode ter sido removido na origem).' }, 404);

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

    return json({
      downloadUrl: absoluteSignedUrl(pitUrl, signedUrl),
      nomeOriginal: row.nome_original,
    });
  } catch (error) {
    console.error('Falha ao gerar link do sinal PIT:', error);
    return json({ error: 'Não foi possível gerar o link de download do sinal.' }, 502);
  }
};
