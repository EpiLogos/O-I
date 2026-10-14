/** Lane-4 T30 — one standing grammar on the Places surfaces, and lane-4 T26's honest binding copy.
 * Pure proof (no DOM) through the esbuild-in-tmp pattern of places-search.test.mjs, plus source reads of the panel,
 * the search row and the vendored palette so the three surfaces cannot drift from one vocabulary.
 *
 * Not covered here, named in the lane's OPEN: the map's own markers (renderer.ts drawPlaces and
 * PsychogeographicMap.tsx placeMarkers are pinned vendor files) are not yet standing-aware.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-standing-'));
 try{
  const out=join(temporary,'places-standing.mjs');
  await build({
   stdin:{contents:"export * from './src/placeStanding.ts';\nexport * from './src/placeSearch.ts';\nexport * from './src/placeTourRecord.ts';",resolveDir:engine},
   tsconfig:engine+'/tsconfig.json',
   bundle:true,
   platform:'node',
   format:'esm',
   outfile:out,
   logLevel:'warning',
  });
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const src=(relative)=>readFile(resolve(engine,relative),'utf8');
const SOURCE='wiki:source:field-notes';

test('T30: the three standing classes draw as three distinct marks; only mythic is tinted, dashed and noted', () => {
 const factual=api.placeStandingMark('LOCATED_IN');
 const owner=api.placeStandingMark('owner-term-not-in-the-hard-set');
 const mythic=api.placeStandingMark('MYTH_LOCATED_AT');
 assert.equal(factual.standingClass,'factual');
 assert.equal(owner.standingClass,'owner-vocabulary');
 assert.equal(mythic.standingClass,'mythic');
 // Factual and owner-vocabulary inherit the surface's ink and carry no mythic note.
 assert.equal(factual.colour,null);
 assert.equal(owner.colour,null);
 assert.equal(factual.note,null);
 assert.equal(owner.note,null);
 // Mythic is never factual styling: its own colour, its own dash, and the one mythic sentence.
 assert.notEqual(mythic.colour,null);
 assert.notEqual(mythic.dash,null);
 assert.equal(mythic.note,api.MYTHIC_NOTE);
 assert.match(api.MYTHIC_NOTE,/^Mythic — a disclosed narrative location, never presented as a factual one\.$/);
});

test('T30: the mythic mark reads the chronology palette’s mythic colour, never a private copy', async () => {
 const palette=await src('../vendor/research-canvas/packages/canvas/src/timeline/palette.ts');
 const hex=palette.match(/mythic:\s*"(#[0-9a-fA-F]{6})"/);
 assert.ok(hex,'the palette names a mythic colour');
 assert.equal(api.placeStandingMark('MYTH_LOCATED_AT').colour,hex[1]);
});

test('T30: the panel tag and the mythic note read the same mythic colour and sentence as the legend', async () => {
 const css=await src('src/placeFacetsPanel.css');
 const palette=await src('../vendor/research-canvas/packages/canvas/src/timeline/palette.ts');
 const hex=palette.match(/mythic:\s*"(#[0-9a-fA-F]{6})"/)[1];
 assert.match(css,new RegExp(`\\.place-standing-mythic\\{color:var\\(--place-mythic,${hex}\\)\\}`),'the panel mythic colour is the palette colour');
 const panel=await src('src/placeFacetsPanel.tsx');
 assert.match(panel,/\{MYTHIC_NOTE\}/,'the panel names mythic through the shared sentence');
 assert.doesNotMatch(panel,/Mythic — a disclosed narrative location/,'the literal sentence is no longer copied into the panel');
});

test('T30: a search row carries its facet’s standing from the cradle authority, labelled on the row', () => {
 const reading={
  subject:{subject_ref:'subject:voyage',native_owner:'wiki'},
  spatial:[
   {place_ref:'place:harbour',precision:'exact',relation:'LOCATED_IN',identity:{names:[{name:'Harbour quarter'}]},source_ref:SOURCE},
   {place_ref:'place:isle',precision:'approximate',relation:'MYTH_LOCATED_AT',identity:{names:[{name:'The isle of dreams'}]},source_ref:SOURCE},
  ],
 };
 const rows=api.placeSearchRows(reading,'');
 assert.deepEqual(rows.map(row=>row.kind),['place','place']);
 assert.deepEqual(rows.map(row=>row.standing),['factual','mythic']);
 // The label, key and offer are the T22 rows unchanged.
 assert.deepEqual(rows.map(row=>row.key),['place:harbour','place:isle']);
});

test('T30: the search row is rendered with its standing tag, and the tag reads the class the row carries', async () => {
 const panel=await src('src/placeSearchPanel.tsx');
 assert.match(panel,/place-standing-tag place-standing-\$\{row\.standing\}/);
 assert.match(panel,/data-testid="place-search-standing"/);
});

test('T26: a bound stop whose beat is gone stays, says so, and names the one step that clears it', () => {
 const tour={
  name:'Walk',
  stops:[{place_ref:'place:harbour',viewport:{x:1,y:2,zoom:9,pitch:0,bearing:0},caption:'Quay',hold_ms:1000,binding:{expression_ref:'expr:beat-1',scene_ref:'scene:journey'}}],
 };
 const [gone]=api.resolveTourBindings(tour,[]);
 assert.equal(gone.state,'unbound');
 assert.match(gone.reason,/The stop stays/);
 assert.match(gone.reason,/choose Not bound/);
 // The binding is still the one the record holds (no copy, no silent rewrite).
 assert.deepEqual(gone.binding,{expression_ref:'expr:beat-1',scene_ref:'scene:journey'});
 // A beat the journey still holds reads as bound, with no reason.
 const [held]=api.resolveTourBindings(tour,[{expression_ref:'expr:beat-1',scene_ref:'scene:journey'}]);
 assert.equal(held.state,'bound');
 assert.equal(held.reason,null);
});

test('T26: the panel names a bound stop by both its refs', async () => {
 const panel=await src('src/placeTourPanel.tsx');
 assert.match(panel,/Bound to journey beat \$\{state\.binding\.expression_ref\} in \$\{state\.binding\.scene_ref\}/);
});
