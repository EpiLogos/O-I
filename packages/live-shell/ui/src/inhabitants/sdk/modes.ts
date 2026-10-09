/** The mode layer — the five modes' ontology, declared from the specimen.
 *
 * Sources, verbatim:
 * - icon-cut.html `const MODES` — per-mode transport readouts (drift-gated
 *   by tests/device-sdk.test.mjs against the specimen itself).
 * - icon-cut.html mode rows + transport `Mode` buttons — the cut mark per
 *   mode (`live` · `die` · `hex` · `expr` · `techne`), with the rejected
 *   alternatives and their reasons carried on each mode (`altMark`/`altNote`)
 *   and the specimen's own name (`specimenName`).
 * - icon-cut.html `const SLOTS` — the transport slot ontology: the cut mark
 *   per function, its relation to the second mark (`alt` = the rejected
 *   alternative, `pair` = the companion mark the specimen shows beside it),
 *   and the usage rationale verbatim (collisions and honest readings — the
 *   icon-usage law). Drift-gated by test.
 * - WORLD-SHELL-DESIGN Rev 5 ("one transport, five meanings") — the per-mode
 *   meaning of every transport slot row, and the per-mode Session/
 *   Arrangement presentations. Rows carried verbatim from the table; the
 *   two cells where the table's Live column is the slot label itself are
 *   carried as the label bytes ('tempo ‹ › · signature', '▶ ■ ● +').
 *
 * What this module makes declarable (the mode-specific plugin surface):
 * - a device face scopes itself to modes (`DeviceDeclaration.modes`);
 * - a face declares its per-mode device format/shape
 *   (`DeviceDeclaration.formats`, vocabulary below);
 * - a family binds its §14 params to transport rows per mode
 *   (`FamilyDeclaration.transport`) — Rev 5's table made addressable data
 *   instead of hardcoded switch-cases.
 *
 * Modes are the shell's spine (uncarved block): this module declares their
 * ONTOLOGY for authors — it opens no second admission path and never
 * creates a mode.
 *
 * Pure: no view, no store, no I/O. */

import type {IconName} from './icons.ts'

// ---------------------------------------------------------------------------
// the five modes (specimen: transport Mode buttons + MODES)

export const SDK_MODES = ['live', 'base', 'factory', 'expressions', 'techne'] as const
export type SdkModeName = (typeof SDK_MODES)[number]

/** The cradle's WorkspaceMode a shell mode maps onto. Live's cradle landing
 * is the shell lane's thread — declared here as unmapped, honestly. */
export type WorkspaceModeName = 'base' | 'factory' | 'expressions' | 'techne' | 'epi-logos' | 'settings'

export interface TransportRowMeaning {
  /** The transport row id (see TRANSPORT_ROWS). */
  readonly row: TransportRowId
  /** The mode's meaning of that row — Rev 5, verbatim. */
  readonly meaning: string
}

export interface SdkMode {
  readonly name: SdkModeName
  readonly title: string
  /** The specimen's own name for the mode (MODES.name — drift-gated). */
  readonly specimenName: string
  /** The mode's cut mark (icon-cut.html transport Mode buttons). */
  readonly mark: IconName
  /** The rejected alternative mark from the specimen's mode rows, with its reason. */
  readonly altMark?: IconName
  readonly altNote?: string
  /** The cradle WorkspaceMode this shell mode presents as, when mapped. */
  readonly workspaceMode?: WorkspaceModeName
  /** The specimen's per-mode transport readouts, verbatim (MODES.readouts). */
  readonly readouts: readonly [string, string, string, string, string, string, string, string, string, string]
  /** Rev 5: what the Session view shows in this mode. */
  readonly sessionView: string
  /** Rev 5: what the Arrangement view shows in this mode. */
  readonly arrangementView: string
  /** Rev 5's slot meanings for this mode, per transport row. */
  readonly rows: readonly TransportRowMeaning[]
}

/** The transport rows (Rev 5's table rows, in order). */
export const TRANSPORT_ROWS = [
  'link-tap', 'tempo-signature', 'metronome-quantize', 'key-scale',
  'transport', 'arm-capture', 'punch-loop', 'draw-keys',
] as const
export type TransportRowId = (typeof TRANSPORT_ROWS)[number]

