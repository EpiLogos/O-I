/**
 * The M0′ Project / Wiki / Graph instrument (L5 Technē, issue #213) — the
 * deep ground aperture over the ONE shared reading: a ground test, a register
 * entry, and the bounded local-whole instrument (LIST / TREE / GRAPH over a
 * single subject/selection spine, semantic zoom, exact provenance
 * inspection, cross-opening, and the situated-Agency state through which
 * Aletheia_0/Technē_0 works the same native refs).
 *
 * Laws kept here:
 *   - the ground owns no graph, no store and no identity: every node, edge,
 *     ref and fact comes from the reading via the projection model
 *     (`./projections.ts`) and the agency state (`./agency.ts`);
 *   - mode, zoom tier and camera are PRESENTATION state (component state
 *     only); the expansion depth is a bounded-query change and shows its
 *     node/edge counts, truncation and warnings honestly;
 *   - selection follows the shared DisclosureSession — a click refocuses the
 *     SAME disclosure, never a second subject; re-centring the aperture is
 *     an explicit traverse;
 *   - Actions are ROUTED, never executed: the receipt names the owner and
 *     its authority; the Return leg is the disclosed governed-write Action;
 *   - absent facets stay absent with a reason (no fabricated QL, dates or
 *     places; no minted roles).
 */
import { useEffect, useMemo, useState } from "react";
import { adapterForSource, techneSource } from "../adapter";
import { disclosureSession } from "../../session";
import type { SurfaceBinding } from "../../../surface/types";
import type {
  DisclosureSelection,
  DisclosureSession,
  TechneActionReceipt,
  TechneDisclosure,
  TechneReading,
  TechneTemporalFacet,
} from "../../contract";
import {
  agencyLocate,
  agencyRoute,
  technaeState,
} from "./agency";
import { groundAvailability, groundModel, type GroundModel } from "./ground";
import {
  boundedView,
  focusSelection,
  graphProjection,
  listProjection,
  projectQuery,
  tierDisclosure,
  treeProjection,
  type ProjectEdge,
  type ProjectTreeNode,
  type ProjectViewMode,
  type ProjectZoomTier,
} from "./projections";
import "./project.css";

interface ProjectSurfaceProps {
  binding: SurfaceBinding;
  session: DisclosureSession | null;
  selection: DisclosureSelection | null;
  reading: TechneReading | null;
  capabilities: TechneDisclosure | null;
}

