// Contacts (manual §20.8, expressions:contacts): what happens when things touch — the walls of the letters, and particles against
// particles. Live's nearest: Auto Filter — a well that draws the law with handles on it, and dials ruled off beside it. The shell's own
// diagram (components/NativeFieldFace.contacts.tsx) draws the same law and this panel hosts a diagram of it: on the left the glyph wall
// (a stand-in ellipse, obstacle or vessel) with its contact band, the dashes that integrity opens in it and the bounce arrows; on the
// right a particle pair with its contact radius, a spring coil for the stiffness, the bounce arrow and the sliding-drag arrow. Each half
// dims while its own enable is off (the owner solves the wall and the pairs independently).
//
// Everything the device draws is a value key, the binding's own path (NATIVE_BINDINGS, nativeParameters.ts) or the field-setting key
// (nativeDeviceEdits.ts, parameterAddress.ts FIELD_SETTINGS). The owners report:
//   collisionEnabled      boolean   the glyph walls are solved (engine.collisionEnabled; default off)
//   collisionMode         obstacle | vessel      default obstacle
//   collision.restitution 0..1, default 0.35      collision.friction 0..1, default 0.1
//   collision.band        5..200 px, default 40   collision.strength 0..20, default 4     collision.integrity 0..4, default 0.5
//   pairwiseEnabled       boolean   the particle contacts are solved (engine.pairwiseEnabled; default off)
//   pairwise.radius       2..80 px, default 2.2   pairwise.stiffness 0..10, default 1     pairwise.restitution 0..1, default 0.12
//   pairwise.viscosity    0..1, default 0.06      pairwise.extent 200..5000 px, log, default 1400
// The registry's ranges and steps are paramRegistry.ts:118-122 and :156-160; the defaults are fieldDefaults.ts:67-84 (the binding reads
// them from DEFAULT_CONFIG, so none is a range minimum). The device light is the owner's strip rule (nativeFieldFace.contacts.ts:23, :27):
// lit when either section is on; turned off it clears both, turned on it enables the glyph walls only.
// A key the owner has not reported is absent: the view draws "—" for it and names it in words in the well.
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, fromUnit, toUnit, type LightState, type Option, type Scale} from '../../sdk/panel'
import {boolOf, clampTo, fixed, NONE, numOf, shown, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './expressions__contacts.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary (the owner's registry, not data)

const K = {glyph: 'collisionEnabled', mode: 'collisionMode', pairs: 'pairwiseEnabled'} as const

interface Rule {
  readonly key: string; readonly label: string; readonly scale: Scale; readonly step: number; readonly def: number
  readonly format: (x: number) => string; readonly does: string
}
const d2 = fixed(2)
const px0 = (x: number) => `${Math.round(x)} px`
const px1 = (x: number) => `${x.toFixed(1)} px`

/** The soft range, the grid step and the owner's default of each number (paramRegistry.ts:118-122 and :156-160; fieldDefaults.ts:67-84). */
const R = {
  wallBounce: {key: 'collision.restitution', label: 'Bounce', scale: {min: 0, max: 1}, step: .01, def: .35, format: d2, does: 'How much speed a particle keeps when it hits a wall.'},
  wallFriction: {key: 'collision.friction', label: 'Friction', scale: {min: 0, max: 1}, step: .01, def: .1, format: d2, does: 'How much sliding speed a particle loses on a wall.'},
  wallBand: {key: 'collision.band', label: 'Band', scale: {min: 5, max: 200}, step: 1, def: 40, format: px0, does: 'How far from the wall the push reaches.'},
  wallStrength: {key: 'collision.strength', label: 'Strength', scale: {min: 0, max: 20}, step: .05, def: 4, format: d2, does: 'The strength of the soft push near a wall.'},
  wallIntegrity: {key: 'collision.integrity', label: 'Integrity', scale: {min: 0, max: 4}, step: .01, def: .5, format: d2, does: 'How much fast particles weaken the wall. The wall heals as they calm down.'},
  radius: {key: 'pairwise.radius', label: 'Radius', scale: {min: 2, max: 80}, step: .5, def: 2.2, format: px1, does: 'How close two particles must be to touch.'},
  stiffness: {key: 'pairwise.stiffness', label: 'Stiffness', scale: {min: 0, max: 10}, step: .05, def: 1, format: d2, does: 'The spring that pushes touching particles apart.'},
  bounce: {key: 'pairwise.restitution', label: 'Bounce', scale: {min: 0, max: 1}, step: .01, def: .12, format: d2, does: 'How much speed touching particles keep.'},
  viscosity: {key: 'pairwise.viscosity', label: 'Viscosity', scale: {min: 0, max: 1}, step: .01, def: .06, format: d2, does: 'The sliding drag between touching particles.'},
  extent: {key: 'pairwise.extent', label: 'Extent', scale: {min: 200, max: 5000, log: true}, step: 25, def: 1400, format: px0, does: 'The half-width of the grid that finds touching particles.'},
} satisfies Record<string, Rule>

