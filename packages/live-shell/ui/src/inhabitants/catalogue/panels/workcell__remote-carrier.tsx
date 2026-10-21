// The Remote carrier (manual §19.18, workcell:remote-carrier): the device that names the machine a workcell runs on, the second device on
// a workcell's chain, after the Gateway. Live's nearest: Utility, a small effect whose meaning is plain at a glance. The picture is the route: this machine
// on the left, each machine you connected on the right, one line to each. The line is drawn by the machine's standing (solid ready, dashed
// composed, crossed when refused or incompatible, dotted when disconnected). Handle 1 stands where the session runs and moves it: to this
// machine, or onto a machine. Under the route stand the round trip, on a log scale from 1 ms to the 3 s a probe waits, and the grant, one
// tick for each operation the connection may do.
//
// Everything the device draws is a value key. The owners report:
//   light      'lit' | 'dark'   a connected machine is ready to carry; hollow when the owner reports none
//   here       string           this machine's Workcell ref (`workcell status --json`, workcell_ref)
//   machines   Machine[]        the connections, from `workcell status --json` (connections: label, state, endpoint, protocol,
//                               remote_workcell_ref, expires_at_unix_ms) and `workcell connections show` (granted_operations, remote
//                               software, credential reference); each is {id (the connection label), name (the remote Workcell ref),
//                               endpoint?, protocol?, state?, why?, credential?, expiresAt? (ms; null = never), grant? (operations),
//                               rtt? (ms), mode? (the AIKit entry mode the endpoint looks like), software?, since? (ms), credRef?,
//                               sessions? ({id, name, kind?, seat?})}.
//                               state is ready · composed · refused · incompatible · disconnected. Workcell's own connection states are
//                               connected · disconnected · refused · incompatible (workcell-wire connection.rs CONNECTION_STATES);
//                               AIKit words a mode's standing shipped (here Ready) · composed · refused (gateway_modes.rs Standing).
//                               credential is valid · expired · revoked · nomatch: the serving Workcell refuses a revoked grant, an
//                               expired grant and a credential that matches no grant in three different words (service.rs).
// The shell holds and the owner is asked to write:  where ('this' · 'connected'), machine (a connection label).
// A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {Band, Chooser, Display, Folded, Handle, Lamp, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {clampTo, has, json, NONE, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './workcell__remote-carrier.css'

type V = ViewProps['v']
type State = 'ready' | 'composed' | 'refused' | 'incompatible' | 'disconnected'
type Credential = 'valid' | 'expired' | 'revoked' | 'nomatch'

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

/** The control operations of workcell.control/v1, in the protocol's order (workcell-control CONTROL_OPERATIONS). A grant is a subset. */
const OPS = ['status', 'discover', 'plan', 'prepare', 'inspect', 'recover', 'observe', 'expose', 'collect', 'release', 'reconcile', 'system', 'execute', 'operation-read'] as const
/** The round trip scale runs from 1 ms to 3 s, the time a probe of a remote gateway waits for an answer. */
const RTT_LO = 1, RTT_HI = 3000
const RTT_TICKS: readonly [number, string][] = [[1, '1'], [10, '10'], [100, '100'], [1000, '1 s']]

