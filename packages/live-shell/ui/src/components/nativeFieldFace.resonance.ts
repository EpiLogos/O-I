import type {FieldFaceModel} from './nativeFieldFaceModel.ts'
import {fieldValue} from './nativeFieldFaceValues.ts'

/** Continuous resonance device. Whole app panel: desktop/cradle/expressions-app/field-studies-journeys/src/inspector.ts:126-133
 * ("Continuous resonance" block and its Compatibility group). The fourteen numerics are the Cymatics registry parameters
 * (src/engine/paramRegistry.ts:57,134-146, group 'Cymatics' -> 'resonance' in nativeParameters.ts:32). The non-numeric controls
 * are in the view's switches. Pure: no React, no commits. */

/** Tuning band (inspector.ts:128, the frequency range that is field.params.frequency) and Dominance (inspector.ts:130). */
const TUNING = ['cymatics.frequencyHz', 'cymatics.dominance'] as const
/** The app's resonance numerics, in the app's own order (inspector.ts:133, inGroup 'resonance' minus frequency and dominance). */
const MODAL = ['cymatics.driveScale', 'cymatics.dampingQFactor', 'cymatics.driveStrength', 'cymatics.transportGain', 'cymatics.agitation',
  'cymatics.plateSize', 'cymatics.modeCount', 'cymatics.boundaryStrength', 'cymatics.baseFrequency'] as const
/** Sweep Period, Sweep Glide and Sweep Dwell (the same app block, last in its order; inspector.ts:130-133). */
const SWEEP = ['cymatics.sweepSpeed', 'cymatics.sweep.glideS', 'cymatics.sweep.dwellS'] as const

/** The native paths that the in-diagram handles drive. controlPath must not be among them (NativeFieldHandle contract). */
export const RESONANCE_HANDLE_PATHS = ['cymatics.frequencyHz', 'cymatics.dampingQFactor', 'cymatics.baseFrequency', 'cymatics.plateSize',
  'cymatics.sweep.glideS', 'cymatics.sweep.dwellS'] as const

export const resonanceFaceModel: FieldFaceModel = {
  name: 'Continuous resonance',
  paths: [...TUNING, ...MODAL, ...SWEEP],
  groups: [
    {title: 'Tuning band and mix', paths: TUNING, note: 'Tuning band is the shared drive frequency (inspector.ts:128). It is the live drive only while the frequency driver is Manual, or Automation without a station sweep; the diagram shows which source is live. Dominance sets how far the resonator transport takes over formation springs (registry hint).'},
    {title: 'Resonator and drive', paths: MODAL, note: 'Continuous resonance numerics (inspector.ts:133). Inactive while the resonant medium is off or Compatibility is the legacy template mode (PointCloudField.ts:1811). modeCount ranks the 64 lattice modes by drive coupling; the seven station modes stay active whatever it is (cymaticResonator.ts:263-276).'},
    {title: 'Station sweep', paths: SWEEP, note: 'Sweep Period is legacy: PointCloudField.ts:1852 reads it only as a glide fallback when Sweep Glide is absent, and the shell bridge always sets Sweep Glide (nativeBridge.ts:87). Glide and dwell run only while Automation owns the frequency and Sweep linked stations is on (nativeBridge.ts:88-90).'},
  ],
  // The four performer levers: where the tone is (frequencyHz), how sharp the body rings (dampingQFactor), how hard it is driven
  // (driveStrength), and how far it takes over the particles (dominance). modeCount is left out: it ranks modes by a coupling
  // the shell cannot see and the seven station modes stay on regardless, so its effect is indirect.
  compact: ['cymatics.frequencyHz', 'cymatics.dampingQFactor', 'cymatics.driveStrength', 'cymatics.dominance'],
  studio: 'resonance',
  // The bottom slider drives a non-handle numeric; frequencyHz is an in-diagram handle here (NativeFieldHandle contract).
  controlPath: 'cymatics.driveStrength',
  enabled: ({scene}) => scene.engine.resonanceEnabled === true,
  strip: {
    summary: ({scene}) => `${fieldValue(scene, 'cymatics.frequencyHz')} Hz · Q ${fieldValue(scene, 'cymatics.dampingQFactor')}`,
    toggle: {kind: 'field-setting', key: 'resonanceEnabled'},
  },
}