/** A value the owner can take: on its grid and inside its soft range. The default itself is always taken as it is. */
const settle = (r: Rule, x: number) => (x === r.def ? x : clampTo(r.scale.min, r.scale.max, Number((Math.round(x / r.step) * r.step).toPrecision(12))))
/** A number's place in its range, 0 to 1 (log where the owner's range is). */
const place = (r: Rule, x: number) => toUnit(r.scale, clampTo(r.scale.min, r.scale.max, x))
const put = (p: ViewProps, r: Rule, x: number) => p.set(r.key, settle(r, x))

type Mode = 'obstacle' | 'vessel'
const MODES: readonly Option<Mode>[] = [
  {value: 'obstacle', label: 'Obstacle', does: 'The strokes are solid. Particles from outside bounce off them.'},
  {value: 'vessel', label: 'Vessel', does: 'The strokes hold the particles whose home is inside them.'},
]
const pick = <T extends string>(options: readonly Option<T>[], x: string | undefined): T | undefined => options.find(o => o.value === x)?.value

const GLYPH_DOES = 'Turns on the solid walls of the letters.'
const PAIRS_DOES = 'Turns on contacts between particles.'
const MODE_DOES = 'Obstacle makes the strokes solid. Vessel makes the strokes hold particles inside.'
/** The speed at which the Walls page reads how much of a contact the wall holds (a reference, not a setting). */
const REF_SPEED = 1000

// ---------------------------------------------------------------- the readings

const fin = (x: number | undefined) => (x !== undefined && Number.isFinite(x) ? x : undefined)
const num = (v: V, key: string) => fin(numOf(v, key))
const lamp = (x: boolean | undefined): LightState => (x === undefined ? 'unknown' : x ? 'lit' : 'dark')

/** The device light: the owner's reading only. Lit when either section is on; dark when both are reported off. */
const lightOf = (p: ViewProps): LightState => {
  const o = p.owner ?? p.v, g = boolOf(o, K.glyph), q = boolOf(o, K.pairs)
  return g === true || q === true ? 'lit' : g === false && q === false ? 'dark' : 'unknown'
}
/** The activator is the owner's strip rule: off clears both sections, on enables the glyph walls only. */
const head = (p: ViewProps) => {
  const light = lightOf(p)
  return {
    light, lightWhy: st(p, K.glyph).disabled, onFold: p.nav.fold, onFull: p.nav.full,
    onLight: () => {
      if (light === 'lit') {
        if (boolOf(p.v, K.glyph) !== false) p.set(K.glyph, false)
        if (boolOf(p.v, K.pairs) !== false) p.set(K.pairs, false)
      } else p.set(K.glyph, true)
    },
  }
}

// ---------------------------------------------------------------- geometry of the picture

type Pt = {readonly x: number; readonly y: number}
/** A line a handle runs along: its origin (the soft minimum), its direction and its length (the soft range). */
interface Track {readonly x: number; readonly y: number; readonly dx: number; readonly dy: number; readonly len: number; readonly n: number}
const onTrack = (t: Track, u: number): Pt => ({x: t.x + t.dx * t.len * u, y: t.y + t.dy * t.len * u})
const alongTrack = (t: Track, x: number, y: number) => clampTo(0, 1, ((x - t.x) * t.dx + (y - t.y) * t.dy) / t.len)
const trackD = (t: Track) => `M${t.x} ${t.y}L${t.x + t.dx * t.len} ${t.y + t.dy * t.len}`

