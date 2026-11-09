// Live's clip binding (manual §21.1 Clip view, "Clip view is Live's, panel for panel"; §16.5's table: "Live — A note clip or an
// audio clip — Notes, Envelopes, MPE; or Sample, Envelopes — Live's own"): the clip THE selection names in the open set, on the
// owner the replaced body read, mapped onto the keys of the designed clip `clip:live` (inhabitants/catalogue/clips/live.tsx). It
// replaces live/LiveClip.tsx's Clip view (its props rows and its empty roll). Ported from:
//   - the clip itself — an arrangement clip with its place on the ruler, or a session slot's clip — from the set's summary and its
//     deep document (live/LiveClip.tsx liveClipOf, kept: the detail head reads it);
//   - the set's mode in force — its root and its mode — from the kernel's mode catalogue (native/liveModeCatalogue.ts
//     useLiveModeInForce; LiveClip.tsx's "mode" row): the design's `set.root` and `set.mode`, which the roll follows when the clip
//     has no mode of its own.
//   - the clip whole — its markers, signature, groove, own mode, follow actions, launch, notes and envelopes — from the set's owner
//     (kernel live_clip_read, packages/live-set/src/edit.rs), read again whenever the set is.
// Every setting writes to the set's owner against the set's revision (live/liveWrites.ts writeLiveClip); the MIDI tools rewrite the
// notes (live/liveClipTools.ts) and write them; the Mixer envelopes write the clip's own Volume, Pan and Send envelopes ("Send A"
// onward, one for each return the part sends to). The clip's colour is its own palette index, drawn and chosen as Live's 70-colour
// palette (live/livePalette.ts); until the clip is read whole it wears its track's colour. An arrangement
// clip is placed, not launched: no Launch tab (Live cap 47). An audio clip has no Notes, no MPE and no MIDI tools; its Sample tab
// (walk of O-I 857, G17; DLW build ruling 2026-11-08, item 2) reads and writes Warp and its mode, Gain, Transpose, Detune and the
// fades on the set's owner, and a MIDI clip has none. Pure, apart from the hook at the end.
import type {Value, Values} from '../frame/devices/designed'
import {clipBinding, clipHostId, missingOp, useViewHoldsVersion, viewHoldsOf, type ClipBinding, type ClipWiring} from '../frame/detail/clipBinding'
import {madeOfValues, withMadeOf, type ClipSource} from '../frame/detail/clipSource'
import {useConstellations, type Constellation} from '../owners/constellations'
import {useSelectedClip} from '../frame/detail/ClipBox'
import {useDetailReading} from '../frame/detail/detailReading'
import {useLiveModeInForce} from '../native/liveModeCatalogue'
import type {SetDocument} from '../shell/document'
import {liveWorldSelection, type SetSelection} from '../shell/liveSelection'
import type {SetSummary} from '../shell/useSet'
import {liveClipOf, type LiveClipReading} from './LiveClip'
import type {ModeInForce} from './modes'
import type {LiveClipAt, LiveClipReading as LiveClipWholeReading, LiveSend} from '../../../../../desktop/cradle/src/kernel/types'
import {liveColour, liveColourIndex} from './livePalette'
import {clipAtOf, liveClipMpe, useLiveClipWhole, writeLiveClip, writeLiveSetAct} from './liveWrites'
import * as tools from './liveClipTools'

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

/** The clip's readings on the design's keys: the selection's own reading, the set's mode in force, and the owner's whole clip
 * where it is read. A value the owner does not report is left out. Pure. */
