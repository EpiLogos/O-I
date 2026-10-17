// Depth (manual §20.13, expressions:depth): the true 3D body of every glyph and source, and the lens the field is seen through. Live's
// nearest: Drum Buss's and Saturator's small curve displays — a shape drawn from a few amounts — beside Hybrid Reverb's paged sections.
// The display is the body's cross-section across one stroke, by its profile (glyphVolume.ts): a slab keeps its thickness, a bevel
// chamfers from the contour, round swells like a pillow with steep shoulders, a dome bulges, a taper runs to a knife edge; Body depth
// sets the thickness (at 0 a flat card), the flank share shades the side walls in the contour band, the face share draws the front and
// back sheets, and the interior fill spreads the inside. Beside it, the lens: parallel lines when orthographic; with perspective, the
// field of view's cone from the eye at its orbit distance, the marks shrinking with distance by the attenuation and fading by the aerial
// fade, as the engine draws them.
//
// Everything is keyed on the engine's paths: the registry's (nativeParameters.ts over paramRegistry.ts, groups Volume and Depth) and the panel
// settings (parameterAddress.ts PANEL_FAMILY: volumeEnabled, volumeProfile, depthPerspective, depthOcclusion, vortex3d, dispersion3d). The owner
// reports (defaults: glyphVolume.ts DEFAULT_GLYPH_VOLUME, fieldDefaults.ts DEFAULT_DEPTH_CONFIG):
//   volumeEnabled  the light      volumeProfile  slab | bevel | round | dome | taper (round)
//   glyphVolume.depth 0..600 px log (90)   .wallShare 0..1 (0.34)   .faceBias 0..1 (0.55)   .interiorFill 0..1 (0.25)   .surfaceThickness 0..80 px (6)
//   .wallBand 1..80 px (42)   .outsideTaper 0..3   .referenceFalloff 0.1..4 (1)   .densityDepth −1..1 (0.35)   .jitter 0..40 px (2)
//   depthPerspective (off: orthographic)   depthOcclusion   depth.fov 10..100° (38)   depth.distance 100..5000 px log (800)
//   depth.sizeAttenuation 0..3 (1)   .sizeAttenuationCurve 0.2..3 (1)   .sizeDepthBias −1..1 (0)   depth.aerialFade 0..1 (0.55)
//   depth.aerialRange 0.2..6 (2.2)   depth.depthTintWeight 0..1 (0)   vortex3d, dispersion3d 0..1 (1): depth in the swirl and the bridge
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Section, Tile, Toggle, ValueBox, type LightState, type Scale} from '../../sdk/panel'
import {NONE, boolOf, clampTo, fixed, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const d2 = fixed(2), px = (x: number) => `${Math.round(x)} px`
interface Rule {readonly key: string; readonly label: string; readonly scale: Scale; readonly def: number; readonly format: (x: number) => string; readonly does: string; readonly bipolar?: boolean}
const R = {
  depth: {key: 'glyphVolume.depth', label: 'Body', scale: {min: 1, max: 600, log: true}, def: 90, format: px, does: 'The thickness of the body. At 0 each symbol is a flat card.'},
  wall: {key: 'glyphVolume.wallShare', label: 'Flank', scale: {min: 0, max: 1}, def: .34, format: d2, does: 'How much of the body lies on the side walls: high reads solid as the view turns.'},
  face: {key: 'glyphVolume.faceBias', label: 'Face', scale: {min: 0, max: 1}, def: .55, format: d2, does: 'How much of the rest lies on the front and back sheets.'},
  fill: {key: 'glyphVolume.interiorFill', label: 'Fill', scale: {min: 0, max: 1}, def: .25, format: d2, does: 'How far the inside fills.'},
  sheet: {key: 'glyphVolume.surfaceThickness', label: 'Sheet', scale: {min: 0, max: 80}, def: 6, format: px, does: 'The thickness of the front and back sheets.'},
  band: {key: 'glyphVolume.wallBand', label: 'Band', scale: {min: 1, max: 80}, def: 42, format: px, does: 'The band at the edge where the side wall falls off.'},
  taper: {key: 'glyphVolume.outsideTaper', label: 'Taper', scale: {min: 0, max: 3}, def: .6, format: d2, does: 'How far loose marks outside the stroke keep thickness.'},
  reach: {key: 'glyphVolume.referenceFalloff', label: 'Reach', scale: {min: .1, max: 4}, def: 1, format: d2, does: 'How wide the profile is measured.'},
  dens: {key: 'glyphVolume.densityDepth', label: 'Density', scale: {min: -1, max: 1}, def: .35, format: d2, does: 'Whether dense ink reads thicker (up) or thinner (down).', bipolar: true},
  jitter: {key: 'glyphVolume.jitter', label: 'Jitter', scale: {min: 0, max: 40}, def: 2, format: d2, does: 'How much noise the depth has.'},
  fov: {key: 'depth.fov', label: 'FOV', scale: {min: 10, max: 100}, def: 38, format: x => `${Math.round(x)}°`, does: 'The width of the lens.'},
  dist: {key: 'depth.distance', label: 'Distance', scale: {min: 100, max: 5000, log: true}, def: 800, format: px, does: 'The distance of the eye from the field.'},
  att: {key: 'depth.sizeAttenuation', label: 'Shrink', scale: {min: 0, max: 3}, def: 1, format: d2, does: 'How fast distant marks shrink: 1 is the physical law.'},
  curve: {key: 'depth.sizeAttenuationCurve', label: 'Curve', scale: {min: .2, max: 3}, def: 1, format: d2, does: 'How the shrinking bends with distance.'},
  bias: {key: 'depth.sizeDepthBias', label: 'Bias', scale: {min: -1, max: 1}, def: 0, format: d2, does: 'A straight extra: near marks larger, far smaller, or the reverse.', bipolar: true},
  fade: {key: 'depth.aerialFade', label: 'Fade', scale: {min: 0, max: 1}, def: .55, format: d2, does: 'How far distance dims the ink.'},
  range: {key: 'depth.aerialRange', label: 'Reach', scale: {min: .2, max: 6}, def: 2.2, format: d2, does: 'How far the fade reaches, as a multiple of the distance.'},
  tint: {key: 'depth.depthTintWeight', label: 'Tint', scale: {min: 0, max: 1}, def: 0, format: d2, does: 'How far distance shifts the ink toward the fade colour.'},
  swirl: {key: 'vortex3d', label: 'In swirl', scale: {min: 0, max: 1}, def: 1, format: d2, does: 'How far the swirl acts through the body\'s depth.'},
  bridge: {key: 'dispersion3d', label: 'In bridge', scale: {min: 0, max: 1}, def: 1, format: d2, does: 'How far the bridge between glyphs acts through depth.'},
} satisfies Record<string, Rule>
const fin = (v: V, r: Rule) => { const x = numOf(v, r.key); return x !== undefined && Number.isFinite(x) ? x : undefined }
const dial = (p: ViewProps, r: Rule) => <Dial key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} bipolar={r.bipolar} onChange={x => p.set(r.key, Math.round(x * 100) / 100)} />
const box = (p: ViewProps, r: Rule) => <ValueBox key={r.key} {...st(p, r.key)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} bipolar={r.bipolar} onChange={x => p.set(r.key, Math.round(x * 100) / 100)} />
const PROFILES = [{value: 'slab', label: 'Slab', does: 'A straight extrusion: the same thickness throughout.'}, {value: 'bevel', label: 'Bevel', does: 'Chamfered from the contour, like an embossed die.'},
  {value: 'round', label: 'Round', does: 'A pillow with steep shoulders.'}, {value: 'dome', label: 'Dome', does: 'A convex bulge.'}, {value: 'taper', label: 'Taper', does: 'A knife-edge sliver.'}] as const
