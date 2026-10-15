// Physics (manual §20.3): the field's motion law — swirl, return, curl, gravity, drag, time. Live's nearest: Auto Filter and
// Corpus — a well that draws the law with handles, and columns of dials ruled off beside it. The shell's own diagram
// (components/NativeFieldFace.physics.tsx) draws the same law from the engine's readings; this panel hosts a diagram of it.
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Section, Tile, Toggle, ValueBox, type LightState} from '../../sdk/panel'
import {clampTo, fixed, num, on, signed, str, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const RADIUS = {min: 20, max: 2000, log: true}, CURL = {min: .02, max: 16, log: true}, SPEED = {min: 50, max: 60000, log: true}

/** The swirl's pull at distance d from its centre: tangential, with the engine's gaussian falloff, signed by the force. */
const swirl = (force: number, radius: number, d: number) => force / 25 * Math.exp(-(d * d) / (2 * radius * radius))

/** Stream lines from a grid of seeds, stepped through the swirl and gravity. Viscosity sets how far a line runs. */
function Streams({v, cx, cy, ring, w, h, seeds}: {v: V; cx: number; cy: number; ring: number; w: number; h: number; seeds: number}) {
  const force = num(v, 'vortex'), mu = num(v, 'viscosity'), gx = num(v, 'gx'), gy = num(v, 'gy')
  const steps = Math.round(4 + 26 * clampTo(0, 1, (mu - .2) / .81))
  const lines: string[] = []
  for (let i = 0; i < seeds; i++) for (let j = 0; j < seeds; j++) {
    let x = (i + .5) * w / seeds, y = (j + .5) * h / seeds
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`
    for (let s = 0; s < steps; s++) {
      const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy) || 1, t = swirl(force, ring, dist) * 34
      x += -dy / dist * t * Math.min(dist, ring) / ring * 1.6 + gx * .35
      y += dx / dist * t * Math.min(dist, ring) / ring * 1.6 - gy * .35
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`
    }
    lines.push(d)
  }
  return <g>{lines.map((d, i) => <path key={i} d={d} className="dp-curve" strokeWidth={.8} opacity={.55} />)}</g>
}

const ringPx = (v: V, reach: number) => 6 + (reach - 6) * Math.log(num(v, 'radius') / RADIUS.min) / Math.log(RADIUS.max / RADIUS.min)

function SwirlDisplay({v, set, w, h}: {v: V; set?: ViewProps['set']; w: number; h: number}) {
  const cx = w * .42, cy = h * .46, reach = Math.min(w, h) * .4, ring = ringPx(v, reach)
  const gx = num(v, 'gx'), gy = num(v, 'gy'), g = {x: cx + gx / 10 * reach, y: cy - gy / 10 * reach}
  const force = num(v, 'vortex')
  return <Display w={w} h={h} label="The swirl" does="Swirls, their reach and the push of gravity, drawn from the device's values. Drag the ring and the arrow."
    corner={`${signed(1)(force)}`}>
    <Streams v={v} cx={cx} cy={cy} ring={ring} w={w} h={h} seeds={7} />
    <circle cx={cx} cy={cy} r={ring} className="dp-faint" strokeDasharray="3 3" />
    <path d={`M${cx - 4} ${cy}h8M${cx} ${cy - 4}v8`} className="dp-faint" />
    {(Math.abs(gx) > .05 || Math.abs(gy) > .05) && <path d={`M${cx} ${cy}L${g.x} ${g.y}`} className="dp-curve-on" />}
    <Handle n={1} shape="ring" x={cx + ring} y={cy} label="Vortex radius" does="Drag out from the centre: the reach of each swirl."
      onDrag={set && (x => set('radius', Math.round(RADIUS.min * Math.pow(RADIUS.max / RADIUS.min, clampTo(0, 1, (x - cx - 6) / (reach - 6))))))} onReset={set && (() => set('radius', 450))} />
    <Handle n={2} x={g.x} y={g.y} label="Gravity" does="Drag: the constant push on every particle, across and up."
      onDrag={set && ((x, y) => { set('gx', Math.round(clampTo(-10, 10, (x - cx) / reach * 10) * 10) / 10); set('gy', Math.round(clampTo(-10, 10, (cy - y) / reach * 10) * 10) / 10) })}
      onReset={set && (() => { set('gx', 0); set('gy', 0) })} />
  </Display>
}

