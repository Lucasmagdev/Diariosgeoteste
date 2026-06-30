import React, { useEffect, useState } from 'react';
import { Search, Plus, Building2, Mail, Phone, MapPin, Edit, Trash2 } from 'lucide-react';
import { Client } from '../types';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import FormInput from './FormInput';
import FormTextarea from './FormTextarea';
import { useFormValidation } from '../hooks/useFormValidation';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, IconButton, Modal, PageHeader, Surface } from './ui';

// Mock data (fallback quando Supabase não estiver configurado)
const mockClients: Client[] = [
  {
    id: '1',
    name: 'Construtora ABC Ltda',
    email: 'contato@abc.com.br',
    phone: '(11) 3333-4444',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    createdAt: '2025-01-10'
  },
  {
    id: '2',
    name: 'Incorporadora XYZ',
    email: 'projetos@xyz.com.br',
    phone: '(21) 5555-6666',
    address: 'Rua Copacabana, 200 - Rio de Janeiro, RJ',
    createdAt: '2025-01-12'
  },
];

export const ClientsManagement: React.FC = () => {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    clientId: string | null;
    clientName: string | null;
  }>({ isOpen: false, clientId: null, clientName: null });
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const { errors, touched, validateForm, touchField, handleFieldValidation, resetValidation } = useFormValidation({
    name: { required: true, minLength: 3, maxLength: 100 },
    email: { required: false, email: true },
    phone: { required: false, minLength: 10 },
    address: { required: false, minLength: 10 }
  });

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mapRowToClient = (row: any): Client => ({
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
  });

  const fetchClients = async () => {
    if (!isSupabaseConfigured) {
      setClients(mockClients);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClients((data || []).map(mapRowToClient));
    } catch (err: any) {
      toast.error('Não foi possível carregar os clientes. Tente novamente.');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleOpenModal = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: ''
    });
    resetValidation();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validar formulário
    if (!validateForm(formData)) {
      toast.error('Corrija os erros no formulário antes de continuar.');
      return;
    }

    if (!isSupabaseConfigured) {
      // Fallback local quando não há Supabase
      if (editingClient) {
        setClients(prev => prev.map(client => client.id === editingClient.id ? { ...client, ...formData } : client));
        toast.success('Cliente atualizado (modo local)');
      } else {
        const newClient: Client = { id: Date.now().toString(), ...formData, createdAt: new Date().toISOString() };
        setClients(prev => [mapRowToClient(newClient), ...prev]);
        toast.success('Cliente cadastrado (modo local)');
      }
      handleCloseModal();
      return;
    }

    try {
      setLoading(true);
      if (editingClient) {
        const { data, error } = await supabase
          .from('clients')
          .update({
            name: formData.name,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
          })
          .eq('id', editingClient.id)
          .select('*')
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const updated = mapRowToClient(data);
          setClients(prev => prev.map(c => c.id === updated.id ? updated : c));
        }
        toast.success('Cliente atualizado com sucesso!');
      } else {
        const { data, error } = await supabase
          .from('clients')
          .insert({
            name: formData.name,
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
          })
          .select('*')
          .single();
        if (error) throw error;
        if (data) {
          const created = mapRowToClient(data);
          setClients(prev => [created, ...prev]);
        }
        toast.success('Cliente cadastrado com sucesso!');
      }
      handleCloseModal();
    } catch (err: any) {
      toast.error('Não foi possível salvar o cliente. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (clientId: string, clientName: string) => {
    setConfirmDialog({ isOpen: true, clientId, clientName });
  };

  const handleDelete = async () => {
    const { clientId } = confirmDialog;
    if (!clientId) return;

    if (!isSupabaseConfigured) {
      setClients(prev => prev.filter(client => client.id !== clientId));
      toast.success('Cliente excluído (modo local)');
      setConfirmDialog({ isOpen: false, clientId: null, clientName: null });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) throw error;
      setClients(prev => prev.filter(client => client.id !== clientId));
      toast.success('Cliente excluído com sucesso!');
    } catch (err: any) {
      toast.error('Não foi possível excluir o cliente. Tente novamente.');
    } finally {
      setLoading(false);
      setConfirmDialog({ isOpen: false, clientId: null, clientName: null });
    }
  };

  return (
    <div>
      <PageHeader title="Clientes" description="Contatos, endereços e relacionamentos da empresa." eyebrow="Gestão" actions={
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Novo cliente</span>
        </button>
      } />

      {/* Search */}
      <FilterBar>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent hover:border-green-400 hover:shadow-md transition-all duration-200"
          />
          <button
            onClick={fetchClients}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </FilterBar>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredClients.map((client) => (
          <Surface key={client.id} interactive>
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 dark:group-hover:bg-green-800/50 transition-all duration-300">
                    <Building2 className="text-green-600 dark:text-green-400 w-5 h-5 sm:w-6 sm:h-6 group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors duration-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">{client.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Cliente desde {new Date(client.createdAt).getFullYear()}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <IconButton icon={Edit} label={`Editar ${client.name}`} tone="primary" onClick={() => handleOpenModal(client)} />
                  <IconButton icon={Trash2} label={`Excluir ${client.name}`} tone="danger" onClick={() => handleDeleteClick(client.id, client.name)} />
                </div>
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                {client.email && (
                  <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    <Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="flex items-start text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2 break-words">{client.address}</span>
                  </div>
                )}
              </div>
            </div>
          </Surface>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <EmptyState
          icon={searchTerm ? Search : Building2}
          title={searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          description={
            searchTerm
              ? 'Tente ajustar os termos de busca para encontrar clientes.'
              : 'Comece adicionando o primeiro cliente ao sistema.'
          }
          actionLabel={!searchTerm ? 'Adicionar Cliente' : undefined}
          onAction={!searchTerm ? () => handleOpenModal() : undefined}
          secondaryActionLabel={searchTerm ? 'Limpar Busca' : undefined}
          onSecondaryAction={searchTerm ? () => setSearchTerm('') : undefined}
        />
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={handleCloseModal} title={editingClient ? 'Editar cliente' : 'Novo cliente'}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormInput
                label="Nome da Empresa"
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  handleFieldValidation('name', e.target.value);
                }}
                onBlur={() => touchField('name')}
                error={errors.name}
                touched={touched.name}
                required
                maxLength={100}
              />
              
              <FormInput
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, email: e.target.value }));
                  handleFieldValidation('email', e.target.value);
                }}
                onBlur={() => touchField('email')}
                error={errors.email}
                touched={touched.email}
              />
              
              <FormInput
                label="Telefone"
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, phone: e.target.value }));
                  handleFieldValidation('phone', e.target.value);
                }}
                onBlur={() => touchField('phone')}
                error={errors.phone}
                touched={touched.phone}
                placeholder="(00) 00000-0000"
              />
              
              <FormTextarea
                label="Endereço"
                value={formData.address}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, address: e.target.value }));
                  handleFieldValidation('address', e.target.value);
                }}
                onBlur={() => touchField('address')}
                error={errors.address}
                touched={touched.address}
                rows={3}
              />
              
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
                  {editingClient ? 'Atualizar' : 'Cadastrar'}
                </button>
              </div>
            </form>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, clientId: null, clientName: null })}
        onConfirm={handleDelete}
        title="Excluir Cliente"
        message={`Tem certeza que deseja excluir o cliente "${confirmDialog.clientName}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};
