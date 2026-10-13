// Lane-2 T4 — deep time without fabrication, the authority leg.
// A bare deep year (xsd:gYear shape: "-780000", "4500000000") positions on the
// same linear epoch-ms scale as every other instant. It takes a year-or-coarser
// precision only (age, epoch, era, eon name the coarse rungs), never a finer
// one, and ticks on the authority's own ladder. Human-scale behaviour is pinned
// by a digest of the authority's outputs taken before this change.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  calendarFields,
  expandInstant,
  facetRange,
  parseTimestamp,
  ticksForDomain,
  yearStartDays,
  yearStartMs,
} from '../src/techne/m0m5/timeline/scale.ts';

const DAY_MS = 86_400_000;
const GREGORIAN_400_YEAR_DAYS = 146_097;

/** Epoch ms of 1 January of a year, read from Date (defined only inside its range). */
function dateYearMs(year) {
  const date = new Date(0);
  date.setUTCFullYear(year, 0, 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

test('the linear scale equals Date wherever Date reaches', () => {
  for (let year = -9999; year <= 9999; year += 1) assert.equal(yearStartMs(year), dateYearMs(year), `year ${year}`);
  // Sampled out to the Date limits; 1 January -271821 lies before Date's own minimum.
  for (let year = -271820; year <= 275760; year += 97) assert.equal(yearStartMs(year), dateYearMs(year), `year ${year}`);
});

test('a deep year is the Gregorian day count, checked by the 400-year cycle', () => {
  for (const year of [-780_000, -10_000, 10_000, 4_500_000_000, -1_000_000_000]) {
    const cycles = Math.floor((year - 2000) / 400);
    const anchor = year - cycles * 400;                        // in [2000, 2400)
    assert.ok(anchor >= 2000 && anchor < 2400);
    assert.equal(yearStartDays(year), yearStartDays(anchor) + cycles * GREGORIAN_400_YEAR_DAYS, `year ${year}`);
    assert.equal(yearStartMs(year), yearStartDays(year) * DAY_MS);
  }
});

test('a bare deep year parses; a deep year with a month, day or clock does not', () => {
  assert.equal(parseTimestamp('-780000'), yearStartMs(-780_000));
  assert.equal(parseTimestamp('4500000000'), yearStartMs(4_500_000_000));
  assert.equal(parseTimestamp('+4500000000'), yearStartMs(4_500_000_000));
  for (const source of ['-780000-01-01', '+4500000000-06-01', '-780000-01-01T12:00:00Z', '-000000', '01']) {
    assert.throws(() => parseTimestamp(source), /not a timestamp/, source);
  }
  // Within the Date range a calendar date is still exact (unchanged human grammar).
  assert.equal(parseTimestamp('+275760-09-13T00:00:00Z'), 8.64e15);
  assert.equal(parseTimestamp('-271821-04-20T00:00:00Z'), -8.64e15);
});

test('a deep year takes a year-or-coarser precision and never a finer one', () => {
  for (const precision of ['month', 'day', 'hour', 'minute', 'second', 'subsecond']) {
    assert.throws(() => expandInstant('-780000', precision), /carries no .* precision/, precision);
    assert.throws(() => expandInstant('4500000000', precision), /carries no .* precision/, precision);
  }
  assert.deepEqual(expandInstant('-780000', 'year'), {fromMs: yearStartMs(-780_000), toMs: yearStartMs(-779_999)});
  assert.deepEqual(expandInstant('-780000'), {fromMs: yearStartMs(-780_000), toMs: yearStartMs(-780_000)}, 'no precision: a point');
});

test('the coarse rungs are honest boundaries of the linear scale', () => {
  const span = (instant, precision) => {
    const range = expandInstant(instant, precision);
    return [calendarFields(range.fromMs).year, calendarFields(range.toMs).year];
  };
  assert.deepEqual(span('-780000', 'age'), [-1_000_000, 0], 'age: 10^6 years');
  assert.deepEqual(span('-780000', 'epoch'), [-10_000_000, 0], 'epoch: 10^7 years');
  assert.deepEqual(span('-780000', 'era'), [-100_000_000, 0], 'era: 10^8 years');
  assert.deepEqual(span('4500000000', 'eon'), [4_000_000_000, 5_000_000_000], 'eon: 10^9 years');
  assert.deepEqual(span('4500000000', 'age'), [4_500_000_000, 4_501_000_000]);
  assert.deepEqual(span('4500000000', 'millennium'), [4_500_000_000, 4_500_001_000]);
  // The coarse extent contains the instant it was stated for.
  for (const [instant, precision] of [['-780000', 'age'], ['-780000', 'eon'], ['4500000000', 'era']]) {
    const range = expandInstant(instant, precision);
    const at = parseTimestamp(instant);
    assert.ok(range.fromMs <= at && at < range.toMs, `${instant} inside its ${precision}`);
  }
});

test('a deep interval keeps each end at its own precision', () => {
  const facet = {kind: 'valid', interval: {from: '-780000', from_precision: 'age', to: '4500000000', to_precision: 'eon'}};
  assert.deepEqual(facetRange(facet), {positioned: true, fromMs: yearStartMs(-1_000_000), toMs: yearStartMs(5_000_000_000)});
});

test('the reading from -780000 to +4.5e9 ticks on the eon rung at round years', () => {
  const ticks = ticksForDomain({fromMs: yearStartMs(-780_000), toMs: yearStartMs(4_500_000_000) + DAY_MS});
  assert.ok(ticks.every((tick) => tick.unit === 'eon'), JSON.stringify(ticks.map((tick) => tick.unit)));
  assert.deepEqual(ticks.map((tick) => calendarFields(tick.ms).year), [0, 1_000_000_000, 2_000_000_000, 3_000_000_000, 4_000_000_000]);
  assert.ok(ticks.every((tick, i) => i === 0 || tick.ms > ticks[i - 1].ms), 'ticks ascend');
});

test('a span of two million years takes the age rung at round years', () => {
  const ticks = ticksForDomain({fromMs: yearStartMs(0), toMs: yearStartMs(3_000_000)});
  assert.ok(ticks.every((tick) => tick.unit === 'age'));
  assert.deepEqual(ticks.map((tick) => calendarFields(tick.ms).year), [0, 1_000_000, 2_000_000, 3_000_000]);
});

test('a domain beyond the Date range is read at year precision and never finer', () => {
  const start = yearStartMs(4_500_000_000);
  const ticks = ticksForDomain({fromMs: start, toMs: start + 2.6e9});   // about a month of ms
  assert.ok(ticks.every((tick) => tick.unit === 'year'), JSON.stringify(ticks));
});

test('calendar fields of a deep ms carry the year only; human fields are Date fields', () => {
  assert.deepEqual(calendarFields(yearStartMs(-780_000)), {year: -780_000, month: 0, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0});
  assert.deepEqual(calendarFields(parseTimestamp('1850-03-04T10:15:30Z')), {year: 1850, month: 2, day: 4, hour: 10, minute: 15, second: 30, millisecond: 0});
});

test('an instant before a deep year start reads the earlier year, the last half day included', () => {
  for (const year of [-780_000, 3_000_000_000, 4_500_000_000]) {
    const start = yearStartMs(year);
    assert.equal(calendarFields(start).year, year, `${year}: its first instant`);
    assert.equal(calendarFields(start - 3_600_000).year, year - 1, `${year}: an hour before its start`);
    assert.equal(calendarFields(start - 43_200_000).year, year - 1, `${year}: half a day before its start`);
  }
});

test('a minimum mark gap steps the rung down to the next finer honest step; a readable grid is unchanged', () => {
  // 16000 years on the millennium rung: the default step (10 millennia) leaves a single mark in this window.
  const wide = {fromMs: yearStartMs(-8000), toMs: yearStartMs(8000)};
  const minGapMs = 88 * (wide.toMs - wide.fromMs) / 320;
  assert.deepEqual(ticksForDomain(wide, {targetTicks: 2}).map((tick) => calendarFields(tick.ms).year), [0], 'the default step leaves one mark');
  assert.deepEqual(ticksForDomain(wide, {targetTicks: 2, minGapMs}).map((tick) => calendarFields(tick.ms).year), [-5000, 0, 5000], 'the 5-millennium step meets the gap');
  // A grid already readable keeps its own marks exactly.
  const human = {fromMs: yearStartMs(1850), toMs: yearStartMs(1851)};
  assert.deepEqual(ticksForDomain(human, {targetTicks: 8, minGapMs: 1}), ticksForDomain(human, {targetTicks: 8}));
});

// Human-scale golden. The digest below was produced by the authority before lane-2 T4
// over exactly this probe; it must not move. The probe covers parse, expand (every
// precision), ticks (human domains, several offsets and targets) and facet ranges.
test('human-scale output is unchanged: the pre-T4 probe digest', () => {
  // Human-scale probe: digests the authority's outputs over a fixed probe set.
  const yearMs = (y) => { const d = new Date(0); d.setUTCFullYear(y, 0, 1); d.setUTCHours(0,0,0,0); return d.getTime(); };
  const PRECISIONS = [undefined,'millennium','century','decade','year','month','day','hour','minute','second','subsecond'];
  const INSTANTS = ['0001','0099-02','0000-02-29','-000001','-000500','1850','0100','9999','1850-06-15T12:00:00+01:00','2000-01-01T00:00:00Z','+002026-09-01','2026-09-19T10:00:00Z','1850-03-04T10:15:30.250-05:30','0001-06-05T12:30:00+01:00','0099-12-31T23:00:00Z','-000001-12-31T23:59:59.999+01:00','2024-02-29T08:00:00+09:00','1582-10-15'];
  const out = {parse: [], expand: [], ticks: [], facet: [], errors: []};
  for (const s of INSTANTS) {
    try { out.parse.push([s, parseTimestamp(s)]); } catch (e) { out.parse.push([s, String(e.message)]); }
    for (const p of PRECISIONS) {
      try { out.expand.push([s, p ?? null, expandInstant(s, p)]); } catch (e) { out.expand.push([s, p ?? null, String(e.message)]); }
    }
  }
  const base = parseTimestamp('2026-09-01T10:00:00Z');
  const DOMAINS = [
    [parseTimestamp('1850'), parseTimestamp('1851')], [parseTimestamp('0000'), parseTimestamp('0100')],
    [parseTimestamp('-000500'), parseTimestamp('-000400')], [parseTimestamp('1800'), parseTimestamp('1900')],
    [parseTimestamp('0000'), parseTimestamp('2000')],
    [parseTimestamp('2026-09-01'), parseTimestamp('2026-09-02')],
    [base, base + 3000], [base, base + 500], [base, base + 3_600_000], [base, base + 315_576_000_000],
    [parseTimestamp('1850-03-04T10:15:30+01:00'), parseTimestamp('1850-03-04T10:15:31+01:00')],
    [yearMs(-100), yearMs(100)], [yearMs(0), yearMs(1)], [yearMs(-8000), yearMs(-7000)],
  ];
  for (const [from, to] of DOMAINS) for (const offsetMs of [0, 3_600_000, -19_800_000]) for (const targetTicks of [2, 6, 12]) {
    out.ticks.push([from, to, offsetMs, targetTicks, ticksForDomain({fromMs: from, toMs: to}, {offsetMs, targetTicks})]);
  }
  for (const facet of [{kind:'occurred',instant:'1850',precision:'year'},{kind:'valid',interval:{from:'1850',to:'1855',to_precision:'year'}},{kind:'valid',interval:{from:'0001',from_precision:'century'}},{kind:'valid',instant:'2026-09-19T10:00:00Z'},{kind:'valid',day_ref:'day:x'}]) {
    try { out.facet.push(facetRange(facet)); } catch (e) { out.facet.push(String(e.message)); }
  }
  const json = JSON.stringify(out);

  assert.equal(createHash('sha256').update(json).digest('hex'), '0f94d1da186853ccf0964fdc1c0b12b7e889f73f612ed2efdff493de406581d4');
});
