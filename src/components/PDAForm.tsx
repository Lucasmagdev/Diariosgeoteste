import React from 'react';

export interface PDAFormData {
  computadorSelecionados: Array<'PDA1' | 'PDA2' | 'PDA3' | 'PDA4'>;
  equipamentoSelecionados: Array<'Hammer I' | 'Hammer II' | 'Torre' | 'Equipamento do Cliente'>;

  blocoNome: string;
  estacaNome: string;
  estacaTipo: string;
  diametroCm: string;
  cargaTrabalhoTf: string;
  cargaEnsaioTf: string;

  pesoMarteloKg: string;

  hq: string[]; // Array dinâmico, em metros
  nega: string[]; // Array dinâmico, em mm
  emx: string[]; // Array dinâmico
  rmx: string[]; // Array dinâmico
  dmx: string[]; // Array dinâmico

  secaoCravada: string[]; // Array dinâmico, em metros (opcional)

  // Geometria interativa
  alturaBlocoM: string; // acima da estaca
  alturaSensoresM: string; // posição dos sensores medida a partir do topo da estaca
  lpComprimentoUtilM: string; // comprimento útil
  leComprimentoAteSensoresM: string; // comprimento até sensores (sincronizado com alturaSensoresM)
  ltComprimentoTotalM: string; // comprimento total da estaca
}

const golpeFieldConfigs: Array<{
  key: keyof Pick<PDAFormData, 'hq' | 'nega' | 'emx' | 'rmx' | 'dmx'>;
  label: string;
  placeholder: string;
  inputMode?: 'decimal' | 'numeric';
}> = [
  { key: 'hq', label: 'Altura de Queda (Hq) [m]', placeholder: 'Hq', inputMode: 'decimal' },
  { key: 'nega', label: 'Nega (mm)', placeholder: 'Nega', inputMode: 'numeric' },
  { key: 'emx', label: 'EMX', placeholder: 'EMX', inputMode: 'decimal' },
  { key: 'rmx', label: 'RMX', placeholder: 'RMX', inputMode: 'decimal' },
  { key: 'dmx', label: 'DMX', placeholder: 'DMX', inputMode: 'decimal' },
];

interface PDAFormProps {
  value: PDAFormData;
  onChange: (next: PDAFormData) => void;
}

