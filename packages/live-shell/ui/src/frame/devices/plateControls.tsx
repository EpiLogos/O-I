// The plate's controls over the device panel kit (inhabitants/sdk/panel.tsx; ProjectCentral/docs/1-vision/dlw/DLW.md §16.10): the kit's dial, value box,
// toggle, radio, chooser, readout, action and light are used as they are; this module adds only what an instrument's plate needs and the
// kit does not carry, drawn on the kit's own classes so it reads as one panel:
//   • a value sent to its owner on release (manual §16.10 "While you drag, the control shows the value you set. When you release it,
//     the new value goes to the owner; a key press sends at once"), shown in italics until the owner's reading returns;
//   • a dial with no reading (§6 "No reading … The owner has not said"): the ring with no arc and no needle, "—" under it — a parameter
//     the manual names that no owner carries yet stands so, its reason on the status line, never a fake value (the mockup's waiting rule);
//   • rows you press (a place, a room, a relation): the kit's rows (panel.tsx Rows: "A long list pages; it never scrolls") with a press,
//     an open, a lit row and a mark of their own;
//   • a name field (the mockup's `.tin`, "Name it…"), the value box's text form;
//   • the marks of the devices an instrument holds, each pressed to show it whole in the pool or opened full in a pane — the acts its
//     boxed plate offered before (InstrumentPlate.tsx SectionDevices), kept without the box.
import {useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode} from 'react'
import {Dial, ValueBox, type Scale} from '../../inhabitants/sdk/panel'
import {Icon} from '../../inhabitants/sdk/Icon'
import type {IconName} from '../../inhabitants/sdk/icons'
import './plateControls.css'

/** The kit's status-line words: "Name|What it does". */
export const said = (name: string | undefined, does: string | undefined) => (name || does ? [name ?? '', does ?? ''].filter(Boolean).join('|') : undefined)

const arc = (u0: number, u1: number, r: number) => {
  const pt = (u: number) => { const a = (135 + u * 270) * Math.PI / 180; return `${(14 + r * Math.cos(a)).toFixed(2)} ${(14 + r * Math.sin(a)).toFixed(2)}` }
  return `M${pt(u0)}A${r} ${r} 0 1 1 ${pt(u1)}`
}

/** A dial with no reading (the kit's Dial, panel.tsx:125, in its no-reading state): the track alone and "—"; its reason on the status
 * line. Drawn for a parameter no owner carries here, so nothing is ever drawn as a value it is not. */
export function WaitingDial({label, why, unit}: {readonly label: string; readonly why: string; readonly unit?: string}) {
  return <div className="dp-cell dp-cell--dial" data-disabled="true" data-waiting="true" data-i={said(label, why)}>
    <span className="dp-label">{label}</span>
    <svg className="dp-dial" viewBox="0 0 28 28" role="slider" aria-label={label} aria-disabled="true" aria-valuetext="no reading">
      <path d={arc(0, 1, 10.5)} className="dp-dial-track" />
    </svg>
    <span className="dp-value">—{unit ? ` ${unit}` : ''}</span>
  </div>
}

interface OwnerScalar {
  readonly label: string
  readonly does?: string
  /** The owner's reading; null while it has none (the control waits, with `why`). */
  readonly value: number | null
  readonly def: number
  readonly scale: Scale
  readonly format: (v: number) => string
  /** The owner's write. Absent, the control is a reading. */
  readonly onCommit?: (v: number) => void
  /** Send as the hand moves (an owner that answers at once, such as the graph's own forces), not only on release. */
  readonly live?: boolean
  /** Why the control cannot act now, or why there is no reading. */
  readonly why?: string
  readonly bipolar?: boolean
}

