// Colour (manual §20.11, expressions:colour): the palette the field is painted with, and how it lies across the field. Live's nearest:
// Auto Filter's well with a handle on the picture, and the Spectral Resonator's colour of its partials. The display is the field painted
// by the distribution's law, from the palette stops: a linear wave runs the palette in bands across the gradient's angle, Wave frequency
// bands to the field; concentric rings run it out from the palette centre; a conic sweep runs it round the centre; one ink paints the
// first stop alone. Kinetic energy, density depth, interference and the spectral rainbow follow the particles' own motion and density,
// which no reading carries: for those the well shows the palette and says so. The colours inside the well are the palette's own; they
// are the material, not the device's. Handle 1 is the centre (both offsets), handle 2 the angle.
//
// Everything is keyed on the engine's paths: the registry's (nativeParameters.ts over paramRegistry.ts, groups Color and Paper) and the colour
// settings (parameterAddress.ts COLOUR_SETTING_TYPES and PANEL_FAMILY). The owner reports:
//   colorEnabled  the palette paints the field (the light)      colorMode  linearGradient | radialGradient | angularSweep | velocityThermal |
//                                                                           densityDepth | waveInterference | rainbowSpectral | monochrome
//   palette       the field's stops, 2 to 8 colours (field.palette)      background  the paper colour (field.background)
//   backgroundMode  solid | vignette | ambientGlow | adaptive
//   color.cycleSpeed −10..10 (1.2)   color.hueShiftSpeed −6..6 (0)   color.waveFrequency 0.05..24 log (1.8)   color.angle −360..360° (45)
//   color.fieldCenterOffset.0 and .1  −3..3 (0)   color.speedReactiveIntensity 0..5 (0.6)   color.turbulenceModulation 0..3 (0.35)
//   color.densityWeight 0..3 (0.5)   color.contrast 0.1..5 log (1)   backgroundGlowIntensity 0..3 (0.45)   paperGrain 0..0.2 (0)
//                                                                                      (fieldDefaults.ts DEFAULT_COLOR_CONFIG)
// The kit has no colour control, so a stop's colour is edited in the Studio's own palette; here stops are added and removed.
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Section, Tile, Toggle, ValueBox, type LightState, type Scale} from '../../sdk/panel'
import {NONE, boolOf, clampTo, fixed, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const d2 = fixed(2), d1 = fixed(1)
interface Rule {readonly key: string; readonly label: string; readonly scale: Scale; readonly def: number; readonly format: (x: number) => string; readonly does: string; readonly bipolar?: boolean}
const R = {
  cycle: {key: 'color.cycleSpeed', label: 'Cycle', scale: {min: -10, max: 10}, def: 1.2, format: d1, does: 'How fast the palette moves through the field.', bipolar: true},
  hue: {key: 'color.hueShiftSpeed', label: 'Hue shift', scale: {min: -6, max: 6}, def: 0, format: d2, does: 'How fast the hues turn.', bipolar: true},
  wave: {key: 'color.waveFrequency', label: 'Waves', scale: {min: .05, max: 24, log: true}, def: 1.8, format: d2, does: 'How many bands of the palette cross the field.'},
  angle: {key: 'color.angle', label: 'Angle', scale: {min: -360, max: 360}, def: 45, format: x => `${Math.round(x)}°`, does: 'The direction of the bands.', bipolar: true},
  cx: {key: 'color.fieldCenterOffset.0', label: 'X', scale: {min: -3, max: 3}, def: 0, format: d2, does: 'The centre the bands spread from, across.', bipolar: true},
  cy: {key: 'color.fieldCenterOffset.1', label: 'Y', scale: {min: -3, max: 3}, def: 0, format: d2, does: 'The centre the bands spread from, up.', bipolar: true},
  speed: {key: 'color.speedReactiveIntensity', label: 'Velocity', scale: {min: 0, max: 5}, def: .6, format: d2, does: 'How much fast areas change the colour.'},
  turb: {key: 'color.turbulenceModulation', label: 'Stir', scale: {min: 0, max: 3}, def: .35, format: d2, does: 'How much stirred areas change the colour.'},
  density: {key: 'color.densityWeight', label: 'Density', scale: {min: 0, max: 3}, def: .5, format: d2, does: 'How much dense areas change the colour.'},
  contrast: {key: 'color.contrast', label: 'Contrast', scale: {min: .1, max: 5, log: true}, def: 1, format: d2, does: 'The contrast of the palette response.'},
  glow: {key: 'backgroundGlowIntensity', label: 'Glow', scale: {min: 0, max: 3}, def: .45, format: d2, does: 'The glow behind the field.'},
  grain: {key: 'paperGrain', label: 'Grain', scale: {min: 0, max: .2}, def: 0, format: fixed(3), does: 'The grain of the paper.'},
} satisfies Record<string, Rule>
const fin = (v: V, r: Rule) => { const x = numOf(v, r.key); return x !== undefined && Number.isFinite(x) ? x : undefined }
const dial = (p: ViewProps, r: Rule) => <Dial key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} bipolar={r.bipolar} onChange={x => p.set(r.key, Math.round(x * 1000) / 1000)} />
const box = (p: ViewProps, r: Rule) => <ValueBox key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} bipolar={r.bipolar} onChange={x => p.set(r.key, Math.round(x * 1000) / 1000)} />
const MODES = [{value: 'linearGradient', label: 'Linear wave'}, {value: 'radialGradient', label: 'Concentric rings'}, {value: 'angularSweep', label: 'Conic sweep'}, {value: 'velocityThermal', label: 'Kinetic energy'},
  {value: 'densityDepth', label: 'Density depth'}, {value: 'waveInterference', label: 'Interference'}, {value: 'rainbowSpectral', label: 'Iridescent'}, {value: 'monochrome', label: 'One ink'}] as const
