import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Trash2, AlertTriangle, CheckCircle2, Clock, ClipboardList } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import FormInput from './FormInput';
import FormTextarea from './FormTextarea';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, Modal, PageHeader, PeriodoFilterButtons, StatusBadge, Surface } from './ui';
import { Periodo, periodoSince } from '../lib/periodoFiltro';

interface ObraAcompanhamento {
  id: string;
  obraCode: string | null;
  name: string;
  clientName: string | null;
  status: string;
  dataInicio: string | null;
  dataPrevisaoFim: string | null;
  dataFimReal: string | null;
  valorInicial: number | null;
  valorFinal: number | null;
  motivoEncerramento: string | null;
}

interface Pausa {
  id: string;
  obraId: string;
  dataInicio: string;
  dataFim: string | null;
  motivo: string;
}

interface Ocorrencia {
  date: string;
  diaryType: string;
  texto: string;
}

const DIARY_TABLE_BY_TYPE: Record<string, string> = {
  PCE: 'work_diaries_pce',
  PIT: 'work_diaries_pit',
  PLACA: 'work_diaries_placa',
  PDA_DIARIO: 'work_diaries_pda_diario',
};

const currency = (value: number | null) => value == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const fmtDate = (d: string | null) => d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR') : '—';

type PrazoStatus = 'atrasada' | 'no_prazo' | 'sem_prazo';

const prazoStatus = (obra: ObraAcompanhamento): PrazoStatus => {
  if (!obra.dataPrevisaoFim) return 'sem_prazo';
  const hoje = new Date().toISOString().slice(0, 10);
  if (obra.dataFimReal) {
    return obra.dataFimReal <= obra.dataPrevisaoFim ? 'no_prazo' : 'atrasada';
  }
  return hoje > obra.dataPrevisaoFim ? 'atrasada' : 'no_prazo';
};

const prazoBadge: Record<PrazoStatus, { label: string; variant: 'danger' | 'success' | 'neutral'; icon: React.ElementType }> = {
  atrasada: { label: 'Atrasada', variant: 'danger', icon: AlertTriangle },
  no_prazo: { label: 'No prazo', variant: 'success', icon: CheckCircle2 },
  sem_prazo: { label: 'Sem prazo definido', variant: 'neutral', icon: Clock },
};

