import {useEffect, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {useWorkspace} from '../shell/workspaceContext'
import {useAgentShell} from './AgentShellContext'
import {NativeAgentDeviceRack} from './NativeAgentDeviceRack'
import {useHarnessBinding} from './useHarnessBinding'
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

/** The device chain: every admit light is a reading — the harness binding for
 * the gateway, the accepted roster for the skillset rack, the workcell status
 * for git, the write arm for the world face. A refused read names itself. */
export function AgentDeviceChain({sessionRef}: {sessionRef: string | null}) {
  const {transport} = useWorkspace()
  const shell = useAgentShell()
  const {binding} = useHarnessBinding(transport)
  const [gatewayNote, setGatewayNote] = useState('Reading gateway…')
  const [gatewayAdmitted, setGatewayAdmitted] = useState(false)
  const [gitNote, setGitNote] = useState('Reading seat…')
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
          setGatewayNote(transport.reason ?? 'Transport unavailable')
          setGatewayAdmitted(false)
          setGitNote('Workcell unavailable')
          setGitAdmitted(false)
          setSkillsAdmitted(0)
          setSkillsNote(transport.reason ?? 'Transport unavailable')
        }
        return
      }
      const gateway = await kernelOp(transport, {op: 'harness_agent_read', binding})
      if (live) {
        const gatewayOutcome = gateway.error ? null : gateway.outcome
        const gatewayReading = gatewayOutcome?.result === 'harness_agent_reading' ? gatewayOutcome : null
        setGatewayAdmitted(gatewayReading != null)
        if (!gatewayReading) {
          setGatewayNote(gateway.error ?? 'Harness gateway reading unavailable')
        } else {
          const doc = gatewayReading.document
          setGatewayNote(isObj(doc) && 'refused' in doc
            ? `Gateway refused: ${JSON.stringify(doc).slice(0, 160)}`
            : `Binding ${gatewayReading.binding}: ${JSON.stringify(doc).slice(0, 200)}`)
        }
      }
      const roster = await kernelOp(transport, {op: 'agent_definition', project: null, request: {action: 'roster'}})
      if (live) {
        if (roster.error || roster.outcome?.result !== 'agent_definition_reading') {
          setSkillsAdmitted(0)
          setSkillsNote(roster.error ?? 'Roster reading unavailable')
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
      const git = await kernelOp(transport, {op: 'git_repository_read', project: 'O-I'})
      const seatOutcome = seat.error ? null : seat.outcome
      const seatReading = seatOutcome?.result === 'workcell_status_reading' ? seatOutcome : null
      if (live) {
        setGitAdmitted(seatReading != null)
        const seatText = seatReading
          ? JSON.stringify(seatReading.data).slice(0, 120)
          : seat.error ?? 'Workcell status unavailable'
        const gitText = git.error
          ? git.error
          : JSON.stringify(git.outcome?.result === 'git_repository_reading' ? git.outcome.document : git.outcome).slice(0, 120)
        setGitNote(`${seatText} · ${gitText}`)
      }
    })()
    return () => { live = false }
  }, [transport, sessionRef, binding])

  return (
    <div className="agent-device-chain">
      <NativeAgentDeviceRack
        sessionRef={sessionRef}
        gatewayNote={gatewayNote}
        gatewayAdmitted={gatewayAdmitted}
        gitNote={gitNote}
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
