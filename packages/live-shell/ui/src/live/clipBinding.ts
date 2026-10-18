// Live's clip binding (manual §21.1 Clip view, "Clip view is Live's, panel for panel"; §16.5's table: "Live — A note clip or an
// audio clip — Notes, Envelopes, MPE; or Sample, Envelopes — Live's own"): the clip THE selection names in the open set, on the
// owner the replaced body read, mapped onto the keys of the designed clip `clip:live` (inhabitants/catalogue/clips/live.tsx). It
// replaces live/LiveClip.tsx's Clip view (its props rows and its empty roll). Ported from:
//   - the clip itself — an arrangement clip with its place on the ruler, or a session slot's clip — from the set's summary and its
//     deep document (live/LiveClip.tsx liveClipOf, kept: the detail head reads it);
//   - the set's mode in force — its root and its mode — from the kernel's mode catalogue (native/liveModeCatalogue.ts
//     useLiveModeInForce; LiveClip.tsx's "mode" row): the design's `set.root` and `set.mode`, which the roll follows when the clip
//     has no mode of its own.
// What the set's owner does not disclose stays absent: the clip's own Start, End, Loop and Length markers, its signature, groove and
// own scale, its launch and follow actions, its notes and its envelopes (LiveClip.tsx said the same, "—", "the roll fills when it
// does"). An arrangement clip is placed, not launched: no Launch tab (Live cap 47). An audio clip has no Notes, no MPE and no MIDI
// tools; its Sample tab is not in the design yet (PROPOSE). Every clip write refuses in the set owner's words. Pure, apart from the
// hook at the end.
import type {Value, Values} from '../frame/devices/designed'
import {clipBinding, missingOp, useViewHoldsVersion, type ClipBinding, type ClipWiring} from '../frame/detail/clipBinding'
import {useSelectedClip} from '../frame/detail/ClipBox'
import {useDetailReading} from '../frame/detail/detailReading'
import {useLiveModeInForce} from '../native/liveModeCatalogue'
import type {SetDocument} from '../shell/document'
import type {SetSelection} from '../shell/liveSelection'
import type {SetSummary} from '../shell/useSet'
import {liveClipOf, type LiveClipReading} from './LiveClip'
import type {ModeInForce} from './modes'

/** The seven modes the design's Scale chooser names (clips/live.tsx MODES). */
const SEVEN = new Set(['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'])

/** The set's mode in force as the design's `set.root` and `set.mode`: the root's pitch class, and the lens mode's own name where it
 * is one of the seven. A source scale (a maqām, a Shem name) has no name among them, so only its root is read. Pure. */
export function setModeValues(mode: ModeInForce): Values {
  if (mode.state !== 'in-force') return {}
  const values: Record<string, Value> = {'set.root': mode.selection.root}
  const name = mode.selection.scale.kind === 'lens-cf' ? mode.selection.scale.mode.toLowerCase() : null
  if (name && SEVEN.has(name)) values['set.mode'] = name
  return values
}

/** The clip's readings on the design's keys. Pure. */
export function liveClipValues(clip: LiveClipReading, mode: ModeInForce, colour: string | null | undefined): Values {
  const values: Record<string, Value> = {name: clip.name, ...setModeValues(mode)}
  if (colour) values.colour = colour
  return values
}

const SET_OWNER = 'Live set (live-set, the .als document)'
const CLIP_SET = (field: string) => `clip_set {set, track, clip (arrangement index or session slot), ${field}} → the clip at its new reading`
const NO_NOTES = missingOp('Notes', 'clip_notes_read {set, track, clip} → the clip\'s notes {id, p, at, len, vel, chance}, and clip_notes_write', SET_OWNER)
const PROPERTY = (what: string, field: string) => missingOp(what, CLIP_SET(field), SET_OWNER)

/** The MIDI tools' presses: each rewrites the clip's notes, which no owner op reads or writes yet. */
const NOTE_PRESSES = ['duplicate', 'fitToScale', 'invert', 'addInterval', 'double', 'halve', 'setLength', 'humanize.press', 'reverse', 'legatoNotes', 'transform.press', 'generate.press', 'randomize']

