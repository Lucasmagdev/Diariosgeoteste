import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Users } from "lucide-react";
import type { BoardRow, TeamMember } from "../lib/board-types";
import { getRowColor } from "../lib/row-color";
import { normalizeMapsUrl } from "../lib/maps";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const ROW_STATUS_LABEL: Record<BoardRow["status"], string> = {
  planning: "Planejamento",
  active: "Em operação",
  waiting: "Aguardando",
  done: "Concluída",
};

type Classification = BoardRow["status"] | "yard";

const DEFAULT_CENTER: [number, number] = [-15.78, -47.93];
const DEFAULT_ZOOM = 4;

const CLASSIFICATION_OPTIONS: { value: Classification; label: string; color: string }[] = [
  { value: "planning", label: "Planejamento", color: "oklch(0.55 0.18 250)" },
  { value: "active", label: "Em operação", color: "oklch(0.62 0.16 155)" },
  { value: "waiting", label: "Aguardando", color: "oklch(0.55 0.18 300)" },
  { value: "done", label: "Concluída", color: "oklch(0.65 0.18 25)" },
  { value: "yard", label: "Pátio", color: "oklch(0.78 0.16 75)" },
];

function rowClassification(row: BoardRow): Classification {
  return (row.locationType ?? "worksite") === "yard" ? "yard" : row.status;
}

function rowStatusLabel(row: BoardRow) {
  return (row.locationType ?? "worksite") === "yard" ? "Pátio" : ROW_STATUS_LABEL[row.status];
}

