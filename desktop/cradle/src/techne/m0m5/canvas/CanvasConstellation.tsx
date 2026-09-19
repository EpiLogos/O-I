/**
 * PORT (T3, 2026-09-19): ported into the O:I cradle from QL-MEF adapters/techne/surfaces/cradle/src/techne (main @ dbff5cc == techne/t9-integrated-field, byte-identical there); import specifiers re-pointed to the cradle seam. No semantic change.
 * The Canvas/Constellation instrument (L5 Technē M1′, QL-MEF #214) — the
 * constructive deep instrument over the ONE shared reading. Plain SVG; no
 * three.js, no graph libraries, no second graph substrate: nodes are the
 * reading's whole and members, edges are its typed relations with the
 * provider's relation vocabulary verbatim, titles are native refs verbatim.
 *
 * Mature direct manipulation (presentation state only): multi-select with
 * lasso and shift-click, selection and frame drag, align/distribute,
 * snap-with-guides, keyboard paths, semantic zoom, saved authored Views
 * (placements + visual frames + camera), bounded expansion by placing
 * already-disclosed relation endpoints, and typed relation PROPOSALS that
 * route through the reading's own native Actions.
 *
 * Laws kept here:
 *   - presentation ≠ semantic, legibly: a persistent status line names
 *     arrangement as presentation; proposals render dashed with a
 *     suggestion badge until routed; nothing in this component can write a
 *     relation into the reading or the session (the interaction model, the
 *     view layer and the proposal store all lack any reading-writing
 *     parameter);
 *   - warranted QL layout is disclosed with its warrant; an ordinary
 *     arrangement never gains QL standing;
 *   - cross-open affordances come from the reading's own disclosure and
 *     nothing else — `disclosureSession.openInInstrument` for available
 *     instruments, honest refusal otherwise;
 *   - the provenance inspector is one panel away, per the reading;
 *   - the structured Technē_1/Aletheia_1 state is exposed as data
 *     (`canvasAgencyState`), never reconstructed from the DOM;
 *   - pan, zoom, arrangement, frames and views live and die as component
 *     or presentation-store state; the reading and session are never
 *     mutated by interaction.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { TechneSurfaceProps } from "../registry";
import { disclosureSession } from "../../session";
import {
  applyManualOverrides,
  computeLayout,
  type ConstellationEdge,
  type ConstellationNode,
  type LayoutOverrides,
} from "./layout.ts";
import { memberSelection, relationSelection, relationSelectionRef, wholeSelection } from "./selection.ts";
import {
  alignSelected,
  distributeSelected,
  labelsForZoom,
  lassoSelect,
  moveFrame,
  moveSelection,
  nudgeSelection,
  resetSelectionArrangement,
  semanticZoomLevel,
  snapPosition,
  type AlignMode,
  type PositionedNode,
} from "./interactions.ts";
import {
  createCanvasView,
  applyViewToLayout,
  type CanvasView,
  type CanvasViewFrame,
} from "./view.ts";
import {
  commitProposal,
  createProposal,
  disclosedRelationActions,
  disclosedRelationVocabulary,
  proposeRelation,
  rejectProposal,
  type ProposalDirectionality,
  type RelationProposal,
} from "./proposal.ts";
import { canvasAgencyState } from "./agency.ts";
import { canvasProposals, canvasViews } from "./store.ts";
import "./canvas.css";

const VIEW = 1000;
const CENTRE = VIEW / 2;
const UNIT_SCALE = 1000;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;
/** Snap threshold in unit space (~10px on screen at scale 1). */
const SNAP_THRESHOLD = 0.01;
const NUDGE_STEP = 0.02;

const TOOL_TITLES = { navigate: "Pan", select: "Lasso select (shift-click toggles)" } as const;
type Tool = keyof typeof TOOL_TITLES;

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
  /** When the dragged node was part of the multi-selection, the whole
   * selection rides along. */
  group: string[] | null;
}

