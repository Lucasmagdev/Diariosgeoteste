import { useState } from "react";
import {
  X,
  MapPin,
  Package,
  ShieldCheck,
  Users,
  CalendarX,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import type {
  BoardItem,
  BoardRow,
  ItemCategory,
  PlacedInstance,
  TeamMember,
} from "../lib/board-types";
import { rentalPeriodSuffix } from "../lib/board-types";
import { formatCurrencyBRL } from "../lib/format";
import { ITEM_STATUS_META } from "../lib/item-status";
import { normalizeMapsUrl } from "../lib/maps";
import { ItemInfoDialog } from "./ItemInfoDialog";
import { AssetIcon } from "./AssetIcon";

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

function expiryUrgency(expiryDate?: string): "expired" | "critical" | "warning" | "ok" | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (new Date(expiryDate + "T00:00:00").getTime() - today.getTime()) / 86400000,
  );
  if (diff < 0) return "expired";
  if (diff <= 30) return "critical";
  if (diff <= 90) return "warning";
  return "ok";
}

const URGENCY_META = {
  expired: { color: "#dc2626", bg: "#fef2f2", icon: CalendarX, label: "Vencido" },
  critical: { color: "#ea580c", bg: "#fff7ed", icon: AlertTriangle, label: "Crítico" },
  warning: { color: "#ca8a04", bg: "#fefce8", icon: Clock, label: "Atenção" },
  ok: { color: "#16a34a", bg: "#f0fdf4", icon: Clock, label: "Em dia" },
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function MemberChip({ member }: { member: TeamMember }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
      <Avatar className="h-8 w-8">
        {member.photoUrl && <AvatarImage src={member.photoUrl} alt={member.name} />}
        <AvatarFallback
          className="text-[10px] font-bold text-primary-foreground"
          style={{ background: member.color }}
        >
          {getInitials(member.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold">{member.name}</div>
        <div className="truncate text-[10px] text-muted-foreground">{member.role}</div>
      </div>
    </div>
  );
}

export function RowDetailModal({
  row,
  instances,
  itemsById,
  categories,
  teamMembers,
  onClose,
}: {
  row: BoardRow;
  instances: PlacedInstance[];
  itemsById: Record<string, BoardItem>;
  categories: ItemCategory[];
  teamMembers: TeamMember[];
  onClose: () => void;
}) {
  const isYard = row.locationType === "yard";
  const statusLabel = isYard ? "Pátio" : ROW_STATUS_LABEL[row.status];
  const mapsHref = normalizeMapsUrl(row.mapsUrl);
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  const allocatedTeam = row.teamMemberIds
    .map((id) => teamMembers.find((m) => m.id === id))
    .filter(Boolean) as TeamMember[];

  const integratedTeam = (row.integratedMemberIds ?? [])
    .map((id) => teamMembers.find((m) => m.id === id))
    .filter(Boolean) as TeamMember[];

  const rowItems = instances
    .map((inst) => ({ inst, item: itemsById[inst.itemId] }))
    .filter((x) => !!x.item);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background"
      role="dialog"
      aria-modal="true"
    >
      {/* header */}
      <div
        className="relative shrink-0 px-6 py-8 md:px-10"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklch, ${row.color} 40%, white) 0%, color-mix(in oklch, ${row.color} 15%, white) 100%)`,
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/10 text-foreground transition hover:bg-black/20"
          title="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="mt-1 h-4 w-4 shrink-0 rounded-sm" style={{ background: row.color }} />
          <div className="min-w-0">
            <h1 className="op-title text-2xl font-bold leading-tight md:text-3xl">{row.name}</h1>
            {row.description && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{row.description}</span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-primary-foreground"
                style={{ background: row.color }}
              >
                {!isYard && row.status === "waiting" && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" />
                )}
                {statusLabel}
              </span>
              <span className="op-label flex items-center gap-1 rounded-full bg-black/10 px-3 py-1 text-xs font-semibold">
                <Package className="h-3 w-3" />
                {rowItems.length} {rowItems.length === 1 ? "item" : "itens"}
              </span>
              {allocatedTeam.length > 0 && (
                <span className="op-label flex items-center gap-1 rounded-full bg-black/10 px-3 py-1 text-xs font-semibold">
                  <Users className="h-3 w-3" />
                  {allocatedTeam.length} alocados
                </span>
              )}
              {integratedTeam.length > 0 && (
                <span className="op-label flex items-center gap-1 rounded-full bg-emerald-600/20 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <ShieldCheck className="h-3 w-3" />
                  {integratedTeam.length} integrados
                </span>
              )}
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="op-label flex items-center gap-1 rounded-full bg-black/10 px-3 py-1 text-xs font-semibold transition hover:bg-black/20"
                >
                  <MapPin className="h-3 w-3" />
                  Abrir no Maps
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-10">
          {/* equipe integrada */}
          {integratedTeam.length > 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Equipe integrada ({integratedTeam.length})
                </h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {integratedTeam.map((m) => {
                  const isAllocated = row.teamMemberIds.includes(m.id);
                  return (
                    <div key={m.id} className="relative">
                      <MemberChip member={m} />
                      {isAllocated && (
                        <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                          vai
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* equipe alocada (se diferente da integrada) */}
          {allocatedTeam.length > 0 && integratedTeam.length === 0 && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Equipe alocada ({allocatedTeam.length})
                </h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {allocatedTeam.map((m) => (
                  <MemberChip key={m.id} member={m} />
                ))}
              </div>
            </section>
          )}

          {/* itens */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Itens alocados ({rowItems.length})
              </h2>
            </div>

            {rowItems.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed bg-card/40">
                <p className="text-sm text-muted-foreground">Nenhum item alocado neste local.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {rowItems.map(({ inst, item }) => {
                  const statusMeta = ITEM_STATUS_META[item.status];
                  const category = categoryById[item.categoryId];
                  const urgency = expiryUrgency(item.expiryDate);
                  const urgencyMeta = urgency ? URGENCY_META[urgency] : null;

                  return (
                    <ClickableItemCard
                      key={inst.instanceId}
                      item={item}
                      category={category}
                      statusMeta={statusMeta}
                      urgencyMeta={urgencyMeta}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ClickableItemCard({
  item,
  category,
  statusMeta,
  urgencyMeta,
}: {
  item: BoardItem;
  category: ItemCategory | undefined;
  statusMeta: { label: string; color: string; softColor: string };
  urgencyMeta: (typeof URGENCY_META)[keyof typeof URGENCY_META] | null;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setInfoOpen(true)}
        className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm text-left transition hover:shadow-md hover:-translate-y-0.5 active:scale-95"
        style={{ borderBottomColor: statusMeta.color, borderBottomWidth: 3 }}
      >
        <div
          className="flex h-20 w-full items-center justify-center"
          style={{ background: statusMeta.softColor, color: item.color }}
        >
          <AssetIcon item={item} className="h-full w-full object-contain p-4" fallbackSize={40} />
        </div>
        <div className="flex flex-1 flex-col p-3">
          <div className="truncate text-sm font-bold">{item.name}</div>
          {category && (
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: category.color }} />
              {category.name}
            </div>
          )}
          {item.description && (
            <p className="mt-1.5 line-clamp-2 text-[10px] text-muted-foreground">
              {item.description}
            </p>
          )}
          <div className="mt-auto pt-2 space-y-1.5">
            <span
              className="op-label inline-block rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: statusMeta.softColor, color: statusMeta.color }}
            >
              {statusMeta.label}
            </span>
            {item.isRentalEquipment && (
              <span className="op-label inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-600/10 text-emerald-700">
                {item.status === "on_site" ? "Alocado" : `Locação${rentalPeriodSuffix(item.rentalPeriod)}`}
              </span>
            )}
            {item.expiryDate && urgencyMeta && (
              <div
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: urgencyMeta.bg, color: urgencyMeta.color }}
              >
                <urgencyMeta.icon className="h-3 w-3" />
                Validade: {formatDate(item.expiryDate)}
              </div>
            )}
            {item.isRentalEquipment && item.rentalValue !== undefined && (
              <div className="text-[10px] font-semibold text-emerald-700">
                Locação{rentalPeriodSuffix(item.rentalPeriod)}: {formatCurrencyBRL(item.rentalValue)}
              </div>
            )}
          </div>
        </div>
      </button>
      <ItemInfoDialog
        item={item}
        category={category}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </>
  );
}