interface WallGeo {
  readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number
  readonly bandMax: number; readonly arrowMin: number; readonly arrowSpan: number; readonly dot: number
  readonly head?: Pt; readonly foot?: Pt; readonly long?: boolean; readonly room: number
  readonly band?: Track; readonly bounce?: Track; readonly integrity?: Track
}
interface PairGeo {
  readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number
  readonly rMin: number; readonly rSpan: number; readonly coilAmp: number
  readonly normMin: number; readonly normSpan: number; readonly tanMin: number; readonly tanSpan: number; readonly dot: number
  readonly head?: Pt; readonly foot?: Pt; readonly long?: boolean; readonly room: number
  readonly radius?: Track; readonly stiffness?: Track; readonly bounce?: Track; readonly viscosity?: Track
}
interface Layout {readonly w: number; readonly h: number; readonly wall?: WallGeo; readonly pair?: PairGeo; readonly corner?: 'bounce' | 'mode' | 'radius'}

const COMPACT: Layout = {
  w: 140, h: 146, corner: 'bounce',
  wall: {cx: 74, cy: 33, rx: 28, ry: 15, bandMax: 11, arrowMin: 4, arrowSpan: 12, dot: 1.8, head: {x: 5, y: 9}, room: 24,
    band: {x: 22, y: 63, dx: 1, dy: 0, len: 100, n: 1}, bounce: {x: 9, y: 58, dx: 0, dy: -1, len: 34, n: 2}},
  pair: {ax: 52, ay: 108, bx: 98, by: 108, rMin: 4, rSpan: 20, coilAmp: 4, normMin: 4, normSpan: 14, tanMin: 3, tanSpan: 10, dot: 3, head: {x: 5, y: 80}, room: 24,
    radius: {x: 20, y: 137, dx: 1, dy: 0, len: 90, n: 3}, bounce: {x: 130, y: 132, dx: 0, dy: -1, len: 36, n: 4}},
}
const WALLS: Layout = {
  // No corner: the head line already names the wall mode.
  w: 194, h: 146,
  wall: {cx: 104, cy: 64, rx: 52, ry: 28, bandMax: 18, arrowMin: 6, arrowSpan: 22, dot: 2.2, head: {x: 5, y: 11}, foot: {x: 5, y: 141}, long: true, room: 34,
    band: {x: 22, y: 124, dx: 1, dy: 0, len: 150, n: 1}, bounce: {x: 10, y: 112, dx: 0, dy: -1, len: 80, n: 2}, integrity: {x: 184, y: 112, dx: 0, dy: -1, len: 80, n: 3}},
}
const PAIRS: Layout = {
  w: 194, h: 146, corner: 'radius',
  pair: {ax: 64, ay: 66, bx: 134, by: 66, rMin: 8, rSpan: 38, coilAmp: 5, normMin: 8, normSpan: 26, tanMin: 6, tanSpan: 24, dot: 4, head: {x: 5, y: 11}, foot: {x: 5, y: 141}, long: true, room: 34,
    radius: {x: 22, y: 124, dx: 1, dy: 0, len: 150, n: 1}, stiffness: {x: 10, y: 112, dx: 0, dy: -1, len: 80, n: 2}, bounce: {x: 184, y: 112, dx: 0, dy: -1, len: 80, n: 3},
    viscosity: {x: 134, y: 78, dx: 0, dy: 1, len: 24, n: 4}},
}
const TILE: Layout = {
  w: 112, h: 104,
  wall: {cx: 56, cy: 25, rx: 26, ry: 12, bandMax: 7, arrowMin: 3, arrowSpan: 9, dot: 1.5, room: 18},
  pair: {ax: 32, ay: 78, bx: 74, by: 78, rMin: 3, rSpan: 14, coilAmp: 3, normMin: 3, normSpan: 10, tanMin: 2, tanSpan: 8, dot: 2.5, room: 18},
}
/** The pane: both halves side by side at pane size, with no handles. */
const PANE = {w: 960, h: 540}
const WALL_PANE: WallGeo = {cx: 245, cy: 290, rx: 160, ry: 100, bandMax: 46, arrowMin: 16, arrowSpan: 60, dot: 7, head: {x: 30, y: 44}, foot: {x: 30, y: 500}, long: true, room: 60}
const PAIR_PANE: PairGeo = {ax: 640, ay: 290, bx: 840, by: 290, rMin: 16, rSpan: 110, coilAmp: 14, normMin: 16, normSpan: 60, tanMin: 12, tanSpan: 44, dot: 12, head: {x: 520, y: 44}, foot: {x: 520, y: 500}, long: true, room: 60}

