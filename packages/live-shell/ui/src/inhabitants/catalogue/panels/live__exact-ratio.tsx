// Exact-ratio tuning (manual §21.4): the device before the torus that gives every note an exact ratio, and shows how far each lies
// from the equal scale. Live's nearest: the tuning system Live loads into a set (a .ascl scale on the Tuning page), whose picture is
// each degree's offset in cents; drawn here round a ring, as Live's own Scale effect draws its classes. The display law: a ratio set
// stacks one generator from the reference note — fifths of 3:2, or whole tones of 9:8 — each step folded into the octave of 2:1;
// a note's error is 1200·log2(ratio) less the equal scale's 100 cents a semitone; the stack's two ends miss each other by the comma
// (twelve fifths, or six whole tones, overshoot seven octaves, or one, by 531441:524288), drawn as a gap unless you fold it in.
//
// Owners. The device has none yet: the note-device chain names it waiting (noteDevices.ts NOTE_DEVICES_WAITING, "waiting on its
// owner (exact-ratio tuning)"), so the reference, the ratio set, the comma, the readout and the export are the entry's own keys, and
// `reason` names the absence in the well. What the owners do state is keyed on their paths:
//   basis.chromatic, basis.fifths  the generator of each basis, 'num:den' (ql.music-modes/v1 `bases[].generator_ratio`): 9:8, 3:2.
//                                  The chromatic basis states one generator of 2 semitones and a conjugate axis of 1 semitone with
//                                  no ratio, so its stack gives the reference's whole-tone family and leaves the other family absent.
//   source.ratios                  the source ratios in force: [{name, num, den}] — the planets' just intervals (m2_sky.rs, the M2-5
//                                  map: Sun 1:1, Moon 4:3, Mercury 5:4, Venus 9:8, Mars 15:8, Jupiter 5:3, Saturn 3:2, Neptune 9:5,
//                                  Pluto 9:4; Uranus none).
import type {CSSProperties} from 'react'
import {Band, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {PITCH_CLASS_NAMES} from '../../../live/modes'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {HelixTorus, type HelixMark} from './live-helices'

type V = ViewProps['v']

// ---------------------------------------------------------------- vocabulary

const SETS = [
  {value: 'chromatic', label: 'Chromatic', does: 'Build the notes from whole tones of 9:8, the chromatic basis.'},
  {value: 'fifths', label: 'Fifths', does: 'Build the notes from fifths of 3:2, the fifths basis.'},
  {value: 'source', label: 'Source', does: 'Use the intervals of the source scale in force, such as the planets\' just intervals.'},
  {value: 'equal', label: 'Equal', does: 'Round every note to the equal scale.'},
] as const
const COMMAS = [{value: 'open', label: 'Open', does: 'Keep the gap that the stack leaves open, and show it.'},
  {value: 'fold', label: 'Fold', does: 'Fold the gap into the octave: the last step is narrowed by the comma.'}] as const
const READOUTS = [{value: 'ratio', label: 'Ratio', does: 'Show each note as a ratio from the reference.'},
  {value: 'cents', label: 'Cents', does: 'Show each note in cents from the reference.'},
  {value: 'hz', label: 'Hz', does: 'Show each note in hertz.'}] as const
const EXPORTS = [{value: 'exact', label: 'Exact', does: 'Send the exact ratios.'},
  {value: 'bend', label: 'Bend', does: 'Send the nearest note and a pitch bend.'},
  {value: 'mpe', label: 'MPE', does: 'Send each note on its own channel with its bend.'}] as const
const HZ = {min: 20, max: 2000, log: true} as const

// ---------------------------------------------------------------- exact ratios

type Ratio = readonly [number, number]
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
const reduce = ([n, d]: Ratio): Ratio => { const g = gcd(n, d) || 1; return [n / g, d / g] }
/** Fold a ratio into the octave [1, 2) by the octave of 2:1. */
const fold = ([n, d]: Ratio): Ratio => { let a = n, b = d; while (a < b) a *= 2; while (a >= 2 * b) b *= 2; return reduce([a, b]) }
const pow = ([n, d]: Ratio, k: number): Ratio => (k >= 0 ? [n ** k, d ** k] : [d ** -k, n ** -k])
const cents = ([n, d]: Ratio) => 1200 * Math.log2(n / d)
const ratioOf = (s: string | undefined): Ratio | undefined => { const m = /^(\d+):(\d+)$/.exec(s ?? ''); return m ? [Number(m[1]), Number(m[2])] : undefined }

interface Note {readonly ratio?: Ratio; readonly cents: number; readonly error: number; readonly name?: string}
/** The twelve notes from the reference, by the ratio set's law: index = semitones above the reference. A note the set gives no
 * ratio is absent. `gap`: where the stack's two ends meet and what they miss by. */
function tuningOf(v: V) {
  const set = strOf(v, 'ratioSet'), notes: (Note | undefined)[] = Array.from({length: 12}, () => undefined)
  let gap: {at: number; comma: Ratio} | undefined
  const stack = (g: Ratio | undefined, steps: number, from: number, to: number) => {
    if (!g) return
    for (let k = from; k <= to; k++) {
      const semis = ((steps * k) % 12 + 12) % 12, ratio = fold(pow(g, k)), c = cents(ratio)
      notes[semis] = {ratio, cents: c, error: c - 100 * semis - (semis === 0 && c > 600 ? 1200 : 0)}
    }
    const comma = fold(pow(g, to - from + 1))
    gap = {at: ((steps * from) % 12 + 12) % 12, comma}
  }
  if (set === 'fifths') stack(ratioOf(strOf(v, 'basis.fifths')), 7, -5, 6)
  else if (set === 'chromatic') stack(ratioOf(strOf(v, 'basis.chromatic')), 2, -2, 3)
  else if (set === 'equal') for (let s = 0; s < 12; s++) notes[s] = {cents: 100 * s, error: 0}
  else if (set === 'source') for (const e of json<unknown[]>(v, 'source.ratios', [])) {
    const r = e as {name?: unknown; num?: unknown; den?: unknown}
    if (!Number.isInteger(r?.num) || !Number.isInteger(r?.den) || (r.num as number) <= 0 || (r.den as number) <= 0) continue
    const ratio = fold([r.num as number, r.den as number]), c = cents(ratio), semis = Math.round(c / 100) % 12
    const name = typeof r.name === 'string' ? r.name : undefined
    notes[semis] = notes[semis] ? {...notes[semis]!, name: [notes[semis]!.name, name].filter(Boolean).join(' · ')} : {ratio, cents: c, error: c - 100 * semis, name}
  }
  const known = notes.filter((n): n is Note => n !== undefined)
  return {set, notes, gap, worst: known.length ? Math.max(...known.map(n => Math.abs(n.error))) : undefined}
}

const signed1 = (x: number) => `${x > 0.05 ? '+' : x < -0.05 ? '−' : ''}${Math.abs(x).toFixed(1)}`
/** A note in the readout chosen: ratio, cents from the reference, or hertz. */
function shownAs(v: V, n: Note | undefined, semis: number): string {
  if (!n) return NONE
  const how = strOf(v, 'readout'), hz = numOf(v, 'refHz')
  if (how === 'cents') return n.cents.toFixed(1)
  if (how === 'hz') return hz === undefined ? NONE : (hz * 2 ** (n.cents / 1200)).toFixed(1)
  return n.ratio ? `${n.ratio[0]}:${n.ratio[1]}` : `2^${semis}/12`
}

// ---------------------------------------------------------------- the pictures

const deg = (pc: number) => (-90 + pc * 30) * Math.PI / 180
const f1 = (x: number) => x.toFixed(1)
/** How far the ring moves a note for each cent it lies off the equal scale. */
const PER_CENT = .55

/** The ring: the equal scale as a circle, each note pushed out (sharp) or in (flat) by its error, its reading beside it. Handle 1 is
 * the reference note; handle 2, in the pool, the comma: drag it onto its note to fold the gap in, off it to keep the gap open. */
function RatioRing({p, w, h, handles, labels}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2; labels: boolean}) {
  const v = p.v, t = tuningOf(v), refN = numOf(v, 'refNote'), ref = refN !== undefined && Number.isInteger(refN) && refN >= 0 && refN < 12 ? refN : undefined
  // With readings, the ring is as large as its readings let it be: a ratio stands as a fraction, so the side ones need 14 px.
  const cx = w / 2, cy = h / 2 + (labels ? 4 : 0), r = labels ? Math.min(w / 2 - 30, h / 2 - 33) : Math.min(w, h) / 2 - 6
  const at = (pc: number, rad: number, extraCents = 0) => { const a = deg(pc + extraCents / 100); return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)] as const }
  const showErr = boolOf(v, 'error') !== false, refSt = st(p, 'refNote'), commaSt = st(p, 'comma'), folded = strOf(v, 'comma') === 'fold'
  const reason = strOf(v, 'reason')
  return <g>
    <circle cx={cx} cy={cy} r={r} className="dp-faint" />
    {labels && <circle cx={cx} cy={cy} r={r + 10 * PER_CENT * 2} className="dp-grid" strokeDasharray="1 3" />}
    {ref !== undefined && t.notes.map((n, semis) => {
      const pc = (ref + semis) % 12, rad = r + clampTo(-18, 18, (n?.error ?? 0) * PER_CENT), [x, y] = at(pc, rad), [ex, ey] = at(pc, r)
      return <g key={semis}>
        {n && showErr && Math.abs(n.error) > .05 && <path d={`M${f1(ex)} ${f1(ey)}L${f1(x)} ${f1(y)}`} className="dp-curve" />}
        <circle cx={x} cy={y} r={labels ? 3.4 : 2.4} fill={n ? 'var(--dp-value)' : 'var(--dp-well)'} stroke={n ? 'var(--dp-value)' : 'var(--dp-value-dim)'} strokeWidth={1.1} />
      </g>
    })}
    {/* the comma: the gap the stack's two ends leave, or, folded, the last step narrowed */}
    {ref !== undefined && t.gap && (() => {
      const pc = (ref + t.gap.at) % 12, c = cents(t.gap.comma), [gx, gy] = at(pc, r + 7, c), [nx, ny] = at(pc, r + 7)
      return <g>
        {!folded && <path d={`M${f1(nx)} ${f1(ny)}A${r + 7} ${r + 7} 0 0 1 ${f1(gx)} ${f1(gy)}`} className="dp-curve-on" strokeDasharray="2 2" />}
        {folded && <path d={`M${f1(at(pc, r + 5)[0])} ${f1(at(pc, r + 5)[1])}L${f1(at(pc, r + 13)[0])} ${f1(at(pc, r + 13)[1])}`} className="dp-curve-on" strokeWidth={2} />}
        {handles >= 2 && <Handle n={2} x={folded ? nx : gx} y={folded ? ny : gy} label="Comma" shape="square"
          does={commaSt.disabled ? `Drag onto its note to fold the gap in; off it to keep it open. ${commaSt.disabled}` : 'Drag onto its note to fold the gap in; off it to keep it open.'}
          onDrag={commaSt.disabled ? undefined : (x, y) => { const next = Math.hypot(x - nx, y - ny) < 4 ? 'fold' : 'open'; if (next !== strOf(v, 'comma')) p.set('comma', next) }}
          onReset={commaSt.disabled ? undefined : () => p.set('comma', 'open')} />}
      </g>
    })()}
    {labels && PITCH_CLASS_NAMES.map((name, pc) => {
      const semis = ref === undefined ? undefined : (pc - ref + 12) % 12, n = semis === undefined ? undefined : t.notes[semis]
      // The reading leans out from the ring: anchored at its near end, so it never runs back over the ring or out of the well.
      // The reading leans out from its point: anchored at its near end, so it never runs back over the ring.
      const side = Math.cos(deg(pc)), [lx, ly] = at(pc, r - 9), [ox, oy] = at(pc, r + 8 + (n && showErr ? clampTo(0, 18, n.error * PER_CENT) : 0)), anchor = side > .3 ? 'start' : side < -.3 ? 'end' : 'middle'
      const lift = Math.sin(deg(pc)) < -.8 ? -2 : Math.sin(deg(pc)) > .8 ? 7 : 3
      return <g key={pc}>
        <text x={lx} y={ly + 3} textAnchor="middle" className={n ? 'dp-ink' : 'dp-axis'} style={{fontSize: 7.5}}>{name}</text>
        {semis !== undefined && <Reading v={v} n={n} semis={semis} x={ox} y={oy + lift} anchor={anchor} />}
      </g>
    })}
    {ref === undefined ? <text x={cx} y={cy + 3} textAnchor="middle" className="dp-ink-dim">{NONE}</text>
      : <text x={cx} y={cy + 3} textAnchor="middle" className="dp-ink" style={{fontSize: labels ? 11 : 9}}>{PITCH_CLASS_NAMES[ref]}</text>}
    {labels && <text x={4} y={11} className="dp-ink-dim">{reason ?? (ref === undefined ? 'No reference note' : t.set === undefined ? 'No ratio set' : !t.notes.some(Boolean) ? 'No ratios in this set' : `worst ${t.worst!.toFixed(1)} c`)}</text>}
    {handles >= 1 && ref !== undefined && <Handle n={1} shape="ring" x={at(ref, r)[0]} y={at(ref, r)[1]} label="Reference note"
      does={refSt.disabled ? `Drag round the ring: the note that has the reference frequency. ${refSt.disabled}` : 'Drag round the ring: the note that has the reference frequency.'}
      onDrag={refSt.disabled ? undefined : (x, y) => { const pc = (Math.round(Math.atan2(y - cy, x - cx) * 180 / Math.PI / 30 + 3) % 12 + 12) % 12; if (pc !== ref) p.set('refNote', pc) }}
      onReset={refSt.disabled ? undefined : () => p.set('refNote', 9)} />}
  </g>
}

