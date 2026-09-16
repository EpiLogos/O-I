import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregate,
  buildLanes,
  lanesFromReading,
  selectionFocusedOnItem,
  timelineIsEmpty,
} from '../src/techne/timeline/lanes.ts';
import { domainFromFacets } from '../src/techne/timeline/scale.ts';
import { createDisclosureSessionStore } from '../src/techne/session.ts';
import { validateSession } from '../src/techne/contract.ts';
import { loadFixtureReadings } from '../src/techne/fixtures/load-fixtures.mjs';

const readings = await loadFixtureReadings();
const developmentDay = readings.find((reading) => reading.subject.subject_ref.startsWith('central:now:'));
const absentFacets = readings.find((reading) => reading.subject.subject_ref.startsWith('central:source:'));

const DAY_REF = 'central:day:control:root:2026-09-15';
const NOW_REF = 'central:now:control:root:b417a7c3d37cd47c2762deee3224687d59db1a9015a322e9a8d7584b3947adf6';
const SESSION_REF = 'zcode-session-2026-09-16-l5-techne-execution';
const RUN_REF = 'factory:run:01JBD3Z4X7Q9M2A6K4P8T3W5NQ';

const minute = (time) => Date.parse(`2026-09-15T${time}:00+01:00`);

test('the development-day reading groups into exactly the four continuity lanes, in owner order', () => {
  const lanes = lanesFromReading(developmentDay);
  assert.deepEqual(lanes.map((lane) => lane.owner), ['day', 'now', 'session', 'run']);
  assert.deepEqual(lanes.map((lane) => lane.label), ['DAY', 'NOW', 'Session', 'Run']);
  const byOwner = new Map(lanes.map((lane) => [lane.owner, lane]));
  assert.equal(byOwner.get('day').ref, DAY_REF, 'the DAY lane carries the day_ref verbatim');
  assert.equal(byOwner.get('now').ref, NOW_REF, 'the NOW lane carries the now_ref verbatim');
  assert.equal(byOwner.get('session').ref, SESSION_REF, 'the session lane carries the session_ref verbatim');
  assert.equal(byOwner.get('run').ref, RUN_REF, 'the run lane carries the run_ref verbatim');
  assert.deepEqual(lanes.map((lane) => lane.items.length), [1, 1, 2, 1]);
});

test('occurrence and receipt stay distinct rows with distinct instants, uncertainties verbatim', () => {
  const sessionLane = lanesFromReading(developmentDay).find((lane) => lane.owner === 'session');
  assert.equal(sessionLane.items.length, 2, 'occurrence and receipt are never merged');
  const occurrence = sessionLane.items.find((item) => item.kind === 'occurrence');
  const receipt = sessionLane.items.find((item) => item.kind === 'receipt');
  assert.notEqual(occurrence.id, receipt.id, 'occurrence and receipt are distinct entries');
  assert.equal(occurrence.instant, '2026-09-15T14:59:00+01:00');
  assert.equal(receipt.instant, '2026-09-15T15:04:00+01:00');
  assert.equal(occurrence.fromMs, minute('14:59'));
  assert.equal(receipt.fromMs, minute('15:04'));
  assert.notEqual(occurrence.fromMs, receipt.fromMs, 'the pair sits at distinct instants (14:59 vs 15:04)');
  assert.equal(
    occurrence.uncertainty,
    'author-declared recorded_at on the ProjectCentral handoff',
    'the author-declared uncertainty note survives verbatim',
  );
  assert.equal(
    receipt.uncertainty,
    'reconciler-declared observed_at on the source-change horizon',
    'the reconciler-declared uncertainty note survives verbatim',
  );
  assert.equal(occurrence.session_ref, SESSION_REF);
  assert.equal(receipt.session_ref, SESSION_REF);
});

test('day bands, run windows and the unpositioned NOW facet carry honest extents', () => {
  const lanes = lanesFromReading(developmentDay);
  const dayItem = lanes.find((lane) => lane.owner === 'day').items[0];
  assert.deepEqual(
    [dayItem.fromMs, dayItem.toMs],
    [Date.parse('2026-09-15T00:00:00+01:00'), Date.parse('2026-09-16T00:00:00+01:00')],
    'a day-precision facet spans its whole civil day, not a point',
  );
  assert.equal(dayItem.day_ref, DAY_REF);
  assert.equal(dayItem.timezone_policy_ref, 'central:source:control:root:Control/user/civil-time-policy.json');

  const runItem = lanes.find((lane) => lane.owner === 'run').items[0];
  assert.deepEqual([runItem.fromMs, runItem.toMs], [minute('09:10'), minute('16:40')]);
  assert.equal(
    runItem.uncertainty,
    'Factory orders by revision, not wall-clock; bounds are the handoff-declared activity window',
    'the run window keeps its handoff-declared uncertainty verbatim',
  );

  const nowItem = lanes.find((lane) => lane.owner === 'now').items[0];
  assert.equal(nowItem.positioned, false, 'the NOW clearing carries no wall-clock claim of its own');
  assert.equal(nowItem.now_ref, NOW_REF);
  assert.equal(nowItem.fromMs, null);
  assert.equal(nowItem.toMs, null);
});

