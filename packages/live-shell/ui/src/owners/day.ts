// The Day's standing — the owner's `central` op `open-day` (central/documents/documentReadings.ts `readDayStanding`,
// interpreted by centralVertical.ts `interpretDayOpen`) — held once for every reader of one Day: the mode detail row and the
// clip detail (central/useCentralDayStanding.ts) and the Day pane (central/documents/CentralDocumentPane.tsx).
//
// Two kinds of answer, kept apart because they move differently:
//   - an answer — the Day is ready, or it has no native document yet. A Day can be initialised or saved outside this shell,
//     so coming back to the window reads it again (as each reader did on its own before);
//   - a refusal — e.g. the owner's stale-today refusal, refused on every boot and asked again on every focus before. It is
//     remembered for its epoch: the owner is not asked the same read again until the spine's epoch or world context moves,
//     or the person asks; the refusal stays shown in the owner's words meanwhile.

// Ported from central/useCentralDayStanding.ts at 98385f92d :11-30 (the read, and the read again on the window's return) and
// central/documents/CentralDocumentPane.tsx at 98385f92d :49-60 (`useDayStanding`), over documentReadings.ts:23 `readDayStanding`.
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {interpretDayOpen, type DayDocumentStanding} from '../central/centralVertical'
import {readDayStanding} from '../central/documents/documentReadings'
import {ownerReadings, useOwnerReading, type OwnerRead} from './ownerReading'
import {onAttentionRegained} from './attention'
import {useSpineEpoch} from './spine'

export const DAY_OP = 'central open-day'
/** Focus and visibility arrive together on a return: one read for both. */
export const DAY_ATTENTION_MIN_AGE_MS = 5_000

export const dayStandingKey = (transport: KernelTransportStatus, dayRef: string | null): string =>
  JSON.stringify([DAY_OP, transport, dayRef])

/** The owner's open-day answer: a ready or an uninitialised Day is an answer; anything else the owner refuses is a refusal. */
export function readDayOf(transport: KernelTransportStatus, dayRef: string | null): OwnerRead<DayDocumentStanding> {
  return async () => {
    const standing = await readDayStanding(transport, dayRef)
    return standing.state === 'refused' ? {error: standing.message} : {value: standing}
  }
}

let installed = false
function installNotices() {
  if (installed || typeof window === 'undefined') return
  installed = true
  onAttentionRegained(() => {
    const at = Date.now()
    for (const entry of ownerReadings.entries()) {
      if (!entry.key.startsWith(`["${DAY_OP}"`) || entry.readers === 0) continue
      const standing = entry.snapshot()
      const age = entry.ageAt(at)
      if (standing.epoch && standing.status === 'answered' && (age === null || age >= DAY_ATTENTION_MIN_AGE_MS)) void entry.refresh(standing.epoch)
    }
  })
}

/** One Day's standing (`dayRef` null: the current Day), shared; null while the owner answers. `enabled` false reads nothing. */
export function useDayAnswer(transport: KernelTransportStatus, dayRef: string | null, enabled = true): {standing: DayDocumentStanding | null; retry: () => void} {
  installNotices()
  const epoch = useSpineEpoch()
  const {reading, retry} = useOwnerReading(enabled ? dayStandingKey(transport, dayRef) : null, readDayOf(transport, dayRef), epoch)
  const standing = reading.status === 'answered' ? reading.value
    : reading.status === 'refused' ? interpretDayOpen(dayRef ?? 'today', {error: reading.error ?? 'The owner refused the Day'})
      : null
  return {standing, retry}
}
