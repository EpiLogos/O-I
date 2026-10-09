/**
 * The mode grammar — WORLD-SHELL-DESIGN Revision 5's tables as typed data.
 *
 * One transport, five meanings: every mode keeps the SAME transport slots in
 * the SAME places; only the meaning changes. This module is that table, plus
 * Revision 4's per-arrangement Clip|Device meanings and Revision 5's
 * Session|Arrangement presentation meanings, as records the shell frame
 * consumes. There is no per-mode conditional sprawl and no second shell:
 * the frame reads the grammar, the grammar holds no view and no store.
 *
 * The mode marks are the icon-cut's (inhabitants/sdk/icons.ts, generated
 * from icon-cut.html — the one place the icon language is readable). The
 * rows agree with the inhabitants' own declaration of the same Rev-5 tables
 * (`inhabitants/sdk/modes.ts`); tests/mode-grammar.test.mjs holds the two
 * together so neither can drift from the design.
 *
 * Mode → spine mapping (the aperture law: a mode switch is an encounter
 * transition over mode × WorldContext × accessEpoch, never a second store):
 * - live  → the shell's audio cut (book mode `base`, the music presentation)
 * - base  → book mode `base` + WorldContext.world = 'central' — the design's
 *   §6 resolution: Central is a world context, not a separate mode
 * - factory → book mode `factory` (the agency surface is its content)
 * - expressions/techne → their book modes, as standing.
 *
 * Pure data: no React, no view, no store, no I/O.
 */

import type {IconName} from '../inhabitants/sdk/icons.ts'

/** The surf's mode icons, in order: Live · Base · Central · Factory ·
 * Expressions · Technē (Revision 5's rack row). */
export const SURF_MODES = ['live', 'base', 'factory', 'expressions', 'techne'] as const
export type SurfMode = (typeof SURF_MODES)[number]

/** The shell frame's mode reading of the spine. `audio` is Live; the others
 * carry their own names. */
export type FrameMode = 'audio' | 'base' | 'factory' | 'expressions' | 'techne'

/** The spine's mode → the surf mode that presents it (`live` accepted as
 * Live's own name; null: settings or an unknown reading — no mode icon may
 * light on an unknown mode). */
export function surfModeOf(mode: string): SurfMode | null {
  if (mode === 'audio' || mode === 'live') return 'live'
  return (SURF_MODES as readonly string[]).includes(mode) ? mode as SurfMode : null
}

/** One transport slot's meaning in one mode: the control's name there, and
 * what it does there. The pair IS the data-i string (`data-i="label|fn"`). */
export interface SlotMeaning {
  readonly id: string
  readonly label: string
  readonly fn: string
}

/** One presentation's meaning: what the icon shows, and what the view holds. */
export interface PresentationMeaning {
  readonly label: string
  readonly meaning: string
}

/** Revision 4's Clip | Device pair, per arrangement. */
export interface DetailPair {
  readonly clip: PresentationMeaning
  readonly device: PresentationMeaning
}

export interface SurfModeGrammar {
  readonly name: SurfMode
  readonly title: string
  /** The mode's icon-cut mark. */
  readonly mark: IconName
  /** One line for the mode button's tooltip. */
  readonly hint: string
  /** Revision 5, second table: what Session and Arrangement show here. */
  readonly session: PresentationMeaning
  readonly arrangement: PresentationMeaning
  /** Revision 4's table: the detail row's pair in this mode. */
  readonly detail: DetailPair
  /** Revision 5, first table: every transport slot's meaning here, in the
   * fixed shell order (TRANSPORT_SLOT_IDS). */
  readonly transport: readonly SlotMeaning[]
  /** What the mode's waiting transport controls name (the honesty law:
   * a disabled control says what is planned and that it is not built). */
  readonly waitingNote: string
}

/**
 * The fixed transport slot order of the shell bar — the same slots in the
 * same places in every mode. Live's names are the slot ids' home meanings;
 * every other mode re-means them in place.
 */
export const TRANSPORT_SLOT_IDS = [
  'link', 'tap',
  'tempo', 'signature',
  'metro', 'quantize',
  'key', 'root', 'scale',
  'follow', 'position',
  'play', 'stop', 'record', 'overdub', 'arm', 're-enable', 'capture',
  'punch-in', 'loop', 'punch-out', 'loop-length',
  'draw', 'keys', 'key-map', 'midi-map', 'rate', 'cpu',
] as const
export type TransportSlotId = (typeof TRANSPORT_SLOT_IDS)[number]

