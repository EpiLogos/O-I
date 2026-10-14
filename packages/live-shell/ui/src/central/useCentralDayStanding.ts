import {useEffect, useState} from 'react'
import {central} from '../../../../../desktop/cradle/src/central/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {dayOpenRequest, interpretDayOpen, type DayDocumentStanding} from './centralVertical'

/** The Day document's standing for one civil day, read from the owner's
 * `central` op `open-day` (the one read path the Central craft uses). Null
 * while the owner answers, or when no day stands. A Day can change outside
 * this shell (initialised elsewhere), so the owner is read again when the
 * window regains focus or becomes visible — never polled. */
export function useCentralDayStanding(transport: KernelTransportStatus, dayRef: string | null): DayDocumentStanding | null {
  const [held, setHeld] = useState<{readonly dayRef: string; readonly standing: DayDocumentStanding} | null>(null)
  const [reread, setReread] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const again = () => { if (document.visibilityState !== 'hidden') setReread(count => count + 1) }
    window.addEventListener('focus', again)
    document.addEventListener('visibilitychange', again)
    return () => { window.removeEventListener('focus', again); document.removeEventListener('visibilitychange', again) }
  }, [])
  useEffect(() => {
    if (!dayRef) return
    let alive = true
    central<unknown>(transport, null, dayOpenRequest(dayRef))
      .then(data => ({data}), (error: unknown) => ({error: error instanceof Error ? error.message : String(error)}))
      .then(answer => { if (alive) setHeld({dayRef, standing: interpretDayOpen(dayRef, answer)}) })
    return () => { alive = false }
  }, [transport, dayRef, reread])
  return dayRef && held?.dayRef === dayRef ? held.standing : null
}
