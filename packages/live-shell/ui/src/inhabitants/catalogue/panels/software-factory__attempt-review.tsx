// Runs (manual §19.1, software-factory:attempt-review): every attempt made on a piece of work, the task tree of each, and which
// attempt stands. Live's nearest: a device whose well draws clips on a ruler (Arrangement), with a list under it.
// The owner's material: the attempts come from the Factory owner (kernel op factory_attempt_read, addressed by run_ref; each record is
// attempt_ref, task_ref, recorded-at, participant agent, readable Return), and each attempt's tasks from the shell's run model
// (agent/agentRunModel.ts TaskClip: state running | queued | stalled | done, start, last output). A running task has no drawn end;
// a stalled task freezes at its last output (agentRunModel.ts:95 HEARTBEAT_HORIZON_MS); the ruler counts minutes from each attempt's
// own start, so a retry a day later still lines up with the first.
//
// Keys. `attempts` is JSON: rows of {id, n, state, agent, session, day, at, seen, current, ret, tasks}, a task being {id, title, state,
// parent, agent, t0, seen}. `session` is the id of the Thread's session, so a task's log opens in Clip view on the Thread's own rows.
// `works` is JSON: rows of {id, name}. The settings are `work`, `attempt`, `show`, `group`, `view`, `compare`, `stands`; `standsPending`
// holds the attempt you chose to stand until you confirm; `task` is the task selected in the pane. A key the owner does not report
// arrives absent, and the views draw "—" and say what is missing.
import {Fragment, type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Lamp, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, clampTo, has, json, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './software-factory__attempt-review.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- the owner's rows, read safely

const STATES = ['running', 'queued', 'stalled', 'failed', 'done', 'unknown'] as const
type State = (typeof STATES)[number]
const stateIn = (x: unknown): State => STATES.find(s => s === x) ?? 'unknown'
const WORD: Readonly<Record<State, string>> = {running: 'running', queued: 'queued', stalled: 'stalled', failed: 'failed', done: 'done', unknown: 'not read'}
const FILL: Readonly<Record<State, string>> = {running: 'var(--dp-value)', stalled: 'var(--stall)', done: 'var(--green)', failed: 'var(--text-dim)', queued: 'var(--text-faint)', unknown: 'var(--text-faint)'}
const TONE: Readonly<Record<State, Tone | undefined>> = {running: 'value', stalled: 'stall', done: 'green', failed: undefined, queued: undefined, unknown: undefined}
const LIGHT: Readonly<Record<State, LightState>> = {running: 'lit', stalled: 'lit', done: 'lit', failed: 'dark', queued: 'dark', unknown: 'unknown'}

const word = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
const count = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined)

interface Task { readonly id: string; readonly title?: string; readonly state: State; readonly parent?: string; readonly agent?: string; readonly t0?: number; readonly seen?: number }
interface Return { readonly summary?: string; readonly artifacts?: number; readonly evidence?: number; readonly receiving?: boolean }
interface Attempt {
  readonly id: string
  readonly n: number
  readonly state: State
  readonly agent?: string
  readonly session?: string
  readonly day?: string
  readonly at?: string
  /** Minutes from the attempt's start to its last output. */
  readonly seen?: number
  /** The owner's own standing: the attempt that is current. */
  readonly current: boolean
  readonly ret?: Return
  readonly tasks: readonly Task[]
}

const objects = (raw: unknown): Record<string, unknown>[] => (Array.isArray(raw) ? raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [])

/** The attempts of the work, oldest first; undefined when the owner reports none (not the same as an empty list). */
function attemptsOf(v: V): Attempt[] | undefined {
  const raw = json<unknown>(v, 'attempts', undefined)
  if (!Array.isArray(raw)) return undefined
  const list: Attempt[] = []
  objects(raw).forEach((o, i) => {
    const id = word(o.id)
    if (!id) return
    const tasks: Task[] = []
    for (const t of objects(o.tasks)) {
      const tid = word(t.id)
      if (tid) tasks.push({id: tid, title: word(t.title), state: stateIn(t.state), parent: word(t.parent), agent: word(t.agent), t0: count(t.t0), seen: count(t.seen)})
    }
    const r = o.ret && typeof o.ret === 'object' ? o.ret as Record<string, unknown> : undefined
    list.push({id, n: count(o.n) ?? i + 1, state: stateIn(o.state), agent: word(o.agent), session: word(o.session), day: word(o.day), at: word(o.at), seen: count(o.seen),
      current: o.current === true, tasks,
      ret: r ? {summary: word(r.summary), artifacts: count(r.artifacts), evidence: count(r.evidence), receiving: typeof r.receiving === 'boolean' ? r.receiving : undefined} : undefined})
  })
  return list.sort((a, b) => a.n - b.n)
}

const workName = (v: V): string | undefined => {
  const id = strOf(v, 'work')
  if (id === undefined) return undefined
  return word(objects(json<unknown>(v, 'works', [])).find(o => o.id === id)?.name) ?? id
}

// ---------------------------------------------------------------- the reading the views share

