/**
 * The Journey instrument's sequence draft (L5 Technē T5) — pure composition
 * draft over derived beats. LOCKED LAW: there is no second Journey
 * persistence ontology. The draft is presentation-composition state held in
 * the component (contract §3 keeps view/layout/lane state inexpressible in
 * the reading); `composeProposal` turns it into a TechneActionRoute for the
 * Expression owner's real change semantics (`oi.expression/v1` ExpressionRequest
 * `edit` with the `scene_reorder` change — the substrate's scene-order
 * grammar). The proposal is ROUTED, never executed and never persisted here.
 *
 * Pacing is a local reading pace (play-mode dwell per scene). The Expression
 * substrate's Change union has no pacing change, so a pace draft stays local
 * and is never part of the routed input — an honest boundary, not a silent
 * drop.
 *
 * Route selection is disclosure-driven: when the reading discloses a native
 * action with scene-order semantics, its action_ref is used verbatim;
 * otherwise the route names `oi.expression.edit` and routing resolves the
 * proposal honestly (an undisclosed action comes back unrouted with its
 * reason — never a local execution).
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  validateActionRoute,
  type TechneActionRoute,
  type TechneReading,
} from "../contract.ts";
import type { JourneyBeat } from "./beats.ts";

/** The Expression owner's real edit operation (ExpressionRequest
 * `operation: "edit"`); used verbatim when the reading discloses it. */
export const EXPRESSION_EDIT_ACTION = "oi.expression.edit";

/** Local play-mode dwell when the draft carries no pace for a scene. */
export const DEFAULT_DWELL_SECONDS = 4;

/** Local composition draft for one Expression: the proposed scene order and
 * the local pace. Never persisted; lives only in the component. */
export interface SequenceDraft {
  expression_ref: string;
  /** The bound revision the draft was taken from — carried verbatim into
   * the proposal so the owner can judge it against its own substrate. */
  revision: string | null;
  /** Scene refs in the proposed order, verbatim. */
  scene_order: string[];
  /** Local pacing per scene_ref (seconds of dwell in play mode). */
  pace: { scene_ref: string; dwell_seconds: number }[];
}

/** The identity draft: the beats' own order, default pace — nothing edited. */
export function draftFromBeats(beatGroup: JourneyBeat[], expressionRef: string): SequenceDraft {
  const owned = beatGroup.filter((beat) => beat.expression_ref === expressionRef);
  if (!owned.length) throw new Error(`No journey beats exist for expression ${expressionRef} — no draft can be taken`);
  return {
    expression_ref: expressionRef,
    revision: owned[0].revision ?? null,
    scene_order: owned.map((beat) => beat.scene_ref),
    pace: [],
  };
}

/** Move one scene to an index in the proposed order. Pure: returns a new
 * draft, mutates nothing — the reading is never touched. */
export function moveBeat(draft: SequenceDraft, sceneRef: string, toIndex: number): SequenceDraft {
  const from = draft.scene_order.indexOf(sceneRef);
  if (from === -1) throw new Error(`Scene ${sceneRef} is not in the draft for ${draft.expression_ref}`);
  const order = [...draft.scene_order];
  const [moved] = order.splice(from, 1);
  const clamped = Math.max(0, Math.min(order.length, toIndex));
  order.splice(clamped, 0, moved);
  return { ...draft, scene_order: order };
}

/** Set one scene's local dwell. Pure; pacing never enters the proposal. */
export function paceBeat(draft: SequenceDraft, sceneRef: string, dwellSeconds: number): SequenceDraft {
  if (!Number.isFinite(dwellSeconds) || dwellSeconds <= 0) {
    throw new Error(`Pacing for ${sceneRef} must be a positive number of seconds`);
  }
  if (!draft.scene_order.includes(sceneRef)) throw new Error(`Scene ${sceneRef} is not in the draft for ${draft.expression_ref}`);
  const pace = draft.pace.filter((entry) => entry.scene_ref !== sceneRef);
  pace.push({ scene_ref: sceneRef, dwell_seconds: dwellSeconds });
  return { ...draft, pace };
}

