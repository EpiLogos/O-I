// The Canvas (manual §17.4): Technē's research board — cards, sticky notes, shapes, frames and lines laid out as a mind map. Live's
// nearest: a device with a map in its well and pages (Hybrid Reverb), here Board and Lines. Its picture is the owner's own minimap
// (expressions-app field-studies-journeys canvasNavigationOverview.tsx; src/shared/navigationMinimapGeometry.ts): every item as a
// box, every line between box centres, the pane as a rectangle, all fitted with 8 px of padding. The Lines page draws one line by the
// canvas's routing (ReactFlow's bezier, step and straight paths) with the sides it binds to. The controls front the owner's own state:
// the pointer flags (researchInstruments.tsx:882-889), grid snap (:888), the object picker (:107, :837), the connector record
// (canvasConnectors.ts: kind, label, sides), saved views (:734-739), Find (canvasFind.ts), Present (canvasPresent.ts) and the
// constellation relate act (RelateKnowledgeAction, :161).
//
// The board is the owner's material, carried in three value keys, each a JSON list: `items` (each {id, kind, x, y, w, h, name,
// glyph?, tint?, shape?}), `lines` (each a pair of items, by position in `items` or by id; the first is the selected line) and `frames`
// (each {title, members}, members being item ids). The sample sits in `defaults`: the Seven centres scene (model.ts:172,
// chakraEntities: its names, glyphs and tints) with the question sticky, six lines and one frame. The positions are an arrangement a
// person made; positions are presentation. A board the owner does not report is named in the well, never drawn.
import type {CSSProperties, ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState, type Standing} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

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
interface Frame {readonly title: string; readonly members: readonly string[]}
/** One line: the two items it joins, each by position in `items` or by id. */
type LineEnds = readonly [number | string, number | string]
/** The camera: the board point at the pane's centre, and the zoom in percent. */
interface Look {readonly cx: number; readonly cy: number; readonly zoom: number}

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
const ITEM_KINDS: readonly string[] = ['card', 'sticky', 'shape', 'text']

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
const SAVE: Record<string, string> = {saved: 'Saved', saving: 'Saving', held: 'Held'}

// ---------------------------------------------------------------- reading the values

/** A value in a map of the product's own words, or undefined: never a prototype member, never a throw. */
const own = <T,>(map: Readonly<Record<string, T>>, key: string | undefined): T | undefined =>
  key !== undefined && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
/** A number the owner reported, or undefined when it is absent or not a number. */
const finiteOf = (v: V, key: string): number | undefined => { const n = numOf(v, key); return n !== undefined && Number.isFinite(n) ? n : undefined }
const clip = (text: string, chars: number) => (text.length > chars ? `${text.slice(0, Math.max(1, chars - 1))}…` : text)
/** Words broken into lines of about `chars` characters. */
function wrap(text: string, chars: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && `${line} ${word}`.length > chars) { out.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out
}

function itemOf(x: unknown): Item | undefined {
  const o = x as Record<string, unknown> | null
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || typeof o.kind !== 'string' || !ITEM_KINDS.includes(o.kind)) return undefined
  if (!finite(o.x) || !finite(o.y) || !finite(o.w) || !finite(o.h) || o.w < 0 || o.h < 0) return undefined
  return {id: o.id, kind: o.kind as Item['kind'], x: o.x, y: o.y, w: o.w, h: o.h, name: typeof o.name === 'string' ? o.name : NONE,
    glyph: typeof o.glyph === 'string' ? o.glyph : undefined, tint: typeof o.tint === 'string' ? o.tint : undefined, shape: typeof o.shape === 'string' ? o.shape : undefined}
}

/** Every item on the board: the owner's, then the last object the hand added. Undefined when the owner reports no items. */
function items(v: V): Item[] | undefined {
  const read = json<unknown>(v, 'items', undefined)
  if (!Array.isArray(read)) return undefined
  const out = read.map(itemOf).filter((b): b is Item => b !== undefined)
  const added = strOf(v, 'added'), o = own(OBJECTS, added), x = finiteOf(v, 'addX'), y = finiteOf(v, 'addY')
  if (o && x !== undefined && y !== undefined) out.push({id: 'added', kind: o.kind, x, y, w: o.w, h: o.h, name: o.label, shape: o.kind === 'shape' ? added : undefined})
  return out
}
/** The lines the owner reports, each as the pair of ends it names; the first is the selected one. Undefined when it reports none. */
function linesOf(v: V): LineEnds[] | undefined {
  const read = json<unknown>(v, 'lines', undefined)
  if (!Array.isArray(read)) return undefined
  return read.filter((e): e is LineEnds => Array.isArray(e) && e.length === 2 && e.every(k => finite(k) || typeof k === 'string'))
}
const endOf = (boxes: readonly Item[], k: number | string) => (typeof k === 'number' ? boxes[k] : boxes.find(b => b.id === k))
/** Each line as the two items it joins (undefined where an end is not on the board), in the order the owner gave them. */
const joined = (raw: readonly LineEnds[], boxes: readonly Item[]): (readonly [Item, Item] | undefined)[] =>
  raw.map(([a, b]) => { const A = endOf(boxes, a), B = endOf(boxes, b); return A && B ? ([A, B] as const) : undefined })
