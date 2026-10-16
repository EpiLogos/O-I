// The device panel kit: the parts every designed device panel is built from (the device UI standard, docs/dlw/DEVICE-UI.md).
// They follow Live's own devices: one head (activator, fold, name, pages, open full), a body of fixed height ruled into
// sections, a display well that draws the device's state and carries handles, and a closed set of controls — dial, value box,
// toggle, radio, chooser, rows, readout, action, light. Every control is controlled (value in, change out), names what it does
// for the status bar (data-i, "Name|What it does"), and shows its standing: automated, modulated, held by someone else,
// waiting for the owner, or disabled with the reason. No control scrolls; no box sits inside a box; the only inset is the well.
import {createContext, useContext, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode} from 'react'
import {ChevronFold, PopOut} from './marks'
import {Icon} from './Icon'
import './panel.css'

/** The measures (px at 100 %): the head, the body every chain plate shares, one control column. */
export const HEAD = 22, BODY = 168, COL = 56

export type LightState = 'lit' | 'dark' | 'unknown'
export type Tone = 'accent' | 'value' | 'green' | 'stall' | 'rec'
export type PanelView = 'compact' | 'whole'

const said = (name: string | undefined, does: string | undefined) => (name || does ? [name ?? '', does ?? ''].filter(Boolean).join('|') : undefined)
const clamp01 = (u: number) => Math.min(1, Math.max(0, u))

/** What a control shows for a value the owner has not reported (DEVICE-UI §6 "No reading", §7 "Do not draw it as zero"). */
export const NO_READING = '—'
const NO_READING_SAID = 'No reading from the owner yet.'
/** A value with no reading behind it: absent, or what a view's helpers make of an absent key (`Number(undefined)` is NaN,
 * `String(undefined)` is "undefined"). The kit draws such a value as "—" with the No-reading standing, never as NaN or zero. */
export const unread = (x: unknown): boolean =>
  x === undefined || x === null || (typeof x === 'number' && !Number.isFinite(x)) || (typeof x === 'string' && /\b(NaN|undefined)\b/.test(x))
/** A light the owner has not reported is hollow: anything but lit or dark reads as unknown. */
const lightIn = (state: LightState | string | undefined): LightState => (state === 'lit' || state === 'dark' ? state : 'unknown')

// ---------------------------------------------------------------- the scalar law

/** A scalar's range: linear or logarithmic, continuous or stepped. */
export interface Scale {readonly min: number; readonly max: number; readonly log?: boolean; readonly step?: number}
export const toUnit = (s: Scale, v: number) => clamp01(s.log ? Math.log(v / s.min) / Math.log(s.max / s.min) : (v - s.min) / (s.max - s.min))
export const fromUnit = (s: Scale, u: number) => {
  const k = clamp01(u)
  let v = s.log ? s.min * Math.pow(s.max / s.min, k) : s.min + k * (s.max - s.min)
  if (s.step) v = s.min + Math.round((v - s.min) / s.step) * s.step
  return Math.min(s.max, Math.max(s.min, v))
}

/** Drag up to raise (160 px for the whole range; 14 px a step when stepped), Shift for fine, double-click for the default,
 * arrows and Page keys, Home and End, Delete for the default. The drag is incremental, so pressing or letting go of Shift in the
 * middle of a drag slows or speeds the hand from where the value is, never jumps it. With no default (the owner declares none),
 * double-click and Delete do nothing. */
