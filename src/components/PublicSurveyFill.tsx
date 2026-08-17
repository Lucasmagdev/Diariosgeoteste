import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Star, MessageSquare, ShieldCheck, CheckCircle2, Send, ThumbsUp, Building2, MapPin, CalendarDays, LucideIcon } from 'lucide-react';
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
      { key: 'operacional_organizacao_campo', label: 'Organização e profissionalismo da equipe em campo.' },
      { key: 'operacional_qualidade_execucao', label: 'Qualidade na execução dos ensaios geotécnicos.' },
      { key: 'operacional_prazos_operacao', label: 'Cumprimento dos prazos e organização da equipe responsável pela operação.' },
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

const RATING_QUESTIONS = SECTIONS.flatMap(s => s.questions);
const GENERAL_KEY = 'avaliacao_geral';
const NPS_KEY = 'nps';
const ALL_KEYS = [...RATING_QUESTIONS.map(q => q.key), GENERAL_KEY, NPS_KEY];

const RATING_LABELS: Record<number, string> = {
  1: 'Muito insatisfeito',
  2: 'Insatisfeito',
  3: 'Regular',
  4: 'Satisfeito',
  5: 'Muito satisfeito',
};

// cor por nota: feedback emocional imediato (vermelho -> verde)
const SCORE_TONE_5: Record<number, string> = {
  1: 'border-red-500 bg-red-500 text-white shadow-red-500/30',
  2: 'border-orange-500 bg-orange-500 text-white shadow-orange-500/30',
  3: 'border-amber-500 bg-amber-500 text-white shadow-amber-500/30',
  4: 'border-lime-600 bg-lime-600 text-white shadow-lime-600/30',
  5: 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/30',
};

const SCORE_TEXT_5: Record<number, string> = {
  1: 'text-red-600 dark:text-red-400',
  2: 'text-orange-600 dark:text-orange-400',
  3: 'text-amber-600 dark:text-amber-400',
  4: 'text-lime-700 dark:text-lime-400',
  5: 'text-emerald-700 dark:text-emerald-400',
};

const SCALE_LEGEND_BAR: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-amber-500',
  4: 'bg-lime-600',
  5: 'bg-emerald-600',
};

/** Datas puras (YYYY-MM-DD) formatadas sem new Date(), que as leria como UTC. */
const formatDateBR = (value: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (value || '—');
};

const IdentityCell: React.FC<{ icon: LucideIcon; label: string; value: string; className?: string }> = ({ icon: Icon, label, value, className = '' }) => (
  <div className={`bg-emerald-900/20 px-4 py-3 ${className}`}>
    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100/70">
      <Icon className="h-3 w-3" /> {label}
    </p>
    <p className="mt-1 text-sm font-semibold leading-snug text-white [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden" title={value}>{value}</p>
  </div>
);

const npsTone = (n: number) => {
  if (n <= 6) return 'border-red-500 bg-red-500 text-white shadow-red-500/30';
  if (n <= 8) return 'border-amber-500 bg-amber-500 text-white shadow-amber-500/30';
  return 'border-emerald-600 bg-emerald-600 text-white shadow-emerald-600/30';
};

const npsLabel = (n: number) => (n <= 6 ? 'Pouco provável' : n <= 8 ? 'Provável' : 'Muito provável');

const todayIso = () => new Date().toISOString().slice(0, 10);

