// Impact (manual §18.13): what a change to a folder or a note will touch. Live's nearest: Utility — a small effect whose meaning is
// plain at a glance — with the Scope pattern for a picture of reach on rings. The picture is the neighbourhood itself: the subject
// at the centre and one ring for each link out. The device reads three owners and keeps no index: the knowledge graph (the nodes and
// edges of `oi.cradle.graph-reading/v1`), the folder listing and file map, and the NOW register. The owner's cut of the graph is
// inhabitants/centralImpactModel.ts (projectNeighbourhood, projectSessions); this panel draws the same roles (node, source, other)
// and the same split of direct and indirect links, and walks the reading's edges to Depth. The readings are real: the wiki register's
// own relations around a wayfinder note, the real directory of Work/Quaternal-Logic/schemas, and the real NOW register's work refs.
import {useState, type ReactNode} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
import './central__impact.css'

type V = ViewProps['v']

// ------------------------------------------------------------------------------------------------ the readings

type Role = 'node' | 'source' | 'unknown'
type Lifecycle = 'active' | 'quiescent' | 'closed' | 'archived'

interface Edge {readonly from: string; readonly to: string; readonly relation: string; readonly provenance: string}
interface FileRow {readonly name: string; readonly path: string; readonly kind: 'file' | 'directory'; readonly size?: string; readonly how: 'holds' | 'mentions'}
interface Session {readonly id: string; readonly purpose: string; readonly lifecycle: Lifecycle; readonly branch: string}
interface Reading {readonly kind: string; readonly path: string; readonly ref: string; readonly edges: readonly Edge[]; readonly files: readonly FileRow[]; readonly sessions: readonly Session[]}

/** The owner's relation names, in the words the Relation chooser shows. */
const REL: Readonly<Record<string, string>> = {'node-source': 'Source', 'node-space': 'Space', 'space-child-space': 'Child space', 'wiki-link': 'Link', references: 'Reference'}
const relName = (r: string) => REL[r] ?? r

/** The owner's three sources, as the lists name them. */
const SOURCE = {links: 'knowledge graph', folder: 'folder listing', mentions: 'file map', sessions: 'NOW register'} as const

const NOTE_PATH = 'Work/O-I/.wayfinder/maps/command-encounter-convergence.md'
const NOTE_REF = `central:source:control:root:${NOTE_PATH}`
const WIKI = 'central wiki'
const e = (from: string, to: string, relation: string): Edge => ({from, to, relation, provenance: WIKI})

const LANE = 'wiki:node:delivered-lane-loses-install'
const ROOT = 'central:wiki:root'
const OTHER_NODES: readonly {readonly ref: string; readonly sources: readonly string[]}[] = [
  {ref: 'wiki:node:place-provider-reconciles-like-the-floor', sources: [
    'central:source:control:root:Control/agents/now/flows/herdr-world-entry-20260927/IMPLEMENTATION-PACKET.md',
    'central:source:control:root:Control/agents/now/flows/herdr-world-entry-20260927/omarchy-packet/findings.md']},
  {ref: 'wiki:node:identity', sources: ['Control/user/identity.md']},
  {ref: 'wiki:node:staged/propose-not-write', sources: ['staging/propose-not-write']},
  {ref: 'wiki:node:root/ta-onta-and-the-thought-stream', sources: ['central:source:control:root:Control/agents/wiki/returns/ta-onta-and-the-thought-stream-2026-09-16.md']},
]
const CHILD_SPACES = ['Actuation', 'Central', 'Epi-Prime', 'Factory', 'O-I', 'Point-Cloud-Demo', 'Workcell', 'ai-kit', 'personal', 'projects',
  'Archetypal-Earth', 'Quaternal-I-Ching', 'Quaternal-Tarot', 'ProjectCentral', 'face-rig'].map(n => `central:wiki:project:${n}`)

