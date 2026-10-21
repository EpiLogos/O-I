// The Resonator bank on its owners (DLW §22.7; the catalogue's design inhabitants/catalogue/panels/quaternal-logic__resonator-bank.tsx,
// `quaternal-logic:resonator-bank`). The bank gives the cut the M3 clock draws a sound: one tuned body rings at each part of the octave's
// cut, at the root of the mode in force. Owners write, faces read (lock §0.4); three owners stand behind it, and there is one cut, not two:
//   aperture.index        the CLOCK's cut (qlM3Clock.ts: the person's M3 form through m3_reception). A change is its `set-aperture`; Swap,
//                         the matching cut, is its `reciprocal-aperture`; the answer is the form after them. The bank holds no cut of its own.
//   mode.root, root.hz    the MODE IN FORCE's root (native/liveModeCatalogue.ts: the transport's Root, which Scale mapping reads), a reading
//                         here; its frequency in the lowest octave of the span is the stage's law (effectsLaw.ts resonatorRootHz).
//   bank.on, .decay, .tilt, .span, .mix, .gain
//                         the STAGE's `resonator` effect (the hosted frame's presentation stage, native-field/presentationEffects.ts), which
//                         the hosted reading carries (`parameters.effects.resonator`) and the stage channel's `effect` instrument edit
//                         changes (stageCommands.ts), refused in the owner's words outside its law (effectsLaw.ts).
// The stage rings what it is told: the shell tells it the clock's `division_deg10` and the mode's root whenever they differ from what it
// rings (qlBankFollow; the Delay keeps to the set's tempo the same way, torusEffects.ts followSetTempo). So the sound is the clock's cut and the
// mode's root, and the stage's own settings are the stage's. With the clock unread the cut is absent here and the well says the clock is not
// read; the stage keeps ringing the cut it last held (or the manual's opening one), and says so. With the mode unread the root is absent.
// The bank is an effect: it stands on Live's chain after the torus (live/designBindings/TorusEffectsOnChain.tsx), not in Technē's rack.
import {useEffect, useMemo} from 'react'
import {EFFECT_LAW, EFFECT_TITLES, effectRefusal, resonatorRootHz, type InstrumentEdit} from '@epilogos/expressions-boundary'
import type {DeviceDeclaration, SdkParamRow} from '../../sdk/define'
import type {DeviceInstance, ParamValue} from '../../../frame/devices/deviceRuntime'
import type {DesignBinding, Standing, Value, ValueChange} from '../../../frame/devices/designed'
import {commitLiveInstrumentEdit, type LiveTorusState} from '../../../live/torusInstrument'
import {ownerOf as effectsOwnerOf} from '../../../live/designBindings/torusEffects'
import {setModeInForce, useLiveModeInForce, type LiveModeCatalogueState, type LiveModeHold} from '../../../native/liveModeCatalogue'
import type {M3Operation} from '../../../../../../../desktop/cradle/src/nara/nativeM3'
import {applyQlM3, useQlM3, NO_FORM, type QlM3State} from './qlM3Clock'
import {QL_WRITE_PATH} from './qlDevices'

export const QL_RESONATOR_FAMILY = 'quaternal-logic'
export const QL_RESONATOR_FACE = 'resonator-bank'
/** The effect's name on the stage's chain (effectsLaw.ts PRESENTATION_EFFECTS). */
export const QL_RESONATOR_EFFECT = 'resonator'
/** The device's id on Live's chain after the torus, beside `live:torus-<effect>`. Its design is `quaternal-logic:resonator-bank`. */
export const QL_RESONATOR_CHAIN_ID = `${QL_RESONATOR_FAMILY}:torus-${QL_RESONATOR_FACE}`
/** The path the clock's operations are written on (qlM3Clock.ts qlM3Device). */
const M3_WRITE_PATH = 'shell.m3Reception'

/** The stage's parameters by the design's value keys. */
const KEY_OF_PARAM: Readonly<Record<string, string>> = {on: 'bank.on', decay: 'bank.decay', tilt: 'bank.tilt', span: 'bank.span', mix: 'bank.mix', gain: 'bank.gain'}
const PARAM_OF_KEY: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(KEY_OF_PARAM).map(([param, key]) => [key, param]))
/** The stage's own keys: what the stage reports and takes. */
const STAGE_KEYS = Object.values(KEY_OF_PARAM)

const ROOT_READING = 'A reading: the root of the mode in force. The transport\'s Root sets it (Scale mapping reads the same mode); the bank tunes to it.'
const int = (x: unknown): x is number => Number.isSafeInteger(x)

