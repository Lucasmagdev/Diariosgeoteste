import type { PlannerLayout } from "./planner-layout";
import { DEFAULT_LAYOUT } from "./planner-layout";
import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

export type PlannerCapability = "add" | "edit" | "move";

const STORAGE_KEY = "geoteste.asset-planner.layout.v1";

function cloneDefaultLayout(): PlannerLayout {
  return JSON.parse(JSON.stringify(DEFAULT_LAYOUT)) as PlannerLayout;
}

function isPlannerLayout(value: unknown): value is PlannerLayout {
  if (!value || typeof value !== "object") return false;
  const layout = value as Partial<PlannerLayout>;
  return (
    Array.isArray(layout.categories) &&
    Array.isArray(layout.items) &&
    Array.isArray(layout.rows) &&
    Array.isArray(layout.instances)
  );
}

export async function getPlannerLayout(): Promise<PlannerLayout> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("planner_layouts")
      .select("payload")
      .eq("id", "default")
      .maybeSingle();

    if (error) throw error;
    return isPlannerLayout(data?.payload) ? data.payload : cloneDefaultLayout();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return cloneDefaultLayout();
    const parsed: unknown = JSON.parse(stored);
    return isPlannerLayout(parsed) ? parsed : cloneDefaultLayout();
  } catch {
    return cloneDefaultLayout();
  }
}

export async function savePlannerLayout(
  layout: PlannerLayout,
  capability: PlannerCapability,
): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from("planner_layouts").upsert(
      {
        id: "default",
        payload: layout,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return;
  }

  void capability;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}