/** A head-tipped arrow from a to b. */
function arrowD(a: Pt, b: Pt, head: number): string {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len
  const bx = b.x - ux * head, by = b.y - uy * head
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}M${(bx - uy * head * .6).toFixed(1)} ${(by + ux * head * .6).toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}L${(bx + uy * head * .6).toFixed(1)} ${(by - ux * head * .6).toFixed(1)}`
}
/** Closed ellipse as two arcs, for the even-odd annulus of the contact band. */
const ellipseD = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`
/** The room the words have: names of the readings the picture lacks, or their count when the names do not fit. */
const lackText = (names: readonly string[], room: number) => {
  if (!names.length) return undefined
  const full = `No reading of ${names.join(', ')}`
  return full.length <= room ? full : `No reading of ${names.length} settings`
}
const RIM = [-2.2, -.9, .5] as const

// ---------------------------------------------------------------- the glyph wall

function Wall({p, g}: {p: ViewProps; g: WallGeo}) {
  const on = boolOf(p.v, K.glyph), mode = pick(MODES, strOf(p.v, K.mode))
  const band = num(p.v, R.wallBand.key), bounce = num(p.v, R.wallBounce.key), integrity = num(p.v, R.wallIntegrity.key)
  const free = (r: Rule) => !st(p, r.key).disabled
  const drag = (t: Track | undefined, r: Rule) => (t && free(r) ? (x: number, y: number) => put(p, r, fromUnit(r.scale, alongTrack(t, x, y))) : undefined)
  const reset = (r: Rule) => (free(r) ? () => p.set(r.key, r.def) : undefined)
  const bandW = band === undefined ? undefined : 1 + (g.bandMax - 1) * place(R.wallBand, band)
  const weak = integrity === undefined ? 0 : 30 * place(R.wallIntegrity, integrity)
  const length = bounce === undefined ? undefined : g.arrowMin + g.arrowSpan * clampTo(0, 1, bounce)
  const sign = mode === 'vessel' ? -1 : 1
  const rim = (a: number): Pt => ({x: g.cx + g.rx * Math.cos(a), y: g.cy + g.ry * Math.sin(a)})
  const outward = (a: number): Pt => { const x = Math.cos(a) / g.rx, y = Math.sin(a) / g.ry, l = Math.hypot(x, y); return {x: x / l, y: y / l} }
  const bandD = bandW === undefined || !mode ? undefined
    : mode === 'vessel' ? ellipseD(g.cx, g.cy, g.rx, g.ry) + ellipseD(g.cx, g.cy, g.rx - bandW, g.ry - bandW)
      : ellipseD(g.cx, g.cy, g.rx + bandW, g.ry + bandW) + ellipseD(g.cx, g.cy, g.rx, g.ry)
  const lacks = [band === undefined && 'band', bounce === undefined && 'bounce', g.integrity && integrity === undefined && 'integrity'].filter((x): x is string => !!x)
  const note = lackText(lacks, g.room)
  const title = g.long
    ? (on === undefined ? 'Glyph walls · —' : on ? `Glyph walls · ${mode ?? NONE} · stand-in ellipse` : 'Glyph walls off · not solved')
    : (on === undefined ? 'walls —' : on ? (mode ?? NONE) : 'walls off')
  return <>
    {g.head && <text x={g.head.x} y={g.head.y} className="dp-axis">{title}</text>}
    {note && g.head && <text x={g.head.x + (g.long ? 0 : 12)} y={g.head.y + 10} className="ct-note">{note}</text>}
    {[g.band, g.bounce, g.integrity].map((t, i) => t && <path key={i} d={trackD(t)} className="dp-faint" />)}
    <g className="ct-half" data-off={on === false ? 'true' : undefined}>
      {bandD && <path d={bandD} className="ct-band" />}
      <ellipse cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} pathLength={100} className="ct-rim" strokeDasharray={weak > .5 ? `${100 - weak} ${weak}` : undefined} />
      {mode && length !== undefined && RIM.map(a => {
        const from = rim(a), n = outward(a), tip = {x: from.x + sign * n.x * length, y: from.y + sign * n.y * length}
        return <g key={a}><path d={arrowD(from, tip, Math.max(2, g.dot * 1.4))} className="ct-arrow" /><circle cx={tip.x} cy={tip.y} r={g.dot} className="ct-dot" /></g>
      })}
    </g>
    {g.foot && <text x={g.foot.x} y={g.foot.y} className="dp-axis">{`band ${band === undefined ? NONE : px0(band)} · bounce ${bounce === undefined ? NONE : d2(bounce)}`}</text>}
    {g.band && band !== undefined && <Handle n={g.band.n} shape="square" {...onTrack(g.band, place(R.wallBand, band))} label="Wall band" does="Drag along the line: how far from the wall the push reaches."
      onDrag={drag(g.band, R.wallBand)} onReset={reset(R.wallBand)} />}
    {g.bounce && bounce !== undefined && <Handle n={g.bounce.n} {...onTrack(g.bounce, place(R.wallBounce, bounce))} label="Wall bounce" does="Drag up the line: how much speed a particle keeps when it hits a wall."
      onDrag={drag(g.bounce, R.wallBounce)} onReset={reset(R.wallBounce)} />}
    {g.integrity && integrity !== undefined && <Handle n={g.integrity.n} shape="ring" {...onTrack(g.integrity, place(R.wallIntegrity, integrity))} label="Wall integrity" does="Drag up the line: how much fast particles weaken the wall."
      onDrag={drag(g.integrity, R.wallIntegrity)} onReset={reset(R.wallIntegrity)} />}
  </>
}

