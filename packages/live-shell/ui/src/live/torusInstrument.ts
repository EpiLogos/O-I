// Live mode's one instrument — the M1 torus (DEVICE-SEMANTICS-LOCK §0.2, §2.1;
// ticket T-LIVE-TORUS-INSTRUMENT).
//
// One simulation, one state. The simulation is the native field owner in the
// hosted Expressions frame (desktop/cradle/expressions-app/field-studies-journeys/
// src/nativeField.ts and its native-field module). The shell never runs a second
// build: it holds ONE reading handle here, published from the owner's reading and
// read by every shell presentation of the instrument (the Live rack widget now; the
// full centre presentation when its host seat lands). Readers share the identical
// state object — identity, not a copy. The hosted frame announces the owner's
// reading (oi.native-expression-reading, composed by native-field/ql/instrumentAnnouncement.mjs)
// and the boundary validates it; the shell publishes only what the boundary admitted.
//
// Owners write, faces read: this module holds no writes and draws no state of its
// own. Macros are the engine's own determinants (the scene's acting M1 state), declared
// with their source; their values come only from the owner's announcement.

import {useSyncExternalStore} from 'react'
import type {QlInstrumentReading} from '../inhabitants/ql/qlInstrumentReading'
import type {HostedInstrument, InstrumentEdit, StageCommand, StageResult} from '@epilogos/expressions-boundary'
import type {Value, ValueChange} from '../frame/devices/designed'

/** The instrument's id on the quaternal-logic family (quaternalLogicFamilyManifest.ts `torus`). */
export const LIVE_TORUS_ID = 'ql-m1-torus'

/** The Studio section that holds the instrument (T-HOLDERS: `studio:body`, Body 3:3). */
export const LIVE_TORUS_HOLDER = 'studio:body'

/** Its three presentations: the compact rack widget, the expanded pool body, the full centre torus. */
export const LIVE_TORUS_PRESENTATIONS = Object.freeze(['compact', 'expanded', 'full'] as const)

/** The M1 torus embedding (QL-MEF `ql_m1_torus`, coordinate `#1-5-1`, c/src/m1.c:141-151):
 * x=(R+cos θ1)cos θ2, y=(R+cos θ1)sin θ2, z=sin θ1 with R=16/9 and r=1 fixed (c/include/ql/m1.h:50).
 * The 720° figure is not an embedding parameter: it is the M1 clock's double cover (degree720). */
export const LIVE_TORUS_TOPOLOGY = Object.freeze({
  ref: '#1-5-1',
  major_radius: 16 / 9,
  minor_radius: 1,
  source: 'QL-MEF c/src/m1.c ql_m1_torus; c/include/ql/m1.h:50; docs/KERNEL-M1-ENGINE-CONTRACT.md:48',
})

export const LIVE_TORUS_MAX_MACROS = 4

export interface LiveTorusMacro {
  readonly id: string
  readonly label: string
  readonly parameter: string
  readonly source: string
}

const DETERMINANTS = 'desktop/cradle/expressions-app/field-studies-journeys/src/nativeField.ts "Change a determinant"'

/** The four determinants the native field panel exposes first (lens, context frame, harmonic basis, M3 transcription). */
export const LIVE_TORUS_MACROS: readonly LiveTorusMacro[] = Object.freeze([
  {id: 'lens', label: 'Lens', parameter: 'lens (LENSES, native-field/scene.ts)', source: `${DETERMINANTS}: lens`},
  {id: 'context-frame', label: 'Context frame', parameter: 'context frame (CONTEXT_FRAMES)', source: `${DETERMINANTS}: context frame`},
  {id: 'harmonic-basis', label: 'Harmonic basis', parameter: 'harmonic basis B1–B8 or the selected M1 source row', source: `${DETERMINANTS}: harmonic basis`},
  {id: 'm3-transcription', label: 'M3 transcription', parameter: 'DNA | RNA', source: `${DETERMINANTS}: M3 transcription`},
])

/** The owner's determinants (the scene's acting M1 state), as the boundary validated them. */
export type LiveTorusDeterminants = Extract<HostedInstrument, {ok: true}>['determinants']

/** The owner's presentation parameters, as the boundary validated them. */
export type LiveTorusParameters = Extract<HostedInstrument, {ok: true}>['parameters']

