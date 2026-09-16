/**
 * The Canvas/Constellation instrument (L5 Technē T2) — a focused bounded-
 * whole aperture over the ONE shared reading. Plain SVG; no three.js, no
 * graph libraries, no second graph substrate: nodes are the reading's whole
 * and members, edges are its typed relations with the provider's relation
 * vocabulary verbatim, titles are native refs verbatim.
 *
 * Laws kept here:
 *   - cross-open affordances come from the reading's own disclosure and
 *     nothing else — an available instrument calls
 *     `disclosureSession.openInInstrument`; an unavailable one is not
 *     offered (the host renders its honest refusal with its reason);
 *   - the provenance inspector is one panel away: source_ref, revision,
 *     selector unit and standing, as disclosed;
 *   - leaf→whole navigation appears only when the session's subject is not
 *     the whole itself; it refocuses the SAME disclosure, so the session
 *     before and after stays co-referenced;
 *   - pan, zoom and manual arrangement are presentation state — component
 *     state only, never written into the session or the reading
 *     (`applyManualOverrides` has no reading parameter to betray).
 */
import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { TechneSurfaceProps } from "../registry";
import { disclosureSession } from "../session";
import {
  applyManualOverrides,
  computeLayout,
  type ConstellationEdge,
  type ConstellationNode,
  type LayoutOverrides,
} from "./layout.ts";
import { memberSelection, relationSelection, relationSelectionRef, wholeSelection } from "./selection.ts";
import "./canvas.css";

const VIEW = 1000;
const CENTRE = VIEW / 2;
const UNIT_SCALE = 1000;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;

const project = (x: number, y: number) => ({ x: CENTRE + x * UNIT_SCALE, y: CENTRE + y * UNIT_SCALE });
const unproject = (x: number, y: number) => ({ x: (x - CENTRE) / UNIT_SCALE, y: (y - CENTRE) / UNIT_SCALE });
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const tidy = (value: number) => Math.round(value * 1e5) / 1e5;

const NODE_RADIUS = { whole: 18, member: 9, "ql-address": 7 } as const;
const NODE_LABEL_OFFSET = { whole: 34, member: 24, "ql-address": 20 } as const;

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

interface PanIntent {
  pointerId: number;
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
}

interface DragIntent {
  pointerId: number;
  ref: string;
  offsetX: number;
  offsetY: number;
}

