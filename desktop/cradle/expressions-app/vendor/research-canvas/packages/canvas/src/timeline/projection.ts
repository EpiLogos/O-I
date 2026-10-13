import type { GraphNode, TemporalPrecision, TimelineLane, TimelineViewNode } from "./contracts";
import { densityBandForPixelsPerYear } from "./scale";
import { anchorExtent, anchorOffsetMs, calendarYear } from "./instant";
import { msToPixel, timeCamera, type TimelineViewport } from "./viewport";
import { standingOf, type StandingReading } from "../../../../../../../src/techne/m0m5/timeline/standing";

export interface TimelineItem {
  graphNodeId: string;
  node: GraphNode;
  /** See TimelineViewNode.relationCompanion: contextual, not historical. */
  relationCompanion?: boolean;
  presentation: TimelinePresentation;
  /** The facet's own uncertainty string, verbatim (PeriodO's law: the source's text is authoritative). Null when none is stated. */
  uncertainty: string | null;
  /** standingOf over the facet's disclosed fields: its uncertainty text read as the standing, and its source ref. Never upgraded. */
  standing: StandingReading;
  /** The honest extent in epoch ms: the authority's expansion at the anchor's own precision. */
  startMs: number;
  /** null = ongoing / open-ended (no validTo). */
  endMs: number | null;
  /** The authority's expansion of the start instant at its own precision: the end of that unit. */
  precisionEndMs: number;
  /** UTC offset the anchor's own start declares, in ms. */
  offsetMs: number;
  /** Integer calendar years of the extent, for labels only. Never a coordinate. */
  startYear: number;
  endYear: number | null;
  precision: TemporalPrecision;
}

export interface TimelinePresentation {
  lane: string | null;
  offsetY: number;
  width: number;
  height: number;
  style: Record<string, unknown> & { dotColour?: string; bgColour?: string; textColour?: string };
  layoutRevision: number | null;
}

export interface PlacedItem {
  item: TimelineItem;
  startPx: number;
  endPx: number;
  /** Collision-resolved display position; authored offsetY remains unchanged. */
  cardTop?: number;
  /** Actual card display height at the current level of detail. */
  cardHeight?: number;
  laneIndex: number;
  laneSide: "above" | "below";
}

export const DEFAULT_TIMELINE_CARD_WIDTH_PX = 240;
export const DEFAULT_TIMELINE_CARD_HEIGHT_PX = 72;
/**
 * The persisted layout schema requires a lane, but the timeline has no manual
 * lane picker. This fallback remains collision-aware automatic placement.
 */
export const FALLBACK_TIMELINE_LANE_ID = "events";
const VIEWPORT_EDGE_FADE_PX = 96;
const CARD_GAP_PX = 16;
const LANE_ORDER: readonly PlacedItem["laneSide"][] = [
  "above",
  "below",
  "above",
  "below",
  "above",
  "below",
  "above",
  "below",
];

/**
 * Keep only temporally-located nodes with a parseable validFrom and project
 * them onto a numeric year axis. Non-temporal nodes are not timeline items:
 * their relation to history is available through a focused relation field,
 * rather than through a fabricated temporal anchor. Sorted ascending by
 * startYear.
 */
export function projectNodes(records: TimelineViewNode[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const record of records) {
    const { node, anchor, layoutOverride } = record;
    if (!node.isTemporal) continue;
    const extent = anchorExtent(anchor.validFrom, anchor.validTo, anchor.precision);
    if (extent === null) continue;
    // The facet's own disclosed fields, carried verbatim on the anchor (T3). Absent means none stated.
    const uncertainty = typeof anchor.uncertainty === "string" && anchor.uncertainty.length > 0 ? anchor.uncertainty : null;
    const sourceRef = typeof anchor.source_ref === "string" ? anchor.source_ref : null;
    items.push({
      graphNodeId: node.graphNodeId,
      node,
      relationCompanion: false,
      uncertainty,
      standing: standingOf({ standing: uncertainty, source_ref: sourceRef }),
      presentation: {
        lane: layoutOverride?.lane ?? null,
        offsetY: layoutOverride?.offsetY ?? 0,
        width: layoutOverride?.width ?? DEFAULT_TIMELINE_CARD_WIDTH_PX,
        height: layoutOverride?.height ?? DEFAULT_TIMELINE_CARD_HEIGHT_PX,
        style: layoutOverride?.style ?? {},
        layoutRevision: layoutOverride?.layoutRevision ?? null,
      },
      startMs: extent.fromMs,
      endMs: extent.toMs,
      precisionEndMs: extent.instantToMs,
      offsetMs: anchorOffsetMs(anchor.validFrom),
      startYear: calendarYear(extent.fromMs),
      endYear: extent.toMs === null ? null : calendarYear(extent.toMs - 1),
      precision: anchor.precision,
    });
  }
  items.sort((a, b) => a.startMs - b.startMs);
  return items;
}

/**
 * The honest band of an item: from its extent start to its extent end. An
 * interval ends at its own expanded end; a point is the authority's expansion
 * of its instant at that instant's own precision. A band wider than a point is
 * drawn as a band; the label states the precision (labels.ts). Equal to
 * `expandInstant` output (timeline-bands-axis.test.mjs).
 */
export function bandExtent(
  item: Pick<TimelineItem, "startMs" | "endMs" | "precisionEndMs">,
): { fromMs: number; toMs: number } {
  return { fromMs: item.startMs, toMs: item.endMs ?? item.precisionEndMs };
}