const groupKey = (a: Attempt, group: string | undefined): string | undefined => (group === 'agent' ? a.agent ?? NONE : group === 'day' ? a.day ?? NONE : undefined)

/** The attempts newest first, as a list of runs reads. Group by agent or by day gathers each group, in the order it first appears. */
function ordered(list: readonly Attempt[], group: string | undefined): Attempt[] {
  const newest = [...list].reverse()
  if (group !== 'agent' && group !== 'day') return newest
  const keys: string[] = []
  for (const a of newest) { const k = groupKey(a, group) ?? NONE; if (!keys.includes(k)) keys.push(k) }
  return newest.sort((a, b) => keys.indexOf(groupKey(a, group) ?? NONE) - keys.indexOf(groupKey(b, group) ?? NONE) || b.n - a.n)
}

interface TreeRow { readonly task: Task; readonly depth: number; readonly dim: boolean }
/** The task tree: parents first, children under them. Show keeps the tasks in that state and the parents that lead to them (dimmed). A
 * parent that is not in the list makes its task a root. */
function treeOf(tasks: readonly Task[], show: string | undefined): TreeRow[] {
  const byId = new Set(tasks.map(t => t.id)), kids = new Map<string | undefined, Task[]>()
  for (const t of tasks) {
    const key = t.parent !== undefined && t.parent !== t.id && byId.has(t.parent) ? t.parent : undefined
    kids.set(key, [...(kids.get(key) ?? []), t])
  }
  const matches = (s: State) => show === undefined || show === 'all' || s === show
  const seen = new Set<string>()
  const build = (t: Task, depth: number): TreeRow[] => {
    if (seen.has(t.id)) return []
    seen.add(t.id)
    const below = (kids.get(t.id) ?? []).flatMap(c => build(c, depth + 1))
    return matches(t.state) || below.length ? [{task: t, depth, dim: !matches(t.state)}, ...below] : []
  }
  return (kids.get(undefined) ?? []).flatMap(t => build(t, 0))
}

interface Reading {
  readonly attempts: readonly Attempt[] | undefined
  /** The attempt you read; undefined when the owner names none or none that it lists. */
  readonly me: Attempt | undefined
  readonly cmp: Attempt | undefined
  readonly latest: Attempt | undefined
  readonly standsId: string | undefined
  readonly pending: Attempt | undefined
  /** Tasks of the attempt you read that stand differently in the one you compare. */
  readonly differs: number | undefined
}

function read(p: ViewProps): Reading {
  const v = p.v, attempts = attemptsOf(v), find = (id: string | undefined) => (id === undefined ? undefined : attempts?.find(a => a.id === id))
  const me = find(strOf(v, 'attempt')), cmp = find(strOf(v, 'compare')), pendingId = strOf(v, 'standsPending')
  const differs = me && cmp ? me.tasks.filter(t => { const other = cmp.tasks.find(o => o.title === t.title); return other === undefined || other.state !== t.state }).length : undefined
  return {attempts, me, cmp, latest: attempts?.[attempts.length - 1], standsId: strOf(v, 'stands'), pending: find(pendingId), differs}
}

const light = (p: ViewProps): LightState => { const x = strOf(p.owner ?? p.v, 'light'); return x === 'lit' || x === 'dark' ? x : 'unknown' }
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const shorts = (a: Attempt | undefined) => (a ? `#${a.n}` : undefined)

// ---------------------------------------------------------------- the choices

const SHOW: readonly Option<string>[] = [
  {value: 'all', label: 'All', does: 'Every task of the attempt.'},
  {value: 'running', label: 'Running', does: 'Tasks that run now.'},
  {value: 'queued', label: 'Queued', does: 'Tasks that wait their turn.'},
  {value: 'stalled', label: 'Stalled', does: 'Tasks that stopped and wait for you.'},
  {value: 'failed', label: 'Failed', does: 'Tasks the owner reports failed.'},
  {value: 'done', label: 'Done', does: 'Tasks that returned.'},
]
const GROUP: readonly Option<string>[] = [
  {value: 'attempt', label: 'Attempt', does: 'One group for each attempt.'},
  {value: 'agent', label: 'Agent', does: 'Attempts under the agent that made them.'},
  {value: 'day', label: 'Day', does: 'Attempts under the day they began.'},
]
const VIEW: readonly Option<string>[] = [
  {value: 'tree', label: 'Tree', does: 'Tasks as nested rows.'},
  {value: 'ruler', label: 'Ruler', does: 'Attempts along one ruler of elapsed time.'},
]

const SAYS = {
  work: 'The piece of work whose attempts the device lists. It follows the selected session.',
  attempt: 'The attempt you read. The latest is the default.',
  show: 'Which tasks show: all, or only those running, queued, stalled, failed or done.',
  group: 'How the attempts group: by attempt, by agent or by day.',
  view: 'Tree: tasks as nested rows. Ruler: attempts along one ruler of elapsed time.',
  compare: 'Draws a second attempt beside the one you read. None draws one.',
  stands: 'The attempt you accept. Choose one to read its Return, then confirm.',
  confirm: 'Accept this attempt as the one that stands. The device does not choose for you.',
  cancel: 'Keep the attempt that stands now.',
}

