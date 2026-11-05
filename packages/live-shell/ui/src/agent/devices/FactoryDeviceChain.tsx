// Factory's Device side: the chain of the place selected — a session's (the connections, the Agent rack, Scope, Git / landing), the Main
// track's, or a workcell's (the Gateway, the Remote carrier, Git / landing with its Seat) — as devices of the runtime (manual §6, §10.4; ticket
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
// Where each stands (lane W1-Factory; factoryPlaces.ts holds the chains, and this file draws exactly those): a session's chain is §16.2's
// Factory row — the Gateway and the Remote carrier, the Agent rack, Scope, Git / landing — a group's and a lone session's alike (O-I ticket 842).
// The rack is drawn as Live draws one (§16.4): its head (title bar, macros, chain list) and, under its Devices mark, the devices of the
// chosen chain at full height, then its end bracket. A lone session's one chain is its own agent, so its devices — the Skillset rack with
// its member, then the Agent — stand inside the rack themselves, every setting live; a group's chains are its sessions, each in the rack's
// own list. Each plate says how far it reaches (factoryPlaces.ts reachOf): outside the rack, every chain; inside a chain, that agent alone.
// With no session selected, or the Main head, the Device side is the Main track's chain: the Run map, Approvals and the prompt pads (§16.2,
// §19.1). With a workcell's return track selected it is that workcell's chain: the Gateway, the Remote carrier, Git / landing with the
// Seat inside it (§16.2, §19.23). The Ledger (§19.13), a monitor, stands on the rail and full in a pane, never on a chain (§16.1); so does
// Messages, an instrument born on the rail (§19.24), with the Gateway's agency build's mark in its head (§19.10). Those, and Workcell's
// instrument (it stands on no chain, §19.23; its widget is the Workcells tile, which lists the gateways: §19.3), stand on the rail in every
// mode, so the rail's publisher holds them (AgentRailDevices.tsx), not this chain.
// Retired in the 22 Oct manual rewrite, each a page of the device that carries it, hosted by prefixing the retired device's own binding
// (oneAgentBinding.ts carryPages): the Seat is Git / landing's Seat group (`seat.`, §19.16, §19.17); the checkouts (`co.`, Ground hygiene's
// census) and the machine (`mc.`, §18.7) are pages of Workcell's instrument (§19.23), which the rail's publisher carries; Capture skill is
// the Skillset rack's Capture page (`capture.`, §19.11); the Knowledge route is Scope's Knowledge page (§19.9), whose settings and readings Scope stands refused and absent by
// what each lacks (designBindings.ts scopeBinding); the Experiment is a task launched with Repeat and its takes compared (§19.5), so no
// device of it stands. The Decision helper is a device of its own (§19.20): a chain of a group's Agent rack, in place of an Agent, that the
// rack lists among its chains and this chain publishes beside the rack while the rack stands on a group. Link is the transport's (§19.19): the
// frame publishes it. Every device of this chain is published whichever chain is drawn, so the pool, a pane and the rail keep them. The
// bindings: sessionChainBindings.ts, receiptBindings.ts, workcellBindings.ts. The Run, Tasks and Runs are no devices (a task's panels, the
// session's mixer row and lanes, its takes — Clip view's and the views'), and nothing publishes them: the browser lists none (ticket 788).
import {Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent} from 'react'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import type {DesignBinding} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {useDesign} from '../../frame/devices/designs'
import {useRackShown} from '../../frame/devices/deviceHost'
import {openSeatDiff} from '../AgentShellBrowser'
import {openSettings} from '../../settings/host'
import {chainLaw, slotStanding} from '../../inhabitants/sdk/chains'
import {openInstrument} from '../../frame/instrumentDoor'
import {agentAddress} from '../../inhabitants/agentParamAddresses'
import {useRosterAnswer, useSettingsAnswer} from '../../owners/readers'
import {registerOf, returnProjectOf, ROOT_REGISTER, useWorldReturns} from '../worldScope'
import {useAgentSessionsOptional} from '../AgentSessionsProvider'
import {useAgentShell, type AgentDeviceId} from '../AgentShellContext'
import {threadTrackOf} from '../threadTrack'
import {trackKey} from '../agentRunModel'
import {
  AGENT_CHAIN_MIME, SLIDE_PLACE, activeChainDrag, chainDropDecision, chainInsertIndex, decodeChainDrag, dropZoneLine,
  encodeChainDrag, setActiveChainDrag, type ActiveChainDrag, type AgentChainSlotId,
} from '../agentChainDrag'
import {agentDataI} from '../agentFidelity'
import {fireWritePath} from '../agentNativeDispatch'
import {harnessAgentControl, harnessIngressRule} from '../harnessAgentControl'
import {chainListAct, chainTaskBudget, chainTaskRead, sessionModelRead, sessionModelSelect, useChainModelReadings, useRackMacrosReadings} from '../factoryTaskActs'
import {RefusalCard, safeJson} from '../RefusalCard'
import {CHAIN_DEVICE_IDS, agentChainDevices, chainDeviceId, gatewayDisclosed, rackMemberDevice, type ChainWrite} from './agentChainDevices'
import {chainPicture, type PictureContext} from './AgentDevicePictures'
import {
  AGENT_DESIGN, AGENT_P0_ROWS, GATEWAY_DESIGN, LANDING_DESIGN, MEMBER_DESIGN, MEMBER_DEVICE_ID, RACK_DESIGN, SCOPE_DESIGN, SLOT_DESIGN_FACE, agentBinding, designWaits,
  gatewayBinding, memberBinding,
  holdView, memberChains, openRefinement, rackBinding, refiningBinding, scopeBinding, seatedProfile, useChainHolds, viewHolds, type AgentRows, type MemberPorts, type RackUpkeep,
  type RefiningPorts, callsOf, callsOnEvery, lastUsageModels, type CallsDecision,
} from './designBindings'
import {useOwnerAccepted} from './ownerAccepted'
import {useSelectedSkillChain} from './skillRackSelection'
import {useAgentChainReading} from './useAgentChainReading'
import {composePorts, useRackReading} from './useRackReading'
import {observedState, useEncounterSessions} from './EncounterObservers'
import {FRAMES_ID, mainDevices} from './mainTrackBindings'
import {askRowsOf, shownSession, threadBinding, threadJson} from './threadBinding'
import {CAPTURE_PAGE, REFINE_PAGE, SEAT_PAGE, carryPages, composeAgentBinding, withAgentGit} from './oneAgentBinding'
import {testRefinement, useScopeWaits} from '../sessionSettings'
import {openNotificationTarget, useOwnerRequests} from '../../widgets/railDevices'
import {openedHold, openedOf, withOwnerRequests} from '../../widgets/railBindings'
import {useIdentityDevice} from '../../central/devices/agentChainDevices'
import {PERSONAL_ANCHOR_ACTION, acceptSourceReturn, personRefOf, rejectSourceReturn} from '../../central/devices/sourceReturnAccept'
import {commentSourceReturn, withReturnComments} from '../../central/devices/sourceReturnComment'
import {receiving} from '../../../../../../desktop/cradle/src/receiving/client'
import {useUnitDecisions, waitingDecisions} from './unitDecisions'
import {useCentralAction} from '../../central/devices/useCentralReadings'
import {actionAnswerOf, centralActionOp} from '../../central/devices/centralActions'
import {useAtSearch} from '../../central/searchPane'
import {useModelCatalogue} from './useModelCatalogue'
import {useAttemptTakes} from '../../owners/attemptTakes'
import {readTaskOf, useWorkcellAnswer} from '../../owners/readers'
import {usePopulationAnswer} from './usePopulationAnswer'
import {factoryLocateOp, useSessionCustody} from './sessionCustody'
import {
  AGENTSET_DESIGN, AGENTSET_ID, agentChainSessions, agentsetBinding, chainProfileOf, custodyBinding, orderRequest, profileHeadActs, rackSpaces, replaceRequest,
  sessionDevices, withCustodyAsks, type AgentRackPorts, type CustodyPorts,
} from './sessionChainBindings'
import {retryTask, stopAfterTask} from './taskBindings'
import {communiqueRefOf} from './messagesBinding'
import {APPROVALS_DESIGN, APPROVALS_ID, approvalsBinding, receiptDevices} from './receiptBindings'
import {CARRIER_DESIGN, CARRIER_ID, carrierBinding, connectionLabels, gitBinding, planRunOf, runDemandOf, seatBinding, workcellDevices, type SeatPorts} from './workcellBindings'
import {ROUTE_WORDS, aikitWriteOp, centralRevisionWrite, deskActorOf, factoryOwnerWrite, gatewayWriteOp, ownerRouteWrite, refinementWrite, refusalWords, seatWriteOp} from './ownerRoutes'
import {worldsOf} from './workcellMaterial'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import {WORKCELL_RACK_ID, chosenWorld, workcellGitReading} from './workcellRackBinding'
import {AGENT_SLOTS, ON_ITS_TRACK, RACK_CHAIN, chainSlots, factoryPlace, reachOf, type FactorySlot, type RackChainName, type Reach} from './factoryPlaces'
import {useOwnerOp} from '../../owners/ownerCall'
import type {AikitWriteRequest, EncounterSessionSettingsReading, KernelOp} from '../../../../../../desktop/cradle/src/kernel/types'
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {DECISION_HELPER_ID, decisionHelperBinding, decisionHelperDevice} from './decisionHelperBinding'
import {captureSkillBinding, type CaptureSkillPorts} from './captureSkillBinding'
import {useSongClipFocus} from '../songClips'
import {RUN_MAP_DESIGN, RUN_MAP_ID, runMapBinding, runMapDevice} from './runMapBinding'
import {useRunJourney} from './runJourney'
import {PROMPT_PADS_DESIGN, PROMPT_PADS_ID, padsHeadActs, padsLocation, promptPadsBinding, promptPadsDevice, type PadsPresetPorts, type PromptPadsPorts} from './promptPadsBinding'
import {useDecisionHelperReadings} from './decisionHelperReads'
import {useTeamSpace, withTeamCell} from './teamCell'
import {useActuationRead, useAikitRead, useConnectionShows, useGatewayEcology, useSeatStatusAnswer, useWorkcellRead} from './workcellReads'
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
/** A plate's info line with how far it reaches (factoryPlaces.ts reachOf), read by the status bar as Live's Info View reads a device. */
const withReach = (dataI: string, reach: Reach): string => (reach.reaches === 'track' ? dataI : `${dataI} ${reach.says}`)
/** The rack's chains by their names (the rack's own `members`), for what a plate reaches. */
function rackChainsOf(members: unknown): RackChainName[] {
  try {
    const rows = typeof members === 'string' ? JSON.parse(members) as unknown : null
    return Array.isArray(rows) ? rows.flatMap(row => (row && typeof row.id === 'string' ? [{id: row.id, name: typeof row.name === 'string' ? row.name : row.id}] : [])) : []
  } catch { return [] }
}
/** One of the person's own acts on Central's agent sets through the kernel's invoke_action: Central's data, or its own words as the refusal. */
async function setAct(transport: Parameters<typeof kernelOp>[0], action: string, input: Readonly<Record<string, unknown>>): Promise<unknown> {
  const call = await kernelOp(transport, centralActionOp(action, input))
  const answer = actionAnswerOf({status: call.error ? 'refused' : 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: call.error ?? null}, action)
  if (answer.status === 'refused') throw Error(answer.error)
  if (answer.status !== 'answered') throw Error(`${action} did not answer.`)
  return answer.value
}

