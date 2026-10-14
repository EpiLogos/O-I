// Lane-2 T17 — the session's time window is maintained and consumed (contract and state side).
// The window is set only by an explicit disclosure act on the one session store; it is validated by validateSession,
// consumed by relationFieldState and projectionAvailability, carried byte-exact across crossings, inherited by a
// co-referenced instrument, and cleared to an honest null. Real store, real contract, real projections: no stubs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSession} from '../src/techne/contract.ts';
import {createDisclosureSessionStore, coReferenced, windowLabel} from '../src/techne/session.ts';
import {groundSelection} from '../src/techne/m0m5/reading.ts';
import {provingReading} from '../src/techne/m0m5/journey/proving-reading.ts';
import {timeAxis, timeAxisProjection} from '../src/techne/m0m5/timeline/timeAxis.ts';
import {relationFieldState} from '../src/techne/m0m5/timeline/state.ts';
import {projectionAvailability} from '../src/techne/m0m5/timeline/relations.ts';

// The proving reading's first facet (authored, 2026-09-16) lies outside this window; the window is the session's own.
const WINDOW = {from: '1850-01-01T00:00:00Z', to: '1900-01-01T00:00:00Z'};
const AUTHORED = 'ql.techne:facet:tb0:authored';

function openSession() {
  const reading = provingReading();
  const store = createDisclosureSessionStore();
  store.setSelection(groundSelection(reading, 'timeline'));
  return {reading, store};
}

test('windowLabel names the window the control will assert; null names nothing (honest absence)', () => {
  assert.equal(windowLabel(null), null);
  assert.equal(windowLabel(undefined), null);
  assert.equal(windowLabel({from: null, to: null}), 'open – open');
  assert.equal(windowLabel(WINDOW), '1850-01-01T00:00:00Z – 1900-01-01T00:00:00Z');
  assert.equal(windowLabel({from: '1851', to: null}), '1851 – open');
});

test('until the person sets one there is no window: the session has no time_window and every consumer reads null', () => {
  const {reading, store} = openSession();
  const session = store.get();
  assert.equal('time_window' in session, false, 'absent, never a derived default');
  assert.equal(timeAxisProjection(reading, session).window, null);
  assert.equal(relationFieldState(reading, 'relations', null, timeAxisProjection(reading, session).window).time_window, null);
});

test('the explicit act writes the session field; validateSession passes with time_window present', () => {
  const {reading, store} = openSession();
  const session = store.setTimeWindow(WINDOW);
  assert.deepEqual(session.time_window, WINDOW);
  const checked = validateSession(session);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  assert.equal(store.get(), session, 'the one store holds the window; no second copy');
  assert.equal(validateSession(store.get()).valid, true);
  assert.equal(reading.reading_ref, session.reading_ref, 'the window is over the same reading');
});

test('relation-field availability recomputes over the window: an out-of-window event is reported out-of-scope, not hidden', () => {
  const {reading, store} = openSession();
  const unwindowed = projectionAvailability(reading, timeAxis(reading, null));
  const session = store.setTimeWindow(WINDOW);
  const axis = timeAxisProjection(reading, session);
  assert.deepEqual(axis.window, WINDOW);
  const authored = axis.events.find(event => event.facet_ref === AUTHORED);
  assert.ok(authored, 'the event is still present in the projection');
  assert.equal(authored.scope.state, 'out-of-scope');
  const state = relationFieldState(reading, 'relations', null, axis.window);
  assert.deepEqual(state.time_window, WINDOW);
  const timeline = projectionAvailability(reading, axis).find(row => row.mode === 'timeline');
  const before = unwindowed.find(row => row.mode === 'timeline');
  assert.ok(timeline.window_scope.out_of_scope >= 1, 'availability counts the out-of-window event');
  assert.notDeepEqual(timeline.window_scope, before.window_scope, 'availability changed over the window');
});

test('leaving and re-entering the instrument keeps the window; a co-referenced instrument inherits it byte-exact', () => {
  const {store} = openSession();
  const set = store.setTimeWindow(WINDOW);
  const away = store.openInInstrument('place');
  assert.deepEqual(away.time_window, WINDOW, 'leaving the Timeline records the window on the session');
  assert.equal(coReferenced(set, away), true);
  const back = store.openInInstrument('timeline');
  assert.equal(JSON.stringify(back.time_window), JSON.stringify(set.time_window), 're-entering keeps it byte-exact');
});

test('a cut crossing carries the window byte-exact and stays contract-valid', () => {
  const {store} = openSession();
  const before = store.setTimeWindow(WINDOW);
  const {session, cut} = store.crossCut('expressions');
  assert.notEqual(cut, undefined);
  assert.equal(JSON.stringify(session.time_window), JSON.stringify(before.time_window));
  assert.equal(validateSession(session).valid, true);
});

test('clearing the act returns the honest null: the field is removed and every consumer reads no window', () => {
  const {reading, store} = openSession();
  store.setTimeWindow(WINDOW);
  const cleared = store.setTimeWindow(null);
  assert.equal('time_window' in cleared, false);
  assert.equal(validateSession(cleared).valid, true);
  assert.equal(timeAxisProjection(reading, cleared).window, null);
  assert.equal(relationFieldState(reading, 'relations', null, null).time_window, null);
});

test('a refused window changes nothing: the session keeps the window it held', () => {
  const {store} = openSession();
  const held = store.setTimeWindow(WINDOW);
  assert.throws(() => store.setTimeWindow({from: 1850, to: null}), /explicit time window|timestamp or null|from\/to/);
  assert.equal(JSON.stringify(store.get()), JSON.stringify(held));
});

test('the window is never inherited by a different subject: a new basis opens a session with no window', () => {
  const {reading, store} = openSession();
  store.setTimeWindow(WINDOW);
  const selection = {...store.get().selection, subject_ref: 'subject:t17-other', reading_ref: 'reading:t17-other'};
  const next = store.setSelection(selection);
  assert.equal('time_window' in next, false);
  assert.equal(reading.subject.subject_ref === next.subject_ref, false);
});
