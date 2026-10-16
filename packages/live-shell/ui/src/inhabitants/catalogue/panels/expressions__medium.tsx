// Medium (manual §20.6, expressions:medium): the shared fluid the particles move through. Live's nearest: Hybrid Reverb — a well that draws
// what the device keeps (the flow, which fades by its persistence) with the small laws beside it, and dials ruled off round it. The shell's
// own diagram (components/NativeFieldFace.medium.tsx) shows the coupling and the grid; this panel draws the engine's law (GPGPUSimulator.ts
// stepMedium, mediumShaders.ts, simulationShaders.ts 7C):
//   splat      each particle adds its velocity x Splat gain to the cell under it (mediumShaders.ts:140)
//   persist    each frame the flow keeps persistence^(60 dt) of itself (GPGPUSimulator.ts advect: uDissipation)
//   pressure   Pressure iterations Jacobi steps (rounded, 1..12) make the flow divergence-free (GPGPUSimulator.ts:1222)
//   on a particle  force = -gradient(pressure) x Pressure x 40 + (flow - velocity) x Coupling x 6 (simulationShaders.ts:956, :1018)
//   the grid   covers -Extent..+Extent in each axis: Grid cells across in 2D; in 3D a cube of N = round(Grid / 6) kept in 16..64 cells a side
//              (GPGPUSimulator.ts:1016-1040, mediumGrid.ts). A cell is 2 x Extent / cells wide, in world pixels.
// The well is a window on the world at true scale (one well pixel is one world pixel): the grid's cells are drawn at their width, and the flow
// is shown one arrow to a lattice point, a stirrer's trail splatted and faded by the persistence. A drawing scale, not an engine value, sets
// the stirrer's speed and the arrow lengths. The pressure projection is not drawn.
//
// Everything the device draws is a value key, the binding's own path (NATIVE_BINDINGS, nativeParameters.ts) or the panel setting's key
// (nativeDeviceEdits.ts). The owners report:
//   medium.pressure     0..20 (soft; typed to 200), default 4      paramRegistry.ts:148, fieldDefaults.ts:56
//   medium.coupling     0..4 (typed to 20), default 0.8
//   medium.persistence  0.8..1 (typed 0..1), default 0.97
//   medium.splatGain    0..4 (typed to 20), default 1
//   medium.iterations   1..12 whole steps, default 4
//   medium.gridRes      64..512 (typed 16..1024; the engine clamps 16..1024), default 192
//   medium.extent       200..5000 px, log (typed to 20000), default 1400: the HALF width the grid covers (the registry hint, mediumGrid.ts)
//   mediumEnabled       on | off, default off (model.ts DEFAULT_ENGINE_SETTINGS); the device's light
//   mediumDimension     2D | 3D, default 2D
//   mediumPlane         vertical | horizontal, default vertical: a reading here; the Physics device sets it (parameterAddress.ts:67)
// A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {useEffect, useRef, useState, type PointerEvent as PointerEventOf, type ReactElement} from 'react'
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState, type Option, type Scale} from '../../sdk/panel'
import {boolOf, clampTo, fixed, NONE, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './expressions__medium.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary (the owner's registry, not data)

const K = {
  pressure: 'medium.pressure', coupling: 'medium.coupling', persistence: 'medium.persistence', splat: 'medium.splatGain',
  iterations: 'medium.iterations', grid: 'medium.gridRes', extent: 'medium.extent', on: 'mediumEnabled', dimension: 'mediumDimension', plane: 'mediumPlane',
} as const
type NumKey = 'pressure' | 'coupling' | 'persistence' | 'splat' | 'iterations' | 'grid' | 'extent'

/** The soft range, the grid step and the owner's default of each number (paramRegistry.ts:148-154 over fieldDefaults.ts:54). */
const RULE: Readonly<Record<NumKey, {readonly scale: Scale; readonly step: number; readonly def: number}>> = {
  pressure: {scale: {min: 0, max: 20}, step: .05, def: 4},
  coupling: {scale: {min: 0, max: 4}, step: .01, def: .8},
  persistence: {scale: {min: .8, max: 1}, step: .002, def: .97},
  splat: {scale: {min: 0, max: 4}, step: .01, def: 1},
  iterations: {scale: {min: 1, max: 12, step: 1}, step: 1, def: 4},
  grid: {scale: {min: 64, max: 512}, step: 4, def: 192},
  extent: {scale: {min: 200, max: 5000, log: true}, step: 10, def: 1400},
}
const snap = (k: NumKey, x: number) => {
  const {scale, step} = RULE[k]
  return clampTo(scale.min, scale.max, Number((Math.round(x / step) * step).toPrecision(12)))
}

