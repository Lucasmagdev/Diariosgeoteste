import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, FileCheck2, Link2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { SignaturePadFixed } from './SignaturePadFixed';
import { DiaryPDFLayout } from './DiaryPDFLayout';
import { formatTime24hOrEmpty } from '../utils/time';

interface PublicDiarySignatureProps {
  token: string;
}

const formatAddress = (address: string | null | undefined, enderecoDetalhado: any): string => {
  if (enderecoDetalhado && typeof enderecoDetalhado === 'object') {
    const rua = enderecoDetalhado.rua?.trim() || 'S/R';
    const numero = enderecoDetalhado.numero?.trim() || 'S/N';
    const cidade = enderecoDetalhado.cidade_nome?.trim() || '';
    const estado = enderecoDetalhado.estado_nome?.trim() || '';

    if (cidade && estado) return `${rua}, ${numero}, ${cidade}, ${estado}`;
    if (cidade || estado) return `${rua}, ${numero}${cidade ? `, ${cidade}` : ''}${estado ? `, ${estado}` : ''}`;
    return `${rua}, ${numero}`;
  }

  return address || '-';
};

const mapDiaryFromRow = (row: any) => {
  const enderecoDetalhado = row?.endereco_detalhado || undefined;

  return {
    id: row?.id || '',
    clientId: row?.user_id || '',
    clientName: row?.client_name || '',
    address: formatAddress(row?.address, enderecoDetalhado),
    enderecoDetalhado,
    team: row?.team || '',
    type: row?.diary_type || undefined,
    date: row?.date || '',
    startTime: formatTime24hOrEmpty(row?.start_time),
    endTime: formatTime24hOrEmpty(row?.end_time),
    servicesExecuted: row?.services_executed || '',
    geotestSignature: row?.geotest_signature || '',
    geotestSignatureImage: row?.geotest_signature_url || '',
    geotestCpf: row?.geotest_signature_cpf || '',
    responsibleSignature: row?.responsible_signature || '',
    responsibleSignatureImage: row?.responsible_signature_url || '',
    responsibleSignedAt: row?.responsible_signed_at || '',
    responsibleSignedBy: row?.responsible_signed_by || '',
    responsibleCpf: row?.responsible_signed_cpf || '',
    signatureStatus: row?.signature_status || (row?.responsible_signature_url ? 'signed' : 'pending'),
    observations: row?.observations || '',
    createdBy: '',
    createdAt: row?.created_at || '',
  };
};

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const PublicDiarySignature: React.FC<PublicDiarySignatureProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<any | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerCpf, setSignerCpf] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const callGetDiaryRpc = useCallback(async (signatureToken: string) => {
    const attempts: Array<Record<string, any>> = [
      { p_token: signatureToken },
      { token: signatureToken },
    ];

    let lastError: any = null;

    for (const params of attempts) {
      const { data, error } = await supabase.rpc('get_diary_for_public_signature', params);
      if (!error) return data;

      lastError = error;
      const msg = String(error?.message || '').toLowerCase();
      const looksLikeSignatureMismatch =
        msg.includes('could not find the function') ||
        msg.includes('not found') ||
        msg.includes('pgrst202');

      if (!looksLikeSignatureMismatch) break;
    }

    throw lastError || new Error('Erro ao chamar get_diary_for_public_signature');
  }, []);

  const callSubmitSignatureRpc = useCallback(
    async (signatureToken: string, signerNameInput: string, signerCpfInput: string, signatureData: string) => {
      const attempts: Array<Record<string, any>> = [
        {
          p_token: signatureToken,
          p_signer_name: signerNameInput,
          p_signer_cpf: signerCpfInput,
          p_signature_data: signatureData,
        },
        {
          token: signatureToken,
          signer_name: signerNameInput,
          signer_cpf: signerCpfInput,
          signature_data: signatureData,
        },
      ];

      let lastError: any = null;

      for (const params of attempts) {
        const { data, error } = await supabase.rpc('submit_public_diary_signature', params);
        if (!error) return data;

        lastError = error;
        const msg = String(error?.message || '').toLowerCase();
        const looksLikeSignatureMismatch =
          msg.includes('could not find the function') ||
          msg.includes('not found') ||
          msg.includes('pgrst202');

        if (!looksLikeSignatureMismatch) break;
      }

      throw lastError || new Error('Erro ao chamar submit_public_diary_signature');
    },
    []
  );

  const fetchDiary = useCallback(async () => {
    if (!token) {
      setError('Link inválido.');
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Sistema indisponível no momento.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const data = await callGetDiaryRpc(token);
      if (!data?.valid) {
        const reason = data?.reason;
        if (reason === 'expired') setError('Este link de assinatura expirou.');
        else if (reason === 'revoked') setError('Este link de assinatura foi revogado.');
        else setError('Link de assinatura inválido.');
        setPayload(null);
        return;
      }

      setPayload(data);
      const diaryRow = data?.diary || {};
      setSignerName((diaryRow?.responsible_signed_by || '').trim());
      setSignerCpf((diaryRow?.responsible_signed_cpf || '').trim());
      setSignatureImage((diaryRow?.responsible_signature_url || '').trim());
    } catch (err) {
      console.error('Erro ao carregar diario publico para assinatura:', err);
      const msg = String((err as any)?.message || '').toLowerCase();
      const isRpcMissing = msg.includes('404') || msg.includes('not found') || msg.includes('could not find function');
      if (isRpcMissing) {
        setError('Função RPC de assinatura não encontrada. O administrador precisa executar o SQL de assinatura pública no Supabase.');
      } else {
        setError('Não foi possível carregar o diário para assinatura.');
      }
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [token, callGetDiaryRpc]);

  useEffect(() => {
    fetchDiary();
  }, [fetchDiary]);

  const diary = useMemo(() => mapDiaryFromRow(payload?.diary || {}), [payload]);
  const canSign = Boolean(payload?.can_sign);
  const alreadySigned = Boolean(payload?.already_signed || diary?.signatureStatus === 'signed');

  const handleSubmit = async () => {
    const name = signerName.trim();
    if (!name) {
      setError('Informe o nome de quem está assinando.');
      return;
    }
    if (!signatureImage.trim()) {
      setError('Desenhe e salve a assinatura antes de confirmar.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const data = await callSubmitSignatureRpc(token, name, signerCpf.trim(), signatureImage);
      if (!data?.ok) {
        if (data?.reason === 'already_signed') setError('Este diário já foi assinado.');
        else if (data?.reason === 'expired') setError('Este link expirou.');
        else if (data?.reason === 'invalid_token') setError('Link inválido.');
        else setError('Não foi possível concluir a assinatura.');
        return;
      }

      await fetchDiary();
    } catch (err) {
      console.error('Erro ao enviar assinatura publica:', err);
      const msg = String((err as any)?.message || '').toLowerCase();
      const isRpcMissing = msg.includes('404') || msg.includes('not found') || msg.includes('could not find function');
      if (isRpcMissing) {
        setError('Função RPC de assinatura não encontrada. O administrador precisa executar o SQL de assinatura pública no Supabase.');
      } else {
        setError('Erro ao confirmar assinatura. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Carregando diário para assinatura...</p>
        </div>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Link de assinatura indisponível</h1>
          <p className="text-sm text-gray-700 dark:text-gray-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-3 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-green-600" />
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Assinatura de diário</h1>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-200">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Data: {diary?.date ? new Date(diary.date).toLocaleDateString('pt-BR') : '-'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Horário: {diary?.startTime || '-'} - {diary?.endTime || '-'}
            </span>
            <span className="inline-flex items-center gap-1">
              <FileCheck2 className="w-4 h-4" />
              Cliente: {diary?.clientName || '-'}
            </span>
          </div>
          {payload?.expires_at && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Link válido até {new Date(payload.expires_at).toLocaleString('pt-BR')}.
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2 sm:p-3 overflow-x-auto">
          <div className="min-w-[920px]">
            <DiaryPDFLayout
              diary={diary}
              pceDetail={payload?.pceDetail || undefined}
              pcePiles={payload?.pcePiles || []}
              pitDetail={payload?.pitDetail || undefined}
              pitPiles={payload?.pitPiles || []}
              placaDetail={payload?.placaDetail || undefined}
              placaPiles={payload?.placaPiles || []}
              fichapdaDetail={payload?.fichapdaDetail || undefined}
              pdaDiarioDetail={payload?.pdaDiarioDetail || undefined}
              pdaDiarioPiles={payload?.pdaDiarioPiles || []}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-6">
          {alreadySigned && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Este diário já foi assinado.
            </div>
          )}

          {!alreadySigned && canSign && (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Assinatura do cliente</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome do assinante</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">CPF (opcional)</label>
                  <input
                    type="text"
                    value={signerCpf}
                    onChange={(e) => setSignerCpf(formatCpf(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <SignaturePadFixed
                onSave={(data) => setSignatureImage(data)}
                onCancel={() => setSignatureImage('')}
                initialSignature={signatureImage || undefined}
              />

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !signerName.trim() || !signatureImage.trim()}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Confirmando assinatura...' : 'Confirmar assinatura do diário'}
                </button>
              </div>
            </>
          )}

          {!alreadySigned && !canSign && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              Este link não está mais disponível para assinatura.
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