/** The frames the owner reports, or undefined when it reports none. */
function reported(v: V): Frame[] | undefined {
  const read = json<unknown>(v, 'frames', undefined)
  if (!Array.isArray(read)) return undefined
  return read.flatMap((f): Frame[] => {
    const o = f as {title?: unknown; members?: unknown} | null
    return o && typeof o === 'object' && typeof o.title === 'string' && Array.isArray(o.members) ? [{title: o.title, members: o.members.filter((m): m is string => typeof m === 'string')}] : []
  })
}
/** The frames drawn: the owner's, then the one the hand just drew. */
const framesOf = (v: V): Frame[] => { const hand = strOf(v, 'frame2'); return [...(reported(v) ?? []), ...(hand ? [{title: 'Frame 2', members: hand.split(',').filter(Boolean)}] : [])] }
const frameCount = (v: V) => { const own_ = reported(v); return own_ ? own_.length + (strOf(v, 'frame2') ? 1 : 0) : undefined }

const selected = (v: V) => (strOf(v, 'sel') ?? '').split(',').filter(Boolean)
/** A sticky note's palette key: the question's own, or the one just added. */
const stickyOf = (v: V, id: string) => strOf(v, id === 'added' ? 'colourAdded' : 'colour')
const fillOf = (v: V) => own(PALETTE, strOf(v, 'shapeFill')) ?? 'none'
const modeOf = (v: V) => MODES.find(m => m.value === strOf(v, 'mode'))
const lookOf = (v: V): Look | undefined => {
  const cx = finiteOf(v, 'cx'), cy = finiteOf(v, 'cy'), zoom = finiteOf(v, 'zoom')
  return cx !== undefined && cy !== undefined && zoom !== undefined && zoom > 0 ? {cx, cy, zoom} : undefined
}
const zoomText = (v: V) => { const z = finiteOf(v, 'zoom'); return z === undefined ? NONE : `${Math.round(z)} %` }
const waiting = (v: V) => finiteOf(v, 'waiting')

const bounds = (boxes: readonly Item[]) => ({l: Math.min(...boxes.map(b => b.x)), r: Math.max(...boxes.map(b => b.x + b.w)), t: Math.min(...boxes.map(b => b.y)), b: Math.max(...boxes.map(b => b.y + b.h))})

/** The camera that brings boxes into view with the margin (fitViewport): centre and zoom percent. Undefined with no boxes. */
function fit(boxes: readonly Item[]): Look | undefined {
  if (!boxes.length) return undefined
  const e = bounds(boxes), z = Math.min((PANE.w - 2 * FIT_MARGIN) / Math.max(e.r - e.l, 1), (PANE.h - 2 * FIT_MARGIN) / Math.max(e.b - e.t, 1))
  return {cx: (e.l + e.r) / 2, cy: (e.t + e.b) / 2, zoom: clampTo(ZOOM.min, ZOOM.max, z * 100)}
}
const moveTo = (set: SetFn, c: Look) => { set('cx', Math.round(c.cx)); set('cy', Math.round(c.cy)); set('zoom', Math.round(c.zoom * 10) / 10) }

/** The pane's rectangle on the board, from the camera (navigationViewport): the pane over the zoom. */
const view = (l: Look) => { const z = l.zoom / 100; return {x: l.cx - PANE.w / z / 2, y: l.cy - PANE.h / z / 2, w: PANE.w / z, h: PANE.h / z} }

/** What a well says where the picture has no reading to draw from. */
function Missing({w, h, say, size}: {w: number; h: number; say: readonly string[]; size?: number}) {
  const lead = (size ?? 9) + 2
  return <text x={w / 2} y={h / 2 - ((say.length - 1) * lead) / 2 + 3} textAnchor="middle" className="dp-ink-dim" style={size ? {font: `${size}px var(--font-ui, sans-serif)`} : undefined}>
    {say.map((s, i) => <tspan key={i} x={w / 2} dy={i ? lead : 0}>{s}</tspan>)}
  </text>
}

// ---------------------------------------------------------------- the minimap: the owner's own picture

/** The minimap's projection (projectNavigationMinimap): every box fitted to the well with 8 px of padding, centred. */
function project(boxes: readonly Item[], w: number, h: number, pad = 8) {
  const e = bounds(boxes), scale = Math.min((w - 2 * pad) / Math.max(e.r - e.l, 1), (h - 2 * pad) / Math.max(e.b - e.t, 1))
  const ox = w / 2 - (e.l + e.r) * scale / 2, oy = h / 2 - (e.t + e.b) * scale / 2
  return {scale, px: (x: number) => ox + x * scale, py: (y: number) => oy + y * scale, bx: (x: number) => (x - ox) / scale, by: (y: number) => (y - oy) / scale}
}
type Projection = ReturnType<typeof project>

