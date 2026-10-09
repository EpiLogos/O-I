import {useAgentShell, type AgentDeviceId} from './AgentShellContext'
import {agentDataI} from './agentFidelity'
import {agentDeviceCatalogue, type AgentDeviceRow} from '../inhabitants/agentDeviceCatalogue'
import {agentAddressesForDevice, type AgentParamAddress} from '../inhabitants/agentParamAddresses'
import {RefusalCard} from './RefusalCard'
import './agentShell.css'

/** Pool-row hooks keyed like the mockup oracle (`label|function`). */
const POOL_DATA_I = {
  transport: agentDataI('Transport', 'stdio (spawned child, trusted) · ws (token / 30 s ticket at the upgrade) · remote (through Workcell’s address book).'),
  approvals: agentDataI('Approvals', 'Default answer to approval.request: ask you each time · allow for this session · always. Deny is always yours to give.'),
  frameMonitor: agentDataI('Frame monitor', 'Live’s MIDI monitor for agents: every frame the gateway sends or receives, per session, in order. Use it to see exactly what a stalled lane last did.'),
  spend: agentDataI('Spend', 'Where Live’s CPU meter sits: session spend against its cap.'),
  model: agentDataI('Model', 'This session’s model. Subagents can run a different one.'),
  commit: agentDataI('Commit', 'When the agent commits: per turn · per task · manual.'),
  push: agentDataI('Push', 'off · on land.'),
  land: agentDataI('Land', 'Open a draft PR from this branch (checks 2/3 ✓).'),
} as const

const ROW_DATA_I: Partial<Record<string, string>> = {
  transport: POOL_DATA_I.transport,
  approvals: POOL_DATA_I.approvals,
  frames: POOL_DATA_I.frameMonitor,
  spend: POOL_DATA_I.spend,
  model: POOL_DATA_I.model,
  'budget-used': agentDataI('Budget', 'Turns per task.'),
  input: agentDataI('Input', 'Steer the running turn, or queue.'),
  heartbeat: agentDataI('Heartbeat', 'Where Live has the metronome: running agents check in on a cadence. Each check-in moves that thread’s needle in the Arrangement; a needle that stops is a stall.'),
  autonomy: agentDataI('Autonomy', 'Suggest · Review (proposals) · Auto (lands with receipts).'),
  effort: agentDataI('Effort', 'Thinking effort per turn.'),
  'commit-policy': POOL_DATA_I.commit,
  'push-policy': POOL_DATA_I.push,
  land: POOL_DATA_I.land,
}

const ROW_LABELS: Partial<Record<string, string>> = {
  'stall-after': 'Stall-after',
  'budget-used': 'Budget',
  'test-depth': 'Test depth',
  'knowledge-route': 'Knowledge route',
  'write-mode': 'Write mode',
  'write-receipts': 'Receipts',
  'commit-policy': 'Commit',
  'push-policy': 'Push',
}

const rowLabel = (row: AgentParamAddress): string =>
  ROW_LABELS[row.key] ?? row.key.charAt(0).toUpperCase() + row.key.slice(1)

const declared = (row: AgentParamAddress): string => {
  if (row.values) return row.values.join(' · ')
  return row.unit ? `${row.type} · ${row.unit}` : row.type
}

/** Expanded device faces in the pool. Device rows derive from the admitted
 * family manifests (never a hardcoded table); each rendered row is one
 * address from the §14 table, showing its live reading, or its verbatim
 * disclosed absence — spend renders its no-writer line, never a fake fill.
 * Readings sit at the mockup's .row density; refusals render as named cards
 * with the receipt folded, never raw JSON on the surface. */
