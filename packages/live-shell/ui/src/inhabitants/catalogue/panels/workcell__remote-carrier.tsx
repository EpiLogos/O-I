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
//   offers     Offer[]          what the place the session runs can provide: `workcell discover --json` there (offers: offer_ref, port,
//                               provider_ref, health, availability; on a connected machine through the grant's `discover`); each is {ref,
//                               port, name?, health?, availability?}. No kernel route reaches discover yet.
//   plan       Plan             the run's needs laid on those offers: `workcell plan --json` with the run's demand (status satisfiable ·
//                               degraded · unsatisfiable; planned_bindings: logical_ref, necessity, offer_ref; degradations and omissions:
//                               requirement, necessity, reason); {status, bindings: [{ref, necessity, offer}], degradations, omissions}.
//                               No kernel route reaches plan yet.
//   runs       string[]         the runs `workcell worlds` names for the chosen world (the run-ledger slugs whose record names its
//                               world_ref), where it names several: the Standing page chooses whose needs the plan lays on the offers
//                               (`planRun`), and none is assumed. One run is that run; none stands absent with why.
// The Standing page draws the offers and the plan; the Route page the connections. Act: replan (asks `workcell plan` again).
// The shell holds and the owner is asked to write:  where ('this' · 'connected'), machine (a connection label). The shell holds:
//   planRun (the run chosen among `runs`).
//
// The Machine page (§19.18 "The Machine page"): what you declared for the machine beside what it holds, made good where it can be, and
// the way back to it. Its values stand under `mc.`: a binding hosts the page by prefixing the machine's own binding. The owner is Central
// (ctrl/src/machine.rs, ctrl/src/recovery.rs), through the kernel's invoke_action: machine.account, machine.declaration {role},
// machine.plan {role}, machine.verify {role} read; machine.apply {role}, machine.adopt-current change the machine or its declaration;
// central.recovery.plan {role} reads; central.recover {role} recovers. The page has three parts, one band each: Declared (the ledger, a
// lane for each kind, declared left of the spine and observed right, each declared tick in the plan's verdict), Reconcile (plan, apply
// and verify as stages; handle 1 on the stages sets Change) and Recover (plan, synchronise, apply and verify as stages).
//   mc.light, mc.roles [{role, path, requirements}], mc.host {platform, architecture, observedAt, ...}, mc.declared {bindings,
//   capabilities, packages, configurations, services}, mc.observed {capabilities, packages, configurations, services}, mc.plan {entries:
//   [{kind, id, status satisfied | missing | changeable | unsupported, port?, connector?, reason?}], summary}, mc.applied {outcome,
//   operations}, mc.verified {satisfied}, mc.recovery {synchronization, reason?, connector?, changes}, mc.recovered {outcome, stage?,
//   message?, synchronized?, applied?, operations?, satisfied?}.
// Settings the shell holds: mc.role, mc.mode (Change: off · propose · write), mc.refresh (manual · open). Held by the hand: mc.ask (the
//   act waiting for Confirm). Acts: mc.replan, mc.apply, mc.verify, mc.adopt, mc.recoveryPlan, mc.recover. Apply, Adopt and Recover
//   change the machine or its declaration: under Propose each waits for Confirm, and each is held.
// On the Machine page the pane is the Machine at full size (the four kinds side by side) and the tile its small ledger.
// A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {Action, Band, Chooser, Display, Folded, Handle, Lamp, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type Option, type RowItem, type Tone, unreadRows, NoReading} from '../../sdk/panel'
import {clampTo, has, json, NONE, prefixed, scoped, st, strOf, type DesignedDevice, type ViewProps} from './design'
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
  /** The round trip's own words under the route (Compact says it in its macro instead). */
  readonly rttWords?: boolean
}
const COMPACT: Geo = {w: 140, h: 146, hx0: 4, hx1: 40, hh: 30, mx0: 78, mx1: 138, bh: 16, step: 20, max: 4, cy: 48, chars: 7, off: 16, blocks: true}
const WHOLE: Geo = {w: 194, h: 146, hx0: 6, hx1: 60, hh: 30, mx0: 106, mx1: 188, bh: 16, step: 20, max: 4, cy: 48, chars: 12, off: 17, blocks: true, rttWords: true}
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
    {(g.rttWords || chosen === undefined || rtt === undefined) && <text x={x0} y={y - 9} className={rtt === undefined ? 'dp-axis' : 'dp-ink-dim'}>
      {chosen === undefined ? 'No machine chosen' : rtt === undefined ? 'No reading of the round trip' : <><tspan className="dp-axis">round trip </tspan>{msText(rtt)}</>}
    </text>}
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
  return <Rows label={m === undefined ? 'Grant · no machine chosen' : count === undefined ? 'Grant' : `Grant · ${count} of ${OPS.length}`} why={count === undefined && m !== undefined ? 'No reading of the grant.' : undefined}
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

// ---------------------------------------------------------------- the standing: the offers there, and the run's plan on them

