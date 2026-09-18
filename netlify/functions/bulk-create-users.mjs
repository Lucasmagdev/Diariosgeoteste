// Ferramenta TEMPORARIA — cria em lote as contas dos tecnicos de campo
// (sem e-mail real, e-mail e senha inventados). Roda uma vez, deletada
// logo em seguida (nao faz parte do app). Usa a Admin API do Supabase
// Auth (service role) pra criar direto com email_confirm=true — sem
// isso, contas com e-mail falso nunca confirmariam e nunca logariam.
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const env = (name) => Netlify.env.get(name)?.trim();

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (body.confirm !== 'bulk-create-users') return json({ error: 'Confirmação ausente.' }, 400);

  const supabaseUrl = env('VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Sem credenciais no servidor.' }, 503);

  const usuarios = [
    { nome: 'Ananias Barbosa', email: 'ananias.barbosa@geoteste.com', senha: 'Ananiasgeo@2026' },
    { nome: 'Daniel Lago', email: 'daniel.lago@geoteste.com', senha: 'Daniellagogeo@2026' },
    { nome: 'Ezequiel Nunes', email: 'ezequiel.nunes@geoteste.com', senha: 'Ezequielgeo@2026' },
    { nome: 'Gabriel Júnior', email: 'gabriel.junior@geoteste.com', senha: 'Gabrielgeo@2026' },
    { nome: 'Leonardo Ramos', email: 'leonardo.ramos@geoteste.com', senha: 'Leonardogeo@2026' },
    { nome: 'Lucas Soares', email: 'lucas.soares@geoteste.com', senha: 'Lucassoaresgeo@2026' },
    { nome: 'Lucas Lobo', email: 'lucas.lobo@geoteste.com', senha: 'Lucaslobogeo@2026' },
    { nome: 'Lucas Ramos', email: 'lucas.ramos@geoteste.com', senha: 'Lucasramosgeo@2026' },
    { nome: 'Márcio Baldow', email: 'marcio.baldow@geoteste.com', senha: 'Marciogeo@2026' },
    { nome: 'Mateus Filipe', email: 'mateus.filipe@geoteste.com', senha: 'Mateusgeo@2026' },
    { nome: 'Oseias Moreira', email: 'oseias.moreira@geoteste.com', senha: 'Oseiasgeo@2026' },
    { nome: 'Rodrigo Ortmann', email: 'rodrigo.ortmann@geoteste.com', senha: 'Rodrigogeo@2026' },
    { nome: 'Tiago Simão', email: 'tiago.simao@geoteste.com', senha: 'Tiagogeo@2026' },
    { nome: 'Warley Soares', email: 'warley.soares@geoteste.com', senha: 'Warleygeo@2026' },
    { nome: 'Carlos André', email: 'carlos.andre@geoteste.com', senha: 'Carlosandregeo@2026' },
    { nome: 'Daniel Ferreira', email: 'daniel.ferreira@geoteste.com', senha: 'Danielferreirageo@2026' },
  ];

  const resultados = [];
  for (const u of usuarios) {
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: u.email,
          password: u.senha,
          email_confirm: true,
          user_metadata: { full_name: u.nome, name: u.nome },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        resultados.push({ nome: u.nome, email: u.email, ok: false, erro: data?.msg || data?.message || `HTTP ${response.status}` });
        continue;
      }
      resultados.push({ nome: u.nome, email: u.email, senha: u.senha, ok: true });
    } catch (error) {
      resultados.push({ nome: u.nome, email: u.email, ok: false, erro: String(error) });
    }
  }

  return json({ ok: true, resultados });
};
