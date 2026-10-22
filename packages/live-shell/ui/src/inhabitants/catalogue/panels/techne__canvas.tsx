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
//
// The Form page gives the board the shape of a whole: a constellation. The forms are AIKit's (ai-kit
// crates/aikit-adapters/src/wiki_shape_catalog.rs, over the QL shape contract), each a set of roles — a position 0–5, direct or
// conjugate (′) — around one whole. `whole` is the card at the centre, `roles` maps each role to the card on it (a JSON object), and
// Layout draws the board in the form (Technē's Canvas/Constellation: QL-MEF adapters/techne/.../canvas/layout.ts, the sixfold from
// the top, clockwise, at 60°; radial when no form is chosen). Check runs the form's structural floor and Declare writes it as a
// WikiFrame (`aikit wiki-shape validate` and `declare`); Fold proves a full sixfold and its conjugate fold into one (`compress`).
// Suggest asks the Decision helper (ai-kit:decision-helper) which open role the selected card takes; its answer stands dashed in
// `suggested` until you accept it. The roles a person sets are presentation until Declare: the owner writes the constellation.
//
// The settings of the next thing you make (manual §17.4 "Parameters"): tool (select · frame · relate · note · shape · text), snap (off ·
// grid · guides), shape (rectangle · ellipse · diamond), colour (the next sticky's colour), lineKind (straight · curved · elbow), label
// (the selected line's label), relation (echo · influence · cause · transform) and standing (fact · claim · inference · guess) of the next
// line, minimap, autosave, view. A line may carry its standing as a third element ([from, to, standing]).
//
// The Light page (§17.4 "The Light page", which took in the Light device of §17.10): an optical bench laid over the board, to see how
// much of a source's force reaches a conclusion through the chain of lines you drew. Its engine is LightBox's (optics/raytracer.ts
// traceRays over the Canvas positions, nothing random); the bench here draws the same law:
//   - light leaves the source card and follows the lines you drew, up to Bounces lines deep;
//   - a card shares the light it receives equally among its lines out, so a conclusion never holds more force than its source gave;
//   - a line passes the share its standing allows (Transmission) and loses to its length, e^(−length / 4000 canvas units);
//   - an element on a card changes what leaves it: a funnel sends all of it down the line out that passes the most, a prism fans it into
//     the Spectrum's bands, a mirror sends it back along the line it came by, an absorber keeps a quarter, a stop ends it, a sensor reads
//     what arrives and ends it.
// Its keys: light.on, light.source, light.card (the card whose element you set), light.elements ([{at, kind}]), light.bounces (1..100,
// 35), light.segments (500..20000, 4500), light.spectrum (5 | 9 | 13), light.rays; tx.fact, tx.claim, tx.inference, tx.guess (0..100 %
// each: 100, 85, 60, 35); sensor.power, the engine's readings [{at, power}]. A ray is a picture: it never becomes a relation.
import type {CSSProperties, ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, ValueBox, type LightState, type RowItem, type Standing} from '../../sdk/panel'
import {NONE, boolOf, clampTo, grown, has, json, numOf, pct, st, strOf, type DesignedDevice, type ViewProps} from './design'

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

/** The shapes the Shape tool makes (canvasShapes.ts CANVAS_TOOL_SPEC). */
const SHAPES = [{value: 'rectangle', label: 'Rectangle', does: 'The next shape is a rectangle.'}, {value: 'ellipse', label: 'Ellipse', does: 'The next shape is an ellipse.'},
  {value: 'diamond', label: 'Diamond', does: 'The next shape is a diamond.'}] as const
/** The palette (researchInstrumentStyles.css --canvas-object-*). */
const PALETTE: Record<string, string> = {amber: '#f1e4bf', sage: '#dbe6d3', sky: '#d6e6ee', rose: '#f0d9d4', stone: '#e7e4da'}
const COLOURS = [{value: 'amber', label: 'Amber'}, {value: 'sage', label: 'Sage'}, {value: 'sky', label: 'Sky'}, {value: 'rose', label: 'Rose'}, {value: 'stone', label: 'Stone'}]
const ITEM_KINDS: readonly string[] = ['card', 'sticky', 'shape', 'text']

const TOOLS = [
  {value: 'select', label: 'Select', does: 'A click selects a card or a line. A drag moves it.'},
  {value: 'frame', label: 'Frame', does: 'A drag draws a frame round a group.'},
  {value: 'relate', label: 'Relate', does: 'A drag from one card to another draws a line: a proposal.'},
  {value: 'note', label: 'Note', does: 'A click places a sticky note.'},
  {value: 'shape', label: 'Shape', does: 'A click places a shape.'},
  {value: 'text', label: 'Text', does: 'A click places a line of text.'},
] as const
const SNAPS = [{value: 'off', label: 'Off', does: 'A dragged item goes where you leave it.'}, {value: 'grid', label: 'Grid', does: 'A dragged item settles on the grid.'},
  {value: 'guides', label: 'Guides', does: 'A dragged item settles on the guide lines of the items near it.'}] as const
const KINDS = [{value: 'straight', label: 'Straight'}, {value: 'curved', label: 'Curved'}, {value: 'elbow', label: 'Elbow'}] as const
const SIDES = [{value: 'auto', label: 'Auto'}, {value: 'top', label: 'Top'}, {value: 'right', label: 'Right'}, {value: 'bottom', label: 'Bottom'}, {value: 'left', label: 'Left'}] as const
const RELATIONS = [{value: 'echo', label: 'Echo', does: 'The two things echo each other.'}, {value: 'influence', label: 'Influence', does: 'One thing bears on the other.'},
  {value: 'cause', label: 'Cause', does: 'One thing brings the other about.'}, {value: 'transform', label: 'Transform', does: 'One thing becomes the other.'}] as const
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

/** Every item on the board, as the owner reports it. Undefined when the owner reports no items. */
function items(v: V): Item[] | undefined {
  const read = json<unknown>(v, 'items', undefined)
  if (!Array.isArray(read)) return undefined
  return read.map(itemOf).filter((b): b is Item => b !== undefined)
}
/** The lines the owner reports, each as the pair of ends it names (and its standing, where it carries one); the first is the selected
 * one. Undefined when it reports none. */
