// The Quaternal Logic family's faces as devices of the runtime (T-DEVICES-TECHNE). The field/PCM owner (`ql-instrument`) is the one
// admitted face: it reads the owner's reading — the one reader every shell presentation of the instrument shares
// (live/torusInstrument.ts) — and writes the owner's presentation parameters through the hosted stage channel, the same channel and
// the same edits the Live torus uses (live/torusDevice.ts, live/LiveInstrumentSection.tsx:76-102; stage commands in
// desktop/cradle/expressions-app/field-studies-journeys/src/stageCommands.ts:56-68). The family declares no rows for the face, so the
// rows are the owner's own parameters. Hold and recover are session operations the stage channel does not carry: they are not
// offered, and the face's body never draws them.
//
// The other six faces (sky, torus, m3-clock, deck, chakra, m-prime-matrices) are declared waiting: their owners have not landed
// (inhabitants/quaternalLogicFamilyManifest.ts:42-88). Each is a device that says so — dark, no control, its note as the reason.
import type {SdkParamRow} from '../../sdk/define'
import type {InhabitantFaceDeclaration} from '../../manifest'
import type {DeviceInstance, ParamValue} from '../../../frame/devices/deviceRuntime'
import type {InstrumentEdit} from '@epilogos/expressions-boundary'
import {commitLiveInstrumentEdit, liveInstrumentWritable, LIVE_CADENCE_OPTIONS, type LiveTorusState} from '../../../live/torusInstrument'
import {techneFaceDeclaration, techneDeviceId} from './faces'

export const QL_FAMILY = 'quaternal-logic'
export const QL_INSTRUMENT_FACE = 'ql-instrument'

/** The path the owner writes: the hosted stage channel's `instrument` command (live/torusDevice.ts:17). */
export const QL_WRITE_PATH = 'stage:instrument'

const ABSENT_OWNER = 'No owner reading stands in this host.'
const NOT_WRITABLE = 'The owner takes edits only while the instrument follows or is held.'
const NO_SCENE = 'No scene is open, so there is no cadence to set.'
const NO_SCALE = 'The owner states no scale.'

const row = (face: string, key: string, title: string, type: string, rest: Partial<SdkParamRow> = {}): SdkParamRow =>
  ({family: QL_FAMILY, deviceInstance: face, key, title, type, ...rest}) as SdkParamRow

/** The cadence's choices, named as the Studio names them (live/torusInstrument.ts:132-134). */
const CADENCE_NAMES = LIVE_CADENCE_OPTIONS.map(option => option.label)

/** The owner edit a drawn change names. */
export function qlInstrumentEdit(key: string, value: ParamValue): InstrumentEdit {
  switch (key) {
    case 'sound': return {kind: 'muted', muted: value !== true}
    case 'level': return {kind: 'level', value: Number(value)}
    case 'scale': return {kind: 'scale', units_per_metre: Number(value)}
    case 'cadence': {
      const at = CADENCE_NAMES.indexOf(String(value))
      const option = LIVE_CADENCE_OPTIONS[at]
      if (!option) throw Error(`cadence: ${String(value)} is not one of the owner's choices`)
      return {kind: 'cadence', rate: option.value === 'hold' ? 'hold' : (Number(option.value) as 1 | 12)}
    }
    default: throw Error(`${key}: not a parameter the owner takes through the stage channel`)
  }
}

/** The owner's presentation parameters — sound, level, cadence, scale — as rows of one device and their readings: the controls the
 * native field panel reads and writes (live/LiveInstrumentSection.tsx:74-105, "Play" and "See and hear"), each written through the
 * stage channel (qlInstrumentEdit). The QL field/PCM face and the Live torus both carry them: one owner, one set of rows. A row the
 * owner cannot take now carries the owner's reason and no write path. */
