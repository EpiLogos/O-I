// Live's clip (manual §21.1): a MIDI clip of a part, which plays the Torus. Clip view is Live's own, panel for panel (caps 01–21):
// Clip with its own Scale; Launch; the tools Pitch and Time, Transform and Generate; and the editor's Notes, Envelopes and MPE. The
// Notes key column is the playing surface: the Jankó keyboard's two row families (the two whole-tone families, the Torus's two
// helices), or the piano, coloured by the overlay; Fold keeps the rows that hold notes, Fold to Scale the clip's mode, Highlight
// Scale tints it (cap 10–12). Pressure from the surface records into the MPE tab (cap 19, 20).
//
// The owner's material, all on value keys: `notes` (JSON rows {id, p, at, len, vel, chance?}; p is the MIDI pitch, at and len in
// beats), `mpe` (JSON {<note id>: {pressure: [[t, 0–127]…], slide: [[t, 0–127]…], bend: [[t, semitones]…]}}), and each
// envelope's breakpoints on `env.<device>.<control>` (JSON [[beat, value]…]).
import {Chooser, Dial, Radio, Toggle, ValueBox, type Option} from '../../sdk/panel'
import {has, numOf, strOf} from '../panels/design'
import {Caption, EnvelopeEditor, Fields, LaneGrid, Pair, PlaceField, Press, Row, Rows, Rule, Said, StemLane, Wide, choice, flag, place, read, span, write, type Block, type Lane, type Point} from './clipKit'
import type {ClipProps, DesignedClip} from './design'

// ---------------------------------------------------------------- the clip's mode

const PITCH = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const
const MODES: Readonly<Record<string, readonly number[]>> = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
}
const MODE_OPTIONS: readonly Option<string>[] = Object.keys(MODES).map(id => ({value: id, label: id[0]!.toUpperCase() + id.slice(1)}))
const ROOT_OPTIONS: readonly Option<string>[] = PITCH.map((name, i) => ({value: String(i), label: name}))
const name = (p: number) => `${PITCH[((p % 12) + 12) % 12]}${Math.floor(p / 12) - 2}`
const BLACK = new Set([1, 3, 6, 8, 10])

/** The clip's own mode, or the set's when the clip has none (manual §21.1: Scale Off follows the set's mode in force). */
function modeOf(v: ClipProps['v']): {root: number; steps: readonly number[]} | undefined {
  if (v.scale === false) return {root: numOf(v, 'set.root') ?? 0, steps: MODES[strOf(v, 'set.mode') ?? 'ionian'] ?? MODES.ionian!}
  const root = numOf(v, 'root'), mode = strOf(v, 'mode')
  return root === undefined || !mode || !MODES[mode] ? undefined : {root, steps: MODES[mode]!}
}
const inMode = (v: ClipProps['v'], p: number) => {
  const m = modeOf(v)
  return m ? m.steps.includes((((p - m.root) % 12) + 12) % 12) : false
}

// ---------------------------------------------------------------- the notes

interface Note {readonly id: string; readonly p: number; readonly at: number; readonly len: number; readonly vel: number; readonly chance?: number}
const notesOf = (v: ClipProps['v']) => read<Note[]>(v, 'notes', []).filter(n => Number.isFinite(n.p) && Number.isFinite(n.at))

function lanesOf(v: ClipProps['v'], notes: readonly Note[]): Lane[] {
  const layout = choice(v, 'layout', 'janko'), overlay = choice(v, 'overlay', 'mode')
  const ps = notes.map(n => n.p)
  const lo = ps.length ? Math.min(...ps) - 3 : 48, hi = ps.length ? Math.max(...ps) + 3 : 72
  let pitches = Array.from({length: hi - lo + 1}, (_, i) => hi - i)
  if (v.fold === true) pitches = pitches.filter(p => ps.includes(p))
  else if (v.foldScale === true) pitches = pitches.filter(p => inMode(v, p))
  return pitches.map(p => {
    // The Jankó keyboard's rows: the two whole-tone families, a and b; Partition, or the piano layout, shows black and white.
    const pc = ((p % 12) + 12) % 12
    const key = layout === 'piano' || overlay === 'partition' ? (BLACK.has(pc) ? 'black' : 'white') : (pc % 2 === 0 ? 'a' : 'b')
    const folded = v.fold === true || v.foldScale === true
    return {id: String(p), label: folded || pc === 0 ? name(p) : undefined, key, marked: overlay === 'mode' ? inMode(v, p) : false}
  })
}

const blocksOf = (notes: readonly Note[], lane: 'velocity' | 'chance'): Block[] => notes.map(n => ({
  id: n.id, lane: String(n.p), at: n.at, len: n.len, vel: lane === 'chance' ? (n.chance ?? 100) * 1.27 : n.vel, label: name(n.p),
  does: `${name(n.p)} at ${place(n.at)}, ${span(n.len)} long, velocity ${n.vel}${n.chance !== undefined ? `, chance ${n.chance} %` : ''}.`,
}))

