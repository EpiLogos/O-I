import { ticksForDomain, type Tick } from "./instant";
import { axisLabel, type AxisRow } from "./labels";
import { msToPixel, pixelToMs, timeCamera, type TimeCamera, type TimelineViewport } from "./viewport";

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

/** The least pixel distance two minor marks may stand apart: a readable label spacing (lane-2 T4c). */
export const MIN_AXIS_SPACING_PX = 88;

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

export interface AxisRows {
  /** The coarser row: the next unit above the minor row, labelled with its context. */
  major: AxisTick[];
  /** The authority's ticks for the visible window, at the unit the authority chose. */
  minor: AxisTick[];
}

/** Doublings searched for the next coarser unit. Adjacent ladder rungs differ by at most ~60x, so six doublings reach one. */
const MAX_WIDEN_STEPS = 10;

/**
 * The two-row axis for the visible window. The minor row is `ticksForDomain`
 * over the window: the authority chooses the unit and the step. The major row
 * is the next coarser unit, found without a second ladder: the window is
 * doubled about its centre until `ticksForDomain` names a different unit (the
 * first doubling that changes it is the adjacent coarser rung), and only the
 * marks inside the visible window are kept.
 */
export function axisRows(camera: TimeCamera, offsetMs = 0): AxisRows {
  const targetTicks = tickTargetFor(camera.widthPx);
  const visible = { fromMs: pixelToMs(camera, 0), toMs: pixelToMs(camera, camera.widthPx) };
  // The minor row keeps MIN_AXIS_SPACING_PX between marks: the authority steps
  // its rung down when the chosen step would crowd or leave fewer than two marks.
  const span = visible.toMs - visible.fromMs;
  const minGapMs = camera.widthPx > 0 ? (MIN_AXIS_SPACING_PX * span) / camera.widthPx : undefined;
  const minorTicks = ticksForDomain(visible, { offsetMs, targetTicks, minGapMs });
  const minorUnit = minorTicks[0]?.unit;
  if (minorUnit === undefined) return { major: [], minor: [] };
  const toAxis = (tick: Tick, row: AxisRow): AxisTick => ({
    ms: tick.ms,
    px: msToPixel(camera, tick.ms),
    label: axisLabel(tick.ms, tick.unit, offsetMs, row),
    unit: tick.unit,
  });
  const minor = minorTicks.map((tick) => toAxis(tick, "minor"));
  const centre = (visible.fromMs + visible.toMs) / 2;
  for (let step = 1; step <= MAX_WIDEN_STEPS; step += 1) {
    const half = (span * 2 ** step) / 2;
    const coarser = ticksForDomain({ fromMs: centre - half, toMs: centre + half }, { offsetMs, targetTicks });
    if (coarser.length > 0 && coarser[0].unit !== minorUnit) {
      const major = coarser
        .filter((tick) => tick.ms >= visible.fromMs && tick.ms <= visible.toMs)
        .map((tick) => toAxis(tick, "major"));
      return { major, minor };
    }
  }
  // The coarsest unit has no coarser row above it.
  return { major: [], minor };
}
