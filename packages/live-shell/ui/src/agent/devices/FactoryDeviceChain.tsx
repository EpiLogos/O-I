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
import {Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type HTMLAttributes} from 'react'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, publishedDevice, selectDevice, subscribeDeviceDoor} from '../../frame/devices/deviceDoor'
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
import {useRosterAnswer, useSettingsAnswer, useTaskAnswer} from '../../owners/readers'
import {useModelSlice} from '../../owners/model'
import {useWorkspace} from '../../shell/workspaceContext'
import {gitRepositoryAbsence, projectOfSession, registerOf, ROOT_REGISTER} from '../worldScope'
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
import {chainListAct, chainTaskBudget, chainTaskRead, sessionModelRead, sessionModelSelect, sessionSetAct, useChainModelReadings, useRackMacrosReadings} from '../factoryTaskActs'
import {RefusalCard, safeJson} from '../RefusalCard'
import {CHAIN_DEVICE_IDS, SOURCES_DESIGN, SOURCES_DEVICE_IDS, agentChainDevices, chainDeviceId, gatewayDisclosed, rackMemberDevice, type ChainWrite} from './agentChainDevices'
import {chainPicture, type PictureContext} from './AgentDevicePictures'
import {
  AGENT_DESIGN, AGENT_P0_ROWS, GATEWAY_DESIGN, LANDING_DESIGN, MEMBER_DESIGN, MEMBER_DEVICE_ID, RACK_DESIGN, SCOPE_DESIGN, SLOT_DESIGN_FACE, agentBinding, designWaits,
  gatewayBinding, memberBinding,
  memberChains, rackBinding, refiningBinding, scopeBinding, seatedProfile, useChainHolds, viewHolds, type AgentRows, type MemberPorts, type RackUpkeep,
  type RefiningPorts, callsOf, callsOnEvery, chainFromModel, lastUsageModels, type CallsDecision,
} from './designBindings'
import {useOwnerAccepted} from './ownerAccepted'
import {useSelectedSkillChain} from './skillRackSelection'
import {composePorts, useRackReading} from './useRackReading'
import {observedState, useEncounterSessions} from './EncounterObservers'
import {FRAMES_ID, mainDevices} from './mainTrackBindings'
import {askRowsOf, shownSession, threadBinding, threadJson} from './threadBinding'
import {CAPTURE_PAGE, REFINE_PAGE, SEAT_PAGE, carryPages, composeAgentBinding, withAgentGit} from './oneAgentBinding'
import {testRefinement, useScopeWaits, writeSessionSettings} from '../sessionSettings'
import {identityFromModel, useIdentityHolds} from '../../central/devices/agentChainDevices'
import {useAgentSetReadings, useCentralAction} from '../../central/devices/useCentralReadings'
import {actionAnswerOf, centralActionOp} from '../../central/devices/centralActions'
import {useAtSearch} from '../../central/searchPane'
import {useAttemptTakes} from '../../owners/attemptTakes'
import {useWorkcellAnswer} from '../../owners/readers'
import {factoryLocateOp, useSessionCustody} from './sessionCustody'
import {
  AGENTSET_DESIGN, AGENTSET_ID, PROFILE_REFUSE, agentChainSessions, agentsetBinding, chainProfileOf, custodyBinding, orderRequest, pinSourceRequest,
  profileHeadActs, rackSpaces, seatedReviewOf, skillSetDropRequest, sessionDevices, sourcesBinding, sourcesHeadWords, sourcesPlaced as placedSources, unpinSourceRequest,
  withCustodyAsks, type AgentRackPorts, type CustodyPorts, type SourcesPlacementName, type SourcesPorts,
} from './sessionChainBindings'
import {familyFaceDevice} from './mainTrackBindings'
import {publishChainHead} from '../../shell/modeDetails'
import {openInReader} from '../../frame/browser/constellationActs'
import {APPROVALS_DESIGN, APPROVALS_ID, approvalsAwayBinding, receiptDevices} from './receiptBindings'
import {CARRIER_DESIGN, CARRIER_ID, carrierBinding, connectionLabels, gitBinding, planRunOf, runDemandOf, seatBinding, seatDropRefusal, workcellDevices, type SeatPorts} from './workcellBindings'
import {ROUTE_WORDS, aikitWriteOp, centralRevisionWrite, deskActorOf, factoryOwnerWrite, ownerRouteWrite, refinementWrite, refusalWords, seatWriteOp} from './ownerRoutes'
import {worldsOf} from './workcellMaterial'
import {currentIdentity} from '../../../../../../desktop/cradle/src/nara/identity/current'
import {WORKCELL_RACK_ID, chosenWorld, workcellGitReading} from './workcellRackBinding'
import {AGENT_SLOTS, ON_ITS_TRACK, RACK_CHAIN, SOURCES_OFF_DRAG, chainSlots, factoryPlace, reachOf, sourcesPlaceRequest, sourcesPlacementOf, sourcesUnplaceRequest, type FactorySlot,
  type RackChainName, type Reach} from './factoryPlaces'
