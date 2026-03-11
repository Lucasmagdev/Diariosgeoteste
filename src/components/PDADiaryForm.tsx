import React, { useEffect } from 'react';
import { Edit, Check } from 'lucide-react';

export interface PDADiaryPile {
  nome: string;
  tipo: string; // texto/seleção
  diametroCm: string; // número em string
  profundidadeM: string; // número em string
  cargaTrabalhoTf: string; // número em string
  cargaEnsaioTf: string; // número em string
  confirmado?: boolean;
  isExpanded?: boolean;
}

export interface PDADiaryFormData {
  pdaComputadores: Array<'PDA 1' | 'PDA 2' | 'PDA 3' | 'PDA 4'>;
  piles: PDADiaryPile[];
  ocorrencias: string;
  abastecimento: {
    equipamentos: Array<'Hammer 1' | 'Hammer 2' | 'Torre' | 'Equipamento do Cliente'>;
    horimetroHoras: string;
    mobilizacao: {
      litrosTanque: string;
      litrosGalao: string;
    };
    finalDia: {
      litrosTanque: string;
      litrosGalao: string;
    };
    entrega: {
      chegouDiesel: 'Sim' | 'Não' | '';
      fornecidoPor: 'Cliente' | 'Geoteste' | '';
      quantidadeLitros: string;
      horarioChegada: string; // HH:MM
    };
  };
}

interface PDADiaryFormProps {
  value: PDADiaryFormData;
  onChange: (next: PDADiaryFormData) => void;
}

