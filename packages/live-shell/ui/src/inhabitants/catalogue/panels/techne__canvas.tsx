// The Canvas (manual §17.3): Technē's research board — cards, sticky notes, shapes, frames and lines laid out as a mind map. Live's
// nearest: a device with a map in its well and pages (Hybrid Reverb), here Board and Lines. Its picture is the owner's own minimap
// (expressions-app field-studies-journeys canvasNavigationOverview.tsx; src/shared/navigationMinimapGeometry.ts): every item as a
// box, every line between box centres, the pane as a rectangle, all fitted with 8 px of padding. The Lines page draws one line by the
// canvas's routing (ReactFlow's bezier, step and straight paths) with the sides it binds to. The controls front the owner's own state:
// the pointer flags (researchInstruments.tsx:882-889), grid snap (:888), the object picker (:107, :837), the connector record
// (canvasConnectors.ts: kind, label, sides), saved views (:734-739), Find (canvasFind.ts), Present (canvasPresent.ts) and the
// constellation relate act (RelateKnowledgeAction, :161). The fixture is the Seven centres scene (model.ts:172, chakraEntities): its
// names, glyphs and tints. The positions are an arrangement a person made; positions are presentation.
import type {ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type Side = 'top' | 'right' | 'bottom' | 'left'

/** The pane the Canvas draws in, in px at 100 % (the fixture's). */
const PANE = {w: 760, h: 420}
/** The canvas's own zoom limits, as percent (navigationGeometry.ts CANVAS_ZOOM_LIMITS: 0.05 to 2). */
const ZOOM = {min: 5, max: 200, log: true}
/** The fit margin (navigationGeometry.ts FIT_MARGIN_PX) and the grid (researchInstruments.tsx:709: CANVAS_UNITS / 4). */
const FIT_MARGIN = 48, GRID = 100

// ---------------------------------------------------------------- the board

interface Item {readonly id: string; readonly kind: 'card' | 'sticky' | 'shape' | 'text'; readonly x: number; readonly y: number; readonly w: number; readonly h: number
  readonly name: string; readonly glyph?: string; readonly tint?: string; readonly shape?: string}

/** The Seven centres (chakraEntities): names, glyphs and tints from the scene; each card is its entity's size (.235 of 400 units). */
const CENTRES = [
  {name: 'Root', glyph: '△', tint: '#a94138', x: 60, y: 240}, {name: 'Sacral', glyph: '◯', tint: '#c67c46', x: 230, y: 160},
  {name: 'Solar', glyph: '△', tint: '#c2a852', x: 60, y: 80}, {name: 'Heart', glyph: '✧', tint: '#638c69', x: 230, y: 0},
  {name: 'Throat', glyph: '◯', tint: '#5898a4', x: 60, y: -80}, {name: 'Brow', glyph: '∞', tint: '#737599', x: 230, y: -160},
  {name: 'Crown', glyph: '✧', tint: '#a590b0', x: 60, y: -240},
]
const CARDS: Item[] = CENTRES.map(c => ({id: c.name, kind: 'card', x: c.x, y: c.y, w: 94, h: 94, name: c.name, glyph: c.glyph, tint: c.tint}))
const STICKY_AT = {x: -250, y: 20, w: 220, h: 180}
/** The object picker's choices and the size each lands at (canvasShapes.ts CANVAS_TOOL_SPEC). */
const OBJECTS = {
  sticky: {label: 'Sticky', kind: 'sticky', w: 220, h: 180}, rectangle: {label: 'Rectangle', kind: 'shape', w: 240, h: 160},
  ellipse: {label: 'Ellipse', kind: 'shape', w: 240, h: 160}, diamond: {label: 'Diamond', kind: 'shape', w: 200, h: 160}, text: {label: 'Text', kind: 'text', w: 220, h: 48},
} as const
type Choice = keyof typeof OBJECTS
const CHOICES = (Object.keys(OBJECTS) as Choice[]).map(value => ({value, label: OBJECTS[value].label}))
/** The palette (researchInstrumentStyles.css --canvas-object-*). */
const PALETTE: Record<string, string> = {amber: '#f1e4bf', sage: '#dbe6d3', sky: '#d6e6ee', rose: '#f0d9d4', stone: '#e7e4da'}
const COLOURS = [{value: 'amber', label: 'Amber'}, {value: 'sage', label: 'Sage'}, {value: 'sky', label: 'Sky'}, {value: 'rose', label: 'Rose'}, {value: 'stone', label: 'Stone'}]
/** The lines drawn between neighbouring centres, root to crown. Line 0 is the one that is selected. */
const LINES: readonly (readonly [number, number])[] = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]
const FRAME_ONE = {title: 'Lower three', members: ['Root', 'Sacral', 'Solar']}

