import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, FileDown, LineChart, Radio, CheckCircle2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { fetchAllPitEnsaios, fetchPitEnsaioSignal, downloadBlobFile, PitBrowseEnsaio } from '../lib/pitSync';
import { generateSinalPdf } from '../lib/pitSignalPdf';
import { FilterBar, PageHeader, StatusBadge, Surface } from './ui';

interface ImportInfo {
  clientName: string;
  date: string;
  estacaNome: string;
}

const LIMIT = 50;

const formatDateTimeBR = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
};

export const PitEnsaiosPanel: React.FC = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ensaios, setEnsaios] = useState<PitBrowseEnsaio[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importMap, setImportMap] = useState<Record<string, ImportInfo>>({});
  const [busyId, setBusyId] = useState('');

  const loadImportStatus = async (ids: string[]) => {
    if (!isSupabaseConfigured || ids.length === 0) return;
    const { data, error: queryError } = await supabase
      .from('work_diaries_pit_piles')
      .select('ensaio_origem_id, estaca_nome, work_diaries_pit(diary_id, work_diaries(client_name, date))')
      .in('ensaio_origem_id', ids);
    if (queryError) {
      console.error('loadImportStatus', queryError);
      return;
    }
    const next: Record<string, ImportInfo> = {};
    (data || []).forEach((row: any) => {
      const diary = row.work_diaries_pit?.work_diaries;
      if (row.ensaio_origem_id && diary) {
        next[row.ensaio_origem_id] = {
          clientName: diary.client_name || 'obra sem nome',
          date: diary.date || '',
          estacaNome: row.estaca_nome || '',
        };
      }
    });
    setImportMap((prev) => ({ ...prev, ...next }));
  };

  const load = async (nextOffset = 0) => {
    setLoading(true);
    setError('');
    try {
      const result = await fetchAllPitEnsaios({
        search: search.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: LIMIT,
        offset: nextOffset,
      });
      setEnsaios(result.ensaios);
      setTotal(result.total);
      setOffset(result.offset);
      loadImportStatus(result.ensaios.map((e) => e.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível listar os ensaios.');
      setEnsaios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const baixarBruto = async (ensaio: PitBrowseEnsaio) => {
    setBusyId(`${ensaio.id}-pte`);
    try {
      const { downloadUrl, nomeOriginal } = await fetchPitEnsaioSignal(ensaio.id);
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Falha ao baixar o arquivo do ensaio.');
      const bytes = await response.arrayBuffer();
      downloadBlobFile(bytes, nomeOriginal || ensaio.nomeOriginal || 'ensaio.pte');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível baixar o sinal.');
    } finally {
      setBusyId('');
    }
  };

  const baixarGrafico = async (ensaio: PitBrowseEnsaio) => {
    setBusyId(`${ensaio.id}-pdf`);
    try {
      const { downloadUrl } = await fetchPitEnsaioSignal(ensaio.id);
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error('Falha ao baixar o arquivo do ensaio.');
      const bytes = await response.arrayBuffer();
      const nome = (ensaio.nomeOriginal || 'ensaio').replace(/\.[^.]+$/, '');
      await generateSinalPdf(bytes, {
        estacaNome: nome,
        fileName: `sinal-${nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar o gráfico do sinal.');
    } finally {
      setBusyId('');
    }
  };

  const hasFilters = Boolean(search || dateFrom || dateTo);
  const clearFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); };
  const page = Math.floor(offset / LIMIT) + 1;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div>
      <PageHeader
        title="Ensaios PIT"
        eyebrow="SincroPIT"
        description="Tudo que foi enviado pelo equipamento pra o SincroPIT, com o que já virou estaca em algum diário e o que ainda está pendente."
      />

      <FilterBar className="mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(0); }}
            placeholder="Buscar por nome do arquivo ou pasta..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm text-gray-800 dark:text-gray-100"
          />
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
        />
        <button onClick={() => load(0)} className="btn-primary flex items-center gap-2 text-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Buscar
        </button>
        {hasFilters && (
          <button onClick={() => { clearFilters(); load(0); }} className="btn-secondary text-sm">Limpar</button>
        )}
      </FilterBar>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : ensaios.length === 0 ? (
        <Surface className="p-8 text-center">
          <Radio className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nenhum ensaio encontrado.</p>
        </Surface>
      ) : (
        <div className="space-y-2">
          {ensaios.map((ensaio) => {
            const info = importMap[ensaio.id];
            return (
              <Surface key={ensaio.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ensaio.nomeOriginal}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {ensaio.pastaOrigem || 'sem pasta'} • {formatDateTimeBR(ensaio.criadoNoEquipamento)}
                  </p>
                </div>
                {info ? (
                  <StatusBadge variant="success">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {info.clientName}{info.date ? ` • ${info.date.split('-').reverse().join('/')}` : ''}</span>
                  </StatusBadge>
                ) : (
                  <StatusBadge variant="neutral">Pendente de importação</StatusBadge>
                )}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => baixarGrafico(ensaio)}
                    disabled={busyId === `${ensaio.id}-pdf`}
                    className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Baixar gráfico do sinal (PDF)"
                  >
                    {busyId === `${ensaio.id}-pdf` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LineChart className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => baixarBruto(ensaio)}
                    disabled={busyId === `${ensaio.id}-pte`}
                    className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Baixar arquivo bruto do ensaio (.PTE)"
                  >
                    {busyId === `${ensaio.id}-pte` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  </button>
                </div>
              </Surface>
            );
          })}
        </div>
      )}

      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Página {page} de {totalPages} • {total} ensaios</span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0 || loading}
              onClick={() => load(Math.max(0, offset - LIMIT))}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              disabled={offset + LIMIT >= total || loading}
              onClick={() => load(offset + LIMIT)}
              className="btn-secondary text-sm disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
