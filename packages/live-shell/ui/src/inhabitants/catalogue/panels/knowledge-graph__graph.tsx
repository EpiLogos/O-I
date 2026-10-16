// Knowledge graph (manual §17.2): the wiki read link by link. Live's nearest: Auto Filter — a well that draws what the device
// does, handles on the well, and a few stepped switches round it. The well is the graph's own law, run on a reading of the
// root wiki: the cradle's filterGraph keeps, dims or drops each note by the scope, depth, direction, kinds, relations, find
// text, ghosts and filter mode, and the canvas's own rules draw it (ghosts dashed and hollow, arrows on the lines, labels by
// the label rule at the zoom). Notes sit on rings by their distance in hops from the note you hold, so the depth is a radius.
//
// The material is values. `reading` is the graph reading (the shape filterGraph takes: nodes, edges, formations) as one JSON
// string, and `groups` is the coloured emphasis groups as one JSON string. A view reads them with json(); a reading the owner
// has not reported is named in the well, never drawn from a sample. The sample content lives in `defaults` alone.
import {useState} from 'react'
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, toUnit, fromUnit, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type Value, type ViewProps} from './design'
import {defaultGraphFilters, filterGraph, type FilteredGraph, type GraphFilters} from '../../../../../../../desktop/cradle/src/knowledge/filters'
import {graphNodeCaption, isUnresolvedGraphNode, projectUnresolvedGraph, unresolvedGraphAssociations} from '../../../../../../../desktop/cradle/src/knowledge/graphNavigation'
import {emphasizeGraph, type EmphasisGroup} from '../../../../../../../desktop/cradle/src/knowledge/graphEmphasis'
import {GRAPH_ZOOM_LIMITS} from '../../../../../../../desktop/cradle/src/knowledge/camera'
import type {GraphEdge, GraphFormation, GraphNode, GraphReading} from '../../../../../../../desktop/cradle/src/knowledge/graph'
import './knowledge-graph__graph.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- the reading, read from the value `reading`

interface Place {x: number; y: number; hop: number}
type Association = ReturnType<typeof unresolvedGraphAssociations>[number]

/** A reading the owner reported, with what is derived from it once: how the notes link, their kinds and relations, the links that
 * have no target, and the layouts and filtered results already worked out for it. */
interface Model {
  readonly reading: GraphReading
  readonly byRef: ReadonlyMap<string, GraphNode>
  readonly kinds: readonly string[]
  readonly relations: readonly string[]
  readonly associations: readonly Association[]
  readonly neighbours: ReadonlyMap<string, ReadonlySet<string>>
  readonly layouts: Map<string, Map<string, Place>>
  readonly results: Map<string, FilteredGraph>
}

const isText = (x: unknown): x is string => typeof x === 'string'
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const texts = (x: unknown): string[] | undefined => (Array.isArray(x) ? x.filter(isText) : undefined)
const finite = (x: number | undefined) => (x !== undefined && Number.isFinite(x) ? x : undefined)

/** A node the filter can read: it has a ref, a kind and a label. A ghost keeps only what the canvas reads of it. Anything else drops. */
function cleanNode(x: unknown): GraphNode | undefined {
  if (!isRecord(x) || !isText(x.ref) || !isText(x.kind) || !isText(x.label)) return undefined
  const node = {...x, aliases: texts(x.aliases), tags: texts(x.tags)}
  if (x.kind === 'unresolved-link' && x.native_owner === 'graph-presentation' && 'unresolved' in x) {
    if (!isRecord(x.unresolved) || !isRecord(x.unresolved.sources)) return undefined
    const sources = Object.fromEntries(Object.entries(x.unresolved.sources).filter(([, n]) => typeof n === 'number'))
    return {...node, unresolved: {key: isText(x.unresolved.key) ? x.unresolved.key : x.label, sources}} as unknown as GraphNode
  }
  return node as unknown as GraphNode
}
const cleanEdge = (x: unknown): GraphEdge[] => (isRecord(x) && isText(x.from_ref) && isText(x.to_ref) && isText(x.relation) ? [x as unknown as GraphEdge] : [])
const cleanFormation = (x: unknown): GraphFormation[] =>
  isRecord(x) && isText(x.ref) && Array.isArray(x.members) ? [{...x, members: x.members.filter(m => isRecord(m) && isText(m.ref))} as unknown as GraphFormation] : []

/** The reading in the shape filterGraph takes, or undefined when what was reported is not a reading. A raw reading's unresolved links
 * are projected to ghost nodes as the cradle does; one that already carries its ghosts is left as it is. */
function cleanReading(raw: unknown): GraphReading | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return undefined
  const seen = new Set<string>(), nodes: GraphNode[] = []
  for (const x of raw.nodes) { const n = cleanNode(x); if (n && !seen.has(n.ref)) { seen.add(n.ref); nodes.push(n) } }
  const links = Array.isArray(raw.unresolved_links) ? raw.unresolved_links.filter(l => isRecord(l) && isText(l.key) && isRecord(l.sources)) : []
  const reading = {...raw, nodes, edges: raw.edges.flatMap(cleanEdge), formations: Array.isArray(raw.formations) ? raw.formations.flatMap(cleanFormation) : [], unresolved_links: links} as unknown as GraphReading
  return links.length && !nodes.some(isUnresolvedGraphNode) ? projectUnresolvedGraph(reading) : reading
}

function buildModel(reading: GraphReading): Model {
  const byRef = new Map(reading.nodes.map(n => [n.ref, n] as const))
  const neighbours = new Map<string, Set<string>>()
  const link = (a: string, b: string) => { for (const [x, y] of [[a, b], [b, a]] as const) { const row = neighbours.get(x) ?? new Set<string>(); row.add(y); neighbours.set(x, row) } }
  for (const e of reading.edges) if (byRef.has(e.from_ref) && byRef.has(e.to_ref)) link(e.from_ref, e.to_ref)
  const associations = unresolvedGraphAssociations(reading.nodes)
  for (const a of associations) link(a.source, a.ghost)
  return {reading, byRef, kinds: [...new Set(reading.nodes.map(n => n.kind))], relations: [...new Set(reading.edges.map(e => e.relation))], associations, neighbours,
    layouts: new Map(), results: new Map()}
}

