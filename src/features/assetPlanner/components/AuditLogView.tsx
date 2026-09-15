import { useEffect, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { getRecentAuditLog, type AuditEntry } from "../lib/audit-log";

const ACTION_LABELS: Record<string, string> = {
  criou_local: "criou local",
  editou_local: "editou local",
  excluiu_local: "excluiu local",
  criou_item: "criou item",
  editou_item: "editou item",
  excluiu_item: "excluiu item",
  moveu_item: "moveu item",
  removeu_item: "removeu item do quadro",
  atualizou_status: "atualizou status",
  duplicou_item: "duplicou item",
  reclassificou_item: "mudou categoria do item",
  reordenou_item: "reordenou item",
  organizou_categoria: "moveu categoria de grupo",
  resetou_local: "resetou local",
  editou_equipe: "editou equipe do local",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const ACTOR_COLORS = [
  "oklch(0.55 0.18 250)",
  "oklch(0.58 0.14 185)",
  "oklch(0.62 0.16 155)",
  "oklch(0.65 0.18 25)",
  "oklch(0.60 0.18 320)",
  "oklch(0.55 0.10 220)",
];

function actorColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return ACTOR_COLORS[hash % ACTOR_COLORS.length];
}

export function AuditLogView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await getRecentAuditLog(200);
    setEntries(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="op-title text-xl font-bold">Histórico</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro de quem fez o quê e quando.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {!loading && entries.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Clock className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
        </div>
      )}

      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition hover:bg-muted/40"
          >
            <div
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground"
              style={{ background: actorColor(entry.actor_name) }}
            >
              {getInitials(entry.actor_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
                <span className="font-bold">{entry.actor_name}</span>
                <span className="text-muted-foreground">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                {entry.entity_name && (
                  <span className="font-semibold">"{entry.entity_name}"</span>
                )}
                {entry.detail && (
                  <span className="text-muted-foreground">— {entry.detail}</span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {formatDate(entry.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


