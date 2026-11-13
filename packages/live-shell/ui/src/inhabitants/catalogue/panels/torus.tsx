// The Torus (manual §21.2): Live's one instrument, a ring with a tube whose pulse steps round its twelve arcs and wound by two helices
// (the two whole-tone families). Live's nearest: Wavetable — a large display of the oscillator with handles and a global column of
// volume and voices. Every line drawn below is computed from the device's values.
//
// O-I #850, the Torus as QL designs it: the pulse, its rate and band, the Fundamental, Carrier, Shape and its figure, the Comma, Tuning
// and Polyphony are QL's M1′ session (QL-MEF m1_prime.rs; the frame's parameters.torus, written as the stage channel's `torus` edit). Keys:
// rate.mode ('free' | 'sync'), rate (steps a second, the owner's in either mode), rate.note ('n/d' under Sync), tempo (BPM, a reading: the
// set's, from the transport), band (a reading), fundamental.source ('map' | 'hz'), fundamental (Hz), carrier (0..100 %), carrier.drive
// (the owner's word: 'pulse', each step of the pulse driving the body), shape ('auto' | 'sequence' | 'torus' | 'figure-eight' | 'spiral' | 'klein-bottle'), figure (a reading),
// comma (cents, a reading), tuning ('logic' | 'maqam' | 'sky'), tuning.resident (the tunings the scene holds, JSON), tuning.maqam (the
// condition's maqām: its name and the owner's words for its absence, JSON), polyphony (1..32),
// notes (a reading). The retired Pulse mix, Helix balance, Drive, Agitation, Attack and Release are gone: QL holds none of them.
//
// Body source (M2's physical constants, manual §21.2): 'declared' keeps the body's own Strike and Damping; 'tattva' takes them from the
// tattva of the M2 condition through its element fibre (m2-correspondences `material_fibre`), by M2's table of body constants, every value
// of which stands proposed and tunable. The owner reports the tattva (`tattva.name`), its fibre (`tattva.fibre`, absent where the map gives
// the tattva none) and the values in force; under Tattva the dials are held.
//
// The Stage page drives the live scene's procedural stage (`ql stage state|evaluate|bind|unbind|retire`, crates/ql-cli/src/stage_command.rs
// over ql-mef continuous/stage.rs; one exchange with the native field host each). The stage has four slots — form, material.damping,
// clock.inscription, clock.lensing — each driven by its authored state or owned by one procedure; a procedure writing a slot another owns is
// refused. Keys: stage.slots [{slot, owner, revision}] (owner absent: authored) and stage.bindings [{procedure, trigger, evaluations, max,
// standing: 'active' | 'exhausted'}], from `ql stage state`; stage.procedures [{ref, revision, trigger: 'invocation' | 'm1-advance' |
// 'replace-event', selector, scenes?}], the `ql.stage-procedure/v1` files you keep; stage.last and stage.why, the last receipt's standing and
// the owner's refusal. Writes: stage.procedure (the one you chose; the shell holds it), stage.budget (1..1024, 16: `--max-evaluations`), and
// four acts, each on its own key with the procedure's ref: stage.evaluate, stage.bind, stage.unbind, stage.retire.
// The Rack page carries the rack of M1′ (the rack kit, map-rack.tsx), on the keys rack and rack.part.
// The Macros page is the Torus's rack face (DLW build ruling, 4 November; manual §21.2 Sounds and instruments: "A rack | The Torus with its
// note devices and effects, its macros and their variations"). Keys: macros [{name, parameter, min, max}] (held in the shell; absent, the
// compact four), macro (the index of the one you set; held), variations [{name, values}] (where every macro stood, in macro order; held)
// and chain (a reading: the effects after the Torus, [{device_ref, role, state}], as the owner keeps them). A macro turns its parameter
// over its range, min at 0 and max at 1, as a Live rack's macro turns what it is mapped to; where it stands is read back from the
// parameter. Keep rack keeps the Torus as it rings, its chain, its macros and its variations as a rack (LivePresets.tsx keepTorusRack).
import {useState, type CSSProperties, type ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Meter, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, ValueBox, type LightState, type RowItem} from '../../sdk/panel'
import {RACK_M1, RackBands} from './map-rack'
import {refusalWords} from '../../../../../../../desktop/cradle/src/shared/Refusal.tsx'
import {LIVE_CADENCE_OPTIONS, LIVE_CONTEXT_FRAME_OPTIONS, LIVE_HARMONIC_OPTIONS, LIVE_LENS_OPTIONS} from '../../../live/torusInstrument'
import {NONE, boolOf, clampTo, db, fixed, has, json, num, numOf, on, pct, shown, signed, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const DAMP = {min: .1, max: 40, log: true}
/** Rate: one step a year to 40,000 steps a second (manual §21.2), on a log scale; the band edges where the pulse becomes a breath, a
 * rhythm, a pitch and beyond. */
const RATE = {min: 1 / (365.25 * 86_400), max: 40_000, log: true}
const BAND_EDGES = [{at: .001, word: 'Breath'}, {at: .5, word: 'Rhythm'}, {at: 20, word: 'Pitch'}, {at: 20_000, word: 'Beyond'}] as const
const FUNDAMENTAL = {min: 20, max: 2000, log: true}
/** Three figures of a number, without trailing noise. */
const sig = (x: number) => (Math.abs(x) >= 100 ? String(Math.round(x)) : String(Number(x.toPrecision(3))))
/** A rate in words a person reads: steps a second, a minute, an hour, a day or a year. */
export const rateWords = (x: number) => (x >= 1 ? `${sig(x)}/s` : x * 60 >= 1 ? `${sig(x * 60)}/min` : x * 3600 >= 1 ? `${sig(x * 3600)}/h`
  : x * 86_400 >= 1 ? `${sig(x * 86_400)}/day` : `${sig(x * 365.25 * 86_400)}/yr`)
const hz = (x: number) => `${sig(x)} Hz`
const cents = (x: number) => `${x.toFixed(2)} ¢`

/** The figure's outline at a three-quarter view (QL m1_prime.rs Figure): the ring with its tube, a figure-eight, a spiral, or the ring
 * turned through itself at a return (the Klein bottle). Sampled as points (x, y) with a depth for near and far. */
function figurePoints(figure: string, cx: number, cy: number, R: number, r: number, k: number, t: number): readonly [number, number, number] {
  if (figure === 'figure-eight') { const d = 1 + Math.sin(t) ** 2; return [cx + (R + r) * Math.cos(t) / d, cy + (R + r) * 1.6 * k * Math.sin(t) * Math.cos(t) / d, Math.sin(t)] }
  if (figure === 'spiral') { const a = t * 2, rr = (R + r) * (.12 + .88 * a / (Math.PI * 4)); return [cx + rr * Math.cos(a), cy + rr * Math.sin(a) * k, Math.sin(a)] }
  return [cx + (R + r) * Math.cos(t), cy + (R + r) * Math.sin(t) * k, Math.sin(t)]
}

/** The torus at a three-quarter view, in the figure the owner says it shows: the ring, its tube and its two helices (equal: a helix is
 * one half of the ring, never a balance), a figure-eight, a spiral, or the Klein bottle at a return. The notes light on the ring.
 * Without the owner's figure the ring stands bare and says why. */
function TorusPicture({v, w, h, cx, cy, R, notes = []}: {v: V; w: number; h: number; cx: number; cy: number; R: number; notes?: readonly number[]}) {
  const r = R * .4, k = .42, figure = strOf(v, 'figure')
  // The View you keep (manual §21.2): the surface's body over its far side, the wire alone, or the wire over the body. Unread, the wire.
  const view = strOf(v, 'view') ?? 'wire', far = view === 'surface' ? .08 : 1
  const body = view === 'wire' ? null : <path data-torus-body="" className="dp-fill"
    d={`M${cx - R - r} ${cy}A${R + r} ${(R + r) * k + r * .25} 0 1 0 ${cx + R + r} ${cy}A${R + r} ${(R + r) * k + r * .25} 0 1 0 ${cx - R - r} ${cy}Z`} />
  const ring = <>
    <ellipse cx={cx} cy={cy} rx={R + r} ry={(R + r) * k + r * .25} className="dp-faint" />
    <ellipse cx={cx} cy={cy - r * .2} rx={R - r} ry={(R - r) * k} className="dp-faint" />
  </>
  if (!figure) return <g data-torus-view={view}>{body}{ring}{w > 90 && <text x={cx} y={cy + (R + r) * k + r * .25 + 14} className="dp-ink-dim" textAnchor="middle">
    {strOf(v, 'shape') === 'sequence' ? 'The scene sets the shapes' : 'No reading of the figure'}</text>}</g>
  const P = (th: number, ph: number) => {
    const rr = R + r * Math.cos(ph)
    return [cx + rr * Math.cos(th), cy + rr * Math.sin(th) * k - r * Math.sin(ph) * .9] as const
  }
  const depth = (th: number, ph: number) => (R + r * Math.cos(ph)) * Math.sin(th) * .9 + r * Math.sin(ph) * .42
  /** A sampled curve split into its far (faint) and near (full) runs. */
  const runs = (f: (t: number) => readonly [number, number], t0: number, t1: number, n: number, front: (t: number) => boolean) => {
    const out: {d: string; near: boolean}[] = []
    let cur = '', side: boolean | null = null
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n, [x, y] = f(t), s = front(t)
      if (s !== side) { if (cur) out.push({d: cur, near: side!}); cur = `M${x.toFixed(1)} ${y.toFixed(1)}`; side = s } else cur += `L${x.toFixed(1)} ${y.toFixed(1)}`
    }
    if (cur) out.push({d: cur, near: side!})
    return out
  }
  // How long the body rings: more echoes of the outline, each fainter, the sharper the resonance (damping Q), when the owner holds one.
  const echoes = has(v, 'damping') ? Math.round(clampTo(1, 4, Math.log2(num(v, 'damping') + 1))) : 1
  const lit = (n: number) => P(n / 12 * Math.PI * 2 * 2, n % 2 ? Math.PI : 0)
  const torus = figure === 'torus' || figure === 'klein-bottle'
  return <g data-torus-figure={figure} data-torus-view={view}>
    {body}
    {torus && ring}
    {torus && [0.5, 1, 1.5].map(ph => runs(t => P(t, ph * Math.PI / 2), 0, Math.PI * 2, 72, t => Math.sin(t) >= 0).map((seg, i) =>
      <path key={`${ph}-${i}`} d={seg.d} className="dp-faint" opacity={seg.near ? .7 : .25 * far} />))}
    {/* the helices: two turns for one return, the two whole-tone families */}
    {torus && [0, 1].map(hx => runs(t => P(t, 2.5 * t + hx * Math.PI), 0, Math.PI * 4, 360, t => depth(t, 2.5 * t + hx * Math.PI) > -R * .15).map((seg, i) =>
      <path key={`h${hx}-${i}`} d={seg.d} fill="none" stroke={hx ? 'var(--dp-on)' : 'var(--dp-value)'} strokeWidth={1.4} opacity={seg.near ? .85 : .2 * far} />))}
    {/* at a return the tube turns through itself: the Klein bottle's neck crosses the ring from the near side to the inside */}
    {figure === 'klein-bottle' && <path d={`M${cx + R + r} ${cy}C${cx + R} ${cy + (R + r) * k * 1.4} ${cx - R * .2} ${cy + r} ${cx} ${cy - r * .2}`} className="dp-curve" strokeDasharray="3 2" />}
    {!torus && Array.from({length: echoes}, (_, e) => runs(t => { const [x, y] = figurePoints(figure, cx, cy, R * (1 - e * .08), r, k, t); return [x, y] as const },
      0, Math.PI * 2, 180, t => figurePoints(figure, cx, cy, R, r, k, t)[2] >= 0).map((seg, i) =>
      <path key={`f${e}-${i}`} d={seg.d} className="dp-curve" opacity={(seg.near ? 1 : .35 * far) * (1 - e * .24)} style={{strokeWidth: e ? 1 : 1.6}} />))}
    {notes.map(n => { const [x, y] = lit(n); return <circle key={n} cx={x} cy={y} r={3} fill="var(--dp-on)" /> })}
    <rect x={0} y={0} width={w} height={h} fill="none" />
  </g>
}

