// The Studio's columns fit the detail row by the plate's own fold (frame/devices/InstrumentPlate.tsx: a column folds to its title
// as the runtime's strip — manual §10.4 "A device can also fold down to its title. Click the title to open it again"; the
// mockup's .ifold). Capture is the plate's last column and the one that says where an export landed: while the row is wider than
// it shows, the columns before it fold to their titles from the one nearest it back toward Tools, until Capture stands in view.
// The person's own folds and opens always hold (a column they opened stays open; then the row scrolls as one, as it always did).
// Pure: the widths are measured by the Studio; nothing here touches the page.

/** The columns that may fold to make room, in the order they fold: from the one nearest Capture back toward Tools. Capture never. */
export const STUDIO_FOLD_ORDER = ['studio:nara-m4', 'studio:body', 'studio:motion', 'studio:material', 'studio:formation', 'studio:selected', 'studio:tools'] as const

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
}

/** The columns that stand folded: the person's own, then as few of the fold order as bring the row within its width. */
export function foldsToFit({columns, widths, strip, available, folded, opened}: FitInput): Set<string> {
  const folds = new Set([...folded].filter(id => columns.includes(id)))
  let total = columns.reduce((sum, id) => sum + (folds.has(id) ? strip : widths.get(id) ?? strip), 0)
  for (const id of STUDIO_FOLD_ORDER) {
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
