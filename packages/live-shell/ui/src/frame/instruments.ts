// The instruments a pane can hold (FOUNDATION F2, manual §10.2): every admitted pane kind that is NAMED here as an
// instrument, marked as the browser shows it, plus the lenses the hosted Expressions stage carries (the frame's own Canvas,
// Timeline, Journey and Palace — PORT-AUDIT M8 routes them). A table, never a branch: a new instrument docks by
// registering its module and naming itself here. A pane kind that is not named is not an instrument and is not listed — the
// full-size device pane (`projection.device`) holds a device the rack already shows, and opens from that device, not from here.
// The set's tracks are not an instrument either: they are Session view and Arrangement view (manual §10.2), never a pane.
import {admittedProjectionKinds} from '../../../../../desktop/cradle/src/surface/projectionModules'
import type {IconName} from '../inhabitants/sdk/icons'
import type {HostedLens} from '../shell/paneInstrument'
import type {KeptRackSummary, TorusKeptSummary} from '../../../../expressions-boundary/src/performanceBasis'

export interface InstrumentEntry {
  /** The pane kind the instrument opens as. */
  kind: string
  label: string
  mark: IconName
  /** What it is for, in one line (the row's tooltip). */
  note: string
  /** A lens of the hosted stage: the entry opens the stage and turns it to this lens. */
  lens?: HostedLens
  /** What opening it does with the subject held now (THE selection), `{subject}` standing for its words; absent when it opens
   * where it was. The Graph turns to the held subject as it opens (techne/subject/graphFocus.ts, G2). */
  holds?: string
}

const NAMED: Readonly<Record<string, Omit<InstrumentEntry, 'kind'>>> = {
  'projection.expressions': {label: 'Expressions stage', mark: 'expr', note: 'The living field: the open Expression, its scenes and their sound'},
  'projection.earth': {label: 'Earth', mark: 'earth', note: 'Your world on the Earth, under its sky, in the field of worlds'},
  'projection.constellation': {label: 'Graph', mark: 'orbit', note: 'The same material laid out by connection, coloured by what each thing is',
    holds: 'It opens on {subject}, where the Graph draws it.'},
}

/** What opening an entry does with the held subject, in words; null when it does nothing with it or nothing is held. */
export function heldSubjectWords(entry: Pick<InstrumentEntry, 'holds'>, held: {title: string} | null | undefined): string | null {
  return entry.holds && held?.title ? entry.holds.replace('{subject}', held.title) : null
}

/** The hosted stage's lenses (the frame's own instruments). */
export const STAGE_LENSES: readonly InstrumentEntry[] = [
  {kind: 'projection.expressions', lens: 'canvas', label: 'Canvas', mark: 'form', note: 'Think out loud: throw ideas down, cluster them, draw what joins them'},
  {kind: 'projection.expressions', lens: 'timeline', label: 'Timeline', mark: 'arrangement', note: 'History beside the work that studied it, on one ruler from deep time to this morning'},
  {kind: 'projection.expressions', lens: 'journey', label: 'Journey', mark: 'journey', note: 'An ordered walk through places, moments and things'},
  // The stage's Palace lens retired with the frame's Palace (b5a935661): a palace is a place on the world you enter — the Earth
  // (its M5 plate, M4's Locations, the browser's World › Palaces), never a separate surface (FOUNDATION N4).
]

/** Every instrument a pane can hold now: the admitted kinds that are named instruments, then the stage's lenses. */
export function instrumentEntries(): InstrumentEntry[] {
  const kinds = admittedProjectionKinds()
  return [
    ...kinds.filter(kind => Object.hasOwn(NAMED, kind)).map(kind => ({kind, ...NAMED[kind]})),
    ...(kinds.includes('projection.expressions') ? STAGE_LENSES : []),
  ]
}

// A stage lens is not a pane kind of its own: it opens the stage and turns it. So the lens travels with the kind in one
// payload — `projection.expressions#canvas` — wherever the instrument goes: the row's open, and the drag into a pane.
const LENS_MARK = '#'

/** The payload an entry carries when it is opened or dragged: its kind, and after `#` the stage lens it turns the stage to. */
export function instrumentPayload(entry: Pick<InstrumentEntry, 'kind' | 'lens'>): string {
  return entry.lens ? `${entry.kind}${LENS_MARK}${entry.lens}` : entry.kind
}

