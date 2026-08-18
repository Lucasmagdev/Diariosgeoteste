export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  isSuperAdmin?: boolean;
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
  responsibleSignatureImage?: string;
  responsibleSignedAt?: string;
  responsibleSignedBy?: string;
  responsibleCpf?: string;
  signatureStatus?: 'pending' | 'signed';
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

export type ObraDocumentCategory =
  | 'contrato'
  | 'dados_cliente'
  | 'sondagem'
  | 'projetos'
  | 'diarios'
  | 'medicoes'
  | 'relatorio'
  | 'art'
  | 'outro';

export interface Obra {
  id: string;
  obraCode?: string | null;
  name: string;
  clientId?: string | null;
  address?: string | null;
  status: 'ativa' | 'concluida' | 'inativa';
  confidential?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ObraDocument {
  id: string;
  obraId: string;
  category: ObraDocumentCategory;
  customLabel?: string | null;
  title: string;
  fileUrl: string;
  fileType?: string | null;
  relatorioPin?: string | null;
  requiresSignature: boolean;
  signatureUrl?: string | null;
  signedAt?: string | null;
  signedBy?: string | null;
  signedCpf?: string | null;
  signatureStatus: 'na' | 'pending' | 'signed';
  createdAt: string;
}

export interface PortalCredential {
  id: string;
  clientId: string;
  email: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface ChecklistTemplateItem {
  id: string;
  templateId: string;
  position: number;
  text: string;
  required: boolean;
  requiresPhoto: boolean;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  items: ChecklistTemplateItem[];
}

export interface ObraChecklistItem {
  id: string;
  position: number;
  text: string;
  required: boolean;
  requiresPhoto: boolean;
  checked: boolean;
  photoData?: string | null;
  note?: string | null;
}

export interface ObraChecklist {
  id: string;
  obraId: string;
  templateId?: string | null;
  title: string;
  status: 'pending' | 'completed';
  signatureUrl?: string | null;
  signedAt?: string | null;
  signedBy?: string | null;
  createdAt: string;
  items: ObraChecklistItem[];
}

export interface SatisfactionSurveyRatings {
  comercial_atendimento: number;
  comercial_agilidade: number;
  comercial_clareza: number;
  operacional_organizacao_campo: number;
  operacional_qualidade_execucao: number;
  operacional_prazos_operacao: number;
  operacional_atendimento_medicao: number;
  documentacao_prazo_entrega: number;
  documentacao_clareza_relatorios: number;
  documentacao_atendimento: number;
}

export interface SatisfactionSurveyResponse {
  id: string;
  obraId: string;
  linkId?: string | null;
  empresa?: string | null;
  obraNome?: string | null;
  dataReferencia?: string | null;
  ratings: SatisfactionSurveyRatings;
  avaliacaoGeral: number;
  nps: number;
  indicacaoEmpresas?: string | null;
  comentarioAgradou?: string | null;
  comentarioMelhorar?: string | null;
  comentarioObservacao?: string | null;
  createdAt: string;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; code?: string; message?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  isLoading: boolean;
}