export const SDK_MODE_DECLARATIONS: readonly SdkMode[] = [
  {
    name: 'live',
    title: 'Live',
    specimenName: 'Live',
    mark: 'live',
    readouts: ['Link', 'Tap', '120.00', '4 / 4', '●◦', '1 Bar', 'C Major', '3. 1. 1', '48 kHz', '12 %'],
    sessionView: 'clips and scenes',
    arrangementView: 'the song over time',
    rows: [
      {row: 'link-tap', meaning: 'Link · Tap'},
      {row: 'tempo-signature', meaning: 'tempo ‹ › · signature'},
      {row: 'metronome-quantize', meaning: 'metronome · quantize'},
      {row: 'key-scale', meaning: 'key / scale'},
      {row: 'transport', meaning: '▶ ■ ● +'},
      {row: 'arm-capture', meaning: 'arm · re-enable · capture'},
      {row: 'punch-loop', meaning: 'punch · loop · punch'},
      {row: 'draw-keys', meaning: 'draw · keys · MIDI · kHz · CPU'},
    ],
  },
  {
    name: 'base',
    title: 'Base · Central',
    specimenName: 'Base',
    mark: 'die',
    altMark: 'diamond',
    altNote: 'What revision 5 draws. It is a clean mark and it collides with the archetype node.',
    workspaceMode: 'base',
    readouts: ['Ground', 'Stamp', 'face 3', '4 + 2', 'save', 'pause', 'Σ 500', '08 Oct · p3', 'local', 'edited'],
    sessionView: 'the day as clips: Day, Flows, Beings, Things and Goals as tracks',
    arrangementView: 'today on one ruler',
    rows: [
      {row: 'link-tap', meaning: 'ground sync · stamp Now into the document'},
      {row: 'tempo-signature', meaning: 'die face (‹ › turns it) · 4+2'},
      {row: 'metronome-quantize', meaning: 'autosave · save timing'},
      {row: 'key-scale', meaning: 'packet token count'},
      {row: 'transport', meaning: 'Answer (send the packet) · stop · dictate · append/replace'},
      {row: 'arm-capture', meaning: 'agent write-arm · hand back · selection → packet'},
      {row: 'punch-loop', meaning: 'day opened 08:30 · close routine · 21:00'},
      {row: 'draw-keys', meaning: 'highlight pen · keys · map · carrier · save state'},
    ],
  },
  {
    name: 'factory',
    title: 'Factory',
    specimenName: 'Factory',
    mark: 'hex',
    altMark: 'chain',
    altNote: 'The other option: three devices. Clearer, and it starts to look like the Session lanes.',
    workspaceMode: 'factory',
    readouts: ['Link', 'Tap', 'high', '2 / 12', 'beat', 'next tool', '142k · 38k', '212.2.7', '84 t/s', '38 %'],
    sessionView: 'sessions and tasks',
    arrangementView: 'the run viewer',
    rows: [
      {row: 'link-tap', meaning: 'peers · ping agents'},
      {row: 'tempo-signature', meaning: 'effort · budget'},
      {row: 'metronome-quantize', meaning: 'heartbeat · interrupt timing'},
      {row: 'key-scale', meaning: 'tokens in · out'},
      {row: 'transport', meaning: 'run · stop all · voice · steer'},
      {row: 'arm-capture', meaning: 'write arm · hand back · capture'},
      {row: 'punch-loop', meaning: 'write window · routine'},
      {row: 'draw-keys', meaning: 'point · keys · map · t/s · context'},
    ],
  },
  {
    name: 'expressions',
    title: 'Expressions',
    specimenName: 'Expressions',
    mark: 'expr',
    workspaceMode: 'expressions',
    readouts: ['Link', 'Tap', '96.00', '5 : 3', 'pulse', '1 Bar', '☿', '1 · 3.2', '60 fps', 'GPU 41'],
    sessionView: 'scene rows',
    arrangementView: 'the scenes over time',
    rows: [
      {row: 'link-tap', meaning: 'field sync · tap tempo'},
      {row: 'tempo-signature', meaning: 'field tempo · 5:3 ratio'},
      {row: 'metronome-quantize', meaning: 'pulse · scene quantize'},
      {row: 'key-scale', meaning: '☿ resonance key'},
      {row: 'transport', meaning: 'play scenes · stop · capture take · layer'},
      {row: 'arm-capture', meaning: 'Studio arm · re-enable · gestures → scene'},
      {row: 'punch-loop', meaning: 'scene loop'},
      {row: 'draw-keys', meaning: 'draw form · keys · map · fps · GPU'},
    ],
  },
  {
    name: 'techne',
    title: 'Technē',
    specimenName: 'Technē',
    mark: 'techne',
    workspaceMode: 'techne',
    readouts: ['Link 3', 'Now', '6 s', '7 / 8', 'pulse', 'arrive', 'as me', '14:37', '41 ms', '9 %'],
    sessionView: 'M3′ Journey',
    arrangementView: 'M2′ Relation Field',
    rows: [
      {row: 'link-tap', meaning: 'field carrier · back to Now'},
      {row: 'tempo-signature', meaning: 'walk pace · stop n/8'},
      {row: 'metronome-quantize', meaning: 'presence · arrival'},
      {row: 'key-scale', meaning: 'aperture · view as'},
      {row: 'transport', meaning: 'walk · stop · record walk · extend'},
      {row: 'arm-capture', meaning: 'instrument writes · hand back · view → scene'},
      {row: 'punch-loop', meaning: 'occasion window'},
      {row: 'draw-keys', meaning: 'place tool · keys · map · carrier · projected %'},
    ],
  },
]

export function sdkMode(name: string): SdkMode | undefined {
  return SDK_MODE_DECLARATIONS.find(mode => mode.name === name)
}

