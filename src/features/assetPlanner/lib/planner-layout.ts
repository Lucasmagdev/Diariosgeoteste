import { initialCategories, initialInstances, initialItems, initialRows } from "./board-data";
import type { BoardItem, BoardRow, ItemCategory, PlacedInstance } from "./board-types";

export type PlannerLayout = {
  categories: ItemCategory[];
  items: BoardItem[];
  rows: BoardRow[];
  instances: PlacedInstance[];
};

export const DEFAULT_LAYOUT: PlannerLayout = {
  categories: initialCategories,
  items: initialItems,
  rows: initialRows,
  instances: initialInstances,
};

export const PLANNER_LAYOUT_ID = "default";