function useScalar(s: Scale, value: number, def: number | undefined, onChange?: (v: number) => void) {
  const drag = useRef<{y: number; u: number} | null>(null)
  const steps = s.step ? Math.round((s.max - s.min) / s.step) : 0
  const span = steps ? Math.max(steps * 14, 42) : 160
  const live = !!onChange
  return {
    tabIndex: live ? 0 : -1,
    onPointerDown: (e: PointerEvent<Element>) => {
      if (!live || e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = {y: e.clientY, u: toUnit(s, value)}
    },
    onPointerMove: (e: PointerEvent<Element>) => {
      const d = drag.current
      if (!d) return
      const u = Math.min(1, Math.max(0, d.u + (d.y - e.clientY) / span * (e.shiftKey ? 0.1 : 1)))
      drag.current = {y: e.clientY, u}
      const next = fromUnit(s, u)
      if (next !== value) onChange!(next)
    },
    onPointerUp: () => { drag.current = null },
    onPointerCancel: () => { drag.current = null },
    onDoubleClick: () => { if (live && def !== undefined) onChange!(def) },
    onKeyDown: (e: KeyboardEvent<Element>) => {
      if (!live) return
      const unit = steps ? 1 / steps : e.shiftKey ? 0.001 : 0.01, big = steps ? Math.max(1 / steps, 0.1) : 0.1
      let u = toUnit(s, value)
      switch (e.key) {
        case 'ArrowUp': case 'ArrowRight': u += unit; break
        case 'ArrowDown': case 'ArrowLeft': u -= unit; break
        case 'PageUp': u += big; break
        case 'PageDown': u -= big; break
        case 'Home': u = 0; break
        case 'End': u = 1; break
        case 'Delete': case 'Backspace': if (def === undefined) return; e.preventDefault(); onChange!(def); return
        default: return
      }
      e.preventDefault()
      onChange!(fromUnit(s, u))
    },
  }
}

// ---------------------------------------------------------------- standing, shared by every control

/** What a control shows besides its value. Each is a reading, never a decoration. */
export interface Standing {
  /** The value plays from an automation lane (a red mark); `overridden` when you moved it off the lane (a hollow mark). */
  readonly automated?: boolean | 'overridden'
  /** Who else holds the value (an agent, the sky): the control rings in the stall colour and offers the value back. */
  readonly heldBy?: string
  readonly onHandBack?: () => void
  /** Sent and not yet confirmed by the owner. */
  readonly pending?: boolean
  /** Why the control cannot act now. A disabled control stays visible. */
  readonly disabled?: string
  /** The owner refused the last change, in its own words: the control shows the owner's value again and says why. */
  readonly refused?: string
  /** What moves the value (a modulator, the sky): the status bar names it. */
  readonly modulatedBy?: string
  /** The value key this standing is for, named by the host only where the place wraps its controls (deviceHost.tsx): the control
   * that spreads it is drawn inside the place's wrap by it (ControlWrapContext). Not a reading: nothing draws it. */
  readonly valueKey?: string
}

/** The place's own wrap of a control, by the value key the control draws (Live maps a control to a MIDI control or a key through
 * it; an Expressions rack draws the modulation line under it). A host provides it around a design's view, from the place's wrapRow;
 * every kit control whose standing names its key (Standing.valueKey) is drawn inside it. A design is never edited for it: each of
 * its controls already spreads its key's standing (`<Dial {...st(p, 'drive')} …/>`), and that is how the host names the key. */
export type ControlWrap = (key: string, control: ReactNode) => ReactNode
export const ControlWrapContext = createContext<ControlWrap | null>(null)

/** The status bar's words for a control in its standing: what it does, then why it cannot act, who holds it, what moves it, or
 * the owner's refusal. */
const doesIn = (does: string | undefined, st: Standing): string | undefined => {
  const parts = [does, st.disabled, st.heldBy ? `${st.heldBy} holds this value.` : undefined,
    st.modulatedBy ? `${st.modulatedBy} moves this value.` : undefined, st.refused ? `The owner refused: ${st.refused}` : undefined].filter(Boolean)
  return parts.length ? parts.join(' ') : undefined
}

function Cell({kind, label, does, standing, className, style, unknown, children}: {kind: string; label?: string; does?: string; standing?: Standing; className?: string; style?: CSSProperties; unknown?: boolean; children: ReactNode}) {
  const st = standing ?? {}
  const cell = <div className={`dp-cell dp-cell--${kind}${className ? ` ${className}` : ''}`} style={style}
    data-i={said(label, unknown ? [does, NO_READING_SAID, st.disabled].filter(Boolean).join(' ') : doesIn(does, st))} data-unread={unknown ? 'true' : undefined}
    data-automated={st.automated === true ? 'on' : st.automated === 'overridden' ? 'overridden' : undefined}
    data-held={st.heldBy ? 'true' : undefined} data-pending={st.pending ? 'true' : undefined} data-disabled={st.disabled ? 'true' : undefined}
    data-refused={st.refused ? 'true' : undefined} data-modulated={st.modulatedBy ? 'true' : undefined}>
    {children}
    {st.heldBy && <button type="button" className="dp-handback" aria-label={`Give ${label ?? 'this value'} back to ${st.heldBy}`}
      data-i={said('Hand back', `Give this value back to ${st.heldBy}.`)} onClick={st.onHandBack} disabled={!st.onHandBack}>{st.heldBy}</button>}
  </div>
  // The place's wrap, where the host named this control's key (ControlWrapContext); otherwise the cell as it is.
  const wrap = useContext(ControlWrapContext)
  return wrap && st.valueKey ? <>{wrap(st.valueKey, cell)}</> : cell
}

// ---------------------------------------------------------------- controls

export interface ScalarProps extends Standing {
  readonly label?: string
  /** What it does, for the status bar. */
  readonly does?: string
  readonly value: number
  /** The owner's default (double-click and Delete return to it). Absent when the owner declares none: those keys do nothing. */
  readonly def?: number
  readonly scale: Scale
  readonly format: (v: number) => string
  readonly onChange?: (v: number) => void
  /** The value's arc starts at zero, not at the minimum (a pan, a force that can turn either way). */
  readonly bipolar?: boolean
  /** The range a modulator moves the value through, as values. */
  readonly mod?: readonly [number, number]
}

const arc = (u0: number, u1: number, r: number) => {
  if (u1 - u0 < 0.002) return ''
  const pt = (u: number) => { const a = (135 + u * 270) * Math.PI / 180; return `${(14 + r * Math.cos(a)).toFixed(2)} ${(14 + r * Math.sin(a)).toFixed(2)}` }
  return `M${pt(u0)}A${r} ${r} 0 ${(u1 - u0) * 270 > 180 ? 1 : 0} 1 ${pt(u1)}`
}

/** A dial (Live's knob): the name above, a 270° ring, the value below. */
export function Dial({label, does, value, def, scale, format, onChange, bipolar, mod, ...standing}: ScalarProps) {
  // No reading: the ring alone, no arc and no needle, and "—" under it; nothing to turn from (DEVICE-UI §6).
  const known = !unread(value)
  const u = known ? toUnit(scale, value) : 0, zero = bipolar ? toUnit(scale, 0) : 0
  const live = known && onChange && !standing.disabled ? onChange : undefined
  const handlers = useScalar(scale, known ? value : scale.min, def, live)
  const a = (135 + u * 270) * Math.PI / 180
  return <Cell kind="dial" label={label} does={does} standing={standing} unknown={!known}>
    {label && <span className="dp-label">{label}</span>}
    <svg className="dp-dial" viewBox="0 0 28 28" role="slider" aria-label={label} aria-valuemin={scale.min} aria-valuemax={scale.max}
      aria-valuenow={known ? value : undefined} aria-valuetext={known ? format(value) : 'no reading'} aria-disabled={!live || undefined} {...handlers}>
      <path d={arc(0, 1, 10.5)} className="dp-dial-track" />
      {known && mod && <path d={arc(toUnit(scale, Math.min(...mod)), toUnit(scale, Math.max(...mod)), 13)} className="dp-dial-mod" />}
      {known && <path d={arc(Math.min(zero, u), Math.max(zero, u), 10.5)} className="dp-dial-value" />}
      {known && <line x1={14 + 3 * Math.cos(a)} y1={14 + 3 * Math.sin(a)} x2={14 + 10.5 * Math.cos(a)} y2={14 + 10.5 * Math.sin(a)} className="dp-dial-needle" />}
    </svg>
    <span className="dp-value">{known ? format(value) : NO_READING}</span>
  </Cell>
}

/** A value box (Live's slider-number): the value in a field that fills to its place in the range. */
export function ValueBox({label, does, value, def, scale, format, onChange, bipolar, wide, ...standing}: ScalarProps & {readonly wide?: boolean}) {
  // No reading: an empty field and "—", nothing to move from (DEVICE-UI §6).
  const known = !unread(value)
  const u = known ? toUnit(scale, value) : 0, zero = known && bipolar ? toUnit(scale, 0) : 0
  const live = known && onChange && !standing.disabled ? onChange : undefined
  const handlers = useScalar(scale, known ? value : scale.min, def, live)
  return <Cell kind="box" label={label} does={does} standing={standing} className={wide ? 'dp-cell--wide' : undefined} unknown={!known}>
    {label && <span className="dp-label">{label}</span>}
    <div className="dp-box" role="slider" aria-label={label} aria-valuemin={scale.min} aria-valuemax={scale.max} aria-valuenow={known ? value : undefined}
      aria-valuetext={known ? format(value) : 'no reading'} aria-disabled={!live || undefined} {...handlers}
      style={{'--f0': Math.min(zero, u), '--f1': Math.max(zero, u)} as CSSProperties}><span>{known ? format(value) : NO_READING}</span></div>
  </Cell>
}

/** A toggle: amber when on. `unknown`: the owner has not said, so it is drawn neither on nor off (a hollow face); a press asks
 * for on. */
export function Toggle({label, does, on, onChange, tone = 'accent', unknown, ...standing}: Standing & {readonly label: string; readonly does?: string; readonly on: boolean; readonly onChange?: (on: boolean) => void; readonly tone?: Tone; readonly unknown?: boolean}) {
  return <Cell kind="toggle" label={label} does={does} standing={standing} unknown={unknown}>
    <button type="button" className="dp-toggle" data-tone={tone} aria-pressed={unknown ? undefined : on} data-unknown={unknown ? 'true' : undefined}
      disabled={!onChange || !!standing.disabled} onClick={() => onChange?.(unknown ? true : !on)}>{label}</button>
  </Cell>
}

export interface Option<T extends string> {readonly value: T; readonly label: string; readonly does?: string}

/** One of a few, side by side or stacked (Live's radio buttons: filter types, quantize). */
export function Radio<T extends string>({label, does, value, options, onChange, stack, ...standing}: Standing & {readonly label?: string; readonly does?: string; readonly value: T; readonly options: readonly Option<T>[]; readonly onChange?: (v: T) => void; readonly stack?: boolean}) {
  return <Cell kind="radio" label={label} does={does} standing={standing}>
    {label && <span className="dp-label">{label}</span>}
    <div className="dp-radio" role="radiogroup" aria-label={label} data-stack={stack ? 'true' : undefined}>
      {options.map(option => <button key={option.value} type="button" role="radio" aria-checked={option.value === value}
        data-i={option.does ? said(option.label, option.does) : undefined} disabled={!onChange || !!standing.disabled}
        onClick={() => onChange?.(option.value)}>{option.label}</button>)}
    </div>
  </Cell>
}

/** One of many, from a menu (Live's chooser). */
export function Chooser<T extends string>({label, does, value, options, onChange, wide, ...standing}: Standing & {readonly label?: string; readonly does?: string; readonly value: T; readonly options: readonly Option<T>[]; readonly onChange?: (v: T) => void; readonly wide?: boolean}) {
  return <Cell kind="chooser" label={label} does={does} standing={standing} className={wide ? 'dp-cell--wide' : undefined}>
    {label && <span className="dp-label">{label}</span>}
    <select className="dp-chooser" aria-label={label} value={options.some(option => option.value === value) ? value : ''} disabled={!onChange || !!standing.disabled}
      onChange={event => onChange?.(event.target.value as T)}>
      {!options.some(option => option.value === value) && <option value="" disabled>—</option>}
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </Cell>
}

/** A short line of text you type (a label, a name, a message): it sends on Enter or when you leave it; Escape restores it. */
export function TextField({label, does, value, onChange, placeholder, wide, ...standing}: Standing & {readonly label?: string; readonly does?: string; readonly value: string; readonly onChange?: (v: string) => void; readonly placeholder?: string; readonly wide?: boolean}) {
  return <Cell kind="text" label={label} does={does} standing={standing} className={wide ? 'dp-cell--wide' : undefined}>
    {label && <span className="dp-label">{label}</span>}
    <input className="dp-text" type="text" aria-label={label ?? placeholder} defaultValue={value} key={value} placeholder={placeholder}
      disabled={!onChange || !!standing.disabled}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); onChange?.(event.currentTarget.value) }
        if (event.key === 'Escape') { event.currentTarget.value = value; event.currentTarget.blur() }
      }}
      onBlur={event => { if (event.currentTarget.value !== value) onChange?.(event.currentTarget.value) }} />
  </Cell>
}

