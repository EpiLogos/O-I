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

/** The Trail's binding (widgets__trail.tsx): the book's stops oldest first, as the book keeps them, and the stop you stand on; a stop's
 * return is the shell's own walk (shell/TrailWidget.tsx returnToStop). The design keys a stop by its ref, and one place can stand at
 * several stops (the same document in Central, then in Technē), so each stop is keyed by its place on the trail: `here` is the stop
 * the book stands on (WorldContext.trailAt, else the newest), and a press names the stop it was. */
export function trailValues(stops: readonly TrailStop[] | undefined, standing: number | null): Record<string, Value> {
  const values: Record<string, Value> = {}
  if (stops) put(values, 'stops', JSON.stringify(stops.map((stop, index) => ({mode: stop.mode, surfaceKind: stop.surfaceKind, surfaceRef: String(index),
    label: stop.label, ...(stop.position !== undefined ? {position: stop.position} : {}), ...(typeof stop.at === 'number' ? {at: stop.at} : {})}))))
  if (stops?.length && standing !== null && standing >= 0 && standing < stops.length) put(values, 'here', String(standing))
  return values
}

/** The stop a press on the Trail's design names: its place on the trail, or null. */
export function trailIndexOf(ref: Value | undefined): number | null {
  return typeof ref === 'string' && /^\d+$/.test(ref) ? Number(ref) : null
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

/** The file Files opens (§23.2, its `open` hold) as a whole path: the tree holds paths relative to the seat's root where they stand under
 * it (filesOf), else as the tape named them. Null when there is nothing to open, or a relative path with no root read yet. Pure. */
export function openFileOf(open: Value | undefined, root: string | null): string | null {
  if (typeof open !== 'string' || !open) return null
  if (open.startsWith('/')) return open
  return root ? `${root.replace(/\/$/, '')}/${open}` : null
}

/** A whole path placed in Central's ground (the root its listings name, `central.path-ref/v1` `root`): the path the files seam lists it
 * under, its folder and its name; or why it cannot be, a file outside the ground. Pure. */
export function groundPlaceOf(path: string, root: string): {relative: string; parent: string; name: string} | {words: string} {
  const ground = root.replace(/\/$/, '')
  if (!path.startsWith(`${ground}/`)) return {words: `${path} stands outside Central's ground (${ground}); Central's file owner reads only inside it.`}
  const relative = path.slice(ground.length + 1), parts = relative.split('/')
  return {relative, parent: parts.slice(0, -1).join('/'), name: parts[parts.length - 1]!}
}

/** The agent Files and Web read (§23.2, §23.3 Follow): the selected one while Follow is on (`kept` null), else the one Follow kept, by its
 * session; a kept agent the agency reading no longer lists is said, never replaced by another. Pure. */
export function keptTrackOf<T extends {sessionRef: string}>(tracks: readonly T[], kept: string | null, followed: T | null): {track: T | null; words: string | null} {
  if (kept === null) return {track: followed, words: null}
  const track = tracks.find(candidate => candidate.sessionRef === kept) ?? null
  return {track, words: track ? null : `The agent Follow kept (${kept}) no longer stands in the agency reading. Turn Follow on to read the selected agent.`}
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
 * Central's: `personal.notify` keeps every request it is asked for with the provider's delivery or refusal, and
 * `personal.notifications.list` reads them back with the selected provider's capabilities (ctrl/src/notification.rs,
 * central.notification-ledger/v1; connector-sdk notification.rs). What already reaches the shell as an owner's reading of what needs you
 * is read from its own device, never derived again here: the agents that wait for you or have stalled are Messages' (its `agents`, each
 * in the state its occupant's run reports: agent/devices/messagesBinding.ts), and what waits in Approvals is the Approvals device's own
 * queue (its source returns and the shown session's consent requests: agent/devices/receiptBindings.ts approvalsValues). */
export const NOTIFY_LIST_ACTION = 'personal.notifications.list'
export const NOTIFICATIONS_ABSENT = {
  requests: 'Central has not answered personal.notifications.list yet: no reading of the requests personal.notify keeps.',
  provider: 'Central names no notification provider: personal.notifications.list has not answered, or no Connector implements UserNotification here.',
  waiting: 'Messages has not read its agents and their runs yet (aikit gateway who --json): no count of the agents that wait for you.',
  proposals: 'No Approvals device is on the door, or it has read nothing yet: no count of what waits for you.',
} as const
/** Open, before any request is read: a request names what to open; with none read there is none. */
export const NOTIFY_OPEN_REFUSED = `Open: ${NOTIFICATIONS_ABSENT.requests}`

const textOf = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)
const two = (n: number) => String(n).padStart(2, '0')

/** The start of the local day `at` stands in, in Unix ms: the strip runs midnight to midnight, and the list holds today's requests. */
export function dayStartMs(at: number): number {
  const day = new Date(at)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

/** One kept record (central.notification-record/v1) as the design's request: its ref, the local clock time it was asked (`at` HH:MM,
 * `time` minutes after midnight, for the strip), the request's own words, its caller as `from`, its callback as `open`, and the
 * provider's delivery (posted, its provider, what it could not show) or its refusal (rejected). Null where it is no record. Pure. */
export function notificationRequestOf(record: unknown): Record<string, Value> | null {
  const r = record as {schema?: unknown; request_ref?: unknown; requested_at_unix_ms?: unknown; request?: Record<string, unknown>; delivery?: Record<string, unknown> | null; refusal?: unknown} | null
  if (!r || r.schema !== 'central.notification-record/v1' || typeof r.request_ref !== 'string' || !r.request || typeof r.request.caller_ref !== 'string') return null
  const row: Record<string, Value> = {id: r.request_ref, from: r.request.caller_ref}
  if (typeof r.requested_at_unix_ms === 'number' && Number.isFinite(r.requested_at_unix_ms)) {
    const at = new Date(r.requested_at_unix_ms)
    row.at = `${two(at.getHours())}:${two(at.getMinutes())}`
    row.time = at.getHours() * 60 + at.getMinutes()
  }
  put(row, 'title', textOf(r.request.title))
  put(row, 'body', textOf(r.request.body))
  put(row, 'subject', textOf(r.request.subject_ref))
  put(row, 'urgency', textOf(r.request.urgency))
  put(row, 'category', textOf(r.request.category))
  put(row, 'open', textOf(r.request.callback))
  const delivery = r.delivery
  if (delivery && (delivery.state === 'posted' || delivery.state === 'rejected')) {
    const unsupported = Array.isArray(delivery.unsupported_requested_features) ? delivery.unsupported_requested_features.filter((x): x is string => typeof x === 'string') : []
    row.delivery = JSON.stringify({state: delivery.state, ...(textOf(delivery.provider) ? {provider: delivery.provider} : {}), ...(unsupported.length ? {unsupported} : {})})
  } else if (r.refusal) row.delivery = JSON.stringify({state: 'rejected'})
  return row
}

/** Central's notification ledger reading (central.notification-ledger/v1) as the design's `requests` and `provider`: the kept requests as
 * Central lists them, and the selected provider's capabilities by the design's names — or none, with Central's words, where no provider is
 * selected. Null where the document is no ledger. Pure. */
export function notificationLedgerOf(document: unknown): {requests: Record<string, Value>[]; provider: Record<string, Value> | null; providerError: string | null} | null {
  const d = document as {schema?: unknown; requests?: unknown; provider?: Record<string, unknown> | null; provider_error?: unknown} | null
  if (!d || d.schema !== 'central.notification-ledger/v1' || !Array.isArray(d.requests)) return null
  const requests = d.requests.flatMap(record => { const row = notificationRequestOf(record); return row ? [row] : [] })
  const p = d.provider
  const provider = p && typeof p === 'object' && typeof p.provider === 'string'
    ? {provider: p.provider, available: p.available === true, ...(typeof p.authorization === 'string' ? {authorization: p.authorization} : {}),
      callback: p.supports_callback === true, urgency: p.supports_urgency === true, category: p.supports_category === true}
    : null
  return {requests, provider, providerError: textOf(d.provider_error) ?? null}
}

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

/** Central's answer to personal.notifications.list, as a device holds it (central/devices/centralActions.ts ActionAnswer). */
export type NotifyLedgerAnswer = {readonly status: 'reading'} | {readonly status: 'answered'; readonly value: unknown} | {readonly status: 'refused'; readonly error: string}

/** Notifications' values: the requests Central keeps and its provider where Central answered, Messages' and Approvals' counts where their
 * devices read them, and now on the strip (minutes after midnight, the view's own clock). Pure. */
export function notificationsValues(input: {readonly messagesAgents: Value | undefined; readonly approvalsQueue: Value | undefined; readonly nowMinutes: number; readonly ledger?: NotifyLedgerAnswer}): Record<string, Value> {
  const values: Record<string, Value> = {}
  const ledger = input.ledger?.status === 'answered' ? notificationLedgerOf(input.ledger.value) : null
  if (ledger) {
    put(values, 'requests', JSON.stringify(ledger.requests))
    if (ledger.provider) put(values, 'provider', JSON.stringify(ledger.provider))
  }
  put(values, 'waiting', waitingAgentsOf(input.messagesAgents))
  put(values, 'proposals', waitingInApprovalsOf(input.approvalsQueue))
  put(values, 'now', input.nowMinutes)
  return values
}

/** Notifications' readings as Approvals carries them (DLW §23.9 "What an owner or an agent raises for you to decide, such as a routine that
 * failed or a service that stopped answering, waits in Approvals, under Requests"; the Notifications device was retired into Approvals in
 * the 22 Oct manual rewrite): each request Central keeps for personal.notify as a queue row of kind request (software-factory__approvals.tsx
 * queue: {id, kind, who, text, where, age (seconds), urgent}), Messages' waiting agents as `messages`, and the selected provider as `desktop`
 * (shown where it is available, refused where it is not). Null parts where their owner has not answered. Pure. */
export function ownerRequestsValues(input: {readonly ledger?: NotifyLedgerAnswer; readonly messagesAgents?: Value; readonly nowUnixMs: number}): {
  readonly rows: Record<string, Value>[] | null; readonly messages?: number; readonly desktop?: 'shown' | 'refused'} {
  const ledger = input.ledger?.status === 'answered' ? notificationLedgerOf(input.ledger.value) : null
  const raw = input.ledger?.status === 'answered' ? (input.ledger.value as {requests?: unknown} | null)?.requests : undefined
  const asked = new Map((Array.isArray(raw) ? raw : []).flatMap(record => {
    const r = record as {request_ref?: unknown; requested_at_unix_ms?: unknown} | null
    return r && typeof r.request_ref === 'string' && typeof r.requested_at_unix_ms === 'number' ? [[r.request_ref, r.requested_at_unix_ms] as const] : []
  }))
  const rows = ledger ? ledger.requests.map(request => {
    const id = String(request.id), at = asked.get(id)
    const text = textOf(request.title) ?? textOf(request.body)
    const where = textOf(request.subject) ?? textOf(request.open)
    return {id, kind: 'request', who: request.from as Value, ...(text ? {text} : {}), ...(where ? {where} : {}),
      ...(at !== undefined ? {age: Math.max(0, Math.round((input.nowUnixMs - at) / 1000))} : {}),
      ...(request.urgency === 'critical' || request.urgency === 'high' ? {urgent: true} : {}),
      ...(textOf(request.open) ?? textOf(request.subject) ? {open: (textOf(request.open) ?? textOf(request.subject))!} : {})}
  }) : null
  const messages = waitingAgentsOf(input.messagesAgents)
  const desktop = ledger?.provider ? (ledger.provider.available === true ? 'shown' as const : 'refused' as const) : undefined
  return {rows, ...(messages !== undefined ? {messages} : {}), ...(desktop ? {desktop} : {})}
}

/** The ids Approvals' view holds as opened here (a JSON list under its `opened` hold), or none where the hold is absent or unreadable. Pure. */
export function openedOf(hold: Value | undefined): string[] {
  if (typeof hold !== 'string') return []
  try { const ids = JSON.parse(hold) as unknown; return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [] } catch { return [] }
}

/** The ids opened here, as Approvals' view holds them (the `opened` hold openedOf reads back). Pure. */
export const openedHold = (ids: readonly string[]): string => JSON.stringify(ids)

/** An Approvals binding with Notifications' readings laid in (ownerRequestsValues): the owner's requests after the queue's own rows, the
 * waiting count and the desktop's notice. Open (software-factory__approvals.tsx: "Every item takes open, which marks it opened here and tells
 * its owner nothing") on an owner's request first opens what it names where it belongs (`open`, which refuses in its own words where the shell
 * has no route for it), and only then is the item held as opened (`kept`); on any other item it marks it opened alone. While Central has not
 * answered personal.notifications.list the requests and the desktop wait; where it refused, the desktop's notice says Central's words. Every
 * other key stays the binding's. Pure. */
export function withOwnerRequests(binding: DesignBinding, input: Parameters<typeof ownerRequestsValues>[0], open?: (target: string) => Promise<void>,
  kept?: {readonly opened: readonly string[]; readonly hold: (opened: readonly string[]) => void}): DesignBinding {
  const carried = ownerRequestsValues(input)
  const values: Record<string, Value> = {...binding.values}
  let queued: Record<string, Value>[] | null = null
  if (carried.rows || typeof values.queue === 'string') {
    let own: unknown
    try { own = typeof values.queue === 'string' ? JSON.parse(values.queue) : [] } catch { own = [] }
    const opened = new Set(kept?.opened ?? [])
    queued = [...(Array.isArray(own) ? own as Record<string, Value>[] : []), ...(carried.rows ?? [])].map(row => (opened.has(String(row.id)) ? {...row, opened: true} : row))
    values.queue = JSON.stringify(queued)
    if (carried.rows) values.light = queued.length ? 'lit' : 'dark'
  }
  put(values, 'messages', carried.messages)
  put(values, 'desktop', carried.desktop)
  const targets = new Map((carried.rows ?? []).flatMap(row => (typeof row.open === 'string' ? [[String(row.id), row.open] as const] : [])))
  const owners = new Set((carried.rows ?? []).map(row => String(row.id)))
  const standing = {...(binding.standing ?? {})}
  if (input.ledger?.status === 'refused') standing.desktop = {disabled: `The owners' requests and the desktop's notice: ${input.ledger.error}`}
  const waiting = input.ledger?.status === 'reading' ? [...(Array.isArray(binding.waiting) ? binding.waiting : []), 'desktop'] : binding.waiting
  return {...binding, values, standing, ...(waiting !== undefined ? {waiting} : {}),
    writes: key => key === 'open' || (binding.writes ? binding.writes(key) : !!binding.write),
    write: async (changes: readonly ValueChange[]) => {
      const rest: ValueChange[] = []
      for (const change of changes) {
        if (change.key !== 'open') { rest.push(change); continue }
        const id = String(change.value)
        if (!queued?.some(row => String(row.id) === id)) throw new Error(`Open: no item ${id} waits in Approvals.`)
        if (owners.has(id)) {
          const target = targets.get(id)
          if (!target) throw new Error('Open: the request names nothing to open (no callback, no subject).')
          if (!open) throw new Error(`Open: the shell has no hand that opens ${target}.`)
          await open(target)
        }
        const opened = kept?.opened ?? []
        kept?.hold(opened.includes(id) ? opened : [...opened, id])
      }
      if (rest.length) {
        if (!binding.write) throw new Error(`${rest[0]!.key}: a reading — the owner reports it, and nothing here changes it.`)
        await binding.write(rest)
      }
    }}
}

/** Why Open cannot act: Central's own words where it refused the reading, or that it has not answered. */
export function notifyOpenRefusal(ledger: NotifyLedgerAnswer | undefined): string {
  if (ledger?.status === 'refused') return `Open: no reading of the requests — ${ledger.error}`
  if (ledger?.status === 'answered' && !notificationLedgerOf(ledger.value)) return 'Open: Central\'s answer to personal.notifications.list is no central.notification-ledger/v1 reading.'
  return NOTIFY_OPEN_REFUSED
}

/** Notifications' binding: its values (notificationsValues) with the view's own holds laid over the manual's defaults (Show All, Follow On:
 * §23.9 Parameters), Messages ▸ and Approvals ▸ as the shell's own moves, and a request's Open: the shell opens the request's `open`
 * target, or its subject, where it belongs (`hands.open`, which refuses in its own words where the shell has no route for it), and only
 * then holds it as opened here. Opening writes nothing to any owner. Pure. */
export function notificationsBinding(id: string, input: Parameters<typeof notificationsValues>[0], holds: Readonly<Record<string, Value | undefined>>,
  hands: {readonly local: Readonly<Record<string, (value: Value | undefined) => void>>; readonly messages: () => void; readonly approvals: () => void;
    readonly open?: (target: string) => Promise<void>}): DesignBinding {
  const values: Record<string, Value> = {...notificationsValues(input), show: 'all', follow: true, opened: '[]'}
  for (const [key, value] of Object.entries(holds)) put(values, key, value)
  const read = values.requests !== undefined
  const refusal = notifyOpenRefusal(input.ledger)
  return {id, values, ...(read ? {} : {standing: {open: {disabled: refusal}}}),
    ...(input.ledger?.status === 'reading' ? {waiting: ['requests', 'provider']} : {}),
    local: {...hands.local, messages: () => hands.messages(), approvals: () => hands.approvals()},
    writes: key => key === 'open',
    write: async changes => {
      for (const change of changes) {
        if (change.key !== 'open') continue
        if (!read) throw new Error(refusal)
        let rows: unknown
        try { rows = JSON.parse(values.requests as string) } catch { rows = [] }
        const request = (Array.isArray(rows) ? rows : []).find(row => (row as {id?: unknown}).id === change.value) as Record<string, unknown> | undefined
        if (!request) throw new Error(`Open: Central keeps no request ${String(change.value)} today.`)
        const target = textOf(request.open) ?? textOf(request.subject)
        if (!target) throw new Error('Open: the request names nothing to open (no callback, no subject).')
        if (!hands.open) throw new Error(`Open: the shell has no hand that opens ${target}.`)
        await hands.open(target)
        let opened: unknown
        try { opened = JSON.parse(typeof values.opened === 'string' ? values.opened : '[]') } catch { opened = [] }
        const ids = Array.isArray(opened) ? opened.filter((x): x is string => typeof x === 'string') : []
        hands.local.opened?.(JSON.stringify(ids.includes(request.id as string) ? ids : [...ids, request.id as string]))
        hands.local.selected?.(request.id as string)
      }
    }}
}
