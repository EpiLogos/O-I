import {useState, type ReactElement} from 'react'
import {CutIcon, CutKnob, FoldChevron, PopGlyph, SkillMark} from './agentIcons'
import {maskStatic} from './maskFace'
import {useAgentShell, type AgentDeviceId, EFFORT_STEPS} from './AgentShellContext'
import {agentDataI} from './agentFidelity'
import {agentDeviceCatalogue} from '../inhabitants/agentDeviceCatalogue'

/** The chain card's honest reason in one styled line (mockup §3.7 density);
 * the full refusal card with its receipt lives in the pool. */
function InlineNote({kind, title, line}: {kind: 'reading' | 'refused'; title: string; line: string}) {
  return kind === 'refused'
    ? <p className="agent-refusal-inline"><b>{title}</b>{line}</p>
    : <p className="agent-reading-inline"><b>{title}</b>{line}</p>
}
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
  dropZone: agentDataI('Drop zone', 'Gateways, agents, skillsets, worlds, git. Left to right: through → who → how → where → lands.'),
} as const

/** One device's owner reading, structured: what the card's light and one
 * styled line say, with the verbatim receipt folded. */
export interface DeviceReading {
  kind: 'reading' | 'refused'
  title: string
  line: string
  receipt: string | null
}

/** The autonomy knob's 0–1 placement over its three declared steps. */
const AUTONOMY_STEPS = ['suggest', 'review', 'auto'] as const
const autonomyValue = (word: string): number => {
  const i = AUTONOMY_STEPS.indexOf(word.toLowerCase() as typeof AUTONOMY_STEPS[number])
  return i < 0 ? AUTONOMY_STEPS.indexOf('review') / 2 : i / 2
}

/** Compact device faces on the chain (mockup tier), at the icon specimen's
 * anatomy: power lamp, name, owner line, fold/pop chevrons, a visual, knobs
 * and toggles. Everything rendered is derived: the device list from the
 * admitted family manifests, the lights from real readings, the face from
 * the specimen's panel mask. A light the reading has not earned stays dark —
 * hardcoded `is-on` is forbidden here. */