// ————————————————————————————————————————————————————————————————————————
// Revision 5's first table, row by row, plus the fuller function texts the
// mockups record for each mode (the widget guide's §3.1/§4.1 transport
// laws). The Live column states each slot's home meaning.

const live: SurfModeGrammar = {
  name: 'live',
  title: 'Live',
  mark: 'live',
  hint: 'Music — the shell\'s base mode, restored',
  session: {label: 'Session', meaning: 'clips and scenes'},
  arrangement: {label: 'Arrangement', meaning: 'the song over time'},
  detail: {
    clip: {label: 'Clip', meaning: 'the clip in focus'},
    device: {label: 'Device', meaning: 'the track\'s device chain'},
  },
  transport: [
    {id: 'link', label: 'Link', fn: 'join the set\'s clock with Link peers'},
    {id: 'tap', label: 'Tap', fn: 'tap tempo'},
    {id: 'tempo', label: 'Tempo', fn: 'the set\'s tempo'},
    {id: 'signature', label: 'Signature', fn: 'the set\'s time signature'},
    {id: 'metro', label: 'Metronome', fn: 'the metronome'},
    {id: 'quantize', label: 'Quantize', fn: 'global launch quantization'},
    {id: 'key', label: 'Key', fn: 'the set\'s key'},
    {id: 'root', label: 'Root', fn: 'the key\'s root note'},
    {id: 'scale', label: 'Scale', fn: 'the key\'s scale mode'},
    {id: 'follow', label: 'Follow', fn: 'the arrangement scrolls with playback'},
    {id: 'position', label: 'Position', fn: 'bars . beats . sixteenths'},
    {id: 'play', label: 'Play', fn: 'play the set'},
    {id: 'stop', label: 'Stop', fn: 'stop the set'},
    {id: 'record', label: 'Record', fn: 'record into the arrangement'},
    {id: 'overdub', label: 'Overdub', fn: 'MIDI overdub'},
    {id: 'arm', label: 'Arm', fn: 'automation arm'},
    {id: 're-enable', label: 'Re-enable', fn: 're-enable automated parameters'},
    {id: 'capture', label: 'Capture', fn: 'capture Session launches into the Arrangement (Session record)'},
    {id: 'punch-in', label: 'Punch in', fn: 'record between the in and out points'},
    {id: 'loop', label: 'Loop', fn: 'loop the loop brace'},
    {id: 'punch-out', label: 'Punch out', fn: 'record between the in and out points'},
    {id: 'loop-length', label: 'Loop length', fn: 'the loop brace\'s length'},
    {id: 'draw', label: 'Draw', fn: 'draw notes and automation'},
    {id: 'keys', label: 'Keys', fn: 'play the set from the computer keyboard'},
    {id: 'key-map', label: 'Key map', fn: 'bind computer keys to controls'},
    {id: 'midi-map', label: 'MIDI map', fn: 'bind MIDI controls'},
    {id: 'rate', label: 'Rate', fn: 'the engine\'s sample rate, in kHz'},
    {id: 'cpu', label: 'CPU', fn: 'the engine\'s CPU load'},
  ],
  waitingNote: 'The audio engine\'s transport is read-only until its owner lands; the field holds its place.',
}