const BACKGROUNDS = [{value: 'solid', label: 'Solid', does: 'Plain paper.'}, {value: 'vignette', label: 'Vignette', does: 'The paper darkens at its edges.'},
  {value: 'ambientGlow', label: 'Glow', does: 'The paper glows behind the field.'}, {value: 'adaptive', label: 'Adaptive', does: 'The glow follows the field.'}] as const

const paletteOf = (v: V): string[] | undefined => { const p = json<unknown>(v, 'palette', undefined); return Array.isArray(p) ? p.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)) : undefined }
const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const
/** The palette at s in 0..1, cyclic, by straight steps between stops. */
function ramp(pal: readonly string[], s: number) {
  const u = ((s % 1) + 1) % 1 * pal.length, i = Math.floor(u), f = u - i, a = rgb(pal[i % pal.length]!), b = rgb(pal[(i + 1) % pal.length]!)
  return `rgb(${a.map((x, k) => Math.round(x + (b[k]! - x) * f)).join(',')})`
}
const f1 = (x: number) => x.toFixed(1)

/** The field painted by the law, in cells. Handles: 1 the centre (across and up), 2 the angle (round the centre). */
function Field({p, w, h, handles, cell = 5}: {p: ViewProps; w: number; h: number; handles: 0 | 2; cell?: number}) {
  const v = p.v, pal = paletteOf(v), mode = strOf(v, 'colorMode'), on = boolOf(v, 'colorEnabled'), wave = fin(v, R.wave), ang = fin(v, R.angle), ox = fin(v, R.cx), oy = fin(v, R.cy)
  const swH = 10, fh = h - swH - 4, L = Math.min(w, fh), cx = w / 2 + (ox ?? 0) * L / 6, cy = fh / 2 - (oy ?? 0) * L / 6
  const geom = mode === 'linearGradient' || mode === 'radialGradient' || mode === 'angularSweep'
  if (!pal || !pal.length) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the palette'}</text>
  const a = (ang ?? 0) * Math.PI / 180, cols = Math.ceil(w / cell), rows = Math.ceil(fh / cell)
  const law = (x: number, y: number) => { const dx = (x - cx) / L, dy = (cy - y) / L
    if (mode === 'radialGradient') return Math.hypot(dx, dy) * (wave ?? 1)
    if (mode === 'angularSweep') return (Math.atan2(dy, dx) / (Math.PI * 2) + 1) * Math.max(1, Math.round(wave ?? 1))
    return (dx * Math.cos(a) + dy * Math.sin(a)) * (wave ?? 1) }
  const cs = st(p, R.cx.key), as = st(p, R.angle.key)
  const hx = cx + Math.cos(a) * L * .32, hy = cy - Math.sin(a) * L * .32
  return <g>
    {on === false || mode === 'monochrome' ? <rect x={0} y={0} width={w} height={fh} fill={pal[0]} opacity={on === false ? .35 : 1} />
      : geom && wave !== undefined && ang !== undefined ? Array.from({length: rows}, (_, j) => Array.from({length: cols}, (_, i) =>
        <rect key={`${i}-${j}`} x={i * cell} y={j * cell} width={cell + .5} height={cell + .5} fill={ramp(pal, law(i * cell + cell / 2, j * cell + cell / 2))} />))
      : <g>{pal.map((c, i) => <rect key={i} x={i * w / pal.length} y={0} width={w / pal.length + .5} height={fh} fill={c} opacity={.55} />)}
        <text x={w / 2} y={fh / 2 + 3} textAnchor="middle" className="dp-ink" style={{fontSize: 9}}>{mode ? 'follows the motion' : 'no distribution'}</text></g>}
    {on === false && <text x={w / 2} y={fh / 2 + 3} textAnchor="middle" className="dp-ink" style={{fontSize: 9}}>one ink</text>}
    {pal.map((c, i) => <rect key={`s${i}`} x={2 + i * 12} y={h - swH - 1} width={10} height={swH} fill={c} stroke="var(--line, #24262a)" />)}
    {handles >= 2 && geom && on !== false && ox !== undefined && oy !== undefined && <>
      {mode === 'linearGradient' && ang !== undefined && <path d={`M${f1(cx)} ${f1(cy)}L${f1(hx)} ${f1(hy)}`} stroke="var(--dp-well)" strokeWidth={1.5} strokeDasharray="2 2" />}
      <Handle n={1} x={cx} y={cy} label="Palette centre" does={`Drag: the centre the bands spread from.${cs.disabled ? ` ${cs.disabled}` : ''}`}
        onDrag={cs.disabled ? undefined : (x, y) => { p.set(R.cx.key, Math.round(clampTo(-3, 3, (x - w / 2) / L * 6) * 20) / 20); p.set(R.cy.key, Math.round(clampTo(-3, 3, (fh / 2 - y) / L * 6) * 20) / 20) }}
        onReset={cs.disabled ? undefined : () => { p.set(R.cx.key, 0); p.set(R.cy.key, 0) }} />
      {mode === 'linearGradient' && ang !== undefined && <Handle n={2} shape="ring" x={hx} y={hy} label="Gradient angle" does={`Drag round the centre: the direction of the bands.${as.disabled ? ` ${as.disabled}` : ''}`}
        onDrag={as.disabled ? undefined : (x, y) => p.set(R.angle.key, Math.round(Math.atan2(cy - y, x - cx) * 180 / Math.PI))} onReset={as.disabled ? undefined : () => p.set(R.angle.key, 45)} />}
    </>}
  </g>
}