/** The wiki register's relations around the note: the lane node cites it, and the register's space holds the other notes. */
const NOTE_EDGES: readonly Edge[] = [
  e(LANE, NOTE_REF, 'node-source'), e(LANE, ROOT, 'node-space'),
  e(LANE, 'git:ai-kit@convergence/command-encounter-20260926', 'node-source'), e(LANE, 'git:ai-kit@guidance/development-world-shape', 'node-source'),
  ...OTHER_NODES.map(n => e(n.ref, ROOT, 'node-space')),
  ...CHILD_SPACES.map(s => e(ROOT, s, 'space-child-space')),
  ...OTHER_NODES.flatMap(n => n.sources.map(s => e(n.ref, s, 'node-source'))),
]

const dirent = (name: string, size?: string): FileRow => ({name, path: `Work/Quaternal-Logic/schemas/${name}`, kind: size ? 'file' : 'directory', size, how: 'holds'})
const FOLDER_PATH = 'Work/Quaternal-Logic/schemas'

const READINGS: Readonly<Record<string, Reading>> = {
  [NOTE_PATH]: {
    kind: 'note', path: NOTE_PATH, ref: NOTE_REF, edges: NOTE_EDGES,
    files: [
      {name: 'wiki.json', path: 'Control/agents/wiki/wiki.json', kind: 'file', how: 'mentions'},
      {name: 'README.md', path: 'Control/agents/now/flows/development-entry-2026-09-30/README.md', kind: 'file', how: 'mentions'},
      {name: 'command-encounter-classification.md', path: 'Work/O-I/.wayfinder/maps/command-encounter-classification.md', kind: 'file', how: 'mentions'},
    ],
    sessions: [
      {id: 's1', purpose: 'Recovered the delivered Nara, personal and Epii identity path', lifecycle: 'archived', branch: 'agent/nara-integration-20260921'},
      {id: 's2', purpose: 'Mac Track 2 self-inhabitation loop: harden the root NOW record law', lifecycle: 'archived', branch: 'agent/factory-run-expressions-20260919'},
      {id: 's3', purpose: 'Suite git cleanup session (root register, interactive)', lifecycle: 'archived', branch: 'agent/expression-world-convergence-20260917'},
      {id: 's4', purpose: 'Cradle Wiki-constellation feature integrated, reviewed, tested and merged', lifecycle: 'archived', branch: 'main'},
    ],
  },
  [FOLDER_PATH]: {
    kind: 'folder', path: FOLDER_PATH, ref: `central:source:project:Quaternal-Logic:schemas`, edges: [],
    files: [dirent('epi-vak-registry-v1.schema.json', '6.2k'), dirent('oi.config-error-v1.schema.json', '1.3k'), dirent('oi.config-validation-v1.schema.json', '2.0k'),
      dirent('oi.configuration-contribution-v1.schema.json', '7.6k'), dirent('q2'), dirent('q3'), dirent('q4'), dirent('ql-agent-contracts-v1.schema.json', '11k'),
      dirent('ql-mef-meta-binding-v1.schema.json', '1.6k'), dirent('ql-mef-meta-portal-v1.schema.json', '5.4k'), dirent('ql-mef-meta-recognition-v1.schema.json', '2.9k'),
      dirent('ql-mef-wiki-refraction-v1.schema.json', '4.4k'), dirent('techne')],
    sessions: [
      {id: 'q1', purpose: 'Accountable QL native primitive, formal and domain fidelity, architectural review', lifecycle: 'active', branch: 'main'},
      {id: 'q2', purpose: 'Recovered the delivered Nara, personal and Epii identity path', lifecycle: 'archived', branch: 'agent/nara-ql-integration-20260921'},
      {id: 'q3', purpose: 'Suite git cleanup session (root register, interactive)', lifecycle: 'archived', branch: 'techne/t9-integrated-field'},
    ],
  },
}

// ------------------------------------------------------------------------------------------------ the law of the picture

/** The owner's roles for a graph ref (centralImpactModel.ts projectNeighbourhood). */
const roleOf = (ref: string): Role => (ref.startsWith('wiki:node:') ? 'node' : ref.startsWith('central:source:') ? 'source' : 'unknown')
const tailOf = (s: string) => s.split('/').filter(Boolean).pop() ?? s
const labelOf = (ref: string): string => {
  if (ref.startsWith('wiki:node:')) return tailOf(ref.slice('wiki:node:'.length))
  if (ref === ROOT) return 'root space'
  if (ref.startsWith('central:wiki:project:')) return ref.slice('central:wiki:project:'.length)
  return tailOf(ref)
}
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const MAX_DEPTH = 4

