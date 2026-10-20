// The Agency gateway (manual §19.10, ai-kit:agency-gateway): the service that carries messages to agents from the surfaces you use,
// and from one agent to another, under rules you set. Live's nearest: Utility — a small effect of few controls whose meaning is
// plain at a glance. The well is the gateway's own ecology: the surfaces (connectors) on the left, the gateway in the middle, the
// agents on the right. A dot beside an agent is a message that waits for it; the rung that joins the agents is the rule for a call
// from one agent to another; the scale under the picture is how far the gateway can be reached.
//
// Value keys. The owner writes (AIKit `aikit gateway`, crates/aikit-cli/src/cli.rs:166x GatewaySub):
//   service (bool: serve · install-service · uninstall-service, shutdown), entry (local-ipc · loopback-service · private-tailnet ·
//   tailscale-serve · ssh-tunnel: `gateway setup --mode`, gateway_modes.rs:63 ENTRY_MODES, plan-first), coexist (bool: `gateway
//   coexistence --policy coexist|exclusive`, cli.rs:2567), on:<surface id> (bool: `gateway connector add` with or without --disable),
//   agentPolicy (allow · pair · deny: GatewayIngressDecision, gateway_runtime.rs:106; the owner has no write for the sender kind agent yet).
// The shell holds:  entryPending (an entry that waits for Confirm).
// The owner reports (never written from here):
//   light (lit · dark: the gateway answered), state (ready · composed · refused: the standing of the entry, gateway_modes.rs:38),
//   refused (the owner's reason when nothing answers), reach, signIn, secrecy (the entry's terms, EntryMode), keptBy (foreground ·
//   supervised-launchd · supervised-systemd · application: LifecycleMode), inbox (messages that wait: `gateway who` communiques.undelivered),
//   surfaces (JSON list of {id, name, platform?, health?, enabled?, ingress?, detail?}: ConnectorHealth, gateway_connector.rs:448, and the
//   ecology's ingress_default), agents (JSON list of {id, name, presence?, waiting?}: `gateway who`), harnesses (JSON list of {name,
//   evidence?}: `gateway coexistence`), peers (JSON list of {workcell, endpoint?, kind?, reachable?}: `gateway modes` this_machine.peers),
//   passed (JSON list of {at, from, to, via, standing, why?}: the Communique journal, CommuniqueState, gateway_communique.rs:43).
// A key the owner has not reported is absent, and the view draws "—" for it, and names it in the well.
import {useState} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {boolOf, clampTo, has, json, NONE, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './ai-kit__agency-gateway.css'

type V = ViewProps['v']
type State = 'ready' | 'composed' | 'refused'
type Health = 'connected' | 'connecting' | 'degraded' | 'reconnecting' | 'disconnected' | 'unavailable' | 'closed'
type Presence = 'embodied-here' | 'embodied-elsewhere' | 'not-currently-embodied' | 'unavailable'

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

/** The entries a person can choose, in the owner's order (gateway_modes.rs ENTRY_MODES). An open remote endpoint is Refused by default and a public Funnel is never set, so neither is on the scale. */
const ENTRIES: readonly Option<string>[] = [
  {value: 'local-ipc', label: 'Local IPC', does: 'A socket in the home folder. Only local processes that the file mode admits can reach the gateway.'},
  {value: 'loopback-service', label: 'Loopback', does: 'A port on this machine. Any local process with a token, and local browsers, can reach the gateway.'},
  {value: 'private-tailnet', label: 'Private tailnet', does: 'The tailnet address. Machines that the tailnet policy admits, with a token, can reach the gateway.'},
  {value: 'tailscale-serve', label: 'Tailscale Serve', does: 'A loopback port behind a private Tailscale forward. Tailnet machines with a token can reach the gateway.'},
  {value: 'ssh-tunnel', label: 'SSH tunnel', does: 'A tunnel from another machine. Whoever can log in to the far machine, with a token, can reach the gateway.'},
]
const ENTRY_TICK = ['local', 'loop', 'tailnet', 'serve', 'ssh'] as const
const ENTRY_DEFAULT = 'local-ipc'

/** How an agent may call another: the owner's three ingress decisions (GatewayIngressDecision). The owner's word for Ask is pair. */
const POLICY: readonly Option<string>[] = [
  {value: 'allow', label: 'Allow', does: 'A call from one agent to another goes through at once.'},
  {value: 'pair', label: 'Ask', does: 'A call waits in Approvals until you approve the sender.'},
  {value: 'deny', label: 'Deny', does: 'A call from one agent to another is refused, with a reason.'},
]
const POLICY_TICK = ['allow', 'ask', 'deny'] as const
const POLICY_DEFAULT = 'pair'

/** The standing of the entry, in AIKit's words. Ready is a gateway that answered a read (the Gateways rack uses the same three). */
const STATE_WORD: Record<State, string> = {ready: 'Ready', composed: 'Composed', refused: 'Refused'}
const STATE_SAYS: Record<State, string> = {
  ready: 'Ready: the gateway answered a read.',
  composed: 'Composed: nobody has tried the entry end to end.',
  refused: 'Refused: the owner refuses this entry.',
}
const HEALTH_WORD: Record<Health, string> = {
  connected: 'Connected', connecting: 'Connecting', degraded: 'Degraded', reconnecting: 'Reconnecting', disconnected: 'Disconnected', unavailable: 'Unavailable', closed: 'Closed',
}
const PRESENCE_WORD: Record<Presence, string> = {'embodied-here': 'seated here', 'embodied-elsewhere': 'seated elsewhere', 'not-currently-embodied': 'not seated', unavailable: 'unavailable'}
const KEPT_WORD: Record<string, string> = {foreground: 'terminal', 'supervised-launchd': 'launchd', 'supervised-systemd': 'systemd', application: 'app'}
const INGRESS_WORD: Record<string, string> = {allow: 'allow', pair: 'ask', deny: 'deny'}
const INGRESS_SAYS: Record<string, string> = {allow: 'A new sender is admitted at once.', pair: 'A new sender waits for your approval.', deny: 'A new sender is refused.'}
const STANDING_SAYS: Record<string, string> = {
  delivered: 'The agent took the message at a turn boundary.',
  pending: 'The agent stands somewhere. It takes the message at its next turn boundary.',
  held: 'Nobody sits in the place. The next agent to sit there takes the message.',
  escalated: 'The message crossed into work that someone is accountable for.',
  pairing: 'The sender is not approved yet. The call waits for you.',
  denied: 'The rule refused the call.',
}
const WAITING = ['pending', 'held'], REFUSED = ['pairing', 'denied']

const SAYS = {
  service: 'Start or stop the gateway service. A stopped gateway carries no message; the agents keep their work.',
  coexist: 'On: start beside the harness gateways found here. Off: hold the connectors that a found gateway owns. AIKit never changes a found gateway.',
  entry: 'Who can reach the gateway, and how. A change waits for Confirm, because it rebinds the listener.',
  policy: 'Whether one agent may call another. Ask holds the call in Approvals until you approve the sender.',
  surfaces: 'The places that may send a message to an agent. The square is your request to run the connector; the light is its health.',
}

// ---------------------------------------------------------------- readings

const text = (x: unknown) => (typeof x === 'string' && x.length > 0 ? x : undefined)
const records = (v: V, key: string): Record<string, unknown>[] => {
  const raw = json<unknown>(v, key, [])
  return Array.isArray(raw) ? raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []
}
const oneOf = <T extends string>(x: unknown, list: readonly T[]): T | undefined => (typeof x === 'string' && (list as readonly string[]).includes(x) ? (x as T) : undefined)

interface Surface {readonly id: string; readonly name: string; readonly platform?: string; readonly health?: Health; readonly enabled?: boolean; readonly ingress?: string; readonly detail?: string}
const HEALTHS = Object.keys(HEALTH_WORD) as Health[]
/** The surfaces the owner reports, kept only where they have a shape. Nothing in a bad list can throw. */
const surfacesOf = (v: V): Surface[] => records(v, 'surfaces').flatMap((r): Surface[] => {
  const id = text(r.id), name = text(r.name)
  if (!id || !name) return []
  return [{id, name, platform: text(r.platform), health: oneOf(r.health, HEALTHS), enabled: typeof r.enabled === 'boolean' ? r.enabled : undefined, ingress: oneOf(r.ingress, ['allow', 'pair', 'deny']), detail: text(r.detail)}]
})

interface Agent {readonly id: string; readonly name: string; readonly presence?: Presence; readonly waiting?: number}
const agentsOf = (v: V): Agent[] => records(v, 'agents').flatMap((r): Agent[] => {
  const id = text(r.id), name = text(r.name)
  if (!id || !name) return []
  return [{id, name, presence: oneOf(r.presence, Object.keys(PRESENCE_WORD) as Presence[]), waiting: typeof r.waiting === 'number' && r.waiting >= 0 ? r.waiting : undefined}]
})
const seated = (a: Agent) => a.presence === 'embodied-here' || a.presence === 'embodied-elsewhere'

interface Harness {readonly name: string; readonly evidence?: string}
const harnessesOf = (v: V): Harness[] => records(v, 'harnesses').flatMap((r): Harness[] => { const name = text(r.name); return name ? [{name, evidence: text(r.evidence)}] : [] })

interface Peer {readonly workcell: string; readonly endpoint?: string; readonly kind?: string; readonly reachable?: boolean}
const peersOf = (v: V): Peer[] => records(v, 'peers').flatMap((r): Peer[] => {
  const workcell = text(r.workcell)
  return workcell ? [{workcell, endpoint: text(r.endpoint), kind: text(r.kind), reachable: typeof r.reachable === 'boolean' ? r.reachable : undefined}] : []
})

interface Passed {readonly at: string; readonly from: string; readonly to: string; readonly via: string; readonly standing: string; readonly why?: string}
const passedOf = (v: V): Passed[] => records(v, 'passed').flatMap((r): Passed[] => {
  const standing = text(r.standing)
  if (!standing) return []
  return [{at: text(r.at) ?? NONE, from: text(r.from) ?? NONE, to: text(r.to) ?? NONE, via: text(r.via) ?? NONE, standing, why: text(r.why)}]
})

const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}
const stateOf = (v: V): State | undefined => oneOf(strOf(v, 'state'), ['ready', 'composed', 'refused'])
const stateWord = (v: V): string | undefined => { const s = stateOf(v); return s ? STATE_WORD[s] : undefined }
const stateTone = (s: State | undefined): Tone | undefined => (s === 'ready' ? 'green' : s === 'composed' ? 'accent' : s === 'refused' ? 'stall' : undefined)
const entryOf = (v: V): string | undefined => oneOf(strOf(v, 'entry'), ENTRIES.map(e => e.value))
const entryNext = (v: V): string | undefined => oneOf(strOf(v, 'entryPending'), ENTRIES.map(e => e.value))
const entryLabel = (id: string | undefined) => ENTRIES.find(e => e.value === id)?.label
const policyOf = (v: V): string | undefined => oneOf(strOf(v, 'agentPolicy'), POLICY.map(x => x.value))
/** The square on a surface's row: your request when you made one, else the owner's own reading. */
const requestOf = (v: V, s: Surface): boolean | undefined => (has(v, `on:${s.id}`) ? v[`on:${s.id}`] === true : s.enabled)
const connectedCount = (v: V): number | undefined => (has(v, 'surfaces') ? surfacesOf(v).filter(s => s.health === 'connected').length : undefined)
const surfaceLine = (v: V): string | undefined => (has(v, 'surfaces') ? `${connectedCount(v)}/${surfacesOf(v).length}` : undefined)
const seatedLine = (v: V): string | undefined => (has(v, 'agents') ? `${agentsOf(v).filter(seated).length}/${agentsOf(v).length}` : undefined)
const machineLine = (v: V): string | undefined => (has(v, 'peers') ? `${peersOf(v).filter(x => x.reachable === true).length}/${peersOf(v).length}` : undefined)
const keptWord = (v: V): string | undefined => { const k = strOf(v, 'keptBy'); return k === undefined ? undefined : KEPT_WORD[k] ?? k }
const waitingOf = (v: V) => numOf(v, 'inbox')

