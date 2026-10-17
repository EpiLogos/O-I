// Scale mapping (manual §21.3): the note device before the torus that bends every played note onto the mode in force. Live's
// nearest: the Scale MIDI effect, whose picture is where each played note goes. Here the picture is the device's own law
// (live/noteDevices/noteDevices.ts foldPitchClass): the twelve pitch classes on a ring, the mode's classes lit, and an arrow from
// each class outside the mode to the class it sounds as — the nearest in-mode class by semitone steps, an equal way up or down
// going by the tie rule. A source scale serves no pitch set, so nothing folds: its degrees stand between the classes at the owner's
// cents and every note passes. Wider, the well adds the fold as two rows, played above and sounding below.
//
// Owners, and the value keys keyed on their paths:
//   enabled      the Scale note device's power (liveChainDevices.ts noteDevice row `enabled`, write shell.noteDeviceChain)
//   tie          'Up' | 'Down', the tie rule (row `tie`, TIE_RULE_LABEL; write shell.noteDeviceChain, noteDeviceHold.setTie)
//   mode.root    0..11, the Live transport's root (native/liveModeCatalogue.ts LiveModeHold.root, setLiveModeHold)
//   mode.key     the transport's scale, a catalogue key (LiveModeHold.key, setLiveModeHold)
//   mode.lens    the owner's lens rows (ql.music-modes/v1 `lens_cf`, kernel music_modes_read): [{key, basis, lens, cf, mode, pitches}]
//   mode.sources the owner's source scales (`source_scales`): [{key, label, cents}], cents from the root, exact quarter tones
//   mode.absent  the sources the owner names absent (`sources_absent`): [{scale, status}]
// The device holds no pitch set of its own (noteDevices.ts): it always follows the mode in force, so the entry's Follow and Own mode
// are not offered. Snap is the owner's one rule (nearest, ties by Tie); Off is the device's light. The roll and the keyboard always
// mark the mode (LiveClip.tsx, JankoDevice.tsx) and nothing holds a fold-or-highlight choice, so Show is not offered either.
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type RowItem} from '../../sdk/panel'
import {PITCH_CLASS_NAMES} from '../../../live/modes'
import {foldPitchClass, type TieRule} from '../../../live/noteDevices/noteDevices'
import {NONE, boolOf, clampTo, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {HelixTorus, type HelixMark} from './live-helices'

type V = ViewProps['v']

// ---------------------------------------------------------------- vocabulary

const MODES = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'] as const
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const TIES = [{value: 'Up', label: 'Up', does: 'A note an equal way from the mode above and below goes up.'},
  {value: 'Down', label: 'Down', does: 'A note an equal way from the mode above and below goes down.'}] as const
const BASES = [{value: 'chromatic', label: 'Chromatic', does: 'The lens modes addressed by whole tones of 9:8.'},
  {value: 'fifths', label: 'Fifths', does: 'The lens modes addressed by fifths of 3:2.'}] as const
const FAMILIES = [{value: 'lens', label: 'Lens', does: 'One of the 84 lens modes on this basis: a root and a mode name.'},
  {value: 'source', label: 'Source', does: 'A source scale, with its own intervals. It serves no pitch set, so notes pass.'}] as const
/** The owner's lens labels use a plain apostrophe; the shell writes the prime (scene.ts lensLabel). */
const prime = (s: string) => s.replace(/'/g, '′')

// ---------------------------------------------------------------- the owner's readings, every lookup guarded

interface LensRow {readonly key: string; readonly basis: string; readonly lens: string; readonly cf: string; readonly mode: string; readonly pitches: readonly number[]}
interface Source {readonly key: string; readonly label: string; readonly cents: readonly number[]}
interface Absent {readonly scale: string; readonly status: string}

const isPc = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 11
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
function lensOf(v: V): LensRow[] | undefined {
  const raw = json<unknown>(v, 'mode.lens', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): LensRow[] => rec(e) && typeof e.key === 'string' && typeof e.basis === 'string' && typeof e.mode === 'string' && Array.isArray(e.pitches) && e.pitches.length === 7 && e.pitches.every(isPc)
    ? [{key: e.key, basis: e.basis, lens: String(e.lens ?? ''), cf: String(e.cf ?? ''), mode: e.mode, pitches: e.pitches as number[]}] : [])
}
function sourcesOf(v: V): Source[] | undefined {
  const raw = json<unknown>(v, 'mode.sources', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((e): Source[] => rec(e) && typeof e.key === 'string' && typeof e.label === 'string'
    ? [{key: e.key, label: e.label, cents: Array.isArray(e.cents) ? e.cents.filter((c): c is number => typeof c === 'number' && Number.isFinite(c)) : []}] : [])
}
const absentOf = (v: V): Absent[] => json<unknown[]>(v, 'mode.absent', []).flatMap((e): Absent[] => rec(e) && typeof e.scale === 'string' ? [{scale: e.scale, status: String(e.status ?? '')}] : [])
/** An absent source by its first word (the owner's id: `ficino-planetary` reads Ficino), and its status in a word. */
const absentRow = (a: Absent): RowItem => ({id: a.scale, name: cap(a.scale.split(/[-\s]/)[0] ?? a.scale), light: 'unknown', note: a.status === 'absent' ? 'absent' : 'unwritten',
  does: `The owner serves no scale for ${a.scale}: ${a.status}.`})

/** Everything the views draw, from the values: the mode in force, the device's power and tie, and where each class sounds. */
function readingOf(v: V) {
  const rows = lensOf(v), sources = sourcesOf(v), rootN = numOf(v, 'mode.root'), root = isPc(rootN) ? rootN : undefined, key = strOf(v, 'mode.key')
  const lens = rows?.find(r => r.key === key && r.pitches[0] === root)
  const source = lens ? undefined : sources?.find(s => s.key === key)
  const mask = lens ? PITCH_CLASS_NAMES.map((_, pc) => lens.pitches.includes(pc)) : null
  const enabled = boolOf(v, 'enabled'), tieWord = strOf(v, 'tie'), tie: TieRule | undefined = tieWord === 'Up' ? 'up' : tieWord === 'Down' ? 'down' : undefined
  /** A class lies an equal way from the mode above and below. */
  const tied = (pc: number) => {
    if (!mask || mask[pc]) return false
    for (let s = 1; s <= 6; s++) { const up = mask[(pc + s) % 12], down = mask[(pc - s + 12) % 12]; if (up || down) return !!(up && down) }
    return false
  }
  // Where each class sounds: moved only when the device is on, the mode serves a pitch set, and the rule decides it.
  const to = PITCH_CLASS_NAMES.map((_, pc) => {
    if (enabled !== true || !mask || mask[pc]) return pc
    if (tied(pc)) return tie ? foldPitchClass(pc, mask, tie) : pc
    return foldPitchClass(pc, mask, 'up')
  })
  const moved = mask && enabled === true ? to.filter((t, pc) => t !== pc).length : undefined
  const state: 'fold' | 'pass' | 'none' = !rows && !sources ? 'none' : lens ? (enabled === false ? 'pass' : 'fold') : source ? 'pass' : 'none'
  /** The well's one word for what the device does now. */
  const word = !rows && !sources ? 'No mode catalogue' : root === undefined ? 'No root' : !lens && !source ? 'No mode on this root'
    : source ? 'No pitch set · passes' : enabled === undefined ? 'No reading of on' : enabled === false ? 'Off · passes'
    : tie === undefined && mask!.some((_, pc) => tied(pc)) ? 'No reading of tie' : `${moved} fold ${moved ? (tieWord ?? '').toLowerCase() : ''}`.trim()
  return {rows, sources, root, key, lens, source, mask, enabled, tie, tieWord, tied, to, moved, state, word}
}
type Reading = ReturnType<typeof readingOf>

const modeWord = (s: Reading) => (s.lens ? cap(s.lens.mode) : s.source ? s.source.label.replace(/ \(.*\)$/, '') : undefined)
/** The well's corner: the basis the mode is addressed in, or the source family. */
const cornerOf = (s: Reading) => (s.lens ? s.lens.basis : s.source ? 'source' : NONE)
const rootWord = (s: Reading) => (s.root === undefined ? undefined : PITCH_CLASS_NAMES[s.root])

/** Choose a lens mode by root, basis and mode name: the transport's root and the catalogue key on it. A root keeps the mode name and
 * the basis; a source scale stands on every root, so only the root moves. */
function choose(p: ViewProps, s: Reading, next: {root?: number; basis?: string; mode?: string}) {
  if (next.root !== undefined) p.set('mode.root', next.root)
  if (s.source && next.basis === undefined && next.mode === undefined) return
  const root = next.root ?? s.root, basis = next.basis ?? s.lens?.basis ?? 'chromatic', mode = next.mode ?? s.lens?.mode ?? 'ionian'
  const row = s.rows?.find(r => r.basis === basis && r.mode === mode && r.pitches[0] === root)
  if (row) p.set('mode.key', row.key)
}

// ---------------------------------------------------------------- the picture

const deg = (pc: number) => (-90 + pc * 30) * Math.PI / 180
const f1 = (x: number) => x.toFixed(1)

/** The ring: twelve classes, the mode's lit, an arrow from each moved class to where it sounds. `handles`: 0 on the rail, 1 on the
 * chain (the root), 2 in the pool (the root and the tie). `rows`: the room at the right for the fold as two rows. */
function FoldRing({p, w, h, handles, labels, rows = 0}: {p: ViewProps; w: number; h: number; handles: 0 | 1 | 2; labels: boolean; rows?: number}) {
  const s = readingOf(p.v), ringW = w - rows
  const cx = ringW / 2, cy = h / 2 + (labels ? 6 : 0), r = Math.min(ringW, h - (labels ? 26 : 8)) / 2 - (labels ? 13 : 6)
  const at = (pc: number, rad: number) => [cx + rad * Math.cos(deg(pc)), cy + rad * Math.sin(deg(pc))] as const
  const dot = labels ? 4 : 2.6
  const rootSt = st(p, 'mode.root'), tieSt = st(p, 'tie')
  const tieAt = s.mask ? PITCH_CLASS_NAMES.findIndex((_, pc) => s.tied(pc)) : -1
  return <g>
    <circle cx={cx} cy={cy} r={r} className="dp-faint" />
    {/* a source scale's degrees: the owner's cents from the root, a quarter tone falling between two classes */}
    {s.source && s.root !== undefined && s.source.cents.slice(0, -1).map((c, i) => {
      const a = (-90 + (s.root! * 100 + c) * .3) * Math.PI / 180
      return <path key={`d${i}`} d={`M${f1(cx + (r + 2) * Math.cos(a))} ${f1(cy + (r + 2) * Math.sin(a))}L${f1(cx + (r + 8) * Math.cos(a))} ${f1(cy + (r + 8) * Math.sin(a))}`} className="dp-curve" />
    })}
    {s.to.map((t, pc) => {
      if (t === pc) return null
      const [ax, ay] = at(pc, r + 2), [bx, by] = at(t, r + 2), wrap = Math.abs(t - pc) > 6 ? 12 : 0
      const [qx, qy] = at((pc + t + wrap) / 2, r + (labels ? 15 : 9))
      const len = Math.hypot(bx - qx, by - qy) || 1, ux = (bx - qx) / len, uy = (by - qy) / len, head = labels ? 4 : 2.6
      return <g key={`a${pc}`}>
        <path d={`M${f1(ax)} ${f1(ay)}Q${f1(qx)} ${f1(qy)} ${f1(bx - ux * 2)} ${f1(by - uy * 2)}`} className="dp-curve-on" />
        <path d={`M${f1(bx - ux * (head + 2) - uy * head * .8)} ${f1(by - uy * (head + 2) + ux * head * .8)}L${f1(bx - ux)} ${f1(by - uy)}L${f1(bx - ux * (head + 2) + uy * head * .8)} ${f1(by - uy * (head + 2) - ux * head * .8)}`} className="dp-curve-on" />
      </g>
    })}
    {PITCH_CLASS_NAMES.map((name, pc) => {
      const [x, y] = at(pc, r), [lx, ly] = at(pc, r - (labels ? 13 : 9)), lit = s.mask ? s.mask[pc] : null
      return <g key={pc}>
        <circle cx={x} cy={y} r={lit === false ? dot * .8 : dot} fill={lit ? 'var(--dp-value)' : 'var(--dp-well)'} stroke={lit === null ? 'var(--dp-value-dim)' : 'var(--dp-value)'}
          strokeWidth={1.2} opacity={lit === false ? .45 : 1} />
        {labels && <text x={lx} y={ly + 3} textAnchor="middle" className={lit ? 'dp-ink' : 'dp-axis'} style={{fontSize: 8.5}}>{name}</text>}
      </g>
    })}
    {s.root !== undefined && handles === 0 && <circle cx={at(s.root, r)[0]} cy={at(s.root, r)[1]} r={dot + 2.5} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />}
    <text x={cx} y={cy - (labels ? 2 : 0)} textAnchor="middle" className="dp-ink" style={{fontSize: labels ? 10.5 : 9}}>{s.lens ? `${rootWord(s)} ${cap(s.lens.mode)}` : s.source ? `${rootWord(s) ?? ''} maqam` : NONE}</text>
    {labels && s.lens && <text x={cx} y={cy + 11} textAnchor="middle" className="dp-axis">{`${prime(s.lens.lens)} · ${s.lens.cf}`}</text>}
    {labels && <text x={4} y={h - 4} className="dp-ink-dim">{s.word}</text>}
    {rows > 0 && <FoldRows s={s} x={ringW} w={rows} h={h} />}
    {handles >= 1 && s.root !== undefined && <Handle n={1} shape="ring" x={at(s.root, r)[0]} y={at(s.root, r)[1]} label="Root"
      does={rootSt.disabled ? `Drag round the ring: the root of the mode in force. ${rootSt.disabled}` : 'Drag round the ring: the root of the mode in force. The mode name and the basis stay.'}
      onDrag={rootSt.disabled ? undefined : (x, y) => {
        const pc = (Math.round(Math.atan2(y - cy, x - cx) * 180 / Math.PI / 30 + 3) % 12 + 12) % 12
        if (pc !== s.root) choose(p, s, {root: pc})
      }} onReset={rootSt.disabled ? undefined : () => choose(p, s, {root: 0})} />}
    {handles >= 2 && tieAt >= 0 && (() => {
      // The tie leans toward where an equal-way class goes: drag it toward the class above for Up, below for Down.
      const lean = (s.tie === 'down' ? -1 : 1) * 7, a = deg(tieAt) + lean * Math.PI / 180, hx = cx + (r + 16) * Math.cos(a), hy = cy + (r + 16) * Math.sin(a)
      return <Handle n={2} x={hx} y={hy} label="Tie" does={tieSt.disabled ? `Drag toward the class above or below: where an equal-way note goes. ${tieSt.disabled}` : 'Drag toward the class above or below: where an equal-way note goes.'}
        onDrag={tieSt.disabled ? undefined : (x, y) => {
          const d = ((Math.atan2(y - cy, x - cx) - deg(tieAt)) * 180 / Math.PI + 540) % 360 - 180
          const next = d >= 0 ? 'Up' : 'Down'
          if (next !== s.tieWord) p.set('tie', next)
        }} onReset={tieSt.disabled ? undefined : () => p.set('tie', 'Up')} />
    })()}
  </g>
}

/** The fold as two rows: the classes as played above, as they sound below, a line from each to the other. */
function FoldRows({s, x, w, h}: {s: Reading; x: number; w: number; h: number}) {
  const x0 = x + 14, step = (w - 28) / 11, top = 34, bottom = h - 34, cx = (pc: number) => x0 + pc * step
  return <g>
    <text x={x0} y={14} className="dp-axis">played</text>
    <text x={x0} y={h - 8} className="dp-axis">sounds</text>
    {PITCH_CLASS_NAMES.map((name, pc) => {
      const t = s.to[pc]!, lit = s.mask ? s.mask[pc] : null
      return <g key={pc}>
        <text x={cx(pc)} y={top - 8} textAnchor="middle" className="dp-axis">{name}</text>
        <circle cx={cx(pc)} cy={top} r={2.4} className="dp-faint" />
        <path d={`M${f1(cx(pc))} ${top + 3}L${f1(cx(t))} ${bottom - 3}`} className={t === pc ? 'dp-faint' : 'dp-curve-on'} />
        <circle cx={cx(pc)} cy={bottom} r={3} fill={lit ? 'var(--dp-value)' : 'var(--dp-well)'} stroke="var(--dp-value)" strokeWidth={1.1} opacity={lit === false ? .45 : 1} />
      </g>
    })}
  </g>
}

// ---------------------------------------------------------------- the parts the views share

const lightOf = (p: ViewProps): LightState => { const e = boolOf(p.owner ?? p.v, 'enabled'); return e === undefined ? 'unknown' : e ? 'lit' : 'dark' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'enabled').disabled, onFold: p.nav.fold, onFull: p.nav.full,
  onLight: () => { const e = boolOf(p.v, 'enabled'); p.set('enabled', e === undefined ? true : !e) }})
