// The one door an instrument opens through (FOUNDATION F2): the pane tree that is mounted publishes how it opens a pane
// kind — in a given pane, on one of its edges, or in the focused pane — and the browser's Instruments rows call it. A stage
// lens (Canvas, Timeline, Journey, Palace) goes through the same door: its payload names the stage and the lens, the door
// opens the stage where it was asked for and then turns it, so a double-click and a drop into a pane do the same thing.
import {useSyncExternalStore} from 'react'
import type {PaneEdge} from '../../../../../desktop/cradle/src/surface/types'
import {parseInstrumentPayload} from './instruments'

export type InstrumentOpener = (kind: string, at?: {groupId: string; edge: PaneEdge | null}, subject?: {ref: string; title: string}) => void

let opener: InstrumentOpener | null = null

export function publishInstrumentOpener(next: InstrumentOpener | null): void {
  opener = next
}

/** Open an instrument: in the named pane (or on its edge), else in the focused pane. `payload` is a pane kind, or a stage
 * lens's payload (`kind#lens`, instruments.ts), in which case the stage is turned to the lens once it is open. Refuses when no
 * pane tree is mounted; a lens the owner refuses is said through the fault line (reportInstrumentFault). */
export function openInstrument(payload: string, at?: {groupId: string; edge: PaneEdge | null}, subject?: {ref: string; title: string}): void {
  if (!opener) throw Error('No pane tree is mounted to open the instrument in')
  const {kind, lens} = parseInstrumentPayload(payload)
  opener(kind, at, subject)
  if (lens) driveStageLens(lens, reportInstrumentFault)
}

// ── the fault line ────────────────────────────────────────────────────────
// A refusal arrives from wherever the instrument was opened — the row's own open, or a drop into a pane that the browser
// never sees. It is said in one place, the Instruments section, in the owner's words.
let fault: string | null = null
const faultListeners = new Set<() => void>()

/** Say a refusal (or, with null, clear it). */
export function reportInstrumentFault(reason: string | null): void {
  if (fault === reason) return
  fault = reason
  for (const listener of [...faultListeners]) listener()
}

export function instrumentFault(): string | null {
  return fault
}

export function useInstrumentFault(): string | null {
  return useSyncExternalStore(listener => { faultListeners.add(listener); return () => { faultListeners.delete(listener) } }, instrumentFault, instrumentFault)
}

/** Turning the stage to one of its lenses needs the open work's native scope, which only the frame holds: the frame
 * publishes the driver, and the browser's stage-lens rows call it. It answers with a refusal in the owner's words, or null. */
export type StageLensDriver = (lens: string, refused: (reason: string) => void) => void

let lensDriver: StageLensDriver | null = null

export function publishStageLensDriver(next: StageLensDriver | null): void {
  lensDriver = next
}

export function driveStageLens(lens: string, refused: (reason: string) => void): void {
  if (!lensDriver) { refused('The Expressions stage is not mounted in this shell.'); return }
  lensDriver(lens, refused)
}
