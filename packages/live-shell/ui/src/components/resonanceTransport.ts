/**
 * The transport's key row and Follow in Expressions (O-I #747 round 895, OPEN 8; DLW build ruling 2026-11-08: wired, or their words say
 * exactly why not). Manual §10.5, the Expressions column: "Key, root and scale | … | Tune the field's resonance" and "Follow | … | Keep
 * views with the scene".
 *
 * The key row tunes the plate the Resonance device drives (DLW §20.14, its Transport: "Key, root and scale | Tunes the resonance. With Key
 * source set to Sky, the planets move it."): ☿ Resonance is its Drive frequency (`cymatics.frequencyHz`, the Field's Resonance, §20.2), Root
 * the Base frequency of its modes (`cymatics.baseFrequency`: each mode rings at f0 · (m² + n²)), and Scale its Mode count
 * (`cymatics.modeCount`). Each is the field parameter the Resonance's own dials set (inhabitants/catalogue/panels/expressions__resonance.tsx),
 * one owner request on the captured basis (shell/transports/useExpressionsTransport.tsx, as Tempo is). The tone takes the transport only
 * where Drive frequency is the live drive (§20.14 Rules; §20.2 Key source; the engine's torusDrive.ts): elsewhere the slot shows the tone
 * and says who sets it, read from the scene's own values (components/nativeFieldFace.resonance.ts resonanceGate).
 *
 * Follow holds no switch here, and says why in the frame's own terms (field-studies-journeys app.ts advanceSavedScene, setSceneRef).
 */
import type {Scene} from '../../../../expressions-boundary/src/editor'
import {resonanceGate} from './nativeFieldFace.resonance'
import type {BarParameter} from './nativeBarModel'

export type ResonanceSlot = 'key' | 'root' | 'scale'

/** The field parameter each slot of the key row sets (desktop/cradle/expressions-app/src/engine/paramRegistry.ts). */
export const RESONANCE_SLOT_PATHS: Readonly<Record<ResonanceSlot, string>> = {key: 'cymatics.frequencyHz', root: 'cymatics.baseFrequency', scale: 'cymatics.modeCount'}

/** A slot's control as the bar draws it (O-I #747 round 896, 0R-surface.7: the transport rows keep the manual's ranges). The manual's
 * ranges are the registry's soft bounds (DLW §20.14 Parameters: Drive frequency "20 to 4000 Hz", Plate's "Base frequency 5 to 200 Hz", Mode
 * count "1 to 64"; desktop/cradle/expressions-app/src/engine/paramRegistry.ts): a value typed, stepped or dragged here is clamped to them,
 * as Tempo's is, and Scale's is a whole number. The registry's hard bounds stay its own, for the other sources (a lane, the Resonance's own
 * dials, a document). Pure. */
export function resonanceParameter(slot: ResonanceSlot, parameter: BarParameter): BarParameter {
  return {...parameter, hardMin: parameter.min, hardMax: parameter.max, clamp: true, ...(slot === 'scale' ? {whole: true} : {})}
}

const WORDS: Readonly<Record<ResonanceSlot, string>> = {
  key: '☿ Resonance — the tone that drives the plate (the Resonance\'s Drive frequency)',
  root: 'Root — the base tone of the plate\'s modes: each mode rings at f0 · (m² + n²) (the Resonance\'s Base frequency)',
  scale: 'Scale — how many of the plate\'s modes take part, the best coupled to the drive first (the Resonance\'s Mode count)',
}
const BUSY = 'The native editor is busy or not attached.'
const EITHER = 'choose Manual as the Field\'s Key source, or as the Resonance\'s Frequency driver, to tune it here.'

/** Who sets the plate's tone now, from the scene's own values (never a settings row's label), as the engine resolves it. */
export interface PlateDrive {readonly drive: 'off' | 'frequency' | 'torus' | 'focus' | 'sweep'; readonly keySource?: 'torus' | 'sky' | 'manual'}
export function plateDriveOf(scene: Pick<Scene, 'engine' | 'composition'>): PlateDrive {
  const {engine, composition} = scene
  const {drive} = resonanceGate({resonanceEnabled: engine.resonanceEnabled === true, resonatorMode: engine.resonatorMode,
    frequencyDriver: composition.frequencyDriver ?? 'torus', keySource: composition.keySource, autoSweep: engine.autoSweep === true})
  return {drive, ...(composition.keySource ? {keySource: composition.keySource} : {})}
}

/** Why a slot of the key row takes no value now, or null. The tone takes it only where Drive frequency is the live drive (or the plate is
 * off, when it waits for the plate); the base tone and the modes are the plate's whatever sets its tone. */
export function resonanceRefusal(slot: ResonanceSlot, plate: PlateDrive | null, ready: boolean): string | null {
  if (!ready || !plate) return BUSY
  if (slot !== 'key') return null
  if (plate.drive === 'torus') return plate.keySource === 'sky'
    ? `The sky over your world sets the plate's tone now (Key source Sky): ${EITHER}`
    : `The Torus sets the plate's tone now: ${EITHER}`
  if (plate.drive === 'focus') return 'The travelling Focus sets the plate\'s tone now: choose Manual as the Resonance\'s Frequency driver to tune it here.'
  if (plate.drive === 'sweep') return 'The station sweep sets the plate\'s tone now: turn the Resonance\'s Sweep off, or choose Manual as its Frequency driver, to tune it here.'
  return null
}

/** The slot's title: what it tunes, and, for the tone, the tone the plate rings at as the engine reports it. */
export function resonanceTitle(slot: ResonanceSlot, refusal: string | null, ringing?: number): string {
  const live = slot === 'key' && ringing !== undefined && Number.isFinite(ringing) ? ` The plate rings at ${Math.round(ringing)} Hz now.` : ''
  return refusal ? `${WORDS[slot]}.${live} ${refusal}` : `${WORDS[slot]}.${live} Drag the name, type a value, or use the arrow keys.`
}

/** Follow in Expressions: no switch, and why — what the frame does with the views as the scenes play. */
export const EXPRESSIONS_FOLLOW_WHY = 'Saved playback selects each scene at its owner before it plays it, so the views that read the selection move with the scene; outside the saved sequence, a scene a Jump lands on moves the field alone. There is no switch here to keep or release that.'
