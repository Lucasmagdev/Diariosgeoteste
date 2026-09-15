import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Grid3X3,
  Layers,
  List,
  MapPin,
  Package,
  Pencil,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { AssetDetailSheet } from "./AssetDetailSheet";
import { AssetIcon } from "./AssetIcon";
import type {
  BoardItem,
  BoardItemStatus,
  BoardRow,
  ItemCategory,
  PlacedInstance,
} from "../lib/board-types";
import { ITEM_STATUS_META, getItemStatusMeta } from "../lib/item-status";

type ViewMode = "cards" | "table";
type Density = "normal" | "compact" | "mini";
type DeadlineFilter = "all" | "attention" | "expired" | "next30" | "next90" | "missing";

type InventoryUnit = {
  item: BoardItem;
  category?: ItemCategory;
  location?: BoardRow;
};

type AssetGroup = {
  key: string;
  name: string;
  category?: ItemCategory;
  representativeItem: BoardItem;
  units: InventoryUnit[];
  statusCounts: Record<BoardItemStatus, number>;
};

const STATUS_ORDER: BoardItemStatus[] = ["available", "on_site", "maintenance", "acquisition"];

function dateDiff(iso?: string) {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function deadlineInfo(iso?: string) {
  const diff = dateDiff(iso);
  if (diff === null)
    return { level: "missing" as const, label: "Sem validade", color: "#6b7280", bg: "#f3f4f6" };
  if (diff < 0)
    return { level: "expired" as const, label: "Vencido", color: "#dc2626", bg: "#fef2f2" };
  if (diff <= 30)
    return {
      level: "next30" as const,
      label: `Vence em ${diff}d`,
      color: "#ea580c",
      bg: "#fff7ed",
    };
  if (diff <= 90)
    return {
      level: "next90" as const,
      label: `Vence em ${diff}d`,
      color: "#ca8a04",
      bg: "#fefce8",
    };
  return { level: "ok" as const, label: "Em dia", color: "#16a34a", bg: "#f0fdf4" };
}

function formatDate(iso?: string) {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function quoted(value: string | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function StatusBadge({ status }: { status: BoardItemStatus }) {
  const meta = getItemStatusMeta(status);
  return (
    <span
      className="op-label rounded px-1.5 py-0.5 text-[10px] font-bold"
      style={{ background: meta.softColor, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function ActionButtons({
  unit,
  onDetails,
  onEdit,
}: {
  unit: InventoryUnit;
  onDetails: (unit: InventoryUnit) => void;
  onEdit?: (item: BoardItem) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {onEdit && <button
        type="button"
        className="rounded-md border bg-card p-1.5 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        title="Ver detalhes"
        onClick={() => onDetails(unit)}
      >
        <Eye className="h-3.5 w-3.5" />
      </button>}
      <button
        type="button"
        className="rounded-md border bg-card p-1.5 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        title="Editar ativo"
        onClick={() => onEdit?.(unit.item)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MiniDeckPreview({ units }: { units: InventoryUnit[] }) {
  const previewUnits = units.slice(0, 3);
  const extraCount = Math.max(0, units.length - previewUnits.length);

  return (
    <div className="relative h-[54px] w-[68px] shrink-0">
      {previewUnits.map((unit, index) => {
        const statusMeta = getItemStatusMeta(unit.item.status);
        return (
          <div
            key={unit.item.id}
            className="absolute h-[46px] w-[58px] overflow-hidden rounded-md border bg-card shadow-sm"
            style={{
              left: `${index * 5}px`,
              top: `${index * 3}px`,
              transform: `rotate(${index * 2 - 2}deg)`,
              zIndex: index + 1,
              borderBottomColor: statusMeta.color,
              borderBottomWidth: "2px",
            }}
          >
            <div className="flex h-full flex-col items-center justify-center gap-0.5 px-1 py-1">
              <div
                className="flex h-7 w-9 shrink-0 items-center justify-center overflow-hidden rounded"
                style={{ background: statusMeta.softColor, color: unit.item.color }}
              >
                <AssetIcon
                  item={unit.item}
                  className="h-full w-full object-contain p-0.5"
                  fallbackSize={16}
                />
              </div>
              <span
                className="h-1 w-8 rounded-full"
                style={{ background: statusMeta.color }}
              />
            </div>
          </div>
        );
      })}
      {extraCount > 0 && (
        <div className="absolute -right-1 -bottom-1 z-10 rounded-full bg-foreground px-1.5 py-0.5 text-[8px] font-bold text-background shadow-sm">
          +{extraCount}
        </div>
      )}
    </div>
  );
}

function AssetGroupCard({
  group,
  expanded,
  density,
  onToggle,
  onDetails,
  onEdit,
}: {
  group: AssetGroup;
  expanded: boolean;
  density: Density;
  onToggle: () => void;
  onDetails: (unit: InventoryUnit) => void;
  onEdit?: (item: BoardItem) => void;
}) {
  const rep = group.representativeItem;
  const catColor = group.category?.color ?? rep.color;
  const isMini = density === "mini";
  const onSiteUnits = group.units.filter((unit) => unit.item.status === "on_site" && unit.location);
  const maintenanceUnit = group.units.find((unit) => unit.item.status === "maintenance");
  const nearestDeadline = group.units
    .filter((unit) => unit.item.expiryDate)
    .sort((a, b) => (a.item.expiryDate ?? "").localeCompare(b.item.expiryDate ?? ""))[0];
  const deadline = nearestDeadline ? deadlineInfo(nearestDeadline.item.expiryDate) : null;
  const expiringDocument = group.units
    .flatMap((unit) => unit.item.documents ?? [])
    .find((document) => {
      const level = deadlineInfo(document.expiryDate).level;
      return level === "expired" || level === "next30";
    });
  const documentDeadline = expiringDocument ? deadlineInfo(expiringDocument.expiryDate) : null;
  const singleUnit = group.units.length === 1 ? group.units[0] : null;

  if (isMini) {
    const statusWithMostUnits = STATUS_ORDER.reduce((best, status) =>
      group.statusCounts[status] > group.statusCounts[best] ? status : best,
    );
    const statusMeta = ITEM_STATUS_META[statusWithMostUnits];
    const deadlineLevel = deadline?.level;
    const needsAttention =
      deadlineLevel === "expired" ||
      deadlineLevel === "next30" ||
      documentDeadline !== null ||
      Boolean(maintenanceUnit);

    return (
      <article
        className={`group relative min-h-[116px] overflow-visible rounded-lg border bg-card shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-md ${
          expanded ? "border-primary/60" : "border-border"
        } ${needsAttention ? "ring-1 ring-amber-400/35" : ""}`}
        style={{ borderTopColor: catColor, borderTopWidth: "3px" }}
      >
        <span className="pointer-events-none absolute -right-1.5 top-2 h-[102px] w-full rounded-lg border bg-card/70 shadow-sm" />
        <span className="pointer-events-none absolute -right-3 top-4 h-[94px] w-full rounded-lg border bg-card/45 shadow-sm" />
        <button
          type="button"
          className="relative z-10 flex h-full min-h-[116px] w-full flex-col rounded-lg bg-card p-2 text-left"
          onClick={onToggle}
        >
          <div className="flex items-start gap-2">
            <MiniDeckPreview units={group.units} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1">
                <h3 className="truncate text-[11px] font-extrabold leading-tight">
                  {group.name}
                </h3>
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: statusMeta.color }}
                />
              </div>
              <div className="mt-1 truncate text-[9px] text-muted-foreground">
                {group.category?.name ?? "Sem categoria"}
              </div>
              <div className="mt-1 inline-flex rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                {group.units.length} un.
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-1 pt-1.5">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-secondary">
              {STATUS_ORDER.map((status) =>
                group.statusCounts[status] ? (
                  <span
                    key={status}
                    style={{
                      width: `${(group.statusCounts[status] / group.units.length) * 100}%`,
                      background: ITEM_STATUS_META[status].color,
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[8px] font-semibold text-muted-foreground">
                {singleUnit?.location?.name ?? onSiteUnits[0]?.location?.name ?? "Base"}
              </span>
              {needsAttention && (
                <span className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-700">
                  Alerta
                </span>
              )}
            </div>
          </div>
        </button>

        {expanded && (
          <div className="relative z-20 border-t bg-card/95 px-2 py-1.5">
            {group.units.slice(0, 5).map((unit, index) => (
              <button
                key={unit.item.id}
                type="button"
                className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-secondary"
                onClick={() => onDetails(unit)}
              >
                <span className="w-4 shrink-0 text-[8px] text-muted-foreground">#{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[9px] font-semibold">
                  {unit.item.name}
                </span>
                <StatusBadge status={unit.item.status} />
              </button>
            ))}
          </div>
        )}
      </article>
    );
  }

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)] transition-all hover:shadow-md ${
        expanded ? "border-primary/50 shadow-md" : "border-border"
      }`}
      style={{ borderTopColor: catColor, borderTopWidth: "3px" }}
    >
      <button
        type="button"
        className={`w-full text-left ${isMini ? "p-2.5" : density === "compact" ? "p-2.5" : "p-3"}`}
        onClick={onToggle}
      >
        {isMini ? (
          <div className="flex items-start gap-3">
            <MiniDeckPreview units={group.units} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="op-title truncate text-sm leading-tight">{group.name}</h3>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {group.category && (
                  <span className="op-label flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor }} />
                    {group.category.name}
                  </span>
                )}
                <span className="op-label rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  {group.units.length} un.
                </span>
                <span className="op-label rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                  {Object.values(group.statusCounts).filter(Boolean).length} tipos
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {STATUS_ORDER.map((status) =>
                  group.statusCounts[status] ? (
                    <span key={status} className="flex items-center gap-1">
                      <span className="op-label text-[10px] font-bold">
                        {group.statusCounts[status]}
                      </span>
                      <StatusBadge status={status} />
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div
              className={`${density === "compact" ? "h-10 w-10" : "h-12 w-12"} flex shrink-0 items-center justify-center overflow-hidden rounded-lg`}
              style={{
                background: `linear-gradient(135deg, ${catColor}, color-mix(in oklch, ${catColor} 60%, oklch(0.2 0 0)))`,
              }}
            >
              <AssetIcon item={rep} className="h-full w-full object-contain p-1" fallbackSize={28} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="op-title truncate text-sm leading-tight">{group.name}</h3>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {group.category && (
                  <span className="op-label flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: catColor }} />
                    {group.category.name}
                  </span>
                )}
                <span className="op-label rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                  x{group.units.length}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-1">
          {STATUS_ORDER.map((status) =>
            group.statusCounts[status] ? (
              <span key={status} className="flex items-center gap-1">
                <span className="op-label text-[10px] font-bold">{group.statusCounts[status]}</span>
                <StatusBadge status={status} />
              </span>
            ) : null,
          )}
        </div>

        {onSiteUnits.length > 0 && (
          <div className="mt-2 rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-700">
            <div className="flex items-center gap-1.5 truncate text-[11px] font-medium">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {onSiteUnits[0].location?.name}
                {onSiteUnits.length > 1 ? ` +${onSiteUnits.length - 1}` : ""}
              </span>
            </div>
            {onSiteUnits[0].item.expectedReturnDate && (
              <div className="op-label mt-1 text-[9px]">
                Retorno previsto: {formatDate(onSiteUnits[0].item.expectedReturnDate)}
              </div>
            )}
          </div>
        )}

        {maintenanceUnit && (
          <div className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-red-700">
            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              <Wrench className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {maintenanceUnit.item.maintenanceReason ?? "Em manutenção"}
              </span>
            </div>
            {maintenanceUnit.item.maintenanceReturnDate && (
              <div className="op-label mt-1 text-[9px]">
                Retorno previsto: {formatDate(maintenanceUnit.item.maintenanceReturnDate)}
              </div>
            )}
          </div>
        )}

        {deadline && deadline.level !== "ok" && (
          <div
            className="mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: deadline.bg, color: deadline.color }}
          >
            <CalendarClock className="h-3 w-3" />
            {deadline.label}
          </div>
        )}
        {documentDeadline && (
          <div
            className="ml-1 mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: documentDeadline.bg, color: documentDeadline.color }}
          >
            <AlertTriangle className="h-3 w-3" />
            Certificado: {documentDeadline.label}
          </div>
        )}

        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-secondary">
          {STATUS_ORDER.map((status) =>
            group.statusCounts[status] ? (
              <span
                key={status}
                style={{
                  width: `${(group.statusCounts[status] / group.units.length) * 100}%`,
                  background: ITEM_STATUS_META[status].color,
                  opacity: 0.75,
                }}
              />
            ) : null,
          )}
        </div>
      </button>

      {singleUnit && !expanded && (
        <div className="flex justify-end border-t bg-secondary/20 px-3 py-2">
          <ActionButtons unit={singleUnit} onDetails={onDetails} onEdit={onEdit} />
        </div>
      )}

      {expanded && (
        <div className="border-t bg-secondary/20">
          {group.units.map((unit, index) => {
            const deadline = deadlineInfo(unit.item.expiryDate);
            return (
              <div
                key={unit.item.id}
                className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0"
              >
                <span className="op-label w-5 shrink-0 text-center text-[10px] text-muted-foreground">
                  #{index + 1}
                </span>
                <StatusBadge status={unit.item.status} />
                <div className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                  {unit.location?.name ?? "Base / sem alocação"}
                </div>
                {deadline.level !== "missing" && deadline.level !== "ok" && (
                  <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: deadline.color }}
                  />
                )}
                <ActionButtons unit={unit} onDetails={onDetails} onEdit={onEdit} />
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function CategoryDeckCard({
  category,
  groups,
  units,
  expanded,
  onToggle,
  onDetails,
}: {
  category?: ItemCategory;
  groups: AssetGroup[];
  units: InventoryUnit[];
  expanded: boolean;
  onToggle: () => void;
  onDetails: (unit: InventoryUnit) => void;
}) {
  const color = category?.color ?? "oklch(0.48 0.04 255)";
  const statusCounts = STATUS_ORDER.reduce(
    (counts, status) => ({
      ...counts,
      [status]: units.filter((unit) => unit.item.status === status).length,
    }),
    { available: 0, on_site: 0, maintenance: 0, acquisition: 0 },
  );
  const dominantStatus = STATUS_ORDER.reduce((best, status) =>
    statusCounts[status] > statusCounts[best] ? status : best,
  );
  const attentionCount = units.filter((unit) => {
    const level = deadlineInfo(unit.item.expiryDate).level;
    return level === "expired" || level === "next30" || unit.item.status === "maintenance";
  }).length;

  return (
    <article
      className={`group relative min-h-[156px] overflow-visible rounded-lg border bg-card shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-md ${
        expanded ? "border-primary/60" : "border-border"
      } ${attentionCount > 0 ? "ring-1 ring-amber-400/35" : ""}`}
      style={{ borderTopColor: color, borderTopWidth: "3px" }}
    >
      <span className="pointer-events-none absolute -right-1.5 top-2 h-[142px] w-full rounded-lg border bg-card/70 shadow-sm" />
      <span className="pointer-events-none absolute -right-3 top-4 h-[134px] w-full rounded-lg border bg-card/45 shadow-sm" />
      <button
        type="button"
        className="relative z-10 flex min-h-[156px] w-full flex-col rounded-lg bg-card p-2.5 text-left"
        onClick={onToggle}
      >
        <div className="flex items-start gap-2">
          <MiniDeckPreview units={units} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1">
              <h3 className="truncate text-[11px] font-extrabold leading-tight">
                {category?.name ?? "Sem categoria"}
              </h3>
              {expanded ? (
                <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              )}
            </div>
            <div className="mt-1 inline-flex rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
              {groups.length} tipos · {units.length} un.
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: ITEM_STATUS_META[dominantStatus].color }}
              />
              <span className="truncate text-[9px] text-muted-foreground">
                {getItemStatusMeta(dominantStatus).label}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-md border bg-secondary/60 px-2 py-1">
            <div className="text-[17px] font-black leading-none text-foreground">
              {groups.length}
            </div>
            <div className="op-label mt-0.5 text-[8px] font-bold uppercase text-muted-foreground">
              tipos
            </div>
          </div>
          <div className="rounded-md border bg-primary px-2 py-1 text-primary-foreground">
            <div className="text-[17px] font-black leading-none">
              {units.length}
            </div>
            <div className="op-label mt-0.5 text-[8px] font-bold uppercase opacity-85">
              un.
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-1 pt-2">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-secondary">
            {STATUS_ORDER.map((status) =>
              statusCounts[status] ? (
                <span
                  key={status}
                  style={{
                    width: `${(statusCounts[status] / units.length) * 100}%`,
                    background: ITEM_STATUS_META[status].color,
                  }}
                />
              ) : null,
            )}
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-[8px] font-semibold text-muted-foreground">
              {groups.slice(0, 2).map((group) => group.name).join(" · ")}
            </span>
            {attentionCount > 0 && (
              <span className="rounded bg-amber-100 px-1 py-0.5 text-[8px] font-bold text-amber-700">
                {attentionCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="relative z-20 border-t bg-card/95 px-2 py-1.5">
          {groups.slice(0, 8).map((group) => (
            <button
              key={group.key}
              type="button"
              className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-secondary"
              onClick={() => onDetails(group.units[0])}
            >
              <span className="min-w-0 flex-1 truncate text-[9px] font-semibold">
                {group.name}
              </span>
              <span className="rounded bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground">
                {group.units.length}
              </span>
            </button>
          ))}
          {groups.length > 8 && (
            <div className="px-1 py-1 text-[9px] font-semibold text-muted-foreground">
              +{groups.length - 8} tipos
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function PatrimonioView({
  categories,
  items,
  instances,
  rows,
  onEditItem,
}: {
  categories: ItemCategory[];
  items: BoardItem[];
  instances: PlacedInstance[];
  rows: BoardRow[];
  onEditItem?: (item: BoardItem) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>(null);
  // Empty set = all statuses. Multiple can be active (alt/shift-click to combine).
  const [statusFilter, setStatusFilter] = useState<Set<BoardItemStatus>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [density, setDensity] = useState<Density>("normal");
  const [detailUnit, setDetailUnit] = useState<InventoryUnit | null>(null);

  // Single click = select only this status (toggle off if already alone).
  // Alt/Shift click = add/remove this status to the selection (combine filters).
  function toggleStatus(status: BoardItemStatus, additive: boolean) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (additive) {
        if (next.has(status)) next.delete(status);
        else next.add(status);
      } else if (next.size === 1 && next.has(status)) {
        next.clear();
      } else {
        next.clear();
        next.add(status);
      }
      return next;
    });
  }

  const units = useMemo<InventoryUnit[]>(() => {
    const categoryById = Object.fromEntries(categories.map((category) => [category.id, category]));
    const rowById = Object.fromEntries(rows.map((row) => [row.id, row]));
    const instanceByItemId = new Map(instances.map((instance) => [instance.itemId, instance]));
    return items
      .filter((item) => !(item.isRentalEquipment && item.status === "on_site"))
      .map((item) => {
      const instance = instanceByItemId.get(item.id);
      return {
        item,
        category: categoryById[item.categoryId],
        location: instance ? rowById[instance.rowId] : undefined,
      };
      });
  }, [categories, items, instances, rows]);

  const filteredUnits = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return units.filter((unit) => {
      const { item, category, location } = unit;
      if (statusFilter.size > 0 && !statusFilter.has(item.status)) return false;
      if (categoryFilter !== "all" && item.categoryId !== categoryFilter) return false;
      if (locationFilter === "unassigned" && location) return false;
      if (
        locationFilter !== "all" &&
        locationFilter !== "unassigned" &&
        location?.id !== locationFilter
      )
        return false;
      const deadline = deadlineInfo(item.expiryDate).level;
      if (deadlineFilter !== "all") {
        if (deadlineFilter === "attention") {
          const documentNeedsAttention = (item.documents ?? []).some((document) => {
            const documentDeadline = deadlineInfo(document.expiryDate).level;
            return documentDeadline === "expired" || documentDeadline === "next30";
          });
          const needsAttention =
            deadline === "expired" ||
            deadline === "next30" ||
            documentNeedsAttention;
          if (!needsAttention) return false;
        } else {
          if (deadlineFilter === "next90" && deadline !== "next90" && deadline !== "next30")
            return false;
          if (deadlineFilter !== "next90" && deadline !== deadlineFilter) return false;
        }
      }
      if (!query) return true;
      const searchable = [
        item.name,
        item.description,
        item.assetCode,
        item.serialNumber,
        item.manufacturer,
        item.model,
        item.maintenanceReason,
        item.maintenanceProvider,
        ...(item.documents ?? []).map((document) => document.name),
        category?.name,
        location?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(query);
    });
  }, [units, searchQuery, statusFilter, categoryFilter, locationFilter, deadlineFilter]);

  const groups = useMemo<AssetGroup[]>(() => {
    const map = new Map<string, InventoryUnit[]>();
    filteredUnits.forEach((unit) => {
      const key = unit.item.name.trim().toLocaleLowerCase();
      map.set(key, [...(map.get(key) ?? []), unit]);
    });
    return Array.from(map.entries())
      .map(([key, groupUnits]) => ({
        key,
        name: groupUnits[0].item.name,
        category: groupUnits[0].category,
        representativeItem: groupUnits[0].item,
        units: groupUnits,
        statusCounts: STATUS_ORDER.reduce(
          (counts, status) => ({
            ...counts,
            [status]: groupUnits.filter((unit) => unit.item.status === status).length,
          }),
          { available: 0, on_site: 0, maintenance: 0, acquisition: 0 },
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredUnits]);

  // Groups organized into category sections (task: agrupar por categoria).
  const categorySections = useMemo(() => {
    const byCategory = new Map<string, { category?: ItemCategory; groups: AssetGroup[] }>();
    groups.forEach((group) => {
      const id = group.category?.id ?? "__uncategorized__";
      if (!byCategory.has(id)) byCategory.set(id, { category: group.category, groups: [] });
      byCategory.get(id)!.groups.push(group);
    });
    return Array.from(byCategory.values()).sort((a, b) =>
      (a.category?.name ?? "Sem categoria").localeCompare(b.category?.name ?? "Sem categoria"),
    );
  }, [groups]);

  const totals = STATUS_ORDER.reduce(
    (counts, status) => ({
      ...counts,
      [status]: units.filter((unit) => unit.item.status === status).length,
    }),
    { available: 0, on_site: 0, maintenance: 0, acquisition: 0 },
  );
  const typeCount = new Set(units.map((unit) => unit.item.name.trim().toLocaleLowerCase())).size;
  const alertCount = units.filter((unit) => {
    const level = deadlineInfo(unit.item.expiryDate).level;
    const documentNeedsAttention = (unit.item.documents ?? []).some((document) => {
      const documentLevel = deadlineInfo(document.expiryDate).level;
      return documentLevel === "expired" || documentLevel === "next30";
    });
    return (
      level === "expired" ||
      level === "next30" ||
      documentNeedsAttention
    );
  }).length;
  const hasFilters =
    statusFilter.size > 0 ||
    categoryFilter !== "all" ||
    locationFilter !== "all" ||
    deadlineFilter !== "all" ||
    Boolean(searchQuery.trim());

  function clearFilters() {
    setStatusFilter(new Set());
    setCategoryFilter("all");
    setLocationFilter("all");
    setDeadlineFilter("all");
    setSearchQuery("");
  }

  function exportCsv() {
    const header = [
      "Nome",
      "Patrimônio",
      "Série",
      "Categoria",
      "Status",
      "Local",
      "Fabricante",
      "Modelo",
      "Validade",
    ];
    const lines = filteredUnits.map(({ item, category, location }) =>
      [
        item.name,
        item.assetCode,
        item.serialNumber,
        category?.name,
        getItemStatusMeta(item.status).label,
        location?.name,
        item.manufacturer,
        item.model,
        formatDate(item.expiryDate),
      ]
        .map(quoted)
        .join(";"),
    );
    const blob = new Blob(["\uFEFF" + [header.map(quoted).join(";"), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventario-patrimonial.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-card px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="op-title text-2xl leading-none">Inventário Patrimonial</h2>
            <p className="op-label text-[10px] text-muted-foreground">
              Controle de ativos, localização e manutenção
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Metric label="tipos" value={typeCount} icon={Layers} />
            <Metric label="unidades" value={units.length} icon={Package} />
            <Metric
              label="em obra"
              value={totals.on_site}
              icon={MapPin}
              active={statusFilter.has("on_site")}
              onClick={() => toggleStatus("on_site", false)}
              color={ITEM_STATUS_META.on_site.color}
              background={ITEM_STATUS_META.on_site.softColor}
            />
            <Metric
              label="disponíveis"
              value={totals.available}
              icon={Archive}
              active={statusFilter.has("available")}
              onClick={() => toggleStatus("available", false)}
              color={ITEM_STATUS_META.available.color}
              background={ITEM_STATUS_META.available.softColor}
            />
            <Metric
              label="manutenção"
              value={totals.maintenance}
              icon={Wrench}
              active={statusFilter.has("maintenance")}
              onClick={() => toggleStatus("maintenance", false)}
              color={ITEM_STATUS_META.maintenance.color}
              background={ITEM_STATUS_META.maintenance.softColor}
            />
            <Metric
              label="alertas"
              value={alertCount}
              icon={AlertTriangle}
              active={deadlineFilter === "attention"}
              onClick={() =>
                setDeadlineFilter(deadlineFilter === "attention" ? "all" : "attention")
              }
              color="#ea580c"
              background="#fff7ed"
            />
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-b bg-card/80 px-4 py-3">
        {/* busca + ações */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 py-2" style={{ minWidth: "min(260px, 100%)" }}>
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar por nome, código, obra, patrimônio ou série..."
              className="op-label w-full bg-transparent text-[11px] outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </label>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={filteredUnits.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
            <div className="flex rounded-md border bg-card p-0.5">
              <IconToggle
                active={viewMode === "cards"}
                title="Cards"
                onClick={() => setViewMode("cards")}
                icon={Grid3X3}
              />
              <IconToggle
                active={viewMode === "table"}
                title="Tabela"
                onClick={() => setViewMode("table")}
                icon={List}
              />
            </div>
            <div className="flex rounded-md border bg-card p-0.5">
              <button
                type="button"
                className={`op-label rounded px-2 py-1 text-[10px] font-bold ${density === "normal" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                onClick={() => setDensity("normal")}
              >
                Normal
              </button>
              <button
                type="button"
                className={`op-label rounded px-2 py-1 text-[10px] font-bold ${density === "compact" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                onClick={() => setDensity("compact")}
              >
                Compacta
              </button>
              <button
                type="button"
                className={`op-label rounded px-2 py-1 text-[10px] font-bold ${density === "mini" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                onClick={() => setDensity("mini")}
              >
                Extra mini
              </button>
            </div>
          </div>
        </div>

        {/* filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <FilterSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            ariaLabel="Filtrar por categoria"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            value={locationFilter}
            onChange={setLocationFilter}
            ariaLabel="Filtrar por local"
          >
            <option value="all">Todos os locais</option>
            <option value="unassigned">Base / sem alocação</option>
            {(() => {
              const sortByName = (a: BoardRow, b: BoardRow) =>
                a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
              const worksites = rows
                .filter((row) => (row.locationType ?? "worksite") === "worksite")
                .sort(sortByName);
              const yards = rows
                .filter((row) => row.locationType === "yard")
                .sort(sortByName);
              return (
                <>
                  {worksites.length > 0 && (
                    <optgroup label="Obras (A–Z)">
                      {worksites.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {yards.length > 0 && (
                    <optgroup label="Pátios (A–Z)">
                      {yards.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              );
            })()}
          </FilterSelect>
          <FilterSelect
            value={deadlineFilter}
            onChange={(value) => setDeadlineFilter(value as DeadlineFilter)}
            ariaLabel="Filtrar por validade"
          >
            <option value="all">Todas as validades</option>
            <option value="attention">Alertas de validade/manutenção</option>
            <option value="expired">Vencidos</option>
            <option value="next30">Vence em até 30 dias</option>
            <option value="next90">Vence em até 90 dias</option>
            <option value="missing">Sem validade</option>
          </FilterSelect>
        </div>

        {/* pills de status + limpar */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
            {(["all", ...STATUS_ORDER] as const).map((status) => {
              const active = status === "all" ? statusFilter.size === 0 : statusFilter.has(status);
              const meta = status === "all" ? null : getItemStatusMeta(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={(event) => {
                    if (status === "all") setStatusFilter(new Set());
                    else toggleStatus(status, event.altKey || event.shiftKey);
                  }}
                  className={`op-label shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold ${active ? "border-transparent shadow-sm" : "bg-card text-muted-foreground"}`}
                  style={
                    active && meta
                      ? { background: meta.color, color: "white" }
                      : active
                        ? { background: "#111827", color: "white" }
                        : undefined
                  }
                >
                  {status === "all" ? "Todos" : meta?.label}
                </button>
              );
            })}
            <span className="op-label ml-1 hidden shrink-0 text-[9px] text-muted-foreground lg:inline">
              Alt/Shift+clique p/ combinar
            </span>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="op-label shrink-0 text-[10px] font-semibold text-primary hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="op-label mb-3 text-[10px] text-muted-foreground">
          {filteredUnits.length} unidade{filteredUnits.length === 1 ? "" : "s"} encontrada
          {filteredUnits.length === 1 ? "" : "s"}
        </p>
        {filteredUnits.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Nenhum ativo encontrado para estes filtros.
          </div>
        ) : (
          density === "mini" && viewMode === "cards" ? (
            <div className="grid gap-x-5 gap-y-4 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
              {categorySections.map((section) => {
                const sectionKey = section.category?.id ?? "__uncategorized__";
                const sectionUnits = section.groups.flatMap((group) => group.units);
                return (
                  <CategoryDeckCard
                    key={sectionKey}
                    category={section.category}
                    groups={section.groups}
                    units={sectionUnits}
                    expanded={expandedCategoryKey === sectionKey}
                    onToggle={() =>
                      setExpandedCategoryKey((value) =>
                        value === sectionKey ? null : sectionKey,
                      )
                    }
                    onDetails={setDetailUnit}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              {categorySections.map((section) => {
                const sectionUnits = section.groups.flatMap((group) => group.units);
                return (
                  <section key={section.category?.id ?? "__uncategorized__"}>
                    <CategoryHeader
                      category={section.category}
                      typeCount={section.groups.length}
                      unitCount={sectionUnits.length}
                      density={density}
                    />
                    {viewMode === "cards" ? (
                      <div
                        className={`grid ${
                          density === "compact"
                            ? "gap-2 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]"
                            : "gap-3 [grid-template-columns:repeat(auto-fill,minmax(255px,1fr))]"
                        }`}
                      >
                        {section.groups.map((group) => (
                          <AssetGroupCard
                            key={group.key}
                            group={group}
                            expanded={expandedKey === group.key}
                            density={density}
                            onToggle={() =>
                              group.units.length === 1
                                ? setDetailUnit(group.units[0])
                                : setExpandedKey((value) =>
                                    value === group.key ? null : group.key,
                                  )
                            }
                            onDetails={setDetailUnit}
                            onEdit={onEditItem}
                          />
                        ))}
                      </div>
                    ) : (
                      <InventoryTable
                        units={sectionUnits}
                        onDetails={setDetailUnit}
                        onEdit={onEditItem}
                      />
                    )}
                  </section>
                );
              })}
            </div>
          )
        )}
      </div>

      {detailUnit && (
        <AssetDetailSheet
          item={detailUnit.item}
          category={detailUnit.category}
          location={detailUnit.location}
          open
          onClose={() => setDetailUnit(null)}
          onEdit={(item) => {
            setDetailUnit(null);
            onEditItem?.(item);
          }}
        />
      )}
    </div>
  );
}

function CategoryHeader({
  category,
  typeCount,
  unitCount,
  density,
}: {
  category?: ItemCategory;
  typeCount: number;
  unitCount: number;
  density: Density;
}) {
  const color = category?.color ?? "oklch(0.48 0.04 255)";
  return (
    <div
      className={`flex items-center gap-2 ${
        density === "mini" ? "mb-2 rounded-md border bg-card px-2 py-1.5" : "mb-3 border-b pb-2"
      }`}
    >
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <h3 className="op-title text-sm">{category?.name ?? "Sem categoria"}</h3>
      <span className="op-label rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {typeCount} tipo{typeCount === 1 ? "" : "s"} · {unitCount} un.
      </span>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  active,
  onClick,
  color,
  background,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  active?: boolean;
  onClick?: () => void;
  color?: string;
  background?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`op-label flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${onClick ? "hover:shadow-sm" : ""} ${active ? "ring-1 ring-current" : ""}`}
      style={{ color, background: background ?? "var(--color-secondary)" }}
    >
      <Icon className="h-3.5 w-3.5" />
      {value} {label}
    </button>
  );
}

function IconToggle({
  active,
  title,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  icon: typeof Grid3X3;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded p-1.5 transition ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  ariaLabel,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      className="op-label rounded-md border bg-card px-2.5 py-1.5 text-[10px] font-semibold outline-none focus:border-primary"
    >
      {children}
    </select>
  );
}

function InventoryTable({
  units,
  onDetails,
  onEdit,
}: {
  units: InventoryUnit[];
  onDetails: (unit: InventoryUnit) => void;
  onEdit?: (item: BoardItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-secondary/50">
          <tr className="op-label text-[10px] text-muted-foreground">
            <th className="px-4 py-3">Ativo</th>
            <th className="hidden px-4 py-3 md:table-cell">Patrimônio / Série</th>
            <th className="px-4 py-3">Status</th>
            <th className="hidden px-4 py-3 lg:table-cell">Local atual</th>
            <th className="hidden px-4 py-3 md:table-cell">Validade</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit) => {
            const deadline = deadlineInfo(unit.item.expiryDate);
            return (
              <tr key={unit.item.id} className="border-b last:border-0 hover:bg-secondary/25">
                <td className="px-4 py-3">
                  <div className="font-semibold">{unit.item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {unit.category?.name ?? "Sem categoria"}
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                  <div>{unit.item.assetCode ?? "-"}</div>
                  <div>{unit.item.serialNumber ?? "-"}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={unit.item.status} />
                </td>
                <td className="hidden max-w-[220px] truncate px-4 py-3 text-xs lg:table-cell">
                  <div>{unit.location?.name ?? "Base / sem alocação"}</div>
                  {unit.item.status === "on_site" && unit.item.expectedReturnDate && (
                    <div className="text-[10px] text-muted-foreground">
                      Retorno: {formatDate(unit.item.expectedReturnDate)}
                    </div>
                  )}
                  {unit.item.status === "maintenance" && (
                    <div className="text-[10px] text-red-600">
                      {unit.item.maintenanceReason ?? "Em manutenção"}
                    </div>
                  )}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <span
                    className="rounded px-2 py-1 text-xs font-medium"
                    style={{ background: deadline.bg, color: deadline.color }}
                  >
                    {deadline.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <ActionButtons unit={unit} onDetails={onDetails} onEdit={onEdit} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

