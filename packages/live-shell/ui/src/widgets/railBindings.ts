// The rail-born devices' readings mapped onto their designs' value keys (widgets/railDevices.tsx publishes the devices; the designs
// are inhabitants/catalogue/panels/widgets__<id>.tsx). Pure: each takes the owner's own reading and returns the design's values, a
// key the owner did not report left out, never filled in.
import type {DesignBinding, Value, ValueChange} from '../frame/devices/designed'
import type {TrailStop} from '../../../../../desktop/cradle/src/workspace/store'
import type {CentralGroundReading} from '../../../../../desktop/cradle/src/central/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {closeNowClearing} from '../central/devices/nowsClose'
import type {TapeRow} from '../../../../../desktop/cradle/src/agent/tape/model'
import type {WikiNode} from '../../../../../desktop/cradle/src/techne/wikiReading'

export const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

/** The Trail's binding (widgets__trail.tsx): the book's stops oldest first, as the book keeps them; the place you stand on; a stop's
 * return is the shell's own move (the mode it was in, then the same thing selected — shell/TrailWidget.tsx returnTo). */
export function trailValues(stops: readonly TrailStop[] | undefined, here: string | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (stops) put(values, 'stops', JSON.stringify(stops.map(stop => ({mode: stop.mode, surfaceKind: stop.surfaceKind, surfaceRef: stop.surfaceRef,
    label: stop.label, ...(stop.position !== undefined ? {position: stop.position} : {}), ...(typeof (stop as {at?: unknown}).at === 'number' ? {at: (stop as {at: number}).at} : {})}))))
  put(values, 'here', here)
  return values
}

/** One changed file as the Diff design reads it (widgets__diff.tsx): Central's DiffFile (desktop/cradle/src/git/diffModel.ts) by its
 * own fields — the new path, A/M/D, the lines added and removed (absent where Central counts none: a binary file), the patch. */
export function diffFilesOf(document: unknown): {files: Record<string, Value>[]; head: string | null; omitted: number} | null {
  const reading = document as {schema?: unknown; files?: unknown; head_sha?: unknown; omitted_files?: unknown} | null
  if (!reading || reading.schema !== 'central.git-diff/v1' || !Array.isArray(reading.files)) return null
  const files = reading.files.flatMap((file): Record<string, Value>[] => {
    const f = file as {new_path?: unknown; status?: unknown; adds?: unknown; dels?: unknown; patch?: unknown}
    if (typeof f.new_path !== 'string' || typeof f.status !== 'string') return []
    const row: Record<string, Value> = {path: f.new_path, status: f.status}
    if (typeof f.adds === 'number') row.adds = f.adds
    if (typeof f.dels === 'number') row.dels = f.dels
    if (typeof f.patch === 'string') row.patch = f.patch
    return [row]
  })
  return {files, head: typeof reading.head_sha === 'string' ? reading.head_sha : null, omitted: typeof reading.omitted_files === 'number' ? reading.omitted_files : 0}
}

