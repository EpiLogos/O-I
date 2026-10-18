// The Thread (DLW §19.4, software-factory:thread) on its owners (lane BF2): the conversation of one session — the Agent's Full
// (§19.3 "The full Agent is the thread") and a device of its own beside the Agent on the session's chain. Its stream is the reading
// the shell's thread pane already draws: AIKit's encounter view of the session (shell.openThread → AgentThreadView →
// AgentLayer → encounter/session.ts useEncounterSession, `aikit session-space encounter {action: view}`), one shared observer per
// session, so the pane and this device never poll twice. The rows are the Agent's own `thread` key and shape (one binding feeds
// both devices); the sessions to choose from are the agency reading's tracks (AgentSessionsProvider).
//
// Real shapes, read 16 Oct 2026 through the installed owner (`aikit session-space -C Work/O-I encounter --request-json
// '{"action":"view",…}'`, 12 O-I sessions; scratch lane-bf2/shapes/encounter-view-*.json): blocks [{id, kind, text}] with kinds
// user · assistant · tool · completed · error (thinking · permission · provider-notice · cancelled also in the cradle's vocabulary,
// encounter/operations.ts:27-36); a tool block's text is the provider's JSON — pi-rpc `{type: tool_execution_start|update|end,
// toolCallId, toolName, args, partialResult?, result?}` several blocks per call, ACP `{sessionUpdate, toolCallId, title, kind,
// status, locations, content}` (operations.ts:46-58) — or a piece of a payload the view split; an error's text is
// `{"Failed":{"reason":…}}`; `connection.state` is Resident · Disconnected · Released · TurnInFlight; `actions` carry each verb's
// standing with the owner's reason ("There is no active provider turn").
//
// Owners write, faces read: Approve answers the owner's pending consent request (encounter `permission`), Hard stop cancels the
// session's provider turn (encounter `cancel`), and the composer's words and Input go the Agent's own way (designBindings.ts
// agentBinding: the steer line or the next task) — "Enter sends by input". Retry, Diff, Tell parent and Voice have no owner
// operation for one session, so they stand disabled with the operation they lack. The view's own keys (pin, the shown session, the
// filters) are held by the shell (DesignBinding.local); choosing a session moves THE selection. Pure.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import type {EncounterAction, EncounterReading, EncounterStatus, NativePermission, PermissionDecision} from '../../../../../../desktop/cradle/src/encounter/client'
import {describePermission} from '../../../../../../desktop/cradle/src/agent/chat/PermissionCard'
import type {AgentSessionTrack} from '../agentRunModel'
import {holdView, viewHolds, type ChainHolds} from './designBindings'
import {familyFaceDevice} from './mainTrackBindings'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)

export const THREAD_DESIGN = 'software-factory:thread'
/** The Thread's id on the door: one Thread for the session chain, the Agent's Full and the rail. */
export const THREAD_DEVICE_ID = 'factory:thread'

/** The Thread as a device of the runtime: Software Factory's admitted thread face (softwareFactoryFamilyManifest.ts; designKey(
 * 'software-factory', 'thread') is the design's id). Its values are its design's, from the binding below; it declares no rows of the
 * address table (none is addressed to it). Null when the family does not admit the face. */
export function threadDevice(): DeviceInstance | null {
  return familyFaceDevice(THREAD_DEVICE_ID, 'software-factory', 'thread', 'Thread', 'session')
}

// ---------------------------------------------------------------------------------------------------------------- the rows

/** One row of the stream, as the Thread and the Agent read `thread` (software-factory__thread.tsx:10-13). */
export interface ThreadRow {
  readonly who?: string
  readonly kind: 'you' | 'agent' | 'tool' | 'proposal' | 'text'
  readonly text: string
  readonly tool?: string
  readonly out?: string
  readonly state?: 'runs' | 'waits'
}

const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)
const firstLine = (text: string) => clip(text.split('\n').map(line => line.trim()).find(Boolean) ?? '', 160)
const parse = (text: string): Obj | null => {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null
  try { const value = JSON.parse(trimmed) as unknown; return isObj(value) ? value : null } catch { return null }
}

