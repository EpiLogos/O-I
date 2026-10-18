// Live's chain as devices of the one runtime (FOUNDATION F5; manual §10.4: "Devices sit left to right in a chain, and the
// material always passes through them in that order"; lock §0.2.5: "note devices before the torus"; §0.2.1: the Live corpus's
// capacities "appear as chain devices … never as Ableton's catalogue"). Each builder re-presents a reading the shell already
// has as a DeviceInstance the frame's DeviceView draws as the mockup's plate (world-shell-mockup.html `dev()` :1410):
// - a note device (live/noteDevices) — the session hold writes it (noteDeviceHold.ts), the mode in force is the owner's;
// - a set device with a stored-parameter table (panels/devices/DevicePanel.tsx) — its rows are the owner's table, its values
//   the stored ones, and a change is the Live document owner's own write (kernel live_device_param_write);
// - any other set device — the deep document's parameters, losslessly and read-only (was DeviceChainPanel's device tile).
// Nothing here invents a value: a row with no reading stays dark and says why. Pure: no React, no store, no I/O.
import type {DeviceDeclaration, SdkParamRow} from '../inhabitants/sdk/define'
import type {DeviceInstance, ParamValue} from '../frame/devices/deviceRuntime'
import type {SetParameter} from '../shell/document'
import type {ParamDescJson} from '../panels/devices/api'
import type {ModeInForce} from './modes'
import {NOTE_DEVICE_LABEL, TIE_RULES, TIE_RULE_LABEL, scalePlan, type NoteDevice, type TieRule} from './noteDevices/noteDevices'

const row = (family: string, deviceInstance: string, fields: Omit<SdkParamRow, 'family' | 'deviceInstance'>): SdkParamRow =>
  ({family, deviceInstance, ...fields}) as SdkParamRow

// ── the keyboard's layout ────────────────────────────────────────────────────
// The keyboard is the part's input, not a chain device (DLW §21.1 The input; lock §0.3.6): R4 took its plate (`live:keyboard`) off the
// chain — KeyboardOnChain.tsx PartInput keeps its MIDI path, the Torus's Full keeps the playing surface. Its layout stays the shell's
// (keyboardLayout.ts), the input's Layout setting (Jankó · Piano), which the part's track input and the Notes editor's key column read.

export type KeyboardLayoutName = 'janko' | 'piano'

// ── note devices ─────────────────────────────────────────────────────────────

/** The session hold's setter behind every note-device row (noteDeviceHold.ts): the chain is the Live surface's own choice. */
export const NOTE_DEVICE_WRITE = 'shell.noteDeviceChain'
export const NOTE_DEVICE_KEPT = 'Held for this session only: the set document has no owner write for a note-device chain yet.'
export const noteDeviceId = (id: string): string => `live:note/${id}`

export interface NoteDeviceHold {
  setTie: (id: string, tie: TieRule) => void
  setPower: (id: string, enabled: boolean) => void
}

/** What the device does to the notes now, in one word, and the whole line behind it (the face's reading of scalePlan). */
export function noteDeviceReading(device: NoteDevice, mode: ModeInForce): {state: 'bypassed' | 'fold' | 'pass'; word: string; line: string} {
  if (!device.enabled) return {state: 'bypassed', word: 'bypassed', line: 'Bypassed: notes pass through unchanged.'}
  const plan = scalePlan(mode)
  if (plan.state === 'pass') return {state: 'pass', word: 'pass through', line: plan.line}
  return {state: 'fold', word: mode.state === 'in-force' ? `onto ${mode.selection.scale.label}` : 'fold', line: plan.line}
}

/** A note device before the torus (lock §0.2.5): its tie rule and power written to the session hold, what it does to the notes
 * read from the mode in force, and where it is kept. */
