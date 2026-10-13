// Lane-2 T4b — deep time through every seam. The authority (scale.ts) positions
// and names deep years; the seams that carry a time to the Timeline must consume
// it, never truncate it or drop its rungs:
//   1. the techne transport serves every rung (eon..subsecond) and reads years whole;
//   2. the static transport (desktop-api index.ts) reads deep years whole;
//   3. the research-canvas schema admits the bounds the authority admits.
// Human-scale behaviour is pinned by the four-digit cases below.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {
  expandInstant,
  parseTimestamp,
  yearStartMs,
  yearsPerUnit,
} from '../src/techne/m0m5/timeline/scale.ts';
import {TEMPORAL_PRECISIONS as CONTRACT_TEMPORAL_PRECISIONS} from '../src/techne/contract.ts';
import {
  canonicalTemporalInstant,
  checkBoundOrder,
  compareTemporalBounds,
  isoTemporalBoundSchema,
  TEMPORAL_PRECISIONS,
  temporalEpochMs,
  temporalFields,
  temporalYear,
} from '../expressions-app/vendor/research-canvas/packages/schema/src/index.ts';
import {bandsFromReading} from '../expressions-app/vendor/research-canvas/packages/canvas/src/timeline/bands.ts';

// The seams under test, bundled as the journeys suite bundles them. The schema
// alias is the one package the desktop-api imports, so both read one copy.
const compiled = await build({
  stdin: {
    contents: [
      "export {bundleFromTechneReadings} from '../expressions-app/vendor/research-canvas/packages/desktop-api/src/techneBundle.ts';",
      "export {createTechneTransport} from '../expressions-app/vendor/research-canvas/packages/desktop-api/src/techneTransport.ts';",
      "export {createStaticBundleTransport} from '../expressions-app/vendor/research-canvas/packages/desktop-api/src/index.ts';",
    ].join('\n'),
    resolveDir: fileURLToPath(new URL('.', import.meta.url)),
    loader: 'ts',
  },
  alias: {'@research-canvas/schema': fileURLToPath(new URL('../expressions-app/vendor/research-canvas/packages/schema/src/index.ts', import.meta.url))},
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  logLevel: 'silent',
});
const seams = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

const MS_PER_YEAR = 365.2425 * 86_400_000;

/** Runs a check function against a collected list of issues, as a zod refinement context would. */
function collectOrderIssues(start, end) {
  const issues = [];
  checkBoundOrder(start, end, {addIssue: (issue) => issues.push(issue)}, ['window']);
  return issues;
}

// ---------------------------------------------------------------------------
// 3. The schema admits the bounds the authority admits.
// ---------------------------------------------------------------------------

test('four-digit bounds keep their existing verdicts: valid forms pass, malformed forms still fail', () => {
  for (const bound of ['2020', '1850-03', '1850-03-04', '1850-03-04T10:15:30+01:00', '1850-03-04T10:15:30.125Z', '1850-03-04 10:15:30+01:00', '0050-01-01'])
    assert.equal(isoTemporalBoundSchema.safeParse(bound).success, true, `${bound} stays valid`);
  // The authority admits 0050-01-01; the old Date.UTC check remapped years 0-99 to the 1900s and refused it.
  for (const bound of ['2020-13', '2020-02-30', '1850-03-04T25:00', '2020-1', 'not a date', '800', '-500'])
    assert.equal(isoTemporalBoundSchema.safeParse(bound).success, false, `${bound} stays invalid`);
});

test('deep bounds are admitted where the authority admits them: a bare year of any length, a signed dated year of six digits', () => {
  for (const bound of ['-780000', '4500000000', '-4500000000', '12345', '+012345', '-000500-01-01', '+012345-03-01T00:00:00Z'])
    assert.equal(isoTemporalBoundSchema.safeParse(bound).success, true, `${bound} is a deep bound the authority admits`);
});