const span8 = (v: ClipProps['v']) => ({from: numOf(v, 'start') ?? 0, to: numOf(v, 'end') ?? 8})
const beatLabel = (t: number) => {
  const bar = Math.floor(t / 4) + 1, beat = Math.round(t % 4) + 1
  return beat === 1 ? String(bar) : `${bar}.${beat}`
}

function Notes({p, mpe}: {p: ClipProps; mpe?: boolean}) {
  const notes = notesOf(p.v)
  if (!has(p.v, 'notes')) return <Said>The clip's notes have no reading yet.</Said>
  const lanes = lanesOf(p.v, notes), {from, to} = span8(p.v)
  const lane = choice(p.v, 'lane', 'velocity') === 'chance' ? 'chance' : 'velocity'
  const folded = p.v.fold === true || p.v.foldScale === true
  const laneH = folded ? Math.max(12, Math.min(22, Math.floor((p.room.h - 18 - 60) / Math.max(1, lanes.length)))) : 9
  const blocks = blocksOf(notes, lane)
  const mpeH = mpe ? Math.round((p.room.h - 18) * 0.42) : 0
  return <LaneGrid lanes={lanes} blocks={blocks} from={from} to={to} major={4} minor={1} label={beatLabel} loop={p.v.loop === true ? {from: numOf(p.v, 'position') ?? 0, to: (numOf(p.v, 'position') ?? 0) + (numOf(p.v, 'length') ?? 8)} : undefined}
    keyW={56} laneH={laneH} highlight={p.v.highlight === true} selected={strOf(p.v, 'note')} onSelect={id => p.set('note', id)}
    w={p.room.w} h={p.room.h} name="Notes" does="The clip's notes on the playing surface's rows. Press a note to select it."
    under={mpe ? <Expression p={p} notes={notes} from={from} to={to} h={mpeH} />
      : <>
        <StemLane blocks={blocks} from={from} to={to} keyW={56} w={p.room.w} h={40} name={lane === 'chance' ? 'Chance' : 'Velocity'}
          does={lane === 'chance' ? 'How often each note plays.' : 'How hard each note is struck.'} top={lane === 'chance' ? '100 %' : '127'} mid={lane === 'chance' ? '50' : '64'} low={lane === 'chance' ? '0' : '1'} />
        <div className="clv-foot">
          <Chooser label="Lane" does="Shows the velocity lane or the chance lane under the notes (cap 21)." value={lane} onChange={x => p.set('lane', x)}
            options={[{value: 'velocity', label: 'Velocity'}, {value: 'chance', label: 'Chance'}]} />
          <Press p={p} k="randomize" label="Randomize" does="Moves the selected notes' velocities at random, by the amount beside it." />
          <ValueBox label="Amount" does="How far Randomize moves a velocity." value={numOf(p.v, 'randomize.amount') ?? NaN} def={100} scale={{min: 0, max: 127, step: 1}} format={x => String(x)} onChange={x => p.set('randomize.amount', x)} />
          <span className="clv-foot-label">Ramp</span>
          <ValueBox label="Ramp" does="The velocity the ramp starts from, across the selected notes." value={numOf(p.v, 'ramp.from') ?? NaN} def={85} scale={{min: 1, max: 127, step: 1}} format={x => String(x)} onChange={x => p.set('ramp.from', x)} />
          <ValueBox label="Ramp to" does="The velocity the ramp ends at." value={numOf(p.v, 'ramp.to') ?? NaN} def={100} scale={{min: 1, max: 127, step: 1}} format={x => String(x)} onChange={x => p.set('ramp.to', x)} />
          <span className="clv-foot-label">Deviation</span>
          <ValueBox label="Deviation" does="How far each selected note's velocity may vary from its value when it plays." value={numOf(p.v, 'deviation') ?? NaN} def={0} scale={{min: -127, max: 127, step: 1}} format={x => String(x)} onChange={x => p.set('deviation', x)} bipolar />
        </div>
      </>}
    underH={mpe ? mpeH : 40 + 20} />
}

