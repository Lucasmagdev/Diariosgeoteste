import React, { useState, useEffect } from 'react';
import { User, Save, Edit3, Check, X, PenTool, Camera, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { SignaturePadFixed as SignaturePad } from './SignaturePadFixed';
import { saveSignatureToDatabase } from '../utils/signatureStorageFallback';
import { uploadCollaboratorPhoto, deleteOldCollaboratorPhoto } from '../utils/collaboratorPhotoStorage';
import { useToast } from '../contexts/ToastContext';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [signatureImage, setSignatureImage] = useState('');
  const [signatureImageUrl, setSignatureImageUrl] = useState('');
  const [cpf, setCpf] = useState('');
  const [cpfDraft, setCpfDraft] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingCpf, setIsEditingCpf] = useState(false);
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCpf, setSavingCpf] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const normalizeCpf = (value: string) => value.replace(/\D/g, '').slice(0, 11);

  const formatCpf = (value: string) => {
    const digits = normalizeCpf(value);
    if (!digits) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  // Carregar dados do perfil (assinatura e foto)
  useEffect(() => {
    const loadProfile = async () => {
      if (!isSupabaseConfigured || !user?.id) {
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setSignatureImageUrl(data?.signature_image_url || '');
        setPhotoUrl(data?.photo_url || null);
        const loadedCpf = typeof data?.cpf === 'string' ? normalizeCpf(data.cpf) : '';
        setCpf(loadedCpf);
        setCpfDraft(loadedCpf);
        
        // Se houver URL, carregar a imagem para preview
        if (data?.signature_image_url) {
          setSignatureImage(data.signature_image_url);
        }
        if (data?.photo_url) {
          setPhotoPreview(data.photo_url);
        }
      } catch (err: any) {
        console.error('Erro ao carregar perfil:', err);
        setSignatureImageUrl('');
        setSignatureImage('');
        setPhotoUrl(null);
        setPhotoPreview(null);
        setCpf('');
        setCpfDraft('');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!isSupabaseConfigured || !user?.id) {
      setMessage({ type: 'success', text: 'Assinatura salva (modo demonstração)' });
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      let newSignatureUrl = signatureImageUrl;

      // Se há uma nova assinatura digital, salvar no banco
      if (signatureImage && signatureImage !== signatureImageUrl) {
        // Se é uma data URL (nova assinatura), salvar no banco
        if (signatureImage.startsWith('data:')) {
          const savedUrl = await saveSignatureToDatabase(signatureImage, user.id);
          if (savedUrl) {
            newSignatureUrl = savedUrl;
          } else {
            throw new Error('Não foi possível salvar a assinatura');
          }
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ 
          signature_image_url: newSignatureUrl || null
        })
        .eq('id', user.id);

      if (error) throw error;

      setSignatureImageUrl(newSignatureUrl);
      setMessage({ type: 'success', text: 'Assinatura salva com sucesso!' });
      setIsEditing(false);
    } catch (err: any) {
      console.error('Erro ao salvar assinatura:', err);
      setMessage({ type: 'error', text: 'Não foi possível salvar a assinatura. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Recarregar assinatura original
    if (isSupabaseConfigured && user?.id) {
      supabase
        .from('profiles')
        .select('signature_image_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setSignatureImageUrl(data?.signature_image_url || '');
          if (data?.signature_image_url) {
            setSignatureImage(data.signature_image_url);
          } else {
            setSignatureImage('');
          }
        });
    }
    setIsEditing(false);
    setShowSignaturePad(false);
    setMessage(null);
  };

  const handleSignatureSave = (signatureData: string) => {
    setSignatureImage(signatureData);
    setShowSignaturePad(false);
    setMessage({ type: 'success', text: 'Assinatura digital capturada! Agora salve as alterações.' });
  };

  const handleSignatureCancel = () => {
    setShowSignaturePad(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato de arquivo não suportado. Use apenas imagens JPG, PNG ou WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O tamanho máximo permitido é 5MB.');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setIsEditingPhoto(true);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFile(null);
    setIsEditingPhoto(true);
  };

  const handleSavePhoto = async () => {
    if (!isSupabaseConfigured || !user?.id) {
      toast.success('Foto salva (modo demonstração)');
      setPhotoUrl(photoPreview);
      setIsEditingPhoto(false);
      return;
    }

    setUploadingPhoto(true);
    setMessage(null);

    try {
      let newPhotoUrl = photoUrl;

      // Upload da foto se houver nova
      if (photoFile) {
        const uploadedUrl = await uploadCollaboratorPhoto(photoFile, user.id);
        if (!uploadedUrl) {
          throw new Error('Não foi possível enviar a foto');
        }
        newPhotoUrl = uploadedUrl;

        // Se havia foto antiga, deletar
        if (photoUrl && photoUrl !== uploadedUrl) {
          await deleteOldCollaboratorPhoto(photoUrl);
        }
      } else if (!photoPreview && photoUrl) {
        // Se removeu a foto, deletar do storage
        await deleteOldCollaboratorPhoto(photoUrl);
        newPhotoUrl = null;
      }

      // Atualizar no banco de dados
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: newPhotoUrl })
        .eq('id', user.id);

      if (error) throw error;

      setPhotoUrl(newPhotoUrl);
      setPhotoFile(null);
      setIsEditingPhoto(false);
      toast.success('Foto salva com sucesso!');
      setMessage({ type: 'success', text: 'Foto atualizada com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao salvar foto:', err);
      toast.error('Não foi possível salvar a foto. Tente novamente.');
      setMessage({ type: 'error', text: 'Não foi possível salvar a foto. Tente novamente.' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCancelPhoto = () => {
    setPhotoPreview(photoUrl);
    setPhotoFile(null);
    setIsEditingPhoto(false);
    setMessage(null);
  };

  const handleEditCpf = () => {
    setCpfDraft(cpf);
    setIsEditingCpf(true);
  };

  const handleCancelCpf = () => {
    setCpfDraft(cpf);
    setIsEditingCpf(false);
  };

  const handleSaveCpf = async () => {
    const normalizedCpf = normalizeCpf(cpfDraft);
    if (normalizedCpf && normalizedCpf.length !== 11) {
      toast.error('CPF invalido. Informe os 11 digitos.');
      return;
    }

    if (!isSupabaseConfigured || !user?.id) {
      setCpf(normalizedCpf);
      setCpfDraft(normalizedCpf);
      setIsEditingCpf(false);
      toast.success('CPF salvo (modo demonstracao)');
      return;
    }

    setSavingCpf(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cpf: normalizedCpf || null })
        .eq('id', user.id);

      if (error) throw error;

      setCpf(normalizedCpf);
      setCpfDraft(normalizedCpf);
      setIsEditingCpf(false);
      toast.success('CPF salvo com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar CPF:', err);
      toast.error('Nao foi possivel salvar o CPF. Verifique se a coluna cpf ja foi criada no banco.');
    } finally {
      setSavingCpf(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-500">Carregando perfil...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Meu Perfil
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Gerencie suas informações pessoais e assinatura digital
        </p>
      </div>

      {/* Informações do Usuário */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mb-6">
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Informações Pessoais</h2>
        </div>
        
        <div className="p-5 sm:p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-green-100 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 flex items-center justify-center">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt={user?.name || 'Usuário'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 sm:w-12 sm:h-12 text-green-600 dark:text-green-400" />
                )}
              </div>
              {isEditingPhoto && (
                <div className="absolute -bottom-1 -right-1">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center hover:bg-green-700 transition-colors">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                  </label>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{user?.name}</h3>
              <p className="text-gray-600 dark:text-gray-300">{user?.email}</p>
              <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full mt-1">
                {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
              </span>
              <div className="mt-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">CPF</p>
                {isEditingCpf ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={14}
                      value={formatCpf(cpfDraft)}
                      onChange={(e) => setCpfDraft(normalizeCpf(e.target.value))}
                      placeholder="000.000.000-00"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveCpf}
                        disabled={savingCpf}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {savingCpf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>{savingCpf ? 'Salvando...' : 'Salvar'}</span>
                      </button>
                      <button
                        onClick={handleCancelCpf}
                        disabled={savingCpf}
                        className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-gray-900 dark:text-gray-100">{formatCpf(cpf) || '-'}</p>
                    <button
                      onClick={handleEditCpf}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Editar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção de edição de foto */}
          {message && message.text.includes('Foto') && (
            <div className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
            }`}>
              <p className={`text-sm ${
                message.type === 'success' 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {message.text}
              </p>
            </div>
          )}

          {isEditingPhoto ? (
            <div className="flex items-center space-x-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
                <div className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                  {uploadingPhoto ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Alterar Foto</span>
                    </>
                  )}
                </div>
              </label>
              {photoPreview && (
                <button
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  <span>Remover</span>
                </button>
              )}
              <button
                onClick={handleSavePhoto}
                disabled={uploadingPhoto || (!photoFile && photoPreview === photoUrl)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCancelPhoto}
                disabled={uploadingPhoto}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                <span>Cancelar</span>
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setIsEditingPhoto(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Edit3 className="w-4 h-4" />
                <span>{photoPreview ? 'Alterar Foto' : 'Adicionar Foto'}</span>
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">JPG, PNG ou WEBP (máx. 5MB)</p>
            </div>
          )}
        </div>
      </div>

      {/* Assinatura Digital */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 bg-green-50 dark:bg-green-900/20">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Assinatura Digital</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Desenhe sua assinatura na mesa digital. Ela será usada automaticamente nos diários que você criar.
          </p>
        </div>
        
        <div className="p-5 sm:p-6">
          {message && (
            <div className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
            }`}>
              <p className={`text-sm ${
                message.type === 'success' 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {message.text}
              </p>
            </div>
          )}

          <div className="space-y-4">
            {/* Exibir assinatura atual */}
            {signatureImage && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Assinatura atual:</p>
                <img 
                  src={signatureImage} 
                  alt="Assinatura digital" 
                  className="max-w-full h-20 object-contain border border-gray-300 dark:border-gray-600 rounded"
                />
              </div>
            )}

            {isEditing ? (
              <div className="space-y-4">
                {!showSignaturePad ? (
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setShowSignaturePad(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      <PenTool className="w-4 h-4" />
                      <span>Desenhar Assinatura</span>
                    </button>
                    {signatureImage && (
                      <button
                        onClick={() => setSignatureImage('')}
                        className="bg-red-500 text-white px-3 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center space-x-2"
                      >
                        <X className="w-4 h-4" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <SignaturePad
                    onSave={handleSignatureSave}
                    onCancel={handleSignatureCancel}
                    initialSignature={signatureImage}
                  />
                )}

                <div className="flex items-center space-x-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{saving ? 'Salvando...' : 'Salvar'}</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center space-x-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancelar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Editar Assinatura</span>
                </button>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                    Como funciona
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Quando você criar um novo diário de obra, o campo "Assinatura Geoteste" será preenchido automaticamente com sua assinatura digital. Você ainda pode editá-la se necessário.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
