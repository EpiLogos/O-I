/**
 * The accepted companion's small line glyphs, shared by live desktop chrome.
 * The `chat wiki file field agent search plus studio single arrow down
 * settings history terminal check link` paths are taken verbatim from the
 * study's own icon set (`src/study/WorkspaceStudy.tsx`) so the tab-bar kind
 * glyphs and shell iconography read as the same drawing system; `folder`,
 * `restore` and `detach` are production-only additions the studies never
 * needed.
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
};
export function Glyph({name,size=15}:{name:keyof typeof paths;size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