/** The pane as a rectangle in the well. Handle 1 pans the pane; handle 2 (whole only) sets the zoom from the pane's corner. */
function Pane({p, pr, look, boxes, w, h, handles}: {p: ViewProps; pr: Projection; look: Look; boxes: readonly Item[]; w: number; h: number; handles: 0 | 1 | 2}) {
  const r = view(look), x0 = pr.px(r.x), y0 = pr.py(r.y), x1 = pr.px(r.x + r.w), y1 = pr.py(r.y + r.h)
  const mid = {x: (x0 + x1) / 2, y: (y0 + y1) / 2}
  const clampPx = (x: number, y: number) => ({x: clampTo(6, w - 6, x), y: clampTo(6, h - 6, y)})
  const corner = clampPx(x1, y1), pan = clampPx(mid.x, mid.y)
  const moves = st(p, 'cx').disabled || st(p, 'cy').disabled, zooms = st(p, 'zoom').disabled
  return <>
    <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} className="dp-curve-on" style={{strokeWidth: 1.2}} />
    <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} className="dp-fill-on" />
    {handles >= 1 && <Handle n={1} x={pan.x} y={pan.y} label="Pane" does="Drag: moves the pane over the board. The zoom stays."
      onDrag={moves ? undefined : (x, y) => { p.set('cx', Math.round(pr.bx(clampTo(0, w, x)))); p.set('cy', Math.round(pr.by(clampTo(0, h, y)))) }}
      onReset={moves ? undefined : () => { const f = fit(boxes); if (f) moveTo(p.set, f) }} />}
    {handles === 2 && <Handle n={2} shape="ring" x={corner.x} y={corner.y} label="Zoom" does="Drag the pane's corner out to zoom out, in to zoom in."
      onDrag={zooms ? undefined : (x, y) => {
        const half = Math.max(Math.abs(x - mid.x), Math.abs(y - mid.y) * PANE.w / PANE.h) / pr.scale
        p.set('zoom', Math.round(clampTo(ZOOM.min, ZOOM.max, PANE.w / (2 * Math.max(half, 1)) * 100) * 10) / 10)
      }} onReset={zooms ? undefined : () => p.set('zoom', 100)} />}
  </>
}

/** The board as the minimap draws it: grid dots when Grid snap is on, a line between box centres, each item as a box, the pane as a
 * rectangle. Without the owner's items the well says so; without a camera it draws the board and says that. */
function Overview({p, w, h, handles}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2}) {
  const v = p.v, boxes = items(v)
  if (!boxes) return <Missing w={w} h={h} say={['No reading', 'of the items']} />
  if (!boxes.length) return <Missing w={w} h={h} say={['No items', 'on the board']} />
  const pr = project(boxes, w, h), sel = new Set(selected(v)), look = lookOf(v)
  const raw = linesOf(v), ends = raw ? joined(raw, boxes) : []
  const grid: [number, number][] = []
  if (boolOf(v, 'grid') === true && pr.scale * GRID > 6) {
    const e = bounds(boxes)
    for (let gx = Math.ceil(e.l / GRID) * GRID; gx <= e.r; gx += GRID) for (let gy = Math.ceil(e.t / GRID) * GRID; gy <= e.b; gy += GRID) grid.push([gx, gy])
  }
  const centre = (b: Item) => [pr.px(b.x + b.w / 2), pr.py(b.y + b.h / 2)] as const
  return <>
    {grid.map(([gx, gy]) => <circle key={`${gx}:${gy}`} cx={pr.px(gx)} cy={pr.py(gy)} r={.7} fill="var(--text-faint, #71767c)" opacity={.6} />)}
    {ends.map((e, i) => {
      if (!e) return null
      const [ax, ay] = centre(e[0]), [bx, by] = centre(e[1])
      return <path key={i} d={`M${ax} ${ay}L${bx} ${by}`} className={i === 0 ? 'dp-curve' : 'dp-faint'} style={i === 0 ? {strokeWidth: 1} : undefined} />
    })}
    {boxes.map((b, i) => {
      const on_ = sel.has(b.id), paper = b.kind === 'sticky' ? own(PALETTE, stickyOf(v, b.id)) : undefined
      return <rect key={`${i}:${b.id}`} x={pr.px(b.x)} y={pr.py(b.y)} width={Math.max(2, b.w * pr.scale)} height={Math.max(2, b.h * pr.scale)} rx={1}
        style={{fill: b.kind === 'sticky' ? paper ?? 'none' : b.tint ? `color-mix(in srgb, ${b.tint} 45%, transparent)` : 'none',
          stroke: on_ ? 'var(--dp-on)' : b.kind === 'card' && b.tint ? b.tint : 'var(--text-faint, #71767c)', strokeWidth: on_ ? 1.4 : 1, opacity: b.kind === 'sticky' ? .85 : 1}} />
    })}
    {look ? <Pane p={p} pr={pr} look={look} boxes={boxes} w={w} h={h} handles={handles} /> : <text x={6} y={12} className="dp-axis">No camera reading</text>}
  </>
}