const base: SurfModeGrammar = {
  name: 'base',
  title: 'Base · Central',
  mark: 'die',
  hint: 'The Central ground — the day and its documents',
  session: {label: 'Session', meaning: 'the day as clips: Day, Flows, Beings, Things and Goals as tracks'},
  arrangement: {label: 'Arrangement', meaning: 'today on one ruler'},
  detail: {
    clip: {label: 'Document', meaning: 'form, file, revision, bindings; highlights; notes; packet'},
    device: {label: 'Devices', meaning: 'Text · Highlight · Notes · Packet · Answer · the form devices (the ground\'s family docks here)'},
  },
  transport: [
    {id: 'link', label: 'Ground sync', fn: 'the frame follows the ground\'s carrier (the kernel link)'},
    {id: 'tap', label: 'Stamp Now', fn: 'stamp Now into the open document'},
    {id: 'tempo', label: 'Die face', fn: 'the Day die\'s open face; ‹ › turns it'},
    {id: 'signature', label: '4 + 2', fn: 'the die\'s 4+2 reading — four working faces, two flanks'},
    {id: 'metro', label: 'Autosave', fn: 'the document\'s autosave'},
    {id: 'quantize', label: 'Save timing', fn: 'when the document\'s save lands'},
    {id: 'key', label: 'Packet tokens', fn: 'the packet\'s token count — exactly what the agent receives'},
    {id: 'root', label: 'Root', fn: 'the packet\'s root subject'},
    {id: 'scale', label: 'Scale', fn: 'the packet\'s scope'},
    {id: 'follow', label: 'Follow', fn: 'views follow the day\'s Now'},
    {id: 'position', label: 'Now', fn: 'the day\'s civil instant'},
    {id: 'play', label: 'Answer', fn: 'send the packet and record the answer'},
    {id: 'stop', label: 'Stop', fn: 'stop the current dictation'},
    {id: 'record', label: 'Dictate', fn: 'dictate into the focused document'},
    {id: 'overdub', label: 'Append / replace', fn: 'the dictated take appends or replaces'},
    {id: 'arm', label: 'Agent write-arm', fn: 'off: agent writes arrive as proposals; on: they land with a receipt'},
    {id: 're-enable', label: 'Hand back', fn: 'hand back what you hold that an agent owns'},
    {id: 'capture', label: 'Selection → packet', fn: 'put the current selection into the packet'},
    {id: 'punch-in', label: 'Day opened', fn: 'the day opened (08:30)'},
    {id: 'loop', label: 'Close routine', fn: 'the day-close routine'},
    {id: 'punch-out', label: 'Day close', fn: 'the day closes (21:00)'},
    {id: 'loop-length', label: 'Day span', fn: 'the day\'s span'},
    {id: 'draw', label: 'Highlight pen', fn: 'highlight in the open document'},
    {id: 'keys', label: 'Keys', fn: 'keys for the document\'s controls'},
    {id: 'key-map', label: 'Map', fn: 'bind a key or spoken phrase to any control'},
    {id: 'midi-map', label: 'Map', fn: 'bind a pad or phrase to any control'},
    {id: 'rate', label: 'Carrier', fn: 'which carrier serves the field, and its round-trip'},
    {id: 'cpu', label: 'Save state', fn: 'the document\'s save standing'},
  ],
  waitingNote: 'The document devices (the die, the Flow) dock in the detail row; their transport controls wait for the day document\'s owner to admit them here.',
}

const factory: SurfModeGrammar = {
  name: 'factory',
  title: 'Factory',
  mark: 'hex',
  hint: 'Sessions and tasks — the agency desk',
  session: {label: 'Session', meaning: 'sessions and tasks'},
  arrangement: {label: 'Arrangement', meaning: 'the run viewer'},
  detail: {
    clip: {label: 'Task log', meaning: 'the selected task\'s tool-run log'},
    device: {label: 'Agent chain', meaning: 'gateway → agent → skills → world → git'},
  },
  transport: [
    {id: 'link', label: 'Peers', fn: 'link the shell\'s sessions to agents in other harnesses and machines (one ledger, one clock)'},
    {id: 'tap', label: 'Ping', fn: 'ask every running agent for a status line now; answers land in the Agents tile'},
    {id: 'tempo', label: 'Effort', fn: 'thinking effort per turn (low → max); per-task override exists'},
    {id: 'signature', label: 'Budget', fn: 'turns used / allowed for the selected session'},
    {id: 'metro', label: 'Heartbeat', fn: 'running agents check in on a cadence; a stopped needle is a stall'},
    {id: 'quantize', label: 'Interrupt timing', fn: 'how fast Stop and Steer land: now · next tool · next turn'},
    {id: 'key', label: 'Tokens in · out', fn: 'tokens for the selected scope: session · group · everything open'},
    {id: 'root', label: 'Root', fn: 'the scope\'s root session'},
    {id: 'scale', label: 'Scale', fn: 'the token scope'},
    {id: 'follow', label: 'Follow', fn: 'arrangement scrolls with live needles; tiles follow the selected agent'},
    {id: 'position', label: 'Position', fn: 'task . turn . step of the selected session'},
    {id: 'play', label: 'Run', fn: 'launch the selected task, or every queued one'},
    {id: 'stop', label: 'Stop all', fn: 'pause at the next quantize, context kept; press again to cancel the turns'},
    {id: 'record', label: 'Voice', fn: 'record speech into a new task clip on the armed track'},
    {id: 'overdub', label: 'Steer', fn: 'on: mid-run input steers the running turn; off: it queues as the next task'},
    {id: 'arm', label: 'Write arm', fn: 'off: writes arrive as proposals; on: writes inside world devices land directly, with a receipt'},
    {id: 're-enable', label: 'Hand back', fn: 'lit only when you hold something an agent owns; press to hand back'},
    {id: 'capture', label: 'Capture', fn: 'record what you do by hand into a new clip — a worked example an agent can learn as a skill'},
    {id: 'punch-in', label: 'Write window', fn: 'no writes before the in-step'},
    {id: 'loop', label: 'Routine', fn: 'the task repeats until its stop condition or cap'},
    {id: 'punch-out', label: 'Write window out', fn: 'no writes after the out-step'},
    {id: 'loop-length', label: 'Routine cap', fn: 'the routine\'s cap'},
    {id: 'draw', label: 'Point', fn: 'mark the stage or tiles as agent reference'},
    {id: 'keys', label: 'Keys', fn: 'number keys launch task rows; letters fire rack macros'},
    {id: 'key-map', label: 'Map', fn: 'bind a key to any control ("Fizz, retry")'},
    {id: 'midi-map', label: 'Map', fn: 'bind a pad or spoken phrase to any control'},
    {id: 'rate', label: 'Throughput', fn: 't/s across running agents — the tokens/s rate'},
    {id: 'cpu', label: 'Context', fn: 'context-window fill of the selected session'},
  ],
  waitingNote: 'The agency readings are live in the centre; the transport\'s writers (steer, voice, capture) wait for their harness owners.',
}

