import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import EmptyState from './EmptyState';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, PageHeader, PeriodoFilterButtons, StatusBadge, Surface } from './ui';
import { Periodo, periodoSince } from '../lib/periodoFiltro';

const MODALIDADES = ['PIT', 'PDA', 'PCE', 'PLACA', 'HAMMER'] as const;
type Modalidade = typeof MODALIDADES[number];
type Status = 'enviada' | 'aceita' | 'recusada';

interface PropostaConcorrencia {
  id: string;
  numero: string | null;
  modalidade: Modalidade;
  clienteNome: string;
  obraNome: string | null;
  cidade: string | null;
  uf: string | null;
  valorTotal: number;
  status: Status;
  ehLicitacao: boolean;
  concorrentes: string;
  dataProposta: string | null;
  createdAt: string;
}

const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const statusLabels: Record<Status, string> = { enviada: 'Enviada', aceita: 'Aceita', recusada: 'Recusada' };
const statusVariants: Record<Status, 'info' | 'success' | 'danger'> = { enviada: 'info', aceita: 'success', recusada: 'danger' };

export const ConcorrenciaManagement: React.FC = () => {
  const toast = useToast();
  const [propostas, setPropostas] = useState<PropostaConcorrencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>('tudo');

  const fetchData = async () => {
    if (!isSupabaseConfigured) { setPropostas([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, numero, modalidade, cliente_nome, obra_nome, cidade, uf, valor_total, status, eh_licitacao, concorrentes, data_proposta, created_at')
        .not('concorrentes', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPropostas((data || [])
        .filter((row: any) => (row.concorrentes || '').trim())
        .map((row: any) => ({
          id: row.id,
          numero: row.numero,
          modalidade: row.modalidade,
          clienteNome: row.cliente_nome || '',
          obraNome: row.obra_nome,
          cidade: row.cidade,
          uf: row.uf,
          valorTotal: Number(row.valor_total) || 0,
          status: row.status,
          ehLicitacao: Boolean(row.eh_licitacao),
          concorrentes: row.concorrentes,
          dataProposta: row.data_proposta,
          createdAt: row.created_at,
        })));
    } catch {
      toast.error('Não foi possível carregar a concorrência. Tente novamente.');
      setPropostas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => propostas.filter((p) => {
    const since = periodoSince(periodo);
    if (since) {
      const ref = p.dataProposta ? new Date(p.dataProposta) : new Date(p.createdAt);
      if (ref < since) return false;
    }
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return p.clienteNome.toLowerCase().includes(term)
      || (p.obraNome || '').toLowerCase().includes(term)
      || p.concorrentes.toLowerCase().includes(term);
  }), [propostas, searchTerm, periodo]);

  const totais = useMemo(() => {
    const valorComConcorrencia = filtered.reduce((sum, p) => sum + p.valorTotal, 0);
    const valorLicitacao = filtered.filter((p) => p.ehLicitacao).reduce((sum, p) => sum + p.valorTotal, 0);
    const pctLicitacao = valorComConcorrencia > 0 ? (valorLicitacao / valorComConcorrencia) * 100 : 0;
    return { valorComConcorrencia, valorLicitacao, pctLicitacao };
  }, [filtered]);

  const porModalidade = useMemo(() => MODALIDADES.map((mod) => {
    const items = filtered.filter((p) => p.modalidade === mod);
    return { modalidade: mod, total: items.reduce((sum, p) => sum + p.valorTotal, 0), count: items.length };
  }).filter((m) => m.count > 0), [filtered]);

  return (
    <div>
      <PageHeader
        title="Concorrência"
        description="Obras onde há concorrente conhecido — marque isso na proposta (aba Propostas) pra aparecer aqui."
        eyebrow="Comercial"
      />

      <FilterBar>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, obra ou concorrente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
        <PeriodoFilterButtons value={periodo} onChange={setPeriodo} />
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Valor com concorrência conhecida</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{currency(totais.valorComConcorrencia)}</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Desse total, é licitação</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{currency(totais.valorLicitacao)}</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">% licitação da concorrência</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{totais.pctLicitacao.toFixed(0)}%</p>
        </div></Surface>
      </div>

      {porModalidade.length > 0 && (
        <div className="mb-6 space-y-2">
          {porModalidade.map((m) => {
            const max = Math.max(...porModalidade.map((x) => x.total), 1);
            const pct = (m.total / max) * 100;
            return (
              <div key={m.modalidade} className="flex items-center gap-3">
                <span className="w-16 text-xs font-semibold text-gray-700 dark:text-gray-200">{m.modalidade}</span>
                <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-28 text-right text-xs text-gray-600 dark:text-gray-300">{currency(m.total)}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((p) => (
          <Surface key={p.id}>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">{p.numero || p.clienteNome}</span>
                  <StatusBadge variant="neutral">{p.modalidade}</StatusBadge>
                  <StatusBadge variant={statusVariants[p.status]}>{statusLabels[p.status]}</StatusBadge>
                  {p.ehLicitacao && <StatusBadge variant="warning">Licitação</StatusBadge>}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{p.clienteNome}{p.obraNome ? ` · ${p.obraNome}` : ''}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <Users className="inline h-3 w-3 mr-1" />
                  Concorrentes: {p.concorrentes}
                </p>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">{currency(p.valorTotal)}</span>
            </div>
          </Surface>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhuma concorrência registrada"
          description="Abra uma proposta na aba Propostas e preencha o campo 'Concorrentes nessa obra' pra ela aparecer aqui."
        />
      )}
    </div>
  );
};
