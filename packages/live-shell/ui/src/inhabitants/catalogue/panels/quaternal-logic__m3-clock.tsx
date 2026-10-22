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
// The Rack page carries the rack of M3′ (the rack kit, map-rack.tsx), on the keys rack and rack.part.
//
// The Binding skin (manual §22.3 "The Binding skin", which took in the Binding device of §22.8): Skin ('wheel' | 'binding', the view's own)
// chooses what the clock draws. Binding draws M3's charge-bearing units as colour charges bound by strings, to see which codons a matrix
// holds together and how hard; the kernel gives the symbols, and Binding runs its own physics over them and claims no measured constant.
//   - A codon is a three-way junction: its three sites on three arms 120° apart, coloured by place (the positive codon red, green, blue;
//     the negative its anticolours), the Y turned by its leading pair's index × 22.5°.
//   - Pairing is the matrix: at the form's hexagram the matrix's generation cell gives a positive codon (a·c·d) and a negative one
//     (a·b·d), tied by a string as a meson. When the cell is non-dual (b = c) they are one codon, a singlet, handed to the torus.
//   - Charge picks which of the codon's four charges (pp, mm, mp, pm) each junction carries.
//   - Nonets: nine M2 positions resolving into eight M3 positions; the two that land together are drawn and not joined.
//   - Tension σ and the coupling scale are Binding's own physics; its engine reports the coupling, the string's stretch and its energy by
//     V(r) = −(4/3)·α_s·ħc/r + σr. Every motion is caused by a kernel event (an inscription, a matrix change, a line change).
// Its values stand under `binding.` (a binding hosts the skin by prefixing Binding's own): binding.pairing.matrix, binding.charge.register,
// binding.nonets.show, binding.string.tension (0.1..2 GeV/fm, 0.9), binding.coupling.scale (0.3..10 GeV, 1), binding.sound.stretchQ; the
// readings binding.cell.hexagram, .lower, .upper, .nonDual, .positive, .negative, binding.values.positive|negative, binding.charges.positive|
// negative ([pp, mm, mp, pm]), binding.m2.index, binding.nonet ([{m2, m3}]), binding.coupling.alpha, binding.string.stretch (fm),
// binding.string.energy (GeV), binding.event.kind ('inscription' | 'matrix' | 'line'), binding.event.what.
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, fixed, grown, json, numOf, prefixed, scoped, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {RACK_M3, RackBands} from './map-rack'

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
const MATRICES = [{value: 'complementary', label: 'Complementary', does: 'A with T, C with G.'}, {value: 'moving-resting', label: 'Moving and resting', does: 'A with G, T with C.'},
  {value: 'same-quality', label: 'Same quality', does: 'A with C, T with G.'}] as const
const SEEDS = [{value: 'sum-difference-mod', label: 'Sum and difference', does: "The turn from the sum and difference of the codon's bases (FR 2.Q.9)."},
  {value: 'four-charge', label: 'Four charge', does: "The turn from the codon's four charges (FR 2.Q.17)."}] as const
const POSE_MAPS = [{value: 'raw-bin', label: 'Raw bin', does: 'The turn lands on its bin, 0 to 7.'},
  {value: 'lawful-slot', label: 'Lawful slot', does: 'A non-dual codon moves from the eighth pose to its mirror, the first.'}] as const
const SKINS = [{value: 'wheel', label: 'Wheel', does: 'The clock draws the wheel.'}, {value: 'binding', label: 'Binding', does: 'The clock draws the Binding skin: the cell\'s codons as colour charges bound by a string.'}] as const
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
    matrix: <Chooser {...st(p, 'law.matrix')} label="Matrix" does="The matrix that makes the position's hexagram a generation cell." value={strOf(v, 'law.matrix') ?? ''} options={MATRICES} onChange={x => p.set('law.matrix', x)} />,
    seed: <Chooser {...st(p, 'law.seed')} label="Seed" does="How a codon becomes the turn that picks its pose. The two laws pick a different pose for about half the readings." value={strOf(v, 'law.seed') ?? ''} options={SEEDS} onChange={x => p.set('law.seed', x)} />,
    poseMap: <Radio {...st(p, 'law.poseMap')} label="Pose map" does="How the turn lands on the eight poses." value={strOf(v, 'law.poseMap') ?? ''} options={POSE_MAPS} stack onChange={x => p.set('law.poseMap', x)} />,
    skin: <Radio {...st(p, 'skin')} label="Skin" does="What the clock draws: the wheel, or the Binding skin." value={strOf(v, 'skin') ?? ''} options={SKINS} stack onChange={x => p.set('skin', x)} />,
    show: <Toggle {...st(p, 'reciprocal')} label="Reciprocal" does="Show the matching cut with the cut, dashed." on={boolOf(v, 'reciprocal') === true} onChange={x => p.set('reciprocal', x)} />,
    open: <Radio {...st(p, 'open')} label="Open" does="Draw the parts of the wheel apart." value={strOf(v, 'open') ?? ''} options={OPENS} stack onChange={x => p.set('open', x)} />,
    readout: <Radio {...st(p, 'readout')} does="What the position shows." value={strOf(v, 'readout') ?? ''} options={READOUTS} stack onChange={x => p.set('readout', x)} />,
  }
}

