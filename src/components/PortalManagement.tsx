import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, Building2, Edit, Trash2, Link as LinkIcon, KeyRound, Upload, FileText,
  CheckCircle2, XCircle, ChevronDown, ChevronRight, Paperclip, PenLine, Calendar, Image as ImageIcon, Lock,
  ClipboardList, ListChecks, Camera, Eye, GripVertical,
} from 'lucide-react';
import { Client, Obra, ObraDocument, ObraDocumentCategory, PortalCredential, ChecklistTemplate, ChecklistTemplateItem, ObraChecklist, ObraChecklistItem } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from './ConfirmDialog';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { FilterBar, IconButton, Modal, PageHeader, StatusBadge, Surface } from './ui';
import { uploadPortalDoc, deletePortalDoc } from '../utils/portalDocStorage';

const CATEGORIES: { value: ObraDocumentCategory; label: string }[] = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'dados_cliente', label: 'Dados do Cliente' },
  { value: 'sondagem', label: 'Sondagem' },
  { value: 'projetos', label: 'Projetos' },
  { value: 'diarios', label: 'Diários de Obra' },
  { value: 'medicoes', label: 'Medições' },
  { value: 'relatorio', label: 'Relatório' },
  { value: 'art', label: 'ART' },
  { value: 'outro', label: 'Outro' },
];

const categoryLabel = (c: ObraDocumentCategory, custom?: string | null) =>
  c === 'outro' ? (custom?.trim() || 'Outro') : (CATEGORIES.find(x => x.value === c)?.label || c);

const isImage = (t?: string | null) => !!t && t.startsWith('image');

const buildPortalLink = (): string => {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  let url: URL;
  try {
    url = configured ? new URL(configured) : new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  } catch {
    url = new URL('/', window.location.origin);
  }
  url.searchParams.set('portal', '1');
  return url.toString();
};