const WHERE: readonly Option<string>[] = [
  {value: 'this', label: 'This machine', does: 'The session runs on this machine.'},
  {value: 'connected', label: 'Connected', does: 'The session runs on the machine you chose.'},
]
const STATE_WORD: Record<State, string> = {ready: 'Ready', composed: 'Composed', refused: 'Refused', incompatible: 'Incompatible', disconnected: 'Disconnected'}
const STATE_SAYS: Record<State, string> = {
  ready: 'Ready: the machine is connected and a session can use it now.',
  composed: 'Composed: the machine is connected, and nobody has carried a session through it from end to end.',
  refused: 'Refused: the machine refused the connection.',
  incompatible: 'Incompatible: the two machines do not speak the same control protocol.',
  disconnected: 'Disconnected: the link is down, by your hand or because the machine did not answer.',
}
const CRED_WORD: Record<Credential, string> = {valid: 'Valid', expired: 'Expired', revoked: 'Revoked', nomatch: 'No match'}
const CRED_SAYS: Record<Credential, string> = {
  valid: 'The machine accepts you.',
  expired: 'The grant ended on its own terms. Ask the serving operator to authorise again.',
  revoked: 'The serving operator ended the grant. Expired and revoked are different.',
  nomatch: 'No grant on the machine matches the credential.',
}
const SAYS = {
  where: 'Where the session runs: on this machine, or on a machine you connected.',
  machine: 'The connection that carries the session. Each one names a machine and the grant it gave you.',
  route: 'This machine on the left, the machines you connected on the right. A solid line is ready, dashed is composed, crossed is refused. Drag handle 1 to move the session.',
  place: 'Where the session runs. Drag it onto this machine, or onto a connected machine. It sets Where and Machine.',
}

// ---------------------------------------------------------------- readings

interface Session {readonly id: string; readonly name: string; readonly kind?: string; readonly seat?: string}
interface Machine {
  readonly id: string
  readonly name: string
  readonly endpoint?: string
  readonly protocol?: string
  readonly state?: State
  readonly why?: string
  readonly credential?: Credential
  /** The instant the grant stops authorising, in ms; null when the grant never expires; undefined when the owner did not say. */
  readonly expiresAt?: number | null
  readonly grant?: readonly string[]
  readonly rtt?: number
  readonly mode?: string
  readonly software?: string
  readonly since?: number
  readonly credRef?: string
  readonly sessions?: readonly Session[]
}
const text = (x: unknown) => (typeof x === 'string' && x.length > 0 ? x : undefined)
const STATES: readonly string[] = ['ready', 'composed', 'refused', 'incompatible', 'disconnected']
const CREDS: readonly string[] = ['valid', 'expired', 'revoked', 'nomatch']

/** The connections the owner reports, kept only where they have a shape. Nothing in a bad list can throw. */
const machinesOf = (v: V): Machine[] => {
  const raw = json<unknown>(v, 'machines', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((m): Machine[] => {
    if (!m || typeof m !== 'object') return []
    const r = m as Record<string, unknown>
    const id = text(r.id), name = text(r.name) ?? id
    if (!id || !name) return []
    const sessions = Array.isArray(r.sessions) ? r.sessions.flatMap((s): Session[] => {
      if (!s || typeof s !== 'object') return []
      const q = s as Record<string, unknown>
      const sid = text(q.id), sname = text(q.name) ?? sid
      return sid && sname ? [{id: sid, name: sname, kind: text(q.kind), seat: text(q.seat)}] : []
    }) : undefined
    return [{
      id, name, endpoint: text(r.endpoint), protocol: text(r.protocol), why: text(r.why), mode: text(r.mode), software: text(r.software), credRef: text(r.credRef),
      state: typeof r.state === 'string' && STATES.includes(r.state) ? r.state as State : undefined,
      credential: typeof r.credential === 'string' && CREDS.includes(r.credential) ? r.credential as Credential : undefined,
      expiresAt: r.expiresAt === null ? null : typeof r.expiresAt === 'number' && Number.isFinite(r.expiresAt) ? r.expiresAt : undefined,
      grant: Array.isArray(r.grant) ? r.grant.filter((g): g is string => typeof g === 'string') : undefined,
      rtt: typeof r.rtt === 'number' && Number.isFinite(r.rtt) && r.rtt >= 0 ? r.rtt : undefined,
      since: typeof r.since === 'number' && Number.isFinite(r.since) ? r.since : undefined,
      sessions,
    }]
  })
}
/** The machine you chose. None is a state: the owner's default is no machine. */
const chosenOf = (v: V, machines: readonly Machine[]): Machine | undefined => machines.find(m => m.id === strOf(v, 'machine'))
const whereOf = (v: V): 'this' | 'connected' | undefined => { const w = strOf(v, 'where'); return w === 'this' || w === 'connected' ? w : undefined }
const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}
const stateTone = (s: State | undefined): Tone | undefined => (s === 'ready' ? 'green' : s === 'composed' ? 'accent' : s ? 'stall' : undefined)
const credTone = (c: Credential | undefined): Tone | undefined => (c === 'valid' ? 'green' : c ? 'stall' : undefined)
const stateWord = (m: Machine | undefined) => (m?.state ? STATE_WORD[m.state] : undefined)
const refusedState = (s: State | undefined) => s === 'refused' || s === 'incompatible' || s === 'disconnected'
const reasonOf = (m: Machine) => m.why ?? 'The owner gave no reason.'
const lampOf = (s: State | undefined): {light: LightState; tone: Tone} =>
  s === 'ready' ? {light: 'lit', tone: 'green'} : s === 'composed' ? {light: 'lit', tone: 'accent'} : s ? {light: 'dark', tone: 'accent'} : {light: 'unknown', tone: 'accent'}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const two = (n: number) => String(n).padStart(2, '0')
