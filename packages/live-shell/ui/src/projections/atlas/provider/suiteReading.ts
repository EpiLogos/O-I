// The suite's corpus: Central's owners, read as the atlas's Field [T-N3-ATLAS-SUITE-PROVIDER; DEVICE-SEMANTICS-LOCK §0.1.2-3, §7,
// §8.4; DLW manual §5 "Central is your planet. Projects are places on its surface." and §8 "Everything you place carries its
// source and its owner, so a reader can always go back and check."].
//
// This module is pure: owner readings in, a Field and its standing out. No transport, no DOM, no React, no timers, no clock (the
// instant of the reading is passed in). It computes nothing the owners did not say: it places nothing and dates nothing the owner
// did not declare, and it invents no relation.
//
// Named sources (read, not copied; each is re-checked at its line):
//   - the owner's reading, `GraphReading` (desktop/cradle/src/knowledge/graph.ts:9-15): nodes carry `ref`, `kind`, `label`,
//     `native_owner`, `provenance {source, revision, detail}`; edges carry `relation`, `from_ref`, `to_ref`. No node carries a
//     place or a time.
//   - the declared place and time, read through the owners' own readers by the caller (provider/suiteProvider.ts): a wiki node's
//     own `place` (desktop/cradle/src/techne/placeFacets.ts:80), the native `aikit.techne-facet/v1` declarations
//     (desktop/cradle/src/techne/spatialFacets.ts:11, temporalFacets.ts:11).
//   - the hard geography relations, verbatim (desktop/cradle/src/techne/m0m5/place/world.ts:46-55, 68). MYTH_LOCATED_AT never
//     becomes a historical locus.
//   - the occurrence contract's basis check (projections/occurrence.ts:31 basisOf).
//   - the mapping shape of the founding provider's adaptation (provider/archetypalEarthProvider.ts:59 adaptFoundingField): the
//     provider names itself by data, and the atlas's code never names the corpus.
//
// The mapping (T-N3-ATLAS-SUITE-PROVIDER, "The mapping"):
//   Archetype  a world register: Central's root, each project space, each hosted world (the owner's title, or the owner's name in
//              its ref when the owner gives the space no row of its own).
//   Family     what a thing is, as its owner names it: `kind` within its owner (a wiki node's own `type` after a colon).
//   Occurrence a subject node, with its owner ref (`subject_ref`) and basis ({ref, revision}); a declared place or time, or the
//              honest absence of one (`geoPrecision: 'none'`; `dated: false`).
//   Parallels  an owner edge between two subjects; the owner's relation name stays in both bodies and on a family join.
//   Joins      a register's child space; a relation between families.

import type {GraphEdge, GraphNode, GraphReading} from '../../../../../../../desktop/cradle/src/knowledge/graph';
import type {TechnePlaceFacet} from '../../../../../../../desktop/cradle/src/techne/contract';
import {relationStandingClass} from '../../../../../../../desktop/cradle/src/techne/m0m5/place/world';
import {slug} from '../src/data/model';
import type {Archetype, Cite, Family, Field, GeoPrecision, Join, LocusType, Occurrence, Palette} from '../src/types/field';
import {basisOf} from '../../occurrence';
import {
  IDLE_STANDING, NO_COUNTS, SUITE_INPUTS, SUITE_INPUT_LABELS, SUITE_INPUT_OPERATIONS, SUITE_PROVIDER_ID, SUITE_PROVIDER_NAME, idleInputs,
  type SuiteBody, type SuiteCounts, type SuiteInputName, type SuiteInputState, type SuitePlace, type SuiteStanding,
} from './suiteStanding';

export {
  IDLE_STANDING, SUITE_INPUTS, SUITE_INPUT_LABELS, SUITE_INPUT_OPERATIONS, SUITE_PROVIDER_ID, SUITE_PROVIDER_NAME,
  type SuiteBody, type SuiteCounts, type SuiteInputName, type SuiteInputState, type SuitePlace, type SuiteStanding,
};

// ── the inputs ────────────────────────────────────────────────────────────

/** One input as read: its owner's own account (operation, state and detail, verbatim) and the owner's reading when it answered. */
export interface SuiteInput {
  name: SuiteInputName;
  state: SuiteInputState;
  owner_operation: string;
  detail: string;
  reading?: GraphReading;
}

/** An input the owner did not answer: named with the owner's own words (or the transport's), never filled. */
export function unavailableInput(name: SuiteInputName, detail: string): SuiteInput {
  return {name, state: 'unavailable', owner_operation: SUITE_INPUT_OPERATIONS[name], detail};
}

/** An input as its owner's reading states it. `reading.inputs[name]` is the kernel's own account; a reading that does not carry
 * one is taken as available (it answered) and says so. */