/** One note's reading beside the ring, in the readout chosen: a ratio as a fraction, numerator over denominator, so the widest
 * ratio stays narrow; cents or hertz on one line. */
function Reading({v, n, semis, x, y, anchor}: {v: V; n: Note | undefined; semis: number; x: number; y: number; anchor: 'start' | 'end' | 'middle'}) {
  const fill = n ? 'var(--dp-value)' : undefined
  if (strOf(v, 'readout') === 'ratio' && n?.ratio) {
    const [num, den] = n.ratio, half = Math.max(String(num).length, String(den).length) * 2, mx = anchor === 'start' ? x + half : anchor === 'end' ? x - half : x
    const my = anchor === 'middle' ? (y < 40 ? y - 5 : y - 2) : y - 3
    return <g style={{fill}} className="dp-axis">
      <text x={mx} y={my} textAnchor="middle" className="dp-axis" style={{fontSize: 7, fill}}>{num}</text>
      <path d={`M${f1(mx - half)} ${f1(my + 1.5)}H${f1(mx + half)}`} stroke="var(--dp-value-dim)" strokeWidth={.8} />
      <text x={mx} y={my + 8} textAnchor="middle" className="dp-axis" style={{fontSize: 7, fill}}>{den}</text>
    </g>
  }
  return <text x={x} y={y} textAnchor={anchor} className="dp-axis" style={{fontSize: 7, fill}}>{shownAs(v, n, semis)}</text>
}