export function noteDevice(device: NoteDevice, mode: ModeInForce, hold: NoteDeviceHold): DeviceInstance {
  const id = noteDeviceId(device.id)
  const name = NOTE_DEVICE_LABEL[device.kind]
  const reading = noteDeviceReading(device, mode)
  const family = 'note device'
  const face = {id: `note-${device.kind}`, title: name, icon: 'direct', liveSemantic: 'device-midi-fx',
    note: 'Bends every played note before it reaches the torus, in chain order.'} as DeviceDeclaration
  return {
    id, family, face, enabledKey: 'enabled',
    rows: [
      row(family, id, {key: 'tie', type: 'enumerated', title: 'Tie', values: TIE_RULES.map(tie => TIE_RULE_LABEL[tie]), writePath: NOTE_DEVICE_WRITE, compact: true, group: 'Fold',
        disclosure: 'Where a note lies an equal distance from the mode above and below, it goes up or down.'}),
      row(family, id, {key: 'notes', type: 'string', title: 'Notes', compact: true, group: 'Fold', disclosure: reading.line}),
      row(family, id, {key: 'enabled', type: 'boolean', title: 'On', writePath: NOTE_DEVICE_WRITE, group: name}),
      row(family, id, {key: 'kept', type: 'string', title: 'Kept', group: name, disclosure: NOTE_DEVICE_KEPT}),
    ],
    values: {tie: TIE_RULE_LABEL[device.params.tie], notes: reading.word, enabled: device.enabled, kept: 'this session'},
    submit: async changes => {
      for (const change of changes) {
        if (change.key === 'enabled' && typeof change.value === 'boolean') hold.setPower(device.id, change.value)
        else if (change.key === 'tie' && device.kind === 'scale') {
          const tie = TIE_RULES.find(rule => TIE_RULE_LABEL[rule] === change.value)
          if (!tie) throw Error(`${change.value}: not a tie rule`)
          hold.setTie(device.id, tie)
        } else throw Error(`${change.key}: not a setting of the ${name} device`)
      }
    },
  }
}

// ── the set's devices ────────────────────────────────────────────────────────

/** The instruments among the set's devices, by the element name the document stores (the browser files them under
 * Instruments, everything else under Chain devices). */
export const SET_INSTRUMENT_ELEMENTS: ReadonlySet<string> = new Set(['Operator', 'Wavetable', 'Simpler', 'Sampler', 'OriginalSimpler', 'InstrumentVector', 'Collision', 'DrumRack', 'InstrumentRack', 'Analog', 'Drift'])

/** The Live document owner's write of one stored parameter (panels/devices/api.ts postDeviceParam). */
export const SET_DEVICE_WRITE = 'kernel:live_device_param_write'
export const setDeviceId = (track: number, index: number): string => `live:set/${track}/${index}`
/** How many of a device's parameters its plate shows on the chain; the pool shows every one (manual §10.4). */
const COMPACT = 4

const setFace = (elementName: string, title: string): DeviceDeclaration => ({id: `set-${elementName}`, title, icon: 'chain',
  liveSemantic: SET_INSTRUMENT_ELEMENTS.has(elementName) ? 'device-instrument' : 'device-audio-fx',
  note: 'A device of the opened set, as the set document stores it.'}) as DeviceDeclaration
const setFamily = (elementName: string) => SET_INSTRUMENT_ELEMENTS.has(elementName) ? 'instrument' : 'effect'

/** A device the shell has no stored-parameter table for: the deep document's parameters, by the document's own names, each
 * value lossless and read-only (was the chain's read-only device tile, components/DeviceChainPanel.tsx). */
export function setDeviceReading({id, elementName, title, params, fault}: {id: string; elementName: string; title: string; params: readonly SetParameter[] | undefined; fault?: string | null}): DeviceInstance {
  const family = setFamily(elementName)
  const rows: SdkParamRow[] = []
  const values: Record<string, ParamValue> = {}
  if (fault) rows.push(row(family, id, {key: '·owner', type: 'string', title: 'Editing', compact: true, group: 'Owner', disclosure: fault}))
  for (const [index, parameter] of (params ?? []).entries()) {
    const range = parameter.min === undefined ? '' : ` · disclosed range ${parameter.min} – ${parameter.max}`
    rows.push(row(family, id, {key: parameter.id, type: 'string', title: parameter.id, compact: index < COMPACT - (fault ? 1 : 0),
      disclosure: `${parameter.id} · lossless document reading${range} · editing awaits the native device owner`}))
    values[parameter.id] = parameter.value
  }
  if (!params?.length) rows.push(row(family, id, {key: '·parameters', type: 'string', title: 'Parameters', compact: true, disclosure: 'No parameters disclosed by the native document'}))
  return {id, family, face: setFace(elementName, title), rows, values}
}

/** A stored value as the plate takes it, by the row the owner's table makes of it (DevicePanel's ParamRow: a continuous value
 * is a number, a discrete one an index into its labels, a toggle the word true). */