/** The torus and its pulse: the picture, and under it the Rate on its log line from one step a year to 40,000 a second, the band edges
 * marked. Under Free the handle drags the rate; under Sync the note length sets it, so the handle only reads. */
function TorusDisplay({v, set, w, h, notes}: {v: V; set?: ViewProps['set']; w: number; h: number; notes?: readonly number[]}) {
  const cx = w / 2, cy = h * .42, R = w * .27, line = {x0: 14, x1: w - 14, y: h - 13}
  const lo = Math.log10(RATE.min), hi = Math.log10(RATE.max)
  const at = (rate: number) => line.x0 + (Math.log10(clampTo(RATE.min, RATE.max, rate)) - lo) / (hi - lo) * (line.x1 - line.x0)
  const free = strOf(v, 'rate.mode') !== 'sync'
  return <Display w={w} h={h} label="The torus" does="The torus in the figure it shows, its two helices, and its pulse's rate on the band line."
    corner={has(v, 'band') ? `${strOf(v, 'band')}` : NONE}>
    <TorusPicture v={v} w={w} h={h} cx={cx} cy={cy} R={R} notes={notes} />
    <path d={`M${line.x0} ${line.y}H${line.x1}`} className="dp-faint" />
    {BAND_EDGES.map(edge => <path key={edge.word} d={`M${at(edge.at).toFixed(1)} ${line.y - 3}V${line.y + 3}`} className="dp-grid" />)}
    {w > 150 && BAND_EDGES.slice(1, 3).map(edge => <text key={edge.word} x={at(edge.at) + 2} y={line.y - 4} className="dp-axis">{edge.word}</text>)}
    {has(v, 'rate') && <Handle n={1} x={at(num(v, 'rate'))} y={line.y} label="Rate" does={free ? 'Drag along the line: how fast the pulse steps round the ring.' : 'Under Sync the note length sets the rate.'}
      onDrag={set && free ? (x => set('rate', Number(Math.pow(10, lo + clampTo(0, 1, (x - line.x0) / (line.x1 - line.x0)) * (hi - lo)).toPrecision(3)))) : undefined}
      onReset={set && free ? (() => set('rate', 2.5)) : undefined} />}
  </Display>
}

/** The Jankó keyboard under the full torus: rows alternate the two whole-tone families, each row offset by half a key. A key lights when
 * its pitch class sounds: the even classes on the first family's rows, the odd on the second's. */
function Janko({w, y, sounding}: {w: number; y: number; sounding: readonly number[]}) {
  const keys = 14, kw = (w - 40) / keys, kh = 22, names = ['C', 'D', 'E', 'F♯', 'G♯', 'A♯', 'C♯', 'D♯', 'F', 'G', 'A', 'B']
  return <g aria-label="Jankó keyboard">
    {[0, 1, 2, 3].map(row => Array.from({length: keys - (row % 2)}, (_, i) => {
      const family = row % 2, x = 20 + i * kw + (family ? kw / 2 : 0), note = family * 6 + (i % 6), hot = sounding.includes(2 * (i % 6) + family)
      return <g key={`${row}-${i}`}>
        <rect x={x + 1} y={y + row * (kh + 2)} width={kw - 2} height={kh} rx={3}
          fill={hot ? 'var(--dp-on)' : family ? '#2a3036' : '#59606a'} stroke="var(--shade)" strokeOpacity={.4} />
        {row === 3 - family && i % 6 === 0 && <text x={x + kw / 2} y={y + row * (kh + 2) + 15} textAnchor="middle" className="dp-axis">{names[note]}</text>}
      </g>
    }))}
  </g>
}

// The light reads the owner alone; hollow while it has not said.
const light = (v: V, owner?: V) => (strOf(owner ?? v, 'light') ?? 'unknown') as LightState
const VIEWS = [{value: 'surface', label: 'Surface'}, {value: 'wire', label: 'Wire'}, {value: 'both', label: 'Both'}] as const
/** The contexts Return goes back to, as each last stood (manual §21.2 Receiver; QL-MEF #289 packet N, O-I #856). */
const RECEIVER_RETURNS = [
  {value: 'world', label: 'World', does: 'The world\'s: every voice heard at its own level, wherever the camera stands.'},
  {value: 'personal', label: 'Where you stood', does: 'Where you last stood, heard as your own.'},
  {value: 'shared', label: 'Shared', does: 'The place you last shared, under its reference.'},
]
/** Where the torus is heard from (manual §21.2 Receiver; O-I 856 and #856): Receiver On or Off, Return to a context, and the reference
 * where you stand is shared under, which the owner judges and refuses in its words. */
const receiverControls = (p: ViewProps) => <>
  <Toggle {...st(p, 'receiver')} label="Receiver" does="Your camera becomes the place where the torus is heard." on={on(p.v, 'receiver')} unknown={boolOf(p.v, 'receiver') === undefined} onChange={x => p.set('receiver', x)} />
  <Chooser {...st(p, 'receiver.return')} label="Return" does="Where the torus is heard from now. Choose another to go back to it as it last stood." value={strOf(p.v, 'receiver.return') ?? ''} options={RECEIVER_RETURNS} onChange={x => p.set('receiver.return', x)} />
  {span2(<TextField {...st(p, 'receiver.shared')} label="Shared" does="Share where you stand under a reference of 1 to 128 characters with no space. The place is shown with it."
    value={strOf(p.v, 'receiver.shared') ?? ''} placeholder="A reference" wide onChange={x => p.set('receiver.shared', x)} />)}
</>
const BODY_SOURCES = [{value: 'declared', label: 'Declared', does: 'The body keeps the values you set.'},
  {value: 'tattva', label: 'Tattva', does: "The tattva of the M2 condition sets Strike and Damping through its element fibre."}] as const
// Why no note has its own voices under Maqām or Sky, or while a form rings (DLW build ruling 2026-11-05, O-I #850): there a key strikes the
// resident voices at its point (QL torus_native.rs TORUS_RELEASE_LAW, scene_field.rs NOTE_VOICES_LAW); only Logic on the torus gives a note its
// own eight voices in the owner's bank.
const STRIKES_RESIDENT = (rings: string) => `so a note has no eight voices of its own: Polyphony still counts each key as a note, and a note that makes way only leaves the count while the ${rings} rings on (QL's release law).`
const RESIDENT_VOICES = `A key strikes these voices where its point stands, ${STRIKES_RESIDENT('body')}`
const BODIES = [{value: 'torus', label: 'The torus', does: 'The torus rings.'},
  {value: 'form', label: 'A form', does: `A form of the Expression rings. A key strikes the form at its sample nearest the key's point, ${STRIKES_RESIDENT('form')}`}] as const
const RATE_MODES = [{value: 'free', label: 'Free', does: 'Steps a second, one a year to 40,000.'}, {value: 'sync', label: 'Sync', does: 'One step per note length at the set\'s tempo.'}] as const
const NOTE_LENGTHS = ['1/64', '1/32', '1/16', '1/8', '3/16', '1/4', '3/8', '1/2', '3/4', '1/1', '2/1', '4/1', '8/1'].map(x => ({value: x, label: x.endsWith('/1') ? `${x.slice(0, -2)} bar${x === '1/1' ? '' : 's'}` : x}))
const SOURCES = [{value: 'map', label: 'Map', does: 'The frequency the map gives the Sun, its 1:1.'}, {value: 'hz', label: 'Hz', does: 'A frequency you set, 20 to 2,000 Hz.'}] as const
const SHAPES = [{value: 'auto', label: 'Auto', does: 'The shape changes by the pulse.'}, {value: 'sequence', label: 'Sequence', does: 'The shapes you set in the scene.'},
  {value: 'torus', label: 'Torus'}, {value: 'figure-eight', label: 'Figure-eight'}, {value: 'spiral', label: 'Spiral'}, {value: 'klein-bottle', label: 'Klein bottle'}] as const
