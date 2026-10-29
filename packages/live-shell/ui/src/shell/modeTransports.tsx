// Each mode's transport bindings (FOUNDATION F7), by registration: the frame's one bar (frame/transport/Transport.tsx)
// draws 28 slots in Live's places and knows no mode; this table names, per mode, what a slot does and whose op it is —
// manual §10.5's table, one column per mode. A slot with no binding is drawn waiting with its grammar meaning; a binding
// enables a slot only with a write path, and a light only with a reading. The working controls move here from the old
// bars: Live's mode in force (root, scale) and its key and MIDI maps; Technē's Back to Now, occasion steps, and the World's
// Arm, Record and Capture over its walk (projections/atlas/places/placesTransport.ts walkBindings); Factory's run, stop, voice,
// steer, effort, heartbeat, quantize and write arm (shell/transports); Expressions' scene play, stop, take, arm, loop, time scale and scrub; Central's Day, its die and bounds, the packet and the ground's carrier
// (shell/transports/useCentralTransport.tsx); every mode's real readouts. The title line above the bar is registered here too
// (MODE_TITLE): THE selection with its world and day, or — in Live — the open set.
import type {SurfMode, TransportSlotId} from './modeGrammar'
import {MODE_GRAMMAR, slotDataI, slotMeaning} from './modeGrammar'
import {transportBindingForSlot, transportBindingRow} from '../inhabitants/sdk/define'
import type {SdkModeName} from '../inhabitants/sdk/modes'
import type {TimeSpine} from '../timeline/timeSpine'
import type {PaneInstrumentId} from './paneInstrument'
import type {ModeTransportReadouts} from './ModeTransportBar'
import {Transport} from '../frame/transport/Transport'
import type {SlotWords, TransportBindings} from '../frame/transport/slots'
import type {NativeCompositionViewSource} from './compositionViews'
import {loadWhenDrawn, type LoadedWhenDrawn} from './loadWhenDrawn'

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
export const readoutsOf = (readouts: ModeTransportReadouts | undefined): TransportBindings =>
  Object.fromEntries(Object.entries(readouts ?? {}).map(([id, readout]) => [id, {readout}])) as TransportBindings

/** Each mode's bindings, registered as the module that holds them: a mode's code loads when its transport first draws (O-I #740),
 * never with the shell's first frame. The Expressions and Technē bars carry the sitting over them (shell/transports/boundTransport.tsx). */
export const MODE_TRANSPORT: Readonly<Record<SurfMode, () => Promise<UseModeTransport>>> = {
  live: () => import('./transports/useLiveTransport').then(module => module.useLiveTransport),
  base: () => import('./transports/useCentralTransport').then(module => module.useCentralTransport),
  factory: () => import('./transports/useFactoryTransport').then(module => module.useFactoryTransport),
  expressions: () => Promise.all([import('./transports/useExpressionsTransport'), import('./transports/boundTransport')]).then(([module, bound]) => bound.withSitting(module.useExpressionsTransport)),
  techne: () => Promise.all([import('./transports/useTechneTransport'), import('./transports/boundTransport')]).then(([module, bound]) => bound.withSitting(module.useTechneTransport)),
}

type ModeTransportProps = {mode: SurfMode; reading: TransportReading}
/** A mode's bar before its bindings arrive: the one transport, unbound — each slot drawn waiting with its meaning — over the readouts
 * the frame publishes. The shell's waiting state for the transport's place. */
const waitingBar = (mode: SurfMode) => function WaitingTransport({reading}: ModeTransportProps) {
  return <Transport bindings={readoutsOf(reading.readouts)} words={id => slotWords(mode, id)} />
}
const BOUND = Object.fromEntries((Object.keys(MODE_TRANSPORT) as SurfMode[]).map(mode => [mode,
  loadWhenDrawn<ModeTransportProps>(`${MODE_GRAMMAR[mode].title}'s transport`,
    () => Promise.all([MODE_TRANSPORT[mode](), import('./transports/boundTransport')]).then(([use, bound]) => bound.boundTransport(use)),
    waitingBar(mode))])) as Record<SurfMode, LoadedWhenDrawn<ModeTransportProps>>

/** The mode's bar: its bindings over the one transport (shell/transports/boundTransport.tsx). Keyed by mode where it is mounted, so
 * each mode keeps its hook order; until the mode's bindings arrive the bar stands unbound, never blank. */
export function ModeTransport({mode, reading}: ModeTransportProps) {
  const Bound = BOUND[mode]
  return <Bound mode={mode} reading={reading} />
}