// ---------------------------------------------------------------- the particle pair

function Pair({p, g}: {p: ViewProps; g: PairGeo}) {
  const on = boolOf(p.v, K.pairs)
  const radius = num(p.v, R.radius.key), stiffness = num(p.v, R.stiffness.key), bounce = num(p.v, R.bounce.key), viscosity = num(p.v, R.viscosity.key), extent = num(p.v, R.extent.key)
  const free = (r: Rule) => !st(p, r.key).disabled
  const drag = (t: Track | undefined, r: Rule) => (t && free(r) ? (x: number, y: number) => put(p, r, fromUnit(r.scale, alongTrack(t, x, y))) : undefined)
  const reset = (r: Rule) => (free(r) ? () => p.set(r.key, r.def) : undefined)
  const reach = radius === undefined ? undefined : g.rMin + g.rSpan * place(R.radius, radius)
  const coils = stiffness === undefined ? undefined : 3 + Math.round(9 * place(R.stiffness, stiffness))
  const a: Pt = {x: g.ax, y: g.ay}, b: Pt = {x: g.bx, y: g.by}
  let spring = ''
  if (coils !== undefined) {
    const x0 = a.x + g.dot + 1, x1 = b.x - g.dot - 1, segments = coils * 2
    spring = `M${x0} ${a.y}`
    for (let i = 1; i <= segments; i++) spring += `L${(x0 + (x1 - x0) * i / segments).toFixed(1)} ${i === segments ? a.y : a.y + (i % 2 ? -g.coilAmp : g.coilAmp)}`
  }
  const normal = bounce === undefined ? undefined : arrowD({x: b.x + g.dot + 1, y: b.y}, {x: b.x + g.dot + 1 + g.normMin + g.normSpan * clampTo(0, 1, bounce), y: b.y}, Math.max(2, g.dot * .8))
  const tangent = viscosity === undefined ? undefined : arrowD({x: b.x, y: b.y + g.dot + 2}, {x: b.x, y: b.y + g.dot + 2 + g.tanMin + g.tanSpan * clampTo(0, 1, viscosity)}, Math.max(2, g.dot * .8))
  const lacks = [radius === undefined && 'radius', stiffness === undefined && 'stiffness', bounce === undefined && 'bounce', viscosity === undefined && 'viscosity'].filter((x): x is string => !!x)
  const note = lackText(lacks, g.room)
  const title = g.long ? (on === undefined ? 'Particle pairs · —' : on ? 'Particle pairs · contact radius' : 'Particle pairs off · not solved') : (on === undefined ? 'pairs —' : on ? 'pairs' : 'pairs off')
  return <>
    {g.head && <text x={g.head.x} y={g.head.y} className="dp-axis">{title}</text>}
    {note && g.head && <text x={g.head.x + (g.long ? 0 : 12)} y={g.head.y + 10} className="ct-note">{note}</text>}
    {[g.radius, g.stiffness, g.bounce, g.viscosity].map((t, i) => t && <path key={i} d={trackD(t)} className="dp-faint" />)}
    <g className="ct-half" data-off={on === false ? 'true' : undefined}>
      {reach !== undefined && <circle cx={a.x} cy={a.y} r={reach} className="ct-reach" />}
      {spring && <path d={spring} className="ct-spring" />}
      {normal && <path d={normal} className="ct-arrow" />}
      {tangent && <path d={tangent} className="ct-arrow" />}
      <circle cx={a.x} cy={a.y} r={g.dot} className="ct-dot" />
      <circle cx={b.x} cy={b.y} r={g.dot} className="ct-dot" />
    </g>
    {g.foot && <text x={g.foot.x} y={g.foot.y} className="dp-axis">{`radius ${radius === undefined ? NONE : px1(radius)} · grid ±${extent === undefined ? NONE : px0(extent)}`}</text>}
    {g.radius && radius !== undefined && <Handle n={g.radius.n} shape="ring" {...onTrack(g.radius, place(R.radius, radius))} label="Contact radius" does="Drag along the line: how close two particles must be to touch."
      onDrag={drag(g.radius, R.radius)} onReset={reset(R.radius)} />}
    {g.stiffness && stiffness !== undefined && <Handle n={g.stiffness.n} shape="square" {...onTrack(g.stiffness, place(R.stiffness, stiffness))} label="Contact stiffness" does="Drag up the line: the spring that pushes touching particles apart."
      onDrag={drag(g.stiffness, R.stiffness)} onReset={reset(R.stiffness)} />}
    {g.bounce && bounce !== undefined && <Handle n={g.bounce.n} {...onTrack(g.bounce, place(R.bounce, bounce))} label="Contact bounce" does="Drag up the line: how much speed touching particles keep."
      onDrag={drag(g.bounce, R.bounce)} onReset={reset(R.bounce)} />}
    {g.viscosity && viscosity !== undefined && <Handle n={g.viscosity.n} {...onTrack(g.viscosity, place(R.viscosity, viscosity))} label="Contact viscosity" does="Drag down the arrow: the sliding drag between touching particles."
      onDrag={drag(g.viscosity, R.viscosity)} onReset={reset(R.viscosity)} />}
  </>
}