interface Offer {readonly ref: string; readonly port: string; readonly name?: string; readonly health?: string; readonly availability?: string}
interface Need {readonly requirement: string; readonly necessity?: string; readonly reason?: string}
interface Plan {readonly status?: string; readonly bindings: readonly {readonly ref: string; readonly necessity?: string; readonly offer: string}[]; readonly degradations: readonly Need[]; readonly omissions: readonly Need[]}
const offersOf = (v: V): Offer[] | undefined => {
  const raw = json<unknown>(v, 'offers', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((o): Offer[] => { const r = o && typeof o === 'object' ? o as Record<string, unknown> : {}; const ref = text(r.ref), port = text(r.port)
    return ref && port ? [{ref, port, name: text(r.name), health: text(r.health), availability: text(r.availability)}] : [] })
}
const needs = (x: unknown): Need[] => (Array.isArray(x) ? x.flatMap((n): Need[] => { const r = n && typeof n === 'object' ? n as Record<string, unknown> : {}; const q = text(r.requirement)
  return q ? [{requirement: q, necessity: text(r.necessity), reason: text(r.reason)}] : [] }) : [])
/** The runs to choose among, where the owner names several for the chosen world; undefined otherwise. */
const runsOf = (v: V): string[] | undefined => {
  const raw = json<unknown>(v, 'runs', undefined)
  const runs = Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string' && r.length > 0) : []
  return runs.length > 1 ? runs : undefined
}
const runChooser = (p: ViewProps, runs: readonly string[]) => <Chooser {...st(p, 'planRun')} label="Run" wide
  does="The runs Workcell names for the chosen world. Choose the one whose needs the plan lays on the offers. None is assumed."
  value={strOf(p.v, 'planRun') ?? ''} options={[{value: '', label: 'Choose a run'}, ...runs.map(run => ({value: run, label: run}))]} onChange={x => p.set('planRun', x || undefined)} />
const planOf = (v: V): Plan | undefined => {
  const raw = json<unknown>(v, 'plan', undefined)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const bindings = Array.isArray(r.bindings) ? r.bindings.flatMap(b => { const q = b && typeof b === 'object' ? b as Record<string, unknown> : {}; const ref = text(q.ref), offer = text(q.offer)
    return ref && offer ? [{ref, offer, necessity: text(q.necessity)}] : [] }) : []
  return {status: text(r.status), bindings, degradations: needs(r.degradations), omissions: needs(r.omissions)}
}
const PLAN_WORD: Readonly<Record<string, string>> = {satisfiable: 'Satisfiable', degraded: 'Degraded', unsatisfiable: 'Unsatisfiable'}
const planTone = (s: string | undefined): Tone | undefined => (s === 'satisfiable' ? 'green' : s === 'degraded' ? 'accent' : s ? 'stall' : undefined)
/** The rows of the offers picture: Workcell's ports, and the exposures a plan asks for. */
const LANES: readonly (readonly [string, string])[] = [['workspace', 'workspace'], ['execution', 'execution'], ['project-runtime', 'runtime'], ['service', 'service'],
  ['storage', 'storage'], ['artifact-storage', 'artifacts'], ['exposure', 'exposure']]
/** The lane a requirement the plan could not place belongs to, by its kind. */
const laneOfNeed = (q: string) => (q.startsWith('exposure:') ? 'exposure' : q.startsWith('connectivity:') || q.startsWith('service:') ? 'service' : q.startsWith('workspace') ? 'workspace'
  : q.startsWith('output') ? 'artifact-storage' : q.startsWith('storage') ? 'storage' : q.startsWith('runtime') ? 'project-runtime' : 'execution')
const needName = (q: string) => q.replace(/^(connectivity:|affordance:|exposure:|service:)+/, '').replace(/\/.*$/, '')

/** The offers, a row for each port: a square for each offer, green healthy, amber degraded, crossed down. The plan over them: a ring round
 * each offer it chose (solid what the run requires, dashed what it prefers), orange where the choice is degraded, and an orange cross at
 * the end of a row for what no offer can meet. */
function OffersDisplay({v, w, h}: {v: V; w: number; h: number}) {
  const offers = offersOf(v), plan = planOf(v)
  const corner = plan?.status ? PLAN_WORD[plan.status] ?? plan.status : NONE
  if (!offers) return <Display w={w} h={h} label="Offers and plan" corner={corner}><text x={8} y={22} className="dp-ink">No reading of the offers</text></Display>
  const lx = 52, top = 18, step = 17, cell = 9, pitch = 13
  const degraded = new Set((plan?.degradations ?? []).map(d => d.requirement))
  return <Display w={w} h={h} label="Offers and plan" does="A row for each port: a square for each offer, green healthy, amber degraded, crossed down. A ring round each offer the run's plan chose; an orange cross for what no offer meets." corner={corner}>
    {LANES.map(([lane, name], k) => {
      const y = top + k * step, row = offers.filter(o => o.port === lane)
      const missed = (plan?.omissions ?? []).filter(o => laneOfNeed(o.requirement) === lane)
      return <g key={lane}>
        <text x={6} y={y + 3} className="dp-axis">{name}</text>
        <path d={`M${lx - 4} ${y}H${w - 6}`} className="dp-grid" />
        {row.map((o, i) => {
          const x = lx + i * pitch, down = o.health === 'unavailable', chose = plan?.bindings.filter(b => b.offer === o.ref) ?? []
          const bad = chose.some(b => degraded.has(b.ref))
          return <g key={o.ref}>
            <rect x={x} y={y - cell / 2} width={cell} height={cell} rx={1} fill={o.health === 'healthy' ? 'var(--green)' : 'none'} stroke={o.health === 'healthy' ? 'none' : down ? 'var(--text-faint)' : 'var(--dp-on)'}><title>{`${o.name ?? o.ref} · ${o.health ?? NONE}`}</title></rect>
            {down && <path d={`M${x + 1.5} ${y - 3}l6 6M${x + 7.5} ${y - 3}l-6 6`} stroke="var(--text-faint)" strokeWidth={1} />}
            {chose.length > 0 && <rect x={x - 2.5} y={y - cell / 2 - 2.5} width={cell + 5} height={cell + 5} rx={2} fill="none" stroke={bad ? 'var(--stall)' : 'var(--dp-on)'} strokeWidth={1.3}
              strokeDasharray={chose.every(b => b.necessity !== 'required') ? '2 2' : undefined} />}
          </g>
        })}
        {missed.map((m, i) => { const x = w - 12 - i * 12; return <path key={m.requirement} d={`M${x - 3.5} ${y - 3.5}l7 7M${x + 3.5} ${y - 3.5}l-7 7`} stroke="var(--stall)" strokeWidth={1.5}><title>{`${m.requirement} · ${m.reason ?? NONE}`}</title></path> })}
      </g>
    })}
    {!plan && <text x={w - 6} y={h - 5} className="dp-axis" textAnchor="end">no reading of the plan</text>}
  </Display>
}

function StandingBands({p}: {p: ViewProps}) {
  const v = p.v, offers = offersOf(v), plan = planOf(v), runs = runsOf(v)
  const items: RowItem[] = !plan ? unreadRows('No reading of the plan.') : [
    ...plan.omissions.map((o): RowItem => ({id: `o:${o.requirement}`, name: needName(o.requirement), light: 'dark', note: `${o.necessity ?? NONE} · not met`, why: o.reason ?? 'Workcell gave no reason.'})),
    ...plan.degradations.map((d): RowItem => ({id: `d:${d.requirement}`, name: needName(d.requirement), light: 'lit', tone: 'accent', note: `${d.necessity ?? NONE} · degraded`, why: d.reason ?? 'Workcell gave no reason.'})),
    ...plan.bindings.filter(b => !plan.degradations.some(d => d.requirement === b.ref)).map((b): RowItem => ({id: `b:${b.ref}`, name: needName(b.ref), light: 'lit', tone: 'green', note: `${b.necessity ?? NONE} · ${b.offer.split(':').slice(1).join(':') || b.offer}`, does: `${b.ref} is met by ${b.offer}.`})),
  ]
  if (plan && items.length === 0) items.push({id: 'none', name: 'The run asks for nothing', light: 'dark'})
  return <Band>
    <Section width={206}><OffersDisplay v={v} w={194} h={146} /></Section>
    <Section label="Plan" width={104}>
      {runs && runChooser(p, runs)}
      <Readout label="plan" does="Whether the machine's offers meet the run's needs: satisfiable, degraded (a preferred need is met poorly) or unsatisfiable (a required need is not met)."
        value={plan?.status ? PLAN_WORD[plan.status] ?? plan.status : undefined} tone={planTone(plan?.status)} />
      <Readout label="offers up" does="Offers that answer healthy, of all the machine offers." value={offers ? `${offers.filter(o => o.health === 'healthy').length}/${offers.length}` : undefined} tone="green" />
      {standingReadout(v)}
      <Action {...st(p, 'replan')} label="Plan again" does="Lay the run's needs on the machine's offers again." onPress={() => p.set('replan', true)} />
    </Section>
    <Section label="Needs" grow>
      <Rows does="The run's needs as the plan placed them. Dark: no offer meets it. Amber: met poorly. Point at the ! for Workcell's reason." items={items} size={8} />
    </Section>
  </Band>
}

// ---------------------------------------------------------------- the pane: one machine at full size

function Pane({v}: {v: V}) {
  const machines = machinesOf(v), chosen = chosenOf(v, machines), where = whereOf(v)
  if (!has(v, 'machines')) return <div className="rc-pane"><div className="rc-strip"><span className="rc-strip-none">Remote carrier</span></div>
    <div className="rc-body" data-none="true"><p className="rc-empty">No reading of the machines.</p></div></div>
  const sessions = chosen?.sessions, plan = planOf(v)
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
          <h4>Grant · {count === undefined ? <NoReading name="Grant" why="No reading of the grant." /> : `${count} of ${OPS.length} operations`}</h4>
          <ul className="rc-ops" aria-label="Operations">
            {OPS.map(op => <li key={op} data-granted={grant === undefined ? 'unknown' : grant.includes(op) ? 'true' : 'false'}>{op}</li>)}
          </ul>
        </div>
        <aside className="rc-reads" aria-label="Readings">
          <section className="rc-read"><h4>Standing</h4>
            <strong data-state={chosen.state ?? 'none'}>{stateWord(chosen) ?? NONE}</strong>
            <p>{chosen.state ? (refusedState(chosen.state) ? reasonOf(chosen) : STATE_SAYS[chosen.state].split(': ')[1]) : 'No reading of the standing.'}</p></section>
          <section className="rc-read"><h4>Plan</h4>
            <strong data-state={plan?.status === 'satisfiable' ? 'ready' : plan?.status === 'degraded' ? 'composed' : plan?.status ? 'refused' : 'none'}>{plan?.status ? PLAN_WORD[plan.status] ?? plan.status : NONE}</strong>
            <p>{!plan ? 'No reading of the plan.' : plan.omissions.length ? `${plan.omissions.length} not met: ${plan.omissions.map(o => needName(o.requirement)).join(', ')}` : plan.degradations.length ? `${plan.degradations.length} met poorly` : 'every need met'}</p></section>
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

// ================================================================ the Machine page (`mc.` keys)

type Mode = 'off' | 'propose' | 'write'
type Kind = 'capability' | 'package' | 'configuration' | 'service'
type Status = 'satisfied' | 'missing' | 'changeable' | 'unsupported'
const KINDS: readonly {kind: Kind; key: string; name: string}[] = [
  {kind: 'capability', key: 'capabilities', name: 'capabilities'}, {kind: 'package', key: 'packages', name: 'packages'},
  {kind: 'configuration', key: 'configurations', name: 'configuration'}, {kind: 'service', key: 'services', name: 'services'}]
const MODES: readonly Mode[] = ['off', 'propose', 'write']
const MODE_OPTIONS = [{value: 'off', label: 'Off', does: 'The device only reads. Apply, Adopt and Recover are not offered.'},
  {value: 'propose', label: 'Propose', does: 'Apply, Adopt and Recover wait for your Confirm.'}, {value: 'write', label: 'Write', does: 'They run when you hold them, with a report.'}] as const
const REFRESH = [{value: 'manual', label: 'Manual', does: 'Read again only when you press Plan.'}, {value: 'open', label: 'On open', does: 'Read again when the device opens.'}] as const
const STATUS_TONE: Readonly<Record<Status, Tone | undefined>> = {satisfied: 'value', changeable: 'accent', missing: 'stall', unsupported: undefined}
const ACTS = {
  apply: {label: 'Apply', op: 'Make the changeable requirements so, through the connectors the plan names, then verify.'},
  adopt: {label: 'Adopt', op: 'Write what this machine holds into the role\'s declaration, under Control/machines. It never changes the machine.'},
  recover: {label: 'Recover', op: 'Synchronise your source, apply the plan, and verify, stage by stage. It stops at the first stage that fails.'},
} as const
type Act = keyof typeof ACTS

interface Entry {readonly kind: string; readonly id: string; readonly status: Status; readonly port?: string; readonly connector?: string; readonly reason?: string}
interface MPlan {readonly entries: readonly Entry[]; readonly summary?: Readonly<Record<Status, number>>}
interface Declared {readonly bindings: readonly {kind: string; reference: string}[]; readonly items: Readonly<Record<Kind, readonly string[]>>}
const rec = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
const ids = (x: unknown): string[] => (Array.isArray(x) ? x.flatMap(i => (typeof i === 'string' ? [i] : text(rec(i)?.id) ? [rec(i)!.id as string] : [])) : [])
const STATUSES: readonly string[] = ['satisfied', 'missing', 'changeable', 'unsupported']

function declaredOf(v: V): Declared | undefined {
  const d = rec(json<unknown>(v, 'declared', undefined))
  if (!d) return undefined
  const items = Object.fromEntries(KINDS.map(k => [k.kind, ids(d[k.key])])) as Record<Kind, string[]>
  const bindings = Array.isArray(d.bindings) ? d.bindings.flatMap(b => { const r = rec(b); return r && text(r.kind) && text(r.reference) ? [{kind: r.kind as string, reference: r.reference as string}] : [] }) : []
  return {bindings, items}
}
function observedOf(v: V): Record<Kind, string[]> | undefined {
  const o = rec(json<unknown>(v, 'observed', undefined))
  return o ? Object.fromEntries(KINDS.map(k => [k.kind, ids(o[k.key])])) as Record<Kind, string[]> : undefined
}
function mplanOf(v: V): MPlan | undefined {
  const p = rec(json<unknown>(v, 'plan', undefined))
  if (!p) return undefined
  const entries = (Array.isArray(p.entries) ? p.entries : []).flatMap((e): Entry[] => {
    const r = rec(e)
    return r && text(r.kind) && text(r.id) && typeof r.status === 'string' && STATUSES.includes(r.status)
      ? [{kind: r.kind as string, id: r.id as string, status: r.status as Status, port: text(r.port), connector: text(r.connector), reason: text(r.reason)}] : []
  })
  const s = rec(p.summary)
  const summary = s && STATUSES.every(k => typeof s[k] === 'number') ? s as Record<Status, number> : undefined
  return {entries, summary}
}
const objOf = (v: V, key: string) => rec(json<unknown>(v, key, undefined))
const modeOf = (v: V): Mode | undefined => { const m = strOf(v, 'mode'); return m === 'off' || m === 'propose' || m === 'write' ? m : undefined }
const kindOfEntry = (k: string): Kind | undefined => KINDS.find(x => x.kind === k || x.key === k)?.kind
const statusOf = (plan: MPlan | undefined, kind: Kind, id: string): Status | undefined => plan?.entries.find(e => kindOfEntry(e.kind) === kind && e.id === id)?.status
/** How far the machine is from its declaration: the requirements not satisfied. */
const toChange = (plan: MPlan | undefined) => (plan ? (plan.summary ? plan.summary.changeable + plan.summary.missing + plan.summary.unsupported : plan.entries.filter(e => e.status !== 'satisfied').length) : undefined)
const verdict = (v: V) => { const n = toChange(mplanOf(v)); return n === undefined ? NONE : n === 0 ? 'satisfied' : `${n} differ` }
const verifiedWord = (v: V) => { const x = objOf(v, 'verified'); return x ? (x.satisfied === true ? 'Satisfied' : 'Differs') : undefined }

/** Whether an act can run now, and if not, why. The host's standing for its key comes last. */
function actState(p: ViewProps, act: Act): {ok: boolean; why?: string} {
  const mode = modeOf(p.v)
  if (mode === undefined) return {ok: false, why: 'Change has no reading.'}
  if (mode === 'off') return {ok: false, why: 'Change is Off. Set it to Propose or Write.'}
  if (!has(p.v, 'role')) return {ok: false, why: 'No role is chosen.'}
  if (act === 'apply') { const plan = mplanOf(p.v); if (plan && !plan.entries.some(e => e.status === 'changeable')) return {ok: false, why: 'Nothing in the plan is changeable.'} }
  const held = st(p, act).disabled
  return held ? {ok: false, why: held} : {ok: true}
}
/** Under Propose an act waits for your Confirm; under Write it runs. */
const pressAct = (p: ViewProps, act: Act) => (modeOf(p.v) === 'propose' ? p.set('ask', act) : p.set(act, strOf(p.v, 'role') ?? true))

const LEVER = [-40, 0, 40]
/** The Change lever: Off, Propose, Write, with handle 1 on it. */
function Lever({p, cx, y}: {p: ViewProps; cx: number; y: number}) {
  const mode = modeOf(p.v), at = mode === undefined ? -1 : MODES.indexOf(mode)
  const drag = !st(p, 'mode').disabled ? (x: number) => p.set('mode', MODES[Math.round(clampTo(0, 2, (x - cx + 40) / 40))]!) : undefined
  return <g>
    <path d={`M${cx + LEVER[0]!} ${y}H${cx + LEVER[2]!}`} className="dp-faint" />
    {LEVER.map((dx, i) => <g key={i}>
      <circle cx={cx + dx} cy={y} r={1.8} fill="var(--text-faint)" />
      {mode !== undefined && <text x={cx + dx} y={y - 8} className="dp-axis" textAnchor="middle">{MODES[i]}</text>}
    </g>)}
    {mode === undefined ? <text x={cx} y={y - 8} className="dp-axis" textAnchor="middle">no reading of Change</text>
      : <Handle n={1} x={cx + LEVER[at]!} y={y} label="Change" does="Drag along the line: Off, Propose or Write. Propose waits for your Confirm."
        onDrag={drag} onReset={drag && (() => p.set('mode', 'propose'))} />}
  </g>
}

/** The ledger: a lane for each kind, named and counted; the declaration left of the spine in the plan's verdict (teal satisfied, amber
 * changeable, orange missing, crossed unsupported), what the machine holds right of it. */
function Ledger({p, w, h, small}: {p: ViewProps; w: number; h: number; small?: boolean}) {
  const v = p.v, declared = declaredOf(v), observed = observedOf(v), plan = mplanOf(v)
  const cx = w / 2, top = small ? 12 : 30, laneH = small ? (h - 18) / 4 : 26, pitch = small ? 3 : 4, half = cx - (small ? 8 : 52)
  const role = strOf(v, 'role'), bind = declared?.bindings.find(b => b.kind === 'workcell')?.reference
  return <g>
    {!small && <>
      <text x={7} y={12} className="dp-axis">declared · {role ?? NONE}</text>
      <text x={w - 7} y={12} className="dp-axis" textAnchor="end">observed</text>
      {bind && <text x={7} y={22} className="dp-ink-dim">{bind}</text>}
    </>}
    <path d={`M${cx} ${top - 6}V${top + laneH * 4 - 6}`} stroke="var(--text-dim)" strokeWidth={1} />
    {KINDS.map((k, i) => {
      const y = top + i * laneH + laneH / 2 - 6
      const mine = declared?.items[k.kind] ?? [], seen = observed?.[k.kind] ?? []
      const room = Math.floor(half / pitch)
      return <g key={k.kind}>
        {!small && <text x={7} y={y + 3} className="dp-axis">{k.name}</text>}
        {!small && <text x={7} y={y + 12} className="dp-ink-dim">{declared ? mine.length : NONE}</text>}
        {!small && <text x={w - 7} y={y + 3} className="dp-axis" textAnchor="end">{observed ? seen.length : NONE}</text>}
        {mine.slice(0, room).map((id, j) => {
          const s = statusOf(plan, k.kind, id), x = cx - 4 - j * pitch, t = s ? STATUS_TONE[s] : undefined
          return s === 'unsupported'
            ? <path key={id} d={`M${x - 1.5} ${y - 3}l3 6M${x + 1.5} ${y - 3}l-3 6`} stroke="var(--text-faint)" strokeWidth={1}><title>{`${id} · unsupported`}</title></path>
            : <path key={id} d={`M${x} ${y - 4}V${y + 4}`} strokeWidth={small ? 1.4 : 2} stroke={t === 'value' ? 'var(--dp-value)' : t === 'accent' ? 'var(--dp-on)' : t === 'stall' ? 'var(--stall)' : 'var(--text-dim)'}><title>{`${id} · ${s ?? 'not planned'}`}</title></path>
        })}
        {seen.slice(0, Math.floor((w - (small ? 6 : 26) - cx) / pitch)).map((id, j) => {
          const x = cx + 4 + j * pitch, wanted = mine.includes(id)
          return <path key={id} d={`M${x} ${y - 4}V${y + 4}`} strokeWidth={small ? 1.2 : 1.5} stroke={wanted ? 'var(--dp-value)' : 'var(--text-faint)'}><title>{id}</title></path>
        })}
        {declared && mine.length === 0 && !small && <text x={cx - 6} y={y + 3} className="dp-axis" textAnchor="end">none</text>}
      </g>
    })}
    {!declared && <text x={cx - 6} y={top + laneH * 4 + (small ? -2 : 4)} className="dp-axis" textAnchor="end">no declaration</text>}
    {!observed && <text x={cx + 6} y={top + laneH * 4 + (small ? -2 : 4)} className="dp-axis">not observed</text>}
  </g>
}

/** The stages of a road, left to right: a node for each, filled where it ran well, amber where it ran in part, crossed where it failed,
 * hollow where it has not run, dashed where nothing is configured. Under each, its result. */
type Stage = {name: string; state: 'ok' | 'part' | 'failed' | 'idle' | 'none'; result: string; unread?: boolean}
function Stages({p, w, h, stages, lever}: {p: ViewProps; w: number; h: number; stages: readonly Stage[]; lever?: boolean}) {
  const n = stages.length, x0 = 30, x1 = w - 30, y = 52
  const at = (i: number) => (n === 1 ? w / 2 : x0 + i * (x1 - x0) / (n - 1))
  return <g>
    {stages.slice(1).map((_, i) => <path key={i} d={`M${at(i) + 8} ${y}H${at(i + 1) - 8}`} className={stages[i]!.state === 'ok' ? 'dp-curve' : 'dp-faint'} />)}
    {stages.map((s, i) => {
      const x = at(i)
      return <g key={s.name}>
        {s.state === 'failed'
          ? <><circle cx={x} cy={y} r={6} fill="none" stroke="var(--stall)" strokeWidth={1.5} /><path d={`M${x - 3} ${y - 3}l6 6M${x + 3} ${y - 3}l-6 6`} stroke="var(--stall)" strokeWidth={1.5} /></>
          : <circle cx={x} cy={y} r={6} fill={s.state === 'ok' ? 'var(--dp-value)' : s.state === 'part' ? 'var(--dp-on)' : 'none'}
            stroke={s.state === 'idle' || s.state === 'none' ? 'var(--text-faint)' : 'none'} strokeDasharray={s.state === 'none' ? '2 2' : undefined} />}
        <text x={x} y={y - 12} className="dp-ink" textAnchor="middle">{s.name}</text>
        {s.result.split('\n').map((line, k) => <text key={k} x={x} y={y + 20 + k * 10} className="dp-axis" textAnchor="middle">{line}</text>)}
      </g>
    })}
    {lever && <Lever p={p} cx={w / 2} y={h - 8} />}
  </g>
}
const numIn = (o: Record<string, unknown> | undefined, k: string) => (typeof o?.[k] === 'number' ? o[k] as number : undefined)
function reconcileStages(v: V): Stage[] {
  const plan = mplanOf(v), applied = objOf(v, 'applied'), verified = objOf(v, 'verified'), n = toChange(plan)
  const outcome = text(applied?.outcome), ops = Array.isArray(applied?.operations) ? applied!.operations.length : undefined
  return [
    {name: 'plan', state: plan ? (n ? 'part' : 'ok') : 'idle', result: plan ? (n ? `${n} differ` : 'satisfied') : 'not read', ...(plan ? {} : {unread: true})},
    {name: 'apply', state: outcome === 'complete' ? 'ok' : outcome === 'partial' ? 'part' : outcome ? 'failed' : 'idle', result: outcome ? `${outcome}\n${ops ?? NONE} change${ops === 1 ? '' : 's'}` : 'not run'},
    {name: 'verify', state: verified?.satisfied === true ? 'ok' : verified?.satisfied === false ? 'failed' : 'idle', result: verified ? (verified.satisfied === true ? 'satisfied' : 'differs') : 'not run'},
  ]
}
const ORDER_OF_STAGES = ['synchronization', 'machine_apply', 'verification']
function recoverStages(v: V): Stage[] {
  const plan = objOf(v, 'recovery'), done = objOf(v, 'recovered'), sync = text(plan?.synchronization), failedAt = text(done?.stage)
  const stopped = (stage: string) => failedAt === stage
  const ranPast = (stage: string) => done !== undefined && !stopped(stage) && (failedAt === undefined || ORDER_OF_STAGES.indexOf(failedAt) > ORDER_OF_STAGES.indexOf(stage))
  const applied = text(done?.applied), ops = numIn(done, 'operations'), changes = numIn(plan, 'changes')
  return [
    {name: 'plan', state: plan ? 'ok' : 'idle', result: plan ? `${changes ?? NONE} to change` : 'not read', ...(plan ? {} : {unread: true})},
    {name: 'sync', state: sync === 'not_configured' ? 'none' : stopped('synchronization') ? 'failed' : ranPast('synchronization') ? 'ok' : sync === 'unavailable' ? 'failed' : 'idle',
      result: stopped('synchronization') ? 'failed' : ranPast('synchronization') && sync !== 'not_configured' ? (done?.synchronized === true ? 'changed' : 'unchanged') : sync ? sync.replace('_', ' ') : NONE},
    {name: 'apply', state: stopped('machine_apply') ? 'failed' : applied === 'complete' ? 'ok' : applied === 'partial' ? 'part' : 'idle', result: stopped('machine_apply') ? `${applied ?? 'failed'}` : applied ? `${applied}\n${ops ?? NONE} change${ops === 1 ? '' : 's'}` : 'not run'},
    {name: 'verify', state: stopped('verification') ? 'failed' : done?.satisfied === true ? 'ok' : 'idle', result: stopped('verification') ? 'differs' : done?.satisfied === true ? 'satisfied' : 'not run'},
  ]
}

const roleChooser = (p: ViewProps) => {
  const roles = (json<unknown[]>(p.v, 'roles', []) ?? []).flatMap(r => { const o = rec(r); return o && text(o.role) ? [{value: o.role as string, label: o.role as string, does: text(o.path)}] : [] })
  return <Chooser {...st(p, 'role')} label="Role" wide does="The declaration the machine is read against: a role under Control/machines." value={strOf(p.v, 'role') ?? ''} options={roles} onChange={x => p.set('role', x)} />
}
const modeRadio = (p: ViewProps) => <Radio {...st(p, 'mode')} label="Change" does="Off: only read. Propose: Apply, Adopt and Recover wait for your Confirm. Write: they run when you hold them, with a report." value={modeOf(p.v) ?? ''} options={MODE_OPTIONS} stack onChange={x => p.set('mode', x)} />

/** An act with its ask: the act itself, or, while it waits under Propose, Confirm and Cancel. */
function ActButton({p, act}: {p: ViewProps; act: Act}) {
  const can = actState(p, act), stand = st(p, act), t = ACTS[act]
  if (strOf(p.v, 'ask') === act) return <div className="rc-ask">
    <Action {...stand} hold label="Confirm" does={`${t.label}: ${t.op}`} onPress={() => { p.set(act, strOf(p.v, 'role') ?? true); p.set('ask', undefined) }} disabled={can.ok ? undefined : can.why} />
    <Action label="Cancel" does="Leave the machine as it is." onPress={() => p.set('ask', undefined)} />
  </div>
  return <Action {...stand} hold={modeOf(p.v) === 'write'} label={t.label} does={t.op} onPress={() => pressAct(p, act)} disabled={can.ok ? undefined : can.why} />
}

function entryRows(v: V, all: boolean): RowItem[] {
  const plan = mplanOf(v)
  if (!plan) return unreadRows('No reading of the plan.')
  const shownRows = plan.entries.filter(e => all || e.status !== 'satisfied')
  if (!shownRows.length) return [{id: 'none', name: plan.entries.length ? 'Every requirement is satisfied' : 'The declaration asks for nothing', light: 'lit', tone: 'green'}]
  return shownRows.map((e): RowItem => ({id: `${e.kind}:${e.id}`, name: e.id, light: e.status === 'unsupported' ? 'dark' : 'lit', tone: STATUS_TONE[e.status] ?? 'value',
    note: `${kindOfEntry(e.kind) ?? e.kind} · ${e.status}`, why: e.status === 'missing' || e.status === 'unsupported' ? e.reason ?? 'Central gave no reason.' : undefined,
    does: e.status === 'changeable' ? `Apply makes it so through ${e.connector ?? 'its connector'}${e.port ? ` (${e.port})` : ''}.` : `${e.kind} ${e.id}: ${e.status}.`}))
}

/** The Machine page: Declared, Reconcile and Recover, a band each. */
function MachineBands({p}: {p: ViewProps}) {
  const v = p.v, host = objOf(v, 'host'), done = objOf(v, 'recovered'), rp = objOf(v, 'recovery')
  return <>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="Declared" does="A lane for each kind, named and counted. Declared on the left of the spine, observed on the right. Teal satisfied, amber changeable, orange missing, crossed unsupported."
          corner={verdict(v)}>
          <Ledger p={p} w={194} h={146} />
        </Display>
      </Section>
      <Section label="Declared" width={104}>
        {roleChooser(p)}
        <Readout label="host" does="The machine as Central last observed it: its platform and architecture." value={text(host?.platform) ? `${text(host?.platform)} · ${text(host?.architecture) ?? NONE}` : undefined} />
        <Readout label="verified" does="Whether the machine met its declaration when last checked." value={verifiedWord(v)} tone={objOf(v, 'verified')?.satisfied === true ? 'green' : objOf(v, 'verified') ? 'stall' : undefined} />
        <Chooser {...st(p, 'refresh')} label="Refresh" wide does="When the device reads again." value={strOf(v, 'refresh') ?? ''} options={REFRESH} onChange={x => p.set('refresh', x)} />
      </Section>
      <Section label="Requirements" grow>
        <Rows does="Every requirement of the declaration and its verdict. Point at the ! for Central's reason." items={entryRows(v, true)} size={8} />
      </Section>
    </Band>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="Reconcile" does="Plan, apply, verify: each stage with its result. Drag handle 1 to set Change.">
          <Stages p={p} w={194} h={146} stages={reconcileStages(v)} lever />
        </Display>
      </Section>
      <Section label="Change" width={72}>{modeRadio(p)}</Section>
      <Section label="Reconcile" width={84}>
        <Action {...st(p, 'replan')} label="Plan" does="Compare the declaration with the machine again. It changes nothing." onPress={() => p.set('replan', strOf(v, 'role') ?? true)} />
        <ActButton p={p} act="apply" />
        <Action {...st(p, 'verify')} label="Verify" does="Observe the machine and check it against the declaration." onPress={() => p.set('verify', strOf(v, 'role') ?? true)} />
        <ActButton p={p} act="adopt" />
      </Section>
      <Section label="To change" grow>
        <Rows does="What the plan would change, and why the rest cannot be changed here." items={entryRows(v, false)} size={8} />
      </Section>
    </Band>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="Recover" does="Plan, synchronise, apply, verify: each stage of the way back with its result.">
          <Stages p={p} w={194} h={146} stages={recoverStages(v)} />
        </Display>
      </Section>
      <Section label="Recover" width={104}>
        <Readout label="synchronise" does="How your source synchronises before the machine is applied: not configured, satisfied, changeable or unavailable." value={text(rp?.synchronization)?.replace('_', ' ')} />
        <Readout label="last" does="How the last recovery ended." value={text(done?.outcome)} tone={text(done?.outcome) === 'complete' ? 'green' : done ? 'stall' : undefined} />
        <Action {...st(p, 'recoveryPlan')} label="Plan" does="Preview the synchronisation and the machine plan, changing nothing." onPress={() => p.set('recoveryPlan', strOf(v, 'role') ?? true)} />
        <ActButton p={p} act="recover" />
      </Section>
      <Section label="Stages" grow>
        {/* A stage with no reading (the plan not read) stands hollow, its words on the Info line; the well names it as the stage's result. */}
        <Rows does="Each stage of the last recovery, and where it stopped." items={recoverStages(v).map((s): RowItem => ({id: s.name, name: s.name, light: s.unread ? 'unknown' : s.state === 'ok' || s.state === 'part' || s.state === 'failed' ? 'lit' : 'dark',
          tone: s.state === 'ok' ? 'green' : s.state === 'part' ? 'accent' : 'stall', note: s.unread ? undefined : s.result.replace('\n', ' · '),
          why: s.unread ? 'No reading of the plan.' : s.state === 'failed' ? text(done?.message) ?? 'Central gave no reason.' : undefined}))} size={6} />
      </Section>
    </Band>
  </>
}

/** The Machine at full size: the four kinds side by side, each what you declared with its verdict and the connector that would change it,
 * and what else the machine holds; under them the last apply, the last verification and the last recovery. */
function MachinePane({p}: {p: ViewProps}) {
  const v = p.v, declared = declaredOf(v), observed = observedOf(v), plan = mplanOf(v), host = objOf(v, 'host'), applied = objOf(v, 'applied'), done = objOf(v, 'recovered')
  return <div className="ref-pane-body mc-pane">
    <div className="mc-top">
      <h3>Machine<small>{strOf(v, 'role') ?? NONE} · {text(host?.platform) ?? NONE} {text(host?.architecture) ?? ''}</small></h3>
      <span className="mc-verdict" data-ok={toChange(plan) === 0 ? 'true' : undefined}>{verdict(v)}</span>
    </div>
    <div className="mc-cols">
      {KINDS.map(k => {
        const mine = declared?.items[k.kind], seen = observed?.[k.kind], extra = seen?.filter(id => !mine?.includes(id)) ?? []
        return <section key={k.kind} className="mc-col">
          <h4>{k.name}<b>{mine ? mine.length : NONE} declared · {seen ? seen.length : NONE} observed</b></h4>
          {!declared ? <p className="mc-none">No reading of the declaration.</p> : mine!.length === 0 ? <p className="mc-none">None declared.</p>
            : <ul className="mc-list">{mine!.map(id => { const s = statusOf(plan, k.kind, id); const e = plan?.entries.find(x => kindOfEntry(x.kind) === k.kind && x.id === id)
              return <li key={id} data-status={s}><i /><b>{id}</b><span>{s ?? 'not planned'}{e?.connector ? ` · ${e.connector}` : ''}</span>{e?.reason && <em>{e.reason}</em>}</li> })}</ul>}
          {extra.length > 0 && <p className="mc-extra">Also on the machine: {extra.slice(0, 12).join(' · ')}{extra.length > 12 ? ` · +${extra.length - 12}` : ''}</p>}
        </section>
      })}
    </div>
    <div className="mc-foot">
      <span>Last apply <b>{text(applied?.outcome) ?? NONE}</b>{Array.isArray(applied?.operations) ? ` · ${applied!.operations.length} change${applied!.operations.length === 1 ? '' : 's'}` : ''}</span>
      <span>Verified <b>{verifiedWord(v) ?? NONE}</b></span>
      <span>Last recovery <b>{text(done?.outcome) ?? NONE}</b>{text(done?.message) ? ` · ${text(done?.message)}` : ''}</span>
    </div>
  </div>
}

/** What this Mac reported (machine.account, machine.plan, 21 Oct), with a workstation role declared beside it. */
const OBSERVED_CAPS = ['MachineInspector', 'claude-code@source:actuation-harness-capability', 'claude-code@source:workcell-harness-instance', 'codex@source:actuation-harness-capability',
  'cursor-cli@source:actuation-harness-detection', 'gemini@source:actuation-harness-capability', 'hermes-acp@source:actuation-harness-detection', 'hermes@source:actuation-harness-detection',
  'ollama@source:workcell-harness-instance', 'openclaw@source:actuation-harness-capability', 'opencode@source:workcell-harness-instance', 'pi@source:actuation-harness-capability',
  'pi@source:workcell-harness-instance', 'prime@source:workcell-harness-instance', 'zcode@source:actuation-harness-capability']
const WORKSTATION = {
  bindings: [{kind: 'workcell', reference: 'workcell:mac'}],
  capabilities: ['claude-code@source:actuation-harness-capability', 'codex@source:actuation-harness-capability', 'pi@source:actuation-harness-capability', 'hermes@source:actuation-harness-capability'],
  packages: [{id: 'git', state: 'present'}, {id: 'node', state: 'present'}, {id: 'rustup', state: 'present'}, {id: 'redis', state: 'present'}, {id: 'tailscale', state: 'present'}],
  configurations: [{id: 'git-config', state: 'present'}, {id: 'zshrc', state: 'present'}],
  services: [{id: 'redis-now', running: true, enabled: true}, {id: 'tailscaled', running: true}],
}
const WORKSTATION_PLAN = {
  entries: [
    {kind: 'capability', id: 'claude-code@source:actuation-harness-capability', status: 'satisfied'}, {kind: 'capability', id: 'codex@source:actuation-harness-capability', status: 'satisfied'},
    {kind: 'capability', id: 'pi@source:actuation-harness-capability', status: 'satisfied'},
    {kind: 'capability', id: 'hermes@source:actuation-harness-capability', status: 'unsupported', reason: 'No eligible Connector declares a compatible capability installer.'},
    {kind: 'package', id: 'git', status: 'satisfied'}, {kind: 'package', id: 'node', status: 'satisfied'},
    {kind: 'package', id: 'rustup', status: 'changeable', port: 'PackageManager', connector: 'homebrew'},
    {kind: 'package', id: 'redis', status: 'satisfied'}, {kind: 'package', id: 'tailscale', status: 'satisfied'},
    {kind: 'configuration', id: 'git-config', status: 'satisfied'},
    {kind: 'configuration', id: 'zshrc', status: 'changeable', port: 'ConfigurationSource', connector: 'personal.git-sync'},
    {kind: 'service', id: 'redis-now', status: 'satisfied'},
    {kind: 'service', id: 'tailscaled', status: 'missing', reason: 'The service is not observed, and no eligible Connector starts it.'},
  ],
  summary: {satisfied: 9, changeable: 2, missing: 1, unsupported: 1},
}
const MACHINE_DEFAULTS = {
  light: 'lit', role: 'workstation', mode: 'propose', refresh: 'open',
  roles: JSON.stringify([{role: 'current', path: 'Control/machines/current.json', requirements: 0}, {role: 'workstation', path: 'Control/machines/workstation.json', requirements: 13}]),
  host: JSON.stringify({hostname: 'unknown-host', platform: 'macos', architecture: 'aarch64', observedAt: 1792547554, stale: false, connector: 'read-models.harness-capability'}),
  declared: JSON.stringify(WORKSTATION),
  observed: JSON.stringify({capabilities: OBSERVED_CAPS, packages: ['git', 'node', 'redis', 'tailscale', 'ripgrep'], configurations: ['git-config'], services: ['redis-now']}),
  plan: JSON.stringify(WORKSTATION_PLAN),
  applied: JSON.stringify({outcome: 'partial', operations: [{kind: 'package', id: 'rustup', port: 'PackageManager', connector: 'homebrew', changed: true}]}),
  verified: JSON.stringify({satisfied: false}),
  recovery: JSON.stringify({synchronization: 'changeable', connector: 'personal.git-sync', changes: 4}),
}
const machineOf = (p: ViewProps) => scoped(p, 'mc.')

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

/** What this Mac offers (`workcell discover --json`, 21 Oct): two workspaces, the host process, four declared services, two artifact stores. */
const OFFERS = [
  {ref: 'collapsed-local-git-worktree:git-worktree', port: 'workspace', name: 'git-worktree', health: 'healthy', availability: 'available'},
  {ref: 'collapsed-local-workspace:directory', port: 'workspace', name: 'directory', health: 'healthy', availability: 'available'},
  {ref: 'collapsed-local-host-process:host-process', port: 'execution', name: 'host-process', health: 'healthy', availability: 'available'},
  {ref: 'collapsed-local-target-services:external-service:b4fedf1f', port: 'service', name: 'service:gliner25-decision/personal-workcell', health: 'unavailable', availability: 'degraded'},
  {ref: 'collapsed-local-target-services:external-service:4260858b', port: 'service', name: 'service:gliner25-ql-candidate/personal-workcell', health: 'unavailable', availability: 'degraded'},
  {ref: 'collapsed-local-target-services:external-service:2f3d70b9', port: 'service', name: 'service:kev-decision/personal-workcell', health: 'healthy', availability: 'available'},
  {ref: 'collapsed-local-target-services:external-service:205e52a7', port: 'service', name: 'service:redis-now/personal-workcell', health: 'healthy', availability: 'available'},
  {ref: 'collapsed-local-artifacts:artifact:9ebe24a8', port: 'artifact-storage', name: 'directory-artifact-storage', health: 'healthy', availability: 'available'},
  {ref: 'collapsed-local-artifacts:artifact:9289a082', port: 'artifact-storage', name: 'directory-artifact-storage', health: 'healthy', availability: 'available'},
]
/** A run's needs planned on those offers (`workcell plan --json`, 21 Oct): the shell and the NOW store met, the decision model met poorly, a preview
 * exposure not met. */
const PLAN = {status: 'degraded',
  bindings: [{ref: 'affordance:shell', necessity: 'required', offer: 'collapsed-local-host-process:host-process'},
    {ref: 'connectivity:service:redis-now/personal-workcell', necessity: 'required', offer: 'collapsed-local-target-services:external-service:205e52a7'},
    {ref: 'connectivity:service:gliner25-decision/personal-workcell', necessity: 'preferred', offer: 'collapsed-local-target-services:external-service:b4fedf1f'}],
  degradations: [{requirement: 'connectivity:service:gliner25-decision/personal-workcell', necessity: 'preferred', reason: 'selected offer is degraded or health is not fully known'}],
  omissions: [{requirement: 'exposure:preview', necessity: 'optional', reason: 'no offer supports this material requirement'}]}
/** The same needs on a connected machine that holds no NOW store: the plan cannot be met. */
const OFFERS_OMARCHY = OFFERS.filter(o => !o.ref.includes('external-service') && !o.ref.includes('workspace:directory'))
const PLAN_UNMET = {status: 'unsatisfiable', bindings: [PLAN.bindings[0]!],
  degradations: [], omissions: [{requirement: 'connectivity:service:redis-now/personal-workcell', necessity: 'required', reason: 'no offer supports this material requirement'},
    {requirement: 'connectivity:service:gliner25-decision/personal-workcell', necessity: 'preferred', reason: 'no offer supports this material requirement'},
    {requirement: 'exposure:preview', necessity: 'optional', reason: 'no offer supports this material requirement'}]}

/** Every key the owners report or the shell holds: the "No readings" fixture drops all of them. */
const KEYS = ['light', 'here', 'where', 'machine', 'machines', 'offers', 'plan', 'runs', 'planRun', ...Object.keys(MACHINE_DEFAULTS).map(k => `mc.${k}`)]
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))
const PAGE_IDS = ['route', 'standing', 'machine'] as const
const pageOf = (p: ViewProps): (typeof PAGE_IDS)[number] => (p.page === 'standing' || p.page === 'machine' ? p.page : 'route')

