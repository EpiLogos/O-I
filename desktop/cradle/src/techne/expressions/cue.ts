/**
 * The Technē Expression cue (L5 Technē T7) — the portable
 * instantiation/focus cue built from a ql.techne/v1 reading plus the
 * DisclosureSelection, in the field discipline of the Nara Expression
 * portable cues (`../../instrument/nara-expression-adapter.ts`): admitted
 * scalar identities and reference lists only, strictly validated,
 * validate-then-produce — an invalid input raises, it never becomes a
 * best-effort cue.
 *
 * Substrate law (L5 wayfinder §11): Expressions add the TechneReading as a
 * first-class instantiation/focus source — the cue ADDS a source to the
 * oi.expression/v1 substrate, it is not a new kernel. QL profile cues are
 * carried ONLY from the warranted ql facet; when the reading carries no ql,
 * the cue carries no QL cues (absence is data, never filled in). Every ref
 * is carried byte-verbatim from the reading or the selection and the cue
 * asserts exactly that before it is returned: the bridge that consumes this
 * cue never clones the subject into a new entity — it passes refs.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import {
  validateReading,
  validateSelection,
  type DisclosureSelection,
  type TechneQlWarrant,
  type TechneReading,
} from "../contract.ts";
import type {ExpressionDocument, ReadingRef} from "../../expression/types.ts";

/** The cue contract tag. The cue is Cradle-seam portable material, not an
 * owner identity; the owner identities it carries stay verbatim inside. */
export const TECHNE_EXPRESSION_CUE_SCHEMA = "ql.techne-expression-cue/v1";

/** Scene focus: the bound Expression's scene, verbatim, when the reading
 * binds an Expression that carries a scene_ref. */
export interface TechneExpressionSceneFocus {
  expression_ref: string;
  scene_ref: string;
  revision: string | null;
}

/** QL profile cues — ONLY from the warranted ql facet. The warrant is
 * carried verbatim; the cue adds no QL authority of its own. */
export interface TechneExpressionQlCues {
  lens_ref: string | null;
  sublens_ref: string | null;
  address: string | null;
  shape_ref: string | null;
  warrant: TechneQlWarrant;
}

/** Subject binding in the oi.expression/v1 discipline: the subject's own
 * refs, never a re-keyed copy. Sources are the reading's provenance
 * source_refs as ReadingRefs (revision "unavailable" where the owner names
 * none — the substrate's own convention for an unavailable revision). */
export interface TechneExpressionSubjectBinding {
  subject_ref: string;
  native_owner: string;
  sources: ReadingRef[];
}

export interface TechneExpressionCue {
  schema: typeof TECHNE_EXPRESSION_CUE_SCHEMA;
  reading_ref: string;
  subject: TechneExpressionSubjectBinding;
  scene_focus: TechneExpressionSceneFocus | null;
  ql: TechneExpressionQlCues | null;
  /** The selection this cue serves — co-referenced, never rewritten. The
   * agent_session_ref rides verbatim from the owner grammar or stays null. */
  selection: {
    selection_ref: string;
    instrument: DisclosureSelection["instrument"];
    agent_session_ref: string | null;
    snapshot_revision: string | null;
  };
}

// ---------------------------------------------------------------------------
// Strictness mirrors — the same field discipline the Nara adapter validates.
// (contract.ts does not export its patterns; the strictness is mirrored, and
// the warrant itself is validated before it is carried.)
// ---------------------------------------------------------------------------

const LENS_PATTERN = /^mef:lens:L[0-5]'?@1$/;
const SUBLENS_PATTERN = /^mef:sublens:L[0-5]'?\.[0-5]@1$/;
const RESULT_CLASSES: readonly string[] = ["canonical", "deterministic", "semantic-stochastic", "research"];

/** A portable identity: non-empty, no NUL — the Nara adapter's `present`. */
function present(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !value.includes("\0");
}

function refOrThrow(value: unknown, label: string): string {
  if (!present(value)) throw new Error(`Technē Expression cue ${label}: a ref is required`);
  return value;
}

function patternOrThrow(value: unknown, label: string, pattern: RegExp): string | null {
  if (value === undefined || value === null) return null;
  if (!present(value) || !pattern.test(value)) throw new Error(`Technē Expression cue ${label}: not a lens-discipline ref`);
  return value;
}

