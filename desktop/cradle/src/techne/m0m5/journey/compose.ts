/**
 * The Journey's scene composition (L5 Technē T5 — issue #216, §4) —
 * cross-instrument intake as a ROUTED proposal, never a copy.
 *
 * Journey accepts the exact current selection (Project / Canvas / Relation /
 * World selections arrive through the DisclosureSession's own selection) and
 * composes a scene-create proposal over the subject's bound Expression. The
 * proposal carries the selected refs VERBATIM — subject, focus refs, the
 * reading's temporal/place/source facets — and nothing is minted locally
 * except the proposed scene ref, which follows the substrate's own
 * `${expressionRef}:scene:` grammar (the same convention the Expressions
 * bridge's composer uses, src/techne/expressions/cue.ts). A proposed ref that
 * collides with a disclosed scene is refused: Journey proposes new scenes,
 * it never re-orders or re-names the owner's existing ones through this path
 * (reordering is ./sequence's proposal).
 *
 * CT materiality (Vāk lock §4, V1): when the draft binds a C′ content type
 * for the new scene, the proposal must carry the material that CT demands —
 * CT0 relation refs from the whole, CT1 an exact source selector, CT2 a
 * disclosed action ref, CT3 a warranted shape/constellation ref, CT4 a real
 * place or temporal facet, CT5 warranted derivation refs. A proposal lacking
 * its CT's material is refused, never silently stripped of the label.
 *
 * The route names the Expression owner's real edit semantics (the disclosed
 * sequence action, else `oi.expression.edit` — the substrate's
 * ExpressionRequest `edit` with `scene_create` in its Change union); routing
 * resolves it honestly (an undisclosed action comes back unrouted with its
 * reason). The proposal persists nothing.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  validateActionRoute,
  type DisclosureSelection,
  type TechneActionRoute,
  type TechneReading,
} from "../../contract.ts";
import type { CtKind } from "./vak.ts";

/** The Expression owner's real edit operation (as ./sequence). */
export const EXPRESSION_EDIT_ACTION = "oi.expression.edit";

/** What the proposal asks the owner to create: the substrate's `scene_create`
 * change, plus the attributable frame refs the scene stands on. */
export interface SceneCompositionInput {
  expression_ref: string;
  revision: string | null;
  change: { change: "scene_create"; scene_ref: string; title: string };
  /** The exact selected refs this composition ingests — verbatim. */
  frame: {
    subject_ref: string;
    focus_refs: string[];
    /** The reading's occurrence/day facet refs — the scene's real time. */
    temporal_facet_refs: string[];
    /** The reading's place refs — the scene's real situation. */
    place_refs: string[];
    /** The reading's provenance source refs (+revision where named). */
    source_refs: { source_ref: string; source_revision: string | null }[];
  };
  /** The C′ content type bound by the author, when one is bound. */
  ct?: CtKind;
}

export interface CompositionProposal {
  route: TechneActionRoute;
  input: SceneCompositionInput;
}

function slug(title: string): string {
  const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new Error("a composed scene needs a title that yields a usable scene name — the owner's grammar names scenes, this instrument only proposes");
  return slug;
}

/**
 * Compose the proposal. Validate-then-produce: the reading must bind an
 * Expression, the proposed scene ref must follow the owner's grammar without
 * colliding with a disclosed scene, and a bound CT must find its material in
 * the reading/selection. Nothing is mutated; nothing persists.
 */
