// Lens (manual §17.11, techne:lens): a reading's material seen through one of Quaternal Logic's twelve lenses, and cut by one of its seven
// context frames. Live's nearest: EQ Eight and Auto Filter on one plate — a display of what passes, a handle on it, and a page for the
// cut. One device, because the owner reads a Technē subject once (`ql techne reading`) and that one reading names its lens, its sublens
// and its context frame under one warrant; the Frame page is the cut that same reading carries.
//
// The Lens page draws the refraction: the subject and its members on the left, the lens as a ring of its six sublenses, and the seven
// Technē instruments on the right, each reached by a ray where the reading can stand in it and stopped with ✕ where the owner refuses it.
// The Frame page draws the owner's context-frame grammar: six positions, the Name face above and the Power face below, the inner four
// and the outer two, and the seven frames at their canonical places (ql-mef context_frame.rs `canonical_selection`, the owner's law,
// kept here as the M3 clock keeps its sixteen cuts); the probe stands at a position and the frames the owner answers light.
//
// Owners, and the keys on their paths:
//   lenses              `ql mef lenses` with the registry's sublens labels (ql-mef registry LENS_DEFINITIONS): [{code, name, face, square,
//                       sublenses: [six labels]}]
//   frames              `ql context-frame list`: [{code, expression, name}]
//   service             `ql service capabilities` (negotiate per operation): [{operation, supported}]. An operation the provider does not
//                       support stands closed with the owner's word.
//   reading.*           `ql techne reading <target.json>` (crates/ql-cli/src/techne_command.rs, `ql.techne/v1`): subject (subject_ref),
//                       members (whole.member_refs), lens (ql.lens_ref), frame (ql.context_frame_ref), summary (ql.refraction_summary),
//                       class (warrant.result_class), evidence (warrant.evidence_refs, counted), provider (warrant.provenance_ref),
//                       instruments (disclosure.instruments: [{instrument, available, reason?}]), degraded (disclosure.degraded:
//                       [{instrument, reason}]). Absent when the reading carries no QL block: the material then passes unread.
//   proposals           relation and traversal candidates of the WikiFrame refraction (ql-wiki refraction.rs), counted. A candidate
//                       stays a proposal until the wiki's own governance recognises it; nothing here promotes one.
//   frame.mapping       the material's six positions, as the external sixfold mapping names them (ql-mef context_frame_target.rs
//                       ExternalSixfoldMapping: six refs, caller-owned, digested by the owner)
//   frame.status        'exact' | 'partial' | 'ambiguous' | 'none', frame.frames [codes], frame.missing ['face' | 'grain']: the owner's
//                       External Context Frame reading of the probe (read_external_context_frame). Descriptive evidence only: it confers
//                       no authority on the material.
// Writes, each a field of the next request: lens.mode ('disabled' | 'optional' | 'required', the refraction's ProviderMode; the activator
// is Disabled against the others), lens.lens (a lens code), lens.sublens ('' or '0'..'5'), lens.operation ('locate' | 'refract' |
// 'relate' | 'synthesise'), frame.position (0..5), frame.face ('any' | 'name' | 'power'), frame.grain ('any' | 'inner-four' |
// 'outer-two'). No kernel op reaches `ql techne reading` or the frame reading yet: the binding owes both routes, and until then the host
// stands these writes disabled with that reason.
import {Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type Option, type RowItem} from '../../sdk/panel'
import {NONE, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']

// ---------------------------------------------------------------- the owner's material, read with every lookup guarded

interface Lens {readonly code: string; readonly name: string; readonly face: string; readonly square: string; readonly sublenses: readonly string[]}
interface Frame {readonly code: string; readonly expression: string; readonly name: string}
interface Carry {readonly instrument: string; readonly available: boolean; readonly reason?: string}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const txt = (x: unknown): x is string => typeof x === 'string'

const lensesOf = (v: V): Lens[] | undefined => { const raw = json<unknown>(v, 'lenses', undefined)
  return Array.isArray(raw) ? raw.flatMap((x): Lens[] => (rec(x) && txt(x.code) && txt(x.name) ? [{code: x.code, name: x.name, face: txt(x.face) ? x.face : '', square: txt(x.square) ? x.square : '',
    sublenses: Array.isArray(x.sublenses) ? x.sublenses.filter(txt) : []}] : [])) : undefined }
const framesOf = (v: V): Frame[] | undefined => { const raw = json<unknown>(v, 'frames', undefined)
  return Array.isArray(raw) ? raw.flatMap((x): Frame[] => (rec(x) && txt(x.code) ? [{code: x.code, expression: txt(x.expression) ? x.expression : '', name: txt(x.name) ? x.name : ''}] : [])) : undefined }
const carriesOf = (v: V): Carry[] | undefined => { const raw = json<unknown>(v, 'reading.instruments', undefined)
  return Array.isArray(raw) ? raw.flatMap((x): Carry[] => (rec(x) && txt(x.instrument) && typeof x.available === 'boolean' ? [{instrument: x.instrument, available: x.available, reason: txt(x.reason) ? x.reason : undefined}] : [])) : undefined }
const degradedOf = (v: V) => new Map(json<unknown[]>(v, 'reading.degraded', []).flatMap((x): [string, string][] => (rec(x) && txt(x.instrument) && txt(x.reason) ? [[x.instrument, x.reason]] : [])))
const membersOf = (v: V): string[] | undefined => { const raw = json<unknown>(v, 'reading.members', undefined); return Array.isArray(raw) ? raw.filter(txt) : undefined }
const mappingOf = (v: V): string[] | undefined => { const raw = json<unknown>(v, 'frame.mapping', undefined); return Array.isArray(raw) && raw.length === 6 && raw.every(txt) ? raw as string[] : undefined }
const listOf = (v: V, key: string) => json<unknown[]>(v, key, []).filter(txt)
const supportOf = (v: V) => new Map(json<unknown[]>(v, 'service', []).flatMap((x): [string, boolean][] => (rec(x) && txt(x.operation) && typeof x.supported === 'boolean' ? [[x.operation, x.supported]] : [])))

/** A ref's own name: what follows its last '#', or its last ':' segment. */
const tail = (ref: string) => { const h = ref.lastIndexOf('#'); const s = h >= 0 ? ref.slice(h + 1) : ref.slice(Math.max(ref.lastIndexOf(':'), ref.lastIndexOf('/')) + 1); return s.replace(/^instrument-/, '') }
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
/** 'mef:lens:L5@1' → 'L5'; 'mef:context-frame:CF4' → 'CF4'. */
const code = (ref: string | undefined) => (ref === undefined ? undefined : /([A-Z]+\d′?'?)(?:@\d+)?$/.exec(ref)?.[1]?.replace("'", '′'))
const lensOf = (v: V) => { const c = strOf(v, 'lens.lens'); return lensesOf(v)?.find(l => l.code === c) }
const sublensOf = (v: V) => { const s = strOf(v, 'lens.sublens'); return s === undefined || s === '' ? undefined : Number(s) }

// ---------------------------------------------------------------- the owner's frame law (context_frame.rs canonical_selection)

type Face = 'name' | 'power'
type Grain = 'inner-four' | 'outer-two'
/** Each frame's canonical place: its position, its face and its grain. */
const CANON: readonly {code: string; position: number; face: Face; grain: Grain}[] = [
  {code: 'CF1', position: 0, face: 'name', grain: 'outer-two'}, {code: 'CF2', position: 1, face: 'name', grain: 'inner-four'},
  {code: 'CF3', position: 2, face: 'name', grain: 'inner-four'}, {code: 'CF4', position: 2, face: 'power', grain: 'inner-four'},
  {code: 'CF5', position: 3, face: 'power', grain: 'inner-four'}, {code: 'CF6', position: 4, face: 'power', grain: 'inner-four'},
  {code: 'CF7', position: 5, face: 'power', grain: 'outer-two'}]
const STATUS_WORD: Record<string, string> = {exact: 'exact', partial: 'partial', ambiguous: 'ambiguous', none: 'no frame'}
const frameAnswer = (v: V) => { const s = strOf(v, 'frame.status'); return s === undefined ? undefined : STATUS_WORD[s] ?? s }
const frameWord = (v: V) => { const s = strOf(v, 'frame.status'), f = listOf(v, 'frame.frames')
  return s === undefined ? undefined : s === 'none' ? 'none' : f.length ? f.join(' · ') : undefined }

// ---------------------------------------------------------------- the Lens page's display: the refraction

const INSTRUMENT_WORD: Record<string, string> = {project: 'Project', canvas: 'Canvas', timeline: 'Timeline', journey: 'Journey', place: 'Place', palace: 'Palace', expressions: 'Expressions'}
const off = (v: V) => strOf(v, 'lens.mode') === 'disabled'

function Refraction({p, w, h, labels, handles}: {p: ViewProps; w: number; h: number; labels: boolean; handles: boolean}) {
  const v = p.v, lens = lensOf(v), carries = carriesOf(v), members = membersOf(v), sub = sublensOf(v), degraded = degradedOf(v)
  const cx = w * .42, cy = h / 2, R = Math.min(h * .3, w * .15), sx = labels && w > 300 ? w * .17 : w * .1, x1 = w - (labels ? 8 : 5)
  const fs = labels ? 8 : 6.5, none = !lens && !carries
  if (none) return <g>
    <circle cx={cx} cy={cy} r={R} className="dp-faint" strokeDasharray="2 2" />
    <text x={w / 2} y={cy + R + 14} textAnchor="middle" className="dp-ink-dim">{w > 120 ? 'No reading through the lens' : NONE}</text>
  </g>
  const dim = off(v)
  const arcAt = (i: number, r: number, gap = 4) => { const a0 = (i * 60 - 30 + gap / 2 - 90) * Math.PI / 180, a1 = (i * 60 + 30 - gap / 2 - 90) * Math.PI / 180
    return `M${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)}A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)}` }
  const mid = (i: number, r: number) => { const a = (i * 60 - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const }
  const rows = carries ?? [], top = labels ? 24 : 10, step = rows.length > 1 ? (h - top - 8) / (rows.length - 1) : 0
  const memberY = (i: number, n: number) => cy + (i - (n - 1) / 2) * Math.min(14, (h - 30) / Math.max(1, n))
  const night = lens?.face === 'night'
  const subSt = st(p, 'lens.sublens')
  return <g opacity={dim ? .45 : 1}>
    {/* the subject and its members, on the left; one ray into the lens */}
    {(members ?? []).map((m, i, all) => <g key={m}>
      <path d={`M${sx} ${memberY(i, all.length)}L${cx - R} ${cy}`} className="dp-faint" opacity={.5} />
      <circle cx={sx} cy={memberY(i, all.length)} r={2.4} fill="var(--dp-value-dim)" />
      {labels && w > 300 && <text x={sx - 5} y={memberY(i, all.length) + 3} textAnchor="end" className="dp-axis" style={{fontSize: fs}}>{clip(tail(m), Math.floor((sx - 8) / (fs * .55)))}</text>}
    </g>)}
    {!members?.length && <circle cx={sx} cy={cy} r={3.5} fill="var(--dp-value-dim)" />}
    {/* the lens: six sublenses round it; the chosen one lit; a night lens is dashed */}
    {Array.from({length: 6}, (_, i) => <path key={i} d={arcAt(i, R)} fill="none" stroke={sub === i ? 'var(--dp-on)' : 'var(--dp-value)'}
      strokeWidth={sub === i ? 3 : sub === undefined ? 2 : 1.2} opacity={sub === undefined || sub === i ? 1 : .45} strokeDasharray={night ? '3 2' : undefined} />)}
    <text x={cx} y={cy + (labels ? 3 : 2.5)} textAnchor="middle" className="dp-ink" style={{fontSize: labels ? 13 : 10}}>{lens?.code ?? NONE}</text>
    {labels && lens && R > 34 && lens.sublenses.map((s, i) => { const [x, y] = mid(i, R + 9); return <text key={i} x={x} y={y + 3} textAnchor={x < cx - 2 ? 'end' : x > cx + 2 ? 'start' : 'middle'}
      className="dp-axis" style={{fontSize: fs, fill: sub === i ? 'var(--dp-on)' : undefined}}>{s}</text> })}
    {/* the instruments the reading can stand in, and those the owner refuses */}
    {rows.map((c, i) => { const y = top + i * step, x0 = cx + R, reach = c.available ? x1 - 3 : x0 + (x1 - x0) * .62, slow = degraded.has(c.instrument)
      return <g key={c.instrument}>
        <path d={`M${x0} ${cy}L${reach.toFixed(1)} ${(cy + (y - cy) * (reach - x0) / (x1 - x0)).toFixed(1)}`} stroke={c.available ? 'var(--dp-on)' : 'var(--dp-value-dim)'}
          strokeWidth={c.available ? 1.3 : .8} strokeDasharray={slow ? '3 2' : undefined} opacity={c.available ? .9 : .6} />
        {c.available ? <circle cx={x1} cy={y} r={2.6} fill="var(--dp-on)" />
          : <text x={reach} y={cy + (y - cy) * (reach - x0) / (x1 - x0) + 3} textAnchor="middle" className="dp-ink-dim" style={{fontSize: fs + 1}}>✕</text>}
        {labels && <text x={x1 - 6} y={y - 4} textAnchor="end" className={c.available ? 'dp-ink' : 'dp-axis'} style={{fontSize: fs}}>{INSTRUMENT_WORD[c.instrument] ?? c.instrument}</text>}
      </g> })}
    {handles && lens && <Handle n={1} shape="ring" x={mid(sub ?? 0, R)[0]} y={mid(sub ?? 0, R)[1]} label="Sublens"
      does={`Drag round the lens: the sublens to read through. Double-click to read through the whole lens.${subSt.disabled ? ` ${subSt.disabled}` : ''}`}
      onDrag={subSt.disabled ? undefined : (x, y) => { const a = (Math.atan2(y - cy, x - cx) * 180 / Math.PI + 90 + 360) % 360, i = Math.floor(((a + 30) % 360) / 60); if (i !== sub) p.set('lens.sublens', String(i)) }}
      onReset={subSt.disabled ? undefined : () => p.set('lens.sublens', '')} />}
  </g>
}

// ---------------------------------------------------------------- the Frame page's display: the six positions and the seven frames

function FrameWell({p, w, h, labels, handles}: {p: ViewProps; w: number; h: number; labels: boolean; handles: boolean}) {
  const v = p.v, map = mappingOf(v), pos = numOf(v, 'frame.position'), face = strOf(v, 'frame.face'), grain = strOf(v, 'frame.grain')
  const lit = new Set(listOf(v, 'frame.frames')), status = strOf(v, 'frame.status')
  const x0 = 12, x1 = w - 12, col = (x1 - x0) / 6, X = (i: number) => x0 + (i + .5) * col
  const axis = h / 2 + (labels ? -4 : 0), up = axis - h * .2, down = axis + h * .2, fs = labels ? 8 : 6.5
  const at = pos !== undefined && Number.isInteger(pos) && pos >= 0 && pos <= 5 ? pos : undefined
  const posSt = st(p, 'frame.position')
  return <g>
    {/* the inner four and the outer two */}
    <rect x={x0 + col} y={axis - h * .34} width={col * 4} height={h * .68} fill="var(--dp-value)" opacity={.06} />
    <text x={x0 + col * 3} y={axis - h * .34 - 3} textAnchor="middle" className="dp-axis" style={{fontSize: fs}}>{labels ? 'inner four' : '4'}</text>
    {[0, 5].map(i => <text key={i} x={X(i)} y={axis - h * .34 - 3} textAnchor="middle" className="dp-axis" style={{fontSize: fs}}>{labels ? 'outer' : '2'}</text>)}
    <path d={`M${x0} ${axis}H${x1}`} stroke="var(--dp-value)" strokeOpacity={.5} />
    {Array.from({length: 7}, (_, i) => <path key={i} d={`M${x0 + i * col} ${axis - 3}V${axis + 3}`} className="dp-faint" />)}
    {labels && <><text x={x0} y={up - 12} className="dp-axis" style={{fontSize: fs}}>name</text><text x={x0} y={down + 18} className="dp-axis" style={{fontSize: fs}}>power</text></>}
    {/* the probe: its position, narrowed to a face where one is set */}
    {at !== undefined && <rect x={X(at) - col * .42} y={face === 'power' ? axis : axis - h * .3} width={col * .84} height={face === 'any' || face === undefined ? h * .6 : h * .3}
      fill="none" stroke={status === 'ambiguous' ? 'var(--stall)' : 'var(--dp-on)'} strokeWidth={1} strokeDasharray={grain === 'any' || face === 'any' ? '3 2' : undefined} />}
    {/* the seven frames at their canonical places */}
    {CANON.map(f => { const y = f.face === 'name' ? up : down, on = lit.has(f.code), ring = status === 'partial' && on
      return <g key={f.code}>
        <rect x={X(f.position) - col * .3} y={y - 7} width={col * .6} height={14} rx={3} fill={on ? (status === 'ambiguous' ? 'none' : 'var(--dp-on)') : 'var(--dp-well)'}
          stroke={on ? (status === 'ambiguous' ? 'var(--stall)' : 'var(--dp-on)') : 'var(--dp-value-dim)'} strokeWidth={on ? 1.2 : .7} strokeDasharray={ring ? '2 2' : undefined} />
        <text x={X(f.position)} y={y + 3} textAnchor="middle" style={{fontSize: fs, fill: on && status !== 'ambiguous' ? '#121a20' : 'var(--text-dim)'}} className="dp-ink">{f.code}</text>
      </g> })}
    {[0, 1, 2, 3, 4, 5].map(i => <text key={i} x={X(i)} y={axis + 3} textAnchor="middle" className="dp-axis" style={{fontSize: fs, paintOrder: 'stroke', stroke: '#121a20', strokeWidth: 3}}>{i}</text>)}
    {labels && map && map.map((m, i) => <text key={i} x={X(i)} y={h - 4} textAnchor="middle" className={at === i ? 'dp-ink' : 'dp-axis'} style={{fontSize: fs - .5}}>{tail(m).slice(0, Math.floor(col / 4.4))}</text>)}
    {labels && !map && <text x={w / 2} y={h - 4} textAnchor="middle" className="dp-axis" style={{fontSize: fs}}>No reading of the material's six positions</text>}
    {handles && at !== undefined && <Handle n={1} x={X(at)} y={axis} label="Position" does={`Drag along the line: the position of the material to read.${posSt.disabled ? ` ${posSt.disabled}` : ''}`}
      onDrag={posSt.disabled ? undefined : x => { const i = clampTo(0, 5, Math.floor((x - x0) / col)); if (i !== at) p.set('frame.position', i) }} />}
  </g>
}

// ---------------------------------------------------------------- controls

const MODES: readonly Option<string>[] = [{value: 'disabled', label: 'Off', does: 'The material passes unread. The owner still checks it.'},
  {value: 'optional', label: 'Optional', does: 'Read through the lens when the provider can. Its absence shows and stops nothing.'},
  {value: 'required', label: 'Required', does: 'Read through the lens, or stop: the provider\'s absence is an error.'}]
const OPERATIONS = ['locate', 'refract', 'relate', 'synthesise'] as const
const OP_DOES: Record<string, string> = {locate: 'Find where the subject stands.', refract: 'Read the subject through the lens.', relate: 'Read how two subjects relate through the lens.', synthesise: 'Read several subjects as one through the lens.'}
const FACES: readonly Option<string>[] = [{value: 'any', label: 'Any', does: 'Leave the face open. Where two frames share a position, the answer is ambiguous.'},
  {value: 'name', label: 'Name', does: 'The material names: the Name face.'}, {value: 'power', label: 'Power', does: 'The material acts: the Power face.'}]
const GRAINS: readonly Option<string>[] = [{value: 'any', label: 'Any', does: 'Leave the grain open. The answer is partial at best.'},
  {value: 'inner-four', label: 'Inner four', does: 'One of the four working positions.'}, {value: 'outer-two', label: 'Outer two', does: 'The ground or the whole: the two framing positions.'}]

function controls(p: ViewProps) {
  const v = p.v, lenses = lensesOf(v), lens = lensOf(v), support = supportOf(v), frames = framesOf(v)
  const lensOptions = (lenses ?? []).map(l => ({value: l.code, label: `${l.code} ${l.name}`, does: `${l.face === 'night' ? 'Night' : 'Day'} face, ${l.square}.`}))
  const subOptions: Option<string>[] = [{value: '', label: 'Whole lens', does: 'Read through all six sublenses.'}, ...(lens?.sublenses ?? []).map((s, i) => ({value: String(i), label: `${i} ${s}`}))]
  return {
    lens: <Chooser {...st(p, 'lens.lens')} label="Lens" does="The lens to read through, L0 to L5′." value={strOf(v, 'lens.lens') ?? ''} options={lensOptions}
      onChange={x => { p.set('lens.lens', x); p.set('lens.sublens', '') }} disabled={st(p, 'lens.lens').disabled ?? (lenses ? undefined : 'No reading of the lenses.')} />,
    sublens: <Chooser {...st(p, 'lens.sublens')} label="Sublens" does="One of the lens's six conditions, or the whole lens." value={strOf(v, 'lens.sublens') ?? '-'} options={subOptions}
      onChange={x => p.set('lens.sublens', x)} disabled={st(p, 'lens.sublens').disabled ?? (lens ? undefined : 'Choose a lens first.')} />,
    operation: <Radio {...st(p, 'lens.operation')} label="Read" does="What the reading asks of the lens." value={strOf(v, 'lens.operation') ?? ''} stack
      options={OPERATIONS.map(o => ({value: o, label: o.charAt(0).toUpperCase() + o.slice(1), does: OP_DOES[o],
        why: support.get(o) === false ? 'The provider does not offer this reading now.' : support.has(o) ? undefined : 'No reading of what the provider offers.'}))}
      onChange={x => p.set('lens.operation', x)} />,
    mode: <Radio {...st(p, 'lens.mode')} label="Mode" does="Whether the material is read, and what a missing provider does." value={strOf(v, 'lens.mode') ?? ''} options={MODES} stack onChange={x => p.set('lens.mode', x)} />,
    position: <Chooser {...st(p, 'frame.position')} label="Position" does="The position of the material to read, 0 to 5." value={has(v, 'frame.position') ? String(numOf(v, 'frame.position')) : ''}
      options={[0, 1, 2, 3, 4, 5].map(i => ({value: String(i), label: `${i}${mappingOf(v) ? ` ${tail(mappingOf(v)![i]!)}` : ''}`}))} onChange={x => p.set('frame.position', Number(x))} />,
    face: <Radio {...st(p, 'frame.face')} label="Face" does="Whether the material at the position names or acts." value={strOf(v, 'frame.face') ?? ''} options={FACES} stack onChange={x => p.set('frame.face', x)} />,
    grain: <Radio {...st(p, 'frame.grain')} label="Grain" does="Whether the position works or frames." value={strOf(v, 'frame.grain') ?? ''} options={GRAINS} stack onChange={x => p.set('frame.grain', x)} />,
    frameName: (() => { const f = listOf(v, 'frame.frames'), one = f.length === 1 ? frames?.find(x => x.code === f[0]) : undefined
      return <Readout label={one ? one.expression : 'frame'} does={one ? `${one.code}: ${one.name}.` : 'The frame the owner reads at the probe.'} value={frameWord(v)} tone="value" /> })(),
  }
}

const carryRows = (v: V): RowItem[] => { const degraded = degradedOf(v), carries = carriesOf(v)
  if (carries === undefined) return [{id: 'none', name: 'No reading of the instruments', light: 'unknown'}]
  return carries.map(c => ({id: c.instrument, name: INSTRUMENT_WORD[c.instrument] ?? c.instrument, light: c.available ? 'lit' : 'dark', tone: 'value',
    note: c.available ? (degraded.has(c.instrument) ? 'thin' : 'carried') : 'refused', why: c.available ? degraded.get(c.instrument) : c.reason})) }
const carried = (v: V) => { const c = carriesOf(v); return c === undefined ? undefined : `${c.filter(x => x.available).length}/${c.length}` }

// The activator: the reading's mode, as the owner holds it. Off is Disabled; pressing it from Off asks for Optional.
const lightOf = (p: ViewProps): LightState => { const m = strOf(p.owner ?? p.v, 'lens.mode'); return m === undefined ? 'unknown' : m === 'disabled' ? 'dark' : 'lit' }
const head = (p: ViewProps) => ({light: lightOf(p), lightWhy: st(p, 'lens.mode').disabled, onFold: p.nav.fold, onFull: p.nav.full,
  onLight: () => p.set('lens.mode', strOf(p.v, 'lens.mode') === 'disabled' ? 'optional' : 'disabled')})
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined
const LENS_DOES = 'The material through the lens: the subject and its members, the six sublenses, and the instruments the reading can stand in. ✕: the owner refuses it there.'
const FRAME_DOES = 'The six positions of the material, the seven frames at their places: Name above, Power below. The probe stands at a position; the frames the owner reads there light.'
const PAGES = [{id: 'lens', label: 'Lens'}, {id: 'frame', label: 'Frame'}]

const lensCorner = (v: V) => { const l = lensOf(v); return off(v) ? 'off' : l ? `${l.face === 'night' ? 'night' : 'day'} · ${l.square}` : NONE }

export const design: DesignedDevice = {
  id: 'techne:lens',
  title: 'Lens',
  kind: 'effect',
  firstPage: 'lens',
  defaults: {
    'lens.mode': 'optional', 'lens.lens': 'L5', 'lens.sublens': '', 'lens.operation': 'refract',
    'frame.position': 2, 'frame.face': 'power', 'frame.grain': 'inner-four',
    // `ql mef lenses` (registry 1.0.0-q2), each with its six sublenses from the registry (ql-mef registry/{articulation,encounter,becoming}.rs).
    lenses: JSON.stringify([
      {code: 'L0', name: 'Quaternal', face: 'day', square: 'articulation', sublenses: ['Why', 'What', 'How', 'Whom/Which/When', 'Where/Why-for', 'Why-so/Why-not']},
      {code: 'L0′', name: 'Archetypal-Numerical', face: 'night', square: 'articulation', sublenses: ['One/Unity', 'Two/Duality', 'Three/Triad', 'Four/Quaternity', 'Five/Pentad', 'Six/Hexad']},
      {code: 'L1', name: 'Causal', face: 'day', square: 'encounter', sublenses: ['Svātantrya', 'Material cause', 'Efficient cause', 'Formal cause', 'Final cause', 'Icchā Śakti / Will']},
      {code: 'L1′', name: 'Phenomenal', face: 'night', square: 'encounter', sublenses: ['Introversion', 'Sensation', 'Feeling', 'Thinking', 'Intuition', 'Extroversion']},
      {code: 'L2', name: 'Logical', face: 'day', square: 'becoming', sublenses: ['Tetralemmaic ground', 'IS', 'IS-NOT', 'BOTH', 'NEITHER', 'SILENCE']},
      {code: 'L2′', name: 'Alchemical-Elemental', face: 'night', square: 'becoming', sublenses: ['Aether', 'Earth', 'Water', 'Air', 'Fire', 'Salt']},
      {code: 'L3', name: 'Processual', face: 'day', square: 'becoming', sublenses: ['Concrescent desire', 'Actual occasion', 'Ingression', 'Eternal objects', 'Community integration', 'Satisfaction/Perishing']},
      {code: 'L3′', name: 'Chronological', face: 'night', square: 'becoming', sublenses: ['Spirit (Geist)', 'Spring', 'Summer', 'Autumn', 'Winter', 'Life (Aufhebung)']},
      {code: 'L4', name: 'Phenomenological', face: 'day', square: 'encounter', sublenses: ['Sein (Being)', 'Geworfenheit (Thrownness)', 'Dasein (Being-there)', 'Zeit (Temporality)', 'Besorge (Care)', 'Gelassenheit (Releasement)']},
      {code: 'L4′', name: 'Scientific', face: 'night', square: 'encounter', sublenses: ['Prompts', 'Traces', 'Challenges', 'Patterns', 'Discovery', 'Insight']},
      {code: 'L5', name: 'Para Vāk', face: 'day', square: 'articulation', sublenses: ['Anuttara/Asambhava', 'Para Vāk', 'Paśyantī', 'Madhyamā', 'Vaikharī', 'Mātṛkā']},
      {code: 'L5′', name: 'Divine Logos', face: 'night', square: 'articulation', sublenses: ['Arche', 'Apokalypsis', 'Dynamis', 'Sophia', 'Parousia', 'Epi-Logos']}]),
    // `ql context-frame list` (grammar 1.0.0).
    frames: JSON.stringify([
      {code: 'CF1', expression: '(00/00)', name: 'Fourfold-Zero / undifferentiated-ground'}, {code: 'CF2', expression: '(0/1)', name: 'Non-Dual Anchor / standing-identity'},
      {code: 'CF3', expression: '(0/1/2)', name: 'Dual-Non-Dual / triadic-circulation'}, {code: 'CF4', expression: '(0/1/2/3)', name: 'Trinitarian / tetradic-prehensive-closure'},
      {code: 'CF5', expression: '(4.0/1-4.4/5)', name: 'Fractal-Doubling Executive'}, {code: 'CF6', expression: '(4.5/0)', name: '.5 Bridge'},
      {code: 'CF7', expression: '(5/0)', name: 'Total Synthesis / Mobius cyclic-closure-and-reopening'}]),
    // `ql service capabilities`: locate and refract offered, relate and synthesise not.
    service: JSON.stringify([{operation: 'locate', supported: true}, {operation: 'refract', supported: true}, {operation: 'relate', supported: false}, {operation: 'synthesise', supported: false}]),
    // QL's representative Technē reading (fixtures/techne/representative-subject-v1.json): the L5 instrument constellation of the
    // Quaternal Logic wiki, read through L5 at CF4, standing in all seven instruments.
    'reading.subject': 'aikit:wiki:central:wiki:project:quaternal-logic#l5-techne-instrument-constellation',
    'reading.members': JSON.stringify(['canvas', 'timeline', 'place', 'story', 'palace', 'expressions'].map(m => `aikit:wiki:central:wiki:project:quaternal-logic#instrument-${m}`)),
    'reading.lens': 'mef:lens:L5@1', 'reading.frame': 'mef:context-frame:CF4', 'reading.class': 'deterministic', 'reading.evidence': 1, 'reading.provider': 'ql-mef:provider:registry-disclosure',
    'reading.summary': 'L5 office projection resolves the constellation under the Techne office; members carry the articulated L5-0..L5-5 stack.',
    'reading.instruments': JSON.stringify(['project', 'canvas', 'timeline', 'journey', 'place', 'palace', 'expressions'].map(instrument => ({instrument, available: true}))),
    'reading.degraded': JSON.stringify([]), proposals: 0,
    // The constellation's six members as the material's six positions, in the order the whole lists them; the owner's frame reading at
    // position 2 with the Power face and the inner four grain: CF4, exact.
    'frame.mapping': JSON.stringify(['canvas', 'timeline', 'place', 'story', 'palace', 'expressions'].map(m => `aikit:wiki:central:wiki:project:quaternal-logic#instrument-${m}`)),
    'frame.status': 'exact', 'frame.frames': JSON.stringify(['CF4']), 'frame.missing': JSON.stringify([]),
  },
  fixtures: {
    'L5 on the instrument constellation': {},
    'Through one sublens, Paśyantī': {'lens.sublens': '2'},
    // `ql techne reading fixtures/kernel/techne-reading-target-v1.json`: an anchor-only frame read through L1, two instruments carried.
    'L1 on a bare frame': {'lens.lens': 'L1', 'reading.subject': 'example:frame', 'reading.members': JSON.stringify(['example:a', 'example:b', 'example:c']), 'reading.lens': 'mef:lens:L1@1', 'reading.frame': undefined,
      'reading.summary': 'Causal refractive reading of example:frame:complete', 'reading.evidence': 2,
      'reading.instruments': JSON.stringify([{instrument: 'project', available: true}, {instrument: 'canvas', available: true},
        {instrument: 'timeline', available: false, reason: 'no live temporal producer is attached to this subject (native owner: Factory/AIKit T1)'},
        {instrument: 'journey', available: false, reason: 'no source-backed Expression Scenes are composed for this subject'}, {instrument: 'place', available: false, reason: 'no place facets are disclosed for this subject'},
        {instrument: 'palace', available: false, reason: 'Palace producer is not landed (native owner: O-I #218)'}, {instrument: 'expressions', available: false, reason: 'no Expression binding is disclosed for this subject'}]),
      'frame.mapping': undefined, 'frame.status': undefined, 'frame.frames': undefined, 'frame.missing': undefined},
    // fixtures/techne/development-day-v1.json: a Day read with no QL block, the lens off; the timeline thin.
    'A day, the lens off': {'lens.mode': 'disabled', 'reading.subject': 'central:day:control:root:2026-09-15', 'reading.lens': undefined, 'reading.frame': undefined, 'reading.class': undefined, 'reading.evidence': undefined, 'reading.provider': undefined, 'reading.summary': undefined,
      'reading.members': JSON.stringify(['central:source:control:root:Control/user/day/2026-09-15/day.md', 'central:now:control:root:b417a7c3', 'factory:run:01JBD3Z4X7Q9M2A6K4P8T3W5NQ', 'factory:run:01JBD5QK3XW8N7C2R9T4V6H1M0']),
      'reading.instruments': JSON.stringify([{instrument: 'project', available: true}, {instrument: 'canvas', available: true}, {instrument: 'timeline', available: true},
        {instrument: 'journey', available: false, reason: 'no Expression scenes bound to this subject'}, {instrument: 'place', available: false, reason: 'no disclosed spatial reading'},
        {instrument: 'palace', available: false, reason: 'no Expression composition available for this subject'}, {instrument: 'expressions', available: false, reason: 'no Expression is bound to this subject'}]),
      'reading.degraded': JSON.stringify([{instrument: 'timeline', reason: 'Factory runs carry no wall-clock time; run lanes render from handoff-declared windows'}]),
      'frame.mapping': undefined, 'frame.status': undefined, 'frame.frames': undefined, 'frame.missing': undefined},
    // The owner's frame law on three probes at position 2.
    'Frame, no grain · partial': {'frame.grain': 'any', 'frame.status': 'partial', 'frame.missing': JSON.stringify(['grain'])},
    'Frame, no face · ambiguous': {'frame.face': 'any', 'frame.grain': 'any', 'frame.status': 'ambiguous', 'frame.frames': JSON.stringify(['CF3', 'CF4'])},
    'Frame, power at the ground · none': {'frame.position': 0, 'frame.face': 'power', 'frame.grain': 'outer-two', 'frame.status': 'none', 'frame.frames': JSON.stringify([])},
    'No readings': Object.fromEntries(['lens.mode', 'lens.lens', 'lens.sublens', 'lens.operation', 'frame.position', 'frame.face', 'frame.grain', 'lenses', 'frames', 'service',
      'reading.subject', 'reading.members', 'reading.lens', 'reading.frame', 'reading.class', 'reading.evidence', 'reading.provider', 'reading.summary', 'reading.instruments', 'reading.degraded',
      'proposals', 'frame.mapping', 'frame.status', 'frame.frames', 'frame.missing'].map(k => [k, undefined])),
  },

  folded: p => <Folded title="Lens" light={lightOf(p)} readings={[lensOf(p.v) ? `${lensOf(p.v)!.code} ${lensOf(p.v)!.name}` : NONE, carried(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => { const c = controls(p)
    return <Panel title="Lens" view="compact" {...head(p)} onSelect={p.nav.select}>
      <Section width={152}><Display w={140} h={146} label="The lens" does={`${LENS_DOES} Drag handle 1 round the lens for a sublens.`} corner={carried(p.v) ?? NONE}>
        <Refraction p={p} w={140} h={146} labels={false} handles /></Display></Section>
      <Section label="Macros" cols={2}>{c.lens}{c.sublens}{c.position}{c.mode}</Section>
    </Panel> },

  whole: p => { const c = controls(p), page = p.page === 'frame' ? 'frame' : 'lens', w = wide(p) ? Math.round(clampTo(186, p.room!.w - 560, 420)) : 186
    return <Panel title="Lens" view="whole" {...head(p)} pages={PAGES} page={page} onPage={p.setPage}>
      {page === 'lens' ? <>
        <Band>
          <Section width={w + 12}><Display w={w} h={146} label="The lens" does={`${LENS_DOES} Drag handle 1 round the lens for a sublens.`} corner={lensCorner(p.v)}>
            <Refraction p={p} w={w} h={146} labels={w > 200} handles /></Display></Section>
          <Section label="Lens" width={124}>{c.lens}{c.sublens}</Section>
          <Section label="Read" cols={2} grow>{c.operation}{c.mode}</Section>
        </Band>
        <Band>
          <Section label="Instruments" width={196}><Rows does="Where the reading can stand. A dark row is refused; point at its mark for the owner's reason. Thin: the instrument shows it with less." items={carryRows(p.v)} size={7} /></Section>
          <Section label="Reading" cols={2} grow>
            <Readout big label="carried" does="Instruments the reading can stand in, of those the owner names." value={carried(p.v)} tone="value" />
            <Readout label="class" does="How the owner reached the reading: deterministic, or through a provider." value={strOf(p.v, 'reading.class')} />
            <Readout label="evidence" does="The references the reading's warrant cites." value={numOf(p.v, 'reading.evidence')} />
            <Readout label="proposals" does="Relations and walks the lens proposes. Each stays a proposal until the wiki's own governance takes it up." value={numOf(p.v, 'proposals')} tone="accent" />
            <Readout label="frame" does="The context frame the reading names." value={code(strOf(p.v, 'reading.frame'))} />
            <Readout label="subject" does="The subject the lens reads, by its own name. Press to copy its reference." value={strOf(p.v, 'reading.subject') === undefined ? undefined : tail(strOf(p.v, 'reading.subject')!).slice(0, 14)}
              copy={strOf(p.v, 'reading.subject')} />
          </Section>
        </Band>
      </> : <>
        <Band>
          <Section width={w + 12}><Display w={w} h={146} label="The frame" does={`${FRAME_DOES} Drag handle 1 along the line for the position.`} corner={frameAnswer(p.v) ?? NONE}>
            <FrameWell p={p} w={w} h={146} labels={w > 170} handles /></Display></Section>
          <Section label="Probe" width={124}>{c.position}{c.frameName}</Section>
          <Section label="Narrow" cols={2} grow>{c.face}{c.grain}</Section>
        </Band>
        <Band>
          <Section label="Positions" width={196}><Rows does="The material's six positions, as its mapping names them. The lit row is the probe." size={6}
            items={(mappingOf(p.v) ?? []).map((m, i) => ({id: String(i), name: `${i} ${tail(m)}`, light: numOf(p.v, 'frame.position') === i ? 'lit' : 'dark', tone: 'value',
              note: CANON.filter(f => f.position === i).map(f => f.code).join(' ')}))} /></Section>
          <Section label="Answer" cols={2} grow>
            <Readout big label="answer" does="The owner's reading of the probe: exact, partial, ambiguous or no frame. It describes the material and gives it no standing." value={frameAnswer(p.v)}
              tone={strOf(p.v, 'frame.status') === 'ambiguous' ? 'stall' : 'value'} />
            <Readout label="missing" does="What the probe leaves open, where the answer is partial." value={strOf(p.v, 'frame.status') === undefined ? undefined : listOf(p.v, 'frame.missing').join(' · ') || 'nothing'} />
            <Readout label="reading names" does="The context frame the Technē reading names, to compare with the answer." value={code(strOf(p.v, 'reading.frame'))} />
          </Section>
        </Band>
      </>}
    </Panel> },

  full: p => { const lens = lensOf(p.v), sub = sublensOf(p.v)
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The material through the lens, and its frame">
        <g className="dp-display" style={{background: 'none', border: 'none'}}>
          <g transform="translate(150 0)"><Refraction p={{...p, set: () => {}}} w={600} h={250} labels handles={false} /></g>
          <text x={16} y={30} className="dp-ink" style={{fontSize: 18}}>{lens ? `${lens.code} ${lens.name}` : NONE}</text>
          <text x={16} y={48} className="dp-ink-dim">{off(p.v) ? 'Off: the material passes unread' : lens ? `${lens.face === 'night' ? 'Night' : 'Day'} face · ${lens.square}${sub === undefined ? ' · the whole lens' : ` · ${lens.sublenses[sub] ?? NONE}`}` : 'No reading of the lens'}</text>
          {[['carried', carried(p.v) ?? NONE], ['class', strOf(p.v, 'reading.class') ?? NONE], ['frame', code(strOf(p.v, 'reading.frame')) ?? NONE], ['proposals', String(numOf(p.v, 'proposals') ?? NONE)]].map(([k, val], i) =>
            <g key={k}><text x={16} y={86 + i * 22} className="dp-axis">{k}</text><text x={84} y={86 + i * 22} className="dp-ink">{val}</text></g>)}
          <path d="M16 262H744" className="dp-faint" />
          <g transform="translate(140 270)"><FrameWell p={{...p, set: () => {}}} w={460} h={140} labels handles={false} /></g>
          <text x={16} y={300} className="dp-ink" style={{fontSize: 14}}>{frameWord(p.v) ?? NONE}</text>
          <text x={16} y={318} className="dp-ink-dim">{frameAnswer(p.v) ?? 'No reading of the frame'}</text>
          {(() => { const f = listOf(p.v, 'frame.frames'), one = f.length === 1 ? framesOf(p.v)?.find(x => x.code === f[0]) : undefined
            return one ? <><text x={620} y={300} className="dp-ink">{one.expression}</text><text x={620} y={318} className="dp-axis">{one.name.split(' / ')[0]}</text></> : null })()}
        </g>
      </svg>
    </div> },

  widget: p => <Tile title="Lens" light={lightOf(p)} onLight={head(p).onLight} lightWhy={head(p).lightWhy} onFull={p.nav.full}>
    <Display w={70} h={100} label="The lens" does="The material through the lens. Press ▦ to open it in the pane that has focus."><Refraction p={p} w={70} h={100} labels={false} handles={false} /></Display>
    <div className="ref-tile-side">
      <Readout label="lens" value={lensOf(p.v)?.code} tone="value" />
      <Readout label="carried" value={carried(p.v)} />
      <Readout label="frame" value={frameWord(p.v)} />
    </div>
  </Tile>,
}
