import type { BoardItem, BoardRow, ItemCategory, PlacedInstance, TeamMember } from "./board-types";
import { localIconAssets } from "./icon-assets";

export const initialCategories: ItemCategory[] = [
  { id: "cravacao", name: "Cravação", color: "oklch(0.55 0.18 250)" },
  { id: "perfuracao", name: "Perfuração", color: "oklch(0.58 0.14 185)" },
  { id: "vigas", name: "Conjunto de vigas", color: "oklch(0.62 0.16 155)" },
  { id: "helicoides", name: "Conjunto de helicoides", color: "oklch(0.70 0.16 50)" },
  { id: "pecas", name: "Componentes", color: "oklch(0.60 0.18 320)" },
  { id: "apoio", name: "Apoio e segurança", color: "oklch(0.65 0.18 25)" },
  { id: "instrumentacao", name: "Instrumentação", color: "oklch(0.52 0.12 285)" },
];

const COG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

export const initialItems: BoardItem[] = [
  ...localIconAssets.map((asset) => ({
    id: `i-${asset.id}`,
    status: "available" as const,
    name: `${asset.code} - ${asset.name}`,
    description: "DISPONIVEL",
    categoryId: asset.categoryId,
    iconSvg: COG,
    color:
      initialCategories.find((category) => category.id === asset.categoryId)?.color ??
      "oklch(0.55 0.18 250)",
    imageUrl: asset.imageUrl,
    statusImageUrls: asset.statusImageUrls,
  })),
];

export const initialRows: BoardRow[] = [
  {
    id: "row-bh-placa",
    name: "Obra BH - Placa",
    description: "Equipe A · janela 07:00-17:00",
    status: "active",
    color: "oklch(0.55 0.18 250)",
    itemIds: [],
    teamMemberIds: ["tm-marcos", "tm-ana", "tm-joao"],
  },
  {
    id: "row-bh-arr",
    name: "Obra BH - Arrancamento",
    description: "Aguardando liberação de área",
    status: "waiting",
    color: "oklch(0.78 0.16 75)",
    itemIds: [],
    teamMemberIds: ["tm-bruna", "tm-joao"],
  },
  {
    id: "row-sp-placa",
    name: "Obra SP - Placa",
    description: "Frente em preparação para troca de item",
    status: "planning",
    color: "oklch(0.58 0.14 185)",
    itemIds: [],
    teamMemberIds: ["tm-ana"],
  },
  {
    id: "row-sp-arr",
    name: "Obra SP - Arrancamento",
    description: "Turno noturno com apoio de içamento",
    status: "active",
    color: "oklch(0.62 0.16 155)",
    itemIds: [],
    teamMemberIds: ["tm-marcos", "tm-bruna"],
  },
  {
    id: "row-rj-raiz",
    name: "Obra RJ - Estaca raiz",
    description: "Perfuração e compressor dedicados",
    status: "active",
    color: "oklch(0.60 0.18 320)",
    itemIds: [],
    teamMemberIds: ["tm-joao"],
  },
];

export const initialInstances: PlacedInstance[] = [];

export const initialTeamMembers: TeamMember[] = [
  { id: "tm-marcos", name: "Marcos Lima", role: "Encarregado", color: "oklch(0.55 0.18 250)" },
  { id: "tm-ana", name: "Ana Souza", role: "Operadora", color: "oklch(0.58 0.14 185)" },
  { id: "tm-joao", name: "Joao Pedro", role: "Tecnico", color: "oklch(0.62 0.16 155)" },
  { id: "tm-bruna", name: "Bruna Costa", role: "Apoio", color: "oklch(0.65 0.18 25)" },
];


