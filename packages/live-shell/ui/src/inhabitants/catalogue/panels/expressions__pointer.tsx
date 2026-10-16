// Pointer (manual §20.5, expressions:pointer): what the pointer does to the field — the disc it acts on, the force it adds, and what a
// click does. Live's nearest: Auto Filter — a well that draws the law with handles, and dials ruled off beside it. The shell's own
// diagram (components/NativeFieldFace.pointer.tsx) draws the same law and this panel hosts a diagram of it: the disc on a scale of the
// radius's range, the force arrows (attract adds -radial, repel +radial, vortex the tangent, scaled by strength x pow(1 - d, falloff):
// simulationShaders.ts:709-732), the dashed click ring, the falloff curve and the signed strength bar. Four handles, one parameter each.
//
// Everything the device draws is a value key, the binding's own path (NATIVE_BINDINGS, nativeParameters.ts) or the panel setting's key
// (nativeFieldPanelSettings.ts). The owners report:
//   interaction.radius           stage units  0.025..5, log, default 0.45  (the engine's 10..2000 px at WORLD_SCALE 400; fieldDefaults.ts:135)
//   interaction.strength         -30..30, default 1.2   a negative value reverses the force
//   interaction.falloffPower     0.1..6, default 2      the exponent of pow(1 - d, p)
//   interaction.velocityInfluence 0..5, default 1       the share of the pointer's own speed that passes to the particles in the disc
//   interaction.clickStrength    0.2..8, log, default 2.2 (model.ts DEFAULT_ENGINE_SETTINGS pointerClickStrength)
//   interaction.clickRadius      stage units  0.05..2, log, default 0.45 (pointerClickRadius .45; the binding's own default reads 0.05)
//   pointerMode                  attract | repel | vortex      default repel
//   pointerClick                 pulse | implode | vortex | shove | off   default pulse
//   pointerScope                 global | local                default global (absent = global)
// The owner has no on or off for the pointer (nativeFieldFace.pointer.ts: enabled -> undefined), so `light` is never reported: the
// activator is hollow and says why. A key the owner has not reported is absent, and the view draws "—" for it and names it in words.
import {useEffect, useMemo, useRef, useState, type PointerEvent as PointerEventOf, type ReactElement} from 'react'
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Section, Tile, ValueBox, fromUnit, toUnit, type LightState, type Option, type Scale} from '../../sdk/panel'
import {clampTo, fixed, NONE, numOf, signed, st, strOf, type DesignedDevice, type ViewProps} from './design'
import './expressions__pointer.css'

type V = ViewProps['v']

// ---------------------------------------------------------------- fixed vocabulary (the owner's registry, not data)

/** One stage unit is 400 px (WORLD_SCALE, nativeParameters.ts): the radius keys are stage units, drawn in the engine's own pixels. */
const WORLD = 400

const K = {
  radius: 'interaction.radius', strength: 'interaction.strength', falloff: 'interaction.falloffPower', velocity: 'interaction.velocityInfluence',
  clickStrength: 'interaction.clickStrength', clickRadius: 'interaction.clickRadius', mode: 'pointerMode', click: 'pointerClick', scope: 'pointerScope',
} as const
type NumKey = 'radius' | 'strength' | 'falloff' | 'velocity' | 'clickStrength' | 'clickRadius'

/** The soft range, the grid step and the owner's default of each number (paramRegistry.ts:101-106 over the binding's factor). */
const RULE: Readonly<Record<NumKey, {readonly scale: Scale; readonly step: number; readonly def: number}>> = {
  radius: {scale: {min: .025, max: 5, log: true}, step: .025, def: .45},
  strength: {scale: {min: -30, max: 30}, step: .1, def: 1.2},
  falloff: {scale: {min: .1, max: 6}, step: .05, def: 2},
  velocity: {scale: {min: 0, max: 5}, step: .05, def: 1},
  clickStrength: {scale: {min: .2, max: 8, log: true}, step: .05, def: 2.2},
  clickRadius: {scale: {min: .05, max: 2, log: true}, step: .01, def: .45},
}
const snap = (k: NumKey, x: number) => {
  const {scale, step} = RULE[k]
  return clampTo(scale.min, scale.max, Number((Math.round(x / step) * step).toPrecision(12)))
}
/** A number's place in its range, 0 to 1 (log where the owner's range is). */
const place = (k: NumKey, x: number) => toUnit(RULE[k].scale, clampTo(RULE[k].scale.min, RULE[k].scale.max, x))

