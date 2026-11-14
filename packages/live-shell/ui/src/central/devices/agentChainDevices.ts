// The agent's devices on Central's chain (lane BC3, folded by R4; DLW §16.2 "Central — A workspace … The packet, the agent that answers,
// and its scope"; §18.3, §19.4, §19.12) as declarations (O-I ticket 1005; docs/architecture/world-shell.md §9.2.5, as Factory's chain is,
// inhabitants/agentParamAddresses.ts CHAIN_DECLARATIONS): the Packet, the Agent's Identity page, Scope and the Day — each the World
// Model slice it reads (kernel world_model.rs), the field each reading stands on there, why the World Model holds none where it holds
// none, and the Action each control invokes. The chain (CentralDevices.tsx) holds the slices (owners/model.ts useModelSlice) and makes
// each binding from them here, purely (packetFromModel, identityFromModel, scopeFromModel; dayBinding.ts dayFromModel): no device reads
// an owner. Search is no chain device (§18.4: a pane, and the line where you type @) — its pane (central/searchPane.tsx) reads it
// through useSearchDevice.
import {useEffect, useMemo, useState, useSyncExternalStore} from 'react'
import type {EncounterSessionSettingsReading, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {assertPreparedContext, type PreparedContext} from '../../../../../../desktop/cradle/src/context/nativeContext'
import {knowledge} from '../../../../../../desktop/cradle/src/knowledge/client'
import {progressiveSearch} from '../../../../../../desktop/cradle/src/knowledge/searchProgress'
import {rosterFromReading, type RosterAgent} from '../../../../../../desktop/cradle/src/agency/roster'
import type {HumanAgentCard} from '../../../../../../desktop/cradle/src/agency/agentCardReading'
import type {DesignBinding} from '../../frame/devices/designed'
import type {ObservedHandle} from '../../agent/devices/EncounterObservers'
import type {ScopeWaits} from '../../agent/devices/designBindings'
import type {ChainDeviceDeclaration} from '../../inhabitants/agentParamAddresses'
import {sliceValue, type ModelSliceReading} from '../../owners/model'
import {centralDeviceId, type CentralReads} from './centralDeviceModel'
import {CENTRAL_SCOPE_ID, EFFECTIVE_SOURCES_ACTION, WORLD_RELATIONS_READ, WORLD_RELATIONS_SAVE} from './contextWorldBinding'
import {DAY_FIELD_RECORD_ACTION, NOT_TODAY} from './dayBinding'
import {identityAgentOf, identityBinding, identityWorldOf, profileExtrasOf, type IdentityInput, type ProfileExtras} from './identityBinding'
import {heldOf, holdsVersion, subscribeHolds} from './pageBindings'
import {packetBinding, type DocumentPacket, type PacketConversation} from './packetBinding'
import {DAY_ACTIONS, editPacket} from './centralDeviceWrites'
import {CONTROL_SEARCH_ACTION, searchBinding, searchProjectOf, searchQueryOf, vakDepthOf, vakTermOf, type SearchAnswer, type VakAnswer} from './searchBinding'
import {useOwnerOp} from '../../owners/ownerCall'
import {ROOT_REGISTER, useWorldProjects} from '../../agent/worldScope'
import type {ActionAnswer} from './centralActions'
import {useCentralAction} from './useCentralReadings'

export const PACKET_DEVICE_ID = centralDeviceId('packet')
export const SEARCH_DEVICE_ID = centralDeviceId('search')
/** The hold Central's Agent keeps its Identity page's choices under (the agent, the World, Proposed): Agent identity's own id, so the
 * choice made before R4 stands. */
export const IDENTITY_DEVICE_ID = centralDeviceId('agent-identity')
export const CONTEXT_WORLD_DEVICE_ID = centralDeviceId('context-world')
export {CENTRAL_SCOPE_ID}

const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

// ---------------------------------------------------------------------------------------------------------------- the declarations

/** Why the World Model holds no packet of a session in a project's register: its packet slice is your world's root register's. */
export const PROJECT_PACKET = (project: string): string => `The World Model holds the packets of your world's root register (AIKit's prepared context, world_model.rs \`packet\`); this conversation is in ${project}'s register, whose packet it does not hold yet.`
/** Why the World Model holds no settings of a session in a project's register: Scope's slice holds your world's root sessions'. */
export const PROJECT_SETTINGS = (project: string): string => `the World Model holds the settings of your world's root register's sessions (world_model.rs \`scope\`); this session is in ${project}'s register, whose settings it does not hold yet.`
/** Why no card stands for an agent you have not accepted, or in a World it does not ratify. */
export const CARD_UNHELD = (agent: string, world: string | null): string => `The World Model holds the card of each agent you accepted, in its home World and each World it ratifies (world_model.rs \`roster\`); it holds none of ${agent}${world ? ` in ${world}` : ''}.`

/** Central's four devices as declarations (O-I ticket 1005), in the chain's order: the Packet, the Agent (its Identity page reads your
 * roster), Scope — the world's chain (§16.2) — and the Day, the Main track's. Each `controls` entry is the registry's Action, or why none
 * carries the control and the kernel op that still writes it (gates/foundation/lint.mjs counts that code until its owner declares one). */
export const CENTRAL_CHAIN_DECLARATIONS: readonly ChainDeviceDeclaration[] = Object.freeze<ChainDeviceDeclaration[]>([
  {
    device: 'packet', face: 'central:packet', slice: 'packet',
    // AIKit's prepared context of your world's root register (no conversation) and of each of its sessions, by session.
    fields: {register: 'packet:register', sessions: 'packet:sessions'},
    unheld: {project: PROJECT_PACKET('a project')},
    controls: {
      edit: {none: 'AIKit declares no Action for a prepared context\'s edit: its encounter carries Remove and Empty (context edit).', kernelOp: 'encounter'},
      send: {none: 'AIKit declares no Action for a conversation\'s Send: its encounter carries it, on the session\'s one shared observer.', kernelOp: 'encounter'},
    },
  },
  {
    device: 'agent', face: 'actuation:harness-model', slice: 'roster',
    // Your agent profiles, and the card of each one you accepted, by agent and then by World (`home` its own).
    fields: {roster: 'roster:roster', cards: 'roster:cards'},
    unheld: {proposed: 'The World Model holds the cards of the agents you accepted; an agent you have not accepted stands in the roster without its card.'},
    // §18.15: "The roster is yours. The device reads it." — the agent, the World and Proposed choose what is read, and are the view's own.
    controls: {},
  },
  {
    device: 'scope', face: 'software-factory:context-write-mode', slice: 'scope',
    // Your world's effective sources and authored relations, and each root session's own settings in AIKit; the change horizon is the
    // root's ground, which the Day reads.
    fields: {effective: 'scope:effective', relations: 'scope:relations', settings: 'scope:settings', horizon: 'day:ground'},
    unheld: {project: PROJECT_SETTINGS('a project')},
    // A read place's include or exclude (`r:<place>`) is saved on the world's relations; Wait and On no answer on the session's settings.
    controls: {
      'r:<place>': {action: WORLD_RELATIONS_SAVE},
      wait: {none: 'AIKit declares no Action for a session\'s settings.', kernelOp: 'encounter_session_settings'},
      noAnswer: {none: 'AIKit declares no Action for a session\'s settings.', kernelOp: 'encounter_session_settings'},
    },
  },
  {
    device: 'day', face: 'central:day-die', slice: 'day',
    // Today's Day (Central's turn and its reading, its page), the root's ground, the Day's own settings, today's moves and field.
    fields: {today: 'day:day_ref', document: 'day:document', bounds: 'day:bounds', ground: 'day:ground', settings: 'day:settings', moves: 'day:moves', field: 'day:field'},
    unheld: {selected: NOT_TODAY},
    // The ids the Day's writes send (centralDeviceWrites.ts DAY_ACTIONS; the field record's, dayBinding.ts DAY_FIELD_RECORD_ACTION).
    controls: {
      face: {action: DAY_ACTIONS.face},
      closeNow: {action: DAY_ACTIONS.closeNow},
      settings: {action: DAY_ACTIONS.settings},
      begin: {action: DAY_ACTIONS.begin},
      openTomorrow: {action: DAY_ACTIONS.openTomorrow},
      field: {action: DAY_FIELD_RECORD_ACTION},
    },
  },
])

/** The declaration of one of Central's chain devices (as agentParamAddresses.ts chainDeclaration is the Factory chain's). */
export const centralChainDeclaration = (device: string): ChainDeviceDeclaration | undefined => CENTRAL_CHAIN_DECLARATIONS.find(declared => declared.device === device)

/** One part of a slice's value as the kernel holds it (world_model.rs `part`: `{state: read, reading}` or `{state: refused, why}`): its
 * reading, or the owner's words why it has none; null where the value names no such part. Pure. */
export function partOf<T = unknown>(part: unknown): {ok: true; value: T} | {ok: false; why: string} | null {
  if (!isObject(part)) return null
  if (part.state === 'read') return {ok: true, value: part.reading as T}
  if (part.state === 'refused') return {ok: false, why: typeof part.why === 'string' ? part.why : 'The owner refused this reading.'}
  return null
}

/** A part as an Action's answer (centralActions.ts ActionAnswer), as the bindings read Central's readings: the slice not answered yet
 * reads as reading. Pure. */
export function answerOfPart(slice: ModelSliceReading, part: unknown, what: string): ActionAnswer {
  if (slice.state === 'reading') return {status: 'reading'}
  const held = sliceValue(slice)
  if (!held.ok) return {status: 'refused', error: held.reason}
  const read = partOf(part)
  if (!read) return {status: 'refused', error: `The World Model's ${held.answer.slice} holds no ${what}.`}
  return read.ok ? {status: 'answered', value: read.value} : {status: 'refused', error: read.why}
}

// ---------------------------------------------------------------------------------------------------------------- the Packet

/** The conversation as its one shared observer reports it, reduced to what the Packet reads. */
export function packetConversationOf(handle: ObservedHandle | undefined): PacketConversation | undefined {
  if (!handle || !('state' in handle)) return undefined
  return {draft: handle.state.draft ?? '', busy: !!handle.state.busy, ...(handle.state.reading ? {reading: handle.state.reading} : {})}
}

/** The Packet's binding (packetBinding.ts) on the packet read from the World Model, the conversation it goes with (its one shared observer:
 * its draft, and its Send), and the reached document's own packet; Remove and Empty are AIKit's context edit (centralDeviceWrites.ts
 * editPacket). The chain's Packet and the rail's tile bind it alike. Pure. */
export function packetDeviceBinding(transport: KernelTransportStatus, reading: {context?: PreparedContext; error?: string} | null,
  conversation: {readonly companion: string; readonly bound: boolean; readonly handle?: ObservedHandle}, document: DocumentPacket | null): DesignBinding {
  const context = reading?.context
  const {companion, bound, handle} = conversation
  return packetBinding(PACKET_DEVICE_ID, {reading, companion, bound, conversation: packetConversationOf(handle), document}, {
    edit: context ? async mutation => { await editPacket(transport, context, mutation) } : null,
    send: handle && 'actions' in handle ? () => handle.actions.send() : null,
  })
}

/** The packet the agent will read, from the World Model's packet slice (world_model.rs `packet`): AIKit's prepared context of the
 * conversation's session, or of your world's root register while no conversation stands; or why there is none, in the owner's words.
 * Null while the slice has not answered. A conversation in a project's register is not held (PROJECT_PACKET). Pure. */
export function packetFromModel(packet: ModelSliceReading, conversation: {readonly session: string | null; readonly project?: string | null}): {context?: PreparedContext; error?: string} | null {
  if (packet.state === 'reading') return null
  const {session} = conversation, project = conversation.project ?? ROOT_REGISTER
  if (project !== ROOT_REGISTER) return {error: PROJECT_PACKET(project)}
  const held = sliceValue<{register?: unknown; sessions?: Record<string, unknown>}>(packet)
  if (!held.ok) return {error: held.reason}
  const read = partOf(session ? held.value.sessions?.[session] : held.value.register)
  if (!read) return {error: session ? `The World Model's packet holds no prepared context of ${session} yet: AIKit's agency had not listed it when the packet was read.` : 'The World Model\'s packet holds no prepared context of your world\'s root register.'}
  if (!read.ok) return {error: read.why}
  try {
    assertPreparedContext(read.value, session ?? undefined)
    return {context: read.value}
  } catch (cause) {
    return {error: message(cause)}
  }
}

// ---------------------------------------------------------------------------------------------------------------- the Agent's Identity

const NO_EXTRAS: ReadonlyMap<string, ProfileExtras> = new Map()

/** Agent identity — the one Agent's Identity page (`id.*`, oneAgentBinding.ts) — from the World Model's roster slice (world_model.rs
 * `roster`): your agent profiles, and the chosen agent's card in the chosen World, where it holds one (the agents you accepted, in their
 * home World and each they ratify). `id` keys the page's holds: Central's Agent's, or Factory's (FactoryDeviceChain.tsx). The holds are
 * read as they stand: the caller binds again when they move (pageBindings.ts holdsVersion). Pure. */
export function identityFromModel(id: string, roster: ModelSliceReading, talkingTo: string | null): DesignBinding {
  const held = sliceValue<{roster?: unknown; cards?: Record<string, Record<string, unknown>>}>(roster)
  let list: IdentityInput['roster'] = null
  if (held.ok) {
    try { list = {agents: rosterFromReading(held.value.roster)} } catch (cause) { list = {error: message(cause)} }
  } else if (roster.state !== 'reading') {
    list = {error: held.reason}
  }
  const extras = held.ok ? profileExtrasOf(held.value.roster) : NO_EXTRAS
  const agent = identityAgentOf(id, {roster: list, talkingTo})
  const world = identityWorldOf(id)
  let card: IdentityInput['card'] = null
  if (agent && held.ok) {
    const read = partOf<HumanAgentCard>(held.value.cards?.[agent]?.[world ?? 'home'])
    card = !read ? {agent, world, error: CARD_UNHELD(agent, world)} : read.ok ? {agent, world, card: read.value} : {agent, world, error: read.why}
  } else if (agent && roster.state !== 'reading' && !held.ok) {
    card = {agent, world, error: held.reason}
  }
  return identityBinding(id, {roster: list, extras, talkingTo, card})
}

/** Your world's agents as the World Model's roster slice holds them (roster.ts rosterFromReading over Central's agent profiles), or why
 * none, in the shape the shell's roster readers give (owners/readers.ts RosterAgentsReading's state, agents and error). Pure. */
export function rosterAgentsFromModel(roster: ModelSliceReading): {state: 'reading' | 'ready' | 'error'; agents: RosterAgent[]; error?: string} {
  if (roster.state === 'reading') return {state: 'reading', agents: []}
  const held = sliceValue<{roster?: unknown}>(roster)
  if (!held.ok) return {state: 'error', agents: [], error: held.reason}
  try {
    return {state: 'ready', agents: rosterFromReading(held.value.roster)}
  } catch (cause) {
    return {state: 'error', agents: [], error: message(cause)}
  }
}

/** The roster as Central's devices read it (centralDeviceModel.ts CentralReads `roster`): whether it answered, the first agent you
 * accepted (the identity the Agent shows), how many you accepted of how many, or why it did not answer. Pure. */
export function rosterReadingOf(roster: {readonly state: 'reading' | 'ready' | 'error'; readonly agents: readonly RosterAgent[]; readonly error?: string}): NonNullable<CentralReads['roster']> {
  if (roster.state === 'reading') return {answer: 'reading', identity: null, accepted: 0, total: 0, fault: null}
  if (roster.state === 'error') return {answer: 'refused', identity: null, accepted: 0, total: 0, fault: roster.error ?? 'The agent roster did not answer'}
  const accepted = roster.agents.filter(agent => agent.accepted)
  return {answer: 'read', identity: accepted[0]?.ref ?? null, accepted: accepted.length, total: roster.agents.length, fault: null}
}

/** The version of the page bindings' holds (the Identity page's agent, World and Proposed): a chain binds its Identity page again when
 * it moves. */
export const useIdentityHolds = (): number => useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)

