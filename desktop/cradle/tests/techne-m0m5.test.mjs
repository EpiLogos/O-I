// Shared Technè reading, session and native Scene contract tests.
// Retired cradle UI registry assertions are recorded in the retirement manifest.
import test from "node:test";
import assert from "node:assert/strict";

import {bridgeReading, groundSelection, ensureSession, resetSessionAlignment} from "../src/techne/m0m5/reading.ts";
import {validateReading, validateSession, crossCutSession} from "../src/techne/contract.ts";
import {createDisclosureSessionStore, coReferenced} from "../src/techne/session.ts";
import {beats} from "../src/techne/m0m5/journey/beats.ts";
import {composeSceneProposal, EXPRESSION_EDIT_ACTION} from "../src/techne/m0m5/journey/compose.ts";
import {crossToExpression, returnPosition} from "../src/techne/m0m5/journey/crossing.ts";
import {resolveActionRoute} from "../src/techne/m0m5/adapter.ts";

// ---- the one fixture reading (full contract shape, as a provider serves it)

const READING = {
  contract: "ql.techne/v1",
  reading_ref: "ql.techne:reading:probe",
  snapshot: {revision: "rev-1", basis_ref: null},
  subject: {subject_ref: "wiki:node:alpha", native_owner: "aikit", kind: "wiki-node"},
  whole: {
    whole_ref: "wiki:constellation:alpha",
    member_refs: ["wiki:node:alpha", "wiki:node:beta"],
    relations: [{relation: "supports", from_ref: "wiki:node:alpha", to_ref: "wiki:node:beta"}],
    focus_refs: [],
  },
  temporal: [{facet_ref: "t:1", kind: "occurrence", instant: "2026-09-19T10:00:00Z", precision: "day"}],
  spatial: [{place_ref: "place:here", precision: "region", identity: {names: [{name: "Here"}]}}],
  provenance: [{source_ref: "central:source:probe", native_owner: "central"}],
  expressions: [
    {expression_ref: "oi.expression:probe", revision: "7", scene_ref: "oi.expression:probe:scene:one"},
    {expression_ref: "oi.expression:probe", scene_ref: "oi.expression:probe:scene:two"},
  ],
  actions: [{action_ref: "oi.probe.action", native_owner: "aikit", authority: "owner"}],
  disclosure: {
    instruments: [
      {instrument: "project", available: true, m_prime: 0, reading: "4:2-deep"},
      {instrument: "canvas", available: true, m_prime: 1, reading: "4:2-deep"},
      {instrument: "timeline", available: true, m_prime: 2, reading: "4:2-deep"},
      {instrument: "journey", available: true, m_prime: 3, reading: "4:2-deep"},
      {instrument: "place", available: true, m_prime: 4, reading: "4:2-deep"},
      {instrument: "palace", available: false, reason: "the reading names no unclaimed composition", m_prime: 5, reading: "4:2-deep"},
      {instrument: "expressions", available: true, reading: "3:3-conjugate"},
    ],
    application_cuts: [{cut: "4:2-deep", available: true}],
    degraded: [],
    suggestions: [],
  },
};

assert.equal(validateReading(READING).valid, true, "the fixture reading must satisfy the contract");

const READ = {standing: "read", reading: {
  contract: "ql.techne/v1",
  readingRef: READING.reading_ref,
  revision: READING.snapshot.revision,
  subject: {subjectRef: READING.subject.subject_ref, nativeOwner: READING.subject.native_owner, kind: READING.subject.kind},
  disclosure: {
    instruments: READING.disclosure.instruments.map((entry) => ({
      instrument: entry.instrument, available: entry.available, reason: entry.reason, mPrime: entry.m_prime, reading: entry.reading,
    })),
    degraded: [], suggestions: [],
  },
}};

// ---- (2) the one-reading bridge --------------------------------------------

