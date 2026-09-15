import { initialTeamMembers } from "./board-data";
import type { TeamMember } from "./board-types";
import { isSupabaseConfigured, supabase } from "../../../lib/supabaseClient";

const STORAGE_KEY = "geoteste.asset-planner.collaborators.v1";

function readCollaborators(): TeamMember[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [...initialTeamMembers];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as TeamMember[]) : [...initialTeamMembers];
  } catch {
    return [...initialTeamMembers];
  }
}

function writeCollaborators(collaborators: TeamMember[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collaborators));
}

export async function getCollaborators(): Promise<TeamMember[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from("planner_collaborators")
      .select("id,name,role,color,photo_url,email,user_id,is_admin,can_add,can_edit,can_move,can_manage_collaborators,active")
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((member) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      color: member.color,
      photoUrl: member.photo_url ?? undefined,
      email: member.email ?? undefined,
      userId: member.user_id ?? undefined,
      isAdmin: member.is_admin,
      canAdd: member.can_add,
      canEdit: member.can_edit,
      canMove: member.can_move,
      canManageCollaborators: member.can_manage_collaborators,
      active: member.active,
    }));
  }

  return readCollaborators();
}

export async function upsertCollaborator(member: TeamMember): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from("planner_collaborators").upsert(
      {
        id: member.id,
        name: member.name,
        role: member.role,
        color: member.color,
        photo_url: member.photoUrl ?? null,
        email: member.email ?? null,
        user_id: member.userId ?? null,
        is_admin: member.isAdmin ?? false,
        can_add: member.canAdd ?? true,
        can_edit: member.canEdit ?? false,
        can_move: member.canMove ?? false,
        can_manage_collaborators: member.canManageCollaborators ?? false,
        active: member.active ?? true,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return;
  }

  const collaborators = readCollaborators();
  const index = collaborators.findIndex((candidate) => candidate.id === member.id);
  if (index >= 0) collaborators[index] = member;
  else collaborators.push(member);
  writeCollaborators(collaborators);
}

export async function deleteCollaborator(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from("planner_collaborators")
      .update({ active: false })
      .eq("id", id);
    if (error) throw error;
    return;
  }

  writeCollaborators(
    readCollaborators().map((member) =>
      member.id === id ? { ...member, active: false } : member,
    ),
  );
}