export function isSdkMode(candidate: string): candidate is SdkModeName {
  return SDK_MODES.includes(candidate as SdkModeName)
}

// ---------------------------------------------------------------------------
// the transport slot ontology (specimen: const SLOTS — cut mark, rejected
// alternative, and the usage rationale, verbatim)

export interface TransportSlot {
  readonly id: string
  readonly label: string
  /** The cut mark for the function. */
  readonly mark: IconName
  /** The second mark's relation, per the specimen's pick: 'alt' = the
   * rejected alternative (the rationale says why), 'pair' = the companion
   * mark shown beside the cut one (a working pair, neither rejected). */
  readonly relation: 'alt' | 'pair'
  /** The second mark (the alt or the pair companion). */
  readonly otherMark?: IconName
  /** The specimen's rationale, verbatim. */
  readonly rationale: string
}

export const TRANSPORT_SLOTS: readonly TransportSlot[] = [
  {id: 'link', label: 'Link', mark: 'link', relation: 'alt', otherMark: 'linkChain', rationale: 'Two nodes and a bond. A chain reads as a hyperlink. The peer count stays a numeral on the button.'},
  {id: 'tap', label: 'Tap', mark: 'tap', relation: 'alt', otherMark: 'metroDots', rationale: 'A contact and a ring. The old metronome dots move to the heartbeat slot, where they already mean “pulse”.'},
  {id: 'heartbeat', label: 'Heartbeat', mark: 'metro', relation: 'alt', otherMark: 'metroDots', rationale: 'Pendulum for the icon. The dots remain honest at 19px, so both are drawn; the pendulum is the one that still means a metronome when the word is gone.'},
  {id: 'follow', label: 'Follow', mark: 'follow', relation: 'alt', otherMark: 'direct', rationale: 'An arrow arriving at a rule: the view moves with the encounter. Off, and nothing moves you.'},
  {id: 'arm', label: 'Arm', mark: 'arm', relation: 'alt', otherMark: 'cmd', rationale: 'A lever. The ⌘ mark collides with the keyboard modifier and only means “automation arm” if you already live in Live.'},
  {id: 'hand-back', label: 'Hand back', mark: 'back', relation: 'alt', otherMark: 'ret', rationale: 'Arrow home into a slot. Lit in stall colour when you are holding something an agent still owns.'},
  {id: 'capture', label: 'Capture', mark: 'cap', relation: 'alt', otherMark: 'capEmpty', rationale: 'A recording head, not an empty circle. Empty circles already mean “soft stop” on a clip slot.'},
  {id: 'keys', label: 'Keys', mark: 'keys', relation: 'alt', otherMark: 'keysOld', rationale: 'Three keycaps. The paired bars were the old browser pane, and the browser is a globe now.'},
  {id: 'overdub', label: 'Overdub', mark: 'plus', relation: 'alt', otherMark: 'od', rationale: 'The bare plus stays. It is the Live key, and at this size a plus-on-a-wedge turns to noise.'},
  {id: 'map', label: 'Map', mark: 'map', relation: 'alt', otherMark: 'search', rationale: 'Two bound points. Search keeps the magnifier.'},
  {id: 'punch', label: 'Punch', mark: 'punchIn', relation: 'pair', otherMark: 'punchOut', rationale: 'In-flag and out-flag, a pair. The lightning bolt was doing neither job.'},
  {id: 'draw', label: 'Draw', mark: 'draw', relation: 'pair', otherMark: 'placed', rationale: 'Pen for draw, highlight, point, and form. Beside it, the pin: placement is a different act and lives with the field marks.'},
]

/** The fixed play · stop · record group (the specimen's slotOpts cell). */
export const TRANSPORT_PLAY_CELL = {
  marks: ['play', 'stop', 'rec', 'loop', 'earth'] as const,
  rationale: 'Filled keys, kept from both mockups. Loop and Earth were already SVG and stay.',
}

export function transportSlot(id: string): TransportSlot | undefined {
  return TRANSPORT_SLOTS.find(slot => slot.id === id)
}

// ---------------------------------------------------------------------------
// device format/shape — the per-mode device ontologies

/** The declared device formats (the shape a face takes in a mode). The kit
 * renders `chain-plate` today; the other formats are declared presentation
 * contracts whose bodies are the family's own components over the kit's
 * plate chrome — declared, then rendered as their owners land them. */
export const DEVICE_FORMATS = [
  'chain-plate', 'die', 'scene-strip', 'run-viewer', 'instrument-face', 'tool-tile',
] as const
export type DeviceFormat = (typeof DEVICE_FORMATS)[number]

/** The format a mode's devices naturally take (Rev 5 + the design's device
 * kinds) — the default when a face declares no explicit format for a mode. */
export const MODE_DEFAULT_FORMAT: Record<SdkModeName, DeviceFormat> = {
  live: 'chain-plate',
  base: 'die',
  factory: 'run-viewer',
  expressions: 'scene-strip',
  techne: 'instrument-face',
}
