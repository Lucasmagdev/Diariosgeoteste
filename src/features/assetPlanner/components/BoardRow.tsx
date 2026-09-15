import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, RotateCcw, GripVertical, Pencil, MapPin, Check, ArrowDown, Trash2, ShieldCheck, Maximize2 } from "lucide-react";
import type { BoardItem, BoardItemStatus, BoardRow as BoardRowType, PlacedInstance } from "../lib/board-types";
import { rentalPeriodSuffix } from "../lib/board-types";
import { ITEM_STATUS_META, getItemStatusMeta } from "../lib/item-status";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { ItemBlock } from "./ItemBlock";
import { ItemInfoDialog } from "./ItemInfoDialog";
import type { TeamMember } from "../lib/board-types";

export type BoardDensity = "comfortable" | "compact" | "dense" | "mini" | "map";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function DeleteRowButton({
  rowName,
  compact = false,
  onDelete,
}: {
  rowName: string;
  compact?: boolean;
  onDelete: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className={
            compact
              ? "rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              : "op-label flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          }
          title="Excluir local"
        >
          <Trash2 className={compact ? "h-3.5 w-3.5" : "h-3 w-3"} />
          {!compact && "Excluir"}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[calc(100%-2rem)]">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir local?</AlertDialogTitle>
          <AlertDialogDescription>
            O local "{rowName}" e suas alocações serão removidos do quadro. Os itens continuarão
            disponíveis na biblioteca.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>
            Excluir local
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SortablePlaced({
  instance,
  item,
  density,
  onRemove,
  onUpdateStatus,
  onUpdateQuantity,
  maxQuantity,
  canEdit,
  canMove,
  bulkSelectMode,
  selected,
  onToggle,
  highlighted,
}: {
  instance: PlacedInstance;
  item: BoardItem;
  density: BoardDensity;
  onRemove: () => void;
  onUpdateStatus: (itemId: string, status: BoardItemStatus, rowId?: string) => void;
  onUpdateQuantity: (instanceId: string, quantity: number) => void;
  maxQuantity?: number;
  canEdit: boolean;
  canMove: boolean;
  bulkSelectMode: boolean;
  selected: boolean;
  onToggle: () => void;
  highlighted?: boolean;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [editingQty, setEditingQty] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(String(instance.quantity ?? 1));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: instance.instanceId,
    data: { source: "placed", instanceId: instance.instanceId, rowId: instance.rowId },
    disabled: !canMove,
  });

  const statusMeta = getItemStatusMeta(item.status);
  const isRentalOnBoard = item.isRentalEquipment && item.status === "on_site";
  const isMini = density === "mini";
  const isTight = density === "dense" || density === "map" || isMini;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      id={`instance-${instance.instanceId}`}
      style={style}
      className={`group relative shrink-0 ${highlighted ? "animate-pulse rounded-xl ring-2 ring-primary ring-offset-2" : ""}`}
    >
      {canMove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`absolute -left-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 shadow-sm transition-all ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          style={{
            borderColor: selected ? "hsl(var(--foreground))" : "hsl(var(--border))",
            background: selected ? "hsl(var(--foreground))" : "hsl(var(--background))",
          }}
        >
          {selected && <Check className="h-2.5 w-2.5 text-background" />}
        </button>
      )}
      <div
        className={`flex items-stretch overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)] transition-all ${
          isRentalOnBoard ? "border-emerald-500/50 ring-1 ring-emerald-500/25" : ""
        } ${
          selected
            ? "ring-2 ring-primary ring-offset-1"
            : bulkSelectMode
              ? "opacity-60 hover:opacity-90"
              : "hover:border-primary/50 hover:shadow-[var(--shadow-lift)]"
        }`}
        style={{ borderBottomColor: statusMeta.color, borderBottomWidth: "2px" }}
      >
        {canMove && !isMini && <button
          {...attributes}
          {...listeners}
          className={`flex cursor-grab items-center bg-muted/40 active:cursor-grabbing ${
            isTight ? "px-0.5" : "px-1"
          }`}
          title="Arrastar"
        >
          <GripVertical className={`${isTight ? "h-3.5 w-3.5" : "h-4 w-4"} text-muted-foreground`} />
        </button>}
        <div
          className={isTight ? "px-0.5 py-0.5" : "px-1 py-1"}
          {...(isMini && canMove ? { ...attributes, ...listeners } : {})}
        >
          <div className="relative">
            {isRentalOnBoard && !isMini && (
              <div className="pointer-events-none absolute -right-1.5 -top-2 z-20">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-400 px-2.5 py-1 text-[9px] font-extrabold tracking-[0.12em] text-amber-950 shadow-md">
                  LOCAÇÃO{rentalPeriodSuffix(item.rentalPeriod).toUpperCase()}
                </span>
              </div>
            )}
            <ItemBlock
              item={item}
              compact
              dense={isTight}
              iconOnly={isMini}
              onInfoClick={() => setInfoOpen(true)}
              rentalBadge
              iconWrapper={canEdit ? (icon) => (
                <Popover open={statusOpen} onOpenChange={setStatusOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="shrink-0 rounded-md outline-none ring-offset-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      title="Alterar status"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {icon}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="bottom"
                    className="w-48 p-2"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="op-label mb-1 px-2 text-[10px] text-muted-foreground">
                      Status do item
                    </div>
                    {Object.entries(ITEM_STATUS_META).map(([status, meta]) => {
                      const typedStatus = status as BoardItemStatus;
                      const selected = item.status === typedStatus;

                      return (
                        <button
                          key={status}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold hover:bg-muted"
                          onClick={() => {
                            onUpdateStatus(item.id, typedStatus, instance.rowId);
                            setStatusOpen(false);
                          }}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <span className="op-label flex-1 text-[10px]">{meta.label}</span>
                          {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              ) : undefined}
            />
            {item.stockQuantity !== undefined && (
              <div
                className="absolute -bottom-1.5 -right-1.5 z-20"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                {editingQty ? (
                  <input
                    type="number"
                    min={1}
                    max={maxQuantity}
                    step={1}
                    autoFocus
                    value={qtyDraft}
                    onChange={(event) => setQtyDraft(event.target.value)}
                    onBlur={() => {
                      setEditingQty(false);
                      onUpdateQuantity(instance.instanceId, Number(qtyDraft));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                      if (event.key === "Escape") {
                        setQtyDraft(String(instance.quantity ?? 1));
                        setEditingQty(false);
                      }
                    }}
                    className="h-5 w-10 rounded-full border-2 border-background bg-primary px-1 text-center text-[10px] font-extrabold text-primary-foreground outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    disabled={!canEdit && !canMove}
                    onClick={() => {
                      setQtyDraft(String(instance.quantity ?? 1));
                      setEditingQty(true);
                    }}
                    title={`Editar quantidade alocada${maxQuantity ? ` (máximo ${maxQuantity})` : ""}`}
                    className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-extrabold text-primary-foreground shadow-sm"
                  >
                    x{instance.quantity ?? 1}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {canMove && <button
        onClick={onRemove}
        className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow group-hover:flex"
        title="Remover"
      >
        <X className="h-3 w-3" />
      </button>}
      <ItemInfoDialog item={item} open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  );
}

export function BoardRowView({
  row,
  instances,
  itemsById,
  teamMembers,
  density,
  isOver,
  onRemoveInstance,
  onUpdateItemStatus,
  onUpdateInstanceQuantity,
  instanceQuantityLimits,
  onResetRow,
  onEditRow,
  onDeleteRow,
  onOpenDetail,
  canEdit,
  canMove,
  bulkSelectMode,
  selectedInstanceIds,
  onToggleBulkInstance,
  onToggleSelectAll,
  highlightInstanceId,
}: {
  row: BoardRowType;
  instances: PlacedInstance[];
  itemsById: Record<string, BoardItem>;
  teamMembers: TeamMember[];
  density: BoardDensity;
  isOver: boolean;
  onRemoveInstance: (instanceId: string) => void;
  onUpdateInstanceQuantity: (instanceId: string, quantity: number) => void;
  instanceQuantityLimits: Record<string, number | undefined>;
  onUpdateItemStatus: (itemId: string, status: BoardItemStatus, rowId?: string) => void;
  onResetRow: () => void;
  onEditRow: () => void;
  onDeleteRow: () => void;
  onOpenDetail: () => void;
  canEdit: boolean;
  canMove: boolean;
  bulkSelectMode: boolean;
  selectedInstanceIds: Set<string>;
  onToggleBulkInstance: (instanceId: string) => void;
  onToggleSelectAll: () => void;
  highlightInstanceId?: string | null;
}) {
  const { setNodeRef } = useDroppable({
    id: `row:${row.id}`,
    data: { source: "row", rowId: row.id },
    disabled: !canMove,
  });

  const statusLabel = {
    planning: "Planejamento",
    active: "Em operação",
    waiting: "Aguardando",
    done: "Concluída",
  }[row.status];
  const isYard = row.locationType === "yard";
  const locationStatusLabel = isYard ? "Pátio" : statusLabel;
  const rowTeam = row.teamMemberIds
    .map((id) => teamMembers.find((member) => member.id === id))
    .filter(Boolean) as TeamMember[];
  const integratedCount = (row.integratedMemberIds ?? []).length;
  const isDense = density === "dense";
  const isMap = density === "map";
  const isCompact = density === "compact";
  const isMini = density === "mini";
  const isTightHeader = isDense || isMini;

  if (isMap) {
    return (
      <div
        className="grid min-h-[86px] overflow-hidden rounded-md border bg-card shadow-[var(--shadow-soft)] md:grid-cols-[300px_minmax(0,1fr)]"
        style={{ borderLeftColor: row.color, borderLeftWidth: "4px" }}
      >
        <div className="flex min-w-0 border-b md:border-b-0 md:border-r">
          <div
            className="min-w-0 flex-1 px-3 py-2"
            style={{ background: `linear-gradient(90deg, color-mix(in oklch, ${row.color} 8%, transparent), transparent 50%)` }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="op-title truncate text-lg leading-none">{row.name}</h3>
              <span className="op-label rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                {instances.length}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="op-label inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground" style={{ background: row.color }}>
                {!isYard && row.status === "waiting" && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" />
                )}
                {locationStatusLabel}
              </span>
              {rowTeam.slice(0, 2).map((member) => (
                <span key={member.id} className="op-label max-w-[120px] truncate rounded border bg-background px-1.5 py-0.5 text-[9px] font-bold">
                  {member.name}
                </span>
              ))}
              {rowTeam.length > 2 && (
                <span className="op-label rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  +{rowTeam.length - 2}
                </span>
              )}
            </div>
            <div className="op-label mt-1 truncate text-[9px] text-muted-foreground">
              {row.description || "Sem descrição do local"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 px-2">
            <button
              onClick={onOpenDetail}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Ver detalhes"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            {canEdit && <button
              onClick={onEditRow}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Editar local"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>}
            {canEdit && <button
              onClick={onResetRow}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Resetar linha"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>}
            {canEdit && <DeleteRowButton rowName={row.name} compact onDelete={onDeleteRow} />}
          </div>
        </div>

        <div
          ref={setNodeRef}
          className={`flex min-h-[86px] items-center gap-1.5 overflow-x-auto border-2 border-dashed p-2 transition-all ${
            bulkSelectMode
              ? "border-primary/40 bg-primary/5"
              : isOver
                ? "border-primary bg-primary/5"
                : "border-transparent bg-background/45"
          }`}
        >
          {bulkSelectMode && instances.length > 0 && (
            <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1">
              <button
                type="button"
                onClick={onToggleSelectAll}
                className="flex h-5 w-5 items-center justify-center rounded border-2 transition-colors"
                style={{
                  borderColor: instances.every((i) => selectedInstanceIds.has(i.instanceId))
                    ? "hsl(var(--primary))"
                    : "hsl(var(--border))",
                  background: instances.every((i) => selectedInstanceIds.has(i.instanceId))
                    ? "hsl(var(--primary))"
                    : "transparent",
                }}
              >
                {instances.every((i) => selectedInstanceIds.has(i.instanceId)) && (
                  <Check className="h-3 w-3 text-primary-foreground" />
                )}
                {instances.some((i) => selectedInstanceIds.has(i.instanceId)) &&
                  !instances.every((i) => selectedInstanceIds.has(i.instanceId)) && (
                    <div className="h-1.5 w-1.5 rounded-sm bg-primary" />
                  )}
              </button>
              <span className="op-label text-center text-[8px] text-muted-foreground">todos</span>
            </div>
          )}
          <SortableContext
            items={instances.map((i) => i.instanceId)}
            strategy={horizontalListSortingStrategy}
          >
            {instances.map((inst) => {
              const item = itemsById[inst.itemId];
              if (!item) return null;
              return (
                <SortablePlaced
                  key={inst.instanceId}
                  instance={inst}
                  item={item}
                  density={density}
                  onRemove={() => onRemoveInstance(inst.instanceId)}
                  onUpdateStatus={onUpdateItemStatus}
                  onUpdateQuantity={onUpdateInstanceQuantity}
                  maxQuantity={instanceQuantityLimits[inst.instanceId]}
                  canEdit={canEdit}
                  canMove={canMove}
                  bulkSelectMode={bulkSelectMode}
                  selected={selectedInstanceIds.has(inst.instanceId)}
                  onToggle={() => onToggleBulkInstance(inst.instanceId)}
                  highlighted={highlightInstanceId === inst.instanceId}
                />
              );
            })}
          </SortableContext>
          {instances.length === 0 && (
            <div className="op-label flex w-full flex-col items-center justify-center gap-1.5 text-[9px] text-muted-foreground">
              <ArrowDown className="h-3.5 w-3.5 animate-bounce opacity-30" />
              Solte itens aqui
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border bg-card shadow-[var(--shadow-soft)]"
      style={{ borderLeftColor: row.color, borderLeftWidth: "4px" }}
    >
      <div className="flex items-stretch border-b">
        <div
          className={`flex min-w-0 flex-1 items-center justify-between gap-3 px-4 ${isTightHeader ? "py-2" : "py-3"}`}
          style={{ background: `linear-gradient(90deg, color-mix(in oklch, ${row.color} ${row.status === "active" ? "12%" : "7%"}, transparent), transparent 55%)` }}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`op-title truncate leading-none ${isTightHeader ? "text-lg md:text-xl" : "text-xl md:text-2xl"}`}>{row.name}</h3>
              <span className="op-label rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {instances.length} {instances.length === 1 ? "item" : "itens"}
              </span>
              <span className="op-label inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold text-primary-foreground" style={{ background: row.color }}>
                {!isYard && row.status === "waiting" && (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/80" />
                )}
                {locationStatusLabel}
              </span>
              <TooltipProvider delayDuration={120}>
                <div className="ml-1 flex min-w-0 flex-wrap items-center gap-1.5">
                  {rowTeam.slice(0, isTightHeader ? 3 : 4).map((member) => (
                    <Tooltip key={member.id}>
                      <TooltipTrigger asChild>
                        <div className="flex min-w-0 max-w-[190px] items-center gap-1.5 rounded-full border bg-background px-1.5 py-0.5 shadow-sm">
                          <Avatar className={isMini ? "h-5 w-5 border border-card" : "h-6 w-6 border border-card"}>
                            {member.photoUrl && <AvatarImage src={member.photoUrl} alt={member.name} />}
                            <AvatarFallback
                              className="op-label text-[9px] font-bold text-primary-foreground"
                              style={{ background: member.color }}
                            >
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          {!isMini && (
                            <span className="op-label min-w-0 truncate text-[10px] font-bold text-foreground">
                              {member.name}
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {member.name} · {member.role}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {rowTeam.length > (isTightHeader ? 3 : 4) && (
                    <div className="flex h-7 items-center justify-center rounded-full border bg-muted px-2 text-[10px] font-bold text-muted-foreground shadow-sm">
                      +{rowTeam.length - (isTightHeader ? 3 : 4)}
                    </div>
                  )}
                  {rowTeam.length === 0 && (
                    <span className="op-label rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Sem equipe
                    </span>
                  )}
                  {integratedCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                          <ShieldCheck className="h-3 w-3" />
                          {integratedCount}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{integratedCount} integrado{integratedCount !== 1 ? "s" : ""}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            </div>
            <div className={`op-label mt-1 min-w-0 items-center gap-1 text-[10px] text-muted-foreground ${isTightHeader ? "hidden lg:flex" : "flex"}`}>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{row.description || "Sem descrição do local"}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onOpenDetail}
              className="op-label flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Ver detalhes"
            >
              <Maximize2 className="h-3 w-3" /> {!isMini && "Detalhes"}
            </button>
            {canEdit && <button
              onClick={onEditRow}
              className="op-label flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Editar local"
            >
              <Pencil className="h-3 w-3" /> {!isMini && "Editar"}
            </button>}
            {canEdit && <button
              onClick={onResetRow}
              className="op-label flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Resetar linha"
            >
              <RotateCcw className="h-3 w-3" /> {!isMini && "Resetar"}
            </button>}
            {canEdit && <DeleteRowButton rowName={row.name} onDelete={onDeleteRow} />}
          </div>
        </div>
      </div>
      {bulkSelectMode && (
        <div className="flex items-center gap-3 border-b bg-primary/5 px-4 py-2">
          <button
            type="button"
            onClick={onToggleSelectAll}
            className="flex items-center gap-2 text-[11px] font-medium text-foreground"
          >
            <div
              className="flex h-4 w-4 items-center justify-center rounded border-2 transition-colors"
              style={{
                borderColor: instances.every((i) => selectedInstanceIds.has(i.instanceId))
                  ? "hsl(var(--primary))"
                  : "hsl(var(--border))",
                background: instances.every((i) => selectedInstanceIds.has(i.instanceId))
                  ? "hsl(var(--primary))"
                  : "transparent",
              }}
            >
              {instances.every((i) => selectedInstanceIds.has(i.instanceId)) && (
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              )}
              {instances.some((i) => selectedInstanceIds.has(i.instanceId)) &&
                !instances.every((i) => selectedInstanceIds.has(i.instanceId)) && (
                  <div className="h-1.5 w-1.5 rounded-sm bg-primary" />
                )}
            </div>
            Selecionar todos
          </button>
          <span className="op-label text-[11px] text-muted-foreground">
            {selectedInstanceIds.size} de {instances.length} selecionado{selectedInstanceIds.size !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      <div
        ref={setNodeRef}
        className={`flex items-center overflow-x-auto rounded-lg border-2 border-dashed transition-all ${
          bulkSelectMode
            ? "border-primary/40 bg-primary/5"
            : isOver
              ? "border-primary bg-primary/5"
              : "border-border/60 bg-background/50"
        } ${isMini ? "m-2 min-h-[44px] flex-wrap gap-1 p-1.5" : isDense ? "m-2 min-h-[54px] gap-1.5 p-2" : isCompact ? "m-2 min-h-[72px] gap-2 p-2" : "m-3 min-h-[88px] gap-2 p-3"}`}
      >
        <SortableContext
          items={instances.map((i) => i.instanceId)}
          strategy={horizontalListSortingStrategy}
        >
          {instances.map((inst) => {
            const item = itemsById[inst.itemId];
            if (!item) return null;
            return (
              <SortablePlaced
                key={inst.instanceId}
                instance={inst}
                item={item}
                density={density}
                onRemove={() => onRemoveInstance(inst.instanceId)}
                onUpdateStatus={onUpdateItemStatus}
                onUpdateQuantity={onUpdateInstanceQuantity}
                maxQuantity={instanceQuantityLimits[inst.instanceId]}
                canEdit={canEdit}
                canMove={canMove}
                bulkSelectMode={bulkSelectMode}
                selected={selectedInstanceIds.has(inst.instanceId)}
                onToggle={() => onToggleBulkInstance(inst.instanceId)}
                highlighted={highlightInstanceId === inst.instanceId}
              />
            );
          })}
        </SortableContext>
        {instances.length === 0 && (
          <div className="op-label flex w-full flex-col items-center justify-center gap-2 py-2 text-[10px] text-muted-foreground">
            <ArrowDown className="h-4 w-4 animate-bounce opacity-30" />
            Arraste itens da biblioteca para este local
          </div>
        )}
      </div>
    </div>
  );
}

