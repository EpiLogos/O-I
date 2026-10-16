// Run (manual §19.17, software-factory:run-device): one session's stream of tasks along the clock, with the needle at its last
// check-in. Live's nearest: a clip lane in Arrangement view, with its takes stacked under it. The picture is the shell's own law
// (agent/agentRunModel.ts): tracks are agent sessions and clips are atomic tasks; a running task draws no end, a queued task no
// length, and a stalled task is frozen where its output stopped; the needle sits at the last check-in and is stalled once that is
// older than the heartbeat horizon (HEARTBEAT_HORIZON_MS, 90 s, agentRunModel.ts:95). The ruler is the shared axis, one window
// ending now (sharedAxis, agentRunModel.ts:277). Takes are the attempts of the work (the Factory owner, op factory_attempt_read;
// the shell's WorldClipTake, timeline/worldTrackAdapter.ts:38). Handle 1 moves along the takes and chooses the one you read.
//
// The owner's material arrives on these keys, and a key it does not report arrives absent (the views draw "—" and say what is
// missing). Times are minutes before now unless a key says otherwise.
// - `sessions`: rows of {id, name, short?, used?, cap?} (the Tasks device's own key and shape). `session` is the one shown.
// - `tasks`: the session's tasks, rows of {n, name, state, idle?, from?, last?} (the Tasks device's key and shape). state is queued |
//   running | stalled | ready | done (also failed). from is when the task began, last when its output last moved; a queued task has none.
// - `attempts`: the takes, rows of the Runs device's shape {id, n, state, agent, at, seen, current, tasks:[{id, title, state, t0,
//   seen}]} with `ago`, the minutes since the attempt began. `take` is the attempt you read.
// - `events`: the session's events, rows of {id, lane, ago, text}; lane is messages | files | terminal | web | graph.
// - `thread`: the stream of the session, rows of {who, kind, text, tool?, out?, state?, link?} (the Agent device's key and shape,
//   plus `task` rows {text, state} that mark where a task begins).
// - Readings: `needle` (seconds since the last check-in), `now` (minutes since midnight), `window` (minutes the ruler shows),
//   `color` (the session's colour), `light`. Settings: `watch`, `telemetry`, `solo`, `lanes`, `overview`. `open` is the event you
//   pressed, to open it in its widget.
import {type CSSProperties, type KeyboardEvent, type ReactNode} from 'react'
import {Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './software-factory__run-device.css'

type V = ViewProps['v']

/** The shell calls a session stalled once its last check-in is older than this, in seconds (agent/agentRunModel.ts:95). */
const HORIZON = 90

// ---------------------------------------------------------------- the owner's rows, read safely

const STATES = ['running', 'queued', 'stalled', 'failed', 'done', 'unknown'] as const
type State = (typeof STATES)[number]
/** The words other owners use for the same states (Tasks: ready; the shell's clips: waiting, stopped). */
const ALIASES: Readonly<Record<string, State>> = {ready: 'queued', waiting: 'queued', pending: 'queued', stopped: 'done', stall: 'stalled', run: 'running'}
const stateIn = (x: unknown): State => (typeof x !== 'string' ? 'unknown' : STATES.find(s => s === x) ?? (Object.hasOwn(ALIASES, x) ? ALIASES[x]! : 'unknown'))
const WORD: Readonly<Record<State, string>> = {running: 'running', queued: 'queued', stalled: 'stalled', failed: 'failed', done: 'done', unknown: 'not read'}
const TONE: Readonly<Record<State, Tone | undefined>> = {running: 'value', stalled: 'stall', done: 'green', failed: undefined, queued: undefined, unknown: undefined}
const LIGHT: Readonly<Record<State, LightState>> = {running: 'lit', stalled: 'lit', done: 'lit', failed: 'dark', queued: 'dark', unknown: 'unknown'}
const FILL: Readonly<Record<State, string>> = {running: 'var(--dp-value)', stalled: 'var(--stall)', done: 'var(--green)', failed: 'var(--text-dim)', queued: 'var(--text-faint)', unknown: 'var(--text-faint)'}

const word = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
const amount = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const objects = (raw: unknown): Record<string, unknown>[] => (Array.isArray(raw) ? raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)) : [])
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
/** Seconds as the shell writes a stall's age: 45s, 2m 10s. */
const age = (s: number) => (s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60) ? ` ${Math.round(s % 60)}s` : ''}`)
/** Minutes since midnight as a clock time. */
const hhmm = (m: number) => { const t = Math.floor(((m % 1440) + 1440) % 1440); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }

/** A task of the lane. `from` and `last` are minutes before now; a queued task has neither. */
interface Block { readonly id: string; readonly name: string; readonly state: State; readonly from?: number; readonly last?: number; readonly idle?: number }

function blocksOf(raw: unknown): Block[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return objects(raw).map((o, i) => ({id: String(amount(o.n) ?? i + 1), name: word(o.name) ?? word(o.title) ?? `Task ${amount(o.n) ?? i + 1}`, state: stateIn(o.state),
    from: amount(o.from), last: amount(o.last), idle: amount(o.idle)}))
}

/** A take: one attempt of the work. */
interface Take { readonly id: string; readonly n: number; readonly state: State; readonly agent?: string; readonly at?: string; readonly ago?: number; readonly seen?: number; readonly current: boolean; readonly tasks: readonly Block[] }

function takesOf(v: V): Take[] | undefined {
  const raw = json<unknown>(v, 'attempts', undefined)
  if (!Array.isArray(raw)) return undefined
  const list: Take[] = []
  objects(raw).forEach((o, i) => {
    const id = word(o.id) ?? (amount(o.id) !== undefined ? String(o.id) : undefined)
    if (!id) return
    const ago = amount(o.ago)
    const tasks = objects(o.tasks).flatMap(t => {
      const tid = word(t.id), t0 = amount(t.t0), seen = amount(t.seen)
      return tid ? [{id: tid, name: word(t.title) ?? tid, state: stateIn(t.state), from: ago !== undefined && t0 !== undefined ? ago - t0 : undefined, last: ago !== undefined && seen !== undefined ? ago - seen : undefined}] : []
    })
    list.push({id, n: amount(o.n) ?? i + 1, state: stateIn(o.state), agent: word(o.agent), at: word(o.at), ago, seen: amount(o.seen), current: o.current === true, tasks})
  })
  return list.sort((a, b) => a.n - b.n)
}

interface Ev { readonly id: string; readonly lane: string; readonly ago: number; readonly text: string }
function eventsOf(v: V): Ev[] | undefined {
  const raw = json<unknown>(v, 'events', undefined)
  if (!Array.isArray(raw)) return undefined
  return objects(raw).flatMap((o, i) => { const lane = word(o.lane), ago = amount(o.ago); return lane && ago !== undefined ? [{id: word(o.id) ?? `${lane}:${i}`, lane, ago, text: typeof o.text === 'string' ? o.text : ''}] : [] })
}

interface Session { readonly id: string; readonly name?: string; readonly short?: string }
const sessionsOf = (v: V): Session[] => objects(json<unknown>(v, 'sessions', [])).flatMap(o => { const id = word(o.id); return id ? [{id, name: word(o.name), short: word(o.short)}] : [] })
const sessionNow = (v: V) => sessionsOf(v).find(s => s.id === strOf(v, 'session'))
const sessionLabel = (s: Session | undefined) => (s ? s.short ?? s.name ?? s.id : undefined)

// ---------------------------------------------------------------- the lanes under the thread (fixed vocabulary)

const LANES: readonly {readonly id: string; readonly name: string}[] = [
  {id: 'messages', name: 'Messages'}, {id: 'files', name: 'Files'}, {id: 'terminal', name: 'Terminal'}, {id: 'web', name: 'Web'}, {id: 'graph', name: 'Graph'},
]
const LANE_OPTIONS: readonly Option<string>[] = [
  {value: 'none', label: 'None', does: 'No event lane under the lane.'},
  ...LANES.map(l => ({value: l.id, label: l.name, does: `Only the ${l.name} lane under the lane.`})),
  {value: 'all', label: 'All', does: 'Every event lane under the lane.'},
]
const WATCH: readonly Option<string>[] = [
  {value: 'in', label: 'In', does: 'Always stream this session into the widgets.'},
  {value: 'auto', label: 'Auto', does: 'Stream it when it is armed or selected.'},
  {value: 'off', label: 'Off', does: 'Never stream it.'},
]

// ---------------------------------------------------------------- the reading the views share

interface Reading {
  readonly win: number | undefined
  readonly now: number | undefined
  /** Seconds since the last check-in. */
  readonly needle: number | undefined
  readonly stalled: boolean | undefined
  readonly takes: readonly Take[] | undefined
  readonly take: Take | undefined
  /** The tasks the lane draws: the session's own, or those of an earlier take you read. */
  readonly blocks: readonly Block[] | undefined
  readonly events: readonly Ev[] | undefined
  readonly lanes: readonly {readonly id: string; readonly name: string}[]
}

function read(v: V): Reading {
  const takes = takesOf(v), take = takes?.find(t => t.id === strOf(v, 'take'))
  const own = blocksOf(json<unknown>(v, 'tasks', undefined))
  const earlier = take && !take.current
    ? take.tasks.length ? take.tasks : take.ago !== undefined ? [{id: take.id, name: `Take #${take.n}`, state: take.state, from: take.ago, last: take.seen !== undefined ? take.ago - take.seen : undefined}] : undefined
    : undefined
  const needle = numOf(v, 'needle'), lanes = strOf(v, 'lanes')
  return {win: numOf(v, 'window'), now: numOf(v, 'now'), needle, stalled: needle === undefined ? undefined : needle > HORIZON, takes, take, blocks: earlier ?? own, events: eventsOf(v),
    lanes: lanes === 'all' ? LANES : LANES.filter(l => l.id === lanes)}
}

