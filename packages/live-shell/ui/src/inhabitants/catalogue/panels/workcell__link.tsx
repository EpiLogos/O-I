// The Link (manual §19.22, workcell:link): the device that joins this machine to the machines you connected, so that sessions and agents
// on other machines and in other harnesses keep one ledger and one clock beside your own. Live's nearest: Link, the toggle with its peer
// count, drawn here as a small effect like Utility. The picture is the link itself: this machine on the left, each machine you connected on
// the right, and two lines to each. The upper line is the ledger, the lower line is the clock. Share decides which of the two the link
// draws; the machine's standing draws each line (solid answered or the same, dashed limited or different, crossed refused, dotted
// unreachable). Handle 1 stands on this machine's edge and moves Share: up for the ledger, down for the clock, between them for both.
// Under the picture stand the lag on a log scale from 1 ms to the 2 s a remote gateway is given to answer, and the agents on the machines.
//
// Everything the device draws is a value key. The owners report:
//   light      'lit' | 'dark'   at least one machine in the link answered (AIKit `gateway who` remotes[].status); hollow when nobody reports
//   here       string           this machine's Workcell ref (`workcell status --json`, workcell_ref)
//   link       bool             the link is joined: a gateway endpoint is declared for the machine (`gateway remote list`, GatewayRemote
//                               in gateway_contact.rs). The owner has no off switch: the host reports it and is asked to write it.
//   share      ledger | clock | both   what the machines keep in common. SPECIFIED: AIKit would hold it on each declared remote.
//   machines   Machine[]        the Workcells of the link, this one included: {id (a Workcell ref), self?, endpoint? (websocket_bind of the
//                               declared remote), state? (answered · limited · refused · unreachable: `gateway who` remotes[]: status and
//                               detail, RemoteSurvey::statuses), why? (that detail, in the owner's words), in? (bool: the machine is in the link),
//                               lag? (ms: the round trip of the question to that gateway; SPECIFIED, nothing times it yet), clock? (same ·
//                               differs: the machine's `central.time.policy` revision against this one's; SPECIFIED over the gateway),
//                               sessions? ({id, name, harness?, seat?}: the occupied Positions that machine's gateway reports, `gateway
//                               who` positions[] with workcell_ref), seats? ({name, product?, state?, lane?}: that machine's seat register)}.
//   threads    {sessionId: Turn[]}   the Communique conversation with a session ({at?, from, text}: `gateway conversation --with`, over
//                                    `gateway --at W`); the host reads the thread of the session you select.
// The shell holds and the owner is asked to write:  link, share, in:<machine id> (a request that a machine be in the link).
// The hand holds:  sel (the machine open in the pane), session (the session whose thread the pane reads).
// A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {Band, Display, Folded, Handle, Ladder, Lamp, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {boolOf, clampTo, has, json, NONE, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './workcell__link.css'

type V = ViewProps['v']
type State = 'answered' | 'limited' | 'refused' | 'unreachable'
type Share = 'ledger' | 'clock' | 'both'
type Clock = 'same' | 'differs'

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

/** The lag scale runs from 1 ms to 2 s, the time a remote gateway is given to answer the question that asks for its agents. */
const LAG_LO = 1, LAG_HI = 2000
const LAG_TICKS: readonly [number, string][] = [[1, '1'], [10, '10'], [100, '100'], [1000, '1 s']]

const SHARE: readonly Option<string>[] = [
  {value: 'ledger', label: 'Ledger', does: 'The machines keep one ledger. A receipt made on one machine shows on all.'},
  {value: 'clock', label: 'Clock', does: 'The machines keep one clock: the same time zone and the same day boundary.'},
  {value: 'both', label: 'Both', does: 'The machines keep one ledger and one clock.'},
]
const SHARE_DEFAULT = 'both'
const SHARE_WORD: Record<Share, string> = {ledger: 'Ledger', clock: 'Clock', both: 'Both'}
const SHARE_LINE: Record<Share, string> = {ledger: 'the ledger is shared', clock: 'the clock is shared', both: 'the ledger and the clock are shared'}
const STATE_WORD: Record<State, string> = {answered: 'Answered', limited: 'Limited', refused: 'Refused', unreachable: 'Unreachable'}
const STATE_SAYS: Record<State, string> = {
  answered: 'Answered: the machine answered, and its agents and receipts show here.',
  limited: 'Limited: the machine answered, and its own record of agents could not.',
  refused: 'Refused: the machine refused the question.',
  unreachable: 'Unreachable: the machine did not answer in time.',
}
const CLOCK_WORD: Record<Clock, string> = {same: 'Same', differs: 'Differs'}
const CLOCK_SAYS: Record<Clock, string> = {
  same: 'The machine keeps the same time zone and day boundary as this one.',
  differs: 'The machine keeps another time zone or day boundary. The Day rolls over at another moment there.',
}
const SAYS = {
  link: 'Joins this machine to the machines you connected. Off, nobody asks them.',
  share: 'What the machines keep in common: the ledger, the clock or both.',
  picture: 'This machine on the left, the machines you connected on the right. The upper line is the ledger, the lower line is the clock. Drag handle 1 to set Share.',
  handle: 'Share. Drag up for the ledger, down for the clock, between the two lines for both.',
  machines: 'The machines you connected. Press a square to put a machine in or out of the link. Press a name to read it.',
}

