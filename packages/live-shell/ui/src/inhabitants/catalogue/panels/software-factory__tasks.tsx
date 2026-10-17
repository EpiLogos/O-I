// Tasks (manual §19.1, software-factory:tasks): the clips on one Factory session's track — what the agent is asked to do, and how each
// task stands. Live's nearest: a column of clip slots in Session view, with the Launch and Follow boxes of Clip view. The picture is that
// column: a clip draws its state by the shell's own law (agent/agentRunModel.ts: a running task draws no end, a queued task no length, a
// stalled task is frozen where its output stopped), and the empty square after the last task stops the session after the current task.
// Handle 1 sets Then: down to the next task, right to a hand-off, back on the task to stop. The Full view is the task log: each tool the
// agent used, laid along the task's time, with the steers marked.
//
// The owner's material arrives on these keys, all JSON, and a key it does not report arrives absent (the views draw "—"):
// - `tasks`: the session's tasks, rows of {n, name, state, idle?}. state is queued | running | stalled | ready | done; absent means the
//   owner does not disclose it. idle is the seconds since the last output (a stalled task's age).
// - `log`: the selected task's events, rows of {at, kind, tool?, text, dur?, state?, heard?}. at and dur are seconds from the task's
//   start. kind is tool | spawn | steer | say | stall; a tool row says in state whether it runs or waits. `elapsed` is the seconds from
//   the start to the last output (the live edge of a running task).
// - `sessions`: the sessions of the work, rows of {id, name, short?, used?, cap?} (the Thread's own key and shape): the hand-off
//   chooser's options, and the turns used of the turns allowed.
import {useState, type CSSProperties, type KeyboardEvent} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, type LightState, type Option, type RowItem, type Standing, type Tone} from '../../sdk/panel'
import {NONE, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './software-factory__tasks.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- the owner's rows, read safely

const STATES = ['queued', 'running', 'stalled', 'ready', 'done'] as const
type State = (typeof STATES)[number]
const STATE_WORD: Record<State, string> = {queued: 'Queued', running: 'Running', stalled: 'Stalled', ready: 'Ready', done: 'Done'}

const finite = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const word = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
/** Seconds as the shell writes a stall's age: 45s, 2m 10s. */
const age = (s: number) => (s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60) ? ` ${Math.round(s % 60)}s` : ''}`)
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

interface Task {readonly n: number; readonly name: string; readonly state?: State; readonly idle?: number}
function tasksOf(v: V): Task[] {
  const raw = json<unknown>(v, 'tasks', [])
  const list: Task[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>, n = finite(o.n)
    if (n === undefined) continue
    list.push({n, name: word(o.name) ?? `Task ${n}`, state: STATES.find(s => s === o.state), idle: finite(o.idle)})
  }
  return list.sort((a, b) => a.n - b.n)
}

const KINDS = ['tool', 'spawn', 'steer', 'say', 'stall'] as const
type Kind = (typeof KINDS)[number]
interface Entry {readonly at: number; readonly kind: Kind; readonly tool?: string; readonly text: string; readonly dur?: number; readonly state?: 'runs' | 'waits'; readonly heard?: string}
function entriesOf(v: V): Entry[] {
  const raw = json<unknown>(v, 'log', [])
  const list: Entry[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>, at = finite(o.at)
    if (at === undefined) continue
    list.push({at, kind: KINDS.find(k => k === o.kind) ?? 'say', tool: word(o.tool), text: typeof o.text === 'string' ? o.text : '', dur: finite(o.dur),
      state: o.state === 'runs' || o.state === 'waits' ? o.state : undefined, heard: word(o.heard)})
  }
  return list.sort((a, b) => a.at - b.at)
}

interface Session {readonly id: string; readonly name?: string; readonly short?: string; readonly used?: number; readonly cap?: number}
function sessionsOf(v: V): Session[] {
  const raw = json<unknown>(v, 'sessions', [])
  const list: Session[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>, id = word(o.id)
    if (id) list.push({id, name: word(o.name), short: word(o.short), used: finite(o.used), cap: finite(o.cap)})
  }
  return list
}
const sessionLabel = (s: Session) => s.short ?? s.name ?? s.id
const sessionNow = (v: V) => sessionsOf(v).find(s => s.id === strOf(v, 'session'))

const selOf = (v: V) => numOf(v, 'task')
const taskOf = (v: V) => tasksOf(v).find(t => t.n === selOf(v))
const stateOf = (v: V) => taskOf(v)?.state
const countOf = (v: V, s: State) => (has(v, 'tasks') ? tasksOf(v).filter(t => t.state === s).length : undefined)
const colourOf = (v: V) => strOf(v, 'color') ?? 'var(--dp-value)'
const turns = (v: V) => { const s = sessionNow(v); return s?.used !== undefined && s.cap !== undefined ? `${s.used}/${s.cap}` : undefined }
// The light reads the owner alone; hollow while it has not said.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState

// ---------------------------------------------------------------- the values of each parameter, in the owner's words

const MODES: readonly Option<string>[] = [
  {value: 'once', label: 'Once', does: 'The task runs one time.'},
  {value: 'hold', label: 'Hold', does: 'The task runs while you hold the launch.'},
  {value: 'loop', label: 'Loop', does: 'The task runs again after each finish, until you stop it or the turn cap is reached.'},
]
const THENS: readonly Option<string>[] = [
  {value: 'next', label: 'Next', does: 'The next queued task starts when this one is done.'},
  {value: 'handoff', label: 'Hand off', does: 'Another session continues when this task is done. Choose it in To.'},
  {value: 'stop', label: 'Stop', does: 'The session stops when this task is done.'},
]
/** Launch quantize as Factory arms it (agent/AgentShellContext.tsx:29): now · next tool · next turn. */
const QUANTS: readonly Option<string>[] = [
  {value: 'now', label: 'Now', does: 'A launch or a steer lands at once.'},
  {value: 'next tool', label: 'Tool', does: 'A launch or a steer lands after the current tool call.'},
  {value: 'next turn', label: 'Turn', does: 'A launch or a steer lands after the current turn.'},
]
const EFFORTS: readonly Option<string>[] = [{value: 'inherit', label: 'Inherit'}, {value: 'low', label: 'Low'}, {value: 'medium', label: 'Medium'}, {value: 'high', label: 'High'}, {value: 'max', label: 'Max'}]
const AUTONOMIES: readonly Option<string>[] = [{value: 'inherit', label: 'Inherit'}, {value: 'suggest', label: 'Suggest'}, {value: 'review', label: 'Review'}, {value: 'auto', label: 'Auto'}]
const REGISTERS: readonly Option<string>[] = [
  {value: 'plain', label: 'Plain', does: 'The agent writes in plain words.'},
  {value: 'warm', label: 'Warm', does: 'The agent writes with warmth.'},
  {value: 'terse', label: 'Terse', does: 'The agent writes as little as it can.'},
]
const FORMS: readonly Option<string>[] = [
  {value: 'technical', label: 'Technical', does: 'The agent writes as a technical note.'},
  {value: 'narrative', label: 'Narrative', does: 'The agent writes as a story of what it did.'},
  {value: 'list', label: 'List', does: 'The agent writes as a list.'},
]
const stepOf = (options: readonly Option<string>[], value: string | undefined) => { const i = options.findIndex(o => o.value === value); return i < 0 ? undefined : i }
const labelAt = (options: readonly Option<string>[]) => (x: number) => options[Math.round(x)]?.label ?? NONE

/** A control's standing, with the reason this device gives for it being off (the state of the task) ahead of the host's. */
const gate = (p: ViewProps, key: string, why?: string): Standing => { const s = st(p, key); return why && !s.disabled ? {...s, disabled: why} : s }

// ---------------------------------------------------------------- the controls shared by the views

const modeRadio = (p: ViewProps) => <Radio {...st(p, 'mode')} label="Mode" does="How the selected task runs: once, while you hold the launch, or again until you stop it."
  value={strOf(p.v, 'mode') ?? ''} options={MODES} stack onChange={x => p.set('mode', x)} />
const thenRadio = (p: ViewProps) => <Radio {...st(p, 'then')} label="Then" does="What follows the selected task: the next task, a hand-off to another session, or a stop."
  value={strOf(p.v, 'then') ?? ''} options={THENS} stack onChange={x => p.set('then', x)} />
const quantRadio = (p: ViewProps) => <Radio {...st(p, 'quantize')} label="Quantize" does="When a launch or a steer lands: at once, after the tool call, or after the turn."
  value={strOf(p.v, 'quantize') ?? ''} options={QUANTS} stack onChange={x => p.set('quantize', x)} />
const quantDial = (p: ViewProps) => <Dial {...st(p, 'quantize')} label="Quantize" does="When a launch or a steer lands: at once, after the tool call, or after the turn."
  value={stepOf(QUANTS, strOf(p.v, 'quantize')) ?? NaN} def={1} scale={{min: 0, max: QUANTS.length - 1, step: 1}} format={labelAt(QUANTS)} onChange={x => p.set('quantize', QUANTS[Math.round(x)]!.value)} />
const effortDial = (p: ViewProps) => <Dial {...st(p, 'effort')} label="Effort" does="The effort for this task only. Inherit takes the session's effort."
  value={stepOf(EFFORTS, strOf(p.v, 'effort')) ?? NaN} def={0} scale={{min: 0, max: EFFORTS.length - 1, step: 1}} format={labelAt(EFFORTS)} onChange={x => p.set('effort', EFFORTS[Math.round(x)]!.value)} />
const autonomyDial = (p: ViewProps) => <Dial {...st(p, 'autonomy')} label="Autonomy" does="The autonomy for this task only. Inherit takes the session's autonomy."
  value={stepOf(AUTONOMIES, strOf(p.v, 'autonomy')) ?? NaN} def={0} scale={{min: 0, max: AUTONOMIES.length - 1, step: 1}} format={labelAt(AUTONOMIES)} onChange={x => p.set('autonomy', AUTONOMIES[Math.round(x)]!.value)} />

/** The chooser of the hand-off: the other sessions of the work. It stands off until Then names a hand-off. */
const toChooser = (p: ViewProps) => {
  const self = strOf(p.v, 'session'), options = sessionsOf(p.v).filter(s => s.id !== self).map(s => ({value: s.id, label: sessionLabel(s)}))
  const why = strOf(p.v, 'then') === 'handoff' ? undefined : 'Set Then to Hand off first.'
  return <Chooser {...gate(p, 'to', why)} label="To" does="The session that continues when this task is done." value={strOf(p.v, 'to') ?? ''} options={options} wide onChange={x => p.set('to', x)} />
}

// ---------------------------------------------------------------- the picture

interface Geo {readonly w: number; readonly h: number}
const COMPACT: Geo = {w: 140, h: 146}
const WHOLE: Geo = {w: 194, h: 146}
const PITCH = 20, CELL = 16, TOP = 20, GUT = 18, RIGHT = 18

/** A press target in the well: a task to select, the empty square to press. Enter and Space press it. */
const hit = (act: (() => void) | undefined, said: string, dbl?: () => void) => ({
  className: act ? 'sft-hit' : undefined, role: act ? 'button' : undefined, tabIndex: act ? 0 : -1, 'data-i': said, onClick: act, onDoubleClick: dbl,
  onKeyDown: act ? (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act() } } : undefined,
})

/** One clip in its state, by the law of the shell: done is dim and settled; running fades out to the right and has no end; queued is
 * dashed and has no length; ready is in full colour; stalled is striped, with an orange edge where its output stopped. */
function ClipShape({state, x, y, w, h, colour, uid}: {state?: State; x: number; y: number; w: number; h: number; colour: string; uid: string}) {
  switch (state) {
    case 'done': return <rect x={x} y={y} width={w} height={h} fill={colour} opacity={0.4} />
    case 'running': return <><rect x={x} y={y} width={w} height={h} fill={colour} opacity={0.16} /><rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-run)`} /></>
    case 'queued': return <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} style={{fill: `color-mix(in srgb, ${colour} 22%, var(--dp-well))`}} stroke={colour} strokeDasharray="3 2" />
    case 'ready': return <rect x={x} y={y} width={w} height={h} fill={colour} />
    case 'stalled': return <><rect x={x} y={y} width={w} height={h} fill={colour} opacity={0.32} /><rect x={x} y={y} width={w} height={h} fill={`url(#${uid}-stripe)`} />
      <rect x={x + w - 2} y={y} width={2} height={h} fill="var(--stall)" /></>
    default: return <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} className="dp-faint" strokeDasharray="1 3" />
  }
}
const triFill = (state?: State, colour?: string) => (state === 'running' || state === 'ready' ? 'var(--dp-well)' : state === 'queued' ? colour : state === 'stalled' ? 'var(--stall)' : 'var(--text-dim)')

