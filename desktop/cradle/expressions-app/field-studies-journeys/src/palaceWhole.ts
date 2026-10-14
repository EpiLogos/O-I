/**
 * The Palace integral whole, as the mounted surface reads it (lane-5 T14,
 * T16, T17, T18) — pure presentation over the reading the Palace already
 * owns in `src/techne/m0m5/palace/`. No DOM, no store, no second graph.
 *
 * Laws carried here:
 *   - the integral regions ARE `palaceRegions(reading)` and the walk IS
 *     `palaceTraversal(deriveComposition(reading))`: this module adds no
 *     facet family, ref, region or ordering of its own;
 *   - every ref is the reading's own, verbatim; a facet-less region is absent
 *     and a reading with nothing to compose is unavailable with the reading's
 *     own reason, never a placeholder;
 *   - a region's standing is said plainly: a QL-warranted canvas names its
 *     warrant class and provenance ref; an Expression owner's composition
 *     names the owner; everything else is free mnemonic composition;
 *   - connections are derived from the guided path (the Scene order of the
 *     Palace's own regions): a gap, a broken edge and a self reference are each
 *     drawn as themselves, never hidden;
 *   - an entry opens through its own instrument only when that instrument is
 *     wired on this surface; otherwise the refusal names the instrument.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {TechneInstrument, TechneReading} from '../../../src/techne/contract.ts';
import {palaceAvailability, type PalaceLocus} from '../../../src/techne/m0m5/palace/composition.ts';
import {deriveComposition, palaceTraversal} from '../../../src/techne/m0m5/palace/palace-state.ts';
import {recallOver} from '../../../src/techne/m0m5/palace/recall.ts';
import {
  palaceRegions,
  regionArchaeology,
  type PalaceRegion,
  type PalaceRegionEntry,
  type PalaceRegionKey,
} from '../../../src/techne/m0m5/palace/regions.ts';

// ---------------------------------------------------------------------------
// T18 — each region's own standing
// ---------------------------------------------------------------------------

/** A region is warranted QL structure, an Expression owner's own composition,
 * or free mnemonic composition. The three are never dressed as one another. */
export type PalaceStanding = 'warranted' | 'owner' | 'free';

export interface PalaceStandingView {
  standing: PalaceStanding;
  /** The plain sentence the card shows. Quotes the warrant's refs verbatim. */
  line: string;
  warrant_class: string | null;
  provenance_ref: string | null;
}

/** A Scene region the person arranged by hand: free composition by definition.
 * Its line says so plainly, so a hand-made region is never read as warranted. */
export const SCENE_REGION_STANDING: PalaceStandingView = {
  standing: 'free',
  line: 'free mnemonic composition: a hand-arranged Scene region — no warranted QL structure stands behind this form',
  warrant_class: null,
  provenance_ref: null,
};

/** The standing of one integral region, derived from the reading's own
 * warrant. Pure. */
export function palaceStanding(reading: TechneReading, region: PalaceRegion): PalaceStandingView {
  const line = regionArchaeology(reading, region);
  if (region.key === 'canvas' && reading.ql) {
    return {
      standing: 'warranted',
      line,
      warrant_class: reading.ql.warrant.result_class,
      provenance_ref: reading.ql.warrant.provenance_ref,
    };
  }
  if (region.key === 'expression' && (reading.expressions ?? []).some((binding) => binding.composition_ref)) {
    return {standing: 'owner', line, warrant_class: null, provenance_ref: null};
  }
  return {standing: 'free', line, warrant_class: null, provenance_ref: null};
}

// ---------------------------------------------------------------------------
// T14 — the integral whole, composed from the reading's real facets
// ---------------------------------------------------------------------------

export interface PalaceWholeRegion {
  key: PalaceRegionKey;
  m_prime: number | null;
  office: string;
  standing: PalaceStandingView;
  entries: PalaceRegionEntry[];
}

export interface PalaceWholeView {
  available: boolean;
  /** The reading's own reason when the whole is unavailable; never invented. */
  reason: string | null;
  regions: PalaceWholeRegion[];
}

/** The integral whole of one reading, in canonical M0′→M5′ order. A reading
 * with no reading yet is an honest absence; a reading with nothing to compose
 * names the disclosure's own reason. */
