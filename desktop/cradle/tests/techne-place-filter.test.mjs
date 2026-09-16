import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from '../src/techne/fixtures/load-fixtures.mjs';
import {
  coversWindow,
  expandTimestamp,
  hierarchyInWindow,
  nameInWindow,
  placesInWindow,
  validInWindow,
} from '../src/techne/place/filter.ts';

const laterArrival = {
  place_ref: 'place:test:later-arrival',
  identity: { names: [{ name: 'A Square That Came Later', valid_from: '1750', valid_to: null }] },
  geometry: { type: 'point', coordinates: [2.3522, 48.8566] },
  precision: 'exact',
  valid_from: '1750',
  valid_to: null,
};

test('a place whose valid_from stands after the window is excluded, and re-included on widen', () => {
  const narrow = { from: '1500', to: '1700' };
  assert.equal(coversWindow(laterArrival, narrow), false, '1750 begins after 1700 — not standing in the window');
  assert.equal(placesInWindow([laterArrival], narrow).length, 0);
  const widened = { from: '1500', to: '1800' };
  assert.equal(coversWindow(laterArrival, widened), true, 'widened to 1800, the place stands');
  assert.equal(placesInWindow([laterArrival], widened).length, 1);
});

test('filtering never changes identity: the same facet objects come back, untouched', async () => {
  const reading = await loadFixture('representative-subject-v1.json');
  const facets = reading.spatial;
  const snapshot = JSON.parse(JSON.stringify(facets));
  const visible = placesInWindow(facets, { from: '1675', to: '1700' });
  assert.equal(visible.length, 1);
  assert.equal(visible[0], facets[0], 'the filter returns the caller’s own reference');
  assert.deepEqual(facets, snapshot, 'the underlying facet is byte-for-byte unchanged');
  const emptied = placesInWindow(facets, { from: '1000', to: '1100' });
  assert.equal(emptied.length, 0);
  assert.deepEqual(facets, snapshot, 'an emptied view still touches nothing');
});

test('Greenwich stands in windows from 1675 onward and not before', async () => {
  const reading = await loadFixture('representative-subject-v1.json');
  const observatory = reading.spatial[0];
  assert.equal(coversWindow(observatory, { from: '1675', to: '1700' }), true);
  assert.equal(coversWindow(observatory, { from: '1680', to: '2026' }), true, 'valid_to null reaches the present');
  assert.equal(coversWindow(observatory, { from: '1500', to: '1674' }), false);
  assert.equal(placesInWindow([observatory], null).length, 1, 'no window admits everything');
  assert.equal(placesInWindow([observatory], { from: null, to: null }).length, 1);
});

test('coarse bounds read at their span: year valid_from starts the year, year valid_to ends it', () => {
  // "1675" as a from-bound begins 1675-01-01 — June 1675 stands inside it.
  assert.equal(validInWindow('1675', null, { from: '1675-06-01', to: null }), true);
  // "1699" as a to-bound ends 1699-12-31 — June 1699 stands inside it.
  assert.equal(validInWindow(null, '1699', { from: '1699-06-01', to: null }), true);
  assert.equal(validInWindow(null, '1698', { from: '1699-06-01', to: null }), false);
  assert.equal(expandTimestamp('1675', 'start'), '1675-01-01T00:00:00.000Z');
  assert.equal(expandTimestamp('1675', 'end'), '1675-12-31T23:59:59.999Z');
  assert.equal(expandTimestamp('1675-06', 'end'), '1675-06-30T23:59:59.999Z');
  assert.equal(expandTimestamp('1675-06-15T12:00:00Z', 'start'), '1675-06-15T12:00:00Z', 'full timestamps pass through');
});

test('identity names resolve per their own validity, independent of coordinates', () => {
  const renamed = {
    place_ref: 'place:test:renamed',
    identity: {
      names: [
        { name: 'Old Landing', valid_from: '1700', valid_to: '1850' },
        { name: 'New Landing', valid_from: '1850', valid_to: null },
      ],
    },
    precision: 'unlocated',
  };
  assert.equal(nameInWindow(renamed, { from: '1720', to: '1740' })?.name, 'Old Landing');
  assert.equal(nameInWindow(renamed, { from: '1900', to: '1950' })?.name, 'New Landing');
  // A window before any name stood: the identity outlives any one label —
  // the latest name resolves rather than an invented placeholder.
  assert.equal(nameInWindow(renamed, { from: '1600', to: '1650' })?.name, 'New Landing');
  assert.equal(nameInWindow({ place_ref: 'place:test:anonymous', precision: 'unlocated' }, null), null);
});

test('hierarchy entries filter by their own validity', async () => {
  const reading = await loadFixture('representative-subject-v1.json');
  const observatory = reading.spatial[0];
  assert.equal(hierarchyInWindow(observatory, { from: '1675', to: '1700' }).length, 2);
  assert.equal(hierarchyInWindow(observatory, { from: '1500', to: '1600' }).length, 0);
});

test('unparseable validity bounds never throw; they fall back to plain text order', () => {
  assert.doesNotThrow(() => validInWindow('at the founding', null, { from: '1500', to: '1700' }));
  // "at the founding" sorts after "1700" as text, so the from-bound reads as
  // standing after the window — a conservative reading, never an invented date.
  assert.equal(validInWindow('at the founding', null, { from: '1500', to: '1700' }), false);
});