/** Parsed readings by their JSON text, so a reading is read once however many views draw it. */
const MODELS = new Map<string, Model | null>()
function modelOf(v: V): Model | undefined {
  const text = strOf(v, 'reading')
  if (text === undefined) return undefined
  if (!MODELS.has(text)) {
    const reading = cleanReading(json<unknown>(v, 'reading', null))
    MODELS.set(text, reading ? buildModel(reading) : null)
    if (MODELS.size > 6) MODELS.delete(MODELS.keys().next().value!)
  }
  return MODELS.get(text) ?? undefined
}

// ---------------------------------------------------------------- the values, and the filter state they stand for

const SCOPES = [{value: 'field', label: 'Field', does: 'Read every note in the available field.'}, {value: 'local', label: 'Note', does: 'Read only the neighbourhood of the selected note.'}] as const
const DIRECTIONS = [{value: 'both', label: 'Both', does: 'Follow relations in both directions.'}, {value: 'outgoing', label: 'Out', does: 'Follow only the relations that leave the note.'},
  {value: 'incoming', label: 'In', does: 'Follow only the relations that arrive at the note: its backlinks.'}] as const
const MODES = [{value: 'structure', label: 'Context', does: 'Keep the disclosed structure round a match and dim it.'}, {value: 'matches', label: 'Matches', does: 'Hide all but the matches. The graph says it shows part of the whole.'}] as const
const LABELS = [{value: 'automatic', label: 'Auto', does: 'Show labels as you zoom in.'}, {value: 'all', label: 'All', does: 'Show every label that fits.'}, {value: 'focus', label: 'Focus', does: 'Show only the labels of the selected note.'}] as const
/** The keys that say how the graph is filtered. */
const FILTER_KEYS = ['text', 'scope', 'depth', 'direction', 'kinds', 'relations', 'orphans', 'ghosts', 'mode', 'shared'] as const

const list = (v: V, key: string): string[] => { const s = strOf(v, key); return s ? s.split('|') : [] }
const selectedOf = (v: V) => strOf(v, 'selected')

/** The filter the reported keys stand for. A key the owner has not reported filters nothing: the cradle's own starting filter fills
 * it, and the control for it draws "—". */
function filtersOf(v: V): GraphFilters {
  const f = defaultGraphFilters(), scope = strOf(v, 'scope'), direction = strOf(v, 'direction'), mode = strOf(v, 'mode'), labels = strOf(v, 'labels')
  return {...f, text: strOf(v, 'text') ?? f.text, depth: finite(numOf(v, 'depth')) ?? f.depth,
    scope: scope === 'local' || scope === 'field' ? scope : f.scope,
    direction: direction === 'both' || direction === 'outgoing' || direction === 'incoming' ? direction : f.direction,
    kinds: list(v, 'kinds'), relations: list(v, 'relations'), isolated: boolOf(v, 'orphans') ?? f.isolated, unresolved: boolOf(v, 'ghosts') ?? f.unresolved,
    context: mode === 'matches' || mode === 'structure' ? mode : f.context, labels: labels === 'all' || labels === 'focus' || labels === 'automatic' ? labels : f.labels,
    arrows: boolOf(v, 'arrows') ?? f.arrows, shared: boolOf(v, 'shared') ?? f.shared}
}

interface Reading {readonly model: Model; readonly result: FilteredGraph}
/** The reading and what the filters keep of it, or undefined when there is no reading. */
function readingOf(v: V): Reading | undefined {
  const model = modelOf(v)
  if (!model) return undefined
  const f = filtersOf(v), focus = selectedOf(v) || undefined
  const key = JSON.stringify([f.text, f.scope, f.depth, f.direction, f.kinds, f.relations, f.isolated, f.unresolved, f.context, focus])
  let result = model.results.get(key)
  if (!result) {
    result = filterGraph(model.reading, f, focus)
    model.results.set(key, result)
    if (model.results.size > 12) model.results.delete(model.results.keys().next().value!)
  }
  return {model, result}
}

/** The groups that the person coloured (the canvas's emphasis groups: a name, a colour, and what they match), from the value
 * `groups`. A group is on unless its own key `g:<id>` or its `enabled` says off, as the cradle reads it. Undefined when not reported. */
