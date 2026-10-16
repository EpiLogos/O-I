// Studio (manual §20.2): the Expressions toolbar the person curates. Live's nearest: a rack with only its macros showing — the
// Instrument Rack's Macros section, whose knobs the person chose. The rack's chain is "Your controls" (the frame's toolbelt,
// Journey.shared.toolbelt, read as the boundary's chosen controls: chosenControls.ts readNativeChosenControls). Each is one real
// parameter of the field (a Field property) or of an object (Follow the selection, or Bind a named object). The compact takes its
// four dials from the first four of them, in the person's order (T-FRAME-CHROME-ONTO-PLATES, decision c). Beside them stand the
// Studio's own tools: Work (Save, Undo, Redo, in the head: the frame's masthead controls), Capture (StudioStage.tsx) and Nara.
//
// Everything the device draws is a value key.
//   open       boolean   a native Expression is open (the light)
//   scene      string    the Scene's name
//   dirty      boolean   edited since the last save (NativeEditorReading.standing.dirty)
//   pending    boolean   the owner is answering the last change (standing.pending)
//   canUndo, canRedo  boolean   the editor's history
//   controls   JSON      [{id, label, scope: field | selected | named, subject, min, max, step, log, def, unit, plays, locked, why}]
//                        one per chosen control, in the person's order. A control the owner cannot resolve has no min or max and
//                        carries its reason in `why` (NativeChosenControlReading.unavailable_reason).
//   control:<id>   number   the control's value (base_value). A value key per control: it carries the control's own standing.
//   recording, presenting, videoTake   boolean   the stage's readings (stageReadings)
//   naraOpen   boolean   the Nara instrument is open over the field (the frame's Nara toggle)
// Held by the hand, sent with each capture and stored by nobody (StageCaptureTools): captureKind, captureWidth, captureAspect,
// includeText, transparent, exportFormat. share (Private | Circle) has no owner yet.
// Acts, each on its own key: save, undo, redo (the frame's own controls), add (+ Parameter), earlier, later, remove, follow, bind
// (each carries the control's id), capture, record (start | stop), saveVideo, export (the format), import.
// A key the owner does not report is absent. The picture then names the missing reading and every control draws "—".
import {useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, PanelHead, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, fromUnit, toUnit,
  type LightState, type Option, type RowItem, type Scale, type Standing} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type Values, type ViewProps} from './design'
import './expressions__studio.css'

type V = ViewProps['v']
type Scope = 'field' | 'selected' | 'named'

// ------------------------------------------------------------------------------------------------ the vocabulary

/** The three reaches of a chosen control, in the toolbelt's own scopes: a Field property, an object that follows the selection, an object bound by name. */
const SCOPE_WORD: Record<Scope, string> = {field: 'Field', selected: 'Follow', named: 'Bind'}
const WIDTHS = [1280, 1440, 1920, 3840] as const
const ASPECTS: readonly {value: string; label: string; ratio: number | null}[] = [
  {value: 'stage', label: 'stage', ratio: null}, {value: '16:9', label: '16:9', ratio: 16 / 9}, {value: '1:1', label: '1:1', ratio: 1}, {value: '9:16', label: '9:16', ratio: 9 / 16}]
const KINDS: readonly Option<string>[] = [{value: 'still', label: 'Still', does: 'Capture makes a still of the stage, a PNG.'}, {value: 'video', label: 'Video', does: 'Capture records a video take of the stage.'}]
const FORMATS: readonly Option<string>[] = [{value: 'json', label: 'Expression JSON'}, {value: 'native', label: 'Native configuration'}, {value: 'html', label: 'Living HTML'}]
const SHARES: readonly Option<string>[] = [{value: 'private', label: 'Private', does: 'Your personal layer stays with you, however the scene is shared.'}, {value: 'circle', label: 'Circle', does: 'Your circle sees your personal layer.'}]
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
const subjectOf = (c: Chosen) => (c.scope === 'field' ? 'the field' : c.subject ?? (c.scope === 'selected' ? 'the selected object' : 'an absent object'))
const saysOf = (c: Chosen) => `${SCOPE_WORD[c.scope]} · ${subjectOf(c)}.${c.ranged ? ` ${fmt(c, c.min)} to ${fmt(c, c.max)}${c.unit ? ` ${c.unit}` : ''}.` : ''}${c.def !== null ? ` Default ${fmt(c, c.def)}.` : ''}`
/** Why a control cannot be moved now, in the owner's words, or undefined. */
const offOf = (c: Chosen) => (c.why ?? (c.locked ? `${subjectOf(c)} is locked. Its owner takes no change.` : undefined))
const clip = (label: string, n: number) => (label.length > n ? `${label.slice(0, Math.max(1, n - 1))}…` : label)

