import { useEffect, useState } from "react";
import { AlertTriangle, Building2, ExternalLink, Loader2, MapPin, Plus, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import type { BoardLocationType, BoardRow, TeamMember } from "../lib/board-types";
import { extractCoordsFromMapsUrl, geocodeAddress, isLikelyMapsUrl, normalizeMapsUrl } from "../lib/maps";
import { getRowColor } from "../lib/row-color";

const STATUS_LABEL: Record<BoardRow["status"], string> = {
  planning: "Planejamento",
  active: "Em operação",
  waiting: "Aguardando",
  done: "Concluída",
};

const MEMBER_COLORS = [
  "oklch(0.55 0.18 250)",
  "oklch(0.58 0.14 185)",
  "oklch(0.62 0.16 155)",
  "oklch(0.65 0.18 25)",
  "oklch(0.60 0.18 320)",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function RowEditor({
  open,
  row,
  teamMembers,
  onClose,
  onSave,
  onCreateTeamMember,
  canCreateTeamMember,
}: {
  open: boolean;
  row: BoardRow | null;
  teamMembers: TeamMember[];
  onClose: () => void;
  onSave: (row: BoardRow) => void;
  onCreateTeamMember: (member: Omit<TeamMember, "id">) => Promise<TeamMember | null>;
  canCreateTeamMember: boolean;
}) {
  const [draft, setDraft] = useState<BoardRow | null>(row);
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [memberPhotoUrl, setMemberPhotoUrl] = useState("");
  const [memberColor, setMemberColor] = useState(MEMBER_COLORS[0]);
  const [pendingAllocateMemberId, setPendingAllocateMemberId] = useState<string | null>(null);
  const [coordsHint, setCoordsHint] = useState<"ok" | "fail" | "geo-fail" | "geo-error" | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  async function geocodeFromAddress() {
    if (!draft) return;
    const address = draft.description?.trim();
    if (!address) {
      setCoordsHint("geo-fail");
      return;
    }
    setGeocoding(true);
    setCoordsHint(null);
    try {
      const coords = await geocodeAddress(address);
      if (coords) {
        setDraft({ ...draft, lat: coords.lat, lng: coords.lng });
        setCoordsHint("ok");
      } else {
        setCoordsHint("geo-fail");
      }
    } catch {
      setCoordsHint("geo-error");
    } finally {
      setGeocoding(false);
    }
  }

  useEffect(() => setDraft(row), [row]);

  if (!draft) return null;
  const locationType = draft.locationType ?? "worksite";
  const isYard = locationType === "yard";
  const autoColor = getRowColor(draft);

  const integrated = draft.integratedMemberIds ?? [];

  function toggleIntegrated(memberId: string) {
    if (!draft) return;
    const isIn = integrated.includes(memberId);
    const nextIntegrated = isIn
      ? integrated.filter((id) => id !== memberId)
      : [...integrated, memberId];
    // remove from alocada if no longer integrated
    const nextAllocated = isIn
      ? draft.teamMemberIds.filter((id) => id !== memberId)
      : draft.teamMemberIds;
    setDraft({ ...draft, integratedMemberIds: nextIntegrated, teamMemberIds: nextAllocated });
  }

  function toggleMember(memberId: string) {
    if (!draft) return;
    const selected = draft.teamMemberIds.includes(memberId);
    setDraft({
      ...draft,
      teamMemberIds: selected
        ? draft.teamMemberIds.filter((id) => id !== memberId)
        : [...draft.teamMemberIds, memberId],
    });
  }

  async function addMember() {
    if (!draft) return;
    const cleanName = memberName.trim();
    if (!cleanName) return;
    const member = await onCreateTeamMember({
      name: cleanName,
      role: memberRole.trim() || "Equipe",
      photoUrl: memberPhotoUrl.trim() || undefined,
      color: memberColor,
    });
    if (!member) return;
    setDraft({ ...draft, teamMemberIds: [...draft.teamMemberIds, member.id] });
    setMemberName("");
    setMemberRole("");
    setMemberPhotoUrl("");
    setMemberColor(MEMBER_COLORS[0]);
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto p-0 sm:max-h-[92dvh]">
        <DialogHeader className="border-b bg-secondary/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-lg text-primary-foreground"
              style={{ background: autoColor }}
            >
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Cadastro do local</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Personalize o card que organiza os itens.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-[1fr_230px]">
          <div className="space-y-4 p-6">
            <div>
              <Label>Nome do local/frente</Label>
              <Input
                className="mt-1"
                value={draft.name}
                placeholder="Ex.: Obra BH - Placa"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                className="mt-1 min-h-24"
                value={draft.description}
                placeholder="Equipe, janela de operação, observações ou local."
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>

            <div>
              <Label>Link do Google Maps</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  value={draft.mapsUrl ?? ""}
                  placeholder="Cole o link do Google Maps"
                  onChange={(event) =>
                    setDraft({ ...draft, mapsUrl: event.target.value || undefined })
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="Abrir no Google Maps"
                  disabled={!draft.mapsUrl?.trim()}
                  onClick={() => {
                    const href = normalizeMapsUrl(draft.mapsUrl);
                    if (href) window.open(href, "_blank", "noopener,noreferrer");
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              {draft.mapsUrl?.trim() && !isLikelyMapsUrl(draft.mapsUrl) && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                  <MapPin className="h-3 w-3" />
                  Não parece um link do Google Maps — confira antes de salvar.
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Label className="text-xs text-muted-foreground">Latitude</Label>
                  <Input
                    className="mt-1"
                    inputMode="decimal"
                    placeholder="-19.92"
                    value={draft.lat ?? ""}
                    onChange={(event) => {
                      const v = event.target.value.trim();
                      setDraft({ ...draft, lat: v === "" ? undefined : Number(v) });
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Label className="text-xs text-muted-foreground">Longitude</Label>
                  <Input
                    className="mt-1"
                    inputMode="decimal"
                    placeholder="-43.94"
                    value={draft.lng ?? ""}
                    onChange={(event) => {
                      const v = event.target.value.trim();
                      setDraft({ ...draft, lng: v === "" ? undefined : Number(v) });
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={!draft.mapsUrl?.trim()}
                  onClick={() => {
                    const coords = extractCoordsFromMapsUrl(draft.mapsUrl);
                    setCoordsHint(coords ? "ok" : "fail");
                    if (coords) setDraft({ ...draft, lat: coords.lat, lng: coords.lng });
                  }}
                >
                  <MapPin className="mr-1 h-3.5 w-3.5" />
                  Extrair do link
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={geocoding || !draft.description?.trim()}
                onClick={geocodeFromAddress}
              >
                {geocoding ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="mr-1 h-3.5 w-3.5" />
                )}
                Buscar coordenadas pelo endereço
              </Button>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Usa o texto da <strong>descrição</strong> como endereço (ex.: rua, número, cidade, UF).
              </p>
              {coordsHint === "fail" && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Link curto (maps.app.goo.gl) não tem coordenada. Abra no Maps, copie o link
                  completo (com @lat,lng) ou use a busca por endereço.
                </p>
              )}
              {coordsHint === "geo-fail" && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Endereço não encontrado. Detalhe melhor (rua, número, cidade, UF) ou informe
                  lat/long manualmente.
                </p>
              )}
              {coordsHint === "geo-error" && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Falha ao consultar o serviço de endereços. Tente de novo em instantes.
                </p>
              )}
              {coordsHint === "ok" && (
                <p className="mt-1 text-[11px] text-emerald-600">Coordenadas definidas ✓</p>
              )}
            </div>

            <div>
              <Label>Tipo de local</Label>
              <Select
                value={locationType}
                onValueChange={(value) =>
                  setDraft({ ...draft, locationType: value as BoardLocationType })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="worksite">Obra</SelectItem>
                  <SelectItem value="yard">Pátio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isYard && (
              <div>
                <Label>Status da obra</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) =>
                    setDraft({ ...draft, status: value as BoardRow["status"] })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planejamento</SelectItem>
                    <SelectItem value="active">Em operação</SelectItem>
                    <SelectItem value="waiting">Aguardando</SelectItem>
                    <SelectItem value="done">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Equipe integrada */}
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <Label>Equipe integrada</Label>
              </div>
              <p className="op-label mb-3 text-[10px] text-muted-foreground">
                Pessoas autorizadas pela segurança do trabalho a entrar neste local.
              </p>
              <div className="max-h-[min(14rem,28dvh)] space-y-2 overflow-y-auto pr-1">
                {teamMembers.map((member) => {
                  const isIntegrated = integrated.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        isIntegrated ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleIntegrated(member.id)}
                    >
                      <Checkbox checked={isIntegrated} className="pointer-events-none" />
                      <Avatar className="h-8 w-8">
                        {member.photoUrl && <AvatarImage src={member.photoUrl} alt={member.name} />}
                        <AvatarFallback
                          className="op-label text-[10px] font-bold text-primary-foreground"
                          style={{ background: member.color }}
                        >
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{member.name}</div>
                        <div className="op-label truncate text-[10px] text-muted-foreground">{member.role}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {canCreateTeamMember && <div className="mt-4 rounded-lg border border-dashed bg-muted/20 p-3">
                <div className="mb-3 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <span className="op-label text-[10px] font-bold text-muted-foreground">Adicionar perfil</span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    placeholder="Nome"
                  />
                  <Input
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value)}
                    placeholder="Funcao"
                  />
                </div>
                <Input
                  className="mt-2"
                  value={memberPhotoUrl}
                  onChange={(event) => setMemberPhotoUrl(event.target.value)}
                  placeholder="URL da foto, opcional"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex gap-1.5">
                    {MEMBER_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-6 w-6 rounded-full border-2 ${
                          memberColor === color ? "border-foreground" : "border-card"
                        }`}
                        style={{ background: color }}
                        onClick={() => setMemberColor(color)}
                        title="Cor do perfil"
                      />
                    ))}
                  </div>
                  <Button type="button" size="sm" onClick={addMember} disabled={!memberName.trim()}>
                    <Plus className="h-4 w-4" />
                    Perfil
                  </Button>
                </div>
              </div>}
            </div>

            {/* Equipe alocada */}
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-1 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label>Equipe alocada</Label>
              </div>
              <p className="op-label mb-3 text-[10px] text-muted-foreground">
                Quem vai para o local. Não integrados exigem confirmação.
              </p>
              <div className="max-h-[min(14rem,28dvh)] space-y-2 overflow-y-auto pr-1">
                {teamMembers.map((member) => {
                  const selected = draft.teamMemberIds.includes(member.id);
                  const isIntegrated = integrated.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                        selected && isIntegrated
                          ? "border-primary bg-primary/5"
                          : selected && !isIntegrated
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                            : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        if (isIntegrated) {
                          toggleMember(member.id);
                        } else if (!selected) {
                          setPendingAllocateMemberId(member.id);
                        } else {
                          toggleMember(member.id);
                        }
                      }}
                    >
                      <Checkbox checked={selected} className="pointer-events-none" />
                      <Avatar className="h-8 w-8">
                        {member.photoUrl && <AvatarImage src={member.photoUrl} alt={member.name} />}
                        <AvatarFallback
                          className="op-label text-[10px] font-bold text-primary-foreground"
                          style={{ background: member.color }}
                        >
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{member.name}</div>
                        <div className="op-label truncate text-[10px] text-muted-foreground">{member.role}</div>
                      </div>
                      {!isIntegrated && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="border-t bg-secondary/30 p-6 md:border-l md:border-t-0">
            <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
                Preview
              </div>
              <div className="overflow-hidden rounded-lg border">
                <div className="flex">
                  <div className="w-1.5 shrink-0" style={{ background: autoColor }} />
                  <div className="min-w-0 flex-1 p-3">
                    <div className="truncate text-sm font-bold">
                      {draft.name || (isYard ? "Novo pátio" : "Nova obra")}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {draft.description || "Descrição do local"}
                    </div>
                    <span
                      className="mt-3 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary-foreground"
                      style={{ background: autoColor }}
                    >
                      {isYard ? "Pátio" : STATUS_LABEL[draft.status]}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label>Cor do card</Label>
              <div className="mt-2 flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                <span
                  className="h-5 w-5 shrink-0 rounded-full"
                  style={{ background: autoColor }}
                />
                <span className="text-xs text-muted-foreground">
                  Definida automaticamente pelo {isYard ? "tipo (Pátio)" : "status"}.
                </span>
              </div>
            </div>
          </aside>
        </div>

        <DialogFooter className="sticky bottom-0 border-t bg-card px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave({ ...draft, color: autoColor })}>Salvar local</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={pendingAllocateMemberId !== null}
      onOpenChange={(open) => { if (!open) setPendingAllocateMemberId(null); }}
    >
      <AlertDialogContent className="w-[calc(100%-2rem)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Funcionário não integrado
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingAllocateMemberId
              ? `${teamMembers.find((m) => m.id === pendingAllocateMemberId)?.name} não está integrado nesta obra. Está ciente que quer continuar?`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setPendingAllocateMemberId(null)}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-500 text-white hover:bg-amber-600"
            onClick={() => {
              if (pendingAllocateMemberId) toggleMember(pendingAllocateMemberId);
              setPendingAllocateMemberId(null);
            }}
          >
            Alocar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}


