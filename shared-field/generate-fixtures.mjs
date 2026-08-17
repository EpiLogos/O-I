import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createParticipant,
  createProjection,
  receiveProjection,
  reviseProjection,
  selectCentralParticipantRoot,
  centralRootRepresentation,
  withdrawProjection,
} from "./index.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(here, "fixtures", "golden.json");

const centralLocal = {
  schema: "fixture.central/v1",
  central_ref: "central:local-human",
  revision: "central-fixture@7",
  human_identity: {
    ref: "human:local-human",
    display_name: "Ariadne",
    description: "Building humane infrastructure for humans and agents to work together.",
  },
  control: {
    "Control/user/private-notes.md": "PRIVATE_SENTINEL_NEVER_PROJECT",
    "Control/agents/collaboration.md": "PRIVATE_AGENT_CONTEXT_NEVER_PROJECT",
    "Control/machines/workstation.md": "PRIVATE_MACHINE_CONTEXT_NEVER_PROJECT",
  },
  projects: [
    {
      ref: "project:o-i",
      label: "{O:I}",
      description: "Operating infrastructure around situated agency.",
      href: "https://github.com/EpiLogos/O-I",
    },
    { ref: "project:private-lab", label: "Private Lab", description: "Not selected for publication." },
  ],
  interests: [
    { ref: "interest:agentic-engineering", label: "Agentic engineering" },
    { ref: "interest:private-research", label: "Private research topic" },
  ],
  outputs: [
    {
      ref: "output:oi-shared-field",
      label: "O:I shared-field architecture",
      description: "A local-first projection and participation seam.",
    },
    { ref: "output:private-journal", label: "Private journal" },
  ],
};

const centralPublicSelection = {
  schema: "oi.central-public-selection/v1",
  identity: { display_name: true, description: true },
  project_refs: ["project:o-i"],
  interest_refs: ["interest:agentic-engineering"],
  output_refs: ["output:oi-shared-field"],
};

const centralParticipantRoot = selectCentralParticipantRoot(centralLocal, centralPublicSelection);
const humanParticipant = createParticipant({
  participant_ref: "participant:public:ariadne",
  field_ref: "oi:field:public",
  identity: { kind: "human", ref: centralParticipantRoot.identity_ref },
  presentation: { chosen_name: centralParticipantRoot.public.identity.display_name },
  provenance: {
    source_system: centralParticipantRoot.source.system,
    source_revision: centralParticipantRoot.source.revision,
    source_ref: centralParticipantRoot.source.ref,
  },
});

const humanParticipantRootProjection = createProjection({
  projection_ref: "projection:ariadne:root",
  projection_revision: 1,
  subject: { ref: centralParticipantRoot.subject_ref, kind: centralParticipantRoot.subject_kind },
  source: centralParticipantRoot.source,
  publisher_participant_ref: humanParticipant.participant_ref,
  published_at: "2026-08-15T12:00:00Z",
  audience: { visibility: "public" },
  representation: { kind: "oi.sparse-representation/v1", payload: centralRootRepresentation(centralParticipantRoot) },
  provenance: [
    {
      kind: "human-identity",
      ref: centralParticipantRoot.identity_ref,
      source_system: "central",
      revision: centralParticipantRoot.source.revision,
    },
    {
      kind: "central-participant-root",
      ref: centralParticipantRoot.subject_ref,
      source_system: "central",
      revision: centralParticipantRoot.source.revision,
    },
  ],
  transport: { kind: "static-file", locator: "shared-field/fixtures/golden.json#human_participant_root_projection" },
});

const agentParticipant = createParticipant({
  participant_ref: "participant:public:parasakti",
  field_ref: "oi:field:public",
  identity: { kind: "agent", ref: "agent:parasakti" },
  agency: { ref: "agency:parasakti:design", source_system: "software-factory" },
  presentation: { chosen_name: "Parāśakti" },
  provenance: { source_system: "software-factory", source_revision: "factory-agent-canon@21" },
});