const DISPLAY_DOES = 'The twelve classes. Teal: in the mode in force. An amber arrow runs from a class out of the mode to the class it sounds as.'
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined

function controls(p: ViewProps, s: Reading) {
  const keySt = st(p, 'mode.key'), noCatalogue = s.rows ? undefined : 'The kernel has not served the mode catalogue.'
  const sourceWhy = s.source ? 'A source scale has its own degrees: choose Lens for a mode name.' : undefined
  return {
    root: <Dial {...st(p, 'mode.root')} label="Root" does="The root of the mode in force: the set's mode, which the roll and the keyboard show too." value={s.root ?? NaN} def={0}
      scale={{min: 0, max: 11, step: 1}} format={x => PITCH_CLASS_NAMES[x] ?? NONE} onChange={x => choose(p, s, {root: x})} />,
    mode: (stack: boolean) => stack
      ? <Radio {...keySt} does="The mode name on this root and basis." value={s.lens?.mode ?? ''} stack
        options={MODES.map(m => ({value: m, label: cap(m), does: `${cap(m)} on this root.`}))} onChange={x => choose(p, s, {mode: x})} disabled={keySt.disabled ?? noCatalogue ?? sourceWhy} />
      : <Chooser {...keySt} label="Mode" does="The mode name on this root and basis." value={s.lens?.mode ?? ''}
        options={MODES.map(m => ({value: m, label: cap(m)}))} onChange={x => choose(p, s, {mode: x})} disabled={keySt.disabled ?? noCatalogue ?? sourceWhy} />,
    basis: <Radio {...keySt} label="Basis" does="The basis the lens mode is addressed in. The fold still steps by semitones." value={s.lens?.basis ?? ''} options={BASES} stack
      onChange={x => choose(p, s, {basis: x})} disabled={keySt.disabled ?? noCatalogue ?? sourceWhy} />,
    family: <Radio {...keySt} label="Family" does="A lens mode, or a source scale with its own intervals." value={s.lens ? 'lens' : s.source ? 'source' : ''} options={FAMILIES} stack
      onChange={x => { if (x === 'lens') choose(p, {...s, source: undefined}, {}); else if (s.sources?.[0]) p.set('mode.key', s.sources[0].key) }}
      disabled={keySt.disabled ?? (s.rows || s.sources ? undefined : 'The kernel has not served the mode catalogue.')} />,
    tie: <Radio {...st(p, 'tie')} label="Tie" does="Where a note an equal way from the mode above and below goes." value={s.tieWord ?? ''} options={TIES} stack onChange={x => p.set('tie', x)} />,
    source: <Chooser {...keySt} label="Source scale" does="A source scale on the root. The owner serves the maqam; it serves no pitch set, so notes pass." wide
      value={s.source?.key ?? ''} options={(s.sources ?? []).map(x => ({value: x.key, label: x.label.replace(/ \(.*\)$/, '')}))} onChange={x => p.set('mode.key', x)}
      disabled={keySt.disabled ?? (s.sources ? undefined : 'The kernel has not served the source scales.')} />,
  }
}