/** A tool's output as the provider reported it: its text parts (pi `result`/`partialResult` `{content: [{type, text}]}`, ACP `content`
 * `[{content: {text}}]`), else undefined. Clipped for the row; the pane's Activity keeps the whole. */
function outputOf(value: unknown): string | undefined {
  if (typeof value === 'string') return str(value) && clip(value.trim(), 600)
  const parts = Array.isArray(value) ? value : isObj(value) && Array.isArray(value.content) ? value.content : []
  const text = parts.flatMap(part => {
    if (typeof part === 'string') return [part]
    if (!isObj(part)) return []
    const own = str(part.text) ?? (isObj(part.content) ? str(part.content.text) : undefined)
    return own ? [own] : []
  }).join('\n').trim()
  return text ? clip(text, 600) : undefined
}

/** What a call is about: the argument a person reads it by (a command, a path, a pattern), else the first one given. */
function argumentOf(args: unknown): string | undefined {
  if (!isObj(args)) return undefined
  for (const key of ['command', 'path', 'file_path', 'pattern', 'url', 'query']) { const value = str(args[key]); if (value) return firstLine(value) }
  const first = Object.values(args).find(value => str(value) !== undefined) as string | undefined
  return first ? firstLine(first) : undefined
}

interface Call {readonly id?: string; readonly tool?: string; readonly text?: string; readonly out?: string; readonly ended: boolean}

/** One tool block as the provider reported it, under either shape the owner carries. Null: not the provider's JSON (a piece of a
 * payload the view split). */
function callOf(text: string): Call | null {
  const value = parse(text)
  if (!value) return null
  if (typeof value.type === 'string' && value.type.startsWith('tool_execution')) {
    return {id: str(value.toolCallId), tool: str(value.toolName), text: argumentOf(value.args), out: outputOf(value.result ?? value.partialResult), ended: value.type === 'tool_execution_end'}
  }
  if (value.sessionUpdate === 'tool_call' || value.sessionUpdate === 'tool_call_update' || typeof value.toolCallId === 'string') {
    const locations = Array.isArray(value.locations) ? value.locations : []
    const path = isObj(locations[0]) ? str(locations[0].path) : undefined
    return {id: str(value.toolCallId), tool: str(value.kind), text: str(value.title) ? firstLine(String(value.title)) : path ?? argumentOf(value.rawInput),
      out: outputOf(value.content ?? value.rawOutput), ended: value.status === 'completed' || value.status === 'failed'}
  }
  return {ended: true, text: firstLine(text)}
}

/** A provider failure in the owner's words (`{"Failed":{"reason":…}}`), else the block's own first line. */
function failureOf(text: string): string {
  const value = parse(text)
  const failed = value && isObj(value.Failed) ? str(value.Failed.reason) : undefined
  return failed ? firstLine(failed) : firstLine(text)
}

/** The consent requests that wait, as the owner reports them on the view. */
export const pendingPermissions = (reading: Pick<EncounterReading, 'permissions'> | undefined): NativePermission[] =>
  Array.isArray(reading?.permissions) ? reading!.permissions! : []

/** The session's stream as the Thread's rows, in the order the owner recorded it: your messages, the agent's, one row per tool call
 * (its blocks merged by the provider's call id — runs while the owner reports the turn in flight and the call has not ended, waits
 * while a consent request names it), the provider's failures and stops, then each consent request that waits as a proposal. Thinking,
 * answered consent, notices of a turn's end are the pane's Activity, not items of the Thread's stream (§17.10 "What the stream
 * holds"). Nothing is inferred: a call the owner never closed while no turn runs carries no state. */