/** The local dwell a scene plays for under this draft. */
export function dwellFor(draft: SequenceDraft, sceneRef: string): number {
  return draft.pace.find((entry) => entry.scene_ref === sceneRef)?.dwell_seconds ?? DEFAULT_DWELL_SECONDS;
}

/** True when the draft's order differs from `beats`' own (binding) order —
 * the condition under which a proposal is worth routing at all. */
export function orderChanged(draft: SequenceDraft, beatGroup: JourneyBeat[]): boolean {
  const identity = beatGroup
    .filter((beat) => beat.expression_ref === draft.expression_ref)
    .map((beat) => beat.scene_ref);
  return identity.length === draft.scene_order.length
    && identity.some((sceneRef, index) => sceneRef !== draft.scene_order[index]);
}

/**
 * The composition proposal: the draft as a route to the Expression owner.
 * A draft may only reorder what the reading discloses — scene refs must
 * match the binding's disclosed set exactly (no invented scenes, none
 * dropped). If the reading discloses a native action with scene-order
 * semantics, its action_ref is used verbatim; otherwise the route names
 * `oi.expression.edit` with input `{expression_ref, revision, scene_order}`
 * and routing resolves it honestly. The proposal persists nothing locally.
 */
export function composeProposal(draft: SequenceDraft, reading: TechneReading, selectionRef?: string | null): TechneActionRoute {
  const disclosed = (reading.expressions ?? []).filter(
    (binding) => binding.expression_ref === draft.expression_ref && binding.scene_ref,
  );
  const disclosedScenes = disclosed.map((binding) => binding.scene_ref as string);
  if (!draft.scene_order.length) throw new Error(`The draft for ${draft.expression_ref} orders no scenes`);
  const unique = new Set(draft.scene_order);
  if (unique.size !== draft.scene_order.length) throw new Error(`The draft for ${draft.expression_ref} repeats a scene ref`);
  for (const sceneRef of draft.scene_order) {
    if (!disclosedScenes.includes(sceneRef)) {
      throw new Error(`Scene ${sceneRef} is not disclosed by reading ${reading.reading_ref} — a draft can only reorder disclosed scenes`);
    }
  }
  for (const sceneRef of disclosedScenes) {
    if (!unique.has(sceneRef)) {
      throw new Error(`Scene ${sceneRef} is disclosed by reading ${reading.reading_ref} but missing from the draft — reorder, never drop`);
    }
  }
  const actionRef = disclosedSequenceAction(reading) ?? EXPRESSION_EDIT_ACTION;
  const route: TechneActionRoute = {
    action_ref: actionRef,
    subject_ref: reading.subject.subject_ref,
    input: {
      expression_ref: draft.expression_ref,
      revision: draft.revision,
      scene_order: [...draft.scene_order],
    },
  };
  if (selectionRef !== undefined) route.selection_ref = selectionRef;
  const checked = validateActionRoute(route);
  if (!checked.valid) throw new Error(`Sequence proposal drifted from the route contract: ${checked.errors.join("; ")}`);
  return route;
}

/** The reading's own disclosed action with scene-order semantics, if any —
 * the only source of a verbatim action_ref. Exact `oi.expression.edit`
 * matches first; otherwise an `oi.expression.*` action whose summary
 * discloses reorder/scene-composition semantics. */
function disclosedSequenceAction(reading: TechneReading): string | null {
  const actions = reading.actions ?? [];
  const exact = actions.find((action) => action.action_ref === EXPRESSION_EDIT_ACTION);
  if (exact) return exact.action_ref;
  const semantic = actions.find((action) =>
    action.action_ref.startsWith("oi.expression.")
    && /reorder|scene order|scene composition|compose/i.test(action.summary ?? ""));
  return semantic ? semantic.action_ref : null;
}