/** A draft held while the hand moves, sent on release or on a key, and shown pending until the owner's reading changes. */
function useOwnerDraft(value: number | null, onCommit: ((v: number) => void) | undefined, live: boolean | undefined) {
  const [draft, setDraft] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const latest = useRef<number | null>(null)
  // The owner's new reading ends the wait and drops the draft (the owner's value stands, never a copy).
  useEffect(() => { setPending(false); setDraft(null) }, [value])
  const change = (v: number) => {
    latest.current = v
    setDraft(v)
    if (live) onCommit?.(v)
  }
  const send = () => {
    const v = latest.current
    latest.current = null
    if (v === null || live || !onCommit) return
    setPending(true)
    onCommit(v)
  }
  const wrap = {
    onPointerUp: send,
    onKeyUp: (event: KeyboardEvent<HTMLElement>) => { if (/^(Arrow|Page|Home|End|Delete|Backspace)/.test(event.key)) send() },
    onDoubleClick: () => setTimeout(send, 0),
  }
  return {shown: draft ?? value, change, pending, wrap}
}

/** A dial over its owner (the kit's Dial): the owner's reading, the hand's draft while it moves, the write on release. */
export function OwnerDial({label, does, value, def, scale, format, onCommit, live, why, bipolar}: OwnerScalar) {
  const {shown, change, pending, wrap} = useOwnerDraft(value, onCommit, live)
  if (shown === null) return <WaitingDial label={label} why={why ?? `${does ?? label}: no reading from its owner yet.`} />
  return <div className="plate-wrap" {...wrap}>
    <Dial label={label} does={does} value={shown} def={def} scale={scale} format={format} bipolar={bipolar} pending={pending}
      onChange={onCommit ? change : undefined} disabled={onCommit ? why : why ?? 'A reading: no owner takes a change here.'} />
  </div>
}

/** A value box over its owner (the kit's ValueBox), for a number set exactly or where room is short. */
export function OwnerValueBox({label, does, value, def, scale, format, onCommit, live, why, wide}: OwnerScalar & {readonly wide?: boolean}) {
  const {shown, change, pending, wrap} = useOwnerDraft(value, onCommit, live)
  return <div className="plate-wrap" {...wrap}>
    <ValueBox label={label} does={does} value={shown ?? scale.min} def={def} scale={scale} format={shown === null ? () => '—' : format} pending={pending} wide={wide}
      onChange={onCommit && shown !== null ? change : undefined} disabled={shown === null ? why ?? 'No reading from its owner yet.' : onCommit ? why : why ?? 'A reading: no owner takes a change here.'} />
  </div>
}

export interface PlateRow {
  readonly id: string
  readonly name: string
  /** The row's mark before its name (a precision mark, a kind's mark, a swatch). */
  readonly mark?: ReactNode
  /** A short tag after the name (mythic). */
  readonly tag?: ReactNode
  /** A short value at the right. */
  readonly note?: ReactNode
  /** What the row is and what a press does, for the status line. */
  readonly does?: string
  /** A row the owner cannot place or act on now: drawn faint. */
  readonly dim?: boolean
  readonly disabled?: boolean
  /** The row's own small acts (move, empty, remove), at the right. */
  readonly acts?: ReactNode
}

/** Rows (the kit's rows, panel.tsx Rows): one line each, 17 px, a hairline under; the lit row in the accent; a long list pages, never
 * scrolls. A press chooses a row, a double-click opens it. */