const FIGURE_WORD: Record<string, string> = {torus: 'Torus', 'figure-eight': 'Figure-eight', spiral: 'Spiral', 'klein-bottle': 'Klein bottle'}
const TUNINGS = [{value: 'logic', label: 'Logic', does: 'The voices sound Vimarśā\'s octet. Each key is a note with its own eight voices, the cell its point struck; past Polyphony the oldest fades out.'},
  {value: 'maqam', label: 'Maqām', does: `The voices sound the M2 condition's maqām. ${RESIDENT_VOICES}`},
  {value: 'sky', label: 'Sky', does: `The voices take the planets of your sky. ${RESIDENT_VOICES}`}] as const
/** Why a body constant is held: under Tattva, the tattva with a fibre sets it. */
export const tattvaHold = (v: V): string | undefined => {
  if (strOf(v, 'body.source') !== 'tattva') return undefined
  const name = strOf(v, 'tattva.name'), fibre = strOf(v, 'tattva.fibre')
  return fibre ? `Body source is Tattva: ${name ?? 'the tattva'}'s ${fibre} fibre sets it.` : undefined
}
/** The tattva's reading label: its fibre, or that it has none. */
export const tattvaLabel = (v: V): string => {
  const name = strOf(v, 'tattva.name'), fibre = strOf(v, 'tattva.fibre')
  return name === undefined ? 'tattva' : fibre ?? 'no fibre'
}
/** What the tattva reading says on the status bar, with the standing of the constants it sets. */
export const tattvaDoes = (v: V): string => `The tattva of the M2 condition and its element fibre. Under Tattva its fibre sets the body's constants${
  strOf(v, 'tattva.standing') ? `, which stand ${strOf(v, 'tattva.standing')}` : ''}; a tattva with no fibre leaves them declared.`

/** The owner's own choices for the field's four determinants and its cadence (live/torusInstrument.ts), by the labels the binding
 * reads and writes. */
const asOptions = (list: readonly {label: string}[]) => list.map(option => ({value: option.label, label: option.label}))
const LENSES = asOptions(LIVE_LENS_OPTIONS), FRAMES = asOptions(LIVE_CONTEXT_FRAME_OPTIONS), BASES = asOptions(LIVE_HARMONIC_OPTIONS)
const CADENCES = asOptions(LIVE_CADENCE_OPTIONS)
const M3 = [{value: 'DNA', label: 'DNA', does: 'Transcribe the M3 clock as DNA.'}, {value: 'RNA', label: 'RNA', does: 'Transcribe the M3 clock as RNA.'}]

/** The field's determinants: lens, context frame, harmonic basis, M3 transcription. These are the field's real, mappable controls. Follow
 * (manual §21.2 Lens and mode) comes first: on, the Lens and Frame are the clip's mode, or the set's, and say so; a Lens or Frame moved by
 * hand or by a mapped control turns it off, and the readout says why (DLW build ruling 2026-11-05); off, they are yours. */
const determinants = (p: ViewProps) => <>
  <Toggle {...st(p, 'mode.follow')} label="Follow" does="Follow takes the clip's mode, or the set's when the clip has none. A Lens or Frame you move turns it off." on={on(p.v, 'mode.follow')}
    unknown={boolOf(p.v, 'mode.follow') === undefined} onChange={x => p.set('mode.follow', x)} />
  <Readout label="follows" does={st(p, 'mode.followed').disabled ?? 'The lens and mode Follow takes now.'} value={strOf(p.v, 'mode.followed')} tone="accent" />
  <Chooser {...st(p, 'lens')} label="Lens" does="The lens the field reads through, L0 to L5′." value={strOf(p.v, 'lens') ?? ''} options={LENSES} onChange={x => p.set('lens', x)} />
  <Chooser {...st(p, 'context-frame')} label="Frame" does="The context frame, CF1 to CF7." value={strOf(p.v, 'context-frame') ?? ''} options={FRAMES} onChange={x => p.set('context-frame', x)} />
  <Chooser {...st(p, 'harmonic-basis')} label="Basis" does="The harmonic basis: one of B1 to B8, or the selected row." value={strOf(p.v, 'harmonic-basis') ?? ''} options={BASES} onChange={x => p.set('harmonic-basis', x)} />
  <Radio {...st(p, 'm3-transcription')} label="M3" does="How the M3 clock is transcribed." value={strOf(p.v, 'm3-transcription') ?? ''} options={M3} stack onChange={x => p.set('m3-transcription', x)} />
</>

/** The compact four (manual §21.2 Compact): Rate, Fundamental, Carrier and Damping. */
/** The Carrier's words, by the owner's word for its drive (DLW §21.2 Carrier): the pulse's, or one an owner holds without driving. */
const carrierDoes = (p: ViewProps) => `How strongly the pulse drives the body between strikes.${strOf(p.v, 'carrier.drive') === 'unbuilt'
  ? ' The owner holds it; its drive is not built yet, so the body sounds only when struck.'
  : ' At 0 % the body sounds only when something strikes it; at rhythm rates the carrier beats; at pitch rates it sounds.'}`
/** The set's tempo as the transport shows it, to the hundredth. */
const bpm = (value: number | undefined) => (value === undefined ? undefined : `${Number(value.toFixed(2))} BPM`)

const macros = (p: ViewProps) => <>
  <ValueBox {...st(p, 'rate')} label="Rate" does="How fast the pulse steps round the ring. Setting it runs the pulse Free." value={numOf(p.v, 'rate') ?? NaN} def={2.5} scale={RATE} format={rateWords} onChange={x => p.set('rate', Number(x.toPrecision(3)))} />
  <ValueBox {...st(p, 'fundamental')} label="Fundamental" does="The note that place 0 stands on. Every voice is a ratio over it." value={numOf(p.v, 'fundamental') ?? NaN} scale={FUNDAMENTAL} format={hz} onChange={x => p.set('fundamental', Number(x.toPrecision(4)))} />
  <Dial {...st(p, 'carrier')} label="Carrier" does={carrierDoes(p)}
    value={numOf(p.v, 'carrier') ?? NaN} def={0} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('carrier', Math.round(x))} />
  <Dial {...st(p, 'damping')} disabled={st(p, 'damping').disabled ?? tattvaHold(p.v)} label="Damping" does="How sharply the body rings. A high value rings longer." value={numOf(p.v, 'damping') ?? NaN} def={4.5} scale={DAMP} format={fixed(1)} onChange={x => p.set('damping', x)} />
</>

/** Pulse (manual §21.2): Rate, Free or Sync, with its band beside it; the Fundamental; the Carrier. */
const pulse = (p: ViewProps) => <>
  <Radio {...st(p, 'rate.mode')} label="Rate" does="Free steps so many times a second; Sync once per note length at the set's tempo." value={strOf(p.v, 'rate.mode') ?? ''} options={RATE_MODES} stack onChange={x => p.set('rate.mode', x)} />
  {strOf(p.v, 'rate.mode') === 'sync'
    ? <Chooser {...st(p, 'rate.note')} label="Note" does="The note length the pulse steps once per, 1/64 to 8 bars." value={strOf(p.v, 'rate.note') ?? ''} options={NOTE_LENGTHS} onChange={x => p.set('rate.note', x)} />
    : <ValueBox {...st(p, 'rate')} label="Steps" does="How fast the pulse steps round the ring: one step a year to 40,000 a second." value={numOf(p.v, 'rate') ?? NaN} def={2.5} scale={RATE} format={rateWords} onChange={x => p.set('rate', Number(x.toPrecision(3)))} />}
  <Readout big label="band" does="The band the pulse stands in: Cosmic, Breath, Rhythm, Pitch or Beyond." value={strOf(p.v, 'band')} tone="accent" />
  <Readout label="Tempo" does={st(p, 'tempo').disabled ?? 'The set\'s tempo, from the transport, which Sync steps to.'} value={bpm(numOf(p.v, 'tempo'))} />
  <Radio {...st(p, 'fundamental.source')} label="Fundamental" does="Map takes the frequency the map gives the Sun, its 1:1; Hz, the one you set." value={strOf(p.v, 'fundamental.source') ?? ''} options={SOURCES} stack onChange={x => p.set('fundamental.source', x)} />
  <ValueBox {...st(p, 'fundamental')} label="Hz" does="The note that place 0 stands on, 20 to 2,000 Hz. Every voice is a ratio over it." value={numOf(p.v, 'fundamental') ?? NaN} scale={FUNDAMENTAL} format={hz} onChange={x => p.set('fundamental', Number(x.toPrecision(4)))} />
  <Dial {...st(p, 'carrier')} label="Carrier" does={carrierDoes(p)} value={numOf(p.v, 'carrier') ?? NaN} def={0} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('carrier', Math.round(x))} />
  <Readout label="drive" does={st(p, 'carrier.drive').disabled ?? 'The owner\'s word for the Carrier\'s drive.'} value={strOf(p.v, 'carrier.drive')} tone={strOf(p.v, 'carrier.drive') === 'unbuilt' ? 'stall' : undefined} />
</>

/** The tunings the scene holds voices for; a tuning it holds none of is dimmed and says so. */
const residentOf = (v: V): readonly string[] | undefined => { const raw = json<unknown>(v, 'tuning.resident', undefined); return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : undefined }

