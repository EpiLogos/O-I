/**
 * Placemark authoring — lane-4 T17 (click to create), T18 (saved places carry
 * their source basis), T19 (drag to refine with honest precision).
 *
 * Pure model: no DOM, no maplibre, no kernel. The renderer and the surface
 * read these functions, and `node --test` loads them through esbuild.
 *
 * Laws held here:
 *  - The map never writes. Every authoring act ends in the owner's native
 *    route (Edit place/time, the constellation editor); this module only
 *    decides what the route is asked for and what the person is shown.
 *  - A click never claims exactness: a created point is "approximate".
 *  - Dragging never upgrades precision. An exact position does not drag.
 *  - A move exists only with a disclosed source basis: the native owner refuses
 *    a place write without one, so the map does not propose one either.
 *  - A refusal is shown with the owner's own words, never paraphrased.
 */
import type { TechnePlacePrecision } from "../../../../../../../src/techne/contract";

/** The hold that opens the menu on touch, in milliseconds (the platform's own long-press band). */
export const LONG_PRESS_MS = 500;
/** The most a held touch may travel before it is a drag, in screen pixels. */
export const LONG_PRESS_SLOP_PX = 10;
/** Five decimal places is about one metre: a click is not a survey fix, so it claims no more. */
export const CLICK_DECIMALS = 5;

export interface PlaceCoordinate {
  latitude: number;
  longitude: number;
}

/** What the renderer reports when the person asks for a menu (right-click or long-press). */
export interface PlaceContextEvent extends PlaceCoordinate {
  /** The placed marker under the pointer, or null on empty map. */
  graphNodeId: string | null;
  /** Position within the map container, so the menu opens where it was asked for. */
  x: number;
  y: number;
}

export function isCoordinate(value: unknown): value is PlaceCoordinate {
  if (typeof value !== "object" || value === null) return false;
  const { latitude, longitude } = value as Record<string, unknown>;
  return (
    typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
  );
}

function roundDegrees(value: number): number {
  const scale = 10 ** CLICK_DECIMALS;
  return Math.round(value * scale) / scale;
}

function roundCoordinate(value: PlaceCoordinate): PlaceCoordinate {
  return { latitude: roundDegrees(value.latitude), longitude: roundDegrees(value.longitude) };
}

/** A coordinate as the person reads it: fixed decimals, latitude first. */
export function formatCoordinate(value: PlaceCoordinate): string {
  return `${value.latitude.toFixed(CLICK_DECIMALS)}, ${value.longitude.toFixed(CLICK_DECIMALS)}`;
}

// ---------------------------------------------------------------------------
// T17 — the context menu and the click prefill
// ---------------------------------------------------------------------------

export interface PlaceAuthoringAvailability {
  /** True when the native authoring route exists for this reading. */
  canAuthor: boolean;
  /** Why it does not, in the owner's words; shown beside the disabled item. */
  unavailableReason?: string | null;
}

export type PlaceMenuAction = "add" | "edit";

export interface PlaceMenuItem {
  action: PlaceMenuAction;
  label: string;
  enabled: boolean;
  /** Null when enabled; otherwise the honest reason the item is unavailable. */
  reason: string | null;
}

const NO_ROUTE_REASON = "This reading has no native Scene entity bound, so there is no authoring route here.";

/** The menu for a point on the map. "Add place here" is always offered; "Edit place…" only on a marker. */
export function placeMenuItems(
  target: { graphNodeId: string | null; at: PlaceCoordinate },
  availability: PlaceAuthoringAvailability,
): PlaceMenuItem[] {
  const routeReason = availability.canAuthor ? null : (availability.unavailableReason ?? NO_ROUTE_REASON);
  const pointReason = isCoordinate(target.at) ? null : "The pointer is outside the map's coordinates.";
  const items: PlaceMenuItem[] = [{
    action: "add",
    label: "Add place here",
    enabled: routeReason === null && pointReason === null,
    reason: routeReason ?? pointReason,
  }];
  if (target.graphNodeId !== null) {
    items.push({ action: "edit", label: "Edit place…", enabled: routeReason === null, reason: routeReason });
  }
  return items;
}

export interface PlacePrefillOk {
  ok: true;
  latitude: number;
  longitude: number;
  precision: "approximate";
  note: string;
}

export type PlacePrefill = PlacePrefillOk | { ok: false; reason: string };

/** The coordinate a click offers the native route: rounded, and always approximate. */
export function prefillFromClick(at: PlaceCoordinate): PlacePrefill {
  if (!isCoordinate(at)) {
    return { ok: false, reason: "The click is outside the map's coordinates, so nothing was prefilled." };
  }
  const rounded = roundCoordinate(at);
  return {
    ok: true,
    latitude: rounded.latitude,
    longitude: rounded.longitude,
    precision: "approximate",
    note: "Placed by a click: an approximate position, not a surveyed fix.",
  };
}

/** A held touch is a menu request only after the hold and while it has not travelled. */
export function longPressFires(elapsedMs: number, movedPx: number): boolean {
  return Number.isFinite(elapsedMs) && Number.isFinite(movedPx) &&
    elapsedMs >= LONG_PRESS_MS && movedPx <= LONG_PRESS_SLOP_PX;
}