const needleClock = (r: Reading): string | undefined => (r.now !== undefined && r.needle !== undefined ? hhmm(r.now - r.needle / 60) : undefined)
const needleWord = (r: Reading): string | undefined => (r.stalled === undefined ? undefined : r.stalled ? 'stalled' : 'live')
const countOf = (r: Reading, s: State) => (r.blocks ? r.blocks.filter(b => b.state === s).length : undefined)
const doingOf = (r: Reading): Block | undefined => r.blocks?.find(b => b.state === 'running') ?? r.blocks?.find(b => b.state === 'stalled') ?? r.blocks?.find(b => b.state === 'queued')
const light = (p: ViewProps): LightState => { const x = strOf(p.owner ?? p.v, 'light'); return x === 'lit' || x === 'dark' ? x : 'unknown' }
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the controls shared by the views

const SAYS = {
  session: 'The session whose lane the device shows. It follows the selected session.',
  watch: 'In: always stream this session into the widgets. Auto: stream it when it is armed or selected. Off: never.',
  telemetry: 'On: the session feeds the widgets, the Ledger and other agents. Off: it works in silence.',
  solo: 'On: only soloed sessions may run. The other sessions pause.',
  lanes: 'Event lanes: the lanes under the lane. Choose Messages, Files, Terminal, Web or Graph, all of them, or none.',
  overview: 'Shows the strip of the whole day above the ruler, with the window framed.',
  take: 'The take you read. A new attempt is a take under the same lane.',
}