test('a deep year with a month or day, or a legacy shorthand year, is refused as the authority refuses it', () => {
  for (const bound of ['4500000000-01-01', '4500000000-05', '-780000-02-30', '800', '-500', '+2020'])
    assert.equal(isoTemporalBoundSchema.safeParse(bound).success, false, `${bound} is not a bound the authority admits`);
});

test('a window that runs from a deep year to a deeper one orders on the authority\'s epoch ms', () => {
  assert.equal(compareTemporalBounds('-780000', '4500000000'), -1);
  assert.equal(compareTemporalBounds('4500000000', '-780000'), 1);
  assert.equal(compareTemporalBounds('-780000', '-780000'), 0);
  assert.deepEqual(collectOrderIssues('-780000', '4500000000'), []);
  assert.equal(collectOrderIssues('4500000000', '-780000').length, 1, 'a reversed deep window is refused');
  // Ordering is not fabricated across an unadmitted bound: the check stays silent, as before.
  assert.equal(compareTemporalBounds('4500000000-01-01', '-780000'), null);
});

test('the schema precision list is the authority\'s list: the same spellings in the same order, coarsest first', () => {
  // The authority's list is the contract's exported TEMPORAL_PRECISIONS (imported, not read from source).
  assert.equal(TEMPORAL_PRECISIONS, CONTRACT_TEMPORAL_PRECISIONS, 'the schema re-exports the contract list itself');
  assert.deepEqual(CONTRACT_TEMPORAL_PRECISIONS.slice(0, 4), ['eon', 'era', 'epoch', 'age']);
  // Every rung the list names is one the authority can expand.
  for (const rung of CONTRACT_TEMPORAL_PRECISIONS) {
    const unit = yearsPerUnit(rung);
    if (unit !== null) assert.ok(Number.isFinite(expandInstant('4500000000', rung).toMs), `${rung} expands a deep year`);
  }
});

test('the schema reads deep years through the authority: temporalYear, temporalFields and the legacy padding', () => {
  assert.equal(temporalYear('-780000'), -780000);
  assert.equal(temporalYear('4500000000'), 4_500_000_000);
  assert.equal(temporalYear('1850-03-04T00:30:00+01:00'), 1850, 'a year is read in the frame the instant declares');
  assert.equal(temporalFields('4500000000').year, 4_500_000_000);
  assert.equal(temporalFields('4500000000').month, 0, 'a deep year carries no month');
  assert.equal(temporalEpochMs('4500000000'), yearStartMs(4_500_000_000));
  assert.equal(canonicalTemporalInstant('800'), '0800');
  assert.equal(canonicalTemporalInstant('-500'), '-000500');
  assert.equal(canonicalTemporalInstant('-780000'), '-780000');
  assert.equal(canonicalTemporalInstant('1850-03-04T10:00+01:00'), '1850-03-04T10:00+01:00');
  assert.equal(temporalYear(canonicalTemporalInstant('800')), 800);
  assert.equal(temporalYear(canonicalTemporalInstant('-500')), -500);
});

// ---------------------------------------------------------------------------
// 1. The techne transport serves every rung and reads years whole.
// ---------------------------------------------------------------------------

const DEEP_RUNGS = [
  {precision: 'eon', instant: '4500000000'},
  {precision: 'era', instant: '-780000'},
  {precision: 'epoch', instant: '-780000'},
  {precision: 'age', instant: '-780000'},
  {precision: 'millennium', instant: '1000'},
];

function readingWith(temporal) {
  return {reading_ref: 'reading:deep-time', subject: {subject_ref: 'subject:deep-time', native_owner: 'oi'}, disclosure: {instruments: []}, temporal};
}

