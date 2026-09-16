/**
 * Palace recall (L5 Technē T6) — mnemonic navigation over the arrangement
 * (QL-MEF wayfinder §10). The memory walk is the method of loci: every
 * element stands at a locus of the bounded space, and walking the loci in
 * spatial order yields the elements in recall order.
 *
 * Laws: recall order derives from the arrangement ONLY — no insertion order,
 * no clock, no stochastic source; next/previous move one locus at a time and
 * wrap the walk; an empty palace walks nothing and focuses nothing. Pure
 * functions over local presentation state; nothing here reads or writes any
 * store.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import { arrangementOrder, locusOrder, type PalaceArrangement, type PalaceLocus } from "./composition.ts";

/** One recall walk: the occupied loci in spatial order, the element refs
 * standing at them, and the focused position of the walk. */
export interface PalaceRecall {
  loci: PalaceLocus[];
  refs: string[];
  index: number;
}

/** The walk over one arrangement, focused at `index` (normalised into the
 * walk; an empty walk always focuses nothing). */
export function recallAt(arrangement: PalaceArrangement, index = 0): PalaceRecall {
  const ordered = sortLoci(arrangement);
  const count = ordered.length;
  const normalised = count === 0 ? 0 : ((Math.trunc(index) % count) + count) % count;
  return { loci: ordered.map((placement) => placement.locus), refs: arrangementOrder(arrangement), index: normalised };
}

/** The walk from its first occupied locus. */
export function recallWalk(arrangement: PalaceArrangement): PalaceRecall {
  return recallAt(arrangement, 0);
}

/** Step to the next occupied locus, wrapping at the end of the walk. */
export function recallNext(recall: PalaceRecall): PalaceRecall {
  if (recall.refs.length === 0) return recall;
  return { ...recall, index: (recall.index + 1) % recall.refs.length };
}

/** Step to the previous occupied locus, wrapping before the start. */
export function recallPrevious(recall: PalaceRecall): PalaceRecall {
  if (recall.refs.length === 0) return recall;
  return { ...recall, index: (recall.index - 1 + recall.refs.length) % recall.refs.length };
}

/** The element ref the walk currently focuses, or null when nothing stands
 * in the palace. */
export function recallFocused(recall: PalaceRecall): string | null {
  return recall.refs[recall.index] ?? null;
}

/** The locus the walk currently stands at, or null in an empty palace. */
export function recallLocus(recall: PalaceRecall): PalaceLocus | null {
  return recall.loci[recall.index] ?? null;
}

function sortLoci(arrangement: PalaceArrangement) {
  return [...arrangement.placements].sort((a, b) => locusOrder(a.locus, b.locus));
}
