// The Desk / Run page read model (11-FACTORY §2, §3): titles, names, states,
// unit segments, needs-you, the lane layout and the check states — over the
// owner's real reading shapes (captured from `factory development run` on the
// conformance specimen and the Central-root queued run, 23 Sep).
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-run-model.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
const M = await import("../src/contributions/factory/desk/runModel.ts");

const conformanceRun = {"runRef": "run:01ARZ3NDEKTSV4RRFFQ69G5FAA", "lifecycle": "seeded", "destination": "Exercise the Factory developmental conformance surface", "runMap": {"nodes": {"barrier-implementation-reviewed": {"id": "barrier-implementation-reviewed", "kind": "gate", "label": "Workflow barrier implementation-reviewed", "state": null, "semanticRef": null}, "destination": {"id": "destination", "kind": "destination", "label": "Exercise the Factory developmental conformance surface", "state": null, "semanticRef": null}, "work-implement-compiler": {"id": "work-implement-compiler", "kind": "work", "label": "Compile open Agent-first workflow source into stable Factory units", "state": "planned", "semanticRef": "workflow-unit:1AHR7012Z930Y5QJW42P2KCW2E"}, "work-inspect-source": {"id": "work-inspect-source", "kind": "work", "label": "Recover the current Factory architecture and source obligations", "state": "ready", "semanticRef": "workflow-unit:3C73CMWMP7956ZN0XFWD5FMFYW"}, "work-integrate-return": {"id": "work-integrate-return", "kind": "work", "label": "Integrate implementation and independent review evidence", "state": "planned", "semanticRef": "workflow-unit:49ACFCP5MPWNPRWZ41ZYA6E59W"}, "work-review-adversarially": {"id": "work-review-adversarially", "kind": "work", "label": "Challenge identity and graph compilation under hostile inputs", "state": "planned", "semanticRef": "workflow-unit:7NYK8DYWHBMC6F573XDZN6H17X"}}, "edges": [{"from": "barrier-implementation-reviewed", "to": "work-implement-compiler", "relation": "requires"}, {"from": "barrier-implementation-reviewed", "to": "work-review-adversarially", "relation": "requires"}, {"from": "destination", "to": "work-integrate-return", "relation": "branches_to"}, {"from": "work-implement-compiler", "to": "work-inspect-source", "relation": "requires"}, {"from": "work-integrate-return", "to": "barrier-implementation-reviewed", "relation": "requires"}, {"from": "work-review-adversarially", "to": "work-inspect-source", "relation": "requires"}]}};

const centralRun = {runRef: "run:01M35BZNBNZWDHVTDTT9SCBMTT", lifecycle: "seeded", destination: "oi-65/native-conversation-identity-v3", owningJourneyRefs: ["journey:1"],
  runMap: {nodes: {
    destination: {id: "destination", kind: "destination", label: "oi-65/native-conversation-identity-v3", state: null, semanticRef: null},
    "work-repair": {id: "work-repair", kind: "work", label: "The real Agency-bound Oh-I conversation appears as a generic Conversation.", state: "ready", semanticRef: "workflow-unit:R"},
    "work-verify": {id: "work-verify", kind: "work", label: "Independently establish the identity.", state: "planned", semanticRef: "workflow-unit:V"}},
    edges: [{from: "destination", to: "work-verify", relation: "branches_to"}, {from: "work-verify", to: "work-repair", relation: "requires"}]},
  actions: [{actionRef: "action:x", label: "Request more evidence", currentlyApplicable: false}], executions: [], humanRequests: []};

test("titles: the purpose's first sentence, else the destination made readable — never a ref", () => {
  assert.equal(M.firstSentence("Implement and verify the projection. Explicit successor of retained run:01M."), "Implement and verify the projection");
  assert.equal(M.firstSentence("One sentence only"), "One sentence only");
  assert.equal(M.readableSlug("oi-65/native-conversation-identity-v3"), "Native conversation identity v3");
  assert.equal(M.runTitle(undefined, "oi-65/native-conversation-identity-v3", "run:1"), "Native conversation identity v3");
  assert.equal(M.runTitle("   ", "run:01ABC", "run:01ABC"), "Untitled run");
  assert.doesNotMatch(M.runTitle(undefined, "run:01ABC", "run:01ABC"), /run:/);
});

test("the project is a name from the project key", () => {
  assert.equal(M.projectName("central-project:Factory"), "Factory");
  assert.equal(M.projectName("control:root"), "Central");
  assert.equal(M.projectName("central-project:ai-kit"), "ai-kit");
  // a key that still names a ref after decoding yields the located Central project
  assert.equal(M.projectName("central-project:project%3Aquaternal-logic", "Quaternal-Logic"), "Quaternal-Logic");
  assert.equal(M.projectName(undefined, undefined), undefined);
});

test("lifecycle → state follows Factory's own run_status mapping", () => {
  assert.equal(M.runState("seeded"), "queued");
  assert.equal(M.runState("active"), "running");
  assert.equal(M.runState("waiting_human"), "blocked");
  assert.equal(M.runState("finished"), "success");
  assert.equal(M.runState("aborted"), "fail");
});