type Dim = '2D' | '3D'
const DIMS: readonly Option<Dim>[] = [
  {value: '2D', label: '2D', does: 'A flat fluid: one sheet of cells.'},
  {value: '3D', label: '3D', does: 'A fluid with depth: a cube of cells. Its side is one sixth of Grid, from 16 to 64 cells.'},
]
const pick = <T extends string>(options: readonly Option<T>[], x: string | undefined): T | undefined => options.find(o => o.value === x)?.value

// ---------------------------------------------------------------- the readings

const fin = (x: number | undefined) => (x !== undefined && Number.isFinite(x) ? x : undefined)
/** Every reading of the device, absent when the owner has not reported it. */
function read(v: V) {
  return {
    pressure: fin(numOf(v, K.pressure)), coupling: fin(numOf(v, K.coupling)), persistence: fin(numOf(v, K.persistence)), splat: fin(numOf(v, K.splat)),
    iterations: fin(numOf(v, K.iterations)), grid: fin(numOf(v, K.grid)), extent: fin(numOf(v, K.extent)),
    dimension: pick(DIMS, strOf(v, K.dimension)), plane: strOf(v, K.plane),
  }
}
type Reading = ReturnType<typeof read>

/** The cells along one side of the solver: the grid in 2D; in 3D the cube's side, round(grid / 6) kept in 16..64 (mediumGrid.ts). */
function sideOf(r: Reading): number | undefined {
  if (r.grid === undefined || r.dimension === undefined) return undefined
  const res = clampTo(16, 1024, Math.round(r.grid))
  return r.dimension === '3D' ? clampTo(16, 64, Math.round(res / 6)) : res
}
/** The half width of the world the grid covers, as the engine clamps it. */
const halfOf = (r: Reading) => (r.extent === undefined ? undefined : clampTo(200, 20000, r.extent))
/** One cell's width in world pixels: the grid covers -extent..+extent. */
function cellOf(r: Reading): number | undefined {
  const n = sideOf(r), e = halfOf(r)
  return n === undefined || e === undefined ? undefined : 2 * e / n
}
const px = (x: number) => `${Math.round(x)} px`
const cellText = (c: number) => `${c < 10 ? c.toFixed(1) : String(Math.round(c))} px`
const d2 = fixed(2), d3 = fixed(3)