function linesOf(v: V): LineEnds[] | undefined {
  const read = json<unknown>(v, 'lines', undefined)
  if (!Array.isArray(read)) return undefined
  return read.filter((e): e is unknown[] => Array.isArray(e) && (e.length === 2 || e.length === 3) && e.slice(0, 2).every(k => finite(k) || typeof k === 'string'))
    .map(e => [e[0], e[1]] as unknown as LineEnds)
}
/** The standing each line carries, by its place in the owner's list; undefined where it carries none. */
function standingsOf(v: V): (string | undefined)[] {
  const read = json<unknown>(v, 'lines', undefined)
  return Array.isArray(read) ? read.filter(e => Array.isArray(e) && (e.length === 2 || e.length === 3)).map(e => (typeof (e as unknown[])[2] === 'string' ? (e as unknown[])[2] as string : undefined)) : []
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
/** A sticky note's paper and a shape's fill: its own tint where it names a colour of the palette. */
const paperOf = (b: Item) => own(PALETTE, b.tint)
const toolOf = (v: V) => TOOLS.find(m => m.value === strOf(v, 'tool'))
const gridOn = (v: V) => strOf(v, 'snap') === 'grid'
/** A line of a type that runs one way draws its head; an echo runs both ways. */
const directed = (v: V) => strOf(v, 'relation') !== undefined && strOf(v, 'relation') !== 'echo'
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
  const v = p.v, boxes = arranged(v, items(v))
  if (!boxes) return <Missing w={w} h={h} say={['No reading', 'of the items']} />
  if (!boxes.length) return <Missing w={w} h={h} say={['No items', 'on the board']} />
  const pr = project(boxes, w, h), sel = new Set(selected(v)), look = lookOf(v)
  const raw = linesOf(v), ends = raw ? joined(raw, boxes) : []
  const grid: [number, number][] = []
  if (gridOn(v) && pr.scale * GRID > 6) {
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
      const on_ = sel.has(b.id), paper = b.kind === 'sticky' ? paperOf(b) ?? PALETTE.amber : undefined
      return <rect key={`${i}:${b.id}`} x={pr.px(b.x)} y={pr.py(b.y)} width={Math.max(2, b.w * pr.scale)} height={Math.max(2, b.h * pr.scale)} rx={1}
        style={{fill: b.kind === 'sticky' ? paper ?? 'none' : b.tint ? `color-mix(in srgb, ${b.tint} 45%, transparent)` : 'none',
          stroke: on_ ? 'var(--dp-on)' : b.kind === 'card' && b.tint ? b.tint : 'var(--text-faint, #71767c)', strokeWidth: on_ ? 1.4 : 1, opacity: b.kind === 'sticky' ? .85 : 1}} />
    })}
    {look ? <Pane p={p} pr={pr} look={look} boxes={boxes} w={w} h={h} handles={handles} /> : <text x={6} y={12} className="dp-axis">No camera reading</text>}
  </>
}

function BoardDisplay({p, w, h, handles = 1}: {p: ViewProps; w: number; h: number; handles?: 1 | 2}) {
  const tool = toolOf(p.v)
  return <Display w={w} h={h} label="The board" does="Every item as a box, the pane as a rectangle. Drag handle 1 to move the pane. Grid dots show when Snap is Grid."
    corner={zoomText(p.v)}>
    <Overview p={p} w={w} h={h} handles={handles} />
    {tool && tool.value !== 'select' && <text x={6} y={h - 6} className="dp-ink-dim">{tool.label}</text>}
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
    {r && directed(v) && <path d={arrow(r.p2, r.head, 6)} fill="var(--dp-value)" />}
    {r && label && <text x={r.mid[0]} y={r.mid[1] - 6} textAnchor="middle" className="dp-ink" style={{paintOrder: 'stroke', stroke: 'var(--dp-well)', strokeWidth: 3}}>{label}</text>}
    {!r && <text x={97} y={74} textAnchor="middle" className="dp-ink-dim">No reading of the path</text>}
    <text x={6} y={140} className="dp-axis">{kind ?? NONE}</text>
    {r && <Handle n={1} x={r.p1[0]} y={r.p1[1]} label="Start" does="Drag to a side of the first card: the line leaves from that side."
      onDrag={fromOff ? undefined : (x, y) => p.set('fromSide', nearest(a, x, y))} onReset={fromOff ? undefined : () => p.set('fromSide', 'auto')} />}
    {r && <Handle n={2} shape="ring" x={r.p2[0]} y={r.p2[1]} label="End" does="Drag to a side of the second card: the line arrives at that side."
      onDrag={toOff ? undefined : (x, y) => p.set('toSide', nearest(b, x, y))} onReset={toOff ? undefined : () => p.set('toSide', 'auto')} />}
  </Display>
}

// ---------------------------------------------------------------- the form: the board as a constellation

const SIX = ['0', '1', '2', '3', '4', '5']
const PAIRS: Record<string, readonly (readonly [number, number])[]> = {A: [[0, 1], [2, 3], [4, 5]], B: [[1, 2], [3, 4], [5, 0]], C: [[0, 5], [1, 4], [2, 3]]}
/** AIKit's forms, in its catalogue's terms: the roles each holds. */
const FORMS: readonly {value: string; label: string; roles: readonly string[]}[] = [
  {value: 'sixfold', label: 'Sixfold', roles: SIX},
  {value: 'twelvefold', label: 'Sixfold and its conjugate', roles: [...SIX, ...SIX.map(r => `${r}′`)]},
  {value: 'threefold-123', label: 'Threefold 1–2–3', roles: ['1', '2', '3']},
  {value: 'threefold-450', label: 'Threefold 4–5–0', roles: ['4', '5', '0']},
  {value: 'fourfold', label: 'Fourfold 1–2–3–4', roles: ['1', '2', '3', '4']},
  {value: 'fourfold-ground', label: 'Fourfold and its ground', roles: ['0', '1', '2', '3', '4']},
  {value: 'fourfold-synthesis', label: 'Fourfold and its synthesis', roles: ['1', '2', '3', '4', '5']},
  ...Object.entries(PAIRS).flatMap(([family, pairs]) => pairs.map(([a, b], i) => ({value: `pair-${family}${i}`, label: `Pair ${a}/${b} · ${family}`, roles: [String(a), String(b)]}))),
]
const LAYOUTS = [
  {value: 'free', label: 'Free', does: 'The cards stand where you put them.'},
  {value: 'radial', label: 'Radial', does: 'The cards stand evenly round the whole, in the order of the board.'},
  {value: 'form', label: 'Form', does: 'Each card stands on its role in the form, round the whole.'},
] as const
const CHECK: Record<string, {label: string; tone?: 'green' | 'stall'}> = {passed: {label: 'Passed', tone: 'green'}, refused: {label: 'Refused', tone: 'stall'}}
const DECLARED: Record<string, {label: string; tone?: 'green' | 'stall'}> = {saved: {label: 'In your wiki', tone: 'green'}, held: {label: 'Held'}, refused: {label: 'Refused', tone: 'stall'}}

const formOf = (v: V) => FORMS.find(f => f.value === strOf(v, 'form'))
/** The card on each role, as the owner reports it (absent: no reading). */
function rolesOf(v: V): Record<string, string> | undefined {
  if (!has(v, 'roles')) return undefined
  const r = json<unknown>(v, 'roles', {})
  return r && typeof r === 'object' && !Array.isArray(r) ? Object.fromEntries(Object.entries(r).filter(([, x]) => typeof x === 'string')) as Record<string, string> : {}
}
const openOf = (v: V) => { const f = formOf(v), r = rolesOf(v) ?? {}; return f ? f.roles.filter(x => r[x] === undefined) : [] }
const placedOf = (v: V) => { const f = formOf(v), r = rolesOf(v); return f && r ? f.roles.filter(x => r[x] !== undefined).length : undefined }
function suggestedOf(v: V): {role: string; item: string; confidence?: number} | undefined {
  const s = json<unknown>(v, 'suggested', null) as {role?: unknown; item?: unknown; confidence?: unknown} | null
  return s && typeof s.role === 'string' && typeof s.item === 'string' ? {role: s.role, item: s.item, confidence: typeof s.confidence === 'number' ? s.confidence : undefined} : undefined
}
/** A role's place: position × 60° from the top, clockwise; a conjugate on the outer ring, 1.45 out. */
const placeOf = (role: string) => { const n = parseInt(role, 10), a = n * Math.PI / 3 - Math.PI / 2, r = role.endsWith('′') ? 1.45 : 1; return {x: Math.cos(a) * r, y: Math.sin(a) * r} }
/** The pairs whose two places and two conjugates are all filled: each a four-by-four field of the whole. */
const fieldsOf = (v: V) => {
  const r = rolesOf(v) ?? {}
  return Object.entries(PAIRS).flatMap(([f, pairs]) => pairs.flatMap(([a, b], i) => ([`${a}`, `${b}`, `${a}′`, `${b}′`].every(x => r[x]) ? [`${f}${i}`] : [])))
}
const complete = (v: V) => formOf(v)?.value === 'twelvefold' && openOf(v).length === 0

