// Light (§17.10, techne:light) and the Lens (§17.11, techne:lens): the two effects on a reading's chain whose owners no route of this
// candidate reaches. Each stands where the manual puts it and draws its design on a binding with no reading: every key absent, every
// control disabled naming the operation it waits for. Nothing is the design's sample.
//   - Light's engine is LightBox (optics/raytracer.ts traceRays, the design's header): it is not in this candidate's tree — no file of
//     packages/live-shell/ui, desktop/cradle or the hosted frame holds it (searched 21 Oct for raytracer.ts, LightBox, traceRays) —
//     and the Canvas board it lays its bench over is not published by the research frame (frameBindings.ts NO_BOARD).
//   - The Lens's owner is Quaternal Logic's `techne reading` and `mef lenses` (with `context-frame list` and `service capabilities`):
//     the kernel routes none of them (T-COVERAGE §1.2, "Quaternal Logic | techne reading, mef lenses, context-frame list, service
//     capabilities … | The Lens").
import type {DesignBinding, ValueChange} from '../../frame/devices/designed'
import {LENS_DESIGN, LIGHT_DESIGN, disabled, missing, refusal} from './designDevices'

export const LIGHT_ID = LIGHT_DESIGN
export const LENS_ID = LENS_DESIGN

const NO_ENGINE = missing('Light', 'a light trace over the Canvas board — LightBox (optics/raytracer.ts traceRays) is not in this candidate, and the research frame publishes no board', 'Technē')
/** Light's controls (techne__light.tsx: light.on, light.source, light.card, light.elements, light.bounces, light.segments, light.spectrum,
 * light.rays, and the four transmissions). */
export const LIGHT_REFUSE: Readonly<Record<string, string>> = Object.fromEntries(['light.on', 'light.source', 'light.card', 'light.elements', 'light.bounces', 'light.segments',
  'light.spectrum', 'light.rays', 'tx.fact', 'tx.claim', 'tx.inference', 'tx.guess'].map(key => [key, NO_ENGINE]))

const NO_READING = missing('The Lens', 'kernel routes for `ql techne reading` and `ql mef lenses` (with `ql context-frame list` and `ql service capabilities`)', 'Quaternal Logic')
/** The Lens's controls (techne__lens.tsx: lens.mode, lens.lens, lens.sublens, lens.operation, frame.position, frame.face, frame.grain). */
export const LENS_REFUSE: Readonly<Record<string, string>> = Object.fromEntries(['lens.mode', 'lens.lens', 'lens.sublens', 'lens.operation', 'frame.position', 'frame.face',
  'frame.grain'].map(key => [key, NO_READING]))

/** Light's readings (the Canvas's board and the engine's sensors) and the Lens's (QL's registry, the reading, the frame's answer). */
const LIGHT_READINGS = ['items', 'lines', 'sensor.power'] as const
const LENS_READINGS = ['lenses', 'frames', 'service', 'reading.subject', 'reading.members', 'reading.lens', 'reading.frame', 'reading.class', 'reading.evidence', 'reading.provider',
  'reading.summary', 'reading.instruments', 'reading.degraded', 'proposals', 'frame.mapping', 'frame.status', 'frame.frames', 'frame.missing'] as const
export const lightAbsent = (): string => NO_ENGINE
export const lensAbsent = (): string => NO_READING

/** An effect no route reaches: no reading, every control refused with the operation it waits for, every reading saying why it has none. */
function unreached(id: string, refuse: Readonly<Record<string, string>>, readings: readonly string[], why: string): DesignBinding {
  return {
    id,
    values: {},
    standing: {...disabled(refuse), ...disabled(Object.fromEntries(readings.map(key => [key, why])))},
    writes: key => key in refuse,
    write: async (changes: readonly ValueChange[]) => { for (const {key} of changes) throw refusal(refuse, key) },
  }
}

export const lightBinding = (): DesignBinding => unreached(LIGHT_ID, LIGHT_REFUSE, LIGHT_READINGS, NO_ENGINE)
export const lensBinding = (): DesignBinding => unreached(LENS_ID, LENS_REFUSE, LENS_READINGS, NO_READING)
