// The instant your system is drawn for (T-PROCEDURAL-BODY §6 item 1). The model reads no clock: an artefact's age is read against `nowMs`, an
// input. This is the one place the clock is read, and it moves once a minute (the least a person sees an artefact drift by) so what an agent
// made drifts off the ring as it ages. It holds the last instant and nothing else; its timer is the atlas lifetime's own (src/ui/lifetime.ts
// `later`), cancelled with the atlas, and the clock and the timer are given so a test drives it with neither.
import {later as lifetimeLater, type Cancel} from '../src/ui/lifetime'

/** A minute: the tick that moves an artefact along its ring. */
export const SYSTEM_TICK_MS = 60_000

export interface SystemClockOptions {
  /** the clock, ms (default: the wall clock) */
  readonly now?: () => number
  /** a timer cancelled with the atlas (default: the atlas lifetime's `later`) */
  readonly later?: (run: () => void, ms: number) => Cancel
}

let held: number | null = null
const listeners = new Set<() => void>()

/** The instant the System is drawn for: the last tick (the wall clock's now, read once, before the clock is bound). One value between ticks. */
export const systemNow = (): number => (held ??= Date.now())

export function subscribeSystemNow(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Start the clock: the instant is the clock's now at once, then each minute. Released with the atlas; a tick already due after that moves nothing. */
export function bindSystemClock(options: SystemClockOptions = {}): {dispose(): void} {
  const now = options.now ?? Date.now
  const later = options.later ?? lifetimeLater
  let live = true
  let cancel: Cancel = () => {}
  const tick = () => {
    if (!live) return
    held = now()
    for (const listener of [...listeners]) listener()
    cancel = later(tick, SYSTEM_TICK_MS)
  }
  tick()
  return {dispose() { live = false; cancel() }}
}