type Mode = 'attract' | 'repel' | 'vortex'
const MODES: readonly Option<Mode>[] = [
  {value: 'attract', label: 'Attract', does: 'Pulls the particles in toward the centre of the disc.'},
  {value: 'repel', label: 'Repel', does: 'Pushes the particles out from the centre of the disc.'},
  {value: 'vortex', label: 'Vortex', does: 'Whirls the particles round the centre of the disc.'},
]
type Click = 'pulse' | 'implode' | 'vortex' | 'shove' | 'off'
const CLICKS: readonly Option<Click>[] = [
  {value: 'pulse', label: 'Pulse', does: 'A click throws the particles out from the click.'},
  {value: 'implode', label: 'Implode', does: 'A click gathers the particles in to the click.'},
  {value: 'vortex', label: 'Vortex', does: 'A click whirls the particles round the click.'},
  {value: 'shove', label: 'Shove', does: 'A click throws the particles in one random direction.'},
  {value: 'off', label: 'Off', does: 'A click does nothing.'},
]
type Scope = 'global' | 'local'
const SCOPES: readonly Option<Scope>[] = [
  {value: 'global', label: 'Global', does: 'Share the pointer values across the scenes of this Expression.'},
  {value: 'local', label: 'Local', does: 'Keep the pointer values in this scene.'},
]
const pick = <T extends string>(options: readonly Option<T>[], x: string | undefined): T | undefined => options.find(o => o.value === x)?.value

const LIGHT_WHY = 'The pointer has no on or off. The light stays hollow.'

// ---------------------------------------------------------------- the readings

const fin = (x: number | undefined) => (x !== undefined && Number.isFinite(x) ? x : undefined)
/** Every reading of the device, absent when the owner has not reported it. */
function read(v: V) {
  return {
    radius: fin(numOf(v, K.radius)), strength: fin(numOf(v, K.strength)), falloff: fin(numOf(v, K.falloff)), velocity: fin(numOf(v, K.velocity)),
    clickStrength: fin(numOf(v, K.clickStrength)), clickRadius: fin(numOf(v, K.clickRadius)),
    mode: pick(MODES, strOf(v, K.mode)), click: pick(CLICKS, strOf(v, K.click)), scope: pick(SCOPES, strOf(v, K.scope)),
  }
}
type Reading = ReturnType<typeof read>

const lightOf = (p: ViewProps): LightState => { const x = (p.owner ?? p.v).light; return x === 'lit' || x === 'dark' ? x : 'unknown' }
const px = (x: number) => `${Math.round(x * WORLD)} px`
const d2 = fixed(2), sg1 = signed(1)
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the picture

interface Layout {
  readonly w: number; readonly h: number
  /** The disc's centre and the reach of the radius's whole range. */
  readonly cx: number; readonly cy: number; readonly S: number
  /** The falloff curve's box, and the rail its handle runs on. */
  readonly curve: {readonly x: number; readonly w: number; readonly base: number; readonly h: number}
  readonly rail: number
  /** The signed strength bar: its x, its bottom and its length. Zero stands at the middle. */
  readonly bar: {readonly x: number; readonly bottom: number; readonly length: number}
  /** How many handles stand in the well (0 for the widget). The fourth is the click radius. */
  readonly handles: 0 | 3 | 4
  /** The words under the picture (the whole view's). */
  readonly legend?: number
}
const COMPACT: Layout = {w: 140, h: 146, cx: 50, cy: 52, S: 36, curve: {x: 12, w: 86, base: 122, h: 24}, rail: 134, bar: {x: 120, bottom: 106, length: 80}, handles: 3}
const WHOLE: Layout = {w: 194, h: 146, cx: 56, cy: 56, S: 44, curve: {x: 112, w: 50, base: 98, h: 48}, rail: 112, bar: {x: 180, bottom: 126, length: 100}, handles: 4, legend: 140}
const TILE: Layout = {w: 112, h: 104, cx: 36, cy: 40, S: 28, curve: {x: 8, w: 56, base: 96, h: 20}, rail: 100, bar: {x: 98, bottom: 92, length: 68}, handles: 0}

