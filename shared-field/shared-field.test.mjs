import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  canonicalProjection,
  centralRootRepresentation,
  createParticipant,
  createProjection,
  negotiateTransportCapabilities,
  projectionSemanticIdentity,
  receiveProjection,
  reviseProjection,
  selectCentralParticipantRoot,
  validateParticipant,
  validateProjection,
  withTransport,
  withdrawProjection,
} from "./index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(await fs.readFile(path.join(here, "fixtures", "golden.json"), "utf8"));
const {
  central_local: central,
  central_public_selection: selection,
  central_participant_root: goldenRoot,
  human_participant: goldenHumanParticipant,
  human_participant_root_projection: goldenHumanProjection,
  agent_participant: goldenAgentParticipant,
  agent_participant_projection: goldenAgentProjection,
  documentation_projection: goldenDocumentationProjection,
  factory_finding_projection: goldenFinding,
  factory_finding_revision_projection: goldenFindingRevision,
  factory_finding_withdrawn_projection: goldenWithdrawal,
  received_human_participant_root_receipt: goldenReceipt,
} = golden;

test("Central public selection derives the golden Participant Root without Control leakage", () => {
  const root = selectCentralParticipantRoot(central, selection);
  assert.deepEqual(root, goldenRoot);
  const serialized = JSON.stringify(root);
  assert.equal(serialized.includes("PRIVATE_SENTINEL_NEVER_PROJECT"), false);
  assert.equal(serialized.includes("PRIVATE_AGENT_CONTEXT_NEVER_PROJECT"), false);
  assert.equal(serialized.includes("PRIVATE_MACHINE_CONTEXT_NEVER_PROJECT"), false);
  assert.equal(serialized.includes("project:private-lab"), false);
  assert.equal(serialized.includes("interest:private-research"), false);
  assert.equal(serialized.includes("output:private-journal"), false);
});

test("Central selection is allowlisted and cannot request Control wholesale", () => {
  assert.throws(
    () => selectCentralParticipantRoot(central, { ...selection, control: ["Control/user/private-notes.md"] }),
    /unsupported keys: control/,
  );
});

test("Human Participant remains a field relation over the underlying Human identity", () => {
  const participant = validateParticipant(goldenHumanParticipant);
  assert.equal(participant.identity.kind, "human");
  assert.equal(participant.identity.ref, "human:local-human");
  assert.equal(participant.field_ref, "oi:field:public");
  assert.notEqual(participant.participant_ref, participant.identity.ref);
});

test("Agent Participant retains Agent and Agency provenance without runtime identity collapse", () => {
  const participant = validateParticipant(goldenAgentParticipant);
  const projection = validateProjection(goldenAgentProjection);
  assert.equal(participant.identity.kind, "agent");
  assert.equal(participant.identity.ref, "agent:parasakti");
  assert.equal(participant.agency.ref, "agency:parasakti:design");
  assert.equal("harness" in participant.identity, false);
  assert.equal("model" in participant.identity, false);
  assert.deepEqual(projection.provenance.map((entry) => entry.kind), ["agent", "agency"]);
});

test("different native subject kinds survive Projection unchanged", () => {
  const kinds = [
    validateProjection(goldenHumanProjection).subject.kind,
    validateProjection(goldenAgentProjection).subject.kind,
    validateProjection(goldenDocumentationProjection).subject.kind,
    validateProjection(goldenFinding).subject.kind,
  ];
  assert.deepEqual(kinds, [
    "central.participant-root",
    "software-factory.agent",
    "documentation.markdown",
    "software-factory.finding",
  ]);
  assert.equal(new Set(kinds).size, kinds.length);
});

test("transport metadata can change without changing Projection semantic identity", () => {
  const original = validateProjection(goldenHumanProjection);
  const relayed = withTransport(original, {
    kind: "https",
    host: "another-host.example.invalid",
    request_id: "relay-12",
  });
  assert.deepEqual(projectionSemanticIdentity(relayed), projectionSemanticIdentity(original));
  assert.notDeepEqual(relayed.transport, original.transport);
  assert.deepEqual(canonicalProjection(relayed), canonicalProjection(original));
});