function nullableRef(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (!present(value)) throw new Error(`Technē Expression cue ${label}: must be a ref or null`);
  return value;
}

/** The warrant is the existing QL provenance discipline, validated before it
 * is carried; a ql facet without a warrant is a contract drift, refused. */
function carryWarrant(warrant: TechneQlWarrant): TechneQlWarrant {
  if (!warrant || typeof warrant !== "object") throw new Error("Technē Expression cue ql.warrant: a QL facet exists only when warranted");
  if (!RESULT_CLASSES.includes(warrant.result_class)) throw new Error("Technē Expression cue ql.warrant.result_class: not a QL result class");
  if (!Array.isArray(warrant.evidence_refs) || warrant.evidence_refs.length < 1) throw new Error("Technē Expression cue ql.warrant: at least one evidence ref is required");
  for (const evidence of warrant.evidence_refs) refOrThrow(evidence, "ql.warrant.evidence_refs entry");
  refOrThrow(warrant.provenance_ref, "ql.warrant.provenance_ref");
  // Verbatim: the carried warrant is the reading's own object, field for field.
  return {
    result_class: warrant.result_class,
    evidence_refs: [...warrant.evidence_refs],
    provenance_ref: warrant.provenance_ref,
  };
}

/**
 * Build the cue. Validate-then-produce: the reading and the selection are
 * contract-checked, one subject is enforced, QL cues are produced only from
 * the warranted facet, and every carried ref is asserted to exist byte-verbatim
 * in its sources before the cue is returned.
 */
export function buildExpressionCue(reading: TechneReading, selection: DisclosureSelection): TechneExpressionCue {
  const readingCheck = validateReading(reading);
  if (!readingCheck.valid) throw new Error(`Technē Expression cue refused: the reading drifted from the contract — ${readingCheck.errors.join("; ")}`);
  const selectionCheck = validateSelection(selection);
  if (!selectionCheck.valid) throw new Error(`Technē Expression cue refused: the selection drifted from the contract — ${selectionCheck.errors.join("; ")}`);
  if (selection.subject_ref !== reading.subject.subject_ref) {
    throw new Error(`Technē Expression cue refused: the selection names ${selection.subject_ref}, the reading discloses ${reading.subject.subject_ref} — one subject, one cue`);
  }

  const sources: ReadingRef[] = (reading.provenance ?? []).map((entry) => ({
    ref: entry.source_ref,
    // The substrate's convention for an unnamed revision (the Nara adapter's).
    revision: entry.source_revision ?? "unavailable",
    availability: entry.source_revision ? "available" : "unavailable",
  }));

  const bound = (reading.expressions ?? []).find((entry) => !!entry.scene_ref);
  const scene_focus: TechneExpressionSceneFocus | null = bound
    ? {expression_ref: bound.expression_ref, scene_ref: bound.scene_ref as string, revision: bound.revision ?? null}
    : null;

  const ql = reading.ql === undefined ? null : {
    lens_ref: patternOrThrow(reading.ql.lens_ref, "ql.lens_ref", LENS_PATTERN),
    sublens_ref: patternOrThrow(reading.ql.sublens_ref, "ql.sublens_ref", SUBLENS_PATTERN),
    address: nullableRef(reading.ql.address, "ql.address"),
    shape_ref: nullableRef(reading.ql.shape_ref, "ql.shape_ref"),
    warrant: carryWarrant(reading.ql.warrant),
  };

  const cue: TechneExpressionCue = {
    schema: TECHNE_EXPRESSION_CUE_SCHEMA,
    reading_ref: reading.reading_ref,
    subject: {
      subject_ref: reading.subject.subject_ref,
      native_owner: reading.subject.native_owner,
      sources,
    },
    scene_focus,
    ql,
    selection: {
      selection_ref: selection.selection_ref,
      instrument: selection.instrument,
      agent_session_ref: selection.agent_session_ref ?? null,
      snapshot_revision: selection.snapshot_revision ?? null,
    },
  };
  assertCueRefsAreCarried(cue, reading, selection);
  return cue;
}

/**
 * The no-shadow-object guarantee, executable: every ref the cue carries must
 * appear byte-verbatim in the reading or the selection it was built from.
 * The cue introduces no identity of its own — the one literal it may add is
 * the substrate's "unavailable" revision marker.
 */
