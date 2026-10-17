// Each mode's transport bindings (FOUNDATION F7), by registration: the frame's one bar (frame/transport/Transport.tsx)
// draws 28 slots in Live's places and knows no mode; this table names, per mode, what a slot does and whose op it is —
// manual §10.5's table, one column per mode. A slot with no binding is drawn waiting with its grammar meaning; a binding
// enables a slot only with a write path, and a light only with a reading. The working controls move here from the old
// bars: Live's mode in force (root, scale) and its key and MIDI maps; Technē's Back to Now, occasion steps and instrument
// arm; Factory's run, stop, voice, steer, effort, heartbeat, quantize and write arm (shell/transports); Expressions' scene
// play, stop, take, arm, loop, time scale and scrub; Central's Day, its die and bounds, the packet and the ground's carrier
// (shell/transports/useCentralTransport.tsx); every mode's real readouts. The title line above the bar is registered here too
// (MODE_TITLE): THE selection with its world and day, or — in Live — the open set.
import {useEffect} from 'react'
import type {SurfMode, TransportSlotId} from './modeGrammar'
import {publishTransportKeys} from '../frame/keys/keyDoors'
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
import type {NativeCompositionViewSource} from './compositionViews'
import {useFactoryTransport} from './transports/useFactoryTransport'
import {useExpressionsTransport} from './transports/useExpressionsTransport'
import {useCentralTransport} from './transports/useCentralTransport'
import {civilDayLabel} from './transports/transportReadings'
import {civilDateOfDayRef} from '../central/centralVertical'
import {useAtlasTimeBindings} from '../projections/atlas/places/placesTransport'
import {usePalaceWalkBindings} from '../projections/atlas/palaces/palaceTransport'; import {useFramePresentation} from '../components/expressions/studio/framePresentation'

/** What the bindings read from the frame: the mode's real readouts, the World's time spine, the focused instrument, Live's set. */
export interface TransportReading {
  readouts?: ModeTransportReadouts
  timeSpine?: TimeSpine | null
  focusedInstrument?: PaneInstrumentId | null
  tempoBpm: number | null
  /** Expressions' native scene transport, when its reading stands. */
  nativeTransport?: NativeCompositionViewSource | null
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
  return {label: meaning.label, fn: meaning.fn, dataI: slotDataI(meaning), waiting, ...(meaning.face ? {face: meaning.face} : {})}
}

/** What the title line above the bar reads in each mode (the mockup's `#title`): `set` — the open Live set's name; `selection`
 * — THE selection, the world and the civil day (components/TransportBar.tsx draws it; transports/transportReadings.ts words it). */
export const MODE_TITLE: Readonly<Record<SurfMode, 'set' | 'selection'>> = {
  live: 'set', base: 'selection', factory: 'selection', expressions: 'selection', techne: 'selection',
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
  // Places is the atlas (T-PLACES-ONTO-ATLAS): Play and Stop press the atlas's one time button (the walk that stands, else the Earth's
  // clock through the shared window), and punch-in and punch-out read the window's edges (projections/atlas/places/placesTransport.ts).
  const atlasTime = useAtlasTimeBindings()
  // While a palace is entered its walk takes the one button (T-PALACES-ONTO-ATLAS, lane-5 T17): Play walks the palace locus by locus, Stop
  // holds it still, Walk pace and Stop n/8 read its dwell and its locus (projections/atlas/palaces/palaceTransport.ts); outside, none.
  const palaceWalk = usePalaceWalkBindings()
  // The clock that drives the panes (the mockup's `14:37 · 08 Oct`): the civil Now the World cut reads, with the civil day the
  // spine's own civil reading stands in (timeline/timeSpine.ts `now().dayRef`).
  const now = readouts?.position, day = civilDayLabel(civilDateOfDayRef(timeSpine?.now()?.dayRef))
  const clock = now && day && /\d/.test(now.value) ? {position: {readout: {value: `${now.value} · ${day}`, title: now.title}}} : {}
  const bindings: TransportBindings = {...readoutsOf(readouts), ...clock, ...atlasTime, ...palaceWalk, arm: {control: instrumentArmControl(slotMeaning('techne', 'arm'), focusedInstrument)}}
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

export const MODE_TRANSPORT: Readonly<Record<SurfMode, UseModeTransport>> = {
  live: useLiveTransport,
  base: useCentralTransport,
  factory: useFactoryTransport,
  expressions: useExpressionsTransport,
  techne: useTechneTransport,
}

/** The mode's bar: its bindings over the one transport. Keyed by mode where it is mounted, so each mode keeps its hook order. */
export function ModeTransport({mode, reading}: {mode: SurfMode; reading: TransportReading}) {
  const bindings = MODE_TRANSPORT[mode](reading)
  // The hosted frame's presentation (T-FRAME-CHROME-ONTO-PLATES): its controls on the devices in a pane, its own at full size. Declared
  // from here because the transport stands in every mode, as the frame can stand in a pane of any mode; one hook, no mode branch.
  useFramePresentation()
  // The keys press the same slots (F9: Space plays or stops, Esc stops), so they read the bindings drawn here.
  useEffect(() => { publishTransportKeys(bindings); return () => publishTransportKeys(null) })
  return <Transport bindings={bindings} words={id => slotWords(mode, id)} />
}
