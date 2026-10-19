// Binding (manual §22.8, quaternal-logic:binding): M3's charge-bearing units drawn as colour charges bound by flux tubes, to see
// which codons a matrix holds together and how hard. Live's nearest: a physical-modelling instrument whose display is its model
// (Collision's resonators). The kernel gives the symbols; the device runs its own physics over them and claims no measured constant.
//   - A codon is a three-way junction: its three sites on three arms 120° apart, coloured by place (the positive codon red, green,
//     blue; the negative its anticolours), the Y turned by its leading pair's index × 22.5° (the fold grammar's hinge).
//   - Pairing is the matrix: at the form's hexagram the matrix's generation cell gives a positive codon (a·c·d) and a negative one
//     (a·b·d); the two are tied as a meson. When the cell is non-dual (b = c) they are one codon, a singlet, handed to the torus.
//   - The Charge register picks which of the codon's four charges (pp, mm, mp, pm) each junction carries.
//   - Nonets: nine M2 positions resolving into eight M3 positions, by the kernel's 9:8 compression; the two that land together are
//     marked. Whether that collision is the singlet is for the instrument to test, so the display does not join them.
//   - String tension σ and the coupling scale are the device's physics, tunable; its engine reports the coupling, the string's
//     stretch and its energy by V(r) = −(4/3)·α_s·ħc/r + σr. Every motion is caused by a kernel event (an inscription, a matrix
//     transform, a line change), never by chance; with Stretch → Q on, the stretch sounds as the Resonance's Q through M2.
//
// Owners, and the keys on their paths:
//   binding.on        the device
//   pairing.matrix    'complementary' | 'moving-resting' | 'same-quality'     charge.register  'pp' | 'mm' | 'mp' | 'pm'
//   nonets.show       draw the nonet                                          skin  'torus' | 'plate' | 'clock'
//   string.tension    σ, 0.1..2 GeV/fm (0.9)    coupling.scale  Q, 0.3..10 GeV (1)    sound.stretchQ  the stretch sounds as Resonance Q
// Readings (the kernel's cell and the engine's state):
//   cell.hexagram, cell.lower, cell.upper, cell.nonDual, cell.positive, cell.negative (codons), values.positive, values.negative
//   (the sites' coin values, JSON), charges.positive, charges.negative (JSON [pp, mm, mp, pm]); m2.index and nonet (JSON [{m2, m3}]);
//   coupling.alpha, string.stretch (fm), string.energy (GeV); event.kind ('inscription' | 'matrix' | 'line'), event.what
import {Band, Chooser, Dial, Display, Folded, Panel, Radio, Readout, Rows, Section, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, boolOf, clampTo, fixed, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
type Register = 'pp' | 'mm' | 'mp' | 'pm'
const REGISTERS: readonly Register[] = ['pp', 'mm', 'mp', 'pm']
const MATRICES = [{value: 'complementary', label: 'Compl.', does: 'Complementary: A with T, C with G.'}, {value: 'moving-resting', label: 'Mov./rest.', does: 'Moving and resting: A with G, T with C.'},
  {value: 'same-quality', label: 'Same q.', does: 'Same quality: A with C, T with G.'}] as const
const REGISTER_OPTIONS = REGISTERS.map(r => ({value: r, label: r, does: `Each junction carries its ${r} charge.`}))
const SKINS = [{value: 'torus', label: 'Torus', does: 'The binding drawn on the Torus.'}, {value: 'plate', label: 'Plate', does: 'The binding drawn on this plate.'},
  {value: 'clock', label: 'Clock', does: 'The binding drawn on the M3 clock.'}] as const
const EVENTS: Record<string, string> = {inscription: 'an inscription', matrix: 'a matrix transform', line: 'a line change'}
const EVENT_WORD: Record<string, string> = {inscription: 'Inscription', matrix: 'Matrix change', line: 'Line change'}
const BASES = 'ATCG', HBARC = .197327
const COLOUR = ['hsl(2 78% 60%)', 'hsl(128 55% 52%)', 'hsl(218 80% 64%)'], ANTI = ['hsl(182 70% 55%)', 'hsl(302 62% 64%)', 'hsl(52 85% 58%)']

const codonOf = (v: V, key: string) => { const c = strOf(v, key); return c !== undefined && /^[ATCG]{3}$/.test(c) ? c : undefined }
const listOf = (v: V, key: string, n: number) => { const a = json<unknown>(v, key, undefined); return Array.isArray(a) && a.length === n && a.every(x => typeof x === 'number') ? a as number[] : undefined }
const registerOf = (v: V): Register | undefined => { const r = strOf(v, 'charge.register'); return REGISTERS.includes(r as Register) ? r as Register : undefined }
const chargeOf = (v: V, side: 'positive' | 'negative') => { const c = listOf(v, `charges.${side}`, 4), r = registerOf(v); return c && r ? c[REGISTERS.indexOf(r)] : undefined }
/** The fold grammar's hinge: the codon's leading pair (its first two sites) as an index 0..15, × 22.5°. */
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

/** The kernel's 9:8 compression for the block: nine M2 positions over eight M3 positions, the colliding two marked. */
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

/** The binding: a meson (the cell's two codons, colour and anticolour, tied by a tube) or a singlet handed to the torus. */
function Field({v, w, h, small}: {v: V; w: number; h: number; small: boolean}) {
  const pos = codonOf(v, 'cell.positive'), neg = codonOf(v, 'cell.negative'), one = boolOf(v, 'cell.nonDual')
  if (!pos || !neg || one === undefined) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{w > 100 ? 'No cell from the kernel' : NONE}</text>
  const nonet = !small && boolOf(v, 'nonets.show') === true, nw = Math.round(clampTo(100, 200, w * .22)), fw = nonet ? w - nw - 16 : w, cy = h / 2 - (small ? 0 : 6), arm = Math.min(fw, h) * (small ? .16 : .17)
  const sigma = numOf(v, 'string.tension') ?? .9, stretch = numOf(v, 'string.stretch'), tube = 1.5 + 4 * clampTo(0, 1, sigma / 2)
  const vp = listOf(v, 'values.positive', 3), vn = listOf(v, 'values.negative', 3)
  if (one) return <g>
    <circle cx={fw / 2} cy={cy} r={arm + (small ? 8 : 16)} fill="none" stroke="var(--dp-value-dim)" strokeDasharray="3 3" />
    <Junction x={fw / 2} y={cy} arm={arm} codon={pos} values={vp} anti={false} charge={chargeOf(v, 'positive')} small={small} />
    {!small && <text x={fw / 2} y={cy - arm - 22} textAnchor="middle" className="dp-axis" style={{fontSize: 9}}>{pos} · non-dual: a singlet, +1 to the torus</text>}
    {nonet && <Nonet v={v} x={fw + 8} y={cy - 14} w={nw} />}
  </g>
  const half = clampTo(arm * 1.4, fw / 2 - arm - 10, (stretch ?? .8) * fw * .28), x1 = fw / 2 - half, x2 = fw / 2 + half
  return <g>
    <path d={`M${x1.toFixed(1)} ${cy}L${x2.toFixed(1)} ${cy}`} stroke="var(--dp-on)" strokeWidth={tube} opacity={.35} strokeLinecap="round" />
    <path d={`M${x1.toFixed(1)} ${cy}L${x2.toFixed(1)} ${cy}`} stroke="var(--dp-on)" strokeWidth={.8} />
    <Junction x={x1} y={cy} arm={arm} codon={pos} values={vp} anti={false} charge={chargeOf(v, 'positive')} small={small} />
    <Junction x={x2} y={cy} arm={arm} codon={neg} values={vn} anti charge={chargeOf(v, 'negative')} small={small} />
    {!small && <text x={fw / 2} y={cy - arm - 22} textAnchor="middle" className="dp-axis" style={{fontSize: 9}}>{pos} + {neg} · a meson{stretch === undefined ? '' : ` · ${fixed(2)(stretch)} fm`}</text>}
    {nonet && <Nonet v={v} x={fw + 8} y={cy - 14} w={nw} />}
  </g>
}

/** The device's potential over the string's length, with the engine's stretch marked. */
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

const lightOf = (p: ViewProps): LightState => { const on = boolOf(p.owner ?? p.v, 'binding.on'); return on === undefined ? 'unknown' : on ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'binding.on').disabled, onFold: p.nav.fold, onFull: p.nav.full, onLight: () => p.set('binding.on', !(boolOf(p.v, 'binding.on') === true))})
const FIELD_DOES = "The cell's codons as colour charges: a meson when the matrix gives two, a singlet to the torus when it gives one."
const cellWord = (v: V) => { const pos = codonOf(v, 'cell.positive'), neg = codonOf(v, 'cell.negative'), one = boolOf(v, 'cell.nonDual')
  return !pos || !neg || one === undefined ? undefined : one ? `${pos} · singlet` : `${pos} + ${neg}` }