/** The board drawn in its layout: Free leaves every card where it stands; Radial and Form move the cards round the whole (a
 * presentation only). The whole keeps its place. */
function arranged(v: V, boxes: Item[] | undefined): Item[] | undefined {
  const layout = strOf(v, 'layout'), whole = boxes?.find(b => b.id === strOf(v, 'whole'))
  if (!boxes || !whole || (layout !== 'form' && layout !== 'radial')) return boxes
  const cx = whole.x + whole.w / 2, cy = whole.y + whole.h / 2, R = 3 * Math.max(whole.w, whole.h)
  const at = (b: Item, p: {x: number; y: number}) => ({...b, x: cx + p.x * R - b.w / 2, y: cy + p.y * R - b.h / 2})
  if (layout === 'form') {
    const r = rolesOf(v) ?? {}, f = formOf(v), roleOf = new Map(Object.entries(r).filter(([role]) => f?.roles.includes(role)).map(([role, id]) => [id, role] as const))
    return boxes.map(b => { const role = roleOf.get(b.id); return role ? at(b, placeOf(role)) : b })
  }
  const members = boxes.filter(b => b.kind === 'card' && b.id !== whole.id)
  return boxes.map(b => { const i = members.indexOf(b); if (i < 0) return b; const a = (i / members.length) * 2 * Math.PI - Math.PI / 2; return at(b, {x: Math.cos(a), y: Math.sin(a)}) })
}

/** The form: the whole at the centre, each role round it, a filled role with its card, an open one dashed, the helper's suggestion
 * dashed in the accent until you accept it. */
