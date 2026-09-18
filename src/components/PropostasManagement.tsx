import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, FileUp, Loader2, Trash2, Edit, CheckCircle2, XCircle, TrendingUp, X as XIcon,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import FormInput from './FormInput';
import FormTextarea from './FormTextarea';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { DonutChart, FilterBar, IconButton, Modal, PageHeader, PeriodoFilterButtons, StatusBadge, Surface } from './ui';
import { ObraSelector, ObraOption } from './ObraSelector';
import { Periodo, periodoSince, regiaoPorUf } from '../lib/periodoFiltro';
import { PropostasMap } from './PropostasMap';

const MODALIDADES = ['PIT', 'PDA', 'PCE', 'PLACA', 'HAMMER'] as const;
type Modalidade = typeof MODALIDADES[number];
type Status = 'enviada' | 'aceita' | 'recusada';

interface PropostaItem {
  descricao: string;
  unidade: string | null;
  quantidade: number | null;
  valorUnitario: number | null;
  valorEstimado: number | null;
}

interface Proposta {
  id: string;
  numero: string | null;
  revisao: string | null;
  modalidade: Modalidade;
  clienteNome: string;
  clienteCnpj: string | null;
  obraId: string | null;
  obraNome: string | null;
  enderecoObra: string | null;
  cidade: string | null;
  uf: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  responsavelComercial: string | null;
  contatoComercial: string | null;
  sondagem: string | null;
  projetoFundacoes: string | null;
  validadeDias: number | null;
  valorTotal: number;
  valorEntrada: number | null;
  periodicidadeMedicao: string | null;
  prazoPagamentoDias: number | null;
  dataProposta: string | null;
  status: Status;
  motivoRecusa: string | null;
  itens: PropostaItem[];
  arquivoNome: string | null;
  ehLicitacao: boolean;
  concorrentes: string | null;
  orgaoLicitante: string | null;
  numeroProcesso: string | null;
  dataAbertura: string | null;
  createdAt: string;
}

const emptyForm = {
  numero: '',
  revisao: '',
  modalidade: 'PIT' as Modalidade,
  clienteNome: '',
  clienteCnpj: '',
  obraId: '' as string | null,
  obraNome: '',
  enderecoObra: '',
  cidade: '',
  uf: '',
  contatoNome: '',
  contatoTelefone: '',
  responsavelComercial: '',
  contatoComercial: '',
  sondagem: '',
  projetoFundacoes: '',
  validadeDias: '',
  valorTotal: '',
  valorEntrada: '',
  periodicidadeMedicao: '',
  prazoPagamentoDias: '',
  dataProposta: '',
  status: 'enviada' as Status,
  motivoRecusa: '',
  arquivoNome: '',
  ehLicitacao: false,
  concorrentes: '',
  orgaoLicitante: '',
  numeroProcesso: '',
  dataAbertura: '',
};

type FormState = typeof emptyForm;

