/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * glyphMetrics — shared glyph ink measurement + size-box refitting.
 *
 * THE LAW: a glyph always fills its size box. The engine stretches a glyph's
 * ink bounding box to exactly its `size:{x,y}` stage box (entityRuntime
 * normalize() + u.transforms), so display aspect == size-box aspect. When a
 * glyph's text changes the box stays and the new text is distorted.
 * fittedSize recomputes a box for a new glyph so the fill stays visually
 * true: same area, same deliberate stretch, new natural aspect.
 *
 * measureInkBox mirrors the rasterization law of
 * GlyphSampler.rasterizeSpatialNode (src/engine/GlyphSampler.ts:834-848): a
 * 1024x1024 canvas, fontSize = floor(1024*0.7), font =
 * `${fontWeight} ${fontSize}px ${fontFamily}`, shrunk (floored, min 24px)
 * when the advance width exceeds 90% of the canvas. Ink bounds come from
 * measureText's actualBoundingBox* (anchor-independent as a sum), falling
 * back to the advance width + a 0.72em ascent heuristic when a browser
 * omits them. Empty / whitespace-only text measures 'O' (the sampler's
 * `|| 'O'` law); newlines collapse to spaces (multi-line is out of scope).
 *
 * The module imports NOTHING and is DOM-optional so the Node test-suite and
 * server code share one law: without a canvas it measures with a documented,
 * deterministic heuristic instead of throwing.
 */

/** Measured glyph ink bounding box. */
export interface InkBox { width: number; height: number }
/** Entity size box in stage units (1 stage unit = 400 engine px). */
export interface SizeBox { x: number; y: number }

/** Rasterization-law constants — must match GlyphSampler.rasterizeSpatialNode. */
const CANVAS_SIZE = 1024;
const INITIAL_FONT_SIZE = Math.floor(CANVAS_SIZE * 0.7);
const MAX_WIDTH_RATIO = 0.9;
const MIN_FONT_SIZE = 24;

/**
 * Node / no-DOM heuristic factors (exported for tests). Each non-whitespace
 * character contributes ~0.62em of advance ink width, any run is ~0.72em tall,
 * a single glyph is ~0.66em wide (ink is narrower than its advance), and
 * whitespace collapses to nothing. Deliberately crude and deterministic: it
 * exists so pure-logic tests and server use never crash, not to approximate
 * real font metrics. Based on the rasterizer's initial fontSize.
 */
export const HEURISTIC_FACTORS = {
  /** Base em size, mirroring the rasterizer's initial fontSize. */
  baseFontSize: INITIAL_FONT_SIZE,
  /** Ink width per non-whitespace character (em), for runs of 2+. */
  advancePerChar: 0.62,
  /** Ink height of any non-empty string (em). */
  inkHeight: 0.72,
  /** Ink width of a single character (em). */
  singleCharWidth: 0.66,
} as const;

/** Browser fallback when TextMetrics lacks actualBoundingBox*: ink ascent as a fraction of fontSize. */
export const FALLBACK_ASCENT_FACTOR = 0.72;
/** Browser fallback descent fraction (display faces keep ink near the baseline). */
export const FALLBACK_DESCENT_FACTOR = 0.08;

/** Degenerate-input floor: aspects below this count as flat-line. */
const ASPECT_EPSILON = 1e-3;

/**
 * Duplicate of FALLBACK_FONT_STACK (src/engine/GlyphSampler.ts:30). Kept local
 * on purpose: glyphMetrics must import NOTHING (GlyphSampler pulls in three.js
 * and `document`). If the sampler stack ever changes, mirror it here.
 */
const FALLBACK_FONT_STACK =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';

/** Minimal structural view of a 2D measure context — both DOM flavours fit it. */
type MeasureContext = {
  font: string;
  measureText(text: string): {
    width: number;
    actualBoundingBoxLeft?: number;
    actualBoundingBoxRight?: number;
    actualBoundingBoxAscent?: number;
    actualBoundingBoxDescent?: number;
  };
};

let measureCtx: MeasureContext | null = null;
let measureCtxTried = false;

/** Lazily create ONE reusable 1024x1024 measure canvas (OffscreenCanvas first, DOM canvas second). */
function getMeasureContext(): MeasureContext | null {
  if (measureCtxTried) return measureCtx;
  measureCtxTried = true;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const ctx = new OffscreenCanvas(CANVAS_SIZE, CANVAS_SIZE).getContext('2d');
      if (ctx) { measureCtx = ctx; return measureCtx; }
    }
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d');
      if (ctx) measureCtx = ctx;
    }
  } catch {
    measureCtx = null;
  }
  return measureCtx;
}

/**
 * Sampler text law: newlines collapse to spaces (canvas font parsing chokes on
 * them; multi-line is out of scope), then trim + the `|| 'O'` fallback.
 */
function sanitizeText(text: string): string {
  const collapsed = String(text).replace(/\r\n?|\n|\f/g, ' ').trim();
  return collapsed || 'O';
}

/** Set the font exactly per the rasterization law (incl. the 0.9-width shrink); returns the final fontSize. */
function applyRasterizationFont(ctx: MeasureContext, text: string, fontWeight: string | number, fontFamily: string): number {
  let fontSize = INITIAL_FONT_SIZE;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const measured = ctx.measureText(text);
  const maxW = CANVAS_SIZE * MAX_WIDTH_RATIO;
  if (measured.width > maxW) {
    fontSize = Math.max(MIN_FONT_SIZE, Math.floor(fontSize * (maxW / measured.width)));
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  }
  return fontSize;
}