export type ResonatorDimension = '2D' | '3D'
export interface LatticeMode {m: number; n: number; p?: number; hz: number}
/** Engine mode lattice. 2D plate: m,n in 1..8 with f = f0*(m^2+n^2) (cymaticResonator.ts:63, 258). 3D cavity: m,n,p in 1..4 with
 * f = f0*sqrt(m^2+n^2+p^2) (cymaticResonator.ts:66, 251). Frequencies are in Hz for the given f0. */
export function latticeModes(dimension: ResonatorDimension, f0: number): LatticeMode[] {
  const out: LatticeMode[] = []
  if (dimension === '3D') {
    for (let m = 1; m <= 4; m++) for (let n = 1; n <= 4; n++) for (let p = 1; p <= 4; p++) out.push({m, n, p, hz: f0 * Math.sqrt(m * m + n * n + p * p)})
  } else {
    for (let m = 1; m <= 8; m++) for (let n = 1; n <= 8; n++) out.push({m, n, hz: f0 * (m * m + n * n)})
  }
  return out
}
/** The lattice mode whose frequency is nearest the drive on a log scale; the first mode wins a tie. */
export function nearestMode(modes: readonly LatticeMode[], hz: number): LatticeMode | undefined {
  if (!(hz > 0)) return undefined
  let best: LatticeMode | undefined, distance = Infinity
  for (const mode of modes) {
    if (!(mode.hz > 0)) continue
    const d = Math.abs(Math.log(mode.hz / hz))
    if (d < distance) {best = mode; distance = d}
  }
  return best
}
/** Normalised 2D plate mode shape (cymaticResonator.ts:152-157). u, v are fractions of the plate side from its centre
 * (driveX/driveY comment, cymaticResonator.ts:125), so they run over [-1/2, 1/2]. */
export function plateModeShape(m: number, n: number, u: number, v: number): number {
  const s = (m + n) % 2 === 0 ? 1 : -1
  return Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v) + s * (Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v))
}
/** Cell-sampled mode shape, scaled so the largest magnitude is 1. Sign gives the nodal regions; magnitude gives the swing. */
export function plateSketch(m: number, n: number, cells: number): number[][] {
  const grid = Array.from({length: cells}, (_, row) => Array.from({length: cells}, (_, col) =>
    plateModeShape(m, n, (col + 0.5) / cells - 0.5, (row + 0.5) / cells - 0.5)))
  const peak = Math.max(1e-9, ...grid.flat().map(Math.abs))
  return grid.map(line => line.map(value => value / peak))
}
export const PLATE_CELLS = 14
/** Station count of the sweep (cymaticResonator.ts:65). Waypoints are these stations, or the there-and-back path through them. */
export const RESONATOR_STATION_COUNT = 7

export interface ResonanceGateInput {resonanceEnabled: boolean; resonatorMode?: 'resonator' | 'template'; frequencyDriver: 'manual' | 'focus' | 'automation'; autoSweep: boolean}
/** Which source the engine drives the modal body from, given the same flags the shell bridge uses (nativeBridge.ts:87-91).
 * off: the medium is stopped (PointCloudField.ts:1811). focus: travelling focus sets the drive (PointCloudField.ts:1838-1872).
 * sweep: the station sweep owns the frequency (cymaticResonator.ts:492). frequency: the tuning band is the drive. */
export function resonanceGate(input: ResonanceGateInput): {modal: boolean; drive: 'off' | 'frequency' | 'focus' | 'sweep'} {
  const modal = input.resonanceEnabled && (input.resonatorMode ?? 'resonator') !== 'template'
  const drive = !modal ? 'off' : input.frequencyDriver === 'focus' ? 'focus' : input.frequencyDriver === 'automation' && input.autoSweep ? 'sweep' : 'frequency'
  return {modal, drive}
}
/** Sweep schedule as the engine runs it (cymaticResonator.ts:492-528): waypoints are the stations ascending, descending, or
 * there-and-back (7 + 5 = 12). Each waypoint holds for dwell, then glides for glide; the cycle repeats. */
export function sweepSchedule(direction: 'ascent' | 'descent' | 'pingpong', glideS: number, dwellS: number) {
  const waypoints = direction === 'pingpong' ? 2 * RESONATOR_STATION_COUNT - 2 : RESONATOR_STATION_COUNT
  const dwell = Math.max(0, dwellS), glide = Math.max(0.05, glideS), segment = dwell + glide
  return {waypoints, dwellS: dwell, glideS: glide, segmentS: segment, dwellFraction: segment > 0 ? dwell / segment : 0, cycleS: waypoints * segment}
}
