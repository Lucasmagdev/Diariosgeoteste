import React from 'react';
import { Edit, Check } from 'lucide-react';
import { maskTimeInput, normalizeTimeInput } from '../utils/time';

export interface PCEPile {
  estacaNome: string;
  estacaProfundidadeM: string; // string para facilitar máscara/validação
  estacaTipo: string;
  estacaCargaTrabalhoTf: string;
  estacaCargaEnsaioTf: string;
  estacaDiametroCm: string;
  confirmado?: boolean;
  isExpanded?: boolean;
}

export interface PCEFormData {
  ensaioTipo: 'PCE CONVENCIONAL' | 'PCE HELICOIDAL';
  piles: PCEPile[];
  carregamentoTipos: Array<'Lento' | 'Rápido' | 'Misto' | 'Cíclico'>;
  equipamentos: {
    macaco: string;
    celula: string;
    manometro: string;
    relogios: string;
    conjuntoVigas: string;
  };
  ocorrencias: string;
  cravacao: {
    equipamento: 'Fusion (JCB)' | 'T10' | 'Equipamento do cliente' | '';
    horimetro: string;
  };
  abastecimento: {
    mobilizacao: {
      litrosTanque: string;
      litrosGalao: string;
    };
    finalDia: {
      litrosTanque: string;
      litrosGalao: string;
    };
    chegouDiesel: 'Sim' | 'Não' | '';
    fornecidoPor: 'Cliente' | 'Geoteste' | '';
    quantidadeLitros: string;
    horarioChegada: string; // HH:MM
  };
}

interface PCEFormProps {
  value: PCEFormData;
  onChange: (next: PCEFormData) => void;
}

