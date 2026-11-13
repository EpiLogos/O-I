// Chain devices the rail draws as their widgets (manual §23.1: "Its tile is the device's widget view"; "the graph around your selection"):
// Central's Packet (central__packet.tsx) and the Knowledge graph (knowledge-graph__graph.tsx). Their chains — Central's world track
// (central/devices/CentralDevices.tsx) and Technē's rack (inhabitants/ql/devices/TechneDevices.tsx) — publish them while they stand; the
// rail's tile of the same id draws the device (widgets/railDeviceIds.ts claims it), so in every other mode the rail publishes its own,
// on the same binding functions and the same owners, while its tile is open and no chain holds the device, and withdraws only its own
// (as the rail's Sky does: widgets/railSky.tsx). Mounted by the rail's publisher (widgets/railDevices.tsx) only while the tile is open.
import {useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {nativeContext, PREPARED_CONTEXT_CHANGED, type PreparedContext} from '../../../../../desktop/cradle/src/context/nativeContext'
import {knowledgeGraphSurface, subscribeKnowledgeGraph} from '../../../../../desktop/cradle/src/knowledge/knowledgeGraphHandle'
import {publishDevice, publishedDevice, subscribeDeviceDoor, type PublishedDevice} from '../frame/devices/deviceDoor'
import type {DesignBinding} from '../frame/devices/designed'
import type {DeviceInstance} from '../frame/devices/deviceRuntime'
import {inhabitantManifest} from '../inhabitants/manifest'
import {useAgencySessions} from '../agent/useAgencySessions'
import {useEncounterSessions} from '../agent/devices/EncounterObservers'
import {ROOT_REGISTER} from '../agent/worldScope'
import {COMPANIONS} from '../shell/modeDockTiles'
import {useOptionalContinuity} from '../continuity/workspace'
import {usePacketDevice, PACKET_DEVICE_ID} from '../central/devices/agentChainDevices'
import {CENTRAL_FAMILY, centralDeclaration} from '../central/devices/centralDeviceModel'
import {documentPacketOf} from '../central/devices/packetBinding'
import {useReachedDocument} from '../central/documents/documentDoor'
import {GRAPH_DESIGN, designDevice, heldFor, useHolds} from '../techne/devices/designDevices'
import {graphBinding, surfaceRead, GRAPH_READ_NODES, type GraphWrites} from '../techne/devices/graphBinding'
import {useGraphRead} from '../techne/devices/graphRead'
import {useLivingPlan} from '../techne/devices/livingPlan'
import {writeThroughOwner} from '../inhabitants/ql/devices/ownerWrite'
import {setFilters} from '../inhabitants/knowledgeGraphFaceActions'
import {conversationOf} from './agentConversation'
import {useWidgetReading} from './widgetReading'

const NO_CARRIER: KernelTransportStatus = {kind: 'unavailable', reason: 'No kernel carrier stands.'}
const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

/** Publish the rail's device unless a chain holds it now. `mine` is the device the rail published last; the answer is the one it holds
 * now, or null while a chain's stands. */
export function publishRailOwn(id: string, entry: PublishedDevice, mine: DeviceInstance | null): DeviceInstance | null {
  const now = publishedDevice(id)
  if (now && now.device !== mine) return null
  publishDevice(id, entry)
  return entry.device
}

/** Withdraw the rail's device, never a chain's. */
export function withdrawRailOwn(id: string, mine: DeviceInstance | null): void {
  if (mine && publishedDevice(id)?.device === mine) publishDevice(id, null)
}

/** Stand `device` on the door on `binding` while no chain holds it; give it back when a chain does, and take it again when that chain leaves. */
function usePublishedUnlessHeld(id: string, device: DeviceInstance | null, binding: DesignBinding): void {
  const held = useSyncExternalStore(subscribeDeviceDoor, () => publishedDevice(id)?.device ?? null, () => null)
  const mine = useRef<DeviceInstance | null>(null)
  useEffect(() => {
    if (!device) return
    if (held !== null && held !== mine.current) return
    mine.current = publishRailOwn(id, {device, binding, picture: () => null}, mine.current)
  }, [id, device, binding, held])
  useEffect(() => () => withdrawRailOwn(id, mine.current), [id])
}

// ---------------------------------------------------------------------------------------------------------------- the Packet
// What the agent of the mode in front of you will read (manual §5, §23.1): AIKit's prepared context for the conversation the rail's Agent
// holds — THE selection's session, else the mode's companion's (agentConversation.ts conversationOf) — read through the kernel's encounter
// op (context/nativeContext.ts) in that session's register, again on the owner's announcement of a changed packet and on the window's
// return; Answer this is that conversation's own Send, through its one shared observer (agent/devices/EncounterObservers.tsx). The
// binding is Central's (agentChainDevices.ts usePacketDevice → packetBinding.ts), so the tile draws what the chain's Packet draws.

type Held = {key: string; context?: PreparedContext; error?: string}

function usePacketReadingFor(transport: KernelTransportStatus, project: string, session: string | null): {context?: PreparedContext; error?: string} | null {
  const key = JSON.stringify([transport.kind, project, session])
  const [held, setHeld] = useState<Held | null>(null)
  const [reread, setReread] = useState(0)
  useEffect(() => {
    if (transport.kind === 'unavailable') return
    let alive = true
    nativeContext(transport, project, session ?? undefined, {operation: 'read'})
      .then(context => { if (alive) setHeld({key, context}) }, cause => { if (alive) setHeld({key, error: message(cause)}) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the scope
  }, [key, reread])
  useEffect(() => {
    if (typeof window === 'undefined') return
    // The owner's own announcement of a changed packet (context/nativeContext.ts announceContext), and the window's return.
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{project?: string; value?: PreparedContext; sourceWorldRef?: string}>).detail
      if (!detail?.value || detail.sourceWorldRef || detail.project !== project || detail.value.scope.agent_session !== session) return
      setHeld({key, context: detail.value})
    }
    const again = () => setReread(count => count + 1)
    window.addEventListener(PREPARED_CONTEXT_CHANGED, changed)
    window.addEventListener('focus', again)
    return () => { window.removeEventListener(PREPARED_CONTEXT_CHANGED, changed); window.removeEventListener('focus', again) }
  }, [key, project, session])
  if (transport.kind === 'unavailable') return {error: transport.reason ?? 'No kernel carrier stands.'}
  return held?.key === key ? held : null
}

/** Central's Packet face as the family declares it, as a device of the runtime: its design draws on the binding's keys alone. */
function packetDevice(): DeviceInstance | null {
  const face = inhabitantManifest(CENTRAL_FAMILY)?.faces.find(row => row.id === 'packet')
  return face ? {id: PACKET_DEVICE_ID, family: CENTRAL_FAMILY, rows: [], values: {}, face: centralDeclaration(face)} : null
}

export function RailPacket() {
  const reading = useWidgetReading()
  const transport = reading?.transport ?? NO_CARRIER
  const companion = reading ? COMPANIONS[reading.mode].name : COMPANIONS.base.name
  const selection = useOptionalContinuity()?.current.context?.selection?.ref ?? null
  const agency = useAgencySessions(transport)
  const {track} = conversationOf(agency.tracks, companion, selection)
  const session = track?.sessionRef ?? null, space = track?.spaceRef ?? null
  // The packet's register (agent/worldScope.ts): the conversation's session's own, else your world's root register.
  const project = track?.project ?? ROOT_REGISTER
  const packetReading = usePacketReadingFor(transport, project, session)
  const observed = useMemo(() => (session && space ? [{ref: session, space, project}] : []), [session, space, project])
  const {handles, observers} = useEncounterSessions(observed)
  const reached = useReachedDocument()
  const reachedPacket = reached?.packet, reachedForm = reached?.form, reachedTitle = reached?.title
  const document = useMemo(() => documentPacketOf(reachedPacket && reachedForm ? {form: reachedForm, title: reachedTitle ?? '', packet: reachedPacket} : null),
    [reachedPacket, reachedForm, reachedTitle])
  const binding = usePacketDevice(transport, packetReading, {companion, bound: !!track, handle: session ? handles[session] : undefined}, document)
  const device = useMemo(packetDevice, [])
  usePublishedUnlessHeld(PACKET_DEVICE_ID, device, binding)
  return <>{observers}</>
}

// ---------------------------------------------------------------------------------------------------------------- the Knowledge graph
// The open graph's own reading and view state where a graph is open (its handle: knowledgeGraphHandle.ts), else the kernel graph op's
// reading of the root register's wiki (graphRead.ts, the one read Technē's rack shares); QL's aperture plan for the request the design
// holds (livingPlan.ts). The binding is Technē's (graphBinding.ts), on the holds the rack's device keeps (designDevices.ts), so the tile
// and the rack's device read and write the same. What the browser's selection reaches (the Reach page) is read on the rack, where the
// browser stands beside it; the rail's own leaves it unread.

/** The knowledge graph's writes: its armed setters, and the panel's own filter change for a coloured group (as the rack's: techneDesigns.ts). */
const GRAPH_WRITES: GraphWrites = {setter: writeThroughOwner, patch: setFilters}
const GRAPH_DEVICE = designDevice(GRAPH_DESIGN, {title: 'Knowledge graph', icon: 'search', heldBy: ['knowledge-graph'],
  note: 'The open graph\'s view state and its own reading (its handle); with no graph open, the kernel graph op\'s reading of the root register\'s wiki.'})

export function RailGraph() {
  const surface = useSyncExternalStore(subscribeKnowledgeGraph, knowledgeGraphSurface, knowledgeGraphSurface)
  const holds = useHolds()
  const budget = Number(holds[GRAPH_DESIGN]?.budget ?? GRAPH_READ_NODES)
  const rootRead = useGraphRead(!surface, Number.isSafeInteger(budget) && budget > 0 ? budget : GRAPH_READ_NODES, false)
  const read = useMemo(() => (surface ? surfaceRead(surface) : rootRead), [surface, rootRead])
  const plan = useLivingPlan(holds[GRAPH_DESIGN])
  const binding = useMemo(() => graphBinding(surface, read, GRAPH_WRITES, heldFor(GRAPH_DESIGN), plan, null),
    // The holds re-bind the view's own keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surface, read, plan, holds])
  usePublishedUnlessHeld(GRAPH_DESIGN, GRAPH_DEVICE, binding)
  return null
}
