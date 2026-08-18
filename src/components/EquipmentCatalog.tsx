import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Power, Wrench } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, PageHeader, StatusBadge, Surface, IconButton } from './ui';

type EquipTipo = 'PCE' | 'PIT' | 'PDA' | 'HAMMER';
interface Equipamento { id: string; tipo: EquipTipo; nome: string; ativo: boolean; createdAt: string; }

const TIPO_LABEL: Record<EquipTipo, string> = { PCE: 'PCE', PIT: 'PIT', PDA: 'PDA', HAMMER: 'Martelo (PDA)' };
const TIPOS: EquipTipo[] = ['PCE', 'PIT', 'PDA', 'HAMMER'];

export const EquipmentCatalog: React.FC = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [tipoFilter, setTipoFilter] = useState<EquipTipo | ''>('');
  const [novoTipo, setNovoTipo] = useState<EquipTipo>('PIT');
  const [novoNome, setNovoNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; item?: Equipamento }>({ open: false });

  const fetchAll = async () => {
    if (!isSupabaseConfigured) { toast.error('Supabase não configurado.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('equipamentos').select('*').order('tipo').order('nome');
      if (error) throw error;
      setEquipamentos((data || []).map((r: any) => ({ id: r.id, tipo: r.tipo, nome: r.nome, ativo: r.ativo, createdAt: r.created_at })));
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar equipamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const addEquipamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) { toast.error('Informe o nome do equipamento.'); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('equipamentos').insert({ tipo: novoTipo, nome }).select('*').single();
      if (error) {
        // indice unico (tipo, lower(nome)) violado — nao e erro generico, e a regra de negocio
        if ((error as any).code === '23505') {
          toast.error(`Já existe um equipamento "${nome}" cadastrado como ${TIPO_LABEL[novoTipo]}.`);
        } else {
          throw error;
        }
        return;
      }
      setEquipamentos(prev => [...prev, { id: data.id, tipo: data.tipo, nome: data.nome, ativo: data.ativo, createdAt: data.created_at }]);
      setNovoNome('');
      toast.success('Equipamento cadastrado.');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao cadastrar equipamento.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (item: Equipamento) => {
    try {
      const { error } = await supabase.from('equipamentos').update({ ativo: !item.ativo }).eq('id', item.id);
      if (error) throw error;
      setEquipamentos(prev => prev.map(e => e.id === item.id ? { ...e, ativo: !e.ativo } : e));
    } catch (err) {
      console.error(err);
      toast.error('Falha ao atualizar equipamento.');
    }
  };

  const deleteEquipamento = async () => {
    const item = confirmDelete.item;
    if (!item) return;
    try {
      const { error } = await supabase.from('equipamentos').delete().eq('id', item.id);
      if (error) {
        if ((error as any).code === '23503') {
          toast.error('Esse equipamento já foi usado em algum diário — desative em vez de excluir.');
        } else {
          throw error;
        }
        return;
      }
      setEquipamentos(prev => prev.filter(e => e.id !== item.id));
      toast.success('Equipamento removido.');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao remover equipamento.');
    } finally {
      setConfirmDelete({ open: false });
    }
  };

  const filtered = tipoFilter ? equipamentos.filter(e => e.tipo === tipoFilter) : equipamentos;

  return (
    <div>
      <PageHeader
        title="Equipamentos"
        eyebrow="Gestão"
        description="Catálogo dos equipamentos usados nos diários. Cada um é uma peça única — sem duplicar nome no mesmo tipo."
      />

      <Surface className="p-4 sm:p-5 mb-6">
        <form onSubmit={addEquipamento} className="flex flex-col sm:flex-row gap-3">
          <select
            value={novoTipo}
            onChange={(e) => setNovoTipo(e.target.value as EquipTipo)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
          >
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome do equipamento (ex.: PIT 6, Martelo 02)"
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
          />
          <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </form>
      </Surface>

      <FilterBar className="mb-4">
        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value as EquipTipo | '')}
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
        >
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
      </FilterBar>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Surface className="p-8 text-center">
          <Wrench className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nenhum equipamento cadastrado{tipoFilter ? ` em ${TIPO_LABEL[tipoFilter]}` : ''}.</p>
        </Surface>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <Surface key={item.id} className={`flex items-center gap-3 px-4 py-3 ${!item.ativo ? 'opacity-60' : ''}`}>
              <StatusBadge variant="neutral">{TIPO_LABEL[item.tipo]}</StatusBadge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.nome}</p>
              </div>
              <StatusBadge variant={item.ativo ? 'success' : 'neutral'}>{item.ativo ? 'ativo' : 'inativo'}</StatusBadge>
              <IconButton icon={Power} label={item.ativo ? 'Desativar' : 'Ativar'} tone={item.ativo ? 'neutral' : 'primary'} onClick={() => toggleAtivo(item)} />
              <IconButton icon={Trash2} label="Remover" tone="danger" onClick={() => setConfirmDelete({ open: true, item })} />
            </Surface>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false })}
        onConfirm={deleteEquipamento}
        title="Remover equipamento"
        message={`Remover "${confirmDelete.item?.nome}" do catálogo? Se já foi usado em algum diário, use "Desativar" em vez disso.`}
        confirmText="Remover" cancelText="Cancelar" type="danger"
      />
    </div>
  );
};
