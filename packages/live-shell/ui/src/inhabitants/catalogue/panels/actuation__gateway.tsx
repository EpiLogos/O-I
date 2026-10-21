// The Gateway device (manual §19.2, actuation:gateway): the way in to a Factory session, the first device on its chain. Live's nearest:
// Utility — a small effect of few controls whose meaning is plain at a glance. The well is the link: the shell on the left, the
// harness on the right, the line between them drawn by the transport, the frames in flight as dots, the replay ring as an arc
// round the harness, the heartbeat as the outer ring, and the time since the last check-in on a scale that ends at 30 min.
//
// Value keys. The owner writes (kernel harness_agent_control, `configure`, harnessAgentControl.ts:14-25):
//   connect (bool), transport (stdio · ws · remote), approvals (ask · session · always), stallAfter (seconds: 30, 90, 300, 1800),
//   autoContinue (bool), fanOut (0 to 8 observers).
// The owner reports (never written from here):
//   light (lit · dark), harness (the binding's name), viaLead (bool), readiness (the harness's own word), refused (the owner's
//   reason), epoch (hex), seq (the last sequence number of the session), peers (observers attached), beatAge (seconds since the
//   last check-in, -1 when none), inflight (frames in flight), running (turns running), ring and ringCap (events held, events kept),
//   frames (a JSON list of {seq?, dir, kind, session, at, note}).
// A key the owner has not reported is absent, and the view draws "—" for it, and names it in the well.
import {useState, type CSSProperties} from 'react'
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState, type Option} from '../../sdk/panel'
import {boolOf, clampTo, has, json, NONE, numOf, shown, strOf, type DesignedDevice, type ViewProps, type Values} from './design'
import './actuation__gateway.css'

type V = ViewProps['v']
type Live = 'live' | 'stalled' | 'idle'

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

/** The stops Stall after takes, in seconds, and what each is called. */
const STOPS = [30, 90, 300, 1800] as const
const STOP_LABEL = ['30 s', '90 s', '5 min', '30 min'] as const
/** The scale under the link runs from 10 s to 30 min on a log axis, so the four stops stand evenly apart. */
const AX_LO = 10, AX_HI = 1800
const FAN_MAX = 8
const STALL_DEFAULT = 90, FAN_DEFAULT = 2

const TRANSPORTS: readonly Option<string>[] = [
  {value: 'stdio', label: 'stdio', does: 'The harness runs as a child process of the shell.'},
  {value: 'ws', label: 'ws', does: 'The shell connects over a socket and shows a token.'},
  {value: 'remote', label: 'remote', does: 'The shell connects through a connected machine, with a short-lived ticket.'},
]
const APPROVALS: readonly Option<string>[] = [
  {value: 'ask', label: 'Ask', does: 'You answer each approval request.'},
  {value: 'session', label: 'Session', does: 'Requests are allowed for this session.'},
  {value: 'always', label: 'Always', does: 'Requests are allowed every time.'},
]

const SAYS = {
  connect: 'Attach the session to the harness, or detach it. A detached session keeps running and attaches again later.',
  transport: 'How the shell reaches the harness: a child process, a socket with a token, or a connected machine.',
  approvals: 'The default answer to an approval request. You always give Deny yourself.',
  stall: 'The time without progress, with work pending, after which the session counts as stalled. Drag handle 1 along the scale.',
  autoContinue: 'After a crash, resume the turn the crash cut short. It resumes a cut under 15 minutes old, and tries twice at most.',
  fanOut: 'How many observers may watch the session beside the shell. A slow observer loses only its own feed.',
}

// ---------------------------------------------------------------- readings

const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}