/** An instant in UTC, short. */
const when = (ms: number) => { const d = new Date(ms); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())} UTC` }
const msText = (ms: number | undefined) => (ms === undefined ? undefined : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`)
const mid = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, Math.ceil((n - 1) / 2))}…${s.slice(s.length - Math.floor((n - 1) / 2))}`)
/** When the grant stops authorising, said by what the credential is. */
const expiryText = (m: Machine | undefined): string | undefined => {
  if (!m || m.expiresAt === undefined) return undefined
  if (m.expiresAt === null) return 'never'
  return m.credential === 'expired' ? `ended ${when(m.expiresAt)}` : when(m.expiresAt)
}
const grantCount = (m: Machine | undefined) => (m?.grant ? m.grant.filter(g => (OPS as readonly string[]).includes(g)).length : undefined)

// ---------------------------------------------------------------- the route

interface Geo {
  readonly w: number; readonly h: number
  /** The box of this machine: its x range, its height. */
  readonly hx0: number; readonly hx1: number; readonly hh: number
  /** The boxes of the connected machines: their x range, the height of one, the step between two, how many show. */
  readonly mx0: number; readonly mx1: number; readonly bh: number; readonly step: number; readonly max: number
  readonly cy: number
  /** Characters of a name that fit in a box, and where its dot and name start in the box. */
  readonly chars: number; readonly off: number
  /** The round trip and the grant, under the route. */
  readonly blocks: boolean
}
const COMPACT: Geo = {w: 140, h: 146, hx0: 4, hx1: 40, hh: 30, mx0: 78, mx1: 138, bh: 16, step: 20, max: 4, cy: 48, chars: 7, off: 16, blocks: true}
const WHOLE: Geo = {w: 194, h: 146, hx0: 6, hx1: 60, hh: 30, mx0: 106, mx1: 188, bh: 16, step: 20, max: 4, cy: 48, chars: 12, off: 17, blocks: true}
const TILE: Geo = {w: 112, h: 78, hx0: 4, hx1: 26, hh: 24, mx0: 54, mx1: 108, bh: 16, step: 20, max: 3, cy: 39, chars: 7, off: 13, blocks: false}

/** The line from this machine to one machine: its standing draws it. */
function Line({x1, y1, x2, y2, state, strong}: {x1: number; y1: number; x2: number; y2: number; state: State | undefined; strong: boolean}) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const cls = state === 'ready' ? 'dp-curve' : state === 'composed' ? 'dp-curve-on' : 'dp-faint'
  const dash = state === 'ready' ? undefined : state === 'composed' ? '4 3' : state === 'disconnected' ? '1 3' : state === undefined ? '2 3' : '3 3'
  return <g opacity={strong ? 1 : 0.5}>
    <path d={`M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} className={cls} strokeDasharray={dash} style={strong ? {strokeWidth: 2} : undefined} />
    {(state === 'refused' || state === 'incompatible') && <path d={`M${mx - 3} ${my - 3}l6 6M${mx + 3} ${my - 3}l-6 6`} className="rc-cross" />}
  </g>
}

