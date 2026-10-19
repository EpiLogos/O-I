// The window's last owner answers across a relaunch (MAP, the build lane's loading item: "a pane draws its last reading at once and
// refreshes behind it"): a bounded record in the window's own storage, written after a pause and when the window is hidden, read
// once when the window opens. Disposable — never authority, kept nowhere but this window's storage: each kept answer is drawn
// carried and the owner is asked again behind it (owners/ownerReading.ts). Bounded, so it never crowds the workspace book that
// shares the storage (continuity/workspace.tsx), and a store that will not take it costs nothing but the keeping.

export interface KeptAnswer {
  readonly value: unknown
  /** When the owner gave it. */
  readonly readAtUnixMs: number
  /** The spine key it was read under (owners/spine.ts): its world half decides where it may be drawn. */
  readonly epoch: string
}

export interface KeptReadings {
  /** The answer kept for `key`, if one was kept. */
  get(key: string): KeptAnswer | null
  /** Keep the answer for `key`, or forget it (null). */
  put(key: string, answer: KeptAnswer | null): void
  /** Write what is held now (the window is being hidden or closed). */
  flush(): void
}

/** The record's key in the window's storage, and its schema. */
export const KEPT_KEY = 'oi.owner-readings/v1'
/** The whole record's bound, in characters of its JSON. */
export const KEPT_BYTES = 1_000_000
/** One answer's bound: a larger answer is not kept. */
export const KEPT_ONE_BYTES = 200_000
/** How many answers the record holds at most. */
export const KEPT_COUNT = 256

export interface KeptStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** The kept answers in `storage` (none without one). A write waits `saveAfterMs` after the last answer, so a window answering
 * often writes once; 0 writes at once. */
export function keptReadingsIn(storage: KeptStorage | null, {saveAfterMs = 2_000}: {saveAfterMs?: number} = {}): KeptReadings {
  /** Oldest first: the order the bound lets them go. */
  const held = new Map<string, {answer: KeptAnswer; size: number}>()
  if (storage) {
    try {
      const record = JSON.parse(storage.getItem(KEPT_KEY) ?? 'null') as {schema?: unknown; entries?: unknown} | null
      if (record?.schema === KEPT_KEY && Array.isArray(record.entries)) {
        for (const item of record.entries as [string, KeptAnswer][]) {
          if (Array.isArray(item) && typeof item[0] === 'string' && item[1] && typeof item[1] === 'object') held.set(item[0], {answer: item[1], size: JSON.stringify(item).length})
        }
      }
    } catch { /* an unreadable record is a record not kept */ }
  }
  let timer: ReturnType<typeof setTimeout> | null = null
  const save = () => {
    if (timer) { clearTimeout(timer); timer = null }
    if (!storage) return
    let total = 64
    for (const {size} of held.values()) total += size + 1
    for (const key of held.keys()) {
      if (total <= KEPT_BYTES && held.size <= KEPT_COUNT) break
      total -= (held.get(key)?.size ?? 0) + 1
      held.delete(key)
    }
    try { storage.setItem(KEPT_KEY, JSON.stringify({schema: KEPT_KEY, entries: [...held].map(([key, {answer}]) => [key, answer])})) }
    catch { /* a full store keeps nothing more: the window works without it */ }
  }
  return {
    get: key => held.get(key)?.answer ?? null,
    put(key, answer) {
      held.delete(key)
      if (answer) {
        let size = Infinity
        try { size = JSON.stringify([key, answer]).length } catch { /* an answer that will not serialise is not kept */ }
        if (size <= KEPT_ONE_BYTES) held.set(key, {answer, size})
      }
      if (!storage) return
      if (saveAfterMs <= 0) save()
      else timer ??= setTimeout(save, saveAfterMs)
    },
    flush: save,
  }
}

/** The window's kept answers: its own localStorage where it has one, written when the window is hidden or closed as well. */
export function windowKeptReadings(): KeptReadings | undefined {
  let storage: KeptStorage | null = null
  try { storage = typeof localStorage === 'undefined' ? null : localStorage } catch { storage = null }
  if (!storage || typeof window === 'undefined') return undefined
  const kept = keptReadingsIn(storage)
  window.addEventListener('pagehide', () => kept.flush())
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') kept.flush() })
  return kept
}