const attemptOptions = (r: Reading, now: string | undefined, long: boolean, skip?: string): Option<string>[] => {
  const list: Option<string>[] = (r.attempts ?? []).filter(a => a.id !== skip).map(a => ({value: a.id, label: long ? `#${a.n} · ${a.agent ?? NONE}` : `#${a.n}`}))
  return now !== undefined && now !== 'none' && !list.some(o => o.value === now) && now !== skip ? [...list, {value: now, label: now}] : list
}
const withNone = (options: Option<string>[]): Option<string>[] => [{value: 'none', label: 'None'}, ...options]

const attemptChooser = (p: ViewProps, r: Reading, long: boolean, wide = long) =>
  <Chooser {...st(p, 'attempt')} label="Attempt" does={SAYS.attempt} wide={wide} value={strOf(p.v, 'attempt') ?? ''} options={attemptOptions(r, strOf(p.v, 'attempt'), long)} onChange={x => p.set('attempt', x)} />
const showChooser = (p: ViewProps, wide = false) =>
  <Chooser {...st(p, 'show')} label="Show" does={SAYS.show} wide={wide} value={strOf(p.v, 'show') ?? ''} options={SHOW} onChange={x => p.set('show', x)} />
const groupChooser = (p: ViewProps, wide = false) =>
  <Chooser {...st(p, 'group')} label="Group by" does={SAYS.group} wide={wide} value={strOf(p.v, 'group') ?? ''} options={GROUP} onChange={x => p.set('group', x)} />
const compareChooser = (p: ViewProps, r: Reading, long: boolean, wide = long) =>
  <Chooser {...st(p, 'compare')} label="Compare" does={SAYS.compare} wide={wide} value={strOf(p.v, 'compare') ?? ''}
    options={withNone(attemptOptions(r, strOf(p.v, 'compare'), long, strOf(p.v, 'attempt')))} onChange={x => p.set('compare', x)} />
/** Stands: a narrowing goes at once; choosing an attempt waits for Confirm (you review its Return first). */
const standsChooser = (p: ViewProps, r: Reading) => {
  const shown = strOf(p.v, 'standsPending') ?? strOf(p.v, 'stands') ?? ''
  return <Chooser {...st(p, 'stands')} label="Stands" does={SAYS.stands} value={shown} options={withNone(attemptOptions(r, shown, false))}
    onChange={x => { if (x === 'none') { p.set('stands', 'none'); p.set('standsPending', undefined) } else if (x !== strOf(p.v, 'stands')) p.set('standsPending', x); else p.set('standsPending', undefined) }} />
}
const Consent = ({p, r}: {p: ViewProps; r: Reading}) => {
  if (strOf(p.v, 'standsPending') === undefined) return null
  return <>
    <Action {...st(p, 'stands')} label="Confirm" does={`${SAYS.confirm} Reads #${r.pending?.n ?? NONE}.`} onPress={() => { p.set('stands', strOf(p.v, 'standsPending')); p.set('standsPending', undefined) }} />
    <Action label="Cancel" does={SAYS.cancel} onPress={() => p.set('standsPending', undefined)} />
  </>
}
const viewRadio = (p: ViewProps) =>
  <Radio {...st(p, 'view')} label="View" does={SAYS.view} value={strOf(p.v, 'view') ?? ''} stack options={VIEW} onChange={x => p.set('view', x)} />
const workChooser = (p: ViewProps) => {
  const works = objects(json<unknown>(p.v, 'works', [])).flatMap(o => (word(o.id) ? [{value: word(o.id)!, label: word(o.name) ?? word(o.id)!}] : []))
  const now = strOf(p.v, 'work')
  return <Chooser {...st(p, 'work')} label="Work" does={SAYS.work} wide value={now ?? ''} options={now !== undefined && !works.some(o => o.value === now) ? [...works, {value: now, label: now}] : works} onChange={x => p.set('work', x)} />
}

// ---------------------------------------------------------------- the well

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
const X0 = 34

/** One bar of an attempt or a task: closed where it ended, open where it still runs (nobody knows how long it takes), frozen with a cap
 * where it stalled, outlined with a cross where it failed, dashed where it has not begun. */
function Bar({state, x, y, len, h = 6}: {state: State; x: number; y: number; len: number | undefined; h?: number}): ReactNode {
  const mid = y + h / 2, end = x + (len === undefined ? 4 : Math.max(3, len))
  const dash = (at: number, n: number, colour: string) => <path d={`M${at} ${mid}h${n}`} stroke={colour} strokeWidth={1.2} strokeDasharray="2 2" fill="none" opacity={0.8} />
  switch (state) {
    case 'done': return <rect x={x} y={y} width={end - x} height={h} fill={FILL.done} opacity={0.85} />
    case 'running': return <g><rect x={x} y={y} width={end - x} height={h} fill={FILL.running} opacity={0.85} />{dash(end, 9, FILL.running)}</g>
    case 'stalled': return <g><rect x={x} y={y} width={end - x} height={h} fill={FILL.stalled} opacity={0.85} /><rect x={end - 1} y={y - 2} width={1.6} height={h + 4} fill={FILL.stalled} /></g>
    case 'failed': return <g><rect x={x + 0.5} y={y + 0.5} width={end - x} height={Math.max(1, h - 1)} fill="none" stroke={FILL.failed} /><path d={`M${end + 3} ${mid - 2.5}l5 5m0 -5l-5 5`} stroke={FILL.failed} strokeWidth={1.1} fill="none" /></g>
    case 'queued': return <rect x={x + 0.5} y={y + 0.5} width={10} height={Math.max(1, h - 1)} fill="none" stroke={FILL.queued} strokeDasharray="2 2" />
    default: return dash(x, 10, FILL.unknown)
  }
}

