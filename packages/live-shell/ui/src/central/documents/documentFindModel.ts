// The find line of a document in a pane, pure half (DLW §18.4 "The line anywhere": ⌘F "in a pane … finds in the instrument in front,
// as VS Code's ⌘F finds in the file in front"). The line is DocumentFind.tsx; the page's own find, which marks and counts, is
// desktop/cradle/src/context/document-find.js. VS Code's find widget (1.141, editor/contrib/find/browser/findWidget; O-I
// campaign-evidence/2026-10-29-vscode-workbench-re/DECODE.md) gives the words and the keys: "{0} of {1}", "No results", Next Match on
// Enter and ⌘G, Previous Match on ⇧Enter and ⇧⌘G, Close on Escape.

/** The page's answer to the line: what it found for which words. */
export interface FindAnswer {
  readonly query: string
  readonly count: number
  /** The match in front, counted from 1; 0 when none is. */
  readonly current: number
  /** The page stopped marking at its limit (19999). */
  readonly limited?: boolean
  /** Whether the page could mark the matches (the CSS Custom Highlight API); it still counts and shows them when not. */
  readonly marked?: boolean
}

/** The line's count, in VS Code's words ("{0} of {1}", "No results"); nothing for no words, or for an answer to other words. Pure. */
export function findWords(query: string, answer: FindAnswer | null): string {
  if (!query || !answer || answer.query !== query) return ''
  if (!answer.count) return 'No results'
  return `${answer.current || '?'} of ${answer.count}${answer.limited ? '+' : ''}`
}

/** What a key does in the line. Pure. */
export type FindKey = 'next' | 'previous' | 'close' | 'select'

export function findKeyOf(event: {key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean; altKey: boolean}): FindKey | null {
  const chord = (event.metaKey || event.ctrlKey) && !event.altKey
  if (event.key === 'Escape') return 'close'
  if (event.key === 'Enter' && !chord && !event.altKey) return event.shiftKey ? 'previous' : 'next'
  if (chord && event.key.toLowerCase() === 'g') return event.shiftKey ? 'previous' : 'next'
  if (chord && !event.shiftKey && event.key.toLowerCase() === 'f') return 'select'
  return null
}

/** A message from the page, read: its answer, or a key typed inside it. */
export type PageFindMessage =
  | {readonly kind: 'answer'; readonly request: string | null; readonly answer: FindAnswer; readonly seed?: string}
  | {readonly kind: 'key'; readonly key: 'open' | 'close'; readonly seed: string}

export function pageFindMessage(data: unknown): PageFindMessage | null {
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  if (o.type === 'oi:document-find-result' && typeof o.query === 'string' && typeof o.count === 'number' && typeof o.current === 'number') {
    return {kind: 'answer', request: typeof o.request === 'string' ? o.request : null,
      answer: {query: o.query, count: o.count, current: o.current, limited: o.limited === true, marked: o.marked !== false},
      ...(typeof o.seed === 'string' ? {seed: o.seed} : {})}
  }
  if (o.type === 'oi:document-find-key' && (o.key === 'open' || o.key === 'close')) return {kind: 'key', key: o.key, seed: typeof o.seed === 'string' ? o.seed : ''}
  return null
}
