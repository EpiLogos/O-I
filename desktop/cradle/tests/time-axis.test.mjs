// Lane-2 T6 — the shared time-axis contract (techne:time-axis/v1).
// One pure projection of a validated reading and the session's declared window.
// Chronology and Places read the same projection; moving the window changes the
// in-scope set identically for both. Scripted: each assertion re-reads its source.
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReading} from '../src/techne/contract.ts';
import {timeAxis, timeAxisProjection, TECHNE_TIME_AXIS_SCHEMA} from '../src/techne/m0m5/timeline/timeAxis.ts';
import {createDisclosureSessionStore} from '../src/techne/session.ts';
import {groundSelection} from '../src/techne/m0m5/reading.ts';
import {provingReading} from '../src/techne/m0m5/journey/proving-reading.ts';
import {placesInWindow} from '../src/techne/m0m5/place/filter.ts';

function sessionOn(reading, window) {
  const store = createDisclosureSessionStore();
  const session = store.setSelection(groundSelection(reading, 'timeline'));
  return window === undefined ? session : store.setTimeWindow(window);
}

test('the projection is deterministic: the same reading and session give byte-identical JSON', () => {
  const reading = provingReading();
  const session = sessionOn(reading, {from: '2026-09-15T00:00:00+01:00', to: null});
  const first = JSON.stringify(timeAxisProjection(reading, session));
  const second = JSON.stringify(timeAxisProjection(reading, session));
  const cloned = JSON.stringify(timeAxisProjection(structuredClone(reading), structuredClone(session)));
  assert.equal(first, second);
  assert.equal(first, cloned, 'a structurally equal reading and session project the same bytes');
});

test('a null session puts no window in force and equals the calendar projection with no window', () => {
  const reading = provingReading();
  assert.equal(JSON.stringify(timeAxisProjection(reading, null)), JSON.stringify(timeAxis(reading, null)));
  assert.equal(timeAxisProjection(reading, null).window, null);
});

test('the projection carries the techne:time-axis/v1 identity and exactly the TARGET-SET keys', () => {
  const reading = provingReading();
  const axis = timeAxisProjection(reading, sessionOn(reading, undefined));
  assert.equal(axis.schema, TECHNE_TIME_AXIS_SCHEMA);
  assert.equal(TECHNE_TIME_AXIS_SCHEMA, 'techne:time-axis/v1');
  assert.deepEqual(Object.keys(axis).sort(), ['bands', 'events', 'reading_ref', 'relations', 'schema', 'snapshot_revision', 'subject_ref', 'window']);
  assert.equal(axis.subject_ref, reading.subject.subject_ref);
  assert.equal(axis.reading_ref, reading.reading_ref);
  assert.equal(axis.snapshot_revision, reading.snapshot?.revision ?? null);
});

test('events carry the contract facet fields verbatim: no new truth enters the projection', () => {
  const reading = provingReading();
  const axis = timeAxisProjection(reading, sessionOn(reading, undefined));
  assert.equal(axis.events.length, reading.temporal.length);
  reading.temporal.forEach((facet, index) => {
    const event = axis.events[index];
    assert.equal(event.facet_ref, facet.facet_ref);
    assert.equal(event.kind, facet.kind);
    assert.equal(event.instant, facet.instant);
    assert.deepEqual(event.interval, facet.interval);
    assert.equal(event.precision, facet.precision);
    assert.equal(event.uncertainty, facet.uncertainty);
    assert.equal(event.source_ref, facet.source_ref);
  });
});

test('the declared window is carried byte-exact and an unauthored window stays null', () => {
  const reading = provingReading();
  const session = sessionOn(reading, {from: '2026-09-15T00:00:00+01:00', to: '2026-09-17T00:00:00+01:00'});
  assert.deepEqual(timeAxisProjection(reading, session).window, {from: '2026-09-15T00:00:00+01:00', to: '2026-09-17T00:00:00+01:00'});
  assert.equal(timeAxisProjection(reading, sessionOn(reading, undefined)).window, null);
});

test('a session that discloses another reading or snapshot is refused, never re-pointed', () => {
  const reading = provingReading();
  const session = sessionOn(reading, undefined);
  assert.throws(() => timeAxisProjection(reading, {...session, reading_ref: 'ql.techne:reading:other@1'}), /another native reading/);
  assert.throws(() => timeAxisProjection(reading, {...session, subject_ref: 'ql.techne:subject:other'}), /another native reading/);
  const revised = {...reading, snapshot: {revision: 'rev-2'}};
  assert.throws(() => timeAxisProjection(revised, session), /another native reading/);
});