/** Gravity in three axes: an across-and-up pad, and depth as a bar beside it. */
function GravityDisplay({v, set, w, h}: {v: V; set?: ViewProps['set']; w: number; h: number}) {
  const pad = h - 16, cx = 8 + pad / 2, cy = 8 + pad / 2, half = pad / 2
  const g = {x: cx + num(v, 'gx') / 10 * half, y: cy - num(v, 'gy') / 10 * half}, bar = {x: w - 18, top: 8, bottom: 8 + pad}
  const zy = bar.top + (1 - (num(v, 'gz') + 10) / 20) * pad
  return <Display w={w} h={h} label="Gravity" does="Drag the point for across and up; drag the bar for depth.">
    <rect x={8} y={8} width={pad} height={pad} className="dp-faint" />
    <path d={`M${cx} 8V${8 + pad}M8 ${cy}H${8 + pad}`} className="dp-grid" />
    <path d={`M${cx} ${cy}L${g.x} ${g.y}`} className="dp-curve-on" />
    <path d={`M${bar.x} ${bar.top}V${bar.bottom}`} className="dp-faint" />
    <text x={bar.x} y={h - 2} className="dp-axis" textAnchor="middle">z</text>
    <Handle n={1} x={g.x} y={g.y} label="Gravity X and Y" does="Drag: the push across and up."
      onDrag={set && ((x, y) => { set('gx', Math.round(clampTo(-10, 10, (x - cx) / half * 10) * 10) / 10); set('gy', Math.round(clampTo(-10, 10, (cy - y) / half * 10) * 10) / 10) })}
      onReset={set && (() => { set('gx', 0); set('gy', 0) })} />
    <Handle n={2} shape="square" x={bar.x} y={zy} label="Gravity Z" does="Drag up or down: the push in depth."
      onDrag={set && ((_, y) => set('gz', Math.round(clampTo(-10, 10, (1 - (y - bar.top) / pad) * 20 - 10) * 10) / 10))} onReset={set && (() => set('gz', 0))} />
  </Display>
}

const light = (v: V) => str(v, 'light') as LightState
const d2 = fixed(2), d1 = fixed(1)
const DIAL = (p: ViewProps, key: string, label: string, does: string, def: number, scale: {min: number; max: number; log?: boolean}, format: (x: number) => string, bipolar = false) =>
  <Dial key={key} label={label} does={does} value={num(p.v, key)} def={def} scale={scale} format={format} bipolar={bipolar} onChange={x => p.set(key, x)} />
const BOX = (p: ViewProps, key: string, label: string | undefined, does: string, def: number, scale: {min: number; max: number; log?: boolean}, format: (x: number) => string, bipolar = false) =>
  <ValueBox key={key} label={label} does={does} value={num(p.v, key)} def={def} scale={scale} format={format} bipolar={bipolar} onChange={x => p.set(key, x)} />

const macros = (p: ViewProps) => [
  DIAL(p, 'viscosity', 'Viscosity', 'The share of speed a particle keeps each step. A high value lets a gesture linger.', .94, {min: .2, max: 1.01}, d2),
  DIAL(p, 'vortex', 'Vortex', 'The strength of the swirl. Below zero it turns the other way.', 1.4, {min: -25, max: 25}, signed(1), true),
  DIAL(p, 'gy', 'Gravity Y', 'The vertical push on every particle.', 0, {min: -10, max: 10}, signed(1), true),
  DIAL(p, 'timeScale', 'Time', 'The pace of the whole simulation. 0 holds the field.', 1, {min: 0, max: 4}, x => `${x.toFixed(2)}×`),
]