/** A cut as the design words it: its size in degrees and the parts it makes (`division` is tenths of a degree). */
export const cutWord = (division: number): string => `${division / 10}°×${3600 / division}`

// ── the mode in force's root ────────────────────────────────────────────────

/** The root the bank tunes to: the mode in force's, or why there is none. */
export interface BankMode {readonly root: number | null; readonly reason: string | null}

/** The mode in force's root, as Scale mapping reads it (live/designBindings/scaleMappingBinding.ts scaleMappingValues): the catalogued mode's
 * root once the owner's catalogue is read, the transport's held root before a scale is chosen. Unread, there is none. */
export function bankMode(reading: LiveModeCatalogueState, hold: LiveModeHold): BankMode {
  if (reading.state !== 'ready') {
    return {root: null, reason: reading.state === 'refused' ? `The mode catalogue is refused: ${reading.reason}` : 'The mode catalogue is still being read from the owner.'}
  }
  const mode = setModeInForce(reading, hold).mode
  return {root: mode.state === 'in-force' ? mode.selection.root : hold.root, reason: null}
}

// ── the readings ────────────────────────────────────────────────────────────

const clockLive = (clock: QlM3State): boolean => clock.reading?.status === 'available' && !!clock.reading.state
const clockWhy = (clock: QlM3State): string => clock.busy ? 'Reading the M3 form…' : clock.reason ?? NO_FORM

/** The stage's bank as the hosted reading carries it, or why it reports none. */
function stageOf(state: LiveTorusState | null): {stage: Readonly<Record<string, string | number | boolean>>} | {reason: string} {
  const owner = effectsOwnerOf(state)
  if ('reason' in owner) return owner
  const stage = owner.effects[QL_RESONATOR_EFFECT]
  return stage ? {stage} : {reason: 'This frame announces no Resonator bank: its native field keeps none.'}
}

/** What the stage rings, said for the well: the cut it last held. */
function ringingNote(owner: ReturnType<typeof stageOf>): string {
  if ('reason' in owner) return ''
  const division = owner.stage.division
  return int(division) && division > 0 ? ` The bank rings the cut it last held: ${cutWord(division)}.` : ''
}

/** The design's values: the stage's own settings, the clock's cut, the mode's root and its frequency. Only what an owner reports; what is
 * absent is named in `reason`, the well's line. */
export function qlBankValues(state: LiveTorusState | null, clock: QlM3State, mode: BankMode): Record<string, Value> {
  const values: Record<string, Value> = {}, reasons: string[] = []
  const owner = stageOf(state)
  if ('reason' in owner) reasons.push(owner.reason)
  else for (const [param, key] of Object.entries(KEY_OF_PARAM)) if (owner.stage[param] !== undefined) values[key] = owner.stage[param]!
  const form = clockLive(clock) ? clock.reading!.state : null
  if (form && int(form.aperture?.index)) values['aperture.index'] = form.aperture.index
  else reasons.push(`The M3 clock is not read: ${clockWhy(clock)}${ringingNote(owner)}`)
  if (mode.root !== null) {
    values['mode.root'] = mode.root
    values['root.hz'] = resonatorRootHz(mode.root)
  } else reasons.push(mode.reason ?? 'The mode in force is not read.')
  if (reasons.length) values.reason = reasons.join(' ')
  return values
}

// ── the writes ──────────────────────────────────────────────────────────────

/** The clock's operations for the cut the design asks for: the cut it holds is no change, the matching cut it names is `reciprocal-aperture`
 * (Swap), any other is `set-aperture`. Throws in the clock's words when it is not read or does not have the cut. */
export function qlBankCutOperations(clock: QlM3State, index: Value | undefined): M3Operation[] {
  const form = clockLive(clock) ? clock.reading!.state! : null
  if (!form) throw new Error(`The M3 clock is not read: ${clockWhy(clock)}`)
  const total = form.aperture.total_lenses
  if (!int(index) || index < 0 || (int(total) && index >= total)) throw new Error(`The cut is one of the owner's ${int(total) ? total : 16} apertures.`)
  if (index === form.aperture.index) return []
  if (index === form.aperture.reciprocal_index) return [{operation: 'reciprocal-aperture'}]
  return [{operation: 'set-aperture', aperture: index}]
}