export const PCEForm: React.FC<PCEFormProps> = ({ value, onChange }) => {
  const setField = (path: (draft: PCEFormData) => void) => {
    // ✅ OTIMIZAÇÃO: structuredClone() é nativo e muito mais rápido que JSON.parse(JSON.stringify())
    const next: PCEFormData = structuredClone(value);
    path(next);
    onChange(next);
  };

  const toggleCarregamento = (opt: 'Lento' | 'Rápido' | 'Misto' | 'Cíclico') => {
    setField((d) => {
      const ix = d.carregamentoTipos.indexOf(opt);
      if (ix >= 0) d.carregamentoTipos.splice(ix, 1);
      else d.carregamentoTipos.push(opt);
    });
  };

  const addPile = () => {
    setField((d) => {
      d.piles.unshift({
        estacaNome: '',
        estacaProfundidadeM: '',
        estacaTipo: '',
        estacaCargaTrabalhoTf: '',
        estacaCargaEnsaioTf: '',
        estacaDiametroCm: '',
        confirmado: false,
        isExpanded: true
      });
    });
  };

  const confirmPile = (index: number) => {
    setField((d) => {
      const pile = d.piles[index];
      // Verifica se a estaca tem dados preenchidos
      const hasData = pile.estacaNome.trim() || 
                     pile.estacaProfundidadeM.trim() || 
                     pile.estacaTipo.trim() || 
                     pile.estacaCargaTrabalhoTf.trim() || 
                     pile.estacaCargaEnsaioTf.trim() || 
                     pile.estacaDiametroCm.trim();
      
      if (hasData) {
        pile.confirmado = true;
        pile.isExpanded = false;
        
        // Move estaca confirmada para o final
        const confirmedPile = d.piles.splice(index, 1)[0];
        d.piles.push(confirmedPile);
      }
    });
  };

  const toggleExpandPile = (index: number) => {
    setField((d) => {
      d.piles[index].isExpanded = !d.piles[index].isExpanded;
    });
  };

  const isPileEmpty = (pile: PCEPile) => {
    return !pile.estacaNome.trim() && 
           !pile.estacaProfundidadeM.trim() && 
           !pile.estacaTipo.trim() && 
           !pile.estacaCargaTrabalhoTf.trim() && 
           !pile.estacaCargaEnsaioTf.trim() && 
           !pile.estacaDiametroCm.trim();
  };

  const removePile = (index: number) => {
    setField((d) => {
      d.piles.splice(index, 1);
      if (d.piles.length === 0) {
        d.piles.push({ estacaNome: '', estacaProfundidadeM: '', estacaTipo: '', estacaCargaTrabalhoTf: '', estacaCargaEnsaioTf: '', estacaDiametroCm: '' });
      }
    });
  };

  const updatePile = (index: number, fn: (p: PCEPile) => void) => {
    setField((d) => {
      fn(d.piles[index]);
    });
  };

  const divider = <div className="my-4 sm:my-6 border-t border-gray-200 dark:border-gray-800" />;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="p-4 sm:p-5 md:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Formulário PCE</h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Preencha os campos específicos de PCE</p>
      </div>

      <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
        {/* Tipo de ensaio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tipo de ensaio</label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {(['PCE CONVENCIONAL', 'PCE HELICOIDAL'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setField((d) => { d.ensaioTipo = opt; })}
                className={`${value.ensaioTipo === opt ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700'} px-3 py-2 rounded-lg font-medium hover:scale-105 transition-all`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {divider}

        {/* Características da Estaca (múltiplas) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Características da Estaca</h3>
            <button
              type="button"
              onClick={addPile}
              className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Adicionar estaca
            </button>
          </div>

          {value.piles.map((pile, index) => {
            const isEmpty = isPileEmpty(pile);
            const isConfirmed = pile.confirmado === true;
            const isExpanded = pile.isExpanded !== false || isEmpty;
            
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
                          pile.estacaProfundidadeM && `Prof: ${pile.estacaProfundidadeM}m`,
                          pile.estacaCargaTrabalhoTf && `Carga trab: ${pile.estacaCargaTrabalhoTf}tf`,
                          pile.estacaCargaEnsaioTf && `Carga ens: ${pile.estacaCargaEnsaioTf}tf`,
                          pile.estacaDiametroCm && `Ø: ${pile.estacaDiametroCm}cm`
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Profundidade (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pile.estacaProfundidadeM}
                    onChange={(e) => updatePile(index, (p) => { p.estacaProfundidadeM = e.target.value; })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 12,5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tipo de estaca</label>
                  <input
                    type="text"
                    value={pile.estacaTipo}
                    onChange={(e) => updatePile(index, (p) => { p.estacaTipo = e.target.value; })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: Hélice contínua"
                  />
                </div>
                {value.ensaioTipo === 'PCE HELICOIDAL' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Carga de trabalho (tf)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pile.estacaCargaTrabalhoTf}
                        onChange={(e) => updatePile(index, (p) => { p.estacaCargaTrabalhoTf = e.target.value; })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Ex.: 40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Carga de ensaio (tf)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pile.estacaCargaEnsaioTf}
                        onChange={(e) => updatePile(index, (p) => { p.estacaCargaEnsaioTf = e.target.value; })}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Ex.: 60"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Diâmetro (cm)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pile.estacaDiametroCm}
                    onChange={(e) => updatePile(index, (p) => { p.estacaDiametroCm = e.target.value; })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 50"
                  />
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {divider}

        {/* Tipo de carregamento */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tipo de carregamento</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {(['Lento', 'Rápido', 'Misto', 'Cíclico'] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950">
                <input
                  type="checkbox"
                  checked={value.carregamentoTipos.includes(opt)}
                  onChange={() => toggleCarregamento(opt)}
                  className="app-checkbox"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">{opt}</span>
              </label>
            ))}
          </div>
        </div>

        {divider}

        {/* Equipamentos utilizados */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Equipamentos utilizados</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Macaco</label>
              <input
                type="text"
                value={value.equipamentos.macaco}
                onChange={(e) => setField((d) => { d.equipamentos.macaco = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                {value.ensaioTipo === 'PCE HELICOIDAL' ? 'Célula de carga' : 'Célula'}
              </label>
              <input
                type="text"
                value={value.equipamentos.celula}
                onChange={(e) => setField((d) => { d.equipamentos.celula = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Manômetro</label>
              <input
                type="text"
                value={value.equipamentos.manometro}
                onChange={(e) => setField((d) => { d.equipamentos.manometro = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Relógios</label>
              <input
                type="text"
                value={value.equipamentos.relogios}
                onChange={(e) => setField((d) => { d.equipamentos.relogios = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Conjunto de Vigas</label>
              <input
                type="text"
                value={value.equipamentos.conjuntoVigas}
                onChange={(e) => setField((d) => { d.equipamentos.conjuntoVigas = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {divider}

        {/* Ocorrências */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Ocorrências</label>
          <textarea
            rows={5}
            value={value.ocorrencias}
            onChange={(e) => setField((d) => { d.ocorrencias = e.target.value; })}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
            placeholder="Descreva as ocorrências do campo..."
          />
        </div>

        {/* Equipamento de cravação - Apenas para PCE HELICOIDAL */}
        {value.ensaioTipo === 'PCE HELICOIDAL' && (
          <>
            {divider}
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Equipamento de cravação</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
                {(['Fusion (JCB)', 'T10', 'Equipamento do cliente'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField((d) => { d.cravacao.equipamento = opt; })}
                    className={`${value.cravacao.equipamento === opt ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700'} px-3 py-2 rounded-lg font-medium hover:scale-105 transition-all text-left`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Horímetro</label>
                <input
                  type="text"
                  value={value.cravacao.horimetro}
                  onChange={(e) => setField((d) => { d.cravacao.horimetro = e.target.value; })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ex.: 3.2h"
                />
              </div>
            </div>
          </>
        )}

        {/* Abastecimento - Apenas para PCE HELICOIDAL */}
        {value.ensaioTipo === 'PCE HELICOIDAL' && (
          <>
            {divider}
            <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Abastecimento</h3>
          <div className="my-3 border-t border-gray-200 dark:border-gray-800" />
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">Preencher na data de mobilização (Antes do serviço)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Litros no tanque</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.mobilizacao.litrosTanque}
                onChange={(e) => setField((d) => { d.abastecimento.mobilizacao.litrosTanque = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Litros no galão</label>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Litros no tanque</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.finalDia.litrosTanque}
                onChange={(e) => setField((d) => { d.abastecimento.finalDia.litrosTanque = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Litros no galão</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.finalDia.litrosGalao}
                onChange={(e) => setField((d) => { d.abastecimento.finalDia.litrosGalao = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Chegou diesel na obra?</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Sim','Não'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField((d) => { d.abastecimento.chegouDiesel = opt; })}
                    className={`${value.abastecimento.chegouDiesel === opt ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700'} px-3 py-2 rounded-lg font-medium hover:scale-105 transition-all`}
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
                    onClick={() => setField((d) => { d.abastecimento.fornecidoPor = opt; })}
                    className={`${value.abastecimento.fornecidoPor === opt ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700'} px-3 py-2 rounded-lg font-medium hover:scale-105 transition-all`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Quantos litros</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.abastecimento.quantidadeLitros}
                onChange={(e) => setField((d) => { d.abastecimento.quantidadeLitros = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex.: 80"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Horário da chegada</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="00:00"
                maxLength={5}
                value={value.abastecimento.horarioChegada}
                onChange={(e) => setField((d) => { d.abastecimento.horarioChegada = maskTimeInput(e.target.value); })}
                onBlur={(e) => setField((d) => { d.abastecimento.horarioChegada = normalizeTimeInput(e.target.value); })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
          </>
        )}

        {divider}

        {/* Assinaturas: serão usadas as do formulário principal */}
        <p className="text-xs text-gray-500 dark:text-gray-400">As assinaturas serão preenchidas na seção padrão do formulário.</p>
      </div>
    </div>
  );
};


