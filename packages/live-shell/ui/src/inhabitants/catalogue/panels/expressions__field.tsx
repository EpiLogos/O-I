// The Field (manual §20.2): Expressions' instrument — a plate that is tuned and sounds, particles that gather on the lines where
// it stands still, and symbols that hold a place and may have a voice. Live's nearest: Operator and Wavetable — a large display
// with handles, a global column of volume and time. The display draws the resonator's own law (cymaticResonator.ts: the mode
// lattice f0·(m²+n²) on the plate, f0·√(m²+n²+p²) in the chamber; phi_mn and phi_mnp as the nodal figure); its readings are the
// scene's. The controls are the front of five owners: object sound (entitySound.ts), the resonance medium, the field's time scale
// and the morph's dwell. Every parameter writes the owner's own address, so a value moved here moves in Resonance and Physics too.
// Every control spreads its key's standing (design.ts `st`), so a control its owner does not take draws the owner's reason; a key the
// owner has not reported draws unread (the dial's ring alone, the meter empty and marked unread), never NaN (manual §16.11).
import {useMemo, type CSSProperties} from 'react'
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, num, numOf, on, st, str, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
type SetFn = ViewProps['set']
// The Level in dB, over the manual's range (§20.2 "Level | −60 to 0 dB | −12 dB"; O-I #747 round 886).
const HZ = {min: 20, max: 4000, log: true}, LEVEL = {min: -60, max: 0}, TEMPO = {min: 0, max: 4}, HOLD = {min: 0, max: .9}
/** A voice's own gain unless the symbol sets one (DEFAULT_ENTITY_SOUND.gain, native-field/entitySound.ts). */
const VOICE_GAIN = .2

// ---------------------------------------------------------------- the symbols: the scene's own, from `symbols`

/** One symbol of the scene as the device reads it (`symbols`, a JSON list): its name, glyph and tint, where it stands in stage units
 * (x, y over ±1) and whether it has a voice. */
