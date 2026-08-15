import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { projectionViewModel } from "./projection-renderer.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(await fs.readFile(path.join(here, "..", "shared-field", "fixtures", "golden.json"), "utf8"));
const human = golden.human_participant_root_projection;
const agent = golden.agent_participant_projection;
const documentation = golden.documentation_projection;
const finding = golden.factory_finding_projection;

test("Human Participant Root renders chosen identity, public selections and provenance", () => {
  const view = projectionViewModel(human);
  assert.equal(view.title, "Ariadne");
  assert.equal(view.description, "Building humane infrastructure for humans and agents to work together.");
  assert.deepEqual(view.groups.map((group) => group.label), ["Projects", "Interests", "Outputs"]);
  assert.equal(view.source_system, "central");
  assert.equal(view.source_revision, "central-fixture@7");
  assert.equal(view.subject_kind, "central.participant-root");
  assert.equal(JSON.stringify(view).includes("PRIVATE_SENTINEL_NEVER_PROJECT"), false);
});

test("renderer boundary is representation-generic rather than subject-kind-specific", () => {
  const views = [human, agent, documentation, finding].map(projectionViewModel);
  assert.deepEqual(views.map((view) => view.subject_kind), [
    "central.participant-root",
    "software-factory.agent",
    "documentation.markdown",
    "software-factory.finding",
  ]);
  assert.deepEqual(views.map((view) => view.title), [
    "Ariadne",
    "Parāśakti",
    "Shared Field",
    "Projection floor finding",
  ]);
});

test("renderer rejects an unknown representation contract without flattening native type", () => {
  const unsupported = structuredClone(documentation);
  unsupported.representation = { kind: "documentation.html", payload: "<h1>Shared Field</h1>" };
  assert.throws(() => projectionViewModel(unsupported), /Unsupported browser representation/);
});

test("fixture corpus members can be selected without making the renderer subject-specific", async () => {
  const { loadProjectionInto } = await import("./projection-renderer.mjs");
  let fetched;
  const fakeFetch = async (source) => {
    fetched = source;
    return { ok: true, json: async () => golden };
  };
  const fakeDoc = {
    createElement() { throw new Error("DOM should only be needed after Projection selection"); }
  };
  const fakeRoot = {};
  await assert.rejects(
    () => loadProjectionInto(fakeRoot, "golden.json#missing", fakeFetch, fakeDoc),
    /Projection member not found/,
  );
  assert.equal(fetched, "golden.json");
});