/** The round trip of the chosen machine on a log scale, and the grant of the chosen connection as one tick for each operation. */
function Under({g, chosen}: {g: Geo; chosen: Machine | undefined}) {
  const x0 = 8, x1 = g.w - 8, y = 109
  const at = (ms: number) => x0 + (x1 - x0) * clampTo(0, 1, Math.log(Math.max(ms, RTT_LO) / RTT_LO) / Math.log(RTT_HI / RTT_LO))
  const rtt = chosen?.rtt
  const pitch = (x1 - x0) / OPS.length, tw = pitch - 2.4
  const count = grantCount(chosen)
  return <g>
    <path d={`M${x0} ${y}H${x1}`} className="dp-faint" />
    {RTT_TICKS.map(([ms, name]) => <g key={name}>
      <path d={`M${at(ms)} ${y - 2.5}v5`} className="dp-faint" />
      <text x={at(ms)} y={y + 10} className="dp-axis" textAnchor="middle">{name}</text>
    </g>)}
    {rtt !== undefined && <g>
      <path d={`M${x0} ${y}H${at(rtt)}`} className="dp-curve" style={{strokeWidth: 2.5}} />
      <circle cx={at(rtt)} cy={y} r={2.6} className="rc-rtt" />
    </g>}
    <text x={x0} y={y - 9} className={rtt === undefined ? 'dp-axis' : 'dp-ink-dim'}>
      {chosen === undefined ? 'No machine chosen' : rtt === undefined ? 'No reading of the round trip' : <><tspan className="dp-axis">round trip </tspan>{msText(rtt)}</>}
    </text>
    {OPS.map((op, i) => <rect key={op} x={x0 + i * pitch} y={124} width={tw} height={7} className="rc-tick"
      data-granted={chosen?.grant === undefined ? 'unknown' : chosen.grant.includes(op) ? 'true' : 'false'} />)}
    <text x={x0} y={141} className="dp-axis">{count === undefined ? 'No reading of the grant' : <><tspan className="dp-ink-dim">grant </tspan>{count} of {OPS.length}</>}</text>
  </g>
}

