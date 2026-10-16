// The owners' readings behind the Factory chain's lights and rows. Ported unchanged from the chain's own reads
// (agent/AgentDeviceChain.tsx:104-191: the gateway through harness_agent_read, the roster through agent_definition, the
// session's task record through encounter_task_read, the seat through workcell_status_read and git_repository_read), with the
// same refusals named by the same owners. What changed is only where the answers rest: one reading the devices are built over,
// null where the owner has not answered (a light stays dark; no default stands in for a value). The roster, the task record and
// the seat are the window's shared answers (owners/readers.ts) — the same ones the sessions provider, the agent browser and the
// Central devices read, one owner read between them; the gateway and the repository are read here, for the bound harness.
import {useEffect, useMemo, useState} from 'react'
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {useWorkspace} from '../../shell/workspaceContext'
import {OWNER_BINDINGS, missingOpRemedy, ownerRefusalLine} from '../agentChainDrag'
import {refusalLine, safeJson} from '../RefusalCard'
import {useHarnessBinding} from '../useHarnessBinding'
import {useRosterAnswer, useTaskAnswer, useWorkcellAnswer} from '../../owners/readers'
import {
  INITIAL_READING, gatewayLine, gitRepoReading, rosterAdmits, rosterChains, rosterIdentity, taskReading,
  type AgentChainReading,
} from './agentChainDevices'

const isObj = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

/** What the gateway and the repository answered (read here); null while they are read. */
interface OwnRead {gateway: Pick<AgentChainReading, 'gateway' | 'gatewayAdmitted' | 'gatewayDoc'>; gatewayWaiting: string | null; git: {doc: unknown; error: string | null} | null}

