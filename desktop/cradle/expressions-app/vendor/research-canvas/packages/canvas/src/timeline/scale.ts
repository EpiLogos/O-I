/**
 * Camera scale for the timeline. The time model is the authority's
 * (desktop/cradle/src/techne/m0m5/timeline/scale.ts: expandInstant,
 * ticksForDomain), reached through instant.ts. This file holds only the zoom
 * limits and the display density bands the lens uses for label and card
 * detail. It holds no tier ladder.
 */

/** Mean Gregorian year in ms. This is the authority's ladder year (its LADDER
 * uses 365.2425 days). It converts the camera's year-denominated zoom into
 * ms per pixel. Anchors never place on it. */
export const MS_PER_YEAR = 365.2425 * 86_400_000;

/** The zoom floor lets a deep-time reading fit (lane-2 T4): 1e-9 px per year is
 * about 1e12 years across 1000 px. The previous 0.02 floor capped the view at
 * about 50,000 years across, too narrow for the reading from -780000 to +4.5e9. */
export const MIN_PIXELS_PER_YEAR = 1e-9;
/** 1000 px per millisecond, the authority's finest rung. A subsecond facet keeps
 * its true extent at every zoom the camera allows. */
export const MAX_PIXELS_PER_MS = 1000;
export const MAX_PIXELS_PER_YEAR = MAX_PIXELS_PER_MS * MS_PER_YEAR;

/** Display density bands, in px per year: the lens's label and card detail.
 * These are not time units. They match the thresholds the lens used before. */
export const LABEL_BAND_MIN_PIXELS_PER_YEAR = 0.4;
export const DETAIL_BAND_MIN_PIXELS_PER_YEAR = 8;

export type DensityBand = "marker" | "label" | "detail";

export function densityBandForPixelsPerYear(pixelsPerYear: number): DensityBand {
  if (pixelsPerYear < LABEL_BAND_MIN_PIXELS_PER_YEAR) return "marker";
  if (pixelsPerYear < DETAIL_BAND_MIN_PIXELS_PER_YEAR) return "label";
  return "detail";
}
