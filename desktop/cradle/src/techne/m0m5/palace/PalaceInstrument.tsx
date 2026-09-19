/**
 * PORT (T3, 2026-09-19): ported into the O:I cradle from QL-MEF adapters/techne/surfaces/cradle/src/techne (main @ dbff5cc == techne/t9-integrated-field, byte-identical there); import specifiers re-pointed to the cradle seam. No semantic change.
 * The Palace instrument (L5 Technē M5′ Palace / Integral Whole, QL-MEF #218)
 * — the inhabitable articulation of the reading's real refs.
 *
 * What the surface does:
 *   - composes REGIONS from the reading's own ref families (ground, canvas,
 *     relation, journey, world, expression, sources, agencies) in the
 *     canonical traversal order; every entry is a native ref, verbatim;
 *   - inhabitation: enter/exit regions, follow portals between neighbouring
 *     regions, bookmark/recall positions, guided traversal over the whole or
 *     free exploration, per-region method-of-loci arrangement by drag;
 *   - the honest availability flip: when the reading discloses the Palace
 *     unavailable because no composition is bound, the surface may BIND the
 *     integral composition as LOCAL PRESENTATION STATE and says so — both
 *     truths stay legible; the reading is never rewritten;
 *   - the Return leg: a governed-write proposal is ROUTED to the disclosed
 *     native owner action (receipt shown, never silent); a refused route
 *     mutates nothing; a routed Return re-opens the M0′ ground on the same
 *     session;
 *   - structured state for the situated agencies is exposed through
 *     agent-state.ts (refs, never DOM scraping).
 *
 * No second knowledge graph, no second Scene type, no Palace persistence, no
 * renderer or animation loop. Erasable TypeScript: the pure logic lives in
 * composition.ts / regions.ts / palace-state.ts / return.ts / recall.ts and
 * is covered by plain `node --test`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { adapterForSource, techneSource } from "../adapter";
import { disclosureSession } from "../../session";
import type { SurfaceBinding } from "../../../surface/types";
import type {
  DisclosureSelection,
  DisclosureSession,
  TechneActionReceipt,
  TechneDisclosure,
  TechneReading,
} from "../../contract";
import {
  PALACE_LOCI_PER_ROOM,
  PALACE_ROOMS,
  locusKey,
  type PalaceLocus,
} from "./composition";
import {
  addBookmark,
  bindComposition,
  palaceClaim,
  palaceComposition,
  palaceTraversal,
  placeAt,
  removeBookmark,
  storeComposition,
  type PalaceComposition,
} from "./palace-state";
import {
  defaultRegionPlacements,
  PALACE_REGION_ORDER,
  palaceRegions,
  regionArchaeology,
  type PalaceRegion,
  type PalaceRegionEntry,
  type PalaceRegionKey,
} from "./regions";
import { palaceReturnRoute, returnCrossing } from "./return";
import { palaceAgentState } from "./agent-state";
import "./palace.css";

/** The bounded space's percentage lattice: rooms sit inset with a gap, loci
 * on a 2×2 span inside each room. Percentages keep the schematic honest at
 * any rendered size. */
const ROOM_INSET_PERCENT = 3;
const ROOM_GAP_PERCENT = 2;
const LOCUS_SPAN = 2;

interface PalaceSurfaceProps {
  binding: SurfaceBinding;
  session: DisclosureSession | null;
  selection: DisclosureSelection | null;
  reading: TechneReading | null;
  capabilities: TechneDisclosure | null;
}

interface DragState {
  ref: string;
  moved: boolean;
}

function roomRect(column: number, row: number) {
  const width = (100 - ROOM_INSET_PERCENT * 2 - ROOM_GAP_PERCENT * (PALACE_ROOMS.columns - 1)) / PALACE_ROOMS.columns;
  const height = (100 - ROOM_INSET_PERCENT * 2 - ROOM_GAP_PERCENT * (PALACE_ROOMS.rows - 1)) / PALACE_ROOMS.rows;
  return {
    left: ROOM_INSET_PERCENT + column * (width + ROOM_GAP_PERCENT),
    top: ROOM_INSET_PERCENT + row * (height + ROOM_GAP_PERCENT),
    width,
    height,
  };
}

