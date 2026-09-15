import { useState } from "react";
import { UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import type { TeamMember } from "../lib/board-types";
import { setActor } from "../lib/actor-identity";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function ActorPicker({
  teamMembers,
  onConfirm,
}: {
  teamMembers: TeamMember[];
  onConfirm: (name: string) => void;
}) {
  const [customName, setCustomName] = useState("");

  function confirm(name: string) {
    const clean = name.trim();
    if (!clean) return;
    setActor(clean);
    onConfirm(clean);
  }

  return (
    <Dialog open>
      <DialogContent className="max-w-sm p-0" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="border-b bg-secondary/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Quem é você?</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Suas ações ficam registradas no histórico.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-6">
          {teamMembers.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Selecionar da equipe</p>
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {teamMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-muted/60"
                    onClick={() => confirm(m.name)}
                  >
                    <Avatar className="h-8 w-8">
                      {m.photoUrl && <AvatarImage src={m.photoUrl} alt={m.name} />}
                      <AvatarFallback
                        className="text-[10px] font-bold text-primary-foreground"
                        style={{ background: m.color }}
                      >
                        {getInitials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{m.name}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{m.role}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Ou digite seu nome</p>
            <div className="flex gap-2">
              <Input
                placeholder="Seu nome"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirm(customName)}
              />
              <Button onClick={() => confirm(customName)} disabled={!customName.trim()}>
                Entrar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


