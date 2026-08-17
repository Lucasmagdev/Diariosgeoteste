import React, { useEffect, useMemo, useState } from 'react';
import { Star, TrendingUp, Users, Eye, Download, Trash2, MessageSquare } from 'lucide-react';
import { SatisfactionSurveyResponse } from '../types';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, Modal, PageHeader, StatusBadge, Surface, IconButton } from './ui';
import { mapSurveyResponse, SURVEY_RATING_LABELS } from './PortalManagement';
import { generateSurveyPdf } from '../utils/surveyPdf';

interface ObraLite { id: string; name: string; clientId: string; }
interface ClientLite { id: string; name: string; }

const npsVariant = (nps: number) => (nps >= 9 ? 'success' : nps >= 7 ? 'warning' : 'danger') as const;
const scoreVariant = (n: number) => (n >= 4 ? 'success' : n === 3 ? 'warning' : 'danger') as const;

export const SatisfactionSurveys: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<SatisfactionSurveyResponse[]>([]);
  const [obras, setObras] = useState<ObraLite[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientFilter, setClientFilter] = useState('');
  const [obraFilter, setObraFilter] = useState('');
  const [viewResponse, setViewResponse] = useState<SatisfactionSurveyResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; response?: SatisfactionSurveyResponse }>({ open: false });

  const fetchAll = async () => {
    if (!isSupabaseConfigured) { toast.error('Supabase não configurado.'); return; }
    setLoading(true);
    try {
      const [r, o, c] = await Promise.all([
        supabase.from('satisfaction_survey_responses').select('*').order('created_at', { ascending: false }),
        supabase.from('obras').select('id, name, client_id'),
        supabase.from('clients').select('id, name'),
      ]);
      if (r.error) throw r.error;
      if (o.error) throw o.error;
      if (c.error) throw c.error;
      setResponses((r.data || []).map(mapSurveyResponse));
      setObras((o.data || []).map((row: any) => ({ id: row.id, name: row.name, clientId: row.client_id })));
      setClients((c.data || []).map((row: any) => ({ id: row.id, name: row.name })));
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar pesquisas de satisfação.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const obraById = (id: string) => obras.find(o => o.id === id);
  const clientNameForObra = (obraId: string) => {
    const obra = obraById(obraId);
    if (!obra) return '—';
    return clients.find(c => c.id === obra.clientId)?.name || '—';
  };

  const obrasForClientFilter = useMemo(
    () => (clientFilter ? obras.filter(o => o.clientId === clientFilter) : obras),
    [obras, clientFilter],
  );

  const filtered = useMemo(() => {
    return responses.filter(r => {
      if (obraFilter && r.obraId !== obraFilter) return false;
      if (clientFilter && obraById(r.obraId)?.clientId !== clientFilter) return false;
      return true;
    });
  }, [responses, obraFilter, clientFilter, obras]);

  const stats = useMemo(() => {
    const total = filtered.length;
    if (total === 0) {
      return { total: 0, avgGeral: 0, avgNps: 0, npsScore: 0, promoters: 0, passives: 0, detractors: 0 };
    }
    const avgGeral = filtered.reduce((s, r) => s + (r.avaliacaoGeral || 0), 0) / total;
    const avgNps = filtered.reduce((s, r) => s + (r.nps ?? 0), 0) / total;
    const promoters = filtered.filter(r => r.nps >= 9).length;
    const passives = filtered.filter(r => r.nps >= 7 && r.nps <= 8).length;
    const detractors = filtered.filter(r => r.nps <= 6).length;
    const npsScore = Math.round(((promoters - detractors) / total) * 100);
    return { total, avgGeral, avgNps, npsScore, promoters, passives, detractors };
  }, [filtered]);

  const downloadPdf = async (r: SatisfactionSurveyResponse) => {
    try {
      await generateSurveyPdf({
        obraName: r.obraNome, empresa: r.empresa, dataReferencia: r.dataReferencia, createdAt: r.createdAt,
        ratings: Object.entries(r.ratings || {}).map(([key, value]) => ({ label: SURVEY_RATING_LABELS[key] || key, value: value as number })),
        avaliacaoGeral: r.avaliacaoGeral, nps: r.nps,
        indicacaoEmpresas: r.indicacaoEmpresas,
        comentarioAgradou: r.comentarioAgradou, comentarioMelhorar: r.comentarioMelhorar, comentarioObservacao: r.comentarioObservacao,
      }, `pesquisa-satisfacao-${(r.empresa || 'resposta').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
    } catch (err) {
      console.error('survey pdf', err);
      toast.error('Falha ao gerar PDF.');
    }
  };

  const deleteResponse = async () => {
    const r = confirmDelete.response;
    if (!r) return;
    try {
      const { error } = await supabase.from('satisfaction_survey_responses').delete().eq('id', r.id);
      if (error) throw error;
      setResponses(prev => prev.filter(x => x.id !== r.id));
      toast.success('Resposta removida.');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao remover resposta.');
    } finally {
      setConfirmDelete({ open: false });
    }
  };

  return (
    <div>
      <PageHeader
        title="Pesquisas de Satisfação"
        eyebrow="Gestão"
        description="NPS e avaliações recebidas de todos os clientes, num só lugar."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Surface className="p-4">
          <p className="text-xs text-gray-500 mb-1">Respostas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> NPS</p>
          <p className={`text-2xl font-bold ${stats.npsScore >= 50 ? 'text-emerald-600' : stats.npsScore >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
            {stats.total > 0 ? stats.npsScore : '—'}
          </p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Nota média</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total > 0 ? stats.avgGeral.toFixed(1) : '—'}<span className="text-sm font-normal text-gray-400">/5</span></p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Promotores / Detratores</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.promoters} <span className="text-sm font-normal text-gray-400">/</span> {stats.detractors}</p>
        </Surface>
      </div>

      <FilterBar className="mb-4">
        <select
          value={clientFilter}
          onChange={(e) => { setClientFilter(e.target.value); setObraFilter(''); }}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
        >
          <option value="">Todos os clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={obraFilter}
          onChange={(e) => setObraFilter(e.target.value)}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
        >
          <option value="">Todas as obras</option>
          {obrasForClientFilter.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {(clientFilter || obraFilter) && (
          <button onClick={() => { setClientFilter(''); setObraFilter(''); }} className="btn-secondary text-sm">Limpar</button>
        )}
      </FilterBar>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Surface className="p-8 text-center">
          <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nenhuma resposta recebida ainda.</p>
        </Surface>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Surface key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.empresa || 'Empresa não informada'}</p>
                <p className="text-xs text-gray-500 truncate">{r.obraNome || obraById(r.obraId)?.name || '—'} • {clientNameForObra(r.obraId)}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleString('pt-BR')}</p>
              </div>
              <StatusBadge variant={scoreVariant(r.avaliacaoGeral)}>Nota {r.avaliacaoGeral}/5</StatusBadge>
              <StatusBadge variant={npsVariant(r.nps)}>NPS {r.nps}</StatusBadge>
              <IconButton icon={Eye} label="Ver detalhes" tone="primary" onClick={() => setViewResponse(r)} />
              <IconButton icon={Download} label="Gerar PDF" tone="primary" onClick={() => downloadPdf(r)} />
              <IconButton icon={Trash2} label="Remover" tone="danger" onClick={() => setConfirmDelete({ open: true, response: r })} />
            </Surface>
          ))}
        </div>
      )}

      <Modal open={!!viewResponse} onClose={() => setViewResponse(null)} title="Resposta da pesquisa de satisfação" size="lg">
        {viewResponse && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{viewResponse.empresa || 'Empresa não informada'}</p>
                <p className="text-xs text-gray-500">
                  {viewResponse.obraNome || obraById(viewResponse.obraId)?.name} • {clientNameForObra(viewResponse.obraId)} • {new Date(viewResponse.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <button onClick={() => downloadPdf(viewResponse)} className="btn-secondary flex items-center gap-2 text-sm">
                <Download className="h-4 w-4" /> Gerar PDF
              </button>
            </div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {Object.entries(viewResponse.ratings || {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
                  <p className="text-sm text-gray-900 dark:text-white">{SURVEY_RATING_LABELS[key] || key}</p>
                  <StatusBadge variant={(value as number) >= 4 ? 'success' : (value as number) === 3 ? 'warning' : 'danger'}>{String(value)}/5</StatusBadge>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-emerald-50/50 dark:bg-emerald-900/10">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Avaliação geral</p>
                <StatusBadge variant={scoreVariant(viewResponse.avaliacaoGeral)}>{viewResponse.avaliacaoGeral}/5</StatusBadge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 bg-emerald-50/50 dark:bg-emerald-900/10">
                <p className="text-sm font-medium text-gray-900 dark:text-white">NPS (recomendação)</p>
                <StatusBadge variant={npsVariant(viewResponse.nps)}>{viewResponse.nps}/10</StatusBadge>
              </div>
              {viewResponse.indicacaoEmpresas && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Empresas indicadas</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{viewResponse.indicacaoEmpresas}</p>
                </div>
              )}
              {viewResponse.comentarioAgradou && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">O que mais agradou</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{viewResponse.comentarioAgradou}</p>
                </div>
              )}
              {viewResponse.comentarioMelhorar && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Pontos de melhoria</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{viewResponse.comentarioMelhorar}</p>
                </div>
              )}
              {viewResponse.comentarioObservacao && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Elogios, sugestões ou observações</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200">{viewResponse.comentarioObservacao}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false })}
        onConfirm={deleteResponse}
        title="Remover resposta"
        message={`Remover a resposta de "${confirmDelete.response?.empresa || 'empresa não informada'}"?`}
        confirmText="Remover" cancelText="Cancelar" type="danger"
      />
    </div>
  );
};