/** A session's bound task (AIKit's task record: request.central.task_ref), the task Factory's attempts are dispatched on; refused in words. */
async function boundTaskOf(transport: Parameters<typeof kernelOp>[0], project: string, session: string, what: string): Promise<string> {
  const read = await readTaskOf(transport, project, session)()
  if ('error' in read) throw Error(`${what}: AIKit did not read the session's task: ${read.error}`)
  const ref = (read.value as {request?: {central?: {task_ref?: unknown}}} | null)?.request?.central?.task_ref
  if (typeof ref !== 'string' || !ref.trim()) throw Error(`${what}: AIKit's record of the session binds no task, so there is no work to name.`)
  return ref
}
/** The Position an agent occupies in AIKit's population as the window holds it, or null. */
function positionOf(population: {status: string; value?: unknown}, agentRef: string): string | null {
  const positions = population.status === 'answered' && population.value && typeof population.value === 'object'
    && Array.isArray((population.value as {positions?: unknown}).positions) ? (population.value as {positions: {position_ref?: unknown; occupancy?: {agent_ref?: unknown}}[]}).positions : []
  const row = positions.find(item => item.occupancy?.agent_ref === agentRef && typeof item.position_ref === 'string')
  return row ? String(row.position_ref) : null
}

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
/** AIKit's capture inbox (lane W3's aikit_read {inbox}) in a register (agent/worldScope.ts; null the root), read while the Skillset rack
 * stands on the armed track's chain, for its Capture page (§19.11). */
const captureInboxOp = (register: string | null): KernelOp => ({op: 'aikit_read' as const, request: {kind: 'inbox' as const, project: register}})
/** Where Factory keeps a register's project (factory_owner locate; no project names the root), for the Prompt pads' bank. */
/** Factory's locate of the rack's register: one op with the session's custody (sessionCustody.ts), so one reading answers both. */
const padsLocateOp = factoryLocateOp
/** Actuation's authority list (lane W3 round 3's actuation_read {authority-list}), read while a session's chain stands (Custody's Grants). */
const AUTHORITY_LIST: KernelOp = Object.freeze({op: 'actuation_read' as const, request: {kind: 'authority-list' as const}})

/** The slots whose designs this chain binds, with the design each draws. */
const SLOT_DESIGNS: Readonly<Record<string, string>> = {gateway: GATEWAY_DESIGN, agent: AGENT_DESIGN, skillset: RACK_DESIGN, world: SCOPE_DESIGN, git: LANDING_DESIGN}

/** `workcell`: the workcell whose return track is selected (frame/tracks/returnTracks.ts workcellOfTrack) — its chain stands in place of a
 * session's or the Main track's. */