export function liveClipValues(clip: LiveClipReading, mode: ModeInForce, colour: string | null | undefined, whole: LiveClipWholeReading | null = null,
  sends: readonly LiveSend[] | null = null): Values {
  const values: Record<string, Value> = {name: clip.name, ...setModeValues(mode)}
  if (colour) values.colour = colour
  if (!whole) return values
  const own = liveColour(whole.colourIndex)
  if (own) values.colour = own
  const put = (key: string, value: Value | null | undefined) => { if (value !== null && value !== undefined) values[key] = value }
  put('name', whole.name)
  put('active', whole.active)
  for (const key of ['start', 'end', 'position', 'length', 'loop'] as const) put(key, whole[key])
  put('sig.num', whole.sig?.num); put('sig.den', whole.sig?.den)
  values.groove = whole.groove ?? 'none'
  put('scale', whole.scale); put('root', whole.root); put('mode', whole.mode)
  put('follow', whole.follow); put('followA', whole.followA); put('followB', whole.followB); put('chance', whole.chance)
  put('linked', whole.linked); put('multiplier', whole.multiplier)
  put('launch', whole.launch); put('legato', whole.legato); put('quantize', whole.quantize); put('launchVelocity', whole.launchVelocity)
  // The Sample tab: an audio clip's warp, gain, pitch, fades, RAM and HiQ as the set keeps them, and the tempo its warp markers keep its
  // sample at; Gain drawn in dB (Live keeps linear gain), and whether the clip is placed on the Arrangement (its fades are its own) or
  // launched from a slot (its Fade switch).
  if (playsSample(whole.kind)) {
    for (const key of ['warp', 'warpMode', 'transpose', 'detune', 'fade', 'fadeIn', 'fadeOut', 'units', 'ram', 'hiq', 'bpm'] as const) put(key, whole[key])
    // The owner's null BPM says its warp markers keep no one tempo; a reading with no BPM at all says nothing of it (48e item 11).
    if (whole.bpm === null) values['bpm.none'] = true
    if (typeof whole.gain === 'number') values.gain = SAMPLE_GAIN.toDesign(whole.gain)
    values.placed = clip.at !== null
  }
  if (whole.notes) values.notes = JSON.stringify(whole.notes.map(n => ({id: String(n.id), p: n.p, at: n.at, len: n.len, vel: n.vel, chance: n.chance})))
  // The MPE tab: each note's expression as the set keeps it beside the note, by the note's id as `notes` names it (O-I #853).
  if (whole.notes) values.mpe = JSON.stringify(liveClipMpe(whole.notes).mpe)
  for (const [key, mixer] of Object.entries({...MIXER_ENVELOPES, ...sendEnvelopes(sends)})) {
    const env = whole.envelopes.find(e => e.device === 'Mixer' && e.parameter === mixer.parameter)
    if (env) values[key] = JSON.stringify(env.points.map(([at, v]) => [at, mixer.toDesign(v)]))
  }
  return values
}

const SET_OWNER = 'Live set (live-set, the .als document)'

type MixerEnvelope = {parameter: string; toDesign: (v: number) => number; toSet: (v: number) => number}

/** The design's Mixer envelopes and the set's own: Live keeps Volume as linear gain (1 = 0 dB) and Pan as −1…1. */
const MIXER_ENVELOPES: Readonly<Record<string, MixerEnvelope>> = {
  'env.mixer.volume': {parameter: 'Volume', toDesign: v => (v > 0 ? 20 * Math.log10(v) : -60), toSet: db => (db <= -60 ? 0 : 10 ** (db / 20))},
  'env.mixer.pan': {parameter: 'Pan', toDesign: v => v * 50, toSet: p => Math.max(-1, Math.min(1, p / 50))},
}

/** A send's lowest level, as Live 12 keeps it in every set (each Send's MidiControllerRange Min: −70 dB). */
const SEND_FLOOR = 0.0003162277571

/** The part's send envelopes, one for each send the set's owner reads on its track: `env.mixer.sendA` moves "Send A", and onward.
 * Live keeps a send as linear gain within its range; the design draws dB. */
export function sendEnvelopes(sends: readonly LiveSend[] | null): Record<string, MixerEnvelope> {
  const out: Record<string, MixerEnvelope> = {}
  for (const send of sends ?? []) {
    const letter = /^Send ([A-Z])$/.exec(send.send)?.[1]
    if (!letter) continue
    const low = send.min ?? SEND_FLOOR, high = send.max ?? 1
    out[`env.mixer.send${letter}`] = {parameter: send.send, toDesign: v => 20 * Math.log10(Math.max(v, low)),
      toSet: db => Math.max(low, Math.min(high, 10 ** (db / 20)))}
  }
  return out
}

/** The Sample tab's Gain: Live keeps a clip's gain as linear gain (`SampleVolume`, 1 = 0 dB); the design draws dB, −70 standing for
 * silence. */
