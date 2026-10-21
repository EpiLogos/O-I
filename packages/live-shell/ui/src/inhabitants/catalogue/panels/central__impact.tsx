// Impact (manual §18.6): what a change to a folder or a note will touch. Live's nearest: Utility — a small effect whose meaning is
// plain at a glance — with the Scope pattern for a picture of reach on rings. The picture is the neighbourhood itself: the subject
// at the centre and one ring for each link out. The device reads three owners and keeps no index: the knowledge graph (the nodes and
// edges of `oi.cradle.graph-reading/v1`), the folder listing and file map, and the NOW register. The owner's cut of the graph is
// inhabitants/centralImpactModel.ts (projectNeighbourhood, projectSessions); this panel draws the same roles (node, source, other)
// and the same split of direct and indirect links, and walks the reading's edges to Depth.
//
// Bindable: the material is value keys, each a JSON string shaped as centralImpactModel.ts shapes it. `subject` is
// {kind, path, ref}; `nodes` is [{ref, role}]; `edges` is [{fromRef, toRef, relation, provenance, direct}]; `references` is the
// directory entries [{name, kind, byte_len, location:{path}}]; `sessions` is the touching NOW records [{nowRef, purpose, lifecycle,
// work:["repo @ branch"]}]. The Links list is the edges inside the reach of Depth, so it has no key of its own. `refusal:graph` is
// the graph owner's own words when it refuses. A key the owner does not report is drawn "—", and the well names the reading that is
// missing. The sample readings sit in the defaults and the fixtures: the wiki register's own relations around a wayfinder note,
// the real directory of Work/Quaternal-Logic/schemas, and the real NOW register's work refs.
//
// Its second page, Meaning, asks whether the code still says what the product means. The owner is AIKit's project reflection
// (crates/aikit-core/src/project_reflection.rs, aikit.project-reflection/v1), read by `aikit knowledge frame <subject>`: the subject's
// meaning (Vision, Design, the wiki), its native descriptions, its code and its verification, each a relation of the project map, and the
// target's own reflection law checked against them (ReflectionVerification: passed, and each issue missing | wrong-relation | duplicate |
// stale | constitutive-flattening). Meaning and code keep their own owners; the law only relates them.
//   meaning   {law, revision, passed, truncated, lenses: {meaning, descriptions, code, verification}, mappings: [{coordinate, semantic,
//             implementation?, relation?, state: 'holds' | <issue kind>, detail?}]}  the law's mappings with the verification's issues laid on
//             them; JSON with no mappings when no law binds the subject
// Act: meaningRead (read the frame again). `aikit knowledge frame` has no kernel op yet (the kernel's knowledge requests are status,
// search, resolve, read, relations, explain, history and use): the host leaves `meaning` absent and stands Read now disabled until one does.
import {useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './central__impact.css'

type V = ViewProps['v']

// ------------------------------------------------------------------------------------------------ the vocabulary

type Role = 'node' | 'source' | 'unknown'

/** The owner's relation names, in the words the Relation chooser shows. */
const REL: Readonly<Record<string, string>> = {'node-source': 'Source', 'node-space': 'Space', 'space-child-space': 'Child space', 'wiki-link': 'Link', references: 'Reference'}
const relName = (r: string) => (r === '' ? NONE : REL[r] ?? r)

/** The owner's three sources, as the lists name them. */
const SOURCE = {links: 'knowledge graph', folder: 'folder listing', mentions: 'file map', sessions: 'NOW register'} as const

/** The owner's roles for a graph ref (centralImpactModel.ts projectNeighbourhood). */
const roleIn = (ref: string): Role => (ref.startsWith('wiki:node:') ? 'node' : ref.startsWith('central:source:') ? 'source' : 'unknown')
const tailOf = (s: string) => s.split('/').filter(Boolean).pop() ?? s
const labelOf = (ref: string): string => {
  if (ref.startsWith('wiki:node:')) return tailOf(ref.slice('wiki:node:'.length))
  if (ref === 'central:wiki:root') return 'root space'
  if (ref.startsWith('central:wiki:project:')) return ref.slice('central:wiki:project:'.length)
  return tailOf(ref)
}
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const MAX_DEPTH = 4
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const sizeText = (bytes: number) => (bytes < 1000 ? `${bytes} B` : bytes < 10000 ? `${(bytes / 1000).toFixed(1)}k` : `${Math.round(bytes / 1000)}k`)
const isOpen = (s: Session) => s.lifecycle === 'active' || s.lifecycle === 'quiescent'

// ------------------------------------------------------------------------------------------------ the readings, as the owner reports them

interface Subject {readonly kind: string | undefined; readonly path: string; readonly ref: string | undefined}
interface Edge {readonly from: string; readonly to: string; readonly relation: string; readonly provenance: string | null; readonly direct: boolean | undefined}
interface FileRow {readonly name: string; readonly path: string | undefined; readonly directory: boolean; readonly bytes: number | undefined}
interface Session {readonly id: string; readonly purpose: string; readonly lifecycle: string; readonly branch: string | undefined}

const rec = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
const text = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)
/** A JSON list of objects, or undefined when the owner reports none (or what it reports is not a list). */
function listOf(v: V, key: string): Record<string, unknown>[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  return Array.isArray(raw) ? raw.flatMap(x => { const o = rec(x); return o ? [o] : [] }) : undefined
}

function subjectOf(v: V): Subject | undefined {
  const o = rec(json<unknown>(v, 'subject', undefined)), path = text(o?.path)
  return o && path ? {kind: text(o.kind), path, ref: text(o.ref)} : undefined
}
function edgesOf(v: V): Edge[] | undefined {
  return listOf(v, 'edges')?.flatMap((o): Edge[] => {
    const from = text(o.fromRef), to = text(o.toRef)
    return from && to ? [{from, to, relation: text(o.relation) ?? '', provenance: text(o.provenance) ?? null, direct: typeof o.direct === 'boolean' ? o.direct : undefined}] : []
  })
}
/** The role the owner gives each ref of the neighbourhood; a ref it does not list takes the owner's rule by its prefix. */
function rolesOf(v: V): ReadonlyMap<string, Role> {
  const out = new Map<string, Role>()
  for (const o of listOf(v, 'nodes') ?? []) { const ref = text(o.ref); if (ref) out.set(ref, o.role === 'node' || o.role === 'source' ? o.role : 'unknown') }
  return out
}
function filesOf(v: V): FileRow[] | undefined {
  return listOf(v, 'references')?.flatMap((o): FileRow[] => {
    const name = text(o.name), where = rec(o.location)
    return name ? [{name, path: text(where?.path) ?? text(where?.ref), directory: o.kind === 'directory', bytes: typeof o.byte_len === 'number' && Number.isFinite(o.byte_len) ? o.byte_len : undefined}] : []
  })
}
function sessionsOf(v: V): Session[] | undefined {
  return listOf(v, 'sessions')?.flatMap((o, i): Session[] => {
    const nowRef = text(o.nowRef), purpose = text(o.purpose) ?? nowRef
    const work = Array.isArray(o.work) ? o.work.find((x): x is string => typeof x === 'string') : undefined
    return purpose ? [{id: `${i}:${nowRef ?? purpose}`, purpose, lifecycle: text(o.lifecycle) ?? '', branch: work?.match(/ @ (\S+)/)?.[1]}] : []
  })
}

// ------------------------------------------------------------------------------------------------ the law of the picture

interface Walk {readonly hop: ReadonlyMap<string, number>; readonly parent: ReadonlyMap<string, string>; readonly angle: ReadonlyMap<string, number>; readonly edges: readonly Edge[]}

/** The graph ref that stands for the subject: its own ref when the graph holds it, else the endpoint that cites its path (the owner's rule). */
function rootOf(s: Subject, edges: readonly Edge[]): string {
  const ends = new Set(edges.flatMap(x => [x.from, x.to]))
  if (s.ref && ends.has(s.ref)) return s.ref
  const tail = tailOf(s.path), byTail = (s.kind === 'note' || s.kind === 'day') && tail.length > 4
  return [...ends].find(ref => ref.includes(s.path) || (byTail && ref.includes(tail))) ?? s.ref ?? s.path
}

