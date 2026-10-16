// The Experiment device (manual §19.5, actuation:experiment): a declared run on a Factory track. Live's nearest: a clip's take lane
// with a grid of takes — a device that plays a fixed number of runs and keeps what each one gave. The picture is the plan itself:
// one group of bars for each level of the variable, one bar for each repeat, each bar one run's reading. Runs not yet played are
// hollow, the run that plays is amber, a run that finished is a bar.
//
// Where the owner stands. Actuation's research crate runs a matched comparison: comparison.rs `run_with` takes `repetitions`
// (1 to 32), `conditions` (1 to 3 of seven named conditions) and one `task_id`, and keeps the 14 constants that must match
// (HELD_CONSTANTS, `compare_held_constant`). Each run's record reports `elapsed_ms`, `model_calls`, `capability_calls` and a
// `verification` with `objective_checks_pass` (execution.rs, tasks.rs). The shell reads tokens from a task record's `usage`
// (agent/useAgentMetrics.ts). The question, the agents, the beat and the other variables have no owner operation yet.
//
// Value keys. The shell holds:  plot (the reading the picture draws).
// The owner is asked to write:  question, task, variable, levels, agents, repeats, stop, capTurns, capTime, readTokens, readTime,
//   readCalls, readTests, readSpend, readStalls, beat, compare, fork.
//   options  JSON {variable: [{id, name}]}  the values each variable may take (or a list, for the current variable).
//   levels   JSON {variable: [id]}          the chosen values: 1 to 3 (or a list, for the current variable).
//   tasks    JSON [{id, name}]              the tasks a run can do (experiments/native-research/tasks.json: id and category).
//   agents   JSON [{id, name, on}]          the sessions that take part.
//   earlier  JSON [{id, name, runs, mismatches?}]  earlier Experiments; `mismatches` lists the held constants that differ.
// The owner reports:  light (lit · dark), state (draft · running · done), runs (JSON [{level, n, state, tokens?, time?, calls?,
//   tests?, spend?, stalls?}]; a reading it has no source for is left out of the run).
// A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Ladder, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, ValueBox, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {boolOf, clampTo, has, json, NONE, numOf, strOf, type DesignedDevice, type ViewProps} from './design'
import './actuation__experiment.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

/** comparison.rs run_with: repetitions 1 to 32; conditions 1 to 3. */
const REPEATS = {min: 1, max: 32, step: 1}, REPEATS_DEFAULT = 3, LEVELS_MAX = 3
/** relational.rs Limits: max_steps 1 to 10000, default 64. process.rs: timeout_ms 1 ms to 1 h. */
const TURNS = {min: 1, max: 10000, log: true}, TURNS_DEFAULT = 64
const TIME = {min: 1, max: 3600, log: true}
const BEAT = {min: 5, max: 300, log: true}, BEAT_DEFAULT = 15
/** comparison.rs HELD_CONSTANTS: what must match for two sets of runs to be compared. */
const HELD = ['prompt', 'success_constraints', 'start_state', 'model', 'capabilities', 'verification', 'budget', 'host_revision', 'host_composition',
  'network_policy', 'benchmark_revision', 'task_revision', 'runner_revision', 'review_contract_revision'] as const
const LOCKED = 'The run is declared. A change starts a new Experiment.'

const VARIABLES: readonly Option<string>[] = [
  {value: 'condition', label: 'Condition', does: 'How the agent loop recurs: classic, or a QL condition.'},
  {value: 'model', label: 'Model', does: 'The model that runs the agent.'},
  {value: 'effort', label: 'Effort', does: 'How hard the agent thinks in each turn.'},
  {value: 'skillset', label: 'Skillset', does: 'The set of skills the agent may use.'},
  {value: 'budget', label: 'Budget', does: 'The turns allowed for one task.'},
  {value: 'autonomy', label: 'Autonomy', does: 'What the agent may do alone.'},
]
const STOPS: readonly Option<string>[] = [
  {value: 'turns', label: 'Turn cap', does: 'A run ends after this many turns.'},
  {value: 'time', label: 'Time cap', does: 'A run ends after this much time.'},
  {value: 'done', label: 'Task done', does: 'A run ends when the agent reports the task done.'},
  {value: 'tests', label: 'Test pass', does: 'A run ends when the task\'s tests pass.'},
]

type ReadKey = 'tokens' | 'time' | 'calls' | 'tests' | 'spend' | 'stalls'
interface Reading {readonly key: ReadKey; readonly read: string; readonly label: string; readonly says: string}
const READINGS: readonly Reading[] = [
  {key: 'tokens', read: 'readTokens', label: 'Tokens', says: 'Tokens each run read and wrote, from the task record.'},
  {key: 'time', read: 'readTime', label: 'Time', says: 'How long each run took.'},
  {key: 'calls', read: 'readCalls', label: 'Calls', says: 'The tool calls each run made.'},
  {key: 'tests', read: 'readTests', label: 'Tests', says: 'Whether the task\'s tests passed at the end of each run.'},
  {key: 'spend', read: 'readSpend', label: 'Spend', says: 'What each run cost, in dollars.'},
  {key: 'stalls', read: 'readStalls', label: 'Stalls', says: 'How often the agent went 90 s without a check-in.'},
]
const SAYS = {
  question: 'The question the run answers. Write it before you press Play.',
  task: 'The task that every run does.',
  variable: 'The setting that changes from one run to the next.',
  levels: 'The values the variable takes. Each value is one group of runs. Choose one to three.',
  agents: 'The sessions that take part.',
  repeats: 'The runs for each value. Drag handle 1 along the ruler.',
  stop: 'The condition that ends each run.',
  beat: 'How often a reading is taken during a run.',
  plot: 'The reading that the picture draws.',
  compare: 'Draws an earlier Experiment beside this one, and checks the constants that must match.',
}

