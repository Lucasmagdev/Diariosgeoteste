import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode, Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ConfirmDialog from './ConfirmDialog';
import { Modal, StatusBadge, Surface } from './ui';
import { ConnectionState, disconnectWhatsapp, fetchConnectionStatus, fetchQrCode } from '../lib/evolutionConnection';

const QR_TTL_SECONDS = 60;
const STATUS_POLL_MS = 3000;

const isConnected = (state: ConnectionState | null) => state === 'open';

export const WhatsappConnection: React.FC = () => {
  const toast = useToast();
  const [status, setStatus] = useState<ConnectionState | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrcodeBase64, setQrcodeBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL_SECONDS);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const state = await fetchConnectionStatus();
      setStatus(state);
      return state;
    } catch {
      setStatus('unknown');
      return 'unknown' as ConnectionState;
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const loadQrCode = useCallback(async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const result = await fetchQrCode();
      if (result.qrcodeBase64 || result.pairingCode) {
        setQrcodeBase64(result.qrcodeBase64);
        setPairingCode(result.pairingCode);
        setSecondsLeft(QR_TTL_SECONDS);
      } else if (result.state && isConnected(result.state)) {
        setShowQrModal(false);
        setStatus('open');
        toast.success('WhatsApp conectado!');
      } else {
        setQrError('Não foi possível gerar o QR agora. Tente de novo em alguns segundos.');
      }
    } catch (err: any) {
      setQrError(err.message || 'Não foi possível gerar o QR code.');
    } finally {
      setQrLoading(false);
    }
  }, [toast]);

  const closeQrModal = useCallback(() => {
    setShowQrModal(false);
    setQrcodeBase64(null);
    setPairingCode(null);
    setQrError(null);
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const openQrModal = () => {
    setShowQrModal(true);
    loadQrCode();
  };

  // Enquanto o modal do QR estiver aberto: checa conexão a cada poucos
  // segundos (fecha sozinho se conectar) e conta regressiva pra renovar
  // o QR sozinho antes dele expirar — nunca deixa o usuário esbarrar num
  // código morto por falta de tempo pra escanear.
  useEffect(() => {
    if (!showQrModal) return undefined;

    pollRef.current = setInterval(async () => {
      const state = await refreshStatus();
      if (isConnected(state)) {
        toast.success('WhatsApp conectado!');
        closeQrModal();
      }
    }, STATUS_POLL_MS);

    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          loadQrCode();
          return QR_TTL_SECONDS;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showQrModal, refreshStatus, loadQrCode, closeQrModal, toast]);

  const handleDisconnect = async () => {
    try {
      await disconnectWhatsapp();
      toast.success('WhatsApp desconectado.');
      refreshStatus();
    } catch {
      toast.error('Não foi possível desconectar.');
    } finally {
      setConfirmDisconnect(false);
    }
  };

  return (
    <Surface className="mb-6">
      <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isConnected(status) ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
            {isConnected(status) ? <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : <WifiOff className="h-5 w-5 text-gray-400" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">WhatsApp (Evolution API)</p>
            {statusLoading ? (
              <p className="text-xs text-gray-400">Verificando conexão...</p>
            ) : (
              <StatusBadge variant={isConnected(status) ? 'success' : status === 'unknown' ? 'neutral' : 'warning'}>
                {isConnected(status) ? 'Conectado' : status === 'not_created' ? 'Nunca conectado' : status === 'unknown' ? 'Não configurado' : 'Desconectado'}
              </StatusBadge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshStatus} className="text-xs text-gray-500 hover:underline flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </button>
          {isConnected(status) ? (
            <button
              onClick={() => setConfirmDisconnect(true)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Desconectar
            </button>
          ) : (
            <button onClick={openQrModal} className="btn-primary flex items-center gap-2 px-3 py-2 text-sm">
              <QrCode className="h-4 w-4" />
              Conectar WhatsApp
            </button>
          )}
        </div>
      </div>

      <Modal open={showQrModal} onClose={closeQrModal} title="Conectar WhatsApp" size="sm">
        <div className="flex flex-col items-center text-center gap-4">
          {qrLoading && !qrcodeBase64 && (
            <div className="py-10 flex flex-col items-center gap-2 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Gerando QR code...</p>
            </div>
          )}

          {qrError && !qrLoading && (
            <div className="py-6 space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400">{qrError}</p>
              <button onClick={loadQrCode} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                Tentar de novo
              </button>
            </div>
          )}

          {qrcodeBase64 && (
            <>
              <ol className="text-left text-sm text-gray-600 dark:text-gray-300 space-y-1 list-decimal list-inside">
                <li>Abra o WhatsApp no celular</li>
                <li>Toque em <strong>Configurações → Aparelhos conectados</strong></li>
                <li>Toque em <strong>Conectar aparelho</strong> e aponte a câmera pro código abaixo</li>
              </ol>

              <div className="relative">
                <img
                  src={qrcodeBase64.startsWith('data:') ? qrcodeBase64 : `data:image/png;base64,${qrcodeBase64}`}
                  alt="QR code para conectar o WhatsApp"
                  className="w-56 h-56 rounded-lg border border-gray-200 dark:border-gray-700"
                  draggable={false}
                />
                {qrLoading && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                  </div>
                )}
              </div>

              {pairingCode && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Ou use o código de pareamento: <span className="font-mono font-semibold">{pairingCode}</span>
                </p>
              )}

              <div className="w-full">
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-1000 ease-linear"
                    style={{ width: `${(secondsLeft / QR_TTL_SECONDS) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Código renovado automaticamente — nunca expira enquanto essa janela estiver aberta</p>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={handleDisconnect}
        title="Desconectar WhatsApp"
        message="Tem certeza que deseja desconectar o WhatsApp? Novas consultas vão parar de chegar até reconectar."
        confirmText="Desconectar"
        cancelText="Cancelar"
        type="danger"
      />
    </Surface>
  );
};
