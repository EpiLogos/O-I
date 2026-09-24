import { tickIntervalYears, type ScaleTier } from "./scale";
import { pixelToYear, yearToPixel, type TimelineViewport } from "./viewport";

export interface AxisTick {
  year: number;
  px: number;
  label: string;
}

export function formatYearLabel(year: number, _tier: ScaleTier): string {
  const rounded = Math.round(year);
  if (rounded <= 0) return `${1 - rounded} BCE`;
  return `${rounded} CE`;
}

/**
 * Emit one tick per `tickIntervalYears(tier)` boundary across the visible
 * range, padded by one interval on each side so partial ticks render at the
 * edges. Ascending by year/px.
 */
export function generateTicks(
  viewport: TimelineViewport,
  tier: ScaleTier,
): AxisTick[] {
  // Tier boundaries determine precision, while screen distance determines
  // readable label density. Keep the complete time range at every zoom.
  const baseInterval = tickIntervalYears(tier);
  const required = Math.max(1, 88 / (baseInterval * viewport.pixelsPerYear));
  const magnitude = 10 ** Math.floor(Math.log10(required));
  const multiplier = [1, 2, 5, 10].find(value => value * magnitude >= required)! * magnitude;
  const interval = baseInterval * multiplier;
  const leftYear = pixelToYear(viewport, 0);
  const rightYear = pixelToYear(viewport, viewport.widthPx);

  const firstTick = Math.floor(leftYear / interval) * interval - interval;
  const lastTick = Math.ceil(rightYear / interval) * interval + interval;

  const ticks: AxisTick[] = [];
  for (let year = firstTick; year <= lastTick; year += interval) {
    ticks.push({
      year,
      px: yearToPixel(viewport, year),
      label: formatYearLabel(year, tier),
    });
  }
  return ticks;
}
