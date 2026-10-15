// Knowledge graph (manual §17.2): the wiki read link by link. Live's nearest: Auto Filter — a well that draws what the device
// does, handles on the well, and a few stepped switches round it. The well is the graph's own law, run on a reading of the
// root wiki: the cradle's filterGraph keeps, dims or drops each note by the scope, depth, direction, kinds, relations, find
// text, ghosts and filter mode, and the canvas's own rules draw it (ghosts dashed and hollow, arrows on the lines, labels by
// the label rule at the zoom). Notes sit on rings by their distance in hops from the note you hold, so the depth is a radius.
import {useMemo, useState} from 'react'
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, toUnit, fromUnit, type RowItem} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
import {defaultGraphFilters, filterGraph, type FilteredGraph, type GraphFilters} from '../../../../../../../desktop/cradle/src/knowledge/filters'
import {graphNodeCaption, isUnresolvedGraphNode, unresolvedGraphAssociations} from '../../../../../../../desktop/cradle/src/knowledge/graphNavigation'
import {emphasizeGraph, type EmphasisGroup} from '../../../../../../../desktop/cradle/src/knowledge/graphEmphasis'
import {GRAPH_ZOOM_LIMITS} from '../../../../../../../desktop/cradle/src/knowledge/camera'
import type {GraphEdge, GraphNode, GraphReading} from '../../../../../../../desktop/cradle/src/knowledge/graph'
import './knowledge-graph__graph.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- the reading (the root wiki, as Control/agents/wiki/wiki.json holds it)

const ROOT = 'central:wiki:root'
const PROJECTS = ['Actuation', 'Central', 'Epi-Prime', 'Factory', 'O-I', 'Point-Cloud-Demo', 'Workcell', 'ai-kit', 'personal', 'projects',
  'Archetypal-Earth', 'Quaternal-I-Ching', 'Quaternal-Tarot', 'ProjectCentral', 'face-rig'] as const
const project = (name: string) => `central:wiki:project:${name}`
const NOTES = [
  {ref: 'wiki:node:identity', label: 'User identity', source: 'Control/user/identity.md'},
  {ref: 'wiki:node:staged/propose-not-write', label: 'You may propose', source: 'staging/propose-not-write'},
  {ref: 'wiki:node:root/ta-onta-and-the-thought-stream', label: 'The beings, the thought stream, and who owns what'},
  {ref: 'wiki:node:place-provider-reconciles-like-the-floor', label: 'A place provider reconciles like the floor'},
  {ref: 'wiki:node:delivered-lane-loses-install', label: 'A delivered lane that leaves the installed cut is lost work'},
] as const
const IDENTITY = NOTES[0].ref, BEINGS = NOTES[2].ref
const GHOST = 'view:unresolved-link:ta-onta'

const provenance = {source: 'central-wiki'}
const node = (ref: string, kind: string, label: string, owner = 'central-wiki'): GraphNode => ({ref, kind, label, native_owner: owner, provenance, actions: []})
const edge = (from_ref: string, to_ref: string, relation: string): GraphEdge => ({relation, from_ref, to_ref, provenance, family: 'native-semantic'})

const READING = {
  schema: 'oi.cradle.graph-reading/v1',
  nodes: [
    node(ROOT, 'wiki-space', 'Central'),
    ...PROJECTS.map(name => node(project(name), 'wiki-space', name === 'Central' ? 'Central · project' : name)),
    ...NOTES.map(note => node(note.ref, 'wiki-node', note.label)),
    ...NOTES.flatMap(note => ('source' in note ? [node(`source:${note.source}`, 'file', note.source)] : [])),
    {...node(GHOST, 'unresolved-link', 'ta-onta', 'graph-presentation'), unresolved: {key: 'ta-onta', sources: {[IDENTITY]: 1, [BEINGS]: 2}}} as GraphNode,
  ],
  edges: [
    ...PROJECTS.map(name => edge(ROOT, project(name), 'space-child-space')),
    ...NOTES.map(note => edge(ROOT, note.ref, 'space-node')),
    ...NOTES.flatMap(note => ('source' in note ? [edge(note.ref, `source:${note.source}`, 'node-source')] : [])),
  ],
  // The sixfold that the beings note names; Aletheia (QL-MEF) holds no space in this reading, so the whole is partial.
  formations: [{ref: BEINGS, partial: true, members: [['Central', 'Khora'], ['Actuation', 'Hen'], ['ai-kit', 'Pleroma'], ['Factory', 'Chronos'], ['Workcell', 'Anima']]
    .map(([name, role]) => ({ref: project(name!), role}))}],
  truncated: false,
} as unknown as GraphReading

