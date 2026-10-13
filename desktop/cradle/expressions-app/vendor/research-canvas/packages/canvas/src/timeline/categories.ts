import type { GraphNode } from "./contracts";
import { CATEGORY_COLOUR } from "./palette";

export type TimelineCategory =
  | "historical-event"
  | "claim"
  | "interpretation"
  | "archetype"
  | "myth-in-time"
  | "myth"
  | "speculation-contested"
  | "source"
  | "book-writing"
  | "constellation"
  | "institution-network-figure";

export interface TimelineCategoryDefinition {
  id: TimelineCategory;
  label: string;
  color: string;
  background: string;
}

export const TIMELINE_CATEGORIES: readonly TimelineCategoryDefinition[] = [
  { id: "historical-event", label: "Historical event", color: CATEGORY_COLOUR["historical-event"].color, background: CATEGORY_COLOUR["historical-event"].background },
  { id: "claim", label: "Claim", color: CATEGORY_COLOUR["claim"].color, background: CATEGORY_COLOUR["claim"].background },
  { id: "interpretation", label: "Interpretation", color: CATEGORY_COLOUR["interpretation"].color, background: CATEGORY_COLOUR["interpretation"].background },
  { id: "archetype", label: "Archetype", color: CATEGORY_COLOUR["archetype"].color, background: CATEGORY_COLOUR["archetype"].background },
  { id: "myth-in-time", label: "Myth in time", color: CATEGORY_COLOUR["myth-in-time"].color, background: CATEGORY_COLOUR["myth-in-time"].background },
  { id: "myth", label: "Myth", color: CATEGORY_COLOUR["myth"].color, background: CATEGORY_COLOUR["myth"].background },
  { id: "speculation-contested", label: "Speculation / contested", color: CATEGORY_COLOUR["speculation-contested"].color, background: CATEGORY_COLOUR["speculation-contested"].background },
  { id: "source", label: "Source", color: CATEGORY_COLOUR["source"].color, background: CATEGORY_COLOUR["source"].background },
  { id: "book-writing", label: "Book / writing", color: CATEGORY_COLOUR["book-writing"].color, background: CATEGORY_COLOUR["book-writing"].background },
  { id: "constellation", label: "Constellation", color: CATEGORY_COLOUR["constellation"].color, background: CATEGORY_COLOUR["constellation"].background },
  { id: "institution-network-figure", label: "Institution / network / figure", color: CATEGORY_COLOUR["institution-network-figure"].color, background: CATEGORY_COLOUR["institution-network-figure"].background },
] as const;

export function categoryDefinition(category: TimelineCategory): TimelineCategoryDefinition {
  return TIMELINE_CATEGORIES.find((definition) => definition.id === category) ?? TIMELINE_CATEGORIES[0];
}

export function deriveTimelineCategory(node: GraphNode): TimelineCategory {
  if (node.entityType === "Source") return "source";
  if (node.entityType === "Claim") return "claim";
  if (node.entityType === "Interpretation") return "interpretation";
  if (
    node.entityType === "Myth" &&
    node.historicity === "mythic" &&
    node.temporalRole === "myth_located_at"
  ) return "myth-in-time";
  if (node.entityType === "Myth") return "myth";
  if (node.entityType === "Work") return "book-writing";
  if (node.entityType === "Constellation") return "constellation";
  if (
    node.entityType === "Archetype" ||
    node.entityType === "Dynamic" ||
    node.entityType === "PsychoidOperator"
  ) {
    return "archetype";
  }
  if (
    node.claimKind === "hypothesis" ||
    node.claimKind === "allegation" ||
    node.evidenceStatus === "contested" ||
    node.evidenceStatus === "alleged" ||
    node.evidenceStatus === "unverified"
  ) return "speculation-contested";
  if (node.entityType === "Institution" || node.entityType === "Figure" || node.entityType === "People") {
    return "institution-network-figure";
  }
  return "historical-event";
}
