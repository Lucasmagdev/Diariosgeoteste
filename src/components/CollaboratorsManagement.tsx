import React, { useEffect, useState } from 'react';
import { Search, Plus, User, Mail, Phone, Briefcase, Edit, Trash2, Camera, Loader2, X } from 'lucide-react';
import { Collaborator } from '../types';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import FormInput from './FormInput';
import { useFormValidation } from '../hooks/useFormValidation';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { uploadCollaboratorPhoto, deleteOldCollaboratorPhoto } from '../utils/collaboratorPhotoStorage';
import { Modal } from './ui';

// Mock data (fallback quando Supabase não estiver configurado)
const mockCollaborators: Collaborator[] = [
  {
    id: '1',
    name: 'João Silva',
    photoUrl: null,
    email: 'joao@example.com',
    phone: '(11) 99999-9999',
    role: 'Operador',
    status: 'ativo',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Maria Santos',
    photoUrl: null,
    email: 'maria@example.com',
    phone: '(11) 88888-8888',
    role: 'Ajudante',
    status: 'ativo',
    createdAt: new Date().toISOString(),
  },
];

const statusOptions: Array<Collaborator['status']> = ['ativo', 'inativo', 'férias', 'afastado'];

export const CollaboratorsManagement: React.FC = () => {
  const toast = useToast();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    collaboratorId: string | null;
    collaboratorName: string | null;
  }>({ isOpen: false, collaboratorId: null, collaboratorName: null });
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    status: 'ativo' as Collaborator['status'],
  });

  const { errors, touched, validateForm, touchField, handleFieldValidation, resetValidation } = useFormValidation({
    name: { required: true, minLength: 3, maxLength: 100 },
    email: { required: false, email: true },
    phone: { required: false, minLength: 10 },
    role: { required: false, maxLength: 50 },
  });

  const filteredCollaborators = collaborators.filter(collaborator =>
    collaborator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    collaborator.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    collaborator.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const mapRowToCollaborator = (row: any): Collaborator => ({
    id: row.id,
    name: row.name || '',
    photoUrl: row.photo_url || null,
    email: row.email || null,
    phone: row.phone || null,
    role: row.role || null,
    status: row.status || 'ativo',
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt,
  });

  const fetchCollaborators = async () => {
    if (!isSupabaseConfigured) {
      setCollaborators(mockCollaborators);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCollaborators((data || []).map(mapRowToCollaborator));
    } catch (err: any) {
      toast.error('Não foi possível carregar os colaboradores. Tente novamente.');
      setCollaborators([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollaborators();
  }, []);

  const handleOpenModal = (collaborator?: Collaborator) => {
    if (collaborator) {
      setEditingCollaborator(collaborator);
      setFormData({
        name: collaborator.name,
        email: collaborator.email || '',
        phone: collaborator.phone || '',
        role: collaborator.role || '',
        status: collaborator.status,
      });
      setPhotoPreview(collaborator.photoUrl || null);
      setPhotoFile(null);
    } else {
      setEditingCollaborator(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: '',
        status: 'ativo',
      });
      setPhotoPreview(null);
      setPhotoFile(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCollaborator(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: '',
      status: 'ativo',
    });
    setPhotoPreview(null);
    setPhotoFile(null);
    resetValidation();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato de arquivo não suportado. Use apenas imagens JPG, PNG ou WEBP.');
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O tamanho máximo permitido é 5MB.');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm(formData)) {
      toast.error('Corrija os erros no formulário antes de continuar.');
      return;
    }

    if (!isSupabaseConfigured) {
      // Fallback local
      if (editingCollaborator) {
        setCollaborators(prev => prev.map(col => 
          col.id === editingCollaborator.id 
            ? { ...col, ...formData, photoUrl: photoPreview } 
            : col
        ));
        toast.success('Colaborador atualizado (modo local)');
      } else {
        const newCollaborator: Collaborator = {
          id: Date.now().toString(),
          ...formData,
          photoUrl: photoPreview,
          createdAt: new Date().toISOString(),
        };
        setCollaborators(prev => [newCollaborator, ...prev]);
        toast.success('Colaborador cadastrado (modo local)');
      }
      handleCloseModal();
      return;
    }

    try {
      setLoading(true);
      
      let photoUrl = editingCollaborator?.photoUrl || null;
      
      // Upload da foto se houver nova
      if (photoFile) {
        setUploadingPhoto(true);
        const collaboratorId = editingCollaborator?.id || 'temp';
        
        try {
          photoUrl = await uploadCollaboratorPhoto(photoFile, collaboratorId);
          if (!photoUrl) {
            toast.error('Não foi possível enviar a foto. Tente novamente.');
            return;
          }
          
          // Se estiver editando e havia foto antiga, deletar
          if (editingCollaborator?.photoUrl && editingCollaborator.photoUrl !== photoUrl) {
            await deleteOldCollaboratorPhoto(editingCollaborator.photoUrl);
          }
        } catch (err: any) {
          toast.error('Não foi possível enviar a foto. Tente novamente.');
          return;
        } finally {
          setUploadingPhoto(false);
        }
      }

      if (editingCollaborator) {
        // Atualizar colaborador existente
        const { data, error } = await supabase
          .from('collaborators')
          .update({
            name: formData.name.trim(),
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            role: formData.role.trim() || null,
            status: formData.status,
            photo_url: photoUrl,
          })
          .eq('id', editingCollaborator.id)
          .select('*')
          .maybeSingle();
        
        if (error) throw error;
        if (data) {
          const updated = mapRowToCollaborator(data);
          setCollaborators(prev => prev.map(c => c.id === updated.id ? updated : c));
        }
        toast.success('Colaborador atualizado com sucesso!');
      } else {
        // Criar novo colaborador
        const { data, error } = await supabase
          .from('collaborators')
          .insert({
            name: formData.name.trim(),
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            role: formData.role.trim() || null,
            status: formData.status,
            photo_url: photoUrl,
          })
          .select('*')
          .single();
        
        if (error) throw error;
        if (data) {
          // Se foi criado com sucesso e há foto, fazer upload novamente com o ID correto
          if (photoFile && data.id) {
            setUploadingPhoto(true);
            try {
              const newPhotoUrl = await uploadCollaboratorPhoto(photoFile, data.id);
              if (newPhotoUrl) {
                await supabase
                  .from('collaborators')
                  .update({ photo_url: newPhotoUrl })
                  .eq('id', data.id);
                photoUrl = newPhotoUrl;
              }
            } catch (err) {
              console.error('Erro ao fazer upload da foto após criação:', err);
            } finally {
              setUploadingPhoto(false);
            }
          }
          
          const created = mapRowToCollaborator({ ...data, photo_url: photoUrl });
          setCollaborators(prev => [created, ...prev]);
        }
        toast.success('Colaborador cadastrado com sucesso!');
      }
      
      handleCloseModal();
    } catch (err: any) {
      console.error(err);
      toast.error('Não foi possível salvar o colaborador. Tente novamente.');
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
    }
  };

  const handleDeleteClick = (collaboratorId: string, collaboratorName: string) => {
    setConfirmDialog({ isOpen: true, collaboratorId, collaboratorName });
  };

  const handleDelete = async () => {
    const { collaboratorId } = confirmDialog;
    if (!collaboratorId) return;

    const collaborator = collaborators.find(c => c.id === collaboratorId);
    
    if (!isSupabaseConfigured) {
      setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
      toast.success('Colaborador excluído (modo local)');
      setConfirmDialog({ isOpen: false, collaboratorId: null, collaboratorName: null });
      return;
    }

    try {
      setLoading(true);
      
      // Deletar foto do storage se houver
      if (collaborator?.photoUrl) {
        await deleteOldCollaboratorPhoto(collaborator.photoUrl);
      }
      
      const { error } = await supabase.from('collaborators').delete().eq('id', collaboratorId);
      if (error) throw error;
      
      setCollaborators(prev => prev.filter(c => c.id !== collaboratorId));
      toast.success('Colaborador excluído com sucesso!');
    } catch (err: any) {
      toast.error('Não foi possível excluir o colaborador. Tente novamente.');
    } finally {
      setLoading(false);
      setConfirmDialog({ isOpen: false, collaboratorId: null, collaboratorName: null });
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 md:mb-8 space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
            Gerenciamento de Colaboradores
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 dark:text-gray-300">
            Cadastre e gerencie os colaboradores da empresa com fotos
          </p>
        </div>
        
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto bg-green-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center justify-center space-x-2 group"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-base">Novo Colaborador</span>
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 sm:mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
          <input
            type="text"
            placeholder="Buscar colaboradores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent hover:border-green-400 hover:shadow-md transition-all duration-200"
          />
        </div>
      </div>

      {/* Collaborators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredCollaborators.map((collaborator) => (
          <div
            key={collaborator.id}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:border-green-200 dark:hover:border-green-700 transition-all duration-300"
          >
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-green-100 dark:bg-green-900/30 flex-shrink-0 border-2 border-green-200 dark:border-green-700">
                    {collaborator.photoUrl ? (
                      <img
                        src={collaborator.photoUrl}
                        alt={collaborator.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 dark:text-green-400" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {collaborator.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {collaborator.role || 'Sem função'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 flex-shrink-0">
                  <button
                    onClick={() => handleOpenModal(collaborator)}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                    title="Editar"
                  >
                    <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(collaborator.id, collaborator.name)}
                    className="p-1.5 sm:p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                    title="Excluir"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-1.5 sm:space-y-2">
                {collaborator.email && (
                  <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    <Mail className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{collaborator.email}</span>
                  </div>
                )}
                {collaborator.phone && (
                  <div className="flex items-center text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    <Phone className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{collaborator.phone}</span>
                  </div>
                )}
                <div className="flex items-center text-xs sm:text-sm">
                  <span
                    className={`px-2 py-1 rounded-full font-medium ${
                      collaborator.status === 'ativo'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                        : collaborator.status === 'férias'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {collaborator.status.charAt(0).toUpperCase() + collaborator.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCollaborators.length === 0 && (
        <EmptyState
          icon={searchTerm ? Search : User}
          title={searchTerm ? 'Nenhum colaborador encontrado' : 'Nenhum colaborador cadastrado'}
          description={
            searchTerm
              ? 'Tente ajustar os termos de busca para encontrar colaboradores.'
              : 'Comece adicionando o primeiro colaborador ao sistema.'
          }
          actionLabel={!searchTerm ? 'Adicionar Colaborador' : undefined}
          onAction={!searchTerm ? () => handleOpenModal() : undefined}
          secondaryActionLabel={searchTerm ? 'Limpar Busca' : undefined}
          onSecondaryAction={searchTerm ? () => setSearchTerm('') : undefined}
        />
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={handleCloseModal} title={editingCollaborator ? 'Editar colaborador' : 'Novo colaborador'}>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Upload */}
              <div className="flex flex-col items-center space-y-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-green-100 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-12 h-12 text-green-600 dark:text-green-400" />
                      </div>
                    )}
                  </div>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handlePhotoChange}
                    className="hidden"
                    disabled={uploadingPhoto}
                  />
                  <div className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm">
                    {uploadingPhoto ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-4 h-4" />
                        <span>{photoPreview ? 'Alterar Foto' : 'Adicionar Foto'}</span>
                      </>
                    )}
                  </div>
                </label>
                <p className="text-xs text-gray-500">JPG, PNG ou WEBP (máx. 5MB)</p>
              </div>
              
              <FormInput
                label="Nome Completo"
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
                label="Email (opcional)"
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
                label="Telefone (opcional)"
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
              
              <FormInput
                label="Função/Cargo (opcional)"
                type="text"
                value={formData.role}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, role: e.target.value }));
                  handleFieldValidation('role', e.target.value);
                }}
                onBlur={() => touchField('role')}
                error={errors.role}
                touched={touched.role}
                placeholder="Ex: Operador, Ajudante, Encarregado"
                maxLength={50}
              />
              
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Collaborator['status'] }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={loading || uploadingPhoto}
                  className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingPhoto}
                  className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {loading || uploadingPhoto ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>{editingCollaborator ? 'Atualizar' : 'Cadastrar'}</span>
                  )}
                </button>
              </div>
            </form>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, collaboratorId: null, collaboratorName: null })}
        onConfirm={handleDelete}
        title="Excluir Colaborador"
        message={`Tem certeza que deseja excluir o colaborador "${confirmDialog.collaboratorName}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};

