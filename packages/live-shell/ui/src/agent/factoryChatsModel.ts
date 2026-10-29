// Factory's chats per project (DLW §19.1 "Projects and chats"; build list B3) — the pure model. Factory's browser lists the
// owner's projects and, under each, its chats: every session the owner's discovery names for that project, newest first, each
// with its agent, its state and its last exchange "as any list of chats does".
//
// Owners write, faces read. A chat is one attached session of one SessionSpace in AIKit's `session-space discover --project <P>`
// (the agency reading, owners/agency.ts; kernel `agency_read`). What the discovery does not carry is read from the owner that does,
// or stands absent with the reading that would carry it:
//   - the agent: the attachment's `agent_ref`, when the discovery names one (the roster names it). On the real O-I discovery
//     (20 Oct 2026, 11 spaces) none does; the session's agency binding (`session-space encounter-agency-read`) names one, and no
//     kernel op reads it — said on the row.
//   - the state and the last exchange: the owner's encounter view of the session (`encounter {action: view}`, the reading the
//     thread pane draws): `connection.state` (Resident · Disconnected · Released · TurnInFlight, verbatim, lower-cased) and the
//     blocks, whose last user turn and what came back are the last exchange.
//   - the time that orders them: the discovery carries none. AIKit's history gives each change to a space an instant
//     (`occurred_at_unix_ms`), which the kernel's temporal projection carries as `aikit-history` events whose subject is the space
//     (the frame's one temporal read, timeline/temporalPoll.ts, a civil week). A chat's time is the latest such instant; a chat the
//     window does not date sorts after the dated ones in the owner's order and says why it has none.
//
// Pure TypeScript. No React, no kernel calls.
import type {AgencyReading, AgencySessionRow} from '../../../../../desktop/cradle/src/agency/agencyTypes'
import type {EncounterReading} from '../../../../../desktop/cradle/src/encounter/client'
import type {CentralWorldsReading} from '../central/centralWorlds'
import {CONVERSATION_PLACE} from '../widgets/agentConversation'

/** One chat under one project: an attached session of a SessionSpace the project's discovery names. */
export interface FactoryChat {
  /** The project row it stands under (the project the discovery was asked for). */
  readonly project: string
  readonly spaceRef: string
  readonly spaceLabel: string | null
  readonly sessionRef: string
  /** The attachment's purpose: the chat's name. */
  readonly purpose: string | null
  /** The attachment's `agent_ref`, when the discovery names one. */
  readonly agentRef: string | null
  /** Every project the space belongs to, as the owner lists them (`definition.projects`). */
  readonly projects: readonly string[]
}

/** The row's own key: a space shared by two projects is two rows. */
export const chatKey = (chat: Pick<FactoryChat, 'project' | 'spaceRef' | 'sessionRef'>): string => `${chat.project}|${chat.spaceRef}:${chat.sessionRef}`
/** The session's key on the grid (agent/agentRunModel.ts trackKey): one session is one track, whatever project lists it. */
export const chatTrackKey = (chat: Pick<FactoryChat, 'spaceRef' | 'sessionRef'>): string => `${chat.spaceRef}:${chat.sessionRef}`

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null)
const projectsOf = (raw: unknown): string[] => {
  const projects = (raw as {definition?: {projects?: unknown}} | null | undefined)?.definition?.projects
  return Array.isArray(projects) ? projects.filter((project): project is string => typeof project === 'string' && !!project) : []
}

/** The chats a project's discovery names, in the owner's order: one per attached session. */
export function chatsOfAgency(project: string, reading: {readonly rows: readonly AgencySessionRow[]}): FactoryChat[] {
  return reading.rows.map(row => ({
    project,
    spaceRef: row.spaceRef,
    spaceLabel: text(row.spaceLabel),
    sessionRef: row.sessionRef,
    purpose: text(row.purpose),
    agentRef: text(row.agentRef),
    projects: projectsOf(row.raw),
  }))
}

// ---- time ------------------------------------------------------------------------------------------------------------------