const MODES = [
  {value: 'select', label: 'Select', does: 'A click selects a card or a line. A drag moves it.'},
  {value: 'lasso', label: 'Lasso', does: 'A drag draws a box and selects the cards inside it.'},
  {value: 'draw', label: 'Draw', does: 'A drag draws a stroke on the board.'},
  {value: 'erase', label: 'Erase', does: 'A click on a stroke removes it.'},
] as const
const KINDS = [{value: 'straight', label: 'Straight'}, {value: 'curved', label: 'Curved'}, {value: 'elbow', label: 'Elbow'}] as const
const SIDES = [{value: 'auto', label: 'Auto'}, {value: 'top', label: 'Top'}, {value: 'right', label: 'Right'}, {value: 'bottom', label: 'Bottom'}, {value: 'left', label: 'Left'}] as const
const DIRECTIONS = [{value: 'directed', label: 'Directed'}, {value: 'undirected', label: 'Undirected'}] as const
const STANDINGS = [{value: 'fact', label: 'Fact'}, {value: 'claim', label: 'Claim'}, {value: 'inference', label: 'Inference'}, {value: 'guess', label: 'Guess'}]
const SAVE = {saved: 'Saved', saving: 'Saving', held: 'Held'} as const

/** A sticky note's palette key: the question's own, or the one just added. */
const stickyOf = (v: V, id: string) => str(v, id === 'added' ? 'colourAdded' : 'colour')
const fillOf = (v: V) => (str(v, 'shapeFill') ? PALETTE[str(v, 'shapeFill')] : 'none')
const selected = (v: V) => str(v, 'sel').split(',').filter(Boolean)
const zoomOf = (v: V) => num(v, 'zoom') / 100

/** Every item on the board: the Seven centres, the sticky note, and the last object added. */
function items(v: V): Item[] {
  const out: Item[] = [...CARDS, {id: 'question', kind: 'sticky', ...STICKY_AT, name: 'Which centre speaks first?'}]
  const added = str(v, 'added') as Choice
  if (added && OBJECTS[added]) {
    const o = OBJECTS[added]
    out.push({id: 'added', kind: o.kind, x: num(v, 'addX'), y: num(v, 'addY'), w: o.w, h: o.h, name: o.label, shape: o.kind === 'shape' ? added : undefined})
  }
  return out
}
const bounds = (boxes: readonly Item[]) => ({l: Math.min(...boxes.map(b => b.x)), r: Math.max(...boxes.map(b => b.x + b.w)), t: Math.min(...boxes.map(b => b.y)), b: Math.max(...boxes.map(b => b.y + b.h))})

/** The camera that brings boxes into view with the margin (fitViewport): centre and zoom percent. */
function fit(boxes: readonly Item[]) {
  const e = bounds(boxes), z = Math.min((PANE.w - 2 * FIT_MARGIN) / (e.r - e.l), (PANE.h - 2 * FIT_MARGIN) / (e.b - e.t))
  return {cx: (e.l + e.r) / 2, cy: (e.t + e.b) / 2, zoom: clampTo(ZOOM.min, ZOOM.max, z * 100)}
}
const camera = (set: SetFn, c: {cx: number; cy: number; zoom: number}) => { set('cx', Math.round(c.cx)); set('cy', Math.round(c.cy)); set('zoom', Math.round(c.zoom * 10) / 10) }
const VIEWS: Record<string, (boxes: readonly Item[]) => {cx: number; cy: number; zoom: number}> = {
  everything: boxes => fit(boxes), lower: boxes => fit(boxes.filter(b => FRAME_ONE.members.includes(b.id))),
}

/** The pane's rectangle on the board, from the camera (navigationViewport): the pane over the zoom. */
const view = (v: V) => ({x: num(v, 'cx') - PANE.w / zoomOf(v) / 2, y: num(v, 'cy') - PANE.h / zoomOf(v) / 2, w: PANE.w / zoomOf(v), h: PANE.h / zoomOf(v)})

// ---------------------------------------------------------------- the minimap: the owner's own picture

/** The minimap's projection (projectNavigationMinimap): every box fitted to the well with 8 px of padding, centred. */
function project(boxes: readonly Item[], w: number, h: number, pad = 8) {
  const e = bounds(boxes), scale = Math.min((w - 2 * pad) / (e.r - e.l), (h - 2 * pad) / (e.b - e.t))
  const ox = w / 2 - (e.l + e.r) * scale / 2, oy = h / 2 - (e.t + e.b) * scale / 2
  return {scale, px: (x: number) => ox + x * scale, py: (y: number) => oy + y * scale, bx: (x: number) => (x - ox) / scale, by: (y: number) => (y - oy) / scale}
}

/** The board as the minimap draws it: grid dots when Grid snap is on, a line between box centres, each item as a box, the pane as a
 * rectangle. Handle 1 pans the pane; handle 2 (whole only) sets the zoom from the pane's corner. */
