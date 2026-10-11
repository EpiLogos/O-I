// The QL field/PCM owner's REAL standing states and identity, bound as the
// instrument device face's reading types (L9, WORLD-SHELL-DESIGN §18).
//
// Port law: every shape, constant and name here is READ from the owner code,
// never invented:
//   - standing states: `NativeStatus` (field-studies-journeys/src/native-field/
//     controller.ts:17) — 'manual' | 'opening' | 'following' | 'held' |
//     'unavailable';
//   - identity tuple: `IDENTITY` (native-field/ql/native-audio.mjs:8) —
//     event_ref, subject_ref, registry_revision, geometry_ref, material_ref,
//     model_ref;
//   - cursors: exact decimal-u64 strings, the owner's generation and
//     samples_elapsed (instrument-session.mjs cursor()/sameState());
//   - audio receipt: `#receipt` (native-audio.mjs #receipt) — schema
//     ql.native-audio-receipt/v1;
//   - playback policy: `EMBEDDED_NATIVE_PLAYBACK` (controller.ts:16) — block
//     8192, lead 0.5 s, lookahead 0.5 s; `SCENE_SAMPLE_RATE` 48000 (controller
//     .ts:25, from QL scene_field.rs `default_field` — the composed owner's
//     device rate);
//   - presentation: `INSTRUMENT_PRESENTATION` (controller.ts:22) — annotated
//     presentation scale, never a source value.
//
// The parser refuses anything the owner does not produce: a face bound to a
// reading that fails here renders the refusing state, never a plausible shape.
//
// Pure TypeScript. No React, no transport, no store.

/** The owner's standing (controller.ts `NativeStatus`, verbatim). */
export type QlOwnerStanding = 'manual' | 'opening' | 'following' | 'held' | 'unavailable'

/** The identity tuple every native field frame carries (native-audio.mjs
 * `IDENTITY`, verbatim names — these ARE the readings, not labels). */
export interface QlIdentityTuple {
  readonly event_ref: string
  readonly subject_ref: string
  readonly registry_revision: string
  readonly geometry_ref: string
  readonly material_ref: string
  readonly model_ref: string
}
export const QL_IDENTITY_KEYS = [
  'event_ref', 'subject_ref', 'registry_revision', 'geometry_ref', 'material_ref', 'model_ref',
] as const

/** The composed owner's device rate (controller.ts `SCENE_SAMPLE_RATE`). */
export const QL_SCENE_SAMPLE_RATE = 48000

/** The embedded playback policy (controller.ts `EMBEDDED_NATIVE_PLAYBACK`).
 * `embedded` marks where the values come from: the retained app's embedded
 * policy, not a shell preference. */
export interface QlPlaybackPolicy {
  readonly blockFrames: number
  readonly leadSeconds: number
  readonly lookaheadSeconds: number
  readonly owner: string
}
export const QL_EMBEDDED_NATIVE_PLAYBACK: QlPlaybackPolicy = Object.freeze({
  blockFrames: 8192,
  leadSeconds: 0.5,
  lookaheadSeconds: 0.5,
  owner: 'controller.ts EMBEDDED_NATIVE_PLAYBACK — QL InstrumentSession / explicit application buffering; no sample-rate change',
})

/** Presentation, not source (controller.ts `INSTRUMENT_PRESENTATION`). */
export const QL_INSTRUMENT_PRESENTATION = Object.freeze({
  units_per_metre: 120,
  standing: 'presentation scale: ±25/9 m torus → ±333 engine units (0.83 of the 400-unit stage radius); not a source value',
})

/** One scheduled (or discarded) PCM block interval, as the audio receipt's
 * `interval` carries it (native-audio.mjs #receipt interval). */
export interface QlAudioInterval {
  readonly native_start: string
  readonly native_end: string
  readonly frames: number
  readonly start_context_seconds: number
  readonly end_context_seconds: number
  readonly target_context_seconds: number
}

