import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPinned } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Periodo, periodoSince } from '../lib/periodoFiltro';
import { PeriodoFilterButtons } from './ui';
import { PropostasMap } from './PropostasMap';
import { porEstadoFrom, pontosExatosFrom } from '../lib/propostasGeo';

interface Row {
  id: string;
  numero: string | null;
  cliente_nome: string;
  uf: string | null;
  valor_total: number;
  latitude: number | null;
  longitude: number | null;
  data_proposta: string | null;
  created_at: string;
}

// Pagina dedicada, aberta em aba propria (ver PropostasMap.tsx) — mapa
// grande, sem depender de Fullscreen API/CSS fixed (a causa da bagunça
// anterior de sobreposição em cima de modais).
export const PropostasMapPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>('tudo');

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured) { setLoading(false); return; }
      const { data, error } = await supabase
        .from('propostas')
        .select('id, numero, cliente_nome, uf, valor_total, latitude, longitude, data_proposta, created_at');
      if (!error) setRows(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const since = useMemo(() => periodoSince(periodo), [periodo]);

  const filtradas = useMemo(() => rows.filter((r) => {
    if (!since) return true;
    const ref = r.data_proposta ? new Date(r.data_proposta) : new Date(r.created_at);
    return ref >= since;
  }), [rows, since]);

  const porEstado = useMemo(() => porEstadoFrom(filtradas.map((r) => ({ uf: r.uf, valorTotal: Number(r.valor_total) || 0 }))), [filtradas]);
  const pontos = useMemo(() => pontosExatosFrom(filtradas.map((r) => ({
    id: r.id,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    clienteNome: r.cliente_nome,
    numero: r.numero,
    valorTotal: Number(r.valor_total) || 0,
  }))), [filtradas]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPinned className="h-5 w-5 text-green-600" />
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Propostas — distribuição geográfica</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{pontos.length} proposta{pontos.length !== 1 ? 's' : ''} com localização exata · {filtradas.length} no total do período</p>
          </div>
        </div>
        <PeriodoFilterButtons value={periodo} onChange={setPeriodo} />
      </header>

      <div className="flex-1 p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando mapa...
          </div>
        ) : (
          <PropostasMap data={porEstado} pontos={pontos} height="h-[calc(100vh-6rem)]" interactive showOpenButton={false} />
        )}
      </div>
    </div>
  );
};
