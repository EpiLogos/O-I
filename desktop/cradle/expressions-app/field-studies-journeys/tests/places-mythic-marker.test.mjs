/** Lane-4 T30 (map leg) — a mythic place must not look factual on the Places map. Covers the mark law that the
 * markers and the inspector read (the unpinned vendor placeStanding.ts, re-exported by the frame), the inspector's
 * rendered tag and sentence (LocationPanel, rendered to static markup through esbuild-in-tmp), and source reads of the
 * pinned renderer and map wiring, whose marker DOM needs a live maplibre and is not run here.
 *
 * Channels: the mark law and the inspector are SCRIPTED; the marker DOM branch is a SOURCE READING (renderer.ts); the
 * native look of the dashed ring is NOT RUN.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const engine=resolve(fileURLToPath(new URL('..',import.meta.url)));
const vendor=resolve(engine,'../vendor/research-canvas/packages/canvas/src/psychogeographic');
const require=createRequire(resolve(engine,'../package.json'));
const {build}=require('esbuild');

let api;
test.before(async()=>{
 const temporary=await mkdtemp(join(tmpdir(),'oi-places-mythic-'));
 try{
  const out=join(temporary,'places-mythic.mjs');
  const contents=[
   `export * from ${JSON.stringify(resolve(vendor,'placeStanding.ts'))};`,
   `export * as frame from ${JSON.stringify(resolve(engine,'src/placeStanding.ts'))};`,
   `export {LocationPanel} from ${JSON.stringify(resolve(vendor,'LocationPanel.tsx'))};`,
   `export {renderToStaticMarkup} from 'react-dom/server';`,
   `export {createElement} from 'react';`,
  ].join('\n');
  await build({stdin:{contents,resolveDir:engine},tsconfig:engine+'/tsconfig.json',bundle:true,platform:'node',format:'esm',jsx:'automatic',banner:{js:"import {createRequire as __cr} from 'node:module'; const require=__cr(import.meta.url);"},outfile:out,logLevel:'warning'});
  api=await import(pathToFileURL(out));
 } finally {
  await rm(temporary,{recursive:true,force:true});
 }
});

const src=(absolute)=>readFile(absolute,'utf8');
const paletteMythic=async()=>{
 const palette=await src(resolve(vendor,'../timeline/palette.ts'));
 return palette.match(/mythic:\s*"(#[0-9a-fA-F]{6})"/)[1];
};

test('T30 map: a mythic marker takes the dashed mythic ring, the Mythic note and the title sentence', async () => {
 const patch=api.markerStandingPatch('mythic');
 assert.ok(patch,'mythic has a marker patch');
 assert.equal(patch.standing,'mythic');
 assert.equal(patch.note,'Mythic');
 assert.equal(patch.title,api.MYTHIC_NOTE);
 assert.equal(patch.colour,await paletteMythic());
 assert.equal(patch.border,`2px dashed ${patch.colour}`);
});

test('T30 map: a factual or owner-vocabulary marker takes no patch at all, so it is the marker it was', () => {
 assert.equal(api.markerStandingPatch('factual'),null);
 assert.equal(api.markerStandingPatch('owner-vocabulary'),null);
 assert.equal(api.markerStandingPatch(undefined),null);
 assert.equal(api.markerStandingPatch(null),null);
});

test('T30 map: the frame re-exports the one law (no second copy of the mark)', () => {
 assert.equal(api.frame.placeStandingMark,api.placeStandingMark);
 assert.equal(api.frame.MYTHIC_NOTE,api.MYTHIC_NOTE);
 assert.equal(api.frame.markerStandingPatch,api.markerStandingPatch);
});

test('T30 inspector: a mythic place shows the mythic tag and the same sentence', () => {
 const node={graphNodeId:'place:isle',title:'The isle of dreams',entityType:'place',place:{coordinate:{precision:'approximate',latitude:10,longitude:20}}};
 const markup=api.renderToStaticMarkup(api.createElement(api.LocationPanel,{node,relatedNodes:[],expressions:[],hosted:true,standingClass:'mythic'}));
 assert.match(markup,/data-testid="place-standing-tag"/);
 assert.match(markup,/>mythic</);
 assert.match(markup,/data-testid="place-mythic-note"/);
 assert.ok(markup.includes(api.MYTHIC_NOTE.replace(/'/g,'&#x27;')),'the inspector carries the shared sentence');
});

test('T30 inspector: a factual or owner-vocabulary place renders exactly the panel it rendered before', () => {
 const node={graphNodeId:'place:harbour',title:'Harbour quarter',entityType:'place',place:{coordinate:{precision:'exact',latitude:51.5,longitude:-0.09}}};
 const base=api.renderToStaticMarkup(api.createElement(api.LocationPanel,{node,relatedNodes:[],expressions:[],hosted:true}));
 for (const standingClass of ['factual','owner-vocabulary',undefined]) {
  const markup=api.renderToStaticMarkup(api.createElement(api.LocationPanel,{node,relatedNodes:[],expressions:[],hosted:true,standingClass}));
  assert.equal(markup,base,`standing ${standingClass} renders the same inspector`);
 }
 assert.doesNotMatch(base,/place-standing-tag|place-mythic-note/);
});

test('T30 renderer (source reading): the mythic branch is the only place a marker differs, and it is gated', async () => {
 const renderer=await src(resolve(vendor,'renderer.ts'));
 assert.match(renderer,/standingClass\?: "factual" \| "mythic" \| "owner-vocabulary";/);
 assert.match(renderer,/const standing = markerStandingPatch\(place\.standingClass\);\s*if \(standing\) \{\s*element\.style\.border = standing\.border;\s*element\.dataset\.standing = standing\.standing;/);
 assert.match(renderer,/if \(standing\) \{\s*const tag = document\.createElement\("span"\);\s*tag\.className = "places-standing-note";/);
 // The factual style assignment is still the one it was, and the dataset is written only inside the mythic guard.
 assert.match(renderer,/border: style\.border,/);
 assert.equal(renderer.match(/dataset\.standing =/g).length,1,'dataset.standing is written in exactly one guarded place');
});

test('T30 map wiring (source reading): markers and the inspector read standing from the facet relation', async () => {
 const map=await src(resolve(vendor,'PsychogeographicMap.tsx'));
 assert.match(map,/standingClass: placeStandingMark\(facetByRef\.get\(node\.graphNodeId\)\?\.relation\)\.standingClass,/);
 assert.match(map,/standingClass=\{placeStandingMark\(facetByRef\.get\(selectedNode\.graphNodeId\)\?\.relation\)\.standingClass\}/);
});
