/**
 * The M0′ situated-Agency operating state (L5 Technē, issue #213 §7) — the
 * structured state through which `Aletheia_0 / Technē_0` locates, inspects,
 * traverses, proposes and Returns over the M0′ instrument using native refs.
 *
 * Laws kept here (dual-reading lock §16, #213 §7, TB0-1 role floor):
 *   - an Agency reads THIS state (the contract types and the bounded view),
 *     never the DOM and never a private graph parse;
 *   - the role bindings are the reading's own `agency[]` disclosure — this
 *     module never mints a role, a session ref or a profile ref; when no
 *     Technē_0/Aletheia_0 binding is disclosed, that absence is carried
 *     honestly with its reason;
 *   - locate/traverse are READS over disclosed facts; propose/execute enter
 *     as a TechneActionRoute through the adapter and only the native owner
 *     executes, under its own authority;
 *   - identity (subject, refs, snapshot, actions) is carried verbatim.
 *
 * Pure functions, erasable TypeScript: loadable by the renderer, Vite, and
 * `node --test`.
 */
import {
  instrumentReading,
  type AgencyRole,
  type DisclosureSession,
  type NativeActionRef,
  type TechneActionRoute,
  type TechneReading,
} from "../../contract.ts";
import type { ProjectView } from "./projections.ts";

/** The operating state one situated Agency perceives of the M0′ instrument
 * (dual-reading lock §16: current subject/whole, active instrument/cut,
 * selection/aperture, source/revision/provenance, available Actions,
 * authority and disclosure limits). */
export interface TechnaeOperatingState {
  subject_ref: string;
  native_owner: string;
  whole_ref: string | null;
  instrument: "project";
  application_cut: "4:2-deep";
  selection_ref: string | null;
  focus_refs: string[];
  snapshot_revision: string | null;
  /** The bounded view as counts plus its honesty flags — the Agency sees the
   * same bounded whole the surface presents, not a rebuild of it. */
  view: {
    query: ProjectView["query"];
    node_count: number;
    edge_count: number;
    boundary_refs: string[];
    truncated: boolean;
    warnings: string[];
  };
  /** What is honestly disclosable from here, with reasons. */
  disclosure: {
    instruments: { instrument: string; available: boolean; reason: string | null }[];
    cuts: { cut: string; available: boolean; reason: string | null }[];
  };
  /** The reading's own situated-Agency bindings, verbatim. */
  agency: AgencyRole[];
  /** The Technē_0/Aletheia_0 binding for THIS coordinate, when disclosed. */
  technae_0: AgencyRole | null;
  /** Explicit absence reason when technae_0 is null (honest absence). */
  technae_0_absence_reason: string | null;
  /** The native Actions disclosed for this subject, verbatim. */
  actions: NativeActionRef[];
}

const M0 = 0;

/**
 * The operating state of the M0′ instrument for one reading/session/view.
 * Pure: reads the contract types only; absence stays absent with a reason.
 */
export function technaeState(reading: TechneReading, session: DisclosureSession | null, view: ProjectView | null): TechnaeOperatingState {
  const bindings = reading.agency ?? [];
  const coordinate = bindings.filter((role) => role.m_index === M0 && (role.role === "techne" || role.role === "aletheia"));
  const technae0 = coordinate.find((role) => role.role === "techne") ?? coordinate[0] ?? null;
  return {
    subject_ref: reading.subject.subject_ref,
    native_owner: reading.subject.native_owner,
    whole_ref: reading.whole?.whole_ref ?? null,
    instrument: "project",
    application_cut: "4:2-deep",
    selection_ref: session?.selection.selection_ref ?? null,
    focus_refs: [...(session?.selection.focus_refs ?? [])],
    snapshot_revision: reading.snapshot?.revision ?? null,
    view: view
      ? {
          query: { ...view.query },
          node_count: view.nodes.length,
          edge_count: view.edges.length,
          boundary_refs: [...view.boundary_refs],
          truncated: view.truncated,
          warnings: [...view.warnings],
        }
      : {
          query: { focus_ref: reading.subject.subject_ref, depth: 0, max_nodes: 0, max_edges: 0 },
          node_count: 0,
          edge_count: 0,
          boundary_refs: [],
          truncated: false,
          warnings: ["no bounded view is computed yet — the Agency sees the subject alone until one is"],
        },
    disclosure: {
      instruments: reading.disclosure.instruments.map((entry) => ({
        instrument: entry.instrument,
        available: entry.available,
        reason: entry.available ? null : entry.reason ?? null,
      })),
      cuts: (reading.disclosure.application_cuts ?? []).map((entry) => ({
        cut: entry.cut,
        available: entry.available,
        reason: entry.available ? null : entry.reason ?? null,
      })),
    },
    agency: bindings.map((role) => ({ ...role })),
    technae_0: technae0 ? { ...technae0 } : null,
    technae_0_absence_reason: technae0
      ? null
      : bindings.length
        ? "the reading discloses agency bindings, but none is an Aletheia_0/Technē_0 operating this coordinate"
        : "the reading discloses no situated-Agency bindings — the role floor is absent for this subject, not hidden",
    actions: (reading.actions ?? []).map((action) => ({ ...action })),
  };
}

