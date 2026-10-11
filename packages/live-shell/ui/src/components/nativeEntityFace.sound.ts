import type {Entity, NativeEditorReading, NativeEntitySoundChange} from '../../../../expressions-boundary/src/editor'
import {soundWithFollow, soundWithFrequency, validateNativeEntitySoundChange} from '../../../../expressions-boundary/src/nativeEntitySound.ts'
import {DEFAULT_ENTITY_SOUND, SOUND_WAVEFORMS, validateEntitySound, type EntitySound, type EntitySoundWaveform} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/entitySound.ts'
import type {EntityFaceModel} from './nativeEntityFaceModel.ts'

export {SOUND_WAVEFORMS}

/** Pure facts and draft arithmetic for the ENTITY Sound device. No React, no commits.
 * The fields are the whole `sound` block of the selected object (soundControls.ts, native-field/entitySound.ts), not registry parameters:
 * every write is one `{kind:'entity-sound'}` change carrying the next whole sound. */

export type SoundField = 'enabled' | 'waveform' | 'frequencyHz' | 'followCymatic' | 'gain' | 'attack' | 'release' | 'pan'
/** The three envelope handles drive these numeric fields. */
export type EnvelopeField = 'attack' | 'release' | 'gain'

/** Panel groups in soundControls.ts order (enable, follow, frequency, gain, waveform; then attack, release; then pan). */
export const SOUND_GROUPS = [
  {title: 'Voice', fields: ['enabled', 'followCymatic', 'frequencyHz', 'gain', 'waveform']},
  {title: 'Envelope', fields: ['attack', 'release']},
  {title: 'Placement', fields: ['pan']},
] as const satisfies readonly {title: string; fields: readonly SoundField[]}[]

/** The numeric fields with the app validator's inclusive bounds (native-field/entitySound.ts) and the inspector's step (soundControls.ts). */
export interface SoundNumberSpec {field: 'frequencyHz' | 'gain' | 'attack' | 'release' | 'pan'; label: string; unit: string; min: number; max: number; step: number}
export const SOUND_NUMBERS: readonly SoundNumberSpec[] = [
  {field: 'frequencyHz', label: 'Frequency', unit: 'Hz', min: 1, max: 20000, step: 1},
  {field: 'gain', label: 'Gain', unit: '(linear, 0 silent to 1)', min: 0, max: 1, step: 0.01},
  {field: 'attack', label: 'Attack', unit: 's', min: 0, max: 10, step: 0.01},
  {field: 'release', label: 'Release', unit: 's', min: 0, max: 30, step: 0.01},
  {field: 'pan', label: 'Pan', unit: '(-1 left, 1 right)', min: -1, max: 1, step: 0.01},
]
export const soundNumberSpec = (field: SoundNumberSpec['field']): SoundNumberSpec => SOUND_NUMBERS.find(spec => spec.field === field)!
/** The app's default for a numeric sound field: the value a Home reset returns to. */
export const soundDefault = (field: 'gain' | 'frequencyHz'): number => DEFAULT_ENTITY_SOUND[field]

/** The text a refused number shows: the bound it must sit inside. Null when the value is admitted. */
export function numberProblem(spec: SoundNumberSpec, value: number): string | null {
  // Units written in brackets are descriptions, not suffixes: "Pan must be from -1 to 1."
  const suffix = spec.unit && !spec.unit.startsWith('(') ? ` ${spec.unit}` : ''
  const range = `${spec.label} must be from ${spec.min} to ${spec.max}${suffix}.`
  if (!Number.isFinite(value)) return `${spec.label} must be a number from ${spec.min} to ${spec.max}${suffix}.`
  return value < spec.min || value > spec.max ? range : null
}
/** Exact-value text to a number: blank or non-numeric text is NaN, which numberProblem refuses. */
export function parseNumberText(text: string): number {
  const trimmed = text.trim()
  return trimmed === '' ? Number.NaN : Number(trimmed)
}

