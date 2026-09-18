import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, MapPinned, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import FormInput from './FormInput';
import FormTextarea from './FormTextarea';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, IconButton, Modal, PageHeader, PeriodoFilterButtons, StatusBadge, Surface } from './ui';
import { ObraSelector, ObraOption } from './ObraSelector';
import { Periodo, periodoSince } from '../lib/periodoFiltro';

type Resultado = 'pendente' | 'fechado' | 'perdido';

interface Visita {
  id: string;
  obraId: string | null;
  obraNome: string | null;
  numero: string | null;
  engenheiroResponsavel: string;
  dataVisita: string;
  observacoes: string | null;
  resultado: Resultado;
  createdAt: string;
}

const emptyForm = {
  obraId: '' as string | null,
  obraNome: '',
  numero: '',
  engenheiroResponsavel: '',
  dataVisita: '',
  observacoes: '',
  resultado: 'pendente' as Resultado,
};

type FormState = typeof emptyForm;

const resultadoLabels: Record<Resultado, string> = { pendente: 'Pendente', fechado: 'Fechado', perdido: 'Perdido' };
const resultadoVariants: Record<Resultado, 'neutral' | 'success' | 'danger'> = { pendente: 'neutral', fechado: 'success', perdido: 'danger' };

export const VisitasTecnicasManagement: React.FC = () => {
  const toast = useToast();
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [obras, setObras] = useState<ObraOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [engenheiroFiltro, setEngenheiroFiltro] = useState('');
  const [resultadoFiltro, setResultadoFiltro] = useState<Resultado | 'todas'>('todas');
  const [periodo, setPeriodo] = useState<Periodo>('tudo');

  const [showModal, setShowModal] = useState(false);
  const [editingVisita, setEditingVisita] = useState<Visita | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; id: string | null; label: string | null }>({ isOpen: false, id: null, label: null });

  const mapRow = (row: any): Visita => ({
    id: row.id,
    obraId: row.obra_id || null,
    obraNome: row.obra_nome || null,
    numero: row.numero || null,
    engenheiroResponsavel: row.engenheiro_responsavel || '',
    dataVisita: row.data_visita,
    observacoes: row.observacoes || null,
    resultado: row.resultado || 'pendente',
    createdAt: row.created_at || new Date().toISOString(),
  });

  const fetchVisitas = async () => {
    if (!isSupabaseConfigured) { setVisitas([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('visitas_tecnicas').select('*').order('data_visita', { ascending: false });
      if (error) throw error;
      setVisitas((data || []).map(mapRow));
    } catch {
      toast.error('Não foi possível carregar as visitas comerciais. Tente novamente.');
      setVisitas([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchObras = async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.from('obras').select('id, obra_code, name, client_id, clients(name)').order('name');
    if (!error) {
      setObras((data || []).map((o: any) => ({
        id: o.id, obraCode: o.obra_code, name: o.name, clientId: o.client_id, clientName: o.clients?.name || null,
      })));
    }
  };

  useEffect(() => { fetchVisitas(); fetchObras(); }, []);

  const filtered = useMemo(() => visitas.filter((v) => {
    const since = periodoSince(periodo);
    if (since && new Date(v.dataVisita) < since) return false;
    if (resultadoFiltro !== 'todas' && v.resultado !== resultadoFiltro) return false;
    if (engenheiroFiltro.trim() && !v.engenheiroResponsavel.toLowerCase().includes(engenheiroFiltro.trim().toLowerCase())) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (v.obraNome || '').toLowerCase().includes(term) || v.engenheiroResponsavel.toLowerCase().includes(term);
  }), [visitas, searchTerm, engenheiroFiltro, resultadoFiltro, periodo]);

  const totais = useMemo(() => {
    const total = filtered.length;
    const fechadas = filtered.filter((v) => v.resultado === 'fechado').length;
    const perdidas = filtered.filter((v) => v.resultado === 'perdido').length;
    const decididas = fechadas + perdidas;
    return { total, fechadas, perdidas, pendentes: total - fechadas - perdidas, taxa: decididas > 0 ? (fechadas / decididas) * 100 : null };
  }, [filtered]);

  const porEngenheiro = useMemo(() => {
    const map = new Map<string, { total: number; fechadas: number }>();
    filtered.forEach((v) => {
      const entry = map.get(v.engenheiroResponsavel) || { total: 0, fechadas: 0 };
      entry.total += 1;
      if (v.resultado === 'fechado') entry.fechadas += 1;
      map.set(v.engenheiroResponsavel, entry);
    });
    return Array.from(map.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const resetForm = () => setForm(emptyForm);

  const handleOpenNew = () => { setEditingVisita(null); resetForm(); setShowModal(true); };

  const handleOpenEdit = (v: Visita) => {
    setEditingVisita(v);
    setForm({
      obraId: v.obraId,
      obraNome: v.obraNome || '',
      numero: v.numero || '',
      engenheiroResponsavel: v.engenheiroResponsavel,
      dataVisita: v.dataVisita,
      observacoes: v.observacoes || '',
      resultado: v.resultado,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => { setShowModal(false); setEditingVisita(null); resetForm(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.engenheiroResponsavel.trim() || !form.dataVisita) {
      toast.error('Preencha o engenheiro responsável e a data da visita.');
      return;
    }

    const payload = {
      obra_id: form.obraId || null,
      obra_nome: form.obraNome.trim() || null,
      numero: form.numero.trim() || null,
      engenheiro_responsavel: form.engenheiroResponsavel.trim(),
      data_visita: form.dataVisita,
      observacoes: form.observacoes.trim() || null,
      resultado: form.resultado,
    };

    try {
      setLoading(true);
      if (editingVisita) {
        const { error } = await supabase.from('visitas_tecnicas').update(payload).eq('id', editingVisita.id);
        if (error) throw error;
        toast.success('Visita atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('visitas_tecnicas').insert(payload);
        if (error) throw error;
        toast.success('Visita registrada com sucesso!');
      }
      handleCloseModal();
      fetchVisitas();
    } catch {
      toast.error('Não foi possível salvar a visita. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const marcarResultado = async (v: Visita, resultado: Resultado) => {
    try {
      const { error } = await supabase.from('visitas_tecnicas').update({ resultado }).eq('id', v.id);
      if (error) throw error;
      fetchVisitas();
    } catch {
      toast.error('Não foi possível atualizar.');
    }
  };

  const handleDeleteClick = (id: string, label: string) => setConfirmDialog({ isOpen: true, id, label });

  const handleDelete = async () => {
    const { id } = confirmDialog;
    if (!id) return;
    try {
      const { error } = await supabase.from('visitas_tecnicas').delete().eq('id', id);
      if (error) throw error;
      setVisitas((prev) => prev.filter((v) => v.id !== id));
      toast.success('Visita excluída.');
    } catch {
      toast.error('Não foi possível excluir a visita.');
    } finally {
      setConfirmDialog({ isOpen: false, id: null, label: null });
    }
  };

  return (
    <div>
      <PageHeader
        title="Visitas Comerciais"
        description="Visitas comerciais por obra e responsável — quantas viram negócio fechado."
        eyebrow="Comercial"
        actions={
          <button onClick={handleOpenNew} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            <span>Nova visita</span>
          </button>
        }
      />

      <FilterBar>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por obra ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <input
          type="text"
          placeholder="Filtrar por responsável..."
          value={engenheiroFiltro}
          onChange={(e) => setEngenheiroFiltro(e.target.value)}
          className="w-48 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
        />
        <select
          value={resultadoFiltro}
          onChange={(e) => setResultadoFiltro(e.target.value as Resultado | 'todas')}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
        >
          <option value="todas">Todos os resultados</option>
          <option value="pendente">Pendente</option>
          <option value="fechado">Fechado</option>
          <option value="perdido">Perdido</option>
        </select>
        <button onClick={fetchVisitas} disabled={loading} className="text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50">
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
        <PeriodoFilterButtons value={periodo} onChange={setPeriodo} />
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total de visitas</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{totais.total}</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Fechadas</p>
          <p className="text-xl font-semibold text-emerald-600">{totais.fechadas}</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Perdidas</p>
          <p className="text-xl font-semibold text-red-600">{totais.perdidas}</p>
        </div></Surface>
        <Surface><div className="p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Taxa de fechamento</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">{totais.taxa != null ? `${totais.taxa.toFixed(0)}%` : '—'}</p>
          <p className="text-xs text-gray-400">{totais.pendentes} pendentes</p>
        </div></Surface>
      </div>

      {porEngenheiro.length > 0 && (
        <div className="mb-6 space-y-2">
          {porEngenheiro.map((e) => {
            const max = Math.max(...porEngenheiro.map((x) => x.total), 1);
            const pct = (e.total / max) * 100;
            const pctFechadas = e.total > 0 ? (e.fechadas / e.total) * 100 : 0;
            return (
              <div key={e.nome} className="flex items-center gap-3">
                <span className="w-32 truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{e.nome}</span>
                <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden relative">
                  <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                  <div className="h-full bg-emerald-500 absolute top-0 left-0" style={{ width: `${(pctFechadas / 100) * pct}%` }} />
                </div>
                <span className="w-28 text-right text-xs text-gray-600 dark:text-gray-300">{e.total} visitas · {e.fechadas} fechadas</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((v) => (
          <Surface key={v.id}>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">{v.numero ? `Visita ${v.numero}` : 'Visita comercial'}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(v.dataVisita + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                  <StatusBadge variant={resultadoVariants[v.resultado]}>{resultadoLabels[v.resultado]}</StatusBadge>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{v.obraNome || 'Obra não vinculada'} · {v.engenheiroResponsavel}</p>
                {v.observacoes && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{v.observacoes}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {v.resultado === 'pendente' && (
                  <>
                    <IconButton icon={CheckCircle2} label="Marcar como fechado" tone="primary" onClick={() => marcarResultado(v, 'fechado')} />
                    <IconButton icon={XCircle} label="Marcar como perdido" tone="danger" onClick={() => marcarResultado(v, 'perdido')} />
                  </>
                )}
                <IconButton icon={Edit} label="Editar visita" tone="neutral" onClick={() => handleOpenEdit(v)} />
                <IconButton icon={Trash2} label="Excluir visita" tone="danger" onClick={() => handleDeleteClick(v.id, v.obraNome || v.engenheiroResponsavel)} />
              </div>
            </div>
          </Surface>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={MapPinned}
          title="Nenhuma visita registrada"
          description="Cadastre a primeira visita comercial."
          actionLabel="Nova visita"
          onAction={handleOpenNew}
        />
      )}

      <Modal open={showModal} onClose={handleCloseModal} title={editingVisita ? 'Editar visita' : 'Nova visita comercial'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Obra</label>
            <ObraSelector
              obras={obras}
              value={form.obraId || ''}
              onChange={(obra) => setForm((f) => ({ ...f, obraId: obra?.id || '', obraNome: obra ? obra.name : f.obraNome }))}
            />
          </div>
          <FormInput label="Nome da obra (texto livre)" type="text" value={form.obraNome} onChange={(e) => setForm((f) => ({ ...f, obraNome: e.target.value }))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput label="Número da visita" type="text" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} placeholder="Ex: 01" />
            <FormInput label="Data da visita" type="date" value={form.dataVisita} onChange={(e) => setForm((f) => ({ ...f, dataVisita: e.target.value }))} required />
          </div>
          <FormInput label="Responsável" type="text" value={form.engenheiroResponsavel} onChange={(e) => setForm((f) => ({ ...f, engenheiroResponsavel: e.target.value }))} required />
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Resultado</label>
            <select
              value={form.resultado}
              onChange={(e) => setForm((f) => ({ ...f, resultado: e.target.value as Resultado }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="pendente">Pendente</option>
              <option value="fechado">Fechado</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>
          <FormTextarea label="Observações" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={3} />

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-2">
            <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
            <button type="submit" disabled={loading} className="w-full sm:w-auto px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{loading ? 'Salvando...' : editingVisita ? 'Atualizar' : 'Registrar visita'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, id: null, label: null })}
        onConfirm={handleDelete}
        title="Excluir Visita"
        message={`Tem certeza que deseja excluir essa visita comercial (${confirmDialog.label})? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};
