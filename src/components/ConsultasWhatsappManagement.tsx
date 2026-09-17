import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, MessageCircle, CheckCircle2, XCircle, Edit } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import EmptyState from './EmptyState';
import FormInput from './FormInput';
import FormTextarea from './FormTextarea';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, IconButton, Modal, PageHeader, PeriodoFilterButtons, StatusBadge, Surface } from './ui';
import { Periodo, periodoSince } from '../lib/periodoFiltro';
import { WhatsappConnection } from './WhatsappConnection';

type Qualificacao = 'pendente' | 'qualificada' | 'desqualificada';

interface Consulta {
  id: string;
  numeroContato: string;
  nomeContato: string | null;
  primeiraMensagem: string | null;
  dataRecebimento: string;
  origem: string | null;
  qualificada: boolean | null;
  motivoDesqualificacao: string | null;
}

const emptyForm = {
  numeroContato: '',
  nomeContato: '',
  primeiraMensagem: '',
  origem: '',
  qualificada: null as boolean | null,
  motivoDesqualificacao: '',
};

type FormState = typeof emptyForm;

const qualificacaoDe = (c: Consulta): Qualificacao => c.qualificada === true ? 'qualificada' : c.qualificada === false ? 'desqualificada' : 'pendente';

const qualLabels: Record<Qualificacao, string> = { pendente: 'Pendente', qualificada: 'Qualificada', desqualificada: 'Desqualificada' };
const qualVariants: Record<Qualificacao, 'neutral' | 'success' | 'danger'> = { pendente: 'neutral', qualificada: 'success', desqualificada: 'danger' };

