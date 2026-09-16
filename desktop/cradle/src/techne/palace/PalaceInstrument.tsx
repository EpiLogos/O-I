/**
 * The Palace instrument (L5 Technē T6) — the mnemonic/artistic/pedagogical
 * composition surface over the reading's real Expression refs (QL-MEF
 * wayfinder §10). Elements ARE the reading's Expression bindings, verbatim;
 * the memory space is local presentation state of this one surface; dragging
 * a card asserts no semantic relation; composing routes the Expression
 * substrate's own `scene_compose` change to the disclosed Expression-owner
 * Action, and the receipt is shown, never silent. No second knowledge graph,
 * no second Scene type, no Palace persistence, no renderer or animation loop.
 *
 * Erasable TypeScript: loadable by the renderer and Vite; the pure logic it
 * calls lives in composition.ts / recall.ts and is covered by plain
 * `node --test`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { adapterForSource, techneSource } from "../adapter";
import { disclosureSession } from "../session";
import type { SurfaceBinding } from "../../surface/types";
import type {
  DisclosureSelection,
  DisclosureSession,
  TechneActionReceipt,
  TechneDisclosure,
  TechneReading,
} from "../contract";
import {
  PALACE_LOCI_PER_ROOM,
  PALACE_ROOMS,
  arrangeAt,
  composeChange,
  defaultArrangement,
  palaceAvailability,
  palaceElements,
  type PalaceArrangement,
  type PalaceElement,
  type PalaceLocus,
} from "./composition";
import {
  recallAt,
  recallFocused,
  recallNext,
  recallPrevious,
  recallWalk,
  type PalaceRecall,
} from "./recall";
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
  expression_ref: string;
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
  const elements = useMemo<PalaceElement[]>(() => (reading ? palaceElements(reading) : []), [reading]);
  const basis = reading ? `${reading.subject.subject_ref}\u0000${reading.reading_ref}` : "";
  const [arrangement, setArrangement] = useState<PalaceArrangement>(() => defaultArrangement(elements));
  const [walk, setWalk] = useState<PalaceRecall>(() => recallWalk(defaultArrangement(elements)));
  const [pickedRef, setPickedRef] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [receipt, setReceipt] = useState<TechneActionReceipt | null>(null);
  const [routeNote, setRouteNote] = useState<string | null>(null);
  const spaceRef = useRef<HTMLDivElement | null>(null);

  // A new reading basis re-derives the arrangement: elements come from the
  // reading, positions are presentation.
  useEffect(() => {
    const next = defaultArrangement(elements);
    setArrangement(next);
    setWalk(recallWalk(next));
    setPickedRef(null);
    setDrag(null);
    setGhost(null);
    setReceipt(null);
    setRouteNote(null);
  }, [basis]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!reading) {
    return (
      <div className="oi-palace">
        <div className="oi-palace-absent">
          <p className="oi-palace-note">No Technē reading is disclosed for this surface yet.</p>
        </div>
      </div>
    );
  }

  const availability = palaceAvailability(reading);
  if (!availability.available) {
    return (
      <div className="oi-palace">
        <div className="oi-palace-absent">
          <p className="oi-palace-note">The Palace discloses nothing to compose for this subject.</p>
          {availability.reason && <p className="oi-palace-absent-reason">{availability.reason}</p>}
        </div>
      </div>
    );
  }

  const expressionsOpen = reading.disclosure.instruments.some(
    (entry) => entry.instrument === "expressions" && entry.available,
  );
  const focused = recallFocused(walk);
  const placements = new Map(arrangement.placements.map((placement) => [placement.expression_ref, placement.locus]));

  const focusElement = (element: PalaceElement) => {
    setPickedRef(element.expression_ref);
    if (!session || !selection) return;
    const focusRefs = selection.focus_refs ?? [];
    const sameFocus = focusRefs.length === 1 && focusRefs[0] === element.expression_ref;
    if (sameFocus) {
      // Second activation of the already-focused element: cross-open through
      // the disclosure, never by leaving the session.
      if (expressionsOpen) disclosureSession.openInInstrument("expressions");
      return;
    }
    disclosureSession.setSelection({
      ...selection,
      selection_ref: `ql.techne:selection:${reading.subject.subject_ref}:${element.expression_ref}`,
      focus_refs: [element.expression_ref],
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

  const onCardPointerDown = (element: PalaceElement) => (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    setDrag({ expression_ref: element.expression_ref, moved: false });
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
    if (!drag) return;
    const state = drag;
    setDrag(null);
    setGhost(null);
    if (!state.moved) {
      const element = elements.find((candidate) => candidate.expression_ref === state.expression_ref);
      if (element) focusElement(element);
      return;
    }
    const point = pointerPercent(event);
    if (!point) return;
    const next = arrangeAt(arrangement, state.expression_ref, nearestLocus(point.x, point.y));
    setArrangement(next);
    setWalk(recallAt(next, walk.index));
  };

  const step = (direction: 1 | -1) => {
    setWalk(direction === 1 ? recallNext(walk) : recallPrevious(walk));
  };

  const proposeComposition = async () => {
    const proposal = composeChange(elements, arrangement, reading.actions);
    if (!proposal) return;
    setRouteNote(null);
    const source = techneSource();
    if (!source) {
      setRouteNote("No Technē source is registered to route the composition through");
      return;
    }
    try {
      const completed = await adapterForSource(source).routeAction(
        {
          action_ref: proposal.action_ref,
          subject_ref: reading.subject.subject_ref,
          selection_ref: session?.selection.selection_ref ?? null,
          input: proposal.input,
        },
        reading,
      );
      setReceipt(completed);
    } catch (cause: unknown) {
      setRouteNote(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <div className="oi-palace">
      <header className="oi-palace-head">
        <span className="oi-palace-eyebrow">Palace — composition of Expressions</span>
        <span className="oi-palace-count">
          {elements.length} element{elements.length === 1 ? "" : "s"}
        </span>
        <span className="oi-palace-note" title={reading.subject.subject_ref}>
          {reading.subject.subject_ref}
        </span>
      </header>

      <div
        ref={spaceRef}
        className="oi-palace-space"
        role="application"
        aria-label="Palace memory space: Expression elements arranged in rooms and loci"
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
        {elements.map((element) => {
          const locus = placements.get(element.expression_ref);
          if (!locus) return null;
          const dragging = drag?.expression_ref === element.expression_ref && drag.moved;
          const centre = dragging && ghost ? ghost : locusCenterPercent(locus);
          const isPicked = element.expression_ref === pickedRef;
          const isWalkFocus = element.expression_ref === focused;
          return (
            <div
              key={element.expression_ref}
              className="oi-palace-card"
              role="button"
              tabIndex={0}
              title={`${element.expression_ref}${element.scene_ref ? `\n${element.scene_ref}` : ""}`}
              style={{ left: `${centre.x}%`, top: `${centre.y}%` }}
              data-dragging={dragging ? "true" : "false"}
              data-recall-focus={isWalkFocus ? "true" : "false"}
              onPointerDown={onCardPointerDown(element)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  focusElement(element);
                }
              }}
            >
              <span className="oi-palace-card-ref">{element.expression_ref}</span>
              {element.scene_ref && <span className="oi-palace-card-scene">{element.scene_ref}</span>}
              <span className="oi-palace-card-meta">
                {element.revision ? `rev ${element.revision}` : "no revision disclosed"}
                {isPicked ? " — picked" : ""}
              </span>
            </div>
          );
        })}
      </div>

      <footer className="oi-palace-toolbar">
        <button type="button" className="oi-palace-action" onClick={() => step(-1)} aria-label="Previous locus">
          ‹ prev locus
        </button>
        <button type="button" className="oi-palace-action" onClick={() => step(1)} aria-label="Next locus">
          next locus ›
        </button>
        <span className="oi-palace-recall-readout">
          {walk.refs.length === 0
            ? "the palace stands empty"
            : `recall ${walk.index + 1} / ${walk.refs.length}${focused ? ` — ${focused}` : ""}`}
        </span>
        <button type="button" className="oi-palace-action" onClick={() => void proposeComposition()}>
          Compose in the Expression owner
        </button>
      </footer>

      {receipt && (
        <div className="oi-palace-receipt" data-routed={receipt.routed ? "true" : "false"}>
          <strong>
            {receipt.routed
              ? `Routed to ${receipt.native_owner}${receipt.authority ? ` — ${receipt.authority}` : ""}`
              : "Not routed"}
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
