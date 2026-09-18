import React, { useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2 } from 'lucide-react';
import { UF_COORDENADAS, BRASIL_CENTRO } from '../lib/ufCoordenadas';

interface EstadoDado {
  uf: string;
  valor: number;
  count: number;
}

const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export const PropostasMap: React.FC<{ data: EstadoDado[] }> = ({ data }) => {
  const [fullscreen, setFullscreen] = useState(false);

  const maxValor = Math.max(...data.map((d) => d.valor), 1);
  const pontos = data
    .filter((d) => UF_COORDENADAS[d.uf])
    .map((d) => ({ ...d, coord: UF_COORDENADAS[d.uf] }));

  const mapContent = (
    <MapContainer
      center={BRASIL_CENTRO}
      zoom={fullscreen ? 5 : 4}
      scrollWheelZoom={fullscreen}
      dragging={fullscreen}
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
      {pontos.map((p) => {
        const radius = 8 + (p.valor / maxValor) * 28;
        return (
          <CircleMarker
            key={p.uf}
            center={p.coord}
            radius={radius}
            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.55, weight: 2 }}
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
    </MapContainer>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-950 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Distribuição geográfica — mapa</p>
          <button
            onClick={() => setFullscreen(false)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700"
          >
            <Minimize2 className="h-4 w-4" />
            Sair da tela cheia
          </button>
        </div>
        <div className="flex-1 min-h-0">{mapContent}</div>
      </div>
    );
  }

  return (
    <div className="relative h-64 rounded-lg overflow-hidden">
      {mapContent}
      <button
        onClick={() => setFullscreen(true)}
        className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 rounded-lg shadow hover:bg-white dark:hover:bg-gray-800"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Tela cheia
      </button>
    </div>
  );
};
