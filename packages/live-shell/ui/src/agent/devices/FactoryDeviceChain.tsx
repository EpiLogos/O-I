// Factory's Device side: the chain of the place selected — a session's (Agent → skills → scope), the Main track's, or a workcell's (its
// rack, the Gateway, the Remote carrier, Git / landing with its Seat) — as devices of the runtime (manual §6, §10.4; ticket
// T-DEVICES-FACTORY). Each is a DeviceView at its compact size (a picture and at most four controls); each is published to the door, so
// the pool shows the chosen one whole and a pane shows it full — the same live settings in all three, a change in any one the same
// change through the owner's write path. The skills rack is a rack: its chains with their admit lamps and its selector; its four settings
// stand as readings until ai-kit declares the mapping that would make them macros.
//
// What the chain's cards (agent/AgentDeviceChain.tsx + NativeAgentDeviceRack.tsx) did that is not the devices' own is ported
// here unchanged and named: the drop receiver (aperture law: a drop is one declared owner operation or a named refusal —
// AgentDeviceChain.tsx:199-243), the slide grip and drop slot (NativeAgentDeviceRack.tsx:113-182), the card click that opens
// the device in the pool (:119) and the owner-line notes. The fold to a title (:210-221) is the runtime's own (DeviceView's ▾,
// its light read by deviceRuntime.ts lightOf); the chain draws no fold or light of its own.
//
// The designed devices (lane BF): the Gateway, the Agent, the Skillset rack, its member and Scope draw the catalogue's designs
// (inhabitants/catalogue/panels: actuation__gateway.tsx, actuation__harness-model.tsx, skills.tsx, member.tsx, scope.tsx) on their owners' readings and
// writes (designBindings.ts), each published with its binding so the chain, the pool, a pane and the rail draw one device. A
// design that still draws a list of its own where the owner's belongs waits (designBindings.ts designWaits), and the generic
// plate draws the owner's rows; the slot names why (data-design-waits).
//
// One Agent (R4; DLW §16.1, §19.4; lock §0.3.5): the Agent carries Custody, Identity and the Thread as its own pages — the Thread its
// Full — on their owners (oneAgentBinding.ts composes sessionChainBindings.ts custodyBinding, central/devices/identityBinding.ts and
// threadBinding.ts onto the Agent's own binding under `custody.*`, `id.*`, `thread.*`), so no Thread, Custody or Agent identity stands
// beside it any more; the Agent's ⤢ opens its own Full, the thread, on the session's own conversation (the thread pane's encounter
// observer: EncounterObservers.tsx). The Gateway's Full is its Frames page at pane size (§19.2 Frames; the rail's Frames tile is its widget,
// mainTrackBindings.ts FRAMES_ID).
//
// Where each stands (lane W1-Factory; factoryPlaces.ts holds the chains, and this file draws exactly those): a session's chain is "Agent,
// skills rack, scope" (§16.2), a group's led by the Agentset rack (§19.15); "A track has no gateway and no landing of its own" (§19.23).
// With no session selected, or the Main head, the Device side is the Main track's chain: the Run map, Approvals and the prompt pads (§16.2,
// §19.1). With a workcell's return track selected it is that workcell's chain: the workcell rack, the Gateway, the Remote carrier, Git /
// landing with the Seat inside it (§16.2, §19.23). The Ledger (§19.13), a monitor, stands on the rail and full in a pane, never on a chain
// (§16.1); so does Messages, an instrument born on the rail (§19.24), with the Gateway's agency build's mark in its head (§19.10). Those,
// and the workcell rack (its widget is the Workcells tile, which lists the gateways: §19.3), stand on the rail in every mode, so the rail's
// publisher holds them (AgentRailDevices.tsx) and this chain draws the rack from the door.
// Retired in the 22 Oct manual rewrite, each a page of the device that carries it, hosted by prefixing the retired device's own binding
// (oneAgentBinding.ts carryPages): the Seat is Git / landing's Seat page (`seat.`, §19.17) beside its Checkouts page (`co.`, Ground hygiene's
// census, §19.16); the machine is the Remote carrier's Machine page (`mc.`, §18.7, §19.18); Capture skill is the Skillset rack's Capture page
// (`capture.`, §19.11); the Decision helper is the Agentset rack's Helper page (`helper.`, §19.20); the Knowledge route is Scope's Knowledge
// page (§19.9), whose settings and readings Scope stands refused and absent by what each lacks (designBindings.ts scopeBinding); the
// Experiment is a task launched with Repeat and its takes compared (§19.5), so no device of it stands. Link is the transport's (§19.19): the
// frame publishes it. Every device of this chain is published whichever chain is drawn, so the pool, a pane and the rail keep them. The
// bindings: sessionChainBindings.ts, receiptBindings.ts, workcellBindings.ts. The Run, Tasks and Runs are no devices (a task's panels, the
// session's mixer row and lanes, its takes — Clip view's and the views'), and nothing publishes them: the browser lists none (ticket 788).
import {Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent} from 'react'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, publishedDevice, selectDevice, subscribeDeviceDoor} from '../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import type {DesignBinding} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {useDesign} from '../../frame/devices/designs'
import {openInstrument} from '../../frame/instrumentDoor'
import {agentAddress} from '../../inhabitants/agentParamAddresses'
import {useRosterAnswer} from '../../owners/readers'
import {SETTINGS_PROJECT} from '../clipBinding'
import {useAgentSessionsOptional} from '../AgentSessionsProvider'
import {useAgentShell, type AgentDeviceId} from '../AgentShellContext'
import {threadTrackOf} from '../threadTrack'
import {trackKey} from '../agentRunModel'
import {
  AGENT_CHAIN_MIME, MISSING_OPS, activeChainDrag, chainDropDecision, chainInsertIndex, decodeChainDrag, dropZoneLine,
  encodeChainDrag, missingOpRemedy, setActiveChainDrag, type ActiveChainDrag, type AgentChainSlotId,
} from '../agentChainDrag'
import {agentDataI} from '../agentFidelity'
import {fireWritePath} from '../agentNativeDispatch'
import {harnessAgentControl} from '../harnessAgentControl'
import {RefusalCard, safeJson} from '../RefusalCard'
import {CHAIN_DEVICE_IDS, agentChainDevices, chainDeviceId, rackMemberDevice, type ChainWrite} from './agentChainDevices'
import {chainPicture, type PictureContext} from './AgentDevicePictures'
import {
  AGENT_DESIGN, AGENT_P0_ROWS, GATEWAY_DESIGN, LANDING_DESIGN, MEMBER_DESIGN, MEMBER_DEVICE_ID, RACK_DESIGN, SCOPE_DESIGN, SLOT_DESIGN_FACE, agentBinding, designWaits,
  gatewayBinding, memberBinding,
  holdView, memberChains, rackBinding, scopeBinding, seatedProfile, useChainHolds, viewHolds, type AgentRows, type MemberPorts, type RackUpkeep,
} from './designBindings'
import {useOwnerAccepted} from './ownerAccepted'
import {useSelectedSkillChain} from './skillRackSelection'
import {useAgentChainReading} from './useAgentChainReading'
import {RACK_PROJECT, composePorts, useRackReading} from './useRackReading'
import {observedState, useEncounterSessions} from './EncounterObservers'
import {FRAMES_ID, mainDevices} from './mainTrackBindings'
import {shownSession, threadBinding, threadJson} from './threadBinding'
import {CAPTURE_PAGE, CHECKOUTS_PAGE, HELPER_PAGE, MACHINE_PAGE, SEAT_PAGE, carryPages, composeAgentBinding} from './oneAgentBinding'
import {useHygieneDevice} from '../../central/devices/groundDevices'
import {openNotificationTarget, useOwnerRequests} from '../../widgets/railDevices'
import {openedHold, openedOf, withOwnerRequests} from '../../widgets/railBindings'
import {useMachineDevice} from '../../central/devices/machineDevice'
import {useIdentityDevice} from '../../central/devices/agentChainDevices'
import {PERSONAL_ANCHOR_ACTION, acceptSourceReturn, personRefOf, rejectSourceReturn} from '../../central/devices/sourceReturnAccept'
import {commentSourceReturn, withReturnComments} from '../../central/devices/sourceReturnComment'
import {receiving} from '../../../../../../desktop/cradle/src/receiving/client'
import {useUnitDecisions, waitingDecisions} from './unitDecisions'
import {useCentralAction} from '../../central/devices/useCentralReadings'
import {useAtSearch} from '../../central/searchPane'
import {useModelCatalogue} from './useModelCatalogue'
import {useAttemptTakes} from '../../owners/attemptTakes'
import {useTaskAnswer, useWorkcellAnswer} from '../../owners/readers'
import {usePopulationAnswer} from './usePopulationAnswer'
import {
  AGENTSET_DESIGN, AGENTSET_ID, agentsetBinding, custodyBinding, sessionDevices, type CustodyPorts,
} from './sessionChainBindings'
import {APPROVALS_DESIGN, APPROVALS_ID, approvalsBinding, receiptDevices} from './receiptBindings'
import {CARRIER_DESIGN, CARRIER_ID, carrierBinding, connectionLabels, gitBinding, planRunOf, runDemandOf, seatBinding, workcellDevices, type SeatPorts} from './workcellBindings'
import {ROUTE_WORDS, aikitWriteOp, deskActorOf, factoryOwnerWrite, ownerRouteWrite, refusalWords, seatWriteOp} from './ownerRoutes'
import {worldsOf} from './workcellMaterial'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import {WORKCELL_RACK_DESIGN, WORKCELL_RACK_ID, chosenWorld, workcellGitReading} from './workcellRackBinding'
import {AGENT_SLOTS, chainSlots, factoryPlace, type FactorySlot} from './factoryPlaces'
import {useOwnerOp} from '../../owners/ownerCall'
import type {AikitWriteRequest, KernelOp} from '../../../../../../desktop/cradle/src/kernel/types'
import {decisionHelperBinding} from './decisionHelperBinding'
import {captureSkillBinding, type CaptureSkillPorts} from './captureSkillBinding'
import {RUN_MAP_DESIGN, RUN_MAP_ID, runMapBinding, runMapDevice} from './runMapBinding'
import {PROMPT_PADS_DESIGN, PROMPT_PADS_ID, padsLocation, promptPadsBinding, promptPadsDevice, type PromptPadsPorts} from './promptPadsBinding'
import {useDecisionHelperReadings} from './decisionHelperReads'
import {useActuationRead, useAikitRead, useConnectionShows, useSeatStatusAnswer, useSourceReturnsAnswer, useWorkcellRead} from './workcellReads'
import {workcellTrackId} from '../../frame/tracks/returnTracks'
import '../agentShell.css'
import './factoryDevices.css'