export const PDADiaryForm: React.FC<PDADiaryFormProps> = ({ value, onChange }) => {
  const setField = (fn: (draft: PDADiaryFormData) => void) => {
    // ✅ OTIMIZAÇÃO: structuredClone() é nativo e muito mais rápido que JSON.parse(JSON.stringify())
    const next: PDADiaryFormData = structuredClone(value);
    fn(next);
    onChange(next);
  };

  // Autosave rascunho local (sem depender de diário criado)
  useEffect(() => {
    try {
      localStorage.setItem('pda_diario_draft', JSON.stringify(value));
    } catch {}
  }, [value]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pda_diario_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Mescla somente uma vez no primeiro render
        if (value.piles.length === 1 && Object.values(value.piles[0]).every((v) => v === '')) {
          onChange(parsed);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addRow = () => {
    setField((d) => {
      d.piles.unshift({ nome: '', tipo: '', diametroCm: '', profundidadeM: '', cargaTrabalhoTf: '', cargaEnsaioTf: '', confirmado: false, isExpanded: true });
    });
  };

  const confirmRow = (index: number) => {
    setField((d) => {
      const row = d.piles[index];
      const hasData = row.nome.trim() || 
                     row.tipo.trim() || 
                     row.diametroCm.trim() || 
                     row.profundidadeM.trim() || 
                     row.cargaTrabalhoTf.trim() || 
                     row.cargaEnsaioTf.trim();
      
      if (hasData) {
        row.confirmado = true;
        row.isExpanded = false;
        
        // Move estaca confirmada para o final
        const confirmedRow = d.piles.splice(index, 1)[0];
        d.piles.push(confirmedRow);
      }
    });
  };

  const toggleExpandRow = (index: number) => {
    setField((d) => {
      d.piles[index].isExpanded = !d.piles[index].isExpanded;
    });
  };

  const isRowEmpty = (row: PDADiaryPile) => {
    return !row.nome.trim() && 
           !row.tipo.trim() && 
           !row.diametroCm.trim() && 
           !row.profundidadeM.trim() && 
           !row.cargaTrabalhoTf.trim() && 
           !row.cargaEnsaioTf.trim();
  };

  const removeRow = (index: number) => {
    setField((d) => {
      d.piles.splice(index, 1);
      if (d.piles.length === 0) {
        d.piles.push({ nome: '', tipo: '', diametroCm: '', profundidadeM: '', cargaTrabalhoTf: '', cargaEnsaioTf: '', confirmado: false });
      }
    });
  };

  const updateRow = (index: number, fn: (p: PDADiaryPile) => void) => {
    setField((d) => {
      fn(d.piles[index]);
    });
  };

  const toggleEquip = (opt: 'Hammer 1' | 'Hammer 2' | 'Torre' | 'Equipamento do Cliente') => {
    setField((d) => {
      const arr = d.abastecimento.equipamentos;
      const i = arr.indexOf(opt);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(opt);
    });
  };

  const divider = <div className="my-4 sm:my-6 border-t border-gray-200 dark:border-gray-800" />;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="p-4 sm:p-5 md:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Diário PDA</h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Registre as estacas executadas e abastecimentos do dia</p>
      </div>

      <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
        {/* Seleção de Equipamento PDA (computador) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Equipamento PDA</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {(['PDA 1','PDA 2','PDA 3','PDA 4'] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950">
                <input
                  type="checkbox"
                  checked={value.pdaComputadores?.includes(opt) || false}
                  onChange={() => setField((d) => {
                    d.pdaComputadores = d.pdaComputadores || [] as any;
                    const i = d.pdaComputadores.indexOf(opt);
                    if (i >= 0) d.pdaComputadores.splice(i, 1);
                    else d.pdaComputadores.push(opt);
                  })}
                  className="app-checkbox"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 1. Tabela de Estacas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Estacas do dia</h3>
            <button
              type="button"
              onClick={addRow}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Adicionar estaca
            </button>
          </div>
          {/* Tabela em md+ , Cards no mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Diâmetro (cm)</th>
                  <th className="py-2 px-3">Profundidade (m)</th>
                  <th className="py-2 px-3">Carga Trabalho (tf)</th>
                  <th className="py-2 px-3">Carga Ensaio (tf)</th>
                  <th className="py-2 pl-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {value.piles.map((row, idx) => {
                  const isEmpty = isRowEmpty(row);
                  const isConfirmed = row.confirmado === true;
                  const isExpanded = row.isExpanded !== false || isEmpty;
                  
                  // Estaca compilada (confirmada e não expandida) - mostrar como linha resumida
                  if (isConfirmed && !isExpanded) {
                    return (
                      <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <td colSpan={6} className="py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {row.nome || 'Estaca sem nome'}
                              </span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {[
                                  row.tipo && `Tipo: ${row.tipo}`,
                                  row.diametroCm && `Ø: ${row.diametroCm}cm`,
                                  row.profundidadeM && `Prof: ${row.profundidadeM}m`,
                                  row.cargaTrabalhoTf && `Carga: ${row.cargaTrabalhoTf}tf`
                                ].filter(Boolean).join(' • ')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleExpandRow(idx)}
                                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                title="Editar estaca"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRow(idx)}
                                className="text-red-600 hover:text-red-700 text-xs font-medium"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  
                  // Estaca expandida (em edição)
                  return (
                    <tr key={idx} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        value={row.nome}
                        onChange={(e) => updateRow(idx, (p) => { p.nome = e.target.value; })}
                        className="w-40 sm:w-44 md:w-48 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        placeholder="E-01"
                        disabled={isConfirmed && !isExpanded}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={row.tipo}
                        onChange={(e) => updateRow(idx, (p) => { p.tipo = e.target.value; })}
                        className="w-36 sm:w-40 md:w-44 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        placeholder="Pré-moldada"
                        disabled={isConfirmed && !isExpanded}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.diametroCm}
                        onChange={(e) => updateRow(idx, (p) => { p.diametroCm = e.target.value; })}
                        className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        placeholder="50"
                        disabled={isConfirmed && !isExpanded}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.profundidadeM}
                        onChange={(e) => updateRow(idx, (p) => { p.profundidadeM = e.target.value; })}
                        className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        placeholder="12.5"
                        disabled={isConfirmed && !isExpanded}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.cargaTrabalhoTf}
                        onChange={(e) => updateRow(idx, (p) => { p.cargaTrabalhoTf = e.target.value; })}
                        className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        placeholder="40"
                        disabled={isConfirmed && !isExpanded}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.cargaEnsaioTf}
                        onChange={(e) => updateRow(idx, (p) => { p.cargaEnsaioTf = e.target.value; })}
                        className="w-28 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        placeholder="60"
                        disabled={isConfirmed && !isExpanded}
                      />
                    </td>
                    <td className="py-2 pl-3">
                      <div className="flex items-center gap-2">
                        {!isEmpty && (
                          <button
                            type="button"
                            onClick={() => confirmRow(idx)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Confirmar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-red-600 hover:text-red-700 text-xs font-medium"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards responsivos no mobile */}
          <div className="md:hidden space-y-3">
            {value.piles.map((row, idx) => {
              const isEmpty = isRowEmpty(row);
              const isConfirmed = row.confirmado === true;
              const isExpanded = row.isExpanded !== false || isEmpty;
              
              // Estaca compilada (confirmada e não expandida)
              if (isConfirmed && !isExpanded) {
                return (
                  <div key={idx} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {row.nome || 'Estaca sem nome'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          {[
                            row.tipo && `Tipo: ${row.tipo}`,
                            row.diametroCm && `Ø: ${row.diametroCm}cm`,
                            row.profundidadeM && `Prof: ${row.profundidadeM}m`,
                            row.cargaTrabalhoTf && `Carga: ${row.cargaTrabalhoTf}tf`
                          ].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpandRow(idx)}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Editar estaca"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-red-600 hover:text-red-700 text-xs font-medium"
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
                <div key={idx} className="border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {row.nome || 'Nova Estaca'}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isEmpty && (
                        <button
                          type="button"
                          onClick={() => confirmRow(idx)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Confirmar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-red-600 hover:text-red-700 text-xs font-medium"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nome</label>
                    <input
                      type="text"
                      value={row.nome}
                      onChange={(e) => updateRow(idx, (p) => { p.nome = e.target.value; })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      placeholder="E-01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tipo</label>
                    <input
                      type="text"
                      value={row.tipo}
                      onChange={(e) => updateRow(idx, (p) => { p.tipo = e.target.value; })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      placeholder="Pré-moldada"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Diâmetro (cm)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.diametroCm}
                      onChange={(e) => updateRow(idx, (p) => { p.diametroCm = e.target.value; })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      placeholder="50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Profundidade (m)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.profundidadeM}
                      onChange={(e) => updateRow(idx, (p) => { p.profundidadeM = e.target.value; })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      placeholder="12.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Carga Trabalho (tf)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.cargaTrabalhoTf}
                      onChange={(e) => updateRow(idx, (p) => { p.cargaTrabalhoTf = e.target.value; })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      placeholder="40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Carga Ensaio (tf)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.cargaEnsaioTf}
                      onChange={(e) => updateRow(idx, (p) => { p.cargaEnsaioTf = e.target.value; })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      placeholder="60"
                    />
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        </div>

        {divider}

        {/* 2. Ocorrências */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Ocorrências</label>
          <textarea
            rows={5}
            value={value.ocorrencias}
            onChange={(e) => setField((d) => { d.ocorrencias = e.target.value; })}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
            placeholder="Em caso de diárias improdutivas, especifique o motivo."
          />
        </div>

        {divider}

        {/* 3. Abastecimento */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Abastecimento</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Equipamento</label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {(['Hammer 1','Hammer 2','Torre','Equipamento do Cliente'] as const).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950">
                    <input
                      type="checkbox"
                      checked={value.abastecimento.equipamentos.includes(opt)}
                      onChange={() => toggleEquip(opt)}
                      className="app-checkbox"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Horímetro (h)</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.horimetroHoras}
                onChange={(e) => setField((d) => { d.abastecimento.horimetroHoras = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex.: 3.2"
              />
            </div>
          </div>

          <div className="my-3 border-t border-gray-200 dark:border-gray-800" />
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">Preencher na data de mobilização (Antes do serviço)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Litros de diesel no tanque</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.mobilizacao.litrosTanque}
                onChange={(e) => setField((d) => { d.abastecimento.mobilizacao.litrosTanque = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Litros de diesel no galão</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.mobilizacao.litrosGalao}
                onChange={(e) => setField((d) => { d.abastecimento.mobilizacao.litrosGalao = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="my-3 border-t border-gray-200 dark:border-gray-800" />
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">Preencher ao final do dia (Todos os dias)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Litros de diesel no tanque</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.finalDia.litrosTanque}
                onChange={(e) => setField((d) => { d.abastecimento.finalDia.litrosTanque = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Litros de diesel no galão</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.finalDia.litrosGalao}
                onChange={(e) => setField((d) => { d.abastecimento.finalDia.litrosGalao = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {divider}

        {/* 4. Abastecimento e Entrega de Diesel */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Abastecimento e Entrega de Diesel</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Chegou diesel na obra?</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Sim','Não'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField((d) => { d.abastecimento.entrega.chegouDiesel = opt; })}
                    className={`${value.abastecimento.entrega.chegouDiesel === opt ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700'} px-3 py-2 rounded-lg font-medium hover:scale-105 transition-all`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Fornecido por</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Cliente','Geoteste'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField((d) => { d.abastecimento.entrega.fornecidoPor = opt; })}
                    className={`${value.abastecimento.entrega.fornecidoPor === opt ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700'} px-3 py-2 rounded-lg font-medium hover:scale-105 transition-all`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Quantos litros?</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.entrega.quantidadeLitros}
                onChange={(e) => setField((d) => { d.abastecimento.entrega.quantidadeLitros = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex.: 80"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Horário de chegada</label>
              <input
                type="time"
                value={value.abastecimento.entrega.horarioChegada}
                onChange={(e) => setField((d) => { d.abastecimento.entrega.horarioChegada = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


