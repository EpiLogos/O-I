// M3 clock (manual §22.3): the wheel of 360 degrees, a full return in two turns of 720, that lenses cut in many ways. Live's nearest:
// a modulator whose display is its cycle with a needle (the LFO), and Wavetable's one large display with a handle on it. The display
// is the wheel by its own law: North at the top and the degrees growing clockwise; an outer ring of 24 governors of 15° (six to a
// quadrant), an inner ring of 9 chambers of 40°, the aperture's cut as spokes every division degrees from North, its reciprocal cut
// dashed, and the needle at the clock's degree. Both turns: the shadow turn stands inside the first. Exploded: the rings draw apart.
//
// Owner: Quaternal Logic's M3 state (crates/ql-mef/src/m3_state.rs `ql.m3-state/v1`, run by `ql kernel m3`), reached through the
// kernel op m3_reception (desktop/cradle/kernel/src/m3_reception.rs; `oi.m3-reception-context/v1`). Keyed on its paths:
//   clock.degree720      0..719, the double cover (`clock.degree720`); its degree is degree720 mod 360, its turn degree720 div 360
//   clock.tick12         0..11 (`clock.tick12`)
//   clock.backbone       the governor's ref, #3-5-q-i (`clock.backbone.ref`: quadrant 1..4, governor 0..5)
//   aperture.index       0..15, the static cut (`aperture.index`; write `set-aperture`), its division the owner's table below
//   form.address         0..63, the hexagram of the form (`form.address`); form.codon the codon's letters (`transcription.sequence`)
// Writes are the owner's apply operations: a new degree is `advance-clock{steps}` by the difference, a new cut `set-aperture`, Swap
// `reciprocal-aperture`. Turn, Open, Readout and showing the reciprocal are the view's own choices; no owner keeps them. The entry's
// Run and Rate have no owner operation (m3_reception carries no spanda-advance, and nothing runs the wheel), so they are not offered.
import {Action, Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

/** The owner's sixteen static cuts, in tenths of a degree (ql-core pole/aperture.rs STATIC_DIVISION_DEG10); the reciprocal of p is 15 − p. */
const DIVISION_DEG10 = [10, 20, 40, 80, 90, 100, 120, 150, 240, 300, 360, 400, 450, 900, 1800, 3600] as const
const cutWord = (i: number) => { const d = DIVISION_DEG10[i]! / 10; return `${d}°×${360 / d}` }
const TURNS = [{value: 'first', label: 'First', does: 'Show the first turn of the wheel.'}, {value: 'second', label: 'Second', does: 'Show the second turn, the shadow of the first.'},
  {value: 'both', label: 'Both', does: 'Show both turns: the shadow inside the first.'}] as const
const OPENS = [{value: 'closed', label: 'Closed', does: 'The wheel whole.'}, {value: 'exploded', label: 'Exploded', does: 'The parts of the wheel drawn apart, the centre staying.'}] as const
const READOUTS = [{value: 'quadrant', label: 'Quadrant', does: 'Show the direction of the position.'}, {value: 'governor', label: 'Governor', does: 'Show the governor of the position.'},
  {value: 'hexagram', label: 'Hexagram', does: 'Show the hexagram and the codon of the position.'}] as const
const DIRS = ['N', 'E', 'S', 'W']
const f1 = (x: number) => x.toFixed(1)

function readingOf(v: V) {
  const d720 = numOf(v, 'clock.degree720'), ok = d720 !== undefined && Number.isInteger(d720) && d720 >= 0 && d720 < 720
  const deg = ok ? d720! % 360 : undefined, layer = ok ? Math.floor(d720! / 360) : undefined
  const ai = numOf(v, 'aperture.index'), ap = ai !== undefined && Number.isInteger(ai) && ai >= 0 && ai < 16 ? ai : undefined
  const ref = strOf(v, 'clock.backbone'), m = /^#3-5-([1-4])-([0-5])$/.exec(ref ?? '')
  return {d720: ok ? d720! : undefined, deg, layer, ap, governor: m ? (Number(m[1]) - 1) * 6 + Number(m[2]) : undefined, ref,
    tick: numOf(v, 'clock.tick12'), hex: numOf(v, 'form.address'), codon: strOf(v, 'form.codon')}
}
type Reading = ReturnType<typeof readingOf>
const readoutWord = (v: V, s: Reading) => {
  const how = strOf(v, 'readout') ?? 'governor'
  if (s.deg === undefined) return undefined
  if (how === 'quadrant') return `${DIRS[Math.floor(s.deg / 90)]} ${s.deg % 90}°`
  if (how === 'hexagram') return s.hex === undefined ? undefined : `Hex ${s.hex}${s.codon ? ` · ${s.codon}` : ''}`
  return s.governor === undefined ? undefined : `Gov ${s.governor + 1}`
}

/** The wheel. Handle 1 is the needle (drag round: the degree); handle 2, in the pool, the first spoke of the cut (drag round: the
 * size of a part, to the nearest of the sixteen). */
function Wheel({p, w, h, handles, labels}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2; labels: boolean}) {
  const v = p.v, s = readingOf(v), cx = w / 2, cy = h / 2 + (labels ? 3 : 0), R = Math.min(w, h - (labels ? 18 : 4)) / 2 - (labels ? 10 : 3)
  const open = strOf(v, 'open') === 'exploded', turn = strOf(v, 'turn') ?? 'first', gap = open ? R * .1 : 0
  const P = (deg: number, r: number) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)] as const
  const spoke = (deg: number, r0: number, r1: number) => { const [a, b] = P(deg, r0), [c, d] = P(deg, r1); return `M${f1(a)} ${f1(b)}L${f1(c)} ${f1(d)}` }
  // the rings, outer to inner: the governors (24 × 15°), the chambers (9 × 40°), the cut; exploded, each ring stands apart
  const gov = {o: R, i: R * .84}, ch = {o: R * .8 - gap, i: R * .68 - gap}, cut = {o: R * .64 - 2 * gap, i: R * .16}
  const inner = turn === 'both' ? .62 : 1, shadow = turn === 'second'
  const ring = (k: number) => <g opacity={shadow && k === 1 ? .55 : 1} strokeDasharray={shadow && k === 1 ? '3 2' : undefined}>
    <circle cx={cx} cy={cy} r={gov.o * k} className="dp-faint" /><circle cx={cx} cy={cy} r={gov.i * k} className="dp-faint" />
    {Array.from({length: 24}, (_, i) => <path key={`g${i}`} d={spoke(i * 15, gov.i * k, gov.o * k)} className="dp-faint" opacity={i % 6 ? .6 : 1} />)}
    <circle cx={cx} cy={cy} r={ch.o * k} className="dp-faint" opacity={.7} /><circle cx={cx} cy={cy} r={ch.i * k} className="dp-faint" opacity={.7} />
    {Array.from({length: 9}, (_, i) => <path key={`c${i}`} d={spoke(i * 40, ch.i * k, ch.o * k)} className="dp-faint" opacity={.7} />)}
  </g>
  const gStart = s.deg === undefined ? undefined : Math.floor(s.deg / 15) * 15
  const arcPath = (a0: number, a1: number, r0: number, r1: number) => { const [x0, y0] = P(a0, r1), [x1, y1] = P(a1, r1), [x2, y2] = P(a1, r0), [x3, y3] = P(a0, r0)
    return `M${f1(x0)} ${f1(y0)}A${r1} ${r1} 0 0 1 ${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}A${r0} ${r0} 0 0 0 ${f1(x3)} ${f1(y3)}Z` }
  const divD = s.ap === undefined ? undefined : DIVISION_DEG10[s.ap]! / 10, recD = s.ap === undefined ? undefined : DIVISION_DEG10[15 - s.ap]! / 10
  const needleR = (turn === 'both' && s.layer === 1 ? inner : 1) * cut.o
  const posSt = st(p, 'clock.degree720'), apSt = st(p, 'aperture.index')
  return <g>
    {/* the governor of the position, lit: the reading starts from it */}
    {gStart !== undefined && (turn !== 'both' || s.layer === 0) && <path d={arcPath(gStart, gStart + 15, gov.i, gov.o)} className="dp-fill" stroke="var(--dp-value)" strokeWidth={.8} />}
    {ring(1)}
    {turn === 'both' && <g opacity={.5}>{ring(inner)}</g>}
    {/* the cut: a spoke at every division from North; its reciprocal dashed */}
    {divD !== undefined && Array.from({length: 360 / divD}, (_, i) => <path key={`a${i}`} d={spoke(i * divD, cut.i, cut.o)} stroke="var(--dp-value)" strokeWidth={360 / divD > 60 ? .4 : .9} opacity={.8} />)}
    {recD !== undefined && boolOf(v, 'reciprocal') === true && Array.from({length: 360 / recD}, (_, i) => <path key={`r${i}`} d={spoke(i * recD, cut.i * .6, cut.o * .92)} stroke="var(--dp-on)" strokeWidth={360 / recD > 60 ? .4 : .8} strokeDasharray="2 2" opacity={.7} />)}
    <circle cx={cx} cy={cy} r={2.5} fill="var(--text)" />
    {labels && DIRS.map((d, i) => { const [x, y] = P(i * 90, gov.o + 7); return <text key={d} x={x} y={y + 3} textAnchor="middle" className="dp-axis">{d}</text> })}
    {s.deg !== undefined ? <>
      <path d={spoke(s.deg, 0, needleR)} stroke="var(--dp-on)" strokeWidth={1.6} />
      {handles >= 1 && <Handle n={1} x={P(s.deg, needleR)[0]} y={P(s.deg, needleR)[1]} label="Position" shape="ring"
        does={`Drag round the wheel: the degree to read.${posSt.disabled ? ` ${posSt.disabled}` : ''}`}
        onDrag={posSt.disabled ? undefined : (x, y) => { const d = Math.round((Math.atan2(x - cx, cy - y) * 180 / Math.PI + 360) % 360); if (d !== s.deg) p.set('clock.degree720', (s.layer ?? 0) * 360 + d) }}
        onReset={posSt.disabled ? undefined : () => p.set('clock.degree720', (s.layer ?? 0) * 360)} />}
    </> : <text x={cx} y={cy + 18} textAnchor="middle" className="dp-ink-dim">{w > 90 ? 'No reading of the clock' : NONE}</text>}
    {handles >= 2 && divD !== undefined && divD < 360 && <Handle n={2} shape="square" x={P(divD, (cut.i + cut.o) / 2)[0]} y={P(divD, (cut.i + cut.o) / 2)[1]} label="Aperture"
      does={`Drag round: the size of a part of the cut.${apSt.disabled ? ` ${apSt.disabled}` : ''}`}
      onDrag={apSt.disabled ? undefined : (x, y) => { const a = (Math.atan2(x - cx, cy - y) * 180 / Math.PI + 360) % 360
        const i = DIVISION_DEG10.reduce((best, dd, k) => Math.abs(dd / 10 - a) < Math.abs(DIVISION_DEG10[best]! / 10 - a) ? k : best, 0)
        if (i !== s.ap) p.set('aperture.index', i) }} onReset={apSt.disabled ? undefined : () => p.set('aperture.index', 9)} />}
  </g>
}

