// The Frames monitor (manual §19.6 and its widget entry §23.8, actuation:frames-monitor): what passed between the shell and the
// harness, per session, in order. Live's nearest: a MIDI monitor (a tape of events) — here a small effect whose picture is the tape:
// five kind lanes, one tick for each frame, the last frames under them, and the Keep scale at the foot.
//
// Value keys. The monitor's own settings (the shell holds them; nothing here is written to the harness):
//   session (all · lead · a session's name), direction (both · out · in), kinds (a comma list of messages · tools · heartbeat ·
//   approvals · errors, or none), follow (bool), pause (bool), keep (100 to 5000 frames).
// The owner reports (never written from here), under the Gateway's own names (actuation__gateway.tsx:6-13):
//   light (lit · dark), harness, transport, connect, readiness, epoch, seq (the last sequence number of the session), peers, fanOut,
//   beatAge (seconds since the last check-in, -1 when none), stallAfter, running, inflight, ring and ringCap (events held, events
//   kept: the gateway's replay ring keeps 512 for each session, Hermes tui_gateway/event_replay.py:28), viaLead,
//   lead (the name of the lead's session), frames (a JSON list of {seq?, dir, kind, session, at, note, task?, turn?, step?}).
//   A frame the shell sent carries no seq: only the gateway numbers a frame it sends (event_replay.py:50-56).
// A key the owner has not reported is absent, and the view draws "—" for it, and names it in the well.
import {useEffect, useRef, useState} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState, type Option} from '../../sdk/panel'
import {boolOf, clampTo, has, json, NONE, numOf, shown, strOf, type DesignedDevice, type ViewProps} from './design'
import './actuation__frames-monitor.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

/** The five kinds of frame, in lane order, and what each holds. */
const KINDS = [
  {id: 'messages', label: 'Messages', short: 'Msg', does: 'Show the agent\'s text, your prompts and your steer lines.'},
  {id: 'tools', label: 'Tools', short: 'Tools', does: 'Show each tool call, from its start to its end.'},
  {id: 'heartbeat', label: 'Heartbeat', short: 'Beat', does: 'Show status, usage and session frames: the frames that show the lane lives.'},
  {id: 'approvals', label: 'Approvals', short: 'Appr', does: 'Show requests that wait for you, and your answers.'},
  {id: 'errors', label: 'Errors', short: 'Err', does: 'Show errors, gateway faults and timeouts.'},
] as const
type KindId = (typeof KINDS)[number]['id']
const ORDER: readonly KindId[] = KINDS.map(k => k.id)
const ALL_KINDS = ORDER.join(',')

/** Which kind a frame belongs to. Every frame belongs to one; a frame of any other kind counts as Heartbeat. */
const kindOf = (kind: string): KindId => {
  const k = kind.toLowerCase()
  if (/error|stderr|timeout|reconnecting/.test(k)) return 'errors'
  if (/^(approval|sudo|secret)\./.test(k)) return 'approvals'
  if (/^(tool|subagent)\./.test(k)) return 'tools'
  if (/^(message|prompt|thinking|reasoning|clarify)\./.test(k) || k === 'session.steer') return 'messages'
  return 'heartbeat'
}

const KEEP_MIN = 100, KEEP_MAX = 5000, KEEP_DEFAULT = 1000
/** The frames of the widget's tape: the tile holds eleven lines. */
const TILE_LINES = 11

const DIRECTIONS: readonly Option<string>[] = [
  {value: 'both', label: 'Both', does: 'Show the frames the shell sent and the frames it received.'},
  {value: 'out', label: 'Sent', does: 'Show only the frames the shell sent.'},
  {value: 'in', label: 'Received', does: 'Show only the frames the shell received.'},
]
const KIND_SETS: readonly Option<string>[] = [
  {value: ALL_KINDS, label: 'All kinds'},
  {value: 'messages', label: 'Messages'},
  {value: 'tools', label: 'Tools'},
  {value: 'approvals', label: 'Approvals'},
  {value: 'errors', label: 'Errors'},
  {value: 'tools,errors', label: 'Tools + errors'},
  {value: 'none', label: 'None'},
]

const SAYS = {
  session: 'Whose frames to show: one session, the lead, or all sessions.',
  direction: 'Show the frames the shell sent, the frames it received, or both.',
  kinds: 'The kinds of frame to show. A hidden kind dims on the lanes.',
  follow: 'Slide the list to each new frame. Off keeps the list where it is.',
  pause: 'Hold the list still. The gateway keeps the frames that arrive.',
  keep: 'How many frames the monitor holds. Drag handle 1 along the scale. The mark is the 512 events the gateway keeps for each session.',
}