// ---------------------------------------------------------------- readings

interface Session {readonly id: string; readonly name: string; readonly harness?: string; readonly seat?: string}
interface Seat {readonly name: string; readonly product?: string; readonly state?: string; readonly lane?: string}
interface Turn {readonly at?: string; readonly from: string; readonly text: string}
interface Machine {
  readonly id: string
  readonly self?: boolean
  readonly endpoint?: string
  readonly state?: State
  readonly why?: string
  readonly in?: boolean
  /** ms; undefined when the owner did not say. */
  readonly lag?: number
  readonly clock?: Clock
  readonly sessions?: readonly Session[]
  readonly seats?: readonly Seat[]
}
const text = (x: unknown) => (typeof x === 'string' && x.length > 0 ? x : undefined)
const STATES: readonly string[] = ['answered', 'limited', 'refused', 'unreachable']
const CLOCKS: readonly string[] = ['same', 'differs']
const record = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)

/** The Workcells the owner reports, kept only where they have a shape. Nothing in a bad list can throw. */
const machinesOf = (v: V): Machine[] => {
  const raw = json<unknown>(v, 'machines', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((m): Machine[] => {
    const r = record(m)
    const id = r && text(r.id)
    if (!r || !id) return []
    const sessions = Array.isArray(r.sessions) ? r.sessions.flatMap((s): Session[] => {
      const q = record(s), sid = q && text(q.id), name = q && (text(q.name) ?? sid)
      return q && sid && name ? [{id: sid, name, harness: text(q.harness), seat: text(q.seat)}] : []
    }) : undefined
    const seats = Array.isArray(r.seats) ? r.seats.flatMap((s): Seat[] => {
      const q = record(s), name = q && text(q.name)
      return q && name ? [{name, product: text(q.product), state: text(q.state), lane: text(q.lane)}] : []
    }) : undefined
    return [{
      id, endpoint: text(r.endpoint), why: text(r.why), self: r.self === true ? true : undefined,
      state: typeof r.state === 'string' && STATES.includes(r.state) ? r.state as State : undefined,
      clock: typeof r.clock === 'string' && CLOCKS.includes(r.clock) ? r.clock as Clock : undefined,
      in: typeof r.in === 'boolean' ? r.in : undefined,
      lag: typeof r.lag === 'number' && Number.isFinite(r.lag) && r.lag >= 0 ? r.lag : undefined,
      sessions, seats,
    }]
  })
}
const short = (id: string) => id.replace(/^workcell:/, '')
const isSelf = (m: Machine, here: string | undefined) => m.self === true || m.id === here
const remotesOf = (all: readonly Machine[], here: string | undefined) => all.filter(m => !isSelf(m, here))
const selfOf = (all: readonly Machine[], here: string | undefined) => all.find(m => isSelf(m, here))
/** Whether a machine is in the link: what the hand requested, else what the owner reports. */
const inOf = (v: V, m: Machine): boolean | undefined => boolOf(v, `in:${m.id}`) ?? m.in
const shareOf = (v: V): Share | undefined => { const s = strOf(v, 'share'); return s === 'ledger' || s === 'clock' || s === 'both' ? s : undefined }
/** The machine open: the one you chose, else the first you connected. */
const openOf = (v: V, all: readonly Machine[], here: string | undefined): Machine | undefined =>
  all.find(m => m.id === strOf(v, 'sel')) ?? remotesOf(all, here)[0] ?? selfOf(all, here)
const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}
const answers = (m: Machine) => m.state === 'answered' || m.state === 'limited'

const msText = (ms: number | undefined) => (ms === undefined ? undefined : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`)
const mid = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, Math.ceil((n - 1) / 2))}…${s.slice(s.length - Math.floor((n - 1) / 2))}`)
const stateTone = (s: State | undefined): Tone | undefined => (s === 'answered' ? 'green' : s === 'limited' ? 'accent' : s ? 'stall' : undefined)
const clockTone = (c: Clock | undefined): Tone | undefined => (c === 'same' ? 'green' : c ? 'accent' : undefined)
const reasonOf = (m: Machine) => m.why ?? 'The owner gave no reason.'