export const physics: DesignedDevice = {
  id: 'expressions:physics',
  title: 'Physics',
  kind: 'effect',
  firstPage: 'fluid',
  defaults: {
    light: 'lit', viscosity: .94, vortex: 1.4, radius: 450, spring: 1.1, snap: 1, tether: 1, curlScale: 1.2, curlSpeed: .6, curlDepth: .57,
    turbulence: 1, dispersion: .65, gx: 0, gy: -1.2, gz: 0, drag: 0, jitter: 0, speedLimit: 35000, zConfine: 1, timeScale: 1, plane: 'vertical', paused: false,
  },

  folded: p => <Folded title="Physics" light={light(p.v)} readings={[`visc ${d2(num(p.v, 'viscosity'))}`, `vortex ${signed(1)(num(p.v, 'vortex'))}`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Physics" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><SwirlDisplay v={p.v} set={p.set} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>{macros(p)}</Section>
  </Panel>,

  whole: p => <Panel title="Physics" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'fluid', label: 'Fluid'}, {id: 'plus', label: 'Physics+'}]} page={p.page} onPage={p.setPage}>
    {p.page !== 'plus' ? <>
      <Band>
        <Section width={198}><SwirlDisplay v={p.v} set={p.set} w={186} h={146} /></Section>
        <Section label="Swirl" cols={2} grow>
          {DIAL(p, 'viscosity', 'Viscosity', 'The share of speed a particle keeps each step.', .94, {min: .2, max: 1.01}, d2)}
          {DIAL(p, 'vortex', 'Vortex', 'The strength of the swirl. Below zero it turns the other way.', 1.4, {min: -25, max: 25}, signed(1), true)}
          {DIAL(p, 'radius', 'Radius', 'The reach of each swirl, in pixels.', 450, RADIUS, x => `${Math.round(x)} px`)}
          {DIAL(p, 'spring', 'Return', 'The pull that brings a particle back to its shape.', 1.1, {min: -5, max: 25}, signed(2), true)}
        </Section>
      </Band>
      <Band>
        <Section label="Spring" width={78}>
          {BOX(p, 'snap', 'Snap', 'Multiplies the return spring.', 1, {min: 0, max: 5}, d2)}
          {BOX(p, 'tether', 'Tether', 'Stiffens the spring in dense strokes.', 1, {min: 0, max: 3}, d2)}
        </Section>
        <Section label="Curl and stir" cols={3} width={186}>
          {DIAL(p, 'curlScale', 'Scale', 'The shape of the swirl noise.', 1.2, CURL, d2)}
          {DIAL(p, 'curlSpeed', 'Speed', 'The speed of the swirl noise.', .6, {min: -10, max: 15}, signed(2), true)}
          {DIAL(p, 'curlDepth', 'Depth', 'The depth of the swirl noise.', .57, {min: 0, max: 4}, d2)}
          {DIAL(p, 'turbulence', 'Turbulence', 'How much the particles stir.', 1, {min: 0, max: 15}, d1)}
          {DIAL(p, 'dispersion', 'Dispersion', 'How far the particles spread when you disperse them.', .65, {min: 0, max: 20}, d2)}
        </Section>
        <Section label="Field" grow>
          <Toggle label="Pause" does="Holds the field still." on={on(p.v, 'paused')} onChange={x => p.set('paused', x)} />
          <Action label="Disperse" does="Spreads the particles out." onPress={() => {}} />
          <Action label="Reset" does="Returns every particle to its shape." onPress={() => {}} />
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={168}><GravityDisplay v={p.v} set={p.set} w={156} h={146} /></Section>
        <Section label="Gravity" width={78}>
          {BOX(p, 'gx', 'X', 'The push across.', 0, {min: -10, max: 10}, signed(1), true)}
          {BOX(p, 'gy', 'Y', 'The push up.', 0, {min: -10, max: 10}, signed(1), true)}
          {BOX(p, 'gz', 'Z', 'The push in depth.', 0, {min: -10, max: 10}, signed(1), true)}
        </Section>
        <Section label="Medium" grow>
          <Radio label="Plane" does="The plane the field lies in." value={str(p.v, 'plane')} options={[{value: 'vertical', label: 'Vertical'}, {value: 'horizontal', label: 'Horizontal'}]} stack onChange={x => p.set('plane', x)} />
          {DIAL(p, 'zConfine', 'Z hold', 'How firmly the field stays flat.', 1, {min: 0, max: 1}, d2)}
        </Section>
      </Band>
      <Band>
        <Section label="Drag" cols={2}>
          {DIAL(p, 'drag', 'Drag', 'Slows fast particles.', 0, {min: 0, max: 10}, d2)}
          {DIAL(p, 'jitter', 'Jitter', 'Shakes all particles.', 0, {min: 0, max: 10}, d2)}
        </Section>
        <Section label="Limit" width={78}>
          {DIAL(p, 'speedLimit', 'Speed', 'The top speed of a particle.', 35000, SPEED, x => (x >= 1000 ? `${(x / 1000).toFixed(1)}k` : `${Math.round(x)}`))}
        </Section>
        <Section label="Time" grow>
          {DIAL(p, 'timeScale', 'Time scale', 'The pace of the whole simulation. 0 holds the field.', 1, {min: 0, max: 4}, x => `${x.toFixed(2)}×`)}
          <Toggle label="Pause" does="Holds the field still." on={on(p.v, 'paused')} onChange={x => p.set('paused', x)} />
        </Section>
      </Band>
    </>}
  </Panel>,

  full: p => {
    const w = 760, h = 420, cx = w * .46, cy = h * .5, ring = ringPx(p.v, 180)
    const gx = num(p.v, 'gx'), gy = num(p.v, 'gy')
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" className="ref-pane-svg" aria-label="The field">
        <g className="dp-display" style={{background: 'none'}}>
          <Streams v={p.v} cx={cx} cy={cy} ring={ring} w={w} h={h} seeds={22} />
          <circle cx={cx} cy={cy} r={ring} className="dp-faint" strokeDasharray="4 4" />
          {(Math.abs(gx) > .05 || Math.abs(gy) > .05) && <path d={`M${w - 70} 70l${gx * 12} ${-gy * 12}`} className="dp-curve-on" strokeWidth={2} />}
        </g>
      </svg>
    </div>
  },

  widget: p => <Tile title="Physics" light={light(p.v)} span={2} onFull={p.nav.full}>
    <SwirlDisplay v={p.v} w={112} h={104} />
    <div className="ref-tile-grid ref-tile-grid--boxes">
      {BOX(p, 'viscosity', 'Viscosity', 'The share of speed a particle keeps each step.', .94, {min: .2, max: 1.01}, d2)}
      {BOX(p, 'vortex', 'Vortex', 'The strength of the swirl.', 1.4, {min: -25, max: 25}, signed(1), true)}
      {BOX(p, 'gy', 'Gravity Y', 'The vertical push on every particle.', 0, {min: -10, max: 10}, signed(1), true)}
      {BOX(p, 'timeScale', 'Time', 'The pace of the whole simulation.', 1, {min: 0, max: 4}, x => `${x.toFixed(2)}×`)}
    </div>
  </Tile>,
}