const COLOUR = /^(#[0-9a-f]{3,8}|var\(--[\w-]+\))$/i
function groupsOf(v: V): EmphasisGroup[] | undefined {
  const raw = json<unknown>(v, 'groups', undefined)
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  return raw.flatMap((x): EmphasisGroup[] => {
    if (!isRecord(x) || !isText(x.id) || !isText(x.label) || !isText(x.color) || !COLOUR.test(x.color) || seen.has(x.id)) return []
    seen.add(x.id)
    return [{id: x.id, label: x.label, color: x.color, text: isText(x.text) ? x.text : '', kinds: texts(x.kinds) ?? [], tags: texts(x.tags) ?? [],
      enabled: boolOf(v, `g:${x.id}`) ?? x.enabled !== false}]
  })
}

const HOPS = 80, WORLD = {x: 400, y: 260}
const ZOOM = {min: GRAPH_ZOOM_LIMITS.minZoom, max: GRAPH_ZOOM_LIMITS.maxZoom, log: true}
const DEPTH = {min: 0, max: 8, step: 1}
const BUDGET = {min: 1, max: 20000, log: true}
const pctx = (x: number) => `${Math.round(x * 100)} %`
const hops = (x: number) => `${x} ${x === 1 ? 'hop' : 'hops'}`
const count = (x: number) => (x >= 10000 ? `${Math.round(x / 1000)}k` : `${Math.round(x)}`)
const NO_NOTES = 'No reading of the notes.'

// ---------------------------------------------------------------- the layout: notes on rings by hops from the note you hold

function layoutFrom(m: Model, start: string): Map<string, Place> {
  const known = m.layouts.get(start)
  if (known) return known
  const hop = new Map<string, number>([[start, 0]]), queue = [start]
  for (let i = 0; i < queue.length; i++) for (const b of m.neighbours.get(queue[i]!) ?? []) if (!hop.has(b)) { hop.set(b, hop.get(queue[i]!)! + 1); queue.push(b) }
  let reach = 0
  for (const h of hop.values()) reach = Math.max(reach, h)
  for (const n of m.reading.nodes) if (!hop.has(n.ref)) hop.set(n.ref, reach + 1)
  let top = 0
  for (const h of hop.values()) top = Math.max(top, h)
  const angle = new Map<string, number>(), places = new Map<string, Place>()
  const parents = (ref: string, h: number) => [...(m.neighbours.get(ref) ?? [])].filter(r => hop.get(r) === h - 1 && angle.has(r))
  const mean = (ref: string, h: number) => { const a = parents(ref, h); return a.length ? Math.atan2(a.reduce((s, r) => s + Math.sin(angle.get(r)!), 0), a.reduce((s, r) => s + Math.cos(angle.get(r)!), 0)) : -Math.PI / 2 }
  for (let h = 0; h <= top; h++) {
    const ring = m.reading.nodes.filter(n => hop.get(n.ref) === h).sort((a, b) => mean(a.ref, h) - mean(b.ref, h)), n = ring.length
    ring.forEach((item, i) => {
      const a = h === 0 ? 0 : h === 1 ? -2.6 + 2 * Math.PI * i / n : n <= 4 ? mean(item.ref, h) + (i - (n - 1) / 2) * .6 : -Math.PI / 2 + h * .35 + 2 * Math.PI * i / n
      angle.set(item.ref, a)
      places.set(item.ref, {x: WORLD.x + h * HOPS * Math.cos(a), y: WORLD.y + h * HOPS * Math.sin(a), hop: h})
    })
  }
  m.layouts.set(start, places)
  return places
}
/** Centred on the selected note; with none in the reading, on the reading's first note. */
function placesOf(m: Model, v: V): Map<string, Place> {
  const picked = selectedOf(v), start = picked && m.byRef.has(picked) ? picked : m.reading.nodes[0]?.ref
  return start === undefined ? new Map() : layoutFrom(m, start)
}

// ---------------------------------------------------------------- the well: the canvas's own marks, from the filtered reading

type Size = 'small' | 'whole' | 'pane'
const FONT: Record<Size, number> = {small: 7.5, whole: 8, pane: 13}
const CHARS: Record<Size, number> = {small: 13, whole: 17, pane: 44}

/** Words across the well where a reading is missing or a note must be chosen, wrapped to the well's width. */
function Say({w, h, size, text}: {w: number; h: number; size: Size; text: string}) {
  const font = FONT[size] + 1, per = Math.max(8, Math.floor((w - 8) / (font * .55))), lines: string[] = []
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1]
    if (last !== undefined && last.length + 1 + word.length <= per) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  const y0 = h / 2 - (lines.length - 1) * font * .65 + font * .35
  return <g>{lines.map((line, i) => <text key={i} x={w / 2} y={y0 + i * font * 1.3} textAnchor="middle" className="dp-axis" style={{fontSize: font}}>{line}</text>)}</g>
}

/** What a control's does-line says when the host stands it disabled. */
const why = (p: ViewProps, key: string, does: string) => [does, st(p, key).disabled].filter(Boolean).join(' ')

