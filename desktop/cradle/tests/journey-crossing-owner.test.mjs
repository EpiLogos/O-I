// lane-5 T10/T11 — the journey crossing lives on the one session history.
//   contract  the scene and return traversal steps validate with closed keys; an unknown step is refused by name.
//   floor     the crossing enters the beat's scene through the selection focus; Return finds it by ref equality.
//   history   the crossing, its scene hop, the cut crossing and the return all land on the session's one navigation.
import test from "node:test";
import assert from "node:assert/strict";
import {validateSession} from "../src/techne/contract.ts";
import {createDisclosureSessionStore} from "../src/techne/session.ts";
import {groundSelection, resetSessionAlignment} from "../src/techne/m0m5/reading.ts";
import {provingReading} from "../src/techne/m0m5/journey/proving-reading.ts";
import {beats} from "../src/techne/m0m5/journey/beats.ts";
import {crossToExpression, lostCrossingScene, returnPosition} from "../src/techne/m0m5/journey/crossing.ts";

const EXPRESSION = "oi.expression:probe";
const ONE = `${EXPRESSION}:scene:one`;
const TWO = `${EXPRESSION}:scene:two`;
const THREE = `${EXPRESSION}:scene:three`;

function journeyReading() {
  const reading = structuredClone(provingReading());
  reading.expressions = [
    {expression_ref: EXPRESSION, revision: "7", scene_ref: ONE},
    {expression_ref: EXPRESSION, revision: "7", scene_ref: TWO},
    {expression_ref: EXPRESSION, revision: "7", scene_ref: THREE},
  ];
  return reading;
}

const sceneHop = (session, ref) => ({kind: "traversal", instrument: "journey", step: "scene", ref,
  subject_ref: session.subject_ref, selection_ref: session.selection.selection_ref});
const returnHop = (session, ref) => ({kind: "traversal", instrument: "journey", step: "return", ref,
  subject_ref: session.subject_ref, selection_ref: session.selection.selection_ref});

function enterTwo() {
  resetSessionAlignment();
  const reading = journeyReading();
  const store = createDisclosureSessionStore();
  const journey = store.setSelection(groundSelection(reading, "journey"));
  const crossing = crossToExpression(journey, TWO);
  store.setSelection(crossing.selection);
  store.recordTraversal(sceneHop(store.get(), TWO));
  const crossed = store.crossCut(crossing.target).session;
  return {reading, store, journey, crossed};
}

test("contract: the scene and return steps validate with closed keys, and an unknown step is refused by name", () => {
  const {crossed} = enterTwo();
  const valid = {...crossed, navigation: [...crossed.navigation]};
  assert.equal(validateSession(valid).valid, true, validateSession(valid).errors.join("; "));
  const returned = {...crossed, navigation: [...crossed.navigation, returnHop(crossed, TWO)]};
  assert.equal(validateSession(returned).valid, true, validateSession(returned).errors.join("; "));
  const unknown = {...crossed, navigation: [...crossed.navigation, {...returnHop(crossed, TWO), step: "teleport"}]};
  const refused = validateSession(unknown);
  assert.equal(refused.valid, false);
  assert.match(refused.errors.join(" "), /step/);
  const extra = {...crossed, navigation: [...crossed.navigation, {...returnHop(crossed, TWO), camera: {}}]};
  assert.match(validateSession(extra).errors.join(" "), /unknown field "camera"/);
});

test("the floor: the crossing carries the beat's ref in focus and the identity fields are byte-equal", () => {
  const {journey, crossed} = enterTwo();
  assert.equal(crossed.instrument, "expressions");
  assert.equal(crossed.application_cut, "3:3-conjugate");
  assert.equal(crossed.selection.focus_refs.at(-1), TWO, "the entered Scene's ref ends the focus");
  assert.equal(crossed.subject_ref, journey.subject_ref);
  assert.equal(crossed.reading_ref, journey.reading_ref);
  assert.equal(crossed.selection.selection_ref, journey.selection.selection_ref);
  assert.equal(crossed.selection.agent_session_ref ?? null, journey.selection.agent_session_ref ?? null);
});

test("lostCrossingScene names the scene the last crossing entered, and nothing once a return is recorded", () => {
  const {store, crossed} = enterTwo();
  assert.equal(lostCrossingScene(crossed.navigation), TWO);
  const back = store.crossCut("journey").session;
  store.recordTraversal(returnHop(back, TWO));
  assert.equal(lostCrossingScene(store.get().navigation), null, "a recorded return closes the crossing");
  assert.equal(lostCrossingScene(undefined), null);
  assert.equal(lostCrossingScene([]), null);
});

test("T11: Return finds the beat by ref after the scenes are reordered while crossed, on the same navigation history", () => {
  const {reading, store, crossed} = enterTwo();
  const reordered = [...beats(reading).beats].reverse();
  const back = returnPosition(crossed, reordered);
  assert.equal(back.beat.scene_ref, TWO);
  assert.equal(reordered.indexOf(back.beat), 1, "found by its ref, not by the index it held");
  const before = store.get().navigation.length;
  const returned = store.crossCut("journey").session;
  store.recordTraversal(returnHop(returned, back.beat.scene_ref));
  const session = store.get();
  assert.equal(session.navigation.length, before + 2, "the cut crossing and the return are two hops on the one history");
  assert.equal(session.instrument, "journey");
  assert.equal(session.application_cut, "4:2-deep");
  assert.equal(validateSession(session).valid, true);
});

test("T11: a deleted focused scene discloses the lost beat by name and lands on no neighbouring beat", () => {
  const {reading, store, crossed} = enterTwo();
  const deleted = beats(reading).beats.filter((beat) => beat.scene_ref !== TWO);
  const miss = returnPosition(crossed, deleted);
  assert.equal(miss.beat, null, "no beat is guessed");
  assert.equal(lostCrossingScene(crossed.navigation), TWO, "the lost beat is named from the session's own history");
  const beforeJson = JSON.stringify(store.get().selection);
  assert.equal(JSON.stringify(crossed.selection), beforeJson, "the crossed selection is untouched by the miss");
});