export function qlPresentation(family: string, instance: string, state: LiveTorusState | null, compact: boolean): {rows: SdkParamRow[]; values: Record<string, ParamValue>} {
  const ok = state !== null && state.ok ? state : null
  const writable = liveInstrumentWritable(state)
  const write = (declared: SdkParamRow, why: string | null): SdkParamRow =>
    writable && why === null ? ({...declared, writePath: QL_WRITE_PATH} as SdkParamRow) : ({...declared, disclosure: why ?? (ok ? NOT_WRITABLE : ABSENT_OWNER)} as SdkParamRow)
  const at = (key: string, title: string, type: string, rest: Partial<SdkParamRow>): SdkParamRow =>
    ({family, deviceInstance: instance, key, title, type, ...rest, ...(compact ? {compact: true} : {})}) as SdkParamRow
  // A reading that carries no parameters reports none of them: each stays absent.
  const parameters = ok?.parameters ?? null
  const cadence = parameters?.cadence ?? null
  const scale = parameters?.scale?.unitsPerMetre ?? null
  const rows: SdkParamRow[] = [
    write(at('sound', 'Sound', 'boolean', {group: 'Sound'}), null),
    write(at('level', 'Level', 'number', {group: 'Sound', range: {min: 0, max: 4, unit: '×'}}), null),
    write(at('cadence', 'Cadence', 'enumerated', {group: 'Play', values: CADENCE_NAMES}), ok && cadence === null ? NO_SCENE : null),
    write(at('scale', 'Scale', 'number', {group: 'Scale', range: {min: 40, max: 400, unit: 'u/m'}}), ok && scale === null ? NO_SCALE : null),
  ]
  const values: Record<string, ParamValue> = {}
  if (parameters) {
    if (typeof parameters.muted === 'boolean') values.sound = !parameters.muted
    if (typeof parameters.level === 'number') values.level = parameters.level
    if (cadence !== null) values.cadence = cadence.playing ? (CADENCE_NAMES[LIVE_CADENCE_OPTIONS.findIndex(option => option.value === String(cadence.rate))] ?? CADENCE_NAMES[0]!) : CADENCE_NAMES[0]!
    if (scale !== null) values.scale = scale
  }
  return {rows, values}
}

/** The keys qlPresentation carries: each is written through qlInstrumentEdit. */
export const QL_PRESENTATION_KEYS: readonly string[] = Object.freeze(['sound', 'level', 'cadence', 'scale'])

/** The field/PCM owner as a device, over the owner's current reading (null while none is published). */
export function qlInstrumentDevice(face: InhabitantFaceDeclaration, state: LiveTorusState | null): DeviceInstance {
  const ok = state !== null && state.ok ? state : null
  const presentation = qlPresentation(QL_FAMILY, face.id, state, true)
  const rows: SdkParamRow[] = [
    ...presentation.rows,
    row(face.id, 'standing', 'Standing', 'string', {group: 'Reading', disclosure: ABSENT_OWNER}),
    row(face.id, 'scheduled', 'Scheduled blocks', 'number', {group: 'Reading'}),
    row(face.id, 'discarded', 'Discarded blocks', 'number', {group: 'Reading'}),
    row(face.id, 'queued', 'Queued blocks', 'number', {group: 'Reading'}),
  ]
  const values: Record<string, ParamValue> = {...presentation.values}
  if (ok) {
    values.standing = ok.value.standing
    if (ok.value.audio) {
      values.scheduled = ok.value.audio.scheduled_blocks
      values.discarded = ok.value.audio.discarded_blocks
    }
    values.queued = ok.value.queued_blocks
    values.enabled = ok.value.available
  }
  return {
    id: techneDeviceId(QL_FAMILY, face.id), family: QL_FAMILY, face: techneFaceDeclaration(face), rows, values, enabledKey: ok ? 'enabled' : undefined,
    submit: async changes => {
      for (const change of changes) {
        const result = await commitLiveInstrumentEdit(qlInstrumentEdit(change.key, change.value))
        if (!result.ok) throw Error(result.error)
      }
    },
  }
}

/** A face declared waiting, as a device: dark, with no control — its standing and the owner it waits for, from the family's note. */
export function waitingDevice(face: InhabitantFaceDeclaration, family: string): DeviceInstance {
  const rows: SdkParamRow[] = [
    {family, deviceInstance: face.id, key: 'standing', type: 'string', title: 'Standing', group: 'Waiting', compact: true} as SdkParamRow,
    {family, deviceInstance: face.id, key: 'waits-for', type: 'string', title: 'Waits for', group: 'Waiting', ...(face.note ? {disclosure: face.note} : {})} as SdkParamRow,
  ]
  // A face that is declared admitted but draws no device here yet is named for what it is, never lit.
  return {id: techneDeviceId(family, face.id), family, face: techneFaceDeclaration(face), rows, values: {standing: face.admission === 'waiting' ? 'waiting' : 'declared, no device drawn yet'}}
}