/** The M2 condition's maqām as the owner names it: its name, and its words for why the scene holds none of its voices. */
const maqamOf = (v: V): {name: string | null, absent: string | null} | undefined => {
  const raw = json<unknown>(v, 'tuning.maqam', undefined)
  if (!raw || typeof raw !== 'object') return undefined
  const {name, absent} = raw as Record<string, unknown>
  return {name: typeof name === 'string' ? name : null, absent: typeof absent === 'string' ? absent : null}
}

/** The surface the lens in force gives the sound (manual §21.2 "The body"; O-I #854), as the owner reports it: the lens and its face, and
 * how the surface takes the sound. */
const materialOf = (v: V): {lens: string; partner: string; face: string; colour: number[]; grain: number; give: number; affinity: number; tension: number} | undefined => {
  const raw = json<Record<string, unknown> | undefined>(v, 'material', undefined)
  return raw && typeof raw.lens === 'string' && typeof raw.partner === 'string' && typeof raw.face === 'string' && Array.isArray(raw.colour)
    && [raw.grain, raw.give, raw.affinity, raw.tension].every(x => typeof x === 'number') ? raw as never : undefined
}
const share = (x: number) => `${Math.round(x * 100)} %`
const material = (p: ViewProps) => {
  const m = materialOf(p.v)
  const does = m ? `The surface the lens in force gives the sound: grain ${share(m.grain)}, give ${share(m.give)}, particle affinity ${share(m.affinity)}, tension ${share(m.tension)}, colour rgb(${m.colour.map(c => Math.round(Number(c) * 255)).join(', ')}). Its partner ${m.partner} shows the same notes on the opposite surface.`
    : st(p, 'material').disabled ?? 'The surface the lens in force gives the sound.'
  return <Readout label="material" does={does} value={m ? `${m.lens} · ${m.face}` : undefined} />
}

/** Mode and tuning (manual §21.2): the lens and mode the Torus reads (the field's four determinants) and the Tuning. A tuning the scene
 * holds no voices for is not offered, and the Tuning says so; for the maqām, in the owner's words, before it is ever chosen. */
const modeAndTuning = (p: ViewProps) => {
  const resident = residentOf(p.v)
  const maqam = maqamOf(p.v)
  const absent = resident ? TUNINGS.filter(x => !resident.includes(x.value)) : []
  const said = absent.filter(x => x.value !== 'maqam' || !maqam?.absent).map(x => x.label)
  const why = absent.some(x => x.value === 'maqam') && maqam?.absent ? ` This scene holds no Maqām voices: ${maqam.absent.replace(/\.$/, '')}.` : ''
  const options = TUNINGS.filter(x => !resident || resident.includes(x.value))
    .map(x => x.value === 'maqam' && maqam?.name ? {...x, does: `The voices sound the M2 condition's maqām, ${maqam.name}. ${RESIDENT_VOICES}`} : x)
  return <>
    {determinants(p)}
    <Radio {...st(p, 'tuning')} label="Tuning" does={`What the voices sound.${said.length ? ` This scene holds no ${said.join(' or ')} voices.` : ''}${why}`} value={strOf(p.v, 'tuning') ?? ''}
      options={options} stack onChange={x => p.set('tuning', x)} />
    {material(p)}
  </>
}

/** Shape (manual §21.2): the Shape, the figure it shows now, and the Comma gathered since the Torus opened. */
const shape = (p: ViewProps) => <>
  <Chooser {...st(p, 'shape')} label="Shape" does="Auto changes shape by the pulse; Sequence follows the shapes you set in the scene; any other holds that shape." value={strOf(p.v, 'shape') ?? ''} options={SHAPES} onChange={x => p.set('shape', x)} />
  <Readout label="figure" does={st(p, 'figure').disabled ?? 'The figure the torus shows now.'} value={has(p.v, 'figure') ? FIGURE_WORD[strOf(p.v, 'figure')!] ?? strOf(p.v, 'figure') : undefined} />
  <Readout big label="comma" does="The comma gathered since the Torus opened, one Pythagorean comma for each full return of the pulse. You read it; you do not set it." value={has(p.v, 'comma') ? cents(num(p.v, 'comma')) : undefined} />
</>

/** What you see and hear of the field: its sound, its cadence, its scale, its level, and the owner's standing. */
const seeAndHear = (p: ViewProps) => <>
  <Toggle {...st(p, 'sound')} label="Sound" does="Whether the field sounds." on={on(p.v, 'sound')} unknown={boolOf(p.v, 'sound') === undefined} onChange={x => p.set('sound', x)} />
  <Radio {...st(p, 'cadence')} label="Cadence" does="How fast the field ticks: held, 1 or 12 ticks a second." value={strOf(p.v, 'cadence') ?? ''} options={CADENCES} stack onChange={x => p.set('cadence', x)} />
  <ValueBox {...st(p, 'scale')} label="Scale" does="The field's scale, in units a metre." value={numOf(p.v, 'scale') ?? NaN} def={100} scale={{min: 40, max: 400}} format={x => `${Math.round(x)} u/m`} onChange={x => p.set('scale', x)} />
  <ValueBox {...st(p, 'level')} label="Level" does="The loudness of the sound." value={numOf(p.v, 'level') ?? NaN} def={-6} scale={{min: -60, max: 12}} format={db} onChange={x => p.set('level', x)} />
  <Readout label="standing" does="The owner's standing: following, held, or another state the owner names." value={strOf(p.v, 'standing')} />
</>


// ---------------------------------------------------------------- the Stage page: the live scene's procedural stage

const SLOTS = [{id: 'form', word: 'Form'}, {id: 'material.damping', word: 'Damping'}, {id: 'clock.inscription', word: 'Inscription'}, {id: 'clock.lensing', word: 'Lensing'}] as const
interface Proc {readonly ref: string; readonly revision?: number; readonly trigger: string; readonly selector: readonly string[]; readonly scenes?: number}
interface Bound {readonly procedure: string; readonly trigger?: string; readonly evaluations: number; readonly max: number; readonly standing: string}
const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const procsOf = (v: V): Proc[] | undefined => { const raw = json<unknown>(v, 'stage.procedures', undefined)
  return Array.isArray(raw) ? raw.flatMap((x): Proc[] => (isRec(x) && typeof x.ref === 'string' && typeof x.trigger === 'string' ? [{ref: x.ref, revision: typeof x.revision === 'number' ? x.revision : undefined,
    trigger: x.trigger, selector: Array.isArray(x.selector) ? x.selector.filter((y): y is string => typeof y === 'string') : [], scenes: typeof x.scenes === 'number' ? x.scenes : undefined}] : [])) : undefined }
const slotsOf = (v: V): Map<string, {owner?: string; revision?: number}> | undefined => { const raw = json<unknown>(v, 'stage.slots', undefined)
  return Array.isArray(raw) ? new Map(raw.flatMap((x): [string, {owner?: string; revision?: number}][] => (isRec(x) && typeof x.slot === 'string'
    ? [[x.slot, {owner: typeof x.owner === 'string' ? x.owner : undefined, revision: typeof x.revision === 'number' ? x.revision : undefined}]] : []))) : undefined }
const boundOf = (v: V): Bound[] | undefined => { const raw = json<unknown>(v, 'stage.bindings', undefined)
  return Array.isArray(raw) ? raw.flatMap((x): Bound[] => (isRec(x) && typeof x.procedure === 'string' && typeof x.evaluations === 'number' && typeof x.max === 'number'
    ? [{procedure: x.procedure, trigger: typeof x.trigger === 'string' ? x.trigger : undefined, evaluations: x.evaluations, max: x.max, standing: typeof x.standing === 'string' ? x.standing : 'active'}] : [])) : undefined }
/** 'ta-onta:stage:cli-fold' → 'cli-fold'. */
const procWord = (ref: string | undefined) => (ref === undefined ? undefined : ref.slice(ref.lastIndexOf(':') + 1))
const TRIGGER_WORD: Record<string, string> = {'invocation': 'on Evaluate', 'm1-advance': 'each step of the ring', 'replace-event': 'each new event'}
const chosenProc = (v: V) => { const r = strOf(v, 'stage.procedure'); return procsOf(v)?.find(x => x.ref === r) }

/** The stage: its four slots as lanes, each driven by its authored state (hollow) or owned by a procedure (filled, named). The procedure you
 * chose outlines the slots it would claim; one another procedure owns is marked, because the owner refuses that write. */
function StageWell({v, w, h, labels}: {v: V; w: number; h: number; labels: boolean}) {
  const slots = slotsOf(v), proc = chosenProc(v), x0 = labels ? 62 : 8, x1 = w - 8, top = labels ? 14 : 4, lane = (h - top - 22) / 4, fs = labels ? 8.5 : 7
  if (!slots) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{w > 100 ? 'No reading of the stage' : NONE}</text>
  return <g>
    {SLOTS.map((sl, i) => { const y = top + i * lane, held = slots.get(sl.id), owner = held?.owner, claims = proc?.selector.includes(sl.id), clash = claims && owner !== undefined && owner !== proc?.ref
      return <g key={sl.id}>
        {labels && <text x={x0 - 6} y={y + lane / 2 + 3} textAnchor="end" className="dp-axis" style={{fontSize: fs}}>{sl.word}</text>}
        <rect x={x0} y={y + 3} width={x1 - x0} height={lane - 6} rx={3} fill={owner ? 'var(--dp-value)' : 'none'} opacity={owner ? .3 : 1}
          stroke="var(--dp-value-dim)" strokeWidth={.8} strokeDasharray={owner ? undefined : '3 2'} />
        <text x={x0 + 6} y={y + lane / 2 + 3} className={owner ? 'dp-ink' : 'dp-axis'} style={{fontSize: fs}}>{owner ? `${procWord(owner)}${held?.revision !== undefined ? ` r${held.revision}` : ''}` : labels ? 'authored' : ''}</text>
        {claims && <rect x={x0 - 2} y={y + 1} width={x1 - x0 + 4} height={lane - 2} rx={4} fill="none" stroke={clash ? 'var(--stall)' : 'var(--dp-on)'} strokeWidth={1.2} />}
        {clash && <text x={x1 - 6} y={y + lane / 2 + 3} textAnchor="end" style={{fontSize: fs + 1, fill: 'var(--stall)'}}>!</text>}
      </g> })}
    <path d={`M${x0} ${h - 18}H${x1}`} className="dp-faint" />
    <text x={x0} y={h - 6} className="dp-axis" style={{fontSize: fs}}>{proc ? `${procWord(proc.ref)} · ${labels ? TRIGGER_WORD[proc.trigger] ?? proc.trigger : proc.trigger}` : 'No procedure chosen'}</text>
  </g>
}

