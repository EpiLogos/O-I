import {useEffect, useState, type MouseEvent} from 'react'
import type {NativeEditorChange, NativeEditorReading, NativeEditorReply} from '../../../../expressions-boundary/src/editor'
import {pinnedEntry, pinScopeMark, planPin, setPinMode, usePinMode, type PinControl, type PinDestination} from './nativePinMode'
import './NativePinControls.css'

const reasonOf = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
type PinApply = (changes: readonly NativeEditorChange[]) => Promise<NativeEditorReply>

/** The bar's Map slot (Ableton's Key map): turns Pin mode on. While on, every parameter control shows a pin; the chips choose where a pin goes
 * and whether a Field pin is shared across the Expression or local to this Scene. Alt-click on a pin flips the scope for that pin only. */
export function PinModeToggle() {
  const mode = usePinMode()
  useEffect(() => {
    if (!mode.active) return
    const onKey = (event: KeyboardEvent) => {
      const field = document.activeElement instanceof HTMLElement && document.activeElement.closest('input,textarea,select,[contenteditable="true"]')
      if (event.key === 'Escape' && !field) setPinMode({active: false})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode.active])
  const destinations: readonly {value: PinDestination; label: string; title: string}[] = [
    {value: 'field', label: 'Field', title: 'Field parameters pin to the bar. Object parameters Follow the selected object.'},
    {value: 'follow', label: 'Follow', title: 'Pin an object parameter so it follows whichever object is selected.'},
    {value: 'bind', label: 'Bind', title: 'Pin an object parameter to that one object by name.'},
  ]
  return <div className="bar-pin-mode" role="group" aria-label="Pin controls">
    <button type="button" className="bar-pin-toggle" aria-pressed={mode.active} title="Pin mode: every parameter shows a pin. Pin it to the bar (Field), or to the rack (Follow or Bind). Escape leaves the mode."
      onClick={() => setPinMode({active: !mode.active})}>Map</button>
    {mode.active && <>
      <span className="bar-pin-chip" role="radiogroup" aria-label="Pin destination">
        {destinations.map(item => <button key={item.value} type="button" role="radio" aria-checked={mode.destination === item.value} title={item.title}
          onClick={() => setPinMode({destination: item.value})}>{item.label}</button>)}</span>
      <button type="button" className="bar-pin-scope" aria-pressed={mode.shared} title={mode.shared ? 'New Field pins are shared across the Expression’s Scenes. Alt-click a pin for a local one.' : 'New Field pins are local to this Scene. Alt-click a pin to share it across the Expression.'}
        onClick={() => setPinMode({shared: !mode.shared})}>{mode.shared ? 'Shared' : 'Local'}</button>
    </>}
  </div>
}

/** The pin on one parameter control. Absent unless Pin mode is on. One click is one admitted change transaction (one undo step). */
export function PinAffordance({reading, control, apply, label}: {reading: NativeEditorReading; control: PinControl; apply: PinApply; label: string}) {
  const mode = usePinMode()
  const [fault, setFault] = useState<string | null>(null), [busy, setBusy] = useState(false)
  if (!mode.active) return null
  const pinned = pinnedEntry(reading, control) !== undefined, mark = pinScopeMark(reading, control)
  const click = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); event.stopPropagation()
    const plan = planPin(reading, control, mode, event.altKey)
    if (!plan.ok) {setFault(plan.reason); return}
    setFault(plan.note); setBusy(true)
    void apply(plan.changes).then(reply => {if (!reply.ok) setFault(reply.error)}, cause => setFault(reasonOf(cause))).finally(() => setBusy(false))
  }
  return <span className="pin-affordance">
    <button type="button" className="pin-button" aria-label={`${pinned ? 'Unpin' : 'Pin'} ${label}`} aria-pressed={pinned} disabled={busy || reading.standing.pending}
      title={pinned ? `${label} is pinned. Click to unpin it.` : `Pin ${label}. Alt-click flips Shared and Local for this pin.`} onClick={click}>{pinned ? '★' : '☆'}</button>
    {pinned && mark && <span className="pin-scope" title={mark === 'shared' ? 'Shared across the Expression’s Scenes' : 'Local to this Scene'}>{mark === 'shared' ? 'S' : 'L'}</span>}
    {fault && <small role="alert" className="pin-fault">{fault}</small>}
  </span>
}