export const ConsultasWhatsappManagement: React.FC = () => {
  const toast = useToast();
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualFiltro, setQualFiltro] = useState<Qualificacao | 'todas'>('todas');
  const [periodo, setPeriodo] = useState<Periodo>('tudo');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Consulta | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const mapRow = (row: any): Consulta => ({
    id: row.id,
    numeroContato: row.numero_contato || '',
    nomeContato: row.nome_contato || null,
    primeiraMensagem: row.primeira_mensagem || null,
    dataRecebimento: row.data_recebimento,
    origem: row.origem || null,
    qualificada: row.qualificada,
    motivoDesqualificacao: row.motivo_desqualificacao || null,
  });

  const fetchData = async () => {
    if (!isSupabaseConfigured) { setConsultas([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('consultas_whatsapp').select('*').order('data_recebimento', { ascending: false });
      if (error) throw error;
      setConsultas((data || []).map(mapRow));
    } catch {
      toast.error('Não foi possível carregar as consultas. Tente novamente.');
      setConsultas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => consultas.filter((c) => {
    const since = periodoSince(periodo);
    if (since && new Date(c.dataRecebimento) < since) return false;
    if (qualFiltro !== 'todas' && qualificacaoDe(c) !== qualFiltro) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return c.numeroContato.includes(term) || (c.nomeContato || '').toLowerCase().includes(term) || (c.origem || '').toLowerCase().includes(term);
  }), [consultas, searchTerm, qualFiltro, periodo]);

  const totais = useMemo(() => {
    const total = filtered.length;
    const qualificadas = filtered.filter((c) => c.qualificada === true).length;
    const desqualificadas = filtered.filter((c) => c.qualificada === false).length;
    const pendentes = total - qualificadas - desqualificadas;
    return { total, qualificadas, desqualificadas, pendentes, pct: total > 0 ? (qualificadas / total) * 100 : 0 };
  }, [filtered]);

  const porOrigem = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((c) => { const key = c.origem?.trim() || 'Sem origem definida'; map.set(key, (map.get(key) || 0) + 1); });
    return Array.from(map.entries()).map(([origem, count]) => ({ origem, count })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const resetForm = () => setForm(emptyForm);
  const handleOpenNew = () => { setEditing(null); resetForm(); setShowModal(true); };
  const handleOpenEdit = (c: Consulta) => {
    setEditing(c);
    setForm({
      numeroContato: c.numeroContato,
      nomeContato: c.nomeContato || '',
      primeiraMensagem: c.primeiraMensagem || '',
      origem: c.origem || '',
      qualificada: c.qualificada,
      motivoDesqualificacao: c.motivoDesqualificacao || '',
    });
    setShowModal(true);
  };
  const handleCloseModal = () => { setShowModal(false); setEditing(null); resetForm(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numeroContato.trim()) { toast.error('Informe o número de contato.'); return; }
    if (form.qualificada === false && !form.motivoDesqualificacao.trim()) {
      toast.error('Informe o motivo da desqualificação.');
      return;
    }
    const payload = {
      numero_contato: form.numeroContato.trim(),
      nome_contato: form.nomeContato.trim() || null,
      primeira_mensagem: form.primeiraMensagem.trim() || null,
      origem: form.origem.trim() || null,
      qualificada: form.qualificada,
      motivo_desqualificacao: form.qualificada === false ? (form.motivoDesqualificacao.trim() || null) : null,
    };
    try {
      setLoading(true);
      if (editing) {
        const { error } = await supabase.from('consultas_whatsapp').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Consulta atualizada.');
      } else {
        const { error } = await supabase.from('consultas_whatsapp').insert(payload);
        if (error) throw error;
        toast.success('Consulta cadastrada.');
      }
      handleCloseModal();
      fetchData();
    } catch {
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const marcarQualificacao = async (c: Consulta, qualificada: boolean) => {
    if (!qualificada) { handleOpenEdit(c); return; } // desqualificar exige motivo, abre modal
    try {
      const { error } = await supabase.from('consultas_whatsapp').update({ qualificada: true, motivo_desqualificacao: null }).eq('id', c.id);
      if (error) throw error;
      fetchData();
    } catch {
      toast.error('Não foi possível atualizar.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Consultas WhatsApp"
        description="Consultas recebidas via Evolution API — qualifique e classifique a origem conforme forem chegando."
        eyebrow="Comercial"
        actions={
          <button onClick={handleOpenNew} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            <span>Cadastro manual</span>
          </button>
        }
      />

      <WhatsappConnection />

      <FilterBar>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número, nome ou origem..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={qualFiltro}
          onChange={(e) => setQualFiltro(e.target.value as Qualificacao | 'todas')}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
        >
          <option value="todas">Todas</option>
          <option value="pendente">Pendente</option>
          <option value="qualificada">Qualificada</option>
          <option value="desqualificada">Desqualificada</option>
        </select>
        <button onClick={fetchData} disabled={loading} className="text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50">
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
        <PeriodoFilterButtons value={periodo} onChange={setPeriodo} />
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total recebidas</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{totais.total}</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Qualificadas</p>
          <p className="text-xl font-semibold text-emerald-600">{totais.qualificadas}</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Desqualificadas</p>
          <p className="text-xl font-semibold text-red-600">{totais.desqualificadas}</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Taxa de qualificação</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{totais.pct.toFixed(0)}%</p>
          <p className="text-xs text-gray-400">{totais.pendentes} pendentes</p>
        </div></Surface>
      </div>

      {porOrigem.length > 0 && (
        <Surface>
          <div className="p-4 mb-6">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Por origem</p>
            <div className="space-y-2">
              {porOrigem.map((o) => {
                const max = Math.max(...porOrigem.map((x) => x.count), 1);
                const pct = (o.count / max) * 100;
                return (
                  <div key={o.origem} className="flex items-center gap-3">
                    <span className="w-36 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{o.origem}</span>
                    <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full bg-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs text-gray-600 dark:text-gray-300">{o.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Surface>
      )}

      <div className="space-y-3">
        {filtered.map((c) => (
          <Surface key={c.id}>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">{c.nomeContato || c.numeroContato}</span>
                  <StatusBadge variant={qualVariants[qualificacaoDe(c)]}>{qualLabels[qualificacaoDe(c)]}</StatusBadge>
                  {c.origem && <StatusBadge variant="info">{c.origem}</StatusBadge>}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{c.numeroContato}{c.primeiraMensagem ? ` · "${c.primeiraMensagem}"` : ''}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(c.dataRecebimento).toLocaleString('pt-BR')}</p>
                {c.motivoDesqualificacao && <p className="text-xs text-red-500 mt-1">{c.motivoDesqualificacao}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <IconButton icon={CheckCircle2} label="Marcar como qualificada" tone="primary" onClick={() => marcarQualificacao(c, true)} />
                <IconButton icon={XCircle} label="Marcar como desqualificada" tone="danger" onClick={() => marcarQualificacao(c, false)} />
                <IconButton icon={Edit} label="Editar consulta" tone="neutral" onClick={() => handleOpenEdit(c)} />
              </div>
            </div>
          </Surface>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="Nenhuma consulta registrada"
          description="Assim que a instância do WhatsApp (Evolution API) estiver conectada, as consultas caem aqui sozinhas. Também dá pra cadastrar manualmente."
          actionLabel="Cadastro manual"
          onAction={handleOpenNew}
        />
      )}

      <Modal open={showModal} onClose={handleCloseModal} title={editing ? 'Editar consulta' : 'Nova consulta'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput label="Número de contato" type="text" value={form.numeroContato} onChange={(e) => setForm((f) => ({ ...f, numeroContato: e.target.value }))} required placeholder="5511999999999" />
          <FormInput label="Nome do contato" type="text" value={form.nomeContato} onChange={(e) => setForm((f) => ({ ...f, nomeContato: e.target.value }))} />
          <FormTextarea label="Primeira mensagem" value={form.primeiraMensagem} onChange={(e) => setForm((f) => ({ ...f, primeiraMensagem: e.target.value }))} rows={2} />
          <FormInput label="Origem" type="text" value={form.origem} onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))} placeholder="Marketing, indicação, orgânico..." />

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Qualificação</label>
            <select
              value={form.qualificada === null ? 'pendente' : form.qualificada ? 'qualificada' : 'desqualificada'}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({ ...f, qualificada: v === 'pendente' ? null : v === 'qualificada' }));
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="pendente">Pendente</option>
              <option value="qualificada">Qualificada</option>
              <option value="desqualificada">Desqualificada</option>
            </select>
          </div>

          {form.qualificada === false && (
            <FormTextarea label="Motivo da desqualificação" value={form.motivoDesqualificacao} onChange={(e) => setForm((f) => ({ ...f, motivoDesqualificacao: e.target.value }))} rows={2} required />
          )}

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-2">
            <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
            <button type="submit" disabled={loading} className="w-full sm:w-auto px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? 'Salvando...' : editing ? 'Atualizar' : 'Cadastrar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