/** A head-tipped arrow centred on (x, y) along the unit direction (dx, dy), as the owner draws it. */
function arrowPath(x: number, y: number, dx: number, dy: number, length: number): string {
  const sx = x - dx * length / 2, sy = y - dy * length / 2, tx = x + dx * length / 2, ty = y + dy * length / 2
  const bx = tx - dx * Math.min(3, length * .45), by = ty - dy * Math.min(3, length * .45), wing = 2
  return `M${sx.toFixed(2)} ${sy.toFixed(2)}L${tx.toFixed(2)} ${ty.toFixed(2)}M${(bx - dy * wing).toFixed(2)} ${(by + dx * wing).toFixed(2)}L${tx.toFixed(2)} ${ty.toFixed(2)}L${(bx + dy * wing).toFixed(2)} ${(by - dx * wing).toFixed(2)}`
}

/** Force arrows across the disc: attract points in, repel out, vortex round; a negative strength turns each one; the length is the
 * strength's share of its range times the falloff at that distance (the owner's forceArrows). */
function Arrows({g, mode, strength, radiusPx, exponent}: {g: Layout; mode: Mode; strength: number; radiusPx: number; exponent: number}) {
  const sign = Math.sign(strength), amplitude = Math.min(1, Math.abs(strength) / RULE.strength.scale.max), out: ReactElement[] = []
  if (sign === 0 || amplitude <= 0 || radiusPx < 4) return null
  for (const d of [.35, .7]) for (let k = 0; k < 8; k++) {
    const angle = k * Math.PI / 4, ux = Math.cos(angle), uy = Math.sin(angle)
    const length = 14 * g.S / 52 * amplitude * (1 - d) ** exponent
    if (length < .6) continue
    const [dx, dy] = mode === 'vortex' ? [-uy * sign, ux * sign] : mode === 'attract' ? [-ux * sign, -uy * sign] : [ux * sign, uy * sign]
    out.push(<path key={`${d}-${k}`} className="pt-arrow" data-sign={sign > 0 ? '+' : '-'} d={arrowPath(g.cx + radiusPx * d * ux, g.cy + radiusPx * d * uy, dx, dy, length)} />)
  }
  return <>{out}</>
}

/** The names of the readings the picture lacks, for the well. */
const lacking = (r: Reading) => [r.radius === undefined && 'radius', r.strength === undefined && 'force', r.falloff === undefined && 'falloff'].filter((x): x is string => !!x)