/** What the link reads from the machines in it. Each count is undefined where the owner has not said enough to count. */
interface Peers {readonly joined: number; readonly answering: number | undefined; readonly agents: number | undefined; readonly lag: number | undefined}
const peersOf = (v: V): Peers | undefined => {
  if (!has(v, 'machines')) return undefined
  const here = strOf(v, 'here')
  const joined = remotesOf(machinesOf(v), here).filter(m => inOf(v, m) !== false)
  const known = joined.every(m => m.state !== undefined)
  const up = joined.filter(answers)
  const lags = up.flatMap(m => (m.lag === undefined ? [] : [m.lag]))
  return {
    joined: joined.length,
    answering: known ? up.length : undefined,
    agents: known && up.length > 0 && up.every(m => m.sessions !== undefined) ? up.reduce((n, m) => n + (m.sessions?.length ?? 0), 0) : undefined,
    lag: lags.length > 0 ? Math.max(...lags) : undefined,
  }
}
const machinesText = (pr: Peers | undefined) => (pr?.answering === undefined ? undefined : `${pr.answering} / ${pr.joined}`)
const lampOf = (s: State | undefined): {light: LightState; tone: Tone} =>
  s === 'answered' ? {light: 'lit', tone: 'green'} : s === 'limited' ? {light: 'lit', tone: 'accent'} : s ? {light: 'dark', tone: 'accent'} : {light: 'unknown', tone: 'accent'}

// ---------------------------------------------------------------- the picture

interface Geo {
  readonly w: number; readonly h: number
  /** The box of this machine: its x range, its height. */
  readonly hx0: number; readonly hx1: number; readonly hh: number
  /** The boxes of the other machines: their x range, the height of one, the step between two, how many show. */
  readonly mx0: number; readonly mx1: number; readonly bh: number; readonly step: number; readonly max: number
  readonly cy: number
  /** Half the gap between the ledger line and the clock line, at this machine and at the other. */
  readonly gap: number; readonly off: number
  /** Characters of a name that fit in a box, and where its dot and name start in the box. */
  readonly chars: number; readonly dot: number
  /** The lag scale and the agents, under the picture. */
  readonly blocks: boolean
}
const COMPACT: Geo = {w: 140, h: 146, hx0: 4, hx1: 40, hh: 30, mx0: 78, mx1: 138, bh: 16, step: 20, max: 4, cy: 48, gap: 6, off: 3, chars: 7, dot: 16, blocks: true}
const WHOLE: Geo = {w: 194, h: 146, hx0: 6, hx1: 60, hh: 30, mx0: 106, mx1: 188, bh: 16, step: 20, max: 4, cy: 48, gap: 6, off: 3, chars: 12, dot: 17, blocks: true}
const TILE: Geo = {w: 112, h: 78, hx0: 4, hx1: 26, hh: 24, mx0: 54, mx1: 108, bh: 16, step: 20, max: 3, cy: 39, gap: 4, off: 2.5, chars: 7, dot: 13, blocks: false}

interface Look {readonly cls: 'dp-curve' | 'dp-curve-on' | 'dp-faint'; readonly dash?: string; readonly cross?: boolean}
/** The ledger line: the machine's standing draws it. */
const ledgerLook = (m: Machine): Look =>
  m.state === 'answered' ? {cls: 'dp-curve'} : m.state === 'limited' ? {cls: 'dp-curve-on', dash: '4 3'}
    : m.state === 'refused' ? {cls: 'dp-faint', dash: '3 3', cross: true} : m.state === 'unreachable' ? {cls: 'dp-faint', dash: '1 3'} : {cls: 'dp-faint', dash: '2 3'}
/** The clock line: the same time policy draws it solid, another draws it dashed, a machine that did not answer cannot say. */
const clockLook = (m: Machine): Look =>
  m.state === 'unreachable' ? {cls: 'dp-faint', dash: '1 3'} : m.clock === 'same' ? {cls: 'dp-curve'} : m.clock === 'differs' ? {cls: 'dp-curve-on', dash: '4 3'} : {cls: 'dp-faint', dash: '2 3'}
const NOT_SHARED: Look = {cls: 'dp-faint', dash: '1 4'}