test('a drifted reading is refused by the projection, not silently projected', () => {
  const reading = provingReading();
  const broken = {...reading, temporal: [{facet_ref: 'x', kind: 'not-a-kind'}]};
  assert.equal(validateReading(broken).valid, false);
  assert.throws(() => timeAxisProjection(broken, null), /drifted/);
});

// Chronology and Places consumers over one fixture. The chronology reads the
// projection's per-event scope; the Places consumer reads placesInWindow over the
// same validity spans, expressed as place facets. Both must agree at every window.
function fixture() {
  const spans = [
    {ref: 'ql.techne:facet:tb0:early', from: '1850-01-01T00:00:00+00:00', to: '1860-12-31T23:59:59+00:00'},
    {ref: 'ql.techne:facet:tb0:mid', from: '1858-06-01T00:00:00+00:00', to: '1875-06-01T00:00:00+00:00'},
    {ref: 'ql.techne:facet:tb0:late', from: '1890-01-01T00:00:00+00:00', to: '1905-01-01T00:00:00+00:00'},
    {ref: 'ql.techne:facet:tb0:open-end', from: '1900-01-01T00:00:00+00:00', to: null},
  ];
  const base = provingReading();
  const reading = {
    ...base,
    temporal: spans.map(span => ({facet_ref: span.ref, kind: 'valid', interval: {from: span.from, to: span.to}})),
    whole: {...base.whole, relations: []},
  };
  const places = spans.map(span => ({place_ref: `place:${span.ref}`, valid_from: span.from, valid_to: span.to}));
  return {reading, spans, places};
}

const WINDOWS = [
  {from: null, to: null},
  {from: '1851-01-01T00:00:00+00:00', to: '1852-01-01T00:00:00+00:00'},
  {from: '1860-12-31T23:59:59+00:00', to: '1870-01-01T00:00:00+00:00'},
  {from: '1880-01-01T00:00:00+00:00', to: '1889-12-31T00:00:00+00:00'},
  {from: '1906-01-01T00:00:00+00:00', to: null},
  {from: null, to: '1849-12-31T00:00:00+00:00'},
  {from: '1875-06-01T00:00:00+00:00', to: '1875-06-01T00:00:00+00:00'},
];

test('the fixture reading is valid and the chronology projection is fully positioned', () => {
  const {reading} = fixture();
  assert.equal(validateReading(reading).valid, true, validateReading(reading).errors.join('; '));
  const axis = timeAxisProjection(reading, null);
  assert.ok(axis.events.every(event => event.scope.state === 'unbounded'));
});

test('moving the window changes the in-scope set identically for the chronology and the places consumer', () => {
  const {reading, places} = fixture();
  let excludedSomewhere = 0;
  let narrowedSomewhere = 0;
  for (const window of WINDOWS) {
    const store = createDisclosureSessionStore();
    store.setSelection(groundSelection(reading, 'timeline'));
    const session = window.from === null && window.to === null ? store.get() : store.setTimeWindow(window);
    const axis = timeAxisProjection(reading, session);
    const chronology = axis.events
      .filter(event => event.scope.state === 'in-scope' || event.scope.state === 'unbounded')
      .map(event => event.facet_ref)
      .sort();
    const placesIn = placesInWindow(places, window)
      .map(place => place.place_ref.replace(/^place:/, ''))
      .sort();
    assert.deepEqual(chronology, placesIn, `window ${JSON.stringify(window)}`);
    const outOfScope = axis.events.filter(event => event.scope.state === 'out-of-scope').map(event => event.facet_ref).sort();
    const placesOut = places.filter(place => !placesIn.includes(place.place_ref.replace(/^place:/, '')))
      .map(place => place.place_ref.replace(/^place:/, '')).sort();
    assert.deepEqual(outOfScope, placesOut, `out-of-scope agrees for ${JSON.stringify(window)}`);
    excludedSomewhere += outOfScope.length;
    if (chronology.length < places.length) narrowedSomewhere += 1;
  }
  // Non-vacuous: the windows really do exclude events, on both consumers alike.
  assert.ok(excludedSomewhere > 0, 'at least one window excludes an event');
  assert.ok(narrowedSomewhere > 0, 'at least one window narrows the in-scope set');
});

test('the window is moved by the session, and the projection for a window differs from the open one', () => {
  const {reading} = fixture();
  const store = createDisclosureSessionStore();
  store.setSelection(groundSelection(reading, 'timeline'));
  const open = JSON.stringify(timeAxisProjection(reading, store.get()));
  const bounded = store.setTimeWindow({from: '1851-01-01T00:00:00+00:00', to: '1852-01-01T00:00:00+00:00'});
  assert.notEqual(JSON.stringify(timeAxisProjection(reading, bounded)), open);
  assert.equal(JSON.stringify(timeAxisProjection(reading, store.setTimeWindow(null))), open, 'clearing the window restores the open projection');
});