function Well({p, w, h, size, live}: {p: ViewProps; w: number; h: number; size: Size; live: boolean}) {
  const v = p.v, read = readingOf(v)
  if (!read) return <Say w={w} h={h} size={size} text={NO_NOTES} />
  const {model, result} = read
  if (!model.reading.nodes.length) return <Say w={w} h={h} size={size} text="The reading holds no notes." />
  const filters = filtersOf(v), places = placesOf(model, v), can = (key: string) => live && !st(p, key).disabled
  const zoomNow = finite(numOf(v, 'zoom')), depthNow = finite(numOf(v, 'depth')), zoom = zoomNow ?? 1, local = filters.scope === 'local'
  const cx = w / 2, cy = h / 2, k = h / 2 / WORLD.y * zoom
  const at = (ref: string) => { const q = places.get(ref) ?? {x: WORLD.x, y: WORLD.y, hop: 0}; return {x: cx + (q.x - WORLD.x) * k, y: cy + (q.y - WORLD.y) * k} }
  const onGraph = new Set(result.nodes.map(n => n.ref))
  // The selection owns the focus only while its note is on the graph; a filtered-out note leaves the matches at full strength.
  const selected = selectedOf(v) ?? '', picked = onGraph.has(selected) ? selected : ''
  const focus = new Set<string>(picked ? [picked] : [])
  for (const e of result.edges) { if (e.from_ref === picked) focus.add(e.to_ref); if (e.to_ref === picked) focus.add(e.from_ref) }
  for (const a of model.associations) if (onGraph.has(a.source) && onGraph.has(a.ghost)) { if (a.source === picked) focus.add(a.ghost); if (a.ghost === picked) focus.add(a.source) }
  const emphasis = emphasizeGraph(result.nodes, groupsOf(v) ?? [])
  const grow = size === 'pane' ? 2.3 : 1
  const radius = (n: GraphNode) => clampTo(1.7 * grow, 4.6 * grow, (n.kind === 'wiki-space' ? 3.1 : 2.4) * grow * zoom)
  const dim = (ref: string) => result.contextual.has(ref) || (picked !== '' && !focus.has(ref))
  const ghosts = model.associations.filter(a => onGraph.has(a.source) && onGraph.has(a.ghost))
  const arrow = (a: {x: number; y: number}, b: {x: number; y: number}, r: number) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d < 12 * grow) return null
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, x = b.x - ux * (r + 1.5), y = b.y - uy * (r + 1.5), s = 3.6 * grow
    return `M${x} ${y}L${x - ux * s - uy * s * .6} ${y - uy * s + ux * s * .6}L${x - ux * s + uy * s * .6} ${y - uy * s - ux * s * .6}Z`
  }
  // Labels follow the canvas's rule: the selected note always; the rest by the label setting, the zoom and the room.
  const font = FONT[size], boxes: {x: number; y: number; w: number; h: number}[] = []
  const labels = result.nodes.filter(n => places.has(n.ref)).sort((a, b) => Number(b.ref === picked) - Number(a.ref === picked) || (places.get(a.ref)?.hop ?? 0) - (places.get(b.ref)?.hop ?? 0)).flatMap(n => {
    const active = n.ref === picked, lab = filters.labels
    if (!(active || (lab !== 'focus' && !dim(n.ref) && (lab === 'all' || (n.kind === 'wiki-space' && zoom > .3) || zoom > 1.1)))) return []
    const text = graphNodeCaption(n), cut = text.length > CHARS[size] ? `${text.slice(0, CHARS[size] - 1)}…` : text
    const q = at(n.ref), bw = cut.length * font * .53, box = {x: q.x - bw / 2, y: q.y + radius(n) + 1.5, w: bw, h: font * 1.3}
    if (box.x < 1 || box.x + box.w > w - 1 || box.y + box.h > h - 1) return []
    if (!active && boxes.some(b => b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y)) return []
    boxes.push(box)
    return [{ref: n.ref, text: cut, x: q.x, y: box.y + font, active}]
  })
  let top = 0
  for (const q of places.values()) top = Math.max(top, q.hop)
  const depthShown = local && depthNow !== undefined
  const rings = size === 'small' ? (depthShown ? [depthNow] : []) : Array.from({length: top}, (_, i) => i + 1)
  const dr = Math.max(depthNow ?? 0, .3) * HOPS * k, reachMax = Math.min(w, h) / 2 - 7
  const handleAt = {x: cx + Math.min(dr, reachMax) * Math.cos(-Math.PI / 4), y: cy + Math.min(dr, reachMax) * Math.sin(-Math.PI / 4)}
  const railFrom = 16, railTo = w - 16, railY = h - 8
  const zoomX = railFrom + (railTo - railFrom) * toUnit(ZOOM, zoom)
  const zoomDrag = can('zoom') ? (x: number) => p.set('zoom', fromUnit(ZOOM, (x - railFrom) / (railTo - railFrom))) : undefined
  const zoomReset = can('zoom') ? () => p.set('zoom', 1) : undefined
  const zoomDoes = why(p, 'zoom', "Drag along the rail: the graph's zoom. Double-click for 100 %.")
  const mini = size !== 'small' && boolOf(v, 'minimap') === true
  const mw = size === 'pane' ? 110 : 40, mh = size === 'pane' ? 78 : 30, mx = w - mw - 5, my = h - mh - (size === 'pane' ? 8 : 19)
  const span = (top + 1) * HOPS, mk = Math.min(mw, mh) / 2 / span

  return <g>
    {rings.map(r => r * HOPS * k < Math.hypot(w, h) / 2 && <g key={r}>
      <circle cx={cx} cy={cy} r={r * HOPS * k} className="dp-faint" strokeDasharray={size === 'small' ? '2 3' : undefined} opacity={!depthShown || r <= depthNow ? .8 : .4} />
      {size !== 'small' && <text x={cx + 3} y={cy - r * HOPS * k + 8} className="dp-axis">{r === 1 ? '1 hop' : `${r}`}</text>}
    </g>)}
    {result.edges.map((e, i) => {
      const a = at(e.from_ref), b = at(e.to_ref), strong = picked !== '' && focus.has(e.from_ref) && focus.has(e.to_ref)
      const target = model.byRef.get(e.to_ref), head = filters.arrows && target ? arrow(a, b, radius(target)) : null
      return <g key={i}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--text-dim)" strokeWidth={strong ? 1.1 : .7} opacity={picked === '' || strong ? .6 : .2} />
        {head && <path d={head} fill="var(--text-dim)" opacity={.75} />}
      </g>
    })}
    {ghosts.map(a => { const q = at(a.source), r = at(a.ghost); return <line key={`${a.source}>${a.ghost}`} x1={q.x} y1={q.y} x2={r.x} y2={r.y} stroke="var(--text-dim)" strokeWidth={.8} strokeDasharray="2.5 2.5" opacity={focus.has(a.source) && focus.has(a.ghost) ? .7 : .25} />})}
    {result.nodes.filter(n => places.has(n.ref)).map(n => {
      const q = at(n.ref), r = radius(n), ghost = isUnresolvedGraphNode(n), chosen = n.ref === picked, group = emphasis.get(n.ref)
      const held = isUnresolvedGraphNode(n) ? Object.keys(n.unresolved.sources).length : 0, pick = can('selected') && !ghost
      return <g key={n.ref} opacity={dim(n.ref) ? .42 : 1} style={pick ? {cursor: 'pointer'} : undefined}
        data-i={`${graphNodeCaption(n)}|${ghost ? `${held} sources hold this link. None opens.` : `${n.kind}. ${pick ? 'Click to select it.' : ''}`}`}
        onClick={pick ? () => p.set('selected', n.ref) : undefined}>
        <circle cx={q.x} cy={q.y} r={Math.max(r + 3, 8)} fill="transparent" />
        {chosen && <circle cx={q.x} cy={q.y} r={r + 2.6} fill="var(--dp-well)" stroke="var(--dp-on)" strokeWidth={1} />}
        {ghost ? <circle cx={q.x} cy={q.y} r={r} fill="none" stroke={chosen ? 'var(--dp-on)' : 'var(--text-dim)'} strokeWidth={1} strokeDasharray="2 1.6" />
          : <circle cx={q.x} cy={q.y} r={r} fill={chosen ? 'var(--dp-on)' : group?.color ?? 'var(--text)'} />}
      </g>
    })}
    {labels.map(l => <text key={l.ref} x={l.x} y={l.y} textAnchor="middle" className="dp-axis" style={{fontSize: font, fill: l.active ? 'var(--text)' : 'var(--text-dim)', stroke: 'var(--dp-well)', strokeWidth: 2.4, paintOrder: 'stroke'}}>{l.text}</text>)}
    {result.localFocusMissing && <Say w={w} h={h} size={size} text={selectedOf(v) === undefined ? 'No reading of the selected note.' : 'Select a note to read its graph.'} />}
    {mini && <g opacity={.9}>
      <rect x={mx} y={my} width={mw} height={mh} fill="var(--dp-well)" stroke="var(--line)" />
      {model.reading.nodes.map(n => { const q = places.get(n.ref); return q && <circle key={n.ref} cx={mx + mw / 2 + (q.x - WORLD.x) * mk} cy={my + mh / 2 + (q.y - WORLD.y) * mk} r={.9} fill="var(--text-dim)" opacity={onGraph.has(n.ref) ? 1 : .35} />})}
      <rect x={mx + mw / 2 - clampTo(2, mw / 2, w / 2 / k * mk)} y={my + mh / 2 - clampTo(2, mh / 2, h / 2 / k * mk)} width={2 * clampTo(2, mw / 2, w / 2 / k * mk)} height={2 * clampTo(2, mh / 2, h / 2 / k * mk)}
        fill="none" stroke="var(--dp-on)" strokeWidth={.8} />
    </g>}
    {live && size !== 'pane' && <>
      {size === 'whole' && <g>
        <line x1={railFrom} y1={railY} x2={railTo} y2={railY} className="dp-faint" />
        <text x={railFrom} y={railY - 4} className="dp-axis">zoom</text>
        {zoomNow !== undefined && <Handle x={zoomX} y={railY} n={depthShown ? 2 : 1} shape="square" label="Zoom" does={zoomDoes} onDrag={zoomDrag} onReset={zoomReset} />}
      </g>}
      {depthShown && <Handle x={handleAt.x} y={handleAt.y} n={1} shape="ring" label="Depth" does={why(p, 'depth', 'Drag out or in: how many hops from the selected note the graph reaches. Double-click for one hop.')}
        onDrag={can('depth') ? (x, y) => p.set('depth', clampTo(0, 8, Math.round(Math.hypot(x - cx, y - cy) / (HOPS * k)))) : undefined} onReset={can('depth') ? () => p.set('depth', 1) : undefined} />}
      {size === 'small' && !local && <g>
        <line x1={railFrom} y1={railY} x2={railTo} y2={railY} className="dp-faint" />
        {zoomNow !== undefined && <Handle x={zoomX} y={railY} n={1} shape="square" label="Zoom" does={zoomDoes} onDrag={zoomDrag} onReset={zoomReset} />}
      </g>}
    </>}
  </g>
}