/** The MPE tab's lanes (cap 19, 20): slide and pressure for each note, as the surface recorded them. */
function Expression({p, notes, from, to, h}: {p: ClipProps; notes: readonly Note[]; from: number; to: number; h: number}) {
  const per = read<Record<string, {pressure?: Point[]; slide?: Point[]}>>(p.v, 'mpe', {})
  const lanes = (['slide', 'pressure'] as const).filter(which => (which === 'slide' ? p.v['mpe.slide'] : p.v['mpe.pressure']) !== false)
  const laneH = Math.max(24, Math.floor((h - 20) / Math.max(1, lanes.length)))
  const keyW = 56, inner = p.room.w - keyW, x = (t: number) => keyW + (t - from) / (to - from) * inner
  return <>
    {lanes.map(which => <svg key={which} width={p.room.w} height={laneH} viewBox={`0 0 ${p.room.w} ${laneH}`} className="clv-stems"
      data-i={`${which === 'slide' ? 'Slide' : 'Pressure'}|${which === 'slide' ? 'Each note\'s slide, the movement along the key.' : 'Each note\'s pressure, from the playing surface while the key is held.'}`}>
      <rect x={0} y={0} width={keyW} height={laneH} className="clv-key" data-key="gutter" />
      <text x={4} y={11} className="clv-axis">{which === 'slide' ? 'Slide' : 'Pressure'}</text>
      <text x={keyW - 4} y={22} className="clv-axis" textAnchor="end">127</text>
      <text x={keyW - 4} y={laneH - 3} className="clv-axis" textAnchor="end">0</text>
      <line x1={keyW} x2={p.room.w} y1={laneH - 0.5} y2={laneH - 0.5} className="clv-bar" />
      {notes.map(note => {
        const pts = per[note.id]?.[which] ?? []
        if (!pts.length) return null
        const d = pts.map(([t, val], i) => `${i ? 'L' : 'M'}${x(note.at + t).toFixed(1)} ${(laneH - 3 - val / 127 * (laneH - 8)).toFixed(1)}`).join(' ')
        return <path key={note.id} d={d} className="clv-env-line" data-tone={note.id === strOf(p.v, 'note') ? 'rec' : 'value'} />
      })}
    </svg>)}
    <div className="clv-foot">
      <Toggle label="Slide" does="Shows the slide lane." on={p.v['mpe.slide'] !== false} onChange={x => p.set('mpe.slide', x)} />
      <Toggle label="Pressure" does="Shows the pressure lane. Pressure from the playing surface records here." on={p.v['mpe.pressure'] !== false} onChange={x => p.set('mpe.pressure', x)} />
      <Said>Pitch bend is drawn on each note in the roll.</Said>
    </div>
  </>
}

// ---------------------------------------------------------------- the panels

const GRIDS: readonly Option<string>[] = ['1/4', '1/8', '1/16', '1/32'].map(g => ({value: g, label: g}))
const FOLLOW: readonly Option<string>[] = [
  ['none', 'No Action'], ['stop', 'Stop'], ['again', 'Play Again'], ['previous', 'Previous'], ['next', 'Next'], ['first', 'First'], ['last', 'Last'], ['any', 'Any'], ['other', 'Other'], ['jump', 'Jump'],
].map(([value, label]) => ({value: value!, label: label!}))
const QUANTIZE: readonly Option<string>[] = ['Global', 'None', '8 Bars', '4 Bars', '2 Bars', '1 Bar', '1/2', '1/2T', '1/4', '1/4T', '1/8', '1/8T', '1/16', '1/16T', '1/32']
  .map(q => ({value: q.toLowerCase(), label: q}))
const TRANSFORMS: readonly Option<string>[] = [
  ['arpeggiate', 'Arpeggiate', 'Breaks chords into runs.'], ['connect', 'Connect', 'Adds notes that join one note to the next.'], ['ornament', 'Ornament', 'Adds grace notes and flams.'],
  ['quantize', 'Quantize', 'Moves notes onto the grid.'], ['recombine', 'Recombine', 'Reorders the notes\' pitches, lengths or velocities.'], ['span', 'Span', 'Sets how notes join: legato, tenuto or staccato.'],
  ['strum', 'Strum', 'Spreads the notes of a chord in time.'], ['time warp', 'Time Warp', 'Bends the timing of the notes along a curve.'],
].map(([value, label, does]) => ({value: value!, label: label!, does}))
const GENERATORS: readonly Option<string>[] = [
  ['rhythm', 'Rhythm', 'Writes a rhythm on one pitch.'], ['seed', 'Seed', 'Writes notes at random within a range.'], ['shape', 'Shape', 'Writes a melody that follows a drawn shape.'], ['stacks', 'Stacks', 'Writes chords.'],
].map(([value, label, does]) => ({value: value!, label: label!, does}))

const beats = (p: ClipProps, key: string, label: string, does: string, min: number, max: number, format: (x: number) => string) =>
  <PlaceField label={label} does={does} value={numOf(p.v, key)} min={min} max={max} format={format} onChange={x => p.set(key, x)} onSet={() => p.set(key, numOf(p.v, 'playhead') ?? 0)} />

