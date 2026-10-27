// A plate's sections fit the device row by the plate's own fold (InstrumentPlate.tsx; manual §10.4 "A device can also fold down to its
// title. Click the title to open it again"; ProjectCentral/docs/1-vision/dlw/DLW.md §16.9 "Nothing scrolls … When a panel holds more than fits, it gets
// pages"; owner, 15 Oct: "no scrollers"). Moved whole from components/expressions/studio/plateFit.ts and studioFit.ts (lane Y), where
// the Studio and the stage plates measured their rows, so that every plate fits the same way: the row is measured where it stands,
// the sections that may fold fold to their titles from the given order until the row is within its width, and the person's own folds
// and opens hold. The plate also reports the width it would stand at with nothing folded for room (`natural`), so the rack can give
// what is left to the Compact instruments beside it (inhabitants/ql/devices/TechneDevices.tsx).
import {useEffect, useId, useRef, useState} from 'react'

export interface FitInput {
  /** Every column on the row, in its order. */
  readonly columns: readonly string[]
  /** Each column's width while open, as last measured. */
  readonly widths: ReadonlyMap<string, number>
  /** The width of a column folded to its title. */
  readonly strip: number
  /** The width the row shows. */
  readonly available: number
  /** The columns the person folded, and the ones they opened. */
  readonly folded: ReadonlySet<string>
  readonly opened: ReadonlySet<string>
  /** The columns that may fold to make room, in the order they fold. */
  readonly order: readonly string[]
}

/** The columns that stand folded: the person's own, then as few of the fold order as bring the row within its width. */
export function foldsToFit({columns, widths, strip, available, folded, opened, order}: FitInput): Set<string> {
  const folds = new Set([...folded].filter(id => columns.includes(id)))
  let total = columns.reduce((sum, id) => sum + (folds.has(id) ? strip : widths.get(id) ?? strip), 0)
  for (const id of order) {
    if (total <= available) break
    if (!columns.includes(id) || folds.has(id) || opened.has(id)) continue
    folds.add(id)
    total -= (widths.get(id) ?? strip) - strip
  }
  return folds
}

/** The person's press on a column's fold: an open column folds and stays folded; a folded one opens and stays open. */
export function pressFold(id: string, shownFolded: boolean, state: {folded: ReadonlySet<string>; opened: ReadonlySet<string>}): {folded: Set<string>; opened: Set<string>} {
  const folded = new Set(state.folded), opened = new Set(state.opened)
  if (shownFolded) {folded.delete(id); opened.add(id)} else {opened.delete(id); folded.add(id)}
  return {folded, opened}
}

export const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every(id => b.has(id))

export interface PlateFit {
  /** The plate's mark for its row (`data-studio-fit` on the InstrumentPlate), so the row measured is this plate's own. */
  readonly fitId: string
  /** The columns that stand folded now: the person's own folds, then as few of the fold order as bring the row within its width. */
  readonly folded: ReadonlySet<string>
  /** The columns the person opened (a column folded by default stays open once they open it). */
  readonly opened: ReadonlySet<string>
  /** The width the row would take with only the person's own folds (and the start folds) standing: what the plate asks of the rack. */
  readonly natural: number | null
  /** A press on a column's title or strip: an open column folds and stays folded; a folded one opens and stays open. `shownFolded` is
   * what the column showed when pressed, where the plate folds a column for a reason of its own. */
  readonly press: (id: string, shownFolded?: boolean) => void
}

/** Measure the plate's row and fold its columns to fit. `columnKey` names the columns on the row (their ids, joined), `order` the ones
 * that may fold to make room, nearest the end first; `off` stands every column open (the Studio's settings, or a plate whose fit is
 * its host's); `startFolded` are the columns that stand folded until the person opens them. */
export function usePlateFit(columnKey: string, order: readonly string[], off = false, startFolded: readonly string[] = []): PlateFit {
  const fitId = useId()
  const openWidths = useRef(new Map<string, number>())
  // What each column asks for: its declared width where it has one (the last column stretches over the rest of the row), else as measured.
  const askedWidths = useRef(new Map<string, number>())
  const [chosen, setChosen] = useState<{folded: ReadonlySet<string>; opened: ReadonlySet<string>}>(() => ({folded: new Set(startFolded), opened: new Set()}))
  const [fitted, setFitted] = useState<ReadonlySet<string>>(() => new Set(startFolded))
  const [natural, setNatural] = useState<number | null>(null)
  const orderKey = order.join('|')
  useEffect(() => {
    const plate = off ? undefined : [...document.querySelectorAll<HTMLElement>('.inst-plate[data-studio-fit]')].find(element => element.dataset.studioFit === fitId)
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
        else {
          openWidths.current.set(id, width)
          const declared = Number.parseFloat(column.style.getPropertyValue('--section-w'))
          askedWidths.current.set(id, Number.isFinite(declared) && declared > 0 ? declared : width)
        }
      }
      const next = foldsToFit({columns, widths: openWidths.current, strip, available: row.clientWidth, folded: chosen.folded, opened: chosen.opened, order})
      setFitted(previous => sameSet(previous, next) ? previous : next)
      const asked = Math.round(columns.reduce((sum, id) => sum + (chosen.folded.has(id) ? strip : askedWidths.current.get(id) ?? strip), 0))
      setNatural(previous => previous === asked ? previous : asked)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(row)
    for (const column of row.querySelectorAll(':scope > .inst-section')) observer.observe(column)
    return () => observer.disconnect()
  }, [off, chosen, columnKey, fitted, fitId, orderKey])
  return {fitId, folded: fitted, opened: chosen.opened, natural, press: (id, shownFolded = fitted.has(id)) => setChosen(state => pressFold(id, shownFolded, state))}
}