const LIGHT_WHY = 'The M3 clock has no on or off. The light stays hollow.'
const head = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const corner = (s: Reading) => (s.deg === undefined ? NONE : `${s.deg}° · ${s.layer ? '2nd' : '1st'}`)
const DISPLAY_DOES = 'The wheel: North at the top, the governors outside, the chambers inside them, the cut as spokes, the needle at the degree.'

function controls(p: ViewProps) {
  const v = p.v, s = readingOf(v)
  return {
    aperture: <Dial {...st(p, 'aperture.index')} label="Aperture" does="How the wheel is cut: the size of a part and how many." value={s.ap ?? NaN} def={9} scale={{min: 0, max: 15, step: 1}} format={cutWord}
      onChange={x => p.set('aperture.index', x)} />,
    position: <Dial {...st(p, 'clock.degree720')} label="Position" does="The degree to read." value={s.deg ?? NaN} def={0} scale={{min: 0, max: 359, step: 1}} format={x => `${x}°`}
      onChange={x => p.set('clock.degree720', (s.layer ?? 0) * 360 + x)} />,
    turn: <Radio {...st(p, 'turn')} label="Turn" does="Which turn of the wheel to show." value={strOf(v, 'turn') ?? ''} options={TURNS} stack onChange={x => p.set('turn', x)} />,
    swap: <Action {...st(p, 'aperture.index')} label="Swap" does="Cut the wheel by the reciprocal: 15°×24 becomes 24°×15." onPress={s.ap === undefined ? undefined : () => p.set('aperture.index', 15 - s.ap!)} />,
    show: <Toggle {...st(p, 'reciprocal')} label="Reciprocal" does="Show the matching cut with the cut, dashed." on={boolOf(v, 'reciprocal') === true} onChange={x => p.set('reciprocal', x)} />,
    open: <Radio {...st(p, 'open')} label="Open" does="Draw the parts of the wheel apart." value={strOf(v, 'open') ?? ''} options={OPENS} stack onChange={x => p.set('open', x)} />,
    readout: <Radio {...st(p, 'readout')} does="What the position shows." value={strOf(v, 'readout') ?? ''} options={READOUTS} stack onChange={x => p.set('readout', x)} />,
  }
}

