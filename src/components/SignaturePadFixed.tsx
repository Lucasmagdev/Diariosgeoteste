import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { RotateCcw, Download, Check, X } from 'lucide-react';

interface SignaturePadFixedProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
  initialSignature?: string;
  compact?: boolean;
}

export const SignaturePadFixed: React.FC<SignaturePadFixedProps> = ({ 
  onSave, 
  onCancel, 
  initialSignature,
  compact = false,
}) => {
  const sigPad = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialSignature && sigPad.current) {
      // Se é uma URL, carregar como imagem
      if (initialSignature.startsWith('http')) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (sigPad.current) {
            const canvas = sigPad.current.getCanvas();
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              setIsEmpty(false);
            }
          }
        };
        img.src = initialSignature;
      } else {
        // Se é data URL, carregar diretamente
        sigPad.current.fromDataURL(initialSignature);
        setIsEmpty(false);
      }
    }
  }, [initialSignature]);

  const handleBegin = () => {
    setIsEmpty(false);
  };

  const handleEnd = () => {
    if (sigPad.current) {
      const isEmpty = sigPad.current.isEmpty();
      setIsEmpty(isEmpty);
    }
  };

  const clear = () => {
    if (sigPad.current) {
      sigPad.current.clear();
      setIsEmpty(true);
    }
  };

  const handleSave = async () => {
    if (!sigPad.current || isEmpty) {
      return;
    }

    setIsSaving(true);
    try {
      // Criar um novo canvas limpo para evitar tainted canvas
      const originalCanvas = sigPad.current.getCanvas();
      const newCanvas = document.createElement('canvas');
      const newCtx = newCanvas.getContext('2d');
      
      if (!newCtx) {
        throw new Error('Não foi possível criar contexto do canvas');
      }

      // Configurar o novo canvas
      newCanvas.width = originalCanvas.width;
      newCanvas.height = originalCanvas.height;
      
      // Desenhar o conteúdo do canvas original no novo canvas
      newCtx.fillStyle = 'white';
      newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
      newCtx.drawImage(originalCanvas, 0, 0);

      // Converter para data URL
      const signatureData = newCanvas.toDataURL('image/png', 1.0);
      onSave(signatureData);
    } catch (error) {
      console.error('Erro ao salvar assinatura:', error);
      // Fallback: tentar método original
      try {
        const signatureData = sigPad.current.toDataURL('image/jpeg', 0.9);
        onSave(signatureData);
      } catch (fallbackError) {
        console.error('Erro no fallback:', fallbackError);
        alert('Erro ao salvar assinatura. Tente novamente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const downloadSignature = () => {
    if (!sigPad.current || isEmpty) return;
    
    try {
      const signatureData = sigPad.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'assinatura.png';
      link.href = signatureData;
      link.click();
    } catch (error) {
      console.error('Erro ao baixar assinatura:', error);
      alert('Erro ao baixar assinatura.');
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-900 overflow-hidden ${compact ? '' : 'rounded-xl shadow-sm border border-gray-100 dark:border-gray-800'}`}>
      <div className={compact ? 'pb-4' : 'p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20'}>
        <h3 className={`${compact ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-white mb-1`}>
          Assine no campo abaixo
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Use o mouse ou toque na tela. Depois, salve a assinatura.
        </p>
      </div>

      <div className={compact ? '' : 'p-4 sm:p-6'}>
        {/* Área de assinatura */}
        <div className="mb-4">
          <div className={`border-2 border-dashed rounded-xl overflow-hidden bg-white ${compact ? 'border-emerald-300 shadow-inner' : 'border-gray-300 dark:border-gray-600'}`}>
            <SignatureCanvas
              ref={sigPad}
              canvasProps={{
                width: 500,
                height: 200,
                className: 'w-full h-32 sm:h-40 md:h-48',
                style: { 
                  width: '100%', 
                  height: '150px',
                  minHeight: '120px',
                  cursor: 'crosshair',
                  display: 'block'
                }
              }}
              onBegin={handleBegin}
              onEnd={handleEnd}
              backgroundColor="rgba(255, 255, 255, 1)"
              penColor="#000000"
              minWidth={2}
              maxWidth={3}
            />
          </div>
          
          {isEmpty && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-2">
              Desenhe sua assinatura na área acima
            </p>
          )}
        </div>

        {/* Controles */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={clear}
              disabled={isEmpty}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-sm">Limpar</span>
            </button>
            
            {!compact && <button
              onClick={downloadSignature}
              disabled={isEmpty}
              className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Baixar</span>
            </button>}
          </div>

          <div className="flex items-center space-x-2">
            {!compact && <button
              onClick={onCancel}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Cancelar</span>
            </button>}
            
            <button
              onClick={handleSave}
              disabled={isEmpty || isSaving}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Salvando...' : 'Salvar Assinatura'}</span>
            </button>
          </div>
        </div>

        {/* Dicas de uso */}
        {!compact && <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
            💡 Dicas para uma boa assinatura:
          </h4>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Use o mouse ou toque na tela para desenhar</li>
            <li>• Faça movimentos suaves e contínuos</li>
            <li>• A assinatura será salva como imagem</li>
            <li>• Você pode limpar e refazer quantas vezes quiser</li>
          </ul>
        </div>}
      </div>
    </div>
  );
};