export function palaceWholeView(reading: TechneReading | null): PalaceWholeView {
  if (!reading) return {available: false, reason: null, regions: []};
  const regions: PalaceWholeRegion[] = palaceRegions(reading).map((region) => ({
    key: region.key,
    m_prime: region.m_prime,
    office: region.office,
    standing: palaceStanding(reading, region),
    entries: region.entries,
  }));
  if (regions.length === 0) {
    return {
      available: false,
      reason: palaceAvailability(reading).reason ?? 'the reading discloses no facet the whole can compose',
      regions: [],
    };
  }
  return {available: true, reason: null, regions};
}

// ---------------------------------------------------------------------------
// T16 — derived connections over the guided path, honest about every gap
// ---------------------------------------------------------------------------

export type PalaceEdgeKind = 'path' | 'gap' | 'broken' | 'self';

export interface PalaceGuidedEdge {
  from: string;
  to: string;
  kind: PalaceEdgeKind;
  reason: string;
}

/** The guided path's edges, derived from the region order alone. `live` is the
 * set of Expression refs the owner currently discloses; null while that list is
 * still unknown (then a filled member draws as a plain path). `saved` names a
 * region the owner's document still carries as a Scene: a saved region whose
 * member is missing is a named-but-missing reference, so it is broken; a region
 * not yet saved and not yet filled is a gap. The first region is the named
 * start of the path. Pure: a reorder re-derives the edges. */
export function palaceGuidedEdges(
  regions: readonly {name: string; member_ref: string | null; saved?: boolean}[],
  anchor_ref: string,
  live: ReadonlySet<string> | null,
): {start: string | null; edges: PalaceGuidedEdge[]} {
  const edges: PalaceGuidedEdge[] = [];
  for (let index = 1; index < regions.length; index += 1) {
    const from = regions[index - 1].name;
    const target = regions[index];
    const ref = target.member_ref;
    if (ref === null && target.saved === true) {
      edges.push({from, to: target.name, kind: 'broken', reason: `${target.name} is named in the saved guided path but holds no Expression — the reference is broken`});
    } else if (ref === null) {
      edges.push({from, to: target.name, kind: 'gap', reason: `${target.name} holds no Expression yet — the guided path has a gap here`});
    } else if (ref === anchor_ref) {
      edges.push({from, to: target.name, kind: 'self', reason: `${target.name} contains this Palace's own Expression — a self reference`});
    } else if (live && !live.has(ref)) {
      edges.push({from, to: target.name, kind: 'broken', reason: `${target.name} names ${ref}, which is no longer disclosed — the edge is broken`});
    } else {
      edges.push({from, to: target.name, kind: 'path', reason: `${target.name} stands on the guided path`});
    }
  }
  return {start: regions[0]?.name ?? null, edges};
}

// ---------------------------------------------------------------------------
// T16 — Open: each object opens in its own instrument, or is refused by name
// ---------------------------------------------------------------------------

export type PalaceOpenRoute =
  | {kind: 'open'; instrument: TechneInstrument; ref: string}
  | {kind: 'source'; ref: string}
  | {kind: 'refused'; reason: string};

/** The route for one entry's Open. `wired` names the instruments this surface
 * can summon. A provenance entry opens the source surface (lane-5 T24): the
 * frame's own source summon, which the host resolves against the current
 * Scene. An entry with no instrument surface says its depth stays in the
 * palace; an unwired instrument is refused by name. */
export function palaceOpenRoute(entry: PalaceRegionEntry, wired: ReadonlySet<string>): PalaceOpenRoute {
  if (entry.kind === 'sources') return {kind: 'source', ref: entry.ref};
  if (!entry.open_instrument) {
    return {kind: 'refused', reason: `${entry.label} has no instrument surface — its depth stays in the palace`};
  }
  if (!wired.has(entry.open_instrument)) {
    return {kind: 'refused', reason: `Opening a ${entry.open_instrument} object from the Palace is not wired on this surface`};
  }
  return {kind: 'open', instrument: entry.open_instrument, ref: entry.ref};
}

/** T16 on the board: one region card's Open opens its contained Expression in that object's own instrument (the same route an
 * Expression member's Open takes in the list). A region with no member, a self reference, or a member the owner no longer
 * discloses is refused by name; nothing is opened on the Palace's behalf. Pure. */
