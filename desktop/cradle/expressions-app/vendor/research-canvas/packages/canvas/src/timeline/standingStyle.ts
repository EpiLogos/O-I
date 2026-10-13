/**
 * The standing vocabulary the chronology draws with (T3): one table shared by
 * the item band hatch, the standing badge and the relationship edges.
 *
 * Which class a thing has comes only from the authority's `standingOf`
 * (src/techne/m0m5/timeline/standing.ts), and the labels come from its
 * `STANDING_LEGEND`. This file holds only how a class is drawn. The colours and
 * dash patterns are copied from the relation field's stylesheet
 * (field-studies-journeys/src/relationFieldView.css, `.relation-field-standing-*`),
 * so both projections draw one vocabulary; that stylesheet still carries its own
 * literal copy and should import this table.
 */
import {
  STANDING_LEGEND,
  standingOf,
  type StandingReading,
  type StandingVisual,
} from "../../../../../../../src/techne/m0m5/timeline/standing";
import { STANDING_COLOUR } from "./palette";

export interface StandingDrawing {
  /** Stroke and text colour. */
  stroke: string;
  /** SVG dash pattern; undefined is a solid line. */
  dash?: string;
}

export const STANDING_DRAWING: Record<StandingVisual, StandingDrawing> = {
  sourced: { stroke: STANDING_COLOUR.sourced },
  derived: { stroke: STANDING_COLOUR.derived, dash: "5 3" },
  authored: { stroke: STANDING_COLOUR.authored },
  disputed: { stroke: STANDING_COLOUR.disputed, dash: "2 3" },
  mythic: { stroke: STANDING_COLOUR.mythic, dash: "1 4" },
  unavailable: { stroke: STANDING_COLOUR.unavailable, dash: "3 5" },
};

/** Classes that read as a badge on the card. Approximate facts read as a hatched band instead. */
export const STANDING_BADGED: ReadonlySet<StandingVisual> = new Set<StandingVisual>(["disputed", "mythic"]);

/** The authority's legend label for a class. */
export function standingLabel(visual: StandingVisual): string {
  return STANDING_LEGEND.find((entry) => entry.visual === visual)?.label ?? visual;
}

/**
 * The standing of a relationship from its own properties, as the bridge writes
 * them (researchInstrumentsData / techneBundle `pushRelationship`). Passes only
 * the owner-supplied fields the authority reads; never upgrades.
 */
export function standingOfRelationshipProperties(properties: Record<string, unknown>): StandingReading {
  return standingOf({
    standing: typeof properties.standing === "string" ? properties.standing : null,
    source_ref: typeof properties.source_ref === "string" ? properties.source_ref : null,
    evidence_refs: Array.isArray(properties.evidence_refs) ? (properties.evidence_refs as string[]) : undefined,
    derivation_ref: typeof properties.derivation_ref === "string" ? properties.derivation_ref : null,
  });
}
