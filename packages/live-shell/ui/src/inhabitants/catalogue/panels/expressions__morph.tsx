// Morph (manual §20.9, expressions:morph): the drive that carries the field from its first form to its second, from two conjugate phases:
// θ round the torus and φ round its tube. Live's nearest: the LFO — a display of the wave over its cycle with its rate and depth beside it.
// The display is the engine's own law (desktop/cradle/expressions-app/src/engine/morphSignal.ts computeMorphDrive), drawn over two θ
// cycles from the phases now: the drive shape makes w from θ (sine, triangle, smooth, pulse), the dwell ratio stretches it to rest at each
// form (w / (1 − dwell), clipped), the law joins it with cos φ (θ only, θ × φ, the mean, or θ beaten by φ), and the depth swings it about
// the middle: progress = clamp(½ + ½ · depth · signal). Form A is the floor, form B the ceiling. The two phase dials at the left read the
// engine's accumulators. With the oscillating drive off, the field stands where the scrub puts it. The Manifold page draws the torus the
// path winds on: a (p, q) knot of the windings, its radius and depth, the field's place on it marked.
//
// Everything is keyed on the engine's paths: the registry's (nativeParameters.ts NATIVE_BINDINGS over paramRegistry.ts, group Morph) and the
// morph settings (parameterAddress.ts MORPH_TYPES: morphEnabled, autoOscillate, trajectory, driveShape, law). The owner reports:
//   toroidalMorph.oscillationSpeed  θ rate 0..10 Hz, default 0.8     toroidalMorph.poloidalRate  φ rate 0..10 Hz, default 0.35
//   toroidalMorph.toroidalPhase, .poloidalPhase   −6.283..6.283 rad, default 0     toroidalMorph.driveDepth 0..2, default 1
//   toroidalMorph.holdRatio 0..0.9, default 0     morphProgress  the scrub 0..1, default 0.5
//   toroidalMorph.oscillationAmplitude 0..5 (1.2), .breathRate 0..10 Hz (0.35), .breathDepth 0..2 (0.35)
//   toroidalMorph.toroidalWinding p, .poloidalWinding q 0..48 (3, 2), .fiberPhaseOffset ±12.56 (0), .chiralCoupling ±4 (0.75)
//   toroidalMorph.manifoldRadius 10..1200 px log (180), .volumetricDepthScale 0..6 (1)          (fieldDefaults.ts DEFAULT_TOROIDAL_CONFIG)
//   phase.theta, phase.phi  the engine's accumulators, radians (the Studio's phase instrument reads them: inspector.ts morph tab)
// A key the owner has not reported is absent: the view draws "—" and names it in the well.
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState, type Scale} from '../../sdk/panel'
import {NONE, boolOf, clampTo, fixed, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const TAU = Math.PI * 2
const d2 = fixed(2)
const hz = (x: number) => `${x.toFixed(2)} Hz`

interface Rule {readonly key: string; readonly label: string; readonly scale: Scale; readonly def: number; readonly format: (x: number) => string; readonly does: string; readonly bipolar?: boolean}
const R = {
  theta: {key: 'toroidalMorph.oscillationSpeed', label: 'θ rate', scale: {min: 0, max: 10}, def: .8, format: hz, does: 'The speed round the torus.'},
  phi: {key: 'toroidalMorph.poloidalRate', label: 'φ rate', scale: {min: 0, max: 10}, def: .35, format: hz, does: 'The speed round the tube of the torus.'},
  thetaOff: {key: 'toroidalMorph.toroidalPhase', label: 'θ phase', scale: {min: -6.283, max: 6.283}, def: 0, format: d2, does: 'The start angle of θ, in radians.', bipolar: true},
  phiOff: {key: 'toroidalMorph.poloidalPhase', label: 'φ phase', scale: {min: -6.283, max: 6.283}, def: 0, format: d2, does: 'The start angle of φ, in radians.', bipolar: true},
  depth: {key: 'toroidalMorph.driveDepth', label: 'Depth', scale: {min: 0, max: 2}, def: 1, format: d2, does: 'How far the drive swings.'},
  dwell: {key: 'toroidalMorph.holdRatio', label: 'Dwell', scale: {min: 0, max: .9}, def: 0, format: d2, does: 'How long the drive rests at each form.'},
  scrub: {key: 'morphProgress', label: 'Scrub', scale: {min: 0, max: 1}, def: .5, format: d2, does: 'The blend from the first form to the second, while the oscillating drive is off.'},
  breathAmp: {key: 'toroidalMorph.oscillationAmplitude', label: 'Amp', scale: {min: 0, max: 5}, def: 1.2, format: d2, does: 'How far the torus swells and shrinks.'},
  breathRate: {key: 'toroidalMorph.breathRate', label: 'Rate', scale: {min: 0, max: 10}, def: .35, format: hz, does: 'How fast the torus breathes.'},
  breathDepth: {key: 'toroidalMorph.breathDepth', label: 'Breath', scale: {min: 0, max: 2}, def: .35, format: d2, does: 'How strongly the manifold swells with each breath.'},
  p: {key: 'toroidalMorph.toroidalWinding', label: 'Winding p', scale: {min: 0, max: 48, step: 1}, def: 3, format: x => String(Math.round(x)), does: 'How many times the path winds round the torus.'},
  q: {key: 'toroidalMorph.poloidalWinding', label: 'Winding q', scale: {min: 0, max: 48, step: 1}, def: 2, format: x => String(Math.round(x)), does: 'How many times the path winds round the tube.'},
  fibre: {key: 'toroidalMorph.fiberPhaseOffset', label: 'Fibre Δψ', scale: {min: -12.56, max: 12.56}, def: 0, format: d2, does: 'The offset of the fibre phase.', bipolar: true},
  chiral: {key: 'toroidalMorph.chiralCoupling', label: 'Chiral', scale: {min: -4, max: 4}, def: .75, format: d2, does: 'How the twist couples the two windings.', bipolar: true},
  radius: {key: 'toroidalMorph.manifoldRadius', label: 'Radius', scale: {min: 10, max: 1200, log: true}, def: 180, format: x => `${Math.round(x)} px`, does: 'The size of the torus.'},
  volume: {key: 'toroidalMorph.volumetricDepthScale', label: 'Depth', scale: {min: 0, max: 6}, def: 1, format: d2, does: 'The torus\'s depth in the field.'},
} satisfies Record<string, Rule>
const fin = (v: V, r: Rule) => { const x = numOf(v, r.key); return x !== undefined && Number.isFinite(x) ? x : undefined }
const dial = (p: ViewProps, r: Rule) => <Dial key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} bipolar={r.bipolar}
  onChange={x => p.set(r.key, Math.round(x * 1000) / 1000)} />
