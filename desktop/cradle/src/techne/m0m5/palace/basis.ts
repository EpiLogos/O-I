/**
 * The Palace's native basis, its readback check, the owner's document and edit replies, and its trail step (lane-5 T16, T20) —
 * the owner-seam halves of what the frame's Palace lens held, moved here when palaces moved onto the atlas
 * (T-PALACES-ONTO-ATLAS, FOUNDATION §3 N4). Pure apart from the trail step, which writes only through the session store it is given.
 *
 * Moved, each from the frame at fdc302870:
 *   - `assertPalaceSource` and `samePalaceComposition`, verbatim from `field-studies-journeys/src/palaceInstrumentBasis.ts:12-19`.
 *     The frame took its basis from its own KernelConversion (`palaceInstrumentBasis(view, sceneId)`); a surface without one takes
 *     it from the owner's inspected document and the Scene it reads the whole at (`palaceBasisOf`);
 *   - `palaceSnapshot` and `palaceComposeReply`, from the frame's wiring of the kernel Expression owner (`app.ts:2730`, `:2737`):
 *     the document facts `planRegions` diffs against, and the owner's answer to the one CAS-gated edit;
 *   - `palaceTrailStep`, the law of the boundary's Palace hop (timeWindow.ts `palaceHop`, which the frame reached through
 *     `palaceHop.ts` and the `techne-time-window` channel; the hop retired with the frame's Palace lens in #762 at 522a8a9c7, and this
 *     is now the one place the law stands): an Open on a Palace object records one endpoint hop on the session's one history, only while
 *     the session stands on this Palace's own reading and on the Expression instrument; anything else is refused by name and nothing is
 *     recorded.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {validateSession, type TechneReading} from '../../contract.ts';
import type {DisclosureSessionStore} from '../../session.ts';
import type {PalaceChange, PalaceDocumentSnapshot, PalaceRegionSpec} from './composition.ts';

/** The exact native basis a Palace is read at: its Expression, the revision the owner disclosed, and the Scene the whole is read through. */
export interface PalaceBasis {expression_ref: string; revision: number; scene_ref: string}

/** The basis of an inspected Palace document at one of its own Scenes. A Scene the document does not carry is refused by name. */
export function palaceBasisOf(doc: PalaceDocumentSnapshot, sceneRef: string): PalaceBasis {
  if (!doc.scenes.some((scene) => scene.scene_ref === sceneRef)) throw Error('Open a native Scene before entering the Palace');
  return {expression_ref: doc.expression_ref, revision: doc.revision, scene_ref: sceneRef};
}

/** The owner's document must be the source, revision and Scene the basis names, with no Scene listed twice (palaceInstrumentBasis.ts:12). */
export function assertPalaceSource(doc: PalaceDocumentSnapshot, basis: PalaceBasis): void {
  if (!doc || doc.expression_ref !== basis.expression_ref || doc.revision !== basis.revision || !Array.isArray(doc.scenes)
    || !doc.scenes.some((scene) => scene.scene_ref === basis.scene_ref) || new Set(doc.scenes.map((scene) => scene.scene_ref)).size !== doc.scenes.length)
    throw Error('The Palace reading belongs to another native source, revision or Scene');
}

/** The readback after a Save names the same regions, in the same order, holding the same contained Expressions (palaceInstrumentBasis.ts:17). */
export function samePalaceComposition(proposed: readonly PalaceRegionSpec[], readback: readonly PalaceRegionSpec[]): boolean {
  return readback.length === proposed.length && readback.every((region, index) => region.name === proposed[index].name
    && (region.member?.expression_ref ?? null) === (proposed[index].member?.expression_ref ?? null));
}

/** A Palace document as the kernel Expression owner discloses it: the facts `planRegions` and `discoverRegions` read, with the title
 * (app.ts:2730 palaceSnapshot). A Scene's entities ride along so the rooms can name what they hold. */
