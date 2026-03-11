import React from 'react';
import { Edit, Check } from 'lucide-react';

export interface PITPile {
  estacaNome: string;
  estacaTipo: string;
  diametroCm: string;
  profundidadeCm: string;
  arrasamentoM: string;
  comprimentoUtilM: string;
  confirmado?: boolean;
  isExpanded?: boolean;
}

export interface PITFormData {
  equipamento: 'PIT 1' | 'PIT 2' | 'PIT 3' | 'PIT 4' | 'PIT 5' | '';
  piles: PITPile[];
  ocorrencias: string;
  totalEstacas: string;
}

interface PITFormProps {
  value: PITFormData;
  onChange: (next: PITFormData) => void;
}

export const PITForm: React.FC<PITFormProps> = ({ value, onChange }) => {
  const setField = (fn: (draft: PITFormData) => void) => {
    // ✅ OTIMIZAÇÃO: structuredClone() é nativo e muito mais rápido que JSON.parse(JSON.stringify())
    const next: PITFormData = structuredClone(value);
    fn(next);
    onChange(next);
  };

  const setEquipamento = (equip: PITFormData['equipamento']) => {
    setField((d) => { d.equipamento = equip; });
  };

  const addPile = () => {
    setField((d) => {
      d.piles.unshift({
        estacaNome: '',
        estacaTipo: '',
        diametroCm: '',
        profundidadeCm: '',
        arrasamentoM: '',
        comprimentoUtilM: '',
        confirmado: false,
        isExpanded: true
      });
    });
  };

  const confirmPile = (index: number) => {
    setField((d) => {
      const pile = d.piles[index];
      const hasData = pile.estacaNome.trim() || 
                     pile.estacaTipo.trim() || 
                     pile.diametroCm.trim() || 
                     pile.profundidadeCm.trim() || 
                     pile.arrasamentoM.trim() || 
                     pile.comprimentoUtilM.trim();
      
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

  const isPileEmpty = (pile: PITPile) => {
    return !pile.estacaNome.trim() && 
           !pile.estacaTipo.trim() && 
           !pile.diametroCm.trim() && 
           !pile.profundidadeCm.trim() && 
           !pile.arrasamentoM.trim() && 
           !pile.comprimentoUtilM.trim();
  };

  const removePile = (index: number) => {
    setField((d) => {
      d.piles.splice(index, 1);
      if (d.piles.length === 0) {
        d.piles.push({ estacaNome: '', estacaTipo: '', diametroCm: '', profundidadeCm: '', arrasamentoM: '', comprimentoUtilM: '' });
      }
    });
  };

  const updatePile = (index: number, fn: (p: PITPile) => void) => {
    setField((d) => { fn(d.piles[index]); });
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            {(['PIT 1','PIT 2','PIT 3','PIT 4','PIT 5'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setEquipamento(opt)}
                className={`${value.equipamento === opt ? 'bg-green-600 text-white' : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700'} px-3 py-2 rounded-lg font-medium hover:scale-105 transition-all`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {divider}

        {/* Serviços executados - Múltiplas estacas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Serviços executados</h3>
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
                          pile.diametroCm && `Ø: ${pile.diametroCm}cm`,
                          pile.profundidadeCm && `Prof: ${pile.profundidadeCm}cm`,
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Profundidade (cm)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pile.profundidadeCm}
                    onChange={(e) => updatePile(index, (p) => { p.profundidadeCm = e.target.value; })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 1200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Arrasamento (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pile.arrasamentoM}
                    onChange={(e) => updatePile(index, (p) => { p.arrasamentoM = e.target.value; })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 0,30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Comprimento útil (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pile.comprimentoUtilM}
                    onChange={(e) => updatePile(index, (p) => { p.comprimentoUtilM = e.target.value; })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 9,50"
                  />
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


