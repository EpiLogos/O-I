import {useSyncExternalStore} from 'react'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import type {BeltEntry, NativeEditorChange, NativeEditorReading} from '../../../../expressions-boundary/src/editor'
import {sharedFieldBinding, sharedSettingChange} from '../../../../expressions-boundary/src/nativeSharedSettings'

/** Pin mode: Ableton's Key-map slot. While it is on, every parameter control shows a pin affordance. A pin is one admitted chosen-control
 * change (plus, for a shared Field pin, the existing shared-setting change in the same transaction). Nothing here is a store of pins:
 * the document's chosen controls are. The only state kept is the mode itself, a shell presentation toggle. */
export type PinDestination = 'field' | 'follow' | 'bind'
export interface PinState {active: boolean; destination: PinDestination; shared: boolean}
const DEFAULT: PinState = {active: false, destination: 'field', shared: false}
let state: PinState = DEFAULT
const listeners = new Set<() => void>()
export const readPinMode = (): PinState => state
export function setPinMode(next: Partial<PinState>): void {
  const merged = {...state, ...next}
  if (merged.active === state.active && merged.destination === state.destination && merged.shared === state.shared) return
  state = merged
  for (const listener of [...listeners]) listener()
}
export function subscribePinMode(listener: () => void): () => void {listeners.add(listener); return () => {listeners.delete(listener)}}
export const usePinMode = (): PinState => useSyncExternalStore(subscribePinMode, readPinMode, () => DEFAULT)

/** The control a pin affordance sits on: a Field parameter (by registry path) or an object parameter (by entity and key). */
export type PinControl = {kind: 'field'; path: string} | {kind: 'entity'; entityId: string; key: string}
export type PinPlan = {ok: true; verb: 'pin' | 'unpin'; changes: NativeEditorChange[]; note: string | null} | {ok: false; reason: string}

const fieldKey = (path: string) => NATIVE_BINDINGS.find(binding => binding.path === path)?.key

/** The chosen entry that already pins this control, if any. Follow matches the selected object; Bind matches its entity. */
export function pinnedEntry(reading: NativeEditorReading, control: PinControl): BeltEntry | undefined {
  const entries = reading.chosenControls.entries
  if (control.kind === 'field') {const key = fieldKey(control.path); return key === undefined ? undefined : entries.find(entry => entry.scope === 'field' && entry.key === key)}
  const selected = reading.selection.entity_ids[0]
  return entries.find(entry => entry.key === control.key && (entry.scope === 'named' ? entry.entityId === control.entityId : entry.scope === 'selected' && selected === control.entityId))
}

/** A pinned Field control's scope mark: shared across the Expression's Scenes, or local to this Scene. Null for anything that cannot be shared. */
export function pinScopeMark(reading: NativeEditorReading, control: PinControl): 'shared' | 'local' | null {
  if (control.kind !== 'field') return null
  const key = fieldKey(control.path)
  if (key === undefined || !sharedFieldBinding('field.' + key)) return null
  return reading.sharedTargets?.includes('field.' + key) ? 'shared' : 'local'
}

/** The shared-setting change that flips a Field control between Expression-shared and Scene-local, or null when it cannot be shared. */
export function scopeFlipChange(reading: NativeEditorReading, control: PinControl): NativeEditorChange | null {
  if (control.kind !== 'field') return null
  const key = fieldKey(control.path), target = key === undefined ? undefined : 'field.' + key
  if (!target || !sharedFieldBinding(target)) return null
  return sharedSettingChange(target, reading.sharedTargets?.includes(target) !== true)
}

/** What one pin click sends. `invertShared` is the modifier key: it flips Expression-shared versus Scene-local for this pin only. */
export function planPin(reading: NativeEditorReading, control: PinControl, mode: Pick<PinState, 'destination' | 'shared'>, invertShared = false): PinPlan {
  const existing = pinnedEntry(reading, control)
  if (existing) return {ok: true, verb: 'unpin', changes: [{kind: 'chosen-remove', entry_id: existing.id}], note: null}
  if (control.kind === 'field') {
    const key = fieldKey(control.path)
    if (key === undefined) return {ok: false, reason: 'This parameter has no native definition to pin.'}
    const changes: NativeEditorChange[] = [{kind: 'chosen-add', key, scope: 'field'}]
    const target = 'field.' + key, shareable = !!sharedFieldBinding(target)
    const wantShared = mode.shared !== invertShared, isShared = reading.sharedTargets?.includes(target) === true
    // The shared-setting change belongs to the same one undo step as the pin, and is sent only when it would change something.
    if (shareable && wantShared !== isShared) changes.push(sharedSettingChange(target, wantShared))
    return {ok: true, verb: 'pin', changes, note: wantShared && !shareable ? 'This parameter cannot be shared, so the pin is local to this Scene.' : null}
  }
  const selected = reading.selection.entity_ids[0]
  // Field is the chip's resting choice; an object control then Follows, because Follow needs no further decision.
  const destination = mode.destination === 'bind' ? 'bind' : 'follow'
  if (destination === 'follow') {
    if (selected !== control.entityId) return {ok: false, reason: 'Select this object to Follow it, or choose Bind to pin it by name.'}
    return {ok: true, verb: 'pin', changes: [{kind: 'chosen-add', key: control.key, scope: 'selected'}], note: null}
  }
  return {ok: true, verb: 'pin', changes: [{kind: 'chosen-add', key: control.key, scope: 'named', entity_id: control.entityId}], note: null}
}
