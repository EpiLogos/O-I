// World / Places on the atlas, the plate's readings (T-PLACES-ONTO-ATLAS; FOUNDATION §4 "Places is the Archetypal-Earth atlas,
// alone"; DLW manual §2 "Earth is there too, the one world nobody built … You place things on it"). Pure: owner readings in, rows
// out. No DOM, no React, no store, no transport.
//
// Every row is read from what an owner returned: the places the suite provider composed (provider/suiteStanding.ts SuitePlace — a
// project space, or a place a subject declares, with its owner, source, revision and the facet's own fields), the hard geography
// relations verbatim (desktop/cradle/src/techne/m0m5/place/world.ts GEOGRAPHY_RELATIONS, relationStandingClass), the precision
// grammar (desktop/cradle/src/techne/m0m5/place/project.ts precisionMarker), and the locus the atlas gives each relation
// (provider/suiteReading.ts locusOfRelation). Nothing is placed, dated, named or related here that the owner did not say.
//
// Ported from the frame's Places map, which retires (lane-4 T8–T13, T30): the legend of relation layers (psychogeographic/
// placeLayers.ts relationLayers), the precision grammar (placeNavigation.ts markerKindFor), routes and hierarchy (placeRoutes.ts), the
// provenance block (placeProvenance.ts facetProvenance) and the standing class (placeStanding.ts) — re-read here over the suite's
// places, since the atlas, not the frame, now holds the world.

import type {TechnePlacePrecision} from '../../../../../../../desktop/cradle/src/techne/contract';
import {GEOGRAPHY_RELATIONS, MOVEMENT_RELATION, relationStandingClass, type RelationStandingClass} from '../../../../../../../desktop/cradle/src/techne/m0m5/place/world';
import {precisionMarker, type PlaceMarkerKind} from '../../../../../../../desktop/cradle/src/techne/m0m5/place/project';
import type {LocusType} from '../src/types/field';
import {locusOfRelation} from '../provider/suiteReading';
import type {SuitePlace} from '../provider/suiteStanding';

/** The relation an owner declares no name for, said as the frame's legend said it (world.ts placeRelations). */
export const UNNAMED_RELATION = '(relation not disclosed)';

/** One place on the plate's Locations list: what the owner declares, how the atlas can draw it, and where it came from. */
export interface PlaceRow {
  readonly ref: string;
  readonly name: string;
  readonly kind: SuitePlace['kind'];
  /** the subject that declares it (absent for a project space) */
  readonly subject_ref?: string;
  /** the relation, verbatim; null when the owner names none */
  readonly relation: string | null;
  readonly standing: RelationStandingClass;
  readonly precision: TechnePlacePrecision;
  /** the precision grammar's rendering (solid · halo · outline · no-coordinate) and its honest note, never upgraded */
  readonly marker: PlaceMarkerKind;
  readonly markerNote: string;
  readonly located: boolean;
  readonly lat?: number;
  readonly lon?: number;
  /** why it is not on the Earth, in the owner's terms; null when it is */
  readonly reason: string | null;
  /** where it came from: the native owner, the reading it was disclosed by, its revision, the evidence it cites */
  readonly provenance: string;
  readonly uncertainty?: string;
  /** the evidence the facet cites (its source_ref), which a proposed move needs */
  readonly evidence?: string;
  /** the validity the owner declares, as written; null when it declares none */
  readonly validity: string | null;
  /** the validity's two edges, verbatim (what "Window to its validity" writes to the shared window) */
  readonly valid_from?: string;
  readonly valid_to?: string;
}

const PROJECT_REASON = 'a project space: no owner declares where it is on the Earth';

/** Where a place came from, in one line: the owner, the reading, the revision, the evidence; an absence is said, never filled. */
export function provenanceLine(place: Pick<SuitePlace, 'owner' | 'source' | 'revision' | 'evidence'>): string {
  const parts = [`${place.owner} · ${place.source}`];
  parts.push(place.revision ? `revision ${place.revision}` : 'no revision disclosed');
  parts.push(place.evidence ? `evidence ${place.evidence}` : 'no evidence source disclosed');
  return parts.join(' · ');
}