export function inputOfReading(name: SuiteInputName, reading: GraphReading): SuiteInput {
  const stated = reading.inputs?.[name];
  if (!stated) return {name, state: 'available', owner_operation: SUITE_INPUT_OPERATIONS[name], detail: '', reading};
  return {name, state: stated.state, owner_operation: stated.owner_operation, detail: stated.detail ?? '', reading};
}

// ── declarations: the place and time an owner declares, read through the owners' readers ─────────────

/** A place a subject declares, as the owner's reader returned it (verbatim facet; where it came from). */
export interface DeclaredPlace {
  subject_ref: string;
  facet: TechnePlaceFacet;
  origin: 'node.place' | 'aikit.techne-facet/v1' | 'techne-reading';
}

/** A time a subject declares: the year it stands at on the atlas's scale, and the owner's own words for it. */
export interface DeclaredTime {
  year: number;
  display: string;
  origin: 'temporal-facet' | 'place.valid_from';
}

/** What Central's wiki file declares about its subjects: the node `type`s, the places and the times, each by subject ref. */
export interface SuiteDeclarations {
  state: 'available' | 'unavailable' | 'absent';
  /** Why the declarations are not available (the owner's or the seam's own words); the file's path when they are. */
  detail: string;
  types: Record<string, string>;
  places: DeclaredPlace[];
  times: Record<string, DeclaredTime>;
}

export const NO_DECLARATIONS: SuiteDeclarations = {state: 'absent', detail: 'Central’s wiki file was not read', types: {}, places: [], times: {}};

/** The open Technē reading, when one is open: its subject and its place facets, verbatim (the relation on each stays the owner's). */
export interface OpenTechneReading {
  subject_ref: string;
  title?: string;
  native_owner: string;
  revision?: string | null;
  spatial: readonly TechnePlaceFacet[];
}

const RFC3339_YEAR = /^([+-]?\d{4,6})-\d{2}-\d{2}/;

/** The year an owner's date text names, or undefined when it names none the scale can hold: a bare year ("1850", "-44") or an ISO
 * date/instant. Nothing else is read as a date. */
export function yearOfDeclared(text: string | null | undefined): number | undefined {
  if (typeof text !== 'string') return undefined;
  const trimmed = text.trim();
  if (/^[+-]?\d{1,6}$/.test(trimmed)) return Number(trimmed);
  const iso = RFC3339_YEAR.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    return Number.isFinite(year) ? year : undefined;
  }
  return undefined;
}

/** The temporal kinds that date the subject itself: it occurred, or it is valid, at that time. A receipt, a source's own creation
 * or modification, and a day/now/session/run continuity are about records, not about the subject's time, so they do not date it. */
export const DATING_KINDS: readonly string[] = ['occurrence', 'valid'];

interface TemporalFacetLike {
  kind: string;
  instant?: string;
  interval?: {from?: string | null; to?: string | null};
  label?: string | null;
}

/** The time a subject's own temporal facets declare: the first dating facet with an instant or an interval start. The owner's own
 * label (a period or reign name) is the display; otherwise the date as the owner wrote it. */
export function declaredTimeOfFacets(facets: readonly TemporalFacetLike[]): DeclaredTime | undefined {
  for (const facet of facets) {
    if (!DATING_KINDS.includes(facet.kind)) continue;
    const carrier = facet.instant ?? facet.interval?.from ?? undefined;
    const year = yearOfDeclared(carrier);
    if (year === undefined || carrier === undefined) continue;
    const display = (typeof facet.label === 'string' && facet.label.trim()) || carrier.slice(0, 10);
    return {year, display, origin: 'temporal-facet'};
  }
  return undefined;
}

// ── the places ────────────────────────────────────────────────────────────

interface Located {
  located: true;
  lat: number;
  lon: number;
  geoPrecision: GeoPrecision;
}
interface Unlocated {
  located: false;
  reason: string;
}

/** Where a declared place puts a thing, and only where the owner says. A point with two finite coordinates inside the globe is
 * located (GeoJSON order, longitude then latitude); the owner's precision decides how loosely: exact is a place, approximate and
 * region are a region, and "unlocated" is unlocated whatever else the facet carries. A polygon is not a point, so the Earth, which
 * draws points, does not draw it; a malformed coordinate is named. No centroid is computed, no coordinate inferred. */
export function locateFacet(facet: TechnePlaceFacet): Located | Unlocated {
  // [T-WORLDS §5 W3] a place on another body (the facet names its body_ref; absent is the Earth) is not on the Earth: the Earth draws
  // its own places only, and the body the place stands on draws it (locateOnBody)
  if (said(facet.body_ref)) return {located: false, reason: `the owner places it on another body (${facet.body_ref}), not on the Earth`};
  return locatePoint(facet);
}

/** Where a place stands on the body it names (its own point, read as the Earth's are), or why it has none; null for an Earth place. */
export function locateOnBody(facet: TechnePlaceFacet): {body_ref: string; where: Located | Unlocated} | null {
  return said(facet.body_ref) ? {body_ref: facet.body_ref, where: locatePoint(facet)} : null;
}