/** "13 of 24": the notes the graph shows, of all the reading holds; "—" with no reading. */
const shownOf = (v: V) => { const read = readingOf(v); return read ? `${read.result.counts.displayed} of ${read.result.counts.admitted}` : NONE }

function GraphDisplay({p, w, h, size}: {p: ViewProps; w: number; h: number; size: Size}) {
  return <Display w={w} h={h} label="The graph" does="Each note is a node and each link a line. A dashed hollow node is a link with no target. Drag the ring to set the depth."
    corner={shownOf(p.v)}>
    <Well p={p} w={w} h={h} size={size} live />
  </Display>
}

// ---------------------------------------------------------------- controls

/** Depth applies to the selected note only: it stands disabled where the scope is the field. An unreported scope says nothing. */
const reasonDepth = (v: V) => (strOf(v, 'scope') === 'field' ? 'Depth applies to the selected note. Set Scope to Note.' : undefined)

const ScopeRadio = ({p}: {p: ViewProps}) => <Radio {...st(p, 'scope')} label="Scope" does="Choose the notes the graph reads." value={strOf(p.v, 'scope') ?? ''} options={SCOPES} stack onChange={x => p.set('scope', x)} />
const DepthDial = ({p}: {p: ViewProps}) => <Dial {...st(p, 'depth')} label="Depth" does="How many hops from the selected note the graph reaches." value={numOf(p.v, 'depth') ?? NaN} def={1} scale={DEPTH} format={hops}
  disabled={st(p, 'depth').disabled ?? reasonDepth(p.v)} onChange={x => p.set('depth', x)} />
const LabelRadio = ({p}: {p: ViewProps}) => <Radio {...st(p, 'labels')} label="Labels" does="Choose which labels the graph draws." value={strOf(p.v, 'labels') ?? ''} options={LABELS} stack onChange={x => p.set('labels', x)} />
/** A switch the owner reports: hollow until it does. */
function Flag({p, k, label, does}: {p: ViewProps; k: string; label: string; does: string}) {
  const now = boolOf(p.v, k)
  return <Toggle {...st(p, k)} label={label} does={does} on={now === true} unknown={now === undefined} onChange={x => p.set(k, x)} />
}
const GhostToggle = ({p}: {p: ViewProps}) => <Flag p={p} k="ghosts" label="Ghosts" does="Show the links that have no target, as dashed hollow nodes." />

/** Said in a list where there is nothing to list because the owner reported no reading. */
const NO_ROW: RowItem = {id: 'none', name: 'No reading', light: 'unknown'}

/** The groups of the filter: each member of the owner's set is a request; the light says the filtered graph holds a node of it. */
function setRows(p: ViewProps, key: 'kinds' | 'relations', names: readonly string[], inGraph: (name: string) => number): RowItem[] {
  const chosen = has(p.v, key) ? list(p.v, key) : undefined
  return names.map((name): RowItem => ({id: name, name, ...(chosen ? {request: chosen.includes(name)} : {}), light: inGraph(name) > 0 ? 'lit' : 'dark', tone: 'value', note: `${inGraph(name)}`}))
}
const toggleIn = (p: ViewProps, key: 'kinds' | 'relations') => (id: string, request: boolean) => {
  if (st(p, key).disabled) return
  const chosen = list(p.v, key)
  p.set(key, (request ? [...chosen, id] : chosen.filter(x => x !== id)).join('|'))
}
const kindRows = (p: ViewProps): RowItem[] => { const read = readingOf(p.v); return read ? setRows(p, 'kinds', read.model.kinds, name => read.result.nodes.filter(n => n.kind === name).length) : [NO_ROW] }
const relationRows = (p: ViewProps): RowItem[] => { const read = readingOf(p.v); return read ? setRows(p, 'relations', read.model.relations, name => read.result.edges.filter(e => e.relation === name).length) : [NO_ROW] }
const groupRows = (p: ViewProps): RowItem[] => {
  const groups = groupsOf(p.v), read = readingOf(p.v)
  if (!groups) return [NO_ROW]
  if (!groups.length) return [{id: 'none', name: 'No groups', light: 'dark'}]
  const matched = read ? emphasizeGraph(read.result.nodes, groups.map(g => ({...g, enabled: true}))) : undefined
  return groups.map((g): RowItem => {
    const n = read && matched ? read.result.nodes.filter(x => matched.get(x.ref)?.label === g.label).length : undefined
    return {id: g.id, name: g.label, request: g.enabled, light: g.enabled ? 'lit' : 'dark', tone: 'value', ...(n === undefined ? {} : {note: `${n}`}), ...(st(p, `g:${g.id}`).disabled ? {why: st(p, `g:${g.id}`).disabled} : {}),
      mark: <span aria-hidden style={{flex: 'none', width: 8, height: 8, borderRadius: '50%', background: g.color, opacity: g.enabled ? 1 : .35}} />}
  })
}

