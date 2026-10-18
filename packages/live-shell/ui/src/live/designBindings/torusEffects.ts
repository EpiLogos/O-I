// The torus's four effects (manual §21.5: Filter, Dynamics, Delay, Reverb) as devices of Live's chain after the torus, drawn on their
// owner. The owner is the native field's presentation stage in the hosted Expressions frame (desktop/cradle/expressions-app/
// field-studies-journeys/src/native-field/presentationEffects.ts, after the level, before the device): the hosted reading carries its
// state (`parameters.effects`, expressions-boundary protocol.ts readHostedParameters) and the stage channel's `effect` instrument edit
// changes it (stageCommands.ts InstrumentEdit), refused in the owner's words outside its law (native-field/effectsLaw.ts).
// Each catalogue design (inhabitants/catalogue/panels/live__<effect>.tsx, `live:<effect>`) keys its values on the effect's own
// parameters, with `light` ('lit' or 'dark') for its switch; the Delay's `tempo` is the tempo the owner's delay syncs to, kept on the
// set's tempo (followSetTempo). The owner's chain names which effects stand after the torus and in what order (manual §21.5: "Put any
// of them on the chain, in any order. The sound passes through them from left to right"): placing, taking off and moving are the
// stage channel's `effect-chain` edit. Owners write, faces read (lock §0.4): a value stands only where the owner reports one; `reason`
// names an absence in the well.
import {EFFECT_LAW, EFFECT_TITLES, effectChainRefusal, effectRefusal, type PresentationEffect} from '@epilogos/expressions-boundary'
import type {DeviceDeclaration, SdkParamRow} from '../../inhabitants/sdk/define'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import type {DesignBinding, Standing, Value, ValueChange} from '../../frame/devices/designed'
import {commitLiveInstrumentEdit, LIVE_TORUS_ABSENT_REASON, type LiveTorusState} from '../torusInstrument'
import {QL_WRITE_PATH} from '../../inhabitants/ql/devices/qlDevices'

/** The four, in the order they stand after the torus and sound (presentationEffects.ts). */
export const TORUS_EFFECTS = ['filter', 'dynamics', 'delay', 'reverb'] as const satisfies readonly PresentationEffect[]
export type TorusEffect = (typeof TORUS_EFFECTS)[number]

/** The device's id on the chain. */
export const torusEffectId = (effect: TorusEffect): string => `live:torus-${effect}`
/** The design's family and face: designKey('live', effect) is `live:<effect>`, the design's id. */
export const TORUS_EFFECT_FAMILY = 'live'

const NOTES: Readonly<Record<TorusEffect, string>> = {
  filter: 'Cuts or lifts a range of the torus\'s frequencies.',
  dynamics: 'Lowers the torus\'s loud parts and lifts the whole by makeup.',
  delay: 'Repeats the torus\'s sound after a time.',
  reverb: 'Gives the torus a room.',
}

export function torusEffectFace(effect: TorusEffect): DeviceDeclaration {
  return {id: effect, title: EFFECT_TITLES[effect], icon: 'live', liveSemantic: 'device-audio-fx',
    invariant: {transforms: 'the torus\'s sound after its level, before the device'}, note: NOTES[effect]} as DeviceDeclaration
}

/** What the effects' owner reports, or why it reports nothing. */
function ownerOf(state: LiveTorusState | null): {effects: NonNullable<Extract<LiveTorusState, {ok: true}>['parameters']['effects']>} | {reason: string} {
  if (state === null) return {reason: LIVE_TORUS_ABSENT_REASON}
  if (!state.ok) return {reason: `Refused reading: ${state.fault}`}
  const effects = state.parameters?.effects
  return effects ? {effects} : {reason: 'This frame announces no effects: its native field keeps none.'}
}

const DYNAMICS_REDUCTION = 'The owner announces no gain reduction: the hosted reading carries the settings, not a meter.'