// ================================================================ the Binding skin (`binding.` keys)

type Register = 'pp' | 'mm' | 'mp' | 'pm'
const REGISTERS: readonly Register[] = ['pp', 'mm', 'mp', 'pm']
const REGISTER_OPTIONS = REGISTERS.map(r => ({value: r, label: r, does: `Each junction carries its ${r} charge.`}))
const EVENTS: Record<string, string> = {inscription: 'an inscription', matrix: 'a matrix change', line: 'a line change'}
const EVENT_WORD: Record<string, string> = {inscription: 'Inscription', matrix: 'Matrix change', line: 'Line change'}
const BASES = 'ATCG', HBARC = .197327
const COLOUR = ['hsl(2 78% 60%)', 'hsl(128 55% 52%)', 'hsl(218 80% 64%)'], ANTI = ['hsl(182 70% 55%)', 'hsl(302 62% 64%)', 'hsl(52 85% 58%)']

const codonOf = (v: V, key: string) => { const c = strOf(v, key); return c !== undefined && /^[ATCG]{3}$/.test(c) ? c : undefined }
const listOf = (v: V, key: string, n: number) => { const a = json<unknown>(v, key, undefined); return Array.isArray(a) && a.length === n && a.every(x => typeof x === 'number') ? a as number[] : undefined }
const registerOf = (v: V): Register | undefined => { const r = strOf(v, 'charge.register'); return REGISTERS.includes(r as Register) ? r as Register : undefined }
const chargeOf = (v: V, side: 'positive' | 'negative') => { const c = listOf(v, `charges.${side}`, 4), r = registerOf(v); return c && r ? c[REGISTERS.indexOf(r)] : undefined }
/** The junction's turn: the codon's leading pair (its first two sites) as its place among the sixteen, × 22.5°. */
const hingeOf = (codon: string) => (BASES.indexOf(codon[0]!) * 4 + BASES.indexOf(codon[1]!)) * 22.5
const signedWord = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0')
const nonetOf = (v: V) => json<unknown[]>(v, 'nonet', []).flatMap((x): {m2: number; m3: number}[] => (typeof x === 'object' && x !== null && typeof (x as {m2: unknown}).m2 === 'number' && typeof (x as {m3: unknown}).m3 === 'number' ? [x as {m2: number; m3: number}] : []))

/** One codon as a Y: three arms from the junction, a site at each tip, the junction carrying the chosen charge. */
function Junction({x, y, arm, codon, values, anti, charge, small}: {x: number; y: number; arm: number; codon: string; values?: number[]; anti: boolean; charge?: number; small: boolean}) {
  const hinge = hingeOf(codon), r = small ? 4.5 : 8
  return <g>
    {[0, 1, 2].map(k => { const a = (hinge + k * 120 - 90) * Math.PI / 180, tx = x + Math.cos(a) * arm, ty = y + Math.sin(a) * arm, c = (anti ? ANTI : COLOUR)[k]
      return <g key={k}>
        <path d={`M${x.toFixed(1)} ${y.toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}`} stroke={c} strokeWidth={small ? 1.4 : 2.4} opacity={.75} />
        <circle cx={tx} cy={ty} r={r} fill="var(--dp-well)" stroke={c} strokeWidth={1.4} />
        {!small && <text x={tx} y={ty + 3.5} textAnchor="middle" className="dp-ink" style={{fontSize: 10}}>{codon[k]}</text>}
        {!small && values && <text x={tx + (tx >= x ? 12 : -12)} y={ty + 3} textAnchor={tx >= x ? 'start' : 'end'} className="dp-axis" style={{fontSize: 8}}>{values[k]}</text>}
      </g> })}
    <circle cx={x} cy={y} r={small ? 2 : 3.5} fill="var(--dp-ink, currentColor)" />
    {!small && charge !== undefined && <text x={x} y={y + arm + 22} textAnchor="middle" className="dp-ink" style={{fontSize: 10}}>{signedWord(charge)}</text>}
  </g>
}

