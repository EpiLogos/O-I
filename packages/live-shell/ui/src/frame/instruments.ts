// The instruments a pane can hold (FOUNDATION F2, manual §10.2): every admitted pane kind that is NAMED here as an
// instrument, marked as the browser shows it, plus the lenses the hosted Expressions stage carries (the frame's own Canvas,
// Timeline, Journey and Palace — PORT-AUDIT M8 routes them). A table, never a branch: a new instrument docks by
// registering its module and naming itself here. A pane kind that is not named is not an instrument and is not listed — the
// full-size device pane (`projection.device`) holds a device the rack already shows, and opens from that device, not from here.
import {admittedProjectionKinds} from '../../../../../desktop/cradle/src/surface/projectionModules'
import type {IconName} from '../inhabitants/sdk/icons'
import type {HostedLens} from '../shell/paneInstrument'

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
  'projection.timeline': {label: 'Session · Arrangement', mark: 'session', note: 'The tracks of this work as a grid of clips, or along one ruler (Tab moves between them)'},
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