function locatePoint(facet: TechnePlaceFacet): Located | Unlocated {
  if (facet.precision === 'unlocated') return {located: false, reason: 'the owner declares it unlocated'};
  const geometry = facet.geometry;
  if (!geometry) return {located: false, reason: 'the owner declares no geometry'};
  if (geometry.type !== 'point') return {located: false, reason: 'the owner declares a polygon; the Earth draws points'};
  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number') {
    return {located: false, reason: 'the declared point has no coordinate pair'};
  }
  const [lon, lat] = coordinates as [number, number];
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return {located: false, reason: 'the declared point is not a longitude and latitude'};
  }
  return {located: true, lat, lon, geoPrecision: facet.precision === 'exact' ? 'place' : 'region'};
}

const placeNameOf = (facet: TechnePlaceFacet): string => facet.identity?.names?.find(entry => entry.name)?.name ?? facet.place_ref;

const said = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim() !== '';

/** [T-PLACES-ONTO-ATLAS] The facet's own fields a place row carries, verbatim and only when the owner declares them: its uncertainty
 * words, the evidence it cites (`source_ref`), its validity edges and the places it sits in (`hierarchy`). Nothing is derived. */
export function facetFieldsOf(facet: TechnePlaceFacet): Pick<SuitePlace, 'uncertainty' | 'evidence' | 'valid_from' | 'valid_to' | 'within' | 'body_ref' | 'on_body'> {
  const within = (facet.hierarchy ?? []).filter(entry => said(entry.place_ref) && said(entry.relation)).map(entry => ({place_ref: entry.place_ref, relation: entry.relation}));
  const body = locateOnBody(facet);
  return {
    ...(body ? {body_ref: body.body_ref, ...(body.where.located ? {on_body: {lat: body.where.lat, lon: body.where.lon}} : {})} : {}),
    ...(said(facet.uncertainty) ? {uncertainty: facet.uncertainty} : {}),
    ...(said(facet.source_ref) ? {evidence: facet.source_ref} : {}),
    ...(said(facet.valid_from) ? {valid_from: facet.valid_from} : {}),
    ...(said(facet.valid_to) ? {valid_to: facet.valid_to} : {}),
    ...(within.length ? {within} : {}),
  };
}

/** The locus a place relation gives an occurrence. MYTH_LOCATED_AT is a myth episode and is never a historical event (the legend is
 * the consumer's own: world.ts relationStandingClass). The other hard relations of the occurrence kind are historical, and being
 * located IN a place is a placed thing. Any other relation is the owner's own vocabulary, kept verbatim in the body, and gives the
 * neutral locus. */
export function locusOfRelation(relation: string | null | undefined): LocusType {
  const standing = relationStandingClass(relation);
  if (standing === 'mythic') return 'myth-episode';
  if (standing === 'factual' && relation !== 'LOCATED_IN') return 'historical-event';
  return 'artifact';
}

// ── small stable things ───────────────────────────────────────────────────

/** FNV-1a, 32 bits: a stable hash of a ref, for ids and palettes. Not a security property. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
const hash8 = (text: string): string => fnv1a(text).toString(16).padStart(8, '0');

const tailOf = (ref: string): string => {
  const trimmed = ref.replace(/[:/]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf(':'), trimmed.lastIndexOf('/'));
  return cut >= 0 ? trimmed.slice(cut + 1) : trimmed;
};

function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** The atmosphere of a ref: one hue from the ref's own hash, so a register or a kind keeps its colour wherever it is read. */
export function paletteOfRef(ref: string): Palette {
  const hue = fnv1a(ref) % 360;
  return {core: hslHex(hue, 0.55, 0.74), glow: hslHex(hue, 0.62, 0.52), fog: hslHex(hue, 0.32, 0.17), deep: hslHex(hue, 0.4, 0.045)};
}