/** The audio receipt (native-audio.mjs `#receipt`, verbatim fields). */
export interface QlAudioReceipt {
  readonly schema: 'ql.native-audio-receipt/v1'
  readonly device_epoch: number
  readonly device_sample_rate: number
  readonly native_origin: string
  readonly context_origin_seconds: number
  readonly observed_context_seconds: number
  readonly target_context_seconds: number
  readonly status: string
  readonly muted: boolean
  readonly presentation_gain: number
  readonly scheduled_blocks: number
  readonly discarded_blocks: number
  readonly reason: string | null
  readonly interval: QlAudioInterval | null
  /** The owner's own honesty line — carried verbatim, never summarised away. */
  readonly standing: string
}

/** The instrument reading the face binds: the session's reading
 * (instrument-session.mjs `get reading`) joined with the standing the
 * controller reports and the policy/presentation constants. Exactly one
 * shape, parsed strictly below. */
export interface QlInstrumentReading {
  readonly schema: 'ql.instrument-reading/v1'
  readonly standing: QlOwnerStanding
  /** The controller's own reason for a held/unavailable standing, verbatim. */
  readonly reason: string | null
  readonly identity: QlIdentityTuple
  /** The last acknowledged native cursor (instrument-session.mjs
   * `acknowledged`) — exact u64 decimal strings. */
  readonly acknowledged: {readonly generation: string; readonly samples_elapsed: string}
  /** The last presented cursor (end-of-block targets actually applied). */
  readonly presented: {readonly generation: string; readonly samples_elapsed: string}
  readonly audio: QlAudioReceipt | null
  readonly available: boolean
  readonly held: boolean
  readonly in_flight: boolean
  readonly queued_blocks: number
  readonly queued_bytes: number
  readonly coalesced_presentation_frames: number
  readonly views: number
  readonly disposed: boolean
  readonly playback_policy: QlPlaybackPolicy
}

// ── strict parsing ───────────────────────────────────────────────────────────

const U64 = /^(0|[1-9][0-9]{0,19})$/

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const ref = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 2048 && !/[\u0000-\u001f\u007f]/u.test(value)

const u64 = (value: unknown): value is string => typeof value === 'string' && U64.test(value)

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const STANDINGS: readonly QlOwnerStanding[] = ['manual', 'opening', 'following', 'held', 'unavailable']

function parseIdentity(value: unknown): QlIdentityTuple {
  if (!isObject(value)) throw new Error('identity: expected the six-ref tuple')
  for (const key of QL_IDENTITY_KEYS) {
    if (!ref(value[key])) throw new Error(`identity: missing or invalid ${key}`)
  }
  return Object.fromEntries(QL_IDENTITY_KEYS.map(key => [key, value[key]])) as unknown as QlIdentityTuple
}

function parseCursors(value: unknown, label: string): {generation: string; samples_elapsed: string} {
  if (!isObject(value) || !u64(value.generation) || !u64(value.samples_elapsed)) {
    throw new Error(`${label}: expected exact u64 generation/samples_elapsed cursors`)
  }
  return {generation: value.generation, samples_elapsed: value.samples_elapsed}
}