/** The slice of a temporal event a chat's time reads (timeline/timeSpine.ts TemporalEventRow). */
export interface ChatEvent {
  readonly subject_ref: string
  readonly instant_unix_ms?: number | null
  readonly evidence_refs?: readonly string[]
}

/** The latest instant AIKit's history records for the chat's space: an event about the space or the session, by its subject or any
 * evidence ref it carries (the kernel's own subject rule, timeline/temporalPoll.ts eventsOfSubject). Null when none is dated. */
export function lastActivityOf(chat: Pick<FactoryChat, 'spaceRef' | 'sessionRef'>, events: readonly ChatEvent[]): number | null {
  let latest: number | null = null
  const about = (ref: string) => ref === chat.spaceRef || ref === chat.sessionRef
  for (const event of events) {
    const at = event.instant_unix_ms
    if (typeof at !== 'number' || !Number.isFinite(at)) continue
    if (!about(event.subject_ref) && !(event.evidence_refs ?? []).some(about)) continue
    if (latest === null || at > latest) latest = at
  }
  return latest
}

/** Newest first; the undated after the dated, every tie in the order the owner listed them. */
export function newestFirst(chats: readonly FactoryChat[], events: readonly ChatEvent[]): FactoryChat[] {
  return chats.map((chat, index) => ({chat, index, at: lastActivityOf(chat, events)}))
    .sort((a, b) => (a.at === null ? 1 : 0) - (b.at === null ? 1 : 0) || (b.at ?? 0) - (a.at ?? 0) || a.index - b.index)
    .map(item => item.chat)
}

const utc = (unixMs: number): string => `${new Date(unixMs).toISOString().slice(0, 16).replace('T', ' ')}Z`

// ---- one project's chats ---------------------------------------------------------------------------------------------------

/** A project's chats as its discovery answered. */
export type ProjectChats =
  | {readonly state: 'reading'}
  /** The discovery refused: the owner's words, with the project they were asked for. */
  | {readonly state: 'refused'; readonly words: string}
  | {readonly state: 'read'; readonly chats: readonly FactoryChat[]}

/** The window's standing answer for `agency_read` (owners/ownerReading.ts OwnerReading), as far as the chats need it. */
export interface AgencyAnswer {
  readonly status: 'reading' | 'answered' | 'refused'
  readonly value: AgencyReading | null
  readonly error: string | null
}

export function projectChatsOf(project: string, answer: AgencyAnswer, events: readonly ChatEvent[]): ProjectChats {
  if (answer.status === 'refused') return {state: 'refused', words: `AIKit's session-space discovery for ${project} refused — ${answer.error ?? 'with no words'}`}
  if (answer.status !== 'answered' || !answer.value) return {state: 'reading'}
  return {state: 'read', chats: newestFirst(chatsOfAgency(project, answer.value), events)}
}

// ---- the projects ----------------------------------------------------------------------------------------------------------

/** The owner's projects: Central's disclosure of its worlds (central/centralWorlds.ts), less the owner's own world. */
export type ProjectList =
  | {readonly state: 'reading'}
  | {readonly state: 'unavailable'; readonly words: string}
  | {readonly state: 'read'; readonly projects: readonly string[]}

export function projectsOfWorlds(reading: CentralWorldsReading | null | undefined): ProjectList {
  if (!reading || reading.state === 'reading') return {state: 'reading'}
  if (reading.state === 'unavailable') return {state: 'unavailable', words: reading.reason}
  const projects: string[] = []
  for (const world of reading.worlds) if (world.kind === 'project' && world.project && !projects.includes(world.project)) projects.push(world.project)
  return {state: 'read', projects}
}

// ---- what the owner's encounter view says of a chat ------------------------------------------------------------------------

/** The last exchange: the last thing the person said, what came back, and what failed, each as the owner's blocks have it. */
export interface LastExchange {
  readonly you: string | null
  readonly reply: string | null
  readonly failed: string | null
}

/** A chat as the owner's encounter view reports it — reduced to what a row shows, so nothing of the transcript is kept. */
export interface ChatGlance {
  /** `connection.state`, verbatim (Resident · Disconnected · Released · TurnInFlight …); null when the view reports no connection. */
  readonly state: string | null
  /** The provider the owner connected, named only while it is connected. */
  readonly provider: string | null
  readonly exchange: LastExchange | null
}

