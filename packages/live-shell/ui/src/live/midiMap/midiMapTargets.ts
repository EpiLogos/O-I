// The parameters a map can bind (T-LIVE-MIDI leg 2): the instrument's determinants, cadence, sound, level and scale, and the note devices'
// parameters. Each target reads the owner's value now, and writes through the parameter's own write path: the owner's instrument edit
// (commitLiveInstrumentEdit, the one channel the Live faces share) is an owner write, and the Scale tie is a session-held value (the note-device
// hold, not the owner), which the target says so. A target is only offered while the owner states its value, so a map never binds a
// parameter it cannot read.

import type {InstrumentEdit, StageResult} from '@epilogos/expressions-boundary'
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
        kind: 'choice', id: row.macro.id, label: row.macro.label, group: 'What is acting', writer: 'owner',
        options: row.options, current: row.selected, apply: value => commitLiveInstrumentEdit(row.edit(value)),
      })
    }
    const {parameters} = torus
    if (parameters.cadence !== null) {
      targets.push({
        kind: 'choice', id: 'cadence', label: 'Tick cadence', group: 'Play', writer: 'owner',
        options: LIVE_CADENCE_OPTIONS, current: parameters.cadence.playing ? String(parameters.cadence.rate) : 'hold',
        apply: value => commitLiveInstrumentEdit({kind: 'cadence', rate: value === 'hold' ? 'hold' : Number(value) as 1 | 12}),
      })
    }
    targets.push({
      kind: 'toggle', id: 'sound', label: 'Sound', group: 'See and hear', writer: 'owner',
      current: !parameters.muted, apply: on => commitLiveInstrumentEdit({kind: 'muted', muted: !on}),
    })
    targets.push({
      kind: 'range', id: 'level', label: 'Level', group: 'See and hear', writer: 'owner', range: LEVEL_RANGE,
      current: parameters.level, apply: value => commitLiveInstrumentEdit({kind: 'level', value}),
    })
    if (parameters.scale.unitsPerMetre !== null) {
      targets.push({
        kind: 'range', id: 'scale-units', label: 'Units per metre', group: 'See and hear', writer: 'owner', range: SCALE_RANGE,
        current: parameters.scale.unitsPerMetre, apply: value => commitLiveInstrumentEdit({kind: 'scale', units_per_metre: value}),
      })
    }
  }
  for (const device of chain) {
    if (device.kind !== 'scale') continue
    const deviceId = device.id
    targets.push({
      kind: 'choice', id: `note-device:${deviceId}:tie`, label: `${NOTE_DEVICE_LABEL.scale} tie`, group: 'Note devices', writer: 'session',
      options: TIE_RULES.map(tie => ({value: tie, label: TIE_RULE_LABEL[tie]})), current: device.params.tie,
      // The tie is held by the session's note-device chain, not written to the owner: it is judged against the chain after the set.
      apply: (value): Promise<StageResult> => {
        if (!noteDeviceChain().some(row => row.id === deviceId && row.kind === 'scale')) {
          return Promise.resolve({ok: false, error: 'The Scale device is no longer in the note-device chain.'})
        }
        setScaleTie(deviceId, value as TieRule)
        const after = noteDeviceChain().find(row => row.id === deviceId)
        return Promise.resolve(after?.kind === 'scale' && after.params.tie === value ? {ok: true} : {ok: false, error: 'The Scale tie did not take the value.'})
      },
    })
  }
  return targets
}

/** The map parameters an owner instrument edit moves, so an accepted edit clears their refusals. */
export function mapTargetIdsOfEdit(edit: InstrumentEdit): readonly string[] {
  switch (edit.kind) {
    case 'lens': return ['lens']
    case 'context-frame': return ['context-frame']
    case 'harmonic': return ['harmonic-basis']
    case 'transcription': return ['m3-transcription']
    case 'muted': return ['sound']
    case 'cadence': return ['cadence']
    case 'level': return ['level']
    case 'scale': case 'follow-scale': return ['scale-units']
    // The torus's effects are not map targets yet: an accepted effect edit clears no map refusal.
    case 'effect': case 'effect-chain': return []
  }
}

/** The parameters as the live hold reads them now. */
export function readMapTargets(): MapTarget[] {
  return mapTargets(liveTorusState(), noteDeviceChain())
}
