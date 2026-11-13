// The room a place gives, measured. Its own module: the detail host (DetailHost.tsx) draws with the first frame and reads only this,
// while the clip host and the clip kit behind it load when a clip is first shown.
import {useEffect, useMemo, useRef, useState} from 'react'

/** The room a place gives, measured: the element's content box, followed as it changes. Absent until first measured. */
export function useMeasuredRoom(): [(element: HTMLElement | null) => void, {w: number; h: number} | null] {
  const [room, setRoom] = useState<{w: number; h: number} | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const hand = useMemo(() => (element: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!element) return
    const read = () => {
      const box = element.getBoundingClientRect()
      const next = {w: Math.max(0, Math.floor(box.width)), h: Math.max(0, Math.floor(box.height))}
      setRoom(was => (was && was.w === next.w && was.h === next.h ? was : next))
    }
    read()
    if (typeof ResizeObserver !== 'undefined') { observer.current = new ResizeObserver(read); observer.current.observe(element) }
  }, [])
  useEffect(() => () => observer.current?.disconnect(), [])
  return [hand, room]
}