const sessionChooser = (p: ViewProps) => {
  const options = sessionsOf(p.v).map(s => ({value: s.id, label: sessionLabel(s)!})), now = strOf(p.v, 'session')
  return <Chooser {...st(p, 'session')} label="Session" does={SAYS.session} wide value={now ?? ''}
    options={now !== undefined && !options.some(o => o.value === now) ? [...options, {value: now, label: now}] : options} onChange={x => p.set('session', x)} />
}
const watchRadio = (p: ViewProps) => <Radio {...st(p, 'watch')} label="Watch" does={SAYS.watch} value={strOf(p.v, 'watch') ?? ''} options={WATCH} stack onChange={x => p.set('watch', x)} />
const telemetryToggle = (p: ViewProps) => <Toggle {...st(p, 'telemetry')} label="Telemetry" does={SAYS.telemetry} on={boolOf(p.v, 'telemetry') === true} unknown={!has(p.v, 'telemetry')} onChange={x => p.set('telemetry', x)} />
const soloToggle = (p: ViewProps) => <Toggle {...st(p, 'solo')} label="Solo" does={SAYS.solo} on={boolOf(p.v, 'solo') === true} unknown={!has(p.v, 'solo')} onChange={x => p.set('solo', x)} />
const lanesChooser = (p: ViewProps) => <Chooser {...st(p, 'lanes')} label="Lanes" does={SAYS.lanes} wide value={strOf(p.v, 'lanes') ?? ''} options={LANE_OPTIONS} onChange={x => p.set('lanes', x)} />
const overviewToggle = (p: ViewProps) => <Toggle {...st(p, 'overview')} label="Overview" does={SAYS.overview} on={boolOf(p.v, 'overview') === true} unknown={!has(p.v, 'overview')} onChange={x => p.set('overview', x)} />

// ---------------------------------------------------------------- the picture

interface Lay { readonly w: number; readonly h: number; readonly x0: number; readonly x1: number }
const COMPACT: Lay = {w: 140, h: 146, x0: 38, x1: 122}
const WHOLE: Lay = {w: 194, h: 146, x0: 38, x1: 176}
const MINI: Lay = {w: 196, h: 106, x0: 8, x1: 176}

/** A press target in the well: an event to open. Enter and Space press it. */
const hit = (act: (() => void) | undefined, said: string) => ({
  className: act ? 'rn-hit' : undefined, role: act ? 'button' : undefined, tabIndex: act ? 0 : -1, 'data-i': said, onClick: act,
  onKeyDown: act ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act() } } : undefined,
})

/** One task in its state, by the law of the shell: done is dim and settled; running fades out to the right and has no end; queued is
 * dashed and has no length; stalled is striped, with an orange edge where its output stopped; failed is outlined. */
function Shape({state, x, y, w, h, colour, uid}: {state: State; x: number; y: number; w: number; h: number; colour: string; uid: string}): ReactNode {
  switch (state) {
    case 'done': return <rect x={x} y={y} width={w} height={h} fill={colour} opacity={0.4} />
    case 'running': return <><rect x={x} y={y} width={w} height={h} fill={colour} opacity={0.16} /><rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-run)`} /></>
    case 'stalled': return <><rect x={x} y={y} width={w} height={h} fill={colour} opacity={0.32} /><rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-stripe)`} /><rect x={x + w - 2} y={y} width={2} height={h} fill="var(--stall)" /></>
    case 'failed': return <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} fill="none" stroke={FILL.failed} />
    case 'queued': return <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} style={{fill: `color-mix(in srgb, ${colour} 22%, var(--dp-well))`}} stroke={colour} strokeDasharray="3 2" />
    default: return <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} className="dp-faint" strokeDasharray="1 3" />
  }
}

