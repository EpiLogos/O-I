export const SHARED_FIELD_SCHEMA = "oi.shared-field/v1";
export const CONTRIBUTION_SCHEMA = "oi.contribution/v1";
export const ENCOUNTER_SCHEMA = "oi.encounter/v1";

export const CONTRIBUTION_MODES = Object.freeze([
  "statement",
  "reply",
  "question",
  "finding",
  "opinion",
  "support",
  "challenge",
  "correction",
  "reproduction",
  "synthesis",
  "decision",
  "experiment-proposal",
  "rating",
  "ranking",
  "metric",
  "moderation",
]);

const FIELD_VISIBILITIES = new Set(["public", "unlisted", "restricted", "private"]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, name) {
  if (!isRecord(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function requireTimestamp(value, name) {
  requireString(value, name);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be an ISO timestamp`);
  return value;
}

function validateRef(value, name) {
  const ref = requireRecord(value, name);
  requireString(ref.ref, `${name}.ref`);
  requireString(ref.kind, `${name}.kind`);
  if (ref.revision !== undefined) requireString(ref.revision, `${name}.revision`);
  return clone(ref);
}

function validateProvenance(provenance, name) {
  if (!Array.isArray(provenance) || provenance.length === 0) {
    throw new TypeError(`${name} must be a non-empty array`);
  }
  return provenance.map((entry, index) => {
    const value = requireRecord(entry, `${name}[${index}]`);
    requireString(value.kind, `${name}[${index}].kind`);
    requireString(value.ref, `${name}[${index}].ref`);
    requireString(value.source_system, `${name}[${index}].source_system`);
    if (value.revision !== undefined) requireString(value.revision, `${name}[${index}].revision`);
    return clone(value);
  });
}

function validateRepresentation(representation, name) {
  const value = requireRecord(representation, name);
  requireString(value.kind, `${name}.kind`);
  const hasRef = typeof value.ref === "string" && value.ref.trim() !== "";
  const hasPayload = Object.prototype.hasOwnProperty.call(value, "payload");
  if (!hasRef && !hasPayload) throw new TypeError(`${name} requires ref or payload`);
  return clone(value);
}

/**
 * SharedField is an addressable relational environment, not a Context or WikiSpace.
 * parent_field_ref expresses containment only. Federation remains a separate relation.
 */
export function createSharedField(input) {
  requireRecord(input, "shared field");
  requireString(input.field_ref, "shared field.field_ref");
  requireString(input.kind ?? "general", "shared field.kind");

  if (input.parent_field_ref !== undefined) {
    requireString(input.parent_field_ref, "shared field.parent_field_ref");
    if (input.parent_field_ref === input.field_ref) {
      throw new TypeError("shared field cannot contain itself");
    }
  }

  const visibility = input.visibility ?? "public";
  requireString(visibility, "shared field.visibility");
  if (!FIELD_VISIBILITIES.has(visibility)) {
    throw new TypeError(`shared field.visibility must be one of ${[...FIELD_VISIBILITIES].join(", ")}`);
  }

  return {
    schema: SHARED_FIELD_SCHEMA,
    field_ref: input.field_ref,
    kind: input.kind ?? "general",
    visibility,
    ...(input.title ? { title: requireString(input.title, "shared field.title") } : {}),
    ...(input.parent_field_ref ? { parent_field_ref: input.parent_field_ref } : {}),
    ...(input.anchor ? { anchor: validateRef(input.anchor, "shared field.anchor") } : {}),
    ...(input.presentation ? { presentation: clone(requireRecord(input.presentation, "shared field.presentation")) } : {}),
    provenance: validateProvenance(input.provenance, "shared field.provenance"),
  };
}

export function validateSharedField(field) {
  requireRecord(field, "shared field");
  if (field.schema !== SHARED_FIELD_SCHEMA) {
    throw new TypeError(`Unsupported SharedField schema: ${field.schema}`);
  }
  return createSharedField(field);
}

/**
 * Validate only local containment facts. A parent may intentionally live outside the supplied
 * set (for example a federated/imported view), but cycles among supplied fields are rejected.
 */
export function validateSharedFieldNesting(fields) {
  if (!Array.isArray(fields)) throw new TypeError("fields must be an array");
  const validated = fields.map(validateSharedField);
  const byRef = new Map();
  for (const field of validated) {
    if (byRef.has(field.field_ref)) throw new TypeError(`Duplicate SharedField ref: ${field.field_ref}`);
    byRef.set(field.field_ref, field);
  }

  for (const field of validated) {
    const seen = new Set([field.field_ref]);
    let cursor = field;
    while (cursor.parent_field_ref && byRef.has(cursor.parent_field_ref)) {
      if (seen.has(cursor.parent_field_ref)) {
        throw new TypeError(`SharedField containment cycle detected at ${cursor.parent_field_ref}`);
      }
      seen.add(cursor.parent_field_ref);
      cursor = byRef.get(cursor.parent_field_ref);
    }
  }
  return validated;
}

/**
 * A Contribution is any attributable difference returned to a SharedField.
 * Its target is generic and may itself be a Contribution, so commentary, opinions,
 * ratings, rankings, metrics and moderation acts remain recursively addressable contributions.
 */
export function createContribution(input) {
  requireRecord(input, "contribution");
  requireString(input.contribution_ref, "contribution.contribution_ref");
  requireString(input.field_ref, "contribution.field_ref");
  requireString(input.contributor_participant_ref, "contribution.contributor_participant_ref");
  requireTimestamp(input.created_at, "contribution.created_at");
  requireString(input.mode, "contribution.mode");

  const contribution = {
    schema: CONTRIBUTION_SCHEMA,
    contribution_ref: input.contribution_ref,
    field_ref: input.field_ref,
    contributor_participant_ref: input.contributor_participant_ref,
    created_at: input.created_at,
    mode: input.mode,
    target: validateRef(input.target, "contribution.target"),
    relation: clone(requireRecord(input.relation, "contribution.relation")),
    representation: validateRepresentation(input.representation, "contribution.representation"),
    provenance: validateProvenance(input.provenance, "contribution.provenance"),
  };

  requireString(contribution.relation.kind, "contribution.relation.kind");

  if (input.source) {
    const source = requireRecord(input.source, "contribution.source");
    requireString(source.system, "contribution.source.system");
    if (source.revision !== undefined) requireString(source.revision, "contribution.source.revision");
    contribution.source = clone(source);
  }
  if (input.agency) {
    const agency = requireRecord(input.agency, "contribution.agency");
    requireString(agency.ref, "contribution.agency.ref");
    if (agency.execution_ref !== undefined) requireString(agency.execution_ref, "contribution.agency.execution_ref");
    contribution.agency = clone(agency);
  }

  return contribution;
}

export function validateContribution(contribution) {
  requireRecord(contribution, "contribution");
  if (contribution.schema !== CONTRIBUTION_SCHEMA) {
    throw new TypeError(`Unsupported Contribution schema: ${contribution.schema}`);
  }
  return createContribution(contribution);
}

export function isNestedContribution(contribution) {
  const value = validateContribution(contribution);
  return value.target.kind === "oi.contribution";
}

/**
 * Encounter records what a participant was objectively presented with through a mediation path.
 * It does not claim phenomenal experience, belief, understanding, or subjective state.
 */
export function createEncounter(input) {
  requireRecord(input, "encounter");
  requireString(input.encounter_ref, "encounter.encounter_ref");
  requireString(input.field_ref, "encounter.field_ref");
  requireString(input.participant_ref, "encounter.participant_ref");
  requireTimestamp(input.occurred_at, "encounter.occurred_at");

  const mediation = requireRecord(input.mediation, "encounter.mediation");
  requireString(mediation.kind, "encounter.mediation.kind");

  if (!Array.isArray(input.items)) throw new TypeError("encounter.items must be an array");
  const items = input.items.map((item, index) => validateRef(item, `encounter.items[${index}]`));

  return {
    schema: ENCOUNTER_SCHEMA,
    encounter_ref: input.encounter_ref,
    field_ref: input.field_ref,
    participant_ref: input.participant_ref,
    occurred_at: input.occurred_at,
    mediation: clone(mediation),
    items,
    provenance: validateProvenance(input.provenance, "encounter.provenance"),
  };
}

export function validateEncounter(encounter) {
  requireRecord(encounter, "encounter");
  if (encounter.schema !== ENCOUNTER_SCHEMA) {
    throw new TypeError(`Unsupported Encounter schema: ${encounter.schema}`);
  }
  return createEncounter(encounter);
}

/**
 * Minimal Self/Other read model for a browser or agent surface. It preserves the participant
 * relation and the field boundary without claiming that either side's identity is owned here.
 */
export function selfOtherReadModel({ self, others, field }) {
  const validatedField = validateSharedField(field);
  requireRecord(self, "self participant");
  if (self.schema !== "oi.participant/v1") throw new TypeError("self must be an oi.participant/v1 relation");
  requireString(self.participant_ref, "self participant.participant_ref");
  if (self.field_ref !== validatedField.field_ref) {
    throw new TypeError("self participant must participate in the selected SharedField");
  }
  if (!Array.isArray(others)) throw new TypeError("others must be an array");

  const otherParticipants = others.map((other, index) => {
    requireRecord(other, `others[${index}]`);
    if (other.schema !== "oi.participant/v1") throw new TypeError(`others[${index}] must be an oi.participant/v1 relation`);
    requireString(other.participant_ref, `others[${index}].participant_ref`);
    requireString(other.field_ref, `others[${index}].field_ref`);
    if (other.field_ref !== validatedField.field_ref) {
      throw new TypeError(`others[${index}] must participate in the selected SharedField`);
    }
    return clone(other);
  });

  return {
    field: {
      ref: validatedField.field_ref,
      kind: validatedField.kind,
      ...(validatedField.title ? { title: validatedField.title } : {}),
    },
    self: clone(self),
    others: otherParticipants,
  };
}
