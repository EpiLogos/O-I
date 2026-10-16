// Factory's Device side: the session's chain — gateway → agent → skills → scope → landing — as devices of the runtime (manual §6,
// §10.4; ticket T-DEVICES-FACTORY). Each is a DeviceView at its compact size (a picture and at most four controls); each is
// published to the door, so the pool shows the chosen one whole and a pane shows it full — the same live settings in all three,
// a change in any one the same change through the owner's write path. The skills rack is a rack: its chains with their admit
// lamps and its selector; its four settings stand as readings until ai-kit declares the mapping that would make them macros.
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
// Lane BF2: the Thread (software-factory:thread, §17.10) stands beside the Agent inside its slot and is the Agent's Full (§19.3), on
// the session's own conversation (threadBinding.ts, the thread pane's encounter observer: EncounterObservers.tsx); the Gateway's Full
// is the Frames monitor (§19.1 "The full Gateway is the frame monitor"; mainTrackBindings.ts). With no session selected the Device
// side is Factory's Main track (§16.2; Live shows the Master's chain when no other track is chosen): the Gateways rack (§19.2) with
// the Agency gateway as its chain (§19.9), and the Experiment (§19.4) — until the session grid's Main row is a track you select.
// Every device is published whichever chain is drawn, so the pool, a pane and the rail keep them.
//
// Lane BF3: the rest of Factory's and Workcell's devices stand where the manual puts them, each on its owners: Custody beside the
// Thread in the Agent's slot (§19.13 "on the Agent device"); the Seat inside Git / landing (§19.20), which now draws its own design
// (§19.19); the Run after the landing, the session's lane (§19.17 "on the session's chain"); a group's chain leads with the Agentset rack
// (§19.18); on the Main track the Remote carrier is the Gateways rack's fourth chain (§19.21), and the Ledger, Approvals (§19.15,
// §19.16; their rail widgets §23.9, §23.10, AgentDockTileBody.tsx) and the Link (§19.22) follow the Experiment. The bindings:
// sessionChainBindings.ts, receiptBindings.ts, workcellBindings.ts.
import {Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent} from 'react'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import type {DesignBinding} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {useDesign} from '../../frame/devices/designs'
import {openInstrument} from '../../frame/instrumentDoor'
import {agentAddress} from '../../inhabitants/agentParamAddresses'
import {useRosterAnswer} from '../../owners/readers'
import {useAgentSessionsOptional} from '../AgentSessionsProvider'
import {useAgentShell, type AgentDeviceId} from '../AgentShellContext'
import {threadTrackOf} from '../threadTrack'
import {trackKey} from '../agentRunModel'
import {useOptionalContinuity} from '../../continuity/workspace'
import {parseFactoryTaskRef} from '../../timeline/factoryTrackAdapter'
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
  memberChains, rackBinding, scopeBinding, seatedProfile, useChainHolds, type AgentRows,
} from './designBindings'
import {useOwnerAccepted} from './ownerAccepted'
import {useSelectedSkillChain} from './skillRackSelection'
import {useAgentChainReading} from './useAgentChainReading'
import {RACK_PROJECT, composePorts, useRackReading} from './useRackReading'
import {observedState, useEncounterSessions} from './EncounterObservers'
import {
  AGENCY_GATEWAY_DESIGN, AGENCY_GATEWAY_ID, EXPERIMENT_DESIGN, EXPERIMENT_ID, FRAMES_DESIGN, FRAMES_ID, GATEWAYS_RACK_DESIGN, GATEWAYS_RACK_ID, MAIN_DEVICE_IDS,
  agencyBinding, experimentBinding, framesBinding, mainDevices, rackBinding as gatewaysRackBinding,
} from './mainTrackBindings'
import {THREAD_DESIGN, THREAD_DEVICE_ID, shownSession, threadBinding, threadDevice, threadJson} from './threadBinding'
import {useModelCatalogue} from './useModelCatalogue'
import {RUNS_ID, TASKS_ID, runsBinding, runsDevice, tasksBinding, tasksDevice} from './taskBindings'
import {useCentralGroundAnswer} from '../../central/devices/useCentralReadings'
import {useWorkcellAnswer} from '../../owners/readers'
import {
  AGENTSET_DESIGN, AGENTSET_ID, CUSTODY_DESIGN, CUSTODY_ID, RUN_DESIGN, RUN_ID, SESSION_DEVICE_IDS, agentsetBinding, custodyBinding, runBinding, sessionDevices,
} from './sessionChainBindings'
import {APPROVALS_DESIGN, APPROVALS_ID, LEDGER_DESIGN, LEDGER_ID, RECEIPT_DEVICE_IDS, approvalsBinding, ledgerBinding, receiptDevices} from './receiptBindings'
import {
  CARRIER_DESIGN, CARRIER_ID, LINK_DESIGN, LINK_ID, SEAT_DESIGN, SEAT_ID, WORKCELL_DEVICE_IDS, carrierBinding, carrierChainState, gitBinding, linkBinding, seatBinding,
  workcellDevices,
} from './workcellBindings'
import {usePopulationAnswer} from './usePopulationAnswer'
import '../agentShell.css'
import './factoryDevices.css'