export const SAMPLE_GAIN = {toDesign: (v: number) => (v > 0 ? Math.max(-70, 20 * Math.log10(v)) : -70), toSet: (db: number) => (db <= -70 ? 0 : 10 ** (db / 20))}
/** The Sample tab's settings, each the owner's own word (packages/live-set/src/edit.rs apply_settings): an audio clip's. BPM's ÷2 and ×2 are
 * BPM written at half or twice what it reads (round 48d item 1). */
const SAMPLE_SETTINGS = ['warp', 'warpMode', 'gain', 'transpose', 'detune', 'fade', 'fadeIn', 'fadeOut', 'ram', 'hiq', 'bpm'] as const
/** The Sample tab's Reverse (round 48d item 1): a press, the set's owner's act on the clip (live_set_act clip_reverse), never a setting. */
export const SAMPLE_REVERSE = 'sample.reverse'
/** Whether a clip of this kind plays a sample, so has the Sample tab: by what the kind lacks of the design (LACKS_OF_KIND below), never by
 * its name. Called only once the module stands. */
const playsSample = (kind: unknown): boolean => typeof kind === 'string' && LACKS_OF_KIND[kind] !== undefined && !LACKS_OF_KIND[kind]!.includes('sample')

/** The settings the design draws, each the owner's own word (packages/live-set/src/edit.rs apply_settings). */
const SETTINGS = ['active', 'start', 'end', 'loop', 'position', 'length', 'sig.num', 'sig.den', 'groove', 'scale', 'root', 'mode', 'follow',
  'followA', 'followB', 'chance', 'linked', 'multiplier', 'launch', 'legato', 'quantize', 'launchVelocity', 'name'] as const

/** The view's own keys (what the tools apply on the next press, how the editor shows). */
const VIEW: Readonly<Record<string, string>> = {
  layout: 'the key column\'s layout, Jankó or piano (the playing surface\'s setting, held here until the surface shares it)',
  overlay: 'what the key colours show (the playing surface\'s setting, held here until the surface shares it)',
  grid: 'the editor\'s grid', lane: 'which lane stands under the notes, velocity or chance', fold: 'Fold: only the rows that hold notes',
  foldScale: 'Fold to Scale: only the clip\'s mode', highlight: 'Highlight Scale: tints the mode\'s rows', note: 'the note selected in the editor',
  'mpe.slide': 'whether the MPE tab shows the slide lane', 'mpe.pressure': 'whether the MPE tab shows the pressure lane',
  'mpe.bend': 'whether the MPE tab shows the bend lane',
  'env.device': 'the envelope editor\'s Device chooser', 'env.control': 'the envelope editor\'s Control chooser',
  // The tools' own settings: what the next press applies, as Live keeps them in Clip view until you press (cap 02–06).
  interval: 'Add Interval\'s interval', stretch: 'Stretch\'s factor', setGrid: 'Set Length\'s grid', humanize: 'Humanize\'s amount',
  transform: 'the chosen transform', 'transform.auto': 'the transform\'s auto-apply', 'arp.*': 'Arpeggiate\'s settings', 'q.*': 'Quantize\'s settings',
  'span.*': 'Span\'s setting', 'strum.*': 'Strum\'s settings', 'recombine.*': 'Recombine\'s setting', generate: 'the chosen generator',
  'generate.auto': 'the generator\'s auto-apply', 'rhythm.*': 'Rhythm\'s settings', 'randomize.amount': 'Randomize\'s amount', 'ramp.*': 'the velocity ramp\'s ends',
  deviation: 'the velocity deviation the next change applies',
}

/** What no owner takes yet, in words. */
const REFUSED: Readonly<Record<string, string>> = {
  'env.torus.*': 'The Torus is the shell\'s own instrument, not a device of the set: a clip envelope of it has no owner in the .als document.',
  'env.scale.*': 'Scale mapping is the shell\'s own device, not a device of the set: a clip envelope of it has no owner in the .als document.',
  'env.mode': missingOp('Envelope mode', 'Live\'s modulation envelopes are not read from the document yet', SET_OWNER),
  'env.linked': missingOp('Envelope link', 'an envelope\'s own loop length is not read from the document yet', SET_OWNER),
}

/** The transforms and generators the shell does not write yet, said when one is pressed. */
const NOT_WRITTEN = {
  transform: 'Connect, Ornament, Recombine and Time Warp are not written by the shell yet; Arpeggiate, Quantize, Span and Strum are.',
  generate: 'Seed, Shape and Stacks are not written by the shell yet; Rhythm is.',
} as const

