export type Periodo = 'hoje' | 'semana' | 'mes' | 'tudo';

export const PERIODOS: Periodo[] = ['hoje', 'semana', 'mes', 'tudo'];

export const PERIODO_LABELS: Record<Periodo, string> = {
  hoje: 'Hoje',
  semana: '7 dias',
  mes: '30 dias',
  tudo: 'Tudo',
};

export const periodoSince = (periodo: Periodo): Date | null => {
  const now = new Date();
  if (periodo === 'hoje') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (periodo === 'semana') { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (periodo === 'mes') { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
  return null;
};

// Regiao do Brasil por UF — usado nos relatorios geograficos (rollup
// regiao -> estado -> cidade, do mais alto nivel pro mais granular).
const REGIAO_POR_UF: Record<string, string> = {
  AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste', PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul',
};

export const regiaoPorUf = (uf: string | null | undefined): string =>
  (uf && REGIAO_POR_UF[uf.toUpperCase()]) || 'Sem região';
