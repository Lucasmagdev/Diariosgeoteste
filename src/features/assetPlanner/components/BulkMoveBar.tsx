import { useState, useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import type { BoardRow } from "../lib/board-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";

export function BulkMoveBar({
  sourceRow,
  selectedCount,
  rows,
  onMove,
  onCancel,
}: {
  sourceRow: BoardRow;
  selectedCount: number;
  rows: BoardRow[];
  onMove: (targetRowId: string) => void;
  onCancel: () => void;
}) {
  const [targetRowId, setTargetRowId] = useState<string>("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/98 px-3 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.10)] backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span className="flex h-7 shrink-0 items-center rounded-full bg-primary px-3 text-[11px] font-bold text-primary-foreground">
            {selectedCount} {selectedCount === 1 ? "item" : "itens"}
          </span>
          <span className="op-label hidden truncate text-[11px] text-muted-foreground sm:inline">
            de <strong className="text-foreground">{sourceRow.name}</strong>
          </span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </div>

        <div className="flex items-center gap-2">
          <Select value={targetRowId} onValueChange={setTargetRowId}>
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue placeholder="Selecionar destino..." />
            </SelectTrigger>
            <SelectContent>
              {rows.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: row.color }}
                    />
                    {row.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            disabled={!targetRowId || selectedCount === 0}
            onClick={() => targetRowId && onMove(targetRowId)}
            className="h-8 gap-1.5"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Mover
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cancelar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}