test("source revision and provenance survive local to Projection to receive", () => {
  const projection = validateProjection(goldenHumanProjection);
  const receipt = receiveProjection(projection, {
    receiver_instance_ref: "oi:instance:receiver-b",
    received_at: "2026-08-15T12:30:00Z",
    transport: { kind: "https", host: "receiver.example.invalid", cache_key: "root-v1" },
  });
  assert.deepEqual(receipt, goldenReceipt);
  assert.deepEqual(receipt.source, projection.source);
  assert.deepEqual(receipt.provenance, projection.provenance);
  assert.equal(receipt.publisher_participant_ref, projection.publisher_participant_ref);
});

test("receiving a Projection does not confer source authorship or mutation authority", () => {
  assert.equal(goldenReceipt.authority.source_authorship_claimed, false);
  assert.equal(goldenReceipt.authority.canonical_source_mutation, false);
  assert.equal(goldenReceipt.authority.mode, "observed-read-only");
  assert.equal(goldenReceipt.receiver.instance_ref, "oi:instance:receiver-b");
  assert.notEqual(goldenReceipt.receiver.instance_ref, goldenReceipt.publisher_participant_ref);
});

test("revision exposes source drift while preserving subject and Projection refs", () => {
  const revised = reviseProjection(goldenFinding, {
    source_revision: "run:184@4",
    published_at: "2026-08-15T12:20:00Z",
    representation: goldenFindingRevision.representation,
  });
  assert.deepEqual(revised, goldenFindingRevision);
  assert.equal(revised.projection_ref, goldenFinding.projection_ref);
  assert.deepEqual(revised.subject, goldenFinding.subject);
  assert.notEqual(revised.source.revision, goldenFinding.source.revision);
  assert.equal(revised.supersedes.source_revision, goldenFinding.source.revision);
});

test("withdrawal preserves source history and records a new Projection revision", () => {
  const withdrawn = withdrawProjection(goldenFindingRevision, {
    published_at: "2026-08-15T12:25:00Z",
    reason: "Superseded by a later experiment",
  });
  assert.deepEqual(withdrawn, goldenWithdrawal);
  assert.equal(withdrawn.state, "withdrawn");
  assert.equal(withdrawn.withdrawal.source_history_deleted, false);
  assert.equal(withdrawn.source.revision, goldenFindingRevision.source.revision);
});

test("projection capability negotiation keeps transport capability separate from semantics", () => {
  const full = negotiateTransportCapabilities(["publish", "resolve", "fetch", "subscribe", "presence"]);
  assert.deepEqual(full, {
    supported: ["publish", "resolve", "fetch", "subscribe"],
    missing: [],
    satisfiable: true,
  });
  const staticFile = negotiateTransportCapabilities(["publish", "resolve", "fetch"]);
  assert.deepEqual(staticFile.missing, ["subscribe"]);
  assert.equal(staticFile.satisfiable, false);
});

test("the Central Participant Root representation is a generic sparse representation", () => {
  const representation = centralRootRepresentation(goldenRoot);
  assert.equal(representation.schema, "oi.sparse-representation/v1");
  assert.equal(representation.title, "Ariadne");
  assert.deepEqual(representation.groups.map((group) => group.label), ["Projects", "Interests", "Outputs"]);
});

test("constructors reject malformed source identity rather than flattening it", () => {
  assert.throws(
    () => createProjection({
      projection_ref: "projection:bad",
      subject: { ref: "thing:1", kind: "example" },
      source: { system: "example", revision: "" },
      publisher_participant_ref: "participant:1",
      published_at: "2026-08-15T12:00:00Z",
      audience: { visibility: "public" },
      representation: { kind: "text", payload: "x" },
      provenance: [{ kind: "source", ref: "thing:1", source_system: "example" }],
    }),
    /source.revision/,
  );
  assert.throws(
    () => createParticipant({
      participant_ref: "participant:bad",
      field_ref: "oi:field:public",
      identity: { kind: "transport-session", ref: "session:1" },
      provenance: { source_system: "runtime", source_revision: "1" },
    }),
    /identity.kind/,
  );
});