export function PlateRows({label, rows, size = 5, onPress, onOpen, active, empty, emptyWord, columns = 1}: {
  readonly label?: string
  readonly rows: readonly PlateRow[]
  readonly size?: number
  readonly onPress?: (id: string) => void
  readonly onOpen?: (id: string) => void
  readonly active?: string | readonly string[] | null
  /** Said in place of the rows when there are none. */
  readonly empty?: string
  /** With it, the empty list is a light and this one word, and `empty` is the status bar's words (manual §16.9: no sentence in a panel). */
  readonly emptyWord?: string
  readonly columns?: 1 | 2
}) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / size)), at = Math.min(page, pages - 1)
  const shown = rows.slice(at * size, at * size + size)
  const lit = (id: string) => (typeof active === 'string' ? active === id : !!active?.includes(id))
  return <div className="dp-cell dp-cell--rows plate-rows" role="list" aria-label={label}>
    {(label || pages > 1) && <div className="dp-rows-head">
      {label && <span className="dp-label">{label}</span>}
      {pages > 1 && <span className="dp-pager">
        <button type="button" aria-label="Previous page" disabled={at === 0} onClick={() => setPage(at - 1)}>‹</button>
        <span>{at + 1}/{pages}</span>
        <button type="button" aria-label="Next page" disabled={at === pages - 1} onClick={() => setPage(at + 1)}>›</button>
      </span>}
    </div>}
    {shown.length ? <ul className="dp-rows" data-columns={columns} style={{'--rows': Math.ceil(size / columns)} as CSSProperties}>
      {shown.map(row => {
        const body = <>{row.mark}<span className="dp-row-name">{row.name}</span>{row.tag}{row.note !== undefined && <span className="dp-row-note">{row.note}</span>}</>
        return <li key={row.id} role="listitem" className="dp-row plate-row" data-row={row.id} data-on={lit(row.id) ? 'true' : undefined} data-dim={row.dim ? 'true' : undefined}
          data-i={said(row.name, row.does)}>
          {onPress || onOpen
            ? <button type="button" className="plate-row-press" disabled={row.disabled} aria-pressed={lit(row.id)} onClick={() => onPress?.(row.id)} onDoubleClick={() => onOpen?.(row.id)}>{body}</button>
            : <span className="plate-row-press">{body}</span>}
          {row.acts && <span className="plate-row-acts">{row.acts}</span>}
        </li>
      })}
    </ul> : empty && emptyWord ? <span className="dp-cell plate-light plate-empty" data-i={said(label ?? emptyWord, empty)} aria-label={empty}><span className="dp-lamp" data-light="unknown" /><span className="dp-label">{emptyWord}</span></span>
      : empty ? <p className="plate-empty" data-i={said(label, empty)}>{empty}</p> : null}
  </div>
}

