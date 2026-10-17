// The browser's row words (FOUNDATION F6; world-shell-mockup.html `bi()` :1478 and `renderBrowser()` :1479–1500): a row is its
// kind mark, its name in the words a person uses (.nm) and its standing on the right (.st), each word from an owner's own
// reading. A value no owner discloses is absent ('') or '—'; nothing here guesses a standing, and a size or a ref is hover
// words, never the standing. Pure TypeScript: the row bodies (shell/ModeBrowser.tsx, agent/AgentShellBrowser.tsx,
// components/BrowserPane.tsx, components/NativeExpressionCollections.tsx) read their owners and hand the readings here.
import type {DayReading} from '../../../../../../desktop/cradle/src/day/client'
import type {AgentSessionTrack} from '../../agent/agentRunModel'
import {revisionShort} from '../../central/documents/documentDoor'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** A civil date as a person says it: `2026-10-08` → `Thu 08 Oct` (the mockup's "Wed 08 Oct" grammar; its weekday is the
 * calendar's own). A civil date names a day, not an instant, so no zone enters. Null for anything that is not a real date. */
export function dayWords(civilDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(civilDate)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), date = Number(match[3])
  const at = new Date(0)
  at.setUTCFullYear(year, month - 1, date)
  if (at.getUTCFullYear() !== year || at.getUTCMonth() !== month - 1 || at.getUTCDate() !== date) return null
  return `${WEEKDAYS[at.getUTCDay()]} ${match[3]} ${MONTHS[month - 1]}`
}

/** The civil date a day record's file names (`2026-10-08.md` → `2026-10-08`); null for any other file. */
export function civilDateOfDayFile(name: string): string | null {
  return /^(\d{4}-\d{2}-\d{2})\.md$/.exec(name)?.[1] ?? null
}

/** What the owner's Day reading (`day_read`, central.day-reading/v1) says of one day, or its refusal in its own words. */
export type DayStanding =
  | {readonly state: 'read'; readonly lifecycle: string | null; readonly document: string | null; readonly revision: string | null; readonly today: boolean}
  | {readonly state: 'refused'; readonly message: string}

/** The standing of one day from the owner's own Day reading: its lifecycle (`temporal.lifecycle`, the owner's word — open,
 * closed), whether its Day document stands (`document_state`), the document's revision, and whether the owner names it today. */
export function dayStandingOf(reading: Pick<DayReading, 'day_ref' | 'temporal' | 'document_state' | 'revision' | 'today'>): DayStanding {
  const lifecycle = typeof reading.temporal?.lifecycle === 'string' && reading.temporal.lifecycle ? reading.temporal.lifecycle : null
  const revision = typeof reading.revision?.revision === 'string' && reading.revision.revision ? reading.revision.revision : null
  return {state: 'read', lifecycle, document: reading.document_state ?? null, revision, today: reading.today?.day_ref === reading.day_ref}
}

/** A day's standing in the row (the mockup's "open · r7", "closed"): the owner's lifecycle word, then the Day document's short
 * revision while the document stands. '—' when the owner refused the reading; '' while it has not answered. */
export function dayStandingWords(standing: DayStanding | undefined): string {
  if (!standing) return ''
  if (standing.state === 'refused') return '—'
  const revision = standing.document === 'ready' && standing.revision ? `r${revisionShort(standing.revision)}` : null
  return [standing.lifecycle ?? '—', revision].filter(Boolean).join(' · ')
}

/** A day's standing as hover words: what the owner's reading said, or its refusal verbatim. */
export function dayStandingHover(standing: DayStanding | undefined): string {
  if (!standing) return 'The owner\'s Day reading has not answered yet.'
  if (standing.state === 'refused') return `The owner's Day reading refused: ${standing.message}`
  const document = standing.document === 'ready' ? `its Day document stands at revision ${standing.revision ?? '(none disclosed)'}`
    : standing.document === 'uninitialised' ? 'it has no Day document yet' : 'the reading names no Day document'
  return `The owner's Day reading: ${standing.lifecycle ? `lifecycle ${standing.lifecycle}` : 'no lifecycle disclosed'}; ${document}${standing.today ? '; the owner names it today' : ''}.`
}

/** A size as hover words — a row never stands on its byte count. */
export function sizeWords(byteLen: number | null | undefined): string | null {
  if (typeof byteLen !== 'number' || !Number.isFinite(byteLen) || byteLen < 0) return null
  if (byteLen < 1024) return `${byteLen} bytes`
  if (byteLen < 1024 * 1024) return `${(byteLen / 1024).toFixed(1)} KB`
  return `${(byteLen / (1024 * 1024)).toFixed(1)} MB`
}