const FETCH = /^(fetch|web_fetch)$/i
/** A read that fetched a page (the tape's own rule, model.ts: a `fetch` call, or a tool named fetch or web_fetch, is a read). */
export const isFetch = (row: TapeRow): boolean => row.verb === 'read' && (row.calls.some(call => FETCH.test(call.name ?? '')) || /^https?:\/\//i.test(row.detail ?? row.object))
/** A path the seat's repository holds, as the diff names it: relative to its root where it stands under it. */
const relative = (path: string, root: string | null) => (root && path.startsWith(`${root.replace(/\/$/, '')}/`) ? path.slice(root.replace(/\/$/, '').length + 1) : path)

/** The Files binding's tree (widgets__files.tsx `files`): each file the tape read or edited once, its verb the strongest (an edit over a
 * read), its lines added and removed where the seat's diff counts them (DiffFile adds, dels). Newest last, as the tape runs. */
export function filesOf(rows: readonly TapeRow[], diff: readonly Record<string, Value>[], root: string | null): Record<string, Value>[] {
  const counts = new Map(diff.map(file => [String(file.path), file]))
  const byPath = new Map<string, Record<string, Value>>()
  for (const row of rows) {
    if ((row.verb !== 'read' && row.verb !== 'edit') || isFetch(row)) continue
    const path = relative(row.detail ?? row.object, root)
    if (!path) continue
    const held = byPath.get(path)
    const verb = held?.verb === 'edit' || row.verb === 'edit' ? 'edit' : 'read'
    const entry: Record<string, Value> = {path, verb}
    const counted = counts.get(path)
    if (verb === 'edit' && counted) { if (typeof counted.adds === 'number') entry.adds = counted.adds; if (typeof counted.dels === 'number') entry.dels = counted.dels }
    byPath.set(path, entry)
  }
  return [...byPath.values()]
}

/** What a call's output said, as text lines: a string as it is, a content list's text parts, else nothing (never a dump). */
export function outputLines(output: unknown): string[] {
  const text = (value: unknown): string => typeof value === 'string' ? value
    : Array.isArray(value) ? value.map(text).filter(Boolean).join('\n')
    : value && typeof value === 'object' && typeof (value as {text?: unknown}).text === 'string' ? (value as {text: string}).text
    : value && typeof value === 'object' && 'content' in value ? text((value as {content: unknown}).content) : ''
  const said = text(output)
  return said ? said.split('\n') : []
}
const clock = (ms: number | undefined) => { if (ms === undefined) return undefined; const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

/** The Web binding's pages (widgets__web.tsx `pages`), newest first: each fetched page's address, its title (the tape's object), when,
 * and the text the agent got. `used` — the passages it used — no owner reports, so it stays absent. */
export interface WebPage {readonly url: string; readonly title: string; readonly at?: string; readonly lines?: readonly string[]}
export function pagesOf(rows: readonly TapeRow[]): WebPage[] {
  return rows.filter(isFetch).map((row): WebPage => {
    const call = row.calls[row.calls.length - 1], at = clock(row.startedAt), lines = outputLines(call?.output)
    return {url: row.detail ?? row.object, title: row.object, ...(at ? {at} : {}), ...(lines.length ? {lines} : {})}
  }).reverse()
}

/** The pages as the design reads them (widgets__wiki.tsx `pages`): each node's ref, title and type, in the wiki's own order. */
export const wikiPagesOf = (nodes: readonly WikiNode[]): Record<string, Value>[] =>
  nodes.map(node => ({ref: node.ref, ...(node.title ? {title: node.title} : {}), ...(node.type ? {type: node.type} : {})}))

/** NOWs' Close (§23.6; W2): the clearing open in Full — the design sets `close` to its now_ref — closed through Central's
 * `central.now.lifecycle`, the person's press the kernel carries (central/devices/nowsClose.ts closeNowClearing), on the revision the
 * ground's listing gives the clearing and on the placement policy's revision (the ground's `placement` leg is central.work.policy).
 * Only `close` writes; `machine` and `open` are the hand's. With no kernel carrier, Close stands disabled in its words; every other
 * refusal is Central's, or nowsClose's own words for what has not answered. Pure: the close is handed in (railDevices.tsx hands
 * closeNowClearing), so this module stays type-only in its imports. */
export function nowsCloseWrites(transport: KernelTransportStatus | undefined, ground: CentralGroundReading | null, close: typeof closeNowClearing): Pick<DesignBinding, 'write' | 'writes' | 'standing'> {
  const carrier = !transport || transport.kind === 'unavailable' ? `Close: no kernel carrier stands, so Central's central.now.lifecycle cannot be asked${transport?.kind === 'unavailable' && transport.reason ? ` — ${transport.reason}` : ''}.` : null
  return {
    writes: key => key === 'close',
    ...(carrier ? {standing: {close: {disabled: carrier}}} : {}),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key !== 'close') throw Error(`${key} is a reading: its owner reports it; nothing here changes it.`)
        if (carrier || !transport) throw Error(carrier ?? 'Close: no kernel carrier stands.')
        await close(transport, value, ground?.now.data?.records ?? null, ground?.placement.state === 'ready' ? ground.placement.data : null)
      }
    },
  }
}

/** The NOWs binding (widgets__nows.tsx) from the ground's one reading (desktop/cradle/src/central/client.ts readGround, Central's
 * `inspect`): the civil date and time and the policy's timezone; the Day's own lifecycle; the clearings as the listing states them —
 * an archived one is closed and does not show. A part the ground refused is absent, its words the reason when nothing stands. */
export function nowsValues(ground: CentralGroundReading): Record<string, Value> {
  const values: Record<string, Value> = {}
  const time = ground.time.state === 'ready' ? ground.time.data : undefined
  if (time) {
    put(values, 'day', time.civil_date)
    put(values, 'time', `${time.civil_date}T${time.local_time}`)
    put(values, 'timezone', time.policy.timezone)
  }
  const day = ground.day.state === 'ready' ? ground.day.data : undefined
  put(values, 'dayState', typeof day?.temporal.lifecycle === 'string' ? day.temporal.lifecycle : undefined)
  const listing = ground.now.state === 'ready' ? ground.now.data : undefined
  if (listing) put(values, 'nows', JSON.stringify(listing.records.filter(row => row.lifecycle !== 'archived').map(row => ({
    now_ref: row.now_ref, purpose: row.purpose, lifecycle: row.lifecycle, participant_refs: row.participant_refs, created_at_unix_seconds: row.created_at_unix_seconds}))))
  if (!time && !listing) put(values, 'reason', ground.time.error?.message ?? ground.now.error?.message ?? 'The ground did not answer')
  return values
}