test("frontier: Factory's own selection order", () => {
  assert.equal(M.frontierNode(conformanceRun).id, "work-inspect-source");
  assert.equal(M.frontierNode(centralRun).id, "work-repair");
});

test("the lane layout: one lane per work unit, fork, gate spanning its lanes", () => {
  const layout = M.layoutRunMap(conformanceRun);
  assert.equal(layout.lanes, 4, "four work units, four lanes");
  assert.equal(layout.workUnits, 4);
  const cell = id => layout.cells.find(entry => entry.id === id);
  assert.equal(cell("destination").column, 0);
  assert.equal(cell("work-integrate-return").column, 1);
  assert.equal(cell("barrier-implementation-reviewed").column, 2);
  // the fork: both depend only on the gate → same column, different lanes
  assert.equal(cell("work-implement-compiler").column, 3);
  assert.equal(cell("work-review-adversarially").column, 3);
  assert.notEqual(cell("work-implement-compiler").lane, cell("work-review-adversarially").lane);
  assert.equal(cell("work-inspect-source").column, 4);
  assert.equal(cell("work-inspect-source").frontier, true);
  const gate = layout.gates[0];
  assert.equal(gate.laneFrom, 0);
  assert.equal(gate.laneTo, 2, "the gate spans the lanes it holds");
  assert.equal(layout.edges.length, 6);
});

test("unit segments: one per work unit, shaded by standing, never a percentage", () => {
  const segments = M.unitSegments(centralRun);
  assert.deepEqual(segments.map(s => s.standing), ["not-started", "not-started"]);
  const withLegs = M.unitSegments(centralRun, {legs: {"workflow-unit:R": {status: "returned"}, "workflow-unit:V": {status: "active"}}});
  assert.deepEqual(withLegs.map(s => [s.unitRef, s.standing]).sort(), [["workflow-unit:R", "returned"], ["workflow-unit:V", "active"]]);
});

test("the desk card: readable title, next, units, needs-you, column, no refs", () => {
  const source = {statePath: "/s", projectRef: "project:0000", projectKey: "control:root"};
  const journey = {journeyRef: "journey:1", commission: {purpose: "Implement and independently verify the identity projection. Explicit successor of run:1."}, startedAt: "2026-09-22T23:22:11+00:00",
    returns: [{return_ref: "return:a", summary: "done", run_refs: ["run:01M35BZNBNZWDHVTDTT9SCBMTT"]}], recognitions: []};
  const card = M.deskCard(source, centralRun, journey);
  assert.equal(card.title, "Implement and independently verify the identity projection");
  assert.equal(card.projectName, "Central");
  assert.equal(card.next, "The real Agency-bound Oh-I conversation appears as a generic Conversation.");
  assert.equal(card.units.length, 2);
  assert.equal(card.needsYou, 1, "a returned Return awaiting Recognition needs you");
  assert.equal(M.deskColumn(card), "needs-you");
  const recognised = M.deskCard(source, centralRun, {...journey, recognitions: [{recognition_ref: "recognition:1", subject_ref: "return:a"}]});
  assert.equal(recognised.needsYou, 0, "recognising moves it back");
  assert.equal(M.deskColumn(recognised), "queued");
  for (const text of [card.title, card.next, card.projectName]) assert.doesNotMatch(text, /(^|\s)(run|project):/);
  assert.equal(M.deskColumn({...recognised, state: "running"}), "active");
  assert.equal(M.deskColumn({...recognised, state: "success"}), "recent");
  assert.equal(M.deskColumn({...recognised, humanRequests: 1, needsYou: 1}), "needs-you");
});

test("checks: failed wins, passed names its revision, the rest outstanding", () => {
  const rows = M.unitChecks(["a", "b", "c"], [
    {attemptRef: "attempt:1", workflowUnitRef: "u", verification: [{outcome: "passed", obligations: ["a", "b"], sourceRevision: "a41c9e2"}]},
    {attemptRef: "attempt:2", workflowUnitRef: "u", verification: [{outcome: "failed", obligations: ["b"], sourceRevision: "b000001"}]},
  ]);
  assert.deepEqual(rows, [
    {text: "a", state: "passed", revision: "a41c9e2"},
    {text: "b", state: "failed", revision: "b000001"},
    {text: "c", state: "outstanding", revision: undefined},
  ]);
});

test("actions: the first applicable is primary, the rest go to ⋯", () => {
  assert.deepEqual(M.splitActions(centralRun.actions), {primary: undefined, others: []});
  const split = M.splitActions([{actionRef: "a", label: "A", currentlyApplicable: false}, {actionRef: "b", label: "B", currentlyApplicable: true}, {actionRef: "c", label: "C", currentlyApplicable: true}]);
  assert.equal(split.primary.label, "B");
  assert.deepEqual(split.others.map(a => a.label), ["C"]);
});

test("initials and search use readable words only", () => {
  assert.equal(M.initials("Builder"), "Bu");
  assert.equal(M.initials("Factory conformance Agency"), "Fc");
  const card = M.deskCard({statePath: "/s", projectRef: "p", projectKey: "central-project:Factory"}, centralRun);
  assert.equal(M.cardMatches(card, "identity v3"), true);
  assert.equal(M.cardMatches(card, "run:01M"), false, "refs are not searched");
});
