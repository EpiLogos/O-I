/**
 * The desktop's one line-glyph set, shared by all live chrome.
 *
 * One drawing system (icon pass 2026-09-17):
 *   - 24-unit viewBox; the live area is 3..21 (3 units of padding). Container
 *     shapes sit on three keylines: the window rect 3..21 × 4..20, the sheet
 *     5.5..18.5 × 3..21 and the r=8.5–9 circle on centre 12,12.
 *   - container corners are rounded with r=2; free terminals land on the
 *     whole/half-unit grid; caps and joins are round.
 *   - ONE stroke weight, drawn non-scaling: the line is the same
 *     `GLYPH_STROKE` CSS pixels at every size, so a 12px mode button, a 13px
 *     menu glyph and a 15px tool read at the same optical weight (the old
 *     1.4-unit stroke rendered 0.7px at 12px and 0.9px at 15px). Parallel
 *     strokes keep ≥4 units apart so nothing clogs at 12px.
 *   - no fills: a state dot is a small stroked circle (`dot`), never a fill.
 *
 * Names are a contract: other files reference them through `GlyphName`.
 * The original names (`chat wiki file field agent search plus studio single
 * arrow down settings history terminal check link`, from the accepted
 * companion study, plus the production additions `folder restore detach`,
 * and the workspace-mode pair `factory instrument`) are all kept; their
 * paths were redrawn onto the grid above.
 */
const GLYPH_STROKE = 1.15;

/** A rounded container rect on the grid. */
const box = (x: number, y: number, w: number, h: number, r = 2) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 01${r} ${r}v${h - 2 * r}a${r} ${r} 0 01-${r} ${r}h-${w - 2 * r}a${r} ${r} 0 01-${r}-${r}v-${h - 2 * r}a${r} ${r} 0 01${r}-${r}z`;
/** A stroked circle. */
const ring = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r}a${r} ${r} 0 100 ${2 * r}a${r} ${r} 0 100-${2 * r}z`;

/** The window keyline every layout glyph shares. */
const WINDOW = box(3, 4, 18, 16);
/** The sheet keyline (a page with a folded corner). */
const SHEET = 'M7.5 3H14l4.5 4.5V19a2 2 0 01-2 2h-9a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v4.5h4.5';
const EYE_OUTLINE = 'M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6z';
const EYE = `${EYE_OUTLINE}${ring(12, 12, 2.5)}`;
const CHEVRON_DOWN = 'M6 9l6 6 6-6';

