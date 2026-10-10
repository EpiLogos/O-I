import type {Journey, Scene, NativeDeviceChange} from './editor.ts';
import {clone, validateJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {applyNativeDeviceChanges} from './nativeDeviceEdits';
import {nativeRackMappingValue, rackDiscretePath, resolveNativeRackTarget, validateNativeRackState, type NativeParameterRack, type NativeRackChange, type NativeRackScene, type NativeRackTarget, type NativeRackMapping} from './nativeRackSchema';

export function readNativeRacks(scene: Scene, occurrences: Readonly<Record<string, string>>) {return validateNativeRackState((scene as NativeRackScene).parameterRacks, scene, occurrences);}

/** A rack is an authored set of native parameter relationships. One gesture
 * commits its source control and all mapped parameters together; the existing
 * device reducer preserves replacing automation clocks and shared laws.
 * The retained receiver supplies authorizeTarget for native-only constraints
 * such as pinned occurrences; throwing refuses the whole cloned gesture. */
export function applyNativeRackChanges(journey: Journey, sceneId: string, changes: readonly NativeRackChange[], occurrences: Readonly<Record<string, string>>, observed: Readonly<Record<string, number>> = {}, authorizeTarget?: (target: NativeRackTarget, mapping: Readonly<NativeRackMapping>, nativeValue: number) => void): Journey {
  if (!Array.isArray(changes) || !changes.length || changes.length > 64) throw Error('Choose between 1 and 64 rack operations.');
  let draft = clone(journey);
  const touched = new Set<string>();
  const getScene = () => {const scene = draft.scenes.find(value => value.id === sceneId); if (!scene) throw Error('The native rack Scene no longer exists.'); return scene as NativeRackScene;};
  const getState = () => readNativeRacks(getScene(), occurrences);
  const getRack = (id: string) => {const state = getState(), rack = state.racks.find(value => value.id === id); if (!rack) throw Error('The native parameter rack no longer exists.'); return {state, rack};};
  const writable = (rack: NativeParameterRack) => {
    if (rack.scope.kind === 'entity') {const ref = rack.scope.entity_ref, ids = Object.keys(occurrences).filter(id => occurrences[id] === ref);
      if (ids.length !== 1 || !getScene().entities.some(value => value.id === ids[0])) throw Error('This rack belongs to an off-page native entity. Return to its Scene before editing.');
      if (getScene().entities.find(value => value.id === ids[0])!.locked) throw Error('Unlock the native entity before editing its rack.');}
  };
  const writeValues = (rack: NativeParameterRack, values: Record<string, number>, excluded = new Set<string>()) => {
    const edits: NativeDeviceChange[] = [];
    for (const macro of rack.macros) {
      if (excluded.has(macro.id) || !(macro.id in values)) continue;
      const value = values[macro.id];
      if (!Number.isFinite(value) || value < 0 || value > 1) throw Error('Macro values must be between 0 and 1.');
      for (const mapping of macro.mappings) {
        const binding = resolveNativeRackTarget(getScene(), occurrences, mapping.target);
        if (touched.has(binding.target)) throw Error('A rack gesture cannot write the same native target twice.');
        touched.add(binding.target);
        let nativeValue = nativeRackMappingValue(mapping, value);
        if (rackDiscretePath(binding.path)) nativeValue = Math.round(nativeValue);
        authorizeTarget?.(clone(mapping.target), clone(mapping), nativeValue);
        edits.push({kind: 'parameter', target: binding.target, value: nativeValue / binding.factor});
      }
      macro.value = value;
    }
    if (edits.length) draft = applyNativeDeviceChanges(draft, sceneId, edits, observed);
  };
  for (const change of changes) {
    if (change.kind === 'rack-set') {
      const previous = getState().racks.find(value => value.id === change.rack.id);
      if (previous && (previous.scope.kind !== change.rack.scope.kind || previous.scope.kind === 'entity' && (change.rack.scope.kind !== 'entity' || previous.scope.entity_ref !== change.rack.scope.entity_ref))) throw Error('A retained rack cannot be rebound to another native scope.');
      writable(change.rack);
      const state = getState(), index = state.racks.findIndex(value => value.id === change.rack.id);
      if (index < 0) state.racks.push(clone(change.rack)); else state.racks[index] = clone(change.rack);
      getScene().parameterRacks = validateNativeRackState(state, getScene(), occurrences);
      continue;
    }
    const {state, rack} = getRack(change.rack_id);
    writable(rack);
    if (change.kind === 'rack-remove') state.racks = state.racks.filter(value => value.id !== rack.id);
    else if (change.kind === 'rack-exclusions') rack.excluded = clone(change.macro_ids);
    else if (change.kind === 'rack-macro-value') {
      if (!rack.macros.some(value => value.id === change.macro_id)) throw Error('The mapped macro no longer exists.');
      writeValues(rack, {[change.macro_id]: change.value});
    } else if (change.kind === 'rack-variation-capture') {
      const variation = {id: change.variation_id, name: change.name, values: Object.fromEntries(rack.macros.map(value => [value.id, value.value])), excluded: [...rack.excluded]};
      const index = rack.variations.findIndex(value => value.id === change.variation_id);
      if (index < 0) rack.variations.push(variation); else rack.variations[index] = variation;
    } else if (change.kind === 'rack-variation-recall') {
      const variation = rack.variations.find(value => value.id === change.variation_id);
      if (!variation) throw Error('The native rack variation no longer exists.');
      writeValues(rack, variation.values, new Set([...rack.excluded, ...variation.excluded]));
    } else if (change.kind === 'rack-variation-remove') {
      if (!rack.variations.some(value => value.id === change.variation_id)) throw Error('The native rack variation no longer exists.');
      rack.variations = rack.variations.filter(value => value.id !== change.variation_id);
    } else throw Error('This operation belongs to another native editor.');
    getScene().parameterRacks = validateNativeRackState(state, getScene(), occurrences);
  }
  return validateJourney(draft);
}
