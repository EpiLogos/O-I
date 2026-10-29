// The device panel kit: the parts every designed device panel is built from (the device UI standard, ProjectCentral/docs/1-vision/dlw/DLW.md §16).
// They follow Live's own devices: one head (activator, fold, name, pages, open full), a body of fixed height ruled into
// sections, a display well that draws the device's state and carries handles, and a closed set of controls — dial, value box,
// toggle, radio, chooser, rows, readout, action, light. Every control is controlled (value in, change out), names what it does
// for the status bar (data-i, "Name|What it does"), and shows its standing: automated, modulated, held by someone else,
// waiting for the owner, or disabled with the reason. No control scrolls; no box sits inside a box; the only inset is the well.
import {createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject} from 'react'
import {ChevronFold, PopOut} from './marks'
import {Icon} from './Icon'
import './panel.css'

/** The measures (px at 100 %): the head, the body every chain plate shares, one control column. */
export const HEAD = 22, BODY = 168, COL = 56

// ---------------------------------------------------------------- motion (manual §16.10, "How a control moves")
// A control moves only when its state changes, and only to show that change. The hand is always answered at once: nothing eases
// under it. What something other than the hand changed glides, slides or rings once, in the times below (panel.css holds the same
// values as --dp-mo-*). Nothing loops except what the owner reports (a light that is working; a reading still to come).

/** The times (ms), one set for every control: a value glides, a choice or a row slides, a flash rings, a hold fills, a copy turns. */
export const MOTION = {value: 120, choice: 200, rows: 180, hold: 900, flash: 1000, copy: 1300, hand: 1200} as const
const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)'

/** A request for reduced motion: nothing glides, slides or rings; every state still shows. */
export const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** A layout effect where a DOM stands; server rendering runs no effects either way. */
/** A layout effect where a page lays out, and a plain effect in a server render (react-dom/server: a static render, as the shell's Node suites
 * draw the designs, warns "useLayoutEffect does nothing on the server" for every layout effect). Decided by whether a real DOM stands —
 * `HTMLElement` — not by `window`, which the suites stand in for with plain objects. Every part and design measures through this one. */
export const useLayoutIso: typeof useLayoutEffect = typeof HTMLElement === 'undefined' ? useEffect : useLayoutEffect

/** The detent: a drag that passes within this fraction of the range of the default lands on it. Shift drags past. */
export const DETENT = 0.022
/** Where a drag ends: the unit it reached, caught on the default's unit when it passes close by and the hand is not fine. */
export function detent(raw: number, def: number | null, fine: boolean, snap: number = DETENT): {readonly u: number; readonly caught: boolean} {
  if (def === null || fine || Math.abs(raw - def) >= snap) return {u: raw, caught: false}
  return {u: def, caught: true}
}

/** When the hand last touched a control (a number; Infinity while it holds one). A value that changes within MOTION.hand of it is the
 * hand's own, answered at once and never flashed; one that changes later was moved by something else. */
type HandClock = RefObject<number>
const handDown = (c: HandClock) => { (c as {current: number}).current = Infinity }
const handUp = (c: HandClock) => { (c as {current: number}).current = typeof performance !== 'undefined' ? performance.now() : Date.now() }
const handNow = () => typeof performance !== 'undefined' ? performance.now() : Date.now()
/** True while the hand holds the control or just let go of it. */
export const handIs = (at: number, now: number = handNow()) => now - at < MOTION.hand

/** A scalar's unit (0..1) as it is drawn: what the owner or a modulator moved glides there in MOTION.value; what the hand moves is
 * there at once. */
function useGlide(target: number, glide: boolean): number {
  const [shown, setShown] = useState(target)
  const frame = useRef(0)
  useEffect(() => {
    cancelAnimationFrame(frame.current)
    if (!glide || reducedMotion() || shown === target) { setShown(target); return }
    const from = shown, t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / MOTION.value), eased = 1 - Math.pow(1 - k, 3)
      setShown(from + (target - from) * eased)
      if (k < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, glide])
  return shown
}

/** Counts the times a value was moved by something other than the hand (0 until it first is). A control rings once for each. */
function useFlash(value: unknown, hand: HandClock): number {
  const before = useRef(value)
  const [n, setN] = useState(0)
  useEffect(() => {
    const was = before.current
    before.current = value
    if (was === value || unread(was) || unread(value) || handIs(hand.current ?? 0)) return
    setN(k => k + 1)
  }, [value, hand])
  return n
}

/** A chosen option's mark, slid: the thumb under a radio's buttons or a head's pages stands on the chosen one, and moves to the next
 * in MOTION.choice. Until it has stood once it is not drawn moving, and without it the chosen button draws itself (server render, no
 * layout). `vertical`: a stacked radio. */
function useSlide<T extends HTMLElement>(selector: string, key: unknown, vertical = false): RefObject<T> {
  const root = useRef<T>(null)
  useLayoutIso(() => {
    const el = root.current
    if (!el) return
    const place = () => {
      const on = el.querySelector<HTMLElement>(selector), thumb = el.querySelector<HTMLElement>(':scope > .dp-thumb')
      if (!on || !thumb || !on.offsetWidth) { el.removeAttribute('data-slide'); return }
      thumb.style.width = on.offsetWidth + 'px'
      thumb.style.height = on.offsetHeight + 'px'
      thumb.style.transform = `translate(${vertical ? 0 : on.offsetLeft}px, ${vertical ? on.offsetTop : 0}px)`
      if (!el.getAttribute('data-slide')) {
        el.setAttribute('data-slide', 'init')
        requestAnimationFrame(() => requestAnimationFrame(() => { if (el.getAttribute('data-slide') === 'init') el.setAttribute('data-slide', 'on') }))
      }
    }
    place()
    const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    watch?.observe(el)
    return () => watch?.disconnect()
  }, [key])
  return root
}

/** A list's rows slide to their places when rows come, go or move (FLIP): each row that stood and still stands moves from where it was
 * to where it is in MOTION.rows; a row that comes fades up. The first draw is still. Places are measured from the list's own corner and
 * in the plate's own pixels, so a scroll of the page, or the zoom a plate stands at, is never read as a row moving. */