/** No calendar provider is installed (widgets__calendar.tsx: "no calendar provider, feed or panel exists in the shell"): every reading
 * is absent, and the reason says so. The tile's own keys (range, calendar, this work) are view holds. */
export const CALENDAR_ABSENT = 'No calendar provider is installed: a calendar comes from a provider outside O:I, and none has been added.'

// ---------------------------------------------------------------------------------------------------------------- Notifications

/** Notifications (design package D10, §23.9; widgets:notifications): a monitor. Its requests and the host's notification capabilities are
 * Central's `personal.notify` (ctrl/src/personal.rs; connector-sdk notification.rs), which is not in Central's installed action list, and
 * no owner keeps the requests (T-COVERAGE §1.5): both arrive absent naming it. What already reaches the shell as an owner's reading of what
 * needs you is read from its own device, never derived again here: the agents that wait for you or have stalled are Messages' (its
 * `agents`, each in the state its occupant's run reports: agent/devices/messagesBinding.ts), and what waits in Approvals is the Approvals
 * device's own queue (its source returns and the shown session's consent requests: agent/devices/receiptBindings.ts approvalsValues). */
export const NOTIFICATIONS_ABSENT = {
  requests: 'The requests are Central\'s personal.notify, which is not installed (ctrl --json action list: no personal.notify), and no owner keeps the requests it posts — missing op: personal.notify, and a reading of the requests it keeps (T-COVERAGE §1.5).',
  provider: 'Whether this computer shows notifications is personal.notify\'s UserNotification connector\'s (authorization, callback, urgency, category) — missing op: personal.notify (T-COVERAGE §1.5).',
  waiting: 'Messages has not read its agents and their runs yet (aikit gateway who --json): no count of the agents that wait for you.',
  proposals: 'No Approvals device is on the door, or it has read nothing yet: no count of what waits for you.',
} as const
/** Open: a request names what to open; with no requests read there is none. */
export const NOTIFY_OPEN_REFUSED = `Open: ${NOTIFICATIONS_ABSENT.requests}`

/** The agents that wait for you or have stalled, by Messages' own `agents` (each agent's state as its occupant's run reports it). Absent
 * where Messages listed no agents. Pure. */
export function waitingAgentsOf(agents: Value | undefined): number | undefined {
  if (typeof agents !== 'string') return undefined
  try {
    const list = JSON.parse(agents) as unknown
    return Array.isArray(list) ? list.filter(agent => !!agent && typeof agent === 'object' && ((agent as {state?: unknown}).state === 'waiting' || (agent as {state?: unknown}).state === 'stalled')).length : undefined
  } catch { return undefined }
}

/** What waits for you in Approvals, by the Approvals device's own `queue` (its pending proposals and consent requests). Absent where it read
 * none. Pure. */
export function waitingInApprovalsOf(queue: Value | undefined): number | undefined {
  if (typeof queue !== 'string') return undefined
  try { const rows = JSON.parse(queue) as unknown; return Array.isArray(rows) ? rows.length : undefined } catch { return undefined }
}

/** Notifications' values: Messages' and Approvals' counts where their devices read them, and now on the strip (minutes after midnight, the
 * view's own clock). The requests and the provider stay absent (NOTIFICATIONS_ABSENT). Pure. */
export function notificationsValues(input: {readonly messagesAgents: Value | undefined; readonly approvalsQueue: Value | undefined; readonly nowMinutes: number}): Record<string, Value> {
  const values: Record<string, Value> = {}
  put(values, 'waiting', waitingAgentsOf(input.messagesAgents))
  put(values, 'proposals', waitingInApprovalsOf(input.approvalsQueue))
  put(values, 'now', input.nowMinutes)
  return values
}

/** Notifications' binding: its values (notificationsValues) with the view's own holds laid over the manual's defaults (Show All, Follow On:
 * §23.9 Parameters), Messages ▸ and Approvals ▸ as the shell's own moves (opening writes nothing to any owner), and a request's Open refused
 * naming personal.notify until a request stands. Pure. */
export function notificationsBinding(id: string, input: Parameters<typeof notificationsValues>[0], holds: Readonly<Record<string, Value | undefined>>,
  hands: {readonly local: Readonly<Record<string, (value: Value | undefined) => void>>; readonly messages: () => void; readonly approvals: () => void}): DesignBinding {
  const values: Record<string, Value> = {...notificationsValues(input), show: 'all', follow: true, opened: '[]'}
  for (const [key, value] of Object.entries(holds)) put(values, key, value)
  return {id, values, standing: {open: {disabled: NOTIFY_OPEN_REFUSED}},
    local: {...hands.local, messages: () => hands.messages(), approvals: () => hands.approvals()},
    writes: key => key === 'open',
    write: async () => { throw new Error(NOTIFY_OPEN_REFUSED) }}
}