/** The route, drawn from the connections and the place. Handle 1 stands where the session runs. */
function Route({p, g, live}: {p: ViewProps; g: Geo; live?: boolean}) {
  const v = p.v, machines = machinesOf(v), chosen = chosenOf(v, machines), where = whereOf(v)
  const idx = chosen ? machines.indexOf(chosen) : -1
  const start = machines.length > g.max ? Math.min(Math.max(0, idx - (g.max - 1)), machines.length - g.max) : 0
  const shown = machines.slice(start, start + g.max), n = shown.length
  const ys = shown.map((_, k) => g.cy + (k - (n - 1) / 2) * g.step)
  const carried = where === 'connected' && chosen ? shown.indexOf(chosen) : -1
  const here = {x: g.hx1, y: g.cy}
  const at = carried >= 0 ? {x: g.mx0, y: ys[carried]!} : here
  const roomy = g.hx1 - g.hx0 > 30
  const canDrag = live && n > 0 && !st(p, 'where').disabled
  const drag = (x: number, y: number) => {
    let best = {i: -1, d: (x - here.x) ** 2 + (y - here.y) ** 2}
    shown.forEach((_, k) => { const d = (x - g.mx0) ** 2 + (y - ys[k]!) ** 2; if (d < best.d) best = {i: k, d} })
    if (best.i < 0) { if (where !== 'this') p.set('where', 'this'); return }
    const m = shown[best.i]!
    if (where !== 'connected') p.set('where', 'connected')
    if (chosen?.id !== m.id) p.set('machine', m.id)
  }
  const note = !has(v, 'machines') ? (g.blocks ? 'No reading of the machines' : 'No reading') : n === 0 ? 'No machine connected' : where === undefined ? 'No reading of Where' : undefined
  return <>
    {shown.map((m, k) => <Line key={m.id} x1={g.hx1} y1={g.cy} x2={g.mx0} y2={ys[k]!} state={m.state} strong={m.id === chosen?.id} />)}
    <rect className="rc-box" x={g.hx0} y={g.cy - g.hh / 2} width={g.hx1 - g.hx0} height={g.hh} rx={2} data-on={where === 'this' ? 'true' : undefined} />
    <text x={(g.hx0 + g.hx1 - 5) / 2} y={roomy ? g.cy - 2 : g.cy + 3} className="dp-ink" textAnchor="middle">this</text>
    {roomy && <text x={(g.hx0 + g.hx1 - 5) / 2} y={g.cy + 8} className="dp-ink-dim" textAnchor="middle">machine</text>}
    {n === 0 && <rect className="rc-box" x={g.mx0} y={g.cy - g.bh / 2} width={g.mx1 - g.mx0} height={g.bh} rx={2} strokeDasharray="3 3" />}
    {shown.map((m, k) => <g key={m.id}>
      <rect className="rc-box" x={g.mx0} y={ys[k]! - g.bh / 2} width={g.mx1 - g.mx0} height={g.bh} rx={2}
        data-chosen={m.id === chosen?.id ? 'true' : undefined} data-on={k === carried ? 'true' : undefined} />
      <circle cx={g.mx0 + g.off - 7} cy={ys[k]!} r={3} className="rc-dot" data-state={m.state ?? 'none'} />
      <text x={g.mx0 + g.off} y={ys[k]! + 3} className={m.id === chosen?.id ? 'dp-ink' : 'dp-ink-dim'}>{mid(m.id, g.chars)}</text>
    </g>)}
    {machines.length > n && <text x={g.mx1} y={ys[n - 1]! + g.bh / 2 + 8} className="dp-axis" textAnchor="end">{machines.length - n} more</text>}
    {note && <text x={g.w / 2} y={g.blocks ? (n === 0 ? 82 : 94) : g.h - 6} className="dp-axis" textAnchor="middle">{note}</text>}
    {g.blocks && <Under g={g} chosen={chosen} />}
    {live && where !== undefined && <Handle x={at.x} y={at.y} n={1} shape="ring" label="Place" does={SAYS.place}
      onDrag={canDrag ? drag : undefined} onReset={canDrag ? () => p.set('where', 'this') : undefined} />}
  </>
}

function RouteDisplay({p, g, live = true}: {p: ViewProps; g: Geo; live?: boolean}) {
  const chosen = chosenOf(p.v, machinesOf(p.v))
  return <Display w={g.w} h={g.h} label="The route" does={SAYS.route} corner={stateWord(chosen) ?? NONE}>
    <Route p={p} g={g} live={live} />
  </Display>
}

// ---------------------------------------------------------------- the controls and the readings

