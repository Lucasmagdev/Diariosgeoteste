export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  // Campos de colaborador (unificado)
  photoUrl?: string | null;
  phone?: string | null;
  collaboratorRole?: string | null; // Função/cargo (ex: Operador, Ajudante)
  collaboratorStatus?: 'ativo' | 'inativo' | 'férias' | 'afastado' | null;
  updatedAt?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface EquipmentLocation {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  clientId?: string | null;
  clientName?: string | null;
  status: string;
  createdAt: string;
}

export interface WorkDiary {
  id: string;
  clientId: string;
  clientName: string;
  address: string;
  enderecoDetalhado?: {
    estadoId: number;
    estadoNome: string;
    cidadeId: number;
    cidadeNome: string;
    rua: string;
    numero: string;
  };
  team: string;
  type?: 'PCE' | 'PLACA' | 'PIT' | 'PDA';
  date: string;
  startTime: string;
  endTime: string;
  servicesExecuted: string;
  geotestSignature: string;
  geotestSignatureImage?: string;
  geotestCpf?: string;
  responsibleSignature: string;
  observations: string;
  createdBy: string;
  createdAt: string;
}

export interface Collaborator {
  id: string;
  name: string;
  photoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
  status: 'ativo' | 'inativo' | 'férias' | 'afastado';
  createdAt: string;
  updatedAt?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  status: 'ativa' | 'inativa';
  createdAt: string;
  updatedAt?: string;
  collaborators?: Collaborator[]; // Para quando carregar com relacionamentos
}

export interface TeamCollaborator {
  id: string;
  teamId: string;
  collaboratorId: string;
  roleInTeam?: string | null;
  assignedAt: string;
  collaborator?: Collaborator; // Para quando carregar com relacionamento
}

export interface TeamEquipmentAssignment {
  id: string;
  teamId: string;
  equipmentId: string;
  assignedAt: string;
  assignedUntil?: string | null;
  status: 'ativo' | 'finalizado';
  createdAt: string;
  updatedAt?: string;
  team?: Team; // Para quando carregar com relacionamento
  equipment?: EquipmentLocation; // Para quando carregar com relacionamento
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; code?: string; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  isLoading: boolean;
}
