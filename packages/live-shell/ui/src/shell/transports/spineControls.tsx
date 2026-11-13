// The transport's controls over the World's time spine (moved here from shell/ModeTransportBar.tsx, whose legacy bar nothing mounted;
// parity G15): the readout types the frame publishes into the bar, the spine's own subscription, Technē's Occasion stepper (its loop
// slot) and Back to Now (its tap). The one transport (frame/transport/Transport.tsx) draws them through Technē's bindings
// (useTechneTransport.tsx); the title line reads the spine through useSpineRevision. No store, no clock: the spine is the World's.
import {useEffect, useState, type ReactNode} from 'react'
import {slotDataI, type SlotMeaning, type TransportSlotId} from '../modeGrammar'
import type {Occasion, TimeSpine} from '../../timeline/timeSpine'

/** One real reading a mode's transport may show: the owner's value and the line that says whose reading it is. */
export type ModeTransportReadout = {value: string; title: string}
export type ModeTransportReadouts = Partial<Record<TransportSlotId, ModeTransportReadout>>

/** The neighbouring retained occasion in the spine's own order (retention order, the order `occasions()` returns), wrapping:
 * `1` is the next, `-1` the previous. With no occasion selected, next is the first and previous is the last. It is reopened
 * THROUGH the spine, so an exact saved occasion keeps its snapshot basis and only the selection moves (the K8 law: reopening
 * never re-bases). Null when no occasion is retained. The spine is the World timeline's own: this is the same selection its
 * chips drive. */
export function stepOccasion(spine: TimeSpine, direction: 1 | -1 = 1): Occasion | null {
  const retained = spine.occasions()
  if (!retained.length) return null
  const current = spine.occasion()
  const index = current ? retained.findIndex(entry => entry.basis.ref === current.basis.ref) : -1
  const target = direction === 1 ? (index + 1) % retained.length : index <= 0 ? retained.length - 1 : index - 1
  const {basis} = retained[target]
  return spine.selectOccasion({
    subject_ref: basis.ref,
    instant_unix_ms: basis.instantUnixMs,
    summary: basis.summary ?? undefined,
    evidence_refs: [...basis.evidenceRefs],
    day_ref: basis.civilDayRef,
  }, basis.retainedAtUnixMs)
}

/** Re-draw when the spine moves (its own subscription; nothing here keeps a clock). */
export function useSpineRevision(spine: TimeSpine | null | undefined): void {
  const [, setRevision] = useState(0)
  useEffect(() => (spine ? spine.subscribe(() => setRevision(value => value + 1)) : undefined), [spine])
}

const admissionWord = (admitted: boolean): string => admitted ? 'admitted' : 'no longer in the reading'

/** The Occasion slot (Technē's loop slot), drawn live over the spine: `‹` and `›` step to the previous and next retained
 * occasion, and the label shows the selected occasion (its basis as first read). The two steppers and the label are the
 * one slot's parts, as the tempo slot's nudges are: they all carry the slot's own data-i. The admission is a separate
 * qualification and is named in the title, never merged into the basis. */
export function occasionStepControl(spine: TimeSpine, meaning: SlotMeaning): ReactNode {
  const retained = spine.occasions()
  const current = spine.occasion()
  const idle = retained.length === 0
  const text = current ? (current.basis.summary ?? current.basis.ref) : idle ? 'none retained' : `${retained.length} retained`
  const admission = current?.admission
    ? `current admission: ${admissionWord(current.admission.admitted)} — ${current.admission.disclosure}`
    : current ? 'current admission not yet qualified against a fresh reading' : 'no occasion selected'
  const count = `${retained.length} retained occasion${retained.length === 1 ? '' : 's'}`
  const tip = idle ? `${meaning.label} — ${meaning.fn}. No occasion is retained yet, so there is nothing to step to.` : `${meaning.label} — ${meaning.fn}. ${count}; ${admission}.`
  return <>
    <button type="button" className="native-control" data-occasion-step="previous" data-i={slotDataI(meaning)}
      aria-label={`${meaning.label}: previous occasion`} disabled={idle} title={`Previous occasion — ${tip}`}
      onClick={() => { stepOccasion(spine, -1) }}>‹</button>
    <output className="occasion-label" data-occasion-label data-i={slotDataI(meaning)} aria-label={`${meaning.label}: selected occasion`} title={tip}>
      {text.slice(0, 24)}{text.length > 24 ? '…' : ''}
    </output>
    <button type="button" className="native-control" data-occasion-step="next" data-i={slotDataI(meaning)}
      aria-label={`${meaning.label}: next occasion`} disabled={idle} title={`Next occasion — ${tip}`}
      onClick={() => { stepOccasion(spine, 1) }}>›</button>
  </>
}

/** Technē's tap slot, Back to Now, over the spine: enabled only while an occasion is selected, and its title says why it
 * is not. Clearing the selection is the spine's own `returnToNow`; retained occasions stay retained. Its face is the mode's
 * word for the slot (the mockup's `Tap`); its name stays the meaning. */
export function returnToNowControl(spine: TimeSpine, meaning: SlotMeaning): ReactNode {
  const selected = spine.occasion() !== null
  const reason = selected
    ? 'Clears the selected occasion; the Now field keeps the driving clock.'
    : 'No occasion is selected, so the transport already stands at Now.'
  return <button type="button" className="native-control" data-i={slotDataI(meaning)} aria-label={meaning.label}
    disabled={!selected} title={`${meaning.label} — ${meaning.fn}. ${reason}`}
    onClick={() => { spine.returnToNow() }}>{meaning.face ?? meaning.label}</button>
}