const whereRadio = (p: ViewProps) => {
  const none = has(p.v, 'machines') && machinesOf(p.v).length === 0
  const standing = st(p, 'where')
  return <Radio label="Where" does={SAYS.where} value={whereOf(p.v) ?? ''} options={WHERE} stack onChange={x => p.set('where', x)}
    {...standing} disabled={standing.disabled ?? (none ? 'No machine is connected.' : undefined)} />
}
const machineChooser = (p: ViewProps) => {
  const machines = machinesOf(p.v), standing = st(p, 'machine')
  return <Chooser label="Machine" does={SAYS.machine} value={chosenOf(p.v, machines)?.id ?? ''} wide
    options={machines.map(m => ({value: m.id, label: m.id}))} onChange={id => p.set('machine', id)}
    {...standing} disabled={standing.disabled ?? (!has(p.v, 'machines') ? 'No reading of the machines.' : machines.length === 0 ? 'No machine is connected.' : undefined)} />
}
const standingReadout = (v: V) => {
  const m = chosenOf(v, machinesOf(v))
  return <Readout label="standing" does={m?.state ? (refusedState(m.state) ? `${STATE_SAYS[m.state]} ${reasonOf(m)}` : STATE_SAYS[m.state]) : 'Whether the chosen machine can carry the session now.'}
    value={stateWord(m)} tone={stateTone(m?.state)} />
}
const rttReadout = (v: V) => <Readout label="round trip" does="The time for one message to go to the chosen machine and return." value={msText(chosenOf(v, machinesOf(v))?.rtt)} tone="value" />
const credReadout = (v: V) => {
  const m = chosenOf(v, machinesOf(v))
  return <Readout label="credential" does={m?.credential ? CRED_SAYS[m.credential] : 'Whether the chosen machine accepts you.'}
    value={m?.credential ? CRED_WORD[m.credential] : undefined} tone={credTone(m?.credential)} />
}

/** The grant: one row for each operation, lit where the connection may do it. */
function GrantRows({m}: {m: Machine | undefined}) {
  const count = grantCount(m)
  const items: RowItem[] = OPS.map(op => {
    const granted = m?.grant === undefined ? undefined : m.grant.includes(op)
    return {id: op, name: op, light: granted === undefined ? 'unknown' : granted ? 'lit' : 'dark', tone: 'value',
      does: granted === undefined ? 'No reading of the grant.' : granted ? 'The connection may do this.' : 'The connection may not do this.'}
  })
  return <Rows label={m === undefined ? 'Grant · no machine chosen' : count === undefined ? 'Grant · no reading' : `Grant · ${count} of ${OPS.length}`}
    does="The operations the machine allows this connection. Advertising is not a grant." items={items} size={OPS.length} columns={2} />
}

/** The terms of the chosen connection. A term the owner did not give is "—". */
function Terms({m}: {m: Machine | undefined}) {
  if (!m) return <p className="rc-none">No machine chosen.</p>
  const rows: readonly [string, string | undefined, string][] = [
    ['Machine', m.name, 'The Workcell at the other end.'],
    ['Endpoint', m.endpoint, 'Where the control plane listens.'],
    ['Protocol', m.protocol, 'The control protocol both machines agreed on.'],
    ['Reached', m.mode, 'The way in that the endpoint looks like.'],
    ['Expires', expiryText(m), 'When the grant stops authorising.'],
    ...(refusedState(m.state) ? [['Reason', reasonOf(m), 'Why the machine cannot carry the session.'] as [string, string | undefined, string]] : []),
  ]
  return <dl className="rc-terms">
    {rows.map(([k, x, says]) => <div key={k} style={{display: 'contents'}} data-i={`${k}|${says}${x === undefined ? ' The owner gave none.' : ''}`}>
      <dt>{k}</dt><dd data-none={x === undefined ? 'true' : undefined} data-reason={k === 'Reason' ? 'true' : undefined}>{x ?? NONE}</dd>
    </div>)}
  </dl>
}

const head = (p: ViewProps) => ({light: lightOf(p), onFold: p.nav.fold, onFull: p.nav.full})
const placeName = (v: V): string | undefined => {
  const where = whereOf(v), chosen = chosenOf(v, machinesOf(v))
  return where === 'this' ? 'This machine' : where === 'connected' ? chosen?.id : undefined
}

// ---------------------------------------------------------------- the pane: one machine at full size