/** The stage's edit for one design change, or the words that refuse it. */
function stageEdit(state: LiveTorusState | null, change: ValueChange): InstrumentEdit {
  if (change.key === 'mode.root' || change.key === 'root.hz') throw new Error(ROOT_READING)
  const param = PARAM_OF_KEY[change.key]
  if (!param) throw new Error(`${change.key}: no setting of the ${EFFECT_TITLES[QL_RESONATOR_EFFECT]}.`)
  const owner = stageOf(state)
  if ('reason' in owner) throw new Error(owner.reason)
  const refusal = effectRefusal(QL_RESONATOR_EFFECT, param, change.value)
  if (refusal) throw new Error(refusal)
  return {kind: 'effect', effect: QL_RESONATOR_EFFECT, key: param, value: change.value as number | boolean | string}
}

/** Send the design's changes to their owners: the cut to the clock, the rest to the stage. Every change is checked before the first is sent,
 * so a refused set changes nothing. */
async function writeBank(state: LiveTorusState | null, clock: QlM3State, changes: readonly ValueChange[]): Promise<void> {
  const cut = changes.find(change => change.key === 'aperture.index')
  const operations = cut ? qlBankCutOperations(clock, cut.value) : []
  const edits = changes.filter(change => change.key !== 'aperture.index').map(change => stageEdit(state, change))
  if (operations.length) await applyQlM3(operations)
  for (const edit of edits) {
    const result = await commitLiveInstrumentEdit(edit)
    if (!result.ok) throw new Error(result.error)
  }
}

/** Why the owners do not take a change of this key now, or null when they do. */
function writeStanding(state: LiveTorusState | null, clock: QlM3State, key: string): string | null {
  if (key === 'aperture.index') return clockLive(clock) ? null : `The M3 clock is not read: ${clockWhy(clock)}${ringingNote(stageOf(state))}`
  if (key === 'mode.root' || key === 'root.hz') return ROOT_READING
  if (STAGE_KEYS.includes(key)) { const owner = stageOf(state); return 'reason' in owner ? owner.reason : null }
  return `${key}: no setting of the ${EFFECT_TITLES[QL_RESONATOR_EFFECT]}.`
}

/** The design keys a planet moves, from the keys of the stage's parameters the Sky modulator holds (skyModulation.ts skyHeldKeys). */
const heldByDesignKey = (held: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(held).flatMap(([param, planet]) => KEY_OF_PARAM[param] ? [[KEY_OF_PARAM[param]!, planet]] : []))

/** The binding the runtime hosts the design on: the three owners' readings, the clock's two operations and the stage's effect edits for
 * their writes, and every key they do not take disabled with the reason. */
export function qlBankBinding(id: string, state: LiveTorusState | null, clock: QlM3State, mode: BankMode, held: Readonly<Record<string, string>> = {}): DesignBinding {
  const standing: Record<string, Standing> = {}
  for (const key of [...STAGE_KEYS, 'aperture.index', 'mode.root', 'root.hz']) {
    const why = writeStanding(state, clock, key)
    if (why) standing[key] = {disabled: why}
  }
  const modulated = heldByDesignKey(held)
  const writable = !('reason' in stageOf(state))
  return {
    id,
    values: qlBankValues(state, clock, mode),
    writes: key => writeStanding(state, clock, key) === null,
    standing,
    ...(writable ? {enabledKey: 'bank.on'} : {}),
    ...(writable || clockLive(clock) ? {write: (changes: readonly ValueChange[]) => writeBank(state, clock, changes)} : {}),
    ...(Object.keys(modulated).length ? {modulatedBy: modulated} : {}),
  }
}

// ── the device, for the generic plate that stands in for a view ─────────────

const BANK_TRANSFORMS = 'the torus\'s sound after its level: one tuned body rings at each part of the M3 clock\'s cut'
const BANK_NOTE = 'Rings the cut the M3 clock draws (manual §22.7). The cut is the clock\'s (set-aperture, reciprocal-aperture through m3_reception), the root the mode in force\'s, '
  + 'and the rest the stage\'s own Resonator bank effect after the torus.'

/** The device\'s declaration for the runtime (its manifest entry is the family\'s). */
export function qlBankFace(): DeviceDeclaration {
  return {id: QL_RESONATOR_FACE, title: EFFECT_TITLES[QL_RESONATOR_EFFECT], icon: 'metro', liveSemantic: 'device-audio-fx', invariant: {transforms: BANK_TRANSFORMS}, note: BANK_NOTE}
}

