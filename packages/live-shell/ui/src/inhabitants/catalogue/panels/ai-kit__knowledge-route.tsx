// Knowledge route (manual §19.9, ai-kit:knowledge-route): which knowledge an agent may look up, and how far it follows links.
// Live's nearest: Auto Filter — a filter drawn across a scale with handles on it; here the scale is the ring of links round a hit.
// The owner is AIKit's knowledge application (`aikit knowledge search|resolve|read|relations|history|status`, transported by the
// cradle kernel: desktop/cradle/kernel/src/knowledge.rs). Grounded as follows.
//   Sources: the three lenses AIKit reports in `knowledge status` — the wiki (data.wiki), the project's knowledge (the source pools
//   and the project map: Address kinds source and project-map, knowledge.rs:8-14) and the code index (data.code, GitNexus). A web
//   lens does not exist there. Which lenses an agent may query is carried by the AgentProfile (Central ctrl/src/agent_profile.rs:317
//   ratified_world_refs, :321 knowledge_source_refs; written by agent-profile.save, agent_profile_actions.rs:19); the lens-level request
//   has no writer yet, so the shell refuses it by name (agent/devices/designBindings.ts:93).
//   Reach: Scope's value, shown here as a reading; the level that holds a source comes from `central.world.effective-sources`.
//   Link depth: `aikit knowledge relations --depth`, 2 in the kernel's request (knowledge.rs:297, :525) and the CLI default.
//   Read budget and Search first: no operation carries them yet. A page counts as read when `knowledge open` records its
//   successful use (Request::Use, History: knowledge.rs:34-36), so the budget is a ceiling over that count.
//   Route: each lens's answer, from `knowledge status` (available) and the absences `resolve` and `status` report verbatim (for
//   example knowledge.wiki_publication_budget, "GitNexus CodeIndex degraded for Work/O-I: index metadata exceeds 1 MiB").
//   Pages read: `knowledge history`. Links: the relation view `knowledge relations` returns (nodes, edges, truncated).
// The picture is the ring of links round the last hit by the owner's own relation view: a page sits on the ring of its link distance
// from the hit (found here by walking the view's edges), so the ring of Link depth is exactly what the agent may follow. The bar
// under it is the Read budget on a log scale: teal to the pages read, the handle at the budget.
//
// Its second page, Affected, shows which of the agent's readings a changed source has moved, so you choose what to read again and what
// to let go. The owner is AIKit's Living Knowledge (crates/aikit-core/src/knowledge_living_relations.rs, aikit.living-knowledge-relations/v1):
// over Central's change horizon (`projectcentral.change.horizon`, central.source-change-horizon/v1) it follows the explicit dependency
// manifests from each moved source to the readings that rest on it, and gives each one its freshness — basis-changed, integration-pending
// (an integrative reading waits for its parts), basis-unavailable — with the path it took, and says when it cut the list (truncated).
//   affected   {cursor, changed: [{source, title, basis?, observed?, kind?}], readings: [{id, title, lens, freshness, source, hops, relation?}],
//              pending, truncated}  KnowledgeTransitiveImpact: changed_sources, transitive (resource, root_source, relation, freshness),
//              paths (steps, as hops), pending_integration (a count). No AIKit command reports it for the route's readings yet: the library
//              computes it inside `aikit flow changed-since` and the Contemplate preflight. The host leaves the key absent until one does.
// Held by the hand: the reading chosen. Acts: refresh (the reading's id: `knowledge open`, which reads it at its new basis and records
// the use; the kernel's knowledge Use reaches it) and forget (the reading's id: `aikit knowledge forget destination <resource>`, which drops
// AIKit's record of having used it, so the route no longer ranks it from familiarity; no kernel op yet).
import {useState} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Readout, Rows, Section, Tile, Toggle, fromUnit, toUnit, type LightState, type RowItem, type Scale} from '../../sdk/panel'
import {boolOf, clampTo, has, json, NONE, numOf, st, strOf, type DesignedDevice, type Value, type ViewProps} from './design'
import './ai-kit__knowledge-route.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type Lens = 'wiki' | 'project' | 'code'
type Ready = 'ready' | 'degraded' | 'withheld'
type Via = 'search' | 'link' | 'direct'

// Fixed vocabulary: the three lenses, the four world levels and the scales. None of it is the owner's data.
const LENSES: readonly {readonly id: Lens; readonly name: string; readonly does: string}[] = [
  {id: 'wiki', name: 'Wiki', does: 'The wiki. Your request lets the agent search it.'},
  {id: 'project', name: 'Project', does: 'The knowledge of the project: its sources and its map. Your request lets the agent search it.'},
  {id: 'code', name: 'Code', does: 'The code index. Your request lets the agent search it.'},
]
const LEVELS = ['Object', 'Scene', 'Expression', 'Central'] as const
const DEPTH: Scale = {min: 0, max: 4, step: 1}
const BUDGET: Scale = {min: 1, max: 200, log: true}
const DEFAULT_DEPTH = 2, DEFAULT_BUDGET = 40
const TICKS = [1, 10, 100]

// ---------------------------------------------------------------- what the owner reports

interface Page {readonly id: string; readonly title: string; readonly lens: Lens; readonly via?: Via; readonly hop?: number; readonly ref?: string}
interface GNode {readonly id: string; readonly title: string; readonly lens: Lens}
interface Graph {readonly focus: string; readonly nodes: readonly GNode[]; readonly edges: readonly (readonly [string, string])[]; readonly truncated: boolean}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const isLens = (x: unknown): x is Lens => x === 'wiki' || x === 'project' || x === 'code'