/** The kind and the stage lens a payload names. A lens the stage does not carry is not a lens: it is dropped, and the kind
 * opens as it is. */
export function parseInstrumentPayload(payload: string): {kind: string; lens?: HostedLens} {
  const at = payload.indexOf(LENS_MARK)
  if (at < 0) return {kind: payload}
  const kind = payload.slice(0, at), named = payload.slice(at + 1)
  const lens = STAGE_LENSES.find(entry => entry.kind === kind && entry.lens === named)?.lens
  return lens ? {kind, lens} : {kind}
}

// What you keep, under the Torus (O-I #852, manual §21.2 Sounds and instruments): a sound stands under the Torus in the browser's
// Instruments as Live keeps a device's presets; an instrument (a body made from a form) stands under it with its sounds under it; a
// rack stands as a rack. Each drags onto a part to play it, carrying what the part plays by the Scene's own references. The records are
// the Scene performance's, as its owner lists them (expressions-boundary performanceBasis.ts listPerformance); none is kept here.

/** The drag type a kept sound, instrument or rack travels by, onto a part. */
export const TORUS_KEPT_MIME = 'application/x-oi-torus-kept'
export type TorusKeptKind = 'sound' | 'instrument' | 'rack'
/** What a rack's drop places on the part (O-I #852 round 9: Live's Instrument Rack, packages/live-set/src/acts.rs `rack_place`): its name,
 * its chain's devices, its macros with where each stands and what it turns, and its variations, as the Scene keeps them. */
export interface TorusRackPlacing {readonly name: string; readonly chain: KeptRackSummary['chain']; readonly macros: KeptRackSummary['macros']
  readonly variations: KeptRackSummary['variations']}
/** What a part is given to play: the sound, the instrument or the rack by its reference; a sound made on an instrument names it too. An
 * instrument carries the first sound made on it, and a rack the sound its Torus opens with: the sound the part opens. A rack carries what
 * it places on the part, too. */
export interface TorusKeptDrag {readonly kind: TorusKeptKind; readonly ref: string; readonly instrument_ref?: string; readonly sound?: string
  readonly rack?: TorusRackPlacing}
export interface TorusKeptRow {
  readonly key: string
  readonly kind: TorusKeptKind
  /** 1 under the Torus; 2 under an instrument. */
  readonly depth: 1 | 2
  readonly name: string
  readonly meta: string
  /** What the row says it holds, and how it plays (its tooltip). */
  readonly title: string
  /** The drag payload (TORUS_KEPT_MIME). */
  readonly payload: string
}

const KEPT_WORDS: Readonly<Record<TorusKeptKind, string>> = {
  sound: 'a sound: every parameter of the Torus, its body and its tuning, as they stood. Drag it onto a part to play it.',
  instrument: 'an instrument: a body made from a form, with the sounds made on it. Drag it onto a part to play it; the same pulse plays it.',
  rack: 'a rack: the Torus with its note devices and effects, its macros and their variations. Drag it onto a part to play it.',
}
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** The kept rows under the Torus, in the manual's order: its sounds, then each instrument followed by the sounds made on it, then the
 * racks. The search keeps a row whose name holds it, and an instrument with a sound that does. Pure. */
