/**
 * lane-2 T12 — honest clusters at the broad display tier.
 *
 * At the marker band many placements overlap. The authority's `aggregate()`
 * (desktop/cradle/src/techne/m0m5/timeline/lanes.ts) assigns each item, by its
 * centre, to one bucket of the window. A bucket holding two or more items is
 * one cluster, and its membership is exactly that bucket's `item_ids`; nothing
 * is re-bucketed here. A cluster is a count, labelled as a count, and is never
 * drawn as an event. Pure: no React, no store.
 */
import { aggregate, type TimelineLane } from "../../../../../../../src/techne/m0m5/timeline/lanes";
import type { TimelineCategory } from "./categories";
import { msToYear } from "./instant";
import { spanLabel } from "./labels";
import { MS_PER_YEAR } from "./scale";

/** The only category that is an event. Every other category is an item. */
const EVENT_CATEGORIES: ReadonlySet<TimelineCategory> = new Set<TimelineCategory>(["historical-event"]);

export interface ClusterableItem {
  /** The item's honest extent start, epoch ms. */
  fromMs: number;
  /** The item's honest extent end, exclusive epoch ms. */
  toMs: number;
  /** The item's category; a cluster takes its members' dominant category. */
  category: TimelineCategory;
}

export interface BroadCluster {
  /** Indices into the input array: exactly the authority bucket's members, in input order. */
  memberIndexes: number[];
  /** The number of members. A count, never a drawn event. */
  count: number;
  /** The union of the members' extents: the span the cluster stands for. */
  fromMs: number;
  toMs: number;
  /** The members' dominant category, for colour. */
  category: TimelineCategory;
  /** True only when every member is an event; otherwise the cluster counts items. */
  allEvents: boolean;
}

/** The bucket count the authority's aggregate defaults to. */
export const BROAD_BUCKET_COUNT = 48;

/** A cluster's zoom fills this share of the width, so the span sits inside the view. */
const CLUSTER_ZOOM_FILL = 0.8;
/** Estimated label advance for the 10px monospace cluster label, and its padding. */
const LABEL_CHAR_PX = 6.2;
const LABEL_PAD_PX = 14;

/**
 * Clusters at the broad tier. Buckets with one item are not clusters: that item
 * keeps its own card. Items outside the window are not bucketed and are not
 * clustered. Every clustered item appears in exactly one cluster.
 */
export function clusterBroadItems(
  items: readonly ClusterableItem[],
  window: { fromMs: number; toMs: number },
  bucketCount: number = BROAD_BUCKET_COUNT,
): BroadCluster[] {
  const lane: TimelineLane = {
    id: "broad-placements",
    owner: "events",
    label: "Events",
    ref: null,
    items: items.map((item, index) => ({
      // The authority reads only the extent. The id is the input index, so
      // two items sharing a node id cannot merge.
      id: String(index),
      facet_ref: null,
      kind: "occurrence",
      lane_id: "broad-placements",
      positioned: true,
      fromMs: item.fromMs,
      toMs: item.toMs,
    })),
  };
  const [aggregation] = aggregate([lane], window, bucketCount);
  const clusters: BroadCluster[] = [];
  for (const bucket of aggregation.buckets) {
    if (bucket.count < 2) continue;
    const memberIndexes = bucket.item_ids.map(Number);
    const members = memberIndexes.map((index) => items[index]);
    clusters.push({
      memberIndexes,
      count: members.length,
      fromMs: members.reduce((least, member) => Math.min(least, member.fromMs), Number.POSITIVE_INFINITY),
      toMs: members.reduce((most, member) => Math.max(most, member.toMs), Number.NEGATIVE_INFINITY),
      category: dominantCategory(members),
      allEvents: members.every((member) => EVENT_CATEGORIES.has(member.category)),
    });
  }
  return clusters;
}

/** The category most members carry. Ties go to the category seen first. */
function dominantCategory(members: readonly ClusterableItem[]): TimelineCategory {
  const tally = new Map<TimelineCategory, number>();
  for (const member of members) tally.set(member.category, (tally.get(member.category) ?? 0) + 1);
  let best = members[0].category;
  let bestCount = 0;
  for (const [category, count] of tally) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The cluster's label: "N events, <span>" when every member is an event, otherwise
 * "N items, <span>". The count is always the authority bucket's member count.
 */
export function clusterLabel(cluster: BroadCluster, offsetMs: number): string {
  const noun = cluster.allEvents ? "events" : "items";
  return `${cluster.count} ${noun}, ${spanLabel(cluster.fromMs, cluster.toMs, offsetMs)}`;
}

/**
 * The camera that frames a cluster's span: centred on it, filling most of the
 * width. Returned unclamped; the store clamps the zoom when it is set.
 */
export function clusterZoomView(
  span: { fromMs: number; toMs: number },
  widthPx: number,
): { centerYear: number; pixelsPerYear: number } {
  const spanYears = Math.max(span.toMs - span.fromMs, 1) / MS_PER_YEAR;
  return {
    centerYear: msToYear((span.fromMs + span.toMs) / 2),
    pixelsPerYear: (Math.max(1, widthPx) * CLUSTER_ZOOM_FILL) / spanYears,
  };
}

/** The estimated on-screen width of a cluster label, for row placement. */
export function clusterLabelWidthPx(label: string): number {
  return Math.ceil(label.length * LABEL_CHAR_PX) + LABEL_PAD_PX;
}

/**
 * Rows for cluster labels: a label takes the first row whose last label ends
 * before it starts (plus a gap). Past `maxRows`, a label takes the row that
 * ends soonest, so the least text overlaps. Returns a row index per mark.
 */
export function clusterRows(
  marks: readonly { left: number; width: number }[],
  options: { gapPx?: number; maxRows?: number } = {},
): number[] {
  const gap = options.gapPx ?? 8;
  const maxRows = Math.max(1, options.maxRows ?? 3);
  const rows = new Array<number>(marks.length).fill(0);
  const rowEnds: number[] = [];
  const order = marks.map((_, index) => index).sort((a, b) => marks[a].left - marks[b].left);
  for (const index of order) {
    const mark = marks[index];
    let row = rowEnds.findIndex((end) => mark.left >= end + gap);
    if (row === -1) {
      if (rowEnds.length < maxRows) {
        row = rowEnds.length;
        rowEnds.push(Number.NEGATIVE_INFINITY);
      } else {
        row = rowEnds.indexOf(Math.min(...rowEnds));
      }
    }
    rows[index] = row;
    rowEnds[row] = mark.left + mark.width;
  }
  return rows;
}