const decimalsOf = (step: number) => step >= 1 ? 0 : 2
/** Clamp to the field's bounds and snap to its step, so drag and key values never carry float noise. */
export function snapValue(spec: SoundNumberSpec, value: number): number {
  const clamped = Math.min(spec.max, Math.max(spec.min, Number.isFinite(value) ? value : spec.min))
  return Number((Math.round(clamped / spec.step) * spec.step).toFixed(decimalsOf(spec.step)))
}
/** One arrow step: the control's step, times ten with Shift. Null when the step cannot move (already at the bound). */
export function steppedValue(spec: SoundNumberSpec, current: number, direction: 1 | -1, shift: boolean): number | null {
  const next = snapValue(spec, current + direction * spec.step * (shift ? 10 : 1))
  return next === current ? null : next
}

/** Every field a sound resolves to, as the engine resolves it (entitySoundVoices, soundControlsHTML). */
export interface ResolvedSound {enabled: boolean; followCymatic: boolean; frequencyHz: number; gain: number; waveform: EntitySoundWaveform; attack: number; release: number; pan: number}
export function resolvedSound(sound: EntitySound | undefined): ResolvedSound {
  const d = DEFAULT_ENTITY_SOUND
  return {
    enabled: sound?.enabled ?? false,
    followCymatic: sound?.followCymatic ?? (sound?.frequencyHz === undefined),
    frequencyHz: sound?.frequencyHz ?? d.frequencyHz, gain: sound?.gain ?? d.gain, waveform: sound?.waveform ?? d.waveform,
    attack: sound?.attack ?? d.attack, release: sound?.release ?? d.release, pan: sound?.pan ?? d.pan,
  }
}

/** The sound Add sound sends: the app's defaults with the object sounding (DEFAULT_ENTITY_SOUND, enabled). */
export const addedSound = (): EntitySound => validateEntitySound({...DEFAULT_ENTITY_SOUND, enabled: true}) as EntitySound

/** The next WHOLE sound with one field set. Frequency clears follow and Follow restores a pitch (the boundary's coupling helpers). Throws on a refused value. */
export function soundWithField(base: EntitySound | undefined, field: SoundField, value: boolean | string | number): EntitySound {
  if (field === 'frequencyHz') return soundWithFrequency(base, Number(value))
  if (field === 'followCymatic') return soundWithFollow(base, value as boolean)
  return validateEntitySound({...(base ?? {enabled: false}), [field]: value}) as EntitySound
}

/** The one admitted change for a gesture: the whole sound, or null to remove it. The boundary validator is the gate. */
export function soundChange(entityId: string, sound: EntitySound | null): NativeEntitySoundChange {
  return validateNativeEntitySoundChange({kind: 'entity-sound', entity_id: entityId, sound})
}

/** The owner's refusal text from a reply the editor returned, or null when the reply is not a refusal. */
export function replyRefusal(reply: unknown): string | null {
  if (!reply || typeof reply !== 'object' || (reply as {ok?: unknown}).ok !== false) return null
  const error = (reply as {error?: unknown}).error
  return typeof error === 'string' && error ? error : 'The owner refused this sound change.'
}

/** The lock law: a locked object refuses its device edits (nativeDeviceEdits.ts). The note states it before any send. */
export const LOCKED_NOTE = 'This object is locked. Unlock this entity to change its sound.'

const num = (value: number) => String(Number(value.toFixed(4)))
/** The rack summary and the panel heading line, from the object's own sound. */
export function soundSummaryText(sound: EntitySound | undefined): string {
  if (!sound) return 'No sound'
  const s = resolvedSound(sound)
  const pitch = s.followCymatic ? 'cymatic pitch' : `${num(s.frequencyHz)} Hz`
  return `${s.enabled ? '' : 'off · '}${pitch} · ${s.waveform} · gain ${num(s.gain)}`
}
export const soundSummary = (entity: Entity): string => soundSummaryText(entity.sound)