test('the techne transport serves every precision rung verbatim, the deep rungs included', async () => {
  const temporal = [...DEEP_RUNGS, {precision: 'subsecond', instant: '1850-03-04T10:15:30.125+01:00'}]
    .map((rung) => ({kind: 'occurred', facet_ref: `facet:${rung.precision}`, precision: rung.precision, instant: rung.instant}));
  const bundle = seams.bundleFromTechneReadings([readingWith(temporal)]);
  const view = await seams.createTechneTransport(bundle).loadTimelineView({workspaceId: bundle.workspaceId});
  assert.equal(view.nodes.length, temporal.length, 'every dated facet reaches the Timeline');
  for (const facet of temporal) {
    const row = view.nodes.find((entry) => entry.node.graphNodeId === facet.facet_ref);
    assert.ok(row, `${facet.precision} facet is served`);
    assert.equal(row.anchor.precision, facet.precision, `${facet.precision} keeps its precision: no fabricated exactness, no coarsening`);
    assert.equal(row.anchor.validFrom, facet.instant, `${facet.precision} instant is verbatim`);
  }
});

test('a deep techne anchor keeps its whole year and its honest extent at its own rung', async () => {
  const bundle = seams.bundleFromTechneReadings([readingWith(DEEP_RUNGS.map((rung) => ({
    kind: 'occurred', facet_ref: `facet:${rung.precision}`, precision: rung.precision, instant: rung.instant,
  })))]);
  const transport = seams.createTechneTransport(bundle);
  // 4500000000 must not be read as 450000 (the old six-digit truncation): it sits far from 450000.
  const eon = await transport.loadTimelineView({workspaceId: bundle.workspaceId, range: {startYear: 4_400_000_000, endYear: 4_600_000_000}});
  assert.deepEqual(eon.nodes.map((entry) => entry.node.graphNodeId), ['facet:eon'], 'the eon facet intersects a window around 4.5e9 and nothing else does');
  const none = await transport.loadTimelineView({workspaceId: bundle.workspaceId, range: {startYear: 440_000, endYear: 460_000}});
  assert.equal(none.nodes.some((entry) => entry.node.graphNodeId === 'facet:eon'), false, 'the truncated year 450000 is not where the eon sits');
  // The eon's honest extent is its own eon: [4e9, 5e9) years from the authority, not a point and not a fabricated day.
  const extent = expandInstant('4500000000', 'eon');
  assert.equal(extent.fromMs, yearStartMs(4_000_000_000));
  assert.equal(extent.toMs, yearStartMs(5_000_000_000));
  // A deep era containing -780000 is [-1e8, 0), read through the same authority.
  const era = expandInstant('-780000', 'era');
  assert.equal(era.fromMs, yearStartMs(-100_000_000));
  assert.equal(era.toMs, yearStartMs(0));
  assert.equal(Math.round((extent.toMs - extent.fromMs) / MS_PER_YEAR), 1_000_000_000, 'an eon is one billion years long');
});

test('a labelled deep span is drawn over its honest extent, at the rungs the authority names', async () => {
  const bundle = seams.bundleFromTechneReadings([readingWith([{
    kind: 'valid', facet_ref: 'facet:deep-span', label: 'Deep span',
    interval: {from: '-780000', to: '4500000000', from_precision: 'epoch', to_precision: 'eon'},
  }])]);
  const view = await seams.createTechneTransport(bundle).loadTimelineView({workspaceId: bundle.workspaceId});
  const record = view.bands.find((entry) => entry.band_ref === 'facet:deep-span');
  assert.ok(record, 'the deep span reaches the band reading');
  assert.equal(record.earliest_precision, 'epoch');
  assert.equal(record.latest_precision, 'eon');
  const drawn = bandsFromReading(view.bands);
  const band = drawn.bands.find((entry) => entry.id === 'facet:deep-span');
  assert.ok(band, `the deep span is drawn, not listed absent: ${JSON.stringify(drawn.absent)}`);
  assert.equal(band.label, 'Deep span', 'the source label is carried verbatim');
  // The epoch holding -780000 starts at -1e7; the eon holding 4.5e9 ends at 5e9. Both are the authority's own boundaries.
  assert.equal(band.fromMs, yearStartMs(-10_000_000));
  assert.equal(band.toMs, yearStartMs(5_000_000_000));
  assert.equal(band.fromMs, expandInstant('-780000', 'epoch').fromMs);
  assert.equal(band.toMs, expandInstant('4500000000', 'eon').toMs);
});

