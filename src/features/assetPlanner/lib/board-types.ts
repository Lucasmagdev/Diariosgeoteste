export type ItemCategory = {
  id: string;
  name: string;
  color: string; // tailwind-ish accent expressed as oklch token chunk
  isGroup?: boolean; // optional top-level grouping for categories
  groupId?: string; // if set, this category belongs to a group
  iconUrl?: string; // optional PNG/image icon for the category
};

export type BoardItemStatus = "maintenance" | "acquisition" | "available" | "on_site";
export type BoardLocationType = "worksite" | "yard";

export type AssetDocumentType =
  | "calibration_certificate"
  | "maintenance_report"
  | "invoice"
  | "manual"
  | "photo"
  | "other";

export type RentalPeriod = "daily" | "weekly" | "biweekly" | "monthly";

export const DEFAULT_RENTAL_PERIOD: RentalPeriod = "monthly";

export const RENTAL_PERIODS: RentalPeriod[] = ["daily", "weekly", "biweekly", "monthly"];

/** Full label, e.g. for selects. */
export const RENTAL_PERIOD_LABELS: Record<RentalPeriod, string> = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

/** Short suffix for badges/values, e.g. "Locação/mês". */
export const RENTAL_PERIOD_SUFFIX: Record<RentalPeriod, string> = {
  daily: "/dia",
  weekly: "/sem",
  biweekly: "/quinz.",
  monthly: "/mês",
};

export function rentalPeriodSuffix(period?: RentalPeriod): string {
  return RENTAL_PERIOD_SUFFIX[period ?? DEFAULT_RENTAL_PERIOD];
}

export type AssetDocument = {
  id: string;
  name: string;
  type: AssetDocumentType;
  url: string;
  path?: string; // Storage path inside the asset-files bucket (for deletion)
  expiryDate?: string; // ISO date YYYY-MM-DD
};

export type BoardItem = {
  id: string;
  status: BoardItemStatus;
  name: string;
  description: string;
  categoryId: string;
  iconSvg: string; // raw svg path d or full svg markup
  color: string;
  imageUrl?: string;
  imagePath?: string; // Storage path inside the asset-files bucket (for deletion)
  statusImageUrls?: Partial<Record<BoardItemStatus, string>>;
  expiryDate?: string; // ISO date YYYY-MM-DD
  isRentalEquipment?: boolean;
  rentalValue?: number;
  rentalPeriod?: RentalPeriod;
  assetCode?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  lastMaintenanceDate?: string; // ISO date YYYY-MM-DD
  expectedReturnDate?: string; // ISO date YYYY-MM-DD
  maintenanceReason?: string;
  maintenanceProvider?: string;
  maintenanceReturnDate?: string; // ISO date YYYY-MM-DD
  documents?: AssetDocument[];
  stockQuantity?: number; // total pooled quantity for bulk-created items (e.g. 200 helicoides)
};

export type BoardRow = {
  id: string;
  name: string;
  description: string;
  status: "planning" | "active" | "waiting" | "done";
  locationType?: BoardLocationType;
  mapsUrl?: string; // Google Maps link (any format)
  lat?: number; // latitude for the map pin
  lng?: number; // longitude for the map pin
  color: string;
  itemIds: string[]; // instance ids
  teamMemberIds: string[]; // quem vai (alocada)
  integratedMemberIds?: string[]; // quem pode entrar (integrada)
};

export type PlacedInstance = {
  instanceId: string;
  itemId: string;
  rowId: string;
  quantity?: number; // set when the item is stock-pooled (BoardItem.stockQuantity is set)
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  photoUrl?: string;
  color: string;
  email?: string;
  userId?: string;
  isAdmin?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canMove?: boolean;
  canManageCollaborators?: boolean;
  active?: boolean;
};

export type MemberCapability = "add" | "edit" | "move" | "manage_collaborators";

export function memberCan(member: TeamMember | null | undefined, capability: MemberCapability) {
  if (!member) return false;
  if (member.isAdmin) return true;
  if (capability === "add") return member.canAdd ?? true;
  if (capability === "edit") return member.canEdit ?? false;
  if (capability === "move") return member.canMove ?? false;
  return member.canManageCollaborators ?? false;
}


