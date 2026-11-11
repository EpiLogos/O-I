/** The mockup's status-bar info law: one delegated `mouseover` on the frame
 * reads the `data-i="label|function"` attribute of whatever the pointer
 * enters — at any depth — and publishes it to the status bar. The last
 * reading persists on mouseleave (the mockup's `#info` never clears). */
import {useEffect, useState, type RefObject} from 'react'

export interface DataIStatusInfo {
  label: string
  fn: string
}

/** Split a `data-i` value on the FIRST `|`, trimming both sides.
 * Absent (empty, null, undefined) → null; no separator → label only with an
 * empty function, like the mockup's `${p || ''}`. */
export function parseDataI(value: string | null | undefined): DataIStatusInfo | null {
  if (value == null || value === '') return null
  const cut = value.indexOf('|')
  if (cut === -1) return {label: value.trim(), fn: ''}
  return {label: value.slice(0, cut).trim(), fn: value.slice(cut + 1).trim()}
}

/** What the Info line reads (be2o ruling 2; DLW build ruling 2026-11-11): what the pointer enters, and what takes the keyboard's focus, so
 * a control reached by Tab says what the same control says under the pointer. Every reader of the line listens through `onInfoEvents`. */
export const INFO_EVENTS = ['mouseover', 'focusin'] as const
/** Listen on `target` for each of the Info line's events; the return detaches them. */
export function onInfoEvents(target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>, read: (event: Event) => void): () => void {
  for (const name of INFO_EVENTS) target.addEventListener(name, read)
  return () => { for (const name of INFO_EVENTS) target.removeEventListener(name, read) }
}

/** Delegated `data-i` reader for the agent-shell frame. Attaches one
 * listener for the Info line's events to `frameRef.current`; any element carrying `data-i`
 * publishes its pair. Detaches on unmount; keeps the last reading when the
 * pointer leaves the frame. */
export function useDataIStatusInfo(frameRef: RefObject<HTMLElement | null>): DataIStatusInfo | null {
  const [info, setInfo] = useState<DataIStatusInfo | null>(null)
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    return onInfoEvents(frame, event => {
      const target = event.target
      if (!(target instanceof Element)) return
      const holder = target.closest('[data-i]')
      if (!holder) return
      setInfo(parseDataI(holder.getAttribute('data-i')))
    })
  }, [frameRef])
  return info
}