/** One chat's view reading in the window's owner answers. */
export type ChatGlanceReading =
  | {readonly status: 'reading'}
  | {readonly status: 'answered'; readonly glance: ChatGlance}
  | {readonly status: 'refused'; readonly error: string}

const flat = (value: string): string => value.replace(/\s+/g, ' ').trim()
const clip = (value: string, n: number): string => (value.length > n ? `${value.slice(0, n - 1)}…` : value)

/** A provider failure is `{"Failed":{"reason":…}}`: its reason is the owner's words; anything else stands as it is. */
function failureWords(raw: string): string {
  try {
    const reason = (JSON.parse(raw) as {Failed?: {reason?: unknown}} | null)?.Failed?.reason
    if (typeof reason === 'string' && reason.trim()) return flat(reason)
  } catch { /* not JSON: the block's own text */ }
  return flat(raw)
}

export function glanceOfView(view: Pick<EncounterReading, 'blocks' | 'connection'>): ChatGlance {
  const blocks = view.blocks ?? []
  let from = -1
  for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].kind === 'user') { from = i; break }
  const after = blocks.slice(from + 1)
  const lastOf = (kind: string): string | null => {
    for (let i = after.length - 1; i >= 0; i--) if (after[i].kind === kind && flat(after[i].text)) return after[i].text
    return null
  }
  const you = from >= 0 && flat(blocks[from].text) ? flat(blocks[from].text) : null
  const replyText = lastOf('assistant'), failedText = lastOf('error')
  const reply = replyText === null ? null : flat(replyText), failed = failedText === null ? null : failureWords(failedText)
  const connection = view.connection
  return {
    state: text(connection?.state),
    provider: text(connection?.provider?.label),
    exchange: you === null && reply === null && failed === null ? null : {you, reply, failed},
  }
}

// ---- a chat's words --------------------------------------------------------------------------------------------------------

/** One thing a row says: what the owner reported, or why the owner does not report it here and which reading would. */
export type Said = {readonly said: string} | {readonly absent: string}

export interface ChatWords {
  readonly label: string
  readonly agent: Said
  readonly state: Said
  readonly exchange: Said
  /** The last change AIKit's history recorded for the chat's space. */
  readonly when: Said
  readonly hover: string
}

export interface ChatWordsInput {
  readonly glance?: ChatGlance | null
  /** The owner's refusal of the view, in its words. */
  readonly glanceRefused?: string | null
  readonly activityUnixMs: number | null
  readonly roster: ReadonlyMap<string, {readonly name: string}>
}

const NO_AGENT = 'The discovery\'s attachment names no agent_ref. The session\'s agency binding (aikit session-space encounter-agency-read) names one; no kernel op reads it yet.'
const NO_TIME = 'AIKit\'s history, in the temporal reading\'s window, records no change to this chat\'s space, so it has no time here.'

const stateWord = (state: string): string => state.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()

function exchangeWords(exchange: LastExchange): string {
  return [exchange.you && `you: ${clip(exchange.you, 90)}`, exchange.reply && `reply: ${clip(exchange.reply, 90)}`, exchange.failed && `failed: ${clip(exchange.failed, 90)}`].filter(Boolean).join(' · ')
}