// ---------------------------------------------------------------- sample readings (the gallery's fixtures; the owner's values replace them)

/** The owner's semitone steps for each mode name (ql.music-modes/v1 `steps_semitones`, the same for every lens) and its context
 * frame (`context_frame`): used only to lay the fixture's lens rows out from the owner's lens table. */
const STEPS: Record<string, readonly number[]> = {ionian: [2, 2, 1, 2, 2, 2, 1], dorian: [2, 1, 2, 2, 2, 1, 2], phrygian: [1, 2, 2, 2, 1, 2, 2],
  lydian: [2, 2, 2, 1, 2, 2, 1], mixolydian: [2, 2, 1, 2, 2, 1, 2], aeolian: [2, 1, 2, 2, 1, 2, 2], locrian: [1, 2, 2, 1, 2, 2, 2]}
/** The lens rows as `mode.lens` carries them, from the owner's lens for each basis, root and mode name (ionian … locrian). */
const lensJson = (table: Record<string, readonly string[]>) => JSON.stringify(Object.entries(table).flatMap(([basis, roots]) => roots.flatMap((line, root) =>
  line.split(' ').map((lens, i) => {
    const mode = MODES[i]!, pitches = STEPS[mode]!.slice(0, 6).reduce((acc, step) => [...acc, (acc[acc.length - 1]! + step) % 12], [root])
    return {key: `${basis}/${lens}/${mode}`, basis, lens, cf: `CF${i + 1}`, mode, pitches}
  }))))