function stageActs(p: ViewProps) {
  const v = p.v, proc = chosenProc(v), slots = slotsOf(v), bound = boundOf(v)?.find(b => b.procedure === proc?.ref)
  const clash = proc?.selector.map(x => ({x, owner: slots?.get(x)?.owner})).find(c => c.owner !== undefined && c.owner !== proc.ref)
  const owns = proc !== undefined && [...(slots?.values() ?? [])].some(x => x.owner === proc.ref)
  const none = proc ? undefined : 'Choose a procedure first.'
  return {
    evaluate: <Action {...st(p, 'stage.evaluate')} label="Evaluate" does="Run the procedure once on the live stage. Its receipt comes back with the field as it stands."
      onPress={() => proc && p.set('stage.evaluate', proc.ref)} disabled={st(p, 'stage.evaluate').disabled ?? none ?? (clash ? `${SLOTS.find(x => x.id === clash.x)?.word} is held by ${procWord(clash.owner)}: retire it first.` : undefined)} />,
    bind: <Action {...st(p, 'stage.bind')} label="Bind" does="Bind the procedure to the live flow: it fires at each admitted step of its trigger, until its budget is spent."
      onPress={() => proc && p.set('stage.bind', proc.ref)} disabled={st(p, 'stage.bind').disabled ?? none ?? (proc!.trigger === 'invocation' ? 'It runs when you evaluate it, so it binds to nothing.' : undefined)} />,
    unbind: <Action {...st(p, 'stage.unbind')} label="Unbind" does="Remove the binding. The answer names its final standing."
      onPress={() => proc && p.set('stage.unbind', proc.ref)} disabled={st(p, 'stage.unbind').disabled ?? none ?? (bound ? undefined : 'The procedure is not bound.')} />,
    retire: <Action {...st(p, 'stage.retire')} label="Retire" does="Release the slots the procedure holds. They return to their authored state; what it left stays as authored material."
      onPress={() => proc && p.set('stage.retire', proc.ref)} disabled={st(p, 'stage.retire').disabled ?? none ?? (owns ? undefined : 'The procedure holds no slot.')} />,
  }
}
const boundRows = (v: V): RowItem[] => (boundOf(v) ?? []).map(b => ({id: b.procedure, name: procWord(b.procedure) ?? b.procedure, light: b.standing === 'active' ? 'lit' : 'dark', tone: 'value',
  note: `${b.evaluations}/${b.max}`, meter: <Meter value={b.max ? b.evaluations / b.max : undefined} tone={b.standing === 'active' ? 'value' : 'accent'} label="Budget used" />,
  why: b.standing === 'exhausted' ? 'Its budget is spent: it fires no more until you bind it again.' : undefined, does: `${b.procedure} · ${TRIGGER_WORD[b.trigger ?? ''] ?? b.trigger ?? NONE}`}))

function StagePage({p}: {p: ViewProps}) {
  const a = stageActs(p), procs = procsOf(p.v), proc = chosenProc(p.v), slots = slotsOf(p.v)
  return <>
    <Band>
      <Section width={198}><Display w={186} h={146} label="The stage" corner={slots ? `${[...slots.values()].filter(x => x.owner).length}/4 owned` : NONE}
        does="The stage's four slots: hollow, its authored state drives the slot; filled, a procedure owns it. The outline is what the chosen procedure would claim; ! where another holds it.">
        <StageWell v={p.v} w={186} h={146} labels /></Display></Section>
      <Section label="Procedure" width={124}>
        <Chooser {...st(p, 'stage.procedure')} label="Procedure" does="The procedure to run, from the ones you keep." value={strOf(p.v, 'stage.procedure') ?? ''}
          options={(procs ?? []).map(x => ({value: x.ref, label: procWord(x.ref) ?? x.ref, does: `${x.ref} r${x.revision ?? NONE}`}))} onChange={x => p.set('stage.procedure', x)}
          disabled={st(p, 'stage.procedure').disabled ?? (procs === undefined ? 'No reading of the procedures you keep.' : procs.length ? undefined : 'No procedures kept.')} />
        <ValueBox {...st(p, 'stage.budget')} label="Budget" does="How often a bound procedure may fire before it stops." value={numOf(p.v, 'stage.budget') ?? NaN} def={16}
          scale={{min: 1, max: 1024, log: true, step: 1}} format={x => `${Math.round(x)}`} onChange={x => p.set('stage.budget', Math.round(x))} />
      </Section>
      <Section label="Acts" cols={2} grow>{a.evaluate}{a.bind}{a.unbind}{a.retire}</Section>
    </Band>
    <Band>
      <Section label="Bound" width={198}><Rows does="The procedures bound to the live flow, with the budget each has used." items={boundOf(p.v) ? boundRows(p.v) : undefined}
        why="No reading of the bindings." empty="Nothing is bound to the live flow." size={4} /></Section>
      <Section label="Receipt" cols={2} grow>
        <Readout big label="last" does="The standing of the last receipt the host returned." value={strOf(p.v, 'stage.last')} tone={strOf(p.v, 'stage.last') === 'refused' ? 'stall' : 'value'} />
        <Readout label="trigger" does="What fires the chosen procedure." value={proc ? (proc.trigger === 'invocation' ? 'you' : proc.trigger) : undefined} />
        <Readout label="claims" does="The slots the chosen procedure addresses." value={proc ? (proc.selector.map(x => SLOTS.find(y => y.id === x)?.word ?? x).join(' · ') || 'none') : undefined} />
        <Readout label="scenes" does="The scenes of its passage, 2 to 8: the one it stands and those that follow." value={proc ? proc.scenes ?? 'none' : undefined} />
        {strOf(p.v, 'stage.why') !== undefined && <Readout label="refused" does={`The owner refused: ${strOf(p.v, 'stage.why')}`} value="why" tone="stall" />}
      </Section>
    </Band>
  </>
}

/** Save the Torus as it rings as a sound (O-I #852, manual §21.2 "Save the instrument as you tuned it"): named here and saved through its
 * owners (live/LivePresets.tsx saveTorusSound: the owner keeps a checkpoint, the kernel seals the sound from it, the Scene keeps it). The
 * sound then stands under the Torus in the browser's Instruments. Keep instrument (Tips: "make a form the body, make sounds on it, and
 * keep it") keeps the form's body the sound saved here rings on, under the same name field, with the sounds made on it
 * (LivePresets.tsx keepTorusInstrument); it waits on such a sound, and says so. What the owners said stands on the Info line; a refusal
 * is said plainly (shared/Refusal.tsx refusalWords): what happened, then the owners' words when they are words. */
const UNSAVED = 'The sound was not saved.', UNKEPT = 'The instrument was not kept.'
const KEEP_WAITS = "Save a sound on a form's body first: an instrument is a form's body with the sounds made on it."
const KEEP_ON_TORUS = "The sound saved here rings on the torus itself. Make a form the body and save a sound on it: an instrument is a form's body with the sounds made on it."
/** A control across both of the section's columns (the kit's columns are 56 px: a name reads whole across two). */
const span2 = (child: ReactNode) => <div style={{gridColumn: 'span 2', width: '100%'}}>{child}</div>
type Said = {readonly pending?: boolean; readonly refused?: string; readonly done?: string}
function SaveSound() {
  const [name, setName] = useState('')
  const [said, setSaid] = useState<Said>({})
  const [kept, setKept] = useState<Said>({})
  // The sound saved here last, and whether it rings on a form's body (the kernel's sealed record says).
  const [saved, setSaved] = useState<{readonly sound_ref: string; readonly form: boolean} | null>(null)
  // The name commits as the field is left (Enter, or the press that leaves it), so the press saves the name as typed.
  const save = () => {
    setSaid({pending: true})
    void import('../../../live/LivePresets').then(presets => presets.saveTorusSound(name))
      .then(answer => {
        if (!answer.ok) return setSaid({refused: refusalWords(UNSAVED, answer.error)})
        setSaid({done: answer.words}); setSaved({sound_ref: answer.sound_ref, form: answer.form}); setKept({})
      }, (cause: unknown) => setSaid({refused: refusalWords(UNSAVED, cause)}))
  }
  const keep = () => {
    if (!saved) return
    setKept({pending: true})
    void import('../../../live/LivePresets').then(presets => presets.keepTorusInstrument(name, saved.sound_ref))
      .then(answer => setKept(answer.ok ? {done: answer.words} : {refused: refusalWords(UNKEPT, answer.error)}), (cause: unknown) => setKept({refused: refusalWords(UNKEPT, cause)}))
  }
  return <>
    {span2(<TextField label="Name" does="The name the browser lists it by, under the Torus: the sound you save, or the instrument you keep." value={name}
      placeholder="New sound" wide onChange={setName} />)}
    {span2(<Action label="Save sound" does={said.done ?? 'Saves the Torus as it rings now, every parameter, as a sound the Scene keeps.'}
      pending={said.pending} refused={said.refused} onPress={save} />)}
    {span2(<Action label="Keep instrument" does={kept.done ?? "Keeps the form's body the sound you saved rings on, with every sound made on it, as an instrument under the Torus."}
      disabled={!saved ? KEEP_WAITS : !saved.form ? KEEP_ON_TORUS : undefined} pending={kept.pending} refused={kept.refused} onPress={keep} />)}
  </>
}

