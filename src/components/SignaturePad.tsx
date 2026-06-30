import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { RotateCcw, Download, Check, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signatureData: string) => void;
  onCancel: () => void;
  initialSignature?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ 
  onSave, 
  onCancel, 
  initialSignature 
}) => {
  const sigPad = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialSignature && sigPad.current) {
      sigPad.current.fromDataURL(initialSignature);
      setIsEmpty(false);
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
      // Usar toDataURL com parâmetros específicos para evitar tainted canvas
      const signatureData = sigPad.current.toDataURL('image/png', 1.0);
      onSave(signatureData);
    } catch (error) {
      console.error('Erro ao salvar assinatura:', error);
      // Fallback: tentar com JPEG se PNG falhar
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
    
    const link = document.createElement('a');
    link.download = 'assinatura.png';
    link.href = sigPad.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Mesa Digital de Assinatura
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Desenhe sua assinatura na área abaixo usando o mouse ou touch
        </p>
      </div>

      <div className="p-4 sm:p-6">
        {/* Área de assinatura */}
        <div className="mb-4">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800">
            <SignatureCanvas
              ref={sigPad}
              canvasProps={{
                width: 500,
                height: 200,
                className: 'w-full h-32 sm:h-40 md:h-48 bg-white dark:bg-gray-100',
                style: { 
                  width: '100%', 
                  height: '150px',
                  minHeight: '120px',
                  cursor: 'crosshair'
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={clear}
              disabled={isEmpty}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Limpar</span>
            </button>
            
            <button
              onClick={downloadSignature}
              disabled={isEmpty}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Baixar</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onCancel}
              className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Cancelar</span>
            </button>
            
            <button
              onClick={handleSave}
              disabled={isEmpty || isSaving}
              className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none transition-all duration-200"
            >
              {isSaving ? (
                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Check className="w-3 h-3 sm:w-4 sm:h-4" />
              )}
              <span>{isSaving ? 'Salvando...' : 'Salvar Assinatura'}</span>
            </button>
          </div>
        </div>

        {/* Dicas de uso */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
            💡 Dicas para uma boa assinatura:
          </h4>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Use o mouse ou toque na tela para desenhar</li>
            <li>• Faça movimentos suaves e contínuos</li>
            <li>• A assinatura será salva como imagem</li>
            <li>• Você pode limpar e refazer quantas vezes quiser</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
