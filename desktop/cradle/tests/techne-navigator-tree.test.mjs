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

const {wikiRegistersFrom, relationCountOf, projectWikiExpression, treeConstellationsOf, projectOfWikiSpace, projectSpaceRefOf} = await import("../src/techne/wikiExpression.ts");
const {parseWiki} = await import("../src/techne/wikiReading.ts");

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

// ---- the one tree (owner commission 2026-09-25, repair map N1/N3) ---------

const ROOT_CHILDREN = ["Actuation", "Central", "Factory", "O-I", "Point-Cloud-Demo", "Workcell", "ai-kit",
  "documentation-audit-2026-09-06", "epi", "legacy", "personal", "projects", "wiki-continuity-2026-09-06"];
const PROJECTS = [...ROOT_CHILDREN, "Quaternal-Logic"];

const rootReading = () => ({
  state: "ready",
  register: {key: "central", title: "Central"},
  wiki: {
    state: "ready",
    nodes: ["wiki:node:identity", "wiki:node:a", "wiki:node:b"].map((ref, i) => ({object: "node", ref, title: `Node ${i}`, revision: 1})),
    spaces: [{object: "space", ref: "central:wiki:root", title: "Central", anchor_ref: "wiki:node:identity",
      node_refs: ["wiki:node:identity", "wiki:node:a", "wiki:node:b"], child_space_refs: ROOT_CHILDREN.map(name => `central:wiki:project:${name}`), revision: 1}],
    constellations: [],
  },
  wikiBasis: {path: "Control/agents/wiki/wiki.json", revision: "1", location: {ref: "wiki:file", path: "Control/agents/wiki/wiki.json"}},
  relations: {state: "unavailable", focusRef: "central:wiki:root", reason: "fixture"},
});

test("the Central root lists its own constellations once and no Project a second time: 13 child spaces with 14 Project registers leave only the root space", () => {
  const projection = projectWikiExpression(rootReading());
  assert.equal(projection.constellations.length, 14, "the projection itself still carries the root space and its 13 disclosed child spaces");
  assert.equal(projection.constellations.filter(row => row.disclosedChild).length, 13);
  const registers = wikiRegistersFrom(PROJECTS.map(name => ({name, path: `Work/${name}`})));
  const projects = new Set(registers.flatMap(row => row.project ? [row.project] : []));
  const listed = treeConstellationsOf(projection.constellations, projects);
  assert.deepEqual(listed.map(row => row.wholeRef), ["wiki:node:identity"], "each child space IS its Project's node; only the root's own space is listed");
  assert.equal(listed[0].members.length, 2, "the root space's own members, excluding its anchor");
  assert.equal(registers.length, 15, "Central plus 14 Project nodes");
});

test("a root child space whose Project is not a disclosed register stays listed (never silently dropped)", () => {
  const projection = projectWikiExpression(rootReading());
  const listed = treeConstellationsOf(projection.constellations, new Set(["O-I"]));
  assert.equal(listed.length, 13);
  assert.ok(!listed.some(row => row.wholeRef === "central:wiki:project:O-I"));
  assert.ok(listed.some(row => row.wholeRef === "central:wiki:project:Workcell"));
});

test("dedupe is by native identity in the ref grammar, not by display name", () => {
  assert.equal(projectOfWikiSpace("central:wiki:project:O-I"), "O-I");
  assert.equal(projectOfWikiSpace("central:wiki:root"), null);
  const projection = projectWikiExpression(rootReading());
  // A register named like a child space's display leaf but not its identity keeps the space listed.
  const listed = treeConstellationsOf(projection.constellations, new Set(["o-i"]));
  assert.ok(listed.some(row => row.wholeRef === "central:wiki:project:O-I"));
});

const frameWiki = JSON.stringify({objects: [
  {object: "space", ref: "central:wiki:project:O-I", title: "O-I", node_refs: ["wiki:node:x", "wiki:anchor:1"], revision: 2},
  {object: "node", ref: "wiki:node:x", title: "X", revision: 1},
  {object: "node", ref: "wiki:anchor:1", title: "Anchor title", type: "Constellation", revision: 1},
  {object: "frame", ref: "wiki:frame:1", revision: 1, "aikit.constellation/v1": {title: "What holds the field?", inquiry: {question: "Which relations carry it?"}},
    constellations: [{anchor_ref: "wiki:anchor:1", members: []}]},
  {object: "frame", ref: "wiki:frame:2", revision: 1, "aikit.constellation/v1": {title: "", inquiry: {question: "Only a question"}},
    constellations: [{anchor_ref: "wiki:anchor:2", members: []}]},
]});

test("parseWiki reads a frame's own aikit.constellation/v1 title and question; the projection names the constellation by them, never by its anchor ref", () => {
  const wiki = parseWiki(frameWiki);
  assert.equal(wiki.constellations[0].title, "What holds the field?");
  assert.equal(wiki.constellations[0].question, "Which relations carry it?");
  assert.equal(wiki.constellations[1].title, undefined);
  const projection = projectWikiExpression({...rootReading(), register: {key: "O-I", title: "O-I", project: "O-I"}, wiki});
  const frames = projection.constellations.filter(row => row.kind === "frame");
  assert.deepEqual(frames.map(row => row.title), ["What holds the field?", "Only a question"]);
  assert.ok(frames.every(row => !row.title.includes("anchor")));
});

test("a new constellation is listed once — as itself — and its space's member count excludes its anchor", () => {
  const wiki = parseWiki(frameWiki);
  const projection = projectWikiExpression({...rootReading(), register: {key: "O-I", title: "O-I", project: "O-I"}, wiki});
  const listed = treeConstellationsOf(projection.constellations, new Set(["O-I"]));
  const space = listed.find(row => row.kind === "space");
  assert.deepEqual(space.members.map(row => row.subjectRef), ["wiki:node:x"]);
  assert.equal(listed.filter(row => row.kind === "frame").length, 2);
  assert.equal(listed.find(row => row.wholeRef === "wiki:anchor:1").members.length, 0, "a fresh frame truthfully has no members");
});

test("a Project's new constellation is placed in that Project's own space from its register reading", () => {
  assert.equal(projectSpaceRefOf([{ref: "central:wiki:project:X"}, {ref: "central:wiki:project:O-I"}], "O-I"), "central:wiki:project:O-I");
  assert.equal(projectSpaceRefOf([{ref: "central:wiki:project:project:quaternal-logic"}, {ref: "central:wiki:project:quaternal-logic"}], "Quaternal-Logic"), "central:wiki:project:quaternal-logic");
  assert.equal(projectSpaceRefOf([{ref: "space:only"}], "O-I"), "space:only");
  assert.equal(projectSpaceRefOf([], "O-I"), undefined);
  assert.equal(projectSpaceRefOf([{ref: "a"}, {ref: "central:wiki:root"}], undefined), "central:wiki:root");
});
