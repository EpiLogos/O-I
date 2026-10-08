/** Pure transport model for Scene seek, stop, playing state and loop.
 * Each function maps one reading to at most one native request; none keeps time. */

export const SEEK_STEP = 0.1;
export const SEEK_STEP_SHIFT = 1;

export interface SceneSeek {action: 'seek'; scene_ref: string; seconds: number; sequence: 'working'}
export interface PlaybackFacts {scene_playing: boolean; saved_sequence_playing: boolean; scene_elapsed_seconds: number; scene_ref: string}

/** A duration only when the owner disclosed a positive finite working length. */
export function sceneDuration(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Two decimals, bounded to [0, duration]. Seek bounds are checked by the owner. */
export function clampSeek(value: number, duration: number): number {
  if (!Number.isFinite(value) || !(duration > 0)) return 0;
  const rounded = Math.round(value * 100) / 100;
  return Math.min(duration, Math.max(0, rounded));
}

/** One keyboard step over the working Scene: arrows ±0.1 s (Shift ±1 s), Home
 * to 0, End to the full duration. Null for any other key. */
export function scrubStep(current: number, duration: number, key: string, shift: boolean): number | null {
  const step = shift ? SEEK_STEP_SHIFT : SEEK_STEP;
  switch (key) {
    case 'ArrowRight': case 'ArrowUp': return clampSeek(current + step, duration);
    case 'ArrowLeft': case 'ArrowDown': return clampSeek(current - step, duration);
    case 'Home': return 0;
    case 'End': return clampSeek(duration, duration);
    default: return null;
  }
}

/** Why the scrubber cannot seek, or null. Saved-sequence playback is named first:
 * seek is a working-sequence operation, so the reason must be explicit. */
export function scrubBlock(input: {ready: boolean; materialAvailable: boolean; duration: number | null; savedSequencePlaying: boolean}): string | null {
  if (input.savedSequencePlaying) return 'Seek applies to the working Scene only. Stop the saved sequence to scrub.';
  if (!input.materialAvailable || input.duration === null) return 'This Scene has no authored working duration to scrub.';
  if (!input.ready) return 'Scene transport is busy or awaiting native acknowledgement.';
  return null;
}

/** Commit a released draft. Null when there is no draft or it does not move the
 * position, so a press without movement sends nothing. */
export function scrubRequest(draft: number | null, elapsed: number, sceneRef: string, duration: number): SceneSeek | null {
  if (draft === null || duration === null) return null;
  const seconds = clampSeek(draft, duration);
  if (Math.abs(seconds - clampSeek(elapsed, duration)) < 0.005) return null;
  return {action: 'seek', scene_ref: sceneRef, seconds, sequence: 'working'};
}

/** Stop is one seek to 0 on the presented working Scene. seekWorkingScene pauses
 * both the Scene and the saved sequence and rewinds in a single receipt. A pause
 * followed by a seek would be two requests, and the second would carry the
 * intent epoch the first had just advanced. Null when there is nothing to stop. */
export function stopRequest(playback: PlaybackFacts, sceneRef: string, duration: number | null): SceneSeek | null {
  if (duration === null) return null;
  if (!playback.scene_playing && !playback.saved_sequence_playing && !(playback.scene_elapsed_seconds > 0)) return null;
  return {action: 'seek', scene_ref: sceneRef, seconds: 0, sequence: 'working'};
}

/** Playing state for markers. The saved sequence counts as playing. */
export function playingState(playback: Pick<PlaybackFacts, 'scene_playing' | 'saved_sequence_playing' | 'scene_ref'>): {playing: boolean; sceneRef: string | null} {
  const playing = playback.scene_playing || playback.saved_sequence_playing;
  return {playing, sceneRef: playing ? playback.scene_ref : null};
}

/** The saved-sequence loop switch is a composition edit, carried as one intent. */
export function loopIntent(loop: boolean): {operation: 'loop'; loop: boolean} {
  return {operation: 'loop', loop: loop === true};
}

/** Why the loop switch cannot change, or null. */
export function loopBlock(input: {ready: boolean; savedAvailable: boolean}): string | null {
  if (!input.savedAvailable) return 'Save the Scene sequence before looping it.';
  if (!input.ready) return 'Finish the current Scene operation first.';
  return null;
}

/** Native focus is on this Scene with no relation selected. Composition loop
 * edits are addressed through that exact selection. */
export function sceneFocused(selection: {scene_ref: string; relation_ref?: string | null} | null | undefined, sceneRef: string): boolean {
  return !!selection && selection.scene_ref === sceneRef && !selection.relation_ref;
}

/** The loop control's value and reason, shared by the transport and the
 * Arrangement chip. The value is always the reading's Journey loop flag. */
export function sceneLoopControl(input: {loop: boolean; ready: boolean; focused: boolean; savedAvailable: boolean}): {on: boolean; reason: string | null} {
  const focusBlock = input.focused ? null : 'Focus a Scene before changing its loop.';
  return {on: input.loop === true, reason: focusBlock ?? loopBlock({ready: input.ready, savedAvailable: input.savedAvailable})};
}

/** The neighbouring Scene that has authored material, or null at either end.
 * Focus requires material, so an unavailable neighbour is skipped. */
export function adjacentSceneRef(rows: readonly {scene_ref: string; available: boolean}[], current: string, delta: 1 | -1): string | null {
  const index = rows.findIndex(row => row.scene_ref === current);
  if (index < 0) return null;
  for (let at = index + delta; at >= 0 && at < rows.length; at += delta) if (rows[at].available) return rows[at].scene_ref;
  return null;
}

/** Space plays or pauses the working Scene only when no control or editor holds
 * focus (focusIsBody). A repeat or any modifier does nothing. */
export function spaceTogglesPlayback(input: {key: string; repeat: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; focusIsBody: boolean}): boolean {
  return input.key === ' ' && !input.repeat && !input.altKey && !input.ctrlKey && !input.metaKey && !input.shiftKey && input.focusIsBody;
}

/** The transport's view of one reading. Each control maps to one request or to
 * none; the reason is shown on the disabled control, never silently dropped. */
export interface SceneTransportInput {
  ready: boolean;
  focused: boolean;
  scene: {scene_ref: string; available: boolean; reason: string | null; duration: number | null};
  rows: readonly {scene_ref: string; available: boolean}[];
  playback: PlaybackFacts & {field_paused: boolean};
  savedAvailable: boolean;
  loop: boolean;
}
export interface SceneTransportModel {
  play: {action: 'play' | 'pause'; label: string; disabled: boolean; reason: string | null};
  stop: {request: SceneSeek | null; disabled: boolean; reason: string | null};
  previous: string | null;
  next: string | null;
  saved: {action: 'play-saved' | 'stop-saved'; pressed: boolean; disabled: boolean; reason: string | null};
  loop: {on: boolean; reason: string | null};
  scrub: {duration: number | null; block: string | null};
  physics: {held: boolean; label: string; title: string};
}
export const PHYSICS_REASON = 'Physics hold is set in the Studio. The Expressions boundary cannot change it.';

export function sceneTransportModel(input: SceneTransportInput): SceneTransportModel {
  const {ready, playback, scene} = input;
  const duration = sceneDuration(scene.duration);
  const sceneBlock = !scene.available ? (scene.reason ?? 'This Scene has no authored material to play.') : null;
  const playDisabled = !ready || !scene.available;
  const playing = playback.saved_sequence_playing;
  const busyReason = 'Finish the current Scene operation first.';
  const seek = stopRequest(playback, scene.scene_ref, duration);
  const index = input.rows.findIndex(row => row.scene_ref === scene.scene_ref);
  const savedDisabled = !ready || (!playing && !input.savedAvailable);
  const loop = sceneLoopControl({loop: input.loop, ready, focused: input.focused, savedAvailable: input.savedAvailable});
  return {
    play: {action: playback.scene_playing ? 'pause' : 'play', label: playback.scene_playing ? 'Pause Scene' : 'Play Scene',
      disabled: playDisabled, reason: playDisabled ? (sceneBlock ?? busyReason) : null},
    stop: {request: ready ? seek : null, disabled: !ready || seek === null,
      reason: duration === null ? 'This Scene has no authored working duration to stop.' : seek === null ? 'Nothing to stop: the Scene is idle at its start.' : !ready ? busyReason : null},
    previous: index < 0 ? null : adjacentSceneRef(input.rows, scene.scene_ref, -1),
    next: index < 0 ? null : adjacentSceneRef(input.rows, scene.scene_ref, 1),
    saved: {action: playing ? 'stop-saved' : 'play-saved', pressed: playing, disabled: savedDisabled,
      reason: !ready ? busyReason : !playing && !input.savedAvailable ? 'Save the Scene sequence before playing it.' : null},
    loop,
    scrub: {duration, block: scrubBlock({ready: ready && scene.available, materialAvailable: scene.available, duration, savedSequencePlaying: playback.saved_sequence_playing})},
    physics: {held: playback.field_paused, label: playback.field_paused ? 'Physics held' : 'Physics running', title: PHYSICS_REASON},
  };
}
