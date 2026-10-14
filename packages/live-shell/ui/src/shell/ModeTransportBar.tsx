/**
 * The mode transport — the shell bar's fixed slots wearing a mode's meanings
 * (WORLD-SHELL-DESIGN Revision 5: one transport, five meanings).
 *
 * The SAME slot structure the Live transport draws — Link · Tap, tempo ·
 * signature, metronome · quantize, key/scale, the playback row, the
 * punch/loop row, the draw/keys/system row — re-meanied from the grammar
 * (`modeGrammar.ts`), never re-laid-out. Every control is a drawn waiting
 * state per the widget guide's law: reduced presence, and a tooltip that
 * names the function AND that it is not built here — no illuminated lie, no
 * faked reading. Where a real reading exists the caller passes it in
 * `readouts`; the slot then shows the owner's value and says so.
 *
 * Live keeps its own controls (the audio cut's), Expressions keeps the
 * native transport when the owner is attached; this component is the honest
 * body of the bar for Base·Central and Technē (and the Expressions bar
 * while no native reading stands).
 *
 * Pure presentation over the grammar: no store, no clock, no owner writes.
 */

import {useEffect, useState, type ReactNode} from 'react'
import {MODE_GRAMMAR, slotDataI, slotMeaning, type SlotMeaning, type SurfMode, type TransportSlotId} from './modeGrammar'
import {Icon as CutIcon} from '../inhabitants/sdk/Icon'
import {transportBindingForSlot, transportBindingRow} from '../inhabitants/sdk/define'
import {HOLDERS} from '../inhabitants/sdk/semantics'
import type {SdkModeName} from '../inhabitants/sdk/modes'
import type {Occasion, TimeSpine} from '../timeline/timeSpine'
import type {PaneInstrumentId} from './paneInstrument'
import './modeSurface.css'

/** One real reading a mode's transport may show: the owner's value and the
 * line that says whose reading it is. */
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
function useSpineRevision(spine: TimeSpine | null | undefined): void {
  const [, setRevision] = useState(0)
  useEffect(() => (spine ? spine.subscribe(() => setRevision(value => value + 1)) : undefined), [spine])
}

/** The Occasion slot (Technē's loop slot), drawn live over the spine: `‹` and `›` step to the previous and next retained
 * occasion, and the label shows the selected occasion (its basis as first read). The two steppers and the label are the
 * one slot's parts, as the tempo slot's nudges are: they all carry the slot's own data-i. The admission is a separate
 * qualification and is named in the title, never merged into the basis. */
