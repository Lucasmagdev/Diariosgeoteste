import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import type { TeamMember } from "../lib/board-types";

const MEMBER_COLORS = [
  "oklch(0.55 0.18 250)",
  "oklch(0.58 0.14 185)",
  "oklch(0.62 0.16 155)",
  "oklch(0.65 0.18 25)",
  "oklch(0.60 0.18 320)",
  "oklch(0.78 0.16 75)",
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const EMPTY_FORM = {
  name: "",
  role: "",
  email: "",
  photoUrl: "",
  color: MEMBER_COLORS[0],
  isAdmin: false,
  canAdd: true,
  canEdit: false,
  canMove: false,
  canManageCollaborators: false,
  active: true,
};

export function CollaboratorsPanel({
  open,
  collaborators,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  canManage,
  canDelegateAdmin,
  currentMemberId,
}: {
  open: boolean;
  collaborators: TeamMember[];
  onClose: () => void;
  onAdd: (member: Omit<TeamMember, "id">) => void;
  onUpdate: (member: TeamMember) => void;
  onDelete: (id: string) => void;
  canManage: boolean;
  canDelegateAdmin: boolean;
  currentMemberId: string;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
  }

  function handleEdit(member: TeamMember) {
    setEditing(member);
    // Form sits at the top of the dialog; bring it into view so the edit is visible.
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInputRef.current?.focus();
    });
    setForm({
      name: member.name,
      role: member.role,
      email: member.email ?? "",
      photoUrl: member.photoUrl ?? "",
      color: member.color,
      isAdmin: member.isAdmin ?? false,
      canAdd: member.canAdd ?? true,
      canEdit: member.canEdit ?? false,
      canMove: member.canMove ?? false,
      canManageCollaborators: member.canManageCollaborators ?? false,
      active: member.active ?? true,
    });
  }

  function handleSubmit() {
    const cleanName = form.name.trim();
    if (!cleanName) return;

    if (editing) {
      onUpdate({
        ...editing,
        name: cleanName,
        role: form.role.trim() || "Colaborador",
        email: form.email.trim() || undefined,
        photoUrl: form.photoUrl.trim() || undefined,
        color: form.color,
        isAdmin: form.isAdmin,
        canAdd: form.isAdmin || form.canAdd,
        canEdit: form.isAdmin || form.canEdit,
        canMove: form.isAdmin || form.canMove,
        canManageCollaborators: form.isAdmin || form.canManageCollaborators,
        active: form.active,
      });
    } else {
      onAdd({
        name: cleanName,
        role: form.role.trim() || "Colaborador",
        email: form.email.trim() || undefined,
        photoUrl: form.photoUrl.trim() || undefined,
        color: form.color,
        isAdmin: form.isAdmin,
        canAdd: form.isAdmin || form.canAdd,
        canEdit: form.isAdmin || form.canEdit,
        canMove: form.isAdmin || form.canMove,
        canManageCollaborators: form.isAdmin || form.canManageCollaborators,
        active: form.active,
      });
    }
    resetForm();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b bg-secondary/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Colaboradores</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {canManage ? "Cadastre usuarios e defina suas permissoes." : "Consulte os membros da equipe."}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Form */}
          {canManage && <div ref={formRef} className="rounded-lg border bg-muted/20 p-4 space-y-3 scroll-mt-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {editing ? `Editar colaborador: ${editing.name}` : "Novo colaborador"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input
                  ref={nameInputRef}
                  className="mt-1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome completo"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
              <div>
                <Label className="text-xs">Função</Label>
                <Input
                  className="mt-1"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Ex.: Encarregado, Técnico"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">E-mail de login</Label>
              <Input
                className="mt-1"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="colaborador@empresa.com"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Com acesso ativo, este e-mail sera liberado quando o usuario solicitar acesso.
              </p>
            </div>
            <div>
              <Label className="text-xs">URL da foto (opcional)</Label>
              <Input
                className="mt-1"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2 rounded-md border bg-card p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Permissoes</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
                />
                Acesso ativo ao sistema
              </label>
              {[
                ["isAdmin", "Administrador (controle total)"],
                ["canAdd", "Adicionar locais, itens e categorias"],
                ["canEdit", "Editar e excluir registros"],
                ["canMove", "Mover itens entre locais"],
                ["canManageCollaborators", "Gerenciar colaboradores"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(form[key as keyof typeof form])}
                    disabled={
                      (form.isAdmin && key !== "isAdmin") ||
                      (!canDelegateAdmin && (key === "isAdmin" || key === "canManageCollaborators"))
                    }
                    onCheckedChange={(checked) =>
                      setForm({ ...form, [key]: checked === true })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-xs">Cor</Label>
                <div className="flex gap-1.5">
                  {MEMBER_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${
                        form.color === color ? "border-foreground scale-110" : "border-card"
                      }`}
                      style={{ background: color }}
                      onClick={() => setForm({ ...form, color })}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {editing && (
                  <Button variant="outline" size="sm" onClick={resetForm}>
                    Cancelar
                  </Button>
                )}
                <Button size="sm" onClick={handleSubmit} disabled={!form.name.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  {editing ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </div>
          </div>}

          {/* List */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {collaborators.length} cadastrados
            </p>
            {collaborators.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum colaborador cadastrado ainda.
              </p>
            )}
            {collaborators.map((member) => (
              <div
                key={member.id}
                className={`flex items-center gap-3 rounded-lg border bg-card px-3 py-2 transition-opacity ${
                  member.active === false ? "opacity-50" : ""
                }`}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  {member.photoUrl && <AvatarImage src={member.photoUrl} alt={member.name} />}
                  <AvatarFallback
                    className="text-[11px] font-bold text-primary-foreground"
                    style={{ background: member.color }}
                  >
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{member.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.role}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {!member.active ? "Acesso pendente / inativo" : !member.userId ? "Liberado - aguardando cadastro" : member.isAdmin ? "Administrador" : [
                      member.canAdd ?? true ? "Adicionar" : null,
                      member.canEdit ? "Editar" : null,
                      member.canMove ? "Mover" : null,
                    ].filter(Boolean).join(" / ") || "Somente consulta"}
                  </p>
                </div>
                {canManage && <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleEdit(member)}
                    disabled={!canDelegateAdmin && Boolean(member.isAdmin || member.canManageCollaborators)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(member.id)}
                    disabled={
                      member.id === currentMemberId ||
                      (!canDelegateAdmin && Boolean(member.isAdmin || member.canManageCollaborators))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


