import React, { useEffect, useMemo, useState } from 'react';
import { Search, Gavel } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import EmptyState from './EmptyState';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, PageHeader, StatusBadge, Surface } from './ui';

const MODALIDADES = ['PIT', 'PDA', 'PCE', 'PLACA', 'HAMMER'] as const;
type Modalidade = typeof MODALIDADES[number];
type Status = 'enviada' | 'aceita' | 'recusada';

interface Licitacao {
  id: string;
  numero: string | null;
  modalidade: Modalidade;
  clienteNome: string;
  obraNome: string | null;
  cidade: string | null;
  uf: string | null;
  valorTotal: number;
  status: Status;
  orgaoLicitante: string | null;
  numeroProcesso: string | null;
  dataAbertura: string | null;
}

const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const statusLabels: Record<Status, string> = { enviada: 'Enviada', aceita: 'Aceita', recusada: 'Recusada' };
const statusVariants: Record<Status, 'info' | 'success' | 'danger'> = { enviada: 'info', aceita: 'success', recusada: 'danger' };

export const LicitacoesManagement: React.FC = () => {
  const toast = useToast();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<Status | 'todas'>('todas');

  const fetchData = async () => {
    if (!isSupabaseConfigured) { setLicitacoes([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('propostas')
        .select('id, numero, modalidade, cliente_nome, obra_nome, cidade, uf, valor_total, status, orgao_licitante, numero_processo, data_abertura')
        .eq('eh_licitacao', true)
        .order('data_abertura', { ascending: false, nullsFirst: false });
      if (error) throw error;
      setLicitacoes((data || []).map((row: any) => ({
        id: row.id,
        numero: row.numero,
        modalidade: row.modalidade,
        clienteNome: row.cliente_nome || '',
        obraNome: row.obra_nome,
        cidade: row.cidade,
        uf: row.uf,
        valorTotal: Number(row.valor_total) || 0,
        status: row.status,
        orgaoLicitante: row.orgao_licitante,
        numeroProcesso: row.numero_processo,
        dataAbertura: row.data_abertura,
      })));
    } catch {
      toast.error('Não foi possível carregar as licitações. Tente novamente.');
      setLicitacoes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => licitacoes.filter((l) => {
    if (statusFiltro !== 'todas' && l.status !== statusFiltro) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return l.clienteNome.toLowerCase().includes(term)
      || (l.obraNome || '').toLowerCase().includes(term)
      || (l.orgaoLicitante || '').toLowerCase().includes(term)
      || (l.numeroProcesso || '').toLowerCase().includes(term);
  }), [licitacoes, statusFiltro, searchTerm]);

  const totais = useMemo(() => {
    const valorTotal = filtered.reduce((sum, l) => sum + l.valorTotal, 0);
    const aceitas = filtered.filter((l) => l.status === 'aceita');
    const valorAceito = aceitas.reduce((sum, l) => sum + l.valorTotal, 0);
    return { valorTotal, count: filtered.length, valorAceito, aceitasCount: aceitas.length };
  }, [filtered]);

  return (
    <div>
      <PageHeader
        title="Licitações"
        description="Propostas marcadas como 'É licitação' na aba Propostas aparecem aqui, com os dados do processo licitatório."
        eyebrow="Comercial"
      />

      <FilterBar>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, obra, órgão ou nº do processo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value as Status | 'todas')}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
        >
          <option value="todas">Todos os status</option>
          <option value="enviada">Enviada</option>
          <option value="aceita">Aceita</option>
          <option value="recusada">Recusada</option>
        </select>
        <button
          onClick={fetchData}
          disabled={loading}
          className="text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
        >
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total em licitações</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{currency(totais.valorTotal)}</p>
          <p className="text-xs text-gray-400">{totais.count} processos</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Ganhas</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{currency(totais.valorAceito)}</p>
          <p className="text-xs text-gray-400">{totais.aceitasCount} processos</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Taxa de vitória</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">
            {totais.count > 0 ? `${((totais.aceitasCount / totais.count) * 100).toFixed(0)}%` : '—'}
          </p>
        </div></Surface>
      </div>

      <div className="space-y-3">
        {filtered.map((l) => (
          <Surface key={l.id}>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">{l.numeroProcesso || l.numero || l.clienteNome}</span>
                  <StatusBadge variant="neutral">{l.modalidade}</StatusBadge>
                  <StatusBadge variant={statusVariants[l.status]}>{statusLabels[l.status]}</StatusBadge>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
                  {l.clienteNome}{l.obraNome ? ` · ${l.obraNome}` : ''}{l.orgaoLicitante ? ` · ${l.orgaoLicitante}` : ''}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {[l.cidade, l.uf].filter(Boolean).join('/')} {l.dataAbertura ? `· Abertura ${new Date(l.dataAbertura + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">{currency(l.valorTotal)}</span>
            </div>
          </Surface>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={Gavel}
          title="Nenhuma licitação registrada"
          description="Abra uma proposta na aba Propostas, marque 'É licitação' e preencha o processo pra ela aparecer aqui."
        />
      )}
    </div>
  );
};