/** The session's queue: its tasks down the well, then the empty square. Then is drawn from the selected task: an arrow down to the
 * next task, an arrow out to a hand-off, or a stop mark on the task. Handle 1 moves it. */
function Queue({p, geo, uid, handle}: {p: ViewProps; geo: Geo; uid: string; handle?: boolean}) {
  const {v, set} = p
  if (!has(v, 'tasks')) return <text x={geo.w / 2} y={geo.h / 2} textAnchor="middle" className="dp-ink-dim">No reading of the tasks</text>
  const tasks = tasksOf(v), colour = colourOf(v), sel = selOf(v), mode = strOf(v, 'mode'), then = strOf(v, 'then')
  const slots = Math.floor((geo.h - TOP - 4) / PITCH), room = slots - 1
  const selAt = tasks.findIndex(t => t.n === sel)
  const start = tasks.length <= room ? 0 : clampTo(0, tasks.length - room, (selAt >= 0 ? selAt : tasks.length - 1) - Math.floor(room / 2))
  const shown = tasks.slice(start, start + room), lastShown = start + shown.length >= tasks.length
  const x0 = GUT, cw = geo.w - GUT - RIGHT, gx = 8
  const rowY = (i: number) => TOP + i * PITCH, cy = (i: number) => rowY(i) + CELL / 2
  const row = selAt >= 0 ? selAt - start : -1
  const stopSt = st(p, 'stopAfter'), stopAct = stopSt.disabled ? undefined : () => set('stopAfter', true)
  const thenSt = st(p, 'then'), thenOf = then === 'handoff' || then === 'stop' ? then : 'next'
  const target = sessionsOf(v).find(s => s.id === strOf(v, 'to'))
  // The three places Then can stand: on the task (stop), on the slot below it (next), and out at the right edge (hand off).
  const spots = row >= 0 ? {stop: {x: gx, y: cy(row)}, next: {x: gx, y: cy(Math.min(row + 1, slots - 1))}, handoff: {x: geo.w - 9, y: cy(row)}} : undefined
  const nearest = (x: number, y: number) => {
    const at = spots!, d = (k: keyof typeof at) => Math.hypot(at[k].x - x, at[k].y - y)
    return (['next', 'handoff', 'stop'] as const).reduce((best, k) => (d(k) < d(best) ? k : best), 'next' as 'next' | 'handoff' | 'stop')
  }
  const caption = row < 0 || then === undefined ? undefined : then === 'stop' ? 'then stop' : then === 'handoff' ? `then → ${target ? sessionLabel(target) : 'choose a session'}` : 'then next task'
  return <g>
    <defs>
      <pattern id={`${uid}-stripe`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="var(--stall)" opacity=".75" /></pattern>
      <linearGradient id={`${uid}-run`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" style={{stopColor: colour, stopOpacity: 0.95}} /><stop offset="0.55" style={{stopColor: colour, stopOpacity: 0.55}} /><stop offset="1" style={{stopColor: colour, stopOpacity: 0.04}} />
      </linearGradient>
    </defs>
    {caption && <text x={6} y={13} className="dp-ink-dim">{clip(caption, geo.w > 160 ? 30 : 15)}</text>}
    {start > 0 && <text x={x0 + cw} y={17} textAnchor="end" className="dp-axis">▲ {start}</text>}
    {shown.map((t, i) => {
      const y = rowY(i), isSel = t.n === sel
      const note = [isSel && mode === 'loop' ? '↻' : isSel && mode === 'hold' ? '‖' : '', t.state === 'stalled' && t.idle !== undefined ? age(t.idle) : ''].filter(Boolean).join(' ')
      return <g key={t.n} {...hit(() => set('task', t.n), `${t.name}|${t.state ? STATE_WORD[t.state] : 'The owner does not disclose the state'}. Press to select the task.`)}>
        <ClipShape state={t.state} x={x0} y={y} w={cw} h={CELL} colour={colour} uid={uid} />
        <polygon className="sft-tri" data-state={t.state} points={`${x0 + 4},${y + 4} ${x0 + 4},${y + CELL - 4} ${x0 + 10},${y + CELL / 2}`} fill={triFill(t.state, colour)} />
        <text x={x0 + 14} y={y + CELL / 2 + 3.2} className={`sft-name ${t.state && t.state !== 'done' ? 'dp-ink' : 'dp-ink-dim'}`}>{clip(t.name, Math.floor((cw - 18 - note.length * 5) / 5))}</text>
        {note && <text x={x0 + cw - 4} y={y + CELL / 2 + 3.2} textAnchor="end" className="sft-name dp-ink">{note}</text>}
        {isSel && <rect x={x0 + 0.6} y={y + 0.6} width={cw - 1.2} height={CELL - 1.2} fill="none" stroke="var(--accent)" strokeWidth={1.3} />}
      </g>
    })}
    {lastShown && (() => {
      const i = shown.length
      return <g {...hit(stopAct, `Empty square|Stops the session after the current task. Double-click to write a task.${stopSt.disabled ? ` ${stopSt.disabled}` : ''}`, p.nav.full)}>
        <rect x={x0} y={rowY(i)} width={cw} height={CELL} fill="transparent" />
        <rect x={x0 + 4} y={cy(i) - 4} width={8} height={8} className="dp-faint" />
        <text x={x0 + 18} y={cy(i) + 3} className="dp-axis">{shown.length ? 'Stop after this task' : 'No task yet'}</text>
      </g>
    })()}
    {!lastShown && <text x={x0 + cw} y={rowY(room) + 12} textAnchor="end" className="dp-axis">▼ {tasks.length - start - shown.length}</text>}
    {spots && has(v, 'then') && <g>
      {thenOf === 'next' && <><path d={`M${x0} ${spots.stop.y}H${gx}V${spots.next.y}H${x0 - 1}`} className="dp-curve-on" /><polygon points={`${x0 - 6},${spots.next.y - 3} ${x0 - 6},${spots.next.y + 3} ${x0 - 1},${spots.next.y}`} fill="var(--dp-on)" /></>}
      {thenOf === 'handoff' && <><path d={`M${x0 + cw} ${spots.stop.y}H${geo.w - 9}`} className="dp-curve-on" /><polygon points={`${x0 + cw + 2},${spots.stop.y - 3} ${x0 + cw + 2},${spots.stop.y + 3} ${x0 + cw + 7},${spots.stop.y}`} fill="var(--dp-on)" /></>}
      {thenOf === 'stop' && <rect x={x0 - 4} y={spots.stop.y - 6} width={2} height={12} fill="var(--dp-on)" />}
    </g>}
    {handle && spots && has(v, 'then') && <Handle x={spots[thenOf].x} y={spots[thenOf].y} n={1} label="Then" shape="ring"
      does="Drag down for the next task, right for a hand-off, back onto the task for a stop."
      onDrag={thenSt.disabled ? undefined : (x, y) => set('then', nearest(x, y))} onReset={() => set('then', 'next')} />}
  </g>
}

// ---------------------------------------------------------------- the pane: the task log

/** The task, its tools along its time, and its steers; the clips of the session at the left, a line to write a task at the foot. */
function Compose({p}: {p: ViewProps}) {
  const [sent, setSent] = useState(0)
  return <footer className="sft-compose">
    <TextField key={sent} {...st(p, 'newTask')} label="Write a task" does="Write a task onto the end of the queue. Press Enter to send it." value="" placeholder="Write a task. Press Enter." wide
      onChange={x => { if (x.trim()) { p.set('newTask', x.trim()); setSent(sent + 1) } }} />
  </footer>
}

const laneOf = (e: Entry) => (e.kind === 'tool' ? e.tool ?? 'Tool' : e.kind === 'spawn' ? 'Spawn' : undefined)
const KIND_WORD: Record<Kind, string> = {tool: 'tool', spawn: 'spawn', steer: 'steer', say: 'agent', stall: 'stall'}

function TaskLog({p}: {p: ViewProps}) {
  const {v} = p
  const tasks = tasksOf(v), sel = selOf(v), task = tasks.find(t => t.n === sel), colour = colourOf(v), session = sessionNow(v)
  const log = entriesOf(v), elapsed = numOf(v, 'elapsed'), state = task?.state
  const lanes: string[] = []
  for (const e of log) { const lane = laneOf(e); if (lane && !lanes.includes(lane)) lanes.push(lane) }
  const last = log.reduce((m, e) => Math.max(m, e.at + (e.dur ?? 0)), 0)
  const span = Math.max(10, elapsed ?? 0, last) * 1.04
  const step = [5, 10, 15, 30, 60, 120, 300, 600].find(s => span / s <= 8) ?? 900
  const ticks = Array.from({length: Math.floor(span / step) + 1}, (_, i) => i * step)
  const at = (s: number) => `${(clampTo(0, span, s) / span) * 100}%`
  const tools = log.filter(e => e.kind === 'tool').length
  const edge = elapsed !== undefined && (state === 'running' || state === 'stalled')
  const nothing = state === 'queued' ? 'Queued. The log starts when the task launches.' : state === 'ready' ? 'Ready. The log starts when the task launches.'
    : !has(v, 'log') ? 'No reading of the log.' : 'The log holds no event yet.'
  return <div className="sft-pane">
    <header className="sft-head">
      <b>{session ? (session.name ?? session.id) : NONE}</b>
      <span>{task ? task.name : NONE}</span>
      <span data-state={state}>{state ? STATE_WORD[state] : NONE}</span>
      {elapsed !== undefined && <span>{clock(elapsed)}</span>}
      {has(v, 'log') && <span>{tools} {tools === 1 ? 'tool' : 'tools'}</span>}
    </header>
    <div className="sft-main">
      <nav className="sft-rail" aria-label="Tasks" style={{'--tc': colour} as CSSProperties}>
        <h4>Tasks</h4>
        {!has(v, 'tasks') && <p className="sft-none">No reading of the tasks.</p>}
        {tasks.map(t => <button key={t.n} type="button" className="sft-clip" data-state={t.state ?? 'unknown'} aria-pressed={t.n === sel} onClick={() => p.set('task', t.n)}
          data-i={`${t.name}|${t.state ? STATE_WORD[t.state] : 'The owner does not disclose the state'}. Press to read its log.`}>
          <i /><span>{t.name}</span><small>{t.state ? STATE_WORD[t.state] : NONE}</small>
        </button>)}
      </nav>
      <section className="sft-log">
        {log.length === 0 || !task ? <div className="sft-map"><p className="sft-empty">{task ? nothing : 'No task is selected.'}</p></div> : <div className="sft-map">
          <div className="sft-ruler">{ticks.map(t => <span key={t} style={{left: at(t)}}>{clock(t)}</span>)}</div>
          <div className="sft-lanes">
            {lanes.map(lane => <div key={lane} className="sft-lane">
              <span className="sft-lane-name">{lane}</span>
              <div className="sft-lane-track">
                {log.filter(e => laneOf(e) === lane).map((e, i) => {
                  const end = e.state === 'runs' ? (elapsed ?? span) : e.at + (e.dur ?? 1.2)
                  return <i key={i} className="sft-bar" data-state={e.state ?? 'done'} style={{left: at(e.at), width: `${(clampTo(0, span, end) - clampTo(0, span, e.at)) / span * 100}%`}}
                    data-i={`${lane} ${clock(e.at)}|${e.text}`} />
                })}
              </div>
            </div>)}
            <div className="sft-plot">
              {log.filter(e => e.kind === 'steer').map((e, i) => <span key={i} className="sft-steer" style={{left: at(e.at)}} data-i={`Steer ${clock(e.at)}|${e.text}${e.heard ? ` (${e.heard})` : ''}`}><b>steer</b></span>)}
              {edge && <span className="sft-edge" data-state={state} style={{left: at(elapsed!)}} data-i={state === 'stalled' ? 'Frozen|The output stopped here.' : 'Now|The task has no end. It runs to here.'}>
                {state === 'running' && <i />}<b>{state === 'stalled' ? `no output${task.idle !== undefined ? ` ${age(task.idle)}` : ''}` : 'now'}</b></span>}
            </div>
          </div>
        </div>}
        <ol className="sft-entries" aria-label="Log">
          {log.map((e, i) => <li key={i} data-kind={e.kind}>
            <time>{clock(e.at)}</time>
            <b>{e.kind === 'tool' ? e.tool ?? KIND_WORD.tool : KIND_WORD[e.kind]}</b>
            <span>{e.text}{e.kind === 'steer' && e.heard ? ` · ${e.heard}` : ''}</span>
          </li>)}
        </ol>
      </section>
    </div>
    <Compose p={p} />
  </div>
}

// ---------------------------------------------------------------- the widget's rows

const lampOf = (s?: State): {light: LightState; tone: Tone} => (s === 'running' ? {light: 'lit', tone: 'value'} : s === 'stalled' ? {light: 'lit', tone: 'stall'} : s === 'done' ? {light: 'lit', tone: 'green'}
  : s === 'ready' ? {light: 'lit', tone: 'accent'} : s === 'queued' ? {light: 'dark', tone: 'accent'} : {light: 'unknown', tone: 'accent'})
const taskRows = (v: V): RowItem[] => tasksOf(v).map(t => ({id: String(t.n), name: t.name, ...lampOf(t.state), note: t.state === 'stalled' && t.idle !== undefined ? age(t.idle) : undefined,
  why: t.state === 'stalled' ? 'Stalled. The output stopped.' : undefined, does: `${t.state ? STATE_WORD[t.state] : 'The owner does not disclose the state'}. Press to select the task.`}))

// ---------------------------------------------------------------- the readings of the mockup's Factory (agent-shell-mockup.html:462-480, 684-696)

const SAMPLE_SESSIONS = [
  {id: 'lead', name: 'Fizz · lead', short: 'Lead', used: 2, cap: 12}, {id: 'explore', name: 'explore', short: 'Explore', used: 3, cap: 4},
  {id: 'test', name: 'test', short: 'Test', used: 2, cap: 6}, {id: 'fixture', name: 'fixture-gen', short: 'Fixture', used: 1, cap: 3},
  {id: 'honey', name: 'Capture pass', short: 'Capture', used: 0, cap: 8}, {id: 'bumble', name: 'Review #482', short: 'Review', used: 5, cap: 20},
]
const LEAD_TASKS = [{n: 1, name: 're-plan port', state: 'done'}, {n: 2, name: 'map field → plan', state: 'running'}, {n: 3, name: 'drop old captures', state: 'queued'}]
const LEAD_LOG = [
  {at: 0, kind: 'tool', tool: 'Read', dur: 2, text: 'scenes/bridge2/field.json · 3.1k'},
  {at: 3, kind: 'tool', tool: 'Graph', dur: 4, text: 'bridge-2 neighbours · 14 nodes'},
  {at: 8, kind: 'spawn', dur: 1, text: 'explore · haiku · survey the widget tree'},
  {at: 29, kind: 'tool', tool: 'Fetch', dur: 8, text: 'widgets API docs · docs.o-i/widgets'},
  {at: 43, kind: 'say', text: 'Three beats: compose, settle, hand off.'},
  {at: 50, kind: 'steer', text: 'Also drop the old capture list from your reads.', heard: 'heard at next tool'},
  {at: 51, kind: 'tool', tool: 'Edit', dur: 6, text: 'portPlan.ts +42 −7'},
  {at: 61, kind: 'tool', tool: 'Bash', dur: 3, text: 'pnpm test bridge2 · 12 passed'},
  {at: 64, kind: 'spawn', state: 'runs', text: 'test · haiku · full widget tests'},
]
const FIXTURE_TASKS = [{n: 1, name: 'generate fixtures', state: 'stalled', idle: 130}]
const FIXTURE_LOG = [
  {at: 5, kind: 'tool', tool: 'Bash', dur: 4, state: 'waits', text: 'gen-fixtures --widgets handoff · no output'},
  {at: 9, kind: 'stall', text: 'Waits for an answer: overwrite fixtures/handoff.json (y/N)'},
]

export const design: DesignedDevice = {
  id: 'software-factory:tasks',
  title: 'Tasks',
  kind: 'instrument',
  defaults: {
    light: 'lit', session: 'lead', color: '#5cc6b4', sessions: JSON.stringify(SAMPLE_SESSIONS), tasks: JSON.stringify(LEAD_TASKS), task: 2, elapsed: 66, log: JSON.stringify(LEAD_LOG),
    mode: 'once', then: 'next', quantize: 'next tool', effort: 'inherit', autonomy: 'inherit', register: 'plain', form: 'technical',
  },
  fixtures: {
    'The lead session': {},
    'A stalled task': {session: 'fixture', color: '#a8c9c2', tasks: JSON.stringify(FIXTURE_TASKS), task: 1, elapsed: 9, log: JSON.stringify(FIXTURE_LOG)},
    'No readings': {light: undefined, session: undefined, color: undefined, sessions: undefined, tasks: undefined, task: undefined, elapsed: undefined, log: undefined, mode: undefined, then: undefined,
      quantize: undefined, effort: undefined, autonomy: undefined, register: undefined, form: undefined},
  },

  folded: p => <Folded title="Tasks" light={light(p)} readings={[taskOf(p.v) ? clip(taskOf(p.v)!.name, 16) : NONE, stateOf(p.v) ? STATE_WORD[stateOf(p.v)!] : NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Tasks" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Tasks" corner={stateOf(p.v) ? STATE_WORD[stateOf(p.v)!] : NONE}
        does="The tasks of the session, down the well. Press a task to select it. Drag handle 1 to set what follows it.">
        <Queue p={p} geo={COMPACT} uid="c" handle />
      </Display>
    </Section>
    <Section label="Macros" cols={2}>
      {modeRadio(p)}
      {thenRadio(p)}
      {quantDial(p)}
      {effortDial(p)}
    </Section>
  </Panel>,

  whole: p => {
    const state = stateOf(p.v)
    const launchWhy = !state ? 'No task is selected.' : state === 'running' ? 'The task is already running.' : state === 'done' ? 'The task has run.' : state === 'stalled' ? 'Use Retry for a stalled task.' : undefined
    const retryWhy = state === 'stalled' ? undefined : 'Only a stalled task retries.'
    return <Panel title="Tasks" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}>
      <Band>
        <Section width={206}>
          <Display w={194} h={146} label="Tasks" corner={state ? STATE_WORD[state] : NONE}
            does="The tasks of the session, down the well. Press a task to select it, the empty square to stop after the current task. Drag handle 1 to set what follows.">
            <Queue p={p} geo={WHOLE} uid="w" handle />
          </Display>
        </Section>
        <Section label="Launch" cols={3} grow>
          {modeRadio(p)}
          {quantRadio(p)}
          {thenRadio(p)}
          <div style={{gridColumn: 'span 3', width: '100%'}}>{toChooser(p)}</div>
          <Readout label="queued" does="Tasks that wait for their launch." value={countOf(p.v, 'queued')} tone="accent" />
          <Readout label="running" does="Tasks that run now. A running task has no end." value={countOf(p.v, 'running')} tone="value" />
          <Readout label="stalled" does="Tasks frozen where their output stopped." value={countOf(p.v, 'stalled')} tone="stall" />
        </Section>
      </Band>
      <Band>
        <Section label="Task" cols={2}>
          <div style={{gridColumn: 'span 2'}}><Readout big label="state" does="How the selected task stands, as the owner reports it." value={state ? STATE_WORD[state] : undefined}
            tone={state === 'stalled' ? 'stall' : state === 'running' ? 'value' : state === 'done' ? 'green' : 'accent'} /></div>
          <Action {...gate(p, 'launch', launchWhy)} label="Launch" does="Launch the selected task now. A queued task resumes." onPress={() => p.set('launch', true)} />
          <Action {...gate(p, 'retry', retryWhy)} label="Retry" does="Restart the stalled task from its last good step." onPress={() => p.set('retry', true)} />
          <div style={{gridColumn: 'span 2', width: '100%'}}><Action {...st(p, 'stopAfter')} label="Stop after" does="Stop the session after the current task." onPress={() => p.set('stopAfter', true)} /></div>
        </Section>
        <Section label="Style" width={76}>
          <Radio {...st(p, 'register')} label="Register" does="How the agent writes for this task." value={strOf(p.v, 'register') ?? ''} options={REGISTERS} stack onChange={x => p.set('register', x)} />
          <Radio {...st(p, 'form')} label="Form" does="The shape of what the agent writes for this task." value={strOf(p.v, 'form') ?? ''} options={FORMS} stack onChange={x => p.set('form', x)} />
        </Section>
        <Section label="Overrides" cols={2} grow>
          {effortDial(p)}
          {autonomyDial(p)}
          <Readout label="turns" does="The turns the session has used of the turns it may use. A loop ends at the cap." value={turns(p.v)} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <TaskLog p={p} />,

  widget: p => <Tile title="Tasks" light={light(p)} span={2} onFull={p.nav.full}>
    <div className="sft-tile-list">
      {has(p.v, 'tasks')
        ? <Rows items={taskRows(p.v)} onSelect={id => p.set('task', Number(id))} selected={selOf(p.v) === undefined ? undefined : String(selOf(p.v))} size={5} />
        : <p className="sft-none">No reading of the tasks.</p>}
    </div>
    <div className="sft-tile-side">
      <Readout big label="running" does="Tasks that run now." value={countOf(p.v, 'running')} tone="value" />
      <Readout big label="queued" does="Tasks that wait for their launch." value={countOf(p.v, 'queued')} tone="accent" />
      <Readout big label="stalled" does="Tasks frozen where their output stopped." value={countOf(p.v, 'stalled')} tone="stall" />
    </div>
  </Tile>,
}
