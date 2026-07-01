import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, FileText, LogOut, ShieldCheck, ChevronLeft, ChevronRight, PenLine, CheckCircle2,
  Calendar, Download, FolderOpen, ListChecks, Camera, X, AlertTriangle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { SignaturePadFixed } from './SignaturePadFixed';
import { DiaryPdfPreview } from './DiaryPdfPreview';
import { diaryPdfBlobUrl } from '../utils/diaryPdf';
import { formatTime24hOrEmpty } from '../utils/time';

const TOKEN_KEY = 'portalToken';

const CATEGORY_LABELS: Record<string, string> = {
  contrato: 'Contrato', dados_cliente: 'Dados do Cliente', sondagem: 'Sondagem',
  projetos: 'Projetos', diarios: 'Diários de Obra', medicoes: 'Medições',
  relatorio: 'Relatório', art: 'ART', outro: 'Outro',
};
const docLabel = (cat: string, custom?: string | null) =>
  cat === 'outro' ? (custom?.trim() || 'Outro') : (CATEGORY_LABELS[cat] || cat);

const formatCpf = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const mapDiaryRow = (row: any) => ({
  id: row?.id || '',
  clientId: row?.user_id || '',
  clientName: row?.client_name || '',
  address: row?.address || '-',
  enderecoDetalhado: row?.endereco_detalhado || undefined,
  team: row?.team || '',
  type: row?.diary_type || undefined,
  date: row?.date || '',
  startTime: formatTime24hOrEmpty(row?.start_time),
  endTime: formatTime24hOrEmpty(row?.end_time),
  servicesExecuted: row?.services_executed || '',
  geotestSignature: row?.geotest_signature || '',
  geotestSignatureImage: row?.geotest_signature_url || '',
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
});

