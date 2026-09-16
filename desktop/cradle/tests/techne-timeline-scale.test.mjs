import test from 'node:test';
import assert from 'node:assert/strict';
import {
  domainFromFacets,
  expandInstant,
  facetRange,
  instantOffsetMs,
  parseTimestamp,
  project,
  ticksForDomain,
} from '../src/techne/timeline/scale.ts';

test('a millennium-precision facet expands to its widest honest band, never an exact instant', () => {
  const millennium = {
    kind: 'valid',
    instant: '1000-06-15T00:00:00Z',
    precision: 'millennium',
  };
  const span = facetRange(millennium);
  assert.equal(span.positioned, true);
  const width = span.toMs - span.fromMs;
  assert.equal(span.fromMs, Date.parse('1000-01-01T00:00:00Z'), 'the band opens at the millennium boundary');
  assert.equal(span.toMs, Date.parse('2000-01-01T00:00:00Z'), 'the band closes one millennium later');
  assert.ok(width > 3e12, `the band is ${width} ms wide — never collapsed to an instant`);
  const domain = domainFromFacets([millennium]);
  assert.equal(domain.toMs - domain.fromMs, width, 'the honest domain inherits the honest band');
  const minuteWidth = 60_000;
  assert.ok(width / minuteWidth > 1e6, 'orders of magnitude apart from a positioned minute');
});

test('precision expands land on the instant\'s own civil frame', () => {
  const day = expandInstant('2026-09-15T00:00:00+01:00', 'day');
  assert.deepEqual([day.fromMs, day.toMs], [
    Date.parse('2026-09-15T00:00:00+01:00'),
    Date.parse('2026-09-16T00:00:00+01:00'),
  ], 'a day-precision instant spans the civil day in its own +01:00 frame, not UTC');
  const minuteRange = expandInstant('2026-09-15T14:59:00+01:00', 'minute');
  assert.deepEqual([minuteRange.fromMs, minuteRange.toMs], [
    Date.parse('2026-09-15T14:59:00+01:00'),
    Date.parse('2026-09-15T15:00:00+01:00'),
  ]);
  const declared = expandInstant('1066-10-14T09:00:00Z', 'year');
  assert.deepEqual([declared.fromMs, declared.toMs], [
    Date.parse('1066-01-01T00:00:00Z'),
    Date.parse('1067-01-01T00:00:00Z'),
  ]);
});

test('precisionless instants stay points; ref-only facets stay unpositioned', () => {
  const point = facetRange({ kind: 'occurrence', instant: '2026-09-15T14:59:00+01:00' });
  assert.equal(point.positioned, true);
  assert.equal(point.fromMs, point.toMs, 'no precision claim — no widened range is fabricated');
  const unpositioned = facetRange({ kind: 'now', now_ref: 'central:now:control:root:x' });
  assert.equal(unpositioned.positioned, false);
  assert.equal(unpositioned.fromMs, null);
  assert.equal(unpositioned.toMs, null);
});

test('interval bounds widen outward by their own precision', () => {
  const exact = facetRange({ kind: 'run', run_ref: 'factory:run:x', interval: { from: '2026-09-15T09:10:00+01:00', to: '2026-09-15T16:40:00+01:00' } });
  assert.deepEqual([exact.fromMs, exact.toMs], [
    Date.parse('2026-09-15T09:10:00+01:00'),
    Date.parse('2026-09-15T16:40:00+01:00'),
  ]);
  const widened = facetRange({
    kind: 'run',
    run_ref: 'factory:run:x',
    interval: { from: '2026-09-15T09:10:00+01:00', to: '2026-09-15T12:00:00+01:00', from_precision: 'hour', to_precision: 'day' },
  });
  assert.equal(widened.fromMs, Date.parse('2026-09-15T09:00:00+01:00'), 'from widens leftward to the hour');
  assert.equal(widened.toMs, Date.parse('2026-09-16T00:00:00+01:00'), 'to widens rightward through the civil day');
  const halfOpen = facetRange({ kind: 'run', run_ref: 'factory:run:x', interval: { from: null, to: '2026-09-15T16:40:00+01:00' } });
  assert.equal(halfOpen.positioned, true, 'one honest bound still positions the span');
  assert.equal(halfOpen.fromMs, null);
});