test('a deep year with a finer rung is refused by the authority, so the transport never claims a day it does not state', () => {
  assert.throws(() => expandInstant('4500000000', 'day'), /deep year carries no day precision/);
  assert.equal(parseTimestamp('-780000') === yearStartMs(-780_000), true);
});

// ---------------------------------------------------------------------------
// 2. The static transport reads deep years whole.
// ---------------------------------------------------------------------------

function staticNode(graphNodeId, validFrom, temporalPrecision) {
  return {
    graphNodeId, isTemporal: true, entityType: 'Event', historicity: 'historical', temporalRole: 'occurrence',
    validFrom, validTo: null, temporalPrecision,
  };
}

test('the static transport places deep years and legacy shorthand years, and reports no invalid anchor for them', async () => {
  const nodes = [
    staticNode('node:eon', '4500000000', 'eon'),
    staticNode('node:epoch', '-780000', 'epoch'),
    staticNode('node:legacy', '800', 'century'),
    staticNode('node:second', '1850-03-04T10:15:30+01:00', 'second'),
  ];
  const bundle = {project: {id: 'deep'}, nodes, relationships: [], nodeLayout: [], timelineLayout: [], edgeLayout: [], viewport: {x: 0, y: 0, zoom: 1}, appState: {}, lightingIndex: {}, canvasId: 'c', generatedAt: '2026-10-13T00:00:00Z'};
  const transport = seams.createStaticBundleTransport(bundle);
  const all = await transport.loadTimelineView({workspaceId: 'static:deep'});
  assert.deepEqual(all.diagnostics, [], 'no deep or legacy anchor is reported invalid');
  assert.equal(all.nodes.length, nodes.length);
  const eon = all.nodes.find((entry) => entry.node.graphNodeId === 'node:eon');
  assert.equal(eon.anchor.precision, 'eon', 'the static transport keeps the eon rung');
  const inEon = await transport.loadTimelineView({workspaceId: 'static:deep', range: {startYear: 4_400_000_000, endYear: 4_600_000_000}});
  assert.deepEqual(inEon.nodes.map((entry) => entry.node.graphNodeId), ['node:eon'], 'a deep window finds the deep year');
  const inEpoch = await transport.loadTimelineView({workspaceId: 'static:deep', range: {startYear: -800_000, endYear: -700_000}});
  assert.ok(inEpoch.nodes.some((entry) => entry.node.graphNodeId === 'node:epoch'), 'a deep window finds a six-digit deep year');
  const inLegacy = await transport.loadTimelineView({workspaceId: 'static:deep', range: {startYear: 700, endYear: 900}});
  assert.ok(inLegacy.nodes.some((entry) => entry.node.graphNodeId === 'node:legacy'), 'a legacy shorthand year still places as before');
});

test('the static transport still refuses a deep year with a finer precision it does not state', async () => {
  // A malformed deep date (a deep year with a month) is an invalid anchor, reported, not drawn.
  const bundle = {project: {id: 'deep'}, nodes: [staticNode('node:bad', '4500000000-05', 'eon')], relationships: [], nodeLayout: [], timelineLayout: [], edgeLayout: [], viewport: {x: 0, y: 0, zoom: 1}, appState: {}, lightingIndex: {}, canvasId: 'c', generatedAt: '2026-10-13T00:00:00Z'};
  const view = await seams.createStaticBundleTransport(bundle).loadTimelineView({workspaceId: 'static:deep'});
  assert.equal(view.nodes.length, 0);
  assert.equal(view.diagnostics.length, 1);
  assert.match(view.diagnostics[0].message, /invalid validFrom temporal anchor/);
});
