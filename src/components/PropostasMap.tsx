import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink } from 'lucide-react';
import { UF_COORDENADAS, BRASIL_CENTRO } from '../lib/ufCoordenadas';
import type { EstadoDado, PontoExato } from '../lib/propostasGeo';

const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Preferimos abrir o mapa numa aba nova (mesma logica do Malão Geoteste em
// App.tsx) a fazer fullscreen dentro da pagina: fullscreen via CSS/Fullscreen
// API depende de contexto de stacking dos ancestrais e é fácil de vazar por
// cima de modais — uma aba propria elimina essa classe de bug de vez.
const abrirMapaEmNovaAba = () => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mapaComercial', '1');
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
};

interface PropostasMapProps {
  data: EstadoDado[];
  pontos?: PontoExato[];
  height?: string;
  interactive?: boolean;
  showOpenButton?: boolean;
}

export const PropostasMap: React.FC<PropostasMapProps> = ({ data, pontos = [], height = 'h-64', interactive = false, showOpenButton = true }) => {
  const maxValor = Math.max(...data.map((d) => d.valor), 1);
  const estados = data.filter((d) => UF_COORDENADAS[d.uf]).map((d) => ({ ...d, coord: UF_COORDENADAS[d.uf] }));

  return (
    <div className={`relative ${height} rounded-lg overflow-hidden`}>
      <MapContainer
        center={BRASIL_CENTRO}
        zoom={interactive ? 5 : 4}
        scrollWheelZoom={interactive}
        dragging={interactive}
        className="h-full w-full rounded-lg proposta-map-dark"
        style={{ background: '#0f172a' }}
      >
        {/* OSM padrão — o tile escuro do CartoDB passou a exigir API key
            paga (mudança deles, sem aviso). Filtro CSS (.proposta-map-dark)
            escurece/inverte pra manter a estética sem depender de chave. */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {estados.map((p) => {
          const radius = 8 + (p.valor / maxValor) * 28;
          return (
            <CircleMarker
              key={p.uf}
              center={p.coord}
              radius={radius}
              pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.35, weight: 2 }}
            >
              <Popup>
                <strong>{p.uf}</strong>
                <br />
                {currency(p.valor)}
                <br />
                {p.count} proposta{p.count !== 1 ? 's' : ''}
              </Popup>
            </CircleMarker>
          );
        })}
        {pontos.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={6}
            pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.9, weight: 1.5 }}
          >
            <Popup>
              <strong>{p.numero || 'Sem número'}</strong>
              <br />
              {p.label}
              <br />
              {currency(p.valor)}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {showOpenButton && (
        <button
          onClick={abrirMapaEmNovaAba}
          className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 rounded-lg shadow hover:bg-white dark:hover:bg-gray-800"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir em nova aba
        </button>
      )}
    </div>
  );
};