function occasionStepControl(spine: TimeSpine, meaning: SlotMeaning): ReactNode {
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
 * is not. Clearing the selection is the spine's own `returnToNow`; retained occasions stay retained. */
function returnToNowControl(spine: TimeSpine, meaning: SlotMeaning): ReactNode {
  const selected = spine.occasion() !== null
  const reason = selected
    ? 'Clears the selected occasion; the Now field keeps the driving clock.'
    : 'No occasion is selected, so the transport already stands at Now.'
  return <button type="button" className="native-control" data-i={slotDataI(meaning)} aria-label={meaning.label}
    disabled={!selected} title={`${meaning.label} — ${meaning.fn}. ${reason}`}
    onClick={() => { spine.returnToNow() }}>{meaning.label}</button>
}

/** Technē's arm slot, Instrument writes. No instrument write gate stands in the shell: `shell.setWriteArm` is the AGENT's
 * write arm (agent writes land as proposals or directly), not an instrument's, so arming it would be a fake toggle. The slot
 * shows the focused instrument's name and waits; its title names the missing writer owner. */
function instrumentArmControl(meaning: SlotMeaning, focused: PaneInstrumentId | null | undefined): ReactNode {
  const name = focused ? (HOLDERS.find(holder => holder.id === focused)?.title ?? focused) : null
  const line = name
    ? `Focused: ${name}. No instrument write gate is built in the shell: the write arm belongs to the agent, not to the instrument. The Quaternal Logic family holds the lens instruments and declares no instrument writer yet, so this waits for that owner.`
    : 'No instrument is focused, so there is no lens whose writes to arm. Focus a lens pane to name its instrument.'
  return <button type="button" className="native-control" disabled data-i={slotDataI(meaning)} aria-label={meaning.label}
    aria-disabled="true" title={`${meaning.label} — ${meaning.fn}. ${line}`}>
    <CutIcon name="arm" size={14} />{name ? <span> {name}</span> : null}
  </button>
}

function admissionWord(admitted: boolean): string {
  return admitted ? 'admitted' : 'no longer in the reading'
}

export function ModeTransportBar({mode, readouts, timeSpine, focusedInstrument}: {mode: SurfMode; readouts?: ModeTransportReadouts; timeSpine?: TimeSpine | null; focusedInstrument?: PaneInstrumentId | null}) {
  const grammar = MODE_GRAMMAR[mode]
  useSpineRevision(timeSpine)
  const meaning = (id: TransportSlotId) => slotMeaning(mode, id)
  // Techne's loop slot is the Occasion (its grammar meaning: the saved occasion keeps its snapshot and separately
  // qualifies its admission). With the spine held it steps the occasion; without one it stays the drawn waiting state.
  const occasionStep = mode === 'techne' && timeSpine ? occasionStepControl(timeSpine, meaning('loop')) : null
  // Techne's tap is Back to Now over the same spine; its arm names the focused instrument and waits for the writer.
  const tapSlot = mode === 'techne' && timeSpine ? returnToNowControl(timeSpine, meaning('tap')) : null
  const armSlot = mode === 'techne' ? instrumentArmControl(meaning('arm'), focusedInstrument) : null
  // The spine's loop brace, read-only when the spine holds one (its clip ids; nothing sets it yet, so it stays "—" until a writer does).
  const braceClips = mode === 'techne' && timeSpine ? timeSpine.transport().loopClipIds : null
  const dataI = (id: TransportSlotId) => ({'data-i': slotDataI(meaning(id))})
  // The ligaments' honesty at the slot grain: a slot a family has BOUND to
  // a §14 row names that binding in its waiting line (the owner op and its
  // standing), instead of the generic waiting note. Unbound slots keep the
  // designed waiting state verbatim.
  const boundLine = (id: TransportSlotId): string | null => {
    const binding = transportBindingForSlot(mode as SdkModeName, id)
    if (!binding) return null
    const row = transportBindingRow(binding)
    const op = row?.writePath ?? row?.disclosure ?? 'its owner operation'
    return `${meaning(id).label} — ${meaning(id).fn}. Bound by the ${binding.family} family to ${binding.face}/${binding.key} (owner op: ${op}); the control waits for its owner's wiring.`
  }
  const waiting = (id: TransportSlotId) => {
    const bound = boundLine(id)
    if (bound) return bound
    const slot = meaning(id)
    return `${slot.label} — ${slot.fn}. Not wired here yet: ${grammar.waitingNote}`
  }
  const hold = (id: TransportSlotId) => ({...dataI(id), title: waiting(id), 'aria-label': meaning(id).label, 'aria-disabled': true} as const)
  const readoutTitle = (id: TransportSlotId, fallbackTitle?: string): string =>
    boundLine(id) ?? readouts?.[id]?.title ?? fallbackTitle ?? waiting(id)
  const readout = (id: TransportSlotId, fallbackTitle?: string): ModeTransportReadout =>
    readouts?.[id] ?? {value: '—', title: readoutTitle(id, fallbackTitle)}
  const windowSpan: ModeTransportReadout = braceClips?.length
    ? {value: `${braceClips.length} clip${braceClips.length === 1 ? '' : 's'}`, title: `${meaning('loop-length').label} — ${meaning('loop-length').fn}. The spine holds this window read-only: ${braceClips.length} clip${braceClips.length === 1 ? '' : 's'} in the loop brace.`}
    : readout('loop-length')

  return <div className="mode-transport" data-mode-transport={mode} role="group" aria-label={`${grammar.title} transport`}>
    <div className="transport-group">
      <button type="button" className="native-control" disabled {...hold('link')}>{meaning('link').label}</button>
      {tapSlot ?? <button type="button" className="native-control" disabled {...hold('tap')}>{meaning('tap').label}</button>}
    </div>
    <div className="transport-group transport-tempo">
      <output className="tempo-field" {...dataI('tempo')} title={waiting('tempo')} aria-label={meaning('tempo').label}>{readout('tempo').value}</output>
      <button type="button" className="native-control" disabled {...hold('tempo')}>‹</button>
      <button type="button" className="native-control" disabled {...hold('tempo')}>›</button>
      <output className="meter-field" {...dataI('signature')} title={waiting('signature')} aria-label={meaning('signature').label}>{readout('signature').value}</output>
      <button type="button" className="native-control" disabled {...hold('metro')}><CutIcon name="metro" size={14} /></button>
      <button type="button" className="native-control" disabled {...hold('quantize')}>{meaning('quantize').label}</button>
    </div>
    <div className="transport-scale">
      <button type="button" className="native-control" disabled {...hold('key')}>♯</button>
      <output className="meter-field" {...dataI('root')} title={waiting('root')} aria-label={meaning('root').label}>{readout('root').value}</output>
      <output className="meter-field" {...dataI('scale')} title={waiting('scale')} aria-label={meaning('scale').label}>{readout('scale').value}</output>
    </div>
    <div className="transport-spacer" />
    <div className="transport-group transport-playback">
      <button type="button" className="native-control" disabled {...hold('follow')}><CutIcon name="follow" size={14} /></button>
      <output className="position-field" {...dataI('position')} title={readout('position').title} aria-label={meaning('position').label}>{readout('position').value}</output>
      <button type="button" className="native-control transport-btn transport-play" disabled {...hold('play')} aria-label={meaning('play').label}><CutIcon name="play" size={15} /></button>
      <button type="button" className="native-control transport-btn" disabled {...hold('stop')} aria-label={meaning('stop').label}><CutIcon name="stop" size={15} /></button>
      <button type="button" className="native-control transport-btn transport-record" disabled {...hold('record')} aria-label={meaning('record').label}><CutIcon name="rec" size={15} /></button>
      <button type="button" className="native-control" disabled {...hold('overdub')}><CutIcon name="plus" size={13} /></button>
      {armSlot ?? <button type="button" className="native-control" disabled {...hold('arm')}><CutIcon name="arm" size={14} /></button>}
      <button type="button" className="native-control" disabled {...hold('re-enable')}><CutIcon name="back" size={14} /></button>
      <button type="button" className="native-control" disabled {...hold('capture')}><CutIcon name="cap" size={14} /></button>
    </div>
    <div className="transport-loop transport-group">
      <output className="position-field" {...dataI('punch-in')} title={waiting('punch-in')} aria-label={meaning('punch-in').label}>{readout('punch-in').value}</output>
      <button type="button" className="native-control" disabled {...hold('punch-in')}><CutIcon name="punchIn" size={14} /></button>
      {occasionStep ?? <button type="button" className="native-control" disabled {...hold('loop')}><CutIcon name="loop" size={13} /></button>}
      <button type="button" className="native-control" disabled {...hold('punch-out')}><CutIcon name="punchOut" size={14} /></button>
      <output className="position-field" {...dataI('loop-length')} title={windowSpan.title} aria-label={meaning('loop-length').label}>{windowSpan.value}</output>
    </div>
    <div className="transport-spacer" />
    <div className="transport-system">
      <button type="button" className="native-control" disabled {...hold('draw')}><CutIcon name="draw" size={14} /></button>
      <button type="button" className="native-control" disabled {...hold('keys')}><CutIcon name="keys" size={14} /></button>
      <button type="button" className="native-control" disabled {...hold('key-map')}>{meaning('key-map').label}</button>
      <button type="button" className="native-control" disabled {...hold('midi-map')}>{meaning('midi-map').label}</button>
      <output {...dataI('rate')} title={readout('rate').title} aria-label={meaning('rate').label}>{readout('rate').value}</output>
      <output {...dataI('cpu')} title={readout('cpu').title} aria-label={meaning('cpu').label}>{readout('cpu').value}</output>
      <span className="cpu-meter" />
    </div>
  </div>
}