function BoardDisplay({p, w, h, handles = 1}: {p: ViewProps; w: number; h: number; handles?: 1 | 2}) {
  const mode = modeOf(p.v)
  return <Display w={w} h={h} label="The board" does="Every item as a box, the pane as a rectangle. Drag handle 1 to move the pane. Grid dots show when Grid snap is on."
    corner={zoomText(p.v)}>
    <Overview p={p} w={w} h={h} handles={handles} />
    {mode && mode.value !== 'select' && <text x={6} y={h - 6} className="dp-ink-dim">{mode.label}</text>}
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
/** The side a binding names, or the facing side where it is Auto or not read. */
const sideOf = (s: string | undefined, facingSide: Side): Side => (s === 'top' || s === 'right' || s === 'bottom' || s === 'left' ? s : facingSide)
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

/** The selected line (the first) between its two cards: its kind, the sides it binds to, its label, its direction. Handles 1 and 2 snap
 * to a side. A line, a kind or a binding the owner does not report is named in the well, not drawn. */
function LineDisplay({p}: {p: ViewProps}) {
  const v = p.v, boxes = items(v), raw = linesOf(v), first = boxes && raw ? joined(raw, boxes)[0] : undefined
  const does = 'The selected line between its two cards, routed as the board routes it. Drag handle 1 or 2 to a side of its card to bind that end.'
  if (!first) return <Display w={194} h={146} label="The line" does={does} corner={NONE}>
    <Missing w={194} h={146} say={!raw ? ['No reading', 'of the lines'] : !boxes ? ['No reading', 'of the items'] : ['No line', 'to show']} />
  </Display>
  const [A, B] = first
  const a: Box = {x: 12, y: 84, w: 54, h: 40}, b: Box = {x: 112, y: 22, w: 54, h: 40}
  const kind = strOf(v, 'lineKind'), from = strOf(v, 'fromSide'), to = strOf(v, 'toSide'), label = strOf(v, 'label')
  const [fa, fb] = facing(a, b), sa = sideOf(from, fa), sb = sideOf(to, fb)
  const r = kind !== undefined && from !== undefined && to !== undefined ? route(kind, a, b, sa, sb) : undefined
  const nearest = (box: Box, x: number, y: number) => (['top', 'right', 'bottom', 'left'] as Side[]).reduce((best, s) => (Math.hypot(at(box, s)[0] - x, at(box, s)[1] - y) < Math.hypot(at(box, best)[0] - x, at(box, best)[1] - y) ? s : best))
  const card = (box: Box, it: Item, i: number) => {
    const tint = it.tint ?? 'var(--text-faint, #71767c)'
    return <g key={i}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3} style={{fill: `color-mix(in srgb, ${tint} 40%, transparent)`, stroke: tint}} />
      <text x={box.x + box.w / 2} y={box.y + box.h / 2 + 3} textAnchor="middle" className="dp-ink">{clip(it.name, 8)}</text>
      {(['top', 'right', 'bottom', 'left'] as Side[]).map(s => <circle key={s} cx={at(box, s)[0]} cy={at(box, s)[1]} r={1.6} fill="var(--text-faint, #71767c)" />)}
    </g>
  }
  const fromOff = st(p, 'fromSide').disabled, toOff = st(p, 'toSide').disabled
  return <Display w={194} h={146} label="The line" does={does} corner={`${clip(A.name, 10)} → ${clip(B.name, 10)}`}>
    {card(a, A, 0)}{card(b, B, 1)}
    {r && <path d={r.d} className="dp-curve" style={{strokeWidth: 1.5}} />}
    {r && strOf(v, 'direction') === 'directed' && <path d={arrow(r.p2, r.head, 6)} fill="var(--dp-value)" />}
    {r && label && <text x={r.mid[0]} y={r.mid[1] - 6} textAnchor="middle" className="dp-ink" style={{paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 3}}>{label}</text>}
    {!r && <text x={97} y={74} textAnchor="middle" className="dp-ink-dim">No reading of the path</text>}
    <text x={6} y={140} className="dp-axis">{kind ?? NONE}</text>
    {r && <Handle n={1} x={r.p1[0]} y={r.p1[1]} label="Start" does="Drag to a side of the first card: the line leaves from that side."
      onDrag={fromOff ? undefined : (x, y) => p.set('fromSide', nearest(a, x, y))} onReset={fromOff ? undefined : () => p.set('fromSide', 'auto')} />}
    {r && <Handle n={2} shape="ring" x={r.p2[0]} y={r.p2[1]} label="End" does="Drag to a side of the second card: the line arrives at that side."
      onDrag={toOff ? undefined : (x, y) => p.set('toSide', nearest(b, x, y))} onReset={toOff ? undefined : () => p.set('toSide', 'auto')} />}
  </Display>
}

// ---------------------------------------------------------------- the pane at full size

