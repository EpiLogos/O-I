// Resonator bank (manual §22.7, quaternal-logic:resonator-bank): the effect after the torus that gives the cut a sound. Live's nearest:
// Resonators and Spectral Resonator — a set of tuned bodies the sound passes through, each ringing at its own pitch. M2 owns the
// apertures (docs/kernel-rebuild/APERTURES-AND-CLOCK-CENTRE.md §2: M2-0 holds the eighteen; the sixteen static cuts in eight
// reciprocal pairs), so the bank holds the cut and the M3 clock draws it. The display is the bank by its own law:
//   - the pitch circle is one octave turned into 360°, the root at the top. The cut divides it into N = 360 / d equal parts, one
//     resonator at each spoke: resonator k rings at f_root · 2^(k / N), repeated in each octave of the span;
//   - each resonator rings as a damped resonator of quality Q = π · f_k · decay: a peak far narrower than the drawing can show, so the
//     comb under the ring draws each as a line at its frequency on a log axis over the span, its height the brightness tilt's weight
//     2^(2 · tilt · (place in the span − ½)), its glow the decay.
// The cut's reciprocal (index 15 − i) is drawn dashed: Swap cuts by it.
//
// Owners, and the keys on their paths:
//   bank.on          the light (the bank's power)
//   aperture.index   0..15, the static cut the bank holds (ql-core pole/aperture.rs STATIC_DIVISION_DEG10; write `set-aperture`,
//                    Swap `reciprocal-aperture`, the operations the M3 clock used to carry)
//   bank.decay       0.05..10 s, how long each resonator rings (1)
//   bank.tilt        −1..1, brightness: the low octaves against the high (0)
//   bank.span        1..4 octaves the bank repeats over (2)
//   bank.mix         0..100 %, dry to wet (50)
//   bank.gain        −24..12 dB (0)
//   mode.root        0..11, the root of the mode in force (a reading: the transport, or Scale mapping's Sky source, sets it)
//   root.hz          the root's frequency in the lowest octave of the span (a reading)
import {Action, Band, Dial, Display, Folded, Handle, Panel, Readout, Section, Tile, ValueBox, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, db, fixed, numOf, pct, st, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

/** The owner's sixteen static cuts, in tenths of a degree (pole/aperture.rs STATIC_DIVISION_DEG10); the reciprocal of i is 15 − i. */
const DIVISION_DEG10 = [10, 20, 40, 80, 90, 100, 120, 150, 240, 300, 360, 400, 450, 900, 1800, 3600] as const
const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const cutWord = (i: number) => { const d = DIVISION_DEG10[i]! / 10; return `${d}°×${360 / d}` }
const hz = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(2)} kHz` : `${x < 100 ? x.toFixed(1) : Math.round(x)} Hz`)
const f1 = (x: number) => x.toFixed(1)
const DECAY = {min: .05, max: 10, log: true}, SPAN = {min: 1, max: 4, step: 1}, TILT = {min: -1, max: 1}, MIX = {min: 0, max: 100}, GAIN = {min: -24, max: 12}

function readingOf(v: V) {
  const ai = numOf(v, 'aperture.index'), ap = ai !== undefined && Number.isInteger(ai) && ai >= 0 && ai < 16 ? ai : undefined
  const fin = (k: string) => { const x = numOf(v, k); return x !== undefined && Number.isFinite(x) ? x : undefined }
  const rootN = fin('mode.root'), root = rootN !== undefined && Number.isInteger(rootN) && rootN >= 0 && rootN < 12 ? rootN : undefined
  const parts = ap === undefined ? undefined : 360 / (DIVISION_DEG10[ap]! / 10)
  const span = fin('bank.span')
  return {ap, parts, root, rootHz: fin('root.hz'), decay: fin('bank.decay'), tilt: fin('bank.tilt'), span, mix: fin('bank.mix'), gain: fin('bank.gain'),
    on: boolOf(v, 'bank.on'), count: parts !== undefined && span !== undefined ? parts * span : undefined}
}
type Reading = ReturnType<typeof readingOf>

/** The resonators' frequencies over the span: f_root · 2^(o + k / N). */
const resonators = (s: Reading): number[] => {
  if (s.parts === undefined || s.span === undefined || s.rootHz === undefined) return []
  const out: number[] = []
  for (let o = 0; o < s.span; o++) for (let k = 0; k < s.parts; k++) out.push(s.rootHz * Math.pow(2, o + k / s.parts))
  return out
}
/** A resonator's weight across the span: the brightness tilt, 2^(2 · tilt · (place − ½)). */
const weightOf = (s: Reading, fk: number) => (s.tilt === undefined || s.span === undefined || s.rootHz === undefined ? 1 : Math.pow(2, 2 * s.tilt * (Math.log2(fk / s.rootHz) / s.span - .5)))

/** The pitch circle: the root at the top, a spoke for each resonator, the reciprocal cut dashed. Handle 1 sits on the first spoke: drag
 * it round to choose the size of a part, to the nearest of the sixteen cuts. */
function Circle({p, cx, cy, R, handles, labels}: {p: ViewProps; cx: number; cy: number; R: number; handles: boolean; labels: boolean}) {
  const s = readingOf(p.v), apSt = st(p, 'aperture.index')
  const P = (deg: number, r: number) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)] as const
  const spoke = (deg: number, r0: number, r1: number) => { const [a, b] = P(deg, r0), [c, d] = P(deg, r1); return `M${f1(a)} ${f1(b)}L${f1(c)} ${f1(d)}` }
  const divD = s.ap === undefined ? undefined : DIVISION_DEG10[s.ap]! / 10, recD = s.ap === undefined ? undefined : DIVISION_DEG10[15 - s.ap]! / 10
  const dim = s.on === false ? .35 : 1
  return <g>
    <circle cx={cx} cy={cy} r={R} className="dp-faint" />
    <circle cx={cx} cy={cy} r={R * .3} className="dp-faint" opacity={.5} />
    {Array.from({length: 12}, (_, i) => <path key={`n${i}`} d={spoke(i * 30, R * .92, R)} className="dp-faint" />)}
    {labels && s.root !== undefined && Array.from({length: 12}, (_, i) => { const [x, y] = P(i * 30, R + 8)
      return <text key={`l${i}`} x={x} y={y + 3} textAnchor="middle" className="dp-axis" style={{fontSize: 7.5}}>{NOTE[(s.root! + i) % 12]}</text> })}
    {recD !== undefined && recD !== divD && Array.from({length: 360 / recD}, (_, i) => <path key={`r${i}`} d={spoke(i * recD, R * .3, R * .62)} stroke="var(--dp-on)" strokeWidth={360 / recD > 60 ? .4 : .8} strokeDasharray="2 2" opacity={.6 * dim} />)}
    {divD !== undefined && Array.from({length: 360 / divD}, (_, i) => <path key={`a${i}`} d={spoke(i * divD, R * .34, R * .9)} stroke="var(--dp-value)" strokeWidth={360 / divD > 60 ? .45 : 1.1} opacity={.85 * dim} />)}
    {divD !== undefined && <circle cx={P(0, R * .9)[0]} cy={P(0, R * .9)[1]} r={2.4} fill="var(--dp-value)" />}
    {s.ap === undefined && <text x={cx} y={cy + 3} textAnchor="middle" className="dp-ink-dim">{R > 40 ? 'No reading of the cut' : NONE}</text>}
    {s.ap !== undefined && <text x={cx} y={cy + 3} textAnchor="middle" className="dp-ink" style={{fontSize: R > 40 ? 10 : 8}}>{`${s.parts}`}</text>}
    {handles && divD !== undefined && divD < 360 && <Handle n={1} shape="square" x={P(divD, R * .66)[0]} y={P(divD, R * .66)[1]} label="Aperture"
      does={`Drag round the circle: the size of a part of the octave, to the nearest of the sixteen cuts.${apSt.disabled ? ` ${apSt.disabled}` : ''}`}
      onDrag={apSt.disabled ? undefined : (x, y) => { const a = (Math.atan2(x - cx, cy - y) * 180 / Math.PI + 360) % 360
        const i = DIVISION_DEG10.reduce((best, dd, k) => Math.abs(dd / 10 - a) < Math.abs(DIVISION_DEG10[best]! / 10 - a) ? k : best, 0)
        if (i !== s.ap) p.set('aperture.index', i) }} onReset={apSt.disabled ? undefined : () => p.set('aperture.index', 9)} />}
  </g>
}

/** The comb: a line at each resonator's frequency on a log axis over the span, its height the tilt's weight, its glow the decay. */
function Comb({v, x, y, w, h}: {v: V; x: number; y: number; w: number; h: number}) {
  const s = readingOf(v), fs = resonators(s)
  if (!fs.length || s.span === undefined || s.rootHz === undefined) return <text x={x + w / 2} y={y + h / 2} textAnchor="middle" className="dp-ink-dim">{w > 120 ? 'No reading of the bank' : NONE}</text>
  const lo = s.rootHz * .94, hi = s.rootHz * Math.pow(2, s.span) * 1.02, X = (f: number) => x + Math.log(f / lo) / Math.log(hi / lo) * w
  const top = Math.max(...fs.map(f => weightOf(s, f))), glow = s.decay === undefined ? .6 : clampTo(.25, 1, .35 + Math.log10(s.decay * 10) * .3)
  const dense = fs.length > w / 3
  return <g opacity={s.on === false ? .35 : 1}>
    {Array.from({length: s.span + 1}, (_, o) => { const xx = X(s.rootHz! * Math.pow(2, o))
      return <g key={o}><path d={`M${f1(xx)} ${y}V${y + h}`} className="dp-grid" /><text x={xx + 2} y={y + 8} className="dp-axis" style={{fontSize: 7}}>{o === 0 && s.root !== undefined ? NOTE[s.root] : `+${o}`}</text></g> })}
    <path d={`M${x} ${y + h}H${x + w}`} className="dp-faint" />
    {fs.map((f, i) => { const xx = X(f), hh = (h - 10) * weightOf(s, f) / top
      return <path key={i} d={`M${f1(xx)} ${y + h}V${f1(y + h - hh)}`} stroke="var(--dp-value)" strokeWidth={dense ? .5 : 1.4} opacity={glow} /> })}
  </g>
}

const lightOf = (p: ViewProps): LightState => { const on = boolOf(p.owner ?? p.v, 'bank.on'); return on === undefined ? 'unknown' : on ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'bank.on').disabled, onFold: p.nav.fold, onFull: p.nav.full,
  onLight: () => p.set('bank.on', !(boolOf(p.v, 'bank.on') === true))})
const DISPLAY_DOES = 'The octave as a circle, the root at the top: a spoke for each resonator of the cut, the reciprocal cut dashed. Under it, the bank\'s answer across the span.'
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined

function Well({p, w, h, handles}: {p: ViewProps; w: number; h: number; handles: boolean}) {
  const s = readingOf(p.v), combH = Math.round(h * .3), R = Math.min(w, h - combH - 8) / 2 - 12
  return <Display w={w} h={h} label="The bank" does={`${DISPLAY_DOES}${handles ? ' Drag handle 1 to change the cut.' : ''}`} corner={s.ap === undefined ? NONE : cutWord(s.ap)}>
    <Circle p={p} cx={w / 2} cy={R + 12} R={R} handles={handles} labels={w > 120} />
    <Comb v={p.v} x={6} y={h - combH - 4} w={w - 12} h={combH} />
  </Display>
}

function controls(p: ViewProps, s: Reading) {
  const apSt = st(p, 'aperture.index')
  return {
    aperture: <Dial {...apSt} label="Aperture" does="How the octave is cut: the size of a part and how many resonators." value={s.ap ?? NaN} def={9} scale={{min: 0, max: 15, step: 1}} format={cutWord}
      onChange={x => p.set('aperture.index', x)} />,
    swap: <Action {...apSt} label="Swap" does="Cut by the reciprocal: 15°×24 becomes 24°×15." onPress={s.ap === undefined ? undefined : () => p.set('aperture.index', 15 - s.ap!)} />,
    decay: <Dial {...st(p, 'bank.decay')} label="Decay" does="How long each resonator rings." value={s.decay ?? NaN} def={1} scale={DECAY} format={x => (x < 1 ? `${Math.round(x * 1000)} ms` : `${x.toFixed(1)} s`)} onChange={x => p.set('bank.decay', Math.round(x * 100) / 100)} />,
    tilt: <Dial {...st(p, 'bank.tilt')} label="Bright" does="The low octaves of the span against the high." value={s.tilt ?? NaN} def={0} scale={TILT} format={fixed(2)} bipolar onChange={x => p.set('bank.tilt', Math.round(x * 100) / 100)} />,
    span: <ValueBox {...st(p, 'bank.span')} label="Span" does="How many octaves the bank repeats over." value={s.span ?? NaN} def={2} scale={SPAN} format={x => `${x} oct`} onChange={x => p.set('bank.span', x)} />,
    mix: <Dial {...st(p, 'bank.mix')} label="Dry/wet" does="How much of the sound passes through the bank." value={s.mix ?? NaN} def={50} scale={MIX} format={pct} onChange={x => p.set('bank.mix', Math.round(x))} />,
    gain: <ValueBox {...st(p, 'bank.gain')} label="Gain" does="The bank's output level." value={s.gain ?? NaN} def={0} scale={GAIN} format={db} onChange={x => p.set('bank.gain', Math.round(x * 10) / 10)} />,
  }
}

export const design: DesignedDevice = {
  id: 'quaternal-logic:resonator-bank',
  title: 'Resonator bank',
  kind: 'effect',
  defaults: {
    'bank.on': true, 'aperture.index': 9, 'bank.decay': 1, 'bank.tilt': 0, 'bank.span': 2, 'bank.mix': 50, 'bank.gain': 0,
    // The root of the mode in force (C) and its frequency in the span's lowest octave.
    'mode.root': 0, 'root.hz': 130.81,
  },
  fixtures: {
    'Twelve to the octave': {},
    'Fifteen, ringing long': {'aperture.index': 8, 'bank.decay': 6, 'bank.tilt': .4},
    'Forty-five, bright': {'aperture.index': 3, 'bank.tilt': .8, 'bank.span': 1, 'mode.root': 9, 'root.hz': 220},
    'One resonator': {'aperture.index': 15, 'bank.span': 3},
    'Off': {'bank.on': false},
    'No readings': {'bank.on': undefined, 'aperture.index': undefined, 'bank.decay': undefined, 'bank.tilt': undefined, 'bank.span': undefined, 'bank.mix': undefined,
      'bank.gain': undefined, 'mode.root': undefined, 'root.hz': undefined},
  },

  folded: p => { const s = readingOf(p.v)
    return <Folded title="Resonator bank" light={lightOf(p)} readings={[s.ap === undefined ? NONE : cutWord(s.ap), s.root === undefined ? NONE : NOTE[s.root]!]} onUnfold={p.nav.unfold} /> },

  compact: p => { const s = readingOf(p.v), c = controls(p, s)
    return <Panel title="Resonator bank" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}><Well p={p} w={140} h={146} handles /></Section>
      <Section label="Macros" cols={2}>{c.aperture}{c.decay}{c.mix}{c.swap}</Section>
    </Panel> },

  whole: p => { const s = readingOf(p.v), c = controls(p, s), w = wide(p) ? Math.round(clampTo(186, p.room!.w - 620, 420)) : 186
    return <Panel title="Resonator bank" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}><Well p={p} w={w} h={146} handles /></Section>
        <Section label="Cut" width={72}>{c.aperture}{c.swap}
          <Readout label="reciprocal" does="The matching cut. Swap cuts by it." value={s.ap === undefined ? undefined : cutWord(15 - s.ap)} />
        </Section>
        <Section label="Ring" cols={2}>{c.decay}{c.tilt}{c.span}</Section>
        <Section label="Output" grow>{c.mix}{c.gain}</Section>
      </Band>
      <Band>
        <Section label="Reading" grow>
          <Readout big label="resonators" does="How many resonators ring: the parts of the cut, in each octave of the span." value={s.count} tone="value" />
          <Readout label="root" does="The root of the mode in force: the transport sets it, or the Sky through Scale mapping." value={s.root === undefined ? undefined : NOTE[s.root]} />
          <Readout label="lowest" does="The lowest resonator: the root in the span's first octave." value={s.rootHz === undefined ? undefined : hz(s.rootHz)} />
          <Readout label="highest" does="The highest resonator of the span." value={(() => { const fs = resonators(s); return fs.length ? hz(fs[fs.length - 1]!) : undefined })()} />
        </Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The resonator bank">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <Circle p={p} cx={190} cy={190} R={160} handles labels />
        <Comb v={p.v} x={390} y={60} w={350} h={260} />
        <text x={390} y={44} className="dp-ink">{(() => { const s = readingOf(p.v); return s.ap === undefined ? 'No reading of the cut' : `${cutWord(s.ap)} · ${s.count ?? NONE} resonators over ${s.span ?? NONE} octaves` })()}</text>
        <text x={390} y={345} className="dp-axis">The bank's answer across the span, by octave from the root.</text>
      </g>
    </svg>
  </div>,

  widget: p => { const s = readingOf(p.v)
    return <Tile title="Bank" light={lightOf(p)} onLight={head(p).onLight} lightWhy={head(p).lightWhy} onFull={p.nav.full}>
      <Display w={70} h={100} label="The bank" does="The cut on the octave. Press ▦ to open the bank in the pane that has focus.">
        <Circle p={p} cx={35} cy={50} R={30} handles={false} labels={false} />
      </Display>
      <div className="ref-tile-side">
        <Readout label="cut" value={s.ap === undefined ? undefined : cutWord(s.ap)} tone="value" />
        <Readout label="resonators" value={s.count} />
        <Readout label="decay" value={s.decay === undefined ? undefined : `${s.decay} s`} />
      </div>
    </Tile> },
}