/** The design's values: the effect's parameters as the owner keeps them, its switch as `light`. Only what the owner reports. */
export function torusEffectValues(effect: TorusEffect, state: LiveTorusState | null): Record<string, Value> {
  const owner = ownerOf(state)
  if ('reason' in owner) return {reason: owner.reason}
  const params = owner.effects[effect], values: Record<string, Value> = {}
  for (const [key, value] of Object.entries(params ?? {})) {
    if (key === 'on') values.light = value === true ? 'lit' : 'dark'
    else values[key] = value
  }
  return values
}

/** Why the owner does not take a change of this key now, or null when it does. */
function writeStanding(effect: TorusEffect, state: LiveTorusState | null, key: string): string | null {
  if (effect === 'dynamics' && key === 'reduction') return DYNAMICS_REDUCTION
  if (key !== 'light' && (key === 'on' || !(key in EFFECT_LAW[effect]))) return `${EFFECT_TITLES[effect]} has no parameter ${key}.`
  const owner = ownerOf(state)
  return 'reason' in owner ? owner.reason : null
}

/** The owner's edit for one design change: `light` is the switch; every other key is the parameter itself. Throws the owner's
 * refusal in its words before anything is sent. */
export function torusEffectEdit(effect: TorusEffect, change: ValueChange): {kind: 'effect'; effect: TorusEffect; key: string; value: number | boolean | string} {
  const key = change.key === 'light' ? 'on' : change.key
  const value = change.key === 'light' ? change.value === 'lit' || change.value === true : change.value
  const refusal = effect === 'dynamics' && key === 'reduction' ? DYNAMICS_REDUCTION : effectRefusal(effect, key, value)
  if (refusal) throw new Error(refusal)
  return {kind: 'effect', effect, key, value: value as number | boolean | string}
}

async function send(effect: TorusEffect, changes: readonly ValueChange[]): Promise<void> {
  // Every change is checked before the first is sent: a refused set changes nothing.
  const edits = changes.map(change => torusEffectEdit(effect, change))
  for (const edit of edits) {
    const result = await commitLiveInstrumentEdit(edit)
    if (!result.ok) throw new Error(result.error)
  }
}

/** The binding the runtime hosts the effect's design on: the owner's state, the stage channel for its edits, and every key the owner
 * does not take now disabled with the reason. */
export function torusEffectBinding(effect: TorusEffect, state: LiveTorusState | null, held: Readonly<Record<string, string>> = {}): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const key of ['light', ...Object.keys(EFFECT_LAW[effect]).filter(key => key !== 'on'), ...(effect === 'dynamics' ? ['reduction'] : [])]) {
    const why = writeStanding(effect, state, key)
    if (why) standing[key] = {disabled: why}
  }
  const writable = !('reason' in ownerOf(state))
  return {
    id: torusEffectId(effect),
    values: torusEffectValues(effect, state),
    writes: key => writeStanding(effect, state, key) === null,
    standing,
    ...(writable ? {write: (changes: readonly ValueChange[]) => send(effect, changes)} : {}),
    // A key a planet moves (Sky modulation, skyModulation.ts skyHeldKeys): the status bar names the planet.
    ...(Object.keys(held).length ? {modulatedBy: held} : {}),
  }
}

/** The effect as a device of the runtime: a row for its switch and each parameter, by the owner's law, over the owner's state. */
export function torusEffectDevice(effect: TorusEffect, state: LiveTorusState | null): DeviceInstance {
  const id = torusEffectId(effect), owner = ownerOf(state), writable = !('reason' in owner)
  const rows: SdkParamRow[] = Object.entries(EFFECT_LAW[effect]).map(([key, law]) => ({
    family: TORUS_EFFECT_FAMILY, deviceInstance: id, key, title: key === 'on' ? 'On' : key[0]!.toUpperCase() + key.slice(1),
    type: law.kind === 'number' ? 'number' : law.kind === 'switch' ? 'boolean' : 'enumerated',
    ...(law.kind === 'number' ? {range: {min: law.min, max: law.max, unit: law.unit}} : law.kind === 'choice' ? {values: [...law.choices]} : {}),
    ...(writable ? {writePath: QL_WRITE_PATH} : {disclosure: (owner as {reason: string}).reason}),
  }) as SdkParamRow)
  const values: Record<string, ParamValue> = {}
  if (!('reason' in owner)) for (const [key, value] of Object.entries(owner.effects[effect] ?? {})) values[key] = value
  return {
    id, family: TORUS_EFFECT_FAMILY, face: torusEffectFace(effect), rows, values, enabledKey: writable ? 'on' : undefined,
    ...(writable ? {submit: (changes: readonly {key: string; value: ParamValue}[]) => send(effect, changes.map(change => ({key: change.key, value: change.value as Value})))} : {}),
  }
}

