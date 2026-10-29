// Studio (manual §20.3): the rack in Expressions' Device view, for what holds across the scenes of an Expression. Live's nearest: an
// Instrument Rack — its macros, its chain list, and the devices of the chain you choose.
//
// It stands on the Expression's own record (Journey.shared), as the native editor reads it:
//   • the macros are your chosen controls: the toolbelt you curate (Journey.shared.toolbelt, the boundary's chosen controls,
//     chosenControls.ts readNativeChosenControls; chosen-add, -remove, -order, -scope). Each moves one real parameter within its own
//     range: a Field parameter, or a symbol's — the selected one (Follow) or one named symbol (Bind). The list is the same in every
//     scene, as the Expressions app's toolbelt is (inspector.ts "Add to toolbelt", app.ts pin-entity);
//   • a Field macro can hold for every scene: All scenes shares its parameter across the Expression (Journey.shared.values; the
//     `shared-setting` change, the reading's sharedTargets). Shared, the value overrides the scene's envelopes; not shared, each
//     scene keeps its own (the app's "Make this property global across the expression");
//   • the chains are the field devices, in four: Material, Motion, Body and Nara (the holder table, inhabitants/sdk/semantics.ts
//     STUDIO_SECTIONS, without what moved to the scene's Clip view — the pointer's tools, the selected symbol, Formation's scene
//     devices — or to the transport: Capture). Each row is one device with its owner's on/off, where the owner has one
//     (nativeFieldFaceModel.ts StripToggle), and its owner's summary.
// Save, Undo and Redo stand in the head: the work's own acts (manual §16.9).
// Full is the suite: the whole rack worked in one pane, as the Expressions app's own Studio held every field setting in one place.
// Your controls stand at its head, every one a dial; under them the Field and the four chains, each device in its Whole view with
// every setting live, in chain order. The host draws each member through its door (`member`), on that device's own owner; the
// Studio draws only the head, the order and the stand-in for a member the host does not hold (manual §16.3, §20.3).
//
// Everything the device draws is a value key.
//   open       boolean   a native Expression is open (the light)
//   scene      string    the scene you are on
//   dirty      boolean   edited since the last save (NativeEditorReading.standing.dirty)
//   pending    boolean   the owner is answering the last change (standing.pending)
//   canUndo, canRedo  boolean   the editor's history
//   controls   JSON      [{id, label, scope: field | selected | named, subject, min, max, step, log, def, unit, plays, locked, why}]
//                        one per chosen control, in your order. A control the owner cannot resolve has no min or max and carries
//                        its reason in `why` (NativeChosenControlReading.unavailable_reason).
//   control:<id>   number    the control's value (base_value). A value key per control: it carries the control's own standing.
//   shared:<id>    boolean   a Field control's parameter is shared across the Expression. Absent for a symbol's control.
//   devices    JSON      [{family, name, chain: material | motion | body | nara, toggle, says, why}] the chains' devices, in the
//                        holder table's order. `toggle`: the owner has an on/off for it. `says`: its owner's summary. `why`: what
//                        holds it back (an owner still waiting).
//   on:<family>    boolean   the device's on/off as its owner reports it. Absent where the owner has none (Physics, Ink, Pointer and
//                        Focus are always in the field). Nara's is the Nara instrument, open over the field.
// Acts, each on its own key: save, undo, redo; add (+ Parameter); earlier, later (▲ ▼ on the chosen row), remove, follow, bind (each
// carries the control's id); show, pane (each carries the device's family: show it whole in the pool, open it full in a pane).
// A key the owner does not report is absent. The picture then names the missing reading and every control draws "—".
import {useRef, useState, type ReactNode} from 'react'
import {Action, Band, Dial, Display, Folded, Handle, PanelHead, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, fromUnit, toUnit,
  type LightState, type Option, type RowItem, type Scale, type Standing, NoReading} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type Values, type ViewProps} from './design'
import './expressions__studio.css'

type V = ViewProps['v']
type Scope = 'field' | 'selected' | 'named'
type ChainId = 'material' | 'motion' | 'body' | 'nara'

// ------------------------------------------------------------------------------------------------ the vocabulary

/** The three reaches of a chosen control, in the toolbelt's own scopes: a Field parameter, the selected symbol's, one named symbol's. */
const SCOPE_WORD: Record<Scope, string> = {field: 'Field', selected: 'Follow', named: 'Bind'}
const CHAINS: readonly {id: ChainId; label: string; does: string}[] = [
  {id: 'material', label: 'Material', does: 'What the field is made of: the palette, the marks, the depth and the medium.'},
  {id: 'motion', label: 'Motion', does: 'How the field moves: the pointer, the pulls between symbols, contacts, morph and focus.'},
  {id: 'body', label: 'Body', does: 'The physics of the particles, the plate that sounds, and the torus.'},
  {id: 'nara', label: 'Nara', does: 'Your personal layer over the field. It never enters the Expression, so sharing the Expression never shares it.'},
]
const ROWS = 7, PITCH = 17, TOP = 26
const LIGHT_WHY = 'The light shows whether a native Expression is open. Open or close the Expression to change it.'

// ------------------------------------------------------------------------------------------------ the controls that were read

interface Chosen {
  readonly id: string; readonly label: string; readonly scope: Scope; readonly subject: string | null
  readonly min: number; readonly max: number; readonly ranged: boolean; readonly step: number | null; readonly log: boolean
  readonly def: number | null; readonly unit: string | null; readonly plays: number | null; readonly locked: boolean; readonly why: string | null
}

