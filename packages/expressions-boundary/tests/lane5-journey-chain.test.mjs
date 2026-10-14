// lane-5 T23 — the TD4 navigation contract walked end to end on the owner's one route:
//   reading → beat → Scene → source/verso → back through the Scene → back to the Journey, twice (TD8 repeat).
// The identity fields (subject, reading, selection, agent session, session) are byte-identical at the start and the end;
// only the scene focus and the navigation history change, and the scene focus names the entered beat by ref.
// The source/verso leg is a host placement (the frame's portal path), so it writes no session state here.
// The owner imports the production sources, so run it with the boundary's loader, from packages/expressions-boundary:
//   node --experimental-webstorage --localstorage-file=<tmp> --import ./tests/register-production-sources.mjs --test tests/lane5-journey-chain.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {validateSession} from "../../../desktop/cradle/src/techne/contract.ts";
import {createDisclosureSessionStore} from "../../../desktop/cradle/src/techne/session.ts";
import {provingReading} from "../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts";
import {createNativeTimeWindowOwner} from "../src/timeWindow.ts";

const EXPRESSION = "expression:journey-chain";
const ONE = `${EXPRESSION}:scene:one`;
const TWO = `${EXPRESSION}:scene:two`;
const THREE = `${EXPRESSION}:scene:three`;
const binding = (scene_ref) => ({expression_ref: EXPRESSION, revision: "7", scene_ref});
const expressionReading = (scenes = [ONE, TWO, THREE]) => {
  const reading = structuredClone(provingReading());
  reading.expressions = scenes.map(binding);
  return reading;
};
const sceneReading = (scene) => ({...expressionReading(), expressions: [binding(scene)]});
const basisAt = (scene_ref) => ({expression_ref: EXPRESSION, revision: 7, scene_ref});
const contextAt = (basis) => ({mode: "techne", bindingId: "journey-chain", epoch: 1,
  signal: new AbortController().signal, state: {hostMode: "techne", nativeScene: structuredClone(basis)}, current: () => true});
const readingRef = () => provingReading().reading_ref;

function owner(scene = TWO, scenes = [ONE, TWO, THREE]) {
  const store = createDisclosureSessionStore();
  const handle = createNativeTimeWindowOwner({store});
  const basis = basisAt(scene), context = contextAt(basis);
  handle.admit(basis, sceneReading(scene), context);
  handle.admitJourney(basis, expressionReading(scenes), context);
  return {store, owner: handle, basis, context};
}

// The frame's enter: the explicit ground (refresh) on the journey, then the crossing against that acknowledged session.
function acknowledge(state) {
  return state.owner.handle({...state.basis, reading_ref: readingRef(), instrument: "journey", operation: "refresh"}, state.context);
}
function cross(state, ack, target) {
  return state.owner.handle({...state.basis, reading_ref: readingRef(), instrument: "journey", operation: "cross",
    expected_session_ref: ack.session.session_ref, expected_selection: structuredClone(ack.session.selection),
    expected_window: structuredClone(ack.axis.window), target_scene_ref: target}, state.context);
}
// The frame's return: the compare-and-set is the acknowledged crossing reply.
function back(state, crossed) {
  return state.owner.handle({...state.basis, reading_ref: readingRef(), instrument: "expressions", operation: "return",
    expected_session_ref: crossed.session.session_ref, expected_selection: structuredClone(crossed.session.selection),
    expected_window: structuredClone(crossed.axis.window)}, state.context);
}

const identityOf = (session) => JSON.stringify({
  session_ref: session.session_ref,
  subject_ref: session.subject_ref,
  reading_ref: session.reading_ref,
  selection_ref: session.selection.selection_ref,
  agent_session_ref: session.selection.agent_session_ref ?? null,
});

test("T23: reading -> beat -> scene -> source -> back through the scene -> journey, twice, with identity byte-identical at start and end", () => {
  const state = owner(TWO);
  const start = acknowledge(state).session;
  const startIdentity = identityOf(start);
  assert.equal(start.instrument, "journey");
  assert.equal(validateSession(start).valid, true);

  // The reading is on the Journey; a beat is entered, the Expression reading is the live Scene; then back, twice.
  for (let cycle = 0; cycle < 2; cycle += 1) {
    const ack = acknowledge(state);
    const crossed = cross(state, ack, TWO);
    assert.equal(crossed.crossing.operation, "cross", `cycle ${cycle}: the beat is entered`);
    assert.equal(crossed.session.instrument, "expressions");
    assert.equal(crossed.session.selection.focus_refs.at(-1), TWO, `cycle ${cycle}: the scene ref ends the focus`);
    assert.equal(identityOf(crossed.session), startIdentity, `cycle ${cycle}: crossing changes no identity field`);

    // The source/verso leg is the frame's portal placement (openScenePortal), not an owner session write: nothing is sent here
    // for it, and the session the owner holds is the one the crossing returned. The return below proves the chain held through it.

    // Back through the Scene to the Journey. On the first cycle the Journey's scenes are reordered while crossed.
    if (cycle === 0) state.owner.admitJourney(state.basis, expressionReading([THREE, TWO, ONE]), state.context);
    const restored = back(state, crossed);
    assert.equal(restored.crossing.operation, "return");
    assert.equal(restored.crossing.scene_ref, TWO, `cycle ${cycle}: the beat is restored by ref`);
    assert.equal(restored.crossing.lost_ref, null);
    assert.equal(restored.session.instrument, "journey");
    assert.equal(restored.session.subject_ref, start.subject_ref);
    assert.equal(restored.session.reading_ref, start.reading_ref);
    assert.equal(restored.session.selection.selection_ref, start.selection.selection_ref);
    assert.equal(validateSession(restored.session).valid, true);
    state.owner.admitJourney(state.basis, expressionReading(), state.context);
  }

  const end = state.store.get();
  assert.equal(identityOf(end), startIdentity, "the identity fields are byte-identical at the end of the walk");
  assert.equal(end.selection.focus_refs.filter((ref) => ref === TWO).length, 1, "the scene ref is carried once, not appended twice");
  const steps = end.navigation.filter((hop) => hop.kind === "traversal").map((hop) => `${hop.step}:${hop.ref}`);
  assert.deepEqual(steps, [`scene:${TWO}`, `return:${TWO}`, `scene:${TWO}`, `return:${TWO}`], "each cycle leaves one scene hop and one return hop, by ref");
  assert.equal(validateSession(end).valid, true);
});

test("T23: a beat deleted out of band on the second cycle is an honest miss that names the lost beat and restores no neighbour", () => {
  const state = owner(TWO);
  const start = acknowledge(state).session;
  const first = cross(state, acknowledge(state), TWO);
  back(state, first);
  const second = cross(state, acknowledge(state), TWO);
  // The beat is deleted while crossed: the journey reads without it and the Scene the author stands on still exists.
  state.basis = basisAt(ONE);
  state.context = contextAt(state.basis);
  state.owner.admit(state.basis, sceneReading(ONE), state.context);
  state.owner.admitJourney(state.basis, expressionReading([ONE, THREE]), state.context);
  const missed = back(state, second);
  assert.equal(missed.crossing.scene_ref, null, "no beat is restored");
  assert.equal(missed.crossing.lost_ref, TWO, "the lost beat is named by its ref");
  assert.equal(missed.session.instrument, "journey");
  assert.equal(missed.session.subject_ref, start.subject_ref);
  assert.equal(missed.session.reading_ref, start.reading_ref);
  assert.equal(missed.session.selection.selection_ref, start.selection.selection_ref);
});
