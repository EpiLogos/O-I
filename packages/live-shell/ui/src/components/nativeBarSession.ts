import type {StageCommand, StageResult} from '@epilogos/expressions-boundary'
import {STAGE_LIVE_RELEASE, stageLiveHold, stageLiveSet} from '../native/stageCommands'

/** How a bar value gesture reaches the owner and the frame. live streams a transient value while a drag moves (no document write),
 * commit is the one released gesture, cancel restores. The bar never writes a document itself. */
export interface BarValueSession {
  live: (value: number) => void
  commit: (value: number) => Promise<boolean>
  cancel: () => void
}

export type LiveRun = (command: StageCommand) => Promise<StageResult>
export interface LiveSessionDeps {
  /** The frame's stage runner, or null when no Expressions application is mounted. */
  run: LiveRun | null
  /** The one committed write through the shared editor path (one native history entry). Resolves true when the owner acknowledged it. */
  apply: (value: number) => Promise<boolean>
  /** An enabled automation lane drives this parameter: a gesture holds the value in the frame instead of writing a document. */
  automated: boolean
}
export interface LiveSessionClock {
  now: () => number
  after: (ms: number, run: () => void) => unknown
  clear: (handle: unknown) => void
}
/** About 20 Hz: the rate the property take samples at. */
export const LIVE_INTERVAL_MS = 50
const REAL_CLOCK: LiveSessionClock = {now: () => performance.now(), after: (ms, run) => setTimeout(run, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>)}

/** One parameter's gesture controller. `deps` is read at each call, so a re-render that changes the runner or the automation reading never
 * strands a gesture. Order on commit is fixed: the final value is streamed, the write (or hold) settles, then the override is released, so the
 * engine never shows the stale base between the last frame and the document. What the engine last showed is what the document receives. */
export interface LivePoint {target: string; value: number}
/** One gesture value maps to one or more live targets: a plain parameter streams itself; a rack macro streams each parameter it drives. */
export type LiveTargets = string | ((value: number) => readonly LivePoint[])
export function createLiveSession(targets: LiveTargets, deps: () => LiveSessionDeps, clock: LiveSessionClock = REAL_CLOCK, interval = LIVE_INTERVAL_MS): BarValueSession {
  const points = (value: number): readonly LivePoint[] => typeof targets === 'string' ? [{target: targets, value}] : targets(value)
  let streamed = false, lastSent: number | null = null, lastAt = -Infinity, pending: number | null = null, timer: unknown = null
  const quiet = (answer: Promise<StageResult> | undefined) => {void answer?.catch(() => {})}
  const send = (value: number) => {
    const {run} = deps()
    if (!run) return
    pending = null; lastSent = value; lastAt = clock.now(); streamed = true
    for (const point of points(value)) {
      try {quiet(run(stageLiveSet(point.target, point.value)))} catch {/* a refused frame leaves the document untouched */}
    }
  }
  const stopTimer = () => {if (timer !== null) {clock.clear(timer); timer = null}}
  const release = async () => {
    const {run} = deps()
    if (!run || !streamed) return
    streamed = false; lastSent = null
    try {await run(STAGE_LIVE_RELEASE)} catch {/* the frame also clears on a Scene change */}
  }
  return {
    live(value) {
      pending = value
      const wait = interval - (clock.now() - lastAt)
      if (wait <= 0) {stopTimer(); send(value); return}
      if (timer === null) timer = clock.after(wait, () => {timer = null; if (pending !== null) send(pending)})
    },
    async commit(value) {
      stopTimer(); pending = null
      const {run, apply, automated} = deps()
      if (run && lastSent !== value) send(value)
      // Holding a manual value is a single-parameter takeover; a macro commits through the rack path, which keeps the automation clocks.
      if (run && automated && typeof targets === 'string') {
        try {
          const held = await run(stageLiveHold(targets, value))
          // A hold moves the drag override into the frame's hold set; a refusal leaves the override to be released.
          if (held.ok) {streamed = false; lastSent = null} else await release()
          return held.ok
        } catch {await release(); return false}
      }
      const ok = await apply(value).catch(() => false)
      await release()
      return ok
    },
    cancel() {
      stopTimer(); pending = null
      void release()
    },
  }
}
