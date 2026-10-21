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
//
// Journey (View): the work you read is one Run of a Journey, and the Journey's Runs stand one after another, each with its attempts and
// whether you recognised its return. `journey` is JSON {purpose, status, runs: [{ref, name?, lifecycle?, attempts?, recognised?}]}: purpose
// is the Commission's (commission.purpose), status proposed | active | paused | completed | abandoned, runs in the order Factory continued
// them (factory.journey-reading/v1 runRefs and recognitions; factory.commission-reading/v1 traversal `continued-from`; read by
// factory_development_read `journey` and `commission-read`, which exist). A run's ref is a `work` id.
// Review (a page of Whole, and the Return beside the list in Full): what you read before you confirm Stands. An attempt's `ret` also
// carries `criteria` [{text, state?}] (the bounded intent's success conditions and their evaluation, satisfied | unsatisfied |
// indeterminate: factory/src/project_development.rs:61, which no route reads yet), `claims` [{statement, status, evidence}] (the build
// view's Claims with the count of their evidence: factory/src/build.rs:19, factory_build_snapshot, which exists) and `requests`
// [{question, why}] (its HumanRequests: build.rs:66 question, whyHuman). Stands is confirmed through factory_owner AttemptReceiving
// (kernel factory.rs:373), which exists.
import {Fragment, type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Lamp, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, clampTo, has, json, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {TakesGrove, type Take} from '../faces/TakesGrove'
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
type Verdict = 'satisfied' | 'unsatisfied' | 'indeterminate'
const VERDICTS: readonly Verdict[] = ['satisfied', 'unsatisfied', 'indeterminate']
const VERDICT_WORD: Readonly<Record<Verdict, string>> = {satisfied: 'met', unsatisfied: 'not met', indeterminate: 'open'}
interface Criterion { readonly text: string; readonly state?: Verdict }
interface Claim { readonly statement: string; readonly status?: string; readonly evidence?: number }
interface Request { readonly question: string; readonly why?: string }
interface Return {
  readonly summary?: string; readonly artifacts?: number; readonly evidence?: number; readonly receiving?: boolean
  /** Undefined where the owner reports none of them (not the same as an empty list). */
  readonly criteria?: readonly Criterion[]; readonly claims?: readonly Claim[]; readonly requests?: readonly Request[]
}
const listOf = <T,>(raw: unknown, each: (o: Record<string, unknown>) => T | undefined): T[] | undefined =>
  Array.isArray(raw) ? objects(raw).flatMap(o => { const x = each(o); return x === undefined ? [] : [x] }) : undefined
/** The return across the conditions, by the owner's law (project_development.rs:407-433); undefined until each has a state. */
const verdictOf = (list: readonly Criterion[] | undefined): Verdict | undefined =>
  !list?.length || list.some(c => !c.state) ? undefined : list.some(c => c.state === 'unsatisfied') ? 'unsatisfied' : list.some(c => c.state === 'indeterminate') ? 'indeterminate' : 'satisfied'
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
      ret: r ? {summary: word(r.summary), artifacts: count(r.artifacts), evidence: count(r.evidence), receiving: typeof r.receiving === 'boolean' ? r.receiving : undefined,
        criteria: listOf(r.criteria, c => (word(c.text) ? {text: word(c.text)!, state: VERDICTS.find(x => x === c.state)} : undefined)),
        claims: listOf(r.claims, c => (word(c.statement) ? {statement: word(c.statement)!, status: word(c.status), evidence: count(c.evidence)} : undefined)),
        requests: listOf(r.requests, q => (word(q.question) ? {question: word(q.question)!, why: word(q.why)} : undefined))} : undefined})
  })
  return list.sort((a, b) => a.n - b.n)
}

const workName = (v: V): string | undefined => {
  const id = strOf(v, 'work')
  if (id === undefined) return undefined
  return word(objects(json<unknown>(v, 'works', [])).find(o => o.id === id)?.name) ?? id
}