/** The board in the pane: frames, lines, cards, the sticky note, the last object added; the pane is what the camera frames. */
function World({v}: {v: V}) {
  const boxes = items(v), look = lookOf(v)
  if (!boxes) return <Missing w={PANE.w} h={PANE.h} size={14} say={['No reading of the items']} />
  if (!look) return <Missing w={PANE.w} h={PANE.h} size={14} say={['No reading of the camera']} />
  if (!boxes.length) return <Missing w={PANE.w} h={PANE.h} size={14} say={['No items on the board']} />
  const by = new Map(boxes.map(b => [b.id, b] as const)), sel = new Set(selected(v)), z = look.zoom / 100
  const raw = linesOf(v), ends = raw ? joined(raw, boxes) : []
  const kind = strOf(v, 'lineKind'), from = strOf(v, 'fromSide'), to = strOf(v, 'toSide'), label = strOf(v, 'label')
  const stroke = (id: string) => (sel.has(id) ? 'var(--dp-on)' : undefined)
  const grid: [number, number][] = []
  if (boolOf(v, 'grid') === true && GRID * z > 18) {
    const r = view(look)
    for (let gx = Math.ceil(r.x / GRID) * GRID; gx <= r.x + r.w; gx += GRID) for (let gy = Math.ceil(r.y / GRID) * GRID; gy <= r.y + r.h; gy += GRID) grid.push([gx, gy])
  }
  return <g transform={`translate(${PANE.w / 2 - look.cx * z} ${PANE.h / 2 - look.cy * z}) scale(${z})`}>
    {grid.map(([gx, gy]) => <circle key={`${gx}:${gy}`} cx={gx} cy={gy} r={1.4 / z} fill="var(--text-faint, #71767c)" opacity={.55} />)}
    {framesOf(v).map((f, i) => {
      const inside = f.members.map(id => by.get(id)).filter((b): b is Item => b !== undefined)
      if (!inside.length) return null
      const e = bounds(inside), pad = 16
      return <g key={i}><rect x={e.l - pad} y={e.t - pad} width={e.r - e.l + 2 * pad} height={e.b - e.t + 2 * pad} rx={6} fill="color-mix(in srgb, var(--text) 4%, transparent)"
        stroke="var(--text-faint, #71767c)" strokeWidth={1.2 / z} strokeDasharray={`${4 / z} ${3 / z}`} />
        <text x={e.l - pad + 2} y={e.t - pad - 7} style={{fill: 'var(--text-dim)', font: '13px var(--font-ui, sans-serif)'}}>{clip(f.title, 40)}</text></g>
    })}
    {ends.map((e, i) => {
      if (!e) return null
      const [A, B] = e, first = i === 0, [fa, fb] = facing(A, B)
      const sa = sideOf(first ? from : undefined, fa), sb = sideOf(first ? to : undefined, fb)
      const r = route(first ? kind ?? 'curved' : 'curved', A, B, sa, sb), head = !first || strOf(v, 'direction') === 'directed'
      return <g key={i}>
        <path d={r.d} fill="none" stroke={first ? 'var(--dp-value)' : 'var(--text-dim)'} strokeWidth={(first ? 2 : 1.4) / z} />
        {head && <path d={arrow(r.p2, r.head, 11)} fill={first ? 'var(--dp-value)' : 'var(--text-dim)'} />}
        {first && label && <text x={r.mid[0]} y={r.mid[1] - 8} textAnchor="middle" style={{fill: 'var(--text)', font: '13px var(--font-ui, sans-serif)', paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 4}}>{label}</text>}
      </g>
    })}
    {boxes.map((b, i) => <g key={`${i}:${b.id}`}>
      {b.kind === 'card' && <>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} style={{fill: `color-mix(in srgb, ${b.tint ?? 'var(--text-faint, #71767c)'} 22%, var(--dp-well))`, stroke: stroke(b.id) ?? b.tint ?? 'var(--text-faint, #71767c)', strokeWidth: (sel.has(b.id) ? 2.4 : 1.4) / z}} />
        {b.glyph && <text x={b.x + b.w / 2} y={b.y + 44} textAnchor="middle" style={{fill: b.tint ?? 'var(--text-dim)', font: '28px var(--font-ui, sans-serif)'}}>{b.glyph}</text>}
        <text x={b.x + b.w / 2} y={b.y + 74} textAnchor="middle" style={{fill: 'var(--text)', font: '14px var(--font-ui, sans-serif)'}}>{clip(b.name, Math.max(3, Math.floor(b.w / 7.5)))}</text>
      </>}
      {b.kind === 'sticky' && (() => {
        const paper = own(PALETTE, stickyOf(v, b.id)), ink = paper ? '#3d3a2e' : 'var(--text)', added = b.id === 'added'
        const size = added ? 16 : 17, first = added ? 28 : 30, room = Math.max(1, Math.floor((b.h - first) / 24) + 1)
        const text = wrap(b.name, Math.round(b.w / 16)), shownLines = text.slice(0, room).map((l, k, all) => (k === all.length - 1 && text.length > room ? `${l}…` : l))
        return <>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={3} style={{fill: paper ?? 'none', stroke: stroke(b.id) ?? (paper ? undefined : 'var(--text-faint, #71767c)'), strokeWidth: 2.4 / z}} />
          {shownLines.map((l, k) => <text key={k} x={b.x + 14} y={b.y + first + k * 24} style={{fill: ink, font: `${size}px var(--font-ui, sans-serif)`}}>{l}</text>)}
        </>
      })()}
      {b.kind === 'shape' && (() => {
        const fill = fillOf(v), edge = stroke(b.id) ?? '#74766b', width = (sel.has(b.id) ? 2.4 : 1.35) / z
        return <>
          {b.shape === 'ellipse' ? <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={fill} stroke={edge} strokeWidth={width} />
            : b.shape === 'diamond' ? <path d={`M${b.x + b.w / 2} ${b.y}L${b.x + b.w} ${b.y + b.h / 2}L${b.x + b.w / 2} ${b.y + b.h}L${b.x} ${b.y + b.h / 2}Z`} fill={fill} stroke={edge} strokeWidth={width} />
            : <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={fill} stroke={edge} strokeWidth={width} />}
          <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 5} textAnchor="middle" style={{fill: fill !== 'none' ? '#3d3a2e' : 'var(--text-dim)', font: '15px var(--font-ui, sans-serif)'}}>{clip(b.name, Math.max(3, Math.floor(b.w / 8)))}</text>
        </>
      })()}
      {b.kind === 'text' && <text x={b.x + 6} y={b.y + 32} style={{fill: 'var(--text)', font: '20px var(--font-ui, sans-serif)'}}>{b.name}</text>}
    </g>)}
  </g>
}

// ---------------------------------------------------------------- readings and the head

// The light reads the owner alone (manual §16.9): lit or dark when it reports, hollow when it has not.
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
/** What the one selected item is, for the Colour control: a sticky note takes a palette colour, a shape takes a fill. */
const pickedKind = (v: V): 'sticky' | 'shape' | undefined => {
  const ids = selected(v), kind = ids.length === 1 ? items(v)?.find(b => b.id === ids[0])?.kind : undefined
  return kind === 'sticky' || kind === 'shape' ? kind : undefined
}
const labelOf = (v: V) => { const l = strOf(v, 'label'); return l === undefined ? undefined : l || 'none' }
const span2 = (node: ReactNode) => <div style={{gridColumn: 'span 2', width: '100%'}}>{node}</div>
const span3 = (node: ReactNode) => <div style={{gridColumn: 'span 3', width: '100%'}}>{node}</div>
/** The standing of an act that moves several keys: the first of them the owner holds disabled, else the first's. */
const standOf = (p: ViewProps, ...keys: string[]): Standing => keys.map(k => st(p, k)).find(s => s.disabled) ?? st(p, keys[0]!)