export const design: DesignedDevice = {
  id: 'live:scale-mapping',
  title: 'Scale mapping',
  kind: 'effect',
  defaults: {
    enabled: true, tie: 'Up', 'mode.root': 0, 'mode.key': 'chromatic/L0/ionian',
    // `ql music modes --json` (ql.music-modes/v1, registry 82cd2a43): the lens of each mode name on each root, by basis.
    'mode.lens': lensJson({
      chromatic: ["L0 L5 L4 L3' L2' L1' L0'", "L0' L5' L4' L4 L3 L2 L1", "L1 L0 L5 L4' L3' L2' L1'", "L1' L0' L5' L5 L4 L3 L2", "L2 L1 L0 L5' L4' L3' L2'",
        "L2' L1' L0' L0 L5 L4 L3", "L3 L2 L1 L0' L5' L4' L3'", "L3' L2' L1' L1 L0 L5 L4", "L4 L3 L2 L1' L0' L5' L4'", "L4' L3' L2' L2 L1 L0 L5",
        "L5 L4 L3 L2' L1' L0' L5'", "L5' L4' L3' L3 L2 L1 L0"],
      fifths: ["L0 L4' L2' L1 L5' L3' L1'", "L1' L5 L3 L2' L0' L4 L2", "L2 L0 L4' L3 L1 L5' L3'", "L3' L1' L5 L4' L2' L0' L4", "L4 L2 L0 L5 L3 L1 L5'",
        "L5' L3' L1' L0 L4' L2' L0'", "L0' L4 L2 L1' L5 L3 L1", "L1 L5' L3' L2 L0 L4' L2'", "L2' L0' L4 L3' L1' L5 L3", "L3 L1 L5' L4 L2 L0 L4'",
        "L4' L2' L0' L5' L3' L1' L5", "L5 L3 L1 L0' L4 L2 L0"],
    }),
    // Nine of the owner's 72 maqam rows, with their cents from the root.
    'mode.sources': JSON.stringify([
      {key: 'maqam/00', label: 'Maqam 0 (family 0, mode 0)', cents: [0, 200, 350, 500, 700, 850, 1000, 1200]},
      {key: 'maqam/09', label: 'Maqam 9 (family 1, mode 0)', cents: [0, 200, 350, 500, 700, 900, 1050, 1200]},
      {key: 'maqam/18', label: 'Maqam 18 (family 2, mode 1)', cents: [0, 150, 350, 550, 700, 900, 1050, 1200]},
      {key: 'maqam/27', label: 'Maqam 27 (family 3, mode 2)', cents: [0, 150, 350, 500, 700, 850, 1000, 1200]},
      {key: 'maqam/36', label: 'Maqam 36 (family 4, mode 6)', cents: [0, 100, 200, 500, 600, 800, 900, 1200]},
      {key: 'maqam/45', label: 'Maqam 45 (family 6, mode 0)', cents: [0, 200, 400, 500, 700, 900, 1100, 1200]},
      {key: 'maqam/54', label: 'Maqam 54 (family 7, mode 3)', cents: [0, 200, 300, 500, 700, 800, 1000, 1200]},
      {key: 'maqam/63', label: 'Maqam 63 (family 8, mode 5)', cents: [0, 200, 400, 550, 700, 800, 1100, 1200]}]),
    'mode.absent': JSON.stringify([{scale: 'shem', status: 'absent'}, {scale: 'ficino-planetary', status: 'needs owner authoring'}]),
  },
  fixtures: {
    'C Ionian, ties up': {},
    'D Dorian on fifths, ties down': {'mode.root': 2, 'mode.key': 'fifths/L0/dorian', tie: 'Down'},
    'A maqam passes': {'mode.root': 9, 'mode.key': 'maqam/09'},
    'Off': {enabled: false},
    'No catalogue': {'mode.lens': undefined, 'mode.sources': undefined, 'mode.absent': undefined, 'mode.key': undefined},
    'No readings': {enabled: undefined, tie: undefined, 'mode.root': undefined, 'mode.key': undefined, 'mode.lens': undefined, 'mode.sources': undefined, 'mode.absent': undefined},
  },

  folded: p => { const s = readingOf(p.v)
    return <Folded title="Scale mapping" light={lightOf(p)} readings={[rootWord(s) ?? NONE, modeWord(s) ?? NONE]} onUnfold={p.nav.unfold} /> },

  compact: p => {
    const s = readingOf(p.v), c = controls(p, s)
    return <Panel title="Scale mapping" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}>
        <Display w={140} h={146} label="The fold" does={`${DISPLAY_DOES} Drag handle 1 to set the root.`} corner={cornerOf(s)}>
          <FoldRing p={p} w={140} h={146} handles={1} labels />
        </Display>
      </Section>
      <Section label="Macros" cols={2} width={140}>{c.root}{c.tie}{c.mode(false)}{c.basis}</Section>
    </Panel>
  },

  whole: p => {
    const s = readingOf(p.v), c = controls(p, s), big = wide(p)
    // Wider than the pool (flipped up, or in its own window), the well takes the room and adds the fold as two rows.
    const w = big ? Math.round(clampTo(186, p.room!.w - 640, 470)) : 186
    const absent = absentOf(p.v).map(absentRow)
    return <Panel title="Scale mapping" view="whole" {...head(p)}>
      <Band>
        <Section width={w + 12}>
          <Display w={w} h={146} label="The fold" does={`${DISPLAY_DOES} Drag handle 1 for the root and handle 2 for the tie.`}
            corner={cornerOf(s)}>
            <FoldRing p={p} w={w} h={146} handles={2} labels rows={w >= 330 ? w - 170 : 0} />
          </Display>
        </Section>
        <Section label="Mode in force" cols={2} width={134}>{c.root}{c.family}{c.basis}
          <Readout label="lens" does="The lens of this mode name on this root and basis, as the owner serves it." value={s.lens ? prime(s.lens.lens) : undefined} tone="value" />
        </Section>
        <Section label="Fold" grow>{c.tie}
          <Readout label="move" does="Classes out of the mode that the device moves." value={s.moved} tone="accent" />
        </Section>
      </Band>
      <Band>
        <Section label="Mode name" width={96}>{c.mode(true)}</Section>
        <Section label="Source scale" width={156}>{c.source}
          <Rows label="Not served" does="Source scales the owner names and does not serve, with its reason." items={absent} size={3} />
        </Section>
        <Section label="Reading" grow>
          <Readout label="frame" does="The context frame of the mode name." value={s.lens?.cf} />
          <Readout label="steps" does="The semitone steps between the degrees, from the root." value={s.lens ? s.lens.pitches.map((x, i, a) => ((a[(i + 1) % 7]! - x + 12) % 12)).join(' ') : s.source ? '¼ tones' : undefined} />
          <Readout label="in mode" does="Classes in the mode in force." value={s.mask ? s.mask.filter(Boolean).length : undefined} tone="value" />
        </Section>
      </Band>
    </Panel>
  },

  full: p => {
    const s = readingOf(p.v)
    const marks: HelixMark[] = PITCH_CLASS_NAMES.map((name, pc) => ({name, lit: s.mask ? s.mask[pc]! : null, to: s.to[pc]}))
    const title = s.lens ? `${rootWord(s)} ${cap(s.lens.mode)} · ${prime(s.lens.lens)} · ${s.lens.cf} · ${s.lens.basis} basis` : s.source ? `${rootWord(s) ?? NONE} · ${s.source.label}` : NONE
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The mode on the torus">
        <g className="dp-display" style={{background: 'none'}}>
          <HelixTorus w={760} h={420} marks={marks} root={s.root} caption={[title, s.word]} />
        </g>
      </svg>
    </div>
  },

  widget: p => {
    const s = readingOf(p.v)
    return <Tile title="Scale" light={lightOf(p)} onFull={p.nav.full}>
      <Display w={70} h={100} label="The fold" does="The mode on its ring. Press it to open the device in the pane that has focus.">
        <FoldRing p={p} w={70} h={100} handles={0} labels={false} />
        <rect x={0} y={0} width={70} height={100} fill="transparent" role="button" tabIndex={0} aria-label="Open Scale mapping in the pane" style={{cursor: 'pointer'}}
          onClick={p.nav.full} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') p.nav.full?.() }} />
      </Display>
      <div className="ref-tile-side">
        <Readout label="root" does="The root of the mode in force." value={rootWord(s)} />
        <Readout label="mode" does="The mode in force." value={modeWord(s)} tone="value" />
        <Readout label="move" does="Classes the device moves." value={s.moved} tone="accent" />
      </div>
    </Tile>
  },
}
