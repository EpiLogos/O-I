/**
 * The Expressions/Technè lanes' icon names, in one place. Icons are ONLY the
 * shared `<Glyph name=…/>` drawings; this map names the intent and resolves
 * it to a glyph that exists in `workspace/Glyph.tsx` today. When the shared
 * set gains the intended drawing, change the right-hand side here and
 * nowhere else.
 */
import type {GlyphName} from "../workspace/Glyph";

export const ICON = {
  present: "field",
  flip: "columns",
  share: "link",
  capture: "expand",
  play: "play",
  pause: "pause",
  studio: "studio",
  add: "plus",
  menu: "down",
  check: "check",
  expression: "field",
  scene: "single",
  entity: "agent",
  refresh: "history",
  disperse: "grid",
  reset: "restore",
  restore: "restore",
  close: "close",
  folder: "folder",
  file: "file",
  wiki: "wiki",
  material: "file",
  lens: "search",
  instrument: "instrument",
  open: "detach",
  remove: "close",
  more: "more",
  /* Menu-row category glyphs (FieldMenu items). */
  import: "attach",
  export: "external",
  save: "file",
  formation: "grid",
  saved: "history",
  copy: "copy",
  window: "field",
  colour: "settings",
  shape: "dot",
  dot: "dot",
  square: "stop",
} as const satisfies Record<string, GlyphName>;