const box = (p: ViewProps, r: Rule) => <ValueBox key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} bipolar={r.bipolar}
  onChange={x => p.set(r.key, Math.round(x * 1000) / 1000)} />

const SHAPES = [{value: 'sine', label: 'Sine'}, {value: 'triangle', label: 'Tri'}, {value: 'smooth', label: 'Smooth'}, {value: 'pulse', label: 'Pulse'}] as const
const LAWS = [{value: 'theta', label: 'θ', does: 'The drive follows θ only.'}, {value: 'product', label: 'θ×φ', does: 'θ times φ.'}, {value: 'sum', label: 'θ+φ', does: 'The mean of θ and φ.'},
  {value: 'beat', label: 'Beat', does: 'θ beaten by φ.'}] as const
const TRAJECTORIES = [{value: 'linear', label: 'Linear'}, {value: 'toroidalHopf', label: 'Toroidal Hopf'}, {value: 'vortexSpiral', label: 'Vortex spiral'}, {value: 'quantumInterference', label: 'Quantum'}] as const

// ---------------------------------------------------------------- the engine's law

/** computeMorphDrive (morphSignal.ts), as the engine computes it. */
function drive(shape: string, law: string, dwell: number, depth: number, fibre: number, theta: number, phi: number): number {
  const cycles = theta / TAU, f = cycles - Math.floor(cycles), tri = 1 - 4 * Math.abs(f - .5)
  let w = shape === 'triangle' ? tri : shape === 'smooth' ? (() => { const u = (tri + 1) * .5; return u * u * (3 - 2 * u) * 2 - 1 })() : shape === 'pulse' ? (Math.sin(theta) >= 0 ? 1 : -1) : Math.sin(theta)
  const hold = clampTo(0, .95, dwell)
  if (hold > 0) w = clampTo(-1, 1, w / (1 - hold))
  const conj = Math.cos(phi + fibre)
  const signal = law === 'product' ? w * conj : law === 'sum' ? (w + conj) * .5 : law === 'beat' ? w * (.5 + .5 * conj) : w
  return clampTo(0, 1, .5 + .5 * depth * signal)
}
function readingOf(v: V) {
  const rt = fin(v, R.theta), rp = fin(v, R.phi), depth = fin(v, R.depth), dwell = fin(v, R.dwell), shape = strOf(v, 'driveShape'), law = strOf(v, 'law')
  const ok = rt !== undefined && rp !== undefined && depth !== undefined && dwell !== undefined && shape !== undefined && law !== undefined
  const t0 = (numOf(v, 'phase.theta') ?? 0) + (fin(v, R.thetaOff) ?? 0), p0 = (numOf(v, 'phase.phi') ?? 0) + (fin(v, R.phiOff) ?? 0)
  return {ok, rt: rt ?? 0, rp: rp ?? 0, depth: depth ?? 0, dwell: dwell ?? 0, shape: shape ?? 'sine', law: law ?? 'theta', t0, p0, fibre: fin(v, R.fibre) ?? 0,
    phases: numOf(v, 'phase.theta') !== undefined && numOf(v, 'phase.phi') !== undefined, auto: boolOf(v, 'autoOscillate'), scrub: fin(v, R.scrub)}
}
const f1 = (x: number) => x.toFixed(1)