export function torusKeptRows(kept: TorusKeptSummary | null | undefined, query: string): TorusKeptRow[] {
  if (!kept) return []
  const needle = query.trim().toLowerCase()
  const hit = (name: string) => !needle || name.toLowerCase().includes(needle)
  const row = (kind: TorusKeptKind, depth: 1 | 2, key: string, name: string, meta: string, drag: TorusKeptDrag): TorusKeptRow =>
    ({key, kind, depth, name, meta, title: `${name} — ${KEPT_WORDS[kind]}`, payload: JSON.stringify(drag)})
  const rows: TorusKeptRow[] = []
  for (const sound of kept.sounds) if (hit(sound.name)) rows.push(row('sound', 1, sound.sound_ref, sound.name, 'sound', {kind: 'sound', ref: sound.sound_ref}))
  for (const instrument of kept.instruments) {
    const sounds = instrument.sounds.filter(sound => hit(sound.name) || hit(instrument.name))
    if (!sounds.length && !hit(instrument.name)) continue
    const first = instrument.sounds[0]?.sound_ref
    rows.push(row('instrument', 1, instrument.instrument_ref, instrument.name, `instrument · ${count(instrument.sounds.length, 'sound')}`,
      first ? {kind: 'instrument', ref: instrument.instrument_ref, sound: first} : {kind: 'instrument', ref: instrument.instrument_ref}))
    for (const sound of sounds) rows.push(row('sound', 2, `${instrument.instrument_ref}/${sound.sound_ref}`, sound.name, 'sound',
      {kind: 'sound', ref: sound.sound_ref, instrument_ref: instrument.instrument_ref}))
  }
  for (const rack of kept.racks) if (hit(rack.name)) {
    const placing: TorusRackPlacing = {name: rack.name, chain: rack.chain, macros: rack.macros, variations: rack.variations}
    rows.push(row('rack', 1, rack.rack_ref, rack.name, `rack · ${count(rack.macros.length, 'macro')} · ${count(rack.variations.length, 'variation')}`,
      rack.sound ? {kind: 'rack', ref: rack.rack_ref, sound: rack.sound, rack: placing} : {kind: 'rack', ref: rack.rack_ref, rack: placing}))
  }
  return rows
}

/** Live's rack: sixteen macros (racks-session-model.md §1.7); a kept rack's bounds beside them (kernel kept.rs). */
const RACK_MACROS = 16, RACK_VARIATIONS = 128, RACK_DEVICES = 64, MACRO_TARGETS = 32
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value)
const share = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
const exact = (raw: unknown, keys: readonly string[]): raw is Record<string, unknown> => !!raw && typeof raw === 'object' && !Array.isArray(raw)
  && Object.keys(raw).length === keys.length && keys.every(key => key in raw)
/** A rack's placing, exact, or null: every row what it says, within the rack's bounds, a value for every macro in each variation. */
function readRackPlacing(raw: unknown): TorusRackPlacing | null {
  if (!exact(raw, ['name', 'chain', 'macros', 'variations']) || !text(raw.name)) return null
  const {chain, macros, variations} = raw
  if (!Array.isArray(chain) || chain.length > RACK_DEVICES || !Array.isArray(macros) || macros.length > RACK_MACROS
    || !Array.isArray(variations) || variations.length > RACK_VARIATIONS) return null
  if (!chain.every(row => exact(row, ['device_ref', 'role']) && text(row.device_ref) && (row.role === 'note' || row.role === 'effect'))) return null
  if (!macros.every(row => exact(row, ['name', 'value', 'targets']) && text(row.name) && share(row.value) && Array.isArray(row.targets)
    && row.targets.length <= MACRO_TARGETS && row.targets.every(target => exact(target, ['device_ref', 'parameter']) && text(target.device_ref) && text(target.parameter)))) return null
  if (!variations.every(row => exact(row, ['name', 'values']) && text(row.name) && Array.isArray(row.values) && row.values.length === macros.length
    && row.values.every(share))) return null
  return {name: raw.name, chain, macros, variations} as TorusRackPlacing
}

/** A kept drag, exact, or null: a part plays only a sound, an instrument or a rack named by its reference. Only a sound names the
 * instrument it was made on; only an instrument or a rack carries the sound it opens; a rack always carries what it places, exactly. */
export function readTorusKeptDrag(payload: string): TorusKeptDrag | null {
  let raw: unknown
  try { raw = JSON.parse(payload) } catch { return null }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const {kind, ref, instrument_ref: on, sound, rack: placed, ...rest} = raw as Record<string, unknown>
  if (Object.keys(rest).length || (kind !== 'sound' && kind !== 'instrument' && kind !== 'rack') || typeof ref !== 'string' || !ref) return null
  if (on !== undefined && (kind !== 'sound' || typeof on !== 'string' || !on)) return null
  if (sound !== undefined && (kind === 'sound' || typeof sound !== 'string' || !sound)) return null
  if ((kind === 'rack') !== (placed !== undefined)) return null
  if (kind === 'rack') {
    const rack = readRackPlacing(placed)
    if (!rack) return null
    return sound === undefined ? {kind, ref, rack} : {kind, ref, sound: sound as string, rack}
  }
  if (on !== undefined) return {kind, ref, instrument_ref: on as string}
  return sound === undefined ? {kind, ref} : {kind, ref, sound: sound as string}
}
