// The Studio's band (DEVICE-UI §3: "Band (the body on a chain) 168 high"; §1 "Nothing scrolls"): the height a section's controls stand in,
// measured where the plate stands (the detail row's height decides it: styles.css --detail-h). Every section lays its controls out to it —
// the frame's keys flow down that many rows and then across (frameChrome.css --chrome-rows), a held device scales to it (studioDevices.tsx)
// — so nothing is cut at the plate's foot. Read from the plate's own row (plateFit.ts names it by `data-studio-fit`).
import {useEffect, useState} from 'react'

/** The rows of the frame's keys a band holds: 16 px keys, 3 px apart (frameChrome.css). Pure. */
export function chromeRows(band: number | null): number {
  if (!band || !(band > 0)) return 6
  return Math.max(2, Math.floor((band + 3) / 19))
}

/** The height of an open section's body in the plate named `fitId`, as laid out now; null until measured. */
export function useStudioBand(fitId: string, columnKey: string): number | null {
  const [band, setBand] = useState<number | null>(null)
  useEffect(() => {
    if (typeof document === 'undefined' || typeof ResizeObserver === 'undefined') return
    const plate = [...document.querySelectorAll<HTMLElement>('.inst-plate[data-studio-fit]')].find(element => element.dataset.studioFit === fitId)
    const row = plate?.querySelector<HTMLElement>('.inst-sections')
    if (!row) return
    const measure = () => {
      const body = row.querySelector<HTMLElement>(':scope > .inst-section:not(.inst-section--folded) > .inst-section-body')
      const height = body?.clientHeight
      if (height) setBand(was => (was === height ? was : height))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [fitId, columnKey])
  return band
}