function Overview({v, set, w, h, handles}: {v: V; set?: SetFn; w: number; h: number; handles: 1 | 2}) {
  const boxes = items(v), p = project(boxes, w, h), sel = new Set(selected(v)), r = view(v)
  const cards = Object.fromEntries(boxes.map(b => [b.id, b]))
  const grid: [number, number][] = []
  if (on(v, 'grid') && p.scale * GRID > 6) {
    const e = bounds(boxes)
    for (let gx = Math.ceil(e.l / GRID) * GRID; gx <= e.r; gx += GRID) for (let gy = Math.ceil(e.t / GRID) * GRID; gy <= e.b; gy += GRID) grid.push([gx, gy])
  }
  const centre = (b: Item) => [p.px(b.x + b.w / 2), p.py(b.y + b.h / 2)] as const
  const x0 = p.px(r.x), y0 = p.py(r.y), x1 = p.px(r.x + r.w), y1 = p.py(r.y + r.h)
  const mid = {x: (x0 + x1) / 2, y: (y0 + y1) / 2}
  const clampPx = (x: number, y: number) => ({x: clampTo(6, w - 6, x), y: clampTo(6, h - 6, y)})
  const corner = clampPx(x1, y1), pan = clampPx(mid.x, mid.y)
  return <>
    {grid.map(([gx, gy]) => <circle key={`${gx}:${gy}`} cx={p.px(gx)} cy={p.py(gy)} r={.7} fill="var(--text-faint, #71767c)" opacity={.6} />)}
    {LINES.map(([a, b], i) => { const [ax, ay] = centre(cards[CENTRES[a]!.name]!), [bx, by] = centre(cards[CENTRES[b]!.name]!)
      return <path key={i} d={`M${ax} ${ay}L${bx} ${by}`} className={i === 0 ? 'dp-curve' : 'dp-faint'} style={i === 0 ? {strokeWidth: 1} : undefined} /> })}
    {boxes.map(b => {
      const on_ = sel.has(b.id)
      return <rect key={b.id} x={p.px(b.x)} y={p.py(b.y)} width={Math.max(2, b.w * p.scale)} height={Math.max(2, b.h * p.scale)} rx={1}
        style={{fill: b.kind === 'sticky' ? PALETTE[stickyOf(v, b.id)] : b.tint ? `color-mix(in srgb, ${b.tint} 45%, transparent)` : 'none',
          stroke: on_ ? 'var(--dp-on)' : b.kind === 'card' ? b.tint : 'var(--text-faint, #71767c)', strokeWidth: on_ ? 1.4 : 1, opacity: b.kind === 'sticky' ? .85 : 1}} />
    })}
    <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} className="dp-curve-on" style={{strokeWidth: 1.2}} />
    <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} className="dp-fill-on" />
    {set && <Handle n={1} x={pan.x} y={pan.y} label="Pane" does="Drag: moves the pane over the board. The zoom stays."
      onDrag={(x, y) => { set('cx', Math.round(p.bx(clampTo(0, w, x)))); set('cy', Math.round(p.by(clampTo(0, h, y)))) }} onReset={() => camera(set, VIEWS.everything!(boxes))} />}
    {set && handles === 2 && <Handle n={2} shape="ring" x={corner.x} y={corner.y} label="Zoom" does="Drag the pane's corner out to zoom out, in to zoom in."
      onDrag={(x, y) => {
        const half = Math.max(Math.abs(x - mid.x), Math.abs(y - mid.y) * PANE.w / PANE.h) / p.scale
        set('zoom', Math.round(clampTo(ZOOM.min, ZOOM.max, PANE.w / (2 * Math.max(half, 1)) * 100) * 10) / 10)
      }} onReset={() => set('zoom', 100)} />}
  </>
}

function BoardDisplay({v, set, w, h, handles = 1}: {v: V; set?: SetFn; w: number; h: number; handles?: 1 | 2}) {
  const mode = MODES.find(m => m.value === str(v, 'mode'))!
  return <Display w={w} h={h} label="The board" does="Every item as a box, the pane as a rectangle. Drag handle 1 to move the pane. Grid dots show when Grid snap is on."
    corner={`${Math.round(num(v, 'zoom'))} %`}>
    <Overview v={v} set={set} w={w} h={h} handles={handles} />
    {mode.value !== 'select' && <text x={6} y={h - 6} className="dp-ink-dim">{mode.label}</text>}
  </Display>
}

// ---------------------------------------------------------------- the line: the canvas's routing

interface Box {x: number; y: number; w: number; h: number}
const NORMAL: Record<Side, readonly [number, number]> = {top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0]}
const at = (b: Box, s: Side) => (s === 'top' ? [b.x + b.w / 2, b.y] : s === 'right' ? [b.x + b.w, b.y + b.h / 2] : s === 'bottom' ? [b.x + b.w / 2, b.y + b.h] : [b.x, b.y + b.h / 2]) as [number, number]
/** The sides an unbound end takes: the two that face each other. */
function facing(a: Box, b: Box): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + a.h / 2)
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? ['right', 'left'] : ['left', 'right']) : (dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'])
}
/** ReactFlow's bezier control offset (curvature .25). */
const offset = (d: number) => (d >= 0 ? .5 * d : .25 * 25 * Math.sqrt(-d))
function control(s: Side, [x1, y1]: [number, number], [x2, y2]: [number, number]): [number, number] {
  return s === 'left' ? [x1 - offset(x1 - x2), y1] : s === 'right' ? [x1 + offset(x2 - x1), y1] : s === 'top' ? [x1, y1 - offset(y1 - y2)] : [x1, y1 + offset(y2 - y1)]
}