export function composeSceneProposal(input: {
  reading: TechneReading;
  selection: DisclosureSelection;
  title: string;
  ct?: CtKind;
}): CompositionProposal {
  const { reading, selection, title } = input;
  const bound = (reading.expressions ?? [])[0];
  if (!bound) {
    throw new Error(`no Expression is bound to subject ${reading.subject.subject_ref} — there is nothing to compose a scene into (the disclosure carries the honest reason)`);
  }
  const expressionRef = bound.expression_ref;
  const proposedSceneRef = `${expressionRef}:scene:${slug(title)}`;
  const disclosed = new Set((reading.expressions ?? []).map((entry) => entry.scene_ref).filter((ref): ref is string => Boolean(ref)));
  if (disclosed.has(proposedSceneRef)) {
    throw new Error(`scene ${proposedSceneRef} is already disclosed by reading ${reading.reading_ref} — composition proposes new scenes, never re-names the owner's`);
  }
  const frame: SceneCompositionInput["frame"] = {
    subject_ref: reading.subject.subject_ref,
    focus_refs: [...(selection.focus_refs ?? [])],
    temporal_facet_refs: (reading.temporal ?? [])
      .filter((facet) => facet.kind === "occurrence" || facet.kind === "day")
      .map((facet) => facet.facet_ref)
      .filter((ref): ref is string => Boolean(ref)),
    place_refs: (reading.spatial ?? []).map((place) => place.place_ref),
    source_refs: (reading.provenance ?? []).map((entry) => ({
      source_ref: entry.source_ref,
      source_revision: entry.source_revision ?? null,
    })),
  };
  const composition: SceneCompositionInput = {
    expression_ref: expressionRef,
    revision: bound.revision ?? null,
    change: { change: "scene_create", scene_ref: proposedSceneRef, title },
    frame,
    ...(input.ct !== undefined ? { ct: input.ct } : {}),
  };
  assertCtMaterial(composition, reading);
  const actionRef = disclosedSequenceAction(reading) ?? EXPRESSION_EDIT_ACTION;
  const route: TechneActionRoute = {
    action_ref: actionRef,
    subject_ref: reading.subject.subject_ref,
    input: composition,
  };
  if (selection.selection_ref !== undefined) route.selection_ref = selection.selection_ref;
  const checked = validateActionRoute(route);
  if (!checked.valid) throw new Error(`scene composition drifted from the route contract: ${checked.errors.join("; ")}`);
  return { route, input: composition };
}

/** CT materiality: the proposal carries what its bound content type demands
 * (V1 — a carrier whose C′ fields change nothing fails). */
function assertCtMaterial(composition: SceneCompositionInput, reading: TechneReading): void {
  const ct = composition.ct;
  if (ct === undefined) return;
  const problems: string[] = [];
  if (ct === "CT0" && !(reading.whole?.relations?.length) && !composition.frame.focus_refs.length) {
    problems.push("CT0 (relation material) needs the whole's relation refs or the selection's focus refs");
  }
  if (ct === "CT1" && !(reading.provenance ?? []).some((entry) => entry.selector)) {
    problems.push("CT1 (definition/source extract) needs an exact source selector");
  }
  if (ct === "CT2" && !(reading.actions ?? []).length) {
    problems.push("CT2 (executable/operation) needs a disclosed action ref");
  }
  if (ct === "CT3" && !(reading.ql && (reading.ql.shape_ref || reading.ql.constellation_ref))) {
    problems.push("CT3 (pattern/schema) needs a warranted shape or constellation ref");
  }
  if (ct === "CT4" && !composition.frame.place_refs.length && !composition.frame.temporal_facet_refs.length) {
    problems.push("CT4 (situated context) needs a real place or temporal facet");
  }
  if (ct === "CT5" && !(reading.ql?.derivation_refs ?? []).length) {
    problems.push("CT5 (integration/Return) needs warranted derivation refs");
  }
  if (problems.length) {
    throw new Error(`the composition's ${ct} burden is not met by this reading/selection — ${problems.join("; ")}`);
  }
}

/** The reading's own disclosed action with scene-composition semantics, if
 * any — the same discipline as ./sequence's disclosure-driven routing. An
 * open-style action never captures composition semantics: opening is not
 * editing. */
function disclosedSequenceAction(reading: TechneReading): string | null {
  const actions = reading.actions ?? [];
  const exact = actions.find((action) => action.action_ref === EXPRESSION_EDIT_ACTION);
  if (exact) return exact.action_ref;
  const semantic = actions.find((action) =>
    action.action_ref.startsWith("oi.expression.")
    && !/open\b/i.test(action.summary ?? "")
    && /edit|compose|create|restage/i.test(action.summary ?? ""));
  return semantic ? semantic.action_ref : null;
}
