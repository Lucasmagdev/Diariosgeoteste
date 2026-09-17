// Recebe o webhook da Evolution API (WhatsApp) quando uma mensagem nova
// chega, e loga a PRIMEIRA mensagem de cada numero como uma "consulta"
// na aba Comercial > Consultas WhatsApp. Mensagens seguintes do mesmo
// numero (conversa em andamento) sao ignoradas de proposito — isso aqui
// e um log de "quantas consultas entraram", nao um espelho do chat
// inteiro. Qualificacao e origem (marketing/organico) ficam manuais por
// enquanto — cruzar com o tracking de head (pixel/UTM) fica pra depois.
//
// Formato do payload segue o padrao da Evolution API (evento
// "messages.upsert", baseado em Baileys) — NAO testado ainda contra uma
// instancia real; ajustar os caminhos de campo (data.message.*) no
// primeiro teste ao vivo, do mesmo jeito que aconteceu com o parser de
// PDF de propostas nessa sessao.
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: JSON_HEADERS,
});

const env = (name) => Netlify.env.get(name)?.trim();

const supabaseAdminSelect = async (baseUrl, serviceKey, table, params) => {
  const response = await fetch(`${baseUrl}/rest/v1/${table}?${params}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) throw new Error(`Falha ao consultar ${table}: ${response.status}`);
  return response.json();
};

const supabaseAdminInsert = async (baseUrl, serviceKey, table, row) => {
  const response = await fetch(`${baseUrl}/rest/v1/${table}`, {
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

const extractMensagem = (message) => {
  if (!message) return null;
  return message.conversation
    || message.extendedTextMessage?.text
    || message.imageMessage?.caption
    || message.videoMessage?.caption
    || null;
};

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const webhookSecret = env('EVOLUTION_WEBHOOK_SECRET');
  const supabaseUrl = env('VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!webhookSecret || !supabaseUrl || !serviceKey) {
    console.error('evolution-webhook: variaveis de ambiente ausentes.');
    return json({ error: 'Integração não configurada no servidor.' }, 503);
  }

  const url = new URL(request.url);
  const providedSecret = request.headers.get('x-webhook-secret') || url.searchParams.get('secret');
  if (providedSecret !== webhookSecret) {
    return json({ error: 'Não autorizado.' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Payload inválido.' }, 400);
  }

  const event = (body?.event || '').toLowerCase();
  const data = body?.data;
  if (event !== 'messages.upsert' || !data) {
    // Outros eventos (connection.update, qrcode.updated etc) sao ignorados.
    return json({ ok: true, ignored: true });
  }

  const remoteJid = data.key?.remoteJid || '';
  const isFromMe = Boolean(data.key?.fromMe);
  const isGroup = remoteJid.endsWith('@g.us');
  if (isFromMe || isGroup || !remoteJid) {
    return json({ ok: true, ignored: true });
  }

  const numeroContato = remoteJid.split('@')[0];
  const messageId = data.key?.id || null;
  const nomeContato = data.pushName || null;
  const mensagem = extractMensagem(data.message);
  const instance = body?.instance || null;

  try {
    if (messageId) {
      const jaProcessada = await supabaseAdminSelect(
        supabaseUrl, serviceKey, 'consultas_whatsapp',
        `select=id&evolution_message_id=eq.${encodeURIComponent(messageId)}&limit=1`,
      );
      if (jaProcessada.length > 0) return json({ ok: true, already_processed: true });
    }

    const existente = await supabaseAdminSelect(
      supabaseUrl, serviceKey, 'consultas_whatsapp',
      `select=id&numero_contato=eq.${encodeURIComponent(numeroContato)}&limit=1`,
    );
    if (existente.length > 0) {
      // Ja existe consulta desse numero — mensagem seguinte da mesma
      // conversa, nao conta como nova consulta.
      return json({ ok: true, already_a_contact: true });
    }

    const criada = await supabaseAdminInsert(supabaseUrl, serviceKey, 'consultas_whatsapp', {
      numero_contato: numeroContato,
      nome_contato: nomeContato,
      primeira_mensagem: mensagem,
      evolution_instance: instance,
      evolution_message_id: messageId,
    });

    return json({ ok: true, consulta_id: criada.id });
  } catch (error) {
    console.error('evolution-webhook: falha ao processar mensagem', error);
    return json({ error: 'Falha ao processar a mensagem.' }, 502);
  }
};