/** A file's name without its extension (`flow-2026-10-07-1343.html` → `flow-2026-10-07-1343`). */
export const withoutExtension = (name: string): string => name.replace(/\.[^./]+$/, '') || name

// ————————————————————————————————————————————————————————————————————————
// Flows

/** What a Flow's own payload (its `ql-doc` island, parsed by the Flow's parser, flow/instance.ts parseInstance) says for its row,
 * or why it was not read. */
export type FlowReading =
  | {readonly state: 'read'; readonly title: string | null; readonly revision: number | null; readonly agents: readonly string[]}
  | {readonly state: 'refused'; readonly message: string}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** A parsed Flow payload reduced to its row's words: `meta.title`, `meta.revision`, and the agents among `meta.participants`
 * (by name, else initial). Shapes the payload does not carry are absent, never filled. */
export function flowReadingOf(doc: unknown): FlowReading {
  const meta = isRecord(doc) && isRecord(doc.meta) ? doc.meta : null
  if (!meta) return {state: 'refused', message: 'the payload carries no meta'}
  const title = typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : null
  const revision = typeof meta.revision === 'number' && Number.isFinite(meta.revision) ? meta.revision : null
  const participants = Array.isArray(meta.participants) ? meta.participants.filter(isRecord) : []
  const agents = participants.filter(participant => participant.kind === 'agent')
    .map(participant => typeof participant.name === 'string' && participant.name.trim() ? participant.name.trim() : typeof participant.initial === 'string' ? participant.initial : '')
    .filter(Boolean)
  return {state: 'read', title, revision, agents: [...new Set(agents)]}
}

/** Names in a standing, short as the mockup's ("with Fizz"): the first, then how many more. */
function fewNames(names: readonly string[]): string {
  return names.length <= 1 ? names.join('') : `${names[0]} +${names.length - 1}`
}

/** A Flow row (the mockup's "Mercurius and the stone · with Fizz · r12"): the Flow's title from its payload, else its file name
 * without the extension; its standing the agents it is written with and its own revision. '' while unread, '—' when refused. */
export function flowRowWords(fileName: string, reading: FlowReading | undefined): {name: string; standing: string; hover: string} {
  const file = withoutExtension(fileName)
  if (!reading) return {name: file, standing: '', hover: `${fileName} — the Flow's payload has not been read yet.`}
  if (reading.state === 'refused') return {name: file, standing: '—', hover: `${fileName} — its payload was not read: ${reading.message}`}
  const standing = [reading.agents.length ? `with ${fewNames(reading.agents)}` : null, reading.revision !== null ? `r${reading.revision}` : null]
    .filter(Boolean).join(' · ')
  return {
    name: reading.title ?? file,
    standing: standing || '—',
    hover: `${fileName} — ${reading.title ? `titled “${reading.title}”` : 'its payload gives no title'}${reading.agents.length ? `, written with ${reading.agents.join(', ')}` : ''}${reading.revision !== null ? `, at its revision ${reading.revision}` : ''}.`,
  }
}

/** A Flow the owner minted is named for the minute it was made (`flow-2026-10-14-2050.html`, a same-minute collision `-2`, `-3`:
 * flow/instance.ts instanceFileName; the rank documentReadings.ts:37–55 `latestFlowOf` reads). */
const MINTED_FLOW = /^flow-(\d{4}-\d{2}-\d{2}-\d{4})(?:-(\d+))?\.html$/i

/** The Flows rows' order, newest first as the Flow pane ranks them (documentReadings.ts latestFlowOf): minted names by their minute,
 * then their collision suffix; a Flow named by hand after every minted one, by name. */
export function flowOrder(a: {readonly name: string}, b: {readonly name: string}): number {
  const left = MINTED_FLOW.exec(a.name), right = MINTED_FLOW.exec(b.name)
  if (left && right) return right[1].localeCompare(left[1]) || Number(right[2] ?? 1) - Number(left[2] ?? 1)
  if (left || right) return left ? -1 : 1
  return a.name.localeCompare(b.name)
}

// ————————————————————————————————————————————————————————————————————————
// Sessions, agents and the NOW section (agent/agentRunModel.ts readings: a session's task clips from encounter_task_read, its
// needle from the temporal read)

export type SessionWord = 'running' | 'stalled' | 'done' | 'queued' | 'idle'

/** The needle states that read as the session running now, and as stalled (agentRunModel NeedleReading). */
const NEEDLE_RUNNING: ReadonlySet<string> = new Set(['live'])
const NEEDLE_STALLED: ReadonlySet<string> = new Set(['stalled'])
const NEEDLE_IDLE: ReadonlySet<string> = new Set(['idle'])