// ---------------------------------------------------------------- the Journey the work belongs to

const LIFE_WORD: Readonly<Record<string, string>> = {
  seeded: 'seeded', active: 'at work', waiting_human: 'waits for you', suspended: 'suspended', finishing: 'finishing', finished: 'finished', aborted: 'aborted', archived: 'archived',
}
interface JourneyRun { readonly ref: string; readonly name?: string; readonly lifecycle?: string; readonly attempts?: number; readonly recognised: boolean }
interface Journey { readonly purpose?: string; readonly status?: string; readonly runs: readonly JourneyRun[] }
const journeyOf = (v: V): Journey | undefined => {
  const o = json<unknown>(v, 'journey', undefined)
  if (!o || typeof o !== 'object' || Array.isArray(o)) return undefined
  const j = o as Record<string, unknown>
  return {purpose: word(j.purpose), status: word(j.status), runs: objects(j.runs).flatMap(x => (word(x.ref) ? [{ref: word(x.ref)!, name: word(x.name), lifecycle: word(x.lifecycle), attempts: count(x.attempts), recognised: x.recognised === true}] : []))}
}
const LIFE_INK: Readonly<Record<string, string>> = {active: 'var(--dp-value)', finishing: 'var(--dp-on)', finished: 'var(--green)', archived: 'var(--green)', waiting_human: 'var(--stall)'}

/** The Journey in the well: its runs left to right in the order Factory continued them, each a block in the colour of its lifecycle, the
 * run you read ringed, a gold diamond under each run you recognised. */
function JourneyMarks({v, w, y}: {v: V; w: number; y: number}): ReactNode {
  const j = journeyOf(v), me = strOf(v, 'work')
  if (!j) return <text x={7} y={y + 14} className="dp-axis">No reading of the Journey</text>
  if (!j.runs.length) return <text x={7} y={y + 14} className="dp-axis">The Journey has no run yet</text>
  const step = (w - 24) / Math.max(1, j.runs.length - 1 || 1), shown = j.runs.slice(-6), at = (i: number) => (shown.length === 1 ? w / 2 : 12 + i * (w - 24) / (shown.length - 1))
  return <g>
    <text x={7} y={y + 8} className="dp-axis">{`journey · ${j.status ?? NONE}`}</text>
    {shown.map((x, i) => i > 0 && <path key={`l${x.ref}`} d={`M${at(i - 1) + 6} ${y + 30}H${at(i) - 6}`} className="dp-faint" />)}
    {shown.map((x, i) => {
      const ink = LIFE_INK[x.lifecycle ?? ''] ?? 'var(--text-faint)', mine = x.ref === me, gone = x.lifecycle === 'aborted'
      return <g key={x.ref} opacity={gone ? 0.45 : 1} data-i={`${x.name ?? x.ref}|${x.lifecycle ? LIFE_WORD[x.lifecycle] ?? x.lifecycle : 'No reading of its lifecycle'}${x.attempts !== undefined ? `, ${x.attempts} attempts` : ''}${x.recognised ? ', recognised' : ''}.`}>
        <rect x={at(i) - 5} y={y + 25} width={10} height={10} rx={1.5} fill={x.lifecycle === 'finished' || x.lifecycle === 'archived' ? ink : 'var(--dp-well)'} stroke={ink} strokeWidth={1.2} />
        {mine && <rect x={at(i) - 8} y={y + 22} width={16} height={16} rx={2} fill="none" stroke="var(--sel, #7ec3e6)" />}
        {x.recognised && <path d={`M${at(i)} ${y + 41}l3.5 3.5l-3.5 3.5l-3.5 -3.5z`} fill="var(--dp-on)" />}
        <text x={shown.length > 1 && i === 0 ? at(i) - 5 : shown.length > 1 && i === shown.length - 1 ? at(i) + 5 : at(i)} y={y + 60}
          textAnchor={shown.length > 1 && i === 0 ? 'start' : shown.length > 1 && i === shown.length - 1 ? 'end' : 'middle'} className="dp-axis">{cut(x.name ?? x.ref, Math.max(4, Math.floor(Math.min(step, 60) / 4.6)))}</text>
      </g>
    })}
  </g>
}