const matches = (show: string | undefined, a: Attempt) => show === undefined || show === 'all' || a.tasks.some(t => t.state === show)

/** The well: the attempts as bars on one ruler of elapsed minutes (newest at the top), the one you read marked by handle 1, the one you
 * compare by handle 2; whole, the task tree of the attempt you read under them, or each attempt's tasks along its lane. */
function RunWell({p, r, live, w, h, size}: {p: ViewProps; r: Reading; live: boolean; w: number; h: number; size: 'compact' | 'whole'}) {
  const v = p.v, whole = size === 'whole', ruler = whole && strOf(v, 'view') === 'ruler', group = strOf(v, 'group'), show = strOf(v, 'show')
  const all = r.attempts ? ordered(r.attempts, group) : undefined, list = all ?? []
  const top = 17, pitch = whole ? (ruler ? 21 : 12) : 15
  const room = whole ? (ruler ? 6 : 4) : 7
  const sel = list.findIndex(a => a.id === r.me?.id)
  const start = sel >= room ? sel - room + 1 : 0
  const shown = list.slice(start, start + room)
  const reach = Math.max(1, ...shown.map(a => a.seen ?? 0), ...(ruler ? shown.flatMap(a => a.tasks.map(t => t.seen ?? 0)) : []))
  const span = w - X0 - 26, px = (m: number | undefined) => (m === undefined ? undefined : (m / reach) * span)
  const handle = (key: string) => live && !p.standing?.[key]?.disabled && has(v, key)
  const rowOf = (a: Attempt | undefined) => shown.findIndex(x => x.id === a?.id)
  const at = (y: number) => shown[clampTo(0, Math.max(0, shown.length - 1), Math.floor((y - top) / pitch))]
  const selRow = rowOf(r.me), cmpRow = rowOf(r.cmp)
  const tree = whole && !ruler && r.me ? treeOf(r.me.tasks, show) : []
  const cap = 6, treeShown = tree.length > cap ? tree.slice(0, cap - 1) : tree
  const standsRow = rowOf(r.attempts?.find(a => a.id === r.standsId)), pendingRow = rowOf(r.pending)
  const diamond = (row: number, pending: boolean) => <path key={pending ? 'p' : 's'} d={`M${w - 19} ${top + row * pitch + pitch / 2 - 3}l3 3l-3 3l-3 -3z`} fill={pending ? 'none' : 'var(--dp-on)'} stroke="var(--dp-on)" strokeDasharray={pending ? '1.5 1.5' : undefined} />
  const headText = list.length
    ? `${list.length} attempts${whole ? `${group === 'agent' ? ' · by agent' : group === 'day' ? ' · by day' : ''}${r.cmp ? ` · vs #${r.cmp.n}` : ''}` : list.length > room ? ` ↓${list.length - room}` : ''}`
    : r.attempts ? 'no attempts' : ''
  return <Display w={w} h={h} label="The attempts" corner={r.me ? `#${r.me.n} ${WORD[r.me.state]}` : NONE}
    does={whole ? 'Attempts as bars on one ruler of elapsed minutes. Drag handle 1 to read another attempt and handle 2 to compare one.' : 'Attempts as bars on one ruler of elapsed minutes. Drag handle 1 to read another attempt.'}>
    {headText && <text x={7} y={11} className="dp-axis">{headText}</text>}
    {r.attempts === undefined && <text x={7} y={top + 12} className="dp-axis">No reading of the attempts</text>}
    {shown.map((a, i) => {
      const y = top + i * pitch, isSel = a.id === r.me?.id, dim = !matches(show, a), prev = shown[i - 1]
      const barY = ruler ? y + 1 : y + (pitch - 6) / 2
      return <g key={a.id} opacity={dim ? 0.35 : 1}>
        {isSel && <rect x={0} y={y} width={w} height={pitch} fill="var(--text)" opacity={0.07} />}
        {prev && groupKey(prev, group) !== groupKey(a, group) && <path d={`M0 ${y}H${w}`} className="dp-faint" />}
        <text x={3} y={ruler ? y + 9 : y + pitch / 2 + 3} className="dp-axis">{`#${a.n}`}</text>
        {ruler
          ? <>
            <path d={`M${X0} ${y + 3}h${px(a.seen) ?? 0}`} className="dp-faint" />
            {treeOf(a.tasks, show).filter(row => row.task.t0 !== undefined).map(row => <Bar key={row.task.id} state={row.task.state} x={X0 + (px(row.task.t0) ?? 0)} y={y + 6 + Math.min(row.depth, 2) * 4.5}
              len={px(row.task.seen !== undefined ? row.task.seen - (row.task.t0 ?? 0) : undefined)} h={3} />)}
          </>
          : <Bar state={a.state} x={X0} y={barY} len={px(a.seen)} />}
      </g>
    })}
    {standsRow >= 0 && diamond(standsRow, false)}
    {pendingRow >= 0 && diamond(pendingRow, true)}
    {!whole && r.cmp && rowOf(r.cmp) >= 0 && <rect x={18.5} y={top + rowOf(r.cmp) * pitch + pitch / 2 - 3.5} width={7} height={7} fill="none" stroke="var(--dp-value)" strokeWidth={1.2} />}
    {!whole && r.attempts && <path d={`M${X0} 133H${X0 + span}`} className="dp-faint" />}
    {!whole && r.attempts && <text x={X0} y={143} className="dp-axis">0</text>}
    {!whole && r.attempts && <text x={X0 + span} y={143} className="dp-axis" textAnchor="end">{`${reach} min`}</text>}
    {whole && !ruler && <>
      {r.attempts !== undefined && <path d={`M0 66H${w}`} className="dp-faint" />}
      {r.attempts !== undefined && !r.me && <text x={7} y={80} className="dp-axis">{strOf(v, 'attempt') === undefined ? 'No attempt chosen' : 'No reading of this attempt'}</text>}
      {r.me && tree.length === 0 && <text x={7} y={80} className="dp-axis">{show === undefined || show === 'all' ? 'no tasks' : 'nothing in this filter'}</text>}
      {treeShown.map((row, i) => {
        const y = 70 + i * 11, x = 5 + row.depth * 7, other = r.cmp?.tasks.find(t => t.title === row.task.title)
        const differs = r.cmp !== undefined && (other === undefined || other.state !== row.task.state)
        return <g key={row.task.id} opacity={row.dim ? 0.5 : 1}>
          {strOf(v, 'task') === row.task.id && <rect x={0} y={y} width={w} height={11} fill="var(--text)" opacity={0.07} />}
          <circle cx={x + 3} cy={y + 5.5} r={2.4} fill={row.task.state === 'queued' || row.task.state === 'unknown' ? 'none' : FILL[row.task.state]} stroke={FILL[row.task.state]} strokeWidth={1} />
          <text x={x + 9} y={y + 8.5} className="dp-axis" style={{fill: 'var(--text-dim)'}}>{cut(row.task.title ?? NONE, Math.floor((w - x - 9 - (r.cmp ? 16 : 6)) / 4.4))}</text>
          {r.cmp && <>
            {differs && <circle cx={w - 9} cy={y + 5.5} r={4.6} fill="none" stroke="var(--dp-on)" strokeWidth={1} />}
            {other ? <circle cx={w - 9} cy={y + 5.5} r={2.4} fill={other.state === 'queued' || other.state === 'unknown' ? 'none' : FILL[other.state]} stroke={FILL[other.state]} strokeWidth={1} />
              : <path d={`M${w - 11.5} ${y + 5.5}h5`} stroke="var(--text-faint)" strokeWidth={1.2} />}
          </>}
        </g>
      })}
      {tree.length > cap && <text x={7} y={70 + (cap - 1) * 11 + 8.5} className="dp-axis">{`+${tree.length - cap + 1} more`}</text>}
    </>}
    {handle('attempt') && selRow >= 0 && <Handle n={1} shape="ring" x={22} y={top + selRow * pitch + pitch / 2} label="Attempt" does="Drag up or down to read another attempt."
      onDrag={(_, y) => { const a = at(y); if (a && a.id !== r.me?.id) p.set('attempt', a.id) }} onReset={() => r.latest && p.set('attempt', r.latest.id)} />}
    {whole && handle('compare') && selRow >= 0 && <Handle n={2} shape="square" tone="value" x={w - 8} y={top + (cmpRow >= 0 ? cmpRow : selRow) * pitch + pitch / 2} label="Compare"
      does="Drag to another attempt to draw it beside the one you read. Drop it on the one you read for None."
      onDrag={(_, y) => { const a = at(y); if (a) p.set('compare', a.id === r.me?.id ? 'none' : a.id) }} onReset={() => p.set('compare', 'none')} />}
  </Display>
}

