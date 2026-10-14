// The owners' readings behind the Factory chain's lights and rows. Ported unchanged from the chain's own reads
// (agent/AgentDeviceChain.tsx:104-191: the gateway through harness_agent_read, the roster through agent_definition, the
// session's task record through encounter_task_read, the seat through workcell_status_read and git_repository_read), with the
// same refusals named by the same owners. What changed is only where the answers rest: one reading the devices are built over,
// null where the owner has not answered (a light stays dark; no default stands in for a value).
import {useEffect, useState} from 'react'
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useWorkspace} from '../../shell/workspaceContext'
import {OWNER_BINDINGS, missingOpRemedy, ownerRefusalLine} from '../agentChainDrag'
import {refusalLine, safeJson} from '../RefusalCard'
import {useHarnessBinding} from '../useHarnessBinding'
import {
  INITIAL_READING, gatewayLine, gitRepoReading, rosterAdmits, rosterChains, rosterIdentity, taskReading,
  type AgentChainReading,
} from './agentChainDevices'

const isObj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

export function useAgentChainReading(sessionRef: string | null): {reading: AgentChainReading; transport: KernelTransportStatus; binding: string} {
  const {transport} = useWorkspace()
  const {binding} = useHarnessBinding(transport)
  const [reading, setReading] = useState<AgentChainReading>(INITIAL_READING)

  useEffect(() => {
    let live = true
    const update = (patch: Partial<AgentChainReading>) => { if (live) setReading(previous => ({...previous, ...patch})) }
    const waiting = (key: keyof AgentChainReading['waitingOn'], owner: string | null) => {
      if (live) setReading(previous => ({...previous, waitingOn: {...previous.waitingOn, [key]: owner}}))
    }
    void (async () => {
      // Another session's task record is not this one's: its budget and custody go back to unknown until this one answers.
      update({budget: null, autonomy: null})
      if (transport.kind === 'unavailable') {
        const reason = transport.reason ?? 'Transport unavailable'
        update({
          gateway: {kind: 'refused', title: 'Gateway · hermes', line: ownerRefusalLine('gateway', reason, 'not-reached'), receipt: null},
          gatewayAdmitted: false,
          gatewayDoc: null,
          gitAdmitted: false,
          git: {kind: 'refused', title: 'Git', line: ownerRefusalLine('workcell', reason, 'not-reached'), receipt: null},
          chains: [],
          skillsNote: ownerRefusalLine('roster', reason, 'not-reached'),
          waitingOn: {gateway: OWNER_BINDINGS.gateway.owner, skillset: OWNER_BINDINGS.roster.owner, git: OWNER_BINDINGS.workcell.owner},
        })
        return
      }
      const gatewayOp = await kernelOp(transport, {op: 'harness_agent_read', binding})
      const gatewayOutcome = gatewayOp.error ? null : gatewayOp.outcome
      const gatewayReading = gatewayOutcome?.result === 'harness_agent_reading' ? gatewayOutcome : null
      const gatewayAnswered = !!gatewayReading && !(isObj(gatewayReading.document) && 'refused' in gatewayReading.document)
      update({
        gatewayAdmitted: gatewayAnswered,
        gatewayDoc: gatewayReading?.document ?? null,
        gateway: !gatewayReading
          ? {kind: 'refused', title: 'Gateway · hermes', line: ownerRefusalLine('gateway', refusalLine(gatewayOp.error, 'Harness gateway reading unavailable')), receipt: gatewayOp.error ? safeJson(gatewayOp.error) : null}
          : !gatewayAnswered
            ? {kind: 'refused', title: 'Gateway · hermes', line: ownerRefusalLine('gateway', gatewayLine(gatewayReading.document)), receipt: safeJson(gatewayReading.document)}
            : {kind: 'reading', title: 'Gateway · hermes', line: `binding ${gatewayReading.binding} · ${gatewayLine(gatewayReading.document)}`, receipt: safeJson(gatewayReading.document)},
      })
      waiting('gateway', gatewayAnswered ? null : OWNER_BINDINGS.gateway.owner)

      const roster = await kernelOp(transport, {op: 'agent_definition', project: null, request: {action: 'roster'}})
      if (roster.error || roster.outcome?.result !== 'agent_definition_reading') {
        update({chains: [], skillsNote: ownerRefusalLine('roster', refusalLine(roster.error, 'Roster reading unavailable')), identity: null})
        waiting('skillset', OWNER_BINDINGS.roster.owner)
      } else {
        const admits = rosterAdmits(roster.outcome.data)
        update({
          chains: rosterChains(roster.outcome.data),
          skillsNote: admits > 0
            ? `${admits} accepted agent${admits === 1 ? '' : 's'} with skill refs disclosed.`
            : `No accepted agents with skill refs disclosed yet — waiting on ${OWNER_BINDINGS.skillset.owner}: ${missingOpRemedy('skillset')}.`,
          identity: rosterIdentity(roster.outcome.data),
        })
        waiting('skillset', admits > 0 ? null : OWNER_BINDINGS.skillset.owner)
      }

      if (sessionRef) {
        const task = await kernelOp(transport, {op: 'encounter_task_read', project: 'O-I', agent_session: sessionRef})
        if (!task.error && task.outcome?.result === 'encounter_task_reading' && task.outcome.data) {
          const read = taskReading(task.outcome.data)
          update({
            budget: read.used !== undefined || read.cap !== undefined ? {used: read.used, cap: read.cap} : null,
            autonomy: read.autonomy ?? null,
          })
        }
      }

      const seat = await kernelOp(transport, {op: 'workcell_status_read'})
      const gitOp = await kernelOp(transport, {op: 'git_repository_read', project: 'O-I'})
      const seatOutcome = seat.error ? null : seat.outcome
      const seatReading = seatOutcome?.result === 'workcell_status_reading' ? seatOutcome : null
      const seatDoc = seatReading?.data
      const workcellRef = isObj(seatDoc) && typeof seatDoc.workcell_ref === 'string' ? seatDoc.workcell_ref : null
      const seatLine = seatReading
        ? (workcellRef ? `workcell ${workcellRef}` : 'workcell status answered — no workcell_ref disclosed')
        : ownerRefusalLine('workcell', refusalLine(seat.error, 'Workcell status unavailable'))
      const gitDoc = gitOp.outcome?.result === 'git_repository_reading' ? gitOp.outcome.document : null
      const gitRef = isObj(gitDoc) && typeof gitDoc.repo_root === 'string' ? gitDoc.repo_root : null
      const gitLine = gitOp.error
        ? refusalLine(gitOp.error, 'git_repository_read unavailable')
        : gitRef ? `repo ${gitRef.split('/').pop() ?? gitRef}` : 'answered — no repo_root disclosed'
      update({
        gitAdmitted: seatReading != null,
        gitRepo: gitRepoReading(gitDoc),
        git: {
          kind: seatReading && !gitOp.error ? 'reading' : 'refused',
          title: 'Git',
          line: `${seatLine} · ${gitLine}`,
          receipt: safeJson({seat: seatDoc ?? seat.error ?? null, git: gitDoc ?? gitOp.error ?? null}),
        },
      })
      waiting('git', seatReading != null ? null : OWNER_BINDINGS.workcell.owner)
    })()
    return () => { live = false }
  }, [transport, sessionRef, binding])

  return {reading, transport, binding}
}
