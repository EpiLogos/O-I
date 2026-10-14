// lane-5 T9: the presence owner's pace draft. The draft is the one local composition state the journey presence entry carries, and
// it is only ever read and written through this module. Its basis (the reading and the Expression revision) is part of the draft, so
// a draft is never applied against a basis it was not taken on. A malformed draft is refused on write and dropped on read.
import test from "node:test";
import assert from "node:assert/strict";

import {
  JOURNEY_PRESENCE_KEY,
  JOURNEY_PRESENCE_SCHEMA,
  isPresenceDraft,
  loadPresence,
  presenceFor,
  savePresence,
} from "../src/techne/m0m5/journey/presence.ts";

const SUBJECT = "oi.expression:probe";
const ONE = `${SUBJECT}:scene:one`;
const TWO = `${SUBJECT}:scene:two`;

function store(seed) {
  const map = new Map(seed === undefined ? [] : [[JOURNEY_PRESENCE_KEY, seed]]);
  return {map, getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value))};
}

function draft(overrides = {}) {
  return {
    basis_reading_ref: "ql.techne:reading:probe",
    basis_revision: "7",
    scene_order: [ONE, TWO],
    pace: [{scene_ref: TWO, dwell_seconds: 6.5}],
    ...overrides,
  };
}

function entry(overrides = {}) {
  return {
    schema: JOURNEY_PRESENCE_SCHEMA,
    subject_ref: SUBJECT,
    reading_ref: "ql.techne:reading:probe",
    snapshot_revision: "rev-1",
    expression_ref: SUBJECT,
    scene_ref: ONE,
    ...overrides,
  };
}

test("T9: a well-formed pace draft carries its basis, its beat order and paces that name only those beats", () => {
  assert.equal(isPresenceDraft(draft()), true);
  assert.equal(isPresenceDraft(draft({pace: []})), true, "an empty pace is a valid draft of the beat order");
});

test("T9: a draft without its basis, with a duplicate order, or with a pace for a beat it does not hold is refused", () => {
  const {basis_reading_ref, ...noReading} = draft();
  assert.equal(isPresenceDraft(noReading), false, "no basis reading");
  const {basis_revision, ...noRevision} = draft();
  assert.equal(isPresenceDraft(noRevision), false, "no basis revision");
  assert.equal(isPresenceDraft(draft({scene_order: [ONE, ONE]})), false, "a repeated beat");
  assert.equal(isPresenceDraft(draft({pace: [{scene_ref: "ghost", dwell_seconds: 4}]})), false, "a pace for a beat outside the order");
  assert.equal(isPresenceDraft(draft({pace: [{scene_ref: TWO, dwell_seconds: 0}]})), false, "a non-positive pace");
  assert.equal(isPresenceDraft(draft({pace: [{scene_ref: TWO, dwell_seconds: Number.NaN}]})), false, "a non-finite pace");
});

test("T9: a stored entry carries its draft and reads it back unchanged", () => {
  const storage = store();
  const kept = savePresence(storage, {[SUBJECT]: presenceFor({
    subject_ref: SUBJECT, reading_ref: "ql.techne:reading:probe", snapshot_revision: "rev-1", expression_ref: SUBJECT, scene_ref: ONE, draft: draft(),
  })});
  assert.equal(kept, true);
  assert.deepEqual(loadPresence(storage)[SUBJECT].draft, draft());
});

test("T9: an entry whose draft is malformed is dropped whole on read, never repaired into a guess", () => {
  const storage = store(JSON.stringify({[SUBJECT]: entry({draft: draft({basis_revision: ""})})}));
  assert.deepEqual(loadPresence(storage), {}, "a draft with an empty basis drops its entry");
});

test("T9: savePresence reports whether the browser kept the write, and a refusing store reports false", () => {
  assert.equal(savePresence(null, {}), false, "no storage at all");
  const refusing = {getItem: () => null, setItem() { throw new Error("QuotaExceededError"); }};
  assert.equal(savePresence(refusing, {}), false);
});

test("T9: presenceFor omits an empty draft, so a position with no pace carries no draft key", () => {
  const plain = presenceFor({subject_ref: SUBJECT, reading_ref: "r", snapshot_revision: null, expression_ref: SUBJECT, scene_ref: ONE, draft: null});
  assert.equal("draft" in plain, false);
});