/** The drive curve over two θ cycles from now, A at the floor and B at the ceiling, with the phase dials at the left. Handles: 1 depth (up),
 * 2 the phases (across: both move together), 3 the θ rate (the end of the first cycle, across). */
function DriveDisplay({p, w, h, handles}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 3}) {
  const v = p.v, s = readingOf(v), dials = w >= 150, x0 = dials ? 40 : 6, x1 = w - 6, top = 14, bot = h - 14
  const Y = (u: number) => bot - u * (bot - top), period = s.rt > 0 ? 1 / s.rt : 2, span = 2 * period
  const X = (t: number) => x0 + t / span * (x1 - x0)
  const ds = st(p, R.depth.key), ps = st(p, R.thetaOff.key), rs = st(p, R.theta.key)
  if (!s.ok) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the drive'}</text>
  const manual = s.auto === false
  let d = ''
  for (let i = 0; i <= 200; i++) { const t = span * i / 200, u = manual ? s.scrub ?? .5 : drive(s.shape, s.law, s.dwell, s.depth, s.fibre, s.t0 + TAU * s.rt * t, s.p0 + TAU * s.rp * t); d += `${i ? 'L' : 'M'}${f1(X(t))} ${f1(Y(u))}` }
  const now = manual ? s.scrub ?? .5 : drive(s.shape, s.law, s.dwell, s.depth, s.fibre, s.t0, s.p0)
  const ring = (cx: number, cy: number, a: number, label: string) => <g>
    <circle cx={cx} cy={cy} r={12} className="dp-faint" />
    <path d={`M${cx} ${cy}L${f1(cx + 11 * Math.sin(a))} ${f1(cy - 11 * Math.cos(a))}`} stroke={s.phases ? 'var(--dp-on)' : 'var(--text-faint)'} strokeWidth={1.4} />
    <text x={cx} y={cy + 24} textAnchor="middle" className="dp-axis">{label}</text>
  </g>
  // the first peak of the curve: where handle 1 stands
  const peakT = (() => { let best = 0, bu = -1; for (let i = 0; i <= 100; i++) { const t = period * i / 100, u = drive(s.shape, s.law, s.dwell, s.depth, s.fibre, s.t0 + TAU * s.rt * t, s.p0 + TAU * s.rp * t); if (u > bu + 1e-6) { bu = u; best = t } } return best })()
  return <g>
    {dials && ring(18, 32, s.t0, 'θ')}{dials && ring(18, 92, s.p0, 'φ')}
    <path d={`M${x0} ${f1(Y(.5))}H${x1}`} className="dp-grid" />
    <text x={x0 + 2} y={top - 3} className="dp-axis">B</text><text x={x0 + 2} y={bot + 10} className="dp-axis">A</text>
    <path d={`M${f1(X(period))} ${top}V${bot}`} className="dp-grid" strokeDasharray="2 3" />
    <path d={d} className="dp-curve" strokeWidth={1.6} />
    <circle cx={x0} cy={Y(now)} r={3} fill="var(--dp-on)" />
    {handles >= 1 && !manual && <Handle n={1} shape="square" x={X(peakT)} y={Y(clampTo(0, 1, .5 + .25 * s.depth))} label="Depth" does={`Drag up or down: how far the drive swings.${ds.disabled ? ` ${ds.disabled}` : ''}`}
      onDrag={ds.disabled ? undefined : (_, y) => p.set(R.depth.key, Math.round(clampTo(0, 2, 4 * ((bot - y) / (bot - top) - .5)) * 100) / 100)} onReset={ds.disabled ? undefined : () => p.set(R.depth.key, 1)} />}
    {handles >= 1 && manual && <Handle n={1} shape="square" x={x0 + 10} y={Y(s.scrub ?? .5)} label="Scrub" does="Drag up or down: the blend from the first form to the second."
      onDrag={st(p, R.scrub.key).disabled ? undefined : (_, y) => p.set(R.scrub.key, Math.round(clampTo(0, 1, (bot - y) / (bot - top)) * 1000) / 1000)} />}
    {handles >= 3 && !manual && <Handle n={2} x={X(period / 2)} y={bot - 4} label="Phases" does={`Drag across: the start angles of θ and φ together.${ps.disabled ? ` ${ps.disabled}` : ''}`}
      onDrag={ps.disabled ? undefined : x => { const shift = ((x - X(period / 2)) / (X(period) - X(0))) * TAU, nt = clampTo(-6.283, 6.283, (fin(v, R.thetaOff) ?? 0) - shift), np = clampTo(-6.283, 6.283, (fin(v, R.phiOff) ?? 0) - shift)
        p.set(R.thetaOff.key, Math.round(nt * 100) / 100); p.set(R.phiOff.key, Math.round(np * 100) / 100) }} onReset={ps.disabled ? undefined : () => { p.set(R.thetaOff.key, 0); p.set(R.phiOff.key, 0) }} />}
    {handles >= 3 && !manual && <Handle n={3} shape="ring" x={X(period)} y={top + 4} label="θ rate" does={`Drag across: the end of one θ cycle sets the speed round the torus.${rs.disabled ? ` ${rs.disabled}` : ''}`}
      onDrag={rs.disabled ? undefined : x => { const frac = clampTo(.05, 1, (x - x0) / (x1 - x0)); p.set(R.theta.key, Math.round(clampTo(.01, 10, s.rt * (.5 / frac)) * 100) / 100) }} onReset={rs.disabled ? undefined : () => p.set(R.theta.key, .8)} />}
    <text x={x1} y={bot + 10} textAnchor="end" className="dp-axis">{manual ? 'scrubbed' : `${(span).toFixed(span < 10 ? 2 : 0)} s`}</text>
  </g>
}