function Picture({p, g}: {p: ViewProps; g: Layout}) {
  const bounce = g.corner === 'bounce' ? `${shown(p.v, R.wallBounce.key, x => d2(Number(x)))} · ${shown(p.v, R.bounce.key, x => d2(Number(x)))}` : undefined
  const corner = g.corner === 'bounce' ? bounce : g.corner === 'mode' ? shown(p.v, K.mode, String) : g.corner === 'radius' ? shown(p.v, R.radius.key, x => px1(Number(x))) : undefined
  const handles = [g.wall?.band, g.wall?.bounce, g.pair?.radius].some(Boolean)
  return <Display w={g.w} h={g.h} label="The contacts" corner={corner}
    does={handles ? 'Walls and touching particles. Drag the handles to set the wall and the contact values.' : 'Walls and touching particles.'}>
    {g.wall && <Wall p={p} g={g.wall} />}
    {g.pair && <Pair p={p} g={g.pair} />}
  </Display>
}

// ---------------------------------------------------------------- the controls

const dial = (p: ViewProps, r: Rule, label: string = r.label) =>
  <Dial key={r.key} {...st(p, r.key)} label={label} does={r.does} value={numOf(p.v, r.key) as number} def={r.def} scale={r.scale} format={r.format} onChange={x => put(p, r, x)} />