function ClipPanel(p: ClipProps) {
  return <>
    <Fields>
      {beats(p, 'start', 'Start', 'Where the clip starts.', 0, 64, place)}
      {beats(p, 'end', 'End', 'Where the clip ends.', 0, 64, place)}
      <Wide><Press p={p} k="duplicate" label="Duplicate" does="Doubles the clip's loop and its notes." /></Wide>
    </Fields>
    <Rule />
    <Fields>
      <Wide><Toggle label="Loop" does="Loops the clip between its loop markers." on={flag(p.v, 'loop') ?? false} unknown={flag(p.v, 'loop') === undefined} onChange={x => p.set('loop', x)} /></Wide>
      {beats(p, 'position', 'Position', 'Where the loop starts.', 0, 64, place)}
      {beats(p, 'length', 'Length', 'How long the loop is.', 0.25, 64, span)}
    </Fields>
    <Rule />
    <Fields>
      <Pair label="Signature">
        <ValueBox label="Signature" does="The clip's own metre: beats in a bar." value={numOf(p.v, 'sig.num') ?? NaN} def={4} scale={{min: 1, max: 99, step: 1}} format={x => String(x)} onChange={x => p.set('sig.num', x)} />
        <ValueBox label="Signature, the beat" does="The clip's own metre: the note that counts as a beat." value={numOf(p.v, 'sig.den') ?? NaN} def={4} scale={{min: 1, max: 16, step: 1}} format={x => String(x)} onChange={x => p.set('sig.den', x)} />
      </Pair>
      <Chooser label="Groove" does="The groove applied to the clip. Hot-swap tries another; Commit writes it into the notes." value={choice(p.v, 'groove', 'none')} onChange={x => p.set('groove', x)}
        options={[{value: 'none', label: 'None'}, {value: 'swing 16-55', label: 'Swing 16-55'}, {value: 'mpc 8-60', label: 'MPC 8-60'}]} />
    </Fields>
    <Rule />
    <Caption>Scale</Caption>
    <Fields cols={3}>
      <Toggle label="♭♯" does="Gives the clip a mode of its own. Off, it follows the set's mode in force." on={flag(p.v, 'scale') ?? false} unknown={flag(p.v, 'scale') === undefined} tone="value" onChange={x => p.set('scale', x)} />
      <Chooser label="Root" does="The root of the clip's mode." value={strOf(p.v, 'root') ?? ''} options={ROOT_OPTIONS} onChange={x => p.set('root', Number(x))} disabled={p.v.scale === false ? 'The clip follows the set\'s mode. Turn ♭♯ on to give it its own.' : undefined} />
      <Chooser label="Mode" does="The clip's mode." value={strOf(p.v, 'mode') ?? ''} options={MODE_OPTIONS} onChange={x => p.set('mode', x)} disabled={p.v.scale === false ? 'The clip follows the set\'s mode. Turn ♭♯ on to give it its own.' : undefined} />
    </Fields>
  </>
}

function LaunchPanel(p: ClipProps) {
  const follow = flag(p.v, 'follow')
  const why = follow ? undefined : 'Turn Follow Action on first.'
  return <>
    <Fields>
      <Wide><Toggle label="Follow Action" does="Turns the clip's follow actions on." on={follow ?? false} unknown={follow === undefined} onChange={x => p.set('follow', x)} /></Wide>
      <Chooser label="Action A" does="What comes after the clip, most of the time." value={choice(p.v, 'followA')} options={FOLLOW} onChange={x => p.set('followA', x)} disabled={why} />
      <Chooser label="Action B" does="What comes after the clip the rest of the time." value={choice(p.v, 'followB')} options={FOLLOW} onChange={x => p.set('followB', x)} disabled={why} />
      <Wide><ValueBox label="Chance A" does="How often action A is taken; action B takes the rest." value={numOf(p.v, 'chance') ?? NaN} def={100} scale={{min: 0, max: 100, step: 1}}
        format={x => `${x} % · ${100 - x} %`} onChange={x => p.set('chance', x)} disabled={why} wide /></Wide>
      <Toggle label={p.v.linked === false ? 'Unlinked' : 'Linked'} does="Linked takes the action at the end of the clip's loop, after the loops set beside it. Unlinked takes it after a time you set."
        on={p.v.linked !== false} onChange={x => p.set('linked', x)} disabled={why} />
      <ValueBox label="Loops" does="How many loops play before the action is taken." value={numOf(p.v, 'multiplier') ?? NaN} def={1} scale={{min: 1, max: 64, step: 1}} format={x => `${x}x`} onChange={x => p.set('multiplier', x)} disabled={why} />
    </Fields>
    <Rule />
    <Fields>
      <Chooser label="Launch" does="Trigger plays on a press. Gate plays while you hold. Toggle starts and stops on each press. Repeat retriggers at the quantize rate while held."
        value={choice(p.v, 'launch')} onChange={x => p.set('launch', x)} options={[{value: 'trigger', label: 'Trigger'}, {value: 'gate', label: 'Gate'}, {value: 'toggle', label: 'Toggle'}, {value: 'repeat', label: 'Repeat'}]} />
      <Toggle label="Legato" does="The clip takes over the play position of the clip it replaces." on={flag(p.v, 'legato') ?? false} unknown={flag(p.v, 'legato') === undefined} onChange={x => p.set('legato', x)} />
      <Chooser label="Quantize" does="When a launch lands. Global follows the transport's Quantize." value={choice(p.v, 'quantize')} options={QUANTIZE} onChange={x => p.set('quantize', x)} />
      <ValueBox label="Velocity" does="How much the launch's velocity sets the clip's volume." value={numOf(p.v, 'launchVelocity') ?? NaN} def={0} scale={{min: 0, max: 100, step: 1}} format={x => `${x} %`} onChange={x => p.set('launchVelocity', x)} />
    </Fields>
  </>
}

