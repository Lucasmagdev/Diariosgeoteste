import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import {
  Loader2,
  MapPin,
  RefreshCw,
  Target,
  Building2,
  Send,
  Pencil,
  Trash,
  Sparkles,
  ListFilter,
  Plus,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { EquipmentLocation, Client } from '../types';
import { useToast } from '../contexts/ToastContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import FormInput from './FormInput';
import FormTextarea from './FormTextarea';
import EmptyState from './EmptyState';
import ConfirmDialog from './ConfirmDialog';
import { EquipmentCollaboratorsPanel } from './EquipmentCollaboratorsPanel';
import { PageHeader } from './ui';

const defaultCenter: LatLngExpression = [-15.78, -47.93]; // Brasília como centro padrão

const mockEquipment: EquipmentLocation[] = [
  {
    id: 'mock-1',
    name: 'Sonda 01 - Obra Centro',
    description: 'Equipamento em operação na obra central.',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    latitude: -23.5632106,
    longitude: -46.6542508,
    clientId: '1',
    clientName: 'Construtora ABC Ltda',
    status: 'ativo',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    name: 'Sonda 02 - Zona Sul',
    description: 'Equipamento em deslocamento.',
    address: 'Rua Voluntários da Pátria, 500 - Rio de Janeiro, RJ',
    latitude: -22.90278,
    longitude: -43.2075,
    clientId: '2',
    clientName: 'Incorporadora XYZ',
    status: 'em manutenção',
    createdAt: new Date().toISOString(),
  },
];

const mockClients: Client[] = [
  {
    id: '1',
    name: 'Construtora ABC Ltda',
    email: 'contato@abc.com.br',
    phone: '(11) 3333-4444',
    address: 'Av. Paulista, 1000 - São Paulo, SP',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Incorporadora XYZ',
    email: 'projetos@xyz.com.br',
    phone: '(21) 5555-6666',
    address: 'Rua Copacabana, 200 - Rio de Janeiro, RJ',
    createdAt: new Date().toISOString(),
  },
];

const statusOptions = ['ativo', 'em manutenção', 'desativado'] as const;
const statusFilterOptions: Array<'all' | (typeof statusOptions)[number]> = ['all', ...statusOptions];

const statusColors: Record<string, string> = {
  ativo: '#16a34a',
  'em manutenção': '#dc2626',
  desativado: '#facc15',
};

const getStatusColor = (status: string) => statusColors[status?.toLowerCase()] ?? '#16a34a';
const formatStatusLabel = (status: string) =>
  status === 'all' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1);

const createMarkerIcon = (color: string) =>
  L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    html: `
      <span style="
        display: block;
        width: 22px;
        height: 22px;
        border-radius: 9999px;
        background: ${color};
        border: 4px solid #ffffff;
        box-shadow: 0 0 0 6px ${color}33;
      "></span>
    `,
  });

const MapAutoCenter: React.FC<{ center: LatLngExpression }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom() < 12 ? 13 : map.getZoom(), {
      duration: 0.8,
    });
  }, [center, map]);
  return null;
};

