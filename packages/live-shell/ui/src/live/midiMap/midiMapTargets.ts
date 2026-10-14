// The parameters a map can bind (T-LIVE-MIDI leg 2): the instrument's determinants, cadence, sound, level and scale, and the note devices'
// parameters. Each target reads the owner's value now, and writes through the parameter's own write path: the owner's instrument edit
// (commitLiveInstrumentEdit, the one channel the Live faces share) or the note-device hold's setter. A target is only offered while the owner
// states its value, so a map never binds a parameter it cannot read.

import type {StageResult} from '@epilogos/expressions-boundary'
import {commitLiveInstrumentEdit, liveTorusMacroRows, liveTorusState, LIVE_CADENCE_OPTIONS, type LiveTorusState} from '../torusInstrument'
import {noteDeviceChain, setScaleTie} from '../noteDevices/noteDeviceHold'
import {NOTE_DEVICE_LABEL, TIE_RULES, TIE_RULE_LABEL, type NoteDevice, type TieRule} from '../noteDevices/noteDevices'
import type {MapTarget} from './midiMapModel'

/** The Level slider's range, as the Instruments section draws it (STAGE_INSTRUMENT_LEVEL). */
const LEVEL_RANGE = {min: 0, max: 4, step: 0.05} as const
/** The Units-per-metre slider's range, as the Instruments section draws it (STAGE_INSTRUMENT_SCALE_MAX). */
const SCALE_RANGE = {min: 40, max: 400, step: 5} as const

/** The parameters a map can bind, as the owner reads them now and the note devices hold them. */
export function mapTargets(torus: LiveTorusState | null, chain: readonly NoteDevice[]): MapTarget[] {
  const targets: MapTarget[] = []
  if (torus !== null && torus.ok) {
    for (const row of liveTorusMacroRows(torus)) {
      // A determinant the owner does not state has no value to read, so there is nothing to bind it to.
      if (row.selected === null) continue
      targets.push({
        kind: 'choice', id: row.macro.id, label: row.macro.label, group: 'What is acting',
        options: row.options, current: row.selected, apply: value => commitLiveInstrumentEdit(row.edit(value)),
      })
    }
    const {parameters} = torus
    if (parameters.cadence !== null) {
      targets.push({
        kind: 'choice', id: 'cadence', label: 'Tick cadence', group: 'Play',
        options: LIVE_CADENCE_OPTIONS, current: parameters.cadence.playing ? String(parameters.cadence.rate) : 'hold',
        apply: value => commitLiveInstrumentEdit({kind: 'cadence', rate: value === 'hold' ? 'hold' : Number(value) as 1 | 12}),
      })
    }
    targets.push({
      kind: 'toggle', id: 'sound', label: 'Sound', group: 'See and hear',
      current: !parameters.muted, apply: on => commitLiveInstrumentEdit({kind: 'muted', muted: !on}),
    })
    targets.push({
      kind: 'range', id: 'level', label: 'Level', group: 'See and hear', range: LEVEL_RANGE,
      current: parameters.level, apply: value => commitLiveInstrumentEdit({kind: 'level', value}),
    })
    if (parameters.scale.unitsPerMetre !== null) {
      targets.push({
        kind: 'range', id: 'scale-units', label: 'Units per metre', group: 'See and hear', range: SCALE_RANGE,
        current: parameters.scale.unitsPerMetre, apply: value => commitLiveInstrumentEdit({kind: 'scale', units_per_metre: value}),
      })
    }
  }
  for (const device of chain) {
    if (device.kind !== 'scale') continue
    targets.push({
      kind: 'choice', id: `note-device:${device.id}:tie`, label: `${NOTE_DEVICE_LABEL.scale} tie`, group: 'Note devices',
      options: TIE_RULES.map(tie => ({value: tie, label: TIE_RULE_LABEL[tie]})), current: device.params.tie,
      apply: (value): Promise<StageResult> => {
        setScaleTie(device.id, value as TieRule)
        return Promise.resolve({ok: true})
      },
    })
  }
  return targets
}

/** The parameters as the live hold reads them now. */
export function readMapTargets(): MapTarget[] {
  return mapTargets(liveTorusState(), noteDeviceChain())
}
