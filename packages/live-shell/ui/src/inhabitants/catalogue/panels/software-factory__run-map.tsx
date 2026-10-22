// The Run map (manual §19.25, software-factory:run-map): one Run of developmental work as the graph Factory keeps of it: its units,
// what each waits on, the barriers that gather them, the decision and the candidate they lead to, and where the Run's own lifecycle
// stands; beside it the Run's Recognition, and the Commission and Journey the Run belongs to. Live's nearest: a rack's chain list
// drawn as a signal flow, as Max for Live draws a patch: you read left to right what feeds what. An instrument on Factory's Main track:
// a Run spans every session of the set, as the Main track does.
//
// The picture is Factory's own RunMap (factory/src/core/run/topology.rs:114 RunMap {nodes, edges}; :96 TopologyNode {id, kind, label,
// state, semanticRef}). A node's kind is destination | position | work | decision | candidate | gate | authority | nested_run; only
// work and position nodes carry a state: planned | ready | active | blocked | waiting | satisfied | returned | superseded | abandoned.
// An edge is {from, to, relation}: `requires` (from waits on to; acyclic), branches_to, returns_to, nests, converges_to, realises,
// supersedes. A workflow unit is a work node `work-<key>`; a barrier is a gate node `barrier-<key>` that requires each unit it waits
// for and is required by each unit it releases (factory/src/workflow.rs:485-580). The map lays each node one column right of everything
// it requires, and right of what returns or converges into it; nests is drawn dashed and moves nothing.
//
// Keys, all from the owner unless named the shell's:
// - `run`: {ref, name, lifecycle, revision}. lifecycle is seeded | active | waiting_human | suspended | finishing | finished | aborted |
//   archived (factory/src/core/run/model.rs:36 RunLifecycle; factory.run-reading/v1 lifecycle, read by factory_development_read `run`).
// - `nodes`: rows of {id, kind, label, state?, concern?, leg?, custody?, waits?}. leg is the unit's execution {status, attempts,
//   allowed, spent}: status is the LegStatus (orchestration.rs:91 active | detached | cancel_requested | cancellation_accepted |
//   process_terminated | quiescent | returned | failed | late_result), allowed and spent its RetryGrant (orchestration.rs:60). custody is
//   {position, state} (work_custody.rs:142, state in-progress | blocked | released | completed | handed-off). waits, on a gate, is the
//   units it still waits for (workflow inspect barriers[].notReturned). From factory_owner WorkflowInspect (legs, barriers, attempts)
//   and the run reading's runMap.
// - `edges`: rows of {from, to, relation}, as above.
// - `ret`: the Run's latest Return, {ref, summary}: the subject you recognise (factory.journey-reading/v1 returns[].return_ref).
// - `recognition`: the Recognition of that Return, {ref, at}, absent until you give it (journey reading recognitions[]).
// - `journey`: the Journey (manual §19.25: the work as it goes on across runs; Factory names it a Journey), {ref, purpose, status, runs:
//   [{ref, name, lifecycle, recognised?}]}. purpose is the Commission's (commission.purpose); status proposed | active | paused |
//   completed | abandoned; runs in the order Factory continued them (commission-read traversal `continued-from`, continuationRunRefs;
//   factory_development_read `journey`, `commission-read`).
// - The shell's: `unit` (the node you read), `show` ('all' · 'open' · 'done').
// Recognition is given in Approvals (§19.14): Recognise, Close and Continue stand there, and the map reads only the return and whether
// you recognised it. The one write here is `retry`: the attempt operation `retry` under the unit's RetryGrant (attempt_runtime.rs). No
// kernel op carries it: the binding stands it disabled with that reason.
import {type ReactNode} from 'react'
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, type LightState, type Option, type Tone} from '../../sdk/panel'
import {NONE, clampTo, grown, has, json, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './software-factory__run-map.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- the owner's rows, read safely

const KINDS = ['destination', 'position', 'work', 'decision', 'candidate', 'gate', 'authority', 'nested_run'] as const
type Kind = (typeof KINDS)[number]
const STATES = ['planned', 'ready', 'active', 'blocked', 'waiting', 'satisfied', 'returned', 'superseded', 'abandoned'] as const
type State = (typeof STATES)[number]
const LIFECYCLES = ['seeded', 'active', 'waiting_human', 'suspended', 'finishing', 'finished', 'aborted', 'archived'] as const
type Lifecycle = (typeof LIFECYCLES)[number]

const STATE_WORD: Readonly<Record<State, string>> = {
  planned: 'planned', ready: 'ready', active: 'at work', blocked: 'blocked', waiting: 'waits for you', satisfied: 'met', returned: 'returned', superseded: 'replaced', abandoned: 'dropped',
}
const STATE_SAYS: Readonly<Record<State, string>> = {
  planned: 'Waits on work before it.', ready: 'Everything it waits on is there; it can start.', active: 'An agent works on it now.',
  blocked: 'It cannot go on until what blocks it clears.', waiting: 'It waits for your decision.', satisfied: 'Its condition is met.',
  returned: 'It has returned its work.', superseded: 'Later work replaced it.', abandoned: 'The run dropped it.',
}
const LIFE_WORD: Readonly<Record<Lifecycle, string>> = {
  seeded: 'seeded', active: 'at work', waiting_human: 'waits for you', suspended: 'suspended', finishing: 'finishing', finished: 'finished', aborted: 'aborted', archived: 'archived',
}
const LIFE_TONE: Readonly<Partial<Record<Lifecycle, Tone>>> = {active: 'value', waiting_human: 'stall', finishing: 'accent', finished: 'green'}
const KIND_WORD: Readonly<Record<Kind, string>> = {
  destination: 'Destination', position: 'Position', work: 'Unit', decision: 'Decision', candidate: 'Candidate', gate: 'Barrier', authority: 'Authority', nested_run: 'Nested run',
}

const word = (x: unknown): string | undefined => (typeof x === 'string' && x.length > 0 ? x : undefined)
const count = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined)
const objects = (raw: unknown): Record<string, unknown>[] => (Array.isArray(raw) ? raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)) : [])
const object = (raw: unknown): Record<string, unknown> | undefined => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : undefined)
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)

