import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, FileCheck2, PenLine, ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { SignaturePadFixed } from './SignaturePadFixed';
import { DiaryPdfPreview } from './DiaryPdfPreview';
import { formatTime24hOrEmpty } from '../utils/time';
import { diaryPdfBlobUrl } from '../utils/diaryPdf';

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
    weather_ensolarado: !!row?.weather_ensolarado,
    weather_chuva_fraca: !!row?.weather_chuva_fraca,
    weather_chuva_forte: !!row?.weather_chuva_forte,
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
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

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

  useEffect(() => {
    if (!payload?.valid) {
      setPreviewUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return '';
      });
      return;
    }

    let active = true;
    setPreviewLoading(true);

    diaryPdfBlobUrl({
      diary,
      pceDetail: payload?.pceDetail || undefined,
      pcePiles: payload?.pcePiles || [],
      pitDetail: payload?.pitDetail || undefined,
      pitPiles: payload?.pitPiles || [],
      placaDetail: payload?.placaDetail || undefined,
      placaPiles: payload?.placaPiles || [],
      fichapdaDetail: payload?.fichapdaDetail || undefined,
      pdaDiarioDetail: payload?.pdaDiarioDetail || undefined,
      pdaDiarioPiles: payload?.pdaDiarioPiles || [],
    })
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        setPreviewUrl((previousUrl) => {
          if (previousUrl) URL.revokeObjectURL(previousUrl);
          return url;
        });
      })
      .catch((previewError) => {
        console.error('Erro ao gerar visualizacao publica do diario:', previewError);
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [diary, payload]);

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
    <div className="min-h-screen bg-[#f3f7f5] dark:bg-gray-950 py-5 sm:py-8 px-3 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 text-white shadow-lg shadow-emerald-900/10">
          <div className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  <img src="/logogeoteste.png" alt="Geoteste" className="h-10 w-10 object-contain" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Geoteste</p>
                  <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Revisão e assinatura</h1>
                  <p className="mt-2 max-w-xl text-sm text-emerald-50/90">
                    Confira o diário abaixo e confirme a assinatura do responsável.
                  </p>
                </div>
              </div>
              <div className="inline-flex self-start items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur">
                <ShieldCheck className="h-4 w-4" />
                Link seguro
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/15">
            <div className="flex items-center gap-3 bg-emerald-950/20 px-5 py-3.5">
              <Calendar className="h-4 w-4 text-emerald-100" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-100/70">Data</p>
                <p className="text-sm font-medium">{diary?.date ? new Date(diary.date).toLocaleDateString('pt-BR') : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-emerald-950/20 px-5 py-3.5">
              <Clock className="h-4 w-4 text-emerald-100" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-emerald-100/70">Horário</p>
                <p className="text-sm font-medium">{diary?.startTime || '-'} - {diary?.endTime || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-emerald-950/20 px-5 py-3.5">
              <FileCheck2 className="h-4 w-4 text-emerald-100" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-emerald-100/70">Cliente</p>
                <p className="truncate text-sm font-medium">{diary?.clientName || '-'}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-gray-200/80 bg-white p-3 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Etapa 1</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Revise o diário de obra</h2>
            </div>
            {payload?.expires_at && (
              <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">
                Válido até {new Date(payload.expires_at).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <div className="rounded-xl bg-slate-100 p-2 sm:p-3 dark:bg-gray-800">
          {previewUrl ? (
            <DiaryPdfPreview url={previewUrl} />
          ) : (
            <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
              {previewLoading ? 'Gerando visualização atual do diário...' : 'Visualização indisponível.'}
            </div>
          )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200/80 bg-white p-5 sm:p-7 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {alreadySigned && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Este diário já foi assinado.
            </div>
          )}

          {!alreadySigned && canSign && (
            <>
              <div className="mb-5 flex items-start gap-3 border-b border-gray-100 pb-5 dark:border-gray-800">
                <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <PenLine className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Etapa 2</p>
                  <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">Assinatura do responsável</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Informe seus dados e assine para concluir.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome do assinante</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">CPF</label>
                  <input
                    type="text"
                    value={signerCpf}
                    onChange={(e) => setSignerCpf(formatCpf(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-3 text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>

              <SignaturePadFixed
                onSave={(data) => setSignatureImage(data)}
                onCancel={() => setSignatureImage('')}
                initialSignature={signatureImage || undefined}
                compact
              />

              <div className="mt-5 flex justify-end border-t border-gray-100 pt-5 dark:border-gray-800">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !signerName.trim() || !signatureImage.trim()}
                  className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
        </section>
      </div>
    </div>
  );
};
