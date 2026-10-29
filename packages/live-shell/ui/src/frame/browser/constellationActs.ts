// The acts on a constellation in the browser (O-I #742; manual §10.3 the browser, §10.9 "Everything you can select acts as its counterpart
// in Live … Right-click it … its menu lists what you can do to it"; §17.4 "Remove a card and the thing stays"; §3 "it links to each of
// them"). The browser's Constellations rows open to what the selected constellation holds — its members, each with the passage it was
// gathered by, its connections, and the Expressions returned to it — and each row's menu holds that thing's acts. Every act is the Wiki
// owner's, through the kernel (desktop/cradle/src/knowledge/constellationActs.ts: `aikit.constellation.apply` at the revision read), and
// the register is read again after it so the browser, the Form and the reader read what the owner now holds. Opening a member opens its
// source in the reader at its span; its time and place open the reader's own time-and-place editor on it; a returned Expression reopens
// in Expressions. Pure, apart from the dispatches at the end.
import type {ObjectMenuItem} from '../menu/useObjectMenu'
import type {Constellation} from '../../owners/constellations'
import {DIRECTIONS, STANDINGS, notMade, type ConstructionConnection, type ConstructionMember, type ConstructionReading}
  from '../../../../../../desktop/cradle/src/knowledge/constellationActs'
import type {FactsSubject} from '../../../../../../desktop/cradle/src/knowledge/wikiFacts'
import type {WikiAnchor} from '../../../../../../desktop/cradle/src/knowledge/wikiDocument'

/** What the browser holds of the selected constellation's construction. */
export type ConstructionState =
  | {readonly state: 'reading'}
  | {readonly state: 'read'; readonly reading: ConstructionReading}
  /** The register holds no constellation you made round this whole (a space's own, or a form it declares). */
  | {readonly state: 'none'}
  | {readonly state: 'unread'; readonly reason: string}

/** An inline edit the list stands open for: a new constellation in a space, or a constellation's or a connection's words. */
export type RowEdit =
  | {readonly kind: 'new'; readonly row: Constellation}
  | {readonly kind: 'title' | 'question'; readonly row: Constellation}
  | {readonly kind: 'meaning'; readonly row: Constellation; readonly connection: ConstructionConnection}

/** The acts a row's menu runs; the list binds them to the owner and the reader. */
export interface RowActs {
  edit(edit: RowEdit): void
  open(member: ConstructionMember | Constellation['members'][number], row: Constellation): void
  facts(subject: FactsSubject, row: Constellation, title: string): void
  showInGraph(row: Constellation): void
  remove(member: ConstructionMember, row: Constellation): void
  connection(connection: ConstructionConnection, row: Constellation, change: {direction?: string; standing?: string} | null): void
  reopen(item: ConstructionReading['compositions'][number], row: Constellation): void
}

const sep = (id: string): ObjectMenuItem => ({id, type: 'separator'})
const madeOf = (state: ConstructionState): ConstructionReading | null => (state.state === 'read' ? state.reading : null)
const notYet = (state: ConstructionState, row: Constellation): string =>
  state.state === 'reading' ? `${row.title}'s register is being read.` : state.state === 'unread' ? `${row.title}'s register was not read: ${state.reason}` : notMade(row.title)

/** A constellation row's menu: New constellation on a space; Rename and Edit question on one you made; its time and place; Show in graph. */
export function constellationMenu(row: Constellation, state: ConstructionState, acts: RowActs): ObjectMenuItem[] {
  const made = madeOf(state)
  const why = made ? undefined : notYet(state, row)
  return [
    ...(row.space ? [{id: 'new', label: `New constellation in ${row.title}`, onSelect: () => acts.edit({kind: 'new', row})} as ObjectMenuItem, sep('s-new')] : []),
    {id: 'rename', label: 'Rename', ...(made ? {onSelect: () => acts.edit({kind: 'title', row})} : {disabled: true, why})},
    {id: 'question', label: 'Edit question', ...(made ? {onSelect: () => acts.edit({kind: 'question', row})} : {disabled: true, why})},
    sep('s-facts'),
    {id: 'facts', label: 'Time and place…', onSelect: () => acts.facts(made ? made.frame_ref : row.ref, row, row.title)},
    {id: 'graph', label: 'Show in graph', onSelect: () => acts.showInGraph(row)},
  ]
}

