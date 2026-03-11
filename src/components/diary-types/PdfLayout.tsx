import React from 'react';

interface PdfLayoutProps {
  diary: any;
  title: string;
  children: React.ReactNode;
}

interface PdfSectionProps {
  title?: string;
  columns?: number;
  children: React.ReactNode;
}

interface PdfRowProps {
  label: string;
  value?: React.ReactNode;
  span?: number;
  placeholder?: boolean;
}

interface PdfValueProps {
  label?: string;
  checked?: boolean;
}

interface PdfClimateRowProps {
  ensolarado?: boolean;
  chuvaFraca?: boolean;
  chuvaForte?: boolean;
}

interface PdfTableProps {
  headers: string[];
  rows: Array<Array<React.ReactNode>>;
  columnWidths?: string;
  compactHeaders?: boolean;
}

export const PdfLayout: React.FC<PdfLayoutProps> = ({ diary, title, children }) => {
  return (
    <div className="w-full py-1">
      <div className="max-w-[1600px] mx-auto px-0">
        <div className="mx-auto w-full max-w-[1460px] bg-white text-gray-900 border border-gray-200 rounded-none pt-0.5 px-0.5 pb-0.5 flex flex-col gap-0 box-border">
          <header className="flex items-center justify-between border-b border-gray-200 pb-0.5 gap-1.5 w-full">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <img src="/logogeoteste.png" alt="Geoteste" className="h-3.5 flex-shrink-0" />
              <h1 className="text-[7px] font-serif font-semibold tracking-wide leading-tight whitespace-nowrap">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-2 text-[6px] font-medium leading-tight flex-shrink-0">
              <span className="whitespace-nowrap">Cliente: {diary.clientName || '-'}</span>
              <span className="whitespace-nowrap">Data: {diary.date ? new Date(diary.date).toLocaleDateString('pt-BR') : '-'}</span>
            </div>
          </header>

          <main className="flex-1 space-y-1 text-[7px] w-full">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export const PdfSection: React.FC<PdfSectionProps> = ({ title, columns = 3, children }) => {
  const template = `repeat(${columns}, minmax(0, 1fr))`;
  const isAssinaturas = title?.toUpperCase().includes('ASSINATURA');
  return (
    <section
      className="border border-gray-400 overflow-hidden w-full"
      data-pdf-section={isAssinaturas ? 'assinaturas' : undefined}
    >
      {title && (
        <div className="bg-gray-200 border-b border-gray-400 px-0.5 py-1.5 font-bold uppercase text-[7px]">
          {title}
        </div>
      )}
      <div
        className="grid divide-x divide-gray-300 text-[7px] w-full"
        style={{ gridTemplateColumns: template, minWidth: 0 }}
      >
        {children}
      </div>
    </section>
  );
};

export const PdfRow: React.FC<PdfRowProps> = ({ label, value = '-', span = 1, placeholder }) => {
  const gridSpan = `span ${span} / span ${span}`;
  const labelStr = typeof label === 'string' ? label.toUpperCase() : '';
  const isEquipamento = labelStr.includes('EQUIPAMENTO');
  const labelTextClasses = isEquipamento
    ? 'text-[7px] whitespace-nowrap'
    : 'text-[7px] break-words';
  const containerClasses = isEquipamento
    ? 'border-b border-gray-300 pl-0.5 pr-0.5 py-1 min-w-0 overflow-hidden'
    : 'border-b border-gray-300 px-0.5 py-1 min-w-0 overflow-hidden';
  return (
    <div
      className={containerClasses}
      style={{ gridColumn: gridSpan }}
    >
      <p className={`font-semibold uppercase ${labelTextClasses} mb-0 leading-tight`}>{label}</p>
      <div className="min-h-[16px] flex items-center text-[7px] break-words">
        {placeholder ? (
          <div className="w-full min-h-[56px] flex items-end">
            <span className="block w-full border-b border-gray-400"></span>
          </div>
        ) : value}
      </div>
    </div>
  );
};

export const PdfValue: React.FC<PdfValueProps> = ({ label, checked }) => {
  return (
    <span className="inline-flex items-center gap-1 align-middle leading-none">
      <span className="inline-flex h-[7px] w-[7px] items-center justify-center border border-gray-700 bg-white">
        {checked ? <span className="h-[3px] w-[3px] bg-gray-800"></span> : null}
      </span>
      <span className="text-[7px] leading-none">{label}</span>
    </span>
  );
};

const PdfCheckItem: React.FC<{ label: string; checked?: boolean }> = ({ label, checked }) => (
  <div className="whitespace-nowrap text-[7px] leading-[10px]">
    {checked ? '☑' : '☐'} {label}
  </div>
);

export const PdfClimateRow: React.FC<PdfClimateRowProps> = ({
  ensolarado,
  chuvaFraca,
  chuvaForte,
}) => (
  <div className="grid grid-cols-3 gap-1 px-0.5 py-1">
    <PdfCheckItem label="Ensolarado" checked={ensolarado} />
    <PdfCheckItem label="Chuva fraca" checked={chuvaFraca} />
    <PdfCheckItem label="Chuva forte" checked={chuvaForte} />
  </div>
);

export const PdfTable: React.FC<PdfTableProps> = ({
  headers,
  rows,
  columnWidths,
  compactHeaders = false,
}) => {
  const normalizeHeader = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  const formatHeaderLabel = (header: string): string => {
    if (!compactHeaders) return header;

    const normalized = normalizeHeader(header);

    if (normalized === 'DIAMETRO (CM)') return 'Diam. (cm)';
    if (normalized === 'PROFUNDIDADE (METROS)') return 'Prof. (m)';
    if (normalized === 'PROFUNDIDADE (CM)') return 'Prof. (cm)';
    if (normalized === 'CARGA DE TRABALHO (TF)') return 'Carga trab. (tf)';
    if (normalized === 'CARGA DE ENSAIO (TF)') return 'Carga ensaio (tf)';
    if (normalized === 'COMPRIMENTO UTIL (M)') return 'Comp. util (m)';

    return header;
  };

  const getDefaultWidths = (numCols: number) => {
    return `repeat(${numCols}, minmax(0, 1fr))`;
  };

  const getHeaderFontSize = (header: string): string => {
    const headerLength = header.length;
    const longTitlePatterns = [
      'ARRASAMENTO',
      'PROFUNDIDADE',
      'COMPRIMENTO',
      'DIAMETRO',
      'CARGA',
      'TRABALHO',
      'ENSAIO'
    ];

    const hasLongPattern = longTitlePatterns.some(pattern => header.includes(pattern));

    if (headerLength > 13 || hasLongPattern) {
      return 'text-[6px]';
    }
    return 'text-[7px]';
  };

  const template = columnWidths || getDefaultWidths(headers.length);

  return (
    <div className="border border-gray-300 overflow-x-auto w-full">
      <div className="w-full">
        <div
          className="grid bg-gray-100 text-[7px] font-semibold uppercase text-gray-800 w-full"
          style={{ gridTemplateColumns: template, minWidth: 0 }}
        >
          {headers.map((header, idx) => {
            const headerLabel = formatHeaderLabel(typeof header === 'string' ? header : String(header));
            const headerStr = normalizeHeader(headerLabel);
            const isEquipamento = headerStr.includes('EQUIPAMENTO');
            const fontSize = getHeaderFontSize(headerStr);
            const headerClasses = isEquipamento
              ? `whitespace-nowrap leading-snug ${fontSize}`
              : `break-words whitespace-normal leading-snug ${fontSize}`;
            const headerContainerClasses = isEquipamento
              ? 'pl-0.5 pr-0.5 py-1 border-r border-gray-300 last:border-r-0 text-center min-w-0 min-h-[20px]'
              : 'px-0.5 py-1 border-r border-gray-300 last:border-r-0 text-center min-w-0 min-h-[20px]';
            return (
              <div key={idx} className={headerContainerClasses}>
                <div className={`${headerClasses} w-full`}>{headerLabel}</div>
              </div>
            );
          })}
        </div>
        {rows.length > 0 ? (
          rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="grid text-[7px] text-gray-900 w-full"
              style={{ gridTemplateColumns: template, minWidth: 0 }}
            >
              {row.map((cell, cellIdx) => (
                <div
                  key={cellIdx}
                  className="px-1 py-1.5 border-t border-r border-gray-300 last:border-r-0 break-words text-center min-h-[20px] flex items-center justify-center min-w-0 overflow-hidden"
                >
                  <span className="w-full text-center leading-normal break-words">{cell}</span>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="px-1 py-3 text-center text-[7px] text-gray-500">Sem registros</div>
        )}
      </div>
    </div>
  );
};
