// The map's router (T-LIVE-MIDI leg 2): one control change or key press, to one parameter's write. Outside map mode only; in a map mode the
// input arms and binds, and moves nothing.
//
// A fast knob is not a flood of owner edits. Control changes are coalesced to the latest value per parameter per frame (the scheduler is
// the animation frame), and a parameter is sent only when its mapped value has changed since the last send, and differs from the owner's
// current reading: a knob that holds still sends nothing, and a knob already at the owner's value sends nothing. A key step is one press,
// sent at once, from the newest value the owner has (its last accepted write, unless the owner's reading has since moved).
//
// A refused write is named on its parameter and clears what was sent, so the next control at the same value tries again. A refusal is
// named only while its parameter is mapped; an accepted write clears it. Pure of the store: the reads, the write and the refusal record are
// injected (midiMapControls.tsx wires the live ones).

import type {StageResult} from '@epilogos/expressions-boundary'
import {controlValue, controlsReach, keyStepValue, routeCc, routeKey, type MapBinding, type MapMode, type MapTarget, type MapValue} from './midiMapModel'

export interface MapRouterControl {
  readonly port: string
  readonly channel: number
  readonly controller: number
  readonly value: number
}

export interface MapRouterDeps {
  /** The map's mode and bindings now. */
  readonly read: () => {readonly mode: MapMode; readonly bindings: readonly MapBinding[]}
  /** The parameters as the owner reads them now. */
  readonly targets: () => readonly MapTarget[]
  /** One value into one parameter's write. */
  readonly apply: (target: MapTarget, value: MapValue) => Promise<StageResult>
  /** A parameter's refusal (the owner's reason), or null when its write was accepted or it is no longer mapped. */
  readonly refusal: (targetId: string, error: string | null) => void
  /** Runs `run` at the next frame. Defaults to requestAnimationFrame, or a timer where there is none. */
  readonly schedule?: (run: () => void) => void
}

export interface MapRouter {
  /** Control changes from the host, in arrival order. Outside map mode, each bound parameter takes its latest value at the next frame. */
  control(controls: readonly MapRouterControl[]): void
  /** A key press, lower case. Outside map mode, each parameter bound to the key steps once. Returns whether any binding took the key. */
  key(key: string): boolean
  /** A parameter's binding changed: its last value is forgotten, so its next control or key is sent afresh. */
  forget(targetId: string): void
  /** The owner published a reading. An accepted value the reading has since moved past is no longer the newest word on its parameter. */
  reading(): void
}

const defaultSchedule = (run: () => void): void => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => run())
  else setTimeout(run, 16)
}

export function createMapRouter(deps: MapRouterDeps): MapRouter {
  const schedule = deps.schedule ?? defaultSchedule
  // The latest mapped value per parameter, waiting for the frame.
  const pending = new Map<string, MapValue>()
  // The last value sent per parameter (or the owner's own value, when a send was skipped because the owner already states it).
  const sent = new Map<string, MapValue>()
  // Parameters with a write in flight: a key step starts from what was sent, not from the owner's older reading.
  const inFlight = new Set<string>()
  // The last value the owner accepted per parameter, with the owner's reading at that moment. While the reading has not moved, the accepted
  // value is the newer word (the publish has not caught up); once it moves, the reading is.
  const accepted = new Map<string, {readonly value: MapValue; readonly reading: MapValue | null}>()
  let scheduled = false

  const readingOf = (id: string): MapValue | null => deps.targets().find(candidate => candidate.id === id)?.current ?? null

  const send = (target: MapTarget, value: MapValue): void => {
    sent.set(target.id, value)
    inFlight.add(target.id)
    const settle = (result: StageResult | null, cause?: unknown) => {
      inFlight.delete(target.id)
      if (result !== null && result.ok) {
        accepted.set(target.id, {value, reading: readingOf(target.id)})
        deps.refusal(target.id, null)
        return
      }
      sent.delete(target.id)
      accepted.delete(target.id)
      const reason = result !== null ? result.error : cause instanceof Error ? cause.message : String(cause)
      // A parameter unmapped while its write was in flight shows no refusal: the refusal is named only while it is mapped.
      const mapped = deps.read().bindings.some(binding => binding.target === target.id)
      deps.refusal(target.id, mapped ? reason : null)
    }
    void deps.apply(target, value).then(result => settle(result), cause => settle(null, cause))
  }

  const flush = (): void => {
    scheduled = false
    const targets = deps.targets()
    for (const [id, value] of [...pending]) {
      pending.delete(id)
      const target = targets.find(candidate => candidate.id === id)
      if (!target) continue
      if (sent.has(id) && sent.get(id) === value) continue
      // The owner already states this value: nothing to send. Remember it as the last value, so a later change back is sent.
      if (!inFlight.has(id) && target.current !== null && target.current === value) {
        sent.set(id, value)
        continue
      }
      send(target, value)
    }
  }

  return {
    control(controls) {
      const {mode, bindings} = deps.read()
      // Dropped before any per-frame work when no control can reach anything: the map is off and no binding listens for a control.
      if (mode !== 'off' || controls.length === 0 || !controlsReach(mode, bindings)) return
      const targets = deps.targets()
      for (const control of controls) {
        for (const binding of routeCc(bindings, control)) {
          const target = targets.find(candidate => candidate.id === binding.target)
          if (!target) continue
          // The latest value wins: a knob moved three times in one frame is one owner edit.
          pending.set(target.id, controlValue(target, control.value))
        }
      }
      if (pending.size > 0 && !scheduled) {
        scheduled = true
        schedule(flush)
      }
    },

    key(key) {
      const {mode, bindings} = deps.read()
      if (mode !== 'off') return false
      const hits = routeKey(bindings, key)
      if (hits.length === 0) return false
      const targets = deps.targets()
      for (const hit of hits) {
        const target = targets.find(candidate => candidate.id === hit.target)
        if (!target) continue
        const record = accepted.get(target.id)
        let base: MapValue | null
        if (inFlight.has(target.id)) base = sent.get(target.id) ?? null
        else if (record !== undefined && target.current === record.reading) base = record.value
        else base = target.current
        const next = keyStepValue(target, base)
        if (next === null) continue
        send(target, next)
      }
      return true
    },

    forget(targetId) {
      sent.delete(targetId)
      pending.delete(targetId)
      accepted.delete(targetId)
    },

    reading() {
      if (accepted.size === 0) return
      const targets = deps.targets()
      for (const [id, record] of [...accepted]) {
        const target = targets.find(candidate => candidate.id === id)
        if (!target || target.current !== record.reading) accepted.delete(id)
      }
    },
  }
}