const clip = (text: string, length: number): string => (text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`);

const OWNER_NAMES: Record<string, string> = {wiki: 'Central’s wiki', 'shared-field': 'The shared field', 'ai-kit': 'AIKit knowledge'};
const ownerName = (owner: string): string => OWNER_NAMES[owner] ?? owner;

// ── composition ───────────────────────────────────────────────────────────

interface Register {
  ref: string;
  name: string;
  kind: 'root' | 'project' | 'world' | 'owner';
  owner: string;
  source: string;
  revision?: string;
  oneLine: string;
}

export interface SuiteComposition {
  field: Field;
  places: SuitePlace[];
  /** the field's bodies: Central's root and each hosted world, as the registers name them */
  bodies: SuiteBody[];
  counts: SuiteCounts;
  /** subjects the occurrence contract refused, each named with its reason (never dropped silently) */
  refused: string[];
}

export interface SuiteSources {
  inputs: Partial<Record<SuiteInputName, SuiteInput>>;
  declarations?: SuiteDeclarations;
  techne?: OpenTechneReading | null;
  /** the instant the reading was made; the only clock this module has */
  readAt: Date;
}

const REGISTER_KINDS: Record<string, Register['kind']> = {'wiki-space': 'root', 'hosted-central-world': 'world'};

/** An occurrence's basis: the owner's ref and the revision the owner returned for it, checked by the occurrence contract. */
function basisFor(ref: string, revision: string | undefined) {
  return basisOf({ref, ...(revision !== undefined && revision !== '' ? {revision} : {})});
}

/** Compose the Field from the owner readings that have arrived. Deterministic in the readings' own order. */
export function composeSuite(sources: SuiteSources): SuiteComposition {
  const declarations = sources.declarations ?? NO_DECLARATIONS;
  const readYear = sources.readAt.getUTCFullYear();

  // 1. the owners' rows and edges, in input order; one row per ref, identical edges once.
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeByRef = new Map<string, GraphNode>();
  const seenEdge = new Set<string>();
  for (const name of SUITE_INPUTS) {
    const reading = sources.inputs[name]?.reading;
    if (!reading || sources.inputs[name]?.state !== 'available') continue;
    for (const node of reading.nodes ?? []) {
      if (!node.ref || nodeByRef.has(node.ref)) continue;
      nodeByRef.set(node.ref, node);
      nodes.push(node);
    }
    for (const edge of reading.edges ?? []) {
      const key = `${edge.relation}\u0000${edge.from_ref}\u0000${edge.to_ref}`;
      if (!edge.from_ref || !edge.to_ref || seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push(edge);
    }
  }

  // 2. the registers: Central's root, each project space its root names a child, each hosted world.
  const registers = new Map<string, Register>();
  for (const node of nodes) {
    const kind = REGISTER_KINDS[node.kind];
    if (!kind || (node.kind === 'wiki-space' && node.native_owner !== 'wiki')) continue;
    registers.set(node.ref, {
      ref: node.ref, name: node.label || tailOf(node.ref), kind, owner: node.native_owner, source: node.provenance.source,
      ...(node.provenance.revision !== undefined ? {revision: node.provenance.revision} : {}),
      oneLine: clip(kind === 'root' ? `${ownerName(node.native_owner)} · ${node.provenance.source}` : `A world · ${node.provenance.source}`, 90),
    });
  }
  const childSpaces: {parent: string; child: string; edge: GraphEdge}[] = [];
  for (const edge of edges) {
    if (edge.relation !== 'space-child-space' || !registers.has(edge.from_ref)) continue;
    childSpaces.push({parent: edge.from_ref, child: edge.to_ref, edge});
    if (registers.has(edge.to_ref)) continue;
    // the owner names the child space by its ref only: the project's name is the ref's tail, the ref stays the owner's
    const node = nodeByRef.get(edge.to_ref);
    registers.set(edge.to_ref, {
      ref: edge.to_ref, name: node?.label || tailOf(edge.to_ref), kind: 'project', owner: 'wiki', source: edge.provenance.source,
      oneLine: clip(`A project space of ${registers.get(edge.from_ref)!.name} · ${edge.provenance.source}`, 90),
    });
  }
  const isRegister = (ref: string) => registers.has(ref);

  // 3. the subjects: every row that is not a register.
  const subjects = nodes.filter(node => !REGISTER_KINDS[node.kind] || (node.kind === 'wiki-space' && node.native_owner !== 'wiki'));
  const subjectRefs = new Set(subjects.map(node => node.ref));
  const worlds = [...registers.values()].filter(register => register.kind === 'world');

  const ownerRegisters = new Map<string, Register>();
  const into = new Map<string, GraphEdge[]>();
  const outOf = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    (into.get(edge.to_ref) ?? into.set(edge.to_ref, []).get(edge.to_ref)!).push(edge);
    (outOf.get(edge.from_ref) ?? outOf.set(edge.from_ref, []).get(edge.from_ref)!).push(edge);
  }
  /** The register a subject stands in: the register its owner's edge joins it to, else the world whose ref qualifies its own
   * (hosted rows are world-qualified: desktop/cradle/src/knowledge/graph.ts:6-7), else its owner (a register of its own, named for the owner). */
  const registerOf = (node: GraphNode): Register => {
    const from = into.get(node.ref)?.find(edge => isRegister(edge.from_ref));
    if (from) return registers.get(from.from_ref)!;
    const to = outOf.get(node.ref)?.find(edge => isRegister(edge.to_ref));
    if (to) return registers.get(to.to_ref)!;
    let world: Register | undefined;
    for (const candidate of worlds) if (node.ref.startsWith(`${candidate.ref}/`) && (!world || candidate.ref.length > world.ref.length)) world = candidate;
    if (world) return world;
    const key = `owner:${node.native_owner}`;
    let owner = ownerRegisters.get(key);
    if (!owner) {
      owner = {ref: key, name: ownerName(node.native_owner), kind: 'owner', owner: node.native_owner, source: node.provenance.source, oneLine: clip(`Rows ${ownerName(node.native_owner)} returned that no register claims`, 90)};
      ownerRegisters.set(key, owner);
    }
    return owner;
  };

  // 4. families: what a thing is, as its owner names it.
  const families = new Map<string, Family>();
  const familyKeyOf = (node: GraphNode): string => {
    const type = node.native_owner === 'wiki' && node.kind === 'wiki-node' ? declarations.types[node.ref] : undefined;
    return type ? `${node.native_owner}:${node.kind}:${type}` : `${node.native_owner}:${node.kind}`;
  };
  const familyNameOf = (node: GraphNode): string => {
    const type = node.native_owner === 'wiki' && node.kind === 'wiki-node' ? declarations.types[node.ref] : undefined;
    return type ? `${node.kind}:${type}` : node.kind;
  };

  // 5. each subject's place and time, as declared.
  const placesBySubject = new Map<string, DeclaredPlace[]>();
  for (const declared of declarations.places) {
    const list = placesBySubject.get(declared.subject_ref);
    if (list) list.push(declared); else placesBySubject.set(declared.subject_ref, [declared]);
  }

  // 6. the occurrences.
  const occurrences: Occurrence[] = [];
  const registerOfOccurrence = new Map<string, Register>();
  const idOfRef = new Map<string, string>();
  const usedIds = new Set<string>();
  const idFor = (ref: string, suffix = ''): string => {
    let id = `o-${slug(tailOf(ref)).slice(0, 36) || 'subject'}-${hash8(ref + suffix)}`;
    for (let n = 2; usedIds.has(id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
    usedIds.add(id);
    return id;
  };
  const refused: string[] = [];
  const places: SuitePlace[] = [];

  const sourcesOf = new Map<string, string[]>();
  const relationsOf = new Map<string, {relation: string; direction: 'to' | 'from'; ref: string}[]>();
  for (const edge of edges) {
    if (edge.relation === 'node-source' && subjectRefs.has(edge.from_ref) && !subjectRefs.has(edge.to_ref) && !isRegister(edge.to_ref)) {
      const list = sourcesOf.get(edge.from_ref);
      if (list) list.push(edge.to_ref); else sourcesOf.set(edge.from_ref, [edge.to_ref]);
    }
    if (subjectRefs.has(edge.from_ref) && subjectRefs.has(edge.to_ref) && edge.from_ref !== edge.to_ref) {
      for (const [self, other, direction] of [[edge.from_ref, edge.to_ref, 'to'], [edge.to_ref, edge.from_ref, 'from']] as const) {
        const list = relationsOf.get(self);
        const row = {relation: edge.relation, direction, ref: other};
        if (list) list.push(row); else relationsOf.set(self, [row]);
      }
    }
  }
  const titleOf = (ref: string): string => nodeByRef.get(ref)?.label || ref;

  for (const node of subjects) {
    const revision = node.provenance.revision;
    const basis = basisFor(node.ref, revision);
    if (!basis.ok) {
      refused.push(`${node.ref}: ${basis.reason}`);
      continue;
    }
    const register = registerOf(node);
    const familyKey = familyKeyOf(node);
    if (!families.has(familyKey)) {
      families.set(familyKey, {
        id: `f-${slug(familyKey)}-${hash8(familyKey)}`, name: familyNameOf(node), subtype: 'unknown', aliases: [],
        oneLine: clip(`Read from ${node.provenance.source} · ${ownerName(node.native_owner)}`, 90), archetypes: [],
        spectrum: {position: 0.5}, palette: paletteOfRef(familyKey), body: [], occurrenceIds: [], synthesised: false,
      });
    }
    const family = families.get(familyKey)!;

    const declared = placesBySubject.get(node.ref) ?? [];
    const located = declared.map(entry => ({entry, where: locateFacet(entry.facet)})).find(row => row.where.located);
    const chosen = located ?? (declared[0] ? {entry: declared[0], where: locateFacet(declared[0].facet)} : undefined);
    for (const entry of declared) {
      const where = locateFacet(entry.facet);
      places.push({
        ref: entry.facet.place_ref, name: placeNameOf(entry.facet), kind: 'declared', owner: node.native_owner, source: node.provenance.source,
        ...(revision !== undefined ? {revision} : {}), subject_ref: node.ref, relation: entry.facet.relation ?? null, located: where.located,
        precision: entry.facet.precision, ...(where.located ? {lat: where.lat, lon: where.lon} : {}), reason: where.located ? null : where.reason,
        ...facetFieldsOf(entry.facet),
      });
    }
    const time = declarations.times[node.ref] ?? placeTime(declared);

    const sourceRefs = sourcesOf.get(node.ref) ?? [];
    const related = relationsOf.get(node.ref) ?? [];
    const where = chosen?.where;
    const body = [
      node.subject_ref && node.subject_ref !== node.ref ? `Ref: ${node.ref} · subject ${node.subject_ref}` : `Ref: ${node.ref}`,
      sourceRefs.length ? `Source: ${sourceRefs.join(' · ')}` : `Read from ${node.provenance.source} (${node.native_owner})${revision ? `, revision ${revision}` : ''}`,
      ...(where?.located ? [] : [where ? `Not on the Earth: ${where.reason}.` : 'Not on the Earth: no owner declares where this is.']),
      ...(time ? [] : ['Undated: no owner declares when this was.']),
      ...related.map(row => `${row.relation} ${row.direction === 'to' ? '→' : '←'} ${titleOf(row.ref)} (${row.ref})`),
    ];
    const cite: Cite = {work: node.native_owner, workTitle: node.provenance.source, year: revision ? `rev ${revision}` : '', locator: node.ref};
    const occurrence: Occurrence = {
      id: idFor(node.ref), subject_ref: node.subject_ref || node.ref, basis: basis.value, title: node.label || node.ref, label: clip(node.label || node.ref, 48),
      familyId: family.id, coFamilyIds: [], locusType: 'artifact', cultureIds: [],
      place: where?.located && chosen ? placeNameOf(chosen.entry.facet) : '',
      lat: where?.located ? where.lat : 0, lon: where?.located ? where.lon : 0, geoPrecision: where?.located ? where.geoPrecision : 'none',
      year: time ? time.year : readYear, yearDisplay: time ? time.display : 'undated', ...(time ? {} : {dated: false as const}),
      cites: [cite], body, parallelIds: [],
    };
    occurrences.push(occurrence);
    idOfRef.set(node.ref, occurrence.id);
    registerOfOccurrence.set(occurrence.id, register);
    family.occurrenceIds.push(occurrence.id);
  }

  // 6b. the open Technē reading's place facets: the subject at each place, the relation verbatim.
  if (sources.techne) {
    const reading = sources.techne;
    const basis = basisFor(reading.subject_ref, reading.revision ?? undefined);
    if (!basis.ok) refused.push(`${reading.subject_ref}: ${basis.reason}`);
    else {
      const subjectRegister = nodeByRef.has(reading.subject_ref) ? registerOf(nodeByRef.get(reading.subject_ref)!) : undefined;
      const owner = subjectRegister ?? ownerRegisters.get(`owner:${reading.native_owner}`) ?? (() => {
        const made: Register = {ref: `owner:${reading.native_owner}`, name: ownerName(reading.native_owner), kind: 'owner', owner: reading.native_owner, source: 'ql.techne/v1', oneLine: clip(`Place facets the open Technē reading returned`, 90)};
        ownerRegisters.set(made.ref, made);
        return made;
      })();
      const familyKey = 'techne:place-facet';
      if (!families.has(familyKey)) {
        families.set(familyKey, {
          id: `f-${slug(familyKey)}-${hash8(familyKey)}`, name: 'ql.techne/v1 place facet', subtype: 'unknown', aliases: [], oneLine: 'A place the open Technē reading returned',
          archetypes: [], spectrum: {position: 0.5}, palette: paletteOfRef(familyKey), body: [], occurrenceIds: [], synthesised: false,
        });
      }
      const family = families.get(familyKey)!;
      reading.spatial.forEach((facet, index) => {
        const where = locateFacet(facet);
        const relation = facet.relation ?? null;
        const name = placeNameOf(facet);
        const subjectTitle = reading.title || titleOf(reading.subject_ref);
        const id = idFor(`${reading.subject_ref}@${relation ?? ''}@${facet.place_ref}`, `#${index}`);
        const time = facet.valid_from !== undefined && yearOfDeclared(facet.valid_from) !== undefined ? {year: yearOfDeclared(facet.valid_from)!, display: String(facet.valid_from).slice(0, 10), origin: 'place.valid_from' as const} : undefined;
        occurrences.push({
          id, subject_ref: reading.subject_ref, basis: basis.value, title: `${subjectTitle} — ${relation ?? 'at'} ${name}`, label: clip(`${subjectTitle} · ${name}`, 48),
          familyId: family.id, coFamilyIds: [], locusType: locusOfRelation(relation), cultureIds: [], place: where.located ? name : '',
          lat: where.located ? where.lat : 0, lon: where.located ? where.lon : 0, geoPrecision: where.located ? where.geoPrecision : 'none',
          year: time ? time.year : readYear, yearDisplay: time ? time.display : 'undated', ...(time ? {} : {dated: false as const}),
          cites: [{work: reading.native_owner, workTitle: 'ql.techne/v1', year: reading.revision ? `rev ${reading.revision}` : '', locator: reading.subject_ref}],
          body: [`Ref: ${reading.subject_ref}`, `Relation: ${relation ?? '(none disclosed)'}`, `Place: ${facet.place_ref}`, ...(where.located ? [] : [`Not on the Earth: ${where.reason}.`])],
          parallelIds: [],
        });
        registerOfOccurrence.set(id, owner);
        family.occurrenceIds.push(id);
        places.push({
          ref: facet.place_ref, name, kind: 'declared', owner: reading.native_owner, source: 'ql.techne/v1', subject_ref: reading.subject_ref, relation,
          located: where.located, precision: facet.precision, ...(where.located ? {lat: where.lat, lon: where.lon} : {}), reason: where.located ? null : where.reason,
          ...facetFieldsOf(facet),
        });
      });
    }
  }

  // 7. parallels: an owner edge between two subjects ties them, mutually.
  const byId = new Map(occurrences.map(occurrence => [occurrence.id, occurrence]));
  for (const edge of edges) {
    const a = idOfRef.get(edge.from_ref);
    const b = idOfRef.get(edge.to_ref);
    if (!a || !b || a === b) continue;
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const occurrence = byId.get(from)!;
      if (!occurrence.parallelIds.includes(to)) occurrence.parallelIds.push(to);
    }
  }

  // 8. the registers' archetypes, the families' ties to them, and the joins.
  const usedRegisters = new Map<string, Register>();
  for (const register of registers.values()) usedRegisters.set(register.ref, register);
  for (const register of ownerRegisters.values()) usedRegisters.set(register.ref, register);
  const archetypeId = (register: Register) => `a-${slug(register.ref).slice(0, 40)}-${hash8(register.ref)}`;
  const memberCount = new Map<string, number>();
  const familyRegisters = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    const register = registerOfOccurrence.get(occurrence.id)!;
    memberCount.set(register.ref, (memberCount.get(register.ref) ?? 0) + 1);
    const set = familyRegisters.get(occurrence.familyId) ?? familyRegisters.set(occurrence.familyId, new Set()).get(occurrence.familyId)!;
    set.add(register.ref);
  }
  const familyList = [...families.values()];
  for (const family of familyList) {
    family.archetypes = [...(familyRegisters.get(family.id) ?? [])].map(ref => ({id: archetypeId(usedRegisters.get(ref)!), basis: 'site' as const}));
  }
  const prime = [...usedRegisters.values()].find(register => register.kind === 'root') ?? [...usedRegisters.values()][0];
  const archetypes: Archetype[] = [...usedRegisters.values()].map(register => ({
    id: archetypeId(register), name: register.name, oneLine: register.oneLine, prime: register === prime, spectrum: {position: 0.5},
    palette: paletteOfRef(register.ref), body: [],
    familyIds: familyList.filter(family => family.archetypes.some(tie => tie.id === archetypeId(register))).map(family => family.id),
    occurrenceCount: memberCount.get(register.ref) ?? 0, archetypes: [],
  }));

  const joins: Join[] = [];
  const seenJoin = new Set<string>();
  const addJoin = (a: Join['a'], b: Join['b'], relation: string, note: string) => {
    const [x, y] = `${a.type}:${a.id}` < `${b.type}:${b.id}` ? [a, b] : [b, a];
    const key = `${relation}\u0000${x.type}:${x.id}\u0000${y.type}:${y.id}`;
    if (seenJoin.has(key)) return;
    seenJoin.add(key);
    joins.push({id: `j-${hash8(key)}`, a, b, basis: 'site', note: clip(note, 400), system: relation});
  };
  for (const {parent, child, edge} of childSpaces) {
    addJoin({type: 'archetype', id: archetypeId(registers.get(parent)!)}, {type: 'archetype', id: archetypeId(registers.get(child)!)}, edge.relation, `${edge.relation}: ${registers.get(parent)!.name} → ${registers.get(child)!.name}`);
  }
  const familyOfOccurrence = new Map(occurrences.map(occurrence => [occurrence.id, occurrence.familyId]));
  const joined = new Map<string, number>();
  for (const edge of edges) {
    const a = idOfRef.get(edge.from_ref);
    const b = idOfRef.get(edge.to_ref);
    if (!a || !b) continue;
    const fa = familyOfOccurrence.get(a)!;
    const fb = familyOfOccurrence.get(b)!;
    if (fa === fb) continue;
    const key = `${edge.relation}\u0000${[fa, fb].sort().join('\u0000')}`;
    joined.set(key, (joined.get(key) ?? 0) + 1);
  }
  for (const [key, count] of joined) {
    const [relation, fa, fb] = key.split('\u0000');
    addJoin({type: 'family', id: fa}, {type: 'family', id: fb}, relation, `${relation} (${count} owner ${count === 1 ? 'edge' : 'edges'})`);
  }

  // 9. the places: every project space the root names, then every place a subject declares.
  const projectPlaces: SuitePlace[] = [...registers.values()].filter(register => register.kind === 'project').map(register => ({
    ref: register.ref, name: register.name, kind: 'project' as const, owner: register.owner, source: register.source, located: false, precision: 'unlocated' as const,
    reason: 'no owner declares where this project is',
  }));
  const allPlaces = [...projectPlaces, ...places];

  // 10. the field.
  const dated = occurrences.filter(occurrence => occurrence.dated !== false);
  const years = dated.map(occurrence => occurrence.year);
  // The extent is the span of the dates the owners declare. With none, or one, the clock face still needs a track (the time control
  // refuses a range that does not increase), so it is the one year ending at the dated year, or at the year of the reading: an
  // extent for the face, never the date of any subject.
  const yearMax = years.length ? Math.max(...years) : readYear;
  const yearMin = years.length && Math.min(...years) < yearMax ? Math.min(...years) : yearMax - 1;
  for (const occurrence of occurrences) if (occurrence.dated === false) occurrence.year = yearMax;
  for (const family of familyList) family.occurrenceIds.sort((x, y) => byId.get(x)!.year - byId.get(y)!.year);
  const available = SUITE_INPUTS.map(name => sources.inputs[name]).filter((input): input is SuiteInput => !!input && input.state === 'available');
  const field: Field = {
    meta: {
      generatedAt: sources.readAt.toISOString(),
      provider: {
        id: SUITE_PROVIDER_ID, name: SUITE_PROVIDER_NAME, home: SUITE_INPUTS.map(name => SUITE_INPUT_OPERATIONS[name]).join(' · '),
        labels: {citesHeading: 'Owners read', citesMeet: 'Where its owner holds it', citePrefix: 'Owner', readingTagline: 'Your world, read from its owners'},
      },
      freshness: `Read ${sources.readAt.toISOString().slice(0, 16).replace('T', ' ')} UTC${available.length ? ` from ${available.map(input => input.owner_operation).join(' and ')}` : ''}`,
      ties: {bases: [{id: 'site', label: 'Declared by its owner'}]},
      counts: {archetypes: archetypes.length, theoretics: 0, families: familyList.length, occurrences: occurrences.length, cultures: 0, images: 0, joins: joins.length},
      yearMin, yearMax,
    },
    archetypes, theoretics: [], families: familyList, occurrences, cultures: [], joins,
  };
  const locatedCount = occurrences.filter(occurrence => occurrence.geoPrecision !== 'none').length;
  // the field's bodies (T-PLACES-ONTO-ATLAS, for the browser's Bodies): Central's root and each hosted world, as the registers name them
  const bodies: SuiteBody[] = [...registers.values()].filter((register): register is Register & {kind: 'root' | 'world'} => register.kind === 'root' || register.kind === 'world')
    .map(register => ({ref: register.ref, name: register.name, kind: register.kind, owner: register.owner, source: register.source}));
  return {
    field, places: allPlaces, bodies, refused,
    counts: {
      registers: archetypes.length, families: familyList.length, subjects: occurrences.length, located: locatedCount, unlocated: occurrences.length - locatedCount,
      dated: dated.length, undated: occurrences.length - dated.length, places: allPlaces.length, unlocatedPlaces: allPlaces.filter(place => !place.located).length, joins: joins.length,
    },
  };
}

