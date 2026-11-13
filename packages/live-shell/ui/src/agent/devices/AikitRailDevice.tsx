// AIKit's instrument on the door (manual §19.26; ai-kit__ai-kit.tsx): published beside the rail's agent devices (AgentRailDevices.tsx mounts
// this), in every mode, so its pane and its rail tile (agentDockTiles.ts `aikit`) draw the catalogue's design on one binding
// (aikitInstrumentBinding.ts). Every read is a held one the window already asks: the Skillset rack's upkeep lists (the same aikit_read
// requests FactoryDeviceChain.tsx asks for the rack, so where a session's chain stands nothing is asked twice), AIKit's continuity of the
// run's register (the Agent's Context reads), AIKit's set list, and the Skillset rack's own door values for the selected session's agent.
// The lists are asked only while the instrument is drawn or a session is selected (AIKIT_ABSENT.notAsked otherwise).
import {useEffect, useMemo, useSyncExternalStore} from 'react'
import type {AikitWriteRequest, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {publishDevice, publishedDevice, subscribeDeviceDoor, useSelectedDeviceId} from '../../frame/devices/deviceDoor'
import {useOptionalContinuity} from '../../continuity/workspace'
import {useOwnerOp} from '../../owners/ownerCall'
import {useAgentSessionsOptional} from '../AgentSessionsProvider'
import {useAgentShellOptional} from '../AgentShellContext'
import {trackKey} from '../agentRunModel'
import {registerOf, ROOT_REGISTER} from '../worldScope'
import {chainDeviceId} from './agentChainDevices'
import {AIKIT_ID, aikitInstrumentBinding} from './aikitInstrumentBinding'
import {useChainHolds, viewHolds} from './chainHolds'
import type {RackUpkeep} from './designBindings'
import type {AikitAnswer} from './aikitPages'
import {familyFaceDevice} from './mainTrackBindings'
import {aikitWriteOp, ownerRouteWrite, refusalWords} from './ownerRoutes'
import {useAikitRead} from './workcellReads'

/** The rail's tile id for AIKit's instrument (agentDockTiles.ts claims it). */
export const AIKIT_TILE = 'aikit'

/** A held answer, or the carrier's refusal where none stands (one object per refusal, so the binding moves only when the words do). */
const refusals = new Map<string, AikitAnswer>()
function carriedAnswer(unread: AikitAnswer | null, answer: AikitAnswer): AikitAnswer {
  if (!unread) return answer
  const held = refusals.get(unread.error ?? '')
  if (held) return held
  refusals.set(unread.error ?? '', unread)
  return unread
}

/** AIKit's instrument, published on the door while the rail's agent devices stand; withdrawn with them. */
export function AikitRailDevice({transport}: {transport: KernelTransportStatus}) {
  const shell = useAgentShellOptional()
  const sessions = useAgentSessionsOptional()
  const continuity = useOptionalContinuity()
  const holds = useChainHolds()
  const selectedDevice = useSelectedDeviceId()
  // The run the selection names: the selected track, a lone session's or a group's.
  const tracks = sessions?.tracks ?? null
  const selected = shell?.selectedTrackId ?? null
  const track = useMemo(() => (selected && tracks ? tracks.find(item => trackKey(item) === selected) ?? null : null), [tracks, selected])
  const run = useMemo(() => (track ? {name: track.purpose ?? track.sessionRef, group: track.group} : null), [track])
  const agent = useMemo(() => (track && !track.group ? {id: track.agentRef ?? track.sessionRef, name: track.agentName ?? track.agentRef ?? track.sessionRef, sessionRef: track.sessionRef} : null), [track])
  // With no kernel carrier nothing is asked: every reading stands refused in the carrier's words, never "reading" for ever.
  const unread = transport.kind === 'unavailable' ? {status: 'refused' as const, value: null, error: transport.reason ?? 'The kernel carrier is unavailable.'} : null
  const project = track?.project ?? ROOT_REGISTER
  const register = registerOf(project)
  // The Skillset rack on the door: the selected lone session's chain stands it in Factory (its members and the sets it carries).
  const rackValues = useSyncExternalStore(subscribeDeviceDoor, () => publishedDevice(chainDeviceId('skillset'))?.binding?.values ?? null, () => null)
  const asked = !!continuity?.current.widgets?.open?.includes(AIKIT_TILE) || selectedDevice === AIKIT_ID || agent != null

  // Context: AIKit's continuity of the run's register, for the agent's session (the Agent's Context asks the same).
  const contextOn = asked && agent != null
  const pressure = carriedAnswer(unread, useAikitRead(transport, contextOn ? {kind: 'continuity-pressure', project: register} : null))
  const commands = carriedAnswer(unread, useAikitRead(transport, contextOn ? {kind: 'continuity-commands', project: register} : null))
  const turn = carriedAnswer(unread, useAikitRead(transport, contextOn ? {kind: 'continuity-turn', project: register, session: agent!.sessionRef} : null))
  const context = useMemo(() => (contextOn ? {pressure, commands, turn} : undefined), [contextOn, pressure, commands, turn])

  // The upkeep pages: the Skillset rack's own reads, under this instrument's holds (the root it previews, the procedure chosen).
  const view = viewHolds(holds, AIKIT_ID)
  const unused = carriedAnswer(unread, useAikitRead(transport, asked ? {kind: 'unused'} : null))
  const sources = carriedAnswer(unread, useAikitRead(transport, asked ? {kind: 'source-list'} : null))
  const collate = carriedAnswer(unread, useAikitRead(transport, asked ? {kind: 'collate', all: true} : null))
  const bypasses = carriedAnswer(unread, useAikitRead(transport, asked ? {kind: 'bypass-list'} : null))
  const procedures = carriedAnswer(unread, useAikitRead(transport, asked ? {kind: 'procedure-list'} : null))
  const previewed = typeof view.adoptPreviewed === 'string' && view.adoptPreviewed && view.adoptPreviewed === view.adoptRoot ? view.adoptPreviewed : null
  const namespace = typeof view.namespace === 'string' && view.namespace ? view.namespace : null
  const adoption = carriedAnswer(unread, useAikitRead(transport, asked && previewed ? {kind: 'adopt-plan', root: previewed, ...(namespace ? {namespace} : {})} : null))
  const chosenProcedure = typeof view.procedure === 'string' && view.procedure ? view.procedure : null
  const procedure = carriedAnswer(unread, useAikitRead(transport, asked && chosenProcedure ? {kind: 'procedure-diff', procedure: chosenProcedure} : null))
  const upkeep = useMemo((): RackUpkeep => ({unused, sources, collate, bypasses, procedures, ...(previewed ? {adoption} : {}), ...(chosenProcedure ? {procedure} : {}),
    ...(transport.kind !== 'unavailable' ? {write: request => ownerRouteWrite(transport, aikitWriteOp(request as AikitWriteRequest), `\`aikit ${request.kind.replace('-', ' ')}\``)} : {})}),
  [unused, sources, collate, bypasses, procedures, previewed, adoption, chosenProcedure, procedure, transport])
  // Package's sets: AIKit's set list (agent_definition skillsets), the one the Skillset rack reads.
  const setListOp = useMemo(() => (asked ? {op: 'agent_definition' as const, project: register, request: {action: 'skillsets' as const}} : null), [asked, register])
  const setListRead = useOwnerOp(transport, setListOp, 'agent_definition_reading').reading
  const setList = useMemo(() => unread ?? {status: setListRead.status, value: setListRead.value?.data ?? null, error: setListRead.error ? refusalWords(setListRead.error) : null},
    [setListRead, unread?.error]) // eslint-disable-line react-hooks/exhaustive-deps

  const binding = useMemo(() => aikitInstrumentBinding({holds, run, agent, rack: agent ? rackValues : null, asked, upkeep, ...(context ? {context} : {}), ...(asked ? {setList} : {}), project}),
    [holds, run, agent, rackValues, asked, upkeep, context, setList, project])
  const device = useMemo(() => familyFaceDevice(AIKIT_ID, 'ai-kit', 'ai-kit', 'AIKit', 'lib'), [])
  useEffect(() => { publishDevice(AIKIT_ID, device ? {device, binding} : null) }, [device, binding])
  useEffect(() => () => publishDevice(AIKIT_ID, null), [])
  return null
}