export function CanvasConstellation({ session, reading, capabilities }: TechneSurfaceProps) {
  // Presentation state — view and arrangement live and die with this
  // component instance; nothing here is session or reading state.
  const [overrides, setOverrides] = useState<LayoutOverrides>({});
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pan = useRef<PanIntent | null>(null);
  const drag = useRef<DragIntent | null>(null);
  const dragged = useRef(false);

  const layout = useMemo(
    () => (reading ? applyManualOverrides(computeLayout(reading), overrides) : null),
    [reading, overrides],
  );

  const anchored = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const node of layout?.nodes ?? []) map.set(node.ref, project(node.x, node.y));
    return map;
  }, [layout]);

  if (!session || !reading || !layout) {
    return (
      <div className="techne-canvas">
        <p className="techne-canvas-absent">No reading is disclosed yet — the constellation renders when the Technē source returns one.</p>
      </div>
    );
  }

  const selection = session.selection;
  const toUnit = (clientX: number, clientY: number) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return unproject(point.x, point.y);
  };

  const beginPan = (event: ReactPointerEvent<SVGRectElement>) => {
    dragged.current = false;
    pan.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, originX: view.x, originY: view.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const beginNodeDrag = (node: ConstellationNode, event: ReactPointerEvent<SVGGElement>) => {
    event.stopPropagation();
    const unit = toUnit(event.clientX, event.clientY);
    if (!unit) return;
    dragged.current = false;
    drag.current = { pointerId: event.pointerId, ref: node.ref, offsetX: unit.x - node.x, offsetY: unit.y - node.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const active = drag.current;
    if (active && active.pointerId === event.pointerId) {
      const unit = toUnit(event.clientX, event.clientY);
      if (!unit) return;
      dragged.current = true;
      const x = tidy(unit.x - active.offsetX);
      const y = tidy(unit.y - active.offsetY);
      setOverrides((current) => ({ ...current, [active.ref]: { x, y } }));
      return;
    }
    const moving = pan.current;
    if (moving && moving.pointerId === event.pointerId) {
      dragged.current = true;
      const width = svgRef.current?.getBoundingClientRect().width;
      const factor = width && width > 0 ? VIEW / width / view.scale : 1;
      setView((current) => ({
        ...current,
        x: moving.originX + (event.clientX - moving.clientX) * factor,
        y: moving.originY + (event.clientY - moving.clientY) * factor,
      }));
    }
  };

  const endInteraction = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
    if (pan.current?.pointerId === event.pointerId) pan.current = null;
  };

  const zoom = (factor: number) => setView((current) => ({ ...current, scale: clamp(current.scale * factor, ZOOM_MIN, ZOOM_MAX) }));

  const selectNode = (node: ConstellationNode) => {
    if (dragged.current) { dragged.current = false; return; }
    if (node.role === "whole") {
      if (reading.whole) disclosureSession.setSelection(wholeSelection(reading, selection));
      return;
    }
    disclosureSession.setSelection(memberSelection(reading, selection, node.ref));
  };

  const selectEdge = (edge: ConstellationEdge) => {
    if (dragged.current) { dragged.current = false; return; }
    disclosureSession.setSelection(relationSelection(reading, selection, edge));
  };

  const anchoredEdges: ConstellationEdge[] = [];
  const adriftEdges: ConstellationEdge[] = [];
  for (const edge of layout.edges) {
    (anchored.has(edge.from_ref) && anchored.has(edge.to_ref) ? anchoredEdges : adriftEdges).push(edge);
  }

  const openable = (capabilities?.instruments ?? []).filter(
    (entry) => entry.available && entry.instrument !== session.instrument,
  );
  const upwardHop = reading.whole && reading.whole.whole_ref !== session.subject_ref ? reading.whole.whole_ref : null;

  return (
    <div className="techne-canvas">
      <div className="techne-canvas-toolbar">
        <span className="techne-canvas-scheme" data-scheme={layout.scheme}>
          {layout.scheme === "ql-constellation"
            ? "QL constellation layout — warranted ql facet"
            : "radial layout — no warranted ql facet"}
        </span>
        <span className="techne-canvas-spacer" />
        <button type="button" className="techne-canvas-tool" aria-label="Zoom out" onClick={() => zoom(1 / ZOOM_STEP)}>−</button>
        <button type="button" className="techne-canvas-tool" aria-label="Zoom in" onClick={() => zoom(ZOOM_STEP)}>+</button>
        <button type="button" className="techne-canvas-tool" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>Reset view</button>
        <button
          type="button"
          className="techne-canvas-tool"
          disabled={Object.keys(overrides).length === 0}
          onClick={() => setOverrides({})}
        >
          Reset arrangement
        </button>
      </div>

      {(upwardHop || openable.length > 0) && (
        <div className="techne-canvas-nav">
          {upwardHop && (
            <button
              type="button"
              className="techne-canvas-hop"
              title="Refocus this disclosure on the bounded whole — the subject and reading basis stay put"
              onClick={() => disclosureSession.setSelection(wholeSelection(reading, selection))}
            >
              Open the whole <code>{upwardHop}</code>
            </button>
          )}
          {openable.map((entry) => (
            <button
              key={entry.instrument}
              type="button"
              className="techne-canvas-tool"
              onClick={() => disclosureSession.openInInstrument(entry.instrument)}
            >
              Open in {entry.instrument}
            </button>
          ))}
        </div>
      )}

      <div className="techne-canvas-body">
        <svg
          ref={svgRef}
          className="techne-canvas-stage"
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          role="application"
          aria-label={`Constellation of ${layout.whole_ref}`}
          onPointerMove={onPointerMove}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
          onPointerLeave={endInteraction}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <rect className="techne-canvas-ground" x={-VIEW} y={-VIEW} width={VIEW * 3} height={VIEW * 3} onPointerDown={beginPan} />
            {anchoredEdges.map((edge, index) => {
              const from = anchored.get(edge.from_ref);
              const to = anchored.get(edge.to_ref);
              if (!from || !to) return null;
              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              return (
                <g
                  key={`${index}:${edge.from_ref}~${edge.relation}~${edge.to_ref}`}
                  className="techne-canvas-edge"
                  data-selected={selection.selection_ref === relationSelectionRef(session.subject_ref, edge)}
                  data-origin={edge.origin ?? undefined}
                  onClick={() => selectEdge(edge)}
                >
                  <title>{`${edge.relation}: ${edge.from_ref} → ${edge.to_ref}`}</title>
                  <line className="techne-canvas-edge-line" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                  <circle className="techne-canvas-edge-hit" cx={mx} cy={my} r={11} />
                  <text className="techne-canvas-edge-label" x={mx} y={my}>{edge.relation}</text>
                </g>
              );
            })}
            {layout.nodes.map((node) => {
              const at = anchored.get(node.ref);
              if (!at) return null;
              return (
                <g
                  key={node.ref}
                  className="techne-canvas-node"
                  data-role={node.role}
                  data-selected={selection.focus_refs?.includes(node.ref) ?? false}
                  onClick={() => selectNode(node)}
                  onPointerDown={(event) => beginNodeDrag(node, event)}
                >
                  <title>{node.ref}</title>
                  <circle className="techne-canvas-node-circle" cx={at.x} cy={at.y} r={NODE_RADIUS[node.role]} />
                  <text className="techne-canvas-node-label" x={at.x} y={at.y + NODE_LABEL_OFFSET[node.role]}>{node.ref}</text>
                </g>
              );
            })}
          </g>
        </svg>

        <aside className="techne-canvas-side">
          <details className="techne-canvas-panel" open>
            <summary>Provenance</summary>
            <ul className="techne-canvas-facts">
              {(reading.provenance ?? []).map((entry, index) => (
                <li key={`${entry.source_ref}:${index}`}>
                  <code>{entry.source_ref}</code>
                  <span className="techne-canvas-muted">
                    {entry.native_owner}
                    {entry.source_revision ? ` · ${entry.source_revision}` : ""}
                    {entry.selector ? ` · selector ${entry.selector.unit}` : ""}
                    {entry.standing ? ` · ${entry.standing}` : ""}
                  </span>
                </li>
              ))}
              {!reading.provenance?.length && (
                <li className="techne-canvas-muted">No source provenance is disclosed by this reading.</li>
              )}
            </ul>
          </details>
          {adriftEdges.length > 0 && (
            <details className="techne-canvas-panel">
              <summary>Relations outside the placed whole ({adriftEdges.length})</summary>
              <ul className="techne-canvas-facts">
                {adriftEdges.map((edge, index) => (
                  <li key={`${index}:${edge.from_ref}~${edge.relation}~${edge.to_ref}`}>
                    <code>{edge.relation}</code>
                    <span className="techne-canvas-muted">{edge.from_ref} → {edge.to_ref}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </aside>
      </div>
    </div>
  );
}
