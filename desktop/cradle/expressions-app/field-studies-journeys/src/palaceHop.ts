/**
 * The Palace's trail step (lane-5 seam A), frame side — pure. An Open on a Palace Expression asks the owner's one route
 * (`techne-time-window`, operation `palace`) to record one endpoint hop on the session's one history. This module builds that
 * request and qualifies the reply; the channel itself lives with the Palace panel, so the request shape is testable as it is sent.
 *
 * Laws carried here:
 *   - the request names the exact native basis, the reading and the object ref, and nothing else: no session identity is
 *     invented here, and the owner carries the session's own subject and selection byte-equal into the hop;
 *   - a reply that does not address this source, Scene, reading or instrument is refused by name, and nothing is trusted.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {validateSession, type TechneReading} from '../../../src/techne/contract.ts';
import {timeAxis} from '../../../src/techne/m0m5/timeline/timeAxis.ts';
import type {NativeTimeWindowBasis, NativeTimeWindowReply, NativeTimeWindowRequest} from '../../../../../packages/expressions-boundary/src/timeWindow';

/** The owner request that records one Palace trail step for an Open on `targetRef`. */
export function palaceHopRequest(basis: NativeTimeWindowBasis, reading: TechneReading, targetRef: string): NativeTimeWindowRequest {
  return {...basis, operation: 'palace', reading_ref: reading.reading_ref, instrument: 'expressions', target_ref: targetRef};
}

/** Qualify the owner's reply: it must address this exact Scene, reading, subject and the Expression instrument, and its axis must
 * be the reading's own. A reply that does not address them is refused by name and never adopted. */
export function qualifyPalaceHopReply(raw: unknown, basis: NativeTimeWindowBasis, reading: TechneReading): NativeTimeWindowReply {
  const value = raw as NativeTimeWindowReply;
  if (!value || value.schema !== 'oi.native-time-window/v1' || value.instrument !== 'expressions'
    || value.basis?.expression_ref !== basis.expression_ref || value.basis?.revision !== basis.revision || value.basis?.scene_ref !== basis.scene_ref
    || value.reading_ref !== reading.reading_ref || !validateSession(value.session).valid
    || value.session.subject_ref !== reading.subject.subject_ref || value.session.reading_ref !== reading.reading_ref
    || value.session.instrument !== 'expressions'
    || JSON.stringify(value.axis) !== JSON.stringify(timeAxis(reading, value.session.time_window ?? null))) {
    throw Error('The host time reading does not address this source and Scene; the Palace trail step was not confirmed');
  }
  return structuredClone(value);
}