/** LOCATE: the attributable answer to "what is this subject and what stands
 * behind it" — subject identity, provenance with exact selectors, and the
 * snapshot basis. Reads only; nothing is inferred. */
export function agencyLocate(state: TechnaeOperatingState, reading: TechneReading): {
  subject_ref: string;
  native_owner: string;
  kind: string | null;
  standing: string | null;
  snapshot: string | null;
  sources: { source_ref: string; native_owner: string; revision: string | null; standing: string | null; selector_unit: string | null }[];
} {
  return {
    subject_ref: state.subject_ref,
    native_owner: state.native_owner,
    kind: reading.subject.kind ?? null,
    standing: reading.subject.standing ?? null,
    snapshot: reading.snapshot?.revision ?? null,
    sources: (reading.provenance ?? []).map((provenance) => ({
      source_ref: provenance.source_ref,
      native_owner: provenance.native_owner,
      revision: provenance.source_revision ?? null,
      standing: provenance.standing ?? null,
      selector_unit: provenance.selector?.unit ?? null,
    })),
  };
}

/**
 * TRAVERSE: the bounded-view query that moves the aperture to `ref` — the
 * SAME move the human surface performs. Accepts only refs the bounded view
 * holds (the Agency works inside what is disclosed and receives an explicit
 * refusal otherwise; no guessed refs, no out-of-view jumps). Refocus is
 * presentation — it changes no semantic relation, so no Action is needed for
 * the move itself; only an expansion changes the query.
 */
export function agencyTraverse(state: TechnaeOperatingState, view: ProjectView, ref: string): ProjectView["query"] | { refused: string } {
  void state;
  const known = view.nodes.some((node) => node.ref === ref);
  if (!known) {
    return { refused: `ref ${ref} is not in the disclosed bounded view — traverse within what is disclosed, or expand first` };
  }
  return { focus_ref: ref, depth: view.query.depth, max_nodes: view.query.max_nodes, max_edges: view.query.max_edges };
}

/**
 * PROPOSE/EXECUTE: the TechneActionRoute for a disclosed Action, carrying the
 * session's selection. Routing only — the adapter resolves; the native owner
 * executes under its own authority. An undisclosed Action is an explicit
 * refusal, never a silent pass-through.
 */
export function agencyRoute(state: TechnaeOperatingState, actionRef: string): TechneActionRoute | { refused: string } {
  const action = state.actions.find((candidate) => candidate.action_ref === actionRef);
  if (!action) {
    return { refused: `action ${actionRef} is not disclosed by this reading — routing refused` };
  }
  return {
    action_ref: action.action_ref,
    subject_ref: state.subject_ref,
    selection_ref: state.selection_ref,
    input: {
      // Disclosure context only — the route never carries authority with it;
      // execution and authority stay with the native owner.
      application_cut: instrumentReading("project"),
      acting_role: state.technae_0 ? `agency:${state.technae_0.role}:M${state.technae_0.m_index}` : "m0-prime-surface",
    },
  };
}
