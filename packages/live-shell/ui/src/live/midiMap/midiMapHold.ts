// The MIDI and Key map's session hold (T-LIVE-MIDI leg 2). Held for the session in this module, as the mode hold and the note-device hold
// are: never in browser storage, and never in the set document. The set document has no owner write for mappings, so nothing here is
// persisted with the set, and recording a mapped move as automation waits on the arrangement's automation owner.
//
// The hold owns the mode, the armed parameter, the bindings, each parameter's last owner refusal, and one notice line. Actions take the
// parameters the owner reads now (`targets`), so a click or a control is judged against what is on the surface.

import {useSyncExternalStore} from 'react'
import {
  mappableKey, keyable, planBinding, removeBinding, sameSource, shortSourceLabel, sourceLabel,
  type MapBinding, type MapMode, type MapSource, type MapTarget,
} from './midiMapModel'

export interface MidiMapState {
  readonly mode: MapMode
  /** The parameter the next control or key binds to. Null when none is armed. */
  readonly armed: string | null
  readonly bindings: readonly MapBinding[]
  /** The owner's refusal of the last write to each parameter, by parameter id. Cleared by the next accepted write. */
  readonly refusals: Readonly<Record<string, string>>
  /** One line the map shows: the mode's instruction, or the outcome of the last act. */
  readonly notice: string | null
}

const EMPTY: MidiMapState = {mode: 'off', armed: null, bindings: [], refusals: {}, notice: null}

const MODE_NOTICE: Readonly<Record<Exclude<MapMode, 'off'>, string>> = {
  midi: 'Click a parameter, then move a hardware control. Click a mapped parameter to remove it; Delete removes the armed one; Escape leaves.',
  key: 'Click a parameter, then press a key (a letter, digit or symbol; not the A–J row). A key steps a choice or flips a toggle.',
}

let state: MidiMapState = EMPTY
const listeners = new Set<() => void>()
const bindingListeners = new Set<(targetId: string) => void>()

function commit(next: Partial<MidiMapState>): void {
  state = {...state, ...next}
  for (const listener of [...listeners]) listener()
}

/** The map as it stands. */
export function midiMapState(): MidiMapState {
  return state
}

