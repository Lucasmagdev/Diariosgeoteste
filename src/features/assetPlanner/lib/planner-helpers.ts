import type { BoardItem, BoardRow, PlacedInstance } from "./board-types";

const NATURAL_COLLATOR = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

export function naturalCompare(left: string, right: string) {
  return NATURAL_COLLATOR.compare(left, right);
}

export function compareByName<T extends { name: string }>(left: T, right: T) {
  return naturalCompare(left.name, right.name);
}

export function extractWorkCode(name: string) {
  const cleanName = name.trim();
  if (!cleanName) return "";
  return cleanName.split(/\s+-\s+/, 1)[0]?.trim() || cleanName;
}

export function getAllocatedStock(itemId: string, instances: PlacedInstance[]) {
  return instances
    .filter((instance) => instance.itemId === itemId)
    .reduce((total, instance) => total + (instance.quantity ?? 1), 0);
}

export function getRemainingStock(item: BoardItem, instances: PlacedInstance[]) {
  if (item.stockQuantity === undefined) return undefined;
  return Math.max(0, item.stockQuantity - getAllocatedStock(item.id, instances));
}

export function getMaxStockQuantity(
  item: BoardItem,
  instances: PlacedInstance[],
  instanceId: string,
) {
  if (item.stockQuantity === undefined) return undefined;
  const allocatedElsewhere = instances
    .filter((instance) => instance.itemId === item.id && instance.instanceId !== instanceId)
    .reduce((total, instance) => total + (instance.quantity ?? 1), 0);
  return Math.max(1, item.stockQuantity - allocatedElsewhere);
}

export function isValidStockQuantity(quantity: number, maximum: number) {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= maximum;
}

export function coalesceStockPlacements(
  items: BoardItem[],
  rows: BoardRow[],
  instances: PlacedInstance[],
) {
  const stockItemIds = new Set(
    items.filter((item) => item.stockQuantity !== undefined).map((item) => item.id),
  );
  const grouped = new Map<string, PlacedInstance[]>();

  for (const instance of instances) {
    if (!stockItemIds.has(instance.itemId)) continue;
    const key = `${instance.itemId}\u0000${instance.rowId}`;
    const placements = grouped.get(key) ?? [];
    placements.push(instance);
    grouped.set(key, placements);
  }

  const removedIds = new Set<string>();
  const mergedQuantities = new Map<string, number>();
  for (const placements of grouped.values()) {
    if (placements.length < 2) continue;
    const row = rows.find((candidate) => candidate.id === placements[0]?.rowId);
    const placementIds = new Set(placements.map((placement) => placement.instanceId));
    const keeperId =
      row?.itemIds.find((instanceId) => placementIds.has(instanceId)) ?? placements[0]!.instanceId;
    mergedQuantities.set(
      keeperId,
      placements.reduce((total, placement) => total + (placement.quantity ?? 1), 0),
    );
    placements.forEach((placement) => {
      if (placement.instanceId !== keeperId) removedIds.add(placement.instanceId);
    });
  }

  if (removedIds.size === 0) return { rows, instances };

  return {
    rows: rows.map((row) => ({
      ...row,
      itemIds: row.itemIds.filter((instanceId) => !removedIds.has(instanceId)),
    })),
    instances: instances
      .filter((instance) => !removedIds.has(instance.instanceId))
      .map((instance) => {
        const quantity = mergedQuantities.get(instance.instanceId);
        return quantity === undefined ? instance : { ...instance, quantity };
      }),
  };
}

export function removeItemPlacements(
  itemId: string,
  rows: BoardRow[],
  instances: PlacedInstance[],
) {
  const removedInstanceIds = new Set(
    instances
      .filter((instance) => instance.itemId === itemId)
      .map((instance) => instance.instanceId),
  );
  return {
    rows: rows.map((row) => ({
      ...row,
      itemIds: row.itemIds.filter((instanceId) => !removedInstanceIds.has(instanceId)),
    })),
    instances: instances.filter((instance) => instance.itemId !== itemId),
  };
}

type AllocateStockInput = {
  item: BoardItem;
  rowId: string;
  targetIndex: number;
  quantity: number;
  newInstanceId: string;
  rows: BoardRow[];
  instances: PlacedInstance[];
};

export type StockPlacementResult = {
  rows: BoardRow[];
  instances: PlacedInstance[];
  instanceId: string;
  merged: boolean;
  quantity: number;
};

function placementOrder(row: BoardRow, instances: PlacedInstance[], itemId: string) {
  const matchingIds = new Set(
    instances
      .filter((instance) => instance.itemId === itemId && instance.rowId === row.id)
      .map((instance) => instance.instanceId),
  );
  return row.itemIds.filter((instanceId) => matchingIds.has(instanceId));
}