const expressions: SurfModeGrammar = {
  name: 'expressions',
  title: 'Expressions',
  mark: 'expr',
  hint: 'The living field — the retained body',
  session: {label: 'Session', meaning: 'scene rows'},
  arrangement: {label: 'Arrangement', meaning: 'the scenes over time'},
  detail: {
    clip: {label: 'Scene', meaning: 'sequence, durations, bindings'},
    device: {label: 'Studio', meaning: 'the engine\'s own controls'},
  },
  transport: [
    {id: 'link', label: 'Field sync', fn: 'sync the frame with the field carrier'},
    {id: 'tap', label: 'Tap', fn: 'tap tempo for the field'},
    {id: 'tempo', label: 'Field tempo', fn: 'the field\'s time scale'},
    {id: 'signature', label: '5 : 3', fn: 'the scene ratio — hold : transition'},
    {id: 'metro', label: 'Pulse', fn: 'the field\'s pulse'},
    {id: 'quantize', label: 'Scene quantize', fn: 'launch quantization for scenes'},
    {id: 'key', label: '☿ Resonance', fn: 'the resonance key of the shared medium'},
    {id: 'root', label: 'Root', fn: 'the resonance\'s root'},
    {id: 'scale', label: 'Scale', fn: 'the resonance\'s scope'},
    {id: 'follow', label: 'Follow', fn: 'views follow the scene'},
    {id: 'position', label: 'Scene time', fn: 'seconds within the working scene'},
    {id: 'play', label: 'Play scenes', fn: 'play the focused scene (or the saved sequence)'},
    {id: 'stop', label: 'Stop', fn: 'rewind the working scene and pause'},
    {id: 'record', label: 'Capture take', fn: 'armed Play records a take of the chosen properties'},
    {id: 'overdub', label: 'Layer', fn: 'the take layers over the scene'},
    {id: 'arm', label: 'Studio arm', fn: 'arm the Studio: Play records a take'},
    {id: 're-enable', label: 'Re-enable', fn: 'release parameters held at manual values'},
    {id: 'capture', label: 'Gestures → scene', fn: 'capture the current gestures into the scene'},
    {id: 'punch-in', label: 'Scene loop', fn: 'loop the saved sequence back to its first scene'},
    {id: 'loop', label: 'Loop', fn: 'scene loop: the saved sequence returns to its first scene'},
    {id: 'punch-out', label: 'Scene loop', fn: 'loop the saved sequence back to its first scene'},
    {id: 'loop-length', label: 'Sequence span', fn: 'the saved sequence\'s span'},
    {id: 'draw', label: 'Draw form', fn: 'draw on the field'},
    {id: 'keys', label: 'Keys', fn: 'keys for the field\'s controls'},
    {id: 'key-map', label: 'Map', fn: 'bind keys to the field\'s controls'},
    {id: 'midi-map', label: 'Map', fn: 'bind pads to the field\'s controls'},
    {id: 'rate', label: 'fps', fn: 'the field\'s frame rate, in fps'},
    {id: 'cpu', label: 'GPU', fn: 'the GPU share of the field'},
  ],
  waitingNote: 'The native transport carries the real readings when the owner is attached; without it, these hold their places.',
}