/** The pages the agent opened in this task, or undefined when the owner reported none (an empty list is a reading). */
function pagesOf(v: V): readonly Page[] | undefined {
  if (!has(v, 'pages')) return undefined
  const raw = json<unknown>(v, 'pages', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((x): Page[] => isObj(x) && typeof x.id === 'string' && typeof x.title === 'string' && isLens(x.lens)
    ? [{id: x.id, title: x.title, lens: x.lens, via: x.via === 'search' || x.via === 'link' || x.via === 'direct' ? x.via : undefined,
      hop: typeof x.hop === 'number' ? x.hop : undefined, ref: typeof x.ref === 'string' ? x.ref : undefined}] : [])
}

/** The relation view round the last hit, or undefined when the owner reported none or it cannot be read. */
function graphOf(v: V): Graph | undefined {
  if (!has(v, 'graph')) return undefined
  const raw = json<unknown>(v, 'graph', null)
  if (!isObj(raw) || typeof raw.focus !== 'string' || !Array.isArray(raw.nodes)) return undefined
  const nodes = raw.nodes.flatMap((x): GNode[] => isObj(x) && typeof x.id === 'string' && typeof x.title === 'string' && isLens(x.lens) ? [{id: x.id, title: x.title, lens: x.lens}] : [])
  const ids = new Set(nodes.map(n => n.id))
  if (!ids.has(raw.focus)) return undefined
  const edges = (Array.isArray(raw.edges) ? raw.edges : []).flatMap((e): (readonly [string, string])[] =>
    Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string' && ids.has(e[0]) && ids.has(e[1]) ? [[e[0], e[1]]] : [])
  return {focus: raw.focus, nodes, edges, truncated: raw.truncated === true}
}

const readyOf = (v: V, lens: Lens): Ready | undefined => {
  const s = strOf(v, `ready:${lens}`)
  return s === 'ready' || s === 'degraded' || s === 'withheld' ? s : undefined
}

/** Where a source stands for the agent: asked for and open, not asked, above the Reach, withheld by its owner, or not reported. */
type Seat = 'open' | 'off' | 'beyond' | 'withheld' | 'unknown'
function seatOf(v: V, lens: Lens): Seat {
  const asked = boolOf(v, lens)
  if (asked === undefined) return 'unknown'
  if (!asked) return 'off'
  const reach = numOf(v, 'reach'), level = numOf(v, `level:${lens}`)
  if (reach !== undefined && level !== undefined && level > reach) return 'beyond'
  return readyOf(v, lens) === 'withheld' ? 'withheld' : 'open'
}

/** The route as one word: every asked source answers, some do not, or none does. Undefined while the owner has not said. */
function routeOf(v: V): 'Ready' | 'Degraded' | 'Withheld' | 'Off' | undefined {
  if (LENSES.every(l => !has(v, l.id))) return undefined
  const asked = LENSES.filter(l => boolOf(v, l.id) === true)
  if (!asked.length) return 'Off'
  const states = asked.map(l => (seatOf(v, l.id) === 'beyond' ? 'withheld' : readyOf(v, l.id)))
  if (states.some(s => s === undefined)) return undefined
  return states.every(s => s === 'ready') ? 'Ready' : states.every(s => s === 'withheld') ? 'Withheld' : 'Degraded'
}

const count = (v: V, test: (x: Page) => boolean): number | undefined => pagesOf(v)?.filter(test).length
const light = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}
const stand = (p: ViewProps, key: string) => p.standing?.[key] ?? {}
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const levelName = (v: V) => { const r = numOf(v, 'reach'); return r === undefined ? undefined : LEVELS[Math.round(r)] }

// ---------------------------------------------------------------- the marks: a lens is a shape

type MarkState = Ready | 'unknown'
/** The shape of a lens, in the state its owner reports: a full line when ready, orange when degraded, dashed when withheld. */
function LensMark({lens, state, size = 10}: {lens: Lens; state: MarkState; size?: number}) {
  const c = size / 2, r = size / 2 - 1.4
  const color = state === 'degraded' ? 'var(--stall)' : state === 'ready' ? 'var(--dp-value)' : 'var(--text-faint)'
  const common = {fill: state === 'ready' || state === 'degraded' ? color : 'none', stroke: color, strokeWidth: 1.2, strokeDasharray: state === 'withheld' ? '2 1.5' : undefined}
  return <svg className="kr-mark" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    {lens === 'wiki' ? <circle cx={c} cy={c} r={r} {...common} />
      : lens === 'project' ? <rect x={c - r} y={c - r} width={2 * r} height={2 * r} {...common} />
        : <polygon points={`${c},${c - r - .6} ${c + r + .6},${c} ${c},${c + r + .6} ${c - r - .6},${c}`} {...common} />}
  </svg>
}

type NodeState = 'read' | 'open' | 'beyond' | 'closed'
/** A page in the ring picture: filled when read, outlined when the agent may open it, faint past the Link depth, dashed when its
 * source is closed. */
function NodeShape({lens, x, y, r, state}: {lens: Lens; x: number; y: number; r: number; state: NodeState}) {
  const props = state === 'read' ? {fill: 'var(--dp-value)', stroke: 'var(--dp-value)', strokeWidth: 1.2}
    : state === 'open' ? {fill: 'var(--dp-well)', stroke: 'var(--dp-value)', strokeWidth: 1.2}
      : state === 'beyond' ? {fill: 'none', stroke: 'var(--text-faint)', strokeWidth: 1, opacity: .7}
        : {fill: 'none', stroke: 'var(--text-faint)', strokeWidth: 1, strokeDasharray: '2 1.5', opacity: .55}
  return lens === 'wiki' ? <circle cx={x} cy={y} r={r} {...props} />
    : lens === 'project' ? <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...props} />
      : <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} {...props} />
}

// ---------------------------------------------------------------- the ring picture, by its own law

interface Geo {readonly cx: number; readonly cy: number; readonly step: number}
/** The centre and the width of one link's ring. `bare`: no bar under the rings. */
function geo(w: number, h: number, bare?: boolean): Geo {
  const under = bare ? 6 : 20, max = Math.min(w / 2 - 6, (h - under) / 2 - 2)
  return {cx: w / 2, cy: (h - under) / 2 + 2, step: max / 4}
}

/** Each page's link distance from the hit, found by walking the view's edges, and the page it was reached through. */
function walk(g: Graph) {
  const next = new Map<string, string[]>()
  const link = (a: string, b: string) => { const l = next.get(a); if (l) l.push(b); else next.set(a, [b]) }
  for (const [a, b] of g.edges) { link(a, b); link(b, a) }
  const hop = new Map<string, number>([[g.focus, 0]]), parent = new Map<string, string>(), queue = [g.focus]
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!
    for (const to of next.get(at) ?? []) if (!hop.has(to)) { hop.set(to, hop.get(at)! + 1); parent.set(to, at); queue.push(to) }
  }
  return {hop, parent}
}

/** Each page on the ring of its distance, under the page it was reached through. */
function layout(g: Graph, geometry: Geo, spread: number) {
  const {hop, parent} = walk(g)
  const pos = new Map<string, {x: number; y: number; angle: number}>()
  const rings: GNode[][] = [[], [], [], [], []]
  for (const n of g.nodes) { const h = hop.get(n.id); if (h !== undefined && h <= 4) rings[h]!.push(n) }
  pos.set(g.focus, {x: geometry.cx, y: geometry.cy, angle: -90})
  for (let i = 1; i <= 4; i++) {
    const ring = rings[i]!, radius = i * geometry.step
    const put = (n: GNode, angle: number) => {
      const a = angle * Math.PI / 180
      pos.set(n.id, {x: geometry.cx + radius * Math.cos(a), y: geometry.cy + radius * Math.sin(a), angle})
    }
    if (i === 1) { ring.forEach((n, k) => put(n, -90 + (k + .5) * 360 / ring.length)); continue }
    const by = new Map<string, GNode[]>()
    for (const n of ring) { const key = parent.get(n.id) ?? ''; const l = by.get(key); if (l) l.push(n); else by.set(key, [n]) }
    for (const [key, kids] of by) {
      const base = pos.get(key)?.angle ?? -90
      kids.forEach((n, k) => put(n, base + (k - (kids.length - 1) / 2) * spread))
    }
  }
  return {pos, hop}
}

/** A title cut to the room it has (the pane's labels are 9.5 px: about 5.4 px a letter). */
const fit = (title: string, room: number) => { const n = Math.max(4, Math.floor(room / 5.4)); return title.length > n ? `${title.slice(0, n - 1)}…` : title }

type Mode = 'compact' | 'whole' | 'full' | 'tile'
/** The rings: the hit at the centre and one ring for each link. Teal over the rings that the Link depth reaches; handle 1 sets the
 * depth. Under them the Read budget on a log scale, handle 2 at the budget. */