interface Leg {readonly status?: string; readonly attempts?: number; readonly allowed?: number; readonly spent?: number}
interface Node {
  readonly id: string
  readonly kind: Kind
  readonly label: string
  readonly state?: State
  readonly concern?: string
  readonly leg?: Leg
  readonly custody?: {readonly position?: string; readonly state?: string}
  readonly waits?: readonly string[]
}
interface Edge {readonly from: string; readonly to: string; readonly relation: string}

function nodesOf(v: V): Node[] | undefined {
  const raw = json<unknown>(v, 'nodes', undefined)
  if (!Array.isArray(raw)) return undefined
  return objects(raw).flatMap((o): Node[] => {
    const id = word(o.id), kind = KINDS.find(k => k === o.kind)
    if (!id || !kind) return []
    const leg = object(o.leg), custody = object(o.custody)
    return [{id, kind, label: word(o.label) ?? id, state: STATES.find(s => s === o.state), concern: word(o.concern),
      leg: leg ? {status: word(leg.status), attempts: count(leg.attempts), allowed: count(leg.allowed), spent: count(leg.spent)} : undefined,
      custody: custody ? {position: word(custody.position), state: word(custody.state)} : undefined,
      waits: Array.isArray(o.waits) ? o.waits.filter((x): x is string => typeof x === 'string') : undefined}]
  })
}
const edgesOf = (v: V): Edge[] => objects(json<unknown>(v, 'edges', [])).flatMap(o => { const from = word(o.from), to = word(o.to), relation = word(o.relation); return from && to && relation ? [{from, to, relation}] : [] })

interface Run {readonly ref?: string; readonly name?: string; readonly lifecycle?: Lifecycle}
const runOf = (v: V): Run | undefined => { const o = object(json<unknown>(v, 'run', undefined)); return o ? {ref: word(o.ref), name: word(o.name), lifecycle: LIFECYCLES.find(l => l === o.lifecycle)} : undefined }
interface JourneyRun {readonly ref: string; readonly name?: string; readonly lifecycle?: Lifecycle; readonly recognised?: boolean}
interface Journey {readonly ref?: string; readonly purpose?: string; readonly status?: string; readonly runs: readonly JourneyRun[]}
const journeyOf = (v: V): Journey | undefined => {
  const o = object(json<unknown>(v, 'journey', undefined))
  return o ? {ref: word(o.ref), purpose: word(o.purpose), status: word(o.status),
    runs: objects(o.runs).flatMap(r => { const ref = word(r.ref); return ref ? [{ref, name: word(r.name), lifecycle: LIFECYCLES.find(l => l === r.lifecycle), recognised: r.recognised === true}] : [] })} : undefined
}
const retOf = (v: V) => { const o = object(json<unknown>(v, 'ret', undefined)); return o && word(o.ref) ? {ref: word(o.ref)!, summary: word(o.summary)} : undefined }
const recognitionOf = (v: V) => { const o = object(json<unknown>(v, 'recognition', undefined)); return o && word(o.ref) ? {ref: word(o.ref)!, at: word(o.at)} : undefined }

// ---------------------------------------------------------------- the layout, by the map's own relations

/** Each node's column: one right of every node it requires, and one right of what returns, converges, realises or branches into it.
 * A cycle cannot hold under `requires` (the owner refuses one); the passes stop all the same. */
/** The pairs [before, after] the map orders left to right. */
const flowOf = (nodes: readonly Node[], edges: readonly Edge[]): [string, string][] => {
  const ids = new Set(nodes.map(n => n.id))
  return (edges.flatMap(e => (e.relation === 'requires' ? [[e.to, e.from]] : ['returns_to', 'converges_to', 'realises', 'branches_to'].includes(e.relation) ? [[e.from, e.to]] : []))
    .filter(([a, b]) => ids.has(a!) && ids.has(b!))) as [string, string][]
}
function columnsOf(nodes: readonly Node[], edges: readonly Edge[]): Map<string, number> {
  const col = new Map(nodes.map(n => [n.id, 0])), after = flowOf(nodes, edges)
  for (let pass = 0; pass < nodes.length; pass++) {
    let moved = false
    for (const [a, b] of after) if (col.get(b)! < col.get(a)! + 1) { col.set(b, col.get(a)! + 1); moved = true }
    if (!moved) break
  }
  return col
}