// ---------------------------------------------------------------------------------------------------------------- Scope

/** What Scope reads of your world, from the World Model's scope slice (world_model.rs `scope`): Central's effective sources and authored
 * relations of the world, as Central's readings (EFFECTIVE_SOURCES_ACTION, WORLD_RELATIONS_READ), and the session's own settings in AIKit
 * (its Wait and On no answer, the reading their write is checked against), or why none. Pure. */
export function scopeFromModel(scope: ModelSliceReading, session: string | null, project: string = ROOT_REGISTER): {
  effective: ActionAnswer
  relations: ActionAnswer
  settings: {readonly reading: EncounterSessionSettingsReading} | {readonly why: string} | null
} {
  const held = sliceValue<{effective?: unknown; relations?: unknown; settings?: unknown}>(scope)
  const value = held.ok ? held.value : {}
  const effective = answerOfPart(scope, value.effective, EFFECTIVE_SOURCES_ACTION)
  const relations = answerOfPart(scope, value.relations, WORLD_RELATIONS_READ)
  if (!session || scope.state === 'reading') return {effective, relations, settings: null}
  if (project !== ROOT_REGISTER) return {effective, relations, settings: {why: PROJECT_SETTINGS(project)}}
  if (!held.ok) return {effective, relations, settings: {why: held.reason}}
  const sessions = partOf<Record<string, unknown>>(value.settings)
  if (!sessions) return {effective, relations, settings: {why: 'the World Model\'s scope holds no session\'s settings.'}}
  if (!sessions.ok) return {effective, relations, settings: {why: sessions.why}}
  const own = partOf<EncounterSessionSettingsReading>(sessions.value[session])
  if (!own) return {effective, relations, settings: {why: `the World Model's scope holds no settings of ${session} yet: AIKit's agency had not listed it when Scope was read.`}}
  return {effective, relations, settings: own.ok ? {reading: own.value} : {why: `AIKit did not read the session's settings: ${own.why}`}}
}