const techne: SurfModeGrammar = {
  name: 'techne',
  title: 'Technē',
  mark: 'techne',
  hint: 'The deep mode — the six lenses over one encounter',
  session: {label: 'Session', meaning: 'M3′ Journey'},
  arrangement: {label: 'Arrangement', meaning: 'M2′ Relation Field'},
  detail: {
    clip: {label: 'Clip', meaning: 'identity, place and time, disclosure, typed relations, bounded constellation, source'},
    device: {label: 'Instruments', meaning: 'the six lenses — the focused lens\'s instrument expanded, the others folded; clicking one opens it on the focused pane'},
  },
  transport: [
    {id: 'link', label: 'Field carrier', fn: 'join the World to the shared field carrier; off, the same grammar runs over the local ground'},
    {id: 'tap', label: 'Back to Now', fn: 'snap the occasion back to Now'},
    {id: 'tempo', label: 'Walk pace', fn: 'walk dwell per stop'},
    {id: 'signature', label: 'Stop n/8', fn: 'the stop of eight in the walk'},
    {id: 'metro', label: 'Presence', fn: 'the FieldNow presence pulse — other Worlds\' presence animates'},
    {id: 'quantize', label: 'Arrival', fn: 'arrival quantize for the walk'},
    {id: 'key', label: 'Aperture · view as', fn: 'me · field · public — your World fogs everything not projected; raising an audience always asks first'},
    {id: 'root', label: 'Aperture', fn: 'World · Local · Shared · Federated'},
    {id: 'scale', label: 'View as', fn: 'me · field · public'},
    {id: 'follow', label: 'Follow', fn: 'panes follow the encounter'},
    {id: 'position', label: 'Now', fn: 'the driving clock\'s value'},
    {id: 'play', label: 'Walk', fn: 'walk the Journey'},
    {id: 'stop', label: 'Stop', fn: 'stop the walk'},
    {id: 'record', label: 'Record walk', fn: 'record a new walk from your encounters'},
    {id: 'overdub', label: 'Extend', fn: 'extend the walk'},
    {id: 'arm', label: 'Instrument writes', fn: 'arm the focused lens\'s instrument writes'},
    {id: 're-enable', label: 'Hand back', fn: 'hand back what you hold that an instrument owns'},
    {id: 'capture', label: 'View → scene', fn: 'the current view becomes a scene'},
    {id: 'punch-in', label: 'Occasion window', fn: 'the retained occasion\'s window opens here'},
    {id: 'loop', label: 'Occasion window', fn: 'a saved occasion keeps its snapshot and separately qualifies its admission'},
    {id: 'punch-out', label: 'Occasion window', fn: 'the retained occasion\'s window closes here'},
    {id: 'loop-length', label: 'Window span', fn: 'the occasion window\'s span'},
    {id: 'draw', label: 'Place tool', fn: 'presentation placement'},
    {id: 'keys', label: 'Keys', fn: 'keys for the lens\'s controls'},
    {id: 'key-map', label: 'Map', fn: 'bind keys to the lens\'s controls'},
    {id: 'midi-map', label: 'Map', fn: 'bind pads to the lens\'s controls'},
    {id: 'rate', label: 'Carrier', fn: 'the carrier and its round-trip'},
    {id: 'cpu', label: 'Projected', fn: 'share of your World projected into the field'},
  ],
  waitingNote: 'The lenses\' instruments are declared and waiting (the Quaternal Logic family holds their faces); the walk\'s writers wait for the journey owner.',
}

/** Revision 5's tables: one record per surf mode. Order is the surf's order. */
export const MODE_GRAMMAR: Readonly<Record<SurfMode, SurfModeGrammar>> = Object.freeze({
  live, base, factory, expressions, techne,
})

/** The grammar of one surf mode (undefined for an unknown name). */
export function modeGrammar(mode: string): SurfModeGrammar | undefined {
  return (SURF_MODES as readonly string[]).includes(mode) ? MODE_GRAMMAR[mode as SurfMode] : undefined
}

/** One slot's meaning in one mode. */
export function slotMeaning(mode: SurfMode, id: string): SlotMeaning {
  const grammar = MODE_GRAMMAR[mode]
  const found = grammar.transport.find(slot => slot.id === id)
  // The grammar is whole — a missing slot is a programming fault, named.
  if (!found) throw Error(`The ${grammar.title} grammar has no meaning for transport slot "${id}"`)
  return found
}

/** The data-i string of a slot meaning (the F2 law: "Name|Function text"). */
export function slotDataI(meaning: SlotMeaning): string {
  return `${meaning.label}|${meaning.fn}`
}

/** The detail pair of the mode the spine stands in (null outside the five). */
export function detailPairOf(mode: string): DetailPair | null {
  const surf = surfModeOf(mode)
  return surf ? MODE_GRAMMAR[surf].detail : null
}
