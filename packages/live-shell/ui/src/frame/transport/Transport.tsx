// The one transport (FOUNDATION F7): 28 slots in Live's places, the same in every mode, each with its specimen mark from
// the icon cut; readout slots show values. What a slot does is the mode's binding (shell/modeTransports.tsx); unbound,
// it is drawn waiting — reduced, disabled, its title naming what it would do and that it waits. A slot is enabled only by
// a binding with a write path; a light shows only a reading. It knows no mode. Drawn at the mockup's floor (.tp's groups,
// .nc cells, .fld readouts, .tbtn play row; transport.css): the controls the mockup names with a word wear the mode's word
// (Link, Ground, Stamp, Tap, Map — `SlotWords.face`), and a marked slot whose owner gives it a reading shows the reading
// where the mockup draws a field (the day's opening and close on the punch slots).
import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react'
import {Icon as CutIcon, type IconName} from '../../inhabitants/sdk/Icon'
import type {SlotBinding, SlotWords, TransportBindings, TransportSlotId} from './slots'
import {nextFold, type FoldState} from './fold'
import {LinkSlot} from './LinkSlot'
import './transport.css'

/** Each pressable slot's specimen mark (icon-cut.html); the slots without one are readouts or wear a word. */
const MARKS: Partial<Record<TransportSlotId, IconName>> = {
  metro: 'metro', follow: 'follow', play: 'play', stop: 'stop', record: 'rec', overdub: 'od',
  arm: 'arm', 're-enable': 'back', capture: 'cap', 'punch-in': 'punchIn', loop: 'loop', 'punch-out': 'punchOut',
  draw: 'draw', keys: 'keys',
}
/** The controls the mockup names with a word in every mode (rev 5 `TPM`: Link, Tap, Map): the face is the mode's word for
 * the control, never a value — an owner reading on one of them is its title (what serves it), not its face. */
const WORDS = new Set<TransportSlotId>(['link', 'tap', 'key-map', 'midi-map'])
/** A readout slot's face while its owner discloses no value — Live's own empty faces. */
const EMPTY: Partial<Record<TransportSlotId, string>> = {
  tempo: '—', signature: '— / —', quantize: '—', key: '♯', root: '—', scale: '—', position: '— . — . —',
  'loop-length': '—', rate: '—', cpu: '—',
}
const PLAY_ROW = new Set<TransportSlotId>(['play', 'stop', 'record'])
/** The slots that only show a value; the other unmarked slots (quantize, key) are controls whose face is text. */
const READOUTS = new Set<TransportSlotId>(['tempo', 'signature', 'root', 'scale', 'position', 'loop-length', 'rate', 'cpu'])

/** The slots that fold to their mark when the bar is short of room: an owner's control in a slot that has a specimen mark
 * (fold.ts). The key changes when the mode in front of you binds other controls, and the fold starts open again. */
const foldableKey = (bindings: TransportBindings): string =>
  (Object.keys(bindings) as TransportSlotId[]).filter(id => MARKS[id] && bindings[id]?.control).sort().join(' ')

export function Transport({bindings, words}: {bindings: TransportBindings; words: (id: TransportSlotId) => SlotWords}) {
  const bar = useRef<HTMLDivElement>(null)
  const foldable = foldableKey(bindings)
  const [fold, setFold] = useState<FoldState & {key: string}>({folded: false, need: 0, key: foldable})
  const [open, setOpen] = useState<TransportSlotId | null>(null)
  const folded = fold.folded && fold.key === foldable
  // The bar measures its own room: its box (the window, the toggles beside it) and its groups' widths (an owner's control
  // that appears, a reading that grows). Short of room, the foldable slots fold to their marks; the room back, they open.
  useLayoutEffect(() => {
    const el = bar.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const scale = el.querySelector<HTMLElement>(':scope > .transport-scale')
      const standing = scale && scale.getClientRects().length > 0
      setFold(state => {
        const base = state.key === foldable ? state : {folded: false, need: 0, key: foldable}
        const next = nextFold(base, {scroll: el.scrollWidth, client: el.clientWidth,
          ...(standing ? {scaleScroll: scale.scrollWidth, scaleClient: scale.clientWidth} : {})})
        return next === base ? base : {...next, key: foldable}
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const group of el.children) observer.observe(group)
    measure()
    return () => observer.disconnect()
  }, [foldable])
  // An opened fold closes on a press outside it, or Escape; and when the slot opens in the row again.
  useEffect(() => {if (!folded) setOpen(null)}, [folded])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {if (!(event.target instanceof Element) || !event.target.closest(`[data-slot="${open}"]`)) setOpen(null)}
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') setOpen(null)}
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape)
    return () => {document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape)}
  }, [open])
  const foldOf = (id: TransportSlotId) => folded && MARKS[id] && bindings[id]?.control
    ? {open: open === id, toggle: () => setOpen(current => current === id ? null : id)} : undefined
  const slot = (id: TransportSlotId): ReactNode => <Slot key={id} id={id} binding={bindings[id]} words={words(id)} fold={foldOf(id)} />
  return <div ref={bar} className="mode-transport one-transport" role="group" aria-label="Transport" data-fold={folded ? 'marks' : undefined}>
    {/* Link and Tap lead the tempo cells as one group, as the mockup's first group does. Link is one device in every mode (§19.19). */}
    <div className="transport-group transport-lead"><LinkSlot />{slot('tap')}
      <div className="transport-group transport-tempo">{slot('tempo')}{slot('signature')}{slot('metro')}{slot('quantize')}</div></div>
    <div className="transport-scale">{slot('key')}{slot('root')}{slot('scale')}</div>
    <div className="transport-spacer" />
    <div className="transport-group transport-playback">{slot('follow')}{slot('position')}{slot('play')}{slot('stop')}{slot('record')}{slot('overdub')}{slot('arm')}{slot('re-enable')}{slot('capture')}</div>
    <div className="transport-loop transport-group">{slot('punch-in')}{slot('loop')}{slot('punch-out')}{slot('loop-length')}</div>
    <div className="transport-spacer" />
    <div className="transport-system">{slot('draw')}{slot('keys')}{slot('key-map')}{slot('midi-map')}{slot('rate')}{slot('cpu')}<span className="cpu-meter" /></div>
  </div>
}

