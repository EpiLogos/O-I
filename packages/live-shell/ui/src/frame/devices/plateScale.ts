// The plate's scale (manual §16.9: "The plate does not reflow. When the detail area is shorter or taller, the whole plate scales
// between 80 % and 125 %, as Live's zoom scales its devices"). A plate on a chain is 191 px high at 100 %; its scale is the chain's
// own height over that, held to the range. The pool scales its 400-wide plate to the pool's width the same way (never reflowed).
// The scale is CSS `zoom`, so the plate's layout box scales with its drawing and the chain lays it out at its scaled width.
import {useLayoutEffect, useRef, useState, type RefObject} from 'react'
import {MEASURE} from './genericLayout'

export const SCALE_MIN = 0.8, SCALE_MAX = 1.25

/** The scale of a plate on a chain whose content stands `height` px high (pure). */
export function chainScale(height: number): number {
  if (!(height > 0)) return 1
  return Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, height / MEASURE.plate)) * 100) / 100
}

/** The scale of the pool's plate (pure): the plate is 400 wide and one or two bands high at 100 %, and fits the pool however
 * narrow or short — it never reflows and the pool never scrolls it. */
export function poolScale(width: number, height = Infinity, natural = MEASURE.head + MEASURE.band + 2): number {
  if (!(width > 0)) return 1
  return Math.round(Math.min(SCALE_MAX, width / MEASURE.pool, height > 0 ? height / natural : Infinity) * 100) / 100
}

const useIsoLayoutEffect = typeof window === 'undefined' ? () => {} : useLayoutEffect

/** Follow the content box of the nearest element matching `selector` above `ref` (the chain row, the pool), and scale by `law`.
 * Inside an instrument's section a plate keeps 100 % (the instrument's own plate fits itself). */
export function useContainerScale(ref: RefObject<HTMLElement | null>, selector: string, law: (box: {width: number; height: number}, natural: {width: number; height: number}) => number): number {
  const [scale, setScale] = useState(1)
  const held = useRef(1)
  held.current = scale
  useIsoLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    if (element.closest('.inst-section, .inst-device')) return
    const holder = element.parentElement?.closest(selector) as HTMLElement | null
    if (!holder) return
    const measure = () => {
      const style = getComputedStyle(holder)
      const width = holder.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const height = holder.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      // The plate's own size at 100 %: its drawn size under the zoom it stands at now, unscaled.
      const plate = element.firstElementChild?.getBoundingClientRect()
      const natural = {width: (plate?.width ?? 0) / held.current, height: (plate?.height ?? 0) / held.current}
      const next = law({width, height}, natural)
      setScale(was => (Math.abs(was - next) < 0.005 ? was : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(holder)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [ref, selector])
  return scale
}