/** The error strip: one column a note from the reference, its bar from the equal scale to its ratio, its cents above or below. */
function ErrorStrip({v, w, h}: {v: V; w: number; h: number}) {
  const t = tuningOf(v), refN = numOf(v, 'refNote'), x0 = 22, step = (w - x0 - 6) / 12, wideLabels = step >= 30
  // Wide, a row of readings stands over the names: the scale gives up its foot to it.
  const mid = h / 2 - (wideLabels ? 9 : 4), span = 30, scale = (h / 2 - (wideLabels ? 28 : 22)) / span
  const y = (c: number) => mid - clampTo(-span, span, c) * scale
  return <g>
    {[-30, -15, 0, 15, 30].map(c => <g key={c}><path d={`M${x0} ${f1(y(c))}H${w - 4}`} className={c ? 'dp-grid' : 'dp-faint'} />
      <text x={x0 - 3} y={y(c) + 3} textAnchor="end" className="dp-axis">{c > 0 ? `+${c}` : c === 0 ? '0' : `−${-c}`}</text></g>)}
    {t.notes.map((n, semis) => {
      const x = x0 + step * (semis + .5), pc = refN === undefined ? undefined : (refN + semis) % 12
      return <g key={semis}>
        {n && Math.abs(n.error) > .05 && <rect x={x - Math.min(5, step * .3)} width={Math.min(10, step * .6)} y={Math.min(y(0), y(n.error))} height={Math.abs(y(n.error) - y(0))} className="dp-fill" stroke="var(--dp-value)" strokeWidth={1} />}
        {n && <circle cx={x} cy={y(n.error)} r={2} fill="var(--dp-value)" />}
        {!n && <text x={x} y={mid + 3} textAnchor="middle" className="dp-axis">—</text>}
        <text x={x} y={h - 6} textAnchor="middle" className="dp-axis">{pc === undefined ? semis : PITCH_CLASS_NAMES[pc]}</text>
        {wideLabels && <text x={x} y={h - 17} textAnchor="middle" className="dp-axis" style={{fill: n ? 'var(--dp-value)' : undefined}}>{shownAs(v, n, semis)}</text>}
        {n && <text x={x} y={n.error >= 0 ? y(n.error) - 5 : y(n.error) + 10} textAnchor="middle" className="dp-axis" style={{fill: 'var(--dp-value)'}}>{signed1(n.error)}</text>}
      </g>
    })}
  </g>
}