// ---------------------------------------------------------------------------
// T19 — drag to refine, with precision kept as the reading states it
// ---------------------------------------------------------------------------

export type DragEligibility =
  | { ok: true; precision: "approximate" | "region" }
  | { ok: false; reason: string };

/** Whether a marker may be dragged to propose a new position. Exact and unlocated never drag. */
export function dragEligibility(precision: string, geometry: "point" | "polygon"): DragEligibility {
  if (precision === "exact") {
    return { ok: false, reason: "Exact positions do not drag. Edit place/time to change an exact fix." };
  }
  if (precision === "unlocated") {
    return { ok: false, reason: "An unlocated place has no position on the map to drag." };
  }
  if (precision !== "approximate" && precision !== "region") {
    return { ok: false, reason: "The precision is not disclosed, so no position can be proposed for it." };
  }
  if (geometry !== "point") {
    return { ok: false, reason: "A region is drawn as its polygon; its centre is not a coordinate to drag." };
  }
  return { ok: true, precision };
}

export interface PlaceMoveProposal {
  status: "pending";
  graphNodeId: string;
  title: string;
  /** Exactly the reading's precision: a move never upgrades it. */
  precision: "approximate" | "region";
  from: PlaceCoordinate;
  to: PlaceCoordinate;
  /** The facet's own disclosed source ref: the basis the owner checks before it saves. */
  basis: string;
}

export type MoveProposalResult = { ok: true; proposal: PlaceMoveProposal } | { ok: false; reason: string };

/** The pending proposal a drag makes, or the reason it makes none. Nothing is written here. */
export function moveProposal(input: {
  graphNodeId: string;
  title: string;
  precision: string;
  geometry: "point" | "polygon";
  from: PlaceCoordinate;
  to: PlaceCoordinate;
  source_ref: string | null | undefined;
}): MoveProposalResult {
  const eligible = dragEligibility(input.precision, input.geometry);
  if (!eligible.ok) return { ok: false, reason: eligible.reason };
  if (!isCoordinate(input.from) || !isCoordinate(input.to)) {
    return { ok: false, reason: "The position is outside the map's coordinates, so no move was proposed." };
  }
  const basis = typeof input.source_ref === "string" && input.source_ref.trim() !== "" ? input.source_ref : null;
  if (basis === null) {
    return {
      ok: false,
      reason: "This place discloses no source basis, so a move has nothing to cite. Edit place/time requires one.",
    };
  }
  const from = roundCoordinate(input.from);
  const to = roundCoordinate(input.to);
  if (from.latitude === to.latitude && from.longitude === to.longitude) {
    return { ok: false, reason: "The marker did not move, so no proposal was made." };
  }
  return {
    ok: true,
    proposal: {
      status: "pending",
      graphNodeId: input.graphNodeId,
      title: input.title,
      precision: eligible.precision,
      from,
      to,
      basis,
    },
  };
}

/** The chip's words: old → new coordinate, the precision kept, and the basis cited. */
export function proposalSummary(proposal: PlaceMoveProposal): string {
  return `${proposal.title}: ${formatCoordinate(proposal.from)} → ${formatCoordinate(proposal.to)} · ${proposal.precision} · basis ${proposal.basis}`;
}

// ---------------------------------------------------------------------------
// T18 — refusals are classified for the person and shown verbatim
// ---------------------------------------------------------------------------

export type PlaceRefusalKind =
  | "source-basis"
  | "nested-evidence"
  | "stale-source"
  | "stale-revision"
  | "other";

/** The native owner's refusal, classified by the words it actually uses (kernel construction.rs and construction_source.rs). */
export function refusalKind(message: string): PlaceRefusalKind {
  if (/unique disclosed source basis/.test(message)) return "source-basis";
  if (/exact owner revision/.test(message)) return "nested-evidence";
  if (/source_revision_conflict/.test(message)) return "stale-source";
  if (/changed since these inputs were read|register or target changed|changed while this reading was returning|An evidence file changed/.test(message)) {
    return "stale-revision";
  }
  return "other";
}

/** The instrument's notice for a refusal: the owner's message, unchanged. */
export function refusalNotice(message: string): { kind: PlaceRefusalKind; text: string } {
  return { kind: refusalKind(message), text: message };
}

// ---------------------------------------------------------------------------
// The host's contract and the notices the route hands back
// ---------------------------------------------------------------------------

/** What the surface asks its host. The host opens the owner's route; it never writes a coordinate itself. */
export interface PlaceAuthoringHost extends PlaceAuthoringAvailability {
  onAddPlace(prefill: PlacePrefillOk): void;
  onEditPlace(graphNodeId: string): void;
  onProposeMove(proposal: PlaceMoveProposal): void | Promise<void>;
}

/** Said beside the route when a click is offered as the new place. The route does not yet take the point (see OPEN). */
export function addRouteNotice(prefill: PlacePrefillOk): string {
  return `Clicked ${formatCoordinate(prefill)} as an approximate point. Edit place/time opens without this point carried in; enter it there.`;
}

/** Said beside the route when a drag is proposed. The owner's route checks the basis when the person saves. */
export function moveRouteNotice(proposal: PlaceMoveProposal): string {
  return `Proposed move: ${proposalSummary(proposal)}. Edit place/time opens without this proposal carried in; enter the new point there, and the owner checks the basis when you save.`;
}
