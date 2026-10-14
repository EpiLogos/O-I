/**
 * Lane-5 T3 — the journey's pace, pure. The author sets how long each beat holds as a LOCAL draft. The draft rides the journey
 * presence entry (T9, `techne/m0m5/journey/presence.ts`) with its basis, and nothing reaches the Expression until the author saves
 * it. Saving writes each changed Scene's own duration through the timeline's retime (one labelled step, acknowledged by the owner's
 * Save path). The beat ORDER stays native: a reorder still routes at once (journeyBeats.reorderSceneRequest), so the pace draft never
 * carries an order of its own to route.
 *
 * Nothing here persists or routes. The draft's range and membership are checked by the Scene duration bounds and the sequence floor
 * (`paceBeat`), and a commit names every beat it cannot save rather than skipping it.
 */
import type {KernelConversion} from './kernelDocumentBridge';
import {SCENE_DURATION_MIN, SCENE_DURATION_MAX} from './model';
import {paceBeat, type SequenceDraft} from '../../../src/techne/m0m5/journey/sequence';
import type {JourneyPresenceDraft} from '../../../src/techne/m0m5/journey/presence';

/** The authored Scene material's schema: the only place a Scene's own duration lives. */
const SCENE_MATERIAL_SCHEMA = 'oi.journey-scene/v1';

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** A typed pace rounded to a tenth of a second, the precision the timeline shows. */
export function roundPace(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}

/** A beat's saved duration: the Scene's own authored seconds in the native Expression, or null when the Scene carries no authored
 * material (nothing to retime). */
export function savedDuration(view: KernelConversion, sceneRef: string): number | null {
  const presentation = view.document.scenes.find((scene) => scene.scene_ref === sceneRef)?.presentation;
  if (!presentation || presentation.schema !== SCENE_MATERIAL_SCHEMA || !presentation.scene) return null;
  return typeof presentation.scene.duration === 'number' ? presentation.scene.duration : null;
}

/** The pace draft as the sequence floor edits it. The presence entry carries the same facts with its basis named. */
export function sequenceOfDraft(draft: JourneyPresenceDraft, expression_ref: string): SequenceDraft {
  return {
    expression_ref,
    revision: draft.basis_revision,
    scene_order: [...draft.scene_order],
    pace: draft.pace.map((entry) => ({scene_ref: entry.scene_ref, dwell_seconds: entry.dwell_seconds})),
  };
}

/** The presence form of a pace draft, with its basis: the reading it was taken on and the Expression revision it stands at. */
export function draftForPresence(draft: SequenceDraft, reading_ref: string): JourneyPresenceDraft {
  return {
    basis_reading_ref: reading_ref,
    basis_revision: String(draft.revision),
    scene_order: [...draft.scene_order],
    pace: draft.pace.map((entry) => ({scene_ref: entry.scene_ref, dwell_seconds: entry.dwell_seconds})),
  };
}

/** A new, empty pace draft over the beats as they stand: the beat order taken as its basis, no pace set yet. */
export function newPaceDraft(expression_ref: string, revision: string, sceneRefs: readonly string[]): SequenceDraft {
  return {expression_ref, revision, scene_order: [...sceneRefs], pace: []};
}

/** Set one beat's pace in a draft. Refuses a value outside the Scene duration bounds, and a beat the draft does not hold. Pure: the
 * draft it returns is a new value, and nothing is saved here. */
export function setPace(draft: SequenceDraft, sceneRef: string, seconds: number): {ok: true; draft: SequenceDraft} | {ok: false; reason: string} {
  const rounded = roundPace(seconds);
  if (!Number.isFinite(rounded) || rounded < SCENE_DURATION_MIN || rounded > SCENE_DURATION_MAX) {
    return {ok: false, reason: `A beat holds for ${SCENE_DURATION_MIN}–${SCENE_DURATION_MAX} seconds.`};
  }
  try {
    return {ok: true, draft: paceBeat(draft, sceneRef, rounded)};
  } catch (cause) {
    return {ok: false, reason: message(cause)};
  }
}