export function threadRowsOf(reading: Pick<EncounterReading, 'blocks' | 'permissions'>, status: EncounterStatus | undefined, agent: string | null): ThreadRow[] {
  const inFlight = status?.state === 'TurnInFlight' || status?.state === 'InterruptRequested'
  const pending = pendingPermissions(reading)
  const asked = new Set(pending.flatMap(request => (request.tool_call_id ? [request.tool_call_id] : [])))
  const rows: (ThreadRow & {call?: string; ended?: boolean; at?: number})[] = []
  const calls = new Map<string, number>()
  let completed = -1
  reading.blocks.forEach((block, at) => {
    switch (block.kind) {
      case 'user': rows.push({who: 'you', kind: 'you', text: block.text}); break
      case 'assistant': rows.push({...(agent ? {who: agent} : {}), kind: 'agent', text: block.text}); break
      case 'tool': {
        const call = callOf(block.text)
        if (!call) { if (block.text.trimStart().startsWith('{')) rows.push({kind: 'tool', text: firstLine(block.text), ended: true}); break }
        const index = call.id ? calls.get(call.id) : undefined
        if (index === undefined) {
          if (call.id) calls.set(call.id, rows.length)
          rows.push({kind: 'tool', text: call.text ?? '', ...(call.tool ? {tool: call.tool} : {}), ...(call.out ? {out: call.out} : {}), call: call.id, ended: call.ended, at})
        } else {
          const was = rows[index]!
          rows[index] = {...was, text: was.text || call.text || '', ...(was.tool || !call.tool ? {} : {tool: call.tool}), ...(call.out ? {out: call.out} : {}),
            ended: was.ended || call.ended, at}
        }
        break
      }
      case 'error': rows.push({who: 'error', kind: 'text', text: failureOf(block.text)}); break
      case 'cancelled': rows.push({who: 'stopped', kind: 'text', text: firstLine(block.text) || 'Stopped.'}); break
      case 'completed': completed = at; break
      default: break
    }
  })
  const out: ThreadRow[] = rows.map(({call, ended, at, ...row}) => {
    if (row.kind !== 'tool') return row
    if (call && asked.has(call)) return {...row, state: 'waits'}
    return !ended && inFlight && (at ?? -1) > completed ? {...row, state: 'runs'} : row
  })
  for (const request of pending) {
    const said = describePermission(request)
    out.push({...(agent ? {who: agent} : {}), kind: 'proposal', text: `${agent ?? 'The agent'} ${said.wants}`, ...(said.target ? {tool: clip(said.target, 80)} : {})})
  }
  return out
}

/** A session's rows as the `thread` value key (the Agent's and the Thread's), or undefined while its conversation is unread. */
export function threadJson(observed: {readonly reading?: EncounterReading; readonly status?: EncounterStatus} | undefined, agent: string | null): string | undefined {
  const reading = observed?.reading
  return reading && Array.isArray(reading.blocks) ? JSON.stringify(threadRowsOf(reading, observed?.status, agent)) : undefined
}

/** The light of a session's conversation, from the owner's connection state: a resident provider (or a turn in flight) is on; a
 * session disconnected or released is off; anything else is not read. */
export function threadLight(status: EncounterStatus | undefined): 'lit' | 'dark' | 'unknown' {
  const state = status?.state
  return state === 'Resident' || state === 'TurnInFlight' || state === 'InterruptRequested' ? 'lit' : state === 'Disconnected' || state === 'Released' ? 'dark' : 'unknown'
}

/** The sessions the Session chooser offers (software-factory__thread.tsx:14 `sessions`): each agency session (a SessionSpace group is
 * not a conversation), named by the owner's purpose, its agent from the roster, its turns from the task record. The reading discloses
 * no session parent (agentRunModel.ts GROUP_DISCLOSURE) and no model, so neither is given. */
export function sessionRowsOf(tracks: readonly AgentSessionTrack[]): Record<string, Value>[] {
  return tracks.filter(track => !track.group).map(track => ({
    id: track.sessionRef,
    ...(track.purpose ? {name: track.purpose} : {}),
    ...(track.agentName ? {agent: track.agentName} : {}),
    ...(typeof track.budget.used === 'number' ? {used: track.budget.used} : {}),
    ...(typeof track.budget.max === 'number' ? {cap: track.budget.max} : {}),
  }))
}

// ---------------------------------------------------------------------------------------------------------------- the binding

const missing = (what: string, op: string, owner: string) => `${what}: no owner operation carries it yet — missing op: ${op} (${owner}).`

