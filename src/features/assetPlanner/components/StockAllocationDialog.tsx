import { useEffect, useState } from "react";
import type { BoardItem, BoardRow } from "../lib/board-types";
import { isValidStockQuantity } from "../lib/planner-helpers";
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

export function StockAllocationDialog({
  item,
  row,
  remaining,
  onCancel,
  onConfirm,
}: {
  item: BoardItem | null;
  row: BoardRow | null;
  remaining: number;
  onCancel: () => void;
  onConfirm: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const parsedQuantity = Number(quantity);
  const valid = isValidStockQuantity(parsedQuantity, remaining);

  useEffect(() => {
    if (item && row) setQuantity("1");
  }, [item, row]);

  return (
    <Dialog open={Boolean(item && row)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden p-0">
        <DialogHeader className="border-b bg-secondary/40 px-6 py-5">
          <DialogTitle>Alocar item em lote</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {item?.name} em {row?.name}
          </p>
        </DialogHeader>
        <div className="space-y-3 px-6 py-5">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            Saldo disponível: <strong>{remaining}</strong>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock-allocation-quantity">Quantidade a enviar</Label>
            <Input
              id="stock-allocation-quantity"
              type="number"
              min={1}
              max={remaining}
              step={1}
              autoFocus
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && valid) onConfirm(parsedQuantity);
              }}
            />
            {!valid && (
              <p className="text-xs font-medium text-destructive">
                Informe um número inteiro entre 1 e {remaining}.
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="border-t bg-card px-6 py-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button disabled={!valid} onClick={() => onConfirm(parsedQuantity)}>
            Alocar {valid ? parsedQuantity : 0}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


