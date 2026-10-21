// Light (§17.10, techne:light) and the Lens (§17.11, techne:lens): the two effects on a reading's chain. Each stands where the manual
// puts it and draws its design on what its owner answers here: every other key absent, every control disabled naming the operation it
// waits for. Nothing is the design's sample.
//   - Light's engine is LightBox (optics/raytracer.ts traceRays, the design's header): it is not in this candidate's tree — no file of
//     packages/live-shell/ui, desktop/cradle or the hosted frame holds it (searched 21 Oct for raytracer.ts, LightBox, traceRays) —
//     and the Canvas board it lays its bench over is not published by the research frame (frameBindings.ts NO_BOARD).
//   - The Lens's owner is Quaternal Logic. What it answers through the kernel's ql_read is drawn (lensRegistry.ts): the lens registry
//     (`ql mef lenses`), the frames (`ql context-frame list`) and the provider's operations (`ql service capabilities`). The rest names
//     what it waits for. The reading (`ql techne reading`) is routed, but it reads a target its caller supplies, and nothing in the shell
//     supplies one for the reading on a chain. The frame reading (`ql context-frame read`) is routed, but it reads a sixfold mapping its
//     caller names, and nothing names the material's six positions. The controls are fields of requests no QL command takes. The
//     proposals have no producer even then: QL's WikiFrame refraction engine leaves every reading's relation and traversal candidates
//     empty (QL-MEF crates/ql-wiki/src/refraction.rs:787-788), and `ql techne reading` carries none.
import type {DesignBinding, ValueChange} from '../../frame/devices/designed'
import {LENS_DESIGN, LIGHT_DESIGN, disabled, missing, refusal} from './designDevices'
import {registryKeys, type LensRegistry} from './lensRegistry'

export const LIGHT_ID = LIGHT_DESIGN
export const LENS_ID = LENS_DESIGN

const NO_ENGINE = missing('Light', 'a light trace over the Canvas board — LightBox (optics/raytracer.ts traceRays) is not in this candidate, and the research frame publishes no board', 'Technē')
/** Light's controls (techne__light.tsx: light.on, light.source, light.card, light.elements, light.bounces, light.segments, light.spectrum,
 * light.rays, and the four transmissions). */
export const LIGHT_REFUSE: Readonly<Record<string, string>> = Object.fromEntries(['light.on', 'light.source', 'light.card', 'light.elements', 'light.bounces', 'light.segments',
  'light.spectrum', 'light.rays', 'tx.fact', 'tx.claim', 'tx.inference', 'tx.guess'].map(key => [key, NO_ENGINE]))

/** The reading on the chain: QL reads a target its caller supplies, and no owner here supplies one. */
const NO_TARGET = 'No reading through the lens: QL reads the target its caller supplies (`ql techne reading <target.json>`, routed as ql_read techne-reading), '
  + 'and nothing in the shell supplies one for the reading on this chain. The cradle composes its wiki readings without QL (desktop/cradle/src/techne/wikiReadingProvider.ts), '
  + 'and no owner implements QL\'s WikiSubjectSource (QL-MEF crates/ql-adapters/src/techne_wiki.rs:35).'
/** The frame reading: QL reads a sixfold mapping its caller names, and no owner here names one. */
const NO_MAPPING = 'No frame reading: QL reads the frame of a sixfold mapping its caller names (`ql context-frame read -`, QL-MEF pull 344, routed as ql_read context-frame-read: '
  + 'six external position refs, their source, and the probe), and nothing in the shell names the material\'s six positions.'
/** The lens, sublens and mode: QL's reading pins its own. */
const NO_APERTURE = 'QL\'s Technē reading refracts through the lens it pins (`mef:lens:L1@1`, no sublens, mode required: QL-MEF crates/ql-adapters/src/techne_wiki.rs:30, :72). '
  + 'No QL command takes a refraction request with another lens, sublens or mode (ql-wiki WikiRefractionRequest), and the `reading_for_request` its comment names does not exist.'
/** The operation: QL performs one. */
const NO_OPERATION = 'QL\'s one reading is the refraction `ql techne reading` makes. No QL command performs a locate, relate or synthesise: `ql service negotiate` only reports whether the provider supports one.'
/** The Lens's controls (techne__lens.tsx: lens.mode, lens.lens, lens.sublens, lens.operation, frame.position, frame.face, frame.grain). */
export const LENS_REFUSE: Readonly<Record<string, string>> = {'lens.mode': NO_APERTURE, 'lens.lens': NO_APERTURE, 'lens.sublens': NO_APERTURE, 'lens.operation': NO_OPERATION,
  'frame.position': NO_MAPPING, 'frame.face': NO_MAPPING, 'frame.grain': NO_MAPPING}

/** Light's readings (the Canvas's board and the engine's sensors) and the Lens's (QL's registry, the reading, the frame's answer). */
const LIGHT_READINGS = ['items', 'lines', 'sensor.power'] as const
const LENS_READING = ['reading.subject', 'reading.members', 'reading.lens', 'reading.frame', 'reading.class', 'reading.evidence', 'reading.provider', 'reading.summary',
  'reading.instruments', 'reading.degraded'] as const
const LENS_FRAME = ['frame.mapping', 'frame.status', 'frame.frames', 'frame.missing'] as const
const NO_PROPOSALS = missing('The proposals', 'candidates from QL\'s WikiFrame refraction — its engine leaves relation_candidates and traversal_candidates empty (crates/ql-wiki/src/refraction.rs:787-788), and `ql techne reading` carries none', 'Quaternal Logic')
export const lightAbsent = (): string => NO_ENGINE
/** Why each of the Lens's readings is absent where it is. */
export const LENS_ABSENT: Readonly<Record<string, string>> = {...Object.fromEntries(LENS_READING.map(key => [key, NO_TARGET])),
  ...Object.fromEntries(LENS_FRAME.map(key => [key, NO_MAPPING])), proposals: NO_PROPOSALS,
  lenses: 'Not read yet: QL\'s lens registry (`ql mef lenses`) is drawn once QL answers it.', frames: 'Not read yet: QL\'s frames (`ql context-frame list`) are drawn once QL answers them.',
  service: 'Not read yet: QL\'s provider operations (`ql service capabilities`) are drawn once QL answers them.'}
export const lensAbsent = (key: string): string => LENS_ABSENT[key] ?? LENS_REFUSE[key] ?? NO_TARGET

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
/** The Lens on Quaternal Logic: the registry's lists where QL has answered them, every other key absent with what it waits for, every
 * control refused naming the request no QL command takes. */
export const lensBinding = (registry?: LensRegistry): DesignBinding => {
  const binding = unreached(LENS_ID, LENS_REFUSE, [], NO_TARGET)
  const lists = registry ? registryKeys(registry) : {values: {}, standing: {}}
  return {...binding, values: lists.values, standing: {...binding.standing, ...disabled(LENS_ABSENT), ...lists.standing}}
}
