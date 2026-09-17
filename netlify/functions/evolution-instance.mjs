// Proxy pro painel de conexao do WhatsApp (Consultas WhatsApp > Conectar).
// Chamado PELO FRONTEND (usuario logado), diferente de evolution-webhook.mjs
// (chamado PELA Evolution API). A API key da Evolution fica só aqui,
// nunca chega no navegador.
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: JSON_HEADERS,
});

const env = (name) => Netlify.env.get(name)?.trim();

export default async (request) => {
  const diarioUrl = env('VITE_SUPABASE_URL');
  const diarioAnonKey = env('VITE_SUPABASE_ANON_KEY');
  const apiUrl = env('EVOLUTION_API_URL');
  const apiKey = env('EVOLUTION_API_KEY');
  const instanceName = env('EVOLUTION_INSTANCE_NAME') || 'geoteste';

  if (!diarioUrl || !diarioAnonKey) {
    return json({ error: 'Integração não configurada no servidor.' }, 503);
  }

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return json({ error: 'Sessão não informada.' }, 401);

  const authResponse = await fetch(`${diarioUrl}/auth/v1/user`, {
    headers: { apikey: diarioAnonKey, Authorization: authorization },
  });
  if (!authResponse.ok) return json({ error: 'Sessão inválida ou expirada.' }, 401);

  if (!apiUrl || !apiKey) {
    return json({ error: 'A conexão com o WhatsApp ainda não foi configurada (falta EVOLUTION_API_URL/EVOLUTION_API_KEY no servidor).' }, 503);
  }

  const action = new URL(request.url).searchParams.get('action');
  const baseUrl = apiUrl.replace(/\/$/, '');

  try {
    if (action === 'status') {
      const res = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: apiKey },
      });
      if (res.status === 404) return json({ state: 'not_created' });
      if (!res.ok) throw new Error(`connectionState -> ${res.status}`);
      const data = await res.json();
      const state = data?.instance?.state || data?.state || 'unknown';
      return json({ state });
    }

    if (action === 'qrcode') {
      // Garante que a instancia existe antes de pedir QR — Evolution API
      // devolve 404 em /instance/connect se a instancia nunca foi criada.
      const stateRes = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: apiKey },
      });
      if (stateRes.status === 404) {
        const createRes = await fetch(`${baseUrl}/instance/create`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });
        if (!createRes.ok) {
          const errBody = await createRes.text().catch(() => '');
          throw new Error(`instance/create -> ${createRes.status}: ${errBody}`);
        }
      }

      const res = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: apiKey },
      });
      if (!res.ok) throw new Error(`instance/connect -> ${res.status}`);
      const data = await res.json();
      const base64 = data?.base64 || data?.qrcode?.base64 || null;
      const pairingCode = data?.pairingCode || data?.qrcode?.pairingCode || null;
      if (!base64 && !pairingCode) {
        // Instancia pode ja estar conectada — nao ha QR pra mostrar.
        return json({ state: data?.instance?.state || 'connected_or_unavailable' });
      }
      return json({ qrcodeBase64: base64, pairingCode });
    }

    if (action === 'disconnect') {
      const res = await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { apikey: apiKey },
      });
      if (!res.ok) throw new Error(`instance/logout -> ${res.status}`);
      return json({ ok: true });
    }

    return json({ error: 'Ação inválida.' }, 400);
  } catch (error) {
    console.error('evolution-instance: falha ao falar com a Evolution API', error);
    return json({ error: 'Não foi possível falar com a Evolution API. Confira a URL/API key configuradas.' }, 502);
  }
};