// ---------------------------------------------------------------- controls, each in one place

const mode = (p: ViewProps) => <Radio {...st(p, 'mode')} label="Mode" does="Chooses what a drag does on the board: select, box select, draw or erase." value={strOf(p.v, 'mode') ?? ''} options={MODES} stack onChange={x => p.set('mode', x)} />
const zoom = (p: ViewProps) => <Dial {...st(p, 'zoom')} label="Zoom" does="Sets how large the board looks in the pane. Fit all brings the whole board into view." value={numOf(p.v, 'zoom') ?? NaN} def={100} scale={ZOOM}
  format={x => `${Math.round(x)} %`} onChange={x => p.set('zoom', x)} />
const toggle = (p: ViewProps, key: string, label: string, does: string) => {
  const now = boolOf(p.v, key)
  return <Toggle {...st(p, key)} label={label} does={does} on={now === true} unknown={now === undefined} onChange={x => p.set(key, x)} />
}
const grid = (p: ViewProps) => toggle(p, 'grid', 'Grid', 'Snaps a dragged item to the grid. Alignment guides show whether the grid is on or off.')
const fitAll = (p: ViewProps) => {
  const boxes = items(p.v), look = boxes && fit(boxes), s = standOf(p, 'zoom', 'cx', 'cy')
  return <Action {...s} label="Fit all" does="Brings every item into view with a margin."
    disabled={s.disabled ?? (boxes === undefined ? 'No reading of the items.' : look ? undefined : 'There are no items to fit.')} onPress={() => { if (look) moveTo(p.set, look) }} />
}
const fitSel = (p: ViewProps) => {
  const boxes = items(p.v), picked = boxes?.filter(b => selected(p.v).includes(b.id)), look = picked && fit(picked), s = standOf(p, 'zoom', 'cx', 'cy')
  return <Action {...s} label="Fit sel." does="Brings the selected items into view with a margin."
    disabled={s.disabled ?? (boxes === undefined ? 'No reading of the items.' : look ? undefined : 'Select an item first.')} onPress={() => { if (look) moveTo(p.set, look) }} />
}

const viewOptions = (v: V) => {
  const lower = reported(v)?.[0]
  return [{value: '', label: 'None'}, {value: 'everything', label: 'Everything'}, ...(lower ? [{value: 'lower', label: lower.title}] : []), ...(boolOf(v, 'mine') === true ? [{value: 'mine', label: 'Mine'}] : [])]
}
const viewChooser = (p: ViewProps) => <Chooser {...st(p, 'view')} label="View" does="Applies a saved view: the camera and the selection. The Canvas names any item that left since you saved it."
  value={strOf(p.v, 'view') ?? NONE} options={viewOptions(p.v)} onChange={x => {
    p.set('view', x)
    const boxes = items(p.v)
    if (x === 'mine') {
      const cx = finiteOf(p.v, 'mineX'), cy = finiteOf(p.v, 'mineY'), zoom = finiteOf(p.v, 'mineZ')
      if (cx !== undefined && cy !== undefined && zoom !== undefined && zoom > 0) moveTo(p.set, {cx, cy, zoom})
    } else if (boxes) {
      const look = x === 'everything' ? fit(boxes) : x === 'lower' ? fit(boxes.filter(b => reported(p.v)?.[0]?.members.includes(b.id))) : undefined
      if (look) moveTo(p.set, look)
    }
  }} />
const saveView = (p: ViewProps) => {
  const look = lookOf(p.v), s = st(p, 'mine')
  return <Action {...s} label="Save view" does="Keeps the camera and the selection under a name." disabled={s.disabled ?? (look ? undefined : 'No reading of the camera.')}
    onPress={() => { if (!look) return; p.set('mine', true); p.set('mineX', look.cx); p.set('mineY', look.cy); p.set('mineZ', look.zoom); p.set('view', 'mine') }} />
}
const saved = (p: ViewProps) => {
  const now = strOf(p.v, 'save')
  return <Readout label="save" does="Saves a short time after each change. It shows saved, saving or held." value={own(SAVE, now)}
    tone={now === 'held' ? 'stall' : now === 'saved' ? 'green' : undefined} />
}

