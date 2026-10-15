// The Field (manual §20.1): Expressions' instrument — a plate that is tuned and sounds, particles that gather on the lines where
// it stands still, and symbols that hold a place and may have a voice. Live's nearest: Operator and Wavetable — a large display
// with handles, a global column of volume and time. The display draws the resonator's own law (cymaticResonator.ts: the mode
// lattice f0·(m²+n²) on the plate, f0·√(m²+n²+p²) in the chamber; phi_mn and phi_mnp as the nodal figure); its readings are the
// scene's. The controls are the front of five owners: object sound (entitySound.ts), the resonance medium, the field's time scale
// and the morph's dwell. Every parameter writes the owner's own address, so a value moved here moves in Resonance and Physics too.
import {useMemo, type CSSProperties} from 'react'
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
type SetFn = ViewProps['set']
const HZ = {min: 20, max: 4000, log: true}, LEVEL = {min: 0, max: 4}, TEMPO = {min: 0, max: 4}, HOLD = {min: 0, max: .9}
/** A voice's own gain unless the symbol sets one (DEFAULT_ENTITY_SOUND.gain, entitySound.ts:35). */
const VOICE_GAIN = .2

// ---------------------------------------------------------------- the symbols: the Seven centres scene (model.ts:172)

const SYMBOLS = [
  {name: 'Root', glyph: '△', tint: '#a94138'}, {name: 'Sacral', glyph: '◯', tint: '#c67c46'}, {name: 'Solar', glyph: '△', tint: '#c2a852'},
  {name: 'Heart', glyph: '✧', tint: '#638c69'}, {name: 'Throat', glyph: '◯', tint: '#5898a4'}, {name: 'Brow', glyph: '∞', tint: '#737599'},
  {name: 'Crown', glyph: '✧', tint: '#a590b0'},
].map((s, i) => ({...s, u: .18 / 2, v: (-.82 + i * .274) / 2}))

// ---------------------------------------------------------------- the resonator's law

interface Mode {readonly m: number; readonly n: number; readonly p?: number; readonly hz: number}
/** The mode lattice (cymaticResonator.ts:63-66): plate m, n in 1..8 with f0·(m²+n²); chamber m, n, p in 1..4 with f0·√(m²+n²+p²). */
function lattice(chamber: boolean, f0: number): Mode[] {
  const out: Mode[] = []
  if (chamber) { for (let m = 1; m <= 4; m++) for (let n = 1; n <= 4; n++) for (let p = 1; p <= 4; p++) out.push({m, n, p, hz: f0 * Math.sqrt(m * m + n * n + p * p)}) }
  else for (let m = 1; m <= 8; m++) for (let n = 1; n <= 8; n++) out.push({m, n, hz: f0 * (m * m + n * n)})
  return out
}
/** The mode nearest the drive on a log scale; the first wins a tie (nativeFieldFace.resonance.ts nearestMode). */
const nearest = (modes: readonly Mode[], hz: number) => modes.reduce((best, mode) => (Math.abs(Math.log(mode.hz / hz)) < Math.abs(Math.log(best.hz / hz)) ? mode : best), modes[0]!)
/** phi_mn on the free square plate (cymaticResonator.ts:152-157) and phi_mnp in the chamber (:161); u, v, w run over ±½. */
const plateShape = (m: number, n: number, u: number, v: number) => {
  const s = (m + n) % 2 === 0 ? 1 : -1
  return Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v) + s * Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v)
}
const cavityShape = (m: number, n: number, p: number, u: number, v: number, w: number) => Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v) * Math.cos(p * Math.PI * w)

const sq = (x: number) => x * x
const lcg = (seed: number) => { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296 }
interface Dot {readonly u: number; readonly v: number; readonly w: number; readonly gx: number; readonly gy: number; readonly gz: number}