// ---------------------------------------------------------------- the pane

const niceStep = (reach: number) => [1, 2, 5, 10, 15, 30, 60].find(s => reach / s <= 10) ?? 120
const minutes = (m: number | undefined) => (m === undefined ? NONE : `${Math.round(m)} min`)

/** The pane: the attempts and the task tree of each, as nested rows or along one ruler. Selecting a task selects it for Clip view, which
 * shows the log of the session that ran it. The Return of the attempt you read (or the one waiting to stand) stands at the right. */
function RunsPane({p}: {p: ViewProps}) {
  const r = read(p), v = p.v, ruler = strOf(v, 'view') === 'ruler', group = strOf(v, 'group'), show = strOf(v, 'show'), picked = strOf(v, 'task')
  const list = r.attempts ? ordered(r.attempts, group) : undefined
  const reach = Math.max(1, ...(list ?? []).flatMap(a => [a.seen ?? 0, ...a.tasks.map(t => t.seen ?? 0)]))
  const step = niceStep(reach), ticks = Array.from({length: Math.floor(reach / step) + 1}, (_, i) => i * step)
  const pct = (m: number) => `${(m / reach) * 100}%`
  const chosen = list?.flatMap(a => a.tasks.map(t => ({a, t}))).find(x => x.t.id === picked)
  const review = r.pending ?? r.me
  const standsAt = r.attempts?.find(a => a.id === r.standsId)
  const pick = (id: string) => { if (!st(p, 'task').disabled) p.set('task', id) }
  const track = (state: State, t0: number | undefined, seen: number | undefined) =>
    <div className="ar-track">{t0 !== undefined && <i className="ar-bar" data-state={state} style={{left: pct(t0), width: `max(3px, ${pct(Math.max(0, (seen ?? t0) - t0))})`}} />}</div>
  return <div className="ar-pane">
    <div className="ar-head" aria-label="The work">
      <b>{workName(v) ?? NONE}</b><span>{list ? `${list.length} attempts` : NONE}</span><span>reading {shorts(r.me) ?? NONE}</span>
      {r.cmp && <span>against {shorts(r.cmp)}</span>}<span>stands {standsAt ? shorts(standsAt) : r.standsId === 'none' ? 'nothing' : NONE}</span>
    </div>
    <div className="ar-main">
      <div className="ar-list" data-view={ruler ? 'ruler' : 'tree'} role="tree" aria-label="Attempts">
        {list === undefined && <p className="ar-none">No reading of the attempts.</p>}
        {list !== undefined && list.length === 0 && <p className="ar-none">This work has no attempt yet.</p>}
        {list && list.length > 0 && (ruler
          ? <div className="ar-row ar-colhead"><span>Attempt · task · minutes</span><div className="ar-ticks">{ticks.map(t => <i key={t} style={{left: pct(t)}}><small>{t}</small></i>)}</div></div>
          : <div className="ar-row ar-colhead"><span>Attempt · task</span><span>State</span><span>Agent</span><span>Began</span><span>Last output</span></div>)}
        {list?.map((a, i) => {
          const key = groupKey(a, group), prev = list[i - 1], rows = treeOf(a.tasks, show)
          return <Fragment key={a.id}>
            {key !== undefined && (prev === undefined || groupKey(prev, group) !== key) && <div className="ar-row ar-group"><span>{group === 'agent' ? 'Agent' : 'Day'} · {key}</span></div>}
            <div className="ar-row" data-kind="attempt" role="treeitem" aria-level={1} aria-label={`Attempt ${a.n}, ${WORD[a.state]}`}>
              <div className="ar-name"><Lamp state={LIGHT[a.state]} tone={TONE[a.state]} /><b>#{a.n}</b>{ruler && <span>{[a.agent, a.day, a.at].filter(Boolean).join(' · ') || NONE}</span>}
                {a.id === r.me?.id && <em className="ar-mark" data-on="reading">reading</em>}
                {a.id === r.cmp?.id && <em className="ar-mark" data-on="compare">compare</em>}
                {a.id === r.standsId && <em className="ar-mark" data-on="stands">stands</em>}
                {a.id === r.pending?.id && <em className="ar-mark" data-on="waits">waits</em>}
                {a.current && <em className="ar-mark" data-on="current">current</em>}</div>
              {ruler ? track(a.state, 0, a.seen) : <>
                <span className="ar-cell" data-state={a.state}>{WORD[a.state]}</span><span className="ar-cell">{a.agent ?? NONE}</span><span className="ar-cell">{[a.day, a.at].filter(Boolean).join(' ') || NONE}</span><span className="ar-cell">{minutes(a.seen)}</span></>}
            </div>
            {rows.map(row => {
              const t = row.task
              return <div key={t.id} className="ar-row" data-kind="task" data-dim={row.dim || undefined} data-selected={t.id === picked ? 'true' : undefined} role="treeitem" aria-level={row.depth + 2}
                data-i={`${t.title ?? NONE}|${WORD[t.state]}. Select it and its log opens in Clip view.`}>
                <button type="button" className="ar-name" style={{paddingLeft: 22 + row.depth * 16}} aria-pressed={t.id === picked} onClick={() => pick(t.id)}>
                  <Lamp state={LIGHT[t.state]} tone={TONE[t.state]} /><span>{t.title ?? NONE}</span></button>
                {ruler ? track(t.state, t.t0, t.seen) : <>
                  <span className="ar-cell" data-state={t.state}>{WORD[t.state]}</span><span className="ar-cell">{t.agent ?? NONE}</span><span className="ar-cell">{minutes(t.t0)}</span><span className="ar-cell">{minutes(t.seen)}</span></>}
              </div>
            })}
          </Fragment>
        })}
      </div>
      <aside className="ar-side" aria-label="Return">
        <h4>Return · {shorts(review) ?? NONE}</h4>
        {review === undefined ? <p>No attempt to review.</p>
          : review.ret === undefined ? <p>No Return recorded for {shorts(review)}. The provider's answer is not a finished task.</p>
            : <><p>{review.ret.summary ?? NONE}</p>
              <dl><dt>Artifacts</dt><dd>{review.ret.artifacts ?? NONE}</dd><dt>Evidence</dt><dd>{review.ret.evidence ?? NONE}</dd>
                <dt>Receipt</dt><dd>{review.ret.receiving === undefined ? NONE : review.ret.receiving ? 'linked' : 'not linked'}</dd></dl></>}
        {r.pending && <div data-wait="true">{shorts(r.pending)} waits for you to confirm that it stands.</div>}
        {r.differs !== undefined && <dl><dt>Differs from {shorts(r.cmp)}</dt><dd>{r.differs} {r.differs === 1 ? 'task' : 'tasks'}</dd></dl>}
      </aside>
    </div>
    <div className="ar-foot" aria-live="polite">
      {chosen
        ? <><b>{chosen.t.title ?? NONE}</b><span>{shorts(chosen.a)}</span><span>{WORD[chosen.t.state]}</span><span>{chosen.t.agent ?? chosen.a.agent ?? NONE}</span>
          <span>{minutes(chosen.t.t0)} to {minutes(chosen.t.seen)}</span><span>{chosen.a.session ? `session ${chosen.a.session}` : 'no session read'}</span><span>The log opens in Clip view.</span></>
        : <span>{picked === undefined ? 'Select a task and its log opens in Clip view.' : 'No reading of the selected task.'}</span>}
    </div>
  </div>
}