/** The time without progress, as a short word. */
const span = (s: number) => (s < 0 ? 'none' : s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`)
const stopIndex = (v: V): number | undefined => {
  const s = numOf(v, 'stallAfter')
  if (s === undefined) return undefined
  return STOPS.reduce((best, stop, i) => (Math.abs(Math.log(stop / s)) < Math.abs(Math.log(STOPS[best]! / s)) ? i : best), 0)
}
const stallLabel = (v: V) => { const s = numOf(v, 'stallAfter'); return s === undefined ? NONE : (STOP_LABEL[STOPS.indexOf(s as (typeof STOPS)[number])] ?? span(s)) }

/** Stalled needs work pending: a session that is quiet with nothing running is idle. A state needs the readings that decide it. */
const liveOf = (v: V): Live | undefined => {
  const age = numOf(v, 'beatAge'), after = numOf(v, 'stallAfter'), running = numOf(v, 'running')
  if (age === undefined) return undefined
  if (age < 0) return 'idle'
  if (after === undefined) return undefined
  if (age < after) return 'live'
  if (running === undefined) return undefined
  return running > 0 ? 'stalled' : 'idle'
}
/** The harness's own word for its state; a refusal is named when the owner gave no state. */
const readyWord = (v: V): string | undefined => strOf(v, 'readiness') ?? (has(v, 'refused') ? 'refused' : undefined)
const readyTone = (v: V) => (strOf(v, 'readiness') === 'ready' ? 'green' as const : strOf(v, 'readiness') === undefined && has(v, 'refused') ? 'stall' as const : undefined)
const epochOf = (v: V, n = 8) => { const e = strOf(v, 'epoch'); return e === undefined ? NONE : e.slice(0, n) }
const ringOf = (v: V) => { const r = numOf(v, 'ring'), c = numOf(v, 'ringCap'); return r === undefined || c === undefined || c <= 0 ? undefined : clampTo(0, 1, r / c) }
const peersLine = (v: V) => {
  const n = numOf(v, 'peers'), cap = numOf(v, 'fanOut')
  return n === undefined ? NONE : cap === undefined ? `${n}` : `${n} / ${cap}`
}
const atLog = (t: number, a0: number, a1: number) => a0 + (a1 - a0) * clampTo(0, 1, Math.log(Math.max(t, AX_LO) / AX_LO) / Math.log(AX_HI / AX_LO))
const arcPath = (cx: number, cy: number, r: number, f: number) => {
  if (f >= 0.999) return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
  const a = -Math.PI / 2 + f * 2 * Math.PI
  return `M${cx} ${cy - r}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`
}

interface Frame {seq?: number; dir: 'in' | 'out'; kind: string; session: string; at: string; note: string}
/** The frames the owner reports, kept only where they have a shape. Nothing in a bad list can throw. */
const framesOf = (v: V): Frame[] => {
  const raw = json<unknown>(v, 'frames', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((f): Frame[] => {
    if (!f || typeof f !== 'object') return []
    const r = f as Record<string, unknown>
    if (typeof r.kind !== 'string') return []
    return [{seq: typeof r.seq === 'number' ? r.seq : undefined, dir: r.dir === 'out' ? 'out' : 'in', kind: r.kind,
      session: typeof r.session === 'string' ? r.session : NONE, at: typeof r.at === 'string' ? r.at : NONE, note: typeof r.note === 'string' ? r.note : ''}]
  })
}
const kindClass = (kind: string) => (kind.startsWith('approval') ? 'approval' : kind.includes('error') ? 'error' : kind.startsWith('tool') ? 'tool' : undefined)

// ---------------------------------------------------------------- the well

type Size = 'mini' | 'compact' | 'whole'
/** Where the marks stand, by size: the shell box, the line, the harness and its two rings, the scale. */
const GEO = {
  mini: {w: 104, h: 100, sx: 4, sw: 22, cy: 44, hx: 80, hr: 8, ringR: 12, pulseR: 16, axisY: 86, a0: 6, a1: 98},
  compact: {w: 140, h: 146, sx: 7, sw: 24, cy: 50, hx: 109, hr: 11, ringR: 16, pulseR: 21, axisY: 127, a0: 7, a1: 133},
  whole: {w: 194, h: 146, sx: 8, sw: 34, cy: 50, hx: 156, hr: 13, ringR: 19, pulseR: 25, axisY: 127, a0: 8, a1: 186},
} as const

const Pair = ({x, y, k, val}: {x: number; y: number; k: string; val: string}) =>
  <text x={x} y={y} className="dp-ink-dim"><tspan className="dp-axis">{k} </tspan>{val}</text>

/** The line between the shell and the harness: the transport draws it, and a detached session breaks it. */
function Line({x1, x2, y, transport, connect, labelled}: {x1: number; x2: number; y: number; transport: string | undefined; connect: boolean | undefined; labelled: boolean}) {
  const mx = (x1 + x2) / 2
  if (connect === false) return <g>
    <path d={`M${x1} ${y}H${mx - 6}M${mx + 6} ${y}H${x2}`} className="dp-faint" strokeDasharray="2 3" />
    <path d={`M${mx - 3} ${y - 3}l6 6M${mx + 3} ${y - 3}l-6 6`} className="dp-faint" />
  </g>
  if (transport === 'ws') return <g>
    <path d={`M${x1} ${y}H${x2}`} className="dp-curve" />
    <path d={`M${mx - 2} ${y - 5}V${y + 5}M${mx + 2} ${y - 5}V${y + 5}`} className="dp-curve" />
    {labelled && <text x={mx} y={y - 9} className="dp-axis" textAnchor="middle">ws</text>}
  </g>
  if (transport === 'remote') return <g>
    <path d={`M${x1} ${y}H${x2}`} className="dp-curve" strokeDasharray="4 3" />
    <path d={`M${mx} ${y - 5}L${mx + 5} ${y}L${mx} ${y + 5}L${mx - 5} ${y}Z`} className="dp-curve" style={{fill: 'var(--dp-well)'}} />
    {labelled && <text x={mx} y={y - 9} className="dp-axis" textAnchor="middle">remote</text>}
  </g>
  if (transport === 'stdio') return <g>
    <path d={`M${x1} ${y}H${x2}`} className="dp-curve" />
    {labelled && <text x={mx} y={y - 9} className="dp-axis" textAnchor="middle">stdio</text>}
  </g>
  return <path d={`M${x1} ${y}H${x2}`} className="dp-faint" />
}

/** The link: the shell, the line, the harness with its replay ring and heartbeat, the observers, and the time since the last check-in.
 * Handle 1 sets Stall after on the scale; handle 2 sets Fan-out on the observers (whole only). */
function LinkWell({v, set, size}: {v: V; set?: ViewProps['set']; size: Size}) {
  const g = GEO[size], mini = size === 'mini', whole = size === 'whole'
  const transport = strOf(v, 'transport'), connect = boolOf(v, 'connect')
  const inflight = numOf(v, 'inflight'), running = numOf(v, 'running'), age = numOf(v, 'beatAge'), after = numOf(v, 'stallAfter')
  const ring = ringOf(v), state = liveOf(v), fan = numOf(v, 'fanOut'), peers = numOf(v, 'peers')
  const x1 = g.sx + g.sw, x2 = g.hx - g.hr - 2
  // frames in flight: dots that run both ways; faster when more turns run, still when nobody says how many
  const n = inflight === undefined || connect === false ? 0 : Math.min(6, Math.max(0, Math.round(inflight)))
  const dur = running === undefined ? undefined : clampTo(0.8, 2.8, 2.8 - 0.5 * running)
  const pulse = state === 'stalled' ? 'var(--stall)' : state === 'live' ? 'var(--dp-value)' : undefined
  const fresh = state === 'live' && age !== undefined && after !== undefined ? 1 - 0.7 * clampTo(0, 1, age / after) : 1
  // the observers: one slot each, lit for each one attached
  const cap = fan ?? (peers === undefined ? 0 : Math.ceil(peers)), pitch = whole ? 10 : 7, slot = whole ? 7 : 5
  const sy = g.cy + g.pulseR + (whole ? 9 : 3), sx0 = g.hx + g.pulseR - FAN_MAX * pitch
  // the scale
  const ax = (t: number) => atLog(t, g.a0, g.a1)
  const near = (x: number) => STOPS.reduce((best, stop, i) => (Math.abs(ax(stop) - x) < Math.abs(ax(STOPS[best]!) - x) ? i : best), 0)
  const missing = [!has(v, 'transport') && !has(v, 'connect') ? 'link' : '', ring === undefined ? 'ring' : '', age === undefined ? 'beat' : '', inflight === undefined ? 'frames' : ''].filter(Boolean)
  const sayMissing = missing.length === 4 ? 'No readings' : `No reading: ${missing.join(', ')}`
  const name = strOf(v, 'harness')
  const readiness = readyWord(v) ?? NONE
  return <Display w={g.w} h={g.h} label="The link"
    does={mini ? 'The shell, the harness and the frames between them.' : 'The shell on the left, the harness on the right. Dots are frames in flight. The arc is the replay ring. Drag handle 1 to set Stall after.'}
    corner={mini ? undefined : readiness}>
    {!mini && <text x={g.sx} y={14} className="dp-ink" style={{fontWeight: 600}}>{name === undefined ? NONE : name.length > (whole ? 28 : 12) ? `${name.slice(0, whole ? 27 : 11)}…` : name}</text>}
    {/* the shell */}
    <rect x={g.sx} y={g.cy - 9} width={g.sw} height={18} className="dp-faint" />
    <text x={g.sx + g.sw / 2} y={g.cy + 20} className="dp-axis" textAnchor="middle">shell</text>
    {/* the line, and the frames on it */}
    <Line x1={x1} x2={x2} y={g.cy} transport={transport} connect={connect} labelled={whole} />
    {Array.from({length: n}, (_, i) => dur === undefined
      ? <circle key={i} cx={x1 + (i + 1) * (x2 - x1) / (n + 1)} cy={g.cy} r={2} fill="var(--dp-value)" />
      : <circle key={i} className="gw-dot" cx={x1} cy={g.cy} r={2} fill="var(--dp-value)" data-back={i % 2 ? 'true' : undefined}
        style={{'--span': `${x2 - x1}px`, '--dur': `${dur}s`, '--delay': `${-(i * dur) / n}s`} as CSSProperties} />)}
    {/* the harness: the replay ring round it, the heartbeat outside */}
    <circle cx={g.hx} cy={g.cy} r={g.hr} className="dp-fill" style={{stroke: 'var(--text-dim)'}} />
    <circle cx={g.hx} cy={g.cy} r={g.ringR} className="dp-faint" style={{strokeWidth: 3}} />
    {ring !== undefined && ring > 0 && <path d={arcPath(g.hx, g.cy, g.ringR, ring)} fill="none" stroke={ring >= 1 ? 'var(--stall)' : 'var(--dp-value)'} strokeWidth={3} />}
    <circle cx={g.hx} cy={g.cy} r={g.pulseR} fill="none" strokeWidth={1.2} strokeDasharray="2 2.5"
      className={pulse ? undefined : 'dp-faint'} stroke={pulse} opacity={pulse ? fresh : undefined} />
    {/* the observers */}
    {!mini && cap > 0 && <g>
      {whole && <text x={g.sx} y={sy + 6} className="dp-axis">observers</text>}
      {Array.from({length: cap}, (_, i) => {
        const lit = peers !== undefined && i < peers
        return <rect key={i} x={sx0 + i * pitch} y={sy} width={slot} height={slot} fill={lit ? 'var(--dp-value)' : 'none'} className={lit ? undefined : 'dp-faint'} />
      })}
    </g>}
    {whole && set && fan !== undefined && <Handle n={2} shape="square" x={sx0 + fan * pitch + 3} y={sy + slot / 2} label="Fan-out"
      does="Drag along the slots: how many observers may watch beside the shell."
      onDrag={x => set('fanOut', Math.round(clampTo(0, FAN_MAX, (x - 3 - sx0) / pitch)))} onReset={() => set('fanOut', FAN_DEFAULT)} />}
    {!mini && missing.length > 0 && <text x={g.sx} y={whole ? 108 : 87} className="dp-axis">{sayMissing}</text>}
    {/* the readout: epoch and sequence, observers and frames in flight */}
    {size === 'compact' && <>
      <Pair x={7} y={96} k="epoch" val={epochOf(v, 6)} />
      <Pair x={78} y={96} k="seq" val={shown(v, 'seq')} />
      <Pair x={7} y={106} k="peers" val={peersLine(v)} />
      <Pair x={78} y={106} k="flight" val={shown(v, 'inflight')} />
    </>}
    {/* the time since the last check-in, on the scale that ends at 30 min */}
    {!mini && age !== undefined && <text x={g.a0} y={g.axisY - 9} className="dp-ink-dim" style={state === 'stalled' ? {fill: 'var(--stall)'} : undefined}>
      {age < 0 ? 'no check-in' : state === 'stalled' ? `stalled · ${span(age)}` : `check-in ${span(age)} ago`}
    </text>}
    {after !== undefined && <rect x={ax(after)} y={g.axisY - 2} width={Math.max(0, g.a1 - ax(after))} height={4} fill="var(--stall)" opacity={0.3} />}
    <path d={`M${g.a0} ${g.axisY}H${g.a1}`} className="dp-grid" />
    {STOPS.map((s, i) => <g key={s}>
      <path d={`M${ax(s)} ${g.axisY - 3}V${g.axisY + 3}`} className="dp-faint" />
      {!mini && <text x={ax(s)} y={g.axisY + 15} className="dp-axis" textAnchor={i === STOPS.length - 1 ? 'end' : 'middle'} style={{fontSize: 7.5}}>{STOP_LABEL[i]}</text>}
    </g>)}
    {age !== undefined && age >= 0 && <path d={`M${ax(age)} ${g.axisY - 6}V${g.axisY + 5}`} stroke={state === 'stalled' ? 'var(--stall)' : state === 'idle' ? 'var(--text-faint)' : 'var(--dp-value)'} strokeWidth={2} />}
    {!mini && set && after !== undefined && <Handle n={1} shape="ring" x={ax(after)} y={g.axisY} label="Stall after"
      does="Drag along the scale: the time without progress after which the session counts as stalled."
      onDrag={x => set('stallAfter', STOPS[near(x)]!)} onReset={() => set('stallAfter', STALL_DEFAULT)} />}
  </Display>
}

// ---------------------------------------------------------------- the controls

const st = (p: ViewProps, key: string) => p.standing?.[key] ?? {}

const transportRadio = (p: ViewProps) => <Radio label="Transport" does={SAYS.transport} value={strOf(p.v, 'transport') ?? ''} options={TRANSPORTS} stack
  onChange={x => p.set('transport', x)} {...st(p, 'transport')} />
const approvalsRadio = (p: ViewProps) => <Radio label="Approvals" does={SAYS.approvals} value={strOf(p.v, 'approvals') ?? ''} options={APPROVALS} stack
  onChange={x => p.set('approvals', x)} {...st(p, 'approvals')} />
const stallDial = (p: ViewProps) => <Dial label="Stall after" does={SAYS.stall} value={stopIndex(p.v) ?? NaN} def={1} scale={{min: 0, max: 3, step: 1}}
  format={i => STOP_LABEL[Math.round(i)]!} onChange={i => p.set('stallAfter', STOPS[Math.round(i)]!)} {...st(p, 'stallAfter')} />
const connectToggle = (p: ViewProps) => <Toggle label="Connect" does={SAYS.connect} on={boolOf(p.v, 'connect') === true} unknown={boolOf(p.v, 'connect') === undefined}
  onChange={x => p.set('connect', x)} {...st(p, 'connect')} />
const autoToggle = (p: ViewProps) => <Toggle label="Auto-continue" does={SAYS.autoContinue} on={boolOf(p.v, 'autoContinue') === true} unknown={boolOf(p.v, 'autoContinue') === undefined}
  onChange={x => p.set('autoContinue', x)} {...st(p, 'autoContinue')} />
const fanDial = (p: ViewProps) => <Dial label="Fan-out" does={SAYS.fanOut} value={numOf(p.v, 'fanOut') ?? NaN} def={FAN_DEFAULT} scale={{min: 0, max: FAN_MAX, step: 1}}
  format={x => `${Math.round(x)}`} onChange={x => p.set('fanOut', Math.round(x))} {...st(p, 'fanOut')} />

const atWork = (p: ViewProps) => lightOf(p) === 'lit' && (numOf(p.v, 'running') ?? 0) > 0
const head = (p: ViewProps) => ({light: lightOf(p), busy: atWork(p), onFold: p.nav.fold, onFull: p.nav.full})
const liveWord = (v: V) => liveOf(v) ?? NONE

// ---------------------------------------------------------------- the frame monitor, in the pane

function FramesPane({v}: {v: V}) {
  const [only, setOnly] = useState('')
  const frames = framesOf(v)
  const sessions = [...new Set(frames.map(f => f.session))]
  const rows = only && sessions.includes(only) ? frames.filter(f => f.session === only) : frames
  const state = liveOf(v), readiness = strOf(v, 'readiness'), refused = strOf(v, 'refused')
  const ready = readiness ?? (refused !== undefined ? 'Refused' : NONE)
  const age = numOf(v, 'beatAge'), ring = numOf(v, 'ring'), cap = numOf(v, 'ringCap')
  return <div className="gw-pane">
    <div className="gw-head" aria-label="The gateway">
      <b>Gateway</b><span>{shown(v, 'harness')}</span><span>{shown(v, 'transport')}</span>
      <span>{boolOf(v, 'connect') === undefined ? NONE : boolOf(v, 'connect') ? 'attached' : 'detached'}</span>
      <span>epoch {epochOf(v)}</span>
      <span data-state={refused !== undefined && readiness === undefined ? 'refused' : state === 'stalled' ? 'stalled' : undefined}>{refused !== undefined && readiness === undefined ? 'refused' : liveWord(v)}</span>
    </div>
    <div className="gw-body">
      <div className="gw-frames">
        <div className="gw-chips" role="group" aria-label="Session">
          <button type="button" aria-pressed={!only || !sessions.includes(only)} onClick={() => setOnly('')}>All sessions</button>
          {sessions.map(s => <button key={s} type="button" aria-pressed={only === s} onClick={() => setOnly(s)}>{s}</button>)}
        </div>
        {rows.length === 0 ? <p className="gw-empty">No reading of the frames.</p> : <ol className="gw-list" aria-label="Frames">
          {rows.map((f, i) => <li key={`${f.session}:${f.seq ?? 'rpc'}:${i}`} className="gw-frame" data-dir={f.dir} data-kind={kindClass(f.kind)}>
            <span className="gw-seq" title={f.seq === undefined ? 'A sent frame carries no sequence number.' : undefined}>{f.seq ?? NONE}</span>
            <span className="gw-at">{f.at}</span><span className="gw-dir" aria-label={f.dir === 'out' ? 'Sent' : 'Received'}>{f.dir === 'out' ? '→' : '←'}</span>
            <span className="gw-kind">{f.kind}</span><span className="gw-session">{f.session}</span><span className="gw-note">{f.note}</span>
          </li>)}
        </ol>}
      </div>
      <aside className="gw-reads" aria-label="Readings">
        <section className="gw-read"><h4>Readiness</h4>
          <strong data-state={readiness === undefined ? (refused !== undefined ? 'refused' : 'none') : undefined}>{ready}</strong>
          <p>{refused !== undefined ? refused : <>harness <b>{shown(v, 'harness')}</b></>}</p></section>
        <section className="gw-read"><h4>Liveness</h4>
          <strong data-state={state === 'stalled' ? 'stalled' : state === undefined ? 'none' : undefined}>{liveWord(v)}</strong>
          <p>last check-in <b>{age === undefined ? NONE : age < 0 ? 'none' : `${span(age)} ago`}</b></p>
          <p>stalls after <b>{stallLabel(v)}</b> · turns running <b>{shown(v, 'running')}</b></p></section>
        <section className="gw-read"><h4>Replay</h4>
          <strong data-state={ring === undefined || cap === undefined ? 'none' : undefined}>{ring === undefined || cap === undefined ? NONE : `${ring} of ${cap}`}</strong>
          <p>events in the ring · epoch <b>{epochOf(v)}</b></p>
          <p>last sequence <b>{shown(v, 'seq')}</b></p></section>
        <section className="gw-read"><h4>Upstream</h4>
          <strong data-state={has(v, 'harness') ? undefined : 'none'}>{shown(v, 'harness')}</strong>
          <p>over <b>{shown(v, 'transport')}</b> · observers <b>{peersLine(v)}</b></p>
          {boolOf(v, 'viaLead') && <p><b>via lead</b></p>}</section>
      </aside>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

const FRAMES = [
  {dir: 'out', kind: 'prompt.submit', session: 'build-lane', at: '14:02:01', note: 'Type-check the three TypeScript roots'},
  {seq: 381, dir: 'in', kind: 'message.start', session: 'build-lane', at: '14:02:01', note: ''},
  {seq: 382, dir: 'in', kind: 'message.delta', session: 'build-lane', at: '14:02:02', note: 'I will read the agent context first.'},
  {seq: 383, dir: 'in', kind: 'tool.start', session: 'build-lane', at: '14:02:04', note: 'Read · src/agent/AgentShellContext.tsx'},
  {seq: 384, dir: 'in', kind: 'tool.complete', session: 'build-lane', at: '14:02:04', note: 'Read · 412 lines'},
  {seq: 385, dir: 'in', kind: 'tool.start', session: 'build-lane', at: '14:02:09', note: 'Bash · tsc --noEmit -p packages/live-shell/ui'},
  {seq: 386, dir: 'in', kind: 'approval.request', session: 'build-lane', at: '14:02:09', note: 'Bash waits for you'},
  {dir: 'out', kind: 'approval.respond', session: 'build-lane', at: '14:02:12', note: 'allow once'},
  {seq: 41, dir: 'in', kind: 'status.update', session: 'review-lane', at: '14:02:15', note: 'reading the diff'},
  {dir: 'out', kind: 'session.steer', session: 'build-lane', at: '14:02:21', note: 'Skip the cradle root.'},
  {seq: 387, dir: 'in', kind: 'tool.complete', session: 'build-lane', at: '14:02:38', note: 'Bash · exit 0'},
  {seq: 42, dir: 'in', kind: 'message.delta', session: 'review-lane', at: '14:02:41', note: 'Two findings so far.'},
  {seq: 388, dir: 'in', kind: 'status.update', session: 'build-lane', at: '14:02:47', note: 'turn 7 of 12'},
  {seq: 389, dir: 'in', kind: 'message.delta', session: 'build-lane', at: '14:02:52', note: 'All three roots type-check.'},
]

/** Every key the owner reports or writes: the "Refused" fixture leaves all of them out but the light, the harness and the reason. */
const KEYS = ['connect', 'transport', 'approvals', 'stallAfter', 'autoContinue', 'fanOut', 'readiness', 'epoch', 'seq', 'peers', 'beatAge', 'inflight', 'running', 'ring', 'ringCap', 'frames', 'viaLead']

const NOTHING = Object.fromEntries(KEYS.map(k => [k, undefined])) as unknown as Values

export const design: DesignedDevice = {
  id: 'actuation:gateway',
  title: 'Gateway',
  kind: 'effect',
  defaults: {
    light: 'lit', harness: 'hermes',
    // What the owner writes, at the owner's defaults.
    connect: true, transport: 'stdio', approvals: 'ask', stallAfter: STALL_DEFAULT, autoContinue: true, fanOut: FAN_DEFAULT,
    // Readings: what the owner reports, never set from here.
    readiness: 'ready', epoch: '3f9a21c4e07b4d59a1e2c6b83d70f5a4', seq: 389, peers: 2, beatAge: 6, inflight: 3, running: 2, ring: 389, ringCap: 512,
    frames: JSON.stringify(FRAMES),
  },
  fixtures: {
    Ready: {},
    Stalled: {beatAge: 140, inflight: 0, running: 1},
    Refused: {...NOTHING, light: 'dark', refused: 'The gateway refused the read: it is not running.'},
  },

  folded: p => <Folded title="Gateway" light={lightOf(p)} readings={[shown(p.v, 'harness'), ...(boolOf(p.v, 'viaLead') ? ['via lead'] : [])]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Gateway" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <LinkWell v={p.v} set={p.set} size="compact" />
    </Section>
    <Section label="Macros" cols={2} width={124}>
      {transportRadio(p)}
      {approvalsRadio(p)}
      {stallDial(p)}
      {connectToggle(p)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Gateway" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <LinkWell v={p.v} set={p.set} size="whole" />
      </Section>
      <Section label="Link" cols={2}>
        {transportRadio(p)}
        {fanDial(p)}
        {connectToggle(p)}
      </Section>
      <Section label="Approval" grow>
        {approvalsRadio(p)}
      </Section>
    </Band>
    <Band>
      <Section label="Liveness" cols={2} width={152}>
        {stallDial(p)}
        {autoToggle(p)}
      </Section>
      <Section label="Readiness" cols={4} grow>
        <Readout label="state" does="The harness's own word for its state. A refusal shows here in orange." value={readyWord(p.v)} tone={readyTone(p.v)} />
        <Readout label="epoch" does="Which start of the gateway these frames belong to. A new epoch means the gateway restarted." value={strOf(p.v, 'epoch') === undefined ? undefined : epochOf(p.v)} />
        <Readout label="seq" does="The last sequence number of this session. Each session counts its own frames." value={numOf(p.v, 'seq')} />
        <Readout label="ring" does="Events the replay ring holds, of the events it keeps." value={numOf(p.v, 'ring') === undefined || numOf(p.v, 'ringCap') === undefined ? undefined : `${numOf(p.v, 'ring')}/${numOf(p.v, 'ringCap')}`} />
        <Readout label="peers" does="Observers attached beside the shell, of the observers allowed." value={numOf(p.v, 'peers') === undefined ? undefined : peersLine(p.v)} />
        <Readout label="in flight" does="Frames sent and not yet taken." value={numOf(p.v, 'inflight')} tone="value" />
        <Readout label="turns" does="Turns that run through this gateway now." value={numOf(p.v, 'running')} />
        <Readout label="check-in" does="The time since the session last made progress." value={numOf(p.v, 'beatAge') === undefined ? undefined : span(numOf(p.v, 'beatAge')!)}
          tone={liveOf(p.v) === 'stalled' ? 'stall' : undefined} />
      </Section>
    </Band>
  </Panel>,

  full: p => <FramesPane v={p.v} />,

  widget: p => <Tile title={has(p.v, 'harness') ? `Gateway · ${strOf(p.v, 'harness')}` : 'Gateway'} light={lightOf(p)} busy={atWork(p)} span={2} onFull={p.nav.full}>
    <LinkWell v={p.v} size="mini" />
    <div className="gw-tile-side">
      <Readout label="state" does="The harness's own word for its state." value={readyWord(p.v)} tone={readyTone(p.v)} />
      <Readout big label="in flight" does="Frames sent and not yet taken. Press to open the frames." value={numOf(p.v, 'inflight')} tone="value" onPress={p.nav.full} />
      <Readout label="check-in" does="The time since the session last made progress." value={numOf(p.v, 'beatAge') === undefined ? undefined : span(numOf(p.v, 'beatAge')!)}
        tone={liveOf(p.v) === 'stalled' ? 'stall' : undefined} />
    </div>
  </Tile>,
}