function parseAudio(value: unknown): QlAudioReceipt | null {
  if (value === null || value === undefined) return null
  if (!isObject(value) || value.schema !== 'ql.native-audio-receipt/v1') {
    throw new Error('audio: expected the ql.native-audio-receipt/v1 receipt or null')
  }
  for (const key of ['device_epoch', 'device_sample_rate', 'context_origin_seconds', 'target_context_seconds'] as const) {
    if (!Number.isInteger(value[key]) && !finite(value[key])) throw new Error(`audio.${key}: expected a number`)
  }
  if (value.device_sample_rate !== QL_SCENE_SAMPLE_RATE) {
    // The composed owner's device rate is 48 kHz (QL scene_field.rs); the
    // binding refuses any other rate — no implicit resampling exists here.
    throw new Error(`audio.device_sample_rate: ${String(value.device_sample_rate)} is not the composed owner's rate (${QL_SCENE_SAMPLE_RATE})`)
  }
  if (typeof value.status !== 'string' || typeof value.muted !== 'boolean' || !finite(value.presentation_gain)) {
    throw new Error('audio: status/muted/presentation_gain malformed')
  }
  if (!Number.isInteger(value.scheduled_blocks) || !Number.isInteger(value.discarded_blocks)) {
    throw new Error('audio: scheduled/discarded block counts must be integers')
  }
  if (value.reason !== null && typeof value.reason !== 'string') throw new Error('audio.reason: expected string or null')
  if (typeof value.standing !== 'string' || value.standing.length === 0) {
    throw new Error('audio.standing: the owner\'s honesty line is carried verbatim')
  }
  let interval: QlAudioInterval | null = null
  if (value.interval !== null && value.interval !== undefined) {
    const raw = value.interval
    if (!isObject(raw) || !u64(raw.native_start) || !u64(raw.native_end) || !Number.isInteger(raw.frames) ||
        !finite(raw.start_context_seconds) || !finite(raw.end_context_seconds) || !finite(raw.target_context_seconds)) {
      throw new Error('audio.interval: malformed native interval')
    }
    interval = {
      native_start: raw.native_start, native_end: raw.native_end, frames: raw.frames as number,
      start_context_seconds: raw.start_context_seconds,
      end_context_seconds: raw.end_context_seconds,
      target_context_seconds: raw.target_context_seconds,
    }
  }
  return {
    schema: 'ql.native-audio-receipt/v1',
    device_epoch: value.device_epoch as number,
    device_sample_rate: value.device_sample_rate as number,
    native_origin: u64(value.native_origin) ? value.native_origin as string : (() => {throw new Error('audio.native_origin: expected an exact u64 cursor')})(),
    context_origin_seconds: value.context_origin_seconds as number,
    observed_context_seconds: value.observed_context_seconds as number,
    target_context_seconds: value.target_context_seconds as number,
    status: value.status,
    muted: value.muted,
    presentation_gain: value.presentation_gain,
    scheduled_blocks: value.scheduled_blocks as number,
    discarded_blocks: value.discarded_blocks as number,
    reason: (value.reason ?? null) as string | null,
    interval,
    standing: value.standing,
  }
}

/** Parse a reading the way the owner produces it. Throws (never coerces) on
 * any field the owner code does not write. A face renders a refused shape as
 * its refusing state — a plausible reading is never manufactured. */
export function parseQlInstrumentReading(value: unknown): QlInstrumentReading {
  if (!isObject(value)) throw new Error('reading: expected an object')
  if (value.schema !== 'ql.instrument-reading/v1') throw new Error('reading: expected schema ql.instrument-reading/v1')
  if (typeof value.standing !== 'string' || !STANDINGS.includes(value.standing as QlOwnerStanding)) {
    throw new Error('reading.standing: expected one of manual | opening | following | held | unavailable')
  }
  if (value.reason !== null && typeof value.reason !== 'string') throw new Error('reading.reason: expected string or null')
  const integers = (key: string): number => {
    if (!Number.isInteger(value[key]) || (value[key] as number) < 0) throw new Error(`reading.${key}: expected a non-negative integer`)
    return value[key] as number
  }
  if (typeof value.available !== 'boolean' || typeof value.held !== 'boolean' ||
      typeof value.in_flight !== 'boolean' || typeof value.disposed !== 'boolean') {
    throw new Error('reading: available/held/in_flight/disposed are booleans')
  }
  return {
    schema: 'ql.instrument-reading/v1',
    standing: value.standing as QlOwnerStanding,
    reason: (value.reason ?? null) as string | null,
    identity: parseIdentity(value.identity),
    acknowledged: parseCursors(value.acknowledged, 'acknowledged'),
    presented: parseCursors(value.presented, 'presented'),
    audio: parseAudio(value.audio),
    available: value.available,
    held: value.held,
    in_flight: value.in_flight,
    queued_blocks: integers('queued_blocks'),
    queued_bytes: integers('queued_bytes'),
    coalesced_presentation_frames: integers('coalesced_presentation_frames'),
    views: integers('views'),
    disposed: value.disposed,
    playback_policy: parsePolicy(value.playback_policy),
  }
}

