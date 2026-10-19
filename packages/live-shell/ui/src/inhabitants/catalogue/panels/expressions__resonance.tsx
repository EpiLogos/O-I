// Resonance (manual §20.14, expressions:resonance): the plate the field rests on, driven at a tone, so the particles gather where it stands
// still. Live's nearest: Corpus and Collision's resonators — a body tuned by frequency and decay, with its tuning band under it. The display is
// the plate by the engine's own law (desktop/cradle/expressions-app/src/engine/cymaticResonator.ts): the free square plate's modes
// φ_mn(u, v) = cos(mπu)·cos(nπv) ± cos(nπu)·cos(mπv) for m, n in 1..8, each at f_mn = f0·(m² + n²), coupled to the drive point (0.11, 0.07) and
// ranked by that coupling, the first Mode count of them taking part; each answers the drive at the frequency as a damped resonator of
// quality Q, 1 / √((1 − r²)² + (r/Q)²) with r = f / f_mn. Where their sum stands still — the nodal lines — the marks settle: that is the
// pattern drawn. Under the plate runs the tuning band, 20 Hz to 4 kHz, the seven stations the owner picks as ticks, handle 1 on the drive
// frequency; at a station the plate shows that station's pattern. In 3D the medium is a box cavity; the plate shows its middle slice.
//
// Everything is keyed on the engine's paths: the registry's (nativeParameters.ts over paramRegistry.ts, group Cymatics) and the panel settings
// (parameterAddress.ts FIELD_SETTINGS and PANEL_FAMILY: resonanceEnabled, frequencyDriver, autoSweep, sweepDirection, templateDimension,
// resonatorMode). The owner reports (defaults: fieldModel.ts DEFAULT_CYMATIC_MEDIUM):
//   resonanceEnabled  the light      cymatics.frequencyHz 20..4000 Hz log (396)    frequencyDriver  manual | focus | automation
//   cymatics.dominance 0..1 (1)   .dampingQFactor 0.1..40 log (4.5)   .driveStrength 0..6 (1)   .driveScale 0..4 (1)   .transportGain 0..10 (1)
//   .agitation 0..5 (0.3)   .plateSize 100..2000 px log (700)   .boundaryStrength 0..30 (6)   .baseFrequency 5..200 Hz log (40)   .modeCount 1..64 (64)
//   templateDimension 2D | 3D   autoSweep   sweepDirection ascent | descent | pingpong   cymatics.sweep.glideS 0.1..30 s   .sweep.dwellS 0..30 s
//   resonatorMode  resonator | template (legacy: no live medium)
//   stations   the plate's seven anchors (the Studio's station ticks, inspector.ts): [{index, name, frequencyHz, m, n, color}]
//   resonance.live  the frequency the medium sounds now (the Studio's live readout)
//   body.source  'declared' | 'tattva' (manual §20.14, as on the Torus): under Tattva the tattva of the M2 condition sets the
//   plate's Q, Agitation and Edge through its element fibre, by M2's proposed table of body constants; the owner reports
//   tattva.name, tattva.fibre (absent where the map gives none) and tattva.standing, and those three controls are held.
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState, type Scale} from '../../sdk/panel'
import {NONE, boolOf, clampTo, fixed, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {tattvaDoes, tattvaHold, tattvaLabel} from './torus'

type V = ViewProps['v']
const d2 = fixed(2), hz = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(2)} kHz` : `${Math.round(x)} Hz`), secs = (x: number) => `${x.toFixed(1)} s`
interface Rule {readonly key: string; readonly label: string; readonly scale: Scale; readonly def: number; readonly format: (x: number) => string; readonly does: string}
const R = {
  freq: {key: 'cymatics.frequencyHz', label: 'Freq', scale: {min: 20, max: 4000, log: true}, def: 396, format: hz, does: 'The tone that drives the plate.'},
  dom: {key: 'cymatics.dominance', label: 'Plate', scale: {min: 0, max: 1}, def: 1, format: d2, does: 'How far the plate takes over from the formation springs: 0 springs only, 1 plate only.'},
  q: {key: 'cymatics.dampingQFactor', label: 'Q', scale: {min: .1, max: 40, log: true}, def: 4.5, format: fixed(1), does: 'How sharply the plate rings: high rings longer and narrower.'},
  drive: {key: 'cymatics.driveStrength', label: 'Drive', scale: {min: 0, max: 6}, def: 1, format: d2, does: 'How hard the drive shakes the plate.'},
  scale: {key: 'cymatics.driveScale', label: 'Scale', scale: {min: 0, max: 4}, def: 1, format: d2, does: 'The scale of the drive\'s intensity.'},
  transport: {key: 'cymatics.transportGain', label: 'Transport', scale: {min: 0, max: 10}, def: 1, format: d2, does: 'How firmly particles slide into the still regions.'},
  agitation: {key: 'cymatics.agitation', label: 'Agitation', scale: {min: 0, max: 5}, def: .3, format: d2, does: 'How much the particles are kicked about.'},
  plate: {key: 'cymatics.plateSize', label: 'Size', scale: {min: 100, max: 2000, log: true}, def: 700, format: x => `${Math.round(x)} px`, does: 'The size of the plate.'},
  edge: {key: 'cymatics.boundaryStrength', label: 'Edge', scale: {min: 0, max: 30}, def: 6, format: fixed(1), does: 'How firm the plate\'s edge is.'},
  f0: {key: 'cymatics.baseFrequency', label: 'f0', scale: {min: 5, max: 200, log: true}, def: 40, format: hz, does: 'The base tone of the plate\'s modes: f = f0 · (m² + n²).'},
  modes: {key: 'cymatics.modeCount', label: 'Modes', scale: {min: 1, max: 64, step: 1}, def: 64, format: x => String(Math.round(x)), does: 'How many modes take part, the most strongly driven first.'},
  glide: {key: 'cymatics.sweep.glideS', label: 'Glide', scale: {min: .1, max: 30}, def: 8, format: secs, does: 'How long the sweep travels between stations.'},
  dwell: {key: 'cymatics.sweep.dwellS', label: 'Dwell', scale: {min: 0, max: 30}, def: 2, format: secs, does: 'How long the sweep rests at each station.'},
} satisfies Record<string, Rule>
const fin = (v: V, r: Rule) => { const x = numOf(v, r.key); return x !== undefined && Number.isFinite(x) ? x : undefined }
/** The plate's body constants that a tattva with a fibre sets under Tattva. */
const TATTVA_KEYS: readonly string[] = [R.q.key, R.agitation.key, R.edge.key]
const held = (p: ViewProps, r: Rule) => st(p, r.key).disabled ?? (TATTVA_KEYS.includes(r.key) ? tattvaHold(p.v) : undefined)
const BODY_SOURCES = [{value: 'declared', label: 'Declared', does: 'The plate keeps its own constants.'},
  {value: 'tattva', label: 'Tattva', does: 'The tattva of the M2 condition sets Q, Agitation and Edge through its element fibre.'}] as const
const dial = (p: ViewProps, r: Rule) => <Dial key={r.key} {...st(p, r.key)} disabled={held(p, r)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} onChange={x => p.set(r.key, Math.round(x * 100) / 100)} />
const box = (p: ViewProps, r: Rule) => <ValueBox key={r.key} {...st(p, r.key)} disabled={held(p, r)} label={r.label} does={r.does} value={fin(p.v, r) ?? NaN} def={r.def} scale={r.scale} format={r.format} onChange={x => p.set(r.key, Math.round(x * 100) / 100)} />
const DRIVERS = [{value: 'manual', label: 'Manual', does: 'The drive frequency sets the tone.'}, {value: 'focus', label: 'Focus', does: 'The Focus device sets the tone.'}, {value: 'automation', label: 'Automation', does: 'A lane or the sweep sets the tone.'}] as const
const DIMS = [{value: '2D', label: '2D', does: 'A flat plate.'}, {value: '3D', label: '3D', does: 'A volumetric chamber.'}] as const
const SWEEPS = [{value: 'ascent', label: 'Up', does: 'The sweep climbs the stations.'}, {value: 'descent', label: 'Down', does: 'The sweep descends the stations.'}, {value: 'pingpong', label: 'Both', does: 'There and back.'}] as const
const MODES_IMPL = [{value: 'resonator', label: 'Continuous'}, {value: 'template', label: 'Legacy templates'}] as const

// ---------------------------------------------------------------- the engine's law

const DRIVE = {x: .11, y: .07}
const shape = (m: number, n: number, u: number, v: number) => { const s = (m + n) % 2 === 0 ? 1 : -1; return Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v) + s * Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v) }
/** The active modes and their answer to the drive: f_mn = f0 (m² + n²), ranked by coupling at the drive point, the first `count` taking part. */
function modesOf(f: number, f0: number, q: number, count: number) {
  const all: {m: number; n: number; a: number}[] = []
  for (let m = 1; m <= 8; m++) for (let n = 1; n <= 8; n++) { const c = shape(m, n, DRIVE.x, DRIVE.y), fm = f0 * (m * m + n * n), r = f / fm; all.push({m, n, a: c / Math.sqrt((1 - r * r) ** 2 + (r / q) ** 2)}) }
  return all.map((x, i) => ({...x, i, c: Math.abs(shape(x.m, x.n, DRIVE.x, DRIVE.y))})).sort((a, b) => b.c - a.c).slice(0, Math.max(1, Math.round(count)))
}
interface Station {readonly index: number; readonly name: string; readonly frequencyHz: number; readonly m: number; readonly n: number}
const stationsOf = (v: V): Station[] => json<unknown[]>(v, 'stations', []).flatMap((e): Station[] => { const s = e as Station; return typeof s?.frequencyHz === 'number' ? [{index: s.index, name: String(s.name ?? ''), frequencyHz: s.frequencyHz, m: s.m, n: s.n}] : [] })
const f1 = (x: number) => x.toFixed(1)

/** The plate and its tuning band. Handle 1 is the drive frequency on the band. */
function Plate({p, w, h, handles, grid = 46}: {p: ViewProps; w: number; h: number; handles: boolean; grid?: number}) {
  const v = p.v, f = fin(v, R.freq), f0 = fin(v, R.f0), q = fin(v, R.q), count = fin(v, R.modes), on = boolOf(v, 'resonanceEnabled'), legacy = strOf(v, 'resonatorMode') === 'template'
  const bandH = 24, side = Math.min(w - 8, h - bandH - 6), px0 = (w - side) / 2, py0 = 4, stations = stationsOf(v), fs = st(p, R.freq.key)
  const bx0 = 8, bx1 = w - 8, by = h - 12, BX = (hzv: number) => bx0 + Math.log(clampTo(20, 4000, hzv) / 20) / Math.log(200) * (bx1 - bx0)
  if (f === undefined || f0 === undefined || q === undefined || count === undefined) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{strOf(v, 'reason') ?? 'No reading of the plate'}</text>
  const modes = modesOf(f, f0, q, count), cell = side / grid, vals: number[] = []
  let peak = 1e-9
  for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) { const u = (i + .5) / grid - .5, vv = (j + .5) / grid - .5; let s = 0; for (const m of modes) s += m.a * shape(m.m, m.n, u, vv); vals.push(s); peak = Math.max(peak, Math.abs(s)) }
  const dots = vals.flatMap((s, k) => (Math.abs(s) / peak < .08 ? [k] : []))
  return <g>
    <rect x={px0} y={py0} width={side} height={side} fill="none" className="dp-faint" />
    <g opacity={on === false || legacy ? .3 : 1}>{dots.map(k => <rect key={k} x={px0 + (k % grid) * cell} y={py0 + Math.floor(k / grid) * cell} width={Math.max(1, cell * .8)} height={Math.max(1, cell * .8)} fill="var(--text, #d4d7da)" />)}</g>
    {(on === false || legacy) && <text x={w / 2} y={py0 + side / 2} textAnchor="middle" className="dp-ink">{legacy ? 'legacy templates' : 'off'}</text>}
    <path d={`M${bx0} ${by}H${bx1}`} className="dp-faint" />
    {[100, 1000].map(t => <text key={t} x={BX(t)} y={h - 2} textAnchor="middle" className="dp-axis">{t >= 1000 ? '1k' : t}</text>)}
    {stations.map(s => <g key={s.index}><path d={`M${f1(BX(s.frequencyHz))} ${by - 5}V${by + 3}`} stroke="var(--dp-value)" strokeWidth={1.4} /><text x={BX(s.frequencyHz)} y={by - 7} textAnchor="middle" className="dp-axis" style={{fontSize: 7}}>{s.index + 1}</text></g>)}
    {handles ? <Handle n={1} x={BX(f)} y={by} label="Drive frequency" does={`Drag along the band: the tone that drives the plate. The ticks are the plate's stations.${fs.disabled ? ` ${fs.disabled}` : ''}`}
      onDrag={fs.disabled ? undefined : x => p.set(R.freq.key, Math.round(20 * Math.pow(200, clampTo(0, 1, (x - bx0) / (bx1 - bx0)))))} onReset={fs.disabled ? undefined : () => p.set(R.freq.key, 396)} />
      : <circle cx={BX(f)} cy={by} r={3} fill="var(--dp-on)" />}
  </g>
}

