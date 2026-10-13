/**
 * lane-2 T13 — the scale-window minimap's geometry. A pure projection of the one
 * camera the surface already holds (centreYear, pixelsPerYear, widthPx) over the
 * reading domain (the native timeExtent). It owns no state: every value it
 * returns is computed from those inputs, and every move it describes is applied
 * by the surface to the same camera.
 */
import { clampPixelsPerYear } from "./viewport";

export interface YearSpan {
  startYear: number;
  endYear: number;
}

/**
 * The span the person sees: the camera centre, plus or minus half the viewport
 * width in time. The minimap highlights this span, so the bar tracks the view at
 * every zoom and edge drags map against the box that is shown. Fractional years:
 * the highlight is drawn, not queried.
 */
export function visibleSpanForViewport(centerYear: number, pixelsPerYear: number, widthPx: number): YearSpan {
  const halfYears = Math.max(1, widthPx) / clampPixelsPerYear(pixelsPerYear) / 2;
  return { startYear: centerYear - halfYears, endYear: centerYear + halfYears };
}

/**
 * The window the surface fetches the walk for: the padded span. Moved verbatim
 * from TimelineSurface; it is the query window and is not the minimap highlight.
 */
export function timelineWindowForViewport(
  centerYear: number,
  pixelsPerYear: number,
  widthPx: number,
): YearSpan {
  const visibleYears = Math.max(1, widthPx) / clampPixelsPerYear(pixelsPerYear);
  const paddedYears = Math.max(40, visibleYears * 1.5);
  return {
    startYear: Math.floor(centerYear - paddedYears / 2),
    endYear: Math.ceil(centerYear + paddedYears / 2),
  };
}

export function domainSpanYears(domain: YearSpan): number {
  return Math.max(1, domain.endYear - domain.startYear);
}

/** The window's share of the domain, each side clamped to the strip. */
export function minimapExtent(
  window: YearSpan,
  domain: YearSpan,
): { leftFraction: number; rightFraction: number } {
  const span = domainSpanYears(domain);
  const left = clampUnit((window.startYear - domain.startYear) / span);
  const right = clampUnit((window.endYear - domain.startYear) / span);
  return { leftFraction: left, rightFraction: Math.max(left, right) };
}

/**
 * True when the window already holds the whole domain. The strip would then
 * only repeat the axis, so it is hidden.
 */
export function minimapCoversDomain(window: YearSpan, domain: YearSpan): boolean {
  return window.startYear <= domain.startYear && window.endYear >= domain.endYear;
}

/** The year under a strip position, for a press outside the window. */
export function minimapYearAt(domain: YearSpan, stripWidthPx: number, px: number): number {
  return domain.startYear + (px / Math.max(1, stripWidthPx)) * domainSpanYears(domain);
}

/**
 * Drag pan: the centre moves with the pointer, so the window follows it. The
 * drag is measured from the centre the drag started on.
 */
export function minimapPanCentre(
  startCentreYear: number,
  dragPx: number,
  stripWidthPx: number,
  domain: YearSpan,
): number {
  return startCentreYear + (dragPx / Math.max(1, stripWidthPx)) * domainSpanYears(domain);
}

/**
 * Edge drag: the zoom is proportional about the window's centre. A window half
 * that is `startHalfPx` wide when the drag starts, and `targetHalfPx` wide now,
 * scales the zoom by their ratio.
 */
export function minimapZoom(startPixelsPerYear: number, startHalfPx: number, targetHalfPx: number): number {
  return clampPixelsPerYear(startPixelsPerYear * (startHalfPx / Math.max(targetHalfPx, 1)));
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