// ---------------------------------------------------------------- the widget

function taskRows(a: Attempt | undefined, show: string | undefined): RowItem[] {
  return a ? treeOf(a.tasks, show).map(row => ({id: row.task.id, name: `${'· '.repeat(Math.min(row.depth, 2))}${cut(row.task.title ?? NONE, 22 - row.depth * 2)}`, light: LIGHT[row.task.state], tone: TONE[row.task.state],
    note: row.task.seen !== undefined ? `${Math.round(row.task.seen)}m` : undefined, does: WORD[row.task.state]})) : []
}

// ---------------------------------------------------------------- the device

// The sample material of the gallery (the Thread's own piece of work, tried three times). The views never read these constants: the
// owner's material arrives on `works` and `attempts`.
const WORKS = JSON.stringify([
  {id: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAA', name: 'Type-check the three roots'},
  {id: 'run:01ARZ3NDEKTSV4RRFFQ69G5FCB', name: 'Model row on the agent device'},
])
const roots = (n: number, states: [State, State, State, State, State], seen: [number, number, number, number, number, number]) => [
  {id: `${n}.1`, title: 'Read the agent context', state: states[0], agent: 'Flint', t0: 0, seen: seen[0]},
  {id: `${n}.2`, title: 'tsc packages/live-shell/ui', state: states[1], agent: 'Flint', t0: seen[0], seen: seen[1]},
  {id: `${n}.3`, title: 'tsc desktop/cradle', state: states[2], agent: 'Flint', ...(states[2] === 'queued' ? {} : {t0: seen[1], seen: seen[2]})},
  {id: `${n}.4`, title: 'expressions-app root', state: states[3], agent: 'Kite', ...(states[3] === 'queued' ? {} : {t0: seen[0] + 5, seen: seen[3]})},
  {id: `${n}.4.1`, title: 'Read its tsconfig', state: states[3] === 'queued' ? 'queued' : 'done', parent: `${n}.4`, agent: 'Kite', ...(states[3] === 'queued' ? {} : {t0: seen[0] + 5, seen: seen[0] + 8})},
  {id: `${n}.4.2`, title: 'tsc expressions-app', state: states[4], parent: `${n}.4`, agent: 'Kite', ...(states[4] === 'queued' ? {} : {t0: seen[0] + 8, seen: seen[5]})},
]
const SAMPLE_ATTEMPTS = JSON.stringify([
  {id: '1', n: 1, state: 'failed', agent: 'Flint', session: 'tsc', day: '14 Oct', at: '09:40', seen: 11,
    tasks: roots(1, ['done', 'failed', 'queued', 'queued', 'queued'], [3, 11, 11, 3, 3, 3])},
  {id: '2', n: 2, state: 'done', agent: 'Kite', session: 'tsc-kite', day: '14 Oct', at: '14:05', seen: 23,
    ret: {summary: 'All three roots type-check. One import repaired in AgentShellContext.', artifacts: 2, evidence: 3, receiving: false},
    tasks: roots(2, ['done', 'done', 'done', 'done', 'done'], [2, 9, 15, 23, 23, 23])},
  {id: '3', n: 3, state: 'running', agent: 'Flint', session: 'tsc', day: '15 Oct', at: '10:12', seen: 34, current: true,
    tasks: roots(3, ['done', 'running', 'queued', 'running', 'stalled'], [3, 34, 34, 34, 34, 21])},
])

export const design: DesignedDevice = {
  id: 'software-factory:attempt-review',
  title: 'Runs',
  kind: 'instrument',
  defaults: {
    light: 'lit', work: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAA', attempt: '3', show: 'all', group: 'attempt', view: 'tree', compare: 'none', stands: 'none', task: '3.4.2',
    // The owner's material: the pieces of work to choose from, and the attempts of the one shown (JSON).
    works: WORKS, attempts: SAMPLE_ATTEMPTS,
  },
  fixtures: {
    'Review waiting': {compare: '2', standsPending: '2'},
    'Ruler, one stands': {compare: '2', stands: '2', view: 'ruler', group: 'agent', show: 'stalled'},
    'No readings': Object.fromEntries(['light', 'work', 'attempt', 'show', 'group', 'view', 'compare', 'stands', 'standsPending', 'task', 'works', 'attempts'].map(k => [k, undefined])),
  },

  folded: p => { const r = read(p), name = workName(p.v); return <Folded title="Runs" light={light(p)} readings={[name === undefined ? NONE : cut(name, 10), r.attempts ? `${r.attempts.length} attempts` : NONE]} onUnfold={p.nav.unfold} /> },

  compact: p => {
    const r = read(p)
    return <Panel title="Runs" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <RunWell p={p} r={r} live w={140} h={146} size="compact" />
      </Section>
      <Section label="Macros" width={112}>
        {attemptChooser(p, r, false, true)}
        {compareChooser(p, r, false, true)}
        {showChooser(p, true)}
        {groupChooser(p, true)}
      </Section>
    </Panel>
  },

  whole: p => {
    const r = read(p)
    const rows: RowItem[] = ordered(r.attempts ?? [], strOf(p.v, 'group')).map(a => ({
      id: a.id, name: [groupKey(a, strOf(p.v, 'group')), `#${a.n}`, strOf(p.v, 'group') === 'attempt' || strOf(p.v, 'group') === undefined ? a.agent : undefined].filter(Boolean).join(' · '),
      light: LIGHT[a.state], tone: TONE[a.state], note: a.id === r.standsId ? 'stands' : a.current ? 'current' : a.at, does: `${WORD[a.state]}${a.day ? `, ${a.day}` : ''}`,
    }))
    const target = r.pending ?? r.me
    return <Panel title="Runs" view="whole" {...head(p)}>
      <Band>
        <Section width={206}>
          <RunWell p={p} r={r} live w={194} h={146} size="whole" />
        </Section>
        <Section label="Work" width={100}>
          {workChooser(p)}
          {attemptChooser(p, r, true)}
          <Readout label="state" does="How the attempt you read stands." value={r.me ? WORD[r.me.state] : undefined} tone={r.me ? TONE[r.me.state] : undefined} />
        </Section>
        <Section label="Display" grow>
          {viewRadio(p)}
          {showChooser(p)}
          {groupChooser(p)}
        </Section>
      </Band>
      <Band>
        <Section label="Attempts" width={190}>
          <Rows does="Choose the attempt you read. A light shows how it stands." items={rows} size={6} selected={r.me?.id}
            onSelect={st(p, 'attempt').disabled ? undefined : id => p.set('attempt', id)} />
        </Section>
        <Section label="Review" cols={3} grow>
          {compareChooser(p, r, false)}
          {standsChooser(p, r)}
          <Readout label="differs" does="Tasks of the attempt you read that stand differently in the one you compare." value={r.differs} />
          <Consent p={p} r={r} />
          <Readout label="return" does="Artifacts and evidence in the Return of the attempt you review." value={target?.ret ? `${target.ret.artifacts ?? NONE}·${target.ret.evidence ?? NONE}` : undefined} />
          <Readout label="receipt" does="Whether Central has linked a receipt to the Return. A receipt is not your acceptance." value={target?.ret?.receiving === undefined ? undefined : target.ret.receiving ? 'linked' : 'not linked'} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <RunsPane p={p} />,

  widget: p => {
    const r = read(p), a = r.latest, items = taskRows(a, undefined), done = a?.tasks.filter(t => t.state === 'done').length
    return <Tile title={`Runs · ${shorts(a) ?? NONE}`} light={light(p)} span={2} onFull={p.nav.full}>
      <div className="ar-tile-list">
        {r.attempts === undefined
          ? <p style={{margin: 0, font: '10.5px var(--font-ui, sans-serif)', color: 'var(--text-dim)'}}>No reading of the attempts.</p>
          : <Rows label="Latest attempt" does="The tasks of the latest attempt, a light on each." items={items} size={5} />}
      </div>
      <div className="ar-tile-side">
        <Readout label="state" does="How the latest attempt stands." value={a ? WORD[a.state] : undefined} tone={a ? TONE[a.state] : undefined} />
        <Readout label="done" does="Tasks done of the tasks of the latest attempt." value={a ? `${done}/${a.tasks.length}` : undefined} />
        <Readout label="attempts" does="Attempts made on this work." value={r.attempts?.length} />
      </div>
    </Tile>
  },
}