/** A declared place's own validity, when it states one, dates the subject that declares it: only a year or an ISO date counts. */
function placeTime(declared: readonly DeclaredPlace[]): DeclaredTime | undefined {
  for (const entry of declared) {
    const year = yearOfDeclared(entry.facet.valid_from);
    if (year !== undefined) return {year, display: String(entry.facet.valid_from).slice(0, 10), origin: 'place.valid_from'};
  }
  return undefined;
}

// ── the standing of a reading ─────────────────────────────────────────────

/** The standing of a reading: the owners' own states and details, the composition's counts. */
export function standingOf(phase: SuiteStanding['phase'], sources: SuiteSources, composition: SuiteComposition | null, pending: readonly SuiteInputName[] = []): SuiteStanding {
  const inputs = idleInputs();
  for (const name of SUITE_INPUTS) {
    const input = sources.inputs[name];
    if (input) inputs[name] = {name, label: SUITE_INPUT_LABELS[name], state: input.state, owner_operation: input.owner_operation, detail: input.detail, rows: input.reading?.nodes?.length ?? 0};
    else if (pending.includes(name)) inputs[name] = {...inputs[name], state: 'reading', detail: 'being read'};
  }
  const declarations = sources.declarations ?? NO_DECLARATIONS;
  return {
    phase, provider: {id: SUITE_PROVIDER_ID, name: SUITE_PROVIDER_NAME}, readAt: sources.readAt.toISOString(), inputs,
    declarations: {state: declarations.state, detail: declarations.detail}, counts: composition?.counts ?? NO_COUNTS, places: composition?.places ?? [],
    bodies: composition?.bodies ?? [], refused: composition?.refused ?? [],
  };
}
