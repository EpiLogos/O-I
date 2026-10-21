// The rail's agent devices, published in every mode (lane W1-Factory): Messages (DLW §19.24 "born on the widget rail, and opens full in a
// pane, in every mode"), the monitors Gateways (§19.3), Frames (§19.6) and the Ledger (§19.13) — "On the rail, and full in a pane. Never on a
// chain" (§16.1) — the Agency gateway, whose mark stands in the head of Messages and as a line of Gateways (§19.10), and the workcell rack,
// whose widget is the Workcells tile (§19.23). They stand on the rail whether or not Factory's chain is mounted, so they are published here,
// once, beside the rail's own publisher (widgets/railDevices.tsx RailDevices draws this), and never by FactoryDeviceChain.tsx, which draws
// the workcell rack on a workcell's chain from the door.
//
// Every read is the window's shared held reading, the same one the chain reads, so publishing here doubles no owner call: the chain's
// readings (useAgentChainReading.ts — harness_agent_read and git_repository_read go through the kernel's held-read holder,
// owners/ownerCall.ts installKernelReadHolder; the roster and Workcell's status are owners/readers.ts answers), AIKit's population
// (usePopulationAnswer.ts) and the open agent's conversation (useConversationAnswer.ts), Central's ground (central/devices/useCentralReadings.ts
// useCentralGroundAnswer), the seat instrument (workcellReads.ts useSeatStatusAnswer — slow, so asked only while the Workcells tile is open
// or a workcell's return track is selected). The bindings are the devices' own: messagesBinding.ts, mainTrackBindings.ts (rackBinding,
// agencyBinding, framesBinding), receiptBindings.ts ledgerBinding, workcellRackBinding.ts — the rack's macros write through the Gateway's
// rows, the same rows and write path the chain's Gateway writes through (designBindings.ts gatewayBinding; agentNativeDispatch.ts
// fireWritePath).
import {useCallback, useEffect, useMemo} from 'react'
import {publishDevice, selectDevice} from '../../frame/devices/deviceDoor'
import type {DesignBinding} from '../../frame/devices/designed'
import type {DeviceInstance} from '../../frame/devices/deviceRuntime'
import {workcellOfTrack} from '../../frame/tracks/returnTracks'
import {agentAddress} from '../../inhabitants/agentParamAddresses'
import {useWorkcellAnswer} from '../../owners/readers'
import {useOptionalContinuity} from '../../continuity/workspace'
import {useCentralGroundAnswer} from '../../central/devices/useCentralReadings'
import {useAgentSessionsOptional} from '../AgentSessionsProvider'
import {useAgentShellOptional} from '../AgentShellContext'
import {fireWritePath} from '../agentNativeDispatch'
import {trackKey} from '../agentRunModel'
import {chainDeviceId, slotRows} from './agentChainDevices'
import {gatewayBinding, useChainHolds, viewHolds} from './designBindings'
import {AGENCY_GATEWAY_ID, FRAMES_ID, GATEWAYS_RACK_ID, agencyBinding, framesBinding, mainDevices, rackBinding} from './mainTrackBindings'
import {MESSAGES_ID, messagesBinding, messagesDevice, positionRefs} from './messagesBinding'
import {LEDGER_ID, ledgerBinding, receiptDevices} from './receiptBindings'
import {useAgentChainReading} from './useAgentChainReading'
import {useConversationAnswer} from './useConversationAnswer'
import {usePopulationAnswer} from './usePopulationAnswer'
import {RACK_PROJECT} from './useRackReading'
import {CARRIER_ID, carrierChainState, carrierValues, gitValues} from './workcellBindings'
import {WORKCELL_RACK_ID, workcellGitReading, workcellRackBinding, workcellRackDevice} from './workcellRackBinding'
import {useSeatStatusAnswer} from './workcellReads'

/** The rail's agent devices this publisher holds, by id: withdrawn with it. Approvals is not among them — it is Factory's Main track
 * effect (§19.14), published by its chain. */
export const RAIL_AGENT_DEVICE_IDS: readonly string[] = [MESSAGES_ID, GATEWAYS_RACK_ID, AGENCY_GATEWAY_ID, FRAMES_ID, LEDGER_ID, WORKCELL_RACK_ID]

/** Why the seat instrument is not asked: it is slow, so it is read only where its reading is drawn. */
export const SEATS_NOT_ASKED = 'The seat instrument is asked while the Workcells tile is open or a workcell\'s return track is selected (`seat status` is slow, so it is not read for a closed tile).'