// ── the rack face ────────────────────────────────────────────────────────────

/** What a macro may turn on the Torus, each with the range a new macro turns it over and the scale its ends are set on: the compact four
 * first (manual §21.2 Compact). Rate's range is the Rhythm band, 0.5 to 20 steps a second, where the pulse is a beat you could tap. */
export const TORUS_RACK_TARGETS = [
  {parameter: 'rate', name: 'Rate', min: 0.5, max: 20, scale: RATE, format: rateWords},
  {parameter: 'fundamental', name: 'Fundamental', min: 20, max: 2000, scale: FUNDAMENTAL, format: hz},
  {parameter: 'carrier', name: 'Carrier', min: 0, max: 100, scale: {min: 0, max: 100}, format: pct},
  {parameter: 'damping', name: 'Damping', min: .1, max: 40, scale: DAMP, format: fixed(1)},
  {parameter: 'strike', name: 'Strike', min: 0, max: 100, scale: {min: 0, max: 100}, format: pct},
  {parameter: 'pan', name: 'Pan', min: -1, max: 1, scale: {min: -1, max: 1}, format: fixed(2)},
] as const
/** One macro of the rack face: its name, the Torus parameter it turns, and the range it turns it over. */
export interface TorusMacro {readonly name: string; readonly parameter: string; readonly min: number; readonly max: number}
/** The most macros the face draws, as Live shows eight (a kept rack holds up to sixteen, kernel kept.rs MAX_MACROS). */
const FACE_MACROS = 8, FACE_MACROS_WORD = 'eight'
const targetOf = (parameter: string) => TORUS_RACK_TARGETS.find(target => target.parameter === parameter)
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const isMacro = (raw: unknown): raw is TorusMacro => !!raw && typeof raw === 'object' && typeof (raw as TorusMacro).name === 'string'
  && !!targetOf((raw as TorusMacro).parameter) && finite((raw as TorusMacro).min) && finite((raw as TorusMacro).max)
/** The face's macros, as you hold them; the compact four over their ranges until you change them. Pure. */
export function torusMacros(v: V): TorusMacro[] {
  const raw = json<unknown>(v, 'macros', undefined)
  if (Array.isArray(raw) && raw.every(isMacro)) return raw.slice(0, FACE_MACROS)
  return TORUS_RACK_TARGETS.slice(0, 4).map(({parameter, name, min, max}) => ({name, parameter, min, max}))
}
/** Where a macro stands, 0 to 1, read back from its parameter within its range (at an end past it); undefined with no reading. Pure. */
export function macroAt(v: V, macro: TorusMacro): number | undefined {
  const x = numOf(v, macro.parameter)
  if (!finite(x)) return undefined
  return macro.max === macro.min ? 0 : clampTo(0, 1, (x - macro.min) / (macro.max - macro.min))
}
/** The value a macro at `x` (0 to 1) gives its parameter: min at 0, max at 1, a straight line between. Pure. */
export const macroTurn = (macro: TorusMacro, x: number): number => macro.min + clampTo(0, 1, x) * (macro.max - macro.min)
/** A parameter's value as its own control settles it (whole percents for Carrier and Strike, four figures otherwise). */
const settle = (parameter: string, x: number) => (parameter === 'carrier' || parameter === 'strike' ? Math.round(x) : Number(x.toPrecision(4)))
const figure = (x: number) => `${Number(x.toPrecision(4))}`
interface RackVariation {readonly name: string; readonly values: readonly number[]}
const variationsOf = (v: V): RackVariation[] => {
  const raw = json<unknown>(v, 'variations', [])
  return Array.isArray(raw) ? raw.filter((row): row is RackVariation => !!row && typeof row === 'object' && typeof row.name === 'string'
    && Array.isArray(row.values) && row.values.every(finite)) : []
}
type RackChainDevice = {readonly device_ref: string; readonly role: 'note' | 'effect'; readonly state: Readonly<Record<string, number | boolean | string>>}
const chainOf = (v: V): RackChainDevice[] | undefined => {
  const raw = json<unknown>(v, 'chain', undefined)
  return Array.isArray(raw) ? raw.filter((row): row is RackChainDevice => !!row && typeof row === 'object' && typeof row.device_ref === 'string'
    && (row.role === 'note' || row.role === 'effect') && !!row.state && typeof row.state === 'object') : undefined
}
const CHAIN_WORDS: Readonly<Record<string, string>> = {filter: 'Filter', dynamics: 'Dynamics', delay: 'Delay', reverb: 'Reverb', resonator: 'Resonator bank'}
/** The rack the face keeps (kernel kept.rs KeptRack, less its name, ref and sound): the chain the owner reports, each macro where it
 * stands with the one parameter it turns over its range, and the variations; or why there is none to keep yet, in words. Pure. */
export function torusRackDraft(v: V): {chain: RackChainDevice[]; macros: {name: string; value: number; targets: {device_ref: 'torus'; parameter: string; min: number; max: number}[]}[]
  variations: RackVariation[]} | {reason: string} {
  const chain = chainOf(v)
  if (!chain) return {reason: 'The owner reports no chain for the Torus yet, so there is no rack to keep.'}
  const macros = torusMacros(v), placed = []
  for (const macro of macros) {
    const at = macroAt(v, macro)
    if (at === undefined) return {reason: `${macro.name} has no reading, so its macro cannot say where it stands.`}
    placed.push({name: macro.name, value: at, targets: [{device_ref: 'torus' as const, parameter: macro.parameter, min: macro.min, max: macro.max}]})
  }
  const variations = variationsOf(v), short = variations.find(row => row.values.length !== macros.length)
  if (short) return {reason: `${short.name} holds ${short.values.length} values for ${macros.length} macros: store it again.`}
  return {chain, macros: placed, variations}
}

/** A kept rack as the Scene keeps it (kernel kept.rs KeptRack): each macro with where it stands and what it turns over which range, and its
 * variations, each a value for every macro. */
interface KeptRackFace {
  readonly macros: readonly {readonly name: string; readonly value: number; readonly targets: readonly {readonly device_ref: string; readonly parameter: string; readonly min: number; readonly max: number}[]}[]
  readonly variations: readonly {readonly name: string; readonly values: readonly number[]}[]
}
const named = (names: readonly string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)
/** A kept rack opened on the face, the inverse of torusRackDraft (O-I #852; manual §21.2 To use the Torus, 9: "opens with its macros where
 * they stood"): each macro that turns one parameter of the Torus a macro of the face turns, over its range, up to the eight the face draws;
 * the variations, each with the values of the macros it holds. Where each macro stands is read from its parameter, which the rack's sound
 * sets. What the face cannot hold is said in words; with no macro it can hold, it holds none. Pure. */
export function torusRackFace(rack: KeptRackFace): {macros: TorusMacro[]; variations: RackVariation[]; unheld: string[]} {
  const held: number[] = [], off: string[] = [], past: string[] = []
  rack.macros.forEach((macro, i) => {
    const [target, ...more] = macro.targets
    if (!target || more.length || target.device_ref !== 'torus' || !targetOf(target.parameter) || !finite(target.min) || !finite(target.max)) off.push(macro.name)
    else if (held.length >= FACE_MACROS) past.push(macro.name)
    else held.push(i)
  })
  const unheld = [
    ...(off.length ? [`${named(off)} ${off.length === 1 ? 'stays' : 'stay'} off the face, whose macros each turn one parameter of the Torus`] : []),
    ...(past.length ? [`${named(past)} ${past.length === 1 ? 'stays' : 'stay'} off the face, which draws ${FACE_MACROS_WORD} macros`] : []),
  ]
  if (!held.length) return {macros: [], variations: [], unheld}
  const macros = held.map(i => { const {name} = rack.macros[i]!, {parameter, min, max} = rack.macros[i]!.targets[0]!; return {name, parameter, min, max} })
  const variations = rack.variations.map(row => ({name: row.name, values: held.map(i => row.values[i]!)}))
  return {macros, variations, unheld}
}

const UNKEPT_RACK = 'The rack was not kept.'
/** Keep rack: the Torus as it rings, its chain, its macros and its variations, kept under the name typed here (LivePresets.tsx
 * keepTorusRack); it waits on a draft it can keep, and says why. */
function KeepRack({v}: {v: V}) {
  const [name, setName] = useState('')
  const [said, setSaid] = useState<Said>({})
  const draft = torusRackDraft(v)
  const keep = () => {
    if ('reason' in draft) return
    setSaid({pending: true})
    void import('../../../live/LivePresets').then(presets => presets.keepTorusRack(name, draft))
      .then(answer => setSaid(answer.ok ? {done: answer.words} : {refused: refusalWords(UNKEPT_RACK, answer.error)}), (cause: unknown) => setSaid({refused: refusalWords(UNKEPT_RACK, cause)}))
  }
  return <>
    {span2(<TextField label="Name" does="The name the browser lists the rack by. Keeping it again under the same name replaces it." value={name} placeholder="New rack" wide onChange={setName} />)}
    {span2(<Action label="Keep rack" does={said.done ?? 'Keeps the Torus as it rings, its chain, its macros with their ranges and its variations as a rack in the browser.'}
      disabled={'reason' in draft ? draft.reason : undefined} pending={said.pending} refused={said.refused} onPress={keep} />)}
  </>
}

/** The Macros page (the rack face): each macro turning its parameter over its range; the range of the one you choose; the variations,
 * each where every macro stood; and Keep rack with the chain it keeps. Two bands, as every page of the device. */