/** Nine M2 positions over the eight M3 positions they resolve into, the two that land together marked and not joined. */
function Nonet({v, x, y, w}: {v: V; x: number; y: number; w: number}) {
  const n = nonetOf(v)
  if (n.length !== 9) return <text x={x + w / 2} y={y + 20} textAnchor="middle" className="dp-ink-dim" style={{fontSize: 9}}>No nonet from the kernel</text>
  const m3s = [...new Set(n.map(e => e.m3))].sort((a, b) => a - b), shared = n.filter(e => n.filter(f => f.m3 === e.m3).length > 1).map(e => e.m2)
  const top = (i: number) => x + 6 + i * (w - 12) / 8, bottom = (j: number) => x + 6 + j * (w - 12) / Math.max(1, m3s.length - 1)
  return <g>
    <text x={x} y={y - 4} className="dp-axis" style={{fontSize: 8}}>M2 {n[0]!.m2}–{n[8]!.m2} → M3 {m3s[0]}–{m3s[m3s.length - 1]}</text>
    {n.map((e, i) => { const j = m3s.indexOf(e.m3), hit = shared.includes(e.m2)
      return <g key={e.m2}>
        <path d={`M${top(i).toFixed(1)} ${y + 4}L${bottom(j).toFixed(1)} ${y + 30}`} stroke={hit ? 'var(--dp-on)' : 'var(--dp-value-dim)'} strokeWidth={hit ? 1.4 : .8} />
        <circle cx={top(i)} cy={y + 4} r={2.4} fill={hit ? 'var(--dp-on)' : 'var(--dp-value)'} />
      </g> })}
    {m3s.map((m, j) => <circle key={m} cx={bottom(j)} cy={y + 30} r={2.4} fill="var(--dp-value)" />)}
    <text x={x} y={y + 44} className="dp-axis" style={{fontSize: 8}}>{shared.length ? `${shared.join(' and ')} land together` : 'none land together'}</text>
  </g>
}

/** The Binding skin: a meson (the cell's two codons, colour and anticolour, tied by a string) or a singlet handed to the torus. */
function BindingField({v, w, h, small}: {v: V; w: number; h: number; small: boolean}) {
  const pos = codonOf(v, 'cell.positive'), neg = codonOf(v, 'cell.negative'), one = boolOf(v, 'cell.nonDual')
  if (!pos || !neg || one === undefined) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{w > 100 ? 'No cell from the kernel' : NONE}</text>
  const nonet = !small && boolOf(v, 'nonets.show') === true, nw = Math.round(clampTo(100, 200, w * .22)), fw = nonet ? w - nw - 16 : w, cy = h / 2 - (small ? 0 : 6), arm = Math.min(fw, h) * (small ? .16 : .17)
  const sigma = numOf(v, 'string.tension') ?? .9, stretch = numOf(v, 'string.stretch'), tube = 1.5 + 4 * clampTo(0, 1, sigma / 2)
  const vp = listOf(v, 'values.positive', 3), vn = listOf(v, 'values.negative', 3)
  if (one) return <g>
    <circle cx={fw / 2} cy={cy} r={arm + (small ? 8 : 16)} fill="none" stroke="var(--dp-value-dim)" strokeDasharray="3 3" />
    <Junction x={fw / 2} y={cy} arm={arm} codon={pos} values={vp} anti={false} charge={chargeOf(v, 'positive')} small={small} />
    {!small && <text x={fw / 2} y={cy - arm - 22} textAnchor="middle" className="dp-axis" style={{fontSize: 9}}>{pos} · non-dual: a singlet to the torus</text>}
    {nonet && <Nonet v={v} x={fw + 8} y={cy - 14} w={nw} />}
  </g>
  const half = clampTo(arm * 1.4, fw / 2 - arm - 10, (stretch ?? .8) * fw * .28), x1 = fw / 2 - half, x2 = fw / 2 + half
  return <g>
    <path d={`M${x1.toFixed(1)} ${cy}L${x2.toFixed(1)} ${cy}`} stroke="var(--dp-on)" strokeWidth={tube} opacity={.35} strokeLinecap="round" />
    <path d={`M${x1.toFixed(1)} ${cy}L${x2.toFixed(1)} ${cy}`} stroke="var(--dp-on)" strokeWidth={.8} />
    <Junction x={x1} y={cy} arm={arm} codon={pos} values={vp} anti={false} charge={chargeOf(v, 'positive')} small={small} />
    <Junction x={x2} y={cy} arm={arm} codon={neg} values={vn} anti charge={chargeOf(v, 'negative')} small={small} />
    {!small && <text x={fw / 2} y={cy - arm - 22} textAnchor="middle" className="dp-axis" style={{fontSize: 9}}>{pos} + {neg} · a meson</text>}
    {nonet && <Nonet v={v} x={fw + 8} y={cy - 14} w={nw} />}
  </g>
}