/** Where a clip's writes go: the set's file, the track's place and the clip's. */
export interface LiveClipAddress {readonly path: string; readonly track: number; readonly at: LiveClipAt}

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && Number.isFinite(Number(v)) ? Number(v) : fallback)
const word = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback)

/** The MIDI tools: each press rewrites the notes as Live's button does, with the tool's settings the view holds. */
export function toolPress(key: string, whole: LiveClipWholeReading, view: Readonly<Record<string, Value>>): tools.ToolResult | {refused: string} {
  // Each note copied whole, every field read (its deviation, release velocity and expression too): the owner gives back what it is
  // not told to change (DLW build ruling 2026-11-09, 46c item 8).
  const notes: tools.ToolNote[] = (whole.notes ?? []).map(n => ({...n}))
  const selected = view.note !== undefined && Number.isFinite(Number(view.note)) ? Number(view.note) : null
  const span: tools.ToolSpan = {start: whole.start ?? 0, end: whole.end ?? 4, position: whole.position ?? 0, length: whole.length ?? 4, loop: whole.loop === true}
  const steps = whole.mode ? tools.MODE_STEPS[whole.mode] : undefined
  const scale = whole.scale && steps && whole.root !== null ? {root: whole.root, steps} : null
  switch (key) {
    case 'duplicate': return tools.duplicate(notes, span)
    case 'fitToScale': return scale ? {notes: tools.fitToScale(notes, selected, scale)} : {refused: 'The clip has no mode of its own: turn ♭♯ on and choose its mode.'}
    case 'invert': return {notes: tools.invert(notes, selected)}
    case 'addInterval': return {notes: tools.addInterval(notes, selected, num(view.interval, 0), scale)}
    case 'double': return {notes: tools.stretch(notes, selected, 2, span.start)}
    case 'halve': return {notes: tools.stretch(notes, selected, 0.5, span.start)}
    case 'setLength': return {notes: tools.setLength(notes, selected, word(view.setGrid, '1/16'))}
    case 'humanize.press': return {notes: tools.humanize(notes, selected, num(view.humanize, 10))}
    case 'reverse': return {notes: tools.reverse(notes, selected, span)}
    case 'legatoNotes': return {notes: tools.legato(notes, selected)}
    case 'randomize': return {notes: tools.randomize(notes, selected, num(view['randomize.amount'], 100))}
    case 'transform.press': {
      const tool = word(view.transform, 'arpeggiate')
      if (tool === 'quantize') return {notes: tools.quantize(notes, selected, word(view['q.grid'], '1/16'), num(view['q.amount'], 100))}
      if (tool === 'span') return {notes: tools.span(notes, selected, word(view['span.mode'], 'legato'))}
      if (tool === 'strum') return {notes: tools.strum(notes, selected, num(view['strum.low'], 0), num(view['strum.high'], 50))}
      if (tool === 'arpeggiate') {
        const run = tools.arpeggiate(notes, selected, {style: word(view['arp.style'], 'up'), distance: num(view['arp.distance'], 12), steps: num(view['arp.steps'], 2),
          rate: word(view['arp.rate'], '1/32'), gate: num(view['arp.gate'], 100)}, scale)
        return Array.isArray(run) ? {notes: run} : run
      }
      return {refused: NOT_WRITTEN.transform}
    }
    case 'generate.press': {
      if (word(view.generate, 'rhythm') !== 'rhythm') return {refused: NOT_WRITTEN.generate}
      return {notes: tools.rhythm(notes, span.start, span.end, {steps: num(view['rhythm.steps'], 8), density: num(view['rhythm.density'], 4),
        pattern: num(view['rhythm.pattern'], 1), shift: num(view['rhythm.shift'], 0), pitch: num(view['rhythm.pitch'], 36), step: word(view['rhythm.step'], '1/8'),
        velLow: num(view['rhythm.velLow'], 100), velHigh: num(view['rhythm.velHigh'], 127)})}
    }
    default: return {refused: `${key} is no tool of the clip`}
  }
}

/** The MIDI tools' presses. */
const NOTE_PRESSES = ['duplicate', 'fitToScale', 'invert', 'addInterval', 'double', 'halve', 'setLength', 'humanize.press', 'reverse', 'legatoNotes', 'transform.press', 'generate.press', 'randomize']

