import type { BoardRow } from "./board-types";

// Worksite colors are driven automatically by status; yards are always yellow.
// Planejamento — Azul / Em Operação — Verde / Aguardando — Roxo / Concluída — Vermelha / Pátio — Amarelo
const BLUE = "oklch(0.55 0.18 250)";
const GREEN = "oklch(0.62 0.16 155)";
const RED = "oklch(0.65 0.18 25)";
const YELLOW = "oklch(0.78 0.16 75)";
const PURPLE = "oklch(0.55 0.18 300)";

export const ROW_STATUS_COLORS: Record<BoardRow["status"], string> = {
  planning: BLUE,
  active: GREEN,
  waiting: PURPLE,
  done: RED,
};

export const YARD_COLOR = YELLOW;

/** Returns the automatic color for a row based on its type/status. */
export function getRowColor(row: Pick<BoardRow, "status" | "locationType">): string {
  if ((row.locationType ?? "worksite") === "yard") return YARD_COLOR;
  return ROW_STATUS_COLORS[row.status];
}