function MacrosPage({p}: {p: ViewProps}) {
  const macros = torusMacros(p.v), variations = variationsOf(p.v), chain = chainOf(p.v)
  const chosen = clampTo(0, Math.max(0, macros.length - 1), Math.round(numOf(p.v, 'macro') ?? 0)), macro = macros[chosen]
  const target = macro ? targetOf(macro.parameter) : undefined
  const positions = macros.map(m => macroAt(p.v, m))
  const setMacros = (next: TorusMacro[], values: (row: RackVariation) => number[]) => {
    p.set('macros', JSON.stringify(next))
    if (variations.length) p.set('variations', JSON.stringify(variations.map(row => ({name: row.name, values: values(row)}))))
  }
  const edit = (change: Partial<TorusMacro>) => macro && p.set('macros', JSON.stringify(macros.map((m, i) => (i === chosen ? {...m, ...change} : m))))
  const free = TORUS_RACK_TARGETS.find(t => !macros.some(m => m.parameter === t.parameter))
  const add = () => {
    if (!free) return
    const added = {name: free.name, parameter: free.parameter, min: free.min, max: free.max}
    setMacros([...macros, added], row => [...row.values, macroAt(p.v, added) ?? 0]); p.set('macro', macros.length)
  }
  const remove = () => { setMacros(macros.filter((_, i) => i !== chosen), row => row.values.filter((_, i) => i !== chosen)); p.set('macro', Math.max(0, chosen - 1)) }
  const recall = (id: string) => {
    const row = variations[Number(id)]
    if (row) macros.forEach((m, i) => { if (row.values[i] !== undefined && !st(p, m.parameter).disabled) p.set(m.parameter, settle(m.parameter, macroTurn(m, row.values[i]!))) })
  }
  const unread = macros.find((_, i) => positions[i] === undefined)
  const store = () => !unread && p.set('variations', JSON.stringify([...variations, {name: `Variation ${variations.length + 1}`, values: positions as number[]}]))
  return <>
    <Band>
      <Section label="Macros" cols={4} grow>
        {macros.map((m, i) => <Dial key={`${m.parameter}-${i}`} disabled={st(p, m.parameter).disabled} label={m.name}
          does={`Turns the Torus's ${m.parameter} from ${figure(m.min)} to ${figure(m.max)}.`} value={positions[i] ?? NaN} def={0} scale={{min: 0, max: 1}} format={share}
          onChange={x => p.set(m.parameter, settle(m.parameter, macroTurn(m, x)))} />)}
      </Section>
      <Section label="Range" cols={2} width={168}>
        <Chooser label="Macro" does="The macro whose range you set." value={String(chosen)} options={macros.map((m, i) => ({value: String(i), label: m.name}))} onChange={x => p.set('macro', Number(x))} />
        <Chooser label="Turns" does="The parameter of the Torus the macro turns." value={macro?.parameter ?? ''} options={TORUS_RACK_TARGETS.map(t => ({value: t.parameter, label: t.name}))}
          onChange={x => { const t = targetOf(x); if (t) edit({name: t.name, parameter: t.parameter, min: t.min, max: t.max}) }} />
        <ValueBox label="From" does="Where the parameter stands with the macro at 0." value={macro?.min ?? NaN} scale={target?.scale ?? {min: 0, max: 1}} format={target?.format ?? figure}
          onChange={x => edit({min: settle(macro?.parameter ?? '', x)})} />
        <ValueBox label="To" does="Where the parameter stands with the macro at 1. Set it below From and the macro turns it down." value={macro?.max ?? NaN}
          scale={target?.scale ?? {min: 0, max: 1}} format={target?.format ?? figure} onChange={x => edit({max: settle(macro?.parameter ?? '', x)})} />
        <Action label="Add" does="Adds a macro on the next parameter no macro turns yet." disabled={macros.length >= FACE_MACROS ? `The face shows ${FACE_MACROS} macros.` : !free ? 'Every parameter a macro can turn has one.' : undefined} onPress={add} />
        <Action label="Remove" does="Removes the macro you chose, and its value from every variation." disabled={macros.length <= 1 ? 'A rack keeps one macro at least.' : undefined} onPress={remove} />
      </Section>
    </Band>
    <Band>
      <Section label="Variations" cols={2} grow>
        {span2(<Rows does="The stored variations, each where every macro stood. Press one and every macro moves there." size={4} empty="No variation is stored yet. Store keeps where every macro stands."
          items={variations.map((row, i) => ({id: String(i), name: row.name, light: 'lit' as LightState, note: row.values.map(share).join(' · ')}))} onSelect={recall} />)}
        {span2(<Action label="Store" does="Stores where every macro stands now as a variation." disabled={unread ? `${unread.name} has no reading, so where it stands cannot be stored.` : undefined} onPress={store} />)}
      </Section>
      <Section label="Keep rack" cols={2}>
        {span2(<Readout label="chain" does={st(p, 'chain').disabled ?? 'The effects on the Torus\'s chain, which the rack keeps.'}
          value={chain ? (chain.length ? chain.map(d => CHAIN_WORDS[d.device_ref] ?? d.device_ref).join(' · ') : 'the Torus alone') : undefined} />)}
        <KeepRack v={p.v} />
      </Section>
    </Band>
  </>
}