function Picture({p, g}: {p: ViewProps; g: Layout}) {
  const r = read(p.v), {cx, cy, S, curve, bar} = g, canDrag = (key: string) => !st(p, key).disabled
  const radiusPx = r.radius === undefined ? undefined : S * place('radius', r.radius)
  const clickPx = r.clickRadius === undefined ? undefined : S * place('clickRadius', r.clickRadius)
  const zeroY = bar.bottom - bar.length / 2
  const barY = r.strength === undefined ? undefined : bar.bottom - bar.length * place('strength', r.strength)
  const railX = r.falloff === undefined ? undefined : curve.x + curve.w * place('falloff', r.falloff)
  const lacks = lacking(r)
  // The falloff curve: the weight at the normalised distance d, the engine's pow(1 - d, falloff).
  const line = r.falloff === undefined ? '' : Array.from({length: 21}, (_, i) => { const d = i / 20; return `${i ? 'L' : 'M'}${(curve.x + curve.w * d).toFixed(2)} ${(curve.base - curve.h * (1 - d) ** r.falloff!).toFixed(2)}` }).join('')
  const put = (k: NumKey, x: number) => p.set(K[k], snap(k, x))
  const reset = (k: NumKey) => () => p.set(K[k], RULE[k].def)
  const empty = lacks.length === 3 && r.clickRadius === undefined
  return <Display w={g.w} h={g.h} label="The pointer" corner={r.strength === undefined ? NONE : sg1(r.strength)}
    does={g.handles ? 'The disc, the force on it, its falloff and a click. Drag the handles: 1 the radius, 2 the strength, 3 the falloff' + (g.handles === 4 ? ', 4 the click radius.' : '.') : 'The disc, the force on it, its falloff and a click.'}>
    {radiusPx !== undefined && <path d={`M${cx - S} ${cy}H${cx + S}M${cx} ${cy - S}V${cy + S}`} className="dp-faint" />}
    {radiusPx !== undefined && <circle cx={cx} cy={cy} r={radiusPx} className="pt-disc" />}
    {r.mode && r.strength !== undefined && radiusPx !== undefined && r.falloff !== undefined && <Arrows g={g} mode={r.mode} strength={r.strength} radiusPx={radiusPx} exponent={r.falloff} />}
    {clickPx !== undefined && <circle cx={cx} cy={cy} r={clickPx} className="pt-ring" data-off={r.click === 'off' ? 'true' : undefined}
      strokeWidth={.8 + 2.2 * (r.clickStrength === undefined ? 0 : place('clickStrength', r.clickStrength))} />}
    <text x={5} y={11} className="dp-axis">{r.mode ?? NONE}</text>
    <path d={`M${curve.x} ${curve.base}H${curve.x + curve.w}M${curve.x} ${curve.base - curve.h}V${curve.base}`} className="dp-faint" />
    {line && <path d={line} className="dp-curve" />}
    {g.legend !== undefined && r.falloff !== undefined && <text x={curve.x} y={curve.base - curve.h - 6} className="dp-axis">falloff {d2(r.falloff)}</text>}
    <path d={`M${curve.x} ${g.rail}H${curve.x + curve.w}`} className="dp-faint" />
    <path d={`M${bar.x - 8} ${zeroY}H${bar.x + 8}M${bar.x} ${bar.bottom - bar.length}V${bar.bottom}`} className="dp-faint" />
    {barY !== undefined && <path d={`M${bar.x} ${zeroY}V${barY}`} className="dp-curve" strokeWidth={3} />}
    {g.legend !== undefined && <text x={5} y={g.legend} className="dp-axis">{`disc ${r.radius === undefined ? NONE : px(r.radius)} · click ${r.click ?? NONE} ${r.clickRadius === undefined ? NONE : px(r.clickRadius)}`}</text>}
    {empty && <text x={g.w / 2} y={g.h / 2 - 3} className="pt-note"><tspan x={g.w / 2}>No reading of</tspan><tspan x={g.w / 2} dy={11}>the pointer</tspan></text>}
    {!empty && lacks.length > 0 && <text x={g.w / 2} y={g.h - 3} className="pt-note">{`No reading of ${lacks.join(', ')}`}</text>}
    {g.handles > 0 && radiusPx !== undefined && <Handle n={1} x={cx + radiusPx} y={cy} label="Radius" does="Drag out from the centre: the size of the disc."
      onDrag={canDrag(K.radius) ? (x => put('radius', fromUnit(RULE.radius.scale, clampTo(0, 1, (x - cx) / S)))) : undefined} onReset={canDrag(K.radius) ? reset('radius') : undefined} />}
    {g.handles > 0 && barY !== undefined && <Handle n={2} shape="square" x={bar.x} y={barY} label="Strength" does="Drag up or down the bar: the amount of force. Below the middle line it reverses."
      onDrag={canDrag(K.strength) ? ((_, y) => put('strength', fromUnit(RULE.strength.scale, clampTo(0, 1, (bar.bottom - y) / bar.length)))) : undefined} onReset={canDrag(K.strength) ? reset('strength') : undefined} />}
    {g.handles > 0 && railX !== undefined && <Handle n={3} x={railX} y={g.rail} label="Falloff" does="Drag along the rail: how fast the force fades from the centre to the edge."
      onDrag={canDrag(K.falloff) ? (x => put('falloff', fromUnit(RULE.falloff.scale, clampTo(0, 1, (x - curve.x) / curve.w)))) : undefined} onReset={canDrag(K.falloff) ? reset('falloff') : undefined} />}
    {g.handles === 4 && clickPx !== undefined && <Handle n={4} shape="ring" x={cx} y={cy - clickPx} label="Click radius" does="Drag up from the centre: the reach of a click."
      onDrag={canDrag(K.clickRadius) ? ((_, y) => put('clickRadius', fromUnit(RULE.clickRadius.scale, clampTo(0, 1, (cy - y) / S)))) : undefined} onReset={canDrag(K.clickRadius) ? reset('clickRadius') : undefined} />}
  </Display>
}