function Slot({id, binding, words, fold}: {id: TransportSlotId; binding: SlotBinding | undefined; words: SlotWords; fold?: {open: boolean; toggle: () => void}}) {
  const title = binding?.refused ? `${words.label} — ${words.fn}. ${binding.refused}` : binding?.title ?? binding?.readout?.title ?? words.waiting
  const common = {'data-slot': id, 'data-i': words.dataI, title, 'aria-label': words.label}
  const light = binding?.lit === undefined ? undefined : binding.lit ? 'on' : 'off'
  const mark = MARKS[id]
  if (binding?.control && mark) {
    // An owner's control in a marked slot can fold to its mark (fold.ts): one cell whose press opens the control, whole,
    // beneath it. The structure is the same open or folded (the mark drawn only while folded, the body laid in the row while
    // open: transport.css), so folding never remounts the owner's control — its state and pending writes are kept.
    return <span className="transport-slot" {...common} data-light={light} data-fold={fold ? fold.open ? 'open' : 'folded' : undefined}>
      <button type="button" className="native-control transport-fold-mark" data-i={words.dataI} title={title} aria-label={words.label}
        aria-haspopup="true" aria-expanded={fold?.open ?? false} data-light={light} onClick={fold?.toggle}>
        <CutIcon name={mark} size={13} /></button>
      <span className="transport-fold-body">{binding.control}</span>
    </span>
  }
  if (binding?.control) return <span className="transport-slot" {...common} data-light={light}>{binding.control}</span>
  const enabled = !binding?.refused && (binding?.press !== undefined)
  const stepper = binding?.step && !binding.refused
  if (WORDS.has(id)) {
    // A control the mockup names with a word (Link, Ground, Stamp, Tap, Map): the mode's word, enabled only by the owner's write.
    return <button type="button" className="native-control transport-text transport-word" {...common} data-light={light} aria-pressed={binding?.lit}
      disabled={!enabled} aria-disabled={!enabled} onClick={binding?.press}>{words.face ?? words.label}</button>
  }
  if (mark && binding?.readout && !PLAY_ROW.has(id) && !enabled && !stepper) {
    // A marked slot the owner gives a reading and no press (the day's opening and its close on the punch slots): the mockup
    // draws a field there, so the reading stands in the mark's place.
    return <output className="meter-field transport-reading" {...common} data-light={light}>{binding.readout.value}</output>
  }
  const readout = binding?.readout?.value ?? EMPTY[id]
  if (!mark && !READOUTS.has(id) && binding?.readout && !enabled) {
    // A text-faced control the owner gives a reading but no press here (Central's packet size on the key slot): the mockup
    // draws a field, so the reading stands as one.
    return <output className="meter-field transport-reading" {...common} data-light={light}>{binding.readout.value}</output>
  }
  if (!mark && !READOUTS.has(id)) {
    // A control whose face is text (Live's own: the quantize value, ♯): enabled only by the owner's write.
    return <button type="button" className="native-control transport-text" {...common} data-light={light} aria-pressed={binding?.lit}
      disabled={!enabled} aria-disabled={!enabled} onClick={binding?.press}>{readout}</button>
  }
  if (!mark) {
    // A readout slot: its value; a stepped readout (tempo) carries its nudges, enabled only by the owner's step.
    // Unread (no owner value), the readout shows Live's empty face, drawn faint: a dash is not a value.
    const face = <output className={id === 'position' || id === 'loop-length' ? 'position-field' : id === 'tempo' ? 'tempo-field' : 'meter-field'} {...common} data-light={light}
      data-unread={binding?.readout ? undefined : ''}>{readout}</output>
    if (!binding?.step && id !== 'tempo') return face
    return <>{face}
      <button type="button" className="native-control" data-slot={id} data-i={words.dataI} title={title} aria-label={`${words.label} down`} disabled={!stepper} onClick={() => binding?.step?.(-1)}>‹</button>
      <button type="button" className="native-control" data-slot={id} data-i={words.dataI} title={title} aria-label={`${words.label} up`} disabled={!stepper} onClick={() => binding?.step?.(1)}>›</button>
    </>
  }
  const step = binding?.step && !binding.refused
  return <button type="button" className={`native-control${PLAY_ROW.has(id) ? ` transport-btn transport-${id === 'record' ? 'record' : id}` : ''}`} {...common}
    data-light={light} aria-pressed={binding?.lit} disabled={!enabled && !step} aria-disabled={!enabled && !step}
    onClick={binding?.press ?? (step ? () => binding?.step?.(1) : undefined)}>
    <CutIcon name={mark} size={PLAY_ROW.has(id) ? 15 : 13} />
  </button>
}