export function useAgentChainReading(sessionRef: string | null): {reading: AgentChainReading; transport: KernelTransportStatus; binding: string; resolved: boolean
  /** The harnesses found on this machine, from the same harness_status answer the binding is read from (null: not read). */
  harnesses: string[] | null} {
  const {transport} = useWorkspace()
  // `resolved`: the owner named the binding (until it has, 'cursor' is only the shell's default — useHarnessBinding.ts:8).
  const {binding, resolved, harnesses} = useHarnessBinding(transport)
  const roster = useRosterAnswer(transport, null).reading
  const task = useTaskAnswer(transport, transport.kind === 'unavailable' ? null : sessionRef).reading
  const seat = useWorkcellAnswer(transport).reading
  const [own, setOwn] = useState<OwnRead | null>(null)

  useEffect(() => {
    let live = true
    setOwn(null)
    if (transport.kind === 'unavailable') return
    void (async () => {
      const gatewayOp = await kernelOp(transport, {op: 'harness_agent_read', binding})
      const gatewayOutcome = gatewayOp.error ? null : gatewayOp.outcome
      const gatewayReading = gatewayOutcome?.result === 'harness_agent_reading' ? gatewayOutcome : null
      const gatewayAnswered = !!gatewayReading && !(isObj(gatewayReading.document) && 'refused' in gatewayReading.document)
      const gateway: OwnRead['gateway'] = {
        gatewayAdmitted: gatewayAnswered,
        gatewayDoc: gatewayReading?.document ?? null,
        gateway: !gatewayReading
          ? {kind: 'refused', title: 'Gateway · hermes', line: ownerRefusalLine('gateway', refusalLine(gatewayOp.error, 'Harness gateway reading unavailable')), receipt: gatewayOp.error ? safeJson(gatewayOp.error) : null}
          : !gatewayAnswered
            ? {kind: 'refused', title: 'Gateway · hermes', line: ownerRefusalLine('gateway', gatewayLine(gatewayReading.document)), receipt: safeJson(gatewayReading.document)}
            : {kind: 'reading', title: 'Gateway · hermes', line: `binding ${gatewayReading.binding} · ${gatewayLine(gatewayReading.document)}`, receipt: safeJson(gatewayReading.document)},
      }
      if (live) setOwn(previous => ({gateway, gatewayWaiting: gatewayAnswered ? null : OWNER_BINDINGS.gateway.owner, git: previous?.git ?? null}))
      const gitOp = await kernelOp(transport, {op: 'git_repository_read', project: 'O-I'})
      const doc = gitOp.outcome?.result === 'git_repository_reading' ? gitOp.outcome.document : null
      if (live) setOwn(previous => ({gateway, gatewayWaiting: previous?.gatewayWaiting ?? null, git: {doc, error: gitOp.error ?? null}}))
    })()
    return () => { live = false }
  }, [transport, binding])

  const reading = useMemo((): AgentChainReading => {
    if (transport.kind === 'unavailable') {
      const reason = transport.reason ?? 'Transport unavailable'
      return {
        ...INITIAL_READING,
        gateway: {kind: 'refused', title: 'Gateway · hermes', line: ownerRefusalLine('gateway', reason, 'not-reached'), receipt: null},
        gatewayAdmitted: false,
        gatewayDoc: null,
        gitAdmitted: false,
        git: {kind: 'refused', title: 'Git', line: ownerRefusalLine('workcell', reason, 'not-reached'), receipt: null},
        chains: [],
        skillsNote: ownerRefusalLine('roster', reason, 'not-reached'),
        waitingOn: {gateway: OWNER_BINDINGS.gateway.owner, skillset: OWNER_BINDINGS.roster.owner, git: OWNER_BINDINGS.workcell.owner},
      }
    }
    const next: AgentChainReading = {...INITIAL_READING, waitingOn: {...INITIAL_READING.waitingOn}}
    if (own) {
      Object.assign(next, own.gateway)
      next.waitingOn.gateway = own.gatewayWaiting
    }
    // The roster: the shared answer of the root register.
    if (roster.status === 'refused') {
      Object.assign(next, {chains: [], skillsNote: ownerRefusalLine('roster', refusalLine(roster.error ?? undefined, 'Roster reading unavailable')), identity: null})
      next.waitingOn.skillset = OWNER_BINDINGS.roster.owner
    } else if (roster.status === 'answered') {
      const admits = rosterAdmits(roster.value)
      Object.assign(next, {
        chains: rosterChains(roster.value),
        skillsNote: admits > 0
          ? `${admits} accepted agent${admits === 1 ? '' : 's'} with skill refs disclosed.`
          : `No accepted agents with skill refs disclosed yet — waiting on ${OWNER_BINDINGS.skillset.owner}: ${missingOpRemedy('skillset')}.`,
        identity: rosterIdentity(roster.value),
      })
      next.waitingOn.skillset = admits > 0 ? null : OWNER_BINDINGS.skillset.owner
    }
    // The selected session's task record. A refusal or an empty answer says nothing about the agent, so it leaves the light dark
    // rather than off; another session's record is not this one's (the shared answer is keyed by session).
    if (sessionRef && task.status === 'answered' && task.value) {
      const read = taskReading(task.value)
      next.budget = read.used !== undefined || read.cap !== undefined ? {used: read.used, cap: read.cap} : null
      next.autonomy = read.autonomy ?? null
      next.attached = true
    }
    // The seat and the repository: lit once both have answered.
    if (seat.status !== 'reading' && own?.git) {
      const seatDoc = seat.status === 'answered' ? seat.value : null
      const workcellRef = isObj(seatDoc) && typeof seatDoc.workcell_ref === 'string' ? seatDoc.workcell_ref : null
      const seatAnswered = seat.status === 'answered'
      const seatLine = seatAnswered
        ? (workcellRef ? `workcell ${workcellRef}` : 'workcell status answered — no workcell_ref disclosed')
        : ownerRefusalLine('workcell', refusalLine(seat.error ?? undefined, 'Workcell status unavailable'))
      const gitDoc = own.git.doc
      const gitRef = isObj(gitDoc) && typeof gitDoc.repo_root === 'string' ? gitDoc.repo_root : null
      const gitLine = own.git.error
        ? refusalLine(own.git.error, 'git_repository_read unavailable')
        : gitRef ? `repo ${gitRef.split('/').pop() ?? gitRef}` : 'answered — no repo_root disclosed'
      next.gitAdmitted = seatAnswered
      next.gitRepo = gitRepoReading(gitDoc)
      next.git = {
        kind: seatAnswered && !own.git.error ? 'reading' : 'refused',
        title: 'Git',
        line: `${seatLine} · ${gitLine}`,
        receipt: safeJson({seat: seatDoc ?? seat.error ?? null, git: gitDoc ?? own.git.error ?? null}),
      }
      next.waitingOn.git = seatAnswered ? null : OWNER_BINDINGS.workcell.owner
    }
    return next
  }, [transport, own, roster, task, seat, sessionRef])

  return {reading, transport, binding, resolved, harnesses}
}