// ---------------------------------------------------------------- the controls

const DOES: Readonly<Record<NumKey, string>> = {
  radius: 'The size of the disc that the pointer acts on.',
  strength: 'The amount of force. Below zero it reverses the force.',
  falloff: 'How fast the force fades from the centre of the disc to its edge.',
  velocity: 'How much of the pointer’s own speed passes to the particles inside the disc.',
  clickStrength: 'The punch of a click.',
  clickRadius: 'The reach of a click.',
}
const FORMAT: Readonly<Record<NumKey, (x: number) => string>> = {radius: px, strength: sg1, falloff: d2, velocity: d2, clickStrength: d2, clickRadius: px}

const dial = (p: ViewProps, k: NumKey, label: string) =>
  <Dial key={k} {...st(p, K[k])} label={label} does={DOES[k]} value={numOf(p.v, K[k]) as number} def={RULE[k].def} scale={RULE[k].scale} format={FORMAT[k]}
    bipolar={k === 'strength'} onChange={x => p.set(K[k], snap(k, x))} />
const box = (p: ViewProps, k: NumKey, label: string) =>
  <ValueBox key={k} {...st(p, K[k])} label={label} does={DOES[k]} value={numOf(p.v, K[k]) as number} def={RULE[k].def} scale={RULE[k].scale} format={FORMAT[k]}
    bipolar={k === 'strength'} onChange={x => p.set(K[k], snap(k, x))} />

const modeRadio = (p: ViewProps) =>
  <Radio {...st(p, K.mode)} label="Mode" does="What the pointer force does while the pointer is in the field." value={(read(p.v).mode ?? '') as Mode} options={MODES} stack onChange={x => p.set(K.mode, x)} />
const clickRadio = (p: ViewProps) =>
  <Radio {...st(p, K.click)} label="Click effect" does="What a click does." value={(read(p.v).click ?? '') as Click} options={CLICKS} stack onChange={x => p.set(K.click, x)} />
const scopeRadio = (p: ViewProps) =>
  <Radio {...st(p, K.scope)} label="Scope" does="Global shares the pointer values across scenes. Local keeps them in this scene." value={(read(p.v).scope ?? '') as Scope} options={SCOPES} stack onChange={x => p.set(K.scope, x)} />

// ---------------------------------------------------------------- the pane: the field, as sample points that answer the disc

interface Spot {readonly x: number; readonly y: number}
interface Burst extends Spot {readonly u: number; readonly seed: number}
const PANE = {w: 960, h: 540, cols: 40, rows: 21, top: 36}
/** How far one unit of the engine's force moves a sample point in the pane: a drawing scale, not an engine value. */
const PUSH = .03
const BLAST = 700