/** Binding's potential over the string's length, with the engine's stretch marked. */
function Potential({v, w, h}: {v: V; w: number; h: number}) {
  const sigma = numOf(v, 'string.tension'), alpha = numOf(v, 'coupling.alpha'), stretch = numOf(v, 'string.stretch')
  if (sigma === undefined || alpha === undefined) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{NONE}</text>
  const V = (r: number) => -(4 / 3) * alpha * HBARC / r + sigma * r, R = 2, lo = -1, hi = 2
  const X = (r: number) => 4 + (r / R) * (w - 8), Y = (e: number) => h - 4 - (clampTo(lo, hi, e) - lo) / (hi - lo) * (h - 8)
  const d = Array.from({length: 60}, (_, i) => { const r = .06 + i * (R - .06) / 59; return `${i ? 'L' : 'M'}${X(r).toFixed(1)} ${Y(V(r)).toFixed(1)}` }).join('')
  return <g>
    <path d={`M4 ${Y(0).toFixed(1)}H${w - 4}`} className="dp-faint" />
    <path d={d} fill="none" stroke="var(--dp-value)" strokeWidth={1.2} />
    {stretch !== undefined && stretch > 0 && <circle cx={X(clampTo(.06, R, stretch))} cy={Y(V(stretch))} r={3} fill="var(--dp-on)" />}
    <text x={w - 4} y={10} textAnchor="end" className="dp-axis" style={{fontSize: 8}}>V(r)</text>
  </g>
}

const FIELD_DOES = "The cell's codons as colour charges: a meson when the matrix gives two, a singlet to the torus when it gives one."
const sideWord = (v: V, side: 'positive' | 'negative') => { const c = codonOf(v, `cell.${side}`), q = chargeOf(v, side), r = registerOf(v)
  return c === undefined ? NONE : q === undefined || r === undefined ? c : `${c} · ${r} ${signedWord(q)}` }