// ── the chain ────────────────────────────────────────────────────────────────

/** The effects standing after the torus, in the order they sound; null while the owner reports none. */
export function torusEffectsChain(state: LiveTorusState | null): readonly TorusEffect[] | null {
  const owner = ownerOf(state)
  return 'reason' in owner ? null : owner.effects.chain as readonly TorusEffect[]
}

async function sendChain(chain: readonly TorusEffect[]): Promise<void> {
  const refusal = effectChainRefusal(chain)
  if (refusal) throw new Error(refusal)
  const result = await commitLiveInstrumentEdit({kind: 'effect-chain', chain: [...chain]})
  if (!result.ok) throw new Error(result.error)
}

const chainOrRefuse = (state: LiveTorusState | null): readonly TorusEffect[] => {
  const chain = torusEffectsChain(state), owner = ownerOf(state)
  if (chain === null) throw new Error('reason' in owner ? owner.reason : 'No owner reading.')
  return chain
}

/** Put an effect on the chain at a place (the end when none is given); one already on it moves there. */
export async function placeTorusEffect(state: LiveTorusState | null, effect: TorusEffect, at?: number): Promise<void> {
  const rest = chainOrRefuse(state).filter(item => item !== effect)
  const place = at === undefined ? rest.length : Math.max(0, Math.min(rest.length, at))
  return sendChain([...rest.slice(0, place), effect, ...rest.slice(place)])
}

/** Take an effect off the chain; it keeps its settings for when it returns. */
export async function removeTorusEffect(state: LiveTorusState | null, effect: TorusEffect): Promise<void> {
  return sendChain(chainOrRefuse(state).filter(item => item !== effect))
}

/** Move an effect one place earlier (-1) or later (1) in the chain. */
export async function moveTorusEffect(state: LiveTorusState | null, effect: TorusEffect, by: -1 | 1): Promise<void> {
  const chain = chainOrRefuse(state), from = chain.indexOf(effect)
  if (from < 0) throw new Error(`${EFFECT_TITLES[effect]} is not on the chain.`)
  return placeTorusEffect(state, effect, from + by)
}

/** The Delay's tempo kept on the set's: the edit that brings the owner's delay to the set's tempo, or null when it already is, when the
 * set states no tempo, or when the owner reports no effects. The set's tempo is a reading (TransportBar's tempo); the owner's law
 * bounds it (40–300 BPM). */
export function setTempoEdit(state: LiveTorusState | null, tempoBpm: number | null): {kind: 'effect'; effect: 'delay'; key: 'tempo'; value: number} | null {
  const owner = ownerOf(state)
  if ('reason' in owner || tempoBpm === null || !Number.isFinite(tempoBpm)) return null
  const value = Math.round(tempoBpm * 100) / 100
  if (owner.effects.delay?.tempo === value || effectRefusal('delay', 'tempo', value)) return null
  return {kind: 'effect', effect: 'delay', key: 'tempo', value}
}

/** Bring the owner's delay to the set's tempo, when it is not already there. */
export async function followSetTempo(state: LiveTorusState | null, tempoBpm: number | null): Promise<void> {
  const edit = setTempoEdit(state, tempoBpm)
  if (!edit) return
  const result = await commitLiveInstrumentEdit(edit)
  if (!result.ok) throw new Error(result.error)
}