export function palaceRegionOpenRoute(
  name: string,
  member: {expression_ref: string} | null,
  anchor_ref: string,
  live: ReadonlySet<string> | null,
): {kind: 'open'; instrument: 'expressions'; ref: string} | {kind: 'refused'; reason: string} {
  if (!member) return {kind: 'refused', reason: `${name} holds no Expression to open yet`};
  if (member.expression_ref === anchor_ref) {
    return {kind: 'refused', reason: `${name} contains this Palace's own Expression — a self reference, so it stays here`};
  }
  if (live && !live.has(member.expression_ref)) {
    return {kind: 'refused', reason: `${name} names ${member.expression_ref}, which is no longer disclosed — the reference is broken`};
  }
  return {kind: 'open', instrument: 'expressions', ref: member.expression_ref};
}

/** The instruments a Palace entry can open into from this surface (lane-5 seam B). Each is a deep instrument the shell selects
 * through the host's own instrument path; `expressions` is the Expression summon. The Palace never opens itself. */
export const PALACE_WIRED_INSTRUMENTS: ReadonlySet<string> = new Set(['expressions', 'project', 'canvas', 'timeline', 'journey', 'place']);

/** The frame's request for a non-Expression instrument: the existing host-request instrument summon, which the host turns into its
 * own selectInstrument (expressions-boundary host.ts) with the ref it names. A request with no ref asks for the instrument alone
 * (the return to M0′ ground names no object), so no `ref` key is sent. */
export function palaceInstrumentOpenRequest(instrument: TechneInstrument, ref?: string): {request: 'summon'; detail: {kind: 'instrument'; lens: TechneInstrument; ref?: string}} {
  return {request: 'summon', detail: {kind: 'instrument', lens: instrument, ...(ref !== undefined ? {ref} : {})}};
}

/** The Palace's Expression subject a source summon carries: the same subject the frame's own source summon names
 * (app.ts `summonSource`), so the host resolves the source inside the Scene the Palace is standing in. */
export interface PalaceSourceSubject {expression_ref: string; revision: number; scene_ref: string; title: string}

/** The frame's request for a provenance entry's source surface: the existing source summon, the same shape the frame sends from
 * its own source affordances. The host resolves the ref against the current Scene; a ref outside it is refused by the owner. */
export function palaceSourceOpenRequest(ref: string, subject: PalaceSourceSubject): {request: 'summon'; detail: {kind: 'source'; ref: string; subject: Record<string, unknown>}} {
  return {
    request: 'summon',
    detail: {
      kind: 'source',
      ref,
      subject: {ref: subject.expression_ref, kind: 'expression', nativeOwner: 'oi', revision: subject.revision, title: subject.title, sceneRef: subject.scene_ref, entityRef: null, relationRef: null},
    },
  };
}

// ---------------------------------------------------------------------------
// T17 — the guided integral walk, method of loci over the whole
// ---------------------------------------------------------------------------

export interface PalaceWalkStep {
  region: PalaceRegionKey;
  ref: string;
  office: string;
  locus: PalaceLocus;
}

/** Every occupied locus of the whole, in walk order: regions M0′→M5′, loci in
 * spatial order within each region. Empty when the reading composes nothing. */
export function palaceWalkSteps(reading: TechneReading | null): PalaceWalkStep[] {
  if (!reading) return [];
  const composition = deriveComposition(reading);
  const office = new Map(composition.regions.map((region) => [region.key, region.office]));
  return palaceTraversal(composition).map((step) => ({
    region: step.region,
    ref: step.ref,
    office: office.get(step.region) ?? step.region,
    locus: step.locus,
  }));
}

/** The walk focused at `index`, normalised into the walk with wrap (the same
 * normalisation `recall.ts` applies to the arrangement). An empty walk focuses
 * nothing. */
export function palaceWalkAt(steps: readonly PalaceWalkStep[], index: number): {index: number; step: PalaceWalkStep | null} {
  // The walk's normalisation is recall.ts's own (`recallOver`), not a second copy of it.
  const walk = recallOver(
    steps.map((step) => step.ref),
    steps.map((step) => step.locus),
    index,
  );
  return {index: walk.index, step: steps.length === 0 ? null : steps[walk.index]};
}

/** The locus a returning visitor resumes at: the stored index, wrapped into the
 * walk as it stands now. A first visit starts at the named start. */
export function palaceWalkResume(stored: number | undefined, count: number): number {
  if (count === 0) return 0;
  const index = Math.trunc(stored ?? 0);
  return ((index % count) + count) % count;
}