function FormDisplay({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const v = p.v, f = formOf(v), boxes = items(v), r = rolesOf(v), whole = boxes?.find(b => b.id === strOf(v, 'whole')), s = suggestedOf(v)
  const does = 'The whole at the centre and each role of the form round it. A dashed ring is an open role. A dashed amber name is the helper’s suggestion.'
  const say = !has(v, 'form') ? ['No reading', 'of the form'] : !f ? ['No form', 'Choose one to give the board a shape'] : !boxes ? ['No reading', 'of the items'] : !r ? ['No reading', 'of the roles'] : undefined
  if (say) return <Display w={w} h={h} label="The form" does={does} corner={NONE}><Missing w={w} h={h} say={say} /></Display>
  const twelve = f!.roles.some(x => x.endsWith('′')), R = Math.min(w, h) * (twelve ? .26 : .34), cx = w / 2, cy = h / 2 + 4
  const name = (id: string) => boxes!.find(b => b.id === id)
  return <Display w={w} h={h} label="The form" does={does} corner={f!.label}>
    <circle cx={cx} cy={cy} r={R} className="dp-faint" />
    {twelve && <circle cx={cx} cy={cy} r={R * 1.45} className="dp-faint" strokeDasharray="2 3" />}
    {f!.roles.map(role => {
      const q = placeOf(role), x = cx + q.x * R, y = cy + q.y * R, card = r![role] ? name(r![role]!) : undefined, hint = s?.role === role ? name(s.item) : undefined
      // The name stands outside the ring: to the right of a role on the right, to the left on the left, above or below at the poles.
      const side = Math.abs(q.x) < .3 ? 'middle' : q.x > 0 ? 'start' : 'end', tx = x + (side === 'start' ? 10 : side === 'end' ? -10 : 0)
      const ty = side !== 'middle' ? y + 3 : q.y > 0 ? y + 17 : y - 10
      return <g key={role}>
        <line x1={cx} y1={cy} x2={x} y2={y} className="dp-grid" />
        {card ? <circle cx={x} cy={y} r={6} style={{fill: card.tint ?? 'var(--dp-value)', stroke: 'var(--dp-well)', strokeWidth: 1}} />
          : <circle cx={x} cy={y} r={6} className={hint ? 'dp-curve-on' : 'dp-faint'} strokeDasharray="2 2" />}
        <text x={x} y={y + 3} textAnchor="middle" className="dp-axis" style={{fill: card ? 'var(--dp-well)' : undefined}}>{role}</text>
        {(card || hint) && <text x={tx} y={ty} textAnchor={side} className={card ? 'dp-ink' : 'dp-ink-dim'} style={hint && !card ? {fill: 'var(--dp-on)'} : undefined}>{clip((card ?? hint)!.name, twelve ? 9 : 13)}{hint && !card && s?.confidence !== undefined ? ` ${Math.round(s.confidence * 100)} %` : ''}</text>}
      </g>
    })}
    <circle cx={cx} cy={cy} r={9} style={{fill: whole?.tint ?? 'var(--dp-on)', opacity: whole ? 1 : .35}} />
    <text x={6} y={12} className="dp-ink">{whole ? clip(whole.name, 22) : 'No whole'}</text>
    <text x={6} y={h - 6} className="dp-axis">{`${placedOf(v) ?? NONE} of ${f!.roles.length} placed`}</text>
  </Display>
}

const formChooser = (p: ViewProps) => <Chooser {...st(p, 'form')} label="Form" does="The shape of the whole: its roles round one centre. Choosing a form moves no card until Layout is Form."
  value={strOf(p.v, 'form') ?? ''} options={[{value: '', label: 'None'}, ...FORMS.map(({value, label}) => ({value, label}))]} onChange={x => p.set('form', x)} />
const wholeChooser = (p: ViewProps) => {
  const boxes = items(p.v)?.filter(b => b.kind === 'card' || b.kind === 'sticky')
  return <Chooser {...st(p, 'whole')} label="Centre" does="The whole the form gathers round: a question, a subject, a source." value={strOf(p.v, 'whole') ?? ''}
    options={(boxes ?? []).map(b => ({value: b.id, label: clip(b.name, 22)}))} disabled={st(p, 'whole').disabled ?? (boxes ? undefined : 'No reading of the items.')} onChange={x => p.set('whole', x)} />
}
const layout = (p: ViewProps) => <Radio {...st(p, 'layout')} label="Layout" does="How the board stands: as you placed it, evenly round the whole, or on the roles of the form. Layout moves no source."
  value={strOf(p.v, 'layout') ?? ''} options={LAYOUTS} stack onChange={x => p.set('layout', x)} />
const roleChooser = (p: ViewProps) => {
  const open = openOf(p.v)
  return <Chooser {...st(p, 'role')} label="Role" does="The open role the next card takes." value={strOf(p.v, 'role') ?? ''} options={open.map(x => ({value: x, label: x}))}
    disabled={st(p, 'role').disabled ?? (formOf(p.v) ? (open.length ? undefined : 'Every role is filled.') : 'Choose a form first.')} onChange={x => p.set('role', x)} />
}
/** The one selected card that can take a role: on the board, not the whole, on no role yet. */
const candidate = (v: V) => {
  const ids = selected(v), r = rolesOf(v) ?? {}, b = ids.length === 1 ? items(v)?.find(x => x.id === ids[0]) : undefined
  return b && b.id !== strOf(v, 'whole') && !Object.values(r).includes(b.id) ? b : undefined
}
const setRole = (p: ViewProps, role: string, id: string) => p.set('roles', JSON.stringify({...(rolesOf(p.v) ?? {}), [role]: id}))
const place = (p: ViewProps) => {
  const b = candidate(p.v), role = strOf(p.v, 'role'), s = st(p, 'roles')
  return <Action {...s} label="Place" does="Puts the selected card on the chosen role."
    disabled={s.disabled ?? (!formOf(p.v) ? 'Choose a form first.' : !b ? 'Select one card that is not on a role.' : !role || !openOf(p.v).includes(role) ? 'Choose an open role.' : undefined)}
    onPress={() => { if (b && role) { setRole(p, role, b.id); p.set('role', '') } }} />
}
const suggest = (p: ViewProps) => {
  const b = candidate(p.v), s = st(p, 'suggest')
  return <Action {...s} label="Suggest" does="Asks the Decision helper which open role the selected card takes. Its answer stands dashed until you accept it."
    disabled={s.disabled ?? (!formOf(p.v) ? 'Choose a form first.' : !openOf(p.v).length ? 'Every role is filled.' : !b ? 'Select one card that is not on a role.' : undefined)} onPress={() => p.set('suggest', true)} />
}
const accept = (p: ViewProps) => {
  const sg = suggestedOf(p.v), s = st(p, 'roles')
  return <Action {...s} label={sg ? `Accept ${sg.role}` : 'Accept'} does="Puts the card on the role the helper suggested. Refuse it by placing the card yourself."
    disabled={s.disabled ?? (sg ? (openOf(p.v).includes(sg.role) ? undefined : 'That role is filled now.') : 'No suggestion waits.')}
    onPress={() => { if (sg) { setRole(p, sg.role, sg.item); p.set('suggested', '') } }} />
}
const check = (p: ViewProps) => <Action {...st(p, 'check')} label="Check" does="Runs the form’s rules: each role once, every conjugate on a filled direct role, and every card a real thing."
  disabled={st(p, 'check').disabled ?? (formOf(p.v) ? undefined : 'Choose a form first.')} onPress={() => p.set('checkAsk', true)} />
const fold = (p: ViewProps) => <Action {...st(p, 'fold')} label="Fold" does="Shows that a full sixfold and its conjugate fold into one whole, through the ground of the form."
  disabled={st(p, 'fold').disabled ?? (complete(p.v) ? undefined : 'Fill every role and its conjugate first.')} onPress={() => p.set('fold', true)} />
const declare = (p: ViewProps) => <Action {...st(p, 'declare')} label="Declare" does="Writes the constellation into your wiki, through its owner, with the whole, the form and every role."
  disabled={st(p, 'declare').disabled ?? (strOf(p.v, 'check') === 'passed' ? undefined : 'Check the form first.')} onPress={() => p.set('declare', true)} />

// ---------------------------------------------------------------- the pane at full size

/** The board in the pane: frames, lines, cards, the sticky note, the last object added; the pane is what the camera frames. */
function World({v}: {v: V}) {
  const boxes = arranged(v, items(v)), look = lookOf(v)
  if (!boxes) return <Missing w={PANE.w} h={PANE.h} size={14} say={['No reading of the items']} />
  if (!look) return <Missing w={PANE.w} h={PANE.h} size={14} say={['No reading of the camera']} />
  if (!boxes.length) return <Missing w={PANE.w} h={PANE.h} size={14} say={['No items on the board']} />
  const by = new Map(boxes.map(b => [b.id, b] as const)), sel = new Set(selected(v)), z = look.zoom / 100
  const raw = linesOf(v), ends = raw ? joined(raw, boxes) : []
  const kind = strOf(v, 'lineKind'), from = strOf(v, 'fromSide'), to = strOf(v, 'toSide'), label = strOf(v, 'label')
  const stroke = (id: string) => (sel.has(id) ? 'var(--dp-on)' : undefined)
  const grid: [number, number][] = []
  if (gridOn(v) && GRID * z > 18) {
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
      const r = route(first ? kind ?? 'straight' : 'straight', A, B, sa, sb), head = !first || directed(v)
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
        const paper = paperOf(b) ?? PALETTE.amber, ink = '#3d3a2e'
        const size = 17, first = 30, room = Math.max(1, Math.floor((b.h - first) / 24) + 1)
        const text = wrap(b.name, Math.round(b.w / 16)), shownLines = text.slice(0, room).map((l, k, all) => (k === all.length - 1 && text.length > room ? `${l}…` : l))
        return <>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={3} style={{fill: paper ?? 'none', stroke: stroke(b.id) ?? (paper ? undefined : 'var(--text-faint, #71767c)'), strokeWidth: 2.4 / z}} />
          {shownLines.map((l, k) => <text key={k} x={b.x + 14} y={b.y + first + k * 24} style={{fill: ink, font: `${size}px var(--font-ui, sans-serif)`}}>{l}</text>)}
        </>
      })()}
      {b.kind === 'shape' && (() => {
        const fill = paperOf(b) ?? 'none', edge = stroke(b.id) ?? '#74766b', width = (sel.has(b.id) ? 2.4 : 1.35) / z
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
const span2 = (node: ReactNode) => <div style={{gridColumn: 'span 2', width: '100%'}}>{node}</div>
/** The standing of an act that moves several keys: the first of them the owner holds disabled, else the first's. */
const standOf = (p: ViewProps, ...keys: string[]): Standing => keys.map(k => st(p, k)).find(s => s.disabled) ?? st(p, keys[0]!)

// ---------------------------------------------------------------- controls, each in one place

const tool = (p: ViewProps) => <Radio {...st(p, 'tool')} label="Tool" does="Chooses what a click or a drag makes: select, a frame, a line, a note, a shape or text." value={strOf(p.v, 'tool') ?? ''} options={TOOLS} stack onChange={x => p.set('tool', x)} />
const snap = (p: ViewProps) => <Radio {...st(p, 'snap')} label="Snap" does="Sets how a dragged item aligns: not at all, on the grid, or on the guide lines of the items near it." value={strOf(p.v, 'snap') ?? ''} options={SNAPS} stack onChange={x => p.set('snap', x)} />
const shape = (p: ViewProps) => <Radio {...st(p, 'shape')} label="Shape" does="Sets the shape of the next shape." value={strOf(p.v, 'shape') ?? ''} options={SHAPES} stack onChange={x => p.set('shape', x)} />
const colour = (p: ViewProps) => <Chooser {...st(p, 'colour')} label="Sticky colour" does="Sets the colour of the next sticky note, from the palette of the app." value={strOf(p.v, 'colour') ?? ''} options={COLOURS} onChange={x => p.set('colour', x)} />
const relation = (p: ViewProps) => <Radio {...st(p, 'relation')} label="Relation type" does="Sets the type of the next line: echo, influence, cause or transform." value={strOf(p.v, 'relation') ?? ''} options={RELATIONS} stack onChange={x => p.set('relation', x)} />
const standing = (p: ViewProps) => <Radio {...st(p, 'standing')} label="Standing" does="Sets the standing of the next line: fact, claim, inference or guess." value={strOf(p.v, 'standing') ?? ''} options={STANDINGS} stack onChange={x => p.set('standing', x)} />
const toggle = (p: ViewProps, key: string, label: string, does: string) => {
  const now = boolOf(p.v, key)
  return <Toggle {...st(p, key)} label={label} does={does} on={now === true} unknown={now === undefined} onChange={x => p.set(key, x)} />
}
const minimap = (p: ViewProps) => toggle(p, 'minimap', 'Minimap', 'Shows the overview in the corner of the pane. Click it to jump there.')
const autosave = (p: ViewProps) => toggle(p, 'autosave', 'Autosave', 'Saves a short time after a gesture, and at once after a delete.')
const fitAll = (p: ViewProps) => {
  const boxes = items(p.v), look = boxes && fit(boxes), s = standOf(p, 'zoom', 'cx', 'cy')
  return <Action {...s} label="Fit" does="Brings every item into view with a margin."
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
const viewChooser = (p: ViewProps) => <Chooser {...st(p, 'view')} label="View" does="Applies a saved view: the camera, the frames, the selection and the subject. The Canvas names any item that left since you saved it."
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
  return <Readout label="save" does="The save glyph: saved, saving or held." value={own(SAVE, now)} tone={now === 'held' ? 'stall' : now === 'saved' ? 'green' : undefined} />
}
const find = (p: ViewProps) => <Action {...st(p, 'find')} label="Find" does="Searches the text of cards, the titles of frames and the shapes, selects the match and centres it. Enter finds the next." onPress={() => p.set('find', true)} />
const present = (p: ViewProps) => {
  const n = frameCount(p.v), s = st(p, 'present')
  return <Action {...s} label="Present" does="Shows the frames in order, full screen. Esc leaves."
    disabled={s.disabled ?? (n === undefined ? 'No reading of the frames.' : n > 0 ? undefined : 'Draw a frame first.')} onPress={() => p.set('present', true)} />
}
const kind = (p: ViewProps) => <Radio {...st(p, 'lineKind')} label="Line kind" does="Sets the path of the next line, and of the selected one: straight, curved or elbow." value={strOf(p.v, 'lineKind') ?? ''} options={KINDS} stack onChange={x => p.set('lineKind', x)} />
const lineLabel = (p: ViewProps) => <TextField {...st(p, 'label')} wide label="Line label" does="Writes a label at the middle of the selected line. Empty: no label." value={strOf(p.v, 'label') ?? ''} placeholder="none" onChange={x => p.set('label', x)} />
const sideFrom = (p: ViewProps) => <Chooser {...st(p, 'fromSide')} label="From" does="Binds the start of the selected line to a side of its card. Auto picks the facing side." value={strOf(p.v, 'fromSide') ?? ''} options={SIDES} onChange={x => p.set('fromSide', x)} />
const sideTo = (p: ViewProps) => <Chooser {...st(p, 'toSide')} label="To" does="Binds the end of the selected line to a side of its card. Auto picks the facing side." value={strOf(p.v, 'toSide') ?? ''} options={SIDES} onChange={x => p.set('toSide', x)} />
const promote = (p: ViewProps) => {
  const state = strOf(p.v, 'promote'), s = st(p, 'promote'), n = linesOf(p.v)?.length
  return <Action {...s} label="Promote" does="Sends the selected line to the owner of its relation. The owner may accept, change or refuse it."
    disabled={s.disabled ?? (state === 'recorded' ? 'The owner has recorded this relation.' : n === undefined ? 'No reading of the lines.' : n > 0 ? undefined : 'There is no line to promote.')}
    refused={s.refused ?? (state === 'refused' ? strOf(p.v, 'refusal') ?? 'The owner gave no reason.' : undefined)}
    onPress={() => p.set('promote', true)} />
}

/** The numbers beside the picture: what the board holds, by the owner's reading. */
const lineCount = (v: V) => linesOf(v)?.length
const itemCount = (v: V) => items(v)?.length

// ---------------------------------------------------------------- the Light page: the bench over the board

type Element = 'funnel' | 'prism' | 'mirror' | 'absorber' | 'stop' | 'sensor'
type StandingWord = 'fact' | 'claim' | 'inference' | 'guess'
const ELEMENT_WORD: Record<Element, string> = {funnel: 'Funnel', prism: 'Prism', mirror: 'Mirror', absorber: 'Absorber', stop: 'Stop', sensor: 'Sensor'}
const ELEMENT_DOES: Record<Element, string> = {funnel: 'Sends all of the light down the line out that passes the most.', prism: 'Fans the light into the bands of the spectrum.',
  mirror: 'Sends the light back along the line it came by.', absorber: 'Keeps a quarter of the light.', stop: 'Ends the light.', sensor: 'Reads what arrives, and ends it.'}
const ELEMENT_MARK: Record<Element, string> = {funnel: '▽', prism: '△', mirror: '|', absorber: '▪', stop: '✕', sensor: '◎'}
const LIGHT_STANDINGS: readonly StandingWord[] = ['fact', 'claim', 'inference', 'guess']
const TX_DEF: Record<StandingWord, number> = {fact: 100, claim: 85, inference: 60, guess: 35}
const SPECTRA = [{value: '5', label: '5', does: 'Five bands.'}, {value: '9', label: '9', does: 'Nine bands.'}, {value: '13', label: '13', does: 'Thirteen bands.'}] as const
const ABSORBED = .25, LOSS_LENGTH = 4000
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
/** The elements on the cards. An engine that still calls the funnel a lens is read as a funnel. */
const elementsOf = (v: V): Map<string, Element> => new Map(json<unknown[]>(v, 'light.elements', []).flatMap((e): [string, Element][] => {
  if (!rec(e) || typeof e.at !== 'string' || typeof e.kind !== 'string') return []
  const kind = e.kind === 'lens' ? 'funnel' : e.kind
  return kind in ELEMENT_WORD ? [[e.at, kind as Element]] : []
}))
const txOf = (v: V, s: string | undefined) => { if (!s || !(LIGHT_STANDINGS as readonly string[]).includes(s)) return undefined; const x = numOf(v, `tx.${s}`); return x === undefined ? undefined : clampTo(0, 100, x) / 100 }
interface BenchLine {readonly from: string; readonly to: string; readonly standing?: string}
/** The board's lines as the bench reads them: each between two cards, with the standing it carries. */
function benchLines(v: V, boxes: readonly Item[]): BenchLine[] {
  const raw = linesOf(v) ?? [], standings = standingsOf(v)
  return raw.flatMap(([a, b], i): BenchLine[] => { const A = endOf(boxes, a), B = endOf(boxes, b); return A && B ? [{from: A.id, to: B.id, standing: standings[i]}] : [] })
}

/** The bench by its law: the power on each line and reaching each card, from the source, up to Bounces lines deep. */
export function trace(v: V) {
  const boxes = (items(v) ?? []).filter(b => b.kind === 'card' || b.kind === 'sticky'), lines = benchLines(v, boxes), elements = elementsOf(v)
  const source = strOf(v, 'light.source'), bounces = numOf(v, 'light.bounces') ?? 35
  const at = new Map(boxes.map(i => [i.id, i])), centre = (i: Item) => [i.x + i.w / 2, i.y + i.h / 2] as const
  const lineLoad = new Map<number, number>(), cardLoad = new Map<string, number>(), spectral = new Set<number>()
  if (!source || !at.has(source) || boolOf(v, 'light.on') !== true) return {boxes, lines, elements, lineLoad, cardLoad, spectral, source}
  type Ray = {card: string; power: number; came?: number; depth: number; split: boolean}
  const queue: Ray[] = [{card: source, power: 1, depth: 0, split: false}]
  cardLoad.set(source, 1)
  while (queue.length) {
    const ray = queue.shift()!
    if (ray.depth >= bounces || ray.power < 1e-3) continue
    const kind = elements.get(ray.card)
    if (ray.card !== source && (kind === 'stop' || kind === 'sensor')) continue
    let outs = lines.map((l, i) => [l, i] as const).filter(([l]) => l.from === ray.card && txOf(v, l.standing) !== undefined)
    if (kind === 'mirror' && ray.came !== undefined) outs = [[{from: ray.card, to: lines[ray.came]!.from, standing: lines[ray.came]!.standing}, ray.came] as const]
    if (kind === 'funnel' && outs.length > 1) outs = [outs.reduce((best, o) => (txOf(v, o[0].standing)! > txOf(v, best[0].standing)! ? o : best))]
    if (!outs.length) continue
    const power = ray.power * (kind === 'absorber' ? ABSORBED : 1) / outs.length
    for (const [line, index] of outs) {
      const a = at.get(line.from), b = at.get(line.to), tx = txOf(v, line.standing)
      if (!a || !b || tx === undefined) continue
      const [ax, ay] = centre(a), [bx, by] = centre(b), arrive = power * tx * Math.exp(-Math.hypot(bx - ax, by - ay) / LOSS_LENGTH)
      lineLoad.set(index, (lineLoad.get(index) ?? 0) + arrive)
      if (kind === 'prism' || ray.split) spectral.add(index)
      cardLoad.set(line.to, (cardLoad.get(line.to) ?? 0) + arrive)
      queue.push({card: line.to, power: arrive, came: index, depth: ray.depth + 1, split: kind === 'prism' || ray.split})
    }
  }
  return {boxes, lines, elements, lineLoad, cardLoad, spectral, source}
}
/** The engine's reading at each sensor, by the card it stands on. */
const powerOf = (v: V) => new Map(json<unknown[]>(v, 'sensor.power', []).flatMap((r): [string, number][] => (rec(r) && typeof r.at === 'string' && finite(r.power) ? [[r.at, r.power]] : [])))

/** The bench over the board, fitted to the well: each card with its element, each line with the light it carries (a ray as bright as
 * its power, fanned into the spectrum's bands after a prism), each sensor with its reading. */
function Bench({v, w, h, labels}: {v: V; w: number; h: number; labels: boolean}) {
  const t = trace(v)
  if (!items(v)) return <Missing w={w} h={h} say={['No reading', 'of the board']} />
  if (!t.boxes.length) return <Missing w={w} h={h} say={['No cards', 'on the board']} />
  const x0 = Math.min(...t.boxes.map(i => i.x)), y0 = Math.min(...t.boxes.map(i => i.y)), x1 = Math.max(...t.boxes.map(i => i.x + i.w)), y1 = Math.max(...t.boxes.map(i => i.y + i.h))
  const k = Math.min((w - 16) / Math.max(1, x1 - x0), (h - 16) / Math.max(1, y1 - y0)), ox = (w - (x1 - x0) * k) / 2, oy = (h - (y1 - y0) * k) / 2
  const X = (x: number) => ox + (x - x0) * k, Y = (y: number) => oy + (y - y0) * k
  const chosen = strOf(v, 'light.card'), byId = new Map(t.boxes.map(i => [i.id, i])), bands = Number(strOf(v, 'light.spectrum') ?? 9), rays = boolOf(v, 'light.rays') !== false, read = powerOf(v)
  const hue = (b: number) => `hsl(${Math.round(270 - 270 * b / Math.max(1, bands - 1))} 80% 62%)`
  return <g>
    {t.lines.map((l, i) => { const a = byId.get(l.from), b = byId.get(l.to); if (!a || !b) return null
      const ax = X(a.x + a.w / 2), ay = Y(a.y + a.h / 2), bx = X(b.x + b.w / 2), by = Y(b.y + b.h / 2), load = t.lineLoad.get(i)
      return <g key={i}>
        <path d={`M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`} className="dp-faint" strokeDasharray={l.standing ? undefined : '2 2'} />
        {rays && load !== undefined && (t.spectral.has(i)
          ? Array.from({length: bands}, (_, b) => { const off = (b - (bands - 1) / 2) * 1.1, nx = -(by - ay), ny = bx - ax, len = Math.hypot(nx, ny) || 1
            return <path key={b} d={`M${(ax + nx / len * off).toFixed(1)} ${(ay + ny / len * off).toFixed(1)}L${(bx + nx / len * off).toFixed(1)} ${(by + ny / len * off).toFixed(1)}`} stroke={hue(b)} strokeWidth={.7} opacity={clampTo(.15, 1, load)} /> })
          : <path d={`M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`} stroke="var(--dp-on)" strokeWidth={.6 + 3.2 * load} opacity={clampTo(.2, 1, .25 + load)} />)}
      </g> })}
    {t.boxes.map(i => { const kind = t.elements.get(i.id), load = read.get(i.id), src = i.id === t.source
      return <g key={i.id}>
        <rect x={X(i.x)} y={Y(i.y)} width={i.w * k} height={i.h * k} rx={2} fill="var(--dp-well)" stroke={src ? 'var(--dp-on)' : kind === 'sensor' ? 'var(--dp-value)' : 'var(--dp-value-dim)'} strokeWidth={src || kind === 'sensor' ? 1.4 : .8} />
        {i.id === chosen && <rect x={X(i.x) - 2.5} y={Y(i.y) - 2.5} width={i.w * k + 5} height={i.h * k + 5} rx={3} fill="none" stroke="var(--dp-on)" strokeWidth={.8} strokeDasharray="2 2" />}
        {labels && i.w * k > 40 && <text x={X(i.x) + 3} y={Y(i.y) + 10} className="dp-ink" style={{fontSize: 8}}>{clip(i.name, Math.floor(i.w * k / 5))}</text>}
        {kind && <text x={X(i.x + i.w) - 3} y={Y(i.y) + 10} textAnchor="end" className="dp-axis" style={{fontSize: 8}}>{ELEMENT_MARK[kind]}</text>}
        {labels && kind === 'sensor' && <text x={X(i.x + i.w / 2)} y={Y(i.y + i.h) - 3} textAnchor="middle" className="dp-ink" style={{fontSize: 9}}>{load === undefined ? NONE : pct(load * 100)}</text>}
        {labels && src && <text x={X(i.x + i.w / 2)} y={Y(i.y + i.h) - 3} textAnchor="middle" className="dp-axis" style={{fontSize: 8}}>source</text>}
      </g> })}
  </g>
}
const BENCH_DOES = 'The bench over the board: light leaves the source card and follows your lines; each line passes the share its standing allows; a sensor reads what arrives.'

function sensorRows(v: V): RowItem[] {
  const names = new Map((items(v) ?? []).map(i => [i.id, i.name])), read = powerOf(v)
  const rows = [...elementsOf(v)].filter(([, kind]) => kind === 'sensor').map(([at]): RowItem => {
    const power = read.get(at)
    return {id: at, name: names.get(at) ?? at, light: power === undefined ? 'unknown' : power > 0 ? 'lit' : 'dark', tone: 'value', note: power === undefined ? NONE : pct(power * 100),
      does: 'The power that reaches this sensor, the source being 100 %. The engine reads it.'}
  })
  return rows.length ? rows : [{id: 'none', name: 'No sensor on the board', light: 'dark'}]
}
function lightControls(p: ViewProps) {
  const v = p.v, cards = (items(v) ?? []).filter(b => b.kind === 'card' || b.kind === 'sticky'), none = items(v) === undefined ? 'No reading of the board.' : cards.length ? undefined : 'The board holds no card.'
  const tx = (s: StandingWord) => <Dial key={s} {...st(p, `tx.${s}`)} label={s.charAt(0).toUpperCase() + s.slice(1)} does={`How much of the light a line of standing ${s} passes. A starting point: tune it to the way you read.`}
    value={numOf(v, `tx.${s}`) ?? NaN} def={TX_DEF[s]} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set(`tx.${s}`, Math.round(x))} />
  const card = strOf(v, 'light.card'), placed = elementsOf(v)
  return {
    on: toggle(p, 'light.on', 'On', 'Turns the light on.'),
    source: <Chooser {...st(p, 'light.source')} label="Source" does="The card that the light leaves." value={strOf(v, 'light.source') ?? ''} options={cards.map(i => ({value: i.id, label: i.name}))}
      onChange={x => p.set('light.source', x)} disabled={st(p, 'light.source').disabled ?? none} />,
    card: <Chooser {...st(p, 'light.card')} label="Card" does="Choose a card, then what it does to the light under Element." value={card ?? ''} options={cards.map(i => ({value: i.id, label: i.name}))}
      onChange={x => p.set('light.card', x)} disabled={st(p, 'light.card').disabled ?? none} />,
    element: <Chooser {...st(p, 'light.elements')} label="Element" does="What the chosen card does to the light." value={card === undefined ? '' : placed.get(card) ?? 'none'}
      options={[{value: 'none', label: 'None', does: 'The card shares the light among its lines out.'}, ...(Object.keys(ELEMENT_WORD) as Element[]).map(e => ({value: e, label: ELEMENT_WORD[e], does: ELEMENT_DOES[e]}))]}
      onChange={x => { if (card === undefined) return; const next = new Map(placed); if (x === 'none') next.delete(card); else next.set(card, x as Element)
        p.set('light.elements', JSON.stringify([...next].map(([at, kind]) => ({at, kind})))) }}
      disabled={st(p, 'light.elements').disabled ?? (card === undefined ? 'Choose a card first.' : undefined)} />,
    bounces: <ValueBox {...st(p, 'light.bounces')} label="Bounces" does="How many lines deep the light travels." value={numOf(v, 'light.bounces') ?? NaN} def={35} scale={{min: 1, max: 100, step: 1}} format={x => `${x}`} onChange={x => p.set('light.bounces', x)} />,
    segments: <ValueBox {...st(p, 'light.segments')} label="Segments" does="How finely each ray is traced." value={numOf(v, 'light.segments') ?? NaN} def={4500} scale={{min: 500, max: 20000, log: true, step: 100}} format={x => `${Math.round(x)}`} onChange={x => p.set('light.segments', Math.round(x / 100) * 100)} />,
    spectrum: <Radio {...st(p, 'light.spectrum')} label="Spectrum" does="How many bands a prism fans the light into." value={strOf(v, 'light.spectrum') ?? ''} options={SPECTRA} onChange={x => p.set('light.spectrum', Number(x))} />,
    rays: toggle(p, 'light.rays', 'Rays', 'Draws the rays over the Canvas.'),
    tx,
  }
}
function LightBands({p}: {p: ViewProps}) {
  const c = lightControls(p), w = grown(p, 194, 650, 480)
  return <>
    <Band>
      <Section width={w + 12}><Display w={w} h={146} label="The bench" does={BENCH_DOES}><Bench v={p.v} w={w} h={146} labels={w > 200} /></Display></Section>
      <Section label="Source" width={124}>{c.on}{c.source}{c.card}{c.element}</Section>
      <Section label="Rays" cols={2} grow>{c.bounces}{c.segments}{c.spectrum}{c.rays}</Section>
    </Band>
    <Band>
      <Section label="Transmission" cols={4} width={232}>{LIGHT_STANDINGS.map(s => c.tx(s))}</Section>
      <Section label="Sensors" grow><Rows does="The power that reaches each sensor, the source being 100 %." items={sensorRows(p.v)} size={4} /></Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- the device

const defaults = {
  light: 'lit', tool: 'select', snap: 'guides', shape: 'rectangle', colour: 'amber', minimap: true, autosave: true,
  zoom: 100, cx: 100, cy: 130, view: '', mine: false, mineX: 0, mineY: 0, mineZ: 100,
  lineKind: 'straight', fromSide: 'auto', toSide: 'auto', label: 'rises to', relation: 'echo', standing: 'claim', promote: 'ready', refusal: '',
  sel: 'question',
  // The board, as the owner reports it: the Seven centres (each card its entity's size, .235 of 400 units), the question sticky, the
  // lines between neighbouring centres root to crown, each with the standing it was drawn at (the first is the selected one), and the
  // frame round the lower three.
  items: JSON.stringify([
    {id: 'Root', kind: 'card', x: 60, y: 240, w: 94, h: 94, name: 'Root', glyph: '△', tint: '#a94138'},
    {id: 'Sacral', kind: 'card', x: 230, y: 160, w: 94, h: 94, name: 'Sacral', glyph: '◯', tint: '#c67c46'},
    {id: 'Solar', kind: 'card', x: 60, y: 80, w: 94, h: 94, name: 'Solar', glyph: '△', tint: '#c2a852'},
    {id: 'Heart', kind: 'card', x: 230, y: 0, w: 94, h: 94, name: 'Heart', glyph: '✧', tint: '#638c69'},
    {id: 'Throat', kind: 'card', x: 60, y: -80, w: 94, h: 94, name: 'Throat', glyph: '◯', tint: '#5898a4'},
    {id: 'Brow', kind: 'card', x: 230, y: -160, w: 94, h: 94, name: 'Brow', glyph: '∞', tint: '#737599'},
    {id: 'Crown', kind: 'card', x: 60, y: -240, w: 94, h: 94, name: 'Crown', glyph: '✧', tint: '#a590b0'},
    {id: 'question', kind: 'sticky', x: -250, y: 20, w: 220, h: 180, name: 'Which centre speaks first?', tint: 'amber'},
  ]),
  lines: JSON.stringify([[0, 1, 'fact'], [1, 2, 'claim'], [2, 3, 'claim'], [3, 4, 'inference'], [4, 5, 'inference'], [5, 6, 'guess'], [3, 6, 'guess']]),
  frames: JSON.stringify([{title: 'Lower three', members: ['Root', 'Sacral', 'Solar']}]),
  // The form: none chosen on this board.
  form: '', whole: 'question', roles: '{}', layout: 'free', role: '', suggested: '',
  // The Light: the root as the source, sensors on the brow and the crown.
  'light.on': true, 'light.source': 'Root', 'light.card': 'Heart', 'light.elements': JSON.stringify([{at: 'Brow', kind: 'sensor'}, {at: 'Crown', kind: 'sensor'}]),
  'light.bounces': 35, 'light.segments': 4500, 'light.spectrum': 9, 'light.rays': true, 'tx.fact': 100, 'tx.claim': 85, 'tx.inference': 60, 'tx.guess': 35,
  // The engine's readings at the two sensors, by the law above (trace() gives the same numbers).
  'sensor.power': JSON.stringify([{at: 'Brow', power: .103}, {at: 'Crown', power: .102}]),
  // Readings: what the device reports, never set from here.
  save: 'saved', waiting: 4, check: '', checkWhy: '', declared: '',
}

// A board given a form: the six M domains round Quaternal Logic, set out as a person left them; Layout Form stands each on its role.
const DOMAINS = [
  {id: 'M0', name: 'M0 Anuttara', glyph: '○', tint: '#737599', x: -420, y: 150}, {id: 'M1', name: 'M1 Paramaśiva', glyph: '△', tint: '#a94138', x: -150, y: -330},
  {id: 'M2', name: 'M2 Paraśakti', glyph: '◯', tint: '#5898a4', x: 300, y: -260}, {id: 'M3', name: 'M3 Mahāmāyā', glyph: '✧', tint: '#c2a852', x: 420, y: 160},
  {id: 'M4', name: 'M4 Nara', glyph: '△', tint: '#638c69', x: 60, y: 330}, {id: 'M5', name: 'M5 Epii', glyph: '∞', tint: '#a590b0', x: -330, y: -120},
]
const DOMAIN_BOARD = {
  items: JSON.stringify([{id: 'QL', kind: 'card', x: -47, y: -47, w: 94, h: 94, name: 'Quaternal Logic', glyph: '◎', tint: '#c67c46'},
    ...DOMAINS.map(d => ({...d, kind: 'card', w: 94, h: 94}))]),
  lines: JSON.stringify([['M5', 'M0'], ['M4', 'M5']]), label: 'returns to',
  frames: JSON.stringify([{title: '1-2-3', members: ['M1', 'M2', 'M3']}, {title: '4/5/0', members: ['M4', 'M5', 'M0']}]),
  whole: 'QL', form: 'sixfold', zoom: 55, cx: 0, cy: 20, sel: 'M4', waiting: 2, 'light.source': 'QL', 'light.elements': '[]', 'sensor.power': '[]',
}
const PAGES = [{id: 'board', label: 'Board'}, {id: 'lines', label: 'Lines'}, {id: 'form', label: 'Form'}, {id: 'light', label: 'Light'}] as const
const pageOf = (p: ViewProps) => (PAGES.some(x => x.id === p.page) ? p.page : 'board')

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
    'A form: the six domains': {...DOMAIN_BOARD, layout: 'form', check: 'passed', checkWhy: 'Each role once; no conjugate.',
      roles: JSON.stringify(Object.fromEntries(DOMAINS.map(d => [d.id.slice(1), d.id])))},
    'Three placed, one suggested': {...DOMAIN_BOARD, layout: 'form', role: '4',
      roles: JSON.stringify({1: 'M1', 2: 'M2', 3: 'M3'}), suggested: JSON.stringify({role: '4', item: 'M4', confidence: .38})},
    'A conjugate with no direct': {...DOMAIN_BOARD, form: 'twelvefold', layout: 'form', sel: 'M5', check: 'refused', checkWhy: 'Role 4′ has no card on 4. A conjugate stands only on a filled direct role.',
      roles: JSON.stringify({0: 'M0', 1: 'M1', 2: 'M2', 3: 'M3', 5: 'M5', '4′': 'M4'})},
    'A funnel at the heart': {'light.card': 'Heart', 'light.elements': JSON.stringify([{at: 'Heart', kind: 'funnel'}, {at: 'Brow', kind: 'sensor'}, {at: 'Crown', kind: 'sensor'}]),
      'sensor.power': JSON.stringify([{at: 'Brow', power: .206}, {at: 'Crown', power: 0}])},
    'Guesses pass little': {'tx.guess': 10, 'tx.inference': 40, 'sensor.power': JSON.stringify([{at: 'Brow', power: .046}, {at: 'Crown', power: .029}])},
    'No readings': Object.fromEntries(Object.keys(defaults).map(k => [k, undefined])),
  },

  folded: p => <Folded title="Canvas" light={light(p)} readings={[waiting(p.v) === undefined ? NONE : `${waiting(p.v)} wait`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Canvas" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><BoardDisplay p={p} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>{tool(p)}{snap(p)}{relation(p)}{standing(p)}</Section>
  </Panel>,

  whole: p => {
    const page = pageOf(p), on = boolOf(p.v, 'light.on')
    const pages = PAGES.map(x => ({id: x.id, label: x.label, light: x.id === 'light' ? (on === undefined ? undefined : on ? 'lit' : 'dark') as LightState | undefined : undefined}))
    return <Panel title="Canvas" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} pages={pages} page={page} onPage={p.setPage}>
      {page === 'light' ? <LightBands p={p} /> : page === 'form' ? <>
        <Band>
          <Section width={260}><FormDisplay p={p} w={248} h={146} /></Section>
          <Section label="Form" cols={2} grow>
            {span2(formChooser(p))}{span2(wholeChooser(p))}{span2(layout(p))}
          </Section>
        </Band>
        <Band>
          <Section label="Place" cols={2}>
            {span2(roleChooser(p))}{place(p)}{suggest(p)}{span2(accept(p))}
          </Section>
          <Section label="Owner" cols={2} grow>
            {check(p)}<Readout label="check" does={strOf(p.v, 'checkWhy') || 'What the form’s rules said, the last time you checked.'} value={CHECK[strOf(p.v, 'check') ?? '']?.label ?? (has(p.v, 'check') ? 'Not run' : undefined)} tone={CHECK[strOf(p.v, 'check') ?? '']?.tone} />
            {fold(p)}<Readout label="fields" does="Pairs whose two roles and their conjugates are all filled. Each is a four-by-four field of the whole." value={formOf(p.v)?.value === 'twelvefold' ? `${fieldsOf(p.v).length} of 9` : 'none'} />
            {declare(p)}<Readout label="wiki" does="Whether the constellation stands in your wiki." value={DECLARED[strOf(p.v, 'declared') ?? '']?.label ?? (has(p.v, 'declared') ? 'Not yet' : undefined)} tone={DECLARED[strOf(p.v, 'declared') ?? '']?.tone} />
          </Section>
        </Band>
      </> : page === 'lines' ? <>
        <Band>
          <Section width={206}><LineDisplay p={p} /></Section>
          <Section label="Lines" cols={2} grow>
            {kind(p)}
            <div style={{display: 'flex', flexDirection: 'column', gap: 4, width: '100%'}}>{sideFrom(p)}{sideTo(p)}</div>
            {span2(lineLabel(p))}
          </Section>
        </Band>
        <Band>
          <Section label="Relation" cols={2}>
            {relation(p)}{standing(p)}
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
          <Section label="Tools" cols={3} grow>
            {tool(p)}{snap(p)}{shape(p)}
            <div style={{gridColumn: 'span 3', width: '100%'}}>{colour(p)}</div>
          </Section>
        </Band>
        <Band>
          <Section label="Look" cols={2}>
            {minimap(p)}{fitAll(p)}{fitSel(p)}{find(p)}{present(p)}<Readout label="frames" does="Frames on the board." value={frameCount(p.v)} />
          </Section>
          <Section label="Views" grow>
            {viewChooser(p)}{saveView(p)}{autosave(p)}{saved(p)}
          </Section>
        </Band>
      </>}
    </Panel>
  },

  full: p => {
    const lit = pageOf(p) === 'light', t = toolOf(p.v), n = itemCount(p.v), w = waiting(p.v)
    const status = [t && t.value !== 'select' ? t.label : undefined, zoomText(p.v), `${n ?? NONE} items`, `${w ?? NONE} lines wait for their owner`].filter(Boolean).join(' · ')
    const label: CSSProperties = {fill: 'var(--text-dim)', font: '12px var(--font-ui, sans-serif)'}
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox={`0 0 ${PANE.w} ${PANE.h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label={lit ? 'The bench over the Canvas' : 'The Canvas'}>
        <g className="dp-display" style={{background: 'none'}}>
          {lit ? <Bench v={p.v} w={PANE.w} h={PANE.h} labels /> : <>
            <defs><clipPath id="canvas-pane"><rect width={PANE.w} height={PANE.h} /></clipPath></defs>
            <g clipPath="url(#canvas-pane)"><World v={p.v} /></g>
            <text x={14} y={24} style={label}>{status}</text>
            {boolOf(p.v, 'minimap') === true && <g transform={`translate(${PANE.w - 152} ${PANE.h - 118})`}>
              <rect width={140} height={106} rx={3} style={{fill: 'var(--dp-well)', stroke: 'var(--line, #24262a)', strokeWidth: 1}} opacity={.95} />
              <Overview p={p} w={140} h={106} handles={0} />
            </g>}
          </>}
        </g>
      </svg>
    </div>
  },

  widget: p => <Tile title="Canvas" light={light(p)} span={2} onFull={p.nav.full}>
    <Display w={160} h={104} label="The board" does="Every item as a box, the pane as a rectangle. Click ⤢ to open the Canvas in the pane that has focus.">
      <Overview p={p} w={160} h={104} handles={0} />
    </Display>
    <div className="ref-tile-counts">
      <Readout big label="wait" does="Lines you drew that no owner has recorded as relations." value={waiting(p.v)} tone="accent" onPress={p.nav.full} />
    </div>
  </Tile>,
}