const eventWord = (v: V) => { const k = strOf(v, 'event.kind'), what = strOf(v, 'event.what'); return k === undefined || !(k in EVENTS) ? NONE : what ?? EVENTS[k]! }
/** The kernel's cell and the event behind the last motion, as rows. */
function readingRows(v: V, full = false): RowItem[] {
  const lo = strOf(v, 'cell.lower'), up = strOf(v, 'cell.upper'), hex = numOf(v, 'cell.hexagram'), one = boolOf(v, 'cell.nonDual'), k = strOf(v, 'event.kind')
  const row = (id: string, name: string | undefined, note: string): RowItem => ({id, name: name ?? NONE, light: name === undefined ? 'unknown' : 'lit', tone: 'value', note})
  return [
    row('cell', lo === undefined || up === undefined ? undefined : `${lo} under ${up}`, hex === undefined ? 'cell' : `hex ${hex}`),
    row('positive', codonOf(v, 'cell.positive') && sideWord(v, 'positive'), 'a·c·d'),
    row('negative', one === true ? 'the same codon: a singlet' : codonOf(v, 'cell.negative') && sideWord(v, 'negative'), 'a·b·d'),
    row('moved', eventWord(v) === NONE ? undefined : full ? eventWord(v) : EVENT_WORD[k!], 'moved by'),
  ]
}
function bindingControls(p: ViewProps) {
  const v = p.v
  return {
    pairing: <Chooser {...st(p, 'pairing.matrix')} label="Pairing" does="The matrix whose cell gives the two codons." value={strOf(v, 'pairing.matrix') ?? ''} options={MATRICES} onChange={x => p.set('pairing.matrix', x)} />,
    charge: <Radio {...st(p, 'charge.register')} label="Charge" does="Which of the codon's four charges each junction carries." value={registerOf(v) ?? ''} options={REGISTER_OPTIONS} onChange={x => p.set('charge.register', x)} />,
    tension: <Dial {...st(p, 'string.tension')} label="Tension" does="The string's tension. It belongs to Binding's own physics." value={numOf(v, 'string.tension') ?? NaN} def={.9} scale={{min: .1, max: 2}} format={x => `${fixed(2)(x)} GeV/fm`} onChange={x => p.set('string.tension', Math.round(x * 100) / 100)} />,
    coupling: <Dial {...st(p, 'coupling.scale')} label="Coupling" does="The scale the coupling runs at. It belongs to Binding's own physics." value={numOf(v, 'coupling.scale') ?? NaN} def={1} scale={{min: .3, max: 10, log: true}} format={x => `${fixed(x < 1 ? 2 : 1)(x)} GeV`} onChange={x => p.set('coupling.scale', Math.round(x * 100) / 100)} />,
    nonets: <Toggle {...st(p, 'nonets.show')} label="Nonets" does="Draws the nine M2 positions resolving into eight." on={boolOf(v, 'nonets.show') === true} unknown={boolOf(v, 'nonets.show') === undefined} onChange={x => p.set('nonets.show', x)} />,
    sound: <Toggle {...st(p, 'sound.stretchQ')} label="Stretch → Q" does="The string's stretch sounds as the Resonance's Q factor, through M2." on={boolOf(v, 'sound.stretchQ') === true} unknown={boolOf(v, 'sound.stretchQ') === undefined} onChange={x => p.set('sound.stretchQ', x)} />,
  }
}
const bindingOf = (p: ViewProps) => scoped(p, 'binding.')
const onBinding = (v: V) => strOf(v, 'skin') === 'binding'

/** The Binding page: the skin's picture and its settings, beside the clock's Skin. */
function BindingBands({p}: {p: ViewProps}) {
  const b = bindingOf(p), c = bindingControls(b), w = grown(p, 220, 620, 420)
  return <>
    <Band>
      <Section width={w + 12}><Display w={w} h={146} label="The binding" does={FIELD_DOES}><BindingField v={b.v} w={w} h={146} small={false} /></Display></Section>
      <Section label="Skin" width={76}>{controls(p).skin}</Section>
      <Section label="Pairing" width={124}>{c.pairing}{c.charge}</Section>
      <Section label="Physics" cols={2} grow>{c.tension}{c.coupling}
        <Readout label="α_s" does="The coupling at its scale, from Binding's engine." value={numOf(b.v, 'coupling.alpha') === undefined ? undefined : fixed(3)(numOf(b.v, 'coupling.alpha')!)} />
        <Readout label="energy" does="The string's energy at its stretch, from Binding's engine." value={numOf(b.v, 'string.energy') === undefined ? undefined : `${fixed(2)(numOf(b.v, 'string.energy')!)} GeV`} />
      </Section>
    </Band>
    <Band>
      <Section label="Show" width={84}>{c.nonets}{c.sound}</Section>
      <Section width={104}><Display w={92} h={70} label="Potential" does="V(r) = −(4/3)·α_s·ħc/r + σr over the string's length, the engine's stretch marked."><Potential v={b.v} w={92} h={70} /></Display></Section>
      <Section label="Reading" grow><Rows does="The kernel's cell and the event behind the last motion. Every motion has a kernel event behind it." items={readingRows(b.v)} size={4} /></Section>
    </Band>
  </>
}