/** Particles on the plate's still lines: the share the plate rules (dominance) goes where the figure is quiet, the rest stays on the symbols. */
function plateDots(m: number, n: number, dominance: number, count: number): Dot[] {
  const rnd = lcg(m * 97 + n * 31 + 7), out: Dot[] = [], springs = Math.round(count * (1 - dominance))
  for (let tries = 0; out.length < count - springs && tries < count * 70; tries++) {
    const u = rnd() - .5, v = rnd() - .5, f = plateShape(m, n, u, v)
    if (rnd() > Math.exp(-sq(Math.abs(f) / 2 / .06))) continue
    const e = .004, gx = plateShape(m, n, u + e, v) - plateShape(m, n, u - e, v), gy = plateShape(m, n, u, v + e) - plateShape(m, n, u, v - e), g = Math.hypot(gx, gy) || 1, sg = Math.sign(f) || 1
    out.push({u, v, w: 0, gx: sg * gx / g, gy: sg * gy / g, gz: 0})
  }
  for (let i = 0; i < springs; i++) {
    const s = SYMBOLS[Math.floor(rnd() * SYMBOLS.length)]!, r = Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * .03, t = rnd() * Math.PI * 2
    out.push({u: s.u + r * Math.cos(t), v: s.v + r * Math.sin(t), w: 0, gx: 0, gy: 0, gz: 0})
  }
  return out
}
function cavityDots(m: number, n: number, p: number, count: number): Dot[] {
  const rnd = lcg(m * 97 + n * 31 + p * 7 + 3), out: Dot[] = []
  for (let tries = 0; out.length < count && tries < count * 120; tries++) {
    const u = rnd() - .5, v = rnd() - .5, w = rnd() - .5, f = cavityShape(m, n, p, u, v, w)
    if (rnd() > Math.exp(-sq(Math.abs(f) / .12))) continue
    const e = .004, gx = cavityShape(m, n, p, u + e, v, w) - cavityShape(m, n, p, u - e, v, w), gy = cavityShape(m, n, p, u, v + e, w) - cavityShape(m, n, p, u, v - e, w),
      gz = cavityShape(m, n, p, u, v, w + e) - cavityShape(m, n, p, u, v, w - e), g = Math.hypot(gx, gy, gz) || 1, sg = Math.sign(f) || 1
    out.push({u, v, w, gx: sg * gx / g, gy: sg * gy / g, gz: sg * gz / g})
  }
  return out
}

// ---------------------------------------------------------------- readings