// ---------------------------------------------------------------- readings

const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}

interface Frame {id: number; seq?: number; dir: 'in' | 'out'; kind: string; session: string; at: string; note: string; task?: string; turn?: number; step?: number}
const finite = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
/** The frames the owner reports, kept only where they have a shape. Nothing in a bad list can throw. */
const framesOf = (v: V): Frame[] => {
  const raw = json<unknown>(v, 'frames', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((f, id): Frame[] => {
    if (!f || typeof f !== 'object') return []
    const r = f as Record<string, unknown>
    if (typeof r.kind !== 'string') return []
    return [{id, seq: finite(r.seq), dir: r.dir === 'out' ? 'out' : 'in', kind: r.kind, session: typeof r.session === 'string' ? r.session : NONE,
      at: typeof r.at === 'string' ? r.at : NONE, note: typeof r.note === 'string' ? r.note : '',
      task: typeof r.task === 'string' ? r.task : undefined, turn: finite(r.turn), step: finite(r.step)}]
  })
}

/** The kinds that are on, or undefined when the owner has not said. */
const kindsOf = (v: V): KindId[] | undefined => {
  const s = strOf(v, 'kinds')
  if (s === undefined) return undefined
  return ORDER.filter(k => s.split(',').includes(k))
}
const canon = (on: readonly KindId[]) => (on.length ? ORDER.filter(k => on.includes(k)).join(',') : 'none')

interface Scope {
  /** Every frame the monitor holds (the last Keep of them). */
  readonly all: Frame[]
  /** The frames of the chosen session. */
  readonly scoped: Frame[]
  /** The frames of the chosen session that pass Direction and Kinds. */
  readonly passing: Frame[]
  readonly sessions: string[]
  /** The one session chosen (the lead resolved), when one is. */
  readonly name: string | undefined
  readonly missing: string[]
  readonly note: string | undefined
}
const filterOf = (v: V): ((f: Frame) => boolean) => {
  const dir = strOf(v, 'direction'), kinds = kindsOf(v)
  return f => (dir === undefined || dir === 'both' || f.dir === dir) && (kinds === undefined || kinds.includes(kindOf(f.kind)))
}
function scopeOf(v: V): Scope {
  const keep = numOf(v, 'keep'), read = framesOf(v)
  const all = keep === undefined || read.length <= keep ? read : read.slice(read.length - Math.floor(keep))
  const pick = strOf(v, 'session'), lead = strOf(v, 'lead')
  const name = pick === 'lead' ? lead : pick === 'all' ? undefined : pick
  const scoped = pick === undefined || pick === 'all' ? all : name === undefined ? [] : all.filter(f => f.session === name)
  const pass = filterOf(v)
  return {all, scoped, passing: scoped.filter(pass), sessions: [...new Set(all.map(f => f.session))], name,
    missing: ['session', 'direction', 'kinds'].filter(k => !has(v, k)), note: pick === 'lead' && lead === undefined ? 'No reading of the lead' : undefined}
}

const clockSecs = (at: string): number | undefined => {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(at)
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined
}
/** Frames a minute, over the time the frames span. */
const rateOf = (fs: readonly Frame[]): number | undefined => {
  const t = fs.map(f => clockSecs(f.at)).filter((x): x is number => x !== undefined)
  if (t.length < 2) return undefined
  const span = Math.max(...t) - Math.min(...t)
  return span > 0 ? (t.length - 1) / (span / 60) : undefined
}
const rateText = (fs: readonly Frame[]) => { const r = rateOf(fs); return r === undefined ? NONE : `${Math.round(r)} /min` }
/** Frames the gateway holds for the chosen session beyond the newest frame the monitor has taken: the sequence the gateway reports,
 * less the last sequence in the list. Known for one session only. */
const behindOf = (v: V, sc: Scope): number | undefined => {
  const seq = numOf(v, 'seq')
  if (seq === undefined || sc.name === undefined) return undefined
  const mine = sc.scoped.flatMap(f => (f.seq === undefined ? [] : [f.seq]))
  return mine.length ? Math.max(0, seq - Math.max(...mine)) : undefined
}
const epochOf = (v: V, n = 8) => { const e = strOf(v, 'epoch'); return e === undefined ? NONE : e.slice(0, n) }
const span = (s: number) => (s < 0 ? 'none' : s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`)
/** Stalled needs work pending: a session that is quiet with nothing running is idle. */
const liveOf = (v: V): 'live' | 'stalled' | 'idle' | undefined => {
  const age = numOf(v, 'beatAge'), after = numOf(v, 'stallAfter'), running = numOf(v, 'running')
  if (age === undefined) return undefined
  if (age < 0) return 'idle'
  if (after === undefined) return undefined
  if (age < after) return 'live'
  if (running === undefined) return undefined
  return running > 0 ? 'stalled' : 'idle'
}
const sessionLabel = (v: V) => {
  const s = strOf(v, 'session')
  return s === undefined ? NONE : s === 'all' ? 'all sessions' : s === 'lead' ? `the lead · ${shown(v, 'lead')}` : s
}
const directionLabel = (v: V) => DIRECTIONS.find(o => o.value === strOf(v, 'direction'))?.label.toLowerCase() ?? NONE
const kindsLabel = (v: V) => {
  const on = kindsOf(v)
  return on === undefined ? NONE : on.length === ORDER.length ? 'all kinds' : on.length ? on.join(' · ') : 'no kinds'
}

// ---------------------------------------------------------------- the well

type Size = 'compact' | 'whole'
/** Where the marks stand, by size: the lanes, the last frames, the Keep scale. */
const GEO = {
  compact: {w: 140, h: 146, x0: 28, x1: 134, lane0: 22, pitch: 10, tick: 5, rule: 71, text0: 81, line: 10, lines: 4, chars: 22, axisY: 133, a0: 8, a1: 132, keepX: 66},
  whole: {w: 194, h: 146, x0: 32, x1: 188, lane0: 22, pitch: 9, tick: 4, rule: 67, text0: 77, line: 9, lines: 5, chars: 36, axisY: 133, a0: 8, a1: 186, keepX: 104},
} as const

const Pair = ({x, y, k, val}: {x: number; y: number; k: string; val: string}) =>
  <text x={x} y={y} className="dp-ink-dim"><tspan className="dp-axis">{k} </tspan>{val}</text>

/** One line of the tape: the direction, the kind and the note, cut to fit. */
function FrameLine({f, x, y, chars}: {f: Frame; x: number; y: number; chars: number}) {
  const kind = f.kind.length > chars - 2 ? `${f.kind.slice(0, chars - 3)}…` : f.kind
  const room = chars - kind.length - 2
  const note = room < 3 ? '' : f.note.length > room ? `${f.note.slice(0, room - 1)}…` : f.note
  return <text x={x} y={y} className="fm-ln">
    <tspan style={{fill: f.dir === 'out' ? 'var(--dp-on)' : 'var(--dp-value)'}}>{f.dir === 'out' ? '→' : '←'}</tspan>
    <tspan dx={4} className="fm-ln-kind">{kind}</tspan><tspan dx={4} className="fm-ln-note">{note}</tspan>
  </text>
}

/** The tape: five kind lanes, a tick for each frame of the chosen session (sent above its lane's line, received below, placed by
 * the time of the frame), the last frames that pass the filters, and the Keep scale. Handle 1 sets Keep. */
function Tape({v, set, size}: {v: V; set?: ViewProps['set']; size: Size}) {
  const g = GEO[size]
  const sc = scopeOf(v), pass = filterOf(v), kinds = kindsOf(v)
  const keep = numOf(v, 'keep'), ringCap = numOf(v, 'ringCap')
  const paused = boolOf(v, 'pause'), follow = boolOf(v, 'follow')
  const read = has(v, 'frames')
  const held = read ? sc.all.length : undefined
  const behind = behindOf(v, sc)
  const corner = paused === true ? (behind ? `held +${behind}` : 'held') : rateText(sc.scoped)
  const laneY = (i: number) => g.lane0 + i * g.pitch
  // the time of each frame places it along the lanes; frames without a time are spread evenly
  const times = sc.scoped.map(f => clockSecs(f.at))
  const timed = sc.scoped.length > 1 && times.every(t => t !== undefined)
  const lo = timed ? Math.min(...(times as number[])) : 0, hi = timed ? Math.max(...(times as number[])) : 0
  const px = (i: number) => {
    const a = g.x0 + 4, b = g.x1 - 4
    if (sc.scoped.length < 2) return b
    return timed && hi > lo ? a + (b - a) * ((times[i]! - lo) / (hi - lo)) : a + (b - a) * i / (sc.scoped.length - 1)
  }
  // the Keep scale: log from 100 to 5000, so the gateway's 512 and the default 1000 stand apart
  const ax = (k: number) => g.a0 + (g.a1 - g.a0) * clampTo(0, 1, Math.log(Math.max(k, KEEP_MIN) / KEEP_MIN) / Math.log(KEEP_MAX / KEEP_MIN))
  const fromAx = (x: number) => KEEP_MIN * Math.pow(KEEP_MAX / KEEP_MIN, clampTo(0, 1, (x - g.a0) / (g.a1 - g.a0)))
  const snap = (k: number) => clampTo(KEEP_MIN, KEEP_MAX, k < 1000 ? Math.round(k / 10) * 10 : Math.round(k / 100) * 100)
  const cursor = paused === true ? {stroke: 'var(--stall)', dash: '2 2'} : follow === true ? {stroke: 'var(--dp-value)', dash: undefined} : {stroke: 'var(--text-faint)', dash: '2 2'}
  const centre = (laneY(0) + laneY(4)) / 2 + 3
  const tail = sc.passing.slice(-g.lines)
  const missing = sc.missing.length === 0 ? '' : sc.missing.length === 1 ? `No ${sc.missing[0]}` : 'No filter readings'
  return <Display w={g.w} h={g.h} label="The tape" corner={read ? corner : NONE}
    does="Five kind lanes, a tick for each frame. Amber is sent, teal is received, a dim tick is hidden by a filter. Drag handle 1 to set Keep.">
    {/* the lanes */}
    {KINDS.map((k, i) => <g key={k.id} opacity={kinds === undefined || kinds.includes(k.id) ? 1 : 0.4}>
      <text x={4} y={laneY(i) + 3} className="dp-axis">{k.short}</text>
      <path d={`M${g.x0} ${laneY(i)}H${g.x1}`} className="dp-grid" />
    </g>)}
    {read && sc.scoped.length > 0 && <path d={`M${g.x1 - 1.5} ${laneY(0) - 5}V${laneY(4) + 6}`} stroke={cursor.stroke} strokeWidth={1} strokeDasharray={cursor.dash} />}
    {/* a tick for each frame */}
    {sc.scoped.map((f, i) => {
      const kind = kindOf(f.kind), cy = laneY(ORDER.indexOf(kind))
      const colour = kind === 'errors' ? 'var(--stall)' : f.dir === 'out' ? 'var(--dp-on)' : 'var(--dp-value)'
      return <rect key={f.id} x={px(i) - 1} y={f.dir === 'out' ? cy - g.tick - 0.5 : cy + 0.5} width={2} height={g.tick} fill={colour} opacity={pass(f) ? 1 : 0.22} />
    })}
    {!read && <text x={(g.x0 + g.x1) / 2} y={centre} className="dp-axis" textAnchor="middle">No reading of the frames</text>}
    {read && sc.scoped.length === 0 && <text x={(g.x0 + g.x1) / 2} y={centre} className="dp-axis" textAnchor="middle">{sc.note ?? 'No frames for this session'}</text>}
    {missing && <text x={4} y={11} className="dp-axis">{missing}</text>}
    {/* the last frames that pass the filters */}
    <path d={`M4 ${g.rule}H${g.w - 4}`} className="dp-grid" />
    {read && tail.map((f, i) => <FrameLine key={f.id} f={f} x={4} y={g.text0 + i * g.line} chars={g.chars} />)}
    {read && sc.scoped.length > 0 && tail.length === 0 && <text x={4} y={g.text0} className="dp-axis">No frame passes the filters</text>}
    {/* the Keep scale */}
    <Pair x={4} y={g.axisY - 9} k="held" val={held === undefined ? NONE : `${held}`} />
    <Pair x={g.keepX} y={g.axisY - 9} k="keep" val={shown(v, 'keep')} />
    {held !== undefined && <rect x={g.a0} y={g.axisY - 2} width={Math.max(2, ax(held) - g.a0)} height={4} fill="var(--dp-value)" opacity={0.7} />}
    <path d={`M${g.a0} ${g.axisY}H${g.a1}`} className="dp-grid" />
    {[KEEP_MIN, KEEP_DEFAULT, KEEP_MAX].map((k, i) => <g key={k}>
      <path d={`M${ax(k)} ${g.axisY - 3}V${g.axisY + 3}`} className="dp-faint" />
      {k !== KEEP_DEFAULT && <text x={ax(k)} y={g.axisY + 10} className="dp-axis" textAnchor={i === 2 ? 'end' : 'start'} style={{fontSize: 7.5}}>{k >= 1000 ? `${k / 1000}k` : k}</text>}
    </g>)}
    {ringCap !== undefined && ringCap >= KEEP_MIN && ringCap <= KEEP_MAX && <g>
      <path d={`M${ax(ringCap)} ${g.axisY - 6}V${g.axisY + 6}`} stroke="var(--text-dim)" strokeWidth={1} />
      <text x={ax(ringCap)} y={g.axisY + 10} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>ring</text>
    </g>}
    {set && keep !== undefined && <Handle n={1} shape="ring" x={ax(keep)} y={g.axisY} label="Keep"
      does="Drag along the scale: how many frames the monitor holds."
      onDrag={x => set('keep', snap(fromAx(x)))} onReset={() => set('keep', KEEP_DEFAULT)} />}
  </Display>
}

// ---------------------------------------------------------------- the controls

const st = (p: ViewProps, key: string) => p.standing?.[key] ?? {}

const sessionChooser = (p: ViewProps) => {
  const sc = scopeOf(p.v), cur = strOf(p.v, 'session')
  const named = sc.sessions.filter(n => n !== NONE && n !== 'all' && n !== 'lead')
  const options: Option<string>[] = [{value: 'all', label: 'All sessions'}, ...(has(p.v, 'lead') ? [{value: 'lead', label: 'The lead'}] : []), ...named.map(n => ({value: n, label: n}))]
  if (cur !== undefined && !options.some(o => o.value === cur)) options.push({value: cur, label: cur})
  return <Chooser label="Session" does={SAYS.session} value={cur ?? ''} options={options} onChange={x => p.set('session', x)} {...st(p, 'session')} />
}
const kindsChooser = (p: ViewProps) => {
  const cur = strOf(p.v, 'kinds'), options = [...KIND_SETS]
  if (cur !== undefined && !options.some(o => o.value === cur)) options.push({value: cur, label: 'Custom'})
  return <Chooser label="Kinds" does={SAYS.kinds} value={cur ?? ''} options={options} onChange={x => p.set('kinds', x)} {...st(p, 'kinds')} />
}
const directionRadio = (p: ViewProps) => <Radio label="Direction" does={SAYS.direction} value={strOf(p.v, 'direction') ?? ''} options={DIRECTIONS} stack
  onChange={x => p.set('direction', x)} {...st(p, 'direction')} />
const pauseToggle = (p: ViewProps) => <Toggle label="Pause" does={SAYS.pause} on={boolOf(p.v, 'pause') === true} unknown={boolOf(p.v, 'pause') === undefined}
  onChange={x => p.set('pause', x)} {...st(p, 'pause')} />
const followToggle = (p: ViewProps) => <Toggle label="Follow" does={SAYS.follow} on={boolOf(p.v, 'follow') === true} unknown={boolOf(p.v, 'follow') === undefined}
  onChange={x => p.set('follow', x)} {...st(p, 'follow')} />
const keepDial = (p: ViewProps) => <Dial label="Keep" does={SAYS.keep} value={numOf(p.v, 'keep') ?? NaN} def={KEEP_DEFAULT} scale={{min: KEEP_MIN, max: KEEP_MAX, log: true}}
  format={x => `${Math.round(x)}`} onChange={x => p.set('keep', clampTo(KEEP_MIN, KEEP_MAX, x < 1000 ? Math.round(x / 10) * 10 : Math.round(x / 100) * 100))} {...st(p, 'keep')} />
const kindToggles = (p: ViewProps) => {
  const on = kindsOf(p.v)
  return KINDS.map(k => <Toggle key={k.id} label={k.label} does={k.does} on={on?.includes(k.id) === true} unknown={on === undefined}
    onChange={x => p.set('kinds', canon(x ? [...(on ?? []), k.id] : (on ?? []).filter(o => o !== k.id)))} {...st(p, 'kinds')} />)
}

const head = (p: ViewProps) => ({light: lightOf(p), onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the frame list, in the pane

function FramesPane({v}: {v: V}) {
  const sc = scopeOf(v)
  const [pick, setPick] = useState<number | null>(null)
  // the list holds the rows that fit its height, top down; it never scrolls
  const listBox = useRef<HTMLDivElement>(null)
  const [cap, setCap] = useState(30)
  useEffect(() => {
    const el = listBox.current
    if (!el) return
    const fit = () => setCap(Math.max(1, Math.floor((el.clientHeight - 12) / 19)))
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const follow = boolOf(v, 'follow'), paused = boolOf(v, 'pause'), read = has(v, 'frames')
  const rows = sc.passing
  // Follow off keeps the list on the newest frame that it showed when Follow went off; newer frames collect below.
  const anchor = useRef<number | null>(null)
  let end = rows.length
  if (follow === false) {
    if (anchor.current === null && rows.length) anchor.current = rows[rows.length - 1]!.id
    const at = rows.findIndex(f => f.id === anchor.current)
    if (at >= 0) end = at + 1
  } else anchor.current = null
  const visible = rows.slice(Math.max(0, end - cap), end)
  const newer = rows.length - end
  const picked = pick === null ? undefined : sc.all.find(f => f.id === pick)
  const behind = behindOf(v, sc), ringCap = numOf(v, 'ringCap'), ring = numOf(v, 'ring')
  const gap = behind !== undefined && ringCap !== undefined && behind > ringCap
  const state = liveOf(v), readiness = strOf(v, 'readiness'), refused = strOf(v, 'refused'), age = numOf(v, 'beatAge')
  const stateText = paused === undefined ? NONE : paused ? 'held' : follow === false ? 'not following' : follow === undefined ? NONE : 'following'
  return <div className="fm-pane">
    <div className="fm-head" aria-label="The Frames monitor">
      <b>Frames</b><span>{sessionLabel(v)}</span><span>{directionLabel(v)}</span><span>{kindsLabel(v)}</span>
      <span data-state={paused ? 'held' : undefined}>{stateText}</span><span>epoch {epochOf(v)}</span>
    </div>
    <div className="fm-body">
      <div className="fm-frames">
        <div className="fm-listbox" ref={listBox}>
        {!read ? <p className="fm-empty">No reading of the frames.</p>
          : sc.scoped.length === 0 ? <p className="fm-empty">{sc.note ?? 'No frames for this session.'}</p>
          : rows.length === 0 ? <p className="fm-empty">No frame passes the filters.</p>
          : <ol className="fm-list" aria-label="Frames">
            {visible.map(f => <li key={f.id}>
              <button type="button" className="fm-frame" data-dir={f.dir} data-kind={kindOf(f.kind)} aria-pressed={f.id === pick} onClick={() => setPick(f.id === pick ? null : f.id)}>
                <span className="fm-seq" title={f.seq === undefined ? 'A sent frame carries no sequence number.' : undefined}>{f.seq ?? NONE}</span>
                <span className="fm-at">{f.at}</span><span className="fm-dir" aria-label={f.dir === 'out' ? 'Sent' : 'Received'}>{f.dir === 'out' ? '→' : '←'}</span>
                <span className="fm-kind">{f.kind}</span><span className="fm-session">{f.session}</span><span className="fm-note">{f.note}</span>
              </button>
            </li>)}
          </ol>}
        </div>
        {read && <div className="fm-foot">
          <span>{rows.length} of {sc.scoped.length} frames pass the filters</span>
          {newer > 0 && <span>{newer} newer</span>}
          {behind !== undefined && behind > 0 && <span data-state={gap ? 'stalled' : undefined}>{gap ? `gap: the gateway kept ${ringCap} of ${behind} waiting` : `${behind} waiting in the gateway`}</span>}
        </div>}
      </div>
      <aside className="fm-reads" aria-label="Readings">
        <section className="fm-read"><h4>Position</h4>
          <strong data-state={picked === undefined ? 'none' : undefined}>{picked === undefined ? NONE : picked.turn === undefined ? NONE : `turn ${picked.turn}`}</strong>
          {picked === undefined ? <p>Press a frame.</p> : <>
            <p>task <b>{picked.task ?? NONE}</b></p>
            <p>step <b>{picked.step ?? NONE}</b> · {picked.session} · {picked.at}</p></>}</section>
        <section className="fm-read"><h4>Readiness</h4>
          <strong data-state={readiness === undefined ? (refused !== undefined ? 'refused' : 'none') : undefined}>{readiness ?? (refused !== undefined ? 'Refused' : NONE)}</strong>
          <p>{refused !== undefined ? refused : <>harness <b>{shown(v, 'harness')}</b></>}</p></section>
        <section className="fm-read"><h4>Liveness</h4>
          <strong data-state={state === 'stalled' ? 'stalled' : state === undefined ? 'none' : undefined}>{state ?? NONE}</strong>
          <p>last check-in <b>{age === undefined ? NONE : age < 0 ? 'none' : `${span(age)} ago`}</b></p>
          <p>turns running <b>{shown(v, 'running')}</b></p></section>
        <section className="fm-read"><h4>Replay</h4>
          <strong data-state={ring === undefined || ringCap === undefined ? 'none' : undefined}>{ring === undefined || ringCap === undefined ? NONE : `${ring} of ${ringCap}`}</strong>
          <p>events in the ring · epoch <b>{epochOf(v)}</b></p>
          <p>last sequence <b>{shown(v, 'seq')}</b></p></section>
        <section className="fm-read"><h4>Upstream</h4>
          <strong data-state={has(v, 'harness') ? undefined : 'none'}>{shown(v, 'harness')}</strong>
          <p>over <b>{shown(v, 'transport')}</b> · observers <b>{has(v, 'peers') ? `${shown(v, 'peers')}${has(v, 'fanOut') ? ` / ${shown(v, 'fanOut')}` : ''}` : NONE}</b></p>
          {boolOf(v, 'viaLead') && <p><b>via lead</b></p>}</section>
      </aside>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

const TASK = 'Type-check the three TypeScript roots'
const REVIEW = 'Review the lane diff'
const b = (o: object) => ({session: 'build-lane', task: TASK, turn: 7, ...o})
const r = (o: object) => ({session: 'review-lane', task: REVIEW, turn: 2, ...o})
/** Sample frames, laid over the Gateway's own fixture (actuation__gateway.tsx:299-314): a lane that builds and a lane that reviews. */
const FRAMES = [
  b({dir: 'out', kind: 'prompt.submit', at: '14:02:01', note: TASK, step: 1}),
  b({seq: 381, dir: 'in', kind: 'message.start', at: '14:02:01', note: '', step: 2}),
  b({seq: 382, dir: 'in', kind: 'message.delta', at: '14:02:02', note: 'I will read the agent context first.', step: 3}),
  b({seq: 383, dir: 'in', kind: 'tool.start', at: '14:02:04', note: 'Read · src/agent/AgentShellContext.tsx', step: 4}),
  b({seq: 384, dir: 'in', kind: 'tool.complete', at: '14:02:04', note: 'Read · 412 lines', step: 4}),
  b({seq: 385, dir: 'in', kind: 'tool.start', at: '14:02:09', note: 'Bash · tsc --noEmit -p packages/live-shell/ui', step: 5}),
  b({seq: 386, dir: 'in', kind: 'approval.request', at: '14:02:09', note: 'Bash waits for you', step: 5}),
  b({dir: 'out', kind: 'approval.respond', at: '14:02:12', note: 'allow once', step: 5}),
  r({seq: 41, dir: 'in', kind: 'status.update', at: '14:02:15', note: 'reading the diff', step: 1}),
  b({dir: 'out', kind: 'session.steer', at: '14:02:21', note: 'Skip the cradle root.', step: 6}),
  b({seq: 387, dir: 'in', kind: 'tool.complete', at: '14:02:38', note: 'Bash · exit 0', step: 5}),
  r({seq: 42, dir: 'in', kind: 'message.delta', at: '14:02:41', note: 'Two findings so far.', step: 2}),
  b({seq: 388, dir: 'in', kind: 'status.update', at: '14:02:47', note: 'turn 7 of 12', step: 7}),
  b({seq: 389, dir: 'in', kind: 'message.delta', at: '14:02:52', note: 'All three roots type-check.', step: 8}),
  r({seq: 43, dir: 'in', kind: 'error', at: '14:02:55', note: 'git diff failed: no upstream', step: 3}),
]

/** Every key the owner reports or the monitor holds: the "No readings" fixture drops all of them. */
const KEYS = ['light', 'harness', 'transport', 'connect', 'readiness', 'epoch', 'seq', 'peers', 'fanOut', 'beatAge', 'stallAfter', 'running', 'inflight', 'ring', 'ringCap', 'viaLead',
  'lead', 'frames', 'session', 'direction', 'kinds', 'follow', 'pause', 'keep']
const NOTHING = Object.fromEntries(KEYS.map(k => [k, undefined])) as Record<string, undefined>

export const design: DesignedDevice = {
  id: 'actuation:frames-monitor',
  title: 'Frames',
  kind: 'effect',
  defaults: {
    light: 'lit', harness: 'hermes', transport: 'stdio', connect: true,
    // The monitor's settings, at their defaults.
    session: 'build-lane', direction: 'both', kinds: ALL_KINDS, follow: true, pause: false, keep: KEEP_DEFAULT,
    // Readings: what the owner reports, never set from here.
    lead: 'build-lane', readiness: 'ready', epoch: '3f9a21c4e07b4d59a1e2c6b83d70f5a4', seq: 389, peers: 2, fanOut: 2, beatAge: 6, stallAfter: 90, running: 2, inflight: 3,
    ring: 389, ringCap: 512, frames: JSON.stringify(FRAMES),
  },
  fixtures: {
    Following: {},
    Paused: {pause: true, follow: false, seq: 401},
    'No readings': NOTHING,
  },

  folded: p => <Folded title="Frames" light={lightOf(p)} readings={[rateText(scopeOf(p.v).scoped), ...(boolOf(p.v, 'pause') ? ['Paused'] : [])]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Frames" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Tape v={p.v} set={p.set} size="compact" />
    </Section>
    <Section label="Macros" width={128}>
      {sessionChooser(p)}
      {kindsChooser(p)}
      {directionRadio(p)}
      {pauseToggle(p)}
    </Section>
  </Panel>,

  whole: p => {
    const sc = scopeOf(p.v), read = has(p.v, 'frames'), behind = behindOf(p.v, sc), ringCap = numOf(p.v, 'ringCap'), ring = numOf(p.v, 'ring')
    const rate = rateOf(sc.scoped)
    return <Panel title="Frames" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <Tape v={p.v} set={p.set} size="whole" />
        </Section>
        <Section label="Filter" width={116}>
          {sessionChooser(p)}
          {directionRadio(p)}
          <Readout label="shown" does="Frames of the chosen session that pass Direction and Kinds, out of all its frames." value={read && sc.missing.length < 3 ? `${sc.passing.length}/${sc.scoped.length}` : undefined} tone="value" />
        </Section>
        <Section label="Kinds" grow>
          {kindToggles(p)}
        </Section>
      </Band>
      <Band>
        <Section label="Display" cols={2} width={120}>
          {followToggle(p)}
          {pauseToggle(p)}
          {keepDial(p)}
        </Section>
        <Section label="Readings" cols={4} grow>
          <Readout label="rate" does="Frames a minute in the chosen session, over the time its frames span." value={read ? (rate === undefined ? undefined : `${Math.round(rate)}/min`) : undefined} tone="value" />
          <Readout label="held" does="Frames the monitor holds, out of the Keep limit." value={read ? sc.all.length : undefined} />
          <Readout label="sent" does="Frames the shell sent, in the chosen session." value={read ? sc.scoped.filter(f => f.dir === 'out').length : undefined} />
          <Readout label="received" does="Frames the shell received, in the chosen session." value={read ? sc.scoped.filter(f => f.dir === 'in').length : undefined} />
          <Readout label="behind" does="Frames the gateway holds for you while the list is paused. It turns orange when the ring has dropped some." value={behind}
            tone={behind !== undefined && ringCap !== undefined && behind > ringCap ? 'stall' : undefined} />
          <Readout label="ring" does="Events the gateway holds for the session, out of the events it keeps." value={ring === undefined || ringCap === undefined ? undefined : `${ring}/${ringCap}`} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <FramesPane v={p.v} />,

  widget: p => {
    const sc = scopeOf(p.v), read = has(p.v, 'frames'), lines = sc.passing.slice(-TILE_LINES)
    return <Tile title="Frames" light={lightOf(p)} span={2} onFull={p.nav.full} onClose={p.nav.close}>
      <div className="fm-tape" aria-label="The last frames">
        {!read ? <p className="fm-empty">No reading of the frames.</p>
          : sc.scoped.length === 0 ? <p className="fm-empty">{sc.note ?? 'No frames for this session.'}</p>
          : lines.length === 0 ? <p className="fm-empty">No frame passes the filters.</p>
          : <ol>{lines.map(f => <li key={f.id} className="fm-tl" data-dir={f.dir} data-kind={kindOf(f.kind)}>
            <span className="fm-tl-dir">{f.dir === 'out' ? '→' : '←'}</span><span className="fm-tl-kind">{f.kind}</span><span className="fm-tl-note">{f.note}</span>
          </li>)}</ol>}
      </div>
      <div className="fm-tile-side">
        <Readout label="frames/min" does="Frames a minute in the chosen session." value={read ? (rateOf(sc.scoped) === undefined ? undefined : `${Math.round(rateOf(sc.scoped)!)}`) : undefined} tone="value" />
        <Readout label="held" does="Frames the monitor holds." value={read ? sc.all.length : undefined} />
        {pauseToggle(p)}
      </div>
    </Tile>
  },
}