const BINDING_DEFAULTS = {
  'pairing.matrix': 'moving-resting', 'charge.register': 'pp', 'nonets.show': true, 'sound.stretchQ': true, 'string.tension': .9, 'coupling.scale': 1,
  // ql_m3_generate(1, 17) and ql_m3_codon on main (61c0e16): CT under CC gives CCC and CTC.
  'cell.hexagram': 17, 'cell.lower': 'CT', 'cell.upper': 'CC', 'cell.nonDual': false, 'cell.positive': 'CCC', 'cell.negative': 'CTC',
  'values.positive': '[8,8,8]', 'values.negative': '[8,9,8]', 'charges.positive': '[24,-8,8,8]', 'charges.negative': '[25,-9,7,9]',
  // ql_m3_epogdoon over M2 36..44.
  'm2.index': 37, nonet: JSON.stringify([{m2: 36, m3: 32}, {m2: 37, m3: 32}, {m2: 38, m3: 33}, {m2: 39, m3: 34}, {m2: 40, m3: 35}, {m2: 41, m3: 36}, {m2: 42, m3: 37}, {m2: 43, m3: 38}, {m2: 44, m3: 39}]),
  // Binding's engine at Q = 1 GeV, σ = 0.9, the string at 0.8 fm.
  'coupling.alpha': .447, 'string.stretch': .8, 'string.energy': .573,
  'event.kind': 'matrix', 'event.what': 'Complementary to moving and resting',
}
const PAGES = [{id: 'wheel', label: 'Wheel'}, {id: 'binding', label: 'Binding'}, {id: 'rack', label: 'Rack'}] as const
const pageOf = (p: ViewProps) => (p.page === 'binding' || p.page === 'rack' ? p.page : 'wheel')

