/** Chosen controls belong to Journey.shared.toolbelt. Resolution is a reading;
 * list edits are adopted by the existing DocumentStore/NativeWorkspace owner. */
import type {NativeChosenControlChange, NativeChosenControlsReading, NativeChosenControlReading} from './editor';
import {NATIVE_BINDINGS, baseValue, entityTargets} from './parameters';
import {clone, uid, validateJourney, type Journey, type Scene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import type {BeltEntry} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/workspacePreferences';
import {effectiveScene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings';
import {blueprintMember} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/blueprintGeometry';

interface Resolution {
  entity_ids: readonly string[];
  entityOccurrences: Readonly<Record<string, string>>;
  nativePinned?: ReadonlySet<string>;
  effectiveValues?: Readonly<Record<string, number>>;
}
const selectedEntity = (scene: Scene, ids: readonly string[]) => scene.entities.find(e => e.id === ids[0]);
const scalar = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function readNativeChosenControls(document: Journey, scene: Scene, resolution: Resolution): NativeChosenControlsReading {
  const entries = clone(document.shared?.toolbelt ?? []), projected = effectiveScene(document, scene), targets = entityTargets(projected);
  const controls = entries.map((entry): NativeChosenControlReading => {
    const empty = (reason: string): NativeChosenControlReading => ({entry_id: entry.id, target: null, binding: null, entity_id: null, native_ref: null, base_value: null, effective_value: null, locked: false, unavailable_reason: reason});
    if (entry.scope === 'field') {
      const binding = NATIVE_BINDINGS.find(b => b.key === entry.key);
      if (!binding) return empty('This retained Field property has no native definition');
      const target = 'field.' + binding.key;
      return {entry_id: entry.id, target, binding: clone(binding), entity_id: null, native_ref: null, base_value: baseValue(projected, binding.key), effective_value: scalar(resolution.effectiveValues?.[target]), locked: false, unavailable_reason: null};
    }
    // Named identity follows the native entity mapping. Legacy sceneId/journeyId
    // are retained unchanged; they were not authoritative write addresses in
    // the original toolbelt and are not invented as new authority here.
    const entity = entry.scope === 'selected' ? selectedEntity(projected, resolution.entity_ids) : projected.entities.find(e => e.id === entry.entityId);
    if (!entity) return empty(entry.scope === 'named' ? 'The bound object is absent from this Scene' : 'Select an object for this Follow control');
    const binding = targets.find(t => t.entityId === entity.id && t.key === entry.key);
    if (!binding) return empty('This retained object property has no native definition in this Scene');
    const nativeRef = resolution.entityOccurrences[entity.id];
    if (!nativeRef) return empty('This object has no admitted native occurrence in this Scene');
    const position = ['x', 'y', 'z'].includes(binding.key);
    return {entry_id: entry.id, target: binding.target, binding: clone(binding), entity_id: entity.id, native_ref: nativeRef,
      base_value: binding.value, effective_value: scalar(resolution.effectiveValues?.[binding.target]),
      locked: !!entity.locked || position && (!!blueprintMember(projected, entity.id) || !!resolution.nativePinned?.has(nativeRef)), unavailable_reason: null};
  });
  return {available: !!document.shared, entries, controls};
}

/** Validates the complete batch before adoption. Unknown/absent old entries
 * remain retained and can be removed; new pins require native definitions. */
export function applyNativeChosenControlChanges(document: Journey, sceneId: string, changes: readonly NativeChosenControlChange[], selection: readonly string[], entityOccurrences: Readonly<Record<string, string>>): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > 64) throw Error('Supply one bounded chosen-control transaction');
  const next = clone(document), scene = next.scenes.find(s => s.id === sceneId);
  if (!scene) throw Error('The captured Scene no longer exists');
  if (!next.shared) throw Error('The retained Expression has no shared toolbelt owner');
  const entries = next.shared.toolbelt;
  const entityFor = (scope: 'selected' | 'named', id?: string) => {
    const entity = scope === 'selected' ? selectedEntity(scene, selection) : scene.entities.find(e => e.id === id);
    if (!entity || !entityOccurrences[entity.id]) throw Error('Choose an admitted native object in this Scene');
    return entity;
  };
  const admit = (key: string, scope: BeltEntry['scope'], id?: string) => {
    if (typeof key !== 'string' || !key || key.length > 200) throw Error('Choose a defined native property');
    if (scope === 'field') {if (!NATIVE_BINDINGS.some(b => b.key === key)) throw Error('This Field property has no native definition'); return;}
    if (scope !== 'selected' && scope !== 'named') throw Error('Choose Field, Follow or Bind scope');
    const entity = entityFor(scope, id);
    if (!entityTargets(scene).some(t => t.entityId === entity.id && t.key === key)) throw Error('This object property has no native definition');
    return entity;
  };
  for (const change of changes) {
    if (change.kind === 'chosen-add') {
      const entity = admit(change.key, change.scope, change.entity_id);
      if (entries.some(e => e.key === change.key && e.scope === change.scope && (change.scope !== 'named' || e.entityId === entity?.id))) throw Error('This property is already chosen in this scope');
      entries.push({id: uid('belt'), key: change.key, scope: change.scope, ...(change.scope === 'named' ? {entityId: entity!.id, sceneId: scene.id, journeyId: next.id} : {})});
    } else if (change.kind === 'chosen-remove') {
      const index = entries.findIndex(e => e.id === change.entry_id);
      if (index < 0) throw Error('The chosen control no longer exists');
      entries.splice(index, 1);
    } else if (change.kind === 'chosen-order') {
      if (!Array.isArray(change.entry_ids) || change.entry_ids.length !== entries.length || new Set(change.entry_ids).size !== entries.length || change.entry_ids.some((id: string) => !entries.some(e => e.id === id))) throw Error('Reordering must retain every chosen control exactly once');
      const byId = new Map(entries.map(e => [e.id, e])); entries.splice(0, entries.length, ...change.entry_ids.map((id: string) => byId.get(id)!));
    } else if (change.kind === 'chosen-scope') {
      const entry = entries.find(e => e.id === change.entry_id);
      if (!entry || entry.scope === 'field') throw Error('Choose an existing object control to Follow or Bind');
      if (change.scope !== 'selected' && change.scope !== 'named') throw Error('Choose Follow or Bind scope');
      const entity = admit(entry.key, change.scope, change.entity_id);
      if (entries.some(e => e.id !== entry.id && e.key === entry.key && e.scope === change.scope && (change.scope !== 'named' || e.entityId === entity?.id))) throw Error('This property is already chosen in this scope');
      entry.scope = change.scope;
      if (change.scope === 'named') Object.assign(entry, {entityId: entity!.id, sceneId: scene.id, journeyId: next.id});
      else {delete entry.entityId; delete entry.sceneId; delete entry.journeyId;}
    } else throw Error('Unsupported chosen-control operation');
  }
  return validateJourney(next);
}
