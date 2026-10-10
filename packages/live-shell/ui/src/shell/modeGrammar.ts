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

// ————————————————————————————————————————————————————————————————————————
// The per-mode frame compositions — browser, centre, status — as declared
// data (the commission: browser/centre/detail/status join the grammar; no
// per-mode conditional sprawl in components). The CATEGORIES are the
// grammar's data (Revision 3's left-column table, mode by mode); their
// ENTRIES are not invented here — the frame composes them through the
// families' declared surfaces (§12/§16): the L7 central browser categories,
// the L4 temporal reading, the ground listing. `cut` names a category whose
// rows compose from a landed owner today; `waiting` names one the owner has
// not landed — the browser draws it as a designed empty category that names
// its owner, never another mode's content.

export interface ModeBrowserCategory {
  readonly id: string
  readonly label: string
  /** The category column's group heading (the mockup's column groups:
   * Central / Project / To hand / World / Views). */
  readonly group: string
  /** The icon-cut mark the category wears. */
  readonly mark: IconName
  /** What the category's rows are. */
  readonly hint: string
  /** The family whose declared surface carries the entries (§12); absent
   * when the rows are the shell's own (the ground listing). */
  readonly family?: string
  /** `cut`: rows compose from a landed owner. `waiting`: the owner has not
   * landed — the designed empty category names it. */
  readonly state: 'cut' | 'waiting'
}

/** The mode's centre composition, per presentation: the designed frame the
 * centre holds when the mode's material is not (yet) readable — header,
 * structure, affordance — and the honest disclosure inside it. The readable
 * presentation composes through the landed adapters (L4's) and needs no
 * frame of its own. */
export interface CentreComposition {
  readonly label: string
  readonly meaning: string
}

/** The mode's status identity: what the status bar's subject line names in
 * this mode — never another mode's name (the audit: Base·Central must not
 * say "Expressions"). */