test('the honest domain covers the widest honest bounds of the mixed-precision day', () => {
  const domain = domainFromFacets(developmentDay.temporal);
  assert.deepEqual(
    [domain.fromMs, domain.toMs],
    [Date.parse('2026-09-15T00:00:00+01:00'), Date.parse('2026-09-16T00:00:00+01:00')],
    'the day band is the widest honest extent; instants and the run window sit inside',
  );
});

test('bare facets without continuity refs land in Events lanes per kind', () => {
  const lanes = lanesFromReading(absentFacets);
  assert.deepEqual(lanes.map((lane) => lane.owner), ['events'], 'no continuity lane is fabricated from a bare receipt');
  assert.equal(lanes[0].label, 'Events · receipt');
  assert.equal(lanes[0].ref, null);
  assert.equal(lanes[0].items.length, 1);
  assert.equal(lanes[0].items[0].kind, 'receipt');
  assert.equal(lanes[0].items[0].fromMs, Date.parse('2026-09-16T11:20:00+01:00'));
});

test('a reading without temporal facets yields the honest empty state — no fabricated events', () => {
  const withoutTemporal = { ...structuredClone(developmentDay), temporal: undefined };
  delete withoutTemporal.temporal;
  assert.deepEqual(buildLanes(withoutTemporal.temporal), []);
  assert.deepEqual(buildLanes([]), []);
  assert.deepEqual(lanesFromReading(withoutTemporal), []);
  assert.equal(timelineIsEmpty(buildLanes(withoutTemporal.temporal)), true);
  assert.equal(domainFromFacets(withoutTemporal.temporal), null, 'no domain is invented when nothing is positioned');
  assert.equal(timelineIsEmpty(lanesFromReading(absentFacets)), false, 'a disclosed receipt is content, not emptiness');
});

test('aggregation is a pure view projection: lanes and the reading stay deep-equal unchanged', () => {
  const readingSnapshot = JSON.stringify(developmentDay);
  const lanes = lanesFromReading(developmentDay);
  const lanesSnapshot = JSON.stringify(lanes);
  const domain = domainFromFacets(developmentDay.temporal);
  const window = { fromMs: domain.fromMs + 3600_000, toMs: domain.toMs - 3600_000 };

  const aggregations = aggregate(lanes, window, 24);
  assert.equal(JSON.stringify(lanes), lanesSnapshot, 'aggregate mutates nothing');
  assert.equal(JSON.stringify(developmentDay), readingSnapshot, 'the reading is never touched by view projection');

  const sessionAggregation = aggregations.find((lane) => lane.owner === 'session');
  const total = sessionAggregation.buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  assert.equal(total, 2, 'both session-lane items fall inside the window');
  for (const bucket of sessionAggregation.buckets) {
    assert.ok(bucket.fromMs >= window.fromMs && bucket.toMs <= window.toMs, 'buckets stay inside the window');
  }
  const occurrenceId = sessionAggregation.buckets.flatMap((bucket) => bucket.item_ids)[0];
  assert.ok(occurrenceId, 'compressed buckets keep the item ids they stand for');
});

test('selecting an item narrows focus and keeps co-reference byte-identical', () => {
  const store = createDisclosureSessionStore();
  const session = store.setSelection({
    selection_ref: 'ql.techne:selection:t3',
    subject_ref: NOW_REF,
    reading_ref: developmentDay.reading_ref,
    source_ref: 'central:source:control:root:Control/user/day/2026-09-15/day.md',
    instrument: 'timeline',
  });
  const occurrence = lanesFromReading(developmentDay)
    .flatMap((lane) => lane.items)
    .find((item) => item.kind === 'occurrence');

  const focused = selectionFocusedOnItem(session.selection, occurrence);
  assert.equal(validateSession({ ...session, selection: focused, instrument: 'timeline' }).valid, true);
  assert.equal(focused.subject_ref, session.selection.subject_ref, 'subject_ref is byte-identical');
  assert.equal(focused.reading_ref, session.selection.reading_ref, 'reading_ref is byte-identical');
  assert.equal(focused.source_ref, session.selection.source_ref);
  assert.deepEqual(focused.focus_refs, [occurrence.id]);
  assert.equal(focused.instrument, 'timeline');

  const stored = store.setSelection(focused);
  assert.equal(stored.session_ref, session.session_ref, 'the same basis keeps the one session');
  assert.equal(stored.subject_ref, session.subject_ref);
  assert.equal(stored.reading_ref, session.reading_ref);
  assert.deepEqual(stored.selection.focus_refs, [occurrence.id]);
});
