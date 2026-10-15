// The standing of the suite reading, as one plain observable store, and the words the pane says about it
// [T-N3-ATLAS-SUITE-PROVIDER].
//
// The suite provider (provider/suiteProvider.ts) publishes here as each owner input arrives: the owners' own states and details,
// how many subjects it composed, how many the Earth cannot place, and the Places the world holds (each project space, each place an
// owner declares). The atlas host's status line reads it; so may any other face (the Places browser category) through
// `useSyncExternalStore(subscribeSuiteStanding, suiteStanding)`. It is a reading, never a second source: nothing here is written
// by a face, and a face that wants fresher data asks the provider to read again.
//
// The store is the shell's existing observable pattern, not a new one: a latest snapshot, subscribe, publish (the mounted-atlas store,
// AtlasProjectionPanel.tsx:247-267; the disclosure session, desktop/cradle/src/techne/session.ts:117).
//
// This module is light on purpose: it holds types, constants and text, and no reader, so the shell may import it without loading
// the provider. The store keeps the latest immutable snapshot, so a subscriber may compare by identity. Pure TypeScript: no
// React, no DOM.

import type {TechnePlacePrecision} from '../../../../../../../desktop/cradle/src/techne/contract';

export const SUITE_PROVIDER_ID = 'suite';
/** The provider's display name: the only place the corpus is named (C2 §1.2). */
export const SUITE_PROVIDER_NAME = 'Your world';

// ── the inputs ────────────────────────────────────────────────────────────

export type SuiteInputName = 'central_wiki' | 'shared_field' | 'aikit_resolution';
/** The order the inputs are read in: the ground first (Central's wiki), then what is hosted, then AIKit's resolution (the slow one). */
export const SUITE_INPUTS: readonly SuiteInputName[] = ['central_wiki', 'shared_field', 'aikit_resolution'];
export const SUITE_INPUT_LABELS: Record<SuiteInputName, string> = {
  central_wiki: 'Central’s wiki',
  shared_field: 'The shared field',
  aikit_resolution: 'AIKit knowledge',
};
/** The owner operation that answers each input, as the kernel names it (graph.rs; knowledge/graphProgress.ts operations). Used
 * only until an owner reading states its own. */
export const SUITE_INPUT_OPERATIONS: Record<SuiteInputName, string> = {
  central_wiki: 'central.wiki.read',
  shared_field: 'shared-field.projection',
  aikit_resolution: 'aikit.knowledge.resolve',
};

export type SuiteInputState = 'available' | 'unavailable' | 'deferred' | 'reading';

/** A place of the suite, for the Places browser: a project's space, or a place an owner declares. */
export interface SuitePlace {
  /** the owner's ref of the place, verbatim */
  ref: string;
  name: string;
  kind: 'project' | 'declared';
  /** the native owner and the owner operation that disclosed it */
  owner: string;
  source: string;
  revision?: string;
  /** the subject that declares it, for a declared place */
  subject_ref?: string;
  /** the hard geography relation, verbatim, for a declared place that carries one */
  relation?: string | null;
  located: boolean;
  precision: TechnePlacePrecision;
  lat?: number;
  lon?: number;
  /** why the place is not located, in plain words; null when it is */
  reason: string | null;
  /** [T-PLACES-ONTO-ATLAS] the facet's own fields, verbatim, for the M4 plate's Locations and Relations (absent when the owner
   * declares none): its uncertainty words, the evidence it cites, its validity, and the places it sits in (LOCATED_IN and the
   * like, as the owner relates them). */
  uncertainty?: string;
  evidence?: string;
  valid_from?: string;
  valid_to?: string;
  within?: readonly {readonly place_ref: string; readonly relation: string}[];
}

/** A body of the field (manual §2 "every world is drawn as a body in space"): Central's root, or a hosted world, as the suite composed
 * its registers (suiteReading.ts composeSuite). A project space is a place on a body, not a body. For the browser's Bodies group. */
export interface SuiteBody {
  /** the owner's ref of the register, verbatim */
  ref: string;
  name: string;
  kind: 'root' | 'world';
  owner: string;
  source: string;
}

export interface SuiteCounts {
  registers: number;
  families: number;
  subjects: number;
  located: number;
  unlocated: number;
  dated: number;
  undated: number;
  places: number;
  unlocatedPlaces: number;
  joins: number;
}

// ── the standing: what the pane says ──────────────────────────────────────

export interface SuiteInputStanding {
  name: SuiteInputName;
  label: string;
  state: SuiteInputState;
  owner_operation: string;
  detail: string;
  rows: number;
}

export interface SuiteStanding {
  phase: 'idle' | 'reading' | 'ready' | 'unavailable';
  provider: {id: string; name: string};
  readAt: string | null;
  inputs: Record<SuiteInputName, SuiteInputStanding>;
  /** Central's wiki file, read for the place, time and type its nodes declare */
  declarations: {state: 'available' | 'unavailable' | 'absent'; detail: string};
  counts: SuiteCounts;
  places: readonly SuitePlace[];
  /** the field's bodies: Central's root and each hosted world (T-PLACES-ONTO-ATLAS, for lane N's Bodies rows) */
  bodies: readonly SuiteBody[];
  refused: readonly string[];
}