const paths = {
  /* ---- objects ---------------------------------------------------------- */
  pin: 'M9 3h6l-1 7 4 4H6l4-4zM12 14v7',
  folder: 'M3 7.5A1.5 1.5 0 014.5 6H9l2.2 2.5h8.3A1.5 1.5 0 0121 10v7.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z',
  chat: 'M5 4h14a2 2 0 012 2v9a2 2 0 01-2 2H9.5L5 20.5V17a2 2 0 01-2-2V6a2 2 0 012-2zM7.5 9h9M7.5 13H13',
  file: `${SHEET}M9 13h6M9 17h6`,
  /* Stacked sheets: a material body with more behind it. */
  material: `${box(4, 7, 12, 14)}M8 7V5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2h-2M7.5 12h5M7.5 16h5`,
  /* A closed three-node constellation: a wiki neighbourhood. */
  wiki: `${ring(6, 6, 2)}${ring(18, 10, 2)}${ring(9.5, 18.5, 2)}M7.9 6.6l8.2 2.8M6.5 7.9l2.4 8.7M16.6 11.4l-5.7 5.7`,
  /* Epi-Logos: the authored dawn — a half-risen sun over one horizon line
   * (distinct from the wiki's linked circles and the field's closed polyhedron). */
  epi: 'M3 17h18M5.5 13.5a6.5 6.5 0 0113 0M12 4.5v2.5M6.8 7.3l1.8 1.8M17.2 7.3l-1.8 1.8',
  /* An open branching: a graph to traverse (distinct from the closed wiki). */
  graph: `${ring(6, 12, 2.2)}${ring(18, 5.5, 2.2)}${ring(18, 18.5, 2.2)}M8 11l8-4.4M8 13l8 4.4`,
  field: 'M12 3l7 4v10l-7 4-7-4V7zM5 7l7 4 7-4M12 11v10',
  agent: `${box(4, 7, 16, 13, 2.5)}M12 3v4M9 12v1.5M15 12v1.5M9.5 16.5h5`,
  /* Stacked layers: the context carried into a turn. */
  context: 'M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5',
  terminal: 'M4.5 6.5L10 12l-5.5 5.5M13 17.5h6.5',
  link: 'M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7L11.8 5.2M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7',
  attach: 'M19.5 11.5l-7.8 7.8a5 5 0 01-7.1-7.1l8.2-8.2a3.4 3.4 0 014.8 4.8l-8.1 8.1a1.7 1.7 0 01-2.4-2.4l7.4-7.4',
  report: `${box(5, 3, 14, 18)}M9 16.5v-3M12 16.5V8.5M15 16.5v-5`,
  /* ---- places (the navigator's whole-world destinations) ---------------- */
  home: 'M3.5 11.5L12 4l8.5 7.5M6 9.5V19a1 1 0 001 1h10a1 1 0 001-1V9.5',
  today: `${box(4, 5, 16, 15)}M4 10h16M8.5 3v4M15.5 3v4${ring(12, 15, 1.25)}`,
  explore: `${ring(12, 12, 8.5)}M15.5 8.5l-2 5-5 2 2-5z`,
  /* ---- looking ---------------------------------------------------------- */
  search: `${ring(10.5, 10.5, 7)}M15.5 15.5L21 21`,
  inspect: EYE,
  hide: `${EYE_OUTLINE}M4.5 4.5l15 15`,
  lens: `${ring(12, 12, 8.5)}${ring(12, 12, 3.5)}`,
  /* ---- layout (all on the window keyline) ------------------------------- */
  sidebar: `${WINDOW}M9 4v16`,
  columns: `${WINDOW}M12 4v16`,
  rows: `${WINDOW}M3 12h18`,
  studio: `${WINDOW}M12 4v16M12 12h9`,
  grid: `${WINDOW}M12 4v16M3 12h18`,
  single: WINDOW,
  tabs: `${WINDOW}M3 9h18M10 4v5`,
  list: 'M8.5 6H21M8.5 12H21M8.5 18H21M3.5 6h1M3.5 12h1M3.5 18h1',
  expand: 'M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5',
  /* Two arrows drawing inward: "restore/shrink", never a bare box. */
  restore: 'M4.5 14H10v5.5M10 14l-6.5 6.5M19.5 10H14V4.5M14 10l6.5-6.5',
  /* Expand corners around a plus: release a held focus back to the whole. */
  release: 'M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5M10 12h4M12 10v4',
  detach: 'M14 3.5h6.5V10M20.5 3.5L11 13M10 5.5H5.5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2V14',
  external: 'M8 5h11v11M19 5L5 19',
  /* ---- direction and disclosure ----------------------------------------- */
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  down: CHEVRON_DOWN,
  'chevron-down': CHEVRON_DOWN,
  'chevron-right': 'M9 6l6 6-6 6',
  handoff: 'M3 12h11M10 8l4 4-4 4M17 5h2a2 2 0 012 2v10a2 2 0 01-2 2h-2',
  /* ---- commands --------------------------------------------------------- */
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M4.5 12.5l5 5L19.5 7',
  more: `${ring(5, 12, 1)}${ring(12, 12, 1)}${ring(19, 12, 1)}`,
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  history: 'M3.5 12a8.5 8.5 0 102.6-6.1L3.5 8.5M3.5 4v4.5H8M12 7.5V12l3 2',
  refresh: 'M20.5 12a8.5 8.5 0 11-2.6-6.1l2.6 2.6M20.5 4v4.5H16',
  copy: `${box(9, 9, 12, 12)}M15 9V5a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h4`,
  diff: 'M12 4.5v8M8 8.5h8M8 18.5h8',
  play: 'M7.5 5v14l11-7z',
  stop: box(6, 6, 12, 12),
  pause: 'M9 5.5v13M15 5.5v13',
  /* Voice dictation: a capsule grille on the grid, stand arc, stem. */
  mic: `${box(9, 4, 6, 9, 3)}M5.5 11.5a6.5 6.5 0 0013 0M12 18v3`,
  /* ---- state ------------------------------------------------------------ */
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  verify: 'M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6zM8.5 12l2.5 2.5 4.5-5',
  warning: 'M12 4l9 15.5H3zM12 10v4.5M12 17v.5',
  /* A state dot is a small stroked circle — never a fill. */
  dot: ring(12, 12, 3),
  /* ---- workspace modes (workspace/mode.ts) ------------------------------ */
  /* Factory is a sawtooth works roofline; the Technè instrument is a lens
   * on its stand. */
  factory: 'M3 20V10l6 3.5V10l6 3.5V4h6v16z',
  instrument: `${ring(12, 9, 6)}M12 15v6M7.5 21h9`,
};
export type GlyphName = keyof typeof paths;
export function Glyph({name,size=15}:{name:GlyphName;size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={GLYPH_STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} vectorEffect="non-scaling-stroke"/></svg>;
}