/** The roll's hand on the notes (walk of O-I 857, LN02 "the roll draws no notes"; DLW build ruling 2026-11-07): Notes sets `note.draw`
 * to {p, at, len} where a double-click lands on an empty row, `note.erase` to a note's id where one lands on a note, `note.move` to
 * {id, at, p} and `note.length` to {id, len} where a drag lets go. Each is the clip's notes rewritten, as a tool's press is. */
const NOTE_HANDS = ['note.draw', 'note.erase', 'note.move', 'note.length']

/** One gesture of the roll's hand on the clip read whole: its notes rewritten. Pure; a gesture it cannot read throws in words. */
export function noteHand(key: string, whole: LiveClipWholeReading, value: Value): tools.ToolNote[] {
  // Each note copied whole, every field read (its deviation, release velocity and expression too): the owner gives back what it is
  // not told to change (DLW build ruling 2026-11-09, 46c item 8).
  const notes: tools.ToolNote[] = (whole.notes ?? []).map(n => ({...n}))
  const of = (): Record<string, unknown> => { try { const o = JSON.parse(String(value)); return o && typeof o === 'object' ? o : {} } catch { return {} } }
  const id = (v: unknown) => { const n = Number(v); if (!Number.isInteger(n)) throw new Error('The roll named no note.'); return n }
  const at = (v: unknown) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error('The roll gave no place in the clip.'); return n }
  switch (key) {
    case 'note.draw': { const o = of(); return tools.drawNote(notes, at(o.p), at(o.at), at(o.len)) }
    case 'note.erase': return tools.eraseNote(notes, id(value))
    case 'note.move': { const o = of(); return tools.moveNote(notes, id(o.id), at(o.at), at(o.p)) }
    case 'note.length': { const o = of(); return tools.lengthenNote(notes, id(o.id), at(o.len)) }
    default: throw new Error(`${key} is no gesture of the roll`)
  }
}

/** Where a Live clip's source is kept: the DLW's record beside the set (packages/live-set sources.rs), read with the clip by its owner. */
export const LIVE_SOURCE_KEPT = 'the DLW\'s record beside the set (packages/live-set sources.rs), read with the clip by the set\'s owner (kernel live_clip_read)'

/** A Live clip's source (manual §21.1 The Clip panel: "Constellation — The clip's source when Live made it of a constellation, as a sample is
 * an audio clip's"), as the set's owner reads it with the clip (O-I #768): the constellation's ref the DLW's record keeps for it (Live made
 * it of that constellation, live/constellationClip.ts), or none; unread while the clip is not read whole, where the owner could not read
 * the record (its words), or where it reports no source at all (an owner older than the record). Pure. */
export function liveSourceOf(whole: LiveClipWholeReading | null, unread: string | null = null): ClipSource {
  if (!whole) return {made: 'unread', why: `The clip is not read whole yet${unread ? `: ${unread}` : ''}, so its constellation is not named.`}
  if (typeof whole.source === 'string' && whole.source) return {made: 'of', ref: whole.source, by: LIVE_SOURCE_KEPT}
  if (whole.sourceRefused) return {made: 'unread', why: `The set's owner could not read the clip's source: ${whole.sourceRefused}`}
  if (whole.source === null) return {made: 'none', by: LIVE_SOURCE_KEPT}
  return {made: 'unread', why: 'The set\'s owner reports no source for its clips: the kernel serving this set is older than the DLW\'s record of a clip\'s source.'}
}

/** clip:live's wiring on the set's owner: where the clip is read whole, every setting, tool and Mixer envelope writes to it; where it
 * is not (no set path, the kernel out of reach), each says why. Its source is the one the owner reads with the clip (liveSourceOf). */
export function liveWiring(address: LiveClipAddress | null, whole: LiveClipWholeReading | null, hostId: string, unread: string | null,
  sends: readonly LiveSend[] | null = null): ClipWiring {
  return withMadeOf(clipWiring(address, whole, hostId, unread, sends), liveSourceOf(whole, unread))
}

