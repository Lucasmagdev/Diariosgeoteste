import { useMemo } from "react";
import { AlertTriangle, CalendarClock, CalendarX, CheckCircle, Clock } from "lucide-react";
import type { BoardItem, BoardRow, ItemCategory, PlacedInstance } from "../lib/board-types";
import { AssetIcon } from "./AssetIcon";

type Urgency = "expired" | "critical" | "warning" | "ok" | "none";

const URGENCY_META: Record<
  Urgency,
  { label: string; color: string; bg: string; icon: typeof AlertTriangle }
> = {
  expired: { label: "Vencido", color: "#dc2626", bg: "#fef2f2", icon: CalendarX },
  critical: { label: "Vence em até 30 dias", color: "#ea580c", bg: "#fff7ed", icon: AlertTriangle },
  warning: { label: "Vence em até 90 dias", color: "#ca8a04", bg: "#fefce8", icon: Clock },
  ok: { label: "Em dia", color: "#16a34a", bg: "#f0fdf4", icon: CheckCircle },
  none: { label: "Sem validade cadastrada", color: "#6b7280", bg: "#f9fafb", icon: Clock },
};

function getUrgency(expiryDate: string | undefined): Urgency {
  if (!expiryDate) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + "T00:00:00");
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "critical";
  if (diffDays <= 90) return "warning";
  return "ok";
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function diffLabel(expiryDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate + "T00:00:00");
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return `Venceu há ${Math.abs(diffDays)} dias`;
  if (diffDays === 0) return "Vence hoje";
  if (diffDays === 1) return "Vence amanhã";
  return `Vence em ${diffDays} dias`;
}

export function VencimentosView({
  items,
  categories,
  instances,
  rows,
}: {
  items: BoardItem[];
  categories: ItemCategory[];
  instances: PlacedInstance[];
  rows: BoardRow[];
}) {
  const rowById = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows]);
  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const itemsWithExpiry = useMemo(() => {
    return items
      .filter((item) => !(item.isRentalEquipment && item.status === "on_site"))
      .filter((item) => item.expiryDate)
      .map((item) => {
        const urgency = getUrgency(item.expiryDate);
        const placed = instances.find((inst) => inst.itemId === item.id);
        const location = placed ? rowById[placed.rowId] : null;
        const category = categoryById[item.categoryId];
        return { item, urgency, location, category };
      })
      .sort((a, b) => {
        const order: Urgency[] = ["expired", "critical", "warning", "ok"];
        const ai = order.indexOf(a.urgency);
        const bi = order.indexOf(b.urgency);
        if (ai !== bi) return ai - bi;
        return (a.item.expiryDate ?? "").localeCompare(b.item.expiryDate ?? "");
      });
  }, [items, instances, rowById, categoryById]);

  const itemsWithoutExpiry = useMemo(
    () =>
      items.filter(
        (item) => !(item.isRentalEquipment && item.status === "on_site") && !item.expiryDate,
      ),
    [items],
  );

  const groups = useMemo(() => {
    const map: Partial<Record<Urgency, typeof itemsWithExpiry>> = {};
    for (const entry of itemsWithExpiry) {
      if (!map[entry.urgency]) map[entry.urgency] = [];
      map[entry.urgency]!.push(entry);
    }
    return map;
  }, [itemsWithExpiry]);

  const URGENCY_ORDER: Urgency[] = ["expired", "critical", "warning", "ok"];

  const currentYear = new Date().getFullYear();
  const endOfYearIso = `${currentYear}-12-31`;
  const itemsDueByYearEnd = useMemo(
    () => itemsWithExpiry.filter((entry) => (entry.item.expiryDate ?? "") <= endOfYearIso),
    [itemsWithExpiry, endOfYearIso],
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
      <div className="mb-6">
        <h2 className="op-title text-xl font-bold">Vencimentos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Controle de validade e calibracao dos itens.
        </p>
      </div>

      {itemsWithExpiry.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <CalendarX className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Nenhum item com data de validade cadastrada.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Edite um item e preencha o campo "Validade / Calibracao".
          </p>
        </div>
      )}

      {itemsDueByYearEnd.length > 0 && (
        <section className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="op-label text-[11px] font-bold uppercase text-primary">
              Vencimentos até o fim de {currentYear}
            </h3>
            <span className="op-label rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
              {itemsDueByYearEnd.length}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {itemsDueByYearEnd.map(({ item, urgency, location, category }) => {
              const meta = URGENCY_META[urgency];
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm"
                  style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                    style={{ background: meta.bg, color: item.color }}
                  >
                    <AssetIcon
                      item={item}
                      className="h-full w-full object-contain p-1.5"
                      fallbackSize={20}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{item.name}</div>
                    {category && (
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: category.color }}
                        />
                        {category.name}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className="op-label rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {formatDate(item.expiryDate!)}
                      </span>
                      <span className="op-label text-[10px] text-muted-foreground">
                        {diffLabel(item.expiryDate!)}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[10px] text-muted-foreground">
                      {location ? (
                        <>
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-sm"
                            style={{ background: location.color }}
                          />
                          {location.name}
                        </>
                      ) : (
                        "Sem alocação"
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="space-y-6">
        {URGENCY_ORDER.map((urgency) => {
          const group = groups[urgency];
          if (!group || group.length === 0) return null;
          const meta = URGENCY_META[urgency];
          const Icon = meta.icon;

          return (
            <section key={urgency}>
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} />
                <h3
                  className="op-label text-[11px] font-bold uppercase"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </h3>
                <span
                  className="op-label rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {group.length}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.map(({ item, location, category }) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm"
                    style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{ background: meta.bg, color: item.color }}
                    >
                      <AssetIcon
                        item={item}
                        className="h-full w-full object-contain p-1.5"
                        fallbackSize={20}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{item.name}</div>
                      {category && (
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: category.color }}
                          />
                          {category.name}
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className="op-label rounded px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {formatDate(item.expiryDate!)}
                        </span>
                        <span className="op-label text-[10px] text-muted-foreground">
                          {diffLabel(item.expiryDate!)}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[10px] text-muted-foreground">
                        {location ? (
                          <>
                            <span
                              className="mr-1 inline-block h-2 w-2 rounded-sm"
                              style={{ background: location.color }}
                            />
                            {location.name}
                          </>
                        ) : (
                          "Sem alocação"
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {itemsWithoutExpiry.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <h3 className="op-label text-[11px] font-bold uppercase text-muted-foreground">
                Sem validade cadastrada
              </h3>
              <span className="op-label rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                {itemsWithoutExpiry.length}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {itemsWithoutExpiry.map((item) => {
                const placed = instances.find((inst) => inst.itemId === item.id);
                const location = placed ? rowById[placed.rowId] : null;
                const category = categoryById[item.categoryId];
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm opacity-60"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                      style={{ color: item.color }}
                    >
                      <AssetIcon
                        item={item}
                        className="h-full w-full object-contain p-1.5"
                        fallbackSize={20}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{item.name}</div>
                      {category && (
                        <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: category.color }}
                          />
                          {category.name}
                        </div>
                      )}
                      <div className="mt-1 truncate text-[10px] text-muted-foreground">
                        {location ? (
                          <>
                            <span
                              className="mr-1 inline-block h-2 w-2 rounded-sm"
                              style={{ background: location.color }}
                            />
                            {location.name}
                          </>
                        ) : (
                          "Sem alocação"
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}