/** The note's own relations, as the reader lists them: backlinks and relations out, then the links that have no target. */
const linkRows = (v: V): RowItem[] => {
  const model = modelOf(v), ref = selectedOf(v)
  if (!model) return [NO_ROW]
  if (!ref) return [{id: 'none', name: ref === undefined ? 'No reading' : 'No note selected', light: ref === undefined ? 'unknown' : 'dark'}]
  const name = (r: string) => model.byRef.get(r)?.label ?? NONE
  return [
    ...model.reading.edges.filter(e => e.to_ref === ref).map((e, i): RowItem => ({id: `in${i}`, name: name(e.from_ref), light: 'lit', tone: 'value', note: `← ${e.relation}`})),
    ...model.reading.edges.filter(e => e.from_ref === ref).map((e, i): RowItem => ({id: `out${i}`, name: name(e.to_ref), light: 'lit', tone: 'value', note: `→ ${e.relation}`})),
    ...model.associations.filter(a => a.source === ref).map((a): RowItem => ({id: a.ghost, name: name(a.ghost), light: 'dark', note: 'no target'})),
  ]
}
/** The title of the links list: the selected note's name, "—" when no note is reported. */
const linksTitle = (v: V) => {
  const ref = selectedOf(v), model = modelOf(v)
  return `Links of ${ref === undefined ? NONE : !ref ? 'no note' : model?.byRef.get(ref)?.label ?? NONE}`.slice(0, 26)
}

function FindBox({p}: {p: ViewProps}) {
  const now = strOf(p.v, 'text'), standing = st(p, 'text')
  const does = ['Keep the notes whose name, alias or reference holds this text. Clear it to keep all.', now === undefined ? 'No reading from the owner yet.' : '', standing.disabled].filter(Boolean).join(' ')
  return <div className="dp-cell" style={{gridColumn: '1 / -1', width: '100%'}} data-i={`Find|${does}`} data-unread={now === undefined ? 'true' : undefined} data-disabled={standing.disabled ? 'true' : undefined}>
    <input className="kg-find" type="search" aria-label="Find in this reading" placeholder={now === undefined ? NONE : 'Name, alias or reference'} maxLength={1024} value={now ?? ''}
      disabled={!!standing.disabled} onChange={e => p.set('text', e.target.value)} />
  </div>
}

/** Clear: each filter key goes back to the cradle's starting filter. A key the host stands disabled is left as it is. */
const CLEAR: Record<string, Value> = {text: '', scope: 'field', depth: 1, direction: 'both', kinds: '', relations: '', orphans: true, ghosts: true, mode: 'structure'}
const clearFilters = (p: ViewProps) => () => { for (const [key, value] of Object.entries(CLEAR)) if (!st(p, key).disabled) p.set(key, value) }
const clearBlocked = (p: ViewProps): string | undefined => (Object.keys(CLEAR).every(key => st(p, key).disabled) ? st(p, 'text').disabled : undefined)