export function NativeAgentDeviceRack({
  sessionRef,
  gateway,
  git,
  effort,
  autonomy = 'review',
  budgetUsed = 0,
  budgetCap = 12,
  gatewayAdmitted = true,
  gitAdmitted = false,
  skillsAdmitted = null,
  skillsNote = null,
  identityNote = null,
}: {
  sessionRef: string | null
  gateway: DeviceReading
  git: DeviceReading
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
  const [folded, setFolded] = useState<Partial<Record<AgentDeviceId, boolean>>>({})
  const open = (id: AgentDeviceId) => shell.setExpandedDevice(id)
  const devices = agentDeviceCatalogue()
  const writeMode = shell.writeArm ? 'direct' : 'propose'
  const fold = (id: AgentDeviceId, current: boolean) => {
    setFolded(state => ({...state, [id]: !current}))
  }
  const head = (id: AgentDeviceId, on: boolean, icon: ReactElement | null, title: string, own: string, pop?: () => void) => (
    <header className="dh">
      <span className={'pw' + (on ? '' : ' off')} data-i={DEVICE_DATA_I.power} aria-label={on ? 'admitted' : 'not admitted'} />
      {icon}
      <b>{title}</b>
      <span className="own">{own}</span>
      <span className="x">
        {pop && (
          <span
            role="button" tabIndex={0} data-i="Open thread|Open this session’s thread in the main space."
            title="Open full"
            onClick={() => pop()}
            onKeyDown={event => { if (event.key === 'Enter') pop() }}
          ><PopGlyph /></span>
        )}
        <span role="button" tabIndex={0} title="Fold" onClick={() => fold(id, !!folded[id])}
          onKeyDown={event => { if (event.key === 'Enter') fold(id, !!folded[id]) }}><FoldChevron /></span>
      </span>
    </header>
  )

  return (
    <div className="native-agent-rack" aria-label="Agent device chain" data-region="device-chain">
      {devices.map(device => {
        if (folded[device.id as AgentDeviceId]) {
          return (
            <article
              key={device.id}
              className="agent-device folded"
              data-family={device.family} data-device={device.id}
              data-i={DEVICE_DATA_I.gatewayChain}
              onClick={() => fold(device.id as AgentDeviceId, true)}
            >
              <header className="dh"><span className="pw off" />{device.title}</header>
            </article>
          )
        }
        if (device.id === 'gateway') {
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id}
              style={{width: 262}} data-i={DEVICE_DATA_I.gateway} onClick={() => open('gateway')}>
              {head('gateway', gatewayAdmitted, <CutIcon name="link" size={11} />, 'Gateway', gatewayAdmitted ? 'harness binding' : 'unadmitted', () => shell.toggleTile('frames'))}
              <div className="db">
                <div className="vis" style={{width: 96, height: 88}}>
                  <svg width="96" height="88" viewBox="0 0 96 88" aria-hidden>
                    <rect x="6" y="34" width="24" height="20" rx="3" fill="none" stroke="var(--line-strong)" />
                    <text x="18" y="47" textAnchor="middle" fontSize="8" fill="var(--text-dim)">shell</text>
                    <line x1="30" y1="44" x2="66" y2="44" stroke="var(--line-strong)" strokeWidth="2" />
                    <text x="81" y="47" textAnchor="middle" fontSize="8" fill="var(--text)">gw</text>
                    <circle cx="48" cy="44" r="2.4" fill={gateway.kind === 'refused' ? 'var(--stall)' : 'var(--sel)'} />
                    <text x="48" y="76" textAnchor="middle" fontSize="8" fill="var(--text-faint)" fontFamily="var(--mono)">frames tile ↗</text>
                  </svg>
                </div>
                <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4}}>
                  <InlineNote kind={gateway.kind} title={gateway.kind === 'refused' ? 'Refused' : 'Read'} line={gateway.line} />
                  <div className="agent-kv"><span>Transport</span><span>stdio · ws · remote</span></div>
                  <div className="agent-kv"><span>Approvals</span><span>ask · session · always</span></div>
                </div>
              </div>
            </article>
          )
        }
        if (device.id === 'agent') {
          const effortValue = Math.max(0, EFFORT_STEPS.indexOf(effort as (typeof EFFORT_STEPS)[number])) / (EFFORT_STEPS.length - 1)
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id}
              style={{width: 268}} data-i={DEVICE_DATA_I.agentFace} onClick={() => open('agent')}>
              {head('agent', sessionRef != null, null, 'Agent', sessionRef != null ? 'session attached' : 'no session', () => shell.openThread(sessionRef))}
              <div className="db">
                <div className="vis" style={{width: 96, height: 118}}>
                  <span
                    style={{display: 'inline-flex', lineHeight: 0}}
                    dangerouslySetInnerHTML={{__html: maskStatic('think', '#5cc6b4', '#5cc6b4', 84, '#26292d')}}
                  />
                  <div className="agent-kv" style={{position: 'absolute', bottom: 3, left: 0, right: 0, padding: 0, justifyContent: 'center'}}>
                    <span style={{gridColumn: '1 / 3', textAlign: 'center'}}>{used}/{budgetCap} · {sessionRef != null ? 'attached' : 'unselected'}</span>
                  </div>
                </div>
                <div className="agent-knobs" data-i={DEVICE_DATA_I.autonomy}>
                  <span className="agent-knob" data-i={DEVICE_DATA_I.autonomy}>
                    <CutKnob value={autonomyValue(autonomy)} color="var(--fizz)" />
                    <span className="kl">Autonomy</span><span className="kv">{autonomy}</span>
                  </span>
                  <span className="agent-knob" data-i={DEVICE_DATA_I.effort}>
                    <CutKnob value={effortValue} color="var(--fizz)" />
                    <span className="kl">Effort</span><span className="kv">{effort}</span>
                  </span>
                  <span className="agent-knob" data-i={DEVICE_DATA_I.budget}>
                    <CutKnob value={Math.min(1, budgetCap / 24)} color="var(--fizz)" />
                    <span className="kl">Budget</span><span className="kv">{used}/{budgetCap}</span>
                  </span>
                  <span className="agent-tog" data-i={DEVICE_DATA_I.input}>
                    <span className="kl">Input</span>
                    <span className="tg">
                      <span className={shell.steer ? 'on' : ''} role="button" tabIndex={0}
                        onClick={event => { event.stopPropagation(); if (!shell.steer) shell.setSteer(true) }}>steer</span>
                      <span className={shell.steer ? '' : 'on'} role="button" tabIndex={0}
                        onClick={event => { event.stopPropagation(); if (shell.steer) shell.setSteer(false) }}>queue</span>
                    </span>
                  </span>
                </div>
              </div>
            </article>
          )
        }
        if (device.id === 'skillset') {
          const admitted = (skillsAdmitted ?? 0) > 0
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id}
              style={{width: 236}} data-i={DEVICE_DATA_I.skillset} onClick={() => open('skillset')}>
              {head('skillset', admitted, <SkillMark kind="skillset" size={14} />, 'Skillsets', `${skillsAdmitted ?? 0} with refs`)}
              <div className="db" style={{flexDirection: 'column', gap: 4}}>
                <div className="agent-chainrow">
                  <SkillMark kind="skill" size={14} state={admitted ? 'whole' : 'outline'} />
                  <span style={{flex: 1, overflow: 'hidden', textOverflow: 'ellipsis'}}>accepted roster profiles</span>
                  <span className={'lt' + (admitted ? '' : ' offc')} style={admitted ? {} : {background: 'var(--bg-0)', border: '1px solid var(--text-faint)'}} />
                </div>
                {skillsNote && <p className="agent-disclosed" style={{margin: 0}}>{skillsNote}</p>}
                {identityNote && <div className="agent-kv" style={{padding: 0}}><span>identity</span><span>{identityNote}</span></div>}
              </div>
            </article>
          )
        }
        if (device.id === 'world') {
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id}
              style={{width: 212}} data-i={DEVICE_DATA_I.world} onClick={() => open('world')}>
              {head('world', shell.writeArm, <CutIcon name="form" size={11} />, 'World', 'scope rings')}
              <div className="db">
                <div className="vis" style={{width: 72, height: 72}}>
                  <svg width="72" height="72" viewBox="0 0 84 84" aria-hidden>
                    <circle cx="42" cy="42" r="34" fill="none" stroke="var(--line-strong)" strokeDasharray="2 3" />
                    <circle cx="42" cy="42" r="23" fill="none" stroke="var(--text-faint)" />
                    <circle cx="42" cy="42" r="12" fill="none" stroke="var(--text-dim)" />
                    <path d="M42 20A22 22 0 1 1 22 56" fill="none" stroke="var(--fizz)" strokeWidth="4" strokeOpacity=".75" />
                    <path d="M42 31A11 11 0 0 1 52 46" fill="none" stroke="var(--honey)" strokeWidth="4" />
                  </svg>
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center'}}>
                  <span className="agent-tog" data-i="Write mode|propose · draft · direct (direct needs Write arm).">
                    <span className="kl">Writes</span>
                    <span className="tg">
                      <span className={shell.writeArm ? '' : 'on'} role="button" tabIndex={0}
                        onClick={event => { event.stopPropagation(); if (shell.writeArm) shell.setWriteArm(false) }}>prop</span>
                      <span className={shell.writeArm ? 'on' : ''} role="button" tabIndex={0}
                        onClick={event => { event.stopPropagation(); if (!shell.writeArm) shell.setWriteArm(true) }}>dir</span>
                    </span>
                  </span>
                  <span className="agent-disclosed">mode {writeMode}</span>
                </div>
              </div>
            </article>
          )
        }
        if (device.id === 'git') {
          return (
            <article key={device.id} className="agent-device agent-device-compact" data-family={device.family} data-device={device.id}
              style={{width: 240}} data-i={DEVICE_DATA_I.git} onClick={() => open('git')}>
              {head('git', gitAdmitted, <CutIcon name="chain" size={11} />, 'Git', gitAdmitted ? 'seat read' : 'unadmitted')}
              <div className="db" style={{flexDirection: 'column', gap: 4}}>
                <InlineNote kind={git.kind} title={git.kind === 'refused' ? 'Refused' : 'Seat'} line={git.line} />
                <div className="agent-kv" style={{padding: 0}}><span>Commit</span><span>turn · task · man</span></div>
                <div className="agent-kv" style={{padding: 0}}><span>Push</span><span>off · on land</span></div>
              </div>
            </article>
          )
        }
        return null
      })}
      <div className="agent-dropz" data-i={DEVICE_DATA_I.dropZone} title={DEVICE_DATA_I.dropZone.split('|')[1]}>
        Drop gateways, agents, skillsets, worlds or git here
      </div>
    </div>
  )
}
