// Lane-2 T5 — relative time for undated work, with no fake dates.
// Undated continuity facets (day / now / session / run) that the reading orders by
// its own declared sequence project from a zero the person disclosed on the
// session. Marks are steps (T0, T+n, T-n); no calendar year, date or duration is
// ever named. Relative mode is absent unless the reading warrants the zero, and
// the calendar projection is byte-identical across a round trip. Scripted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeAxisFromFacets, relativeZeroCandidates, yearStartMs} from '../src/techne/m0m5/timeline/scale.ts';
import {timeAxisProjection, relativeTimeAxisProjection, TECHNE_RELATIVE_TIME_AXIS_SCHEMA} from '../src/techne/m0m5/timeline/timeAxis.ts';
import {createDisclosureSessionStore} from '../src/techne/session.ts';
import {groundSelection} from '../src/techne/m0m5/reading.ts';
import {provingReading} from '../src/techne/m0m5/journey/proving-reading.ts';
import {validateSession, validateReading} from '../src/techne/contract.ts';

const DAY = 'ql.techne:facet:tb0:day';
const NOW = 'ql.techne:facet:tb0:now';
const SESSION = 'ql.techne:facet:tb0:session';
const VALID = 'ql.techne:facet:tb0:valid';
const RUN = 'ql.techne:facet:tb0:run';

function storeFor(reading) {
  const store = createDisclosureSessionStore();
  store.setSelection(groundSelection(reading, 'timeline'));
  return store;
}

test('the reading discloses three undated continuity facets; the dated validity and run facets are never zeros', () => {
  const reading = provingReading();
  assert.deepEqual(relativeZeroCandidates(reading.temporal), [DAY, NOW, SESSION]);
  assert.ok(!relativeZeroCandidates(reading.temporal).includes(VALID), 'a dated validity facet is not a zero');
  assert.ok(!relativeZeroCandidates(reading.temporal).includes(RUN), 'a dated run facet is not a zero');
});

test('an undated zero orders the others by the declared sequence as steps: T0, T+1, T+2', () => {
  const axis = relativeAxisFromFacets(provingReading().temporal, DAY);
  assert.equal(axis.zero_ref, DAY);
  assert.deepEqual(axis.marks.map(mark => mark.facet_ref), [DAY, NOW, SESSION]);
  assert.deepEqual(axis.marks.map(mark => mark.offset), [0, 1, 2]);
  assert.deepEqual(axis.marks.map(mark => mark.label), ['T0', 'T+1', 'T+2']);
});

test('a zero later in the sequence puts earlier material before it: T-2, T-1, T0', () => {
  const axis = relativeAxisFromFacets(provingReading().temporal, SESSION);
  assert.deepEqual(axis.marks.map(mark => mark.label), ['T-2', 'T-1', 'T0']);
  assert.deepEqual(axis.marks.map(mark => mark.facet_ref), [DAY, NOW, SESSION]);
});

test('no calendar year, date or duration appears anywhere in the relative projection', () => {
  const reading = provingReading();
  const store = storeFor(reading);
  const session = store.setTimeZero(DAY);
  const relative = relativeTimeAxisProjection(reading, session);
  assert.ok(relative, 'the warranted zero yields a relative axis');
  const text = JSON.stringify(relative);
  assert.doesNotMatch(text, /\b\d{4}\b/, 'no four-digit year');
  assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/, 'no ISO calendar date');
  const labels = relative.marks.map(mark => mark.label).join(' ');
  assert.doesNotMatch(labels, /[A-Za-z]{2,}/, 'no unit name or era in the labels: only T0, T+n and T-n');
  for (const mark of relative.marks) assert.match(mark.label, /^T(0|\+\d+|-\d+)$/);
});

test('the relative projection is deterministic and carries the subject identity verbatim', () => {
  const reading = provingReading();
  const session = storeFor(reading).setTimeZero(NOW);
  const first = JSON.stringify(relativeTimeAxisProjection(reading, session));
  assert.equal(first, JSON.stringify(relativeTimeAxisProjection(structuredClone(reading), structuredClone(session))));
  const relative = relativeTimeAxisProjection(reading, session);
  assert.equal(relative.schema, TECHNE_RELATIVE_TIME_AXIS_SCHEMA);
  assert.equal(relative.subject_ref, reading.subject.subject_ref);
  assert.equal(relative.reading_ref, reading.reading_ref);
  assert.equal(relative.zero_ref, NOW);
});