/** The applied filters, as chips: only what the reported keys say. Undefined when no filter key is reported. */
function chipsOf(v: V): string[] | undefined {
  if (!FILTER_KEYS.some(key => has(v, key))) return undefined
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

// The light reads the owner alone (manual §16.8): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState

export const design: DesignedDevice = {
  id: 'knowledge-graph:graph',
  title: 'Knowledge graph',
  kind: 'instrument',
  defaults: {
    light: 'lit', selected: 'wiki:node:identity', scope: 'local', depth: 2, direction: 'both', shared: false, budget: 4096, text: '', kinds: '', relations: '',
    ghosts: true, orphans: true, mode: 'structure', labels: 'automatic', arrows: false, minimap: true, zoom: 1,
    // The material: the reading of the root wiki, as Control/agents/wiki/wiki.json holds it, and the groups that the person coloured.
    reading: sampleReading(),
    groups: JSON.stringify([
      {id: 'projects', label: 'Projects', color: 'var(--sel)', text: '', kinds: ['wiki-space'], tags: []},
      {id: 'sources', label: 'Sources', color: 'var(--green)', text: '', kinds: ['file'], tags: []},
      {id: 'proposals', label: 'Proposals', color: 'var(--dp-value)', text: 'propose', kinds: [], tags: []},
    ]),
  },
  fixtures: {
    'Two hops from User identity': {},
    'Find, structure kept': {scope: 'field', text: 'actuation'},
    'Find, matches only': {scope: 'field', text: 'actuation', mode: 'matches'},
    'No readings': Object.fromEntries(['light', 'selected', 'scope', 'depth', 'direction', 'shared', 'budget', 'text', 'kinds', 'relations', 'ghosts', 'orphans', 'mode', 'labels',
      'arrows', 'minimap', 'zoom', 'reading', 'groups'].map(k => [k, undefined])),
  },
  firstPage: 'reach',

  folded: p => {
    const read = readingOf(p.v), scope = strOf(p.v, 'scope'), depth = finite(numOf(p.v, 'depth'))
    return <Folded title="Knowledge graph" light={light(p)} readings={[scope === 'local' ? (depth === undefined ? NONE : hops(depth)) : scope === 'field' ? 'field' : NONE,
      read ? `${read.result.counts.displayed}` : NONE]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Knowledge graph" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
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
    const read = readingOf(p.v), scope = strOf(p.v, 'scope'), depth = finite(numOf(p.v, 'depth'))
    return <Tile title="Graph" light={light(p)} onFull={p.nav.full}>
      <Display w={64} h={64} label="The graph" does="The neighbourhood of the note you hold."><Well p={p} w={64} h={64} size="small" live={false} /></Display>
      <div className="ref-tile-side">
        <Readout label="shown" does="Nodes the graph shows, of all it reads." value={read?.result.counts.displayed} tone="value" />
        <Readout label={scope === 'local' ? 'depth' : scope === 'field' ? 'field' : 'scope'} does="How far the graph reaches from the selected note."
          value={scope === 'local' ? (depth === undefined ? undefined : hops(depth)) : scope === 'field' ? 'all' : undefined} />
        <Readout label="ghosts" does="Links that have no target." value={read?.result.nodes.filter(isUnresolvedGraphNode).length} tone="accent" />
      </div>
    </Tile>
  },
}

// ---------------------------------------------------------------- the sample reading (this fixture's material, never the device's)

/** The root wiki as Control/agents/wiki/wiki.json holds it, as one JSON string for the `reading` key. */
function sampleReading(): string {
  const provenance = {source: 'central-wiki'}
  const node = (ref: string, kind: string, label: string, owner = 'central-wiki') => ({ref, kind, label, native_owner: owner, provenance, actions: []})
  const edge = (from_ref: string, to_ref: string, relation: string) => ({relation, from_ref, to_ref, provenance, family: 'native-semantic'})
  const root = 'central:wiki:root', project = (name: string) => `central:wiki:project:${name}`
  const projects = ['Actuation', 'Central', 'Epi-Prime', 'Factory', 'O-I', 'Point-Cloud-Demo', 'Workcell', 'ai-kit', 'personal', 'projects',
    'Archetypal-Earth', 'Quaternal-I-Ching', 'Quaternal-Tarot', 'ProjectCentral', 'face-rig']
  const notes: {ref: string; label: string; source?: string}[] = [
    {ref: 'wiki:node:identity', label: 'User identity', source: 'Control/user/identity.md'},
    {ref: 'wiki:node:staged/propose-not-write', label: 'You may propose', source: 'staging/propose-not-write'},
    {ref: 'wiki:node:root/ta-onta-and-the-thought-stream', label: 'The beings, the thought stream, and who owns what'},
    {ref: 'wiki:node:place-provider-reconciles-like-the-floor', label: 'A place provider reconciles like the floor'},
    {ref: 'wiki:node:delivered-lane-loses-install', label: 'A delivered lane that leaves the installed cut is lost work'},
  ]
  const identity = notes[0]!.ref, beings = notes[2]!.ref
  return JSON.stringify({
    schema: 'oi.cradle.graph-reading/v1',
    nodes: [
      node(root, 'wiki-space', 'Central'),
      ...projects.map(name => node(project(name), 'wiki-space', name === 'Central' ? 'Central · project' : name)),
      ...notes.map(note => node(note.ref, 'wiki-node', note.label)),
      ...notes.flatMap(note => (note.source ? [node(`source:${note.source}`, 'file', note.source)] : [])),
      {...node('view:unresolved-link:ta-onta', 'unresolved-link', 'ta-onta', 'graph-presentation'), unresolved: {key: 'ta-onta', sources: {[identity]: 1, [beings]: 2}}},
    ],
    edges: [
      ...projects.map(name => edge(root, project(name), 'space-child-space')),
      ...notes.map(note => edge(root, note.ref, 'space-node')),
      ...notes.flatMap(note => (note.source ? [edge(note.ref, `source:${note.source}`, 'node-source')] : [])),
    ],
    // The sixfold that the beings note names; Aletheia (QL-MEF) holds no space in this reading, so the whole is partial.
    formations: [{ref: beings, partial: true, members: [['Central', 'Khora'], ['Actuation', 'Hen'], ['ai-kit', 'Pleroma'], ['Factory', 'Chronos'], ['Workcell', 'Anima']]
      .map(([name, role]) => ({ref: project(name!), role}))}],
    truncated: false,
  })
}

// ---------------------------------------------------------------- the whole view: three pages, one for each face of the graph

function KnowledgeWhole({p}: {p: ViewProps}) {
  const [group, setGroup] = useState(0)
  const read = readingOf(p.v), c = read?.result.counts, budget = finite(numOf(p.v, 'budget')), bounded = c !== undefined && budget !== undefined && c.admitted > budget
  const fit = read ? fitZoom(p, read) : undefined
  return <Panel title="Knowledge graph" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'reach', label: 'Reach'}, {id: 'filters', label: 'Filters'}, {id: 'display', label: 'Display'}]} page={p.page} onPage={p.setPage}>
    <Band>
      <Section width={206}><GraphDisplay p={p} w={194} h={146} size="whole" /></Section>
      {p.page === 'filters' ? <>
        <Section label="Find" cols={2} grow>
          <FindBox p={p} />
          <GhostToggle p={p} />
          <Flag p={p} k="orphans" label="Orphans" does="Keep the notes that have no relations. Off keeps only connected notes." />
          <Radio {...st(p, 'mode')} label="Filter mode" does="Dim the rest of the graph, or hide it." value={strOf(p.v, 'mode') ?? ''} options={MODES} stack onChange={x => p.set('mode', x)} />
        </Section>
      </> : p.page === 'display' ? <>
        <Section label="Marks" cols={2} grow>
          <LabelRadio p={p} />
          <Dial {...st(p, 'zoom')} label="Zoom" does="The graph's zoom. At 100 % the whole ring set fits." value={numOf(p.v, 'zoom') ?? NaN} def={1} scale={ZOOM} format={pctx} onChange={x => p.set('zoom', x)} />
          <Flag p={p} k="arrows" label="Arrows" does="Show the direction of each line." />
          <Flag p={p} k="minimap" label="Minimap" does="Show the overview in the corner." />
        </Section>
      </> : <>
        <Section label="Scope" cols={2} grow>
          <ScopeRadio p={p} />
          <DepthDial p={p} />
          <Radio {...st(p, 'direction')} label="Direction" does="Choose which way the graph follows a relation." value={strOf(p.v, 'direction') ?? ''} options={DIRECTIONS} stack onChange={x => p.set('direction', x)} />
          <Flag p={p} k="shared" label="Shared" does="Add my available Shared Field to the reading." />
        </Section>
      </>}
    </Band>
    <Band>
      {p.page === 'filters' ? <>
        <Section width={132}><Rows label="Kinds" does={why(p, 'kinds', 'The kinds of note. The square is your request; a light means the graph holds one.')} items={kindRows(p)}
          onRequest={read && !st(p, 'kinds').disabled ? toggleIn(p, 'kinds') : undefined} size={6} /></Section>
        <Section width={132}><Rows label="Relations" does={why(p, 'relations', 'The kinds of relation. The square is your request; a light means the graph holds one.')} items={relationRows(p)}
          onRequest={read && !st(p, 'relations').disabled ? toggleIn(p, 'relations') : undefined} size={6} /></Section>
        <Section label="Result" cols={2} grow>
          <Readout big label="matches" does="Notes that match every filter." value={c?.matched} tone="value" />
          <Readout label="context" does="Notes kept only to show the structure round a match." value={c?.context} />
          <Action {...st(p, 'clear')} label="Clear" does="Remove every filter. The camera and the selection stay." onPress={clearFilters(p)} disabled={st(p, 'clear').disabled ?? clearBlocked(p)} />
        </Section>
      </> : p.page === 'display' ? <>
        <Section width={168}><Rows label="Groups" does="Groups that you coloured. A group changes how nodes look, not what they are." items={groupRows(p)}
          onRequest={(id, x) => { if (!st(p, `g:${id}`).disabled) p.set(`g:${id}`, x) }} size={6} page={group} onPage={setGroup} /></Section>
        <Section label="Camera" cols={2} grow>
          <Action {...st(p, 'zoom')} label="Fit" does="Set the zoom so that every shown node fits. The selection stays."
            onPress={() => { if (fit !== undefined) p.set('zoom', fit) }} disabled={st(p, 'zoom').disabled ?? (fit === undefined ? 'No reading of the notes to fit.' : undefined)} />
          <Readout label="zoom" does="The graph's zoom." value={finite(numOf(p.v, 'zoom')) === undefined ? undefined : pctx(numOf(p.v, 'zoom')!)} tone="value" />
        </Section>
      </> : <>
        <Section label="Budget" width={62}>
          <Dial {...st(p, 'budget')} label="Budget" does="The most nodes the reading holds. The graph says when it hides more." value={numOf(p.v, 'budget') ?? NaN} def={4096} scale={BUDGET} format={count} onChange={x => p.set('budget', x)} />
        </Section>
        <Section label="Reading" cols={2} width={118}>
          <Readout big label="shown" does="Nodes the graph shows, of all the reading holds." value={c ? `${c.displayed}/${c.admitted}` : undefined} tone="value" />
          <Readout label="hidden" does="Nodes the scope and the filters keep out of view. They are not unrelated." value={c?.hidden} />
          <Readout label="bounded" does="Yes when the reading holds more nodes than the budget." value={c && budget !== undefined ? (bounded ? 'yes' : 'no') : undefined} tone={bounded ? 'accent' : undefined} />
          <Readout label="ghosts" does="Links that have no target." value={read?.result.nodes.filter(isUnresolvedGraphNode).length} tone="accent" />
        </Section>
        <Section grow><Rows label={linksTitle(p.v)} does="The relations of the selected note: backlinks, relations out, and links with no target." items={linkRows(p.v)} size={6} /></Section>
      </>}
    </Band>
  </Panel>
}