const sideWord = (v: V, side: 'positive' | 'negative') => { const c = codonOf(v, `cell.${side}`), q = chargeOf(v, side), r = registerOf(v)
  return c === undefined ? NONE : q === undefined || r === undefined ? c : `${c} · ${r} ${signedWord(q)}` }
const eventWord = (v: V) => { const k = strOf(v, 'event.kind'), what = strOf(v, 'event.what'); return k === undefined || !(k in EVENTS) ? NONE : what ?? EVENTS[k]! }

function controls(p: ViewProps) {
  const v = p.v
  return {
    matrix: <Radio {...st(p, 'pairing.matrix')} label="Matrix" does="The matrix whose cell gives the two codons." value={strOf(v, 'pairing.matrix') ?? ''} options={MATRICES} onChange={x => p.set('pairing.matrix', x)} stack />,
    matrixChooser: <Chooser {...st(p, 'pairing.matrix')} label="Pairing" does="The matrix whose cell gives the two codons." value={strOf(v, 'pairing.matrix') ?? ''} options={MATRICES} onChange={x => p.set('pairing.matrix', x)} />,
    register: <Radio {...st(p, 'charge.register')} label="Register" does="Which of the codon's four charges each junction carries." value={registerOf(v) ?? ''} options={REGISTER_OPTIONS} onChange={x => p.set('charge.register', x)} />,
    registerChooser: <Chooser {...st(p, 'charge.register')} label="Charge" does="Which of the codon's four charges each junction carries." value={registerOf(v) ?? ''} options={REGISTER_OPTIONS} onChange={x => p.set('charge.register', x)} />,
    tension: <Dial {...st(p, 'string.tension')} label="Tension" does="σ, the string's tension: the device's physics, tunable." value={numOf(v, 'string.tension') ?? NaN} def={.9} scale={{min: .1, max: 2}} format={x => `${fixed(2)(x)} GeV/fm`} onChange={x => p.set('string.tension', Math.round(x * 100) / 100)} />,
    coupling: <Dial {...st(p, 'coupling.scale')} label="Coupling" does="The scale the coupling runs at: the device's physics, tunable." value={numOf(v, 'coupling.scale') ?? NaN} def={1} scale={{min: .3, max: 10, log: true}} format={x => `${fixed(x < 1 ? 2 : 1)(x)} GeV`} onChange={x => p.set('coupling.scale', Math.round(x * 100) / 100)} />,
    skin: <Radio {...st(p, 'skin')} label="Drawn on" does="Where the binding is drawn." value={strOf(v, 'skin') ?? ''} options={SKINS} onChange={x => p.set('skin', x)} />,
    nonets: <Toggle {...st(p, 'nonets.show')} label="Nonets" does="Draw the nine M2 positions resolving into eight M3 positions." on={boolOf(v, 'nonets.show') === true} unknown={boolOf(v, 'nonets.show') === undefined} onChange={x => p.set('nonets.show', x)} />,
    sound: <Toggle {...st(p, 'sound.stretchQ')} label="Stretch → Q" does="The string's stretch sounds as the Resonance's Q, through M2." on={boolOf(v, 'sound.stretchQ') === true} unknown={boolOf(v, 'sound.stretchQ') === undefined} onChange={x => p.set('sound.stretchQ', x)} />,
  }
}

