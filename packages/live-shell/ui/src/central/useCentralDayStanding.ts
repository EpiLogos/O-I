import {useEffect, useState} from 'react'
import {central} from '../../../../../desktop/cradle/src/central/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {dayOpenRequest, interpretDayOpen, type DayDocumentStanding} from './centralVertical'

/** The Day document's standing for one civil day, read from the owner's
 * `central` op `open-day` (the one read path the Central craft uses). Null
 * while the owner answers, or when no day stands. */
export function useCentralDayStanding(transport: KernelTransportStatus, dayRef: string | null): DayDocumentStanding | null {
  const [held, setHeld] = useState<{readonly dayRef: string; readonly standing: DayDocumentStanding} | null>(null)
  useEffect(() => {
    if (!dayRef) return
    let alive = true
    central<unknown>(transport, null, dayOpenRequest(dayRef))
      .then(data => ({data}), (error: unknown) => ({error: error instanceof Error ? error.message : String(error)}))
      .then(answer => { if (alive) setHeld({dayRef, standing: interpretDayOpen(dayRef, answer)}) })
    return () => { alive = false }
  }, [transport, dayRef])
  return dayRef && held?.dayRef === dayRef ? held.standing : null
}