export const ClientPortal: React.FC = () => {
  const [token, setToken] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token') || '';
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
      return urlToken;
    }
    return localStorage.getItem(TOKEN_KEY) || '';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [clientName, setClientName] = useState('');
  const [selectedObra, setSelectedObra] = useState<string | null>(null);

  // signing state
  const [signTarget, setSignTarget] = useState<{ kind: 'diary' | 'document'; id: string; title: string; diaryRow?: any } | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerCpf, setSignerCpf] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // checklist fill/sign state
  const [checklistFill, setChecklistFill] = useState<{ checklist: any; items: any[] } | null>(null);
  const [clSignerName, setClSignerName] = useState('');
  const [clSignerCpf, setClSignerCpf] = useState('');
  const [clSignature, setClSignature] = useState('');
  const [clSubmitting, setClSubmitting] = useState(false);
  const [clError, setClError] = useState('');
  const [viewChecklist, setViewChecklist] = useState<any | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(''); setData(null); setSelectedObra(null);
  }, []);

  const loadData = useCallback(async (t: string) => {
    if (!isSupabaseConfigured) { setLoginError('Sistema indisponível.'); return; }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('portal_get_data', { p_token: t });
      if (error) throw error;
      if (!res?.valid) {
        setLoginError('Link invalido ou expirado. Solicite um novo acesso.');
        logout();
        return;
      }
      setData(res);
      setClientName(res.client_name || '');
    } catch (err) {
      console.error('portal_get_data', err);
      setLoginError('Nao foi possivel carregar o portal. Tente novamente.');
      logout();
    } finally { setLoading(false); }
  }, [logout]);

  useEffect(() => { if (token) loadData(token); }, [token, loadData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!username.trim() || !password) { setLoginError('Informe usuário e senha.'); return; }
    if (!isSupabaseConfigured) { setLoginError('Sistema indisponível.'); return; }
    try {
      setLoginLoading(true);
      const { data: res, error } = await supabase.rpc('portal_login', {
        p_email: username.trim().toLowerCase(),
        p_password: password,
      });
      if (error) throw error;
      if (!res?.ok) {
        setLoginError(res?.reason === 'invalid_or_inactive' ? 'Acesso inativo ou inexistente.' : 'Usuário ou senha inválidos.');
        return;
      }
      localStorage.setItem(TOKEN_KEY, res.token);
      setClientName(res.client_name || '');
      setToken(res.token);
      setPassword('');
    } catch (err) {
      console.error('portal_login', err);
      setLoginError('Não foi possível entrar. Tente novamente.');
    } finally { setLoginLoading(false); }
  };

  const obras: any[] = data?.obras || [];
  const obra = useMemo(() => obras.find(o => o.id === selectedObra) || null, [obras, selectedObra]);
  const totals = useMemo(() => {
    const diaries = obras.reduce((acc, o) => acc + (o.diaries?.length || 0), 0);
    const docs = obras.reduce((acc, o) => acc + (o.documents?.length || 0), 0);
    const pending = obras.reduce((acc, o) => acc
      + (o.diaries || []).filter((d: any) => (d.signature_status || 'pending') !== 'signed').length
      + (o.documents || []).filter((d: any) => d.requires_signature && d.signature_status !== 'signed').length, 0);
    return { diaries, docs, pending };
  }, [obras]);

  // diary preview for signing
  useEffect(() => {
    if (!signTarget || signTarget.kind !== 'diary' || !signTarget.diaryRow) {
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return ''; });
      return;
    }
    let active = true;
    diaryPdfBlobUrl({ diary: mapDiaryRow(signTarget.diaryRow) })
      .then(url => { if (!active) { URL.revokeObjectURL(url); return; } setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; }); })
      .catch(e => console.error('preview', e));
    return () => { active = false; };
  }, [signTarget]);

  const openSign = (target: { kind: 'diary' | 'document'; id: string; title: string; diaryRow?: any }) => {
    setSignTarget(target);
    setSignerName(clientName || '');
    setSignerCpf('');
    setSignatureImage('');
  };

  const submitSignature = async () => {
    if (!signTarget) return;
    if (!signerName.trim()) { return; }
    if (!signatureImage.trim()) { return; }
    try {
      setSubmitting(true);
      const fn = signTarget.kind === 'diary' ? 'portal_sign_diary' : 'portal_sign_document';
      const params = signTarget.kind === 'diary'
        ? { p_token: token, p_diary_id: signTarget.id, p_signer_name: signerName.trim(), p_signer_cpf: signerCpf.trim(), p_signature_data: signatureImage }
        : { p_token: token, p_doc_id: signTarget.id, p_signer_name: signerName.trim(), p_signer_cpf: signerCpf.trim(), p_signature_data: signatureImage };
      const { data: res, error } = await supabase.rpc(fn, params);
      if (error) throw error;
      if (!res?.ok) throw new Error(res?.reason || 'falha');
      setSignTarget(null);
      await loadData(token);
    } catch (err) {
      console.error('sign', err);
    } finally { setSubmitting(false); }
  };

  // ---------- CHECKLIST ----------
  const openChecklistFill = (checklist: any) => {
    setChecklistFill({ checklist, items: (checklist.items || []).map((it: any) => ({ ...it })) });
    setClSignerName(clientName || '');
    setClSignerCpf('');
    setClSignature('');
    setClError('');
  };

  const updateChecklistItem = (id: string, patch: Partial<{ checked: boolean; photo_data: string; note: string }>) => {
    setChecklistFill(prev => prev ? { ...prev, items: prev.items.map((it: any) => it.id === id ? { ...it, ...patch } : it) } : prev);
  };

  const handleChecklistPhoto = (id: string, file: File | null) => {
    if (!file) { updateChecklistItem(id, { photo_data: '' }); return; }
    if (file.size > 4 * 1024 * 1024) { setClError('Foto muito grande (máx. 4MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => updateChecklistItem(id, { photo_data: String(reader.result || '') });
    reader.readAsDataURL(file);
  };

  const checklistMissing = useMemo(() => {
    if (!checklistFill) return { required: 0, photo: 0 };
    const items = checklistFill.items;
    return {
      required: items.filter((it: any) => it.required && !it.checked).length,
      photo: items.filter((it: any) => it.requires_photo && !it.photo_data).length,
    };
  }, [checklistFill]);

  const canSubmitChecklist = checklistFill && checklistMissing.required === 0 && checklistMissing.photo === 0;

  const submitChecklist = async () => {
    if (!checklistFill || !canSubmitChecklist) return;
    if (!clSignerName.trim()) { setClError('Informe seu nome.'); return; }
    if (!clSignature.trim()) { setClError('Assine para concluir.'); return; }
    try {
      setClSubmitting(true);
      setClError('');
      const payload = checklistFill.items.map((it: any) => ({ id: it.id, checked: !!it.checked, photo_data: it.photo_data || '', note: it.note || '' }));
      const { data: res, error } = await supabase.rpc('portal_submit_checklist', {
        p_token: token,
        p_checklist_id: checklistFill.checklist.id,
        p_items: payload,
        p_signer_name: clSignerName.trim(),
        p_signer_cpf: clSignerCpf.trim(),
        p_signature_data: clSignature,
      });
      if (error) throw error;
      if (!res?.ok) {
        const reasons: Record<string, string> = {
          missing_required: 'Ainda há itens obrigatórios não marcados.',
          missing_photo: 'Ainda falta anexar foto em algum item.',
          already_completed: 'Este checklist já foi concluído.',
        };
        setClError(reasons[res?.reason] || 'Não foi possível concluir o checklist.');
        return;
      }
      setChecklistFill(null);
      await loadData(token);
    } catch (err) {
      console.error('checklist submit', err);
      setClError('Não foi possível concluir o checklist.');
    } finally { setClSubmitting(false); }
  };

  // ---------- LOGIN SCREEN ----------
  if (!token) {
    return (
      <div className="min-h-screen bg-[#eaf1ee] dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="w-[calc(100vw-2rem)] max-w-[1060px] min-w-0 grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
          <div className="min-w-0 bg-emerald-950 text-white p-6 sm:p-10 flex flex-col justify-between min-h-[420px]">
            <div>
              <div className="inline-flex rounded-xl bg-white p-2 shadow-sm mb-8">
                <img src="/logogeoteste.png" alt="Geoteste" className="h-12 w-12 object-contain" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Portal do Cliente</p>
              <h1 className="mt-3 max-w-[17rem] sm:max-w-xl break-words text-2xl sm:text-4xl font-bold leading-tight">Acompanhe sua obra em tempo real</h1>
              <p className="mt-4 max-w-[17rem] sm:max-w-lg break-words text-sm sm:text-base leading-7 text-emerald-50/85">
                Consulte diários, documentos técnicos, pendências de assinatura e atualizações liberadas pela equipe Geoteste em um ambiente seguro.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="w-full max-w-[17rem] sm:max-w-none rounded-lg bg-white/10 p-4 min-w-0"><p className="text-lg font-bold">Obras</p><p className="text-[12px] text-emerald-100">Status e histórico centralizados</p></div>
              <div className="w-full max-w-[17rem] sm:max-w-none rounded-lg bg-white/10 p-4 min-w-0"><p className="text-lg font-bold">Documentos</p><p className="text-[12px] text-emerald-100">Arquivos técnicos organizados</p></div>
              <div className="w-full max-w-[17rem] sm:max-w-none rounded-lg bg-white/10 p-4 min-w-0"><p className="text-lg font-bold">Assinaturas</p><p className="text-[12px] text-emerald-100">Pendências claras e seguras</p></div>
            </div>
          </div>
          <div className="min-w-0 p-6 sm:p-10 flex items-center">
            <form onSubmit={handleLogin} className="w-full space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Acessar portal</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Use o usuário e a senha enviados pela Geoteste.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Usuário</label>
                <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-3 text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="Digite seu usuário" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Senha</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-3 text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" placeholder="Digite sua senha" />
              </div>
              {loginError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loginError}</div>}
              <button type="submit" disabled={loginLoading} className="w-full rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50">
                {loginLoading ? 'Entrando...' : 'Entrar no portal'}
              </button>
              <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1"><ShieldCheck className="h-3 w-3" /> Acesso seguro e individual</p>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---------- PORTAL ----------
  return (
    <div className="min-h-screen bg-[#eef3f1] dark:bg-gray-950">
      <header className="bg-emerald-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-xl bg-white p-1.5 flex-shrink-0"><img src="/logogeoteste.png" alt="Geoteste" className="h-9 w-9 object-contain" /></div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-100">Portal do Cliente</p>
                <h1 className="text-xl font-bold leading-tight truncate">{clientName || 'Minhas obras'}</h1>
              </div>
            </div>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm rounded-lg bg-white/10 px-3 py-2 hover:bg-white/20"><LogOut className="h-4 w-4" /> Sair</button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg bg-white/10 px-3 py-3">
              <p className="text-2xl font-bold">{obras.length}</p>
              <p className="text-[11px] uppercase tracking-wide text-emerald-100">Obras</p>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-3">
              <p className="text-2xl font-bold">{totals.docs + totals.diaries}</p>
              <p className="text-[11px] uppercase tracking-wide text-emerald-100">Arquivos</p>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-3">
              <p className="text-2xl font-bold">{totals.pending}</p>
              <p className="text-[11px] uppercase tracking-wide text-emerald-100">Pendências</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading && <p className="text-sm text-gray-500">Carregando...</p>}

        {!loading && !obra && (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Suas obras</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Selecione uma obra para consultar documentos, diários e assinaturas.</p>
            </div>
            {obras.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-500">
                Nenhuma obra disponível ainda.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {obras.map(o => {
                  const diaries = o.diaries || [];
                  const docs = o.documents || [];
                  const pending = diaries.filter((d: any) => (d.signature_status || 'pending') !== 'signed').length
                    + docs.filter((d: any) => d.requires_signature && d.signature_status !== 'signed').length;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setSelectedObra(o.id)}
                      className="group relative text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 pr-14 transition-all duration-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100 dark:hover:shadow-emerald-950/40 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 cursor-pointer"
                    >
                      <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-emerald-400/0 group-hover:ring-emerald-400/40 transition-all duration-200" />
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-emerald-600">
                          <Building2 className="text-emerald-600 dark:text-emerald-400 w-5 h-5 transition-colors group-hover:text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{o.obra_code ? `${o.obra_code} — ` : ''}{o.name}</h3>
                          {o.address && <p className="text-xs text-gray-500 mt-0.5 truncate">{o.address}</p>}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">{diaries.length} diário(s)</span>
                            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">{docs.length} documento(s)</span>
                            {pending > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-[11px] font-semibold"><PenLine className="h-3 w-3" /> {pending} p/ assinar</span>}
                            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 opacity-70 group-hover:opacity-100 transition-opacity">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              </span>
                              Clique para acessar
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-all duration-200 group-hover:bg-emerald-600 group-hover:text-white group-hover:translate-x-1">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!loading && obra && (
          <>
            <button onClick={() => setSelectedObra(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-300 hover:underline"><ChevronLeft className="h-4 w-4" /> Voltar às obras</button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{obra.obra_code ? `${obra.obra_code} — ` : ''}{obra.name}</h2>
            {obra.address && <p className="text-sm text-gray-500 mb-5">{obra.address}</p>}

            {/* Checklists */}
            {(obra.checklists || []).length > 0 && (
              <section className="mb-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2"><ListChecks className="h-4 w-4" /> Checklists</h3>
                <div className="space-y-2">
                  {(obra.checklists || []).map((c: any) => {
                    const items = c.items || [];
                    const done = items.filter((it: any) => it.checked).length;
                    const completed = c.status === 'completed';
                    return (
                      <div key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
                        <ListChecks className={`h-4 w-4 flex-shrink-0 ${completed ? 'text-emerald-600' : 'text-amber-500'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.title}</p>
                          <p className="text-xs text-gray-500">{done}/{items.length} itens marcados</p>
                        </div>
                        {completed ? (
                          <button onClick={() => setViewChecklist(c)} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Concluído</button>
                        ) : (
                          <button onClick={() => openChecklistFill(c)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">Preencher</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Diaries */}
            <section className="mb-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Diários de obra</h3>
              {(obra.diaries || []).length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum diário.</p>
              ) : (
                <div className="space-y-2">
                  {(obra.diaries || []).map((d: any) => {
                    const signed = (d.signature_status || 'pending') === 'signed';
                    return (
                      <div key={d.id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{d.diary_type || 'Diário'} · {d.date ? new Date(d.date).toLocaleDateString('pt-BR') : '-'}</p>
                          <p className="text-xs text-gray-500 truncate">{d.services_executed || d.team || ''}</p>
                        </div>
                        {signed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Assinado</span>
                        ) : (
                          <button onClick={() => openSign({ kind: 'diary', id: d.id, title: 'Diário', diaryRow: d })} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">Assinar</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Documents */}
            <section>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Documentos</h3>
              {(obra.documents || []).length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum documento.</p>
              ) : (
                <div className="space-y-2">
                  {(obra.documents || []).map((d: any) => {
                    const needSign = d.requires_signature && d.signature_status !== 'signed';
                    return (
                      <div key={d.id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{d.title}</p>
                          <p className="text-xs text-gray-500">{docLabel(d.category, d.custom_label)}</p>
                        </div>
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 hover:underline"><Download className="h-4 w-4" /> Abrir</a>
                        {d.requires_signature && (d.signature_status === 'signed'
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Assinado</span>
                          : <button onClick={() => openSign({ kind: 'document', id: d.id, title: d.title })} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">Assinar</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Sign modal */}
      {signTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setSignTarget(null)}>
          <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><PenLine className="h-5 w-5" /></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assinar {signTarget.kind === 'diary' ? 'diário' : 'documento'}</h3>
            </div>

            {signTarget.kind === 'diary' && previewUrl && (
              <div className="mb-4 rounded-xl bg-slate-100 dark:bg-gray-800 p-2"><DiaryPdfPreview url={previewUrl} /></div>
            )}

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

            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
              <button onClick={() => setSignTarget(null)} className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200">Cancelar</button>
              <button onClick={submitSignature} disabled={submitting || !signerName.trim() || !signatureImage.trim()} className="rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                {submitting ? 'Confirmando...' : 'Confirmar assinatura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist fill + sign modal */}
      {checklistFill && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setChecklistFill(null)}>
          <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"><ListChecks className="h-5 w-5" /></div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{checklistFill.checklist.title}</h3>
              </div>
              <button onClick={() => setChecklistFill(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-2 mb-4">
              {checklistFill.items.map((it: any) => (
                <div key={it.id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={!!it.checked} onChange={e => updateChecklistItem(it.id, { checked: e.target.checked })} className="mt-0.5 h-4 w-4 rounded text-emerald-600" />
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
                          <button type="button" onClick={() => updateChecklistItem(it.id, { photo_data: '' })} className="text-xs text-red-600 hover:underline">Remover foto</button>
                        </div>
                      ) : (
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => handleChecklistPhoto(it.id, e.target.files?.[0] || null)} className="text-xs text-gray-600 dark:text-gray-300 file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-2.5 file:py-1.5 file:text-white file:text-xs" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {(checklistMissing.required > 0 || checklistMissing.photo > 0) && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {checklistMissing.required > 0 && `${checklistMissing.required} item(ns) obrigatório(s) não marcado(s). `}
                  {checklistMissing.photo > 0 && `${checklistMissing.photo} foto(s) pendente(s). `}
                  Não é possível concluir enquanto isso não for resolvido.
                </span>
              </div>
            )}

            <div className={!canSubmitChecklist ? 'pointer-events-none opacity-40' : ''}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome do assinante</label>
                  <input value={clSignerName} onChange={e => setClSignerName(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-3 text-gray-900 dark:text-gray-100" placeholder="Nome completo" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">CPF</label>
                  <input value={clSignerCpf} onChange={e => setClSignerCpf(formatCpf(e.target.value))} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-3 text-gray-900 dark:text-gray-100" placeholder="000.000.000-00" />
                </div>
              </div>
              <SignaturePadFixed onSave={(d) => setClSignature(d)} onCancel={() => setClSignature('')} initialSignature={clSignature || undefined} compact />
            </div>

            {clError && <p className="mt-3 text-sm text-red-600">{clError}</p>}

            <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
              <button onClick={() => setChecklistFill(null)} className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200">Cancelar</button>
              <button onClick={submitChecklist} disabled={clSubmitting || !canSubmitChecklist || !clSignerName.trim() || !clSignature.trim()} className="rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                {clSubmitting ? 'Confirmando...' : 'Assinar e concluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist view (read-only) modal */}
      {viewChecklist && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && setViewChecklist(null)}>
          <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-gray-900 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{viewChecklist.title}</h3>
              <button onClick={() => setViewChecklist(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2 mb-4">
              {(viewChecklist.items || []).map((it: any) => (
                <div key={it.id} className="flex items-start gap-2.5 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                  <CheckCircle2 className={`h-4 w-4 flex-shrink-0 mt-0.5 ${it.checked ? 'text-emerald-600' : 'text-gray-300'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-white">{it.text}</p>
                    {it.photo_data && <img src={it.photo_data} alt="Foto anexada" className="mt-2 h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-800" />}
                  </div>
                </div>
              ))}
            </div>
            {viewChecklist.signature_url && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Assinado por {viewChecklist.signed_by || '—'} em {viewChecklist.signed_at ? new Date(viewChecklist.signed_at).toLocaleString('pt-BR') : '—'}</p>
                <img src={viewChecklist.signature_url} alt="Assinatura" className="max-h-24 rounded-lg border border-gray-200 dark:border-gray-800 bg-white" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
