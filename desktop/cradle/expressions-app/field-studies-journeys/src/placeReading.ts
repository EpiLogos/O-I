/**
 * W1–W5 glue for the mounted M4 instrument — pure functions between the
 * native ql.techne/v1 reading the m4 branch already holds (`data.reading`,
 * `researchInstrumentsData.ts`) and the refined m0m5 Place models
 * (`../../../src/techne/m0m5/place/*`). Nothing here invents a coordinate,
 * relation, hierarchy or route: filtering only narrows what is SHOWN, never
 * what is disclosed (the same law `filter.ts` already carries), and the
 * filtered facets/repository below hold the SAME facet/node objects, never
 * clones or rewrites.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`
 * (via esbuild, the same pattern `relation-field.test.mjs` already uses to
 * cross the field-studies-journeys ↔ desktop/cradle/src boundary).
 */
import type {PlacesRepository} from '@research-canvas/domain';
import type {TechnePlaceFacet, TechneReading} from '../../../src/techne/contract';
import {relationStandingClass, type RelationStandingClass} from '../../../src/techne/m0m5/place/world';
import {coversWindow, type TimeWindow} from '../../../src/techne/m0m5/place/filter';

/** Presentation-only place filter (W2). `null` on any facet means "every
 * value disclosed" — the honest default, never a narrowed default. */
export interface PlaceFilterState {
 relations: ReadonlySet<string> | null;
 standing: ReadonlySet<RelationStandingClass> | null;
 window: TimeWindow | null;
}

export const OPEN_PLACE_FILTER: PlaceFilterState = {relations: null, standing: null, window: null};

const UNDISCLOSED_RELATION = '(relation not disclosed)';

/** The relation types and standing classes this reading actually discloses
 * — filter controls only ever offer choices that are real, never a fixed
 * vocabulary the reading may not carry. */
export function placeFilterOptions(reading: TechneReading | null): {relations: string[]; standing: RelationStandingClass[]} {
 const facets = reading?.spatial ?? [];
 const relations = [...new Set(facets.map(facet => facet.relation ?? UNDISCLOSED_RELATION))].sort();
 const standingOrder: RelationStandingClass[] = ['factual', 'mythic', 'owner-vocabulary'];
 const present = new Set(facets.map(facet => relationStandingClass(facet.relation)));
 const standing = standingOrder.filter(entry => present.has(entry));
 return {relations, standing};
}

function facetPasses(facet: TechnePlaceFacet, filter: PlaceFilterState): boolean {
 if (filter.relations && !filter.relations.has(facet.relation ?? UNDISCLOSED_RELATION)) return false;
 if (filter.standing && !filter.standing.has(relationStandingClass(facet.relation))) return false;
 if (!coversWindow(facet, filter.window)) return false;
 return true;
}

/** The reading's own spatial facets, presentation-filtered: the SAME facet
 * objects, in the SAME order (filter.ts's law — filtering never re-mints
 * identity). */
export function filteredFacets(reading: TechneReading | null, filter: PlaceFilterState): TechnePlaceFacet[] {
 return (reading?.spatial ?? []).filter(facet => facetPasses(facet, filter));
}

/** A reading with its spatial facets narrowed to the filter, every other
 * field carried verbatim — so `worldState`/`routeModel` read relations,
 * route and the reference-frame ladder over exactly what the filter admits. */
export function filteredReading(reading: TechneReading | null, filter: PlaceFilterState): TechneReading | null {
 if (!reading) return null;
 return {...reading, spatial: filteredFacets(reading, filter)};
}

/**
 * Decorate a native `PlacesRepository` so `getLocatedNodes` returns only the
 * located nodes the filter still admits — presentation only. The wrapped
 * repository, its identities and every other read stay untouched; a located
 * node this reading's own spatial facets do not name at all passes through
 * unfiltered, since the filter has nothing of the reading's own to test it
 * against (never a false exclusion of a fact the filter cannot see).
 */
export function filteredPlacesRepository(base: PlacesRepository, reading: TechneReading | null, filter: PlaceFilterState): PlacesRepository {
 const admitted = new Set(filteredFacets(reading, filter).map(facet => facet.place_ref));
 const known = new Set((reading?.spatial ?? []).map(facet => facet.place_ref));
 return {
  ...base,
  async getLocatedNodes(projectId: string) {
   const nodes = await base.getLocatedNodes(projectId);
   return nodes.filter(node => !known.has(node.graphNodeId) || admitted.has(node.graphNodeId));
  },
 };
}

/** Toggle one value in a filter set expressed as `null` (= every option) or
 * an explicit inclusion set; collapses back to `null` once every offered
 * option is included again, so an untouched filter always reads as "open". */
export function toggleFilterMembership<T>(current: ReadonlySet<T> | null, allValues: readonly T[], value: T): ReadonlySet<T> | null {
 const next = new Set<T>(current ?? allValues);
 if (next.has(value)) next.delete(value); else next.add(value);
 return next.size >= allValues.length ? null : next;
}

interface EntityLookup {
 subject?: {subject_ref: string} | null;
}

/**
 * The Scene entity ref that carries this reading's subject — the same
 * identity "Edit constellation" resolves for the mounted M1′ canvas — so
 * M4's "Edit place/time" opens the SAME native constellation route for the
 * located member, never a locally invented one. Null when no entity in the
 * current native document binds this subject.
 */
export function subjectEntityRef(entities: Record<string, EntityLookup> | undefined, subjectRef: string): string | null {
 if (!entities) return null;
 for (const [ref, entity] of Object.entries(entities)) {
  if (entity.subject?.subject_ref === subjectRef) return ref;
 }
 return null;
}