export const design: DesignedDevice = {
  id: 'quaternal-logic:m3-clock',
  title: 'M3 clock',
  kind: 'instrument',
  defaults: {
    // QL acceptance walk 296, native readback (gates/acceptance-walk-296/native-evidence/stage-evaluate.json): steps 419, the second
    // turn at 59°, tick 1, governor #3-5-1-3, form 17 (TAT), aperture 2 (4°).
    'clock.degree720': 419, 'clock.tick12': 1, 'clock.backbone': '#3-5-1-3', 'aperture.index': 2, 'form.address': 17, 'form.codon': 'TAT',
    turn: 'both', open: 'closed', readout: 'governor', reciprocal: false,
  },
  fixtures: {
    'Second turn, 4° cut': {},
    'Twelve lenses, reciprocal': {'clock.degree720': 100, 'clock.backbone': '#3-5-2-0', 'clock.tick12': 3, 'aperture.index': 9, reciprocal: true, turn: 'first', readout: 'quadrant'},
    'Exploded, 15° × 24': {'clock.degree720': 359, 'clock.tick12': 11, 'clock.backbone': '#3-5-4-5', 'aperture.index': 7, open: 'exploded', turn: 'first', 'form.codon': 'ATG', readout: 'hexagram'},
    'No reading': {'clock.degree720': undefined, 'clock.tick12': undefined, 'clock.backbone': undefined, 'aperture.index': undefined, 'form.address': undefined, 'form.codon': undefined},
  },

  folded: p => { const s = readingOf(p.v)
    return <Folded title="M3 clock" light="unknown" readings={[s.deg === undefined ? NONE : `${s.deg}°`, s.ap === undefined ? NONE : cutWord(s.ap)]} onUnfold={p.nav.unfold} /> },

  compact: p => { const c = controls(p), s = readingOf(p.v)
    return <Panel title="M3 clock" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The wheel" does={`${DISPLAY_DOES} Drag handle 1 for the position.`} corner={corner(s)}><Wheel p={p} w={140} h={146} handles={1} labels /></Display>
      </Section>
      <Section label="Macros" cols={2}>{c.aperture}{c.position}{c.turn}{c.swap}</Section>
    </Panel> },

  whole: p => { const c = controls(p), s = readingOf(p.v), w = wide(p) ? Math.round(clampTo(186, p.room!.h - 22, 186)) : 186
    return <Panel title="M3 clock" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="The wheel" does={`${DISPLAY_DOES} Drag handle 1 for the position and handle 2 for the cut.`} corner={corner(s)}>
            <Wheel p={p} w={w} h={146} handles={2} labels />
          </Display>
        </Section>
        <Section label="Cut" width={72}>{c.aperture}{c.show}{c.swap}</Section>
        <Section label="Show" grow>{c.turn}{c.open}</Section>
      </Band>
      <Band>
        <Section label="Position" width={72}>{c.position}
          <Readout label="tick" does="The tick of the twelve steps of the clock." value={s.tick} tone="value" />
        </Section>
        <Section label="Readout" width={84}>{c.readout}</Section>
        <Section label="Reading" grow>
          <Readout big label={(strOf(p.v, 'readout') ?? 'governor')} does="What the position shows, as the owner reads it." value={readoutWord(p.v, s)} tone="value" />
          <Readout label="governor ref" does="The governor's coordinate, as the owner names it." value={s.ref} />
          <Readout label="cut" does="The cut and its reciprocal." value={s.ap === undefined ? undefined : `${cutWord(s.ap)} · ${cutWord(15 - s.ap)}`} />
        </Section>
      </Band>
    </Panel> },

  full: p => { const s = readingOf(p.v)
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The M3 wheel">
        <g className="dp-display" style={{background: 'none', border: 'none'}}>
          <Wheel p={{...p, set: () => {}}} w={480} h={420} handles={0} labels />
          <text x={500} y={60} className="dp-ink" style={{fontSize: 22}}>{s.deg === undefined ? NONE : `${s.deg}°`}</text>
          <text x={500} y={80} className="dp-ink-dim">{s.layer === undefined ? 'No reading of the clock' : `${s.layer ? 'second turn, the shadow' : 'first turn'} · ${s.d720}° of 720`}</text>
          {[['governor', s.governor === undefined ? NONE : `${s.governor + 1} of 24 · ${s.ref ?? NONE}`], ['quadrant', s.deg === undefined ? NONE : `${['North', 'East', 'South', 'West'][Math.floor(s.deg / 90)]}`],
            ['chamber', s.deg === undefined ? NONE : `${Math.floor(s.deg / 40) + 1} of 9`], ['hexagram', s.hex === undefined ? NONE : `${s.hex}${s.codon ? ` · ${s.codon}` : ''}`],
            ['tick', s.tick === undefined ? NONE : `${s.tick} of 12`], ['cut', s.ap === undefined ? NONE : `${cutWord(s.ap)}, reciprocal ${cutWord(15 - s.ap)}`]].map(([k, val], i) =>
            <g key={k}><text x={500} y={122 + i * 26} className="dp-axis">{k}</text><text x={580} y={122 + i * 26} className="dp-ink">{val}</text></g>)}
        </g>
      </svg>
    </div> },

  widget: p => { const s = readingOf(p.v)
    return <Tile title="M3 clock" light="unknown" onFull={p.nav.full}>
      <Display w={70} h={100} label="The wheel" does="The wheel and its needle. Press ▦ to open the clock in the pane that has focus."><Wheel p={p} w={70} h={100} handles={0} labels={false} /></Display>
      <div className="ref-tile-side">
        <Readout label="degree" value={s.deg === undefined ? undefined : `${s.deg}°`} tone="value" />
        <Readout label="turn" value={s.layer === undefined ? undefined : s.layer ? '2nd' : '1st'} />
        <Readout label={strOf(p.v, 'readout') ?? 'governor'} value={readoutWord(p.v, s)} />
      </div>
    </Tile> },
}