/** Scope's Wait and On no answer on the dialogue's session (§19.12 Asks; designBindings.ts ScopeWaits), from its settings as the World
 * Model's scope slice holds them, written against their revision (`write`, agent/sessionSettings.ts writeSessionSettings on the reading
 * held), with the reading itself (`settings`, for Approvals). Pure. */
export function scopeWaitsOf(session: string | null, held: ReturnType<typeof scopeFromModel>['settings'],
  write: ((change: {wait?: number; no_answer?: 'hold' | 'deny'}, basis: EncounterSessionSettingsReading) => Promise<unknown>) | null): ScopeWaits & {readonly settings: EncounterSessionSettingsReading | null} {
  if (!session) return {track: null, why: 'no session stands on this chain, so no settings of one are read.', settings: null}
  if (!held) return {track: null, settings: null}
  if ('why' in held) return {track: null, why: held.why, settings: null}
  const reading = held.reading
  return {track: reading.track ?? null, settings: reading, ...(write ? {write: (change: {wait?: number; no_answer?: 'hold' | 'deny'}) => write(change, reading)} : {})}
}

// ---------------------------------------------------------------------------------------------------------------- Search

/** Search: the held query asked of AIKit's knowledge search (search and resolve, progressively, as the cradle's overlay asks them), in
 * the held reach; for Your world, Central's search of Control too (control.search, held for the window); read again only when the query
 * or the reach changes (the line commits on Enter). Reach lists the world's projects (agent/worldScope.ts useWorldProjects, the
 * world_browse read the browser's worlds draw from) unless the caller hands its own list. */
