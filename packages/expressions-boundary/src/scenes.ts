import type {Journey, Scene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import type {KernelConversion, OccurrenceBinding} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge';
import {sceneSaveState} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneWorkflow';
import {expressionTiming} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/propertyTracks';

/** Supplied by the retained app's transport owner. This module never advances,
 * seeks or converts a clock, and simulation time is not sequence time. */
export interface NativeScenePlaybackReading {
  scene_ref: string;
  scene_elapsed_seconds: number;
  expression_time_seconds: number;
  scene_playing: boolean;
  saved_sequence_playing: boolean;
  field_paused: boolean;
  track_preview: boolean;
}

export interface NativeSceneMemberReading {
  entity_ref: string;
  local_entity_id: string | null;
  /** Absent means not present in this working material, not deleted natively.
   * Saved-only and retained hidden membership remain in member_refs. */
  state: 'loaded' | 'unloaded' | 'absent';
  occurrence: OccurrenceBinding | null;
}

export interface NativeSceneReading {
  scene_ref: string;
  local_scene_id: string | null;
  native_title: string;
  title: string;
  working: {duration: number; transition: number} | null;
  snapshot: {availability: 'present' | 'absent' | 'unavailable'; duration: number | null;
    standing: ReturnType<typeof sceneSaveState> | null};
  material: {available: boolean; reason: string | null};
  member_refs: string[];
  members: NativeSceneMemberReading[];
  membership: {complete: boolean; page: number | null; page_count: number | null;
    unloaded_refs: string[]; unbound_local_entity_ids: string[]; reason: string | null};
}

export type NativeSceneTimingReading =
  | {available: true; total_seconds: number;
      extents: {scene_ref: string; start_seconds: number; duration_seconds: number; transition_seconds: number}[]}
  | {available: false; reason: string; missing_scene_refs: string[]; unbound_local_scene_ids: string[]};

export interface NativeScenesReading {
  schema: 'oi.native-scenes/v1';
  basis: {expression_ref: string; revision: number};
  title: string;
  /** The Expression description of the working Journey (journey.description). Empty is a real value. */
  description: string;
  /** The saved-sequence loop flag of the working Journey (journey.loop). */
  loop: boolean;
  native_selected_scene_ref: string | null;
  native_order: string[];
  object_titles: Record<string,string>;
  /** Null entries are local drafts without a captured native Scene identity. */
  working_order: (string | null)[];
  unbound_local_scene_ids: string[];
  scenes: NativeSceneReading[];
  completeness: {order: boolean; material: boolean; occurrences: boolean};
  timing: {working: NativeSceneTimingReading; saved: NativeSceneTimingReading};
}

const sameRefs = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((ref, index) => ref === b[index]);
const validTiming = (scene: Scene | undefined): scene is Scene => !!scene &&
  Number.isFinite(scene.duration) && scene.duration >= 1 && scene.duration <= 3600 &&
  Number.isFinite(scene.transition) && scene.transition >= 0 && scene.transition <= 30;

/** Project the existing authoring owners; no storage, native writes or new
 * document. Conversion compatibility defaults are not authored pacing. */
export function projectNativeScenes(journey: Journey, view: KernelConversion): NativeScenesReading {
  if (journey.id !== view.journey.id) throw Error('The working Journey does not address this captured native Expression');
  const nativeOrder = view.document.scenes.map(scene => scene.scene_ref);
  if (new Set(nativeOrder).size !== nativeOrder.length) throw Error('Native Scene identity is ambiguous');
  const nativeRefs = new Set(nativeOrder);
  const bindings = new Map<string, {id: string; binding: KernelConversion['bindings'][string]}>();
  const localRefs = new Map<string, string>();
  for (const [id, binding] of Object.entries(view.bindings)) {
    if (!nativeRefs.has(binding.scene_ref)) continue;
    if (bindings.has(binding.scene_ref)) throw Error('Two local Scenes address the same native Scene');
    bindings.set(binding.scene_ref, {id, binding});
    localRefs.set(id, binding.scene_ref);
  }
  const localScenes = new Map(journey.scenes.map(scene => [scene.id, scene]));
  if (localScenes.size !== journey.scenes.length) throw Error('Working Scene identity is ambiguous');
  const workingOrder = journey.scenes.map(scene => localRefs.get(scene.id) ?? null);
  const unbound = journey.scenes.filter(scene => !localRefs.has(scene.id)).map(scene => scene.id);
  const rows = view.document.scenes.map((native): NativeSceneReading => {
    const captured = bindings.get(native.scene_ref), local = captured && localScenes.get(captured.id);
    const binding = captured?.binding;
    const presentation = native.presentation;
    const available = !!local && validTiming(local) && presentation?.schema === 'oi.journey-scene/v1' && validTiming(presentation.scene);
    const reason = !captured ? 'Native Scene correspondence is not loaded' : !local ? 'The working Scene is not loaded' :
      presentation?.schema !== 'oi.journey-scene/v1' ? 'No authored native Scene material is disclosed' :
      !available ? 'Scene pacing is unavailable or outside its owner bounds' : null;
    const occurrences = new Map(binding?.occurrences.map(row => [row.entity_ref, row]) ?? []);
    const loaded = new Set(binding?.loaded_refs ?? []), hidden = new Set(binding?.hidden_refs ?? []);
    const localEntities = new Set(local?.entities.map(entity => entity.id) ?? []);
    const members = native.entity_refs.map((entity_ref): NativeSceneMemberReading => {
      const occurrence = occurrences.get(entity_ref), localId = view.entity_ids[entity_ref] ?? null;
      const state = !local || !binding ? 'unloaded' : occurrence && localEntities.has(occurrence.view_entity_id) ? 'loaded' :
        loaded.has(entity_ref) || hidden.has(entity_ref) ? 'absent' : 'unloaded';
      return {entity_ref, local_entity_id: localId, state, occurrence: state === 'loaded' && occurrence ? {...occurrence,
        subject: occurrence.subject ? structuredClone(occurrence.subject) : null} : null};
    });
    const knownLocalIds = new Set(members.map(member => member.local_entity_id).filter((id): id is string => id !== null));
    const unboundEntities = local?.entities.filter(entity => !knownLocalIds.has(entity.id)).map(entity => entity.id) ?? [];
    const unloadedRefs = members.filter(member => member.state === 'unloaded').map(member => member.entity_ref);
    const membershipMatches = !!binding && sameRefs(binding.member_refs, native.entity_refs);
    const complete = !!local && membershipMatches && unloadedRefs.length === 0 && unboundEntities.length === 0;
    const saved = local && journey.savedScenes?.[local.id];
    return {scene_ref: native.scene_ref, local_scene_id: captured?.id ?? null, native_title: native.title,
      title: local?.name ?? native.title, working: available ? {duration: local!.duration, transition: local!.transition} : null,
      snapshot: {availability: !available ? 'unavailable' : saved ? 'present' : 'absent',
        duration: available && validTiming(saved) ? saved.duration : null,
        // A saved/edited comparison of just one loaded page cannot establish
        // whole-Scene standing. Keep snapshot existence separate from it.
        standing: available && complete ? sceneSaveState(journey, local!) : null},
      material: {available, reason}, member_refs: [...native.entity_refs], members,
      membership: {complete, page: binding?.page ?? null, page_count: binding?.page_count ?? null,
        unloaded_refs: unloadedRefs, unbound_local_entity_ids: unboundEntities,
        reason: complete ? null : !membershipMatches ? 'Native membership correspondence is not loaded or disagrees' :
          !local ? 'The working Scene is not loaded' : unboundEntities.length ? 'Local objects have no captured native identity' : 'Some native occurrences are not loaded'}};
  });
  const orderComplete = unbound.length === 0 && workingOrder.length === nativeOrder.length &&
    new Set(workingOrder).size === nativeOrder.length && nativeOrder.every(ref => workingOrder.includes(ref));
  const missing = rows.filter(row => !row.material.available).map(row => row.scene_ref);
  const timing = (savedOnly: boolean): NativeSceneTimingReading => {
    const unavailableSaved = savedOnly ? rows.filter(row => row.snapshot.availability === 'present' && row.snapshot.duration === null).map(row => row.scene_ref) : [];
    if (!orderComplete || missing.length || unavailableSaved.length) return {available: false,
      reason: 'A complete ref-addressed authored sequence is required to derive its time extent',
      missing_scene_refs: [...new Set([...missing, ...unavailableSaved])], unbound_local_scene_ids: [...unbound]};
    return {available: true, total_seconds: expressionTiming(journey, 0, 0, savedOnly).total,
      extents: journey.scenes.flatMap((scene, index) => {
        const played = savedOnly ? journey.savedScenes?.[scene.id] : scene;
        if (!played) return [];
        return [{scene_ref: localRefs.get(scene.id)!, start_seconds: expressionTiming(journey, index, 0, savedOnly).start,
          duration_seconds: played.duration, transition_seconds: played.transition}];
      })};
  };
  return {schema: 'oi.native-scenes/v1', basis: {expression_ref: view.document.expression_ref, revision: view.document.revision},
    title: journey.name, description: journey.description, loop: journey.loop === true, native_selected_scene_ref: view.document.selection?.scene_ref ?? null,
    object_titles:Object.fromEntries(Object.values(view.document.entities).map(entity=>[entity.entity_ref,entity.title])),
    native_order: nativeOrder, working_order: workingOrder, unbound_local_scene_ids: unbound, scenes: rows,
    completeness: {order: orderComplete, material: missing.length === 0, occurrences: rows.every(row => row.membership.complete)},
    timing: {working: timing(false), saved: timing(true)}};
}

/** Query native membership without confusing another Scene or an unloaded page
 * with a missing subject. No fallback to a different occurrence is allowed. */
export function nativeSceneMember(reading: NativeScenesReading, sceneRef: string, entityRef: string):
  NativeSceneMemberReading | {entity_ref: string; state: 'absent' | 'unavailable'; reason: string} {
  const scene = reading.scenes.find(row => row.scene_ref === sceneRef);
  if (!scene) return {entity_ref: entityRef, state: 'unavailable', reason: 'The native Scene is not disclosed'};
  return scene.members.find(row => row.entity_ref === entityRef) ??
    {entity_ref: entityRef, state: 'absent', reason: 'The subject is not a member of this native Scene'};
}