const KINDS = [...new Set(READING.nodes.map(n => n.kind))]
const RELATIONS = [...new Set(READING.edges.map(e => e.relation))]
const ASSOCIATIONS = unresolvedGraphAssociations(READING.nodes)
const byRef = new Map(READING.nodes.map(n => [n.ref, n]))

/** The groups that the person coloured (the canvas's emphasis groups: a name, a colour, and what they match). */
const GROUPS: readonly Omit<EmphasisGroup, 'enabled'>[] = [
  {id: 'projects', label: 'Projects', color: 'var(--sel)', text: '', kinds: ['wiki-space'], tags: []},
  {id: 'sources', label: 'Sources', color: 'var(--green)', text: '', kinds: ['file'], tags: []},
  {id: 'proposals', label: 'Proposals', color: 'var(--dp-value)', text: 'propose', kinds: [], tags: []},
]

// ---------------------------------------------------------------- the values, and the filter state they stand for

const SCOPES = [{value: 'field', label: 'Field', does: 'Read every note in the available field.'}, {value: 'local', label: 'Note', does: 'Read only the neighbourhood of the selected note.'}] as const
const DIRECTIONS = [{value: 'both', label: 'Both', does: 'Follow relations in both directions.'}, {value: 'outgoing', label: 'Out', does: 'Follow only the relations that leave the note.'},
  {value: 'incoming', label: 'In', does: 'Follow only the relations that arrive at the note: its backlinks.'}] as const
const MODES = [{value: 'structure', label: 'Context', does: 'Keep the disclosed structure round a match and dim it.'}, {value: 'matches', label: 'Matches', does: 'Hide all but the matches. The graph says it shows part of the whole.'}] as const
const LABELS = [{value: 'automatic', label: 'Auto', does: 'Show labels as you zoom in.'}, {value: 'all', label: 'All', does: 'Show every label that fits.'}, {value: 'focus', label: 'Focus', does: 'Show only the labels of the selected note.'}] as const

const list = (v: V, key: string): string[] => (str(v, key) ? str(v, key).split('|') : [])
const selectedRef = (v: V) => str(v, 'selected')
const groupsOf = (v: V): EmphasisGroup[] => GROUPS.map(g => ({...g, enabled: v[`g:${g.id}`] !== false}))

function filtersOf(v: V): GraphFilters {
  return {...defaultGraphFilters(), text: str(v, 'text'), scope: str(v, 'scope') as GraphFilters['scope'], depth: num(v, 'depth'), direction: str(v, 'direction') as GraphFilters['direction'],
    kinds: list(v, 'kinds'), relations: list(v, 'relations'), isolated: on(v, 'orphans'), unresolved: on(v, 'ghosts'), context: str(v, 'mode') as GraphFilters['context'],
    labels: str(v, 'labels') as GraphFilters['labels'], arrows: on(v, 'arrows'), shared: on(v, 'shared'), emphasis: groupsOf(v)}
}
const resultOf = (v: V): FilteredGraph => filterGraph(READING, filtersOf(v), selectedRef(v) || undefined)

const HOPS = 80, WORLD = {x: 400, y: 260}
const ZOOM = {min: GRAPH_ZOOM_LIMITS.minZoom, max: GRAPH_ZOOM_LIMITS.maxZoom, log: true}
const DEPTH = {min: 0, max: 8, step: 1}
const BUDGET = {min: 1, max: 20000, log: true}
const pctx = (x: number) => `${Math.round(x * 100)} %`
const hops = (x: number) => `${x} ${x === 1 ? 'hop' : 'hops'}`
const count = (x: number) => (x >= 10000 ? `${Math.round(x / 1000)}k` : `${Math.round(x)}`)

// ---------------------------------------------------------------- the layout: notes on rings by hops from the note you hold

interface Place {x: number; y: number; hop: number}
const NEIGHBOURS = new Map<string, Set<string>>()
const link = (a: string, b: string) => { (NEIGHBOURS.get(a) ?? NEIGHBOURS.set(a, new Set()).get(a)!).add(b); (NEIGHBOURS.get(b) ?? NEIGHBOURS.set(b, new Set()).get(b)!).add(a) }
for (const e of READING.edges) link(e.from_ref, e.to_ref)
for (const a of ASSOCIATIONS) link(a.source, a.ghost)

