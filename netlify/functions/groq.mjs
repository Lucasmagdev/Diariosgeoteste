const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Netlify.env.get('GROQ_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY não configurada.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Não foi possível processar a solicitação.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