const box = (p: ViewProps, r: Rule, label: string) =>
  <ValueBox key={r.key} {...st(p, r.key)} label={label} does={r.does} value={numOf(p.v, r.key) as number} def={r.def} scale={r.scale} format={r.format} onChange={x => put(p, r, x)} />

const glyphToggle = (p: ViewProps) =>
  <Toggle {...st(p, K.glyph)} label="Glyph walls" does={GLYPH_DOES} on={boolOf(p.v, K.glyph) === true} unknown={boolOf(p.v, K.glyph) === undefined} onChange={x => p.set(K.glyph, x)} />
const pairsToggle = (p: ViewProps) =>
  <Toggle {...st(p, K.pairs)} label="Particle contacts" does={PAIRS_DOES} on={boolOf(p.v, K.pairs) === true} unknown={boolOf(p.v, K.pairs) === undefined} onChange={x => p.set(K.pairs, x)} />
const modeRadio = (p: ViewProps) =>
  <Radio {...st(p, K.mode)} label="Wall mode" does={MODE_DOES} value={(pick(MODES, strOf(p.v, K.mode)) ?? '') as Mode} options={MODES} stack onChange={x => p.set(K.mode, x)} />

/** How much of a contact the wall holds against a particle at the reference speed, at the surface (simulationShaders.ts:1065: 1 ÷ (1 + integrity × speed × 0.01)). */
const holds = (v: V): string | undefined => { const i = num(v, R.wallIntegrity.key); return i === undefined ? undefined : `${Math.round(100 / (1 + i * REF_SPEED * .01))} %` }
/** The cell of the sorted grid and the cells across it (pairwiseSchedule.ts:125-127: the cell is the radius, or wider when 512 cells would not span the extent). */
function gridOf(v: V): {cell: string; across: string} | undefined {
  const h = num(v, R.radius.key), e = num(v, R.extent.key)
  if (h === undefined || e === undefined) return undefined
  const cell = Math.max(h, 2 * e / 512)
  return {cell: px1(cell), across: String(Math.min(512, Math.max(1, Math.ceil(2 * e / cell))))}
}

// ---------------------------------------------------------------- the pane: the field's law at pane size

