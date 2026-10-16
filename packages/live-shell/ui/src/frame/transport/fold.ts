// The transport's fold (lane F, F3): the bar never overlaps what stands beside it and never truncates a chooser. Seen natively
// at 1372 px (16 Oct): Expressions' owner controls in the draw slot (the stage tool rail and the pointer's three choosers)
// pushed the bar 53 px past its box, so the engine light's "Running" lay over the Map slot and the mode icons, and the
// choosers were cut to "Repe", "Pulse", "Glob". The fold: when the bar is short of room, a slot that carries an owner's
// control and has a specimen mark folds to that mark — one cell, the mockup's (the draw slot's ✎) — and its press opens the
// owner's control, whole, beneath the cell. When the room returns, the slot opens in the bar again. Pure TypeScript.

/** What the bar measures: its row (the groups laid end to end) and the scale group, which gives way first (its readings
 * ellipsize) — a squeezed scale group is a bar short of room too. */
export interface BarRoom {
  /** the bar's laid-out content width (scrollWidth) and its box (clientWidth) */
  scroll: number
  client: number
  /** the scale group's content and box, when it stands */
  scaleScroll?: number
  scaleClient?: number
}

export interface FoldState {
  folded: boolean
  /** the room the open bar needed when it last folded: it opens again only once its box is that wide */
  need: number
}

/** The slack that keeps a bar that has just opened from folding again on a sub-pixel. */
export const FOLD_SLACK = 8

/** The next fold for a measure. Short of room → fold, remembering what the open bar needed; folded and the box has grown to
 * that need → open. Otherwise unchanged (the same object, so a caller can skip a render). */
export function nextFold(state: FoldState, room: BarRoom): FoldState {
  const squeezed = room.scaleScroll !== undefined && room.scaleClient !== undefined ? Math.max(0, room.scaleScroll - room.scaleClient) : 0
  const short = room.scroll > room.client + 1 || squeezed > 1
  if (!state.folded) return short ? {folded: true, need: room.scroll + squeezed + FOLD_SLACK} : state
  return room.client >= state.need ? {folded: false, need: 0} : state
}
