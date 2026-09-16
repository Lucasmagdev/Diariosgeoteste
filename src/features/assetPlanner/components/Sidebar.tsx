import { useEffect, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ImageUp,
  Layers,
  ListPlus,
  MapPin,
  Package,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { BoardItem, BoardRow, ItemCategory, PlacedInstance } from "../lib/board-types";
import { uploadAssetFile } from "../lib/storage.functions";
import {
  compareByName,
  extractWorkCode,
  getAllocatedStock,
  getRemainingStock,
  naturalCompare,
} from "../lib/planner-helpers";
import { ItemBlock } from "./ItemBlock";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
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

const CATEGORY_COLORS = [
  "oklch(0.52 0.17 255)",
  "oklch(0.52 0.15 150)",
  "oklch(0.58 0.21 27)",
  "oklch(0.62 0.16 65)",
  "oklch(0.56 0.16 300)",
  "oklch(0.48 0.04 255)",
];

function LibraryItem({
  item,
  categoryId,
  canDrag,
  canAdd,
  canEdit,
  canMove,
  locationCodes,
  allocatedQuantity,
  stockRemaining,
  onEdit,
  onDuplicate,
  onDelete,
  onLocate,
}: {
  item: BoardItem;
  categoryId: string;
  canDrag: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canMove: boolean;
  locationCodes: string[];
  allocatedQuantity: number;
  stockRemaining?: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLocate: () => void;
}) {
  const dragId = `library:${item.id}:${item.status}`;
  const draggable = useDraggable({
    id: dragId,
    data: { source: "library-item", itemId: item.id, categoryId },
    disabled: !canDrag,
  });
  const droppable = useDroppable({
    id: `library-position:${item.id}`,
    data: { source: "library-position", itemId: item.id, categoryId },
    disabled: !canEdit,
  });

  const canDelete = canEdit && (allocatedQuantity === 0 || canMove);

  return (
    <div
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      className={`group relative rounded-lg ${droppable.isOver ? "ring-2 ring-primary/60" : ""}`}
    >
          <div
            {...draggable.listeners}
            {...draggable.attributes}
            className={`${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${draggable.isDragging ? "opacity-40" : ""}`}
          >
            <ItemBlock item={item} />
          </div>
          {item.stockQuantity !== undefined && (
            <div
              className={`op-label -mt-1 flex items-center gap-1 px-1 pb-0.5 text-[9px] font-bold ${
                (stockRemaining ?? item.stockQuantity) < 0 ? "text-destructive" : "text-emerald-700"
              }`}
            >
              <Layers className="h-2.5 w-2.5 shrink-0" />
              {stockRemaining ?? item.stockQuantity} disponíveis de {item.stockQuantity}
            </div>
          )}
          {locationCodes.length > 0 && (
            <div className="op-label -mt-1 flex min-w-0 items-center gap-1 px-1 pb-0.5 text-[9px] font-semibold text-muted-foreground">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="min-w-0 truncate">{locationCodes.join(", ")}</span>
            </div>
          )}
          <div className="absolute right-1.5 top-1.5 hidden rounded-md border bg-card/95 p-0.5 shadow-[var(--shadow-soft)] group-hover:flex">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onLocate();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className="rounded p-1 hover:bg-muted"
              title="Localizar no quadro"
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <>
              {canEdit && (
                <button onClick={onEdit} className="rounded p-1 hover:bg-muted" title="Editar item">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              {canAdd && (
                <button
                  onClick={onDuplicate}
                  className="rounded p-1 hover:bg-muted"
                  title="Duplicar item"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              {canEdit && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="rounded p-1 hover:bg-destructive/10"
                      title={
                        canDelete
                          ? item.stockQuantity === undefined
                            ? "Excluir item"
                            : "Excluir lote"
                          : "É necessária permissão para mover as unidades alocadas"
                      }
                      disabled={!canDelete}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[calc(100%-2rem)]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {item.stockQuantity === undefined ? "Excluir item?" : "Excluir lote?"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {item.stockQuantity === undefined
                          ? `"${item.name}" será removido da biblioteca e de todos os locais em que está alocado.`
                          : `"${item.name}" possui ${item.stockQuantity} unidades no total, ${allocatedQuantity} alocadas e será removido de ${locationCodes.length} local(is): ${locationCodes.join(", ") || "nenhum"}.`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={onDelete}
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          </div>
    </div>
  );
}

function CategorySection({
  category,
  items,
  itemLocationCodes,
  itemAllocatedStock,
  itemStockRemaining,
  canAdd,
  canEdit,
  canMove,
  onAddItem,
  onBulkAddItem,
  onEditItem,
  onDuplicateItem,
  onDeleteItem,
  onLocateItem,
  onEditCategory,
  onDeleteCategory,
}: {
  category: ItemCategory;
  items: BoardItem[];
  itemLocationCodes: Record<string, string[]>;
  itemAllocatedStock: Record<string, number>;
  itemStockRemaining: Record<string, number>;
  canAdd: boolean;
  canEdit: boolean;
  canMove: boolean;
  onAddItem: (categoryId?: string) => void;
  onBulkAddItem: (categoryId: string) => void;
  onEditItem: (item: BoardItem) => void;
  onDuplicateItem: (item: BoardItem) => void;
  onDeleteItem: (item: BoardItem) => void;
  onLocateItem: (item: BoardItem) => void;
  onEditCategory: () => void;
  onDeleteCategory: () => void;
}) {
  const [expanded, setExpanded] = useState(items.length <= 3);
  const { isOver, setNodeRef } = useDroppable({
    id: `library-category:${category.id}`,
    data: { source: "library-category", categoryId: category.id },
    disabled: !canEdit,
  });

  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg border bg-card transition ${isOver ? "border-primary bg-primary/5" : ""}`}
    >
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 ${expanded ? "border-b" : ""}`}
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left hover:text-foreground"
          aria-expanded={expanded}
          title={expanded ? "Recolher itens" : "Mostrar itens"}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: category.color }}
          />
          <span className="op-label truncate text-[10px] font-semibold text-muted-foreground">
            {category.name}
          </span>
          <span className="op-label rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            {items.length}
          </span>
          {!expanded && items.length > 0 && (
            <span className="truncate text-[10px] text-muted-foreground/70">
              {items
                .slice(0, 3)
                .map((item) => item.name)
                .join(", ")}
              {items.length > 3 ? ` +${items.length - 3}` : ""}
            </span>
          )}
          <ChevronDown
            className={`ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          {canAdd && (
            <button
              onClick={() => onAddItem(category.id)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Novo item"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {canAdd && (
            <button
              onClick={() => onBulkAddItem(category.id)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Adicionar itens em lote"
            >
              <ListPlus className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && (
            <>
              <button
                onClick={onEditCategory}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Editar categoria"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Excluir categoria"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[calc(100%-2rem)]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Os itens de "{category.name}" continuarao cadastrados em "Sem categoria".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={onDeleteCategory}
                    >
                      Excluir categoria
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <div className="space-y-2 p-3">
          {items.map((item) => (
            <LibraryItem
              key={item.id}
              item={item}
              categoryId={category.id}
              canDrag={canEdit || canMove}
              canAdd={canAdd}
              canEdit={canEdit}
              canMove={canMove}
              locationCodes={itemLocationCodes[item.id] ?? []}
              allocatedQuantity={itemAllocatedStock[item.id] ?? 0}
              stockRemaining={itemStockRemaining[item.id]}
              onEdit={() => onEditItem(item)}
              onDuplicate={() => onDuplicateItem(item)}
              onDelete={() => onDeleteItem(item)}
              onLocate={() => onLocateItem(item)}
            />
          ))}
          {items.length === 0 && (
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => onAddItem(category.id)}
              className="op-label w-full rounded-md border border-dashed px-3 py-3 text-[10px] text-muted-foreground disabled:cursor-default"
            >
              {canAdd ? "Adicionar item" : canEdit ? "Solte um item aqui" : "Sem itens"}
            </button>
          )}
          {canAdd && (
            <button
              type="button"
              onClick={() => onBulkAddItem(category.id)}
              className="op-label flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-3 text-[10px] text-muted-foreground hover:bg-muted"
            >
              <ListPlus className="h-3.5 w-3.5" />
              Criar itens em lote
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function GroupSection({
  group,
  categories,
  items,
  itemLocationCodes,
  itemAllocatedStock,
  itemStockRemaining,
  canAdd,
  canEdit,
  canMove,
  onAddItem,
  onBulkAddItem,
  onEditItem,
  onDuplicateItem,
  onDeleteItem,
  onLocateItem,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}: {
  group: ItemCategory;
  categories: ItemCategory[];
  items: BoardItem[];
  itemLocationCodes: Record<string, string[]>;
  itemAllocatedStock: Record<string, number>;
  itemStockRemaining: Record<string, number>;
  canAdd: boolean;
  canEdit: boolean;
  canMove: boolean;
  onAddItem: (categoryId?: string) => void;
  onBulkAddItem: (categoryId: string) => void;
  onEditItem: (item: BoardItem) => void;
  onDuplicateItem: (item: BoardItem) => void;
  onDeleteItem: (item: BoardItem) => void;
  onLocateItem: (item: BoardItem) => void;
  onAddCategory: () => void;
  onEditCategory: (category: ItemCategory) => void;
  onDeleteCategory: (categoryId: string) => void;
}) {
  const count = categories.reduce(
    (total, category) => total + items.filter((item) => item.categoryId === category.id).length,
    0,
  );

  return (
    <section className="rounded-lg border bg-card shadow-[var(--shadow-soft)]">
      <header className="flex items-center justify-between gap-2 border-b px-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ background: group.color }}
          >
            {group.iconUrl ? (
              <img
                src={group.iconUrl}
                alt=""
                className="h-full w-full object-contain p-1"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              />
            ) : (
              <Layers className="h-4 w-4 text-white" />
            )}
          </div>
          <div>
            <h3 className="op-title truncate text-lg leading-none">{group.name}</h3>
            <p className="op-label text-[10px] text-muted-foreground">{count} itens</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canAdd && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onAddCategory}>
              <Plus className="h-3 w-3" /> Categoria
            </Button>
          )}
          {canEdit && (
            <>
              <button
                onClick={() => onEditCategory(group)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                title="Editar grupo"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDeleteCategory(group.id)}
                className="rounded p-1 text-destructive hover:bg-destructive/10"
                title="Excluir grupo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </header>
      <div className="space-y-3 p-3">
        {categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            items={items.filter((item) => item.categoryId === category.id).sort(compareByName)}
            itemLocationCodes={itemLocationCodes}
            itemAllocatedStock={itemAllocatedStock}
            itemStockRemaining={itemStockRemaining}
            canAdd={canAdd}
            canEdit={canEdit}
            canMove={canMove}
            onAddItem={onAddItem}
            onBulkAddItem={onBulkAddItem}
            onEditItem={onEditItem}
            onDuplicateItem={onDuplicateItem}
            onDeleteItem={onDeleteItem}
            onLocateItem={onLocateItem}
            onEditCategory={() => onEditCategory(category)}
            onDeleteCategory={() => onDeleteCategory(category.id)}
          />
        ))}
        {categories.length === 0 && (
          <p className="op-label rounded-md border border-dashed p-3 text-center text-[10px] text-muted-foreground">
            Crie uma categoria para cadastrar itens neste grupo.
          </p>
        )}
      </div>
    </section>
  );
}

function CategoryDialog({
  open,
  category,
  creatingGroup,
  groups,
  initialGroupId,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  category: ItemCategory | null;
  creatingGroup: boolean;
  groups: ItemCategory[];
  initialGroupId?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, color: string, iconUrl?: string, groupId?: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [groupId, setGroupId] = useState("");
  const group = category?.isGroup ?? creatingGroup;
  const label = group ? "grupo" : "categoria";

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setColor(category?.color ?? CATEGORY_COLORS[0]);
    setIconUrl(category?.iconUrl);
    setGroupId(category?.groupId ?? initialGroupId ?? "");
  }, [open, category, initialGroupId]);

  function save() {
    if (!name.trim()) return;
    onSave(name.trim(), color, iconUrl, group ? undefined : groupId || undefined);
    onOpenChange(false);
  }

  async function attachIcon(file?: File) {
    if (!file) return;
    setUploadingIcon(true);
    try {
      const { url } = await uploadAssetFile(file, "icons");
      setIconUrl(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao anexar ícone");
    } finally {
      setUploadingIcon(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <DialogHeader className="border-b bg-secondary/40 px-6 py-5">
          <DialogTitle className="op-title text-xl leading-none">
            {category ? `Editar ${label}` : `Novo ${label}`}
          </DialogTitle>
          <p className="op-label mt-1 text-[10px] text-muted-foreground">
            Organize itens na biblioteca tecnica.
          </p>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="category-name">Nome</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && save()}
              autoFocus
            />
          </div>
          {!group && (
            <div className="space-y-2">
              <Label htmlFor="category-group">Grupo</Label>
              <select
                id="category-group"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Sem grupo</option>
                {groups.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Vincule esta categoria a um grupo existente ou mantenha-a independente.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Icone (opcional)</Label>
            <div className="flex items-center gap-3">
              {iconUrl && (
                <div
                  className="relative h-12 w-12 overflow-hidden rounded-lg border"
                  style={{ background: color }}
                >
                  <img
                    src={iconUrl}
                    alt=""
                    className="h-full w-full object-contain p-1"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  />
                  <button
                    type="button"
                    onClick={() => setIconUrl(undefined)}
                    className="absolute right-0.5 top-0.5 rounded bg-black/40 p-0.5 text-white"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <ImageUp className="h-4 w-4" /> {uploadingIcon ? "Enviando…" : "Anexar imagem"}
                <Input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  disabled={uploadingIcon}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void attachIcon(file);
                  }}
                />
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="grid grid-cols-6 gap-2">
              {CATEGORY_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="flex aspect-square items-center justify-center rounded-md border"
                  style={{ background: option }}
                  onClick={() => setColor(option)}
                >
                  {option === color && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t bg-card px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Salvar {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkAddDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (baseName: string, quantity: number) => void;
}) {
  const [baseName, setBaseName] = useState("");
  const [quantity, setQuantity] = useState("200");

  useEffect(() => {
    if (!open) return;
    setBaseName("");
    setQuantity("200");
  }, [open]);

  const parsedQuantity = Math.max(0, Math.min(100000, Number.parseInt(quantity, 10) || 0));
  const canSave = baseName.trim().length > 0 && parsedQuantity > 0;

  function save() {
    if (!canSave) return;
    onSave(baseName.trim(), parsedQuantity);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <DialogHeader className="border-b bg-secondary/40 px-6 py-5">
          <DialogTitle className="op-title text-xl leading-none">Criar itens em lote</DialogTitle>
          <p className="op-label mt-1 text-[10px] text-muted-foreground">
            Cria um card com quantidade total em estoque. Ao alocar em uma obra, informe
            quantos foram enviados — o restante continua disponível aqui automaticamente.
          </p>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="bulk-base-name">Nome</Label>
            <Input
              id="bulk-base-name"
              placeholder="Ex.: Helicoide"
              value={baseName}
              onChange={(event) => setBaseName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-quantity">Quantidade total em estoque</Label>
            <Input
              id="bulk-quantity"
              type="number"
              min={1}
              max={100000}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="border-t bg-card px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!canSave}>
            <ListPlus className="h-4 w-4" /> Criar item ({parsedQuantity || 0})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PaletteSidebar({
  categories,
  items,
  instances,
  rows,
  onAddItem,
  onBulkAddItems,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onEditItem,
  onDuplicateItem,
  onDeleteItem,
  onLocateItem,
  onOpenCollaborators,
  canAdd,
  canEdit,
  canMove,
  isDragging = false,
}: {
  categories: ItemCategory[];
  items: BoardItem[];
  instances: PlacedInstance[];
  rows: BoardRow[];
  onAddItem: (categoryId?: string) => void;
  onBulkAddItems: (categoryId: string, baseName: string, quantity: number) => void;
  onAddCategory: (
    name: string,
    color: string,
    isGroup?: boolean,
    iconUrl?: string,
    groupId?: string,
  ) => void;
  onUpdateCategory: (
    categoryId: string,
    name: string,
    color: string,
    iconUrl?: string,
    groupId?: string,
  ) => void;
  onDeleteCategory: (categoryId: string) => void;
  onEditItem: (item: BoardItem) => void;
  onDuplicateItem: (item: BoardItem) => void;
  onDeleteItem: (item: BoardItem) => void;
  onLocateItem: (item: BoardItem) => void;
  onOpenCollaborators?: () => void;
  canAdd: boolean;
  canEdit: boolean;
  canMove: boolean;
  isDragging?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ItemCategory | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | undefined>();
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAddCategoryId, setBulkAddCategoryId] = useState<string | null>(null);
  const open = expanded || isDragging;
  const sortedCategories = [...categories].sort(compareByName);
  const groups = sortedCategories.filter((category) => category.isGroup);
  const standalone = sortedCategories.filter(
    (category) => !category.isGroup && !category.groupId,
  );
  const rowsById = Object.fromEntries(rows.map((row) => [row.id, row]));
  const locationCodeSets: Record<string, Set<string>> = {};
  for (const instance of instances) {
    const rowName = rowsById[instance.rowId]?.name;
    if (!rowName) continue;
    (locationCodeSets[instance.itemId] ??= new Set()).add(extractWorkCode(rowName));
  }
  const itemLocationCodes = Object.fromEntries(
    Object.entries(locationCodeSets).map(([itemId, codes]) => [
      itemId,
      [...codes].sort(naturalCompare),
    ]),
  );
  const itemAllocatedStock: Record<string, number> = {};
  const itemStockRemaining: Record<string, number> = {};
  for (const item of items) {
    const allocated = getAllocatedStock(item.id, instances);
    itemAllocatedStock[item.id] = allocated;
    const remaining = getRemainingStock(item, instances);
    if (remaining !== undefined) itemStockRemaining[item.id] = remaining;
  }

  function openBulkAddDialog(categoryId: string) {
    setBulkAddCategoryId(categoryId);
    setBulkAddOpen(true);
  }

  function openCategoryDialog(category: ItemCategory | null, isGroup = false, groupId?: string) {
    setExpanded(true);
    setEditingCategory(category);
    setCreatingGroup(isGroup);
    setPendingGroupId(groupId);
    setCategoryOpen(true);
  }

  return (
    <TooltipProvider delayDuration={180}>
      <CategoryDialog
        open={categoryOpen}
        category={editingCategory}
        creatingGroup={creatingGroup}
        groups={groups}
        initialGroupId={pendingGroupId}
        onOpenChange={(nextOpen) => {
          setCategoryOpen(nextOpen);
          if (!nextOpen) setEditingCategory(null);
        }}
        onSave={(name, color, iconUrl, groupId) => {
          if (editingCategory) onUpdateCategory(editingCategory.id, name, color, iconUrl, groupId);
          else onAddCategory(name, color, creatingGroup, iconUrl, groupId);
        }}
      />
      <BulkAddDialog
        open={bulkAddOpen}
        onOpenChange={setBulkAddOpen}
        onSave={(baseName, quantity) => {
          if (bulkAddCategoryId) onBulkAddItems(bulkAddCategoryId, baseName, quantity);
        }}
      />
      <aside
        className={`relative z-30 flex h-full shrink-0 border-r bg-card transition-[width] duration-200 ${open ? "w-[min(460px,calc(100vw-1rem))]" : "w-11"}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => !isDragging && setExpanded(false)}
      >
        <div className="flex h-full w-11 shrink-0 flex-col items-center gap-2 px-1.5 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setExpanded((value) => !value)}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
              >
                <BookOpen className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Biblioteca tecnica</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setExpanded(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
              >
                <Package className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Itens</TooltipContent>
          </Tooltip>
          {canAdd && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => openCategoryDialog(null)}
                  className="mt-auto flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                >
                  <Tag className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Nova categoria</TooltipContent>
            </Tooltip>
          )}
          {canAdd && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => openCategoryDialog(null, true)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                >
                  <Layers className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Novo grupo</TooltipContent>
            </Tooltip>
          )}
          {onOpenCollaborators && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenCollaborators}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                >
                  <Users className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Colaboradores</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div
          className={`flex min-w-0 flex-1 flex-col border-l bg-secondary/70 transition-all duration-200 ${open ? "opacity-100" : "pointer-events-none w-0 overflow-hidden opacity-0"}`}
        >
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="op-title text-xl leading-none">Biblioteca tecnica</h2>
                <p className="op-label text-[10px] text-muted-foreground">
                  Grupos, categorias e itens
                </p>
              </div>
              {canAdd && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => openCategoryDialog(null)}>
                    <Tag className="h-4 w-4" /> Categoria
                  </Button>
                  <Button size="sm" onClick={() => openCategoryDialog(null, true)}>
                    <Layers className="h-4 w-4" /> Grupo
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {groups.map((group) => (
              <GroupSection
                key={group.id}
                group={group}
                categories={sortedCategories.filter(
                  (category) => category.groupId === group.id,
                )}
                items={items}
                itemLocationCodes={itemLocationCodes}
                itemAllocatedStock={itemAllocatedStock}
                itemStockRemaining={itemStockRemaining}
                canAdd={canAdd}
                canEdit={canEdit}
                canMove={canMove}
                onAddItem={onAddItem}
                onBulkAddItem={openBulkAddDialog}
                onEditItem={onEditItem}
                onDuplicateItem={onDuplicateItem}
                onDeleteItem={onDeleteItem}
                onLocateItem={onLocateItem}
                onAddCategory={() => openCategoryDialog(null, false, group.id)}
                onEditCategory={(category) => openCategoryDialog(category)}
                onDeleteCategory={onDeleteCategory}
              />
            ))}
            {standalone.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                items={items.filter((item) => item.categoryId === category.id).sort(compareByName)}
                itemLocationCodes={itemLocationCodes}
                itemAllocatedStock={itemAllocatedStock}
                itemStockRemaining={itemStockRemaining}
                canAdd={canAdd}
                canEdit={canEdit}
                canMove={canMove}
                onAddItem={onAddItem}
                onBulkAddItem={openBulkAddDialog}
                onEditItem={onEditItem}
                onDuplicateItem={onDuplicateItem}
                onDeleteItem={onDeleteItem}
                onLocateItem={onLocateItem}
                onEditCategory={() => openCategoryDialog(category)}
                onDeleteCategory={() => onDeleteCategory(category.id)}
              />
            ))}
            {categories.length === 0 && (
              <div className="rounded-lg border border-dashed bg-card p-5 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
                {canAdd && (
                  <Button className="mt-3" size="sm" onClick={() => openCategoryDialog(null)}>
                    <Plus className="h-4 w-4" /> Criar categoria
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

