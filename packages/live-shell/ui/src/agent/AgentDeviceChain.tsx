import {useEffect, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {useWorkspace} from '../shell/workspaceContext'
import {useAgentShell} from './AgentShellContext'
import {NativeAgentDeviceRack, type DeviceReading} from './NativeAgentDeviceRack'
import {useHarnessBinding} from './useHarnessBinding'
import {refusalLine, safeJson} from './RefusalCard'
import './agentShell.css'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/** Accepted roster agents that carry skill refs — the skillset rack's admit
 * reading (central.agent-profile-roster/v1, never a hardcoded crowd). */
function rosterAdmits(data: unknown): number {
  if (!isObj(data) || !Array.isArray(data.profiles)) return 0
  let count = 0
  for (const entry of data.profiles) {
    if (!isObj(entry) || entry.accepted !== true) continue
    const profile = isObj(entry.profile) ? entry.profile : {}
    if (strings(profile.skill_refs).length > 0) count += 1
  }
  return count
}

/** The first accepted roster identity — the agent face's central identity row. */
function rosterIdentity(data: unknown): string | null {
  if (!isObj(data) || !Array.isArray(data.profiles)) return null
  for (const entry of data.profiles) {
    if (!isObj(entry) || entry.accepted !== true) continue
    const profile = isObj(entry.profile) ? entry.profile : {}
    if (typeof profile.agent_ref === 'string') return profile.agent_ref
  }
  return null
}

/** A short honest line for an answered harness reading: the fields it
 * actually discloses, named — never a JSON dump. */
function gatewayLine(doc: unknown): string {
  if (isObj(doc)) {
    if ('refused' in doc) {
      const reason = isObj(doc.refused) && typeof doc.refused.message === 'string' ? doc.refused.message : undefined
      return `the gateway refused the read${reason ? ` — ${reason}` : ''}`
    }
    const named = ['schema', 'binding', 'state', 'status', 'purpose', 'session_ref']
      .map(key => (typeof doc[key] === 'string' || typeof doc[key] === 'number') ? `${key} ${String(doc[key])}` : null)
      .filter(Boolean)
    if (named.length) return named.join(' · ')
  }
  return 'answered — see the receipt for the full document'
}

/** The device chain: every admit light is a reading — the harness binding for
 * the gateway, the accepted roster for the skillset rack, the workcell status
 * for git, the write arm for the world face. A refused read names itself and
 * carries its receipt folded — never raw JSON on the card surface. */
export function AgentDeviceChain({sessionRef}: {sessionRef: string | null}) {
  const {transport} = useWorkspace()
  const shell = useAgentShell()
  const {binding} = useHarnessBinding(transport)
  const [gateway, setGateway] = useState<DeviceReading>({kind: 'reading', title: 'Gateway · hermes', line: 'Reading gateway…', receipt: null})
  const [git, setGit] = useState<DeviceReading>({kind: 'reading', title: 'Git', line: 'Reading seat…', receipt: null})
  const [gitAdmitted, setGitAdmitted] = useState(false)
  const [skillsAdmitted, setSkillsAdmitted] = useState<number | null>(null)
  const [skillsNote, setSkillsNote] = useState<string | null>('Reading roster…')
  const [identityNote, setIdentityNote] = useState<string | null>(null)
  const [budgetUsed, setBudgetUsed] = useState(0)
  const [budgetCap, setBudgetCap] = useState(12)
  const [autonomy, setAutonomy] = useState('review')

  useEffect(() => {
    let live = true
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) {
          setGateway({kind: 'refused', title: 'Gateway · hermes', line: transport.reason ?? 'Transport unavailable', receipt: null})
          setGitAdmitted(false)
          setGit({kind: 'refused', title: 'Git', line: 'Workcell unavailable', receipt: null})
          setSkillsAdmitted(0)
          setSkillsNote(transport.reason ?? 'Transport unavailable')
        }
        return
      }
      const gatewayOp = await kernelOp(transport, {op: 'harness_agent_read', binding})
      if (live) {
        const gatewayOutcome = gatewayOp.error ? null : gatewayOp.outcome
        const gatewayReading = gatewayOutcome?.result === 'harness_agent_reading' ? gatewayOutcome : null
        if (!gatewayReading) {
          setGateway({kind: 'refused', title: 'Gateway · hermes', line: refusalLine(gatewayOp.error, 'Harness gateway reading unavailable'), receipt: gatewayOp.error ? safeJson(gatewayOp.error) : null})
        } else if (isObj(gatewayReading.document) && 'refused' in gatewayReading.document) {
          setGateway({kind: 'refused', title: 'Gateway · hermes', line: gatewayLine(gatewayReading.document), receipt: safeJson(gatewayReading.document)})
        } else {
          setGateway({kind: 'reading', title: 'Gateway · hermes', line: `binding ${gatewayReading.binding} · ${gatewayLine(gatewayReading.document)}`, receipt: safeJson(gatewayReading.document)})
        }
      }
      const roster = await kernelOp(transport, {op: 'agent_definition', project: null, request: {action: 'roster'}})
      if (live) {
        if (roster.error || roster.outcome?.result !== 'agent_definition_reading') {
          setSkillsAdmitted(0)
          setSkillsNote(refusalLine(roster.error, 'Roster reading unavailable'))
          setIdentityNote(null)
        } else {
          const admits = rosterAdmits(roster.outcome.data)
          setSkillsAdmitted(admits)
          setSkillsNote(admits > 0
            ? `${admits} accepted agent${admits === 1 ? '' : 's'} with skill refs disclosed.`
            : 'No accepted agents with skill refs disclosed yet.')
          setIdentityNote(rosterIdentity(roster.outcome.data))
        }
      }
      if (sessionRef) {
        const task = await kernelOp(transport, {op: 'encounter_task_read', project: 'O-I', agent_session: sessionRef})
        if (live && !task.error && task.outcome?.result === 'encounter_task_reading' && task.outcome.data) {
          const data = task.outcome.data as Record<string, unknown>
          const turns = data.turns as Record<string, unknown> | undefined
          const used = turns?.used ?? data.turns_used
          const cap = turns?.cap ?? data.turn_budget ?? data.budget_cap
          if (typeof used === 'number') setBudgetUsed(used)
          if (typeof cap === 'number') setBudgetCap(cap)
          const custody = data.custody ?? data.autonomy
          if (typeof custody === 'string') setAutonomy(custody)
        }
      }
      const seat = await kernelOp(transport, {op: 'workcell_status_read'})
      const gitOp = await kernelOp(transport, {op: 'git_repository_read', project: 'O-I'})
      const seatOutcome = seat.error ? null : seat.outcome
      const seatReading = seatOutcome?.result === 'workcell_status_reading' ? seatOutcome : null
      if (live) {
        setGitAdmitted(seatReading != null)
        const seatDoc = seatReading?.data
        const workcellRef = isObj(seatDoc) && typeof seatDoc.workcell_ref === 'string' ? seatDoc.workcell_ref : null
        const seatLine = seatReading
          ? (workcellRef ? `workcell ${workcellRef}` : 'workcell status answered — no workcell_ref disclosed')
          : refusalLine(seat.error, 'Workcell status unavailable')
        const gitDoc = gitOp.outcome?.result === 'git_repository_reading' ? gitOp.outcome.document : null
        const gitRef = isObj(gitDoc) && typeof gitDoc.repo_root === 'string' ? gitDoc.repo_root : null
        const gitLine = gitOp.error
          ? refusalLine(gitOp.error, 'git_repository_read unavailable')
          : gitRef ? `repo ${gitRef.split('/').pop() ?? gitRef}` : 'answered — no repo_root disclosed'
        setGit({
          kind: seatReading && !gitOp.error ? 'reading' : 'refused',
          title: 'Git',
          line: `${seatLine} · ${gitLine}`,
          receipt: safeJson({seat: seatDoc ?? seat.error ?? null, git: gitDoc ?? gitOp.error ?? null}),
        })
      }
    })()
    return () => { live = false }
  }, [transport, sessionRef, binding])

  return (
    <div className="agent-device-chain">
      <NativeAgentDeviceRack
        sessionRef={sessionRef}
        gateway={gateway}
        git={git}
        gitAdmitted={gitAdmitted}
        effort={shell.effort}
        budgetUsed={budgetUsed}
        budgetCap={budgetCap}
        autonomy={autonomy}
        skillsAdmitted={skillsAdmitted}
        skillsNote={skillsNote}
        identityNote={identityNote}
      />
    </div>
  )
}
