/**
 * The Canvas structured state for the situated Agencies (L5 Technē M1′,
 * QL-MEF #214) — what `Aletheia_1 / Technē_1` perceives of this instrument
 * through native refs and typed state, never screenshots or DOM
 * reconstruction (wayfinder §17; TB0 situated-Agency floor).
 *
 * One pure function, one JSON-serialisable object:
 *   - exact refs: subject, whole, reading, snapshot, selection, focus;
 *   - the current View (ref, viewport, bounds, layout basis) and its
 *     addressed refs — presentation;
 *   - the semantic relations verbatim, WITH their TB0 evidence discipline
 *     (relation_ref, standing, source, evidence, temporal qualification) —
 *     the agency sees the field's actual typed relations, not edge labels;
 *   - the open relation proposals with their statuses and receipts — so an
 *     Agency proposes/inspects through the same artifacts a person does;
 *   - the disclosed native Actions verbatim — execution always crosses the
 *     native authority seam;
 *   - the warranted QL reading (refs + warrant + geometric/refraction
 *     readings) so an Agency can explain why a layout is or is not
 *     warranted — and never assign a QL coordinate because a layout
 *     resembles one;
 *   - the situated-Agency role bindings carried verbatim from the reading
 *     (including honest absence: a reading that situates Technē_2 does not
 *     become Technē_1 just because Canvas is open);
 *   - cut disclosure, so the M1′ ↔ 3:3 crossing is available as state.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type {
  DisclosureSelection,
  NativeActionRef,
  AgencyRole,
  TechneQlWarrant,
  TechneReading,
  TechneWholeRelation,
} from "../../contract.ts";
import type { RelationProposal } from "./proposal.ts";
import type { PositionedNode, Rect } from "./interactions.ts";
import { viewBounds } from "./interactions.ts";
import type { CanvasView } from "./view.ts";
import { viewAddressedRefs } from "./view.ts";

export interface CanvasAgencyState {
  instrument: "canvas";
  m_prime: 1;
  application_cut: "4:2-deep";
  subject_ref: string;
  reading_ref: string;
  snapshot_revision: string | null;
  whole_ref: string | null;
  selection_ref: string | null;
  focus_refs: string[];
  /** The authored View, when one is open: ref, camera, bounds and the
   * native refs it addresses. Presentation state, labelled as such. */
  view: {
    view_ref: string;
    viewport: { x: number; y: number; scale: number };
    bounds: Rect;
    layout_basis: CanvasView["layout_basis"];
    placement_refs: string[];
    frame_member_refs: string[];
    frames: Array<{ frame_ref: string; label: string; member_refs: string[]; z: number }>;
  } | null;
  /** The reading's typed relations, verbatim, evidence discipline intact —
   * the semantic side of the presentation/semantic line. */
  semantic: {
    member_refs: string[];
    relations: TechneWholeRelation[];
    relations_outside_placed_whole: TechneWholeRelation[];
  };
  /** Open relation proposals and their statuses — suggestions, never
   * semantic truth. */
  proposals: Array<Pick<RelationProposal, "proposal_ref" | "from_ref" | "to_ref" | "relation" | "status" | "directionality" | "standing" | "outside_disclosed_vocabulary"> & { receipt_routed?: boolean; action_ref?: string }>;
  /** The native owner's disclosed Actions, verbatim. Routing only. */
  actions: NativeActionRef[];
  /** The warranted QL reading, or an honest null: layout standing comes
   * only from a warrant. */
  warranted_ql: {
    m_coordinate_ref: string | null;
    shape_ref: string | null;
    constellation_ref: string | null;
    geometric_reading: string | null;
    refraction_summary: string | null;
    lens_ref: string | null;
    context_frame_ref: string | null;
    vak_source_ref: string | null;
    return_ref: string | null;
    warrant: TechneQlWarrant;
  } | null;
  warranted_ql_note: string;
  /** The situated-Agency role bindings the reading itself discloses,
   * verbatim — plus the honest local report of THIS instrument's Technē_1
   * binding (present only when the reading situates it). */
  agency_roles: AgencyRole[];
  techne_1_binding: AgencyRole | null;
  techne_1_note: string;
  disclosure: TechneReading["disclosure"];
  authority_note: "arrangement/frames/views are presentation state; typed relations and sources change only through the disclosed native Actions";
}

/** Compose the structured Canvas state. Pure: nothing is mutated, nothing
 * reconstructed from pixels — every ref is carried from the inputs. */