const f1 = (x: number) => x.toFixed(1)

/** The profile's thickness at u in 0..1 from the contour to the stroke's middle, 0..1 of the body depth. */
const profile = (kind: string, u: number) => (kind === 'slab' ? 1 : kind === 'bevel' ? Math.min(1, u * 3) : kind === 'dome' ? Math.sqrt(1 - (1 - u) ** 2) * .75 + .25 * u : kind === 'taper' ? u : Math.min(1, Math.sqrt(u * 2.2)))

/** The cross-section across one stroke. Handle 1 the body depth (up and down at the middle), 2 the flank share (the side wall's edge). */
function Section3d({p, w, h, handles}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2}) {
  const v = p.v, kind = strOf(v, 'volumeProfile'), depth = fin(v, R.depth), wall = fin(v, R.wall), face = fin(v, R.face), fill = fin(v, R.fill), on = boolOf(v, 'volumeEnabled')
  if (kind === undefined || depth === undefined || wall === undefined) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the body'}</text>
  const x0 = 10, x1 = w - 10, cy = h / 2 + 4, maxH = h / 2 - 16, thick = on === false ? 0 : maxH * Math.log(1 + depth) / Math.log(601)
  const pts = Array.from({length: 61}, (_, i) => { const t = i / 60, u = 1 - Math.abs(t * 2 - 1); return [x0 + t * (x1 - x0), profile(kind, u) * thick] as const })
  const top = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)} ${f1(cy - y)}`).join(''), bot = [...pts].reverse().map(([x, y]) => `L${f1(x)} ${f1(cy + y)}`).join('')
  const flankW = (x1 - x0) / 2 * clampTo(0, 1, wall) * .6, ds = st(p, R.depth.key), ws = st(p, R.wall.key)
  return <g>
    <path d={`M${x0} ${cy}H${x1}`} className="dp-grid" />
    {thick > .5 ? <>
      <path d={`${top}${bot}Z`} className="dp-fill" />
      {[x0, x1 - flankW].map((x, i) => <rect key={i} x={x} y={cy - thick} width={flankW} height={thick * 2} fill="var(--dp-value)" opacity={.18} />)}
      <path d={top} className="dp-curve" strokeWidth={1.5 + (face ?? 0) * 2} /><path d={`M${f1(x1)} ${f1(cy)}${bot}`} className="dp-curve" strokeWidth={1.5 + (face ?? 0) * 2} />
      {Array.from({length: Math.round((fill ?? 0) * 8)}, (_, i) => <path key={i} d={`M${f1(x0 + (x1 - x0) * (.25 + .5 * i / 8))} ${f1(cy - thick * .35)}v${f1(thick * .7)}`} className="dp-faint" />)}
    </> : <path d={`M${x0} ${cy}H${x1}`} className="dp-curve" strokeWidth={2} />}
    <text x={x0} y={h - 4} className="dp-axis">contour</text><text x={x1} y={h - 4} textAnchor="end" className="dp-axis">{on === false ? 'flat card' : `${Math.round(depth)} px`}</text>
    {handles >= 1 && on !== false && <Handle n={1} shape="square" x={(x0 + x1) / 2} y={cy - Math.max(thick, 2)} label="Body depth" does={`Drag up or down: the thickness of the body.${ds.disabled ? ` ${ds.disabled}` : ''}`}
      onDrag={ds.disabled ? undefined : (_, y) => p.set(R.depth.key, Math.round(clampTo(1, 600, Math.exp(clampTo(0, 1, (cy - y) / maxH) * Math.log(601)) - 1)))} onReset={ds.disabled ? undefined : () => p.set(R.depth.key, 90)} />}
    {handles >= 2 && on !== false && <Handle n={2} x={x0 + flankW} y={cy + thick * .5} label="Flank share" does={`Drag across: how much of the body lies on the side walls.${ws.disabled ? ` ${ws.disabled}` : ''}`}
      onDrag={ws.disabled ? undefined : x => p.set(R.wall.key, Math.round(clampTo(0, 1, (x - x0) / ((x1 - x0) / 2 * .6)) * 100) / 100)} onReset={ws.disabled ? undefined : () => p.set(R.wall.key, .34)} />}
  </g>
}

/** The lens: parallel lines when orthographic; with perspective, the cone of the field of view from the eye, marks shrinking and fading
 * with distance. Handle 1 the field of view (the cone's edge). */
function Lens({p, w, h, handles}: {p: ViewProps; w: number; h: number; handles: boolean}) {
  const v = p.v, persp = boolOf(v, 'depthPerspective'), fov = fin(v, R.fov), att = fin(v, R.att) ?? 1, fade = fin(v, R.fade) ?? 0, cy = h / 2, ex = 10, x1 = w - 6, fs = st(p, R.fov.key)
  if (persp === undefined || fov === undefined) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">No reading of the lens</text>
  const half = persp ? Math.tan(fov * Math.PI / 360) : 0, reach = (x1 - ex)
  return <g>
    <circle cx={ex} cy={cy} r={3} fill="var(--text)" />
    {persp ? <path d={`M${ex} ${cy}L${x1} ${f1(cy - half * reach)}M${ex} ${cy}L${x1} ${f1(cy + half * reach)}`} className="dp-curve" />
      : <path d={`M${ex} ${cy - h * .3}H${x1}M${ex} ${cy + h * .3}H${x1}`} className="dp-curve" />}
    {[.3, .55, .8].map((t, i) => { const x = ex + t * reach, s = persp ? Math.pow(.35 / t, att) * 3 : 3, o = persp ? Math.max(.15, 1 - fade * t) : 1
      return <circle key={i} cx={x} cy={cy} r={clampTo(.6, 6, s)} fill="var(--text)" opacity={o} /> })}
    <text x={x1} y={h - 4} textAnchor="end" className="dp-axis">{persp ? 'perspective' : 'orthographic'}</text>
    {handles && persp && <Handle n={1} shape="ring" x={x1 - 8} y={cy - half * (reach - 8)} label="Field of view" does={`Drag up or down: the width of the lens.${fs.disabled ? ` ${fs.disabled}` : ''}`}
      onDrag={fs.disabled ? undefined : (_, y) => p.set(R.fov.key, Math.round(clampTo(10, 100, Math.atan(Math.abs(cy - y) / (reach - 8)) * 360 / Math.PI)))} onReset={fs.disabled ? undefined : () => p.set(R.fov.key, 38)} />}
  </g>
}

const lightOf = (p: ViewProps): LightState => { const on = boolOf(p.owner ?? p.v, 'volumeEnabled'); return on === undefined ? 'unknown' : on ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'volumeEnabled').disabled, onFold: p.nav.fold, onFull: p.nav.full, onLight: () => p.set('volumeEnabled', !(boolOf(p.v, 'volumeEnabled') === true))})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const DISPLAY_DOES = 'The body across one stroke by its profile: the side walls shaded, the front and back sheets drawn. At the right, the lens.'

/** The section and the lens side by side in one well. */
function Both({p, w, h, handles}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2}) {
  const sw = Math.round(w * .62)
  return <g><Section3d p={p} w={sw} h={h} handles={handles} /><path d={`M${sw} 6V${h - 6}`} className="dp-faint" /><g transform={`translate(${sw} 0)`}><Lens p={p} w={w - sw} h={h} handles={handles >= 2} /></g></g>
}

export const design: DesignedDevice = {
  id: 'expressions:depth',
  title: 'Depth',
  kind: 'effect',
  firstPage: 'body',
  defaults: {
    volumeEnabled: true, volumeProfile: 'round', 'glyphVolume.depth': 90, 'glyphVolume.wallShare': .34, 'glyphVolume.faceBias': .55, 'glyphVolume.interiorFill': .25, 'glyphVolume.surfaceThickness': 6,
    'glyphVolume.wallBand': 42, 'glyphVolume.outsideTaper': .6, 'glyphVolume.referenceFalloff': 1, 'glyphVolume.densityDepth': .35, 'glyphVolume.jitter': 2,
    depthPerspective: true, depthOcclusion: false, 'depth.fov': 38, 'depth.distance': 800, 'depth.sizeAttenuation': 1, 'depth.sizeAttenuationCurve': 1, 'depth.sizeDepthBias': 0,
    'depth.aerialFade': .55, 'depth.aerialRange': 2.2, 'depth.depthTintWeight': 0, vortex3d: 1, dispersion3d: 1,
  },
  fixtures: {
    'A round body in perspective': {},
    'A bevelled slab, orthographic': {volumeProfile: 'bevel', 'glyphVolume.depth': 240, 'glyphVolume.wallShare': .7, depthPerspective: false},
    'Flat cards': {volumeEnabled: false},
    'No readings': {volumeEnabled: undefined, volumeProfile: undefined, 'glyphVolume.depth': undefined, 'glyphVolume.wallShare': undefined, depthPerspective: undefined, 'depth.fov': undefined, reason: 'The field has not announced its body'},
  },

  folded: p => <Folded title="Depth" light={lightOf(p)} readings={[strOf(p.v, 'volumeProfile') ?? NONE, fin(p.v, R.depth) === undefined ? NONE : px(fin(p.v, R.depth)!)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Depth" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><Display w={140} h={146} label="Body" does={`${DISPLAY_DOES} Drag handle 1 for the body depth.`}><Both p={p} w={140} h={146} handles={1} /></Display></Section>
    <Section label="Macros" cols={2}>{dial(p, R.depth)}{dial(p, R.wall)}{dial(p, R.fade)}{dial(p, R.fov)}</Section>
  </Panel>,

  whole: p => { const w = wide(p) ? Math.round(clampTo(186, (p.room!.w - 560) / 2, 340)) : 186
    return <Panel title="Depth" view="whole" {...head(p)} pages={[{id: 'body', label: 'Body'}, {id: 'lens', label: 'Lens'}]} page={p.page} onPage={p.setPage}>
      {p.page !== 'lens' ? <>
        <Band>
          <Section width={w + 12}><Display w={w} h={146} label="Body" does={`${DISPLAY_DOES} Drag handle 1 for the depth and handle 2 for the flank share.`}><Section3d p={p} w={w} h={146} handles={2} /></Display></Section>
          <Section label="Profile" width={64}><Radio {...st(p, 'volumeProfile')} does="The cross-section of the body." value={strOf(p.v, 'volumeProfile') ?? ''} options={PROFILES} stack onChange={x => p.set('volumeProfile', x)} /></Section>
          <Section label="Body" cols={2} grow>{dial(p, R.depth)}{dial(p, R.wall)}{dial(p, R.face)}{dial(p, R.fill)}</Section>
        </Band>
        <Band>
          <Section label="Sheet and band" cols={2} width={124}>{box(p, R.sheet)}{box(p, R.band)}{box(p, R.taper)}{box(p, R.reach)}</Section>
          <Section label="Noise" width={68}>{box(p, R.dens)}{box(p, R.jitter)}</Section>
          <Section label="In the forces" grow>{box(p, R.swirl)}{box(p, R.bridge)}</Section>
        </Band>
      </> : <>
        <Band>
          <Section width={w + 12}><Display w={w} h={146} label="Lens" does="The lens: the cone of the field of view from the eye, distant marks smaller and dimmer. Drag handle 1 for the field of view."><Lens p={p} w={w} h={146} handles /></Display></Section>
          <Section label="Projection" width={84}>
            <Toggle {...st(p, 'depthPerspective')} label="Perspective" does="On: a lens with convergence. Off: parallel drawing." on={boolOf(p.v, 'depthPerspective') === true} unknown={boolOf(p.v, 'depthPerspective') === undefined} onChange={x => p.set('depthPerspective', x)} />
            <Toggle {...st(p, 'depthOcclusion')} label="Occlude" does="Near bodies hide far ones." on={boolOf(p.v, 'depthOcclusion') === true} unknown={boolOf(p.v, 'depthOcclusion') === undefined} onChange={x => p.set('depthOcclusion', x)} />
          </Section>
          <Section label="Lens" cols={2} grow>{dial(p, R.fov)}{dial(p, R.dist)}</Section>
        </Band>
        <Band>
          <Section label="Size with distance" cols={3} width={168}>{dial(p, R.att)}{dial(p, R.curve)}{dial(p, R.bias)}</Section>
          <Section label="Aerial depth" cols={3} grow>{dial(p, R.fade)}{dial(p, R.range)}{dial(p, R.tint)}</Section>
        </Band>
      </>}
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The body and the lens">
      <g className="dp-display" style={{background: 'none', border: 'none'}}><Both p={{...p, set: () => {}}} w={760} h={420} handles={0} /></g>
    </svg>
  </div>,

  widget: p => <Tile title="Depth" light={lightOf(p)} onLight={head(p).onLight} lightWhy={head(p).lightWhy} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="Body" does={DISPLAY_DOES}><Section3d p={p} w={112} h={104} handles={0} /></Display>
    <div className="ref-tile-grid ref-tile-grid--boxes">{box(p, R.depth)}{box(p, R.wall)}{box(p, R.fade)}{box(p, R.fov)}</div>
  </Tile>,
}
