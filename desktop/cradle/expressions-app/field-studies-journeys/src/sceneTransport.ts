import type {Journey} from './model';
import {savedSceneIndices} from './sceneWorkflow';
import type {KernelConversion} from './kernelDocumentBridge';

export interface SceneTransportFrame {
  elapsed_seconds: number;
  scene_playing: boolean;
  saved_sequence_playing: boolean;
  advance_to_scene_index: number | null;
  completed: boolean;
  unavailable_reason: string | null;
}

/** Compatibility conversion supplies visual defaults for old native Scenes.
 * Those defaults cannot become authored sequence pacing. */
export function nativeSceneTransportMaterial(view: KernelConversion | undefined): readonly string[] | undefined {
  if (!view) return undefined;
  return Object.entries(view.bindings).flatMap(([id, binding]) => {
    const native = view.document.scenes.find(scene => scene.scene_ref === binding.scene_ref);
    const material = native?.presentation;
    return material?.schema === 'oi.journey-scene/v1' && Number.isFinite(material.scene.duration)
      && material.scene.duration >= 1 && material.scene.duration <= 3600
      && Number.isFinite(material.scene.transition) && material.scene.transition >= 0 && material.scene.transition <= 30 ? [id] : [];
  });
}

/** One advancement of the retained app's existing Scene playhead per frame.
 * Physics, morph, property recording and civil time retain their own owners. */
export function advanceSceneTransport(journey: Journey, sceneIndex: number, elapsed: number,
  rawDelta: number, state: {playing: boolean; savedSequence: boolean; hidden: boolean;
    libraryOpen: boolean; propertyRecording: boolean; editing: boolean;
    authoredSceneIds?: readonly string[]}): SceneTransportFrame {
  const held: SceneTransportFrame = {elapsed_seconds: elapsed, scene_playing: state.playing,
    saved_sequence_playing: state.savedSequence, advance_to_scene_index: null, completed: false, unavailable_reason: null};
  if (!state.playing || state.hidden || state.libraryOpen || state.propertyRecording
    || state.savedSequence && state.editing || !Number.isFinite(rawDelta) || rawDelta <= 0) return held;
  const scene = journey.scenes[sceneIndex];
  const active = state.savedSequence && scene ? journey.savedScenes?.[scene.id] : scene;
  const indices = state.savedSequence ? savedSceneIndices(journey) : [sceneIndex];
  if (state.authoredSceneIds && (!scene || !state.authoredSceneIds.includes(scene.id)
    || indices.some(index => !state.authoredSceneIds!.includes(journey.scenes[index].id)))) {
    return {...held, scene_playing: false, saved_sequence_playing: false,
      unavailable_reason: 'Native Scene pacing is not disclosed; compatibility snapshots cannot establish playback timing'};
  }
  if (!active || !Number.isFinite(active.duration) || active.duration < 1 || active.duration > 3600
    || !Number.isFinite(elapsed) || elapsed < 0) return held;
  const nextElapsed = elapsed + Math.min(rawDelta, .25);
  if (!state.savedSequence) {
    const ended = nextElapsed >= active.duration - .001;
    return {...held, elapsed_seconds: Math.min(active.duration, nextElapsed), scene_playing: !ended, completed: ended};
  }
  if (nextElapsed < active.duration) return {...held, elapsed_seconds: nextElapsed};
  const current = indices.indexOf(sceneIndex), next = current + 1;
  if (current < 0 || !indices.length || next >= indices.length && !journey.loop) {
    return {...held, elapsed_seconds: 0, scene_playing: false, saved_sequence_playing: false, completed: true};
  }
  return {...held, elapsed_seconds: 0, advance_to_scene_index: indices[next % indices.length]};
}