/** The validity the owner declares for a place, as written: "from … to …", one open edge, or null for none. */
export function validityLine(place: Pick<SuitePlace, 'valid_from' | 'valid_to'>): string | null {
  if (place.valid_from && place.valid_to) return `${place.valid_from} – ${place.valid_to}`;
  if (place.valid_from) return `from ${place.valid_from}`;
  if (place.valid_to) return `until ${place.valid_to}`;
  return null;
}

/** The Locations list: every place the world holds, located first, each by its name. A project space is listed with its honest
 * absence (it is a register, not a point). */
export function placeRows(places: readonly SuitePlace[]): PlaceRow[] {
  const rows = places.map((place): PlaceRow => {
    const marker = precisionMarker(place.precision);
    return {
      ref: place.ref, name: place.name, kind: place.kind, ...(place.subject_ref ? {subject_ref: place.subject_ref} : {}),
      relation: place.relation ?? null, standing: relationStandingClass(place.relation), precision: place.precision,
      marker: marker.kind, markerNote: marker.note, located: place.located,
      ...(place.located && place.lat !== undefined && place.lon !== undefined ? {lat: place.lat, lon: place.lon} : {}),
      reason: place.located ? null : place.kind === 'project' ? PROJECT_REASON : place.reason ?? 'no coordinate disclosed',
      provenance: provenanceLine(place), ...(place.uncertainty ? {uncertainty: place.uncertainty} : {}),
      ...(place.evidence ? {evidence: place.evidence} : {}), validity: validityLine(place),
      ...(place.valid_from ? {valid_from: place.valid_from} : {}), ...(place.valid_to ? {valid_to: place.valid_to} : {}),
    };
  });
  return rows.sort((a, b) => Number(b.located) - Number(a.located) || a.name.localeCompare(b.name));
}

/** The precision classes the world's places stand at, with their counts, in the grammar's order (the frame map's legend). */
export function precisionCounts(rows: readonly PlaceRow[]): {precision: TechnePlacePrecision; marker: PlaceMarkerKind; count: number}[] {
  const order: TechnePlacePrecision[] = ['exact', 'approximate', 'region', 'unlocated'];
  return order.map(precision => ({precision, marker: precisionMarker(precision).kind, count: rows.filter(row => row.precision === precision).length}))
    .filter(entry => entry.count > 0);
}

/** One relation the world's places are declared by: the relation verbatim, its standing class, how many places, how many of them the
 * Earth can draw, and the locus the atlas gives it (what its press narrows the globe to). */
export interface RelationRow {
  readonly relation: string;
  readonly standing: RelationStandingClass;
  readonly count: number;
  readonly located: number;
  readonly locus: LocusType;
}

/** The relations legend: the hard geography relations in their legend order, then each owner's own vocabulary as first seen, then
 * places that name no relation. Project spaces relate nothing and are not counted. */
export function relationRows(places: readonly SuitePlace[]): RelationRow[] {
  const declared = places.filter(place => place.kind === 'declared');
  const byRelation = new Map<string, {relation: string | null; count: number; located: number}>();
  for (const place of declared) {
    const key = place.relation ?? UNNAMED_RELATION;
    const entry = byRelation.get(key) ?? {relation: place.relation ?? null, count: 0, located: 0};
    entry.count += 1;
    if (place.located) entry.located += 1;
    byRelation.set(key, entry);
  }
  const rank = (key: string): number => {
    const at = GEOGRAPHY_RELATIONS.indexOf(key);
    return at >= 0 ? at : key === UNNAMED_RELATION ? Number.MAX_SAFE_INTEGER : GEOGRAPHY_RELATIONS.length;
  };
  return [...byRelation].map(([key, entry], seen) => ({key, entry, seen}))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.seen - b.seen)
    .map(({key, entry}) => ({relation: key, standing: relationStandingClass(entry.relation), count: entry.count, located: entry.located,
      locus: locusOfRelation(entry.relation)}));
}

/** A place that sits in another, as its owner relates them (the facet's hierarchy, verbatim). Listed, not drawn: the Earth draws
 * the walk's arcs, and an edge whose parent has no point would be drawn nowhere (the frame map's own clause, project.ts:115-117). */