/** A reading: a name and a short value. `big` for a count that is the point of the view. */
export function Readout({label, does, value, big, tone, onPress}: {readonly label: string; readonly does?: string; readonly value: ReactNode; readonly big?: boolean; readonly tone?: Tone; readonly onPress?: () => void}) {
  // A reading the owner has not reported shows "—", never NaN, "undefined" or zero (DEVICE-UI §7).
  const known = !(typeof value === 'number' || typeof value === 'string' || value === undefined || value === null) || !unread(value)
  const body = <><output className="dp-readout-value" data-tone={known ? tone : undefined}>{known ? value : NO_READING}</output><span className="dp-label">{label}</span></>
  return <div className={`dp-cell dp-cell--readout${big ? ' dp-cell--big' : ''}`} data-i={said(label, known ? does : [does, NO_READING_SAID].filter(Boolean).join(' '))} data-unread={known ? undefined : 'true'}>
    {onPress ? <button type="button" className="dp-readout-press" onClick={onPress}>{body}</button> : body}
  </div>
}

/** A momentary action (Close now, Disperse). */
export function Action({label, does, onPress, ...standing}: Standing & {readonly label: string; readonly does?: string; readonly onPress?: () => void}) {
  return <Cell kind="action" label={label} does={does} standing={standing}>
    <button type="button" className="dp-action" disabled={!onPress || !!standing.disabled} onClick={onPress}>{label}</button>
  </Cell>
}