// ---------------------------------------------------------------- the parts the views share

const lightOf = (p: ViewProps): LightState => { const l = strOf(p.owner ?? p.v, 'light'); return l === 'lit' || l === 'dark' ? l : 'unknown' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'light').disabled ?? (has(p.v, 'light') ? undefined : 'No reading of on or off: the device waits on its owner.'),
  onFold: p.nav.fold, onFull: p.nav.full, onLight: () => p.set('light', lightOf(p) === 'lit' ? 'dark' : 'lit')})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const refWord = (v: V) => { const n = numOf(v, 'refNote'), hz = numOf(v, 'refHz'); return n === undefined ? NONE : `${PITCH_CLASS_NAMES[n] ?? NONE} ${hz === undefined ? NONE : Math.round(hz)}` }
const setWord = (v: V) => SETS.find(s => s.value === strOf(v, 'ratioSet'))?.label
const RING_DOES = 'The equal scale as a circle. A note stands out when it is sharp of it and in when flat, by its cents. The dashed amber arc is the comma.'

function controls(p: ViewProps) {
  const v = p.v
  return {
    note: <Dial {...st(p, 'refNote')} label="Note" does="The note that has the reference frequency." value={numOf(v, 'refNote') ?? NaN} def={9}
      scale={{min: 0, max: 11, step: 1}} format={x => PITCH_CLASS_NAMES[x] ?? NONE} onChange={x => p.set('refNote', x)} />,
    hz: <Dial {...st(p, 'refHz')} label="Frequency" does="The frequency of the reference note." value={numOf(v, 'refHz') ?? NaN} def={440} scale={HZ}
      format={x => `${x < 100 ? x.toFixed(1) : Math.round(x)} Hz`} onChange={x => p.set('refHz', Math.round(x * 10) / 10)} />,
    set: <Radio {...st(p, 'ratioSet')} label="Ratio set" does="How the twelve notes get their ratios." value={strOf(v, 'ratioSet') ?? ''} options={SETS} stack onChange={x => p.set('ratioSet', x)} />,
    comma: <Radio {...st(p, 'comma')} label="Comma" does="The gap that the stack leaves: keep it open and see it, or fold it into the octave." value={strOf(v, 'comma') ?? ''} options={COMMAS} stack
      onChange={x => p.set('comma', x)} />,
    readout: <Radio {...st(p, 'readout')} label="Readout" does="How a note's tuning shows." value={strOf(v, 'readout') ?? ''} options={READOUTS} stack onChange={x => p.set('readout', x)} />,
    error: <Toggle {...st(p, 'error')} label="Error" does="Show how far each note is from the equal scale, in cents." on={boolOf(v, 'error') === true} unknown={boolOf(v, 'error') === undefined}
      onChange={x => p.set('error', x)} />,
    export: <Radio {...st(p, 'export')} label="Export" does="How tuning leaves the device to MIDI." value={strOf(v, 'export') ?? ''} options={EXPORTS} stack onChange={x => p.set('export', x)} />,
    bend: <ValueBox {...st(p, 'bendRange')} label="Bend range" does="The range of the pitch bend for the Bend and MPE exports, in semitones." value={numOf(v, 'bendRange') ?? NaN} def={2}
      scale={{min: 0, max: 48, step: 1}} format={x => `${x} st`} onChange={x => p.set('bendRange', x)}
      disabled={st(p, 'bendRange').disabled ?? (strOf(v, 'export') === 'exact' ? 'Exact ratios carry no bend.' : undefined)} />,
  }
}

