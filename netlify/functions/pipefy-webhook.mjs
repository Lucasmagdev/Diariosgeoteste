// Recebe o webhook do Pipefy quando uma obra fechada e criada no pipe
// "02-Gestao de Obras - Geoteste" (card.create) e cria Cliente + Obra
// no Diario automaticamente.
//
// Cadeia de dados (ver reverse-engineering feito via GraphQL na sessao):
//   card novo no pipe "02-Gestao de Obras"
//     -> campo "obra_fechada" (connector) aponta pro card mestre no
//        pipe/database "Obras (Geoteste)"
//          -> campo "n_mero_da_obra" = codigo limpo (ex: "G2561")
//          -> campo "empresa" (connector) = nome do cliente ja resolvido
//
// Seguranca: o Pipefy nao assina o payload por padrao, entao o webhook
// e criado (createWebhook) com um header customizado carregando um
// segredo (PIPEFY_WEBHOOK_SECRET) — sem o header certo, 401 e nada e
// processado. O token do Pipefy (PIPEFY_API_TOKEN) e a service role do
// Supabase ficam só aqui, nunca voltam pro navegador.
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const PIPEFY_GRAPHQL_URL = 'https://api.pipefy.com/graphql';
const OBRAS_PIPE_ID = '304603301'; // 02-Gestao de Obras - Geoteste

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: JSON_HEADERS,
});

const env = (name) => Netlify.env.get(name)?.trim();

const pipefyQuery = async (apiToken, query) => {
  const response = await fetch(PIPEFY_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(`Pipefy respondeu com erro: ${JSON.stringify(payload.errors || payload)}`);
  }
  return payload.data;
};

// Campo de texto/numero: le "value" (string simples, ou JSON de array
// pra campos que o Pipefy sempre encapsula assim). NUNCA use isto pra
// campo tipo "connector" achando que pega o nome do registro linkado —
// "value" ali e so o rotulo de exibicao cacheado, pode ficar
// desatualizado; o id de verdade fica em array_value (ver
// fieldConnectorId abaixo). Bug real que pegou nessa integracao: usar
// array_value pra tudo fazia "Empresa" virar o ID do registro do
// Pipefy ("1067933774") em vez do nome ("TELMEC ENGENHARIA").
const fieldDisplayValue = (fields, fieldId) => {
  const field = (fields || []).find((f) => f.field?.id === fieldId);
  if (!field || typeof field.value !== 'string') return null;
  try {
    const parsed = JSON.parse(field.value);
    if (Array.isArray(parsed)) return parsed[0] ?? null;
  } catch {
    // valor simples, nao json — cai pro return abaixo
  }
  return field.value;
};

// Campo "connector": array_value traz o id do card/registro linkado —
// e o que precisamos pra buscar o card mestre em outra chamada.
const fieldConnectorId = (fields, fieldId) => {
  const field = (fields || []).find((f) => f.field?.id === fieldId);
  if (!field || !Array.isArray(field.array_value) || field.array_value.length === 0) return null;
  return field.array_value[0];
};

const supabaseAdminInsert = async (baseUrl, serviceKey, table, row, select = 'id') => {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?select=${select}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Falha ao inserir em ${table}: ${JSON.stringify(data)}`);
  return Array.isArray(data) ? data[0] : data;
};

const supabaseAdminSelect = async (baseUrl, serviceKey, table, params) => {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?${params}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) throw new Error(`Falha ao consultar ${table}: ${response.status}`);
  return response.json();
};

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const webhookSecret = env('PIPEFY_WEBHOOK_SECRET');
  const apiToken = env('PIPEFY_API_TOKEN');
  const supabaseUrl = env('VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!webhookSecret || !apiToken || !supabaseUrl || !serviceKey) {
    console.error('pipefy-webhook: variaveis de ambiente ausentes.');
    return json({ error: 'Integração não configurada no servidor.' }, 503);
  }

  if (request.headers.get('x-webhook-secret') !== webhookSecret) {
    return json({ error: 'Não autorizado.' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Payload inválido.' }, 400);
  }

  const action = body?.action;
  const cardId = body?.data?.card?.id || body?.data?.id;
  if (action !== 'card.create' || !cardId) {
    // Outros eventos (card.move, comment.create etc.) sao ignorados de
    // proposito — so importa quando uma obra nova entra no pipe.
    return json({ ok: true, ignored: true });
  }

  try {
    // Ja importada? (retry do Pipefy ou reprocessamento)
    const already = await supabaseAdminSelect(
      supabaseUrl, serviceKey, 'obras',
      `select=id&pipefy_card_id=eq.${encodeURIComponent(cardId)}&limit=1`,
    );
    if (already.length > 0) return json({ ok: true, already_imported: true });

    const cardData = await pipefyQuery(apiToken, `{
      card(id: "${cardId}") {
        id
        fields { field { id label } value array_value }
      }
    }`);
    const cardFields = cardData?.card?.fields;
    if (!cardFields) return json({ error: 'Card não encontrado no Pipefy.' }, 404);

    const nomeObra = fieldDisplayValue(cardFields, 'nome_do_cliente'); // label real: "Nome da Obra"
    const masterCardId = fieldConnectorId(cardFields, 'obra_fechada');
    if (!nomeObra || !masterCardId) {
      return json({ error: 'Card sem "Nome da Obra" ou sem vínculo "Obra Fechada".' }, 422);
    }

    const masterData = await pipefyQuery(apiToken, `{
      card(id: "${masterCardId}") {
        id
        fields { field { id label } value array_value }
      }
    }`);
    const masterFields = masterData?.card?.fields;
    const obraCodeRaw = fieldDisplayValue(masterFields, 'n_mero_da_obra');
    const obraCode = obraCodeRaw ? String(obraCodeRaw).trim() : null;
    const empresaNome = fieldDisplayValue(masterFields, 'empresa');
    if (!empresaNome) {
      return json({ error: 'Não foi possível resolver a empresa (cliente) do card mestre.' }, 422);
    }

    // Cliente: acha por nome (case-insensitive) ou cria.
    const existingClients = await supabaseAdminSelect(
      supabaseUrl, serviceKey, 'clients',
      `select=id&name=ilike.${encodeURIComponent(empresaNome.trim())}&limit=1`,
    );
    let clientId = existingClients[0]?.id;
    if (!clientId) {
      const createdClient = await supabaseAdminInsert(supabaseUrl, serviceKey, 'clients', {
        name: empresaNome.trim(),
      });
      clientId = createdClient.id;
    }

    const createdObra = await supabaseAdminInsert(supabaseUrl, serviceKey, 'obras', {
      obra_code: obraCode,
      name: nomeObra.trim(),
      client_id: clientId,
      status: 'ativa',
      pipefy_card_id: cardId,
    });

    return json({ ok: true, obra_id: createdObra.id, client_id: clientId });
  } catch (error) {
    console.error('pipefy-webhook: falha ao processar card', cardId, error);
    return json({ error: 'Falha ao processar o card do Pipefy.' }, 502);
  }
};