function PitchTime(p: ClipProps) {
  const m = modeOf(p.v)
  return <>
    <Fields>
      <Wide><output className="clv-range" data-i="Range|The lowest and the highest note of the clip.">{notesOf(p.v).length ? `${name(Math.min(...notesOf(p.v).map(n => n.p)))} – ${name(Math.max(...notesOf(p.v).map(n => n.p)))}` : '—'}</output></Wide>
      <Press p={p} k="fitToScale" label="Fit to Scale" does="Moves the notes onto the clip's mode." why={m ? undefined : 'The clip has no mode to fit to.'} />
      <Press p={p} k="invert" label="Invert" does="Turns the notes upside down within their range." />
      <ValueBox label="Interval" does="The interval Add Interval adds, in scale degrees." value={numOf(p.v, 'interval') ?? NaN} def={0} scale={{min: -12, max: 12, step: 1}} format={x => `${x > 0 ? '+' : ''}${x} sd`} onChange={x => p.set('interval', x)} />
      <Press p={p} k="addInterval" label="Add Interval" does="Adds a note at the interval set beside it, above each note." />
    </Fields>
    <Rule />
    <Fields cols={3}>
      <Dial label="Stretch" does="Stretches the notes in time." value={numOf(p.v, 'stretch') ?? NaN} def={1} scale={{min: 0.25, max: 4, log: true}} format={x => `×${x.toFixed(2)}`} onChange={x => p.set('stretch', x)} />
      <Press p={p} k="double" label="×2" does="Doubles the notes' lengths and places." />
      <Press p={p} k="halve" label="/2" does="Halves the notes' lengths and places." />
    </Fields>
    <Rule />
    <Fields>
      <Chooser label="Grid" does="The length Set Length gives the notes." value={choice(p.v, 'setGrid', '1/16')} options={GRIDS} onChange={x => p.set('setGrid', x)} />
      <Press p={p} k="setLength" label="Set Length" does="Sets the length of the notes to the grid." />
      <ValueBox label="Humanize" does="How far Humanize shifts the notes in time, at random." value={numOf(p.v, 'humanize') ?? NaN} def={10} scale={{min: 0, max: 100, step: 1}} format={x => `${x} %`} onChange={x => p.set('humanize', x)} />
      <Press p={p} k="humanize.press" label="Humanize" does="Shifts the notes in time at random, by the amount set." />
      <Press p={p} k="reverse" label="Reverse" does="Plays the notes backwards." />
      <Press p={p} k="legatoNotes" label="Legato" does="Lengthens each note to the next." />
    </Fields>
  </>
}

function Transform(p: ClipProps) {
  const tool = choice(p.v, 'transform', 'arpeggiate')
  const does = TRANSFORMS.find(t => t.value === tool)?.does ?? ''
  return <>
    <Chooser label="Tool" does="The transform to apply to the selected notes, or to all of them." value={tool} options={TRANSFORMS} onChange={x => p.set('transform', x)} wide />
    <Said>{does}</Said>
    {tool === 'arpeggiate' && <Fields>
      <Chooser label="Style" does="The order the run takes the chord's notes in." value={choice(p.v, 'arp.style', 'up')} onChange={x => p.set('arp.style', x)}
        options={['Up', 'Down', 'Up Down', 'Down Up', 'Converge', 'Diverge', 'Random'].map(s => ({value: s.toLowerCase(), label: s}))} />
      <Dial label="Distance" does="How far each step of the run climbs, in scale degrees." value={numOf(p.v, 'arp.distance') ?? NaN} def={12} scale={{min: -24, max: 24, step: 1}} format={x => `${x > 0 ? '+' : ''}${x} sd`} onChange={x => p.set('arp.distance', x)} bipolar />
      <ValueBox label="Steps" does="How many times the run repeats the chord, climbing by Distance." value={numOf(p.v, 'arp.steps') ?? NaN} def={2} scale={{min: 1, max: 8, step: 1}} format={x => String(x)} onChange={x => p.set('arp.steps', x)} />
      <Chooser label="Rate" does="The length of each step of the run." value={choice(p.v, 'arp.rate', '1/32')} options={GRIDS} onChange={x => p.set('arp.rate', x)} />
      <Wide><ValueBox label="Gate" does="How much of each step the note holds." value={numOf(p.v, 'arp.gate') ?? NaN} def={100} scale={{min: 1, max: 200, step: 1}} format={x => `${x} %`} onChange={x => p.set('arp.gate', x)} wide /></Wide>
    </Fields>}
    {tool === 'strum' && <Fields>
      <ValueBox label="Low" does="How far the lowest note of a chord moves in time." value={numOf(p.v, 'strum.low') ?? NaN} def={0} scale={{min: -100, max: 100, step: 1}} format={x => `${x} %`} onChange={x => p.set('strum.low', x)} bipolar />
      <ValueBox label="High" does="How far the highest note of a chord moves in time." value={numOf(p.v, 'strum.high') ?? NaN} def={50} scale={{min: -100, max: 100, step: 1}} format={x => `${x} %`} onChange={x => p.set('strum.high', x)} bipolar />
    </Fields>}
    {tool === 'span' && <Radio label="Join" does="How notes join." value={choice(p.v, 'span.mode', 'legato')} onChange={x => p.set('span.mode', x)}
      options={[{value: 'legato', label: 'Legato'}, {value: 'tenuto', label: 'Tenuto'}, {value: 'staccato', label: 'Staccato'}]} />}
    {tool === 'quantize' && <Fields>
      <Chooser label="Grid" does="The grid the notes move to." value={choice(p.v, 'q.grid', '1/16')} options={GRIDS} onChange={x => p.set('q.grid', x)} />
      <ValueBox label="Amount" does="How far the notes move toward the grid." value={numOf(p.v, 'q.amount') ?? NaN} def={100} scale={{min: 0, max: 100, step: 1}} format={x => `${x} %`} onChange={x => p.set('q.amount', x)} />
    </Fields>}
    {tool === 'recombine' && <Radio label="Dimension" does="What Recombine reorders." value={choice(p.v, 'recombine.dim', 'pitch')} onChange={x => p.set('recombine.dim', x)}
      options={[{value: 'position', label: 'Place'}, {value: 'pitch', label: 'Pitch'}, {value: 'length', label: 'Length'}, {value: 'velocity', label: 'Vel'}]} />}
    <Rule />
    <Fields>
      <Toggle label="Auto" does="Applies the transform at once as you turn it." on={flag(p.v, 'transform.auto') ?? false} onChange={x => p.set('transform.auto', x)} />
      <Press p={p} k="transform.press" label="Transform" does="Applies the transform to the selected notes, or to all of them." />
    </Fields>
  </>
}

