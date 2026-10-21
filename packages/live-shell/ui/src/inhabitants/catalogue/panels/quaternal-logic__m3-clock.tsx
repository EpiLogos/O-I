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
//   aperture.index       0..15, the static cut, its division the owner's table below. The Resonator bank holds the cut (M2 owns the
//                        apertures: manual §22.7); the clock draws it and shows it as a reading.
//   form.address         0..63, the hexagram of the form (`form.address`); form.codon the codon's letters (`transcription.sequence`)
//   law.matrix           'complementary' | 'moving-resting' | 'same-quality': the matrix that makes the hexagram a generation cell
//   law.seed             'sum-difference-mod' (FR 2.Q.9, the default) | 'four-charge' (FR 2.Q.17): the active pose's seed
//   law.poseMap          'raw-bin' (the default) | 'lawful-slot': how the turn lands on the eight poses
//                        (ql-core pole::generation, QuatSeed and PoseMap; m3_inscription's ActivePose names the laws it was read with)
//   generation.lower, generation.upper, generation.positive, generation.negative, generation.nonDual
//                        the cell of the form's hexagram under law.matrix (pole::generation::generate, C ql_m3_generate)
//   pose.bin, pose.slot  the active pose under the laws: the raw bin 0..7 and the lawful slot
// Writes are the owner's apply operations: a new degree is `advance-clock{steps}` by the difference. Turn, Open, Readout and showing
// the reciprocal are the view's own choices; no owner keeps them. The entry's Run and Rate have no owner operation (m3_reception
// carries no spanda-advance, and nothing runs the wheel), so they are not offered.
// The Rack page carries the rack of M3′ (quaternal-logic__map-rack.tsx), on the keys rack and rack.part.
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {NONE, boolOf, clampTo, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {RACK_M3, RackBands} from './quaternal-logic__map-rack'

type V = ViewProps['v']

/** The owner's sixteen static cuts, in tenths of a degree (ql-core pole/aperture.rs STATIC_DIVISION_DEG10); the reciprocal of p is 15 − p. */
const DIVISION_DEG10 = [10, 20, 40, 80, 90, 100, 120, 150, 240, 300, 360, 400, 450, 900, 1800, 3600] as const
const cutWord = (i: number) => { const d = DIVISION_DEG10[i]! / 10; return `${d}°×${360 / d}` }
const TURNS = [{value: 'first', label: 'First', does: 'Show the first turn of the wheel.'}, {value: 'second', label: 'Second', does: 'Show the second turn, the shadow of the first.'},
  {value: 'both', label: 'Both', does: 'Show both turns: the shadow inside the first.'}] as const
const OPENS = [{value: 'closed', label: 'Closed', does: 'The wheel whole.'}, {value: 'exploded', label: 'Exploded', does: 'The parts of the wheel drawn apart, the centre staying.'}] as const
const READOUTS = [{value: 'quadrant', label: 'Quadrant', does: 'Show the direction of the position.'}, {value: 'governor', label: 'Governor', does: 'Show the governor of the position.'},
  {value: 'hexagram', label: 'Hexagram', does: 'Show the hexagram and the codon of the position.'},
  {value: 'generation', label: 'Generation', does: 'Show the cell of the hexagram under the matrix: its two pairs and its positive and negative codons.'}] as const
const MATRICES = [{value: 'complementary', label: 'Compl.', does: 'Complementary: A with T, C with G.'}, {value: 'moving-resting', label: 'Mov./rest.', does: 'Moving and resting: A with G, T with C.'},
  {value: 'same-quality', label: 'Same q.', does: 'Same quality: A with C, T with G.'}] as const
const SEEDS = [{value: 'sum-difference-mod', label: 'Sum/diff.', does: "The turn from the sum and difference of the codon's bases (FR 2.Q.9)."},
  {value: 'four-charge', label: 'Charges', does: "The turn from the codon's four charges (FR 2.Q.17)."}] as const
const POSE_MAPS = [{value: 'raw-bin', label: 'Raw bin', does: 'The turn lands on its bin, 0 to 7.'},
  {value: 'lawful-slot', label: 'Lawful', does: 'A non-dual codon has seven poses: its eighth bin reads as its mirror, the first.'}] as const
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
const readoutWord = (v: V, s: Reading, short = false) => {
  const how = strOf(v, 'readout') ?? 'governor'
  if (s.deg === undefined) return undefined
  if (how === 'quadrant') return `${DIRS[Math.floor(s.deg / 90)]} ${s.deg % 90}°`
  if (how === 'hexagram') return s.hex === undefined ? undefined : `Hex ${s.hex}${s.codon ? ` · ${s.codon}` : ''}`
  if (how === 'generation') return generationWord(v, short)
  return s.governor === undefined ? undefined : `Gov ${s.governor + 1}`
}

/** The cell of the form's hexagram under the matrix: "GCC · non-dual", or the two codons "CCC · CTC". */
const generationWord = (v: V, short = false) => {
  const pos = strOf(v, 'generation.positive'), neg = strOf(v, 'generation.negative'), one = boolOf(v, 'generation.nonDual')
  return pos === undefined || neg === undefined || one === undefined ? undefined : one ? (short ? pos : `${pos} · non-dual`) : short ? `${pos}/${neg}` : `${pos} · ${neg}`
}
const pairsWord = (v: V) => { const lo = strOf(v, 'generation.lower'), up = strOf(v, 'generation.upper'); return lo === undefined || up === undefined ? undefined : `${lo} under ${up}` }

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
  const posSt = st(p, 'clock.degree720')
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
  </g>
}