export function canvasAgencyState(args: {
  reading: TechneReading;
  selection: DisclosureSelection | null;
  view: CanvasView | null;
  placedRefs: Set<string>;
  /** The currently arranged nodes with their real positions (override-
   * applied), so the reported bounds are the arrangement's actual extent. */
  arrangedNodes: PositionedNode[];
  proposals: readonly RelationProposal[];
}): CanvasAgencyState {
  const { reading, selection, view, placedRefs, arrangedNodes, proposals } = args;
  const relations = reading.whole?.relations ?? [];
  const outside = relations.filter((relation) => !placedRefs.has(relation.from_ref) || !placedRefs.has(relation.to_ref));
  const ql = reading.ql;
  const roles = reading.agency ?? [];
  const techne1 = roles.find((role) => role.role === "techne" && role.m_index === 1 && role.instrument === "canvas") ?? null;

  const warrant = ql?.warrant;
  return {
    instrument: "canvas",
    m_prime: 1,
    application_cut: "4:2-deep",
    subject_ref: reading.subject.subject_ref,
    reading_ref: reading.reading_ref,
    snapshot_revision: reading.snapshot?.revision ?? null,
    whole_ref: reading.whole?.whole_ref ?? null,
    selection_ref: selection?.selection_ref ?? null,
    focus_refs: selection?.focus_refs ?? [],
    view: view
      ? {
          view_ref: view.view_ref,
          viewport: { ...view.viewport },
          bounds: viewBounds(arrangedNodes),
          layout_basis: structuredClone(view.layout_basis) as unknown as CanvasView["layout_basis"],
          placement_refs: viewAddressedRefs(view).placement_refs,
          frame_member_refs: viewAddressedRefs(view).frame_member_refs,
          frames: view.frames.map((frame) => ({ frame_ref: frame.frame_ref, label: frame.label, member_refs: [...frame.member_refs], z: frame.z })),
        }
      : null,
    semantic: {
      member_refs: [...(reading.whole?.member_refs ?? [])],
      relations: structuredClone(relations) as unknown as TechneWholeRelation[],
      relations_outside_placed_whole: structuredClone(outside) as unknown as TechneWholeRelation[],
    },
    proposals: proposals.map((proposal) => ({
      proposal_ref: proposal.proposal_ref,
      from_ref: proposal.from_ref,
      to_ref: proposal.to_ref,
      relation: proposal.relation,
      status: proposal.status,
      directionality: proposal.directionality,
      standing: proposal.standing ?? null,
      outside_disclosed_vocabulary: proposal.outside_disclosed_vocabulary,
      ...(proposal.action_ref !== undefined ? { action_ref: proposal.action_ref } : {}),
      ...(proposal.receipt?.routed !== undefined ? { receipt_routed: proposal.receipt.routed } : {}),
    })),
    actions: structuredClone(reading.actions ?? []) as unknown as NativeActionRef[],
    warranted_ql:
      ql && warrant
        ? {
            m_coordinate_ref: ql.m_coordinate_ref ?? null,
            shape_ref: ql.shape_ref ?? null,
            constellation_ref: ql.constellation_ref ?? null,
            geometric_reading: ql.geometric_reading ?? null,
            refraction_summary: ql.refraction_summary ?? null,
            lens_ref: ql.lens_ref ?? null,
            context_frame_ref: ql.context_frame_ref ?? null,
            vak_source_ref: ql.vak_source_ref ?? null,
            return_ref: ql.return_ref ?? null,
            warrant: structuredClone(warrant) as unknown as TechneQlWarrant,
          }
        : null,
    warranted_ql_note:
      ql && warrant
        ? `layout standing: ${warrant.result_class} — warrant ${warrant.provenance_ref}`
        : "no warranted QL reading is disclosed — arrangements here are presentation only, never QL",
    agency_roles: structuredClone(roles) as unknown as AgencyRole[],
    techne_1_binding: techne1 ? (structuredClone(techne1) as unknown as AgencyRole) : null,
    techne_1_note: techne1
      ? `Technē_1 is situated on canvas by the reading (session ${techne1.agent_session_ref ?? "unspecified"})`
      : `the reading situates no Technē_1 canvas binding — roles present: ${
          roles.map((role) => `${role.role}@M${role.m_index}${role.instrument ? `/${role.instrument}` : ""}`).join(", ") || "none"
        }`,
    disclosure: structuredClone(reading.disclosure) as unknown as CanvasAgencyState["disclosure"],
    authority_note: "arrangement/frames/views are presentation state; typed relations and sources change only through the disclosed native Actions",
  };
}