const lightOf = (p: ViewProps): LightState => { const on = boolOf(p.owner ?? p.v, 'resonanceEnabled'); return on === undefined ? 'unknown' : on ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'resonanceEnabled').disabled, onFold: p.nav.fold, onFull: p.nav.full, onLight: () => p.set('resonanceEnabled', !(boolOf(p.v, 'resonanceEnabled') === true))})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const stationAt = (v: V) => { const f = fin(v, R.freq); return f === undefined ? undefined : stationsOf(v).find(s => Math.abs(Math.log(s.frequencyHz / f)) < .03) }
const DISPLAY_DOES = 'The plate at the drive frequency, by the engine\'s modal law: the marks settle where it stands still. Under it, the tuning band and the plate\'s seven stations.'

export const design: DesignedDevice = {
  id: 'expressions:resonance',
  title: 'Resonance',
  kind: 'effect',
  firstPage: 'tuning',
  defaults: {
    resonanceEnabled: true, 'cymatics.frequencyHz': 396, frequencyDriver: 'manual', 'cymatics.dominance': 1, 'cymatics.dampingQFactor': 4.5, 'cymatics.driveStrength': 1, 'cymatics.driveScale': 1,
    'cymatics.transportGain': 1, 'cymatics.agitation': .3, 'cymatics.plateSize': 700, 'cymatics.boundaryStrength': 6, 'cymatics.baseFrequency': 40, 'cymatics.modeCount': 64,
    templateDimension: '2D', autoSweep: false, sweepDirection: 'ascent', 'cymatics.sweep.glideS': 8, 'cymatics.sweep.dwellS': 2, resonatorMode: 'resonator', 'resonance.live': 396,
    'body.source': 'declared', 'tattva.name': 'Prithvi', 'tattva.fibre': 'earth', 'tattva.standing': 'proposed',
    // Seven anchors of the default plate: distinct (m, n) across the band, ascending, f = f0 (m² + n²) at f0 = 40 Hz.
    stations: JSON.stringify([{index: 0, name: 'Station 1', frequencyHz: 200, m: 1, n: 2}, {index: 1, name: 'Station 2', frequencyHz: 400, m: 1, n: 3}, {index: 2, name: 'Station 3', frequencyHz: 520, m: 2, n: 3},
      {index: 3, name: 'Station 4', frequencyHz: 680, m: 1, n: 4}, {index: 4, name: 'Station 5', frequencyHz: 800, m: 2, n: 4}, {index: 5, name: 'Station 6', frequencyHz: 1000, m: 3, n: 4}, {index: 6, name: 'Station 7', frequencyHz: 1040, m: 1, n: 5}]),
  },
  fixtures: {
    'Tuned at 396 Hz': {},
    'At station 3, ringing': {'cymatics.frequencyHz': 520, 'cymatics.dampingQFactor': 24, 'resonance.live': 520},
    'Sweeping': {frequencyDriver: 'automation', autoSweep: true, sweepDirection: 'pingpong'},
    // M2's proposed body constants for the earth fibre: Q 12, Agitation 0.1, Edge 20.
    'Tattva: Prithvi, earth': {'body.source': 'tattva', 'cymatics.dampingQFactor': 12, 'cymatics.agitation': .1, 'cymatics.boundaryStrength': 20},
    'No readings': {resonanceEnabled: undefined, 'cymatics.frequencyHz': undefined, 'cymatics.dampingQFactor': undefined, stations: undefined, 'resonance.live': undefined, reason: 'The field has not announced its plate'},
  },

  folded: p => <Folded title="Resonance" light={lightOf(p)} readings={[fin(p.v, R.freq) === undefined ? NONE : hz(fin(p.v, R.freq)!), stationAt(p.v) ? `st. ${stationAt(p.v)!.index + 1}` : `Q ${fin(p.v, R.q) ?? NONE}`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Resonance" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><Display w={140} h={146} label="Plate" does={`${DISPLAY_DOES} Drag handle 1 along the band.`} corner={stationAt(p.v) ? `st. ${stationAt(p.v)!.index + 1}` : undefined}><Plate p={p} w={140} h={146} handles /></Display></Section>
    <Section label="Macros" cols={2}>{dial(p, R.freq)}{dial(p, R.q)}{dial(p, R.drive)}{dial(p, R.dom)}</Section>
  </Panel>,

  whole: p => { const w = wide(p) ? Math.round(clampTo(186, (p.room!.w - 560) / 2, 320)) : 186, st3 = stationAt(p.v)
    return <Panel title="Resonance" view="whole" {...head(p)} pages={[{id: 'tuning', label: 'Tuning'}, {id: 'body', label: 'Resonator'}]} page={p.page} onPage={p.setPage}>
      {p.page !== 'body' ? <>
        <Band>
          <Section width={w + 12}><Display w={w} h={146} label="Plate" does={`${DISPLAY_DOES} Drag handle 1 along the band.`} corner={st3 ? `${st3.name} · (${st3.m}, ${st3.n})` : undefined}><Plate p={p} w={w} h={146} handles /></Display></Section>
          <Section label="Tuning" cols={2} grow>{dial(p, R.freq)}{dial(p, R.q)}{dial(p, R.dom)}
            <Readout label="live" does="The frequency the medium sounds now." value={numOf(p.v, 'resonance.live') === undefined ? undefined : hz(numOf(p.v, 'resonance.live')!)} tone="value" />
          </Section>
        </Band>
        <Band>
          <Section label="Driven by" width={84}><Radio {...st(p, 'frequencyDriver')} does="What sets the shared frequency." value={strOf(p.v, 'frequencyDriver') ?? ''} options={DRIVERS} stack onChange={x => p.set('frequencyDriver', x)} /></Section>
          <Section label="Sweep" width={84}>
            <Toggle {...st(p, 'autoSweep')} label="Sweep" does="Step the drive through the seven stations. It runs only while Automation drives the frequency." on={boolOf(p.v, 'autoSweep') === true} onChange={x => p.set('autoSweep', x)}
              disabled={st(p, 'autoSweep').disabled ?? (strOf(p.v, 'frequencyDriver') === 'automation' ? undefined : 'The sweep runs only while Automation drives the frequency.')} />
            <Radio {...st(p, 'sweepDirection')} does="The sweep's direction." value={strOf(p.v, 'sweepDirection') ?? ''} options={SWEEPS} stack onChange={x => p.set('sweepDirection', x)} />
          </Section>
          <Section label="Sweep time" grow>{box(p, R.glide)}{box(p, R.dwell)}</Section>
        </Band>
      </> : <>
        <Band>
          <Section label="Drive" cols={2} width={124}>{dial(p, R.drive)}{dial(p, R.scale)}{dial(p, R.transport)}{dial(p, R.agitation)}</Section>
          <Section label="Plate" cols={2} grow>{dial(p, R.plate)}{dial(p, R.edge)}{dial(p, R.f0)}{dial(p, R.modes)}</Section>
        </Band>
        <Band>
          <Section label="Dimension" width={84}><Radio {...st(p, 'templateDimension')} does="A flat plate or a volumetric chamber." value={strOf(p.v, 'templateDimension') ?? ''} options={DIMS} onChange={x => p.set('templateDimension', x)} /></Section>
          <Section label="Body source" width={112}>
            <Radio {...st(p, 'body.source')} does="Where the plate's constants come from: its own, or the tattva of the M2 condition." value={strOf(p.v, 'body.source') ?? ''} options={BODY_SOURCES} stack onChange={x => p.set('body.source', x)} />
            <Readout label={tattvaLabel(p.v)} does={tattvaDoes(p.v)} value={strOf(p.v, 'tattva.name')} tone={tattvaHold(p.v) ? 'accent' : undefined} />
          </Section>
          <Section label="Compatibility" grow><Chooser {...st(p, 'resonatorMode')} wide does="The medium's implementation. Legacy templates have no live medium." value={strOf(p.v, 'resonatorMode') ?? ''} options={MODES_IMPL} onChange={x => p.set('resonatorMode', x)} /></Section>
        </Band>
      </>}
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The plate">
      <g className="dp-display" style={{background: 'none', border: 'none'}}><Plate p={p} w={760} h={420} handles grid={110} /></g>
    </svg>
  </div>,

  widget: p => <Tile title="Resonance" light={lightOf(p)} onLight={head(p).onLight} lightWhy={head(p).lightWhy} span={2} onFull={p.nav.full}>
    <Display w={112} h={104} label="Plate" does={DISPLAY_DOES}><Plate p={p} w={112} h={104} handles={false} grid={36} /></Display>
    <div className="ref-tile-grid ref-tile-grid--boxes">{box(p, R.freq)}{box(p, R.q)}{box(p, R.drive)}{box(p, R.dom)}</div>
  </Tile>,
}
