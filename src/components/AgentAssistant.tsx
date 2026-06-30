import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Scissors, Loader2, FileText, Calendar, Bot } from 'lucide-react';
import { summarizeText, chatComplete } from '../utils/aiClient';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

type DiaryOption = {
  id: string;
  clientName: string;
  date: string;
  servicesExecuted: string;
};

export const AgentAssistant: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'resumo' | 'chat'>('resumo');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [diaries, setDiaries] = useState<DiaryOption[]>([]);
  const [selectedDiaryId, setSelectedDiaryId] = useState('');
  const [loadingDiaries, setLoadingDiaries] = useState(false);

  // Buscar diários quando abrir o assistente
  useEffect(() => {
    if (open && mode === 'resumo' && isSupabaseConfigured && user) {
      fetchDiaries();
    }
  }, [open, mode, user]);

  const fetchDiaries = async () => {
    if (!user) return;
    setLoadingDiaries(true);
    try {
      let query = supabase
        .from('work_diaries')
        .select('id, client_name, date, services_executed')
        .order('date', { ascending: false })
        .limit(20);

      if (user.role !== 'admin') {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: DiaryOption[] = (data || []).map((d: any) => ({
        id: d.id,
        clientName: d.client_name,
        date: d.date,
        servicesExecuted: d.services_executed,
      }));

      setDiaries(mapped);
    } catch (e: any) {
      console.error('Erro ao buscar diários:', e);
    } finally {
      setLoadingDiaries(false);
    }
  };

  const handleRun = async () => {
    if (mode === 'resumo' && selectedDiaryId) {
      const diary = diaries.find(d => d.id === selectedDiaryId);
      if (!diary) return;
      
      setLoading(true);
      setOutput('');
      try {
        const diaryText = `Cliente: ${diary.clientName}\nData: ${diary.date}\nServiços: ${diary.servicesExecuted}`;
        const result = await summarizeText(diaryText);
        setOutput(result);
      } catch (e: any) {
        setOutput('Não foi possível processar. Tente novamente.');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'chat' && input.trim()) {
      setLoading(true);
      setOutput('');
      try {
        const result = await chatComplete([
          { role: 'system', content: 'Você auxilia usuários de um sistema de diários de obra (PT-BR). Seja breve e objetivo.' },
          { role: 'user', content: input },
        ]);
        setOutput(result);
      } catch (e: any) {
        setOutput('Não foi possível processar. Tente novamente.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      {/* Toggle */}
      <div className="fixed right-4 bottom-20 md:bottom-4 z-[60]">
        <button
          onClick={() => setOpen(!open)}
          className="rounded-full bg-green-600 hover:bg-green-700 text-white p-3 shadow-lg transition-colors duration-150 group min-h-[48px] min-w-[48px] flex items-center justify-center touch-manipulation"
          title="Assistente IA"
          aria-label={open ? 'Fechar assistente' : 'Abrir assistente'}
        >
          {open ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Bot className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200" />}
        </button>
      </div>

      {open && (
        <section role="dialog" aria-modal="true" aria-label="Assistente IA" className="fixed inset-x-2 bottom-20 z-[60] flex max-h-[82vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 sm:inset-x-auto sm:right-4 sm:w-[calc(100%-2rem)] sm:max-w-md md:bottom-4 md:right-4">
          <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setMode('resumo')}
                className={`px-3 py-1.5 rounded-lg border text-sm ${mode === 'resumo' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}
              >
                Resumo
              </button>
              <button
                onClick={() => setMode('chat')}
                className={`px-3 py-1.5 rounded-lg border text-sm ${mode === 'chat' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`}
              >
                Chat
              </button>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              title="Fechar assistente"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-3 flex-1 overflow-y-auto">
            {mode === 'resumo' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    Selecione um diário para resumir
                  </label>
                  {loadingDiaries ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                      <span className="ml-2 text-sm text-gray-500">Carregando diários...</span>
                    </div>
                  ) : (
                    <select
                      value={selectedDiaryId}
                      onChange={(e) => setSelectedDiaryId(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Escolha um diário...</option>
                      {diaries.map((diary) => (
                        <option key={diary.id} value={diary.id}>
                          {diary.clientName} - {new Date(diary.date).toLocaleDateString('pt-BR')}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {selectedDiaryId && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Prévia do diário</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                      {diaries.find(d => d.id === selectedDiaryId)?.servicesExecuted}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <textarea
                rows={5}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Digite sua pergunta..."
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => { 
                  setInput(''); 
                  setOutput(''); 
                  setSelectedDiaryId(''); 
                }}
                className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
              >
                Limpar
              </button>
              <button
                onClick={handleRun}
                disabled={loading || (mode === 'resumo' && !selectedDiaryId) || (mode === 'chat' && !input.trim())}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? 'Processando...' : mode === 'resumo' ? 'Gerar Resumo' : 'Enviar'}
              </button>
            </div>

            {output && (
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Resultado</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(output)}
                    className="text-xs text-gray-600 dark:text-gray-300 hover:underline"
                  >
                    Copiar
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words leading-relaxed">{output}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
};


