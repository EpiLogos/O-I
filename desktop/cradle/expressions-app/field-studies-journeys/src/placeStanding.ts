/**
 * Lane-4 T30 — one standing grammar for the Places surfaces (the panel's
 * standing tag, the search rows, and the layers legend's mythic swatch).
 *
 * Laws: the class of a facet comes only from the cradle authority
 * (`relationStandingClass`, src/techne/m0m5/place/world.ts); this module says how
 * the class is labelled and drawn, and never rewrites a relation or upgrades a
 * standing. The mythic colour and dash come from the shared chronology palette
 * (timeline/palette.ts, timeline/standingStyle.ts) that the legend already draws
 * with. Factual and owner-vocabulary carry no tint, so the only tinted class is
 * the one the owner must never mistake for a factual place.
 *
 * Erasable TypeScript: loadable by Vite and `node --test`.
 */
import {relationStandingClass, type RelationStandingClass} from '../../../src/techne/m0m5/place/world';
import {STANDING_COLOUR} from '../../vendor/research-canvas/packages/canvas/src/timeline/palette';
import {STANDING_DRAWING} from '../../vendor/research-canvas/packages/canvas/src/timeline/standingStyle';

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

/** The mythic sentence, verbatim: the panel and every other surface read this one string. */
export const MYTHIC_NOTE = 'Mythic — a disclosed narrative location, never presented as a factual one.';

/** The mark for one facet relation. Pure: a function of the relation alone. */
export function placeStandingMark(relation: string | null | undefined): PlaceStandingMark {
 const standingClass = relationStandingClass(relation);
 if (standingClass === 'mythic') {
  return {
   standingClass,
   label: standingClass,
   colour: STANDING_COLOUR.mythic,
   dash: STANDING_DRAWING.mythic.dash ?? null,
   note: MYTHIC_NOTE,
  };
 }
 return {standingClass, label: standingClass, colour: null, dash: null, note: null};
}
