import React, { useEffect, useState } from 'react';
import { UserPlus, X, Users, MapPin, Loader2, Search, User as UserIcon } from 'lucide-react';
import { EquipmentLocation, User } from '../types';
import { useToast } from '../contexts/ToastContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import EmptyState from './EmptyState';

// Componente para o item de colaborador no grid
const CollaboratorAvatar: React.FC<{
  collaborator: User;
  equipmentId: string;
  onRemove: (equipmentId: string, collaboratorId: string) => void;
}> = ({ collaborator, equipmentId, onRemove }) => {
  const [imageError, setImageError] = useState(false);
  const showImage = collaborator.photoUrl && !imageError;

  return (
    <div className="flex flex-col items-center gap-1.5 sm:gap-2 group">
      <div className="relative w-12 h-12 sm:w-16 sm:h-16">
        <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 transition-all shadow-sm hover:shadow-md">
          {showImage ? (
            <img
              src={collaborator.photoUrl!}
              alt={collaborator.name}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex items-center justify-center">
              <UserIcon className="w-4 h-4 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
            </div>
          )}
        </div>
        {/* Botão de remover no hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(equipmentId, collaborator.id);
          }}
          className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg z-20"
          title="Remover colaborador"
        >
          <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        </button>
      </div>
      {/* Nome abaixo da foto */}
      <div className="text-center w-full min-h-[2.5rem]">
        <p className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 truncate px-1" title={collaborator.name}>
          {collaborator.name}
        </p>
        {collaborator.collaboratorRole && (
          <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 truncate px-1 mt-0.5" title={collaborator.collaboratorRole}>
            {collaborator.collaboratorRole}
          </p>
        )}
      </div>
    </div>
  );
};

interface EquipmentCollaboratorsPanelProps {
  equipmentList: EquipmentLocation[];
  onAssignmentChange?: () => void;
}

interface EquipmentWithCollaborators extends EquipmentLocation {
  collaborators?: User[];
}

