import { CalendarX, AlertTriangle, Clock, CheckCircle, MapPin, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import type { BoardItem, BoardRow, ItemCategory } from "../lib/board-types";
import { rentalPeriodSuffix } from "../lib/board-types";
import { formatCurrencyBRL } from "../lib/format";
import { ITEM_STATUS_META } from "../lib/item-status";
import { AssetIcon } from "./AssetIcon";

function expiryInfo(expiryDate?: string): {
  label: string;
  color: string;
  bg: string;
  Icon: typeof CalendarX;
  diff: number;
} | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor(
    (new Date(expiryDate + "T00:00:00").getTime() - today.getTime()) / 86400000,
  );
  if (diff < 0)
    return {
      label: `Vencido há ${Math.abs(diff)} dias`,
      color: "#dc2626",
      bg: "#fef2f2",
      Icon: CalendarX,
      diff,
    };
  if (diff === 0)
    return { label: "Vence hoje", color: "#ea580c", bg: "#fff7ed", Icon: AlertTriangle, diff };
  if (diff <= 30)
    return {
      label: `Vence em ${diff} dias`,
      color: "#ea580c",
      bg: "#fff7ed",
      Icon: AlertTriangle,
      diff,
    };
  if (diff <= 90)
    return { label: `Vence em ${diff} dias`, color: "#ca8a04", bg: "#fefce8", Icon: Clock, diff };
  return {
    label: `Vence em ${diff} dias`,
    color: "#16a34a",
    bg: "#f0fdf4",
    Icon: CheckCircle,
    diff,
  };
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ItemInfoDialog({
  item,
  category,
  location,
  open,
  onClose,
  onEdit,
}: {
  item: BoardItem;
  category?: ItemCategory;
  location?: BoardRow;
  open: boolean;
  onClose: () => void;
  onEdit?: (item: BoardItem) => void;
}) {
  const statusMeta = ITEM_STATUS_META[item.status];
  const expiry = expiryInfo(item.expiryDate);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* icon header */}
        <div
          className="flex h-32 items-center justify-center"
          style={{ background: statusMeta.softColor, color: item.color }}
        >
          <AssetIcon item={item} className="h-full w-full object-contain p-7" fallbackSize={64} />
        </div>

        <div className="space-y-4 p-5">
          <DialogHeader>
            <DialogTitle className="text-lg leading-tight">{item.name}</DialogTitle>
          </DialogHeader>

          {/* badges */}
          <div className="flex flex-wrap gap-2">
            <span
              className="op-label rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: statusMeta.softColor, color: statusMeta.color }}
            >
              {statusMeta.label}
            </span>
            <span className="op-label rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
              Item
            </span>
            {item.isRentalEquipment && (
              <span className="op-label rounded-full bg-emerald-600/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                {item.status === "on_site" ? "Alocado" : `Locação${rentalPeriodSuffix(item.rentalPeriod)}`}
              </span>
            )}
            {category && (
              <span className="op-label flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: category.color }} />
                {category.name}
              </span>
            )}
          </div>

          {/* description */}
          {item.description && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
                Descrição
              </p>
              <p className="text-sm text-foreground">{item.description}</p>
            </div>
          )}

          {(item.assetCode || item.serialNumber || item.manufacturer || item.model) && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">
                Identificação patrimonial
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {item.assetCode && <InfoCell label="Patrimônio" value={item.assetCode} />}
                {item.serialNumber && <InfoCell label="Série" value={item.serialNumber} />}
                {item.manufacturer && <InfoCell label="Fabricante" value={item.manufacturer} />}
                {item.model && <InfoCell label="Modelo" value={item.model} />}
              </div>
            </div>
          )}

          {item.isRentalEquipment && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">
                Equipamento de locação
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoCell label="Status de locação" value={item.status === "on_site" ? "Alocado" : "Disponível"} />
                <InfoCell label={`Valor ${rentalPeriodSuffix(item.rentalPeriod)}`} value={formatCurrencyBRL(item.rentalValue)} />
              </div>
            </div>
          )}

          {location && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
                Local atual
              </p>
              <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 shrink-0" style={{ color: location.color }} />
                {location.name}
              </div>
            </div>
          )}

          {/* expiry */}
          {item.expiryDate && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
                Validade / Calibração
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{formatDate(item.expiryDate)}</span>
                {expiry && (
                  <span
                    className="op-label flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{ background: expiry.bg, color: expiry.color }}
                  >
                    <expiry.Icon className="h-3 w-3" />
                    {expiry.label}
                  </span>
                )}
              </div>
            </div>
          )}

          {item.lastMaintenanceDate && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">
                Manutenção
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <InfoCell label="Última" value={formatDate(item.lastMaintenanceDate)} />
              </div>
            </div>
          )}

          {onEdit && (
            <Button className="w-full" onClick={() => onEdit(item)}>
              <Pencil className="h-4 w-4" />
              Editar ativo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary px-3 py-2">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-semibold">{value}</div>
    </div>
  );
}


