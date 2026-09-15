import type { ReactNode } from "react";
import type { BoardItem } from "../lib/board-types";
import { rentalPeriodSuffix } from "../lib/board-types";
import { formatCurrencyBRL } from "../lib/format";
import { getItemStatusMeta } from "../lib/item-status";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { AssetIcon } from "./AssetIcon";

export function ItemBlock({
  item,
  compact = false,
  dense = false,
  dragging = false,
  iconWrapper,
  onInfoClick,
  rentalBadge = false,
  iconOnly = false,
}: {
  item: BoardItem;
  compact?: boolean;
  dense?: boolean;
  dragging?: boolean;
  iconWrapper?: (icon: ReactNode) => ReactNode;
  onInfoClick?: () => void;
  rentalBadge?: boolean;
  iconOnly?: boolean;
}) {
  const statusMeta = getItemStatusMeta(item.status);
  const cleanDescription = item.description
    .replace(/^(DISPON[ÍI]VEL|EM OBRA|MANUTEN[ÇC][ÃA]O|AQUISI[ÇC][ÃA]O)\s*[·-]\s*/i, "")
    .trim();
  const isExpired = Boolean(item.expiryDate && item.expiryDate < new Date().toISOString().slice(0, 10));
  const expiryLabel = item.expiryDate
    ? (() => {
        const [year, month, day] = item.expiryDate.split("-");
        return `${day}/${month}/${year}`;
      })()
    : "";

  const icon = (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md text-primary-foreground ${
        dense ? "h-8 w-8" : "h-10 w-10"
      }`}
      style={{ background: statusMeta.softColor, color: item.color }}
    >
      <AssetIcon
        item={item}
        className={`h-full w-full object-contain ${dense ? "p-0.5" : "p-1"}`}
        fallbackSize={20}
      />
    </div>
  );

  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            tabIndex={0}
            aria-label={item.name}
            className={`group relative flex items-center justify-center rounded-lg border bg-card p-0.5 transition-all ${
              dragging
                ? "scale-105 shadow-[var(--shadow-lift)] border-primary"
                : "shadow-[var(--shadow-soft)] hover:border-primary/40"
            }`}
          >
            {iconWrapper ? iconWrapper(icon) : icon}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{item.name}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          aria-label={item.name}
          className={`group relative flex items-center rounded-lg border bg-card transition-all ${
            dragging
              ? "scale-105 shadow-[var(--shadow-lift)] border-primary"
              : "shadow-[var(--shadow-soft)] hover:border-primary/40"
          } ${dense ? "min-w-[108px] max-w-[132px] gap-1.5 px-1.5 py-1" : `gap-3 px-3 py-2 ${compact ? "min-w-[160px]" : "w-full"}`}`}
        >
      {iconWrapper ? iconWrapper(icon) : icon}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {onInfoClick ? (
            <button
              type="button"
              className={`truncate font-extrabold text-foreground [font-family:var(--font-display)] hover:underline hover:text-primary text-left ${
                dense ? "text-[12px] leading-none" : "text-sm md:text-[15px]"
              }`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onInfoClick();
              }}
            >
              {item.name}
            </button>
          ) : (
            <div
              className={`truncate font-extrabold text-foreground [font-family:var(--font-display)] ${
                dense ? "text-[12px] leading-none" : "text-sm md:text-[15px]"
              }`}
            >
              {item.name}
            </div>
          )}
          {!compact && (
            <span
              className="op-label shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: statusMeta.softColor, color: statusMeta.color }}
            >
              {statusMeta.label}
            </span>
          )}
          {item.isRentalEquipment && !compact && (
            <span className="op-label shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-800">
              {item.status === "on_site" ? "Alocado" : `Locação${rentalPeriodSuffix(item.rentalPeriod)}`}
            </span>
          )}
          {rentalBadge && item.isRentalEquipment && compact && (
            <span className="op-label shrink-0 rounded-full border border-amber-500/30 bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-amber-800">
              LOCAÇÃO
            </span>
          )}
        </div>
        {!compact && (
          <div className="space-y-0.5">
            <div className="op-label truncate text-[10px] text-muted-foreground">
              {cleanDescription}
            </div>
            {item.isRentalEquipment && item.rentalValue !== undefined && (
              <div className="op-label truncate text-[10px] font-semibold text-emerald-700">
                Locação{rentalPeriodSuffix(item.rentalPeriod)}: {formatCurrencyBRL(item.rentalValue)}
              </div>
            )}
            {item.expiryDate && (
              <div
                className={`op-label truncate text-[10px] font-semibold ${
                  isExpired ? "text-violet-600" : "text-muted-foreground"
                }`}
              >
                Validade: {expiryLabel}
                {isExpired && " · Vencido"}
              </div>
            )}
          </div>
        )}
      </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{item.name}</TooltipContent>
    </Tooltip>
  );
}