const lightOf = (p: ViewProps): LightState => { const on = boolOf(p.owner ?? p.v, 'colorEnabled'); return on === undefined ? 'unknown' : on ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'colorEnabled').disabled, onFold: p.nav.fold, onFull: p.nav.full,
  onLight: () => p.set('colorEnabled', !(boolOf(p.v, 'colorEnabled') === true))})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const modeWord = (v: V) => MODES.find(m => m.value === strOf(v, 'colorMode'))?.label
const DISPLAY_DOES = 'The field painted by the distribution, from the palette\'s stops; the stops along the foot.'

function controls(p: ViewProps) {
  const v = p.v, pal = paletteOf(v)
  return {
    mode: <Chooser {...st(p, 'colorMode')} wide label="Distribution" does="The pattern the palette follows across the field." value={strOf(v, 'colorMode') ?? ''} options={MODES} onChange={x => p.set('colorMode', x)} />,
    add: <Action {...st(p, 'palette')} label="+ stop" does="Add a stop to the palette: up to eight." onPress={pal && pal.length < 8 ? () => p.set('palette', JSON.stringify([...pal, pal[pal.length - 1]!])) : undefined} />,
    remove: <Action {...st(p, 'palette')} label="− stop" does="Take the last stop off the palette: two stay." onPress={pal && pal.length > 2 ? () => p.set('palette', JSON.stringify(pal.slice(0, -1))) : undefined} />,
    background: <Radio {...st(p, 'backgroundMode')} label="Paper" does="How the paper glows." value={strOf(v, 'backgroundMode') ?? ''} options={BACKGROUNDS} stack onChange={x => p.set('backgroundMode', x)} />,
    on: <Toggle {...st(p, 'colorEnabled')} label="Palette" does="On: the palette paints the field. Off: one ink." on={boolOf(v, 'colorEnabled') === true} unknown={boolOf(v, 'colorEnabled') === undefined} onChange={x => p.set('colorEnabled', x)} />,
  }
}