/** The light reads the owner alone (manual §16.8). */
const lightOf = (p: ViewProps): LightState => { const b = boolOf(p.owner ?? p.v, K.on); return b === undefined ? 'unknown' : b ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({
  light: lightOf(p), lightWhy: st(p, K.on).disabled, onLight: () => p.set(K.on, boolOf(p.owner ?? p.v, K.on) !== true), onFold: p.nav.fold, onFull: p.nav.full,
})

// ---------------------------------------------------------------- the picture

interface Layout {
  readonly w: number; readonly h: number
  /** The window on the world, and where the stirrer's head stands in it. */
  readonly win: {readonly x: number; readonly y: number; readonly w: number; readonly h: number}
  readonly head: {readonly x: number; readonly y: number}
  /** The stirrer's speed in well pixels a frame (a drawing scale). */
  readonly speed: number
  /** The persistence curve's box. */
  readonly decay: {readonly x: number; readonly w: number; readonly top: number; readonly base: number}
  /** The push and the pull gauges: where each stands, and how long their arrows run for a unit (1 = full). */
  readonly push: {readonly x: number; readonly y: number}
  readonly pull: {readonly x: number; readonly y: number}
  readonly gs: number
  /** How many handles stand in the well (0 for the widget). */
  readonly handles: 0 | 4 | 5
}
const COMPACT: Layout = {w: 140, h: 146, win: {x: 4, y: 16, w: 132, h: 68}, head: {x: 74, y: 50}, speed: .8, decay: {x: 8, w: 56, top: 98, base: 134}, push: {x: 100, y: 108}, pull: {x: 76, y: 130}, gs: 1, handles: 4}
const WHOLE: Layout = {w: 194, h: 146, win: {x: 4, y: 16, w: 186, h: 80}, head: {x: 112, y: 56}, speed: 1.1, decay: {x: 8, w: 72, top: 104, base: 136}, push: {x: 134, y: 112}, pull: {x: 104, y: 136}, gs: 1, handles: 5}
const TILE: Layout = {w: 112, h: 104, win: {x: 2, y: 14, w: 108, h: 52}, head: {x: 62, y: 40}, speed: .6, decay: {x: 4, w: 46, top: 74, base: 100}, push: {x: 82, y: 80}, pull: {x: 60, y: 96}, gs: .6, handles: 0}

/** The flow left by a stirrer: samples of its trail, a few frames apart, each with the path's direction (a gentle wave). */
const STEPS = 24, EVERY = 4, FRAMES = 120, AT = 60

/** A head-tipped arrow centred on (x, y) along the unit direction (dx, dy). */
function arrowPath(x: number, y: number, dx: number, dy: number, length: number): string {
  const sx = x - dx * length / 2, sy = y - dy * length / 2, tx = x + dx * length / 2, ty = y + dy * length / 2
  const bx = tx - dx * Math.min(3, length * .45), by = ty - dy * Math.min(3, length * .45), wing = 1.9
  return `M${sx.toFixed(2)} ${sy.toFixed(2)}L${tx.toFixed(2)} ${ty.toFixed(2)}M${(bx - dy * wing).toFixed(2)} ${(by + dx * wing).toFixed(2)}L${tx.toFixed(2)} ${ty.toFixed(2)}L${(bx + dy * wing).toFixed(2)} ${(by - dx * wing).toFixed(2)}`
}
/** Lines of a grid of the given spacing across a window, as one path. */
function linesPath(win: Layout['win'], spacing: number, back?: boolean): string {
  let d = ''
  for (let x = win.x + spacing; x < win.x + win.w - .5; x += spacing) d += back ? `M${(x + 3).toFixed(1)} ${win.y}V${win.y + win.h - 3}` : `M${x.toFixed(1)} ${win.y}V${win.y + win.h}`
  for (let y = win.y + spacing; y < win.y + win.h - .5; y += spacing) d += back ? `M${win.x + 3} ${(y - 3).toFixed(1)}H${win.x + win.w}` : `M${win.x} ${y.toFixed(1)}H${win.x + win.w}`
  return d
}

/** The names of the readings the picture lacks, for the well. */
const lacking = (r: Reading) => [r.splat === undefined && 'splat', r.persistence === undefined && 'persistence', r.pressure === undefined && 'pressure', r.coupling === undefined && 'coupling',
  r.extent === undefined && 'extent', r.grid === undefined && 'grid', r.dimension === undefined && 'dimension'].filter((x): x is string => !!x)

function Picture({p, g}: {p: ViewProps; g: Layout}) {
  const r = read(p.v), on = boolOf(p.owner ?? p.v, K.on), {win} = g
  const cell = cellOf(r), side = sideOf(r), canDrag = (key: string) => !st(p, key).disabled
  const put = (k: NumKey, x: number) => p.set(K[k], snap(k, x))
  const reset = (k: NumKey) => () => p.set(K[k], RULE[k].def)
  const hx = g.head.x, hy = g.head.y
  const slope = (x: number) => 7 / 18 * Math.cos((x - hx) / 18)
  const trail = Array.from({length: STEPS}, (_, j) => {
    const x = hx - j * EVERY * g.speed, s = slope(x), n = Math.hypot(1, s)
    return {x, y: hy + 7 * Math.sin((x - hx) / 18), dx: 1 / n, dy: s / n, age: j * EVERY}
  })
  const d0 = {x: 1 / Math.hypot(1, slope(hx)), y: slope(hx) / Math.hypot(1, slope(hx))}

  // The flow: one arrow to a lattice point, the trail splatted with a hat as wide as a cell and faded by persistence^age.
  const arrows: ReactElement[] = []
  if (cell !== undefined && r.splat !== undefined && r.persistence !== undefined) {
    const ds = clampTo(8, 20, cell), R = Math.max(cell, 8), spacing = EVERY * g.speed
    const share = trail.map(t => r.persistence! ** t.age)
    for (let qx = win.x + ds / 2; qx <= win.x + win.w - ds / 2 + .01; qx += ds) for (let qy = win.y + ds / 2; qy <= win.y + win.h - ds / 2 + .01; qy += ds) {
      let fx = 0, fy = 0
      trail.forEach((t, j) => {
        const d = Math.hypot(qx - t.x, qy - t.y)
        if (d >= R) return
        const w = (1 - d / R) * share[j] * spacing / R
        fx += w * t.dx; fy += w * t.dy
      })
      const raw = Math.hypot(fx, fy), mag = raw * r.splat
      if (mag < .05) continue
      arrows.push(<path key={`${qx}-${qy}`} className="me-flow" opacity={.35 + .65 * Math.min(1, mag)}
        d={arrowPath(qx, qy, fx / raw, fy / raw, ds * 1.1 * Math.min(1, mag / 1.2))} />)
    }
  }

  // The persistence curve: the share of the flow left after n frames, persistence^n; handle 2 stands at one second.
  const dc = g.decay, dh = dc.base - dc.top
  const curve = r.persistence === undefined ? '' : Array.from({length: FRAMES / 4 + 1}, (_, i) => `${i ? 'L' : 'M'}${(dc.x + dc.w * i * 4 / FRAMES).toFixed(2)} ${(dc.base - dh * r.persistence! ** (i * 4)).toFixed(2)}`).join('')
  const atX = dc.x + dc.w * AT / FRAMES, atY = r.persistence === undefined ? undefined : dc.base - dh * r.persistence ** AT

  // The push and the pull: the force on a particle for a unit of pressure gradient (x 40) and of flow (x 6). The arrow runs as the setting.
  const pushLen = r.pressure === undefined ? undefined : (1.2 * r.pressure + 1) * g.gs
  const pullLen = r.coupling === undefined ? undefined : (11 * r.coupling + 1) * g.gs
  const spLen = r.splat === undefined ? undefined : Math.min(36, 9 * r.splat) * g.gs

  const grid = cell === undefined ? '' : linesPath(win, cell * Math.max(1, Math.ceil(4 / cell)))
  const back = cell !== undefined && r.dimension === '3D' ? linesPath(win, cell * Math.max(1, Math.ceil(4 / cell)), true) : ''
  const lacks = lacking(r), empty = lacks.length === 7
  const label = `${on === undefined ? NONE : on ? 'on' : 'off'} · ${r.dimension === '3D' && side !== undefined ? `3D ${side}³` : r.dimension ?? NONE}`
  const dim = on === false ? .45 : 1
  return <Display w={g.w} h={g.h} label="The medium" corner={cell === undefined ? NONE : `cell ${cellText(cell)}`}
    does={g.handles ? 'The shared fluid: the grid at true scale, the flow a particle leaves behind, how fast it fades, and the push and pull on a particle. Drag the handles: 1 splat gain, 2 persistence, 3 pressure, 4 coupling' + (g.handles === 5 ? ', 5 extent.' : '.') : 'The shared fluid and the flow a particle leaves behind.'}>
    <text x={5} y={11} className="dp-axis">{label}</text>
    <rect x={win.x} y={win.y} width={win.w} height={win.h} className="me-win" />
    <g opacity={dim}>
      {back && <path d={back} className="me-grid-back" />}
      {grid && <path d={grid} className="me-grid" />}
      {r.splat !== undefined && <path className="me-path" d={trail.map((t, i) => `${i ? 'L' : 'M'}${t.x.toFixed(1)} ${t.y.toFixed(1)}`).join('')} />}
      {arrows}
      {r.splat !== undefined && spLen !== undefined && <>
        <circle cx={hx} cy={hy} r={2.6} className="me-source" />
        <path className="me-splat" d={arrowPath(hx + d0.x * (spLen / 2 + 3), hy + d0.y * (spLen / 2 + 3), d0.x, d0.y, Math.max(1, spLen))} />
      </>}
    </g>

    <path d={`M${dc.x} ${dc.base}H${dc.x + dc.w}M${dc.x} ${dc.top}V${dc.base}`} className="dp-faint" />
    {curve && <path d={curve} className="dp-curve" opacity={dim} />}
    {r.persistence !== undefined && <path d={`M${atX} ${dc.base}v3`} className="dp-faint" />}
    {g.handles > 0 && <text x={atX} y={dc.base + 9} className="me-label">1 s</text>}
    {g.handles > 0 && <text x={dc.x + dc.w * .62} y={dc.top + 8} className="me-label">flow left</text>}

    {g.handles > 0 && <text x={g.push.x} y={g.push.y - 9} className="me-label">push</text>}
    {pushLen !== undefined && <g opacity={dim}>
      <circle cx={g.push.x - 3} cy={g.push.y} r={1.9} className="me-dot" /><circle cx={g.push.x + 3} cy={g.push.y} r={1.9} className="me-dot" />
      <path className="me-push" d={arrowPath(g.push.x + 5 + pushLen / 2, g.push.y, 1, 0, pushLen) + arrowPath(g.push.x - 5 - pushLen / 2, g.push.y, -1, 0, pushLen)} />
    </g>}
    {g.handles > 0 && <text x={g.pull.x + 22} y={g.pull.y - 9} className="me-label">pull</text>}
    {pullLen !== undefined && <g opacity={dim}>
      <circle cx={g.pull.x} cy={g.pull.y} r={1.9} className="me-dot" />
      <path className="me-pull" d={arrowPath(g.pull.x + 3 + pullLen / 2, g.pull.y, 1, 0, pullLen)} />
    </g>}

    {empty && <text x={g.w / 2} y={g.win.y + g.win.h / 2 - 3} className="me-note"><tspan x={g.w / 2}>No reading of</tspan><tspan x={g.w / 2} dy={11}>the medium</tspan></text>}
    {!empty && lacks.length > 0 && <text x={win.x + win.w / 2} y={win.y + win.h - 4} className="me-note">{lacks.length > 3 ? `No reading of ${lacks.length} settings` : `No reading of ${lacks.join(', ')}`}</text>}

    {g.handles > 0 && r.splat !== undefined && spLen !== undefined && <Handle n={1} x={hx + d0.x * (spLen + 3)} y={hy + d0.y * (spLen + 3)} label="Splat gain"
      does="Drag along the arrow: how much motion the particles give to the flow."
      onDrag={canDrag(K.splat) ? ((x, y) => put('splat', ((x - hx) * d0.x + (y - hy) * d0.y - 3) / (9 * g.gs))) : undefined} onReset={canDrag(K.splat) ? reset('splat') : undefined} />}
    {g.handles > 0 && atY !== undefined && <Handle n={2} x={atX} y={atY} label="Persistence" does="Drag up or down on the curve: how much of the flow is left after one second."
      onDrag={canDrag(K.persistence) ? ((_, y) => put('persistence', clampTo(1e-4, 1, (dc.base - y) / dh) ** (1 / AT))) : undefined} onReset={canDrag(K.persistence) ? reset('persistence') : undefined} />}
    {g.handles > 0 && pushLen !== undefined && <Handle n={3} shape="square" x={g.push.x + 5 + pushLen} y={g.push.y} label="Pressure" does="Drag along the arrow: how hard crowded particles push each other away."
      onDrag={canDrag(K.pressure) ? (x => put('pressure', ((x - g.push.x - 5) / g.gs - 1) / 1.2)) : undefined} onReset={canDrag(K.pressure) ? reset('pressure') : undefined} />}
    {g.handles > 0 && pullLen !== undefined && <Handle n={4} shape="ring" x={g.pull.x + 3 + pullLen} y={g.pull.y} label="Coupling" does="Drag along the arrow: how strongly particles follow the flow."
      onDrag={canDrag(K.coupling) ? (x => put('coupling', ((x - g.pull.x - 3) / g.gs - 1) / 11)) : undefined} onReset={canDrag(K.coupling) ? reset('coupling') : undefined} />}
    {g.handles === 5 && cell !== undefined && side !== undefined && <>
      <path d={`M${win.x} ${win.y + 6}H${win.x + Math.min(cell, win.w - 6)}`} className="dp-faint" />
      <Handle n={5} shape="ring" x={win.x + Math.min(cell, win.w - 6)} y={win.y + 6} label="Extent" does="Drag across: the width of one cell. It sets how much of the world the grid covers."
        onDrag={canDrag(K.extent) ? (x => put('extent', clampTo(200, 5000, Math.max(1, x - win.x) * side / 2))) : undefined} onReset={canDrag(K.extent) ? reset('extent') : undefined} />
    </>}
  </Display>
}

// ---------------------------------------------------------------- the controls

const DOES: Readonly<Record<NumKey, string>> = {
  pressure: 'How hard crowded particles push each other away.',
  coupling: 'How strongly particles follow the flow.',
  persistence: 'The share of the flow that remains each frame.',
  splat: 'How much motion the particles give to the flow.',
  iterations: 'The number of solver steps each frame. More steps give a cleaner flow and cost more.',
  grid: 'The size of the solver grid. A larger grid shows finer flow and costs more.',
  extent: 'The half width of the world that the grid covers, in pixels.',
}
const FORMAT: Readonly<Record<NumKey, (x: number) => string>> = {pressure: d2, coupling: d2, persistence: d3, splat: d2, iterations: x => String(Math.round(x)), grid: x => String(Math.round(x)), extent: px}

const dial = (p: ViewProps, k: NumKey, label: string) =>
  <Dial key={k} {...st(p, K[k])} label={label} does={DOES[k]} value={numOf(p.v, K[k]) as number} def={RULE[k].def} scale={RULE[k].scale} format={FORMAT[k]}
    onChange={x => p.set(K[k], snap(k, x))} />
const box = (p: ViewProps, k: NumKey, label: string) =>
  <ValueBox key={k} {...st(p, K[k])} label={label} does={DOES[k]} value={numOf(p.v, K[k]) as number} def={RULE[k].def} scale={RULE[k].scale} format={FORMAT[k]}
    onChange={x => p.set(K[k], snap(k, x))} />

const onToggle = (p: ViewProps) =>
  <Toggle {...st(p, K.on)} label="On" does="Turns the shared fluid on or off. The light shows what the owner reports." on={boolOf(p.v, K.on) === true} unknown={boolOf(p.v, K.on) === undefined}
    onChange={x => p.set(K.on, x)} />
const dimRadio = (p: ViewProps) =>
  <Radio {...st(p, K.dimension)} label="Dimension" does="A flat fluid or a fluid with depth." value={(read(p.v).dimension ?? '') as Dim} options={DIMS} onChange={x => p.set(K.dimension, x)} />

// ---------------------------------------------------------------- the pane: the grid, and the flow the pointer leaves behind

const PANE = {w: 960, h: 540}
interface Sample {readonly x: number; readonly y: number; readonly t: number; readonly dx: number; readonly dy: number; readonly m: number; readonly seg: number}
const MAX_LIFE = 8000

function MediumField({p}: {p: ViewProps}) {
  const r = read(p.v), on = boolOf(p.owner ?? p.v, K.on), svg = useRef<SVGSVGElement>(null)
  const trail = useRef<Sample[]>([]), last = useRef<{x: number; y: number; t: number} | null>(null), at = useRef<{x: number; y: number} | null>(null)
  const raf = useRef(0), running = useRef(false), life = useRef(0)
  const [now, setNow] = useState(0)
  const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // How long a sample of the trail matters: until persistence^frames has taken its share below 2 %.
  life.current = r.persistence === undefined || r.splat === undefined ? 0 : r.persistence >= .9995 ? MAX_LIFE : Math.min(MAX_LIFE, 1000 / 60 * Math.log(.02 / Math.max(r.splat, .02)) / Math.log(r.persistence))
  const loop = () => {
    const t = performance.now()
    trail.current = trail.current.filter(s => t - s.t < life.current)
    setNow(t)
    if (trail.current.length && !reduced) raf.current = requestAnimationFrame(loop); else running.current = false
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const spot = (e: PointerEventOf<SVGSVGElement>) => {
    const el = svg.current, m = el?.getScreenCTM()
    if (!el || !m) return null
    const pt = el.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const q = pt.matrixTransform(m.inverse())
    return {x: q.x, y: q.y}
  }
  const move = (e: PointerEventOf<SVGSVGElement>) => {
    const s = spot(e)
    if (!s) return
    const t = performance.now(), l = last.current
    at.current = s
    if (!l) { last.current = {...s, t}; return }
    const dx = s.x - l.x, dy = s.y - l.y, d = Math.hypot(dx, dy)
    if (d < 3) return
    const frames = Math.max(1, (t - l.t) / (1000 / 60))
    trail.current = [...trail.current.slice(-159), {x: s.x, y: s.y, t, dx: dx / d, dy: dy / d, m: Math.min(1, d / frames / 5), seg: d}]
    last.current = {...s, t}
    if (reduced) setNow(t); else if (!running.current) { running.current = true; raf.current = requestAnimationFrame(loop) }
  }

  const cell = cellOf(r), half = halfOf(r), side = sideOf(r), flowing = on === true && cell !== undefined && half !== undefined && r.splat !== undefined && r.persistence !== undefined
  const alive = (s: Sample) => now - s.t < life.current
  const cx = PANE.w / 2, cy = PANE.h / 2
  const lines: ReactElement[] = [], arrows: ReactElement[] = [], dots: ReactElement[] = []
  let box: ReactElement | null = null
  if (cell !== undefined && half !== undefined) {
    const gx = cx - half, gy = cy - half, gsp = cell * Math.max(1, Math.ceil(6 / cell))
    box = <rect className="me-box" x={gx} y={gy} width={2 * half} height={2 * half} />
    let dv = '', dh = ''
    for (let x = gx + gsp; x < gx + 2 * half - .5; x += gsp) if (x >= 0 && x <= PANE.w) dv += `M${x.toFixed(1)} ${Math.max(0, gy)}V${Math.min(PANE.h, gy + 2 * half)}`
    for (let y = gy + gsp; y < gy + 2 * half - .5; y += gsp) if (y >= 0 && y <= PANE.h) dh += `M${Math.max(0, gx)} ${y.toFixed(1)}H${Math.min(PANE.w, gx + 2 * half)}`
    lines.push(<path key="grid" className="me-line" d={dv + dh} />)
    if (flowing) {
      const ds = clampTo(10, 40, cell), R = Math.max(cell, 10), cells = Math.floor(2 * half / ds)
      const flow = new Map<number, [number, number]>()
      for (const s of trail.current) {
        if (!alive(s)) continue
        const share = r.persistence! ** (Math.max(0, now - s.t) / (1000 / 60)), weight = share * s.m * Math.min(1, s.seg / R)
        const i0 = Math.max(0, Math.floor((s.x - R - gx) / ds - .5)), i1 = Math.min(cells - 1, Math.ceil((s.x + R - gx) / ds - .5))
        const j0 = Math.max(0, Math.floor((s.y - R - gy) / ds - .5)), j1 = Math.min(cells - 1, Math.ceil((s.y + R - gy) / ds - .5))
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          const d = Math.hypot(gx + (i + .5) * ds - s.x, gy + (j + .5) * ds - s.y)
          if (d >= R) continue
          const w = (1 - d / R) * weight, key = i * 4096 + j, f = flow.get(key) ?? [0, 0]
          flow.set(key, [f[0] + w * s.dx, f[1] + w * s.dy])
        }
      }
      const vec = new Map<number, [number, number]>()
      flow.forEach(([fx, fy], key) => {
        const raw = Math.hypot(fx, fy), mag = raw * r.splat!
        if (mag < .05) return
        const i = Math.floor(key / 4096), j = key % 4096, len = ds * 1.1 * Math.min(1, mag / 1.2), ux = fx / raw, uy = fy / raw
        vec.set(key, [ux * len, uy * len])
        arrows.push(<path key={key} className="me-arrow" opacity={.35 + .65 * Math.min(1, mag)} d={arrowPath(gx + (i + .5) * ds, gy + (j + .5) * ds, ux, uy, len)} />)
      })
      // Sample points of the fluid: coupling carries them with the flow; pressure spreads them from the pointer.
      const sigma = Math.max(1.5 * cell, 24), near = trail.current.some(alive) ? at.current : null
      for (let i = 0; i < 40; i++) for (let j = 0; j < 22; j++) {
        const x = 12 + i * 24, y = 48 + j * 22
        if (x < gx || x > gx + 2 * half || y < gy || y > gy + 2 * half) continue
        const k = vec.get(Math.min(cells - 1, Math.floor((x - gx) / ds)) * 4096 + Math.min(cells - 1, Math.floor((y - gy) / ds)))
        let ox = k ? k[0] * (r.coupling ?? 0) * .6 : 0, oy = k ? k[1] * (r.coupling ?? 0) * .6 : 0
        if (near && r.pressure !== undefined) {
          const dx = x - near.x, dy = y - near.y, d = Math.hypot(dx, dy)
          if (d > .5 && d < 4 * sigma) {
            const push = r.pressure * .7 * (d / sigma) * Math.exp(.5 - d * d / (2 * sigma * sigma))
            ox += dx / d * push; oy += dy / d * push
          }
        }
        dots.push(<circle key={`${i}-${j}`} className="me-pt" cx={(x + ox).toFixed(1)} cy={(y + oy).toFixed(1)} r={1.7} data-moved={Math.hypot(ox, oy) > .6 ? 'true' : undefined} />)
      }
    }
  }
  const known = (x: number | undefined, f: (x: number) => string) => (x === undefined ? NONE : f(x))
  const line = [r.dimension ?? NONE, side === undefined ? 'grid —' : `grid ${side}${r.dimension === '3D' ? '³' : '²'}`, cell === undefined ? 'cell —' : `cell ${cellText(cell)}`,
    `pressure ${known(r.pressure, d2)}`, `coupling ${known(r.coupling, d2)}`, `persistence ${known(r.persistence, d3)}`, `splat ${known(r.splat, d2)}`].join(' · ')
  const say = on === false ? 'The fluid is off. Turn the light on to see the flow.' : on === undefined ? 'No reading of on or off.' : cell === undefined ? `No reading of ${lacking(r).filter(x => ['extent', 'grid', 'dimension'].includes(x)).join(', ')}` : ''
  return <div className="me-pane">
    <svg ref={svg} viewBox={`0 0 ${PANE.w} ${PANE.h}`} preserveAspectRatio="xMidYMid slice" role="group" aria-label="The field"
      onPointerMove={move} onPointerLeave={() => { last.current = null; at.current = null }}>
      {lines}{box}{dots}{arrows}
      <text x={16} y={22} className="me-text">{line}</text>
      {say && <text x={16} y={40} className="me-text" data-none="true">{say}</text>}
    </svg>
  </div>
}

// ---------------------------------------------------------------- the device

/** Every key the owner reports: the "No readings" fixture drops all of them. */
const NOTHING: Record<string, undefined> = Object.fromEntries(Object.values(K).map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'expressions:medium',
  title: 'Medium',
  kind: 'effect',
  defaults: {
    [K.on]: false, [K.pressure]: 4, [K.coupling]: 0.8, [K.persistence]: 0.97, [K.splat]: 1, [K.iterations]: 4, [K.grid]: 192, [K.extent]: 1400,
    [K.dimension]: '2D', [K.plane]: 'vertical',
  },
  fixtures: {
    'Smoky trail, on': {[K.on]: true, [K.splat]: 2.5, [K.persistence]: 0.99},
    '3D volume, fine grid': {[K.on]: true, [K.dimension]: '3D', [K.grid]: 384, [K.pressure]: 9, [K.plane]: 'horizontal'},
    'No readings': NOTHING,
  },

  folded: p => {
    const r = read(p.v)
    return <Folded title="Medium" light={lightOf(p)} readings={[r.pressure === undefined ? NONE : `press ${d2(r.pressure)}`, r.coupling === undefined ? NONE : `coup ${d2(r.coupling)}`]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Medium" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><Picture p={p} g={COMPACT} /></Section>
    <Section label="Macros" cols={2} width={164}>
      {dial(p, 'pressure', 'Pressure')}
      {dial(p, 'coupling', 'Coupling')}
      {dial(p, 'persistence', 'Persistence')}
      {dial(p, 'splat', 'Splat gain')}
    </Section>
  </Panel>,

  whole: p => <Panel title="Medium" view="whole" {...head(p)}>
    <Band>
      <Section width={206}><Picture p={p} g={WHOLE} /></Section>
      <Section label="Flow" cols={2} grow>
        {dial(p, 'splat', 'Splat gain')}
        {dial(p, 'persistence', 'Persistence')}
        {dial(p, 'pressure', 'Pressure')}
        {dial(p, 'coupling', 'Coupling')}
      </Section>
    </Band>
    <Band>
      <Section label="Fluid" width={112}>
        {onToggle(p)}
        {dimRadio(p)}
        <Readout label="Plane" does="The plane of the flat fluid. Set it in the Physics device." value={strOf(p.v, K.plane)} />
      </Section>
      <Section label="Solver" cols={3} grow>
        {box(p, 'iterations', 'Iterations')}
        {box(p, 'grid', 'Grid')}
        {box(p, 'extent', 'Extent')}
      </Section>
    </Band>
  </Panel>,

  full: p => <MediumField p={p} />,

  widget: p => <Tile title="Medium" light={lightOf(p)} span={2} onFull={p.nav.full}>
    <Picture p={p} g={TILE} />
    <div className="me-tile-grid">
      {box(p, 'pressure', 'Pressure')}
      {box(p, 'coupling', 'Coupling')}
      {box(p, 'persistence', 'Persistence')}
      {box(p, 'splat', 'Splat gain')}
      <div className="me-tile-on">{onToggle(p)}</div>
    </div>
  </Tile>,
}
