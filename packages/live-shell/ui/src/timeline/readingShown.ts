// Which of Technē's readings stand on the ruler (manual §17.1 the mixer row: "Activator shows or hides the reading", "Solo shows only
// the soloed"). The shell holds it — a reading's visibility is how the work is looked at, never a change to the reading — and the
// Technē set reads it: a hidden reading keeps its track, so its Activator can bring it back, and its events leave the ruler; with
// one soloed, only that reading's events stand. Pure, apart from the module's hold and its listeners.
import {useSyncExternalStore} from 'react'

export interface ReadingShown {
  readonly hidden: ReadonlySet<string>
  readonly soloed: string | null
}

let held: ReadingShown = {hidden: new Set(), soloed: null}
const listeners = new Set<() => void>()
const publish = (next: ReadingShown) => { held = next; for (const listener of [...listeners]) listener() }

export const readReadingShown = (): ReadingShown => held
export function subscribeReadingShown(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function useReadingShown(): ReadingShown {
  return useSyncExternalStore(subscribeReadingShown, readReadingShown, readReadingShown)
}

/** Show (on) or hide a reading's track. */
export function setReadingShown(trackId: string, on: boolean): void {
  const hidden = new Set(held.hidden)
  if (on) hidden.delete(trackId); else hidden.add(trackId)
  publish({...held, hidden})
}

/** Solo a reading's track (on), or lift its solo. */
export function setReadingSolo(trackId: string, on: boolean): void {
  publish({...held, soloed: on ? trackId : held.soloed === trackId ? null : held.soloed})
}

/** Whether a reading's events stand on the ruler. Pure. */
export function readingStands(shown: ReadingShown, trackId: string): boolean {
  if (shown.soloed !== null) return shown.soloed === trackId
  return !shown.hidden.has(trackId)
}

export function resetReadingShown(): void { publish({hidden: new Set(), soloed: null}) }