test('ticks are honest wall-clock marks inside the domain, generated per zoom level', () => {
  const offset = instantOffsetMs('2026-09-15T00:00:00+01:00');
  assert.equal(offset, 3_600_000);
  const domain = { fromMs: Date.parse('2026-09-15T00:00:00+01:00'), toMs: Date.parse('2026-09-16T00:00:00+01:00') };
  const dayTicks = ticksForDomain(domain, { offsetMs: offset, targetTicks: 6 });
  assert.ok(dayTicks.length >= 2 && dayTicks.length <= 12, `reasonable density (${dayTicks.length} ticks)`);
  const hours = dayTicks.map((tick) => tick.label);
  assert.equal(hours[0], '00:00', 'the first tick is local midnight, not UTC midnight');
  assert.ok(hours.every((label) => /^([01][0-9]|2[0-3]):00$/.test(label)), `hour-frame labels: ${hours.join(' ')}`);
  for (const tick of dayTicks) {
    assert.ok(tick.ms >= domain.fromMs && tick.ms <= domain.toMs, 'ticks stay inside the domain');
  }
  assert.ok(dayTicks.every((tick, index) => index === 0 || tick.ms > dayTicks[index - 1].ms), 'ascending');

  // Zoom in: a tighter window re-generates ticks for its own scale.
  const zoomed = { fromMs: Date.parse('2026-09-15T14:00:00+01:00'), toMs: Date.parse('2026-09-15T15:10:00+01:00') };
  const minuteTicks = ticksForDomain(zoomed, { offsetMs: offset, targetTicks: 6 });
  assert.ok(minuteTicks.length >= 2);
  assert.ok(minuteTicks.every((tick) => tick.unit === 'minute'), `minute zoom yields minute ticks (${minuteTicks.map((t) => t.label).join(' ')})`);
  assert.equal(minuteTicks[0].label, '14:00');

  // Zoom out: the millennium band gets calendar ticks, not subsecond noise.
  const millennium = { fromMs: Date.parse('1000-01-01T00:00:00Z'), toMs: Date.parse('2000-01-01T00:00:00Z') };
  const eraTicks = ticksForDomain(millennium, { targetTicks: 6 });
  assert.ok(eraTicks.length >= 2 && eraTicks.length <= 12);
  assert.ok(eraTicks.every((tick) => /^\d{3,4}$/.test(tick.label)), `year labels: ${eraTicks.map((t) => t.label).join(' ')}`);
});

test('ticks and projection are pure and deterministic', () => {
  const domain = { fromMs: Date.parse('2026-09-15T00:00:00+01:00'), toMs: Date.parse('2026-09-16T00:00:00+01:00') };
  const frozen = JSON.stringify(domain);
  const first = ticksForDomain(domain, { targetTicks: 6 });
  const second = ticksForDomain(domain, { targetTicks: 6 });
  assert.deepEqual(first, second, 'identical inputs, identical ticks');
  assert.equal(JSON.stringify(domain), frozen, 'the domain is never mutated');
  const view = domain;
  assert.equal(project(domain.toMs, view, 800), 800, 'the domain end projects to the full width');
  assert.equal(project(domain.fromMs, view, 800), 0);
  assert.equal(project(domain.fromMs + (domain.toMs - domain.fromMs) / 2, view, 800), 400, 'linear');
});

test('parseTimestamp treats offsetless timestamps as UTC, deterministically', () => {
  assert.equal(parseTimestamp('2026-09-15T00:00:00'), parseTimestamp('2026-09-15T00:00:00Z'));
  assert.equal(parseTimestamp('2026-09-15'), Date.parse('2026-09-15T00:00:00Z'));
  assert.equal(parseTimestamp('2026-09-15T00:00:00+01:00'), Date.parse('2026-09-15T00:00:00+01:00'));
  assert.throws(() => parseTimestamp('not-a-time'), /not a timestamp/);
});