const currency = (value: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const statusLabels: Record<Status, string> = { enviada: 'Enviada', aceita: 'Aceita', recusada: 'Recusada' };
const statusVariants: Record<Status, 'info' | 'success' | 'danger'> = { enviada: 'info', aceita: 'success', recusada: 'danger' };
const statusHex: Record<Status, string> = { enviada: '#3b82f6', aceita: '#10b981', recusada: '#ef4444' };
const modalidadeBarColor: Record<Modalidade, string> = { PIT: 'bg-teal-500', PDA: 'bg-indigo-500', PCE: 'bg-amber-500', PLACA: 'bg-pink-500', HAMMER: 'bg-purple-500' };

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    resolve(result.split(',')[1] || '');
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const PropostasManagement: React.FC = () => {
  const toast = useToast();
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [obras, setObras] = useState<ObraOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [periodo, setPeriodo] = useState<Periodo>('tudo');
  const [cidadeFiltro, setCidadeFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<Status | 'todas'>('todas');

  const [showModal, setShowModal] = useState(false);
  const [editingProposta, setEditingProposta] = useState<Proposta | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [itens, setItens] = useState<PropostaItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; id: string | null; label: string | null }>({ isOpen: false, id: null, label: null });

  const mapRowToProposta = (row: any): Proposta => ({
    id: row.id,
    numero: row.numero || null,
    revisao: row.revisao || null,
    modalidade: row.modalidade,
    clienteNome: row.cliente_nome || '',
    clienteCnpj: row.cliente_cnpj || null,
    obraId: row.obra_id || null,
    obraNome: row.obra_nome || null,
    enderecoObra: row.endereco_obra || null,
    cidade: row.cidade || null,
    uf: row.uf || null,
    contatoNome: row.contato_nome || null,
    contatoTelefone: row.contato_telefone || null,
    responsavelComercial: row.responsavel_comercial || null,
    contatoComercial: row.contato_comercial || null,
    sondagem: row.sondagem || null,
    projetoFundacoes: row.projeto_fundacoes || null,
    validadeDias: row.validade_dias ?? null,
    valorTotal: Number(row.valor_total) || 0,
    valorEntrada: row.valor_entrada != null ? Number(row.valor_entrada) : null,
    periodicidadeMedicao: row.periodicidade_medicao || null,
    prazoPagamentoDias: row.prazo_pagamento_dias ?? null,
    dataProposta: row.data_proposta || null,
    status: row.status,
    motivoRecusa: row.motivo_recusa || null,
    itens: Array.isArray(row.itens) ? row.itens : [],
    arquivoNome: row.arquivo_nome || null,
    ehLicitacao: Boolean(row.eh_licitacao),
    concorrentes: row.concorrentes || null,
    orgaoLicitante: row.orgao_licitante || null,
    numeroProcesso: row.numero_processo || null,
    dataAbertura: row.data_abertura || null,
    createdAt: row.created_at || new Date().toISOString(),
  });

  const fetchPropostas = async () => {
    if (!isSupabaseConfigured) { setPropostas([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('propostas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPropostas((data || []).map(mapRowToProposta));
    } catch {
      toast.error('Não foi possível carregar as propostas. Tente novamente.');
      setPropostas([]);
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

  useEffect(() => { fetchPropostas(); fetchObras(); }, []);

  const since = useMemo(() => periodoSince(periodo), [periodo]);

  const filteredForCards = useMemo(() => propostas.filter((p) => {
    if (since) {
      const ref = p.dataProposta ? new Date(p.dataProposta) : new Date(p.createdAt);
      if (ref < since) return false;
    }
    if (cidadeFiltro.trim() && !(p.cidade || '').toLowerCase().includes(cidadeFiltro.trim().toLowerCase())) return false;
    return true;
  }), [propostas, since, cidadeFiltro]);

  const filteredForList = useMemo(() => filteredForCards.filter((p) => {
    if (statusFiltro !== 'todas' && p.status !== statusFiltro) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (p.numero || '').toLowerCase().includes(term)
      || p.clienteNome.toLowerCase().includes(term)
      || (p.obraNome || '').toLowerCase().includes(term);
  }), [filteredForCards, statusFiltro, searchTerm]);

  const cardsPorModalidade = useMemo(() => MODALIDADES.map((mod) => {
    const items = filteredForCards.filter((p) => p.modalidade === mod);
    const valorEnviado = items.reduce((sum, p) => sum + p.valorTotal, 0);
    const aceitas = items.filter((p) => p.status === 'aceita');
    const recusadas = items.filter((p) => p.status === 'recusada');
    const decididas = aceitas.length + recusadas.length;
    const taxaConversao = decididas > 0 ? (aceitas.length / decididas) * 100 : null;
    const valorAceito = aceitas.reduce((sum, p) => sum + p.valorTotal, 0);
    return { modalidade: mod, total: items.length, valorEnviado, valorAceito, taxaConversao, aceitas: aceitas.length };
  }), [filteredForCards]);

  const statusBreakdown = useMemo(() => {
    const total = filteredForCards.length;
    return (['enviada', 'aceita', 'recusada'] as Status[]).map((s) => ({
      status: s,
      count: filteredForCards.filter((p) => p.status === s).length,
      pct: total > 0 ? (filteredForCards.filter((p) => p.status === s).length / total) * 100 : 0,
    }));
  }, [filteredForCards]);

  // Rollup geografico regiao -> estado -> cidade, do mais alto nivel pro
  // mais granular — mesma logica que um analista usaria pra achar onde
  // o pipeline comercial concentra e onde converte melhor.
  const porRegiao = useMemo(() => {
    const map = new Map<string, { valor: number; count: number; aceitas: number; decididas: number }>();
    filteredForCards.forEach((p) => {
      const regiao = regiaoPorUf(p.uf);
      const entry = map.get(regiao) || { valor: 0, count: 0, aceitas: 0, decididas: 0 };
      entry.valor += p.valorTotal;
      entry.count += 1;
      if (p.status === 'aceita') { entry.aceitas += 1; entry.decididas += 1; }
      if (p.status === 'recusada') entry.decididas += 1;
      map.set(regiao, entry);
    });
    return Array.from(map.entries())
      .map(([regiao, v]) => ({ regiao, ...v, taxaConversao: v.decididas > 0 ? (v.aceitas / v.decididas) * 100 : null }))
      .sort((a, b) => b.valor - a.valor);
  }, [filteredForCards]);

  const porEstado = useMemo(() => {
    const map = new Map<string, { valor: number; count: number }>();
    filteredForCards.forEach((p) => {
      const uf = p.uf || 'Sem estado';
      const entry = map.get(uf) || { valor: 0, count: 0 };
      entry.valor += p.valorTotal;
      entry.count += 1;
      map.set(uf, entry);
    });
    return Array.from(map.entries()).map(([uf, v]) => ({ uf, ...v })).sort((a, b) => b.valor - a.valor);
  }, [filteredForCards]);

  const porCidade = useMemo(() => {
    const map = new Map<string, { valor: number; count: number }>();
    filteredForCards.forEach((p) => {
      const key = p.cidade ? `${p.cidade}${p.uf ? `/${p.uf}` : ''}` : 'Sem cidade';
      const entry = map.get(key) || { valor: 0, count: 0 };
      entry.valor += p.valorTotal;
      entry.count += 1;
      map.set(key, entry);
    });
    return Array.from(map.entries()).map(([cidade, v]) => ({ cidade, ...v })).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [filteredForCards]);

  const porMotivoRecusa = useMemo(() => {
    const recusadas = filteredForCards.filter((p) => p.status === 'recusada');
    const map = new Map<string, { count: number; valor: number }>();
    recusadas.forEach((p) => {
      const key = p.motivoRecusa?.trim() || 'Sem motivo registrado';
      const entry = map.get(key) || { count: 0, valor: 0 };
      entry.count += 1;
      entry.valor += p.valorTotal;
      map.set(key, entry);
    });
    return Array.from(map.entries()).map(([motivo, v]) => ({ motivo, ...v })).sort((a, b) => b.count - a.count);
  }, [filteredForCards]);

  const resetForm = () => { setForm(emptyForm); setItens([]); };

  const handleOpenNew = () => { setEditingProposta(null); resetForm(); setShowModal(true); };

  const handleOpenEdit = (p: Proposta) => {
    setEditingProposta(p);
    setForm({
      numero: p.numero || '',
      revisao: p.revisao || '',
      modalidade: p.modalidade,
      clienteNome: p.clienteNome,
      clienteCnpj: p.clienteCnpj || '',
      obraId: p.obraId,
      obraNome: p.obraNome || '',
      enderecoObra: p.enderecoObra || '',
      cidade: p.cidade || '',
      uf: p.uf || '',
      contatoNome: p.contatoNome || '',
      contatoTelefone: p.contatoTelefone || '',
      responsavelComercial: p.responsavelComercial || '',
      contatoComercial: p.contatoComercial || '',
      sondagem: p.sondagem || '',
      projetoFundacoes: p.projetoFundacoes || '',
      validadeDias: p.validadeDias != null ? String(p.validadeDias) : '',
      valorTotal: String(p.valorTotal),
      valorEntrada: p.valorEntrada != null ? String(p.valorEntrada) : '',
      periodicidadeMedicao: p.periodicidadeMedicao || '',
      prazoPagamentoDias: p.prazoPagamentoDias != null ? String(p.prazoPagamentoDias) : '',
      dataProposta: p.dataProposta || '',
      status: p.status,
      motivoRecusa: p.motivoRecusa || '',
      arquivoNome: p.arquivoNome || '',
      ehLicitacao: p.ehLicitacao,
      concorrentes: p.concorrentes || '',
      orgaoLicitante: p.orgaoLicitante || '',
      numeroProcesso: p.numeroProcesso || '',
      dataAbertura: p.dataAbertura || '',
    });
    setItens(p.itens);
    setShowModal(true);
  };

  const handleCloseModal = () => { setShowModal(false); setEditingProposta(null); resetForm(); };

  const handleUploadPdf = async (file: File) => {
    setParsing(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const response = await fetch('/.netlify/functions/parse-proposta-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64, fileName: file.name }),
      });
      const extracted = await response.json();
      if (!response.ok) throw new Error(extracted.error || 'Falha ao ler o PDF.');

      setEditingProposta(null);
      setForm({
        ...emptyForm,
        numero: extracted.numero || '',
        revisao: extracted.revisao || '',
        modalidade: (extracted.modalidade as Modalidade) || 'PIT',
        clienteNome: extracted.clienteNome || '',
        clienteCnpj: extracted.clienteCnpj || '',
        obraNome: extracted.obraNome || '',
        enderecoObra: extracted.enderecoObra || '',
        cidade: extracted.cidade || '',
        uf: extracted.uf || '',
        contatoNome: extracted.contatoNome || '',
        contatoTelefone: extracted.contatoTelefone || '',
        responsavelComercial: extracted.responsavelComercial || '',
        contatoComercial: extracted.contatoComercial || '',
        sondagem: extracted.sondagem || '',
        projetoFundacoes: extracted.projetoFundacoes || '',
        validadeDias: extracted.validadeDias != null ? String(extracted.validadeDias) : '',
        valorTotal: extracted.valorTotal != null ? String(extracted.valorTotal) : '',
        valorEntrada: extracted.valorEntrada != null ? String(extracted.valorEntrada) : '',
        periodicidadeMedicao: extracted.periodicidadeMedicao || '',
        prazoPagamentoDias: extracted.prazoPagamentoDias != null ? String(extracted.prazoPagamentoDias) : '',
        dataProposta: extracted.dataProposta || '',
        arquivoNome: file.name,
      });
      setItens(Array.isArray(extracted.itens) ? extracted.itens : []);
      setShowModal(true);
      toast.success('PDF lido! Confira os dados antes de salvar.');
    } catch (err: any) {
      toast.error(err.message || 'Não foi possível ler este PDF.');
    } finally {
      setParsing(false);
    }
  };

  const handleItemChange = (index: number, field: keyof PropostaItem, value: string) => {
    setItens((prev) => prev.map((item, i) => {
      if (i !== index) return item;
      if (field === 'quantidade' || field === 'valorUnitario' || field === 'valorEstimado') {
        return { ...item, [field]: value === '' ? null : Number(value) };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleAddItem = () => setItens((prev) => [...prev, { descricao: '', unidade: '', quantidade: null, valorUnitario: null, valorEstimado: null }]);
  const handleRemoveItem = (index: number) => setItens((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clienteNome.trim() || !form.valorTotal) {
      toast.error('Preencha ao menos o cliente e o valor total da proposta.');
      return;
    }

    const payload = {
      numero: form.numero.trim() || null,
      revisao: form.revisao.trim() || null,
      modalidade: form.modalidade,
      cliente_nome: form.clienteNome.trim(),
      cliente_cnpj: form.clienteCnpj.trim() || null,
      obra_id: form.obraId || null,
      obra_nome: form.obraNome.trim() || null,
      endereco_obra: form.enderecoObra.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim() || null,
      contato_nome: form.contatoNome.trim() || null,
      contato_telefone: form.contatoTelefone.trim() || null,
      responsavel_comercial: form.responsavelComercial.trim() || null,
      contato_comercial: form.contatoComercial.trim() || null,
      sondagem: form.sondagem.trim() || null,
      projeto_fundacoes: form.projetoFundacoes.trim() || null,
      validade_dias: form.validadeDias ? Number(form.validadeDias) : null,
      valor_total: Number(form.valorTotal),
      valor_entrada: form.valorEntrada ? Number(form.valorEntrada) : null,
      periodicidade_medicao: form.periodicidadeMedicao.trim() || null,
      prazo_pagamento_dias: form.prazoPagamentoDias ? Number(form.prazoPagamentoDias) : null,
      data_proposta: form.dataProposta || null,
      status: form.status,
      motivo_recusa: form.status === 'recusada' ? (form.motivoRecusa.trim() || null) : null,
      itens,
      arquivo_nome: form.arquivoNome.trim() || null,
      eh_licitacao: form.ehLicitacao,
      concorrentes: form.concorrentes.trim() || null,
      orgao_licitante: form.ehLicitacao ? (form.orgaoLicitante.trim() || null) : null,
      numero_processo: form.ehLicitacao ? (form.numeroProcesso.trim() || null) : null,
      data_abertura: form.ehLicitacao ? (form.dataAbertura || null) : null,
    };

    try {
      setLoading(true);
      if (editingProposta) {
        const { error } = await supabase.from('propostas').update(payload).eq('id', editingProposta.id);
        if (error) throw error;
        toast.success('Proposta atualizada com sucesso!');
      } else {
        const { error } = await supabase.from('propostas').insert(payload);
        if (error) throw error;
        toast.success('Proposta cadastrada com sucesso!');
      }
      handleCloseModal();
      fetchPropostas();
    } catch {
      toast.error('Não foi possível salvar a proposta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, label: string) => setConfirmDialog({ isOpen: true, id, label });

  const handleDelete = async () => {
    const { id } = confirmDialog;
    if (!id) return;
    try {
      const { error } = await supabase.from('propostas').delete().eq('id', id);
      if (error) throw error;
      setPropostas((prev) => prev.filter((p) => p.id !== id));
      toast.success('Proposta excluída.');
    } catch {
      toast.error('Não foi possível excluir a proposta.');
    } finally {
      setConfirmDialog({ isOpen: false, id: null, label: null });
    }
  };

  return (
    <div>
      <PageHeader
        title="Propostas"
        description="Importe o PDF da proposta pra autopreencher, acompanhe valores e conversão por modalidade."
        eyebrow="Comercial"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="btn-primary flex w-full cursor-pointer items-center justify-center gap-2 sm:w-auto">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              <span>{parsing ? 'Lendo PDF...' : 'Importar PDF'}</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={parsing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadPdf(file);
                  e.target.value = '';
                }}
              />
            </label>
            <button onClick={handleOpenNew} className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 sm:w-auto">
              <Plus className="h-4 w-4" />
              <span>Cadastro manual</span>
            </button>
          </div>
        }
      />

      <FilterBar>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número, cliente ou obra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <input
            type="text"
            placeholder="Cidade..."
            value={cidadeFiltro}
            onChange={(e) => setCidadeFiltro(e.target.value)}
            className="w-36 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as Status | 'todas')}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
          >
            <option value="todas">Todos os status</option>
            <option value="enviada">Enviada</option>
            <option value="aceita">Aceita</option>
            <option value="recusada">Recusada</option>
          </select>
          <button
            type="button"
            onClick={fetchPropostas}
            disabled={loading}
            className="text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <PeriodoFilterButtons value={periodo} onChange={setPeriodo} />
        </div>
      </FilterBar>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {cardsPorModalidade.map((card) => (
          <Surface key={card.modalidade}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{card.modalidade}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{card.total} propostas</span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{currency(card.valorEnviado)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">enviado</p>
              <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                <TrendingUp className="h-3 w-3" />
                <span>{card.taxaConversao != null ? `${card.taxaConversao.toFixed(0)}% conversão` : 'sem decisão ainda'}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{currency(card.valorAceito)} fechado ({card.aceitas})</p>
            </div>
          </Surface>
        ))}
      </div>

      {cardsPorModalidade.some((c) => c.total > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Surface>
            <div className="p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Valor enviado por modalidade</p>
              <div className="space-y-2">
                {cardsPorModalidade.filter((c) => c.total > 0).map((c) => {
                  const max = Math.max(...cardsPorModalidade.map((x) => x.valorEnviado), 1);
                  const pct = (c.valorEnviado / max) * 100;
                  return (
                    <div key={c.modalidade} className="flex items-center gap-3">
                      <span className="w-14 text-xs font-semibold text-gray-700 dark:text-gray-200">{c.modalidade}</span>
                      <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className={`h-full ${modalidadeBarColor[c.modalidade]}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-24 text-right text-xs text-gray-600 dark:text-gray-300">{currency(c.valorEnviado)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Surface>

          <Surface>
            <div className="p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Propostas por status</p>
              <DonutChart
                data={statusBreakdown.map((s) => ({ label: statusLabels[s.status], value: s.count, hex: statusHex[s.status] }))}
              />
            </div>
          </Surface>
        </div>
      )}

      {porEstado.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Distribuição geográfica</p>
          <Surface className="mb-4">
            <div className="p-2">
              <PropostasMap data={porEstado} />
            </div>
          </Surface>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Surface>
              <div className="p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Por região</p>
                <div className="space-y-2">
                  {porRegiao.map((r) => {
                    const max = Math.max(...porRegiao.map((x) => x.valor), 1);
                    const pct = (r.valor / max) * 100;
                    return (
                      <div key={r.regiao}>
                        <div className="flex items-center gap-3">
                          <span className="w-24 text-xs font-semibold text-gray-700 dark:text-gray-200">{r.regiao}</span>
                          <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-24 text-right text-xs text-gray-600 dark:text-gray-300">{currency(r.valor)}</span>
                        </div>
                        {r.taxaConversao != null && (
                          <p className="ml-24 pl-3 text-[11px] text-gray-400">{r.taxaConversao.toFixed(0)}% conversão · {r.count} propostas</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Surface>

            <Surface>
              <div className="p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Por estado</p>
                <div className="space-y-2">
                  {porEstado.map((e) => {
                    const max = Math.max(...porEstado.map((x) => x.valor), 1);
                    const pct = (e.valor / max) * 100;
                    return (
                      <div key={e.uf} className="flex items-center gap-3">
                        <span className="w-12 text-xs font-semibold text-gray-700 dark:text-gray-200">{e.uf}</span>
                        <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-24 text-right text-xs text-gray-600 dark:text-gray-300">{currency(e.valor)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Surface>

            <Surface>
              <div className="p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">Top cidades</p>
                <div className="space-y-2">
                  {porCidade.map((c, idx) => (
                    <div key={c.cidade} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-200 truncate">{idx + 1}. {c.cidade}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{currency(c.valor)} ({c.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            </Surface>
          </div>
        </div>
      )}

      {porMotivoRecusa.length > 0 && (
        <Surface className="mb-6">
          <div className="p-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Motivos de recusa</p>
            <div className="space-y-2">
              {porMotivoRecusa.map((m) => {
                const max = Math.max(...porMotivoRecusa.map((x) => x.count), 1);
                const pct = (m.count / max) * 100;
                return (
                  <div key={m.motivo} className="flex items-center gap-3">
                    <span className="w-48 flex-shrink-0 text-xs text-gray-700 dark:text-gray-200 truncate" title={m.motivo}>{m.motivo}</span>
                    <div className="flex-1 h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full bg-red-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-32 text-right text-xs text-gray-600 dark:text-gray-300 flex-shrink-0">{m.count} ({currency(m.valor)})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Surface>
      )}

      <div className="space-y-3">
        {filteredForList.map((p) => (
          <Surface key={p.id}>
            <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">{p.numero || 'Sem número'}{p.revisao ? ` — ${p.revisao}` : ''}</span>
                  <StatusBadge variant="neutral">{p.modalidade}</StatusBadge>
                  <StatusBadge variant={statusVariants[p.status]}>{statusLabels[p.status]}</StatusBadge>
                  {p.ehLicitacao && <StatusBadge variant="warning">Licitação</StatusBadge>}
                  {p.concorrentes && <StatusBadge variant="info">Concorrência</StatusBadge>}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{p.clienteNome}{p.obraNome ? ` · ${p.obraNome}` : ''}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{[p.cidade, p.uf].filter(Boolean).join('/')} {p.dataProposta ? `· ${new Date(p.dataProposta + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">{currency(p.valorTotal)}</span>
                {p.status === 'enviada' && (
                  <>
                    <IconButton icon={CheckCircle2} label="Marcar como aceita" tone="primary" onClick={async () => {
                      await supabase.from('propostas').update({ status: 'aceita', motivo_recusa: null }).eq('id', p.id);
                      fetchPropostas();
                    }} />
                    <IconButton icon={XCircle} label="Marcar como recusada" tone="danger" onClick={() => handleOpenEdit({ ...p, status: 'recusada' })} />
                  </>
                )}
                <IconButton icon={Edit} label={`Editar proposta ${p.numero || ''}`} tone="neutral" onClick={() => handleOpenEdit(p)} />
                <IconButton icon={Trash2} label={`Excluir proposta ${p.numero || ''}`} tone="danger" onClick={() => handleDeleteClick(p.id, p.numero || p.clienteNome)} />
              </div>
            </div>
          </Surface>
        ))}
      </div>

      {filteredForList.length === 0 && propostas.length > 0 && (
        <EmptyState
          icon={Search}
          title="Nenhuma proposta com esse filtro"
          description="Existem propostas cadastradas, mas nenhuma bate com a busca, cidade, status ou período selecionados."
          actionLabel="Limpar filtros"
          onAction={() => { setSearchTerm(''); setCidadeFiltro(''); setStatusFiltro('todas'); setPeriodo('tudo'); }}
        />
      )}

      {propostas.length === 0 && (
        <EmptyState
          icon={FileUp}
          title="Nenhuma proposta encontrada"
          description="Importe o PDF padrão de proposta comercial pra autopreencher, ou cadastre manualmente."
          actionLabel="Cadastro manual"
          onAction={handleOpenNew}
        />
      )}

      <Modal open={showModal} onClose={handleCloseModal} title={editingProposta ? 'Editar proposta' : 'Nova proposta'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormInput label="Número" type="text" value={form.numero} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} />
            <FormInput label="Revisão" type="text" value={form.revisao} onChange={(e) => setForm((f) => ({ ...f, revisao: e.target.value }))} />
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Modalidade *</label>
              <select
                value={form.modalidade}
                onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value as Modalidade }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
              >
                {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput label="Cliente" type="text" value={form.clienteNome} onChange={(e) => setForm((f) => ({ ...f, clienteNome: e.target.value }))} required />
            <FormInput label="CNPJ" type="text" value={form.clienteCnpj} onChange={(e) => setForm((f) => ({ ...f, clienteCnpj: e.target.value }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Vincular à obra (opcional)</label>
            <ObraSelector
              obras={obras}
              value={form.obraId || ''}
              onChange={(obra) => setForm((f) => ({ ...f, obraId: obra?.id || '', obraNome: obra ? (f.obraNome || obra.name) : f.obraNome }))}
            />
          </div>

          <FormInput label="Nome da obra (texto livre)" type="text" value={form.obraNome} onChange={(e) => setForm((f) => ({ ...f, obraNome: e.target.value }))} />
          <FormInput label="Endereço da obra" type="text" value={form.enderecoObra} onChange={(e) => setForm((f) => ({ ...f, enderecoObra: e.target.value }))} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput label="Cidade" type="text" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            <FormInput label="UF" type="text" value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))} maxLength={2} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput label="Contato (A/C)" type="text" value={form.contatoNome} onChange={(e) => setForm((f) => ({ ...f, contatoNome: e.target.value }))} />
            <FormInput label="Telefone do contato" type="text" value={form.contatoTelefone} onChange={(e) => setForm((f) => ({ ...f, contatoTelefone: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput label="Responsável comercial" type="text" value={form.responsavelComercial} onChange={(e) => setForm((f) => ({ ...f, responsavelComercial: e.target.value }))} />
            <FormInput label="Contato comercial" type="text" value={form.contatoComercial} onChange={(e) => setForm((f) => ({ ...f, contatoComercial: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput label="Sondagem" type="text" value={form.sondagem} onChange={(e) => setForm((f) => ({ ...f, sondagem: e.target.value }))} />
            <FormInput label="Projeto de fundações" type="text" value={form.projetoFundacoes} onChange={(e) => setForm((f) => ({ ...f, projetoFundacoes: e.target.value }))} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200">Itens do orçamento</label>
              <button type="button" onClick={handleAddItem} className="text-xs text-green-700 dark:text-green-300 hover:underline">+ Adicionar linha</button>
            </div>
            <div className="space-y-2">
              {itens.length > 0 && (
                <div className="grid grid-cols-12 gap-1 px-0.5">
                  <span className="col-span-5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Descrição</span>
                  <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Unidade</span>
                  <span className="col-span-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Qtd.</span>
                  <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Valor unit.</span>
                  <span className="col-span-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Valor total</span>
                  <span className="col-span-1" />
                </div>
              )}
              {itens.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                  <input className="col-span-5 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100" placeholder="Descrição" value={item.descricao} onChange={(e) => handleItemChange(idx, 'descricao', e.target.value)} />
                  <input className="col-span-2 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100" placeholder="Ex: vb, dia, und." value={item.unidade || ''} onChange={(e) => handleItemChange(idx, 'unidade', e.target.value)} />
                  <input className="col-span-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100" placeholder="0" type="number" value={item.quantidade ?? ''} onChange={(e) => handleItemChange(idx, 'quantidade', e.target.value)} />
                  <input className="col-span-2 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100" placeholder="R$ por unidade" type="number" value={item.valorUnitario ?? ''} onChange={(e) => handleItemChange(idx, 'valorUnitario', e.target.value)} />
                  <input className="col-span-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100" placeholder="R$" type="number" value={item.valorEstimado ?? ''} onChange={(e) => handleItemChange(idx, 'valorEstimado', e.target.value)} />
                  <button type="button" onClick={() => handleRemoveItem(idx)} className="col-span-1 flex justify-center text-gray-400 hover:text-red-600" aria-label="Remover item">
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {itens.length === 0 && <p className="text-xs text-gray-400">Nenhum item lançado.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormInput label="Valor total (R$)" type="number" value={form.valorTotal} onChange={(e) => setForm((f) => ({ ...f, valorTotal: e.target.value }))} required />
            <FormInput label="Valor de entrada (R$)" type="number" value={form.valorEntrada} onChange={(e) => setForm((f) => ({ ...f, valorEntrada: e.target.value }))} />
            <FormInput label="Validade (dias)" type="number" value={form.validadeDias} onChange={(e) => setForm((f) => ({ ...f, validadeDias: e.target.value }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormInput label="Periodicidade de medição" type="text" value={form.periodicidadeMedicao} onChange={(e) => setForm((f) => ({ ...f, periodicidadeMedicao: e.target.value }))} placeholder="semanais" />
            <FormInput label="Prazo de pagamento (dias)" type="number" value={form.prazoPagamentoDias} onChange={(e) => setForm((f) => ({ ...f, prazoPagamentoDias: e.target.value }))} />
            <FormInput label="Data da proposta" type="date" value={form.dataProposta} onChange={(e) => setForm((f) => ({ ...f, dataProposta: e.target.value }))} />
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-3">
            <FormInput label="Concorrentes nessa obra (opcional)" type="text" value={form.concorrentes} onChange={(e) => setForm((f) => ({ ...f, concorrentes: e.target.value }))} placeholder="Ex: Empresa X, Empresa Y" />
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={form.ehLicitacao} onChange={(e) => setForm((f) => ({ ...f, ehLicitacao: e.target.checked }))} className="rounded border-gray-300 dark:border-gray-700" />
              É licitação
            </label>
            {form.ehLicitacao && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormInput label="Órgão licitante" type="text" value={form.orgaoLicitante} onChange={(e) => setForm((f) => ({ ...f, orgaoLicitante: e.target.value }))} />
                <FormInput label="Nº do processo" type="text" value={form.numeroProcesso} onChange={(e) => setForm((f) => ({ ...f, numeroProcesso: e.target.value }))} />
                <FormInput label="Data de abertura" type="date" value={form.dataAbertura} onChange={(e) => setForm((f) => ({ ...f, dataAbertura: e.target.value }))} />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="enviada">Enviada</option>
              <option value="aceita">Aceita</option>
              <option value="recusada">Recusada</option>
            </select>
          </div>

          {form.status === 'recusada' && (
            <FormTextarea label="Motivo da recusa" value={form.motivoRecusa} onChange={(e) => setForm((f) => ({ ...f, motivoRecusa: e.target.value }))} rows={2} />
          )}

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-2">
            <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
            <button type="submit" disabled={loading} className="w-full sm:w-auto px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">{loading ? 'Salvando...' : editingProposta ? 'Atualizar' : 'Salvar proposta'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, id: null, label: null })}
        onConfirm={handleDelete}
        title="Excluir Proposta"
        message={`Tem certeza que deseja excluir a proposta "${confirmDialog.label}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};