/** The (p, q) torus knot the path winds on, at three-quarter view, the field's place on it marked. */
function Manifold({v, w, h}: {v: V; w: number; h: number}) {
  const pw = fin(v, R.p), qw = fin(v, R.q), rad = fin(v, R.radius), vol = fin(v, R.volume), s = readingOf(v)
  if (pw === undefined || qw === undefined || rad === undefined || vol === undefined) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">No reading of the manifold</text>
  const cx = w / 2, cy = h / 2, Rr = Math.min(w * .36, h * .62) * (.55 + .45 * Math.log(rad / 10) / Math.log(120)), r = Rr * clampTo(.12, .55, .18 + .06 * vol), k = .45
  const P = (t: number) => { const a = Math.max(1, pw) * t, b = Math.max(1, qw) * t; return [cx + (Rr + r * Math.cos(b)) * Math.cos(a), cy + (Rr + r * Math.cos(b)) * Math.sin(a) * k - r * Math.sin(b) * .8] as const }
  let d = ''
  for (let i = 0; i <= 600; i++) { const [x, y] = P(TAU * i / 600); d += `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}` }
  const u = s.ok ? (s.auto === false ? s.scrub ?? .5 : drive(s.shape, s.law, s.dwell, s.depth, s.fibre, s.t0, s.p0)) : undefined
  const mark = u === undefined ? undefined : P(TAU * u)
  return <g>
    <ellipse cx={cx} cy={cy} rx={Rr + r} ry={(Rr + r) * k + r * .3} className="dp-faint" />
    <path d={d} className="dp-curve" strokeWidth={1} opacity={.85} />
    {mark && <circle cx={mark[0]} cy={mark[1]} r={4} fill="var(--dp-on)" />}
    <text x={w - 4} y={h - 4} textAnchor="end" className="dp-axis">{`${Math.round(pw)}:${Math.round(qw)}`}</text>
  </g>
}

