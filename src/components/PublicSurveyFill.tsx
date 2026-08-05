import React, { useCallback, useEffect, useState } from 'react';
import { Star, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

interface PublicSurveyFillProps {
  token: string;
}

interface RatingQuestion {
  key: string;
  label: string;
}

interface RatingSection {
  title: string;
  questions: RatingQuestion[];
}

const SECTIONS: RatingSection[] = [
  {
    title: 'Comercial',
    questions: [
      { key: 'comercial_atendimento', label: 'Atendimento da equipe comercial.' },
      { key: 'comercial_agilidade', label: 'Agilidade no envio da proposta e no retorno às solicitações.' },
      { key: 'comercial_clareza', label: 'Clareza das informações técnicas e comerciais.' },
    ],
  },
  {
    title: 'Operacional',
    questions: [
      { key: 'operacional_prazos', label: 'Cumprimento dos prazos acordados.' },
      { key: 'operacional_organizacao_campo', label: 'Organização e profissionalismo da equipe em campo.' },
      { key: 'operacional_qualidade_execucao', label: 'Qualidade na execução dos ensaios geotécnicos.' },
      { key: 'operacional_organizacao_operacao', label: 'Organização e profissionalismo da equipe responsável pela operação.' },
    ],
  },
  {
    title: 'Documentação',
    questions: [
      { key: 'documentacao_prazo_entrega', label: 'Prazo de entrega dos relatórios.' },
      { key: 'documentacao_clareza_relatorios', label: 'Clareza e qualidade técnica dos relatórios.' },
      { key: 'documentacao_atendimento', label: 'Atendimento da equipe responsável pela documentação.' },
    ],
  },
];

const RATING_LABELS: Record<number, string> = {
  1: 'Muito Insatisfeito',
  2: 'Insatisfeito',
  3: 'Regular',
  4: 'Satisfeito',
  5: 'Muito Satisfeito',
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const RatingScale: React.FC<{ value: number | null; onChange: (v: number) => void; max?: number; min?: number }> = ({ value, onChange, max = 5, min = 1 }) => {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-9 min-w-[2.25rem] rounded-lg border px-2 text-sm font-semibold transition-colors ${
            value === n
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-emerald-400'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
};

export const PublicSurveyFill: React.FC<PublicSurveyFillProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [survey, setSurvey] = useState<{ obra_name: string; client_name: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [empresa, setEmpresa] = useState('');
  const [obraNome, setObraNome] = useState('');
  const [dataReferencia, setDataReferencia] = useState(todayIso());
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [avaliacaoGeral, setAvaliacaoGeral] = useState<number | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [comentarioAgradou, setComentarioAgradou] = useState('');
  const [comentarioMelhorar, setComentarioMelhorar] = useState('');
  const [comentarioObservacao, setComentarioObservacao] = useState('');

  const fetchSurvey = useCallback(async () => {
    if (!token) { setError('Link inválido.'); setLoading(false); return; }
    if (!isSupabaseConfigured) { setError('Sistema indisponível no momento.'); setLoading(false); return; }
    try {
      setLoading(true);
      setError('');
      const { data, error: rpcError } = await supabase.rpc('get_satisfaction_survey_for_public_link', { p_token: token });
      if (rpcError) throw rpcError;
      if (!data?.valid) {
        const reason = data?.reason;
        if (reason === 'expired') setError('Este link expirou.');
        else if (reason === 'revoked') setError('Este link foi revogado.');
        else setError('Link inválido.');
        setSurvey(null);
        return;
      }
      setSurvey({ obra_name: data.obra_name, client_name: data.client_name });
      setEmpresa(data.client_name || '');
      setObraNome(data.obra_name || '');
    } catch (err) {
      console.error('get_satisfaction_survey_for_public_link', err);
      setError('Não foi possível carregar a pesquisa.');
      setSurvey(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchSurvey(); }, [fetchSurvey]);

  const allQuestions = SECTIONS.flatMap(s => s.questions);
  const missingRatings = allQuestions.filter(q => !ratings[q.key]).length;
  const canSubmit = missingRatings === 0 && avaliacaoGeral !== null && nps !== null;

  const handleSubmit = async () => {
    if (!canSubmit) { setSubmitError('Responda todas as avaliações antes de enviar.'); return; }
    try {
      setSubmitting(true);
      setSubmitError('');
      const payload = {
        empresa: empresa.trim(),
        obra_nome: obraNome.trim(),
        data_referencia: dataReferencia || null,
        ratings,
        avaliacao_geral: avaliacaoGeral,
        nps,
        comentario_agradou: comentarioAgradou.trim(),
        comentario_melhorar: comentarioMelhorar.trim(),
        comentario_observacao: comentarioObservacao.trim(),
      };
      const { data, error: rpcError } = await supabase.rpc('submit_satisfaction_survey', { p_token: token, p_payload: payload });
      if (rpcError) throw rpcError;
      if (!data?.ok) {
        const reasons: Record<string, string> = {
          expired: 'Este link expirou.',
          revoked: 'Este link foi revogado.',
          invalid_token: 'Link inválido.',
          missing_ratings: 'Responda todas as avaliações antes de enviar.',
          missing_avaliacao_geral: 'Informe a avaliação geral.',
          missing_nps: 'Informe a probabilidade de recomendação.',
        };
        setSubmitError(reasons[data?.reason] || 'Não foi possível enviar a pesquisa.');
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error('submit_satisfaction_survey', err);
      setSubmitError('Não foi possível enviar a pesquisa.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Carregando pesquisa...</p>
        </div>
      </div>
    );
  }

  if (error && !survey) {
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
                  <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Pesquisa de Satisfação</h1>
                  <p className="mt-2 max-w-xl text-sm text-emerald-50/90">
                    Sua opinião é fundamental para a melhoria contínua dos nossos serviços. Leva cerca de 2 minutos.
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

        {submitted ? (
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Obrigado pela sua resposta!</h2>
            <p className="text-sm text-gray-500 mt-1">Sua opinião foi registrada com sucesso.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Empresa</label>
                <input value={empresa} onChange={e => setEmpresa(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2.5 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Obra</label>
                <input value={obraNome} onChange={e => setObraNome(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2.5 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Data</label>
                <input type="date" value={dataReferencia} onChange={e => setDataReferencia(e.target.value)} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2.5 text-gray-900 dark:text-gray-100" />
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 px-3 py-2 text-xs text-gray-500">
              Escala: 1 = Muito Insatisfeito · 2 = Insatisfeito · 3 = Regular · 4 = Satisfeito · 5 = Muito Satisfeito
            </div>

            {SECTIONS.map(section => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3">{section.title}</h3>
                <div className="space-y-4">
                  {section.questions.map(q => (
                    <div key={q.key}>
                      <p className="text-sm text-gray-800 dark:text-gray-100 mb-1.5">{q.label}</p>
                      <RatingScale value={ratings[q.key] ?? null} onChange={v => setRatings(prev => ({ ...prev, [q.key]: v }))} />
                      {ratings[q.key] && <p className="mt-1 text-[11px] text-gray-400">{RATING_LABELS[ratings[q.key]]}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
              <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2"><Star className="h-4 w-4" /> Avaliação Geral</h3>
              <p className="text-sm text-gray-800 dark:text-gray-100 mb-1.5">Como você avalia a Geoteste de forma geral?</p>
              <RatingScale value={avaliacaoGeral} onChange={setAvaliacaoGeral} />

              <p className="text-sm text-gray-800 dark:text-gray-100 mt-5 mb-1.5">Em uma escala de 0 a 10, qual a probabilidade de recomendar a Geoteste a um colega ou empresa?</p>
              <RatingScale value={nps} onChange={setNps} min={0} max={10} />
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4">
              <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comentários</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">O que mais lhe agradou em nosso atendimento?</label>
                <textarea value={comentarioAgradou} onChange={e => setComentarioAgradou(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2.5 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Há algum ponto que podemos melhorar?</label>
                <textarea value={comentarioMelhorar} onChange={e => setComentarioMelhorar(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2.5 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Deseja registrar algum elogio, sugestão ou observação?</label>
                <textarea value={comentarioObservacao} onChange={e => setComentarioObservacao(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2.5 text-gray-900 dark:text-gray-100" />
              </div>
            </div>

            {missingRatings > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {missingRatings} avaliação(ões) pendente(s). Não é possível enviar enquanto isso não for resolvido.
              </p>
            )}
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
              <button onClick={handleSubmit} disabled={submitting || !canSubmit} className="rounded-xl bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                {submitting ? 'Enviando...' : 'Enviar respostas'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