/** The kernel's cell and the event behind the last motion, as rows: what it is at the left, where it comes from at the right. `full`
 * names the event in its own words; a row on the plate names its kind. */
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
const physics = (v: V) => [
  <Readout key="a" label="α_s" does="The coupling at the chosen scale, from the device's engine." value={numOf(v, 'coupling.alpha') === undefined ? NONE : fixed(3)(numOf(v, 'coupling.alpha')!)} />,
  <Readout key="e" label="Energy" does="The string's energy at its stretch, from the device's engine." value={numOf(v, 'string.energy') === undefined ? NONE : `${fixed(2)(numOf(v, 'string.energy')!)} GeV`} />,
]

export const design: DesignedDevice = {
  id: 'quaternal-logic:binding',
  title: 'Binding',
  kind: 'instrument',
  defaults: {
    'binding.on': true, 'pairing.matrix': 'moving-resting', 'charge.register': 'pp', 'nonets.show': true, skin: 'plate', 'sound.stretchQ': true,
    'string.tension': .9, 'coupling.scale': 1,
    // ql_m3_generate(1, 17) and ql_m3_codon on main (61c0e16): CT under CC gives CCC and CTC.
    'cell.hexagram': 17, 'cell.lower': 'CT', 'cell.upper': 'CC', 'cell.nonDual': false, 'cell.positive': 'CCC', 'cell.negative': 'CTC',
    'values.positive': '[8,8,8]', 'values.negative': '[8,9,8]', 'charges.positive': '[24,-8,8,8]', 'charges.negative': '[25,-9,7,9]',
    // ql_m3_epogdoon over M2 36..44.
    'm2.index': 37, nonet: JSON.stringify([{m2: 36, m3: 32}, {m2: 37, m3: 32}, {m2: 38, m3: 33}, {m2: 39, m3: 34}, {m2: 40, m3: 35}, {m2: 41, m3: 36}, {m2: 42, m3: 37}, {m2: 43, m3: 38}, {m2: 44, m3: 39}]),
    // The device's engine at Q = 1 GeV, σ = 0.9, the string at 0.8 fm.
    'coupling.alpha': .447, 'string.stretch': .8, 'string.energy': .573,
    'event.kind': 'matrix', 'event.what': 'Complementary to moving and resting',
  },
  fixtures: {
    'Moving and resting: a meson': {},
    'Complementary: a singlet to the torus': {'pairing.matrix': 'complementary', 'cell.lower': 'GC', 'cell.nonDual': true, 'cell.positive': 'GCC', 'cell.negative': 'GCC',
      'values.positive': '[7,8,8]', 'values.negative': '[7,8,8]', 'charges.positive': '[23,-9,7,7]', 'charges.negative': '[23,-9,7,7]', 'string.stretch': 0, 'string.energy': undefined,
      'event.kind': 'inscription', 'event.what': 'Hexagram 17 inscribed'},
    'A line change stretches the string': {'cell.hexagram': 23, 'cell.lower': 'TT', 'cell.positive': 'TCC', 'cell.negative': 'TTC', 'values.positive': '[9,8,8]', 'values.negative': '[9,9,8]',
      'charges.positive': '[25,-7,9,9]', 'charges.negative': '[26,-8,8,10]', 'charge.register': 'mm', 'string.stretch': 1.4, 'string.energy': 1.176,
      'event.kind': 'line', 'event.what': 'Line 5 of hexagram 7 changed'},
    'Slack string': {'string.tension': .3, 'string.energy': .093, 'nonets.show': false},
    'No readings': {'binding.on': undefined, 'pairing.matrix': undefined, 'charge.register': undefined, 'nonets.show': undefined, skin: undefined, 'sound.stretchQ': undefined,
      'string.tension': undefined, 'coupling.scale': undefined, 'cell.hexagram': undefined, 'cell.lower': undefined, 'cell.upper': undefined, 'cell.nonDual': undefined,
      'cell.positive': undefined, 'cell.negative': undefined, 'values.positive': undefined, 'values.negative': undefined, 'charges.positive': undefined, 'charges.negative': undefined,
      'm2.index': undefined, nonet: undefined, 'coupling.alpha': undefined, 'string.stretch': undefined, 'string.energy': undefined, 'event.kind': undefined, 'event.what': undefined},
  },

  folded: p => <Folded title="Binding" light={lightOf(p)} readings={[cellWord(p.v) ?? NONE, eventWord(p.v)]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Binding" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}><Display w={140} h={146} label="The binding" does={FIELD_DOES}><Field v={p.v} w={140} h={146} small /></Display></Section>
      <Section label="Macros" cols={2}>{c.matrixChooser}{c.registerChooser}{c.tension}{c.coupling}</Section>
    </Panel> },

  whole: p => { const c = controls(p), wide = (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined, w = wide ? Math.round(clampTo(220, p.room!.w - 620, 420)) : 220
    return <Panel title="Binding" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}><Display w={w} h={146} label="The binding" does={FIELD_DOES}><Field v={p.v} w={w} h={146} small={false} /></Display></Section>
        <Section label="Pairing" width={96}>{c.matrix}</Section>
        <Section label="Physics" cols={2} width={124}>{c.tension}{c.coupling}{physics(p.v)}</Section>
        <Section label="Charge and skin" width={150}>{c.register}{c.skin}{c.nonets}{c.sound}</Section>
        <Section width={104}><Display w={92} h={70} label="Potential" does="V(r) = −(4/3)·α_s·ħc/r + σr over the string's length, the engine's stretch marked."><Potential v={p.v} w={92} h={70} /></Display></Section>
        <Section label="Reading" grow><Rows does="The kernel's cell and the event behind the last motion." items={readingRows(p.v)} size={4} /></Section>
      </Band>
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The binding">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <Field v={p.v} w={760} h={340} small={false} />
        {readingRows(p.v, true).map((r, i) => <g key={r.id} transform={`translate(${24 + (i % 2) * 360} ${360 + Math.floor(i / 2) * 26})`}>
          <text className="dp-axis">{r.note}</text><text x={84} className={r.light === 'unknown' ? 'dp-ink-dim' : 'dp-ink'}>{r.name}</text></g>)}
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Binding" light={lightOf(p)} onLight={head(p).onLight} lightWhy={head(p).lightWhy} span={2} onFull={p.nav.full}>
    <Display w={110} h={100} label="The binding" does={FIELD_DOES}><Field v={p.v} w={110} h={100} small /></Display>
    <Rows does="The kernel's cell and the event behind the last motion." items={readingRows(p.v).filter(r => r.id === 'positive' || r.id === 'negative' || r.id === 'moved')} size={3} />
  </Tile>,
}