export const design: DesignedDevice = {
  id: 'quaternal-logic:m3-clock',
  title: 'M3 clock',
  kind: 'instrument',
  defaults: {
    // QL acceptance walk 296, native readback (gates/acceptance-walk-296/native-evidence/stage-evaluate.json): steps 419, the second
    // turn at 59°, tick 1, governor #3-5-1-3, form 17 (TAT), aperture 2 (4°).
    'clock.degree720': 419, 'clock.tick12': 1, 'clock.backbone': '#3-5-1-3', 'aperture.index': 2, 'form.address': 17, 'form.codon': 'TAT',
    turn: 'both', open: 'closed', readout: 'governor', reciprocal: false, skin: 'wheel',
    // ql_m3_generate(complementary, 17): GC under CC, one codon, GCC.
    'law.matrix': 'complementary', 'law.seed': 'sum-difference-mod', 'law.poseMap': 'raw-bin',
    'generation.lower': 'GC', 'generation.upper': 'CC', 'generation.positive': 'GCC', 'generation.negative': 'GCC', 'generation.nonDual': true,
    // M3′'s rack, read from the M registry at revision c211a781 with the ledger's rungs; the parts carried as §22.3 names them.
    rack: RACK_M3, 'rack.part': '4',
    ...prefixed('binding.', BINDING_DEFAULTS) as Record<string, string | number | boolean>,
  },
  firstPage: 'wheel',
  fixtures: {
    'Second turn, 4° cut': {},
    // ql_m3_generate(moving-resting, 17): CT under CC, two codons, CCC and CTC.
    'Generation, moving and resting': {readout: 'generation', 'law.matrix': 'moving-resting', 'generation.lower': 'CT', 'generation.upper': 'CC',
      'generation.positive': 'CCC', 'generation.negative': 'CTC', 'generation.nonDual': false},
    'Twelve lenses, reciprocal': {'clock.degree720': 100, 'clock.backbone': '#3-5-2-0', 'clock.tick12': 3, 'aperture.index': 9, reciprocal: true, turn: 'first', readout: 'quadrant'},
    'Exploded, 15° × 24': {'clock.degree720': 359, 'clock.tick12': 11, 'clock.backbone': '#3-5-4-5', 'aperture.index': 7, open: 'exploded', turn: 'first', 'form.codon': 'ATG', readout: 'hexagram'},
    'The Binding skin: a meson': {skin: 'binding'},
    'The Binding skin: a singlet to the torus': {skin: 'binding', ...prefixed('binding.', {'pairing.matrix': 'complementary', 'cell.lower': 'GC', 'cell.nonDual': true, 'cell.positive': 'GCC',
      'cell.negative': 'GCC', 'values.positive': '[7,8,8]', 'values.negative': '[7,8,8]', 'charges.positive': '[23,-9,7,7]', 'charges.negative': '[23,-9,7,7]', 'string.stretch': 0,
      'string.energy': undefined, 'event.kind': 'inscription', 'event.what': 'Hexagram 17 inscribed'})},
    'A line change stretches the string': {skin: 'binding', ...prefixed('binding.', {'cell.hexagram': 23, 'cell.lower': 'TT', 'cell.positive': 'TCC', 'cell.negative': 'TTC',
      'values.positive': '[9,8,8]', 'values.negative': '[9,9,8]', 'charges.positive': '[25,-7,9,9]', 'charges.negative': '[26,-8,8,10]', 'charge.register': 'mm', 'string.stretch': 1.4,
      'string.energy': 1.176, 'event.kind': 'line', 'event.what': 'Line 5 of hexagram 7 changed'})},
    'No reading': {'clock.degree720': undefined, 'clock.tick12': undefined, 'clock.backbone': undefined, 'aperture.index': undefined, 'form.address': undefined, 'form.codon': undefined,
      'law.matrix': undefined, 'law.seed': undefined, 'law.poseMap': undefined, 'generation.lower': undefined, 'generation.upper': undefined, 'generation.positive': undefined,
      'generation.negative': undefined, 'generation.nonDual': undefined, rack: undefined, 'rack.part': undefined,
      ...prefixed('binding.', Object.fromEntries(Object.keys(BINDING_DEFAULTS).map(k => [k, undefined])))},
  },

  folded: p => { const s = readingOf(p.v)
    return <Folded title="M3 clock" light="unknown" readings={[s.deg === undefined ? NONE : `${s.deg}°`, s.ap === undefined ? NONE : cutWord(s.ap)]} onUnfold={p.nav.unfold} /> },

  compact: p => { const c = controls(p), s = readingOf(p.v), b = onBinding(p.v)
    return <Panel title="M3 clock" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        {b ? <Display w={140} h={146} label="The binding" does={FIELD_DOES}><BindingField v={bindingOf(p).v} w={140} h={146} small /></Display>
          : <Display w={140} h={146} label="The wheel" does={`${DISPLAY_DOES} Drag handle 1 for the position.`} corner={corner(s)}><Wheel p={p} w={140} h={146} handles={1} labels /></Display>}
      </Section>
      <Section label="Macros" cols={2}>{c.position}{c.turn}{c.show}{c.open}</Section>
    </Panel> },

  whole: p => { const c = controls(p), s = readingOf(p.v), w = wide(p) ? Math.round(clampTo(186, p.room!.h - 22, 186)) : 186, page = pageOf(p)
    return <Panel title="M3 clock" view="whole" {...head(p)} pages={PAGES} page={page} onPage={p.setPage}>
      {page === 'rack' ? <RackBands p={p} /> : page === 'binding' ? <BindingBands p={p} /> : <>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="The wheel" does={`${DISPLAY_DOES} Drag handle 1 for the position.`} corner={corner(s)}>
            <Wheel p={p} w={w} h={146} handles={2} labels />
          </Display>
        </Section>
        <Section label="Cut" cols={2} width={124}>{c.cut}{c.show}{c.turn}{c.open}</Section>
        <Section label="Law" grow>{c.matrix}{c.seed}{c.poseMap}</Section>
      </Band>
      <Band>
        <Section label="Position" width={152} cols={2}>{c.position}{c.readout}
          <Readout label="tick" does="The tick of the twelve steps of the clock." value={s.tick} tone="value" />
        </Section>
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
    if (onBinding(p.v)) { const b = bindingOf(p).v
      return <div className="ref-pane-body ref-pane-body--dark">
        <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The Binding skin">
          <g className="dp-display" style={{background: 'none', border: 'none'}}>
            <BindingField v={b} w={760} h={340} small={false} />
            {readingRows(b, true).map((r, i) => <g key={r.id} transform={`translate(${24 + (i % 2) * 360} ${360 + Math.floor(i / 2) * 26})`}>
              <text className="dp-axis">{r.note}</text><text x={84} className={r.light === 'unknown' ? 'dp-ink-dim' : 'dp-ink'}>{r.name}</text></g>)}
          </g>
        </svg>
      </div> }
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