/** Walk the reading's edges from the subject, outward, to four links; only edges of the chosen relation carry the walk (no relation
 * reported: every edge does). Every node keeps its place whatever Depth is, so the picture moves only when a reading moves. */
function walk(root: string, all: readonly Edge[], relation: string | undefined): Walk {
  const edges = all.filter(x => relation === undefined || relation === 'all' || x.relation === relation)
  const near = new Map<string, string[]>()
  for (const x of edges) { near.set(x.from, [...(near.get(x.from) ?? []), x.to]); near.set(x.to, [...(near.get(x.to) ?? []), x.from]) }
  const hop = new Map<string, number>([[root, 0]]), parent = new Map<string, string>(), order = [root]
  for (let i = 0; i < order.length; i++) {
    const at = order[i]!, h = hop.get(at)!
    if (h >= MAX_DEPTH) continue
    for (const next of near.get(at) ?? []) if (!hop.has(next)) { hop.set(next, h + 1); parent.set(next, at); order.push(next) }
  }
  const kids = new Map<string, string[]>()
  for (const ref of order.slice(1)) kids.set(parent.get(ref)!, [...(kids.get(parent.get(ref)!) ?? []), ref])
  const leaves = (ref: string): number => { const k = kids.get(ref) ?? []; return k.length ? k.reduce((n, c) => n + leaves(c), 0) : 1 }
  const angle = new Map<string, number>()
  const place = (ref: string, a0: number, a1: number) => {
    angle.set(ref, (a0 + a1) / 2)
    const k = kids.get(ref) ?? [], total = leaves(ref)
    let at = a0
    for (const c of k) { const span = (a1 - a0) * leaves(c) / total; place(c, at, at + span); at += span }
  }
  place(root, 0, Math.PI * 2)
  return {hop, parent, angle, edges: edges.filter(x => hop.has(x.from) && hop.has(x.to))}
}

interface LinkRow {readonly edge: Edge; readonly direct: boolean; readonly hop: number}
/** Where a list stands: switched off, not reported, refused by its owner, or read. */
type Status = 'off' | 'unread' | 'refused' | 'read'

interface Model {
  readonly subject: Subject | undefined; readonly kind: string | undefined; readonly path: string | undefined; readonly root: string
  readonly depth: number | undefined; readonly relation: string | undefined
  readonly refusal: string | undefined
  /** The reading the graph picture lacks, if any: the subject, the graph, the depth. */
  readonly gap: 'subject' | 'graph' | 'depth' | undefined
  readonly status: {readonly links: Status; readonly refs: Status; readonly sessions: Status}
  readonly walk: Walk | null
  readonly roles: ReadonlyMap<string, Role>
  readonly kinds: readonly string[]
  readonly shown: readonly string[]; readonly ghost: readonly string[]
  readonly drawn: readonly Edge[]; readonly drawnGhost: readonly Edge[]
  readonly links: readonly LinkRow[]
  readonly files: readonly FileRow[]
  /** How the references stand to the subject: held by a folder, or mentioning a note; undefined when there is no subject. */
  readonly how: 'holds' | 'mentions' | undefined
  readonly sessions: readonly Session[]; readonly closedHidden: number
}

/** Everything the five views draw, from the one set of values. A list the owner has not reported stays unread, never empty. */
function model(v: V): Model {
  const subject = subjectOf(v), edges = edgesOf(v), files = filesOf(v), sessions = sessionsOf(v), roles = rolesOf(v)
  const rawDepth = numOf(v, 'depth'), depth = rawDepth === undefined ? undefined : clampTo(1, MAX_DEPTH, Math.round(rawDepth))
  const relation = strOf(v, 'relation'), refusal = strOf(v, 'refusal:graph')
  const off = {links: boolOf(v, 'show:links') === false, refs: boolOf(v, 'show:references') === false, sessions: boolOf(v, 'show:sessions') === false}
  const closedOff = boolOf(v, 'closed') === false
  const gap = !subject ? 'subject' : edges === undefined ? 'graph' : depth === undefined ? 'depth' : undefined
  const status = {
    links: off.links ? 'off' : refusal ? 'refused' : gap ? 'unread' : 'read',
    refs: off.refs ? 'off' : files ? 'read' : 'unread',
    sessions: off.sessions ? 'off' : sessions ? 'read' : 'unread',
  } as const
  const root = subject ? rootOf(subject, edges ?? []) : ''
  const w = status.links === 'read' ? walk(root, edges ?? [], relation) : null
  const kinds = w ? [...new Set(walk(root, edges ?? [], undefined).edges.map(x => x.relation))] : []
  const hopOf = (ref: string) => w?.hop.get(ref) ?? Infinity
  const reach = depth ?? 0
  const shown = w ? [...w.hop].filter(([, h]) => h <= reach).map(([ref]) => ref) : subject ? [root] : []
  const ghost = w ? [...w.hop].filter(([, h]) => h === reach + 1).map(([ref]) => ref) : []
  const drawn = w ? w.edges.filter(x => hopOf(x.from) <= reach && hopOf(x.to) <= reach) : []
  const drawnGhost = w ? w.edges.filter(x => Math.max(hopOf(x.from), hopOf(x.to)) === reach + 1) : []
  const links = drawn.map(edge => ({edge, direct: edge.direct ?? (edge.from === root || edge.to === root), hop: Math.max(hopOf(edge.from), hopOf(edge.to))}))
    .sort((a, b) => Number(b.direct) - Number(a.direct) || a.hop - b.hop)
  const heard = status.sessions === 'read' ? sessions ?? [] : []
  return {subject, kind: subject?.kind, path: subject?.path, root, depth, relation, refusal, gap, status, walk: w, roles, kinds, shown, ghost, drawn, drawnGhost, links,
    files: status.refs === 'read' ? files ?? [] : [], how: subject ? (subject.kind === 'folder' ? 'holds' : 'mentions') : undefined,
    sessions: closedOff ? heard.filter(isOpen) : heard, closedHidden: closedOff ? heard.filter(s => !isOpen(s)).length : 0}
}

const roleOf = (m: Model, ref: string): Role => m.roles.get(ref) ?? roleIn(ref)
const gapWords = (m: Model) => (m.gap ? `No reading of the ${m.gap}` : undefined)

/** What a list counts: a number, "off", "refused", or undefined (drawn "—") when the owner has not reported it. */
const countOf = (m: Model, list: 'refs' | 'links' | 'sessions'): number | string | undefined => {
  const s = m.status[list]
  return s === 'read' ? (list === 'refs' ? m.files.length : list === 'links' ? m.links.length : m.sessions.length) : s === 'off' || s === 'refused' ? s : undefined
}
/** Every item the lists hold, or undefined when none of the three is reported. */
const items = (m: Model): number | undefined => (Object.values(m.status).every(s => s === 'unread') ? undefined : m.files.length + m.links.length + m.sessions.length)

// ------------------------------------------------------------------------------------------------ the picture

const ANGLE_HANDLE = -Math.PI / 3

interface Geometry {readonly w: number; readonly h: number; readonly cx: number; readonly cy: number; readonly step: number}
const geometry = (w: number, h: number, small: boolean): Geometry => {
  const R = small ? w / 2 - 6 : Math.min(54, w / 2 - 8)
  return {w, h, cx: w / 2, cy: small ? h / 2 : 68, step: R / MAX_DEPTH}
}

