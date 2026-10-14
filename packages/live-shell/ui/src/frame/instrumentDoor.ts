// The one door an instrument opens through (FOUNDATION F2): the pane tree that is mounted publishes how it opens a pane
// kind — in a given pane, on one of its edges, or in the focused pane — and the browser's Instruments rows call it.
import type {PaneEdge} from '../../../../../desktop/cradle/src/surface/types'

export type InstrumentOpener = (kind: string, at?: {groupId: string; edge: PaneEdge | null}, subject?: {ref: string; title: string}) => void

let opener: InstrumentOpener | null = null

export function publishInstrumentOpener(next: InstrumentOpener | null): void {
  opener = next
}

/** Open an instrument: in the named pane (or on its edge), else in the focused pane. Refuses when no pane tree is mounted. */
export function openInstrument(kind: string, at?: {groupId: string; edge: PaneEdge | null}, subject?: {ref: string; title: string}): void {
  if (!opener) throw Error('No pane tree is mounted to open the instrument in')
  opener(kind, at, subject)
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