const add = (p: ViewProps) => {
  const look = lookOf(p.v), s = st(p, 'add')
  return <Chooser {...s} label="Add" does="Adds the chosen object at the centre of the pane: a sticky note, a shape or text." value={strOf(p.v, 'add') ?? ''} options={CHOICES}
    disabled={s.disabled ?? (look ? undefined : 'No reading of the camera.')}
    onChange={x => {
      const o = own(OBJECTS, x)
      if (!o || !look) return
      p.set('add', x); p.set('added', x); p.set('colourAdded', 'amber'); p.set('shapeFill', ''); p.set('addX', Math.round(look.cx - o.w / 2)); p.set('addY', Math.round(look.cy - o.h / 2)); p.set('sel', 'added')
    }} />
}
const colour = (p: ViewProps) => {
  const kind = pickedKind(p.v), key = kind === 'shape' ? 'shapeFill' : selected(p.v)[0] === 'added' ? 'colourAdded' : 'colour', s = st(p, key)
  return <Chooser {...s} label="Colour" does="Sets the colour of the selected sticky note, or the fill of the selected shape."
    value={(kind === 'shape' ? strOf(p.v, 'shapeFill') : stickyOf(p.v, selected(p.v)[0] ?? '')) ?? ''} options={COLOURS}
    disabled={s.disabled ?? (kind ? undefined : items(p.v) === undefined ? 'No reading of the items.' : 'Select one sticky note or shape first.')}
    onChange={x => p.set(key, x)} />
}
const minimap = (p: ViewProps) => toggle(p, 'minimap', 'Minimap', 'Shows the minimap in the corner of the pane. Click the minimap to jump there.')
const frame = (p: ViewProps) => {
  const s = st(p, 'frame2'), hand = strOf(p.v, 'frame2')
  return <Action {...s} label="Frame" does="Draws a frame round the selected cards."
    disabled={s.disabled ?? (hand ? 'These cards are framed.' : selected(p.v).length >= 2 ? undefined : 'Select two or more cards first.')}
    onPress={() => p.set('frame2', selected(p.v).join(','))} />
}
const find = (p: ViewProps) => <Action {...st(p, 'find')} label="Find" does="Opens the find box. It searches card text and frame titles, then centres the match." onPress={() => p.set('find', true)} />
const present = (p: ViewProps) => {
  const n = frameCount(p.v), s = st(p, 'present')
  return <Action {...s} label="Present" does="Shows the frames in order, full screen. Esc leaves."
    disabled={s.disabled ?? (n === undefined ? 'No reading of the frames.' : n > 0 ? undefined : 'Add a frame first.')} onPress={() => p.set('present', true)} />
}

const kind = (p: ViewProps) => <Radio {...st(p, 'lineKind')} label="Kind" does="Sets the path of the selected line: straight, curved or elbow." value={strOf(p.v, 'lineKind') ?? ''} options={KINDS} stack onChange={x => p.set('lineKind', x)} />
const sideFrom = (p: ViewProps) => <Chooser {...st(p, 'fromSide')} label="From" does="Binds the start of the selected line to a side of its card. Auto picks the facing side." value={strOf(p.v, 'fromSide') ?? ''} options={SIDES} onChange={x => p.set('fromSide', x)} />
const sideTo = (p: ViewProps) => <Chooser {...st(p, 'toSide')} label="To" does="Binds the end of the selected line to a side of its card. Auto picks the facing side." value={strOf(p.v, 'toSide') ?? ''} options={SIDES} onChange={x => p.set('toSide', x)} />
const direction = (p: ViewProps) => <Radio {...st(p, 'direction')} label="Direction" does="Sets whether the relation points one way. The setting applies when you promote the line." value={strOf(p.v, 'direction') ?? ''} options={DIRECTIONS} stack onChange={x => p.set('direction', x)} />
const promote = (p: ViewProps) => {
  const state = strOf(p.v, 'promote'), s = st(p, 'promote'), n = linesOf(p.v)?.length
  return <Action {...s} label="Promote" does="Sends the selected line to its owner as a relation. The owner may refuse."
    disabled={s.disabled ?? (state === 'recorded' ? 'The owner has recorded this relation.' : n === undefined ? 'No reading of the lines.' : n > 0 ? undefined : 'There is no line to promote.')}
    refused={s.refused ?? (state === 'refused' ? strOf(p.v, 'refusal') ?? 'The owner gave no reason.' : undefined)}
    onPress={() => p.set('promote', true)} />
}
const standing = (p: ViewProps) => <Chooser {...st(p, 'standing')} label="Standing" does="The standing of the next relation: fact, claim, inference or guess." value={strOf(p.v, 'standing') ?? ''} options={STANDINGS}
  disabled={st(p, 'standing').disabled ?? 'No owner records a standing on a line.'} />

/** The numbers beside the picture: what the board holds, by the owner's reading. */
const itemCount = (v: V) => items(v)?.length
const lineCount = (v: V) => linesOf(v)?.length

const defaults = {
  light: 'lit', mode: 'select', grid: false, add: 'sticky', colour: 'amber', minimap: true,
  zoom: 100, cx: 100, cy: 130, view: '', mine: false, mineX: 0, mineY: 0, mineZ: 100,
  lineKind: 'curved', fromSide: 'auto', toSide: 'auto', direction: 'directed', standing: '', promote: 'ready', refusal: '',
  sel: 'question', colourAdded: 'amber', shapeFill: '', frame2: '', added: '', addX: 0, addY: 0,
  // The board, as the owner reports it: the Seven centres (each card its entity's size, .235 of 400 units), the question sticky, the
  // lines between neighbouring centres root to crown (the first is the selected one) and the frame round the lower three.
  items: JSON.stringify([
    {id: 'Root', kind: 'card', x: 60, y: 240, w: 94, h: 94, name: 'Root', glyph: '△', tint: '#a94138'},
    {id: 'Sacral', kind: 'card', x: 230, y: 160, w: 94, h: 94, name: 'Sacral', glyph: '◯', tint: '#c67c46'},
    {id: 'Solar', kind: 'card', x: 60, y: 80, w: 94, h: 94, name: 'Solar', glyph: '△', tint: '#c2a852'},
    {id: 'Heart', kind: 'card', x: 230, y: 0, w: 94, h: 94, name: 'Heart', glyph: '✧', tint: '#638c69'},
    {id: 'Throat', kind: 'card', x: 60, y: -80, w: 94, h: 94, name: 'Throat', glyph: '◯', tint: '#5898a4'},
    {id: 'Brow', kind: 'card', x: 230, y: -160, w: 94, h: 94, name: 'Brow', glyph: '∞', tint: '#737599'},
    {id: 'Crown', kind: 'card', x: 60, y: -240, w: 94, h: 94, name: 'Crown', glyph: '✧', tint: '#a590b0'},
    {id: 'question', kind: 'sticky', x: -250, y: 20, w: 220, h: 180, name: 'Which centre speaks first?'},
  ]),
  lines: JSON.stringify([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]),
  frames: JSON.stringify([{title: 'Lower three', members: ['Root', 'Sacral', 'Solar']}]),
  // Readings: what the device reports, never set from here.
  label: 'rises to', save: 'saved', waiting: 4,
}

