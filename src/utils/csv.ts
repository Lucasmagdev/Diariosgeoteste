import { formatTime24hOrEmpty } from './time';

export type DiaryCsvRow = {
  Tipo?: string;
  Cliente: string;
  Endereco: string;
  Equipe: string;
  Data: string;
  Inicio: string;
  Termino: string;
  ServicosExecutados: string;
  AssinaturaGeoteste: string;
  AssinaturaResponsavel: string;
  Observacoes: string;
};

function toCsvLine(values: string[], delimiter: string): string {
  return values
    .map((v) => {
      const s = v ?? '';
      if (s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    })
    .join(delimiter);
}

export function downloadCsv(fileName: string, rows: DiaryCsvRow[], delimiter: string = ';'): void {
  if (rows.length === 0) return;
  const header = Object.keys(rows[0]);
  const lines = [toCsvLine(header as string[], delimiter)];
  for (const row of rows) {
    lines.push(toCsvLine(header.map((k) => (row as any)[k] ?? ''), delimiter));
  }
  const EOL = '\r\n';
  const csvContent = '\uFEFF' + lines.join(EOL) + EOL;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : fileName + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function mapDiaryToCsvRow(d: {
  type?: string;
  clientName: string;
  address: string;
  team: string;
  date: string;
  startTime: string;
  endTime: string;
  servicesExecuted: string;
  geotestSignature: string;
  responsibleSignature: string;
  observations?: string;
}): DiaryCsvRow {
  return {
    Tipo: d.type ?? '',
    Cliente: d.clientName,
    Endereco: d.address,
    Equipe: d.team,
    Data: d.date,
    Inicio: formatTime24hOrEmpty(d.startTime),
    Termino: formatTime24hOrEmpty(d.endTime),
    ServicosExecutados: d.servicesExecuted,
    AssinaturaGeoteste: d.geotestSignature,
    AssinaturaResponsavel: d.responsibleSignature,
    Observacoes: d.observations ?? '',
  };
}