function Generate(p: ClipProps) {
  const tool = choice(p.v, 'generate', 'rhythm')
  return <>
    <Chooser label="Tool" does="The generator that writes new notes into the clip." value={tool} options={GENERATORS} onChange={x => p.set('generate', x)} wide />
    <Said>{GENERATORS.find(t => t.value === tool)?.does}</Said>
    {tool === 'rhythm' && <>
      <Fields cols={3}>
        <Dial label="Steps" does="The steps of the pattern." value={numOf(p.v, 'rhythm.steps') ?? NaN} def={8} scale={{min: 1, max: 32, step: 1}} format={x => String(x)} onChange={x => p.set('rhythm.steps', x)} />
        <Dial label="Pattern" does="Which of the pattern's arrangements plays." value={numOf(p.v, 'rhythm.pattern') ?? NaN} def={1} scale={{min: 1, max: 64, step: 1}} format={x => String(x)} onChange={x => p.set('rhythm.pattern', x)} />
        <Dial label="Density" does="How many of the steps hold a note." value={numOf(p.v, 'rhythm.density') ?? NaN} def={4} scale={{min: 1, max: 32, step: 1}} format={x => String(x)} onChange={x => p.set('rhythm.density', x)} />
      </Fields>
      <Rows>
        <Row label="Pitch"><Chooser label="Pitch" does="The pitch the rhythm plays on." value={choice(p.v, 'rhythm.pitch', '36')} onChange={x => p.set('rhythm.pitch', x)}
          options={[24, 36, 48, 60].map(n => ({value: String(n), label: name(n)}))} /></Row>
        <Row label="Step"><Chooser label="Step Duration" does="The length of each step." value={choice(p.v, 'rhythm.step', '1/8')} options={GRIDS} onChange={x => p.set('rhythm.step', x)} /></Row>
        <Row label="Split · Shift">
          <ValueBox label="Split" does="Splits each note into shorter ones." value={numOf(p.v, 'rhythm.split') ?? NaN} def={0} scale={{min: 0, max: 100, step: 1}} format={x => `${x} %`} onChange={x => p.set('rhythm.split', x)} />
          <ValueBox label="Shift" does="Shifts the pattern by steps." value={numOf(p.v, 'rhythm.shift') ?? NaN} def={0} scale={{min: -16, max: 16, step: 1}} format={x => String(x)} onChange={x => p.set('rhythm.shift', x)} bipolar />
        </Row>
        <Row label="Velocity">
          <ValueBox label="Velocity low" does="The softest velocity the rhythm writes." value={numOf(p.v, 'rhythm.velLow') ?? NaN} def={100} scale={{min: 1, max: 127, step: 1}} format={x => String(x)} onChange={x => p.set('rhythm.velLow', x)} />
          <ValueBox label="Velocity high" does="The hardest velocity the rhythm writes." value={numOf(p.v, 'rhythm.velHigh') ?? NaN} def={127} scale={{min: 1, max: 127, step: 1}} format={x => String(x)} onChange={x => p.set('rhythm.velHigh', x)} />
        </Row>
      </Rows>
    </>}
    <Rule />
    <Fields>
      <Toggle label="Auto" does="Writes the notes again at once as you turn the generator." on={flag(p.v, 'generate.auto') ?? false} onChange={x => p.set('generate.auto', x)} />
      <Press p={p} k="generate.press" label="Generate" does="Writes the generator's notes into the clip." />
    </Fields>
  </>
}

// ---------------------------------------------------------------- the editor's toggles and envelopes

const bar = (p: ClipProps) => <>
  <Toggle label="Fold" does="Keeps only the rows that hold notes." on={p.v.fold === true} onChange={x => { p.set('fold', x); if (x) p.set('foldScale', false) }} />
  <Toggle label="Scale" does="Keeps only the rows of the clip's mode." on={p.v.foldScale === true} tone="value" onChange={x => { p.set('foldScale', x); if (x) p.set('fold', false) }} />
  <Toggle label="Highlight Scale" does="Tints the rows of the clip's mode." on={p.v.highlight === true} tone="value" onChange={x => p.set('highlight', x)} />
</>

