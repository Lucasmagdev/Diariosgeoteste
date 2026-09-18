export interface EstadoDado {
  uf: string;
  valor: number;
  count: number;
}

export interface PontoExato {
  id: string;
  lat: number;
  lon: number;
  label: string;
  numero: string | null;
  valor: number;
}

interface PropostaGeoInput {
  uf: string | null;
  valorTotal: number;
}

export const porEstadoFrom = (items: PropostaGeoInput[]): EstadoDado[] => {
  const map = new Map<string, { valor: number; count: number }>();
  items.forEach((p) => {
    const uf = p.uf || 'Sem estado';
    const entry = map.get(uf) || { valor: 0, count: 0 };
    entry.valor += p.valorTotal;
    entry.count += 1;
    map.set(uf, entry);
  });
  return Array.from(map.entries()).map(([uf, v]) => ({ uf, ...v })).sort((a, b) => b.valor - a.valor);
};

interface PontoGeoInput {
  id: string;
  latitude: number | null;
  longitude: number | null;
  clienteNome: string;
  numero: string | null;
  valorTotal: number;
}

export const pontosExatosFrom = (items: PontoGeoInput[]): PontoExato[] => items
  .filter((p): p is PontoGeoInput & { latitude: number; longitude: number } => p.latitude != null && p.longitude != null)
  .map((p) => ({ id: p.id, lat: p.latitude, lon: p.longitude, label: p.clienteNome, numero: p.numero, valor: p.valorTotal }));
