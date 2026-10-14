// The M1 torus as a device of the runtime (FOUNDATION F5, the reference device; lock §0.2.3: "the compact rack widget
// (mini torus + ≤4 macros), the expanded instrument in the browser pool, the full torus in the centre pane"). Its four
// macros are the owner's determinants, each an enumerated row whose choices are the owner's own; a change is the owner's
// own instrument edit through the hosted stage channel (torusInstrument.ts), and a refusal comes back in the owner's words.
// Its light reads the owner's standing: on while the instrument follows or is held, off otherwise, dark with no reading.
import type {DeviceDeclaration, SdkParamRow} from '../inhabitants/sdk/define'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import {commitLiveInstrumentEdit, liveInstrumentWritable, liveTorusMacroRows, LIVE_TORUS_TOPOLOGY, type LiveTorusState} from './torusInstrument'

export const TORUS_DEVICE_ID = 'live:m1-torus'

export const TORUS_DEVICE: DeviceDeclaration = {
  id: 'm1-torus', title: 'M1 torus', icon: 'live', liveSemantic: 'device-instrument',
  invariant: {generates: 'stage:instrument'}, note: 'The one instrument: the bi-phasal oscillator on the torus, played from the keyboard.',
} as DeviceDeclaration

const WRITE_PATH = 'stage:instrument'

/** The torus as the runtime draws it, over the owner's current reading. */
export function torusDevice(state: LiveTorusState | null): DeviceInstance {
  const macros = liveTorusMacroRows(state)
  const rows: SdkParamRow[] = macros.map(row => ({
    family: 'live', deviceInstance: TORUS_DEVICE_ID, key: row.macro.id, type: 'enumerated', title: row.macro.label,
    values: row.options.map(option => option.label), compact: true, group: 'Determinants',
    ...(liveInstrumentWritable(state) ? {writePath: WRITE_PATH} : {disclosure: 'The owner takes edits only while the instrument follows or is held.'}),
  }) as SdkParamRow)
  const values: Record<string, string | boolean> = {}
  for (const row of macros) {
    const option = row.options.find(choice => choice.value === row.selected)
    if (option) values[row.macro.id] = option.label
  }
  if (state?.ok) values.enabled = state.value.standing === 'following' || state.value.standing === 'held'
  return {
    id: TORUS_DEVICE_ID, family: 'live', face: TORUS_DEVICE, rows, values, enabledKey: state?.ok ? 'enabled' : undefined,
    submit: async changes => {
      for (const change of changes) {
        const row = macros.find(item => item.macro.id === change.key)
        const option = row?.options.find(choice => choice.label === change.value)
        if (!row || !option) throw Error(`${change.key}: not one of the owner's choices`)
        const result = await commitLiveInstrumentEdit(row.edit(option.value))
        if (!result.ok) throw Error(result.error)
      }
    },
  }
}

// ── the device's picture ─────────────────────────────────────────────────────
// The torus the device wears at all three sizes (lock §0.2.3; FOUNDATION F5: no text-only cards). It is the M1 embedding's
// own outline — the surface x=(R+cos θ1)cos θ2, y=(R+cos θ1)sin θ2, z=sin θ1 with R and r from LIVE_TORUS_TOPOLOGY (the QL
// kernel's constants, cited there) — drawn as meridians and parallels seen from a fixed tilt, with the far side of the
// surface fainter than the near. It is geometry, not state: the oscillation (the cymatic, playable torus, sound and picture
// from one state) is the simulation's render on the stage and is never redrawn here (lock §0.2.2). Nothing in the outline
// claims a phase; the owner's standing tints it (torusTone) and that is all the owner's reading adds.

/** How densely each size draws the outline: more lines where there is more room. */
export const TORUS_FIGURE_DETAIL = {
  compact: {meridians: 12, parallels: 5},
  whole: {meridians: 18, parallels: 7},
  full: {meridians: 28, parallels: 11},
} as const

export type TorusFigureSize = keyof typeof TORUS_FIGURE_DETAIL

export interface TorusFigure {
  /** The outline's near side and far side, as SVG path data. */
  front: string
  back: string
  /** The viewBox that holds the whole outline, in the embedding's own units. */
  view: {x: number; y: number; width: number; height: number}
}

const TILT = 62 * Math.PI / 180
const STEPS = 72
const TAU = Math.PI * 2
const round = (value: number) => Math.round(value * 1000) / 1000

/** The torus outline for a size. Pure: the same size always draws the same figure. */
export function torusFigure(size: TorusFigureSize, topology: Pick<typeof LIVE_TORUS_TOPOLOGY, 'major_radius' | 'minor_radius'> = LIVE_TORUS_TOPOLOGY): TorusFigure {
  const {meridians, parallels} = TORUS_FIGURE_DETAIL[size]
  const R = topology.major_radius, r = topology.minor_radius
  const sin = Math.sin(TILT), cos = Math.cos(TILT)
  let front = '', back = ''
  // one point on the surface, seen from the tilt: its screen position and whether its outward normal faces the viewer
  const point = (theta1: number, theta2: number) => {
    const ring = R + r * Math.cos(theta1)
    const x = ring * Math.cos(theta2), y = ring * Math.sin(theta2), z = r * Math.sin(theta1)
    const ny = Math.cos(theta1) * Math.sin(theta2), nz = Math.sin(theta1)
    return {x, y: y * cos - z * sin, near: ny * sin + nz * cos > 0}
  }
  // a curve is drawn as runs: a run keeps going while the curve stays on one side of the surface, and starts afresh where it turns
  const curve = (at: (t: number) => {x: number; y: number; near: boolean}) => {
    let previous = at(0)
    let side: boolean | null = null
    for (let step = 1; step <= STEPS; step++) {
      const next = at(step / STEPS)
      const near = previous.near && next.near
      const move = side === near ? `L${round(next.x)} ${round(next.y)}` : `M${round(previous.x)} ${round(previous.y)}L${round(next.x)} ${round(next.y)}`
      if (near) front += move; else back += move
      side = near
      previous = next
    }
  }
  for (let index = 0; index < meridians; index++) { const theta2 = TAU * index / meridians; curve(t => point(TAU * t, theta2)) }
  for (let index = 0; index < parallels; index++) { const theta1 = TAU * index / parallels; curve(t => point(theta1, TAU * t)) }
  // the outline's extent: the ring's reach across, and its reach down once tilted (at θ2 = 90°, y' = R cos α + r cos(θ1 + α))
  const across = R + r, down = R * cos + r
  const pad = 0.15
  return {front, back, view: {x: round(-across - pad), y: round(-down - pad), width: round(2 * (across + pad)), height: round(2 * (down + pad))}}
}

/** How strongly the owner's standing lights the outline: following and held are the instrument at work, opening is on its way,
 * and manual, unavailable or no reading leave it unlit. A tint is a reading of the standing and nothing more. */
export function torusTone(state: LiveTorusState | null): 'lit' | 'rising' | 'unlit' {
  if (state === null || !state.ok) return 'unlit'
  const standing = state.value.standing
  return standing === 'following' || standing === 'held' ? 'lit' : standing === 'opening' ? 'rising' : 'unlit'
}