export const AcompanhamentoObraManagement: React.FC = () => {
  const toast = useToast();
  const [obras, setObras] = useState<ObraAcompanhamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [prazoFiltro, setPrazoFiltro] = useState<PrazoStatus | 'todas'>('todas');
  const [periodo, setPeriodo] = useState<Periodo>('tudo');

  const [selectedObra, setSelectedObra] = useState<ObraAcompanhamento | null>(null);
  const [detailForm, setDetailForm] = useState({
    dataInicio: '', dataPrevisaoFim: '', dataFimReal: '', valorInicial: '', valorFinal: '', motivoEncerramento: '',
  });
  const [pausas, setPausas] = useState<Pausa[]>([]);
  const [novaPausa, setNovaPausa] = useState({ dataInicio: '', dataFim: '', motivo: '' });
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  const mapRow = (row: any): ObraAcompanhamento => ({
    id: row.id,
    obraCode: row.obra_code,
    name: row.name || '',
    clientName: row.clients?.name || null,
    status: row.status,
    dataInicio: row.data_inicio,
    dataPrevisaoFim: row.data_previsao_fim,
    dataFimReal: row.data_fim_real,
    valorInicial: row.valor_inicial != null ? Number(row.valor_inicial) : null,
    valorFinal: row.valor_final != null ? Number(row.valor_final) : null,
    motivoEncerramento: row.motivo_encerramento,
  });

  const fetchObras = async () => {
    if (!isSupabaseConfigured) { setObras([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('id, obra_code, name, status, data_inicio, data_previsao_fim, data_fim_real, valor_inicial, valor_final, motivo_encerramento, clients(name)')
        .order('name');
      if (error) throw error;
      setObras((data || []).map(mapRow));
    } catch {
      toast.error('Não foi possível carregar as obras. Tente novamente.');
      setObras([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchObras(); }, []);

  const filtered = useMemo(() => obras.filter((o) => {
    const since = periodoSince(periodo);
    if (since && o.dataInicio && new Date(o.dataInicio) < since) return false;
    if (prazoFiltro !== 'todas' && prazoStatus(o) !== prazoFiltro) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return o.name.toLowerCase().includes(term) || (o.obraCode || '').toLowerCase().includes(term) || (o.clientName || '').toLowerCase().includes(term);
  }), [obras, searchTerm, prazoFiltro, periodo]);

  const openDetail = async (obra: ObraAcompanhamento) => {
    setSelectedObra(obra);
    setDetailForm({
      dataInicio: obra.dataInicio || '',
      dataPrevisaoFim: obra.dataPrevisaoFim || '',
      dataFimReal: obra.dataFimReal || '',
      valorInicial: obra.valorInicial != null ? String(obra.valorInicial) : '',
      valorFinal: obra.valorFinal != null ? String(obra.valorFinal) : '',
      motivoEncerramento: obra.motivoEncerramento || '',
    });
    setNovaPausa({ dataInicio: '', dataFim: '', motivo: '' });
    setLoadingDetail(true);
    try {
      const [pausasRes, diariosRes] = await Promise.all([
        supabase.from('obra_pausas').select('*').eq('obra_id', obra.id).order('data_inicio', { ascending: false }),
        supabase.from('work_diaries').select('id, date, diary_type').eq('obra_id', obra.id).order('date', { ascending: false }),
      ]);

      setPausas((pausasRes.data || []).map((p: any) => ({ id: p.id, obraId: p.obra_id, dataInicio: p.data_inicio, dataFim: p.data_fim, motivo: p.motivo })));

      const diarios = diariosRes.data || [];
      const byType: Record<string, string[]> = {};
      diarios.forEach((d: any) => { (byType[d.diary_type] ||= []).push(d.id); });

      const ocorrenciasEncontradas: Ocorrencia[] = [];
      for (const [type, ids] of Object.entries(byType)) {
        const table = DIARY_TABLE_BY_TYPE[type];
        if (!table || ids.length === 0) continue;
        const { data: rows } = await supabase.from(table).select('diary_id, ocorrencias').in('diary_id', ids);
        (rows || []).forEach((r: any) => {
          if (!r.ocorrencias?.trim()) return;
          const diario = diarios.find((d: any) => d.id === r.diary_id);
          ocorrenciasEncontradas.push({ date: diario?.date || '', diaryType: type, texto: r.ocorrencias });
        });
      }
      setOcorrencias(ocorrenciasEncontradas.sort((a, b) => b.date.localeCompare(a.date)));
    } catch {
      toast.error('Não foi possível carregar os detalhes da obra.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => { setSelectedObra(null); setPausas([]); setOcorrencias([]); };

  const handleSaveDetail = async () => {
    if (!selectedObra) return;
    if (detailForm.dataFimReal && !detailForm.motivoEncerramento.trim()) {
      toast.error('Informe o motivo ao encerrar a obra (terminou antes ou depois do previsto, por quê).');
      return;
    }
    try {
      setLoadingDetail(true);
      const { error } = await supabase.from('obras').update({
        data_inicio: detailForm.dataInicio || null,
        data_previsao_fim: detailForm.dataPrevisaoFim || null,
        data_fim_real: detailForm.dataFimReal || null,
        valor_inicial: detailForm.valorInicial ? Number(detailForm.valorInicial) : null,
        valor_final: detailForm.valorFinal ? Number(detailForm.valorFinal) : null,
        motivo_encerramento: detailForm.dataFimReal ? detailForm.motivoEncerramento.trim() : null,
      }).eq('id', selectedObra.id);
      if (error) throw error;
      toast.success('Acompanhamento atualizado.');
      await fetchObras();
      closeDetail();
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddPausa = async () => {
    if (!selectedObra) return;
    if (!novaPausa.dataInicio || !novaPausa.motivo.trim()) {
      toast.error('Informe a data de início e o motivo da pausa.');
      return;
    }
    try {
      const { error } = await supabase.from('obra_pausas').insert({
        obra_id: selectedObra.id,
        data_inicio: novaPausa.dataInicio,
        data_fim: novaPausa.dataFim || null,
        motivo: novaPausa.motivo.trim(),
      });
      if (error) throw error;
      const { data } = await supabase.from('obra_pausas').select('*').eq('obra_id', selectedObra.id).order('data_inicio', { ascending: false });
      setPausas((data || []).map((p: any) => ({ id: p.id, obraId: p.obra_id, dataInicio: p.data_inicio, dataFim: p.data_fim, motivo: p.motivo })));
      setNovaPausa({ dataInicio: '', dataFim: '', motivo: '' });
      toast.success('Pausa registrada.');
    } catch {
      toast.error('Não foi possível registrar a pausa.');
    }
  };

  const handleDeletePausa = async () => {
    const { id } = confirmDialog;
    if (!id) return;
    try {
      const { error } = await supabase.from('obra_pausas').delete().eq('id', id);
      if (error) throw error;
      setPausas((prev) => prev.filter((p) => p.id !== id));
      toast.success('Pausa removida.');
    } catch {
      toast.error('Não foi possível remover a pausa.');
    } finally {
      setConfirmDialog({ isOpen: false, id: null });
    }
  };

  return (
    <div>
      <PageHeader
        title="Acompanhamento de Obra"
        description="Prazo, pausas, ocorrências do diário e fechamento financeiro de cada obra."
        eyebrow="Comercial"
      />

      <FilterBar>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por obra, código ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={prazoFiltro}
          onChange={(e) => setPrazoFiltro(e.target.value as PrazoStatus | 'todas')}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
        >
          <option value="todas">Todos os prazos</option>
          <option value="atrasada">Atrasada</option>
          <option value="no_prazo">No prazo</option>
          <option value="sem_prazo">Sem prazo definido</option>
        </select>
        <button onClick={fetchObras} disabled={loading} className="text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50">
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
        <PeriodoFilterButtons value={periodo} onChange={setPeriodo} />
      </FilterBar>

      <div className="space-y-3">
        {filtered.map((o) => {
          const st = prazoStatus(o);
          const Badge = prazoBadge[st];
          const delta = o.valorInicial != null && o.valorFinal != null ? o.valorFinal - o.valorInicial : null;
          return (
            <Surface key={o.id} interactive onClick={() => openDetail(o)} className="cursor-pointer">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white">{o.obraCode ? `${o.obraCode} — ${o.name}` : o.name}</span>
                    <StatusBadge variant={Badge.variant}><Badge.icon className="inline h-3 w-3 mr-1" />{Badge.label}</StatusBadge>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{o.clientName || 'Sem cliente'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Início {fmtDate(o.dataInicio)} · Previsão {fmtDate(o.dataPrevisaoFim)}{o.dataFimReal ? ` · Encerrada ${fmtDate(o.dataFimReal)}` : ''}
                  </p>
                </div>
                {delta != null && (
                  <span className={`text-sm font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {delta >= 0 ? '+' : ''}{currency(delta)} vs. inicial
                  </span>
                )}
              </div>
            </Surface>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma obra encontrada"
          description="Cadastre obras na aba Obras — elas aparecem aqui pra acompanhamento de prazo e fechamento."
        />
      )}

      <Modal open={!!selectedObra} onClose={closeDetail} title={selectedObra ? (selectedObra.obraCode ? `${selectedObra.obraCode} — ${selectedObra.name}` : selectedObra.name) : ''} size="lg">
        {selectedObra && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Prazo e valores</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormInput label="Data de início" type="date" value={detailForm.dataInicio} onChange={(e) => setDetailForm((f) => ({ ...f, dataInicio: e.target.value }))} />
                <FormInput label="Previsão de término" type="date" value={detailForm.dataPrevisaoFim} onChange={(e) => setDetailForm((f) => ({ ...f, dataPrevisaoFim: e.target.value }))} />
                <FormInput label="Data de encerramento real" type="date" value={detailForm.dataFimReal} onChange={(e) => setDetailForm((f) => ({ ...f, dataFimReal: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <FormInput label="Valor inicial do contrato (R$)" type="number" value={detailForm.valorInicial} onChange={(e) => setDetailForm((f) => ({ ...f, valorInicial: e.target.value }))} />
                <FormInput label="Valor final recebido (R$)" type="number" value={detailForm.valorFinal} onChange={(e) => setDetailForm((f) => ({ ...f, valorFinal: e.target.value }))} />
              </div>
              {detailForm.dataFimReal && (
                <div className="mt-3">
                  <FormTextarea
                    label="Motivo do encerramento (obrigatório) — por que terminou antes/depois, aditivo, saída antecipada, inadimplência etc."
                    value={detailForm.motivoEncerramento}
                    onChange={(e) => setDetailForm((f) => ({ ...f, motivoEncerramento: e.target.value }))}
                    rows={3}
                    required
                  />
                </div>
              )}
              <div className="flex justify-end pt-3">
                <button onClick={handleSaveDetail} disabled={loadingDetail} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {loadingDetail ? 'Salvando...' : 'Salvar acompanhamento'}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Pausas</h3>
              <div className="space-y-2 mb-3">
                {pausas.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
                    <span>{fmtDate(p.dataInicio)} {p.dataFim ? `– ${fmtDate(p.dataFim)}` : '(em aberto)'} · {p.motivo}</span>
                    <button onClick={() => setConfirmDialog({ isOpen: true, id: p.id })} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {pausas.length === 0 && <p className="text-xs text-gray-400">Nenhuma pausa registrada.</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <FormInput label="Início" type="date" value={novaPausa.dataInicio} onChange={(e) => setNovaPausa((p) => ({ ...p, dataInicio: e.target.value }))} className="sm:col-span-1" />
                <FormInput label="Fim (opcional)" type="date" value={novaPausa.dataFim} onChange={(e) => setNovaPausa((p) => ({ ...p, dataFim: e.target.value }))} className="sm:col-span-1" />
                <FormInput label="Motivo" type="text" value={novaPausa.motivo} onChange={(e) => setNovaPausa((p) => ({ ...p, motivo: e.target.value }))} className="sm:col-span-1" />
                <button onClick={handleAddPausa} className="sm:col-span-1 flex items-center justify-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Plus className="h-4 w-4" /> Adicionar
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Ocorrências (puxadas dos diários desta obra)</h3>
              {loadingDetail && <p className="text-xs text-gray-400">Carregando...</p>}
              <div className="space-y-2">
                {ocorrencias.map((o, idx) => (
                  <div key={idx} className="text-sm bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(o.date)} · {o.diaryType}</span>
                    <p className="text-gray-700 dark:text-gray-200">{o.texto}</p>
                  </div>
                ))}
                {!loadingDetail && ocorrencias.length === 0 && <p className="text-xs text-gray-400">Nenhuma ocorrência lançada nos diários vinculados a esta obra.</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, id: null })}
        onConfirm={handleDeletePausa}
        title="Excluir Pausa"
        message="Tem certeza que deseja excluir essa pausa? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};