/** One line's path, its label point and the way its end points, for a kind, from box a's side to box b's side. */
function route(kind: string, a: Box, b: Box, sa: Side, sb: Side) {
  const p1 = at(a, sa), p2 = at(b, sb)
  if (kind === 'straight') return {d: `M${p1}L${p2}`, mid: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2] as [number, number], head: [p2[0] - p1[0], p2[1] - p1[1]] as [number, number], p1, p2}
  if (kind === 'elbow') {
    const n1 = NORMAL[sa], n2 = NORMAL[sb], s1: [number, number] = [p1[0] + n1[0] * 12, p1[1] + n1[1] * 12], s2: [number, number] = [p2[0] + n2[0] * 12, p2[1] + n2[1] * 12]
    const horizontal = (s: Side) => s === 'left' || s === 'right', pts: [number, number][] = [p1, s1]
    if (horizontal(sa) && horizontal(sb)) { const mx = sa === sb ? (n1[0] > 0 ? Math.max(s1[0], s2[0]) + 8 : Math.min(s1[0], s2[0]) - 8) : (s1[0] + s2[0]) / 2; pts.push([mx, s1[1]], [mx, s2[1]]) }
    else if (!horizontal(sa) && !horizontal(sb)) { const my = sa === sb ? (n1[1] > 0 ? Math.max(s1[1], s2[1]) + 8 : Math.min(s1[1], s2[1]) - 8) : (s1[1] + s2[1]) / 2; pts.push([s1[0], my], [s2[0], my]) }
    else pts.push(horizontal(sa) ? [s2[0], s1[1]] : [s1[0], s2[1]])
    pts.push(s2, p2)
    const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1])), half = lens.reduce((s, l) => s + l, 0) / 2
    let run = 0, mid: [number, number] = pts[0]!
    for (let i = 0; i < lens.length; i++) { if (run + lens[i]! >= half) { const k = (half - run) / (lens[i] || 1); mid = [pts[i]![0] + (pts[i + 1]![0] - pts[i]![0]) * k, pts[i]![1] + (pts[i + 1]![1] - pts[i]![1]) * k]; break } run += lens[i]! }
    return {d: `M${pts.map(q => q.join(' ')).join('L')}`, mid, head: [-n2[0], -n2[1]] as [number, number], p1, p2}
  }
  const c1 = control(sa, p1, p2), c2 = control(sb, p2, p1)
  return {d: `M${p1}C${c1} ${c2} ${p2}`, mid: [(p1[0] + 3 * c1[0] + 3 * c2[0] + p2[0]) / 8, (p1[1] + 3 * c1[1] + 3 * c2[1] + p2[1]) / 8] as [number, number], head: [p2[0] - c2[0], p2[1] - c2[1]] as [number, number], p1, p2}
}
const arrow = ([x, y]: [number, number], [dx, dy]: [number, number], s: number) => {
  const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n
  return `M${x} ${y}L${x - ux * s - uy * s * .55} ${y - uy * s + ux * s * .55}L${x - ux * s + uy * s * .55} ${y - uy * s - ux * s * .55}Z`
}

/** The selected line between its two cards: its kind, the sides it binds to, its label, its direction. Handles 1 and 2 snap to a side. */
function LineDisplay({v, set}: {v: V; set?: SetFn}) {
  const a: Box = {x: 12, y: 84, w: 54, h: 40}, b: Box = {x: 112, y: 22, w: 54, h: 40}
  const [fa, fb] = facing(a, b), sa = (str(v, 'fromSide') === 'auto' ? fa : str(v, 'fromSide')) as Side, sb = (str(v, 'toSide') === 'auto' ? fb : str(v, 'toSide')) as Side
  const r = route(str(v, 'lineKind'), a, b, sa, sb), label = str(v, 'label')
  const nearest = (box: Box, x: number, y: number) => (['top', 'right', 'bottom', 'left'] as Side[]).reduce((best, s) => (Math.hypot(at(box, s)[0] - x, at(box, s)[1] - y) < Math.hypot(at(box, best)[0] - x, at(box, best)[1] - y) ? s : best))
  const card = (box: Box, i: number) => <g key={i}>
    <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3} style={{fill: `color-mix(in srgb, ${CENTRES[i]!.tint} 40%, transparent)`, stroke: CENTRES[i]!.tint}} />
    <text x={box.x + box.w / 2} y={box.y + box.h / 2 + 3} textAnchor="middle" className="dp-ink">{CENTRES[i]!.name}</text>
    {(['top', 'right', 'bottom', 'left'] as Side[]).map(s => <circle key={s} cx={at(box, s)[0]} cy={at(box, s)[1]} r={1.6} fill="var(--text-faint, #71767c)" />)}
  </g>
  return <Display w={194} h={146} label="The line" does="The selected line between its two cards, routed as the board routes it. Drag handle 1 or 2 to a side of its card to bind that end."
    corner="Root → Sacral">
    {card(a, 0)}{card(b, 1)}
    <path d={r.d} className="dp-curve" style={{strokeWidth: 1.5}} />
    {str(v, 'direction') === 'directed' && <path d={arrow(r.p2, r.head, 6)} fill="var(--dp-value)" />}
    {label && <text x={r.mid[0]} y={r.mid[1] - 6} textAnchor="middle" className="dp-ink" style={{paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 3}}>{label}</text>}
    <text x={6} y={140} className="dp-axis">{str(v, 'lineKind')}</text>
    <Handle n={1} x={r.p1[0]} y={r.p1[1]} label="Start" does="Drag to a side of the first card: the line leaves from that side."
      onDrag={set && ((x, y) => set('fromSide', nearest(a, x, y)))} onReset={set && (() => set('fromSide', 'auto'))} />
    <Handle n={2} shape="ring" x={r.p2[0]} y={r.p2[1]} label="End" does="Drag to a side of the second card: the line arrives at that side."
      onDrag={set && ((x, y) => set('toSide', nearest(b, x, y)))} onReset={set && (() => set('toSide', 'auto'))} />
  </Display>
}

