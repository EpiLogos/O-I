/**
 * Working-view transport (lane-3 E24, pure: no DOM, no store).
 *
 * One state for how the playhead moves: stop, play, shuttle (J / L at a signed
 * rate) and scrub (a pointer held on the playhead). The auto-advance clock is the
 * play and shuttle modes of this state, read through `transportRate`; it is not a
 * second master. Transport is working-view state: it rides the recovery session
 * (`workingTransport`) and never the document.
 *
 * The scrub law is the one the timeline already has: a seek sets the Scene's
 * playhead and re-evaluates its tracks at that time; it adds nothing to the
 * physics clock (`simTime`). Scrubbing therefore has rate 0 here.
 */

export type WorkingTransportMode = 'stop' | 'play' | 'shuttle' | 'scrub';

export interface WorkingTransport {
  mode: WorkingTransportMode;
  /** Signed scene-time speed. Play is 1, shuttle is one of SHUTTLE_RAMP with a sign, stop and scrub are 0. */
  rate: number;
  /** The non-shuttle state that K returns to. A shuttle started from play resumes play; from anything else, stop. */
  resume: 'stop' | 'play';
}

/** One evaluation step: a 30 Hz frame of scene time. */
export const TRANSPORT_FRAME_SECONDS = 1 / 30;
/** Each press of J or L moves to the next magnitude; the last one holds. */
export const SHUTTLE_RAMP = [1, 2, 4] as const;

export const STOPPED_TRANSPORT: WorkingTransport = {mode: 'stop', rate: 0, resume: 'stop'};
export const PLAYING_TRANSPORT: WorkingTransport = {mode: 'play', rate: 1, resume: 'play'};

/** The non-shuttle state a new shuttle or scrub returns to. */
function priorState(t: WorkingTransport): 'stop' | 'play' {
  if (t.mode === 'play') return 'play';
  if (t.mode === 'shuttle') return t.resume;
  return 'stop';
}

/**
 * J (direction -1) or L (direction +1). Each press steps one magnitude up SHUTTLE_RAMP
 * in the direction it is already moving: from stop it starts at x1, from play forward
 * it goes to x2, from a shuttle it climbs to x4 and holds there. A press against a
 * shuttle starts again at x1 in the new direction. Scrubbing ignores shuttle.
 */
export function shuttle(t: WorkingTransport, direction: 1 | -1): WorkingTransport {
  if (t.mode === 'scrub') return t;
  const current = t.mode === 'shuttle' && Math.sign(t.rate) === direction ? Math.abs(t.rate)
    : t.mode === 'play' && direction > 0 ? 1 : 0;
  const index = SHUTTLE_RAMP.indexOf(current as 1 | 2 | 4);
  const next = index < 0 ? SHUTTLE_RAMP[0] : SHUTTLE_RAMP[Math.min(index + 1, SHUTTLE_RAMP.length - 1)];
  return {mode: 'shuttle', rate: direction * next, resume: priorState(t)};
}

/**
 * K. Ends a shuttle and returns to the state it began from (play or stop). Outside a
 * shuttle it pauses. A scrub is not ended by K; the pointer ends it.
 */
export function pauseTransport(t: WorkingTransport): WorkingTransport {
  if (t.mode === 'scrub') return t;
  if (t.mode === 'shuttle') return t.resume === 'play' ? PLAYING_TRANSPORT : STOPPED_TRANSPORT;
  return STOPPED_TRANSPORT;
}

/** A pointer goes down on the playhead. */
export function beginScrub(t: WorkingTransport): WorkingTransport {
  if (t.mode === 'scrub') return t;
  return {mode: 'scrub', rate: 0, resume: priorState(t)};
}

/**
 * The pointer lets go. The seek that a scrub performs already stops playback (the
 * timeline's existing law), so a scrub ends stopped, not in its prior play state.
 */
export function endScrub(t: WorkingTransport): WorkingTransport {
  return t.mode === 'scrub' ? STOPPED_TRANSPORT : t;
}

/**
 * One frame in `direction` while paused (K held with J or L). The caller seeks the
 * playhead by exactly `seconds`, once; the transport is left stopped.
 */
export function stepFrame(t: WorkingTransport, direction: 1 | -1): {transport: WorkingTransport; seconds: number} {
  return {transport: STOPPED_TRANSPORT, seconds: direction * TRANSPORT_FRAME_SECONDS};
}

/** Scene-time speed the clock runs at: play 1, shuttle its signed rate, stop and scrub 0. */
export function transportRate(t: WorkingTransport): number {
  if (t.mode === 'play') return 1;
  if (t.mode === 'shuttle') return t.rate;
  return 0;
}

/** Whether the playhead is running (play or shuttle), as opposed to held. */
export function transportPlaying(t: WorkingTransport): boolean {
  return t.mode === 'play' || t.mode === 'shuttle';
}

/** A short readout for the timeline header. */
export function transportReadout(t: WorkingTransport): string {
  if (t.mode === 'play') return 'Playing';
  if (t.mode === 'scrub') return 'Scrubbing';
  if (t.mode === 'shuttle') return `${t.rate < 0 ? '◂' : '▸'} ×${Math.abs(t.rate)}`;
  return 'Stopped';
}

/**
 * Reads a stored transport. Anything malformed is dropped (undefined). A scrub never
 * survives a reload: the pointer that made it is gone, so it returns stopped.
 */
export function validateWorkingTransport(value: unknown): WorkingTransport | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (v.resume !== 'stop' && v.resume !== 'play') return undefined;
  if (v.mode === 'play') return PLAYING_TRANSPORT;
  if (v.mode === 'stop' || v.mode === 'scrub') return STOPPED_TRANSPORT;
  if (v.mode === 'shuttle') {
    const rate = v.rate;
    const magnitudes = SHUTTLE_RAMP as readonly number[];
    if (typeof rate !== 'number' || !magnitudes.includes(Math.abs(rate)) || rate === 0) return undefined;
    return {mode: 'shuttle', rate, resume: v.resume};
  }
  return undefined;
}