/** The slot hooks, keyed like the mockup oracle (`label|function`); worded as the chain's cards worded them
 * (NativeAgentDeviceRack.tsx:30-43). */
const SLOT_DATA_I: Readonly<Record<string, string>> = {
  gateway: agentDataI('Gateway · hermes', 'Where the session runs: the harness connection (Hermes tui_gateway, JSON-RPC over stdio or WebSocket). Frames flow along the link; the ring is the replay buffer; the outer pulse is the heartbeat.'),
  agent: agentDataI('Agent · agent', 'Compact. Click: expand in the pool. Thread ↗: open its thread full.'),
  skillset: agentDataI('Skillset rack', 'Skills as chains (light = admitted); macros steer several at once.'),
  world: agentDataI('World · bridge', 'What the session may read (teal) and write (amber).'),
  git: agentDataI('Git', 'The session’s repository seat. The diagram is the branch against main; the pulsing hollow dot is uncommitted work.'),
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

/** The slots whose designs this chain binds, with the design each draws. */
const SLOT_DESIGNS: Readonly<Record<string, string>> = {gateway: GATEWAY_DESIGN, agent: AGENT_DESIGN, skillset: RACK_DESIGN, world: SCOPE_DESIGN, git: LANDING_DESIGN}

export function FactoryDeviceChain({sessionRef}: {sessionRef: string | null}) {
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
  const agentDesignBinding = useMemo(() => (waits.agent ? null : agentBinding(chainDeviceId('agent'), {
    sessionRef, track, nowUnixMs: sessions?.nowUnixMs ?? 0, reading, accepted, harness: {binding, resolved}, holds, thread: agentThread, models, harnesses,
  }, agentRows, write, () => steering.current)), [waits.agent, sessionRef, track, sessions?.nowUnixMs, reading, accepted, binding, resolved, holds, agentRows, write, agentThread, models, harnesses])

  // The Thread: the shown session's conversation; its composer, Input and timing the Agent's; Approve and Hard stop that session's
  // own encounter verbs; choosing a session moves THE selection.
  const threadDesign = useDesign(THREAD_DESIGN, true)
  const thread = useMemo(() => threadDevice(), [])
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

  // Tasks (§19.12): the selected session's clips and the task THE selection names; a new task goes the Agent's way (its new-task
  // row). Runs (§19.11): the session's work's attempts — none read, the agency reading names no run. Both published on the door
  // (the pool, a pane, the rail); their own places — the Clip side, the browser's Runs — are other lanes' (proposed).
  const continuity = useOptionalContinuity()
  const selection = continuity?.current.context?.selection
  const sessionTrack = track && !track.group ? track : null
  const selectedTask = useMemo(() => {
    // A clip of this session's track names the task (its ref is `<track>#task/<n>`, and its track is this session's own).
    const named = selection?.kind === 'clip' ? parseFactoryTaskRef(selection.ref) : null
    return named && sessionTrack && named.trackId === trackKey(sessionTrack) ? named.n : null
  }, [selection, sessionTrack])
  const tasks = useMemo(() => tasksDevice(), [])
  const runs = useMemo(() => runsDevice(), [])
  const tasksDesignBinding = useMemo(() => tasksBinding({session: sessionTrack, tracks, nowUnixMs: sessions?.nowUnixMs ?? 0, selectedTask, agent: agentDesignBinding?.values ?? {}},
    agentDesignBinding, {
      selectTask: n => {
        if (!sessionTrack || !continuity) return
        const title = sessionTrack.tasks.find(clip => clip.n === n)?.title ?? `Task ${n}`
        continuity.select({mode: 'factory', kind: 'clip', ref: `${trackKey(sessionTrack)}#task/${n}`, title, track: trackKey(sessionTrack)})
      },
      queue: async text => { const receipt = await write(AGENT_P0_ROWS.newTask, text); if (receipt.kind === 'refused') throw Error(receipt.reason) },
    }), [sessionTrack, tracks, sessions?.nowUnixMs, selectedTask, agentDesignBinding, continuity, write])
  const runsDesignBinding = useMemo(() => runsBinding(sessionTrack?.sessionRef ?? null, holds), [sessionTrack, holds])

  // Factory's Main track: the Gateways rack with the Agency gateway as its chain, and the Experiment; the Frames monitor the Gateway
  // opens full and the rail keeps (§23.8).
  const main = useMemo(() => mainDevices(), [])
  const designsOf = {rack: useDesign(GATEWAYS_RACK_DESIGN, true), agency: useDesign(AGENCY_GATEWAY_DESIGN, true), experiment: useDesign(EXPERIMENT_DESIGN, true),
    frames: useDesign(FRAMES_DESIGN, true), thread: threadDesign}
  const showChain = useCallback((chain: string) => {
    const shownDevice = chain === 'hermes' ? chainDeviceId('gateway') : chain === 'aikit-agency-gateway' ? AGENCY_GATEWAY_ID : chain === 'remote-carrier' ? CARRIER_ID : null
    if (shownDevice) selectDevice(shownDevice)
  }, [])
  // Workcell's status, the window's one answer (owners/readers.ts): the Remote carrier's machines, its chain in the rack, the Link's here.
  const workcell = useWorkcellAnswer(transport).reading
  const carrier = useMemo(() => carrierChainState(workcell), [workcell])
  const mainBindings = useMemo(() => ({
    rack: gatewaysRackBinding({reading, holds, carrier}, {show: showChain}),
    agency: agencyBinding(reading, holds),
    experiment: experimentBinding(holds),
    frames: framesBinding({reading, harness: {binding, resolved}}, holds),
  }), [reading, holds, carrier, showChain, binding, resolved])

  // The rack: the seated agent's carried practice (its accepted profile in the roster, the sets AIKit replies for), and the
  // composition through the configuration plane. Read only while its design can draw it.
  const roster = useRosterAnswer(transport, null).reading
  const profile = useMemo(() => seatedProfile(roster.status === 'answered' ? roster.value : null, track?.agentRef ?? null), [roster, track?.agentRef])
  const [planeEpoch, setPlaneEpoch] = useState(0)
  const rackOn = !waits.skillset
  const rackReading = useRackReading(transport, profile, holds.compose.scope, sessionRef, rackOn, planeEpoch)
  const ports = useMemo(() => composePorts(transport, () => setPlaneEpoch(epoch => epoch + 1)), [transport])
  const rackDesignBinding = useMemo(() => (rackOn ? rackBinding(chainDeviceId('skillset'), {profile, ...rackReading, holds}, ports, {project: RACK_PROJECT, sessionRef}) : null),
    [rackOn, profile, rackReading, holds, ports, sessionRef])
  // The member: the rack's chosen chain, one device inside the rack (§19.7).
  const memberOn = rackOn && !waits.member
  const chosen = useSelectedSkillChain(rackDesignBinding ? memberChains(rackDesignBinding.values) : null)
  const memberDevice = useMemo(() => (memberOn ? rackMemberDevice(MEMBER_DEVICE_ID) : null), [memberOn])
  const memberDesignBinding = useMemo(() => (memberDevice && rackDesignBinding ? memberBinding(MEMBER_DEVICE_ID, rackDesignBinding.values, chosen, holds) : null),
    [memberDevice, rackDesignBinding, chosen, holds])
  // Scope: the world row's write path for the write mode; a raised reach held until Confirm.
  const writeModeRow = chain.find(entry => entry.slot.id === 'world')?.device.rows.find(row => row.key === 'write-mode')
  const scopeDesignBinding = useMemo(() => (waits.world ? null : scopeBinding(chainDeviceId('world'), holds, writeModeRow, write)), [waits.world, holds, writeModeRow, write])
  // Git / landing: the chain's git reading (its light, the checkout's branch, the files with no commit); every act stands disabled.
  const gitDesignBinding = useMemo(() => (waits.git ? null : gitBinding(reading, holds)), [waits.git, reading, holds])
  const bindings: Readonly<Record<string, DesignBinding | null>> = useMemo(() => ({
    gateway: gatewayDesignBinding, agent: agentDesignBinding, skillset: rackDesignBinding, world: scopeDesignBinding, git: gitDesignBinding,
  }), [gatewayDesignBinding, agentDesignBinding, rackDesignBinding, scopeDesignBinding, gitDesignBinding])

  // The session's own devices (lane BF3): the Run on its lane, Custody on the Agent, and — for a group — the Agentset rack.
  const ownDevices = useMemo(() => sessionDevices(), [])
  const designsOwn = {run: useDesign(RUN_DESIGN, true), custody: useDesign(CUSTODY_DESIGN, true), agentset: useDesign(AGENTSET_DESIGN, true)}
  const groupTrack = track && track.group ? track : null
  const selectSession = useCallback((ref: string) => {
    const chosen = tracks?.find(item => item.sessionRef === ref && !item.group)
    if (chosen) shell.setSelectedTrackId(trackKey(chosen))
    return chosen ? null : 'This agent session is not among Factory\'s sessions here.'
  }, [tracks, shell])
  const runDesignBinding = useMemo(() => runBinding({session: sessionTrack, tracks, nowUnixMs: sessions?.nowUnixMs ?? 0, agent: agentDesignBinding?.values ?? {}, holds},
    {select: ref => { selectSession(ref) }}), [sessionTrack, tracks, sessions?.nowUnixMs, agentDesignBinding, holds, selectSession])
  const custodyDesignBinding = useMemo(() => custodyBinding({sessionRef, autonomy: reading.autonomy, agent: agentDesignBinding?.values ?? {}}, scopeDesignBinding),
    [sessionRef, reading.autonomy, agentDesignBinding, scopeDesignBinding])
  const agentsetDesignBinding = useMemo(() => agentsetBinding({group: groupTrack, tracks, models, holds}), [groupTrack, tracks, models, holds])

  // The Main track's readers: the Ledger on Central's change horizon (the root ground the window holds once), Approvals on the
  // Gateway's own approvals key and the shown session's consent requests.
  const ground = useCentralGroundAnswer(transport)
  const receipts = useMemo(() => receiptDevices(), [])
  const designsReceipts = {ledger: useDesign(LEDGER_DESIGN, true), approvals: useDesign(APPROVALS_DESIGN, true)}
  const ledgerDesignBinding = useMemo(() => ledgerBinding({ground: ground.reading, groundError: ground.error, holds}, {openSession: selectSession}),
    [ground.reading, ground.error, holds, selectSession])
  const shownTrack = shown ? tracks?.find(item => item.sessionRef === shown && !item.group) ?? null : null
  const approvalsDesignBinding = useMemo(() => {
    const state = observedState(shownHandle)
    const actions = shownHandle && 'actions' in shownHandle ? shownHandle.actions : undefined
    return approvalsBinding({gateway: gatewayDesignBinding?.values ?? {}, session: shownTrack, encounter: state?.reading ?? null, holds}, gatewayDesignBinding,
      actions ? {permission: (id, decision) => actions.permission(id, decision)} : {})
  }, [shownHandle, gatewayDesignBinding, shownTrack, holds])

  // Workcell's devices: the Seat inside Git / landing (the seat instrument, which no kernel op reads), the Remote carrier in the Gateways
  // rack (Workcell's status) and the Link on the Main track (Workcell's status and AIKit's population, `gateway who`).
  const population = usePopulationAnswer(transport, RACK_PROJECT)
  const cells = useMemo(() => workcellDevices(), [])
  const designsCells = {seat: useDesign(SEAT_DESIGN, true), carrier: useDesign(CARRIER_DESIGN, true), link: useDesign(LINK_DESIGN, true)}
  const seatDesignBinding = useMemo(() => seatBinding({status: null, project: RACK_PROJECT, branch: reading.gitRepo.branch ?? null, holds}), [reading.gitRepo.branch, holds])
  const carrierDesignBinding = useMemo(() => carrierBinding(workcell, holds), [workcell, holds])
  const linkDesignBinding = useMemo(() => linkBinding(workcell, holds, population), [workcell, holds, population])

  // Publish each device to the door: the pool shows the chosen one whole, a pane shows it full, from these same devices — a
  // designed device with its binding, so every place draws the design on the same owner values.
  // The Agent's own Full is its session's thread (§19.3): every ⤢ — the chain's, the pool's, the rail's — opens it, never the design's Full.
  // The Gateway's own Full is the Frames monitor (§19.1): its ⤢ opens the monitor's pane.
  const threadOpener = useRef<() => void>(() => {})
  useEffect(() => {
    for (const {slot, device} of chain) publishDevice(device.id, {device, picture: size => chainPicture(slot.id, pictures, size), ...(bindings[slot.id] ? {binding: bindings[slot.id]!} : {}), ...(slot.id === 'agent' ? {full: {open: () => threadOpener.current()}} : {}),
      ...(slot.id === 'gateway' && main.frames ? {full: {open: () => openDevice(FRAMES_ID, 'Frames')}} : {})})
    if (memberDevice && memberDesignBinding) publishDevice(memberDevice.id, {device: memberDevice, binding: memberDesignBinding})
    else publishDevice(MEMBER_DEVICE_ID, null)
  }, [chain, bindings, memberDevice, memberDesignBinding, main.frames]) // the pictures read the reading `chain` is built from
  useEffect(() => { publishDevice(THREAD_DEVICE_ID, thread ? {device: thread, binding: threadDesignBinding} : null) }, [thread, threadDesignBinding])
  useEffect(() => { publishDevice(TASKS_ID, tasks ? {device: tasks, binding: tasksDesignBinding} : null) }, [tasks, tasksDesignBinding])
  useEffect(() => { publishDevice(RUNS_ID, runs ? {device: runs, binding: runsDesignBinding} : null) }, [runs, runsDesignBinding])
  useEffect(() => {
    if (main.rack) publishDevice(GATEWAYS_RACK_ID, {device: main.rack, binding: mainBindings.rack})
    if (main.agency) publishDevice(AGENCY_GATEWAY_ID, {device: main.agency, binding: mainBindings.agency})
    if (main.experiment) publishDevice(EXPERIMENT_ID, {device: main.experiment, binding: mainBindings.experiment})
    if (main.frames) publishDevice(FRAMES_ID, {device: main.frames, binding: mainBindings.frames})
  }, [main, mainBindings])
  useEffect(() => {
    const own = [[RUN_ID, ownDevices.run, runDesignBinding], [CUSTODY_ID, ownDevices.custody, custodyDesignBinding], [AGENTSET_ID, ownDevices.agentset, agentsetDesignBinding],
      [LEDGER_ID, receipts.ledger, ledgerDesignBinding], [APPROVALS_ID, receipts.approvals, approvalsDesignBinding],
      [SEAT_ID, cells.seat, seatDesignBinding], [CARRIER_ID, cells.carrier, carrierDesignBinding], [LINK_ID, cells.link, linkDesignBinding]] as const
    for (const [id, device, designBinding] of own) publishDevice(id, device ? {device, binding: designBinding} : null)
  }, [ownDevices, receipts, cells, runDesignBinding, custodyDesignBinding, agentsetDesignBinding, ledgerDesignBinding, approvalsDesignBinding, seatDesignBinding,
    carrierDesignBinding, linkDesignBinding])
  useEffect(() => () => {
    for (const id of [...CHAIN_DEVICE_IDS, MEMBER_DEVICE_ID, THREAD_DEVICE_ID, TASKS_ID, RUNS_ID, ...MAIN_DEVICE_IDS, ...SESSION_DEVICE_IDS, ...RECEIPT_DEVICE_IDS,
      ...WORKCELL_DEVICE_IDS]) publishDevice(id, null)
  }, [])

  const choose = (slotId: string) => { shell.setExpandedDevice(slotId as AgentDeviceId); selectDevice(chainDeviceId(slotId)) }
  const openDevice = (id: string, title: string) => {
    try { openInstrument(DEVICE_PANE_KIND, undefined, {ref: id, title}) }
    catch (cause) { setNote({kind: 'refused', title: 'Open full', line: cause instanceof Error ? cause.message : String(cause), receipt: null}) }
  }
  const openFull = (slotId: string, title: string) => openDevice(chainDeviceId(slotId), title)
  // The Agent's ⤢ opens its thread in a pane (§19.3 Compact: "Click ⤢ to open the thread in a pane"; Full: "The full Agent is the
  // thread") — the Thread device's own Full, on the session's own conversation, never a picture of one. The agent tab's conversation
  // (shell.openThread, the chain picture's Thread ↗) stays where it was.
  const openAgentThread = () => openDevice(THREAD_DEVICE_ID, 'Thread')
  threadOpener.current = openAgentThread

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

  /** One of the devices this lane places (lane BF3), at its compact size: a slot of its own on the chain, or a member inside its host's
   * slot. Its press shows it whole in the pool; ⤢ opens it full in a pane. */
  const placed = (id: string, device: DeviceInstance | null, designBinding: DesignBinding, design: string | undefined, title: string,
    place: {readonly member?: boolean; readonly attrs?: Readonly<Record<string, string>>} = {}) => device && (
    <div className={place.member ? 'factory-slot__member' : 'factory-slot'} data-device={id} data-design={design} {...place.attrs}
      onClick={place.member ? event => event.stopPropagation() : () => selectDevice(id)}>
      <DeviceView device={device} size="compact" binding={designBinding} actions={[
        {icon: 'detail', label: `Show ${title} whole in the pool`, onPress: () => selectDevice(id)},
        {icon: 'pane', label: `Open ${title} full size in a pane`, onPress: () => openDevice(id, title)},
      ]} />
    </div>
  )

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
        className="native-agent-rack" aria-label="Agent device chain" data-region="device-chain"
        ref={rowRef}
        onDragOver={onRowDragOver}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGap(null) }}
        onDrop={onRowDrop}
      >
        {/* Factory's Main track (DLW §16.2, §19.2): with no session selected, the Device side is the Main track's chain — the session
          grid's Main row is not yet a track you can select (proposed to its lane). A selected session shows its own chain. */}
        {sessionRef == null && <div className="factory-main" data-track="main" aria-label="Main track"
          data-i="Main track|Factory's Main track: every gateway the work can reach, the Experiment that compares sessions, the Ledger of what the agents did, the Approvals they wait on, and the Link to your other machines.">
          {main.rack && (
            <div className="factory-slot" data-main-slot="gateways" data-device={GATEWAYS_RACK_ID} data-design={designsOf.rack ? GATEWAYS_RACK_DESIGN : undefined}
              onClick={() => selectDevice(GATEWAYS_RACK_ID)}>
              <DeviceView device={main.rack} size="compact" binding={mainBindings.rack} actions={[
                {icon: 'detail', label: 'Show the Gateways rack whole in the pool', onPress: () => selectDevice(GATEWAYS_RACK_ID)},
                {icon: 'pane', label: 'Open the chosen gateway full size in a pane', onPress: () => openDevice(GATEWAYS_RACK_ID, 'Gateways')},
              ]} />
              {/* The AIKit agency gateway is one chain of the rack (§19.9): its device stands inside the rack's slot. */}
              {main.agency && (
                <div className="factory-slot__member" data-device={AGENCY_GATEWAY_ID} data-design={designsOf.agency ? AGENCY_GATEWAY_DESIGN : undefined} onClick={event => event.stopPropagation()}>
                  <DeviceView device={main.agency} size="compact" binding={mainBindings.agency} actions={[
                    {icon: 'detail', label: 'Show the Agency gateway whole in the pool', onPress: () => selectDevice(AGENCY_GATEWAY_ID)},
                    {icon: 'pane', label: 'Open the Agency gateway full size in a pane', onPress: () => openDevice(AGENCY_GATEWAY_ID, 'Agency gateway')},
                  ]} />
                </div>
              )}
              {/* The Remote carrier is the rack's fourth chain (§19.21): its device stands inside the rack's slot, on Workcell's status. */}
              {placed(CARRIER_ID, cells.carrier, carrierDesignBinding, designsCells.carrier ? CARRIER_DESIGN : undefined, 'the Remote carrier', {member: true})}
            </div>
          )}
          {main.experiment && (
            <div className="factory-slot" data-main-slot="experiment" data-device={EXPERIMENT_ID} data-design={designsOf.experiment ? EXPERIMENT_DESIGN : undefined}
              onClick={() => selectDevice(EXPERIMENT_ID)}>
              <DeviceView device={main.experiment} size="compact" binding={mainBindings.experiment} actions={[
                {icon: 'detail', label: 'Show the Experiment whole in the pool', onPress: () => selectDevice(EXPERIMENT_ID)},
                {icon: 'pane', label: 'Open the Experiment\'s result full size in a pane', onPress: () => openDevice(EXPERIMENT_ID, 'Experiment')},
              ]} />
            </div>
          )}
          {/* What the agents did and what they ask (§19.15, §19.16), and the Link to your other machines (§19.22). */}
          {placed(LEDGER_ID, receipts.ledger, ledgerDesignBinding, designsReceipts.ledger ? LEDGER_DESIGN : undefined, 'the Ledger', {attrs: {'data-main-slot': 'ledger'}})}
          {placed(APPROVALS_ID, receipts.approvals, approvalsDesignBinding, designsReceipts.approvals ? APPROVALS_DESIGN : undefined, 'Approvals', {attrs: {'data-main-slot': 'approvals'}})}
          {placed(LINK_ID, cells.link, linkDesignBinding, designsCells.link ? LINK_DESIGN : undefined, 'the Link', {attrs: {'data-main-slot': 'link'}})}
        </div>}
        {/* A group's chain (§19.18): the Agentset rack leads it, one chain for each of the group's sessions. */}
        {sessionRef != null && groupTrack && placed(AGENTSET_ID, ownDevices.agentset, agentsetDesignBinding, designsOwn.agentset ? AGENTSET_DESIGN : undefined, 'the Agentset rack',
          {attrs: {'data-session-slot': 'agentset'}})}
        {sessionRef != null && chain.map(({slot, device}, index) => (
          <Fragment key={slot.id}>
            {/* The visible drop slot while a card slides — it opens under the pointer and closes on release. It never lies:
              a slot is not a landing, the owner operation (here: the refusal naming the missing order op) is. */}
            {held?.kind === 'reorder' && gap === index && <span className="agent-chain-gap" aria-hidden="true" />}
            <div className="factory-slot" data-slot={slot.id} data-family={slot.family} data-device={slot.id}
              data-selected={shell.expandedDevice === slot.id} data-i={SLOT_DATA_I[slot.id]} onClick={() => choose(slot.id)}
              data-design={SLOT_DESIGNS[slot.id] && bindings[slot.id] ? SLOT_DESIGNS[slot.id] : undefined}
              data-design-waits={SLOT_DESIGNS[slot.id] ? waits[slot.id] ?? undefined : undefined}>
              <div className="factory-slot__rail">{grip(slot.id, slot.title)}</div>
              <DeviceView device={device} size="compact" picture={chainPicture(slot.id, pictures, 'compact')} binding={bindings[slot.id] ?? undefined} actions={[
                {icon: 'detail', label: 'Show every setting in the pool', onPress: () => choose(slot.id)},
                slot.id === 'agent'
                  ? {icon: 'pane', label: 'Open the Agent\'s thread in a pane', onPress: openAgentThread}
                  : slot.id === 'gateway' && main.frames
                    ? {icon: 'pane', label: 'Open the Frames monitor in a pane', onPress: () => openDevice(FRAMES_ID, 'Frames')}
                    : {icon: 'pane', label: `Open ${slot.title} full size in a pane`, onPress: () => openFull(slot.id, slot.title)},
              ]} />
              {/* The Agent's own Full, beside it (§19.3, §17.10): the Thread on the same session. Its press shows it whole in the pool. */}
              {slot.id === 'agent' && thread && (
                <div className="factory-slot__member" data-device={THREAD_DEVICE_ID} data-design={designsOf.thread ? THREAD_DESIGN : undefined} onClick={event => event.stopPropagation()}>
                  <DeviceView device={thread} size="compact" binding={threadDesignBinding} actions={[
                    {icon: 'detail', label: 'Show the Thread whole in the pool', onPress: () => selectDevice(THREAD_DEVICE_ID)},
                    {icon: 'pane', label: 'Open the Thread full size in a pane', onPress: openAgentThread},
                  ]} />
                </div>
              )}
              {/* Custody shares the Agent's slot (§19.13 "on the Agent device; the Agent's face shows it"). */}
              {slot.id === 'agent' && placed(CUSTODY_ID, ownDevices.custody, custodyDesignBinding, designsOwn.custody ? CUSTODY_DESIGN : undefined, 'Custody', {member: true})}
              {/* The Seat stands inside Git / landing (§19.20). */}
              {slot.id === 'git' && placed(SEAT_ID, cells.seat, seatDesignBinding, designsCells.seat ? SEAT_DESIGN : undefined, 'the Seat', {member: true})}
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
          </Fragment>
        ))}
        {sessionRef != null && held?.kind === 'reorder' && gap === chain.length && <span className="agent-chain-gap" aria-hidden="true" />}
        {/* The session's lane along the clock (§19.17 "on the session's chain"): after the landing, the record of its course. */}
        {sessionRef != null && sessionTrack && placed(RUN_ID, ownDevices.run, runDesignBinding, designsOwn.run ? RUN_DESIGN : undefined, 'the Run', {attrs: {'data-session-slot': 'run'}})}
        <div className={'agent-dropz dropz' + (held ? ' armed' : '')} data-slot="zone" data-i={DROP_ZONE_DATA_I} title={DROP_ZONE_DATA_I.split('|')[1]}>
          {held ? dropZoneLine(held) : 'Drop gateways, agents, skillsets, worlds or git here'}
        </div>
      </div>
    </div>
  )
}
