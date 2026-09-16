import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FixtureTechneAdapter,
  adapterForSource,
  capabilitiesFromReading,
  createTechneSource,
  registerTechneSource,
  resetTechneSources,
  subscribeTechneSources,
  resolveActionRoute,
  techneSource,
} from '../src/techne/adapter.ts';
import { loadFixtureReadings } from '../src/techne/fixtures/load-fixtures.mjs';

const readings = await loadFixtureReadings();
const adapter = new FixtureTechneAdapter(readings);
const developmentDay = readings.find((reading) => reading.subject.subject_ref.startsWith('central:now:'));
const SUBJECT = developmentDay.subject.subject_ref;

test('the fixture adapter serves the three fixtures by subject and refuses strangers', async () => {
  for (const reading of readings) {
    assert.equal((await adapter.reading(reading.subject.subject_ref)).reading_ref, reading.reading_ref);
    assert.deepEqual(await adapter.capabilities(reading.subject.subject_ref), reading.disclosure);
  }
  await assert.rejects(() => adapter.reading('no:such:subject'), /No Technē reading is served/);
});

test('capabilities default to the reading’s own disclosure, never a hard-coded route', async () => {
  assert.deepEqual(capabilitiesFromReading(developmentDay), developmentDay.disclosure);
  const unavailable = developmentDay.disclosure.instruments.filter((entry) => !entry.available);
  assert.ok(unavailable.length >= 4);
  assert.ok(unavailable.every((entry) => entry.reason), 'every unavailable instrument carries its reason');
});

test('routeAction returns the owner receipt — routed, with authority and expected effects — and never executes', async () => {
  const route = { action_ref: 'central.day.read', subject_ref: SUBJECT };
  let reads = 0;
  const countingSource = createTechneSource({
    ref: 'techne-source:counting',
    title: 'Counting',
    read: async (subject) => { reads += 1; return adapter.reading(subject); },
  });
  const countingAdapter = adapterForSource(countingSource);
  const reading = await countingAdapter.reading(SUBJECT);
  assert.equal(reads, 1);
  const receipt = await countingAdapter.routeAction(route, reading);
  assert.equal(reads, 1, 'routing re-reads nothing and runs no operation of its own');
  assert.deepEqual(receipt, {
    action_ref: 'central.day.read',
    native_owner: 'central/ctrl',
    routed: true,
    authority: 'registered-read-action',
    expected_effects: ['none — read only'],
  });
  assert.equal(await adapter.routeAction(route, developmentDay).then((r) => r.routed), true);
});

test('an action the reading does not disclose comes back unrouted, with the reason', async () => {
  const receipt = resolveActionRoute(developmentDay, { action_ref: 'oi.expression.open', subject_ref: SUBJECT });
  assert.equal(receipt.routed, false);
  assert.match(receipt.reason, /not disclosed by reading/);
  assert.equal(receipt.native_owner, 'unknown');
});

test('a route naming another subject is refused: one subject, one route', async () => {
  const receipt = resolveActionRoute(developmentDay, { action_ref: 'central.day.read', subject_ref: 'another:subject' });
  assert.equal(receipt.routed, false);
  assert.match(receipt.reason, /one subject/);
});

test('a malformed route is refused outright', () => {
  assert.throws(() => resolveActionRoute(developmentDay, { subject_ref: SUBJECT }), /malformed/);
});

test('the source registry mirrors the K9 discipline: register, get, subscribe, duplicate refusal', () => {
  resetTechneSources();
  const first = createTechneSource({ ref: 'techne-source:one', title: 'One', read: async () => developmentDay });
  const second = createTechneSource({ ref: 'techne-source:two', title: 'Two', read: async () => developmentDay });
  const stopFirst = registerTechneSource(first);
  const stopSecond = registerTechneSource(second);
  assert.equal(techneSource('techne-source:two'), second);
  assert.equal(techneSource(), first, 'the first registered source is the default field');
  assert.throws(() => registerTechneSource(createTechneSource({ ref: 'techne-source:one', title: 'One again', read: async () => developmentDay })), /already registered/);
  let announced = 0;
  const stopObserving = subscribeTechneSources(() => { announced += 1; });
  stopFirst();
  assert.equal(techneSource('techne-source:one'), undefined);
  assert.equal(announced, 1, 'unregistering announces the registry change');
  stopSecond();
  assert.equal(techneSource(), undefined);
  stopObserving();
  resetTechneSources();
});