/** A light: lit or dark when the owner reports it, hollow when nobody has said. */
export function Lamp({state, tone = 'accent', label}: {readonly state: LightState; readonly tone?: Tone; readonly label?: string}) {
  return <span className="dp-lamp" data-light={lightIn(state)} data-tone={tone} role={label ? 'img' : undefined} aria-label={label} />
}

export interface RowItem {
  readonly id: string
  readonly name: string
  /** The owner's reading. */
  readonly light: LightState
  readonly tone?: Tone
  /** Your request, where you can make one (a skill on or off). */
  readonly request?: boolean
  /** Why the owner holds it back, when it does. */
  readonly why?: string
  /** A short value at the right (a revision, a count). */
  readonly note?: string
  /** The row's kind mark, before the name (a practice's woodcut mark). */
  readonly mark?: ReactNode
  /** A small meter after the name (a member's evidence ladder). */
  readonly meter?: ReactNode
  /** What the row is, for the status bar, when its name does not say it. */
  readonly does?: string
}

/** Rows with lights (a rack's chains, a scope's places). A long list pages; it never scrolls. `onSelect`: pressing a row's name
 * chooses it (a rack's chain: Live's chain list selection); the chosen row is `selected`. */
export function Rows({label, does, items, onRequest, onSelect, selected, size = 6, page = 0, onPage, columns = 1}: {readonly label?: string; readonly does?: string; readonly items: readonly RowItem[]; readonly onRequest?: (id: string, on: boolean) => void; readonly onSelect?: (id: string) => void; readonly selected?: string; readonly size?: number; readonly page?: number; readonly onPage?: (page: number) => void; readonly columns?: 1 | 2}) {
  const pages = Math.max(1, Math.ceil(items.length / size)), at = Math.min(page, pages - 1)
  const shown = items.slice(at * size, at * size + size)
  return <div className="dp-cell dp-cell--rows" data-i={said(label, does)}>
    {(label || pages > 1) && <div className="dp-rows-head">
      {label && <span className="dp-label">{label}</span>}
      {pages > 1 && <span className="dp-pager">
        <button type="button" aria-label="Previous page" disabled={at === 0 || !onPage} onClick={() => onPage?.(at - 1)}>‹</button>
        <span>{at + 1}/{pages}</span>
        <button type="button" aria-label="Next page" disabled={at === pages - 1 || !onPage} onClick={() => onPage?.(at + 1)}>›</button>
      </span>}
    </div>}
    <ul className="dp-rows" data-columns={columns} style={{'--rows': Math.ceil(size / columns)} as CSSProperties}>
      {shown.map(item => <li key={item.id} className="dp-row" data-dim={item.light !== 'lit' ? 'true' : undefined} data-selected={item.id === selected ? 'true' : undefined}
        data-i={said(item.name, item.why ?? item.does ?? (item.light === 'unknown' ? 'No reading yet.' : undefined))}>
        {onRequest && item.request !== undefined && <button type="button" className="dp-row-request" aria-pressed={item.request}
          aria-label={`${item.request ? 'Withhold' : 'Request'} ${item.name}`} onClick={() => onRequest(item.id, !item.request)} />}
        {item.mark ?? <Lamp state={item.light} tone={item.tone} />}
        {onSelect
          ? <button type="button" className="dp-row-name dp-row-select" aria-pressed={item.id === selected} onClick={() => onSelect(item.id)}>{item.name}</button>
          : <span className="dp-row-name">{item.name}</span>}
        {item.meter}
        {item.why && <span className="dp-row-why" aria-label={item.why}>!</span>}
        {item.note && <span className="dp-row-note">{item.note}</span>}
      </li>)}
    </ul>
  </div>
}