/** The no-DOM measurement: exported factors, whitespace collapses, never empty. */
function heuristicInkBox(effective: string): InkBox {
  const inked = effective.replace(/\s+/g, '');
  const chars = Math.max(inked.length, 1);
  const widthEm = chars === 1 ? HEURISTIC_FACTORS.singleCharWidth : chars * HEURISTIC_FACTORS.advancePerChar;
  return {
    width: widthEm * HEURISTIC_FACTORS.baseFontSize,
    height: HEURISTIC_FACTORS.inkHeight * HEURISTIC_FACTORS.baseFontSize,
  };
}

/**
 * Measure a glyph string's ink bounding box, mirroring the formation
 * rasterization law. Browser: real canvas metrics on ONE reused 1024x1024
 * canvas. Node/no-DOM: the HEURISTIC_FACTORS approximation (only aspects are
 * consumed downstream, so the differing absolute scales are harmless).
 */
export function measureInkBox(
  text: string,
  fontFamily: string = FALLBACK_FONT_STACK,
  fontWeight: string | number = 900
): InkBox {
  const effective = sanitizeText(text);
  const ctx = getMeasureContext();
  if (!ctx) return heuristicInkBox(effective);

  const fontSize = applyRasterizationFont(ctx, effective, fontWeight, fontFamily);
  const m = ctx.measureText(effective);
  const bbL = m.actualBoundingBoxLeft, bbR = m.actualBoundingBoxRight;
  const bbA = m.actualBoundingBoxAscent, bbD = m.actualBoundingBoxDescent;
  const hasInkBox = typeof bbL === 'number' && Number.isFinite(bbL)
    && typeof bbR === 'number' && Number.isFinite(bbR)
    && typeof bbA === 'number' && Number.isFinite(bbA)
    && typeof bbD === 'number' && Number.isFinite(bbD);
  // actualBoundingBox* are anchor-relative; their sums (left+right, ascent+descent) are not.
  const width = hasInkBox ? (bbL as number) + (bbR as number) : m.width;
  const height = hasInkBox
    ? (bbA as number) + (bbD as number)
    : fontSize * (FALLBACK_ASCENT_FACTOR + FALLBACK_DESCENT_FACTOR);
  return { width: Math.max(width, ASPECT_EPSILON), height: Math.max(height, ASPECT_EPSILON) };
}

/** width/height of an ink box, floored at ASPECT_EPSILON for degenerate inputs. */
export function inkAspect(box: InkBox): number {
  const height = typeof box.height === 'number' && Number.isFinite(box.height) ? Math.abs(box.height) : 0;
  const width = typeof box.width === 'number' && Number.isFinite(box.width) ? box.width : 0;
  return Math.max(width / Math.max(height, ASPECT_EPSILON), ASPECT_EPSILON);
}

/**
 * Refit a size box around a new glyph's natural ink aspect.
 *
 * The law: `stretch = (box.x/box.y) / prevGlyphAspect` is the author's
 * deliberate distortion ratio (how much wider the box is than the glyph's
 * natural ink). The swapped box keeps `area = box.x * box.y` and that same
 * stretch, adopting `nextAspect = nextGlyphAspect * stretch`:
 * `x = sqrt(area*nextAspect)`, `y = sqrt(area/nextAspect)`.
 *
 * `prevGlyphAspect === null` means "unknown prior glyph" (primitive/missing
 * measurement): the box is treated as already matching its glyph, i.e.
 * stretch 1. Clamp is aspect-preserving: if any axis leaves
 * [clampMin, clampMax] both axes scale uniformly so the larger axis sits
 * exactly on the violated bound; only when the requested aspect exceeds the
 * clamp window's own limit (clampMax/clampMin) do the axes pin individually.
 * Never returns non-finite or <= 0 values.
 */
export function fittedSize(
  box: SizeBox,
  prevGlyphAspect: number | null,
  nextGlyphAspect: number,
  clampMin = 0.01,
  clampMax = 4
): SizeBox {
  const min = Number.isFinite(clampMin) && clampMin > 0 ? clampMin : ASPECT_EPSILON;
  const max = Number.isFinite(clampMax) && clampMax >= min ? clampMax : min;
  const bx = Number.isFinite(box.x) && box.x > 0 ? box.x : min;
  const by = Number.isFinite(box.y) && box.y > 0 ? box.y : min;

  const prev = prevGlyphAspect !== null && Number.isFinite(prevGlyphAspect) && prevGlyphAspect > 0
    ? prevGlyphAspect
    : null;
  const stretch = prev === null ? 1 : (bx / by) / prev;
  const next = Number.isFinite(nextGlyphAspect) && nextGlyphAspect > 0 ? nextGlyphAspect : 1;
  const nextAspect = Math.max(next * stretch, ASPECT_EPSILON);

  const area = bx * by;
  let x = Math.sqrt(area * nextAspect);
  let y = Math.sqrt(area / nextAspect);

  // Aspect-preserving clamp: uniform scale so the violated larger axis lands on its bound.
  const larger = Math.max(x, y);
  const smaller = Math.min(x, y);
  if (larger > max) {
    const s = max / larger;
    x *= s; y *= s;
  } else if (smaller < min) {
    const s = min / smaller;
    x *= s; y *= s;
  }
  // Hard guarantee for aspects beyond the clamp window: pin each axis.
  x = Math.min(max, Math.max(min, x));
  y = Math.min(max, Math.max(min, y));
  return {
    x: Number.isFinite(x) ? x : min,
    y: Number.isFinite(y) ? y : min,
  };
}