export const THREAD_REFUSE = {
  light: 'The light is a reading: AIKit\'s encounter reports whether the session\'s provider is resident; nothing here turns it.',
  retry: missing('Retry', 'a retry of one session\'s task from its last good step (AIKit\'s encounter has no retry verb; harness_agent_control restart addresses the whole bound harness)', 'AIKit'),
  diff: missing('Diff', 'a proposal\'s diff read through the kernel', 'AIKit'),
  tellParent: missing('Tell parent', 'a stall handed to the parent session (the agency reading discloses no session parent)', 'AIKit'),
  voice: 'Voice: dictation lands in the thread pane\'s composer (the transport\'s Record); the Thread holds no capture of its own.',
  noConsent: 'No consent request waits: AIKit reports none for this session.',
  pinned: 'This Thread is pinned to another session; your words go to the chain\'s Agent. Unpin it to talk here.',
  notChain: 'This Thread shows a session the chain\'s Agent does not stand for; your words go to the chain\'s Agent. Select this session to talk here.',
  noSession: 'No session is shown: select one in the Session pane.',
} as const

/** The keys whose refusal is fixed by name (the host draws each control disabled with its reason). */
export const THREAD_REFUSED: Readonly<Record<string, string>> = {light: THREAD_REFUSE.light, retry: THREAD_REFUSE.retry, diff: THREAD_REFUSE.diff,
  tellParent: THREAD_REFUSE.tellParent, voice: THREAD_REFUSE.voice}

/** The owner's standing of one encounter verb, from the view's own `actions` (`aikit.encounter.<name>`): its reason when disabled. */
export function verbStanding(reading: Pick<EncounterReading, 'actions'> | undefined, name: string): string | null {
  const action: EncounterAction | undefined = reading?.actions?.find(item => item.ref === `aikit.encounter.${name}`)
  if (!action) return reading ? `AIKit's encounter offers no ${name} for this session.` : 'The session\'s conversation is not read yet.'
  return action.enabled ? null : action.reason ?? `AIKit's encounter has ${name} disabled for this session.`
}

/** The view's own keys and the shell's starting value of each (§17.10's defaults: Follows, Collapsed, Linked, All). */
const VIEW_DEFAULTS: Readonly<Record<string, Value>> = {pin: false, toolRows: 'lines', subagents: 'linked', messages: 'all'}

export interface ThreadInput {
  /** THE selection's session, as the thread pane resolves it (AgentThreadView.tsx threadTrackOf); null when none. */
  readonly selected: string | null
  /** The session the chain's Agent stands for (where the composer's words go). */
  readonly chainSession: string | null
  /** The agency tracks (null: the sessions are not read). */
  readonly tracks: readonly AgentSessionTrack[] | null
  /** The instant the tracks were read at (AgentSessionsProvider nowUnixMs). */
  readonly nowUnixMs: number
  /** The shown session's observation (the encounter store's state), null while none is read. */
  readonly encounter: {readonly reading?: EncounterReading; readonly status?: EncounterStatus} | null
  /** The Agent's values: the composer, Input and interrupt timing are the Agent's own (one binding feeds both devices). */
  readonly agent: Values
  readonly holds: ChainHolds
}

/** The session the Thread shows: its pinned session, else the selection's. `id` keys the view's holds: the Factory Thread's own, or the
 * page an Agent carries elsewhere (oneAgentBinding.ts; Central's Agent holds its thread page under its own id). */
export function shownSession(input: Pick<ThreadInput, 'selected' | 'holds'>, id: string = THREAD_DEVICE_ID): string | null {
  const view = viewHolds(input.holds, id)
  return view.pin === true && typeof view.session === 'string' ? view.session : input.selected
}

const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

/** The Thread's values: each key from the owner that reports it, the Agent's shared keys, and the view's own. */
export function threadValues(input: ThreadInput, id: string = THREAD_DEVICE_ID): Values {
  const values: Record<string, Value> = {}
  const shown = shownSession(input, id)
  const view = viewHolds(input.holds, id)
  for (const [key, value] of Object.entries(VIEW_DEFAULTS)) values[key] = view[key] ?? value
  put(values, 'selected', input.selected)
  if (shown == null) return values
  values.session = shown
  values.light = threadLight(input.encounter?.status)
  const track = input.tracks?.find(item => item.sessionRef === shown && !item.group)
  // The needle: seconds since the session's last check-in on the temporal reading; -1 when it was read and there is none.
  if (track?.needle) put(values, 'age', track.needle.atUnixMs == null ? -1 : Math.max(0, Math.round((input.nowUnixMs - track.needle.atUnixMs) / 1000)))
  for (const key of ['input', 'quantize', 'draft', 'sent'] as const) put(values, key, input.agent[key])
  if (input.tracks) values.sessions = JSON.stringify(sessionRowsOf(input.tracks))
  put(values, 'thread', threadJson(input.encounter ?? undefined, track?.agentName ?? null))
  return values
}

