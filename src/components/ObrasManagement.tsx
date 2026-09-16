import React, { useEffect, useState } from 'react';
import { Search, Plus, HardHat, MapPin, Edit, Trash2, Link2 } from 'lucide-react';
import { Obra, Client } from '../types';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import FormInput from './FormInput';
import { useFormValidation } from '../hooks/useFormValidation';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, IconButton, Modal, PageHeader, StatusBadge, Surface } from './ui';
import { ClientSelector } from './ClientSelector';

interface ObraRow extends Obra {
  clientName: string;
  pipefyCardId?: string | null;
}

const statusLabels: Record<Obra['status'], string> = {
  ativa: 'Ativa',
  concluida: 'Concluída',
  inativa: 'Inativa',
};

const statusVariants: Record<Obra['status'], 'success' | 'neutral' | 'warning'> = {
  ativa: 'success',
  concluida: 'neutral',
  inativa: 'warning',
};

export const ObrasManagement: React.FC = () => {
  const toast = useToast();
  const [obras, setObras] = useState<ObraRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingObra, setEditingObra] = useState<ObraRow | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    obraId: string | null;
    obraLabel: string | null;
  }>({ isOpen: false, obraId: null, obraLabel: null });
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    obraCode: '',
    name: '',
    clientName: '',
    address: '',
    status: 'ativa' as Obra['status'],
  });

  const { errors, touched, validateForm, touchField, handleFieldValidation, resetValidation } = useFormValidation({
    obraCode: { required: false, maxLength: 30 },
    name: { required: true, minLength: 3, maxLength: 150 },
    clientName: { required: true },
    address: { required: false },
  });

  const mapRowToObra = (row: any): ObraRow => ({
    id: row.id,
    obraCode: row.obra_code || null,
    name: row.name || '',
    clientId: row.client_id || null,
    clientName: row.clients?.name || '',
    address: row.address || '',
    status: row.status || 'ativa',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined,
    pipefyCardId: row.pipefy_card_id || null,
  });

  const fetchClients = async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true });
    if (!error) {
      setClients((data || []).map((row: any) => ({
        id: row.id,
        name: row.name || '',
        email: row.email || '',
        phone: row.phone || '',
        address: row.address || '',
        createdAt: row.created_at || new Date().toISOString(),
      })));
    }
  };

  const fetchObras = async () => {
    if (!isSupabaseConfigured) {
      setObras([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('obras')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setObras((data || []).map(mapRowToObra));
    } catch (err: any) {
      toast.error('Não foi possível carregar as obras. Tente novamente.');
      setObras([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchObras();
  }, []);

  const filteredObras = obras.filter((obra) => {
    const term = searchTerm.toLowerCase();
    return (
      (obra.obraCode || '').toLowerCase().includes(term) ||
      obra.name.toLowerCase().includes(term) ||
      obra.clientName.toLowerCase().includes(term)
    );
  });

  const handleOpenModal = (obra?: ObraRow) => {
    if (obra) {
      setEditingObra(obra);
      setFormData({
        obraCode: obra.obraCode || '',
        name: obra.name,
        clientName: obra.clientName,
        address: obra.address || '',
        status: obra.status,
      });
    } else {
      setEditingObra(null);
      setFormData({ obraCode: '', name: '', clientName: '', address: '', status: 'ativa' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingObra(null);
    setFormData({ obraCode: '', name: '', clientName: '', address: '', status: 'ativa' });
    resetValidation();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(formData)) {
      toast.error('Corrija os erros no formulário antes de continuar.');
      return;
    }

    const client = clients.find((c) => c.name === formData.clientName.trim());
    if (!client) {
      toast.error('Selecione um cliente cadastrado.');
      return;
    }

    const payload = {
      obra_code: formData.obraCode.trim() || null,
      name: formData.name.trim(),
      client_id: client.id,
      address: formData.address.trim() || null,
      status: formData.status,
    };

    try {
      setLoading(true);
      if (editingObra) {
        const { error } = await supabase.from('obras').update(payload).eq('id', editingObra.id);
        if (error) throw error;
        toast.success('Obra atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('obras').insert(payload);
        if (error) throw error;
        toast.success('Obra cadastrada com sucesso!');
      }
      handleCloseModal();
      fetchObras();
    } catch (err: any) {
      toast.error('Não foi possível salvar a obra. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (obraId: string, label: string) => {
    setConfirmDialog({ isOpen: true, obraId, obraLabel: label });
  };

  const handleDelete = async () => {
    const { obraId } = confirmDialog;
    if (!obraId) return;
    try {
      setLoading(true);
      const { error } = await supabase.from('obras').delete().eq('id', obraId);
      if (error) throw error;
      setObras((prev) => prev.filter((o) => o.id !== obraId));
      toast.success('Obra excluída com sucesso!');
    } catch (err: any) {
      toast.error('Não foi possível excluir a obra. Verifique se não há diários vinculados a ela.');
    } finally {
      setLoading(false);
      setConfirmDialog({ isOpen: false, obraId: null, obraLabel: null });
    }
  };

  return (
    <div>
      <PageHeader
        title="Obras"
        description="Obras vinculadas aos clientes — código do Pipefy + nome, pra o técnico achar rápido no diário."
        eyebrow="Gestão"
        actions={
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Nova obra</span>
          </button>
        }
      />

      <FilterBar>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          <input
            type="text"
            placeholder="Buscar por código, obra ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent hover:border-green-400 hover:shadow-md transition-all duration-200"
          />
          <button
            onClick={fetchObras}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredObras.map((obra) => (
          <Surface key={obra.id} interactive>
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <HardHat className="text-green-600 dark:text-green-400 w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {obra.obraCode ? `${obra.obraCode} — ${obra.clientName || obra.name}` : (obra.clientName || obra.name)}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{obra.name}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1 flex-shrink-0">
                  <IconButton icon={Edit} label={`Editar ${obra.name}`} tone="primary" onClick={() => handleOpenModal(obra)} />
                  <IconButton
                    icon={Trash2}
                    label={`Excluir ${obra.name}`}
                    tone="danger"
                    onClick={() => handleDeleteClick(obra.id, obra.obraCode ? `${obra.obraCode} — ${obra.name}` : obra.name)}
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                {obra.address && (
                  <div className="flex items-start text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2 break-words">{obra.address}</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusBadge variant={statusVariants[obra.status]}>{statusLabels[obra.status]}</StatusBadge>
                  {obra.pipefyCardId && (
                    <StatusBadge variant="info">
                      <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> Via Pipefy</span>
                    </StatusBadge>
                  )}
                </div>
              </div>
            </div>
          </Surface>
        ))}
      </div>

      {filteredObras.length === 0 && (
        <EmptyState
          icon={searchTerm ? Search : HardHat}
          title={searchTerm ? 'Nenhuma obra encontrada' : 'Nenhuma obra cadastrada'}
          description={
            searchTerm
              ? 'Tente ajustar os termos de busca para encontrar a obra.'
              : 'Obras entram automaticamente quando um contrato fecha no Pipefy, ou cadastre uma manualmente.'
          }
          actionLabel={!searchTerm ? 'Adicionar Obra' : undefined}
          onAction={!searchTerm ? () => handleOpenModal() : undefined}
          secondaryActionLabel={searchTerm ? 'Limpar Busca' : undefined}
          onSecondaryAction={searchTerm ? () => setSearchTerm('') : undefined}
        />
      )}

      <Modal open={showModal} onClose={handleCloseModal} title={editingObra ? 'Editar obra' : 'Nova obra'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Código da obra (Pipefy)"
            type="text"
            value={formData.obraCode}
            onChange={(e) => setFormData((prev) => ({ ...prev, obraCode: e.target.value }))}
            placeholder="Ex: G2561"
            maxLength={30}
          />

          <FormInput
            label="Nome da obra"
            type="text"
            value={formData.name}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, name: e.target.value }));
              handleFieldValidation('name', e.target.value);
            }}
            onBlur={() => touchField('name')}
            error={errors.name}
            touched={touched.name}
            required
            maxLength={150}
          />

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Cliente *</label>
            <ClientSelector
              clients={clients}
              value={formData.clientName}
              onChange={(value) => {
                setFormData((prev) => ({ ...prev, clientName: value }));
                handleFieldValidation('clientName', value);
              }}
              required
            />
          </div>

          <FormInput
            label="Endereço"
            type="text"
            value={formData.address}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
          />

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as Obra['status'] }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            >
              <option value="ativa">Ativa</option>
              <option value="concluida">Concluída</option>
              <option value="inativa">Inativa</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              {editingObra ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, obraId: null, obraLabel: null })}
        onConfirm={handleDelete}
        title="Excluir Obra"
        message={`Tem certeza que deseja excluir a obra "${confirmDialog.obraLabel}"? Diários vinculados perdem essa referência.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};