function clipWiring(address: LiveClipAddress | null, whole: LiveClipWholeReading | null, hostId: string, unread: string | null,
  sends: readonly LiveSend[] | null): ClipWiring {
  const why = !address ? 'No clip of an open set is selected.' : !whole ? `The clip is not read whole yet${unread ? `: ${unread}` : ''}.` : null
  const acts: Record<string, (value: Value) => Promise<void>> = {}
  const refused: Record<string, string> = {...REFUSED}
  const write = (change: Parameters<typeof writeLiveClip>[3]) => writeLiveClip(address!.path, address!.track, address!.at, change).then(() => undefined)
  for (const key of SETTINGS) {
    if (why) refused[key] = why
    else acts[key] = value => write({set: {[key]: key === 'root' ? Number(value) : value}})
  }
  for (const key of SAMPLE_SETTINGS) {
    if (why) refused[key] = why
    else if (!playsSample(whole!.kind)) refused[key] = 'A MIDI clip plays no sample: the Sample tab is an audio clip\'s.'
    else acts[key] = value => write({set: {[key]: key === 'gain' ? SAMPLE_GAIN.toSet(Number(value)) : value}})
  }
  if (why) refused[SAMPLE_REVERSE] = why
  else if (!playsSample(whole!.kind)) refused[SAMPLE_REVERSE] = 'A MIDI clip plays no sample: Pitch·Time\'s Reverse plays its notes backwards.'
  else acts[SAMPLE_REVERSE] = async () => { await writeLiveSetAct(address!.path, {kind: 'clip_reverse', track: address!.track, clip: address!.at}) }
  for (const key of NOTE_PRESSES) {
    if (refused[key]) continue
    if (why) { refused[key] = why; continue }
    if (whole!.kind !== 'midi') { refused[key] = 'An audio clip holds no notes.'; continue }
    acts[key] = async () => {
      const result = toolPress(key, whole!, viewHoldsOf(hostId))
      if ('refused' in result) throw new Error(result.refused)
      await write({notes: result.notes, ...(result.set ? {set: result.set} : {})})
    }
  }
  for (const key of NOTE_HANDS) {
    if (why) { refused[key] = why; continue }
    if (whole!.kind !== 'midi') { refused[key] = 'An audio clip holds no notes.'; continue }
    acts[key] = async value => { await write({notes: noteHand(key, whole!, value)}) }
  }
  const sendsOf = sendEnvelopes(sends)
  for (const [key, mixer] of Object.entries({...MIXER_ENVELOPES, ...sendsOf})) {
    if (why) { refused[key] = why; continue }
    acts[key] = async value => {
      const rows = typeof value === 'string' ? JSON.parse(value) as [number, number][] : []
      await write({envelopes: [{device: 'Mixer', parameter: mixer.parameter, points: rows.map(([at, v]) => [at, mixer.toSet(v)])}]})
    }
  }
  if (!Object.keys(sendsOf).length) {
    const none = why ?? (sends ? 'This part sends nowhere: the set has no return track.' : 'The set\'s owner reports no sends for this part.')
    refused['env.mixer.sendA'] = none
    refused['env.mixer.send*'] = none
  }
  if (why) refused.colour = why
  else acts.colour = async value => {
    const index = liveColourIndex(value)
    if (index === null) throw new Error('A Live clip\'s colour is one of Live\'s 70 palette colours.')
    await write({set: {colourIndex: index}})
  }
  return {
    reads: {
      name: 'the clip\'s name (the set\'s owner)', colour: 'the clip\'s own colour, its palette index in Live\'s palette (the set\'s owner); until read whole, its track\'s colour (the tracks pane)',
      'set.root': 'the set\'s mode in force: its root (the kernel\'s mode catalogue)', 'set.mode': 'the set\'s mode in force: its lens mode, where it is one of the seven',
      notes: 'the clip\'s notes (the set\'s owner)',
      mpe: 'each note\'s pressure and bend as the set keeps them beside the note (the set\'s owner; live/liveWrites.ts liveClipMpe)', 'env.mixer.*': 'the clip\'s own Volume, Pan and Send envelopes (the set\'s owner)',
      ...Object.fromEntries(SETTINGS.map(key => [key, 'the clip\'s own setting (the set\'s owner, packages/live-set/src/edit.rs)'])),
      ...Object.fromEntries(SAMPLE_SETTINGS.map(key => [key, 'the audio clip\'s own setting, as Live keeps it (the set\'s owner, packages/live-set/src/edit.rs)'])),
      bpm: 'the tempo the clip\'s warp markers keep its sample at, in beats a minute: none where they keep more than one (the set\'s owner, packages/live-set/src/edit.rs sample_bpm)',
      units: 'what the clip\'s markers and fades are in: seconds of its sample while it is unwarped, beats once warped (the set\'s owner)',
      placed: 'whether the clip is placed on the Arrangement (its fades are its own) or launched from a slot (its Fade switch)',
    },
    acts,
    view: VIEW,
    refused,
    absent: {playhead: 'the transport\'s playhead is not read into Clip view'},
  }
}