function ContactsField({p}: {p: ViewProps}) {
  const f = (r: Rule) => shown(p.v, r.key, x => r.format(Number(x)))
  const grid = gridOf(p.v)
  return <div className="ct-pane">
    <svg viewBox={`0 0 ${PANE.w} ${PANE.h}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="The field">
      <path d={`M${PANE.w / 2} 70V${PANE.h - 50}`} className="ct-rule" />
      <Wall p={p} g={WALL_PANE} />
      <Pair p={p} g={PAIR_PANE} />
      <text x={30} y={PANE.h - 24} className="ct-line">{`friction ${f(R.wallFriction)} · strength ${f(R.wallStrength)} · integrity ${f(R.wallIntegrity)}`}</text>
      <text x={520} y={PANE.h - 24} className="ct-line">{`stiffness ${f(R.stiffness)} · bounce ${f(R.bounce)} · viscosity ${f(R.viscosity)} · cell ${grid ? grid.cell : NONE}`}</text>
    </svg>
  </div>
}

// ---------------------------------------------------------------- the device

/** Every key the owner reports: the "No readings" fixture drops all of them. */
const KEYS = [...Object.values(K), ...Object.values(R).map(r => r.key)]
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'expressions:contacts',
  title: 'Contacts',
  kind: 'effect',
  firstPage: 'walls',
  defaults: {
    [K.glyph]: false, [K.mode]: 'obstacle', [K.pairs]: false,
    [R.wallBounce.key]: R.wallBounce.def, [R.wallFriction.key]: R.wallFriction.def, [R.wallBand.key]: R.wallBand.def, [R.wallStrength.key]: R.wallStrength.def, [R.wallIntegrity.key]: R.wallIntegrity.def,
    [R.radius.key]: R.radius.def, [R.stiffness.key]: R.stiffness.def, [R.bounce.key]: R.bounce.def, [R.viscosity.key]: R.viscosity.def, [R.extent.key]: R.extent.def,
  },
  fixtures: {
    'Both on': {[K.glyph]: true, [K.pairs]: true},
    'Vessel, bouncy': {
      [K.glyph]: true, [K.pairs]: true, [K.mode]: 'vessel', [R.wallBounce.key]: .8, [R.wallBand.key]: 120, [R.wallIntegrity.key]: 3,
      [R.radius.key]: 30, [R.stiffness.key]: 6, [R.bounce.key]: .7, [R.viscosity.key]: .6,
    },
    'No readings': NOTHING,
  },

  folded: p => <Folded title="Contacts" light={lightOf(p)} onUnfold={p.nav.unfold}
    readings={[shown(p.v, K.mode, String), `${shown(p.v, R.wallBounce.key, x => d2(Number(x)))} · ${shown(p.v, R.bounce.key, x => d2(Number(x)))}`]} />,

  compact: p => <Panel title="Contacts" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><Picture p={p} g={COMPACT} /></Section>
    <Section label="Wall" cols={1}>
      {dial(p, R.wallBounce)}
      {dial(p, R.wallBand)}
    </Section>
    <Section label="Pairs" cols={1}>
      {dial(p, R.radius)}
      {dial(p, R.stiffness)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Contacts" view="whole" {...head(p)}
    pages={[{id: 'walls', label: 'Walls', light: lamp(boolOf(p.owner ?? p.v, K.glyph))}, {id: 'contacts', label: 'Contacts', light: lamp(boolOf(p.owner ?? p.v, K.pairs))}]}
    page={p.page} onPage={p.setPage}>
    {p.page !== 'contacts' ? <>
      <Band>
        <Section width={206}><Picture p={p} g={WALLS} /></Section>
        <Section label="Wall" cols={2} grow>
          {dial(p, R.wallBounce)}
          {dial(p, R.wallFriction)}
          {dial(p, R.wallBand)}
          {dial(p, R.wallStrength)}
        </Section>
      </Band>
      <Band>
        <Section label="Walls" width={96}>
          {glyphToggle(p)}
          {modeRadio(p)}
        </Section>
        <Section label="Weakening" cols={1}>
          {dial(p, R.wallIntegrity)}
        </Section>
        <Section label="Reading" grow>
          <Readout big tone="value" label={`holds at ${REF_SPEED} px/s`} does="How much of a contact the wall keeps against a particle at this speed. Integrity lowers it." value={holds(p.v)} />
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={206}><Picture p={p} g={PAIRS} /></Section>
        <Section label="Contact" cols={2} grow>
          {dial(p, R.radius)}
          {dial(p, R.stiffness)}
          {dial(p, R.bounce)}
          {dial(p, R.viscosity)}
        </Section>
      </Band>
      <Band>
        <Section label="Contacts" width={96}>
          {pairsToggle(p)}
        </Section>
        <Section label="Grid" cols={1}>
          {dial(p, R.extent)}
        </Section>
        <Section label="Reading" grow>
          <Readout big tone="value" label="cell" does="The width of one cell of the grid. It is the radius, or wider when 512 cells do not span the extent." value={gridOf(p.v)?.cell} />
          <Readout label="cells across" does="How many cells span the grid." value={gridOf(p.v)?.across} />
        </Section>
      </Band>
    </>}
  </Panel>,

  full: p => <ContactsField p={p} />,

  widget: p => <Tile title="Contacts" light={lightOf(p)} span={2} onFull={p.nav.full}>
    <Picture p={p} g={TILE} />
    <div className="ct-tile-grid">
      {box(p, R.wallBounce, 'Wall bounce')}
      {box(p, R.wallBand, 'Wall band')}
      {box(p, R.radius, 'Contact radius')}
      {box(p, R.stiffness, 'Contact stiffness')}
    </div>
  </Tile>,
}