// ---------------------------------------------------------------- the reading the views share

const groupKey = (a: Attempt, group: string | undefined): string | undefined => (group === 'agent' ? a.agent ?? NONE : group === 'day' ? a.day ?? NONE : undefined)

/** The attempts as takes, oldest first: a retry is a new take and the earlier one stays. The attempt that stands is marked. */
const takesOf = (attempts: readonly Attempt[], standsId: string | undefined): Take[] => attempts.map(a => ({id: a.id, label: `#${a.n}`,
  state: a.state === 'done' ? 'done' : a.state === 'failed' ? 'failed' : a.state === 'queued' || a.state === 'unknown' ? 'queued' : 'running', stands: a.id === standsId}))

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
const atWork = (p: ViewProps) => light(p) === 'lit' && read(p).latest?.state === 'running'
const head = (p: ViewProps) => ({light: light(p), busy: atWork(p), onFold: p.nav.fold, onFull: p.nav.full})
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
  {value: 'grove', label: 'Grove', does: 'One tree for each attempt: it grows while it runs, bears fruit when it finishes, and comes down when it fails.'},
  {value: 'journey', label: 'Journey', does: 'The runs of the Journey this work belongs to, one after another, each with its attempts and whether you recognised it.'},
]

const SAYS = {
  work: 'The piece of work whose attempts the device lists. It follows the selected session.',
  attempt: 'The attempt you read. The latest is the default.',
  show: 'Which tasks show: all, or only those running, queued, stalled, failed or done.',
  group: 'How the attempts group: by attempt, by agent or by day.',
  view: 'Tree: tasks as nested rows. Ruler: attempts along one ruler of elapsed time. Grove: one tree for each attempt. Journey: the runs of the Journey this work belongs to.',
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
    onChange={x => { if (x === 'none') { p.set('stands', 'none'); p.set('standsPending', undefined) } else if (x !== strOf(p.v, 'stands')) { p.set('standsPending', x); p.setPage('review') } else p.set('standsPending', undefined) }} />
}
const Consent = ({p, r}: {p: ViewProps; r: Reading}) => {
  if (strOf(p.v, 'standsPending') === undefined) return null
  return <>
    <Action {...st(p, 'stands')} hold label="Confirm" does={`${SAYS.confirm} Reads #${r.pending?.n ?? NONE}.`} onPress={() => { p.set('stands', strOf(p.v, 'standsPending')); p.set('standsPending', undefined) }} />
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
    {whole && strOf(v, 'view') === 'journey' && <><path d={`M0 66H${w}`} className="dp-faint" /><JourneyMarks v={v} w={w} y={70} /></>}
    {whole && !ruler && strOf(v, 'view') !== 'journey' && <>
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
  const r = read(p), v = p.v, ruler = strOf(v, 'view') === 'ruler', grove = strOf(v, 'view') === 'grove', group = strOf(v, 'group'), show = strOf(v, 'show'), picked = strOf(v, 'task')
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
      {strOf(v, 'view') === 'journey' ? <JourneyList v={v} /> : grove ? <div className="ar-list ar-grove" data-view="grove" aria-label="Attempts, one tree for each">
        {list === undefined && <p className="ar-none">No reading of the attempts.</p>}
        {list !== undefined && list.length === 0 && <p className="ar-none">This work has no attempt yet.</p>}
        {list && list.length > 0 && <TakesGrove takes={takesOf(r.attempts ?? [], r.standsId)} width={list.length > 4 ? 112 : 140} />}
      </div> : <div className="ar-list" data-view={ruler ? 'ruler' : 'tree'} role="tree" aria-label="Attempts">
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
      </div>}
      <aside className="ar-side" aria-label="Review">
        <h4>Review · {shorts(review) ?? NONE}</h4>
        {review === undefined ? <p>No attempt to review.</p>
          : review.ret === undefined ? <p>No Return recorded for {shorts(review)}. The provider's answer is not a finished task.</p>
            : <><p className="ar-summary">{review.ret.summary ?? NONE}</p>
              <p className="ar-facts">{`${review.ret.artifacts ?? NONE} artefacts · ${review.ret.evidence ?? NONE} evidence · receipt ${review.ret.receiving === undefined ? NONE : review.ret.receiving ? 'linked' : 'not linked'}`}</p></>}
        {review?.ret && <ReviewLists ret={review.ret} />}
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

/** The review beside the list: the success conditions with their return, the claims with their evidence, and what waits on you. */
function ReviewLists({ret}: {ret: Return}) {
  const verdict = verdictOf(ret.criteria)
  return <>
    <h5>Conditions · {verdict ? VERDICT_WORD[verdict] : ret.criteria === undefined ? NONE : 'not returned'}</h5>
    {ret.criteria === undefined ? <p className="ar-none">No reading of the success conditions.</p>
      : <ul className="ar-review">{ret.criteria.map((c, i) => <li key={i} data-state={c.state}><i /><span>{c.text}</span><small>{c.state ? VERDICT_WORD[c.state] : ''}</small></li>)}</ul>}
    <h5>Claims</h5>
    {ret.claims === undefined ? <p className="ar-none">No reading of the claims.</p>
      : <ul className="ar-review">{ret.claims.map((c, i) => <li key={i} data-state={c.evidence ? 'evidenced' : 'bare'}><i /><span>{c.statement}</span><small>{c.evidence ? `${c.evidence} evidence` : 'no evidence'}</small></li>)}</ul>}
    {!!ret.requests?.length && <><h5>Waits on you</h5>
      <ul className="ar-review">{ret.requests.map((q, i) => <li key={i} data-state="request"><i /><span>{q.question}</span><small>{q.why ?? ''}</small></li>)}</ul></>}
  </>
}

/** The Journey at pane size: its Commission's purpose, then its runs in the order Factory continued them, the one you read marked. */
function JourneyList({v}: {v: V}) {
  const j = journeyOf(v), me = strOf(v, 'work')
  return <div className="ar-list ar-journey" data-view="journey" aria-label="The Journey's runs">
    {!j ? <p className="ar-none">No reading of the Journey.</p> : <>
      <p className="ar-purpose"><small>For</small>{j.purpose ?? NONE}<em>{j.status ?? NONE}</em></p>
      <ol>
        {j.runs.map(x => <li key={x.ref} data-life={x.lifecycle} data-me={x.ref === me || undefined}>
          <i /><b>{x.name ?? x.ref}</b><span>{x.lifecycle ? LIFE_WORD[x.lifecycle] ?? x.lifecycle : NONE}</span>
          <span>{x.attempts === undefined ? NONE : `${x.attempts} ${x.attempts === 1 ? 'attempt' : 'attempts'}`}</span>
          {x.recognised ? <em>recognised</em> : <small>{x.ref === me ? 'you read this run' : ''}</small>}
        </li>)}
      </ol>
    </>}
  </div>
}

// ---------------------------------------------------------------- the widget

function taskRows(a: Attempt | undefined, show: string | undefined): RowItem[] {
  return a ? treeOf(a.tasks, show).map(row => ({id: row.task.id, name: `${'· '.repeat(Math.min(row.depth, 2))}${cut(row.task.title ?? NONE, 22 - row.depth * 2)}`, light: LIGHT[row.task.state], tone: TONE[row.task.state], busy: row.task.state === 'running',
    note: row.task.seen !== undefined ? `${Math.round(row.task.seen)}m` : undefined, does: WORD[row.task.state]})) : []
}

// ---------------------------------------------------------------- the Review page of Whole

/** The review well: the success conditions with their return, then the claims, each with a tick for each piece of its evidence. */
function ReviewWell({ret, n, w, h}: {ret: Return | undefined; n: number | undefined; w: number; h: number}) {
  const verdict = verdictOf(ret?.criteria), conds = ret?.criteria?.slice(0, 5) ?? [], claims = ret?.claims?.slice(0, 5) ?? []
  const cy = 30, ky = cy + Math.max(1, conds.length) * 11 + 18
  const ink = (c: Verdict | undefined) => (c === 'satisfied' ? 'var(--green)' : c === 'unsatisfied' ? 'var(--stall)' : 'var(--text-faint)')
  return <Display w={w} h={h} label="The review" corner={n === undefined ? NONE : `#${n}${verdict ? ` ${VERDICT_WORD[verdict]}` : ''}`}
    does="What the attempt returned against what it was for: each success condition with its return, each claim with its evidence.">
    {ret === undefined && <text x={7} y={24} className="dp-axis">{n === undefined ? 'No attempt to review' : 'No Return recorded'}</text>}
    {ret && <>
      <text x={7} y={22} className="dp-axis">{ret.criteria === undefined ? 'conditions —' : 'conditions'}</text>
      {conds.map((c, i) => <g key={i}>
        <circle cx={11} cy={cy + i * 11 + 3} r={2.6} fill={c.state === 'satisfied' ? ink(c.state) : 'none'} stroke={ink(c.state)} strokeWidth={1.1} />
        {c.state === 'unsatisfied' && <path d={`M8.5 ${cy + i * 11 + 0.5}l5 5m0 -5l-5 5`} stroke="var(--stall)" strokeWidth={1} />}
        <text x={19} y={cy + i * 11 + 6} className="dp-axis" style={{fill: 'var(--text-dim)'}}>{cut(c.text, Math.floor((w - 24) / 4.5))}</text>
      </g>)}
      <path d={`M0 ${ky - 10}H${w}`} className="dp-faint" />
      <text x={7} y={ky} className="dp-axis">{ret.claims === undefined ? 'claims —' : 'claims'}</text>
      {claims.map((c, i) => <g key={i}>
        {Array.from({length: Math.min(4, c.evidence ?? 0)}, (_, k) => <rect key={k} x={7 + k * 3} y={ky + 4 + i * 11} width={2} height={6} fill="var(--dp-value)" />)}
        {!c.evidence && <rect x={7} y={ky + 4 + i * 11} width={8} height={6} fill="none" stroke="var(--text-faint)" strokeDasharray="1.5 1.5" />}
        <text x={21} y={ky + 10 + i * 11} className="dp-axis" style={{fill: 'var(--text-dim)'}}>{cut(c.statement, Math.floor((w - 26) / 4.5))}</text>
      </g>)}
    </>}
  </Display>
}

function ReviewPage({p, r}: {p: ViewProps; r: Reading}) {
  const target = r.pending ?? r.me, ret = target?.ret, conds = ret?.criteria, verdict = verdictOf(conds)
  return <>
    <Band>
      <Section width={206}><ReviewWell ret={ret} n={target?.n} w={194} h={146} /></Section>
      <Section label="Stands" width={112}>
        {standsChooser(p, r)}
        <Consent p={p} r={r} />
        <Readout label="reviewing" does="The attempt you review: the one waiting to stand, or the one you read." value={shorts(target)} />
      </Section>
      <Section label="Return" cols={3} grow>
        <Readout big label="intent" does="Across the success conditions: not met if one is not met, open if one is open, met when all are met." value={verdict ? VERDICT_WORD[verdict] : conds ? 'not returned' : undefined}
          tone={verdict === 'satisfied' ? 'green' : verdict === 'unsatisfied' ? 'stall' : undefined} />
        <Readout label="conditions" does="Success conditions met, of all of them." value={conds ? `${conds.filter(c => c.state === 'satisfied').length}/${conds.length}` : undefined} />
        <Readout label="claims" does="Claims that carry evidence, of all the claims the attempt makes." value={ret?.claims ? `${ret.claims.filter(c => c.evidence).length}/${ret.claims.length}` : undefined} />
        <Readout label="requests" does="Questions the run waits on you to answer before it goes on." value={ret?.requests?.length} tone={ret?.requests?.length ? 'stall' : undefined} />
        <Readout label="return" does="Artifacts and evidence in the Return of the attempt you review." value={ret ? `${ret.artifacts ?? NONE}·${ret.evidence ?? NONE}` : undefined} />
        <Readout label="receipt" does="Whether Central has linked a receipt to the Return. A receipt is not your acceptance." value={ret?.receiving === undefined ? undefined : ret.receiving ? 'linked' : 'not linked'} />
      </Section>
    </Band>
  </>
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
    ret: {summary: 'All three roots type-check. One import repaired in AgentShellContext.', artifacts: 2, evidence: 3, receiving: false,
      criteria: [{text: 'Each root type-checks with no error', state: 'satisfied'}, {text: 'No file outside the shell changes', state: 'satisfied'}, {text: 'The widget tests still pass', state: 'indeterminate'}],
      claims: [{statement: 'tsc reports 0 errors in all three roots', status: 'supported', evidence: 3}, {statement: 'The import fix is the only change', status: 'supported', evidence: 1},
        {statement: 'The widget tests are untouched', status: 'proposed', evidence: 0}],
      requests: [{question: 'Run the widget tests before this stands?', why: 'Only you can spend the minutes on the shared seat.'}]},
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
    journey: JSON.stringify({purpose: 'Keep the three TypeScript roots type-checking', status: 'active', runs: [
      {ref: 'run:01ARZ3NDEKTSV4RRFFQ69G5F9Z', name: 'First pass', lifecycle: 'finished', attempts: 1, recognised: true},
      {ref: 'run:01ARZ3NDEKTSV4RRFFQ69G5FCB', name: 'Model row on the agent device', lifecycle: 'aborted', attempts: 2},
      {ref: 'run:01ARZ3NDEKTSV4RRFFQ69G5FAA', name: 'Type-check the three roots', lifecycle: 'active', attempts: 3}]}),
  },
  firstPage: 'runs',
  fixtures: {
    'Review waiting': {compare: '2', standsPending: '2'},
    'Ruler, one stands': {compare: '2', stands: '2', view: 'ruler', group: 'agent', show: 'stalled'},
    'Grove, one stands': {stands: '2', view: 'grove'},
    'Its Journey': {view: 'journey', stands: '2'},
    'No readings': Object.fromEntries(['light', 'work', 'attempt', 'show', 'group', 'view', 'compare', 'stands', 'standsPending', 'task', 'works', 'attempts', 'journey'].map(k => [k, undefined])),
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
      light: LIGHT[a.state], tone: TONE[a.state], busy: a.state === 'running', note: a.id === r.standsId ? 'stands' : a.current ? 'current' : a.at, does: `${WORD[a.state]}${a.day ? `, ${a.day}` : ''}`,
    }))
    const target = r.pending ?? r.me
    const pages = [{id: 'runs', label: 'Runs'}, {id: 'review', label: 'Review', light: (r.pending ? 'lit' : 'unknown') as LightState}]
    if (p.page === 'review') return <Panel title="Runs" view="whole" {...head(p)} pages={pages} page="review" onPage={p.setPage}><ReviewPage p={p} r={r} /></Panel>
    return <Panel title="Runs" view="whole" {...head(p)} pages={pages} page="runs" onPage={p.setPage}>
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
    return <Tile title={`Runs · ${shorts(a) ?? NONE}`} light={light(p)} busy={atWork(p)} span={2} onFull={p.nav.full}>
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