/** The slot hooks, keyed like the mockup oracle (`label|function`); worded as the chain's cards worded them
 * (NativeAgentDeviceRack.tsx:30-43). */
const SLOT_DATA_I: Readonly<Record<string, string>> = {
  gateway: agentDataI('Gateway · hermes', 'How the workcell\'s agents reach their harness: the harness connection (Hermes tui_gateway, JSON-RPC over stdio or WebSocket). Frames flow along the link; the ring is the replay buffer; the outer pulse is the heartbeat.'),
  agent: agentDataI('Agent · agent', 'Compact. Click: expand in the pool. Thread ↗: open its thread full.'),
  skillset: agentDataI('Skillset rack', 'Skills as chains (light = admitted); macros steer several at once.'),
  world: agentDataI('World · bridge', 'What the session may read (teal) and write (amber).'),
  git: agentDataI('Git', 'The workcell’s seat of the project, and how its work lands. The diagram is the branch against main; the pulsing hollow dot is uncommitted work.'),
}
const DROP_ZONE_DATA_I = agentDataI('Drop zone', 'Gateways, agents, skillsets, worlds, git. Left to right: through → who → how → where → lands.')

/** The outcome of one drop attempt or one write: the owner's receipt, or the refusal that names the missing operation. */
interface ChainNote {
  kind: 'receipt' | 'refused'
  title: string
  line: string
  receipt: string | null
}

/** Where a drop landed: the dashed zone or a named card. */
type ChainDropTarget = {kind: 'zone'; label: string} | {kind: 'card'; id: string; label: string}

/** The hold the Factory Agent's Identity page keeps its choices under (the agent, the World, Proposed), apart from Central's Agent's. */
const FACTORY_IDENTITY_ID = `${chainDeviceId('agent')}/identity`
/** Central's personal anchor takes no input: one held object, so the read is asked once. */
const NO_INPUT: Readonly<Record<string, unknown>> = Object.freeze({})
/** AIKit's capture inbox (lane W3's aikit_read {inbox}), read while the Skillset rack stands on the armed track's chain, for its Capture page
 * (§19.11). */
const CAPTURE_INBOX: KernelOp = Object.freeze({op: 'aikit_read' as const, request: {kind: 'inbox' as const, project: RACK_PROJECT}})
/** Where Factory keeps the shell's project (factory_owner locate), for the Prompt pads' bank. */
const PADS_LOCATE: KernelOp = Object.freeze({op: 'factory_owner' as const, request: {kind: 'locate', project: RACK_PROJECT}})
/** Actuation's authority list (lane W3 round 3's actuation_read {authority-list}), read while a session's chain stands (Custody's Grants). */
const AUTHORITY_LIST: KernelOp = Object.freeze({op: 'actuation_read' as const, request: {kind: 'authority-list' as const}})

/** The slots whose designs this chain binds, with the design each draws. */
const SLOT_DESIGNS: Readonly<Record<string, string>> = {gateway: GATEWAY_DESIGN, agent: AGENT_DESIGN, skillset: RACK_DESIGN, world: SCOPE_DESIGN, git: LANDING_DESIGN}

/** `workcell`: the workcell whose return track is selected (frame/tracks/returnTracks.ts workcellOfTrack) — its chain stands in place of a
 * session's or the Main track's. */
