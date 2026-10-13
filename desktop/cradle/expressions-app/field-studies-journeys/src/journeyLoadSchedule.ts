/**
 * T-REVIEW-4 #6, pure: the journey instrument's beat-load scheduling.
 *
 * The beat cards come from the whole-Expression read at once. Each card's facet chips come from its own Scene's read; those
 * reads settle with at most `limit` in flight. A load that has gone stale (the native basis moved, the instrument closed, a
 * newer load began) schedules no further reads: `current()` is consulted before every start and before every settle.
 */

/** Runs `task` over `items` with at most `limit` in flight. `onSettled` receives each outcome as it settles, in settle order,
 * and only while `current()` still holds; a task whose outcome arrives after the load went stale is dropped, never shown. The
 * returned promise resolves when every started task has settled (never rejects: a rejected task is a `rejected` outcome). */
export async function settleBounded<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  onSettled: (index: number, outcome: PromiseSettledResult<R>) => void,
  current: () => boolean,
): Promise<void> {
  const width = Math.max(1, Math.floor(limit));
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length && current()) {
      const index = next++;
      let outcome: PromiseSettledResult<R>;
      try {
        outcome = {status: 'fulfilled', value: await task(items[index], index)};
      } catch (reason) {
        outcome = {status: 'rejected', reason};
      }
      if (current()) onSettled(index, outcome);
    }
  };
  await Promise.all(Array.from({length: Math.min(width, items.length)}, () => worker()));
}

/** The identity of a load: the native Expression, its revision and the Scene the Journey stands on. Two loads with the same
 * key read the same native facts, so a refresh may join the one already in flight. */
export function beatLoadKey(basis: {expression_ref: string; revision: number; scene_ref: string}): string {
  return `${basis.expression_ref}\0${basis.revision}\0${basis.scene_ref}`;
}
