import type { BoardItemStatus } from "./board-types";

export const ITEM_STATUS_META: Record<
  BoardItemStatus,
  { label: string; color: string; softColor: string }
> = {
  maintenance: {
    label: "MANUTENÇÃO",
    color: "oklch(0.58 0.21 27)",
    softColor: "oklch(0.96 0.035 27)",
  },
  acquisition: {
    label: "AQUISIÇÃO",
    color: "oklch(0.52 0.17 255)",
    softColor: "oklch(0.95 0.03 255)",
  },
  available: {
    label: "DISPONÍVEL",
    color: "oklch(0.18 0.02 255)",
    softColor: "oklch(0.96 0.005 255)",
  },
  on_site: {
    label: "EM OBRA",
    color: "oklch(0.52 0.15 150)",
    softColor: "oklch(0.95 0.04 150)",
  },
};

export const DEFAULT_ITEM_STATUS: BoardItemStatus = "available";

export function getItemStatusMeta(status?: BoardItemStatus) {
  return ITEM_STATUS_META[status ?? DEFAULT_ITEM_STATUS];
}