function storedValue(desc: ParamDescJson, stored: string | undefined, choices: readonly string[]): ParamValue | undefined {
  if (stored === undefined) return undefined
  if (desc.kind === 'toggle') return stored === 'true'
  const value = Number.parseFloat(stored)
  if (!Number.isFinite(value)) return undefined
  if (desc.kind === 'continuous') return value
  return choices[Math.round(value) - Math.round(desc.stored_min)]
}

/** A discrete row's choices: the owner's labels with its unit, each one distinct (two equal labels keep their index). */
function choicesOf(desc: ParamDescJson): string[] {
  const labels = (desc.labels ?? []).map(label => desc.unit ? `${label} ${desc.unit}` : label)
  return labels.map((label, index) => labels.indexOf(label) === index ? label : `${Math.round(desc.stored_min) + index}: ${label}`)
}

/** A set device with the owner's stored-parameter table (panels/devices/DevicePanel.tsx): one row per table entry, the stored
 * values read through the owner, and every change the owner's own write — the same reads and writes the panel made, drawn
 * as the plate. Its light is the device's own On parameter, when its table has one. */
export function setDeviceFaced({id, elementName, title, descriptors, stored, fault, write}: {
  id: string; elementName: string; title: string; descriptors: readonly ParamDescJson[]; stored: Readonly<Record<string, string>>
  fault?: string | null
  /** The owner's write of one stored value; resolves when the owner has persisted it. */
  write: (paramId: string, value: number | boolean) => Promise<void>
}): DeviceInstance {
  const family = setFamily(elementName)
  const firstKnobs = new Set(descriptors.filter(desc => desc.kind === 'continuous').slice(0, COMPACT).map(desc => desc.id))
  const rows: SdkParamRow[] = []
  const values: Record<string, ParamValue> = {}
  if (fault) rows.push(row(family, id, {key: '·owner', type: 'string', title: 'Owner', compact: true, group: 'Owner', disclosure: fault}))
  for (const desc of descriptors) {
    const choices = desc.kind === 'discrete' ? choicesOf(desc) : []
    const missing = stored[desc.id] === undefined
    rows.push(row(family, id, {
      key: desc.id, title: desc.ui_name, writePath: SET_DEVICE_WRITE, compact: firstKnobs.has(desc.id),
      ...(desc.kind === 'toggle' ? {type: 'boolean'}
        : desc.kind === 'discrete' ? {type: 'enumerated', values: choices}
        : {type: 'number', range: {min: desc.stored_min, max: desc.stored_max, ...(desc.unit ? {unit: desc.unit} : {})}, ...(desc.unit ? {unit: desc.unit} : {})}),
      ...(missing ? {disclosure: `Not stored in this document: the set carries no “${desc.id}” element to edit.`} : desc.notes ? {disclosure: desc.notes} : {}),
    }))
    const value = storedValue(desc, stored[desc.id], choices)
    if (value !== undefined) values[desc.id] = value
  }
  const power = descriptors.find(desc => desc.id === 'On' && desc.kind === 'toggle')
  return {
    id, family, face: setFace(elementName, title), rows, values, ...(power ? {enabledKey: power.id} : {}),
    submit: async changes => {
      for (const change of changes) {
        const desc = descriptors.find(item => item.id === change.key)
        if (!desc) throw Error(`${change.key}: not in the owner's table for ${title}`)
        if (desc.kind === 'discrete') {
          const at = choicesOf(desc).indexOf(String(change.value))
          if (at < 0) throw Error(`${change.value}: not one of ${desc.ui_name}'s stored choices`)
          await write(desc.id, Math.round(desc.stored_min) + at)
        } else if (desc.kind === 'toggle') await write(desc.id, change.value === true)
        else await write(desc.id, Number(change.value))
      }
    },
  }
}

// ── what the chain waits for ─────────────────────────────────────────────────

/** What Live's chain says while something it shows is not there yet — one line, in the host's waiting idiom. */
export function liveChainWaits({instrument, set, track}: {instrument: boolean; set: {loading: boolean; error: string | null; open: boolean}; track: boolean}): string | null {
  const torus = 'The torus joins the chain when its owner publishes a reading'
  if (track) return instrument ? null : `${torus}.`
  const lack = set.loading ? 'the set is being read' : set.error ? `the set did not open: ${set.error}` : set.open ? 'select a track to bring its devices here' : "open a set to bring a track's devices here"
  return instrument ? `${lack[0].toUpperCase()}${lack.slice(1)}.` : `${torus}; ${lack}.`
}
