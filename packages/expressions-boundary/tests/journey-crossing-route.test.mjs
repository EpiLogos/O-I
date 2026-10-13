// lane-5 T10/T11 through the owner's one compare-and-set route (techne-time-window).
//   cross   refresh (the author's explicit ground), then cross: the session carries the entered Scene's ref, one history.
//   return  restores the exact beat by ref equality; a deleted beat is an honest miss that names the lost beat.
//   refuse  a drifted session, a non-beat Scene and a wrong instrument are refused by name and change nothing.
import test from "node:test";
import assert from "node:assert/strict";
import {createDisclosureSessionStore} from "../../../desktop/cradle/src/techne/session.ts";
import {provingReading} from "../../../desktop/cradle/src/techne/m0m5/journey/proving-reading.ts";
import {createNativeTimeWindowOwner} from "../src/timeWindow.ts";

const EXPRESSION = "expression:journey-probe";
const ONE = `${EXPRESSION}:scene:one`;
const TWO = `${EXPRESSION}:scene:two`;
const THREE = `${EXPRESSION}:scene:three`;
const binding = (scene_ref) => ({expression_ref: EXPRESSION, revision: "7", scene_ref});

function expressionReading(scenes = [ONE, TWO, THREE]) {
  const reading = structuredClone(provingReading());
  reading.expressions = scenes.map(binding);
  return reading;
}
const sceneReading = (scene) => ({...expressionReading(), expressions: [binding(scene)]});
const basisAt = (scene_ref) => ({expression_ref: EXPRESSION, revision: 7, scene_ref});
const contextAt = (basis) => ({mode: "techne", bindingId: "journey-crossing-route", epoch: 1,
  signal: new AbortController().signal, state: {hostMode: "techne", nativeScene: structuredClone(basis)}, current: () => true});

function owner(scene = TWO, scenes = [ONE, TWO, THREE]) {
  const store = createDisclosureSessionStore();
  const handle = createNativeTimeWindowOwner({store});
  const basis = basisAt(scene), context = contextAt(basis);
  handle.admit(basis, sceneReading(scene), context);
  handle.admitJourney(basis, expressionReading(scenes), context);
  return {store, owner: handle, basis, context};
}

const readingRef = () => provingReading().reading_ref;

function acknowledge(state) {
  const basis = state.basis;
  return state.owner.handle({...basis, reading_ref: readingRef(), instrument: "journey", operation: "refresh"}, state.context);
}

function cross(state, ack, target) {
  return state.owner.handle({...state.basis, reading_ref: readingRef(), instrument: "journey", operation: "cross",
    expected_session_ref: ack.session.session_ref, expected_selection: structuredClone(ack.session.selection),
    expected_window: structuredClone(ack.axis.window), target_scene_ref: target}, state.context);
}

function back(state, crossed) {
  return state.owner.handle({...state.basis, reading_ref: readingRef(), instrument: "expressions", operation: "return",
    expected_session_ref: crossed.session.session_ref, expected_selection: structuredClone(crossed.session.selection),
    expected_window: structuredClone(crossed.axis.window)}, state.context);
}

test("T10: entering a beat's Scene through the route ends the focus with its ref and changes no identity field", () => {
  const state = owner(TWO);
  const ack = acknowledge(state);
  const crossed = cross(state, ack, TWO);
  assert.equal(crossed.crossing.operation, "cross");
  assert.equal(crossed.crossing.scene_ref, TWO);
  assert.equal(crossed.session.instrument, "expressions");
  assert.equal(crossed.session.application_cut, "3:3-conjugate");
  assert.equal(crossed.session.selection.focus_refs.at(-1), TWO);
  assert.equal(crossed.session.subject_ref, ack.session.subject_ref);
  assert.equal(crossed.session.reading_ref, ack.session.reading_ref);
  assert.equal(crossed.session.selection.selection_ref, ack.session.selection.selection_ref);
  assert.equal(crossed.session.selection.agent_session_ref ?? null, ack.session.selection.agent_session_ref ?? null);
  const hops = state.store.get().navigation.slice(-2);
  assert.deepEqual(hops.map((hop) => hop.step ?? "instrument"), ["scene", "instrument"], "the scene hop and the cut crossing share one history");
  assert.equal(hops[0].ref, TWO);
});

test("T11: Return restores the exact beat by ref, after the scenes were reordered while crossed", () => {
  const state = owner(TWO);
  const crossed = cross(state, acknowledge(state), TWO);
  // The journey presents the same Scene with its beats reordered: the owner finds the beat by ref, never by index.
  state.owner.admitJourney(state.basis, expressionReading([THREE, TWO, ONE]), state.context);
  const restored = back(state, crossed);
  assert.equal(restored.crossing.operation, "return");
  assert.equal(restored.crossing.scene_ref, TWO);
  assert.equal(restored.crossing.lost_ref, null);
  assert.equal(restored.session.instrument, "journey");
  assert.equal(restored.session.application_cut, "4:2-deep");
  assert.equal(state.store.get().navigation.at(-1).step, "return");
  assert.equal(state.store.get().navigation.at(-1).ref, TWO);
});

test("T11: a beat deleted out of band is an honest miss that names the lost beat and restores no neighbour", () => {
  const state = owner(TWO);
  const crossed = cross(state, acknowledge(state), TWO);
  // The deleted beat cannot stay presented: the author now stands on a Scene that still exists, and the journey reads without the lost one.
  state.basis = basisAt(ONE);
  state.context = contextAt(state.basis);
  state.owner.admit(state.basis, sceneReading(ONE), state.context);
  state.owner.admitJourney(state.basis, expressionReading([ONE, THREE]), state.context);
  const missed = back(state, crossed);
  assert.equal(missed.crossing.scene_ref, null, "no beat is restored");
  assert.equal(missed.crossing.lost_ref, TWO, "the lost beat is named by its ref");
  assert.equal(missed.session.instrument, "journey", "the session still lands on the journey, honestly");
});

test("a Scene that is not a beat of this journey is refused by name and changes nothing", () => {
  const state = owner(TWO);
  const ack = acknowledge(state);
  const before = JSON.stringify(state.store.get());
  assert.throws(() => cross(state, ack, `${EXPRESSION}:scene:elsewhere`), /not a beat of this journey/);
  assert.equal(JSON.stringify(state.store.get()), before, "a refused crossing records nothing");
});

test("a crossing onto the occupied 3:3 cut is refused with the floor's own reason and changes nothing", () => {
  const state = owner(TWO);
  const crossed = cross(state, acknowledge(state), TWO);
  const before = JSON.stringify(state.store.get());
  assert.throws(() => cross(state, crossed, TWO), /already carries the 3:3-conjugate cut/);
  assert.equal(JSON.stringify(state.store.get()), before, "a refused crossing records nothing");
});

test("a drifted session refuses the crossing by name", () => {
  const state = owner(TWO);
  const ack = acknowledge(state);
  state.store.setTimeWindow({from: "2020-01-01T00:00:00+00:00", to: null});
  assert.throws(() => cross(state, ack, TWO), /changed; read it before crossing/);
});

test("the crossing is refused when the wrong instrument is addressed", () => {
  const state = owner(TWO);
  const ack = acknowledge(state);
  assert.throws(() => state.owner.handle({...state.basis, reading_ref: readingRef(), instrument: "timeline", operation: "cross",
    expected_session_ref: ack.session.session_ref, expected_selection: structuredClone(ack.session.selection),
    expected_window: null, target_scene_ref: TWO}, state.context), /Journey/);
});