/** A session's standing (the mockup's running / done / queued, and stalled): running when a task runs or its needle is live;
 * stalled when a task or the needle stalled; done when every task it discloses is done; queued when one waits; idle when its
 * needle shows no activity. `needleKnown` is false when the temporal read refused — then the needle says nothing. Null when no
 * reading discloses a state. */
export function sessionState(track: Pick<AgentSessionTrack, 'tasks' | 'needle'>, needleKnown = true): SessionWord | null {
  const tasks = track.tasks.filter(task => !task.softStop)
  const states = new Set(tasks.map(task => task.state))
  const needle = needleKnown ? track.needle?.state : undefined
  if (states.has('running') || (needle !== undefined && NEEDLE_RUNNING.has(needle))) return 'running'
  if (states.has('stalled') || (needle !== undefined && NEEDLE_STALLED.has(needle))) return 'stalled'
  const known = tasks.filter(task => task.state !== 'unknown')
  if (known.length && known.every(task => task.state === 'done')) return 'done'
  if (states.has('queued')) return 'queued'
  if (needle !== undefined && NEEDLE_IDLE.has(needle)) return 'idle'
  return null
}

export type AgentWord = 'working' | 'stalled' | 'idle'

/** An agent's standing over its sessions (the mockup's working / idle): working when one of them runs, stalled when one stalled,
 * idle when their states are known and none runs. Null when none of its sessions discloses a state. */
export function agentState(sessions: readonly (SessionWord | null)[]): AgentWord | null {
  if (sessions.includes('running')) return 'working'
  if (sessions.includes('stalled')) return 'stalled'
  return sessions.some(state => state !== null) ? 'idle' : null
}

/** One agency session as the NOW section reads it: the host the agency reading names for it, its agent's name, its state. */
export interface NowSession {
  readonly host: string | null
  readonly agent: string | null
  readonly state: SessionWord | null
}

export interface NowRow {
  readonly key: string
  readonly name: string
  readonly standing: string
  readonly hover: string
}

/** The host a session's space names (agency_read: `project_contexts.<project>.basis.host`), when it names one. */
export function hostOfSpace(space: unknown): string | null {
  if (!isRecord(space) || !isRecord(space.project_contexts)) return null
  for (const context of Object.values(space.project_contexts)) {
    const host = isRecord(context) && isRecord(context.basis) ? context.basis.host : null
    if (typeof host === 'string' && host) return host
  }
  return null
}

/** The machine a host names: the agency's `host/localhost` is the machine this shell's host stands on, which the World scope
 * names by its workcell (`workcell:mac` → `mac`); another `host/<name>` is that name. */
function machineOf(host: string, thisMachine: string | null): string {
  const name = host.replace(/^host\//, '')
  return name === 'localhost' && thisMachine ? thisMachine : name
}

/** The NOW section under the Days (the mockup's "mac · env-1 — live · fizz", "omarchy · herdr — quiet"): one row per machine the
 * agency reading places sessions on, standing on what runs there now — live with its agents, stalled, quiet, or '—' when no
 * session there discloses a state. `thisMachine` is the World scope's workcell (live_shell_config world_scope.workcell_ref).
 * Empty when no session names a host: the section is then absent, never invented. */
export function nowRows(sessions: readonly NowSession[], thisMachine: string | null): NowRow[] {
  const machine = thisMachine ? thisMachine.replace(/^workcell:/, '') : null
  const byMachine = new Map<string, NowSession[]>()
  for (const session of sessions) {
    if (!session.host) continue
    const name = machineOf(session.host, machine)
    byMachine.set(name, [...(byMachine.get(name) ?? []), session])
  }
  return [...byMachine].map(([name, here]) => {
    const running = here.filter(session => session.state === 'running')
    const agents = [...new Set(running.map(session => session.agent).filter((agent): agent is string => !!agent))]
    const standing = running.length
      ? `live · ${agents.length ? fewNames(agents) : `${running.length} session${running.length === 1 ? '' : 's'}`}`
      : here.some(session => session.state === 'stalled') ? 'stalled'
      : here.some(session => session.state !== null) ? 'quiet' : '—'
    const hosts = [...new Set(here.map(session => session.host))].join(', ')
    return {key: name, name, standing,
      hover: `${name} — ${here.length} agency session${here.length === 1 ? '' : 's'} on ${hosts}${machine && hosts.includes('localhost') ? ` (this host's workcell, ${thisMachine})` : ''}; ${running.length} running now.`}
  })
}