export function FactoryDeviceChain({sessionRef, workcell = null}: {sessionRef: string | null; workcell?: string | null}) {
  const shell = useAgentShell()
  const {reading, transport, binding, resolved, harnesses, git: sessionGit} = useAgentChainReading(sessionRef)
  // The settings an owner accepted on this harness: the only readings effort and input have. The shell's own effort, steer,
  // heartbeat and write-arm flags are presentation, so they are not read here.
  const accepted = useOwnerAccepted(binding)
  const sessions = useAgentSessionsOptional()
  const track = sessionRef != null ? sessions?.tracks.find(item => item.sessionRef === sessionRef) ?? null : null
  // The register this chain reads in: the session's own (the one its world-wide agency read listed it in, agent/worldScope.ts); a chain
  // with no session (a workcell's, the Main track's) reads your world's root register. `register` is null for the root, as the ops that
  // take `project?: string | null` name it.
  const rackProject = track?.project ?? ROOT_REGISTER
  const register = registerOf(rackProject)
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
      transport: rows.find(row => row.key === 'transport'), connect: rows.find(row => row.key === 'connect'),
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
    return held ? [{ref: held.sessionRef, space: held.spaceRef, project: held.project ?? ROOT_REGISTER}] : []
  }), [shown, sessionRef, tracks])
  const {handles, observers} = useEncounterSessions(observed)
  const models = useModelCatalogue(transport, !waits.agent)
  // The asks each conversation's session put to the decision helper, as AIKit keeps them against it (§19.4 Ask rows; O-I ticket 684).
  const shownAsks = useAikitRead(transport, !waits.agent && shown ? {kind: 'decision-asks', agent_session: shown} : null)
  const chainAsks = useAikitRead(transport, !waits.agent && sessionRef ? {kind: 'decision-asks', agent_session: sessionRef} : null)
  const agentThread = useMemo(() => (sessionRef ? threadJson(observedState(handles[sessionRef]), track?.agentName ?? null, askRowsOf(chainAsks, sessionRef, track?.agentName ?? null))
    : undefined), [handles, sessionRef, track?.agentName, chainAsks])
  // The Agent's Context page (lane W8): AIKit's continuity pressure and armed commands, read while a session's chain stands.
  const contextOn = !waits.agent && sessionRef != null
  const continuityPressure = useAikitRead(transport, contextOn ? {kind: 'continuity-pressure', project: register} : null)
  const continuityCommands = useAikitRead(transport, contextOn ? {kind: 'continuity-commands', project: register} : null)
  // The last turn's bounded blocks (W11): AIKit's kept turn for the session (`aikit work continuity turn --session S`).
  const continuityTurn = useAikitRead(transport, contextOn ? {kind: 'continuity-turn', project: register, session: sessionRef} : null)
  const context = useMemo(() => (contextOn ? {pressure: continuityPressure, commands: continuityCommands, turn: continuityTurn} : undefined),
    [contextOn, continuityPressure, continuityCommands, continuityTurn])
  // The model the session last reported using (lane K0): Actuation's usage records of the session.
  const sessionUsage = useActuationRead(transport, contextOn ? {kind: 'usage-list', session: sessionRef} : null)
  // The Run page's Team cell (§19.4; O-I ticket 684): where the session's agent stands in Anima or Aletheia, from QL's team space (teamCell.ts).
  const teamSpace = useTeamSpace(transport, !waits.agent && sessionRef != null)
  const agentOwnBinding = useMemo(() => (waits.agent ? null : agentBinding(chainDeviceId('agent'), {
    sessionRef, track, nowUnixMs: sessions?.nowUnixMs ?? 0, reading, accepted, harness: {binding, resolved}, holds, thread: agentThread, models, harnesses, events: sessions?.events ?? null,
    ...(context ? {context} : {}), ...(contextOn ? {usage: sessionUsage} : {}),
  }, agentRows, write, () => steering.current)), [waits.agent, sessionRef, track, sessions?.nowUnixMs, reading, accepted, binding, resolved, holds, agentRows, write, agentThread, models, harnesses,
    sessions?.events, context, contextOn, sessionUsage])
  const agentDesignBinding = useMemo(() => withTeamCell(agentOwnBinding, teamSpace, sessionRef != null ? track?.agentRef ?? null : null),
    [agentOwnBinding, teamSpace, sessionRef, track?.agentRef])

  // The Agent's Thread page (its Full): the shown session's conversation; its composer, Input and timing the Agent's; Approve and Hard
  // stop that session's own encounter verbs; choosing a session moves THE selection.
  const shownHandle = shown ? handles[shown] : undefined
  const threadDesignBinding = useMemo(() => {
    const state = observedState(shownHandle)
    const actions = shownHandle && 'actions' in shownHandle ? shownHandle.actions : undefined
    return threadBinding({selected: selectedThread, chainSession: sessionRef, tracks, nowUnixMs: sessions?.nowUnixMs ?? 0,
      encounter: state ? {reading: state.reading, status: state.status} : null, asks: shownAsks, agent: agentDesignBinding?.values ?? {}, holds}, agentDesignBinding, {
      ...(actions ? {permission: (id: string, decision: Parameters<typeof actions.permission>[1]) => actions.permission(id, decision), cancel: async () => actions.cancel()} : {}),
      select: ref => { const chosen = tracks?.find(item => item.sessionRef === ref && !item.group); if (chosen) shell.setSelectedTrackId(trackKey(chosen)) },
    })
  }, [shownHandle, selectedThread, sessionRef, tracks, sessions?.nowUnixMs, shownAsks, agentDesignBinding, holds, shell])

  // The Tasks and Runs devices were retired (ticket 725: a task is a clip, its attempts the track's takes in Arrangement view, §16.1, §19.1),
  // and their constructors with them (ticket 772): a task's settings are its Clip view's (agent/clipBinding.ts useFactoryClip), its attempts the
  // take lanes' (owners/attemptTakes.ts), and the Journey the Run map's (§19.25).

  // Factory's Main track devices: the Run map, Approvals and the Prompt pads (below). The Ledger, Messages, the Frames tile (the Gateway's
  // widget) and Workcell's instrument stand on the rail in every mode: AgentRailDevices.tsx publishes them, not this chain.
  const main = useMemo(() => mainDevices(), [])
  // Workcell's status, the window's one answer (owners/readers.ts): the Remote carrier's machines.
  const workcellAnswer = useWorkcellAnswer(transport).reading
  // The Prompt pads (§19.22, lane W8): the shell's project located by Factory, its bank read, each setting written through pads-write.
  const padsLocate = useMemo(() => padsLocateOp(register), [register])
  const padsLocated = useOwnerOp(transport, padsLocate, 'factory_development_reading').reading
  const padsWhere = padsLocated.status === 'answered' ? padsLocation(padsLocated.value?.data) : null
  const padsBankOp = useMemo((): KernelOp | null => (padsWhere && 'projectRef' in padsWhere
    ? {op: 'factory_owner', request: {kind: 'pads-read', state_path: padsWhere.statePath, project_ref: padsWhere.projectRef}} : null),
  [padsWhere && 'projectRef' in padsWhere ? padsWhere.statePath : null, padsWhere && 'projectRef' in padsWhere ? padsWhere.projectRef : null]) // eslint-disable-line react-hooks/exhaustive-deps
  const padsBank = useOwnerOp(transport, padsBankOp, 'factory_development_reading').reading
  // Make routine (§19.22 Running alone) opens Settings, Automations on the bank's project, the shell's own act: the new routine's form,
  // naming the pad that opened it (its name the routine's), its Method and its time chosen there (settings/windowValues.ts automationsRequestHolds).
  const padsPorts = useMemo((): PromptPadsPorts => ({
    ...(transport.kind !== 'unavailable' ? {write: request => factoryOwnerWrite(transport, {kind: 'pads-write', ...request}, '`factory development pads-write`')} : {}),
    makeRoutine: pad => openSettings({requestId: crypto.randomUUID(), page: 'automations', scope: {scope_kind: 'project', scope_ref: pad.project ?? pad.projectRef},
      returnLabel: `Back to Prompt pads${pad.name ? ` · ${pad.name}` : ''}`,
      newRoutine: {from: `Prompt pads · ${pad.name ?? `pad ${pad.index + 1}`}`, ...(pad.name ? {name: pad.name} : {})}}),
  }), [transport])
  const padsInput = useMemo(() => ({
    located: {status: padsLocated.status, value: padsLocated.value?.data ?? null, error: padsLocated.error},
    ...(padsBankOp ? {bank: {status: padsBank.status, value: padsBank.value?.data ?? null, error: padsBank.error}} : {}), holds,
  }), [padsLocated, padsBank, padsBankOp, holds])
  const mainBindings = useMemo(() => ({pads: promptPadsBinding(padsInput, padsPorts)}), [padsInput, padsPorts])
  // The pads' head (§16.4; Factory PR 306): Save as preset and Hot-swap, on Factory's presets of the pads (factory_owner pads-presets).
  const padsPresetsOp = useMemo((): KernelOp | null => (padsWhere && 'projectRef' in padsWhere ? {op: 'factory_owner', request: {kind: 'pads-presets', state_path: padsWhere.statePath}} : null),
    [padsWhere && 'projectRef' in padsWhere ? padsWhere.statePath : null]) // eslint-disable-line react-hooks/exhaustive-deps
  const padsPresets = useOwnerOp(transport, padsPresetsOp, 'factory_development_reading').reading
  const padsPresetPorts = useMemo((): PadsPresetPorts => (transport.kind !== 'unavailable' ? {
    save: request => factoryOwnerWrite(transport, request, '`factory development pads-preset-save`'),
    recall: request => factoryOwnerWrite(transport, request, '`factory development pads-preset-recall`'),
  } : {}), [transport])
  const padsActs = useMemo(() => padsHeadActs(padsInput, padsPresetsOp ? {status: padsPresets.status, value: padsPresets.value?.data ?? null, error: padsPresets.error} : undefined,
    padsPresetPorts), [padsInput, padsPresetsOp, padsPresets, padsPresetPorts])
  // The Run map and the Prompt pads (§19.25, §19.22, lane W7): bound, standing where Software Factory's family admits their faces.
  const runMapDev = useMemo(() => runMapDevice(), [])
  const padsDev = useMemo(() => promptPadsDevice(), [])
  const designsMain = {runMap: useDesign(RUN_MAP_DESIGN, true), pads: useDesign(PROMPT_PADS_DESIGN, true)}

  // The rack: the seated agent's carried practice (its accepted profile in the roster, the sets AIKit replies for), and the
  // composition through the configuration plane. Read only while its design can draw it.
  const rosterAnswer = useRosterAnswer(transport, null)
  const roster = rosterAnswer.reading
  const profile = useMemo(() => seatedProfile(roster.status === 'answered' ? roster.value : null, track?.agentRef ?? null), [roster, track?.agentRef])
  // The chain is the profile Central keeps for the agent (§19.4; Central PR 318): the Agent's Rename and the Skillset rack's Hot-swap write it
  // at its revision as read, and the roster is read again behind each act.
  const chainProfile = useMemo(() => chainProfileOf(profile), [profile])
  const refreshRoster = rosterAnswer.refresh
  const profileAct = useMemo(() => (transport.kind !== 'unavailable'
    ? async (action: string, input: Readonly<Record<string, unknown>>) => { try { return await setAct(transport, action, input) } finally { refreshRoster() } }
    : undefined), [transport, refreshRoster])
  const profileActs = useMemo(() => profileHeadActs(chainProfile, profileAct), [chainProfile, profileAct])
  const [planeEpoch, setPlaneEpoch] = useState(0)
  const rackOn = !waits.skillset
  const rackReading = useRackReading(transport, profile, holds.compose.scope, sessionRef, rackOn, planeEpoch, rackProject)
  const ports = useMemo(() => composePorts(transport, () => setPlaneEpoch(epoch => epoch + 1)), [transport])
  // The rack's upkeep pages (lanes W8, W9): AIKit's unused, source, collate, bypass and procedure lists, the plan for the root chosen, and
  // its writes.
  const rackHeld = viewHolds(holds, chainDeviceId('skillset'))
  const upkeepUnused = useAikitRead(transport, rackOn ? {kind: 'unused'} : null)
  const upkeepSources = useAikitRead(transport, rackOn ? {kind: 'source-list'} : null)
  // Every root on this computer, foreign ones included: a fresh world's skills are what the rack adopts.
  const upkeepCollate = useAikitRead(transport, rackOn ? {kind: 'collate', all: true} : null)
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
    ...(transport.kind !== 'unavailable' ? {write: request => ownerRouteWrite(transport, aikitWriteOp(request as AikitWriteRequest), `\`aikit ${request.kind.replace('-', ' ')}\``)} : {}),
    // The order of the SkillSets the agent carries (round 869): Central's agent-profile.chain-order at the profile's revision as read.
    ...(chainProfile && profileAct ? {reorder: async (refs: readonly string[]) => { const asked = orderRequest(chainProfile, refs); await profileAct(asked.action, asked.input) }} : {})}),
  [upkeepUnused, upkeepSources, upkeepCollate, upkeepBypasses, upkeepProcedures, upkeepAdoption, adoptRoot, upkeepProcedure, chosenProcedure, transport, chainProfile, profileAct])
  const rackDesignBinding = useMemo(() => (rackOn ? rackBinding(chainDeviceId('skillset'), {profile, ...rackReading, holds}, ports, {project: rackProject, sessionRef}, upkeep) : null),
    [rackOn, profile, rackReading, holds, ports, sessionRef, upkeep, rackProject])
  // The member: the rack's chosen chain, one device inside the rack (§19.7).
  const memberOn = rackOn && !waits.member
  const chosen = useSelectedSkillChain(rackDesignBinding ? memberChains(rackDesignBinding.values) : null)
  const memberDevice = useMemo(() => (memberOn ? rackMemberDevice(MEMBER_DEVICE_ID) : null), [memberOn])
  // Trust (lane W3): the review recorded with AIKit through the kernel's aikit_write trust-record, in the rack's project.
  // The member's Why and History (lane W8): AIKit's explain and history of the chosen capability.
  const memberWhy = useAikitRead(transport, memberOn && chosen ? {kind: 'explain', resource: chosen} : null)
  const memberHistory = useAikitRead(transport, memberOn && chosen ? {kind: 'history', resource: chosen} : null)
  const memberPorts = useMemo((): MemberPorts => ({why: memberWhy, history: memberHistory,
    ...(transport.kind !== 'unavailable' ? {trust: capability => ownerRouteWrite(transport, aikitWriteOp({kind: 'trust-record', project: register, capability}), ROUTE_WORDS.trust)} : {})}),
  [transport, memberWhy, memberHistory, register])
  const memberDesignBinding = useMemo(() => (memberDevice && rackDesignBinding ? memberBinding(MEMBER_DEVICE_ID, rackDesignBinding.values, chosen, holds, memberPorts) : null),
    [memberDevice, rackDesignBinding, chosen, holds, memberPorts])
  // Scope: the world row's write path for the write mode; a raised reach held until Confirm; Tool calls, the harness's approvals as the
  // gateway reads it, through the Gateway slot's approvals row (§19.12 Asks).
  const writeModeRow = chain.find(entry => entry.slot.id === 'world')?.device.rows.find(row => row.key === 'write-mode')
  const toolCallsRow = chain.find(entry => entry.slot.id === 'gateway')?.device.rows.find(row => row.key === 'approvals')
  const toolCalls = gatewayDisclosed(reading.gatewayDoc).approvals
  // Calls to other agents: AIKit's rule for the sender kind agent on the session's gateway bindings, as its ecology reads it, set on every
  // binding of the session through the kernel's harness_ingress_rule.
  const ecology = useGatewayEcology(transport, !waits.world && sessionRef != null)
  const calls = useMemo(() => (ecology.status === 'answered' ? callsOf(ecology.value, sessionRef)
    : ecology.status === 'refused' ? {refused: ecology.error ?? 'AIKit refused the gateway\'s ecology.'} : null), [ecology, sessionRef])
  // One binding at a time: where one refuses, the words say which bindings now answer the new way and what to press next.
  const callsWrite = useMemo(() => (transport.kind === 'unavailable' ? undefined : async (bindings: readonly string[], decision: CallsDecision) => {
    await callsOnEvery(bindings, decision, (ruled, said) => harnessIngressRule(transport, ruled, 'agent', said))
  }), [transport])
  // Wait and On no answer (§19.12 Asks): the session's own settings in AIKit, which its executor plays at the Wait; a group's sessions each
  // keep their own.
  const scopeWaits = useScopeWaits(transport, track && !track.group ? track.sessionRef : null, rackProject,
    track?.group ? 'each session of a group keeps its own; choose one of its sessions.' : undefined)
  const scopeDesignBinding = useMemo(() => (waits.world ? null : scopeBinding(chainDeviceId('world'), holds, writeModeRow, write,
    {toolCalls, toolCallsRow, calls, ...(callsWrite ? {callsWrite} : {}), waits: scopeWaits})),
  [waits.world, holds, writeModeRow, write, toolCalls, toolCallsRow, calls, callsWrite, scopeWaits])
  // Where the Device side stands (factoryPlaces.ts): a workcell's return track, a session (or a group), or the Main track.
  const groupTrack = track && track.group ? track : null
  // A lone session: its rack's one chain is its own agent (§19.15 "A session of one agent has a rack of that one chain").
  const loneTrack = track && !track.group ? track : null
  const place = factoryPlace({sessionRef, group: !!groupTrack, workcell})
  const cellName = place.kind === 'workcell' ? place.name : null
  // A session's own chain stands (not a workcell's).
  const sessionChain = sessionRef != null && cellName == null
  // The Skillset rack's Capture page (§19.11, lane W7; Capture skill was retired into it in the 22 Oct manual rewrite): on the armed
  // track's chain — the selected session's, never a group's. It reads the proposal that waits in AIKit's inbox and writes Accept through
  // aikit_write promote; Source › A clip captures the song's clip selected under Material › Songs through aikit_write capture with
  // from_song (`aikit capture --from-song`, the Songs issue of O-I), filed in this register's inbox for the person to accept.
  const captureOn = sessionChain && !groupTrack
  const captureInboxRead = useMemo(() => captureInboxOp(register), [register])
  const captureInbox = useOwnerOp(transport, captureOn ? captureInboxRead : null, 'owner_route_reading').reading
  const captureSong = useSongClipFocus()
  const capturePorts = useMemo((): CaptureSkillPorts => (transport.kind !== 'unavailable'
    ? {promote: (candidate, id) => ownerRouteWrite(transport, aikitWriteOp({kind: 'promote', project: register, candidate, ...(id ? {id} : {})}), '`aikit promote`'),
      capture: ({title, body, scope, sourceRef}) => {
        return ownerRouteWrite(transport, aikitWriteOp({kind: 'capture', project: register, title, body, scope, source_ref: sourceRef, by: 'human', from_song: true}),
          '`aikit capture --from-song`')
      }} : {}), [transport, register])
  const captureDesignBinding = useMemo(() => captureSkillBinding({inbox: {status: captureInbox.status, value: captureInbox.value?.data ?? null, error: captureInbox.error},
    holds, song: captureSong}, capturePorts), [captureInbox, holds, captureSong, capturePorts])
  // The Skillset rack's Refining page (§19.7, lane BD round 12): AIKit's proposed revisions (`aikit source refine list`), read once for
  // the rack and for Approvals, where each also waits. Accept and Discard are AIKit's own verbs on the member (aikit_write
  // refinement-accept · refinement-discard); Test is the selected session's own Repeat over Skillset (sessionSettings.ts testRefinement),
  // on every session's chain the rack stands on: a group's (its head session's own Repeat) and a lone one's alike (O-I 795 round 13).
  // A Control skill's revision that AIKit handed to Central is answered there, by Central's own acts (ownerRoutes.ts centralRevisionWrite).
  const rackRefinements = useAikitRead(transport, {kind: 'refinement-list'})
  const refineWrite = useMemo(() => refinementWrite(transport), [transport])
  const centralRevision = useMemo(() => centralRevisionWrite(transport), [transport])
  const refinePorts = useMemo((): RefiningPorts => ({...(refineWrite ? {write: refineWrite} : {}), ...(centralRevision ? {central: centralRevision} : {}),
    ...(sessionChain && sessionRef && transport.kind !== 'unavailable' ? {test: (set: string, member: string) => testRefinement(transport, rackProject, sessionRef, set, member)} : {})}),
  [refineWrite, centralRevision, sessionChain, sessionRef, transport, rackProject])
  const rackSet = typeof rackDesignBinding?.values.set === 'string' ? rackDesignBinding.values.set : null
  const refiningDesignBinding = useMemo(() => refiningBinding(chainDeviceId('skillset'), {refinements: rackRefinements, set: rackSet, holds}, refinePorts),
    [rackRefinements, rackSet, holds, refinePorts])
  // The seat instrument (lane K1's seat_status_read: slow, read once while a session's or a workcell's chain stands, and on demand): the
  // workcell's seats, the Seat, Git / landing on a workcell's chain, and the Workcells tile.
  const seats = useSeatStatusAnswer(transport, sessionRef != null || cellName != null).reading
  // Git / landing: on a workcell's chain, that workcell's seat of the project (its branch, the files with no commit); elsewhere — on the
  // door, on no chain — the chain's git reading. Every act stands disabled.
  const gitReading = useMemo(() => (cellName ? workcellGitReading(seats, cellName, rackProject) : reading), [cellName, seats, reading, rackProject])
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
  // The session's custody (sessionCustody.ts): the same readings the Clip view's edits take their hold through and the transport's
  // Re-enable gives back through. Hand back (§19.4; BD r20) is Factory's custody hold, the person's, and the custody list is read again
  // after it (its hand_back is the light).
  const custodyAt = useMemo(() => (sessionRef != null ? {sessionRef, project: rackProject, agentRef: track?.agentRef ?? null} : null), [sessionRef, rackProject, track?.agentRef])
  const sessionCustody = useSessionCustody(transport, custodyAt)
  const custodyHoldPorts = useMemo((): CustodyPorts => (sessionCustody.hold ? {...custodyPorts, hold: sessionCustody.hold} : custodyPorts),
    [custodyPorts, sessionCustody.hold])
  const custodyPopulation = usePopulationAnswer(transport, register)
  const custodyRead = sessionCustody.read ?? undefined
  const custodyDesignBinding = useMemo(() => custodyBinding({sessionRef, agent: agentDesignBinding?.values ?? {}, holds, grants, person: currentPerson,
    custody: custodyRead}, scopeDesignBinding, custodyHoldPorts), [sessionRef, agentDesignBinding, scopeDesignBinding, holds, grants, currentPerson, custodyRead, custodyHoldPorts])
  const identityDesignBinding = useIdentityDevice(transport, track?.agentRef ?? null, FACTORY_IDENTITY_ID)
  // The Context page's Git row: the session's own repository, and Diff to Files' Diff page (§19.4 Context; §23.2).
  const oneAgent = useMemo(() => (agentDesignBinding ? withAgentGit(composeAgentBinding(agentDesignBinding, {custody: custodyDesignBinding, identity: identityDesignBinding, thread: threadDesignBinding}),
    {...sessionGit, openDiff: openSeatDiff}) : null),
    [agentDesignBinding, custodyDesignBinding, identityDesignBinding, threadDesignBinding, sessionGit])
  // The line where you type @ (§18.4): an @ word in the Agent's composer opens Search in a pane on it (central/searchPane.tsx).
  useAtSearch(typeof oneAgent?.values.draft === 'string' ? oneAgent.values.draft : undefined)
  // Git / landing's Seat group: the seat instrument, starting at the selected workcell's seat of the project.
  const seatsUnread = seats.status === 'refused' && seats.error ? seats.error : undefined
  // Join and Release (lane W3): the seat instrument through the kernel's seat_write, attributed to the desk's actor — the person's ref when
  // an identity is current, else the desktop's own (ownerRoutes.ts deskActorOf). The claim it writes is read back on the next seat reading.
  const deskActor = deskActorOf(currentIdentity()?.reading.person_ref ?? null)
  const machineRef = workcellAnswer.status === 'answered' && workcellAnswer.value && typeof (workcellAnswer.value as {workcell_ref?: unknown}).workcell_ref === 'string'
    ? (workcellAnswer.value as {workcell_ref: string}).workcell_ref : undefined
  const seatPorts = useMemo((): SeatPorts => (transport.kind !== 'unavailable'
    ? {seat: request => ownerRouteWrite(transport, seatWriteOp(request), request.kind === 'join' ? ROUTE_WORDS.join : ROUTE_WORDS.release)} : {}), [transport])
  const seatDesignBinding = useMemo(() => seatBinding({status: seats.status === 'answered' ? seats.value : null, ...(seatsUnread ? {unread: seatsUnread} : {}),
    project: rackProject, branch: reading.gitRepo.branch ?? null, workcell: cellName, ...(machineRef ? {machineRef} : {}), actor: deskActor, holds}, seatPorts),
  [seats, seatsUnread, reading.gitRepo.branch, cellName, machineRef, deskActor, holds, seatPorts, rackProject])
  // The pages the chain's devices carry (oneAgentBinding.ts carryPages): the Skillset rack's Capture page (on the armed session's chain)
  // and its Refining page; Git / landing's Seat group.
  const rackCarrying = useMemo(() => (rackDesignBinding ? carryPages(rackDesignBinding, [...(captureOn ? [{page: CAPTURE_PAGE, binding: captureDesignBinding}] : []),
    {page: REFINE_PAGE, binding: refiningDesignBinding}]) : null),
  [rackDesignBinding, captureOn, captureDesignBinding, refiningDesignBinding])
  const gitCarrying = useMemo(() => (gitDesignBinding ? carryPages(gitDesignBinding, [{page: SEAT_PAGE, binding: seatDesignBinding}]) : null),
    [gitDesignBinding, seatDesignBinding])
  // Scope's Before it lands, Escalate to and Grants page are Custody's (§19.12): laid in from its binding under their own keys.
  const scopeCarrying = useMemo(() => (scopeDesignBinding ? withCustodyAsks(scopeDesignBinding, custodyDesignBinding) : null), [scopeDesignBinding, custodyDesignBinding])
  const bindings: Readonly<Record<string, DesignBinding | null>> = useMemo(() => ({
    gateway: gatewayDesignBinding, agent: oneAgent, skillset: rackCarrying, world: scopeCarrying, git: gitCarrying,
  }), [gatewayDesignBinding, oneAgent, rackCarrying, scopeCarrying, gitCarrying])

  // The session's own device (lane BF3): the Agent rack, on every session's track (O-I ticket 842). (The Run was retired, ticket 725, and its
  // constructor with it, ticket 772: a session's course is its track in Arrangement view, §16.1.)
  const ownDevices = useMemo(() => sessionDevices(), [])
  const designsOwn = {agentset: useDesign(AGENTSET_DESIGN, true)}
  // The rack's Join (O-I ticket 684): Central's agent set the group's space names, read, and saved through the person's own central.agent-set.save.
  const setRef = groupTrack?.agentSet?.ref ?? null
  const setInput = useMemo(() => (setRef ? {scope: 'root', ref: setRef} : null), [setRef])
  const groupSet = useCentralAction(transport, 'central.agent-set.read', setInput)
  // Where the rack's macros stand, and each set's it holds (§19.15 Macros, O-I ticket 842): Software Factory's, in the project's Factory state
  // (located for the pads), read again after each write.
  const macrosWhere = useMemo(() => (padsWhere && 'projectRef' in padsWhere ? {statePath: padsWhere.statePath, projectRef: padsWhere.projectRef} : null),
    [padsWhere && 'projectRef' in padsWhere ? padsWhere.statePath : null, padsWhere && 'projectRef' in padsWhere ? padsWhere.projectRef : null]) // eslint-disable-line react-hooks/exhaustive-deps
  const macroSpaces = useMemo(() => rackSpaces(groupTrack, tracks, loneTrack), [groupTrack, tracks, loneTrack])
  const rackMacros = useRackMacrosReadings(transport, macrosWhere, macroSpaces)
  const refreshMacros = rackMacros.refresh
  // Group (§19.15 "Making a rack and a set"): Central proposes the chosen chains as a set and Accept saves its record, each the person's
  // own act (as Messages' group does: AgentRailDevices.tsx centralAct), and AIKit makes them one chain of the rack holding a rack of them.
  // On a lone session the macros turn the one agent through the Agent itself.
  const agentsetPorts = useMemo((): AgentRackPorts => ({
    saveSet: input => setAct(transport, 'central.agent-set.save', input),
    propose: input => setAct(transport, 'central.agent-set.propose', input),
    // Discard: Central's proposal removed at the revision it wrote (central.agent-set.remove, the person's own act).
    removeSet: input => setAct(transport, 'central.agent-set.remove', input),
    suffix: () => globalThis.crypto.randomUUID().slice(0, 8),
    agent: oneAgent,
    // Solo (§19.15 the chain list): what you attend to, the one the Session view's mixer solos (the agent shell's, on the book).
    solo: (ref, on) => shell.setSolo(ref, on),
    // The chain list's Activator, Add a chain, Drag out and Hot-Swap, and the Decision helper dropped on it (§19.15): AIKit's bench, attach,
    // drag out and hot-swap of a chain's session and its Decision helper of the space, through the kernel.
    ...(transport.kind !== 'unavailable' ? {
      bench: input => chainListAct(transport, {op: 'encounter_session_bench', ...input}, input.benched ? 'a chain was benched' : 'a chain\'s bench was lifted'),
      attach: input => chainListAct(transport, {op: 'encounter_session_attach', ...input}, 'a chain joined the rack'),
      dragOut: input => chainListAct(transport, {op: 'encounter_session_drag_out', ...input}, 'a chain was dragged out into a space of its own'),
      hotSwap: input => chainListAct(transport, {op: 'encounter_session_hot_swap', ...input}, 'a chain\'s agent was hot-swapped'),
      decisionHelper: input => chainListAct(transport, {op: 'encounter_session_decision_helper', ...input}, input.bound ? 'a Decision helper joined the rack' : 'the Decision helper left the rack'),
      detach: input => chainListAct(transport, {op: 'encounter_session_detach', ...input}, 'a chain was deleted from the rack'),
      // A group's Model and Effort macros: each chain's session's model select in AIKit (the encounter's model-read, then model-select).
      sessionModel: {read: ({project, agent_session}) => sessionModelRead(transport, project, agent_session), select: ({project, request}) => sessionModelSelect(transport, project, request)},
      // The Budget macro: each chain's task Budget in AIKit (encounter_task_read, then encounter_task_budget).
      taskBudget: {read: ({project, agent_session}) => chainTaskRead(transport, project, agent_session), write: input => chainTaskBudget(transport, input)},
      // Group: AIKit seats the chosen chains in the set's own space, held by the rack's as one chain.
      group: input => chainListAct(transport, {op: 'encounter_session_group', ...input}, 'chains were grouped into a set'),
      // Unmap, Store, the variations and where each macro stands: Factory's rack macros, the person's, on the rack's revision.
      ...(macrosWhere ? {rackMacros: input => factoryOwnerWrite(transport, {kind: 'rack-macros-write', state_path: macrosWhere.statePath, project_ref: macrosWhere.projectRef, ...input},
        '`factory development rack-macros-write`').finally(refreshMacros)} : {}),
      // Retry: the chosen chain's bound task (AIKit's task record), its units read in Factory and its unit retried (taskBindings.ts retryTask).
      retry: async ({project, agent_session}) => {
        if (!custodyState) throw Error('Retry: Factory keeps no state for this project here (`factory development locate`), so no unit of the task is read.')
        await retryTask(request => factoryOwnerWrite(transport, request, `factory_owner ${request.kind}`), custodyState, await boundTaskOf(transport, project, agent_session, 'Retry'))
      },
      // Stop after, beside Retry (§19.4; round 870): the chosen chain's bound task, the unit its current attempt stands on asked to stop
      // (taskBindings.ts stopAfterTask, factory_owner attempt-request-cancellation).
      stopAfter: async ({project, agent_session}) => {
        if (!custodyState) throw Error('Stop after: Factory keeps no state for this project here (`factory development locate`), so no unit of the task is read.')
        await stopAfterTask(request => factoryOwnerWrite(transport, request, `factory_owner ${request.kind}`), custodyState, await boundTaskOf(transport, project, agent_session, 'Stop after'))
      },
      // A device of another session's chain (DLW build ruling 2026-11-05): a message to that session's agent's Position (AIKit's gateway send),
      // turned into work on its task by Messages' own route, the one a message dropped on a track takes (`aikit gateway delegate`, O-I ticket
      // 757). The chain writes both through the kernel itself: Messages is the rail's, never the chain's to reach.
      ask: async ({project, agent_session, agent_ref, device, words}) => {
        const position = positionOf(custodyPopulation, agent_ref)
        if (!position) throw Error(`Devices: AIKit's population places ${agent_ref} at no Position, so no message reaches its session.`)
        const work = await boundTaskOf(transport, project, agent_session, 'Devices')
        const scope = project ? {project} : {}
        const sent = await ownerRouteWrite(transport, gatewayWriteOp({kind: 'send', ...scope, to: position, body: words}), ROUTE_WORDS.send)
        const communique = communiqueRefOf(sent)
        if (!communique) throw Error('Devices: AIKit took the message but named no Communique, so it could not be turned into work.')
        await ownerRouteWrite(transport, gatewayWriteOp({kind: 'delegate', ...scope, communique, work,
          reason: `Asked from the Agent rack: a change of ${device} on this session's chain.`}), ROUTE_WORDS.delegate)
      },
    } : {}),
  }), [transport, oneAgent, shell.setSolo, macrosWhere, refreshMacros, custodyState, custodyPopulation])
  // The Decision helper (§19.20, T-AGENCY K5): a device of its own, a chain of the group's Agent rack in place of an Agent, on AIKit's
  // decision provider and QL's team space — read only where the group's space names its helper (AIKit's `decision_helper`, round 860). The
  // rack lists it among its chains.
  const helperStands = sessionRef != null && !!groupTrack?.decisionHelper
  const helperReadings = useDecisionHelperReadings(transport, helperStands)
  const helperDevice = useMemo(() => decisionHelperDevice(), [])
  const helperDesignBinding = useMemo(() => decisionHelperBinding({status: helperReadings.status, teamSpace: helperReadings.teamSpace}),
    [helperReadings.status, helperReadings.teamSpace])
  // Each chain's chip (§19.15 the chain list): the model its session last reported, from Actuation's usage records over every session.
  const groupUsage = useActuationRead(transport, groupTrack ? {kind: 'usage-list'} : null)
  const chainModels = useMemo(() => (groupUsage.status === 'answered' ? lastUsageModels(groupUsage.value) : null), [groupUsage])
  // A group's Model and Effort macros, and a lone session's Model, stand where every agent chain's session stands: its model as its harness
  // reports it (AIKit's model-read).
  const macroChains = useMemo(() => agentChainSessions(groupTrack, tracks, loneTrack), [groupTrack, tracks, loneTrack])
  const chainModelReadings = useChainModelReadings(transport, macroChains)
  const agentsetDesignBinding = useMemo(() => agentsetBinding({group: groupTrack, session: loneTrack, agent: oneAgent?.values ?? null, tracks, models, holds,
    nowUnixMs: sessions?.nowUnixMs ?? 0, ...(setRef ? {set: groupSet} : {}), ...(helperStands && helperDevice ? {helper: helperDesignBinding.values} : {}), soloed: shell.soloed,
    chainModels, chainModelReadings, rackMacros: rackMacros.readings}, agentsetPorts),
  [groupTrack, loneTrack, oneAgent, tracks, models, holds, sessions?.nowUnixMs, setRef, groupSet, helperStands, helperDevice, helperDesignBinding, agentsetPorts, shell.soloed, chainModels,
    chainModelReadings, rackMacros.readings])
  // How far each plate of a session's chain reaches (factoryPlaces.ts reachOf): the rack's chains, and the lone session's own inside it.
  const rackChains = useMemo(() => rackChainsOf(agentsetDesignBinding.values.members), [agentsetDesignBinding.values.members])
  const reachHere = (slot: FactorySlot): Reach => (place.kind === 'session' ? reachOf(slot, rackChains, loneTrack?.sessionRef) : ON_ITS_TRACK)

  // The Main track's reader: Approvals on the shown session's consent requests and the world's source returns (lane K1's
  // source_returns_read); the default answer is the Gateway's, never Approvals' (ticket 788). The Ledger is a monitor on the rail
  // (AgentRailDevices.tsx). Approvals is "one place to answer what waits for you" (§19.14) on Factory's Main track, which is no session's:
  // it reads every project's returned work, as Central's does in your world (agent/worldScope.ts useWorldReturns), each row in its own
  // project, and says why when none stands (a world with no project).
  const receipts = useMemo(() => receiptDevices(), [])
  const designsReceipts = {approvals: useDesign(APPROVALS_DESIGN, true)}
  const shownTrack = shown ? tracks?.find(item => item.sessionRef === shown && !item.group) ?? null : null
  const approvalsReturns = useWorldReturns(transport, null)
  const returned = approvalsReturns.returns
  // Factory's unit decisions (W9): the questions the shown session's Runs wait on (unitDecisions.ts), read from the Runs its takes name.
  const shownTakesAll = useAttemptTakes(transport, shownTrack ? [shownTrack.sessionRef] : [], shownTrack?.project ?? ROOT_REGISTER)
  const unitRuns = useMemo(() => {
    const takes = shownTakesAll && shownTrack ? shownTakesAll.of(shownTrack.sessionRef) ?? [] : []
    return takes.filter((take, at) => takes.findIndex(other => other.runRef === take.runRef && other.statePath === take.statePath) === at)
      .map(take => ({statePath: take.statePath, runRef: take.runRef}))
  }, [shownTakesAll, shownTrack])
  const unitsRead = useUnitDecisions(transport, unitRuns)
  // The Run map's Run (§19.25 To use, 1: "Run map shows the run of the selected work"): the Run the shown session's newest take names,
  // read with its Journey and the Journey's Runs — the work across runs, whichever sessions ran them (runJourney.ts; O-I 844).
  const mapTake = useMemo(() => {
    const takes = shownTakesAll && shownTrack ? shownTakesAll.of(shownTrack.sessionRef) ?? [] : []
    return takes.reduce<(typeof takes)[number] | null>((newest, take) => (!newest || (take.startUnixMs ?? 0) >= (newest.startUnixMs ?? 0) ? take : newest), null)
  }, [shownTakesAll, shownTrack])
  const mapChain = useRunJourney(transport, mapTake?.statePath ?? null, mapTake?.runRef ?? null)
  const runMapDesignBinding = useMemo(() => {
    if (!mapTake) return runMapBinding(holds)
    const value = mapChain.status === 'answered' ? mapChain.value ?? null : null
    const map = value && typeof value.run === 'object' && value.run ? (value.run as {runMap?: {nodes?: unknown}}).runMap : undefined
    const nodes = map && map.nodes && typeof map.nodes === 'object' ? Object.values(map.nodes as Record<string, unknown>) : []
    // Each work node's workflow unit (the run reading's semanticRef), which Retry names to Factory.
    const units = Object.fromEntries(nodes.flatMap(node => {
      const row = node as {id?: unknown; semanticRef?: unknown}
      return typeof row.id === 'string' && typeof row.semanticRef === 'string' ? [[row.id, row.semanticRef]] : []
    }))
    return runMapBinding(holds, {statePath: mapTake.statePath, runRef: mapTake.runRef, units},
      transport.kind !== 'unavailable' ? {owner: request => factoryOwnerWrite(transport, request, '`factory attempt retry`')} : {},
      {status: mapChain.status, value, error: mapChain.error})
  }, [holds, mapTake, mapChain, transport])
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
  // The asking agent's Scope (§19.12, §19.14): AIKit's settings of the shown session — its Wait and On no answer, and what its executor did
  // with its asks — read here and set on its Scope.
  const shownAnswer = useSettingsAnswer(transport, shownTrack?.sessionRef ?? null, shownTrack?.project ?? ROOT_REGISTER).reading
  const shownSettings = shownAnswer.status === 'answered' ? shownAnswer.value as EncounterSessionSettingsReading | null : null
  const approvalsDesignBinding = useMemo(() => {
    const state = observedState(shownHandle)
    const actions = shownHandle && 'actions' in shownHandle ? shownHandle.actions : undefined
    // Approvals is handed no Gateway: the default answer is the Gateway's own, set on the Gateway (§19.14, §19.2; ticket 788).
    const binding = approvalsBinding({session: shownTrack, encounter: state?.reading ?? null, holds,
      returns: returned, returnsAbsent: approvalsReturns.absent, returnsRefused: approvalsReturns.refusals, tracks, nowUnixMs: sessions?.nowUnixMs ?? Date.now(), units, person,
      refinements: rackRefinements, settings: shownSettings},
      {...(actions ? {permission: (id, decision) => actions.permission(id, decision)} : {}),
        // A skill's proposed revision (§19.7): Accept and Discard through the Refining page's own AIKit verbs; Open shows it on the
        // Skillset rack's Refining page, where a session's chain stands the rack.
        ...(refineWrite ? {refine: refineWrite} : {}), ...(centralRevision ? {refineCentral: centralRevision} : {}),
        openRefinement: member => openRefinement(member),
        approve: row => acceptSourceReturn(transport, returnProjectOf(row, null), row, person),
        // Deny on a proposal (§19.14): Central's projectcentral.source.return_reject through invoke_action (sourceReturnAccept.ts).
        reject: row => rejectSourceReturn(transport, returnProjectOf(row, null), row),
        ...(transport.kind !== 'unavailable' ? {answerUnit: (project, review) => receiving(transport, project, review).catch(cause => { throw new Error(refusalWords(cause instanceof Error ? cause.message : String(cause))) })} : {})})
    const commented = withReturnComments(binding, {returns: returned, comment: agentDraft, absent: approvalsReturns.absent}, {
      send: (row, words) => commentSourceReturn(transport, returnProjectOf(row, null), row, words, person),
      after: () => { void agentWrite?.([{key: 'draft', value: ''}]) },
    })
    // Notifications' readings wait here under Requests (§23.9; the Notifications device was retired into Approvals in the 22 Oct manual
    // rewrite): the requests Central keeps for personal.notify, Messages' waiting agents and the desktop's notice (railBindings.ts
    // withOwnerRequests), as Central's Approvals carries them; Open marks an item opened here, after opening an owner's request.
    return withOwnerRequests(commented, {...ownerRequests, nowUnixMs: sessions?.nowUnixMs || Date.now()}, openNotificationTarget,
      {opened: openedOf(viewHolds(holds, APPROVALS_ID).opened), hold: ids => holdView(APPROVALS_ID, 'opened', openedHold(ids))})
  }, [shownHandle, shownTrack, holds, returned, approvalsReturns.absent, approvalsReturns.refusals, tracks, sessions?.nowUnixMs, transport, person, units, agentDraft, agentWrite, ownerRequests,
    rackRefinements, refineWrite, centralRevision, shownSettings])

  // A workcell's devices (§19.23): Git / landing's Seat group (the seat instrument), starting at the selected workcell's seat of the project;
  // and the Remote carrier (Workcell's status). Workcell's instrument stands on no chain: the rail's publisher holds it with its Seats and
  // Machine pages (AgentRailDevices.tsx).
  const cells = useMemo(() => workcellDevices(), [])
  const designsCells = {carrier: useDesign(CARRIER_DESIGN, true)}
  // The Remote carrier: Workcell's status, and each listed connection's record (`workcell connections show`, lane W3); its offers
  // (`workcell discover`) and each connection's probe (`workcell connections probe`, a read that never writes the record; lane W10).
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
  // The runs the chosen world names, for the Plan's run chooser where there are several (O-I 757): held by their content, since the
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

  // Publish each device to the door: the pool shows the chosen one whole, a pane shows it full, from these same devices — a
  // designed device with its binding, so every place draws the design on the same owner values.
  // The Agent's own Full is its thread (§19.4 Full "The thread"): the design's Full on its Thread page (`thread.*`), so every ⤢ — the
  // chain's, the pool's, the rail's — opens the Agent itself. The Gateway's own Full is the Frames monitor (§19.2): its ⤢ opens the
  // monitor's pane.
  useEffect(() => {
    for (const {slot, device} of chain) publishDevice(device.id, {device, picture: size => chainPicture(slot.id, pictures, size), ...(bindings[slot.id] ? {binding: bindings[slot.id]!} : {}),
      ...(slot.id === 'agent' ? {acts: profileActs.agent} : slot.id === 'skillset' ? {acts: profileActs.skillset} : {}),
      ...(slot.id === 'gateway' && main.frames ? {full: {open: () => openDevice(FRAMES_ID, 'Frames')}} : {})})
    if (memberDevice && memberDesignBinding) publishDevice(memberDevice.id, {device: memberDevice, binding: memberDesignBinding})
    else publishDevice(MEMBER_DEVICE_ID, null)
  }, [chain, bindings, memberDevice, memberDesignBinding, main.frames, profileActs]) // the pictures read the reading `chain` is built from
  useEffect(() => { publishDevice(RUN_MAP_ID, runMapDev ? {device: runMapDev, binding: runMapDesignBinding} : null) }, [runMapDev, runMapDesignBinding])
  useEffect(() => { publishDevice(PROMPT_PADS_ID, padsDev ? {device: padsDev, binding: mainBindings.pads, acts: padsActs} : null) }, [padsDev, mainBindings, padsActs])
  useEffect(() => {
    const own = [[AGENTSET_ID, ownDevices.agentset, agentsetDesignBinding], [DECISION_HELPER_ID, helperStands ? helperDevice : null, helperDesignBinding],
      [APPROVALS_ID, receipts.approvals, approvalsDesignBinding], [CARRIER_ID, cells.carrier, carrierDesignBinding]] as const
    for (const [id, device, designBinding] of own) publishDevice(id, device ? {device, binding: designBinding} : null)
  }, [ownDevices, receipts, cells, agentsetDesignBinding, helperStands, helperDevice, helperDesignBinding, approvalsDesignBinding, carrierDesignBinding])
  useEffect(() => () => {
    // The chain withdraws exactly what it publishes. The Thread and Custody (the Agent carries them, §19.4), Tasks and Runs (a task is a
    // clip, a run its track's take lanes, §19.1), the Run, the Experiment (a task launched with Repeat, §19.5) and the Seat (Git / landing's
    // Seat page, §19.17) publish nowhere, and the door is the session's memory, so no entry of theirs can stand to be cleared (ticket 804).
    // The Link is the transport's (§19.19), and the rail's agent devices — Messages, Frames, the Ledger, Workcell's instrument — are the rail's
    // publisher's (AgentRailDevices.tsx RAIL_AGENT_DEVICE_IDS): none of them is withdrawn here.
    for (const id of [...CHAIN_DEVICE_IDS, MEMBER_DEVICE_ID, AGENTSET_ID, DECISION_HELPER_ID, APPROVALS_ID, CARRIER_ID, RUN_MAP_ID, PROMPT_PADS_ID]) publishDevice(id, null)
  }, [])

  const choose = (slotId: string) => { shell.setExpandedDevice(slotId as AgentDeviceId); selectDevice(chainDeviceId(slotId)) }
  // The chain's one law (inhabitants/sdk/chains.ts): a session's chain, or a workcell's road. A slide asks it.
  const law = chainLaw(place.kind === 'workcell' ? 'workcell' : 'factory-session')
  const slideWords = (id: string): string => { const standing = slotStanding(law, id); return standing.moves ? `${SLIDE_PLACE}.` : standing.why }
  // A rack's head hides the devices of its chosen chain (manual §16.4; Live's rack head): the Skillset rack's member inside its slot, and the
  // Agent rack's chain on a lone session (its own agent's devices).
  const memberShown = useRackShown(chainDeviceId('skillset'), 'devices')
  const rackDevicesShown = useRackShown(AGENTSET_ID, 'devices')
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
        line: `«${active.reorder.title}» over ${target.label} — ${slideWords(active.reorder.id)}`,
        receipt: encodeChainDrag(active.reorder),
      })
      return
    }
    // A SkillSet dropped on the Skillset rack (its Hot-swap, §16.4): Central's agent-profile.chain-replace puts it where the one the agent
    // carries stood, at the profile's revision as read.
    if (active.drag.family === 'skillset' && target.kind === 'card' && target.id === 'skillset' && chainProfile) {
      const asked = replaceRequest(chainProfile, active.drag.ref)
      const refuse = (line: string) => setNote({kind: 'refused', title: 'Hot-swap refused', line, receipt: encodeChainDrag(active.drag)})
      if ('refused' in asked) { refuse(asked.refused); return }
      if (!profileAct) { refuse('Hot-swap: the kernel carrier is unavailable here, so Central cannot be asked.'); return }
      try {
        await profileAct(asked.action, asked.input)
        setNote({kind: 'receipt', title: 'Hot-swapped', line: `«${active.drag.label}» stands where ${String(asked.input.replace)} stood on the agent's chain (Central's agent-profile.chain-replace).`, receipt: null})
      } catch (cause) { refuse(refusalWords(cause instanceof Error ? cause.message : String(cause))) }
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
  }, [shell, transport, binding, chainProfile, profileAct])

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
      aria-label={`Slide ${title}: drag, or Alt+Arrow — ${slideWords(id)}`} data-i={`Slide ${title}|${slideWords(id)}`}
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
    const reach = reachHere(slotId)
    return (
      <div className="factory-slot" data-slot={slot.id} data-family={slot.family} data-device={slot.id} data-reaches={reach.reaches}
        data-selected={shell.expandedDevice === slot.id} data-i={SLOT_DATA_I[slot.id] ? withReach(SLOT_DATA_I[slot.id]!, reach) : undefined} onClick={() => choose(slot.id)}
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
        {slot.id === 'skillset' && memberDevice && memberDesignBinding && memberShown && (
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

  // The visible drop slot for a slide (it opens under the pointer among the agent chain's slots, in the order they are drawn, the rack's
  // own chain among them, and closes on release). It never lies: a slot is not a landing, the owner operation (here: the refusal naming the
  // missing order op) is.
  let slotIndex = 0
  const gapBefore = () => { const at = held?.kind === 'reorder' && gap === slotIndex; slotIndex += 1; return at && <span className="agent-chain-gap" aria-hidden="true" /> }

  /** The Agent rack (§19.15, §16.4): its head — title bar, macros, chain list — then, under its Devices mark, the devices of the chain it
   * holds on a lone session, the session's own agent (RACK_CHAIN: the Skillset rack with its member, the Agent), then its end bracket. A
   * group's chains are its sessions, each drawn in the rack's own list. */
  const rackPlate = () => {
    const reach = reachHere('agentset')
    const head = placed(AGENTSET_ID, ownDevices.agentset, agentsetDesignBinding, designsOwn.agentset ? AGENTSET_DESIGN : undefined, 'the Agent rack',
      {attrs: {'data-session-slot': 'agentset', 'data-reaches': reach.reaches, 'data-i': agentDataI('Agent rack', reach.says)}})
    if (!head) return null
    const own = loneTrack && rackDevicesShown ? RACK_CHAIN.map(slot => slotPlate(slot)) : []
    const inside = loneTrack ? reachHere(RACK_CHAIN[RACK_CHAIN.length - 1]!) : null
    return (
      <div className="factory-rack" data-rack={AGENTSET_ID} data-chains={rackChains.length}>
        {head}
        {inside && own.some(Boolean) && (
          <div className="factory-rack__chain" data-chain={loneTrack!.sessionRef} data-reaches={inside.reaches} aria-label={`${rackChains[0]?.name ?? 'The agent'}'s chain`}>
            {own.map((node, at) => <Fragment key={RACK_CHAIN[at]}>{node && gapBefore()}{node}</Fragment>)}
          </div>
        )}
        <span className="factory-rack__end" aria-hidden="true" />
      </div>
    )
  }

  /** One plate of the place's chain (factoryPlaces.ts chainSlots), by what stands there. */
  const plate = (slot: FactorySlot) => {
    if (AGENT_SLOTS.has(slot)) return slotPlate(slot)
    switch (slot) {
      // Every session's chain (§16.2, §19.15): the Agent rack, whose chains are the agents and agent sets the session may use — a group's
      // sessions and the Decision helper that answers them (§19.20), or a lone session's own agent.
      case 'agentset': return rackPlate()
      // The Main track (§16.2, §19.1): the Run map, then Approvals, where every proposal waits (§19.14), then the Prompt pads.
      case 'approvals': return placed(APPROVALS_ID, receipts.approvals, approvalsDesignBinding, designsReceipts.approvals ? APPROVALS_DESIGN : undefined, 'Approvals', {attrs: {'data-main-slot': 'approvals'}})
      case 'run-map': return placed(RUN_MAP_ID, runMapDev, runMapDesignBinding, designsMain.runMap ? RUN_MAP_DESIGN : undefined, 'the Run map', {attrs: {'data-main-slot': 'run-map'}})
      case 'prompt-pads': return placed(PROMPT_PADS_ID, padsDev, mainBindings.pads, designsMain.pads ? PROMPT_PADS_DESIGN : undefined, 'the Prompt pads', {attrs: {'data-main-slot': 'prompt-pads'}})
      // The road in (§16.2 "Connections keep the same order"; §19.18): the Remote carrier names the machine the work runs on — on a
      // workcell's chain, and on a session's before the rack, where it reaches every chain.
      case 'remote-carrier': return placed(CARRIER_ID, cells.carrier, carrierDesignBinding, designsCells.carrier ? CARRIER_DESIGN : undefined, 'the Remote carrier',
        {attrs: place.kind !== 'session' ? {'data-workcell-slot': 'remote-carrier'} : {'data-session-slot': 'remote-carrier',
          'data-reaches': reachHere('remote-carrier').reaches, 'data-i': agentDataI('Remote carrier', reachHere('remote-carrier').says)}})
      default: return null
    }
  }

  // The place's chain, left to right, with the visible drop slot while a card slides.
  const slots = chainSlots(place, {runMap: !!runMapDev, pads: !!padsDev})
  const plates = slots.map(slot => <Fragment key={slot}>{AGENT_SLOTS.has(slot) && gapBefore()}{plate(slot)}</Fragment>)
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
          data-i={`Workcell ${place.name}|Its chain: the Gateway, the Remote carrier, and Git / landing with its seat. Every track that works in ${place.name} shares it.`}>
          {plates}{trailingGap}
        </div>}
        {/* A selected session shows its own chain (§16.2): the connections, the Agent rack, Scope, Git / landing. */}
        {place.kind === 'session' && <>{plates}{trailingGap}</>}
        <div className={'agent-dropz dropz' + (held ? ' armed' : '')} data-slot="zone" data-i={DROP_ZONE_DATA_I} title={DROP_ZONE_DATA_I.split('|')[1]}>
          {held ? dropZoneLine(held) : 'Drop gateways, agents, skillsets, worlds or git here'}
        </div>
      </div>
    </div>
  )
}