export const PDAForm: React.FC<PDAFormProps> = ({ value, onChange }) => {
  const setField = (fn: (draft: PDAFormData) => void) => {
    // ✅ OTIMIZAÇÃO: structuredClone() é nativo e muito mais rápido que JSON.parse(JSON.stringify())
    const next: PDAFormData = structuredClone(value);
    fn(next);
    onChange(next);
  };

  const toggleSelecionado = <T extends string>(key: 'computadorSelecionados' | 'equipamentoSelecionados', opt: T) => {
    setField((d) => {
      const list = d[key] as unknown as string[];
      const idx = list.indexOf(opt);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(opt);
    });
  };

  const updateArrayIndex = (key: keyof PDAFormData, index: number, val: string) => {
    setField((d) => {
      const arr = (d[key] as unknown as string[]).slice();
      arr[index] = val;
      (d as any)[key] = arr;
    });
  };

  const addArrayItem = (key: keyof PDAFormData) => {
    setField((d) => {
      const arr = ((d[key] as unknown as string[]) || []).slice();
      arr.push('');
      (d as any)[key] = arr;
    });
  };

  const removeArrayItem = (key: keyof PDAFormData, index: number) => {
    setField((d) => {
      const arr = ((d[key] as unknown as string[]) || []).slice();
      arr.splice(index, 1);
      (d as any)[key] = arr;
    });
  };

  const ensureArrayLength = (arr: string[], index: number) => {
    const clone = arr.slice();
    while (clone.length <= index) {
      clone.push('');
    }
    return clone;
  };

  const updateGolpeValue = (
    key: keyof Pick<PDAFormData, 'hq' | 'nega' | 'emx' | 'rmx' | 'dmx'>,
    index: number,
    valueStr: string
  ) => {
    setField((d) => {
      const current = ensureArrayLength(((d[key] as unknown as string[]) || []), index);
      current[index] = valueStr;
      (d as any)[key] = current;
    });
  };

  const addGolpe = () => {
    setField((d) => {
      golpeFieldConfigs.forEach(({ key }) => {
        const current = ((d[key] as unknown as string[]) || []).slice();
        current.push('');
        (d as any)[key] = current;
      });
    });
  };

  const removeGolpe = (index: number) => {
    setField((d) => {
      golpeFieldConfigs.forEach(({ key }) => {
        const current = ((d[key] as unknown as string[]) || []).slice();
        if (index < current.length) {
          current.splice(index, 1);
        }
        (d as any)[key] = current;
      });
    });
  };

  const golpeCount = Math.max(
    value.hq?.length || 0,
    value.nega?.length || 0,
    value.emx?.length || 0,
    value.rmx?.length || 0,
    value.dmx?.length || 0
  );

  const renderDynamicInputs = (
    label: string,
    key: keyof PDAFormData,
    placeholder: string,
    inputMode: 'decimal' | 'numeric' = 'decimal'
  ) => {
    const arr = ((value[key] as unknown as string[]) || []);
    return (
      <div className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>
          <button
            type="button"
            onClick={() => addArrayItem(key)}
            className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            + Adicionar
          </button>
        </div>
        {arr.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
            Nenhum item adicionado. Clique em "+ Adicionar" para começar.
          </div>
        ) : (
          <div className="space-y-2">
            {arr.map((v, i) => (
              <div key={i} className="flex items-center gap-2 w-full min-w-0">
                <input
                  type="text"
                  inputMode={inputMode}
                  value={v}
                  onChange={(e) => updateArrayIndex(key, i, e.target.value)}
                  className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder={`${placeholder}${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeArrayItem(key, i)}
                  className="px-3 py-2.5 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
                  title="Remover"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const divider = <div className="my-4 sm:my-6 border-t border-gray-200 dark:border-gray-800" />;

  const parseNum = (s: string) => {
    const t = (s || '').replace(',', '.').trim();
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  };

  // Dimensões para o diagrama
  const diagramPadding = 24; // px
  const diagramWidth = 360; // px
  const diagramHeight = 420; // px

  const lt = Math.max(0.1, parseNum(value.ltComprimentoTotalM));
  const alturaBloco = Math.max(0, parseNum(value.alturaBlocoM));
  const alturaSensores = Math.max(0, Math.min(lt, parseNum(value.alturaSensoresM)));
  const lp = Math.max(0, Math.min(lt, parseNum(value.lpComprimentoUtilM)));
  const le = Math.max(0, Math.min(lt, parseNum(value.leComprimentoAteSensoresM)));

  // Sincronizar alturaSensoresM <-> leComprimentoAteSensoresM quando exibindo (mantemos o valor digitado, mas o drag atualiza ambos)
  const effectiveSensorM = alturaSensores || le;
  const totalMetersToRender = lt + alturaBloco;
  const innerH = diagramHeight - diagramPadding * 2;
  const innerW = diagramWidth - diagramPadding * 2;
  const pxPerMeter = totalMetersToRender > 0 ? innerH / totalMetersToRender : 0;

  // Geometria do desenho
  const estacaTopY = diagramPadding + pxPerMeter * alturaBloco; // topo da estaca dentro da área
  const estacaHeight = pxPerMeter * lt;
  const estacaX = diagramPadding + innerW * 0.35;
  const estacaWidth = innerW * 0.3;

  const blocoY = diagramPadding;
  const blocoH = pxPerMeter * alturaBloco;
  const blocoX = estacaX;
  const blocoW = estacaWidth;

  const sensoresY = estacaTopY + pxPerMeter * effectiveSensorM - 6; // centralizar os dois blocos
  const sensorBlockHeight = 4;
  const sensorGap = 6;
  const sensor1Y = Math.max(estacaTopY, Math.min(estacaTopY + estacaHeight - sensorBlockHeight, sensoresY));
  const sensor2Y = Math.max(estacaTopY, Math.min(estacaTopY + estacaHeight - sensorBlockHeight, sensor1Y + sensorGap + sensorBlockHeight));
  const sensorX = estacaX - 4;
  const sensorW = estacaWidth + 8;

  const handleSensorDrag = (clientY: number, svgTop: number) => {
    const localY = clientY - svgTop; // posição no SVG
    // converter para metros a partir do topo da estaca
    const clamped = Math.max(estacaTopY, Math.min(estacaTopY + estacaHeight, localY));
    const meters = (clamped - estacaTopY) / (pxPerMeter || 1);
    setField((d) => {
      d.alturaSensoresM = meters.toFixed(2);
      d.leComprimentoAteSensoresM = d.alturaSensoresM;
    });
  };

  const onMouseDownSensors: React.MouseEventHandler<SVGRectElement> = (e) => {
    const svg = (e.currentTarget.ownerSVGElement as SVGSVGElement) || null;
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    const move = (ev: MouseEvent) => handleSensorDrag(ev.clientY, svgRect.top);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="p-4 sm:p-5 md:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Ficha técnica de PDA</h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Preencha os campos específicos da ficha técnica de PDA</p>
      </div>

      <div className="p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-6">
        {/* Identificação do Equipamento */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Identificação do Equipamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Computador</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {(['PDA1','PDA2','PDA3','PDA4'] as const).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950">
                    <input
                      type="checkbox"
                      checked={value.computadorSelecionados.includes(opt)}
                      onChange={() => toggleSelecionado('computadorSelecionados', opt)}
                      className="app-checkbox"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Equipamento</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {(['Hammer I','Hammer II','Torre','Equipamento do Cliente'] as const).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950">
                    <input
                      type="checkbox"
                      checked={value.equipamentoSelecionados.includes(opt)}
                      onChange={() => toggleSelecionado('equipamentoSelecionados', opt)}
                      className="app-checkbox"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {divider}

        {/* Características da Estaca - Dados Básicos */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Características da Estaca</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Nome do Bloco</label>
              <input
                type="text"
                value={value.blocoNome}
                onChange={(e) => setField((d) => { d.blocoNome = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex.: BL-01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Nome da Estaca</label>
              <input
                type="text"
                value={value.estacaNome}
                onChange={(e) => setField((d) => { d.estacaNome = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex.: E-01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Tipo de Estaca</label>
              <input
                type="text"
                value={value.estacaTipo}
                onChange={(e) => setField((d) => { d.estacaTipo = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex.: Pré-moldada"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Diâmetro (cm)</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.diametroCm}
                onChange={(e) => setField((d) => { d.diametroCm = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex.: 50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Carga de Trabalho (tf)</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.cargaTrabalhoTf}
                onChange={(e) => setField((d) => { d.cargaTrabalhoTf = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex.: 40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Carga de Ensaio (tf)</label>
              <input
                type="text"
                inputMode="decimal"
                value={value.cargaEnsaioTf}
                onChange={(e) => setField((d) => { d.cargaEnsaioTf = e.target.value; })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex.: 60"
              />
            </div>
          </div>
        </div>

        {divider}

        {/* Geometria da Estaca */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Geometria da Estaca – Diagrama</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Diagrama interativo (SVG) */}
            <div className="flex items-center justify-center">
              <svg width={diagramWidth} height={diagramHeight} className="bg-white dark:bg-gray-900">
                {/* Área de desenho */}
                {/* Bloco (acima) */}
                {alturaBloco > 0 && (
                  <rect x={blocoX} y={blocoY} width={blocoW} height={blocoH} fill="#fde68a" stroke="#b45309" />
                )}
                {/* Estaca */}
                <rect x={estacaX} y={estacaTopY} width={estacaWidth} height={estacaHeight} fill="#f97316" opacity={0.8} stroke="#9a3412" />

                {/* Sensores (dois blocos horizontais) */}
                <rect x={sensorX} y={sensor1Y} width={sensorW} height={sensorBlockHeight} fill="#60a5fa" />
                <rect x={sensorX} y={sensor2Y} width={sensorW} height={sensorBlockHeight} fill="#60a5fa" />
                <text x={sensorX + sensorW + 6} y={sensor2Y + sensorBlockHeight} fill="#3b82f6" fontSize="10">sensores</text>
                {/* Área de drag sobre sensores */}
                <rect x={sensorX} y={estacaTopY} width={sensorW} height={estacaHeight} fill="transparent" cursor="ns-resize" onMouseDown={onMouseDownSensors} />

                {/* Cotas verticais e rótulos */}
                {/* LT à esquerda */}
                <line x1={estacaX - 24} y1={estacaTopY} x2={estacaX - 24} y2={estacaTopY + estacaHeight} stroke="#6b7280" />
                <polygon points={`${estacaX - 28},${estacaTopY} ${estacaX - 20},${estacaTopY} ${estacaX - 24},${estacaTopY - 6}`} fill="#6b7280" />
                <polygon points={`${estacaX - 28},${estacaTopY + estacaHeight} ${estacaX - 20},${estacaTopY + estacaHeight} ${estacaX - 24},${estacaTopY + estacaHeight + 6}`} fill="#6b7280" />
                <text x={estacaX - 40} y={estacaTopY + estacaHeight / 2} transform={`rotate(-90 ${estacaX - 40} ${estacaTopY + estacaHeight / 2})`} fontSize="10" fill="#374151">
                  {`${lt.toFixed(2)} m (LT)`}
                </text>

                {/* LE à direita (até sensores) */}
                <line x1={estacaX + estacaWidth + 24} y1={estacaTopY} x2={estacaX + estacaWidth + 24} y2={estacaTopY + pxPerMeter * effectiveSensorM} stroke="#6b7280" />
                <polygon points={`${estacaX + estacaWidth + 20},${estacaTopY} ${estacaX + estacaWidth + 28},${estacaTopY} ${estacaX + estacaWidth + 24},${estacaTopY - 6}`} fill="#6b7280" />
                <polygon points={`${estacaX + estacaWidth + 20},${estacaTopY + pxPerMeter * effectiveSensorM} ${estacaX + estacaWidth + 28},${estacaTopY + pxPerMeter * effectiveSensorM} ${estacaX + estacaWidth + 24},${estacaTopY + pxPerMeter * effectiveSensorM + 6}`} fill="#6b7280" />
                <text x={estacaX + estacaWidth + 30} y={estacaTopY + (pxPerMeter * effectiveSensorM) / 2} transform={`rotate(-90 ${estacaX + estacaWidth + 30} ${estacaTopY + (pxPerMeter * effectiveSensorM) / 2})`} fontSize="10" fill="#374151">
                  {`${(effectiveSensorM || 0).toFixed(2)} m (LE)`}
                </text>

                {/* LP (útil) dentro da estaca */}
                {lp > 0 && (
                  <>
                    <line x1={estacaX + estacaWidth + 6} y1={estacaTopY} x2={estacaX + estacaWidth + 6} y2={estacaTopY + pxPerMeter * lp} stroke="#10b981" />
                    <text x={estacaX + estacaWidth + 10} y={estacaTopY + (pxPerMeter * lp) / 2} transform={`rotate(-90 ${estacaX + estacaWidth + 10} ${estacaTopY + (pxPerMeter * lp) / 2})`} fontSize="10" fill="#065f46">
                      {`${lp.toFixed(2)} m (LP)`}
                    </text>
                  </>
                )}

                {/* Altura do bloco (acima) */}
                {alturaBloco > 0 && (
                  <>
                    <line x1={estacaX - 24} y1={diagramPadding} x2={estacaX - 24} y2={estacaTopY} stroke="#6b7280" />
                    <text x={estacaX - 40} y={diagramPadding + blocoH / 2} transform={`rotate(-90 ${estacaX - 40} ${diagramPadding + blocoH / 2})`} fontSize="10" fill="#374151">
                      {`${alturaBloco.toFixed(2)} m`}
                    </text>
                  </>
                )}
              </svg>
            </div>

            {/* Campos numéricos vinculados */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Altura do bloco (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value.alturaBlocoM}
                    onChange={(e) => setField((d) => { d.alturaBlocoM = e.target.value; })}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 0.50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Altura dos sensores (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value.alturaSensoresM}
                    onChange={(e) => setField((d) => { d.alturaSensoresM = e.target.value; d.leComprimentoAteSensoresM = d.alturaSensoresM; })}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 2.40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">LP (comprimento útil) (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value.lpComprimentoUtilM}
                    onChange={(e) => setField((d) => { d.lpComprimentoUtilM = e.target.value; })}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 8.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">LE (comprimento até sensores) (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value.leComprimentoAteSensoresM}
                    onChange={(e) => setField((d) => { d.leComprimentoAteSensoresM = e.target.value; d.alturaSensoresM = d.leComprimentoAteSensoresM; })}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 2.40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">LT (comprimento total) (m)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value.ltComprimentoTotalM}
                    onChange={(e) => setField((d) => { d.ltComprimentoTotalM = e.target.value; })}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex.: 12.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Peso do Martelo (kg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={value.pesoMarteloKg}
                  onChange={(e) => setField((d) => { d.pesoMarteloKg = e.target.value; })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Ex.: 300"
                />
              </div>
            </div>
          </div>

          <div className="my-4" />

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Golpes</h3>
              <button
                type="button"
                onClick={addGolpe}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                + Adicionar golpe
              </button>
            </div>

            {golpeCount === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
                Nenhum golpe cadastrado. Clique em "+ Adicionar golpe" para começar.
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from({ length: golpeCount }).map((_, golpeIdx) => (
                  <div
                    key={golpeIdx}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 sm:p-4 space-y-3 bg-white dark:bg-gray-950"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Golpe {golpeIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeGolpe(golpeIdx)}
                        className="text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg px-2.5 py-1 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {golpeFieldConfigs.map(({ key, label, placeholder, inputMode }) => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                            {label}
                          </label>
                          <input
                            type="text"
                            inputMode={inputMode || 'decimal'}
                            value={(value[key] && value[key][golpeIdx]) || ''}
                            onChange={(e) => updateGolpeValue(key, golpeIdx, e.target.value)}
                            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                            placeholder={`${placeholder} ${golpeIdx + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {divider}

        {/* Caso for estaca cravada */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3">Caso for estaca cravada</h3>
          {renderDynamicInputs('Seção cravada (m)', 'secaoCravada', 'Seção ', 'decimal')}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Preencha apenas se aplicável.</p>
        </div>
      </div>
    </div>
  );
};