export function useSearchDevice(transport: KernelTransportStatus, handed: readonly string[] | null = null): DesignBinding {
  const world = useWorldProjects(transport, handed === null)
  const worldKey = world.status === 'answered' && world.value ? world.value.filter(name => name !== ROOT_REGISTER).join('\n') : null
  const read = useMemo(() => (worldKey === null ? null : worldKey ? worldKey.split('\n') : []), [worldKey])
  const projects = handed ?? read
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const query = searchQueryOf(SEARCH_DEVICE_ID), project = searchProjectOf(SEARCH_DEVICE_ID)
  // Asked again when the search line has changed what AIKit counts (its ✕ forgets an item: searchLine.tsx), not only when the words move.
  const again = heldOf(SEARCH_DEVICE_ID).again
  const [answer, setAnswer] = useState<SearchAnswer | null>(null)
  useEffect(() => {
    if (!query) return
    if (transport.kind === 'unavailable') { setAnswer({query, hits: [], rows: [], error: `The kernel carrier is unavailable: ${transport.reason}`, pending: []}); return }
    const controller = new AbortController()
    progressiveSearch(
      () => knowledge(transport, project, {action: 'search', query}, {signal: controller.signal}),
      () => knowledge(transport, project, {action: 'resolve', query}, {signal: controller.signal}),
      snapshot => setAnswer({query, hits: snapshot.hits, rows: snapshot.rows, ...(snapshot.error ? {error: snapshot.error} : {}), pending: snapshot.pending}),
      controller.signal,
    )
    return () => controller.abort()
  }, [transport, query, project, again])
  const controlInput = useMemo(() => (query && !project ? {query} : null), [query, project])
  const control = useCentralAction(transport, CONTROL_SEARCH_ACTION, controlInput)
  // A `vak:` term is asked of Quaternal Logic's Vāk registry (kernel ql_read: `ql vak locate`, `ql vak context <ref> <depth>`).
  const vak = useVakAnswer(transport, query ? vakTermOf(query) : null, vakDepthOf(heldOf(SEARCH_DEVICE_ID)['vak.depth']))
  const withControl = answer && controlInput && answer.query === controlInput.query ? {...answer, control} : answer
  const asked = withControl && vak ? {...withControl, vak} : withControl
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the holds' version re-binds the view's own keys
  return useMemo(() => searchBinding(SEARCH_DEVICE_ID, asked, projects), [answer, control, controlInput, vak, projects, version])
}

