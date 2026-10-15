// A plate's columns fit the device row by the plate's own fold (frame/devices/InstrumentPlate.tsx; manual §10.4 "A device can also fold
// down to its title. Click the title to open it again"; owner, 15 Oct: "no scrollers"). Moved whole out of the Studio
// (ExpressionsStudio.tsx, where it measured its own row) so the stage instruments' plates fit the same way: the row is measured where it
// stands, the decision is studioFit.ts foldsToFit over the plate's own fold order, and the person's folds and opens hold.
import {useEffect, useId, useRef, useState} from 'react'
import {foldsToFit, pressFold, sameSet} from './studioFit'

export interface PlateFit {
  /** The plate's mark for its row (`data-studio-fit` on the InstrumentPlate), so the row measured is this plate's own. */
  readonly fitId: string
  /** The columns that stand folded now: the person's own folds, then as few of the fold order as bring the row within its width. */
  readonly folded: ReadonlySet<string>
  /** The columns the person opened (a column folded by default stays open once they open it). */
  readonly opened: ReadonlySet<string>
  /** A press on a column's title or strip: an open column folds and stays folded; a folded one opens and stays open. `shownFolded` is
   * what the column showed when pressed, where the plate folds a column for a reason of its own. */
  readonly press: (id: string, shownFolded?: boolean) => void
}

/** Measure the plate's row and fold its columns to fit. `columnKey` names the columns on the row (their ids, joined), `order` the ones
 * that may fold to make room, nearest the end first; `off` stands every column open (the Studio's settings); `startFolded` are the
 * columns that stand folded until the person opens them. */
export function usePlateFit(columnKey: string, order: readonly string[], off = false, startFolded: readonly string[] = []): PlateFit {
  const fitId = useId()
  const openWidths = useRef(new Map<string, number>())
  const [chosen, setChosen] = useState<{folded: ReadonlySet<string>; opened: ReadonlySet<string>}>(() => ({folded: new Set(startFolded), opened: new Set()}))
  const [fitted, setFitted] = useState<ReadonlySet<string>>(() => new Set(startFolded))
  const orderKey = order.join('|')
  useEffect(() => {
    const plate = [...document.querySelectorAll<HTMLElement>('.inst-plate[data-studio-fit]')].find(element => element.dataset.studioFit === fitId)
    const row = plate?.querySelector<HTMLElement>('.inst-sections')
    if (off || !row) {setFitted(previous => previous.size ? new Set() : previous); return}
    let strip = 28
    const fit = () => {
      const columns: string[] = []
      for (const column of row.querySelectorAll<HTMLElement>(':scope > .inst-section')) {
        const id = column.dataset.section
        if (!id) continue
        columns.push(id)
        const width = column.getBoundingClientRect().width
        if (column.dataset.folded) strip = width || strip
        else openWidths.current.set(id, width)
      }
      const next = foldsToFit({columns, widths: openWidths.current, strip, available: row.clientWidth, folded: chosen.folded, opened: chosen.opened, order})
      setFitted(previous => sameSet(previous, next) ? previous : next)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(row)
    for (const column of row.querySelectorAll(':scope > .inst-section')) observer.observe(column)
    return () => observer.disconnect()
  }, [off, chosen, columnKey, fitted, fitId, orderKey])
  return {fitId, folded: fitted, opened: chosen.opened, press: (id, shownFolded = fitted.has(id)) => setChosen(state => pressFold(id, shownFolded, state))}
}
