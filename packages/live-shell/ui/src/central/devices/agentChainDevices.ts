// The agent's devices on Central's chain (lane BC3, folded by R4; DLW §16.2 "Central — A workspace … The packet, the agent that answers,
// and its scope"; §18.3, §19.4, §19.12): the readings and bindings of the Packet, the Agent's Identity page, Scope and Search, over the
// owners the shell already reads (packetBinding.ts, identityBinding.ts, contextWorldBinding.ts centralScopeBinding, searchBinding.ts).
// The chain (CentralDevices.tsx) places and publishes the Packet, the Agent and Scope, and mounts the encounter observers the Packet
// and the Agent share; Search is no chain device (§18.4: a pane, and the line where you type @) — its pane (central/searchPane.tsx)
// reads it through useSearchDevice.
import {useEffect, useMemo, useState, useSyncExternalStore} from 'react'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import type {PreparedContext} from '../../../../../../desktop/cradle/src/context/nativeContext'
import {knowledge} from '../../../../../../desktop/cradle/src/knowledge/client'
import {progressiveSearch} from '../../../../../../desktop/cradle/src/knowledge/searchProgress'
import {readAgentCard} from '../../../../../../desktop/cradle/src/agency/agentCardReading'
import type {DesignBinding} from '../../frame/devices/designed'
import type {ObservedHandle} from '../../agent/devices/EncounterObservers'
import {useRosterAgents, useRosterAnswer} from '../../owners/readers'
import {centralDeviceId} from './centralDeviceModel'
import {editPacket} from './centralDeviceWrites'
import {CENTRAL_SCOPE_ID, centralScopeBinding, type ContextWorldInput} from './contextWorldBinding'
import {identityAgentOf, identityBinding, identityWorldOf, profileExtrasOf, type IdentityInput, type ProfileExtras} from './identityBinding'
import {heldOf, holdsVersion, subscribeHolds} from './pageBindings'
import {packetBinding, type DocumentPacket, type PacketConversation} from './packetBinding'
import {CONTROL_SEARCH_ACTION, searchBinding, searchProjectOf, searchQueryOf, vakDepthOf, vakTermOf, type SearchAnswer, type VakAnswer} from './searchBinding'
import {useOwnerOp} from '../../owners/ownerCall'
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

/** The conversation as its one shared observer reports it, reduced to what the Packet reads. */
export function packetConversationOf(handle: ObservedHandle | undefined): PacketConversation | undefined {
  if (!handle || !('state' in handle)) return undefined
  return {draft: handle.state.draft ?? '', busy: !!handle.state.busy, ...(handle.state.reading ? {reading: handle.state.reading} : {})}
}

/** The Packet: the shell's one packet reading (useCentralTransport.tsx usePacketReading), the owner's edit, the conversation's Send. */
export function usePacketDevice(transport: KernelTransportStatus, reading: {context?: PreparedContext; error?: string} | null, conversation: {readonly companion: string; readonly bound: boolean; readonly handle?: ObservedHandle},
  document: DocumentPacket | null = null): DesignBinding {
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const {companion, bound, handle} = conversation
  return useMemo(() => {
    const context = reading?.context
    return packetBinding(PACKET_DEVICE_ID, {reading, companion, bound, conversation: packetConversationOf(handle), document}, {
      edit: context ? async mutation => { await editPacket(transport, context, mutation) } : null,
      send: handle && 'actions' in handle ? () => handle.actions.send() : null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the holds' version re-binds the view's own keys
  }, [transport, reading, companion, bound, handle, version, document])
}

/** Search: the held query asked of AIKit's knowledge search (search and resolve, progressively, as the cradle's overlay asks them), in
 * the held reach; for Your world, Central's search of Control too (control.search, held for the window); read again only when the query
 * or the reach changes (the line commits on Enter). */
export function useSearchDevice(transport: KernelTransportStatus, projects: readonly string[] | null): DesignBinding {
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const query = searchQueryOf(SEARCH_DEVICE_ID), project = searchProjectOf(SEARCH_DEVICE_ID)
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
  }, [transport, query, project])
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

const NO_EXTRAS: ReadonlyMap<string, ProfileExtras> = new Map()

/** Agent identity — the one Agent's Identity page (`id.*`, oneAgentBinding.ts): the shared roster answer, and the chosen agent's card in
 * the chosen World (op agent_card). `id` keys the page's holds: Central's Agent's, or Factory's (FactoryDeviceChain.tsx). */
export function useIdentityDevice(transport: KernelTransportStatus, talkingTo: string | null, id: string = IDENTITY_DEVICE_ID): DesignBinding {
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const roster = useRosterAgents(transport)
  const raw = useRosterAnswer(transport, null)
  const extras = useMemo(() => (raw.reading.status === 'answered' ? profileExtrasOf(raw.reading.value) : NO_EXTRAS), [raw.reading])
  const list = useMemo((): IdentityInput['roster'] => (roster.state === 'ready' ? {agents: roster.agents} : roster.state === 'error' ? {error: roster.error ?? 'The agent roster did not answer'} : null),
    [roster.state, roster.agents, roster.error])
  const agent = identityAgentOf(id, {roster: list, talkingTo})
  const world = identityWorldOf(id)
  const [card, setCard] = useState<IdentityInput['card']>(null)
  useEffect(() => {
    if (!agent || transport.kind === 'unavailable') return
    let alive = true
    readAgentCard(transport, agent, world).then(
      read => { if (alive) setCard({agent, world, card: read}) },
      cause => { if (alive) setCard({agent, world, error: message(cause)}) },
    )
    return () => { alive = false }
  }, [transport, agent, world])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the holds' version re-binds the view's own keys
  return useMemo(() => identityBinding(id, {roster: list, extras, talkingTo, card}), [id, list, extras, talkingTo, card, version])
}

/** Scope on Central (one Scope, R4): Context & world's readings — the Agent's session's scope over Central's ground (its change horizon,
 * and the world's effective sources as Central resolves them) and the Packet's reading — in Scope's keys (contextWorldBinding.ts
 * centralScopeBinding). */
export function useScopeDevice(input: ContextWorldInput): DesignBinding {
  useSyncExternalStore(subscribeHolds, holdsVersion, holdsVersion)
  const version = holdsVersion()
  const {answer, horizon, groundError, document, packet, effective, relations, saveRelations} = input
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the parts are the input; the holds' version re-binds the view's own keys
  return useMemo(() => centralScopeBinding(CENTRAL_SCOPE_ID, {answer, horizon, groundError, document, packet, effective, relations, saveRelations}),
    [answer.bound, answer.session, horizon, groundError, document, packet?.items, packet?.session, effective, relations, saveRelations, version])
}
