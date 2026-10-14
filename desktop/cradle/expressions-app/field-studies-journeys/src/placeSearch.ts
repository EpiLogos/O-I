/**
 * Lane-4 T22 — the Places lens's own search over the place reading. Pure
 * model: rows come from the reading's own disclosed places through
 * `placeOffersOf` and `flyHereLabel` (src/techne/m0m5/place/navigation.ts),
 * one per place in reading order. A subject with no disclosed place is a named
 * row, never dropped. Choosing a row writes ONLY the native shared session's
 * spatial focus (`searchChoiceWrite`); this module never touches the cradle's
 * local session store.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {TechneReading} from '../../../src/techne/contract';
import {flyHereLabel, placeOffersOf, type PlaceOffer} from '../../../src/techne/m0m5/place/navigation';
import type {TechnePlaceFacet} from '../../../src/techne/contract';
import {openingPlaceSelection} from '../../../src/techne/m0m5/place/navigation';
import {placeFocusFromSession} from '../../../src/techne/m0m5/place/register';
import {placeSubjectOf} from './placeReading.js';
import {placeStandingMark} from './placeStanding.js';
import type {RelationStandingClass} from '../../../src/techne/m0m5/place/world';

/** The session the Places mount reads (the native shared session, as the navigation helpers type it). */
type MountSession = Parameters<typeof openingPlaceSelection>[0];

export type PlaceSearchRow =
 | {kind: 'place'; key: string; label: string; offer: PlaceOffer; standing: RelationStandingClass}
 | {kind: 'none'; key: string; label: string};

/**
 * The rows for a query over the reading's disclosed places. Blank query lists
 * every place. A reading with no disclosed place names its subject instead.
 */
export function placeSearchRows(reading: TechneReading | null, query: string): PlaceSearchRow[] {
 const offers = placeOffersOf(reading?.spatial ?? null);
 if (offers.length === 0) {
  const subject = placeSubjectOf(reading);
  return [{kind: 'none', key: 'no-place', label: subject ? `No place disclosed for ${subject.subject_ref}` : 'No place disclosed'}];
 }
 const needle = query.trim().toLowerCase();
 const matched = needle
  ? offers.filter(offer => offer.title.toLowerCase().includes(needle) || offer.place_ref.toLowerCase().includes(needle))
  : offers;
 if (matched.length === 0) return [{kind: 'none', key: 'no-match', label: `No disclosed place matches "${query.trim()}"`}];
 // T30: the row's standing is the first facet's relation (the same facet placeOffersOf keeps), read by the cradle authority.
 const relationOf = new Map<string, string | null | undefined>();
 for (const facet of reading?.spatial ?? []) if (facet && !relationOf.has(facet.place_ref)) relationOf.set(facet.place_ref, facet.relation);
 return matched.map(offer => ({kind: 'place', key: offer.place_ref, label: flyHereLabel(offer), offer, standing: placeStandingMark(relationOf.get(offer.place_ref)).standingClass}));
}

/**
 * The one write a chosen search row makes: the place becomes the shared
 * session's spatial focus on the Places instrument. The mount sends exactly this
 * plan through its compare-and-set spatial write (writeSharedSpatialFocus).
 */
export function searchChoiceWrite(offer: PlaceOffer): {instrument: 'place'; spatial_focus_ref: string} {
 if (!offer || typeof offer.place_ref !== 'string' || !offer.place_ref.trim()) {
  throw new Error('searchChoiceWrite: a searched place carries its place ref verbatim');
 }
 return {instrument: 'place', spatial_focus_ref: offer.place_ref};
}

/**
 * The selection and the framed focus the Places map is given on render. A carried ref (the frame's
 * host-command, read once at open) outranks the shared session; once a search choice has been made the
 * mount clears the carried ref, so the native session's spatial focus, the search's own write, decides.
 * Selected and focused are the same place in every case the session declares one.
 */
export function placeMountFocus(input: {
 carried: string | undefined;
 session: MountSession | null;
 facets: readonly TechnePlaceFacet[];
 remembered: string | null;
}): {selected: string | null; focus: string | null} {
 const {carried, session, facets, remembered} = input;
 return {
  selected: carried ?? openingPlaceSelection(session, facets, remembered),
  focus: carried ?? placeFocusFromSession(session, facets),
 };
}