export function chatWords(chat: FactoryChat, input: ChatWordsInput): ChatWords {
  const label = chat.purpose ?? chat.spaceLabel ?? chat.sessionRef
  const glance = input.glance ?? null
  const unread = input.glanceRefused
    ? `The owner's encounter view of this session refused — ${input.glanceRefused}`
    : 'Not read yet: the owner\'s encounter view of the session carries it.'
  const agent: Said = chat.agentRef ? {said: input.roster.get(chat.agentRef)?.name ?? chat.agentRef} : {absent: NO_AGENT}
  const state: Said = glance ? glance.state ? {said: stateWord(glance.state)} : {absent: 'The encounter view reports no connection for this session.'} : {absent: unread}
  const exchange: Said = glance ? glance.exchange ? {said: exchangeWords(glance.exchange)} : {absent: 'The encounter view holds no turn for this session yet.'} : {absent: unread}
  const when: Said = input.activityUnixMs === null ? {absent: NO_TIME} : {said: utc(input.activityUnixMs)}
  const part = (name: string, said: Said) => `${name}: ${'said' in said ? said.said : `— (${said.absent})`}`
  const hover = [label, chat.spaceLabel && chat.spaceLabel !== label ? `in ${chat.spaceLabel}` : null, part('agent', agent), part('state', state),
    part('last change', when), glance?.provider ? `connected to ${glance.provider}` : null, `${chat.spaceRef} · ${chat.sessionRef}`,
    chat.projects.length > 1 ? `shared by ${chat.projects.join(' and ')}` : null].filter(Boolean).join(' · ')
  return {label, agent, state, exchange, when, hover}
}

// ---- the drag a chat carries ------------------------------------------------------------------------------------------------

/** What tells a chat's payload from an agent's (agent/agentChainDrag.ts carries `family`; a chat carries `kind`). */
export const CHAT_DRAG_KIND = 'factory-chat'

export function encodeChatDrag(chat: FactoryChat): string {
  return JSON.stringify({kind: CHAT_DRAG_KIND, chat})
}

// dataTransfer is unreadable during dragover, so the chat in hand is also held here for the length of one gesture (the pattern of
// agent/agentChainDrag.ts setActiveChainDrag): a target that takes only a chat (the rail) can tell it from an agent's drag.
let held: FactoryChat | null = null
export function setActiveChatDrag(chat: FactoryChat | null): void { held = chat }
export function activeChatDrag(): FactoryChat | null { return held }

/** The chat a payload carries; null for anything else (an agent, a skillset, bytes that are no JSON). */
export function decodeChatDrag(encoded: string): FactoryChat | null {
  try {
    const parsed = JSON.parse(encoded) as {kind?: unknown; chat?: Record<string, unknown> | null} | null
    if (!parsed || parsed.kind !== CHAT_DRAG_KIND || !parsed.chat || typeof parsed.chat !== 'object') return null
    const {project, spaceRef, sessionRef} = parsed.chat
    if (typeof project !== 'string' || !project || typeof spaceRef !== 'string' || !spaceRef || typeof sessionRef !== 'string' || !sessionRef) return null
    return {
      project, spaceRef, sessionRef,
      spaceLabel: text(parsed.chat.spaceLabel), purpose: text(parsed.chat.purpose), agentRef: text(parsed.chat.agentRef),
      projects: Array.isArray(parsed.chat.projects) ? parsed.chat.projects.filter((item): item is string => typeof item === 'string') : [],
    }
  } catch {
    return null
  }
}

// ---- the thread -------------------------------------------------------------------------------------------------------------

export type ThreadOpening =
  | {readonly kind: 'open'; readonly trackKey: string; readonly label: string; /** Open the Agent full in a pane too, its Full the thread (it stands on the chain). */ readonly pane: boolean}
  | {readonly kind: 'refused'; readonly words: string}

/** Where a chat's thread can be read. The thread pane follows a session the shell's sessions provider holds, and that provider reads
 * the world's agency (widgets/agentConversation.ts CONVERSATION_PLACE): a chat in no space of the world's registers has no thread there
 * — said, not faked. `trackKeys` null: no provider is mounted above the browser. */
export function threadOpening(chat: FactoryChat, trackKeys: ReadonlySet<string> | null, agentOnChain: boolean): ThreadOpening {
  const label = chat.purpose ?? chat.spaceLabel ?? chat.sessionRef
  if (!trackKeys) return {kind: 'refused', words: `The thread of “${label}” is not read here: the agent sessions are not mounted above this browser.`}
  const key = chatTrackKey(chat)
  if (!trackKeys.has(key)) {
    return {kind: 'refused', words: `The thread of “${label}” is not read here: the thread pane follows the sessions the shell mounts, which are those of ${CONVERSATION_PLACE}, and this chat of ${chat.project} is in none of their spaces.`}
  }
  return {kind: 'open', trackKey: key, label, pane: agentOnChain}
}