/** The envelope's shared time axis: 0 to 40 seconds. The sustain is drawn as a break at 10 s (the attack maximum) because its length is set by the object's presence, not by a parameter. */
export const ENVELOPE = {x0: 30, span: 300, seconds: 40, breakSeconds: 10, baseY: 110, topY: 18} as const
export const timeToX = (seconds: number) => ENVELOPE.x0 + seconds / ENVELOPE.seconds * ENVELOPE.span
export const xToTime = (x: number) => (x - ENVELOPE.x0) / ENVELOPE.span * ENVELOPE.seconds
export const gainToY = (gain: number) => ENVELOPE.baseY - gain * (ENVELOPE.baseY - ENVELOPE.topY)
export const yToGain = (y: number) => (ENVELOPE.baseY - y) / (ENVELOPE.baseY - ENVELOPE.topY)

/** The value an envelope handle takes at a point in viewBox space (the drag mapping). Clamped and snapped to the field. */
export function envelopeValueAt(field: EnvelopeField, x: number, y: number): number {
  if (field === 'attack') return snapValue(soundNumberSpec('attack'), xToTime(x))
  if (field === 'release') return snapValue(soundNumberSpec('release'), xToTime(x) - ENVELOPE.breakSeconds)
  return snapValue(soundNumberSpec('gain'), yToGain(y))
}

/** Geometry of the envelope from the sound's own attack, release and gain (the drawn values). */
export function envelopeGeometry(s: Pick<ResolvedSound, 'attack' | 'release' | 'gain'>) {
  const attackX = timeToX(s.attack), breakX = timeToX(ENVELOPE.breakSeconds), releaseX = timeToX(ENVELOPE.breakSeconds + s.release)
  const gainY = gainToY(s.gain), baseY = ENVELOPE.baseY
  const path = `M${ENVELOPE.x0} ${baseY} L${attackX.toFixed(2)} ${gainY.toFixed(2)} L${breakX.toFixed(2)} ${gainY.toFixed(2)} L${releaseX.toFixed(2)} ${baseY}`
  return {
    path, attackX, releaseX, gainY, baseY,
    handles: {
      attack: {x: attackX, y: baseY},
      release: {x: releaseX, y: baseY},
      gain: {x: (attackX + breakX) / 2, y: gainY},
    },
  }
}

/** Two periods of the waveform shape, scaled to gain, centred on `centreY` (not to time scale; pitch is not drawn). */
export function waveformPath(waveform: EntitySoundWaveform, gain: number, box: {x0: number; width: number; centreY: number; halfHeight: number}, periods = 2, samples = 64): string {
  const shape = (phase: number): number => {
    if (waveform === 'triangle') return 1 - 4 * Math.abs(phase - 0.5)
    if (waveform === 'square') return phase < 0.5 ? 1 : -1
    if (waveform === 'sawtooth') return 2 * phase - 1
    return Math.sin(2 * Math.PI * phase)
  }
  const points: string[] = []
  for (let index = 0; index <= samples; index++) {
    const cycles = index / samples * periods
    const x = box.x0 + index / samples * box.width
    const y = box.centreY - shape(cycles - Math.floor(cycles)) * gain * box.halfHeight
    points.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return points.join(' ')
}

/** Pan position on a bar from -1 (left edge) to 1 (right edge). */
export const panX = (pan: number, x0: number, width: number) => x0 + (pan + 1) / 2 * width

/** The Sound device's model. Paths are empty: the sound fields are not registry parameters (entityTargets has no sound rows), so the shared body renders no exact-value grid; the view draws every control itself. */
export const soundFaceModel: EntityFaceModel = {
  name: 'Sound',
  paths: [],
  // Registry compact is empty: sound fields are not entityTargets rows. The rack's whole-sound controls are declared here instead.
  compactEntity: [{kind: 'entity-sound', field: 'gain'}, {kind: 'entity-sound', field: 'frequencyHz'}, {kind: 'entity-sound', field: 'waveform'}],
  studio: 'formations',
  enabled: (_reading: NativeEditorReading, entity: Entity) => entity.sound?.enabled,
  strip: {summary: (_reading: NativeEditorReading, entity: Entity) => soundSummary(entity), toggle: null},
}