/** The static wiring with no clip read (the design's key census, tests). */
export const LIVE_WIRING: ClipWiring = liveWiring(null, null, '', null)

/** An audio clip lacks the notes' tabs and the MIDI tools (manual §21.1: "Sample, for an audio clip, instead of Notes and MPE"). */
export const AUDIO_LACKS: readonly string[] = ['notes', 'mpe', 'pitch', 'transform', 'generate']
/** A MIDI clip lacks the Sample tab: it plays no sample. */
export const MIDI_LACKS: readonly string[] = ['sample']
/** What each kind of clip lacks of the design, by the kind the set's document names. */
const LACKS_OF_KIND: Readonly<Record<string, readonly string[] | undefined>> = {audio: AUDIO_LACKS, midi: MIDI_LACKS}

export interface LiveClipInput {
  readonly set: SetSummary | null
  readonly document: SetDocument | null
  readonly selection: SetSelection
  readonly mode: ModeInForce
  readonly colour?: string | null
  /** The clip whole, from the set's owner, and its refusal; absent where nothing reads it. */
  readonly whole?: LiveClipWholeReading | null
  readonly unread?: string | null
  /** The wiki's constellations, which name the clip's source (owners/constellations.ts). */
  readonly constellations?: readonly Constellation[] | null
}

/** The clip's ref: its track and its place, as the selection names it. */
export const liveClipRef = (selection: SetSelection): string =>
  `live:${selection.track}:${selection.clip !== undefined ? `arrangement:${selection.clip}` : `slot:${selection.scene ?? 'none'}`}`

/** Live's clip binding: the clip the selection names in the open set, or null when it names none. Pure. */
export function liveClipBinding(input: LiveClipInput): ClipBinding | null {
  const clip = liveClipOf(input.set, input.document, input.selection)
  if (!clip) return null
  const ref = liveClipRef(input.selection)
  const at = clipAtOf(input.selection)
  const address = input.set?.path && at ? {path: input.set.path, track: input.selection.track, at} : null
  const whole = input.whole ?? null
  // The part's sends, as the set's owner reads its mixer row: the Send envelopes Clip view offers.
  const mixer = input.document?.tracks[input.selection.track]?.mixer
  const sends = mixer ? mixer.sends ?? [] : null
  const source = liveSourceOf(whole, input.unread ?? null)
  // The grid's own id for the clip (als:<set>#track/<i>/slot/<s>, shell/liveSelection.ts): the clip menu finds this binding by it (walk #857).
  const held = liveWorldSelection(input.selection, input.set)?.ref
  return clipBinding({mode: 'live', ref, values: {...liveClipValues(clip, input.mode, input.colour, whole, sends), ...madeOfValues(source, input.constellations)},
    wiring: liveWiring(address, whole, clipHostId('live', ref), input.unread ?? null, sends),
    placed: clip.at !== null, lacks: clip.kind ? LACKS_OF_KIND[clip.kind] : undefined, ...(held ? {clip: held} : {})})
}

/** The selected Live clip's binding. */
export function useLiveClip(): ClipBinding | null {
  const {live} = useDetailReading()
  const selected = useSelectedClip()
  const {mode} = useLiveModeInForce()
  useViewHoldsVersion()
  const set = live.ctx?.set ?? null
  const at = clipAtOf(live.selection)
  const whole = useLiveClipWhole(set?.path ?? null, at ? live.selection.track : null, at)
  const wiki = useConstellations()
  return liveClipBinding({set, document: live.document, selection: live.selection, mode, colour: selected.track?.color, whole: whole.clip, unread: whole.error,
    constellations: wiki.registers > 0 ? wiki.rows : null})
}
