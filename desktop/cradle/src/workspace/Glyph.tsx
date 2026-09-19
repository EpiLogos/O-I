/**
 * The accepted companion's small line glyphs, shared by live desktop chrome.
 * The `chat wiki file field agent search plus studio single arrow down
 * settings history terminal check link` paths are taken verbatim from the
 * study's own icon set (`src/study/WorkspaceStudy.tsx`) so the tab-bar kind
 * glyphs and shell iconography read as the same drawing system; `folder`,
 * `restore` and `detach` are production-only additions the studies never
 * needed. The 2026-09-19 canvas-context lane adds the region-companion
 * control (a quiet half-panel with a presence dot, not the boxed `sidebar`
 * glyph) and the format-aware editing marks used by the shared editor
 * toolbar; all follow the same 24×24 stroke drawing system.
 */
const paths = {
  pin: 'M9 3h6l-1 7 4 4H6l4-4zM12 14v7',
  folder: 'M3 6h7l2 2h9v12H3zM3 6V4h7l2 2',
  chat: 'M3 4h18v13H9l-5 4v-4H3zM7 8h10m-10 4h7',
  file: 'M6 2h8l4 4v16H6zM14 2v5h4M9 12h6m-6 4h6',
  wiki: 'M5 5l13 5M5 5l4 14m9-9l-9 9M5 3v4m-2-2h4m11 3v4m-2-2h4M9 17v4m-2-2h4',
  field: 'M5 7l7-4 7 4v10l-7 4-7-4zM5 7l7 5 7-5M12 12v9',
  agent: 'M5 7h14v12H5zM12 3v4M8 12h1m6 0h1M9 16h6',
  search: 'M10 3a7 7 0 100 14 7 7 0 000-14m5 12l6 6',
  plus: 'M12 5v14M5 12h14',
  sidebar: 'M3 4h18v16H3zM9 4v16',
  columns: 'M3 4h18v16H3zM12 4v16',
  rows: 'M3 4h18v16H3zM3 12h18',
  studio: 'M3 4h18v16H3zM12 4v16m0-8h9',
  grid: 'M3 4h18v16H3zM12 4v16M3 12h18',
  single: 'M3 4h18v16H3z',
  arrow: 'M5 12h14m-6-6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  history: 'M3 12a9 9 0 119 9M3 4v8h8M12 7v5l4 3',
  terminal: 'M4 6l6 6-6 6m9 0h7',
  check: 'M5 12l4 4L19 6',
  link: 'M9 15l6-6M8 17l-1 1a4 4 0 01-6-6l4-4m11-1l1-1a4 4 0 016 6l-4 4',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  /* Distinct from `single` (a plain 18×16 rectangle): two corner brackets
   * drawing inward with a diagonal reads as "restore/shrink" rather than an
   * unreadable bare box (finding 22). */
  restore: 'M4 14h6v6M4 14l7 7M20 10h-6V4M20 10l-7-7',
  detach: 'M14 3h7v7m0-7L10 14M10 5H3v16h16v-7',
  more: 'M4 12h1m6 0h1m6 0h1',
  close: 'M6 6l12 12M18 6L6 18',
  /* Companion region (2026-09-19): a soft half-panel with a presence dot —
   * quiet at rest, direction-neutral, unlike the boxed `sidebar` glyph it
   * replaces on the right region. */
  companion: 'M13 4h4a3 3 0 013 3v10a3 3 0 01-3 3h-4M16.5 12h.01M13 8v8',
  /* Add-to-context (the anchored selection chip and its menu item): a
   * passage with a small plus — material joining context, not a document. */
  context: 'M8 6h9M8 10h6M15 15h5M17.5 12.5v5',
  edit: 'M14 5l5 5L8 21H3v-5zM12 7l5 5',
  undo: 'M8 5L4 9l4 4M4 9h11a5 5 0 015 5v1',
  redo: 'M16 5l4 4-4 4M20 9H9a5 5 0 00-5 5v1',
  bold: 'M8 5h5a3.5 3.5 0 010 7H8zM8 12h6a3.5 3.5 0 010 7H8z',
  italic: 'M11 5h6M7 19h6M14 5l-4 14',
  strike: 'M5 12h14M8 7c0-1.7 1.8-3 4-3 1.8 0 3.3.8 3.8 2M16 17c0 1.7-1.8 3-4 3-1.8 0-3.3-.8-3.8-2',
  code: 'M9 8l-4 4 4 4M15 8l4 4-4 4',
  quote: 'M6 16c-1-3 0-6 3-8M6 16h4v4H6zM14 16c-1-3 0-6 3-8M14 16h4v4h-4z',
  list: 'M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01',
  task: 'M4 6l2 2 3-3M4 15l2 2 3-3M12 7h8M12 16h8',
  image: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 15l4-4 5 5M14 13l2-2 4 4M15.5 8.5h.01',
  table: 'M4 5h16v14H4zM4 10h16M10 5v14',
  heading: 'M6 5v14M18 5v14M6 12h12',
  comment: 'M4 5h16v11H10l-5 4v-4H4z',
  indent: 'M4 5h16M9 10h11M9 15h11M4 9.5L7 12l-3 2.5',
  outdent: 'M4 5h16M9 10h11M9 15h11M7 9.5L4 12l3 2.5',
  braces: 'M8 4c-2 0-3 1-3 3v2c0 1-1 2-2 2 1 0 2 1 2 2v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1 1 2 2 2-1 0-2 1-2 2v2c0 2-1 3-3 3',
};
export function Glyph({name,size=15}:{name:keyof typeof paths;size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