function Graphic({v, set, w, h, mode}: {v: V; set?: SetFn; w: number; h: number; mode: Mode}) {
  const bare = mode === 'tile' || mode === 'full', big = mode === 'full'
  const G = geo(w, h, bare), g = graphOf(v), depth = numOf(v, 'depth'), budget = numOf(v, 'budget'), pages = pagesOf(v)
  const reads = new Set((pages ?? []).map(x => x.id))
  const placed = g ? layout(g, G, big ? 26 : 22) : undefined
  const size = big ? 5 : mode === 'tile' ? 2.4 : 3.2
  const stateOf = (n: GNode, hop: number): NodeState => {
    if (seatOf(v, n.lens) !== 'open') return 'closed'
    if (reads.has(n.id)) return 'read'
    return depth !== undefined && hop > depth ? 'beyond' : 'open'
  }
  // The pane's labels keep 11 px between them on each side, so two titles never print over each other.
  const labelY = new Map<string, number>()
  if (big && g && placed) {
    for (const right of [true, false]) {
      const items = g.nodes.flatMap(n => { const q = placed.pos.get(n.id); return q && (q.x >= G.cx) === right ? [{id: n.id, y: q.y + 3.5}] : [] }).sort((a, b) => a.y - b.y)
      let last = -Infinity
      for (const it of items) { const y = Math.max(it.y, last + 11); labelY.set(it.id, y); last = y }
    }
  }
  const hx = G.cx + Math.max(7, (depth ?? 0) * G.step) * Math.cos(-Math.PI / 4), hy = G.cy + Math.max(7, (depth ?? 0) * G.step) * Math.sin(-Math.PI / 4)
  // The bar: the budget and the pages read on one log scale.
  const bx0 = 8, bx1 = w - 8, by = h - 13, at = (n: number) => bx0 + toUnit(BUDGET, Math.max(1, n)) * (bx1 - bx0)
  const used = pages?.length
  return <g>
    {depth !== undefined && depth > 0 && <circle cx={G.cx} cy={G.cy} r={depth * G.step} fill="var(--dp-value)" fillOpacity={.1} />}
    {[1, 2, 3, 4].map(i => <g key={i}>
      <circle cx={G.cx} cy={G.cy} r={i * G.step} className="dp-faint" />
      {!bare && mode === 'whole' && <text x={G.cx} y={G.cy - i * G.step + 8} className="dp-axis" textAnchor="middle">{i}</text>}
      {big && <text x={G.cx + 4} y={G.cy - i * G.step + 11} className="dp-axis">{i}</text>}
    </g>)}
    {depth !== undefined && depth > 0 && <circle cx={G.cx} cy={G.cy} r={depth * G.step} fill="none" stroke="var(--dp-value)" strokeWidth={1.6} />}
    {g && placed && <g>
      {g.edges.map(([a, b]) => {
        const pa = placed.pos.get(a), pb = placed.pos.get(b)
        if (!pa || !pb) return null
        const inside = depth !== undefined && Math.max(placed.hop.get(a) ?? 9, placed.hop.get(b) ?? 9) <= depth
        return <line key={`${a}>${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={inside ? 'var(--dp-value)' : 'var(--text-faint)'} strokeWidth={1} opacity={inside ? .55 : .35} />
      })}
      {g.nodes.map(n => {
        const q = placed.pos.get(n.id), hop = placed.hop.get(n.id)
        if (!q || hop === undefined) return null
        const state = stateOf(n, hop), focus = n.id === g.focus
        return <g key={n.id} data-i={`${n.title}|${focus ? 'The last hit.' : `${hop} link${hop === 1 ? '' : 's'} from the last hit.`}`}>
          {focus && <circle cx={q.x} cy={q.y} r={size + 3} fill="none" stroke="var(--dp-value)" strokeWidth={.8} opacity={.6} />}
          <NodeShape lens={n.lens} x={q.x} y={q.y} r={focus ? size + 1 : size} state={state} />
          {big && <text x={q.x + (q.x >= G.cx ? size + 5 : -size - 5)} y={labelY.get(n.id) ?? q.y + 3.5} textAnchor={q.x >= G.cx ? 'start' : 'end'}
            className={state === 'read' || state === 'open' ? 'dp-ink' : 'dp-ink-dim'}>{fit(n.title, q.x >= G.cx ? w - 6 - (q.x + size + 5) : q.x - size - 5 - 6)}</text>}
        </g>
      })}
    </g>}
    {!g && <text x={G.cx} y={G.cy + 3} className="dp-axis" textAnchor="middle">No reading of the links</text>}
    {mode !== 'tile' && !big && <g>
      {LENSES.map((l, k) => <g key={l.id} data-i={`${l.name}|${l.id === 'wiki' ? 'A circle' : l.id === 'project' ? 'A square' : 'A diamond'} marks a page of this source.`}>
        <LensGlyph lens={l.id} x={10} y={11 + k * 11} state={seatOf(v, l.id)} />
        {mode === 'whole' && <text x={17} y={14 + k * 11} className="dp-axis">{l.name.toLowerCase()}</text>}
      </g>)}
      <line x1={bx0} y1={by} x2={bx1} y2={by} className="dp-faint" />
      {TICKS.map(t => <g key={t}>
        <line x1={at(t)} y1={by - 2} x2={at(t)} y2={by + 2} className="dp-faint" />
        <text x={at(t)} y={h - 2} className="dp-axis" textAnchor="middle">{t}</text>
      </g>)}
      {budget !== undefined && used !== undefined && used > 0 && <line x1={bx0} y1={by} x2={at(Math.min(used, budget))} y2={by} stroke="var(--dp-value)" strokeWidth={3} />}
      {budget !== undefined && used !== undefined && used > budget && <line x1={at(budget)} y1={by} x2={at(used)} y2={by} stroke="var(--stall)" strokeWidth={3} />}
      {budget === undefined && used !== undefined && used > 0 && <line x1={bx0} y1={by} x2={at(used)} y2={by} stroke="var(--dp-value)" strokeWidth={3} />}
      {set && depth !== undefined && <Handle n={1} x={hx} y={hy} label="Link depth" shape="ring" tone="value"
        does="Drag out or in: how many links the agent follows from a hit."
        onDrag={(x, y) => { const d = Math.round(clampTo(0, 4, Math.hypot(x - G.cx, y - G.cy) / G.step)); if (d !== depth) set('depth', d) }}
        onReset={() => set('depth', DEFAULT_DEPTH)} />}
      {set && budget !== undefined && <Handle n={2} x={at(budget)} y={by} label="Read budget" shape="square"
        does="Drag along the bar: the most pages the agent opens in one task."
        onDrag={x => { const b = Math.round(fromUnit(BUDGET, (x - bx0) / (bx1 - bx0))); if (b !== Math.round(budget)) set('budget', b) }}
        onReset={() => set('budget', DEFAULT_BUDGET)} />}
    </g>}
  </g>
}

/** A lens's shape in the well's legend, in the state the agent has it: open, or closed for a reason. */
function LensGlyph({lens, x, y, state}: {lens: Lens; x: number; y: number; state: Seat}) {
  const open = state === 'open'
  return <NodeShape lens={lens} x={x} y={y} r={3} state={open ? 'read' : state === 'unknown' || state === 'off' ? 'beyond' : 'closed'} />
}

// ---------------------------------------------------------------- the lists

const via = (x: Page) => (x.via === 'search' ? 'search' : x.via === 'direct' ? 'direct' : x.via === 'link' ? `link ${x.hop ?? ''}`.trim() : NONE)

/** Your requests beside the owner's answers: the square is the request, the mark is the owner's answer for that source. */
function sourceRows(v: V, compact?: boolean): RowItem[] {
  return LENSES.map((l): RowItem => {
    const seat = seatOf(v, l.id), ready = readyOf(v, l.id), why = strOf(v, `why:${l.id}`)
    const reason = seat === 'beyond' ? 'Above the Reach. The source stays closed.' : (seat === 'withheld' || ready === 'degraded') ? why : undefined
    return {
      id: l.id, name: l.name, request: boolOf(v, l.id), light: seat === 'open' ? 'lit' : seat === 'unknown' ? 'unknown' : 'dark', tone: 'value',
      mark: <LensMark lens={l.id} state={ready ?? 'unknown'} />, note: compact ? undefined : seat === 'beyond' ? 'above' : ready ?? NONE, why: reason,
      does: seat === 'unknown' ? `${l.does} The owner has not said whether it answers.` : l.does,
    }
  })
}

function pageRows(v: V): RowItem[] {
  const pages = pagesOf(v)
  if (!pages) return [{id: 'none', name: 'No reading of the pages', light: 'unknown'}]
  if (!pages.length) return [{id: 'none', name: 'No pages read', light: 'unknown'}]
  return pages.map((x): RowItem => ({id: x.id, name: x.title, light: 'lit', tone: 'value', mark: <LensMark lens={x.lens} state="ready" />, note: via(x),
    does: `${x.ref ?? x.title}. Found by ${x.via === 'search' ? 'a search' : x.via === 'direct' ? 'a direct request' : x.via === 'link' ? 'a link' : 'a route that the owner did not say'}.`}))
}

/** The pages the agent read, and the most it may read: a pager over the owner's list. */
function Pages({v, size}: {v: V; size: number}) {
  const [page, setPage] = useState(0)
  const n = pagesOf(v)?.length, budget = numOf(v, 'budget')
  return <Rows label={n === undefined ? 'Pages read' : `Pages read · ${n}${budget === undefined ? '' : ` of ${Math.round(budget)}`}`}
    does="The pages the agent opened in this task. The mark is the source; the note is how the agent reached the page."
    items={pageRows(v)} size={size} page={page} onPage={setPage} />
}

// ---------------------------------------------------------------- the controls

const DepthDial = ({p}: {p: ViewProps}) =>
  <Dial label="Depth" does="Link depth: how many links the agent follows from a hit. 0 keeps it on the hit." value={numOf(p.v, 'depth') ?? NaN} def={DEFAULT_DEPTH} scale={DEPTH}
    format={x => String(Math.round(x))} onChange={x => p.set('depth', Math.round(x))} {...stand(p, 'depth')} />
const BudgetDial = ({p}: {p: ViewProps}) =>
  <Dial label="Budget" does="Read budget: the most pages the agent opens in one task." value={numOf(p.v, 'budget') ?? NaN} def={DEFAULT_BUDGET} scale={BUDGET}
    format={x => String(Math.round(x))} onChange={x => p.set('budget', Math.round(x))} {...stand(p, 'budget')} />
const RouteReadout = ({v}: {v: V}) => {
  const r = routeOf(v)
  return <Readout label="route" does="Whether the sources that you asked for answer. Each row of Sources says why when one does not." value={r}
    tone={r === 'Ready' ? 'green' : r === undefined || r === 'Off' ? undefined : 'stall'} />
}
const SearchFirst = ({p}: {p: ViewProps}) =>
  <Toggle label="Search first" does="The agent searches before it opens a page." on={boolOf(p.v, 'searchFirst') === true} unknown={boolOf(p.v, 'searchFirst') === undefined}
    onChange={x => p.set('searchFirst', x)} {...stand(p, 'searchFirst')} />

const PICTURE = 'The links round the last hit. Teal: pages the agent may open; filled: pages it read; faint: past the Link depth. Circle: wiki. Square: project. Diamond: code. Drag handle 1 for the Link depth and handle 2 for the Read budget.'
const cornerOf = (v: V) => { const d = numOf(v, 'depth'); return d === undefined ? NONE : `depth ${Math.round(d)}` }

// ---------------------------------------------------------------- the pane: the knowledge in reach

function Pane({p}: {p: ViewProps}) {
  const v = p.v, g = graphOf(v), pages = pagesOf(v), budget = numOf(v, 'budget')
  const W = 460, H = 380
  return <div className="ref-pane-body kr-pane">
    <div className="ref-pane-tabs" role="tablist" aria-label="Knowledge route">
      <button type="button" role="tab" aria-selected={pageOf(p) === 'route'} onClick={() => p.setPage('route')}>Knowledge in reach{g ? ` · ${g.nodes.find(n => n.id === g.focus)?.title ?? ''}` : ''}</button>
      <button type="button" role="tab" aria-selected={pageOf(p) === 'affected'} onClick={() => p.setPage('affected')}>Affected{(() => { const a = affectedOf(v); return a ? ` · ${a.readings.length}${a.truncated ? '+' : ''}` : '' })()}</button>
    </div>
    {pageOf(p) === 'affected' ? <AffectedSheet p={p} /> : <div className="kr-sheet">
      <div className="kr-graph">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="The links round the last hit">
          <g className="dp-display" style={{background: 'none', border: 0}}><Graphic v={v} w={W} h={H} mode="full" /></g>
        </svg>
        {g?.truncated && <p className="kr-cut">The owner cut this graph at its limit. Some links are not drawn.</p>}
      </div>
      <aside className="kr-side">
        <section aria-label="Sources">
          <h4>Sources</h4>
          <ul className="kr-lens">
            {LENSES.map(l => {
              const seat = seatOf(v, l.id), ready = readyOf(v, l.id), why = strOf(v, `why:${l.id}`)
              return <li key={l.id} data-seat={seat} data-i={`${l.name}|${l.does}`}>
                <LensMark lens={l.id} state={ready ?? 'unknown'} />
                <b>{l.name}</b>
                <span>{seat === 'off' ? 'not asked' : seat === 'beyond' ? 'above the Reach' : seat === 'unknown' ? NONE : ready ?? NONE}</span>
                {(seat === 'beyond' || ready === 'withheld' || ready === 'degraded') && <small>{seat === 'beyond' ? 'The Reach is below the level that holds this source.' : why ?? ''}</small>}
              </li>
            })}
          </ul>
        </section>
        <section aria-label="Pages read" className="kr-read">
          <h4>Pages read{pages ? ` · ${pages.length}${budget === undefined ? '' : ` of ${Math.round(budget)}`}` : ''}</h4>
          {pages === undefined ? <p className="kr-empty">No reading of the pages.</p>
            : pages.length === 0 ? <p className="kr-empty">The agent has read no page in this task.</p>
              : <ol className="kr-pages">{pages.map(x => <li key={x.id} data-i={`${x.title}|${x.ref ?? x.title}`}>
                <LensMark lens={x.lens} state="ready" />
                <span className="kr-title">{x.title}</span>
                <em>{via(x)}</em>
                <button type="button" onClick={() => p.set('open', x.id)} data-i={`Open source|Open ${x.title} at its source.`}>Open</button>
              </li>)}</ol>}
        </section>
        <footer className="kr-foot">
          <span>Reach <b>{levelName(v) ?? NONE}</b></span>
          <span>Link depth <b>{numOf(v, 'depth') ?? NONE}</b></span>
          <span>Search first <b>{boolOf(v, 'searchFirst') === undefined ? NONE : boolOf(v, 'searchFirst') ? 'On' : 'Off'}</b></span>
        </footer>
      </aside>
    </div>}
  </div>
}

// ---------------------------------------------------------------- Affected: what a changed source has moved

type Fresh = 'basis-changed' | 'integration-pending' | 'basis-unavailable'
interface Moved {readonly source: string; readonly title: string; readonly basis?: string; readonly observed?: string; readonly kind?: string}
interface Hit {readonly id: string; readonly title: string; readonly lens: Lens; readonly freshness: Fresh; readonly source: string; readonly hops: number; readonly relation?: string}
interface Affected {readonly cursor?: number; readonly changed: readonly Moved[]; readonly readings: readonly Hit[]; readonly pending?: number; readonly truncated: boolean}
const FRESH: readonly Fresh[] = ['basis-changed', 'integration-pending', 'basis-unavailable']
const FRESH_WORD: Readonly<Record<Fresh, string>> = {'basis-changed': 'source moved', 'integration-pending': 'waits to integrate', 'basis-unavailable': 'source gone'}
const FRESH_SHORT: Readonly<Record<Fresh, string>> = {'basis-changed': 'moved', 'integration-pending': 'waits', 'basis-unavailable': 'gone'}
const FRESH_SAYS: Readonly<Record<Fresh, string>> = {
  'basis-changed': 'The source it rests on has a new revision. Read it again to stand on the new one.',
  'integration-pending': 'An integrative reading: one of its parts moved, and it waits until its parts are read again.',
  'basis-unavailable': 'The source it rests on can no longer be read. Forget it, or find where the source went.',
}

/** The owner's impact reading, or undefined when it reports none. */
function affectedOf(v: V): Affected | undefined {
  const raw = json<unknown>(v, 'affected', undefined)
  if (!isObj(raw)) return undefined
  const changed = (Array.isArray(raw.changed) ? raw.changed : []).flatMap((x): Moved[] => (isObj(x) && typeof x.source === 'string'
    ? [{source: x.source, title: typeof x.title === 'string' ? x.title : x.source, basis: typeof x.basis === 'string' ? x.basis : undefined,
      observed: typeof x.observed === 'string' ? x.observed : undefined, kind: typeof x.kind === 'string' ? x.kind : undefined}] : []))
  const readings = (Array.isArray(raw.readings) ? raw.readings : []).flatMap((x): Hit[] => (isObj(x) && typeof x.id === 'string' && typeof x.title === 'string' && isLens(x.lens)
    && FRESH.includes(x.freshness as Fresh) && typeof x.source === 'string'
    ? [{id: x.id, title: x.title, lens: x.lens, freshness: x.freshness as Fresh, source: x.source, hops: typeof x.hops === 'number' ? Math.max(1, Math.round(x.hops)) : 1,
      relation: typeof x.relation === 'string' ? x.relation : undefined}] : []))
  return {cursor: typeof raw.cursor === 'number' ? raw.cursor : undefined, changed, readings, pending: typeof raw.pending === 'number' ? raw.pending : undefined, truncated: raw.truncated === true}
}
const chosenHit = (v: V, sel: string | undefined) => { const a = affectedOf(v); return a?.readings.find(x => x.id === sel) ?? a?.readings[0] }

/** A reading in the Affected picture: its lens's shape, drawn as its freshness says. */
function FreshShape({lens, x, y, r, fresh}: {lens: Lens; x: number; y: number; r: number; fresh: Fresh}) {
  const p = fresh === 'basis-changed' ? {fill: 'var(--dp-well)', stroke: 'var(--stall)', strokeWidth: 1.4}
    : fresh === 'integration-pending' ? {fill: 'var(--dp-well)', stroke: 'var(--dp-value)', strokeWidth: 1.2, strokeDasharray: '2 1.5'}
      : {fill: 'none', stroke: 'var(--text-faint)', strokeWidth: 1, strokeDasharray: '1.5 1.5'}
  return lens === 'wiki' ? <circle cx={x} cy={y} r={r} {...p} />
    : lens === 'project' ? <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...p} />
      : <polygon points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} {...p} />
}

/** The readings grouped under the source each rests on, nearest first, and each source at the middle of its readings. */
function arrange(a: Affected, ys: (n: number, i: number) => number) {
  const at = (s: string) => { const i = a.changed.findIndex(c => c.source === s); return i < 0 ? a.changed.length : i }
  const order = [...a.readings].sort((x, y) => at(x.source) - at(y.source) || x.hops - y.hops)
  const y = new Map(order.map((x, i) => [x.id, ys(order.length, i)]))
  const srcY = new Map(a.changed.map((c, i) => { const mine = order.filter(x => x.source === c.source).map(x => y.get(x.id)!); return [c.source, mine.length ? mine.reduce((s, v) => s + v, 0) / mine.length : ys(a.changed.length, i)] }))
  return {order, y, srcY}
}

/** The moved sources at the left, an orange square each; the readings that rest on them at the right, one column for each link of the path,
 * each in its lens's shape: orange when its source moved, dashed when it waits to integrate, faint when its source is gone. The chosen
 * reading is ringed and named along the foot. */
function AffectedWell({v, w, h, sel, onPick}: {v: V; w: number; h: number; sel?: string; onPick?: (id: string) => void}) {
  const a = affectedOf(v), hit = chosenHit(v, sel)
  if (!a) return <Display w={w} h={h} label="Affected" corner={NONE}><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of what moved</text></Display>
  if (!a.changed.length) return <Display w={w} h={h} label="Affected" corner="none moved"><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No source has moved</text></Display>
  const top = 18, bottom = h - 26, ys = (n: number, i: number) => (n <= 1 ? (top + bottom) / 2 : top + (i * (bottom - top)) / (n - 1))
  const sx = 14, col = (hops: number) => 52 + (Math.min(4, hops) - 1) * ((w - 70) / 3)
  const {order, y: yOf, srcY} = arrange(a, ys)
  return <Display w={w} h={h} label="Affected" corner={`${a.readings.length}${a.truncated ? '+' : ''} affected`}
    does="Moved sources at the left. At the right, the readings that rest on them, one column for each link of the path. Orange: its source moved. Dashed: it waits to integrate. Faint: its source is gone. Click a reading to choose it.">
    {[1, 2, 3, 4].map(k => <text key={k} x={col(k)} y={h - 15} className="dp-axis" textAnchor="middle">{k}</text>)}
    {a.changed.map(c => <g key={c.source} data-i={`${c.title}|Moved${c.basis && c.observed ? ` from ${c.basis} to ${c.observed}` : ''}${c.kind ? ` (${c.kind})` : ''}.`}>
      <rect x={sx - 3.5} y={srcY.get(c.source)! - 3.5} width={7} height={7} fill="var(--stall)" />
    </g>)}
    {order.map(x => {
      const y = yOf.get(x.id)!, y0 = srcY.get(x.source) ?? (top + bottom) / 2, x1 = col(x.hops)
      return <g key={x.id} data-i={`${x.title}|${FRESH_WORD[x.freshness]}, ${x.hops} link${x.hops === 1 ? '' : 's'} from what moved. ${onPick ? 'Click to choose it.' : ''}`}
        onClick={onPick ? () => onPick(x.id) : undefined} style={onPick ? {cursor: 'pointer'} : undefined}>
        <path d={`M${sx + 4} ${y0}C${(sx + x1) / 2} ${y0} ${(sx + x1) / 2} ${y} ${x1 - 6} ${y}`} stroke={x.freshness === 'basis-unavailable' ? 'var(--text-faint)' : 'var(--dp-value)'}
          strokeWidth={1} opacity={.5} fill="none" strokeDasharray={x.freshness === 'basis-unavailable' ? '2 2' : undefined} />
        <FreshShape lens={x.lens} x={x1} y={y} r={3.6} fresh={x.freshness} />
        {hit?.id === x.id && <circle cx={x1} cy={y} r={7.5} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />}
      </g>
    })}
    <text x={6} y={h - 4} className="dp-ink-dim">{hit ? fit(hit.title, w - 12) : NONE}</text>
  </Display>
}

function affectedRows(v: V): RowItem[] {
  const a = affectedOf(v)
  if (!a) return [{id: 'none', name: 'No reading of what moved', light: 'unknown'}]
  if (!a.readings.length) return [{id: 'none', name: a.changed.length ? 'Nothing the agent read rests on what moved' : 'No source has moved', light: 'lit', tone: 'green'}]
  return a.readings.map(x => ({id: x.id, name: x.title, light: x.freshness === 'basis-unavailable' ? 'dark' : 'lit', tone: x.freshness === 'basis-changed' ? 'stall' : 'value',
    mark: <LensMark lens={x.lens} state={x.freshness === 'basis-changed' ? 'degraded' : x.freshness === 'integration-pending' ? 'ready' : 'withheld'} />,
    note: FRESH_WORD[x.freshness], why: x.freshness === 'basis-unavailable' ? FRESH_SAYS['basis-unavailable'] : undefined,
    does: `${FRESH_SAYS[x.freshness]} It rests on ${a.changed.find(c => c.source === x.source)?.title ?? x.source}, ${x.hops} link${x.hops === 1 ? '' : 's'} away.`}))
}

function AffectedBands({p}: {p: ViewProps}) {
  const [sel, setSel] = useState<string | undefined>(undefined), [page, setPage] = useState(0)
  const a = affectedOf(p.v), x = chosenHit(p.v, sel), moved = a?.changed.find(c => c.source === x?.source)
  const count = (f: Fresh) => a?.readings.filter(y => y.freshness === f).length
  return <>
    <Band>
      <Section width={206}><AffectedWell v={p.v} w={194} h={146} sel={x?.id} onPick={setSel} /></Section>
      <Section label="Reading" width={104}>
        <Chooser label="Reading" wide does="The reading the readouts and the acts are for." value={x?.id ?? ''} options={(a?.readings ?? []).map(y => ({value: y.id, label: y.title}))} onChange={setSel} />
        <Readout label="freshness" does="Source moved, waits to integrate, or source gone." value={x ? FRESH_WORD[x.freshness] : undefined} tone={x?.freshness === 'basis-changed' ? 'stall' : 'value'} />
        <Readout label="rests on" does={moved ? `${moved.title}${moved.basis && moved.observed ? `: ${moved.basis} → ${moved.observed}` : ''}` : 'The moved source the reading rests on.'} value={moved ? fit(moved.title, 100) : undefined} />
        <Readout label="links" does="How many links lie between the moved source and the reading." value={x?.hops} />
      </Section>
      <Section label="Tend" grow>
        <Action {...st(p, 'refresh')} label="Read again" does="Read it at the new revision of its source. AIKit records the use." onPress={x && x.freshness !== 'basis-unavailable' ? () => p.set('refresh', x.id) : undefined}
          disabled={st(p, 'refresh').disabled ?? (x?.freshness === 'basis-unavailable' ? 'Its source is gone: there is nothing to read again.' : undefined)} />
        <Action {...st(p, 'forget')} hold label="Forget" does="AIKit forgets having used this reading, so the route no longer ranks it from memory. The source is untouched." onPress={x ? () => p.set('forget', x.id) : undefined} />
        <Readout label="moved" does="Sources that moved since the agent read them." value={a?.changed.length} tone="stall" />
        <Readout label="waiting" does="Integrative readings that wait for their parts." value={a?.pending ?? count('integration-pending')} />
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={a ? `Affected · ${a.readings.length}${a.truncated ? '+' : ''} readings rest on ${a.changed.length} moved source${a.changed.length === 1 ? '' : 's'}` : 'Affected'}
        does="Each reading a moved source affects. Orange: its source moved. The mark is its source's lens." items={affectedRows(p.v)} size={14} columns={2}
        page={page} onPage={setPage} selected={x?.id} onSelect={setSel} /></Section>
    </Band>
  </>
}

type PageId = 'route' | 'affected'
const PAGE_IDS: readonly {id: PageId; label: string}[] = [{id: 'route', label: 'Route'}, {id: 'affected', label: 'Affected'}]
const pageOf = (p: ViewProps): PageId => (p.page === 'affected' ? 'affected' : 'route')
/** Affected is dark while a reading rests on a source that moved. */
const affectedLight = (v: V): LightState | undefined => { const a = affectedOf(v); return a === undefined ? undefined : a.readings.length ? 'dark' : 'lit' }

/** The pane's Affected tab: what moved, and every reading that rests on it, each with Read again and Forget. */
function AffectedSheet({p}: {p: ViewProps}) {
  const a = affectedOf(p.v), [sel, setSel] = useState<string | undefined>(undefined)
  const W = 460, H = 380
  return <div className="kr-sheet">
    <div className="kr-graph">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="What moved and what rests on it">
        <g className="dp-display" style={{background: 'none', border: 0}}><AffectedBig v={p.v} w={W} h={H} sel={chosenHit(p.v, sel)?.id} onPick={setSel} /></g>
      </svg>
      {a?.truncated && <p className="kr-cut">The owner cut the list at its limit. More readings rest on what moved.</p>}
    </div>
    <aside className="kr-side">
      <section aria-label="Moved">
        <h4>Moved{a ? ` · ${a.changed.length}` : ''}</h4>
        {!a ? <p className="kr-empty">No reading of what moved.</p> : !a.changed.length ? <p className="kr-empty">No source has moved.</p>
          : <ul className="kr-lens kr-moved">{a.changed.map(c => <li key={c.source} data-i={`${c.title}|${c.source}`}>
            <svg className="kr-mark" width={10} height={10} aria-hidden="true"><rect x={1.5} y={1.5} width={7} height={7} fill="var(--stall)" /></svg>
            <b>{c.title}</b><span>{c.basis && c.observed ? `${c.basis} → ${c.observed}` : c.kind ?? NONE}</span>
          </li>)}</ul>}
      </section>
      <section aria-label="Affected" className="kr-read">
        <h4>Affected{a ? ` · ${a.readings.length}${a.truncated ? '+' : ''}` : ''}{a?.pending ? ` · ${a.pending} waiting` : ''}</h4>
        {!a ? <p className="kr-empty">No reading of what moved.</p> : !a.readings.length ? <p className="kr-empty">Nothing the agent read rests on what moved.</p>
          : <ol className="kr-pages kr-affected">{a.readings.map(x => <li key={x.id} data-fresh={x.freshness} data-i={`${x.title}|${FRESH_SAYS[x.freshness]}`}>
            <LensMark lens={x.lens} state={x.freshness === 'basis-changed' ? 'degraded' : x.freshness === 'integration-pending' ? 'ready' : 'withheld'} />
            <span className="kr-title">{x.title}</span>
            <em>{FRESH_SHORT[x.freshness]}</em>
            <button type="button" disabled={x.freshness === 'basis-unavailable' || !!st(p, 'refresh').disabled} onClick={() => p.set('refresh', x.id)}
              data-i={`Read again|${st(p, 'refresh').disabled ?? `Read ${x.title} at the new revision of its source.`}`}>Read</button>
            <button type="button" disabled={!!st(p, 'forget').disabled} onClick={() => p.set('forget', x.id)}
              data-i={`Forget|${st(p, 'forget').disabled ?? 'AIKit forgets having used it. The source is untouched.'}`}>Forget</button>
          </li>)}</ol>}
      </section>
      <footer className="kr-foot">
        <span>Horizon <b>{a?.cursor ?? NONE}</b></span>
        <span>Source moved <b>{a ? a.readings.filter(x => x.freshness === 'basis-changed').length : NONE}</b></span>
        <span>Source gone <b>{a ? a.readings.filter(x => x.freshness === 'basis-unavailable').length : NONE}</b></span>
      </footer>
    </aside>
  </div>
}

/** The Affected picture at pane size, every reading named. */
function AffectedBig({v, w, h, sel, onPick}: {v: V; w: number; h: number; sel?: string; onPick: (id: string) => void}) {
  const a = affectedOf(v)
  if (!a) return <text x={w / 2} y={h / 2} className="dp-axis" textAnchor="middle">No reading of what moved</text>
  if (!a.changed.length) return <text x={w / 2} y={h / 2} className="dp-axis" textAnchor="middle">No source has moved</text>
  const top = 40, bottom = h - 40, ys = (n: number, i: number) => (n <= 1 ? (top + bottom) / 2 : top + (i * (bottom - top)) / (n - 1))
  const sx = 30, col = (hops: number) => 180 + (Math.min(4, hops) - 1) * 70
  const {order, y: yOf, srcY} = arrange(a, ys)
  return <g>
    <text x={sx} y={18} className="dp-axis">moved</text>
    {[1, 2, 3, 4].map(k => <text key={k} x={col(k)} y={18} className="dp-axis" textAnchor="middle">{k} link{k === 1 ? '' : 's'}</text>)}
    {a.changed.map(c => <g key={c.source}>
      <rect x={sx - 5} y={srcY.get(c.source)! - 5} width={10} height={10} fill="var(--stall)" />
      <text x={sx - 5} y={srcY.get(c.source)! + 18} className="dp-ink">{fit(c.title, 135)}</text>
    </g>)}
    {order.map(x => {
      const y = yOf.get(x.id)!, y0 = srcY.get(x.source) ?? (top + bottom) / 2, x1 = col(x.hops)
      return <g key={x.id} onClick={() => onPick(x.id)} style={{cursor: 'pointer'}} data-i={`${x.title}|${FRESH_SAYS[x.freshness]}`}>
        <path d={`M${sx + 6} ${y0}C${(sx + x1) / 2} ${y0} ${(sx + x1) / 2} ${y} ${x1 - 8} ${y}`} stroke={x.freshness === 'basis-unavailable' ? 'var(--text-faint)' : 'var(--dp-value)'}
          strokeWidth={1} opacity={.5} fill="none" strokeDasharray={x.freshness === 'basis-unavailable' ? '2 2' : undefined} />
        <FreshShape lens={x.lens} x={x1} y={y} r={5} fresh={x.freshness} />
        {sel === x.id && <circle cx={x1} cy={y} r={9.5} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />}
        <text x={x1 + 10} y={y + 3.5} className={x.freshness === 'basis-unavailable' ? 'dp-ink-dim' : 'dp-ink'}>{fit(x.title, w - x1 - 16)}</text>
      </g>
    })}
  </g>
}

// ---------------------------------------------------------------- fixture data: real names from the owner's code and data

const PAGES: readonly Page[] = [
  {id: 'v', title: 'architecture/verification.md', lens: 'project', via: 'search', hop: 0, ref: 'docs/architecture/verification.md'},
  {id: 'cv', title: 'cradle/04-VERIFICATION.md', lens: 'project', via: 'link', hop: 1, ref: 'docs/cradle/04-VERIFICATION.md'},
  {id: 'ct', title: 'verification-before-completion', lens: 'project', via: 'link', hop: 1, ref: 'skill/personal/verification-before-completion'},
  {id: 'wr', title: 'central:wiki:root', lens: 'wiki', via: 'link', hop: 1, ref: 'central:wiki:root'},
  {id: 'we', title: 'wiki:Archetypal-Earth', lens: 'wiki', via: 'link', hop: 2, ref: 'central:wiki:project:Archetypal-Earth'},
]
const GRAPH = {
  focus: 'v',
  nodes: [
    {id: 'v', title: 'architecture/verification.md', lens: 'project'}, {id: 'cv', title: 'cradle/04-VERIFICATION.md', lens: 'project'},
    {id: 'ct', title: 'verification-before-completion', lens: 'project'}, {id: 'ak', title: 'AIKit verification and conformance', lens: 'project'},
    {id: 'wr', title: 'central:wiki:root', lens: 'wiki'}, {id: 'wa', title: 'wiki:Actuation', lens: 'wiki'}, {id: 'we', title: 'wiki:Archetypal-Earth', lens: 'wiki'},
    {id: 'kn', title: 'knowledge.rs', lens: 'code'}, {id: 'rq', title: 'request_args', lens: 'code'}, {id: 'rb', title: 'relations_batch', lens: 'code'},
    {id: 'de', title: 'decode_envelope', lens: 'code'}, {id: 'sg', title: 'experience/SESSION-GROUNDING.md', lens: 'project'}, {id: 'dl', title: 'dlw/DLW.md', lens: 'project'},
  ],
  edges: [['v', 'cv'], ['v', 'ct'], ['v', 'ak'], ['v', 'wr'], ['v', 'kn'], ['wr', 'wa'], ['wr', 'we'], ['kn', 'rq'], ['kn', 'rb'], ['rq', 'de'], ['cv', 'sg'], ['sg', 'dl']],
  truncated: false,
}
// With the wiki withheld, the wiki pages do not resolve: the view holds the project and the code alone.
const GRAPH_NO_WIKI = {
  ...GRAPH,
  nodes: GRAPH.nodes.filter(n => n.lens !== 'wiki'),
  edges: GRAPH.edges.filter(([a, b]) => !['wr', 'wa', 'we'].includes(a!) && !['wr', 'wa', 'we'].includes(b!)),
}
const PAGES_NO_WIKI = PAGES.filter(x => x.lens !== 'wiki')

const ALL: readonly string[] = ['light', 'wiki', 'project', 'code', 'searchFirst', 'depth', 'budget', 'reach', 'pages', 'graph', 'ready:wiki', 'ready:project', 'ready:code',
  'why:wiki', 'why:project', 'why:code', 'level:wiki', 'level:project', 'level:code', 'affected']
// What moved since the agent read: O-I's verification architecture and the root wiki took new revisions (Central's change horizon at
// cursor 4182); the readings resting on them, by the dependency manifests, with the paths' lengths.
const AFFECTED = {
  cursor: 4182, pending: 1, truncated: false,
  changed: [
    {source: 'central:source:project:O-I:docs/architecture/verification.md', title: 'architecture/verification.md', basis: 'r12', observed: 'r13', kind: 'modified'},
    {source: 'central:wiki:root', title: 'central:wiki:root', basis: 'r40', observed: 'r41', kind: 'modified'},
  ],
  readings: [
    {id: 'v', title: 'architecture/verification.md', lens: 'project', freshness: 'basis-changed', source: 'central:source:project:O-I:docs/architecture/verification.md', hops: 1, relation: 'reads'},
    {id: 'cv', title: 'cradle/04-VERIFICATION.md', lens: 'project', freshness: 'basis-changed', source: 'central:source:project:O-I:docs/architecture/verification.md', hops: 2, relation: 'cites'},
    {id: 'sg', title: 'experience/SESSION-GROUNDING.md', lens: 'project', freshness: 'basis-changed', source: 'central:source:project:O-I:docs/architecture/verification.md', hops: 3, relation: 'cites'},
    {id: 'wr', title: 'central:wiki:root', lens: 'wiki', freshness: 'basis-changed', source: 'central:wiki:root', hops: 1, relation: 'reads'},
    {id: 'we', title: 'wiki:Archetypal-Earth', lens: 'wiki', freshness: 'integration-pending', source: 'central:wiki:root', hops: 2, relation: 'integrates'},
    {id: 'kn', title: 'knowledge.rs', lens: 'code', freshness: 'basis-unavailable', source: 'central:source:project:O-I:docs/architecture/verification.md', hops: 2, relation: 'implements'},
  ],
}

export const design: DesignedDevice = {
  id: 'ai-kit:knowledge-route',
  title: 'Knowledge route',
  kind: 'effect',
  defaults: {
    light: 'lit', wiki: true, project: true, code: false, searchFirst: true, depth: DEFAULT_DEPTH, budget: DEFAULT_BUDGET,
    // Readings: Scope's Reach, the level that holds each source, each source's answer, the pages read and the links round the last hit.
    reach: 3, 'level:wiki': 3, 'level:project': 2, 'level:code': 2,
    'ready:wiki': 'ready', 'ready:project': 'ready', 'ready:code': 'degraded',
    'why:code': 'GitNexus CodeIndex degraded for Work/O-I: index metadata exceeds 1 MiB',
    pages: JSON.stringify(PAGES), graph: JSON.stringify(GRAPH),
    // What moved since the agent read, and the readings resting on it (the Affected page).
    affected: JSON.stringify(AFFECTED),
  },
  firstPage: 'route',
  fixtures: {
    Ready: {},
    'Nothing moved': {affected: JSON.stringify({cursor: 4182, pending: 0, truncated: false, changed: [], readings: []})},
    'Wiki withheld': {'ready:wiki': 'withheld', 'why:wiki': 'Knowledge discovery withheld or unavailable (knowledge.wiki_publication_budget)', pages: JSON.stringify(PAGES_NO_WIKI), graph: JSON.stringify(GRAPH_NO_WIKI)},
    'No readings': Object.fromEntries(ALL.map(k => [k, undefined])) as Record<string, Value | undefined>,
  },

  folded: p => {
    const known = LENSES.filter(l => has(p.v, l.id)), asked = known.filter(l => boolOf(p.v, l.id) === true).length
    return <Folded title="Knowledge" light={light(p)} readings={[known.length ? `${asked} source${asked === 1 ? '' : 's'}` : NONE, cornerOf(p.v)]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Knowledge route" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Links and budget" does={PICTURE} corner={cornerOf(p.v)}>
        <Graphic v={p.v} set={p.set} w={140} h={146} mode="compact" />
      </Display>
    </Section>
    <Section label="Sources" width={92}>
      <Rows does="The square is your request. The mark is the owner's answer for that source: full when ready, orange when degraded, dashed when withheld."
        items={sourceRows(p.v, true)} size={3} onRequest={(id, now) => p.set(id, now)} />
    </Section>
    <Section label="Macros" cols={2}>
      <DepthDial p={p} />
      <BudgetDial p={p} />
      <RouteReadout v={p.v} />
    </Section>
  </Panel>,

  whole: p => <Panel title="Knowledge route" view="whole" {...head(p)} pages={PAGE_IDS.map(x => ({id: x.id, label: x.label, light: x.id === 'affected' ? affectedLight(p.v) : undefined}))}
    page={pageOf(p)} onPage={p.setPage}>
    {pageOf(p) === 'affected' ? <AffectedBands p={p} /> : <>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="Links and budget" does={PICTURE} corner={cornerOf(p.v)}>
          <Graphic v={p.v} set={p.set} w={194} h={146} mode="whole" />
        </Display>
      </Section>
      <Section label="Bounds" cols={3} grow>
        <DepthDial p={p} />
        <BudgetDial p={p} />
        <Readout label="reach" does="The widest part of the world whose knowledge the agent may read. Scope sets it." value={levelName(p.v)} tone="value" />
        <Readout label="in view" does="Pages in the graph. A plus means the owner cut the graph at its limit." value={(() => { const g = graphOf(p.v); return g ? `${g.nodes.length}${g.truncated ? '+' : ''}` : undefined })()} />
        <RouteReadout v={p.v} />
      </Section>
    </Band>
    <Band>
      <Section label="Order" width={92}>
        <SearchFirst p={p} />
        <Readout label="searched" does="Pages the agent reached by a search." value={count(p.v, x => x.via === 'search')} />
        <Readout label="linked" does="Pages the agent reached by a link." value={count(p.v, x => x.via === 'link')} />
      </Section>
      <Section label="Sources" width={132}>
        <Rows does="The square is your request. The mark is the owner's answer for that source: full when ready, orange when degraded, dashed when withheld."
          items={sourceRows(p.v)} size={3} onRequest={(id, now) => p.set(id, now)} />
      </Section>
      <Section grow><Pages v={p.v} size={7} /></Section>
    </Band>
    </>}
  </Panel>,

  full: p => <Pane p={p} />,

  widget: p => {
    const n = pagesOf(p.v)?.length, budget = numOf(p.v, 'budget')
    return <Tile title="Knowledge route" light={light(p)} span={2} onFull={p.nav.full}>
      <Display w={104} h={104} label="Links" does={PICTURE}>
        <Graphic v={p.v} w={104} h={104} mode="tile" />
      </Display>
      <div className="ref-tile-side">
        <Readout label="read" does="Pages the agent opened in this task, and the most it may open." value={n === undefined || budget === undefined ? undefined : `${n} / ${Math.round(budget)}`} tone="value" />
        <Readout label="route" does="Whether the sources that you asked for answer." value={routeOf(p.v)} tone={routeOf(p.v) === 'Ready' ? 'green' : routeOf(p.v) === undefined || routeOf(p.v) === 'Off' ? undefined : 'stall'} />
        <Readout label="link depth" does="How many links the agent follows from a hit." value={numOf(p.v, 'depth')} />
      </div>
    </Tile>
  },
}