// ---------------------------------------------------------------- the pane at full size

/** The board in the pane: frames, lines, cards, the sticky note, the last object added; the pane is what the camera frames. */
function World({v}: {v: V}) {
  const boxes = items(v), by = Object.fromEntries(boxes.map(b => [b.id, b])), sel = new Set(selected(v)), z = zoomOf(v)
  const frames = [{title: FRAME_ONE.title, ids: FRAME_ONE.members}, ...(str(v, 'frame2') ? [{title: 'Frame 2', ids: str(v, 'frame2').split(',')}] : [])]
  const stroke = (id: string) => (sel.has(id) ? 'var(--dp-on)' : undefined)
  const grid: [number, number][] = []
  if (on(v, 'grid') && GRID * z > 18) {
    const r = view(v)
    for (let gx = Math.ceil(r.x / GRID) * GRID; gx <= r.x + r.w; gx += GRID) for (let gy = Math.ceil(r.y / GRID) * GRID; gy <= r.y + r.h; gy += GRID) grid.push([gx, gy])
  }
  return <g transform={`translate(${PANE.w / 2 - num(v, 'cx') * z} ${PANE.h / 2 - num(v, 'cy') * z}) scale(${z})`}>
    {grid.map(([gx, gy]) => <circle key={`${gx}:${gy}`} cx={gx} cy={gy} r={1.4 / z} fill="var(--text-faint, #71767c)" opacity={.55} />)}
    {frames.map(f => { const e = bounds(f.ids.map(id => by[id]!).filter(Boolean)); const pad = 16
      return <g key={f.title}><rect x={e.l - pad} y={e.t - pad} width={e.r - e.l + 2 * pad} height={e.b - e.t + 2 * pad} rx={6} fill="color-mix(in srgb, var(--text) 4%, transparent)"
        stroke="var(--text-faint, #71767c)" strokeWidth={1.2 / z} strokeDasharray={`${4 / z} ${3 / z}`} />
        <text x={e.l - pad + 2} y={e.t - pad - 7} style={{fill: 'var(--text-dim)', font: '13px var(--font-ui, sans-serif)'}}>{f.title}</text></g> })}
    {LINES.map(([ia, ib], i) => {
      const A = by[CENTRES[ia]!.name]!, B = by[CENTRES[ib]!.name]!, first = i === 0, [fa, fb] = facing(A, B)
      const sa = (first && str(v, 'fromSide') !== 'auto' ? str(v, 'fromSide') : fa) as Side, sb = (first && str(v, 'toSide') !== 'auto' ? str(v, 'toSide') : fb) as Side
      const r = route(first ? str(v, 'lineKind') : 'curved', A, B, sa, sb), head = !first || str(v, 'direction') === 'directed'
      return <g key={i}>
        <path d={r.d} fill="none" stroke={first ? 'var(--dp-value)' : 'var(--text-dim)'} strokeWidth={(first ? 2 : 1.4) / z} />
        {head && <path d={arrow(r.p2, r.head, 11)} fill={first ? 'var(--dp-value)' : 'var(--text-dim)'} />}
        {first && str(v, 'label') && <text x={r.mid[0]} y={r.mid[1] - 8} textAnchor="middle" style={{fill: 'var(--text)', font: '13px var(--font-ui, sans-serif)', paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 4}}>{str(v, 'label')}</text>}
      </g>
    })}
    {boxes.map(b => <g key={b.id}>
      {b.kind === 'card' && <>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} style={{fill: `color-mix(in srgb, ${b.tint} 22%, var(--dp-well))`, stroke: stroke(b.id) ?? b.tint, strokeWidth: (sel.has(b.id) ? 2.4 : 1.4) / z}} />
        <text x={b.x + b.w / 2} y={b.y + 44} textAnchor="middle" style={{fill: b.tint, font: '28px var(--font-ui, sans-serif)'}}>{b.glyph}</text>
        <text x={b.x + b.w / 2} y={b.y + 74} textAnchor="middle" style={{fill: 'var(--text)', font: '14px var(--font-ui, sans-serif)'}}>{b.name}</text>
      </>}
      {b.kind === 'sticky' && <>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={3} style={{fill: PALETTE[stickyOf(v, b.id)], stroke: stroke(b.id), strokeWidth: 2.4 / z}} />
        {b.id === 'added' ? <text x={b.x + 14} y={b.y + 28} style={{fill: '#3d3a2e', font: '16px var(--font-ui, sans-serif)'}}>Sticky</text>
          : <><text x={b.x + 14} y={b.y + 30} style={{fill: '#3d3a2e', font: '17px var(--font-ui, sans-serif)'}}>Which centre</text>
            <text x={b.x + 14} y={b.y + 54} style={{fill: '#3d3a2e', font: '17px var(--font-ui, sans-serif)'}}>speaks first?</text></>}
      </>}
      {b.kind === 'shape' && <>
        {b.shape === 'rectangle' && <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={fillOf(v)} stroke={stroke(b.id) ?? '#74766b'} strokeWidth={(sel.has(b.id) ? 2.4 : 1.35) / z} />}
        {b.shape === 'ellipse' && <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={fillOf(v)} stroke={stroke(b.id) ?? '#74766b'} strokeWidth={(sel.has(b.id) ? 2.4 : 1.35) / z} />}
        {b.shape === 'diamond' && <path d={`M${b.x + b.w / 2} ${b.y}L${b.x + b.w} ${b.y + b.h / 2}L${b.x + b.w / 2} ${b.y + b.h}L${b.x} ${b.y + b.h / 2}Z`} fill={fillOf(v)} stroke={stroke(b.id) ?? '#74766b'} strokeWidth={(sel.has(b.id) ? 2.4 : 1.35) / z} />}
        <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 5} textAnchor="middle" style={{fill: str(v, 'shapeFill') ? '#3d3a2e' : 'var(--text-dim)', font: '15px var(--font-ui, sans-serif)'}}>{b.name}</text>
      </>}
      {b.kind === 'text' && <text x={b.x + 6} y={b.y + 32} style={{fill: 'var(--text)', font: '20px var(--font-ui, sans-serif)'}}>{b.name}</text>}
    </g>)}
  </g>
}