import {useOwnerOp} from '../../owners/ownerCall'
import type {AikitWriteRequest, KernelOp} from '../../../../../../desktop/cradle/src/kernel/types'
import {kernelAct, kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {DECISION_HELPER_ID, decisionHelperBinding, decisionHelperDevice} from './decisionHelperBinding'
import {captureSkillBinding, type CaptureSkillPorts} from './captureSkillBinding'
import {useSongClipFocus} from '../songClips'
import {RUN_MAP_DESIGN, RUN_MAP_ID, runMapBinding, runMapDevice} from './runMapBinding'
import {useRunJourney} from './runJourney'
import {PROMPT_PADS_DESIGN, PROMPT_PADS_ID, padsHeadActs, padsLocation, promptPadsBinding, promptPadsDevice, type PadsPresetPorts, type PromptPadsPorts} from './promptPadsBinding'
import {useDecisionHelperReadings} from './decisionHelperReads'
import {useTeamSpace, withTeamCell} from './teamCell'
import {useActuationRead, useAikitRead, useConnectionShows, useSeatStatusAnswer, useWorkcellRead} from './workcellReads'
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
  const {transport} = useWorkspace()
  const sessions = useAgentSessionsOptional()
  // The chain's devices are declarations (inhabitants/agentParamAddresses.ts CHAIN_DECLARATIONS): each reads the World Model's slice it
  // names — the Gateway and the Agent the sessions slice (AIKit's gateway, its binding and that binding's harness reading), Git / landing
  // the workcells slice (Workcell's status and the seat of the session's project), the Harness and Model choosers the agents and models
  // slices — kept current by the World Model's `model_changed`. The roster and the session's task record are the window's shared answers.
  const sessionsSlice = useModelSlice(transport, 'sessions'), workcellsSlice = useModelSlice(transport, 'workcells')
  const agentsSlice = useModelSlice(transport, 'agents'), modelsSlice = useModelSlice(transport, 'models')
  const chainProject = projectOfSession(sessions?.rows ?? [], sessionRef)
  const rosterAnswer = useRosterAnswer(transport, null)
  const roster = rosterAnswer.reading
  const taskAnswer = useTaskAnswer(transport, transport.kind === 'unavailable' ? null : sessionRef, chainProject).reading
  const {reading, binding, resolved, harnesses, models, ecology, git: sessionGit} = useMemo(() => chainFromModel({
    slices: {sessions: sessionsSlice, workcells: workcellsSlice, agents: agentsSlice, models: modelsSlice},
    sessionRef, project: chainProject, absent: gitRepositoryAbsence(sessionRef, chainProject), roster, task: taskAnswer,
    unreachable: transport.kind === 'unavailable' ? transport.reason ?? 'Transport unavailable' : null,
  }), [sessionsSlice, workcellsSlice, agentsSlice, modelsSlice, sessionRef, chainProject, roster, taskAnswer, transport])
  // The settings an owner accepted on this harness: the only readings effort and input have. The shell's own effort, steer,
  // heartbeat and write-arm flags are presentation, so they are not read here.
  const accepted = useOwnerAccepted(binding)
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
      model: rows.find(row => row.key === 'model'), effort: rows.find(row => row.key === 'effort'), input: rows.find(row => row.key === 'input'),
      heartbeat: rows.find(row => row.key === 'heartbeat'),
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
  const profile = useMemo(() => seatedProfile(roster.status === 'answered' ? roster.value : null, track?.agentRef ?? null), [roster, track?.agentRef])
  // The chain is the profile Central keeps for the agent (§19.4; Central PR 318): the Agent's Rename and the Skillset rack's Hot-swap write it
  // at its revision as read, and the roster is read again behind each act.
  const chainProfile = useMemo(() => chainProfileOf(profile), [profile])
  const refreshRoster = rosterAnswer.refresh
  const profileAct = useMemo(() => (transport.kind !== 'unavailable'
    ? async (action: string, input: Readonly<Record<string, unknown>>) => { try { return await setAct(transport, action, input) } finally { refreshRoster() } }
    : undefined), [transport, refreshRoster])
  const profileActs = useMemo(() => profileHeadActs(chainProfile, profileAct), [chainProfile, profileAct])
  // Sources (§19.9; DLW build ruling 2026-11-05), an effect before the Agent: ahead of the Agent rack, the shared reading every agent of it
  // reads; inside the agent's chain, its own. AIKit's settings of the session place it (a drop of Sources, attemptDrop) and hold its Search
  // first, Link depth and Read budget; Pinned is Central's agent-profile pins; the routes' lights are AIKit's knowledge status; Read is
  // AIKit's record of the run's knowledge use, with Read again and Forget. It is drawn, and its owners read, only where AIKit places it.
  const sourcesSession = !workcell && sessionRef != null && !track?.group ? sessionRef : null
  const sourcesSettings = useSettingsAnswer(transport, sourcesSession, rackProject).reading
  const sourcesAt = useMemo(() => {
    const settings = sourcesSettings.status === 'answered' ? sourcesSettings.value : null
    return {settings, rack: placedSources(settings, 'rack'), chain: placedSources(settings, 'chain')}
  }, [sourcesSettings])
  const sourcesOn = contextOn && sourcesSession != null && (sourcesAt.rack || sourcesAt.chain)
  const sourcesReads = useAikitRead(transport, sourcesOn ? {kind: 'knowledge-reads', agent_session: sessionRef!, project: register} : null)
  const knowledgeOp = useMemo((): KernelOp | null => (sourcesOn ? {op: 'knowledge', ...(register ? {project: register} : {}), request: {action: 'status'}} : null), [sourcesOn, register])
  const knowledgeStatus = useOwnerOp(transport, knowledgeOp, 'knowledge').reading
  const sourcesPlaced = sourcesAt.rack || sourcesAt.chain
  const sourcesDesign = useDesign(SOURCES_DESIGN, sourcesPlaced)
  const sourcesDevs = useMemo(() => ({rack: familyFaceDevice(SOURCES_DEVICE_IDS.rack, 'ai-kit', 'sources', 'Sources', 'lib'),
    chain: familyFaceDevice(SOURCES_DEVICE_IDS.chain, 'ai-kit', 'sources', 'Sources', 'lib')}), [])
  // Pinned's acts are Central's (§19.9 "which Central keeps in the agent's profile"): a file dropped on the face, wherever it is drawn, is
  // pinned through agent-profile.pin-source, and the chosen pin's held Unpin is agent-profile.unpin-source, each at the profile's revision
  // as read; Central refuses in its own words, and the chain's note says what happened.
  const pinPorts = useMemo((): Pick<SourcesPorts, 'pin' | 'unpin'> => {
    if (!profileAct) return {}
    const act = async (title: string, asked: {action: string; input: Readonly<Record<string, unknown>>}, what: string, done: string) => {
      try {
        await profileAct(asked.action, asked.input)
        setNote({kind: 'receipt', title, line: `«${what}» ${done} (Central's ${asked.action}).`, receipt: null})
      } catch (cause) {
        const line = refusalWords(cause instanceof Error ? cause.message : String(cause))
        setNote({kind: 'refused', title: `${title === 'Pinned' ? 'Pin' : 'Unpin'} refused`, line: `«${what}» — ${line}`, receipt: null})
        throw new Error(line)
      }
    }
    return {
      pin: async path => {
        if (!chainProfile) throw new Error(PROFILE_REFUSE.unread('Pin'))
        const asked = pinSourceRequest(chainProfile, path)
        await act('Pinned', asked, path, `is pinned in ${chainProfile.name ?? chainProfile.profileRef}'s profile at its revision`)
      },
      unpin: async reference => {
        if (!chainProfile) throw new Error(PROFILE_REFUSE.unread('Unpin'))
        await act('Unpinned', unpinSourceRequest(chainProfile, reference), reference, `is no longer pinned in ${chainProfile.name ?? chainProfile.profileRef}'s profile; the source is untouched`)
      },
    }
  }, [chainProfile, profileAct])
  const sourcesPorts = useMemo((): SourcesPorts => (transport.kind === 'unavailable' || sourcesSession == null ? {} : {
    ...pinPorts,
    settings: change => writeSessionSettings(transport, rackProject, sourcesSession, change),
    readAgain: reading => ownerRouteWrite(transport, aikitWriteOp({kind: 'knowledge-read-again', agent_session: sessionRef!, reading, project: register}), '`aikit knowledge read-again`'),
    forget: reading => ownerRouteWrite(transport, aikitWriteOp({kind: 'knowledge-forget-reading', agent_session: sessionRef!, reading, project: register}), '`aikit knowledge forget reading`'),
    open: reading => openInReader({title: reading.page, ...(register ? {project: register} : {}), address: {kind: reading.address.kind === 'wiki' ? 'wiki' : 'source', value: reading.address.value},
      plane: 'page'}, error => { if (error) setNote({kind: 'refused', title: 'Open refused', line: `«${reading.page}» — ${error}`, receipt: null}) }),
  }), [transport, sourcesSession, rackProject, sessionRef, register, pinPorts])
  const sourcesReview = useMemo(() => seatedReviewOf(roster.status === 'answered' ? roster.value : null, track && !track.group ? track.agentRef ?? null : null), [roster, track])
  const sourcesBindings = useMemo(() => {
    const common = {settings: sourcesAt.settings, status: knowledgeStatus.status === 'answered' ? knowledgeStatus.value?.data ?? null : null,
      reads: sourcesReads.status === 'answered' ? sourcesReads.value : null, holds}
    return {rack: sourcesBinding(SOURCES_DEVICE_IDS.rack, {...common, placement: 'rack', review: null}, sourcesPorts),
      chain: sourcesBinding(SOURCES_DEVICE_IDS.chain, {...common, placement: 'chain', review: sourcesReview}, sourcesPorts)}
  }, [sourcesAt, knowledgeStatus, sourcesReads, holds, sourcesReview, sourcesPorts])
  // Sources taken off where it stands (DLW build ruling 2026-11-06), as a device comes off its chain: ⌫ on its plate, or dragged off the
  // chain. AIKit's `sources: false` / `rack_sources: false`; its settings stay AIKit's for when it is placed again.
  const unplaceSources = useCallback(async (placement: SourcesPlacementName) => {
    const where = placement === 'chain' ? 'the agent\'s own chain' : 'the shared reading ahead of the Agent rack'
    if (transport.kind === 'unavailable' || sourcesSession == null) {
      setNote({kind: 'refused', title: 'Sources refused', line: `Sources stays on ${where}: the kernel carrier is unavailable here, so AIKit cannot be asked.`, receipt: null})
      return
    }
    try {
      await writeSessionSettings(transport, rackProject, sourcesSession, sourcesUnplaceRequest(placement))
      setNote({kind: 'receipt', title: 'Sources taken off', line: `Sources is off ${where}; AIKit keeps its settings for when it is placed again (encounter-session-settings).`, receipt: null})
    } catch (cause) {
      setNote({kind: 'refused', title: 'Sources refused', line: `Sources stays on ${where} — ${refusalWords(cause instanceof Error ? cause.message : String(cause))}`, receipt: null})
    }
  }, [transport, sourcesSession, rackProject])
  // The Device head names a placed Sources and its settings, from AIKit's reading of this session (shell/modeDetails.tsx ChainHead).
  const sourcesWords = useMemo(() => sourcesHeadWords(sourcesAt.settings), [sourcesAt])
  useEffect(() => {
    publishChainHead(sourcesSession && sourcesWords ? {subject: sourcesSession, sourcesAhead: sourcesAt.rack, words: sourcesWords} : null)
  }, [sourcesSession, sourcesWords, sourcesAt])
  useEffect(() => () => publishChainHead(null), [])
  // Dragged off the chain, Sources comes off: a drop anywhere outside the chain's row (where nothing else took it) takes it off its place.
  const sourcesGrip = useRef(false)
  useEffect(() => {
    const off = (event: globalThis.DragEvent) => !event.defaultPrevented && !!event.dataTransfer?.types.includes(SOURCES_OFF_DRAG)
      && !(event.target instanceof Node && rowRef.current?.contains(event.target))
    const over = (event: globalThis.DragEvent) => { if (off(event)) { event.preventDefault(); event.dataTransfer!.dropEffect = 'move' } }
    const drop = (event: globalThis.DragEvent) => {
      if (!off(event)) return
      event.preventDefault()
      const placement = event.dataTransfer!.getData(SOURCES_OFF_DRAG)
      if (placement === 'rack' || placement === 'chain') void unplaceSources(placement)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop) }
  }, [unplaceSources])
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
  // Calls to other agents: AIKit's rule for the sender kind agent on the session's gateway bindings, as its ecology reads it (the sessions
  // slice's gateway, Scope's declared `calls`), set on every binding of the session through the kernel's harness_ingress_rule.
  const calls = useMemo(() => (sessionRef == null || waits.world ? null : ecology.status === 'answered' ? callsOf(ecology.value, sessionRef)
    : ecology.status === 'refused' ? {refused: ecology.error ?? 'AIKit refused the gateway\'s ecology.'} : null), [ecology, sessionRef, waits.world])
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
  // The session's custody (sessionCustody.ts): the same readings the Clip view's edits take their hold through and the transport's
  // Re-enable gives back through. Hand back (§19.4; BD r20) is Factory's custody hold, the person's, and the custody list is read again
  // after it (its hand_back is the light).
  const custodyAt = useMemo(() => (sessionRef != null ? {sessionRef, project: rackProject, agentRef: track?.agentRef ?? null} : null), [sessionRef, rackProject, track?.agentRef])
  const sessionCustody = useSessionCustody(transport, custodyAt)
  const custodyHoldPorts = useMemo((): CustodyPorts => (sessionCustody.hold ? {...custodyPorts, hold: sessionCustody.hold} : custodyPorts),
    [custodyPorts, sessionCustody.hold])
  const custodyRead = sessionCustody.read ?? undefined
  const custodyDesignBinding = useMemo(() => custodyBinding({sessionRef, agent: agentDesignBinding?.values ?? {}, holds, grants, person: currentPerson,
    custody: custodyRead}, scopeDesignBinding, custodyHoldPorts), [sessionRef, agentDesignBinding, scopeDesignBinding, holds, grants, currentPerson, custodyRead, custodyHoldPorts])
  // The Identity page reads your roster as the World Model's roster slice holds it (agentChainDevices.ts identityFromModel; O-I ticket 1005).
  const rosterSlice = useModelSlice(transport, 'roster')
  const identityHolds = useIdentityHolds()
  const identityAgent = track?.agentRef ?? null
  const identityDesignBinding = useMemo(() => identityFromModel(FACTORY_IDENTITY_ID, rosterSlice, identityAgent),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the holds' version re-binds the Identity page's choices
    [rosterSlice, identityAgent, identityHolds])
  // The Context page's Git row: the session's own repository, and Diff to Files' Diff page (§19.4 Context; §23.2).
  const oneAgent = useMemo(() => (agentDesignBinding ? withAgentGit(composeAgentBinding(agentDesignBinding, {custody: custodyDesignBinding, identity: identityDesignBinding, thread: threadDesignBinding}),
    {...sessionGit, openDiff: openSeatDiff}) : null),
    [agentDesignBinding, custodyDesignBinding, identityDesignBinding, threadDesignBinding, sessionGit])
  // The line where you type @ (§18.4): an @ word in the Agent's composer opens Search in a pane on it (central/searchPane.tsx).
  useAtSearch(typeof oneAgent?.values.draft === 'string' ? oneAgent.values.draft : undefined)
  // Git / landing's Seat group: the seat instrument, starting at the selected workcell's seat of the project.
  const seatsUnread = seats.status === 'refused' && seats.error ? seats.error : undefined
  // Join and Release (lane W3): the seat instrument's Actions through the kernel's act, attributed to the desk's actor — the person's ref when
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
  // Each set the rack holds as a chain reads its own Join from the Central set its space is tied to (§19.15 Join, the agent rack's round 21).
  const nestedSetRefs = useMemo(() => (macroSpaces ?? []).filter(space => space !== groupTrack?.spaceRef).flatMap(space => {
    const ref = tracks?.find(track => track.group && track.sessionRef === space)?.agentSet?.ref
    return ref ? [ref] : []
  }), [macroSpaces, tracks, groupTrack])
  const nestedSets = useAgentSetReadings(transport, nestedSetRefs)
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
      // Launch, Stop after and Retry on the chain's task row (§19.15; O-I 842 round 23, round 870): the chosen chain's session's own acts in
      // Factory's Set, run as the Session grid runs them (factoryTaskActs.ts sessionSetAct, by `act`): the first task written on the session
      // that has not run (its clip's launch, factory.task.run), its track's Stop (factory.task.stop: paused, pressed again its attempt
      // cancelled) and its track's retry (factory.attempt.retry, lit where its task stalled). Factory's answer comes back in its words.
      launch: async ({agent_session}) => ({status: 'launched', said: await sessionSetAct(transport, agent_session, 'launch')}),
      stopAfter: ({agent_session}) => sessionSetAct(transport, agent_session, 'stopTrack'),
      retry: ({agent_session}) => sessionSetAct(transport, agent_session, 'retry'),
      // A device of another session's chain (DLW build ruling 2026-11-05): the words are that session's next turn, through the one send
      // (desktop/cradle encounter/session.ts encounterSessionOf … submit, O-I ticket 1003), the session every presenter of it shares. The
      // session module instruments the walk harness where it loads, so it loads when a device asks, as the encounter observer's does.
      // REPLACED (O-I ticket 1006): a message to its agent's Position (AIKit's gateway send), then delegated onto its task (`aikit gateway
      // delegate`), a second send beside the conversation's. Messages is the rail's, never the chain's to reach.
      ask: async ({project, agent_session, words}) => {
        const {encounterSessionOf} = await import('../../../../../../desktop/cradle/src/encounter/session')
        return encounterSessionOf(transport, {project, ref: agent_session}).submit(words)
      },
    } : {}),
  }), [transport, oneAgent, shell.setSolo, macrosWhere, refreshMacros])
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
    nowUnixMs: sessions?.nowUnixMs ?? 0, ...(setRef ? {set: groupSet} : {}), nestedSets, ...(helperStands && helperDevice ? {helper: helperDesignBinding.values} : {}),
    soloed: shell.soloed, chainModels, chainModelReadings, rackMacros: rackMacros.readings}, agentsetPorts),
  [groupTrack, loneTrack, oneAgent, tracks, models, holds, sessions?.nowUnixMs, setRef, groupSet, helperStands, helperDevice, helperDesignBinding, agentsetPorts, shell.soloed, chainModels,
    chainModelReadings, rackMacros.readings, nestedSets])
  // How far each plate of a session's chain reaches (factoryPlaces.ts reachOf): the rack's chains, and the lone session's own inside it.
  const rackChains = useMemo(() => rackChainsOf(agentsetDesignBinding.values.members), [agentsetDesignBinding.values.members])
  const reachHere = (slot: FactorySlot): Reach => (place.kind === 'session' ? reachOf(slot, rackChains, loneTrack?.sessionRef) : ON_ITS_TRACK)

  // The Main track's Approvals (§19.14 "one place to answer what waits for you"): the rail claims its tile in every mode, so the rail's
  // publisher composes and publishes it in every mode (AgentRailDevices.tsx: the shown session's consent requests, every project's returned
  // work, the unit decisions, AIKit's revisions and the owners' requests), and the Main track draws that same entry from the door. Where the
  // rail's publisher has not loaded yet (the rail not yet shown), the plate stands with why rather than a second reading of the same owners.
  const receipts = useMemo(() => receiptDevices(), [])
  const designsReceipts = {approvals: useDesign(APPROVALS_DESIGN, true)}
  const approvalsEntry = useSyncExternalStore(subscribeDeviceDoor, () => publishedDevice(APPROVALS_ID) ?? null, () => null)
  const approvalsDesignBinding = useMemo(() => approvalsEntry?.binding ?? approvalsAwayBinding(holds), [approvalsEntry, holds])
  const shownTrack = shown ? tracks?.find(item => item.sessionRef === shown && !item.group) ?? null : null
  const shownTakesAll = useAttemptTakes(transport, shownTrack ? [shownTrack.sessionRef] : [], shownTrack?.project ?? ROOT_REGISTER)
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
      transport.kind !== 'unavailable' ? {retry: input => kernelAct(transport, 'factory.attempt.retry', input)} : {},
      {status: mapChain.status, value, error: mapChain.error})
  }, [holds, mapTake, mapChain, transport])
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
  useEffect(() => {
    for (const placement of ['rack', 'chain'] as const) {
      const device = sourcesDevs[placement]
      publishDevice(SOURCES_DEVICE_IDS[placement], sourcesAt[placement] && device ? {device, binding: sourcesBindings[placement]} : null)
    }
  }, [sourcesDevs, sourcesAt, sourcesBindings])
  useEffect(() => { publishDevice(PROMPT_PADS_ID, padsDev ? {device: padsDev, binding: mainBindings.pads, acts: padsActs} : null) }, [padsDev, mainBindings, padsActs])
  useEffect(() => {
    const own = [[AGENTSET_ID, ownDevices.agentset, agentsetDesignBinding], [DECISION_HELPER_ID, helperStands ? helperDevice : null, helperDesignBinding],
      [CARRIER_ID, cells.carrier, carrierDesignBinding]] as const
    for (const [id, device, designBinding] of own) publishDevice(id, device ? {device, binding: designBinding} : null)
  }, [ownDevices, cells, agentsetDesignBinding, helperStands, helperDevice, helperDesignBinding, carrierDesignBinding])
  useEffect(() => () => {
    // The chain withdraws exactly what it publishes. The Thread and Custody (the Agent carries them, §19.4), Tasks and Runs (a task is a
    // clip, a run its track's take lanes, §19.1), the Run, the Experiment (a task launched with Repeat, §19.5) and the Seat (Git / landing's
    // Seat page, §19.17) publish nowhere, and the door is the session's memory, so no entry of theirs can stand to be cleared (ticket 804).
    // The Link is the transport's (§19.19), and the rail's agent devices — Messages, Frames, the Ledger, Approvals, Workcell's instrument —
    // are the rail's publisher's (AgentRailDevices.tsx RAIL_AGENT_DEVICE_IDS): none of them is withdrawn here.
    for (const id of [...CHAIN_DEVICE_IDS, MEMBER_DEVICE_ID, AGENTSET_ID, DECISION_HELPER_ID, CARRIER_ID, RUN_MAP_ID, PROMPT_PADS_ID]) publishDevice(id, null)
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
  // then reads the new session's task record. The agent drop dispatches AIKit's `aikit.gateway.agent` (new) on the gateway binding and
  // folds the owner's outcome document as the receipt. That Action takes a binding and an operation and no agent ref
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
    // A SkillSet dropped on the chain (ticket 743; DLW build ruling 2026-11-12), through the profile Central keeps for the agent, at its
    // revision as read. Inside the agent's own chain (§19.7: "inside one agent's chain, by that agent alone"): on the Skillset rack that
    // carries one it is the rack's Hot-swap (§16.4: agent-profile.chain-replace puts it where that one stood); on its Sources, its Agent, or
    // a rack that carries none, agent-profile.chain-admit adds it after those the agent carries. Ahead of the Agent rack it would be every
    // agent's, which no owner keeps: refused in words (skillSetDropRequest).
    if (decision.operation.kind === 'admit-skillset') {
      const card = target.kind === 'card' ? target.id : null
      const drop = skillSetDropRequest(chainProfile, active.drag.ref, card === 'skillset' ? 'rack' : sourcesPlacementOf(card) === 'chain' ? 'chain' : 'ahead')
      const what = drop.act === 'swap' ? 'Hot-swap' : 'Admit'
      const refuse = (line: string) => setNote({kind: 'refused', title: `${what} refused`, line, receipt: encodeChainDrag(active.drag)})
      const asked = drop.asked
      if ('refused' in asked) { refuse(asked.refused); return }
      if (!profileAct) { refuse(PROFILE_REFUSE.noCarrier(what)); return }
      try {
        await profileAct(asked.action, asked.input)
        setNote(drop.act === 'swap'
          ? {kind: 'receipt', title: 'Hot-swapped', line: `«${active.drag.label}» stands where ${String(asked.input.replace)} stood on the agent's chain (Central's agent-profile.chain-replace).`, receipt: null}
          : {kind: 'receipt', title: 'Admitted', line: `«${active.drag.label}» onto ${target.label} — the agent carries it now, after the SkillSets it carried (Central's agent-profile.chain-admit).`, receipt: null})
      } catch (cause) { refuse(refusalWords(cause instanceof Error ? cause.message : String(cause))) }
      return
    }
    // A seat dropped on the chain (§19.16 The seat; ticket 743): the Seat's own Join, on the seat and the project Git / landing names, as
    // its button asks it — the seat instrument's `seat join` (the Action workcell.seat.join), attributed to the desk's actor. The Seat
    // says in its own words why it joins nothing (no carrier, the seats unread, no seat chosen).
    if (decision.operation.kind === 'join-seat') {
      const refuse = (line: string) => setNote({kind: 'refused', title: 'Join refused', line, receipt: encodeChainDrag(active.drag)})
      const other = seatDropRefusal(active.drag.ref, machineRef)
      if (other) { refuse(other); return }
      try {
        await seatDesignBinding.write!([{key: 'join', value: Date.now()}])
        setNote({kind: 'receipt', title: 'Seat joined', line: `«${active.drag.label}» onto ${target.label} — ${String(seatDesignBinding.values.seat)}'s ${String(seatDesignBinding.values.product)} seat is joined as ${deskActor} (\`seat join\`); the claim is read back on the next seat reading.`, receipt: null})
      } catch (cause) { refuse(refusalWords(cause instanceof Error ? cause.message : String(cause))) }
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
    // Sources stands before the Agent (§19.9): dropped among the rack's chain it is that agent's own reading, anywhere else on the
    // session's chain it is the shared reading ahead of the Agent rack. AIKit's encounter-session-settings places it on the session
    // (DLW build ruling 2026-11-05); its settings then ride the placement, and AIKit's knowledge navigation reads under them.
    if (decision.operation.kind === 'place-sources') {
      const placement = sourcesPlacementOf(target.kind === 'card' ? target.id : null)
      const where = placement === 'chain' ? 'the agent\'s own Sources, inside its chain' : 'the shared reading ahead of the Agent rack'
      const refuse = (line: string) => setNote({kind: 'refused', title: 'Sources refused', line, receipt: encodeChainDrag(active.drag)})
      const group = place.kind === 'session' && place.group
      if (place.kind !== 'session' || group || sessionRef == null) {
        refuse(group
          ? 'Sources stands on one session: each session of a group keeps its own; choose one of its sessions — ahead of its Agent rack, it is the shared reading every session of its space reads.'
          : 'Sources stands on a session\'s chain, before its Agent; this chain is no session\'s.')
        return
      }
      try {
        await writeSessionSettings(transport, track?.project ?? ROOT_REGISTER, sessionRef, sourcesPlaceRequest(placement))
        setNote({kind: 'receipt', title: 'Sources placed', line: `«${active.drag.label}» onto ${target.label} — ${where} (AIKit's encounter-session-settings).`, receipt: null})
      } catch (cause) { refuse(refusalWords(cause instanceof Error ? cause.message : String(cause))) }
      return
    }
    const outcome = await harnessAgentControl(transport, binding, decision.operation.control)
    const dragged = `«${active.drag.label}» (${active.drag.ref})`
    setNote(outcome.ok
      ? {
          kind: 'receipt',
          title: 'New agent started',
          line: `${dragged} onto ${target.label} — started a new agent on the harness bound as “${binding}”; the harness was not told which agent was dragged, because aikit.gateway.agent carries no agent ref. ${outcome.note}`,
          receipt: outcome.document !== undefined ? safeJson(outcome.document) : null,
        }
      : {
          kind: 'refused',
          title: 'New agent refused',
          line: `${dragged} onto ${target.label} — aikit.gateway.agent (${decision.operation.control}: a new agent on the bound harness, not the dragged one) answered: ${outcome.error}`,
          receipt: outcome.error,
        })
  }, [shell, transport, binding, chainProfile, profileAct, place, sessionRef, track?.project, machineRef, seatDesignBinding, deskActor])

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
    const target: ChainDropTarget = card ? {kind: 'card', id: card.id, label: `«${card.title}»`}
      : slotId === 'chain-sources' ? {kind: 'card', id: slotId, label: '«Sources»'} : {kind: 'zone', label: 'the drop zone'}
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
    at: {readonly member?: boolean; readonly attrs?: Readonly<Record<string, string>>; readonly plate?: HTMLAttributes<HTMLDivElement>} = {}) => device && (
    <div className={at.member ? 'factory-slot__member' : 'factory-slot'} data-device={id} data-design={design} {...at.attrs} {...at.plate}
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

  /** Sources where AIKit places it (§19.9): ahead of the Agent rack, the shared reading that reaches every chain of it; inside the agent's
   * chain, before what it carries, that agent's own. Its face takes a dropped source itself (pin, sourcesPorts). It comes off as a device
   * comes off its chain: ⌫ on its plate, or dragged off the chain (unplaceSources). */
  const sourcesPlate = (placement: SourcesPlacementName) => {
    if (!sourcesAt[placement]) return null
    const slot = placement === 'rack' ? 'sources' : 'chain-sources', reach = reachHere(slot)
    return placed(SOURCES_DEVICE_IDS[placement], sourcesDevs[placement], sourcesBindings[placement], sourcesDesign ? SOURCES_DESIGN : undefined, 'Sources', {
      attrs: {...(placement === 'rack' ? {'data-session-slot': 'sources'} : {'data-slot': 'chain-sources'}), 'data-reaches': reach.reaches,
        'data-i': agentDataI('Sources', `${reach.says} ⌫ or a drag off the chain takes it off; its settings stay for when it is placed again.`), 'aria-keyshortcuts': 'Delete'},
      plate: {
        tabIndex: 0, draggable: true,
        onKeyDown: event => {
          const target = event.target as HTMLElement
          if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey || target.isContentEditable
            || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
          if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); void unplaceSources(placement) }
        },
        // A press on one of its controls works the control; the plate is dragged from its head or its frame.
        onPointerDownCapture: event => { sourcesGrip.current = !(event.target as Element).closest('.dp-cell, button, input, select, textarea, [role="slider"]') },
        onDragStart: event => {
          if (!sourcesGrip.current) { event.preventDefault(); return }
          event.dataTransfer.setData(SOURCES_OFF_DRAG, placement)
          event.dataTransfer.setData('text/plain', 'Sources')
          event.dataTransfer.effectAllowed = 'move'
        },
        // Dropped on its own plate it stays where it is; its face takes no drop of itself.
        onDragOverCapture: event => { if (event.dataTransfer.types.includes(SOURCES_OFF_DRAG)) event.stopPropagation() },
        onDropCapture: event => { if (event.dataTransfer.types.includes(SOURCES_OFF_DRAG)) { event.preventDefault(); event.stopPropagation() } },
      }})
  }

  /** The Agent rack (§19.15, §16.4): its head — title bar, macros, chain list — then, under its Devices mark, the devices of the chain it
   * holds on a lone session, the session's own agent (RACK_CHAIN: the Skillset rack with its member, the Agent), then its end bracket. A
   * group's chains are its sessions, each drawn in the rack's own list. */
  const rackPlate = () => {
    const reach = reachHere('agentset')
    const head = placed(AGENTSET_ID, ownDevices.agentset, agentsetDesignBinding, designsOwn.agentset ? AGENTSET_DESIGN : undefined, 'the Agent rack',
      {attrs: {'data-session-slot': 'agentset', 'data-reaches': reach.reaches, 'data-i': agentDataI('Agent rack', reach.says)}})
    if (!head) return null
    const own = loneTrack && rackDevicesShown ? RACK_CHAIN.map(slot => (slot === 'chain-sources' ? sourcesPlate('chain') : slotPlate(slot))) : []
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
      // Sources ahead of the rack (§19.9): the shared reading every agent of it reads.
      case 'sources': return sourcesPlate('rack')
      // The Main track (§16.2, §19.1): the Run map, then Approvals, where every proposal waits (§19.14), then the Prompt pads.
      case 'approvals': return placed(APPROVALS_ID, approvalsEntry?.device ?? receipts.approvals, approvalsDesignBinding, designsReceipts.approvals ? APPROVALS_DESIGN : undefined, 'Approvals', {attrs: {'data-main-slot': 'approvals'}})
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