const lightOf = (p: ViewProps): LightState => { const on = boolOf(p.owner ?? p.v, 'morphEnabled'); return on === undefined ? 'unknown' : on ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'morphEnabled').disabled, onFold: p.nav.fold, onFull: p.nav.full,
  onLight: () => p.set('morphEnabled', !(boolOf(p.v, 'morphEnabled') === true))})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const DRIVE_DOES = 'The drive over two θ cycles: form A at the floor, form B at the ceiling, by the engine\'s law. The dials read θ and φ now.'

function settings(p: ViewProps) {
  const v = p.v
  return {
    law: <Radio {...st(p, 'law')} label="Law" does="How the two phases join into one drive." value={strOf(v, 'law') ?? ''} options={LAWS} stack onChange={x => p.set('law', x)} />,
    shape: <Radio {...st(p, 'driveShape')} label="Shape" does="The wave that drives the morph." value={strOf(v, 'driveShape') ?? ''} options={SHAPES} stack onChange={x => p.set('driveShape', x)} />,
    trajectory: <Chooser {...st(p, 'trajectory')} wide label="Trajectory" does="The path the field follows between the forms." value={strOf(v, 'trajectory') ?? ''} options={TRAJECTORIES} onChange={x => p.set('trajectory', x)} />,
    osc: <Toggle {...st(p, 'autoOscillate')} label="Oscillate" does="On: the morph runs by itself. Off: you scrub it by hand." on={boolOf(v, 'autoOscillate') === true} unknown={boolOf(v, 'autoOscillate') === undefined}
      onChange={x => p.set('autoOscillate', x)} />,
  }
}