const RatingScale: React.FC<{
  value: number | null;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  toneFor: (n: number) => string;
}> = ({ value, onChange, min = 1, max = 5, toneFor }) => {
  const options = useMemo(() => Array.from({ length: max - min + 1 }, (_, i) => min + i), [min, max]);
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {options.map(n => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`Nota ${n}`}
            aria-pressed={active}
            className={`h-11 min-w-[2.75rem] flex-1 sm:flex-none rounded-xl border-2 px-2 text-sm font-bold transition-all duration-150 active:scale-95 ${
              active
                ? `${toneFor(n)} scale-105 shadow-lg`
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-500 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
            }`}
          >
            {n}
          </button>
        );
      })}
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
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const [empresa, setEmpresa] = useState('');
  const [obraNome, setObraNome] = useState('');
  const [dataReferencia] = useState(todayIso());
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [avaliacaoGeral, setAvaliacaoGeral] = useState<number | null>(null);
  const [nps, setNps] = useState<number | null>(null);
  const [comentarioAgradou, setComentarioAgradou] = useState('');
  const [comentarioMelhorar, setComentarioMelhorar] = useState('');
  const [comentarioObservacao, setComentarioObservacao] = useState('');

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    } catch (err) {
      console.error('get_satisfaction_survey_for_public_link', err);
      setError('Não foi possível carregar a pesquisa.');
      setSurvey(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchSurvey(); }, [fetchSurvey]);

  // O CSS global prende o body (position: fixed) abaixo de 768px e joga a rolagem
  // para o #root. Nesta pagina publica isso trava o scroll no meio do formulario,
  // entao devolvemos a rolagem nativa do documento enquanto ela estiver montada.
  useEffect(() => {
    const root = document.getElementById('root');
    const prev = {
      position: document.body.style.position,
      overflow: document.body.style.overflow,
      height: document.body.style.height,
      width: document.body.style.width,
      rootOverflow: root?.style.overflow ?? '',
      rootHeight: root?.style.height ?? '',
    };
    document.body.style.position = 'static';
    document.body.style.overflow = 'visible';
    document.body.style.height = 'auto';
    document.body.style.width = 'auto';
    if (root) { root.style.overflow = 'visible'; root.style.height = 'auto'; }
    return () => {
      document.body.style.position = prev.position;
      document.body.style.overflow = prev.overflow;
      document.body.style.height = prev.height;
      document.body.style.width = prev.width;
      if (root) { root.style.overflow = prev.rootOverflow; root.style.height = prev.rootHeight; }
    };
  }, []);

  const answeredMap: Record<string, boolean> = useMemo(() => {
    const m: Record<string, boolean> = {};
    RATING_QUESTIONS.forEach(q => { m[q.key] = !!ratings[q.key]; });
    m[GENERAL_KEY] = avaliacaoGeral !== null;
    m[NPS_KEY] = nps !== null;
    return m;
  }, [ratings, avaliacaoGeral, nps]);

  const answeredCount = ALL_KEYS.filter(k => answeredMap[k]).length;
  const progress = Math.round((answeredCount / ALL_KEYS.length) * 100);
  const canSubmit = answeredCount === ALL_KEYS.length;

  const scrollToKey = (key: string) => {
    const el = questionRefs.current[key];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const answerRating = (key: string, value: number) => {
    setRatings(prev => ({ ...prev, [key]: value }));
    setHighlightKey(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      const firstPending = ALL_KEYS.find(k => !answeredMap[k]);
      if (firstPending) {
        setHighlightKey(firstPending);
        setSubmitError('Faltam respostas. Levamos você até a primeira pendente.');
        scrollToKey(firstPending);
      }
      return;
    }
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
          too_fast: 'Uma resposta acabou de ser enviada por este link. Aguarde alguns segundos e tente de novo.',
          link_full: 'Este link já atingiu o limite de respostas. Peça um link novo à Geoteste.',
        };
        setSubmitError(reasons[data?.reason] || 'Não foi possível enviar a pesquisa.');
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <div className="text-center animate-fadeIn">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Carregando pesquisa...</p>
        </div>
      </div>
    );
  }

  if (error && !survey) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-2xl p-6 animate-scaleIn">
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">Link indisponível</h1>
          <p className="text-sm text-gray-700 dark:text-gray-200">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f3f7f5] dark:bg-gray-950 flex items-center justify-center p-5">
        <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 text-center animate-scaleIn">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-9 w-9 text-emerald-600 animate-scaleIn" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Obrigado pela sua resposta!</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
            Sua opinião é essencial para que a Geoteste continue aprimorando a qualidade dos seus serviços
            e do atendimento aos clientes.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <ThumbsUp className="h-4 w-4" /> Resposta registrada com segurança
          </div>
        </div>
      </div>
    );
  }

  const questionCard = (key: string, label: string, node: React.ReactNode, footer?: React.ReactNode) => {
    const answered = answeredMap[key];
    const highlighted = highlightKey === key;
    return (
      <div
        key={key}
        ref={el => { questionRefs.current[key] = el; }}
        className={`rounded-xl border p-3.5 transition-all duration-300 ${
          highlighted
            ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-900/10 ring-2 ring-amber-300/50'
            : answered
              ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/5'
              : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug">{label}</p>
          {answered && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600 animate-scaleIn" />}
        </div>
        {node}
        {footer}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f3f7f5] dark:bg-gray-950 pb-28 sm:pb-8">
      {/* progresso sticky */}
      <div className="sticky top-0 z-20 border-b border-emerald-900/10 bg-white/85 dark:bg-gray-950/85 backdrop-blur">
        <div className="max-w-2xl mx-auto px-3 sm:px-6 py-2.5">
          <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
            <span>{answeredCount} de {ALL_KEYS.length} respondidas</span>
            <span className={progress === 100 ? 'text-emerald-700 dark:text-emerald-400 font-bold' : ''}>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-green-500 transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="py-5 sm:py-8 px-3 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-5">
          <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 text-white shadow-lg shadow-emerald-900/10 animate-fadeIn">
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
                <div className="inline-flex self-start items-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur">
                  <ShieldCheck className="h-4 w-4" />
                  Link seguro
                </div>
              </div>
            </div>

            {/* data: informativa, vem do proprio link */}
            <div className="grid grid-cols-1 gap-px border-t border-white/15 bg-white/10">
              <IdentityCell icon={CalendarDays} label="Data" value={formatDateBR(dataReferencia)} />
            </div>
          </header>

          {/* identificacao: o cliente preenche pra abrir a pesquisa, tem que ficar obvio */}
          <section className="rounded-2xl bg-white dark:bg-gray-900 border-2 border-emerald-200 dark:border-emerald-900/60 p-5 sm:p-6 scroll-animate-up">
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 mb-4 flex items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-emerald-600" />
              Identificação
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1.5">
                  Empresa <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                  <input
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    placeholder="Nome da empresa"
                    className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3.5 text-gray-900 dark:text-gray-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1.5">
                  Obra <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                  <input
                    value={obraNome}
                    onChange={(e) => setObraNome(e.target.value)}
                    placeholder="Nome da obra"
                    className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 py-3 pl-10 pr-3.5 text-gray-900 dark:text-gray-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* legenda da escala, nas mesmas cores dos botoes de nota */}
          <section className="overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 scroll-animate-up">
            <div className="px-5 sm:px-6 py-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Como funciona a escala</p>
              <div className="flex items-stretch gap-1.5">
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className="flex-1 text-center">
                    <div className={`h-1.5 rounded-full ${SCALE_LEGEND_BAR[n]}`} />
                    <p className={`mt-1.5 text-xs font-bold ${SCORE_TEXT_5[n]}`}>{n}</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-gray-500 hidden sm:block">{RATING_LABELS[n]}</p>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-medium text-gray-400 sm:hidden">
                <span>Muito insatisfeito</span>
                <span>Muito satisfeito</span>
              </div>
            </div>
          </section>

          {SECTIONS.map(section => (
            <section key={section.title} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 sm:p-6 scroll-animate-up">
              <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 mb-4 flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-emerald-600" />
                {section.title}
              </h2>
              <div className="space-y-2.5">
                {section.questions.map(q =>
                  questionCard(
                    q.key,
                    q.label,
                    <RatingScale value={ratings[q.key] ?? null} onChange={v => answerRating(q.key, v)} toneFor={n => SCORE_TONE_5[n]} />,
                    ratings[q.key] ? (
                      <p className={`mt-2 text-xs font-semibold animate-fadeIn ${SCORE_TEXT_5[ratings[q.key]]}`}>{RATING_LABELS[ratings[q.key]]}</p>
                    ) : null,
                  ),
                )}
              </div>
            </section>
          ))}

          <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 sm:p-6 scroll-animate-up">
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 mb-4 flex items-center gap-2">
              <Star className="h-4 w-4" /> Avaliação Geral
            </h2>
            <div className="space-y-2.5">
              {questionCard(
                GENERAL_KEY,
                'Como você avalia a Geoteste de forma geral?',
                <RatingScale
                  value={avaliacaoGeral}
                  onChange={v => { setAvaliacaoGeral(v); setHighlightKey(null); }}
                  toneFor={n => SCORE_TONE_5[n]}
                />,
                avaliacaoGeral ? (
                  <p className={`mt-2 text-xs font-semibold animate-fadeIn ${SCORE_TEXT_5[avaliacaoGeral]}`}>{RATING_LABELS[avaliacaoGeral]}</p>
                ) : null,
              )}
              {questionCard(
                NPS_KEY,
                'Em uma escala de 0 a 10, qual a probabilidade de recomendar a Geoteste a um colega ou empresa?',
                <RatingScale
                  value={nps}
                  onChange={v => { setNps(v); setHighlightKey(null); }}
                  min={0}
                  max={10}
                  toneFor={npsTone}
                />,
                nps !== null ? (
                  <p className={`mt-2 text-xs font-semibold animate-fadeIn ${nps <= 6 ? 'text-red-600 dark:text-red-400' : nps <= 8 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {npsLabel(nps)}
                  </p>
                ) : null,
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 sm:p-6 space-y-4 scroll-animate-up">
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Comentários
              <span className="ml-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-gray-500">opcional</span>
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">O que mais lhe agradou em nosso atendimento?</label>
              <textarea value={comentarioAgradou} onChange={e => setComentarioAgradou(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2.5 text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Há algum ponto que podemos melhorar?</label>
              <textarea value={comentarioMelhorar} onChange={e => setComentarioMelhorar(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2.5 text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">Deseja registrar algum elogio, sugestão ou observação?</label>
              <textarea value={comentarioObservacao} onChange={e => setComentarioObservacao(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3.5 py-2.5 text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition" />
            </div>
          </section>

          {submitError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fadeIn dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-300">
              {submitError}
            </p>
          )}

          {/* acao desktop */}
          <div className="hidden sm:flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all duration-150 hover:bg-emerald-800 active:scale-95 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Enviando...' : canSubmit ? 'Enviar respostas' : `Faltam ${ALL_KEYS.length - answeredCount}`}
            </button>
          </div>
        </div>
      </div>

      {/* acao mobile fixa */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-20 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 px-3 py-3 backdrop-blur">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 font-semibold text-white shadow-lg shadow-emerald-900/20 transition-all duration-150 active:scale-95 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Enviando...' : canSubmit ? 'Enviar respostas' : `Faltam ${ALL_KEYS.length - answeredCount} respostas`}
        </button>
      </div>
    </div>
  );
};
