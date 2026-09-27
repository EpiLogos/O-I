/**
 * G1/G4 (techne-inheritance-restoration, owner commission M1 geometry):
 * proves the Wiki→Expression projection (wikiExpression.ts) never guesses a
 * sixfold ring from member cardinality — a constellation with no wiki-
 * declared position stays "radial" (no shape claimed), and only a wiki-
 * warranted position ever selects the "ql-constellation" scheme. Reuses the
 * same law the M1′ Canvas layout states in its own comment (position 0 at
 * the top, clockwise 60° steps) rather than inventing a parallel one.
 *
 * Run: node --experimental-strip-types --import ./tests/ts-register.mjs
 *        --test tests/techne-geometry.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {projectWikiExpression} = await import("../src/techne/wikiExpression.ts");

function reading({nodeRefs, constellationMembers, nodePositions = {}}) {
  const register = {key: "central", title: "Central"};
  const wikiBasis = {
    path: "Control/agents/wiki/wiki.json",
    revision: "r1",
    location: {schema: "central.path-ref/v1", ref: "wiki:central", root: "Control", path: "agents/wiki/wiki.json"},
  };
  const nodes = nodeRefs.map(ref => ({
    object: "node",
    ref,
    title: ref,
    revision: 1,
    ...(nodePositions[ref] !== undefined ? {ql: {position: nodePositions[ref]}} : {}),
  }));
  const wiki = {
    state: "ready",
    spaces: [{object: "space", ref: "wiki:space:whole", title: "Whole", node_refs: nodeRefs, revision: 1}],
    nodes,
    constellations: constellationMembers
      ? [{anchor_ref: "wiki:space:whole", frame_ref: "wiki:frame:1", frame_revision: 1, members: constellationMembers}]
      : [],
  };
  const relations = {state: "unavailable", focusRef: "wiki:space:whole", reason: "test fixture carries no relations read"};
  return {state: "ready", register, wiki, wikiBasis, relations};
}

test("a constellation with NO wiki-declared position is 'radial' — never a sixfold ring guessed from its member count", () => {
  const input = reading({nodeRefs: ["wiki:node:a", "wiki:node:b", "wiki:node:c", "wiki:node:d", "wiki:node:e", "wiki:node:f"]});
  const projection = projectWikiExpression(input);
  assert.equal(projection.constellations.length, 1);
  assert.equal(projection.constellations[0].scheme, "radial", "six members with no declared position must not read as a warranted sixfold shape");
});

test("a constellation with a wiki-declared position on even ONE member is 'ql-constellation' — the warrant, not the count, decides", () => {
  const input = reading({nodeRefs: ["wiki:node:a", "wiki:node:b", "wiki:node:c"], nodePositions: {"wiki:node:a": 2}});
  const projection = projectWikiExpression(input);
  assert.equal(projection.constellations[0].scheme, "ql-constellation");
  const declaredMember = projection.constellations[0].members.find(m => m.subjectRef === "wiki:node:a");
  assert.equal(declaredMember.position, 2, "the member's own recorded position is the wiki's declared value, not a derived index");
});

test("frame constellation member positions (not just node ql facets) also warrant the scheme — the same declared-position law both sources share", () => {
  const input = reading({
    nodeRefs: ["wiki:node:a", "wiki:node:b"],
    constellationMembers: [{ref: "wiki:node:a", position: 0}, {ref: "wiki:node:b"}],
  });
  const projection = projectWikiExpression(input);
  const frame = projection.constellations.find(c => c.kind === "frame");
  assert.ok(frame, "the disclosed frame constellation must project");
  assert.equal(frame.scheme, "ql-constellation");
});

test("an UNDECLARED member inside an otherwise-warranted constellation keeps its own position null — it is not backfilled into the ring", () => {
  const input = reading({
    nodeRefs: ["wiki:node:a", "wiki:node:b"],
    constellationMembers: [{ref: "wiki:node:a", position: 0}, {ref: "wiki:node:b"}],
  });
  const projection = projectWikiExpression(input);
  const frame = projection.constellations.find(c => c.kind === "frame");
  const undeclaredMember = frame.members.find(m => m.subjectRef === "wiki:node:b");
  assert.equal(undeclaredMember.position, null, "a member the wiki never assigned a position must present as undeclared, never a guessed slot");
});
