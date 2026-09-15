import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, ImageUp, Loader2, Package, Paperclip, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { DatePicker } from "../ui/date-picker";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type {
  AssetDocumentType,
  BoardItem,
  BoardItemStatus,
  ItemCategory,
  RentalPeriod,
} from "../lib/board-types";
import {
  DEFAULT_RENTAL_PERIOD,
  RENTAL_PERIODS,
  RENTAL_PERIOD_LABELS,
  RENTAL_PERIOD_SUFFIX,
} from "../lib/board-types";
import { formatCurrencyBRL } from "../lib/format";
import { ITEM_STATUS_META, getItemStatusMeta } from "../lib/item-status";
import { downloadAssetFile, uploadAssetFile, removeAssetFile } from "../lib/storage.functions";
import { AssetIcon } from "./AssetIcon";

const COLOR_PRESETS = [
  "oklch(0.55 0.18 250)",
  "oklch(0.62 0.16 155)",
  "oklch(0.70 0.16 50)",
  "oklch(0.60 0.18 320)",
  "oklch(0.65 0.18 25)",
  "oklch(0.55 0.10 220)",
];

const DOCUMENT_TYPES: Record<AssetDocumentType, string> = {
  calibration_certificate: "Certificado de calibração",
  maintenance_report: "Laudo de manutenção",
  invoice: "Nota fiscal",
  manual: "Manual",
  photo: "Foto",
  other: "Outro",
};