function useFlip(list: RefObject<HTMLElement>, order: string): void {
  const places = useRef<Map<string, {x: number; y: number}> | null>(null)
  useLayoutIso(() => {
    const ul = list.current
    if (!ul) return
    const corner = ul.getBoundingClientRect(), k = ul.offsetWidth ? corner.width / ul.offsetWidth || 1 : 1
    const rows = Array.from(ul.children) as HTMLElement[]
    const now = new Map(rows.map(row => { const box = row.getBoundingClientRect(); return [row.dataset.id ?? '', {x: (box.left - corner.left) / k, y: (box.top - corner.top) / k}] as const }))
    const was = places.current
    places.current = now
    if (!was || reducedMotion() || typeof rows[0]?.animate !== 'function') return
    for (const row of rows) {
      const id = row.dataset.id ?? '', a = was.get(id), b = now.get(id)!
      if (!a) row.animate([{opacity: 0, transform: 'translateY(4px)'}, {opacity: 1, transform: 'none'}], {duration: MOTION.rows, easing: EASE})
      else if (Math.abs(a.x - b.x) > .5 || Math.abs(a.y - b.y) > .5) row.animate([{transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)`}, {transform: 'none'}], {duration: MOTION.rows, easing: EASE})
    }
  }, [order])
}

export type LightState = 'lit' | 'dark' | 'unknown'
export type Tone = 'accent' | 'value' | 'green' | 'stall' | 'rec'
export type PanelView = 'compact' | 'whole'

const said = (name: string | undefined, does: string | undefined) => (name || does ? [name ?? '', does ?? ''].filter(Boolean).join('|') : undefined)
const clamp01 = (u: number) => Math.min(1, Math.max(0, u))

/** What a control shows for a value the owner has not reported (manual §16.11 "No reading", §7 "Do not draw it as zero"). */
export const NO_READING = '—'
const NO_READING_SAID = 'No reading from the owner yet.'
const WAITING_SAID = 'Waiting for the owner\'s first reading.'
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
 * double-click and Delete do nothing. A drag that passes close to the default is caught on it (the detent, manual §16.10): the hand's
 * own position runs on unsnapped beneath, so the catch holds and then lets go. `hand` is when the hand last touched the control. */
function useScalar(s: Scale, value: number, def: number | undefined, onChange?: (v: number) => void) {
  const drag = useRef<{y: number; raw: number} | null>(null)
  const hand = useRef(0)
  const steps = s.step ? Math.round((s.max - s.min) / s.step) : 0
  const span = steps ? Math.max(steps * 14, 42) : 160
  const defUnit = def === undefined || steps ? null : toUnit(s, def)
  const live = !!onChange
  /** The detent shows while the value stands on the default under the hand: the cell's tick brightens. */
  const caught = (el: Element, on: boolean) => { const cell = el.closest('.dp-cell'); if (on) cell?.setAttribute('data-detent', 'true'); else cell?.removeAttribute('data-detent') }
  const release = (el: Element) => { drag.current = null; handUp(hand); caught(el, false) }
  return {
    hand,
    tabIndex: live ? 0 : -1,
    onPointerDown: (e: PointerEvent<Element>) => {
      if (!live || e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = {y: e.clientY, raw: toUnit(s, value)}
      handDown(hand)
    },
    onPointerMove: (e: PointerEvent<Element>) => {
      const d = drag.current
      if (!d) return
      const raw = Math.min(1, Math.max(0, d.raw + (d.y - e.clientY) / span * (e.shiftKey ? 0.1 : 1)))
      drag.current = {y: e.clientY, raw}
      const {u, caught: on} = detent(raw, defUnit, e.shiftKey)
      caught(e.currentTarget, on)
      const next = fromUnit(s, u)
      if (next !== value) onChange!(next)
    },
    onPointerUp: (e: PointerEvent<Element>) => release(e.currentTarget),
    onPointerCancel: (e: PointerEvent<Element>) => release(e.currentTarget),
    onDoubleClick: () => { if (live && def !== undefined) { handUp(hand); onChange!(def) } },
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
        case 'Delete': case 'Backspace': if (def === undefined) return; e.preventDefault(); handUp(hand); onChange!(def); return
        default: return
      }
      e.preventDefault()
      handUp(hand)
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
  /** The owner has been asked for a first reading and has not answered: the control is drawn waiting (it breathes), never written as
   * "Loading". A reading you already had shows at once, and is asked again behind it. */
  readonly waiting?: boolean
  /** Who moved the value just now, when something other than the hand did (an agent, the sky): the name stands on the control with
   * the ring for a moment (manual §16.10: the value shows what moved it). */
  readonly movedBy?: string
  /** The owner reports the thing working (a run, a write in progress): a ring spreads from its light for as long as it says so. */
  readonly working?: boolean
  /** The value key this standing is for, named by the host only where the place wraps its controls (deviceHost.tsx): the control
   * that spreads it is drawn inside the place's wrap by it (ControlWrapContext). Not a reading: nothing draws it. */
  readonly valueKey?: string
}

// ---------------------------------------------------------------- one standing per control (manual §16.11)

/** The standings of manual §16.11, one per control: who moves the value now. The kit draws a control from this one value
 * (`data-standing`), apart from what the hand is doing to it (`data-hand`: pressing, dragging, focused) and from how the place
 * presents it (its view and size). `waiting` is the manual's Waiting (sent, not yet confirmed); `awaiting` is Waiting for a reading
 * (the owner is asked and has not answered); `unread` is No reading; `refused` is §16.10's refusal, shown until the next move. */
export type StandingName = 'plain' | 'automated' | 'overridden' | 'modulated' | 'held' | 'moved' | 'waiting' | 'refused' | 'disabled'
  | 'working' | 'awaiting' | 'unread'

/** A control's one standing, from what the host reports for its key and whether the owner has a reading of the value. With no
 * reading there is nothing for anyone to move: the owner is being asked (awaiting) or has not said (unread). Otherwise the first that
 * holds, in this order: nobody can move it now (disabled), you sent it and the owner has not answered (waiting), the owner refused
 * it (refused), something other than the hand moved it a moment ago (moved: the ring, and the mover's name where the host names
 * one), someone else holds it (held), you took it off its lane (overridden),
 * its lane plays it (automated), a modulator moves it (modulated), the owner reports it working (working). */
export function standingOf(st: Standing, known = true, moved = false): StandingName {
  if (!known) return st.waiting ? 'awaiting' : 'unread'
  if (st.disabled) return 'disabled'
  if (st.pending) return 'waiting'
  if (st.refused) return 'refused'
  if (moved) return 'moved'
  if (st.heldBy) return 'held'
  if (st.automated === 'overridden') return 'overridden'
  if (st.automated) return 'automated'
  if (st.modulatedBy) return 'modulated'
  if (st.working) return 'working'
  return 'plain'
}

/** The standing's words for the status bar's Info line: the reason, the holder, the modulator — every one the host reports, the
 * drawn standing's first. */
export function standingWords(st: Standing, known = true): string {
  const words = [
    !known ? (st.waiting ? WAITING_SAID : NO_READING_SAID) : undefined,
    st.disabled,
    known && st.pending ? 'Sent: waiting for the owner to confirm it.' : undefined,
    st.refused ? `The owner refused: ${st.refused}` : undefined,
    st.heldBy ? `${st.heldBy} holds this value. Press the name to give it back.` : undefined,
    st.automated === 'overridden' ? 'You moved it off its automation lane. Re-enable gives it back to the lane.' : st.automated ? 'Its automation lane plays it. Move it to override the lane.' : undefined,
    st.modulatedBy ? `${st.modulatedBy} moves this value.` : undefined,
    st.working ? 'The owner reports it working.' : undefined,
  ]
  return words.filter(Boolean).join(' ')
}

/** What a control puts on the status bar's Info line when you point at it (Live's Info View; the shell's one `data-i` channel,
 * agent/statusInfo.ts): its name, then its value, what it does and its standing's words. */
export function infoLine(name: string | undefined, value: string | undefined, does: string | undefined, words: string | undefined): string | undefined {
  const rest = [does, words].filter(Boolean).join(' ')
  const fn = value && rest ? `${value} — ${rest}` : value || rest
  return said(name, fn || undefined)
}

/** Something other than the hand moved the value a moment ago: the Moved standing lasts as long as the mover's name stands (2 s). */
function useMoved(flash: number): boolean {
  const [moved, setMoved] = useState(false)
  useEffect(() => {
    if (!flash) return
    setMoved(true)
    const t = window.setTimeout(() => setMoved(false), MOTION.flash * 2)
    return () => window.clearTimeout(t)
  }, [flash])
  return moved
}

/** What the hand is doing to a control — pressing it, dragging it, or standing on it from the keyboard — kept apart from its
 * standing and drawn as `data-hand`. Nothing the owner reports changes it, and it changes nothing the owner reports. */
export type Hand = 'press' | 'drag' | 'focus'
function useHand() {
  const [hand, setHand] = useState<Hand | undefined>(undefined)
  const settle = (el: Element) => setHand(typeof document !== 'undefined' && el.contains(document.activeElement) ? 'focus' : undefined)
  return {
    hand,
    onPointerDownCapture: (e: PointerEvent<HTMLElement>) => { if (e.button === 0) setHand((e.target as Element).closest('[role="slider"]') ? 'drag' : 'press') },
    onPointerUpCapture: (e: PointerEvent<HTMLElement>) => settle(e.currentTarget),
    onPointerCancelCapture: (e: PointerEvent<HTMLElement>) => settle(e.currentTarget),
    onFocusCapture: () => setHand(h => h ?? 'focus'),
    onBlurCapture: (e: FocusEvent<HTMLElement>) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHand(undefined) },
  }
}

/** The place's own wrap of a control, by the value key the control draws (Live maps a control to a MIDI control or a key through
 * it; an Expressions rack draws the modulation line under it). A host provides it around a design's view, from the place's wrapRow;
 * every kit control whose standing names its key (Standing.valueKey) is drawn inside it. A design is never edited for it: each of
 * its controls already spreads its key's standing (`<Dial {...st(p, 'drive')} …/>`), and that is how the host names the key. */
export type ControlWrap = (key: string, control: ReactNode) => ReactNode
export const ControlWrapContext = createContext<ControlWrap | null>(null)

/** A control's cell: three inputs kept apart. Domain — the owner's value (`value`, the words for it; `unknown` when there is none)
 * and its standing (`standing`, resolved to one StandingName, `data-standing`). Interaction — what the hand is doing (`data-hand`,
 * the cell's own). Presentation — how the place sets it (`kind`, `className`: wide, big). The Info line reads all of it as one line:
 * the name, the value, what it does, the standing's words. The `data-` flags after `data-i` are the host's report as it stands, kept
 * for readers of the markup; the drawing reads `data-standing`. */
function Cell({kind, label, does, value, standing, className, style, unknown, flash = 0, children}: {kind: string; label?: string; does?: string; /** The value in words, for the Info line. */ value?: string; standing?: Standing; className?: string; style?: CSSProperties; unknown?: boolean; /** How many times something other than the hand has moved the value (useFlash). */ flash?: number; children: ReactNode}) {
  const st = standing ?? {}
  const moved = useMoved(flash)
  const name = standingOf(st, !unknown, moved)
  const {hand, ...handHandlers} = useHand()
  const cell = <div className={`dp-cell dp-cell--${kind}${className ? ` ${className}` : ''}`} style={style}
    data-standing={name === 'plain' ? undefined : name} data-hand={hand} {...handHandlers}
    data-i={infoLine(label, unknown ? undefined : value, does, standingWords(st, !unknown) || undefined)} data-unread={unknown ? 'true' : undefined}
    data-automated={st.automated === true ? 'on' : st.automated === 'overridden' ? 'overridden' : undefined}
    data-held={st.heldBy ? 'true' : undefined} data-pending={st.pending ? 'true' : undefined} data-disabled={st.disabled ? 'true' : undefined}
    data-refused={st.refused ? 'true' : undefined} data-modulated={st.modulatedBy ? 'true' : undefined}
    data-waiting={st.waiting ? 'true' : undefined} data-flash={flash ? (flash % 2 ? 'a' : 'b') : undefined}>
    {children}
    {st.movedBy && flash > 0 && <b key={flash} className="dp-by">{st.movedBy}</b>}
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
  // No reading: the ring alone, no arc and no needle, and "—" under it; nothing to turn from (manual §16.11).
  const known = !unread(value)
  const live = known && onChange && !standing.disabled ? onChange : undefined
  const {hand, ...handlers} = useScalar(scale, known ? value : scale.min, def, live)
  const flash = useFlash(known ? value : undefined, hand)
  // What the hand sets is there at once; what something else set glides there (manual §16.10, "How a control moves").
  const u = useGlide(known ? toUnit(scale, value) : 0, !handIs(hand.current ?? 0)), zero = bipolar ? toUnit(scale, 0) : 0
  const a = (135 + u * 270) * Math.PI / 180
  const d0 = def !== undefined && !scale.step && known ? (135 + toUnit(scale, def) * 270) * Math.PI / 180 : null
  return <Cell kind="dial" label={label} does={does} value={known ? format(value) : undefined} standing={standing} unknown={!known} flash={flash}>
    {label && <span className="dp-label">{label}</span>}
    <svg className="dp-dial" viewBox="0 0 28 28" role="slider" aria-label={label} aria-valuemin={scale.min} aria-valuemax={scale.max}
      aria-valuenow={known ? value : undefined} aria-valuetext={known ? format(value) : 'no reading'} aria-disabled={!live || undefined} {...handlers}>
      <path d={arc(0, 1, 10.5)} className="dp-dial-track" />
      {known && mod && <path d={arc(toUnit(scale, Math.min(...mod)), toUnit(scale, Math.max(...mod)), 13)} className="dp-dial-mod" />}
      {known && <path d={arc(Math.min(zero, u), Math.max(zero, u), 10.5)} className="dp-dial-value" />}
      {d0 !== null && <line x1={14 + 7.2 * Math.cos(d0)} y1={14 + 7.2 * Math.sin(d0)} x2={14 + 8.8 * Math.cos(d0)} y2={14 + 8.8 * Math.sin(d0)} className="dp-dial-def" />}
      {known && <line x1={14 + 3 * Math.cos(a)} y1={14 + 3 * Math.sin(a)} x2={14 + 10.5 * Math.cos(a)} y2={14 + 10.5 * Math.sin(a)} className="dp-dial-needle" />}
    </svg>
    <span className="dp-value">{known ? format(value) : NO_READING}</span>
  </Cell>
}

/** A value box (Live's slider-number): the value in a field that fills to its place in the range. */
export function ValueBox({label, does, value, def, scale, format, onChange, bipolar, mod, wide, ...standing}: ScalarProps & {readonly wide?: boolean}) {
  // No reading: an empty field and "—", nothing to move from (manual §16.11).
  const known = !unread(value)
  const live = known && onChange && !standing.disabled ? onChange : undefined
  const {hand, ...handlers} = useScalar(scale, known ? value : scale.min, def, live)
  const flash = useFlash(known ? value : undefined, hand)
  const u = useGlide(known ? toUnit(scale, value) : 0, !handIs(hand.current ?? 0)), zero = known && bipolar ? toUnit(scale, 0) : 0
  const d0 = def !== undefined && !scale.step && known ? toUnit(scale, def) : null
  return <Cell kind="box" label={label} does={does} value={known ? format(value) : undefined} standing={standing} className={wide ? 'dp-cell--wide' : undefined} unknown={!known} flash={flash}>
    {label && <span className="dp-label">{label}</span>}
    <div className="dp-box" role="slider" aria-label={label} aria-valuemin={scale.min} aria-valuemax={scale.max} aria-valuenow={known ? value : undefined}
      aria-valuetext={known ? format(value) : 'no reading'} aria-disabled={!live || undefined} data-def={d0 !== null ? 'true' : undefined} {...handlers}
      style={{'--f0': Math.min(zero, u), '--f1': Math.max(zero, u), ...(d0 !== null ? {'--d': d0} : {})} as CSSProperties}><span>{known ? format(value) : NO_READING}</span>
      {/* Modulated: the range the modulator moves it through, a thin line under the field (the dial's outer arc, laid flat). */}
      {known && mod && <i className="dp-box-mod" aria-hidden="true" style={{'--m0': toUnit(scale, Math.min(...mod)), '--m1': toUnit(scale, Math.max(...mod))} as CSSProperties} />}</div>
  </Cell>
}

/** A toggle: amber when on. `unknown`: the owner has not said, so it is drawn neither on nor off (a hollow face); a press asks
 * for on. */
export function Toggle({label, does, on, onChange, tone = 'accent', unknown, ...standing}: Standing & {readonly label: string; readonly does?: string; readonly on: boolean; readonly onChange?: (on: boolean) => void; readonly tone?: Tone; readonly unknown?: boolean}) {
  const hand = useRef(0), flash = useFlash(unknown ? undefined : on, hand)
  return <Cell kind="toggle" label={label} does={does} value={unknown ? undefined : on ? 'On' : 'Off'} standing={standing} unknown={unknown} flash={flash}>
    <button type="button" className="dp-toggle" data-tone={tone} aria-pressed={unknown ? undefined : on} data-unknown={unknown ? 'true' : undefined}
      disabled={!onChange || !!standing.disabled} onClick={() => { handUp(hand); onChange?.(unknown ? true : !on) }}>{label}</button>
  </Cell>
}

export interface Option<T extends string> {
  readonly value: T
  readonly label: string
  readonly does?: string
  /** Why this one choice is closed (the owner has no operation for it, or it waits on a reading): the option stands disabled and
   * says this, while the others stay open. */
  readonly why?: string
}

/** One of a few, side by side or stacked (Live's radio buttons: filter types, quantize). The chosen one's amber is a thumb that slides
 * to the choice in MOTION.choice; without a layout (server render) the chosen button draws it. */
export function Radio<T extends string>({label, does, value, options, onChange, stack, ...standing}: Standing & {readonly label?: string; readonly does?: string; readonly value: T; readonly options: readonly Option<T>[]; readonly onChange?: (v: T) => void; readonly stack?: boolean}) {
  const hand = useRef(0), chosen = options.find(option => option.value === value), flash = useFlash(chosen ? value : undefined, hand)
  const slide = useSlide<HTMLDivElement>('[aria-checked="true"]', `${value}|${options.map(o => o.value).join(',')}`, !!stack)
  // No option is the owner's value: No reading — none is lit (manual §16.11), and the Info line says so.
  return <Cell kind="radio" label={label} does={does} value={chosen?.label} standing={standing} unknown={!chosen} flash={flash}>
    {label && <span className="dp-label">{label}</span>}
    <div ref={slide} className="dp-radio" role="radiogroup" aria-label={label} data-stack={stack ? 'true' : undefined}>
      <span className="dp-thumb" aria-hidden="true" />
      {options.map(option => <button key={option.value} type="button" role="radio" aria-checked={option.value === value}
        data-i={option.does || option.why ? said(option.label, [option.does, option.why].filter(Boolean).join(' ')) : undefined}
        disabled={!onChange || !!standing.disabled || !!option.why} data-why={option.why ? 'true' : undefined}
        onClick={() => { handUp(hand); onChange?.(option.value) }}>{option.label}</button>)}
    </div>
  </Cell>
}

/** One of many, from a menu (Live's chooser). The menu is the system's own: it opens and closes as the system draws it. */
export function Chooser<T extends string>({label, does, value, options, onChange, wide, ...standing}: Standing & {readonly label?: string; readonly does?: string; readonly value: T; readonly options: readonly Option<T>[]; readonly onChange?: (v: T) => void; readonly wide?: boolean}) {
  const hand = useRef(0), chosen = options.find(option => option.value === value), flash = useFlash(chosen ? value : undefined, hand)
  return <Cell kind="chooser" label={label} does={does} value={chosen?.label} standing={standing} className={wide ? 'dp-cell--wide' : undefined} unknown={!chosen} flash={flash}>
    {label && <span className="dp-label">{label}</span>}
    <select className="dp-chooser" aria-label={label} value={options.some(option => option.value === value) ? value : ''} disabled={!onChange || !!standing.disabled}
      onChange={event => { handUp(hand); onChange?.(event.target.value as T) }}>
      {!options.some(option => option.value === value) && <option value="" disabled>—</option>}
      {options.map(option => <option key={option.value} value={option.value} disabled={!!option.why} title={option.why}>{option.label}</option>)}
    </select>
  </Cell>
}

/** A colour you choose (a palette stop, the paper behind a field): the swatch and its value; pressing it opens the system's colour
 * picker. Absent, it shows "—" and no colour. */
export function Swatch({label, does, value, onChange, ...standing}: Standing & {readonly label?: string; readonly does?: string; readonly value: string | undefined; readonly onChange?: (hex: string) => void}) {
  const unknown = value === undefined || value === ''
  return <Cell kind="swatch" label={label} does={does} value={unknown ? undefined : value.toUpperCase()} standing={standing} unknown={unknown}>
    {label && <span className="dp-label">{label}</span>}
    <label className="dp-swatch" style={{'--swatch': unknown ? 'transparent' : value} as CSSProperties}>
      <input type="color" value={unknown ? '#000000' : value} aria-label={label ?? 'Colour'} disabled={!onChange || !!standing.disabled}
        onChange={event => onChange?.(event.target.value)} />
      <span className="dp-swatch-value">{unknown ? NO_READING : value.toUpperCase()}</span>
    </label>
  </Cell>
}

/** A short line of text you type (a label, a name, a message): it sends on Enter or when you leave it; Escape restores it. */
export function TextField({label, does, value, onChange, placeholder, wide, ...standing}: Standing & {readonly label?: string; readonly does?: string; readonly value: string; readonly onChange?: (v: string) => void; readonly placeholder?: string; readonly wide?: boolean}) {
  return <Cell kind="text" label={label} does={does} value={value || undefined} standing={standing} className={wide ? 'dp-cell--wide' : undefined}>
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

/** A reading: a name and a short value. `big` for a count that is the point of the view. `copy`: pressing it copies this text (a
 * coordinate, a path); the mark appears when you point at it, and turns to a tick for a moment once it has copied. Its standing is a
 * control's (manual §16.11): absent, it is No reading ("—", faint) or, while the owner is asked, Waiting for a reading (the field
 * breathes); a fault is the owner's words on the Info line (`refused`, `disabled`), never the value written as a sentence. */
export function Readout({label, does, value, big, tone, onPress, copy, ...standing}: Standing & {readonly label: string; readonly does?: string; readonly value: ReactNode; readonly big?: boolean; readonly tone?: Tone; readonly onPress?: () => void; readonly copy?: string}) {
  // A reading the owner has not reported shows "—", never NaN, "undefined" or zero (manual §16.12).
  const known = !(typeof value === 'number' || typeof value === 'string' || value === undefined || value === null) || !unread(value)
  const [copied, setCopied] = useState(false), timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const press = copy !== undefined ? () => {
    try { void navigator.clipboard?.writeText(copy) } catch { /* the mark still turns: the press was made */ }
    setCopied(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setCopied(false), MOTION.copy)
    onPress?.()
  } : onPress
  const mark = copy !== undefined && known && <span className="dp-copy" aria-hidden="true" data-done={copied ? 'true' : undefined}>
    <svg viewBox="0 0 16 16"><g className="dp-copy-c"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 5.5v-1A1.5 1.5 0 0 0 9 3H4.5A1.5 1.5 0 0 0 3 4.5V9a1.5 1.5 0 0 0 1.5 1.5h1" /></g><path className="dp-copy-ok" d="M3.5 8.5l3 3 6-7" /></svg></span>
  const body = <><output className="dp-readout-value" data-tone={known ? tone : undefined}>{known ? value : NO_READING}{mark}</output><span className="dp-label">{label}</span></>
  const words = typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
  return <Cell kind="readout" label={label} does={[does, known && copy !== undefined ? 'Press to copy.' : undefined].filter(Boolean).join(' ') || undefined}
    value={words} standing={standing} className={big ? 'dp-cell--big' : undefined} unknown={!known}>
    {press ? <button type="button" className="dp-readout-press" onClick={press} disabled={!!standing.disabled || undefined}>{body}</button> : body}
  </Cell>
}

/** A momentary action (Close now, Disperse). `hold`: an act that cannot be undone is held, not clicked — press and hold (or hold Space
 * or Enter) for MOTION.hold (or the ms given); a fill sweeps across, and letting go early springs it back. Only where the DLW already
 * asks first (a scope's reach, an approval, taking a device off its chain); nowhere an act can be undone. Waiting on the owner
 * (`pending`) is a ring turning over the name, which keeps its width. */
export function Action({label, does, onPress, hold, ...standing}: Standing & {readonly label: string; readonly does?: string; readonly onPress?: () => void; readonly hold?: boolean | number}) {
  const ms = hold === true ? MOTION.hold : hold || 0
  const timer = useRef<number | undefined>(undefined), done = useRef<number | undefined>(undefined)
  useEffect(() => () => { window.clearTimeout(timer.current); window.clearTimeout(done.current) }, [])
  const inert = !onPress || !!standing.disabled
  const start = (el: HTMLElement) => {
    if (inert || timer.current !== undefined) return
    el.setAttribute('data-holding', 'true')
    timer.current = window.setTimeout(() => {
      timer.current = undefined
      el.removeAttribute('data-holding'); el.setAttribute('data-done', 'true')
      done.current = window.setTimeout(() => el.removeAttribute('data-done'), 200)
      onPress!()
    }, ms)
  }
  const stop = (el: HTMLElement) => { window.clearTimeout(timer.current); timer.current = undefined; el.removeAttribute('data-holding') }
  const holding = ms ? {
    'data-hold': 'true', style: {'--dp-hold': `${ms}ms`} as CSSProperties,
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => { if (e.button === 0) start(e.currentTarget) },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => stop(e.currentTarget), onPointerLeave: (e: PointerEvent<HTMLButtonElement>) => stop(e.currentTarget),
    onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => stop(e.currentTarget), onBlur: (e: FocusEvent<HTMLButtonElement>) => stop(e.currentTarget),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(e.currentTarget) } },
    onKeyUp: (e: KeyboardEvent<HTMLButtonElement>) => { if (e.key === ' ' || e.key === 'Enter') stop(e.currentTarget) },
    onClick: (e: MouseEvent<HTMLButtonElement>) => e.preventDefault(),
  } : {onClick: onPress}
  return <Cell kind="action" label={label} does={ms ? [does, 'Hold to do it.'].filter(Boolean).join(' ') : does} standing={standing}>
    <button type="button" className="dp-action" disabled={inert} {...holding}>{ms ? <i className="dp-hold-fill" aria-hidden="true" /> : null}{label}</button>
  </Cell>
}

/** A light: lit or dark when the owner reports it, hollow when nobody has said. `busy`: the owner reports it working — a ring spreads
 * from it and fades, for as long as the owner says so, and never otherwise. */
export function Lamp({state, tone = 'accent', label, busy, does, waiting, why}: {readonly state: LightState; readonly tone?: Tone; readonly label?: string; readonly busy?: boolean;
  /** What the light reports, for the Info line. */ readonly does?: string;
  /** The owner is asked and has not answered: the hollow light breathes (Waiting for a reading). */ readonly waiting?: boolean;
  /** The owner's reason, where it gives one (why it is dark, why it has not said). */ readonly why?: string}) {
  const light = lightIn(state)
  const standing = standingOf({waiting, working: busy}, light !== 'unknown')
  // A named light speaks on the Info line: its name, what it reads (on, off) and its standing's words.
  const info = label || does ? infoLine(label, light === 'lit' ? 'On' : light === 'dark' ? 'Off' : undefined, does,
    [standingWords({waiting, working: busy}, light !== 'unknown'), why].filter(Boolean).join(' ') || undefined) : undefined
  return <span className="dp-lamp" data-light={light} data-tone={tone} data-busy={busy ? 'true' : undefined} data-standing={standing === 'plain' ? undefined : standing}
    role={label ? 'img' : undefined} aria-label={label} data-i={info} />
}

export interface RowItem {
  readonly id: string
  readonly name: string
  /** The owner's reading. */
  readonly light: LightState
  readonly tone?: Tone
  /** The owner reports this row working (an agent running): its light carries a ring for as long as it says so. */
  readonly busy?: boolean
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
  /** The owner is asked for this row's reading and has not answered: its hollow light breathes (Waiting for a reading). */
  readonly waiting?: boolean
}

/** A value the owner has not reported, where a design writes a reading in a line of its own (a count beside a heading, a field of a
 * card): "—" in the faint ink with the No-reading standing (breathing while `waiting`), and `why` — which reading is missing — on the
 * Info line. Never the words "no reading" in the value's place. */
export function NoReading({name, why, waiting}: {readonly name?: string; readonly why: string; readonly waiting?: boolean}) {
  return <span className="dp-no-reading" data-standing={waiting ? 'awaiting' : 'unread'} data-i={said(name ?? 'No reading', [waiting ? WAITING_SAID : NO_READING_SAID, why].join(' '))}>{NO_READING}</span>
}

/** The lists whose reading the owner has not given, with which reading is missing (unreadRows). */
const UNREAD_ROWS = new WeakMap<readonly RowItem[], {readonly why: string; readonly waiting?: boolean}>()
/** A list the owner has not reported, for a design that builds its rows apart from its Rows: the Rows that draws it stands empty under a
 * hollow light (No reading; breathing while `waiting`), and `why` — which reading is missing — goes to the Info line, never into a row.
 * `rows` are any rows the design can still show (a refusal beside the missing reading). */
export function unreadRows(why: string, waiting?: boolean, rows: readonly RowItem[] = []): RowItem[] {
  const out = [...rows]
  UNREAD_ROWS.set(out, {why, ...(waiting ? {waiting} : {})})
  return out
}

/** A row's one standing (manual §16.11), drawn on its light: the owner reports it working, is asked for it, or has not said. */
const rowStanding = (item: RowItem): StandingName => item.light === 'unknown' ? (item.waiting ? 'awaiting' : 'unread') : item.busy ? 'working' : 'plain'
/** A row's words for the Info line: its name, its note (its value), what it is, why the owner holds it back, its standing. */
const rowInfo = (item: RowItem): string | undefined => infoLine(item.name, item.note, item.does,
  [item.why, item.light === 'unknown' ? (item.waiting ? WAITING_SAID : NO_READING_SAID) : item.busy ? 'The owner reports it working.' : undefined].filter(Boolean).join(' ') || undefined)

/** Rows with lights (a rack's chains, a scope's places). A long list pages; it never scrolls. `onSelect`: pressing a row's name
 * chooses it (a rack's chain: Live's chain list selection); the chosen row is `selected`. `onMove`: the order is yours to change, as
 * Live's chain list is — the chosen row carries ▲ ▼ and a grip, and ⌥↑ ⌥↓ on a row's name move it one place; drag the grip and the
 * others make room. Rows that come, go or move slide to their places (manual §16.10, "How a control moves"). */
export function Rows({label, does, items: read, onRequest, onSelect, selected, onMove, size = 6, page = 0, onPage, columns = 1, waiting, why}: {readonly label?: string; readonly does?: string;
  /** The owner's rows; undefined when the owner has not reported the list: No reading — the list stands empty under a hollow light, and
   * `why` (which reading is missing) goes to the Info line, never into a row. */
  readonly items: readonly RowItem[] | undefined; readonly onRequest?: (id: string, on: boolean) => void; readonly onSelect?: (id: string) => void; readonly selected?: string; readonly onMove?: (id: string, by: -1 | 1) => void; readonly size?: number; readonly page?: number; readonly onPage?: (page: number) => void; readonly columns?: number;
  /** The owner is asked for the list and has not answered: the empty list breathes (Waiting for a reading). */
  readonly waiting?: boolean;
  /** Which reading is missing, or the owner's reason, for the Info line. */
  readonly why?: string}) {
  const tagged = read ? UNREAD_ROWS.get(read) : undefined
  const items = read ?? [], known = read !== undefined && !tagged
  if (tagged) { why = why ?? tagged.why; waiting = waiting ?? tagged.waiting }
  const standing = known ? 'plain' : waiting ? 'awaiting' : 'unread'
  const pages = Math.max(1, Math.ceil(items.length / size)), at = Math.min(page, pages - 1)
  const shown = items.slice(at * size, at * size + size)
  const list = useRef<HTMLUListElement>(null), grip = useRef<string | null>(null), [dragging, setDragging] = useState<string | null>(null)
  useFlip(list, `${at}:${shown.map(item => item.id).join('|')}`)
  // The grip: the row the hand is over is the row's place; when it is not where the row stands, the row moves one place that way.
  const follow = (e: PointerEvent<HTMLElement>, id: string) => {
    if (grip.current !== id || !onMove || !list.current) return
    const rows = Array.from(list.current.children) as HTMLElement[]
    const here = rows.findIndex(row => row.dataset.id === id)
    let to = rows.findIndex(row => { const box = row.getBoundingClientRect(); return e.clientY < box.top + box.height / 2 })
    if (to < 0) to = rows.length - 1
    if (here >= 0 && to > here) onMove(id, 1)
    else if (here >= 0 && to < here) onMove(id, -1)
  }
  const let_go = () => { grip.current = null; setDragging(null) }
  return <div className="dp-cell dp-cell--rows" data-standing={standing === 'plain' ? undefined : standing}
    data-i={infoLine(label, undefined, does, [known ? undefined : waiting ? WAITING_SAID : NO_READING_SAID, why].filter(Boolean).join(' ') || undefined)}>
    {(label || pages > 1 || !known) && <div className="dp-rows-head">
      {!known && <Lamp state="unknown" waiting={waiting} />}
      {label && <span className="dp-label">{label}</span>}
      {pages > 1 && <span className="dp-pager">
        <button type="button" aria-label="Previous page" disabled={at === 0 || !onPage} onClick={() => onPage?.(at - 1)}>‹</button>
        <span>{at + 1}/{pages}</span>
        <button type="button" aria-label="Next page" disabled={at === pages - 1 || !onPage} onClick={() => onPage?.(at + 1)}>›</button>
      </span>}
    </div>}
    <ul ref={list} className="dp-rows" data-columns={columns} style={{'--rows': Math.ceil(size / columns), ...(columns > 2 ? {gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`} : {})} as CSSProperties}>
      {shown.map(item => <li key={item.id} className="dp-row" data-dim={item.light !== 'lit' ? 'true' : undefined} data-selected={item.id === selected ? 'true' : undefined}
        data-standing={rowStanding(item) === 'plain' ? undefined : rowStanding(item)} data-i={rowInfo(item)} data-id={item.id} data-dragging={dragging === item.id ? 'true' : undefined}>
        {onRequest && item.request !== undefined && <button type="button" className="dp-row-request" aria-pressed={item.request}
          aria-label={`${item.request ? 'Withhold' : 'Request'} ${item.name}`} onClick={() => onRequest(item.id, !item.request)} />}
        {item.mark ?? <Lamp state={item.light} tone={item.tone} busy={item.busy} waiting={item.waiting} />}
        {onSelect
          ? <button type="button" className="dp-row-name dp-row-select" aria-pressed={item.id === selected} onClick={() => onSelect(item.id)}
            onKeyDown={onMove ? event => { if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); onMove(item.id, event.key === 'ArrowUp' ? -1 : 1) } } : undefined}>{item.name}</button>
          : <span className="dp-row-name">{item.name}</span>}
        {item.meter}
        {item.why && <span className="dp-row-why" aria-label={item.why}>!</span>}
        {item.note && <span className="dp-row-note">{item.note}</span>}
        {onMove && item.id === selected && <span className="dp-row-move">
          {columns === 1 && <span className="dp-row-grip" role="button" aria-label={`Drag ${item.name} to move it`} data-i={said('Move', 'Drag to move this row. The others make room.')}
            onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); grip.current = item.id; setDragging(item.id) }}
            onPointerMove={e => follow(e, item.id)} onPointerUp={let_go} onPointerCancel={let_go} />}
          <button type="button" aria-label={`Move ${item.name} earlier`} data-i={said('Earlier', 'Move this row one place earlier. ⌥↑ does the same.')}
            disabled={items[0]?.id === item.id} onClick={() => onMove(item.id, -1)}>▲</button>
          <button type="button" aria-label={`Move ${item.name} later`} data-i={said('Later', 'Move this row one place later. ⌥↓ does the same.')}
            disabled={items[items.length - 1]?.id === item.id} onClick={() => onMove(item.id, 1)}>▼</button>
        </span>}
      </li>)}
    </ul>
  </div>
}

