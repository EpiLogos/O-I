/**
 * The Expression verso (ES2) — the structured reading generated over ONE
 * Expression identity (docs/EXPRESSION-WORLD-SUBSTRATE-WAYFINDER.md §1, §5,
 * §17 ES2). The front is the living engine body; the verso is a composable
 * reading over the same identity and its bound subjects: source, provenance,
 * relations, disclosed Actions, available representations.
 *
 * This is a GENERATED MINIMAL verso, not a fixed database-property panel and
 * not a second document. Law carried here:
 *   - refs only. Never a source body, never a private reading body, never
 *     front material parameters (the front owns those).
 *   - one identity. The reading names the expression ref and revision it was
 *     generated from; it is derivable again from the same document at the
 *     same revision.
 *   - deterministic. No clocks, no randomness — the same document produces
 *     the same verso, so a human reading and a structured Agent reading of
 *     "the back" are the same object.
 *   - sparse-able. A document with no subjects/relations/representations
 *     produces an honest sparse verso, never fabricated depth.
 *
 * The verso is a LOCAL presentation. It is not projected: an audience-filtered
 * Projection is a separate explicit act (shared-field/expression-projection.mjs)
 * and carries none of this reading.
 */

export const EXPRESSION_VERSO_SCHEMA = "oi.expression-verso/v1";

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => (typeof value === "string" ? value : "");

/**
 * Generate the verso reading of one ordinary `oi.expression/v1` document.
 * Pure: throws on a malformed document, returns refs only.
 */
export function versoReading(document) {
  if (!isRecord(document) || document.schema !== "oi.expression/v1") {
    throw new TypeError("versoReading expects an oi.expression/v1 document");
  }
  if (typeof document.expression_ref !== "string" || !document.expression_ref.startsWith("expression:")) {
    throw new TypeError("versoReading expects a native Expression ref");
  }
  const entities = isRecord(document.entities) ? document.entities : {};

  // Bound subjects in scene order of the selected scene, then any others —
  // deduplicated by subject ref; each names its sources (refs + availability,
  // never bodies) and its disclosed Actions (refs + authority requirements,
  // never authority itself).
  const selectedScene = (Array.isArray(document.scenes) ? document.scenes : [])
    .find((scene) => isRecord(scene) && scene.scene_ref === document.selection?.scene_ref)
    ?? (Array.isArray(document.scenes) ? document.scenes : [])[0];
  const orderedRefs = [
    ...((selectedScene?.entity_refs ?? []).filter((ref) => typeof ref === "string")),
    ...Object.keys(entities).filter((ref) => !(selectedScene?.entity_refs ?? []).includes(ref)),
  ];
  const subjects = [];
  const seen = new Set();
  for (const ref of orderedRefs) {
    const entity = entities[ref];
    if (!isRecord(entity) || !isRecord(entity.subject)) continue;
    const subjectRef = text(entity.subject.subject_ref);
    if (!subjectRef || seen.has(subjectRef)) continue;
    seen.add(subjectRef);
    subjects.push({
      ref: subjectRef,
      native_owner: text(entity.subject.native_owner),
      presentation_role: entity.subject.presentation_role === "being" ? "being" : "thing",
      entities: [ref],
      sources: (Array.isArray(entity.subject.sources) ? entity.subject.sources : [])
        .filter((source) => isRecord(source) && text(source.ref))
        .map((source) => ({ ref: text(source.ref), revision: text(source.revision), availability: text(source.availability) })),
      actions: (Array.isArray(entity.subject.actions) ? entity.subject.actions : [])
        .filter((action) => isRecord(action) && text(action.action_ref))
        .map((action) => ({ action_ref: text(action.action_ref), target_ref: text(action.target_ref), authority_requirement: text(action.authority_requirement) })),
    });
  }
  // A subject bound by several entities keeps them listed on one row.
  for (const row of subjects) {
    for (const ref of orderedRefs) {
      const entity = entities[ref];
      if (!isRecord(entity) || !isRecord(entity.subject) || entity.subject.subject_ref !== row.ref) continue;
      if (!row.entities.includes(ref)) row.entities.push(ref);
    }
  }

  const relations = Object.entries(isRecord(document.relations) ? document.relations : {})
    .filter(([, relation]) => isRecord(relation) && isRecord(relation.relation))
    .map(([bindingRef, relation]) => ({
      binding_ref: bindingRef,
      relation: { ref: text(relation.relation.ref), revision: text(relation.relation.revision), availability: text(relation.relation.availability) },
      from_entity_ref: text(relation.from_entity_ref),
      to_entity_ref: text(relation.to_entity_ref),
    }));

  const representations = (Array.isArray(document.representations) ? document.representations : [])
    .filter((representation) => isRecord(representation) && isRecord(representation.representation))
    .map((representation) => ({
      kind: text(representation.kind) || "unknown",
      ref: text(representation.representation.ref),
      revision: text(representation.representation.revision),
      availability: text(representation.representation.availability),
    }));

  const provenance = (Array.isArray(document.provenance) ? document.provenance : [])
    .filter((reading) => isRecord(reading) && text(reading.ref))
    .map((reading) => ({ ref: text(reading.ref), revision: text(reading.revision) }));

  return {
    schema: EXPRESSION_VERSO_SCHEMA,
    expression_ref: document.expression_ref,
    revision: document.revision,
    title: text(document.title),
    selected_scene_ref: document.selection?.scene_ref ?? null,
    selected_entity_ref: document.selection?.entity_ref ?? null,
    scenes: (Array.isArray(document.scenes) ? document.scenes : []).map((scene) => ({
      scene_ref: scene.scene_ref,
      title: text(scene.title),
      entity_count: Array.isArray(scene.entity_refs) ? scene.entity_refs.length : 0,
    })),
    subjects,
    relations,
    representations,
    provenance,
  };
}

/** The verso never carries private bodies. Cheap self-check used by tests and
 * by any caller about to display or transmit a reading: planted private
 * material must not appear. */
export function versoLeaks(reading, sentinels) {
  const serialised = JSON.stringify(reading);
  return (Array.isArray(sentinels) ? sentinels : []).filter((sentinel) => typeof sentinel === "string" && serialised.includes(sentinel));
}

/** Front/verso is a presentation relation, so the flip carries exactly the
 * state a return must preserve (ES2: scene, selection, subject, focus). The
 * codec is explicit so a caller cannot silently drop part of it. */
export function versoCarry(document) {
  return clone({
    expression_ref: document.expression_ref,
    revision: document.revision,
    selection: document.selection,
  });
}