export function allocateStockToRow({
  item,
  rowId,
  targetIndex,
  quantity,
  newInstanceId,
  rows,
  instances,
}: AllocateStockInput): StockPlacementResult {
  if (item.stockQuantity === undefined) {
    throw new Error("O item informado não é um lote.");
  }

  const remaining = getRemainingStock(item, instances) ?? 0;
  if (!isValidStockQuantity(quantity, remaining)) {
    throw new Error(`Informe uma quantidade entre 1 e ${remaining}.`);
  }

  const targetRow = rows.find((row) => row.id === rowId);
  if (!targetRow) throw new Error("Local de destino não encontrado.");

  const targetPlacements = instances.filter(
    (instance) => instance.itemId === item.id && instance.rowId === rowId,
  );
  const orderedIds = placementOrder(targetRow, instances, item.id);
  const keeperId = orderedIds[0] ?? targetPlacements[0]?.instanceId;

  if (keeperId) {
    const mergedIds = new Set(
      targetPlacements
        .map((instance) => instance.instanceId)
        .filter((instanceId) => instanceId !== keeperId),
    );
    const mergedQuantity =
      targetPlacements.reduce((total, instance) => total + (instance.quantity ?? 1), 0) + quantity;
    return {
      rows: rows.map((row) => ({
        ...row,
        itemIds: row.itemIds.filter((instanceId) => !mergedIds.has(instanceId)),
      })),
      instances: instances
        .filter((instance) => !mergedIds.has(instance.instanceId))
        .map((instance) =>
          instance.instanceId === keeperId ? { ...instance, quantity: mergedQuantity } : instance,
        ),
      instanceId: keeperId,
      merged: true,
      quantity: mergedQuantity,
    };
  }

  const nextInstance: PlacedInstance = {
    instanceId: newInstanceId,
    itemId: item.id,
    rowId,
    quantity,
  };
  const insertionIndex = Math.max(0, Math.min(targetIndex, targetRow.itemIds.length));
  return {
    rows: rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            itemIds: [
              ...row.itemIds.slice(0, insertionIndex),
              newInstanceId,
              ...row.itemIds.slice(insertionIndex),
            ],
          }
        : row,
    ),
    instances: [...instances, nextInstance],
    instanceId: newInstanceId,
    merged: false,
    quantity,
  };
}

type MoveStockInput = {
  instanceId: string;
  targetRowId: string;
  targetIndex: number;
  rows: BoardRow[];
  instances: PlacedInstance[];
};

export function moveStockPlacement({
  instanceId,
  targetRowId,
  targetIndex,
  rows,
  instances,
}: MoveStockInput): StockPlacementResult {
  const moving = instances.find((instance) => instance.instanceId === instanceId);
  if (!moving) throw new Error("Alocação não encontrada.");

  const targetRow = rows.find((row) => row.id === targetRowId);
  if (!targetRow) throw new Error("Local de destino não encontrado.");

  const targetPlacements = instances.filter(
    (instance) =>
      instance.instanceId !== instanceId &&
      instance.itemId === moving.itemId &&
      instance.rowId === targetRowId,
  );
  const orderedIds = placementOrder(targetRow, instances, moving.itemId).filter(
    (candidateId) => candidateId !== instanceId,
  );
  const keeperId = orderedIds[0] ?? targetPlacements[0]?.instanceId;

  if (keeperId) {
    const mergedIds = new Set([
      instanceId,
      ...targetPlacements
        .map((instance) => instance.instanceId)
        .filter((candidateId) => candidateId !== keeperId),
    ]);
    const mergedQuantity =
      (moving.quantity ?? 1) +
      targetPlacements.reduce((total, instance) => total + (instance.quantity ?? 1), 0);
    return {
      rows: rows.map((row) => ({
        ...row,
        itemIds: row.itemIds.filter((candidateId) => !mergedIds.has(candidateId)),
      })),
      instances: instances
        .filter((instance) => !mergedIds.has(instance.instanceId))
        .map((instance) =>
          instance.instanceId === keeperId ? { ...instance, quantity: mergedQuantity } : instance,
        ),
      instanceId: keeperId,
      merged: true,
      quantity: mergedQuantity,
    };
  }

  const insertionIndex = Math.max(0, Math.min(targetIndex, targetRow.itemIds.length));
  return {
    rows: rows.map((row) => {
      const withoutMoving = row.itemIds.filter((candidateId) => candidateId !== instanceId);
      if (row.id !== targetRowId) return { ...row, itemIds: withoutMoving };
      const safeIndex = Math.min(insertionIndex, withoutMoving.length);
      return {
        ...row,
        itemIds: [
          ...withoutMoving.slice(0, safeIndex),
          instanceId,
          ...withoutMoving.slice(safeIndex),
        ],
      };
    }),
    instances: instances.map((instance) =>
      instance.instanceId === instanceId ? { ...instance, rowId: targetRowId } : instance,
    ),
    instanceId,
    merged: false,
    quantity: moving.quantity ?? 1,
  };
}