/** One beat whose saved duration the commit changes. `sceneId` is the journey scene id the timeline retimes by (the binding key). */
export interface PaceEdit {sceneId: string; sceneRef: string; from: number; seconds: number}
export type PaceCommitPlan = {ok: true; edits: PaceEdit[]; label: string} | {ok: false; reason: string};

/** The commit of a pace draft, as the edits it makes. A beat with no native binding or no authored material is refused by name, and
 * nothing is planned for the draft as a whole. A beat that already holds its paced seconds plans no edit. The label names the one
 * labelled step the commit makes. */
export function planPaceCommit(view: KernelConversion, draft: SequenceDraft): PaceCommitPlan {
  const edits: PaceEdit[] = [];
  for (const entry of draft.pace) {
    const binding = Object.entries(view.bindings).find(([, row]) => row.scene_ref === entry.scene_ref);
    if (!binding) return {ok: false, reason: `Scene ${entry.scene_ref} has no native binding in this Expression, so its pace cannot be saved.`};
    const from = savedDuration(view, entry.scene_ref);
    if (from === null) return {ok: false, reason: `Scene ${entry.scene_ref} has no authored native material to retime, so its pace cannot be saved.`};
    if (from === entry.dwell_seconds) continue;
    edits.push({sceneId: binding[0], sceneRef: entry.scene_ref, from, seconds: entry.dwell_seconds});
  }
  const count = edits.length;
  return {ok: true, edits, label: count === 0 ? 'Set beat pace' : `Set beat pace · ${count} ${count === 1 ? 'beat' : 'beats'}`};
}

/** What the instrument shows of the pace: no draft, a draft that stands on the disclosed basis, or a stale draft that is named and not
 * applied. Each beat carries its saved duration; a current draft also carries its paced seconds by beat. */
export interface JourneyPaceView {
  standing: 'none' | 'draft' | 'stale';
  /** The beats the current draft paces, by scene_ref, in seconds. Empty when there is no current draft. */
  drafted: Record<string, number>;
  /** Each beat's saved duration, by scene_ref; null where the Scene carries no authored material. */
  saved: Record<string, number | null>;
  /** The Expression revision the draft was taken at (named when stale). */
  basisRevision: string | null;
  /** How many beats the draft paces. */
  count: number;
  /** Beats can be paced only when every beat names a distinct scene. */
  paceable: boolean;
  /** Saving needs the owner's commit channel, which the host supplies. */
  canSave: boolean;
  /** Bumped on each discard, re-apply and save, so the beat inputs remount to show the value now held. */
  epoch: number;
}

/** The pace view of the beats as they stand, with the saved draft read against its basis. */
export function paceViewOf(input: {
  view: KernelConversion;
  sceneRefs: readonly string[];
  stored: {standing: 'current' | 'stale'; draft: JourneyPresenceDraft} | undefined;
  canSave: boolean;
  epoch: number;
}): JourneyPaceView {
  const saved = Object.fromEntries(input.sceneRefs.map((ref) => [ref, savedDuration(input.view, ref)]));
  const paceable = input.sceneRefs.length > 0 && new Set(input.sceneRefs).size === input.sceneRefs.length;
  const base = {saved, paceable, canSave: input.canSave, epoch: input.epoch};
  if (!input.stored) return {...base, standing: 'none', drafted: {}, basisRevision: null, count: 0};
  const {draft, standing} = input.stored;
  const count = draft.pace.length;
  if (standing === 'stale') return {...base, standing: 'stale', drafted: {}, basisRevision: draft.basis_revision, count};
  return {
    ...base,
    standing: 'draft',
    drafted: Object.fromEntries(draft.pace.map((entry) => [entry.scene_ref, entry.dwell_seconds])),
    basisRevision: draft.basis_revision,
    count,
  };
}