test("the bridge prefers a full contract reading and otherwise composes the disclosure subset, inventing nothing", () => {
  // Raw wire payload IS a full reading: used whole — facets flow.
  const full = bridgeReading({standing: "read", reading: READ.reading, raw: READING});
  assert.equal(full, READING, "the contract-checked wire payload is used verbatim");
  assert.equal(full.whole.whole_ref, "wiki:constellation:alpha");
  // No raw payload: the subset-only reading composes, contract-checked, with
  // every absent facet absent — never an invented whole/time/place.
  const composed = bridgeReading(READ);
  assert.equal(validateReading(composed).valid, true);
  assert.equal(composed.reading_ref, READING.reading_ref);
  assert.equal(composed.subject.subject_ref, "wiki:node:alpha");
  assert.equal(composed.snapshot.revision, "rev-1");
  assert.equal(composed.whole, undefined);
  assert.equal(composed.temporal, undefined);
  assert.equal(composed.expressions, undefined);
  assert.equal(composed.disclosure.instruments.length, 7);
  assert.equal(composed.disclosure.instruments.find((entry) => entry.instrument === "palace").reason, "the reading names no unclaimed composition");
  // No reading stands: null — the caller renders the honest state.
  assert.equal(bridgeReading({standing: "no-subject"}), null);
  assert.equal(bridgeReading({standing: "reading"}), null);
  assert.equal(bridgeReading({standing: "unavailable", reason: "x"}), null);
  // A drifted raw payload is refused at the seam, never guessed into shape.
  const drifted = bridgeReading({standing: "read", reading: READ.reading, raw: {...READING, extra_field: true}});
  assert.equal(drifted.whole, undefined, "the refused raw falls back to the subset composition");
});

// ---- (3) the ONE session ----------------------------------------------------

test("the ground selection follows the stable whole-scope ref grammar, contract-checked", () => {
  const selection = groundSelection(READING, "journey");
  assert.equal(selection.selection_ref, "ql.techne:selection:wiki:node:alpha:wiki:constellation:alpha");
  assert.equal(selection.subject_ref, "wiki:node:alpha");
  assert.equal(selection.reading_ref, READING.reading_ref);
  assert.equal(selection.instrument, "journey");
  assert.equal(selection.snapshot_revision, "rev-1");
  assert.deepEqual(selection.focus_refs, ["wiki:constellation:alpha"]);
});

test("ensureSession opens once, projects across lenses with one hop, and never overwrites a body's refined selection", () => {
  resetSessionAlignment();
  const store = createDisclosureSessionStore();
  // First mount: the session opens on the ground selection.
  const first = ensureSession(READING, "project", store);
  assert.equal(store.get(), first);
  assert.equal(first.instrument, "project");
  // A body refines the selection (the canvas click model's shape).
  const refined = {...first.selection, selection_ref: "ql.techne:selection:wiki:node:alpha:wiki:node:beta", focus_refs: ["wiki:node:beta"], instrument: "canvas"};
  store.setSelection(refined);
  const afterClick = store.get();
  assert.equal(afterClick.selection.focus_refs[0], "wiki:node:beta");
  // Re-ensure on the SAME basis and instrument: a no-op — the refinement stands.
  resetSessionAlignment();
  assert.equal(ensureSession(READING, "canvas", store), store.get());
  assert.equal(store.get().selection.focus_refs[0], "wiki:node:beta", "the body's refined selection is never overwritten");
  // Lens switch to a co-referenced lens: one navigation hop, selection carried.
  resetSessionAlignment();
  const before = store.get();
  const projected = ensureSession(READING, "timeline", store);
  assert.equal(store.get(), projected);
  assert.equal(projected.instrument, "timeline");
  assert.equal(projected.session_ref, before.session_ref, "same session — subject and basis carried");
  assert.deepEqual(projected.selection.focus_refs, ["wiki:node:beta"], "the refined focus rides the hop");
  assert.equal(projected.navigation.length, before.navigation.length + 1);
  assert.deepEqual(projected.navigation.at(-1), {from_instrument: "canvas", to_instrument: "timeline", selection_ref: projected.selection.selection_ref});
  // New basis: a new session (the person's refresh), not a mutated one.
  resetSessionAlignment();
  const other = {...READING, reading_ref: "ql.techne:reading:probe-2", snapshot: {revision: "rev-2", basis_ref: null}};
  const second = ensureSession(other, "project", store);
  assert.notEqual(second.session_ref, before.session_ref);
  assert.equal(coReferenced(before, second), false);
  assert.equal(validateSession(projected).valid, true);
});

test("crossCut (the dual-reading crossing) is refused onto the occupied cut and preserves identity otherwise", () => {
  resetSessionAlignment();
  const store = createDisclosureSessionStore();
  const session = store.setSelection(groundSelection(READING, "journey"));
  assert.throws(() => crossCutSession(session, "place"), (cause) => String(cause).includes("already"));
  const crossed = crossCutSession(session, "expressions");
  assert.equal(crossed.cut, "3:3-conjugate");
  assert.equal(crossed.session.subject_ref, session.subject_ref);
  assert.equal(crossed.session.reading_ref, session.reading_ref);
  assert.deepEqual(crossed.session.selection.focus_refs, session.selection.focus_refs);
});

