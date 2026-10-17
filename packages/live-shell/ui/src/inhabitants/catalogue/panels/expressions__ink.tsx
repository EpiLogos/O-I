// Ink (manual §20.12, expressions:ink): the marks the field is drawn with — how many, how large, and the shape of each. Live's nearest:
// Saturator's well, where the shape of the curve is the device; here the shape of the mark is. The display draws marks by the engine's
// own mark law (desktop/cradle/expressions-app/src/engine/shaders/particleShaders.ts): a mark's size is min + (max − min) · r^bias for its
// random r; with the extended profile it turns by the orientation plus its own jitter times the irregularity, stretches by 1 +
// elongation, its outline runs from square to round by the roundness and wavers by the irregularity, its edge softens by the softness,
// and it is as solid as the opacity; the density bands scale it by 0.7 + 0.3 · sin(x · 0.01 · scale + sin(y · 0.013 · scale) + phase),
// as far as the density contrast lets them. At the left the patch is at true size, one well pixel to one field pixel; at the right
// nine marks stand ten times larger (less, where a large mark would not fit), so their shape reads. The marks' places are a sample, not the field's.
//
// Everything is keyed on the engine's paths: the registry's (nativeParameters.ts over paramRegistry.ts, groups Particles and Material)
// and the panel settings (parameterAddress.ts PANEL_FAMILY: grainProfile, dotShape). The owner reports:
//   particleCount 1000..2000000 log (200000)   particleSize.min 0.02..40 px log (0.16)   particleSize.max 0.05..80 px log (1.6)
//   material.opacity 0..1   material.sizeBias 0.2..4 log   material.roundness, .softness, .irregularity 0..1   material.elongation 0..3
//   material.orientation −180..180°   material.contrast 0..1   material.densityScale 0.1..3   material.densityPhase 0..6.283
//   material.edgeWeight 0..1   material.halo 0..0.6   grainProfile  the extended profile (on: the rows above it act)   dotShape  circle | square
// Ink has no on or off. A key the owner has not reported is absent: the view draws "—" and names it in the well.
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Section, Tile, Toggle, ValueBox, type LightState, type Scale} from '../../sdk/panel'
import {NONE, boolOf, clampTo, fixed, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const d2 = fixed(2), px = (x: number) => `${x < 1 ? x.toFixed(2) : x.toFixed(1)} px`
interface Rule {readonly key: string; readonly label: string; readonly scale: Scale; readonly def: number; readonly format: (x: number) => string; readonly does: string; readonly bipolar?: boolean; readonly grain?: boolean}
const R = {
  count: {key: 'particleCount', label: 'Count', scale: {min: 1000, max: 2000000, log: true}, def: 200000, format: (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(2)} M` : `${Math.round(x / 1000)} k`), does: 'The number of marks. A high count costs more.'},
  min: {key: 'particleSize.min', label: 'Min size', scale: {min: .02, max: 40, log: true}, def: .16, format: px, does: 'The smallest mark.'},
  max: {key: 'particleSize.max', label: 'Max size', scale: {min: .05, max: 80, log: true}, def: 1.6, format: px, does: 'The largest mark.'},
  opacity: {key: 'material.opacity', label: 'Opacity', scale: {min: 0, max: 1}, def: .92, format: d2, does: 'How solid the ink looks.'},
  bias: {key: 'material.sizeBias', label: 'Spread', scale: {min: .2, max: 4, log: true}, def: 1.6, format: d2, does: 'How sizes spread between the smallest and the largest mark: higher keeps more marks small.', grain: true},
  round: {key: 'material.roundness', label: 'Round', scale: {min: 0, max: 1}, def: .95, format: d2, does: 'How round a mark is: 0 is square.', grain: true},
  soft: {key: 'material.softness', label: 'Soft', scale: {min: 0, max: 1}, def: .15, format: d2, does: 'How soft the edge of a mark is.', grain: true},
  rough: {key: 'material.irregularity', label: 'Rough', scale: {min: 0, max: 1}, def: .35, format: d2, does: 'How rough the edge is, and how far each mark turns on its own.', grain: true},
  long: {key: 'material.elongation', label: 'Stretch', scale: {min: 0, max: 3}, def: .04, format: d2, does: 'How long the mark is stretched.', grain: true},
  angle: {key: 'material.orientation', label: 'Angle', scale: {min: -180, max: 180}, def: 0, format: x => `${Math.round(x)}°`, does: 'The angle of stretched marks.', bipolar: true, grain: true},
  contrast: {key: 'material.contrast', label: 'Contrast', scale: {min: 0, max: 1}, def: .93, format: d2, does: 'How much dense areas differ from thin areas.', grain: true},
  bandScale: {key: 'material.densityScale', label: 'Bands', scale: {min: .1, max: 3}, def: 1, format: d2, does: 'The size of the bands in the density.', grain: true},
  bandPhase: {key: 'material.densityPhase', label: 'Phase', scale: {min: 0, max: 6.283}, def: .3, format: d2, does: 'The offset of the bands, in radians.', grain: true},
  edge: {key: 'material.edgeWeight', label: 'Edge', scale: {min: 0, max: 1}, def: 0, format: d2, does: 'How strong the outline of a form is: thin areas carry larger marks.', grain: true},
  halo: {key: 'material.halo', label: 'Halo', scale: {min: 0, max: .6}, def: .13, format: d2, does: 'How much faint source ink shows.', grain: true},
} satisfies Record<string, Rule>
const fin = (v: V, r: Rule) => { const x = numOf(v, r.key); return x !== undefined && Number.isFinite(x) ? x : undefined }
const offWhy = (p: ViewProps, r: Rule) => st(p, r.key).disabled ?? (r.grain && boolOf(p.v, 'grainProfile') === false ? 'The extended grain profile is off: this row only reads.' : undefined)
const dial = (p: ViewProps, r: Rule) => <Dial key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} bipolar={r.bipolar}
  onChange={x => p.set(r.key, Math.round(x * 1000) / 1000)} disabled={offWhy(p, r)} />
const box = (p: ViewProps, r: Rule) => <ValueBox key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} bipolar={r.bipolar}
  onChange={x => p.set(r.key, Math.round(x * 1000) / 1000)} disabled={offWhy(p, r)} />
const SHAPES = [{value: 'circle', label: 'Circle', does: 'The basic mark is a circle.'}, {value: 'square', label: 'Square', does: 'The basic mark is a square.'}] as const

/** The sample's random numbers: a fixed hash of the mark's index, as the shader hashes a particle's place. */
const hash = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x) }
interface Mark {readonly x: number; readonly y: number; readonly size: number; readonly angle: number; readonly stretch: number; readonly round: number; readonly soft: number; readonly opacity: number; readonly wobble: number; readonly jitter: number}
/** A mark by the engine's law, at a place (in field pixels). Undefined while a reading it needs is absent. */
function markLaw(v: V) {
  const min = fin(v, R.min), max = fin(v, R.max), op = fin(v, R.opacity)
  if (min === undefined || max === undefined || op === undefined) return undefined
  const grain = boolOf(v, 'grainProfile') !== false, g = (r: Rule, d: number) => (grain ? fin(v, r) ?? d : d), square = strOf(v, 'dotShape') === 'square'
  return (i: number, x: number, y: number): Mark => {
    const rnd = hash(i, 1), r = grain ? Math.pow(rnd, Math.max(.1, g(R.bias, 1))) : rnd, jitter = hash(i, 2)
    const band = .7 + .3 * Math.sin(x * .01 * g(R.bandScale, 1) + Math.sin(y * .013 * g(R.bandScale, 1)) + g(R.bandPhase, 0))
    const size = (min + (max - min) * r) * (1 + (band - 1) * g(R.contrast, 0) * .35)
    return {x, y, size, angle: g(R.angle, 0) + (jitter - .5) * g(R.rough, 0) * 180 / Math.PI, stretch: 1 + g(R.long, 0), round: grain ? g(R.round, 1) : square ? 0 : 1,
      soft: g(R.soft, 0), opacity: op, wobble: g(R.rough, 0), jitter}
  }
}
const f2 = (x: number) => x.toFixed(2)
/** One mark's outline: a superellipse from square to circle, its edge wavering by the irregularity. */
function outline(m: Mark, scale: number) {
  const n = 2 + 8 * (1 - m.round) ** 2, r = m.size * scale / 2, pts: string[] = []
  for (let k = 0; k < 48; k++) {
    const t = k / 48 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), e = Math.pow(Math.abs(c) ** n + Math.abs(s) ** n, -1 / n) * (1 + Math.sin(t * 7 + m.jitter * 25) * m.wobble * .045)
    pts.push(`${f2(r * e * c)} ${f2(r * e * s * m.stretch)}`)
  }
  return `M${pts.join('L')}Z`
}
function MarkShape({m, scale}: {m: Mark; scale: number}) {
  return <g transform={`translate(${f2(m.x)} ${f2(m.y)}) rotate(${f2(m.angle)})`}>
    {m.soft > 0 && <path d={outline({...m, size: m.size * (1 + m.soft * .3)}, scale)} fill="var(--text, #d4d7da)" opacity={m.opacity * m.soft * .35} />}
    <path d={outline(m, scale)} fill="var(--text, #d4d7da)" opacity={m.opacity * (1 - m.soft * .3)} />
  </g>
}

/** The patch at true size and, beside it, nine marks ten times larger. Handles: 1 the largest mark's size (its edge in the magnifier), 2 the
 * angle (round the magnifier's centre). */
function InkDisplay({p, w, h, handles, mag = true}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2; mag?: boolean}) {
  const v = p.v, law = markLaw(v), magW = mag ? Math.min(h, w * .45) : 0, patchW = w - magW - (mag ? 4 : 0)
  if (!law) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the marks'}</text>
  const max = fin(v, R.max)!, pitch = Math.max(3, max * 1.6 + 1.5), cols = Math.floor(patchW / pitch), rows = Math.floor(h / pitch), marks: Mark[] = []
  for (let j = 0; j < rows && marks.length < 2400; j++) for (let i = 0; i < cols && marks.length < 2400; i++) {
    const k = j * cols + i; marks.push(law(k, (i + .5 + (hash(k, 3) - .5) * .8) * pitch, (j + .5 + (hash(k, 4) - .5) * .8) * pitch)) }
  // The magnifier: ten times, or less where the largest stretched mark would not fit its ninth of the square.
  const mx = patchW + 4, cell = magW / 3, zoom = clampTo(1, 10, Math.floor(cell * .8 / (max * (1 + (boolOf(v, 'grainProfile') !== false ? fin(v, R.long) ?? 0 : 0))))), big = Array.from({length: 9}, (_, k) => law(k * 7 + 3, mx + (k % 3 + .5) * cell, (Math.floor(k / 3) + .5) * cell))
  const maxM = big.reduce((a, b) => (b.size > a.size ? b : a)), ms = st(p, R.max.key), as = st(p, R.angle.key), aOff = offWhy(p, R.angle)
  return <g>
    {marks.map((m, i) => <MarkShape key={i} m={m} scale={1} />)}
    {mag && <g>
      <rect x={mx} y={0} width={magW} height={h} fill="var(--dp-well)" stroke="var(--line, #24262a)" />
      {big.map((m, i) => <MarkShape key={i} m={m} scale={zoom} />)}
      <text x={mx + 3} y={h - 3} className="dp-axis">×{zoom}</text>
      {handles >= 1 && <Handle n={1} x={maxM.x + Math.min(maxM.size * zoom / 2, cell * .45)} y={maxM.y} label="Max size" does={`Drag across: the size of the largest mark.${ms.disabled ? ` ${ms.disabled}` : ''}`}
        onDrag={ms.disabled ? undefined : x => p.set(R.max.key, Math.round(clampTo(.05, 80, Math.max(.05, (x - maxM.x) * 2 / zoom)) * 100) / 100)} onReset={ms.disabled ? undefined : () => p.set(R.max.key, 1.6)} />}
      {handles >= 2 && !aOff && <Handle n={2} shape="ring" x={mx + magW / 2 + Math.cos((fin(v, R.angle) ?? 0) * Math.PI / 180) * cell * 1.2} y={h / 2 + Math.sin((fin(v, R.angle) ?? 0) * Math.PI / 180) * cell * 1.2}
        label="Angle" does={`Drag round: the angle of stretched marks.${as.disabled ? ` ${as.disabled}` : ''}`}
        onDrag={as.disabled ? undefined : (x, y) => p.set(R.angle.key, Math.round(Math.atan2(y - h / 2, x - mx - magW / 2) * 180 / Math.PI))} onReset={as.disabled ? undefined : () => p.set(R.angle.key, 0)} />}
    </g>}
  </g>
}

const LIGHT_WHY = 'Ink has no on or off: the field is always drawn in marks. The light stays hollow.'
const head = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const DISPLAY_DOES = 'The marks by the engine\'s law: at the left at true size, at the right ten times larger.'

export const design: DesignedDevice = {
  id: 'expressions:ink',
  title: 'Ink',
  kind: 'effect',
  defaults: {
    particleCount: 200000, 'particleSize.min': .16, 'particleSize.max': 1.6, 'material.opacity': .92, dotShape: 'circle', grainProfile: true, 'material.sizeBias': 1.6,
    'material.roundness': .95, 'material.softness': .15, 'material.irregularity': .35, 'material.elongation': .04, 'material.orientation': 0, 'material.contrast': .93,
    'material.densityScale': 1, 'material.densityPhase': .3, 'material.edgeWeight': 0, 'material.halo': .13,
  },
  fixtures: {
    'Fine stipple': {},
    'Long rough strokes': {'particleSize.min': 1.2, 'particleSize.max': 6, 'material.roundness': .3, 'material.elongation': 1.6, 'material.orientation': 30, 'material.irregularity': .8, 'material.softness': .4},
    'Classic profile': {grainProfile: false, dotShape: 'square', 'particleSize.max': 3},
    'No readings': {'particleSize.min': undefined, 'particleSize.max': undefined, 'material.opacity': undefined, particleCount: undefined, reason: 'The field has not announced its marks'},
  },

  folded: p => <Folded title="Ink" light="unknown" readings={[fin(p.v, R.count) === undefined ? NONE : R.count.format(fin(p.v, R.count)!),
    fin(p.v, R.min) === undefined || fin(p.v, R.max) === undefined ? NONE : `${fin(p.v, R.min)}–${fin(p.v, R.max)} px`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Ink" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><Display w={140} h={146} label="Marks" does={`${DISPLAY_DOES} Drag handle 1 for the largest mark.`}><InkDisplay p={p} w={140} h={146} handles={1} /></Display></Section>
    <Section label="Macros" cols={2}>{dial(p, R.bias)}{dial(p, R.round)}{dial(p, R.soft)}{dial(p, R.max)}</Section>
  </Panel>,

  whole: p => { const w = wide(p) ? Math.round(clampTo(186, (p.room!.w - 560) / 2, 340)) : 186
    return <Panel title="Ink" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}><Display w={w} h={146} label="Marks" does={`${DISPLAY_DOES} Drag handle 1 for the largest mark and handle 2 for the angle.`} corner={fin(p.v, R.count) === undefined ? NONE : R.count.format(fin(p.v, R.count)!)}>
          <InkDisplay p={p} w={w} h={146} handles={2} /></Display></Section>
        <Section label="Size" cols={2} grow>{dial(p, R.count)}{dial(p, R.opacity)}{box(p, R.min)}{box(p, R.max)}
          <Radio {...st(p, 'dotShape')} does="The basic shape of a mark, used by the classic profile." value={strOf(p.v, 'dotShape') ?? ''} options={SHAPES} stack onChange={x => p.set('dotShape', x)} />
          <Toggle {...st(p, 'grainProfile')} label="Profile" does="The extended grain profile: on, the rows of the mark act; off, they only read." on={boolOf(p.v, 'grainProfile') === true} unknown={boolOf(p.v, 'grainProfile') === undefined} onChange={x => p.set('grainProfile', x)} />
        </Section>
      </Band>
      <Band>
        <Section label="Mark" cols={3} width={168}>{dial(p, R.bias)}{dial(p, R.round)}{dial(p, R.soft)}{box(p, R.rough)}{box(p, R.long)}{box(p, R.angle)}</Section>
        <Section label="Density" cols={2} grow>{box(p, R.contrast)}{box(p, R.bandScale)}{box(p, R.bandPhase)}{box(p, R.edge)}{box(p, R.halo)}</Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The marks at their size">
      <g className="dp-display" style={{background: 'none', border: 'none'}}><InkDisplay p={{...p, set: () => {}}} w={760} h={420} handles={0} /></g>
    </svg>
  </div>,

  widget: p => <Tile title="Ink" light="unknown" span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="Marks" does={DISPLAY_DOES}><InkDisplay p={p} w={112} h={104} handles={0} /></Display>
    <div className="ref-tile-grid ref-tile-grid--boxes">{box(p, R.bias)}{box(p, R.round)}{box(p, R.soft)}{box(p, R.max)}</div>
  </Tile>,
}