/** The lane on the clock, its event lanes, the needle and the present moment, the takes under them, and the strip of the day above. */
function Picture({p, r, g, uid, mode, live}: {p: ViewProps; r: Reading; g: Lay; uid: string; mode: 'compact' | 'whole' | 'mini'; live: boolean}) {
  const v = p.v, win = r.win, mini = mode === 'mini'
  const colour = strOf(v, 'color') ?? 'var(--dp-value)'
  const overview = !mini && boolOf(v, 'overview') === true
  const laneH = mini ? 26 : 14, laneY = mini ? 32 : overview ? 28 : 18
  const lanes = mini ? [] : r.lanes
  const lanesTop = laneY + laneH + 4, lanesEnd = lanesTop + lanes.length * 11
  const takesTop = lanesEnd + 4
  const xAt = (ago: number) => (win === undefined ? g.x0 : g.x1 - (clampTo(0, win, ago) / win) * (g.x1 - g.x0))
  const needleAgo = r.needle !== undefined ? r.needle / 60 : undefined
  const needleX = needleAgo !== undefined ? xAt(needleAgo) : undefined
  const stalled = r.stalled === true
  const bottom = mini ? g.h - 18 : takesTop + 1
  const queued = r.blocks?.filter(b => b.state === 'queued').length ?? 0
  const timed = r.blocks?.filter(b => b.state !== 'queued' && b.from !== undefined) ?? []
  const openId = strOf(v, 'open'), openSt = st(p, 'open')

  // The takes, newest first, as many as the well has room for; the one you read stays in view.
  const ordered = r.takes ? [...r.takes].reverse() : []
  const room = mini ? 0 : clampTo(0, mode === 'compact' ? 3 : 4, Math.floor((g.h - 14 - takesTop) / 10))
  const sel = ordered.findIndex(t => t.id === r.take?.id)
  const start = sel >= room ? sel - room + 1 : 0
  const shown = ordered.slice(start, start + room)
  const takeAt = (y: number) => shown[clampTo(0, Math.max(0, shown.length - 1), Math.floor((y - takesTop) / 10))]
  const handle = live && !st(p, 'take').disabled && has(v, 'take') && shown.some(t => t.id === r.take?.id)

  const dayX = (m: number) => 3 + (clampTo(0, 1440, m) / 1440) * (g.w - 6)
  const heading = mini ? undefined : r.blocks ? `${r.blocks.length} ${r.blocks.length === 1 ? 'task' : 'tasks'}${win !== undefined ? ` · ${win} min` : ''}` : win !== undefined ? `${win} min` : ''

  return <>
    <defs>
      <pattern id={`${uid}-stripe`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="var(--stall)" opacity=".75" /></pattern>
      <linearGradient id={`${uid}-run`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" style={{stopColor: colour, stopOpacity: 0.95}} /><stop offset="0.55" style={{stopColor: colour, stopOpacity: 0.55}} /><stop offset="1" style={{stopColor: colour, stopOpacity: 0.04}} />
      </linearGradient>
    </defs>
    {heading && <text x={3} y={10} className="dp-axis">{heading}</text>}
    {mini && <text x={g.x0} y={12} className="dp-ink-dim">{sessionLabel(sessionNow(v)) ?? NONE}</text>}
    {mini && <text x={g.x1} y={12} textAnchor="end" className="dp-axis">{win !== undefined ? `last ${win} min` : ''}</text>}

    {/* the strip of the day, the window framed */}
    {overview && (r.now === undefined
      ? <text x={3} y={21} className="dp-axis">No reading of the time</text>
      : <g>
        <rect x={3} y={14} width={g.w - 6} height={7} fill="none" className="dp-faint" />
        {r.takes?.filter(t => t.ago !== undefined && t.seen !== undefined).map(t => {
          const a = r.now! - t.ago!, b = Math.min(r.now!, a + t.seen!)
          return <rect key={t.id} x={dayX(a)} y={16} width={Math.max(1.5, dayX(b) - dayX(a))} height={3} fill={FILL[t.state]} opacity={0.85} />
        })}
        {win !== undefined && <rect x={dayX(r.now - win)} y={13} width={Math.max(3, dayX(r.now) - dayX(r.now - win))} height={9} fill="none" stroke="var(--dp-on)" strokeWidth={1} />}
      </g>)}

    {/* the ruler's ticks and the lane */}
    {win === undefined
      ? <text x={g.x0} y={laneY + laneH / 2 + 3} className="dp-axis">No reading of the window</text>
      : [0, 1, 2, 3, 4].map(k => <path key={k} d={`M${g.x0 + (k * (g.x1 - g.x0)) / 4} ${laneY - 3}v3`} className="dp-faint" />)}
    {!mini && <text x={3} y={laneY + laneH / 2 + 3} className="dp-ink-dim">{cut(sessionLabel(sessionNow(v)) ?? NONE, 7)}</text>}
    <path d={`M${g.x0} ${laneY + laneH}H${g.x1}`} className="dp-faint" />
    {r.blocks === undefined && win !== undefined && <text x={g.x0} y={laneY + laneH / 2 + 3} className="dp-axis">No reading of the tasks</text>}
    {win !== undefined && timed.map(b => {
      const xs = xAt(b.from!)
      const end = b.state === 'running' ? g.x1 : xAt(b.last ?? needleAgo ?? 0)
      const wid = Math.max(3, end - xs)
      const said = b.state === 'running' ? 'It has no end. It runs to the present moment.' : b.state === 'stalled' ? 'It stopped where its output stopped.' : b.state === 'failed' ? 'The owner reports it failed.' : ''
      return <g key={b.id} data-i={`${b.name}|${WORD[b.state]}. ${said}`.trim()}>
        <Shape state={b.state} x={xs} y={laneY} w={wid} h={laneH} colour={colour} uid={uid} />
        {wid >= 34 && <text x={xs + 4} y={laneY + laneH / 2 + 3} className="rn-name dp-ink">{cut(b.name, Math.floor((wid - 6) / 4.7))}</text>}
      </g>
    })}
    {queued > 0 && <g data-i={`Queued|${queued} ${queued === 1 ? 'task waits' : 'tasks wait'} for their launch. No length is drawn: nobody knows how long it will take.`}>
      <Shape state="queued" x={g.x1 + 4} y={laneY} w={12} h={laneH} colour={colour} uid={uid} />
      {queued > 1 && <text x={g.x1 + 10} y={laneY + laneH / 2 + 3} textAnchor="middle" className="rn-name dp-ink-dim">{queued}</text>}
    </g>}

    {/* the event lanes */}
    {win !== undefined && lanes.map((lane, i) => {
      const y = lanesTop + i * 11, mine = r.events?.filter(e => e.lane === lane.id) ?? []
      return <g key={lane.id}>
        <text x={3} y={y + 8} className="dp-axis">{lane.name}</text>
        <path d={`M${g.x0} ${y + 5.5}H${g.x1}`} className="dp-faint" />
        {r.events === undefined && i === 0 && <text x={g.x0 + 4} y={y + 8} className="dp-axis">No reading of the events</text>}
        {mine.map(e => {
          const cx = xAt(e.ago), cy = y + 5.5, pressed = openId === e.id
          return <g key={e.id} {...hit(openSt.disabled ? undefined : () => p.set('open', e.id), `${lane.name}${r.now !== undefined ? ` ${hhmm(r.now - e.ago)}` : ''}|${e.text}. ${openSt.disabled ? openSt.disabled : 'Press it and it opens in its widget.'}`)}>
            <circle cx={cx} cy={cy} r={6} fill="transparent" />
            <path d={`M${cx} ${cy - 3.6}l3.6 3.6l-3.6 3.6l-3.6 -3.6z`} fill={pressed ? 'var(--accent)' : 'var(--dp-value)'} opacity={pressed ? 1 : 0.85} />
          </g>
        })}
      </g>
    })}

    {mini && win !== undefined && r.events?.map(e => <path key={e.id} d={`M${xAt(e.ago)} ${laneY + laneH + 6}l3 3l-3 3l-3 -3z`} fill="var(--dp-value)" opacity={0.85} />)}

    {/* the present moment and the needle */}
    {win !== undefined && <path d={`M${g.x1} ${laneY - 3}V${bottom}`} className="dp-faint" strokeDasharray="2 2" />}
    {needleX !== undefined && <g className="rn-edge" data-state={stalled ? 'stalled' : 'live'} data-i={stalled ? `Needle|It froze at the last check-in${needleClock(r) ? `, ${needleClock(r)}` : ''}. ${age(r.needle!)} have gone by.` : `Needle|The last check-in${needleClock(r) ? `, ${needleClock(r)}` : ''}. It does not predict the end.`}>
      <path d={`M${needleX} ${laneY - 2}V${bottom}`} stroke={stalled ? 'var(--stall)' : 'var(--dp-value)'} strokeWidth={stalled ? 2 : 1.5} fill="none" />
      <path d={`M${needleX - 3.5} ${laneY - 6}h7l-3.5 5z`} fill={stalled ? 'var(--stall)' : 'var(--dp-value)'} />
    </g>}

    {/* the takes */}
    {shown.map((t, i) => {
      const y = takesTop + i * 10, isSel = t.id === r.take?.id
      const a = t.ago, b = t.ago !== undefined && t.seen !== undefined ? t.ago - t.seen : undefined
      const x1 = a !== undefined ? xAt(a) : undefined
      const x2 = t.state === 'running' ? g.x1 : b !== undefined ? xAt(b) : undefined
      return <g key={t.id} data-i={`Take #${t.n}${t.agent ? ` · ${t.agent}` : ''}|${WORD[t.state]}${t.at ? `, began ${t.at}` : ''}.`}>
        {isSel && <rect x={0} y={y} width={g.w} height={10} fill="var(--text)" opacity={0.07} />}
        <text x={3} y={y + 8} className="dp-axis">{`#${t.n}`}</text>
        {x1 !== undefined && x2 !== undefined
          ? <rect x={x1} y={y + 2.5} width={Math.max(3, x2 - x1)} height={5} fill={t.state === 'failed' ? 'none' : FILL[t.state]} stroke={t.state === 'failed' ? FILL.failed : 'none'} opacity={t.state === 'done' ? 0.7 : 0.9} />
          : <text x={g.x0} y={y + 8} className="dp-axis">no time read</text>}
      </g>
    })}
    {!mini && r.takes === undefined && <text x={3} y={takesTop + 8} className="dp-axis">No reading of the takes</text>}
    {!mini && r.takes !== undefined && ordered.length > room && <text x={g.w - 3} y={takesTop + room * 10 + 8} textAnchor="end" className="dp-axis">{`+${ordered.length - room} takes`}</text>}

    {/* the axis */}
    {win !== undefined && <text x={g.x0} y={g.h - 4} className="dp-axis">{`−${win} min`}</text>}
    {win !== undefined && <text x={g.x1} y={g.h - 4} textAnchor="end" className="dp-axis">now</text>}

    {handle && sel >= start && <Handle n={1} shape="ring" x={27} y={takesTop + (sel - start) * 10 + 5} label="Take" does="Drag up or down to read another take."
      onDrag={(_, y) => { const t = takeAt(y); if (t && t.id !== r.take?.id) p.set('take', t.id) }} onReset={() => { const latest = r.takes?.[r.takes.length - 1]; if (latest) p.set('take', latest.id) }} />}
  </>
}

const corner = (r: Reading): string => {
  if (r.stalled === undefined) return NONE
  if (r.stalled) return `stalled ${age(r.needle!)}`
  return needleClock(r) ?? 'live'
}

function RunWell({p, r, g, uid, mode}: {p: ViewProps; r: Reading; g: Lay; uid: string; mode: 'compact' | 'whole'}) {
  return <Display w={g.w} h={g.h} label="The run" corner={corner(r)}
    does="One session's tasks along the clock, a needle at the last check-in, events and takes under the lane. Drag handle 1 to read another take.">
    <Picture p={p} r={r} g={g} uid={uid} mode={mode} live />
  </Display>
}

// ---------------------------------------------------------------- the pane: the thread

const TASK_STATE: Readonly<Record<string, string>> = {done: 'done', running: 'running', queued: 'queued', stalled: 'stalled', failed: 'failed'}
const ANSWER: Readonly<Record<string, string>> = {approve: 'approved', changes: 'changes asked', diff: 'diff opened', retry: 'retried', stop: 'stopped', steer: 'steered', parent: 'sent to the parent'}

interface Row { readonly kind: string; readonly who?: string; readonly text: string; readonly tool?: string; readonly out?: string; readonly state?: string; readonly link?: string }
function rowsOf(v: V): Row[] | undefined {
  const raw = json<unknown>(v, 'thread', undefined)
  return Array.isArray(raw) ? objects(raw).map(o => ({kind: word(o.kind) ?? 'text', who: word(o.who), text: typeof o.text === 'string' ? o.text : '', tool: word(o.tool), out: word(o.out), state: word(o.state), link: word(o.link)})) : undefined
}

function RunThread({p}: {p: ViewProps}) {
  const v = p.v, r = read(v), rows = rowsOf(v), tc = strOf(v, 'color') ?? 'var(--dp-value)'
  const session = sessionNow(v), tasks = r.blocks, doing = doingOf(r)
  const nw = needleWord(r)
  return <div className="rn-pane" style={{'--tc': tc} as CSSProperties}>
    <header className="rn-head">
      <b>{session ? session.name ?? session.id : NONE}</b>
      <span data-state={nw}>{nw ?? NONE}</span>
      <span>{doing ? doing.name : NONE}</span>
      <span>{tasks ? `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}` : NONE}</span>
      {r.take && <span>take #{r.take.n}</span>}
    </header>
    <ol className="rn-thread" aria-label="Thread">
      {rows === undefined && <li data-kind="text"><span>No reading of the thread.</span></li>}
      {rows?.length === 0 && <li data-kind="text"><span>The thread holds nothing yet.</span></li>}
      {rows?.map((row, i) => {
        switch (row.kind) {
          case 'task': return <li key={i} data-kind="task" data-state={row.state ?? 'unknown'}><i /><b>{row.text}</b><small>{row.state ? TASK_STATE[row.state] ?? row.state : NONE}</small></li>
          case 'tool': return <li key={i} data-kind="tool" data-state={row.state}><b>{row.tool ?? 'tool'}</b><span>{row.text}</span><small>{row.state === 'runs' ? 'running' : row.state === 'waits' ? 'waits' : ''}</small>{row.out && <em>{cut(row.out.replace(/\s+/g, ' '), 120)}</em>}</li>
          case 'spawn': return <li key={i} data-kind="spawn"><b>spawn</b><span>{row.text}</span><small>{row.link ?? ''}</small></li>
          case 'steer': return <li key={i} data-kind="steer"><b>steer</b><span>{row.text}</span><small>{row.state ?? ''}</small></li>
          case 'queued': return <li key={i} data-kind="queued"><b>queued</b><span>{row.text}</span><small /></li>
          case 'proposal': return <li key={i} data-kind="proposal"><b>proposal</b><span>{row.text}</span><small>{row.state ? ANSWER[row.state] ?? row.state : 'waits for you'}</small>{row.tool && <em>{row.tool}</em>}</li>
          case 'stall': return <li key={i} data-kind="stall"><b>stalled</b><span>{row.text}</span><small>{row.state ? ANSWER[row.state] ?? row.state : r.needle !== undefined ? `no output ${age(r.needle)}` : ''}</small></li>
          default: return <li key={i} data-kind={row.kind === 'you' ? 'you' : 'agent'}><b>{row.who ?? (row.kind === 'you' ? 'you' : 'agent')}</b><span>{row.text}</span><small /></li>
        }
      })}
    </ol>
    <footer className="rn-needle" data-state={r.stalled === undefined ? undefined : r.stalled ? 'stalled' : 'live'} aria-live="polite">
      <i />
      {r.needle === undefined
        ? <b>No reading of the needle</b>
        : <><b>{needleClock(r) ?? `${age(r.needle)} ago`}</b><span>{r.stalled ? `stalled ${age(r.needle)}` : 'last check-in'}</span></>}
      {r.stalled && <span>The needle froze where the output stopped.</span>}
    </footer>
  </div>
}

// ---------------------------------------------------------------- the widget

function Strip({p, r}: {p: ViewProps; r: Reading}) {
  return <svg viewBox={`0 0 ${MINI.w} ${MINI.h}`} role="group" aria-label="The run" data-i="The run|One session's tasks along the clock, with the needle at the last check-in.">
    <Picture p={p} r={r} g={MINI} uid="rt" mode="mini" live={false} />
  </svg>
}

// ---------------------------------------------------------------- the device

// The sample material of the gallery (the lead session of the mockup's Factory, agent-shell-mockup.html:471-478). The views never
// read these constants: the owner's material arrives on the keys named at the head.
const SESSIONS = JSON.stringify([
  {id: 'lead', name: 'Fizz · lead', short: 'Lead'}, {id: 'explore', name: 'explore', short: 'Explore'}, {id: 'test', name: 'test', short: 'Test'},
  {id: 'fixture', name: 'fixture-gen', short: 'Fixture'}, {id: 'honey', name: 'Capture pass', short: 'Capture'}, {id: 'bumble', name: 'Review #482', short: 'Review'},
])
const LEAD_TASKS = [
  {n: 1, name: 're-plan port', state: 'done', from: 34, last: 24},
  {n: 2, name: 'map field → plan', state: 'running', from: 22, last: 0.3},
  {n: 3, name: 'drop old captures', state: 'queued'},
]
const ATTEMPTS = JSON.stringify([
  {id: '1', n: 1, state: 'failed', agent: 'Fizz', session: 'lead', day: '16 Oct', at: '13:36', ago: 58, seen: 9, tasks: [
    {id: '1.1', title: 'Read the port plan', state: 'done', t0: 0, seen: 4}, {id: '1.2', title: 'map field → plan', state: 'failed', t0: 4, seen: 9}]},
  {id: '2', n: 2, state: 'done', agent: 'Fizz', session: 'lead', day: '16 Oct', at: '13:47', ago: 47, seen: 12, tasks: [
    {id: '2.1', title: 'Read the port plan', state: 'done', t0: 0, seen: 3}, {id: '2.2', title: 'map field → plan', state: 'done', t0: 3, seen: 12}]},
  {id: '3', n: 3, state: 'running', agent: 'Fizz', session: 'lead', day: '16 Oct', at: '14:00', ago: 34, seen: 34, current: true, tasks: [
    {id: '3.1', title: 're-plan port', state: 'done', t0: 0, seen: 10}, {id: '3.2', title: 'map field → plan', state: 'running', t0: 12, seen: 33.7}]},
])
const LEAD_EVENTS = [
  {id: 'm1', lane: 'messages', ago: 21.5, text: 'plan · 3 beats'}, {id: 'm2', lane: 'messages', ago: 13, text: 'steer heard'}, {id: 'm3', lane: 'messages', ago: 7, text: 'proposal #212'},
  {id: 'f1', lane: 'files', ago: 31, text: 'read field.json'}, {id: 'f2', lane: 'files', ago: 14, text: 'edit portPlan.ts'}, {id: 'f3', lane: 'files', ago: 8, text: 'edit portPlan.ts'},
  {id: 't1', lane: 'terminal', ago: 5, text: 'pnpm test bridge2 ✓'}, {id: 'w1', lane: 'web', ago: 17, text: 'widgets API docs'}, {id: 'g1', lane: 'graph', ago: 29, text: 'bridge-2 neighbours'},
]
const LEAD_THREAD = [
  {kind: 'task', text: 're-plan port', state: 'done'},
  {kind: 'you', who: 'you', text: 'Re-plan the port around the new capture.'},
  {kind: 'agent', who: 'Fizz', text: 'Re-planned; receipt #212.'},
  {kind: 'task', text: 'map field → plan', state: 'running'},
  {kind: 'you', who: 'you', text: 'Map the Bridge 2 field into the port plan. Keep Honey’s tuned physics — same look.'},
  {kind: 'tool', who: 'Fizz', tool: 'Read', text: 'scenes/bridge2/field.json · 3.1k'},
  {kind: 'tool', who: 'Fizz', tool: 'Graph', text: 'bridge-2 neighbours · 14 nodes'},
  {kind: 'spawn', who: 'Fizz', text: 'explore · haiku · survey the widget tree', link: 'explore'},
  {kind: 'tool', who: 'Fizz', tool: 'Fetch', text: 'widgets API docs · docs.o-i/widgets'},
  {kind: 'agent', who: 'Fizz', text: 'Three beats: compose, settle, hand off.'},
  {kind: 'steer', who: 'you', text: 'Also drop the old capture list from your reads.', state: 'heard at next tool'},
  {kind: 'tool', who: 'Fizz', tool: 'Edit', text: 'portPlan.ts +42 −7'},
  {kind: 'tool', who: 'Fizz', tool: 'Bash', text: 'pnpm test bridge2 · 12 passed'},
  {kind: 'spawn', who: 'Fizz', text: 'test · haiku · full widget tests', link: 'test'},
  {kind: 'queued', who: 'Fizz', text: 'drop old captures'},
]
const FIXTURE_THREAD = [
  {kind: 'task', text: 'generate fixtures', state: 'stalled'},
  {kind: 'tool', who: 'fixgen', tool: 'Bash', text: 'gen-fixtures --widgets handoff · no output', state: 'waits', out: 'Generating handoff fixtures… ? Overwrite existing fixtures/handoff.json (y/N)'},
  {kind: 'stall', who: 'fixgen', text: 'Waits for an answer: overwrite fixtures/handoff.json (y/N)'},
]

export const design: DesignedDevice = {
  id: 'software-factory:run-device',
  title: 'Run',
  kind: 'instrument',
  defaults: {
    light: 'lit', session: 'lead', color: '#5cc6b4', sessions: SESSIONS, window: 60, now: 874.5, needle: 20,
    watch: 'in', telemetry: true, solo: false, lanes: 'all', overview: true, take: '3',
    tasks: JSON.stringify(LEAD_TASKS), attempts: ATTEMPTS, events: JSON.stringify(LEAD_EVENTS), thread: JSON.stringify(LEAD_THREAD),
  },
  fixtures: {
    'The lead session': {},
    'A stalled run': {
      session: 'fixture', color: '#a8c9c2', needle: 130, watch: 'auto', lanes: 'terminal', take: '1',
      tasks: JSON.stringify([{n: 1, name: 'generate fixtures', state: 'stalled', idle: 130, from: 5, last: 2.2}]),
      attempts: JSON.stringify([{id: '1', n: 1, state: 'stalled', agent: 'fixgen', session: 'fixture', day: '16 Oct', at: '14:29', ago: 5, seen: 2.8, current: true,
        tasks: [{id: '1.1', title: 'generate fixtures', state: 'stalled', t0: 0, seen: 2.8}]}]),
      events: JSON.stringify([{id: 't1', lane: 'terminal', ago: 2.4, text: 'gen-fixtures · waiting'}]),
      thread: JSON.stringify(FIXTURE_THREAD),
    },
    'No readings': Object.fromEntries(['light', 'session', 'color', 'sessions', 'window', 'now', 'needle', 'watch', 'telemetry', 'solo', 'lanes', 'overview', 'take', 'tasks', 'attempts', 'events', 'thread', 'open'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Run" light={light(p)} readings={[sessionLabel(sessionNow(p.v)) ?? NONE, needleClock(read(p.v)) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => {
    const r = read(p.v)
    return <Panel title="Run" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <RunWell p={p} r={r} g={COMPACT} uid="rc" mode="compact" />
      </Section>
      <Section label="Macros" cols={2} width={132}>
        {watchRadio(p)}
        {telemetryToggle(p)}
        {soloToggle(p)}
        {lanesChooser(p)}
      </Section>
    </Panel>
  },

  whole: p => {
    const r = read(p.v), takes = r.takes ? [...r.takes].reverse() : []
    const rows: RowItem[] = takes.map(t => ({id: t.id, name: `#${t.n}${t.agent ? ` · ${t.agent}` : ''}`, light: LIGHT[t.state], tone: TONE[t.state], note: t.current ? 'current' : t.at, does: `${WORD[t.state]}${t.at ? `, began ${t.at}` : ''}`}))
    const nw = needleWord(r)
    return <Panel title="Run" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <RunWell p={p} r={r} g={WHOLE} uid="rw" mode="whole" />
        </Section>
        <Section label="Feed" cols={2}>
          {sessionChooser(p)}
          {watchRadio(p)}
          {telemetryToggle(p)}
          {soloToggle(p)}
        </Section>
        <Section label="Lanes" cols={1}>
          {lanesChooser(p)}
          {overviewToggle(p)}
        </Section>
      </Band>
      <Band>
        <Section label="Takes" width={190}>
          {r.takes === undefined
            ? <p className="rn-none">No reading of the takes.</p>
            : <Rows does="Choose the take you read. A light shows how it stands." items={rows} size={6} selected={r.take?.id}
              onSelect={st(p, 'take').disabled ? undefined : id => p.set('take', id)} />}
        </Section>
        <Section label="Needle" cols={3} grow>
          <Readout label="at" does="The time of the last check-in." value={needleClock(r)} />
          <Readout label="age" does="How long ago the session last checked in." value={r.needle === undefined ? undefined : age(r.needle)} tone={r.stalled ? 'stall' : undefined} />
          <Readout label="state" does="Live, or stalled once the last check-in is older than 90 seconds." value={nw} tone={nw === 'stalled' ? 'stall' : nw === 'live' ? 'value' : undefined} />
          <Readout label="running" does="Tasks that run now. A running task has no end." value={countOf(r, 'running')} tone="value" />
          <Readout label="queued" does="Tasks that wait for their launch." value={countOf(r, 'queued')} />
          <Readout label="stalled" does="Tasks frozen where their output stopped." value={countOf(r, 'stalled')} tone="stall" />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <RunThread p={p} />,

  widget: p => {
    const r = read(p.v), doing = doingOf(r), nw = needleWord(r)
    return <Tile title={`Run · ${sessionLabel(sessionNow(p.v)) ?? NONE}`} light={light(p)} span={2} onFull={p.nav.full}>
      <div className="rn-tile-strip"><Strip p={p} r={r} /></div>
      <div className="rn-tile-side">
        <Readout label="state" does="Live, or stalled once the last check-in is older than 90 seconds." value={nw} tone={nw === 'stalled' ? 'stall' : nw === 'live' ? 'value' : undefined} />
        <Readout label="needle" does="The time of the last check-in." value={needleClock(r)} />
        <Readout label="now" does="The task the session is on." value={doing ? cut(doing.name, 9) : r.blocks ? NONE : undefined} />
      </div>
    </Tile>
  },
}