function locusCenterPercent(locus: PalaceLocus) {
  const room = roomRect(locus.room.column, locus.room.row);
  const slotW = room.width / LOCUS_SPAN;
  const slotH = room.height / LOCUS_SPAN;
  return {
    x: room.left + (locus.locus % LOCUS_SPAN) * slotW + slotW / 2,
    y: room.top + Math.floor(locus.locus / LOCUS_SPAN) * slotH + slotH / 2,
  };
}

/** The locus whose centre is nearest to a point in percent space — the drop
 * target for a drag. Pure geometry over the bounded lattice. */
function nearestLocus(xPercent: number, yPercent: number): PalaceLocus {
  let best: PalaceLocus = { room: { column: 0, row: 0 }, locus: 0 };
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let row = 0; row < PALACE_ROOMS.rows; row += 1) {
    for (let column = 0; column < PALACE_ROOMS.columns; column += 1) {
      for (let slot = 0; slot < PALACE_LOCI_PER_ROOM; slot += 1) {
        const locus: PalaceLocus = { room: { column, row }, locus: slot };
        const centre = locusCenterPercent(locus);
        const distance = (centre.x - xPercent) ** 2 + (centre.y - yPercent) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = locus;
        }
      }
    }
  }
  return best;
}

export function PalaceInstrument({ session, selection, reading }: PalaceSurfaceProps) {
  const regions = useMemo<PalaceRegion[]>(() => (reading ? palaceRegions(reading) : []), [reading]);
  const basis = reading ? `${reading.subject.subject_ref}\u0000${reading.reading_ref}` : "";
  // The session-scoped composition: bound flag, per-region placements and
  // bookmarks survive re-entry within the desktop session and are re-derived
  // from the reading after a full restart (presentation state, never
  // persisted anywhere).
  const composition = useMemo<PalaceComposition | null>(() => (reading ? palaceComposition(reading) : null), [basis]);

  const [entered, setEntered] = useState<PalaceRegionKey | null>(null);
  const [focusedRef, setFocusedRef] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [walkIndex, setWalkIndex] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<TechneActionReceipt | null>(null);
  const [routeNote, setRouteNote] = useState<string | null>(null);
  const spaceRef = useRef<HTMLDivElement | null>(null);

  // A new reading basis resets the transient view; the composition itself is
  // recovered from the store (re-entry continuity).
  useEffect(() => {
    setEntered(null);
    setFocusedRef(null);
    setDrag(null);
    setGhost(null);
    setWalkIndex(null);
    setReceipt(null);
    setRouteNote(null);
  }, [basis]);

  if (!reading || !composition) {
    return (
      <div className="oi-palace">
        <div className="oi-palace-absent">
          <p className="oi-palace-note">No Technē reading is disclosed for this surface yet.</p>
        </div>
      </div>
    );
  }

  const { disclosedAvailable, claimable, reason: disclosedReason } = palaceClaim(reading);

  if (!(disclosedAvailable || (claimable && composition.bound))) {
    return (
      <div className="oi-palace">
        <div className="oi-palace-absent">
          <p className="oi-palace-note">The Palace discloses nothing to compose for this subject.</p>
          {disclosedReason && <p className="oi-palace-absent-reason">{disclosedReason}</p>}
          {claimable && (
            <>
              <p className="oi-palace-absent-reason">
                The reading names an unclaimed composition ref — the Palace surface can bind the integral composition
                as local presentation state. The reading itself is not rewritten.
              </p>
              <button type="button" className="oi-palace-action" onClick={() => storeComposition(bindComposition(reading))}>
                Bind composition (local, presentation state)
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const enteredRegion = entered ? regions.find((region) => region.key === entered) ?? null : null;
  const placements = enteredRegion ? composition.placements[enteredRegion.key] ?? defaultRegionPlacements(enteredRegion.entries) : [];
  const placedByRef = new Map(placements.map((placement) => [placement.ref, placement.locus]));
  const agentState = palaceAgentState(reading, composition);
  const returnRoute = palaceReturnRoute(reading, composition);
  const crossing = returnCrossing(reading);
  const regionIndex = entered ? PALACE_REGION_ORDER.indexOf(entered) : -1;
  const portalPrev = entered && regionIndex > 0 ? PALACE_REGION_ORDER[regionIndex - 1] : null;
  const portalNext = entered && regionIndex >= 0 && regionIndex < PALACE_REGION_ORDER.length - 1 ? PALACE_REGION_ORDER[regionIndex + 1] : null;

  const instrumentAvailable = (instrument: string | null) =>
    instrument !== null &&
    reading.disclosure.instruments.some((entry) => entry.instrument === instrument && entry.available);

  const focusRef = (ref: string) => {
    setFocusedRef(ref);
    if (!session || !selection) return;
    const focusRefs = selection.focus_refs ?? [];
    const sameFocus = focusRefs.length === 1 && focusRefs[0] === ref;
    if (sameFocus) {
      // Second activation of the already-focused ref: cross-open through the
      // disclosure, never by leaving the session.
      const entry = enteredRegion?.entries.find((candidate) => candidate.ref === ref);
      if (entry?.open_instrument && instrumentAvailable(entry.open_instrument)) {
        disclosureSession.openInInstrument(entry.open_instrument);
      }
      return;
    }
    disclosureSession.setSelection({
      ...selection,
      selection_ref: `ql.techne:selection:${reading.subject.subject_ref}:${ref}`,
      focus_refs: [ref],
      instrument: "palace",
    });
  };

  const pointerPercent = (event: React.PointerEvent<HTMLDivElement>) => {
    const space = spaceRef.current;
    if (!space) return null;
    const bounds = space.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return null;
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    };
  };

  const onCardPointerDown = (ref: string) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    setDrag({ ref, moved: false });
    setReceipt(null);
    setRouteNote(null);
  };

  const onSpacePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const point = pointerPercent(event);
    if (!point) return;
    setDrag({ ...drag, moved: true });
    setGhost(point);
  };

  const onSpacePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || !enteredRegion) return;
    const state = drag;
    setDrag(null);
    setGhost(null);
    if (!state.moved) {
      focusRef(state.ref);
      return;
    }
    const point = pointerPercent(event);
    if (!point) return;
    storeComposition(placeAt(composition, enteredRegion.key, state.ref, nearestLocus(point.x, point.y)));
  };

  const step = (direction: 1 | -1) => {
    if (!enteredRegion || placements.length === 0) return;
    const order = [...placements].sort((a, b) => locusKey(a.locus).localeCompare(locusKey(b.locus)));
    const current = walkIndex ?? order.findIndex((placement) => placement.ref === focusedRef);
    const base = current >= 0 ? current : 0;
    const next = (((base + direction) % order.length) + order.length) % order.length;
    setWalkIndex(next);
    focusRef(order[next].ref);
  };

  const followPortal = (key: PalaceRegionKey) => {
    setEntered(key);
    setWalkIndex(null);
    setFocusedRef(null);
    setDrag(null);
    setGhost(null);
  };

  const traverse = () => {
    const steps = palaceTraversal(composition);
    if (steps.length === 0) return;
    const next = walkIndex === null ? 0 : (walkIndex + 1) % steps.length;
    setWalkIndex(next);
    const stepRef = steps[next];
    if (stepRef.region !== entered) {
      setEntered(stepRef.region);
    }
    focusRef(stepRef.ref);
  };

  const traverseReadout = () => {
    if (walkIndex === null) return null;
    const steps = palaceTraversal(composition);
    if (steps.length === 0) return null;
    return `traversal ${walkIndex + 1} / ${steps.length} — ${steps[walkIndex].region} · ${steps[walkIndex].ref}`;
  };

  const bookmarkFocused = () => {
    if (!focusedRef || !enteredRegion) return;
    storeComposition(addBookmark(composition, enteredRegion.key, focusedRef));
  };

  const proposeReturn = async () => {
    setRouteNote(null);
    setReceipt(null);
    if (!composition.bound) {
      setRouteNote("Bind the integral composition before proposing a Return");
      return;
    }
    if (!returnRoute) {
      const hasAction = (reading.actions ?? []).some((action) => action.authority === "governed-write");
      setRouteNote(
        hasAction
          ? "The composition has nothing to return yet"
          : "The reading discloses no governed-write Return action — the Return leg is honestly absent",
      );
      return;
    }
    const source = techneSource();
    if (!source) {
      setRouteNote("No Technē source is registered to route the Return through");
      return;
    }
    try {
      const completed = await adapterForSource(source).routeAction(returnRoute, reading);
      setReceipt(completed);
    } catch (cause: unknown) {
      setRouteNote(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const reopenGround = () => {
    const target = returnCrossing(reading);
    if (target) disclosureSession.openInInstrument(target.instrument);
  };

  const entryCard = (entry: PalaceRegionEntry) => {
    const locus = placedByRef.get(entry.ref);
    if (!locus) return null;
    const dragging = drag?.ref === entry.ref && drag.moved;
    const centre = dragging && ghost ? ghost : locusCenterPercent(locus);
    const isFocused = entry.ref === focusedRef;
    return (
      <div
        key={entry.ref}
        className="oi-palace-card"
        role="button"
        tabIndex={0}
        title={`${entry.ref}${entry.note ? `\n${entry.note}` : ""}${entry.open_instrument ? `\nopen in ${entry.open_instrument}` : ""}`}
        style={{ left: `${centre.x}%`, top: `${centre.y}%` }}
        data-dragging={dragging ? "true" : "false"}
        data-recall-focus={isFocused ? "true" : "false"}
        onPointerDown={onCardPointerDown(entry.ref)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            focusRef(entry.ref);
          }
        }}
      >
        <span className="oi-palace-card-ref">{entry.ref}</span>
        <span className="oi-palace-card-scene">{entry.label}</span>
        <span className="oi-palace-card-meta">
          {entry.note ?? (entry.revision ? `rev ${entry.revision}` : "no revision disclosed")}
          {isFocused ? " — picked" : ""}
        </span>
      </div>
    );
  };

  return (
    <div className="oi-palace">
      <header className="oi-palace-head">
        <span className="oi-palace-eyebrow">Palace / Integral Whole — articulation, memory, Return</span>
        <span className="oi-palace-count">
          {regions.length} region{regions.length === 1 ? "" : "s"}
        </span>
        <span className="oi-palace-note" title={reading.subject.subject_ref}>
          {reading.subject.subject_ref}
        </span>
      </header>

      {!disclosedAvailable && composition.bound && (
        <div className="oi-palace-dualtruth" data-bound="local">
          <strong>Composition bound locally</strong>
          <span>
            The reading still discloses the Palace unavailable ({disclosedReason}); this composition is
            presentation state of this surface, held over the reading&apos;s real refs. Only the owner&apos;s own
            Action can change the reading.
          </span>
        </div>
      )}

      {!enteredRegion && (
        <div className="oi-palace-overview" role="list" aria-label="Palace regions in canonical traversal order">
          {regions.map((region) => (
            <button
              key={region.key}
              type="button"
              role="listitem"
              className="oi-palace-region"
              data-region={region.key}
              onClick={() => followPortal(region.key)}
              title={regionArchaeology(reading, region)}
            >
              <span className="oi-palace-region-office">
                {region.m_prime !== null ? `M′${region.m_prime} · ` : ""}
                {region.office}
              </span>
              <span className="oi-palace-region-count">
                {region.entries.length} ref{region.entries.length === 1 ? "" : "s"}
              </span>
              <span className="oi-palace-region-archaeology">{regionArchaeology(reading, region)}</span>
            </button>
          ))}
          {regions.length === 0 && <p className="oi-palace-note">The reading discloses no composable refs.</p>}
        </div>
      )}

      {enteredRegion && (
        <>
          <div
            ref={spaceRef}
            className="oi-palace-space"
            role="application"
            aria-label={`Palace region ${enteredRegion.office}: native refs arranged in rooms and loci`}
            onPointerMove={onSpacePointerMove}
            onPointerUp={onSpacePointerUp}
            onPointerLeave={() => {
              setDrag(null);
              setGhost(null);
            }}
          >
            {Array.from({ length: PALACE_ROOMS.rows }).flatMap((_, row) =>
              Array.from({ length: PALACE_ROOMS.columns }).map((__, column) => {
                const rect = roomRect(column, row);
                return (
                  <div
                    key={`room-${row}-${column}`}
                    className="oi-palace-room"
                    style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
                  >
                    <span className="oi-palace-room-label">
                      room {row}.{column}
                    </span>
                    <div className="oi-palace-loci" style={{ ["--palace-locus-span" as string]: LOCUS_SPAN }}>
                      {Array.from({ length: PALACE_LOCI_PER_ROOM }).map((__, slot) => (
                        <span key={`locus-${row}-${column}-${slot}`} className="oi-palace-locus" />
                      ))}
                    </div>
                  </div>
                );
              }),
            )}
            {enteredRegion.entries.map((entry) => entryCard(entry))}
          </div>

          <footer className="oi-palace-toolbar">
            <button type="button" className="oi-palace-action" onClick={() => setEntered(null)}>
              ⌂ whole
            </button>
            {portalPrev && (
              <button type="button" className="oi-palace-action" onClick={() => followPortal(portalPrev)}>
                ← portal {portalPrev}
              </button>
            )}
            {portalNext && (
              <button type="button" className="oi-palace-action" onClick={() => followPortal(portalNext)}>
                portal {portalNext} →
              </button>
            )}
            <button type="button" className="oi-palace-action" onClick={() => step(-1)} aria-label="Previous locus">
              ‹ prev locus
            </button>
            <button type="button" className="oi-palace-action" onClick={() => step(1)} aria-label="Next locus">
              next locus ›
            </button>
            <button type="button" className="oi-palace-action" onClick={traverse}>
              guide me
            </button>
            <button type="button" className="oi-palace-action" onClick={bookmarkFocused} disabled={!focusedRef}>
              bookmark
            </button>
            <span className="oi-palace-recall-readout">
              {traverseReadout() ??
                (placements.length === 0
                  ? "this region stands empty"
                  : `${placements.length} ref${placements.length === 1 ? "" : "s"}${focusedRef ? ` — ${focusedRef}` : ""}`)}
            </span>
          </footer>

          {composition.bookmarks.length > 0 && (
            <div className="oi-palace-bookmarks" aria-label="Bookmarked positions">
              <span className="oi-palace-bookmarks-label">recall path:</span>
              {composition.bookmarks.map((bookmark) => (
                <span key={bookmark.ref} className="oi-palace-bookmark">
                  <button
                    type="button"
                    className="oi-palace-bookmark-open"
                    title={bookmark.ref}
                    onClick={() => followPortal(bookmark.region)}
                  >
                    {bookmark.region}:{bookmark.ref.split(":").pop() ?? ""}
                  </button>
                  <button
                    type="button"
                    className="oi-palace-bookmark-drop"
                    aria-label={`Drop bookmark ${bookmark.ref}`}
                    onClick={() => storeComposition(removeBookmark(composition, bookmark.ref))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <footer className="oi-palace-toolbar">
        <span className="oi-palace-recall-readout">
          {agentState.unresolved.length > 0
            ? `${agentState.unresolved.length} unresolved ref${agentState.unresolved.length === 1 ? "" : "s"} — ${agentState.unresolved[0].ref.split(":").pop() ?? ""}: ${agentState.unresolved[0].reason}`
            : "every composed ref is grounded in the reading's provenance"}
        </span>
        <button type="button" className="oi-palace-action" onClick={() => void proposeReturn()}>
          Propose Return to the owner
        </button>
        {crossing && (
          <button
            type="button"
            className="oi-palace-action"
            onClick={reopenGround}
            disabled={!receipt?.routed}
            title={receipt?.routed ? "Re-open M0′ on the renewed ground" : "Route the Return first; the ground re-opens after the owner accepts the route"}
          >
            Re-open renewed ground (M0′)
          </button>
        )}
      </footer>

      {receipt && (
        <div className="oi-palace-receipt" data-routed={receipt.routed ? "true" : "false"}>
          <strong>
            {receipt.routed
              ? `Routed to ${receipt.native_owner}${receipt.authority ? ` — ${receipt.authority}` : ""}`
              : "Not routed — nothing was mutated"}
          </strong>
          <span>
            {receipt.routed
              ? "The native owner executes; nothing was composed here."
              : receipt.reason ?? "the owner refused without a reason"}
          </span>
          {(receipt.expected_effects ?? []).length > 0 && (
            <span className="oi-palace-receipt-code">{receipt.expected_effects?.join(" · ")}</span>
          )}
        </div>
      )}
      {routeNote && (
        <div className="oi-palace-receipt" data-routed="false">
          <strong>Routing failed</strong>
          <span className="oi-palace-receipt-code">{routeNote}</span>
        </div>
      )}
    </div>
  );
}