const LAYOUTS = new Map<string, Map<string, Place>>()
function layoutFrom(start: string): Map<string, Place> {
  const known = LAYOUTS.get(start)
  if (known) return known
  const hop = new Map<string, number>([[start, 0]]), queue = [start]
  for (let i = 0; i < queue.length; i++) for (const b of NEIGHBOURS.get(queue[i]!) ?? []) if (!hop.has(b)) { hop.set(b, hop.get(queue[i]!)! + 1); queue.push(b) }
  const reach = Math.max(...hop.values())
  for (const n of READING.nodes) if (!hop.has(n.ref)) hop.set(n.ref, reach + 1)
  const top = Math.max(...hop.values()), angle = new Map<string, number>(), places = new Map<string, Place>()
  const parents = (ref: string, h: number) => [...(NEIGHBOURS.get(ref) ?? [])].filter(r => hop.get(r) === h - 1 && angle.has(r))
  const mean = (ref: string, h: number) => { const a = parents(ref, h); return a.length ? Math.atan2(a.reduce((s, r) => s + Math.sin(angle.get(r)!), 0), a.reduce((s, r) => s + Math.cos(angle.get(r)!), 0)) : -Math.PI / 2 }
  for (let h = 0; h <= top; h++) {
    const ring = READING.nodes.filter(n => hop.get(n.ref) === h).sort((a, b) => mean(a.ref, h) - mean(b.ref, h)), n = ring.length
    ring.forEach((item, i) => {
      const a = h === 0 ? 0 : h === 1 ? -2.6 + 2 * Math.PI * i / n : n <= 4 ? mean(item.ref, h) + (i - (n - 1) / 2) * .6 : -Math.PI / 2 + h * .35 + 2 * Math.PI * i / n
      angle.set(item.ref, a)
      places.set(item.ref, {x: WORLD.x + h * HOPS * Math.cos(a), y: WORLD.y + h * HOPS * Math.sin(a), hop: h})
    })
  }
  LAYOUTS.set(start, places)
  return places
}
const centreOf = (v: V) => layoutFrom(selectedRef(v) || ROOT)

// ---------------------------------------------------------------- the well: the canvas's own marks, from the filtered reading

type Size = 'small' | 'whole' | 'pane'
const FONT: Record<Size, number> = {small: 7.5, whole: 8, pane: 13}
const CHARS: Record<Size, number> = {small: 13, whole: 17, pane: 44}

