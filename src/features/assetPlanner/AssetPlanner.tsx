import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type CollisionDetection,
  closestCorners,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { AlertTriangle, CalendarClock, CheckCircle2, FileImage, FileText, LayoutGrid, Loader2, MapPin, Package, Plus, Save, Search, Users } from "lucide-react";
import { PaletteSidebar } from "./components/Sidebar";
import { PatrimonioView } from "./components/PatrimonioView";
import { MapView } from "./components/MapView";
import { VencimentosView } from "./components/VencimentosView";
import { RowDetailModal } from "./components/RowDetailModal";
import { AuditLogView } from "./components/AuditLogView";
import { logAction } from "./lib/audit-log";
import { BoardRowView, type BoardDensity } from "./components/BoardRow";
import { BulkMoveBar } from "./components/BulkMoveBar";
import { ItemBlock } from "./components/ItemBlock";
import { ItemEditor } from "./components/ItemEditor";
import { RowEditor } from "./components/RowEditor";
import { StockAllocationDialog } from "./components/StockAllocationDialog";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { toast } from "sonner";
import { Toaster } from "./ui/sonner";
import { getPlannerLayout, savePlannerLayout, type PlannerCapability } from "./lib/planner-layout.functions";
import {
  getCollaborators,
  upsertCollaborator,
  deleteCollaborator,
} from "./lib/collaborators.functions";
import { CollaboratorsPanel } from "./components/CollaboratorsPanel";
import type {
  BoardItem,
  BoardItemStatus,
  BoardRow,
  ItemCategory,
  PlacedInstance,
  TeamMember,
  MemberCapability,
} from "./lib/board-types";
import { memberCan } from "./lib/board-types";
import { getRowColor } from "./lib/row-color";
import { initialCategories, initialInstances, initialItems, initialRows, initialTeamMembers } from "./lib/board-data";
import "./assetPlanner.css";
import { exportNodeToPng, exportNodeToPdf } from "./lib/export-board";
import {
  allocateStockToRow,
  getAllocatedStock,
  getMaxStockQuantity,
  getRemainingStock,
  isValidStockQuantity,
  moveStockPlacement,
  removeItemPlacements,
} from "./lib/planner-helpers";

const newId = () => Math.random().toString(36).slice(2, 10);

