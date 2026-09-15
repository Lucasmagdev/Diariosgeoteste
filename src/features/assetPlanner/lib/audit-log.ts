import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

export type AuditEntry = {
  id: number;
  created_at: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_name: string | null;
  detail: string | null;
};

const STORAGE_KEY = "geoteste.asset-planner.audit.v1";

function readEntries(): AuditEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

export async function logAction(
  action: string,
  entityType: string,
  entityName?: string,
  detail?: string,
  actorName = "Usuário Geoteste",
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from("planner_audit_log").insert({
      actor_name: actorName,
      action,
      entity_type: entityType,
      entity_name: entityName ?? null,
      detail: detail ?? null,
    });
    if (error) throw error;
    return;
  }

  const entries = readEntries();
  entries.unshift({
    id: Date.now(),
    created_at: new Date().toISOString(),
    actor_name: actorName,
    action,
    entity_type: entityType,
    entity_name: entityName ?? null,
    detail: detail ?? null,
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 500)));
}

export async function getRecentAuditLog(limit = 100): Promise<AuditEntry[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("planner_audit_log")
      .select("id,created_at,actor_name,action,entity_type,entity_name,detail")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AuditEntry[];
  }

  return readEntries().slice(0, limit);
}