export const design: DesignedDevice = {
  id: 'techne:canvas',
  title: 'Canvas',
  kind: 'instrument',
  firstPage: 'board',
  defaults,
  fixtures: {
    'Seven centres': {},
    'A refused line, bound as an elbow': {promote: 'refused', refusal: 'Open the native Scene before recording a relationship.', lineKind: 'elbow', fromSide: 'right', toSide: 'right'},
    'Two cards selected': {sel: 'Heart,Throat'},
    'No readings': Object.fromEntries(Object.keys(defaults).map(k => [k, undefined])),
  },

  folded: p => <Folded title="Canvas" light={light(p)} readings={[waiting(p.v) === undefined ? NONE : `${waiting(p.v)} wait`, zoomText(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Canvas" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><BoardDisplay p={p} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>{mode(p)}{zoom(p)}{grid(p)}{fitAll(p)}</Section>
  </Panel>,

  whole: p => <Panel title="Canvas" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'board', label: 'Board'}, {id: 'lines', label: 'Lines'}]} page={p.page} onPage={p.setPage}>
    {p.page === 'lines' ? <>
      <Band>
        <Section width={206}><LineDisplay p={p} /></Section>
        <Section label="Path" cols={2} grow>
          {kind(p)}
          <div style={{display: 'flex', flexDirection: 'column', gap: 4, width: '100%'}}>{sideFrom(p)}{sideTo(p)}</div>
          <Readout label="label" does="The text at the middle of the line. Write it in the line's panel on the board." value={labelOf(p.v)} />
        </Section>
      </Band>
      <Band>
        <Section label="Relation" cols={3}>
          {span3(<Readout label="relation" does="The name of the relation. It starts as the line's label. Name it in the line's panel before you promote." value={labelOf(p.v)} />)}
          {span2(direction(p))}
          {span3(standing(p))}
        </Section>
        <Section label="Promote" cols={2} grow>
          {promote(p)}
          <Readout big label="wait" does="Lines you drew that no owner has recorded as relations." value={waiting(p.v)} tone="accent" />
          <Readout label="lines" does="Lines on the board." value={lineCount(p.v)} />
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={206}><BoardDisplay p={p} w={194} h={146} handles={2} /></Section>
        <Section label="Pointer" cols={2} grow>
          {mode(p)}{zoom(p)}{grid(p)}{minimap(p)}
        </Section>
      </Band>
      <Band>
        <Section label="Add" cols={2}>
          {span2(add(p))}{span2(colour(p))}{frame(p)}{find(p)}
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

  full: p => {
    const m = modeOf(p.v), n = itemCount(p.v), w = waiting(p.v)
    const status = [m && m.value !== 'select' ? m.label : undefined, zoomText(p.v), `${n ?? NONE} items`, `${w ?? NONE} lines wait for their owner`].filter(Boolean).join(' · ')
    const label: CSSProperties = {fill: 'var(--text-dim)', font: '12px var(--font-ui, sans-serif)'}
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox={`0 0 ${PANE.w} ${PANE.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The Canvas">
        <g className="dp-display" style={{background: 'none'}}>
          <defs><clipPath id="canvas-pane"><rect width={PANE.w} height={PANE.h} /></clipPath></defs>
          <g clipPath="url(#canvas-pane)"><World v={p.v} /></g>
          <text x={14} y={24} style={label}>{status}</text>
          {boolOf(p.v, 'minimap') === true && <g transform={`translate(${PANE.w - 152} ${PANE.h - 118})`}>
            <rect width={140} height={106} rx={3} style={{fill: 'var(--dp-well)', stroke: 'var(--line, #24262a)', strokeWidth: 1}} opacity={.95} />
            <Overview p={p} w={140} h={106} handles={0} />
          </g>}
        </g>
      </svg>
    </div>
  },

  widget: p => <Tile title="Canvas" light={light(p)} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="The board" does="Every item as a box, the pane as a rectangle. Click ⤢ to open the Canvas in the pane that has focus.">
      <Overview p={p} w={112} h={104} handles={0} />
    </Display>
    <div className="ref-tile-counts">
      <Readout big label="items" does="Cards, notes and shapes on the board." value={itemCount(p.v)} />
      <Readout big label="lines" does="Lines on the board." value={lineCount(p.v)} tone="value" />
      <Readout big label="wait" does="Lines that no owner has recorded as relations." value={waiting(p.v)} tone="accent" />
    </div>
  </Tile>,
}