/** Fit: the zoom at which every shown node stands inside the well (the canvas's fit, within its zoom limits). */
function fitZoom(p: ViewProps, read: Reading): number {
  const places = placesOf(read.model, p.v)
  let far = 1
  for (const n of read.result.nodes) far = Math.max(far, places.get(n.ref)?.hop ?? 0)
  return clampTo(ZOOM.min, ZOOM.max, (WORLD.y - 48) / (far * HOPS))
}

// ---------------------------------------------------------------- the pane: the graph, its chips, and the note beside it

function KnowledgePane({p}: {p: ViewProps}) {
  const read = readingOf(p.v), model = read?.model, result = read?.result, c = result?.counts, chips = chipsOf(p.v)
  const selected = selectedOf(p.v), chosen = model && selected ? model.byRef.get(selected) : undefined
  const into = model && chosen ? model.reading.edges.filter(e => e.to_ref === chosen.ref) : [], out = model && chosen ? model.reading.edges.filter(e => e.from_ref === chosen.ref) : []
  const held = model && chosen ? model.associations.filter(a => a.source === chosen.ref) : []
  const name = (ref: string) => model?.byRef.get(ref)?.label ?? NONE
  const W = 760, H = 440
  return <div className="kg-pane">
    <div className="kg-field">
      <div className="kg-chips" aria-label="Applied filters">
        {chips === undefined ? <span className="kg-chip">No reading of the filters</span>
          : chips.length ? chips.map(chip => <span key={chip} className="kg-chip" data-on="true">{chip}</span>) : <span className="kg-chip">No filter</span>}
        {boolOf(p.v, 'ghosts') === false && <span className="kg-chip">Links with no target are hidden</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="The Knowledge graph">
        <Well p={p} w={W} h={H} size="pane" live={false} />
      </svg>
      <div className="kg-summary" role="status">{c && result ? <>{c.matched} matches{c.context > 0 && ` + ${c.context} context`} · {c.displayed} of {c.admitted} notes
        {result.partialFormations.length > 0 && ` · ${result.partialFormations.length} constellation in part`}</> : NO_NOTES}</div>
    </div>
    <aside className="kg-reader" aria-label="Selected note">
      {chosen ? <>
        <h3>{chosen.label}<small>{chosen.kind} · {chosen.ref}</small></h3>
        <div><h4>Backlinks</h4>{into.length ? <ul>{into.map((e, i) => <li key={i}><span>{name(e.from_ref)}</span><i>{e.relation}</i></li>)}</ul> : <p>No note links here.</p>}</div>
        <div><h4>Relations out</h4>{out.length || held.length ? <ul>
          {out.map((e, i) => <li key={i}><span>{name(e.to_ref)}</span><i>{e.relation}</i></li>)}
          {held.map(a => <li key={a.ghost} data-ghost="true"><span>{name(a.ghost)}</span><i>no target</i></li>)}
        </ul> : <p>This note links nowhere.</p>}</div>
      </> : <p>{!read ? NO_NOTES : selected === undefined ? 'No reading of the selected note.' : selected ? 'The selected note is not in this reading.' : 'Select a note. Its text, backlinks and relations open here.'}</p>}
    </aside>
  </div>
}