/** One route's answer as the binding reads it: QL's data, or its refusal in its words, or nothing yet. */
function routeAnswer(reading: {status: string; value: {data?: unknown} | null; error: string | null}): ActionAnswer {
  if (reading.status === 'refused') return {status: 'refused', error: reading.error ?? 'Quaternal Logic did not answer.'}
  return reading.status === 'answered' && reading.value ? {status: 'answered', value: reading.value.data} : {status: 'reading'}
}

/** The `vak:` term's two reads, held as readings (they change nothing): the entry located and its neighbourhood at the depth asked. */
function useVakAnswer(transport: KernelTransportStatus, ref: string | null, depth: number): VakAnswer | undefined {
  const locate = useOwnerOp(transport, ref ? {op: 'ql_read', request: {kind: 'vak-locate', vak_ref: ref}} : null, 'owner_route_reading', 'Quaternal Logic did not locate the entry.').reading
  const context = useOwnerOp(transport, ref ? {op: 'ql_read', request: {kind: 'vak-context', vak_ref: ref, depth}} : null, 'owner_route_reading', 'Quaternal Logic did not read the neighbourhood.').reading
  return useMemo(() => (ref ? {ref, depth, locate: routeAnswer(locate), context: routeAnswer(context)} : undefined), [ref, depth, locate, context])
}