export const design: DesignedDevice = {
  id: 'expressions:morph',
  title: 'Morph',
  kind: 'effect',
  firstPage: 'drive',
  defaults: {
    morphEnabled: true, autoOscillate: true, trajectory: 'toroidalHopf', driveShape: 'sine', law: 'theta',
    'toroidalMorph.oscillationSpeed': .8, 'toroidalMorph.poloidalRate': .35, 'toroidalMorph.toroidalPhase': 0, 'toroidalMorph.poloidalPhase': 0, 'toroidalMorph.driveDepth': 1, 'toroidalMorph.holdRatio': 0,
    morphProgress: .5, 'toroidalMorph.oscillationAmplitude': 1.2, 'toroidalMorph.breathRate': .35, 'toroidalMorph.breathDepth': .35, 'toroidalMorph.toroidalWinding': 3, 'toroidalMorph.poloidalWinding': 2,
    'toroidalMorph.fiberPhaseOffset': 0, 'toroidalMorph.chiralCoupling': .75, 'toroidalMorph.manifoldRadius': 180, 'toroidalMorph.volumetricDepthScale': 1,
    'phase.theta': 1.1, 'phase.phi': 4.2,
  },
  fixtures: {
    'The engine\'s defaults': {},
    'θ beaten by φ, resting': {law: 'beat', driveShape: 'smooth', 'toroidalMorph.holdRatio': .5, 'toroidalMorph.driveDepth': 1.4, 'toroidalMorph.toroidalWinding': 5, 'toroidalMorph.poloidalWinding': 3},
    'Scrubbed by hand': {autoOscillate: false, morphProgress: .3},
    'No readings': {morphEnabled: undefined, autoOscillate: undefined, driveShape: undefined, law: undefined, 'toroidalMorph.oscillationSpeed': undefined, 'toroidalMorph.driveDepth': undefined,
      'phase.theta': undefined, 'phase.phi': undefined, 'toroidalMorph.toroidalWinding': undefined, reason: 'The field has not announced its morph'},
  },

  folded: p => <Folded title="Morph" light={lightOf(p)} readings={[fin(p.v, R.theta) === undefined ? NONE : `θ ${hz(fin(p.v, R.theta)!)}`, fin(p.v, R.phi) === undefined ? NONE : `φ ${hz(fin(p.v, R.phi)!)}`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Morph" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="Drive" does={`${DRIVE_DOES} Drag handle 1 for the depth.`} corner={strOf(p.v, 'law') ?? NONE}><DriveDisplay p={p} w={140} h={146} handles={1} /></Display>
    </Section>
    <Section label="Macros" cols={2}>{dial(p, R.theta)}{dial(p, R.phi)}{dial(p, R.depth)}{dial(p, R.breathDepth)}</Section>
  </Panel>,

  whole: p => { const s = settings(p), w = wide(p) ? Math.round(clampTo(186, (p.room!.w - 520) / 2, 340)) : 186
    return <Panel title="Morph" view="whole" {...head(p)} pages={[{id: 'drive', label: 'Drive'}, {id: 'manifold', label: 'Manifold'}]} page={p.page} onPage={p.setPage}>
      {p.page !== 'manifold' ? <>
        <Band>
          <Section width={w + 12}>
            <Display w={w} h={146} label="Drive" does={`${DRIVE_DOES} Drag handle 1 for the depth, 2 for the phases, 3 for the θ rate.`} corner={strOf(p.v, 'trajectory') ?? NONE}><DriveDisplay p={p} w={w} h={146} handles={3} /></Display>
          </Section>
          <Section label="Phases" width={56}>{s.law}</Section>
          <Section label="Rates" cols={2} grow>{dial(p, R.theta)}{dial(p, R.phi)}{box(p, R.thetaOff)}{box(p, R.phiOff)}</Section>
        </Band>
        <Band>
          <Section label="Morph" width={112}>{s.osc}{s.trajectory}{dial(p, R.scrub)}</Section>
          <Section label="Shape" width={60}>{s.shape}</Section>
          <Section label="Drive" cols={2} grow>{dial(p, R.depth)}{dial(p, R.dwell)}
            <Readout label="now" does="Where the field stands now between form A and form B." value={(() => { const r = readingOf(p.v); return r.ok ? `${Math.round((r.auto === false ? r.scrub ?? .5 : drive(r.shape, r.law, r.dwell, r.depth, r.fibre, r.t0, r.p0)) * 100)} % B` : undefined })()} tone="value" />
          </Section>
        </Band>
      </> : <>
        <Band>
          <Section width={w + 12}><Display w={w} h={146} label="Manifold" does="The torus the path winds on: p turns round it, q round its tube. The amber mark is the field's place."><Manifold v={p.v} w={w} h={146} /></Display></Section>
          <Section label="Winding" cols={2} grow>{dial(p, R.p)}{dial(p, R.q)}{dial(p, R.fibre)}{dial(p, R.chiral)}</Section>
        </Band>
        <Band>
          <Section label="Breathing" cols={3} width={168}>{dial(p, R.breathAmp)}{dial(p, R.breathRate)}{dial(p, R.breathDepth)}</Section>
          <Section label="Manifold" cols={2} grow>{dial(p, R.radius)}{dial(p, R.volume)}</Section>
        </Band>
      </>}
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The morph on its torus">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <Manifold v={p.v} w={760} h={300} />
        <g transform="translate(20 300)"><DriveDisplay p={{...p, set: () => {}}} w={720} h={110} handles={0} /></g>
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Morph" light={lightOf(p)} onLight={head(p).onLight} lightWhy={head(p).lightWhy} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="Drive" does={DRIVE_DOES}><DriveDisplay p={p} w={112} h={104} handles={0} /></Display>
    <div className="ref-tile-grid ref-tile-grid--boxes">{box(p, R.theta)}{box(p, R.phi)}{box(p, R.depth)}{box(p, R.breathDepth)}</div>
  </Tile>,
}