// ---------------------------------------------------------------- readings and the head

const light = (v: V) => str(v, 'light') as LightState
const cardsOn = (v: V) => items(v).length
const frameCount = (v: V) => 1 + (str(v, 'frame2') ? 1 : 0)
const waiting = (v: V) => num(v, 'waiting')
/** What the one selected item is, for the Colour control: a sticky note takes a palette colour, a shape takes a fill. */
const pickedKind = (v: V): 'sticky' | 'shape' | undefined => {
  const ids = selected(v), kind = ids[0] === 'added' ? OBJECTS[str(v, 'added') as Choice]?.kind : ids[0] === 'question' ? 'sticky' : undefined
  return ids.length === 1 && (kind === 'sticky' || kind === 'shape') ? kind : undefined
}
const span2 = (node: ReactNode) => <div style={{gridColumn: 'span 2', width: '100%'}}>{node}</div>
const span3 = (node: ReactNode) => <div style={{gridColumn: 'span 3', width: '100%'}}>{node}</div>

// ---------------------------------------------------------------- controls, each in one place

const mode = (p: ViewProps) => <Radio label="Mode" does="Chooses what a drag does on the board: select, box select, draw or erase." value={str(p.v, 'mode')} options={MODES} stack onChange={x => p.set('mode', x)} />
const zoom = (p: ViewProps) => <Dial label="Zoom" does="Sets how large the board looks in the pane. Fit all brings the whole board into view." value={num(p.v, 'zoom')} def={100} scale={ZOOM}
  format={x => `${Math.round(x)} %`} onChange={x => p.set('zoom', x)} />
const grid = (p: ViewProps) => <Toggle label="Grid" does="Snaps a dragged item to the grid. Alignment guides show whether the grid is on or off." on={on(p.v, 'grid')} onChange={x => p.set('grid', x)} />
const fitAll = (p: ViewProps) => <Action label="Fit all" does="Brings every item into view with a margin." onPress={() => camera(p.set, fit(items(p.v)))} />
const fitSel = (p: ViewProps) => <Action label="Fit sel." does="Brings the selected items into view with a margin."
  disabled={selected(p.v).length ? undefined : 'Select an item first.'} onPress={() => camera(p.set, fit(items(p.v).filter(b => selected(p.v).includes(b.id))))} />

