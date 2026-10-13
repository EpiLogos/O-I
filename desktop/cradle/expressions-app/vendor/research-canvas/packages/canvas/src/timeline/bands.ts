/**
 * Period bands (lane-2 T8: reigns, dynasties, wars, eras) — the pure reading.
 *
 * A band is a validity span the reading names. The source's own label is the
 * band (PeriodO's law) and is carried verbatim; the range only draws it. The
 * drawn range is the authority's expansion of the disclosed earliest and latest
 * at their own precisions (instant.ts → expandInstant, scale.ts), never a
 * ladder of this file's own. A band the reading does not place, does not end,
 * does not label, or gives no width is listed as absent, never drawn.
 *
 * Standing comes only from the authority's standingOf over the band's disclosed
 * uncertainty and source ref. One rule is added for bands: a labelled band the
 * reading discloses no source for is the owner's own assertion ("authored"),
 * not "unavailable" — the reading names it, so it is not unknown.
 */
import type { TimelineView } from "./contracts";
import { canonicalInstant, expandInstant } from "./instant";
import { msToPixel, type TimeCamera } from "./viewport";
import { standingOf, type StandingReading, type StandingVisual } from "../../../../../../../src/techne/m0m5/timeline/standing";
import { STANDING_DRAWING, standingLabel } from "./standingStyle";

export type TimelineBandRecord = NonNullable<TimelineView["bands"]>[number];

export interface TimelineBand {
  id: string;
  /** The source's label, verbatim. Never rewritten. */
  label: string;
  /** The authority's expansion of the disclosed earliest, epoch ms. */
  fromMs: number;
  /** The authority's expansion of the disclosed latest, epoch ms (exclusive). */
  toMs: number;
  standing: StandingReading;
  /** The tightest band that strictly contains this one; null at the top. */
  parentId: string | null;
  /** How many bands contain this one. Nesting depth, for the stacking of stripes. */
  depth: number;
  uncertainty: string | null;
  source_ref: string | null;
}

export interface AbsentBand {
  id: string;
  label: string | null;
  /** Why the band is not drawn, stated plainly. */
  reason: string;
}

export interface BandReading {
  /** Drawn bands, ordered by start, then widest first, then id. */
  bands: TimelineBand[];
  /** Bands listed but not drawn, in the reading's order. */
  absent: AbsentBand[];
}

/** One band placed on the camera: pixels, its standing tone, and its hover title. */
export interface BandMark {
  id: string;
  label: string;
  leftPx: number;
  widthPx: number;
  depth: number;
  visual: StandingVisual;
  /** The standing table's stroke for the class, carried as the token --band-tone. */
  tone: string;
  title: string;
}

function standingFor(record: TimelineBandRecord): StandingReading {
  const reading = standingOf({ standing: record.uncertainty, source_ref: record.source_ref });
  if (reading.visual !== "unavailable") return reading;
  return {
    visual: "authored",
    verbatim: null,
    rule: "the reading names this period with a label and discloses no source: the owner's own assertion",
  };
}

export function bandsFromReading(records: readonly TimelineBandRecord[]): BandReading {
  const absent: AbsentBand[] = [];
  const drawn: Omit<TimelineBand, "parentId" | "depth">[] = [];
  for (const record of records) {
    const id = record.band_ref;
    const label = record.label_verbatim;
    const omit = (reason: string) => { absent.push({ id, label, reason }); };
    if (record.earliest === null) {
      omit("no position disclosed: the reading gives this period no dated extent");
      continue;
    }
    if (record.latest === null) {
      omit("no end disclosed: the reading gives this period no end");
      continue;
    }
    if (label === null) {
      omit("no label disclosed: the range alone is not drawn as a band");
      continue;
    }
    let fromMs: number;
    let toMs: number;
    try {
      fromMs = expandInstant(canonicalInstant(record.earliest), record.earliest_precision ?? undefined).fromMs;
      toMs = expandInstant(canonicalInstant(record.latest), record.latest_precision ?? undefined).toMs;
    } catch (error) {
      omit(`position not parseable: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (toMs < fromMs) {
      omit("the end falls before the start, so nothing is drawn");
      continue;
    }
    if (toMs === fromMs) {
      omit("no width: no precision is disclosed, so the period has no extent to draw");
      continue;
    }
    drawn.push({
      id,
      label,
      fromMs,
      toMs,
      standing: standingFor(record),
      uncertainty: record.uncertainty,
      source_ref: record.source_ref,
    });
  }

  const span = (band: { fromMs: number; toMs: number }) => band.toMs - band.fromMs;
  const containers = (band: Omit<TimelineBand, "parentId" | "depth">) => drawn.filter((other) =>
    other.id !== band.id
    && other.fromMs <= band.fromMs
    && band.toMs <= other.toMs
    && (other.fromMs !== band.fromMs || other.toMs !== band.toMs));
  const parentOf = new Map<string, string | null>();
  for (const band of drawn) {
    let parent: Omit<TimelineBand, "parentId" | "depth"> | null = null;
    for (const candidate of containers(band)) {
      if (parent === null || span(candidate) < span(parent) || (span(candidate) === span(parent) && candidate.id < parent.id)) {
        parent = candidate;
      }
    }
    parentOf.set(band.id, parent?.id ?? null);
  }
  const depthOf = new Map<string, number>();
  const depthFor = (id: string): number => {
    const known = depthOf.get(id);
    if (known !== undefined) return known;
    const parent = parentOf.get(id) ?? null;
    const depth = parent === null ? 0 : depthFor(parent) + 1;
    depthOf.set(id, depth);
    return depth;
  };

  const bands: TimelineBand[] = drawn
    .map((band) => ({ ...band, parentId: parentOf.get(band.id) ?? null, depth: depthFor(band.id) }))
    .sort((a, b) => (a.fromMs - b.fromMs) || (span(b) - span(a)) || a.id.localeCompare(b.id));
  return { bands, absent };
}

function titleOf(band: TimelineBand): string {
  return [
    band.label,
    standingLabel(band.standing.visual),
    band.uncertainty,
    band.source_ref,
  ].filter((part): part is string => typeof part === "string" && part.length > 0).join(" · ");
}

/** The bands on a camera: each band's left edge and width in pixels, from the same ms camera the cards use. */
export function bandMarks(bands: readonly TimelineBand[], camera: TimeCamera): BandMark[] {
  return bands.map((band) => ({
    id: band.id,
    label: band.label,
    leftPx: msToPixel(camera, band.fromMs),
    widthPx: (band.toMs - band.fromMs) * camera.pixelsPerMs,
    depth: band.depth,
    visual: band.standing.visual,
    tone: STANDING_DRAWING[band.standing.visual].stroke,
    title: titleOf(band),
  }));
}