export function assertCueRefsAreCarried(cue: TechneExpressionCue, reading: TechneReading, selection: DisclosureSelection): void {
  const ground = `${JSON.stringify(reading)}\n${JSON.stringify(selection)}`;
  const carried: string[] = [
    cue.reading_ref,
    cue.subject.subject_ref,
    cue.subject.native_owner,
    ...cue.subject.sources.flatMap((source) => source.revision === "unavailable" ? [source.ref] : [source.ref, source.revision]),
    ...(cue.scene_focus ? [cue.scene_focus.expression_ref, cue.scene_focus.scene_ref] : []),
    ...(cue.scene_focus && cue.scene_focus.revision !== null ? [cue.scene_focus.revision] : []),
    ...(cue.ql
      ? [
          ...(cue.ql.lens_ref ? [cue.ql.lens_ref] : []),
          ...(cue.ql.sublens_ref ? [cue.ql.sublens_ref] : []),
          ...(cue.ql.address ? [cue.ql.address] : []),
          ...(cue.ql.shape_ref ? [cue.ql.shape_ref] : []),
          cue.ql.warrant.provenance_ref,
          ...cue.ql.warrant.evidence_refs,
        ]
      : []),
    cue.selection.selection_ref,
    ...(cue.selection.agent_session_ref ? [cue.selection.agent_session_ref] : []),
    ...(cue.selection.snapshot_revision ? [cue.selection.snapshot_revision] : []),
  ];
  for (const ref of carried) {
    if (!ground.includes(ref)) {
      throw new Error(`Technē Expression cue carries a ref that is not in its sources — no shadow identity: ${ref}`);
    }
  }
}

/**
 * Compose the oi.expression/v1 document the EXISTING kernel open path takes
 * (`{op:"expression", operation:"open"}`), exactly as the Nara adapter's
 * composition does. The subject enters as a subject BINDING — its own refs —
 * never as a cloned entity identity; the substrate itself refuses an
 * expression ref in a subject binding, and so does this composer.
 */
export function expressionDocumentFromCue(cue: TechneExpressionCue): ExpressionDocument {
  if (!cue.scene_focus) throw new Error("No Expression is bound to this subject — there is nothing to instantiate (the disclosure carries the honest reason)");
  const expressionRef = cue.scene_focus.expression_ref;
  if (!expressionRef.startsWith("expression:")) {
    throw new Error(`The bound Expression ${expressionRef} is not in the desktop owner's grammar — it is summoned through the canonical composer, never re-keyed`);
  }
  // The kernel admits scene refs under its own `${expressionRef}:scene:`
  // grammar; the verbatim focus is used when it already satisfies it, and the
  // composer's own scene name (the Nara convention) otherwise. This names a
  // scene inside the opened document; it never rewrites the reading's ref.
  const sceneRef = cue.scene_focus.scene_ref.startsWith(`${expressionRef}:scene:`)
    ? cue.scene_focus.scene_ref
    : `${expressionRef}:scene:main`;
  if (cue.subject.subject_ref.startsWith("expression:")) {
    throw new Error("The Expression substrate refuses an Expression ref as a subject binding — no shadow object");
  }
  const entityRef = `${expressionRef}:entity:subject`;
  const entity = {
    entity_ref: entityRef,
    revision: 1,
    title: `Technē · ${cue.subject.subject_ref}`,
    subject: {
      subject_ref: cue.subject.subject_ref,
      native_owner: cue.subject.native_owner,
      presentation_role: "thing" as const,
      sources: cue.subject.sources,
      readings: [],
      actions: [],
    },
    parameters: {
      glyph: {value: "O", automation: null},
      x: {value: 0, automation: null},
      y: {value: 0, automation: null},
      scale: {value: 1, automation: null},
    },
  };
  return {
    schema: "oi.expression/v1",
    expression_ref: expressionRef,
    revision: 1,
    title: `Technē · ${cue.subject.subject_ref}`,
    scenes: [{scene_ref: sceneRef, revision: 1, title: cue.scene_focus.scene_ref, entity_refs: [entityRef]}],
    entities: {[entityRef]: entity},
    relations: {},
    selection: {scene_ref: sceneRef, entity_ref: entityRef},
    provenance: cue.subject.sources,
    representations: [],
    refinements: [],
  };
}