const VIEW_OPTIONS = (v: V) => [{value: '', label: 'None'}, {value: 'everything', label: 'Everything'}, {value: 'lower', label: 'Lower three'}, ...(v.mine === true ? [{value: 'mine', label: 'Mine'}] : [])]
const viewChooser = (p: ViewProps) => <Chooser label="View" does="Applies a saved view: the camera and the selection. The Canvas names any item that left since you saved it."
  value={str(p.v, 'view')} options={VIEW_OPTIONS(p.v)} onChange={x => {
    p.set('view', x)
    if (x === 'mine') camera(p.set, {cx: num(p.v, 'mineX'), cy: num(p.v, 'mineY'), zoom: num(p.v, 'mineZ')})
    else if (VIEWS[x]) camera(p.set, VIEWS[x]!(items(p.v)))
  }} />
const saveView = (p: ViewProps) => <Action label="Save view" does="Keeps the camera and the selection under a name."
  onPress={() => { p.set('mine', true); p.set('mineX', num(p.v, 'cx')); p.set('mineY', num(p.v, 'cy')); p.set('mineZ', num(p.v, 'zoom')); p.set('view', 'mine') }} />
const saved = (p: ViewProps) => <Readout label="save" does="Saves a short time after each change. It shows saved, saving or held." value={SAVE[str(p.v, 'save') as keyof typeof SAVE]}
  tone={str(p.v, 'save') === 'held' ? 'stall' : str(p.v, 'save') === 'saved' ? 'green' : undefined} />

const add = (p: ViewProps) => <Chooser label="Add" does="Adds the chosen object at the centre of the pane: a sticky note, a shape or text." value={str(p.v, 'add')} options={CHOICES}
  onChange={x => {
    const o = OBJECTS[x as Choice]
    p.set('add', x); p.set('added', x); p.set('colourAdded', 'amber'); p.set('shapeFill', ''); p.set('addX', Math.round(num(p.v, 'cx') - o.w / 2)); p.set('addY', Math.round(num(p.v, 'cy') - o.h / 2)); p.set('sel', 'added')
  }} />
const colour = (p: ViewProps) => <Chooser label="Colour" does="Sets the colour of the selected sticky note, or the fill of the selected shape."
  value={pickedKind(p.v) === 'shape' ? str(p.v, 'shapeFill') : stickyOf(p.v, selected(p.v)[0] ?? '')} options={COLOURS}
  disabled={pickedKind(p.v) ? undefined : 'Select one sticky note or shape first.'}
  onChange={x => p.set(pickedKind(p.v) === 'shape' ? 'shapeFill' : selected(p.v)[0] === 'added' ? 'colourAdded' : 'colour', x)} />
const minimap = (p: ViewProps) => <Toggle label="Minimap" does="Shows the minimap in the corner of the pane. Click the minimap to jump there." on={on(p.v, 'minimap')} onChange={x => p.set('minimap', x)} />
const frame = (p: ViewProps) => <Action label="Frame" does="Draws a frame round the selected cards."
  disabled={selected(p.v).length >= 2 && !str(p.v, 'frame2') ? undefined : str(p.v, 'frame2') ? 'These cards are framed.' : 'Select two or more cards first.'}
  onPress={() => p.set('frame2', selected(p.v).join(','))} />
const find = () => <Action label="Find" does="Opens the find box. It searches card text and frame titles, then centres the match." onPress={() => {}} />
const present = (p: ViewProps) => <Action label="Present" does="Shows the frames in order, full screen. Esc leaves."
  disabled={frameCount(p.v) ? undefined : 'Add a frame first.'} onPress={() => {}} />

const kind = (p: ViewProps) => <Radio label="Kind" does="Sets the path of the selected line: straight, curved or elbow." value={str(p.v, 'lineKind')} options={KINDS} stack onChange={x => p.set('lineKind', x)} />
const sideFrom = (p: ViewProps) => <Chooser label="From" does="Binds the start of the selected line to a side of its card. Auto picks the facing side." value={str(p.v, 'fromSide')} options={SIDES} onChange={x => p.set('fromSide', x)} />
const sideTo = (p: ViewProps) => <Chooser label="To" does="Binds the end of the selected line to a side of its card. Auto picks the facing side." value={str(p.v, 'toSide')} options={SIDES} onChange={x => p.set('toSide', x)} />
const direction = (p: ViewProps) => <Radio label="Direction" does="Sets whether the relation points one way. The setting applies when you promote the line." value={str(p.v, 'direction')} options={DIRECTIONS} stack onChange={x => p.set('direction', x)} />
const promote = (p: ViewProps) => {
  const state = str(p.v, 'promote')
  return <Action label="Promote" does="Sends the selected line to its owner as a relation. The owner may refuse."
    disabled={state === 'recorded' ? 'The owner has recorded this relation.' : undefined} refused={state === 'refused' ? str(p.v, 'refusal') : undefined}
    onPress={() => { p.set('promote', 'recorded'); p.set('waiting', waiting(p.v) - 1) }} />
}