interface Place {readonly node: Node; readonly x: number; readonly y: number}
/** Columns left to right; in each column a node stands level with what it waits on (the mean of their heights), so no line runs through a
 * node it does not reach. Nodes that share a column keep their order and spread evenly. */
function layout(nodes: readonly Node[], edges: readonly Edge[], w: number, top: number, bottom: number, left: number, right: number): Place[] {
  const col = columnsOf(nodes, edges), cols = Math.max(0, ...col.values()) + 1, flow = flowOf(nodes, edges)
  const step = cols > 1 ? (w - left - right) / (cols - 1) : 0, span = bottom - top, y = new Map<string, number>()
  for (let c = 0; c < cols; c++) {
    const list = nodes.filter(n => col.get(n.id) === c)
    const want = list.map((n, i) => {
      const before = flow.filter(([, b]) => b === n.id).map(([a]) => y.get(a)).filter((h): h is number => h !== undefined)
      return {n, i, h: before.length ? before.reduce((a, b) => a + b, 0) / before.length : top + span / 2}
    })
    if (want.length === 1) y.set(want[0]!.n.id, want[0]!.h)
    else [...want].sort((a, b) => a.h - b.h || a.i - b.i).forEach((x, k) => y.set(x.n.id, top + ((k + 0.5) / want.length) * span))
  }
  return nodes.map(node => ({node, x: left + col.get(node.id)! * step, y: y.get(node.id)!}))
}

const DONE: readonly State[] = ['satisfied', 'returned']
const OPEN: readonly State[] = ['planned', 'ready', 'active', 'blocked', 'waiting']
const shownIn = (show: string | undefined, n: Node) => show === undefined || show === 'all' || n.state === undefined
  || (show === 'open' ? OPEN.includes(n.state) : show === 'done' ? DONE.includes(n.state) : true)
const INK: Readonly<Record<State | 'none', string>> = {
  planned: 'var(--text-faint)', ready: 'var(--dp-value)', active: 'var(--dp-value)', blocked: 'var(--stall)', waiting: 'var(--dp-on)', satisfied: 'var(--green)',
  returned: 'var(--green)', superseded: 'var(--text-faint)', abandoned: 'var(--text-faint)', none: 'var(--text-dim)',
}

/** One node in its kind's shape: a unit a block, a barrier a bar, a decision a diamond, a candidate a ring, the destination a flag. The
 * fill says how it stands: filled when at work or done, outlined when it waits, striped when blocked. */
function Mark({n, x, y, s, uid}: {n: Node; x: number; y: number; s: number; uid: string}): ReactNode {
  const ink = INK[n.state ?? 'none'], filled = n.state === 'active' || n.state === 'satisfied' || n.state === 'returned'
  const fill = filled ? ink : n.state === 'blocked' ? `url(#${uid}-stripe)` : 'var(--dp-well)'
  const gone = n.state === 'superseded' || n.state === 'abandoned'
  const body = (() => {
    switch (n.kind) {
      case 'gate': return <rect x={x - 1.6} y={y - s * 1.3} width={3.2} height={s * 2.6} fill={ink} />
      case 'decision': return <path d={`M${x} ${y - s * 0.75}l${s * 0.75} ${s * 0.75}l${-s * 0.75} ${s * 0.75}l${-s * 0.75} ${-s * 0.75}z`} fill={n.state === 'waiting' ? 'var(--dp-on)' : fill} stroke={ink} strokeWidth={1.1} />
      case 'candidate': return <circle cx={x} cy={y} r={s * 0.6} fill={fill} stroke={ink} strokeWidth={1.1} />
      case 'destination': return <g><path d={`M${x - 1} ${y + s * 0.8}V${y - s * 0.8}h${s * 0.9}l-2 ${s * 0.4}l2 ${s * 0.4}H${x - 1}`} fill={fill} stroke={ink} strokeWidth={1.1} /></g>
      case 'nested_run': return <g><rect x={x - s * 0.8} y={y - s * 0.55} width={s * 1.6} height={s * 1.1} fill={fill} stroke={ink} /><rect x={x - s * 0.8 + 2} y={y - s * 0.55 + 2} width={s * 1.6 - 4} height={s * 1.1 - 4} fill="none" stroke={ink} opacity={0.6} /></g>
      case 'position': case 'authority': return <rect x={x - s * 0.4} y={y - s * 0.4} width={s * 0.8} height={s * 0.8} fill={fill} stroke={ink} />
      default: return <rect x={x - s * 0.8} y={y - s * 0.55} width={s * 1.6} height={s * 1.1} rx={1.5} fill={fill} stroke={ink} strokeWidth={1.1} strokeDasharray={n.state === 'planned' ? '2 1.5' : undefined} />
    }
  })()
  return <g opacity={gone ? 0.4 : 1}>{body}{n.state === 'active' && <circle cx={x} cy={y} r={s * 1.15} fill="none" stroke={ink} opacity={0.35} />}</g>
}