/** A name or a search: the value box's text form (the mockup's `.tin`). Enter sends; Escape clears, or does what the host gives it. */
export function PlateField({label, does, value, placeholder, onChange, onEnter, onEscape, disabled, maxLength}: {
  readonly label: string
  readonly does?: string
  readonly value: string
  readonly placeholder?: string
  readonly onChange: (value: string) => void
  readonly onEnter?: () => void
  /** Escape: by default it clears the field. */
  readonly onEscape?: () => void
  readonly disabled?: boolean
  readonly maxLength?: number
}) {
  return <label className="dp-cell plate-field" data-i={said(label, does)}>
    <input className="plate-field-input" type="text" value={value} placeholder={placeholder} aria-label={label} disabled={disabled} maxLength={maxLength}
      onChange={event => onChange(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter' && onEnter) { event.preventDefault(); onEnter() } if (event.key === 'Escape') { if (onEscape) onEscape(); else onChange('') } }} />
  </label>
}

export interface PlateOption<T extends string> {readonly value: T; readonly label: ReactNode; readonly does?: string; readonly why?: string | null}

/** One of a few (the kit's Radio, panel.tsx:167, on its classes), where a choice can wait on its own: a choice no owner takes yet stands
 * disabled with its reason, the others live. With no `onChange` the radio is a reading: the owner's value lit, nothing pressable. */
export function PlateRadio<T extends string>({label, does, value, options, onChange, disabled, inline, stack}: {
  readonly label?: string
  readonly does?: string
  readonly value: T | null
  readonly options: readonly PlateOption<T>[]
  readonly onChange?: (value: T) => void
  /** Why the whole choice cannot act now. */
  readonly disabled?: string
  /** The name before the switch on one line, so a group of choices stands in one column. */
  readonly inline?: boolean
  /** The choices one under the next, in one control column (a macro's radio). */
  readonly stack?: boolean
}) {
  return <div className={`dp-cell dp-cell--radio${inline ? ' plate-inline' : ''}`} data-i={said(label, disabled ? `${does ?? ''} ${disabled}`.trim() : does)} data-disabled={disabled ? 'true' : undefined}>
    {label && <span className="dp-label">{label}</span>}
    <div className="dp-radio" role="radiogroup" aria-label={label} data-stack={stack ? 'true' : undefined}>
      {options.map(option => <button key={option.value} type="button" role="radio" aria-checked={option.value === value}
        data-i={option.why || option.does ? said(typeof option.label === 'string' ? option.label : option.value, option.why ?? option.does) : undefined}
        disabled={!onChange || !!disabled || !!option.why} onClick={() => onChange?.(option.value)}>{option.label}</button>)}
    </div>
  </div>
}

/** A reading on one line: its name, then the owner's short value (the kit's Readout laid inline, panel.tsx:190). */
export function PlateReading({label, value, does, light}: {readonly label: string; readonly value: ReactNode; readonly does?: string; readonly light?: 'lit' | 'dark' | 'unknown'}) {
  return <div className="dp-cell plate-reading" data-i={said(label, does)}>
    {light && <span className="dp-lamp" data-light={light} />}
    <span className="dp-label">{label}</span><output className="dp-value">{value}</output>
  </div>
}

/** One short line under the controls (a tool's state, the owner's last answer). Its whole words are the status line's. With `word`, the
 * line is a light and that one word (manual §16.9 "A sentence never appears in a panel. What a control does is said in the status bar"):
 * the sentence is only the status bar's, under `name`. */
export function PlateLine({text, tone, children, word, name, light = 'lit'}: {readonly text: string | null | undefined; readonly tone?: string | null; readonly children?: ReactNode
  readonly word?: string; readonly name?: string; readonly light?: 'lit' | 'dark' | 'unknown'}) {
  if (!text) return null
  if (word) return <span className="dp-cell plate-light" role="status" data-tone={tone ?? undefined} data-i={said(name ?? word, text)} aria-label={text}>
    <span className="dp-lamp" data-light={light} data-tone={tone === 'refused' ? 'stall' : tone === 'saved' ? 'green' : tone === 'armed' ? undefined : 'value'} />
    <span className="dp-label">{word}</span>{children}
  </span>
  return <p className="plate-line" role="status" data-tone={tone ?? undefined} data-i={said('', text)} title={text}>{text}{children}</p>
}

export interface HeldDevice {
  readonly id: string
  readonly title: string
  readonly mark: IconName
  readonly light: 'on' | 'off' | 'unknown'
  /** Show the device whole in its band above the chain (deviceDoor.ts holdInBand). */
  readonly onWhole: () => void
  /** Open it full size in a pane. */
  readonly onPane: () => void
}

/** The devices a section of the instrument holds, as marks at its head: a press shows one whole in its band above the chain, ⤢ opens it
 * in a pane. Its
 * controls stand in the section itself, read from the same owner. */
export function HeldMarks({devices}: {readonly devices: readonly HeldDevice[]}) {
  if (!devices.length) return null
  return <span className="plate-held" role="group" aria-label="Devices held here">
    {devices.map(device => <span key={device.id} className="plate-held-mark" data-device={device.id} data-device-light={device.light}>
      <button type="button" aria-label={`Show every setting of ${device.title} above the chain`} data-i={said(device.title, `Show every setting of ${device.title} whole, in its band above the chain.`)}
        onClick={device.onWhole}><Icon name={device.mark} size={10} /></button>
      <button type="button" aria-label={`Open ${device.title} full size in a pane`} data-i={said(device.title, `Open ${device.title} full size in a pane.`)}
        onClick={device.onPane}>⤢</button>
    </span>)}
  </span>
}