const text = (x: unknown): x is string => typeof x === 'string' && x.length > 0
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const orNull = (x: unknown): string | null => (text(x) ? x : null)

/** The chosen controls the owner reported, or undefined when the key is absent or holds no list. A row without its identity is left out. */
function readControls(v: V): Chosen[] | undefined {
  const raw = json<unknown>(v, 'controls', undefined)
  if (!Array.isArray(raw)) return undefined
  const out: Chosen[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const row = r as Record<string, unknown>
    if (!text(row.id) || !text(row.label)) continue
    const ranged = finite(row.min) && finite(row.max) && row.max > row.min
    out.push({
      id: row.id, label: row.label, scope: row.scope === 'selected' || row.scope === 'named' ? row.scope : 'field', subject: orNull(row.subject),
      min: ranged ? (row.min as number) : 0, max: ranged ? (row.max as number) : 1, ranged, step: finite(row.step) && row.step > 0 ? row.step : null, log: row.log === true,
      def: finite(row.def) ? row.def : null, unit: orNull(row.unit), plays: finite(row.plays) ? row.plays : null, locked: row.locked === true,
      why: orNull(row.why) ?? (ranged ? null : 'The native owner has not resolved this retained control.'),
    })
  }
  return out
}

const keyOf = (c: Chosen) => `control:${c.id}`
const shareKey = (c: Chosen) => `shared:${c.id}`
const valueOf = (v: V, c: Chosen) => numOf(v, keyOf(c))
const placesOf = (step: number | null) => { if (!step || step >= 1) return 0; const s = String(step), i = s.indexOf('.'); return Math.min(3, i < 0 ? 0 : s.length - i - 1) }
/** A value in the control's own steps, short enough for a dial: 200000 reads 200k. */
function fmt(c: Chosen, x: number): string {
  const a = Math.abs(x)
  if (a >= 10000) return `${(x / 1000).toFixed(a >= 100000 ? 0 : 1)}k`
  return x.toFixed(placesOf(c.step))
}
/** The control's range as the dial draws it. A step stays only where the control has a few of them: a count of thousands is not stepped. */
function scaleOf(c: Chosen): Scale {
  const stepped = c.step !== null && (c.max - c.min) / c.step <= 24
  return {min: c.min, max: c.max, ...(c.log && c.min > 0 ? {log: true} : {}), ...(stepped ? {step: c.step!} : {})}
}
/** A value the owner can take: on the control's own grid and inside its range. */
function snap(c: Chosen, x: number): number {
  const grid = c.step ? Math.round(x / c.step) * c.step : x
  return clampTo(c.min, c.max, Number(grid.toFixed(Math.max(4, placesOf(c.step) + 2))))
}
const subjectOf = (c: Chosen) => (c.scope === 'field' ? 'the field' : c.subject ?? (c.scope === 'selected' ? 'the selected symbol' : 'an absent symbol'))
/** Whether the Expression shares a Field control's parameter: true, false, or undefined (a symbol's control, or no reading). */
const sharedOf = (v: V, c: Chosen) => (c.scope === 'field' ? boolOf(v, shareKey(c)) : undefined)
const holdsOf = (v: V, c: Chosen) => { const s = sharedOf(v, c); return c.scope !== 'field' ? '' : s === true ? ' Holds for every scene.' : s === false ? ' This scene\'s own value.' : '' }
const saysOf = (v: V, c: Chosen) => `${SCOPE_WORD[c.scope]} · ${subjectOf(c)}.${c.ranged ? ` ${fmt(c, c.min)} to ${fmt(c, c.max)}${c.unit ? ` ${c.unit}` : ''}.` : ''}${c.def !== null ? ` Default ${fmt(c, c.def)}.` : ''}${holdsOf(v, c)}`
/** Why a control cannot be moved now, in the owner's words, or undefined. */
const offOf = (c: Chosen) => (c.why ?? (c.locked ? `${subjectOf(c)} is locked. Its owner takes no change.` : undefined))
const clip = (label: string, n: number) => (label.length > n ? `${label.slice(0, Math.max(1, n - 1))}…` : label)

/** The standing against the last save, in the owner's words (sceneClip.ts standingWord), short for a corner. */
function standing(v: V, short = false): string | undefined {
  if (boolOf(v, 'pending') === true) return short ? 'busy' : 'owner answering'
  const dirty = boolOf(v, 'dirty')
  return dirty === undefined ? undefined : dirty ? (short ? 'edited' : 'edited since save') : 'saved'
}
const lightOf = (p: ViewProps): LightState => { const o = p.owner ?? p.v; return !has(o, 'open') ? 'unknown' : o.open === true ? 'lit' : 'dark' }
/** The host's standing for a key, with the view's own reason in front when the host has none. */
const stand = (p: ViewProps, key: string, why?: string): Standing => { const s = st(p, key); return s.disabled || !why ? s : {...s, disabled: why} }
const closedWhy = (v: V) => { const open = boolOf(v, 'open'); return open === false ? 'Open a native Expression first.' : open === undefined ? 'No reading of whether an Expression is open.' : undefined }

// ------------------------------------------------------------------------------------------------ the chains that were read