export interface ModeStatusIdentity {
  readonly label: string
  readonly fn: string
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
  /** Revision 5 + Revision 3: the mode's left-browser categories (the
   * frame composes their entries through the families' declared surfaces). */
  readonly browser: readonly ModeBrowserCategory[]
  /** The centre's designed frame per presentation, for the state where the
   * mode's material is not readable yet (the empty-state law: a DESIGNED
   * surface, never a bare sentence in a void). */
  readonly centre: {readonly session: CentreComposition; readonly arrangement: CentreComposition}
  /** The status bar's identity in this mode. */
  readonly status: ModeStatusIdentity
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
  // Live keeps its own browser (the audio BrowserPane) and its own centre —
  // the audio cut's compositions; the grammar records the identity, the
  // frame composes nothing new here.
  browser: [],
  centre: {
    session: {label: 'Session', meaning: 'clips and scenes'},
    arrangement: {label: 'Arrangement', meaning: 'the song over time'},
  },
  status: {label: 'Live', fn: 'the music surface — the set and its transport'},
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
  // The mockup's Base column (Rev 3): Central — Days, Flows, Beings, Things,
  // Goals; Project — Files, Wiki. Entries compose through the central
  // family's declared surfaces: L7's browser categories + the L4 civil
  // reading for Days, the ground listing for Files.
  browser: [
    {id: 'central-days', label: 'Days', group: 'Central', mark: 'die', family: 'central', state: 'cut',
      hint: 'The civil calendar: a day per row, its record beneath — rows from the kernel\'s temporal read (L4) and the day records.'},
    {id: 'central-flows', label: 'Flows', group: 'Central', mark: 'trav', family: 'central', state: 'waiting',
      hint: 'The flow documents (Dialogue · Flow · Journal). The Flow document device is declared; the flow listing\'s owner read is not landed — designed empty until it is.'},
    {id: 'central-beings', label: 'Beings', group: 'Central', mark: 'bind', family: 'central', state: 'waiting',
      hint: 'Beings with their bindings (world, subject, office, sources). The oi-beings form\'s owner has not landed its listing read — designed empty until it is.'},
    {id: 'central-things', label: 'Things', group: 'Central', mark: 'chain', family: 'central', state: 'waiting',
      hint: 'Things with their bindings. The oi-things form\'s owner has not landed its listing read — designed empty until it is.'},
    {id: 'central-goals', label: 'Goals', group: 'Central', mark: 'direct', family: 'central', state: 'waiting',
      hint: 'The goals lane of the day. The goals listing\'s owner read is not landed — designed empty until it is.'},
    {id: 'central-files', label: 'Files', group: 'Project', mark: 'detail',
      state: 'cut',
      hint: 'The ground\'s listing — folders and notes as rows; selecting one opens its craft in the Document detail.'},
    {id: 'central-wiki', label: 'Wiki', group: 'Project', mark: 'lib', family: 'central', state: 'waiting',
      hint: 'The wiki projects through its Expression owner (§6); the projection read does not answer in every boot — designed empty, named.'},
  ],
  centre: {
    session: {label: 'Day · Session', meaning: 'the day as clips — Day, Flows, Beings, Things, Goals as tracks; documents and entries as clips'},
    arrangement: {label: 'Today', meaning: 'today on one ruler'},
  },
  status: {label: 'Central', fn: 'the ground — the day as clips, documents and entries'},
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
  // The Factory browser composes through the agency surface's own browser
  // (AgentShellBrowser — the landed Factory column); the grammar records the
  // mode's category identity so the frame and the surface cannot drift.
  browser: [
    {id: 'factory-sessions', label: 'Sessions', group: 'Work', mark: 'session', family: 'software-factory', state: 'cut',
      hint: 'The working sessions — one row per session, tracks are sessions, clips are tasks.'},
    {id: 'factory-agents', label: 'Agents', group: 'Work', mark: 'bind', family: 'software-factory', state: 'cut',
      hint: 'The agent population — who is seated, running, stalled.'},
    {id: 'factory-runs', label: 'Runs', group: 'Work', mark: 'arrangement', family: 'software-factory', state: 'cut',
      hint: 'The run viewer — attempts and their task trees as temporal material.'},
    {id: 'factory-knowledge', label: 'Knowledge', group: 'Ground', mark: 'search', family: 'software-factory', state: 'cut',
      hint: 'The knowledge route — skills and sources the sessions can admit.'},
  ],
  centre: {
    session: {label: 'Sessions', meaning: 'tracks are sessions, clips are tasks'},
    arrangement: {label: 'Run viewer', meaning: 'one lane per thread — the runs over time'},
  },
  status: {label: 'Factory', fn: 'sessions and tasks — the agency desk'},
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
  // Expressions keeps the retained app's browser (the Expressions library —
  // the audit holds it correct); the grammar records the identity.
  browser: [],
  centre: {
    session: {label: 'Scene rows', meaning: 'scene rows — the walk of the working set'},
    arrangement: {label: 'Scenes over time', meaning: 'the scenes over time — source timing on one axis'},
  },
  status: {label: 'Expressions', fn: 'the living field — the retained body'},
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
  // The mockup's Technē column (Rev 3): To hand — sources, files; World —
  // bodies, locations, earth places, palaces, journeys. Sources and Files
  // compose from landed owners; the World groups wait for theirs — drawn as
  // designed empty categories that name their owners, never another mode's
  // content.
  browser: [
    {id: 'techne-sources', label: 'Sources', group: 'To hand', mark: 'form',
      state: 'cut',
      hint: 'Sources to hand — the open works, openable in an instrument; rows from the retained app\'s own work list.'},
    {id: 'techne-files', label: 'Files', group: 'To hand', mark: 'detail',
      state: 'cut',
      hint: 'Reference files from the ground\'s listing — add a reference to the lens from here.'},
    {id: 'techne-bodies', label: 'Bodies', group: 'World', mark: 'earth', family: 'quaternal-logic', state: 'waiting',
      hint: 'The field\'s bodies — your planet and the Worlds around it. The Earth projection\'s adapter is the family\'s to land (the atlas port refused the merge) — designed empty until it is.'},
    {id: 'techne-locations', label: 'Locations', group: 'World', mark: 'placed', family: 'quaternal-logic', state: 'waiting',
      hint: 'Placed artefacts and their anchors. Waits for the Earth projection\'s owner — designed empty, named.'},
    {id: 'techne-places', label: 'Places', group: 'World', mark: 'map', family: 'quaternal-logic', state: 'waiting',
      hint: 'Earth places — the Atlas port\'s surface. Waits for the Places owner — designed empty, named.'},
    {id: 'techne-palaces', label: 'Palaces', group: 'World', mark: 'palace', family: 'quaternal-logic', state: 'waiting',
      hint: 'Palaces — M5′ as locations you enter. Waits for the Palace owner — designed empty, named.'},
    {id: 'techne-journeys', label: 'Journeys', group: 'World', mark: 'journey', family: 'quaternal-logic', state: 'waiting',
      hint: 'Journeys — the walk stops (place · occasion · artefact · narration). Waits for the journey owner — designed empty, named.'},
  ],
  centre: {
    session: {label: 'M3′ Journey', meaning: 'walk stops — place · occasion · artefact · narration'},
    arrangement: {label: 'M2′ Relation Field', meaning: 'the Relation Field — authored history beside development on one non-linear ruler with the declared break into today'},
  },
  status: {label: 'Technē', fn: 'the six lenses over one encounter'},
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

/** The mode's left-browser categories (empty when the mode keeps its own
 * browser — Live's audio pane, Expressions' retained library). */
export function browserCategoriesOf(mode: string): readonly ModeBrowserCategory[] {
  const surf = surfModeOf(mode)
  return surf ? MODE_GRAMMAR[surf].browser : []
}

/** The status identity of the mode the spine stands in (null outside the
 * five — the caller keeps its own reading there). */
export function statusIdentityOf(mode: string): ModeStatusIdentity | null {
  const surf = surfModeOf(mode)
  return surf ? MODE_GRAMMAR[surf].status : null
}