function refTail(ref: string): string {
  const parts = ref.split(/[/#:]/);
  return parts[parts.length - 1] || ref;
}

const MODES: readonly ProjectViewMode[] = ["list", "tree", "graph"];
const TIERS: readonly ProjectZoomTier[] = ["field", "locality", "detail"];

/** Resolve a relation's temporal qualification against the reading's own
 * facets — verbatim, or an honest null. */
function temporalFacet(reading: TechneReading, facetRef: string | null): TechneTemporalFacet | null {
  if (!facetRef) return null;
  return reading.temporal?.find((facet) => facet.facet_ref === facetRef) ?? null;
}

export function ProjectGround({ session, selection, reading }: ProjectSurfaceProps) {
  const ground = useMemo<GroundModel | null>(() => (reading ? groundModel(reading) : null), [reading]);
  const basis = reading ? `${reading.subject.subject_ref}\u0000${reading.reading_ref}` : "";
  const [mode, setMode] = useState<ProjectViewMode>("list");
  const [tier, setTier] = useState<ProjectZoomTier>("locality");
  const [depth, setDepth] = useState<number | null>(null);
  const [centre, setCentre] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedRelation, setPickedRelation] = useState<ProjectEdge | null>(null);
  const [receipt, setReceipt] = useState<TechneActionReceipt | null>(null);
  const [routeNote, setRouteNote] = useState<string | null>(null);

  useEffect(() => {
    setMode("list");
    setTier("locality");
    setDepth(null);
    setCentre(null);
    setPicked(null);
    setPickedRelation(null);
    setReceipt(null);
    setRouteNote(null);
  }, [basis]);

  if (!reading || !ground || !groundAvailability(reading).available) {
    return (
      <div className="oi-techne project-ground">
        <p className="techne-absent">No Technē reading is disclosed for this surface yet.</p>
      </div>
    );
  }

  const zoom = tierDisclosure(tier);
  const query = projectQuery(reading, {
    depth: depth ?? undefined,
    focus_ref: centre ?? undefined,
  });
  const view = boundedView(reading, query);
  const agencyState = technaeState(reading, session, view);
  const located = agencyLocate(agencyState, reading);
  const tree = treeProjection(view);
  const graph = graphProjection(view);

  const crossOpen = reading.disclosure.instruments.filter(
    (entry) => entry.instrument !== "project" && entry.available,
  );
  const cuts = reading.disclosure.application_cuts ?? [];

  const pickNode = (ref: string) => {
    setPicked(ref);
    setPickedRelation(null);
    if (!session || !selection) return;
    disclosureSession.setSelection(focusSelection(reading, selection, ref));
  };

  const centreOn = (ref: string) => {
    setCentre(ref);
    setPicked(ref);
    setPickedRelation(null);
  };

  const pickRelation = (edge: ProjectEdge) => {
    setPickedRelation(edge);
    setPicked(null);
  };

  const routeAction = async (actionRef: string) => {
    const route = agencyRoute(agencyState, actionRef);
    if ("refused" in route) {
      setRouteNote(route.refused);
      return;
    }
    setRouteNote(null);
    const source = techneSource();
    if (!source) {
      setRouteNote("No Technē source is registered to route the Action through");
      return;
    }
    try {
      const completed = await adapterForSource(source).routeAction(route, reading);
      setReceipt(completed);
    } catch (cause: unknown) {
      setRouteNote(cause instanceof Error ? cause.message : String(cause));
    }
  };

  // --- projections ---------------------------------------------------------

  const nodeStatus = (ref: string): string => {
    const node = view.nodes.find((candidate) => candidate.ref === ref);
    if (!node) return "";
    if (ref === view.query.focus_ref) return " · focus";
    if (!node.member) return " · outside the whole";
    if (node.distance === null) return " · unreached member";
    return ` · ${node.distance} ${node.distance === 1 ? "hop" : "hops"}`;
  };

  const renderList = () => (
    <ul className="project-rows">
      {listProjection(view).map((row) => (
        <li key={row.ref}>
          <div className={`project-row${picked === row.ref ? " is-picked" : ""}${row.ref === view.query.focus_ref ? " is-focus" : ""}`}>
            <button type="button" className="project-row-main" title={row.ref} onClick={() => pickNode(row.ref)}>
              {zoom.labels ? refTail(row.ref) : (row.ref === view.query.focus_ref ? refTail(row.ref) : "·")}
              {!row.member && <span className="project-boundary-mark">boundary</span>}
              {row.distance === null && row.member && <span className="project-unreached-mark">unreached</span>}
            </button>
            {zoom.relationFacets && row.relations.length > 0 && (
              <span className="project-row-relations">
                {row.relations.map((edge) => (
                  <button
                    key={`${edge.relation_ref ?? edge.relation}:${edge.from_ref}:${edge.to_ref}`}
                    type="button"
                    className={`project-relation-chip${pickedRelation === edge ? " is-picked" : ""}`}
                    title={`${edge.relation} — ${edge.standing ?? "standing undisclosed"}${edge.relation_ref ? ` — ${edge.relation_ref}` : ""}`}
                    onClick={() => pickRelation(edge)}
                  >
                    {edge.relation}
                  </button>
                ))}
              </span>
            )}
            <button type="button" className="project-centre" title={`centre the bounded whole here — ${row.ref}`} onClick={() => centreOn(row.ref)}>
              centre
            </button>
          </div>
        </li>
      ))}
    </ul>
  );

  const renderTreeNode = (node: ProjectTreeNode): JSX.Element => (
    <li key={node.ref} className="project-tree-item">
      <div className={`project-row${picked === node.ref ? " is-picked" : ""}${node.ref === view.query.focus_ref ? " is-focus" : ""}`}>
        <button type="button" className="project-row-main" title={node.ref} onClick={() => pickNode(node.ref)}>
          {zoom.labels ? refTail(node.ref) : (node.ref === view.query.focus_ref ? refTail(node.ref) : "·")}
          {node.reached_by && zoom.relationFacets && (
            <span className="project-edge-label">←{node.reached_by.relation}</span>
          )}
          {!node.member && <span className="project-boundary-mark">boundary</span>}
          {node.distance === null && node.member && <span className="project-unreached-mark">unreached</span>}
        </button>
        <button type="button" className="project-centre" title={`centre the bounded whole here — ${node.ref}`} onClick={() => centreOn(node.ref)}>
          centre
        </button>
      </div>
      {node.children.length > 0 && (
        <ul className="project-tree is-nested">
          {node.children.map((child) => renderTreeNode(child))}
        </ul>
      )}
    </li>
  );

  const renderTree = () => (
    <ul className="project-tree">{renderTreeNode(tree!)}</ul>
  );

  const renderGraph = () => {
    const node = (ref: string) => graph.nodes.find((candidate) => candidate.ref === ref);
    return (
      <div className="project-graph">
        <svg className="project-graph-canvas" viewBox="-0.5 -0.5 1 1" role="img" aria-label="Bounded local whole graph">
          {graph.edges.map((edge) => {
            const from = node(edge.from_ref);
            const to = node(edge.to_ref);
            if (!from || !to) return null;
            return (
              <line
                key={`${edge.relation_ref ?? edge.relation}:${edge.from_ref}:${edge.to_ref}`}
                className="project-graph-edge"
                x1={from.at.x} y1={from.at.y} x2={to.at.x} y2={to.at.y}
              >
                <title>{`${edge.relation} — standing: ${edge.standing ?? "undisclosed"} — ${edge.relation_ref ?? "no stable relation identity disclosed"}`}</title>
              </line>
            );
          })}
          {graph.nodes.map((entry) => {
            const isFocus = entry.ref === graph.focus_ref;
            const status = !entry.member ? "boundary" : entry.distance === null ? "unreached" : isFocus ? "focus" : "member";
            return (
              <g key={entry.ref} className={`project-graph-node is-${status}${picked === entry.ref ? " is-picked" : ""}`} onClick={() => pickNode(entry.ref)}>
                <circle cx={entry.at.x} cy={entry.at.y} r={isFocus ? 0.05 : 0.028} />
                {zoom.labels && (
                  <text x={entry.at.x} y={entry.at.y - (isFocus ? 0.07 : 0.045)} textAnchor="middle">
                    {refTail(entry.ref)}
                  </text>
                )}
                <title>{`${entry.ref}${nodeStatus(entry.ref)}`}</title>
              </g>
            );
          })}
        </svg>
        {zoom.countsOnly && (
          <p className="project-meta">
            field tier — {graph.nodes.length} nodes, {graph.edges.length} relations; zoom in for labels and relation facets
          </p>
        )}
      </div>
    );
  };

  // --- inspector -----------------------------------------------------------

  const pickedNode = picked ? view.nodes.find((candidate) => candidate.ref === picked) : null;
  const pickedTemporal = pickedRelation ? temporalFacet(reading, pickedRelation.temporal_facet_ref) : null;

  const renderInspector = () => {
    if (pickedRelation) {
      return (
        <div className="project-inspect">
          <p className="project-inspect-title">{pickedRelation.relation}</p>
          <p className="project-meta">relation identity: <code title={pickedRelation.relation_ref ?? undefined}>{pickedRelation.relation_ref ?? "none disclosed"}</code></p>
          <p className="project-meta">from <code title={pickedRelation.from_ref}>{refTail(pickedRelation.from_ref)}</code> to <code title={pickedRelation.to_ref}>{refTail(pickedRelation.to_ref)}</code></p>
          <p className="project-meta">standing: {pickedRelation.standing ?? "undisclosed"} · origin: {pickedRelation.origin ?? "undisclosed"}</p>
          {pickedRelation.confidence && <p className="project-meta">confidence: {pickedRelation.confidence} (owner-supplied)</p>}
          {pickedTemporal ? (
            <p className="project-meta">
              temporal qualification: {pickedTemporal.kind}
              {pickedTemporal.instant ? ` · ${pickedTemporal.instant}` : ""}
              {pickedTemporal.interval ? ` · ${JSON.stringify(pickedTemporal.interval)}` : ""}
              {pickedTemporal.uncertainty ? ` (uncertainty: ${pickedTemporal.uncertainty})` : ""}
            </p>
          ) : (
            <p className="project-meta">temporal qualification: {pickedRelation.temporal_facet_ref ? "the named facet is not disclosed in this reading" : "none — trans-temporal; no date is manufactured"}</p>
          )}
          {pickedRelation.source_ref && <p className="project-meta">source: <code title={pickedRelation.source_ref}>{refTail(pickedRelation.source_ref)}</code></p>}
          {pickedRelation.evidence_refs.length > 0 && (
            <p className="project-meta">evidence: {pickedRelation.evidence_refs.map((ref_) => <code key={ref_} title={ref_}>{refTail(ref_)} </code>)}</p>
          )}
        </div>
      );
    }
    if (pickedNode) {
      const provenance = (reading.provenance ?? []).find((entry) => entry.source_ref === pickedNode.ref);
      const place = (reading.spatial ?? []).find((entry) => entry.place_ref === pickedNode.ref);
      return (
        <div className="project-inspect">
          <p className="project-inspect-title" title={pickedNode.ref}>{refTail(pickedNode.ref)}</p>
          <p className="project-meta"><code title={pickedNode.ref}>{pickedNode.ref}</code></p>
          <p className="project-meta">
            {pickedNode.member ? "member of the whole" : "boundary endpoint — outside the whole"}
            {pickedNode.distance !== null ? ` · ${pickedNode.distance} ${pickedNode.distance === 1 ? "hop" : "hops"} from the focus` : " · unreached within the bounded depth"}
          </p>
          {provenance && (
            <>
              <p className="project-meta">source owner: {provenance.native_owner}{provenance.standing ? ` · standing: ${provenance.standing}` : ""}</p>
              {provenance.source_revision && <p className="project-meta">source revision: {provenance.source_revision}</p>}
              {provenance.selector && <p className="project-meta">selector: {provenance.selector.unit}</p>}
            </>
          )}
          {place && (
            <p className="project-meta">
              place relation: {place.relation ?? "undisclosed"} · precision: {place.precision}
              {place.uncertainty ? ` · uncertainty: ${place.uncertainty}` : ""}
              {place.precision === "unlocated" && !place.geometry ? " · honestly unlocated — no geometry exists" : ""}
            </p>
          )}
          {!provenance && !place && <p className="project-meta">No provenance or place facet is disclosed for this node in this reading.</p>}
          <button type="button" className="project-centre" onClick={() => centreOn(pickedNode.ref)}>centre the bounded whole here</button>
        </div>
      );
    }
    return <p className="project-meta">Pick a node or a relation — its refs, standing and sources open here, one gesture from the field.</p>;
  };

  // --- body ----------------------------------------------------------------

  const returnAction = ground.return_action;

  return (
    <div className="oi-techne project-ground">
      <header className="project-head">
        <span className="project-eyebrow">M0′ Project / Wiki / Graph — ground</span>
        <span className="project-subject" title={ground.subject_ref}>{ground.subject_ref}</span>
        <span className="project-meta">
          {ground.native_owner}
          {ground.kind ? ` · ${ground.kind}` : ""}
          {ground.standing ? ` · ${ground.standing}` : ""}
          {located.snapshot ? ` · snapshot ${located.snapshot}` : ""}
        </span>
      </header>

      <section className="project-section" aria-label="Bounded whole">
        <h3 className="project-heading">Bounded whole</h3>
        <p className="project-ground-ref" title={ground.ground_ref}>{ground.ground_ref}</p>
        <div className="project-controls" role="toolbar" aria-label="Projection controls">
          <div className="project-segment">
            {MODES.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={`project-mode${mode === candidate ? " is-active" : ""}`}
                aria-pressed={mode === candidate}
                onClick={() => setMode(candidate)}
              >
                {candidate.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="project-segment">
            {TIERS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={`project-mode${tier === candidate ? " is-active" : ""}`}
                aria-pressed={tier === candidate}
                onClick={() => setTier(candidate)}
              >
                {candidate}
              </button>
            ))}
          </div>
          <div className="project-segment">
            <button
              type="button"
              className="project-mode"
              disabled={query.depth === 0}
              onClick={() => setDepth(Math.max(0, query.depth - 1))}
              aria-label="collapse one hop"
            >
              −
            </button>
            <span className="project-meta">depth {query.depth}</span>
            <button
              type="button"
              className="project-mode"
              onClick={() => setDepth(query.depth + 1)}
              aria-label="expand one bounded hop"
            >
              +
            </button>
          </div>
        </div>
        <p className="project-meta">
          {view.nodes.length} nodes ({view.boundary_refs.length} outside the whole) · {view.edges.length} relations · focus {refTail(view.query.focus_ref)}
        </p>
        <p className="project-meta">
          {reading.ql?.warrant
            ? `warranted QL overlay disclosed (${reading.ql.warrant.result_class}) — the deep QL constellation layout lives in the Canvas aperture; this ground never mints a coordinate`
            : "no warranted QL facet is disclosed for this subject — none is fabricated here"}
        </p>
        {view.truncated && (
          <ul className="project-warnings">
            {view.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
        <div className="project-projection">
          {mode === "list" && renderList()}
          {mode === "tree" && renderTree()}
          {mode === "graph" && renderGraph()}
        </div>
      </section>

      <section className="project-section" aria-label="Provenance inspection">
        <h3 className="project-heading">Inspect</h3>
        {renderInspector()}
      </section>

      <section className="project-section" aria-label="Situated agency state">
        <h3 className="project-heading">Aletheia_0 / Technē_0 state</h3>
        <p className="project-meta">
          cut {agencyState.application_cut} · {agencyState.view.node_count} nodes in view · selection {agencyState.selection_ref ? refTail(agencyState.selection_ref) : "none"}
        </p>
        {agencyState.technae_0 ? (
          <p className="project-meta">
            Technē_0 bound — instrument {agencyState.technae_0.instrument ?? "undisclosed"}
            {agencyState.technae_0.guardian_ref ? ` · anchored by ${agencyState.technae_0.guardian_ref}` : ""}
            {agencyState.technae_0.agent_session_ref ? ` · session ${agencyState.technae_0.agent_session_ref}` : ""}
            {agencyState.technae_0.authority ? ` · ${agencyState.technae_0.authority}` : ""}
          </p>
        ) : (
          <p className="project-meta">Technē_0 absent — {agencyState.technae_0_absence_reason}</p>
        )}
        <div className="project-open-row">
          {agencyState.actions.map((action) => (
            <button
              key={action.action_ref}
              type="button"
              className="project-open"
              title={`${action.summary ?? ""} (owner ${action.native_owner}, authority ${action.authority})`}
              onClick={() => void routeAction(action.action_ref)}
            >
              {action.action_ref}
            </button>
          ))}
          {agencyState.actions.length === 0 && <p className="project-meta">No native Action is disclosed for this subject.</p>}
        </div>
        {receipt && (
          <p className={`project-receipt${receipt.routed ? " is-routed" : " is-refused"}`}>
            {receipt.routed
              ? `Routed to ${receipt.native_owner}${receipt.authority ? ` (${receipt.authority})` : ""} — the owner executes; this surface never does.`
              : `Not routed — ${receipt.reason ?? "the owner refused without a reason"}.`}
          </p>
        )}
        {routeNote && <p className="project-receipt is-refused">Routing failed — {routeNote}</p>}
      </section>

      {ground.sources.length > 0 && (
        <section className="project-section" aria-label="Sources">
          <h3 className="project-heading">Sources</h3>
          <ul className="project-sources">
            {ground.sources.map((source) => (
              <li key={source.source_ref} title={source.source_ref}>
                <span className="project-source-ref">{refTail(source.source_ref)}</span>
                <span className="project-meta">
                  {source.native_owner}
                  {source.standing ? ` · ${source.standing}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="project-section" aria-label="Cross-open">
        <h3 className="project-heading">Disclose this ground through</h3>
        {crossOpen.length === 0 && <p className="project-meta">No other instrument is disclosed for this subject.</p>}
        <div className="project-open-row">
          {crossOpen.map((entry) => (
            <button
              key={entry.instrument}
              type="button"
              className="project-open"
              onClick={() => disclosureSession.openInInstrument(entry.instrument)}
            >
              {entry.instrument}
            </button>
          ))}
        </div>
        {cuts.length > 0 && (
          <p className="project-meta">
            {cuts.map((cut) => `${cut.cut}: ${cut.available ? "enterable" : `unavailable — ${cut.reason}`}`).join(" · ")}
          </p>
        )}
      </section>

      <footer className="project-foot">
        {returnAction ? (
          <>
            <button type="button" className="project-return" onClick={() => void routeAction(returnAction.action_ref)}>
              Return to ground via {returnAction.action_ref}
            </button>
            {receipt && receipt.action_ref === returnAction.action_ref && (
              <p className={`project-receipt${receipt.routed ? " is-routed" : " is-refused"}`}>
                {receipt.routed
                  ? `Routed to ${receipt.native_owner}${receipt.authority ? ` (${receipt.authority})` : ""} — the owner executes; the Return is visible here, composed nowhere.`
                  : `Not routed — ${receipt.reason ?? "the owner refused without a reason"}.`}
              </p>
            )}
          </>
        ) : (
          <p className="project-meta">No governed-write Action is disclosed for this ground — the Return leg has no route yet.</p>
        )}
      </footer>
    </div>
  );
}
