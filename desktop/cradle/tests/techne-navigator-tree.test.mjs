/**
 * The Technè left navigator's ONE Central-rooted tree (O-I
 * techne-expression-mode.md §§5,7,14,27; OI-CRADLE-UI-CONSOLIDATION-2026-09-23
 * §4; owner commission 2026-09-25): registers dedupe by native identity, not
 * display label; member/relation counts are the native reading's own
 * numbers, never a placeholder.
 *
 * Pure logic only — WikiMapNavigator.tsx itself is JSX and cannot be
 * imported through node's own type-stripping (no JSX transform); its
 * dedupe and count arithmetic live in wikiExpression.ts (plain .ts) exactly
 * so this proof can reach them directly. A browser walk of the rendered
 * tree remains additionally gated on a native kernel (walk-harness).
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs
 *        --test tests/techne-navigator-tree.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {wikiRegistersFrom, relationCountOf, projectWikiExpression} = await import("../src/techne/wikiExpression.ts");

test("wikiRegistersFrom projects ONE Central-rooted tree: 'central' plus each disclosed project, no second Central/Wiki tree", () => {
  const registers = wikiRegistersFrom([{name: "O-I", path: "Work/O-I"}, {name: "Workcell", path: "Work/Workcell"}]);
  assert.deepEqual(registers.map(row => row.key), ["central", "O-I", "Workcell"]);
  assert.equal(registers[0].project, undefined, "Central carries no project scope");
  assert.equal(registers[1].project, "O-I");
});

test("wikiRegistersFrom deduplicates by native identity (the disclosed project name), not by re-listing a display label", () => {
  // A stale or duplicated census entry (the suspected "Projects appearing
  // twice" defect) still yields exactly one register per native project.
  const registers = wikiRegistersFrom([{name: "O-I", path: "Work/O-I"}, {name: "O-I", path: "Work/O-I"}, {name: "Workcell", path: "Work/Workcell"}]);
  assert.deepEqual(registers.map(row => row.key), ["central", "O-I", "Workcell"]);
  assert.equal(new Set(registers.map(row => row.key)).size, registers.length);
});

test("wikiRegistersFrom keeps the first disclosed path for a duplicated native identity (never a silently merged/invented one)", () => {
  const registers = wikiRegistersFrom([{name: "O-I", path: "Work/O-I"}, {name: "O-I", path: "Work/O-I-stale-duplicate"}]);
  assert.equal(registers.length, 2);
  assert.equal(registers[1].projectPath, "Work/O-I");
});

const readyReading = (spaceRef, nodeRefs) => ({
  state: "ready",
  register: {key: "central", title: "Central"},
  wiki: {
    state: "ready",
    nodes: nodeRefs.map((ref, i) => ({ref, title: `Node ${i}`, revision: 1})),
    spaces: [{ref: spaceRef, title: "Home", node_refs: nodeRefs, revision: 1}],
    constellations: [],
  },
  wikiBasis: {path: "Control/agents/wiki/wiki.json", revision: "1", location: {ref: "wiki:file", path: "Control/agents/wiki/wiki.json"}},
  relations: {state: "unavailable", focusRef: spaceRef, reason: "no relations read in this fixture"},
});

test("a constellation's member count is the native reading's own membership count (truthful, no placeholder)", () => {
  const reading = readyReading("wiki:central:root", ["wiki:node:a", "wiki:node:b", "wiki:node:c"]);
  const projection = projectWikiExpression(reading);
  assert.equal(projection.constellations.length, 1);
  assert.equal(projection.constellations[0].members.length, 3);
  assert.deepEqual(projection.constellations[0].members.map(m => m.subjectRef), ["wiki:node:a", "wiki:node:b", "wiki:node:c"]);
});

test("relationCountOf reports zero for an unread or relation-less scene — never an invented edge", () => {
  const reading = readyReading("wiki:central:root", ["wiki:node:a", "wiki:node:b"]);
  const projection = projectWikiExpression(reading);
  assert.equal(relationCountOf(undefined, projection.constellations[0].sceneRef), 0);
  assert.equal(relationCountOf(projection.document, projection.constellations[0].sceneRef), 0);
  assert.equal(relationCountOf(projection.document, "scene:not-in-this-document"), 0);
});

test("relationCountOf counts only edges whose BOTH endpoints are members of that constellation's own Scene (restrained, exact)", () => {
  const reading = readyReading("wiki:central:root", ["wiki:node:a", "wiki:node:b", "wiki:node:c"]);
  const projection = projectWikiExpression(reading);
  const scene = projection.constellations[0];
  const [a, b, c] = scene.members;
  const outsideEntity = "expression:elsewhere:entity:x";
  const document = {
    ...projection.document,
    relations: {
      "r1": {native_owner: "wiki", binding_ref: "r1", relation: {ref: "rel:1", revision: "1", availability: "available"}, from_entity_ref: a.entityRef, to_entity_ref: b.entityRef, provenance: []},
      "r2": {native_owner: "wiki", binding_ref: "r2", relation: {ref: "rel:2", revision: "1", availability: "available"}, from_entity_ref: b.entityRef, to_entity_ref: c.entityRef, provenance: []},
      // An edge with one endpoint outside this Scene must not inflate its count.
      "r3": {native_owner: "wiki", binding_ref: "r3", relation: {ref: "rel:3", revision: "1", availability: "available"}, from_entity_ref: a.entityRef, to_entity_ref: outsideEntity, provenance: []},
    },
  };
  assert.equal(relationCountOf(document, scene.sceneRef), 2);
});
