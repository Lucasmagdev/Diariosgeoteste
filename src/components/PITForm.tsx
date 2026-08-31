import React, { useState } from 'react';
import { Edit, Check, Layers, Trash2, X, CheckSquare, Square, RefreshCw, Download } from 'lucide-react';
import { downloadPitPiles, fetchPitEnsaios, PitRemoteEnsaio } from '../lib/pitSync';

const parseBR = (value: string): number | null => {
  const t = (value || '').trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const formatBR = (n: number): string => n.toFixed(2).replace('.', ',');

// Comprimento util = profundidade menos o trecho arrasado no topo da estaca.
// Calculado sozinho pra evitar erro de conta manual; some se faltar um dos dois.
const calcComprimentoUtilM = (profundidadeM: string, arrasamentoM: string): string => {
  const p = parseBR(profundidadeM);
  const a = parseBR(arrasamentoM);
  if (p === null || a === null) return '';
  return formatBR(p - a);
};

const calcProfundidadeM = (comprimentoUtilM: string, arrasamentoM: string): string => {
  const c = parseBR(comprimentoUtilM);
  const a = parseBR(arrasamentoM);
  if (c === null || a === null) return '';
  return formatBR(c + a);
};

// Gera nomes sequenciais pra estaca em massa. Se o nome inicial termina em
// numero ("E-01"), incrementa preservando os zeros a esquerda (E-02, E-03...).
// Sem numero no final, so acrescenta "-2", "-3" etc.
const generateBulkNomes = (base: string, qty: number): string[] => {
  const trimmed = (base || '').trim() || 'E';
  const m = trimmed.match(/^(.*?)(\d+)$/);
  if (m) {
    const prefix = m[1];
    const numStr = m[2];
    const start = parseInt(numStr, 10);
    const width = numStr.length;
    return Array.from({ length: qty }, (_, i) => `${prefix}${String(start + i).padStart(width, '0')}`);
  }
  if (qty === 1) return [trimmed];
  return Array.from({ length: qty }, (_, i) => (i === 0 ? trimmed : `${trimmed}-${i + 1}`));
};

export interface PITPile {
  ensaioOrigemId?: string;
  comprimentoUtilImportado?: boolean;
  estacaNome: string;
  estacaTipo: string;
  diametroCm: string;
  profundidadeM: string;
  arrasamentoM: string;
  comprimentoUtilM: string;
  confirmado?: boolean;
  isExpanded?: boolean;
}

export interface PITFormData {
  equipamento: string;
  equipamentoId: string;
  piles: PITPile[];
  ocorrencias: string;
  totalEstacas: string;
}

interface PITFormProps {
  value: PITFormData;
  onChange: (next: PITFormData) => void;
  equipamentosDisponiveis: { id: string; nome: string }[];
  diaryDate?: string;
}

interface PitSyncGroup {
  pastaOrigem: string;
  ensaios: PitRemoteEnsaio[];
}

export const PITForm: React.FC<PITFormProps> = ({ value, onChange, equipamentosDisponiveis, diaryDate = '' }) => {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkQtd, setBulkQtd] = useState('5');
  const [bulkNomeInicial, setBulkNomeInicial] = useState('E-01');
  const [bulkTipo, setBulkTipo] = useState('');
  const [bulkDiametro, setBulkDiametro] = useState('');
  const [bulkProfundidade, setBulkProfundidade] = useState('');
  const [bulkArrasamento, setBulkArrasamento] = useState('');

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncImporting, setSyncImporting] = useState('');
  const [syncGroups, setSyncGroups] = useState<PitSyncGroup[]>([]);
  const [syncError, setSyncError] = useState('');
  const [syncMessage, setSyncMessage] = useState('');

  const setField = (fn: (draft: PITFormData) => void) => {
    // ✅ OTIMIZAÇÃO: structuredClone() é nativo e muito mais rápido que JSON.parse(JSON.stringify())
    const next: PITFormData = structuredClone(value);
    fn(next);
    onChange(next);
  };

  const setEquipamento = (equip: { id: string; nome: string }) => {
    setField((d) => { d.equipamento = equip.nome; d.equipamentoId = equip.id; });
  };

  const loadSyncedEnsaios = async () => {
    setSyncError('');
    setSyncMessage('');
    setSyncGroups([]);
    if (!diaryDate) {
      setSyncError('Preencha a data do diário antes de sincronizar os ensaios.');
      return;
    }

    setSyncLoading(true);
    try {
      const ensaios = await fetchPitEnsaios(diaryDate);
      const grouped = new Map<string, PitRemoteEnsaio[]>();
      ensaios.forEach((ensaio) => {
        const folder = ensaio.pastaOrigem?.trim() || 'Sem pasta informada';
        grouped.set(folder, [...(grouped.get(folder) || []), ensaio]);
      });
      setSyncGroups(Array.from(grouped, ([pastaOrigem, groupedEnsaios]) => ({ pastaOrigem, ensaios: groupedEnsaios })));
      if (ensaios.length === 0) setSyncMessage('Nenhum ensaio enviado pelo PIT foi encontrado nessa data.');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Não foi possível sincronizar os ensaios.');
    } finally {
      setSyncLoading(false);
    }
  };

  const importSyncGroup = async (group: PitSyncGroup) => {
    setSyncError('');
    setSyncMessage('');
    setSyncImporting(group.pastaOrigem);
    try {
      const { piles, failed } = await downloadPitPiles(group.ensaios);
      let importedCount = 0;
      let duplicateCount = 0;

      setField((d) => {
        const currentPiles = d.piles.filter((pile) =>
          pile.estacaNome.trim() || pile.estacaTipo.trim() || pile.diametroCm.trim() ||
          pile.profundidadeM.trim() || pile.arrasamentoM.trim() || pile.comprimentoUtilM.trim()
        );
        const existingIds = new Set(currentPiles.map((pile) => pile.ensaioOrigemId).filter(Boolean));
        const existingNames = new Set(currentPiles.map((pile) => pile.estacaNome.trim().toLocaleLowerCase('pt-BR')).filter(Boolean));
        const imported = piles.filter((pile) => {
          const normalizedName = pile.estacaNome.trim().toLocaleLowerCase('pt-BR');
          if (existingIds.has(pile.ensaioOrigemId) || existingNames.has(normalizedName)) {
            duplicateCount += 1;
            return false;
          }
          existingIds.add(pile.ensaioOrigemId);
          existingNames.add(normalizedName);
          return true;
        });
        importedCount = imported.length;
        d.piles = [...imported, ...currentPiles];
        d.totalEstacas = String(d.piles.length);
      });

      const details = [
        importedCount > 0 ? `${importedCount} ensaio${importedCount === 1 ? '' : 's'} importado${importedCount === 1 ? '' : 's'}` : 'Nenhum ensaio novo importado',
        duplicateCount > 0 ? `${duplicateCount} já existente${duplicateCount === 1 ? '' : 's'}` : '',
        failed > 0 ? `${failed} arquivo${failed === 1 ? '' : 's'} não pôde${failed === 1 ? '' : 'ram'} ser lido${failed === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      setSyncMessage(`${details.join(' • ')}. Confira os dados antes de confirmar.`);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Não foi possível importar os arquivos do PIT.');
    } finally {
      setSyncImporting('');
    }
  };

  const addPile = () => {
    setField((d) => {
      d.piles.unshift({
        estacaNome: '',
        estacaTipo: '',
        diametroCm: '',
        profundidadeM: '',
        arrasamentoM: '',
        comprimentoUtilM: '',
        confirmado: false,
        isExpanded: true
      });
    });
  };

  const addBulkPiles = () => {
    const qty = Math.max(1, Math.min(200, parseInt(bulkQtd, 10) || 0));
    if (!qty) return;
    const nomes = generateBulkNomes(bulkNomeInicial, qty);
    const comprimentoUtilM = calcComprimentoUtilM(bulkProfundidade, bulkArrasamento);
    setField((d) => {
      const novas: PITPile[] = nomes.map((nome) => ({
        estacaNome: nome,
        estacaTipo: bulkTipo,
        diametroCm: bulkDiametro,
        profundidadeM: bulkProfundidade,
        arrasamentoM: bulkArrasamento,
        comprimentoUtilM,
        confirmado: true,
        isExpanded: false
      }));
      d.piles = [...novas, ...d.piles];
    });
    setBulkOpen(false);
  };

  const confirmPile = (index: number) => {
    setField((d) => {
      const pile = d.piles[index];
      const hasData = pile.estacaNome.trim() ||
                     pile.estacaTipo.trim() ||
                     pile.diametroCm.trim() ||
                     pile.profundidadeM.trim() ||
                     pile.arrasamentoM.trim() ||
                     pile.comprimentoUtilM.trim();

      if (hasData) {
        pile.confirmado = true;
        pile.isExpanded = false;
      }
    });
  };

  const toggleExpandPile = (index: number) => {
    setField((d) => {
      d.piles[index].isExpanded = !d.piles[index].isExpanded;
    });
  };

  const isPileEmpty = (pile: PITPile) => {
    return !pile.estacaNome.trim() &&
           !pile.estacaTipo.trim() &&
           !pile.diametroCm.trim() &&
           !pile.profundidadeM.trim() &&
           !pile.arrasamentoM.trim() &&
           !pile.comprimentoUtilM.trim();
  };

  const removePile = (index: number) => {
    setField((d) => {
      d.piles.splice(index, 1);
      if (d.piles.length === 0) {
        d.piles.push({ estacaNome: '', estacaTipo: '', diametroCm: '', profundidadeM: '', arrasamentoM: '', comprimentoUtilM: '' });
      }
    });
  };

  const updatePile = (index: number, fn: (p: PITPile) => void) => {
    setField((d) => { fn(d.piles[index]); });
  };

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelected(new Set());
  };

  const toggleSelected = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(value.piles.map((_, i) => i)));
  const clearSelected = () => setSelected(new Set());

  const removeSelected = () => {
    setField((d) => {
      d.piles = d.piles.filter((_, i) => !selected.has(i));
      if (d.piles.length === 0) {
        d.piles.push({ estacaNome: '', estacaTipo: '', diametroCm: '', profundidadeM: '', arrasamentoM: '', comprimentoUtilM: '' });
      }
    });
    setSelected(new Set());
    setSelectMode(false);
  };

  const divider = <div className="my-4 sm:my-6 border-t border-gray-200 dark:border-gray-800" />;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="p-4 sm:p-5 md:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Formulário PIT</h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Preencha os campos específicos de PIT</p>
      </div>

      <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
        {/* Equipamento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Equipamento</label>
          {equipamentosDisponiveis.length === 0 ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">Nenhum equipamento PIT cadastrado. Peça pro admin cadastrar em "Equipamentos".</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {equipamentosDisponiveis.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setEquipamento(opt)}
                  className={`${value.equipamentoId === opt.id ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700'} px-3 py-2 rounded-lg font-medium hover:scale-105 transition-all`}
                >
                  {opt.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        {divider}

        {/* Serviços executados - Múltiplas estacas */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Serviços executados</h3>
            <div className="flex flex-wrap items-center gap-2">
              {selectMode ? (
                <>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{selected.size} selecionada{selected.size === 1 ? '' : 's'}</span>
                  <button type="button" onClick={selectAll} className="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700">
                    Selecionar todas
                  </button>
                  {selected.size > 0 && (
                    <button type="button" onClick={clearSelected} className="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700">
                      Limpar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={removeSelected}
                    disabled={selected.size === 0}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover selecionadas
                  </button>
                  <button type="button" onClick={toggleSelectMode} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg" title="Cancelar seleção">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={loadSyncedEnsaios}
                    disabled={syncLoading || Boolean(syncImporting)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                    {syncLoading ? 'Buscando...' : 'Sincronizar ensaios'}
                  </button>
                  <button
                    type="button"
                    onClick={toggleSelectMode}
                    className="px-3 py-2 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Selecionar / remover em massa
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkOpen((v) => !v)}
                    className="px-3 py-2 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1"
                  >
                    <Layers className="w-3.5 h-3.5" /> Adicionar em massa
                  </button>
                  <button
                    type="button"
                    onClick={addPile}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    Adicionar estaca
                  </button>
                </>
              )}
            </div>
          </div>

          {syncError && (
            <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {syncError}
            </div>
          )}

          {syncMessage && (
            <div className="mb-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-sm text-green-700 dark:text-green-300">
              {syncMessage}
            </div>
          )}

          {syncGroups.length > 0 && (
            <div className="mb-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10 p-3 sm:p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Ensaios encontrados em {diaryDate.split('-').reverse().join('/')}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Escolha somente a pasta desta obra. Os valores importados continuam editáveis e precisam ser conferidos.</p>
              <div className="mt-3 space-y-2">
                {syncGroups.map((group) => (
                  <div key={group.pastaOrigem} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-950 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{group.pastaOrigem}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{group.ensaios.length} ensaio{group.ensaios.length === 1 ? '' : 's'}: {group.ensaios.map((ensaio) => ensaio.nomeOriginal).join(', ')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => importSyncGroup(group)}
                      disabled={Boolean(syncImporting)}
                      className="flex-shrink-0 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                    >
                      {syncImporting === group.pastaOrigem
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                      {syncImporting === group.pastaOrigem ? 'Importando...' : `Importar ${group.ensaios.length}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bulkOpen && !selectMode && (
            <div className="mb-4 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4 bg-green-50/50 dark:bg-green-900/10">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">Adicionar várias estacas de uma vez</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Útil quando as estacas têm o mesmo tipo, diâmetro, profundidade e arrasamento — só o nome muda.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Quantidade</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bulkQtd}
                    onChange={(e) => setBulkQtd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="5"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Nome inicial</label>
                  <input
                    type="text"
                    value={bulkNomeInicial}
                    onChange={(e) => setBulkNomeInicial(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="Ex.: E-01"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Tipo da estaca</label>
                  <input
                    type="text"
                    value={bulkTipo}
                    onChange={(e) => setBulkTipo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="Ex.: Pré-moldada"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Diâmetro (cm)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bulkDiametro}
                    onChange={(e) => setBulkDiametro(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="Ex.: 50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Profundidade (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bulkProfundidade}
                    onChange={(e) => setBulkProfundidade(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="Ex.: 12,00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">Arrasamento (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bulkArrasamento}
                    onChange={(e) => setBulkArrasamento(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="Ex.: 0,30"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addBulkPiles}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Adicionar estacas
                </button>
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="px-3 py-2 text-gray-600 dark:text-gray-300 text-sm font-medium hover:text-gray-800"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {value.piles.map((pile, index) => {
            const isEmpty = isPileEmpty(pile);
            const isConfirmed = pile.confirmado === true;
            const isExpanded = (pile.isExpanded !== false || isEmpty) && !selectMode;
            const isChecked = selected.has(index);

            // Modo seleção: linha compacta com checkbox, sem expandir pra edição.
            if (selectMode) {
              return (
                <div
                  key={index}
                  onClick={() => toggleSelected(index)}
                  className={`mb-2 border rounded-lg p-3 flex items-center gap-3 cursor-pointer transition-colors ${isChecked ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'}`}
                >
                  {isChecked ? <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" /> : <Square className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {pile.estacaNome?.trim() || 'Estaca sem nome'}
                    </span>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {[
                        pile.estacaTipo && `Tipo: ${pile.estacaTipo}`,
                        pile.diametroCm && `Ø: ${pile.diametroCm}cm`,
                        pile.profundidadeM && `Prof: ${pile.profundidadeM}m`,
                      ].filter(Boolean).join(' • ')}
                    </div>
                  </div>
                </div>
              );
            }

            // Estaca compilada (confirmada e não expandida)
            if (isConfirmed && !isExpanded) {
              return (
                <div key={index} className="mb-3 border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {pile.estacaNome?.trim() || 'Estaca sem nome'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {[
                          pile.estacaTipo && `Tipo: ${pile.estacaTipo}`,
                          pile.diametroCm && `Ø: ${pile.diametroCm}cm`,
                          pile.profundidadeM && `Prof: ${pile.profundidadeM}m`,
                          pile.comprimentoUtilM && `Comp: ${pile.comprimentoUtilM}m`
                        ].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpandPile(index)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Editar estaca"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePile(index)}
                        className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Estaca expandida (em edição)
            return (
              <div key={index} className="mb-4 sm:mb-6 border border-gray-200 dark:border-gray-800 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                    {pile.estacaNome?.trim() || 'Nova Estaca'}
                  </p>
                  <div className="flex items-center gap-2">
                    {!isEmpty && (
                      <button
                        type="button"
                        onClick={() => confirmPile(index)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Confirmar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removePile(index)}
                      className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium"
                    >
                      Remover
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Nome da estaca</label>
                  <input
                    type="text"
                    value={pile.estacaNome}
                    onChange={(e) => updatePile(index, (p) => { p.estacaNome = e.target.value; })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: E-01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tipo da estaca</label>
                  <input
                    type="text"
                    value={pile.estacaTipo}
                    onChange={(e) => updatePile(index, (p) => { p.estacaTipo = e.target.value; })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: Pré-moldada"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Diâmetro (cm)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pile.diametroCm}
                    onChange={(e) => updatePile(index, (p) => { p.diametroCm = e.target.value; })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Profundidade (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pile.profundidadeM}
                    onChange={(e) => updatePile(index, (p) => {
                      p.profundidadeM = e.target.value;
                      p.comprimentoUtilImportado = false;
                      p.comprimentoUtilM = calcComprimentoUtilM(p.profundidadeM, p.arrasamentoM);
                    })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 12,00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Arrasamento (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pile.arrasamentoM}
                    onChange={(e) => updatePile(index, (p) => {
                      p.arrasamentoM = e.target.value;
                      if (p.comprimentoUtilImportado || (!p.profundidadeM.trim() && p.comprimentoUtilM.trim())) {
                        p.profundidadeM = calcProfundidadeM(p.comprimentoUtilM, p.arrasamentoM);
                      } else {
                        p.comprimentoUtilM = calcComprimentoUtilM(p.profundidadeM, p.arrasamentoM);
                      }
                    })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 0,30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Comprimento útil (m)</label>
                  <input
                    type="text"
                    readOnly
                    value={pile.comprimentoUtilM}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                    placeholder="Importado do PIT ou calculado"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    {pile.comprimentoUtilImportado ? 'Importado do ensaio PIT' : 'Calculado automaticamente'}
                  </p>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {divider}

        {/* Ocorrências e Totais */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Ocorrências</label>
            <textarea
              rows={4}
              value={value.ocorrencias}
              onChange={(e) => setField((d) => { d.ocorrencias = e.target.value; })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
              placeholder="Descreva ocorrências relevantes do dia..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Número total de estacas produzidas</label>
            <input
              type="text"
              inputMode="numeric"
              value={value.totalEstacas}
              onChange={(e) => setField((d) => { d.totalEstacas = e.target.value; })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ex.: 12"
            />
          </div>
        </div>

        {divider}

        {/* Assinaturas são tratadas no formulário principal */}
        <p className="text-xs text-gray-500 dark:text-gray-400">Assinaturas serão preenchidas na seção padrão do formulário.</p>
      </div>
    </div>
  );
};
