import {useAgentShell, type AgentDeviceId} from './AgentShellContext'
import {agentDataI} from './agentFidelity'
import {agentDeviceCatalogue} from '../inhabitants/agentDeviceCatalogue'
import './agentShell.css'

/** Device control hooks keyed like the mockup oracle (`label|function`).
 * AGENT_DATA_I carries the transport controls; these are the device controls,
 * worded exactly as the mockup oracle states them. */
const DEVICE_DATA_I = {
  gatewayChain: agentDataI('Gateway (folded)', 'This session rides its lead’s Hermes gateway connection.'),
  gateway: agentDataI('Gateway · hermes', 'Where the session runs: the harness connection (Hermes tui_gateway, JSON-RPC over stdio or WebSocket). Frames flow along the link; the ring is the replay buffer; the outer pulse is the heartbeat.'),
  agentFace: agentDataI('Agent · agent', 'Compact. Click: expand in the pool. ↗: open its thread full.'),
  power: agentDataI('Power', 'The agent on, or benched.'),
  autonomy: agentDataI('Autonomy', 'Suggest · Review (proposals) · Auto (lands with receipts).'),
  effort: agentDataI('Effort', 'Thinking effort per turn.'),
  budget: agentDataI('Budget', 'Turns per task.'),
  input: agentDataI('Input', 'Steer the running turn, or queue.'),
  skillset: agentDataI('Skillset rack', 'Skills as chains (light = admitted); macros steer several at once.'),
  world: agentDataI('World · bridge', 'What the session may read (teal) and write (amber).'),
  git: agentDataI('Git', 'The session’s repository seat. The diagram is the branch against main; the pulsing hollow dot is uncommitted work.'),
} as const

/** Compact device faces on the chain (mockup tier). Everything rendered is
 * derived: the device list from the admitted family manifests, the admit
 * lights from real readings (harness binding, roster, workcell status, the
 * write arm), the SVG from oracle tokens. A light the reading has not earned
 * stays dark — hardcoded `is-on` is forbidden here. */
export function NativeAgentDeviceRack({
  sessionRef,
  gatewayNote,
  gitNote,
  effort,
  autonomy = 'review',
  budgetUsed = 0,
  budgetCap = 12,
  gatewayAdmitted = false,
  gitAdmitted = false,
  skillsAdmitted = null,
  skillsNote = null,
  identityNote = null,
}: {
  sessionRef: string | null
  gatewayNote: string
  gitNote: string
  effort: string
  autonomy?: string
  budgetUsed?: number
  budgetCap?: number
  /** Readings: harness binding present; workcell status read; roster admits. */
  gatewayAdmitted?: boolean
  gitAdmitted?: boolean
  skillsAdmitted?: number | null
  skillsNote?: string | null
  /** Central identity row: the first accepted roster agent ref, or null. */
  identityNote?: string | null
}) {
  const ticks = Math.max(budgetCap, 1)
  const used = Math.min(budgetUsed, ticks)
  const shell = useAgentShell()
  const open = (id: AgentDeviceId) => shell.setExpandedDevice(id)
  const devices = agentDeviceCatalogue()
  const writeMode = shell.writeArm ? 'direct' : 'propose'
  const light = (on: boolean) => `native-chain-light${on ? ' is-on' : ''}`
  return (
    <div className="native-agent-rack" aria-label="Agent device chain" data-region="device-chain">
      {devices.map(device => {
        const head = (on: boolean, dataI: string) => (
          <header className="native-chain-head">
            <span className={light(on)} data-i={dataI} aria-label={on ? 'admitted' : 'not admitted'} />
            <span>{device.title}</span>
          </header>
        )
        if (device.id === 'gateway') {
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id} data-i={DEVICE_DATA_I.gatewayChain} onClick={() => open('gateway')}>
              {head(gatewayAdmitted, DEVICE_DATA_I.gateway)}
              <p className="agent-disclosed">{gatewayNote}</p>
            </article>
          )
        }
        if (device.id === 'agent') {
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id} data-i={DEVICE_DATA_I.agentFace} onClick={() => open('agent')}>
              {head(sessionRef != null, DEVICE_DATA_I.power)}
              <div className="agent-turn-ring" aria-label="Turn budget ring">
                <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="var(--line)" strokeWidth="3" />
                  {Array.from({length: ticks}, (_, index) => {
                    const angle = (index / ticks) * Math.PI * 2 - Math.PI / 2
                    const x = 24 + Math.cos(angle) * 16
                    const y = 24 + Math.sin(angle) * 16
                    return <circle key={index} cx={x} cy={y} r="2.5" fill={index < used ? 'var(--accent)' : 'var(--bg-3)'} />
                  })}
                </svg>
              </div>
              <div className="agent-knobs">
                <label title={DEVICE_DATA_I.autonomy} data-i={DEVICE_DATA_I.autonomy}><span>Autonomy</span><output>{autonomy}</output></label>
                <label title={DEVICE_DATA_I.effort} data-i={DEVICE_DATA_I.effort}><span>Effort</span><output>{effort}</output></label>
                <label title={DEVICE_DATA_I.budget} data-i={DEVICE_DATA_I.budget}><span>Budget</span><output>{used} / {budgetCap}</output></label>
                <label title={DEVICE_DATA_I.input} data-i={DEVICE_DATA_I.input}><span>Input</span><output>{shell.steer ? 'steer' : 'queue'}</output></label>
              </div>
              {identityNote && <p className="agent-disclosed">{identityNote}</p>}
            </article>
          )
        }
        if (device.id === 'skillset') {
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id} data-i={DEVICE_DATA_I.skillset} onClick={() => open('skillset')}>
              {head((skillsAdmitted ?? 0) > 0, DEVICE_DATA_I.skillset)}
              <p className="agent-disclosed">
                {skillsNote ?? `Admit lights follow harness disclosure for ${sessionRef ?? 'selected session'}.`}
              </p>
            </article>
          )
        }
        if (device.id === 'world') {
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id} data-i={DEVICE_DATA_I.world} onClick={() => open('world')}>
              {head(shell.writeArm, DEVICE_DATA_I.world)}
              <p>Reads · writes · <output>{writeMode}</output></p>
            </article>
          )
        }
        if (device.id === 'git') {
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id} data-i={DEVICE_DATA_I.git} onClick={() => open('git')}>
              {head(gitAdmitted, DEVICE_DATA_I.git)}
              <p className="agent-disclosed">{gitNote}</p>
            </article>
          )
        }
        return null
      })}
    </div>
  )
}