// ---- (4) the M3′ Journey real-ref law ----------------------------------------

test("journey beats are the reading's own Expression scene refs, verbatim", () => {
  const model = beats(READING);
  assert.deepEqual(model.beats.map((beat) => beat.scene_ref), [
    "oi.expression:probe:scene:one",
    "oi.expression:probe:scene:two",
  ]);
  assert.deepEqual(model.beats.map((beat) => beat.expression_ref), ["oi.expression:probe", "oi.expression:probe"]);
  assert.equal(model.beats[0].revision, "7");
  // The frame composes from the reading's own facets only.
  assert.equal(model.beats[0].frame.subject_ref, "wiki:node:alpha");
  assert.deepEqual(model.beats[0].frame.places.map((place) => place.place_ref), ["place:here"]);
  // A reading with no bound scenes yields zero beats and the honest reason.
  const unbound = {...READING, expressions: [{expression_ref: "oi.expression:probe"}]};
  const none = beats(unbound);
  assert.equal(none.beats.length, 0);
  assert.match(none.unavailableReason, /disclose no scene refs/);
});

test("journey composition proposes a substrate-grammar scene_create route and refuses collisions", () => {
  resetSessionAlignment();
  const store = createDisclosureSessionStore();
  const session = store.setSelection(groundSelection(READING, "journey"));
  const proposal = composeSceneProposal({reading: READING, selection: session.selection, title: "First Look"});
  assert.equal(proposal.route.action_ref, EXPRESSION_EDIT_ACTION);
  assert.equal(proposal.input.change.change, "scene_create");
  assert.equal(proposal.input.change.scene_ref, "oi.expression:probe:scene:first-look", "the substrate's own `${expressionRef}:scene:<slug>` grammar");
  assert.equal(proposal.input.expression_ref, "oi.expression:probe");
  assert.deepEqual(proposal.input.frame.focus_refs, ["wiki:constellation:alpha"], "the exact selected refs ride verbatim");
  assert.deepEqual(proposal.input.frame.place_refs, ["place:here"]);
  assert.deepEqual(proposal.input.frame.temporal_facet_refs, ["t:1"]);
  // The disclosed action wins when the reading discloses one.
  const withEdit = {...READING, actions: [{action_ref: "oi.expression.edit", native_owner: "oi", authority: "owner"}]};
  const routed = composeSceneProposal({reading: withEdit, selection: session.selection, title: "Second Look"});
  assert.equal(routed.route.action_ref, "oi.expression.edit");
  const receipt = resolveActionRoute(withEdit, routed.route);
  assert.equal(receipt.routed, true);
  // An undisclosed action routes honestly false with its reason — never fake-executed.
  const unrouted = resolveActionRoute(READING, proposal.route);
  assert.equal(unrouted.routed, false);
  assert.match(unrouted.reason, /not disclosed/);
  // A proposed ref colliding with a disclosed scene is refused.
  assert.throws(() => composeSceneProposal({reading: READING, selection: session.selection, title: "one"}), (cause) => String(cause).includes("already disclosed"));
});

test("the 3:3 crossing carries the scene ref in the selection's focus and Return restores by exact ref", () => {
  resetSessionAlignment();
  const store = createDisclosureSessionStore();
  const session = store.setSelection(groundSelection(READING, "journey"));
  const model = beats(READING);
  const crossing = crossToExpression(session, "oi.expression:probe:scene:two");
  assert.deepEqual(crossing.selection.focus_refs, ["wiki:constellation:alpha", "oi.expression:probe:scene:two"]);
  assert.equal(crossing.target, "expressions");
  // Identity fields the lock protects are untouched.
  assert.equal(crossing.selection.subject_ref, session.selection.subject_ref);
  assert.equal(crossing.selection.reading_ref, session.selection.reading_ref);
  assert.equal(crossing.selection.selection_ref, session.selection.selection_ref);
  // Applied through the store: the cut follows the instrument, the hop is recorded.
  store.setSelection(crossing.selection);
  const crossedSession = store.openInInstrument(crossing.target);
  assert.equal(crossedSession.application_cut, "3:3-conjugate");
  // Return: exact ref equality, never an index guess.
  const back = returnPosition(crossedSession, model.beats);
  assert.equal(back.focus_ref, "oi.expression:probe:scene:two");
  assert.equal(back.beat.scene_ref, "oi.expression:probe:scene:two");
});
