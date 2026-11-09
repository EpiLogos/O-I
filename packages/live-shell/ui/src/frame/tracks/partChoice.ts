// The parts chosen together (O9, walk #857 r47 LV04; DLW build ruling 2026-11-09, round 48 item 1): a click on a part's head chooses it
// alone, Shift-click extends the choice to a range from the part chosen before, and ⌘-click (Ctrl off the Mac) adds or takes away one, so
// "Group the selected tracks" (manual §10.8, ⌘G) groups every part chosen. THE selection (the shell's one) stays the part last clicked:
// its Detail is that part's. What is chosen stands only while THE selection is one of the parts chosen; once it moves to anything else,
// the choice is let go, and it is let go in a set other than the one it was made in (DLW build ruling 2026-11-09, 0D item 9). A range is
// the parts the view draws, in its order: never a return, nor the members of a group folded shut. One choice for the window, as there is
// one selection; the views draw it and the menu reads it when it acts.
import {useEffect, useSyncExternalStore} from 'react'
import type {WorldTrackSet} from '../../timeline/worldTrackAdapter'
import type {TracksSelection} from './SessionGrid'

/** How a click on a part's head chooses. */
export type PartHow = 'one' | 'range' | 'toggle'
/** The parts chosen, in the set's order, and the one a Shift-click's range is drawn from. */
export interface PartChoice {readonly anchor: string | null; readonly parts: readonly string[]}
export const NO_PARTS: PartChoice = {anchor: null, parts: []}

/** How a click with these keys held chooses: Shift a range, ⌘ (Ctrl off the Mac) one more or one less, otherwise that part alone. */
export function partHow(event: {readonly shiftKey?: boolean; readonly metaKey?: boolean; readonly ctrlKey?: boolean}): PartHow {
  return event.shiftKey ? 'range' : event.metaKey || event.ctrlKey ? 'toggle' : 'one'
}

/** The choice as it stands with THE selection `selected`: the parts chosen where the selection is one of them, else the selection
 * alone (or nothing). Pure. */
export function partsWith(choice: PartChoice, selected: string | undefined): PartChoice {
  if (selected !== undefined && choice.parts.includes(selected)) return choice
  return selected === undefined ? NO_PARTS : {anchor: selected, parts: [selected]}
}

/** The choice after a click on `id`'s head chosen `how`, over the parts the view draws in order (`order`), from the choice as it stands
 * with THE selection `selected`. A range is every part between the anchor and `id`; with no anchor in the set, the click chooses `id`
 * alone. ⌘ on the only part chosen leaves it chosen. A part the order leaves out (a return) is chosen alone, however it is clicked.
 * Pure. */
export function nextPartChoice(choice: PartChoice, selected: string | undefined, id: string, order: readonly string[], how: PartHow): PartChoice {
  const standing = partsWith(choice, selected)
  const alone: PartChoice = {anchor: id, parts: [id]}
  if (!order.includes(id)) return alone
  const inOrder = (ids: Iterable<string>) => { const held = new Set(ids); return order.filter(part => held.has(part)) }
  if (how === 'range') {
    const from = standing.anchor === null ? -1 : order.indexOf(standing.anchor), to = order.indexOf(id)
    if (from < 0 || to < 0) return alone
    return {anchor: standing.anchor, parts: order.slice(Math.min(from, to), Math.max(from, to) + 1)}
  }
  if (how === 'toggle') {
    if (!standing.parts.includes(id)) return {anchor: id, parts: inOrder([...standing.parts, id])}
    const left = standing.parts.filter(part => part !== id)
    if (!left.length) return alone
    return {anchor: standing.anchor !== null && left.includes(standing.anchor) ? standing.anchor : left[left.length - 1], parts: left}
  }
  return alone
}

/** The set a choice is made in, as its parts know it: its owner and its tracks. Track ids are a set's own, so a choice made in one set
 * never stands in another. */
const setOf = (set: WorldTrackSet): string => [set.actions?.owner ?? '', ...set.tracks.map(track => track.id)].join('\u0000')

let choice: PartChoice = NO_PARTS
/** The set the choice was made in; null where it was set without one (a test). */
let madeIn: string | null = null
const listeners = new Set<() => void>()

/** The choice as it was last made (read it with THE selection through `partsWith`). */
export function partChoice(): PartChoice { return choice }
/** Set the choice (a click on a head, or a test), made in `set`. */
export function setPartChoice(next: PartChoice, set?: WorldTrackSet): void {
  madeIn = set ? setOf(set) : null
  if (next === choice) return
  choice = next
  for (const listener of listeners) listener()
}
export function subscribePartChoice(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
/** Whether the choice was made in `set` (or made with no set named). */
const madeInSet = (set: WorldTrackSet): boolean => madeIn === null || madeIn === setOf(set)
/** THE selection stands on `selected` in `set`: a choice it is not one of, or one made in another set, is let go. */
export function selectionMoved(selected: string | undefined, set: WorldTrackSet): void {
  if (choice.parts.length && (selected === undefined || !choice.parts.includes(selected) || !madeInSet(set))) setPartChoice(NO_PARTS)
}
/** The parts chosen with THE selection `selected` in `set`, drawn again when the choice moves. Where THE selection leaves the choice, or
 * the set is another, the choice is let go (0D item 9), so a right-click or the device button that selects one of its parts later never
 * brings it back. The hosts call it (the views stay hook-free). */
export function usePartChoice(selected: string | undefined, set: WorldTrackSet): PartChoice {
  const held = useSyncExternalStore(subscribePartChoice, partChoice, partChoice)
  const sameSet = madeInSet(set)
  useEffect(() => { selectionMoved(selected, set) }, [selected, setOf(set)])
  return partsWith(sameSet ? held : NO_PARTS, selected)
}

/** A click on a part's head: the choice moves as its keys say, and THE selection moves to the part clicked — or, where ⌘ took that part
 * away, to the part the choice is drawn from. `order` is the parts the view draws, in its order: its tracks less the Main track and the
 * returns, less the members of a group folded shut (0D item 9). */
export function chooseTrack(selection: TracksSelection, set: WorldTrackSet, track: {readonly id: string; readonly name: string}, order: readonly string[],
  event: {readonly shiftKey?: boolean; readonly metaKey?: boolean; readonly ctrlKey?: boolean} = {}): void {
  const next = nextPartChoice(madeInSet(set) ? choice : NO_PARTS, selection.ref, track.id, order, partHow(event))
  setPartChoice(next, set)
  const focus = next.parts.includes(track.id) ? track : set.tracks.find(part => part.id === next.anchor)
  if (focus) selection.select({kind: 'track', ref: focus.id, title: focus.name})
}

/** The parts an act on `target` takes: every part chosen, in the set's order, where `target` is one of them; else `target` alone. */
export function partsOf(target: string, chosen: readonly string[] | undefined, set: WorldTrackSet): readonly string[] {
  if (!chosen || chosen.length < 2 || !chosen.includes(target)) return [target]
  const held = new Set(chosen)
  return set.tracks.filter(part => held.has(part.id)).map(part => part.id)
}
