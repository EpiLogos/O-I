/**
 * Lane-4 T23/T24 — the shared spatial-focus write, pure layer.
 *
 *   boundary  declaredSpatialRef accepts exactly a bounded place ref or null.
 *   CAS       spatialCaptureMatches holds only when the captured session ref,
 *             spatial focus, window and actual selection (instrument included)
 *             are all still the session's own; any drift refuses.
 *   owner     the DisclosureSession setter the owner calls writes and clears
 *             the focus without touching the window or the selection.
 * The owner's handle() path needs an admitted native reading, so it is covered
 * by the native acceptance (time-window-native-acceptance.mjs), not here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDisclosureSessionStore} from '../../../desktop/cradle/src/techne/session.ts';
import {validateSession} from '../../../desktop/cradle/src/techne/contract.ts';
import {timelineOpenPlan} from '../../../desktop/cradle/src/techne/m0m5/place/navigation.ts';
import {declaredSpatialRef, spatialCaptureMatches} from '../src/timeWindow.ts';

const SUBJECT = 'wiki:subject:expedition';
const READING = 'reading:expedition:4-2';
const SOURCE = 'wiki:source:field-notes';

function openSession(instrument = 'place') {
  const store = createDisclosureSessionStore();
  store.setSelection({
    selection_ref: `ql.techne:selection:${SUBJECT}:${SUBJECT}`,
    subject_ref: SUBJECT,
    reading_ref: READING,
    instrument,
    source_ref: SOURCE,
    selection_standing: 'current',
    agent_session_ref: null,
  });
  return store;
}

function captureOf(store, overrides = {}) {
  const session = store.get();
  return {
    session_ref: session.session_ref,
    selection: structuredClone(session.selection),
    spatial_focus_ref: session.spatial_focus_ref ?? null,
    window: session.time_window ? structuredClone(session.time_window) : null,
    ...overrides,
  };
}

test('boundary: a spatial operand is a bounded place ref or an explicit null', () => {
  assert.equal(declaredSpatialRef(null), null, 'null clears the focus');
  assert.equal(declaredSpatialRef('place:harbour'), 'place:harbour');
  assert.equal(declaredSpatialRef('p'.repeat(4096)).length, 4096);
  for (const refused of [undefined, '', 0, false, {}, ['place:harbour'], 'p'.repeat(4097)]) {
    assert.throws(() => declaredSpatialRef(refused), /explicit place ref or null/, `refuses ${JSON.stringify(refused)?.slice(0, 20)}`);
  }
});

test('boundary: the facet place ref from Open in Timeline is a valid spatial operand', () => {
  const plan = timelineOpenPlan({place_ref: 'place:harbour', precision: 'exact', identity: {names: [{name: 'Harbour'}]}, source_ref: SOURCE});
  assert.equal(declaredSpatialRef(plan.spatial_focus_ref), 'place:harbour');
});

test('owner setter: the spatial focus is written and cleared; window and selection are untouched', () => {
  const store = openSession();
  store.setTimeWindow({from: '1850', to: '1852'});
  const before = structuredClone(store.get());
  const focused = store.setSpatialFocus('place:harbour');
  assert.equal(focused.spatial_focus_ref, 'place:harbour');
  assert.deepEqual(focused.time_window, before.time_window);
  assert.deepEqual(focused.selection, before.selection);
  assert.equal(focused.session_ref, before.session_ref);
  assert.equal(validateSession(focused).valid, true);
  const cleared = store.setSpatialFocus(null);
  assert.equal('spatial_focus_ref' in cleared, false, 'null removes the key, as the session carries it');
  assert.deepEqual(cleared.time_window, before.time_window);
});

test('CAS: an unchanged captured session, focus, window and selection matches', () => {
  const store = openSession();
  store.setSpatialFocus('place:harbour');
  assert.equal(spatialCaptureMatches(store.get(), captureOf(store)), true);
});

test('CAS refuses a stale captured session ref', () => {
  const store = openSession();
  store.setSpatialFocus('place:harbour');
  assert.equal(spatialCaptureMatches(store.get(), captureOf(store, {session_ref: `${store.get().session_ref}:stale`})), false);
});

test('CAS refuses a stale expected spatial focus, and a null expectation against a set focus', () => {
  const store = openSession();
  store.setSpatialFocus('place:harbour');
  assert.equal(spatialCaptureMatches(store.get(), captureOf(store, {spatial_focus_ref: null})), false, 'null is a distinct operand from a set focus');
  assert.equal(spatialCaptureMatches(store.get(), captureOf(store, {spatial_focus_ref: 'place:summit'})), false);
});

test('CAS: a captured absent window does not match an explicit open window, and the reverse', () => {
  const store = openSession();
  store.setSpatialFocus('place:harbour');
  assert.equal(spatialCaptureMatches(store.get(), captureOf(store, {window: {from: null, to: null}})), false);
  store.setTimeWindow({from: '1850', to: null});
  assert.equal(spatialCaptureMatches(store.get(), captureOf(store, {window: null})), false);
  assert.equal(spatialCaptureMatches(store.get(), captureOf(store)), true);
});

test('CAS refuses an actual selection or instrument advance', () => {
  const store = openSession('place');
  store.setSpatialFocus('place:harbour');
  const captured = captureOf(store);
  store.openInInstrument('timeline');
  assert.equal(spatialCaptureMatches(store.get(), captured), false, 'an instrument advance invalidates the captured selection');
  // The owner compares the captured selection with the instrument the hop names, never the stale one.
  assert.equal(spatialCaptureMatches(store.get(), {...captured, selection: {...captured.selection, instrument: 'timeline'}}), true);
});