interface SymbolIn {readonly name?: unknown; readonly glyph?: unknown; readonly tint?: unknown; readonly x?: unknown; readonly y?: unknown; readonly voiced?: unknown}
interface FieldSymbol {readonly name: string; readonly glyph: string; readonly tint: string; readonly u: number; readonly v: number; readonly voiced: boolean}
/** The scene's symbols, placed on the plate's ±½ square; none while the device has not read them. */
const symbolsOf = (v: V): FieldSymbol[] => json<SymbolIn[]>(v, 'symbols', []).filter(s => s && typeof s.name === 'string').map(s => ({
  name: s.name as string, glyph: typeof s.glyph === 'string' && s.glyph ? s.glyph : (s.name as string).slice(0, 1), tint: typeof s.tint === 'string' ? s.tint : 'currentColor',
  u: clampTo(-.5, .5, (typeof s.x === 'number' ? s.x : 0) / 2), v: clampTo(-.5, .5, (typeof s.y === 'number' ? s.y : 0) / 2), voiced: s.voiced === true,
}))
/** The Seven centres scene's symbols (model.ts chakraEntities), the design's own fixture: three voiced where `voiced` says so. */
const SEVEN = (voiced: number) => JSON.stringify(['Root', 'Sacral', 'Solar', 'Heart', 'Throat', 'Brow', 'Crown'].map((name, i) => ({
  name, glyph: ['△', '◯', '△', '✧', '◯', '∞', '✧'][i], tint: ['#a94138', '#c67c46', '#c2a852', '#638c69', '#5898a4', '#737599', '#a590b0'][i], x: .18, y: -.82 + i * .274, voiced: i < voiced,
})))

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
function plateDots(m: number, n: number, dominance: number, count: number, symbols: readonly FieldSymbol[]): Dot[] {
  const rnd = lcg(m * 97 + n * 31 + 7), out: Dot[] = [], springs = symbols.length ? Math.round(count * (1 - dominance)) : 0
  for (let tries = 0; out.length < count - springs && tries < count * 70; tries++) {
    const u = rnd() - .5, v = rnd() - .5, f = plateShape(m, n, u, v)
    if (rnd() > Math.exp(-sq(Math.abs(f) / 2 / .06))) continue
    const e = .004, gx = plateShape(m, n, u + e, v) - plateShape(m, n, u - e, v), gy = plateShape(m, n, u, v + e) - plateShape(m, n, u, v - e), g = Math.hypot(gx, gy) || 1, sg = Math.sign(f) || 1
    out.push({u, v, w: 0, gx: sg * gx / g, gy: sg * gy / g, gz: 0})
  }
  for (let i = 0; i < springs; i++) {
    const s = symbols[Math.floor(rnd() * symbols.length)]!, r = Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * .03, t = rnd() * Math.PI * 2
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
const decibels = (db: number) => `${db <= -60 ? '−∞' : db.toFixed(1).replace('-', '−')} dB`
const hertz = (x: number) => `${Math.round(x)} Hz`
const count = (n: number) => (n < 1000 ? `${n}` : n < 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(n / 1000)}k`)
/** The Sound's own words (manual §20.2). */
const SOUND_DOES = 'Lets the field sound. The picture stays when sound is off.'
const light = (v: V): LightState => (on(v, 'sound') ? 'lit' : 'dark')
const modeOf = (v: V) => nearest(lattice(str(v, 'medium') === 'chamber', num(v, 'baseFrequency')), num(v, 'resonance'))
const modeText = (mode: Mode) => (mode.p === undefined ? `${mode.m}·${mode.n}` : `${mode.m}·${mode.n}·${mode.p}`)
/** The meter: the voices' own gains summed, at the field's level; silent while sound is off; undefined (unread) while the voices, the level
 * or the sound has no reading. */
const meter = (v: V): number | undefined => { const voices = numOf(v, 'voices'), lvl = numOf(v, 'level'), sound = boolOf(v, 'sound')
  return sound === false ? 0 : sound === undefined || voices === undefined || lvl === undefined ? undefined : clampTo(0, 1, voices * VOICE_GAIN * 10 ** (lvl / 20)) }

// ---------------------------------------------------------------- the stage: the plate or the chamber, its particles and its symbols

function Stage({v, ox, oy, s, dots}: {v: V; ox: number; oy: number; s: number; dots: number}) {
  const chamber = str(v, 'medium') === 'chamber', mode = modeOf(v), plate = on(v, 'plate')
  const k = s * .24, c = s - k, sounding = on(v, 'sound'), said = strOf(v, 'symbols') ?? ''
  const symbols = useMemo(() => symbolsOf(v), [said])
  const pts = useMemo(() => (chamber ? cavityDots(mode.m, mode.n, mode.p ?? 1, dots) : plateDots(mode.m, mode.n, num(v, 'dominance'), dots, symbols)),
    [chamber, mode.m, mode.n, mode.p, num(v, 'dominance'), dots, symbols])
  const pos = (u: number, w: number, y: number) => (chamber ? [ox + (u + .5) * c + (w + .5) * k, oy + k + (.5 - y) * c - (w + .5) * k] as const : [ox + (u + .5) * s, oy + (.5 - y) * s] as const)
  // The trail of a particle lies behind its slide toward the still line, as long as the time scale: none at 0.
  const reach = (numOf(v, 'tempo') ?? 0) * s / 120
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
    {symbols.map((sym, i) => {
      const [x, y] = pos(sym.u, 0, sym.v), voiced = sym.voiced
      return <g key={`${i}:${sym.name}`}>
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
    <Handle n={1} x={fx(hz)} y={y} tone={str(v, 'keySource') === 'manual' ? 'accent' : 'value'} label="Tone" does="Drag along the line: the tone the plate is tuned to. Ticks mark the plate's modes; the amber one is nearest."
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

/** Whether the plate's tuning is read: the tone and the resonator's f0 (Resonance's rows). Without them no mode can be drawn. */
const tuned = (v: V) => numOf(v, 'resonance') !== undefined && numOf(v, 'baseFrequency') !== undefined

function FieldDisplay({v, set, w, h, hold}: {v: V; set?: SetFn; w: number; h: number; hold?: boolean}) {
  if (!tuned(v)) return <Display w={w} h={h} label="The field" does="The plate or chamber, drawn from Resonance's tone and f0, which are not read." corner={NONE}>
    <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">No reading of the plate</text>
  </Display>
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
  <Dial key={key} {...st(p, key)} label={label} does={does} value={numOf(p.v, key) ?? NaN} def={def} scale={scale} format={format} onChange={x => p.set(key, x)} />

const level = (p: ViewProps) => DIAL(p, 'level', 'Level', 'Sets the loudness of the whole field.', -12, LEVEL, decibels)
const tempo = (p: ViewProps) => DIAL(p, 'tempo', 'Tempo', 'Sets the pace of the field. At 0 the field holds still.', 1, TEMPO, times)
const tone = (p: ViewProps) => DIAL(p, 'resonance', 'Tone', 'The frequency the plate is tuned to. The travelling focus sets it while Driver is Focus.', 396, HZ, hertz)
const holdDial = (p: ViewProps) => DIAL(p, 'hold', 'Hold', 'Sets how long a scene holds a figure compared with how long it changes, as hold to change.', 0, HOLD, ratio)

const MEDIUMS = [{value: 'plate', label: 'Plate', does: 'A flat plate.'}, {value: 'chamber', label: 'Chamber', does: 'A three-dimensional chamber.'}] as const
// Key source (manual §20.2): whose pitches tune the field. Torus is what the torus plays, Sky the sky over your world, Manual the resonance you set.
const KEY_SOURCES = [
  {value: 'torus', label: 'Torus', does: 'Tunes the field to what the torus plays.'},
  {value: 'sky', label: 'Sky', does: 'Takes the key from the sky over your world.'},
  {value: 'manual', label: 'Manual', does: 'Uses the resonance you set, to study the modes.'},
] as const

export const design: DesignedDevice = {
  id: 'expressions:field',
  title: 'Field',
  kind: 'instrument',
  // The owner's defaults: object sound sounding (entitySound.ts:77), the resonant medium on (model.ts DEFAULT_ENGINE_SETTINGS), the
  // plate at 396 Hz with f0 40 Hz and dominance 1 (fieldModel.ts DEFAULT_CYMATIC_MEDIUM), time scale 1, no hold (fieldDefaults.ts),
  // 200 000 particles (fieldDefaults.ts:102). The level is the scene's Field Level, −12 dB where it keeps none (§20.2; round 886).
  defaults: {
    sound: true, level: -12, plate: true, medium: 'plate', keySource: 'torus', symbolVoices: true, collisionsStrike: false, pulse: false, resonance: 396, tempo: 1, hold: 0,
    voices: 0, particles: 200000, dominance: 1, baseFrequency: 40, symbols: SEVEN(0),
  },
  fixtures: {
    'Seven centres': {voices: 3, particles: 42000, symbols: SEVEN(3)},
    'Springs and plate': {voices: 3, particles: 42000, dominance: .5, hold: .625, symbols: SEVEN(3)},
    'Chamber': {voices: 3, particles: 42000, medium: 'chamber', symbols: SEVEN(3)},
    'Plate off': {voices: 0, particles: 42000, plate: false, sound: false, symbols: SEVEN(0)},
  },

  folded: p => <Folded title="Field" light={light(p.v)} readings={[numOf(p.v, 'resonance') === undefined ? NONE : hertz(numOf(p.v, 'resonance')!), numOf(p.v, 'tempo') === undefined ? NONE : times(numOf(p.v, 'tempo')!)]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Field" view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><FieldDisplay v={p.v} set={p.set} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>{level(p)}{tempo(p)}{tone(p)}{holdDial(p)}</Section>
  </Panel>,

  whole: p => <Panel title="Field" view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={198}><FieldDisplay v={p.v} set={p.set} w={186} h={146} hold /></Section>
      {/* O-I #747 round 896, item 0.7 (DLW build ruling 2026-11-09): where the frame says the field is not heard while the Sound is On
          (`soundClosed`: let go, unavailable, its audio suspended or closed), the Sound says so, and one press, Open sound, opens it. */}
      <Section label="Sound" cols={1}>
        <Toggle {...st(p, 'sound')} label="Sound" does={[SOUND_DOES, strOf(p.v, 'soundClosed')].filter(Boolean).join(' ')} on={on(p.v, 'sound')} unknown={boolOf(p.v, 'sound') === undefined} onChange={x => p.set('sound', x)} />
        {strOf(p.v, 'soundClosed') && <Action {...st(p, 'soundOpen')} label="Open sound" does={`${strOf(p.v, 'soundClosed')} Opens it now.`} onPress={() => p.set('soundOpen', true)} />}
        {level(p)}
      </Section>
      <Section label="Time" cols={1}>
        {tempo(p)}
        {holdDial(p)}
        <Toggle {...st(p, 'pulse')} label="Pulse" does="Pulses the field on the beat." on={on(p.v, 'pulse')} unknown={boolOf(p.v, 'pulse') === undefined}
          onChange={x => p.set('pulse', x)} />
      </Section>
      <Section label="Tuning" grow>
        {tone(p)}
        <Radio {...st(p, 'keySource')} label="Key source" does="Chooses whose pitches tune the field: the torus, the sky or the resonance you set." value={strOf(p.v, 'keySource') ?? ''} options={KEY_SOURCES} stack onChange={x => p.set('keySource', x)} />
      </Section>
    </Band>
    <Band>
      <Section label="Plate" width={96}>
        <Toggle {...st(p, 'plate')} label="Plate on" does="Turns the resonant plate on. Tone, Medium and Key source act only while it is on." on={on(p.v, 'plate')} unknown={boolOf(p.v, 'plate') === undefined} onChange={x => p.set('plate', x)} />
        <Radio {...st(p, 'medium')} label="Medium" does="Chooses a flat plate or a three-dimensional chamber." value={strOf(p.v, 'medium') ?? ''} options={MEDIUMS} stack onChange={x => p.set('medium', x)} />
      </Section>
      <Section label="Nearest mode" cols={2}>
        <Readout big label="mode" does="The plate mode nearest the tone." value={tuned(p.v) ? modeText(modeOf(p.v)) : undefined} tone="value" />
        <Readout label="mode Hz" does="The frequency of that mode." value={tuned(p.v) ? Math.round(modeOf(p.v).hz) : undefined} />
        <Readout label="detune" does="How far the tone sits from that mode, in cents." value={tuned(p.v) ? `${Math.round(1200 * Math.log2(num(p.v, 'resonance') / modeOf(p.v).hz))} ¢` : undefined} />
      </Section>
      {/* Voices (manual §20.2, Whole: "Voices | Symbol voices, Collisions strike, Lights"): round 896, item 0.4. In Sound they stood one
          column wide and their names were cut on their buttons; here their section takes the room their names need (panel.tsx roomsIn). */}
      <Section label="Voices" cols={1}>
        <Toggle {...st(p, 'symbolVoices')} label="Symbol voices" does="Lets symbols carry the torus's sound to where they stand." on={on(p.v, 'symbolVoices')} unknown={boolOf(p.v, 'symbolVoices') === undefined}
          onChange={x => p.set('symbolVoices', x)} />
        <Toggle {...st(p, 'collisionsStrike')} label="Collisions strike" does="Under On, a collision in the field strikes the torus at the point where it happens. The particles collide only while Particle contacts is on." on={on(p.v, 'collisionsStrike')} unknown={boolOf(p.v, 'collisionsStrike') === undefined}
          onChange={x => p.set('collisionsStrike', x)} />
      </Section>
      <Section label="Counts" grow>
        <Readout big label="voices" does="Symbols that have a voice. Give a symbol its voice in the Sound device." value={numOf(p.v, 'voices')} tone="accent" />
        <Readout label="particles" does="Particles in the field. Set the count in Ink." value={numOf(p.v, 'particles') === undefined ? undefined : count(numOf(p.v, 'particles')!)} />
      </Section>
    </Band>
  </Panel>,

  full: p => {
    if (!tuned(p.v)) return <div className="ref-pane-body ref-pane-body--dark"><p className="ref-pane-none">No reading of the plate: Resonance has not reported its tone and f0.</p></div>
    const w = 760, h = 420, mode = modeOf(p.v), chamber = str(p.v, 'medium') === 'chamber', symbols = symbolsOf(p.v), listed = symbols.slice(0, 8)
    const said = (key: string, format: (x: number) => string) => (numOf(p.v, key) === undefined ? NONE : format(numOf(p.v, key)!))
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The field">
        <g className="dp-display" style={{background: 'none'}}>
          <Stage v={p.v} ox={60} oy={26} s={368} dots={2600} />
          <text x={480} y={52} className="dp-ink" style={{fontSize: 14}}>{chamber ? 'Chamber' : 'Plate'} · mode {modeText(mode)}</text>
          <text x={480} y={72} className="dp-ink-dim" style={{fontSize: 12}}>{hertz(mode.hz)} · tuned to {hertz(num(p.v, 'resonance'))}</text>
          <text x={480} y={90} className="dp-ink-dim" style={{fontSize: 12}}>{said('particles', count)} particles · pace {said('tempo', times)} · holds {said('hold', ratio)}</text>
          {listed.slice().reverse().map((sym, i) => {
            const y = 134 + i * 34, voiced = sym.voiced
            return <g key={`${i}:${sym.name}`} opacity={voiced ? 1 : .6}>
              {voiced && <circle cx={492} cy={y} r={11} fill="none" stroke={sym.tint} strokeWidth={1.4} />}
              <text x={492} y={y} textAnchor="middle" dominantBaseline="central" fill={sym.tint} style={{fontSize: 15}}>{sym.glyph}</text>
              <text x={516} y={y} dominantBaseline="central" className="dp-ink" style={{fontSize: 13}}>{sym.name}</text>
              <text x={600} y={y} dominantBaseline="central" className="dp-ink-dim" style={{fontSize: 12}}>{voiced ? 'voice' : 'no voice'}</text>
            </g>
          })}
          {symbols.length > listed.length && <text x={516} y={134 + listed.length * 34} dominantBaseline="central" className="dp-ink-dim" style={{fontSize: 12}}>and {symbols.length - listed.length} more</text>}
          {!symbols.length && <text x={480} y={134} dominantBaseline="central" className="dp-ink-dim" style={{fontSize: 12}}>{strOf(p.v, 'symbols') === undefined ? 'No reading of the symbols' : 'No symbols in this scene'}</text>}
        </g>
      </svg>
    </div>
  },

  widget: p => <Tile title="Field" light={light(p.v)} onFull={p.nav.full}>
    <Display w={98} h={100} label="The field" does="Click ⤢ to open it full in the pane that has focus." corner={numOf(p.v, 'resonance') === undefined ? NONE : hertz(numOf(p.v, 'resonance')!)}>
      {tuned(p.v) ? <Stage v={p.v} ox={7} oy={14} s={84} dots={160} /> : <text x={49} y={56} textAnchor="middle" className="dp-ink-dim">no reading</text>}
    </Display>
    <div className="ref-meter" data-unread={meter(p.v) === undefined ? 'true' : undefined}
      data-i={`Level|${meter(p.v) === undefined ? st(p, 'level').disabled ?? 'No reading of the level.' : on(p.v, 'sound') ? 'The voices, summed, at the field\'s level.' : 'Sound is off.'}`}
      style={{'--level': meter(p.v) ?? 0} as CSSProperties}><span /></div>
  </Tile>,
}
