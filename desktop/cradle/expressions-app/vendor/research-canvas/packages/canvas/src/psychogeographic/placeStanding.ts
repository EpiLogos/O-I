/**
 * Lane-4 T30 — one standing grammar for the Places surfaces: the map's markers, the
 * inspector, the facet panel's tag, the search rows and the layers legend.
 *
 * Laws: the class of a facet comes only from the cradle authority
 * (`relationStandingClass`, src/techne/m0m5/place/world.ts); this module says how
 * the class is labelled and drawn, and never rewrites a relation or upgrades a
 * standing. The mythic colour and dash come from the chronology palette
 * (timeline/palette.ts, timeline/standingStyle.ts) that the legend already draws
 * with. Factual and owner-vocabulary carry no tint and no mark: a factual marker
 * is exactly the marker it was.
 *
 * This file imports no frame code. The frame (field-studies-journeys/src/placeStanding.ts)
 * re-exports it, so there is one law in one place.
 *
 * Erasable TypeScript: loadable by Vite and `node --test`.
 */
import { relationStandingClass, type RelationStandingClass } from "../../../../../../../src/techne/m0m5/place/world";
import { STANDING_COLOUR } from "../timeline/palette";
import { STANDING_DRAWING } from "../timeline/standingStyle";

export interface PlaceStandingMark {
  standingClass: RelationStandingClass;
  /** The class as every surface says it: the authority's own word, unchanged. */
  label: RelationStandingClass;
  /** Tag colour; null inherits the surface's ink. Only mythic is tinted. */
  colour: string | null;
  /** Outline dash pattern; null is solid. */
  dash: string | null;
  /** The sentence a mythic place carries wherever it is named; null otherwise. */
  note: string | null;
}

/** The mythic sentence, verbatim: the panel, the inspector and every other surface read this one string. */
export const MYTHIC_NOTE = "Mythic — a disclosed narrative location, never presented as a factual one.";

/** The mark for one facet relation. Pure: a function of the relation alone. */
export function placeStandingMark(relation: string | null | undefined): PlaceStandingMark {
  const standingClass = relationStandingClass(relation);
  if (standingClass === "mythic") {
    return {
      standingClass,
      label: standingClass,
      colour: STANDING_COLOUR.mythic,
      dash: STANDING_DRAWING.mythic.dash ?? null,
      note: MYTHIC_NOTE,
    };
  }
  return { standingClass, label: standingClass, colour: null, dash: null, note: null };
}

/**
 * The mark for a PLACE, over every facet the reading discloses for it: the one rule every surface uses (search, marker, inspector).
 * The most cautious class wins — mythic over owner vocabulary over factual — so a place with any mythic facet never passes as
 * factual on any surface. With no facet the place reads as its relation-less class.
 */
export function placeStandingOfRelations(relations: readonly (string | null | undefined)[]): PlaceStandingMark {
  const marks = relations.map((relation) => placeStandingMark(relation));
  return marks.find((mark) => mark.standingClass === "mythic")
    ?? marks.find((mark) => mark.standingClass === "owner-vocabulary")
    ?? marks[0]
    ?? placeStandingMark(undefined);
}

/** Every disclosed relation per place ref, in reading order: the input placeStandingOfRelations reads. */
export function relationsByPlace(facets: readonly { place_ref: string; relation?: string | null }[]): Map<string, (string | null | undefined)[]> {
  const byPlace = new Map<string, (string | null | undefined)[]>();
  for (const facet of facets) {
    const rows = byPlace.get(facet.place_ref);
    if (rows) rows.push(facet.relation);
    else byPlace.set(facet.place_ref, [facet.relation]);
  }
  return byPlace;
}

/** How a mythic MARKER is drawn on the globe: a dashed mythic ring, a short note beside it, and its title sentence. */
export interface MarkerStandingPatch {
  /** The note's and the ring's colour: the chronology palette's mythic colour. */
  colour: string;
  /** The full border value the disc takes (dashed, in the mythic colour). */
  border: string;
  /** Written to the marker's dataset as `data-standing`. */
  standing: "mythic";
  /** The short note drawn beside the disc. */
  note: string;
  /** The sentence appended to the marker's title. */
  title: string;
}

/**
 * The marker patch for a standing class, or null. Only mythic has one: a factual or
 * owner-vocabulary marker takes no patch at all, so its element is the one it was.
 */
export function markerStandingPatch(standingClass: RelationStandingClass | null | undefined): MarkerStandingPatch | null {
  if (standingClass !== "mythic") return null;
  const colour = STANDING_COLOUR.mythic;
  return {
    colour,
    border: `2px dashed ${colour}`,
    standing: "mythic",
    note: "Mythic",
    title: MYTHIC_NOTE,
  };
}
