/** Lane-2 T19b — a Timeline event's disclosed passage reaches the inspector call that opens its source.
 * The bridge writes the passage on the subject→facet relation (techneBundle.ts); the call site reads that
 * relation's own properties through the one rule navigationIdentity.ts owns (evidenceAnchorOf). This bundles
 * the same vendored bridge and identity module the mount imports, so a change to either fails here. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const engine = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cradle = resolve(engine, '../../src/techne');
const require = createRequire(resolve(engine, '../package.json'));
const {build} = require('esbuild');

const AUTHORED = 'ql.techne:facet:tb0:authored';
const RECEIVED = 'ql.techne:facet:tb0:received';

let api;
test.before(async () => {
  const compiled = await build({
    stdin: {
      contents: [
        `export {bundleFromTechneReadings} from ${JSON.stringify(resolve(engine, '../vendor/research-canvas/packages/desktop-api/src/techneBundle.ts'))};`,
        `export {provingReading} from ${JSON.stringify(resolve(cradle, 'm0m5/journey/proving-reading.ts'))};`,
        `export {evidenceAnchorOf,evidenceOpenPlan} from ${JSON.stringify(resolve(cradle, 'm0m5/timeline/navigationIdentity.ts'))};`,
      ].join('\n'),
      resolveDir: engine,
      loader: 'ts',
    },
    alias: {'@research-canvas/schema': resolve(engine, '../vendor/research-canvas/packages/schema/src/index.ts')},
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  api = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
});

/** The relation the call site reads for one facet: the temporal relation whose target is that facet. */
const carriedFacet = (bundle, ref) => bundle.relationships.filter(row => row.targetGraphNodeId === ref && typeof row.properties.temporal_kind === 'string');

test('the disclosed passage of an event reaches the inspector call verbatim through the one identity rule', () => {
  const bundle = api.bundleFromTechneReadings([api.provingReading()]);
  const rows = carriedFacet(bundle, AUTHORED);
  assert.equal(rows.length, 1, 'the call site carries a passage only when exactly one temporal relation names the facet');
  const anchor = api.evidenceAnchorOf(rows[0].properties);
  assert.equal(anchor.state, 'passage');
  assert.deepEqual(anchor.selector, {unit: 'text_span', start: 0, end: 1200, anchor_ref: null});
  assert.deepEqual(api.evidenceOpenPlan(anchor), {source_ref: anchor.source_ref, selector: anchor.selector});
});

test('an event with no disclosed passage carries no selector, so its plan has none', () => {
  const bundle = api.bundleFromTechneReadings([api.provingReading()]);
  const rows = carriedFacet(bundle, RECEIVED);
  const anchor = api.evidenceAnchorOf(rows[0]?.properties ?? {});
  assert.notEqual(anchor.state, 'passage');
  assert.equal(api.evidenceOpenPlan(anchor)?.selector ?? null, null);
});

test('the Timeline call site hands the carried anchor to the inspector, and the inspector context admits it', async () => {
  const source = await readFile(resolve(engine, 'src/researchInstruments.tsx'), 'utf8');
  const onOpenNode = source.split('\n').find(line => line.includes('onOpenNode={(ref,node,relationField)'));
  assert.ok(onOpenNode, 'the timeline onOpenNode call site exists');
  assert.match(onOpenNode, /anchor:eventEvidence\(ref\)/, 'the call site passes the event\'s anchor through the one helper');
  const helper = source.slice(source.indexOf('const eventEvidence='), source.indexOf('const evidenceControl='));
  assert.ok(helper.length > 0, 'the one evidence helper exists');
  assert.match(helper, /evidenceAnchorOf\(/, 'the anchor is read by the navigation identity rule, not re-derived');
  assert.match(helper, /temporal_kind/, 'the anchor is read from the relation that carries the facet, not from the node');
  assert.match(source, /const evidenceControl=\(eventRef:string\|null\)=>\{[\s\S]*?evidenceControlOf\(anchor\)/, 'the evidence control reads the same rule for its presence');
  assert.match(source, /\{control\.present\}|!control\.present\)return <span className="research-evidence-absent"/, 'the control is absent unless a passage exists');
  assert.match(source, /inspectSubject:\(ref:string,context\?:\{node\?:unknown;relationField\?:unknown;anchor\?:unknown\}\)=>void;/);
});