interface Reading {readonly nodes: readonly Node[] | undefined; readonly edges: readonly Edge[]; readonly run: Run | undefined; readonly me: Node | undefined}
const read = (v: V): Reading => { const nodes = nodesOf(v), id = strOf(v, 'unit'); return {nodes, edges: edgesOf(v), run: runOf(v), me: id === undefined ? undefined : nodes?.find(n => n.id === id)} }
const units = (r: Reading) => r.nodes?.filter(n => n.kind === 'work')
const done = (r: Reading) => { const u = units(r); return u ? `${u.filter(n => n.state && DONE.includes(n.state)).length}/${u.length}` : undefined }
const waiting = (r: Reading) => r.nodes ? r.nodes.filter(n => n.state === 'waiting' || n.state === 'blocked').length : undefined

/** The well: the map, columns left to right by what each node waits on; the selected node ringed and carried by handle 1; the Run's
 * lifecycle and its Recognition at the right edge. `labels`: the names stand under the nodes where the columns leave room. */
function MapWell({p, r, w, h, live, labels, size}: {p: ViewProps; r: Reading; w: number; h: number; live: boolean; labels: boolean; size: 'compact' | 'whole' | 'mini' | 'full'}) {
  const v = p.v, uid = `rm-${size}`, show = strOf(v, 'show'), recognised = recognitionOf(v)
  const top = size === 'mini' ? 8 : 20, bottom = h - (labels ? 18 : size === 'mini' ? 8 : 16), left = size === 'full' ? 40 : 12, right = size === 'full' ? 52 : 20
  const places = r.nodes ? layout(r.nodes, r.edges, w, top, bottom, left, right) : []
  const at = new Map(places.map(pl => [pl.node.id, pl]))
  const xs = [...new Set(places.map(pl => Math.round(pl.x)))].sort((a, b) => a - b), cols = xs.length
  const gap = xs.length > 1 ? xs[1]! - xs[0]! : w - left - right
  /** A label keeps to its own column: centred under its node, or from the node inward at either edge. */
  const edge = (x: number) => (x < left + 8 ? 'start' : x > w - right - 8 ? 'end' : 'middle') as 'start' | 'end' | 'middle'
  const room = (x: number) => Math.max(3, Math.floor((edge(x) === 'middle' ? gap * 0.92 : gap * 0.5 + s) / 4.5))
  const s = clampTo(4, size === 'full' ? 13 : 8, Math.min((w - left - right) / Math.max(1, cols) / 2.6, (bottom - top) / 5))
  const sel = r.me ? at.get(r.me.id) : undefined
  const nearest = (x: number, y: number) => places.filter(pl => shownIn(show, pl.node)).reduce<Place | undefined>((best, pl) => (!best || Math.hypot(pl.x - x, pl.y - y) < Math.hypot(best.x - x, best.y - y) ? pl : best), undefined)
  const life = r.run?.lifecycle
  const corner = size === 'mini' ? undefined : life ? LIFE_WORD[life] : NONE
  return <Display w={w} h={h} label="The run map" corner={corner}
    does={size === 'mini' ? 'The run as the graph of its units.' : 'The run\'s units left to right by what each waits on. Barriers gather units; a diamond waits for a decision. Drag handle 1 to read another node.'}>
    <defs><pattern id={`${uid}-stripe`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="var(--stall)" opacity=".7" /></pattern></defs>
    {size !== 'mini' && <text x={6} y={11} className="dp-axis">{r.nodes === undefined ? '' : `${units(r)?.length ?? 0} units · ${r.nodes.filter(n => n.kind === 'gate').length} barriers`}</text>}
    {r.nodes === undefined && <text x={6} y={top + 14} className="dp-axis">No reading of the run map</text>}
    {r.nodes?.length === 0 && <text x={6} y={top + 14} className="dp-axis">The run has no units yet</text>}
    {r.edges.map((e, i) => {
      const a = at.get(e.relation === 'requires' ? e.to : e.from), b = at.get(e.relation === 'requires' ? e.from : e.to)
      if (!a || !b || e.relation === 'supersedes') return null
      const dim = !shownIn(show, a.node) || !shownIn(show, b.node), mx = (a.x + b.x) / 2
      const lit = DONE.includes(a.node.state as State) && e.relation === 'requires'
      return <path key={i} d={e.relation === 'nests' ? `M${a.x} ${a.y}L${b.x} ${b.y}` : `M${a.x + s * 0.8} ${a.y}C${mx} ${a.y} ${mx} ${b.y} ${b.x - s * 0.8} ${b.y}`} fill="none"
        stroke={lit ? 'var(--green)' : 'var(--text-faint)'} strokeWidth={1} opacity={dim ? 0.2 : lit ? 0.75 : 0.6} strokeDasharray={e.relation === 'nests' || e.relation === 'branches_to' ? '2 2' : undefined} />
    })}
    {places.map(pl => <g key={pl.node.id} opacity={shownIn(show, pl.node) ? 1 : 0.25} data-i={`${pl.node.label}|${KIND_WORD[pl.node.kind]}${pl.node.state ? `, ${STATE_WORD[pl.node.state]}. ${STATE_SAYS[pl.node.state]}` : '.'}${pl.node.kind === 'gate' && pl.node.waits?.length ? ` Waits for ${pl.node.waits.length}.` : ''}`}
      onClick={live && !st(p, 'unit').disabled ? () => p.set('unit', pl.node.id) : undefined} style={{cursor: live ? 'pointer' : undefined}}>
      <circle cx={pl.x} cy={pl.y} r={Math.max(7, s)} fill="transparent" />
      <Mark n={pl.node} x={pl.x} y={pl.y} s={s} uid={uid} />
      {pl.node.kind === 'gate' && !!pl.node.waits?.length && size !== 'mini' && <text x={pl.x + 4} y={pl.y - s * 1.3 + 6} className="dp-axis" style={{fill: 'var(--stall)'}}>{pl.node.waits.length}</text>}
      {labels && pl.node.kind !== 'gate' && <text x={edge(pl.x) === 'start' ? pl.x - s : edge(pl.x) === 'end' ? pl.x + s : pl.x} y={pl.y + s + 9} textAnchor={edge(pl.x)} className="dp-axis rm-label">{cut(pl.node.label, room(pl.x))}</text>}
    </g>)}
    {sel && size !== 'mini' && <rect x={sel.x - s - 3} y={sel.y - s - 3} width={2 * s + 6} height={2 * s + 6} rx={2} fill="none" stroke="var(--sel, #7ec3e6)" strokeWidth={1} opacity={0.8} />}
    {/* the Run's own end: its lifecycle bar, and the Recognition's diamond when there is one */}
    {r.nodes && size !== 'mini' && <g data-i={`Run|${life ? LIFE_WORD[life] : 'No reading of the lifecycle'}${recognised ? '. Recognised.' : '.'}`}>
      <rect x={w - 6} y={top} width={3} height={bottom - top} fill={life === 'finished' || life === 'archived' ? 'var(--green)' : life === 'finishing' ? 'var(--dp-on)' : 'var(--text-faint)'} opacity={life ? 0.9 : 0.3} />
      {recognised && <path d={`M${w - 4.5} ${top - 7}l4 4l-4 4l-4 -4z`} fill="var(--dp-on)" />}
    </g>}
    {sel && live && !st(p, 'unit').disabled && <Handle n={1} shape="ring" x={sel.x} y={sel.y - s - 7} label="Unit" does="Drag to the node you want to read."
      onDrag={(x, y) => { const pl = nearest(x, y + s + 7); if (pl && pl.node.id !== r.me?.id) p.set('unit', pl.node.id) }} />}
  </Display>
}

// ---------------------------------------------------------------- the controls

const SHOW: readonly Option<string>[] = [
  {value: 'all', label: 'All', does: 'Every node of the map.'},
  {value: 'open', label: 'Open', does: 'Nodes still to do: planned, ready, at work, blocked or waiting for you.'},
  {value: 'done', label: 'Done', does: 'Nodes met or returned.'},
]
const SAYS = {
  unit: 'The node you read: a unit, a barrier, a decision or a candidate.',
  show: 'Which nodes stand out: all of them, those still to do, or those done.',
  retry: 'Start the unit again under its retry grant, from a failed or quiet attempt.',
}

const unitChooser = (p: ViewProps, r: Reading, wide = true) => {
  const options = (r.nodes ?? []).filter(n => n.kind !== 'destination').map(n => ({value: n.id, label: n.label})), now = strOf(p.v, 'unit')
  return <Chooser {...st(p, 'unit')} label="Unit" does={SAYS.unit} wide={wide} value={now ?? ''}
    options={now !== undefined && !options.some(o => o.value === now) ? [...options, {value: now, label: now}] : options} onChange={x => p.set('unit', x)} />
}
const showRadio = (p: ViewProps, stack = true) => <Radio {...st(p, 'show')} label="Show" does={SAYS.show} value={strOf(p.v, 'show') ?? ''} options={SHOW} stack={stack} onChange={x => p.set('show', x)} />
const retryAction = (p: ViewProps, r: Reading) => {
  const s = st(p, 'retry'), leg = r.me?.leg, can = leg?.status === 'failed' || leg?.status === 'late_result' || leg?.status === 'quiescent'
  return <Action {...s} label="Retry" does={SAYS.retry}
    disabled={s.disabled ?? (!r.me || r.me.kind !== 'work' ? 'Choose a unit.' : !can ? 'The unit has not failed or gone quiet.' : leg?.allowed !== undefined && leg.spent !== undefined && leg.spent >= leg.allowed ? 'Its retry grant is spent.' : undefined)}
    onPress={() => p.set('retry', r.me?.id)} />
}
const light = (p: ViewProps): LightState => { const x = strOf(p.owner ?? p.v, 'light'); return x === 'lit' || x === 'dark' ? x : 'unknown' }
const LIGHT_WHY = 'A run is not turned on or off: it runs while its units do.'
const atWork = (p: ViewProps) => light(p) === 'lit' && !!nodesOf(p.v)?.some(n => n.state === 'active')
const head = (p: ViewProps) => ({light: light(p), lightWhy: LIGHT_WHY, busy: atWork(p), onFold: p.nav.fold, onFull: p.nav.full})
const legWord = (leg?: Leg) => (leg?.status ? leg.status.replace(/_/g, ' ') : undefined)
const tries = (leg?: Leg) => (leg?.allowed !== undefined ? `${leg.spent ?? 0}/${leg.allowed}` : leg?.attempts !== undefined ? String(leg.attempts) : undefined)
/** This run's place in the course (Factory's Journey), as "3 of 3". */
const placeOfRun = (v: V) => { const j = journeyOf(v), ref = runOf(v)?.ref, i = j && ref ? j.runs.findIndex(x => x.ref === ref) : -1; return j && i >= 0 ? `${i + 1} of ${j.runs.length}` : undefined }

// ---------------------------------------------------------------- the pane

function JourneyStrip({v}: {v: V}) {
  const j = journeyOf(v), me = runOf(v)?.ref
  if (!j) return <p className="rm-none">No reading of the course.</p>
  return <ol className="rm-journey" aria-label="The course's runs">
    {j.runs.map((x, i) => <li key={x.ref} data-me={x.ref === me || undefined} data-life={x.lifecycle} data-i={`${x.name ?? x.ref}|${x.lifecycle ? LIFE_WORD[x.lifecycle] : 'No reading of its lifecycle'}${x.recognised ? ', recognised' : ''}.${i ? ' Continued from the run before it.' : ''}`}>
      <i /><b>{x.name ?? x.ref}</b><small>{x.lifecycle ? LIFE_WORD[x.lifecycle] : NONE}</small>{x.recognised && <em>recognised</em>}
    </li>)}
    {j.runs.length === 0 && <li><small>No run yet</small></li>}
  </ol>
}

function MapPane({p}: {p: ViewProps}) {
  const v = p.v, r = read(v), j = journeyOf(v), rec = recognitionOf(v), ret = retOf(v), me = r.me
  const needs = me ? r.edges.filter(e => e.relation === 'requires' && e.from === me.id).map(e => r.nodes?.find(n => n.id === e.to)?.label ?? e.to) : []
  const feeds = me ? r.edges.filter(e => e.relation === 'requires' && e.to === me.id).map(e => r.nodes?.find(n => n.id === e.from)?.label ?? e.from) : []
  return <div className="rm-pane">
    <header className="rm-head" aria-label="The run">
      <b>{r.run?.name ?? r.run?.ref ?? NONE}</b><span data-tone={r.run?.lifecycle ? LIFE_TONE[r.run.lifecycle] : undefined}>{r.run?.lifecycle ? LIFE_WORD[r.run.lifecycle] : NONE}</span>
      <span>{done(r) ?? NONE} returned</span><span>{rec ? 'recognised' : has(v, 'journey') ? 'not recognised' : `recognised ${NONE}`}</span><span>for: {j?.purpose ?? NONE}</span><span>run {placeOfRun(v) ?? NONE} of the course</span>
    </header>
    <div className="rm-main">
      <div className="rm-map"><MapWell p={p} r={r} w={Math.max(420, (p.room?.w ?? 900) - 300)} h={Math.max(260, (p.room?.h ?? 520) - 120)} live labels size="full" /></div>
      <aside className="rm-side" aria-label="The node you read">
        <h4>{me ? KIND_WORD[me.kind] : 'Node'}</h4>
        {!me ? <p>{r.nodes ? 'Choose a node on the map.' : 'No reading of the run map.'}</p> : <>
          <p className="rm-name">{me.label}</p>
          {me.concern && <p className="rm-concern">{me.concern}</p>}
          <dl>
            <dt>State</dt><dd data-state={me.state}>{me.state ? STATE_WORD[me.state] : NONE}</dd>
            <dt>Waits on</dt><dd>{needs.length ? needs.join(', ') : 'nothing'}</dd>
            <dt>Opens</dt><dd>{feeds.length ? feeds.join(', ') : 'nothing'}</dd>
            {me.kind === 'gate' && <><dt>Still out</dt><dd>{me.waits === undefined ? NONE : me.waits.length ? me.waits.join(', ') : 'none'}</dd></>}
            {me.kind === 'work' && <><dt>Attempt</dt><dd>{legWord(me.leg) ?? NONE}</dd><dt>Retries</dt><dd>{tries(me.leg) ?? NONE}</dd>
              <dt>Held by</dt><dd>{me.custody ? `${me.custody.position ?? NONE}${me.custody.state ? ` · ${me.custody.state}` : ''}` : NONE}</dd></>}
          </dl>
        </>}
        <h4>Return</h4>
        <p>{ret ? ret.summary ?? ret.ref : r.nodes ? 'Nothing returned yet.' : 'No reading of the return.'}</p>
        <p className="rm-rec" data-on={rec ? 'true' : undefined} data-i="Recognition|You recognise a run's return in Approvals.">{rec ? `Recognised${rec.at ? ` ${rec.at}` : ''}` : ret ? 'Waits for your Recognition in Approvals' : ''}</p>
      </aside>
    </div>
    <footer className="rm-foot"><small>Journey{j?.status ? ` · ${j.status}` : ''}</small><JourneyStrip v={v} /></footer>
  </div>
}

// ---------------------------------------------------------------- the device

// The sample material of the gallery: the type-check work as a run of five units under one barrier. The views never read these.
const NODES = (states: Record<string, State>, waits: string[]) => JSON.stringify([
  {id: 'work-read', kind: 'work', label: 'Read context', state: states.read, concern: 'Read the shell\'s agent context before any tool runs.', leg: {status: 'returned', attempts: 1, allowed: 2, spent: 0}, custody: {position: 'Flint', state: 'completed'}},
  {id: 'work-shell', kind: 'work', label: 'tsc shell', state: states.shell, concern: 'Type-check packages/live-shell/ui.', leg: {status: states.shell === 'returned' ? 'returned' : 'active', attempts: 2, allowed: 2, spent: 1}, custody: {position: 'Flint', state: states.shell === 'returned' ? 'completed' : 'in-progress'}},
  {id: 'work-cradle', kind: 'work', label: 'tsc cradle', state: states.cradle, concern: 'Type-check desktop/cradle.', leg: {status: 'returned', attempts: 1, allowed: 2, spent: 0}, custody: {position: 'Flint', state: 'completed'}},
  {id: 'decision-app', kind: 'decision', label: 'Skip the app?', state: states.decision},
  {id: 'work-app', kind: 'work', label: 'tsc app', state: states.app, concern: 'Type-check desktop/cradle/expressions-app.', leg: {status: states.app === 'returned' ? 'returned' : 'failed', attempts: 1, allowed: 2, spent: 0}, custody: {position: 'Kite', state: states.app === 'returned' ? 'completed' : 'blocked'}},
  {id: 'barrier-roots', kind: 'gate', label: 'All roots', waits},
  {id: 'work-report', kind: 'work', label: 'Report', state: states.report, concern: 'Report what the roots returned, with the fixes.', leg: {status: states.report === 'returned' ? 'returned' : undefined, attempts: 0, allowed: 1, spent: 0}},
  {id: 'candidate-1', kind: 'candidate', label: 'Candidate', state: states.candidate},
  {id: 'destination', kind: 'destination', label: 'Roots type-check'},
])
const EDGES = JSON.stringify([
  {from: 'work-shell', to: 'work-read', relation: 'requires'}, {from: 'work-cradle', to: 'work-read', relation: 'requires'},
  {from: 'decision-app', to: 'work-read', relation: 'requires'}, {from: 'work-app', to: 'decision-app', relation: 'requires'},
  {from: 'barrier-roots', to: 'work-shell', relation: 'requires'}, {from: 'barrier-roots', to: 'work-cradle', relation: 'requires'}, {from: 'barrier-roots', to: 'work-app', relation: 'requires'},
  {from: 'work-report', to: 'barrier-roots', relation: 'requires'}, {from: 'work-report', to: 'candidate-1', relation: 'returns_to'}, {from: 'candidate-1', to: 'destination', relation: 'realises'},
])
const JOURNEY = (third: Lifecycle, recognised: boolean) => JSON.stringify({ref: 'journey:01J9TSC', purpose: 'Keep the three TypeScript roots type-checking', status: 'active',
  runs: [{ref: 'run:1', name: 'First pass', lifecycle: 'finished', recognised: true}, {ref: 'run:2', name: 'Model row', lifecycle: 'aborted'}, {ref: 'run:3', name: 'Type-check the roots', lifecycle: third, recognised}]})
const AT_WORK = {read: 'returned', shell: 'active', cradle: 'returned', decision: 'waiting', app: 'blocked', report: 'planned', candidate: 'planned'} as Record<string, State>
const DONE_ALL = {read: 'returned', shell: 'returned', cradle: 'returned', decision: 'satisfied', app: 'returned', report: 'returned', candidate: 'satisfied'} as Record<string, State>

export const design: DesignedDevice = {
  id: 'software-factory:run-map',
  title: 'Run map',
  kind: 'instrument',
  defaults: {
    light: 'lit', unit: 'work-app', show: 'all',
    run: JSON.stringify({ref: 'run:3', name: 'Type-check the roots', lifecycle: 'active', revision: 41}),
    nodes: NODES(AT_WORK, ['work-shell', 'work-app']), edges: EDGES, journey: JOURNEY('active', false),
  },
  fixtures: {
    'A run at work': {},
    'Returned, waiting for you': {unit: 'barrier-roots', run: JSON.stringify({ref: 'run:3', name: 'Type-check the roots', lifecycle: 'active', revision: 57}),
      nodes: NODES(DONE_ALL, []), ret: JSON.stringify({ref: 'return:3', summary: 'All three roots type-check. One import repaired in AgentShellContext.'})},
    'Finishing, recognised': {unit: 'work-report', show: 'done', run: JSON.stringify({ref: 'run:3', name: 'Type-check the roots', lifecycle: 'finishing', revision: 60}),
      nodes: NODES(DONE_ALL, []), ret: JSON.stringify({ref: 'return:3', summary: 'All three roots type-check. One import repaired in AgentShellContext.'}),
      recognition: JSON.stringify({ref: 'recognition:desk-7Q', at: '21 Oct 11:02'}), journey: JOURNEY('finishing', true)},
    'No readings': Object.fromEntries(['light', 'unit', 'show', 'run', 'nodes', 'edges', 'ret', 'recognition', 'journey'].map(k => [k, undefined])),
  },

  folded: p => { const r = read(p.v); return <Folded title="Run map" light={light(p)} readings={[r.run?.lifecycle ? LIFE_WORD[r.run.lifecycle] : NONE, done(r) ?? NONE]} onUnfold={p.nav.unfold} /> },

  compact: p => {
    const r = read(p.v)
    return <Panel title="Run map" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}><MapWell p={p} r={r} w={140} h={146} live labels={false} size="compact" /></Section>
      <Section label="Macros" cols={2} width={112}>
        <div style={{gridColumn: 'span 2', width: '100%'}}>{unitChooser(p, r)}</div>
        <div style={{gridColumn: 'span 2', width: '100%'}}>{showRadio(p, false)}</div>
        <Readout label="returned" does="Units returned of the run's units." value={done(r)} tone="green" />
        <Readout label="waiting" does="Nodes blocked or waiting for your decision." value={waiting(r)} tone="stall" />
      </Section>
    </Panel>
  },

  whole: p => {
    const r = read(p.v), j = journeyOf(p.v), rec = recognitionOf(p.v), me = r.me, life = r.run?.lifecycle
    // Expanded, the two bands stand side by side: the well grows into what the other four sections leave.
    const w = grown(p, 194, 120 + 150 + 150 + 190 + 5 * 12 + 40, 380)
    return <Panel title="Run map" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}><MapWell p={p} r={r} w={w} h={146} live labels size="whole" /></Section>
        <Section label="Unit" width={120}>
          {unitChooser(p, r)}
          <Readout label="state" does="How the node you read stands." value={me?.state ? STATE_WORD[me.state] : undefined} tone={me?.state === 'blocked' ? 'stall' : me?.state === 'active' ? 'value' : me?.state && DONE.includes(me.state) ? 'green' : undefined} />
          <Readout label="retries" does="Attempts spent of those its retry grant allows." value={tries(me?.leg)} />
          {retryAction(p, r)}
        </Section>
        <Section label="Run" cols={2} width={150}>
          <Readout big label="lifecycle" does="Where the run's own lifecycle stands: seeded, at work, waiting for you, finishing, finished." value={life ? LIFE_WORD[life] : undefined} tone={life ? LIFE_TONE[life] : undefined} />
          <Readout label="returned" does="Units returned of the run's units." value={done(r)} tone="green" />
          <Readout label="waiting" does="Nodes blocked or waiting for your decision." value={waiting(r)} tone="stall" />
          {showRadio(p)}
        </Section>
      </Band>
      {/* Recognition is given in Approvals (§19.14): Recognise, Close and Continue stand there. The map reads the return and your word. */}
      <Band>
        <Section label="Recognition" cols={2} width={190}>
          <Readout label="return" does="Whether the run has returned work for you to recognise. You recognise it in Approvals." value={retOf(p.v) ? 'returned' : r.nodes ? 'none yet' : undefined} />
          <Readout label="recognised" does="When you recognised the run's return, in Approvals." value={rec ? rec.at ?? 'yes' : has(p.v, 'journey') ? 'not yet' : undefined} tone={rec ? 'accent' : undefined} />
        </Section>
        <Section label="Journey" cols={2} grow>
          <Readout label="run" does="This run's place in the course: the work as it goes on across runs." value={placeOfRun(p.v)} />
          <Readout label="course" does="How the course stands: active, paused, completed or abandoned." value={j?.status} />
        </Section>
      </Band>
    </Panel>
  },

  full: p => <MapPane p={p} />,

  widget: p => {
    const r = read(p.v), life = r.run?.lifecycle
    return <Tile title={`Run map · ${r.run?.name ? cut(r.run.name, 18) : NONE}`} light={light(p)} lightWhy={LIGHT_WHY} busy={atWork(p)} span={2} onFull={p.nav.full}>
      <MapWell p={p} r={r} w={168} h={100} live={false} labels={false} size="mini" />
      <div className="rm-tile-side">
        <Readout label="run" does="Where the run's lifecycle stands." value={life ? LIFE_WORD[life] : undefined} tone={life ? LIFE_TONE[life] : undefined} />
        <Readout label="returned" does="Units returned of the run's units." value={done(r)} />
        <Readout label="waiting" does="Nodes blocked or waiting for your decision." value={waiting(r)} tone="stall" />
      </div>
    </Tile>
  },
}
