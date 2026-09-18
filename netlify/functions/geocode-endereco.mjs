// Geocodifica um endereco de obra (texto livre) em cidade/UF/lat/lon,
// usando o Nominatim (OpenStreetMap) — mesmo provedor ja usado pros tiles
// do mapa, sem precisar de chave paga. Fica no servidor (nao no navegador)
// porque o Nominatim exige um User-Agent identificado por app, algo que o
// fetch do navegador nao deixa a gente definir.
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: JSON_HEADERS,
});

const env = (name) => Netlify.env.get(name)?.trim();

// Nominatim devolve o nome cheio do estado ("Rio de Janeiro"), nao a sigla
// que o resto do app usa (RJ) pra plotar no mapa e agrupar por regiao.
const ESTADO_NOME_PARA_UF = {
  'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA',
  'ceara': 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', 'goias': 'GO',
  'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
  'para': 'PA', 'paraiba': 'PB', 'parana': 'PR', 'pernambuco': 'PE', 'piaui': 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
  'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP',
  'sergipe': 'SE', 'tocantins': 'TO',
};

const normalizar = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

const ufFromEstadoNome = (nome) => ESTADO_NOME_PARA_UF[normalizar(nome)] || null;

export default async (request) => {
  const diarioUrl = env('VITE_SUPABASE_URL');
  const diarioAnonKey = env('VITE_SUPABASE_ANON_KEY');
  if (!diarioUrl || !diarioAnonKey) return json({ error: 'Integração não configurada no servidor.' }, 503);

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão não informada.' }, 401);
  const authResponse = await fetch(`${diarioUrl}/auth/v1/user`, {
    headers: { apikey: diarioAnonKey, Authorization: authorization },
  });
  if (!authResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401);

  let endereco = '';
  try {
    const body = await request.json();
    endereco = (body?.endereco || '').trim();
  } catch {
    return json({ error: 'Corpo da requisição inválido.' }, 400);
  }
  if (!endereco) return json({ error: 'Informe um endereço.' }, 400);

  const query = /brasil|,\s*br$/i.test(endereco) ? endereco : `${endereco}, Brasil`;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'DiariosDeObraGeoteste/1.0 (contato@geoteste.com.br)',
        'Accept-Language': 'pt-BR',
      },
    });
    if (!res.ok) throw new Error(`nominatim -> ${res.status}`);
    const results = await res.json();
    const first = results?.[0];
    if (!first) return json({ error: 'Endereço não localizado.' }, 404);

    const addr = first.address || {};
    const cidade = addr.city || addr.town || addr.municipality || addr.village || addr.suburb || null;
    const uf = ufFromEstadoNome(addr.state);

    return json({
      cidade,
      uf,
      lat: Number(first.lat),
      lon: Number(first.lon),
      displayName: first.display_name || null,
    });
  } catch (error) {
    console.error('geocode-endereco: falha ao consultar Nominatim', error);
    return json({ error: 'Não foi possível geocodificar este endereço agora.' }, 502);
  }
};