function Wire({x1, y1, x2, y2, look, shared, weight}: {x1: number; y1: number; x2: number; y2: number; look: Look; shared: boolean; weight: number}) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, l = shared ? look : NOT_SHARED
  return <g opacity={shared ? 1 : 0.35}>
    <path d={`M${x1} ${y1}C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} className={l.cls} strokeDasharray={l.dash} style={l.cls === 'dp-faint' ? undefined : {strokeWidth: weight}} />
    {shared && l.cross && <path d={`M${mx - 3} ${my - 3}l6 6M${mx + 3} ${my - 3}l-6 6`} className="lk-cross" />}
  </g>
}

/** The lag of each machine on a log scale from 1 ms to 2 s: one dot each, the slowest in amber. Under it, the agents on the machines. */
function Under({g, v}: {g: Geo; v: V}) {
  const x0 = 8, x1 = g.w - 8, y = 121
  const at = (ms: number) => x0 + (x1 - x0) * clampTo(0, 1, Math.log(Math.max(ms, LAG_LO) / LAG_LO) / Math.log(LAG_HI / LAG_LO))
  const pr = peersOf(v), here = strOf(v, 'here')
  const lags = has(v, 'machines') ? remotesOf(machinesOf(v), here).filter(m => inOf(v, m) !== false && answers(m) && m.lag !== undefined) : []
  const slow = pr?.lag
  return <g>
    <path d={`M${x0} ${y}H${x1}`} className="dp-faint" />
    {LAG_TICKS.map(([ms, name]) => <g key={name}>
      <path d={`M${at(ms)} ${y - 2.5}v5`} className="dp-faint" />
      <text x={at(ms)} y={y + 10} className="dp-axis" textAnchor="middle">{name}</text>
    </g>)}
    {slow !== undefined && <path d={`M${x0} ${y}H${at(slow)}`} className="dp-curve" style={{strokeWidth: 2.5}} />}
    {lags.map(m => <circle key={m.id} cx={at(m.lag!)} cy={y} r={2.6} className="lk-lag" data-slow={m.lag === slow ? 'true' : undefined} />)}
    <text x={x0} y={y - 9} className={slow === undefined ? 'dp-axis' : 'dp-ink-dim'}>
      {!has(v, 'machines') ? 'No reading of the machines' : slow === undefined ? 'No reading of the lag' : <><tspan className="dp-axis">lag </tspan>{msText(slow)}</>}
    </text>
    <text x={x0} y={143} className="dp-axis">
      {pr?.agents === undefined ? 'No reading of the agents' : <><tspan className="dp-ink-dim">{pr.agents}</tspan> {pr.agents === 1 ? 'agent' : 'agents'} on the machines</>}
    </text>
  </g>
}

/** The link drawn from the machines and Share. Handle 1 stands on this machine's edge. */
function Mesh({p, g, live}: {p: ViewProps; g: Geo; live: boolean}) {
  const v = p.v, all = machinesOf(v), here = strOf(v, 'here'), remotes = remotesOf(all, here), me = selfOf(all, here)
  const share = shareOf(v), linkOn = boolOf(v, 'link'), open = openOf(v, all, here)
  const idx = open ? remotes.indexOf(open) : -1
  const start = remotes.length > g.max ? Math.min(Math.max(0, idx - (g.max - 1)), remotes.length - g.max) : 0
  const shown = remotes.slice(start, start + g.max), n = shown.length
  const ys = shown.map((_, k) => g.cy + (k - (n - 1) / 2) * g.step)
  const roomy = g.hx1 - g.hx0 > 30
  const ledgerY = g.cy - g.gap, clockY = g.cy + g.gap
  const hx = g.hx1 + 10, hy = share === 'ledger' ? ledgerY : share === 'clock' ? clockY : g.cy
  const canDrag = live && !st(p, 'share').disabled
  const drag = (_x: number, y: number) => {
    const next: Share = y < g.cy - g.gap / 2 ? 'ledger' : y > g.cy + g.gap / 2 ? 'clock' : 'both'
    if (next !== share) p.set('share', next)
  }
  const note = !has(v, 'machines') ? (g.blocks ? 'No reading of the machines' : 'No reading') : n === 0 ? 'No machine connected'
    : linkOn === false ? 'The link is off' : undefined
  const name = me ? short(me.id) : here ? short(here) : undefined
  return <>
    {shown.map((m, k) => {
      const out = linkOn === false || inOf(v, m) === false, chosen = m.id === open?.id
      return <g key={m.id} opacity={out ? 0.3 : chosen ? 1 : 0.75}>
        <Wire x1={g.hx1} y1={ledgerY} x2={g.mx0} y2={ys[k]! - g.off} look={ledgerLook(m)} shared={share !== 'clock'} weight={chosen ? 2 : 1.5} />
        <Wire x1={g.hx1} y1={clockY} x2={g.mx0} y2={ys[k]! + g.off} look={clockLook(m)} shared={share !== 'ledger'} weight={chosen ? 1.5 : 1} />
      </g>
    })}
    <rect className="lk-box" x={g.hx0} y={g.cy - g.hh / 2} width={g.hx1 - g.hx0} height={g.hh} rx={2} />
    <text x={(g.hx0 + g.hx1) / 2} y={roomy && name ? g.cy - 2 : g.cy + 3} className="dp-ink" textAnchor="middle">{name ? mid(name, roomy ? 9 : 5) : 'this'}</text>
    {roomy && name && <text x={(g.hx0 + g.hx1) / 2} y={g.cy + 8} className="dp-ink-dim" textAnchor="middle">this</text>}
    {n === 0 && <rect className="lk-box" x={g.mx0} y={g.cy - g.bh / 2} width={g.mx1 - g.mx0} height={g.bh} rx={2} strokeDasharray="3 3" />}
    {shown.map((m, k) => <g key={m.id}>
      <rect className="lk-box" x={g.mx0} y={ys[k]! - g.bh / 2} width={g.mx1 - g.mx0} height={g.bh} rx={2}
        data-chosen={m.id === open?.id ? 'true' : undefined} data-out={linkOn === false || inOf(v, m) === false ? 'true' : undefined} />
      <circle cx={g.mx0 + g.dot - 7} cy={ys[k]!} r={3} className="lk-dot" data-state={m.state ?? 'none'} />
      <text x={g.mx0 + g.dot} y={ys[k]! + 3} className={m.id === open?.id ? 'dp-ink' : 'dp-ink-dim'}>{mid(short(m.id), g.chars)}</text>
    </g>)}
    {remotes.length > n && <text x={g.mx1} y={ys[n - 1]! + g.bh / 2 + 8} className="dp-axis" textAnchor="end">{remotes.length - n} more</text>}
    {live && share !== undefined && <path d={`M${hx} ${ledgerY}V${clockY}`} className="lk-track" />}
    {g.blocks && (note
      ? <text x={g.w / 2} y={97} className="dp-axis" textAnchor="middle">{note}</text>
      : <text x={g.w / 2} y={97} className="dp-axis" textAnchor="middle">upper ledger · lower clock</text>)}
    {!g.blocks && note && <text x={g.w / 2} y={g.h - 6} className="dp-axis" textAnchor="middle">{note}</text>}
    {g.blocks && <Under g={g} v={v} />}
    {live && share !== undefined && <Handle x={hx} y={hy} n={1} shape="ring" label="Share" does={SAYS.handle}
      onDrag={canDrag ? drag : undefined} onReset={canDrag ? () => p.set('share', SHARE_DEFAULT) : undefined} />}
  </>
}

function MeshDisplay({p, g, live = true}: {p: ViewProps; g: Geo; live?: boolean}) {
  const share = shareOf(p.v), linkOn = boolOf(p.v, 'link')
  return <Display w={g.w} h={g.h} label="The link" does={SAYS.picture} corner={linkOn === false ? 'Off' : share ? SHARE_WORD[share] : undefined}>
    <Mesh p={p} g={g} live={live} />
  </Display>
}

// ---------------------------------------------------------------- the controls and the readings

const linkToggle = (p: ViewProps) => <Toggle label="Link" does={SAYS.link} on={boolOf(p.v, 'link') === true} unknown={!has(p.v, 'link')}
  onChange={on => p.set('link', on)} {...st(p, 'link')} />
const shareRadio = (p: ViewProps) => <Radio label="Share" does={SAYS.share} value={shareOf(p.v) ?? ''} options={SHARE} stack
  onChange={x => p.set('share', x)} {...st(p, 'share')} />
const machinesReadout = (v: V) => {
  const pr = peersOf(v)
  return <Readout label="reachable" does="The machines that answer, of the machines in the link."
    value={machinesText(pr)} tone={pr?.answering === undefined ? undefined : pr.answering === pr.joined && pr.joined > 0 ? 'green' : 'stall'} />
}
const agentsReadout = (v: V) => <Readout label="agents" does="The agents that run on the machines that answer."
  value={peersOf(v)?.agents} tone="value" />
const lagReadout = (v: V) => <Readout label="lag" does="The time for a message to go to the slowest machine in the link and return."
  value={msText(peersOf(v)?.lag)} tone="value" />

/** Both marks of a machine's standing in one ladder: the ledger answered, the clock the same. */
const standingLadder = (m: Machine) => <Ladder label="Shared" labels={['Ledger', 'Clock']} rungs={[
  m.state === undefined ? null : m.state === 'answered',
  m.clock === undefined ? null : m.clock === 'same',
]} />

/** The machines of the link as a list: your request as a square, the owner's answer as a light, the lag as the note. */
function MachineRows({p}: {p: ViewProps}) {
  const v = p.v, here = strOf(v, 'here'), remotes = remotesOf(machinesOf(v), here), open = openOf(v, machinesOf(v), here)
  const items: RowItem[] = remotes.map(m => {
    const lamp = lampOf(m.state), gate = st(p, `in:${m.id}`)
    return {
      id: m.id, name: short(m.id), light: lamp.light, tone: lamp.tone, request: inOf(v, m), meter: standingLadder(m),
      why: m.state && m.state !== 'answered' ? reasonOf(m) : undefined,
      note: msText(m.lag), does: gate.disabled ?? (m.state ? STATE_SAYS[m.state] : 'No reading of this machine.'),
    }
  })
  if (!has(v, 'machines')) return <p className="lk-none" data-i={`Machines|${SAYS.machines} No reading of the machines yet.`}>No reading of the machines.</p>
  if (remotes.length === 0) return <p className="lk-none" data-i={`Machines|${SAYS.machines}`}>No machine connected.</p>
  return <Rows does={SAYS.machines} items={items} size={5} selected={open?.id}
    onSelect={id => p.set('sel', id)}
    onRequest={(id, on) => { if (!st(p, `in:${id}`).disabled) p.set(`in:${id}`, on) }} />
}

/** The terms of the machine you select. A term the owner did not give is "—". */
function Terms({m}: {m: Machine | undefined}) {
  if (!m) return <p className="lk-none">No machine chosen.</p>
  const rows: readonly (readonly [string, string | undefined, string, Tone | undefined])[] = [
    ['Machine', m.id, 'The Workcell at the other end.', undefined],
    ['Endpoint', m.endpoint, 'Where the gateway of that machine listens.', undefined],
    ['Ledger', m.state ? STATE_WORD[m.state] : undefined, m.state ? STATE_SAYS[m.state] : 'Whether its agents and receipts show here.', stateTone(m.state)],
    ['Clock', m.clock ? CLOCK_WORD[m.clock] : undefined, m.clock ? CLOCK_SAYS[m.clock] : 'Whether it keeps the same time zone and day boundary.', clockTone(m.clock)],
    ['Lag', msText(m.lag), 'The time for a message to go to that machine and return.', undefined],
    ...(m.state && m.state !== 'answered' ? [['Reason', reasonOf(m), 'Why the machine could not say everything.', undefined] as const] : []),
  ]
  return <dl className="lk-terms">
    {rows.map(([k, x, says, tone]) => <div key={k} style={{display: 'contents'}} data-i={`${k}|${says}${x === undefined ? ' The owner gave none.' : ''}`}>
      <dt>{k}</dt><dd data-none={x === undefined ? 'true' : undefined} data-tone={tone} data-reason={k === 'Reason' ? 'true' : undefined}>{x ?? NONE}</dd>
    </div>)}
  </dl>
}

const head = (p: ViewProps) => ({light: lightOf(p), onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the pane: the machines, their sessions and seats, one thread

const turnsOf = (v: V, sessionId: string): Turn[] | undefined => {
  const all = record(json<unknown>(v, 'threads', undefined))
  const raw = all?.[sessionId]
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((t): Turn[] => { const r = record(t), from = r && text(r.from), body = r && text(r.text); return r && from && body ? [{at: text(r.at), from, text: body}] : [] })
}

function Pane({p}: {p: ViewProps}) {
  const v = p.v
  if (!has(v, 'machines')) return <div className="lk-pane"><div className="lk-strip"><span className="lk-strip-none">Link</span></div>
    <div className="lk-body" data-none="true"><p className="lk-empty">No reading of the machines.</p></div></div>
  const all = machinesOf(v), here = strOf(v, 'here'), open = openOf(v, all, here)
  const share = shareOf(v), linkOn = boolOf(v, 'link')
  const mine = open ? isSelf(open, here) : false
  const sessions = open?.sessions
  const session = sessions?.find(s => s.id === strOf(v, 'session'))
  const turns = session ? turnsOf(v, session.id) : undefined
  return <div className="lk-pane">
    <div className="lk-strip" aria-label="Machines">
      {all.length === 0 && <span className="lk-strip-none">No machine connected</span>}
      {all.map(m => {
        const self = isSelf(m, here), lamp = lampOf(m.state)
        return <button key={m.id} type="button" className="lk-chip" aria-current={m.id === open?.id ? 'true' : undefined} onClick={() => p.set('sel', m.id)}
          data-i={`${short(m.id)}|${self ? 'This machine. Press to read its sessions and seats.' : `${m.state ? STATE_SAYS[m.state] : 'No reading of this machine.'} Press to read its sessions and seats.`}`}>
          {self ? <em>this</em> : <Lamp state={lamp.light} tone={lamp.tone} label={m.state ? `${short(m.id)}: ${STATE_WORD[m.state]}` : `${short(m.id)}: no reading`} />}{short(m.id)}
        </button>
      })}
      <span className="lk-strip-share">{linkOn === false ? 'the link is off' : share ? SHARE_LINE[share] : NONE}</span>
    </div>
    <div className="lk-body" data-none={open ? undefined : 'true'}>
      {!open ? <p className="lk-empty">No machine is connected.</p> : <>
        <div className="lk-main">
          <div className="lk-main-head" aria-label="The machine">
            <b>{short(open.id)}</b>
            <span>{mine ? 'this machine' : open.endpoint ?? NONE}</span>
            {!mine && <span>{open.state ? STATE_WORD[open.state] : NONE}</span>}
            {!mine && <span>lag {msText(open.lag) ?? NONE}</span>}
          </div>
          <h4>Sessions on {short(open.id)}</h4>
          {sessions === undefined ? <p className="lk-thread-none">No reading of the sessions.</p>
            : sessions.length === 0 ? <p className="lk-thread-none">No session runs there.</p>
            : <ol className="lk-list" aria-label="Sessions">
              {sessions.map(s => <li key={s.id}><button type="button" className="lk-session" aria-pressed={s.id === session?.id} onClick={() => p.set('session', s.id)}
                data-i={`${s.name}|Read the thread with this session.`}>
                <span className="lk-sname">{s.name}</span><span className="lk-sharness">{s.harness ?? NONE}</span><span className="lk-sseat">{s.seat ?? NONE}</span>
              </button></li>)}
            </ol>}
          <h4>Seats on {short(open.id)}</h4>
          {open.seats === undefined ? <p className="lk-thread-none">No reading of the seats.</p>
            : open.seats.length === 0 ? <p className="lk-thread-none">No seat is set there.</p>
            : <ul className="lk-list" aria-label="Seats">
              {open.seats.map((s, i) => <li key={`${s.name}:${s.product ?? i}`} className="lk-seat" data-i={`${s.name}|${s.product ?? 'A seat'} ${s.state ?? 'has no reading'}.`}>
                <span>{s.name}</span><span>{s.product ?? NONE}</span><span data-state={s.state}>{s.state ?? NONE}</span><span className="lk-sseat">{s.lane ?? NONE}</span>
              </li>)}
            </ul>}
        </div>
        <aside className="lk-aside" aria-label="Readings">
          {!mine && <section className="lk-read"><h4>Standing</h4>
            <div className="lk-read-row">
              <div><strong data-tone={stateTone(open.state) ?? 'none'}>{open.state ? STATE_WORD[open.state] : NONE}</strong><small>ledger</small></div>
              <div><strong data-tone={clockTone(open.clock) ?? 'none'}>{open.clock ? CLOCK_WORD[open.clock] : NONE}</strong><small>clock</small></div>
            </div>
            {open.state && open.state !== 'answered' && <p>{reasonOf(open)}</p>}
          </section>}
          <h4 className="lk-thread-head">Thread{session ? ` · ${session.name}` : ''}</h4>
          {!session ? <p className="lk-thread-none">Select a session to read its thread.</p>
            : turns === undefined ? <p className="lk-thread-none">No reading of this thread.</p>
            : turns.length === 0 ? <p className="lk-thread-none">Nothing has passed between you yet.</p>
            : <ol className="lk-thread" aria-label="Thread">
              {turns.map((t, i) => <li key={i} className="lk-turn"><span className="lk-at">{t.at ?? NONE}</span><b>{t.from}</b><p>{t.text}</p></li>)}
            </ol>}
        </aside>
      </>}
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

/** The machines this Mac holds a link to (`workcell status --json`, `gateway remote list`): workcell:omarchy at 100.92.62.101:7788. The
 * sessions are the occupied Positions of AIKit's own examples and the register's claims on this Mac's seats. */
const SESSIONS_HERE = [
  {id: 'dlw-conductor', name: 'claude-code:dlw-conductor', harness: 'claude-code', seat: 'env-1 · actuation'},
  {id: 'dlw-lead', name: 'claude-code:dlw-lead', harness: 'claude-code', seat: 'env-1 · ai-kit'},
]
const SEATS_HERE = [
  {name: 'env-1', product: 'actuation', state: 'claimed', lane: 'fold/day-close-20261012'},
  {name: 'env-1', product: 'ai-kit', state: 'claimed', lane: 'speed/relations-batch-per-item'},
]
const MAC = {id: 'workcell:mac', self: true, sessions: SESSIONS_HERE, seats: SEATS_HERE}
const OMARCHY = {
  id: 'workcell:omarchy', endpoint: '100.92.62.101:7788', state: 'answered', in: true, lag: 41, clock: 'same',
  sessions: [
    {id: 'cradle-steward', name: '@cradle-steward', harness: 'hermes', seat: 'Work/O-I'},
    {id: 'factory-guardian', name: '@factory-guardian', harness: 'claude-code', seat: 'Work/Factory'},
  ],
  seats: [
    {name: 'Work', product: 'o-i', state: 'claimed', lane: 'main'},
    {name: 'Work', product: 'factory', state: 'free'},
  ],
}
/** The machine as `gateway who` reports it on this Mac now: the gateway at 100.92.62.101:7788 does not answer in time. */
const OMARCHY_DOWN = {id: 'workcell:omarchy', endpoint: '100.92.62.101:7788', state: 'unreachable', in: true,
  why: 'connect gateway at 100.92.62.101:7788: connection timed out'}
const THREADS = {
  'cradle-steward': [
    {at: '09:41', from: '@cradle-steward', text: 'Cradle build is red on main.'},
    {at: '09:43', from: 'claude-code:dlw-lead', text: 'Which check failed?'},
    {at: '09:44', from: '@cradle-steward', text: 'The type check of the cradle root. The fix is on the O-I lane.'},
  ],
  'factory-guardian': [
    {at: '08:12', from: '@factory-guardian', text: 'Two lanes hold the same product. Land one of them.'},
  ],
}

/** Every key the owners report or the shell holds: the "No readings" fixture drops all of them. */
const KEYS = ['light', 'here', 'link', 'share', 'machines', 'threads', 'sel', 'session']
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'workcell:link',
  title: 'Link',
  kind: 'effect',
  defaults: {
    light: 'lit', here: 'workcell:mac', link: true, share: SHARE_DEFAULT, sel: 'workcell:omarchy', session: 'cradle-steward',
    machines: JSON.stringify([MAC, OMARCHY]), threads: JSON.stringify(THREADS),
  },
  fixtures: {
    'Omarchy answers': {},
    'Omarchy unreachable': {light: 'dark', machines: JSON.stringify([MAC, OMARCHY_DOWN])},
    'No readings': NOTHING,
  },

  folded: p => {
    const pr = peersOf(p.v)
    return <Folded title="Link" light={lightOf(p)} readings={[machinesText(pr) ?? NONE, msText(pr?.lag) ?? NONE]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Link" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <MeshDisplay p={p} g={COMPACT} />
    </Section>
    <Section label="Link" cols={2}>
      <div className="lk-span">{linkToggle(p)}</div>
      <div className="lk-span">{shareRadio(p)}</div>
    </Section>
    <Section label="Reading" width={80}>
      {machinesReadout(p.v)}
      {lagReadout(p.v)}
    </Section>
  </Panel>,

  whole: p => {
    const all = machinesOf(p.v), here = strOf(p.v, 'here')
    return <Panel title="Link" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <MeshDisplay p={p} g={WHOLE} />
        </Section>
        <Section label="Link" cols={2}>
          <div className="lk-span">{linkToggle(p)}</div>
          <div className="lk-span">{shareRadio(p)}</div>
        </Section>
        <Section label="Peers" grow>
          {machinesReadout(p.v)}
          {agentsReadout(p.v)}
          {lagReadout(p.v)}
        </Section>
      </Band>
      <Band>
        <Section label="Machines" width={212}>
          <MachineRows p={p} />
        </Section>
        <Section label="Machine" grow>
          <Terms m={openOf(p.v, all, here)} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <Pane p={p} />,

  widget: p => {
    const name = strOf(p.v, 'here')
    return <Tile title="Link" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <div className="lk-tile-pic">
        <MeshDisplay p={p} g={TILE} live={false} />
        <span className="lk-tile-name" data-i={`This machine|${name ?? 'No reading of this machine.'}`}>{name ? short(name) : NONE}</span>
      </div>
      <div className="lk-tile-side">
        {machinesReadout(p.v)}
        {agentsReadout(p.v)}
        {lagReadout(p.v)}
      </div>
    </Tile>
  },
}