/** What the handle holds: the owner reading the boundary validated, with the owner's determinants and parameters, or the refusal it named. */
export type LiveTorusState =
  | {readonly ok: true; readonly value: QlInstrumentReading; readonly determinants: LiveTorusDeterminants; readonly parameters: LiveTorusParameters}
  | {readonly ok: false; readonly fault: string}

/** The handle's state from the instrument the hosted frame announced. Absent (no announcement) is null: the reading is withdrawn. */
export function liveTorusFromHost(instrument: HostedInstrument | undefined): LiveTorusState | null {
  if (instrument === undefined) return null
  return instrument.ok
    ? {ok: true, value: instrument.reading, determinants: instrument.determinants, parameters: instrument.parameters}
    : {ok: false, fault: instrument.fault}
}

// ── writes: the owner's controls, reached through the hosted channel ──────────
// The one instrument's edits leave the shell only as validated `instrument` stage commands. The host registers its stage command here
// when the frame is mounted; nothing is written from the shell itself. Without a mounted frame a write is refused by name.

export type LiveInstrumentCommander = (command: StageCommand) => Promise<StageResult>
let commander: LiveInstrumentCommander | null = null

/** Register (or, with null, withdraw) the mounted frame's stage channel. */
export function setLiveInstrumentCommander(next: LiveInstrumentCommander | null): void {
  commander = next
}

/** How a write was sent: by the hand (a device's own control, the Live instrument section, a mapped control or key), or by none (Follow,
 * a take played again, a sound or rack recalled, a set opening with its Torus, a planet's modulation). A hand move takes a control out
 * of what moves it on its own, as in Live (DLW build ruling 2026-11-05: a hand-moved or mapped Lens or Frame turns Follow off). */
export interface LiveWriteHow {
  readonly hand?: boolean
}
/** A write the hand sent. */
export const BY_HAND: LiveWriteHow = Object.freeze({hand: true})
/** A write no hand sent: Follow, a take's lane played again, a recall, a planet's modulation. */
export const NO_HAND: LiveWriteHow = Object.freeze({})

/** Send one stage command to the owner through the mounted frame: the one host-command channel the Live surfaces share. Settles with the
 * owner's answer; a refusal (no frame, a concealed frame, the owner's own reason) comes back named, never thrown into the control. */
export function commitLiveStage(command: StageCommand, how: LiveWriteHow = NO_HAND): Promise<StageResult> {
  if (commander === null) return Promise.resolve({ok: false, error: 'No Expressions application is mounted for the live instrument'})
  // A synchronous refusal (no mounted frame, or a concealed one) settles as a named result, never a throw into the control.
  return new Promise<StageResult>(resolve => resolve(commander!(command)))
    .catch((cause: unknown) => ({ok: false as const, error: cause instanceof Error ? cause.message : String(cause)}))
    .then(result => {
      if (result.ok) for (const listener of [...acceptedWriteListeners]) listener(command, how)
      return result
    })
}

type AcceptedWriteListener = (command: StageCommand, how: LiveWriteHow) => void
const acceptedWriteListeners = new Set<AcceptedWriteListener>()

/** Subscribe to the stage commands the owner accepted through the one channel (commitLiveStage), each with how it was sent. A refused
 * command is not announced: a listener learns only of a write the owner has taken. Returns the unsubscribe. */
export function subscribeAcceptedLiveWrites(listener: AcceptedWriteListener): () => void {
  acceptedWriteListeners.add(listener)
  return () => { acceptedWriteListeners.delete(listener) }
}

/** Send one instrument edit to the owner through the frame (BY_HAND when the hand sent it). Settles with the owner's answer; a refusal
 * carries the owner's reason. */
export function commitLiveInstrumentEdit(edit: InstrumentEdit, how: LiveWriteHow = NO_HAND): Promise<StageResult> {
  return commitLiveStage({command: 'instrument', edit}, how)
}

/** Whether the owner's instrument is in a state to take edits: a following or held session. Any other state refuses by name at the owner. */
export function liveInstrumentWritable(state: LiveTorusState | null): boolean {
  return state !== null && state.ok && (state.value.standing === 'following' || state.value.standing === 'held')
}