test('relative mode is absent, not fabricated, when the session declares no zero', () => {
  const reading = provingReading();
  assert.equal(relativeTimeAxisProjection(reading, storeFor(reading).get()), null);
  assert.equal(relativeTimeAxisProjection(reading, null), null);
});

test('relative mode is absent when the declared zero is not warranted by this reading', () => {
  const reading = provingReading();
  const store = storeFor(reading);
  assert.equal(relativeTimeAxisProjection(reading, store.setTimeZero(VALID)), null, 'a dated facet cannot be a zero');
  assert.equal(relativeTimeAxisProjection(reading, store.setTimeZero('ql.techne:facet:tb0:absent')), null, 'an unknown ref cannot be a zero');
});

test('a lone undated facet is not an axis: a zero needs at least one other undated facet to place', () => {
  const lone = [{facet_ref: 'f:day', kind: 'day', day_ref: 'central:day:x'}, {facet_ref: 'f:valid', kind: 'valid', interval: {from: '2026-09-16T00:00:00+01:00', to: null, from_precision: 'day'}}];
  assert.equal(relativeAxisFromFacets(lone, 'f:day'), null);
  const pair = [...lone, {facet_ref: 'f:session', kind: 'session', session_ref: 'zcode-session'}];
  assert.deepEqual(relativeAxisFromFacets(pair, 'f:day').marks.map(mark => mark.label), ['T0', 'T+1']);
});

test('only continuity kinds may be a zero, even when undated', () => {
  const occurrence = [{facet_ref: 'f:a', kind: 'occurrence', day_ref: 'central:day:x'}, {facet_ref: 'f:b', kind: 'day', day_ref: 'central:day:y'}];
  assert.equal(relativeAxisFromFacets(occurrence, 'f:a'), null, 'an undated occurrence is not a continuity zero');
  assert.equal(relativeAxisFromFacets(occurrence, 'f:b').marks.length, 2);
});

test('undated facets without a ref are placed under the reading\'s derived id, never a fabricated ref', () => {
  const facets = [{kind: 'day', day_ref: 'central:day:a', facet_ref: 'f:zero'}, {kind: 'session', session_ref: 'zcode-session'}];
  const axis = relativeAxisFromFacets(facets, 'f:zero');
  assert.deepEqual(axis.marks.map(mark => mark.ref), ['f:zero', 'derived:techne:timeline:temporal[1]']);
  assert.equal(axis.marks[1].facet_ref, null);
});

test('the session declares and clears its zero through the store, and the contract checks the ref', () => {
  const reading = provingReading();
  const store = storeFor(reading);
  const before = JSON.stringify(store.get());
  const declared = store.setTimeZero(DAY);
  assert.equal(declared.time_zero_ref, DAY);
  assert.equal(validateSession(declared).valid, true, validateSession(declared).errors.join('; '));
  const cleared = store.setTimeZero(null);
  assert.equal('time_zero_ref' in cleared, false);
  assert.equal(JSON.stringify(cleared), before, 'clearing the zero restores the session byte-exact');
  assert.throws(() => store.setTimeZero(''), /time_zero_ref/);
});

test('switching to relative and back restores the calendar axis byte-identically', () => {
  const reading = provingReading();
  const store = storeFor(reading);
  const calendarBefore = JSON.stringify(timeAxisProjection(reading, store.get()));
  store.setTimeZero(DAY);
  assert.ok(relativeTimeAxisProjection(reading, store.get()), 'relative mode is on');
  store.setTimeZero(null);
  const calendarAfter = JSON.stringify(timeAxisProjection(reading, store.get()));
  assert.equal(calendarAfter, calendarBefore);
  assert.deepEqual(JSON.parse(calendarAfter), JSON.parse(calendarBefore));
});

test('declaring a relative zero leaves the calendar projection untouched', () => {
  const reading = provingReading();
  const store = storeFor(reading);
  const calendar = JSON.stringify(timeAxisProjection(reading, store.get()));
  const withZero = store.setTimeZero(SESSION);
  assert.equal(JSON.stringify(timeAxisProjection(reading, withZero)), calendar);
});

test('the reading stays valid and the calendar scale is unchanged by the relative additions', () => {
  assert.equal(validateReading(provingReading()).valid, true);
  assert.equal(yearStartMs(1970), 0, 'the authority\'s epoch is unchanged');
});