/** An entry you set waits for Confirm; setting it back to the owner's entry drops the wait. */
const askEntry = (v: V, set: ViewProps['set']) => (x: string) => set('entryPending', x === entryOf(v) ? undefined : x)

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
const wrap = (s: string, n: number): string[] => {
  const lines: string[] = []
  let line = ''
  for (const word of s.split(' ')) {
    if (line && `${line} ${word}`.length > n) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  return [...lines, line].slice(0, 2)
}
/** The agents the well draws: the ones that stand here first, then the ones with mail waiting, then the rest in the owner's order. */
const priority = (a: Agent) => (a.presence === 'embodied-here' ? 0 : (a.waiting ?? 0) > 0 ? 1 : seated(a) ? 2 : 3)
const drawnAgents = (v: V, n: number): Agent[] => agentsOf(v).map((a, i) => ({a, i})).sort((x, y) => priority(x.a) - priority(y.a) || x.i - y.i).slice(0, n).map(x => x.a)

// ---------------------------------------------------------------- the well

type Size = 'mini' | 'compact' | 'whole'
/** Where the marks stand, by size: the surface boxes, the gateway block, the agent column and the scales. */
const GEO = {
  mini: {w: 104, h: 100, y0: 15, pitch: 12, sx: 5, sw: 16, gx: 44, gw: 8, ax: 86, scaleY: 90, a0: 22, a1: 84},
  compact: {w: 140, h: 146, y0: 21, pitch: 15, sx: 6, sw: 40, gx: 64, gw: 10, ax: 104, scaleY: 127, a0: 22, a1: 118},
  whole: {w: 194, h: 146, y0: 24, pitch: 14, sx: 8, sw: 46, gx: 84, gw: 12, ax: 136, scaleY: 128, a0: 40, a1: 180},
} as const
const ROWS = 4
/** The entry scale on the whole well. */
const E0 = 40, E1 = 180
const stopX = (i: number, n: number, a0: number, a1: number) => a0 + (a1 - a0) * (n === 1 ? 0 : i / (n - 1))
const nearStop = (x: number, n: number, a0: number, a1: number) => Math.round(clampTo(0, n - 1, ((x - a0) / (a1 - a0)) * (n - 1)))

const Pair = ({x, y, k, val}: {x: number; y: number; k: string; val: string}) =>
  <text x={x} y={y} className="dp-ink-dim"><tspan className="dp-axis">{k} </tspan>{val}</text>

/** The picture: surfaces → gateway → agents. A surface's line is its health; a dot beside an agent is a message that waits; the rung
 * that joins the agents is the rule for a call between them; the scale under it sets that rule (handle 1), and on the whole well
 * a second scale sets the entry (handle 2). With no reading of a part, the part is not drawn and the well names it. */
function Picture({p, size}: {p: ViewProps; size: Size}) {
  const v = p.v, g = GEO[size], mini = size === 'mini', whole = size === 'whole'
  const set = mini ? undefined : p.set
  const running = lightOf(p) === 'lit'
  const surfaces = surfacesOf(v).slice(0, ROWS), agents = drawnAgents(v, ROWS)
  const policy = policyOf(v), entry = entryOf(v), next = entryNext(v), state = stateOf(v)
  const cy = (i: number) => g.y0 + i * g.pitch
  const top = g.y0 - 9, span = (ROWS - 1) * g.pitch + 18
  const lineA = g.sx + g.sw, lineB = g.gx, lineC = g.gx + g.gw, lineD = g.ax - 2, rung = g.ax - 5
  const first = cy(0), last = cy(Math.max(0, agents.length - 1))
  const missing = [!has(v, 'surfaces') ? 'surfaces' : '', !has(v, 'agents') ? 'agents' : '', entry === undefined ? 'entry' : '', policy === undefined ? 'agent rule' : '', state === undefined ? 'state' : ''].filter(Boolean)
  const sayMissing = missing.length === 5 ? ['No readings'] : missing.length ? wrap(`No reading: ${missing.join(', ')}`, mini ? 20 : size === 'compact' ? 28 : 46) : []
  const captionY = whole ? 84 : mini ? 69 : 86
  const stroke = state === 'ready' ? 'var(--green)' : state === 'composed' ? 'var(--dp-on)' : state === 'refused' ? 'var(--stall)' : 'var(--text-dim)'
  const mid = (first + last) / 2
  const canPolicy = !!set && policy !== undefined && !st(p, 'agentPolicy').disabled
  const canEntry = whole && !!set && entry !== undefined && !st(p, 'entry').disabled
  const sel = next ?? entry
  return <Display w={g.w} h={g.h} label="The gateway"
    does={mini ? 'The surfaces, the gateway and the agents. A dot beside an agent is a message that waits.' : 'The surfaces on the left, the gateway in the middle, the agents on the right. A dot is a message that waits for an agent. Drag handle 1 to set whether agents may call each other.'}
    corner={mini ? undefined : stateWord(v) ?? NONE}>
    {/* the surfaces */}
    {surfaces.map((s, i) => {
      const y = cy(i), up = running && s.health === 'connected' && requestOf(v, s) !== false
      const held = requestOf(v, s) === false, weak = s.health === 'degraded' || s.health === 'reconnecting' || s.health === 'connecting'
      return <g key={s.id}>
        <rect x={g.sx} y={y - 5} width={g.sw} height={10} className="dp-faint" strokeDasharray={held ? '2 2' : undefined}
          style={up ? {stroke: 'var(--dp-value)'} : weak ? {stroke: 'var(--stall)'} : undefined} />
        {!mini && <text x={g.sx + 3} y={y + 3} className="dp-ink-dim" style={{fontSize: 8}}>{trunc(s.name, whole ? 9 : 8)}</text>}
        <path d={`M${lineA} ${y}H${lineB}`} className={up ? 'dp-curve' : 'dp-faint'} strokeDasharray={up ? undefined : weak ? '3 3' : '1 3'} />
      </g>
    })}
    {/* the gateway */}
    <rect x={g.gx} y={top} width={g.gw} height={span} className="dp-fill" style={{stroke: running ? stroke : 'var(--text-faint)'}} />
    <circle cx={g.gx + g.gw / 2} cy={top + span / 2} r={2.2} fill={running ? 'var(--dp-value)' : 'none'} className={running ? undefined : 'dp-faint'} />
    {/* the agents: a line to each, the waiting messages, and the mark of where it stands */}
    {agents.map((a, i) => {
      const y = cy(i), n = Math.min(4, Math.round(a.waiting ?? 0)), here = a.presence === 'embodied-here', elsewhere = a.presence === 'embodied-elsewhere'
      return <g key={a.id}>
        <path d={`M${lineC} ${y}H${lineD}`} className={running ? 'dp-curve' : 'dp-faint'} strokeDasharray={running ? undefined : '1 3'} opacity={running ? 0.55 : 1} />
        {Array.from({length: n}, (_, k) => <circle key={k} cx={g.ax - 11 - k * 5} cy={y} r={1.9} fill="var(--dp-on)" />)}
        <circle cx={g.ax} cy={y} r={3.6} className={here || elsewhere ? undefined : 'dp-faint'} fill={here ? 'var(--dp-value)' : 'none'}
          stroke={elsewhere ? 'var(--dp-value)' : undefined} strokeDasharray={a.presence === 'unavailable' ? '1.5 1.5' : undefined} />
        {!mini && <text x={g.ax + 7} y={y + 3} className="dp-ink-dim" style={{fontSize: 8}}>{trunc(a.name.replace(/^@/, ''), whole ? 11 : 6)}</text>}
      </g>
    })}
    {/* the rule for a call between agents: the rung that joins them */}
    {agents.length > 1 && (policy === 'deny'
      ? <g>
        <path d={`M${rung} ${first}V${mid - 5}M${rung} ${mid + 5}V${last}`} className="dp-faint" />
        <path d={`M${rung - 3} ${mid - 3}l6 6M${rung + 3} ${mid - 3}l-6 6`} className="dp-faint" style={{stroke: 'var(--stall)'}} />
      </g>
      : <g>
        <path d={`M${rung} ${first}V${last}`} className={policy === 'allow' ? 'dp-curve' : policy === 'pair' ? 'dp-curve-on' : 'dp-faint'} strokeDasharray={policy === 'pair' ? '3 3' : undefined} />
        {policy === 'pair' && <path d={`M${rung} ${mid - 4}L${rung + 4} ${mid}L${rung} ${mid + 4}L${rung - 4} ${mid}Z`} className="dp-curve-on" style={{fill: 'var(--dp-well)'}} />}
      </g>)}
    {/* what the well cannot read */}
    {sayMissing.map((line, i) => <text key={i} x={g.sx} y={captionY + i * 9} className="dp-axis">{line}</text>)}
    {whole && missing.length === 0 && <>
      <text x={g.sx} y={captionY} className="dp-axis">surfaces {surfaceLine(v)}</text>
      <text x={g.w - 8} y={captionY} className="dp-axis" textAnchor="end">agents {seatedLine(v)} seated</text>
    </>}
    {size === 'compact' && <>
      <Pair x={7} y={missing.length > 0 ? 112 : 104} k="entry" val={entry === undefined ? NONE : ENTRY_TICK[ENTRIES.findIndex(e => e.value === entry)] ?? NONE} />
      <Pair x={78} y={missing.length > 0 ? 112 : 104} k="waiting" val={waitingOf(v) === undefined ? NONE : `${waitingOf(v)}`} />
    </>}
    {/* the entry scale (whole only): how far the gateway can be reached */}
    {whole && <g>
      <text x={g.sx} y={103} className="dp-axis">entry</text>
      {next !== undefined && next !== entry && <text x={g.w - 8} y={94} className="dp-axis" textAnchor="end" style={{fill: 'var(--dp-on)'}}>waits for Confirm</text>}
      <path d={`M${E0} 100H${E1}`} className="dp-grid" />
      {ENTRY_TICK.map((t, i) => <g key={t}>
        <path d={`M${stopX(i, ENTRIES.length, E0, E1)} 97V103`} className="dp-faint" />
        <text x={stopX(i, ENTRIES.length, E0, E1)} y={112} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{t}</text>
      </g>)}
      {entry !== undefined && <circle cx={stopX(ENTRIES.findIndex(e => e.value === entry), ENTRIES.length, E0, E1)} cy={100} r={3} fill="var(--dp-value)" />}
      {canEntry && sel !== undefined && <Handle n={2} shape="square" x={stopX(ENTRIES.findIndex(e => e.value === sel), ENTRIES.length, E0, E1)} y={100} label="Entry"
        does="Drag along the scale: who can reach the gateway. A change waits for Confirm."
        onDrag={x => askEntry(v, p.set)(ENTRIES[nearStop(x, ENTRIES.length, E0, E1)]!.value)} onReset={() => askEntry(v, p.set)(ENTRY_DEFAULT)} />}
    </g>}
    {/* the rule scale: how an agent may call another */}
    {whole && <text x={g.sx} y={g.scaleY + 3} className="dp-axis">calls</text>}
    <path d={`M${g.a0} ${g.scaleY}H${g.a1}`} className="dp-grid" />
    {POLICY_TICK.map((t, i) => <g key={t}>
      <path d={`M${stopX(i, 3, g.a0, g.a1)} ${g.scaleY - 3}V${g.scaleY + 3}`} className="dp-faint" />
      {!mini && <text x={stopX(i, 3, g.a0, g.a1)} y={g.scaleY + 12} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{t}</text>}
    </g>)}
    {policy !== undefined && <circle cx={stopX(POLICY.findIndex(x => x.value === policy), 3, g.a0, g.a1)} cy={g.scaleY} r={mini ? 2.4 : 3} fill="var(--dp-value)" />}
    {canPolicy && <Handle n={1} shape="ring" x={stopX(POLICY.findIndex(x => x.value === policy), 3, g.a0, g.a1)} y={g.scaleY} label="Calls"
      does="Drag along the scale: whether one agent may call another. Ask holds the call in Approvals."
      onDrag={x => p.set('agentPolicy', POLICY[nearStop(x, 3, g.a0, g.a1)]!.value)} onReset={() => p.set('agentPolicy', POLICY_DEFAULT)} />}
  </Display>
}

// ---------------------------------------------------------------- the controls

const serviceToggle = (p: ViewProps) => <Toggle label="Service" does={SAYS.service} on={boolOf(p.v, 'service') === true} unknown={boolOf(p.v, 'service') === undefined}
  onChange={x => p.set('service', x)} {...st(p, 'service')} />
const coexistToggle = (p: ViewProps) => <Toggle label="Coexist" does={SAYS.coexist} on={boolOf(p.v, 'coexist') === true} unknown={boolOf(p.v, 'coexist') === undefined}
  onChange={x => p.set('coexist', x)} {...st(p, 'coexist')} />
const policyRadio = (p: ViewProps) => <Radio label="Calls" does={SAYS.policy} value={policyOf(p.v) ?? ''} options={POLICY} stack
  onChange={x => p.set('agentPolicy', x)} {...st(p, 'agentPolicy')} />
const entryChooser = (p: ViewProps) => <div className="ag-wide"><Chooser wide label="Entry" does={SAYS.entry} value={entryNext(p.v) ?? entryOf(p.v) ?? ''} options={ENTRIES}
  onChange={askEntry(p.v, p.set)} {...st(p, 'entry')} pending={entryNext(p.v) !== undefined || st(p, 'entry').pending} /></div>

/** The consent pair under a changed entry: the change waits until you confirm it. */
function Consent({p}: {p: ViewProps}) {
  const next = entryNext(p.v)
  if (next === undefined) return null
  return <div className="ag-pair">
    <Action {...st(p, 'entry')} hold label="Confirm" does={`Change the entry to ${entryLabel(next) ?? NONE}. The gateway rebinds its listener.`} onPress={() => { p.set('entry', next); p.set('entryPending', undefined) }} />
    <Action label="Cancel" does="Keep the entry as it is." onPress={() => p.set('entryPending', undefined)} />
  </div>
}

const surfacesReadout = (p: ViewProps) => <Readout label="surfaces" does="Surfaces that are connected, of the surfaces declared. Click to open the whole gateway." value={surfaceLine(p.v)} tone="value" onPress={p.nav.select} />
const stateReadout = (p: ViewProps) => <Readout label="state" does="The standing of the entry. Ready: the gateway answered. Composed: nobody has tried it end to end. Refused: the owner refuses it." value={stateWord(p.v)} tone={stateTone(stateOf(p.v))} />

/** The surfaces as a list: your request beside the owner's answer, and the rule for a new sender in the note. */
function SurfaceList({p, size = 6}: {p: ViewProps; size?: number}) {
  const [page, setPage] = useState(0)
  const items: RowItem[] = surfacesOf(p.v).map(s => {
    const light: LightState = s.health === undefined ? 'unknown' : s.health === 'connected' || s.health === 'connecting' || s.health === 'degraded' || s.health === 'reconnecting' ? 'lit' : 'dark'
    const tone: Tone = s.health === 'connected' ? 'green' : 'accent'
    const weak = s.health === 'degraded' || s.health === 'reconnecting' || s.health === 'unavailable'
    return {id: s.id, name: s.name, light, tone, request: requestOf(p.v, s), note: s.ingress ? INGRESS_WORD[s.ingress] : undefined, why: weak ? s.detail ?? HEALTH_WORD[s.health!] : undefined,
      does: `${s.health ? HEALTH_WORD[s.health] : 'No reading of its health'}${s.ingress ? `. ${INGRESS_SAYS[s.ingress]}` : ''}`}
  })
  const off = st(p, 'surfaces').disabled
  const count = surfaceLine(p.v)
  return <Rows label={count === undefined ? 'Surfaces · no reading' : `Surfaces · ${count} connected`} does={SAYS.surfaces} items={items} size={size} page={page} onPage={setPage}
    onRequest={off ? undefined : (id, x) => p.set(`on:${id}`, x)} />
}

const head = (p: ViewProps) => ({light: lightOf(p), onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the pane: the messages that passed

function Pane({v}: {v: V}) {
  const [only, setOnly] = useState<'all' | 'waiting' | 'refused'>('all')
  const all = passedOf(v), shownRows = all.filter(r => only === 'all' || (only === 'waiting' ? WAITING.includes(r.standing) : REFUSED.includes(r.standing)))
  const state = stateOf(v), reason = strOf(v, 'refused')
  const agents = agentsOf(v), harnesses = harnessesOf(v), peers = peersOf(v), entry = entryOf(v), next = entryNext(v)
  return <div className="ag-pane">
    <div className="ag-strip" aria-label="The gateway">
      <b>Agency gateway</b><span>{entryLabel(entry) ?? NONE}</span><span data-state={state === 'refused' ? 'refused' : undefined}>{stateWord(v) ?? NONE}</span>
      <span>{waitingOf(v) === undefined ? NONE : `${waitingOf(v)} waiting`}</span><span>kept by {keptWord(v) ?? NONE}</span>
    </div>
    <div className="ag-body">
      <div className="ag-log">
        <div className="ag-chips" role="group" aria-label="Messages">
          {(['all', 'waiting', 'refused'] as const).map(k => <button key={k} type="button" aria-pressed={only === k} onClick={() => setOnly(k)}>{k === 'all' ? 'All messages' : k === 'waiting' ? 'Waiting' : 'Refused'}</button>)}
        </div>
        {shownRows.length === 0 ? <p className="ag-empty">{has(v, 'passed') ? 'No message in this list.' : 'No reading of the messages.'}</p> : <ol className="ag-list" aria-label="Messages that passed">
          {shownRows.map((r, i) => <li key={`${r.at}:${i}`} className="ag-row" data-standing={r.standing} title={STANDING_SAYS[r.standing]}>
            <span className="ag-at">{r.at}</span><span className="ag-who">{r.from}</span><span className="ag-arrow" aria-hidden="true">→</span><span className="ag-who">{r.to}</span>
            <span className="ag-standing">{r.standing}</span>
            <span className="ag-note"><span>{r.via}</span>{r.why !== undefined && <span>{r.why}</span>}</span>
          </li>)}
        </ol>}
      </div>
      <aside className="ag-reads" aria-label="Readings">
        <section className="ag-read"><h4>State</h4>
          <strong data-state={state ?? 'none'}>{stateWord(v) ?? NONE}</strong>
          <p>{state === undefined ? (reason ?? 'No reading of the state.') : STATE_SAYS[state].split(': ')[1]}</p></section>
        <section className="ag-read"><h4>Entry</h4>
          <strong data-state={entry === undefined ? 'none' : undefined}>{entryLabel(entry) ?? NONE}</strong>
          <p>reach <b>{strOf(v, 'reach') ?? NONE}</b></p>
          <p>sign-in <b>{strOf(v, 'signIn') ?? NONE}</b></p>
          <p>secrecy <b>{strOf(v, 'secrecy') ?? NONE}</b></p>
          {next !== undefined && next !== entry && <p>waits for Confirm <b>{entryLabel(next)}</b></p>}</section>
        <section className="ag-read"><h4>Agents</h4>
          <strong data-state={has(v, 'agents') ? undefined : 'none'}>{has(v, 'agents') ? `${agents.filter(seated).length} seated` : NONE}</strong>
          <p>of <b>{has(v, 'agents') ? agents.length : NONE}</b> agents · messages waiting <b>{waitingOf(v) ?? NONE}</b></p></section>
        <section className="ag-read"><h4>Harnesses</h4>
          <strong data-state={has(v, 'harnesses') ? undefined : 'none'}>{has(v, 'harnesses') ? `${harnesses.length} found` : NONE}</strong>
          {harnesses.map(h => <p key={h.name}><b>{h.name}</b> {h.evidence ?? ''}</p>)}
          <p>{boolOf(v, 'coexist') === undefined ? 'No reading of the policy.' : boolOf(v, 'coexist') ? 'Coexist: it starts beside them.' : 'Exclusive: it holds their connectors.'}</p></section>
        <section className="ag-read"><h4>Machines</h4>
          <strong data-state={has(v, 'peers') ? undefined : 'none'}>{machineLine(v) ?? NONE}</strong>
          {peers.map(m => <p key={m.workcell}><b>{m.workcell}</b> {m.kind ?? NONE} · {m.reachable === undefined ? NONE : m.reachable ? 'answers' : 'no answer'}</p>)}
          {has(v, 'peers') && peers.length === 0 && <p>No other gateway is linked.</p>}</section>
      </aside>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

/** The surfaces the gateway's connectors declare: Telegram is the owner's comms connector (agent-system.md, `gateway-connector/telegram/main`). */
const SURFACES = [
  {id: 'gateway-connector/telegram/main', name: 'Telegram', platform: 'telegram', health: 'connected', enabled: true, ingress: 'pair'},
  {id: 'gateway-connector/slack/main', name: 'Slack', platform: 'slack', health: 'disconnected', enabled: false, ingress: 'pair'},
]
/** Agents as `aikit gateway who` names them: handle, and where each stands. Two have mail waiting. */
const AGENTS = [
  {id: 'agent:nara', name: '@nara', presence: 'embodied-here', waiting: 0},
  {id: 'agent:aikit-guardian', name: '@aikit-guardian', presence: 'not-currently-embodied', waiting: 2},
  {id: 'agent:central-guardian', name: '@central-guardian', presence: 'not-currently-embodied', waiting: 1},
  {id: 'agent:aletheia', name: '@aletheia', presence: 'not-currently-embodied', waiting: 0},
  {id: 'agent:anima', name: '@anima', presence: 'not-currently-embodied', waiting: 0},
  {id: 'agent:anuttara', name: '@anuttara', presence: 'unavailable', waiting: 0},
]
const AGENTS_QUIET = AGENTS.map(a => ({...a, waiting: 0}))
/** The harness gateways `aikit gateway coexistence` found on this machine, with its evidence. */
const HARNESSES = [
  {name: 'hermes', evidence: 'its service is loaded'},
  {name: 'openclaw', evidence: 'its binary is on the path'},
]
const PEERS = [{workcell: 'workcell:omarchy', endpoint: '100.92.62.101:7788', kind: 'private-tailnet', reachable: true}]
const PEERS_DOWN = PEERS.map(m => ({...m, reachable: false}))
const PASSED = [
  {at: '14:02:07', from: '@nara', to: '@aikit-guardian', via: 'this machine', standing: 'pending', why: 'Waits for its next turn.'},
  {at: '14:02:31', from: 'telegram:owner', to: '@nara', via: 'Telegram', standing: 'delivered'},
  {at: '14:03:10', from: '@aletheia', to: '@anima', via: 'this machine', standing: 'held', why: 'Nobody sits in the place yet.'},
  {at: '14:03:44', from: '@nara', to: '@central-guardian', via: 'this machine', standing: 'pending', why: 'Waits for its next turn.'},
  {at: '14:04:02', from: 'telegram:unknown', to: '@nara', via: 'Telegram', standing: 'pairing', why: 'The sender is not approved yet.'},
  {at: '14:04:15', from: '@anima-logos', to: '@anima-eros', via: 'this machine', standing: 'denied', why: 'The rule for calls is Deny.'},
  {at: '14:05:20', from: '@nara', to: '@central-guardian', via: 'this machine', standing: 'escalated', why: 'Crossed into Factory custody.'},
]

/** Every key the owner reports or the shell holds: the "No readings" fixture drops all of them. */
const KEYS = ['light', 'service', 'entry', 'entryPending', 'coexist', 'agentPolicy', 'state', 'refused', 'reach', 'signIn', 'secrecy', 'keptBy', 'inbox', 'surfaces', 'agents', 'harnesses', 'peers', 'passed']
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'ai-kit:agency-gateway',
  title: 'Agency gateway',
  kind: 'effect',
  defaults: {
    light: 'lit',
    // What the owner writes, at the owner's defaults (the rule for a call between agents is the manual's Ask).
    service: true, entry: ENTRY_DEFAULT, coexist: false, agentPolicy: POLICY_DEFAULT,
    // Readings: what the owner reports, never set from here. The entry's terms are the owner's own (EntryMode local-ipc).
    state: 'ready', reach: 'local processes the file mode admits', signIn: 'file mode: owner scope', secrecy: 'none needed; stays in the kernel', keptBy: 'supervised-launchd',
    inbox: 3,
    surfaces: JSON.stringify(SURFACES), agents: JSON.stringify(AGENTS), harnesses: JSON.stringify(HARNESSES), peers: JSON.stringify(PEERS), passed: JSON.stringify(PASSED),
  },
  fixtures: {
    Ready: {},
    // This Mac without a running gateway: nothing answers, so the entry, the surfaces and the messages have no reading.
    'Not running': {
      ...NOTHING, light: 'dark', service: false, coexist: false, agentPolicy: POLICY_DEFAULT, inbox: 0,
      refused: 'The gateway socket does not exist. Start one with the gateway serve command.',
      agents: JSON.stringify(AGENTS_QUIET), harnesses: JSON.stringify(HARNESSES), peers: JSON.stringify(PEERS_DOWN),
    },
    'No readings': NOTHING,
  },

  folded: p => <Folded title="Agency gateway" light={lightOf(p)} readings={[stateWord(p.v) ?? NONE, waitingOf(p.v) === undefined ? NONE : `${waitingOf(p.v)} msg`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Agency gateway" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Picture p={p} size="compact" />
    </Section>
    <Section label="Macros" cols={2}>
      {policyRadio(p)}
      {serviceToggle(p)}
      {surfacesReadout(p)}
      {stateReadout(p)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Agency gateway" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <Picture p={p} size="whole" />
      </Section>
      <Section label="Service" cols={2}>
        {serviceToggle(p)}
        {coexistToggle(p)}
        {entryChooser(p)}
        <Consent p={p} />
      </Section>
      <Section label="Agents" grow>
        {policyRadio(p)}
      </Section>
    </Band>
    <Band>
      <Section width={224}>
        <SurfaceList p={p} />
      </Section>
      <Section label="Readings" cols={3} grow>
        {stateReadout(p)}
        <Readout label="inbox" does="Messages that wait for an agent." value={waitingOf(p.v)} tone="accent" />
        <Readout label="kept by" does="What keeps the gateway running, and starts it again after a restart." value={keptWord(p.v)} />
        <Readout label="seated" does="Agents that stand somewhere now, of all the agents AIKit knows." value={seatedLine(p.v)} tone="value" />
        <Readout label="harness" does="Harness gateways found on this machine. Open the pane to read the evidence." value={has(p.v, 'harnesses') ? harnessesOf(p.v).length : undefined} />
        <Readout label="machines" does="Gateways of your other machines that answer, of those you linked." value={machineLine(p.v)} />
      </Section>
    </Band>
  </Panel>,

  full: p => <Pane v={p.v} />,

  widget: p => <Tile title="Agency gateway" light={lightOf(p)} span={2} onFull={p.nav.full}>
    <Picture p={p} size="mini" />
    <div className="ag-tile-side">
      <Readout label="state" does="The standing of the entry." value={stateWord(p.v)} tone={stateTone(stateOf(p.v))} />
      <Readout big label="waiting" does="Messages that wait for an agent. Press to open the messages." value={waitingOf(p.v)} tone="accent" onPress={p.nav.full} />
      <Readout label="surfaces" does="Surfaces that are connected, of the surfaces declared." value={surfaceLine(p.v)} tone="value" />
    </div>
  </Tile>,
}
