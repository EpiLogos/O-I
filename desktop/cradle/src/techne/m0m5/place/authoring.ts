/**
 * Placemark authoring — lane-4 T17 (click to create), T18 (saved places carry
 * their source basis), T19 (drag to refine with honest precision).
 *
 * Moved here, beside the place owner's other laws, from the vendor's
 * `packages/canvas/src/psychogeographic/placeAuthoring.ts` (an O-I overlay, never
 * upstream) when the frame's Places map and its folder retired (#762). Its
 * readers: the atlas's Place tool (packages/live-shell/ui/src/projections/atlas/
 * places/placeTool.ts), the Wiki's time-and-place editor (knowledge/
 * WikiFactsEditor.tsx), the Expressions host (expressions/PointCloudHost.tsx)
 * and the frame's kernel route (field-studies-journeys/src/kernelExpressions.ts).
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
import type { TechnePlacePrecision } from "../../contract";

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
  /** Lane-4 T17c: the owner's answers to routes this map opened, as they arrive. Returns the unsubscribe. Absent: answers are not returned to the map. */
  subscribeRouteResults?(listener: (result: PlaceRouteResult) => void): () => void;
}

// ---------------------------------------------------------------------------
// T17c — the owner's answer returns to the map: the marker goes back, the words show
// ---------------------------------------------------------------------------

/** One answer from the owner's constellation route, with the marker that route was opened for (null for an add). */
export interface PlaceRouteResult {
  graphNodeId: string | null;
  outcome: ConstellationRouteOutcome;
}

/** What the map does with an owner answer: its marker returns to the reading (a marker never keeps an unsaved position), and the owner's words are shown. */
export function placeRouteResultFor(result: PlaceRouteResult): {
  returnMarker: string | null;
  notice: { kind: PlaceRefusalKind | "saved"; text: string; reload: boolean };
} {
  return { returnMarker: result.graphNodeId, notice: constellationResultNotice(result.outcome) };
}

// ---------------------------------------------------------------------------
// T17b — the draft the map hands the owner's route, and the owner's answer back
// ---------------------------------------------------------------------------

/** A draft position for the owner's editor. It is offered, never written: the editor still requires a source basis. */
export interface PlaceDraft {
  lat: number;
  lon: number;
  /** Never "exact": a click or a drag claims no more than the reading's own honest precision. */
  precision: Extract<TechnePlacePrecision, "approximate" | "region">;
  /** The position the marker was dragged from; present for a move. */
  from?: { lat: number; lon: number };
  /** The marker the move belongs to (the place's own ref), so the answer returns to that marker. */
  place_ref?: string;
}

export type PlaceDraftCheck = { ok: true; draft: PlaceDraft } | { ok: false; reason: string };

const DRAFT_KEYS = ["lat", "lon", "precision", "from", "place_ref"];
export const PLACE_DRAFT_REF_MAX = 256;

function latLonProblem(lat: unknown, lon: unknown, label: string): string | null {
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return `${label} latitude must be a finite number from -90 to 90.`;
  }
  if (typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return `${label} longitude must be a finite number from -180 to 180.`;
  }
  return null;
}

/** Validates a draft before it crosses the host channel. Bounded: known keys only, finite coordinates, never exact. */
export function validatePlaceDraft(value: unknown): PlaceDraftCheck {
  const fail = (reason: string): PlaceDraftCheck => ({ ok: false, reason });
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fail("The place draft must be an object.");
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).find((key) => !DRAFT_KEYS.includes(key));
  if (unknown !== undefined) return fail(`The place draft has an unknown field: ${unknown}.`);
  const position = latLonProblem(record.lat, record.lon, "The place draft");
  if (position !== null) return fail(position);
  if (record.precision === "exact") {
    return fail("A placed point is never exact: a click or drag is approximate, or region for a region.");
  }
  if (record.precision !== "approximate" && record.precision !== "region") {
    return fail("The place draft precision must be approximate or region.");
  }
  let from: { lat: number; lon: number } | undefined;
  if (record.from !== undefined) {
    if (typeof record.from !== "object" || record.from === null || Array.isArray(record.from)) {
      return fail("The place draft origin must be an object with lat and lon.");
    }
    const origin = record.from as Record<string, unknown>;
    const problem = latLonProblem(origin.lat, origin.lon, "The place draft origin");
    if (problem !== null) return fail(problem);
    from = { lat: origin.lat as number, lon: origin.lon as number };
  }
  if (record.place_ref !== undefined && (
    typeof record.place_ref !== "string" || record.place_ref.trim() === "" || record.place_ref.length > PLACE_DRAFT_REF_MAX
  )) {
    return fail(`The place draft reference must be a non-empty string of at most ${PLACE_DRAFT_REF_MAX} characters.`);
  }
  const draft: PlaceDraft = { lat: record.lat as number, lon: record.lon as number, precision: record.precision };
  if (from !== undefined) draft.from = from;
  if (record.place_ref !== undefined) draft.place_ref = record.place_ref as string;
  return { ok: true, draft };
}

/** The draft a click offers the owner's route: the rounded point, approximate. */
export function placeDraftForAdd(prefill: PlacePrefillOk): PlaceDraft {
  return { lat: prefill.latitude, lon: prefill.longitude, precision: "approximate" };
}

/** The draft a drag offers: the new point at the reading's own precision, the origin, and the marker it belongs to. */
export function placeDraftForMove(proposal: PlaceMoveProposal): PlaceDraft {
  return {
    lat: proposal.to.latitude,
    lon: proposal.to.longitude,
    precision: proposal.precision,
    from: { lat: proposal.from.latitude, lon: proposal.from.longitude },
    place_ref: proposal.graphNodeId,
  };
}

/** Said beside the route when a click is offered as the new place. The editor opens with the point as a draft. */
export function addRouteNotice(prefill: PlacePrefillOk): string {
  return `Clicked ${formatCoordinate(prefill)} as an approximate point, opened as a draft. Choose a source basis, then save time and place; nothing is written until you save.`;
}

/** Said beside the route when a drag is proposed. The owner's route checks the basis when the person saves. */
export function moveRouteNotice(proposal: PlaceMoveProposal): string {
  return `Proposed move opened as a draft: ${proposalSummary(proposal)}. Choose a source basis, then save; the owner checks the basis and the source revision when you save.`;
}

export type ConstellationRouteOutcome =
  | { kind: "saved" }
  | { kind: "refused"; reason?: string | null };

/** The notice for the owner's answer. A refusal shows the owner's own words; a save asks the map to read again. */
export function constellationResultNotice(outcome: ConstellationRouteOutcome): {
  kind: PlaceRefusalKind | "saved";
  text: string;
  reload: boolean;
} {
  if (outcome.kind === "saved") {
    return { kind: "saved", text: "Saved in the constellation. The reading is refreshed from the owner.", reload: true };
  }
  const reason = typeof outcome.reason === "string" && outcome.reason.trim() !== ""
    ? outcome.reason
    : "The owner refused this save; no change was made.";
  return { kind: refusalKind(reason), text: reason, reload: false };
}