function Pane({v}: {v: V}) {
  const machines = machinesOf(v), chosen = chosenOf(v, machines), where = whereOf(v)
  if (!has(v, 'machines')) return <div className="rc-pane"><div className="rc-strip"><span className="rc-strip-none">Remote carrier</span></div>
    <div className="rc-body" data-none="true"><p className="rc-empty">No reading of the machines.</p></div></div>
  const sessions = chosen?.sessions
  const grant = chosen?.grant, count = grantCount(chosen)
  return <div className="rc-pane">
    <div className="rc-strip" aria-label="Machines">
      {machines.length === 0 && <span className="rc-strip-none">No machine connected</span>}
      {machines.map(m => <span key={m.id} className="rc-chip" aria-current={m.id === chosen?.id ? 'true' : undefined}>
        <Lamp state={lampOf(m.state).light} tone={lampOf(m.state).tone} label={m.state ? `${m.id}: ${STATE_WORD[m.state]}` : `${m.id}: no reading`} />{m.id}
      </span>)}
      <span className="rc-strip-where">{where === undefined ? NONE : where === 'this' ? 'the session runs on this machine' : chosen ? `the session runs on ${chosen.id}` : 'the session has no machine'}</span>
    </div>
    <div className="rc-body" data-none={chosen ? undefined : 'true'}>
      {!chosen ? <p className="rc-empty">{machines.length === 0 ? 'No machine is connected.' : 'No machine is chosen. Choose one in Device view.'}</p> : <>
        <div className="rc-main">
          <div className="rc-main-head" aria-label="The machine"><b>{chosen.id}</b><span>{chosen.name}</span><span>{chosen.endpoint ?? NONE}</span><span>{stateWord(chosen) ?? NONE}</span></div>
          <h4>Sessions on {chosen.name}</h4>
          {sessions === undefined ? <p className="rc-empty">No reading of the sessions.</p>
            : sessions.length === 0 ? <p className="rc-empty">No session runs there.</p>
            : <ol className="rc-list" aria-label="Sessions">
              {sessions.map(s => <li key={s.id} className="rc-session"><span className="rc-sname">{s.name}</span><span className="rc-skind">{s.kind ?? NONE}</span><span className="rc-sseat">{s.seat ?? NONE}</span></li>)}
            </ol>}
          <h4>Grant · {count === undefined ? 'no reading' : `${count} of ${OPS.length} operations`}</h4>
          <ul className="rc-ops" aria-label="Operations">
            {OPS.map(op => <li key={op} data-granted={grant === undefined ? 'unknown' : grant.includes(op) ? 'true' : 'false'}>{op}</li>)}
          </ul>
        </div>
        <aside className="rc-reads" aria-label="Readings">
          <section className="rc-read"><h4>Standing</h4>
            <strong data-state={chosen.state ?? 'none'}>{stateWord(chosen) ?? NONE}</strong>
            <p>{chosen.state ? (refusedState(chosen.state) ? reasonOf(chosen) : STATE_SAYS[chosen.state].split(': ')[1]) : 'No reading of the standing.'}</p></section>
          <section className="rc-read"><h4>Round trip</h4>
            <strong data-state={chosen.rtt === undefined ? 'none' : undefined}>{msText(chosen.rtt) ?? NONE}</strong>
            <p>{chosen.rtt === undefined ? 'No reading of the round trip.' : 'one message, there and back'}</p></section>
          <section className="rc-read"><h4>Credential</h4>
            <strong data-state={chosen.credential === 'valid' ? 'ready' : chosen.credential ?? 'none'}>{chosen.credential ? CRED_WORD[chosen.credential] : NONE}</strong>
            <p>expires <b>{expiryText(chosen) ?? NONE}</b></p>
            <p>kept at <b>{chosen.credRef ?? NONE}</b></p></section>
          <section className="rc-read"><h4>Link</h4>
            <p>protocol <b>{chosen.protocol ?? NONE}</b></p>
            <p>reached <b>{chosen.mode ?? NONE}</b></p>
            <p>software <b>{chosen.software ?? NONE}</b></p>
            <p>connected <b>{chosen.since === undefined ? NONE : when(chosen.since)}</b></p></section>
        </aside>
      </>}
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

const SESSIONS = [
  {id: 'oi-link', name: 'oi-link', kind: 'resident'},
  {id: 'oi-build', name: 'oi-build', kind: 'resident'},
  {id: 'worker', name: 'worker', kind: 'resident'},
]
/** The two connections this Mac holds to workcell:omarchy (`workcell status --json`), as the host words them. The first allows reads only
 * and has no expiry; the second allows a carry and its grant has ended. */
const MACHINES = [
  {id: 'omarchy', name: 'workcell:omarchy', endpoint: '100.92.62.101:7777', protocol: 'workcell.control/v1', state: 'composed', credential: 'valid', expiresAt: null,
    grant: ['status', 'discover', 'observe', 'inspect'], mode: 'private-tailnet', software: 'workcell 0.1.0 (174fa1c3133a)', since: 1790237685095,
    credRef: 'keychain://workcell-connection/omarchy', sessions: SESSIONS},
  {id: 'omarchy-improvement-lanes', name: 'workcell:omarchy', endpoint: '100.92.62.101:7777', protocol: 'workcell.control/v1', state: 'refused',
    why: 'The grant expired on the serving machine. Ask its operator to authorise again.', credential: 'expired', expiresAt: 1791419267453,
    grant: ['status', 'discover', 'plan', 'prepare', 'inspect', 'observe', 'recover', 'collect', 'release'], mode: 'private-tailnet',
    software: 'workcell 0.1.0 (174fa1c3133a)', since: 1791417468786},
]
/** The first connection once it carries: a grant that allows a carry, a future expiry and a measured round trip. */
const READY = [{...MACHINES[0]!, state: 'ready', expiresAt: 1793000000000, rtt: 14,
  grant: ['status', 'discover', 'plan', 'prepare', 'inspect', 'observe', 'recover', 'collect', 'release']}, MACHINES[1]!]

/** Every key the owners report or the shell holds: the "No readings" fixture drops all of them. */
const KEYS = ['light', 'here', 'where', 'machine', 'machines']
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'workcell:remote-carrier',
  title: 'Remote carrier',
  kind: 'connection',
  defaults: {light: 'dark', here: 'workcell:mac', where: 'this', machine: 'omarchy', machines: JSON.stringify(MACHINES)},
  fixtures: {
    'Reads only, one grant ended': {},
    'Ready and carried': {light: 'lit', where: 'connected', machine: 'omarchy', machines: JSON.stringify(READY)},
    'No readings': NOTHING,
  },

  folded: p => <Folded title="Remote carrier" light={lightOf(p)}
    readings={[placeName(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Remote carrier" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <RouteDisplay p={p} g={COMPACT} />
    </Section>
    <Section label="Place" cols={2}>
      <div className="rc-span">{whereRadio(p)}</div>
      <div className="rc-span">{machineChooser(p)}</div>
    </Section>
    <Section label="Reading" width={80}>
      {standingReadout(p.v)}
    </Section>
  </Panel>,

  whole: p => {
    const chosen = chosenOf(p.v, machinesOf(p.v))
    return <Panel title="Remote carrier" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <RouteDisplay p={p} g={WHOLE} />
        </Section>
        <Section label="Place" cols={2}>
          <div className="rc-span">{whereRadio(p)}</div>
          <div className="rc-span">{machineChooser(p)}</div>
        </Section>
        <Section label="Reading" grow>
          {standingReadout(p.v)}
          {credReadout(p.v)}
        </Section>
      </Band>
      <Band>
        <Section label="Grant" width={212}>
          <GrantRows m={chosen} />
        </Section>
        <Section label="Link" grow>
          <Terms m={chosen} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <Pane v={p.v} />,

  widget: p => {
    return <Tile title="Remote carrier" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <div className="rc-tile-pic">
        <RouteDisplay p={p} g={TILE} live={false} />
        <span className="rc-tile-name" data-i={`Place|${placeName(p.v) ?? 'No reading of the place.'}`}>{placeName(p.v) ?? NONE}</span>
      </div>
      <div className="rc-tile-side">
        {standingReadout(p.v)}
        {rttReadout(p.v)}
        {credReadout(p.v)}
      </div>
    </Tile>
  },
}