const LIGHT_WHY = 'The M3 clock has no on or off. The light stays hollow.'
const head = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
/** The cover the position stands on: the dial says the degree, so the corner says only which of the two covers it is. */
const corner = (s: Reading) => (s.deg === undefined ? NONE : `${s.layer ? '2nd' : '1st'} cover`)
const DISPLAY_DOES = 'The wheel: North at the top, the governors outside, the chambers inside them, the cut as spokes, the needle at the degree.'

function controls(p: ViewProps) {
  const v = p.v, s = readingOf(v)
  return {
    cut: <Readout label="cut" does="How the wheel is cut: the size of a part and how many. The Resonator bank holds the cut; the clock draws it." value={s.ap === undefined ? undefined : cutWord(s.ap)} tone="value" />,
    position: <Dial {...st(p, 'clock.degree720')} label="Position" does="The degree to read." value={s.deg ?? NaN} def={0} scale={{min: 0, max: 359, step: 1}} format={x => `${x}°`}
      onChange={x => p.set('clock.degree720', (s.layer ?? 0) * 360 + x)} />,
    turn: <Radio {...st(p, 'turn')} label="Turn" does="Which turn of the wheel to show." value={strOf(v, 'turn') ?? ''} options={TURNS} stack onChange={x => p.set('turn', x)} />,
    matrix: <Radio {...st(p, 'law.matrix')} label="Matrix" does="The matrix that makes the position's hexagram a generation cell." value={strOf(v, 'law.matrix') ?? ''} options={MATRICES} onChange={x => p.set('law.matrix', x)} />,
    seed: <Radio {...st(p, 'law.seed')} label="Seed" does="How a codon becomes the turn that picks its pose. The two laws pick a different pose for about half the readings." value={strOf(v, 'law.seed') ?? ''} options={SEEDS} onChange={x => p.set('law.seed', x)} />,
    poseMap: <Radio {...st(p, 'law.poseMap')} label="Pose map" does="How the turn lands on the eight poses." value={strOf(v, 'law.poseMap') ?? ''} options={POSE_MAPS} onChange={x => p.set('law.poseMap', x)} />,
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
    // ql_m3_generate(complementary, 17): GC under CC, one codon, GCC.
    'law.matrix': 'complementary', 'law.seed': 'sum-difference-mod', 'law.poseMap': 'raw-bin',
    'generation.lower': 'GC', 'generation.upper': 'CC', 'generation.positive': 'GCC', 'generation.negative': 'GCC', 'generation.nonDual': true,
    // M3′'s rack, read from the M registry at revision c211a781 with the ledger's rungs; the parts carried as §22.3 names them.
    rack: RACK_M3, 'rack.part': '4',
  },
  firstPage: 'wheel',
  fixtures: {
    'Second turn, 4° cut': {},
    // ql_m3_generate(moving-resting, 17): CT under CC, two codons, CCC and CTC.
    'Generation, moving and resting': {readout: 'generation', 'law.matrix': 'moving-resting', 'generation.lower': 'CT', 'generation.upper': 'CC',
      'generation.positive': 'CCC', 'generation.negative': 'CTC', 'generation.nonDual': false},
    'Twelve lenses, reciprocal': {'clock.degree720': 100, 'clock.backbone': '#3-5-2-0', 'clock.tick12': 3, 'aperture.index': 9, reciprocal: true, turn: 'first', readout: 'quadrant'},
    'Exploded, 15° × 24': {'clock.degree720': 359, 'clock.tick12': 11, 'clock.backbone': '#3-5-4-5', 'aperture.index': 7, open: 'exploded', turn: 'first', 'form.codon': 'ATG', readout: 'hexagram'},
    'No reading': {'clock.degree720': undefined, 'clock.tick12': undefined, 'clock.backbone': undefined, 'aperture.index': undefined, 'form.address': undefined, 'form.codon': undefined,
      'law.matrix': undefined, 'law.seed': undefined, 'law.poseMap': undefined, 'generation.lower': undefined, 'generation.upper': undefined, 'generation.positive': undefined,
      'generation.negative': undefined, 'generation.nonDual': undefined, rack: undefined, 'rack.part': undefined},
  },

  folded: p => { const s = readingOf(p.v)
    return <Folded title="M3 clock" light="unknown" readings={[s.deg === undefined ? NONE : `${s.deg}°`, s.ap === undefined ? NONE : cutWord(s.ap)]} onUnfold={p.nav.unfold} /> },

  compact: p => { const c = controls(p), s = readingOf(p.v)
    return <Panel title="M3 clock" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The wheel" does={`${DISPLAY_DOES} Drag handle 1 for the position.`} corner={corner(s)}><Wheel p={p} w={140} h={146} handles={1} labels /></Display>
      </Section>
      <Section label="Macros" cols={2}>{c.position}{c.turn}{c.show}{c.open}</Section>
    </Panel> },

  whole: p => { const c = controls(p), s = readingOf(p.v), w = wide(p) ? Math.round(clampTo(186, p.room!.h - 22, 186)) : 186
    return <Panel title="M3 clock" view="whole" {...head(p)} pages={[{id: 'wheel', label: 'Wheel'}, {id: 'rack', label: 'Rack'}]} page={p.page === 'rack' ? 'rack' : 'wheel'} onPage={p.setPage}>
      {p.page === 'rack' ? <RackBands p={p} /> : <>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="The wheel" does={`${DISPLAY_DOES} Drag handle 1 for the position.`} corner={corner(s)}>
            <Wheel p={p} w={w} h={146} handles={2} labels />
          </Display>
        </Section>
        <Section label="Cut" width={72}>{c.cut}{c.show}</Section>
        <Section label="Show" width={84}>{c.turn}{c.open}</Section>
        <Section label="Law" grow>{c.matrix}{c.seed}{c.poseMap}</Section>
      </Band>
      <Band>
        <Section label="Position" width={72}>{c.position}
          <Readout label="tick" does="The tick of the twelve steps of the clock." value={s.tick} tone="value" />
        </Section>
        <Section label="Readout" width={84}>{c.readout}</Section>
        <Section label="Reading" grow>
          <Readout big label={(strOf(p.v, 'readout') ?? 'governor')} does="What the position shows, as the owner reads it." value={readoutWord(p.v, s)} tone="value" />
          <Readout label="governor ref" does="The governor's coordinate, as the owner names it." value={s.ref} copy={s.ref} />
          <Readout label="pairs" does="The two pairs of bases of the cell: the lower trigram's under the upper's." value={pairsWord(p.v)} />
          <Readout label={`pose · ${strOf(p.v, 'law.poseMap') === 'lawful-slot' ? 'slot' : 'bin'}`} does="The active pose, read under the seed and the pose map." tone="accent"
            value={strOf(p.v, 'law.poseMap') === 'lawful-slot' ? numOf(p.v, 'pose.slot') : numOf(p.v, 'pose.bin')} />
        </Section>
      </Band>
      </>}
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
            ['tick', s.tick === undefined ? NONE : `${s.tick} of 12`], ['cut', s.ap === undefined ? NONE : `${cutWord(s.ap)}, reciprocal ${cutWord(15 - s.ap)}`],
            ['generation', generationWord(p.v) === undefined ? NONE : `${pairsWord(p.v) ?? NONE} → ${generationWord(p.v)}`]].map(([k, val], i) =>
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
        <Readout label={strOf(p.v, 'readout') ?? 'governor'} value={readoutWord(p.v, s, true)} />
      </div>
    </Tile> },
}