export interface WithinRow {
  readonly child: string;
  readonly childName: string;
  readonly relation: string;
  readonly parent: string;
  /** the parent's name where the world holds it, else its ref */
  readonly parentName: string;
}

export function withinRows(places: readonly SuitePlace[]): WithinRow[] {
  const names = new Map(places.map(place => [place.ref, place.name]));
  return places.flatMap(place => (place.within ?? []).map(entry => ({
    child: place.ref, childName: place.name, relation: entry.relation, parent: entry.place_ref, parentName: names.get(entry.place_ref) ?? entry.place_ref,
  })));
}

/** A subject's movement (TRAVELLED_TO) as the atlas walks it: the subject and how many of its stops the globe can draw. A walk
 * needs two stops; fewer draw nothing ("never a forced path", the frame map's routeModel law, world.ts:132). With no body named the stops
 * are the Earth's (the places located on it); with one, its own (the places whose facet names it and gives a point on it: manual §17.2 "Every
 * walk you take wears a path between places"). */
export interface RouteRow {
  readonly subject_ref: string;
  readonly stops: number;
  readonly walkable: boolean;
}

export function routeRows(places: readonly SuitePlace[], bodyRef?: string): RouteRow[] {
  const bySubject = new Map<string, number>();
  for (const place of places) {
    if (place.relation !== MOVEMENT_RELATION || !place.subject_ref) continue;
    if (!(bodyRef === undefined ? place.located : place.body_ref === bodyRef && !!place.on_body)) continue;
    bySubject.set(place.subject_ref, (bySubject.get(place.subject_ref) ?? 0) + 1);
  }
  return [...bySubject].map(([subject_ref, stops]) => ({subject_ref, stops, walkable: stops >= 2}));
}

/** The five scales, as the manual names them (§17.2 "The five scales": Field · System · Body · Region · Place; T-WORLDS §5 W3 "Scales
 * follow the manual"), in their order from the farthest. */
export const ATLAS_SCALES = ['field', 'system', 'body', 'region', 'place'] as const;

/** The scale the atlas stands at, as the plate's head names it. The sky is the System (your planet under its star, and your system's
 * worlds round it); the body whole is the Body; a camera at or inside the atlas's own regional framing distance is a Region
 * (app/controller.ts frames a regional occurrence at 2.6 globe radii and a place at 2.25); one place held at its own framing is the Place,
 * and so is a palace entered (N4: a palace is a place you enter, palaces/PalaceFloor.tsx, whatever the camera does beneath). The Field
 * (the worlds of a shared field round a shared star) is the shared field's, which no owner opens to the atlas yet (Aperture stands
 * disabled on that reason), so the atlas never stands at it. The Graph is not a scale of the Earth and says so: 'graph'. */
export type AtlasScale = (typeof ATLAS_SCALES)[number] | 'graph';
export const REGION_DISTANCE = 2.6;
/** One place held at its own framing — a street for an exact place, a city for an approximate one (placesHost.ts framingDistance) — or
 * nearer is the Place (manual §17.2: "One place with its exact position"). The atlas's own framing of an opened subject (app/controller.ts,
 * 2.25 globe radii: a continent in view) is no single place, so it reads Region (O-I #742, walk 739 T1). */
export const PLACE_DISTANCE = 1.2;

export function atlasScaleOf(view: {readonly sky: boolean; readonly graph: boolean; readonly dist: number; readonly palace?: boolean; readonly placeHeld?: boolean}): AtlasScale {
  if (view.palace) return 'place';
  if (view.graph) return 'graph';
  if (view.sky) return 'system';
  if (view.placeHeld && view.dist <= PLACE_DISTANCE) return 'place';
  return view.dist <= REGION_DISTANCE ? 'region' : 'body';
}

/** Rows whose name, ref or relation holds the words asked for (the Locations find over the world's own places). */
export function findPlaceRows(rows: readonly PlaceRow[], query: string): PlaceRow[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...rows];
  return rows.filter(row => {
    const text = `${row.name} ${row.ref} ${row.relation ?? ''}`.toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}