export const design: DesignedDevice = {
  id: 'expressions:colour',
  title: 'Colour',
  kind: 'effect',
  firstPage: 'palette',
  defaults: {
    colorEnabled: true, colorMode: 'linearGradient', palette: JSON.stringify(['#0b1d3a', '#1f6f8b', '#99d5c9', '#f4e285', '#f08a4b']), background: '#09090b', backgroundMode: 'solid',
    'color.cycleSpeed': 1.2, 'color.hueShiftSpeed': 0, 'color.waveFrequency': 1.8, 'color.angle': 45, 'color.fieldCenterOffset.0': 0, 'color.fieldCenterOffset.1': 0,
    'color.speedReactiveIntensity': .6, 'color.turbulenceModulation': .35, 'color.densityWeight': .5, 'color.contrast': 1, backgroundGlowIntensity: .45, paperGrain: 0,
  },
  fixtures: {
    'A linear wave': {},
    'Rings from a moved centre': {colorMode: 'radialGradient', 'color.fieldCenterOffset.0': -1.2, 'color.fieldCenterOffset.1': .8, 'color.waveFrequency': 3},
    'Kinetic energy': {colorMode: 'velocityThermal'},
    'One ink': {colorEnabled: false},
    'No readings': {colorEnabled: undefined, colorMode: undefined, palette: undefined, 'color.waveFrequency': undefined, 'color.angle': undefined, reason: 'The field has not announced its palette'},
  },

  folded: p => <Folded title="Colour" light={lightOf(p)} readings={[paletteOf(p.v) ? `${paletteOf(p.v)!.length} colours` : NONE, modeWord(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Colour" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><Display w={140} h={146} label="Field" does={`${DISPLAY_DOES} Drag handle 1 for the centre and handle 2 for the angle.`}><Field p={p} w={140} h={146} handles={2} /></Display></Section>
    <Section label="Macros" cols={2}>{dial(p, R.cycle)}{dial(p, R.hue)}{dial(p, R.wave)}{dial(p, R.contrast)}</Section>
  </Panel>,

  whole: p => { const c = controls(p), w = wide(p) ? Math.round(clampTo(186, (p.room!.w - 520) / 2, 360)) : 186
    return <Panel title="Colour" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}><Display w={w} h={146} label="Field" does={`${DISPLAY_DOES} Drag handle 1 for the centre and handle 2 for the angle.`}><Field p={p} w={w} h={146} handles={2} /></Display></Section>
        <Section label="Palette" width={100}>{c.on}{c.mode}<div className="ref-pair">{c.add}{c.remove}</div></Section>
        <Section label="Geometry" cols={2} grow>{dial(p, R.wave)}{dial(p, R.angle)}{box(p, R.cx)}{box(p, R.cy)}</Section>
      </Band>
      <Band>
        <Section label="Dynamics" cols={3} width={168}>{dial(p, R.cycle)}{dial(p, R.hue)}{dial(p, R.contrast)}{box(p, R.speed)}{box(p, R.turb)}{box(p, R.density)}</Section>
        <Section label="Paper" width={72}>{c.background}</Section>
        <Section label="Atmosphere" grow>{dial(p, R.glow)}{box(p, R.grain)}</Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The field in colour">
      <g className="dp-display" style={{background: 'none', border: 'none'}}><Field p={p} w={760} h={420} handles={2} cell={10} /></g>
    </svg>
  </div>,

  widget: p => <Tile title="Colour" light={lightOf(p)} onLight={head(p).onLight} lightWhy={head(p).lightWhy} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="Field" does={DISPLAY_DOES}><Field p={p} w={112} h={104} handles={0} /></Display>
    <div className="ref-tile-grid ref-tile-grid--boxes">{box(p, R.cycle)}{box(p, R.hue)}{box(p, R.wave)}{box(p, R.contrast)}</div>
  </Tile>,
}