// ---------------------------------------------------------------- the display well and its handles

/** The well: the device's state drawn from its live values, at 1:1 in its own pixels. Handles inside it are controls. `raw`: the
 * device draws its own picture (a component, a canvas) and the well holds it as it is, not inside the well's svg. */
export function Display({w, h, label, does, corner, raw, children}: {readonly w: number; readonly h: number; readonly label?: string; readonly does?: string; readonly corner?: ReactNode; readonly raw?: boolean; readonly children: ReactNode}) {
  return <div className="dp-display" data-raw={raw ? 'true' : undefined} style={{width: w, height: h}} data-i={said(label, does)}>
    {raw ? children : <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="group" aria-label={label}>{children}</svg>}
    {corner !== undefined && <span className="dp-display-corner">{(typeof corner === 'string' || typeof corner === 'number') && unread(corner) ? NO_READING : corner}</span>}
  </div>
}

/** A handle in the well: drag it, or focus it and use the arrows. `onDrag` receives the point in the well's own pixels. */
export function Handle({x, y, n, label, does, onDrag, onReset, shape = 'dot', tone = 'accent'}: {readonly x: number; readonly y: number; readonly n?: number | string; readonly label: string; readonly does?: string; readonly onDrag?: (x: number, y: number) => void; readonly onReset?: () => void; readonly shape?: 'dot' | 'ring' | 'square'; readonly tone?: Tone}) {
  const dragging = useRef(false)
  const point = (e: PointerEvent<SVGGElement>) => {
    const svg = e.currentTarget.ownerSVGElement!, box = svg.getBoundingClientRect(), view = svg.viewBox.baseVal
    return [(e.clientX - box.left) * view.width / box.width, (e.clientY - box.top) * view.height / box.height] as const
  }
  return <g className="dp-handle" data-shape={shape} data-tone={tone} tabIndex={onDrag ? 0 : -1} role="slider" aria-label={label}
    data-i={said(label, does)}
    onPointerDown={e => { if (!onDrag || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); dragging.current = true }}
    onPointerMove={e => { if (dragging.current) onDrag!(...point(e)) }}
    onPointerUp={() => { dragging.current = false }} onPointerCancel={() => { dragging.current = false }}
    onDoubleClick={onReset}
    onKeyDown={e => {
      if (!onDrag) return
      const d = e.shiftKey ? 0.5 : 2, moves: Record<string, [number, number]> = {ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d]}
      const m = moves[e.key]
      if (m) { e.preventDefault(); onDrag(x + m[0], y + m[1]) } else if ((e.key === 'Delete' || e.key === 'Backspace') && onReset) { e.preventDefault(); onReset() }
    }}>
    <circle cx={x} cy={y} r={11} className="dp-handle-hit" />
    {shape === 'square' ? <rect x={x - 3.5} y={y - 3.5} width={7} height={7} className="dp-handle-mark" />
      : <circle cx={x} cy={y} r={shape === 'ring' ? 5.5 : 4.5} className="dp-handle-mark" />}
    {n !== undefined && <text x={x} y={y + 2.6} className="dp-handle-n">{n}</text>}
  </g>
}