/** The share a morph cycle holds, as a whole ratio within half a percent, else in percent (transportReadings.ts holdRatio). */
const ratio = (share: number) => {
  if (!(share > 0)) return '0 : 1'
  for (let total = 2; total <= 16; total++) for (let hold = 1; hold < total; hold++) if (Math.abs(hold / total - share) < .005) return `${hold} : ${total - hold}`
  const percent = Math.round(share * 100)
  return `${percent} : ${100 - percent}`
}
const times = (x: number) => `${x.toFixed(2)}×`
const hertz = (x: number) => `${Math.round(x)} Hz`
const count = (n: number) => (n < 1000 ? `${n}` : n < 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(n / 1000)}k`)
const light = (v: V): LightState => (on(v, 'sound') ? 'lit' : 'dark')
const modeOf = (v: V) => nearest(lattice(str(v, 'medium') === 'chamber', num(v, 'baseFrequency')), num(v, 'resonance'))
const modeText = (mode: Mode) => (mode.p === undefined ? `${mode.m}·${mode.n}` : `${mode.m}·${mode.n}·${mode.p}`)
/** The meter: the voices' own gains summed, at the field's level; silent while sound is off. */
const meter = (v: V) => (on(v, 'sound') ? clampTo(0, 1, num(v, 'voices') * VOICE_GAIN * num(v, 'level')) : 0)

// ---------------------------------------------------------------- the stage: the plate or the chamber, its particles and its symbols

function Stage({v, ox, oy, s, dots}: {v: V; ox: number; oy: number; s: number; dots: number}) {
  const chamber = str(v, 'medium') === 'chamber', mode = modeOf(v), plate = on(v, 'plate')
  const k = s * .24, c = s - k, voices = num(v, 'voices'), sounding = on(v, 'sound')
  const pts = useMemo(() => (chamber ? cavityDots(mode.m, mode.n, mode.p ?? 1, dots) : plateDots(mode.m, mode.n, num(v, 'dominance'), dots)),
    [chamber, mode.m, mode.n, mode.p, num(v, 'dominance'), dots])
  const pos = (u: number, w: number, y: number) => (chamber ? [ox + (u + .5) * c + (w + .5) * k, oy + k + (.5 - y) * c - (w + .5) * k] as const : [ox + (u + .5) * s, oy + (.5 - y) * s] as const)
  // The trail of a particle lies behind its slide toward the still line, as long as the time scale: none at 0.
  const reach = num(v, 'tempo') * s / 120
  const paths = (keep: (d: Dot) => boolean) => pts.filter(keep).map(d => {
    const [x, y] = pos(d.u, d.w, d.v), tx = chamber ? (d.gx * c + d.gz * k) / c : d.gx, ty = chamber ? -(d.gy * c + d.gz * k) / c : -d.gy
    return `M${x.toFixed(1)} ${y.toFixed(1)}l${(tx * reach || .01).toFixed(1)} ${(ty * reach).toFixed(1)}`
  }).join('')
  const size = clampTo(6.5, 15, s * .085), ring = size * .85
  return <g opacity={plate ? 1 : .3}>
    {chamber ? <>
      <rect x={ox} y={oy + k} width={c} height={c} className="dp-faint" />
      <rect x={ox + k} y={oy} width={c} height={c} className="dp-faint" opacity={.5} />
      <path d={`M${ox} ${oy + k}L${ox + k} ${oy}M${ox + c} ${oy + k}L${ox + c + k} ${oy}M${ox} ${oy + k + c}L${ox + k} ${oy + c}M${ox + c} ${oy + k + c}L${ox + c + k} ${oy + c}`} className="dp-faint" opacity={.5} />
      <path d={paths(d => d.w >= 0)} className="dp-curve" opacity={.4} style={{strokeWidth: 1.2, strokeLinecap: 'round'}} />
      <path d={paths(d => d.w < 0)} className="dp-curve" opacity={.9} style={{strokeWidth: 1.2, strokeLinecap: 'round'}} />
    </> : <>
      <rect x={ox} y={oy} width={s} height={s} className="dp-faint" />
      <path d={paths(() => true)} className="dp-curve" opacity={.85} style={{strokeWidth: 1.2, strokeLinecap: 'round'}} />
    </>}
    {SYMBOLS.map((sym, i) => {
      const [x, y] = pos(sym.u, 0, sym.v), voiced = i < voices
      return <g key={sym.name}>
        {voiced && <circle cx={x} cy={y} r={ring} fill="none" stroke={sym.tint} strokeWidth={1.2} opacity={sounding ? .95 : .35} strokeDasharray={sounding ? undefined : '2 2'} />}
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={sym.tint} style={{fontSize: size}}>{sym.glyph}</text>
      </g>
    })}
    {!plate && s > 60 && <text x={ox + s / 2} y={oy + s + (chamber ? 0 : -6)} textAnchor="middle" className="dp-ink-dim">plate off</text>}
  </g>
}

/** The frequency strip: the mode lattice as ticks on a log axis, the nearest in amber, and the drive's handle. */
function Strip({v, set, x0, x1, y, labels}: {v: V; set?: SetFn; x0: number; x1: number; y: number; labels?: boolean}) {
  const hz = num(v, 'resonance'), mode = modeOf(v), modes = lattice(str(v, 'medium') === 'chamber', num(v, 'baseFrequency'))
  const fx = (f: number) => x0 + Math.log(f / HZ.min) / Math.log(HZ.max / HZ.min) * (x1 - x0)
  const ticks = [...new Set(modes.map(m => Math.round(m.hz)))].filter(f => f >= HZ.min && f <= HZ.max)
  return <g>
    <path d={`M${x0} ${y}H${x1}`} className="dp-faint" />
    {ticks.map(f => <path key={f} d={`M${fx(f)} ${y - 3}V${y + 3}`} className="dp-faint" opacity={.7} />)}
    <path d={`M${fx(mode.hz)} ${y - 5}V${y + 5}`} className="dp-curve-on" />
    {labels && <><text x={x0} y={y + 12} className="dp-axis">20 Hz</text><text x={x1} y={y + 12} className="dp-axis" textAnchor="end">4 kHz</text></>}
    <Handle n={1} x={fx(hz)} y={y} tone={str(v, 'driver') === 'focus' ? 'value' : 'accent'} label="Tone" does="Drag along the line: the tone the plate is tuned to. Ticks mark the plate's modes; the amber one is nearest."
      onDrag={set && (x => set('resonance', Math.round(HZ.min * Math.pow(HZ.max / HZ.min, clampTo(0, 1, (x - x0) / (x1 - x0))))))} onReset={set && (() => set('resonance', 396))} />
  </g>
}

/** One morph cycle as a bar: the share it holds on top, the share it changes below, and the boundary's handle. */
function CycleBar({v, set, x, top, bottom}: {v: V; set?: SetFn; x: number; top: number; bottom: number}) {
  const hold = num(v, 'hold'), yb = top + hold * (bottom - top)
  return <g>
    <text x={x + 6} y={top - 5} textAnchor="middle" className="dp-axis">hold</text>
    <rect x={x} y={top} width={12} height={Math.max(0, yb - top)} className="dp-fill-on" />
    <rect x={x} y={yb} width={12} height={bottom - yb} className="dp-fill" />
    <rect x={x} y={top} width={12} height={bottom - top} className="dp-faint" />
    <text x={x + 6} y={bottom + 11} textAnchor="middle" className="dp-axis">change</text>
    <Handle n={2} shape="square" x={x + 6} y={yb} label="Hold" does="Drag up or down: how long a scene holds a figure compared with how long it changes."
      onDrag={set && ((_, y) => set('hold', Math.round(clampTo(0, .9, (y - top) / (bottom - top)) * 100) / 100))} onReset={set && (() => set('hold', 0))} />
  </g>
}

function FieldDisplay({v, set, w, h, hold}: {v: V; set?: SetFn; w: number; h: number; hold?: boolean}) {
  const mode = modeOf(v)
  return <Display w={w} h={h} label="The field" does="The plate or chamber, the particles on its still lines and the symbols, drawn from the device's values. Drag the handles."
    corner={`${modeText(mode)} · ${hertz(mode.hz)}`}>
    {hold ? <>
      <Stage v={v} ox={8} oy={16} s={100} dots={340} />
      <CycleBar v={v} set={set} x={140} top={40} bottom={104} />
      <Strip v={v} set={set} x0={10} x1={176} y={128} labels />
    </> : <>
      <Stage v={v} ox={14} oy={14} s={112} dots={360} />
      <Strip v={v} set={set} x0={10} x1={130} y={138} />
    </>}
  </Display>
}

// ---------------------------------------------------------------- controls

const DIAL = (p: ViewProps, key: string, label: string, does: string, def: number, scale: {min: number; max: number; log?: boolean}, format: (x: number) => string) =>
  <Dial key={key} label={label} does={does} value={num(p.v, key)} def={def} scale={scale} format={format} onChange={x => p.set(key, x)} />

const level = (p: ViewProps) => DIAL(p, 'level', 'Level', 'Sets the loudness of the whole field.', 1, LEVEL, times)
const tempo = (p: ViewProps) => DIAL(p, 'tempo', 'Tempo', 'Sets the pace of the field. At 0 the field holds still.', 1, TEMPO, times)
const tone = (p: ViewProps) => DIAL(p, 'resonance', 'Tone', 'The frequency the plate is tuned to. The travelling focus sets it while Driver is Focus.', 396, HZ, hertz)
const holdDial = (p: ViewProps) => DIAL(p, 'hold', 'Hold', 'Sets how long a scene holds a figure compared with how long it changes, as hold to change.', 0, HOLD, ratio)

const MEDIUMS = [{value: 'plate', label: 'Plate', does: 'A flat plate.'}, {value: 'chamber', label: 'Chamber', does: 'A three-dimensional chamber.'}] as const
const DRIVERS = [
  {value: 'manual', label: 'Manual', does: 'The value of Tone sets the tone.'},
  {value: 'focus', label: 'Focus', does: 'The travelling focus sets the tone.'},
  {value: 'automation', label: 'Auto', does: 'The automation sets the tone. A sweep steps it through the plate\'s stations.'},
] as const

export const design: DesignedDevice = {
  id: 'expressions:field',
  title: 'Field',
  kind: 'instrument',
  // The owner's defaults: object sound sounding (entitySound.ts:77), the resonant medium on (model.ts DEFAULT_ENGINE_SETTINGS), the
  // plate at 396 Hz with f0 40 Hz and dominance 1 (fieldModel.ts DEFAULT_CYMATIC_MEDIUM), time scale 1, no hold (fieldDefaults.ts),
  // 200 000 particles (fieldDefaults.ts:102). The level is the object-sound bank's field-wide gain, 1 as the instrument's presentation level is.
  defaults: {
    sound: true, level: 1, plate: true, medium: 'plate', driver: 'manual', resonance: 396, tempo: 1, hold: 0,
    voices: 0, particles: 200000, dominance: 1, baseFrequency: 40,
  },
  fixtures: {
    'Seven centres': {voices: 3, particles: 42000},
    'Springs and plate': {voices: 3, particles: 42000, dominance: .5, hold: .625},
    'Chamber': {voices: 3, particles: 42000, medium: 'chamber'},
    'Plate off': {voices: 0, particles: 42000, plate: false, sound: false},
  },

  folded: p => <Folded title="Field" light={light(p.v)} readings={[hertz(num(p.v, 'resonance')), times(num(p.v, 'tempo'))]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Field" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><FieldDisplay v={p.v} set={p.set} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>{level(p)}{tempo(p)}{tone(p)}{holdDial(p)}</Section>
  </Panel>,

  whole: p => <Panel title="Field" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={198}><FieldDisplay v={p.v} set={p.set} w={186} h={146} hold /></Section>
      <Section label="Sound" cols={1}>
        <Toggle label="Sound" does="Lets the object voices sound. The picture stays when sound is off." on={on(p.v, 'sound')} onChange={x => p.set('sound', x)} />
        {level(p)}
      </Section>
      <Section label="Time" cols={1}>
        {tempo(p)}
        {holdDial(p)}
      </Section>
      <Section label="Tuning" grow>
        {tone(p)}
        <Radio label="Driver" does="Chooses what sets the tone: Tone, the travelling focus or the automation." value={str(p.v, 'driver')} options={DRIVERS} stack onChange={x => p.set('driver', x)} />
      </Section>
    </Band>
    <Band>
      <Section label="Plate" width={96}>
        <Toggle label="Plate on" does="Turns the resonant plate on. Tone, Medium and Driver act only while it is on." on={on(p.v, 'plate')} onChange={x => p.set('plate', x)} />
        <Radio label="Medium" does="Chooses a flat plate or a three-dimensional chamber." value={str(p.v, 'medium')} options={MEDIUMS} stack onChange={x => p.set('medium', x)} />
      </Section>
      <Section label="Nearest mode" cols={2}>
        <Readout big label="mode" does="The plate mode nearest the tone." value={modeText(modeOf(p.v))} tone="value" />
        <Readout label="mode Hz" does="The frequency of that mode." value={Math.round(modeOf(p.v).hz)} />
        <Readout label="detune" does="How far the tone sits from that mode, in cents." value={`${Math.round(1200 * Math.log2(num(p.v, 'resonance') / modeOf(p.v).hz))} ¢`} />
      </Section>
      <Section label="Counts" grow>
        <Readout big label="voices" does="Symbols that have a voice. Give a symbol its voice in the Sound device." value={num(p.v, 'voices')} tone="accent" />
        <Readout label="particles" does="Particles in the field. Set the count in Ink." value={count(num(p.v, 'particles'))} />
      </Section>
    </Band>
  </Panel>,

  full: p => {
    const w = 760, h = 420, mode = modeOf(p.v), chamber = str(p.v, 'medium') === 'chamber', voices = num(p.v, 'voices')
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The field">
        <g className="dp-display" style={{background: 'none'}}>
          <Stage v={p.v} ox={60} oy={26} s={368} dots={2600} />
          <text x={480} y={52} className="dp-ink" style={{fontSize: 14}}>{chamber ? 'Chamber' : 'Plate'} · mode {modeText(mode)}</text>
          <text x={480} y={72} className="dp-ink-dim" style={{fontSize: 12}}>{hertz(mode.hz)} · tuned to {hertz(num(p.v, 'resonance'))}</text>
          <text x={480} y={90} className="dp-ink-dim" style={{fontSize: 12}}>{count(num(p.v, 'particles'))} particles · pace {times(num(p.v, 'tempo'))} · holds {ratio(num(p.v, 'hold'))}</text>
          {SYMBOLS.slice().reverse().map((sym, i) => {
            const at = SYMBOLS.length - 1 - i, y = 134 + i * 34, voiced = at < voices
            return <g key={sym.name} opacity={voiced ? 1 : .6}>
              {voiced && <circle cx={492} cy={y} r={11} fill="none" stroke={sym.tint} strokeWidth={1.4} />}
              <text x={492} y={y} textAnchor="middle" dominantBaseline="central" fill={sym.tint} style={{fontSize: 15}}>{sym.glyph}</text>
              <text x={516} y={y} dominantBaseline="central" className="dp-ink" style={{fontSize: 13}}>{sym.name}</text>
              <text x={600} y={y} dominantBaseline="central" className="dp-ink-dim" style={{fontSize: 12}}>{voiced ? 'voice' : 'no voice'}</text>
            </g>
          })}
        </g>
      </svg>
    </div>
  },

  widget: p => <Tile title="Field" light={light(p.v)} onFull={p.nav.full}>
    <Display w={98} h={100} label="The field" does="Click ⤢ to open it full in the pane that has focus." corner={hertz(num(p.v, 'resonance'))}>
      <Stage v={p.v} ox={7} oy={14} s={84} dots={160} />
    </Display>
    <div className="ref-meter" data-i={`Level|${on(p.v, 'sound') ? 'The voices, summed, at the field\'s level.' : 'Sound is off.'}`}
      style={{'--level': meter(p.v)} as CSSProperties}><span /></div>
  </Tile>,
}