interface Member {
  readonly family: string; readonly name: string; readonly chain: ChainId
  readonly toggle: boolean; readonly says: string | null; readonly why: string | null
}
const CHAIN_IDS = new Set<string>(CHAINS.map(c => c.id))

/** The chains' devices the owner reported, or undefined when the key is absent or holds no list. */
function readDevices(v: V): Member[] | undefined {
  const raw = json<unknown>(v, 'devices', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((r): Member[] => {
    if (!r || typeof r !== 'object') return []
    const row = r as Record<string, unknown>
    if (!text(row.family) || !text(row.name) || !text(row.chain) || !CHAIN_IDS.has(row.chain)) return []
    return [{family: row.family, name: row.name, chain: row.chain as ChainId, toggle: row.toggle === true, says: orNull(row.says), why: orNull(row.why)}]
  })
}
const onKey = (m: Member) => `on:${m.family}`
/** A device's light: what its owner reports, hollow where the owner has no on/off or has not said. */
const memberLight = (p: ViewProps, m: Member): LightState => { const o = p.owner ?? p.v; return !has(o, onKey(m)) ? 'unknown' : o[onKey(m)] === true ? 'lit' : 'dark' }
/** A chain's light, from its devices: lit while any is on, dark when the owner reports them all off, hollow when it reports none. */
function chainLight(p: ViewProps, members: readonly Member[]): LightState {
  const lights = members.map(m => memberLight(p, m))
  return lights.includes('lit') ? 'lit' : lights.includes('dark') ? 'dark' : 'unknown'
}
const litOf = (p: ViewProps, members: readonly Member[]) => members.filter(m => memberLight(p, m) === 'lit').length
const alwaysWhy = (m: Member) => (m.family === 'nara' ? undefined : `${m.name} is always part of the field: its owner has no on/off.`)

// ------------------------------------------------------------------------------------------------ the marks

/** A control's reach as a small mark: a square for the Field, a ring for Follow, a filled dot for Bind. */
function ScopeMark({scope}: {scope: Scope}) {
  return <svg className="st-scope" width={9} height={9} viewBox="0 0 9 9" role="img" aria-label={SCOPE_WORD[scope]}>
    {scope === 'field' ? <rect x={1.5} y={1.5} width={6} height={6} /> : <circle cx={4.5} cy={4.5} r={3} data-fill={scope === 'named' ? 'true' : undefined} />}
  </svg>
}
function ScopeGlyph({x, y, scope, shared}: {x: number; y: number; scope: Scope; shared?: boolean}) {
  return scope === 'field' ? <rect x={x - 2.5} y={y - 2.5} width={5} height={5} className="dp-curve" style={shared ? {strokeWidth: 1.1, fill: 'var(--dp-value)'} : {strokeWidth: 1.1}} />
    : <circle cx={x} cy={y} r={2.6} className="dp-curve" style={scope === 'named' ? {strokeWidth: 1.1, fill: 'var(--dp-value)'} : {strokeWidth: 1.1}} />
}

// ------------------------------------------------------------------------------------------------ the display: the macros as ranges

/** The macros, one line each. A line is the control's range, its teal part the value, a faint tick the default, a short tick what the
 * field plays when that differs. A Field control's square is filled when it holds for every scene. Handles 1 to `handles` set the
 * first controls of the page. */
function Sheet({p, list, w, h, labelW, handles, page = 0}: {p: ViewProps; list: Chosen[] | undefined; w: number; h: number; labelW: number; handles: number; page?: number}) {
  const rows = Math.max(1, Math.floor((h - TOP + PITCH / 2) / PITCH)), x0 = 22 + labelW, x1 = w - 9
  const shown = list ? list.slice(page * rows, page * rows + rows) : []
  const corner = standing(p.v, true) ?? NONE
  const chars = Math.floor((labelW - 2) / 4.8)
  return <Display w={w} h={h} label="Macros" corner={corner}
    does={`Your chosen controls, one line each: the line is the range, the teal part the value, a faint tick the default. A filled square holds for every scene.${handles ? ' Drag a handle to set a control.' : ''}`}>
    {!list ? <>
      <text x={w / 2} y={h / 2 - 5} textAnchor="middle" className="dp-ink-dim">No reading of</text>
      <text x={w / 2} y={h / 2 + 8} textAnchor="middle" className="dp-ink-dim">your controls</text>
    </> : !list.length ? <>
      <text x={w / 2} y={h / 2 - 5} textAnchor="middle" className="dp-ink-dim">No controls chosen</text>
      <text x={w / 2} y={h / 2 + 8} textAnchor="middle" className="dp-axis">Press + Parameter</text>
    </> : <>
      {shown.map((c, i) => {
        const y = TOP + i * PITCH, value = valueOf(p.v, c), live = c.ranged && value !== undefined
        const scale = scaleOf(c), at = (x: number) => x0 + toUnit(scale, x) * (x1 - x0)
        return <g key={c.id} opacity={c.ranged ? 1 : .55}>
          <ScopeGlyph x={8} y={y} scope={c.scope} shared={sharedOf(p.v, c) === true} />
          <text x={16} y={y} dominantBaseline="central" className="dp-ink-dim">{clip(c.label, chars)}</text>
          <path d={`M${x0} ${y}H${x1}`} className="dp-faint" strokeDasharray={c.ranged ? undefined : '2 2'} />
          {c.ranged && c.def !== null && <path d={`M${at(c.def)} ${y - 3}V${y + 3}`} className="dp-faint" />}
          {live && <path d={`M${x0} ${y}H${at(value!)}`} className="dp-curve" />}
          {live && c.plays !== null && Math.abs(c.plays - value!) > 1e-9 && <path d={`M${at(clampTo(c.min, c.max, c.plays))} ${y - 4}V${y + 4}`} className="dp-curve" opacity={.8} />}
          {!live && <text x={x1} y={y} textAnchor="end" dominantBaseline="central" className="dp-axis">{c.ranged ? NONE : '!'}</text>}
        </g>
      })}
      {shown.map((c, i) => {
        const y = TOP + i * PITCH, value = valueOf(p.v, c), key = keyOf(c), s = st(p, key)
        if (i >= handles || !c.ranged || value === undefined) return null
        const scale = scaleOf(c), live = !s.disabled && !offOf(c)
        return <Handle key={c.id} n={i + 1} shape="ring" x={x0 + toUnit(scale, value) * (x1 - x0)} y={y} label={c.label}
          does={`Drag along the line to set ${c.label}. ${saysOf(p.v, c)}`}
          onDrag={live ? px => p.set(key, snap(c, fromUnit(scale, (px - x0) / (x1 - x0)))) : undefined}
          onReset={live && c.def !== null ? () => p.set(key, c.def!) : undefined} />
      })}
    </>}
  </Display>
}

// ------------------------------------------------------------------------------------------------ the controls

/** A chosen control as the kit's dial over the owner's reading. */
function ChosenDial({p, c}: {p: ViewProps; c: Chosen}) {
  const key = keyOf(c), value = valueOf(p.v, c)
  return <Dial {...stand(p, key, offOf(c))} label={c.label} does={saysOf(p.v, c)} value={c.ranged ? value ?? NaN : NaN} def={c.def ?? undefined} scale={scaleOf(c)}
    format={x => fmt(c, x)} bipolar={c.min < 0 && c.max > 0}
    mod={c.ranged && value !== undefined && c.plays !== null && Math.abs(c.plays - value) > 1e-9 ? [value, clampTo(c.min, c.max, c.plays)] : undefined}
    onChange={x => p.set(key, snap(c, x))} />
}
function ChosenBox({p, c, wide}: {p: ViewProps; c: Chosen; wide?: boolean}) {
  const key = keyOf(c), value = valueOf(p.v, c)
  return <ValueBox {...stand(p, key, offOf(c))} label={c.label} does={saysOf(p.v, c)} value={c.ranged ? value ?? NaN : NaN} def={c.def ?? undefined} scale={scaleOf(c)}
    format={x => fmt(c, x)} bipolar={c.min < 0 && c.max > 0} wide={wide} onChange={x => p.set(key, snap(c, x))} />
}
const addAction = (p: ViewProps, list: Chosen[] | undefined) =>
  <Action {...stand(p, 'add', list ? closedWhy(p.v) : 'No reading of your controls.')} label="+ Parameter" does="Choose a parameter in the browser: it stands here as one of your macros." onPress={() => p.set('add', true)} />

/** Save, Undo and Redo stand in the head: the work's own acts, the frame's masthead controls. */
function Work({p}: {p: ViewProps}) {
  const closed = closedWhy(p.v), canUndo = boolOf(p.v, 'canUndo'), canRedo = boolOf(p.v, 'canRedo')
  return <>
    <Action {...stand(p, 'save', closed)} label="Save" does="Save the Expression. The corner of the display says whether it is edited since the last save." onPress={() => p.set('save', true)} />
    <Action {...stand(p, 'undo', closed ?? (canUndo === false ? 'There is nothing to undo.' : undefined))} label="Undo" does="Undo the last edit." onPress={() => p.set('undo', true)} />
    <Action {...stand(p, 'redo', closed ?? (canRedo === false ? 'There is nothing to redo.' : undefined))} label="Redo" does="Redo the edit that you undid." onPress={() => p.set('redo', true)} />
  </>
}

/** The plate of a compact or a whole: the kit's `dp` section with the kit's PanelHead, since the Panel has no place for the work's acts. */
function Plate({p, view, pages, children}: {p: ViewProps; view: 'compact' | 'whole'; pages?: {id: string; label: string}[]; children: ReactNode}) {
  return <section className="dp st-studio" data-view={view} aria-label="Studio" onPointerDownCapture={p.nav.select}>
    <PanelHead title="Studio" light={lightOf(p)} lightWhy={LIGHT_WHY} onFold={p.nav.fold} onFull={p.nav.full} acts={<Work p={p} />}
      pages={pages} page={p.page} onPage={p.setPage} hint="The rack for every scene of the Expression: your chosen controls as its macros, the field devices as its chains." />
    <div className="dp-body">{children}</div>
  </section>
}

/** In the expanded band and in a window the display grows into the room; the controls keep their size. */
const wideOf = (p: ViewProps) => ((p.frame === 'flip' || p.frame === 'window') && p.room ? Math.round(clampTo(194, p.room.w - 640, 460)) : 194)

// ------------------------------------------------------------------------------------------------ the whole: the macros

const REACH: readonly Option<Scope>[] = [
  {value: 'field', label: 'Field', does: 'A parameter of the field.'},
  {value: 'selected', label: 'Follow', does: 'The control acts on whichever symbol you select.'},
  {value: 'named', label: 'Bind', does: 'The control stays on one symbol, by name.'},
]

function MacrosPage({p, list}: {p: ViewProps; list: Chosen[] | undefined}) {
  const [at, setAt] = useState(0), [pick, setPick] = useState<string | undefined>(undefined)
  const chosen = list ?? []
  const sel = chosen.find(c => c.id === pick) ?? chosen[0]
  const pages = Math.max(1, Math.ceil(chosen.length / ROWS)), page = Math.min(at, pages - 1)
  const items: RowItem[] = chosen.map(c => ({
    id: c.id, name: c.label, light: c.ranged ? 'lit' : 'dark', mark: <ScopeMark scope={c.scope} />,
    note: sharedOf(p.v, c) === true ? 'All' : SCOPE_WORD[c.scope], why: offOf(c), does: saysOf(p.v, c),
  }))
  const none = list ? 'Choose a control first.' : 'No reading of your controls.'
  // Field and object are fixed by the parameter; only an object's control moves between Follow and Bind (chosen-scope).
  const reach = REACH.map(o => ({...o, why: !sel ? undefined : sel.scope === 'field'
    ? (o.value === 'field' ? undefined : 'A Field control acts on the field; it has no symbol to follow or bind.')
    : (o.value === 'field' ? 'A symbol\'s control stays on a symbol. Choose the Field parameter in the browser instead.' : undefined)}))
  const shared = sel ? sharedOf(p.v, sel) : undefined
  const shareWhy = !sel ? none : sel.scope !== 'field' ? 'A symbol\'s control acts in its own scene. Only a Field control can hold for every scene.'
    : shared === undefined ? 'No reading of whether the Expression shares it.' : closedWhy(p.v)
  const w = wideOf(p)
  // One place earlier or later in your order (chosen-order); the page follows the control it moved.
  const move = (id: string, by: -1 | 1) => {
    const at = chosen.findIndex(c => c.id === id), to = at + by
    if (at < 0 || to < 0 || to >= chosen.length) return
    p.set(by < 0 ? 'earlier' : 'later', id)
    if (Math.floor(to / ROWS) !== page) setAt(Math.floor(to / ROWS))
  }
  return <>
    <Band>
      <Section width={w + 12}><Sheet p={p} list={list} w={w} h={146} labelW={66} handles={ROWS} page={page} /></Section>
      <Section label="Macros" grow>
        <Rows items={list ? items : undefined} why="No reading of your controls." size={ROWS} page={page} onPage={setAt} selected={sel?.id} onSelect={setPick} onMove={closedWhy(p.v) ? undefined : move}
          does="Your chosen controls, in your order. Choose one to change its reach or remove it; ▲ ▼ or ⌥↑ ⌥↓ move it." label={list ? `${chosen.length} chosen` : undefined} />
      </Section>
    </Band>
    <Band>
      <Section label="Reach" width={72}>
        <Radio label="Acts on" does="What the chosen control moves: a Field parameter, the selected symbol's (Follow), or one symbol's by name (Bind)."
          value={sel ? sel.scope : ''} options={reach} stack {...stand(p, sel?.scope === 'selected' ? 'bind' : 'follow', !sel ? none : closedWhy(p.v))}
          onChange={x => { if (x !== 'field' && sel && x !== sel.scope) p.set(x === 'selected' ? 'follow' : 'bind', sel.id) }} />
        <Toggle {...stand(p, sel ? shareKey(sel) : 'shared', shareWhy)} label="All scenes"
          does="On, the value holds for every scene of the Expression and overrides the scene's envelopes. Off, each scene keeps its own."
          on={shared === true} unknown={shared === undefined} onChange={x => sel && p.set(shareKey(sel), x)} />
      </Section>
      <Section label="List" width={72}>
        {addAction(p, list)}
        <Action {...stand(p, 'remove', !sel ? none : closedWhy(p.v))} label="Remove" does="Take the chosen control out of your macros. The parameter stays in the field." onPress={() => p.set('remove', sel!.id)} />
        <Readout label="chosen" does="How many controls you have chosen." value={list ? chosen.length : undefined} />
      </Section>
      <Section label={sel ? clip(sel.label, 22) : 'Value'} grow>
        {sel ? <ChosenBox p={p} c={sel} wide /> : <ValueBox label="Value" does="The value of the chosen control." value={NaN} scale={{min: 0, max: 1}} format={String} />}
        <div className="st-pair">
          <Readout label="plays" does="What the field plays when it differs from the value, for example when an envelope or the sky moves it." value={sel && sel.ranged && sel.plays !== null ? fmt(sel, sel.plays) : undefined} />
          <Readout label="default" does="The value the control returns to when you double-click it." value={sel && sel.def !== null ? fmt(sel, sel.def) : undefined} />
        </div>
      </Section>
    </Band>
  </>
}

// ------------------------------------------------------------------------------------------------ the whole: the chains

function ChainsPage({p, members}: {p: ViewProps; members: Member[] | undefined}) {
  const [chain, setChain] = useState<ChainId>('material'), [pick, setPick] = useState<string | undefined>(undefined)
  const all = members ?? []
  const inChain = all.filter(m => m.chain === chain)
  const sel = inChain.find(m => m.family === pick) ?? inChain[0]
  const closed = closedWhy(p.v)
  const chains: RowItem[] = CHAINS.map(c => {
    const held = all.filter(m => m.chain === c.id)
    return {id: c.id, name: c.label, light: members ? chainLight(p, held) : 'unknown', note: members ? `${litOf(p, held)}/${held.length}` : undefined, does: c.does}
  })
  const devices: RowItem[] = inChain.map(m => {
    const key = onKey(m)
    return {id: m.family, name: m.name, light: memberLight(p, m), request: m.toggle && has(p.v, key) ? p.v[key] === true : undefined,
      why: m.why ?? undefined, does: [m.says, m.toggle ? undefined : alwaysWhy(m)].filter(Boolean).join(' ') || undefined}
  })
  const label = CHAINS.find(c => c.id === chain)!.label
  const none = members ? `No device stands in ${label}.` : 'No reading of the chains.'
  const nara = sel?.family === 'nara'
  const onWhy = !sel ? none : sel.why ?? (!sel.toggle ? alwaysWhy(sel) : !has(p.v, onKey(sel)) ? `No reading of ${sel.name}'s on/off.` : closed)
  const placeWhy = !sel ? none : nara ? 'Nara opens over the field: turn it on.' : sel.why ?? undefined
  return <>
    <Band>
      <Section label="Chains" width={128}>
        <Rows items={chains} size={4} selected={chain} onSelect={id => { setChain(id as ChainId); setPick(undefined) }}
          does="The rack's chains. Choose one to see its devices. The light is on while any of its devices is on." label={members ? `${litOf(p, all)} of ${all.length} on` : undefined}
          why={members ? undefined : 'No reading of the chains\' devices.'} />
      </Section>
      <Section label={label} grow>
        <Rows items={devices} size={6} selected={sel?.family} onSelect={setPick} onRequest={closed ? undefined : (id, on) => p.set(`on:${id}`, on)}
          does="The chain's devices. The square asks the owner to turn a device on or off; the light shows what the owner reports. Choose one to place it." />
      </Section>
    </Band>
    <Band>
      <Section label={sel ? clip(sel.name, 14) : 'Device'} width={84}>
        <Toggle {...stand(p, sel ? onKey(sel) : 'on', onWhy)} label={nara ? 'Open' : 'On'}
          does={nara ? 'Open your Nara instrument over the field. Press again to close it.' : 'Asks the owner to turn the device on or off. The light shows what the owner reports.'}
          on={sel ? p.v[onKey(sel)] === true : false} unknown={!sel || !has(p.v, onKey(sel))} onChange={x => sel && p.set(onKey(sel), x)} />
        <Action {...stand(p, 'show', placeWhy)} label="Show" does="Show the device whole in the pool, with every setting." onPress={() => sel && p.set('show', sel.family)} />
        <Action {...stand(p, 'pane', placeWhy)} label="Pane" does="Open the device full size in the pane that has focus." onPress={() => sel && p.set('pane', sel.family)} />
      </Section>
      <Section label="Reads" grow>
        <Readout big label={sel ? sel.name : 'device'} does="What the device's owner reports, in short." value={sel?.says ?? undefined} />
        <div className="st-pair">
          <Readout label={`${label} on`} does="How many of this chain's devices are on." value={members ? `${litOf(p, inChain)}/${inChain.length}` : undefined} />
          <Readout label="scene" does="The scene you are on. A device's settings belong to this scene unless you share them." value={strOf(p.v, 'scene')} />
        </div>
      </Section>
    </Band>
  </>
}

// ------------------------------------------------------------------------------------------------ the full: the suite

/** The design that draws a member, by its family: the field devices are Expressions' own; the torus is the one body Live plays
 * (manual §21.2). Nara has none: it opens over the field. */
const designOf = (family: string): string | undefined =>
  family === 'nara' ? undefined : family === 'torus' ? 'quaternal-logic:torus' : `expressions:${family}`
const FIELD: Member = {family: 'field', name: 'Field', chain: 'body', toggle: false, says: 'The sound, level, tempo and key of the whole field.', why: null}

/** A member that no door draws here: its name, its light and its owner's words, at the pool's width. Nara's on/off stands on it. */
function StandIn({p, m}: {p: ViewProps; m: Member}) {
  const key = onKey(m), nara = m.family === 'nara'
  return <section className="dp st-standin" aria-label={m.name}>
    <div className="dp-head"><span className="dp-lamp" data-light={memberLight(p, m)} /><span className="st-standin-name">{m.name}</span></div>
    <div className="st-standin-body">
      <p>{m.why ?? m.says ?? (nara ? 'Your personal layer over the field.' : NONE)}</p>
      {nara && <Toggle {...stand(p, key, has(p.v, key) ? closedWhy(p.v) : 'No reading of Nara.')} label="Open"
        does="Open your Nara instrument over the field. Press again to close it." on={p.v[key] === true} unknown={!has(p.v, key)} onChange={x => p.set(key, x)} />}
    </div>
  </section>
}

/** The Studio at pane size: the whole rack to work in one place (manual §20.3). Your controls at the head, every one a dial, and +
 * Parameter; the chains' index with their lights; then the Field and each chain, its devices side by side in their Whole views,
 * every setting live. The suite scrolls in its pane; each device keeps its own size. */
function Suite({p, list, members}: {p: ViewProps; list: Chosen[] | undefined; members: Member[] | undefined}) {
  const scene = strOf(p.v, 'scene'), state = standing(p.v)
  const at = useRef<Partial<Record<ChainId | 'field', HTMLElement | null>>>({})
  const draw = (m: Member) => {
    const id = designOf(m.family)
    const drawn = id && p.member ? p.member(id) : null
    return <div key={m.family} className="st-suite-member">{drawn ?? <StandIn p={p} m={m} />}</div>
  }
  const chain = (id: ChainId | 'field', label: string, held: Member[], note?: string) =>
    <section key={id} className="st-suite-chain" aria-label={label} ref={el => { at.current[id] = el }}>
      <h3><span>{label}</span>{note && <span className="st-suite-note">{note}</span>}</h3>
      <div className="st-suite-row">{held.length ? held.map(draw) : <p className="st-suite-none">{members ? `No device stands in ${label}.` : 'No reading of the chains.'}</p>}</div>
    </section>
  return <div className="st-suite" aria-label="Studio: your controls, the field and its chains">
    <header className="st-suite-head">
      <span className="dp-lamp" data-light={lightOf(p)} title={LIGHT_WHY} />
      <b>Studio</b>
      <span className="st-suite-state">{scene ? `${scene} · ` : ''}{state ?? <NoReading name="The work" why="No reading of the work." />}</span>
      <nav className="st-suite-index" aria-label="Chains">
        {CHAINS.map(c => {
          const held = (members ?? []).filter(m => m.chain === c.id)
          return <button key={c.id} type="button" data-i={`${c.label}|${c.does}`} onClick={() => at.current[c.id]?.scrollIntoView({block: 'start', behavior: 'smooth'})}>
            <span className="dp-lamp" data-light={members ? chainLight(p, held) : 'unknown'} />{c.label}
          </button>
        })}
      </nav>
      <span className="st-suite-acts"><Work p={p} /></span>
    </header>
    <section className="st-suite-belt" aria-label="Your controls">
      <h3><span>Your controls</span><span className="st-suite-note">{list ? `${list.length} chosen · the same in every scene` : <NoReading name="Your controls" why="No reading of your controls." />}</span></h3>
      <div className="st-suite-dials">
        {(list ?? []).map(c => <ChosenDial key={c.id} p={p} c={c} />)}
        {addAction(p, list)}
      </div>
    </section>
    {chain('field', 'Field', [FIELD])}
    {CHAINS.map(c => {
      const held = (members ?? []).filter(m => m.chain === c.id)
      return chain(c.id, c.label, held, members ? `${litOf(p, held)} of ${held.length} on` : undefined)
    })}
  </div>
}

// ------------------------------------------------------------------------------------------------ the sample readings
// What the gallery reads on. Macros: a toolbelt of the field's own parameters with the registry's ranges (paramRegistry.ts: Particle
// Count 1 000 to 2 000 000, log; Turbulence 0 to 15; Time Scale 0 to 4; Vortex Force −25 to 25; Curl Speed −10 to 15; Gravity Y −10 to 10)
// at the Physics device's defaults, Particle Count and Turbulence shared across the Expression, a symbol's control that follows the
// selection and one bound by name (nativeParameters.ts formation targets: Rotation −180 to 180 degrees, Particle share 0 to 10), and a
// bound symbol absent from the scene (the owner's own words, chosenControls.ts). Chains: the holder table's field devices with their
// owners' on/off where they have one (nativeFieldFaceModel.ts) and short summaries in the owners' terms; the torus waits for its owner
// (quaternalLogicFamilyManifest.ts, admission waiting). `defaults` and `fixtures` use them and nothing else does.

const dump = (x: unknown) => JSON.stringify(x)
const BELT = [
  {id: 'belt-1', label: 'Particle Count', scope: 'field', subject: null, min: 1000, max: 2000000, step: 1, log: true, def: 200000, unit: null, plays: null, locked: false, why: null},
  {id: 'belt-2', label: 'Turbulence', scope: 'field', subject: null, min: 0, max: 15, step: 0.1, log: false, def: 1, unit: null, plays: null, locked: false, why: null},
  {id: 'belt-3', label: 'Time Scale', scope: 'field', subject: null, min: 0, max: 4, step: 0.01, log: false, def: 1, unit: null, plays: null, locked: false, why: null},
  {id: 'belt-4', label: 'Vortex Force', scope: 'field', subject: null, min: -25, max: 25, step: 0.1, log: false, def: 1.4, unit: null, plays: 2.1, locked: false, why: null},
  {id: 'belt-5', label: 'Curl Speed', scope: 'field', subject: null, min: -10, max: 15, step: 0.05, log: false, def: 0.6, unit: null, plays: null, locked: false, why: null},
  {id: 'belt-6', label: 'Gravity Y', scope: 'field', subject: null, min: -10, max: 10, step: 0.05, log: false, def: -1.2, unit: null, plays: null, locked: false, why: null},
  {id: 'belt-7', label: 'Rotation', scope: 'selected', subject: 'Heart', min: -180, max: 180, step: 1, log: false, def: 0, unit: 'degrees', plays: null, locked: false, why: null},
  {id: 'belt-8', label: 'Particle share', scope: 'named', subject: 'Root', min: 0, max: 10, step: 0.1, log: false, def: 1, unit: 'relative weight', plays: null, locked: false, why: null},
  {id: 'belt-9', label: 'Width', scope: 'named', subject: null, min: null, max: null, step: null, log: false, def: null, unit: null, plays: null, locked: false, why: 'The bound object is absent from this Scene'},
]
const VALUES: Record<string, number> = {'belt-1': 200000, 'belt-2': 1, 'belt-3': 1, 'belt-4': 1.4, 'belt-5': 0.6, 'belt-6': -1.2, 'belt-7': 0, 'belt-8': 1}
const SHARED: Record<string, boolean> = {'belt-1': true, 'belt-2': true, 'belt-3': false, 'belt-4': false, 'belt-5': false, 'belt-6': false}
const DEVICES = [
  {family: 'colour', name: 'Colour', chain: 'material', toggle: true, says: '5 colours · cycle 0', why: null},
  {family: 'ink', name: 'Ink', chain: 'material', toggle: false, says: '200k particles · 0.16–1.6 px', why: null},
  {family: 'depth', name: 'Depth', chain: 'material', toggle: true, says: '3D body off · fade 0.35', why: null},
  {family: 'medium', name: 'Medium', chain: 'material', toggle: true, says: 'Off · coupling 0.4', why: null},
  {family: 'pointer', name: 'Pointer', chain: 'motion', toggle: false, says: 'Radius 0.23 · force 0.8', why: null},
  {family: 'relational', name: 'Relational', chain: 'motion', toggle: true, says: 'Pull 1.2 · spin 0.4', why: null},
  {family: 'contacts', name: 'Contacts', chain: 'motion', toggle: true, says: 'Off', why: null},
  {family: 'morph', name: 'Morph', chain: 'motion', toggle: true, says: 'Dwell 0.6 · rate 0.12', why: null},
  {family: 'focus', name: 'Focus', chain: 'motion', toggle: false, says: 'Parallel', why: null},
  {family: 'physics', name: 'Physics', chain: 'body', toggle: false, says: 'Viscosity 0.94 · time 1', why: null},
  {family: 'resonance', name: 'Resonance', chain: 'body', toggle: true, says: '396 Hz · 64 modes', why: null},
  {family: 'torus', name: 'Torus', chain: 'body', toggle: false, says: null, why: 'The torus waits for its owner in Expressions.'},
  {family: 'nara', name: 'Nara', chain: 'nara', toggle: true, says: 'Closed', why: null},
]
const ON: Record<string, boolean> = {colour: true, depth: false, medium: false, relational: true, contacts: false, morph: true, resonance: true, nara: false}

const DEFAULTS: Values = {
  open: true, scene: 'Opening', dirty: false, pending: false, canUndo: false, canRedo: false,
  controls: dump(BELT), ...Object.fromEntries(Object.entries(VALUES).map(([id, x]) => [`control:${id}`, x])),
  ...Object.fromEntries(Object.entries(SHARED).map(([id, x]) => [`shared:${id}`, x])),
  devices: dump(DEVICES), ...Object.fromEntries(Object.entries(ON).map(([family, x]) => [`on:${family}`, x])),
}

// ------------------------------------------------------------------------------------------------ the device

function slots(p: ViewProps, list: Chosen[] | undefined) {
  const first = list ? list.slice(0, 4) : []
  return <>
    {first.map(c => <ChosenDial key={c.id} p={p} c={c} />)}
    {first.length < 4 && <div className="st-span2">{addAction(p, list)}</div>}
  </>
}

export const design: DesignedDevice = {
  id: 'expressions:studio',
  title: 'Studio',
  kind: 'rack',
  firstPage: 'macros',
  defaults: DEFAULTS,
  fixtures: {
    'Saved, nine chosen': {},
    'Edited, Nara open': {dirty: true, canUndo: true, 'control:belt-2': 4.5, 'control:belt-3': 0.6, 'shared:belt-3': true, 'on:nara': true, 'on:medium': true},
    'No readings': Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, undefined])),
  },

  folded: p => {
    const list = readControls(p.v)
    return <Folded title="Studio" light={lightOf(p)} readings={[standing(p.v, true) ?? NONE, list ? `${list.length} chosen` : NONE]} onUnfold={p.nav.unfold} />
  },

  compact: p => {
    const list = readControls(p.v)
    return <Plate p={p} view="compact">
      <Section width={152}><Sheet p={p} list={list} w={140} h={146} labelW={50} handles={4} /></Section>
      <Section label="Macros" cols={2} width={160}>{slots(p, list)}</Section>
    </Plate>
  },

  whole: p => {
    const list = readControls(p.v), members = readDevices(p.v)
    return <Plate p={p} view="whole" pages={[{id: 'macros', label: 'Macros'}, {id: 'chains', label: 'Chains'}]}>
      {p.page === 'chains' ? <ChainsPage p={p} members={members} /> : <MacrosPage p={p} list={list} />}
    </Plate>
  },

  full: p => <Suite p={p} list={readControls(p.v)} members={readDevices(p.v)} />,

  // In its own window the suite is the whole of it: its macros and every device already stand in it, so no Whole goes under it.
  popout: p => <div className="st-window" style={{height: p.room?.h}}><Suite p={p} list={readControls(p.v)} members={readDevices(p.v)} /></div>,

  widget: p => {
    const list = readControls(p.v)
    const first = list ? list.slice(0, 3) : []
    return <Tile title="Studio" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <Sheet p={p} list={list} w={112} h={104} labelW={36} handles={0} />
      <div className="st-tile-side">
        {first.map(c => <ChosenBox key={c.id} p={p} c={c} />)}
        {first.length < 3 && addAction(p, list)}
      </div>
    </Tile>
  },
}