// ---------------------------------------------------------------- the plate

export interface Page {readonly id: string; readonly label: string; readonly light?: LightState}

export interface PanelProps {
  readonly title: string
  readonly view: PanelView
  /** The activator: a reading of the owner's on/off. Pressing it asks the owner; absent `onLight`, it only reads. */
  readonly light: LightState
  readonly onLight?: () => void
  /** Pages in the head (Live's Osc 1 · Osc 2, Reverb · EQ): one shows at a time; a page can carry its own light. */
  readonly pages?: readonly Page[]
  readonly page?: string
  readonly onPage?: (id: string) => void
  readonly onFold?: () => void
  readonly onFull?: () => void
  /** Pressing the plate on a chain shows the device whole in the pool. */
  readonly onSelect?: () => void
  readonly selected?: boolean
  /** Someone else holds values on this device. */
  readonly heldBy?: string
  /** The device's kind mark before its name (a practice's woodcut mark). */
  readonly mark?: ReactNode
  /** Keep the device on the widget rail (DEVICE-UI §2: a widget stays on the rail when you change mode). */
  readonly onRail?: () => void
  /** Marks the place gives the head, before ⤢. */
  readonly marks?: ReactNode
  /** The place's own words for ⤢ (absent: "Open <title> full in a pane"). */
  readonly fullLabel?: string
  /** What pressing the plate does, said on the status bar when you point at its head ("Show every setting in the pool"). */
  readonly hint?: string
  /** Why the activator only reads (the owner has no on/off operation): it stands disabled and says this. */
  readonly lightWhy?: string
  /** The device's own acts in the head, after the pages and before the place's marks (the Studio's Save, Undo, Redo). */
  readonly acts?: ReactNode
  readonly children: ReactNode
}

/** What the place a device stands in gives every Panel, PanelHead and Tile inside it: the place's marks, the rail mark and the
 * tile's close. A host provides it around a design's view; a prop on the part itself wins. It reaches views whose root is a
 * component as well as plain ones. */
export interface Place {
  readonly marks?: ReactNode
  readonly onRail?: () => void
  readonly onClose?: () => void
}
export const PlaceContext = createContext<Place>({})

/** The activator, the same in Panel and PanelHead: a reading of the owner's on/off, pressable only where the owner can turn it. */
function Activator({title, light, onLight, why}: {title: string; light: LightState; onLight?: () => void; why?: string}) {
  return <button type="button" className="dp-activator" data-light={light} aria-pressed={light === 'lit'} disabled={!onLight || !!why}
    aria-label={`${title}: ${light === 'unknown' ? 'no reading' : light === 'lit' ? 'on' : 'off'}`}
    data-i={said('Device on/off', why ?? (light === 'unknown' ? 'No reading from the owner yet.' : 'Asks the owner to turn the device on or off. The light shows what the owner reports.'))}
    onClick={why ? undefined : onLight} />
}