interface Walk {readonly hop: ReadonlyMap<string, number>; readonly parent: ReadonlyMap<string, string>; readonly angle: ReadonlyMap<string, number>; readonly edges: readonly Edge[]}

/** Walk the reading's edges from the subject, outward, to four links; only edges of the chosen relation carry the walk. Every node keeps its
 * place whatever Depth is, so the picture moves only when a reading moves. */
function walk(r: Reading, relation: string): Walk {
  const edges = r.edges.filter(x => relation === 'all' || x.relation === relation)
  const near = new Map<string, string[]>()
  for (const x of edges) { near.set(x.from, [...(near.get(x.from) ?? []), x.to]); near.set(x.to, [...(near.get(x.to) ?? []), x.from]) }
  const hop = new Map<string, number>([[r.ref, 0]]), parent = new Map<string, string>(), order = [r.ref]
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
  place(r.ref, 0, Math.PI * 2)
  return {hop, parent, angle, edges: edges.filter(x => hop.has(x.from) && hop.has(x.to))}
}

interface LinkRow {readonly edge: Edge; readonly direct: boolean; readonly hop: number}

interface Model {
  readonly r: Reading; readonly kind: string; readonly path: string
  readonly depth: number; readonly relation: string
  readonly showLinks: boolean; readonly showRefs: boolean; readonly showSessions: boolean; readonly closed: boolean
  readonly refusal: string | null
  readonly walk: Walk | null
  readonly kinds: readonly string[]
  readonly shown: readonly string[]; readonly ghost: readonly string[]
  readonly drawn: readonly Edge[]; readonly drawnGhost: readonly Edge[]
  readonly links: readonly LinkRow[]
  readonly files: readonly FileRow[]
  readonly sessions: readonly Session[]; readonly closedHidden: number
}

const EMPTY: Reading = {kind: 'note', path: '', ref: '', edges: [], files: [], sessions: []}

/** Everything the five views draw, from the one set of values. */
function model(v: V): Model {
  const [kind = 'note', ...rest] = str(v, 'subject').split(' · ')
  const path = rest.join(' · '), r = READINGS[path] ?? {...EMPTY, kind, path, ref: path}
  const depth = num(v, 'depth'), relation = str(v, 'relation')
  const showLinks = on(v, 'show:links'), showRefs = on(v, 'show:references'), showSessions = on(v, 'show:sessions'), closed = on(v, 'closed')
  const refusal = typeof v['refusal:graph'] === 'string' ? String(v['refusal:graph']) : null
  const reads = showLinks && !refusal
  const w = reads ? walk(r, relation) : null
  const kinds = reads ? [...new Set(walk(r, 'all').edges.map(x => x.relation))] : []
  const hopOf = (ref: string) => w?.hop.get(ref) ?? Infinity
  const shown = w ? [...w.hop].filter(([, h]) => h <= depth).map(([ref]) => ref) : [r.ref]
  const ghost = w ? [...w.hop].filter(([, h]) => h === depth + 1).map(([ref]) => ref) : []
  const drawn = w ? w.edges.filter(x => hopOf(x.from) <= depth && hopOf(x.to) <= depth) : []
  const drawnGhost = w ? w.edges.filter(x => Math.max(hopOf(x.from), hopOf(x.to)) === depth + 1) : []
  const links = drawn.map(edge => ({edge, direct: edge.from === r.ref || edge.to === r.ref, hop: Math.max(hopOf(edge.from), hopOf(edge.to))}))
    .sort((a, b) => Number(b.direct) - Number(a.direct) || a.hop - b.hop)
  const open = (s: Session) => s.lifecycle === 'active' || s.lifecycle === 'quiescent'
  const sessions = showSessions ? r.sessions.filter(s => closed || open(s)) : []
  return {r, kind, path, depth, relation, showLinks, showRefs, showSessions, closed, refusal, walk: w, kinds, shown, ghost, drawn, drawnGhost, links,
    files: showRefs ? r.files : [], sessions, closedHidden: showSessions && !closed ? r.sessions.filter(s => !open(s)).length : 0}
}