export function subscribeMidiMap(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The map as a hook: every reader re-renders on the same change. */
export function useMidiMap(): MidiMapState {
  return useSyncExternalStore(subscribeMidiMap, midiMapState, midiMapState)
}

/** Called with a parameter id whenever its binding changes (bound, replaced, moved or removed), so the router starts that parameter afresh. */
export function onBindingChanged(listener: (targetId: string) => void): () => void {
  bindingListeners.add(listener)
  return () => {
    bindingListeners.delete(listener)
  }
}

function changed(targetId: string): void {
  // A parameter whose binding changed is no longer refused by the write its old binding made: a refusal is named only while mapped.
  setMapRefusal(targetId, null)
  for (const listener of [...bindingListeners]) listener(targetId)
}

/** A session-held parameter says so where its action is named: the owner did not accept it. */
function writerNote(target: MapTarget): string {
  return target.writer === 'session' ? ' Held for this session: not an owner write.' : ''
}

/** The binding a parameter has, if any. */
export function bindingOf(targetId: string): MapBinding | undefined {
  return state.bindings.find(binding => binding.target === targetId)
}

/** Turn a map mode on or off. Leaving a mode disarms the parameter; the bindings stay for the session. */
export function setMapMode(mode: MapMode): void {
  if (mode === state.mode) return
  commit({mode, armed: null, notice: mode === 'off' ? null : MODE_NOTICE[mode]})
}

export function setMapNotice(notice: string | null): void {
  if (notice === state.notice) return
  commit({notice})
}

/** The owner's refusal of a parameter's write, named on the parameter. Null clears it (an accepted write). */
export function setMapRefusal(targetId: string, error: string | null): void {
  const current = state.refusals[targetId]
  if (error === null) {
    if (current === undefined) return
    const rest: Record<string, string> = {...state.refusals}
    delete rest[targetId]
    commit({refusals: rest})
    return
  }
  if (current === error) return
  commit({refusals: {...state.refusals, [targetId]: error}})
}

function labelOf(targets: readonly MapTarget[], id: string): string {
  return targets.find(target => target.id === id)?.label ?? id
}

/** A click on a parameter in map mode. A mapped parameter's click removes its binding; an unmapped one is armed for the next control or key.
 * A range cannot be armed for a key. Outside map mode a click is nothing here. */
export function clickMapTarget(id: string, targets: readonly MapTarget[]): void {
  if (state.mode === 'off') return
  const target = targets.find(candidate => candidate.id === id)
  if (!target) {
    commit({notice: 'That parameter is not on the surface now.'})
    return
  }
  if (bindingOf(id)) {
    removeMapping(id, targets)
    return
  }
  if (state.mode === 'key' && !keyable(target)) {
    commit({armed: null, notice: `${target.label} is a range: a key cannot step it, so it takes a hardware control (MIDI map).`})
    return
  }
  commit({armed: id, notice: `${target.label} armed: ${state.mode === 'midi' ? 'move a hardware control' : 'press a key'}.${writerNote(target)}`})
}

/** Remove a parameter's binding. An unbound parameter is a no-op. */
export function removeMapping(targetId: string, targets: readonly MapTarget[]): void {
  const binding = bindingOf(targetId)
  if (!binding) return
  commit({bindings: removeBinding(state.bindings, targetId), armed: state.armed === targetId ? null : state.armed, notice: `${labelOf(targets, targetId)} is unmapped.`})
  changed(targetId)
}

/** Delete on the armed parameter: remove its binding, if it has one. */
export function removeArmedMapping(targets: readonly MapTarget[]): void {
  if (state.armed === null) return
  if (!bindingOf(state.armed)) {
    commit({notice: `${labelOf(targets, state.armed)} has no mapping to remove.`})
    return
  }
  removeMapping(state.armed, targets)
}

/** A control or key from the input, bound to the armed parameter. The source must be the kind the mode takes; a second source on the same
 * parameter replaces the first, and the parameter stays armed. Refused by name when nothing is armed. */
export function bindArmed(source: MapSource, targets: readonly MapTarget[]): void {
  if (state.mode === 'off') return
  if (state.mode === 'midi' && source.kind !== 'cc') return
  if (state.mode === 'key' && source.kind !== 'key') return
  if (state.armed === null) {
    setMapNotice(state.mode === 'midi' ? 'Click a parameter first, then move a hardware control.' : 'Click a parameter first, then press a key.')
    return
  }
  const target = targets.find(candidate => candidate.id === state.armed)
  if (!target) {
    commit({armed: null, notice: 'The armed parameter is not on the surface now.'})
    return
  }
  if (source.kind === 'key' && !keyable(target)) {
    setMapNotice(`${target.label} is a range: a key cannot step it.`)
    return
  }
  const previous = bindingOf(target.id)
  // The same source again on the same parameter changes nothing: a knob that sends many messages does not re-render the map.
  if (previous && sameSource(previous.source, source)) return
  const plan = planBinding(state.bindings, target.id, source)
  const movedLabel = plan.moved === null ? null : labelOf(targets, plan.moved)
  const verb = previous ? 'replaced' : 'mapped'
  commit({
    bindings: plan.bindings,
    notice: `${sourceLabel(source)} ${verb} to ${target.label}${movedLabel ? ` (moved from ${movedLabel})` : ''}.${writerNote(target)}`,
  })
  changed(target.id)
  if (plan.moved !== null) changed(plan.moved)
}

/** A key press in key mode, from the input (already gated for editable text, modifiers and repeats). A key that cannot be mapped is named. */
export function pressMapKey(rawKey: string, targets: readonly MapTarget[]): void {
  const mapped = mappableKey(rawKey)
  if (!mapped.ok) {
    commit({notice: mapped.reason})
    return
  }
  bindArmed({kind: 'key', key: mapped.key}, targets)
}

/** Disarm and leave: the one exit for Escape and the toggle. */
export function leaveMapMode(): void {
  setMapMode('off')
}

/** The short chip a mapped parameter shows (`CC 74`, `key J`), or null when it has no mapping. */
export function mappingChip(targetId: string): string | null {
  const binding = bindingOf(targetId)
  return binding ? shortSourceLabel(binding.source) : null
}

/** Reset the hold to its session start. Used by tests; a session starts with no mappings and the map off. */
export function resetMidiMapHold(): void {
  state = EMPTY
  for (const listener of [...listeners]) listener()
}