/** The rail's agent devices and their bindings, published on the door. */
export function AgentRailDevices() {
  const shell = useAgentShellOptional()
  const sessions = useAgentSessionsOptional()
  const continuity = useOptionalContinuity()
  const {reading, transport, binding, resolved} = useAgentChainReading(null)
  const holds = useChainHolds()

  // The Agency gateway, Gateways and Frames: the gateway's own answer; the Remote carrier's line from Workcell's status.
  const main = useMemo(() => mainDevices(), [])
  const workcellAnswer = useWorkcellAnswer(transport).reading
  const carrier = useMemo(() => carrierChainState(workcellAnswer), [workcellAnswer])
  const showChain = useCallback((chain: string) => {
    const shown = chain === 'hermes' ? chainDeviceId('gateway') : chain === 'aikit-agency-gateway' ? AGENCY_GATEWAY_ID : chain === 'remote-carrier' ? CARRIER_ID : null
    if (shown) selectDevice(shown)
  }, [])
  const gateways = useMemo(() => rackBinding({reading, holds, carrier}, {show: showChain}), [reading, holds, carrier, showChain])
  const agency = useMemo(() => agencyBinding(reading, holds), [reading, holds])
  const frames = useMemo(() => framesBinding({reading, harness: {binding, resolved}}, holds), [reading, binding, resolved, holds])

  // The Ledger: Central's change horizon; Open log selects the receipt's session's track.
  const ground = useCentralGroundAnswer(transport)
  const receipts = useMemo(() => receiptDevices(), [])
  const tracks = sessions?.tracks ?? null
  const openSession = useCallback((ref: string) => {
    const chosen = tracks?.find(item => item.sessionRef === ref && !item.group)
    if (!chosen || !shell) return 'This agent session is not among Factory\'s sessions here.'
    shell.setSelectedTrackId(trackKey(chosen))
    return null
  }, [tracks, shell])
  const ledger = useMemo(() => ledgerBinding({ground: ground.reading, groundError: ground.error, holds}, {openSession}), [ground.reading, ground.error, holds, openSession])

  // Messages: AIKit's population, the Agency gateway's answer, and the open agent's conversation (read while an agent of the population is
  // open).
  const population = usePopulationAnswer(transport, RACK_PROJECT)
  const positions = useMemo(() => positionRefs(population.status === 'answered' ? population.value : null), [population])
  const opened = viewHolds(holds, MESSAGES_ID).open
  const conversation = useConversationAnswer(transport, RACK_PROJECT, typeof opened === 'string' && positions.includes(opened) ? opened : null, positions)
  const messages = useMemo(() => messagesBinding({population, gateway: reading, conversation, holds}), [population, reading, conversation, holds])

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
  const workcell = useMemo(() => {
    const git = gitValues(cellName ? workcellGitReading(seats, cellName, RACK_PROJECT) : reading, holds)
    const seatsUnread = !asked ? SEATS_NOT_ASKED : seats.status === 'refused' && seats.error ? seats.error : undefined
    return workcellRackBinding({name: cellName, project: RACK_PROJECT, seats: seats.status === 'answered' ? seats.value : null, ...(seatsUnread ? {seatsUnread} : {}),
      chain: {gateway: gatewayPort.values, carrier: carrierValues(workcellAnswer, holds), git}, holds}, {gateway: gatewayPort})
  }, [cellName, seats, asked, reading, holds, gatewayPort, workcellAnswer])

  // Publish each one again only when its own binding moves; withdraw them all with this publisher.
  const devices = useMemo((): Readonly<Record<string, DeviceInstance | null>> => ({
    [MESSAGES_ID]: messagesDevice(), [GATEWAYS_RACK_ID]: main.rack, [AGENCY_GATEWAY_ID]: main.agency, [FRAMES_ID]: main.frames,
    [LEDGER_ID]: receipts.ledger, [WORKCELL_RACK_ID]: workcellRackDevice(),
  }), [main, receipts])
  const publish = (id: string, designBinding: DesignBinding) => { const device = devices[id]; publishDevice(id, device ? {device, binding: designBinding} : null) }
  useEffect(() => { publish(MESSAGES_ID, messages) }, [devices, messages]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { publish(GATEWAYS_RACK_ID, gateways) }, [devices, gateways]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { publish(AGENCY_GATEWAY_ID, agency) }, [devices, agency]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { publish(FRAMES_ID, frames) }, [devices, frames]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { publish(LEDGER_ID, ledger) }, [devices, ledger]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { publish(WORKCELL_RACK_ID, workcell) }, [devices, workcell]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { for (const id of RAIL_AGENT_DEVICE_IDS) publishDevice(id, null) }, [])
  return null
}