const EMPTY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`;

const plannerCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  const intersecting = rectIntersection(args);
  if (intersecting.length > 0) return intersecting;

  return closestCorners(args);
};

type RowStatusFilter = "in_progress" | "yards" | BoardRow["status"] | "all";

const ROW_STATUS_FILTERS: Array<{ value: RowStatusFilter; label: string; emptyLabel: string }> = [
  { value: "in_progress", label: "Em andamento", emptyLabel: "Nenhuma obra em andamento." },
  { value: "active", label: "Em operação", emptyLabel: "Nenhuma obra em operação." },
  { value: "planning", label: "Planejamento", emptyLabel: "Nenhuma obra em planejamento." },
  { value: "waiting", label: "Aguardando", emptyLabel: "Nenhuma obra aguardando." },
  { value: "done", label: "Concluídas", emptyLabel: "Nenhuma obra concluída." },
  { value: "yards", label: "Pátios", emptyLabel: "Nenhum pátio cadastrado." },
  { value: "all", label: "Todos", emptyLabel: "Nenhum local cadastrado." },
];

const getLocationType = (row: BoardRow) => row.locationType ?? "worksite";

type PlannerDragData =
  | { source: "library-item"; itemId: string; categoryId: string }
  | { source: "library-category"; categoryId: string }
  | { source: "library-position"; itemId: string; categoryId: string }
  | { source: "placed"; instanceId: string; rowId: string }
  | { source: "row"; rowId: string };

type PendingStockAllocation = {
  itemId: string;
  rowId: string;
  targetIndex: number;
};

function getPlannerDragData(value: unknown): PlannerDragData | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Record<string, unknown>;
  if (
    data.source === "library-item" &&
    typeof data.itemId === "string" &&
    typeof data.categoryId === "string"
  ) {
    return { source: "library-item", itemId: data.itemId, categoryId: data.categoryId };
  }
  if (data.source === "library-category" && typeof data.categoryId === "string") {
    return { source: "library-category", categoryId: data.categoryId };
  }
  if (
    data.source === "library-position" &&
    typeof data.itemId === "string" &&
    typeof data.categoryId === "string"
  ) {
    return { source: "library-position", itemId: data.itemId, categoryId: data.categoryId };
  }
  if (
    data.source === "placed" &&
    typeof data.instanceId === "string" &&
    typeof data.rowId === "string"
  ) {
    return { source: "placed", instanceId: data.instanceId, rowId: data.rowId };
  }
  if (data.source === "row" && typeof data.rowId === "string") {
    return { source: "row", rowId: data.rowId };
  }
  return null;
}

const DENSITY_META: Record<BoardDensity, { label: string; icon: ReactNode }> = {
  comfortable: {
    label: "Confortável",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0.5" width="13" height="3" rx="0.5" />
        <rect x="0" y="5.5" width="13" height="3" rx="0.5" />
        <rect x="0" y="10.5" width="13" height="2" rx="0.5" opacity="0.35" />
      </svg>
    ),
  },
  compact: {
    label: "Compacto",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="13" height="2.5" rx="0.5" />
        <rect x="0" y="3.7" width="13" height="2.5" rx="0.5" />
        <rect x="0" y="7.4" width="13" height="2.5" rx="0.5" />
        <rect x="0" y="10.5" width="13" height="2" rx="0.5" opacity="0.35" />
      </svg>
    ),
  },
  dense: {
    label: "Denso",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="13" height="2" rx="0.5" />
        <rect x="0" y="2.8" width="13" height="2" rx="0.5" />
        <rect x="0" y="5.6" width="13" height="2" rx="0.5" />
        <rect x="0" y="8.4" width="13" height="2" rx="0.5" />
        <rect x="0" y="11.2" width="13" height="1.8" rx="0.5" />
      </svg>
    ),
  },
  mini: {
    label: "Mini",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="3.5" height="3.5" rx="0.6" />
        <rect x="4.75" y="0" width="3.5" height="3.5" rx="0.6" />
        <rect x="9.5" y="0" width="3.5" height="3.5" rx="0.6" />
        <rect x="0" y="4.75" width="3.5" height="3.5" rx="0.6" />
        <rect x="4.75" y="4.75" width="3.5" height="3.5" rx="0.6" />
        <rect x="9.5" y="4.75" width="3.5" height="3.5" rx="0.6" />
        <rect x="0" y="9.5" width="3.5" height="3.5" rx="0.6" />
        <rect x="4.75" y="9.5" width="3.5" height="3.5" rx="0.6" />
        <rect x="9.5" y="9.5" width="3.5" height="3.5" rx="0.6" />
      </svg>
    ),
  },
  map: {
    label: "Mapa",
    icon: (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="5" height="13" rx="0.5" />
        <rect x="7" y="0" width="6" height="3.5" rx="0.5" />
        <rect x="7" y="4.75" width="6" height="3.5" rx="0.5" />
        <rect x="7" y="9.5" width="6" height="3.5" rx="0.5" />
      </svg>
    ),
  },
};

type AssetPlannerProps = {
  dedicated?: boolean;
};

export function AssetPlanner({ dedicated = false }: AssetPlannerProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ItemCategory[]>(initialCategories);
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [rows, setRows] = useState<BoardRow[]>(initialRows);
  const [instances, setInstances] = useState<PlacedInstance[]>(initialInstances);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers);
  const [collaboratorsPanelOpen, setCollaboratorsPanelOpen] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null);
  const [overRowId, setOverRowId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BoardItem | null>(null);
  const [rowEditorOpen, setRowEditorOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BoardRow | null>(null);
  const [detailRow, setDetailRow] = useState<BoardRow | null>(null);
  const [boardDensity, setBoardDensity] = useState<BoardDensity>("comfortable");
  const [rowStatusFilters, setRowStatusFilters] = useState<RowStatusFilter[]>(["in_progress"]);
  const [rowSearchQuery, setRowSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "board" | "mapa" | "patrimonio" | "vencimentos" | "historico"
  >("board");
  const currentMember = useMemo<TeamMember>(
    () => ({
      id: user?.id ?? "local-user",
      userId: user?.id,
      name: user?.name ?? "Usuário Geoteste",
      email: user?.email,
      role: user?.role === "admin" ? "Administrador" : "Usuário",
      color: "oklch(0.55 0.14 165)",
      isAdmin: user?.role === "admin",
      canAdd: true,
      canEdit: user?.role === "admin",
      canMove: true,
      canManageCollaborators: user?.role === "admin",
      active: true,
    }),
    [user],
  );
  const didMountRef = useRef(false);
  const pendingSaveCapabilityRef = useRef<PlannerCapability | null>(null);
  const boardExportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);
  const [bulkSelectRowId, setBulkSelectRowId] = useState<string | null>(null);
  const [bulkSelectedInstanceIds, setBulkSelectedInstanceIds] = useState<Set<string>>(new Set());
  const [highlightInstanceId, setHighlightInstanceId] = useState<string | null>(null);
  const [duplicatedItem, setDuplicatedItem] = useState<BoardItem | null>(null);
  const [duplicatePlacementWarning, setDuplicatePlacementWarning] = useState<{
    itemName: string;
    otherRows: string;
    oldInstanceIds: string[];
  } | null>(null);
  const [pendingStockAllocation, setPendingStockAllocation] =
    useState<PendingStockAllocation | null>(null);
  useEffect(() => {
    if (!highlightInstanceId || activeTab !== "board") return;
    const node = document.getElementById(`instance-${highlightInstanceId}`);
    node?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const timer = setTimeout(() => setHighlightInstanceId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightInstanceId, activeTab]);

  async function exportBoard(format: "png" | "pdf") {
    if (!boardExportRef.current || exporting) return;
    setExporting(format);
    try {
      const run = format === "png" ? exportNodeToPng : exportNodeToPdf;
      await run(boardExportRef.current, "quadro-geral");
      toast.success(`Quadro exportado em ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar o quadro");
    } finally {
      setExporting(null);
    }
  }
  const actor = currentMember?.name ?? null;

  function log(action: string, entityType: string, entityName?: string, detail?: string) {
    if (!actor) return;
    logAction(action, entityType, entityName, detail, actor).catch(() => {});
  }

  function can(capability: MemberCapability) {
    return memberCan(currentMember, capability);
  }

  function locateItemOnBoard(item: BoardItem) {
    const placed = instances.find((inst) => inst.itemId === item.id);
    if (!placed) {
      toast.info(`"${item.name}" ainda nao esta alocado em nenhum local.`);
      return;
    }
    setActiveTab("board");
    setRowStatusFilters(["all"]);
    setRowSearchQuery("");
    setHighlightInstanceId(placed.instanceId);
  }

  function requireCapability(capability: MemberCapability, action: string) {
    if (can(capability)) return true;
    toast.error(`Voce nao tem permissao para ${action}.`);
    return false;
  }

  function markLayoutChange(capability: PlannerCapability) {
    const rank: Record<PlannerCapability, number> = { add: 0, move: 1, edit: 2 };
    const current = pendingSaveCapabilityRef.current;
    if (!current || rank[capability] > rank[current]) {
      pendingSaveCapabilityRef.current = capability;
    }
  }

  const itemsById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const instanceQuantityLimits = useMemo(
    () =>
      Object.fromEntries(
        instances.map((instance) => {
          const item = itemsById[instance.itemId];
          return [
            instance.instanceId,
            item ? getMaxStockQuantity(item, instances, instance.instanceId) : undefined,
          ];
        }),
      ) as Record<string, number | undefined>,
    [instances, itemsById],
  );
  const pendingStockItem = pendingStockAllocation
    ? itemsById[pendingStockAllocation.itemId] ?? null
    : null;
  const pendingStockRow = pendingStockAllocation
    ? rows.find((row) => row.id === pendingStockAllocation.rowId) ?? null
    : null;
  const pendingStockRemaining = pendingStockItem
    ? (getRemainingStock(pendingStockItem, instances) ?? 0)
    : 0;
  const activeTeamMembers = useMemo(
    () => teamMembers.filter((member) => member.active !== false),
    [teamMembers],
  );
  const instancesByRow = useMemo(() => {
    const map: Record<string, PlacedInstance[]> = {};
    rows.forEach((r) => (map[r.id] = []));
    rows.forEach((r) =>
      r.itemIds.forEach((iid) => {
        const inst = instances.find((x) => x.instanceId === iid);
        if (inst) map[r.id].push(inst);
      }),
    );
    return map;
  }, [rows, instances]);
  const rowStatusCounts = useMemo<Record<RowStatusFilter, number>>(() => {
    const counts = {
      planning: 0,
      active: 0,
      waiting: 0,
      done: 0,
    };
    let yards = 0;

    rows.forEach((row) => {
      if (getLocationType(row) === "yard") {
        yards++;
      } else {
        counts[row.status]++;
      }
    });

    return {
      ...counts,
      in_progress: counts.planning + counts.active + counts.waiting + yards,
      yards,
      all: rows.length,
    };
  }, [rows]);
  function toggleStatusFilter(value: RowStatusFilter) {
    if (value === "all" || value === "in_progress") {
      setRowStatusFilters([value]);
      return;
    }
    setRowStatusFilters((prev) => {
      if (prev.includes("all") || prev.includes("in_progress")) return [value];
      if (prev.includes(value)) {
        const next = prev.filter((v) => v !== value);
        return next.length === 0 ? ["all"] : next;
      }
      return [...prev, value];
    });
  }

  const filteredRows = useMemo(() => {
    let result: typeof rows;
    if (rowStatusFilters.includes("all")) {
      result = rows;
    } else if (rowStatusFilters.includes("in_progress")) {
      result = rows.filter((row) => getLocationType(row) === "yard" || row.status !== "done");
    } else {
      result = rows.filter((row) => {
        if (rowStatusFilters.includes("yards") && getLocationType(row) === "yard") return true;
        const statusFilters = rowStatusFilters.filter((f) => f !== "yards") as BoardRow["status"][];
        return getLocationType(row) === "worksite" && statusFilters.includes(row.status);
      });
    }
    const sorted = [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" }));
    if (!rowSearchQuery.trim()) return sorted;
    const q = rowSearchQuery.trim().toLocaleLowerCase();
    return sorted.filter((row) =>
      row.name.toLocaleLowerCase().includes(q) || row.description.toLocaleLowerCase().includes(q),
    );
  }, [rows, rowStatusFilters, rowSearchQuery]);
  const emptyRowsLabel =
    rowStatusFilters.length === 1
      ? (ROW_STATUS_FILTERS.find((f) => f.value === rowStatusFilters[0])?.emptyLabel ?? "Nenhuma obra encontrada.")
      : "Nenhuma obra encontrada.";

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    let active = true;
    Promise.all([getCollaborators(), getPlannerLayout()])
      .then(([collaborators, layout]) => {
        if (!active) return;
        setTeamMembers(collaborators);
        setCategories(layout.categories);
        setItems(layout.items);
        setRows(layout.rows);
        setInstances(layout.instances);
      })
      .catch((error) => {
        console.error(error);
        if (active) toast.error("Nao foi possivel carregar o planejamento");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const capability = pendingSaveCapabilityRef.current;
    if (!capability || !currentMember) return;
    pendingSaveCapabilityRef.current = null;
    const timeout = window.setTimeout(async () => {
      try {
        await savePlannerLayout({ categories, items, rows, instances }, capability);
      } catch (error) {
        console.error(error);
        toast.error("Nao foi possivel salvar automaticamente");
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [categories, items, rows, instances, currentMember]);

  function findRowOfInstance(instanceId: string) {
    return rows.find((r) => r.itemIds.includes(instanceId));
  }

  function applyLocationStatus(itemId: string, destination: BoardRow, movedInstanceId?: string) {
    const hasOtherWorksitePlacement = instances.some((instance) => {
      if (instance.itemId !== itemId || instance.instanceId === movedInstanceId) return false;
      const row = rows.find((candidate) => candidate.id === instance.rowId);
      return row ? getLocationType(row) === "worksite" : false;
    });
    const status =
      getLocationType(destination) === "worksite" || hasOtherWorksitePlacement
        ? "on_site"
        : "available";
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId || item.status === "maintenance" || item.stockQuantity !== undefined)
          return item;
        const imageUrl = item.statusImageUrls?.[status] ?? item.imageUrl;
        return { ...item, status, imageUrl };
      }),
    );
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    const data = getPlannerDragData(e.active.data.current);
    if (data?.source === "library-item") {
      setActiveItem(itemsById[data.itemId] ?? null);
    } else if (data?.source === "placed") {
      const inst = instances.find((i) => i.instanceId === data.instanceId);
      if (inst) setActiveItem(itemsById[inst.itemId] ?? null);
    }
  }

  function handleDragOver(e: DragOverEvent) {
    const overData = getPlannerDragData(e.over?.data.current);
    if (!overData) {
      setOverRowId(null);
      return;
    }
    if (overData.source === "row") setOverRowId(overData.rowId);
    else if (overData.source === "placed") setOverRowId(overData.rowId);
    else setOverRowId(null);
  }

  function confirmStockAllocation(quantity: number) {
    if (!pendingStockAllocation) return;
    const item = items.find(
      (candidate) => candidate.id === pendingStockAllocation.itemId,
    );
    const row = rows.find((candidate) => candidate.id === pendingStockAllocation.rowId);
    if (!item || !row) {
      setPendingStockAllocation(null);
      toast.error("Não foi possível concluir a alocação.");
      return;
    }

    const remaining = getRemainingStock(item, instances) ?? 0;
    if (!isValidStockQuantity(quantity, remaining)) {
      toast.error(`Informe uma quantidade entre 1 e ${remaining}.`);
      return;
    }

    try {
      const result = allocateStockToRow({
        item,
        rowId: row.id,
        targetIndex: pendingStockAllocation.targetIndex,
        quantity,
        newInstanceId: newId(),
        rows,
        instances,
      });
      setRows(result.rows);
      setInstances(result.instances);
      markLayoutChange("move");
      setPendingStockAllocation(null);
      toast.success(
        result.merged
          ? `${quantity} unidade(s) somadas ao lote em "${row.name}"`
          : `${quantity} unidade(s) alocadas em "${row.name}"`,
      );
      log(
        result.merged ? "aglutinou_item_lote" : "alocou_item_lote",
        "item",
        item.name,
        `${quantity} unidade(s) em ${row.name}; saldo ${remaining - quantity}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao alocar o lote.");
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    setActiveItem(null);
    setOverRowId(null);
    if (!over) return;

    const activeData = getPlannerDragData(active.data.current);
    const overData = getPlannerDragData(over.data.current);
    if (!activeData || !overData) return;

    if (
      activeData.source === "library-item" &&
      (overData.source === "library-category" || overData.source === "library-position")
    ) {
      if (!requireCapability("edit", "organizar itens na biblioteca")) return;
      const movedItem = items.find((item) => item.id === activeData.itemId);
      if (!movedItem) return;
      const targetCategoryId = overData.categoryId;
      if (targetCategoryId === movedItem.categoryId) return;
      const previousCategory =
        categories.find((category) => category.id === movedItem.categoryId)?.name ??
        "Sem categoria";
      const nextCategory =
        categories.find((category) => category.id === targetCategoryId)?.name ?? "Sem categoria";

      setItems((previous) =>
        previous.map((item) =>
          item.id === movedItem.id ? { ...item, categoryId: targetCategoryId } : item,
        ),
      );
      markLayoutChange("edit");
      log(
        "reclassificou_item",
        "item",
        movedItem.name,
        `de ${previousCategory} para ${nextCategory}`,
      );
      toast.success("Item movido para outra categoria");
      return;
    }

    if (!requireCapability("move", "mover itens")) return;

    // Determine target row + index
    let targetRowId: string | null = null;
    let targetIndex: number | null = null;
    if (overData.source === "row") {
      targetRowId = overData.rowId;
      const r = rows.find((x) => x.id === targetRowId);
      targetIndex = r ? r.itemIds.length : 0;
    } else if (overData.source === "placed") {
      targetRowId = overData.rowId;
      const r = rows.find((x) => x.id === targetRowId);
      targetIndex = r ? r.itemIds.indexOf(overData.instanceId) : 0;
    }
    if (!targetRowId || targetIndex === null) return;
    const targetRow = rows.find((row) => row.id === targetRowId);
    if (!targetRow) return;

    if (activeData.source === "library-item") {
      const movedLibraryItem = items.find((i) => i.id === activeData.itemId);
      if (!movedLibraryItem) return;
      if (movedLibraryItem.stockQuantity !== undefined) {
        const remaining = getRemainingStock(movedLibraryItem, instances) ?? 0;
        if (remaining <= 0) {
          toast.error(`"${movedLibraryItem.name}" não possui saldo disponível.`);
          return;
        }
        setPendingStockAllocation({
          itemId: movedLibraryItem.id,
          rowId: targetRowId,
          targetIndex,
        });
        return;
      }

      markLayoutChange("move");
      const existingPlacements = instances.filter((inst) => inst.itemId === activeData.itemId);
      const newInst: PlacedInstance = {
        instanceId: newId(),
        itemId: activeData.itemId,
        rowId: targetRowId,
      };
      setInstances((prev) => [...prev, newInst]);
      setRows((prev) =>
        prev.map((r) =>
          r.id === targetRowId
            ? {
                ...r,
                itemIds: [
                  ...r.itemIds.slice(0, targetIndex!),
                  newInst.instanceId,
                  ...r.itemIds.slice(targetIndex!),
                ],
              }
            : r,
        ),
      );
      const paletteItemName = movedLibraryItem?.name;
      applyLocationStatus(activeData.itemId, targetRow);
      if (existingPlacements.length > 0) {
        const otherRows = existingPlacements
          .map((inst) => rows.find((r) => r.id === inst.rowId)?.name)
          .filter(Boolean)
          .join(", ");
        setDuplicatePlacementWarning({
          itemName: paletteItemName ?? "",
          otherRows,
          oldInstanceIds: existingPlacements.map((inst) => inst.instanceId),
        });
      }
      log("moveu_item", "item", paletteItemName, `alocado em ${targetRow.name}`);
    } else if (activeData.source === "placed") {
      const fromRow = findRowOfInstance(activeData.instanceId);
      if (!fromRow) return;

      // Bulk drag: if dragged item is part of selection, move all selected
      if (
        bulkSelectedInstanceIds.size > 0 &&
        bulkSelectedInstanceIds.has(activeData.instanceId) &&
        fromRow.id !== targetRowId
      ) {
        moveBulkInstances(targetRowId);
        return;
      }

      if (fromRow.id === targetRowId) {
        const oldIdx = fromRow.itemIds.indexOf(activeData.instanceId);
        if (oldIdx === targetIndex) return;
        markLayoutChange("move");
        setRows((prev) =>
          prev.map((r) =>
            r.id === fromRow.id ? { ...r, itemIds: arrayMove(r.itemIds, oldIdx, targetIndex!) } : r,
          ),
        );
      } else {
        const movedInstance = instances.find(
          (instance) => instance.instanceId === activeData.instanceId,
        );
        const movedItem = movedInstance ? itemsById[movedInstance.itemId] : undefined;
        if (movedInstance && movedItem?.stockQuantity !== undefined) {
          try {
            const result = moveStockPlacement({
              instanceId: movedInstance.instanceId,
              targetRowId,
              targetIndex,
              rows,
              instances,
            });
            setRows(result.rows);
            setInstances(result.instances);
            markLayoutChange("move");
            toast.success(
              result.merged
                ? `Lote aglutinado em "${targetRow.name}"`
                : `Lote movido para "${targetRow.name}"`,
            );
            log(
              result.merged ? "aglutinou_item_lote" : "moveu_item_lote",
              "item",
              movedItem.name,
              `${result.quantity} unidade(s) de ${fromRow.name} para ${targetRow.name}`,
            );
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao mover o lote.");
          }
          return;
        }

        markLayoutChange("move");
        setRows((prev) =>
          prev.map((r) => {
            if (r.id === fromRow.id) {
              return { ...r, itemIds: r.itemIds.filter((x) => x !== activeData.instanceId) };
            }
            if (r.id === targetRowId) {
              return {
                ...r,
                itemIds: [
                  ...r.itemIds.slice(0, targetIndex!),
                  activeData.instanceId,
                  ...r.itemIds.slice(targetIndex!),
                ],
              };
            }
            return r;
          }),
        );
        setInstances((prev) =>
          prev.map((i) =>
            i.instanceId === activeData.instanceId ? { ...i, rowId: targetRowId! } : i,
          ),
        );
        if (movedInstance) {
          applyLocationStatus(movedInstance.itemId, targetRow, movedInstance.instanceId);
          const movedItemName = items.find((i) => i.id === movedInstance.itemId)?.name;
          log("moveu_item", "item", movedItemName, `de ${fromRow.name} para ${targetRow.name}`);
        }
      }
    }
  }

  function removeInstance(instanceId: string) {
    if (!requireCapability("move", "remover itens de locais")) return;
    markLayoutChange("move");
    const removedInstance = instances.find((instance) => instance.instanceId === instanceId);
    if (removedInstance) {
      const isStillOnWorksite = instances.some((instance) => {
        if (instance.instanceId === instanceId || instance.itemId !== removedInstance.itemId) {
          return false;
        }
        const row = rows.find((candidate) => candidate.id === instance.rowId);
        return row ? getLocationType(row) === "worksite" : false;
      });
      setItems((prev) =>
        prev.map((item) => {
          if (
            item.id !== removedInstance.itemId ||
            item.status === "maintenance" ||
            item.stockQuantity !== undefined
          )
            return item;
          const status = isStillOnWorksite ? "on_site" : "available";
          const imageUrl = item.statusImageUrls?.[status] ?? item.imageUrl;
          return { ...item, status, imageUrl };
        }),
      );
    }
    setRows((prev) =>
      prev.map((r) => ({ ...r, itemIds: r.itemIds.filter((i) => i !== instanceId) })),
    );
    setInstances((prev) => prev.filter((i) => i.instanceId !== instanceId));
  }
  function moveDuplicateToHere(oldInstanceIds: string[]) {
    oldInstanceIds.forEach((instanceId) => removeInstance(instanceId));
    setDuplicatePlacementWarning(null);
    toast.success("Item movido para o novo local");
  }
  function updateInstanceQuantity(instanceId: string, quantity: number) {
    if (!requireCapability("move", "editar quantidade alocada")) return;
    const instance = instances.find((candidate) => candidate.instanceId === instanceId);
    const item = instance ? itemsById[instance.itemId] : undefined;
    if (!instance || !item || item.stockQuantity === undefined) return;
    const maximum = getMaxStockQuantity(item, instances, instanceId) ?? 0;
    if (!isValidStockQuantity(quantity, maximum)) {
      toast.error(`Informe uma quantidade inteira entre 1 e ${maximum}.`);
      return;
    }
    if ((instance.quantity ?? 1) === quantity) return;
    markLayoutChange("move");
    setInstances((prev) =>
      prev.map((candidate) =>
        candidate.instanceId === instanceId
          ? { ...candidate, quantity }
          : candidate,
      ),
    );
    const rowName = rows.find((row) => row.id === instance.rowId)?.name;
    log(
      "alterou_quantidade_lote",
      "item",
      item.name,
      `${quantity} unidade(s)${rowName ? ` em ${rowName}` : ""}`,
    );
  }
  function handleInstanceCircleClick(rowId: string, instanceId: string) {
    if (!can("move")) return;
    if (bulkSelectRowId && bulkSelectRowId !== rowId) {
      setBulkSelectRowId(rowId);
      setBulkSelectedInstanceIds(new Set([instanceId]));
      return;
    }
    if (!bulkSelectRowId) {
      setBulkSelectRowId(rowId);
      setBulkSelectedInstanceIds(new Set([instanceId]));
      return;
    }
    const next = new Set(bulkSelectedInstanceIds);
    if (next.has(instanceId)) next.delete(instanceId);
    else next.add(instanceId);
    if (next.size === 0) {
      exitBulkSelect();
    } else {
      setBulkSelectedInstanceIds(next);
    }
  }

  function exitBulkSelect() {
    setBulkSelectRowId(null);
    setBulkSelectedInstanceIds(new Set());
  }

  function toggleSelectAllInBulkRow() {
    if (!bulkSelectRowId) return;
    const rowInstances = instancesByRow[bulkSelectRowId] ?? [];
    const allSelected =
      rowInstances.length > 0 &&
      rowInstances.every((i) => bulkSelectedInstanceIds.has(i.instanceId));
    if (allSelected) {
      setBulkSelectedInstanceIds(new Set());
    } else {
      setBulkSelectedInstanceIds(new Set(rowInstances.map((i) => i.instanceId)));
    }
  }

  function moveBulkInstances(targetRowId: string) {
    if (!requireCapability("move", "mover itens")) return;
    if (!bulkSelectRowId || bulkSelectedInstanceIds.size === 0) return;
    const sourceRow = rows.find((r) => r.id === bulkSelectRowId);
    const targetRow = rows.find((r) => r.id === targetRowId);
    if (!sourceRow || !targetRow || sourceRow.id === targetRow.id) return;

    markLayoutChange("move");
    const idsToMove = Array.from(bulkSelectedInstanceIds);

    let newRows = rows;
    let newInstances = instances;
    for (const instanceId of idsToMove) {
      const movingInstance = newInstances.find(
        (instance) => instance.instanceId === instanceId,
      );
      if (!movingInstance) continue;
      const movingItem = itemsById[movingInstance.itemId];
      if (movingItem?.stockQuantity !== undefined) {
        const currentTarget = newRows.find((row) => row.id === targetRowId);
        const result = moveStockPlacement({
          instanceId,
          targetRowId,
          targetIndex: currentTarget?.itemIds.length ?? 0,
          rows: newRows,
          instances: newInstances,
        });
        newRows = result.rows;
        newInstances = result.instances;
        continue;
      }

      newRows = newRows.map((row) => {
        const withoutMoving = row.itemIds.filter((id) => id !== instanceId);
        return row.id === targetRowId
          ? { ...row, itemIds: [...withoutMoving, instanceId] }
          : { ...row, itemIds: withoutMoving };
      });
      newInstances = newInstances.map((instance) =>
        instance.instanceId === instanceId
          ? { ...instance, rowId: targetRowId }
          : instance,
      );
    }

    setRows(newRows);
    setInstances(newInstances);

    const movedItemIds = new Set(
      idsToMove
        .map((instanceId) => instances.find((i) => i.instanceId === instanceId)?.itemId)
        .filter(Boolean) as string[],
    );
    setItems((prev) =>
      prev.map((item) => {
        if (
          !movedItemIds.has(item.id) ||
          item.status === "maintenance" ||
          item.stockQuantity !== undefined
        )
          return item;
        const isOnWorksite = newInstances.some((inst) => {
          if (inst.itemId !== item.id) return false;
          const row =
            inst.rowId === targetRowId ? targetRow : rows.find((r) => r.id === inst.rowId);
          return row ? getLocationType(row) === "worksite" : false;
        });
        const status = isOnWorksite ? "on_site" : "available";
        const imageUrl = item.statusImageUrls?.[status] ?? item.imageUrl;
        return { ...item, status, imageUrl };
      }),
    );

    const count = idsToMove.length;
    log(
      "moveu_itens_em_massa",
      "row",
      sourceRow.name,
      `${count} itens para ${targetRow.name}`,
    );
    toast.success(
      `${count} ${count === 1 ? "item movido" : "itens movidos"} para "${targetRow.name}"`,
    );
    exitBulkSelect();
  }

  function resetRow(rowId: string) {
    if (!requireCapability("edit", "resetar locais")) return;
    const r = rows.find((x) => x.id === rowId);
    if (!r) return;
    if (r.itemIds.length > 0 && !requireCapability("move", "remover itens do local")) return;
    markLayoutChange("edit");
    const removedInstances = instances.filter((instance) =>
      r.itemIds.includes(instance.instanceId),
    );
    const removedItemIds = new Set(removedInstances.map((instance) => instance.itemId));
    setItems((prev) =>
      prev.map((item) => {
        const remainsOnWorksite = instances.some((instance) => {
          if (r.itemIds.includes(instance.instanceId) || instance.itemId !== item.id) return false;
          const remainingRow = rows.find((candidate) => candidate.id === instance.rowId);
          return remainingRow ? getLocationType(remainingRow) === "worksite" : false;
        });
        if (
          !removedItemIds.has(item.id) ||
          item.status === "maintenance" ||
          item.stockQuantity !== undefined
        )
          return item;
        const status = remainsOnWorksite ? "on_site" : "available";
        const imageUrl = item.statusImageUrls?.[status] ?? item.imageUrl;
        return { ...item, status, imageUrl };
      }),
    );
    setInstances((prev) => prev.filter((i) => !r.itemIds.includes(i.instanceId)));
    setRows((prev) => prev.map((x) => (x.id === rowId ? { ...x, itemIds: [] } : x)));
    log("resetou_local", "row", r.name);
  }
  function deleteRow(rowId: string) {
    if (!requireCapability("edit", "excluir locais")) return;
    const row = rows.find((candidate) => candidate.id === rowId);
    if (!row) return;
    if (row.itemIds.length > 0 && !requireCapability("move", "remover itens do local")) return;
    markLayoutChange("edit");
    const removedInstances = instances.filter(
      (instance) => instance.rowId === rowId || row.itemIds.includes(instance.instanceId),
    );
    const removedItemIds = new Set(removedInstances.map((instance) => instance.itemId));
    setItems((prev) =>
      prev.map((item) => {
        const remainsOnWorksite = instances.some((instance) => {
          if (
            instance.rowId === rowId ||
            row.itemIds.includes(instance.instanceId) ||
            instance.itemId !== item.id
          ) {
            return false;
          }
          const remainingRow = rows.find((candidate) => candidate.id === instance.rowId);
          return remainingRow ? getLocationType(remainingRow) === "worksite" : false;
        });
        if (
          !removedItemIds.has(item.id) ||
          item.status === "maintenance" ||
          item.stockQuantity !== undefined
        )
          return item;
        const status = remainsOnWorksite ? "on_site" : "available";
        const imageUrl = item.statusImageUrls?.[status] ?? item.imageUrl;
        return { ...item, status, imageUrl };
      }),
    );
    setRows((prev) => prev.filter((candidate) => candidate.id !== rowId));
    setInstances((prev) =>
      prev.filter(
        (instance) => instance.rowId !== rowId && !row.itemIds.includes(instance.instanceId),
      ),
    );
    toast.success("Obra excluida");
    log("excluiu_local", "row", row.name);
  }

  function openNewRow() {
    if (!requireCapability("add", "adicionar locais")) return;
    setEditingRow({
      id: `row-${newId()}`,
      name: "Nova obra",
      description: "Frente operacional em planejamento",
      status: "planning",
      locationType: "worksite",
      color: getRowColor({ status: "planning", locationType: "worksite" }),
      itemIds: [],
      teamMemberIds: [],
      integratedMemberIds: [],
    });
    setRowEditorOpen(true);
  }

  function saveRow(draft: BoardRow) {
    const isNew = !rows.some((row) => row.id === draft.id);
    if (!requireCapability(isNew ? "add" : "edit", isNew ? "adicionar locais" : "editar locais")) return;
    const previousRow = rows.find((row) => row.id === draft.id);
    if (
      previousRow &&
      previousRow.itemIds.length > 0 &&
      getLocationType(previousRow) !== getLocationType(draft) &&
      !requireCapability("move", "mudar o tipo de local com itens alocados")
    ) return;
    markLayoutChange(isNew ? "add" : "edit");
    setRows((prev) => {
      const exists = prev.some((row) => row.id === draft.id);
      return exists ? prev.map((row) => (row.id === draft.id ? draft : row)) : [...prev, draft];
    });
    const placedItemIds = new Set(
      instances
        .filter(
          (instance) => instance.rowId === draft.id || draft.itemIds.includes(instance.instanceId),
        )
        .map((instance) => instance.itemId),
    );
    setItems((prev) =>
      prev.map((item) => {
        if (!placedItemIds.has(item.id) || item.status === "maintenance") return item;
        const remainsOnWorksite = instances.some((instance) => {
          if (instance.itemId !== item.id) return false;
          const location =
            instance.rowId === draft.id
              ? draft
              : rows.find((candidate) => candidate.id === instance.rowId);
          return location ? getLocationType(location) === "worksite" : false;
        });
        const status = remainsOnWorksite ? "on_site" : "available";
        const imageUrl = item.statusImageUrls?.[status] ?? item.imageUrl;
        return { ...item, status, imageUrl };
      }),
    );
    setRowEditorOpen(false);
    setEditingRow(null);
    toast.success("Local salvo");
    log(isNew ? "criou_local" : "editou_local", "row", draft.name);
  }

  async function createTeamMember(member: Omit<TeamMember, "id">) {
    if (!requireCapability("manage_collaborators", "gerenciar colaboradores")) {
      return null;
    }
    const nextMember: TeamMember = { ...member, id: `tm-${newId()}`, active: member.active ?? true };
    try {
      await upsertCollaborator(nextMember);
      setTeamMembers((prev) => [...prev, nextMember]);
      toast.success("Colaborador adicionado");
      return nextMember;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel adicionar colaborador");
      return null;
    }
  }

  async function handleUpdateCollaborator(member: TeamMember) {
    if (!requireCapability("manage_collaborators", "gerenciar colaboradores")) return;
    try {
      await upsertCollaborator(member);
      setTeamMembers((prev) => prev.map((m) => (m.id === member.id ? member : m)));
      toast.success(member.active === false ? "Acesso desativado" : "Colaborador atualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar colaborador");
    }
  }

  async function handleDeleteCollaborator(id: string) {
    if (!requireCapability("manage_collaborators", "gerenciar colaboradores")) return;
    try {
      await deleteCollaborator(id);
      setTeamMembers((prev) =>
        prev.map((member) => member.id === id ? { ...member, active: false } : member),
      );
      toast.success("Acesso desativado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel desativar colaborador");
    }
  }

  function openNewItem(categoryId?: string) {
    if (!requireCapability("add", "adicionar itens")) return;
    const fallbackCategory =
      categoryId ??
      categories.find((category) => !category.isGroup)?.id ??
      categories[0]?.id ??
      "none";
    const category = categories.find((c) => c.id === fallbackCategory);
    setEditingItem({
      id: `i-${newId()}`,
      status: "available",
      name: "Novo item",
      description: "",
      categoryId: fallbackCategory,
      iconSvg: EMPTY_SVG,
      color: category?.color ?? "oklch(0.55 0.18 250)",
      isRentalEquipment: false,
    });
    setEditorOpen(true);
  }
  function saveItem(draft: BoardItem) {
    const isNew = !items.some((p) => p.id === draft.id);
    if (!requireCapability(isNew ? "add" : "edit", isNew ? "adicionar itens" : "editar itens")) return;
    markLayoutChange(isNew ? "add" : "edit");
    setItems((prev) => {
      const exists = prev.some((p) => p.id === draft.id);
      return exists ? prev.map((p) => (p.id === draft.id ? draft : p)) : [...prev, draft];
    });
    setEditorOpen(false);
    setEditingItem(null);
    toast.success("Item salvo");
    log(isNew ? "criou_item" : "editou_item", "item", draft.name);
  }
  function duplicateItem(item: BoardItem) {
    if (!requireCapability("add", "adicionar itens")) return;
    markLayoutChange("add");
    const copy = { ...item, id: `i-${newId()}`, name: `${item.name} (cópia)` };
    setItems((p) => [...p, copy]);
    setDuplicatedItem(copy);
    log("duplicou_item", "item", item.name);
  }
  function bulkAddItems(categoryId: string, baseName: string, quantity: number) {
    if (!requireCapability("add", "adicionar itens")) return;
    markLayoutChange("add");
    const category = categories.find((c) => c.id === categoryId);
    const newItem: BoardItem = {
      id: `i-${newId()}`,
      status: "available",
      name: baseName,
      description: "",
      categoryId,
      iconSvg: EMPTY_SVG,
      color: category?.color ?? "oklch(0.55 0.18 250)",
      isRentalEquipment: false,
      stockQuantity: quantity,
    };
    setItems((prev) => [...prev, newItem]);
    toast.success(`"${baseName}" criado com ${quantity} em estoque`);
    log("criou_item_lote", "item", baseName, `${quantity} em estoque`);
  }
  function deleteItem(item: BoardItem) {
    if (!requireCapability("edit", "excluir itens")) return;
    const allocatedInstances = instances.filter((instance) => instance.itemId === item.id);
    if (
      allocatedInstances.length > 0 &&
      !requireCapability("move", "remover as alocações deste item")
    )
      return;
    markLayoutChange("edit");
    const cleanedLayout = removeItemPlacements(item.id, rows, instances);
    setItems((p) => p.filter((x) => x.id !== item.id));
    setInstances(cleanedLayout.instances);
    setRows(cleanedLayout.rows);
    toast.success("Item removido");
    const allocatedQuantity =
      item.stockQuantity === undefined
        ? allocatedInstances.length
        : getAllocatedStock(item.id, allocatedInstances);
    const affectedRows = Array.from(
      new Set(
        allocatedInstances
          .map((instance) => rows.find((row) => row.id === instance.rowId)?.name)
          .filter(Boolean),
      ),
    );
    log(
      item.stockQuantity === undefined ? "excluiu_item" : "excluiu_item_lote",
      "item",
      item.name,
      item.stockQuantity === undefined
        ? undefined
        : `${item.stockQuantity} total; ${allocatedQuantity} alocadas; ${affectedRows.join(", ") || "sem obras"}`,
    );
  }
  function updateItemStatus(itemId: string, status: BoardItemStatus, rowId?: string) {
    if (!requireCapability("edit", "alterar status")) return;
    markLayoutChange("edit");
    const row = rows.find((candidate) => candidate.id === rowId);
    const nextStatus =
      status === "maintenance" || !row
        ? status
        : getLocationType(row) === "yard"
          ? "available"
          : "on_site";
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const nextImageUrl = item.statusImageUrls?.[nextStatus] ?? item.imageUrl;
        return { ...item, status: nextStatus, imageUrl: nextImageUrl };
      }),
    );
    toast.success("Status atualizado");
    const itemName = items.find((i) => i.id === itemId)?.name;
    log("atualizou_status", "item", itemName, nextStatus);
  }
  function addCategory(name: string, color: string, isGroup?: boolean, iconUrl?: string, groupId?: string) {
    if (!requireCapability("add", "adicionar categorias")) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    markLayoutChange("add");
    setCategories((p) => [
      ...p,
      { id: `cat-${newId()}`, name: cleanName, color, isGroup, iconUrl, groupId },
    ]);
    toast.success(isGroup ? "Grupo criado" : "Categoria criada");
  }
  function updateCategory(categoryId: string, name: string, color: string, iconUrl?: string, groupId?: string) {
    if (!requireCapability("edit", "editar categorias")) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    const existing = categories.find((category) => category.id === categoryId);
    const previousGroup = categories.find((category) => category.id === existing?.groupId)?.name;
    const nextGroup = categories.find((category) => category.id === groupId)?.name;
    markLayoutChange("edit");
    setCategories((prev) =>
      prev.map((category) =>
        category.id === categoryId ? { ...category, name: cleanName, color, iconUrl, groupId } : category,
      ),
    );
    toast.success("Categoria atualizada");
    if (existing && existing.groupId !== groupId) {
      log(
        "organizou_categoria",
        "category",
        cleanName,
        `${previousGroup ?? "Sem grupo"} para ${nextGroup ?? "Sem grupo"}`,
      );
    }
  }
  function deleteCategory(categoryId: string) {
    if (!requireCapability("edit", "excluir categorias")) return;
    const category = categories.find((candidate) => candidate.id === categoryId);
    if (!category) return;
    markLayoutChange("edit");

    const hasItems = items.some((item) => item.categoryId === categoryId);
    let fallbackCategoryId: string | undefined;
    if (hasItems) {
      const fallbackCategory = categories.find(
        (candidate) =>
          candidate.id !== categoryId && candidate.name.toLowerCase() === "sem categoria",
      );
      fallbackCategoryId = fallbackCategory?.id ?? `cat-${newId()}`;
      if (!fallbackCategory) {
        setCategories((prev) => [
          ...prev.filter((candidate) => candidate.id !== categoryId),
          { id: fallbackCategoryId!, name: "Sem categoria", color: "oklch(0.48 0.04 255)" },
        ]);
      } else {
        setCategories((prev) => prev.filter((candidate) => candidate.id !== categoryId));
      }
      setItems((prev) =>
        prev.map((item) =>
          item.categoryId === categoryId ? { ...item, categoryId: fallbackCategoryId! } : item,
        ),
      );
    } else {
      setCategories((prev) => prev.filter((candidate) => candidate.id !== categoryId));
    }

    if (category.isGroup) {
      setCategories((prev) =>
        prev.map((candidate) =>
          candidate.groupId === category.id ? { ...candidate, groupId: undefined } : candidate,
        ),
      );
    }

    toast.success(category.isGroup ? "Grupo excluido" : "Categoria excluida");
  }

  return (
    <div className={`asset-planner flex w-full flex-col overflow-hidden bg-background text-foreground ${
      dedicated
        ? 'h-[100dvh] min-h-[640px]'
        : 'h-[calc(100dvh-4.5rem)] min-h-[640px] md:rounded-xl md:border'
    }`}>
      <Toaster richColors position="top-right" />
      <StockAllocationDialog
        item={pendingStockItem}
        row={pendingStockRow}
        remaining={pendingStockRemaining}
        onCancel={() => setPendingStockAllocation(null)}
        onConfirm={confirmStockAllocation}
      />
      <Dialog open={!!duplicatedItem} onOpenChange={(open) => !open && setDuplicatedItem(null)}>
        <DialogContent className="fixed left-1/2 top-1/2 z-[2000] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 border-none bg-transparent p-0 shadow-none [&>button]:hidden">
          <div className="flex flex-col items-center gap-5 rounded-2xl border bg-card px-10 py-14 text-center shadow-2xl">
            <CheckCircle2 className="h-24 w-24 text-emerald-500" />
            <div>
              <h2 className="op-title text-3xl font-bold">Item duplicado!</h2>
              <p className="mt-2 text-lg text-muted-foreground">
                "{duplicatedItem?.name}" foi adicionado à biblioteca.
              </p>
            </div>
            <Button size="lg" className="mt-2 px-8" onClick={() => setDuplicatedItem(null)}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!duplicatePlacementWarning}
        onOpenChange={(open) => !open && setDuplicatePlacementWarning(null)}
      >
        <DialogContent className="fixed left-1/2 top-1/2 z-[2000] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 border-none bg-transparent p-0 shadow-none [&>button]:hidden">
          <div className="flex flex-col items-center gap-5 rounded-2xl border bg-card px-10 py-14 text-center shadow-2xl">
            <AlertTriangle className="h-24 w-24 text-amber-500" />
            <div>
              <h2 className="op-title text-3xl font-bold">Item já alocado!</h2>
              <p className="mt-2 text-lg text-muted-foreground">
                "{duplicatePlacementWarning?.itemName}" já está alocado em:{" "}
                {duplicatePlacementWarning?.otherRows}
              </p>
            </div>
            <div className="mt-2 flex gap-3">
              <Button
                size="lg"
                variant="outline"
                className="px-8"
                onClick={() => setDuplicatePlacementWarning(null)}
              >
                OK
              </Button>
              <Button
                size="lg"
                className="px-8"
                onClick={() =>
                  duplicatePlacementWarning &&
                  moveDuplicateToHere(duplicatePlacementWarning.oldInstanceIds)
                }
              >
                Mover para cá
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <TooltipProvider delayDuration={180}>
        <div className="group/nav shrink-0 relative z-40">
          {/* hover strip — always visible */}
          <div className="h-1.5 bg-border/40 group-hover/nav:bg-transparent transition-colors cursor-default" />
          {/* collapsible header + tabs */}
          <div className="grid grid-rows-[0fr] group-hover/nav:grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out overflow-hidden">
          <div className="overflow-hidden">
        <header className="relative z-40 flex h-12 shrink-0 items-center justify-between border-b bg-card/95 px-3 shadow-sm backdrop-blur md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/logogeoteste.png"
              alt="Geoteste"
              className="h-7 w-7 shrink-0 rounded-md object-contain shadow-sm"
            />
            <div className="hidden sm:block">
              <h1 className="op-title text-base leading-none md:text-lg">Geoteste Planner</h1>
            </div>
            <div className="hidden items-center gap-1.5 md:flex">
              <span className="op-label rounded-md bg-secondary px-2 py-1 text-[10px] text-secondary-foreground">
                {rows.length} locais
              </span>
              <span className="op-label rounded-md bg-secondary px-2 py-1 text-[10px] text-secondary-foreground">
                {instances.length} alocações
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {actor && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="op-label flex items-center gap-1.5 rounded-full border bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground transition hover:bg-muted"
                  >
                    <Users className="h-3 w-3" />
                    {actor}{currentMember.isAdmin ? " (Admin)" : ""}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Usuário conectado no sistema</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="h-8 gap-1.5 px-2.5"
                  onClick={() => setCollaboratorsPanelOpen(true)}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span className="op-label hidden text-[10px] sm:inline">Equipe</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gerenciar colaboradores</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" className="h-8 w-8" onClick={openNewRow} disabled={!can("add")}>
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Novo local</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Novo local</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Tab navigation */}
        <div className="shrink-0 flex items-center gap-0.5 border-b bg-card/95 px-2">
          {(["board", "mapa", "patrimonio", "vencimentos", "historico"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`op-label relative flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold transition-colors ${
                activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "board" && <LayoutGrid className="h-3.5 w-3.5" />}
              {tab === "mapa" && <MapPin className="h-3.5 w-3.5" />}
              {tab === "patrimonio" && <Package className="h-3.5 w-3.5" />}
              {tab === "vencimentos" && <CalendarClock className="h-3.5 w-3.5" />}
              {tab === "historico" && <Save className="h-3.5 w-3.5" />}
              {tab === "board"
                ? "Quadro"
                : tab === "mapa"
                  ? "Mapa"
                  : tab === "patrimonio"
                    ? "Inventário"
                    : tab === "vencimentos"
                      ? "Vencimentos"
                      : "Histórico"}
              {activeTab === tab && (
                <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
          </div>{/* overflow-hidden inner */}
          </div>{/* grid collapsible */}
        </div>{/* group/nav */}

        {activeTab === "mapa" && (
          <div className="flex flex-1 overflow-hidden">
            <MapView rows={rows} teamMembers={activeTeamMembers} onSelectRow={(row) => setDetailRow(row)} />
          </div>
        )}

        {activeTab === "patrimonio" && (
          <div className="flex flex-1 overflow-hidden">
            <PatrimonioView
              categories={categories}
              items={items}
              instances={instances}
              rows={rows}
              onEditItem={can("edit") ? (item) => {
                setEditingItem(item);
                setEditorOpen(true);
              } : undefined}
            />
          </div>
        )}

        {activeTab === "vencimentos" && (
          <div className="flex flex-1 overflow-hidden">
            <VencimentosView
              items={items}
              categories={categories}
              instances={instances}
              rows={rows}
            />
          </div>
        )}

        {activeTab === "historico" && (
          <div className="flex flex-1 overflow-hidden">
            <AuditLogView />
          </div>
        )}

        {activeTab === "board" && (
          <>
          <DndContext
            sensors={can("move") || can("edit") ? sensors : []}
            collisionDetection={plannerCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex flex-1 overflow-hidden">
              <PaletteSidebar
                categories={categories}
                items={items}
                instances={instances}
                rows={rows}
                isDragging={activeId?.startsWith("library:") ?? false}
                onAddItem={openNewItem}
                onBulkAddItems={bulkAddItems}
                onAddCategory={addCategory}
                onUpdateCategory={updateCategory}
                onDeleteCategory={deleteCategory}
                onEditItem={(i) => {
                  setEditingItem(i);
                  setEditorOpen(true);
                }}
                onDuplicateItem={duplicateItem}
                onDeleteItem={deleteItem}
                onLocateItem={locateItemOnBoard}
                onOpenCollaborators={() => setCollaboratorsPanelOpen(true)}
                canAdd={can("add")}
                canEdit={can("edit")}
                canMove={can("move")}
              />
              <main className={`flex-1 overflow-y-auto p-2 md:p-3 ${bulkSelectRowId ? "pb-24" : ""}`}>
                <div className="sticky top-0 z-20 mb-2 overflow-hidden rounded-lg border bg-background/95 px-3 py-2.5 shadow-sm backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="op-title truncate text-xl leading-none md:text-2xl">
                        Obras e pátios
                      </h2>
                      <span className="op-label rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        {rows.length} locais · {instances.length} alocações
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-lg border bg-card p-1 shadow-[var(--shadow-soft)]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={exporting !== null || filteredRows.length === 0}
                              onClick={() => exportBoard("png")}
                            >
                              {exporting === "png" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileImage className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Exportar PNG do quadro</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={exporting !== null || filteredRows.length === 0}
                              onClick={() => exportBoard("pdf")}
                            >
                              {exporting === "pdf" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Exportar PDF do quadro</TooltipContent>
                        </Tooltip>
                      </div>
                      <ToggleGroup
                        type="single"
                        value={boardDensity}
                        onValueChange={(value) => {
                          if (value) setBoardDensity(value as BoardDensity);
                        }}
                        className="rounded-lg border bg-card p-1 shadow-[var(--shadow-soft)]"
                      >
                        {(["comfortable", "compact", "dense", "mini", "map"] as BoardDensity[]).map((d) => (
                          <Tooltip key={d}>
                            <TooltipTrigger asChild>
                              <ToggleGroupItem value={d} size="sm" className="h-7 w-7 p-0">
                                {DENSITY_META[d].icon}
                              </ToggleGroupItem>
                            </TooltipTrigger>
                            <TooltipContent>{DENSITY_META[d].label}</TooltipContent>
                          </Tooltip>
                        ))}
                      </ToggleGroup>
                    </div>
                  </div>
                  <div className="relative mt-3 border-t pt-3">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" style={{ top: "calc(50% + 6px)" }} />
                    <input
                      type="text"
                      value={rowSearchQuery}
                      onChange={(e) => setRowSearchQuery(e.target.value)}
                      placeholder="Buscar obra ou cliente..."
                      className="w-full rounded-md border bg-card py-1.5 pl-8 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    />
                  </div>
                  <div className="mt-2 flex gap-1.5 overflow-x-auto">
                    {ROW_STATUS_FILTERS.map((filter) => {
                      const active = rowStatusFilters.includes(filter.value);

                      return (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => toggleStatusFilter(filter.value)}
                          className={`op-label flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          {filter.label}
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                              active
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {rowStatusCounts[filter.value]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div
                  ref={boardExportRef}
                  className={
                    boardDensity === "map"
                      ? "space-y-1.5"
                      : boardDensity === "mini"
                        ? "grid grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                        : boardDensity === "dense"
                          ? "space-y-2"
                          : boardDensity === "compact"
                            ? "space-y-3"
                            : "space-y-4"
                  }
                >
                  {filteredRows.length === 0 ? (
                    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed bg-card/40">
                      <p className="op-label text-[11px] text-muted-foreground">{emptyRowsLabel}</p>
                    </div>
                  ) : (
                    filteredRows.map((row) => (
                      <BoardRowView
                        key={row.id}
                        row={row}
                        instances={instancesByRow[row.id] ?? []}
                        itemsById={itemsById}
                        teamMembers={activeTeamMembers}
                        density={boardDensity}
                        isOver={overRowId === row.id}
                        onRemoveInstance={removeInstance}
                        onUpdateItemStatus={updateItemStatus}
                        onUpdateInstanceQuantity={updateInstanceQuantity}
                        instanceQuantityLimits={instanceQuantityLimits}
                        onResetRow={() => resetRow(row.id)}
                        onEditRow={() => {
                          setEditingRow(row);
                          setRowEditorOpen(true);
                        }}
                        onDeleteRow={() => deleteRow(row.id)}
                        onOpenDetail={() => setDetailRow(row)}
                        canEdit={can("edit")}
                        canMove={can("move")}
                        bulkSelectMode={bulkSelectRowId === row.id}
                        selectedInstanceIds={
                          bulkSelectRowId === row.id ? bulkSelectedInstanceIds : new Set<string>()
                        }
                        onToggleBulkInstance={(instanceId) =>
                          handleInstanceCircleClick(row.id, instanceId)
                        }
                        onToggleSelectAll={toggleSelectAllInBulkRow}
                        highlightInstanceId={highlightInstanceId}
                      />
                    ))
                  )}
                </div>
              </main>
            </div>

            <DragOverlay dropAnimation={null}>
              {activeId && activeItem ? (
                <div className="rotate-1">
                  <ItemBlock item={activeItem} compact dragging />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {bulkSelectRowId && (
            <BulkMoveBar
              sourceRow={rows.find((r) => r.id === bulkSelectRowId)!}
              selectedCount={bulkSelectedInstanceIds.size}
              rows={rows.filter((r) => r.id !== bulkSelectRowId)}
              onMove={moveBulkInstances}
              onCancel={exitBulkSelect}
            />
          )}
          </>
        )}

        <CollaboratorsPanel
          open={collaboratorsPanelOpen}
          collaborators={teamMembers}
          onClose={() => setCollaboratorsPanelOpen(false)}
          onAdd={createTeamMember}
          onUpdate={handleUpdateCollaborator}
          onDelete={handleDeleteCollaborator}
          canManage={can("manage_collaborators")}
          canDelegateAdmin={Boolean(currentMember.isAdmin)}
          currentMemberId={currentMember.id}
        />

        {detailRow && (
          <RowDetailModal
            row={detailRow}
            instances={instancesByRow[detailRow.id] ?? []}
            itemsById={itemsById}
            categories={categories}
            teamMembers={activeTeamMembers}
            onClose={() => setDetailRow(null)}
          />
        )}

        <ItemEditor
          open={editorOpen}
          item={editingItem}
          categories={categories}
          onClose={() => {
            setEditorOpen(false);
            setEditingItem(null);
          }}
          onSave={saveItem}
        />
        <RowEditor
          open={rowEditorOpen}
          row={editingRow}
          teamMembers={activeTeamMembers}
          onClose={() => {
            setRowEditorOpen(false);
            setEditingRow(null);
          }}
          onSave={saveRow}
          onCreateTeamMember={createTeamMember}
          canCreateTeamMember={can("manage_collaborators")}
        />
      </TooltipProvider>
    </div>
  );
}

export default AssetPlanner;