/** The standing against the last save, in a word: the owner's own (sceneClip.ts standingWord), short for a corner. */
function standing(v: V, short = false): string | undefined {
  if (boolOf(v, 'pending') === true) return short ? 'busy' : 'owner answering'
  const dirty = boolOf(v, 'dirty')
  return dirty === undefined ? undefined : dirty ? (short ? 'edited' : 'edited since save') : 'saved'
}
const lightOf = (p: ViewProps): LightState => { const o = p.owner ?? p.v; return !has(o, 'open') ? 'unknown' : o.open === true ? 'lit' : 'dark' }
/** The host's standing for a key, with the view's own reason in front when the host has none. */
const stand = (p: ViewProps, key: string, why?: string): Standing => { const s = st(p, key); return s.disabled || !why ? s : {...s, disabled: why} }
const closedWhy = (v: V) => (boolOf(v, 'open') === false ? 'Open a native Expression first.' : undefined)

// ------------------------------------------------------------------------------------------------ the marks

/** A control's reach as a small mark: a square for the Field, a ring for Follow, a filled dot for Bind. */
function ScopeMark({scope}: {scope: Scope}) {
  return <svg className="st-scope" width={9} height={9} viewBox="0 0 9 9" role="img" aria-label={SCOPE_WORD[scope]}>
    {scope === 'field' ? <rect x={1.5} y={1.5} width={6} height={6} /> : <circle cx={4.5} cy={4.5} r={3} data-fill={scope === 'named' ? 'true' : undefined} />}
  </svg>
}
function ScopeGlyph({x, y, scope}: {x: number; y: number; scope: Scope}) {
  return scope === 'field' ? <rect x={x - 2.5} y={y - 2.5} width={5} height={5} className="dp-curve" style={{strokeWidth: 1.1}} />
    : <circle cx={x} cy={y} r={2.6} className="dp-curve" style={scope === 'named' ? {strokeWidth: 1.1, fill: 'var(--dp-value)'} : {strokeWidth: 1.1}} />
}

// ------------------------------------------------------------------------------------------------ the display: your controls as ranges

/** Your controls, one line each. A line is the control's range, its teal part the value, a faint tick the default, a short tick what the
 * field plays when that differs. Handles 1 to `handles` set the first controls of the page. */
function Sheet({p, list, w, h, labelW, handles, page = 0}: {p: ViewProps; list: Chosen[] | undefined; w: number; h: number; labelW: number; handles: number; page?: number}) {
  const rows = Math.max(1, Math.floor((h - TOP + PITCH / 2) / PITCH)), x0 = 22 + labelW, x1 = w - 9
  const shown = list ? list.slice(page * rows, page * rows + rows) : []
  const corner = standing(p.v, true) ?? NONE
  const chars = Math.floor((labelW - 2) / 4.8)
  return <Display w={w} h={h} label="Your controls" corner={corner}
    does={`Your chosen controls, one line each: the line is the range, the teal part the value, a faint tick the default.${handles ? ' Drag a handle to set a control.' : ''}`}>
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
          <ScopeGlyph x={8} y={y} scope={c.scope} />
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
          does={`Drag along the line to set ${c.label}. ${saysOf(c)}`}
          onDrag={live ? px => p.set(key, snap(c, fromUnit(scale, (px - x0) / (x1 - x0)))) : undefined}
          onReset={live && c.def !== null ? () => p.set(key, c.def!) : undefined} />
      })}
    </>}
  </Display>
}