export const design: DesignedDevice = {
  id: 'workcell:remote-carrier',
  title: 'Remote carrier',
  kind: 'connection',
  firstPage: 'route',
  defaults: {light: 'dark', here: 'workcell:mac', where: 'this', machine: 'omarchy', machines: JSON.stringify(MACHINES), offers: JSON.stringify(OFFERS), plan: JSON.stringify(PLAN),
    ...prefixed('mc.', MACHINE_DEFAULTS) as Record<string, string>},
  fixtures: {
    'Reads only, one grant ended': {},
    'A plan that cannot be met': {light: 'lit', where: 'connected', machine: 'omarchy', machines: JSON.stringify(READY), offers: JSON.stringify(OFFERS_OMARCHY), plan: JSON.stringify(PLAN_UNMET)},
    'Ready and carried': {light: 'lit', where: 'connected', machine: 'omarchy', machines: JSON.stringify(READY)},
    // `workcell worlds` names two runs for the chosen world (read 28 Oct: this cell's run ledger): the Standing page asks whose plan to read.
    'Two runs for this world': {runs: JSON.stringify(['development-entry-build-20261008', 'development-entry-build-20261008-r2']), planRun: 'development-entry-build-20261008-r2'},
    'This Mac, nothing declared': prefixed('mc.', {role: 'current',
      declared: JSON.stringify({bindings: [{kind: 'workcell', reference: 'workcell:mac'}], capabilities: [], packages: [], configurations: [], services: []}),
      observed: JSON.stringify({capabilities: OBSERVED_CAPS, packages: [], configurations: [], services: []}), plan: JSON.stringify({entries: [], summary: {satisfied: 0, missing: 0, changeable: 0, unsupported: 0}}),
      applied: undefined, verified: JSON.stringify({satisfied: true}), recovery: JSON.stringify({synchronization: 'not_configured', changes: 0})}),
    'Recovered in part': prefixed('mc.', {recovered: JSON.stringify({outcome: 'partial', stage: 'machine_apply', message: 'Recovery machine application did not complete: one operation failed.',
      synchronized: true, applied: 'partial', operations: 1})}),
    'No readings': NOTHING,
  },

  folded: p => <Folded title="Remote carrier" light={lightOf(p)} onUnfold={p.nav.unfold} />,

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
      {rttReadout(p.v)}
    </Section>
  </Panel>,

  whole: p => {
    const chosen = chosenOf(p.v, machinesOf(p.v))
    const page = pageOf(p)
    const plan = planOf(p.v), differ = toChange(mplanOf(machineOf(p).v))
    const pages = [{id: 'route', label: 'Route'}, {id: 'standing', label: 'Standing', light: (plan?.status ? (plan.status === 'unsatisfiable' ? 'dark' : 'lit') : undefined) as LightState | undefined},
      {id: 'machine', label: 'Machine', light: (differ === undefined ? undefined : differ ? 'dark' : 'lit') as LightState | undefined}]
    return <Panel title="Remote carrier" view="whole" {...head(p)} pages={pages} page={page} onPage={p.setPage}>
      {page === 'standing' ? <StandingBands p={p} /> : page === 'machine' ? <MachineBands p={machineOf(p)} /> : <><Band>
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
      </Band></>}
    </Panel>
  },

  full: p => (pageOf(p) === 'machine' ? <MachinePane p={machineOf(p)} /> : <Pane v={p.v} />),

  widget: p => {
    if (pageOf(p) === 'machine') {
      const m = machineOf(p), differ = toChange(mplanOf(m.v))
      return <Tile title={`Machine · ${strOf(m.v, 'role') ?? NONE}`} light={lightOf(p)} span={2} onFull={p.nav.full}>
        <Display w={96} h={96} label="The machine" does="Declared left of the spine, observed right. Teal satisfied, amber changeable, orange missing.">
          <Ledger p={m} w={96} h={96} small />
        </Display>
        <div className="rc-tile-side">
          <Readout big label="differ" does="Requirements the machine does not meet as declared." value={differ} tone={differ ? 'accent' : 'green'} />
          <Readout label="verified" does="Whether the machine met its declaration when last checked." value={verifiedWord(m.v)} tone={objOf(m.v, 'verified')?.satisfied === true ? 'green' : objOf(m.v, 'verified') ? 'stall' : undefined} />
        </div>
      </Tile>
    }
    return <Tile title="Remote carrier" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <div className="rc-tile-pic">
        <RouteDisplay p={p} g={TILE} live={false} />
        <span className="rc-tile-name" data-i={`Machine|${placeName(p.v) ?? 'No reading of the place.'}`}>{placeName(p.v) ?? NONE}</span>
      </div>
      <div className="rc-tile-side">
        <Readout big label="round trip" does="The time for one message to go to the chosen machine and return." value={msText(chosenOf(p.v, machinesOf(p.v))?.rtt)} tone="value" />
      </div>
    </Tile>
  },
}