/** One device panel: the head, then the body — one band on a chain, up to two bands in the pool. */
export function Panel({title, view, light: reported, onLight, pages, page, onPage, onFold, onFull, onSelect, selected, heldBy, mark, onRail: ownRail, marks: ownMarks, fullLabel, hint, lightWhy, acts, children}: PanelProps) {
  const light = lightIn(reported), place = useContext(PlaceContext)
  const marks = ownMarks ?? place.marks, onRail = ownRail ?? place.onRail
  return <section className="dp" data-view={view} data-selected={selected ? 'true' : undefined} aria-label={title}
    onPointerDownCapture={onSelect}>
    <header className="dp-head" data-i={hint ? said(title, hint) : undefined}>
      <Activator title={title} light={light} onLight={onLight} why={lightWhy} />
      {onFold && <button type="button" className="dp-fold" aria-label={`Fold ${title}`} data-i={said('Fold', 'Fold the device to its title.')} onClick={onFold}><ChevronFold size={10} /></button>}
      {mark}
      <span className="dp-title">{title}</span>
      {heldBy && <span className="dp-head-held" data-i={said('Held', `${heldBy} holds values on this device.`)}>{heldBy}</span>}
      {pages && <nav className="dp-pages" role="tablist" aria-label={`${title} pages`}>
        {pages.map(p => <button key={p.id} type="button" role="tab" aria-selected={p.id === page} onClick={() => onPage?.(p.id)}>
          {p.light && <Lamp state={p.light} />}{p.label}
        </button>)}
      </nav>}
      {acts !== undefined && acts !== null && acts !== false && <span className="dp-head-acts">{acts}</span>}
      <span className="dp-head-x">
        {marks}
        {onRail && <button type="button" className="dp-full dp-rail" aria-label={`Keep ${title} on the widget rail`} data-i={said('On the rail', 'Keep this device on the widget rail, in every mode.')} onClick={onRail}><Icon name="placed" size={10} /></button>}
        {onFull && <button type="button" className="dp-full" aria-label={fullLabel ?? `Open ${title} full in a pane`} data-i={said('Open full', 'Open the device full size in a pane.')} onClick={onFull}><PopOut size={10} /></button>}
      </span>
    </header>
    <div className="dp-body">{children}</div>
  </section>
}

export interface PanelHeadProps {
  readonly title: string
  /** The activator: a reading of the owner's on/off. Pressing it asks the owner; absent `onLight`, it only reads. */
  readonly light: LightState
  readonly onLight?: () => void
  /** ▾: fold the device to its title. */
  readonly onFold?: () => void
  /** The device's kind mark before its name. */
  readonly mark?: ReactNode
  /** A press on the name (an instrument's name opens it where it plays). Absent, the name is only its name. */
  readonly onName?: () => void
  /** What a press on the name does, for the status bar. */
  readonly nameDoes?: string
  /** Someone else holds values on this device. */
  readonly heldBy?: string
  readonly pages?: readonly Page[]
  readonly page?: string
  readonly onPage?: (id: string) => void
  /** The device's own acts, after the pages and before the place's marks (the Studio's Save, Undo, Redo). */
  readonly acts?: ReactNode
  /** Marks the place gives the head, before ⤢. */
  readonly marks?: ReactNode
  readonly onRail?: () => void
  readonly onFull?: () => void
  /** The place's own words for ⤢ (absent: "Open <title> full in a pane"). */
  readonly fullLabel?: string
  /** What the head says on the status bar when you point at it: the device's owner and its standing, never drawn as a sentence. */
  readonly hint?: string
  readonly selected?: boolean
  /** Why the activator only reads: it stands disabled and says this. */
  readonly lightWhy?: string
}

/** The head of a device panel, for a plate the kit's Panel does not draw whole (an instrument's sections, a compact): the activator, ▾,
 * the name, the held mark, the pages, the device's own acts, the place's marks and ⤢ (DEVICE-UI §4.1). The Panel's own head, as one
 * part. */
export function PanelHead({title, light: reported, onLight, onFold, mark, onName, nameDoes, heldBy, pages, page, onPage, acts, marks: ownMarks, onRail: ownRail, onFull, fullLabel, hint, selected, lightWhy}: PanelHeadProps) {
  const light = lightIn(reported), place = useContext(PlaceContext)
  const marks = ownMarks ?? place.marks, onRail = ownRail ?? place.onRail
  return <header className="dp-head dp-head--plate" data-selected={selected ? 'true' : undefined} data-i={hint ? said(title, hint) : undefined}>
    <Activator title={title} light={light} onLight={onLight} why={lightWhy} />
    {onFold && <button type="button" className="dp-fold" aria-label={`Fold ${title}`} data-i={said('Fold', 'Fold the device to its title.')} onClick={onFold}><ChevronFold size={10} /></button>}
    {mark}
    {onName
      ? <button type="button" className="dp-title dp-title--press" onClick={onName} data-i={said(title, nameDoes ?? hint)}>{title}</button>
      : <span className="dp-title">{title}</span>}
    {heldBy && <span className="dp-head-held" data-i={said('Held', `${heldBy} holds values on this device.`)}>{heldBy}</span>}
    {pages && <nav className="dp-pages" role="tablist" aria-label={`${title} pages`}>
      {pages.map(p => <button key={p.id} type="button" role="tab" aria-selected={p.id === page} onClick={() => onPage?.(p.id)}>
        {p.light && <Lamp state={p.light} />}{p.label}
      </button>)}
    </nav>}
    {acts !== undefined && acts !== null && acts !== false && <span className="dp-head-acts">{acts}</span>}
    <span className="dp-head-x">
      {marks}
      {onRail && <button type="button" className="dp-full dp-rail" aria-label={`Keep ${title} on the widget rail`} data-i={said('On the rail', 'Keep this device on the widget rail, in every mode.')} onClick={onRail}><Icon name="placed" size={10} /></button>}
      {onFull && <button type="button" className="dp-full" aria-label={fullLabel ?? `Open ${title} full in a pane`} data-i={said('Open full', fullLabel ?? 'Open the device full size in a pane.')} onClick={onFull}><PopOut size={10} /></button>}
    </span>
  </header>
}

