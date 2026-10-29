// The window's keys (FOUNDATION F9; manual §10.8): "Play or stop — Space. Launch a row — its number key. Turn a macro — its
// letter key. Stop — Esc. Search — ⌘F." and "Keys never play notes while you are typing in a document." Mounted once in the
// App. It listens on the window, asks the pure map what a press means (keyMap.ts), plans it against the doors the owners
// publish (planKey.ts, keyDoors.ts), and presses the control's own door — so a key does what its control does, and is enabled
// only when that control is. It knows no mode.
//
// Established handlers keep their keys. A press is left alone when an earlier handler already took it (defaultPrevented),
// when the focused element is typing or takes its own keys (keyMap.ts `suppressed`), and — for Escape — while a modal, a menu or
// a `data-claims-keys="escape"` state is open. ⌘F has a browser default and is claimed at once; every other key (Space too)
// waits one task, so a handler registered after this one (the Earth's Escape, the Expressions bar's Space) has its say first
// and is not doubled.
import {useEffect, useRef, useState} from 'react'
import {openInstrument} from '../instrumentDoor'
import {DEVICE_PANE_KIND} from '../devices/devicePane'
import {publishedDevice, selectedDeviceId} from '../devices/deviceDoor'
import {browserSearchAvailable, openableNow, requestBrowserSearch, trackRows, transportKeys, type Openable} from './keyDoors'
import {captureFocus, openSearchLine, searchLineAvailable} from '../../central/searchLineDoor'
import {claimsAtOnce, escapeClaimed, intentOfKey, isTyping, suppressed, type DocumentLike, type ElementLike, type KeyLike} from './keyMap'
import {planKey, type KeyDoors, type KeyOptions, type KeyReceipt} from './planKey'
import './keys.css'

const selectedDevice = () => {
  const id = selectedDeviceId()
  const held = id ? publishedDevice(id) : undefined
  return id && held ? {id, device: held.device} : null
}

/** The device selected on a chain opens full size in a pane, as its plate's pane button does. */
const selectedDeviceOpenable = (): Openable | null => {
  const held = selectedDevice()
  return held && {label: held.device.face.title, open: at => openInstrument(DEVICE_PANE_KIND, at, {ref: held.id, title: held.device.face.title})}
}

/** The doors as the frame has them: the owners' published entries and the doors that already exist. */
export const frameKeyDoors: KeyDoors = {
  transport: transportKeys,
  rows: trackRows,
  device: () => selectedDevice()?.device ?? null,
  openable: () => openableNow() ?? selectedDeviceOpenable(),
  searchAvailable: browserSearchAvailable,
  search: requestBrowserSearch,
  // ⌘K: the search line over the frame (§18.4), as Quick Open stands over the window; Esc puts the focus back (captureFocus).
  lineAvailable: searchLineAvailable,
  line: () => { openSearchLine({door: 'frame', restore: typeof document === 'undefined' ? null : captureFocus()}) },
}

export interface FrameKeysOptions extends KeyOptions {
  /** Hold every key (a full-surface modal is presented). */
  paused?: boolean
}

/** What a keydown event is to this layer. */
export interface KeyEventLike extends KeyLike {
  target: unknown
  defaultPrevented: boolean
  preventDefault(): void
}

/** Run a task after the handlers of this event have all run. */
const afterHandlers = (task: () => void): void => { setTimeout(task, 0) }

/** One keydown, end to end. True when a press was made (or is waiting its turn). Exported for the tests; the hook is its only
 * caller in the app. */
export function handleKey(
  event: KeyEventLike, doors: KeyDoors, options: FrameKeysOptions, show: (receipt: KeyReceipt) => void,
  doc: DocumentLike, settle: (task: () => void) => void = afterHandlers,
): boolean {
  // Backspace is never Back. WebKit (the native candidate) steps the page back on a Backspace no element takes, and the shell's
  // history is its encounters (projections/encounterLink.ts): a Delete pressed on a selection that held no focus walked the person
  // out of where they stood (r20). Held here unless it is typed or a handler took it; the shell's Back is its own control.
  if (event.key === 'Backspace' && !event.defaultPrevented && !isTyping(event.target as ElementLike | null)) event.preventDefault()
  if (options.paused || event.defaultPrevented) return false
  const intent = intentOfKey(event)
  if (!intent || suppressed(intent, event.target as ElementLike | null)) return false
  // Escape closes what is open first. Asked now, while it is still open: the handler that closes it may have gone by the time this waits.
  if (intent.id === 'stop' && escapeClaimed(doc)) return false
  const plan = planKey(intent, doors, options)
  if (!plan) return false
  const press = () => {
    try {
      void Promise.resolve(plan.run()).then(receipt => { if (receipt) show(receipt) }, cause => show({ok: false, what: 'Key', text: cause instanceof Error ? cause.message : String(cause)}))
    } catch (cause) { show({ok: false, what: 'Key', text: cause instanceof Error ? cause.message : String(cause)}) }
  }
  if (claimsAtOnce(intent)) {
    event.preventDefault()
    press()
  } else {
    settle(() => { if (!event.defaultPrevented) press() })
  }
  return true
}

/** The keys of the window, and the owner's last answer to one of them. */
export function useFrameKeys(options: FrameKeysOptions = {}, doors: KeyDoors = frameKeyDoors): {receipt: KeyReceipt | null; dismiss: () => void} {
  const latest = useRef(options)
  latest.current = options
  const [receipt, setReceipt] = useState<KeyReceipt | null>(null)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { handleKey(event, doors, latest.current, setReceipt, document) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [doors])
  return {receipt, dismiss: () => setReceipt(null)}
}

/** The owner's answer to a key, in its words, with the press it answers. */
export function KeyReceiptLine({receipt, onDismiss}: {receipt: KeyReceipt; onDismiss: () => void}) {
  return <p className="frame-keys-receipt" role="status" data-ok={receipt.ok}>
    <b>{receipt.what}</b>
    <span>{receipt.text}</span>
    <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
  </p>
}

/** Mount once in the App. It draws nothing until the owner answers a key in words (a refusal, a launch's note). */
export function FrameKeys(options: FrameKeysOptions) {
  const {receipt, dismiss} = useFrameKeys(options)
  return receipt ? <KeyReceiptLine receipt={receipt} onDismiss={dismiss} /> : null
}