function PointerField({p}: {p: ViewProps}) {
  const r = read(p.v), svg = useRef<SVGSVGElement>(null)
  const [at, setAt] = useState<Spot | null>(null)
  const [burst, setBurst] = useState<Burst | null>(null)
  const dots = useMemo(() => Array.from({length: PANE.cols * PANE.rows}, (_, i) => ({x: (i % PANE.cols + .5) * PANE.w / PANE.cols, y: PANE.top + (Math.floor(i / PANE.cols) + .5) * (PANE.h - PANE.top) / PANE.rows})), [])
  const disc = r.radius !== undefined && r.strength !== undefined && r.falloff !== undefined && r.mode ? {rad: r.radius * WORLD, s: r.strength, f: r.falloff, mode: r.mode} : null
  const shock = r.click && r.click !== 'off' && r.clickStrength !== undefined && r.clickRadius !== undefined && r.falloff !== undefined
    ? {kind: r.click, power: 950 * r.clickStrength, rad: r.clickRadius * WORLD, f: r.falloff} : null

  // A click plays out once; with reduced motion it holds one frame and lets go.
  useEffect(() => {
    if (!burst) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { const t = window.setTimeout(() => setBurst(null), BLAST); return () => window.clearTimeout(t) }
    const t0 = performance.now()
    let id = 0
    const tick = (now: number) => {
      const u = (now - t0) / BLAST
      if (u >= 1) { setBurst(null); return }
      setBurst(b => (b ? {...b, u} : b))
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [burst?.seed])

  const spot = (e: PointerEventOf<SVGSVGElement>): Spot | null => {
    const el = svg.current, m = el?.getScreenCTM()
    if (!el || !m) return null
    const pt = el.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const q = pt.matrixTransform(m.inverse())
    return {x: q.x, y: q.y}
  }
  const clickAt = (e: PointerEventOf<SVGSVGElement>) => {
    const s = spot(e)
    if (s && shock) setBurst({...s, u: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? .5 : 0, seed: Math.random()})
  }

  /** Where a sample point stands: the disc's push at the pointer, and the click's throw. */
  const moved = (x: number, y: number): readonly [number, number] => {
    let ox = 0, oy = 0
    if (at && disc) {
      const dx = x - at.x, dy = y - at.y, d = Math.hypot(dx, dy)
      if (d < disc.rad) {
        const w = (1 - d / disc.rad) ** disc.f, ux = d > .001 ? dx / d : 0, uy = d > .001 ? dy / d : 0
        const [mx, my] = disc.mode === 'vortex' ? [-uy, ux] : disc.mode === 'attract' ? [-ux, -uy] : [ux, uy]
        const push = Math.min(Math.abs(disc.s) * (disc.mode === 'vortex' ? 480 : 400) * w * PUSH, disc.rad * .4) * Math.sign(disc.s)
        ox += mx * push; oy += my * push
      }
    }
    if (burst && shock) {
      const dx = x - burst.x, dy = y - burst.y, d = Math.hypot(dx, dy)
      if (d < shock.rad) {
        const w = (1 - d / shock.rad) ** shock.f, ux = d > .001 ? dx / d : 0, uy = d > .001 ? dy / d : 0, shift = Math.min(shock.power * w * PUSH, shock.rad * .4) * Math.sin(Math.PI * burst.u)
        const [mx, my] = shock.kind === 'pulse' ? [ux, uy] : shock.kind === 'implode' ? [-ux, -uy] : shock.kind === 'vortex' ? [-uy, ux]
          : [Math.cos(burst.seed * 2 * Math.PI), Math.sin(burst.seed * 2 * Math.PI)]
        ox += mx * shift; oy += my * shift
      }
    }
    return [ox, oy]
  }

  const line = disc
    ? `${r.mode} · radius ${px(r.radius!)} · force ${sg1(r.strength!)} · falloff ${d2(r.falloff!)}${r.click ? ` · click ${r.click}` : ''}`
    : `No reading of ${lacking(r).join(', ') || 'the mode'}`
  return <div className="pt-pane">
    <svg ref={svg} viewBox={`0 0 ${PANE.w} ${PANE.h}`} preserveAspectRatio="xMidYMid slice" role="group" aria-label="The field"
      onPointerMove={e => setAt(spot(e))} onPointerLeave={() => setAt(null)} onPointerDown={clickAt}>
      {dots.map((d, i) => {
        const [ox, oy] = moved(d.x, d.y)
        return <circle key={i} className="pt-dot" cx={(d.x + ox).toFixed(1)} cy={(d.y + oy).toFixed(1)} r={1.7} data-moved={Math.hypot(ox, oy) > .6 ? 'true' : undefined} />
      })}
      {at && disc && <>
        {[.75, .5, .25].map(w => <circle key={w} className="pt-weight" cx={at.x} cy={at.y} r={disc.rad * (1 - w ** (1 / disc.f))} opacity={.25 + w * .6} />)}
        <circle className="pt-reach" cx={at.x} cy={at.y} r={disc.rad} />
      </>}
      {burst && shock && <circle className="pt-wave" cx={burst.x} cy={burst.y} r={Math.max(2, shock.rad * Math.min(1, burst.u * 1.6))} opacity={1 - burst.u} />}
      <text x={16} y={22} className="pt-line" data-none={disc ? undefined : 'true'}>{line}</text>
    </svg>
  </div>
}

// ---------------------------------------------------------------- the device

/** Every key the owner reports: the "No readings" fixture drops all of them. */
const KEYS = [...Object.values(K), 'light']
const NOTHING: Record<string, undefined> = Object.fromEntries(KEYS.map(k => [k, undefined]))

export const design: DesignedDevice = {
  id: 'expressions:pointer',
  title: 'Pointer',
  kind: 'effect',
  defaults: {
    [K.radius]: .45, [K.strength]: 1.2, [K.falloff]: 2, [K.velocity]: 1, [K.clickStrength]: 2.2, [K.clickRadius]: .45,
    [K.mode]: 'repel', [K.click]: 'pulse', [K.scope]: 'global',
  },
  fixtures: {
    'Owner defaults': {},
    'Attract, soft edge': {[K.mode]: 'attract', [K.radius]: 1, [K.falloff]: .5, [K.click]: 'implode'},
    'Vortex, reversed, click off': {[K.mode]: 'vortex', [K.strength]: -6, [K.click]: 'off', [K.scope]: 'local'},
    'No readings': NOTHING,
  },

  folded: p => {
    const r = read(p.v)
    return <Folded title="Pointer" light={lightOf(p)} readings={[r.mode ?? NONE, r.radius === undefined ? NONE : px(r.radius)]} onUnfold={p.nav.unfold} />
  },

  compact: p => <Panel title="Pointer" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><Picture p={p} g={COMPACT} /></Section>
    <Section label="Macros" cols={2} width={164}>
      {dial(p, 'radius', 'Radius')}
      {dial(p, 'strength', 'Strength')}
      {dial(p, 'falloff', 'Falloff')}
      {dial(p, 'clickStrength', 'Click strength')}
    </Section>
  </Panel>,

  whole: p => <Panel title="Pointer" view="whole" {...head(p)}>
    <Band>
      <Section width={206}><Picture p={p} g={WHOLE} /></Section>
      <Section label="Disc" cols={2} grow>
        {dial(p, 'radius', 'Radius')}
        {dial(p, 'strength', 'Strength')}
        {dial(p, 'falloff', 'Falloff')}
        {dial(p, 'velocity', 'Velocity inject')}
      </Section>
    </Band>
    <Band>
      <Section label="Pointer" width={96}>
        {modeRadio(p)}
        {scopeRadio(p)}
      </Section>
      <Section label="Click" cols={3} grow>
        <div className="pt-span">{clickRadio(p)}</div>
        {dial(p, 'clickStrength', 'Click strength')}
        {dial(p, 'clickRadius', 'Click radius')}
      </Section>
    </Band>
  </Panel>,

  full: p => <PointerField p={p} />,

  widget: p => <Tile title="Pointer" light={lightOf(p)} span={2} onFull={p.nav.full}>
    <Picture p={p} g={TILE} />
    <div className="pt-tile-grid">
      {box(p, 'radius', 'Radius')}
      {box(p, 'strength', 'Strength')}
      {box(p, 'falloff', 'Falloff')}
      {box(p, 'clickStrength', 'Click strength')}
    </div>
  </Tile>,
}
