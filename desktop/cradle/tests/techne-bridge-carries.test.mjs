// Lane-2 T9b / T14b — what the ql.techne bridge carries for the chronology and the
// participant spans. Two carries are pinned here:
//   1. a validity band (TimelineBandRecord) carries the subject it belongs to, the
//      facet relationship's source node, verbatim (subject_ref);
//   2. a place facet's valid_from / valid_to ride the served Place projection as
//      identityValidFrom / identityValidTo, verbatim. The place facet states no
//      temporal precision (its `precision` is spatial), so the instants are kept as
//      disclosed and no rung is invented.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const compiled = await build({
  stdin: {
    contents: [
      "export {bundleFromTechneReadings} from '../expressions-app/vendor/research-canvas/packages/desktop-api/src/techneBundle.ts';",
      "export {createTechneTransport} from '../expressions-app/vendor/research-canvas/packages/desktop-api/src/techneTransport.ts';",
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

const reading = (subject, temporal = [], spatial = []) => ({
  reading_ref: `reading:${subject}`,
  subject: {subject_ref: subject, native_owner: 'owner:test'},
  temporal,
  spatial,
  disclosure: {instruments: []},
});

const POINT = {type: 'point', coordinates: [-1.2, 51.4]};

test('every band carries the subject it belongs to, and two subjects keep their own bands apart', async () => {
  const bundle = seams.bundleFromTechneReadings([
    reading('person:ada', [{kind: 'valid', facet_ref: 'life:ada', label: 'Ada life', interval: {from: '1874', to: '1951', from_precision: 'year', to_precision: 'year'}}]),
    reading('person:bo', [{kind: 'valid', facet_ref: 'life:bo', label: 'Bo life', interval: {from: '1900', to: '1960', from_precision: 'year', to_precision: 'year'}}]),
  ]);
  const view = await seams.createTechneTransport(bundle).loadTimelineView({workspaceId: bundle.workspaceId});
  const ada = view.bands.find((band) => band.band_ref === 'life:ada');
  const bo = view.bands.find((band) => band.band_ref === 'life:bo');
  assert.equal(ada.subject_ref, 'person:ada', 'the band names its subject verbatim');
  assert.equal(bo.subject_ref, 'person:bo');
  assert.equal(ada.label_verbatim, 'Ada life', 'the label rides with it, unchanged');
  assert.equal(ada.earliest, '1874');
  assert.equal(ada.latest, '1951');
});

test('a validity with no dated anchor still names its subject, and stays absent rather than positioned', async () => {
  const bundle = seams.bundleFromTechneReadings([
    reading('person:ada', [{kind: 'valid', facet_ref: 'life:ref-only', day_ref: 'day:2026-10-13'}]),
  ]);
  const view = await seams.createTechneTransport(bundle).loadTimelineView({workspaceId: bundle.workspaceId});
  const band = view.bands.find((entry) => entry.band_ref === 'life:ref-only');
  assert.ok(band, 'the continuity-only validity is listed');
  assert.equal(band.subject_ref, 'person:ada');
  assert.equal(band.earliest, null, 'no position is invented for a continuity ref');
  assert.equal(band.latest, null);
});

test('a place facet carries its valid_from and valid_to verbatim, and an undisclosed end stays null', async () => {
  const bundle = seams.bundleFromTechneReadings([
    reading('person:ada', [], [
      {place_ref: 'place:mill', precision: 'exact', geometry: POINT, valid_from: '1850', valid_to: '1900', uncertainty: 'closed by 1900'},
      {place_ref: 'place:open', precision: 'exact', geometry: POINT, valid_from: '1860', valid_to: null},
      {place_ref: 'place:undated', precision: 'exact', geometry: POINT},
    ]),
  ]);
  const transport = seams.createTechneTransport(bundle);
  const located = await transport.listLocatedGraphNodes();
  const mill = located.find((node) => node.graphNodeId === 'place:mill');
  assert.ok(mill, 'the place is served as a located node');
  assert.equal(mill.place.identityValidFrom, '1850', 'valid_from carried verbatim');
  assert.equal(mill.place.identityValidTo, '1900', 'valid_to carried verbatim');
  const open = located.find((node) => node.graphNodeId === 'place:open');
  assert.equal(open.place.identityValidFrom, '1860');
  assert.equal(open.place.identityValidTo, null, 'an undisclosed end is null, never invented');
  const undated = located.find((node) => node.graphNodeId === 'place:undated');
  assert.equal(undated.place.identityValidFrom, null);
  assert.equal(undated.place.identityValidTo, null);
});

test('the place validity keeps its instant shape: a deep or signed year is carried as the reading states it', async () => {
  const bundle = seams.bundleFromTechneReadings([
    reading('person:ada', [], [{place_ref: 'place:deep', precision: 'exact', geometry: POINT, valid_from: '-780000', valid_to: '-500'}]),
  ]);
  const located = await seams.createTechneTransport(bundle).listLocatedGraphNodes();
  const deep = located.find((node) => node.graphNodeId === 'place:deep');
  assert.equal(deep.place.identityValidFrom, '-780000');
  assert.equal(deep.place.identityValidTo, '-500');
});
