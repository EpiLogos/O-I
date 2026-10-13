// lane-5 T13: honest absence. Every journey surface reports a missing facet from the reading's own
// disclosure. A facet the reading does not value is said to be undated or undisclosed, never filled with
// its own kind, and no card borrows or invents a facet. Run after `npm run build:journeys`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyBeatView, SCENE_READING_PENDING} from '../build/journeyBeats.js';

const EXPRESSION = 'oi.expression:probe';
const ONE = `${EXPRESSION}:scene:one`;
const DOC = {
  schema: 'oi.expression/v1',
  expression_ref: EXPRESSION,
  revision: 7,
  scenes: [{scene_ref: ONE, title: 'One'}],
};

function reading(overrides = {}) {
  return {
    contract: 'ql.techne/v1',
    reading_ref: 'ql.techne:reading:probe',
    snapshot: {revision: 'rev-1', basis_ref: null},
    subject: {subject_ref: EXPRESSION, native_owner: 'oi.cradle.kernel', kind: 'expression-scene'},
    whole: {whole_ref: EXPRESSION, member_refs: [EXPRESSION], relations: [], focus_refs: []},
    temporal: [],
    spatial: [],
    provenance: [],
    expressions: [{expression_ref: EXPRESSION, revision: '7', scene_ref: ONE}],
    actions: [],
    disclosure: {
      instruments: [{instrument: 'journey', available: true, m_prime: 3, reading: '4:2-deep'}],
      application_cuts: [{cut: '4:2-deep', available: true}],
      degraded: [],
      suggestions: [],
    },
    ...overrides,
  };
}

test('T13: a scene-less reading shows the disclosure reason and invents no beat', () => {
  const reason = 'the journey instrument has no scene beats for this subject';
  const view = journeyBeatView(reading({
    expressions: [{expression_ref: EXPRESSION, revision: '7'}],
    disclosure: {instruments: [{instrument: 'journey', available: false, reason}], application_cuts: [], degraded: [], suggestions: []},
  }), DOC);
  assert.deepEqual(view.cards, []);
  assert.equal(view.unavailableReason, reason);
});

test('T13: an unbound subject shows the derived reason and invents no beat', () => {
  const view = journeyBeatView(reading({expressions: []}), DOC);
  assert.deepEqual(view.cards, []);
  assert.equal(view.unavailableReason, 'no Expression is bound to this subject');
});

/** The Scene's own reading, as the instrument supplies it once that Scene's read settles. */
function ownFrame(overrides = {}) {
  return new Map([[ONE, reading(overrides)]]);
}

test('T13: a card whose Scene reading has not settled is pending and shows no chips from the whole', () => {
  const [card] = journeyBeatView(reading({temporal: [{facet_ref: 't:9', kind: 'occurrence', instant: '2026-01-01T00:00:00Z', precision: 'day'}]}), DOC).cards;
  assert.deepEqual(card.chips, []);
  assert.equal(card.chipsReason, SCENE_READING_PENDING);
});

test('T13: a temporal facet with no value is said to be undated, never labelled with its own kind', () => {
  const [card] = journeyBeatView(reading(), DOC, ownFrame({temporal: [{facet_ref: 't:2', kind: 'occurrence', precision: 'day'}]})).cards;
  assert.deepEqual(card.chips, [{kind: 'time', ref: 't:2', label: 'occurrence · undated'}]);
});

test('T13: an open-ended interval names its undisclosed end, never a dangling arrow', () => {
  const [card] = journeyBeatView(reading(), DOC, ownFrame({
    temporal: [{facet_ref: 't:3', kind: 'occurrence', interval: {from: '2026-01-01', to: null}, precision: 'day'}],
  })).cards;
  assert.deepEqual(card.chips, [{kind: 'time', ref: 't:3', label: 'occurrence · 2026-01-01 → undisclosed'}]);
});

test('T13: a reading with no facets carries no chips, never fabricated metadata', () => {
  const [card] = journeyBeatView(reading(), DOC, ownFrame()).cards;
  assert.deepEqual(card.chips, []);
  assert.equal(card.chipsReason, undefined);
});
