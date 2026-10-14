/**
 * Palace bookmarks and the named start (lane-5 T24) — pure presentation over the Palace's own composition. No DOM, no store.
 *
 * Laws carried here:
 *   - a bookmark is a NAMED POSITION of the palace: the region and native ref that stood there (its locus rides with it), and the
 *     board's viewport. It is the `PalaceBookmark` floor from `palace-state.ts`, extended by name and viewport, never a second type;
 *   - a jump is ONE hop: the walk index, the focused step and the board viewport all come from one result, which the surface
 *     applies and saves in one write. A bookmark whose ref no longer stands in the walk is refused by name and moves nothing;
 *   - the named start is the first step of the walk (the ground's first entry, `palaceWalkSteps`), the default landing when the
 *     palace has no saved presence. It is a position, not a gate: the walk stays free from it;
 *   - nothing semantic moves: a bookmark names a ref the reading already carries, verbatim. No Scene, body, region or order changes.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  addBookmark,
  renameBookmark,
  type PalaceBoardViewport,
  type PalaceBookmark,
  type PalaceComposition,
} from '../../../src/techne/m0m5/palace/palace-state.ts';
import {palaceWalkAt, palaceWalkResume, type PalaceWalkStep} from './palaceWhole.ts';

/** The longest name a bookmark takes. A longer one is refused by name, never cut. */
export const PALACE_BOOKMARK_NAME_LIMIT = 80;

/** The name a visitor typed, trimmed and checked. A blank or over-long name is refused in words. */
export function palaceBookmarkName(input: string): {ok: true; name: string} | {ok: false; reason: string} {
  const name = input.trim();
  if (!name) return {ok: false, reason: 'a bookmark needs a name'};
  if (name.length > PALACE_BOOKMARK_NAME_LIMIT) return {ok: false, reason: `a bookmark name holds at most ${PALACE_BOOKMARK_NAME_LIMIT} characters`};
  return {ok: true, name};
}

/** How a bookmark reads in the list: its name, or its ref when it was saved before naming. */
export function palaceBookmarkLabel(bookmark: Pick<PalaceBookmark, 'name' | 'ref'>): string {
  return bookmark.name ?? bookmark.ref;
}

/** The named start: the walk's first step (walk index 0). Null in a palace that composes nothing. */
export function palaceStartStep(steps: readonly PalaceWalkStep[]): {index: number; step: PalaceWalkStep | null} {
  return palaceWalkAt(steps, 0);
}

/** The walk index a palace opens at. With no saved walk position it lands on the named start; a saved one resumes where it stood,
 * wrapped into the walk as it now stands. Pure. */
export function palaceLandingIndex(savedWalk: number | undefined, steps: readonly PalaceWalkStep[]): number {
  return savedWalk === undefined ? palaceStartStep(steps).index : palaceWalkResume(savedWalk, steps.length);
}

export type PalaceBookmarkChange = {kind: 'changed'; composition: PalaceComposition} | {kind: 'refused'; reason: string};

/** Bookmark the focused walk step under a name. One bookmark per ref (a ref already bookmarked is refused, never duplicated). */
export function palaceBookmarkAdd(
  composition: PalaceComposition,
  focus: PalaceWalkStep,
  input: string,
  viewport: PalaceBoardViewport | null,
): PalaceBookmarkChange {
  const named = palaceBookmarkName(input);
  if (!named.ok) return {kind: 'refused', reason: named.reason};
  if (composition.bookmarks.some((bookmark) => bookmark.ref === focus.ref)) {
    return {kind: 'refused', reason: `${focus.ref} is already bookmarked — jump to it or rename it`};
  }
  return {
    kind: 'changed',
    composition: addBookmark(composition, focus.region, focus.ref, {name: named.name, ...(viewport ? {viewport} : {})}),
  };
}

/** Rename one bookmark. A blank or over-long name is refused and the bookmark keeps its name. */
export function palaceBookmarkRename(composition: PalaceComposition, ref: string, input: string): PalaceBookmarkChange {
  const named = palaceBookmarkName(input);
  if (!named.ok) return {kind: 'refused', reason: named.reason};
  if (!composition.bookmarks.some((bookmark) => bookmark.ref === ref)) return {kind: 'refused', reason: `${ref} is not bookmarked`};
  return {kind: 'changed', composition: renameBookmark(composition, ref, named.name)};
}

export type PalaceJump =
  | {kind: 'jumped'; composition: PalaceComposition; walk_index: number; focus: PalaceWalkStep; viewport: PalaceBoardViewport | undefined}
  | {kind: 'refused'; reason: string};

/** Jump to a bookmark in ONE hop: the walk index and focus are the bookmark's own step, and the board viewport is the bookmark's
 * (or the current one when the bookmark carries none). The returned composition holds all three, so the surface saves once. */
export function palaceBookmarkJump(composition: PalaceComposition, bookmark: PalaceBookmark, steps: readonly PalaceWalkStep[]): PalaceJump {
  const index = steps.findIndex((step) => step.region === bookmark.region && step.ref === bookmark.ref);
  const focus = steps[index];
  if (index < 0 || !focus) return {kind: 'refused', reason: `${palaceBookmarkLabel(bookmark)} no longer stands in the walk`};
  const viewport = bookmark.viewport ? {...bookmark.viewport} : composition.viewport ? {...composition.viewport} : undefined;
  return {
    kind: 'jumped',
    walk_index: index,
    focus,
    viewport,
    composition: {...composition, walk_index: index, ...(viewport ? {viewport} : {})},
  };
}
