export const PARTICIPANT_SCHEMA = "oi.participant/v1";
export const PROJECTION_SCHEMA = "oi.projection/v1";
export const RECEIPT_SCHEMA = "oi.projection-receipt/v1";
export const CENTRAL_ROOT_SCHEMA = "oi.central-participant-root/v1";
export const SPARSE_REPRESENTATION_SCHEMA = "oi.sparse-representation/v1";
export const PROJECTION_CAPABILITIES = Object.freeze(["publish", "resolve", "fetch", "subscribe"]);

const VISIBILITIES = new Set(["public", "unlisted", "restricted", "private"]);
const PARTICIPANT_IDENTITY_KINDS = new Set(["human", "agent"]);
const PROJECTION_STATES = new Set(["published", "withdrawn"]);

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

function requireInteger(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function requireTimestamp(value, name) {
  requireString(value, name);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${name} must be an ISO timestamp`);
  return value;
}

function assertAllowedKeys(value, allowed, name) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) {
    throw new TypeError(`${name} contains unsupported keys: ${unexpected.join(", ")}`);
  }
}

function requireRefList(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value.map((entry, index) => requireString(entry, `${name}[${index}]`));
}

function findSelected(items, refs, kind) {
  const byRef = new Map(items.map((item) => [item.ref, item]));
  return refs.map((ref) => {
    const selected = byRef.get(ref);
    if (!selected) throw new TypeError(`Unknown ${kind} ref selected for publication: ${ref}`);
    return clone(selected);
  });
}

export function negotiateTransportCapabilities(available, requested = PROJECTION_CAPABILITIES) {
  if (!Array.isArray(available)) throw new TypeError("available transport capabilities must be an array");
  if (!Array.isArray(requested)) throw new TypeError("requested transport capabilities must be an array");
  const offered = new Set(available.map((value, index) => requireString(value, `available[${index}]`)));
  const wanted = requested.map((value, index) => requireString(value, `requested[${index}]`));
  const supported = wanted.filter((capability) => offered.has(capability));
  const missing = wanted.filter((capability) => !offered.has(capability));
  return { supported, missing, satisfiable: missing.length === 0 };
}

export function createParticipant(input) {
  requireRecord(input, "participant");
  const identity = requireRecord(input.identity, "participant.identity");
  const provenance = requireRecord(input.provenance, "participant.provenance");

  requireString(input.participant_ref, "participant.participant_ref");
  requireString(input.field_ref, "participant.field_ref");
  requireString(identity.kind, "participant.identity.kind");
  if (!PARTICIPANT_IDENTITY_KINDS.has(identity.kind)) {
    throw new TypeError(`participant.identity.kind must be one of ${[...PARTICIPANT_IDENTITY_KINDS].join(", ")}`);
  }
  requireString(identity.ref, "participant.identity.ref");
  requireString(provenance.source_system, "participant.provenance.source_system");
  requireString(provenance.source_revision, "participant.provenance.source_revision");

  const participant = {
    schema: PARTICIPANT_SCHEMA,
    participant_ref: input.participant_ref,
    field_ref: input.field_ref,
    identity: clone(identity),
    presentation: clone(input.presentation ?? {}),
    provenance: clone(provenance),
  };

  if (input.agency) {
    const agency = requireRecord(input.agency, "participant.agency");
    requireString(agency.ref, "participant.agency.ref");
    requireString(agency.source_system, "participant.agency.source_system");
    participant.agency = clone(agency);
  }

  return participant;
}

export function validateParticipant(participant) {
  requireRecord(participant, "participant");
  if (participant.schema !== PARTICIPANT_SCHEMA) {
    throw new TypeError(`Unsupported Participant schema: ${participant.schema}`);
  }
  return createParticipant(participant);
}

function validateAudience(audience) {
  requireRecord(audience, "projection.audience");
  requireString(audience.visibility, "projection.audience.visibility");
  if (!VISIBILITIES.has(audience.visibility)) {
    throw new TypeError(`projection.audience.visibility must be one of ${[...VISIBILITIES].join(", ")}`);
  }
  if (audience.refs !== undefined) requireRefList(audience.refs, "projection.audience.refs");
  return clone(audience);
}

function validateRepresentation(representation, state) {
  requireRecord(representation, "projection.representation");
  requireString(representation.kind, "projection.representation.kind");
  const hasRef = typeof representation.ref === "string" && representation.ref.trim() !== "";
  const hasPayload = Object.prototype.hasOwnProperty.call(representation, "payload");
  if (state === "published" && !hasRef && !hasPayload) {
    throw new TypeError("published projection.representation requires ref or payload");
  }
  return clone(representation);
}

function validateProvenance(provenance) {
  if (!Array.isArray(provenance) || provenance.length === 0) {
    throw new TypeError("projection.provenance must be a non-empty array");
  }
  return provenance.map((entry, index) => {
    requireRecord(entry, `projection.provenance[${index}]`);
    requireString(entry.kind, `projection.provenance[${index}].kind`);
    requireString(entry.ref, `projection.provenance[${index}].ref`);
    requireString(entry.source_system, `projection.provenance[${index}].source_system`);
    if (entry.revision !== undefined) requireString(entry.revision, `projection.provenance[${index}].revision`);
    return clone(entry);
  });
}

export function createProjection(input) {
  requireRecord(input, "projection");
  const subject = requireRecord(input.subject, "projection.subject");
  const source = requireRecord(input.source, "projection.source");
  const state = input.state ?? "published";

  requireString(input.projection_ref, "projection.projection_ref");
  requireInteger(input.projection_revision ?? 1, "projection.projection_revision");
  requireString(subject.ref, "projection.subject.ref");
  requireString(subject.kind, "projection.subject.kind");
  requireString(source.system, "projection.source.system");
  requireString(source.revision, "projection.source.revision");
  requireString(input.publisher_participant_ref, "projection.publisher_participant_ref");
  requireTimestamp(input.published_at, "projection.published_at");
  if (!PROJECTION_STATES.has(state)) throw new TypeError(`Unsupported projection state: ${state}`);

  const projection = {
    schema: PROJECTION_SCHEMA,
    projection_ref: input.projection_ref,
    projection_revision: input.projection_revision ?? 1,
    state,
    subject: clone(subject),
    source: clone(source),
    publisher_participant_ref: input.publisher_participant_ref,
    published_at: input.published_at,
    audience: validateAudience(input.audience),
    representation: validateRepresentation(input.representation, state),
    provenance: validateProvenance(input.provenance),
  };

  if (input.supersedes) projection.supersedes = clone(input.supersedes);
  if (input.withdrawal) projection.withdrawal = clone(input.withdrawal);
  if (input.relation_hints) projection.relation_hints = clone(input.relation_hints);
  if (input.transport) projection.transport = clone(input.transport);

  return projection;
}

export function validateProjection(projection) {
  requireRecord(projection, "projection");
  if (projection.schema !== PROJECTION_SCHEMA) {
    throw new TypeError(`Unsupported Projection schema: ${projection.schema}`);
  }
  return createProjection(projection);
}

export function canonicalProjection(projection) {
  const validated = validateProjection(projection);
  const { transport: _transport, ...canonical } = validated;
  return canonical;
}

export function projectionSemanticIdentity(projection) {
  const canonical = canonicalProjection(projection);
  return {
    schema: canonical.schema,
    projection_ref: canonical.projection_ref,
    projection_revision: canonical.projection_revision,
    state: canonical.state,
    subject: canonical.subject,
    source: canonical.source,
    publisher_participant_ref: canonical.publisher_participant_ref,
    published_at: canonical.published_at,
    audience: canonical.audience,
    representation: canonical.representation,
    provenance: canonical.provenance,
    ...(canonical.supersedes ? { supersedes: canonical.supersedes } : {}),
    ...(canonical.withdrawal ? { withdrawal: canonical.withdrawal } : {}),
    ...(canonical.relation_hints ? { relation_hints: canonical.relation_hints } : {}),
  };
}

export function withTransport(projection, transport) {
  const canonical = canonicalProjection(projection);
  requireRecord(transport, "transport");
  return { ...canonical, transport: clone(transport) };
}

export function reviseProjection(previous, update) {
  const prior = validateProjection(previous);
  if (prior.state === "withdrawn") throw new TypeError("Cannot revise a withdrawn projection");
  requireRecord(update, "projection revision");
  requireString(update.source_revision, "projection revision.source_revision");
  requireTimestamp(update.published_at, "projection revision.published_at");

  return createProjection({
    ...canonicalProjection(prior),
    projection_revision: prior.projection_revision + 1,
    state: "published",
    source: { ...prior.source, revision: update.source_revision },
    published_at: update.published_at,
    representation: update.representation ?? prior.representation,
    provenance: update.provenance ?? prior.provenance,
    supersedes: {
      projection_ref: prior.projection_ref,
      projection_revision: prior.projection_revision,
      source_revision: prior.source.revision,
    },
    transport: update.transport,
  });
}

export function withdrawProjection(previous, input) {
  const prior = validateProjection(previous);
  if (prior.state === "withdrawn") return prior;
  requireRecord(input, "withdrawal");
  requireTimestamp(input.published_at, "withdrawal.published_at");
  requireString(input.reason, "withdrawal.reason");

  return createProjection({
    ...canonicalProjection(prior),
    projection_revision: prior.projection_revision + 1,
    state: "withdrawn",
    published_at: input.published_at,
    representation: {
      kind: "oi.withdrawal/v1",
      payload: { reason: input.reason },
    },
    supersedes: {
      projection_ref: prior.projection_ref,
      projection_revision: prior.projection_revision,
      source_revision: prior.source.revision,
    },
    withdrawal: {
      reason: input.reason,
      source_history_deleted: false,
    },
    transport: input.transport,
  });
}

export function receiveProjection(projection, input) {
  const observed = validateProjection(projection);
  requireRecord(input, "receipt");
  requireString(input.receiver_instance_ref, "receipt.receiver_instance_ref");
  requireTimestamp(input.received_at, "receipt.received_at");
  requireRecord(input.transport, "receipt.transport");

  return {
    schema: RECEIPT_SCHEMA,
    projection_ref: observed.projection_ref,
    projection_revision: observed.projection_revision,
    subject: clone(observed.subject),
    source: clone(observed.source),
    publisher_participant_ref: observed.publisher_participant_ref,
    provenance: clone(observed.provenance),
    receiver: {
      instance_ref: input.receiver_instance_ref,
      received_at: input.received_at,
    },
    transport: clone(input.transport),
    authority: {
      source_authorship_claimed: false,
      canonical_source_mutation: false,
      mode: "observed-read-only",
    },
  };
}

export function selectCentralParticipantRoot(central, selection) {
  requireRecord(central, "Central fixture");
  requireRecord(selection, "Central public selection");
  assertAllowedKeys(
    selection,
    ["schema", "identity", "project_refs", "interest_refs", "output_refs"],
    "Central public selection",
  );
  if (selection.schema !== "oi.central-public-selection/v1") {
    throw new TypeError(`Unsupported Central public selection schema: ${selection.schema}`);
  }

  const human = requireRecord(central.human_identity, "Central fixture.human_identity");
  requireString(human.ref, "Central fixture.human_identity.ref");
  requireString(central.central_ref, "Central fixture.central_ref");
  requireString(central.revision, "Central fixture.revision");
  if (!Array.isArray(central.projects) || !Array.isArray(central.interests) || !Array.isArray(central.outputs)) {
    throw new TypeError("Central fixture projects, interests and outputs must be arrays");
  }

  const identitySelection = requireRecord(selection.identity, "Central public selection.identity");
  assertAllowedKeys(identitySelection, ["display_name", "description"], "Central public selection.identity");

  const publicIdentity = {};
  if (identitySelection.display_name === true) {
    publicIdentity.display_name = requireString(human.display_name, "Central fixture.human_identity.display_name");
  }
  if (identitySelection.description === true && human.description) {
    publicIdentity.description = requireString(human.description, "Central fixture.human_identity.description");
  }

  return {
    schema: CENTRAL_ROOT_SCHEMA,
    subject_ref: `${central.central_ref}#participant-root`,
    subject_kind: "central.participant-root",
    identity_ref: human.ref,
    source: {
      system: "central",
      ref: central.central_ref,
      revision: central.revision,
    },
    public: {
      identity: publicIdentity,
      projects: findSelected(central.projects, requireRefList(selection.project_refs, "selection.project_refs"), "project"),
      interests: findSelected(central.interests, requireRefList(selection.interest_refs, "selection.interest_refs"), "interest"),
      outputs: findSelected(central.outputs, requireRefList(selection.output_refs, "selection.output_refs"), "output"),
    },
  };
}

export function centralRootRepresentation(root) {
  requireRecord(root, "Central participant root");
  if (root.schema !== CENTRAL_ROOT_SCHEMA) throw new TypeError(`Unsupported Central participant root schema: ${root.schema}`);
  const groups = [
    ["Projects", root.public.projects],
    ["Interests", root.public.interests],
    ["Outputs", root.public.outputs],
  ].filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({
      label,
      items: items.map((item) => ({
        label: item.label ?? item.title ?? item.name ?? item.ref,
        ...(item.description ? { description: item.description } : {}),
        ...(item.href ? { href: item.href } : {}),
        ref: item.ref,
      })),
    }));

  return {
    schema: SPARSE_REPRESENTATION_SCHEMA,
    title: root.public.identity.display_name ?? root.identity_ref,
    ...(root.public.identity.description ? { description: root.public.identity.description } : {}),
    groups,
    meta: [
      { label: "Source", value: root.source.system },
      { label: "Revision", value: root.source.revision },
    ],
  };
}