export const EquipmentCollaboratorsPanel: React.FC<EquipmentCollaboratorsPanelProps> = ({
  equipmentList,
  onAssignmentChange,
}) => {
  const toast = useToast();
  const [equipmentWithCollaborators, setEquipmentWithCollaborators] = useState<EquipmentWithCollaborators[]>([]);
  const [allCollaborators, setAllCollaborators] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false);

  // Buscar todos os colaboradores ativos do banco
  const fetchAllCollaborators = async () => {
    if (!isSupabaseConfigured) {
      setAllCollaborators([
        {
          id: '1',
          name: 'João Silva',
          email: 'joao@example.com',
          photoUrl: null,
          collaboratorStatus: 'ativo',
          role: 'user',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Maria Santos',
          email: 'maria@example.com',
          photoUrl: null,
          collaboratorStatus: 'ativo',
          role: 'user',
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          name: 'Pedro Costa',
          email: 'pedro@example.com',
          photoUrl: null,
          collaboratorStatus: 'ativo',
          role: 'user',
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('collaborator_status', 'ativo')
        .order('name', { ascending: true });

      if (error) throw error;

      setAllCollaborators(
        (data || []).map((row: any) => ({
          id: row.id,
          name: row.name || '',
          email: row.email || '',
          role: row.role || 'user',
          createdAt: row.created_at || new Date().toISOString(),
          photoUrl: row.photo_url || null,
          phone: row.phone || null,
          collaboratorRole: row.collaborator_role || null,
          collaboratorStatus: row.collaborator_status || null,
          updatedAt: row.updated_at || null,
        }))
      );
    } catch (err: any) {
      console.error('Erro ao carregar colaboradores:', err);
      toast.error('Erro ao carregar colaboradores');
    }
  };

  // Buscar associações equipamento-colaborador
  const fetchAssignments = async () => {
    if (!isSupabaseConfigured) {
      const mockData: EquipmentWithCollaborators[] = equipmentList.map((eq, index) => ({
        ...eq,
        collaborators:
          index === 0
            ? [
                {
                  id: '1',
                  name: 'João Silva',
                  email: 'joao@example.com',
                  photoUrl: null,
                  collaboratorStatus: 'ativo',
                  role: 'user',
                  createdAt: new Date().toISOString(),
                },
              ]
            : [],
      }));
      setEquipmentWithCollaborators(mockData);
      return;
    }

    setLoading(true);
    try {
      // Buscar todas as associações ativas
      const { data: assignments, error: assignmentsError } = await supabase
        .from('equipment_collaborators')
        .select(
          `
          *,
          collaborator:profiles(*)
        `
        )
        .eq('status', 'ativo')
        .order('assigned_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Mapear os resultados
      const assignmentMap = new Map<string, User[]>();
      (assignments || []).forEach((assignment: any) => {
        if (!assignment.collaborator) return;

        const collaborator: User = {
          id: assignment.collaborator.id,
          name: assignment.collaborator.name || '',
          email: assignment.collaborator.email || '',
          role: assignment.collaborator.role || 'user',
          createdAt: assignment.collaborator.created_at || new Date().toISOString(),
          photoUrl: assignment.collaborator.photo_url || null,
          phone: assignment.collaborator.phone || null,
          collaboratorRole: assignment.collaborator.collaborator_role || null,
          collaboratorStatus: assignment.collaborator.collaborator_status || null,
          updatedAt: assignment.collaborator.updated_at || null,
        };

        const equipmentId = assignment.equipment_id;
        if (!assignmentMap.has(equipmentId)) {
          assignmentMap.set(equipmentId, []);
        }
        assignmentMap.get(equipmentId)!.push(collaborator);
      });

      // Combinar equipamentos com seus colaboradores
      const equipmentWithCollaboratorsData: EquipmentWithCollaborators[] = equipmentList.map((equipment) => ({
        ...equipment,
        collaborators: assignmentMap.get(equipment.id) || [],
      }));

      setEquipmentWithCollaborators(equipmentWithCollaboratorsData);
    } catch (err: any) {
      console.error('Erro ao carregar associações:', err);
      toast.error('Erro ao carregar colaboradores dos equipamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCollaborators();
    fetchAssignments();
  }, [equipmentList]);

  const handleAddCollaborator = async (equipmentId: string, collaboratorId: string) => {
    if (!isSupabaseConfigured) {
      toast.success('Colaborador adicionado (modo demonstração)');
      fetchAssignments();
      onAssignmentChange?.();
      return;
    }

    setIsAddingCollaborator(true);
    try {
      // Verificar se já existe associação ativa
      const { data: existing } = await supabase
        .from('equipment_collaborators')
        .select('id')
        .eq('equipment_id', equipmentId)
        .eq('collaborator_id', collaboratorId)
        .eq('status', 'ativo')
        .single();

      if (existing) {
        toast.error('Este colaborador já está associado a este equipamento');
        setIsAddingCollaborator(false);
        return;
      }

      // Criar nova associação
      const { error } = await supabase.from('equipment_collaborators').insert({
        equipment_id: equipmentId,
        collaborator_id: collaboratorId,
        status: 'ativo',
      });

      if (error) throw error;

      toast.success('Colaborador adicionado ao equipamento!');
      fetchAssignments();
      onAssignmentChange?.();
      setSelectedEquipment(null);
    } catch (err: any) {
      console.error('Erro ao adicionar colaborador:', err);
      toast.error('Erro ao adicionar colaborador ao equipamento');
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  const handleRemoveCollaborator = async (equipmentId: string, collaboratorId: string) => {
    if (!isSupabaseConfigured) {
      toast.success('Colaborador removido (modo demonstração)');
      fetchAssignments();
      onAssignmentChange?.();
      return;
    }

    try {
      // Finalizar a associação
      const { error } = await supabase
        .from('equipment_collaborators')
        .update({
          status: 'finalizado',
          assigned_until: new Date().toISOString(),
        })
        .eq('equipment_id', equipmentId)
        .eq('collaborator_id', collaboratorId)
        .eq('status', 'ativo');

      if (error) throw error;

      toast.success('Colaborador removido do equipamento!');
      fetchAssignments();
      onAssignmentChange?.();
    } catch (err: any) {
      console.error('Erro ao remover colaborador:', err);
      toast.error('Erro ao remover colaborador do equipamento');
    }
  };

  // Filtrar colaboradores disponíveis para adicionar
  const getAvailableCollaborators = (equipmentId: string) => {
    const equipment = equipmentWithCollaborators.find((eq) => eq.id === equipmentId);
    const assignedIds = new Set(equipment?.collaborators?.map((c) => c.id) || []);

    return allCollaborators
      .filter((collab) => {
        const matchesSearch = !searchTerm || collab.name.toLowerCase().includes(searchTerm.toLowerCase());
        const notAssigned = !assignedIds.has(collab.id);
        return matchesSearch && notAssigned;
      })
      .slice(0, 10); // Limitar a 10 resultados para melhor UX
  };

  if (equipmentList.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="Nenhum equipamento cadastrado"
        description="Cadastre equipamentos para começar a associar colaboradores."
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Colaboradores nos Equipamentos</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Visualize e gerencie quais colaboradores estão trabalhando em cada equipamento
          </p>
        </div>
        <button
          onClick={fetchAssignments}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg hover:border-green-200 hover:text-green-600 transition-colors disabled:opacity-50 dark:border-gray-700 flex-shrink-0"
        >
          <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="whitespace-nowrap">Atualizar</span>
        </button>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {equipmentWithCollaborators.map((equipment) => {
          const collaborators = equipment.collaborators || [];
          const isSelected = selectedEquipment === equipment.id;

          return (
            <div
              key={equipment.id}
              className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Cabeçalho do Equipamento */}
              <div className="flex items-start justify-between mb-4 gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 break-words">{equipment.name}</h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 break-words">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span>{equipment.address}</span>
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 whitespace-nowrap ${
                    equipment.status === 'ativo'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                      : equipment.status === 'em manutenção'
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {equipment.status}
                </span>
              </div>

              {/* Painel de Colaboradores */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Colaboradores ({collaborators.length})
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedEquipment(isSelected ? null : equipment.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors dark:hover:bg-green-900/20"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Adicionar
                  </button>
                </div>

                {/* Grid de Fotos dos Colaboradores */}
                {collaborators.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 gap-3 sm:gap-4">
                    {collaborators.map((collaborator) => (
                      <CollaboratorAvatar
                        key={collaborator.id}
                        collaborator={collaborator}
                        equipmentId={equipment.id}
                        onRemove={handleRemoveCollaborator}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8 text-xs sm:text-sm text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    <UserIcon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum colaborador associado</p>
                    <p className="text-[10px] sm:text-xs mt-1 px-2">Clique em "Adicionar" para associar colaboradores</p>
                  </div>
                )}

                {/* Modal de Adicionar Colaborador */}
                {isSelected && (
                  <div className="mt-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-3">
                      <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <input
                        type="text"
                        placeholder="Buscar colaborador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 text-xs sm:text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-gray-950 focus:border-green-500 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          setSelectedEquipment(null);
                          setSearchTerm('');
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {getAvailableCollaborators(equipment.id).length > 0 ? (
                        getAvailableCollaborators(equipment.id).map((collaborator) => (
                          <button
                            key={collaborator.id}
                            onClick={() => handleAddCollaborator(equipment.id, collaborator.id)}
                            disabled={isAddingCollaborator}
                            className="w-full flex items-center gap-2 sm:gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-gray-900 transition-colors text-left border border-transparent hover:border-green-200 dark:hover:border-green-800"
                          >
                            <div className="relative flex-shrink-0">
                              {collaborator.photoUrl ? (
                                <img
                                  src={collaborator.photoUrl}
                                  alt={collaborator.name}
                                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 flex items-center justify-center">
                                  <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                                {collaborator.name}
                              </p>
                              {collaborator.collaboratorRole && (
                                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {collaborator.collaboratorRole}
                                </p>
                              )}
                            </div>
                            <UserPlus className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          </button>
                        ))
                      ) : (
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center py-4 px-2">
                          {searchTerm
                            ? 'Nenhum colaborador encontrado'
                            : 'Todos os colaboradores já estão associados'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

