import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  CalendarClock,
  Clock,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Pencil,
  QrCode,
  Wrench,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { getRecentAuditLog, type AuditEntry } from "../lib/audit-log";
import type { AssetDocumentType, BoardItem, BoardRow, ItemCategory } from "../lib/board-types";
import { rentalPeriodSuffix } from "../lib/board-types";
import { formatCurrencyBRL } from "../lib/format";
import { ITEM_STATUS_META } from "../lib/item-status";

const DOCUMENT_TYPE_LABELS: Record<AssetDocumentType, string> = {
  calibration_certificate: "Certificado de calibração",
  maintenance_report: "Laudo de manutenção",
  invoice: "Nota fiscal",
  manual: "Manual",
  photo: "Foto",
  other: "Outro",
};

const ACTION_LABELS: Record<string, string> = {
  criou_item: "Item cadastrado",
  editou_item: "Cadastro atualizado",
  moveu_item: "Movimentado",
  removeu_item: "Retirado do quadro",
  atualizou_status: "Status atualizado",
  duplicou_item: "Item duplicado",
};

function formatDate(iso?: string) {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayDiff(iso?: string) {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000);
}

function documentAlert(expiryDate?: string) {
  const diff = dayDiff(expiryDate);
  if (diff === null) return null;
  if (diff < 0) return { text: "Vencido", color: "#dc2626", bg: "#fef2f2" };
  if (diff <= 30) return { text: `Vence em ${diff}d`, color: "#ea580c", bg: "#fff7ed" };
  return null;
}

export function AssetDetailSheet({
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
  onEdit: (item: BoardItem) => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const statusMeta = ITEM_STATUS_META[item.status];
  const identifier = item.assetCode || item.serialNumber || item.id;
  const qrContent = useMemo(
    () => `GEOTESTE|ATIVO:${identifier}|NOME:${item.name}|ID:${item.id}`,
    [identifier, item.id, item.name],
  );

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrContent, { width: 240, margin: 1, errorCorrectionLevel: "M" })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });

    getRecentAuditLog(200).then((entries) => {
      if (!active) return;
      setHistory(entries.filter((entry) => entry.entity_name === item.name).slice(0, 6));
    });
    return () => {
      active = false;
    };
  }, [item.name, qrContent]);

  function downloadQrCode() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-${identifier.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}.png`;
    link.click();
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[calc(100%-1rem)] overflow-y-auto p-0 sm:max-w-xl">
        <div
          className="px-6 pb-5 pt-7"
          style={{ background: statusMeta.softColor, color: statusMeta.color }}
        >
          <SheetHeader>
            <SheetTitle className="op-title pr-7 text-2xl leading-tight">{item.name}</SheetTitle>
            <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className="op-label rounded-full px-2.5 py-1 text-[10px] font-bold"
                style={{ background: "white", color: statusMeta.color }}
              >
                {statusMeta.label}
              </span>
              {item.isRentalEquipment && (
                <span className="op-label rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-foreground">
                  {item.status === "on_site" ? "Alocado" : `Locação${rentalPeriodSuffix(item.rentalPeriod)}`}
                </span>
              )}
              {category && (
                <span className="op-label rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-foreground">
                  {category.name}
                </span>
              )}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCell label="Patrimônio" value={item.assetCode ?? "-"} />
            <SummaryCell label="Número de série" value={item.serialNumber ?? "-"} />
            <SummaryCell label="Fabricante" value={item.manufacturer ?? "-"} />
            <SummaryCell label="Modelo" value={item.model ?? "-"} />
            {item.isRentalEquipment && (
              <>
                <SummaryCell
                  label="Equipamento de locação"
                  value={item.status === "on_site" ? "Alocado" : "Disponível"}
                />
                <SummaryCell label={`Valor da locação ${rentalPeriodSuffix(item.rentalPeriod)}`} value={formatCurrencyBRL(item.rentalValue)} />
              </>
            )}
          </div>

          <section className="rounded-lg border bg-card p-4">
            <h3 className="op-label mb-3 text-[11px] text-muted-foreground">
              Situação operacional
            </h3>
            {location ? (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <div className="font-semibold">{location.name}</div>
                  <div className="text-xs text-muted-foreground">Local atual do item</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Base / sem alocação atual.</p>
            )}
            {item.status === "on_site" && item.expectedReturnDate && (
              <OperationalRow
                icon={CalendarClock}
                label="Retorno previsto da obra"
                value={formatDate(item.expectedReturnDate)}
              />
            )}
            {item.status === "maintenance" && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <OperationalRow
                  icon={Wrench}
                  label="Motivo"
                  value={item.maintenanceReason ?? "Não informado"}
                />
                <OperationalRow
                  icon={Clock}
                  label="Previsão de retorno"
                  value={formatDate(item.maintenanceReturnDate)}
                />
                {item.maintenanceProvider && (
                  <div className="text-xs text-muted-foreground">
                    Responsável:{" "}
                    <span className="font-semibold text-foreground">
                      {item.maintenanceProvider}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="op-label text-[11px] text-muted-foreground">
                Documentos e certificados
              </h3>
              <span className="op-label rounded bg-secondary px-2 py-0.5 text-[10px] font-bold">
                {(item.documents ?? []).length}
              </span>
            </div>
            {(item.documents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
            ) : (
              <div className="space-y-2">
                {(item.documents ?? []).map((document) => {
                  const alert = documentAlert(document.expiryDate);
                  return (
                    <a
                      key={document.id}
                      href={document.url}
                      target="_blank"
                      rel="noreferrer"
                      download={document.name}
                      className="flex items-center gap-3 rounded-md border bg-secondary/25 p-3 transition hover:border-primary/40"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{document.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {DOCUMENT_TYPE_LABELS[document.type]}
                          {document.expiryDate ? ` · ${formatDate(document.expiryDate)}` : ""}
                        </div>
                      </div>
                      {alert && (
                        <span
                          className="shrink-0 rounded px-1.5 py-1 text-[10px] font-bold"
                          style={{ background: alert.bg, color: alert.color }}
                        >
                          {alert.text}
                        </span>
                      )}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="flex gap-4">
              <div className="flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-md border bg-white">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code do ativo ${item.name}`}
                    className="h-32 w-32"
                  />
                ) : (
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="op-label text-[11px] text-muted-foreground">Etiqueta QR Code</h3>
                <p className="mt-2 text-sm">
                  Identificação: <span className="font-semibold">{identifier}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use a etiqueta para consultar o patrimônio pelo celular.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  onClick={downloadQrCode}
                  disabled={!qrDataUrl}
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar QR
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h3 className="op-label mb-3 text-[11px] text-muted-foreground">Histórico recente</h3>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentações registradas.</p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className="border-l-2 border-primary/30 pl-3 text-xs">
                    <div className="font-semibold">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </div>
                    <div className="text-muted-foreground">
                      {entry.actor_name} · {formatDateTime(entry.created_at)}
                    </div>
                    {entry.detail && (
                      <div className="mt-0.5 text-muted-foreground">{entry.detail}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <Button
            className="w-full"
            onClick={() => {
              onClose();
              onEdit(item);
            }}
          >
            <Pencil className="h-4 w-4" />
            Editar ativo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary px-3 py-2">
      <div className="op-label text-[10px] text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function OperationalRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: string;
}) {
  return (
    <div className="mt-3 flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