/** The capture frame: its aspect and its background drawn from the values, and the two stepped scales with their handles. */
function FrameDisplay({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const width = numOf(p.v, 'captureWidth'), aspect = strOf(p.v, 'captureAspect'), text = boolOf(p.v, 'includeText'), clear = boolOf(p.v, 'transparent')
  const recording = boolOf(p.v, 'recording') === true
  const bx = 12, bw = w - 24, by = 20, bh = 56, rx0 = 26, rx1 = w - 26
  const stopX = (i: number) => rx0 + i * (rx1 - rx0) / 3
  const stopAt = (px: number) => clampTo(0, 3, Math.round((px - rx0) / (rx1 - rx0) * 3))
  const wi = WIDTHS.findIndex(x => x === width), ai = ASPECTS.findIndex(a => a.value === aspect)
  const ratio = ai >= 0 ? ASPECTS[ai]!.ratio : undefined
  // The frame sits in the box; a stage frame is the stage as it stands, so it takes the whole box, dashed (its ratio is the pane's).
  const fw = ai < 0 ? 0 : ratio === null || ratio === undefined ? bw : Math.min(bw, bh * ratio), fh = ai < 0 ? 0 : ratio === null || ratio === undefined ? bh : fw / (ratio ?? 1)
  const fx = bx + (bw - fw) / 2, fy = by + (bh - fh) / 2
  const cells: [number, number, number, number][] = []
  if (clear === true && fw > 0) for (let i = 0; i * 6 < fw; i++) for (let j = 0; j * 6 < fh; j++) if ((i + j) % 2 === 0) cells.push([fx + i * 6, fy + j * 6, Math.min(6, fw - i * 6), Math.min(6, fh - j * 6)])
  const writable = (key: string) => !st(p, key).disabled
  return <Display w={w} h={h} label="The capture frame" corner={width !== undefined && aspect ? `${width} px · ${aspect}` : NONE}
    does="The frame that Capture makes: its aspect, its background and its text. Drag handle 1 along the first line to set the width and handle 2 along the second to set the frame.">
    {ai < 0 ? <text x={w / 2} y={by + bh / 2} textAnchor="middle" className="dp-ink-dim">No reading of the frame</text> : <>
      <rect x={fx} y={fy} width={fw} height={fh} className={clear === true ? 'dp-faint' : 'dp-fill'} strokeDasharray={ratio === null ? '3 3' : undefined} />
      {cells.map(([x, y, cw, ch], k) => <rect key={k} x={x} y={y} width={cw} height={ch} className="dp-fill" />)}
      <rect x={fx} y={fy} width={fw} height={fh} className="dp-faint" strokeDasharray={ratio === null ? '3 3' : undefined} />
      {text === true && <text x={fx + 5} y={fy + 12} className="dp-ink">Aa</text>}
      {recording && <circle cx={fx + fw - 7} cy={fy + 7} r={3} style={{fill: 'var(--rec)'}} />}
    </>}
    <text x={rx0} y={88} className="dp-axis">width px</text>
    <path d={`M${rx0} 96H${rx1}`} className="dp-faint" />
    {WIDTHS.map((x, i) => <g key={x}><path d={`M${stopX(i)} 92V100`} className="dp-faint" /><text x={stopX(i)} y={110} textAnchor="middle" className="dp-axis">{x}</text></g>)}
    <text x={rx0} y={118} className="dp-axis">frame</text>
    <path d={`M${rx0} 126H${rx1}`} className="dp-faint" />
    {ASPECTS.map((a, i) => <g key={a.value}><path d={`M${stopX(i)} 122V130`} className="dp-faint" /><text x={stopX(i)} y={140} textAnchor="middle" className="dp-axis">{a.label}</text></g>)}
    {wi >= 0 && <Handle n={1} shape="ring" x={stopX(wi)} y={96} label="Width" does="Drag along the line: the width of a capture, in pixels."
      onDrag={writable('captureWidth') ? px => p.set('captureWidth', WIDTHS[stopAt(px)]!) : undefined} onReset={writable('captureWidth') ? () => p.set('captureWidth', 1440) : undefined} />}
    {ai >= 0 && <Handle n={2} shape="square" x={stopX(ai)} y={126} label="Frame" does="Drag along the line: the frame of a capture. Stage is the stage as it stands."
      onDrag={writable('captureAspect') ? px => p.set('captureAspect', ASPECTS[stopAt(px)]!.value) : undefined} onReset={writable('captureAspect') ? () => p.set('captureAspect', 'stage') : undefined} />}
  </Display>
}

// ------------------------------------------------------------------------------------------------ the controls

/** A chosen control as the kit's dial over the owner's reading. */
function ChosenDial({p, c}: {p: ViewProps; c: Chosen}) {
  const key = keyOf(c), value = valueOf(p.v, c)
  return <Dial {...stand(p, key, offOf(c))} label={c.label} does={saysOf(c)} value={c.ranged ? value ?? NaN : NaN} def={c.def ?? undefined} scale={scaleOf(c)}
    format={x => fmt(c, x)} bipolar={c.min < 0 && c.max > 0}
    mod={c.ranged && value !== undefined && c.plays !== null && Math.abs(c.plays - value) > 1e-9 ? [value, clampTo(c.min, c.max, c.plays)] : undefined}
    onChange={x => p.set(key, snap(c, x))} />
}
function ChosenBox({p, c, wide}: {p: ViewProps; c: Chosen; wide?: boolean}) {
  const key = keyOf(c), value = valueOf(p.v, c)
  return <ValueBox {...stand(p, key, offOf(c))} label={c.label} does={saysOf(c)} value={c.ranged ? value ?? NaN : NaN} def={c.def ?? undefined} scale={scaleOf(c)}
    format={x => fmt(c, x)} bipolar={c.min < 0 && c.max > 0} wide={wide} onChange={x => p.set(key, snap(c, x))} />
}
const addAction = (p: ViewProps, list: Chosen[] | undefined) =>
  <Action {...stand(p, 'add', list ? closedWhy(p.v) : 'No reading of your controls.')} label="+ Parameter" does="Choose a parameter in the browser: it stands here as one of your controls." onPress={() => p.set('add', true)} />

/** Save, Undo and Redo stand in the head: the work's own acts, the frame's masthead controls. */
function Work({p}: {p: ViewProps}) {
  const closed = closedWhy(p.v), canUndo = boolOf(p.v, 'canUndo'), canRedo = boolOf(p.v, 'canRedo')
  return <>
    <Action {...stand(p, 'save', closed)} label="Save" does="Save the work to its native Expression. The corner of the display says whether it is edited since the last save." onPress={() => p.set('save', true)} />
    <Action {...stand(p, 'undo', closed ?? (canUndo === false ? 'There is nothing to undo.' : undefined))} label="Undo" does="Undo the last edit." onPress={() => p.set('undo', true)} />
    <Action {...stand(p, 'redo', closed ?? (canRedo === false ? 'There is nothing to redo.' : undefined))} label="Redo" does="Redo the edit that you undid." onPress={() => p.set('redo', true)} />
  </>
}

/** The plate of a compact or a whole: the kit's `dp` section with the kit's PanelHead, since the Panel has no place for the work's acts. */
function Plate({p, view, pages, children}: {p: ViewProps; view: 'compact' | 'whole'; pages?: {id: string; label: string}[]; children: ReactNode}) {
  return <section className="dp" data-view={view} aria-label="Studio" onPointerDownCapture={p.nav.select}>
    <PanelHead title="Studio" light={lightOf(p)} lightWhy={LIGHT_WHY} onFold={p.nav.fold} onFull={p.nav.full} acts={<Work p={p} />}
      pages={pages} page={p.page} onPage={p.setPage} hint="The toolbar you curate: your controls, the work, capture and Nara." />
    <div className="dp-body">{children}</div>
  </section>
}

// ------------------------------------------------------------------------------------------------ the whole: your controls

function ControlsPage({p, list}: {p: ViewProps; list: Chosen[] | undefined}) {
  const [at, setAt] = useState(0), [pick, setPick] = useState<string | undefined>(undefined)
  const chosen = list ?? []
  const sel = chosen.find(c => c.id === pick) ?? chosen[0]
  const index = sel ? chosen.indexOf(sel) : -1
  const pages = Math.max(1, Math.ceil(chosen.length / ROWS)), page = Math.min(at, pages - 1)
  const items: RowItem[] = chosen.map(c => ({
    id: c.id, name: c.label, light: c.ranged ? 'lit' : 'dark', mark: <ScopeMark scope={c.scope} />, note: SCOPE_WORD[c.scope], why: offOf(c), does: saysOf(c),
  }))
  const none = list ? 'Choose a control first.' : 'No reading of your controls.'
  const scopeWhy = !sel ? none : sel.scope === 'field' ? 'A Field control has no object to follow or bind.' : undefined
  return <>
    <Band>
      <Section width={206}><Sheet p={p} list={list} w={194} h={146} labelW={66} handles={ROWS} page={page} /></Section>
      <Section label="Your controls" grow>
        <Rows items={items} size={ROWS} page={page} onPage={setAt} selected={sel?.id} onSelect={setPick}
          does="Your controls, in your order. Choose one to move it, change its scope or remove it." label={list ? `${chosen.length} chosen` : 'No reading'} />
      </Section>
    </Band>
    <Band>
      <Section label="Order" width={68}>
        <Action {...stand(p, 'earlier', !sel ? none : index === 0 ? 'It is the first control.' : undefined)} label="Earlier" does="Move the chosen control one place earlier in your controls."
          onPress={() => { p.set('earlier', sel!.id); if (index > 0 && Math.floor((index - 1) / ROWS) !== page) setAt(Math.floor((index - 1) / ROWS)) }} />
        <Action {...stand(p, 'later', !sel ? none : index === chosen.length - 1 ? 'It is the last control.' : undefined)} label="Later" does="Move the chosen control one place later in your controls."
          onPress={() => { p.set('later', sel!.id); if (Math.floor((index + 1) / ROWS) !== page) setAt(Math.floor((index + 1) / ROWS)) }} />
      </Section>
      <Section label="Control" width={68}>
        <Radio label="Scope" does="Follow acts on the object that you select. Bind stays on the object it names." value={sel ? (sel.scope === 'selected' ? 'follow' : sel.scope === 'named' ? 'bind' : '') : ''}
          options={[{value: 'follow', label: 'Follow', does: 'The control acts on whichever object you select.'}, {value: 'bind', label: 'Bind', does: 'The control stays on this object.'}]} stack
          {...stand(p, sel?.scope === 'selected' ? 'bind' : 'follow', scopeWhy)} onChange={x => p.set(x === 'follow' ? 'follow' : 'bind', sel!.id)} />
        <Action {...stand(p, 'remove', !sel ? none : undefined)} label="Remove" does="Take the chosen control out of your controls. The parameter stays in the field." onPress={() => p.set('remove', sel!.id)} />
      </Section>
      <Section label="Add" width={68}>
        {addAction(p, list)}
        <Readout label="chosen" does="How many controls you have chosen." value={list ? chosen.length : undefined} />
      </Section>
      <Section label={sel ? clip(sel.label, 22) : 'Value'} grow>
        {sel ? <ChosenBox p={p} c={sel} wide /> : <ValueBox label="Value" does="The value of the chosen control." value={NaN} scale={{min: 0, max: 1}} format={String} />}
        <div className="st-pair">
          <Readout label="plays" does="What the field plays when it differs from the value, for example when the sky or an automation lane moves it." value={sel && sel.ranged && sel.plays !== null ? fmt(sel, sel.plays) : undefined} />
          <Readout label="default" does="The value the control returns to when you double-click it." value={sel && sel.def !== null ? fmt(sel, sel.def) : undefined} />
        </div>
      </Section>
    </Band>
  </>
}

// ------------------------------------------------------------------------------------------------ the whole: the Studio's tools

function ToolsPage({p}: {p: ViewProps}) {
  const recording = boolOf(p.v, 'recording'), presenting = boolOf(p.v, 'presenting'), videoTake = boolOf(p.v, 'videoTake'), naraOpen = boolOf(p.v, 'naraOpen')
  const kind = recording === true ? 'video' : strOf(p.v, 'captureKind') ?? ''
  const closed = closedWhy(p.v)
  const undo = boolOf(p.v, 'canUndo'), redo = boolOf(p.v, 'canRedo')
  const history = undo === undefined && redo === undefined ? undefined : [undo ? 'undo' : '', redo ? 'redo' : ''].filter(Boolean).join(' · ') || 'none'
  return <>
    <Band>
      <Section width={206}><FrameDisplay p={p} w={194} h={146} /></Section>
      <Section label="Take" width={68}>
        <Radio label="Make" does="What Capture makes: a still of the stage, or a video take." value={kind} options={KINDS} stack {...stand(p, 'captureKind', recording === true ? 'Stop the recording first.' : undefined)}
          onChange={x => p.set('captureKind', x)} />
        {kind === 'video'
          ? <Action {...stand(p, 'record', closed)} label={recording === true ? 'Stop' : 'Record'} does={recording === true ? 'Stop the take. It is held until you save the video.' : 'Record a video take of the stage.'} onPress={() => p.set('record', recording === true ? 'stop' : 'start')} />
          : <Action {...stand(p, 'capture', closed)} label="Capture" does="Capture a still of the stage in the frame on the left." onPress={() => p.set('capture', true)} />}
        <Action {...stand(p, 'saveVideo', recording === true ? 'Stop the recording first.' : videoTake === true ? closed : 'Record a take first.')} label="Save video" does="Save the take that you recorded." onPress={() => p.set('saveVideo', true)} />
        <Toggle {...stand(p, 'presenting', closed)} label="Present" does="Present the stage on its own. Press again to leave." on={presenting === true} unknown={presenting === undefined} onChange={x => p.set('presenting', x)} />
      </Section>
      <Section label="Frame" grow>
        <Chooser label="Width" does="The width of a capture, in pixels." value={has(p.v, 'captureWidth') ? String(numOf(p.v, 'captureWidth')) : ''} {...st(p, 'captureWidth')}
          options={WIDTHS.map(x => ({value: String(x), label: `${x} px`}))} onChange={x => p.set('captureWidth', Number(x))} />
        <Chooser label="Frame" does="The frame of a capture. Stage is the stage as it stands." value={strOf(p.v, 'captureAspect') ?? ''} {...st(p, 'captureAspect')}
          options={ASPECTS.map(a => ({value: a.value, label: a.label}))} onChange={x => p.set('captureAspect', x)} />
        <div className="st-pair">
          <Toggle {...st(p, 'includeText')} label="Text" does="Include the text of the scene in the capture." on={boolOf(p.v, 'includeText') === true} unknown={!has(p.v, 'includeText')} onChange={x => p.set('includeText', x)} />
          <Toggle {...st(p, 'transparent')} label="Clear" does="Capture on a transparent background." on={boolOf(p.v, 'transparent') === true} unknown={!has(p.v, 'transparent')} onChange={x => p.set('transparent', x)} />
        </div>
      </Section>
    </Band>
    <Band>
      <Section label="Export" width={124}>
        <Chooser label="Format" does="What Export writes." value={strOf(p.v, 'exportFormat') ?? ''} {...st(p, 'exportFormat')} options={FORMATS} onChange={x => p.set('exportFormat', x)} />
        <div className="st-pair">
          <Action {...stand(p, 'export', closed)} label="Export" does="Export the work in the chosen format." onPress={() => p.set('export', strOf(p.v, 'exportFormat') ?? 'json')} />
          <Action {...stand(p, 'import', closed)} label="Import" does="Import a work into the field." onPress={() => p.set('import', true)} />
        </div>
      </Section>
      <Section label="Nara" width={96}>
        <Toggle {...stand(p, 'naraOpen', closed)} label="Nara" does="Open your personal Nara instrument over the field. Press again to close it." on={naraOpen === true} unknown={naraOpen === undefined} onChange={x => p.set('naraOpen', x)} />
        <Radio label="Share" does="Private keeps your personal layer with you, however the scene is shared. Circle shows it to your circle." value={strOf(p.v, 'share') ?? ''} options={SHARES} stack
          {...st(p, 'share')} onChange={x => p.set('share', x)} />
      </Section>
      <Section label="Work" grow>
        <Readout big label="work" does="Whether the work is edited since its last save, as the owner reports it." value={standing(p.v)} tone={boolOf(p.v, 'dirty') ? 'accent' : 'green'} />
        <div className="st-pair">
          <Readout label="scene" does="The Scene that you are working in." value={strOf(p.v, 'scene')} />
          <Readout label="history" does="What the editor can undo and redo." value={history} />
        </div>
      </Section>
    </Band>
  </>
}

// ------------------------------------------------------------------------------------------------ the pane's body

/** Your controls as a sheet, at pane size. No control stands in it: the controls are in Device view, below. */
function Pane({p, list}: {p: ViewProps; list: Chosen[] | undefined}) {
  const W = 760, H = 420, x0 = 360, x1 = 620, first = 78, pitch = 25, rows = 13
  const scene = strOf(p.v, 'scene'), state = standing(p.v)
  return <div className="st-pane">
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-label="Your controls">
      <g className="dp-display" style={{background: 'none'}}>
        <text x={28} y={30} className="dp-ink" style={{fontSize: 15}}>Your controls</text>
        <text x={W - 28} y={30} textAnchor="end" className="dp-ink-dim" style={{fontSize: 12}}>{scene ? `${scene} · ` : ''}{state ?? 'no reading of the work'}</text>
        {!list ? <text x={W / 2} y={H / 2} textAnchor="middle" className="dp-ink-dim" style={{fontSize: 13}}>No reading of your controls</text>
          : !list.length ? <>
            <text x={W / 2} y={H / 2 - 6} textAnchor="middle" className="dp-ink-dim" style={{fontSize: 13}}>No controls chosen</text>
            <text x={W / 2} y={H / 2 + 14} textAnchor="middle" className="dp-axis" style={{fontSize: 11}}>Press + Parameter in Device view to choose one.</text>
          </> : <>
            <text x={44} y={56} className="dp-axis" style={{fontSize: 10}}>control</text>
            <text x={214} y={56} className="dp-axis" style={{fontSize: 10}}>acts on</text>
            <text x={x0} y={56} className="dp-axis" style={{fontSize: 10}}>value in its range</text>
            {list.slice(0, rows).map((c, i) => {
              const y = first + i * pitch, value = valueOf(p.v, c), live = c.ranged && value !== undefined, scale = scaleOf(c), at = (x: number) => x0 + toUnit(scale, x) * (x1 - x0)
              const moved = live && c.plays !== null && Math.abs(c.plays - value!) > 1e-9
              return <g key={c.id} opacity={c.ranged ? 1 : .55}>
                <ScopeGlyph x={32} y={y} scope={c.scope} />
                <text x={44} y={y} dominantBaseline="central" className="dp-ink" style={{fontSize: 13}}>{clip(c.label, 22)}</text>
                <text x={214} y={y} dominantBaseline="central" className="dp-ink-dim" style={{fontSize: 12}}>{clip(`${SCOPE_WORD[c.scope]} · ${subjectOf(c)}`, 26)}</text>
                {c.ranged ? <path d={`M${x0} ${y}H${x1}`} className="dp-faint" />
                  : <text x={x0} y={y} dominantBaseline="central" className="dp-axis" style={{fontSize: 10.5}}>{clip(c.why ?? '', 44)}</text>}
                {c.ranged && c.def !== null && <path d={`M${at(c.def)} ${y - 4}V${y + 4}`} className="dp-faint" />}
                {live && <path d={`M${x0} ${y}H${at(value!)}`} className="dp-curve" style={{strokeWidth: 2}} />}
                {live && <circle cx={at(value!)} cy={y} r={3.2} style={{fill: 'var(--dp-on)'}} />}
                {moved && <path d={`M${at(clampTo(c.min, c.max, c.plays!))} ${y - 5}V${y + 5}`} className="dp-curve" />}
                <text x={x1 + 18} y={y} dominantBaseline="central" className="dp-ink" style={{fontSize: 12}}>
                  {live ? fmt(c, value!) : c.ranged ? NONE : '!'}{live && moved ? ` → ${fmt(c, c.plays!)}` : ''}
                  {live && c.unit ? <tspan className="dp-ink-dim" dx={4}>{clip(c.unit, 16)}</tspan> : null}
                </text>
              </g>
            })}
            {list.length > rows && <text x={44} y={H - 14} className="dp-ink-dim" style={{fontSize: 11}}>{`+ ${list.length - rows} more in the pool`}</text>}
          </>}
      </g>
    </svg>
  </div>
}

// ------------------------------------------------------------------------------------------------ the sample readings
// What the gallery reads on: a toolbelt of the field's own parameters with the registry's ranges (paramRegistry.ts: Particle Count
// 1 000 to 2 000 000, log; Turbulence 0 to 15; Time Scale 0 to 4; Vortex Force −25 to 25; Curl Speed −10 to 15; Gravity Y −10 to 10) at
// the Physics device's defaults, an object that follows the selection and an object bound by name (nativeParameters.ts formation
// targets: Rotation −180 to 180 degrees, Particle share 0 to 10), and a bound object that is absent from the Scene (the owner's own
// words, chosenControls.ts). `defaults` and `fixtures` use them and nothing else does.

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

const DEFAULTS: Values = {
  open: true, scene: 'O I', dirty: false, pending: false, canUndo: false, canRedo: false,
  controls: dump(BELT), ...Object.fromEntries(Object.entries(VALUES).map(([id, x]) => [`control:${id}`, x])),
  recording: false, presenting: false, videoTake: false, naraOpen: false,
  // The Image suite's defaults, as the frame starts them (native/stageCommands.ts STAGE_CAPTURE_DEFAULTS), and the first export format.
  captureKind: 'still', captureWidth: 1440, captureAspect: 'stage', includeText: true, transparent: false, exportFormat: 'json', share: 'private',
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
  firstPage: 'controls',
  defaults: DEFAULTS,
  fixtures: {
    'Saved, nine chosen': {},
    'Edited, recording': {dirty: true, canUndo: true, captureKind: 'video', recording: true, 'control:belt-2': 4.5, 'control:belt-3': 0.6},
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
      <Section label="Your controls" cols={2} width={160}>{slots(p, list)}</Section>
    </Plate>
  },

  whole: p => {
    const list = readControls(p.v)
    return <Plate p={p} view="whole" pages={[{id: 'controls', label: 'Controls'}, {id: 'tools', label: 'Tools'}]}>
      {p.page === 'tools' ? <ToolsPage p={p} /> : <ControlsPage p={p} list={list} />}
    </Plate>
  },

  full: p => <Pane p={p} list={readControls(p.v)} />,

  widget: p => {
    const list = readControls(p.v)
    const first = list ? list.slice(0, 2) : []
    return <Tile title="Studio" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <Sheet p={p} list={list} w={112} h={104} labelW={36} handles={0} />
      <div className="st-tile-side">
        {first.map(c => <ChosenBox key={c.id} p={p} c={c} />)}
        <Action {...stand(p, 'save', closedWhy(p.v))} label="Save" does="Save the work to its native Expression." onPress={() => p.set('save', true)} />
      </div>
    </Tile>
  },
}
