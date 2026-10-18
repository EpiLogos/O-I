// The workspace book's native owner (desktop/cradle/src-tauri/src/workspace_book.rs; T-WORLDS §3, W1): the book lives in the
// candidate's own data home with a revision per write, and the browser's storage is only the shell's working copy of it (the book
// store reads it while rendering, desktop/cradle/src/workspace/store.ts). Before the book mounts, a native book of another revision
// than the one this window last kept stands over the working copy; after each change the book is kept on the owner, on the revision
// last read. A book that moved since (another start, another window) is read again and kept on its revision: the shell's book is the
// newer, and the owner keeps the copy it replaced in its history, so nothing is lost. Pure over its host and storage.

export interface NativeBookReading {
  readonly book: unknown | null
  readonly revision: string | null
  readonly history?: readonly string[]
}
export interface BookHost {
  read(): Promise<NativeBookReading>
  write(expected: string | null, book: unknown): Promise<{revision: string; unchanged?: boolean}>
}
export interface BookStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Where the window records the revision it last kept on the owner (beside the book's own key). */
export const nativeRevisionKey = (bookKey: string): string => `${bookKey}.native-revision`

/** Before the book mounts: the owner's book stands over the working copy when it is of another revision than the one this window
 * last kept (or the window holds none); with no native book, the working copy stands and is kept on the first change. */
export async function seedFromNative(host: BookHost, storage: BookStorage, bookKey: string): Promise<{seeded: boolean; revision: string | null; fault?: string}> {
  let reading: NativeBookReading
  try { reading = await host.read() } catch (cause) {
    return {seeded: false, revision: storage.getItem(nativeRevisionKey(bookKey)), fault: `The workspace book's owner did not answer (${cause instanceof Error ? cause.message : String(cause)}); the working copy stands.`}
  }
  if (!reading.book || !reading.revision) return {seeded: false, revision: null}
  const kept = storage.getItem(nativeRevisionKey(bookKey))
  if (kept === reading.revision && storage.getItem(bookKey)) return {seeded: false, revision: reading.revision}
  storage.setItem(bookKey, JSON.stringify(reading.book))
  storage.setItem(nativeRevisionKey(bookKey), reading.revision)
  return {seeded: true, revision: reading.revision}
}

/** The keeper: each change is kept on the owner after a short pause (a drag's burst of changes is one write); a moved book is read
 * again and kept on its revision once. `faults` hears what the owner refused, in its words. */
export function createBookKeeper(host: BookHost, storage: BookStorage, bookKey: string, faults: (words: string | null) => void, delayMs = 400) {
  let revision = storage.getItem(nativeRevisionKey(bookKey))
  let pending: unknown = undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let writing: Promise<void> = Promise.resolve()
  const keepNow = async (book: unknown): Promise<void> => {
    const attempt = async (on: string | null) => {
      const kept = await host.write(on, book)
      revision = kept.revision
      storage.setItem(nativeRevisionKey(bookKey), kept.revision)
    }
    try { await attempt(revision); faults(null) } catch (first) {
      try {
        const moved = await host.read()
        await attempt(moved.revision)
        faults(null)
      } catch (second) {
        faults(`The workspace book could not be kept by its owner: ${second instanceof Error ? second.message : String(second ?? first)}`)
      }
    }
  }
  const flush = (): Promise<void> => {
    if (timer !== undefined) { clearTimeout(timer); timer = undefined }
    if (pending === undefined) return writing
    const book = pending
    pending = undefined
    writing = writing.then(() => keepNow(book))
    return writing
  }
  return {
    keep(book: unknown): void {
      pending = book
      if (timer === undefined) timer = setTimeout(() => { timer = undefined; void flush() }, delayMs)
    },
    flush,
    revision: () => revision,
  }
}
