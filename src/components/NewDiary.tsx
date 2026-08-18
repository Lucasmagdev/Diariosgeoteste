import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, FileText, Save, ArrowLeft, Loader2, User, Hammer, Wrench, ClipboardList, Building2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { PCEForm, PCEFormData } from './PCEForm';
import { PITForm, PITFormData } from './PITForm';
import { PLACAForm, PLACAFormData } from './PLACAForm';
import { PDAForm, PDAFormData } from './PDAForm';
import { PDADiaryForm, PDADiaryFormData } from './PDADiaryForm';
import { ClientSelector } from './ClientSelector';
import { getEstados, getCidadesByEstado, getEstadoById, getCidadeById } from '../data/estadosCidades';
import { formatTime24hOrEmpty, maskTimeInput, normalizeTimeInput } from '../utils/time';

interface NewDiaryProps {
  onBack: () => void;
  editDiaryId?: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

// Colunas numeric() do Postgres nao aceitam virgula como separador decimal.
// Os placeholders dos formularios (PCE, PIT) pedem valor em formato BR
// ("Ex.: 12,5"), entao sem essa conversao o insert falha inteiro assim que
// alguem digita um decimal — e a estaca some (o registro pai salva, o
// insert das estacas quebra e nao mostra nada na hora de ver/baixar o PDF).
const toDecimalOrNull = (value: string | null | undefined): number | null => {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Inverso do toDecimalOrNull: numero salvo no banco -> string em formato BR
// pra reabrir um diario existente com o mesmo texto que o campo mostraria.
const numToBRString = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  return String(value).replace('.', ',');
};

const strOrEmpty = (value: string | null | undefined): string => value ?? '';

const normalizeClientsList = (rows: any[] = []): Client[] => {
  return rows.map((row: any, index: number) => {
    const rawName = typeof row?.name === 'string' ? row.name.trim() : '';
    const rawEmail = typeof row?.email === 'string' ? row.email.trim() : '';
    const fallbackName = rawName || rawEmail || 'Cliente sem nome';

    return {
      id: String(row?.id ?? `client-${index}`),
      name: fallbackName,
      email: rawEmail || undefined,
      phone: typeof row?.phone === 'string' ? row.phone.trim() : undefined,
      address: typeof row?.address === 'string' ? row.address.trim() : undefined,
    };
  });
};

export const NewDiary: React.FC<NewDiaryProps> = ({ onBack, editDiaryId }) => {
  const { user } = useAuth();
  const isEditMode = Boolean(editDiaryId);
  const [loadingEdit, setLoadingEdit] = useState(isEditMode);
  const [editLoadError, setEditLoadError] = useState('');
  const [formData, setFormData] = useState({
    type: 'PCE',
    clientName: '',
    team: '',
    date: '',
    startTime: '',
    endTime: '',
    servicesExecuted: '',
    geotestSignatureImage: '',
    observations: ''
  });

  const [enderecoDetalhado, setEnderecoDetalhado] = useState({
    estadoId: 0,
    cidadeId: 0,
    cidadeNomeLivre: '',
    rua: '',
    numero: ''
  });

  const [estados] = useState(getEstados());
  const [cidades, setCidades] = useState<any[]>([]);

  const [pceData, setPceData] = useState<PCEFormData>({
    ensaioTipo: 'PCE CONVENCIONAL',
    piles: [
      { estacaNome: '', estacaProfundidadeM: '', estacaTipo: '', estacaCargaTrabalhoTf: '', estacaCargaEnsaioTf: '', estacaDiametroCm: '', confirmado: false, isExpanded: true }
    ],
    carregamentoTipos: [],
    equipamentos: { macaco: '', celula: '', manometro: '', relogios: '', conjuntoVigas: '' },
    ocorrencias: '',
    cravacao: { equipamento: '', horimetro: '' },
    abastecimento: {
      mobilizacao: { litrosTanque: '', litrosGalao: '' },
      finalDia: { litrosTanque: '', litrosGalao: '' },
      chegouDiesel: '',
      fornecidoPor: '',
      quantidadeLitros: '',
      horarioChegada: ''
    }
  });

  const [pitData, setPitData] = useState<PITFormData>({
    equipamento: '',
    equipamentoId: '',
    piles: [
      { estacaNome: '', estacaTipo: '', diametroCm: '', profundidadeM: '', arrasamentoM: '', comprimentoUtilM: '', confirmado: false, isExpanded: true }
    ],
    ocorrencias: '',
    totalEstacas: ''
  });

  const [placaData, setPlacaData] = useState<PLACAFormData>({
    testPoints: [
      { nome: '', cargaTrabalho1KgfCm2: '', cargaTrabalho2KgfCm2: '' }
    ],
    equipamentos: {
      macaco: '',
      celulaDeRCarga: '',
      manometro: '',
      placaDimensoes: '',
      equipamentoReacao: '',
      relogios: ''
    },
    ocorrencias: ''
  });

  const [pdaData, setPdaData] = useState<PDAFormData>({
    computadorSelecionados: [],
    equipamentoSelecionados: [],
    blocoNome: '',
    estacaNome: '',
    estacaTipo: '',
    diametroCm: '',
    cargaTrabalhoTf: '',
    cargaEnsaioTf: '',
    pesoMarteloKg: '',
    hq: [],
    nega: [],
    emx: [],
    rmx: [],
    dmx: [],
    secaoCravada: [],
    alturaBlocoM: '',
    alturaSensoresM: '',
    lpComprimentoUtilM: '',
    leComprimentoAteSensoresM: '',
    ltComprimentoTotalM: ''
  });

  const [pdaDiaryData, setPdaDiaryData] = useState<PDADiaryFormData>({
    pdaComputadores: [],
    piles: [{ nome: '', tipo: '', diametroCm: '', profundidadeM: '', cargaTrabalhoTf: '', cargaEnsaioTf: '', confirmado: false, isExpanded: true }],
    ocorrencias: '',
    abastecimento: {
      equipamentos: [],
      horimetroHoras: '',
      mobilizacao: { litrosTanque: '', litrosGalao: '' },
      finalDia: { litrosTanque: '', litrosGalao: '' },
      entrega: { chegouDiesel: '', fornecidoPor: '', quantidadeLitros: '', horarioChegada: '' }
    }
  });

  // Condições climáticas
  const [weather, setWeather] = useState<{ ensolarado: boolean; chuvaFraca: boolean; chuvaForte: boolean}>({
    ensolarado: false,
    chuvaFraca: false,
    chuvaForte: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [equipamentos, setEquipamentos] = useState<{ id: string; tipo: string; nome: string }[]>([]);
  const diaryTypeOptions = ['PCE', 'PLACA', 'PIT', 'PDA', 'PDA_DIARIO'] as const;
  type DiaryType = typeof diaryTypeOptions[number];
  const [activeQuickSheet, setActiveQuickSheet] = useState<
    | null
    | 'cliente'
    | 'data'
    | 'entrada'
    | 'saida'
    | 'equipe'
    | 'endereco'
    | 'clima'
    | 'assinaturas'
    | 'pce'
    | 'pit'
    | 'placa'
    | 'pda_ficha'
    | 'pda_diario'
  >(null);
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const [hasSelectedType, setHasSelectedType] = useState(false);

  // Carregar assinatura do usuário e buscar membros da equipe e clientes
  useEffect(() => {
    const loadUserData = async () => {
      if (!isSupabaseConfigured || !user) {
        setTeamMembers([]);
        // Clientes mock para modo local
        setClients([
          { id: '1', name: 'Construtora ABC Ltda', email: 'contato@abc.com.br', phone: '(11) 3333-4444', address: 'Av. Paulista, 1000 - São Paulo, SP' },
          { id: '2', name: 'Incorporadora XYZ', email: 'projetos@xyz.com.br', phone: '(21) 5555-6666', address: 'Rua Copacabana, 200 - Rio de Janeiro, RJ' }
        ]);
        return;
      }

      setLoadingTeam(true);
      setLoadingClients(true);
      try {
        // Buscar perfil do usuário com assinatura digital
        const { data: userProfile, error: userError } = await supabase
          .from('profiles')
          .select('signature_image_url')
          .eq('id', user.id)
          .single();

        if (!userError && userProfile) {
          setFormData((prev) => ({
            ...prev,
            geotestSignatureImage: userProfile.signature_image_url || '',
          }));
        }

        // Buscar clientes cadastrados
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('*')
          .order('name');

        if (!clientsError && clientsData) {
          setClients(normalizeClientsList(clientsData as any[]));
        }

        // Buscar catalogo de equipamentos (ativos)
        const { data: equipData, error: equipError } = await supabase
          .from('equipamentos')
          .select('id, tipo, nome')
          .eq('ativo', true)
          .order('nome');
        if (!equipError && equipData) {
          setEquipamentos(equipData as any[]);
        }

        // Buscar todos os usuários para formar a equipe
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email')
          .order('name');

        if (error) throw error;

        const members: TeamMember[] = (data || []).map((profile: any) => ({
          id: profile.id,
          name: profile.name || 'Usuário sem nome',
          email: profile.email || 'email@exemplo.com'
        }));

        setTeamMembers(members);
      } catch (err: any) {
        console.error('Erro ao carregar dados do usuário:', err);
        setTeamMembers([]);
        setClients([]);
      } finally {
        setLoadingTeam(false);
        setLoadingClients(false);
      }
    };

    loadUserData();
  }, [user]);

  // Modo edição: carrega o diário existente e pré-preenche todo o formulário.
  useEffect(() => {
    if (!editDiaryId || !isSupabaseConfigured) {
      setLoadingEdit(false);
      return;
    }

    const loadDiaryForEdit = async () => {
      setLoadingEdit(true);
      setEditLoadError('');
      try {
        const { data: diary, error: diaryError } = await supabase
          .from('work_diaries')
          .select('*')
          .eq('id', editDiaryId)
          .single();
        if (diaryError || !diary) throw diaryError || new Error('Diário não encontrado.');

        setFormData({
          type: diary.diary_type || 'PCE',
          clientName: diary.client_name || '',
          team: diary.team || '',
          date: diary.date || '',
          startTime: diary.start_time || '',
          endTime: diary.end_time || '',
          servicesExecuted: diary.services_executed || '',
          geotestSignatureImage: diary.geotest_signature_url || '',
          observations: diary.observations || '',
        });
        setWeather({
          ensolarado: Boolean(diary.weather_ensolarado),
          chuvaFraca: Boolean(diary.weather_chuva_fraca),
          chuvaForte: Boolean(diary.weather_chuva_forte),
        });
        setShowTypeSelector(false);
        setHasSelectedType(true);

        const endereco = diary.endereco_detalhado;
        if (endereco?.estado_id) {
          setEnderecoDetalhado({
            estadoId: endereco.estado_id || 0,
            cidadeId: endereco.cidade_id || 0,
            cidadeNomeLivre: endereco.cidade_id ? '' : (endereco.cidade_nome || ''),
            rua: endereco.rua || '',
            numero: endereco.numero || '',
          });
          if (endereco.estado_id) setCidades(getCidadesByEstado(endereco.estado_id));
        }

        // Carrega os dados especificos do tipo (cabecalho + estacas)
        if (diary.diary_type === 'PCE') {
          const { data: pce } = await supabase.from('work_diaries_pce').select('*').eq('diary_id', editDiaryId).maybeSingle();
          if (pce) {
            const { data: piles } = await supabase.from('work_diaries_pce_piles').select('*').eq('pce_id', pce.id).order('ordem', { ascending: true });
            setPceData({
              ensaioTipo: pce.ensaio_tipo || 'PCE CONVENCIONAL',
              carregamentoTipos: pce.carregamento_tipos || [],
              equipamentos: {
                macaco: strOrEmpty(pce.equipamentos_macaco),
                celula: strOrEmpty(pce.equipamentos_celula),
                manometro: strOrEmpty(pce.equipamentos_manometro),
                relogios: strOrEmpty(pce.equipamentos_relogios),
                conjuntoVigas: strOrEmpty(pce.equipamentos_conjunto_vigas),
              },
              ocorrencias: strOrEmpty(pce.ocorrencias),
              cravacao: { equipamento: strOrEmpty(pce.cravacao_equipamento), horimetro: strOrEmpty(pce.cravacao_horimetro) },
              abastecimento: {
                mobilizacao: { litrosTanque: strOrEmpty(pce.abastecimento_mobilizacao_litros_tanque), litrosGalao: strOrEmpty(pce.abastecimento_mobilizacao_litros_galao) },
                finalDia: { litrosTanque: strOrEmpty(pce.abastecimento_finaldia_litros_tanque), litrosGalao: strOrEmpty(pce.abastecimento_finaldia_litros_galao) },
                chegouDiesel: pce.abastecimento_chegou_diesel === null ? '' : (pce.abastecimento_chegou_diesel ? 'Sim' : 'Não'),
                fornecidoPor: strOrEmpty(pce.abastecimento_fornecido_por),
                quantidadeLitros: strOrEmpty(pce.abastecimento_quantidade_litros),
                horarioChegada: strOrEmpty(pce.abastecimento_horario_chegada),
              },
              piles: (piles && piles.length > 0) ? piles.map((p: any) => ({
                estacaNome: strOrEmpty(p.estaca_nome),
                estacaProfundidadeM: numToBRString(p.estaca_profundidade_m),
                estacaTipo: strOrEmpty(p.estaca_tipo),
                estacaCargaTrabalhoTf: numToBRString(p.estaca_carga_trabalho_tf),
                estacaCargaEnsaioTf: numToBRString(p.estaca_carga_ensaio_tf),
                estacaDiametroCm: numToBRString(p.estaca_diametro_cm),
                confirmado: true,
                isExpanded: false,
              })) : [{ estacaNome: '', estacaProfundidadeM: '', estacaTipo: '', estacaCargaTrabalhoTf: '', estacaCargaEnsaioTf: '', estacaDiametroCm: '', confirmado: false, isExpanded: true }],
            });
          }
        } else if (diary.diary_type === 'PIT') {
          const { data: pit } = await supabase.from('work_diaries_pit').select('*').eq('diary_id', editDiaryId).maybeSingle();
          if (pit) {
            const { data: piles } = await supabase.from('work_diaries_pit_piles').select('*').eq('pit_id', pit.id).order('ordem', { ascending: true });
            setPitData({
              equipamento: strOrEmpty(pit.equipamento),
              equipamentoId: strOrEmpty(pit.equipamento_id),
              ocorrencias: strOrEmpty(pit.ocorrencias),
              totalEstacas: pit.total_estacas === null || pit.total_estacas === undefined ? '' : String(pit.total_estacas),
              piles: (piles && piles.length > 0) ? piles.map((p: any) => ({
                estacaNome: strOrEmpty(p.estaca_nome),
                estacaTipo: strOrEmpty(p.estaca_tipo),
                diametroCm: numToBRString(p.diametro_cm),
                profundidadeM: numToBRString(p.profundidade_m),
                arrasamentoM: numToBRString(p.arrasamento_m),
                comprimentoUtilM: numToBRString(p.comprimento_util_m),
                confirmado: true,
                isExpanded: false,
              })) : [{ estacaNome: '', estacaTipo: '', diametroCm: '', profundidadeM: '', arrasamentoM: '', comprimentoUtilM: '', confirmado: false, isExpanded: true }],
            });
          }
        } else if (diary.diary_type === 'PLACA') {
          const { data: placa } = await supabase.from('work_diaries_placa').select('*').eq('diary_id', editDiaryId).maybeSingle();
          if (placa) {
            const { data: points } = await supabase.from('work_diaries_placa_piles').select('*').eq('placa_id', placa.id).order('ordem', { ascending: true });
            setPlacaData({
              equipamentos: {
                macaco: strOrEmpty(placa.equipamentos_macaco),
                celulaDeRCarga: strOrEmpty(placa.equipamentos_celula_carga),
                manometro: strOrEmpty(placa.equipamentos_manometro),
                placaDimensoes: strOrEmpty(placa.equipamentos_placa_dimensoes),
                equipamentoReacao: strOrEmpty(placa.equipamentos_equipamento_reacao),
                relogios: strOrEmpty(placa.equipamentos_relogios),
              },
              ocorrencias: strOrEmpty(placa.ocorrencias),
              testPoints: (points && points.length > 0) ? points.map((p: any) => ({
                nome: strOrEmpty(p.nome),
                cargaTrabalho1KgfCm2: strOrEmpty(p.carga_trabalho_1_kgf_cm2),
                cargaTrabalho2KgfCm2: strOrEmpty(p.carga_trabalho_2_kgf_cm2),
              })) : [{ nome: '', cargaTrabalho1KgfCm2: '', cargaTrabalho2KgfCm2: '' }],
            });
          }
        } else if (diary.diary_type === 'PDA') {
          const { data: pda } = await supabase.from('fichapda').select('*').eq('diary_id', editDiaryId).maybeSingle();
          if (pda) {
            const arrToStr = (arr: number[] | null) => (arr || []).map((v) => numToBRString(v));
            setPdaData({
              computadorSelecionados: pda.computador || [],
              equipamentoSelecionados: pda.equipamento || [],
              blocoNome: strOrEmpty(pda.bloco_nome),
              estacaNome: strOrEmpty(pda.estaca_nome),
              estacaTipo: strOrEmpty(pda.estaca_tipo),
              diametroCm: numToBRString(pda.diametro_cm),
              cargaTrabalhoTf: numToBRString(pda.carga_trabalho_tf),
              cargaEnsaioTf: numToBRString(pda.carga_ensaio_tf),
              pesoMarteloKg: numToBRString(pda.peso_martelo_kg),
              hq: arrToStr(pda.hq),
              nega: arrToStr(pda.nega),
              emx: arrToStr(pda.emx),
              rmx: arrToStr(pda.rmx),
              dmx: arrToStr(pda.dmx),
              secaoCravada: arrToStr(pda.secao_cravada),
              alturaBlocoM: numToBRString(pda.altura_bloco_m),
              alturaSensoresM: numToBRString(pda.altura_sensores_m),
              lpComprimentoUtilM: numToBRString(pda.lp_m),
              leComprimentoAteSensoresM: numToBRString(pda.le_m),
              ltComprimentoTotalM: numToBRString(pda.lt_m),
            });
          }
        } else if (diary.diary_type === 'PDA_DIARIO') {
          const { data: diario } = await supabase.from('work_diaries_pda_diario').select('*').eq('diary_id', editDiaryId).maybeSingle();
          if (diario) {
            const { data: piles } = await supabase.from('work_diaries_pda_diario_piles').select('*').eq('pda_diario_id', diario.id).order('ordem', { ascending: true });
            setPdaDiaryData({
              pdaComputadores: diario.pda_computadores || [],
              ocorrencias: strOrEmpty(diario.ocorrencias),
              abastecimento: {
                equipamentos: diario.abastec_equipamentos || [],
                horimetroHoras: numToBRString(diario.horimetro_horas),
                mobilizacao: { litrosTanque: numToBRString(diario.mobilizacao_litros_tanque), litrosGalao: numToBRString(diario.mobilizacao_litros_galao) },
                finalDia: { litrosTanque: numToBRString(diario.finaldia_litros_tanque), litrosGalao: numToBRString(diario.finaldia_litros_galao) },
                entrega: {
                  chegouDiesel: diario.entrega_chegou_diesel === null ? '' : (diario.entrega_chegou_diesel ? 'Sim' : 'Não'),
                  fornecidoPor: strOrEmpty(diario.entrega_fornecido_por),
                  quantidadeLitros: numToBRString(diario.entrega_quantidade_litros),
                  horarioChegada: strOrEmpty(diario.entrega_horario_chegada),
                },
              },
              piles: (piles && piles.length > 0) ? piles.map((p: any) => ({
                nome: strOrEmpty(p.nome),
                tipo: strOrEmpty(p.tipo),
                diametroCm: numToBRString(p.diametro_cm),
                profundidadeM: numToBRString(p.profundidade_m),
                cargaTrabalhoTf: numToBRString(p.carga_trabalho_tf),
                cargaEnsaioTf: numToBRString(p.carga_ensaio_tf),
                confirmado: true,
                isExpanded: false,
              })) : [{ nome: '', tipo: '', diametroCm: '', profundidadeM: '', cargaTrabalhoTf: '', cargaEnsaioTf: '', confirmado: false, isExpanded: true }],
            });
          }
        }
      } catch (err: any) {
        console.error('Erro ao carregar diário para edição:', err);
        setEditLoadError('Não foi possível carregar este diário para edição.');
      } finally {
        setLoadingEdit(false);
      }
    };

    loadDiaryForEdit();
  }, [editDiaryId]);

  const handleTeamMemberToggle = (memberId: string) => {
    setSelectedTeamMembers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  const getSelectedTeamNames = () => {
    return selectedTeamMembers
      .map(id => teamMembers.find(member => member.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      if (!isSupabaseConfigured) {
        console.log('Diary saved (mock):', formData);
        setSuccess('Diário salvo (modo demonstração).');
        setIsSubmitting(false);
        onBack();
        return;
      }

      if (!user?.id) {
        setError('Sessão expirada. Faça login novamente.');
        setIsSubmitting(false);
        return;
      }

      // Validar endereço detalhado obrigatório
      const hasCidadeSelecionada = enderecoDetalhado.cidadeId > 0;
      const hasCidadeDigitada = enderecoDetalhado.cidadeNomeLivre.trim().length > 0;
      if (
        !enderecoDetalhado.estadoId ||
        (!hasCidadeSelecionada && !hasCidadeDigitada) ||
        !enderecoDetalhado.rua.trim() ||
        !enderecoDetalhado.numero.trim()
      ) {
        setError('Preencha todos os campos do endereço: Estado, Cidade, Rua e Número');
        setIsSubmitting(false);
        return;
      }

      // Um equipamento e uma peca fisica unica: nao pode estar em dois
      // diarios no mesmo dia. Checa antes de criar qualquer registro,
      // pra nao sobrar diario orfao se for bloqueado aqui.
      if (formData.type === 'PIT' && pitData.equipamentoId) {
        const otherDiaries = await supabase
          .from('work_diaries')
          .select('id, client_name')
          .eq('date', formData.date)
          .neq('id', isEditMode ? editDiaryId : '00000000-0000-0000-0000-000000000000');
        const otherIds = (otherDiaries.data || []).map((d: any) => d.id);
        if (otherIds.length > 0) {
          const conflict = await supabase
            .from('work_diaries_pit')
            .select('diary_id')
            .eq('equipamento_id', pitData.equipamentoId)
            .in('diary_id', otherIds)
            .limit(1)
            .maybeSingle();
          if (conflict.data) {
            const conflictDiary = (otherDiaries.data || []).find((d: any) => d.id === conflict.data!.diary_id);
            setError(`Equipamento "${pitData.equipamento}" já está em uso em outro diário no dia ${formData.date.split('-').reverse().join('/')} (${conflictDiary?.client_name || 'outra obra'}). Escolha outro equipamento.`);
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Montar endereço completo a partir do endereço detalhado
      const estado = getEstadoById(enderecoDetalhado.estadoId);
      const cidadeSelecionada = hasCidadeSelecionada
        ? getCidadeById(enderecoDetalhado.estadoId, enderecoDetalhado.cidadeId)
        : null;
      const cidadeNome = cidadeSelecionada?.nome || enderecoDetalhado.cidadeNomeLivre.trim();
      
      if (!estado || !cidadeNome) {
        setError('Estado ou cidade inválidos. Verifique os dados informados.');
        setIsSubmitting(false);
        return;
      }

      // Formatar rua e número: usar "S/R" se rua vazia, "S/N" se número vazio
      const ruaFormatada = enderecoDetalhado.rua.trim() || 'S/R';
      const numeroFormatado = enderecoDetalhado.numero.trim() || 'S/N';
      const enderecoCompleto = `${ruaFormatada}, ${numeroFormatado}, ${cidadeNome}, ${estado.nome}`;
      let geotestSignatureImage = formData.geotestSignatureImage || '';

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('signature_image_url')
        .eq('id', user.id)
        .maybeSingle();

      if (currentProfile?.signature_image_url) {
        geotestSignatureImage = currentProfile.signature_image_url;
      }

      const payload: any = {
        user_id: user.id,
        diary_type: formData.type,
        client_name: formData.clientName.trim(),
        address: enderecoCompleto,
        endereco_detalhado: enderecoDetalhado.estadoId > 0 ? {
          estado_id: enderecoDetalhado.estadoId,
          estado_nome: getEstadoById(enderecoDetalhado.estadoId)?.nome || '',
          cidade_id: enderecoDetalhado.cidadeId > 0 ? enderecoDetalhado.cidadeId : null,
          cidade_nome: cidadeNome,
          rua: enderecoDetalhado.rua.trim(),
          numero: enderecoDetalhado.numero.trim()
        } : null,
        team: getSelectedTeamNames() || formData.team.trim(), // Usar nomes selecionados ou fallback para input manual
        date: formData.date, // yyyy-mm-dd
        start_time: formatTime24hOrEmpty(formData.startTime),
        end_time: formatTime24hOrEmpty(formData.endTime),
        services_executed: formData.servicesExecuted.trim(),
        geotest_signature: user.name || null,
        geotest_signature_url: geotestSignatureImage || null,
        // Assinatura do responsável é coletada externamente (GOV.BR)
        responsible_signature: 'Assinatura externa (GOV.BR)',
        observations: formData.observations.trim() || null,
      };

      // Se as colunas existirem no banco, elas serão aceitas; caso não existam, o supabase retornaria erro.
      // Por isso, só adicionamos no payload se alguma flag estiver marcada, mantendo nulos não enviados.
      payload.weather_ensolarado = weather.ensolarado;
      payload.weather_chuva_fraca = weather.chuvaFraca;
      payload.weather_chuva_forte = weather.chuvaForte;

      // 1) Cria (ou atualiza, em modo edição) o diário base e obtém o id
      let diaryId: string | undefined;
      if (isEditMode && editDiaryId) {
        const { error: updateError } = await supabase
          .from('work_diaries')
          .update(payload)
          .eq('id', editDiaryId);
        if (updateError) {
          setError('Não foi possível atualizar o diário. Tente novamente.');
          setIsSubmitting(false);
          return;
        }
        diaryId = editDiaryId;
      } else {
        const { data: diaryRows, error: insertError } = await supabase
          .from('work_diaries')
          .insert(payload)
          .select('id')
          .single();
        if (insertError) {
          setError('Não foi possível salvar o diário. Tente novamente.');
          setIsSubmitting(false);
          return;
        }
        diaryId = diaryRows?.id;
      }

      // Em modo edição, o registro-detalhe (work_diaries_pce/pit/placa/...) já
      // existe: atualiza em vez de inserir. As estacas/pontos não têm diff
      // linha-a-linha — apaga tudo do pai e recria com o conjunto atual,
      // mais simples e sem risco de sobrar lixo de uma edição anterior.
      const upsertDetailRow = (table: string, rowPayload: any) =>
        isEditMode
          ? supabase.from(table).update(rowPayload).eq('diary_id', diaryId).select('id').single()
          : supabase.from(table).insert(rowPayload).select('id').single();

      const clearPilesIfEditing = (table: string, fkColumn: string, parentId: string) =>
        isEditMode ? supabase.from(table).delete().eq(fkColumn, parentId) : Promise.resolve({ error: null });

      // 2) Se for PCE, cria (ou atualiza) registro PCE e, em seguida, as estacas (piles)
      if (formData.type === 'PCE' && diaryId) {
        const pcePayload: any = {
          diary_id: diaryId,
          ensaio_tipo: pceData.ensaioTipo,
          carregamento_tipos: pceData.carregamentoTipos,
          equipamentos_macaco: pceData.equipamentos.macaco || null,
          equipamentos_celula: pceData.equipamentos.celula || null,
          equipamentos_manometro: pceData.equipamentos.manometro || null,
          equipamentos_relogios: pceData.equipamentos.relogios || null,
          equipamentos_conjunto_vigas: pceData.equipamentos.conjuntoVigas || null,
          ocorrencias: pceData.ocorrencias || null,
          cravacao_equipamento: pceData.cravacao.equipamento || null,
          cravacao_horimetro: pceData.cravacao.horimetro || null,
          abastecimento_mobilizacao_litros_tanque: pceData.abastecimento.mobilizacao.litrosTanque || null,
          abastecimento_mobilizacao_litros_galao: pceData.abastecimento.mobilizacao.litrosGalao || null,
          abastecimento_finaldia_litros_tanque: pceData.abastecimento.finalDia.litrosTanque || null,
          abastecimento_finaldia_litros_galao: pceData.abastecimento.finalDia.litrosGalao || null,
          abastecimento_chegou_diesel: pceData.abastecimento.chegouDiesel === '' ? null : pceData.abastecimento.chegouDiesel === 'Sim',
          abastecimento_fornecido_por: pceData.abastecimento.fornecidoPor || null,
          abastecimento_quantidade_litros: pceData.abastecimento.quantidadeLitros || null,
          abastecimento_horario_chegada: pceData.abastecimento.horarioChegada || null,
        };

        const { data: pceRow, error: pceError } = await upsertDetailRow('work_diaries_pce', pcePayload);
        if (pceError) {
          setError('Erro ao salvar dados do PCE. Tente novamente.');
          setIsSubmitting(false);
          return;
        }

        const pceId = (pceRow as any)?.id;

        if (pceId) {
          const { error: clearErr } = await clearPilesIfEditing('work_diaries_pce_piles', 'pce_id', pceId);
          if (clearErr) {
            setError('Erro ao atualizar estacas. Tente novamente.');
            setIsSubmitting(false);
            return;
          }
        }

        if (pceId && pceData.piles && pceData.piles.length > 0) {
          const pilesPayload = pceData.piles.map((pile, idx) => ({
            pce_id: pceId,
            ordem: idx + 1,
            estaca_nome: pile.estacaNome || null,
            estaca_profundidade_m: toDecimalOrNull(pile.estacaProfundidadeM),
            estaca_tipo: pile.estacaTipo || null,
            estaca_carga_trabalho_tf: toDecimalOrNull(pile.estacaCargaTrabalhoTf),
            estaca_carga_ensaio_tf: toDecimalOrNull(pile.estacaCargaEnsaioTf),
            estaca_diametro_cm: toDecimalOrNull(pile.estacaDiametroCm),
          }));

          const { error: pilesError } = await supabase
            .from('work_diaries_pce_piles')
            .insert(pilesPayload);
          if (pilesError) {
            setError('Erro ao salvar estacas. Tente novamente.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 3) Se for PIT, cria registro PIT e estacas
      if (formData.type === 'PIT' && diaryId) {
        const pitPayload: any = {
          diary_id: diaryId,
          equipamento: pitData.equipamento || null,
          equipamento_id: pitData.equipamentoId || null,
          ocorrencias: pitData.ocorrencias || null,
          total_estacas: pitData.totalEstacas ? Number(pitData.totalEstacas) : null,
        };

        const { data: pitRow, error: pitError } = await upsertDetailRow('work_diaries_pit', pitPayload);
        if (pitError) {
          setError('Erro ao salvar dados do PIT. Tente novamente.');
          setIsSubmitting(false);
          return;
        }

        const pitId = (pitRow as any)?.id;
        if (pitId) {
          const { error: clearErr } = await clearPilesIfEditing('work_diaries_pit_piles', 'pit_id', pitId);
          if (clearErr) {
            setError('Erro ao atualizar estacas do PIT. Tente novamente.');
            setIsSubmitting(false);
            return;
          }
        }
        if (pitId && pitData.piles && pitData.piles.length > 0) {
          const piles = pitData.piles.map((pile, idx) => ({
            pit_id: pitId,
            ordem: idx + 1,
            estaca_nome: pile.estacaNome || null,
            estaca_tipo: pile.estacaTipo || null,
            diametro_cm: toDecimalOrNull(pile.diametroCm),
            profundidade_m: toDecimalOrNull(pile.profundidadeM),
            arrasamento_m: toDecimalOrNull(pile.arrasamentoM),
            comprimento_util_m: toDecimalOrNull(pile.comprimentoUtilM),
          }));

          const { error: pitPilesError } = await supabase
            .from('work_diaries_pit_piles')
            .insert(piles);
          if (pitPilesError) {
            setError('Erro ao salvar estacas do PIT. Tente novamente.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 4) Se for PLACA, cria registro PLACA e pontos de ensaio
      if (formData.type === 'PLACA' && diaryId) {
        const placaPayload: any = {
          diary_id: diaryId,
          equipamentos_macaco: placaData.equipamentos.macaco || null,
          equipamentos_celula_carga: placaData.equipamentos.celulaDeRCarga || null,
          equipamentos_manometro: placaData.equipamentos.manometro || null,
          equipamentos_placa_dimensoes: placaData.equipamentos.placaDimensoes || null,
          equipamentos_equipamento_reacao: placaData.equipamentos.equipamentoReacao || null,
          equipamentos_relogios: placaData.equipamentos.relogios || null,
          ocorrencias: placaData.ocorrencias || null,
        };

        const { data: placaRow, error: placaError } = await upsertDetailRow('work_diaries_placa', placaPayload);
        if (placaError) {
          setError('Erro ao salvar dados da Placa. Tente novamente.');
          setIsSubmitting(false);
          return;
        }

        const placaId = (placaRow as any)?.id;
        if (placaId) {
          const { error: clearErr } = await clearPilesIfEditing('work_diaries_placa_piles', 'placa_id', placaId);
          if (clearErr) {
            setError('Erro ao atualizar pontos de ensaio. Tente novamente.');
            setIsSubmitting(false);
            return;
          }
        }
        if (placaId && placaData.testPoints && placaData.testPoints.length > 0) {
          const testPoints = placaData.testPoints.map((point, idx) => ({
            placa_id: placaId,
            ordem: idx + 1,
            nome: point.nome || null,
            carga_trabalho_1_kgf_cm2: point.cargaTrabalho1KgfCm2 || null,
            carga_trabalho_2_kgf_cm2: point.cargaTrabalho2KgfCm2 || null,
          }));

          const { error: testPointsError } = await supabase
            .from('work_diaries_placa_piles')
            .insert(testPoints);
          if (testPointsError) {
            setError('Erro ao salvar pontos de ensaio. Tente novamente.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 5) Se for PDA, cria registro PDA
      if (formData.type === 'PDA' && diaryId) {
        const toNumericArray = (arr: string[]) =>
          (arr || [])
            .map((v) => v.replace(',', '.').trim())
            .map((v) => (v === '' ? null : Number(v)))
            .filter((v) => v !== null && !Number.isNaN(v)) as number[];

        const pdaPayload: any = {
          diary_id: diaryId,
          computador: pdaData.computadorSelecionados,
          equipamento: pdaData.equipamentoSelecionados,
          bloco_nome: pdaData.blocoNome || null,
          estaca_nome: pdaData.estacaNome || null,
          estaca_tipo: pdaData.estacaTipo || null,
          diametro_cm: pdaData.diametroCm ? Number(pdaData.diametroCm.replace(',', '.')) : null,
          carga_trabalho_tf: pdaData.cargaTrabalhoTf ? Number(pdaData.cargaTrabalhoTf.replace(',', '.')) : null,
          carga_ensaio_tf: pdaData.cargaEnsaioTf ? Number(pdaData.cargaEnsaioTf.replace(',', '.')) : null,
          peso_martelo_kg: pdaData.pesoMarteloKg ? Number(pdaData.pesoMarteloKg.replace(',', '.')) : null,
          hq: toNumericArray(pdaData.hq),
          nega: toNumericArray(pdaData.nega),
          emx: toNumericArray(pdaData.emx),
          rmx: toNumericArray(pdaData.rmx),
          dmx: toNumericArray(pdaData.dmx),
          secao_cravada: toNumericArray(pdaData.secaoCravada),
          altura_bloco_m: pdaData.alturaBlocoM ? Number(pdaData.alturaBlocoM.replace(',', '.')) : null,
          altura_sensores_m: pdaData.alturaSensoresM ? Number(pdaData.alturaSensoresM.replace(',', '.')) : null,
          lp_m: pdaData.lpComprimentoUtilM ? Number(pdaData.lpComprimentoUtilM.replace(',', '.')) : null,
          le_m: pdaData.leComprimentoAteSensoresM ? Number(pdaData.leComprimentoAteSensoresM.replace(',', '.')) : null,
          lt_m: pdaData.ltComprimentoTotalM ? Number(pdaData.ltComprimentoTotalM.replace(',', '.')) : null,
        };

        const pdaQuery = isEditMode
          ? supabase.from('fichapda').update(pdaPayload).eq('diary_id', diaryId)
          : supabase.from('fichapda').insert(pdaPayload);
        const { error: pdaError } = await pdaQuery;
        if (pdaError) {
          setError('Erro ao salvar dados do PDA. Tente novamente.');
          setIsSubmitting(false);
          return;
        }
      }

      // 6) Se for PDA_DIARIO, cria cabeçalho e estacas do dia
      if (formData.type === 'PDA_DIARIO' && diaryId) {
        const toNum = (s: string) => {
          const t = (s || '').replace(',', '.').trim();
          const n = Number(t);
          return Number.isFinite(n) ? n : null;
        };

        const diarioPayload: any = {
          diary_id: diaryId,
          pda_computadores: pdaDiaryData.pdaComputadores,
          ocorrencias: pdaDiaryData.ocorrencias || null,
          abastec_equipamentos: pdaDiaryData.abastecimento.equipamentos,
          horimetro_horas: toNum(pdaDiaryData.abastecimento.horimetroHoras),
          mobilizacao_litros_tanque: toNum(pdaDiaryData.abastecimento.mobilizacao.litrosTanque),
          mobilizacao_litros_galao: toNum(pdaDiaryData.abastecimento.mobilizacao.litrosGalao),
          finaldia_litros_tanque: toNum(pdaDiaryData.abastecimento.finalDia.litrosTanque),
          finaldia_litros_galao: toNum(pdaDiaryData.abastecimento.finalDia.litrosGalao),
          entrega_chegou_diesel: pdaDiaryData.abastecimento.entrega.chegouDiesel === '' ? null : pdaDiaryData.abastecimento.entrega.chegouDiesel === 'Sim',
          entrega_fornecido_por: pdaDiaryData.abastecimento.entrega.fornecidoPor || null,
          entrega_quantidade_litros: toNum(pdaDiaryData.abastecimento.entrega.quantidadeLitros),
          entrega_horario_chegada: pdaDiaryData.abastecimento.entrega.horarioChegada || null,
        };

        const { data: diarioRow, error: diarioError } = await upsertDetailRow('work_diaries_pda_diario', diarioPayload);
        if (diarioError) {
          setError('Erro ao salvar diário PDA. Tente novamente.');
          setIsSubmitting(false);
          return;
        }

        const diarioId = (diarioRow as any)?.id;
        if (diarioId) {
          const { error: clearErr } = await clearPilesIfEditing('work_diaries_pda_diario_piles', 'pda_diario_id', diarioId);
          if (clearErr) {
            setError('Erro ao atualizar estacas do PDA. Tente novamente.');
            setIsSubmitting(false);
            return;
          }
        }
        if (diarioId && pdaDiaryData.piles && pdaDiaryData.piles.length > 0) {
          const dataRows = (pdaDiaryData.piles || []).filter((p: any) =>
            p && (p.confirmado === true || Object.values(p).some((v: any) => typeof v === 'string' ? v.trim() !== '' : false))
          );
          const rows = dataRows.map((p, idx) => ({
            pda_diario_id: diarioId,
            ordem: idx + 1,
            nome: p.nome || null,
            tipo: p.tipo || null,
            diametro_cm: toNum(p.diametroCm),
            profundidade_m: toNum(p.profundidadeM),
            carga_trabalho_tf: toNum(p.cargaTrabalhoTf),
            carga_ensaio_tf: toNum(p.cargaEnsaioTf),
          }));

          const { error: pilesError } = await supabase
            .from('work_diaries_pda_diario_piles')
            .insert(rows);
          if (pilesError) {
            setError('Erro ao salvar estacas do PDA. Tente novamente.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      setSuccess(isEditMode ? 'Diário atualizado com sucesso.' : 'Registro salvo com sucesso.');
      setIsSubmitting(false);
      onBack();
    } catch (err: any) {
      setError('Erro inesperado ao salvar o diário. Tente novamente.');
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEstadoChange = (estadoId: number) => {
      setEnderecoDetalhado(prev => ({
        ...prev,
        estadoId,
        cidadeId: 0, // Reset cidade quando muda estado
        cidadeNomeLivre: ''
      }));
    
    if (estadoId > 0) {
      const cidadesDoEstado = getCidadesByEstado(estadoId);
      setCidades(cidadesDoEstado);
    } else {
      setCidades([]);
    }
  };

  const handleEnderecoChange = (field: string, value: string | number) => {
    setEnderecoDetalhado(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTypeSelect = (opt: DiaryType) => {
    handleChange('type', opt);
    setActiveQuickSheet(null);
    setShowTypeSelector(false);
    setHasSelectedType(true);
  };

  const scrollToSection = (id: string) => {
    try {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {}
  };

  const isGeneralCompleted = (section: 'cliente' | 'data' | 'entrada' | 'saida' | 'equipe' | 'endereco' | 'clima' | 'assinaturas') => {
    if (section === 'cliente') return Boolean(formData.clientName?.trim());
    if (section === 'data') return Boolean(formData.date);
    if (section === 'entrada') return Boolean(formData.startTime);
    if (section === 'saida') return Boolean(formData.endTime);
    if (section === 'equipe') return selectedTeamMembers.length > 0 || Boolean(formData.team?.trim());
    if (section === 'endereco') {
      const hasCidade = enderecoDetalhado.cidadeId > 0 || enderecoDetalhado.cidadeNomeLivre.trim().length > 0;
      return Boolean(
        enderecoDetalhado.estadoId &&
          hasCidade &&
          enderecoDetalhado.rua.trim() &&
          enderecoDetalhado.numero.trim()
      );
    }
    if (section === 'clima') return weather.ensolarado || weather.chuvaFraca || weather.chuvaForte;
    if (section === 'assinaturas') return true;
    return false;
  };

  const hasAnyString = (value: any): boolean => {
    if (!value) return false;
    // Booleanos são apenas controle de UI (isExpanded) ou confirmação (confirmado),
    // não contam como conteúdo preenchido.
    if (typeof value === 'boolean') return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) {
      return value.some((item) => hasAnyString(item));
    }
    if (typeof value === 'object') {
      return Object.values(value).some((v) => hasAnyString(v));
    }
    return Boolean(value);
  };

  type QuickKey =
    | 'cliente'
    | 'data'
    | 'entrada'
    | 'saida'
    | 'equipe'
    | 'endereco'
    | 'clima'
    | 'assinaturas'
    | 'pce'
    | 'pit'
    | 'placa'
    | 'pda_ficha'
    | 'pda_diario';

  const isTypeSpecificCompleted = (key: QuickKey) => {
    if (key === 'pce') {
      return (
        hasAnyString(pceData.equipamentos) ||
        (pceData.carregamentoTipos || []).length > 0 ||
        pceData.ocorrencias.trim() !== '' ||
        (pceData.piles || []).some((pile) => hasAnyString(pile))
      );
    }
    if (key === 'pit') {
      return (
        pitData.equipamento !== '' ||
        pitData.ocorrencias.trim() !== '' ||
        pitData.totalEstacas.trim() !== '' ||
        (pitData.piles || []).some((pile) => hasAnyString(pile))
      );
    }
    if (key === 'placa') {
      return (
        hasAnyString(placaData.equipamentos) ||
        placaData.ocorrencias.trim() !== '' ||
        (placaData.testPoints || []).some((point) => hasAnyString(point))
      );
    }
    if (key === 'pda_ficha') {
      return (
        (pdaData.computadorSelecionados || []).length > 0 ||
        (pdaData.equipamentoSelecionados || []).length > 0 ||
        hasAnyString(pdaData)
      );
    }
    if (key === 'pda_diario') {
      return (
        (pdaDiaryData.pdaComputadores || []).length > 0 ||
        hasAnyString(pdaDiaryData.abastecimento) ||
        pdaDiaryData.ocorrencias.trim() !== '' ||
        (pdaDiaryData.piles || []).some((pile) => hasAnyString(pile))
      );
    }
    return false;
  };

  const quickItemsForType = (): Array<{ key: QuickKey; label: string; icon: React.ReactNode; completed: boolean }> => {
    if (!hasSelectedType) return [];
    const items: Array<{ key: QuickKey; label: string; icon: React.ReactNode; completed: boolean }> = [
      { key: 'cliente', label: 'Cliente', icon: <Building2 className="w-6 h-6" />, completed: isGeneralCompleted('cliente') },
      { key: 'data', label: 'Data', icon: <Calendar className="w-6 h-6" />, completed: isGeneralCompleted('data') },
      { key: 'entrada', label: 'Entrada', icon: <Clock className="w-6 h-6" />, completed: isGeneralCompleted('entrada') },
      { key: 'saida', label: 'Saída', icon: <Clock className="w-6 h-6" />, completed: isGeneralCompleted('saida') },
      { key: 'equipe', label: 'Equipe', icon: <User className="w-6 h-6" />, completed: isGeneralCompleted('equipe') },
      { key: 'endereco', label: 'Endereço', icon: <MapPin className="w-6 h-6" />, completed: isGeneralCompleted('endereco') },
      { key: 'clima', label: 'Clima', icon: <FileText className="w-6 h-6" />, completed: isGeneralCompleted('clima') },
      { key: 'assinaturas', label: 'Assinaturas', icon: <FileText className="w-6 h-6" />, completed: isGeneralCompleted('assinaturas') },
    ];

    if (formData.type === 'PCE') {
      items.push({ key: 'pce', label: 'PCE', icon: <ClipboardList className="w-6 h-6" />, completed: isTypeSpecificCompleted('pce') });
    } else if (formData.type === 'PIT') {
      items.push({ key: 'pit', label: 'PIT', icon: <Hammer className="w-6 h-6" />, completed: isTypeSpecificCompleted('pit') });
    } else if (formData.type === 'PLACA') {
      items.push({ key: 'placa', label: 'Placa', icon: <Wrench className="w-6 h-6" />, completed: isTypeSpecificCompleted('placa') });
    } else if (formData.type === 'PDA') {
      items.push({
        key: 'pda_ficha',
        label: 'Ficha PDA',
        icon: <ClipboardList className="w-6 h-6" />,
        completed: isTypeSpecificCompleted('pda_ficha'),
      });
    } else if (formData.type === 'PDA_DIARIO') {
      items.push({
        key: 'pda_diario',
        label: 'PDA',
        icon: <ClipboardList className="w-6 h-6" />,
        completed: isTypeSpecificCompleted('pda_diario'),
      });
    }

    return items;
  };

  if (loadingEdit) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-0 flex flex-col items-center justify-center py-24 text-gray-500">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p>Carregando diário para edição...</p>
      </div>
    );
  }

  if (editLoadError) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-0">
        <button onClick={onBack} className="flex items-center text-green-600 hover:text-green-700 px-2 py-1 rounded-lg font-medium mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </button>
        <div className="p-4 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{editLoadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-0">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <button
          onClick={onBack}
          className="flex items-center text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 px-2 py-1 rounded-lg font-medium mb-2 sm:mb-3 md:mb-4 transition-all duration-200 hover:scale-105"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
          <span className="text-sm sm:text-base">Voltar</span>
        </button>

        <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
          <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-green-600 rounded-lg flex items-center justify-center shadow-sm">
            <FileText className="text-white w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
              {isEditMode ? 'Editar Diário de Obra' : (formData.type === 'PDA' ? 'Nova Ficha Técnica de PDA' : 'Novo Diário de Obra')}
            </h1>
          </div>
        </div>
      </div>

      {showTypeSelector && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Selecione o tipo de diário</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Escolha o tipo de registro que deseja criar para continuar o preenchimento.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {diaryTypeOptions.map((opt) => {
                const label = opt === 'PDA' ? 'Ficha PDA' : opt === 'PDA_DIARIO' ? 'PDA' : opt;
                const active = formData.type === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleTypeSelect(opt)}
                    className={`rounded-xl border px-4 py-4 text-sm font-semibold transition ${
                      active
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-green-50 dark:hover:bg-green-900/20'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {hasSelectedType && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end bg-white dark:bg-gray-950">
              <button
                type="button"
                onClick={() => {
                  setShowTypeSelector(false);
                  setActiveQuickSheet(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Manter tipo atual
              </button>
            </div>
          )}
        </div>
      )}

      {/* Página móvel por seção */}
      {activeQuickSheet && (
        <div className="fixed inset-0 z-50 md:hidden bg-white dark:bg-gray-900 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
            <button
              type="button"
              onClick={() => setActiveQuickSheet(null)}
              className="flex items-center text-green-700 dark:text-green-300"
            >
              <ArrowLeft className="w-5 h-5 mr-1" /> Voltar
            </button>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {activeQuickSheet === 'tipo' && 'Tipo de Diário'}
              {activeQuickSheet === 'cliente' && 'Cliente'}
              {activeQuickSheet === 'data' && 'Definir Data'}
              {activeQuickSheet === 'entrada' && 'Definir Início'}
              {activeQuickSheet === 'saida' && 'Definir Término'}
              {activeQuickSheet === 'equipe' && 'Selecionar Equipe'}
              {activeQuickSheet === 'endereco' && 'Endereço'}
              {activeQuickSheet === 'clima' && 'Condições Climáticas'}
              {activeQuickSheet === 'assinaturas' && 'Assinaturas'}
              {activeQuickSheet === 'pce' && 'Formulário PCE'}
              {activeQuickSheet === 'pit' && 'Formulário PIT'}
              {activeQuickSheet === 'placa' && 'Formulário Placa'}
              {activeQuickSheet === 'pda_ficha' && 'Ficha Técnica PDA'}
              {activeQuickSheet === 'pda_diario' && 'Diário PDA'}
            </h3>
            <div className="w-8" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeQuickSheet === 'cliente' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Cliente *
                  </label>
                  {isSupabaseConfigured && (
                    <button
                      type="button"
                      onClick={async () => {
                        setLoadingClients(true);
                        try {
                          const { data: clientsData, error: clientsError } = await supabase
                            .from('clients')
                            .select('*')
                            .order('name');
                          if (!clientsError && clientsData) {
                            setClients(normalizeClientsList(clientsData as any[]));
                          }
                        } finally {
                          setLoadingClients(false);
                        }
                      }}
                      className="text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
                      disabled={loadingClients}
                    >
                      {loadingClients ? 'Atualizando...' : 'Atualizar'}
                    </button>
                  )}
                </div>
                {loadingClients ? (
                  <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando clientes...
                  </div>
                ) : (
                  <>
                    <ClientSelector
                      clients={clients}
                      value={formData.clientName}
                      onChange={(value) => handleChange('clientName', value)}
                      loading={loadingClients}
                      required
                    />
                    {clients.length === 0 && (
                      <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                        Nenhum cliente cadastrado. {user?.role === 'admin' && 'Cadastre clientes na seção "Clientes".'}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {activeQuickSheet === 'data' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Data *</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {activeQuickSheet === 'entrada' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Início *</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="00:00"
                    maxLength={5}
                    value={formData.startTime}
                    onChange={(e) => handleChange('startTime', maskTimeInput(e.target.value))}
                    onBlur={(e) => handleChange('startTime', normalizeTimeInput(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {activeQuickSheet === 'saida' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Término *</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="00:00"
                    maxLength={5}
                    value={formData.endTime}
                    onChange={(e) => handleChange('endTime', maskTimeInput(e.target.value))}
                    onBlur={(e) => handleChange('endTime', normalizeTimeInput(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {activeQuickSheet === 'equipe' && (
              <div className="space-y-3">
                {loadingTeam ? (
                  <div className="flex items-center justify-center py-8 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">Carregando membros da equipe...</span>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950">
                    {teamMembers.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamMembers.includes(member.id)}
                          onChange={() => handleTeamMemberToggle(member.id)}
                          className="app-checkbox"
                        />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeQuickSheet === 'endereco' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Estado *</label>
                  <select
                    value={enderecoDetalhado.estadoId}
                    onChange={(e) => handleEstadoChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  >
                    <option value={0}>Selecione o estado</option>
                    {estados.map((estado) => (
                      <option key={estado.id} value={estado.id}>
                        {estado.nome} ({estado.sigla})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Cidade (selecione ou digite) *</label>
                    <select
                      value={enderecoDetalhado.cidadeId}
                      onChange={(e) => handleEnderecoChange('cidadeId', Number(e.target.value))}
                      disabled={enderecoDetalhado.estadoId === 0}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value={0}>Selecione a cidade</option>
                      {cidades.map((cidade) => (
                        <option key={cidade.id} value={cidade.id}>
                          {cidade.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Ou digite a cidade</label>
                    <input
                      type="text"
                      value={enderecoDetalhado.cidadeNomeLivre}
                      onChange={(e) => handleEnderecoChange('cidadeNomeLivre', e.target.value)}
                      placeholder="Ex: Ouro Preto"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      Pode escolher na lista ou apenas digitar; um dos dois é suficiente.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Rua *</label>
                    <input
                      type="text"
                      value={enderecoDetalhado.rua}
                      onChange={(e) => handleEnderecoChange('rua', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      placeholder="Nome da rua"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Número *</label>
                    <input
                      type="text"
                      value={enderecoDetalhado.numero}
                      onChange={(e) => handleEnderecoChange('numero', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      placeholder="Número"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeQuickSheet === 'clima' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={weather.ensolarado}
                    onChange={(e) => setWeather((w) => ({ ...w, ensolarado: e.target.checked }))}
                    className="app-checkbox"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">Ensolarado</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={weather.chuvaFraca}
                    onChange={(e) => setWeather((w) => ({ ...w, chuvaFraca: e.target.checked }))}
                    className="app-checkbox"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">Chuva fraca</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={weather.chuvaForte}
                    onChange={(e) => setWeather((w) => ({ ...w, chuvaForte: e.target.checked }))}
                    className="app-checkbox"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">Chuva forte</span>
                </label>
              </div>
            )}

            {activeQuickSheet === 'assinaturas' && (
              <div className="space-y-3">
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4 text-sm text-gray-600 dark:text-gray-300">
                  As assinaturas serão preenchidas diretamente no GOV.
                  O PDF gerado trará apenas os espaços em branco para a Geoteste e o cliente assinarem posteriormente.
                </div>
              </div>
            )}

            {activeQuickSheet === 'pce' && (
              <div className="space-y-3">
                <PCEForm value={pceData} onChange={setPceData} />
              </div>
            )}
            {activeQuickSheet === 'pit' && (
              <div className="space-y-3">
                <PITForm value={pitData} onChange={setPitData} equipamentosDisponiveis={equipamentos.filter(e => e.tipo === 'PIT')} />
              </div>
            )}
            {activeQuickSheet === 'placa' && (
              <div className="space-y-3">
                <PLACAForm value={placaData} onChange={setPlacaData} />
              </div>
            )}
            {activeQuickSheet === 'pda_ficha' && (
              <div className="space-y-3">
                <PDAForm value={pdaData} onChange={setPdaData} />
              </div>
            )}
            {activeQuickSheet === 'pda_diario' && (
              <div className="space-y-3">
                <PDADiaryForm value={pdaDiaryData} onChange={setPdaDiaryData} />
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2 bg-white dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setActiveQuickSheet(null)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => setActiveQuickSheet(null)}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
      {hasSelectedType && !showTypeSelector && (
        <div className="md:hidden space-y-4 mb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Fluxo do diário</p>
            {!isEditMode && (
              <button
                type="button"
                onClick={() => {
                  setShowTypeSelector(true);
                  setActiveQuickSheet(null);
                }}
                className="text-xs font-medium text-green-700 dark:text-green-300 underline"
              >
                Alterar tipo
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {quickItemsForType().map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveQuickSheet(item.key)}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 active:scale-95 transition ${
                  item.completed ? 'bg-green-700 border-green-700 text-white' : 'bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200'
                }`}
              >
                <span className="mb-1 text-green-600">{item.icon}</span>
                <span className="text-xs font-medium text-center">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        {hasSelectedType && (
          <>
            <div className="hidden md:block space-y-6 sm:space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Fluxo do diário</h2>
                {!isEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTypeSelector(true);
                      setActiveQuickSheet(null);
                    }}
                    className="text-xs font-medium text-green-700 dark:text-green-300 underline"
                  >
                    Alterar tipo
                  </button>
                )}
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="p-4 sm:p-5 md:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600" />
              Informações Básicas
            </h2>
          </div>
          
          <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
            {/* Condições Climáticas */}
            <div id="sec-clima">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Condições Climáticas
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={weather.ensolarado}
                    onChange={(e) => setWeather((w) => ({ ...w, ensolarado: e.target.checked }))}
                    className="app-checkbox"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">Ensolarado</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={weather.chuvaFraca}
                    onChange={(e) => setWeather((w) => ({ ...w, chuvaFraca: e.target.checked }))}
                    className="app-checkbox"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">Chuva fraca</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={weather.chuvaForte}
                    onChange={(e) => setWeather((w) => ({ ...w, chuvaForte: e.target.checked }))}
                    className="app-checkbox"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-200">Chuva forte</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Tipo de Registro *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['PCE','PLACA','PIT','PDA','PDA_DIARIO'] as const).map((opt) => {
                  const label = opt === 'PDA' ? 'Ficha PDA' : opt === 'PDA_DIARIO' ? 'PDA' : opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={isEditMode}
                      onClick={() => handleChange('type', opt)}
                      className={`${formData.type === opt ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700'} px-3 py-2 rounded-lg font-medium hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div id="sec-cliente">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Cliente *
                  </label>
                  {isSupabaseConfigured && (
                    <button
                      type="button"
                      onClick={async () => {
                        setLoadingClients(true);
                        try {
                          const { data: clientsData, error: clientsError } = await supabase
                            .from('clients')
                            .select('*')
                            .order('name');
                          if (!clientsError && clientsData) {
                            setClients(normalizeClientsList(clientsData as any[]));
                          }
                        } finally {
                          setLoadingClients(false);
                        }
                      }}
                      className="text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
                      disabled={loadingClients}
                    >
                      {loadingClients ? 'Atualizando...' : 'Atualizar'}
                    </button>
                  )}
                </div>
                {loadingClients ? (
                  <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando clientes...
                  </div>
                ) : (
                  <>
                    <ClientSelector
                      clients={clients}
                      value={formData.clientName}
                      onChange={(value) => handleChange('clientName', value)}
                      loading={loadingClients}
                      required
                    />
                    {clients.length === 0 && (
                      <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                        Nenhum cliente cadastrado. {user?.role === 'admin' && 'Cadastre clientes na seção "Clientes".'}
                      </p>
                    )}
                  </>
                )}
              </div>
              
            <div id="sec-equipe">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Equipe *
              </label>
              
              {loadingTeam ? (
                <div className="flex items-center justify-center py-8 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Carregando membros da equipe...</span>
                </div>
              ) : teamMembers.length > 0 ? (
                <div className="space-y-3">
                  {/* Mostrar membros selecionados */}
                  {selectedTeamMembers.length > 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                        Membros selecionados ({selectedTeamMembers.length}):
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {getSelectedTeamNames()}
                      </p>
                    </div>
                  )}
                  
                  {/* Lista de membros disponíveis */}
                  <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950">
                    {teamMembers.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeamMembers.includes(member.id)}
                          onChange={() => handleTeamMemberToggle(member.id)}
                          className="app-checkbox"
                        />
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {member.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {member.email}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  {/* Removido input manual de membros */}
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Nenhum usuário encontrado para montar a equipe.
                  </p>
                </div>
              )}
            </div>
            </div>

            {/* Endereço Detalhado */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4" id="sec-endereco">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
                Endereço *
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Estado *
                  </label>
                  <select
                    value={enderecoDetalhado.estadoId}
                    onChange={(e) => handleEstadoChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    required
                  >
                    <option value={0}>Selecione o estado</option>
                    {estados.map((estado) => (
                      <option key={estado.id} value={estado.id}>
                        {estado.nome} ({estado.sigla})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Cidade *
                  </label>
                  <select
                    value={enderecoDetalhado.cidadeId}
                    onChange={(e) => handleEnderecoChange('cidadeId', Number(e.target.value))}
                    disabled={enderecoDetalhado.estadoId === 0}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  >
                    <option value={0}>Selecione a cidade</option>
                    {cidades.map((cidade) => (
                      <option key={cidade.id} value={cidade.id}>
                        {cidade.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Rua *
                  </label>
                  <input
                    type="text"
                    value={enderecoDetalhado.rua}
                    onChange={(e) => handleEnderecoChange('rua', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    placeholder="Nome da rua"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Número *
                  </label>
                  <input
                    type="text"
                    value={enderecoDetalhado.numero}
                    onChange={(e) => handleEnderecoChange('numero', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    placeholder="Número"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6" id="sec-data-horarios">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Data *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange('date', e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Início *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="00:00"
                      maxLength={5}
                      value={formData.startTime}
                      onChange={(e) => handleChange('startTime', maskTimeInput(e.target.value))}
                      onBlur={(e) => handleChange('startTime', normalizeTimeInput(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Término *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="00:00"
                      maxLength={5}
                      value={formData.endTime}
                      onChange={(e) => handleChange('endTime', maskTimeInput(e.target.value))}
                      onBlur={(e) => handleChange('endTime', normalizeTimeInput(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>

          {formData.type === 'PCE' && (
            <div className="mt-6">
              <PCEForm value={pceData} onChange={setPceData} />
            </div>
          )}

          {formData.type === 'PLACA' && (
            <div className="mt-6">
              <PLACAForm value={placaData} onChange={setPlacaData} />
            </div>
          )}

          {formData.type === 'PIT' && (
            <div className="mt-6">
              <PITForm value={pitData} onChange={setPitData} equipamentosDisponiveis={equipamentos.filter(e => e.tipo === 'PIT')} />
            </div>
          )}

          {formData.type === 'PDA' && (
            <div className="mt-6">
              <PDAForm value={pdaData} onChange={setPdaData} />
            </div>
          )}

          {formData.type === 'PDA_DIARIO' && (
            <div className="mt-6">
              <PDADiaryForm value={pdaDiaryData} onChange={setPdaDiaryData} />
            </div>
          )}

          <div id="sec-assinaturas" className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="p-4 sm:p-5 md:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Assinaturas</h2>
          </div>
          
          <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-4 sm:p-5 text-sm text-gray-600 dark:text-gray-300">
              <p className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Assinaturas coletadas externamente</p>
              <p>
                Este diário será assinado no portal GOV.BR. O PDF exportado incluirá apenas os espaços em branco
                tanto para a Geoteste quanto para o cliente assinarem manualmente após o download.
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Nenhuma assinatura é armazenada ou preenchida automaticamente neste formulário.
              </p>
            </div>

            {/* Observações - Não exibir para Ficha técnica de PDA */}
            {formData.type !== 'Ficha técnica de PDA' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Observações
                </label>
                <textarea
                  value={formData.observations}
                  onChange={(e) => handleChange('observations', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Observações adicionais, condições do solo, intercorrências, etc."
                />
              </div>
            )}
          </div>
        </div>

        </div> {/* end desktop block */}

          </>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-3 sm:space-y-0 sm:space-x-3 md:space-x-4 py-4 sm:py-5 md:py-6">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-4 sm:px-5 md:px-6 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 hover:scale-105 transition-all duration-200"
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 sm:px-6 md:px-8 py-2.5 sm:py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 hover:shadow-lg hover:scale-105 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none flex items-center justify-center space-x-2"
          >
            <Save className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">
              {isSubmitting ? 'Salvando...' : (isEditMode ? 'Salvar alterações' : 'Salvar Diário')}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