function parsePolicy(value: unknown): QlPlaybackPolicy {
  if (!isObject(value)) throw new Error('playback_policy: expected the policy object')
  if (!Number.isInteger(value.blockFrames) || (value.blockFrames as number) < 128 || (value.blockFrames as number) > 8192) {
    throw new Error('playback_policy.blockFrames: the owner admits 128..8192 (instrument-session.mjs)')
  }
  if (!finite(value.leadSeconds) || !finite(value.lookaheadSeconds) ||
      (value.leadSeconds as number) < 0 || (value.lookaheadSeconds as number) > 0.5) {
    throw new Error('playback_policy: lead/lookahead are seconds in 0..0.5')
  }
  if (typeof value.owner !== 'string' || value.owner.length === 0) throw new Error('playback_policy.owner: name the policy\'s owner')
  return {
    blockFrames: value.blockFrames as number,
    leadSeconds: value.leadSeconds as number,
    lookaheadSeconds: value.lookaheadSeconds as number,
    owner: value.owner,
  }
}

// ── the launch contract, disclosed ───────────────────────────────────────────
//
// The face never launches the owner and never pretends to. When no owner
// stands, the body renders this contract verbatim: what would start, who
// starts it, and what the shell would still be missing. Names are read from
// the launch sites (kernel/src/native_expression.rs, src-tauri/src/native_shell.rs,
// native-field/channel.ts), not composed.

export const QL_LAUNCH_CONTRACT = Object.freeze({
  /** The one owner: a C++ PCM and field owner over the host-authorised pipe. */
  owner: 'ql-field-host (+ ql-field-worker) — one managed native owner supplying PCM and identified field targets together',
  /** Who launches it: the kernel's native-expression owner composes a K²
   * binding and spawns the host with piped stdio. Not the browser, not the
   * face, not this shell's UI. */
  launcher: 'the kernel\'s native-expression owner (desktop/cradle/kernel/src/native_expression.rs compose → spawn)',
  /** The executable bindings it resolves (both-or-neither, or the installed
   * catalogue's companions — native_expression.rs lines 211-227). */
  bindings: [
    'OI_QL_FIELD_HOST_BIN + OI_QL_FIELD_WORKER_BIN (absolute paths; both or neither)',
    'or the installed suite catalogue: the quaternal-logic product\'s ql-field-host / ql-field-worker companions (oi product location)',
  ],
  /** The compose request the controller sends once the retained GPU field is
   * live (controller.ts compose()): a `ql scene binding` composition — no
   * path, no file. */
  compose: '{operation:"compose", request:{texture:[w,h], units_per_metre:120, sky:"none"|"now"|{epoch}}} — the instrument\'s primary opening',
  /** The browser-side transport the session rides (channel.ts). */
  channel: 'oi.native-expression/v1 — window-parent request/result channel; the host authorises disclosure before any view opens',
  /** What the shell still lacks for a live dock (each named, none hidden):
   * these are the Tauri gate's absent seams as of this lane. */
  shellStillLacks: [
    'the shell host supplies no oi.native-expression/v1 channel — the retained Expressions body owns that host side today',
    'the retained GPU field (the M4 stage) must be live before compose; the stage is the instrument\'s visible body and is not mounted in the shell',
    'the Tauri webview\'s AudioContext device path is unmeasured; the realtime gate\'s chromium measurement is not a WKWebView device claim',
  ],
} as const)
