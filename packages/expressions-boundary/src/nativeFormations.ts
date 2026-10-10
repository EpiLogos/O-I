/** Formation add: one native edit that creates a formation in the open Scene.
 * Shapes are the add picker's (app.ts shape picker, 'text' is Glyph or word);
 * yantra and cymatic need a sub-field the picker does not carry, so they stay
 * inspector-only. The reducer builds the entity the app's add path builds
 * (app.ts pointer add: entity() + shape + step-0 shape + glyph refit). Pure:
 * no DOM, no I/O. The 32-entity budget is the app's (formations and pins). */
import type {Journey, Vec3, NativeFormationChange, NativeFormationShape, NativeObjectChange} from './editor.ts';
import {clone, uid, validateJourney, type Entity} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {blueprintMember} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry';
import {pruneAutomation} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeParameters';

export const FORMATION_ADD_SHAPES: readonly NativeFormationShape[] = ['text', 'ring', 'disc', 'triangle', 'square'];
export const FORMATION_SCENE_LIMIT = 32;
const FORMATION_KEYS = ['kind', 'title', 'shape', 'text', 'position'];
const STAGE_LIMIT = 50;

export interface FormationAddSpec {title: string; shape: NativeFormationShape; text: string; position: Vec3}

/** Admit one formation-add exactly, or refuse with the legible reason. Defaults mirror the app's
 * picker: shape 'text', glyph 'O' (an empty or blank glyph is 'O'), name 'New formation' for 'O'. */
export function validateFormationAdd(change: unknown): FormationAddSpec {
  if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose an admitted formation to add.');
  const row = change as Record<string, unknown>;
  if (row.kind !== 'formation-add' || Object.keys(row).some(key => !FORMATION_KEYS.includes(key))) throw Error('A formation add carries only its shape, glyph, name and position.');
  const shape = row.shape === undefined ? 'text' : row.shape;
  if (!FORMATION_ADD_SHAPES.includes(shape as NativeFormationShape)) throw Error('Choose a formation shape the add form offers: glyph or word, ring, disc, triangle or plane.');
  if (shape !== 'text' && row.text !== undefined) throw Error('Only a glyph or word takes text.');
  const glyph = shape === 'text' ? (typeof row.text === 'string' ? row.text.trim() || 'O' : row.text === undefined ? 'O' : '') : 'O';
  if (!glyph || glyph.length > 120) throw Error('Give the glyph or word 1–120 characters.');
  const title = row.title === undefined ? (glyph === 'O' ? 'New formation' : glyph) : typeof row.title === 'string' ? row.title.trim() : '';
  if (!title || title.length > 160) throw Error('Name the formation using 1–160 characters.');
  const position: Vec3 = row.position === undefined ? {x: 0, y: 0, z: 0} : row.position as Vec3;
  if (!position || typeof position !== 'object' || !(['x', 'y', 'z'] as const).every(axis => Number.isFinite(position[axis]) && Math.abs(position[axis]) <= STAGE_LIMIT))
    throw Error('A formation position must have three finite stage coordinates within ±50.');
  return {title, shape: shape as NativeFormationShape, text: glyph, position: {x: position.x, y: position.y, z: position.z}};
}

/** The app's add-path entity for one spec: the frame's own function (formationPlacement.ts), which the pointer add also calls. */
export {formationFromSpec} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/formationPlacement';
import {formationFromSpec} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/formationPlacement';

/** Named formation additions over one Scene. One call is one owner transaction; the caller commits once. */
export function applyNativeFormationChanges(journey: Journey, sceneId: string, changes: readonly NativeFormationChange[]): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > FORMATION_SCENE_LIMIT) throw Error('Choose between 1 and 32 formation additions.');
  const draft = clone(journey), scene = draft.scenes.find(value => value.id === sceneId);
  if (!scene) throw Error('The addressed Scene is no longer in this Expression.');
  for (const change of changes) {
    const spec = validateFormationAdd(change);
    if (scene.entities.length >= FORMATION_SCENE_LIMIT) throw Error('A scene holds up to 32 formations and pins.');
    scene.entities.push(formationFromSpec(spec, scene.engine));
  }
  validateJourney(draft);
  return draft;
}

/** The app's duplicate (app.ts duplicateEntity): a clone named '<name> copy', offset by (+0.12, -0.12),
 * unlocked, with fresh entity and state identities. A native link belongs to its original occurrence,
 * so it is not copied (the same rule as step-duplicate). */
export function duplicateSceneEntity(source: Entity): Entity {
  const copy = clone(source);
  copy.id = uid('entity');
  copy.name += ' copy';
  copy.position = {x: copy.position.x + 0.12, y: copy.position.y - 0.12, z: copy.position.z};
  copy.locked = false;
  delete copy.native;
  copy.sequence.steps.forEach(step => { step.id = uid('step'); });
  return copy;
}

/** Whole-object operations over one Scene. Remove mirrors app.ts deleteEntities: refused for a blueprint
 * member or a locked entity, and automation lanes left without a target are pruned with it. Duplicate
 * mirrors duplicateEntity and is bounded by the 32-entity Scene budget. Pure; one call is one transaction. */
export function applyNativeObjectChanges(journey: Journey, sceneId: string, changes: readonly NativeObjectChange[]): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > FORMATION_SCENE_LIMIT) throw Error('Choose between 1 and 32 object changes.');
  const draft = clone(journey), scene = draft.scenes.find(value => value.id === sceneId);
  if (!scene) throw Error('The addressed Scene is no longer in this Expression.');
  for (const change of changes) {
    if (!change || typeof change !== 'object' || Array.isArray(change)) throw Error('Choose an admitted object change.');
    const row = change as unknown as Record<string, unknown>;
    if ((row.kind !== 'entity-duplicate' && row.kind !== 'entity-remove') || Object.keys(row).some(key => key !== 'kind' && key !== 'entity_id') || typeof row.entity_id !== 'string')
      throw Error('An object change carries only its kind and entity.');
    const index = scene.entities.findIndex(value => value.id === row.entity_id);
    if (index < 0) throw Error('This entity no longer belongs to this Scene.');
    const entity = scene.entities[index];
    if (row.kind === 'entity-remove') {
      if (blueprintMember(scene, entity.id)) throw Error('Release the blueprint before removing one of its members.');
      if (entity.locked) throw Error('Unlock this entity before removing it.');
      scene.entities.splice(index, 1);
      pruneAutomation(scene);
    } else {
      if (scene.entities.length >= FORMATION_SCENE_LIMIT) throw Error('A scene holds up to 32 formations and pins.');
      scene.entities.push(duplicateSceneEntity(entity));
    }
  }
  validateJourney(draft);
  return draft;
}