/** The owner's choices for each control, labelled as the Studio labels them (nativeField.ts "Change a determinant" and "See and hear").
 * The lens labels are the owner's lensLabel (scene.ts): L<n>, with a prime on the odd positions. */
export const LIVE_LENS_OPTIONS = Object.freeze(Array.from({length: 12}, (_, lens12) => ({value: lens12, label: `L${lens12 >> 1}${lens12 & 1 ? '′' : ''}`})))
export const LIVE_CONTEXT_FRAME_OPTIONS = Object.freeze(Array.from({length: 7}, (_, i) => ({value: i + 1, label: `CF${i + 1}`})))
export const LIVE_HARMONIC_OPTIONS = Object.freeze([
  ...Array.from({length: 8}, (_, index) => ({value: `basis:${index}`, label: `B${index + 1}`})),
  {value: 'row', label: 'Row'},
])
export const LIVE_CADENCE_OPTIONS = Object.freeze([
  {value: 'hold', label: 'Hold'}, {value: '1', label: '1 tick/s'}, {value: '12', label: '12 ticks/s'},
])

/** The edit a harmonic option names (B1..B8 or the selected row). */
export function harmonicEdit(value: string): InstrumentEdit {
  return value === 'row'
    ? {kind: 'harmonic', source: {selection: 'selected-source-row'}}
    : {kind: 'harmonic', source: {selection: 'canonical-basis', index: Number(value.slice('basis:'.length))}}
}

let current: LiveTorusState | null = null
const listeners = new Set<() => void>()

/** Two states are the same when the whole of what the owner announced is: its reading, its determinants and its parameters. Comparing
 * the reading alone dropped a change of parameters while the instrument stood still — the last effect taken off its chain, a level set
 * while held (native screen pass r4, 18 Oct). */
function same(a: LiveTorusState | null, b: LiveTorusState | null): boolean {
  if (a === null || b === null) return a === b
  if (a.ok !== b.ok) return false
  return a.ok ? JSON.stringify(a) === JSON.stringify(b) : a.fault === (b as {fault: string}).fault
}

/** Publish the instrument state the hosted frame validated (`state` or `null` to withdraw). Readers are told only of a change:
 * an identical publish keeps the same state object, so every reader holds one state. */
export function publishLiveTorusState(next: LiveTorusState | null): void {
  if (same(current, next)) return
  current = next
  for (const listener of [...listeners]) listener()
}

/** The one instrument state, as a plain read: null while no owner reading is published. */
export function liveTorusState(): LiveTorusState | null {
  return current
}