export type PalaceDocument = PalaceDocumentSnapshot & {title: string; scenes: readonly (PalaceDocumentSnapshot['scenes'][number] & {entity_refs: readonly string[]})[]};

export function palaceSnapshot(raw: unknown): PalaceDocument {
  const doc = raw as {expression_ref: string; revision: number; title?: string; scenes?: {scene_ref: string; title?: string; entity_refs?: unknown;
    body?: {carrier?: string; subject_ref?: string} | null; triggers?: {trigger_ref: string; target?: {kind?: string; subject_ref?: string}}[]}[]};
  if (!doc || typeof doc !== 'object' || typeof doc.expression_ref !== 'string' || !Number.isSafeInteger(doc.revision)) {
    throw Error('The Expression owner returned no readable Palace document');
  }
  return {
    expression_ref: doc.expression_ref, revision: doc.revision, title: doc.title ?? doc.expression_ref,
    scenes: (doc.scenes ?? []).map((scene) => ({
      scene_ref: scene.scene_ref, title: scene.title ?? '',
      entity_refs: Array.isArray(scene.entity_refs) ? scene.entity_refs.filter((ref): ref is string => typeof ref === 'string') : [],
      body: scene.body ? {carrier: scene.body.carrier, subject_ref: scene.body.subject_ref} : null,
      triggers: (scene.triggers ?? []).map((trigger) => ({trigger_ref: trigger.trigger_ref,
        target: trigger.target ? {kind: trigger.target.kind, subject_ref: trigger.target.subject_ref} : undefined})),
    })),
  };
}

/** What a Save came back as: the owner's new document, or its refusal in words. */
export type PalaceComposeResult = {ok: true; document: PalaceDocument} | {ok: false; reason: string};

/** The owner's answer to the one CAS-gated `edit` (app.ts:2737): a revision conflict and a refused edit are said, never retried. */
export function palaceComposeReply(data: unknown): PalaceComposeResult {
  const reply = data as {state?: string; current_revision?: number; document?: unknown} | null;
  if (reply?.state === 'revision_conflict') return {ok: false, reason: `This Palace changed elsewhere (now revision ${reply.current_revision}). Nothing was saved; reopen it and try again.`};
  if (!reply?.document || reply.state !== 'ready') return {ok: false, reason: `The Expression owner did not accept the composition (${String(reply?.state)}).`};
  return {ok: true, document: palaceSnapshot(reply.document)};
}

/** The one edit a Save sends: the plan's changes, CAS-gated on the revision the draft began at, attributed to the Palace's human actor. */
export function palaceEditRequest(expression_ref: string, expected_revision: number, changes: PalaceChange[]) {
  return {operation: 'edit' as const, expression_ref, expected_revision, actor: 'human:techne-palace', changes};
}

/** Record one Palace trail step on the session's one history (the law of the retired boundary hop, timeWindow.ts palaceHop before #762). The session must stand on this
 * Palace's own reading and on the Expression instrument; otherwise the step is refused by name and nothing is recorded. */
export function palaceTrailStep(store: DisclosureSessionStore, reading: TechneReading, ref: string): void {
  if (typeof ref !== 'string' || !ref.trim() || ref.length > 2048) throw Error('A Palace trail step names one object ref');
  const before = store.get();
  if (!before) throw Error('No shared session stands, so the Palace trail step was not recorded');
  const checked = validateSession(before);
  if (!checked.valid) throw Error(`The shared session drifted: ${checked.errors.join('; ')}`);
  if (before.subject_ref !== reading.subject.subject_ref || before.reading_ref !== reading.reading_ref) {
    throw Error('the shared session stands on another subject or reading, so the Palace trail step was not recorded');
  }
  if (before.instrument !== 'expressions') throw Error('Palace trail step refused: the session is not on the Expression reading; nothing was recorded');
  store.recordTraversal({kind: 'traversal', instrument: 'expressions', step: 'endpoint', ref, subject_ref: before.subject_ref, selection_ref: before.selection.selection_ref});
}