// ---------------------------------------------------------------- readings

const finite = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const text = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)

interface Run {level: string; n: number; state: 'done' | 'running' | 'queued'; tokens?: number; time?: number; calls?: number; tests?: boolean; spend?: number; stalls?: number}
/** The runs an owner reports, kept only where they have a shape. Nothing in a bad list can throw. */
const runsIn = (raw: unknown): Run[] => {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((x): Run[] => {
    if (!x || typeof x !== 'object') return []
    const r = x as Record<string, unknown>, level = text(r.level), n = finite(r.n)
    if (!level || n === undefined) return []
    const state = r.state === 'done' || r.state === 'running' ? r.state : 'queued'
    return [{level, n, state, tokens: finite(r.tokens), time: finite(r.time), calls: finite(r.calls), tests: typeof r.tests === 'boolean' ? r.tests : undefined, spend: finite(r.spend), stalls: finite(r.stalls)}]
  })
}
const valueOf = (run: Run, key: ReadKey): number | undefined => (key === 'tests' ? (run.tests === undefined ? undefined : run.tests ? 1 : 0) : run[key])

interface Opt {id: string; name: string}
/** A list the owner gives for the current variable, or an object of lists keyed by variable. */
const listFor = (raw: unknown, variable: string | undefined): unknown[] => {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object' && variable) { const x = (raw as Record<string, unknown>)[variable]; return Array.isArray(x) ? x : [] }
  return []
}
const optionsOf = (v: V): Opt[] => listFor(json<unknown>(v, 'options', []), strOf(v, 'variable')).flatMap((o): Opt[] => {
  if (typeof o === 'string') return [{id: o, name: o}]
  if (!o || typeof o !== 'object') return []
  const r = o as Record<string, unknown>, id = text(r.id), name = text(r.name) ?? id
  return id && name ? [{id, name}] : []
})
const levelsOf = (v: V): string[] | undefined => (has(v, 'levels') ? listFor(json<unknown>(v, 'levels', []), strOf(v, 'variable')).filter((x): x is string => typeof x === 'string') : undefined)
const nameIn = (opts: readonly Opt[], id: string) => opts.find(o => o.id === id)?.name ?? id
const agentsOf = (v: V): {id: string; name: string; on: boolean}[] => {
  const raw = json<unknown>(v, 'agents', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap(a => {
    if (!a || typeof a !== 'object') return []
    const r = a as Record<string, unknown>, id = text(r.id), name = text(r.name) ?? id
    return id && name ? [{id, name, on: r.on === true}] : []
  })
}
const tasksOf = (v: V): Opt[] => {
  const raw = json<unknown>(v, 'tasks', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((t): Opt[] => {
    if (!t || typeof t !== 'object') return []
    const r = t as Record<string, unknown>, id = text(r.id)
    return id ? [{id, name: id}] : []
  })
}
interface Earlier {id: string; name: string; runs: Run[]; mismatches?: string[]}
const earlierOf = (v: V): Earlier[] => {
  const raw = json<unknown>(v, 'earlier', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((e): Earlier[] => {
    if (!e || typeof e !== 'object') return []
    const r = e as Record<string, unknown>, id = text(r.id), name = text(r.name) ?? id
    if (!id || !name) return []
    return [{id, name, runs: runsIn(r.runs), mismatches: Array.isArray(r.mismatches) ? r.mismatches.filter((m): m is string => typeof m === 'string') : undefined}]
  })
}
const comparedOf = (v: V): Earlier | undefined => { const id = strOf(v, 'compare'); return id ? earlierOf(v).find(e => e.id === id) : undefined }
const readingOf = (key: string | undefined) => READINGS.find(r => r.key === key)
const recording = (v: V, r: Reading) => boolOf(v, r.read)

interface Slot {level: string; name: string; n: number; run?: Run}
/** The plan: every level, every repeat, with the run that fills it. Undefined when the owner reports no levels or no repeats. */
const slotsOf = (v: V): Slot[] | undefined => {
  const levels = levelsOf(v), repeats = numOf(v, 'repeats')
  if (levels === undefined || repeats === undefined) return undefined
  const opts = optionsOf(v), runs = runsIn(json<unknown>(v, 'runs', []))
  const at = new Map(runs.map(r => [`${r.level}#${r.n}`, r] as const))
  return levels.flatMap(level => Array.from({length: Math.max(0, Math.round(repeats))}, (_, i) => ({level, name: nameIn(opts, level), n: i + 1, run: at.get(`${level}#${i + 1}`)})))
}
const doneCount = (slots: readonly Slot[]) => slots.filter(s => s.run?.state === 'done').length

// ---------------------------------------------------------------- words

const lightOf = (p: ViewProps): LightState => { const s = strOf(p.owner ?? p.v, 'light'); return s === 'lit' || s === 'dark' ? s : 'unknown' }
const lockOf = (v: V) => { const s = strOf(v, 'state'); return s === 'running' || s === 'done' ? LOCKED : undefined }
const st = (p: ViewProps, key: string, lockable = true) => ({...(p.standing?.[key] ?? {}), ...(lockable && lockOf(p.v) ? {disabled: lockOf(p.v)} : {})})
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const short = (s: string) => s.replace(/^ql-/, '')
const fmtTime = (s: number) => (s < 60 ? `${Math.round(s)} s` : s < 3600 ? `${(s / 60).toFixed(s < 600 ? 1 : 0)} min` : `${(s / 3600).toFixed(1)} h`)
const fmtTokens = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(x >= 10000 ? 0 : 1)}k` : `${Math.round(x)}`)
const fmtOf = (key: ReadKey, x: number): string => key === 'tokens' ? fmtTokens(x) : key === 'time' ? fmtTime(x) : key === 'spend' ? `$${x.toFixed(2)}` : key === 'tests' ? (x >= 1 ? 'pass' : 'fail') : `${Math.round(x)}`
const niceIn = (x: number) => { if (!(x > 0)) return 1; const p = 10 ** Math.floor(Math.log10(x)); return ([1, 2, 5, 10].find(m => x <= m * p) ?? 10) * p }
/** A round top for an axis: in minutes when the time is over a minute, so the label reads "3 min", not "3.3 min". */
const niceCeil = (x: number, key?: ReadKey) => (key === 'time' && x > 60 ? niceIn(x / 60) * 60 : niceIn(x))
const fmtRange = (key: ReadKey, lo: number, hi: number) => (key === 'time' && lo >= 60 && hi >= 60 ? `${(lo / 60).toFixed(1)}–${(hi / 60).toFixed(1)} min` : `${fmtOf(key, lo)}–${fmtOf(key, hi)}`)
const stateWord = (v: V) => strOf(v, 'state')
const runsLine = (slots: readonly Slot[] | undefined) => (slots === undefined || slots.length === 0 ? undefined : `${doneCount(slots)}/${slots.length}`)
const labelOf = (list: readonly Option<string>[], value: string | undefined) => list.find(o => o.value === value)?.label

// ---------------------------------------------------------------- the well

/** A short note in the well, for a reading that is missing. */
const Note = ({x, y, lines}: {x: number; y: number; lines: readonly string[]}) => (
  <g>{lines.map((line, i) => <text key={line} x={x} y={y + i * 11} className="dp-axis" textAnchor="middle">{line}</text>)}</g>
)

/** The plan drawn as bars: a group for each level, a bar for each repeat. The ruler above is the repeats; handle 1 sets them. */
function RunWell({v, set, w, h, size}: {v: V; set?: ViewProps['set']; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini'
  const slots = slotsOf(v), plot = readingOf(strOf(v, 'plot')), locked = lockOf(v) !== undefined
  const repeats = numOf(v, 'repeats'), state = stateWord(v)
  const x0 = 7, x1 = w - 7, top = mini ? 18 : 50, base = mini ? h - 8 : h - 32
  const groups = slots ? [...new Set(slots.map(s => s.level))] : []
  const gap = mini ? 4 : 8
  const groupW = groups.length ? (x1 - x0 - gap * (groups.length - 1)) / groups.length : 0
  const done = slots ? doneCount(slots) : 0
  const reps = slots && groups.length ? slots.length / groups.length : 0
  const pitch = reps ? groupW / reps : 0, barW = Math.max(1, Math.min(14, pitch - (pitch > 5 ? 1.5 : 0.5)))
  const valueAt = (s: Slot) => (plot && s.run?.state === 'done' ? valueOf(s.run, plot.key) : undefined)
  const values = slots ? slots.map(valueAt).filter((x): x is number => x !== undefined) : []
  const earlier = comparedOf(v)
  const ghost = new Map((earlier?.runs ?? []).filter(r => r.state === 'done').map(r => [`${r.level}#${r.n}`, r] as const))
  const ghostValues = plot ? [...ghost.values()].map(r => valueOf(r, plot.key)).filter((x): x is number => x !== undefined) : []
  const ymax = plot?.key === 'tests' ? 1 : niceCeil(Math.max(0, ...values, ...ghostValues), plot?.key)
  const hgt = (x: number) => Math.min(base - top, Math.max(2, (x / ymax) * (base - top)))
  const rulerP = (w - 14) / REPEATS.max
  const variable = labelOf(VARIABLES, strOf(v, 'variable'))

  let note: string[] | undefined
  if (slots === undefined) note = ['No reading of', 'the declaration']
  else if (slots.length === 0) note = ['No values chosen']
  else if (done === 0) note = [state === 'draft' ? 'Declared, not played' : 'Waiting for the first run']
  else if (!plot) note = ['No reading chosen', 'to draw']
  else if (values.length === 0) note = [`No reading of ${plot.label.toLowerCase()}`]

  return <Display w={w} h={h} label="The runs"
    does={mini ? 'The plan: a group of runs for each value. Bars are runs that finished.' : 'The plan: a group of runs for each value, a bar for each repeat. Drag handle 1 to set the repeats.'}
    corner={mini ? undefined : runsLine(slots)}>
    {!mini && <>
      <text x={x0} y={11} className="dp-ink-dim">{variable?.toLowerCase() ?? NONE}</text>
      {Array.from({length: REPEATS.max}, (_, i) => <rect key={i} x={x0 + i * rulerP + 0.5} y={19} width={Math.max(1, rulerP - 1.5)} height={7}
        className={repeats !== undefined && i < repeats ? undefined : 'dp-faint'} fill={repeats !== undefined && i < repeats ? 'var(--dp-value)' : 'none'} />)}
      <text x={x0} y={40} className="dp-axis">{repeats === undefined ? 'repeats —' : `repeats ${Math.round(repeats)}`}</text>
      <text x={x1} y={40} className="dp-axis" textAnchor="end">{plot ? (values.length ? `${plot.label.toLowerCase()} · ${fmtOf(plot.key, ymax)}` : plot.label.toLowerCase()) : NONE}</text>
      {set && !locked && repeats !== undefined && <Handle n={1} shape="square" x={x0 + repeats * rulerP} y={22.5} label="Repeats" does="Drag along the ruler: the runs for each value."
        onDrag={x => set('repeats', Math.round(clampTo(REPEATS.min, REPEATS.max, (x - x0) / rulerP)))} onReset={() => set('repeats', REPEATS_DEFAULT)} />}
    </>}
    {mini && <text x={x0} y={11} className="dp-ink-dim">{plot ? plot.label.toLowerCase() : NONE}</text>}
    <path d={`M${x0} ${base}H${x1}`} className="dp-faint" />
    {slots && groups.map((level, g) => {
      const gx = x0 + g * (groupW + gap), mine = slots.filter(s => s.level === level)
      return <g key={level}>
        {mine.map((s, i) => {
          const x = gx + i * pitch + (pitch - barW) / 2, val = valueAt(s), ghosted = ghost.get(`${s.level}#${s.n}`)
          const gv = plot && ghosted ? valueOf(ghosted, plot.key) : undefined
          return <g key={s.n}>
            {gv !== undefined && <rect x={x - 0.5} y={base - hgt(gv)} width={barW + 1} height={hgt(gv)} className="dp-faint" strokeDasharray="2 2" />}
            {s.run?.state === 'done' && val !== undefined
              ? <rect x={x} y={base - hgt(val)} width={barW} height={hgt(val)} fill={plot?.key === 'tests' ? (val >= 1 ? 'var(--green)' : 'var(--stall)') : 'var(--dp-value)'} opacity={plot?.key === 'tests' && val < 1 ? 0.7 : 1} />
              : s.run?.state === 'running' ? <rect x={x} y={base - 5} width={barW} height={5} fill="var(--dp-on)" />
              : <rect x={x + 0.5} y={base - 3} width={Math.max(1, barW - 1)} height={3} className="dp-faint" strokeDasharray={s.run?.state === 'done' ? '1.5 1.5' : undefined} />}
          </g>
        })}
        {!mini && <text x={gx + groupW / 2} y={base + 13} className="dp-axis" textAnchor="middle">{clip(short(mine[0]?.name ?? level), Math.max(4, Math.floor(groupW / 4.3)))}</text>}
      </g>
    })}
    {note && <Note x={w / 2} y={slots && slots.length > 0 && done === 0 ? top + 7 : (top + base) / 2 - 2} lines={note} />}
  </Display>
}

// ---------------------------------------------------------------- the controls

const variableChooser = (p: ViewProps) => <Chooser label="Variable" does={SAYS.variable} value={strOf(p.v, 'variable') ?? ''} options={VARIABLES} onChange={x => p.set('variable', x)} {...st(p, 'variable')} />
const repeatsDial = (p: ViewProps) => <Dial label="Repeats" does={SAYS.repeats} value={numOf(p.v, 'repeats') ?? NaN} def={REPEATS_DEFAULT} scale={REPEATS}
  format={x => `${Math.round(x)}`} onChange={x => p.set('repeats', Math.round(x))} {...st(p, 'repeats')} />
const stopChooser = (p: ViewProps) => <Chooser label="Stop when" does={SAYS.stop} value={strOf(p.v, 'stop') ?? ''} options={STOPS} onChange={x => p.set('stop', x)} {...st(p, 'stop')} />
const plotChooser = (p: ViewProps) => <Chooser label="Plot" does={SAYS.plot} value={strOf(p.v, 'plot') ?? ''}
  options={READINGS.filter(r => recording(p.v, r) === true).map(r => ({value: r.key, label: r.label, does: r.says}))} onChange={x => p.set('plot', x)} {...st(p, 'plot', false)} />

/** The cap of the chosen stop: turns or time. Task done and Test pass end a run without one. */
function capBox(p: ViewProps): ReactNode {
  const stop = strOf(p.v, 'stop')
  if (stop === 'time') return <ValueBox label="Cap" does="The most time one run may take." value={numOf(p.v, 'capTime') ?? NaN} scale={TIME} format={x => fmtTime(Math.round(x))}
    onChange={x => p.set('capTime', Math.round(x))} {...st(p, 'capTime')} />
  return <ValueBox label="Cap" does="The most turns one run may take." value={numOf(p.v, 'capTurns') ?? NaN} def={TURNS_DEFAULT} scale={TURNS} format={x => `${Math.round(x)} turns`}
    onChange={x => p.set('capTurns', Math.round(x))} {...st(p, 'capTurns')}
    {...(stop === 'done' || stop === 'tests' ? {disabled: 'Task done and Test pass end a run without a cap. Choose Turn cap or Time cap.'} : stop === undefined ? {disabled: 'No reading of Stop when.'} : lockOf(p.v) ? {disabled: LOCKED} : {})} />
}

const beatDial = (p: ViewProps) => <Dial label="Beat" does={SAYS.beat} value={numOf(p.v, 'beat') ?? NaN} def={BEAT_DEFAULT} scale={BEAT}
  format={x => fmtTime(Math.round(x))} onChange={x => p.set('beat', Math.round(x))} {...st(p, 'beat')} />

/** The values of the variable, as a list with a square for each: your request. One to three may stand. */
function Levels({p}: {p: ViewProps}) {
  const opts = optionsOf(p.v), chosen = levelsOf(p.v), variable = strOf(p.v, 'variable')
  if (opts.length === 0) return <p className="ex-none">{has(p.v, 'options') ? 'No values to choose.' : 'No reading of the values.'}</p>
  const locked = lockOf(p.v) !== undefined
  const items: RowItem[] = opts.map(o => ({id: o.id, name: short(o.name), light: chosen === undefined ? 'unknown' : chosen.includes(o.id) ? 'lit' : 'dark', tone: 'value',
    request: chosen === undefined ? undefined : chosen.includes(o.id), does: chosen?.includes(o.id) ? 'One group of runs.' : 'Not in the run.'}))
  const write = (next: string[]) => {
    const raw = json<unknown>(p.v, 'levels', [])
    const base = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    p.set('levels', JSON.stringify(Array.isArray(raw) || !variable ? next : {...base, [variable]: next}))
  }
  return <Rows label={`Levels · ${chosen === undefined ? NONE : `${chosen.length} of ${LEVELS_MAX}`}`} does={locked ? LOCKED : SAYS.levels} items={items} size={8} columns={2}
    onRequest={locked || chosen === undefined ? undefined : (id, on) => {
      if (on && chosen.length >= LEVELS_MAX) return
      if (!on && chosen.length <= 1) return
      write(on ? [...chosen, id] : chosen.filter(x => x !== id))
    }} />
}

/** The sessions that take part. */
function Agents({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0)
  const agents = agentsOf(p.v), locked = lockOf(p.v) !== undefined
  if (agents.length === 0) return <p className="ex-none">{has(p.v, 'agents') ? 'No sessions to choose.' : 'No reading of the sessions.'}</p>
  const items: RowItem[] = agents.map(a => ({id: a.id, name: a.name, light: a.on ? 'lit' : 'dark', tone: 'value', request: a.on, does: a.on ? 'Takes part.' : 'Does not take part.'}))
  return <Rows label={`Agents · ${agents.filter(a => a.on).length}`} does={locked ? LOCKED : SAYS.agents} items={items} size={3} page={page} onPage={setPage}
    onRequest={locked ? undefined : (id, on) => {
      if (!on && agents.filter(a => a.on).length <= 1) return
      p.set('agents', JSON.stringify(agents.map(a => (a.id === id ? {...a, on} : a))))
    }} />
}

const head = (p: ViewProps) => ({light: lightOf(p), onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the pane: the result

function Pane({v}: {v: V}) {
  const slots = slotsOf(v), q = strOf(v, 'question'), state = stateWord(v), opts = optionsOf(v)
  const levels = levelsOf(v) ?? [], rows = slots ?? [], done = rows.filter(s => s.run?.state === 'done')
  const lanes = READINGS.map(r => {
    const on = recording(v, r), vals = done.map(s => valueOf(s.run!, r.key)).filter((x): x is number => x !== undefined)
    const max = r.key === 'tests' ? 1 : niceCeil(Math.max(0, ...vals), r.key)
    const sub = on === undefined ? NONE : !on ? 'not asked' : done.length === 0 ? 'waiting' : vals.length === 0 ? 'no source' : r.key === 'tests' ? 'pass/fail' : `to ${fmtOf(r.key, max)}`
    return {r, on, vals, max, sub}
  })
  const asked = lanes.filter(l => l.on === true)
  const shown = rows.slice(0, 18)
  const earlier = comparedOf(v), compare = strOf(v, 'compare')
  const stop = strOf(v, 'stop'), cap = stop === 'turns' ? (has(v, 'capTurns') ? `${numOf(v, 'capTurns')} turns` : NONE) : stop === 'time' ? (has(v, 'capTime') ? fmtTime(numOf(v, 'capTime')!) : NONE) : undefined
  const agents = agentsOf(v).filter(a => a.on).map(a => a.name)
  const task = strOf(v, 'task')
  const statements: readonly [string, string, boolean][] = [
    ['Question', q === undefined ? NONE : q === '' ? 'Not written' : q, q === undefined || q === ''],
    ['Variable', `${labelOf(VARIABLES, strOf(v, 'variable')) ?? NONE}${slots ? ` · ${levels.map(l => short(nameIn(opts, l))).join(', ') || NONE}` : ''}`, !has(v, 'variable')],
    ['Task', task ?? NONE, task === undefined],
    ['Agents', has(v, 'agents') ? (agents.join(', ') || 'None') : NONE, !has(v, 'agents')],
    ['Stop when', `${labelOf(STOPS, stop) ?? NONE}${cap ? ` · ${cap}` : ''}`, stop === undefined],
    ['Readings', lanes.some(l => l.on === undefined) ? NONE : `${asked.map(l => l.r.label).join(', ') || 'None'}${has(v, 'beat') ? ` · every ${fmtTime(numOf(v, 'beat')!)}` : ''}`, lanes.some(l => l.on === undefined)],
  ]
  return <div className="ex-pane">
    <div className="ex-strip" aria-label="The Experiment">
      <b>{q ? clip(q, 80) : 'Experiment'}</b><span>{state ?? NONE}</span><span>{runsLine(slots) ? `${runsLine(slots)} runs` : 'no reading of the runs'}</span>
    </div>
    <dl className="ex-decl" aria-label="The declared run">
      {statements.map(([k, x, none]) => <div key={k} className="ex-decl-row"><dt>{k}</dt><dd data-none={none ? 'true' : undefined}>{x}</dd></div>)}
    </dl>
    <div className="ex-main">
      <div className="ex-runs" role="table" aria-label="Runs">
        <div className="ex-line ex-line-head" role="row">
          <span /><span>Run</span><span />
          {lanes.map(l => <span key={l.r.key} className="ex-lane-head" data-off={l.on === false ? 'true' : undefined} data-none={l.sub === 'no source' ? 'true' : undefined}><b>{l.r.label}</b><i>{l.sub}</i></span>)}
        </div>
        {rows.length === 0 && <p className="ex-empty">{slots ? 'No values chosen.' : 'No reading of the declaration.'}</p>}
        {shown.map(s => <div key={`${s.level}#${s.n}`} className="ex-line" role="row" data-state={s.run?.state ?? 'queued'}>
          <i className="ex-dot" /><span className="ex-level">{short(s.name)}</span><span className="ex-n">{s.n}</span>
          {lanes.map(l => {
            const val = s.run?.state === 'done' && l.on ? valueOf(s.run, l.r.key) : undefined
            return <span key={l.r.key} className="ex-cell" data-off={l.on === false ? 'true' : undefined}>
              {l.on && s.run?.state === 'done' && (val === undefined ? <em>{NONE}</em> : <><u style={{width: `${Math.max(3, (val / l.max) * 100)}%`}} data-test={l.r.key === 'tests' ? (val >= 1 ? 'pass' : 'fail') : undefined} /><span>{fmtOf(l.r.key, val)}</span></>)}
            </span>
          })}
        </div>)}
        {rows.length > shown.length && <p className="ex-more">{rows.length - shown.length} more runs</p>}
      </div>
      <aside className="ex-side" aria-label="Side by side">
        <h4>Side by side</h4>
        {asked.filter(l => l.vals.length > 0).length === 0 && <p className="ex-empty">{done.length === 0 ? 'No run has finished.' : 'No recorded reading has a source.'}</p>}
        {asked.filter(l => l.vals.length > 0).map(l => <section key={l.r.key} className="ex-block"><h5>{l.r.label}</h5>
          {levels.map(level => {
            const mine = done.filter(s => s.level === level).map(s => valueOf(s.run!, l.r.key)).filter((x): x is number => x !== undefined)
            const lo = mine.length ? Math.min(...mine) : 0, hi = mine.length ? Math.max(...mine) : 0
            return <div key={level} className="ex-range"><span>{short(nameIn(opts, level))}</span>
              <div className="ex-track">{mine.length > 0 && <>
                <u style={{left: `${(lo / l.max) * 100}%`, width: `${Math.max(0.8, ((hi - lo) / l.max) * 100)}%`}} />
                {mine.map((x, i) => <i key={i} style={{left: `${(x / l.max) * 100}%`}} />)}</>}</div>
              <em>{mine.length === 0 ? NONE : l.r.key === 'tests' ? `${mine.filter(x => x >= 1).length} of ${mine.length}` : lo === hi ? fmtOf(l.r.key, lo) : fmtRange(l.r.key, lo, hi)}</em>
            </div>
          })}</section>)}
      </aside>
    </div>
    {compare && <div className="ex-held" aria-label="Held constants">
      <b>{earlier ? `Beside ${earlier.name}` : 'Beside an earlier Experiment'}</b>
      {HELD.map(f => <span key={f} data-held={earlier?.mismatches === undefined ? 'none' : earlier.mismatches.includes(f) ? 'no' : 'yes'}
        data-i={`${f}|${earlier?.mismatches === undefined ? 'No reading of this constant.' : earlier.mismatches.includes(f) ? 'This constant differs. The two sets of runs do not compare on it.' : 'This constant is the same in both.'}`}>{f.replace(/_/g, ' ')}</span>)}
    </div>}
  </div>
}

// ---------------------------------------------------------------- the device

const OPTIONS = {
  condition: ['classic', 'ql-direct', 'ql-deep', 'ql-toolset', 'ql-tagged', 'ql-eight', 'ql-twelve'],
  model: ['claude-opus-4.8', 'claude-sonnet-4.6', 'claude-haiku-4.5', 'deepseek-v4-pro', 'gemini-3.1-pro-preview'],
  effort: ['low', 'medium', 'high', 'max'],
  skillset: ['documentation', 'engineering'],
  budget: ['6', '12', '24', '40'],
  autonomy: ['suggest', 'review', 'auto'],
}
const LEVELS = {condition: ['classic', 'ql-direct', 'ql-deep'], model: ['claude-sonnet-4.6', 'claude-haiku-4.5'], effort: ['medium', 'high'], skillset: ['documentation', 'engineering'], budget: ['12', '24'], autonomy: ['review', 'auto']}
const TASKS = [['S1-CODE-001', 'code'], ['S1-RESEARCH-001', 'local-research'], ['S1-EPISTEMIC-001', 'epistemic-understanding'], ['S1-SKILL-001', 'skill-agency'],
  ['S1-AGENCY-001', 'agency-recovery'], ['S1-RESTRAINT-001', 'bounded-restraint'], ['PRIME-COMPOSITION-001', 'recursive-agency-reconstitution'], ['PRIME-RECURSIVE-001', 'nested-recursive-agency']]

const run = (level: string, n: number, state: Run['state'], r: Partial<Run> = {}): Run => ({level, n, state, ...r})
/** Runs in progress: the owner has time, calls and tests; it has no tokens for them. */
const RUNNING = [
  run('classic', 1, 'done', {time: 128, calls: 23, tests: true}), run('classic', 2, 'done', {time: 117, calls: 21, tests: true}), run('classic', 3, 'done', {time: 141, calls: 27, tests: false}),
  run('ql-direct', 1, 'done', {time: 96, calls: 18, tests: true}), run('ql-direct', 2, 'running'), run('ql-direct', 3, 'queued'),
  run('ql-deep', 1, 'queued'), run('ql-deep', 2, 'queued'), run('ql-deep', 3, 'queued'),
]
const EARLIER = [{id: 'exp-1014', name: '14 Oct run', mismatches: ['budget'],
  runs: [run('classic', 1, 'done', {time: 150, calls: 25, tests: true}), run('classic', 2, 'done', {time: 133, calls: 24, tests: true}), run('classic', 3, 'done', {time: 160, calls: 29, tests: true}),
    run('ql-direct', 1, 'done', {time: 110, calls: 20, tests: true}), run('ql-direct', 2, 'done', {time: 99, calls: 18, tests: true}), run('ql-direct', 3, 'done', {time: 121, calls: 22, tests: false})]}]

/** Every key the owner reports or the shell holds: the "No readings" fixture drops all of them. */
const KEYS = ['light', 'state', 'question', 'task', 'tasks', 'variable', 'options', 'levels', 'agents', 'repeats', 'stop', 'capTurns', 'capTime', 'readTokens', 'readTime',
  'readCalls', 'readTests', 'readSpend', 'readStalls', 'beat', 'plot', 'compare', 'earlier', 'runs']
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'actuation:experiment',
  title: 'Experiment',
  kind: 'instrument',
  firstPage: 'run',
  defaults: {
    light: 'lit', state: 'draft', question: 'Does a deeper loop need fewer tool calls?', task: 'S1-CODE-001', tasks: JSON.stringify(TASKS.map(([id, name]) => ({id, name}))),
    variable: 'condition', options: JSON.stringify(Object.fromEntries(Object.entries(OPTIONS).map(([k, ids]) => [k, ids.map(id => ({id, name: id}))]))), levels: JSON.stringify(LEVELS),
    agents: JSON.stringify([{id: 'build-lane', name: 'build-lane', on: true}, {id: 'review-lane', name: 'review-lane', on: false}]),
    repeats: REPEATS_DEFAULT, stop: 'done', capTurns: TURNS_DEFAULT, capTime: 600,
    readTokens: true, readTime: true, readCalls: false, readTests: false, readSpend: false, readStalls: false, beat: BEAT_DEFAULT, plot: 'time',
    compare: '', earlier: JSON.stringify(EARLIER), runs: '[]',
  },
  fixtures: {
    'Declared, beside an earlier run': {readCalls: true, plot: 'calls', compare: 'exp-1014'},
    'Running, 4 of 9': {state: 'running', readCalls: true, readTests: true, runs: JSON.stringify(RUNNING)},
    'No readings': NOTHING,
  },

  folded: p => {
    const q = strOf(p.v, 'question'), slots = slotsOf(p.v)
    return <Folded title="Experiment" light={lightOf(p)} readings={[q === undefined ? NONE : q === '' ? 'No question' : clip(q, 10), runsLine(slots) ?? NONE]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Experiment" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <RunWell v={p.v} set={p.set} w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" cols={2}>
      <div className="ex-span">{variableChooser(p)}</div>
      {repeatsDial(p)}
      {plotChooser(p)}
      <div className="ex-span">{stopChooser(p)}</div>
    </Section>
  </Panel>,

  whole: p => <Panel title="Experiment" view="whole" {...head(p)} pages={[{id: 'run', label: 'Run'}, {id: 'record', label: 'Record'}]} page={p.page || 'run'} onPage={p.setPage}>
    {(p.page || 'run') === 'run' ? <>
      <Band>
        <Section width={206}>
          <RunWell v={p.v} set={p.set} w={194} h={146} size="whole" />
        </Section>
        <Section label="Variable" grow>
          {variableChooser(p)}
          <Levels p={p} />
        </Section>
      </Band>
      <Band>
        <Section label="Question" grow>
          <TextField wide label="Question" does={SAYS.question} value={strOf(p.v, 'question') ?? ''} placeholder={has(p.v, 'question') ? 'Write the question' : NONE}
            onChange={x => p.set('question', x)} {...st(p, 'question')} />
          <Chooser wide label="Task" does={SAYS.task} value={strOf(p.v, 'task') ?? ''} options={tasksOf(p.v).map(t => ({value: t.id, label: t.name}))} onChange={x => p.set('task', x)} {...st(p, 'task')} />
          <Agents p={p} />
        </Section>
        <Section label="Runs" cols={2}>
          {repeatsDial(p)}
          {capBox(p)}
          <div className="ex-span">
            <Radio label="Stop when" does={SAYS.stop} value={strOf(p.v, 'stop') ?? ''} options={STOPS} stack onChange={x => p.set('stop', x)} {...st(p, 'stop')} />
          </div>
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={206}>
          <RunWell v={p.v} set={p.set} w={194} h={146} size="whole" />
        </Section>
        <Section label="Readings" cols={2}>
          {READINGS.map(r => <Toggle key={r.key} label={r.label} does={r.says} on={recording(p.v, r) ?? false} unknown={recording(p.v, r) === undefined}
            onChange={x => p.set(r.read, x)} {...st(p, r.read)} />)}
        </Section>
        <Section label="Beat" cols={1} grow>
          {beatDial(p)}
          {plotChooser(p)}
        </Section>
      </Band>
      <Band>
        <Section label="Compare with" cols={2}>
          <div className="ex-span">
            <Chooser label="Compare with" does={SAYS.compare} value={strOf(p.v, 'compare') ?? ''}
              options={[{value: '', label: 'None'}, ...earlierOf(p.v).map(e => ({value: e.id, label: e.name}))]} onChange={x => p.set('compare', x)} {...st(p, 'compare', false)} />
          </div>
          <Readout label="held" does="The constants that match, of the 14 that must match for two sets of runs to compare."
            value={!has(p.v, 'compare') ? undefined : strOf(p.v, 'compare') === '' ? 'none' : comparedOf(p.v)?.mismatches === undefined ? undefined : `${HELD.length - comparedOf(p.v)!.mismatches!.length}/${HELD.length}`}
            tone={comparedOf(p.v)?.mismatches?.length === 0 ? 'green' : 'stall'} />
          <Readout label="differs" does="The first constant that does not match."
            value={!has(p.v, 'compare') ? undefined : strOf(p.v, 'compare') === '' ? 'none' : comparedOf(p.v)?.mismatches === undefined ? undefined : (comparedOf(p.v)!.mismatches![0]?.replace(/_/g, ' ') ?? 'none')} />
        </Section>
        <Section label="Run" cols={2}>
          <Readout label="state" does="Whether the run is declared, running or done." value={stateWord(p.v)} tone={stateWord(p.v) === 'running' ? 'value' : undefined} />
          <Readout label="runs" does="Runs finished, of the runs in the plan." value={runsLine(slotsOf(p.v))} tone="value" />
          <div className="ex-span">
            <Action label="New from this" does="Start a new Experiment with these statements. The declared run stays as it is."
              onPress={() => p.set('fork', true)} disabled={!has(p.v, 'state') ? 'No reading of the run.' : lockOf(p.v) ? undefined : 'Nothing is declared yet.'} {...p.standing?.fork} />
          </div>
        </Section>
        <Section label="Held" grow>
          <Ladder rungs={HELD.map(f => { const e = comparedOf(p.v); return e?.mismatches === undefined ? null : !e.mismatches.includes(f) })} labels={HELD.map(f => f.replace(/_/g, ' '))} label="Held constants" />
        </Section>
      </Band>
    </>}
  </Panel>,

  full: p => <Pane v={p.v} />,

  widget: p => {
    const q = strOf(p.v, 'question'), slots = slotsOf(p.v), plot = readingOf(strOf(p.v, 'plot'))
    const last = slots?.filter(s => s.run?.state === 'done' && plot && valueOf(s.run, plot.key) !== undefined).at(-1)
    return <Tile title="Experiment" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <RunWell v={p.v} w={104} h={100} size="mini" />
      <div className="ex-tile-side">
        <p className="ex-q" data-none={q ? undefined : 'true'}>{q === undefined ? 'No reading of the question' : q === '' ? 'No question written' : q}</p>
        <div className="ex-tile-reads">
          <Readout label="runs" does="Runs finished, of the runs in the plan." value={runsLine(slots)} tone="value" />
          <Readout label={plot ? `latest ${plot.label.toLowerCase()}` : 'latest'} does="The reading of the run that finished last." value={last && plot ? fmtOf(plot.key, valueOf(last.run!, plot.key)!) : undefined} />
          <Readout label="state" does="Whether the run is declared, running or done." value={stateWord(p.v)} />
        </div>
      </div>
    </Tile>
  },
}