export const design: DesignedDevice = {
  id: 'techne:canvas',
  title: 'Canvas',
  kind: 'instrument',
  firstPage: 'board',
  defaults: {
    light: 'lit', mode: 'select', grid: false, add: 'sticky', colour: 'amber', minimap: true,
    zoom: 100, cx: 100, cy: 130, view: '', mine: false, mineX: 0, mineY: 0, mineZ: 100,
    lineKind: 'curved', fromSide: 'auto', toSide: 'auto', direction: 'directed', standing: '', promote: 'ready', refusal: '',
    sel: 'question', colourAdded: 'amber', shapeFill: '', frame2: '', added: '', addX: 0, addY: 0,
    // Readings: what the device reports, never set from here.
    label: 'rises to', save: 'saved', waiting: 4,
  },
  fixtures: {
    'Seven centres': {},
    'A refused line, bound as an elbow': {promote: 'refused', refusal: 'Open the native Scene before recording a relationship.', lineKind: 'elbow', fromSide: 'right', toSide: 'right'},
    'Two cards selected': {sel: 'Heart,Throat'},
  },

  folded: p => <Folded title="Canvas" light={light(p.v)} readings={[`${waiting(p.v)} wait`, `${Math.round(num(p.v, 'zoom'))} %`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Canvas" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><BoardDisplay v={p.v} set={p.set} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>{mode(p)}{zoom(p)}{grid(p)}{fitAll(p)}</Section>
  </Panel>,

  whole: p => <Panel title="Canvas" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'board', label: 'Board'}, {id: 'lines', label: 'Lines'}]} page={p.page} onPage={p.setPage}>
    {p.page === 'lines' ? <>
      <Band>
        <Section width={206}><LineDisplay v={p.v} set={p.set} /></Section>
        <Section label="Path" cols={2} grow>
          {kind(p)}
          <div style={{display: 'flex', flexDirection: 'column', gap: 4, width: '100%'}}>{sideFrom(p)}{sideTo(p)}</div>
          <Readout label="label" does="The text at the middle of the line. Write it in the line's panel on the board." value={str(p.v, 'label') || 'none'} />
        </Section>
      </Band>
      <Band>
        <Section label="Relation" cols={3}>
          {span3(<Readout label="relation" does="The name of the relation. It starts as the line's label. Name it in the line's panel before you promote." value={str(p.v, 'label') || 'none'} />)}
          {span2(direction(p))}
          {span3(<Chooser label="Standing" does="The standing of the next relation: fact, claim, inference or guess." value={str(p.v, 'standing')} options={STANDINGS}
            disabled="No owner records a standing on a line." />)}
        </Section>
        <Section label="Promote" cols={2} grow>
          {promote(p)}
          <Readout big label="wait" does="Lines you drew that no owner has recorded as relations." value={waiting(p.v)} tone="accent" />
          <Readout label="lines" does="Lines on the board." value={LINES.length} />
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={206}><BoardDisplay v={p.v} set={p.set} w={194} h={146} handles={2} /></Section>
        <Section label="Pointer" cols={2} grow>
          {mode(p)}{zoom(p)}{grid(p)}{minimap(p)}
        </Section>
      </Band>
      <Band>
        <Section label="Add" cols={2}>
          {span2(add(p))}{span2(colour(p))}{frame(p)}{find()}
        </Section>
        <Section label="Camera" cols={2}>
          {fitAll(p)}{fitSel(p)}{present(p)}<Readout label="frames" does="Frames on the board." value={frameCount(p.v)} />
        </Section>
        <Section label="Views" grow>
          {viewChooser(p)}{saveView(p)}{saved(p)}
        </Section>
      </Band>
    </>}
  </Panel>,

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox={`0 0 ${PANE.w} ${PANE.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The Canvas">
      <g className="dp-display" style={{background: 'none'}}>
        <defs><clipPath id="canvas-pane"><rect width={PANE.w} height={PANE.h} /></clipPath></defs>
        <g clipPath="url(#canvas-pane)"><World v={p.v} /></g>
        <text x={14} y={24} style={{fill: 'var(--text-dim)', font: '12px var(--font-ui, sans-serif)'}}>{str(p.v, 'mode') === 'select' ? '' : `${MODES.find(m => m.value === str(p.v, 'mode'))!.label} · `}{Math.round(num(p.v, 'zoom'))} % · {cardsOn(p.v)} items · {waiting(p.v)} lines wait for their owner</text>
        {on(p.v, 'minimap') && <g transform={`translate(${PANE.w - 152} ${PANE.h - 118})`}>
          <rect width={140} height={106} rx={3} style={{fill: 'var(--dp-well)', stroke: 'var(--line, #24262a)', strokeWidth: 1}} opacity={.95} />
          <Overview v={p.v} w={140} h={106} handles={1} />
        </g>}
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Canvas" light={light(p.v)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="The board" does="Every item as a box, the pane as a rectangle. Click ⤢ to open the Canvas in the pane that has focus.">
      <Overview v={p.v} w={112} h={104} handles={1} />
    </Display>
    <div className="ref-tile-counts">
      <Readout big label="items" does="Cards, notes and shapes on the board." value={cardsOn(p.v)} />
      <Readout big label="lines" does="Lines on the board." value={LINES.length} tone="value" />
      <Readout big label="wait" does="Lines that no owner has recorded as relations." value={waiting(p.v)} tone="accent" />
    </div>
  </Tile>,
}