function Well({v, set, w, h, size, depth = true}: {v: V; set?: ViewProps['set']; w: number; h: number; size: Size; depth?: boolean}) {
  const result = useMemo(() => resultOf(v), [v])
  const zoom = num(v, 'zoom'), field = str(v, 'scope') === 'field'
  const places = centreOf(v), cx = w / 2, cy = h / 2, k = h / 2 / WORLD.y * zoom
  const at = (ref: string) => { const p = places.get(ref)!; return {x: cx + (p.x - WORLD.x) * k, y: cy + (p.y - WORLD.y) * k} }
  const shown = new Set(result.nodes.map(n => n.ref))
  // The selection owns the focus only while its note is on the graph; a filtered-out note leaves the matches at full strength.
  const picked = shown.has(selectedRef(v)) ? selectedRef(v) : ''
  const focus = new Set<string>(picked ? [picked] : [])
  for (const e of result.edges) { if (e.from_ref === picked) focus.add(e.to_ref); if (e.to_ref === picked) focus.add(e.from_ref) }
  for (const a of ASSOCIATIONS) if (shown.has(a.source) && shown.has(a.ghost)) { if (a.source === picked) focus.add(a.ghost); if (a.ghost === picked) focus.add(a.source) }
  const emphasis = emphasizeGraph(result.nodes, groupsOf(v))
  const grow = size === 'pane' ? 2.3 : 1
  const radius = (n: GraphNode) => clampTo(1.7 * grow, 4.6 * grow, (n.kind === 'wiki-space' ? 3.1 : 2.4) * grow * zoom)
  const dim = (ref: string) => result.contextual.has(ref) || (picked !== '' && !focus.has(ref))
  const ghosts = ASSOCIATIONS.filter(a => shown.has(a.source) && shown.has(a.ghost))
  const arrow = (a: {x: number; y: number}, b: {x: number; y: number}, r: number) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d < 12 * grow) return null
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, x = b.x - ux * (r + 1.5), y = b.y - uy * (r + 1.5), s = 3.6 * grow
    return `M${x} ${y}L${x - ux * s - uy * s * .6} ${y - uy * s + ux * s * .6}L${x - ux * s + uy * s * .6} ${y - uy * s - ux * s * .6}Z`
  }
  // Labels follow the canvas's rule: the selected note always; the rest by the label setting, the zoom and the room.
  const font = FONT[size], boxes: {x: number; y: number; w: number; h: number}[] = []
  const labels = result.nodes.filter(n => places.has(n.ref)).sort((a, b) => Number(b.ref === picked) - Number(a.ref === picked) || places.get(a.ref)!.hop - places.get(b.ref)!.hop).flatMap(n => {
    const active = n.ref === picked, lab = str(v, 'labels')
    if (!(active || (lab !== 'focus' && !dim(n.ref) && (lab === 'all' || (n.kind === 'wiki-space' && zoom > .3) || zoom > 1.1)))) return []
    const text = graphNodeCaption(n), cut = text.length > CHARS[size] ? `${text.slice(0, CHARS[size] - 1)}…` : text
    const p = at(n.ref), bw = cut.length * font * .53, box = {x: p.x - bw / 2, y: p.y + radius(n) + 1.5, w: bw, h: font * 1.3}
    if (box.x < 1 || box.x + box.w > w - 1 || box.y + box.h > h - 1) return []
    if (!active && boxes.some(b => b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y)) return []
    boxes.push(box)
    return [{ref: n.ref, text: cut, x: p.x, y: box.y + font, active}]
  })
  const top = Math.max(...[...places.values()].map(p => p.hop)), depthNow = num(v, 'depth')
  const rings = size === 'small' ? (field ? [] : [depthNow]) : Array.from({length: top}, (_, i) => i + 1)
  const dr = Math.max(depthNow, .3) * HOPS * k, reachMax = Math.min(w, h) / 2 - 7
  const handleAt = {x: cx + Math.min(dr, reachMax) * Math.cos(-Math.PI / 4), y: cy + Math.min(dr, reachMax) * Math.sin(-Math.PI / 4)}
  const railFrom = 16, railTo = w - 16, railY = h - 8
  const zoomX = railFrom + (railTo - railFrom) * toUnit(ZOOM, zoom)
  const mini = size !== 'small' && on(v, 'minimap')
  const mw = size === 'pane' ? 110 : 40, mh = size === 'pane' ? 78 : 30, mx = w - mw - 5, my = h - mh - (size === 'pane' ? 8 : 19)
  const span = (top + 1) * HOPS, mk = Math.min(mw, mh) / 2 / span

  return <g>
    {rings.map(r => r * HOPS * k < Math.hypot(w, h) / 2 && <g key={r}>
      <circle cx={cx} cy={cy} r={r * HOPS * k} className="dp-faint" strokeDasharray={size === 'small' ? '2 3' : undefined} opacity={r <= depthNow || field ? .8 : .4} />
      {size !== 'small' && <text x={cx + 3} y={cy - r * HOPS * k + 8} className="dp-axis">{r === 1 ? '1 hop' : `${r}`}</text>}
    </g>)}
    {result.edges.map((e, i) => {
      const a = at(e.from_ref), b = at(e.to_ref), strong = picked !== '' && focus.has(e.from_ref) && focus.has(e.to_ref)
      return <g key={i}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--text-dim)" strokeWidth={strong ? 1.1 : .7} opacity={picked === '' || strong ? .6 : .2} />
        {on(v, 'arrows') && arrow(a, b, radius(byRef.get(e.to_ref)!)) && <path d={arrow(a, b, radius(byRef.get(e.to_ref)!))!} fill="var(--text-dim)" opacity={.75} />}
      </g>
    })}
    {ghosts.map(a => { const p = at(a.source), q = at(a.ghost); return <line key={`${a.source}>${a.ghost}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--text-dim)" strokeWidth={.8} strokeDasharray="2.5 2.5" opacity={focus.has(a.source) && focus.has(a.ghost) ? .7 : .25} />})}
    {result.nodes.filter(n => places.has(n.ref)).map(n => {
      const p = at(n.ref), r = radius(n), ghost = isUnresolvedGraphNode(n), chosen = n.ref === picked, group = emphasis.get(n.ref)
      const held = ghost ? Object.keys((n as unknown as {unresolved: {sources: Record<string, number>}}).unresolved.sources).length : 0
      return <g key={n.ref} opacity={dim(n.ref) ? .42 : 1} style={set && !ghost ? {cursor: 'pointer'} : undefined}
        data-i={`${graphNodeCaption(n)}|${ghost ? `${held} sources hold this link. None opens.` : `${n.kind}. ${set ? 'Click to select it.' : ''}`}`}
        onClick={set && !ghost ? () => set('selected', n.ref) : undefined}>
        <circle cx={p.x} cy={p.y} r={Math.max(r + 3, 8)} fill="transparent" />
        {chosen && <circle cx={p.x} cy={p.y} r={r + 2.6} fill="var(--dp-well)" stroke="var(--dp-on)" strokeWidth={1} />}
        {ghost ? <circle cx={p.x} cy={p.y} r={r} fill="none" stroke={chosen ? 'var(--dp-on)' : 'var(--text-dim)'} strokeWidth={1} strokeDasharray="2 1.6" />
          : <circle cx={p.x} cy={p.y} r={r} fill={chosen ? 'var(--dp-on)' : group?.color ?? 'var(--text)'} />}
      </g>
    })}
    {labels.map(l => <text key={l.ref} x={l.x} y={l.y} textAnchor="middle" className="dp-axis" style={{fontSize: font, fill: l.active ? 'var(--text)' : 'var(--text-dim)', stroke: 'var(--dp-well)', strokeWidth: 2.4, paintOrder: 'stroke'}}>{l.text}</text>)}
    {result.localFocusMissing && <text x={cx} y={cy} textAnchor="middle" className="dp-axis" style={{fontSize: font + 1}}>Select a note to read its graph.</text>}
    {mini && <g opacity={.9}>
      <rect x={mx} y={my} width={mw} height={mh} fill="var(--dp-well)" stroke="var(--line)" />
      {READING.nodes.map(n => { const p = places.get(n.ref); return p && <circle key={n.ref} cx={mx + mw / 2 + (p.x - WORLD.x) * mk} cy={my + mh / 2 + (p.y - WORLD.y) * mk} r={.9} fill="var(--text-dim)" opacity={shown.has(n.ref) ? 1 : .35} />})}
      <rect x={mx + mw / 2 - clampTo(2, mw / 2, w / 2 / k * mk)} y={my + mh / 2 - clampTo(2, mh / 2, h / 2 / k * mk)} width={2 * clampTo(2, mw / 2, w / 2 / k * mk)} height={2 * clampTo(2, mh / 2, h / 2 / k * mk)}
        fill="none" stroke="var(--dp-on)" strokeWidth={.8} />
    </g>}
    {set && size !== 'pane' && <>
      {size === 'whole' && <g>
        <line x1={railFrom} y1={railY} x2={railTo} y2={railY} className="dp-faint" />
        <text x={railFrom} y={railY - 4} className="dp-axis">zoom</text>
        <Handle x={zoomX} y={railY} n={field || !depth ? 1 : 2} shape="square" label="Zoom" does="Drag along the rail: the graph's zoom. Double-click for 100 %."
          onDrag={x => set('zoom', fromUnit(ZOOM, (x - railFrom) / (railTo - railFrom)))} onReset={() => set('zoom', 1)} />
      </g>}
      {!field && depth && <Handle x={handleAt.x} y={handleAt.y} n={1} shape="ring" label="Depth" does="Drag out or in: how many hops from the selected note the graph reaches. Double-click for one hop."
        onDrag={(x, y) => set('depth', clampTo(0, 8, Math.round(Math.hypot(x - cx, y - cy) / (HOPS * k))))} onReset={() => set('depth', 1)} />}
      {size === 'small' && field && <g>
        <line x1={railFrom} y1={railY} x2={railTo} y2={railY} className="dp-faint" />
        <Handle x={zoomX} y={railY} n={1} shape="square" label="Zoom" does="Drag along the rail: the graph's zoom. Double-click for 100 %."
          onDrag={x => set('zoom', fromUnit(ZOOM, (x - railFrom) / (railTo - railFrom)))} onReset={() => set('zoom', 1)} />
      </g>}
    </>}
  </g>
}

const shownOf = (v: V) => { const c = resultOf(v).counts; return `${c.displayed} of ${c.admitted}` }

function GraphDisplay({p, w, h, size}: {p: ViewProps; w: number; h: number; size: Size}) {
  return <Display w={w} h={h} label="The graph" does="Each note is a node and each link a line. A dashed hollow node is a link with no target. Drag the ring to set the depth."
    corner={shownOf(p.v)}>
    <Well v={p.v} set={p.set} w={w} h={h} size={size} />
  </Display>
}

// ---------------------------------------------------------------- controls

const scopeLocal = (v: V) => str(v, 'scope') === 'local'
const reasonDepth = (v: V) => (scopeLocal(v) ? undefined : 'Depth applies to the selected note. Set Scope to Note.')

const ScopeRadio = ({p}: {p: ViewProps}) => <Radio label="Scope" does="Choose the notes the graph reads." value={str(p.v, 'scope')} options={SCOPES} stack onChange={x => p.set('scope', x)} />
const DepthDial = ({p}: {p: ViewProps}) => <Dial label="Depth" does="How many hops from the selected note the graph reaches." value={num(p.v, 'depth')} def={1} scale={DEPTH} format={hops}
  disabled={reasonDepth(p.v)} onChange={x => p.set('depth', x)} />
const GhostToggle = ({p}: {p: ViewProps}) => <Toggle label="Ghosts" does="Show the links that have no target, as dashed hollow nodes." on={on(p.v, 'ghosts')} onChange={x => p.set('ghosts', x)} />
const LabelRadio = ({p}: {p: ViewProps}) => <Radio label="Labels" does="Choose which labels the graph draws." value={str(p.v, 'labels')} options={LABELS} stack onChange={x => p.set('labels', x)} />

/** The groups of the filter: each member of the owner's set is a request; the light says the filtered graph holds a node of it. */
function setRows(p: ViewProps, key: 'kinds' | 'relations', names: readonly string[], inGraph: (name: string) => number): RowItem[] {
  const chosen = list(p.v, key)
  return names.map(name => ({id: name, name, request: chosen.includes(name), light: inGraph(name) > 0 ? 'lit' : 'dark', tone: 'value', note: `${inGraph(name)}`}))
}
const toggleIn = (p: ViewProps, key: 'kinds' | 'relations') => (id: string, request: boolean) => {
  const chosen = list(p.v, key)
  p.set(key, (request ? [...chosen, id] : chosen.filter(x => x !== id)).join('|'))
}
const kindRows = (p: ViewProps) => { const r = resultOf(p.v); return setRows(p, 'kinds', KINDS, name => r.nodes.filter(n => n.kind === name).length) }
const relationRows = (p: ViewProps) => { const r = resultOf(p.v); return setRows(p, 'relations', RELATIONS, name => r.edges.filter(e => e.relation === name).length) }
const groupRows = (p: ViewProps): RowItem[] => {
  const r = resultOf(p.v), matched = emphasizeGraph(r.nodes, groupsOf(p.v).map(g => ({...g, enabled: true})).filter(g => g.enabled))
  return GROUPS.map(g => {
    const enabled = p.v[`g:${g.id}`] !== false, n = r.nodes.filter(x => matched.get(x.ref)?.label === g.label).length
    return {id: g.id, name: g.label, request: enabled, light: enabled ? 'lit' : 'dark', tone: 'value', note: `${n}`,
      mark: <span aria-hidden style={{flex: 'none', width: 8, height: 8, borderRadius: '50%', background: g.color, opacity: enabled ? 1 : .35}} />}
  })
}

/** The note's own relations, as the reader lists them: backlinks and relations out, then the links that have no target. */
const linkRows = (v: V): RowItem[] => {
  const ref = selectedRef(v), name = (r: string) => byRef.get(r)?.label ?? r
  return [
    ...READING.edges.filter(e => e.to_ref === ref).map((e, i): RowItem => ({id: `in${i}`, name: name(e.from_ref), light: 'lit', tone: 'value', note: `← ${e.relation}`})),
    ...READING.edges.filter(e => e.from_ref === ref).map((e, i): RowItem => ({id: `out${i}`, name: name(e.to_ref), light: 'lit', tone: 'value', note: `→ ${e.relation}`})),
    ...ASSOCIATIONS.filter(a => a.source === ref).map((a): RowItem => ({id: a.ghost, name: name(a.ghost), light: 'dark', note: 'no target'})),
  ]
}

function FindBox({p}: {p: ViewProps}) {
  return <div className="dp-cell" style={{gridColumn: '1 / -1', width: '100%'}} data-i="Find|Keep the notes whose name, alias or reference holds this text. Clear it to keep all.">
    <input className="kg-find" type="search" aria-label="Find in this reading" placeholder="Name, alias or reference" maxLength={1024} value={str(p.v, 'text')} onChange={e => p.set('text', e.target.value)} />
  </div>
}

const clearFilters = (p: ViewProps) => () => { for (const [key, value] of Object.entries({text: '', scope: 'field', depth: 1, direction: 'both', kinds: '', relations: '', orphans: true, ghosts: true, mode: 'structure'})) p.set(key, value) }

const CHIPS = (v: V) => {
  const f = filtersOf(v), chips: string[] = []
  if (f.shared) chips.push('Shared Field')
  if (!f.unresolved) chips.push('Ghosts hidden')
  if (f.text) chips.push(`“${f.text}”`)
  if (f.scope === 'local') chips.push(`Selected · ${hops(f.depth)}`)
  if (f.direction !== 'both') chips.push(f.direction === 'outgoing' ? 'Outgoing' : 'Incoming')
  chips.push(...f.kinds, ...f.relations)
  if (!f.isolated) chips.push('Connected only')
  if (f.context === 'matches') chips.push('Matches only')
  return chips
}

const light = (v: V) => str(v, 'light') as 'lit' | 'dark' | 'unknown'

export const design: DesignedDevice = {
  id: 'knowledge-graph:graph',
  title: 'Knowledge graph',
  kind: 'instrument',
  defaults: {
    light: 'lit', selected: IDENTITY, scope: 'local', depth: 2, direction: 'both', shared: false, budget: 4096, text: '', kinds: '', relations: '',
    ghosts: true, orphans: true, mode: 'structure', labels: 'automatic', arrows: false, minimap: true, zoom: 1,
  },
  fixtures: {
    'Two hops from User identity': {},
    'Find, structure kept': {scope: 'field', text: 'actuation'},
    'Find, matches only': {scope: 'field', text: 'actuation', mode: 'matches'},
  },
  firstPage: 'reach',

  folded: p => <Folded title="Knowledge graph" light={light(p.v)} readings={[scopeLocal(p.v) ? hops(num(p.v, 'depth')) : 'field', `${resultOf(p.v).counts.displayed}`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Knowledge graph" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><GraphDisplay p={p} w={140} h={146} size="small" /></Section>
    <Section label="Macros" cols={2}>
      <ScopeRadio p={p} />
      <DepthDial p={p} />
      <GhostToggle p={p} />
      <LabelRadio p={p} />
    </Section>
  </Panel>,

  whole: p => <KnowledgeWhole p={p} />,

  full: p => <KnowledgePane p={p} />,

  widget: p => {
    const c = resultOf(p.v).counts, ghosts = resultOf(p.v).nodes.filter(isUnresolvedGraphNode).length
    return <Tile title="Graph" light={light(p.v)} onFull={p.nav.full}>
      <Display w={64} h={64} label="The graph" does="The neighbourhood of the note you hold."><Well v={p.v} w={64} h={64} size="small" /></Display>
      <div className="ref-tile-side">
        <Readout label="shown" does="Nodes the graph shows, of all it reads." value={c.displayed} tone="value" />
        <Readout label={scopeLocal(p.v) ? 'depth' : 'field'} does="How far the graph reaches from the selected note." value={scopeLocal(p.v) ? hops(num(p.v, 'depth')) : 'all'} />
        <Readout label="ghosts" does="Links that have no target." value={ghosts} tone="accent" />
      </div>
    </Tile>
  },
}

// ---------------------------------------------------------------- the whole view: three pages, one for each face of the graph

function KnowledgeWhole({p}: {p: ViewProps}) {
  const [group, setGroup] = useState(0)
  const r = resultOf(p.v), c = r.counts, bounded = c.admitted > num(p.v, 'budget')
  return <Panel title="Knowledge graph" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'reach', label: 'Reach'}, {id: 'filters', label: 'Filters'}, {id: 'display', label: 'Display'}]} page={p.page} onPage={p.setPage}>
    <Band>
      <Section width={206}><GraphDisplay p={p} w={194} h={146} size="whole" /></Section>
      {p.page === 'filters' ? <>
        <Section label="Find" cols={2} grow>
          <FindBox p={p} />
          <Toggle label="Ghosts" does="Show the links that have no target, as dashed hollow nodes." on={on(p.v, 'ghosts')} onChange={x => p.set('ghosts', x)} />
          <Toggle label="Orphans" does="Keep the notes that have no relations. Off keeps only connected notes." on={on(p.v, 'orphans')} onChange={x => p.set('orphans', x)} />
          <Radio label="Filter mode" does="Dim the rest of the graph, or hide it." value={str(p.v, 'mode')} options={MODES} stack onChange={x => p.set('mode', x)} />
        </Section>
      </> : p.page === 'display' ? <>
        <Section label="Marks" cols={2} grow>
          <LabelRadio p={p} />
          <Dial label="Zoom" does="The graph's zoom. At 100 % the whole ring set fits." value={num(p.v, 'zoom')} def={1} scale={ZOOM} format={pctx} onChange={x => p.set('zoom', x)} />
          <Toggle label="Arrows" does="Show the direction of each line." on={on(p.v, 'arrows')} onChange={x => p.set('arrows', x)} />
          <Toggle label="Minimap" does="Show the overview in the corner." on={on(p.v, 'minimap')} onChange={x => p.set('minimap', x)} />
        </Section>
      </> : <>
        <Section label="Scope" cols={2} grow>
          <ScopeRadio p={p} />
          <DepthDial p={p} />
          <Radio label="Direction" does="Choose which way the graph follows a relation." value={str(p.v, 'direction')} options={DIRECTIONS} stack onChange={x => p.set('direction', x)} />
          <Toggle label="Shared" does="Add my available Shared Field to the reading." on={on(p.v, 'shared')} onChange={x => p.set('shared', x)} />
        </Section>
      </>}
    </Band>
    <Band>
      {p.page === 'filters' ? <>
        <Section width={132}><Rows label="Kinds" does="The kinds of note. The square is your request; a light means the graph holds one." items={kindRows(p)} onRequest={toggleIn(p, 'kinds')} size={6} /></Section>
        <Section width={132}><Rows label="Relations" does="The kinds of relation. The square is your request; a light means the graph holds one." items={relationRows(p)} onRequest={toggleIn(p, 'relations')} size={6} /></Section>
        <Section label="Result" cols={2} grow>
          <Readout big label="matches" does="Notes that match every filter." value={c.matched} tone="value" />
          <Readout label="context" does="Notes kept only to show the structure round a match." value={c.context} />
          <Action label="Clear" does="Remove every filter. The camera and the selection stay." onPress={clearFilters(p)} />
        </Section>
      </> : p.page === 'display' ? <>
        <Section width={168}><Rows label="Groups" does="Groups that you coloured. A group changes how nodes look, not what they are." items={groupRows(p)}
          onRequest={(id, x) => p.set(`g:${id}`, x)} size={6} page={group} onPage={setGroup} /></Section>
        <Section label="Camera" cols={2} grow>
          <Action label="Fit" does="Set the zoom so that every shown node fits. The selection stays." onPress={() => p.set('zoom', fitZoom(p.v))} />
          <Readout label="zoom" does="The graph's zoom." value={pctx(num(p.v, 'zoom'))} tone="value" />
        </Section>
      </> : <>
        <Section label="Budget" width={62}>
          <Dial label="Budget" does="The most nodes the reading holds. The graph says when it hides more." value={num(p.v, 'budget')} def={4096} scale={BUDGET} format={count} onChange={x => p.set('budget', x)} />
        </Section>
        <Section label="Reading" cols={2} width={118}>
          <Readout big label="shown" does="Nodes the graph shows, of all the reading holds." value={`${c.displayed}/${c.admitted}`} tone="value" />
          <Readout label="hidden" does="Nodes the scope and the filters keep out of view. They are not unrelated." value={c.hidden} />
          <Readout label="bounded" does="Yes when the reading holds more nodes than the budget." value={bounded ? 'yes' : 'no'} tone={bounded ? 'accent' : undefined} />
          <Readout label="ghosts" does="Links that have no target." value={r.nodes.filter(isUnresolvedGraphNode).length} tone="accent" />
        </Section>
        <Section grow><Rows label={`Links of ${byRef.get(selectedRef(p.v))?.label ?? 'no note'}`.slice(0, 26)} does="The relations of the selected note: backlinks, relations out, and links with no target." items={linkRows(p.v)} size={6} /></Section>
      </>}
    </Band>
  </Panel>
}

/** Fit: the zoom at which every shown node stands inside the well (the canvas's fit, within its zoom limits). */
function fitZoom(v: V): number {
  const places = centreOf(v), out = Math.max(1, ...resultOf(v).nodes.map(n => places.get(n.ref)?.hop ?? 0)) * HOPS
  return clampTo(ZOOM.min, ZOOM.max, (WORLD.y - 48) / out)
}

// ---------------------------------------------------------------- the pane: the graph, its chips, and the note beside it

function KnowledgePane({p}: {p: ViewProps}) {
  const result = resultOf(p.v), c = result.counts, chosen = byRef.get(selectedRef(p.v)), chips = CHIPS(p.v)
  const into = READING.edges.filter(e => e.to_ref === chosen?.ref), out = READING.edges.filter(e => e.from_ref === chosen?.ref)
  const held = ASSOCIATIONS.filter(a => a.source === chosen?.ref)
  const W = 760, H = 440
  return <div className="kg-pane">
    <div className="kg-field">
      <div className="kg-chips" aria-label="Applied filters">
        {chips.length ? chips.map(chip => <span key={chip} className="kg-chip" data-on="true">{chip}</span>) : <span className="kg-chip">No filter</span>}
        {!on(p.v, 'ghosts') && <span className="kg-chip">Links with no target are hidden</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="The Knowledge graph">
        <Well v={p.v} w={W} h={H} size="pane" />
      </svg>
      <div className="kg-summary" role="status">{c.matched} matches{c.context > 0 && ` + ${c.context} context`} · {c.displayed} of {c.admitted} notes
        {result.partialFormations.length > 0 && ` · ${result.partialFormations.length} constellation in part`}</div>
    </div>
    <aside className="kg-reader" aria-label="Selected note">
      {chosen ? <>
        <h3>{chosen.label}<small>{chosen.kind} · {chosen.ref}</small></h3>
        <div><h4>Backlinks</h4>{into.length ? <ul>{into.map((e, i) => <li key={i}><span>{byRef.get(e.from_ref)?.label}</span><i>{e.relation}</i></li>)}</ul> : <p>No note links here.</p>}</div>
        <div><h4>Relations out</h4>{out.length || held.length ? <ul>
          {out.map((e, i) => <li key={i}><span>{byRef.get(e.to_ref)?.label}</span><i>{e.relation}</i></li>)}
          {held.map(a => <li key={a.ghost} data-ghost="true"><span>{byRef.get(a.ghost)?.label}</span><i>no target</i></li>)}
        </ul> : <p>This note links nowhere.</p>}</div>
      </> : <p>Select a note. Its text, backlinks and relations open here.</p>}
    </aside>
  </div>
}