const DEVICES: readonly Option<string>[] = [{value: 'torus', label: 'Torus'}, {value: 'scale', label: 'Scale mapping'}, {value: 'mixer', label: 'Mixer'}]
const CONTROLS: Readonly<Record<string, readonly (Option<string> & {min: number; max: number; unit: string})[]>> = {
  torus: [{value: 'pulse', label: 'Pulse mix', min: 0, max: 100, unit: '%'}, {value: 'damping', label: 'Damping', min: 0.1, max: 40, unit: 'Q'}, {value: 'drive', label: 'Drive', min: 0, max: 6, unit: ''}, {value: 'release', label: 'Release', min: 0, max: 30, unit: 's'}],
  scale: [{value: 'snap', label: 'Snap', min: 0, max: 3, unit: ''}],
  mixer: [{value: 'volume', label: 'Track Volume', min: -60, max: 6, unit: 'dB'}, {value: 'pan', label: 'Track Panning', min: -50, max: 50, unit: ''}, {value: 'sendA', label: 'A-Reverb', min: -60, max: 0, unit: 'dB'}],
}

function Envelopes(p: ClipProps) {
  const device = choice(p.v, 'env.device', 'mixer'), controls = CONTROLS[device] ?? []
  const control = controls.find(c => c.value === strOf(p.v, 'env.control')) ?? controls[0]!
  const key = `env.${device}.${control.value}`
  const {from, to} = span8(p.v)
  const notes = notesOf(p.v), ps = notes.map(n => n.p), lo = Math.min(...ps, 60), hi = Math.max(...ps, 60)
  return <EnvelopeEditor p={p} devices={DEVICES} device={device} onDevice={x => { p.set('env.device', x); p.set('env.control', undefined) }}
    controls={controls} control={control.value} onControl={x => p.set('env.control', x)}
    mode={device === 'mixer' || device === 'torus' ? (choice(p.v, 'env.mode', 'automation') as 'automation' | 'modulation') : undefined} onMode={x => p.set('env.mode', x)}
    linked={p.v['env.linked'] !== false} onLinked={x => p.set('env.linked', x)} own={{start: from, end: to, format: place}}
    points={read<Point[]>(p.v, key, [])} onPoints={pts => write(p, key, pts)}
    min={control.min} max={control.max} format={x => `${x.toFixed(control.max - control.min > 20 ? 0 : 1)}${control.unit ? ` ${control.unit}` : ''}`}
    from={from} to={to} major={4} minor={1} label={beatLabel} w={p.room.w} h={p.room.h}
    behind={(w, h, keyW) => notes.map(n => <rect key={n.id} className="clv-env-behind" x={keyW + (n.at - from) / (to - from) * (w - keyW)} width={Math.max(2, n.len / (to - from) * (w - keyW))}
      y={8 + (hi - n.p) / Math.max(1, hi - lo) * (h - 20)} height={3} />)} />
}

/** The editor's right corner: the key column's layout and overlay where the roll shows (they are the playing surface's), and the grid. */
const corner = (p: ClipProps) => <>
  {choice(p.v, 'view.editor', 'notes') !== 'envelopes' && <>
    <Radio label="Keys" does="The key column: the Jankó keyboard's rows, or a piano." value={choice(p.v, 'layout', 'janko')} onChange={x => p.set('layout', x)}
      options={[{value: 'janko', label: 'Jankó'}, {value: 'piano', label: 'Piano'}]} />
    <Chooser label="Overlay" does="What the key colours show. Mode colours the notes of the mode; Partition shows the black and white of a traditional keyboard." value={choice(p.v, 'overlay', 'mode')} onChange={x => p.set('overlay', x)}
      options={['Mode', 'Direct', 'Partition', 'Pair family', 'Completion', 'Basis'].map(o => ({value: o.toLowerCase(), label: o}))} />
  </>}
  <Chooser label="Grid" does="The editor's grid." value={choice(p.v, 'grid', '1/16')} options={GRIDS} onChange={x => p.set('grid', x)} />
</>

// ---------------------------------------------------------------- the fixtures

const MELODY = [
  {id: 'n1', p: 60, at: 0, len: 1, vel: 100}, {id: 'n2', p: 64, at: 1, len: 0.5, vel: 90}, {id: 'n3', p: 67, at: 1.5, len: 0.5, vel: 80},
  {id: 'n4', p: 72, at: 2, len: 1, vel: 110}, {id: 'n5', p: 69, at: 3, len: 1, vel: 70}, {id: 'n6', p: 65, at: 4, len: 2, vel: 95},
  {id: 'n7', p: 62, at: 6, len: 0.5, vel: 60, chance: 50}, {id: 'n8', p: 67, at: 6.5, len: 1.5, vel: 100}, {id: 'n9', p: 48, at: 0, len: 4, vel: 85}, {id: 'n10', p: 53, at: 4, len: 4, vel: 85},
]
const CHORDS = [
  {id: 'c1', p: 57, at: 0, len: 2, vel: 90}, {id: 'c2', p: 60, at: 0, len: 2, vel: 80}, {id: 'c3', p: 64, at: 0, len: 2, vel: 80},
  {id: 'c4', p: 55, at: 2, len: 2, vel: 90}, {id: 'c5', p: 59, at: 2, len: 2, vel: 80}, {id: 'c6', p: 62, at: 2, len: 2, vel: 80},
  {id: 'c7', p: 53, at: 4, len: 4, vel: 95}, {id: 'c8', p: 57, at: 4, len: 4, vel: 85}, {id: 'c9', p: 60, at: 4, len: 4, vel: 85}, {id: 'c10', p: 64, at: 4, len: 4, vel: 70},
]
const MPE = {
  c2: {pressure: [[0, 20], [0.4, 80], [1.2, 110], [2, 40]], slide: [[0, 64], [1, 70], [2, 90]]},
  c5: {pressure: [[0, 30], [1, 90], [2, 50]], slide: [[0, 64], [2, 64]]},
  c8: {pressure: [[0, 10], [1, 60], [2.5, 120], [4, 30]], slide: [[0, 50], [2, 80], [4, 64]]},
}

