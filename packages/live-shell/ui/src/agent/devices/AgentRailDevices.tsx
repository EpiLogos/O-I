// The rail's agent devices, published in every mode (lane W1-Factory): Messages (DLW §19.24 "born on the widget rail, and opens full in a
// pane, in every mode"), the Ledger (§19.13) — a monitor, "On the rail, and full in a pane. Never on a chain" (§16.1) — the Frames tile, which
// is the Gateway's widget (§19.6), and the workcell rack, whose widget is the Workcells tile (§19.23), listing every gateway your machines
// reach with its state (§19.3: the Gateways monitor was retired into it in the 22 Oct manual rewrite, its reading carried under `gw.`). The
// Agency gateway is the Gateway's agency build, whose mark stands in the head of Messages (§19.10): Messages reads the same gateway answer
// (messagesBinding.ts), and no device of its own stands. They stand on the rail whether or not Factory's chain is mounted, so they are published here,
// once, beside the rail's own publisher (widgets/railDevices.tsx RailDevices draws this), and never by FactoryDeviceChain.tsx, which draws
// the workcell rack on a workcell's chain from the door.
//
// Every read is the window's shared held reading, the same one the chain reads, so publishing here doubles no owner call: the chain's
// readings (useAgentChainReading.ts — harness_agent_read and git_repository_read go through the kernel's held-read holder,
// owners/ownerCall.ts installKernelReadHolder; the roster and Workcell's status are owners/readers.ts answers), AIKit's population
// (usePopulationAnswer.ts) and the open agent's conversation (useConversationAnswer.ts), Central's ground (central/devices/useCentralReadings.ts
// useCentralGroundAnswer), the seat instrument (workcellReads.ts useSeatStatusAnswer — slow, so asked only while the Workcells tile is open
// or a workcell's return track is selected), AIKit's own gateway journal (workcellReads.ts useGatewayEcology and useGatewayReplays: the
// Frames monitor's frames, lane W6). Messages' Send and a drop onto a track write through the kernel's gateway_write (lane W3, ownerRoutes.ts). The bindings are the devices' own: messagesBinding.ts, mainTrackBindings.ts (rackBinding,
// agencyBinding, framesBinding), receiptBindings.ts ledgerBinding, workcellRackBinding.ts — the rack's macros write through the Gateway's
// rows, the same rows and write path the chain's Gateway writes through (designBindings.ts gatewayBinding; agentNativeDispatch.ts
// fireWritePath).
import {useCallback, useEffect, useMemo, useState} from 'react'
import {useOwnerOp} from '../../owners/ownerCall'
import {publishDevice, selectDevice} from '../../frame/devices/deviceDoor'
import type {DesignBinding} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {workcellOfTrack} from '../../frame/tracks/returnTracks'
import {agentAddress} from '../../inhabitants/agentParamAddresses'
import {useWorkcellAnswer} from '../../owners/readers'
import {useOptionalContinuity} from '../../continuity/workspace'
import {actionAnswerOf, centralActionOp, useCentralAction, useCentralGroundAnswer} from '../../central/devices/useCentralReadings'
import {useHygieneDevice} from '../../central/devices/groundDevices'
import {useAgentSessionsOptional} from '../AgentSessionsProvider'
import {useAgentShellOptional} from '../AgentShellContext'
import {fireWritePath} from '../agentNativeDispatch'
import {trackKey} from '../agentRunModel'
import {chainDeviceId, slotRows} from './agentChainDevices'
import {gatewayBinding, useChainHolds, viewHolds} from './designBindings'
import {AGENCY_GATEWAY_ID, FRAMES_ID, FRAMES_VIEW, framesBinding, journalAsks, journalSessions, mainDevices, rackBinding} from './mainTrackBindings'
import {GATEWAYS_PAGE, LEFT_BEHIND_PAGE, carryPages} from './oneAgentBinding'
import {MESSAGES_ID, PERSON_ACTS, madeOf, messagesBinding, messagesDevice, positionRefs, type MessagesPorts} from './messagesBinding'
import {runStateOfSession} from './runFaces'
import {hostState} from '../../frame/devices/deviceHost'
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {GatewayWriteRequest, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {LEDGER_ID, ledgerBinding, ledgerReceiptSession, receiptDevices} from './receiptBindings'
import {useAgentChainReading} from './useAgentChainReading'
import {useConversationAnswer} from './useConversationAnswer'
import {ROUTE_WORDS, gatewayWriteOp, ownerRouteWrite, refusalWords, workcellWriteOp} from './ownerRoutes'
import {usePopulationAnswer} from './usePopulationAnswer'
import {projectOfSession, registerOf, ROOT_REGISTER} from '../worldScope'
import {CARRIER_ID, carrierChainState, carrierValues, gitValues} from './workcellBindings'
import {WORKCELL_RACK_ID, chosenWorld, workcellGitReading, workcellRackBinding, workcellRackDevice} from './workcellRackBinding'
import {useActuationRead, useGatewayEcology, useGatewayReplays, useInstanceUsages, useSeatStatusAnswer, useSourceReturnsAnswer, useWorkcellRead} from './workcellReads'

/** The rail's agent devices this publisher holds, by id: withdrawn with it. Approvals is not among them — it is Factory's Main track
 * effect (§19.14), published by its chain. */
export const RAIL_AGENT_DEVICE_IDS: readonly string[] = [MESSAGES_ID, FRAMES_ID, LEDGER_ID, WORKCELL_RACK_ID]

/** Why the seat instrument is not asked: it is slow, so it is read only where its reading is drawn. */
export const SEATS_NOT_ASKED = 'The seat instrument is asked while the Workcells tile is open or a workcell\'s return track is selected (`seat status` is slow, so it is not read for a closed tile).'

/** One of the person's own Central acts through the kernel's invoke_action (a write: kernelOp, never a held read): Central's data, or its own
 * words as the refusal. */
export async function centralAct(transport: KernelTransportStatus, action: string, input: Readonly<Record<string, unknown>>): Promise<unknown> {
  const call = await kernelOp(transport, centralActionOp(action, input))
  const answer = actionAnswerOf({status: call.error ? 'refused' : 'answered', value: call.outcome?.result === 'action_dispatched' ? call.outcome : null, error: call.error ?? null}, action)
  if (answer.status === 'answered') return answer.value
  throw Error(answer.status === 'refused' ? answer.error : `${action} did not answer.`)
}

/** Central's agent-set listing (ctrl agent_set_actions.rs): a reading, scope root or project. */
export const AGENT_SET_LIST = 'central.agent-set.list'
const ROOT_SETS = {scope: 'root'} as const

/** The rail's agent devices and their bindings, published on the door. */
export function AgentRailDevices() {
  const shell = useAgentShellOptional()
  const sessions = useAgentSessionsOptional()
  const continuity = useOptionalContinuity()
  const {reading, transport, binding, resolved} = useAgentChainReading(null)
  const holds = useChainHolds()
  // The rail's register (agent/worldScope.ts): the selected session's own, else your world's root register. Messages read the world's
  // whole population (no project world names it); the Ledger, your groups and the workcell's seat follow the selected session.
  const railProject = projectOfSession(sessions?.rows ?? [], sessions?.selectedSessionRef ?? null)
  const railRegister = registerOf(railProject)

  // The gateways (carried by the Workcells tile) and the Frames: the gateway's own answer; the Remote carrier's line from Workcell's status.
  const main = useMemo(() => mainDevices(), [])
  const workcellAnswer = useWorkcellAnswer(transport).reading
  const carrier = useMemo(() => carrierChainState(workcellAnswer), [workcellAnswer])
  const showChain = useCallback((chain: string) => {
    const shown = chain === 'hermes' ? chainDeviceId('gateway') : chain === 'aikit-agency-gateway' ? AGENCY_GATEWAY_ID : chain === 'remote-carrier' ? CARRIER_ID : null
    if (shown) selectDevice(shown)
  }, [])
  const gateways = useMemo(() => rackBinding({reading, holds, carrier}, {show: showChain}), [reading, holds, carrier, showChain])
  // The Frames monitor's frames (lane W6): AIKit's own gateway journal — its ecology names the sessions and their Streams, and each Stream of
  // the session chosen is replayed from where its last Keep frames begin. Refusals are AIKit's words (the installed AIKit may not carry
  // `gateway replay` yet), drawn as the reason.
  const ecology = useGatewayEcology(transport, true)
  const framesView = viewHolds(holds, FRAMES_ID)
  const asks = useMemo(() => journalAsks((ecology.status === 'answered' ? journalSessions(ecology.value) : null) ?? [], framesView.session ?? FRAMES_VIEW.session,
    framesView.keep ?? FRAMES_VIEW.keep), [ecology, framesView.session, framesView.keep])
  const replays = useGatewayReplays(transport, asks)
  const frames = useMemo(() => framesBinding({reading, harness: {binding, resolved}}, holds, {ecology, ...(replays ? {replays} : {})}),
    [reading, binding, resolved, holds, ecology, replays])

  // The Ledger: Central's change horizon and the project's source returns (W9: Waiting, Commented, Approved, Refused); Open log selects the
  // receipt's session's track.
  const ground = useCentralGroundAnswer(transport)
  const returnsRead = useSourceReturnsAnswer(transport, railRegister).reading
  const returned = returnsRead.status === 'answered' ? returnsRead.value : null
  const receipts = useMemo(() => receiptDevices(), [])
  const tracks = sessions?.tracks ?? null
  const openSession = useCallback((ref: string) => {
    const chosen = tracks?.find(item => item.sessionRef === ref && !item.group)
    if (!chosen || !shell) return 'This agent session is not among Factory\'s sessions here.'
    shell.setSelectedTrackId(trackKey(chosen))
    return null
  }, [tracks, shell])
  // The chosen receipt's session's tokens and spend (lane K0): Actuation's usage records of that session (`actuation usage list --session`).
  const usageSession = useMemo(() => ledgerReceiptSession({ground: ground.reading, holds, returns: returned, tracks}), [ground.reading, holds, returned, tracks])
  const usageAnswer = useActuationRead(transport, usageSession ? {kind: 'usage-list', session: usageSession} : null)
  const usage = useMemo(() => (usageSession ? {session: usageSession, ...usageAnswer} : null), [usageSession, usageAnswer])
  const ledger = useMemo(() => ledgerBinding({ground: ground.reading, groundError: ground.error, holds, returns: returned, tracks, usage}, {openSession}),
    [ground.reading, ground.error, holds, openSession, returned, tracks, usage])

  // Messages: AIKit's population, the Agency gateway's answer, and the open agent's conversation (read while an agent of the population is
  // open).
  const population = usePopulationAnswer(transport, registerOf(ROOT_REGISTER))
  const positions = useMemo(() => positionRefs(population.status === 'answered' ? population.value : null), [population])
  const opened = viewHolds(holds, MESSAGES_ID).open
  const conversation = useConversationAnswer(transport, registerOf(ROOT_REGISTER), typeof opened === 'string' && positions.includes(opened) ? opened : null, positions)
  // Making an agent (§19.24, lane W2): the proposal Make wrote, read back through Central's review; the person's acts through invoke_action,
  // which carries the person's authority for them (desktop/cradle/kernel/src/action.rs PERSON_ACTS). Every answer is Central's own.
  const made = madeOf(viewHolds(holds, MESSAGES_ID).made)
  const reviewInput = useMemo(() => (made?.kind === 'agent' ? {scope: made.scope, ...(made.scope === 'project' && made.project ? {project: made.project} : {}), profile_ref: made.ref} : null),
    [made?.kind, made?.scope, made?.project, made?.ref]) // eslint-disable-line react-hooks/exhaustive-deps
  const review = useCentralAction(transport, PERSON_ACTS.review, reviewInput)
  // AIKit's gateway writes (lane W3): Send and a drop onto a track through the kernel's route to `aikit gateway send|delegate`.
  const ports = useMemo((): MessagesPorts => ({
    ...(transport.kind !== 'unavailable' ? {act: (action: string, input: Readonly<Record<string, unknown>>) => centralAct(transport, action, input),
      gateway: (request: GatewayWriteRequest) => ownerRouteWrite(transport, gatewayWriteOp(request), ROUTE_WORDS[request.kind])} : {}),
    page: () => hostState(MESSAGES_ID).page,
    suffix: () => globalThis.crypto.randomUUID().slice(0, 8),
  }), [transport])
  // The run each agent's session stands in (runFaces.ts), by its agent ref: the posture of an occupied agent's face.
  const nowUnixMs = sessions?.nowUnixMs ?? 0
  const runs = useMemo(() => new Map((tracks ?? []).filter(track => !track.group && track.agentRef).flatMap(track => {
    const run = runStateOfSession(track, null, nowUnixMs)
    return run ? [[track.agentRef!, run] as const] : []
  })), [tracks, nowUnixMs])
  // Your groups (lane W7): Central's agent sets of the root and of the project, read through invoke_action as readings.
  const projectSetsInput = useMemo(() => (railRegister === null ? null : {scope: 'project', project: railRegister}), [railRegister])
  const rootSets = useCentralAction(transport, AGENT_SET_LIST, ROOT_SETS)
  const projectSets = useCentralAction(transport, AGENT_SET_LIST, projectSetsInput)
  // A session of your world's root register has no project groups: only the root's are read.
  const agentSets = useMemo(() => [{scope: 'root' as const, answer: rootSets}, ...(railRegister === null ? [] : [{scope: 'project' as const, answer: projectSets}])],
    [rootSets, projectSets, railRegister])
  const messages = useMemo(() => messagesBinding({population, gateway: reading, conversation, review, runs, ...(railRegister === null ? {} : {project: railRegister}), agentSets, holds}, ports),
    [population, reading, conversation, review, runs, agentSets, holds, ports, railRegister])

  // The workcell rack: the workcell whose return track is selected, its seats, the chain devices' own values, and the Gateway's rows for the
  // macros — the same rows and the same write path the chain's Gateway writes through.
  const cellName = workcellOfTrack(shell?.selectedTrackId)
  const railOpen = continuity?.current.widgets?.open
  const asked = cellName != null || !!railOpen?.includes('workcells')
  const seats = useSeatStatusAnswer(transport, asked).reading
  const gatewayPort = useMemo((): DesignBinding => {
    const rows = slotRows('gateway')
    const stall = agentAddress('gateway', 'stall-after')
    return gatewayBinding(chainDeviceId('gateway'), {reading, harness: {binding, resolved}}, {
      transport: rows.find(row => row.key === 'transport'), approvals: rows.find(row => row.key === 'approvals'), connect: rows.find(row => row.key === 'connect'),
      ...(stall ? {stallAfter: {...stall, title: 'Stall after'}} : {}),
    }, (row, value) => fireWritePath(row, value, {transport, binding}))
  }, [reading, binding, resolved, transport])
  // The Frames tile is the Gateway's widget (§19.6): the Gateway's own binding (its Link page, the same rows and write path the chain's Gateway
  // writes through) with the frames' binding laid over it (its Frames page, the frames themselves): each key goes to the binding that holds it.
  const framesTile = useMemo((): DesignBinding => {
    const held = new Set([...Object.keys(frames.values), ...Object.keys(frames.local ?? {}), ...Object.keys(frames.standing ?? {})])
    const owner = (key: string): DesignBinding => (held.has(key) ? frames : gatewayPort)
    return {...gatewayPort, ...frames, id: FRAMES_ID, values: {...gatewayPort.values, ...frames.values},
      standing: {...(gatewayPort.standing ?? {}), ...(frames.standing ?? {})}, local: {...(gatewayPort.local ?? {}), ...(frames.local ?? {})},
      writes: key => { const binding = owner(key); return binding.writes ? binding.writes(key) : !!binding.write },
      write: async changes => {
        for (const change of changes) {
          const binding = owner(change.key)
          if (!binding.write) throw Error(`${change.key} is a reading: its owner reports it; nothing here changes it.`)
          await binding.write([change])
        }
      }}
  }, [frames, gatewayPort])
  // The machine's services and harness processes (W10): Workcell's doctor, its instances and each live one's cost, read while the rack stands.
  const doctor = useWorkcellRead(transport, asked ? {kind: 'doctor'} : null)
  const instanceList = useWorkcellRead(transport, asked ? {kind: 'instances-list'} : null)
  const usages = useInstanceUsages(transport, instanceList.answer)
  // The world (W12): the receipt `workcell worlds` lists for this machine's cell, read with material_read; the last reconcile's answer is
  // the one Apply got in this window.
  const worlds = useWorkcellRead(transport, asked ? {kind: 'worlds'} : null)
  const cellStatus = workcellAnswer.status === 'answered' && workcellAnswer.value && typeof workcellAnswer.value === 'object' ? workcellAnswer.value as {workcell_ref?: unknown; state_root?: unknown} : null
  const machineRef = typeof cellStatus?.workcell_ref === 'string' ? cellStatus.workcell_ref : null
  const stateRoot = typeof cellStatus?.state_root === 'string' ? cellStatus.state_root : null
  const picked = useMemo(() => chosenWorld(worlds.answer, machineRef, viewHolds(holds, WORKCELL_RACK_ID).worldReceipt), [worlds.answer, machineRef, holds])
  const materialOp = useMemo(() => (picked.chosen && stateRoot ? {op: 'material_read' as const, target: {receipt: picked.chosen.receipt, state_root: stateRoot, expected_world_ref: picked.chosen.worldRef}} : null),
    [picked.chosen?.receipt, picked.chosen?.worldRef, stateRoot]) // eslint-disable-line react-hooks/exhaustive-deps
  const materialRead = useOwnerOp(transport, materialOp, 'native_owner_reading')
  const material = useMemo(() => {
    const reading = materialRead.reading
    if (reading.status !== 'answered') return {status: reading.status, value: null, error: reading.error ? refusalWords(reading.error) : null}
    const failure = reading.value?.failure as {message?: unknown} | null | undefined
    return reading.value?.data ? {status: 'answered' as const, value: reading.value.data, error: null}
      : {status: 'refused' as const, value: null, error: typeof failure?.message === 'string' ? failure.message : 'Workcell answered the material read with neither a reading nor its failure.'}
  }, [materialRead.reading])
  // The chosen world's leases and checkpoints (lane K0): Workcell's own readings of its receipt.
  const leaseRead = useWorkcellRead(transport, asked && picked.chosen ? {kind: 'lease', receipt: picked.chosen.receipt} : null)
  const checkpointsRead = useWorkcellRead(transport, asked && picked.chosen ? {kind: 'checkpoints', receipt: picked.chosen.receipt} : null)
  const [lastReconcile, setLastReconcile] = useState<{receipt: string; answer: unknown} | null>(null)
  const workcellWrite = useMemo(() => (transport.kind !== 'unavailable'
    ? async (request: Parameters<typeof workcellWriteOp>[0]) => {
      const answer = await ownerRouteWrite(transport, workcellWriteOp(request), `\`workcell ${request.kind}\``)
      if (request.kind === 'reconcile') setLastReconcile({receipt: request.receipt, answer: answer.data})
      return answer
    } : undefined), [transport])
  const ownWorkcell = useMemo(() => {
    const git = gitValues(cellName ? workcellGitReading(seats, cellName, railProject) : reading, holds)
    const seatsUnread = !asked ? SEATS_NOT_ASKED : seats.status === 'refused' && seats.error ? seats.error : undefined
    return workcellRackBinding({name: cellName, project: railProject, seats: seats.status === 'answered' ? seats.value : null, ...(seatsUnread ? {seatsUnread} : {}),
      chain: {gateway: gatewayPort.values, carrier: carrierValues(workcellAnswer, holds), git}, holds,
      ...(asked ? {doctor: doctor.answer, instances: {list: instanceList.answer, usages}, worlds: worlds.answer, ...(materialOp ? {material} : {}),
        ...(picked.chosen ? {lease: leaseRead.answer, checkpoints: checkpointsRead.answer} : {}),
        ...(lastReconcile && lastReconcile.receipt === picked.chosen?.receipt ? {reconciled: lastReconcile.answer} : {})} : {})},
    {gateway: gatewayPort, ...(asked && transport.kind !== 'unavailable' ? {rereadServices: doctor.refresh, ...(materialOp ? {rereadWorld: materialRead.refresh} : {})} : {}),
      ...(workcellWrite ? {workcell: workcellWrite} : {})})
  }, [cellName, seats, asked, reading, holds, gatewayPort, workcellAnswer, doctor, instanceList, usages, transport, workcellWrite, worlds.answer, materialOp, material, materialRead.refresh, lastReconcile, picked.chosen?.receipt,
    leaseRead.answer, checkpointsRead.answer, railProject])
  // The Workcells tile lists every gateway your machines reach, with its state (§19.3, §19.23 Widget): the gateways' own binding under `gw.`.
  // What runs left behind (§19.23, the rack's Left behind page): Ground hygiene's census of this machine's worlds and sandboxes under `left.`,
  // read while the rack stands (groundDevices.ts useHygieneDevice, the census Git / landing's Checkouts page carries too).
  const leftBehind = useHygieneDevice(transport, asked)
  const workcell = useMemo(() => carryPages(ownWorkcell, [{page: GATEWAYS_PAGE, binding: gateways}, {page: LEFT_BEHIND_PAGE, binding: leftBehind}]), [ownWorkcell, gateways, leftBehind])

  // Publish each one again only when its own binding moves; withdraw them all with this publisher.
  const devices = useMemo((): Readonly<Record<string, DeviceInstance | null>> => ({
    [MESSAGES_ID]: messagesDevice(), [FRAMES_ID]: main.frames,
    [LEDGER_ID]: receipts.ledger, [WORKCELL_RACK_ID]: workcellRackDevice(),
  }), [main, receipts])
  const publish = (id: string, designBinding: DesignBinding) => { const device = devices[id]; publishDevice(id, device ? {device, binding: designBinding} : null) }
  useEffect(() => { publish(MESSAGES_ID, messages) }, [devices, messages]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { publish(FRAMES_ID, framesTile) }, [devices, framesTile]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { publish(LEDGER_ID, ledger) }, [devices, ledger]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { publish(WORKCELL_RACK_ID, workcell) }, [devices, workcell]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { for (const id of RAIL_AGENT_DEVICE_IDS) publishDevice(id, null) }, [])
  return null
}
