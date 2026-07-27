import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListChecks, Camera, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { SignaturePadFixed } from './SignaturePadFixed';

interface PublicChecklistFillProps {
  token: string;
}

const formatCpf = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

export const PublicChecklistFill: React.FC<PublicChecklistFillProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checklist, setChecklist] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [signerName, setSignerName] = useState('');
  const [signerCpf, setSignerCpf] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchChecklist = useCallback(async () => {
    if (!token) { setError('Link inválido.'); setLoading(false); return; }
    if (!isSupabaseConfigured) { setError('Sistema indisponível no momento.'); setLoading(false); return; }
    try {
      setLoading(true);
      setError('');
      const { data, error: rpcError } = await supabase.rpc('get_checklist_for_public_link', { p_token: token });
      if (rpcError) throw rpcError;
      if (!data?.valid) {
        const reason = data?.reason;
        if (reason === 'expired') setError('Este link expirou.');
        else if (reason === 'revoked') setError('Este link foi revogado.');
        else setError('Link inválido.');
        setChecklist(null);
        return;
      }
      setChecklist(data.checklist);
      setItems((data.checklist.items || []).map((it: any) => ({ ...it })));
    } catch (err) {
      console.error('get_checklist_for_public_link', err);
      setError('Não foi possível carregar o checklist.');
      setChecklist(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchChecklist(); }, [fetchChecklist]);

  const updateItem = (id: string, patch: Partial<{ checked: boolean; photo_data: string; note: string }>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const handlePhoto = (id: string, file: File | null) => {
    if (!file) { updateItem(id, { photo_data: '' }); return; }
    if (file.size > 4 * 1024 * 1024) { setSubmitError('Foto muito grande (máx. 4MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => updateItem(id, { photo_data: String(reader.result || '') });
    reader.readAsDataURL(file);
  };

  // autosave: salva a cada mudança, assim o cliente pode voltar depois com o mesmo link
  const autosaveSkip = useRef(true);
  useEffect(() => {
    if (checklist) autosaveSkip.current = true;
  }, [checklist?.id]);
  useEffect(() => {
    if (!checklist || checklist.status === 'completed') return;
    if (autosaveSkip.current) { autosaveSkip.current = false; return; }
    const handle = setTimeout(() => {
      const payload = items.map(it => ({ id: it.id, checked: !!it.checked, photo_data: it.photo_data || '', note: it.note || '' }));
      supabase.rpc('save_public_checklist_progress', { p_token: token, p_items: payload })
        .then(({ error: saveError }) => { if (saveError) console.error('checklist autosave', saveError); });
    }, 800);
    return () => clearTimeout(handle);
  }, [items, checklist, token]);

  const missing = useMemo(() => ({
    required: items.filter(it => it.required && !it.checked).length,
    photo: items.filter(it => it.requires_photo && !it.photo_data).length,
  }), [items]);
  const canSubmit = missing.required === 0 && missing.photo === 0;

  const alreadyCompleted = checklist?.status === 'completed';

  const handleSubmit = async () => {
    if (!signerName.trim()) { setSubmitError('Informe seu nome.'); return; }
    if (!signatureImage.trim()) { setSubmitError('Desenhe e salve a assinatura.'); return; }
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setSubmitError('');
      const payload = items.map(it => ({ id: it.id, checked: !!it.checked, photo_data: it.photo_data || '', note: it.note || '' }));
      const { data, error: rpcError } = await supabase.rpc('submit_public_checklist', {
        p_token: token,
        p_items: payload,
        p_signer_name: signerName.trim(),
        p_signer_cpf: signerCpf.trim(),
        p_signature_data: signatureImage,
      });
      if (rpcError) throw rpcError;
      if (!data?.ok) {
        const reasons: Record<string, string> = {
          expired: 'Este link expirou.',
          already_completed: 'Este checklist já foi concluído.',
          missing_required: 'Ainda há itens obrigatórios não marcados.',
          missing_photo: 'Ainda há fotos pendentes.',
          invalid_token: 'Link inválido.',
        };
        setSubmitError(reasons[data?.reason] || 'Não foi possível concluir o checklist.');
        return;
      }
      await fetchChecklist();
    } catch (err) {
      console.error('submit_public_checklist', err);
      setSubmitError('Não foi possível concluir o checklist.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Carregando checklist...</p>
        </div>
      </div>
    );
  }

  if (error && !checklist) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Link indisponível</h1>
          <p className="text-sm text-gray-700 dark:text-gray-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f7f5] dark:bg-gray-950 py-5 sm:py-8 px-3 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 text-white shadow-lg shadow-emerald-900/10">
          <div className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  <img src="/logogeoteste.png" alt="Geoteste" className="h-10 w-10 object-contain" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Geoteste</p>
                  <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">{checklist?.title}</h1>
                  <p className="mt-2 max-w-xl text-sm text-emerald-50/90">
                    {checklist?.client_name} • {checklist?.obra_name}
                  </p>
                </div>
              </div>
              <div className="inline-flex self-start items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur">
                <ShieldCheck className="h-4 w-4" />
                Link seguro
              </div>
            </div>
          </div>
        </header>

        {alreadyCompleted ? (
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Checklist já concluído</h2>
            <p className="text-sm text-gray-500 mt-1">Assinado por {checklist?.signed_by || '—'} em {checklist?.signed_at ? new Date(checklist.signed_at).toLocaleString('pt-BR') : '—'}</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><ListChecks className="h-5 w-5" /></div>
              <p className="text-sm text-gray-500">Marque os itens, anexe fotos quando exigido e assine no final. Seu progresso é salvo automaticamente.</p>
            </div>

            <div className="space-y-2 mb-4">
              {items.map(it => (
                <div key={it.id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={!!it.checked} onChange={e => updateItem(it.id, { checked: e.target.checked })} className="mt-0.5 h-4 w-4 rounded text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">{it.text}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {it.required && <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">OBRIGATÓRIO</span>}
                        {it.requires_photo && <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1"><Camera className="h-3 w-3" /> Exige foto</span>}
                      </div>
                    </div>
                  </label>
                  {it.requires_photo && (
                    <div className="mt-2 ml-6">
                      {it.photo_data ? (
                        <div className="flex items-center gap-2">
                          <img src={it.photo_data} alt="Foto anexada" className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-800" />
                          <button type="button" onClick={() => updateItem(it.id, { photo_data: '' })} className="text-xs text-red-600 hover:underline">Remover foto</button>
                        </div>
                      ) : (
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handlePhoto(it.id, e.target.files?.[0] || null)} className="text-xs text-gray-600 dark:text-gray-300 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-2.5 file:py-1.5 file:text-white file:text-xs" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(missing.required > 0 || missing.photo > 0) && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {missing.required > 0 && `${missing.required} item(ns) obrigatório(s) não marcado(s). `}
                  {missing.photo > 0 && `${missing.photo} foto(s) pendente(s). `}
                  Não é possível concluir enquanto isso não for resolvido.
                </span>
              </div>
            )}

            <div className={!canSubmit ? 'pointer-events-none opacity-40' : ''}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome do assinante</label>
                  <input value={signerName} onChange={e => setSignerName(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-3 text-gray-900 dark:text-gray-100" placeholder="Nome completo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">CPF</label>
                  <input value={signerCpf} onChange={e => setSignerCpf(formatCpf(e.target.value))} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-3 text-gray-900 dark:text-gray-100" placeholder="000.000.000-00" />
                </div>
              </div>

              <SignaturePadFixed onSave={(d) => setSignatureImage(d)} onCancel={() => setSignatureImage('')} initialSignature={signatureImage || undefined} compact />
            </div>

            {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}

            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
              <button onClick={handleSubmit} disabled={submitting || !canSubmit || !signerName.trim() || !signatureImage.trim()} className="rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                {submitting ? 'Enviando...' : 'Concluir e assinar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