export const torus: DesignedDevice = {
  id: 'quaternal-logic:torus',
  title: 'Torus',
  kind: 'instrument',
  defaults: {
    light: 'lit',
    // The Torus's M1′ session (QL's torus-state), as a scene opens it: Free at 2.5 steps a second, a rhythm; the map's 1:1; no carrier.
    'rate.mode': 'free', rate: 2.5, tempo: 120, band: 'Rhythm', 'fundamental.source': 'map', fundamental: 130.81, carrier: 0, 'carrier.drive': 'pulse',
    shape: 'auto', figure: 'figure-eight', comma: 0, tuning: 'logic', 'tuning.resident': JSON.stringify(['logic', 'sky']), polyphony: 16, notes: 3,
    body: 'torus', strike: 70, damping: 4.5, modes: 8, level: -6, pan: 0, view: 'surface', receiver: false, 'receiver.shared': '', 'receiver.return': 'world', meter: -14,
    // The field's own controls, as the binding reads them (labels of the owner's choices).
    lens: 'L0', 'context-frame': 'CF1', 'harmonic-basis': 'B1', 'm3-transcription': 'DNA', sound: true, cadence: 'Hold', scale: 100, standing: 'following',
    // Follow (manual §21.2 default): the set's Ionian on L0, which is CF1.
    'mode.follow': true, 'mode.followed': 'Set: Ionian, L0',
    material: JSON.stringify({lens: 'L0', partner: 'L0′', face: 'day', valence: 1, colour: [0.78, 0.62, 0.32], grain: 0.3, give: 0.65, affinity: 0.5, tension: 0.4}),
    sounding: JSON.stringify([0, 4, 8]),
    // The tattva of the M2 condition (the M2 request's tattva selection) and its fibre; Declared keeps the body's own constants.
    'body.source': 'declared', 'tattva.name': 'Prithvi', 'tattva.fibre': 'earth', 'tattva.standing': 'proposed',
    // The stage, as `ql stage state` discloses it before any procedure: every slot authored, nothing bound. The procedures kept are QL's
    // own (fixtures/kernel/stage-procedure-example-v1.json, and the determinant procedure of crates/ql-cli/tests/stage_native.rs).
    'stage.slots': JSON.stringify(['form', 'material.damping', 'clock.inscription', 'clock.lensing'].map(slot => ({slot}))), 'stage.bindings': JSON.stringify([]),
    'stage.procedures': JSON.stringify([{ref: 'ta-onta:stage:cli-fold', revision: 1, trigger: 'invocation', selector: ['form'], scenes: 3},
      {ref: 'ta-onta:stage:cli-bound', revision: 1, trigger: 'm1-advance', selector: []}]),
    'stage.procedure': 'ta-onta:stage:cli-fold', 'stage.budget': 16,
    // M1′'s rack, read from the M registry at revision c211a781 with the ledger's rungs; the parts carried as §21.2 names them.
    rack: RACK_M1, 'rack.part': '1',
    // The rack face: the compact four over their ranges (no macros held), one variation, and the Delay on the Torus's chain.
    chain: JSON.stringify([{device_ref: 'delay', role: 'effect', state: {on: true, time: 375, feedback: 40, mix: 25}}]),
    variations: JSON.stringify([{name: 'Variation 1', values: [0.1026, 0.056, 0, 0.1103]}]),
  },
  firstPage: 'field',
  fixtures: {
    'Ringing': {},
    // M2's proposed body constants for the earth fibre: Damping 12, Strike 45 %.
    'Tattva: Prithvi, earth': {'body.source': 'tattva', damping: 12, strike: 45},
    // A form rings (O-I #852): the scene's M3 form folded at its angles, eight modes a voice at the earth fibre's Q.
    'A form rings': {body: 'form', 'body.form': '#3-2-4', modes: 8, damping: 12},
    // The pulse at pitch: 440 steps a second, the torus shape; twelve returns gathered.
    'Pulse at pitch': {rate: 440, band: 'Pitch', figure: 'torus', comma: 281.52},
    // Sync, a quarter note at 120 BPM: two steps a second; the sky's voices.
    'Sync, a quarter note': {'rate.mode': 'sync', 'rate.note': '1/4', rate: 2, tuning: 'sky', carrier: 25},
    'Sequence: the scene sets the shapes': {shape: 'sequence', figure: undefined},
    // Where you stand, shared under a reference (O-I #856): Receiver On, the shared place's reference, and Return reading Shared.
    'Shared under a reference': {receiver: true, 'receiver.shared': 'room-7', 'receiver.return': 'shared'},
    'Lens and mode chosen, the wire drawn': {'mode.follow': false, 'mode.followed': undefined, lens: 'L3′', 'context-frame': 'CF2', view: 'wire'},
    'Tattva without a fibre': {'body.source': 'tattva', 'tattva.name': 'Akasha', 'tattva.fibre': undefined},
    // The condition's maqām with no Bimba spelling: the owner's words for its absence (QL scene_field.rs maqam_reading).
    'Maqām without a spelling': {'tuning.maqam': JSON.stringify({name: 'Kirdan', absent: 'maqām Kirdan (#2-4.3-0-4), the condition\'s tonic, has no Bimba spelling in the map, so its eight pitches have no source, and no other tuning stands in'})},
    'Stage, the fold evaluated': {'stage.slots': JSON.stringify([{slot: 'form', owner: 'ta-onta:stage:cli-fold', revision: 1}, {slot: 'material.damping'}, {slot: 'clock.inscription'}, {slot: 'clock.lensing'}]), 'stage.last': 'applied'},
    'Stage, a strike bound to the ring': {'stage.procedure': 'ta-onta:stage:cli-bound', 'stage.last': 'applied',
      'stage.bindings': JSON.stringify([{procedure: 'ta-onta:stage:cli-bound', trigger: 'm1-advance', evaluations: 5, max: 16, standing: 'active'}])},
    'Stage, the budget spent': {'stage.procedure': 'ta-onta:stage:cli-bound', 'stage.last': 'applied',
      'stage.bindings': JSON.stringify([{procedure: 'ta-onta:stage:cli-bound', trigger: 'm1-advance', evaluations: 16, max: 16, standing: 'exhausted'}])},
    'No readings': Object.fromEntries(['stage.slots', 'stage.bindings', 'stage.procedures', 'stage.procedure', 'stage.budget', 'stage.last', 'stage.why', 'rack', 'rack.part', 'chain', 'variations', 'light',
      'rate.mode', 'rate', 'rate.note', 'tempo', 'band', 'fundamental.source', 'fundamental', 'carrier', 'carrier.drive', 'shape', 'figure', 'comma', 'tuning', 'tuning.resident', 'tuning.maqam', 'polyphony', 'notes',
      'body', 'body.form', 'strike', 'damping', 'modes', 'level', 'pan', 'view', 'receiver', 'receiver.shared', 'receiver.return', 'meter', 'material', 'mode.follow', 'mode.followed', 'lens', 'context-frame', 'harmonic-basis', 'm3-transcription', 'sound', 'cadence', 'scale', 'standing', 'sounding', 'body.source', 'tattva.name', 'tattva.fibre', 'tattva.standing'].map(k => [k, undefined])),
    'As the field reports it': {strike: undefined, damping: undefined, modes: undefined, pan: undefined, view: undefined, receiver: undefined, 'receiver.shared': undefined, 'receiver.return': undefined, meter: undefined},
  },

  folded: p => <Folded title="Torus" light={light(p.v, p.owner)} readings={[has(p.v, 'level') ? db(num(p.v, 'level')) : NONE, shown(p.v, 'band'), `${shown(p.v, 'notes')} notes`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Torus" view="compact" light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><TorusDisplay v={p.v} set={p.set} w={140} h={146} /></Section>
    <Section label="Macros" cols={2}>{macros(p)}</Section>
  </Panel>,

  whole: p => <Panel title="Torus" view="whole" light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={[{id: 'field', label: 'Pulse'}, {id: 'body', label: 'Body'}, {id: 'stage', label: 'Stage'}, {id: 'rack', label: 'Rack'}, {id: 'macros', label: 'Macros'}]} page={p.page} onPage={p.setPage}>
    {p.page === 'stage' ? <StagePage p={p} /> : p.page === 'rack' ? <RackBands p={p} /> : p.page === 'macros' ? <MacrosPage p={p} /> : p.page !== 'body' ? <>
    <Band>
      <Section width={198}><TorusDisplay v={p.v} set={p.set} w={186} h={146} /></Section>
      <Section label="Pulse" cols={4} grow>{pulse(p)}</Section>
    </Band>
    <Band>
      <Section label="Mode and tuning" cols={4} grow>{modeAndTuning(p)}</Section>
      <Section label="Shape" width={168}>{shape(p)}</Section>
    </Band>
    </> : <>
    <Band>
      {/* 224: the width the Notes band below gave it before the Save stood beside it, which it keeps (its words read whole). */}
      {/* Four columns, the Notes band's own: what rings, how it is struck and damped, its modes and the form that rings, then where they come from (O-I #852). */}
      <Section label="Body" cols={4} width={224} grow>
        <Radio {...st(p, 'body')} label="Body" does="What rings: the torus, or a form of the Expression." value={strOf(p.v, 'body') ?? ''} options={BODIES} stack onChange={x => p.set('body', x)} />
        <Dial {...st(p, 'strike')} disabled={st(p, 'strike').disabled ?? tattvaHold(p.v)} label="Strike" does="How strongly velocity excites the body." value={num(p.v, 'strike')} def={70} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('strike', x)} />
        <Dial {...st(p, 'damping')} disabled={st(p, 'damping').disabled ?? tattvaHold(p.v)} label="Damping" does="How sharply the body rings. A high value rings longer." value={num(p.v, 'damping')} def={4.5} scale={DAMP} format={fixed(1)} onChange={x => p.set('damping', x)} />
        <Dial {...st(p, 'modes')} label="Modes" does="How many modes of the form each voice rings." value={num(p.v, 'modes')} def={8} scale={{min: 1, max: 64, log: true, step: 1}} format={x => `${Math.round(x)}`} onChange={x => p.set('modes', Math.round(x))} />
        <Readout label="form" does={st(p, 'body.form').disabled ?? 'The form that rings, as the owner made it a body.'} value={strOf(p.v, 'body.form')} tone={strOf(p.v, 'body') === 'form' ? 'accent' : undefined} />
        <Radio {...st(p, 'body.source')} label="Source" does="Where Strike and Damping come from: the values you set, or the tattva of the M2 condition." value={strOf(p.v, 'body.source') ?? ''} options={BODY_SOURCES} stack onChange={x => p.set('body.source', x)} />
        <Readout label={tattvaLabel(p.v)} does={tattvaDoes(p.v)}
          value={strOf(p.v, 'tattva.name')} tone={tattvaHold(p.v) ? 'accent' : undefined} />
      </Section>
      {/* Beside the body, so the page keeps the two bands every page of the device stands in (O-I #852). */}
      <Section label="Save and keep" cols={2}><SaveSound /></Section>
    </Band>
    {/* Five columns: its nine controls stand in two rows, so this band is no taller than the Pulse page's; Receiver stands beside it in two
        rows of two, its Shared reference across both (O-I #856). */}
    <Band>
      <Section label="Notes and output" cols={5} grow>
        <ValueBox {...st(p, 'polyphony')} label="Polyphony" does="How many notes sound at once, each with its own eight voices. The oldest note makes way for a new one. Lowered below the notes sounding, the oldest make way at once, each fading out over 4 ms." value={numOf(p.v, 'polyphony') ?? NaN} def={16} scale={{min: 1, max: 32, step: 1}} format={x => `${Math.round(x)}`} onChange={x => p.set('polyphony', Math.round(x))} />
        <Readout label="notes" does="Notes that sound now, as the owner counts them." value={numOf(p.v, 'notes')} tone="accent" />
        <Dial {...st(p, 'pan')} label="Pan" does="The place of the sound, left to right." value={num(p.v, 'pan')} def={0} scale={{min: -1, max: 1}} format={x => (Math.abs(x) < .005 ? 'C' : `${Math.round(Math.abs(x) * 50)}${x < 0 ? 'L' : 'R'}`)} bipolar onChange={x => p.set('pan', x)} />
        <Radio {...st(p, 'view')} label="View" does="What the pane draws." value={strOf(p.v, 'view') ?? ''} options={VIEWS} stack onChange={x => p.set('view', x)} />
        {seeAndHear(p)}
      </Section>
      <Section label="Receiver" cols={2}>{receiverControls(p)}</Section>
    </Band>
    </>}
  </Panel>,

  full: p => <div className="ref-pane-body ref-pane-body--dark">
    <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The playable torus and the Jankó keyboard">
      <g className="dp-display" style={{background: 'none'}}>
        <TorusPicture v={p.v} w={760} h={300} cx={380} cy={140} R={190} notes={json<number[]>(p.v, 'sounding', [])} />
        {/* the Comma at the torus's edge (manual §21.2 Full): a reading, never set here */}
        <text x={748} y={22} textAnchor="end" className="dp-axis" aria-label="Comma">{has(p.v, 'comma') ? `Comma ${cents(num(p.v, 'comma'))}` : `Comma ${NONE}`}</text>
        {has(p.v, 'band') && <text x={12} y={22} className="dp-axis">{`${strOf(p.v, 'band')}${has(p.v, 'rate') ? ` · ${rateWords(num(p.v, 'rate'))}` : ''}`}</text>}
        <Janko w={760} y={300} sounding={json<number[]>(p.v, 'sounding', [])} />
      </g>
    </svg>
  </div>,

  widget: p => <Tile title="Torus" light={light(p.v, p.owner)} onFull={p.nav.full}>
    <Display w={98} h={100} label="The torus" does="Click ⤢ to open it full in the pane that has focus." corner={shown(p.v, 'notes')}>
      <TorusPicture v={p.v} w={98} h={100} cx={49} cy={48} R={27} />
    </Display>
    <div className="ref-meter" data-i={`Level|${has(p.v, 'meter') ? `${signed(0)(num(p.v, 'meter'))} dB now.` : 'No reading of the level.'}`} style={{'--level': has(p.v, 'meter') ? clampTo(0, 1, (num(p.v, 'meter') + 60) / 66) : 0} as CSSProperties}><span /></div>
  </Tile>,
}
