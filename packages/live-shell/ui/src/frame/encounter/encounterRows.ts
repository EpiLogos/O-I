// The encounter's four context readings — field, world, subject, occasion — as the encounter bar above the panes draws them
// (world-shell-mockup-r2.html `renderEncbar`: "field › world › subject › occasion"). They stood in the browser's aperture slot until
// W1 (T-WORLDS §3: "the context (field, world, subject, occasion) to the encounter bar"). Pure functions of readings the shell already
// holds: the focused pane (native/workbenchDoor.ts), THE selection and the selected occasion (the book's WorldContext), the World the
// host discloses (ShellConfigContext) and the World cut's civil reading (the time spine). A row no owner answers says "—" and its
// hover says why.
import type {FocusedPane} from '../../native/workbenchDoor'
import type {ShellConfig} from '../../shell/useSet'
import {civilDateOfDayRef} from '../../central/centralVertical'
import {civilDayLabel, worldName} from '../../shell/transports/transportReadings'
import type {KindShapeName} from '../../inhabitants/sdk/marks.tsx'
import type {TimeSpine} from '../../timeline/timeSpine'
import type {WorldContext} from '../../../../../../desktop/cradle/src/workspace/store'

export interface ContextRow {
  key: 'field' | 'world' | 'subject' | 'occasion'
  /** The value, or "—" when no reading names one. */
  value: string
  /** The world-coloured dot (a shell token), when the value is a world or a field. */
  dot?: string
  /** The subject's kind mark from the cut. */
  mark?: KindShapeName
  /** A standing the reading discloses (an occasion's admission). */
  standing?: string
  /** The row's Info words: where the value comes from, or why there is none. */
  info: string
}

/** THE selection's mark by its kind (WorldSelection.kind). A kind with no cut mark draws none. */
const SELECTION_MARKS: Readonly<Record<string, KindShapeName>> = {
  day: 'day', note: 'doc', doc: 'doc', file: 'doc', 'agent-session': 'agent', clip: 'occurrence', place: 'place', location: 'location',
  expression: 'expression', run: 'run',
}

/** The worlds' colours (the mockup's WORLDS hex as the shell's tokens): the person's own Central world wears the accent. */
const WORLD_DOTS: Readonly<Record<string, string>> = {central: 'var(--accent)'}
/** The field's colour (the mockup's --w-field, the shell's --sel). */
const FIELD_DOT = 'var(--sel)'

/** A civil instant as the mockup's occasion reads it ("now · 14:37", a 24-hour clock as the transport's readouts write it): the
 * spine's own instant, never the wall clock. */
export function clockOf(instantUnixMs: number): string {
  return new Date(instantUnixMs).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', hourCycle: 'h23'})
}

/** The four context rows, as pure functions of the readings. */
export function contextRows({pane, context, config, spine}: {
  pane: Pick<FocusedPane, 'worldRef' | 'fieldRef'> | null
  context: WorldContext | null | undefined
  config: Pick<ShellConfig, 'world_scope'> | null | undefined
  spine: Pick<TimeSpine, 'now' | 'occasion'> | null | undefined
}): ContextRow[] {
  const rows: ContextRow[] = []
  // The field: the shared field the pane's hosted presentation stands in (binding.presentation.field_ref).
  rows.push(pane?.fieldRef
    ? {key: 'field', value: pane.fieldRef, dot: FIELD_DOT, info: `The field this pane's presentation stands in (${pane.fieldRef}).`}
    : {key: 'field', value: '—', info: 'No reading names a shared field for this pane: a pane hosted in a field carries its field ref.'})
  // The world: a hosted presentation's own world (a projection), else the World the book stands in or the host discloses.
  const home = config?.world_scope?.world
  if (pane?.worldRef && pane.worldRef !== home) {
    rows.push({key: 'world', value: `${pane.worldRef} · projection`, dot: 'var(--text-faint)', info: `This pane presents another World (${pane.worldRef}), projected here.`})
  } else {
    const key = context?.world ?? config?.world_scope?.owner
    const name = worldName(context?.world, config)
    rows.push(name
      ? {key: 'world', value: name, dot: WORLD_DOTS[key ?? ''] ?? 'var(--text-faint)', info: `The World the encounter stands in: ${name}${home ? ` (${home})` : ''}.`}
      : {key: 'world', value: '—', info: 'Neither the book nor the host names the World yet (it is read when the native World answers).'})
  }
  // The subject: THE selection (the book's WorldContext.selection).
  const selection = context?.selection
  rows.push(selection
    ? {key: 'subject', value: selection.title, mark: SELECTION_MARKS[selection.kind], info: `THE selection: ${selection.title} — ${selection.kind} · ${selection.ref}.`}
    : {key: 'subject', value: '—', info: 'Nothing is selected. Select a row, a clip or a track; a following pane turns to it.'})
  // The occasion: the selected occasion (the World cut's retained basis, else the book's reading), else the civil Now.
  const occasion = spine?.occasion()
  const now = spine?.now()
  if (occasion) {
    const day = civilDayLabel(civilDateOfDayRef(occasion.basis.civilDayRef))
    const at = occasion.basis.instantUnixMs === null ? null : clockOf(occasion.basis.instantUnixMs)
    rows.push({key: 'occasion', value: [occasion.basis.summary ?? occasion.basis.ref, day, at].filter(Boolean).join(' · '),
      standing: occasion.admission ? (occasion.admission.admitted ? 'admitted' : 'not admitted now') : undefined,
      info: `The selected occasion, as first read (${occasion.basis.ref})${occasion.admission ? ` — ${occasion.admission.disclosure}` : ''}.`})
  } else if (context?.reading?.ref) {
    rows.push({key: 'occasion', value: context.reading.ref + (context.reading.position ? ` · ${context.reading.position}` : ''), info: `The occasion the encounter stands in (${context.reading.ref}).`})
  } else if (now) {
    const day = civilDayLabel(civilDateOfDayRef(now.dayRef))
    rows.push({key: 'occasion', value: `now · ${clockOf(now.instantUnixMs)}`, info: `The day's Now${day ? `, ${day}` : ''} — the World cut's civil reading (${now.source}${now.dayRef ? ` · ${now.dayRef}` : ''}).`})
  } else {
    rows.push({key: 'occasion', value: '—', info: 'No occasion is selected and no civil reading stands here: the Now shows when the World cut\'s temporal read answers.'})
  }
  return rows
}

/** The trail stop Back returns to and the one Forward goes on to, from the bar's cursor (the trail's index it stands at). Pure. */
export function trailSteps(length: number, cursor: number): {back: number | null; forward: number | null} {
  const at = Math.min(Math.max(cursor, 0), Math.max(length - 1, 0))
  return {back: length > 1 && at > 0 ? at - 1 : null, forward: at < length - 1 ? at + 1 : null}
}