export function AgentDevicePool({
  gatewayLine,
  gatewayReceipt = null,
  gatewayRefused = true,
  gitLine,
  gitReceipt = null,
  gitRefused = true,
  effort,
  autonomy,
  budgetUsed,
  budgetCap,
  skillsAdmitted = null,
  skillsNote = null,
  identityNote = null,
}: {
  gatewayLine: string
  gatewayReceipt?: string | null
  gatewayRefused?: boolean
  gitLine: string
  gitReceipt?: string | null
  gitRefused?: boolean
  effort: string
  autonomy: string
  budgetUsed: number
  budgetCap: number
  skillsAdmitted?: number | null
  skillsNote?: string | null
  identityNote?: string | null
}) {
  const shell = useAgentShell()
  const devices = agentDeviceCatalogue()
  const selected: AgentDeviceRow | undefined =
    devices.find(item => item.id === shell.expandedDevice) ?? devices[0]
  if (!selected) {
    return (
      <section className="pool agent-device-pool" aria-label="Device pool">
        <div className="poolh"><b>Device pool</b></div>
        <div className="poolb"><p className="agent-disclosed">No families admitted at the door yet.</p></div>
      </section>
    )
  }
  const rows = agentAddressesForDevice(selected.id)
  const reading = (row: AgentParamAddress): string | null => {
    if (selected.id === 'agent') {
      if (row.key === 'effort') return effort
      if (row.key === 'budget-used') return `${budgetUsed} / ${budgetCap}`
      if (row.key === 'input') return shell.steer ? 'steer' : 'queue'
      if (row.key === 'heartbeat') return shell.heartbeat ? 'on' : 'off'
      if (row.key === 'autonomy') return autonomy
      if (row.key === 'identity') return identityNote
    }
    if (selected.id === 'world') {
      if (row.key === 'reads') return 'teal'
      if (row.key === 'writes') return 'amber'
      if (row.key === 'write-mode') return shell.writeArm ? 'direct' : 'propose'
    }
    return null
  }
  return (
    <section className="pool agent-device-pool" aria-label="Device pool">
      <div className="poolh">
        <b>{selected.title}</b>
        <span className="tag">{selected.family}</span>
        <span className="r">
          {devices.map(item => (
            <button
              key={item.id}
              type="button"
              className={'agent-nc' + (item.id === selected.id ? ' on' : '')}
              data-device-pool={item.id}
              data-family={item.family}
              onClick={() => shell.setExpandedDevice(item.id as AgentDeviceId)}
            >
              {item.id}
            </button>
          ))}
        </span>
      </div>
      <div className="poolb">
        {selected.id === 'gateway' && (
          gatewayRefused
            ? <RefusalCard title="Gateway · hermes" line={gatewayLine} receipt={gatewayReceipt} />
            : <ReadingLine title="Gateway · hermes" line={gatewayLine} receipt={gatewayReceipt} />
        )}
        {selected.id === 'skillset' && (
          <p className="agent-disclosed">{skillsNote ?? 'Admit lights follow harness disclosure.'}</p>
        )}
        {selected.id === 'git' && (
          gitRefused
            ? <RefusalCard title="Git" line={gitLine} receipt={gitReceipt} />
            : <ReadingLine title="Git" line={gitLine} receipt={gitReceipt} />
        )}
        {selected.id === 'skillset'
          ? rows.map(row => (
            <label key={`${row.family}.${row.key}`} className="agent-pool-row" data-family={row.family}>
              <span>{rowLabel(row)}</span>
              <span className="agent-disclosed">{(skillsAdmitted ?? 0) > 0 ? 'admitted' : 'not admitted'}</span>
            </label>
          ))
          : rows.map(row => {
            const value = reading(row)
            return (
              <div key={`${row.family}.${row.key}`} className="agent-row" data-family={row.family} data-i={ROW_DATA_I[row.key]} title={ROW_DATA_I[row.key]}>
                <span className="k">{rowLabel(row)}</span>
                {value != null
                  ? <output>{value}</output>
                  : row.disclosure
                    ? <span className="agent-disclosed">{row.disclosure}</span>
                    : <span style={{color: 'var(--text-dim)', fontSize: 10.5}}>{declared(row)}</span>}
              </div>
            )
          })}
        {selected.id === 'gateway' && (
          <details className="agent-fold">
            <summary>Details</summary>
            <div className="agent-kv"><span>Protocol</span><span>JSON-RPC / NDJSON</span></div>
            <div className="agent-kv"><span>Connect</span><span>attaches this session’s harness; detached sessions keep running and re-attach with session.resume</span></div>
            <div className="agent-kv"><span>Frames</span><span>the Frames dock tile is the frame monitor</span></div>
          </details>
        )}
      </div>
    </section>
  )
}

/** An answered reading in the pool: one styled line + folded receipt. */
function ReadingLine({title, line, receipt}: {title: string; line: string; receipt: string | null}) {
  return (
    <section className="agent-refusal answered" style={{borderColor: 'var(--line-strong)', background: 'var(--bg-2)'}} role="note">
      <div className="agent-refusal-row">
        <b style={{color: 'var(--text)'}}>{title}</b>
        <span className="line">{line}</span>
      </div>
      {receipt != null && (
        <details>
          <summary>Receipt</summary>
          <pre>{receipt}</pre>
        </details>
      )}
    </section>
  )
}