export const clip: DesignedClip = {
  id: 'clip:live',
  mode: 'live',
  title: 'A Live clip',
  head: {name: 'name', colour: 'colour', active: 'active'},
  defaults: {
    name: 'Melody', colour: 'var(--sel)', active: true, notes: JSON.stringify(MELODY), mpe: JSON.stringify({}), note: 'n4', playhead: 0,
    start: 0, end: 8, loop: true, position: 0, length: 8, 'sig.num': 4, 'sig.den': 4, groove: 'none', scale: true, root: 0, mode: 'ionian', 'set.root': 0, 'set.mode': 'ionian',
    follow: true, followA: 'next', followB: 'none', chance: 100, linked: true, multiplier: 1, launch: 'trigger', legato: false, quantize: 'global', launchVelocity: 0,
    interval: 0, stretch: 1, setGrid: '1/16', humanize: 10, transform: 'arpeggiate', 'arp.style': 'up', 'arp.distance': 12, 'arp.steps': 2, 'arp.rate': '1/32', 'arp.gate': 100,
    generate: 'rhythm', 'rhythm.steps': 8, 'rhythm.pattern': 14, 'rhythm.density': 4, 'rhythm.pitch': '36', 'rhythm.step': '1/8', 'rhythm.split': 0, 'rhythm.shift': 0, 'rhythm.velLow': 100, 'rhythm.velHigh': 127,
    fold: false, foldScale: false, highlight: true, layout: 'janko', overlay: 'mode', grid: '1/16', lane: 'velocity', 'randomize.amount': 100, 'ramp.from': 85, 'ramp.to': 100, deviation: 0,
    'env.device': 'mixer', 'env.control': 'volume', 'env.mode': 'modulation', 'env.linked': true,
    'env.mixer.volume': JSON.stringify([[0, -12], [1, -10], [2, -8], [3, -6], [4, -4], [5, -3], [6, -2], [7, -1]]),
    'env.torus.damping': JSON.stringify([[0, 4.5], [4, 18], [8, 4.5]]),
    'view.panel': 'clip', 'view.tools': 'pitch', 'view.editor': 'notes',
  },
  fixtures: {
    'A melody': {},
    'Chords with pressure': {name: 'Pads', colour: 'var(--parasakti)', notes: JSON.stringify(CHORDS), mpe: JSON.stringify(MPE), note: 'c8', mode: 'dorian', root: 2, 'view.editor': 'mpe', 'view.panel': 'launch', 'view.tools': 'transform', fold: true},
    'Folded to its mode': {foldScale: true, highlight: true, layout: 'piano', overlay: 'partition', 'view.tools': 'generate'},
    'No readings': {notes: undefined, start: undefined, end: undefined, loop: undefined, position: undefined, length: undefined, 'sig.num': undefined, 'sig.den': undefined,
      scale: undefined, root: undefined, mode: undefined, follow: undefined, chance: undefined, legato: undefined, launchVelocity: undefined},
  },
  panel: [
    {id: 'clip', label: 'Clip', does: 'Where the clip starts, ends and loops, its signature, its groove and its own mode.', draw: ClipPanel},
    {id: 'launch', label: 'Launch', does: 'How the clip launches, when the launch lands, and what follows it.', draw: LaunchPanel},
  ],
  tools: [
    {id: 'pitch', label: 'Pitch·Time', does: 'Fit to Scale, Invert, Add Interval, Stretch, Set Length, Humanize, Reverse and Legato.', draw: PitchTime},
    {id: 'transform', label: 'Transform', does: 'Transforms that reshape the notes that are there.', draw: Transform},
    {id: 'generate', label: 'Generate', does: 'Generators that write new notes.', draw: Generate},
  ],
  editor: [
    {id: 'notes', label: 'Notes', does: 'The piano roll: the notes on the playing surface\'s rows, and their velocity or chance.', draw: p => <Notes p={p} />, bar},
    {id: 'envelopes', label: 'Envelopes', does: 'Moves a parameter of the part\'s chain or its mixer over the clip\'s own time.', draw: Envelopes},
    {id: 'mpe', label: 'MPE', does: 'Each note\'s own expression: its slide and its pressure.', draw: p => <Notes p={p} mpe />, bar},
  ],
  corner,
}