export const EquipmentMap: React.FC = () => {
  const toast = useToast();
  const [equipmentList, setEquipmentList] = useState<EquipmentLocation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentLocation | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentLocation | null>(null);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    clientId: '',
    address: '',
    latitude: '',
    longitude: '',
    status: 'ativo',
    description: '',
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'ativo' | 'em manutenção' | 'desativado'>('all');
  const [clientFilter, setClientFilter] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    target: EquipmentLocation | null;
  }>({ isOpen: false, target: null });

  useEffect(() => {
    setIsMapReady(true);
    fetchClients();
    fetchEquipment();
  }, []);

  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((item) => {
      const statusMatch = statusFilter === 'all' || item.status === statusFilter;
      const clientMatch = !clientFilter || item.clientId === clientFilter;
      return statusMatch && clientMatch;
    });
  }, [equipmentList, statusFilter, clientFilter]);

  useEffect(() => {
    if (selectedEquipment && !filteredEquipment.some((item) => item.id === selectedEquipment.id)) {
      setSelectedEquipment(filteredEquipment[0] ?? null);
    }
  }, [filteredEquipment, selectedEquipment]);

  const hasCoordinates = Boolean(formData.latitude && formData.longitude);

  const fetchClients = async () => {
    if (!isSupabaseConfigured) {
      setClients(mockClients);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, address')
        .order('name', { ascending: true });
      if (error) throw error;
      setClients(
        data?.map((client) => ({
          id: client.id,
          name: client.name,
          email: '',
          phone: '',
          address: client.address,
          createdAt: '',
        })) ?? []
      );
    } catch {
      toast.error('Erro ao carregar clientes');
    }
  };

  const mapRowToEquipment = (row: any): EquipmentLocation => ({
    id: row.id,
    name: row.name,
    description: row.description,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    clientId: row.client_id,
    clientName: row.clients?.name,
    status: row.status ?? 'ativo',
    createdAt: row.created_at ?? new Date().toISOString(),
  });

  const fetchEquipment = async () => {
    if (!isSupabaseConfigured) {
      setEquipmentList(mockEquipment);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('equipment_locations')
        .select('*, clients(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEquipmentList((data ?? []).map(mapRowToEquipment));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar equipamentos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeocode = async () => {
    if (!formData.address.trim()) {
      toast.error('Informe um endereço para localizar');
      return;
    }
    setIsGeocoding(true);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('countrycodes', 'br');
      url.searchParams.set('q', formData.address);

      const response = await fetch(url.toString(), {
        headers: {
          'Accept-Language': 'pt-BR',
        },
      });
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        toast.error('Endereço não encontrado');
        return;
      }
      const location = data[0];
      setFormData((prev) => ({
        ...prev,
        latitude: location.lat,
        longitude: location.lon,
      }));
      toast.success('Localização encontrada!');
    } catch {
      toast.error('Erro ao buscar localização');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      toast.error('Preencha nome e endereço');
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      toast.error('Busque a localização do endereço antes de salvar');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      address: formData.address.trim(),
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      client_id: formData.clientId || null,
      status: formData.status,
    };

    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      toast.error('Coordenadas inválidas');
      return;
    }

    if (!isSupabaseConfigured) {
      const mock: EquipmentLocation = {
        id: editingEquipment?.id ?? String(Date.now()),
        name: payload.name,
        description: payload.description,
        address: payload.address,
        latitude: payload.latitude,
        longitude: payload.longitude,
        clientId: payload.client_id ?? undefined,
        clientName: clients.find((c) => c.id === payload.client_id)?.name,
        status: payload.status,
        createdAt: new Date().toISOString(),
      };
      setEquipmentList((prev) =>
        editingEquipment ? prev.map((item) => (item.id === mock.id ? mock : item)) : [mock, ...prev]
      );
      toast.success(editingEquipment ? 'Equipamento atualizado (modo demonstração)' : 'Equipamento salvo (modo demonstração)');
      resetForm();
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEquipment) {
        const { data, error } = await supabase
          .from('equipment_locations')
          .update(payload)
          .eq('id', editingEquipment.id)
          .select('*, clients(id, name)')
          .single();
        if (error) throw error;
        if (data) {
          const updated = mapRowToEquipment(data);
          setEquipmentList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          toast.success('Equipamento atualizado!');
          resetForm();
        }
      } else {
        const { data, error } = await supabase
          .from('equipment_locations')
          .insert(payload)
          .select('*, clients(id, name)')
          .single();
        if (error) throw error;
        if (data) {
          setEquipmentList((prev) => [mapRowToEquipment(data), ...prev]);
          toast.success('Equipamento cadastrado!');
          resetForm();
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar equipamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      clientId: '',
      address: '',
      latitude: '',
      longitude: '',
      status: 'ativo',
      description: '',
    });
    setSelectedEquipment(null);
    setEditingEquipment(null);
  };

  const handleEdit = (equipment: EquipmentLocation) => {
    setShowEquipmentForm(true);
    setEditingEquipment(equipment);
    setSelectedEquipment(equipment);
    setFormData({
      name: equipment.name,
      clientId: equipment.clientId ?? '',
      address: equipment.address,
      latitude: String(equipment.latitude),
      longitude: String(equipment.longitude),
      status: equipment.status,
      description: equipment.description ?? '',
    });
  };

  const openDeleteDialog = (equipment: EquipmentLocation) => {
    setDeleteDialog({ isOpen: true, target: equipment });
  };

  const closeDeleteDialog = () => setDeleteDialog({ isOpen: false, target: null });

  const handleDeleteConfirmed = async () => {
    const equipment = deleteDialog.target;
    if (!equipment) return;

    if (!isSupabaseConfigured) {
      setEquipmentList((prev) => prev.filter((item) => item.id !== equipment.id));
      if (selectedEquipment?.id === equipment.id) setSelectedEquipment(null);
      if (editingEquipment?.id === equipment.id) resetForm();
      toast.success('Equipamento removido (modo demonstração)');
      return;
    }

    try {
      const { error } = await supabase.from('equipment_locations').delete().eq('id', equipment.id);
      if (error) throw error;
      setEquipmentList((prev) => prev.filter((item) => item.id !== equipment.id));
      if (selectedEquipment?.id === equipment.id) setSelectedEquipment(null);
      if (editingEquipment?.id === equipment.id) resetForm();
      toast.success('Equipamento removido!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover equipamento');
    }
  };

  const derivedCenter = useMemo<LatLngExpression>(() => {
    if (selectedEquipment) {
      return [selectedEquipment.latitude, selectedEquipment.longitude];
    }
    if (formData.latitude && formData.longitude) {
      return [Number(formData.latitude), Number(formData.longitude)];
    }
    if (filteredEquipment.length > 0) {
      return [filteredEquipment[0].latitude, filteredEquipment[0].longitude];
    }
    return defaultCenter;
  }, [selectedEquipment, formData.latitude, formData.longitude, filteredEquipment]);

  const renderMap = () => {
    if (!isMapReady) {
      return <div className="flex h-full items-center justify-center text-gray-500 text-sm">Carregando mapa...</div>;
    }

    if (filteredEquipment.length === 0 && !isLoading) {
      return (
        <EmptyState
          icon={MapPin}
          title="Nenhum equipamento cadastrado"
          description="Adicione um equipamento para visualizar no mapa."
        />
      );
    }

    return (
      <MapContainer
        center={derivedCenter}
        zoom={5}
        className="h-full w-full relative z-0"
        scrollWheelZoom
        preferCanvas
        style={{ isolation: 'isolate' }}
      >
        <MapAutoCenter center={derivedCenter} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {filteredEquipment.map((item) => (
          <Marker
            key={item.id}
            position={[item.latitude, item.longitude]}
            icon={createMarkerIcon(getStatusColor(item.status))}
            eventHandlers={{
              click: () => setSelectedEquipment(item),
            }}
          >
            <Popup>
              <div className="space-y-1 text-xs sm:text-sm max-w-[200px] sm:max-w-none">
                <p className="font-semibold break-words">{item.name}</p>
                <p className="text-gray-600 break-words">{item.address}</p>
                {item.clientName && <p className="text-[10px] sm:text-xs text-gray-500 break-words">Cliente: {item.clientName}</p>}
                <p className="text-[10px] sm:text-xs text-gray-500 break-all">
                  Lat/Lng: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                </p>
                <div className="mt-2 flex gap-1.5 sm:gap-2">
                  <button
                    className="flex-1 rounded-lg bg-green-600 px-2 py-1 text-[10px] sm:text-xs font-semibold text-white hover:bg-green-700 whitespace-nowrap"
                    onClick={(e) => {
                      e.preventDefault();
                      handleEdit(item);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="flex-1 rounded-lg border border-red-200 px-2 py-1 text-[10px] sm:text-xs font-semibold text-red-600 hover:bg-red-50 whitespace-nowrap"
                    onClick={(e) => {
                      e.preventDefault();
                      openDeleteDialog(item);
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Equipamentos"
        description="Acompanhe localização, status e equipes responsáveis."
        actions={<button onClick={() => { resetForm(); setShowEquipmentForm(true); }} className="btn-primary flex items-center gap-2"><Plus className="h-4 w-4" />Cadastrar equipamento</button>}
      />

      <section className="rounded-2xl border border-gray-100 bg-white p-3 sm:p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
            <ListFilter className="h-4 w-4" />
            <span>Filtros rápidos</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilterOptions.map((status) => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 sm:px-3 py-1 text-xs font-semibold capitalize transition ${
                    isActive
                      ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                      : 'border-gray-200 text-gray-600 hover:border-green-200 hover:text-green-600 dark:border-gray-700 dark:text-gray-300'
                  }`}
                >
                  {status !== 'all' && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: getStatusColor(status) }}
                    />
                  )}
                  {formatStatusLabel(status)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm transition focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 sm:w-60"
            >
              <option value="">Todos os clientes</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {statusFilter !== 'all' || clientFilter ? (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setClientFilter('');
                }}
                className="text-xs font-semibold text-gray-500 underline hover:text-gray-900 dark:text-gray-300 sm:self-center"
              >
                Limpar
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className={`grid gap-4 sm:gap-6 ${showEquipmentForm ? 'lg:grid-cols-[420px,1fr]' : 'grid-cols-1'}`}>
        {showEquipmentForm && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {editingEquipment ? 'Editar equipamento' : 'Cadastrar equipamento'}
            </h2>
            <p className="text-xs text-gray-500">
              {editingEquipment
                ? 'Atualize os dados e sincronize com o mapa.'
                : 'Preencha os dados e localize o endereço para gerar o ponto no mapa.'}
            </p>
            </div>
            <button
              type="button"
              onClick={() => { resetForm(); setShowEquipmentForm(false); }}
              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white sm:ml-2"
            >
            {editingEquipment ? 'Cancelar edição' : 'Limpar'}
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Nome do equipamento"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              maxLength={120}
            />

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Cliente (opcional)</label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, clientId: e.target.value }))}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <FormTextarea
              label="Descrição / Observações"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              maxLength={300}
            />

            <FormTextarea
              label="Endereço"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              required
              rows={2}
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={handleGeocode}
                disabled={isGeocoding || !formData.address.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                <span className="whitespace-nowrap">Localizar endereço</span>
              </button>
              {hasCoordinates && (
                <div className="flex items-center justify-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-200">
                  <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="whitespace-nowrap">Localização confirmada</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormInput
                label="Latitude"
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData((prev) => ({ ...prev, latitude: e.target.value }))}
                required
              />
              <FormInput
                label="Longitude"
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData((prev) => ({ ...prev, longitude: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white shadow transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {editingEquipment ? 'Atualizar equipamento' : 'Salvar equipamento'}
            </button>
          </form>
        </section>
        )}

        <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Mapa dos equipamentos</h2>
                <p className="text-xs text-gray-500">Clique em um marcador para ver os detalhes</p>
              </div>
              <button
                type="button"
                onClick={fetchEquipment}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-gray-600 transition hover:border-green-200 hover:text-green-600 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 flex-shrink-0"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500">
              {statusOptions.map((status) => (
                <div key={status} className="flex items-center gap-2 rounded-full border border-gray-200/70 px-2.5 sm:px-3 py-1 dark:border-gray-700">
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getStatusColor(status) }}
                  />
                  <span className="capitalize whitespace-nowrap">{status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-[300px] sm:h-[420px] overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 relative isolate">
            {renderMap()}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lista de equipamentos</h2>
            <p className="text-xs text-gray-500">Selecione um item para centralizar no mapa</p>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
            Mostrando {filteredEquipment.length} de {equipmentList.length} equipamento(s)
          </p>
        </div>

        {filteredEquipment.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="Cadastre o primeiro equipamento"
            description="Assim que houver registros, eles aparecerão aqui."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredEquipment.map((item) => {
              const isActive = selectedEquipment?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedEquipment(item)}
                  className={`rounded-2xl border p-3 sm:p-4 text-left transition hover:border-green-200 hover:shadow ${
                    isActive
                      ? 'border-green-500 bg-green-50 dark:border-green-500/80 dark:bg-green-900/10'
                      : 'border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words">{item.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 break-words mt-1">{item.address}</p>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize flex-shrink-0"
                      style={{ backgroundColor: `${getStatusColor(item.status)}22`, color: getStatusColor(item.status) }}
                    >
                      {item.status}
                    </span>
                  </div>
                  {item.clientName && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 break-words">Cliente: {item.clientName}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Target className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="break-all">{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(item);
                      }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:text-gray-300"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(item);
                      }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-500/50 dark:text-red-300"
                    >
                      <Trash className="h-3.5 w-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Equipment Collaborators Panel */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <EquipmentCollaboratorsPanel 
          equipmentList={filteredEquipment} 
          onAssignmentChange={fetchEquipment}
        />
      </section>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteConfirmed}
        title="Remover equipamento"
        message={`Tem certeza que deseja remover ${deleteDialog.target?.name ?? 'este equipamento'}? Essa ação não pode ser desfeita.`}
        confirmText="Remover"
        type="danger"
      />
    </div>
  );
};

export default EquipmentMap;

