// M′ matrices (manual §22.6): what the torus is made of, in four stacked layers — the Oscillator that makes the sound, the Reading that
// tunes and moves it, the Form that gives it a body, the Situation it reaches. Live's nearest: Drum Rack's pad grid and the
// modulation matrix — one grid of cells, one selected, its value read beside it. The display is the chosen matrix as its owner
// states it, cell by cell: the Oscillator's 12 rows by 12 positions of source values (raw, digital root or decimal: three forms that
// stay separate), the Reading's 12 lenses by 7 modes (each cell the mode's tonic), the Form's 64 codons in 8 by 8. The cell in use is
// ringed and carries the handle.
//
// Owners, keyed on their paths:
//   m1.*          Quaternal Logic's M1 engine (crates/ql-mef/src/m1_engine.rs, `ql kernel m1`, `ql.m1.engine/v1`): the cell inspected
//                 (family 0..5, row12, col12, tick12), its consumer's config; m1.lens12 0..11 and m1.context_frame 1..7 are the transport's
//                 key and scale ("Key, root and scale | Sets the lens and the mode. The Reading matrix follows them", manual §22.6
//                 Transport), and m1.basis the order the served catalogue is read in; m1.cells
//                 the family's 12 × 12 cells as [raw, digit root, decimal] (m1.rs `cell`: Bimba = row × position; decimal only within
//                 10 × 10; family 5, the Quintessence, has no scalar, so its cells read none).
//   m2.tonics     the 84 lens modes of the basis (`ql music modes`, `ql.music-modes/v1` lens_cf): for each lens, each mode's tonic.
//   m3.codons     the 64 codons in address order (`ql.m3-state/v1` transcription for each form address); form.address the form in use
//                 (written by m3_reception `select-form`).
//   form.partner  'complementary' | 'moving-resting' | 'same-quality', and form.scale 'codon' | 'hexagram': the matrix whose partner
//                 shows beside each codon, base by base or trigram by trigram; form.partners the kernel's 64 partner addresses for
//                 them (ql_m3_apply_matrix, ql_m3_apply_matrix_hexagram). form.matrix is the matrix the form stands under now (the M3
//                 state's form.matrix_axis); Apply sets `form.apply` to it, m3_reception's own `apply-matrix {family}`, which moves the form to
//                 its partner under that matrix, so a second press returns.
// The Situation matrix has no owner yet (the M′ packets, QL-MEF #281, are commissioned, not landed), so it is named absent. Follow
// has no owner operation (nothing reports the notes played or moves the cell with the sky), so it is not offered.
//
// The Kernel page applies the kernel's three operators to an address of its sixfold form (`ql kernel apply <operator> <address>`,
// crates/ql-core/src/apply.rs, kernel 0.1.0-q1; an address is `qladdr:<form>/<face>/P<position>/d<depth>`). Apply above moves only an
// M3 partner; these move any address. No owner names a kernel address for a matrix cell, so the address is yours: kernel.position (0..5)
// and kernel.face ('direct' | 'conjugate'), with kernel.depth and kernel.form read as the owner keeps them (depth 0 and sixfold@1, the
// one form the operators serve: the kernel refuses its other forms with "unsupported QL address frame"). The answers are readings:
// kernel.conjugate and kernel.complement (addresses), kernel.class ('implicate' | 'explicate'), kernel.version. Conjugate and Complement
// move the address to the kernel's answer. The CLI has no kernel op behind it yet: the binding owes the route.
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, ValueBox, type LightState} from '../../sdk/panel'
import {PITCH_CLASS_NAMES} from '../../../live/modes'
import {NONE, clampTo, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

const MATRICES = [{value: 'oscillator', label: 'Oscillator', does: 'The field of source values that drives the torus: the only generator.'},
  {value: 'reading', label: 'Reading', does: 'The 12 lenses and the 7 modes: tuning and modulation. It makes no sound.'},
  {value: 'form', label: 'Form', does: 'The 64 codons: the body the sound rings in.'},
  {value: 'situation', label: 'Situation', does: 'The world that receives the sound, and the seven centres.'}] as const
const BASES = [{value: 'chromatic', label: 'Chromatic', does: 'The twelve notes in the order of semitones.'}, {value: 'fifths', label: 'Fifths', does: 'The twelve notes in the order of fifths.'}] as const
const FORMS = [{value: 'raw', label: 'Raw', does: 'The source value as it stands.'}, {value: 'dr', label: 'Root', does: 'Its digital root.'}, {value: 'decimal', label: 'Decimal', does: 'Its decimal value, within ten by ten.'}] as const
const PARTNERS = [{value: 'complementary', label: 'Complementary', does: 'Complementary: A with T, C with G.'}, {value: 'moving-resting', label: 'Moving and resting', does: 'Moving and resting: A with G, T with C.'},
  {value: 'same-quality', label: 'Same quality', does: 'Same quality: A with C, T with G.'}] as const
/** The matrix the form stands under, as Apply names it (QL's MatrixFamily, by the design's names). */
const MATRIX_WORD: Readonly<Record<string, string>> = {'complementary': 'the complementary matrix', 'moving-resting': 'the moving and resting matrix', 'same-quality': 'the same-quality matrix'}
const SCALES = [{value: 'codon', label: 'Codon', does: 'The partner base by base.'}, {value: 'hexagram', label: 'Hexagram', does: "The partner trigram by trigram: each trigram goes to the trigram whose pair is the partner of its pair."}] as const
const MODES = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian']
const lensLabel = (i: number) => `L${i >> 1}${i & 1 ? '′' : ''}`

const intIn = (v: V, key: string, lo: number, hi: number) => { const n = numOf(v, key); return n !== undefined && Number.isInteger(n) && n >= lo && n <= hi ? n : undefined }
function cellsOf(v: V): (readonly (number | null)[])[][] | undefined {
  const g = json<unknown>(v, 'm1.cells', undefined)
  return Array.isArray(g) && g.length === 12 && g.every(r => Array.isArray(r) && r.length === 12) ? g as (readonly (number | null)[])[][] : undefined
}
const tonicsOf = (v: V) => { const g = json<unknown>(v, 'm2.tonics', undefined); return Array.isArray(g) && g.length === 12 && g.every(r => Array.isArray(r) && r.length === 7) ? g as number[][] : undefined }
const codonsOf = (v: V) => { const g = json<unknown>(v, 'm3.codons', undefined); return Array.isArray(g) && g.length === 64 && g.every(x => typeof x === 'string') ? g as string[] : undefined }
const partnersOf = (v: V) => { const g = json<unknown>(v, 'form.partners', undefined); return Array.isArray(g) && g.length === 64 && g.every(x => Number.isInteger(x) && x >= 0 && x < 64) ? g as number[] : undefined }
const formIndex = (v: V) => (strOf(v, 'valueForm') === 'dr' ? 1 : strOf(v, 'valueForm') === 'decimal' ? 2 : 0)

/** What the grid shows for the matrix: its size, each cell's word and weight (0..1), the cell in use, and the reason when absent. */
function gridOf(v: V) {
  const m = strOf(v, 'matrix') ?? 'oscillator'
  if (m === 'oscillator') {
    const cells = cellsOf(v), k = formIndex(v), r = intIn(v, 'm1.row12', 0, 11), c = intIn(v, 'm1.col12', 0, 11)
    return {rows: 12, cols: 12, rowLabel: (i: number) => String(i), colLabel: (j: number) => String(j), at: r === undefined || c === undefined ? undefined : [r, c] as const,
      word: (i: number, j: number) => { const x = cells?.[i]?.[j]?.[k]; return x === null || x === undefined ? NONE : String(x) },
      weight: (i: number, j: number) => { const x = cells?.[i]?.[j]?.[1]; return typeof x === 'number' ? x / 9 : 0 }, absent: cells ? undefined : 'No reading of the oscillator'}
  }
  if (m === 'reading') {
    const t = tonicsOf(v), l = intIn(v, 'm1.lens12', 0, 11), cf = intIn(v, 'm1.context_frame', 1, 7)
    return {rows: 12, cols: 7, rowLabel: lensLabel, colLabel: (j: number) => `${j + 1}`, at: l === undefined || cf === undefined ? undefined : [l, cf - 1] as const,
      word: (i: number, j: number) => (t ? PITCH_CLASS_NAMES[t[i]![j]!] ?? NONE : NONE), weight: (i: number, j: number) => (t ? .25 + .55 * (t[i]![j]! / 11) : 0), absent: t ? undefined : 'No reading of the lens modes'}
  }
  if (m === 'form') {
    const cod = codonsOf(v), a = intIn(v, 'form.address', 0, 63), partners = partnersOf(v), to = a === undefined ? undefined : partners?.[a]
    return {rows: 8, cols: 8, rowLabel: (i: number) => String(i * 8), colLabel: (j: number) => String(j), at: a === undefined ? undefined : [a >> 3, a & 7] as const,
      partner: to === undefined ? undefined : [to >> 3, to & 7] as const, under: (i: number, j: number) => { const t = partners?.[i * 8 + j]; return t === undefined ? undefined : cod?.[t] },
      word: (i: number, j: number) => cod?.[i * 8 + j] ?? NONE, weight: () => (cod ? .3 : 0), absent: cod ? undefined : 'No reading of the codons'}
  }
  return {rows: 7, cols: 3, rowLabel: (i: number) => `C${7 - i}`, colLabel: (j: number) => ['world', 'personal', 'shared'][j]!, at: undefined, word: () => NONE, weight: () => 0,
    absent: strOf(v, 'reason') ?? 'No situation matrix yet'}
}

/** The grid. Handle 1 is the cell in use: drag it to another cell. `text`: each cell carries its word where the room allows. */
function Grid({p, w, h, handles, text}: {p: ViewProps; w: number; h: number; handles: boolean; text: boolean}) {
  const v = p.v, g = gridOf(v), m = strOf(v, 'matrix') ?? 'oscillator', head = text ? 16 : 10
  const cs = Math.min((w - head - 4) / g.cols, (h - head - 4) / g.rows), x0 = head + (w - head - 4 - cs * g.cols) / 2, y0 = head
  const fs = Math.min(cs * .42, 12)
  const keys = m === 'oscillator' ? ['m1.row12', 'm1.col12'] : m === 'reading' ? ['m1.lens12', 'm1.context_frame'] : ['form.address']
  const held = keys.map(k => st(p, k).disabled).find(Boolean)
  return <g>
    {Array.from({length: g.rows}, (_, i) => Array.from({length: g.cols}, (_, j) => <rect key={`${i}-${j}`} x={x0 + j * cs + .5} y={y0 + i * cs + .5} width={cs - 1} height={cs - 1}
      fill="var(--dp-value)" opacity={g.absent ? 0 : .08 + .55 * g.weight(i, j)} stroke="var(--dp-value-dim)" strokeWidth={.4} strokeDasharray={g.absent ? '2 2' : undefined} />))}
    {text && !g.absent && cs >= 14 && Array.from({length: g.rows}, (_, i) => Array.from({length: g.cols}, (_, j) => { const under = cs >= 40 ? g.under?.(i, j) : undefined
      return <g key={`t${i}-${j}`}>
        <text x={x0 + (j + .5) * cs} y={y0 + (i + .5) * cs + fs * .35 - (under ? fs * .5 : 0)} textAnchor="middle" className="dp-ink" style={{fontSize: fs}}>{g.word(i, j)}</text>
        {under && <text x={x0 + (j + .5) * cs} y={y0 + (i + .5) * cs + fs * 1.05} textAnchor="middle" className="dp-axis" style={{fontSize: fs * .72}}>↔ {under}</text>}
      </g> }))}
    {!g.absent && (text || cs >= 9) && Array.from({length: g.rows}, (_, i) => (g.rows <= 12 && (text || i % 3 === 0)) && <text key={`r${i}`} x={x0 - 3} y={y0 + (i + .5) * cs + 3} textAnchor="end" className="dp-axis" style={{fontSize: text ? 9 : 7}}>{g.rowLabel(i)}</text>)}
    {!g.absent && (text || cs >= 9) && Array.from({length: g.cols}, (_, j) => (text || j % 3 === 0 || g.cols <= 8) && <text key={`c${j}`} x={x0 + (j + .5) * cs} y={y0 - 3} textAnchor="middle" className="dp-axis" style={{fontSize: text ? 9 : 7}}>{g.colLabel(j)}</text>)}
    {g.absent && <text x={x0 + cs * g.cols / 2} y={y0 + cs * g.rows / 2} textAnchor="middle" className="dp-ink-dim" style={{fontSize: text ? 13 : 9}}>{g.absent}</text>}
    {g.partner && g.at && !g.absent && <g>
      <path d={`M${x0 + (g.at[1] + .5) * cs} ${y0 + (g.at[0] + .5) * cs}L${x0 + (g.partner[1] + .5) * cs} ${y0 + (g.partner[0] + .5) * cs}`} stroke="var(--dp-on)" strokeWidth={.8} strokeDasharray="3 2" opacity={.7} />
      <rect x={x0 + g.partner[1] * cs + .5} y={y0 + g.partner[0] * cs + .5} width={cs - 1} height={cs - 1} fill="none" stroke="var(--dp-on)" strokeWidth={1} strokeDasharray="2 2" />
    </g>}
    {g.at && <rect x={x0 + g.at[1] * cs - .5} y={y0 + g.at[0] * cs - .5} width={cs + 1} height={cs + 1} fill="none" stroke="var(--dp-on)" strokeWidth={1.5} />}
    {handles && g.at && !g.absent && <Handle n={1} x={x0 + (g.at[1] + .5) * cs} y={y0 + (g.at[0] + .5) * cs} label="Cell" shape="ring"
      does={`Drag to another cell: the cell to inspect.${held ? ` ${held}` : ''}`}
      onDrag={held ? undefined : (x, y) => {
        const i = clampTo(0, g.rows - 1, Math.floor((y - y0) / cs)), j = clampTo(0, g.cols - 1, Math.floor((x - x0) / cs))
        if (g.at && i === g.at[0] && j === g.at[1]) return
        if (m === 'oscillator') { p.set('m1.row12', i); p.set('m1.col12', j) } else if (m === 'reading') { p.set('m1.lens12', i); p.set('m1.context_frame', j + 1) } else p.set('form.address', i * 8 + j)
      }} />}
  </g>
}

// ---------------------------------------------------------------- the Kernel page: an address of the sixfold form and the operators' answers

const ADDR = /^qladdr:([^/]+)\/(direct|conjugate)\/P([0-5])\/d(\d+)$/
const addrOf = (v: V, key: string) => { const m = ADDR.exec(strOf(v, key) ?? ''); return m ? {form: m[1]!, face: m[2] as 'direct' | 'conjugate', position: Number(m[3]), depth: Number(m[4])} : undefined }
const kernelAddress = (v: V) => { const pos = intIn(v, 'kernel.position', 0, 5), face = strOf(v, 'kernel.face'), depth = numOf(v, 'kernel.depth'), form = strOf(v, 'kernel.form')
  return pos === undefined || (face !== 'direct' && face !== 'conjugate') || depth === undefined || form === undefined ? undefined : `qladdr:${form}/${face}/P${pos}/d${depth}` }
const FACES = [{value: 'direct', label: 'Direct', does: 'The direct face of the position.'}, {value: 'conjugate', label: 'Conjugate', does: 'The conjugate face: the position seen from its other side.'}] as const
const shortAddr = (a: ReturnType<typeof addrOf>) => (a ? `P${a.position} ${a.face === 'direct' ? 'dir.' : 'conj.'}` : undefined)

/** The sixfold form: six positions round, the frame 0 and 5 at the top and shaded, the four working positions below, each position
 * facing its complement across the middle (0 and 5, 1 and 4, 2 and 3); the direct face outside and the conjugate inside. Handle 1 is
 * the address: drag it to another position or face. The kernel's conjugate is the arrow between the faces, its complement the dashed
 * arrow across. */
function SixfoldWell({p, w, h, handles, labels}: {p: ViewProps; w: number; h: number; handles: boolean; labels: boolean}) {
  const v = p.v, cx = w / 2, cy = h / 2 + (labels ? 4 : 0), R = Math.min(w, h) / 2 - (labels ? 14 : 8), r = R * .56
  const P = (i: number, face: string) => { const a = (330 - i * 60 - 90) * Math.PI / 180, k = face === 'conjugate' ? r : R; return [cx + k * Math.cos(a), cy + k * Math.sin(a)] as const }
  const pos = intIn(v, 'kernel.position', 0, 5), face = strOf(v, 'kernel.face'), conj = addrOf(v, 'kernel.conjugate'), comp = addrOf(v, 'kernel.complement')
  const at = pos !== undefined && (face === 'direct' || face === 'conjugate') ? P(pos, face) : undefined
  const held = st(p, 'kernel.position').disabled ?? st(p, 'kernel.face').disabled
  const arrow = (to: readonly [number, number], dash: boolean, key: string) => at && <path key={key} d={`M${at[0].toFixed(1)} ${at[1].toFixed(1)}L${to[0].toFixed(1)} ${to[1].toFixed(1)}`}
    stroke="var(--dp-on)" strokeWidth={1} strokeDasharray={dash ? '3 2' : undefined} opacity={.8} markerEnd="none" />
  return <g>
    {[R, r].map((k, ring) => <circle key={ring} cx={cx} cy={cy} r={k} className="dp-faint" opacity={.6} />)}
    {[0, 5].map(i => { const [x, y] = P(i, 'direct'), [u, z] = P(i, 'conjugate'); return <path key={i} d={`M${x} ${y}L${u} ${z}`} stroke="var(--dp-value)" strokeWidth={9} strokeLinecap="round" opacity={.12} /> })}
    {[0, 1, 2, 3, 4, 5].map(i => (['direct', 'conjugate'] as const).map(f => { const [x, y] = P(i, f), here = pos === i && face === f
      return <g key={`${i}${f}`}>
        <circle cx={x} cy={y} r={f === 'direct' ? 6.5 : 5} fill={here ? 'var(--dp-value)' : 'var(--dp-well)'} stroke="var(--dp-value-dim)" strokeWidth={.8} />
        {(labels || f === 'direct') && <text x={x} y={y + 2.8} textAnchor="middle" style={{fontSize: f === 'direct' ? 7.5 : 6.5, fill: here ? '#121a20' : 'var(--text-dim)'}} className="dp-ink">{i}</text>}
      </g> }))}
    {conj && arrow(P(conj.position, conj.face), false, 'conj')}
    {comp && arrow(P(comp.position, comp.face), true, 'comp')}
    {conj && <circle cx={P(conj.position, conj.face)[0]} cy={P(conj.position, conj.face)[1]} r={7.5} fill="none" stroke="var(--dp-on)" strokeWidth={1} />}
    {comp && <circle cx={P(comp.position, comp.face)[0]} cy={P(comp.position, comp.face)[1]} r={7.5} fill="none" stroke="var(--dp-on)" strokeWidth={1} strokeDasharray="2 2" />}
    {labels && <><text x={w - 4} y={11} textAnchor="end" className="dp-axis">frame</text><text x={w - 4} y={h - 4} textAnchor="end" className="dp-axis">work</text></>}
    {!at && <text x={cx} y={cy + 3} textAnchor="middle" className="dp-ink-dim">{w > 100 ? 'No address' : NONE}</text>}
    {handles && at && <Handle n={1} shape="ring" x={at[0]} y={at[1]} label="Address" does={`Drag to another position, or across to the other face.${held ? ` ${held}` : ''}`}
      onDrag={held ? undefined : (x, y) => { const a = (Math.atan2(y - cy, x - cx) * 180 / Math.PI + 90 + 360) % 360, i = ((Math.round((330 - a) / 60) % 6) + 6) % 6, f = Math.hypot(x - cx, y - cy) < (R + r) / 2 ? 'conjugate' : 'direct'
        if (i !== pos) p.set('kernel.position', i); if (f !== face) p.set('kernel.face', f) }} />}
  </g>
}

function kernelControls(p: ViewProps) {
  const v = p.v, conj = addrOf(v, 'kernel.conjugate'), comp = addrOf(v, 'kernel.complement'), none = 'No answer from the kernel for this address.'
  return {
    position: <ValueBox {...st(p, 'kernel.position')} label="Position" does="The position of the address, 0 to 5." value={intIn(v, 'kernel.position', 0, 5) ?? NaN} def={0} scale={{min: 0, max: 5, step: 1}}
      format={x => String(x)} onChange={x => p.set('kernel.position', x)} />,
    face: <Radio {...st(p, 'kernel.face')} label="Face" does="The face of the address." value={strOf(v, 'kernel.face') ?? ''} options={FACES} stack onChange={x => p.set('kernel.face', x)} />,
    conjugate: <Action {...st(p, 'kernel.face')} label="Conjugate" does="Move the address to its conjugate, as the kernel answers: the same position on its other face."
      onPress={() => { if (conj) { p.set('kernel.face', conj.face); p.set('kernel.position', conj.position) } }} disabled={st(p, 'kernel.face').disabled ?? (conj ? undefined : none)} />,
    complement: <Action {...st(p, 'kernel.position')} label="Complement" does="Move the address to its complement, as the kernel answers: the position across from it, on the same face."
      onPress={() => { if (comp) { p.set('kernel.position', comp.position); p.set('kernel.face', comp.face) } }} disabled={st(p, 'kernel.position').disabled ?? (comp ? undefined : none)} />,
  }
}

const LIGHT_WHY = 'The M′ matrices have no on or off. The light stays hollow.'
const headOf = (p: ViewProps) => ({light: 'unknown' as LightState, lightWhy: LIGHT_WHY, onFold: p.nav.fold, onFull: p.nav.full})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const matrixWord = (v: V) => MATRICES.find(m => m.value === (strOf(v, 'matrix') ?? 'oscillator'))?.label
/** The cell in use, in words, and its value in the form chosen. */
function cellWord(v: V) { const g = gridOf(v), m = strOf(v, 'matrix') ?? 'oscillator'; if (!g.at) return undefined
  return m === 'form' ? `#${g.at[0] * 8 + g.at[1]}` : m === 'reading' ? `${g.rowLabel(g.at[0])} · CF${g.at[1] + 1}` : `${g.rowLabel(g.at[0])} · ${g.colLabel(g.at[1])}` }
function cellValue(v: V) { const g = gridOf(v); return g.at && !g.absent ? g.word(g.at[0], g.at[1]) : undefined }
const DISPLAY_DOES = 'The matrix, cell by cell, as its owner states it. The ringed cell is the one in use.'

const formOnly = (v: V) => ((strOf(v, 'matrix') ?? 'oscillator') === 'form' ? undefined : 'Only the Form matrix has partners.')
/** The partner of the form in use, in words: "TAT ↔ ATA". */
const partnerWord = (v: V) => { const a = intIn(v, 'form.address', 0, 63), cod = codonsOf(v), to = a === undefined ? undefined : partnersOf(v)?.[a]
  return a === undefined || to === undefined || !cod ? undefined : `${cod[a]} ↔ ${cod[to]}` }

function controls(p: ViewProps) {
  const v = p.v
  return {
    matrixRadio: <Radio {...st(p, 'matrix')} does="The matrix to show." value={strOf(v, 'matrix') ?? 'oscillator'} options={MATRICES} stack onChange={x => p.set('matrix', x)} />,
    basis: <Radio {...st(p, 'm1.basis')} label="Basis" does="The order of the twelve notes." value={strOf(v, 'm1.basis') ?? ''} options={BASES} stack onChange={x => p.set('m1.basis', x)} />,
    lens: <Dial {...st(p, 'm1.lens12')} label="Lens" does="The lens that anchors the reading." value={intIn(v, 'm1.lens12', 0, 11) ?? NaN} def={0} scale={{min: 0, max: 11, step: 1}} format={lensLabel} onChange={x => p.set('m1.lens12', x)} />,
    cf: <Dial {...st(p, 'm1.context_frame')} label="Frame" does="The context frame: the mode of the lens." value={intIn(v, 'm1.context_frame', 1, 7) ?? NaN} def={1} scale={{min: 1, max: 7, step: 1}}
      format={x => `CF${x}`} onChange={x => p.set('m1.context_frame', x)} />,
    form: <Radio {...st(p, 'valueForm')} label="Value" does="How a source value shows. The three forms stay separate." value={strOf(v, 'valueForm') ?? ''} options={FORMS} stack onChange={x => p.set('valueForm', x)}
      disabled={st(p, 'valueForm').disabled ?? ((strOf(v, 'matrix') ?? 'oscillator') === 'oscillator' ? undefined : 'Only the Oscillator holds source values.')} />,
    row: <ValueBox {...st(p, 'm1.row12')} label="Row" does="The row of the cell to inspect." value={intIn(v, 'm1.row12', 0, 11) ?? NaN} def={0} scale={{min: 0, max: 11, step: 1}} format={x => String(x)} onChange={x => p.set('m1.row12', x)} />,
    col: <ValueBox {...st(p, 'm1.col12')} label="Position" does="The position of the cell to inspect." value={intIn(v, 'm1.col12', 0, 11) ?? NaN} def={0} scale={{min: 0, max: 11, step: 1}} format={x => String(x)} onChange={x => p.set('m1.col12', x)} />,
    partner: <Chooser {...st(p, 'form.partner')} wide label="Partner" does="In the Form matrix, the matrix whose partner shows beside each codon." value={strOf(v, 'form.partner') ?? ''} options={PARTNERS}
      onChange={x => p.set('form.partner', x)} disabled={st(p, 'form.partner').disabled ?? formOnly(v)} />,
    scale: <Radio {...st(p, 'form.scale')} label="Scale" does="Base by base, or trigram by trigram." value={strOf(v, 'form.scale') ?? ''} options={SCALES} onChange={x => p.set('form.scale', x)}
      disabled={st(p, 'form.scale').disabled ?? formOnly(v)} />,
    apply: <Action {...st(p, 'form.apply')} label="Apply" does={`Moves the form to its partner under ${MATRIX_WORD[strOf(v, 'form.matrix') ?? ''] ?? 'its matrix'}. Press again to return.`}
      onPress={() => { const m = strOf(v, 'form.matrix'); if (m) p.set('form.apply', m) }}
      disabled={st(p, 'form.apply').disabled ?? formOnly(v) ?? (strOf(v, 'form.matrix') === undefined ? 'No reading of the matrix the form stands under.' : undefined)} />,
    family: <ValueBox {...st(p, 'm1.family')} label="Family" does="The family of the source values: 0 to 5; the fifth, the Quintessence, has no scalar." value={intIn(v, 'm1.family', 0, 5) ?? NaN} def={0}
      scale={{min: 0, max: 5, step: 1}} format={x => String(x)} onChange={x => p.set('m1.family', x)} />,
  }
}

export const design: DesignedDevice = {
  id: 'quaternal-logic:m-prime-matrices',
  title: 'M′ matrices',
  kind: 'instrument',
  firstPage: 'matrix',
  defaults: {
    matrix: 'oscillator', valueForm: 'raw', 'm1.basis': 'chromatic', 'm1.lens12': 0, 'm1.context_frame': 1, 'm1.family': 0, 'm1.row12': 3, 'm1.col12': 4, 'm1.tick12': 7, 'form.address': 17, 'form.matrix': 'complementary',
    // `ql kernel m1` on fixtures/kernel/m1-engine-v1.request.json, family 0, each of the 144 cells: [raw, digit root, decimal].
    'm1.cells': '[[[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,null],[0,0,null]],[[0,0,0],[1,1,1],[2,2,2],[3,3,3],[4,4,4],[5,5,5],[6,6,6],[7,7,7],[8,8,8],[9,9,9],[10,1,null],[11,2,null]],[[0,0,0],[2,2,2],[4,4,4],[6,6,6],[8,8,8],[10,1,0],[12,3,2],[14,5,4],[16,7,6],[18,9,8],[20,2,null],[22,4,null]],[[0,0,0],[3,3,3],[6,6,6],[9,9,9],[12,3,2],[15,6,5],[18,9,8],[21,3,1],[24,6,4],[27,9,7],[30,3,null],[33,6,null]],[[0,0,0],[4,4,4],[8,8,8],[12,3,2],[16,7,6],[20,2,0],[24,6,4],[28,1,8],[32,5,2],[36,9,6],[40,4,null],[44,8,null]],[[0,0,0],[5,5,5],[10,1,0],[15,6,5],[20,2,0],[25,7,5],[30,3,0],[35,8,5],[40,4,0],[45,9,5],[50,5,null],[55,1,null]],[[0,0,0],[6,6,6],[12,3,2],[18,9,8],[24,6,4],[30,3,0],[36,9,6],[42,6,2],[48,3,8],[54,9,4],[60,6,null],[66,3,null]],[[0,0,0],[7,7,7],[14,5,4],[21,3,1],[28,1,8],[35,8,5],[42,6,2],[49,4,9],[56,2,6],[63,9,3],[70,7,null],[77,5,null]],[[0,0,0],[8,8,8],[16,7,6],[24,6,4],[32,5,2],[40,4,0],[48,3,8],[56,2,6],[64,1,4],[72,9,2],[80,8,null],[88,7,null]],[[0,0,0],[9,9,9],[18,9,8],[27,9,7],[36,9,6],[45,9,5],[54,9,4],[63,9,3],[72,9,2],[81,9,1],[90,9,null],[99,9,null]],[[0,0,null],[10,1,null],[20,2,null],[30,3,null],[40,4,null],[50,5,null],[60,6,null],[70,7,null],[80,8,null],[90,9,null],[100,1,null],[110,2,null]],[[0,0,null],[11,2,null],[22,4,null],[33,6,null],[44,8,null],[55,1,null],[66,3,null],[77,5,null],[88,7,null],[99,9,null],[110,2,null],[121,4,null]]]',
    // `ql music modes --json`, the chromatic basis: each lens's tonic for ionian … locrian.
    'm2.tonics': JSON.stringify([[0, 2, 4, 5, 7, 9, 11], [1, 3, 5, 6, 8, 10, 0], [2, 4, 6, 7, 9, 11, 1], [3, 5, 7, 8, 10, 0, 2], [4, 6, 8, 9, 11, 1, 3], [5, 7, 9, 10, 0, 2, 4],
      [6, 8, 10, 11, 1, 3, 5], [7, 9, 11, 0, 2, 4, 6], [8, 10, 0, 1, 3, 5, 7], [9, 11, 1, 2, 4, 6, 8], [10, 0, 2, 3, 5, 7, 9], [11, 1, 3, 4, 6, 8, 10]]),
    // `ql kernel m3`, the codon of each form address 0..63.
    // ql_m3_apply_matrix(0, a) on main (61c0e16): each address's complementary partner, base by base.
    'form.partner': 'complementary', 'form.scale': 'codon', 'form.partners': '[21,20,23,22,17,16,19,18,29,28,31,30,25,24,27,26,5,4,7,6,1,0,3,2,13,12,15,14,9,8,11,10,53,52,55,54,49,48,51,50,61,60,63,62,57,56,59,58,37,36,39,38,33,32,35,34,45,44,47,46,41,40,43,42]',
    // `ql kernel apply` on qladdr:sixfold@1/direct/P2/d0 (kernel 0.1.0-q1): conjugate, complement, class.
    'kernel.position': 2, 'kernel.face': 'direct', 'kernel.depth': 0, 'kernel.form': 'sixfold@1', 'kernel.version': '0.1.0-q1',
    'kernel.conjugate': 'qladdr:sixfold@1/conjugate/P2/d0', 'kernel.complement': 'qladdr:sixfold@1/direct/P3/d0', 'kernel.class': 'explicate',
    'm3.codons': JSON.stringify('AAA AAT AAC AAG ATA ATT ATC ATG ACA ACT ACC ACG AGA AGT AGC AGG TAA TAT TAC TAG TTA TTT TTC TTG TCA TCT TCC TCG TGA TGT TGC TGG CAA CAT CAC CAG CTA CTT CTC CTG CCA CCT CCC CCG CGA CGT CGC CGG GAA GAT GAC GAG GTA GTT GTC GTG GCA GCT GCC GCG GGA GGT GGC GGG'.split(' ')),
  },
  fixtures: {
    'The oscillator, raw': {},
    'Digital roots': {valueForm: 'dr', 'm1.row12': 7, 'm1.col12': 8},
    'The reading, fifths': {matrix: 'reading', 'm1.basis': 'fifths', 'm1.lens12': 11, 'm1.context_frame': 7,
      'm2.tonics': JSON.stringify([[0, 2, 4, 5, 7, 9, 11], [6, 8, 10, 11, 1, 3, 5], [7, 9, 11, 0, 2, 4, 6], [1, 3, 5, 6, 8, 10, 0], [2, 4, 6, 7, 9, 11, 1], [8, 10, 0, 1, 3, 5, 7],
        [9, 11, 1, 2, 4, 6, 8], [3, 5, 7, 8, 10, 0, 2], [4, 6, 8, 9, 11, 1, 3], [10, 0, 2, 3, 5, 7, 9], [11, 1, 3, 4, 6, 8, 10], [5, 7, 9, 10, 0, 2, 4]])},
    'The form': {matrix: 'form'},
    // ql_m3_apply_matrix_hexagram(1, a): each address read as a hexagram, its moving-and-resting partner trigram by trigram.
    'The form, partner by hexagram': {matrix: 'form', 'form.partner': 'moving-resting', 'form.scale': 'hexagram', 'form.partners': '[45,43,47,41,46,40,44,42,29,27,31,25,30,24,28,26,61,59,63,57,62,56,60,58,13,11,15,9,14,8,12,10,53,51,55,49,54,48,52,50,5,3,7,1,6,0,4,2,37,35,39,33,38,32,36,34,21,19,23,17,22,16,20,18]'},
    'The situation': {matrix: 'situation'},
    // `ql kernel apply` on qladdr:sixfold@1/conjugate/P0/d0: the ground, seen from its other face.
    'Kernel, the ground conjugate': {'kernel.position': 0, 'kernel.face': 'conjugate', 'kernel.conjugate': 'qladdr:sixfold@1/direct/P0/d0',
      'kernel.complement': 'qladdr:sixfold@1/conjugate/P5/d0', 'kernel.class': 'implicate'},
    'Kernel, no answer': {'kernel.conjugate': undefined, 'kernel.complement': undefined, 'kernel.class': undefined, 'kernel.version': undefined},
    'No readings': {'m1.cells': undefined, 'm2.tonics': undefined, 'm3.codons': undefined, 'm1.row12': undefined, 'm1.col12': undefined, 'm1.lens12': undefined, 'm1.context_frame': undefined, 'form.address': undefined, 'form.matrix': undefined, 'form.partner': undefined, 'form.scale': undefined, 'form.partners': undefined,
      'kernel.position': undefined, 'kernel.face': undefined, 'kernel.depth': undefined, 'kernel.form': undefined, 'kernel.version': undefined, 'kernel.conjugate': undefined, 'kernel.complement': undefined, 'kernel.class': undefined},
  },

  folded: p => <Folded title="M′ matrices" light="unknown" readings={[matrixWord(p.v) ?? NONE, cellWord(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="M′ matrices" view="compact" {...headOf(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The matrix" does={`${DISPLAY_DOES} Drag handle 1 to another cell.`} corner={cellValue(p.v) ?? NONE}><Grid p={p} w={140} h={146} handles text={false} /></Display>
      </Section>
      <Section label="Macros" cols={2} width={140}>{c.matrixRadio}{c.lens}{c.basis}{c.cf}</Section>
    </Panel> },

  whole: p => { const c = controls(p), w = wide(p) ? 280 : 186, k = kernelControls(p)
    return <Panel title="M′ matrices" view="whole" {...headOf(p)} pages={[{id: 'matrix', label: 'Matrices'}, {id: 'kernel', label: 'Kernel'}]} page={p.page === 'kernel' ? 'kernel' : 'matrix'} onPage={p.setPage}>
      {p.page === 'kernel' ? <>
      <Band>
        <Section width={198}>
          <Display w={186} h={146} label="The sixfold form" corner={strOf(p.v, 'kernel.class') ?? NONE}
            does="The kernel's sixfold form: the frame 0 and 5 at the top, shaded, the working positions 1 to 4 below, each across from its complement; the direct face outside, the conjugate inside. Drag handle 1 for the address. The ringed points are the kernel's conjugate and, dashed, its complement.">
            <SixfoldWell p={p} w={186} h={146} handles labels /></Display>
        </Section>
        <Section label="Address" width={72}>{k.position}{k.face}</Section>
        <Section label="Operators" width={92}>{k.conjugate}{k.complement}</Section>
        <Section label="Answers" grow>
          <Readout big label="class" does="Whether the position frames, implicate (0 and 5), or works, explicate (1 to 4), as the kernel classifies it." value={strOf(p.v, 'kernel.class')} tone="value" />
          <Readout label="conjugate" does="The kernel's conjugate of the address. Press to copy it." value={shortAddr(addrOf(p.v, 'kernel.conjugate'))} copy={strOf(p.v, 'kernel.conjugate')} />
          <Readout label="complement" does="The kernel's complement of the address. Press to copy it." value={shortAddr(addrOf(p.v, 'kernel.complement'))} copy={strOf(p.v, 'kernel.complement')} tone="accent" />
        </Section>
      </Band>
      <Band>
        <Section label="Cell" grow>
          <Readout label="address" does="The address the operators read, in the kernel's own notation. Press to copy it." value={kernelAddress(p.v)?.replace('qladdr:', '')} copy={kernelAddress(p.v)} />
          <Readout label="depth" does="The depth of the address, as the owner keeps it." value={numOf(p.v, 'kernel.depth')} />
          <Readout label="form" does="The form of the address. The operators serve the sixfold form; the kernel refuses its others." value={strOf(p.v, 'kernel.form')} />
          <Readout label="kernel" does="The version of the kernel that answered." value={strOf(p.v, 'kernel.version')} />
        </Section>
      </Band>
      </> : <>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="The matrix" does={`${DISPLAY_DOES} Drag handle 1 to another cell.`} corner={cellValue(p.v) ?? NONE}><Grid p={p} w={w} h={146} handles text={w > 200} /></Display>
        </Section>
        <Section label="Matrix" width={80}>{c.matrixRadio}</Section>
        <Section label="Reading" grow>{c.basis}{c.lens}</Section>
      </Band>
      <Band>
        <Section label="Cell" width={72}>{c.row}{c.col}{c.family}</Section>
        <Section label="Show" width={72}>{c.form}</Section>
        <Section label="Frame" width={64}>{c.cf}</Section>
        <Section label="Partner" width={128}>{c.partner}{c.scale}{c.apply}</Section>
        <Section label="In use" grow>
          <Readout big label={cellWord(p.v) ?? 'cell'} does="The value of the cell in use, in the form chosen." value={cellValue(p.v)} tone="value" />
          <Readout label="tick" does="The tick of the M1 clock." value={intIn(p.v, 'm1.tick12', 0, 11)} />
          <Readout label="mode" does="The mode of the lens: the context frame's mode." value={intIn(p.v, 'm1.context_frame', 1, 7) === undefined ? undefined : MODES[intIn(p.v, 'm1.context_frame', 1, 7)! - 1]} />
          {(strOf(p.v, 'matrix') ?? 'oscillator') === 'form' && <Readout label="partner" does="The form in use and its partner under the matrix." value={partnerWord(p.v)} />}
        </Section>
      </Band>
      </>}
    </Panel> },

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The matrix">
      <g className="dp-display" style={{background: 'none', border: 'none'}}>
        <g transform="translate(20 12)"><Grid p={{...p, set: () => {}}} w={480} h={396} handles={false} text /></g>
        <text x={530} y={60} className="dp-ink" style={{fontSize: 18}}>{matrixWord(p.v) ?? NONE}</text>
        <text x={530} y={80} className="dp-ink-dim">{MATRICES.find(m => m.value === (strOf(p.v, 'matrix') ?? 'oscillator'))?.does}</text>
        {[['cell', cellWord(p.v) ?? NONE], ['value', cellValue(p.v) ?? NONE], ['basis', strOf(p.v, 'm1.basis') ?? NONE],
          ['lens', intIn(p.v, 'm1.lens12', 0, 11) === undefined ? NONE : lensLabel(intIn(p.v, 'm1.lens12', 0, 11)!)], ['frame', intIn(p.v, 'm1.context_frame', 1, 7) === undefined ? NONE : `CF${intIn(p.v, 'm1.context_frame', 1, 7)}`],
          ...((strOf(p.v, 'matrix') ?? 'oscillator') === 'form' ? [['partner', partnerWord(p.v) ?? NONE],
            ['under', `${PARTNERS.find(m => m.value === strOf(p.v, 'form.partner'))?.label ?? NONE}, by ${strOf(p.v, 'form.scale') ?? NONE}`]] : []),
          ['moves', 'not named by any owner']].map(([k, val], i) =>
          <g key={k}><text x={530} y={120 + i * 24} className="dp-axis">{k}</text><text x={590} y={120 + i * 24} className="dp-ink">{val}</text></g>)}
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="M′ matrices" light="unknown" onFull={p.nav.full}>
    <Display w={86} h={100} label="The matrix" does="The matrix, the cell in use ringed. Press ▦ to open the matrices in the pane that has focus."><Grid p={p} w={86} h={100} handles={false} text={false} /></Display>
    <div className="ref-tile-side">
      <Readout label="matrix" value={matrixWord(p.v)?.slice(0, 5)} tone="value" />
      <Readout label="cell" value={cellValue(p.v)} />
    </div>
  </Tile>,
}
