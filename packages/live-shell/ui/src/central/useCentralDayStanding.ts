import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {DayDocumentStanding} from './centralVertical'
import {useDayAnswer} from '../owners/day'

/** The Day document's standing for one civil day, read from the owner's `central` op `open-day` (the one read path the
 * Central craft uses) through the window's shared Day answer (owners/day.ts). Null while the owner answers, or when no day
 * stands. A Day can change outside this shell (initialised elsewhere), so an answered Day is read again when the window
 * regains focus or becomes visible — never polled; a refusal (the stale-today pointer) is remembered for its epoch rather than
 * asked again on every return. */
export function useCentralDayStanding(transport: KernelTransportStatus, dayRef: string | null): DayDocumentStanding | null {
  const {standing} = useDayAnswer(transport, dayRef, !!dayRef)
  return dayRef ? standing : null
}