export function FactoryDeviceChain({sessionRef, workcell = null}: {sessionRef: string | null; workcell?: string | null}) {
  const shell = useAgentShell()
  const {reading, transport, binding, resolved, harnesses} = useAgentChainReading(sessionRef)
  // The settings an owner accepted on this harness: the only readings effort and input have. The shell's own effort, steer,
  // heartbeat and write-arm flags are presentation, so they are not read here.
  const accepted = useOwnerAccepted(binding)
  const sessions = useAgentSessionsOptional()
  const track = sessionRef != null ? sessions?.tracks.find(item => item.sessionRef === sessionRef) ?? null : null
  const holds = useChainHolds()
  // The catalogue's designs, and whether each can be hosted on its owner yet (designBindings.ts designWaits).
  const gatewayDesign = useDesign(GATEWAY_DESIGN, true), agentDesign = useDesign(AGENT_DESIGN, true), rackDesign = useDesign(RACK_DESIGN, true)
  const memberDesign = useDesign(MEMBER_DESIGN, true), scopeDesign = useDesign(SCOPE_DESIGN, true), landingDesign = useDesign(LANDING_DESIGN, true)
  const waits: Readonly<Record<string, string | null>> = useMemo(() => ({
    gateway: designWaits(GATEWAY_DESIGN, gatewayDesign), agent: designWaits(AGENT_DESIGN, agentDesign), skillset: designWaits(RACK_DESIGN, rackDesign),
    world: designWaits(SCOPE_DESIGN, scopeDesign), member: designWaits(MEMBER_DESIGN, memberDesign), git: designWaits(LANDING_DESIGN, landingDesign),
  }), [gatewayDesign, agentDesign, rackDesign, memberDesign, scopeDesign, landingDesign])
  const [note, setNote] = useState<ChainNote | null>(null)
  // The gesture-held drag, mirrored into state so the zone names what is held and a slide's drop slot opens.
  const [held, setHeld] = useState<ActiveChainDrag | null>(null)
  const [gap, setGap] = useState<number | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)

  // A write goes to the row's own write path through the one resolver; its receipt is the chain's note (as the transport's is).
  const write = useCallback<ChainWrite>(async (row, value) => {
    const receipt = await fireWritePath(row, value, {transport, binding})
    setNote(receipt.kind === 'fired'
      ? {kind: 'receipt', title: row.title, line: receipt.note, receipt: receipt.outcome !== undefined ? safeJson(receipt.outcome) : null}
      : {kind: 'refused', title: `${row.title} refused`, line: receipt.missingOp ? `${receipt.reason} — missing op: ${receipt.missingOp}` : receipt.reason, receipt: null})
    return receipt
  }, [transport, binding])

  // A slot whose design is bound draws by that design's face (the world slot by Software Factory's Scope).
  const designedFaces = useMemo(() => Object.fromEntries(Object.entries(SLOT_DESIGN_FACE).filter(([slot]) => !waits[slot])), [waits])
  const chain = useMemo(() => agentChainDevices({sessionRef, reading, accepted}, write, designedFaces), [sessionRef, reading, accepted, write, designedFaces])
  const pictures: PictureContext = {reading, sessionRef, onFrames: () => shell.toggleTile('frames'), onThread: () => shell.openThread(sessionRef)}

  // The Gateway: the harness reading's own fields; its settings through the address table's rows (stall-after with the design's
  // stops as its domain — the device's generic row withholds it for want of one, agentChainDevices.ts GATEWAY_STALL).
  const gatewayDesignBinding = useMemo(() => {
    if (waits.gateway) return null
    const rows = chain.find(entry => entry.slot.id === 'gateway')?.device.rows ?? []
    const stall = agentAddress('gateway', 'stall-after')
    return gatewayBinding(chainDeviceId('gateway'), {reading, harness: {binding, resolved}}, {
      transport: rows.find(row => row.key === 'transport'), approvals: rows.find(row => row.key === 'approvals'), connect: rows.find(row => row.key === 'connect'),
      ...(stall ? {stallAfter: {...stall, title: 'Stall after'}} : {}),
    }, write)
  }, [waits.gateway, chain, reading, binding, resolved, write])

  // The Agent: its rows' own write paths — the address table's (effort, input, heartbeat) and the declared P0 rows
  // (designBindings.ts AGENT_P0_ROWS: interrupt timing and the steer line on Actuation's face, the new task on Software Factory's).
  const agentRows = useMemo((): AgentRows => {
    const rows = chain.find(entry => entry.slot.id === 'agent')?.device.rows ?? []
    return {
      effort: rows.find(row => row.key === 'effort'), input: rows.find(row => row.key === 'input'), heartbeat: rows.find(row => row.key === 'heartbeat'),
      ...AGENT_P0_ROWS,
    }
  }, [chain])
  const steering = useRef(shell.steer)
  steering.current = shell.steer
  // The conversations: the session the Thread shows (the selection's, as the thread pane resolves it, or the one it is pinned to)
  // and the chain's own, each through the one encounter observer the pane shares (EncounterObservers.tsx).
  const tracks = sessions?.tracks ?? null
  const selectedThread = useMemo(() => (tracks ? threadTrackOf(tracks, shell.selectedTrackId, shell.threadTrackId)?.sessionRef ?? null : null),
    [tracks, shell.selectedTrackId, shell.threadTrackId])
  const shown = shownSession({selected: selectedThread, holds})
  const observed = useMemo(() => [...new Set([shown, sessionRef])].flatMap(ref => {
    const held = ref ? tracks?.find(item => item.sessionRef === ref && !item.group) : undefined
    return held ? [{ref: held.sessionRef, space: held.spaceRef}] : []
  }), [shown, sessionRef, tracks])
  const {handles, observers} = useEncounterSessions(observed)
  const models = useModelCatalogue(transport, !waits.agent)
  const agentThread = useMemo(() => (sessionRef ? threadJson(observedState(handles[sessionRef]), track?.agentName ?? null) : undefined), [handles, sessionRef, track?.agentName])
  // The Agent's Context page (lane W8): AIKit's continuity pressure and armed commands, read while a session's chain stands.
  const contextOn = !waits.agent && sessionRef != null
  const continuityPressure = useAikitRead(transport, contextOn ? {kind: 'continuity-pressure', project: RACK_PROJECT} : null)
  const continuityCommands = useAikitRead(transport, contextOn ? {kind: 'continuity-commands', project: RACK_PROJECT} : null)
  // The last turn's bounded blocks (W11): AIKit's kept turn for the session (`aikit work continuity turn --session S`).
  const continuityTurn = useAikitRead(transport, contextOn ? {kind: 'continuity-turn', project: RACK_PROJECT, session: sessionRef} : null)
  const context = useMemo(() => (contextOn ? {pressure: continuityPressure, commands: continuityCommands, turn: continuityTurn} : undefined),
    [contextOn, continuityPressure, continuityCommands, continuityTurn])
  // The model the session last reported using (lane K0): Actuation's usage records of the session.
  const sessionUsage = useActuationRead(transport, contextOn ? {kind: 'usage-list', session: sessionRef} : null)
  const agentDesignBinding = useMemo(() => (waits.agent ? null : agentBinding(chainDeviceId('agent'), {
    sessionRef, track, nowUnixMs: sessions?.nowUnixMs ?? 0, reading, accepted, harness: {binding, resolved}, holds, thread: agentThread, models, harnesses, events: sessions?.events ?? null,
    ...(context ? {context} : {}), ...(contextOn ? {usage: sessionUsage} : {}),
  }, agentRows, write, () => steering.current)), [waits.agent, sessionRef, track, sessions?.nowUnixMs, reading, accepted, binding, resolved, holds, agentRows, write, agentThread, models, harnesses,
    sessions?.events, context, contextOn, sessionUsage])

  // The Agent's Thread page (its Full): the shown session's conversation; its composer, Input and timing the Agent's; Approve and Hard
  // stop that session's own encounter verbs; choosing a session moves THE selection.
  const shownHandle = shown ? handles[shown] : undefined
  const threadDesignBinding = useMemo(() => {
    const state = observedState(shownHandle)
    const actions = shownHandle && 'actions' in shownHandle ? shownHandle.actions : undefined
    return threadBinding({selected: selectedThread, chainSession: sessionRef, tracks, nowUnixMs: sessions?.nowUnixMs ?? 0,
      encounter: state ? {reading: state.reading, status: state.status} : null, agent: agentDesignBinding?.values ?? {}, holds}, agentDesignBinding, {
      ...(actions ? {permission: (id: string, decision: Parameters<typeof actions.permission>[1]) => actions.permission(id, decision), cancel: async () => actions.cancel()} : {}),
      select: ref => { const chosen = tracks?.find(item => item.sessionRef === ref && !item.group); if (chosen) shell.setSelectedTrackId(trackKey(chosen)) },
    })
  }, [shownHandle, selectedThread, sessionRef, tracks, sessions?.nowUnixMs, agentDesignBinding, holds, shell])

  // The Tasks and Runs devices were retired (ticket 725: a task is a clip, its attempts the track's takes in Arrangement view, §16.1, §19.1),
  // and their constructors with them (ticket 772): a task's settings are its Clip view's (agent/clipBinding.ts useFactoryClip), its attempts the
  // take lanes' (owners/attemptTakes.ts), and the Journey the Run map's (§19.25).

  // Factory's Main track devices: the Run map, Approvals and the Prompt pads (below). The Ledger, Messages, the Frames tile (the Gateway's
  // widget) and the workcell rack stand on the rail in every mode: AgentRailDevices.tsx publishes them, not this chain.
  const main = useMemo(() => mainDevices(), [])
  // Workcell's status, the window's one answer (owners/readers.ts): the Remote carrier's machines.
  const workcellAnswer = useWorkcellAnswer(transport).reading
  // The Prompt pads (§19.22, lane W8): the shell's project located by Factory, its bank read, each setting written through pads-write.
  const padsLocated = useOwnerOp(transport, PADS_LOCATE, 'factory_development_reading').reading
  const padsWhere = padsLocated.status === 'answered' ? padsLocation(padsLocated.value?.data) : null
  const padsBankOp = useMemo((): KernelOp | null => (padsWhere && 'projectRef' in padsWhere
    ? {op: 'factory_owner', request: {kind: 'pads-read', state_path: padsWhere.statePath, project_ref: padsWhere.projectRef}} : null),
  [padsWhere && 'projectRef' in padsWhere ? padsWhere.statePath : null, padsWhere && 'projectRef' in padsWhere ? padsWhere.projectRef : null]) // eslint-disable-line react-hooks/exhaustive-deps
  const padsBank = useOwnerOp(transport, padsBankOp, 'factory_development_reading').reading
  const padsPorts = useMemo((): PromptPadsPorts => (transport.kind !== 'unavailable'
    ? {write: request => factoryOwnerWrite(transport, {kind: 'pads-write', ...request}, '`factory development pads-write`')} : {}), [transport])
  const padsInput = useMemo(() => ({
    located: {status: padsLocated.status, value: padsLocated.value?.data ?? null, error: padsLocated.error},
    ...(padsBankOp ? {bank: {status: padsBank.status, value: padsBank.value?.data ?? null, error: padsBank.error}} : {}), holds,
  }), [padsLocated, padsBank, padsBankOp, holds])
  const mainBindings = useMemo(() => ({runMap: runMapBinding(holds), pads: promptPadsBinding(padsInput, padsPorts)}), [holds, padsInput, padsPorts])
  // The Run map and the Prompt pads (§19.25, §19.22, lane W7): bound, standing where Software Factory's family admits their faces.
  const runMapDev = useMemo(() => runMapDevice(), [])
  const padsDev = useMemo(() => promptPadsDevice(), [])
  const designsMain = {runMap: useDesign(RUN_MAP_DESIGN, true), pads: useDesign(PROMPT_PADS_DESIGN, true)}

  // The rack: the seated agent's carried practice (its accepted profile in the roster, the sets AIKit replies for), and the
  // composition through the configuration plane. Read only while its design can draw it.
  const roster = useRosterAnswer(transport, null).reading
  const profile = useMemo(() => seatedProfile(roster.status === 'answered' ? roster.value : null, track?.agentRef ?? null), [roster, track?.agentRef])
  const [planeEpoch, setPlaneEpoch] = useState(0)
  const rackOn = !waits.skillset
  const rackReading = useRackReading(transport, profile, holds.compose.scope, sessionRef, rackOn, planeEpoch)
  const ports = useMemo(() => composePorts(transport, () => setPlaneEpoch(epoch => epoch + 1)), [transport])
  // The rack's upkeep pages (lanes W8, W9): AIKit's unused, source, collate, bypass and procedure lists, the plan for the root chosen, and
  // its writes.
  const rackHeld = viewHolds(holds, chainDeviceId('skillset'))
  const upkeepUnused = useAikitRead(transport, rackOn ? {kind: 'unused'} : null)
  const upkeepSources = useAikitRead(transport, rackOn ? {kind: 'source-list'} : null)
  const upkeepCollate = useAikitRead(transport, rackOn ? {kind: 'collate'} : null)
  const upkeepBypasses = useAikitRead(transport, rackOn ? {kind: 'bypass-list'} : null)
  const upkeepProcedures = useAikitRead(transport, rackOn ? {kind: 'procedure-list'} : null)
  const adoptRoot = typeof rackHeld.adoptRoot === 'string' && rackHeld.adoptRoot ? rackHeld.adoptRoot : null
  const adoptNamespace = typeof rackHeld.namespace === 'string' && rackHeld.namespace ? rackHeld.namespace : null
  const upkeepAdoption = useAikitRead(transport, rackOn && adoptRoot ? {kind: 'adopt-plan', root: adoptRoot, ...(adoptNamespace ? {namespace: adoptNamespace} : {})} : null)
  // The procedure chosen (W9): its kind and digest from `aikit procedure diff` (Run applies it only at the digest read).
  const chosenProcedure = typeof rackHeld.procedure === 'string' && rackHeld.procedure ? rackHeld.procedure : null
  const upkeepProcedure = useAikitRead(transport, rackOn && chosenProcedure ? {kind: 'procedure-diff', procedure: chosenProcedure} : null)
  const upkeep = useMemo((): RackUpkeep => ({unused: upkeepUnused, sources: upkeepSources, collate: upkeepCollate, bypasses: upkeepBypasses, procedures: upkeepProcedures,
    ...(adoptRoot ? {adoption: upkeepAdoption} : {}), ...(chosenProcedure ? {procedure: upkeepProcedure} : {}),
    ...(transport.kind !== 'unavailable' ? {write: request => ownerRouteWrite(transport, aikitWriteOp(request as AikitWriteRequest), `\`aikit ${request.kind.replace('-', ' ')}\``)} : {})}),
  [upkeepUnused, upkeepSources, upkeepCollate, upkeepBypasses, upkeepProcedures, upkeepAdoption, adoptRoot, upkeepProcedure, chosenProcedure, transport])
  const rackDesignBinding = useMemo(() => (rackOn ? rackBinding(chainDeviceId('skillset'), {profile, ...rackReading, holds}, ports, {project: RACK_PROJECT, sessionRef}, upkeep) : null),
    [rackOn, profile, rackReading, holds, ports, sessionRef, upkeep])
  // The member: the rack's chosen chain, one device inside the rack (§19.7).
  const memberOn = rackOn && !waits.member
  const chosen = useSelectedSkillChain(rackDesignBinding ? memberChains(rackDesignBinding.values) : null)
  const memberDevice = useMemo(() => (memberOn ? rackMemberDevice(MEMBER_DEVICE_ID) : null), [memberOn])
  // Trust (lane W3): the review recorded with AIKit through the kernel's aikit_write trust-record, in the rack's project.
  // The member's Why and History (lane W8): AIKit's explain and history of the chosen capability.
  const memberWhy = useAikitRead(transport, memberOn && chosen ? {kind: 'explain', resource: chosen} : null)
  const memberHistory = useAikitRead(transport, memberOn && chosen ? {kind: 'history', resource: chosen} : null)
  const memberPorts = useMemo((): MemberPorts => ({why: memberWhy, history: memberHistory,
    ...(transport.kind !== 'unavailable' ? {trust: capability => ownerRouteWrite(transport, aikitWriteOp({kind: 'trust-record', project: RACK_PROJECT, capability}), ROUTE_WORDS.trust)} : {})}),
  [transport, memberWhy, memberHistory])
  const memberDesignBinding = useMemo(() => (memberDevice && rackDesignBinding ? memberBinding(MEMBER_DEVICE_ID, rackDesignBinding.values, chosen, holds, memberPorts) : null),
    [memberDevice, rackDesignBinding, chosen, holds, memberPorts])
  // Scope: the world row's write path for the write mode; a raised reach held until Confirm.
  const writeModeRow = chain.find(entry => entry.slot.id === 'world')?.device.rows.find(row => row.key === 'write-mode')
  const scopeDesignBinding = useMemo(() => (waits.world ? null : scopeBinding(chainDeviceId('world'), holds, writeModeRow, write)), [waits.world, holds, writeModeRow, write])
  // Where the Device side stands (factoryPlaces.ts): a workcell's return track, a session (or a group), or the Main track.
  const groupTrack = track && track.group ? track : null
  const place = factoryPlace({sessionRef, group: !!groupTrack, workcell})
  const cellName = place.kind === 'workcell' ? place.name : null
  // A session's own chain stands (not a workcell's).
  const sessionChain = sessionRef != null && cellName == null
  // The Skillset rack's Capture page (§19.11, lane W7; Capture skill was retired into it in the 22 Oct manual rewrite): on the armed
  // track's chain — the selected session's, never a group's. It reads the proposal that waits in AIKit's inbox and writes Accept through
  // aikit_write promote.
  const captureOn = sessionChain && !groupTrack
  const captureInbox = useOwnerOp(transport, captureOn ? CAPTURE_INBOX : null, 'owner_route_reading').reading
  const capturePorts = useMemo((): CaptureSkillPorts => (transport.kind !== 'unavailable'
    ? {promote: (candidate, id) => ownerRouteWrite(transport, aikitWriteOp({kind: 'promote', project: RACK_PROJECT, candidate, ...(id ? {id} : {})}), '`aikit promote`')} : {}), [transport])
  const captureDesignBinding = useMemo(() => captureSkillBinding({inbox: {status: captureInbox.status, value: captureInbox.value?.data ?? null, error: captureInbox.error},
    holds}, capturePorts), [captureInbox, holds, capturePorts])
  // The seat instrument (lane K1's seat_status_read: slow, read once while a session's or a workcell's chain stands, and on demand): the
  // workcell's seats, the Seat, Git / landing on a workcell's chain, and the Workcells tile.
  const seats = useSeatStatusAnswer(transport, sessionRef != null || cellName != null).reading
  // Git / landing: on a workcell's chain, that workcell's seat of the project (its branch, the files with no commit); elsewhere — on the
  // door, on no chain — the chain's git reading. Every act stands disabled.
  const gitReading = useMemo(() => (cellName ? workcellGitReading(seats, cellName, RACK_PROJECT) : reading), [cellName, seats, reading])
  const gitDesignBinding = useMemo(() => (waits.git ? null : gitBinding(gitReading, holds)), [waits.git, gitReading, holds])
  // The one Agent (R4): its Custody page on the session's custody (its write mode Scope's), its Identity page on the roster card of the
  // session's own agent (the hold keyed apart from Central's Agent), its Thread page the Thread's binding — each composed under its prefix.
  // Custody's Grants page (lane W8): Actuation's authority list, and Revoke as the current person's own press — Actuation authenticates no
  // issuer, so the binding writes only as the person `currentIdentity()` names.
  const grantsRead = useOwnerOp(transport, sessionRef != null ? AUTHORITY_LIST : null, 'owner_route_reading').reading
  const grants = useMemo(() => ({status: grantsRead.status, value: grantsRead.value?.data ?? null, error: grantsRead.error ? refusalWords(grantsRead.error) : null,
    readAtUnixMs: grantsRead.readAtUnixMs}), [grantsRead])
  const custodyPorts = useMemo((): CustodyPorts => (transport.kind !== 'unavailable'
    ? {revoke: (authority_source_ref, reason) => ownerRouteWrite(transport, {op: 'actuation_write', request: {kind: 'authority-revoke', authority_source_ref, ...(reason ? {reason} : {})}}, '`actuation authority revoke`'),
      assign: request => factoryOwnerWrite(transport, request, '`factory development custody assign`'),
      personNow: () => currentIdentity()?.reading.person_ref ?? null}
    : {}), [transport])
  const currentPerson = currentIdentity()?.reading.person_ref ?? null
  // Factory's custody of the session's work (W11): the project's Factory state (located for the pads), its custody list, the Position the
  // session's agent holds (AIKit's population: Custody sits on the Agent, §19.4), and the session's bound task as its work.
  const custodyState = padsWhere && 'projectRef' in padsWhere ? padsWhere.statePath : null
  const custodyListing = useOwnerOp(transport, custodyState && sessionRef != null ? {op: 'factory_owner', request: {kind: 'custody-list', state_path: custodyState}} : null,
    'factory_development_reading').reading
  const custodyPopulation = usePopulationAnswer(transport, RACK_PROJECT)
  const sessionTask = useTaskAnswer(transport, sessionRef).reading
  const custodyRead = useMemo(() => {
    const positions = custodyPopulation.status === 'answered' && custodyPopulation.value && typeof custodyPopulation.value === 'object'
      && Array.isArray((custodyPopulation.value as {positions?: unknown}).positions) ? (custodyPopulation.value as {positions: {position_ref?: unknown; occupancy?: {agent_ref?: unknown}}[]}).positions : []
    const heldBy = (ref: string | null | undefined) => (ref ? positions.find(row => row.occupancy?.agent_ref === ref && typeof row.position_ref === 'string')?.position_ref as string | undefined ?? null : null)
    const central = (sessionTask.value as {request?: {central?: {task_ref?: unknown}}} | null | undefined)?.request?.central
    return {statePath: custodyState, listing: custodyState ? {status: custodyListing.status, value: custodyListing.value?.data ?? null, error: custodyListing.error ? refusalWords(custodyListing.error) : null} : null,
      agentPosition: heldBy(track?.agentRef), work: typeof central?.task_ref === 'string' && central.task_ref.trim() ? central.task_ref : null}
  }, [custodyState, custodyListing, custodyPopulation, sessionTask, track?.agentRef])
  const custodyDesignBinding = useMemo(() => custodyBinding({sessionRef, autonomy: reading.autonomy, agent: agentDesignBinding?.values ?? {}, holds, grants, person: currentPerson,
    custody: custodyRead}, scopeDesignBinding, custodyPorts), [sessionRef, reading.autonomy, agentDesignBinding, scopeDesignBinding, holds, grants, currentPerson, custodyRead, custodyPorts])
  const identityDesignBinding = useIdentityDevice(transport, track?.agentRef ?? null, FACTORY_IDENTITY_ID)
  const oneAgent = useMemo(() => (agentDesignBinding ? composeAgentBinding(agentDesignBinding, {custody: custodyDesignBinding, identity: identityDesignBinding, thread: threadDesignBinding}) : null),
    [agentDesignBinding, custodyDesignBinding, identityDesignBinding, threadDesignBinding])
  // The line where you type @ (§18.4): an @ word in the Agent's composer opens Search in a pane on it (central/searchPane.tsx).
  useAtSearch(typeof oneAgent?.values.draft === 'string' ? oneAgent.values.draft : undefined)
  // Git / landing's Seat page: the seat instrument, starting at the selected workcell's seat of the project.
  const seatsUnread = seats.status === 'refused' && seats.error ? seats.error : undefined
  // Join and Release (lane W3): the seat instrument through the kernel's seat_write, attributed to the desk's actor — the person's ref when
  // an identity is current, else the desktop's own (ownerRoutes.ts deskActorOf). The claim it writes is read back on the next seat reading.
  const deskActor = deskActorOf(currentIdentity()?.reading.person_ref ?? null)
  const machineRef = workcellAnswer.status === 'answered' && workcellAnswer.value && typeof (workcellAnswer.value as {workcell_ref?: unknown}).workcell_ref === 'string'
    ? (workcellAnswer.value as {workcell_ref: string}).workcell_ref : undefined
  const seatPorts = useMemo((): SeatPorts => (transport.kind !== 'unavailable'
    ? {seat: request => ownerRouteWrite(transport, seatWriteOp(request), request.kind === 'join' ? ROUTE_WORDS.join : ROUTE_WORDS.release)} : {}), [transport])
  const seatDesignBinding = useMemo(() => seatBinding({status: seats.status === 'answered' ? seats.value : null, ...(seatsUnread ? {unread: seatsUnread} : {}),
    project: RACK_PROJECT, branch: reading.gitRepo.branch ?? null, workcell: cellName, ...(machineRef ? {machineRef} : {}), actor: deskActor, holds}, seatPorts),
  [seats, seatsUnread, reading.gitRepo.branch, cellName, machineRef, deskActor, holds, seatPorts])
  // The pages the chain's devices carry (oneAgentBinding.ts carryPages): the Skillset rack's Capture page; Git / landing's Seat page and, on
  // a workcell's chain, its Checkouts page (Ground hygiene's census).
  const rackCarrying = useMemo(() => (rackDesignBinding ? carryPages(rackDesignBinding, captureOn ? [{page: CAPTURE_PAGE, binding: captureDesignBinding}] : []) : null),
    [rackDesignBinding, captureOn, captureDesignBinding])
  const checkouts = useHygieneDevice(transport, cellName != null)
  const gitCarrying = useMemo(() => (gitDesignBinding ? carryPages(gitDesignBinding, [{page: SEAT_PAGE, binding: seatDesignBinding}, ...(cellName != null ? [{page: CHECKOUTS_PAGE, binding: checkouts}] : [])]) : null),
    [gitDesignBinding, seatDesignBinding, cellName, checkouts])
  const bindings: Readonly<Record<string, DesignBinding | null>> = useMemo(() => ({
    gateway: gatewayDesignBinding, agent: oneAgent, skillset: rackCarrying, world: scopeDesignBinding, git: gitCarrying,
  }), [gatewayDesignBinding, oneAgent, rackCarrying, scopeDesignBinding, gitCarrying])

  // The session's own device (lane BF3): for a group, the Agentset rack. (The Run was retired, ticket 725, and its constructor with it, ticket 772:
  // a session's course is its track in Arrangement view, §16.1.)
  const ownDevices = useMemo(() => sessionDevices(), [])
  const designsOwn = {agentset: useDesign(AGENTSET_DESIGN, true)}
  const agentsetDesignBinding = useMemo(() => agentsetBinding({group: groupTrack, tracks, models, holds, nowUnixMs: sessions?.nowUnixMs ?? 0}), [groupTrack, tracks, models, holds, sessions?.nowUnixMs])
  // The Agentset rack's Helper page (§19.20, T-AGENCY K5; the Decision helper was retired into it in the 22 Oct manual rewrite): on a
  // group's chain, on AIKit's decision provider and QL's team space — read only while the rack stands there.
  const helperStands = sessionRef != null && !!groupTrack
  const helperReadings = useDecisionHelperReadings(transport, helperStands)
  const helperDesignBinding = useMemo(() => decisionHelperBinding({status: helperReadings.status, teamSpace: helperReadings.teamSpace, holds}),
    [helperReadings.status, helperReadings.teamSpace, holds])
  const agentsetCarrying = useMemo(() => carryPages(agentsetDesignBinding, helperStands ? [{page: HELPER_PAGE, binding: helperDesignBinding}] : []),
    [agentsetDesignBinding, helperStands, helperDesignBinding])

  // The Main track's reader: Approvals on the shown session's consent requests and the project's source returns (lane K1's
  // source_returns_read); the default answer is the Gateway's, never Approvals' (ticket 788). The Ledger is a monitor on the rail
  // (AgentRailDevices.tsx).
  const receipts = useMemo(() => receiptDevices(), [])
  const designsReceipts = {approvals: useDesign(APPROVALS_DESIGN, true)}
  const shownTrack = shown ? tracks?.find(item => item.sessionRef === shown && !item.group) ?? null : null
  const returns = useSourceReturnsAnswer(transport, RACK_PROJECT).reading
  const returned = returns.status === 'answered' ? returns.value : null
  // Factory's unit decisions (W9): the questions the shown session's Runs wait on (unitDecisions.ts), read from the Runs its takes name.
  const shownTakesAll = useAttemptTakes(transport, shownTrack ? [shownTrack.sessionRef] : [], SETTINGS_PROJECT)
  const unitRuns = useMemo(() => {
    const takes = shownTakesAll && shownTrack ? shownTakesAll.of(shownTrack.sessionRef) ?? [] : []
    return takes.filter((take, at) => takes.findIndex(other => other.runRef === take.runRef && other.statePath === take.statePath) === at)
      .map(take => ({statePath: take.statePath, runRef: take.runRef}))
  }, [shownTakesAll, shownTrack])
  const unitsRead = useUnitDecisions(transport, unitRuns)
  const units = unitsRead.status === 'answered' ? unitsRead.value : null
  // Approve (W2): the person who accepts is the principal Central's personal anchor names; it is asked only while a proposal or a unit
  // decision waits (only the unit's resolver answers one).
  const waiting = !!returned?.entries.some(entry => entry.status === 'pending') || waitingDecisions(units).length > 0
  const anchor = useCentralAction(transport, PERSONAL_ANCHOR_ACTION, waiting ? NO_INPUT : null)
  const person = anchor.status === 'answered' ? personRefOf(anchor.value) : null
  // Changes (W9): a comment on the waiting return in the words written in the thread — the Agent's composer — through Central's
  // projectcentral.source.return_comment (central/devices/sourceReturnComment.ts); once Central keeps it, the composer is cleared.
  const agentDraft = typeof oneAgent?.values.draft === 'string' ? oneAgent.values.draft : null
  const agentWrite = oneAgent?.write
  const ownerRequests = useOwnerRequests(transport)
  const approvalsDesignBinding = useMemo(() => {
    const state = observedState(shownHandle)
    const actions = shownHandle && 'actions' in shownHandle ? shownHandle.actions : undefined
    // Approvals is handed no Gateway: the default answer is the Gateway's own, set on the Gateway (§19.14, §19.2; ticket 788).
    const binding = approvalsBinding({session: shownTrack, encounter: state?.reading ?? null, holds,
      returns: returned, tracks, nowUnixMs: sessions?.nowUnixMs ?? Date.now(), units, person},
      {...(actions ? {permission: (id, decision) => actions.permission(id, decision)} : {}),
        approve: row => acceptSourceReturn(transport, RACK_PROJECT, row, person),
        // Deny on a proposal (§19.14): Central's projectcentral.source.return_reject through invoke_action (sourceReturnAccept.ts).
        reject: row => rejectSourceReturn(transport, RACK_PROJECT, row),
        ...(transport.kind !== 'unavailable' ? {answerUnit: (project, review) => receiving(transport, project, review).catch(cause => { throw new Error(refusalWords(cause instanceof Error ? cause.message : String(cause))) })} : {})})
    const commented = withReturnComments(binding, {returns: returned, comment: agentDraft}, {
      send: (row, words) => commentSourceReturn(transport, RACK_PROJECT, row, words, person),
      after: () => { void agentWrite?.([{key: 'draft', value: ''}]) },
    })
    // Notifications' readings wait here under Requests (§23.9; the Notifications device was retired into Approvals in the 22 Oct manual
    // rewrite): the requests Central keeps for personal.notify, Messages' waiting agents and the desktop's notice (railBindings.ts
    // withOwnerRequests), as Central's Approvals carries them; Open marks an item opened here, after opening an owner's request.
    return withOwnerRequests(commented, {...ownerRequests, nowUnixMs: sessions?.nowUnixMs || Date.now()}, openNotificationTarget,
      {opened: openedOf(viewHolds(holds, APPROVALS_ID).opened), hold: ids => holdView(APPROVALS_ID, 'opened', openedHold(ids))})
  }, [shownHandle, shownTrack, holds, returned, tracks, sessions?.nowUnixMs, transport, person, units, agentDraft, agentWrite, ownerRequests])

  // A workcell's devices (§19.23): Git / landing's Seat page (the seat instrument), starting at the selected workcell's seat of the project;
  // the Remote carrier (Workcell's status) with its Machine page; and the workcell rack, which stands on the rail too (the Workcells tile), so
  // the rail's publisher holds it (AgentRailDevices.tsx) and this chain draws it from the door.
  const cells = useMemo(() => workcellDevices(), [])
  const designsCells = {carrier: useDesign(CARRIER_DESIGN, true), rack: useDesign(WORKCELL_RACK_DESIGN, true)}
  // The Remote carrier: Workcell's status, and each listed connection's record (`workcell connections show`, lane W3); its Standing page's
  // offers (`workcell discover`) and each connection's probe (`workcell connections probe`, a read that never writes the record; lane W10).
  const carrierLabels = connectionLabels(workcellAnswer)
  const shows = useConnectionShows(transport, carrierLabels)
  const discover = useWorkcellRead(transport, {kind: 'discover'}).answer
  const probe = useWorkcellRead(transport, carrierLabels.length ? {kind: 'connections-probe'} : null).answer
  // The carrier's Plan (W13): the run the chosen world's receipt names (the rack's world: chosenWorld, W12), its `workcell run show`, and
  // where its demand is kept, Workcell's plan for that demand (`--demand-json <path>`, first and alone).
  const carrierWorlds = useWorkcellRead(transport, {kind: 'worlds'}).answer
  const carrierWorld = chosenWorld(carrierWorlds, typeof machineRef === 'string' ? machineRef : null, viewHolds(holds, WORKCELL_RACK_ID).worldReceipt).chosen
  // The chosen world's run is the slug `workcell worlds` names for it (Workcell PR 122), never the receipt's subjects (W14).
  const runLedger = carrierWorlds.status === 'answered' ? worldsOf(carrierWorlds.value)?.runLedger : undefined
  const planRun = planRunOf(carrierWorld, runLedger, viewHolds(holds, CARRIER_ID).planRun)
  const carrierRun = planRun.ref
  // The runs the chosen world names, for the Standing page's chooser where there are several (O-I 757): held by their content, since the
  // listing is read anew each render. A run slug holds no line break, so the slugs joined by one are their key.
  const carrierRunsKey = carrierWorld?.runs ? carrierWorld.runs.join('\n') : null
  const carrierRuns = useMemo(() => (carrierRunsKey === null ? null : carrierRunsKey ? carrierRunsKey.split('\n') : []), [carrierRunsKey])
  const runShow = useWorkcellRead(transport, carrierRun ? {kind: 'run-show', run: carrierRun} : null).answer
  const keptDemand = runShow.status === 'answered' ? runDemandOf(runShow.value) : null
  const keptPath = keptDemand?.standing === 'kept' ? keptDemand.path ?? null : null
  const runPlan = useWorkcellRead(transport, keptPath ? {kind: 'plan', demand: {demand_json: keptPath}} : null)
  const carrierDesignBinding = useMemo(() => carrierBinding(workcellAnswer, holds, shows,
    {discover, ...(carrierLabels.length ? {probe} : {}), run: {ref: carrierRun, runs: carrierRuns, ...(planRun.why ? {why: planRun.why} : {}), ...(carrierRun ? {show: runShow} : {}), ...(keptPath ? {plan: runPlan.answer} : {})}},
    keptPath && transport.kind !== 'unavailable' ? {replan: runPlan.refresh} : {}),
  [workcellAnswer, holds, shows, discover, probe, carrierLabels.length, carrierRun, carrierRuns, planRun.why, runShow, keptPath, runPlan.answer, runPlan.refresh, transport])
  // The Remote carrier's Machine page (§18.7, §19.18 "The Machine page"; Central's Machine was retired into it in the 22 Oct manual
  // rewrite): Central's machine readings under `mc.`, read while a workcell's chain stands.
  const machine = useMachineDevice(transport, cellName != null)
  const carrierCarrying = useMemo(() => carryPages(carrierDesignBinding, [{page: MACHINE_PAGE, binding: machine}]), [carrierDesignBinding, machine])
  // The rack as the rail's publisher holds it, watched alone (another device's publish does not redraw the chain).
  const rackEntry = useSyncExternalStore(subscribeDeviceDoor, () => publishedDevice(WORKCELL_RACK_ID), () => publishedDevice(WORKCELL_RACK_ID))

  // Publish each device to the door: the pool shows the chosen one whole, a pane shows it full, from these same devices — a
  // designed device with its binding, so every place draws the design on the same owner values.
  // The Agent's own Full is its thread (§19.4 Full "The thread"): the design's Full on its Thread page (`thread.*`), so every ⤢ — the
  // chain's, the pool's, the rail's — opens the Agent itself. The Gateway's own Full is the Frames monitor (§19.2): its ⤢ opens the
  // monitor's pane.
  useEffect(() => {
    for (const {slot, device} of chain) publishDevice(device.id, {device, picture: size => chainPicture(slot.id, pictures, size), ...(bindings[slot.id] ? {binding: bindings[slot.id]!} : {}),
      ...(slot.id === 'gateway' && main.frames ? {full: {open: () => openDevice(FRAMES_ID, 'Frames')}} : {})})
    if (memberDevice && memberDesignBinding) publishDevice(memberDevice.id, {device: memberDevice, binding: memberDesignBinding})
    else publishDevice(MEMBER_DEVICE_ID, null)
  }, [chain, bindings, memberDevice, memberDesignBinding, main.frames]) // the pictures read the reading `chain` is built from
  useEffect(() => { publishDevice(RUN_MAP_ID, runMapDev ? {device: runMapDev, binding: mainBindings.runMap} : null) }, [runMapDev, mainBindings])
  useEffect(() => { publishDevice(PROMPT_PADS_ID, padsDev ? {device: padsDev, binding: mainBindings.pads} : null) }, [padsDev, mainBindings])
  useEffect(() => {
    const own = [[AGENTSET_ID, ownDevices.agentset, agentsetCarrying],
      [APPROVALS_ID, receipts.approvals, approvalsDesignBinding], [CARRIER_ID, cells.carrier, carrierCarrying]] as const
    for (const [id, device, designBinding] of own) publishDevice(id, device ? {device, binding: designBinding} : null)
  }, [ownDevices, receipts, cells, agentsetCarrying, approvalsDesignBinding, carrierCarrying])
  useEffect(() => () => {
    // The chain withdraws exactly what it publishes. The Thread and Custody (the Agent carries them, §19.4), Tasks and Runs (a task is a
    // clip, a run its track's take lanes, §19.1), the Run, the Experiment (a task launched with Repeat, §19.5) and the Seat (Git / landing's
    // Seat page, §19.17) publish nowhere, and the door is the session's memory, so no entry of theirs can stand to be cleared (ticket 804).
    // The Link is the transport's (§19.19), and the rail's agent devices — Messages, Frames, the Ledger, the workcell rack — are the rail's
    // publisher's (AgentRailDevices.tsx RAIL_AGENT_DEVICE_IDS): none of them is withdrawn here.
    for (const id of [...CHAIN_DEVICE_IDS, MEMBER_DEVICE_ID, AGENTSET_ID, APPROVALS_ID, CARRIER_ID, RUN_MAP_ID, PROMPT_PADS_ID]) publishDevice(id, null)
  }, [])

  const choose = (slotId: string) => { shell.setExpandedDevice(slotId as AgentDeviceId); selectDevice(chainDeviceId(slotId)) }
  const openDevice = (id: string, title: string) => {
    try { openInstrument(DEVICE_PANE_KIND, undefined, {ref: id, title}) }
    catch (cause) { setNote({kind: 'refused', title: 'Open full', line: cause instanceof Error ? cause.message : String(cause), receipt: null}) }
  }
  const openFull = (slotId: string, title: string) => openDevice(chainDeviceId(slotId), title)
  // The Agent's ⤢ opens the Agent full in a pane: its Full is its thread (§19.4 Views: Full "The thread"), drawn on the Thread page it
  // carries — the session's own conversation, never a picture of one. The agent tab's conversation (shell.openThread, the chain picture's
  // Thread ↗) stays where it was.
  const openAgentThread = () => openDevice(chainDeviceId('agent'), 'Agent')

  // One drop, one owner operation (or one named refusal). The session drop rides the run model's own selection — the who slot
  // then reads the new session's task record. The agent drop dispatches `harness_agent_control` (new) on the gateway binding and
  // folds the owner's outcome document as the receipt. That op takes a binding and a control word and no agent ref
  // (harnessAgentControl.ts), so what the drop does is start a NEW agent on the bound harness: the dragged agent is named in the
  // note and the harness is not told which one it was. Everything else refuses by name — the dragged item simply returns.
  // (Ported from AgentDeviceChain.tsx:199-243.)
  const attemptDrop = useCallback(async (active: ActiveChainDrag, target: ChainDropTarget) => {
    if (active.kind === 'reorder') {
      setNote({
        kind: 'refused',
        title: 'Slide refused',
        line: `«${active.reorder.title}» over ${target.label} — the chain composition is declared at the family door (through → who → how → where → lands); no owner operation reorders it — missing op: ${MISSING_OPS.order}; remedy: ${missingOpRemedy('order')}.`,
        receipt: encodeChainDrag(active.reorder),
      })
      return
    }
    const decision = chainDropDecision(active.drag)
    if (decision.kind === 'missing-op') {
      setNote({
        kind: 'refused',
        title: 'Drop refused',
        line: `«${active.drag.label}» onto ${target.label} — no owner operation admits it: missing op ${decision.missingOp} — ${decision.because}; owner ${decision.owner ?? 'not named'}; remedy: ${decision.remedy}.`,
        receipt: encodeChainDrag(active.drag),
      })
      return
    }
    if (decision.operation.kind === 'select-session') {
      shell.setSelectedTrackId(active.drag.ref)
      setNote({
        kind: 'receipt',
        title: 'Chain subject',
        line: `«${active.drag.label}» onto ${target.label} — the who slot reads this session’s task record (encounter_task_read follows the selection).`,
        receipt: null,
      })
      return
    }
    const outcome = await harnessAgentControl(transport, binding, decision.operation.control)
    const dragged = `«${active.drag.label}» (${active.drag.ref})`
    setNote(outcome.ok
      ? {
          kind: 'receipt',
          title: 'New agent started',
          line: `${dragged} onto ${target.label} — started a new agent on the harness bound as “${binding}”; the harness was not told which agent was dragged, because harness_agent_control carries no agent ref. ${outcome.note}`,
          receipt: outcome.document !== undefined ? safeJson(outcome.document) : null,
        }
      : {
          kind: 'refused',
          title: 'New agent refused',
          line: `${dragged} onto ${target.label} — harness_agent_control (${decision.operation.control}: a new agent on the bound harness, not the dragged one) answered: ${outcome.error}`,
          receipt: outcome.error,
        })
  }, [shell, transport, binding])

  // A drag that ends anywhere (dropped outside, cancelled, escaped) clears the held mirror and the drop slot — the dragged item
  // has returned either way (NativeAgentDeviceRack.tsx:127-135).
  useEffect(() => {
    const clear = () => { setHeld(null); setGap(null) }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => { window.removeEventListener('dragend', clear); window.removeEventListener('drop', clear) }
  }, [])
  const isChainDrag = (event: DragEvent<HTMLElement>) => event.dataTransfer.types.includes(AGENT_CHAIN_MIME)
  // The visible drop slot for a slide: the gap between cards under the pointer.
  const gapAt = (x: number) => chainInsertIndex(x, [...(rowRef.current?.querySelectorAll<HTMLElement>('[data-slot]:not([data-slot="zone"])') ?? [])].map(card => card.getBoundingClientRect()))
  const onRowDragOver = (event: DragEvent<HTMLElement>) => {
    if (!isChainDrag(event)) return
    event.preventDefault()
    const active = activeChainDrag()
    setHeld(active)
    event.dataTransfer.dropEffect = active?.kind === 'reorder' ? 'move' : 'copy'
    setGap(active?.kind === 'reorder' ? gapAt(event.clientX) : null)
  }
  const onRowDrop = (event: DragEvent<HTMLElement>) => {
    if (!isChainDrag(event)) return
    event.preventDefault()
    const active = decodeChainDrag(event.dataTransfer.getData(AGENT_CHAIN_MIME)) ?? activeChainDrag()
    const slotId = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot
    const card = chain.find(entry => entry.slot.id === slotId)?.slot
    const target: ChainDropTarget = card ? {kind: 'card', id: card.id, label: `«${card.title}»`} : {kind: 'zone', label: 'the drop zone'}
    setHeld(null)
    setGap(null)
    if (active) void attemptDrop(active, target)
  }
  const grip = (id: string, title: string) => (
    <span
      role="button" tabIndex={0} draggable className="agent-chain-grip"
      aria-label={`Slide ${title}: drag, or Alt+Arrow — the chain refuses: its composition is declared (missing op: agent-chain order)`}
      title="Slide — the chain refuses: the composition is declared"
      onClick={event => event.stopPropagation()}
      onDragStart={event => {
        const reorder = {id: id as AgentChainSlotId, title}
        setActiveChainDrag({kind: 'reorder', reorder})
        setHeld({kind: 'reorder', reorder})
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData(AGENT_CHAIN_MIME, encodeChainDrag(reorder))
        event.dataTransfer.setData('text/plain', title)
      }}
      onDragEnd={() => { setActiveChainDrag(null); setHeld(null); setGap(null) }}
      onKeyDown={event => {
        if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
        event.preventDefault()
        void attemptDrop({kind: 'reorder', reorder: {id: id as AgentChainSlotId, title}}, {kind: 'zone', label: 'the drop zone'})
      }}
    ><span aria-hidden="true">⋮⋮</span></span>
  )

  /** A device that is not one of the agent chain's slots, at its compact size: a slot of its own on the chain, or a member inside its
   * host's slot. Its press shows it whole in the pool; ⤢ opens it full in a pane. */
  const placed = (id: string, device: DeviceInstance | null, designBinding: DesignBinding, design: string | undefined, title: string,
    at: {readonly member?: boolean; readonly attrs?: Readonly<Record<string, string>>} = {}) => device && (
    <div className={at.member ? 'factory-slot__member' : 'factory-slot'} data-device={id} data-design={design} {...at.attrs}
      onClick={at.member ? event => event.stopPropagation() : () => selectDevice(id)}>
      <DeviceView device={device} size="compact" binding={designBinding} actions={[
        {icon: 'detail', label: `Show ${title} whole in the pool`, onPress: () => selectDevice(id)},
        {icon: 'pane', label: `Open ${title} full size in a pane`, onPress: () => openDevice(id, title)},
      ]} />
    </div>
  )

  /** One of the agent chain's slots (agentChainDevices.ts) at its compact size: its grip, its drop target, the device inside it where one
   * stands there (the rack's member, §19.7). Its press shows it whole in the pool. */
  const slotPlate = (slotId: FactorySlot) => {
    const entry = chain.find(item => item.slot.id === slotId)
    if (!entry) return null
    const {slot, device} = entry
    return (
      <div className="factory-slot" data-slot={slot.id} data-family={slot.family} data-device={slot.id}
        data-selected={shell.expandedDevice === slot.id} data-i={SLOT_DATA_I[slot.id]} onClick={() => choose(slot.id)}
        data-design={SLOT_DESIGNS[slot.id] && bindings[slot.id] ? SLOT_DESIGNS[slot.id] : undefined}
        data-design-waits={SLOT_DESIGNS[slot.id] ? waits[slot.id] ?? undefined : undefined}>
        <div className="factory-slot__rail">{grip(slot.id, slot.title)}</div>
        <DeviceView device={device} size="compact" picture={chainPicture(slot.id, pictures, 'compact')} binding={bindings[slot.id] ?? undefined} actions={[
          {icon: 'detail', label: 'Show every setting in the pool', onPress: () => choose(slot.id)},
          slot.id === 'agent'
            ? {icon: 'pane', label: 'Open the Agent full in a pane: its thread', onPress: openAgentThread}
            : slot.id === 'gateway' && main.frames
              ? {icon: 'pane', label: 'Open the Gateway\'s Frames in a pane', onPress: () => openDevice(FRAMES_ID, 'Frames')}
              : {icon: 'pane', label: `Open ${slot.title} full size in a pane`, onPress: () => openFull(slot.id, slot.title)},
        ]} />
        {/* The rack's chosen chain, inside the rack (§19.7): the member device. Its press shows it whole in the pool. */}
        {slot.id === 'skillset' && memberDevice && memberDesignBinding && (
          <div className="factory-slot__member" data-device={memberDevice.id} onClick={event => event.stopPropagation()}>
            <DeviceView device={memberDevice} size="compact" binding={memberDesignBinding} actions={[
              {icon: 'detail', label: 'Show the member whole in the pool', onPress: () => selectDevice(memberDevice.id)},
              {icon: 'pane', label: 'Open the member full size in a pane', onPress: () => openDevice(memberDevice.id, 'Member')},
            ]} />
          </div>
        )}
      </div>
    )
  }

  /** One plate of the place's chain (factoryPlaces.ts chainSlots), by what stands there. */
  const plate = (slot: FactorySlot) => {
    if (AGENT_SLOTS.has(slot)) return slotPlate(slot)
    switch (slot) {
      // A group's chain (§19.15): the Agentset rack leads it, one chain for each of the group's sessions, its Helper page the team's
      // decision helpers (§19.20).
      case 'agentset': return placed(AGENTSET_ID, ownDevices.agentset, agentsetCarrying, designsOwn.agentset ? AGENTSET_DESIGN : undefined, 'the Agentset rack',
        {attrs: {'data-session-slot': 'agentset'}})
      // The Main track (§16.2, §19.1): the Run map, then Approvals, where every proposal waits (§19.14), then the Prompt pads.
      case 'approvals': return placed(APPROVALS_ID, receipts.approvals, approvalsDesignBinding, designsReceipts.approvals ? APPROVALS_DESIGN : undefined, 'Approvals', {attrs: {'data-main-slot': 'approvals'}})
      case 'run-map': return placed(RUN_MAP_ID, runMapDev, mainBindings.runMap, designsMain.runMap ? RUN_MAP_DESIGN : undefined, 'the Run map', {attrs: {'data-main-slot': 'run-map'}})
      case 'prompt-pads': return placed(PROMPT_PADS_ID, padsDev, mainBindings.pads, designsMain.pads ? PROMPT_PADS_DESIGN : undefined, 'the Prompt pads', {attrs: {'data-main-slot': 'prompt-pads'}})
      // A workcell's chain (§19.23): its rack leads, then the road — the Remote carrier names the machine it runs on (§19.18).
      case 'workcell': return rackEntry?.binding ? placed(WORKCELL_RACK_ID, rackEntry.device, rackEntry.binding, designsCells.rack ? WORKCELL_RACK_DESIGN : undefined,
        `the workcell ${cellName ?? ''}`.trim(), {attrs: {'data-workcell-slot': 'workcell'}}) : null
      case 'remote-carrier': return placed(CARRIER_ID, cells.carrier, carrierCarrying, designsCells.carrier ? CARRIER_DESIGN : undefined, 'the Remote carrier',
        {attrs: {'data-workcell-slot': 'remote-carrier'}})
      default: return null
    }
  }

  // The place's chain, left to right, with the visible drop slot while a card slides (it opens under the pointer among the agent chain's
  // slots and closes on release). It never lies: a slot is not a landing, the owner operation (here: the refusal naming the missing order
  // op) is.
  const slots = chainSlots(place, {runMap: !!runMapDev, pads: !!padsDev})
  let slotIndex = 0
  const plates = slots.map(slot => {
    const atGap = AGENT_SLOTS.has(slot) && held?.kind === 'reorder' && gap === slotIndex
    if (AGENT_SLOTS.has(slot)) slotIndex += 1
    return <Fragment key={slot}>{atGap && <span className="agent-chain-gap" aria-hidden="true" />}{plate(slot)}</Fragment>
  })
  const trailingGap = held?.kind === 'reorder' && gap === slotIndex && <span className="agent-chain-gap" aria-hidden="true" />

  return (
    <div className="agent-device-chain factory-devices">
      {observers}
      {note && (note.kind === 'refused'
        ? <RefusalCard
            title={note.title}
            line={note.line}
            receipt={note.receipt}
            onDismiss={() => setNote(null)}
            dataI="Refusal|The named missing operation or the owner’s own words: nothing was written, and the dragged item returned."
          />
        : <p className="agent-transport-note" role="status"><b>{note.title}</b> — {note.line}</p>)}
      <div
        className="native-agent-rack" aria-label="Agent device chain" data-region="device-chain" data-place={place.kind}
        ref={rowRef}
        onDragOver={onRowDragOver}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGap(null) }}
        onDrop={onRowDrop}
      >
        {/* Factory's Main track (DLW §16.2, §19.1): with no session selected, or the Main head, the Device side is the Main track's chain. */}
        {place.kind === 'main' && <div className="factory-main" data-track="main" aria-label="Main track"
          data-i="Main track|Factory's Main track: the Run map, Approvals, where every proposal waits, and the Prompt pads. The ledger is a monitor on the rail; the frames are the Gateway's; Link is the transport's.">
          {plates}
        </div>}
        {/* A workcell's return track (§19.23): its chain is the road in and out, shared by every track that works in it. */}
        {place.kind === 'workcell' && <div className="factory-main factory-workcell" data-track={workcellTrackId(place.name)} aria-label={`Workcell ${place.name}`}
          data-i={`Workcell ${place.name}|Its chain: the workcell's rack, the Gateway, the Remote carrier, and Git / landing with its Seat page. Every track that works in ${place.name} shares it.`}>
          {plates}{trailingGap}
        </div>}
        {/* A selected session shows its own chain: Agent, skills rack, scope (§16.2); a group's led by its Agentset rack. */}
        {place.kind === 'session' && <>{plates}{trailingGap}</>}
        <div className={'agent-dropz dropz' + (held ? ' armed' : '')} data-slot="zone" data-i={DROP_ZONE_DATA_I} title={DROP_ZONE_DATA_I.split('|')[1]}>
          {held ? dropZoneLine(held) : 'Drop gateways, agents, skillsets, worlds or git here'}
        </div>
      </div>
    </div>
  )
}