interface LassoIntent {
  pointerId: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface FrameDragIntent {
  pointerId: number;
  frame_ref: string;
  origin: { x: number; y: number };
}

export function CanvasConstellation({ session, reading, capabilities }: TechneSurfaceProps) {
  // Presentation state — view, arrangement, selection and frames live and
  // die with this component instance (views/proposals are explicit
  // presentation artifacts in their stores); nothing here is session or
  // reading state.
  const [overrides, setOverrides] = useState<LayoutOverrides>({});
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const [tool, setTool] = useState<Tool>("navigate");
  const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
  const [frames, setFrames] = useState<CanvasViewFrame[]>([]);
  const [guides, setGuides] = useState<Array<{ axis: "x" | "y"; at: number }>>([]);
  const [lasso, setLasso] = useState<LassoIntent | null>(null);
  const [activeView, setActiveView] = useState<CanvasView | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [proposalForm, setProposalForm] = useState<{
    relation: string;
    directionality: ProposalDirectionality;
    standing: string;
    source_ref: string;
    evidence: string;
    note: string;
  } | null>(null);
  const [proposalDraftRefs, setProposalDraftRefs] = useState<[string?, string?]>([]);
  const [commitActions, setCommitActions] = useState<Record<string, string>>({});
  // Presentation stores are module singletons; subscribe so proposals and
  // saved views re-render (the K9 subscribe discipline, view-scoped).
  const [storeTick, setStoreTick] = useState(0);
  useEffect(() => {
    const offProposals = canvasProposals.subscribe(() => setStoreTick((tick) => tick + 1));
    const offViews = canvasViews.subscribe(() => setStoreTick((tick) => tick + 1));
    return () => {
      offProposals();
      offViews();
    };
  }, []);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const pan = useRef<PanIntent | null>(null);
  const drag = useRef<DragIntent | null>(null);
  const frameDrag = useRef<FrameDragIntent | null>(null);
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

  const positioned = useMemo<PositionedNode[]>(
    () => (layout ? layout.nodes.map((node) => ({ ref: node.ref, x: node.x, y: node.y, radius: NODE_RADIUS[node.role] / UNIT_SCALE })) : []),
    [layout],
  );

  const zoomLevel = semanticZoomLevel(view.scale);
  const labels = labelsForZoom(zoomLevel);

  // Presentation-store reads ride the subscription tick above.
  void storeTick;
  const proposals: RelationProposal[] = canvasProposals.proposals();
  const savedViews = canvasViews.views();

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

  const positionedByRef = new Map(positioned.map((node) => [node.ref, node]));
  const vocabulary = disclosedRelationVocabulary(reading);
  const actions = disclosedRelationActions(reading);
  const selectedSet = new Set(selectedRefs);

  // --- pointer paths ------------------------------------------------------

  const beginPan = (event: ReactPointerEvent<SVGRectElement>) => {
    dragged.current = false;
    const unit = toUnit(event.clientX, event.clientY);
    if (tool === "select" && unit) {
      setLasso({ pointerId: event.pointerId, from: unit, to: unit });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    pan.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, originX: view.x, originY: view.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const toggleSelected = (ref: string) => {
    setSelectedRefs((current) => (current.includes(ref) ? current.filter((candidate) => candidate !== ref) : [...current, ref]));
  };

  const beginNodeDrag = (node: ConstellationNode, event: ReactPointerEvent<SVGGElement>) => {
    event.stopPropagation();
    if (event.shiftKey) {
      toggleSelected(node.ref);
      return;
    }
    const unit = toUnit(event.clientX, event.clientY);
    if (!unit) return;
    dragged.current = false;
    // A drag on a selected node carries the whole selection with it.
    const groupDrag = selectedSet.has(node.ref) && selectedRefs.length > 1;
    drag.current = {
      pointerId: event.pointerId,
      ref: node.ref,
      offsetX: unit.x - node.x,
      offsetY: unit.y - node.y,
      group: groupDrag ? [...selectedRefs] : null,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const beginFrameDrag = (frame: CanvasViewFrame, event: ReactPointerEvent<SVGRectElement>) => {
    event.stopPropagation();
    const unit = toUnit(event.clientX, event.clientY);
    if (!unit) return;
    dragged.current = false;
    frameDrag.current = { pointerId: event.pointerId, frame_ref: frame.frame_ref, origin: unit };
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
      const snap = snapPosition({ x, y }, positioned, active.ref, SNAP_THRESHOLD, { snapToOrigin: true });
      setGuides(snap.guides);
      const next: Record<string, { x: number; y: number }> = { ...overrides, [active.ref]: snap.position };
      if (active.group) {
        const current = positionedByRef.get(active.ref);
        if (current) {
          const moved = moveSelection(positioned, active.group, {
            x: snap.position.x - current.x,
            y: snap.position.y - current.y,
          });
          Object.assign(next, moved);
        }
      }
      setOverrides(next);
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
      return;
    }
    const framing = frameDrag.current;
    if (framing && framing.pointerId === event.pointerId) {
      const unit = toUnit(event.clientX, event.clientY);
      if (!unit) return;
      dragged.current = true;
      const frame = frames.find((candidate) => candidate.frame_ref === framing.frame_ref);
      if (frame) {
        const moved = moveFrame(positioned, frame.member_refs, { x: unit.x - framing.origin.x, y: unit.y - framing.origin.y });
        setOverrides((current) => ({ ...current, ...moved }));
        framing.origin = unit;
      }
      return;
    }
    const banding = lasso;
    if (banding && banding.pointerId === event.pointerId) {
      const unit = toUnit(event.clientX, event.clientY);
      if (!unit) return;
      setLasso({ ...banding, to: unit });
    }
  };

  const endInteraction = (event: ReactPointerEvent<SVGSVGElement>) => {
    const banding = lasso;
    if (banding && banding.pointerId === event.pointerId) {
      const hits = lassoSelect(positioned, [
        banding.from,
        { x: banding.to.x, y: banding.from.y },
        banding.to,
        { x: banding.from.x, y: banding.to.y },
      ]);
      setSelectedRefs(hits);
      setLasso(null);
      if (hits.length > 0) setStatus(`Lasso selected ${hits.length} placed node${hits.length === 1 ? "" : "s"} — presentation selection only`);
    }
    if (frameDrag.current?.pointerId === event.pointerId) frameDrag.current = null;
    if (drag.current?.pointerId === event.pointerId) {
      setGuides([]);
      drag.current = null;
    }
    if (pan.current?.pointerId === event.pointerId) pan.current = null;
  };

  // --- selection and keyboard ---------------------------------------------

  const selectNode = (node: ConstellationNode, event: ReactPointerEvent<SVGGElement> | ReactMouseEventStub) => {
    if (dragged.current) { dragged.current = false; return; }
    if (event.shiftKey) return; // the toggle already happened on pointer-down
    if (node.role === "whole") {
      if (reading.whole) disclosureSession.setSelection(wholeSelection(reading, selection));
    } else {
      disclosureSession.setSelection(memberSelection(reading, selection, node.ref));
    }
    setSelectedRefs([node.ref]);
  };

  type ReactMouseEventStub = { shiftKey: boolean };

  const selectEdge = (edge: ConstellationEdge) => {
    if (dragged.current) { dragged.current = false; return; }
    disclosureSession.setSelection(relationSelection(reading, selection, edge));
    setSelectedRefs([]);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setSelectedRefs([]);
      setLasso(null);
      setGuides([]);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (selectedRefs.length === 0) return;
      const reset = resetSelectionArrangement(overrides, selectedRefs);
      setOverrides(reset.overrides);
      setStatus(`Reset arrangement of ${reset.reset.length} node${reset.reset.length === 1 ? "" : "s"} — presentation only; nothing semantic was deleted`);
      event.preventDefault();
      return;
    }
    const axis = event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : event.key === "ArrowUp" ? "up" : event.key === "ArrowDown" ? "down" : null;
    if (axis && selectedRefs.length > 0) {
      const moved = nudgeSelection(positioned, selectedRefs, axis, NUDGE_STEP / view.scale);
      setOverrides((current) => ({ ...current, ...moved }));
      event.preventDefault();
    }
  };

  // --- arrangement operations ----------------------------------------------

  const zoom = (factor: number) => setView((current) => ({ ...current, scale: clamp(current.scale * factor, ZOOM_MIN, ZOOM_MAX) }));

  const align = (mode: AlignMode) => {
    const moved = alignSelected(positioned, selectedRefs, mode);
    setOverrides((current) => ({ ...current, ...moved }));
    setStatus(`Aligned ${selectedRefs.length} nodes (${mode}) — presentation only`);
  };

  const distribute = (axis: "h" | "v") => {
    const moved = distributeSelected(positioned, selectedRefs, axis);
    setOverrides((current) => ({ ...current, ...moved }));
    setStatus(`Distributed ${selectedRefs.length} nodes (${axis === "h" ? "horizontal" : "vertical"}) — presentation only`);
  };

  const frameSelection = () => {
    const members = selectedRefs.filter((ref) => ref !== layout.whole_ref);
    if (members.length < 2) {
      setStatus("Framing needs at least two selected nodes");
      return;
    }
    const frame: CanvasViewFrame = {
      frame_ref: `ql.techne:canvas-frame:${crypto.randomUUID()}`,
      label: `Frame ${frames.length + 1}`,
      member_refs: members,
      z: frames.reduce((max, candidate) => Math.max(max, candidate.z), 0) + 1,
    };
    setFrames((current) => [...current, frame]);
    setStatus(`Framed ${members.length} nodes — a visual group, not a semantic membership change`);
  };

  const renameFrame = (frameRef: string, label: string) => {
    setFrames((current) => current.map((candidate) => (candidate.frame_ref === frameRef ? { ...candidate, label } : candidate)));
  };

  const reorderFrame = (frameRef: string, direction: "front" | "back") => {
    setFrames((current) => {
      const zs = current.map((candidate) => candidate.z);
      const target = direction === "front" ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
      return current.map((candidate) => (candidate.frame_ref === frameRef ? { ...candidate, z: target } : candidate));
    });
  };

  // --- views ---------------------------------------------------------------

  const saveView = () => {
    const placements = Object.entries(overrides).map(([ref, at]) => ({ ref, x: at.x, y: at.y }));
    const saved = createCanvasView(reading, {
      viewport: { ...view },
      placements,
      frames: frames.map((frame) => ({ ...frame, member_refs: [...frame.member_refs] })),
    });
    canvasViews.save(saved);
    setActiveView(saved);
    setStatus(`Saved view ${saved.view_ref} — presentation state only; no semantic node was copied`);
  };

  const applyView = (saved: CanvasView) => {
    const applied = applyViewToLayout(saved, layout);
    setOverrides(applied.overrides);
    setView({ ...saved.viewport });
    setFrames(saved.frames.map((frame) => ({ ...frame, member_refs: [...frame.member_refs] })));
    setActiveView(saved);
    setStatus(
      applied.dangling_refs.length > 0
        ? `Applied view ${saved.view_ref} — ${applied.dangling_refs.length} placement(s) no longer disclosed by this reading, reported not invented`
        : `Applied view ${saved.view_ref}`,
    );
  };

  const importView = (value: string) => {
    try {
      const parsed: unknown = JSON.parse(value);
      const saved = canvasViews.save(parsed as CanvasView);
      setStatus(`Imported view ${saved.view_ref}`);
    } catch (error) {
      setStatus(`View import refused: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // --- proposals -------------------------------------------------------------

  const beginProposal = () => {
    const [from, to] = selectedRefs;
    setProposalDraftRefs([from, to]);
    setProposalForm({
      relation: vocabulary[0] ?? "",
      directionality: "forward",
      standing: "",
      source_ref: reading.provenance?.[0]?.source_ref ?? "",
      evidence: "",
      note: "",
    });
  };

  const submitProposal = () => {
    if (!proposalForm) return;
    const [from, to] = proposalDraftRefs;
    if (!from || !to) {
      setStatus("A relation proposal needs two endpoints — pick from and to");
      return;
    }
    try {
      const draft = createProposal(reading, {
        from_ref: from,
        to_ref: to,
        relation: proposalForm.relation,
        directionality: proposalForm.directionality,
        standing: proposalForm.standing.trim() ? proposalForm.standing.trim() : null,
        source_ref: proposalForm.source_ref.trim() ? proposalForm.source_ref.trim() : null,
        evidence_refs: proposalForm.evidence.split(",").map((ref) => ref.trim()).filter((ref) => ref.length > 0),
        note: proposalForm.note.trim() ? proposalForm.note.trim() : undefined,
      });
      canvasProposals.put(proposeRelation(draft));
      setStatus(
        draft.outside_disclosed_vocabulary
          ? `Proposal ${draft.relation} recorded — the type is NOT in this reading's disclosed vocabulary, carried verbatim as an unclassified suggestion`
          : `Proposal ${draft.relation} recorded — a suggestion, not yet a relation`,
      );
      setProposalForm(null);
    } catch (error) {
      setStatus(`Proposal refused: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const reject = (proposal: RelationProposal) => {
    canvasProposals.put(rejectProposal(proposal));
    setStatus(`Rejected the ${proposal.relation} proposal — no mutation anywhere: the reading and session are untouched`);
  };

  const commit = (proposal: RelationProposal) => {
    const actionRef = commitActions[proposal.proposal_ref] ?? actions[0]?.action_ref;
    if (!actionRef) {
      setStatus("No native Action is disclosed by this reading — commit is unavailable (honest absence)");
      return;
    }
    commitProposal(reading, proposal, actionRef)
      .then((outcome) => {
        canvasProposals.put(outcome.proposal);
        setStatus(
          outcome.receipt.routed
            ? `Routed ${proposal.relation} through ${outcome.receipt.native_owner} (${outcome.receipt.authority}) — routing receipt attached; execution is the native owner's`
            : `Route refused: ${outcome.receipt.reason ?? "the native owner declined"}`,
        );
      })
      .catch((error: unknown) => {
        setStatus(`Commit refused: ${error instanceof Error ? error.message : String(error)}`);
      });
  };

  // --- cross-open ------------------------------------------------------------

  const openable = (capabilities?.instruments ?? []).filter(
    (entry) => entry.available && entry.instrument !== session.instrument,
  );
  const upwardHop = reading.whole && reading.whole.whole_ref !== session.subject_ref ? reading.whole.whole_ref : null;

  // --- warranted QL disclosure ------------------------------------------------

  const ql = reading.ql;
  const warranted = ql !== undefined && ql.warrant !== undefined;
  const canvasDegraded = reading.disclosure.degraded?.find((note) => note.instrument === "canvas");

  const adriftEdges: ConstellationEdge[] = [];
  const anchoredEdges: ConstellationEdge[] = [];
  for (const edge of layout.edges) {
    (anchored.has(edge.from_ref) && anchored.has(edge.to_ref) ? anchoredEdges : adriftEdges).push(edge);
  }

  const proposalEdges = proposals
    .filter((proposal) => proposal.status !== "rejected" && anchored.has(proposal.from_ref) && anchored.has(proposal.to_ref))
    .map((proposal) => ({ proposal, from: anchored.get(proposal.from_ref) as { x: number; y: number }, to: anchored.get(proposal.to_ref) as { x: number; y: number } }));

  const agencyJson = JSON.stringify(
    canvasAgencyState({
      reading,
      selection,
      view: activeView,
      placedRefs: new Set(layout.nodes.map((node) => node.ref)),
      arrangedNodes: positioned,
      proposals,
    }),
    null,
    2,
  );

  return (
    <div className="techne-canvas">
      <div className="techne-canvas-toolbar">
        <span className="techne-canvas-scheme" data-scheme={layout.scheme}>
          {layout.scheme === "ql-constellation"
            ? `QL constellation layout — warranted (${ql?.warrant.result_class})`
            : "radial layout — no warranted ql facet"}
        </span>
        <span className="techne-canvas-spacer" />
        {(Object.keys(TOOL_TITLES) as Tool[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className="techne-canvas-tool"
            data-active={tool === candidate}
            title={TOOL_TITLES[candidate]}
            onClick={() => setTool(candidate)}
          >
            {TOOL_TITLES[candidate].split(" ")[0]}
          </button>
        ))}
        <button type="button" className="techne-canvas-tool" aria-label="Zoom out" onClick={() => zoom(1 / ZOOM_STEP)}>−</button>
        <button type="button" className="techne-canvas-tool" aria-label="Zoom in" onClick={() => zoom(ZOOM_STEP)}>+</button>
        <button type="button" className="techne-canvas-tool" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>Reset view</button>
        <button
          type="button"
          className="techne-canvas-tool"
          disabled={Object.keys(overrides).length === 0}
          onClick={() => { setOverrides({}); setStatus("Arrangement reset — the reading's own layout stands again (nothing semantic changed)"); }}
        >
          Reset arrangement
        </button>
        <button type="button" className="techne-canvas-tool" onClick={saveView}>Save view</button>
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
        <div className="techne-canvas-stage-wrap" tabIndex={0} onKeyDown={onKeyDown}>
          <svg
            ref={svgRef}
            className="techne-canvas-stage"
            data-zoom={zoomLevel}
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

              {[...frames].sort((a, b) => a.z - b.z).map((frame) => {
                const members = frame.member_refs.map((ref) => anchored.get(ref)).filter(Boolean) as Array<{ x: number; y: number }>;
                if (members.length < 2) return null;
                const xs = members.map((at) => at.x);
                const ys = members.map((at) => at.y);
                const pad = 26;
                const box = {
                  x: Math.min(...xs) - pad,
                  y: Math.min(...ys) - pad,
                  w: Math.max(...xs) - Math.min(...xs) + pad * 2,
                  h: Math.max(...ys) - Math.min(...ys) + pad * 2,
                };
                return (
                  <g key={frame.frame_ref} className="techne-canvas-frame" data-z={frame.z}>
                    <rect
                      className="techne-canvas-frame-box"
                      x={box.x}
                      y={box.y}
                      width={box.w}
                      height={box.h}
                      onPointerDown={(event) => beginFrameDrag(frame, event)}
                    />
                    <text className="techne-canvas-frame-label" x={box.x + 8} y={box.y + 16}>{frame.label}</text>
                  </g>
                );
              })}

              {guides.map((guide, index) =>
                guide.axis === "x" ? (
                  <line key={index} className="techne-canvas-guide" x1={CENTRE + guide.at * UNIT_SCALE} y1={-VIEW} x2={CENTRE + guide.at * UNIT_SCALE} y2={VIEW * 2} />
                ) : (
                  <line key={index} className="techne-canvas-guide" x1={-VIEW} y1={CENTRE + guide.at * UNIT_SCALE} x2={VIEW * 2} y2={CENTRE + guide.at * UNIT_SCALE} />
                ),
              )}

              {lasso && (
                <rect
                  className="techne-canvas-lasso"
                  x={CENTRE + Math.min(lasso.from.x, lasso.to.x) * UNIT_SCALE}
                  y={CENTRE + Math.min(lasso.from.y, lasso.to.y) * UNIT_SCALE}
                  width={Math.abs(lasso.to.x - lasso.from.x) * UNIT_SCALE}
                  height={Math.abs(lasso.to.y - lasso.from.y) * UNIT_SCALE}
                />
              )}

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
                    {labels.relationLabels && <text className="techne-canvas-edge-label" x={mx} y={my}>{edge.relation}</text>}
                  </g>
                );
              })}

              {proposalEdges.map(({ proposal, from, to }) => {
                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                return (
                  <g key={proposal.proposal_ref} className="techne-canvas-proposal-edge" data-status={proposal.status} data-unclassified={proposal.outside_disclosed_vocabulary || undefined}>
                    <title>{`PROPOSAL (${proposal.status}): ${proposal.relation}: ${proposal.from_ref} → ${proposal.to_ref} — not a semantic relation`}</title>
                    <line className="techne-canvas-proposal-line" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                    <text className="techne-canvas-proposal-label" x={mx} y={my}>{`◇ ${proposal.relation}`}</text>
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
                    data-selected={selectedSet.has(node.ref) || selection.focus_refs?.includes(node.ref) || false}
                    onClick={(event) => selectNode(node, event)}
                    onPointerDown={(event) => beginNodeDrag(node, event)}
                  >
                    <title>{node.ref}</title>
                    <circle className="techne-canvas-node-circle" cx={at.x} cy={at.y} r={NODE_RADIUS[node.role]} />
                    {(labels.nodeLabels || node.role === "whole") && (
                      <text className="techne-canvas-node-label" x={at.x} y={at.y + NODE_LABEL_OFFSET[node.role]}>{node.ref}</text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <aside className="techne-canvas-side">
          {canvasDegraded && (
            <p className="techne-canvas-degraded">The source marks this instrument degraded: {canvasDegraded.reason}</p>
          )}

          <details className="techne-canvas-panel" open>
            <summary>Selection &amp; arrangement</summary>
            <p className="techne-canvas-muted">
              {selectedRefs.length} selected (shift-click or lasso). {frames.length} frame(s). {Object.keys(overrides).length} arranged. All presentation state.
            </p>
            <div className="techne-canvas-actions">
              <button type="button" className="techne-canvas-tool" disabled={selectedRefs.length < 2} onClick={() => align("left")}>Align L</button>
              <button type="button" className="techne-canvas-tool" disabled={selectedRefs.length < 2} onClick={() => align("hcenter")}>Align C</button>
              <button type="button" className="techne-canvas-tool" disabled={selectedRefs.length < 2} onClick={() => align("right")}>Align R</button>
              <button type="button" className="techne-canvas-tool" disabled={selectedRefs.length < 2} onClick={() => align("top")}>Align T</button>
              <button type="button" className="techne-canvas-tool" disabled={selectedRefs.length < 2} onClick={() => align("bottom")}>Align B</button>
              <button type="button" className="techne-canvas-tool" disabled={selectedRefs.length < 3} onClick={() => distribute("h")}>Dist ↔</button>
              <button type="button" className="techne-canvas-tool" disabled={selectedRefs.length < 3} onClick={() => distribute("v")}>Dist ↕</button>
              <button type="button" className="techne-canvas-tool" disabled={selectedRefs.length < 2} onClick={frameSelection}>Frame selection</button>
            </div>
            {frames.map((frame) => (
              <div key={frame.frame_ref} className="techne-canvas-frame-row">
                <input
                  className="techne-canvas-frame-name"
                  value={frame.label}
                  onChange={(event) => renameFrame(frame.frame_ref, event.target.value)}
                  aria-label={`Frame label for ${frame.frame_ref}`}
                />
                <span className="techne-canvas-muted">{frame.member_refs.length} refs</span>
                <button type="button" className="techne-canvas-tool" title="Bring to front" onClick={() => reorderFrame(frame.frame_ref, "front")}>▲</button>
                <button type="button" className="techne-canvas-tool" title="Send to back" onClick={() => reorderFrame(frame.frame_ref, "back")}>▼</button>
                <button
                  type="button"
                  className="techne-canvas-tool"
                  title="Dissolve frame (removes only the visual frame, no member and no relation is touched)"
                  onClick={() => setFrames((current) => current.filter((candidate) => candidate.frame_ref !== frame.frame_ref))}
                >
                  ✕
                </button>
              </div>
            ))}
          </details>

          <details className="techne-canvas-panel" open>
            <summary>Relate — typed relation proposals</summary>
            <p className="techne-canvas-muted">
              A proposal is a suggestion with evidence; it becomes a relation only through the native owner's own Action. The vocabulary below is this reading's own.
            </p>
            {proposalForm ? (
              <div className="techne-canvas-form">
                <label className="techne-canvas-field">
                  From
                  <select value={proposalDraftRefs[0] ?? ""} onChange={(event) => setProposalDraftRefs([event.target.value, proposalDraftRefs[1]])}>
                    <option value="">— pick —</option>
                    {layout.nodes.map((node) => <option key={node.ref} value={node.ref}>{node.ref}</option>)}
                  </select>
                </label>
                <label className="techne-canvas-field">
                  To
                  <select value={proposalDraftRefs[1] ?? ""} onChange={(event) => setProposalDraftRefs([proposalDraftRefs[0], event.target.value])}>
                    <option value="">— pick —</option>
                    {layout.nodes.map((node) => <option key={node.ref} value={node.ref}>{node.ref}</option>)}
                  </select>
                </label>
                <label className="techne-canvas-field">
                  Relation type {vocabulary.length === 0 && <em>(none disclosed — any type will be flagged unclassified)</em>}
                  <input list="techne-canvas-vocabulary" value={proposalForm.relation} onChange={(event) => setProposalForm({ ...proposalForm, relation: event.target.value })} />
                  <datalist id="techne-canvas-vocabulary">
                    {vocabulary.map((relation) => <option key={relation} value={relation} />)}
                  </datalist>
                </label>
                <label className="techne-canvas-field">
                  Direction
                  <select value={proposalForm.directionality} onChange={(event) => setProposalForm({ ...proposalForm, directionality: event.target.value as ProposalDirectionality })}>
                    {(["forward", "backward", "bidirectional", "none"] as ProposalDirectionality[]).map((direction) => <option key={direction} value={direction}>{direction}</option>)}
                  </select>
                </label>
                <label className="techne-canvas-field">
                  Standing
                  <input value={proposalForm.standing} onChange={(event) => setProposalForm({ ...proposalForm, standing: event.target.value })} placeholder="fact / interpretation / …" />
                </label>
                <label className="techne-canvas-field">
                  Source ref
                  <select value={proposalForm.source_ref} onChange={(event) => setProposalForm({ ...proposalForm, source_ref: event.target.value })}>
                    <option value="">— none —</option>
                    {(reading.provenance ?? []).map((entry) => <option key={entry.source_ref} value={entry.source_ref}>{entry.source_ref}</option>)}
                  </select>
                </label>
                <label className="techne-canvas-field">
                  Evidence refs (comma-separated)
                  <input value={proposalForm.evidence} onChange={(event) => setProposalForm({ ...proposalForm, evidence: event.target.value })} />
                </label>
                <label className="techne-canvas-field">
                  Note
                  <input value={proposalForm.note} onChange={(event) => setProposalForm({ ...proposalForm, note: event.target.value })} />
                </label>
                <div className="techne-canvas-actions">
                  <button type="button" className="techne-canvas-tool" onClick={submitProposal}>Record proposal</button>
                  <button type="button" className="techne-canvas-tool" onClick={() => setProposalForm(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="techne-canvas-actions">
                <button type="button" className="techne-canvas-tool" onClick={beginProposal}>
                  Propose a relation…
                </button>
              </div>
            )}
            {proposals.map((proposal) => (
              <div key={proposal.proposal_ref} className="techne-canvas-proposal-row" data-status={proposal.status}>
                <code className="techne-canvas-proposal-type">{proposal.relation}</code>
                <span className="techne-canvas-muted">{proposal.from_ref} → {proposal.to_ref}</span>
                <span className="techne-canvas-badge" data-status={proposal.status}>
                  {proposal.status === "routed" ? `routed → ${proposal.receipt?.native_owner ?? "owner"}` : "suggestion — not a relation"}
                </span>
                {proposal.outside_disclosed_vocabulary && <span className="techne-canvas-badge" data-status="unclassified">type not in disclosed vocabulary</span>}
                {proposal.standing && <span className="techne-canvas-muted">standing: {proposal.standing}</span>}
                {proposal.evidence_refs.length > 0 && <span className="techne-canvas-muted">evidence: {proposal.evidence_refs.join(", ")}</span>}
                {proposal.status === "proposed" && (
                  <div className="techne-canvas-actions">
                    <select
                      value={commitActions[proposal.proposal_ref] ?? actions[0]?.action_ref ?? ""}
                      onChange={(event) => setCommitActions((current) => ({ ...current, [proposal.proposal_ref]: event.target.value }))}
                      aria-label="Native Action to route through"
                    >
                      {actions.map((action) => <option key={action.action_ref} value={action.action_ref}>{action.action_ref} ({action.native_owner})</option>)}
                    </select>
                    <button type="button" className="techne-canvas-tool" onClick={() => commit(proposal)} disabled={actions.length === 0}>
                      Commit through native owner
                    </button>
                    <button type="button" className="techne-canvas-tool" onClick={() => reject(proposal)}>Reject</button>
                  </div>
                )}
                {proposal.receipt && (
                  <span className="techne-canvas-muted">
                    receipt: routed={String(proposal.receipt.routed)}{proposal.receipt.reason ? ` — ${proposal.receipt.reason}` : ""}
                  </span>
                )}
                {proposal.status === "rejected" && proposal.resolution_note && <span className="techne-canvas-muted">{proposal.resolution_note}</span>}
              </div>
            ))}
          </details>

          <details className="techne-canvas-panel">
            <summary>Views</summary>
            {savedViews.length === 0 && <p className="techne-canvas-muted">No saved view yet — arrange and press “Save view”.</p>}
            {savedViews.map((saved) => (
              <div key={saved.view_ref} className="techne-canvas-frame-row">
                <code className="techne-canvas-view-ref">{saved.view_ref}</code>
                <span className="techne-canvas-muted">{saved.placements.length} placed · {saved.frames.length} framed</span>
                <button type="button" className="techne-canvas-tool" onClick={() => applyView(saved)}>Apply</button>
                <button type="button" className="techne-canvas-tool" title="Delete this saved view (presentation artifact only)" onClick={() => canvasViews.delete(saved.view_ref)}>✕</button>
              </div>
            ))}
            <details>
              <summary className="techne-canvas-muted">Import view JSON</summary>
              <textarea
                className="techne-canvas-import"
                aria-label="Paste a serialized view"
                onBlur={(event) => { if (event.target.value.trim()) importView(event.target.value); }}
              />
            </details>
            <details>
              <summary className="techne-canvas-muted">Serialized view (JSON)</summary>
              <textarea className="techne-canvas-import" readOnly value={activeView ? JSON.stringify(activeView, null, 2) : ""} aria-label="Serialized current view" />
            </details>
          </details>

          {warranted ? (
            <details className="techne-canvas-panel" open>
              <summary>Warranted QL reading</summary>
              <ul className="techne-canvas-facts">
                {ql?.shape_ref && <li><code>{ql.shape_ref}</code><span className="techne-canvas-muted"> shape</span></li>}
                {ql?.constellation_ref && <li><code>{ql.constellation_ref}</code><span className="techne-canvas-muted"> constellation</span></li>}
                {ql?.m_coordinate_ref && <li><code>{ql.m_coordinate_ref}</code><span className="techne-canvas-muted"> M-coordinate</span></li>}
                {ql?.geometric_reading && <li><span>{ql.geometric_reading}</span><span className="techne-canvas-muted"> geometric reading</span></li>}
                {ql?.refraction_summary && <li><span>{ql.refraction_summary}</span></li>}
                <li>
                  <span className="techne-canvas-muted">
                    warrant: {ql?.warrant.result_class} · {ql?.warrant.provenance_ref} · evidence {ql?.warrant.evidence_refs.join(", ")}
                  </span>
                </li>
              </ul>
            </details>
          ) : (
            <details className="techne-canvas-panel">
              <summary>Warranted QL reading</summary>
              <p className="techne-canvas-muted">No warranted QL reading is disclosed — arrangements here are presentation only, never QL.</p>
            </details>
          )}

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
                {adriftEdges.map((edge, index) => {
                  const unplaced = [edge.from_ref, edge.to_ref].filter((ref) => !anchored.has(ref));
                  return (
                    <li key={`${index}:${edge.from_ref}~${edge.relation}~${edge.to_ref}`}>
                      <code>{edge.relation}</code>
                      <span className="techne-canvas-muted">{edge.from_ref} → {edge.to_ref}</span>
                      {unplaced.map((ref) => (
                        <button
                          key={ref}
                          type="button"
                          className="techne-canvas-tool"
                          title="Place this disclosed endpoint on the canvas — presentation placement of an already-disclosed ref (bounded expansion), never a new node in the field"
                          onClick={() => {
                            const base = positionedByRef.get(ref);
                            setOverrides((current) => ({ ...current, [ref]: base ? { x: base.x, y: base.y } : { x: 0.3, y: 0.3 } }));
                            setStatus(`Placed ${ref} — a disclosed ref given a presentation position (bounded expansion, not a semantic membership change)`);
                          }}
                        >
                          place {ref.split(":").pop()?.slice(0, 22) ?? ref}
                        </button>
                      ))}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          <details className="techne-canvas-panel">
            <summary>Technē state (structured, for Aletheia_1 / Technē_1)</summary>
            <p className="techne-canvas-muted">
              Exact refs, view/bounds, semantic-vs-presentation split, disclosed Actions and warrants — the data an Agency operates through; no screenshot or DOM reconstruction.
            </p>
            <textarea className="techne-canvas-import" readOnly value={agencyJson} aria-label="Structured Canvas agency state" />
          </details>
        </aside>
      </div>

      <p className="techne-canvas-statusline" role="status">
        {status ?? `Presentation view — arrangement, frames and views never change the field. Semantic relations: ${layout.edges.length} (native). ${zoomLevel} zoom.`}
      </p>
    </div>
  );
}