const mapObra = (r: any): Obra => ({
  id: r.id, obraCode: r.obra_code, name: r.name, clientId: r.client_id,
  address: r.address, status: r.status, confidential: !!r.confidential,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapDoc = (r: any): ObraDocument => ({
  id: r.id, obraId: r.obra_id, category: r.category, customLabel: r.custom_label,
  title: r.title, fileUrl: r.file_url, fileType: r.file_type,
  requiresSignature: !!r.requires_signature, signatureUrl: r.signature_url,
  signedAt: r.signed_at, signedBy: r.signed_by, signedCpf: r.signed_cpf,
  signatureStatus: r.signature_status, createdAt: r.created_at,
});

const mapCred = (r: any): PortalCredential => ({
  id: r.id, clientId: r.client_id, email: r.email, active: !!r.active,
  createdAt: r.created_at, lastLoginAt: r.last_login_at,
});

const mapTemplateItem = (r: any): ChecklistTemplateItem => ({
  id: r.id, templateId: r.template_id, position: r.position, text: r.text,
  required: !!r.required, requiresPhoto: !!r.requires_photo,
});

const mapObraChecklistItem = (r: any): ObraChecklistItem => ({
  id: r.id, position: r.position, text: r.text, required: !!r.required,
  requiresPhoto: !!r.requires_photo, checked: !!r.checked,
  photoData: r.photo_data, note: r.note,
});

interface DiaryLite { id: string; date: string; diary_type: string; services: string; status: string; }

export const PortalManagement: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const [isSuper, setIsSuper] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [credentials, setCredentials] = useState<PortalCredential[]>([]);
  const [docsByObra, setDocsByObra] = useState<Record<string, ObraDocument[]>>({});
  const [diariesByObra, setDiariesByObra] = useState<Record<string, DiaryLite[]>>({});
  const [checklistsByObra, setChecklistsByObra] = useState<Record<string, ObraChecklist[]>>({});
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clientById = (id?: string | null) => clients.find(c => c.id === id);
  const clientName = (id?: string | null) => clientById(id)?.name || '—';
  const credByClient = (id?: string | null) => credentials.find(c => c.clientId === id);

  // ----- fetch -----
  const fetchAll = async () => {
    if (!isSupabaseConfigured) { toast.error('Supabase não configurado.'); return; }
    setLoading(true);
    try {
      const [c, o, cr] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('obras').select('*').order('created_at', { ascending: false }),
        supabase.from('portal_credentials').select('*').order('created_at', { ascending: false }),
      ]);
      if (c.error) throw c.error;
      if (o.error) throw o.error;
      if (cr.error) throw cr.error;
      setClients((c.data || []).map((r: any) => ({
        id: r.id, name: r.name || '', email: r.email || '', phone: r.phone || '',
        address: r.address || '', createdAt: r.created_at,
      })));
      setObras((o.data || []).map(mapObra));
      setCredentials((cr.data || []).map(mapCred));
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar dados do portal.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchTemplates = async () => {
    if (!isSupabaseConfigured) return;
    try {
      const [t, i] = await Promise.all([
        supabase.from('checklist_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('checklist_template_items').select('*').order('position'),
      ]);
      if (t.error) throw t.error;
      if (i.error) throw i.error;
      const items = (i.data || []).map(mapTemplateItem);
      setTemplates((t.data || []).map((r: any) => ({
        id: r.id, name: r.name, description: r.description, createdAt: r.created_at,
        items: items.filter(it => it.templateId === r.id),
      })));
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar modelos de checklist.');
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  // detecta ADM global (super admin)
  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) { setIsSuper(false); return; }
    supabase.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle()
      .then(({ data }) => setIsSuper(!!data?.is_super_admin));
  }, [user?.id]);

  const fetchDocs = async (obraId: string) => {
    const { data, error } = await supabase
      .from('obra_documents').select('*').eq('obra_id', obraId).order('created_at', { ascending: false });
    if (error) { toast.error('Falha ao carregar documentos.'); return; }
    setDocsByObra(prev => ({ ...prev, [obraId]: (data || []).map(mapDoc) }));
  };

  const fetchDiaries = async (obra: Obra) => {
    const sel = 'id,date,diary_type,services_executed,signature_status';
    const byObra = await supabase.from('work_diaries').select(sel).eq('obra_id', obra.id);
    const name = clientName(obra.clientId);
    const byName = name && name !== '—'
      ? await supabase.from('work_diaries').select(sel).is('obra_id', null).eq('client_name', name)
      : { data: [] as any[] };
    const rows = [...(byObra.data || []), ...((byName as any).data || [])];
    const seen = new Set<string>();
    const list: DiaryLite[] = [];
    rows.forEach((r: any) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      list.push({ id: r.id, date: r.date, diary_type: r.diary_type || 'Diário', services: r.services_executed || '', status: r.signature_status || 'pending' });
    });
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setDiariesByObra(prev => ({ ...prev, [obra.id]: list }));
  };

  const fetchChecklists = async (obraId: string) => {
    try {
      const c = await supabase.from('obra_checklists').select('*').eq('obra_id', obraId).order('created_at', { ascending: false });
      if (c.error) throw c.error;
      const ids = (c.data || []).map((r: any) => r.id);
      const i = ids.length
        ? await supabase.from('obra_checklist_items').select('*').in('checklist_id', ids).order('position')
        : { data: [] as any[], error: null };
      if (i.error) throw i.error;
      const list: ObraChecklist[] = (c.data || []).map((r: any) => ({
        id: r.id, obraId: r.obra_id, templateId: r.template_id, title: r.title, status: r.status,
        signatureUrl: r.signature_url, signedAt: r.signed_at, signedBy: r.signed_by, createdAt: r.created_at,
        items: (i.data || []).filter((it: any) => it.checklist_id === r.id).map(mapObraChecklistItem),
      }));
      setChecklistsByObra(prev => ({ ...prev, [obraId]: list }));
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar checklists.');
    }
  };

  const toggleExpand = (obra: Obra) => {
    const next = expanded === obra.id ? null : obra.id;
    setExpanded(next);
    if (next) {
      if (!docsByObra[next]) fetchDocs(next);
      if (!diariesByObra[next]) fetchDiaries(obra);
      if (!checklistsByObra[next]) fetchChecklists(next);
    }
  };

  // ----- Obra + Acesso modal (fluxo unificado) -----
  const [obraModal, setObraModal] = useState(false);
  const [editingObra, setEditingObra] = useState<Obra | null>(null);
  const [obraForm, setObraForm] = useState({ obra_code: '', name: '', client_id: '', address: '', status: 'ativa', confidential: false, username: '', password: '' });

  const openObraModal = (o?: Obra) => {
    if (o) {
      const cred = credByClient(o.clientId);
      setEditingObra(o);
      setObraForm({ obra_code: o.obraCode || '', name: o.name, client_id: o.clientId || '', address: o.address || '', status: o.status, confidential: !!o.confidential, username: cred?.email || '', password: '' });
    } else {
      setEditingObra(null);
      setObraForm({ obra_code: '', name: '', client_id: '', address: '', status: 'ativa', confidential: false, username: '', password: '' });
    }
    setObraModal(true);
  };

  const upsertCredential = async (clientId: string, username: string, password: string) => {
    const { data, error } = await supabase.rpc('portal_create_credential', {
      p_client_id: clientId, p_email: username.trim().toLowerCase(), p_password: password,
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || 'Falha no login');
    // garante 1 login ativo por cliente
    await Promise.all(
      credentials.filter(c => c.clientId === clientId && c.id !== data.id)
        .map(c => supabase.rpc('portal_set_active', { p_credential_id: c.id, p_active: false }))
    );
  };

  const saveObra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obraForm.name.trim()) { toast.error('Informe o nome da obra.'); return; }
    if (!obraForm.client_id) { toast.error('Selecione o cliente.'); return; }
    const wantsLogin = obraForm.username.trim() || obraForm.password;
    if (wantsLogin) {
      if (!obraForm.username.trim()) { toast.error('Informe o usuário do login.'); return; }
      if (obraForm.username.trim().includes(' ')) { toast.error('O usuário não pode ter espaços.'); return; }
      if (obraForm.password.length < 6) { toast.error('Senha mínima de 6 caracteres.'); return; }
    }
    const payload = {
      obra_code: obraForm.obra_code.trim() || null,
      name: obraForm.name.trim(),
      client_id: obraForm.client_id,
      address: obraForm.address.trim() || null,
      status: obraForm.status,
      confidential: isSuper ? obraForm.confidential : false,
    };
    try {
      setLoading(true);
      if (editingObra) {
        const { error } = await supabase.from('obras').update(payload).eq('id', editingObra.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('obras').insert(payload);
        if (error) throw error;
      }
      if (wantsLogin) await upsertCredential(obraForm.client_id, obraForm.username, obraForm.password);
      toast.success(editingObra ? 'Obra salva.' : 'Obra e acesso criados.');
      setObraModal(false);
      fetchAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Não foi possível salvar.');
    } finally { setLoading(false); }
  };

  const [confirmObra, setConfirmObra] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });
  const deleteObra = async () => {
    if (!confirmObra.id) return;
    try {
      const { error } = await supabase.from('obras').delete().eq('id', confirmObra.id);
      if (error) throw error;
      setObras(prev => prev.filter(o => o.id !== confirmObra.id));
      toast.success('Obra excluída.');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao excluir obra.');
    } finally { setConfirmObra({ open: false }); }
  };

  // ----- Document upload -----
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [docModal, setDocModal] = useState<{ open: boolean; obraId?: string }>({ open: false });
  const [docForm, setDocForm] = useState<{ category: ObraDocumentCategory; customLabel: string; title: string; requiresSignature: boolean; file: File | null }>(
    { category: 'contrato', customLabel: '', title: '', requiresSignature: false, file: null }
  );
  const [uploading, setUploading] = useState(false);

  const openDocModal = (obraId: string) => {
    setDocForm({ category: 'contrato', customLabel: '', title: '', requiresSignature: false, file: null });
    setDocModal({ open: true, obraId });
  };

  const saveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const obraId = docModal.obraId!;
    if (!docForm.file) { toast.error('Selecione um arquivo.'); return; }
    if (docForm.category === 'outro' && !docForm.customLabel.trim()) { toast.error('Descreva o tipo (campo Outro).'); return; }
    try {
      setUploading(true);
      const up = await uploadPortalDoc(docForm.file, obraId);
      const title = docForm.title.trim() || docForm.file.name;
      const { data, error } = await supabase.from('obra_documents').insert({
        obra_id: obraId,
        category: docForm.category,
        custom_label: docForm.category === 'outro' ? docForm.customLabel.trim() : null,
        title,
        file_url: up.url,
        file_type: up.fileType,
        requires_signature: docForm.requiresSignature,
        signature_status: docForm.requiresSignature ? 'pending' : 'na',
      }).select('*').single();
      if (error) throw error;
      setDocsByObra(prev => ({ ...prev, [obraId]: [mapDoc(data), ...(prev[obraId] || [])] }));
      toast.success('Documento enviado.');
      setDocModal({ open: false });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Falha ao enviar documento.');
    } finally { setUploading(false); }
  };

  const [confirmDoc, setConfirmDoc] = useState<{ open: boolean; doc?: ObraDocument }>({ open: false });
  const deleteDoc = async () => {
    const doc = confirmDoc.doc;
    if (!doc) return;
    try {
      const { error } = await supabase.from('obra_documents').delete().eq('id', doc.id);
      if (error) throw error;
      await deletePortalDoc(doc.fileUrl);
      setDocsByObra(prev => ({ ...prev, [doc.obraId]: (prev[doc.obraId] || []).filter(d => d.id !== doc.id) }));
      toast.success('Documento removido.');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao remover documento.');
    } finally { setConfirmDoc({ open: false }); }
  };

  // ----- Checklist templates -----
  const [templatesPanelOpen, setTemplatesPanelOpen] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<{ name: string; description: string; items: { id?: string; text: string; required: boolean; requiresPhoto: boolean }[] }>(
    { name: '', description: '', items: [{ text: '', required: false, requiresPhoto: false }] }
  );
  const [savingTemplate, setSavingTemplate] = useState(false);

  const openTemplateModal = (t?: ChecklistTemplate) => {
    if (t) {
      setEditingTemplate(t);
      setTemplateForm({
        name: t.name, description: t.description || '',
        items: t.items.length ? t.items.map(it => ({ id: it.id, text: it.text, required: it.required, requiresPhoto: it.requiresPhoto })) : [{ text: '', required: false, requiresPhoto: false }],
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ name: '', description: '', items: [{ text: '', required: false, requiresPhoto: false }] });
    }
    setTemplateModal(true);
  };

  const updateTemplateItem = (idx: number, patch: Partial<{ text: string; required: boolean; requiresPhoto: boolean }>) => {
    setTemplateForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));
  };
  const addTemplateItem = () => setTemplateForm(f => ({ ...f, items: [...f.items, { text: '', required: false, requiresPhoto: false }] }));
  const removeTemplateItem = (idx: number) => setTemplateForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim()) { toast.error('Informe o nome do modelo.'); return; }
    const items = templateForm.items.map(it => ({ ...it, text: it.text.trim() })).filter(it => it.text);
    if (items.length === 0) { toast.error('Adicione ao menos um item.'); return; }
    try {
      setSavingTemplate(true);
      let templateId = editingTemplate?.id;
      if (editingTemplate) {
        const { error } = await supabase.from('checklist_templates')
          .update({ name: templateForm.name.trim(), description: templateForm.description.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', editingTemplate.id);
        if (error) throw error;
        // recria os itens do zero (mais simples que diff campo a campo)
        const { error: delErr } = await supabase.from('checklist_template_items').delete().eq('template_id', editingTemplate.id);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await supabase.from('checklist_templates')
          .insert({ name: templateForm.name.trim(), description: templateForm.description.trim() || null })
          .select('id').single();
        if (error) throw error;
        templateId = data.id;
      }
      const rows = items.map((it, idx) => ({
        template_id: templateId, position: idx, text: it.text, required: it.required, requires_photo: it.requiresPhoto,
      }));
      const { error: itemsErr } = await supabase.from('checklist_template_items').insert(rows);
      if (itemsErr) throw itemsErr;
      toast.success(editingTemplate ? 'Modelo salvo.' : 'Modelo criado.');
      setTemplateModal(false);
      fetchTemplates();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Falha ao salvar modelo.');
    } finally { setSavingTemplate(false); }
  };

  const [confirmTemplate, setConfirmTemplate] = useState<{ open: boolean; id?: string; name?: string }>({ open: false });
  const deleteTemplate = async () => {
    if (!confirmTemplate.id) return;
    try {
      const { error } = await supabase.from('checklist_templates').delete().eq('id', confirmTemplate.id);
      if (error) throw error;
      setTemplates(prev => prev.filter(t => t.id !== confirmTemplate.id));
      toast.success('Modelo excluído.');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao excluir modelo.');
    } finally { setConfirmTemplate({ open: false }); }
  };

  // ----- Aplicar template numa obra -----
  const [applyModal, setApplyModal] = useState<{ open: boolean; obraId?: string }>({ open: false });
  const [applyTemplateId, setApplyTemplateId] = useState('');
  const [applying, setApplying] = useState(false);

  const applyTemplate = async () => {
    const obraId = applyModal.obraId!;
    const template = templates.find(t => t.id === applyTemplateId);
    if (!template) { toast.error('Selecione um modelo.'); return; }
    try {
      setApplying(true);
      const { data: checklist, error } = await supabase.from('obra_checklists')
        .insert({ obra_id: obraId, template_id: template.id, title: template.name })
        .select('*').single();
      if (error) throw error;
      const rows = template.items.map((it, idx) => ({
        checklist_id: checklist.id, position: idx, text: it.text, required: it.required, requires_photo: it.requiresPhoto,
      }));
      if (rows.length) {
        const { error: itemsErr } = await supabase.from('obra_checklist_items').insert(rows);
        if (itemsErr) throw itemsErr;
      }
      toast.success('Checklist aplicado à obra.');
      setApplyModal({ open: false });
      setApplyTemplateId('');
      fetchChecklists(obraId);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Falha ao aplicar checklist.');
    } finally { setApplying(false); }
  };

  const [confirmChecklist, setConfirmChecklist] = useState<{ open: boolean; checklist?: ObraChecklist }>({ open: false });
  const deleteChecklist = async () => {
    const c = confirmChecklist.checklist;
    if (!c) return;
    try {
      const { error } = await supabase.from('obra_checklists').delete().eq('id', c.id);
      if (error) throw error;
      setChecklistsByObra(prev => ({ ...prev, [c.obraId]: (prev[c.obraId] || []).filter(x => x.id !== c.id) }));
      toast.success('Checklist removido.');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao remover checklist.');
    } finally { setConfirmChecklist({ open: false }); }
  };

  const [viewChecklist, setViewChecklist] = useState<ObraChecklist | null>(null);

  // ----- Acesso (toggle / copy) -----
  const toggleCredActive = async (cred: PortalCredential) => {
    try {
      const { error } = await supabase.rpc('portal_set_active', { p_credential_id: cred.id, p_active: !cred.active });
      if (error) throw error;
      setCredentials(prev => prev.map(c => c.id === cred.id ? { ...c, active: !cred.active } : c));
      toast.success(!cred.active ? 'Acesso ativado.' : 'Acesso inativado.');
    } catch (err) {
      console.error(err);
      toast.error('Falha ao alterar status.');
    }
  };

  const copyLink = async () => {
    const link = buildPortalLink();
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link de entrada copiado.');
    } catch {
      toast.error('Copie manualmente: ' + link);
    }
  };

  return (
    <div>
      <PageHeader
        title="Portal do Cliente"
        eyebrow="Gestão"
        description="Crie o acesso do cliente, anexe documentos e fotos. Os diários entram automaticamente."
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={copyLink} className="btn-secondary flex items-center gap-2">
              <LinkIcon className="h-4 w-4" /> Copiar link de entrada
            </button>
            <button onClick={() => setTemplatesPanelOpen(v => !v)} className="btn-secondary flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Modelos de checklist
            </button>
            <button onClick={() => openObraModal()} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Novo acesso / obra
            </button>
          </div>
        }
      />

      <FilterBar>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">Cada obra tem um cliente, um login e seus documentos. Diários aparecem sozinhos pelo cliente da obra.</p>
          <button onClick={fetchAll} disabled={loading} className="text-xs text-green-700 dark:text-green-300 hover:underline disabled:opacity-50">{loading ? 'Atualizando...' : 'Atualizar'}</button>
        </div>
      </FilterBar>

      {templatesPanelOpen && (
        <Surface>
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><ListChecks className="h-4 w-4" /> Modelos de checklist</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Monte um modelo (ex: Responsabilidades) e aplique em quantas obras quiser.</p>
              </div>
              <button onClick={() => openTemplateModal()} className="btn-primary flex items-center gap-2 text-sm"><Plus className="h-4 w-4" /> Novo modelo</button>
            </div>
            {templates.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum modelo criado ainda.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {templates.map(t => (
                  <div key={t.id} className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.name}</p>
                        <p className="text-[11px] text-gray-500">{t.items.length} item(ns) · {t.items.filter(i => i.required).length} obrigatório(s)</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <IconButton icon={Edit} label="Editar modelo" tone="primary" onClick={() => openTemplateModal(t)} />
                        <IconButton icon={Trash2} label="Excluir modelo" tone="danger" onClick={() => setConfirmTemplate({ open: true, id: t.id, name: t.name })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Surface>
      )}

      <div className="space-y-3">
        {obras.length === 0 && (
          <Surface><div className="p-6 text-sm text-gray-500 dark:text-gray-400">Nenhuma obra. Clique em "Novo acesso / obra" para começar.</div></Surface>
        )}
        {obras.map((o) => {
          const docs = docsByObra[o.id] || [];
          const diaries = diariesByObra[o.id] || [];
          const cred = credByClient(o.clientId);
          const isOpen = expanded === o.id;
          return (
            <Surface key={o.id}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => toggleExpand(o)} className="flex items-start gap-3 text-left min-w-0 flex-1">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 className="text-green-600 dark:text-green-400 w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{o.obraCode ? `${o.obraCode} — ` : ''}{o.name}</h3>
                        {o.confidential && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold flex-shrink-0"><Lock className="h-3 w-3" /> Confidencial</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {clientName(o.clientId)}
                        {cred ? ` · login: ${cred.email}` : ' · sem login'}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {cred && <StatusBadge variant={cred.active ? 'success' : 'neutral'}>{cred.active ? 'ativo' : 'inativo'}</StatusBadge>}
                    <IconButton icon={Edit} label="Editar obra/login" tone="primary" onClick={() => openObraModal(o)} />
                    <IconButton icon={Trash2} label="Excluir" tone="danger" onClick={() => setConfirmObra({ open: true, id: o.id, name: o.name })} />
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4 space-y-5">
                    {/* Acesso */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={copyLink} className="btn-secondary flex items-center gap-2 text-sm"><LinkIcon className="h-4 w-4" /> Copiar link</button>
                      <button onClick={() => openObraModal(o)} className="btn-secondary flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4" /> {cred ? 'Editar login' : 'Criar login'}</button>
                      {cred && (
                        <button onClick={() => toggleCredActive(cred)} className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg ${cred.active ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                          {cred.active ? <><XCircle className="h-4 w-4" /> Inativar acesso</> : <><CheckCircle2 className="h-4 w-4" /> Ativar acesso</>}
                        </button>
                      )}
                      {cred?.lastLoginAt && <span className="text-xs text-gray-400">Último acesso: {new Date(cred.lastLoginAt).toLocaleString('pt-BR')}</span>}
                    </div>

                    {/* Documentos */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Documentos e fotos ({docs.length})</h4>
                        <button onClick={() => openDocModal(o.id)} className="btn-secondary flex items-center gap-2 text-sm"><Upload className="h-4 w-4" /> Anexar</button>
                      </div>
                      {docs.length === 0 ? (
                        <p className="text-sm text-gray-400">Nada anexado ainda.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {docs.map(d => (
                            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
                              {isImage(d.fileType) ? <ImageIcon className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-gray-900 dark:text-white hover:underline truncate block">{d.title}</a>
                                <p className="text-[11px] text-gray-500">{categoryLabel(d.category, d.customLabel)}</p>
                              </div>
                              {d.requiresSignature && (
                                <StatusBadge variant={d.signatureStatus === 'signed' ? 'success' : 'warning'}>{d.signatureStatus === 'signed' ? 'assinado' : 'p/ assinar'}</StatusBadge>
                              )}
                              <IconButton icon={Trash2} label="Remover" tone="danger" onClick={() => setConfirmDoc({ open: true, doc: d })} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Checklists */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Checklists ({(checklistsByObra[o.id] || []).length})</h4>
                        <button onClick={() => setApplyModal({ open: true, obraId: o.id })} className="btn-secondary flex items-center gap-2 text-sm"><ClipboardList className="h-4 w-4" /> Aplicar modelo</button>
                      </div>
                      {(checklistsByObra[o.id] || []).length === 0 ? (
                        <p className="text-sm text-gray-400">Nenhum checklist aplicado ainda.</p>
                      ) : (
                        <div className="space-y-2">
                          {(checklistsByObra[o.id] || []).map(c => {
                            const done = c.items.filter(i => i.checked).length;
                            return (
                              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
                                <ListChecks className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.title}</p>
                                  <p className="text-[11px] text-gray-500">{done}/{c.items.length} item(ns) marcado(s)</p>
                                </div>
                                <StatusBadge variant={c.status === 'completed' ? 'success' : 'warning'}>{c.status === 'completed' ? 'concluído' : 'pendente'}</StatusBadge>
                                <IconButton icon={Eye} label="Ver detalhes" tone="primary" onClick={() => setViewChecklist(c)} />
                                <IconButton icon={Trash2} label="Remover" tone="danger" onClick={() => setConfirmChecklist({ open: true, checklist: c })} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Diários (automático) */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Diários da obra ({diaries.length}) <span className="font-normal text-xs text-gray-400">— automático pelo cliente</span></h4>
                      {diaries.length === 0 ? (
                        <p className="text-sm text-gray-400">Nenhum diário deste cliente ainda.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {diaries.slice(0, 8).map(d => (
                            <div key={d.id} className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                              <Calendar className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <span className="font-medium">{d.diary_type}</span>
                              <span className="text-gray-400">{d.date ? new Date(d.date).toLocaleDateString('pt-BR') : '-'}</span>
                              <span className="truncate text-gray-400">{d.services}</span>
                              {d.status === 'signed' && <StatusBadge variant="success">assinado</StatusBadge>}
                            </div>
                          ))}
                          {diaries.length > 8 && <p className="text-xs text-gray-400">+{diaries.length - 8} diário(s)</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Surface>
          );
        })}
      </div>

      {/* Obra + Acesso modal */}
      <Modal open={obraModal} onClose={() => setObraModal(false)} title={editingObra ? 'Editar obra e acesso' : 'Novo acesso / obra'} size="lg">
        <form onSubmit={saveObra} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Cliente *</label>
            <select value={obraForm.client_id} onChange={e => setObraForm(f => ({ ...f, client_id: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100">
              <option value="">Selecione...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Código da obra</label>
              <input value={obraForm.obra_code} onChange={e => setObraForm(f => ({ ...f, obra_code: e.target.value }))} placeholder="G26003" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome da obra *</label>
              <input value={obraForm.name} onChange={e => setObraForm(f => ({ ...f, name: e.target.value }))} placeholder="Construtora Ápia - Mariana" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Endereço</label>
              <input value={obraForm.address} onChange={e => setObraForm(f => ({ ...f, address: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Status</label>
              <select value={obraForm.status} onChange={e => setObraForm(f => ({ ...f, status: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100">
                <option value="ativa">Ativa</option>
                <option value="concluida">Concluída</option>
                <option value="inativa">Inativa</option>
              </select>
            </div>
          </div>

          {isSuper && (
            <label className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 cursor-pointer">
              <input type="checkbox" checked={obraForm.confidential} onChange={e => setObraForm(f => ({ ...f, confidential: e.target.checked }))} className="mt-0.5 rounded text-amber-600" />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold flex items-center gap-1"><Lock className="h-4 w-4" /> Obra confidencial</span>
                Só ADM global vê e edita no painel. O cliente continua vendo normalmente no portal.
              </span>
            </label>
          )}

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2"><KeyRound className="h-4 w-4" /> Acesso do cliente {editingObra ? '(deixe a senha vazia para manter)' : '(opcional)'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Usuário / login</label>
                <input value={obraForm.username} onChange={e => setObraForm(f => ({ ...f, username: e.target.value }))} placeholder="ex: construtora-apia" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Senha inicial</label>
                <input type="text" value={obraForm.password} onChange={e => setObraForm(f => ({ ...f, password: e.target.value }))} placeholder="mínimo 6 caracteres" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100" />
              </div>
            </div>
            <p className="text-xs text-gray-500">O login vale para todas as obras deste cliente. Anote e envie usuário + senha ao cliente.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setObraModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{editingObra ? 'Salvar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      {/* Document modal */}
      <Modal open={docModal.open} onClose={() => setDocModal({ open: false })} title="Anexar documento ou foto">
        <form onSubmit={saveDoc} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Categoria</label>
            <select value={docForm.category} onChange={e => setDocForm(f => ({ ...f, category: e.target.value as ObraDocumentCategory }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          {docForm.category === 'outro' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Descreva o tipo *</label>
              <input value={docForm.customLabel} onChange={e => setDocForm(f => ({ ...f, customLabel: e.target.value }))} placeholder="Ex: Laudo complementar" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Título (opcional)</label>
            <input value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))} placeholder="Usa o nome do arquivo se vazio" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Arquivo (PDF, JPG, PNG) *</label>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setDocForm(f => ({ ...f, file: e.target.files?.[0] || null }))} className="w-full text-sm text-gray-700 dark:text-gray-200 file:mr-3 file:rounded-lg file:border-0 file:bg-green-600 file:px-3 file:py-2 file:text-white" />
            {docForm.file && <p className="mt-1 text-xs text-gray-500 flex items-center gap-1"><Paperclip className="h-3 w-3" />{docForm.file.name}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={docForm.requiresSignature} onChange={e => setDocForm(f => ({ ...f, requiresSignature: e.target.checked }))} className="rounded text-green-600" />
            <PenLine className="h-4 w-4" /> Exigir assinatura do cliente
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDocModal({ open: false })} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={uploading} className="btn-primary">{uploading ? 'Enviando...' : 'Anexar'}</button>
          </div>
        </form>
      </Modal>

      {/* Template modal */}
      <Modal open={templateModal} onClose={() => setTemplateModal(false)} title={editingTemplate ? 'Editar modelo de checklist' : 'Novo modelo de checklist'} size="lg">
        <form onSubmit={saveTemplate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nome do modelo *</label>
            <input value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Responsabilidades" className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Descrição (opcional)</label>
            <input value={templateForm.description} onChange={e => setTemplateForm(f => ({ ...f, description: e.target.value }))} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Itens do checklist</label>
              <button type="button" onClick={addTemplateItem} className="text-xs text-green-700 dark:text-green-300 hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> Adicionar item</button>
            </div>
            <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {templateForm.items.map((it, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-800 p-2.5">
                  <GripVertical className="h-4 w-4 text-gray-300 mt-2.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input value={it.text} onChange={e => updateTemplateItem(idx, { text: e.target.value })} placeholder="Ex: Assinar o Diário de Obras" className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100" />
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <input type="checkbox" checked={it.required} onChange={e => updateTemplateItem(idx, { required: e.target.checked })} className="rounded text-amber-600" /> Obrigatório
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                        <input type="checkbox" checked={it.requiresPhoto} onChange={e => updateTemplateItem(idx, { requiresPhoto: e.target.checked })} className="rounded text-green-600" /> <Camera className="h-3 w-3" /> Exige foto
                      </label>
                    </div>
                  </div>
                  <IconButton icon={Trash2} label="Remover item" tone="danger" onClick={() => removeTemplateItem(idx)} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setTemplateModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={savingTemplate} className="btn-primary">{savingTemplate ? 'Salvando...' : (editingTemplate ? 'Salvar' : 'Criar')}</button>
          </div>
        </form>
      </Modal>

      {/* Apply template modal */}
      <Modal open={applyModal.open} onClose={() => setApplyModal({ open: false })} title="Aplicar checklist na obra">
        <div className="space-y-4">
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum modelo criado ainda. Crie um em "Modelos de checklist".</p>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Modelo</label>
              <select value={applyTemplateId} onChange={e => setApplyTemplateId(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-gray-900 dark:text-gray-100">
                <option value="">Selecione...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.items.length} itens)</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setApplyModal({ open: false })} className="btn-secondary">Cancelar</button>
            <button type="button" onClick={applyTemplate} disabled={applying || !applyTemplateId} className="btn-primary">{applying ? 'Aplicando...' : 'Aplicar'}</button>
          </div>
        </div>
      </Modal>

      {/* View checklist modal */}
      <Modal open={!!viewChecklist} onClose={() => setViewChecklist(null)} title={viewChecklist?.title || 'Checklist'} size="lg">
        {viewChecklist && (
          <div className="space-y-3">
            <StatusBadge variant={viewChecklist.status === 'completed' ? 'success' : 'warning'}>
              {viewChecklist.status === 'completed' ? 'concluído' : 'pendente'}
            </StatusBadge>
            {viewChecklist.status === 'completed' && (
              <p className="text-xs text-gray-500">Assinado por {viewChecklist.signedBy || '—'} em {viewChecklist.signedAt ? new Date(viewChecklist.signedAt).toLocaleString('pt-BR') : '—'}</p>
            )}
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {viewChecklist.items.map(it => (
                <div key={it.id} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                  <div className="flex items-start gap-2">
                    {it.checked ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">{it.text}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {it.required && <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">OBRIGATÓRIO</span>}
                        {it.requiresPhoto && <span className="text-[10px] font-semibold text-gray-500 flex items-center gap-1"><Camera className="h-3 w-3" /> Exige foto</span>}
                      </div>
                      {it.note && <p className="text-xs text-gray-500 mt-1">Obs: {it.note}</p>}
                      {it.photoData && <img src={it.photoData} alt="Foto anexada" className="mt-2 max-h-40 rounded-lg border border-gray-200 dark:border-gray-800" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {viewChecklist.signatureUrl && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Assinatura</p>
                <img src={viewChecklist.signatureUrl} alt="Assinatura" className="max-h-24 rounded-lg border border-gray-200 dark:border-gray-800 bg-white" />
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmObra.open}
        onClose={() => setConfirmObra({ open: false })}
        onConfirm={deleteObra}
        title="Excluir obra"
        message={`Excluir a obra "${confirmObra.name}"? Os documentos vinculados também serão removidos.`}
        confirmText="Excluir" cancelText="Cancelar" type="danger"
      />
      <ConfirmDialog
        isOpen={confirmDoc.open}
        onClose={() => setConfirmDoc({ open: false })}
        onConfirm={deleteDoc}
        title="Remover documento"
        message={`Remover "${confirmDoc.doc?.title}"?`}
        confirmText="Remover" cancelText="Cancelar" type="danger"
      />
      <ConfirmDialog
        isOpen={confirmTemplate.open}
        onClose={() => setConfirmTemplate({ open: false })}
        onConfirm={deleteTemplate}
        title="Excluir modelo"
        message={`Excluir o modelo "${confirmTemplate.name}"? Checklists já aplicados em obras não são afetados.`}
        confirmText="Excluir" cancelText="Cancelar" type="danger"
      />
      <ConfirmDialog
        isOpen={confirmChecklist.open}
        onClose={() => setConfirmChecklist({ open: false })}
        onConfirm={deleteChecklist}
        title="Remover checklist"
        message={`Remover o checklist "${confirmChecklist.checklist?.title}" desta obra?`}
        confirmText="Remover" cancelText="Cancelar" type="danger"
      />
    </div>
  );
};