/** clip:live's wiring: every key the design draws or sets. */
export const LIVE_WIRING: ClipWiring = {
  reads: {
    name: 'the clip\'s name: an arrangement clip\'s own, or the session slot\'s (liveClipOf)', colour: 'the clip\'s track colour (the tracks pane)',
    'set.root': 'the set\'s mode in force: its root (the kernel\'s mode catalogue)', 'set.mode': 'the set\'s mode in force: its lens mode, where it is one of the seven',
  },
  acts: {},
  view: {
    layout: 'the key column\'s layout, Jankó or piano (the playing surface\'s setting, held here until the surface shares it)',
    overlay: 'what the key colours show (the playing surface\'s setting, held here until the surface shares it)',
    grid: 'the editor\'s grid', lane: 'which lane stands under the notes, velocity or chance', fold: 'Fold: only the rows that hold notes',
    foldScale: 'Fold to Scale: only the clip\'s mode', highlight: 'Highlight Scale: tints the mode\'s rows', note: 'the note selected in the editor',
    'mpe.slide': 'whether the MPE tab shows the slide lane', 'mpe.pressure': 'whether the MPE tab shows the pressure lane',
    'env.device': 'the envelope editor\'s Device chooser', 'env.control': 'the envelope editor\'s Control chooser',
    // The tools' own settings: what the next press applies, as Live keeps them in Clip view until you press (cap 02–06).
    interval: 'Add Interval\'s interval', stretch: 'Stretch\'s factor', setGrid: 'Set Length\'s grid', humanize: 'Humanize\'s amount',
    transform: 'the chosen transform', 'transform.auto': 'the transform\'s auto-apply', 'arp.*': 'Arpeggiate\'s settings', 'q.*': 'Quantize\'s settings',
    'span.*': 'Span\'s setting', 'strum.*': 'Strum\'s settings', 'recombine.*': 'Recombine\'s setting', generate: 'the chosen generator',
    'generate.auto': 'the generator\'s auto-apply', 'rhythm.*': 'Rhythm\'s settings', 'randomize.amount': 'Randomize\'s amount', 'ramp.*': 'the velocity ramp\'s ends',
    deviation: 'the velocity deviation the next change applies',
  },
  refused: {
    active: PROPERTY('Clip activator', 'muted'),
    start: PROPERTY('Start', 'start'), end: PROPERTY('End', 'end'), loop: PROPERTY('Loop', 'loop'), position: PROPERTY('Position', 'loop_start'),
    length: PROPERTY('Length', 'loop_length'), 'sig.num': PROPERTY('Signature', 'signature'), 'sig.den': PROPERTY('Signature', 'signature'),
    groove: PROPERTY('Groove', 'groove'), scale: PROPERTY('Scale', 'scale_mode'), root: PROPERTY('Root', 'scale_root'), mode: PROPERTY('Mode', 'scale_name'),
    follow: PROPERTY('Follow Action', 'follow_action_enabled'), followA: PROPERTY('Action A', 'follow_action_a'), followB: PROPERTY('Action B', 'follow_action_b'),
    chance: PROPERTY('Chance', 'follow_action_chance'), linked: PROPERTY('Linked', 'follow_action_linked'), multiplier: PROPERTY('Loops', 'follow_action_multiplier'),
    launch: PROPERTY('Launch mode', 'launch_mode'), legato: PROPERTY('Legato', 'legato'), quantize: PROPERTY('Quantize', 'launch_quantize'),
    launchVelocity: PROPERTY('Velocity', 'velocity_amount'),
    'env.mode': missingOp('Envelope mode', 'clip_envelope_set {set, track, clip, device, control, mode: automation|modulation, linked, points}', SET_OWNER),
    'env.linked': missingOp('Envelope link', 'clip_envelope_set {set, track, clip, device, control, mode, linked, start, end, points}', SET_OWNER),
    'env.*': missingOp('Envelope', 'clip_envelope_set {set, track, clip, device, control, mode, linked, points: [[beat, value]…]}', SET_OWNER),
    ...Object.fromEntries(NOTE_PRESSES.map(key => [key, NO_NOTES])),
  },
  absent: {
    notes: 'the set\'s owner does not disclose a clip\'s notes yet', mpe: 'no note expression is read', playhead: 'the transport\'s playhead is not read into Clip view',
    start: 'the clip\'s own Start marker is not disclosed (the document gives an arrangement clip\'s place on the ruler only)',
    end: 'the clip\'s own End marker is not disclosed', loop: 'not disclosed', position: 'not disclosed', length: 'not disclosed', 'sig.num': 'not disclosed',
    'sig.den': 'not disclosed', groove: 'not disclosed', scale: 'the clip\'s own mode is not disclosed', root: 'not disclosed', mode: 'not disclosed',
    follow: 'not disclosed', followA: 'not disclosed', followB: 'not disclosed', chance: 'not disclosed', linked: 'not disclosed', multiplier: 'not disclosed',
    launch: 'not disclosed', legato: 'not disclosed', quantize: 'not disclosed', launchVelocity: 'not disclosed', active: 'not disclosed', 'env.*': 'no clip envelope is read',
  },
}

/** An audio clip lacks the notes' tabs and the MIDI tools (manual §21.1: "Sample, for an audio clip, instead of Notes and MPE"). */
export const AUDIO_LACKS: readonly string[] = ['notes', 'mpe', 'pitch', 'transform', 'generate']
/** What each kind of clip lacks of the design, by the kind the set's document names. */
const LACKS_OF_KIND: Readonly<Record<string, readonly string[] | undefined>> = {audio: AUDIO_LACKS, midi: undefined}

export interface LiveClipInput {
  readonly set: SetSummary | null
  readonly document: SetDocument | null
  readonly selection: SetSelection
  readonly mode: ModeInForce
  readonly colour?: string | null
}

/** The clip's ref: its track and its place, as the selection names it. */
export const liveClipRef = (selection: SetSelection): string =>
  `live:${selection.track}:${selection.clip !== undefined ? `arrangement:${selection.clip}` : `slot:${selection.scene ?? 'none'}`}`

/** Live's clip binding: the clip the selection names in the open set, or null when it names none. Pure. */
export function liveClipBinding(input: LiveClipInput): ClipBinding | null {
  const clip = liveClipOf(input.set, input.document, input.selection)
  if (!clip) return null
  return clipBinding({mode: 'live', ref: liveClipRef(input.selection), values: liveClipValues(clip, input.mode, input.colour), wiring: LIVE_WIRING,
    placed: clip.at !== null, lacks: clip.kind ? LACKS_OF_KIND[clip.kind] : undefined})
}

/** The selected Live clip's binding. */
export function useLiveClip(): ClipBinding | null {
  const {live} = useDetailReading()
  const selected = useSelectedClip()
  const {mode} = useLiveModeInForce()
  useViewHoldsVersion()
  return liveClipBinding({set: live.ctx?.set ?? null, document: live.document, selection: live.selection, mode, colour: selected.track?.color})
}
