// Each mode's transport bindings (FOUNDATION F7), by registration: the frame's one bar (frame/transport/Transport.tsx)
// draws 28 slots in Live's places and knows no mode; this table names, per mode, what a slot does and whose op it is —
// manual §10.5's table, one column per mode. A slot with no binding is drawn waiting with its grammar meaning; a binding
// enables a slot only with a write path, and a light only with a reading. The working controls move here from the old
// bars: Live's mode in force (root, scale) and its key and MIDI maps; Technē's Back to Now, occasion steps and instrument
// arm; every mode's real readouts. Factory's and Expressions' working controls fold in as bindings next (their own bars
// stand until they do).
import type {SurfMode, TransportSlotId} from './modeGrammar'
import {MODE_GRAMMAR, slotDataI, slotMeaning} from './modeGrammar'
import {transportBindingForSlot, transportBindingRow} from '../inhabitants/sdk/define'
import type {SdkModeName} from '../inhabitants/sdk/modes'
import type {TimeSpine} from '../timeline/timeSpine'
import type {PaneInstrumentId} from './paneInstrument'
import {instrumentArmControl, occasionStepControl, returnToNowControl, useSpineRevision, type ModeTransportReadouts} from './ModeTransportBar'
import {Transport} from '../frame/transport/Transport'
import type {SlotWords, TransportBindings} from '../frame/transport/slots'
import {PITCH_CLASS_NAMES} from '../live/modes'
import {setLiveModeHold, useLiveModeInForce} from '../native/liveModeCatalogue'
import {MidiMapHost, MidiMapToggles} from '../live/midiMap/midiMapControls'

/** What the bindings read from the frame: the mode's real readouts, the World's time spine, the focused instrument, Live's set. */
export interface TransportReading {
  readouts?: ModeTransportReadouts
  timeSpine?: TimeSpine | null
  focusedInstrument?: PaneInstrumentId | null
  tempoBpm: number | null
}

export type UseModeTransport = (reading: TransportReading) => TransportBindings

/** A slot's words in a mode: its meaning, and — unbound — whether a family has bound it (and to what owner op) or it waits. */
export function slotWords(mode: SurfMode, id: TransportSlotId): SlotWords {
  const meaning = slotMeaning(mode, id)
  const binding = transportBindingForSlot(mode as SdkModeName, id)
  const row = binding ? transportBindingRow(binding) : undefined
  const waiting = binding
    ? `${meaning.label} — ${meaning.fn}. Bound by the ${binding.family} family to ${binding.face}/${binding.key} (owner op: ${row?.writePath ?? row?.disclosure ?? 'its owner operation'}); the control waits for its owner's wiring.`
    : `${meaning.label} — ${meaning.fn}. Not wired here yet: ${MODE_GRAMMAR[mode].waitingNote}`
  return {label: meaning.label, fn: meaning.fn, dataI: slotDataI(meaning), waiting}
}

/** The owner readouts a mode's frame publishes (Now, the carrier, …), as slot readouts. */
const readoutsOf = (readouts: ModeTransportReadouts | undefined): TransportBindings =>
  Object.fromEntries(Object.entries(readouts ?? {}).map(([id, readout]) => [id, {readout}])) as TransportBindings

const useLiveTransport: UseModeTransport = ({tempoBpm}) => {
  const {reading, hold, refresh, groups, mode, line} = useLiveModeInForce()
  const ready = reading.state === 'ready'
  const choice = mode.state === 'in-force' ? mode.selection : null
  return {
    tempo: {readout: {value: tempoBpm?.toFixed(2) ?? '—', title: 'Tempo — the set\'s tempo · document read-only until the editing owner lands'}},
    root: {control: <select aria-label="Root note" title={`Root — the mode in force's root. ${line}`} disabled={!ready}
      value={ready ? String(hold.root) : ''} onChange={event => setLiveModeHold({root: Number(event.target.value)})}>
      {ready ? PITCH_CLASS_NAMES.map((name, pitch) => <option key={pitch} value={pitch}>{name}</option>) : <option>—</option>}
    </select>},
    scale: {control: <>
      <select aria-label="Scale mode" title={`Scale — the mode in force, one of the kernel's scales. ${line}`} disabled={!ready || groups.length === 0}
        value={choice?.scale.key ?? ''} onChange={event => setLiveModeHold({key: event.target.value || null})}>
        <option value="">{!ready ? '—' : groups.length ? 'none chosen' : 'no catalogued mode on this root'}</option>
        {groups.map(group => <optgroup key={group.label} label={group.label}>
          {group.scales.map(scale => <option key={scale.key} value={scale.key}>{scale.label}</option>)}
        </optgroup>)}
      </select>
      <output className="transport-mode-line" aria-label="Mode in force" title={line}>{line}</output>
      <button type="button" className="native-control" aria-label="Re-read the mode catalogue" title="Re-read the owner's mode catalogue through the kernel"
        disabled={reading.state === 'loading'} onClick={refresh}>↻</button>
    </>},
    // Live's two map toggles stand together in the key-map slot, as in Live; the map host rides with them.
    'key-map': {control: <><MidiMapToggles /><MidiMapHost /></>},
    'midi-map': {control: <></>},
  }
}

const useTechneTransport: UseModeTransport = ({readouts, timeSpine, focusedInstrument}) => {
  useSpineRevision(timeSpine)
  const bindings: TransportBindings = {...readoutsOf(readouts), arm: {control: instrumentArmControl(slotMeaning('techne', 'arm'), focusedInstrument)}}
  if (!timeSpine) return bindings
  const brace = timeSpine.transport().loopClipIds
  const length = slotMeaning('techne', 'loop-length')
  return {...bindings,
    tap: {control: returnToNowControl(timeSpine, slotMeaning('techne', 'tap'))},
    loop: {control: occasionStepControl(timeSpine, slotMeaning('techne', 'loop'))},
    ...(brace?.length ? {'loop-length': {readout: {value: `${brace.length} clip${brace.length === 1 ? '' : 's'}`,
      title: `${length.label} — ${length.fn}. The spine holds this window read-only: ${brace.length} clip${brace.length === 1 ? '' : 's'}.`}}} : {}),
  }
}

const useReadouts: UseModeTransport = ({readouts}) => readoutsOf(readouts)

export const MODE_TRANSPORT: Readonly<Record<SurfMode, UseModeTransport>> = {
  live: useLiveTransport,
  base: useReadouts,
  factory: useReadouts,
  expressions: useReadouts,
  techne: useTechneTransport,
}

/** The mode's bar: its bindings over the one transport. Keyed by mode where it is mounted, so each mode keeps its hook order. */
export function ModeTransport({mode, reading}: {mode: SurfMode; reading: TransportReading}) {
  const bindings = MODE_TRANSPORT[mode](reading)
  return <Transport bindings={bindings} words={id => slotWords(mode, id)} />
}
