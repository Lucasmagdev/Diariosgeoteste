import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Users, Building2, TrendingUp, Loader2,
  Plus, ChevronRight, Calendar, Activity, ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { PullToRefresh } from './PullToRefresh';
import { PageHeader } from './ui';

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 5) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  if (hours < 24) return `há ${hours}h`;
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
  'bg-rose-500', 'bg-teal-500', 'bg-indigo-500', 'bg-amber-500',
];
function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

const COLOR_STYLES: Record<string, { icon: string; border: string }> = {
  green:  { icon: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400', border: 'border-l-emerald-500' },
  blue:   { icon: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',             border: 'border-l-blue-500'    },
  purple: { icon: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',      border: 'border-l-purple-500'  },
  orange: { icon: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',      border: 'border-l-orange-500'  },
};

export const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setStats(user?.role === 'admin' ? [
        { label: 'Diários Criados', value: '0', icon: FileText,   color: 'green',  description: 'total geral',     navigateTo: 'diaries' },
        { label: 'Usuários Ativos', value: '0', icon: Users,      color: 'blue',   description: 'colaboradores',   navigateTo: 'users'   },
        { label: 'Clientes',        value: '0', icon: Building2,  color: 'purple', description: 'cadastrados',     navigateTo: 'clients' },
        { label: 'Crescimento',     value: '0%',icon: TrendingUp, color: 'orange', description: 'este mês'                               },
      ] : [
        { label: 'Meus Diários',  value: '0',     icon: FileText,  color: 'green',  description: 'total geral',     navigateTo: 'diaries' },
        { label: 'Esta Semana',   value: '0',     icon: TrendingUp,color: 'blue',   description: 'últimos 7 dias',  navigateTo: 'diaries' },
        { label: 'Último Diário', value: 'Nunca', icon: Calendar,  color: 'purple', description: 'data do registro',navigateTo: 'diaries' },
      ]);
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (user.role === 'admin') {
        const [diariesRes, usersRes, clientsRes] = await Promise.all([
          supabase.from('work_diaries').select('id, created_at, client_name'),
          supabase.from('profiles').select('id, created_at'),
          supabase.from('clients').select('id'),
        ]);

        if (diariesRes.error) throw diariesRes.error;
        if (usersRes.error) throw usersRes.error;

        const totalDiaries = diariesRes.data?.length || 0;
        const totalUsers   = usersRes.data?.length   || 0;
        const totalClients = clientsRes.data?.length || 0;

        const now = new Date();
        const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);
        const diariesThisMonth = diariesRes.data?.filter(d => new Date(d.created_at) >= startOfMonth).length || 0;
        const diariesLastMonth = diariesRes.data?.filter(d =>
          new Date(d.created_at) >= lastMonthStart && new Date(d.created_at) <= lastMonthEnd
        ).length || 1;
        const growth = Math.round(((diariesThisMonth - diariesLastMonth) / diariesLastMonth) * 100);

        setStats([
          { label: 'Diários Criados', value: totalDiaries.toString(),                          icon: FileText,   color: 'green',  description: 'total geral',     navigateTo: 'diaries' },
          { label: 'Usuários Ativos', value: totalUsers.toString(),                             icon: Users,      color: 'blue',   description: 'colaboradores',   navigateTo: 'users'   },
          { label: 'Clientes',        value: totalClients.toString(),                           icon: Building2,  color: 'purple', description: 'cadastrados',     navigateTo: 'clients' },
          { label: 'Crescimento',     value: `${growth >= 0 ? '+' : ''}${growth}%`,            icon: TrendingUp, color: 'orange', description: 'este mês'                               },
        ]);
      } else {
        const { data: diaries, error: err } = await supabase
          .from('work_diaries').select('id, created_at, client_name')
          .eq('user_id', user.id).order('created_at', { ascending: false });

        if (err) throw err;

        const totalDiaries = diaries?.length || 0;
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        const thisWeek = diaries?.filter(d => new Date(d.created_at) >= weekAgo).length || 0;
        const lastDate = diaries?.[0] ? new Date(diaries[0].created_at).toLocaleDateString('pt-BR') : 'Nunca';

        setStats([
          { label: 'Meus Diários',  value: totalDiaries.toString(), icon: FileText,   color: 'green',  description: 'total geral',      navigateTo: 'diaries' },
          { label: 'Esta Semana',   value: thisWeek.toString(),      icon: TrendingUp, color: 'blue',   description: 'últimos 7 dias',   navigateTo: 'diaries' },
          { label: 'Último Diário', value: lastDate,                 icon: Calendar,   color: 'purple', description: 'data do registro', navigateTo: 'diaries' },
        ]);
      }

      const actQuery = user.role === 'admin'
        ? supabase.from('work_diaries').select('id, client_name, created_at, user_id').order('created_at', { ascending: false }).limit(8)
        : supabase.from('work_diaries').select('id, client_name, created_at, user_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8);

      const { data: recent, error: actErr } = await actQuery;
      if (actErr) throw actErr;

      const userIds = [...new Set((recent || []).map(d => d.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds);
      const profileMap = (profiles || []).reduce((acc: any, p: any) => { acc[p.id] = p.name || 'Usuário'; return acc; }, {});

      setActivities((recent || []).map((d: any) => ({
        id:        d.id,
        clientName: d.client_name,
        createdAt:  d.created_at,
        userName:   profileMap[d.user_id] || 'Usuário',
      })));
    } catch (err: any) {
      console.error('Erro ao buscar dados do dashboard:', err);
      setError('Não foi possível carregar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const handleRefresh = async () => {
    await fetchDashboardData();
    await new Promise(r => setTimeout(r, 300));
  };

  const quickActions = user?.role === 'admin' ? [
    { label: 'Novo Diário', icon: Plus,      page: 'new-diary' },
    { label: 'Ver Diários', icon: FileText,  page: 'diaries'   },
    { label: 'Usuários',    icon: Users,     page: 'users'     },
    { label: 'Clientes',    icon: Building2, page: 'clients'   },
  ] : [
    { label: 'Novo Diário',  icon: Plus,     page: 'new-diary' },
    { label: 'Meus Diários', icon: FileText, page: 'diaries'   },
  ];

  const firstName = user?.name?.split(' ')[0] || 'Usuário';
  const statsCount = loading ? (user?.role === 'admin' ? 4 : 3) : stats.length;

  const dashboardContent = (
    <div className="space-y-6 sm:space-y-8">

      <PageHeader
        eyebrow={getGreeting()}
        title={`Olá, ${firstName}`}
        description={user?.role === 'admin' ? 'Acompanhe a operação e as pendências do sistema.' : 'Acompanhe seus diários e atividades recentes.'}
      />

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div>
        <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${statsCount === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {loading
            ? Array.from({ length: statsCount }).map((_, i) => (
                <div key={i} className="mobile-card p-4 sm:p-5 animate-pulse">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                    <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                  </div>
                  <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-14 mb-1" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                </div>
              ))
            : stats.map((stat, i) => {
                const Icon   = stat.icon;
                const colors = COLOR_STYLES[stat.color as keyof typeof COLOR_STYLES];
                return (
                  <div
                    key={i}
                    onClick={() => stat.navigateTo && onPageChange?.(stat.navigateTo)}
                    className={`mobile-card border-l-4 ${colors.border} p-4 sm:p-5 transition-[border-color,box-shadow,background-color] duration-150
                      ${stat.navigateTo ? 'cursor-pointer hover:shadow-sm' : ''}`}
                    style={{ animationDelay: `${i * 0.07}s` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight pr-1">{stat.label}</p>
                      <div className={`w-9 h-9 ${colors.icon} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-0.5 leading-none">{stat.value}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400 dark:text-gray-500">{stat.description}</p>
                      {stat.navigateTo && <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600" />}
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 px-0.5">Ações Rápidas</h2>
        <div className={`grid gap-3 ${quickActions.length === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={i}
                onClick={() => onPageChange?.(action.page)}
                className="app-surface app-surface-interactive flex min-h-24 flex-col items-center justify-center gap-2 p-4 text-gray-800 dark:text-gray-100"
              >
                <div className="w-9 h-9 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-xl flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-center leading-tight">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mobile-card overflow-hidden scroll-animate-up">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Atividade Recente</h2>
          </div>
          <button
            onClick={() => onPageChange?.('diaries')}
            className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            Ver todos
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Carregando...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-3">
              <FileText className="w-7 h-7 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Nenhum diário registrado</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Crie seu primeiro diário de obra</p>
            <button onClick={() => onPageChange?.('new-diary')} className="btn-primary text-xs px-4 py-2">
              Criar Diário
            </button>
          </div>
        ) : (
          <ul>
            {activities.map((activity, i) => (
              <li
                key={activity.id || i}
                onClick={() => onPageChange?.('diaries')}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors duration-150 touch-feedback group border-b border-gray-50 dark:border-gray-800/50 last:border-0"
              >
                <div className={`w-9 h-9 ${avatarColor(activity.userName)} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white text-xs font-bold">{getInitials(activity.userName)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {activity.clientName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{activity.userName}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{formatRelativeTime(activity.createdAt)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 group-hover:text-emerald-500 transition-colors" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="animate-fade-in hidden md:block">
        {dashboardContent}
      </div>
      <div className="md:hidden block h-full">
        <PullToRefresh onRefresh={handleRefresh}>
          {dashboardContent}
        </PullToRefresh>
      </div>
    </>
  );
};