export function placeItems(
  items: TimelineItem[],
  viewport: TimelineViewport,
  laneDefinitions: TimelineLane[] = [],
): PlacedItem[] {
  const camera = timeCamera(viewport);
  const explicitIds = Array.from(new Set([
    ...laneDefinitions.map((lane) => lane.id).filter(isExplicitPlacementLane),
    ...items
      .map((item) => item.presentation.lane)
      .filter((lane): lane is string => lane !== null && isExplicitPlacementLane(lane))
      .sort(),
  ]));
  const explicitSlots = new Map(explicitIds.map((id, index) => [id, index]));
  const laneEnds = new Array(LANE_ORDER.length).fill(Number.NEGATIVE_INFINITY);
  const occupied: ReturnType<typeof timelineCardBounds>[] = [];
  return items.map((item) => {
    const startPx = msToPixel(camera, item.startMs);
    const endPx = msToPixel(camera, bandExtent(item).toMs);
    const explicitSlot = item.presentation.lane !== null && isExplicitPlacementLane(item.presentation.lane)
      ? explicitSlots.get(item.presentation.lane)
      : undefined;
    const width = cardWidth(item.presentation);
    const autoSlot = chooseLaneSlot(laneEnds, startPx - width / 2);
    const laneSlot = explicitSlot ?? explicitIds.length + autoSlot;
    if (explicitSlot === undefined) laneEnds[autoSlot] = startPx + width / 2 + CARD_GAP_PX;
    const placed: PlacedItem = {item,startPx,endPx,laneIndex:Math.floor(laneSlot / 2),laneSide:LANE_ORDER[laneSlot % LANE_ORDER.length],...(densityBandForPixelsPerYear(viewport.pixelsPerYear)==='label'?{cardHeight:64}:{})};
    let bounds=timelineCardBounds(placed);
    // Cards are centred on their exact dates. Expand vertically rather than
    // reusing an occupied slot, merging events or changing authored layout.
    const horizontal=occupied.filter(other=>bounds.left<other.right+CARD_GAP_PX&&bounds.right+CARD_GAP_PX>other.left);
    for(let attempts=0;attempts<=horizontal.length;attempts++){
      const collisions=horizontal.filter(other=>bounds.top<other.bottom+CARD_GAP_PX&&bounds.bottom+CARD_GAP_PX>other.top);
      if(!collisions.length)break;
      placed.cardTop=placed.laneSide==='above'
        ? Math.min(...collisions.map(other=>other.top))-CARD_GAP_PX-bounds.height
        : Math.max(...collisions.map(other=>other.bottom))+CARD_GAP_PX;
      bounds=timelineCardBounds(placed);
    }
    placed.cardTop=bounds.top;occupied.push(bounds);return placed;
  });
}

function isExplicitPlacementLane(lane: string): boolean {
  return lane !== FALLBACK_TIMELINE_LANE_ID;
}

export interface CardViewportFadeInput {
  startPx: number;
  positionX: number;
  width: number;
  viewportWidth: number;
  fadeDistancePx?: number;
}

export interface CardViewportFade {
  left: number;
  right: number;
  edge: "left" | "right" | "both" | "none";
}

export function computeCardViewportFade({
  startPx,
  positionX,
  width,
  viewportWidth,
  fadeDistancePx = VIEWPORT_EDGE_FADE_PX,
}: CardViewportFadeInput): CardViewportFade {
  if (viewportWidth <= 0 || fadeDistancePx <= 0) {
    return { left: 0, right: 0, edge: "none" };
  }

  const cardLeft = startPx + positionX - width / 2;
  const cardRight = cardLeft + width;
  const left = clamp01((fadeDistancePx - cardLeft) / fadeDistancePx);
  const right = clamp01((fadeDistancePx - (viewportWidth - cardRight)) / fadeDistancePx);
  const edge = left > 0 && right > 0 ? "both" : left > 0 ? "left" : right > 0 ? "right" : "none";
  return { left, right, edge };
}

function cardWidth(presentation: TimelinePresentation): number {
  return Math.min(520,Math.max(180,presentation.width || DEFAULT_TIMELINE_CARD_WIDTH_PX));
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.round(value * 1000) / 1000;
}

function chooseLaneSlot(laneEnds: number[], startPx: number): number {
  const openSlot = laneEnds.findIndex((endPx) => endPx <= startPx);
  if (openSlot !== -1) return openSlot;

  laneEnds.push(Number.NEGATIVE_INFINITY);
  return laneEnds.length - 1;
}

/** One display rectangle for cards, connectors, collision and viewport bounds. */
export function timelineCardBounds(placed:PlacedItem){
 const width=cardWidth(placed.item.presentation),height=placed.cardHeight??Math.min(260,Math.max(72,placed.item.presentation.height||DEFAULT_TIMELINE_CARD_HEIGHT_PX));
 const laneOffset=68+placed.laneIndex*78;
 const top=placed.cardTop??(placed.laneSide==='above'?-laneOffset-height+placed.item.presentation.offsetY:laneOffset+placed.item.presentation.offsetY);
 return {left:placed.startPx-width/2,right:placed.startPx+width/2,top,bottom:top+height,width,height,
  connectorOffset:Math.max(16,placed.laneSide==='above'?-(top+height):top)};
}
