// Ferramenta TEMPORARIA — insere dados mock pra revisar design/usabilidade
// das abas comerciais novas (Propostas, Visitas Tecnicas, Acompanhamento
// de Obra). Roda uma vez, deletada logo em seguida (nao faz parte do app).
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const env = (name) => Netlify.env.get(name)?.trim();

const sb = async (baseUrl, serviceKey, path, init = {}) => {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path} -> ${response.status}: ${JSON.stringify(data)}`);
  return data;
};

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (body.confirm !== 'seed-mock-data') return json({ error: 'Confirmação ausente.' }, 400);

  const supabaseUrl = env('VITE_SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Sem credenciais no servidor.' }, 503);

  try {
    const propostas = [
      { numero: 'PROP-0001', modalidade: 'PIT', cliente_nome: 'Construtora Alfa', cidade: 'Belo Horizonte', uf: 'MG', valor_total: 45000, status: 'aceita', data_proposta: '2026-09-14', obra_nome: 'Residencial Alfa Park' },
      { numero: 'PROP-0002', modalidade: 'PDA', cliente_nome: 'Vale Engenharia', cidade: 'Rio de Janeiro', uf: 'RJ', valor_total: 128000, status: 'enviada', data_proposta: '2026-09-11', obra_nome: 'Terminal Portuário Vale', concorrentes: 'GeoSolo Engenharia, Fundatec' },
      { numero: 'PROP-0003', modalidade: 'PCE', cliente_nome: 'MRV Engenharia', cidade: 'São Paulo', uf: 'SP', valor_total: 67000, status: 'recusada', motivo_recusa: 'Cliente fechou com concorrente por prazo de execução.', data_proposta: '2026-09-06', obra_nome: 'Residencial Vista Verde' },
      { numero: 'PROP-0004', modalidade: 'PLACA', cliente_nome: 'BCP Engenharia', cidade: 'São José dos Campos', uf: 'SP', valor_total: 19000, status: 'aceita', data_proposta: '2026-09-01', obra_nome: 'Assaí Atacadista' },
      { numero: 'PROP-0005', modalidade: 'HAMMER', cliente_nome: 'Petrobras', cidade: 'Duque de Caxias', uf: 'RJ', valor_total: 210000, status: 'enviada', data_proposta: '2026-09-13', obra_nome: 'REDUC - Unidade de Refino', eh_licitacao: true, orgao_licitante: 'Petrobras S.A.', numero_processo: 'PB-2026-0451', data_abertura: '2026-09-26' },
      { numero: 'PROP-0006', modalidade: 'PIT', cliente_nome: 'Andrade Gutierrez', cidade: 'Belo Horizonte', uf: 'MG', valor_total: 38000, status: 'enviada', data_proposta: '2026-09-15', obra_nome: 'Estação de Tratamento Rio Manso' },
      { numero: 'PROP-0007', modalidade: 'PDA', cliente_nome: 'Construtora Barbosa Mello', cidade: 'Salvador', uf: 'BA', valor_total: 95000, status: 'aceita', data_proposta: '2026-08-27', obra_nome: 'Complexo Industrial Bahia' },
      { numero: 'PROP-0008', modalidade: 'PCE', cliente_nome: 'Gerdau', cidade: 'Ouro Preto', uf: 'MG', valor_total: 54000, status: 'enviada', data_proposta: '2026-09-09', obra_nome: 'Pátio de Minério Gerdau', concorrentes: 'Solotrat Engenharia' },
      { numero: 'PROP-0009', modalidade: 'PLACA', cliente_nome: 'Direcional Engenharia', cidade: 'Rio de Janeiro', uf: 'RJ', valor_total: 22000, status: 'recusada', motivo_recusa: 'Preço acima do orçamento do cliente.', data_proposta: '2026-08-22', obra_nome: 'Residencial Direcional Barra' },
      { numero: 'PROP-0010', modalidade: 'PDA', cliente_nome: 'Prefeitura de Contagem', cidade: 'Contagem', uf: 'MG', valor_total: 156000, status: 'enviada', data_proposta: '2026-09-08', obra_nome: 'Viaduto Municipal Contagem', eh_licitacao: true, orgao_licitante: 'Prefeitura Municipal de Contagem', numero_processo: 'PMC-034/2026', data_abertura: '2026-10-06' },
      { numero: 'PROP-0011', modalidade: 'PIT', cliente_nome: 'Construtora ETAM', cidade: 'Manaus', uf: 'AM', valor_total: 41000, status: 'aceita', data_proposta: '2026-08-07', obra_nome: 'Ponte Rio Autaz Mirim' },
      { numero: 'PROP-0012', modalidade: 'HAMMER', cliente_nome: 'Vale S.A.', cidade: 'Belo Horizonte', uf: 'MG', valor_total: 175000, status: 'enviada', data_proposta: '2026-09-12', obra_nome: 'Mina Vale - Expansão', concorrentes: 'Cesa Engenharia, PDI Brasil' },
    ];
    const propostasInseridas = await sb(supabaseUrl, serviceKey, 'propostas', {
      method: 'POST',
      body: JSON.stringify(propostas),
    });

    const visitas = [
      { numero: '01', engenheiro_responsavel: 'Alexandre Henriques', data_visita: '2026-09-15', obra_nome: 'Ponte sobre Rio das Almas', observacoes: 'Vistoria inicial do canteiro, sem pendências.' },
      { numero: '02', engenheiro_responsavel: 'Filipe Almeida', data_visita: '2026-09-14', obra_nome: 'Assaí Atacadista', observacoes: 'Acompanhamento do ensaio de placa.' },
      { numero: '03', engenheiro_responsavel: 'Samuel Werner', data_visita: '2026-09-12', obra_nome: 'Estação de Tratamento Rio Manso', observacoes: null },
      { numero: '04', engenheiro_responsavel: 'Alexandre Henriques', data_visita: '2026-09-10', obra_nome: 'REDUC - Unidade de Refino', observacoes: 'Reunião de alinhamento com engenharia do cliente.' },
      { numero: '05', engenheiro_responsavel: 'Filipe Almeida', data_visita: '2026-09-08', obra_nome: 'Terminal Portuário Vale', observacoes: 'Levantamento de acesso para equipamento pesado.' },
      { numero: '06', engenheiro_responsavel: 'Samuel Werner', data_visita: '2026-09-05', obra_nome: 'Pátio de Minério Gerdau', observacoes: 'Definição dos pontos de ensaio.' },
      { numero: '07', engenheiro_responsavel: 'Alexandre Henriques', data_visita: '2026-08-30', obra_nome: 'Complexo Industrial Bahia', observacoes: null },
      { numero: '08', engenheiro_responsavel: 'Filipe Almeida', data_visita: '2026-08-25', obra_nome: 'Viaduto Municipal Contagem', observacoes: 'Visita técnica pré-licitação.' },
    ];
    const visitasInseridas = await sb(supabaseUrl, serviceKey, 'visitas_tecnicas', {
      method: 'POST',
      body: JSON.stringify(visitas),
    });

    const obraUpdates = [
      {
        obra_code: 'G26088',
        payload: { data_inicio: '2026-06-01', data_previsao_fim: '2026-09-01', valor_inicial: 85000 },
        pausas: [{ data_inicio: '2026-07-15', data_fim: '2026-07-22', motivo: 'Chuva forte impediu acesso ao canteiro.' }],
      },
      {
        obra_code: 'G26064',
        payload: { data_inicio: '2026-07-01', data_previsao_fim: '2026-10-15', valor_inicial: 62000 },
      },
      {
        obra_code: 'G26094',
        payload: {
          data_inicio: '2026-03-01', data_previsao_fim: '2026-06-01', data_fim_real: '2026-05-20',
          valor_inicial: 300000, valor_final: 340000,
          motivo_encerramento: 'Aditivo de escopo solicitado pelo cliente durante a execução.',
        },
      },
      {
        obra_code: 'G26081',
        payload: {
          data_inicio: '2026-01-10', data_previsao_fim: '2026-04-10', data_fim_real: '2026-05-02',
          valor_inicial: 420000, valor_final: 395000,
          motivo_encerramento: 'Cliente reduziu escopo por restrição orçamentária; equipe saiu antes do previsto em um dos pontos.',
        },
      },
    ];

    const obraResultados = [];
    for (const item of obraUpdates) {
      const found = await sb(supabaseUrl, serviceKey, `obras?select=id&obra_code=eq.${encodeURIComponent(item.obra_code)}&limit=1`);
      const obraId = found?.[0]?.id;
      if (!obraId) { obraResultados.push({ obra_code: item.obra_code, ok: false, reason: 'não encontrada' }); continue; }
      await sb(supabaseUrl, serviceKey, `obras?id=eq.${obraId}`, { method: 'PATCH', body: JSON.stringify(item.payload) });
      if (item.pausas) {
        for (const pausa of item.pausas) {
          await sb(supabaseUrl, serviceKey, 'obra_pausas', { method: 'POST', body: JSON.stringify({ obra_id: obraId, ...pausa }) });
        }
      }
      obraResultados.push({ obra_code: item.obra_code, ok: true });
    }

    return json({
      ok: true,
      propostas: propostasInseridas.length,
      visitas: visitasInseridas.length,
      obras: obraResultados,
    });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
};