/** The owner acts the Thread carries for its shown session: the encounter's permission and cancel (absent: not observed), and the
 * shell's selection. */
export interface ThreadPorts {
  readonly permission?: (requestId: string, decision: PermissionDecision) => Promise<void>
  readonly cancel?: () => Promise<void>
  /** Move THE selection to a session (the shell's own, AgentShellContext setSelectedTrackId). */
  readonly select: (sessionRef: string) => void
}

const AGENT_KEYS = new Set(['draft', 'sent', 'input', 'quantize'])
const THREAD_WRITES = new Set([...AGENT_KEYS, 'approve', 'hardStop', 'retry', 'diff', 'tellParent', 'voice', 'light'])

/** The Thread's binding: its values; the composer, Input and timing through the Agent's binding; Approve and Hard stop to the shown
 * session's encounter; the view's keys held here; every act no owner carries refused by name. */
export function threadBinding(input: ThreadInput, agent: Pick<DesignBinding, 'write'> | null, ports: ThreadPorts, id: string = THREAD_DEVICE_ID): DesignBinding {
  const shown = shownSession(input, id)
  const reading = input.encounter?.reading
  const consent = pendingPermissions(reading)[0]
  const standing: Record<string, Standing> = Object.fromEntries(Object.entries(THREAD_REFUSED).map(([key, why]) => [key, {disabled: why}]))
  const consentWhy = !consent ? THREAD_REFUSE.noConsent : verbStanding(reading, 'permission')
  if (consentWhy) standing.approve = {disabled: consentWhy}
  const stopWhy = shown == null ? THREAD_REFUSE.noSession : verbStanding(reading, 'cancel')
  if (stopWhy) standing.hardStop = {disabled: stopWhy}
  if (shown != null && shown !== input.chainSession) standing.sent = {disabled: viewHolds(input.holds, id).pin === true ? THREAD_REFUSE.pinned : THREAD_REFUSE.notChain}
  const hold = (key: string) => (value: Value | undefined) => holdView(id, key, value)
  return {
    id,
    values: threadValues(input, id),
    standing,
    local: {
      // Pinned, the Thread keeps the session it shows; unpinned, it follows the selection again.
      pin: value => { holdView(id, 'session', value === true ? shown ?? undefined : undefined); holdView(id, 'pin', value === true) },
      session: value => hold('session')(typeof value === 'string' ? value : undefined),
      selected: value => { if (typeof value === 'string' && value) ports.select(value) },
      toolRows: hold('toolRows'), subagents: hold('subagents'), messages: hold('messages'),
    },
    writes: key => THREAD_WRITES.has(key),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (AGENT_KEYS.has(key)) {
          if (key === 'sent' && standing.sent?.disabled) throw Error(standing.sent.disabled)
          if (!agent?.write) throw Error('The chain\'s Agent is not drawn on its owner here, so nothing carries the composer.')
          await agent.write([{key, value}])
          continue
        }
        if (key === 'approve') {
          if (consentWhy || !consent || !ports.permission) throw Error(consentWhy ?? THREAD_REFUSE.noConsent)
          // Approve is the harness's own allow (PermissionCard.tsx: the choices it offers, "This time" first) — never an invented one.
          const allow = consent.choices.find(choice => choice.kind === 'allow_once') ?? consent.choices.find(choice => choice.kind?.startsWith('allow'))
          if (!allow) throw Error('The consent request offers no allow choice; answer it in the thread pane.')
          await ports.permission(consent.native_request_id, {outcome: 'selected', option_id: allow.option_id})
          continue
        }
        if (key === 'hardStop') {
          if (stopWhy || !ports.cancel) throw Error(stopWhy ?? 'The session\'s conversation is not observed here.')
          await ports.cancel()
          continue
        }
        throw Error(THREAD_REFUSED[key] ?? `${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