function parseRentalValue(input: string): number | undefined {
  const cleaned = input.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return undefined;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export function ItemEditor({
  open,
  item,
  categories,
  onClose,
  onSave,
}: {
  open: boolean;
  item: BoardItem | null;
  categories: ItemCategory[];
  onClose: () => void;
  onSave: (item: BoardItem) => void;
}) {
  const [draft, setDraft] = useState<BoardItem | null>(item);
  const [documentType, setDocumentType] = useState<AssetDocumentType>("calibration_certificate");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [rentalValueInput, setRentalValueInput] = useState("");

  useEffect(() => {
    setDraft(item);
    setDocumentType("calibration_certificate");
    setRentalValueInput(
      item?.rentalValue !== undefined ? item.rentalValue.toFixed(2).replace(".", ",") : "",
    );
  }, [item]);

  if (!draft) return null;

  const selectedCategory = categories.find((category) => category.id === draft.categoryId);
  const statusMeta = getItemStatusMeta(draft.status);
  const parsedRentalValue = parseRentalValue(rentalValueInput);
  const rentalPeriod = draft.rentalPeriod ?? DEFAULT_RENTAL_PERIOD;
  const periodSuffix = RENTAL_PERIOD_SUFFIX[rentalPeriod];
  const rentalValueIsValid =
    rentalValueInput.trim() === "" || parsedRentalValue !== undefined || !draft.isRentalEquipment;

  async function attachDocument(file?: File) {
    if (!file) return;
    setUploadingDoc(true);
    try {
      const { url, path } = await uploadAssetFile(file, "documents");
      setDraft((currentDraft) =>
        currentDraft
          ? {
              ...currentDraft,
              documents: [
                ...(currentDraft.documents ?? []),
                {
                  id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  name: file.name,
                  type: documentType,
                  url,
                  path,
                },
              ],
            }
          : currentDraft,
      );
      toast.success("Documento anexado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao anexar documento");
    } finally {
      setUploadingDoc(false);
    }
  }

  function removeDocument(documentId: string) {
    const target = (draft?.documents ?? []).find((document) => document.id === documentId);
    void removeAssetFile(target?.path);
    setDraft((currentDraft) =>
      currentDraft
        ? {
            ...currentDraft,
            documents: (currentDraft.documents ?? []).filter(
              (document) => document.id !== documentId,
            ),
          }
        : currentDraft,
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="border-b bg-secondary/40 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary-foreground shadow-[var(--shadow-soft)] sm:h-11 sm:w-11"
              style={{ background: statusMeta.color }}
            >
              <Package className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Cadastro de Item</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Nome, descrição, SVG e categoria ficam prontos para usar no quadro.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[1fr_260px]">
          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) => setDraft({ ...draft, status: value as BoardItemStatus })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ITEM_STATUS_META).map(([status, meta]) => (
                    <SelectItem key={status} value={status}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="item-rental-equipment"
                  checked={Boolean(draft.isRentalEquipment)}
                  onCheckedChange={(checked) =>
                    setDraft({
                      ...draft,
                      isRentalEquipment: checked === true,
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <Label htmlFor="item-rental-equipment" className="text-sm font-semibold">
                    Equipamento de locação
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quando marcado, o item pode ir para obra, mas não entra em Patrimônio e
                    Vencimentos enquanto estiver alocado.
                  </p>
                </div>
              </div>

              {draft.isRentalEquipment && (
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="item-rental-period" className="text-xs text-muted-foreground">
                      Período da locação
                    </Label>
                    <Select
                      value={rentalPeriod}
                      onValueChange={(value) =>
                        setDraft({ ...draft, rentalPeriod: value as RentalPeriod })
                      }
                    >
                      <SelectTrigger id="item-rental-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RENTAL_PERIODS.map((period) => (
                          <SelectItem key={period} value={period}>
                            {RENTAL_PERIOD_LABELS[period]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="item-rental-value" className="text-xs text-muted-foreground">
                      Valor da locação {periodSuffix}
                    </Label>
                    <Input
                      id="item-rental-value"
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex.: 3,00"
                      value={rentalValueInput}
                      onChange={(event) => setRentalValueInput(event.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {rentalValueInput.trim() === ""
                        ? `Deixe em branco se este item não tiver valor de locação ${periodSuffix}.`
                        : parsedRentalValue !== undefined
                          ? `Atual: ${formatCurrencyBRL(parsedRentalValue)} ${periodSuffix}`
                          : "Digite um valor válido, por exemplo 3,00."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Categoria</Label>
              <Select
                value={draft.categoryId}
                onValueChange={(value) => {
                  const nextCategory = categories.find((category) => category.id === value);
                  setDraft({
                    ...draft,
                    categoryId: value,
                    color: nextCategory?.color ?? draft.color,
                  });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const groups = categories.filter((category) => category.isGroup);
                    const standalone = categories.filter(
                      (category) => !category.isGroup && !category.groupId,
                    );
                    return (
                      <>
                        {groups.map((group) => {
                          const children = categories.filter(
                            (category) => category.groupId === group.id,
                          );
                          return (
                            <SelectGroup key={group.id}>
                              <SelectLabel>{group.name}</SelectLabel>
                              {children.map((child) => (
                                <SelectItem key={child.id} value={child.id}>
                                  {child.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          );
                        })}
                        {standalone.length > 0 && (
                          <SelectGroup>
                            {groups.length > 0 && <SelectLabel>Outras categorias</SelectLabel>}
                            {standalone.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </>
                    );
                  })()}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Nome</Label>
              <Input
                className="mt-1"
                placeholder="Ex.: Bate-estaca BE-200"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                className="mt-1 min-h-24"
                placeholder="Resumo técnico, capacidade, medida ou observação operacional."
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>

            {draft.stockQuantity !== undefined && (
              <div>
                <Label>Quantidade total em estoque</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={draft.stockQuantity}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      stockQuantity: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                    })
                  }
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Ajuste aqui se o total real mudar (compra, perda etc). A quantidade disponível na
                  biblioteca é este total menos o que já está alocado nas obras.
                </p>
              </div>
            )}

            <div className="rounded-lg border bg-card p-4">
              <Label>Validade e manutenção</Label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Validade / Calibração</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <DatePicker
                      className="flex-1"
                      value={draft.expiryDate}
                      onChange={(val) => setDraft({ ...draft, expiryDate: val })}
                    />
                    <label
                      title="Anexar documentos e certificados"
                      aria-disabled={uploadingDoc}
                      className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 ${
                        uploadingDoc ? "pointer-events-none opacity-60" : "cursor-pointer"
                      }`}
                    >
                      {uploadingDoc ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Paperclip className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">
                        {uploadingDoc ? "Enviando…" : "Anexar"}
                      </span>
                      <Input
                        className="hidden"
                        type="file"
                        disabled={uploadingDoc}
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                        onChange={(event) => {
                          attachDocument(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Última manutenção</Label>
                  <DatePicker
                    className="mt-1"
                    value={draft.lastMaintenanceDate}
                    onChange={(val) => setDraft({ ...draft, lastMaintenanceDate: val })}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <Label>Documentos e certificados</Label>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha o tipo e use o botão <strong>Anexar</strong> ao lado de Validade /
                Calibração.
              </p>
              <div className="mt-3 sm:max-w-xs">
                <Label className="text-xs text-muted-foreground">Tipo do próximo anexo</Label>
                <Select
                  value={documentType}
                  onValueChange={(value) => setDocumentType(value as AssetDocumentType)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(draft.documents ?? []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(draft.documents ?? []).map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between gap-3 rounded-md border bg-secondary/30 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <a
                          href={document.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs font-semibold hover:text-primary hover:underline"
                          title={`Visualizar ${document.name}`}
                        >
                          {document.name}
                        </a>
                        <div className="text-[10px] text-muted-foreground">
                          {DOCUMENT_TYPES[document.type]}
                          {document.expiryDate ? ` · validade ${document.expiryDate}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          asChild
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                        >
                          <a
                            href={document.url}
                            target="_blank"
                            rel="noreferrer"
                            title="Visualizar documento"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Baixar documento"
                          onClick={() => {
                            void downloadAssetFile(document.url, document.name).catch((error) =>
                              toast.error(
                                error instanceof Error ? error.message : "Falha ao baixar arquivo",
                              ),
                            );
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Excluir documento"
                          onClick={() => removeDocument(document.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="border-t bg-secondary/30 p-4 sm:p-6 md:border-l md:border-t-0">
            <div className="sticky top-0 space-y-4">
              <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Preview
                  </span>
                  <span
                    className="rounded px-2 py-1 text-[10px] font-bold"
                    style={{ background: statusMeta.softColor, color: statusMeta.color }}
                  >
                    {statusMeta.label}
                  </span>
                </div>
                {draft.isRentalEquipment && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-emerald-600/10 px-2 py-1 text-[10px] font-bold text-emerald-700">
                      Equipamento de locação
                    </span>
                    {parsedRentalValue !== undefined && (
                      <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-secondary-foreground">
                        {formatCurrencyBRL(parsedRentalValue)} {periodSuffix}
                      </span>
                    )}
                  </div>
                )}
                <div
                  className="mb-4 flex h-28 items-center justify-center overflow-hidden rounded-lg text-primary-foreground"
                  style={{ background: statusMeta.softColor, color: draft.color }}
                >
                  <AssetIcon
                    item={draft}
                    className="h-full w-full object-contain p-4"
                    fallbackSize={56}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold">{draft.name || "Novo item"}</h3>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                    {draft.description || "Descrição técnica do item."}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: selectedCategory?.color ?? draft.color }}
                    />
                    {selectedCategory?.name ?? "Sem categoria"}
                  </div>
                </div>
              </div>

              <div>
                <Label>Cor / Tag</Label>
                <div className="mt-2 grid grid-cols-6 gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setDraft({ ...draft, color })}
                      className={`h-8 rounded-md border-2 ${
                        draft.color === color ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ background: color }}
                      title="Selecionar cor"
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label>Ícone / imagem do item (PNG)</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Anexe um PNG/JPG. É usado como ícone do item no quadro e no inventário.
                </p>
                <label
                  aria-disabled={uploadingImage}
                  className={`mt-2 flex items-center gap-2 rounded-lg border border-dashed bg-card px-3 py-3 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground ${
                    uploadingImage ? "pointer-events-none opacity-60" : "cursor-pointer"
                  }`}
                >
                  {uploadingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageUp className="h-4 w-4" />
                  )}
                  {uploadingImage
                    ? "Enviando…"
                    : draft.imageUrl
                      ? "Trocar imagem"
                      : "Anexar imagem"}
                  <Input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={uploadingImage}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      setUploadingImage(true);
                      try {
                        const previousPath = draft.imagePath;
                        const { url, path } = await uploadAssetFile(file, "images");
                        // Custom image becomes the icon; drop predefined per-status icons
                        // so it is not overwritten on save/status change.
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                imageUrl: url,
                                imagePath: path,
                                statusImageUrls: undefined,
                              }
                            : current,
                        );
                        void removeAssetFile(previousPath);
                        toast.success("Imagem anexada");
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Falha ao anexar imagem",
                        );
                      } finally {
                        setUploadingImage(false);
                      }
                    }}
                  />
                </label>
                {draft.imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 text-destructive hover:text-destructive"
                    disabled={uploadingImage}
                    onClick={() => {
                      const previousPath = draft.imagePath;
                      setDraft({ ...draft, imageUrl: undefined, imagePath: undefined });
                      void removeAssetFile(previousPath);
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remover imagem
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>

        <DialogFooter className="sticky bottom-0 z-10 border-t bg-card px-4 py-3 sm:px-6 sm:py-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave({
                ...draft,
                rentalValue: draft.isRentalEquipment ? parsedRentalValue : undefined,
                rentalPeriod: draft.isRentalEquipment ? rentalPeriod : undefined,
              })
            }
            disabled={uploadingDoc || uploadingImage || !rentalValueIsValid}
          >
            Salvar item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