const countOf = (m: Model, list: 'refs' | 'links' | 'sessions'): number | string =>
  list === 'refs' ? (m.showRefs ? m.files.length : 'off')
    : list === 'links' ? (!m.showLinks ? 'off' : m.refusal ? 'refused' : m.links.length)
      : (m.showSessions ? m.sessions.length : 'off')
const items = (m: Model) => m.files.length + m.links.length + m.sessions.length

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
    <circle cx={cx} cy={cy} r={step * m.depth} className="im-reach" />
    {Array.from({length: MAX_DEPTH}, (_, i) => <circle key={i} cx={cx} cy={cy} r={step * (i + 1)} className="im-ring" data-reach={i + 1 === m.depth ? 'true' : undefined} />)}
    {big && Array.from({length: MAX_DEPTH}, (_, i) => <text key={i} x={cx + 4} y={cy - step * (i + 1) - 3} className="dp-axis">{i + 1}</text>)}
    {m.drawnGhost.map((x, i) => { const [x1, y1] = at(x.from), [x2, y2] = at(x.to); return <line key={`g${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="im-edge" data-ghost="true" /> })}
    {m.drawn.map((x, i) => { const [x1, y1] = at(x.from), [x2, y2] = at(x.to); return <line key={`e${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="im-edge" data-direct={x.from === m.r.ref || x.to === m.r.ref ? 'true' : undefined} /> })}
    {m.ghost.map(ref => { const [x, y] = at(ref); return <circle key={ref} cx={x} cy={y} r={dot} className="im-node" data-ghost="true" /> })}
    {m.shown.filter(ref => ref !== m.r.ref).map(ref => {
      const [x, y] = at(ref), role = roleOf(ref), a = m.walk?.angle.get(ref) ?? 0, h = m.walk?.hop.get(ref) ?? 1
      const right = Math.cos(a) >= 0
      return <g key={ref} data-i={big ? `${labelOf(ref)}|${role === 'node' ? 'A note of the wiki register.' : role === 'source' ? 'A source file.' : 'A space, a branch or another source.'} ${h} ${h === 1 ? 'link' : 'links'} from the subject.` : undefined}>
        {role === 'source' ? <rect x={x - dot} y={y - dot} width={dot * 2} height={dot * 2} className="im-node" data-role="source" />
          : <circle cx={x} cy={y} r={dot} className="im-node" data-role={role} />}
        {picked === ref && <circle cx={x} cy={y} r={dot + 4} className="im-pick" />}
        {big && labelled(ref) && <text x={x + (right ? dot + 5 : -dot - 5)} y={y + 3} textAnchor={right ? 'start' : 'end'} className="im-label" data-hop={h} data-picked={picked === ref ? 'true' : undefined}>{clip(labelOf(ref), 26)}</text>}
        {onPick && <circle cx={x} cy={y} r={dot + 6} className="im-hit" onClick={() => onPick(ref)} />}
      </g>
    })}
    <circle cx={cx} cy={cy} r={hub + 3} className="im-subject-ring" />
    <circle cx={cx} cy={cy} r={hub} className="im-subject" />
    {onPick && <circle cx={cx} cy={cy} r={hub + 6} className="im-hit" onClick={() => onPick(m.r.ref)} />}
    {big && <text x={cx} y={cy + hub + 14} textAnchor="middle" className="im-label" data-hop="1">{clip(tailOf(m.path), 40)}</text>}
  </g>
}

/** What the well says when a reading is missing (DEVICE-UI §7). */
function Say({m, g}: {m: Model; g: Geometry}) {
  const text = !m.showLinks ? 'links off' : m.refusal ? 'graph refused' : null
  return text ? <text x={g.cx} y={g.cy + 20} textAnchor="middle" className="im-say" data-tone={m.refusal ? 'refused' : undefined}>{text}</text> : null
}

/** The display: the neighbourhood, the handle that sets Depth, the subject along the foot. */
function Picture({v, set, w, h, size}: {v: V; set?: ViewProps['set']; w: number; h: number; size: 'compact' | 'whole' | 'tile'}) {
  const m = model(v), g = geometry(w, h, size === 'tile'), pinned = on(v, 'pin')
  const hx = g.cx + g.step * m.depth * Math.cos(ANGLE_HANDLE), hy = g.cy + g.step * m.depth * Math.sin(ANGLE_HANDLE)
  const corner = size === 'tile' ? undefined : !m.showLinks ? 'links off' : m.refusal ? 'refused' : `depth ${m.depth}${m.ghost.length ? ` · +${m.ghost.length}` : ''}`
  return <Display w={w} h={h} label="Neighbourhood" corner={corner}
    does="The subject at the centre, one ring for each link out. Solid dots are reached. Hollow dots are the next ring. Drag handle 1 to set Depth.">
    <Neighbourhood m={m} g={g} />
    <Say m={m} g={g} />
    {size !== 'tile' && <text x={5} y={h - 5} className="dp-axis">{`${pinned ? 'pinned · ' : ''}${m.kind} · ${clip(tailOf(m.path), size === 'whole' ? 30 : 20)}`}</text>}
    {set && m.showLinks && !m.refusal && <Handle x={hx} y={hy} n={1} label="Depth" does="Drag out or in: how many links away the neighbourhood reaches, from 1 to 4." shape="ring"
      onDrag={(x, y) => set('depth', clampTo(1, MAX_DEPTH, Math.round(Math.hypot(x - g.cx, y - g.cy) / g.step)))} onReset={() => set('depth', 1)} />}
  </Display>
}

// ------------------------------------------------------------------------------------------------ the controls

const light = (_: V): LightState => 'lit'
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function DepthDial({p}: {p: ViewProps}) {
  const m = model(p.v)
  return <Dial label="Depth" does="How many links away the neighbourhood reaches, from 1 to 4. Each step adds one ring." value={m.depth} def={1}
    scale={{min: 1, max: MAX_DEPTH, step: 1}} format={x => plural(x, 'link')} onChange={x => p.set('depth', x)}
    disabled={m.showLinks ? undefined : 'Links is off. Turn it on to read the graph.'} />
}

function RelationChooser({p}: {p: ViewProps}) {
  const m = model(p.v)
  return <Chooser label="Relation" wide does="Limit the graph and the Links list to one kind of link. The chooser lists the kinds that the graph holds near the subject." value={m.relation}
    options={[{value: 'all', label: 'All'}, ...m.kinds.map(k => ({value: k, label: relName(k)}))]} onChange={x => p.set('relation', x)}
    disabled={m.showLinks ? undefined : 'Links is off. Turn it on to read the graph.'} />
}

function PinToggle({p}: {p: ViewProps}) {
  return <Toggle label="Pin" does="Keep the subject when you select something else. Off: Impact follows your selection." on={on(p.v, 'pin')} onChange={x => p.set('pin', x)} />
}

function ClosedToggle({p}: {p: ViewProps}) {
  const m = model(p.v)
  return <Toggle label="Closed" does="Add closed and archived sessions to the Sessions list. Off: only active and quiescent sessions show."
    on={on(p.v, 'closed')} onChange={x => p.set('closed', x)} disabled={m.showSessions ? undefined : 'Sessions is off. Turn it on to read the register.'} />
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

const glyphOf = (f: FileRow): ReactNode => <Glyph kind={f.kind === 'directory' ? 'folder' : 'file'} />
/** The far end of a link: the end that stands further out from the subject. */
const farEnd = (m: Model, x: LinkRow) => ((m.walk?.hop.get(x.edge.from) ?? 0) > (m.walk?.hop.get(x.edge.to) ?? 0) ? x.edge.from : x.edge.to)
/** A direct link is named by the note at its far end; an indirect link by both ends. */
const linkName = (m: Model, x: LinkRow) => (x.direct ? labelOf(farEnd(m, x)) : `${labelOf(x.edge.from)} → ${labelOf(x.edge.to)}`)
const linkNote = (x: LinkRow) => relName(x.edge.relation)
const isOpen = (s: Session) => s.lifecycle === 'active' || s.lifecycle === 'quiescent'

function itemRows(m: Model): RowItem[] {
  const out: RowItem[] = []
  if (m.showLinks) {
    if (m.refusal) out.push({id: 'refused', name: 'Links: the graph refused', light: 'dark', mark: <Glyph kind="warn" />, why: m.refusal})
    for (const [i, x] of m.links.entries()) out.push({id: `l${i}`, name: linkName(m, x), light: x.direct ? 'lit' : 'dark', tone: 'value', mark: <Glyph kind="link" />, note: linkNote(x),
      does: `${x.direct ? 'A direct link' : `A link ${x.hop} links out`}, ${relName(x.edge.relation).toLowerCase()}, from the ${x.edge.provenance}.`})
  }
  for (const f of m.files) out.push({id: `f${f.path}`, name: f.name, light: 'lit', tone: 'value', mark: glyphOf(f), note: f.size ?? (f.kind === 'directory' ? 'dir' : 'mention'),
    does: f.how === 'holds' ? `A ${f.kind} that the folder holds. Source: the ${SOURCE.folder}.` : `A file that mentions the subject. Source: the ${SOURCE.mentions}.`})
  for (const s of m.sessions) out.push({id: s.id, name: s.purpose, light: isOpen(s) ? 'lit' : 'dark', tone: 'accent', mark: <Glyph kind="session" />, note: clip(s.branch.replace(/^agent\//, ''), 13),
    does: `${s.lifecycle[0]!.toUpperCase()}${s.lifecycle.slice(1)} session on ${s.branch}.`})
  if (m.closedHidden > 0) out.push({id: 'closed-hidden', name: `${m.closedHidden} closed ${m.closedHidden === 1 ? 'session' : 'sessions'} hidden`, light: 'dark', mark: <Glyph kind="session" />,
    does: 'Closed and archived sessions are hidden. Turn on Closed to list them.'})
  return out
}

// ------------------------------------------------------------------------------------------------ the views

function ImpactWhole({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0), m = model(p.v)
  const next = m.ghost.length
  return <Panel title="Impact" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={206}><Picture v={p.v} set={p.set} w={194} h={146} size="whole" /></Section>
      <Section label="Reach" width={100}>
        <DepthDial p={p} />
        <RelationChooser p={p} />
      </Section>
      <Section label="Subject" grow>
        <Readout label="subject" does="What the browser has selected. You set it by selecting a folder, a note or a Day." value={m.kind} tone="accent" />
        <PinToggle p={p} />
        <Readout label="next ring" does="The dots that one more link of Depth adds." value={m.showLinks && !m.refusal ? `+${next}` : undefined} />
      </Section>
    </Band>
    <Band>
      <Section label="Lists" width={84}>
        <Toggle label="References" does="Read the files that the folder holds or that mention the subject. Off: the device does not read them." on={m.showRefs} onChange={x => p.set('show:references', x)} />
        <Toggle label="Links" does="Read the knowledge graph. Off: the device does not read it, and the picture holds the subject alone." on={m.showLinks} onChange={x => p.set('show:links', x)} />
        <Toggle label="Sessions" does="Read the NOW register. Off: the device does not read it." on={m.showSessions} onChange={x => p.set('show:sessions', x)} />
        <ClosedToggle p={p} />
      </Section>
      <Section label="Items" grow>
        <Rows does="Links first, direct links at the top, then references, then sessions. A dim row is not direct, or a session that is not open." items={itemRows(m)}
          size={7} page={page} onPage={setPage} />
      </Section>
    </Band>
  </Panel>
}

/** The pane: the graph at pane size, the three lists beside it, the detail of the item you pick under the graph. */
function ImpactFull({p}: {p: ViewProps}) {
  const m = model(p.v), [picked, setPicked] = useState<string | null>(null), [pickedItem, setPickedItem] = useState<string | null>(null)
  const big: Geometry = {w: 460, h: 364, cx: 230, cy: 180, step: 40}
  const pick = (ref: string | null, item: string | null) => { setPicked(ref); setPickedItem(item) }
  const linkRows = m.links, cap = (n: number, all: number) => (all > n ? n - 1 : n)
  const detail = (() => {
    if (pickedItem?.startsWith('l')) {
      const x = linkRows[Number(pickedItem.slice(1))]
      if (x) return {title: `${labelOf(x.edge.from)} → ${labelOf(x.edge.to)}`, line: <>{relName(x.edge.relation)} · from the {x.edge.provenance} · {x.direct ? 'direct' : `${x.hop} links out`} · <code>{x.edge.to}</code></>}
    }
    const f = m.files.find(y => `f${y.path}` === pickedItem)
    if (f) return {title: f.name, line: <>{f.how === 'holds' ? 'Held by the folder' : 'Mentions the subject'} · <code>{f.path}</code>{f.size ? ` · ${f.size}` : ''}</>}
    const s = m.sessions.find(y => y.id === pickedItem)
    if (s) return {title: s.purpose, line: <>{s.lifecycle} · <code>{s.branch}</code></>}
    if (picked && picked !== m.r.ref) return {title: labelOf(picked), line: <>{roleOf(picked) === 'node' ? 'A note of the wiki register' : roleOf(picked) === 'source' ? 'A source file' : 'A space, a branch or another source'} · {m.walk?.hop.get(picked)} links out · <code>{picked}</code></>}
    return {title: `${m.kind} · ${m.path}`, line: <>{on(p.v, 'pin') ? 'Pinned. ' : ''}Pick a dot or an item to read it. Depth {m.depth}{m.relation === 'all' ? '' : ` · ${relName(m.relation)} links only`}.</>}
  })()
  const Head = ({title, count, source}: {title: string; count: number | string; source: string}) =>
    <h4>{title} <b>{count}</b><small>{source}</small></h4>
  return <div className="im-pane">
    <div className="im-graph">
      <svg viewBox="0 0 460 364" preserveAspectRatio="xMidYMid meet" role="group" aria-label="The neighbourhood of the subject" className="dp-display" style={{background: 'none', border: 0}}>
        <Neighbourhood m={m} g={big} big picked={picked} onPick={ref => pick(ref === m.r.ref ? null : ref, null)} />
        <Say m={m} g={{...big, cy: big.cy + 6}} />
      </svg>
      <span className="im-corner">{m.showLinks && !m.refusal ? `depth ${m.depth}${m.ghost.length ? ` · +${m.ghost.length} at ${m.depth + 1}` : ''}` : m.refusal ? 'graph refused' : 'links off'}</span>
      <div className="im-legend"><span><i data-role="node" /> note</span><span><i data-role="source" /> source</span><span><i data-role="unknown" /> space or other</span></div>
    </div>
    <div className="im-lists">
      <section className="im-list">
        <Head title="Links" count={m.showLinks ? (m.refusal ? '—' : m.links.length) : 'off'} source={SOURCE.links} />
        <ul className="im-rows">
          {m.refusal && <li className="im-refusal" data-i={`Links|The graph owner refused: ${m.refusal}`}>{m.refusal}</li>}
          {!m.showLinks && <li className="im-none">Links is off.</li>}
          {m.showLinks && !m.refusal && m.links.length === 0 && <li className="im-none">The graph holds no link here.</li>}
          {m.links.slice(0, cap(6, m.links.length)).map((x, i) => <li key={i}>
            <button type="button" className="im-row" aria-pressed={pickedItem === `l${i}`} data-dim={x.direct ? undefined : 'true'}
              data-i={`${linkName(m, x)}|${x.direct ? 'A direct link' : `A link ${x.hop} links out`}, ${relName(x.edge.relation).toLowerCase()}. Click to read it.`}
              onClick={() => pick(farEnd(m, x), `l${i}`)}>
              <Glyph kind="link" /><span className="im-row-name">{linkName(m, x)}</span><span className="im-row-note">{linkNote(x)}</span>
            </button></li>)}
          {m.links.length > 6 && <li className="im-more">+{m.links.length - 5} more links</li>}
        </ul>
      </section>
      <section className="im-list">
        <Head title="References" count={m.showRefs ? m.files.length : 'off'} source={m.r.kind === 'folder' ? SOURCE.folder : SOURCE.mentions} />
        <ul className="im-rows">
          {!m.showRefs && <li className="im-none">References is off.</li>}
          {m.showRefs && m.files.length === 0 && <li className="im-none">No file mentions the subject.</li>}
          {m.files.slice(0, cap(5, m.files.length)).map(f => <li key={f.path}>
            <button type="button" className="im-row" aria-pressed={pickedItem === `f${f.path}`}
              data-i={`${f.name}|${f.how === 'holds' ? 'Held by the folder.' : 'Mentions the subject.'} Click to read it.`} onClick={() => pick(null, `f${f.path}`)}>
              {glyphOf(f)}<span className="im-row-name">{f.name}</span><span className="im-row-note">{f.size ?? (f.kind === 'directory' ? 'dir' : 'mention')}</span>
            </button></li>)}
          {m.files.length > 5 && <li className="im-more">+{m.files.length - 4} more files</li>}
        </ul>
      </section>
      <section className="im-list">
        <Head title="Sessions" count={m.showSessions ? m.sessions.length : 'off'} source={SOURCE.sessions} />
        <ul className="im-rows">
          {!m.showSessions && <li className="im-none">Sessions is off.</li>}
          {m.showSessions && m.sessions.length === 0 && <li className="im-none">{m.closedHidden ? `No open session. ${m.closedHidden} closed.` : 'No session names this project.'}</li>}
          {m.sessions.slice(0, cap(4, m.sessions.length)).map(s => <li key={s.id}>
            <button type="button" className="im-row" aria-pressed={pickedItem === s.id} data-i={`${s.purpose}|${s.lifecycle} on ${s.branch}. Click to read it.`} onClick={() => pick(null, s.id)}>
              <span className="im-row-state" data-open={isOpen(s) ? 'true' : 'false'} /><span className="im-row-name">{s.purpose}</span><span className="im-row-note">{s.lifecycle}</span>
            </button></li>)}
          {m.sessions.length > 4 && <li className="im-more">+{m.sessions.length - 3} more sessions</li>}
        </ul>
      </section>
    </div>
    <div className="im-detail"><b>{detail.title}</b><span>{detail.line}</span></div>
  </div>
}

export const design: DesignedDevice = {
  id: 'central:impact',
  title: 'Impact',
  kind: 'effect',
  defaults: {
    subject: `note · ${NOTE_PATH}`, pin: false, depth: 1, relation: 'all',
    'show:references': true, 'show:links': true, 'show:sessions': true, closed: false,
  },
  fixtures: {
    'A note': {},
    'A folder, graph refused': {subject: `folder · ${FOLDER_PATH}`, 'refusal:graph': 'The graph reading is unavailable'},
    'Three links out': {depth: 3},
  },

  folded: p => {
    const m = model(p.v)
    return <Folded title="Impact" light={light(p.v)} readings={[clip(tailOf(m.path), 10), plural(items(m), 'item')]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Impact" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><Picture v={p.v} set={p.set} w={140} h={146} size="compact" /></Section>
    <Section label="Macros" cols={2}>
      <DepthDial p={p} />
      <PinToggle p={p} />
      <RelationChooser p={p} />
      <ClosedToggle p={p} />
    </Section>
    <Section label="Reads" cols={1}><Counts p={p} /></Section>
  </Panel>,

  whole: p => <ImpactWhole p={p} />,

  full: p => <ImpactFull p={p} />,

  widget: p => {
    const m = model(p.v), first = m.sessions.find(isOpen)
    return <Tile title="Impact" light={light(p.v)} span={2} onFull={p.nav.full}>
      <Picture v={p.v} w={76} h={76} size="tile" />
      <div className="im-tile-side">
        <div className="im-tile-subject" data-i={`Subject|The ${m.kind} that Impact reads: ${m.path}`}>{clip(tailOf(m.path), 22)}<small>{m.kind}</small></div>
        <div className="im-tile-counts"><Counts p={p} /></div>
        <button type="button" className="im-first" data-none={first ? undefined : 'true'} disabled={!first}
          data-i={first ? `${first.purpose}|${first.lifecycle} on ${first.branch}. Click to open it in a pane.` : 'Sessions|No open session works in this project.'} onClick={p.nav.full}>
          <Glyph kind="session" /><span>{first ? first.purpose : m.showSessions ? 'no open session' : 'sessions off'}</span>
        </button>
      </div>
    </Tile>
  },
}
