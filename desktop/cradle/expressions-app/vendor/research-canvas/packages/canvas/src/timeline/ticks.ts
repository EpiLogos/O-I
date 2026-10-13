import { ticksForDomain, type Tick } from "./instant";
import { msToPixel, pixelToMs, timeCamera, type TimelineViewport } from "./viewport";

/** One axis mark. `unit` is the authority's rung, carried for the two-row axis (T7). */
export interface AxisTick {
  ms: number;
  px: number;
  label: string;
  unit: Tick["unit"];
}

/** Target count of marks for a track, so the axis keeps a readable density. */
function tickTargetFor(widthPx: number): number {
  return Math.max(2, Math.floor(widthPx / 120));
}

/**
 * Axis marks for the visible window. The authority's `ticksForDomain` decides
 * the rung, the step and the labels; this only places them on the same camera
 * as the cards. `offsetMs` is the civil frame the reading declares (see
 * `commonOffsetMs`).
 */
export function visibleTicks(viewport: TimelineViewport, offsetMs = 0): AxisTick[] {
  const camera = timeCamera(viewport);
  const domain = { fromMs: pixelToMs(camera, 0), toMs: pixelToMs(camera, viewport.widthPx) };
  return ticksForDomain(domain, { offsetMs, targetTicks: tickTargetFor(viewport.widthPx) })
    .map((tick) => ({ ms: tick.ms, px: msToPixel(camera, tick.ms), label: tick.label, unit: tick.unit }));
}

/** The one UTC offset every loaded anchor declares, or 0 when they disagree. The
 * authority derives the civil frame from the reading's own instants, never from a zone database. */
export function commonOffsetMs(items: readonly { offsetMs: number }[]): number {
  if (items.length === 0) return 0;
  const first = items[0].offsetMs;
  return items.every((item) => item.offsetMs === first) ? first : 0;
}