/** The rings and the neighbourhood: solid dots to Depth, hollow dots on the next ring. `big` draws the pane's marks and labels. */
function Neighbourhood({m, g, big = false, picked, onPick}: {m: Model; g: Geometry; big?: boolean; picked?: string | null; onPick?: (ref: string) => void}) {
  const {cx, cy, step} = g, dot = big ? 4.6 : step < 10 ? 1.5 : 2.4, hub = big ? 7.5 : step < 10 ? 3 : 4.2
  const at = (ref: string): [number, number] => {
    const h = m.walk?.hop.get(ref) ?? 0, a = m.walk?.angle.get(ref) ?? 0
    return [cx + h * step * Math.cos(a), cy + h * step * Math.sin(a)]
  }
  const labelled = (ref: string) => (m.walk?.hop.get(ref) ?? 9) <= 2 || m.shown.length <= 12 || ref === picked
  return <g>
    {m.depth !== undefined && <circle cx={cx} cy={cy} r={step * m.depth} className="im-reach" />}
    {Array.from({length: MAX_DEPTH}, (_, i) => <circle key={i} cx={cx} cy={cy} r={step * (i + 1)} className="im-ring" data-reach={i + 1 === m.depth ? 'true' : undefined} />)}
    {big && Array.from({length: MAX_DEPTH}, (_, i) => <text key={i} x={cx + 4} y={cy - step * (i + 1) - 3} className="dp-axis">{i + 1}</text>)}
    {m.drawnGhost.map((x, i) => { const [x1, y1] = at(x.from), [x2, y2] = at(x.to); return <line key={`g${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="im-edge" data-ghost="true" /> })}
    {m.drawn.map((x, i) => { const [x1, y1] = at(x.from), [x2, y2] = at(x.to); return <line key={`e${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="im-edge" data-direct={x.from === m.root || x.to === m.root ? 'true' : undefined} /> })}
    {m.ghost.map(ref => { const [x, y] = at(ref); return <circle key={ref} cx={x} cy={y} r={dot} className="im-node" data-ghost="true" /> })}
    {m.shown.filter(ref => ref !== m.root).map(ref => {
      const [x, y] = at(ref), role = roleOf(m, ref), a = m.walk?.angle.get(ref) ?? 0, h = m.walk?.hop.get(ref) ?? 1
      const right = Math.cos(a) >= 0
      return <g key={ref} data-i={big ? `${labelOf(ref)}|${role === 'node' ? 'A note of the wiki register.' : role === 'source' ? 'A source file.' : 'A space, a branch or another source.'} ${h} ${h === 1 ? 'link' : 'links'} from the subject.` : undefined}>
        {role === 'source' ? <rect x={x - dot} y={y - dot} width={dot * 2} height={dot * 2} className="im-node" data-role="source" />
          : <circle cx={x} cy={y} r={dot} className="im-node" data-role={role} />}
        {picked === ref && <circle cx={x} cy={y} r={dot + 4} className="im-pick" />}
        {big && labelled(ref) && <text x={x + (right ? dot + 5 : -dot - 5)} y={y + 3} textAnchor={right ? 'start' : 'end'} className="im-label" data-hop={h} data-picked={picked === ref ? 'true' : undefined}>{clip(labelOf(ref), 26)}</text>}
        {onPick && <circle cx={x} cy={y} r={dot + 6} className="im-hit" onClick={() => onPick(ref)} />}
      </g>
    })}
    {m.subject && <>
      <circle cx={cx} cy={cy} r={hub + 3} className="im-subject-ring" />
      <circle cx={cx} cy={cy} r={hub} className="im-subject" />
      {onPick && <circle cx={cx} cy={cy} r={hub + 6} className="im-hit" onClick={() => onPick(m.root)} />}
      {big && <text x={cx} y={cy + hub + 14} textAnchor="middle" className="im-label" data-hop="1">{clip(tailOf(m.subject.path), 40)}</text>}
    </>}
  </g>
}

/** What the well says when a reading is missing (manual §16.12): the switch, the refusal, or the reading that has not come. */
function Say({m, g}: {m: Model; g: Geometry}) {
  const words = m.gap === 'subject' ? gapWords(m) : m.status.links === 'off' ? 'links off' : m.refusal ? 'graph refused' : gapWords(m)
  const says = words !== undefined && words === gapWords(m)
  return words ? <text x={g.cx} y={g.cy + 20} textAnchor="middle" className="im-say" data-tone={m.refusal && !says ? 'refused' : undefined}>{says && g.w < 100 ? NONE : words}</text> : null
}

/** The display: the neighbourhood, the handle that sets Depth, the subject along the foot. */
function Picture({p, w, h, size}: {p: ViewProps; w: number; h: number; size: 'compact' | 'whole' | 'tile'}) {
  const m = model(p.v), g = geometry(w, h, size === 'tile'), pinned = boolOf(p.v, 'pin') === true
  const reach = m.depth ?? 0, hx = g.cx + g.step * reach * Math.cos(ANGLE_HANDLE), hy = g.cy + g.step * reach * Math.sin(ANGLE_HANDLE)
  const corner = size === 'tile' ? undefined : m.status.links === 'off' ? 'links off' : m.refusal ? 'refused' : m.depth === undefined ? NONE : `depth ${m.depth}${m.ghost.length ? ` · +${m.ghost.length}` : ''}`
  return <Display w={w} h={h} label="Neighbourhood" corner={corner}
    does="The subject at the centre, one ring for each link out. Solid dots are reached. Hollow dots are the next ring. Drag handle 1 to set Depth.">
    <Neighbourhood m={m} g={g} />
    <Say m={m} g={g} />
    {size !== 'tile' && <text x={5} y={h - 5} className="dp-axis">{m.subject ? `${pinned ? 'pinned · ' : ''}${m.kind ?? NONE} · ${clip(tailOf(m.subject.path), size === 'whole' ? 30 : 20)}` : NONE}</text>}
    {size !== 'tile' && m.status.links === 'read' && m.depth !== undefined && <Handle x={hx} y={hy} n={1} label="Depth" does="Drag out or in: how many links away the neighbourhood reaches, from 1 to 4." shape="ring"
      onDrag={st(p, 'depth').disabled ? undefined : (x, y) => p.set('depth', clampTo(1, MAX_DEPTH, Math.round(Math.hypot(x - g.cx, y - g.cy) / g.step)))} onReset={st(p, 'depth').disabled ? undefined : () => p.set('depth', 1)} />}
  </Display>
}

// ------------------------------------------------------------------------------------------------ the controls

/** The head light reads the owner alone: lit or dark when it reports, hollow when it has not. */
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
/** The host's standing for a key, with this view's own reason laid over it when the host gives none. */
const stand = (p: ViewProps, key: string, why?: string) => { const s = st(p, key); return why && !s.disabled ? {...s, disabled: why} : s }

function DepthDial({p}: {p: ViewProps}) {
  const m = model(p.v)
  return <Dial label="Depth" does="How many links away the neighbourhood reaches, from 1 to 4. Each step adds one ring." value={numOf(p.v, 'depth') ?? NaN} def={1}
    scale={{min: 1, max: MAX_DEPTH, step: 1}} format={x => plural(x, 'link')} onChange={x => p.set('depth', x)}
    {...stand(p, 'depth', m.status.links === 'off' ? 'Links is off. Turn it on to read the graph.' : undefined)} />
}

function RelationChooser({p}: {p: ViewProps}) {
  const m = model(p.v)
  return <Chooser label="Relation" wide does="Limit the graph and the Links list to one kind of link. The chooser lists the kinds that the graph holds near the subject." value={strOf(p.v, 'relation') ?? ''}
    options={[{value: 'all', label: 'All'}, ...m.kinds.map(k => ({value: k, label: relName(k)}))]} onChange={x => p.set('relation', x)}
    {...stand(p, 'relation', m.status.links === 'off' ? 'Links is off. Turn it on to read the graph.' : undefined)} />
}

function PinToggle({p}: {p: ViewProps}) {
  const now = boolOf(p.v, 'pin')
  return <Toggle label="Pin" does="Keep the subject when you select something else. Off: Impact follows your selection." on={now === true} unknown={now === undefined}
    onChange={x => p.set('pin', x)} {...st(p, 'pin')} />
}

function ClosedToggle({p}: {p: ViewProps}) {
  const m = model(p.v), now = boolOf(p.v, 'closed')
  return <Toggle label="Closed" does="Add closed and archived sessions to the Sessions list. Off: only active and quiescent sessions show."
    on={now === true} unknown={now === undefined} onChange={x => p.set('closed', x)}
    {...stand(p, 'closed', m.status.sessions === 'off' ? 'Sessions is off. Turn it on to read the register.' : undefined)} />
}

function ListToggle({p, keyName, label, does}: {p: ViewProps; keyName: string; label: string; does: string}) {
  const now = boolOf(p.v, keyName)
  return <Toggle label={label} does={does} on={now === true} unknown={now === undefined} onChange={x => p.set(keyName, x)} {...st(p, keyName)} />
}

function Counts({p, tone = 'value'}: {p: ViewProps; tone?: 'value' | 'accent'}) {
  const m = model(p.v)
  return <>
    <Readout label="refs" does="The files that the folder holds, or that mention the subject. Press to open the list." value={countOf(m, 'refs')} tone={tone} onPress={p.nav.full} />
    <Readout label="links" does="The links inside the reach of Depth. Press to open the list." value={countOf(m, 'links')} tone={tone} onPress={p.nav.full} />
    <Readout label="sessions" does="The sessions that work in the project that holds the subject. Press to open the list." value={countOf(m, 'sessions')} tone={tone} onPress={p.nav.full} />
  </>
}

// ------------------------------------------------------------------------------------------------ the items

function Glyph({kind}: {kind: 'file' | 'folder' | 'link' | 'session' | 'warn'}) {
  return <svg className="im-glyph" width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" aria-hidden>
    {kind === 'file' && <path d="M2.5 1h3.5l2 2v6h-5.5z" />}
    {kind === 'folder' && <path d="M1 2.5h3l1 1h4v5.5h-8z" />}
    {kind === 'link' && <path d="M2 8l2-2M6 2L8 4M3.2 4.2L5.4 2a1.6 1.6 0 0 1 2.6 .4M6.8 5.8L4.6 8A1.6 1.6 0 0 1 2 7.6" />}
    {kind === 'session' && <><circle cx={2.8} cy={2.2} r={1} /><circle cx={2.8} cy={7.8} r={1} /><circle cx={7.2} cy={3.6} r={1} /><path d="M2.8 3.2v3.6M2.8 6.6c0-2.2 4.4-1.4 4.4-3" /></>}
    {kind === 'warn' && <path d="M5 1.5l4 7h-8z" />}
  </svg>
}

const glyphOf = (f: FileRow): ReactNode => <Glyph kind={f.directory ? 'folder' : 'file'} />
/** The far end of a link: the end that stands further out from the subject. */
const farEnd = (m: Model, x: LinkRow) => ((m.walk?.hop.get(x.edge.from) ?? 0) > (m.walk?.hop.get(x.edge.to) ?? 0) ? x.edge.from : x.edge.to)
/** A direct link is named by the note at its far end; an indirect link by both ends. */
const linkName = (m: Model, x: LinkRow) => (x.direct ? labelOf(farEnd(m, x)) : `${labelOf(x.edge.from)} → ${labelOf(x.edge.to)}`)
const linkNote = (x: LinkRow) => relName(x.edge.relation)
const linkWords = (x: LinkRow) => `${x.direct ? 'A direct link' : `A link ${x.hop} links out`}, ${relName(x.edge.relation).toLowerCase()}`
const fromOwner = (x: LinkRow) => (x.edge.provenance ? `, from the ${x.edge.provenance}` : '')
/** The note at a file row's right: a folder, a size, or the word a mention carries when the owner gives no size. */
const fileNote = (m: Model, f: FileRow) => (f.directory ? 'dir' : f.bytes !== undefined ? sizeText(f.bytes) : m.how === 'mentions' ? 'mention' : NONE)
const fileWords = (m: Model, f: FileRow) => (m.how === 'holds' ? `A ${f.directory ? 'directory' : 'file'} that the folder holds.` : m.how === 'mentions' ? 'A file that mentions the subject.' : 'A file of the reading.')
const sessionWords = (s: Session) => `${s.lifecycle ? `${s.lifecycle[0]!.toUpperCase()}${s.lifecycle.slice(1)} session` : 'Session'}${s.branch ? ` on ${s.branch}` : ''}.`

function itemRows(m: Model): RowItem[] {
  const out: RowItem[] = []
  if (m.status.links === 'refused') out.push({id: 'refused', name: 'Links: the graph refused', light: 'dark', mark: <Glyph kind="warn" />, why: m.refusal})
  else if (m.status.links === 'unread') out.push({id: 'unread-links', name: gapWords(m) ?? NONE, light: 'unknown', mark: <Glyph kind="link" />, does: 'The owner has not reported what the links need.'})
  for (const [i, x] of m.links.entries()) out.push({id: `l${i}`, name: linkName(m, x), light: x.direct ? 'lit' : 'dark', tone: 'value', mark: <Glyph kind="link" />, note: linkNote(x),
    does: `${linkWords(x)}${fromOwner(x)}.`})
  if (m.status.refs === 'unread') out.push({id: 'unread-refs', name: 'No reading of the references', light: 'unknown', mark: <Glyph kind="file" />, does: 'The owner has not reported the references.'})
  for (const [i, f] of m.files.entries()) out.push({id: `f${i}`, name: f.name, light: 'lit', tone: 'value', mark: glyphOf(f), note: fileNote(m, f),
    does: `${fileWords(m, f)} Source: the ${m.how === 'holds' ? SOURCE.folder : SOURCE.mentions}.`})
  if (m.status.sessions === 'unread') out.push({id: 'unread-sessions', name: 'No reading of the sessions', light: 'unknown', mark: <Glyph kind="session" />, does: 'The owner has not reported the sessions.'})
  for (const s of m.sessions) out.push({id: s.id, name: s.purpose, light: isOpen(s) ? 'lit' : 'dark', tone: 'accent', mark: <Glyph kind="session" />,
    note: s.branch ? clip(s.branch.replace(/^agent\//, ''), 13) : undefined, does: sessionWords(s)})
  if (m.closedHidden > 0) out.push({id: 'closed-hidden', name: `${m.closedHidden} closed ${m.closedHidden === 1 ? 'session' : 'sessions'} hidden`, light: 'dark', mark: <Glyph kind="session" />,
    does: 'Closed and archived sessions are hidden. Turn on Closed to list them.'})
  return out
}

// ------------------------------------------------------------------------------------------------ the views

function ImpactWhole({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0), m = model(p.v)
  return <Panel title="Impact" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={PAGES.map(x => ({id: x.id, label: x.label, light: x.id === 'meaning' ? meaningLight(p.v) : undefined}))} page={pageOf(p)} onPage={p.setPage}>
    {pageOf(p) === 'meaning' ? <MeaningWhole p={p} /> : <>
    <Band>
      <Section width={206}><Picture p={p} w={194} h={146} size="whole" /></Section>
      <Section label="Reach" width={100}>
        <DepthDial p={p} />
        <RelationChooser p={p} />
      </Section>
      <Section label="Subject" grow>
        <Readout label="subject" does="What the browser has selected. You set it by selecting a folder, a note or a Day." value={m.kind} tone="accent" />
        <PinToggle p={p} />
        <Readout label="next ring" does="The dots that one more link of Depth adds." value={m.status.links === 'read' ? `+${m.ghost.length}` : undefined} />
      </Section>
    </Band>
    <Band>
      <Section label="Lists" width={84}>
        <ListToggle p={p} keyName="show:references" label="References" does="Read the files that the folder holds or that mention the subject. Off: the device does not read them." />
        <ListToggle p={p} keyName="show:links" label="Links" does="Read the knowledge graph. Off: the device does not read it, and the picture holds the subject alone." />
        <ListToggle p={p} keyName="show:sessions" label="Sessions" does="Read the NOW register. Off: the device does not read it." />
        <ClosedToggle p={p} />
      </Section>
      <Section label="Items" grow>
        <Rows does="Links first, direct links at the top, then references, then sessions. A dim row is not direct, or a session that is not open." items={itemRows(m)}
          size={7} page={page} onPage={setPage} />
      </Section>
    </Band>
    </>}
  </Panel>
}

/** The pane: the graph at pane size, the three lists beside it, the detail of the item you pick under the graph. */
function ImpactFull({p}: {p: ViewProps}) {
  const m = model(p.v), [picked, setPicked] = useState<string | null>(null), [pickedItem, setPickedItem] = useState<string | null>(null)
  const big: Geometry = {w: 460, h: 364, cx: 230, cy: 180, step: 40}
  const pick = (ref: string | null, item: string | null) => { setPicked(ref); setPickedItem(item) }
  const cap = (n: number, all: number) => (all > n ? n - 1 : n)
  const detail = (() => {
    if (pickedItem?.startsWith('l')) {
      const x = m.links[Number(pickedItem.slice(1))]
      if (x) return {title: `${labelOf(x.edge.from)} → ${labelOf(x.edge.to)}`, line: <>{relName(x.edge.relation)}{x.edge.provenance ? ` · from the ${x.edge.provenance}` : ''} · {x.direct ? 'direct' : `${x.hop} links out`} · <code>{x.edge.to}</code></>}
    }
    const f = pickedItem?.startsWith('f') ? m.files[Number(pickedItem.slice(1))] : undefined
    if (f) return {title: f.name, line: <>{m.how === 'holds' ? 'Held by the folder' : m.how === 'mentions' ? 'Mentions the subject' : 'A file of the reading'} · <code>{f.path ?? NONE}</code>{f.bytes !== undefined && !f.directory ? ` · ${sizeText(f.bytes)}` : ''}</>}
    const s = m.sessions.find(y => y.id === pickedItem)
    if (s) return {title: s.purpose, line: <>{s.lifecycle || NONE} · <code>{s.branch ?? NONE}</code></>}
    if (picked && picked !== m.root) {
      const hop = m.walk?.hop.get(picked)
      return {title: labelOf(picked), line: <>{roleOf(m, picked) === 'node' ? 'A note of the wiki register' : roleOf(m, picked) === 'source' ? 'A source file' : 'A space, a branch or another source'} · {hop === undefined ? NONE : `${hop} links out`} · <code>{picked}</code></>}
    }
    if (!m.subject) return {title: NONE, line: <>No reading of the subject.</>}
    return {title: `${m.kind ?? NONE} · ${m.path}`, line: <>{boolOf(p.v, 'pin') === true ? 'Pinned. ' : ''}Pick a dot or an item to read it. Depth {m.depth ?? NONE}{m.relation && m.relation !== 'all' ? ` · ${relName(m.relation)} links only` : ''}.</>}
  })()
  const Head = ({title, count, source}: {title: string; count: number | string | undefined; source: string}) =>
    <h4>{title} <b>{count ?? NONE}</b><small>{source}</small></h4>
  const corner = m.refusal ? 'graph refused' : m.status.links === 'off' ? 'links off' : m.depth === undefined ? NONE : `depth ${m.depth}${m.ghost.length ? ` · +${m.ghost.length} at ${m.depth + 1}` : ''}`
  const linksCount = m.status.links === 'refused' ? undefined : countOf(m, 'links')
  return <div className="im-pane">
    <div className="im-graph">
      <svg viewBox="0 0 460 364" preserveAspectRatio="xMidYMid meet" role="group" aria-label="The neighbourhood of the subject" className="dp-display" style={{background: 'none', border: 0}}>
        <Neighbourhood m={m} g={big} big picked={picked} onPick={ref => pick(ref === m.root ? null : ref, null)} />
        <Say m={m} g={{...big, cy: big.cy + 6}} />
      </svg>
      <span className="im-corner">{corner}</span>
      <div className="im-legend"><span><i data-role="node" /> note</span><span><i data-role="source" /> source</span><span><i data-role="unknown" /> space or other</span></div>
    </div>
    <div className="im-lists">
      <section className="im-list">
        <Head title="Links" count={linksCount} source={SOURCE.links} />
        <ul className="im-rows">
          {m.refusal && <li className="im-refusal" data-i={`Links|The graph owner refused: ${m.refusal}`}>{m.refusal}</li>}
          {m.status.links === 'off' && <li className="im-none">Links is off.</li>}
          {m.status.links === 'unread' && <li className="im-none">{gapWords(m)}</li>}
          {m.status.links === 'read' && m.links.length === 0 && <li className="im-none">The graph holds no link here.</li>}
          {m.links.slice(0, cap(6, m.links.length)).map((x, i) => <li key={i}>
            <button type="button" className="im-row" aria-pressed={pickedItem === `l${i}`} data-dim={x.direct ? undefined : 'true'}
              data-i={`${linkName(m, x)}|${linkWords(x)}. Click to read it.`}
              onClick={() => pick(farEnd(m, x), `l${i}`)}>
              <Glyph kind="link" /><span className="im-row-name">{linkName(m, x)}</span><span className="im-row-note">{linkNote(x)}</span>
            </button></li>)}
          {m.links.length > 6 && <li className="im-more">+{m.links.length - 5} more links</li>}
        </ul>
      </section>
      <section className="im-list">
        <Head title="References" count={countOf(m, 'refs')} source={m.how === 'holds' ? SOURCE.folder : m.how === 'mentions' ? SOURCE.mentions : NONE} />
        <ul className="im-rows">
          {m.status.refs === 'off' && <li className="im-none">References is off.</li>}
          {m.status.refs === 'unread' && <li className="im-none">No reading of the references</li>}
          {m.status.refs === 'read' && m.files.length === 0 && <li className="im-none">No file mentions the subject.</li>}
          {m.files.slice(0, cap(5, m.files.length)).map((f, i) => <li key={i}>
            <button type="button" className="im-row" aria-pressed={pickedItem === `f${i}`}
              data-i={`${f.name}|${m.how === 'holds' ? 'Held by the folder.' : m.how === 'mentions' ? 'Mentions the subject.' : 'A file of the reading.'} Click to read it.`} onClick={() => pick(null, `f${i}`)}>
              {glyphOf(f)}<span className="im-row-name">{f.name}</span><span className="im-row-note">{fileNote(m, f)}</span>
            </button></li>)}
          {m.files.length > 5 && <li className="im-more">+{m.files.length - 4} more files</li>}
        </ul>
      </section>
      <section className="im-list">
        <Head title="Sessions" count={countOf(m, 'sessions')} source={SOURCE.sessions} />
        <ul className="im-rows">
          {m.status.sessions === 'off' && <li className="im-none">Sessions is off.</li>}
          {m.status.sessions === 'unread' && <li className="im-none">No reading of the sessions</li>}
          {m.status.sessions === 'read' && m.sessions.length === 0 && <li className="im-none">{m.closedHidden ? `No open session. ${m.closedHidden} closed.` : 'No session names this project.'}</li>}
          {m.sessions.slice(0, cap(4, m.sessions.length)).map(s => <li key={s.id}>
            <button type="button" className="im-row" aria-pressed={pickedItem === s.id} data-i={`${s.purpose}|${sessionWords(s)} Click to read it.`} onClick={() => pick(null, s.id)}>
              <span className="im-row-state" data-open={isOpen(s) ? 'true' : 'false'} /><span className="im-row-name">{s.purpose}</span><span className="im-row-note">{s.lifecycle || NONE}</span>
            </button></li>)}
          {m.sessions.length > 4 && <li className="im-more">+{m.sessions.length - 3} more sessions</li>}
        </ul>
      </section>
    </div>
    <div className="im-detail"><b>{detail.title}</b><span>{detail.line}</span></div>
  </div>
}

// ------------------------------------------------------------------------------------------------ Meaning: does the code still say what the product means?

type Holds = 'holds' | 'missing' | 'wrong-relation' | 'duplicate' | 'stale' | 'constitutive-flattening'
const HOLDS: readonly Holds[] = ['holds', 'missing', 'wrong-relation', 'duplicate', 'stale', 'constitutive-flattening']
const HOLDS_WORD: Readonly<Record<Holds, string>> = {holds: 'holds', missing: 'missing', 'wrong-relation': 'wrong relation', duplicate: 'twice', stale: 'stale', 'constitutive-flattening': 'flattened'}
const HOLDS_SAYS: Readonly<Record<Holds, string>> = {
  holds: 'The code holds the meaning by the relation the law names.',
  missing: 'The meaning names an implementation the project map does not hold.',
  'wrong-relation': 'The code is bound, but by another relation than the law names.',
  duplicate: 'More than one implementation claims the meaning where the law asks for one.',
  stale: 'The implementation has moved past the revision the meaning was checked against.',
  'constitutive-flattening': 'A relation the law keeps as two faces is bound as one.',
}
interface Mapping {readonly coordinate: string; readonly semantic: string; readonly implementation?: string; readonly relation?: string; readonly state: Holds; readonly detail?: string}
interface Meaning {readonly law?: string; readonly revision?: string; readonly passed?: boolean; readonly truncated: boolean; readonly mappings: readonly Mapping[]
  readonly lenses: {readonly meaning?: number; readonly descriptions?: number; readonly code?: number; readonly verification?: number}}

/** The owner's reflection of the subject, or undefined when it reports none (or the reading cannot be read). */
function meaningOf(v: V): Meaning | undefined {
  const o = rec(json<unknown>(v, 'meaning', undefined))
  if (!o) return undefined
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
  const mappings = (Array.isArray(o.mappings) ? o.mappings : []).flatMap((x): Mapping[] => {
    const m = rec(x), c = text(m?.coordinate), s = text(m?.semantic)
    return m && c && s && HOLDS.includes(m.state as Holds) ? [{coordinate: c, semantic: s, implementation: text(m.implementation), relation: text(m.relation), state: m.state as Holds, detail: text(m.detail)}] : []
  })
  const lenses = rec(o.lenses)
  return {law: text(o.law), revision: text(o.revision), passed: typeof o.passed === 'boolean' ? o.passed : undefined, truncated: o.truncated === true, mappings,
    lenses: {meaning: num(lenses?.meaning), descriptions: num(lenses?.descriptions), code: num(lenses?.code), verification: num(lenses?.verification)}}
}
const issuesOf = (m: Meaning) => m.mappings.filter(x => x.state !== 'holds')
const meaningCorner = (m: Meaning | undefined) => (!m ? NONE : m.passed === true ? 'holds' : `${issuesOf(m).length} issue${issuesOf(m).length === 1 ? '' : 's'}`)

/** A bridge: what the product means at the left, the code that holds it at the right, a span for each mapping of the law. Teal: it holds.
 * Orange: it does not, marked by what went wrong — a span that stops short (missing), a cross (wrong relation), a dashed span (stale), a
 * doubled end (twice), a square (flattened). */
function Bridge({m, w, h, big, picked, onPick}: {m: Meaning; w: number; h: number; big?: boolean; picked?: number; onPick?: (i: number) => void}) {
  const shown = m.mappings.slice(0, big ? 14 : 8), lx = big ? 150 : 62, rx = w - (big ? 150 : 22), top = big ? 46 : 28, bottom = h - (big ? 30 : 18)
  const y = (i: number) => (shown.length <= 1 ? (top + bottom) / 2 : top + (i * (bottom - top)) / (shown.length - 1))
  return <g>
    <text x={lx} y={big ? 24 : h - 4} className="dp-axis" textAnchor="middle">meaning</text>
    <text x={rx} y={big ? 24 : h - 4} className="dp-axis" textAnchor="middle">code</text>
    {shown.map((x, i) => {
      const yy = y(i), ok = x.state === 'holds', stroke = ok ? 'var(--dp-value)' : 'var(--stall)', mx = (lx + rx) / 2, end = x.state === 'missing' ? mx + (rx - lx) / 6 : rx
      return <g key={`${x.coordinate}:${i}`} data-i={`${x.coordinate}|${HOLDS_SAYS[x.state]}${x.detail ? ` ${x.detail}` : ''}`} onClick={onPick ? () => onPick(i) : undefined} style={onPick ? {cursor: 'pointer'} : undefined}>
        <text x={lx - (big ? 10 : 7)} y={yy + 3} className={ok ? 'dp-ink-dim' : 'dp-ink'} textAnchor="end">{big ? clip(`${x.coordinate} · ${labelOf(x.semantic)}`, 26) : clip(x.coordinate, 10)}</text>
        <path d={`M${lx + 4} ${yy}H${end - (x.state === 'missing' ? 0 : 4)}`} stroke={stroke} strokeWidth={big ? 1.6 : 1.2} strokeDasharray={x.state === 'stale' ? '3 2' : undefined} />
        <circle cx={lx} cy={yy} r={big ? 4 : 3} fill="var(--dp-value)" />
        {x.state === 'missing' ? <path d={`M${end - 3} ${yy - 3}l6 6M${end + 3} ${yy - 3}l-6 6`} stroke={stroke} strokeWidth={1.3} />
          : <circle cx={rx} cy={yy} r={big ? 4 : 3} fill={ok ? 'var(--dp-value)' : 'var(--dp-well)'} stroke={stroke} strokeWidth={1.2} />}
        {x.state === 'duplicate' && <circle cx={rx + (big ? 9 : 6)} cy={yy} r={big ? 4 : 3} fill="var(--dp-well)" stroke={stroke} strokeWidth={1.2} />}
        {x.state === 'wrong-relation' && <path d={`M${mx - 3} ${yy - 3}l6 6M${mx + 3} ${yy - 3}l-6 6`} stroke={stroke} strokeWidth={1.3} />}
        {x.state === 'constitutive-flattening' && <rect x={mx - 3} y={yy - 3} width={6} height={6} fill="var(--dp-well)" stroke={stroke} strokeWidth={1.2} />}
        {big && x.implementation && <text x={rx + (x.state === 'duplicate' ? 20 : 10)} y={yy + 3} className={ok ? 'dp-ink-dim' : 'dp-ink'}>{clip(tailOf(x.implementation), 22)}</text>}
        {big && picked === i && <rect x={8} y={yy - 9} width={w - 16} height={18} fill="none" stroke="var(--dp-on)" strokeWidth={1} opacity={.7} />}
      </g>
    })}
    {m.mappings.length > shown.length && <text x={w / 2} y={bottom + (big ? 22 : 12)} className="dp-axis" textAnchor="middle">+{m.mappings.length - shown.length} more</text>}
  </g>
}

function MeaningPicture({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const m = meaningOf(p.v), s = subjectOf(p.v)
  return <Display w={w} h={h} label="Meaning" corner={meaningCorner(m)}
    does="What the product means at the left, the code that holds it at the right, a span for each mapping. Teal: it holds. Orange: it does not, and the mark says how.">
    {!s ? <text x={w / 2} y={h / 2} className="im-say" textAnchor="middle">No reading of the subject</text>
      : !m ? <text x={w / 2} y={h / 2} className="im-say" textAnchor="middle">No reading of its meaning</text>
      : !m.mappings.length ? <text x={w / 2} y={h / 2} className="im-say" textAnchor="middle">No law binds this subject</text>
      : <Bridge m={m} w={w} h={h} />}
  </Display>
}

function meaningRows(v: V): RowItem[] {
  const m = meaningOf(v)
  if (!m) return [{id: 'none', name: 'No reading of its meaning', light: 'unknown'}]
  if (!m.mappings.length) return [{id: 'none', name: 'No law binds this subject', light: 'dark'}]
  return [...m.mappings].sort((a, b) => Number(a.state === 'holds') - Number(b.state === 'holds')).map((x, i) => ({id: `${x.coordinate}:${i}`, name: `${x.coordinate} · ${labelOf(x.semantic)}`,
    light: 'lit', tone: x.state === 'holds' ? 'value' : 'stall', note: HOLDS_WORD[x.state],
    why: x.state === 'holds' ? undefined : `${HOLDS_SAYS[x.state]}${x.detail ? ` ${x.detail}` : ''}`,
    does: `${x.relation ?? NONE} → ${x.implementation ?? 'no implementation'}`}))
}

function MeaningWhole({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0), m = meaningOf(p.v)
  return <>
    <Band>
      <Section width={206}><MeaningPicture p={p} w={194} h={146} /></Section>
      <Section label="Law" width={104}>
        <Readout label="law" does={`The reflection law that binds the subject's meaning to its code${m?.law ? `: ${m.law}` : ''}. Its owner writes it.`} value={m?.law === undefined ? undefined : clip(m.law.split(':').pop() ?? m.law, 14)} />
        <Readout label="revision" does="The revision of the law that was checked." value={m?.revision} />
        <Readout label="verdict" does="Holds when every mapping holds. Fails names how many do not." value={m ? (m.passed === true ? 'holds' : m.passed === false ? 'fails' : NONE) : undefined}
          tone={m?.passed === true ? 'green' : m?.passed === false ? 'stall' : undefined} />
      </Section>
      <Section label="Read" cols={2} grow>
        <Readout label="meaning" does="Sources of meaning bound to the subject: Vision, Design, the wiki." value={m?.lenses.meaning} tone="value" />
        <Readout label="code" does="Code bound to the subject." value={m?.lenses.code} tone="value" />
        <Readout label="described" does="Native descriptions bound to it: a README, a doc comment." value={m?.lenses.descriptions} />
        <Readout label="verified" does="Verification bound to it: tests and checks." value={m?.lenses.verification} />
        <div style={{gridColumn: 'span 2', width: '100%'}}><Action {...st(p, 'meaningRead')} label="Read now" does="Read the subject's meaning and its code again." onPress={() => p.set('meaningRead', true)} /></div>
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={m ? `Mappings · ${m.mappings.length}${m.truncated ? '+' : ''}, ${issuesOf(m).length} not holding` : 'Mappings'}
        does="Each mapping of the law: the meaning, and whether its code holds it. Those that do not hold come first." items={meaningRows(p.v)} size={14} columns={2} page={page} onPage={setPage} /></Section>
    </Band>
  </>
}

/** The pane's Meaning tab: the bridge at pane size, each mapping named; the mappings that do not hold beside it; the chosen one under it. */
function MeaningFull({p}: {p: ViewProps}) {
  const m = meaningOf(p.v), [picked, setPicked] = useState<number | undefined>(undefined)
  const x = m && picked !== undefined ? m.mappings[picked] : undefined
  return <div className="im-pane">
    <div className="im-graph">
      <svg viewBox="0 0 460 364" preserveAspectRatio="xMidYMid meet" role="group" aria-label="The subject's meaning and its code" className="dp-display" style={{background: 'none', border: 0}}>
        {m && m.mappings.length ? <Bridge m={m} w={460} h={364} big picked={picked} onPick={setPicked} />
          : <text x={230} y={182} className="im-say" textAnchor="middle">{!m ? 'No reading of its meaning' : 'No law binds this subject'}</text>}
      </svg>
      <span className="im-corner">{meaningCorner(m)}</span>
    </div>
    <div className="im-lists">
      <section className="im-list">
        <h4>Not holding <b>{m ? issuesOf(m).length : NONE}</b><small>{m?.law ?? NONE}</small></h4>
        <ul className="im-rows">
          {!m && <li className="im-none">No reading of its meaning</li>}
          {m && !issuesOf(m).length && <li className="im-none">Every mapping holds.</li>}
          {m && issuesOf(m).slice(0, 9).map(y => { const i = m.mappings.indexOf(y); return <li key={i}>
            <button type="button" className="im-row" aria-pressed={picked === i} data-i={`${y.coordinate}|${HOLDS_SAYS[y.state]} Click to read it.`} onClick={() => setPicked(i)}>
              <span className="im-row-state" data-open="false" style={{borderColor: 'var(--stall)'}} /><span className="im-row-name">{y.coordinate} · {labelOf(y.semantic)}</span><span className="im-row-note">{HOLDS_WORD[y.state]}</span>
            </button></li> })}
        </ul>
      </section>
      <section className="im-list">
        <h4>Read <small>the project map</small></h4>
        <ul className="im-rows">
          {([['meaning', m?.lenses.meaning], ['code', m?.lenses.code], ['descriptions', m?.lenses.descriptions], ['verification', m?.lenses.verification]] as const).map(([k, n]) =>
            <li key={k} className="im-none" style={{color: 'var(--text-dim)'}}><span className="im-row-name">{k}</span><span className="im-row-note">{n ?? NONE}</span></li>)}
        </ul>
      </section>
    </div>
    <div className="im-detail">
      {x ? <><b>{x.coordinate} · {HOLDS_WORD[x.state]}</b><span>{labelOf(x.semantic)} → {x.relation ?? NONE} → <code>{x.implementation ?? 'no implementation'}</code>{x.detail ? ` · ${x.detail}` : ''}</span></>
        : <><b>{m?.law ?? NONE} {m?.revision ? `· ${m.revision}` : ''}</b><span>Pick a mapping to read it.</span></>}
    </div>
  </div>
}

type PageId = 'neighbourhood' | 'meaning'
const PAGES: readonly {id: PageId; label: string}[] = [{id: 'neighbourhood', label: 'Reach'}, {id: 'meaning', label: 'Meaning'}]
const pageOf = (p: ViewProps): PageId => (p.page === 'meaning' ? 'meaning' : 'neighbourhood')
const meaningLight = (v: V): LightState | undefined => { const m = meaningOf(v); return m === undefined || m.passed === undefined ? undefined : m.passed ? 'lit' : 'dark' }

// ------------------------------------------------------------------------------------------------ the sample readings (defaults and fixtures only)

/** The wiki register's relations around a wayfinder note: the lane node cites it, and the register's space holds the other notes. */
function noteSample(): Record<string, string> {
  const path = 'Work/O-I/.wayfinder/maps/command-encounter-convergence.md', ref = `central:source:control:root:${path}`
  const lane = 'wiki:node:delivered-lane-loses-install', root = 'central:wiki:root'
  const edge = (from: string, to: string, relation: string) => ({fromRef: from, toRef: to, relation, provenance: 'central wiki', direct: from === ref || to === ref})
  const others: readonly {readonly ref: string; readonly sources: readonly string[]}[] = [
    {ref: 'wiki:node:place-provider-reconciles-like-the-floor', sources: [
      'central:source:control:root:Control/agents/now/flows/herdr-world-entry-20260927/IMPLEMENTATION-PACKET.md',
      'central:source:control:root:Control/agents/now/flows/herdr-world-entry-20260927/omarchy-packet/findings.md']},
    {ref: 'wiki:node:identity', sources: ['Control/user/identity.md']},
    {ref: 'wiki:node:staged/propose-not-write', sources: ['staging/propose-not-write']},
    {ref: 'wiki:node:root/ta-onta-and-the-thought-stream', sources: ['central:source:control:root:Control/agents/wiki/returns/ta-onta-and-the-thought-stream-2026-09-16.md']},
  ]
  const spaces = ['Actuation', 'Central', 'Epi-Prime', 'Factory', 'O-I', 'Point-Cloud-Demo', 'Workcell', 'ai-kit', 'personal', 'projects',
    'Archetypal-Earth', 'Quaternal-I-Ching', 'Quaternal-Tarot', 'ProjectCentral', 'face-rig'].map(n => `central:wiki:project:${n}`)
  const edges = [
    edge(lane, ref, 'node-source'), edge(lane, root, 'node-space'),
    edge(lane, 'git:ai-kit@convergence/command-encounter-20260926', 'node-source'), edge(lane, 'git:ai-kit@guidance/development-world-shape', 'node-source'),
    ...others.map(n => edge(n.ref, root, 'node-space')),
    ...spaces.map(s => edge(root, s, 'space-child-space')),
    ...others.flatMap(n => n.sources.map(s => edge(n.ref, s, 'node-source'))),
  ]
  const nodes = [...new Set(edges.flatMap(x => [x.fromRef, x.toRef]))].map(r => ({ref: r, role: roleIn(r)}))
  const mention = (name: string, where: string) => ({name, kind: 'file', location: {path: where}})
  const session = (nowRef: string, purpose: string, lifecycle: string, branch: string) => ({nowRef, purpose, lifecycle, work: [`Work/O-I @ ${branch}`], boundaryOp: 'now'})
  return {
    subject: JSON.stringify({kind: 'note', path, ref}),
    nodes: JSON.stringify(nodes),
    edges: JSON.stringify(edges),
    references: JSON.stringify([
      mention('wiki.json', 'Control/agents/wiki/wiki.json'),
      mention('README.md', 'Control/agents/now/flows/development-entry-2026-09-30/README.md'),
      mention('command-encounter-classification.md', 'Work/O-I/.wayfinder/maps/command-encounter-classification.md'),
    ]),
    sessions: JSON.stringify([
      session('s1', 'Recovered the delivered Nara, personal and Epii identity path', 'archived', 'agent/nara-integration-20260921'),
      session('s2', 'Mac Track 2 self-inhabitation loop: harden the root NOW record law', 'archived', 'agent/factory-run-expressions-20260919'),
      session('s3', 'Suite git cleanup session (root register, interactive)', 'archived', 'agent/expression-world-convergence-20260917'),
      session('s4', 'Cradle Wiki-constellation feature integrated, reviewed, tested and merged', 'archived', 'main'),
    ]),
  }
}

/** The real directory of Work/Quaternal-Logic/schemas, and the sessions the register ties to that project. The graph holds no reading of it. */
function folderSample(): Record<string, string> {
  const path = 'Work/Quaternal-Logic/schemas'
  const entry = (name: string, bytes?: number) => ({name, kind: bytes === undefined ? 'directory' : 'file', byte_len: bytes ?? 0, location: {path: `${path}/${name}`}})
  const session = (nowRef: string, purpose: string, lifecycle: string, branch: string) => ({nowRef, purpose, lifecycle, work: [`Work/Quaternal-Logic @ ${branch}`], boundaryOp: 'now'})
  return {
    subject: JSON.stringify({kind: 'folder', path, ref: 'central:source:project:Quaternal-Logic:schemas'}),
    nodes: '[]',
    edges: '[]',
    references: JSON.stringify([
      entry('epi-vak-registry-v1.schema.json', 6200), entry('oi.config-error-v1.schema.json', 1300), entry('oi.config-validation-v1.schema.json', 2000),
      entry('oi.configuration-contribution-v1.schema.json', 7600), entry('q2'), entry('q3'), entry('q4'), entry('ql-agent-contracts-v1.schema.json', 11000),
      entry('ql-mef-meta-binding-v1.schema.json', 1600), entry('ql-mef-meta-portal-v1.schema.json', 5400), entry('ql-mef-meta-recognition-v1.schema.json', 2900),
      entry('ql-mef-wiki-refraction-v1.schema.json', 4400), entry('techne'),
    ]),
    sessions: JSON.stringify([
      session('q1', 'Accountable QL native primitive, formal and domain fidelity, architectural review', 'active', 'main'),
      session('q2', 'Recovered the delivered Nara, personal and Epii identity path', 'archived', 'agent/nara-ql-integration-20260921'),
      session('q3', 'Suite git cleanup session (root register, interactive)', 'archived', 'techne/t9-integrated-field'),
    ]),
  }
}

// The note's reflection: the wayfinder map names the command-encounter convergence, which AIKit's encounter host and the gateway carry.
const MEANING_NOTE = {
  law: 'ai-kit:command-encounter', revision: 'r4', passed: false, truncated: false, lenses: {meaning: 3, descriptions: 2, code: 5, verification: 2},
  mappings: [
    {coordinate: 'encounter', semantic: 'wiki:node:delivered-lane-loses-install', implementation: 'crates/aikit-core/src/encounter.rs', relation: 'implements', state: 'holds'},
    {coordinate: 'one composer', semantic: 'git:ai-kit@guidance/development-world-shape', implementation: 'crates/aikit-core/src/encounter_conversation.rs', relation: 'implements', state: 'holds'},
    {coordinate: 'history', semantic: 'wiki:node:place-provider-reconciles-like-the-floor', implementation: 'crates/aikit-core/src/encounter_delivery.rs', relation: 'implements', state: 'stale',
      detail: 'Checked against 3f2a91c; the file is now at 8b04d7e.'},
    {coordinate: 'disconnect', semantic: 'wiki:node:identity', implementation: 'crates/aikit-cli/src/gateway_contact.rs', relation: 'describes', state: 'wrong-relation',
      detail: 'The law names implements; the map binds describes.'},
    {coordinate: 'install', semantic: 'wiki:node:delivered-lane-loses-install', relation: 'implements', state: 'missing'},
  ],
}
// The schemas folder's reflection: Quaternal Logic's meta-structure and the schemas that carry it (Work/Quaternal-Logic/schemas).
const MEANING_SCHEMAS = {
  law: 'ql:meta-schemas', revision: 'r11', passed: false, truncated: false, lenses: {meaning: 6, descriptions: 1, code: 6, verification: 4},
  mappings: [
    {coordinate: 'binding', semantic: 'wiki:node:ql-meta-binding', implementation: 'schemas/ql-mef-meta-binding-v1.schema.json', relation: 'implements', state: 'holds'},
    {coordinate: 'portal', semantic: 'wiki:node:ql-meta-portal', implementation: 'schemas/ql-mef-meta-portal-v1.schema.json', relation: 'implements', state: 'holds'},
    {coordinate: 'recognition', semantic: 'wiki:node:ql-meta-recognition', implementation: 'schemas/ql-mef-meta-recognition-v1.schema.json', relation: 'implements', state: 'duplicate',
      detail: 'schemas/q3 carries a second recognition schema.'},
    {coordinate: 'refraction', semantic: 'wiki:node:ql-wiki-refraction', implementation: 'schemas/ql-mef-wiki-refraction-v1.schema.json', relation: 'implements', state: 'holds'},
    {coordinate: 'agents', semantic: 'wiki:node:ql-agent-contracts', implementation: 'schemas/ql-agent-contracts-v1.schema.json', relation: 'implements', state: 'stale',
      detail: 'Checked against r3 of the contract; the schema is at r5.'},
    {coordinate: 'vak', semantic: 'wiki:node:epi-vak-registry', implementation: 'schemas/epi-vak-registry-v1.schema.json', relation: 'implements', state: 'constitutive-flattening',
      detail: 'The law keeps the source and the context of a vāk as two faces; the schema binds them as one.'},
  ],
}

export const design: DesignedDevice = {
  id: 'central:impact',
  title: 'Impact',
  kind: 'effect',
  firstPage: 'neighbourhood',
  defaults: {
    light: 'lit', pin: false, depth: 1, relation: 'all',
    'show:references': true, 'show:links': true, 'show:sessions': true, closed: false,
    // Readings: the subject, the graph around it, its references and the sessions that touch it.
    ...noteSample(),
    meaning: JSON.stringify(MEANING_NOTE),
  },
  fixtures: {
    'A note': {},
    'A folder, graph refused': {...folderSample(), 'refusal:graph': 'The graph reading is unavailable', meaning: JSON.stringify(MEANING_SCHEMAS)},
    'Meaning holds': {meaning: JSON.stringify({...MEANING_NOTE, passed: true, mappings: MEANING_NOTE.mappings.map(x => ({...x, state: 'holds', detail: undefined}))})},
    'Three links out': {depth: 3},
    'No readings': Object.fromEntries(['light', 'pin', 'depth', 'relation', 'show:references', 'show:links', 'show:sessions', 'closed', 'subject', 'nodes', 'edges', 'references',
      'sessions', 'refusal:graph', 'meaning'].map(k => [k, undefined])),
  },

  folded: p => {
    const m = model(p.v), n = items(m)
    return <Folded title="Impact" light={light(p)} readings={[m.path ? clip(tailOf(m.path), 10) : NONE, n === undefined ? NONE : plural(n, 'item')]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Impact" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><Picture p={p} w={140} h={146} size="compact" /></Section>
    <Section label="Macros" cols={2}>
      <DepthDial p={p} />
      <PinToggle p={p} />
      <RelationChooser p={p} />
      <ClosedToggle p={p} />
    </Section>
    <Section label="Reads" cols={1}><Counts p={p} /></Section>
  </Panel>,

  whole: p => <ImpactWhole p={p} />,

  full: p => <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Pages">
      {PAGES.map(x => <button key={x.id} type="button" role="tab" aria-selected={x.id === pageOf(p)} onClick={() => p.setPage(x.id)}>{x.id === 'neighbourhood' ? 'Neighbourhood' : x.label}</button>)}
    </div>
    <div className="im-host">{pageOf(p) === 'meaning' ? <MeaningFull p={p} /> : <ImpactFull p={p} />}</div>
  </div>,

  widget: p => {
    const m = model(p.v), first = m.sessions.find(isOpen)
    const side = first ? first.purpose : m.status.sessions === 'off' ? 'sessions off' : m.status.sessions === 'unread' ? NONE : 'no open session'
    return <Tile title="Impact" light={light(p)} span={2} onFull={p.nav.full}>
      <Picture p={p} w={76} h={76} size="tile" />
      <div className="im-tile-side">
        <div className="im-tile-subject" data-i={m.subject ? `Subject|The ${m.kind ?? 'subject'} that Impact reads: ${m.path}` : 'Subject|No reading of the subject.'}>{m.path ? clip(tailOf(m.path), 22) : NONE}<small>{m.kind ?? NONE}</small></div>
        <div className="im-tile-counts"><Counts p={p} /></div>
        <button type="button" className="im-first" data-none={first ? undefined : 'true'} disabled={!first}
          data-i={first ? `${first.purpose}|${sessionWords(first)} Click to open it in a pane.` : m.status.sessions === 'unread' ? 'Sessions|No reading of the sessions.' : 'Sessions|No open session works in this project.'} onClick={p.nav.full}>
          <Glyph kind="session" /><span>{side}</span>
        </button>
      </div>
    </Tile>
  },
}