const agentParticipantProjection = createProjection({
  projection_ref: "projection:parasakti:participant-root",
  subject: { ref: "agent:parasakti", kind: "software-factory.agent" },
  source: { system: "software-factory", revision: "factory-agent-canon@21" },
  publisher_participant_ref: agentParticipant.participant_ref,
  published_at: "2026-08-15T12:05:00Z",
  audience: { visibility: "public" },
  representation: {
    kind: "oi.sparse-representation/v1",
    payload: {
      schema: "oi.sparse-representation/v1",
      title: "Parāśakti",
      description: "Design-oriented Agent participant.",
      groups: [],
      meta: [
        { label: "Agent", value: "agent:parasakti" },
        { label: "Agency", value: "agency:parasakti:design" },
      ],
    },
  },
  provenance: [
    { kind: "agent", ref: "agent:parasakti", source_system: "software-factory", revision: "factory-agent-canon@21" },
    { kind: "agency", ref: "agency:parasakti:design", source_system: "software-factory", revision: "factory-agent-canon@21" },
  ],
  transport: { kind: "https", host: "field.example.invalid" },
});

const documentationProjection = createProjection({
  projection_ref: "projection:oi:shared-field-doc",
  subject: { ref: "repo:EpiLogos/O-I:docs/SHARED-FIELD.md", kind: "documentation.markdown" },
  source: { system: "git", revision: "af0dbb000cc162ca624c4cc2cbe669767aeb29d2" },
  publisher_participant_ref: humanParticipant.participant_ref,
  published_at: "2026-08-15T12:10:00Z",
  audience: { visibility: "public" },
  representation: {
    kind: "oi.sparse-representation/v1",
    payload: {
      schema: "oi.sparse-representation/v1",
      title: "Shared Field",
      description: "Local worlds, Projection, participation and transport.",
      groups: [],
      meta: [{ label: "Native type", value: "documentation.markdown" }],
    },
  },
  provenance: [
    {
      kind: "git-object",
      ref: "repo:EpiLogos/O-I:docs/SHARED-FIELD.md",
      source_system: "git",
      revision: "af0dbb000cc162ca624c4cc2cbe669767aeb29d2",
    },
  ],
});

const factoryFindingProjection = createProjection({
  projection_ref: "projection:factory:finding:projection-floor",
  subject: { ref: "factory:finding:projection-floor", kind: "software-factory.finding" },
  source: { system: "software-factory", revision: "run:184@3" },
  publisher_participant_ref: agentParticipant.participant_ref,
  published_at: "2026-08-15T12:15:00Z",
  audience: { visibility: "public" },
  representation: {
    kind: "oi.sparse-representation/v1",
    payload: {
      schema: "oi.sparse-representation/v1",
      title: "Projection floor finding",
      description: "Transport metadata is not semantic identity.",
      groups: [],
      meta: [{ label: "Run", value: "run:184" }],
    },
  },
  provenance: [
    { kind: "factory-run", ref: "run:184", source_system: "software-factory", revision: "run:184@3" },
    { kind: "artifact", ref: "artifact:184:projection-floor", source_system: "software-factory", revision: "artifact:184@1" },
  ],
});

const factoryFindingRevisionProjection = reviseProjection(factoryFindingProjection, {
  source_revision: "run:184@4",
  published_at: "2026-08-15T12:20:00Z",
  representation: {
    kind: "oi.sparse-representation/v1",
    payload: {
      schema: "oi.sparse-representation/v1",
      title: "Projection floor finding",
      description: "Transport and host metadata can vary while Projection semantic identity remains transport-neutral.",
      groups: [],
      meta: [{ label: "Run", value: "run:184" }],
    },
  },
});

const factoryFindingWithdrawnProjection = withdrawProjection(factoryFindingRevisionProjection, {
  published_at: "2026-08-15T12:25:00Z",
  reason: "Superseded by a later experiment",
});

const receivedHumanParticipantRootReceipt = receiveProjection(humanParticipantRootProjection, {
  receiver_instance_ref: "oi:instance:receiver-b",
  received_at: "2026-08-15T12:30:00Z",
  transport: { kind: "https", host: "receiver.example.invalid", cache_key: "root-v1" },
});

const golden = {
  central_local: centralLocal,
  central_public_selection: centralPublicSelection,
  central_participant_root: centralParticipantRoot,
  human_participant: humanParticipant,
  human_participant_root_projection: humanParticipantRootProjection,
  agent_participant: agentParticipant,
  agent_participant_projection: agentParticipantProjection,
  documentation_projection: documentationProjection,
  factory_finding_projection: factoryFindingProjection,
  factory_finding_revision_projection: factoryFindingRevisionProjection,
  factory_finding_withdrawn_projection: factoryFindingWithdrawnProjection,
  received_human_participant_root_receipt: receivedHumanParticipantRootReceipt,
};

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(golden, null, 2)}\n`);
console.log(output);
