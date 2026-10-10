/** Object-state fold (app.ts 'fold-state' and 'confirm-fold' over foldState.ts foldObjectState). One admitted change
 * copies one state of a formation in the presented Scene into a formation of an EARLIER Scene, through the app's own pure
 * fold. The shell's one deliberate difference is remove_source: it removes the state from its own formation (refused when
 * it is that formation's last state). The app instead removes the whole working Scene, which no admitted change can do. */
import {foldObjectState} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/foldState';
import {blueprintMember} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry';
import {clone, validateJourney, type Journey} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import type {NativeFoldChange, NativeFoldTarget} from './editor.ts';

/** The three playback modes of the app's fold dialog (app.ts 'fold-mode' select). The dialog default is seconds. */
export const FOLD_MODES = ['seconds', 'morph', 'manual'] as const;
/** A formation holds at most this many states (foldState.ts and nativeGlyph step-insert). */
export const FORMATION_STATE_LIMIT = 32;
const KEYS = ['kind', 'entity_id', 'step_id', 'target_entity_id', 'remove_source', 'mode'];

/** Formations of EARLIER Scenes the presented Scene's state may be copied into: unlocked, under the state budget and not
 * blueprint members. Mirrors the app's destination list (app.ts 'fold-state'), with the shell's extra refusals. */
export function readNativeFoldTargets(journey: Journey, sceneId: string): NativeFoldTarget[] {
  const index = journey.scenes.findIndex(scene => scene.id === sceneId);
  if (index < 0) return [];
  return journey.scenes.slice(0, index).flatMap(scene => scene.entities
    .filter(entity => entity.kind === 'formation' && !entity.locked && entity.sequence.steps.length < FORMATION_STATE_LIMIT && !blueprintMember(scene, entity.id))
    .map(entity => ({scene_id: scene.id, scene_title: scene.name, entity_id: entity.id, entity_name: entity.name, steps: entity.sequence.steps.length})));
}

/** Wire check for NativeEditorReading.foldTargets (editorHost.ts). A reading without it is an older one: none is offered. */
export function isNativeFoldTargets(value: unknown): value is NativeFoldTarget[] {
  return Array.isArray(value) && value.every(row => !!row && typeof row === 'object'
    && typeof (row as NativeFoldTarget).scene_id === 'string' && typeof (row as NativeFoldTarget).scene_title === 'string'
    && typeof (row as NativeFoldTarget).entity_id === 'string' && typeof (row as NativeFoldTarget).entity_name === 'string'
    && Number.isInteger((row as NativeFoldTarget).steps) && (row as NativeFoldTarget).steps >= 1 && (row as NativeFoldTarget).steps <= FORMATION_STATE_LIMIT);
}

/** A state fold carries only its two entities, the state, and its options. Foreign operands are refused. */
export function validateNativeFoldChange(change: unknown): NativeFoldChange {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose a state and an earlier formation to fold it into.');
  const row = change as Record<string, unknown>;
  if (Object.keys(row).some(key => !KEYS.includes(key))) throw Error('A state fold carries only its state, its destination and its options.');
  if (row.kind !== 'state-fold' || typeof row.entity_id !== 'string' || typeof row.step_id !== 'string' || typeof row.target_entity_id !== 'string')
    throw Error('Choose a state and an earlier formation to fold it into.');
  if (row.remove_source !== undefined && typeof row.remove_source !== 'boolean') throw Error('Remove-after-fold is a yes or no choice.');
  if (row.mode !== undefined && !(FOLD_MODES as readonly unknown[]).includes(row.mode)) throw Error('Choose an admitted playback mode for the destination.');
  return change as NativeFoldChange;
}

/** Atomic copy over the whole Journey. Every change is validated against the document it will see, so a refused second
 * fold cannot leak the first one into the caller's document. */
export function applyNativeStateFoldChanges(journey: Journey, sceneId: string, changes: readonly NativeFoldChange[]): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > 64) throw Error('Choose between 1 and 64 state folds.');
  const draft = clone(journey);
  for (const raw of changes) {
    const change = validateNativeFoldChange(raw);
    const sourceIndex = draft.scenes.findIndex(scene => scene.id === sceneId);
    if (sourceIndex < 0) throw Error('The addressed Scene is no longer in this Expression.');
    const scene = draft.scenes[sourceIndex];
    const source = scene.entities.find(entity => entity.id === change.entity_id);
    if (!source || source.kind !== 'formation') throw Error('Choose a formation in this scene. Read it again.');
    if (source.locked) throw Error('Unlock this formation before folding one of its states.');
    if (blueprintMember(scene, source.id)) throw Error('Use Blueprint to change this shape, or release it before folding its state.');
    const stepIndex = source.sequence.steps.findIndex(step => step.id === change.step_id);
    if (stepIndex < 0) throw Error('The selected stable state no longer exists');
    if (change.remove_source && source.sequence.steps.length <= 1) throw Error('Keep at least one state in this formation');
    const owners = draft.scenes.filter(candidate => candidate.entities.some(entity => entity.id === change.target_entity_id));
    if (owners.length !== 1) throw Error('The destination formation is no longer in this Expression. Read it again.');
    const [to] = owners;
    if (draft.scenes.indexOf(to) >= sourceIndex) throw Error('Choose an earlier scene.');
    const target = to.entities.find(entity => entity.id === change.target_entity_id)!;
    if (target.kind !== 'formation') throw Error('Choose a formation in each scene.');
    if (target.locked) throw Error('Unlock the destination formation first.');
    if (blueprintMember(to, target.id)) throw Error('The destination formation belongs to a Blueprint. Release it before adding a state.');
    if (target.sequence.steps.length >= FORMATION_STATE_LIMIT) throw Error('A formation holds up to 32 states.');
    // The app's own pure fold: copies layers, offset, timing, name, overrides and source into a fresh state id.
    foldObjectState(draft, scene.id, source.id, stepIndex, to.id, target.id, change.mode ?? 'seconds', false);
    // A copied native link identity belongs to its original occurrence (the step-duplicate rule).
    const added = target.sequence.steps[target.sequence.steps.length - 1];
    delete added.native;
    if (change.remove_source) {
      const origin = scene.entities.find(entity => entity.id === change.entity_id)!;
      origin.sequence.steps = origin.sequence.steps.filter(step => step.id !== change.step_id);
    }
  }
  return validateJourney(draft);
}