/** One band of the body: the fixed height every plate shares. */
export function Band({children}: {readonly children: ReactNode}) {
  return <div className="dp-band">{children}</div>
}

/** A section of a band, ruled off from the next, named in small capitals. `cols` sets its width in control columns. */
export function Section({label, cols, width, grow, children}: {readonly label?: string; readonly cols?: number; readonly width?: number; readonly grow?: boolean; readonly children: ReactNode}) {
  return <div className="dp-sec" data-grow={grow ? 'true' : undefined} style={{width: width ?? (cols ? cols * COL : undefined)} as CSSProperties}>
    {label && <div className="dp-sec-label">{label}</div>}
    <div className="dp-sec-body" style={cols ? {gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`} as CSSProperties : undefined}>{children}</div>
  </div>
}

/** Folded: the head turned on its side, at chain height — the activator, the name and up to two short readings. */
export function Folded({title, light, readings = [], onUnfold}: {readonly title: string; readonly light: LightState; readonly readings?: readonly string[]; readonly onUnfold?: () => void}) {
  return <section className="dp-folded" aria-label={`${title}, folded`}>
    <span className="dp-activator" data-light={lightIn(light)} />
    <button type="button" className="dp-folded-title" onClick={onUnfold} aria-label={`Unfold ${title}`} data-i={said(title, 'Click to unfold.')}>
      <span>{title}</span>{readings.map((r, i) => <span key={`${i}:${r}`} className="dp-folded-reading">{unread(r) ? NO_READING : r}</span>)}
    </button>
  </section>
}

/** A widget tile on the rail: one square (1) or two side by side (2). `onClose` takes it off the rail. */
export function Tile({title, light, span = 1, onFull, onClose: ownClose, children}: {readonly title: string; readonly light: LightState; readonly span?: 1 | 2; readonly onFull?: () => void; readonly onClose?: () => void; readonly children: ReactNode}) {
  const onClose = ownClose ?? useContext(PlaceContext).onClose
  return <section className="dp-tile" data-span={span} aria-label={title}>
    <header className="dp-tile-head">
      <Lamp state={light} />
      <span className="dp-tile-title">{title}</span>
      {onFull && <button type="button" className="dp-full" aria-label={`Open ${title} full in a pane`} data-i={said('Open full', 'Open the device full size in the pane that has focus.')} onClick={onFull}><PopOut size={10} /></button>}
      {onClose && <button type="button" className="dp-full" aria-label={`Take ${title} off the rail`} data-i={said('Close', 'Take the device off the rail. It stays on its chain.')} onClick={onClose}>✕</button>}
    </header>
    <div className="dp-tile-body">{children}</div>
  </section>
}

/** A ladder of evidence: one step for each rung, lit when it is established, dark when it is not, hollow when nobody has
 * observed it. Nothing is inferred upward. `row` draws it as ticks after a name; `tall` as a labelled column. */
export function Ladder({rungs, labels, size = 'row', label}: {readonly rungs: readonly (boolean | null)[]; readonly labels: readonly string[]; readonly size?: 'row' | 'tall'; readonly label?: string}) {
  const top = rungs.reduce<number>((at, rung, i) => (rung === true ? i : at), -1)
  return <span className="dp-ladder" data-size={size} role="img"
    aria-label={`${label ?? 'Evidence'}: ${top < 0 ? 'none established' : `up to ${labels[top]}`}`}
    data-i={`${label ?? 'Evidence'}|${rungs.map((rung, i) => `${labels[i]} ${rung === true ? 'yes' : rung === false ? 'no' : '—'}`).join(' · ')}`}>
    {rungs.map((rung, i) => <span key={labels[i]} className="dp-ladder-rung" data-rung={rung === true ? 'yes' : rung === false ? 'no' : 'unseen'}>
      {size === 'tall' && <span className="dp-ladder-label">{labels[i]}</span>}
    </span>)}
  </span>
}
