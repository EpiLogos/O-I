import {useCallback, useEffect, useState} from 'react'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {useWorkspace} from '../shell/workspaceContext'
import {useAgentShell} from './AgentShellContext'
import {NativeAgentDeviceRack, type DeviceReading, type ChainDropTarget} from './NativeAgentDeviceRack'
import {useHarnessBinding} from './useHarnessBinding'
import {harnessAgentControl} from './harnessAgentControl'
import {refusalLine, safeJson, RefusalCard} from './RefusalCard'
import {
  chainDropDecision,
  encodeChainDrag,
  MISSING_OPS,
  type ActiveChainDrag,
} from './agentChainDrag'
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

/** The outcome of one drop attempt: the owner's receipt, or the refusal that
 * names the missing operation. Rendered through the landed disclosure cards —
 * a receipt is a styled note, a refusal is a RefusalCard with the verbatim
 * receipt folded. */
export interface ChainDropOutcome {
  kind: 'receipt' | 'refused'
  title: string
  line: string
  receipt: string | null
}

/** The device chain: every admit light is a reading — the harness binding for
 * the gateway, the accepted roster for the skillset rack, the workcell status
 * for git, the write arm for the world face. A refused read names itself and
 * carries its receipt folded — never raw JSON on the card surface.
 *
 * Drops land here too (the aperture law): every drop resolves through the
 * drag model to ONE declared owner operation — the shell's own session
 * selection, or `harness_agent_control` on the gateway binding — or it
 * refuses with a card naming the exact missing operation. */
export function AgentDeviceChain({sessionRef}: {sessionRef: string | null}) {
  const {transport} = useWorkspace()
  const shell = useAgentShell()
  const {binding} = useHarnessBinding(transport)
  const [dropOutcome, setDropOutcome] = useState<ChainDropOutcome | null>(null)
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

  // One drop, one owner operation (or one named refusal). The session drop
  // rides the run model's own selection — the who slot then reads the new
  // session's task record through the effect above. The agent drop dispatches
  // `harness_agent_control` (new) on the gateway binding, the op the gateway
  // family declares, and folds the owner's outcome document as the receipt.
  // Everything else refuses by name — the dragged item simply returns.
  const attemptDrop = useCallback(async (active: ActiveChainDrag, target: ChainDropTarget) => {
    if (active.kind === 'reorder') {
      setDropOutcome({
        kind: 'refused',
        title: 'Slide refused',
        line: `«${active.reorder.title}» over ${target.label} — the chain composition is declared at the family door (through → who → how → where → lands); no owner operation reorders it — missing op: ${MISSING_OPS.order}`,
        receipt: encodeChainDrag(active.reorder),
      })
      return
    }
    const decision = chainDropDecision(active.drag)
    if (decision.kind === 'missing-op') {
      setDropOutcome({
        kind: 'refused',
        title: 'Drop refused',
        line: `«${active.drag.label}» onto ${target.label} — no owner operation admits it: missing op ${decision.missingOp} — ${decision.because}.`,
        receipt: encodeChainDrag(active.drag),
      })
      return
    }
    if (decision.operation.kind === 'select-session') {
      shell.setSelectedTrackId(active.drag.ref)
      setDropOutcome({
        kind: 'receipt',
        title: 'Chain subject',
        line: `«${active.drag.label}» onto ${target.label} — the who slot reads this session’s task record (encounter_task_read follows the selection).`,
        receipt: null,
      })
      return
    }
    const outcome = await harnessAgentControl(transport, binding, decision.operation.control)
    setDropOutcome(outcome.ok
      ? {
          kind: 'receipt',
          title: 'Agent seat',
          line: `«${active.drag.label}» onto ${target.label} — ${outcome.note}`,
          receipt: outcome.document !== undefined ? safeJson(outcome.document) : null,
        }
      : {
          kind: 'refused',
          title: 'Agent seat refused',
          line: `«${active.drag.label}» onto ${target.label} — harness_agent_control (${decision.operation.control}) answered: ${outcome.error}`,
          receipt: outcome.error,
        })
  }, [shell, transport, binding])

  return (
    <div className="agent-device-chain">
      {dropOutcome && (dropOutcome.kind === 'refused'
        ? <RefusalCard
            title={dropOutcome.title}
            line={dropOutcome.line}
            receipt={dropOutcome.receipt}
            onDismiss={() => setDropOutcome(null)}
            dataI="Drop refusal|The named missing operation: the drop landed nothing, and the dragged item returned."
          />
        : <p className="agent-transport-note" role="status"><b>{dropOutcome.title}</b> — {dropOutcome.line}</p>)}
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
        onDropAttempt={attemptDrop}
      />
    </div>
  )
}