/** A member row's menu: Open at its passage, its time and place in this constellation, Remove (the source stays). */
export function memberMenu(member: ConstructionMember | Constellation['members'][number], row: Constellation, state: ConstructionState, acts: RowActs): ObjectMenuItem[] {
  const made = madeOf(state)
  const own = made && 'participation_ref' in member ? member : null
  const why = own ? undefined : made ? `That member is no longer in ${row.title}.` : notYet(state, row)
  return [
    {id: 'open', label: 'Open', onSelect: () => acts.open(member, row)},
    {id: 'facts', label: 'Time and place in this constellation…',
      ...(own ? {onSelect: () => acts.facts({frame_ref: made!.frame_ref, participation_ref: own.participation_ref}, row, own.label)} : {disabled: true, why})},
    sep('s-remove'),
    {id: 'remove', label: 'Remove from constellation', tone: 'destructive', ...(own ? {onSelect: () => acts.remove(own, row)} : {disabled: true, why})},
  ]
}

/** A connection row's menu: its meaning renamed, its direction and its standing chosen, or the connection retracted. */
export function connectionMenu(connection: ConstructionConnection, row: Constellation, acts: RowActs): ObjectMenuItem[] {
  return [
    {id: 'meaning', label: 'Rename', onSelect: () => acts.edit({kind: 'meaning', row, connection})},
    sep('s-direction'),
    ...DIRECTIONS.map((way): ObjectMenuItem => ({id: `direction:${way.value}`, label: way.label, checked: connection.direction === way.value,
      ...(connection.direction === way.value ? {} : {onSelect: () => acts.connection(connection, row, {direction: way.value})})})),
    sep('s-standing'),
    ...STANDINGS.map((standing): ObjectMenuItem => ({id: `standing:${standing}`, label: `${standing[0]!.toUpperCase()}${standing.slice(1)}`, checked: connection.standing === standing,
      ...(connection.standing === standing ? {} : {onSelect: () => acts.connection(connection, row, {standing})})})),
    sep('s-retract'),
    {id: 'retract', label: 'Retract connection', tone: 'destructive', onSelect: () => acts.connection(connection, row, null)},
  ]
}

/** A returned Expression's menu: Open it again from its file. */
export function returnedMenu(item: ConstructionReading['compositions'][number], row: Constellation, acts: RowActs): ObjectMenuItem[] {
  return [{id: 'open', label: 'Open', onSelect: () => acts.reopen(item, row)}]
}

/** A member's words as its row says them: the passage, and where it was taken from. Pure. */
export function memberWords(member: ConstructionMember | Constellation['members'][number]): {name: string; meta: string} {
  if ('participation_ref' in member) {
    const at = member.anchor ? ` · bytes ${member.anchor.start_byte}–${member.anchor.end_byte}` : ''
    return {name: member.label, meta: `${member.subject_ref.split(/[/:]/).pop() ?? member.subject_ref}${at}`}
  }
  return {name: member.title, meta: member.position === null ? '' : `${member.position}${member.face === 'prime' ? '′' : ''}`}
}

/** A connection as its row says it: from, its meaning, to. Pure. */
export function connectionWords(connection: ConstructionConnection, reading: ConstructionReading): string {
  const label = (ref: string) => { const found = reading.members.find(member => member.participation_ref === ref)?.label ?? 'a member that left'; return found.length > 28 ? `${found.slice(0, 27)}…` : found }
  const arrow = connection.direction === 'undirected' ? '—' : connection.direction === 'bidirectional' ? '↔' : '→'
  return `${label(connection.from)} ${arrow} ${connection.relation || 'unnamed'} ${arrow} ${label(connection.to)}`
}

// ---------------------------------------------------------------------------------------------------------------- the reader's doors

/** Open a source page in the reader at a span (the Graph and source receiver, panels/knowledgeReceiver.tsx). */
export function openInReader(input: {title: string; project?: string; address: {kind: 'source' | 'wiki'; value: string}; plane: 'page' | 'graph';
  anchor?: WikiAnchor; facts?: FactsSubject}, complete: (error?: string) => void): void {
  window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {detail: {...input, complete}}))
}