export const design: DesignedDevice = {
  id: 'live:exact-ratio',
  title: 'Exact-ratio tuning',
  kind: 'effect',
  firstPage: 'tuning',
  defaults: {
    light: 'lit', refNote: 9, refHz: 440, ratioSet: 'fifths', comma: 'open', readout: 'ratio', error: true, export: 'exact', bendRange: 2,
    // ql.music-modes/v1 `bases`: the generator of each basis, as the owner states it.
    'basis.chromatic': '9:8', 'basis.fifths': '3:2',
    // The M2-5 map (m2_sky.rs): each planet's just interval from the root. Uranus has none.
    'source.ratios': JSON.stringify([{name: 'Sun', num: 1, den: 1}, {name: 'Moon', num: 4, den: 3}, {name: 'Mercury', num: 5, den: 4}, {name: 'Venus', num: 9, den: 8},
      {name: 'Mars', num: 15, den: 8}, {name: 'Jupiter', num: 5, den: 3}, {name: 'Saturn', num: 3, den: 2}, {name: 'Neptune', num: 9, den: 5}, {name: 'Pluto', num: 9, den: 4}]),
  },
  fixtures: {
    'Fifths from A 440': {},
    'Whole tones, folded, in cents': {ratioSet: 'chromatic', comma: 'fold', readout: 'cents', refNote: 0, refHz: 261.6},
    'The planets\' intervals': {ratioSet: 'source', refNote: 0, refHz: 256, readout: 'hz', export: 'mpe', bendRange: 48},
    'As the owners have it': {light: undefined, refNote: undefined, refHz: undefined, ratioSet: undefined, comma: undefined, readout: undefined, error: undefined,
      export: undefined, bendRange: undefined, reason: 'No tuning owner'},
  },

  folded: p => <Folded title="Exact ratio" light={lightOf(p)} readings={[refWord(p.v), setWord(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => {
    const c = controls(p), t = tuningOf(p.v)
    return <Panel title="Exact-ratio tuning" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The ratios" does={`${RING_DOES} Drag handle 1 to set the reference note.`} corner={t.gap ? `${cents(t.gap.comma).toFixed(1)} c` : NONE}>
          <RatioRing p={p} w={140} h={146} handles={1} labels />
        </Display>
      </Section>
      <Section label="Macros" cols={2} width={140}>{c.hz}{c.set}{c.comma}{c.readout}</Section>
    </Panel>
  },

  whole: p => {
    const c = controls(p), t = tuningOf(p.v), big = wide(p)
    // Wider than the pool, the error strip takes the room: a wide column carries the reading beside the error.
    const w = 186, strip = big ? Math.round(clampTo(186, p.room!.w - 760, 440)) : 186
    return <Panel title="Exact-ratio tuning" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="The ratios" does={`${RING_DOES} Drag handle 1 for the reference note and handle 2 for the comma.`}
            corner={t.gap ? `${cents(t.gap.comma).toFixed(1)} c` : NONE}>
            <RatioRing p={p} w={w} h={146} handles={2} labels />
          </Display>
        </Section>
        <Section label="Reference" width={76}>{c.note}{c.hz}
          <Readout label="octave" does="The ratio of the octave. It is fixed." value="2:1" />
        </Section>
        <Section label="Ratios" grow>{c.set}{c.comma}</Section>
      </Band>
      <Band>
        <Section width={strip + 12}>
          <Display w={strip} h={146} label="Error" does="Each note's distance from the equal scale, in cents, from the reference note up." corner={t.worst === undefined ? NONE : `±${t.worst.toFixed(1)}`}>
            <ErrorStrip v={p.v} w={strip} h={146} />
          </Display>
        </Section>
        <Section label="Show" width={76}>{c.readout}{c.error}</Section>
        <Section label="Export" grow>{c.export}{c.bend}</Section>
      </Band>
    </Panel>
  },

  full: p => {
    const v = p.v, t = tuningOf(v), ref = numOf(v, 'refNote')
    const marks: HelixMark[] = PITCH_CLASS_NAMES.map((name, pc) => {
      const semis = ref === undefined ? undefined : (pc - ref + 12) % 12, n = semis === undefined ? undefined : t.notes[semis]
      return {name, lit: ref === undefined ? null : !!n, note: n && semis !== undefined ? `${shownAs(v, n, semis)}  ${signed1(n.error)} c` : NONE,
        noteTone: n ? (Math.abs(n.error) < 5 ? 'value' : 'on') : 'dim'}
    })
    const lines = [`${refWord(v)} Hz · ${setWord(v) ?? NONE}${t.gap ? ` · comma ${t.gap.comma[0]}:${t.gap.comma[1]}, ${cents(t.gap.comma).toFixed(2)} c ${strOf(v, 'comma') === 'fold' ? 'folded in' : 'open'}` : ''}`,
      strOf(v, 'reason') ?? (t.worst === undefined ? 'No ratios' : `Worst error ${t.worst.toFixed(1)} c`)]
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The ratios on the torus">
        <g className="dp-display" style={{background: 'none'}}>
          <HelixTorus w={760} h={420} marks={marks} root={ref} caption={lines} />
        </g>
      </svg>
    </div>
  },

  widget: p => {
    const v = p.v, t = tuningOf(v), ref = numOf(v, 'refNote')
    const items: RowItem[] = t.notes.map((n, semis) => ({id: String(semis), name: ref === undefined ? String(semis) : PITCH_CLASS_NAMES[(ref + semis) % 12]!,
      light: n ? 'lit' : 'unknown', tone: 'value', note: shownAs(v, n, semis), does: n ? `${signed1(n.error)} cents from the equal scale. Press to open the device in the pane.` : 'No ratio in this set.'}))
    return <Tile title="Exact-ratio" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <div className="ref-tile-side" style={{flex: '0 0 64px'} as CSSProperties}>
        <Readout big label="reference" does="The reference note and its frequency." value={ref === undefined ? undefined : PITCH_CLASS_NAMES[ref]} tone="value" />
        <Readout label="Hz" does="The reference frequency." value={numOf(v, 'refHz')} />
        <Readout label="set" does="How the notes get their ratios." value={setWord(v)} />
      </div>
      <Rows does="Each note from the reference with its ratio. Press one to open the device in the pane that has focus." items={items} columns={2} size={12} onSelect={() => p.nav.full?.()} />
    </Tile>
  },
}
