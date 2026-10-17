import {useAgentShell, type AgentDeviceId} from './AgentShellContext'
import {agentDataI} from './agentFidelity'
import {agentDeviceCatalogue, type AgentDeviceRow} from '../inhabitants/agentDeviceCatalogue'
import {agentAddressesForDevice, type AgentParamAddress} from '../inhabitants/agentParamAddresses'
import {RefusalCard} from './RefusalCard'
import './agentShell.css'

/** Pool-row hooks keyed like the mockup oracle (`label|function`): the git seat's rows. */
const POOL_DATA_I = {
  commit: agentDataI('Commit', 'When the agent commits: per turn · per task · manual.'),
  push: agentDataI('Push', 'off · on land.'),
  land: agentDataI('Land', 'Open a draft PR from this branch (checks 2/3 ✓).'),
} as const

const ROW_DATA_I: Partial<Record<string, string>> = {
  'commit-policy': POOL_DATA_I.commit,
  'push-policy': POOL_DATA_I.push,
  land: POOL_DATA_I.land,
}

const ROW_LABELS: Partial<Record<string, string>> = {
  'commit-policy': 'Commit',
  'push-policy': 'Push',
}

const rowLabel = (row: AgentParamAddress): string =>
  ROW_LABELS[row.key] ?? row.key.charAt(0).toUpperCase() + row.key.slice(1)

const declared = (row: AgentParamAddress): string => {
  if (row.values) return row.values.join(' · ')
  return row.unit ? `${row.type} · ${row.unit}` : row.type
}

/** The devices the runtime's own pool draws whole (frame/devices/DevicePool.tsx: the device last chosen on the chain, on the binding
 * its chain plate reads): the Gateway, the Agent, the Skillset rack and Scope, by their catalogue designs once bound to their
 * owners (devices/designBindings.ts), else the generic plate of the owner's rows with the device's own picture (the gateway's
 * refusal card among it). Their text cards here read the shell's own defaults as values (effort "high", budget "0 / 12", autonomy
 * from the steer flag, reads "teal" and writes "amber") or repeated the chain's gateway read, and are gone (lane BF). */
export const POOL_DRAWN_BY_RUNTIME: ReadonlySet<string> = new Set(['gateway', 'agent', 'skillset', 'world'])

/** Expanded device faces in the pool, for the chain devices the runtime's pool does not draw yet (the git seat).
 * Device rows derive from the admitted family manifests (never a hardcoded table); each rendered row is one address from the §14
 * table with its verbatim disclosed absence — spend renders its no-writer line, never a fake fill. Refusals render as named cards
 * with the receipt folded, never raw JSON on the surface. */
export function AgentDevicePool({
  gitLine,
  gitReceipt = null,
  gitRefused = true,
}: {
  gitLine: string
  gitReceipt?: string | null
  gitRefused?: boolean
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
  if (POOL_DRAWN_BY_RUNTIME.has(selected.id)) return null
  const rows = agentAddressesForDevice(selected.id)
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
        {selected.id === 'git' && (
          gitRefused
            ? <RefusalCard title="Git" line={gitLine} receipt={gitReceipt} />
            : <ReadingLine title="Git" line={gitLine} receipt={gitReceipt} />
        )}
        {rows.map(row => (
          <div key={`${row.family}.${row.key}`} className="agent-row" data-family={row.family} data-i={ROW_DATA_I[row.key]} title={ROW_DATA_I[row.key]}>
            <span className="k">{rowLabel(row)}</span>
            {row.disclosure
              ? <span className="agent-disclosed">{row.disclosure}</span>
              : <span style={{color: 'var(--text-dim)', fontSize: 10.5}}>{declared(row)}</span>}
          </div>
        ))}
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