export const NO_COUNTS: SuiteCounts = {registers: 0, families: 0, subjects: 0, located: 0, unlocated: 0, dated: 0, undated: 0, places: 0, unlocatedPlaces: 0, joins: 0};

export function idleInputs(): Record<SuiteInputName, SuiteInputStanding> {
  const out = {} as Record<SuiteInputName, SuiteInputStanding>;
  for (const name of SUITE_INPUTS) out[name] = {name, label: SUITE_INPUT_LABELS[name], state: 'deferred', owner_operation: SUITE_INPUT_OPERATIONS[name], detail: 'not read yet', rows: 0};
  return out;
}

export const IDLE_STANDING: SuiteStanding = {
  phase: 'idle', provider: {id: SUITE_PROVIDER_ID, name: SUITE_PROVIDER_NAME}, readAt: null, inputs: idleInputs(),
  declarations: {state: 'absent', detail: 'Central’s wiki file was not read'}, counts: NO_COUNTS, places: [], bodies: [], refused: [],
};

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
/** One sentence, ending in exactly one full stop (an owner's own detail may already end in one). */
const sentence = (text: string): string => `${text.trim().replace(/[.\s]+$/, '')}.`;

/** The pane's words about the Earth's standing: how many of the owners' subjects it does not draw and why, then every owner input
 * that did not answer, with the owner's own detail. Says nothing the standing does not hold. */
export function describeStanding(standing: SuiteStanding): string {
  const {counts} = standing;
  const lines: string[] = [];
  if (standing.phase === 'ready' && counts.subjects > 0) {
    const one = counts.subjects === 1;
    lines.push(sentence(
      counts.located === 0
        ? `${standing.provider.name}: ${plural(counts.subjects, 'subject', 'subjects')} read from their owners, none on the Earth. No owner declares where ${one ? 'it is' : 'they are'}, so the Earth draws ${one ? 'it' : 'them'} nowhere`
        : `${standing.provider.name}: ${plural(counts.subjects, 'subject', 'subjects')} read from their owners, ${counts.located} on the Earth. ${counts.unlocated} ${counts.unlocated === 1 ? 'is' : 'are'} unlocated: no owner declares where, so the Earth does not draw ${counts.unlocated === 1 ? 'it' : 'them'}`,
    ));
    if (counts.unlocatedPlaces > 0) lines.push(sentence(`${plural(counts.unlocatedPlaces, 'place', 'places')} ${counts.unlocatedPlaces === 1 ? 'is' : 'are'} unlocated too`));
    if (counts.undated > 0) lines.push(sentence(`${counts.undated} ${counts.undated === 1 ? 'is' : 'are'} undated`));
  }
  if (standing.phase !== 'idle') {
    for (const name of SUITE_INPUTS) {
      const input = standing.inputs[name];
      if (input.state === 'available') continue;
      const state = input.state === 'reading' ? 'still being read' : input.state === 'deferred' ? 'not read' : 'unavailable';
      lines.push(sentence(`${input.label}: ${state}${input.detail && input.state !== 'reading' ? ` — ${input.detail}` : ''}`));
    }
    if (standing.declarations.state === 'unavailable') lines.push(sentence(`Declared places and times: unavailable — ${standing.declarations.detail}`));
  }
  for (const reason of standing.refused) lines.push(sentence(`Not placed: ${reason}`));
  return lines.join(' ');
}

/** The pane's words while the owners are being read: what has arrived, what is still waited on. */
export function describeProgress(standing: SuiteStanding): string {
  const within = (name: SuiteInputName): string => standing.inputs[name].label.replace(/^The /, 'the ');
  const waiting = SUITE_INPUTS.filter(name => standing.inputs[name].state === 'reading' || standing.inputs[name].state === 'deferred').map(within);
  const arrived = SUITE_INPUTS.filter(name => standing.inputs[name].state === 'available');
  const head = arrived.length ? `${arrived.map(name => standing.inputs[name].label).join(' and ')} read (${plural(standing.counts.subjects, 'subject', 'subjects')} so far)` : 'Reading your world';
  return waiting.length ? `${head}; waiting for ${waiting.join(', ')}…` : `${head}.`;
}

// ── the store ─────────────────────────────────────────────────────────────

let current: SuiteStanding = IDLE_STANDING;
const listeners = new Set<() => void>();

/** The latest standing: idle until a reading starts. The same object until the next publish. */
export function suiteStanding(): SuiteStanding {
  return current;
}

/** The Places the world holds, as the latest reading composed them: each project space and each place an owner declares. */
export function suitePlaces(): readonly SuitePlace[] {
  return current.places;
}

export function subscribeSuiteStanding(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Publish a standing (the provider's act; exported for the host tests). */
export function publishSuiteStanding(next: SuiteStanding): void {
  current = next;
  for (const listener of [...listeners]) listener();
}

/** Back to idle (the host tests; a workspace change that unbinds the transport). */
export function resetSuiteStanding(): void {
  publishSuiteStanding(IDLE_STANDING);
}