/** Subscribe to publishes and withdrawals. Returns the unsubscribe. */
export function subscribeLiveTorus(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The one instrument state, as a hook: every shell reader re-renders on the same publish. */
export function useLiveTorusReading(): LiveTorusState | null {
  return useSyncExternalStore(subscribeLiveTorus, liveTorusState, liveTorusState)
}

/** The named reason the reader gives while no owner reading stands in a host (the same words the Live widget shows). */
export const LIVE_TORUS_ABSENT_REASON = 'No owner reading in this host. The stage is the Expressions frame\'s native field; it is not open here.'

/** A reason the reader names in place of an owner reading: an absent owner, or the refusal the boundary named. */
export interface QlInstrumentRefusal {
  readonly kind: 'absent' | 'refused'
  readonly reason: string
}

/** What the QL instrument face is fed: the owner reading the boundary validated, or the reader's own named reason. */
export type QlInstrumentFeed = QlInstrumentReading | QlInstrumentRefusal

/** The reader's state as the instrument face takes it. No publish is an absent owner, named; a refusal carries the boundary's fault verbatim. */
export function qlInstrumentFeed(state: LiveTorusState | null): QlInstrumentFeed {
  if (state === null) return {kind: 'absent', reason: LIVE_TORUS_ABSENT_REASON}
  return state.ok ? state.value : {kind: 'refused', reason: state.fault}
}

/** The QL instrument's feed, as a hook: the same one reader handle every shell presentation of the instrument reads. */
export function useQlInstrumentFeed(): QlInstrumentFeed {
  return qlInstrumentFeed(useLiveTorusReading())
}

export interface LiveTorusOption {readonly value: string; readonly label: string}

export interface LiveTorusMacroRow {
  readonly macro: LiveTorusMacro
  /** The owner's value for this determinant as a label, or null while the owner states none. */
  readonly value: string | null
  /** The option the owner's value selects, or null while the owner states none. */
  readonly selected: string | null
  /** The owner's choices for this determinant. */
  readonly options: readonly LiveTorusOption[]
  /** The owner edit an option names. */
  readonly edit: (value: string) => InstrumentEdit
}

/** The four macro rows: each reads the owner's determinant and offers the owner's choices. The values come from the owner's
 * announcement only; a row with no owner determinants has no selection, and its control stays disabled. */
export function liveTorusMacroRows(state: LiveTorusState | null): LiveTorusMacroRow[] {
  const d = state !== null && state.ok ? state.determinants ?? null : null
  const harmonic = d === null ? null : d.harmonic.selection === 'canonical-basis' ? `basis:${d.harmonic.index}` : 'row'
  const byId: Record<string, {value: string | null; selected: string | null; options: readonly LiveTorusOption[]; edit: (value: string) => InstrumentEdit}> = {
    'lens': {
      value: d === null ? null : d.lens.label,
      selected: d === null ? null : String(d.lens.lens12),
      options: LIVE_LENS_OPTIONS.map(option => ({value: String(option.value), label: option.label})),
      edit: value => ({kind: 'lens', lens12: Number(value)}),
    },
    'context-frame': {
      value: d === null ? null : `CF${d.contextFrame}`,
      selected: d === null ? null : String(d.contextFrame),
      options: LIVE_CONTEXT_FRAME_OPTIONS.map(option => ({value: String(option.value), label: option.label})),
      edit: value => ({kind: 'context-frame', context_frame: Number(value)}),
    },
    'harmonic-basis': {
      value: d === null ? null : d.harmonic.selection === 'canonical-basis' ? `B${d.harmonic.index + 1}` : 'Row',
      selected: harmonic,
      options: LIVE_HARMONIC_OPTIONS,
      edit: harmonicEdit,
    },
    'm3-transcription': {
      value: d === null ? null : d.rna ? 'RNA' : 'DNA',
      selected: d === null ? null : d.rna ? 'RNA' : 'DNA',
      options: [{value: 'DNA', label: 'DNA'}, {value: 'RNA', label: 'RNA'}],
      edit: value => ({kind: 'transcription', rna: value === 'RNA'}),
    },
  }
  return LIVE_TORUS_MACROS.slice(0, LIVE_TORUS_MAX_MACROS).map(macro => ({macro, ...byId[macro.id]}))
}

// ── the owner's M1′ session: its ranges and the `torus` edit a change names (O-I #850; manual §21.2 Parameters). Pure: torusDevice.ts
// draws it and the MIDI map (midiMap/midiMapTargets.ts) writes through it, both in the session's own words.

/** The owner's session as the boundary validated it, or null while the frame announces none. */
export type TorusSession = NonNullable<NonNullable<LiveTorusParameters>['torus']>
export type TorusSettingsEdit = Extract<InstrumentEdit, {kind: 'torus'}>['edit']
export const torusSessionOf = (state: LiveTorusState | null): TorusSession | null => (state !== null && state.ok ? state.parameters?.torus ?? null : null)

/** The manual's ranges (§21.2 Parameters), which the controls draw; QL refuses outside them in its own words. */
export const TORUS_RATE = {min: 1 / (365.25 * 86_400), max: 40_000, default: 2.5} as const
export const TORUS_FUNDAMENTAL = {min: 20, max: 2000} as const
export const TORUS_POLYPHONY = {min: 1, max: 32, default: 16} as const
export const TORUS_TEMPO = {min: 20, max: 999} as const
export const TORUS_TUNINGS = ['logic', 'maqam', 'sky'] as const
export const TORUS_SHAPES = ['auto', 'sequence', 'torus', 'figure-eight', 'spiral', 'klein-bottle'] as const
export const TORUS_TUNING_WORD: Readonly<Record<(typeof TORUS_TUNINGS)[number], string>> = {logic: 'Logic', maqam: 'Maqām', sky: 'Sky'}
export const TORUS_SHAPE_WORD: Readonly<Record<(typeof TORUS_SHAPES)[number], string>> = {auto: 'Auto', sequence: 'Sequence', torus: 'Torus', 'figure-eight': 'Figure-eight', spiral: 'Spiral', 'klein-bottle': 'Klein bottle'}
export const TORUS_BAND_WORD: Readonly<Record<TorusSession['band'], string>> = {cosmic: 'Cosmic', breath: 'Breath', rhythm: 'Rhythm', pitch: 'Pitch', beyond: 'Beyond'}
/** The Sync note lengths Rate offers, 1/64 to 8 bars. */
export const TORUS_NOTE_LENGTHS = ['1/64', '1/32', '1/16', '1/8', '3/16', '1/4', '3/8', '1/2', '3/4', '1/1', '2/1', '4/1', '8/1'] as const

const inRange = (value: Value | undefined, range: {min: number; max: number}): value is number => typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max
/** The owner's `torus` edit a change of a session key names, in QL's own form, or the words for why not. Pure. */
export function torusSessionEdit(session: TorusSession, {key, value}: ValueChange): TorusSettingsEdit {
  const t = session.settings
  const note = (text: Value | undefined) => {
    const match = typeof text === 'string' ? /^(\d+)\/(\d+)$/.exec(text) : null
    if (!match || !TORUS_NOTE_LENGTHS.includes(text as (typeof TORUS_NOTE_LENGTHS)[number])) throw new Error('A Sync rate is a note length from 1/64 to 8 bars.')
    return {numerator: Number(match[1]), denominator: Number(match[2])}
  }
  switch (key) {
    case 'rate':
      if (!inRange(value, TORUS_RATE)) throw new Error('Rate runs from one step a year to 40,000 steps a second.')
      return {rate: {mode: 'free', steps_per_second: value}}
    case 'rate.mode':
      if (value === 'free') return {rate: {mode: 'free', steps_per_second: Math.min(TORUS_RATE.max, Math.max(TORUS_RATE.min, session.steps_per_second))}}
      if (value === 'sync') return {rate: {mode: 'sync', note: t.rate.mode === 'sync' ? {...t.rate.note} : {numerator: 1, denominator: 4}}}
      throw new Error('Rate is Free or Sync.')
    case 'rate.note': return {rate: {mode: 'sync', note: note(value)}}
    case 'tempo':
      if (!inRange(value, TORUS_TEMPO)) throw new Error('Tempo takes 20 to 999 BPM.')
      return {tempo_bpm: value}
    case 'fundamental':
      if (!inRange(value, TORUS_FUNDAMENTAL)) throw new Error('Fundamental takes 20 to 2,000 Hz, or Map.')
      return {fundamental: {source: 'hz', hz: value}}
    case 'fundamental.source':
      if (value === 'map') return {fundamental: {source: 'map'}}
      if (value === 'hz') return {fundamental: {source: 'hz', hz: Math.min(TORUS_FUNDAMENTAL.max, Math.max(TORUS_FUNDAMENTAL.min, session.fundamental_hz))}}
      throw new Error('Fundamental is Map or a frequency.')
    case 'carrier':
      if (!inRange(value, {min: 0, max: 100})) throw new Error('Carrier takes 0 to 100 %.')
      return {carrier: Math.round(value * 10) / 1000}
    case 'shape':
      if (!TORUS_SHAPES.includes(value as (typeof TORUS_SHAPES)[number])) throw new Error('Shape is Auto, Sequence, Torus, Figure-eight, Spiral or Klein bottle.')
      return {shape: value as (typeof TORUS_SHAPES)[number]}
    case 'tuning': {
      const tuning = value as (typeof TORUS_TUNINGS)[number]
      if (!TORUS_TUNINGS.includes(tuning)) throw new Error('Tuning is Logic, Maqām or Sky.')
      // Whether the scene holds the tuning's voices is the owner's to answer: a tuning it holds none for (the condition's maqām without
      // its source, a scene with no sky) is refused by QL's torus-set in words naming what is missing (scene_field.rs maqam_absence; O-I 854).
      return {tuning}
    }
    case 'polyphony':
      if (!inRange(value, TORUS_POLYPHONY) || !Number.isInteger(value)) throw new Error('Polyphony takes 1 to 32 notes.')
      return {polyphony: value}
  }
  throw new Error(`${key}: no setting of the Torus's session.`)
}
