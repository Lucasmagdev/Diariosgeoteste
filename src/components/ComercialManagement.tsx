import React, { useState } from 'react';
import { PropostasManagement } from './PropostasManagement';
import { ConcorrenciaManagement } from './ConcorrenciaManagement';
import { LicitacoesManagement } from './LicitacoesManagement';
import { ConsultasWhatsappManagement } from './ConsultasWhatsappManagement';

type ComercialTab = 'propostas' | 'concorrencia' | 'licitacoes' | 'consultas-whatsapp';

const TABS: { key: ComercialTab; label: string }[] = [
  { key: 'propostas', label: 'Propostas' },
  { key: 'concorrencia', label: 'Concorrência' },
  { key: 'licitacoes', label: 'Licitações' },
  { key: 'consultas-whatsapp', label: 'Consultas WhatsApp' },
];

export const ComercialManagement: React.FC = () => {
  const [tab, setTab] = useState<ComercialTab>('propostas');

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? 'border-green-600 text-green-700 dark:text-green-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'propostas' && <PropostasManagement />}
      {tab === 'concorrencia' && <ConcorrenciaManagement />}
      {tab === 'licitacoes' && <LicitacoesManagement />}
      {tab === 'consultas-whatsapp' && <ConsultasWhatsappManagement />}
    </div>
  );
};