/** The bank as a device of the runtime: a row for each setting and reading, over the owners. */
export function qlBankDevice(id: string, state: LiveTorusState | null, clock: QlM3State, mode: BankMode): DeviceInstance {
  const owner = stageOf(state), writable = !('reason' in owner), cutWritable = clockLive(clock)
  const row = (key: string, title: string, type: string, rest: Partial<SdkParamRow> = {}): SdkParamRow =>
    ({family: QL_RESONATOR_FAMILY, deviceInstance: id, key, title, type, ...rest}) as SdkParamRow
  const stage = writable ? {writePath: QL_WRITE_PATH} : {disclosure: (owner as {reason: string}).reason}
  const law = EFFECT_LAW[QL_RESONATOR_EFFECT]
  const range = (param: keyof typeof law) => { const l = law[param]!; return l.kind === 'number' ? {min: l.min, max: l.max, unit: l.unit} : undefined }
  const rows: SdkParamRow[] = [
    row('bank.on', 'On', 'boolean', {group: 'Bank', ...stage}),
    row('aperture.index', 'Aperture', 'number', {group: 'Cut', compact: true, range: {min: 0, max: 15}, ...(cutWritable ? {writePath: M3_WRITE_PATH} : {disclosure: writeStanding(state, clock, 'aperture.index')!})}),
    row('bank.decay', 'Decay', 'number', {group: 'Ring', compact: true, range: range('decay'), ...stage}),
    row('bank.tilt', 'Tilt', 'number', {group: 'Ring', range: range('tilt'), ...stage}),
    row('bank.span', 'Span', 'number', {group: 'Ring', range: range('span'), ...stage}),
    row('bank.mix', 'Mix', 'number', {group: 'Output', compact: true, range: range('mix'), ...stage}),
    row('bank.gain', 'Gain', 'number', {group: 'Output', range: range('gain'), ...stage}),
    row('mode.root', 'Root', 'number', {group: 'Reading', range: {min: 0, max: 11}}),
    row('root.hz', 'Lowest', 'number', {group: 'Reading', range: {min: 0, max: 5000, unit: 'Hz'}}),
  ]
  const values: Record<string, ParamValue> = {}
  for (const [key, value] of Object.entries(qlBankValues(state, clock, mode))) if (rows.some(r => r.key === key)) values[key] = value as ParamValue
  return {
    id, family: QL_RESONATOR_FAMILY, face: qlBankFace(), rows, values, enabledKey: writable ? 'bank.on' : undefined,
    ...(writable || cutWritable ? {submit: (changes: readonly {key: string; value: ParamValue}[]) => writeBank(state, clock, changes.map(change => ({key: change.key, value: change.value as Value})))} : {}),
  }
}

// ── the stage is told the cut and the root ──────────────────────────────────

/** The edits that bring the stage to the clock's division and the mode's root: none for a cut the clock does not state (unread: the stage
 * keeps the cut it last held), none for a root the mode does not state, none for what the stage already rings. */
export function qlBankFollow(state: LiveTorusState | null, clock: QlM3State, mode: BankMode): InstrumentEdit[] {
  const owner = stageOf(state)
  if ('reason' in owner) return []
  const edits: InstrumentEdit[] = []
  const division = clockLive(clock) ? clock.reading!.state!.aperture?.division_deg10 : undefined
  if (int(division) && division !== owner.stage.division && effectRefusal(QL_RESONATOR_EFFECT, 'division', division) === null) {
    edits.push({kind: 'effect', effect: QL_RESONATOR_EFFECT, key: 'division', value: division})
  }
  if (mode.root !== null && mode.root !== owner.stage.root && effectRefusal(QL_RESONATOR_EFFECT, 'root', mode.root) === null) {
    edits.push({kind: 'effect', effect: QL_RESONATOR_EFFECT, key: 'root', value: mode.root})
  }
  return edits
}

/** The clock and the mode in force for the bank, as every surface shares them. */
export function useQlBankReadings(): {readonly clock: QlM3State; readonly mode: BankMode} {
  const clock = useQlM3()
  const {reading, hold} = useLiveModeInForce()
  const mode = useMemo(() => bankMode(reading, hold), [reading, hold])
  return {clock, mode}
}

/** While `enabled` (the bank stands on a chain), tell the stage the clock's cut and the mode's root whenever they change; a refusal is handed on. */
export function useQlBankFollow(state: LiveTorusState | null, enabled: boolean, refused: (error: unknown) => void): void {
  const {clock, mode} = useQlBankReadings()
  useEffect(() => {
    if (!enabled) return
    for (const edit of qlBankFollow(state, clock, mode)) {
      commitLiveInstrumentEdit(edit).then(result => { if (!result.ok) refused(new Error(result.error)) }, refused)
    }
  }, [state, clock, mode, enabled])
}
