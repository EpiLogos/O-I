// Live mode's one instrument — the M1 torus (DEVICE-SEMANTICS-LOCK §0.2, §2.1;
// ticket T-LIVE-TORUS-INSTRUMENT).
//
// One simulation, one state. The simulation is the native field owner in the
// hosted Expressions frame (desktop/cradle/expressions-app/field-studies-journeys/
// src/nativeField.ts -> native-field/controller.ts). The shell never runs a second
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
import type {HostedInstrument} from '@epilogos/expressions-boundary'

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

/** What the handle holds: the owner reading the boundary validated, with the owner's determinants, or the refusal it named. */
export type LiveTorusState =
  | {readonly ok: true; readonly value: QlInstrumentReading; readonly determinants: LiveTorusDeterminants}
  | {readonly ok: false; readonly fault: string}

/** The handle's state from the instrument the hosted frame announced. Absent (no announcement) is null: the reading is withdrawn. */
export function liveTorusFromHost(instrument: HostedInstrument | undefined): LiveTorusState | null {
  if (instrument === undefined) return null
  return instrument.ok
    ? {ok: true, value: instrument.reading, determinants: instrument.determinants}
    : {ok: false, fault: instrument.fault}
}

let current: LiveTorusState | null = null
const listeners = new Set<() => void>()

function same(a: LiveTorusState | null, b: LiveTorusState | null): boolean {
  if (a === null || b === null) return a === b
  if (a.ok !== b.ok) return false
  return a.ok ? JSON.stringify(a.value) === JSON.stringify((b as {value: unknown}).value) : a.fault === (b as {fault: string}).fault
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

export interface LiveTorusMacroRow {
  readonly macro: LiveTorusMacro
  /** The owner's value for this determinant, or null while the owner states none. */
  readonly value: string | null
}

/** The four macro rows, each reading the owner's own determinant: the lens label, CF n, the harmonic basis (B n or the selected
 * source row), and the M3 transcription. Null while no owner determinants stand — never a default. */
export function liveTorusMacroRows(state: LiveTorusState | null): LiveTorusMacroRow[] {
  const d = state !== null && state.ok ? state.determinants ?? null : null
  const value = (id: string): string | null => {
    if (d === null) return null
    if (id === 'lens') return d.lens.label
    if (id === 'context-frame') return `CF${d.contextFrame}`
    if (id === 'harmonic-basis') return d.harmonic.selection === 'canonical-basis' ? `B${d.harmonic.index + 1}` : 'Row'
    if (id === 'm3-transcription') return d.rna ? 'RNA' : 'DNA'
    return null
  }
  return LIVE_TORUS_MACROS.slice(0, LIVE_TORUS_MAX_MACROS).map(macro => ({macro, value: value(macro.id)}))
}