/** A short meter after a row's name: a fill from the left, in the value colour, that grows or shrinks to a new value in MOTION.value.
 * `value` is 0 to 1; absent, the meter is empty and says so. */
export function Meter({value, tone = 'value', label}: {readonly value: number | undefined; readonly tone?: Tone; readonly label?: string}) {
  const known = !unread(value)
  return <span className="dp-meter" data-tone={tone} role="img" aria-label={`${label ?? 'Meter'}: ${known ? `${Math.round(clamp01(value as number) * 100)} %` : 'no reading'}`}
    style={{'--f': known ? clamp01(value as number) : 0} as CSSProperties}><i /></span>
}

// ---------------------------------------------------------------- the display well and its handles

/** The well: the device's state drawn from its live values, at 1:1 in its own pixels. Handles inside it are controls. `raw`: the
 * device draws its own picture (a component, a canvas) and the well holds it as it is, not inside the well's svg. The corner is the
 * one short reading at the top right (manual §16.12), and it never says what the plate already says: where every number in it stands
 * as well under a dial, in a box, in a readout or on a pad in the same plate, the corner gives way (a number stands once in a view). */
export function Display({w, h, label, does, corner, raw, children}: {readonly w: number; readonly h: number; readonly label?: string; readonly does?: string; readonly corner?: ReactNode; readonly raw?: boolean; readonly children: ReactNode}) {
  const well = useRef<HTMLDivElement>(null)
  useLayoutIso(() => {
    const el = well.current, mark = el?.querySelector<HTMLElement>(':scope > .dp-display-corner')
    if (!el || !mark) return
    mark.removeAttribute('data-echo')
    const plate = el.closest('.dp, .dp-tile')
    if (!plate) return
    const words = (x: string | null) => (x ?? '').replace(/\s+/g, ' ').trim()
    const said = new Set<string>()
    plate.querySelectorAll('.dp-value, .dp-box > span, .dp-readout-value, .dp-pad text.dp-ink-dim').forEach(n => { if (!el.contains(n) || n.closest('.dp-pad')) said.add(words(n.textContent)) })
    const parts = words(mark.textContent).split(/ (?:\/|·) /).filter(Boolean)
    if (parts.length && parts.every(part => said.has(part))) mark.setAttribute('data-echo', 'true')
  })
  return <div ref={well} className="dp-display" data-raw={raw ? 'true' : undefined} style={{width: w, height: h}} data-i={said(label, does)}>
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

// ---------------------------------------------------------------- the pad

/** One axis of a pad: a parameter's name, its reading and how it is kept (the same terms as a dial's). */
export interface PadAxis extends Standing {
  readonly label: string
  /** What the axis does, for the status bar. */
  readonly does?: string
  readonly value: number | undefined
  readonly def?: number
  readonly scale: Scale
  readonly format: (v: number) => string
  readonly onChange?: (v: number) => void
}

/** A pad: a square well whose two sides are two parameters, and one handle that moves both (manual §16.9: "A handle for two parameters
 * moves in two directions"). The handle stands where the two values put it; press it and drag, or press anywhere in the well to bring it
 * there. Each side keeps the detent on its own default, Shift moves a tenth as fast, the arrows move one per cent (Page keys ten), and
 * Delete or a double-click returns both. A value another party moved glides there and rings once, as on a dial; a side the owner holds
 * or refuses stands as a dial's does. With no reading on either side the well is empty and says so. */
export function Pad({w, h, label, does, x, y}: {readonly w: number; readonly h: number; readonly label?: string; readonly does?: string; readonly x: PadAxis; readonly y: PadAxis}) {
  const kx = !unread(x.value), ky = !unread(y.value), known = kx && ky
  const canX = kx && !!x.onChange && !x.disabled, canY = ky && !!y.onChange && !y.disabled, live = known && (canX || canY)
  const hand = useRef(0), drag = useRef<{cx: number; cy: number; rx: number; ry: number} | null>(null)
  const flash = useFlash(known ? `${x.value}|${y.value}` : undefined, hand)
  const ux = useGlide(kx ? toUnit(x.scale, x.value!) : 0, !handIs(hand.current ?? 0)), uy = useGlide(ky ? toUnit(y.scale, y.value!) : 0, !handIs(hand.current ?? 0))
  const L = 8, R = w - 8, T = 17, B = h - 15, X = (u: number) => L + u * (R - L), Y = (u: number) => B - u * (B - T)
  const dx = x.def !== undefined && !x.scale.step && kx ? toUnit(x.scale, x.def) : null, dy = y.def !== undefined && !y.scale.step && ky ? toUnit(y.scale, y.def) : null
  const px = X(ux), py = Y(uy)
  // Merged standing: the cell rings for either side; the status bar speaks for both.
  const held = x.heldBy ?? y.heldBy, by = x.movedBy ?? y.movedBy
  const standing: Standing = {
    ...(x.automated || y.automated ? {automated: x.automated ?? y.automated} : {}), ...(held ? {heldBy: held, onHandBack: () => { x.onHandBack?.(); y.onHandBack?.() }} : {}),
    ...(x.pending || y.pending ? {pending: true} : {}), ...(x.disabled && y.disabled ? {disabled: x.disabled} : {}), ...(x.refused || y.refused ? {refused: x.refused ?? y.refused} : {}),
    ...(x.modulatedBy || y.modulatedBy ? {modulatedBy: x.modulatedBy ?? y.modulatedBy} : {}), ...(x.waiting || y.waiting ? {waiting: true} : {}), ...(by ? {movedBy: by} : {}),
    ...(x.valueKey ?? y.valueKey ? {valueKey: x.valueKey ?? y.valueKey} : {}),
  }
  const sideWords = [x, y].map(a => (a.disabled && !(x.disabled && y.disabled) ? `${a.label}: ${a.disabled}` : '')).filter(Boolean).join(' ')
  const said_ = [does, sideWords].filter(Boolean).join(' ') || undefined
  const caught = (el: Element, on: boolean) => { const cell = el.closest('.dp-cell'); if (on) cell?.setAttribute('data-detent', 'true'); else cell?.removeAttribute('data-detent') }
  const put = (rx: number, ry: number, fine: boolean, el: Element) => {
    const a = detent(rx, dx, fine), b = detent(ry, dy, fine)
    caught(el, a.caught || b.caught)
    if (canX) { const next = fromUnit(x.scale, a.u); if (next !== x.value) x.onChange!(next) }
    if (canY) { const next = fromUnit(y.scale, b.u); if (next !== y.value) y.onChange!(next) }
  }
  const release = (el: Element) => { drag.current = null; handUp(hand); caught(el, false) }
  const where = (e: PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget, box = svg.getBoundingClientRect(), view = svg.viewBox.baseVal
    return {vx: (e.clientX - box.left) * view.width / box.width, vy: (e.clientY - box.top) * view.height / box.height, px: box.width / view.width, py: box.height / view.height}
  }
  const move = (e: KeyboardEvent<SVGSVGElement>, ax: number, ay: number) => {
    e.preventDefault(); handUp(hand)
    const rx = Math.min(1, Math.max(0, toUnit(x.scale, x.value!) + ax)), ry = Math.min(1, Math.max(0, toUnit(y.scale, y.value!) + ay))
    if (canX && ax) x.onChange!(fromUnit(x.scale, rx))
    if (canY && ay) y.onChange!(fromUnit(y.scale, ry))
  }
  return <Cell kind="pad" label={label} does={said_} value={known ? `${x.label} ${x.format(x.value!)} · ${y.label} ${y.format(y.value!)}` : undefined} standing={standing} unknown={!known} flash={flash}>
    <div className="dp-display dp-pad" style={{width: w, height: h}}>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="slider" aria-label={label ?? `${x.label} and ${y.label}`} tabIndex={live ? 0 : -1} aria-disabled={!live || undefined}
        aria-valuetext={known ? `${x.label} ${x.format(x.value!)}, ${y.label} ${y.format(y.value!)}` : 'no reading'}
        onPointerDown={e => {
          if (!live || e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId); handDown(hand)
          const at = where(e)
          let rx = toUnit(x.scale, x.value!), ry = toUnit(y.scale, y.value!)
          if (Math.hypot(at.vx - px, at.vy - py) > 12) { rx = Math.min(1, Math.max(0, (at.vx - L) / (R - L))); ry = Math.min(1, Math.max(0, (B - at.vy) / (B - T))); put(rx, ry, e.shiftKey, e.currentTarget) }
          drag.current = {cx: e.clientX, cy: e.clientY, rx, ry}
        }}
        onPointerMove={e => {
          const d = drag.current
          if (!d) return
          const at = where(e), k = e.shiftKey ? 0.1 : 1
          const rx = Math.min(1, Math.max(0, d.rx + (e.clientX - d.cx) / (at.px * (R - L)) * k)), ry = Math.min(1, Math.max(0, d.ry + (d.cy - e.clientY) / (at.py * (B - T)) * k))
          drag.current = {cx: e.clientX, cy: e.clientY, rx, ry}
          put(rx, ry, e.shiftKey, e.currentTarget)
        }}
        onPointerUp={e => release(e.currentTarget)} onPointerCancel={e => release(e.currentTarget)}
        onDoubleClick={() => { if (!live) return; handUp(hand); if (canX && x.def !== undefined) x.onChange!(x.def); if (canY && y.def !== undefined) y.onChange!(y.def) }}
        onKeyDown={e => {
          if (!live) return
          const d = e.shiftKey ? 0.001 : 0.01
          switch (e.key) {
            case 'ArrowLeft': move(e, -d, 0); break
            case 'ArrowRight': move(e, d, 0); break
            case 'ArrowUp': move(e, 0, d); break
            case 'ArrowDown': move(e, 0, -d); break
            case 'PageUp': move(e, 0, 0.1); break
            case 'PageDown': move(e, 0, -0.1); break
            case 'Home': move(e, -1, 0); break
            case 'End': move(e, 1, 0); break
            case 'Delete': case 'Backspace': e.preventDefault(); handUp(hand); if (canX && x.def !== undefined) x.onChange!(x.def); if (canY && y.def !== undefined) y.onChange!(y.def); break
          }
        }}>
        {[.25, .5, .75].map(f => <path key={f} d={`M${X(f).toFixed(1)} ${T}V${B}M${L} ${Y(f).toFixed(1)}H${R}`} className="dp-grid" />)}
        <rect x={L} y={T} width={R - L} height={B - T} className="dp-faint" />
        {dx !== null && <path d={`M${X(dx).toFixed(1)} ${T}V${B}`} className="dp-pad-def" />}
        {dy !== null && <path d={`M${L} ${Y(dy).toFixed(1)}H${R}`} className="dp-pad-def" />}
        <text x={L} y={T - 5} className="dp-axis">{y.label}</text>
        <text x={R} y={T - 5} textAnchor="end" className="dp-ink-dim">{ky ? y.format(y.value!) : NO_READING}</text>
        <text x={L} y={h - 4} className="dp-axis">{x.label}</text>
        <text x={R} y={h - 4} textAnchor="end" className="dp-ink-dim">{kx ? x.format(x.value!) : NO_READING}</text>
        {known ? <g className="dp-handle dp-pad-puck" data-shape="ring" data-tone="accent">
          <path d={`M${L} ${py.toFixed(1)}H${px.toFixed(1)}M${px.toFixed(1)} ${py.toFixed(1)}V${B}`} className="dp-pad-guide" />
          <circle cx={px} cy={py} r={11} className="dp-handle-hit" />
          <circle cx={px} cy={py} r={5.5} className="dp-handle-mark" />
        </g> : <text x={w / 2} y={h / 2 + 3} textAnchor="middle" className="dp-ink-dim">{NO_READING}</text>}
      </svg>
    </div>
  </Cell>
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
  /** The owner reports the device working: the activator carries a ring while it does. */
  readonly busy?: boolean
  /** The device's kind mark before its name (a practice's woodcut mark). */
  readonly mark?: ReactNode
  /** Keep the device on the widget rail (manual §16.3: a widget stays on the rail when you change mode). */
  readonly onRail?: () => void
  /** Marks the place gives the head, before ▦ ↗. */
  readonly marks?: ReactNode
  /** The place's own words for ▦ (absent: "Open <title> full in a pane"). */
  readonly fullLabel?: string
  /** What pressing the plate does, said on the status bar when you point at its head ("Show every setting in the pool"). */
  readonly hint?: string
  /** Why the activator only reads (the owner has no on/off operation): it stands disabled and says this. */
  readonly lightWhy?: string
  /** The device's own acts in the head, after the pages and before the place's marks (the Studio's Save, Undo, Redo). */
  readonly acts?: ReactNode
  /** A rack (manual §16.1): its head carries Live's three marks, and its sections named by `part` stand only while their mark shows them. */
  readonly rack?: boolean
  readonly children: ReactNode
}

/** What the place a device stands in gives every Panel, PanelHead and Tile inside it: the place's marks, the rail mark and the
 * tile's close. A host provides it around a design's view; a prop on the part itself wins. It reaches views whose root is a
 * component as well as plain ones. */
export interface Place {
  readonly marks?: ReactNode
  readonly onRail?: () => void
  readonly onClose?: () => void
  /** ▸ beside the activator: show the device's expanded view, a band above the chain (Live's Toggle Expanded View). */
  readonly onExpand?: () => void
  /** The expanded view stands: ▸ shows ▾, pressed. */
  readonly expanded?: boolean
  /** ↗: pop the device out into its own window, its material with every control (Live's plug-in window). */
  readonly onPopout?: () => void
  /** A rack's parts the place shows (its head's three marks; the host keeps them per device). Absent, the rack keeps its own. */
  readonly rackShown?: Partial<RackShown>
  readonly onRackShow?: (part: RackPart, shown: boolean) => void
}
export const PlaceContext = createContext<Place>({})

// ---------------------------------------------------------------- a rack's three parts (Live's rack head)

/** The parts of a rack its head shows or hides, in the order of Live's rack head (manual §16.4 "A rack's head has three more marks, as
 * Live's do: show or hide the macros, the chain list, and the devices of the selected chain"; Ableton Live 12.0.25 group devices:
 * AreMacroControlsVisible, IsBranchesListVisible, AreDevicesVisible — devices/racks-session-model.md §1.2). */
export const RACK_PARTS = ['macros', 'chains', 'devices'] as const
export type RackPart = typeof RACK_PARTS[number]
export type RackShown = Readonly<Record<RackPart, boolean>>
const RACK_ALL: RackShown = {macros: true, chains: true, devices: true}
/** Each mark's cut (icon-cut.html): a dial for the macros, the list for the chain list, the chain of devices for the devices. */
const RACK_MARK = {macros: 'form', chains: 'arrangement', devices: 'chain'} as const
const RACK_WORDS: Readonly<Record<RackPart, readonly [string, string]>> = {
  macros: ['Macros', 'the rack\'s macros'], chains: ['Chain list', 'the chain list'], devices: ['Devices', 'the devices of the chosen chain'],
}
/** What a rack shows, for its sections (Section `part`). Outside a rack every part stands. */
const RackContext = createContext<RackShown>(RACK_ALL)

/** The body of a rack drawn with PanelHead (a plate the Panel does not draw whole): its sections named by `part` stand while shown. */
export function RackBody({shown, children}: {readonly shown: RackShown; readonly children: ReactNode}) {
  return <RackContext.Provider value={shown}>{children}</RackContext.Provider>
}

/** A rack's shown parts and their hand, for a plate drawn with PanelHead and RackBody: the place's, else the plate's own. */
export function useRack(): {readonly shown: RackShown; readonly onShow: (part: RackPart, shown: boolean) => void} {
  const [shown, onShow] = useRackParts(true, useContext(PlaceContext))
  return {shown, onShow}
}

/** A rack's shown parts and their hand: the place's, where the host keeps them, else the plate's own. */
function useRackParts(rack: boolean | undefined, place: Place): [RackShown, (part: RackPart, shown: boolean) => void] {
  const [own, setOwn] = useState<RackShown>(RACK_ALL)
  const shown: RackShown = place.rackShown ? {...RACK_ALL, ...place.rackShown} : own
  const show = place.onRackShow ?? ((part: RackPart, on: boolean) => setOwn(was => ({...was, [part]: on})))
  return [rack ? shown : RACK_ALL, show]
}

/** The rack's three marks, after the expanded view's toggle, as Live's rack head carries them. */
function RackMarks({title, shown, onShow}: {title: string; shown: RackShown; onShow: (part: RackPart, shown: boolean) => void}) {
  return <span className="dp-rack-marks" role="group" aria-label={`${title}: what the rack shows`}>
    {RACK_PARTS.map(part => <button key={part} type="button" className="dp-fold dp-rack-mark" data-rack-mark={part} aria-pressed={shown[part] ? 'true' : 'false'}
      aria-label={`${shown[part] ? 'Hide' : 'Show'} ${RACK_WORDS[part][1]}`}
      data-i={said(RACK_WORDS[part][0], `${shown[part] ? 'Hides' : 'Shows'} ${RACK_WORDS[part][1]}, as Live's rack head does. The others take the room.`)}
      onClick={() => onShow(part, !shown[part])}><Icon name={RACK_MARK[part]} size={10} /></button>)}
  </span>
}

/** The activator, the same in Panel and PanelHead: a reading of the owner's on/off, pressable only where the owner can turn it. `busy`:
 * the owner reports the device working, so a ring spreads from the light while it does. */
function Activator({title, light, onLight, why, busy}: {title: string; light: LightState; onLight?: () => void; why?: string; busy?: boolean}) {
  const standing = standingOf({working: busy}, light !== 'unknown')
  return <button type="button" className="dp-activator" data-light={light} data-busy={busy ? 'true' : undefined} data-standing={standing === 'plain' ? undefined : standing}
    aria-pressed={light === 'lit'} disabled={!onLight || !!why}
    aria-label={`${title}: ${light === 'unknown' ? 'no reading' : light === 'lit' ? 'on' : 'off'}${busy ? ', working' : ''}`}
    data-i={infoLine('Device on/off', light === 'lit' ? 'On' : light === 'dark' ? 'Off' : undefined,
      why ?? (light === 'unknown' ? NO_READING_SAID : 'Asks the owner to turn the device on or off. The light shows what the owner reports.'), busy ? 'The owner reports it working.' : undefined)}
    onClick={why ? undefined : onLight} />
}

/** A head's pages (Live's Osc 1 · Osc 2): the shown page's face is a thumb that slides to the page you chose in MOTION.choice. */
function PagesNav({title, pages, page, onPage}: {title: string; pages: readonly Page[]; page?: string; onPage?: (id: string) => void}) {
  const slide = useSlide<HTMLElement>('[aria-selected="true"]', `${page ?? ''}|${pages.map(p => p.id).join(',')}`)
  return <nav ref={slide} className="dp-pages" role="tablist" aria-label={`${title} pages`}>
    <span className="dp-thumb" aria-hidden="true" />
    {pages.map(p => <button key={p.id} type="button" data-page={p.id} role="tab" aria-selected={p.id === page} onClick={() => onPage?.(p.id)}>
      {p.light && <Lamp state={p.light} />}{p.label}
    </button>)}
  </nav>
}

/** Live's Toggle Expanded View, beside the activator: ▸ shows the device's whole panel as a band across the detail area, above the
 * chain; ▾ while it stands there folds it back. */
function ExpandToggle({title, place}: {title: string; place: Place}) {
  if (!place.onExpand) return null
  return <button type="button" className="dp-fold dp-expand" aria-pressed={place.expanded ? 'true' : 'false'}
    aria-label={place.expanded ? `Fold ${title}'s expanded view` : `Expand ${title}`}
    data-i={said('Expanded view', place.expanded ? 'Hides the device\'s expanded view.' : 'Shows the device\'s expanded view: every setting and a larger picture, in a band above the chain.')}
    onClick={place.onExpand}><ChevronFold size={10} /></button>
}

/** Live folds a device from its head: a double-click on the head (or Fold in its context menu) folds it to its title. A press on a
 * control inside the head is that control's own. */
const foldOnDoubleClick = (onFold?: () => void) => onFold && ((event: MouseEvent<HTMLElement>) => {
  if ((event.target as Element).closest('button, input, select, [role="tab"]')) return
  onFold()
})

/** The marks at the right of a device's head: the place's own marks, the rail, ▦ full in a pane, ↗ pop out to a window. Each shows
 * only where the place or the device gives its act. Live's own marks sit at the left: the activator, then the expand toggle. */
function HeadMarks({title, marks, onRail, onFull, fullLabel, place}: {title: string; marks?: ReactNode; onRail?: () => void; onFull?: () => void; fullLabel?: string; place: Place}) {
  return <span className="dp-head-x">
    {marks}
    {onRail && <button type="button" className="dp-full dp-rail" aria-label={`Keep ${title} on the widget rail`} data-i={said('On the rail', 'Keep this device on the widget rail, in every mode.')} onClick={onRail}><Icon name="placed" size={10} /></button>}
    {onFull && <button type="button" className="dp-full" aria-label={fullLabel ?? `Open ${title} full in a pane`} data-i={said('Open in a pane', fullLabel ?? 'Open the device full size in the pane that has focus.')} onClick={onFull}><Icon name="pane" size={10} /></button>}
    {place.onPopout && <button type="button" className="dp-full dp-popout" aria-label={`Pop ${title} out into its own window`} data-i={said('Pop out', 'Open the device in its own window, its material with every control. The window can fill the screen.')} onClick={place.onPopout}><PopOut size={10} /></button>}
  </span>
}

/** One device panel: the head, then the body — one band on a chain, up to two bands in the pool. */
export function Panel({title, view, light: reported, onLight, pages, page, onPage, onFold, onFull, onSelect, selected, heldBy, busy, mark, onRail: ownRail, marks: ownMarks, fullLabel, hint, lightWhy, acts, rack, children}: PanelProps) {
  const light = lightIn(reported), place = useContext(PlaceContext)
  const marks = ownMarks ?? place.marks, onRail = ownRail ?? place.onRail
  const [shown, show] = useRackParts(rack, place)
  return <section className="dp" data-view={view} data-selected={selected ? 'true' : undefined} data-rack={rack ? 'true' : undefined} aria-label={title}
    onPointerDownCapture={onSelect}>
    <header className="dp-head" data-i={hint ? said(title, hint) : undefined} onDoubleClick={foldOnDoubleClick(onFold)}>
      <Activator title={title} light={light} onLight={onLight} why={lightWhy} busy={busy} />
      <ExpandToggle title={title} place={place} />
      {rack && <RackMarks title={title} shown={shown} onShow={show} />}
      {mark}
      <span className="dp-title">{title}</span>
      {heldBy && <span className="dp-head-held" data-i={said('Held', `${heldBy} holds values on this device.`)}>{heldBy}</span>}
      {pages && <PagesNav title={title} pages={pages} page={page} onPage={onPage} />}
      {acts !== undefined && acts !== null && acts !== false && <span className="dp-head-acts">{acts}</span>}
      <HeadMarks title={title} marks={marks} onRail={onRail} onFull={onFull} fullLabel={fullLabel} place={place} />
    </header>
    <div className="dp-body"><RackContext.Provider value={shown}>{children}</RackContext.Provider></div>
  </section>
}

export interface PanelHeadProps {
  readonly title: string
  /** The activator: a reading of the owner's on/off. Pressing it asks the owner; absent `onLight`, it only reads. */
  readonly light: LightState
  readonly onLight?: () => void
  /** Fold the device to its title: a double-click on the head, as in Live. */
  readonly onFold?: () => void
  /** The device's kind mark before its name. */
  readonly mark?: ReactNode
  /** A press on the name (an instrument's name opens it where it plays). Absent, the name is only its name. */
  readonly onName?: () => void
  /** What a press on the name does, for the status bar. */
  readonly nameDoes?: string
  /** Someone else holds values on this device. */
  readonly heldBy?: string
  /** The owner reports the device working: the activator carries a ring while it does. */
  readonly busy?: boolean
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
  /** A rack's three marks (useRack), whose body stands in RackBody. */
  readonly rack?: {readonly shown: RackShown; readonly onShow: (part: RackPart, shown: boolean) => void}
}

/** The head of a device panel, for a plate the kit's Panel does not draw whole (an instrument's sections, a compact): the activator, ▾,
 * the name, the held mark, the pages, the device's own acts, the place's marks and ⤢ (manual §16.9). The Panel's own head, as one
 * part. */
export function PanelHead({title, light: reported, onLight, onFold, mark, onName, nameDoes, heldBy, busy, pages, page, onPage, acts, marks: ownMarks, onRail: ownRail, onFull, fullLabel, hint, selected, lightWhy, rack}: PanelHeadProps) {
  const light = lightIn(reported), place = useContext(PlaceContext)
  const marks = ownMarks ?? place.marks, onRail = ownRail ?? place.onRail
  return <header className="dp-head dp-head--plate" data-selected={selected ? 'true' : undefined} data-i={hint ? said(title, hint) : undefined} onDoubleClick={foldOnDoubleClick(onFold)}>
    <Activator title={title} light={light} onLight={onLight} why={lightWhy} busy={busy} />
    <ExpandToggle title={title} place={place} />
    {rack && <RackMarks title={title} shown={rack.shown} onShow={rack.onShow} />}
    {mark}
    {onName
      ? <button type="button" className="dp-title dp-title--press" onClick={onName} data-i={said(title, nameDoes ?? hint)}>{title}</button>
      : <span className="dp-title">{title}</span>}
    {heldBy && <span className="dp-head-held" data-i={said('Held', `${heldBy} holds values on this device.`)}>{heldBy}</span>}
    {pages && <PagesNav title={title} pages={pages} page={page} onPage={onPage} />}
    {acts !== undefined && acts !== null && acts !== false && <span className="dp-head-acts">{acts}</span>}
    <HeadMarks title={title} marks={marks} onRail={onRail} onFull={onFull} fullLabel={fullLabel} place={place} />
  </header>
}

/** One band of the body: the fixed height every plate shares. */
export function Band({children}: {readonly children: ReactNode}) {
  return <div className="dp-band">{children}</div>
}

/** A section of a band, ruled off from the next, named in small capitals. `cols` sets its width in control columns. `part`: in a rack,
 * the part of Live's rack the section holds — its macros, its chain list, or the devices of the chosen chain — which stands only while
 * the rack's head shows it; the sections beside it take the room. */
export function Section({label, cols, width, grow, part, children}: {readonly label?: string; readonly cols?: number; readonly width?: number; readonly grow?: boolean; readonly part?: RackPart; readonly children: ReactNode}) {
  const shown = useContext(RackContext)
  if (part && !shown[part]) return null
  return <div className="dp-sec" data-grow={grow ? 'true' : undefined} data-rack-part={part} style={{width: width ?? (cols ? cols * COL : undefined)} as CSSProperties}>
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
export function Tile({title, light, busy, span = 1, onFull, onClose: ownClose, onLight, lightWhy, badge, children}: {readonly title: string; readonly light: LightState; /** The owner reports the device working: its light carries the ring. */ readonly busy?: boolean; readonly span?: 1 | 2; readonly onFull?: () => void; readonly onClose?: () => void; readonly onLight?: () => void; readonly lightWhy?: string; readonly badge?: ReactNode; readonly children: ReactNode}) {
  const place = useContext(PlaceContext), onClose = ownClose ?? place.onClose, onPopout = place.onPopout
  return <section className="dp-tile" data-span={span} aria-label={title}>
    <header className="dp-tile-head">
      {/* The tile's light reads the owner; where the owner can turn the device on or off, pressing it asks, as the plate's activator does. */}
      {onLight || lightWhy ? <Activator title={title} light={lightIn(light)} onLight={onLight} why={lightWhy} busy={busy} /> : <Lamp state={light} busy={busy} />}
      <span className="dp-tile-title">{title}</span>
      {badge !== undefined && badge !== null && <span className="dp-tile-badge">{badge}</span>}
      {onFull && <button type="button" className="dp-full" aria-label={`Open ${title} full in a pane`} data-i={said('Open in a pane', 'Open the device full size in the pane that has focus.')} onClick={onFull}><Icon name="pane" size={10} /></button>}
      {onPopout && <button type="button" className="dp-full dp-popout" aria-label={`Pop ${title} out into its own window`} data-i={said('Pop out', 'Open the device in its own window, its material with every control.')} onClick={onPopout}><PopOut size={10} /></button>}
      {onClose && <button type="button" className="dp-full" aria-label={`Take ${title} off the rail`} data-i={said('Close', 'Take the device off the rail. It stays on its chain.')} onClick={onClose}>✕</button>}
    </header>
    <div className="dp-tile-body">{children}</div>
  </section>
}

/** A ladder of evidence: one step for each rung, lit when it is established, dark when it is not, hollow when nobody has
 * observed it. Nothing is inferred upward. `row` draws it as ticks after a name; `tall` as a labelled column. `running`: the rung
 * the owner reports being worked on pulses, for as long as it says so. */
export function Ladder({rungs, labels, size = 'row', label, running, waiting}: {readonly rungs: readonly (boolean | null)[]; readonly labels: readonly string[]; readonly size?: 'row' | 'tall'; readonly label?: string; readonly running?: number;
  /** The owner is asked for the evidence and has not answered: the unobserved rungs breathe (Waiting for a reading). */ readonly waiting?: boolean}) {
  const top = rungs.reduce<number>((at, rung, i) => (rung === true ? i : at), -1)
  const seen = rungs.some(rung => rung !== null)
  const standing: StandingName = !seen ? (waiting ? 'awaiting' : 'unread') : running !== undefined ? 'working' : 'plain'
  return <span className="dp-ladder" data-size={size} role="img" data-standing={standing === 'plain' ? undefined : standing}
    aria-label={`${label ?? 'Evidence'}: ${top < 0 ? 'none established' : `up to ${labels[top]}`}${running !== undefined && labels[running] ? `; working on ${labels[running]}` : ''}`}
    data-i={`${label ?? 'Evidence'}|${rungs.map((rung, i) => `${labels[i]} ${rung === true ? 'yes' : rung === false ? 'no' : '—'}`).join(' · ')}${!seen ? ` ${waiting ? WAITING_SAID : NO_READING_SAID}` : running !== undefined && labels[running] ? ` Working on ${labels[running]}.` : ''}`}>
    {rungs.map((rung, i) => <span key={labels[i]} className="dp-ladder-rung" data-rung={rung === true ? 'yes' : rung === false ? 'no' : 'unseen'} data-running={running === i ? 'true' : undefined}>
      {size === 'tall' && <span className="dp-ladder-label">{labels[i]}</span>}
    </span>)}
  </span>
}
