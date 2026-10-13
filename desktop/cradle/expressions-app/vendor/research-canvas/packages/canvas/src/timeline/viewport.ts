import { MAX_PIXELS_PER_YEAR, MIN_PIXELS_PER_YEAR, MS_PER_YEAR } from "./scale";
import { msToYear, yearToMs } from "./instant";

/** The camera's public unit: years, as the lens props, the controlled
 * viewport and the repository window speak. It is the boundary only. Anchors
 * are placed on the epoch-ms camera below. */
export interface TimelineViewport {
  /** Fractional calendar year at the horizontal centre of the track. */
  centerYear: number;
  /** Horizontal scale. Larger = zoomed in. */
  pixelsPerYear: number;
  /** Pixel width of the track viewport. */
  widthPx: number;
}

/** The camera the placement math runs on: epoch ms, pixels per ms. */
export interface TimeCamera {
  centerMs: number;
  pixelsPerMs: number;
  widthPx: number;
}

export function clampPixelsPerYear(value: number): number {
  if (value < MIN_PIXELS_PER_YEAR) return MIN_PIXELS_PER_YEAR;
  if (value > MAX_PIXELS_PER_YEAR) return MAX_PIXELS_PER_YEAR;
  return value;
}

/** The one conversion from the year-denominated camera to the ms camera. */
export function timeCamera(viewport: TimelineViewport): TimeCamera {
  return {
    centerMs: yearToMs(viewport.centerYear),
    pixelsPerMs: clampPixelsPerYear(viewport.pixelsPerYear) / MS_PER_YEAR,
    widthPx: viewport.widthPx,
  };
}

/** The inverse conversion, used where the camera is handed back as years. */
export function cameraViewport(camera: TimeCamera): TimelineViewport {
  return {
    centerYear: msToYear(camera.centerMs),
    pixelsPerYear: camera.pixelsPerMs * MS_PER_YEAR,
    widthPx: camera.widthPx,
  };
}

export function msToPixel(camera: TimeCamera, ms: number): number {
  return camera.widthPx / 2 + (ms - camera.centerMs) * camera.pixelsPerMs;
}

export function pixelToMs(camera: TimeCamera, px: number): number {
  return camera.centerMs + (px - camera.widthPx / 2) / camera.pixelsPerMs;
}

/** Year-denominated convenience over the same camera (kept for year callers). */
export function yearToPixel(viewport: TimelineViewport, year: number): number {
  return msToPixel(timeCamera(viewport), yearToMs(year));
}

export function pixelToYear(viewport: TimelineViewport, px: number): number {
  return msToYear(pixelToMs(timeCamera(viewport), px));
}

/**
 * Drag the content by deltaPx. Positive delta = content moves right under the
 * cursor (the classic grab-and-drag), so the visible centre moves to an
 * EARLIER time.
 */
export function panByPixels(
  viewport: TimelineViewport,
  deltaPx: number,
): TimelineViewport {
  const camera = timeCamera(viewport);
  return cameraViewport({ ...camera, centerMs: camera.centerMs - deltaPx / camera.pixelsPerMs });
}

/**
 * Multiply zoom by `factor` while keeping the time currently under `anchorPx`
 * pinned to that same pixel.
 */
export function zoomAt(
  viewport: TimelineViewport,
  factor: number,
  anchorPx: number,
): TimelineViewport {
  const camera = timeCamera(viewport);
  const anchorMs = pixelToMs(camera, anchorPx);
  const pixelsPerMs = clampPixelsPerYear(viewport.pixelsPerYear * factor) / MS_PER_YEAR;
  return cameraViewport({
    centerMs: anchorMs - (anchorPx - camera.widthPx / 2) / pixelsPerMs,
    pixelsPerMs,
    widthPx: camera.widthPx,
  });
}