// Colored teardrop pin built from the row color. Allocated collaborators show as a
// single grouped badge beside the head; clicking it expands into individual avatars
// (no external image assets — everything is inline SVG/HTML for the Leaflet divIcon).
function pinIcon(
  color: string,
  avatars: { initials: string; color: string }[],
  expanded: boolean,
  rowId: string,
) {
  const GROUP_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const toggleAttrs = `onclick="window.__mapPinToggle && window.__mapPinToggle('${rowId}');event.stopPropagation();" style="cursor:pointer;"`;

  let badgeHtml = "";
  if (avatars.length > 0 && !expanded) {
    badgeHtml = `<div ${toggleAttrs} style="position:absolute;top:-11px;left:24px;width:28px;height:28px;border-radius:9999px;background:#000;border:2px solid white;display:flex;align-items:center;justify-content:center;gap:1px;box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:pointer;">${GROUP_SVG}</div>
      <div style="position:absolute;top:-13px;left:48px;min-width:15px;height:15px;padding:0 3px;border-radius:9999px;background:#000;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:white;">${avatars.length}</div>`;
  } else if (avatars.length > 0 && expanded) {
    const badges = avatars
      .map(
        (a, i) =>
          `<div style="width:16px;height:16px;border-radius:9999px;background:${a.color};border:1.5px solid white;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:800;color:white;margin-left:${i === 0 ? 0 : -5}px;box-shadow:0 1px 2px rgba(0,0,0,.25);">${a.initials}</div>`,
      )
      .join("");
    badgeHtml = `<div ${toggleAttrs} style="position:absolute;top:-8px;left:24px;display:flex;background:white;border-radius:9999px;padding:2px;box-shadow:0 1px 3px rgba(0,0,0,.3);">${badges}</div>`;
  }

  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:70px;height:38px;">
      <svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 9.5 14 24 14 24s14-14.5 14-24C28 6.3 21.7 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="14" cy="14" r="5" fill="white"/>
      </svg>
      ${badgeHtml}
    </div>`,
    iconSize: [70, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });
}

type MappableRow = BoardRow & { lat: number; lng: number };

function FitBounds({ rows }: { rows: MappableRow[] }) {
  const map = useMap();
  useEffect(() => {
    if (rows.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }
    if (rows.length === 1) {
      map.setView([rows[0].lat, rows[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(rows.map((row) => [row.lat, row.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [rows, map]);
  return null;
}

export function MapView({
  rows,
  teamMembers = [],
  onSelectRow,
}: {
  rows: BoardRow[];
  teamMembers?: TeamMember[];
  onSelectRow?: (row: BoardRow) => void;
}) {
  const [activeClassifications, setActiveClassifications] = useState<Set<Classification>>(
    new Set(),
  );
  const [activeCollaboratorIds, setActiveCollaboratorIds] = useState<Set<string>>(new Set());
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    (window as unknown as { __mapPinToggle?: (rowId: string) => void }).__mapPinToggle = (rowId) => {
      setExpandedRowId((prev) => (prev === rowId ? null : rowId));
    };
    return () => {
      delete (window as unknown as { __mapPinToggle?: (rowId: string) => void }).__mapPinToggle;
    };
  }, []);

  function toggleClassification(value: Classification) {
    setActiveClassifications((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleCollaborator(id: string) {
    setActiveCollaboratorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const membersById = useMemo(
    () => new Map(teamMembers.map((member) => [member.id, member])),
    [teamMembers],
  );

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => activeClassifications.has(rowClassification(row)))
        .filter(
          (row) =>
            activeCollaboratorIds.size === 0 ||
            row.teamMemberIds.some((id) => activeCollaboratorIds.has(id)),
        ),
    [rows, activeClassifications, activeCollaboratorIds],
  );

  const mappable = useMemo(
    () =>
      filteredRows.filter(
        (row): row is MappableRow =>
          typeof row.lat === "number" && typeof row.lng === "number",
      ),
    [filteredRows],
  );

  const missingCount = filteredRows.length - mappable.length;
  const hasClassificationSelection = activeClassifications.size > 0;
  const emptyState =
    !hasClassificationSelection
      ? {
          title: "Selecione um tipo de local",
          description:
            "Escolha Planejamento, Em operação, Aguardando, Concluída ou Pátio para exibir os marcadores.",
        }
      : filteredRows.length === 0
        ? {
            title: "Nenhum resultado para os filtros",
            description: "Ajuste os tipos de local ou os colaboradores selecionados.",
          }
        : {
            title: "Locais selecionados sem coordenadas",
            description:
              "Edite os locais e informe latitude/longitude ou extraia as coordenadas do Google Maps.",
          };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b bg-card px-4 py-3">
        <h2 className="op-title text-2xl leading-none">Mapa Geral</h2>
        <p className="op-label text-[10px] text-muted-foreground">
          {mappable.length} obra{mappable.length === 1 ? "" : "s"} no mapa
          {hasClassificationSelection && missingCount > 0
            ? ` · ${missingCount} sem coordenada`
            : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CLASSIFICATION_OPTIONS.map((option) => {
            const active = activeClassifications.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleClassification(option.value)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  active ? "border-transparent text-white" : "border-border bg-card text-muted-foreground opacity-60"
                }`}
                style={active ? { background: option.color } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: active ? "white" : option.color }}
                />
                {option.label}
              </button>
            );
          })}
          {teamMembers.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                >
                  <Users className="h-3 w-3" />
                  Colaboradores
                  {activeCollaboratorIds.size > 0 && ` (${activeCollaboratorIds.size})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="z-[1000] w-64 p-2">
                <div className="mb-1 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Filtrar por colaborador
                  </p>
                  {activeCollaboratorIds.size > 0 && (
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-primary hover:underline"
                      onClick={() => setActiveCollaboratorIds(new Set())}
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {teamMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={activeCollaboratorIds.has(member.id)}
                        onCheckedChange={() => toggleCollaborator(member.id)}
                      />
                      <Avatar className="h-6 w-6 shrink-0">
                        {member.photoUrl && <AvatarImage src={member.photoUrl} alt={member.name} />}
                        <AvatarFallback
                          className="text-[9px] font-bold text-primary-foreground"
                          style={{ background: member.color }}
                        >
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{member.name}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        {mappable.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center p-6 text-center">
            <div className="max-w-sm rounded-lg border bg-card p-5 shadow-sm">
              <MapPin className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-semibold">{emptyState.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{emptyState.description}</p>
            </div>
          </div>
        )}
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom
          className="h-full w-full"
          style={{ background: "#aadaff" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds rows={mappable} />
          {mappable.map((row) => {
            const href = normalizeMapsUrl(row.mapsUrl);
            const rowMembers = row.teamMemberIds
              .map((id) => membersById.get(id))
              .filter((member): member is TeamMember => Boolean(member));
            const avatars = rowMembers.map((member) => ({
              initials: getInitials(member.name),
              color: member.color,
            }));
            return (
              <Marker
                key={row.id}
                position={[row.lat, row.lng]}
                icon={pinIcon(getRowColor(row), avatars, expandedRowId === row.id, row.id)}
              >
                <Popup>
                  <div className="min-w-[190px]">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: getRowColor(row) }}
                      />
                      <div className="text-sm font-bold">{row.name}</div>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{rowStatusLabel(row)}</div>
                    {row.description && (
                      <div className="mt-1.5 text-xs text-foreground/80">{row.description}</div>
                    )}
                    <div className="mt-1.5 flex gap-3 text-[11px] text-muted-foreground">
                      <span>{row.itemIds.length} item{row.itemIds.length === 1 ? "" : "s"}</span>
                      <span>{row.teamMemberIds.length} colaborador{row.teamMemberIds.length === 1 ? "" : "es"}</span>
                    </div>
                    {rowMembers.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {rowMembers.map((member) => (
                          <span
                            key={member.id}
                            className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold"
                          >
                            <span
                              className="h-3.5 w-3.5 rounded-full text-center text-[7px] font-bold leading-[14px] text-white"
                              style={{ background: member.color }}
                            >
                              {getInitials(member.name)}
                            </span>
                            {member.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-col gap-1">
                      {onSelectRow && (
                        <button
                          type="button"
                          onClick={() => onSelectRow(row)}
                          className="text-left text-xs font-semibold text-primary hover:underline"
                        >
                          Ver obra
                        </button>
                      )}
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Abrir no Google Maps
                        </a>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}


